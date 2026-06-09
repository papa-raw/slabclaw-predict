/// calibration.mjs — per-card LEARNED methodology calibration, persisted on MemWal.
///
/// This is what makes the quality engine self-updating: instead of judging every
/// card against fixed global heuristics (which false-positive on scarce cards),
/// the swarm REMEMBERS each card's own normal price relationships and grades new
/// rounds against that learned baseline. Stable-but-extreme ratios (real scarcity)
/// stop firing once learned; a SUDDEN move still fires. Smarter every run — the
/// MemWal "remember and build over time" thesis, applied to the swarm's own method.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const DIR = join(new URL('.', import.meta.url).pathname, 'memwal', 'shared', 'calibration');
const ALPHA = 0.4; // EMA learning rate — recent rounds matter more

function emaUpdate(node, x) {
  if (!node || node.n === 0 || node.ema == null) return { ema: x, n: 1 };
  return { ema: ALPHA * x + (1 - ALPHA) * node.ema, n: node.n + 1 };
}

export function defaultCalibration(cardId) {
  return { cardId, rounds: 0, gradeRatios: {}, anchorGap: { ema: null, n: 0 }, sourceStaleness: {}, updatedAt: null };
}

export function loadCalibration(cardId) {
  const p = join(DIR, `${cardId}.json`);
  if (!existsSync(p)) return defaultCalibration(cardId);
  try { return { ...defaultCalibration(cardId), ...JSON.parse(readFileSync(p, 'utf8')) }; }
  catch { return defaultCalibration(cardId); }
}

export function saveCalibration(cal) {
  mkdirSync(DIR, { recursive: true });
  writeFileSync(join(DIR, `${cal.cardId}.json`), JSON.stringify(cal, null, 2));
}

/// Fold one round's observations into the learned calibration (pure — returns a
/// new object; persist with saveCalibration).
///   observations = { ratios: {key: value}, anchorGapPct: number, staleSources: [key] }
export function updateCalibration(cal, observations = {}) {
  const next = {
    ...cal,
    gradeRatios: { ...cal.gradeRatios },
    sourceStaleness: { ...cal.sourceStaleness },
    rounds: cal.rounds + 1,
    updatedAt: new Date().toISOString(),
  };
  for (const [key, val] of Object.entries(observations.ratios || {})) {
    if (val > 0 && Number.isFinite(val)) next.gradeRatios[key] = emaUpdate(cal.gradeRatios[key], val);
  }
  if (observations.anchorGapPct != null && Number.isFinite(observations.anchorGapPct)) {
    next.anchorGap = emaUpdate(cal.anchorGap, observations.anchorGapPct);
  }
  for (const s of observations.staleSources || []) {
    next.sourceStaleness[s] = (cal.sourceStaleness[s] || 0) + 1;
  }
  return next;
}

/// Is this card's calibration "warm" enough to trust its learned baseline?
export function isWarm(cal, key) {
  const node = cal.gradeRatios?.[key];
  return !!node && node.n >= 2;
}
