/// registry.js — hybrid loader + selectors for the SlabClaw card registry.
///
/// HYBRID: try the live pocket-scanner API (/api/registry/cards), and on any
/// failure fall back to the bundled demo snapshot. The snapshot guarantees the
/// hackathon demo renders with real data even if the backend is unreachable.

import snapshot from '../data/registry-snapshot.json';
import { toTime } from './format';

const norm = (s) => (s || '').toString().trim().toUpperCase();
const sameGrade = (a, b) => Number(a) === Number(b);

/// Whether a registry listing belongs in the buyable "LISTINGS" ladder.
/// Two junk classes are excluded at the source:
///   1. Auction BIDS — a current high-bid is not a purchasable ask, and its
///      auction URL goes dead the moment the auction ends.
///   2. Implausible vs the grade oracle — a PSA-10 row priced far below the
///      grade-matched oracle is a wrong-grade/variant scrape or a stale/dead
///      auction, not a real PSA-10 ask. Asks sit ABOVE realized, never 60% below.
export function isSurfaceableListing(l, oracleAnchorPrice) {
  if (!l || l.price == null || l.price <= 0) return false;
  const type = (l.listing_type || l.type || '').toString().toLowerCase();
  if (type === 'bid') return false; // auction bid, not a buyable ask
  if (!l.url) return false;          // no link → can't act on it
  const oracle = oracleAnchorPrice ?? l.oracle_price ?? l.oracle_anchor?.price ?? null;
  if (oracle != null && oracle > 0 && l.price < 0.4 * oracle) return false; // wrong-grade/variant/dead
  return true;
}

/** Load one card's full registry record. Live-first, snapshot-fallback. */
export async function loadCard(productId) {
  if (!productId) return null;
  try {
    const res = await fetch(`/api/registry/cards?ids=${encodeURIComponent(productId)}`, {
      signal: AbortSignal.timeout?.(4000),
    });
    if (res.ok) {
      const json = await res.json();
      const card = json?.cards?.[0];
      if (card?.product) return { ...card, _source: 'live' };
    }
  } catch {
    /* fall through to snapshot */
  }
  const snap = snapshot[productId];
  return snap ? { ...snap, _source: 'snapshot' } : null;
}

/** Current oracle anchor for a grader+grade (the resolving value). */
export function oracleForGrade(card, grader, grade) {
  if (!card?.oracles) return null;
  const g = norm(grader);
  return (
    card.oracles.find((o) => norm(o.grader) === g && sameGrade(o.grade, grade)) || null
  );
}

// Drop any source-aggregator URLs we don't surface (keeps only real marketplace links).
const SUPPRESS_URL = /pricecharting/i;
const cleanUrl = (u) => (u && !SUPPRESS_URL.test(u) ? u : null);

// Human-readable oracle-source labels. Strips internal source codes so no
// upstream data provider is surfaced in the UI.
const SOURCE_LABELS = {
  pc_sold: 'Sold avg', pc_sold_thin: 'Sold avg', pc_grader_est: 'Estimated',
  pc_last: 'Last sale', pc_last_est: 'Estimated', pc_last_stale: 'Last sale',
  pc_display: 'Market price', pc_grade_equiv: 'Grade-equivalent',
  'ebay-api': 'eBay active', ebay_active: 'eBay active', manual: 'Manual',
};
export function sourceLabel(src) {
  if (!src) return '—';
  return SOURCE_LABELS[src] || String(src).replace(/^pc[_-]/i, '').replace(/[_-]/g, ' ');
}

/**
 * Sold-comps time-series for the chart. Combines real cross-platform sales and
 * aggregated sold comps, grader+grade matched.
 * Returns ascending [{ t, price, date, platform, url, source }].
 */
export function priceSeries(card, grader, grade) {
  if (!card) return [];
  const g = norm(grader);
  const out = [];

  // EXACT product only — same grader AND same grade (e.g. PSA 10). Cross-grade
  // comps are stripped from the methodology entirely, never down-weighted.
  for (const s of card.soldTransactions || []) {
    if (norm(s.grader) !== g || !sameGrade(s.grade, grade)) continue;
    const t = toTime(s.saleDate);
    if (t == null || !s.salePrice) continue;
    out.push({ t, date: s.saleDate, price: s.salePrice, platform: s.platform || 'sale', url: cleanUrl(s.url), source: 'sale' });
  }
  for (const s of card.soldComps || []) {
    if (norm(s.grader) !== g || !sameGrade(s.grade, grade)) continue;
    const t = toTime(s.sale_date);
    if (t == null || !s.price) continue;
    out.push({ t, date: s.sale_date, price: s.price, platform: 'sold comp', url: cleanUrl(s.url), source: 'comp' });
  }

  // dedupe near-identical (same day + within $1)
  out.sort((a, b) => a.t - b.t);
  const deduped = [];
  for (const p of out) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.date === p.date && Math.abs(prev.price - p.price) < 1) continue;
    deduped.push(p);
  }
  return deduped;
}

/** Oracle observations over time for a grader+grade (the oracle line). */
export function oracleHistory(card, grader, grade) {
  if (!card?.history) return [];
  const g = norm(grader);
  return card.history
    .filter((h) => norm(h.grader) === g && sameGrade(h.grade, grade) && h.price)
    .map((h) => ({ t: toTime(h.observed_at), price: h.price, source: h.source }))
    .filter((h) => h.t != null)
    .sort((a, b) => a.t - b.t);
}

