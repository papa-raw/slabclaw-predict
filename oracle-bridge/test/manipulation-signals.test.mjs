/// manipulation-signals.test.mjs — grade-inversion + multiplier-divergence detectors,
/// validated against the real four-card data captured this project.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  gradeInversions, multiplierDivergence, intraGradeSpread, assessCard, EUR_USD,
} from '../manipulation-signals.mjs';

const oracle = (grader, grade, price) => ({ kind: 'oracle', grader, grade, price, currency: 'USD' });
const listing = (grader, grade, priceEur) => ({ kind: 'listing', grader, grade, price: priceEur, currency: 'EUR' });

test('grade inversion: a BGS 9.5 listing above the settled PSA 10 (real Dark Raichu)', () => {
  // BGS 9.5 €9,999 → ~$10,799 ; PSA 10 settle $7,987
  const points = [listing('BGS', 9.5, 9999), listing('BGS', 9.5, 5999)];
  const flags = gradeInversions(points, 7987);
  const inv = flags.filter((f) => f.code === 'listing_above_settle');
  assert.equal(inv.length, 1, 'only the €9,999 (>$7,987) listing inverts, not the €5,999');
  assert.equal(inv[0].severity, 'high');
  assert.ok(9999 * EUR_USD >= 7987);
});

test('grade inversion: oracle ladder where a lower grade ≥ a higher grade', () => {
  const points = [oracle('PSA', 10, 1000), oracle('PSA', 9, 1100)]; // PSA 9 over PSA 10
  const flags = gradeInversions(points, 1000);
  assert.ok(flags.some((f) => f.code === 'oracle_ladder_inversion' && f.severity === 'high'));
});

test('no inversion when the ladder is monotonic', () => {
  const points = [oracle('PSA', 10, 8000), oracle('PSA', 9, 700), oracle('PSA', 8, 380)];
  assert.equal(gradeInversions(points, 8000).length, 0);
});

test('multiplier divergence: Dark Raichu PSA 9/10 = 0.09 flags HIGH', () => {
  const points = [oracle('PSA', 10, 7987), oracle('PSA', 9, 688)];
  const f = multiplierDivergence(points).filter((x) => x.code === 'multiplier_divergence');
  assert.equal(f.length, 1);
  assert.equal(f[0].severity, 'high');
  assert.ok(f[0].ratio < 0.15);
});

test('multiplier divergence: Umbreon PSA 9/10 = 0.33 is NORMAL (no flag)', () => {
  const points = [oracle('PSA', 10, 15879), oracle('PSA', 9, 5214)];
  const f = multiplierDivergence(points).filter((x) => x.code === 'multiplier_divergence');
  assert.equal(f.length, 0);
});

test('cross-grader divergence: a CGC 9 priced ABOVE the PSA 9 (expected ~0.75×) flags', () => {
  const points = [oracle('PSA', 9, 1000), oracle('CGC', 9, 1400)]; // CGC at 1.4× vs expected 0.75×
  const f = multiplierDivergence(points).filter((x) => x.code === 'grader_multiplier_divergence');
  assert.equal(f.length, 1);
});

test('intra-grade spread: same PSA 9 asks €850 vs €3,460 (4×) flags', () => {
  const points = [listing('PSA', 9, 850), listing('PSA', 9, 3460)];
  const f = intraGradeSpread(points);
  assert.equal(f.length, 1);
  assert.equal(f[0].code, 'intra_grade_spread');
});

test('assessCard: Dark Raichu full picture → flags, reduced confidence, dispute widened', () => {
  const points = [
    oracle('PSA', 10, 7987), oracle('PSA', 9, 688), oracle('PSA', 8, 378),
    listing('PSA', 9, 850), listing('PSA', 9, 3460),
    listing('BGS', 9.5, 9999), listing('BGS', 9.5, 5999),
    listing('PSA', 8.5, 850), listing('PSA', 5, 179),
  ];
  const r = assessCard({ points, settledPriceUsd: 7987 });
  assert.ok(r.flags.length >= 3, 'inversion + divergence + spread');
  assert.ok(r.flags.some((f) => f.code === 'listing_above_settle'));
  assert.ok(r.flags.some((f) => f.code === 'multiplier_divergence'));
  assert.ok(r.flags.some((f) => f.code === 'intra_grade_spread'));
  assert.equal(r.wideDispute, true);
  assert.ok(r.confidence < 1.0 && r.confidence >= 0.4);
});

test('assessCard: a clean, consistent ladder → no flags, full confidence', () => {
  const points = [oracle('PSA', 10, 16000), oracle('PSA', 9, 5200), oracle('PSA', 8, 3900)];
  const r = assessCard({ points, settledPriceUsd: 16000 });
  assert.equal(r.flags.length, 0);
  assert.equal(r.confidence, 1.0);
  assert.equal(r.wideDispute, false);
});
