/// manipulation-signals.mjs — oracle-quality / manipulation-risk detectors.
///
/// Computes flags from a card's cross-grade price ladder + graded listings WITHOUT
/// scraping (uses the oracle ladder + captured listings we already have). Two
/// headline signals (Pat's idea):
///   1. GRADE INVERSION — a lower grade priced at/above a higher grade, or a
///      below-grade listing at/above the settled PSA-10 price.
///   2. MULTIPLIER DIVERGENCE — the cross-grade / cross-grader price ratio sits
///      far outside its typical band (e.g. PSA 9 is normally ~0.30–0.45 of PSA 10).
/// Plus INTRA-GRADE SPREAD (same grade, wildly different asks = fishing).
///
/// These do NOT hard-reject — extreme ratios on ultra-scarce vintage PSA 10s can be
/// real scarcity. They lower settlement confidence and recommend widening the
/// dispute window, with a plain-language reason for the bettor.

const up = (s) => String(s || '').toUpperCase();
export const EUR_USD = 1.08; // approximate; listings in EUR are normalized for comparison

/// Same-grade cross-grader price multipliers, relative to PSA (from the oracle).
export const GRADER_MULT = {
  PSA: 1.0, CGC: 0.75, BGS: 0.80, SGC: 0.55, TAG: 0.60, ACE: 0.50,
  AOG: 0.55, AIG: 0.45, GRAAD: 0.50, CDZ: 0.45, BECKETT: 0.80,
};

/// Typical PSA grade price as a fraction of PSA 10 — [min, max] band.
export const GRADE_BAND = {
  10: [1.0, 1.0], 9.5: [0.45, 0.85], 9: [0.25, 0.48], 8.5: [0.15, 0.33],
  8: [0.10, 0.25], 7.5: [0.07, 0.18], 7: [0.05, 0.14], 6: [0.03, 0.10], 5: [0.02, 0.08],
};

const usdOf = (p) => (p.currency === 'EUR' ? p.price * EUR_USD : p.price);
const isPsa10 = (p) => Number(p.grade) === 10 && up(p.grader) === 'PSA';
const r0 = (n) => Math.round(n).toLocaleString('en-US');

/// 1. GRADE INVERSIONS — unambiguous red flags.
export function gradeInversions(points, settledPriceUsd) {
  const flags = [];

  // (a) Oracle-ladder inversion: among PSA oracle prices, a lower grade ≥ a higher grade.
  const psa = points
    .filter((p) => p.kind === 'oracle' && up(p.grader) === 'PSA' && p.price > 0)
    .sort((a, b) => a.grade - b.grade);
  for (let i = 0; i < psa.length - 1; i++) {
    const lo = psa[i], hi = psa[i + 1];
    if (usdOf(lo) >= usdOf(hi)) {
      flags.push({
        code: 'oracle_ladder_inversion', severity: 'high',
        message: `PSA ${lo.grade} oracle ($${r0(usdOf(lo))}) is at/above PSA ${hi.grade} ($${r0(usdOf(hi))}) — a lower grade priced over a higher one.`,
      });
    }
  }

  // (b) Below-grade listing at/above the settled PSA-10 price.
  if (settledPriceUsd > 0) {
    for (const p of points.filter((p) => p.kind === 'listing' && p.price > 0)) {
      if (!isPsa10(p) && usdOf(p) >= settledPriceUsd) {
        flags.push({
          code: 'listing_above_settle', severity: 'high',
          message: `A ${up(p.grader)} ${p.grade} listing ($${r0(usdOf(p))}) is at/above the settled PSA 10 ($${r0(settledPriceUsd)}) — a below-grade slab asking over the graded 10.`,
        });
      }
    }
  }
  return flags;
}

