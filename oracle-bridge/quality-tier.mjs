/// quality-tier.mjs — TIER 3 of the swarm: the self-auditing quality pass.
///
/// Runs after the coordinator (Tier 2). For each card it reconciles the swarm settle
/// against the grade-matched PSA-10 oracle, runs the grade-inversion / multiplier
/// checks against the card's LEARNED calibration, persists what it learned to MemWal,
/// and returns per-card quality { flags, confidence, wideDispute }. This is the fix
/// for the /attack finding that the swarm could settle on a PSA-10 number contested
/// 23–48% by the grade-matched oracle: now that gap widens the dispute window.

import { assessCardCalibrated } from './self-calibrating-audit.mjs';
import { loadCalibration, updateCalibration, saveCalibration } from './calibration.mjs';
import { EUR_USD } from './manipulation-signals.mjs';
import { CONFIG } from './config.mjs';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('.', import.meta.url).pathname;
const NAMES = { 'neo1-1st-18': 'Typhlosion', 'jp-vs-091': "Karen's Umbreon", 'base5-1st-83': 'Dark Raichu', 'base2-1st-3': 'Flareon' };
const loadJson = (p, fb) => (existsSync(join(ROOT, p)) ? JSON.parse(readFileSync(join(ROOT, p), 'utf8')) : fb);

async function pointsFor(cardId, consensus) {
  const cm = loadJson('memwal/shared/listings/cardmarket-live.json', { cards: {} });
  let oraclePsa10 = 0;
  const points = [];
  try {
    const r = await fetch(`${CONFIG.slabclawApi}/api/registry/cards?ids=${encodeURIComponent(cardId)}`, { signal: AbortSignal.timeout?.(8000) });
    const c = (await r.json())?.cards?.[0];
    for (const o of c?.oracles || []) {
      if (!(o.price > 0) || !o.source || /display|est|stale|equiv|capped/i.test(o.source)) continue; // real sale-backed only
      points.push({ kind: 'realized', grader: o.grader, grade: Number(o.grade), priceUsd: o.price, saleCount: o.saleCount || 0, observedAtMs: Date.parse(o.updatedAt || o.observedAt || '') || 0 });
      if (String(o.grader).toUpperCase() === 'PSA' && Number(o.grade) === 10) oraclePsa10 = o.price;
    }
  } catch { /* backend down — degrade gracefully */ }
  for (const l of cm.cards?.[cardId]?.listings || []) {
    if (l.grade != null && l.grader) points.push({ kind: 'ask', grader: l.grader, grade: Number(l.grade), priceUsd: l.priceEur * EUR_USD });
  }
  const settleUsd = (consensus?.[cardId]?.consensusPriceCents / 100) || oraclePsa10 || 0;
  return { points, settleUsd, oraclePsa10Usd: oraclePsa10 };
}

/// Run the quality tier over the cards. Persists calibration (learns) + writes the
/// frontend signals. Returns { generatedAt, cards: { id: {flags,confidence,wideDispute} } }.
export async function runQualityTier(cardIds, consensus = {}) {
  const out = { generatedAt: new Date().toISOString(), cards: {} };
  for (const id of cardIds) {
    const input = await pointsFor(id, consensus);
    const cal = loadCalibration(id);
    const res = assessCardCalibrated({ ...input, calibration: cal });
    saveCalibration(updateCalibration(cal, res.learned)); // learn → MemWal
    out.cards[id] = { name: NAMES[id] || id, settledPriceUsd: Math.round(input.settleUsd), confidence: res.confidence, wideDispute: res.wideDispute, flags: res.flags };
  }
  const dir = join(ROOT, '..', 'frontend', 'src', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'market-signals.json'), JSON.stringify(out, null, 2));
  return out;
}