/**
 * TWAP-smoothed oracle trendline — backfilled from sold comps.
 *
 * Computes a rolling time-weighted average price over `windowDays` using
 * the actual sold comps (priceSeries) as input — NOT the sparse oracle
 * observations. Each comp sale "holds" its price until the next sale;
 * the TWAP at any moment is area-under-the-step-curve / window.
 *
 * This produces a smooth, continuous line that:
 *   1. Spans the full comp history (backfilled, not just recent)
 *   2. Drifts gradually into new prices (anti-front-running)
 *   3. Dampens single-comp spikes (outlier resistance)
 *
 * Returns dense [{t, price, source:'twap'}] sampled every `stepHours`.
 */
export function smoothOracleHistory(card, grader, grade, { windowDays = 30, stepHours = 12 } = {}) {
  const comps = priceSeries(card, grader, grade);
  if (!comps.length) return [];
  if (comps.length === 1) return [{ t: comps[0].t, price: comps[0].price, source: 'twap' }];

  const WINDOW_MS = windowDays * 86400_000;
  const STEP_MS = stepHours * 3600_000;

  // TWAP at time t: time-weighted average of comp prices in [t - window, t].
  // Each comp "holds" its price until the next comp sale arrives.
  function twapAt(t) {
    const wStart = t - WINDOW_MS;
    // price active at the start of the window (last comp at or before wStart)
    let anchor = comps[0].price;
    for (const c of comps) {
      if (c.t <= wStart) anchor = c.price;
      else break;
    }

    let prevT = wStart;
    let prevP = anchor;
    let wSum = 0;
    let wLen = 0;

    for (const c of comps) {
      if (c.t <= wStart) continue;
      if (c.t >= t) break;
      const dt = c.t - prevT;
      wSum += prevP * dt;
      wLen += dt;
      prevT = c.t;
      prevP = c.price;
    }
    // tail segment to t
    const dt = t - prevT;
    wSum += prevP * dt;
    wLen += dt;
    return wLen > 0 ? wSum / wLen : prevP;
  }

  // Start the line at the very first comp so it spans the full comp history
  // (no leading gap). Early points just have a shorter effective window,
  // anchored to the first comp's price — which is exactly what we want.
  const genStart = comps[0].t;
  const out = [];
  const end = Date.now();
  for (let t = genStart; t <= end; t += STEP_MS) {
    out.push({ t, price: twapAt(t), source: 'twap' });
  }
  if (!out.length || out[out.length - 1].t < end) {
    out.push({ t: end, price: twapAt(end), source: 'twap' });
  }
  return out;
}

/** Per-grade trend (oldAvg → newAvg over dateRange) for a grader+grade. */
export function trendForGrade(card, grader, grade) {
  if (!card?.trendGrades) return null;
  const g = norm(grader);
  return (
    card.trendGrades.find((t) => norm(t.grader) === g && sameGrade(t.grade, grade)) || null
  );
}

/** Population at a grade for a grader (exact-grade pop + total graded). */
export function popForGrade(card, grader, grade) {
  if (!card?.pop) return null;
  const g = norm(grader);
  const rec = card.pop.find((p) => norm(p.grader) === g);
  if (!rec) return null;
  // grade_array is indexed grades[i] = grade (i+1): grade 10 → index 9, grade 11
  // (BL/black-label) → index 10. So the exact-grade index is grade - 1.
  const gi = Math.round(Number(grade)) - 1;
  const exact = Array.isArray(rec.grades) ? (rec.grades[gi] ?? null) : null;
  return { exact, total: rec.totalGraded, grades: rec.grades, meta: rec.popMeta };
}

/**
 * Evidence-ladder rows: one row per grade band that has an oracle, richest first.
 * Each row: { grade, oracle, tier, source, saleCount, pop, trendPct, listings }
 */
export function ladderRows(card, grader) {
  if (!card?.oracles) return [];
  const g = norm(grader);
  const byGrade = new Map();
  for (const o of card.oracles) {
    if (norm(o.grader) !== g) continue;
    const key = Number(o.grade);
    // keep the best (lowest tier number = strongest) per grade
    const existing = byGrade.get(key);
    if (!existing || o.tier < existing.tier) byGrade.set(key, o);
  }
  const rows = [...byGrade.values()].map((o) => {
    const pop = popForGrade(card, grader, o.grade);
    const tr = trendForGrade(card, grader, o.grade);
    const listings = (card.bands || []).find((b) => sameGrade(b.grade_band, o.grade))?.listings || [];
    return {
      grade: o.grade,
      oracle: o.price,
      tier: o.tier,
      source: o.source,
      saleCount: o.saleCount,
      graderMatched: o.graderMatched,
      pop: pop?.exact ?? null,
      popTotal: pop?.total ?? null,
      trendPct: tr?.pct ?? null,
      trendDays: tr?.days ?? null,
      listings,
    };
  });
  rows.sort((a, b) => b.grade - a.grade);
  return rows;
}

/** Distance from current oracle to strike, as signed %. Positive => above strike (YES). */
export function distanceToStrike(oraclePrice, strikeUsdCents) {
  if (!oraclePrice || !strikeUsdCents) return null;
  const strike = strikeUsdCents / 100;
  return ((oraclePrice - strike) / strike) * 100;
}
