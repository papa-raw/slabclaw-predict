#!/usr/bin/env node
/// audit-markets.mjs — run the manipulation-signal engine on the 4 live markets.
/// Builds each card's price points from the oracle cross-grade ladder (scanner) +
/// the captured Cardmarket graded listings, runs assessCard(), prints a report, and
/// writes frontend/src/data/market-signals.json for the Oracle Swarm tab.

import { assessCard } from './manipulation-signals.mjs';
import { CONFIG } from './config.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('.', import.meta.url).pathname;
const CARDS = ['neo1-1st-18', 'jp-vs-091', 'base5-1st-83', 'base2-1st-3'];
const NAMES = { 'neo1-1st-18': 'Typhlosion', 'jp-vs-091': "Karen's Umbreon", 'base5-1st-83': 'Dark Raichu', 'base2-1st-3': 'Flareon' };

function loadJson(p, fallback) {
  const f = join(ROOT, p);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : fallback;
}
const cm = loadJson('memwal/shared/listings/cardmarket-2026-06-09.json', { cards: {} });
const consensus = loadJson('memwal/shared/consensus/latest.json', {});

async function oraclePoints(cardId) {
  try {
    const r = await fetch(`${CONFIG.slabclawApi}/api/registry/cards?ids=${encodeURIComponent(cardId)}`, { signal: AbortSignal.timeout?.(8000) });
    if (!r.ok) return [];
    const c = (await r.json())?.cards?.[0];
    // Only REAL sale-backed prices — exclude pc_display / estimates / stale / grade-equiv
    // stubs (0-sale display prices create phantom inversions at low/off grades).
    return (c?.oracles || [])
      .filter((o) => o.price > 0 && o.source && !/display|est|stale|equiv|capped/i.test(o.source))
      .map((o) => ({ kind: 'oracle', grader: o.grader, grade: Number(o.grade), price: o.price, currency: 'USD' }));
  } catch { return []; }
}

function cardmarketPoints(cardId) {
  return (cm.cards?.[cardId]?.listings || [])
    .filter((l) => l.grade != null && l.grader)
    .map((l) => ({ kind: 'listing', grader: l.grader, grade: Number(l.grade), price: l.priceEur, currency: 'EUR', seller: l.seller, note: l.note }));
}

async function main() {
  const out = { generatedAt: new Date().toISOString(), cards: {} };
  console.log('\n══ Market Quality / Manipulation Audit ══');

  for (const id of CARDS) {
    const op = await oraclePoints(id);
    const lp = cardmarketPoints(id);
    const settle = (consensus[id]?.consensusPriceCents / 100)
      || op.find((p) => p.grade === 10 && String(p.grader).toUpperCase() === 'PSA')?.price
      || 0;
    const r = assessCard({ points: [...op, ...lp], settledPriceUsd: settle });
    out.cards[id] = { name: NAMES[id], settledPriceUsd: Math.round(settle), ...r };

    console.log(`\n${NAMES[id].padEnd(16)} settle $${Math.round(settle).toLocaleString()}  ·  confidence ${r.confidence}${r.wideDispute ? '  ·  ⚠ DISPUTE WINDOW WIDENED' : ''}`);
    if (!r.flags.length) console.log('   ✓ clean — ladder consistent');
    for (const f of r.flags) console.log(`   [${f.severity.toUpperCase()}] ${f.message}`);
  }

  const dir = join(ROOT, '..', 'frontend', 'src', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'market-signals.json'), JSON.stringify(out, null, 2));
  console.log('\n✓ Wrote frontend/src/data/market-signals.json');
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
