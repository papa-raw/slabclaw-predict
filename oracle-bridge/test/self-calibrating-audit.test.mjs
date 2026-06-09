/// self-calibrating-audit.test.mjs — proves the methodology fixes AND the self-update
/// (a swarm that corrects its own method from memory: smarter every run).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessCardCalibrated } from '../self-calibrating-audit.mjs';
import { defaultCalibration, updateCalibration } from '../calibration.mjs';

const NOW = 1_749_513_600_000; // fixed for deterministic temporal gating
const DAY = 86_400_000;
const real = (grader, grade, priceUsd, saleCount = 5, ageDays = 2) =>
  ({ kind: 'realized', grader, grade, priceUsd, saleCount, observedAtMs: NOW - ageDays * DAY });
const ask = (grader, grade, priceUsd) => ({ kind: 'ask', grader, grade, priceUsd });

test('anchor reconciliation: a 2× settle-vs-oracle gap flags same_grade_disagreement', () => {
  const r = assessCardCalibrated({ points: [], settleUsd: 4161, oraclePsa10Usd: 7987, calibration: defaultCalibration('dr') });
  assert.ok(r.flags.some((f) => f.code === 'same_grade_disagreement' && f.severity === 'high'));
  assert.equal(r.wideDispute, true);
});

test('temporal gate: a PSA 9 comp 25 days older than PSA 10 is NOT compared', () => {
  const pts = [real('PSA', 10, 8000, 5, 2), real('PSA', 9, 700, 5, 27)]; // 25d apart > 14d window
  const r = assessCardCalibrated({ points: pts, calibration: defaultCalibration('x') });
  assert.ok(!r.flags.some((f) => f.code.startsWith('ratio')), 'stale comp not ratio-compared');
});

test('liquidity gate: a 1-sale PSA 9 is not compared (thin = noise)', () => {
  const pts = [real('PSA', 10, 8000, 5, 2), real('PSA', 9, 700, 1, 2)]; // saleCount 1 < 3
  const r = assessCardCalibrated({ points: pts, calibration: defaultCalibration('x') });
  assert.ok(!r.flags.some((f) => f.code.startsWith('ratio')));
});

test('asks vs realized: a BGS 9.5 ASK above anchor is med ask_above_anchor, not a high inversion', () => {
  const r = assessCardCalibrated({ points: [ask('BGS', 9.5, 10799)], oraclePsa10Usd: 7987, calibration: defaultCalibration('x') });
  const f = r.flags.find((x) => x.code === 'ask_above_anchor');
  assert.ok(f && f.severity === 'med');
  assert.ok(!r.flags.some((x) => x.severity === 'high'), 'an ask alone does not widen the dispute');
});

test('grade-10 cross-grader is skipped (PSA-10 premium breaks the flat multiplier)', () => {
  const pts = [real('PSA', 10, 8000, 5, 2), real('CGC', 10, 1750, 5, 2)]; // CGC10 0.22× — v0 false-flagged this
  const r = assessCardCalibrated({ points: pts, calibration: defaultCalibration('x') });
  assert.ok(!r.flags.some((f) => f.message.includes('CGC10')));
});

test('SELF-UPDATE: stable extreme ratio false-flags cold → learns → stops; a real change re-fires', () => {
  const mk = (p9) => [real('PSA', 10, 8000), real('PSA', 9, p9)];
  let cal = defaultCalibration('dr');

  // Round 1 — cold. PSA 9/10 = 0.0875 → below the global [0.25,0.48] band → unlearned flag.
  const r1 = assessCardCalibrated({ points: mk(700), calibration: cal });
  assert.ok(r1.flags.some((f) => f.code === 'ratio_unlearned'), 'cold start flags vs the global band');
  cal = updateCalibration(cal, r1.learned); // n=1

  // Round 2 — still cold (n<2): flags again, then warms.
  const r2 = assessCardCalibrated({ points: mk(700), calibration: cal });
  cal = updateCalibration(cal, r2.learned); // n=2 → warm

  // Round 3 — warm, same 0.0875 → learned baseline matches → NO false flag (self-corrected).
  const r3 = assessCardCalibrated({ points: mk(700), calibration: cal });
  assert.ok(!r3.flags.some((f) => ['ratio_unlearned', 'ratio_shift'].includes(f.code)),
    'once learned, the stable scarce ratio no longer false-flags');

  // Round 4 — ratio JUMPS to 0.30 (2,400/8,000): a real move from the learned norm → re-fires.
  const r4 = assessCardCalibrated({ points: mk(2400), calibration: cal });
  assert.ok(r4.flags.some((f) => f.code === 'ratio_shift'), 'a real change from the card’s own norm re-fires');
});
