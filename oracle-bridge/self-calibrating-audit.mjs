/// self-calibrating-audit.mjs — the swarm's self-updating quality/manipulation pass.
///
/// Fixes every flaw the /attack review found, AND does the fixing the way the track
/// rewards — as a memory-backed agent that grades each round against what it has
/// LEARNED about this card, not a fixed global rule:
///   • Anchor reconciliation — one PSA-10 number; the settle↔oracle gap is itself a flag.
///   • Temporal + liquidity gates — only compare fresh, sale-backed prices (≥minSales,
///     within windowDays of each other). No stale 1-sale comps masquerading as signal.
///   • Asks vs realized split — Cardmarket/eBay asks judged separately (lower severity),
///     never conflated with a realized settle.
///   • LEARNED baselines — divergence is measured against the card's own EMA ratio once
///     warm, so stable-but-extreme scarcity stops false-flagging while a real CHANGE fires.
///
/// Run it each round → it persists what it learned → next round is sharper. That is the
/// thesis: a swarm that audits and corrects its own methodology from memory.

import { GRADER_MULT, GRADE_BAND } from './manipulation-signals.mjs';
import { isWarm } from './calibration.mjs';

const up = (s) => String(s || '').toUpperCase();
const DAY = 86_400_000;
const r0 = (n) => Math.round(n).toLocaleString('en-US');
const pctOf = (n) => `${(n * 100).toFixed(0)}%`;
const realized = (pts) => pts.filter((p) => p.kind === 'realized' && p.priceUsd > 0);

function gated(a, b, windowDays, minSales) {
  if ((a.saleCount || 0) < minSales || (b.saleCount || 0) < minSales) return false;
  if (Math.abs((a.observedAtMs || 0) - (b.observedAtMs || 0)) > windowDays * DAY) return false;
  return true;
}

/// Assess one card with learned calibration. Returns { flags, confidence, wideDispute,
/// anchorUsd, learned } where `learned` is what to fold back into calibration.
export function assessCardCalibrated({ points = [], settleUsd = 0, oraclePsa10Usd = 0, calibration, windowDays = 14, minSales = 3 } = {}) {
  const flags = [];
  const learned = { ratios: {}, anchorGapPct: null, staleSources: [] };

  // 1) Anchor reconciliation — the same grade priced two ways is itself the signal.
  const anchorUsd = oraclePsa10Usd || settleUsd || 0;
  if (settleUsd > 0 && oraclePsa10Usd > 0) {
    const gap = Math.abs(settleUsd - oraclePsa10Usd) / Math.max(settleUsd, oraclePsa10Usd);
    learned.anchorGapPct = gap;
    if (gap > 0.20) {
      flags.push({ code: 'same_grade_disagreement', severity: 'high',
        message: `The swarm settle ($${r0(settleUsd)}) and the grade-matched PSA 10 oracle ($${r0(oraclePsa10Usd)}) disagree by ${pctOf(gap)} — the PSA-10 anchor itself is contested. Dispute window widened.` });
    }
  }

  const rz = realized(points);
  const psa = rz.filter((p) => up(p.grader) === 'PSA').sort((a, b) => a.grade - b.grade);
  const byKey = {};
  for (const p of rz) byKey[`${up(p.grader)}${p.grade}`] = p;

  // 2) Realized grade inversion — liquidity + temporal gated (no phantom low-grade noise).
  for (let i = 0; i < psa.length - 1; i++) {
    const lo = psa[i], hi = psa[i + 1];
    if (gated(lo, hi, windowDays, minSales) && lo.priceUsd >= hi.priceUsd) {
      flags.push({ code: 'grade_inversion', severity: 'high',
        message: `PSA ${lo.grade} ($${r0(lo.priceUsd)}) ≥ PSA ${hi.grade} ($${r0(hi.priceUsd)}) — both fresh and sale-backed; a lower grade priced over a higher one.` });
    }
  }

  // 3) Asks above the anchor — separate + labelled (asks structurally sit above realized).
  if (anchorUsd > 0) {
    for (const p of points.filter((x) => x.kind === 'ask' && x.priceUsd > 0)) {
      const isP10 = p.grade === 10 && up(p.grader) === 'PSA';
      if (!isP10 && p.priceUsd >= anchorUsd) {
        flags.push({ code: 'ask_above_anchor', severity: 'med',
          message: `A ${up(p.grader)} ${p.grade} is ASKING $${r0(p.priceUsd)} — at/above the PSA 10 anchor ($${r0(anchorUsd)}). An ask, not a sale, but worth watching.` });
      }
    }
  }

  // 4) Ratios vs the card's LEARNED baseline (self-updating); global band only while cold.
  const checkRatio = (key, lowPt, highPt, globalBand) => {
    if (!lowPt || !highPt || !gated(lowPt, highPt, windowDays, minSales)) return;
    const ratio = lowPt.priceUsd / highPt.priceUsd;
    learned.ratios[key] = Number(ratio.toFixed(3));
    if (isWarm(calibration, key)) {
      const base = calibration.gradeRatios[key].ema;
      const dev = Math.abs(ratio - base) / base;
      if (dev > 0.5) {
        flags.push({ code: 'ratio_shift', severity: dev > 1 ? 'high' : 'med',
          message: `${key} is ${ratio.toFixed(2)}× now vs its learned ${base.toFixed(2)}× (${pctOf(dev)} move) — a real change from this card's own norm.` });
      }
    } else if (globalBand) {
      const [lo, hi] = globalBand;
      if (ratio < lo || ratio > hi) {
        flags.push({ code: 'ratio_unlearned', severity: 'med',
          message: `${key} is ${ratio.toFixed(2)}× — outside the typical ${lo}–${hi}× band (still learning this card's true norm).` });
      }
    }
  };

  const p10 = byKey['PSA10'];
  if (p10) {
    checkRatio('PSA9/PSA10', byKey['PSA9'], p10, GRADE_BAND[9]);
    checkRatio('PSA8/PSA10', byKey['PSA8'], p10, GRADE_BAND[8]);
  }
  // cross-grader at the SAME grade, below grade 10 only (the PSA-10 premium breaks the flat multiplier)
  for (const p of rz.filter((x) => up(x.grader) !== 'PSA' && x.grade < 10)) {
    const ref = byKey[`PSA${p.grade}`];
    const mult = GRADER_MULT[up(p.grader)];
    if (ref && mult) checkRatio(`${up(p.grader)}${p.grade}/PSA${p.grade}`, p, ref, [mult * 0.5, mult * 1.6]);
  }

  // record which realized comps are stale relative to the freshest (memory of source drift)
  const freshest = Math.max(0, ...rz.map((p) => p.observedAtMs || 0));
  for (const p of rz) if (freshest - (p.observedAtMs || 0) > windowDays * DAY) learned.staleSources.push(`${up(p.grader)}${p.grade}`);

  const high = flags.filter((f) => f.severity === 'high').length;
  const med = flags.filter((f) => f.severity === 'med').length;
  const confidence = Math.max(0.4, 1 - 0.2 * high - 0.08 * med);
  return { flags, confidence: Number(confidence.toFixed(2)), wideDispute: high > 0, anchorUsd, learned };
}