/// 2. MULTIPLIER DIVERGENCE — ratio sits outside its typical band. "review", not reject.
export function multiplierDivergence(points) {
  const flags = [];
  const oracle = (grader, grade) =>
    points.find((p) => p.kind === 'oracle' && up(p.grader) === up(grader) && Number(p.grade) === grade && p.price > 0);

  const p10 = oracle('PSA', 10);

  // Cross-grade: PSA 9 ÷ PSA 10 (Pat's example), plus PSA 8 ÷ PSA 10.
  if (p10) {
    for (const g of [9, 8]) {
      const pg = oracle('PSA', g);
      if (!pg) continue;
      const ratio = usdOf(pg) / usdOf(p10);
      const [lo, hi] = GRADE_BAND[g];
      if (ratio < lo || ratio > hi) {
        const dir = ratio < lo ? 'far below' : 'far above';
        flags.push({
          code: 'multiplier_divergence', severity: ratio < lo / 2 || ratio > hi * 1.5 ? 'high' : 'med',
          ratio: Number(ratio.toFixed(2)),
          message: `PSA ${g} is ${(ratio).toFixed(2)}× PSA 10 — ${dir} the typical ${lo}–${hi}× band. Either the 10 is propped up or the ${g} is mispriced.`,
        });
      }
    }
  }

  // Cross-grader at the same grade vs the known multiplier (e.g. CGC 9 vs PSA 9 ≈ 0.75).
  const psaByGrade = {};
  for (const p of points.filter((p) => p.kind === 'oracle' && up(p.grader) === 'PSA' && p.price > 0)) psaByGrade[p.grade] = p;
  for (const p of points.filter((p) => p.kind === 'oracle' && up(p.grader) !== 'PSA' && p.price > 0)) {
    const ref = psaByGrade[p.grade];
    const mult = GRADER_MULT[up(p.grader)];
    if (!ref || !mult) continue;
    const actual = usdOf(p) / usdOf(ref);
    if (actual < mult * 0.5 || actual > mult * 1.6) {
      flags.push({
        code: 'grader_multiplier_divergence', severity: 'med',
        message: `${up(p.grader)} ${p.grade} is ${actual.toFixed(2)}× the PSA ${p.grade} (expected ~${mult}×) — cross-grader price out of line.`,
      });
    }
  }
  return flags;
}

/// 3. INTRA-GRADE SPREAD — same (grader,grade), asks differ wildly.
export function intraGradeSpread(points, threshold = 2.5) {
  const flags = [];
  const groups = {};
  for (const p of points.filter((p) => p.kind === 'listing' && p.price > 0 && p.grade != null)) {
    const k = `${up(p.grader)} ${p.grade}`;
    (groups[k] ||= []).push(usdOf(p));
  }
  for (const [k, prices] of Object.entries(groups)) {
    if (prices.length < 2) continue;
    const min = Math.min(...prices), max = Math.max(...prices);
    if (max / min >= threshold) {
      flags.push({
        code: 'intra_grade_spread', severity: 'med',
        message: `${k} asks range $${r0(min)}–$${r0(max)} (${(max / min).toFixed(1)}×) — thin/fishy liquidity at the same grade.`,
      });
    }
  }
  return flags;
}

/// Aggregate all signals for one card → flags + confidence penalty + dispute rec.
export function assessCard({ points = [], settledPriceUsd = 0 } = {}) {
  const flags = [
    ...gradeInversions(points, settledPriceUsd),
    ...multiplierDivergence(points),
    ...intraGradeSpread(points),
  ];
  const high = flags.filter((f) => f.severity === 'high').length;
  const med = flags.filter((f) => f.severity === 'med').length;
  // confidence multiplier: each high −20%, each med −8%, floored at 0.4.
  const confidence = Math.max(0.4, 1 - 0.2 * high - 0.08 * med);
  const wideDispute = high > 0; // any unambiguous inversion → widen the dispute window
  const summary = flags.length === 0
    ? 'No grade-relationship anomalies — the price ladder looks consistent.'
    : `${flags.length} quality flag${flags.length === 1 ? '' : 's'} (${high} high) — settlement confidence reduced${wideDispute ? '; dispute window widened' : ''}.`;
  return { flags, confidence: Number(confidence.toFixed(2)), wideDispute, summary };
}
