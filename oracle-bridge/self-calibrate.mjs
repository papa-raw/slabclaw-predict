#!/usr/bin/env node
/// self-calibrate.mjs — runs the self-updating quality agent over the 4 live cards
/// for N rounds, persisting learned calibration to MemWal each round, and shows the
/// false-positive count DROP as the swarm learns each card's true norm. The final
/// (warm) round's flags are written for the frontend.
///
/// This is the thesis on real data: a memory-backed swarm that audits and corrects
/// its OWN methodology — smarter every run.
///
/// Usage: node self-calibrate.mjs [rounds]   (default 3)

import { assessCardCalibrated } from './self-calibrating-audit.mjs';
import { loadCalibration, updateCalibration, saveCalibration } from './calibration.mjs';
import { EUR_USD } from './manipulation-signals.mjs';
import { CONFIG } from './config.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('.', import.meta.url).pathname;
const ROUNDS = Math.max(1, parseInt(process.argv[2] || '3', 10));
const CARDS = ['neo1-1st-18', 'jp-vs-091', 'base5-1st-83', 'base2-1st-3'];
const NAMES = { 'neo1-1st-18': 'Typhlosion', 'jp-vs-091': "Karen's Umbreon", 'base5-1st-83': 'Dark Raichu', 'base2-1st-3': 'Flareon' };

const loadJson = (p, fb) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : fb);
const cm = loadJson('memwal/shared/listings/cardmarket-live.json',
  loadJson('memwal/shared/listings/cardmarket-2026-06-09.json', { cards: {} }));
const consensus = loadJson('memwal/shared/consensus/latest.json', {});

async function pointsFor(cardId) {
  let oraclePsa10 = 0;
  const points = [];
  try {
    const r = await fetch(`${CONFIG.slabclawApi}/api/registry/cards?ids=${encodeURIComponent(cardId)}`, { signal: AbortSignal.timeout?.(8000) });
    const c = (await r.json())?.cards?.[0];
    for (const o of c?.oracles || []) {
      if (!(o.price > 0) || !o.source || /display|est|stale|equiv|capped/i.test(o.source)) continue; // real sale-backed only
      const observedAtMs = Date.parse(o.updatedAt || o.observedAt || '') || 0;
      points.push({ kind: 'realized', grader: o.grader, grade: Number(o.grade), priceUsd: o.price, saleCount: o.saleCount || 0, observedAtMs });
      if (String(o.grader).toUpperCase() === 'PSA' && Number(o.grade) === 10) oraclePsa10 = o.price;
    }
  } catch { /* backend may be down */ }
  for (const l of cm.cards?.[cardId]?.listings || []) {
    if (l.grade != null && l.grader) points.push({ kind: 'ask', grader: l.grader, grade: Number(l.grade), priceUsd: l.priceEur * EUR_USD });
  }
  const settleUsd = (consensus[cardId]?.consensusPriceCents / 100) || oraclePsa10 || 0;
  return { points, settleUsd, oraclePsa10Usd: oraclePsa10 };
}

async function main() {
  // gather inputs once (static data); learning happens across rounds via persisted calibration
  const inputs = {};
  for (const id of CARDS) inputs[id] = await pointsFor(id);

  console.log(`\n══ Self-calibrating quality agent — ${ROUNDS} rounds (learning per card on MemWal) ══`);
  const perRound = [];
  let lastResults = {};

  for (let round = 1; round <= ROUNDS; round++) {
    const counts = {};
    for (const id of CARDS) {
      const cal = loadCalibration(id);
      const res = assessCardCalibrated({ ...inputs[id], calibration: cal });
      saveCalibration(updateCalibration(cal, res.learned)); // persist what it learned → MemWal
      counts[id] = res.flags.length;
      lastResults[id] = { name: NAMES[id], settledUsd: Math.round(inputs[id].settleUsd), ...res };
    }
    perRound.push(counts);
    const total = Object.values(counts).reduce((a, b) => a + b, 0);
    console.log(`  round ${round}: ${CARDS.map((id) => `${NAMES[id].split(' ')[0]} ${counts[id]}`).join(' · ')}  (total ${total} flags)`);
  }

  console.log('\n── Convergence (false positives self-correct as the card is learned) ──');
  for (const id of CARDS) {
    const first = perRound[0][id], last = perRound[perRound.length - 1][id];
    const arrow = last < first ? `▼ ${first}→${last}` : last === first ? `= ${last}` : `▲ ${first}→${last}`;
    console.log(`  ${NAMES[id].padEnd(16)} ${arrow}`);
  }

  console.log('\n── Final (warm) flags — what survives is real ──');
  for (const id of CARDS) {
    const r = lastResults[id];
    console.log(`\n${r.name.padEnd(16)} settle $${r.settledUsd.toLocaleString()} · confidence ${r.confidence}${r.wideDispute ? ' · ⚠ dispute widened' : ''}`);
    if (!r.flags.length) console.log('   ✓ clean');
    for (const f of r.flags) console.log(`   [${f.severity.toUpperCase()}] ${f.message}`);
  }

  // write final flags for the frontend (same shape the panel reads)
  const out = { generatedAt: new Date().toISOString(), rounds: ROUNDS, cards: {} };
  for (const id of CARDS) {
    const r = lastResults[id];
    out.cards[id] = { name: r.name, settledPriceUsd: r.settledUsd, confidence: r.confidence, wideDispute: r.wideDispute, flags: r.flags };
  }
  const dir = join(ROOT, '..', 'frontend', 'src', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'market-signals.json'), JSON.stringify(out, null, 2));
  console.log('\n✓ Wrote frontend/src/data/market-signals.json (final warm round) + calibration to memwal/shared/calibration/');
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
