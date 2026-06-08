/// attack.test.mjs — Adversarial test suite for the oracle swarm defenses.
///
/// Constructs hostile signal sets and asserts the manipulation defenses in
/// coordinator.aggregate() and BaseAgent.applyCircuitBreakers() hold.
///
/// Run: node --test test/attack.test.mjs
///
/// Determinism note: any time-sensitive value (observedAt) is constructed as a
/// FIXED offset relative to a single NOW captured once at module load, and
/// passed INTO the code under test. We never read the wall clock inside an
/// assertion, so age-based math is stable run-to-run.

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { aggregate } from '../agents/coordinator.mjs';
import { BaseAgent } from '../agents/base-agent.mjs';

// Single reference instant for the whole file. observedAt offsets are computed
// from this so a signal we call "fresh" stays fresh across the run.
const NOW = Date.now();
const DAY_MS = 86400000;
const isoAgo = (ms) => new Date(NOW - ms).toISOString();
const FRESH = isoAgo(60 * 1000); // 1 minute old — effectively "now"

const CARD = 'BASE_CHARIZARD_PSA10';

// Build the allSignals shape coordinator.aggregate expects:
//   { platform: { signals: [ { cardId, priceCents, ... } ] } }
function makeSignals(entries) {
  const out = {};
  for (const e of entries) {
    out[e.platform] = {
      timestamp: FRESH,
      signals: [
        {
          cardId: CARD,
          priceCents: e.priceCents,
          confidence: e.confidence ?? 0.7,
          source: e.source ?? `${e.platform}_sold`,
          compCount: e.compCount ?? 5,
          observedAt: e.observedAt ?? FRESH,
          flags: [],
        },
      ],
    };
  }
  return out;
}

// applyCircuitBreakers is a pure method (no I/O). We invoke it via the
// prototype on a bare object so we never run BaseAgent's constructor — which
// would mkdir scratch dirs under memwal/. Keeps the test side-effect-free.
function testAgent() {
  return { applyCircuitBreakers: BaseAgent.prototype.applyCircuitBreakers };
}

// ─────────────────────────────────────────────────────────────────────────
// 1. Wash-trade single outlier — MAD rejection
// ─────────────────────────────────────────────────────────────────────────
test('wash-trade single outlier is MAD-rejected and consensus stays near $15k', () => {
  const signals = makeSignals([
    { platform: 'ebay', priceCents: 1500000 },
    { platform: 'alt', priceCents: 1510000 },
    { platform: 'courtyard', priceCents: 1490000 },
    { platform: 'pwcc', priceCents: 1505000 },
    { platform: 'washtrader', priceCents: 4500000 }, // $45k wash spike
  ]);

  const result = aggregate(CARD, signals, {});

  // The $45k source must be rejected as a MAD outlier.
  const rejected = result.rejectedSources.find((r) => r.platform === 'washtrader');
  assert.ok(rejected, 'wash trader should appear in rejectedSources');
  assert.equal(rejected.priceCents, 4500000);
  assert.ok(/MAD outlier/.test(rejected.reason), 'reason should cite MAD');

  // The wash trader must NOT contribute to consensus.
  assert.ok(
    !result.contributingSources.some((s) => s.platform === 'washtrader'),
    'wash trader must not be a contributing source',
  );

  // Consensus stays anchored near $15k (within 5%), not dragged toward $45k.
  assert.ok(result.consensusPriceCents > 1400000, `consensus ${result.consensusPriceCents} too low`);
  assert.ok(result.consensusPriceCents < 1600000, `consensus ${result.consensusPriceCents} pulled toward wash spike`);
});

// ─────────────────────────────────────────────────────────────────────────
// 2. Single-source spoof — insufficient_sources
// ─────────────────────────────────────────────────────────────────────────
test('single source is flagged insufficient_sources with sourceCount < 3', () => {
  const signals = makeSignals([{ platform: 'spoofer', priceCents: 1500000 }]);
  const result = aggregate(CARD, signals, {});

  assert.ok(result.flags.includes('insufficient_sources'), 'should flag insufficient_sources');
  assert.ok(result.sourceCount < 3, `sourceCount ${result.sourceCount} should be < 3`);
  assert.equal(result.sourceCount, 1);
});

// ─────────────────────────────────────────────────────────────────────────
// 3. Thin market — two sources still flagged
// ─────────────────────────────────────────────────────────────────────────
test('two sources (thin market) still flagged insufficient_sources', () => {
  const signals = makeSignals([
    { platform: 'ebay', priceCents: 1500000 },
    { platform: 'alt', priceCents: 1510000 },
  ]);
  const result = aggregate(CARD, signals, {});

  assert.ok(result.flags.includes('insufficient_sources'), 'two sources should flag insufficient_sources');
  assert.ok(result.sourceCount < 3, `sourceCount ${result.sourceCount} should be < 3`);
  assert.equal(result.sourceCount, 2);
});

// ─────────────────────────────────────────────────────────────────────────
// 4. Seller concentration — circuit breaker caps confidence <= 0.4
// ─────────────────────────────────────────────────────────────────────────
test('seller concentration (>60% one seller) flags seller_concentration and caps confidence <= 0.4', () => {
  const agent = testAgent();
  const signal = {
    cardId: CARD,
    priceCents: 1500000,
    confidence: 0.9,
    source: 'ebay_sold',
    compCount: 5,
    observedAt: FRESH,
    comps: [
      { price: 15000, seller: 'wash_whale' },
      { price: 15100, seller: 'wash_whale' },
      { price: 14900, seller: 'wash_whale' },
      { price: 15050, seller: 'wash_whale' }, // 4/5 = 80% one seller
      { price: 15020, seller: 'honest_seller' },
    ],
    flags: [],
  };
  const cardMemory = { cardId: CARD, observations: [], anomalies: [] };

  const { signal: out, flags } = agent.applyCircuitBreakers(signal, cardMemory);

  assert.ok(flags.includes('seller_concentration'), 'should flag seller_concentration');
  assert.ok(out.confidence <= 0.4, `confidence ${out.confidence} should be capped <= 0.4`);
});

// ─────────────────────────────────────────────────────────────────────────
// 5. Price-jump guard — >5x prior observation, confidence <= 0.3
// ─────────────────────────────────────────────────────────────────────────
test('price jump (>5x last observation) flags price_jump and caps confidence <= 0.3', () => {
  const agent = testAgent();
  const signal = {
    cardId: CARD,
    priceCents: 9000000, // $90k
    confidence: 0.9,
    source: 'ebay_sold',
    compCount: 5,
    observedAt: FRESH,
    comps: [],
    flags: [],
  };
  // Last known observation was $15k — new signal is 6x that.
  const cardMemory = {
    cardId: CARD,
    observations: [{ priceCents: 1500000, confidence: 0.8 }],
    anomalies: [],
  };

  const { signal: out, flags } = agent.applyCircuitBreakers(signal, cardMemory);

  assert.ok(flags.includes('price_jump'), 'should flag price_jump');
  assert.ok(out.confidence <= 0.3, `confidence ${out.confidence} should be capped <= 0.3`);
});

// ─────────────────────────────────────────────────────────────────────────
// 6. Stale feed — observedAt 30 days ago, confidence <= 0.2
// ─────────────────────────────────────────────────────────────────────────
test('stale feed (30 days old) flags stale_feed and caps confidence <= 0.2', () => {
  const agent = testAgent();
  const signal = {
    cardId: CARD,
    priceCents: 1500000,
    confidence: 0.9,
    source: 'ebay_sold',
    compCount: 5,
    observedAt: isoAgo(30 * DAY_MS), // 30 days > 14-day threshold
    comps: [],
    flags: [],
  };
  const cardMemory = { cardId: CARD, observations: [], anomalies: [] };

  const { signal: out, flags } = agent.applyCircuitBreakers(signal, cardMemory);

  assert.ok(flags.includes('stale_feed'), 'should flag stale_feed');
  assert.ok(out.confidence <= 0.2, `confidence ${out.confidence} should be capped <= 0.2`);
});

// ─────────────────────────────────────────────────────────────────────────
// 7. Wide disagreement — 25-75 band exceeds 40% of consensus
// ─────────────────────────────────────────────────────────────────────────
test('wide disagreement (IQR band > 40% of consensus) raises wide_disagreement flag', () => {
  // Spread sources widely but keep them within MAD tolerance so none get
  // rejected — the point is a wide *surviving* band, not outliers.
  // Prices: 1.0M, 1.2M, 1.5M, 1.85M, 2.1M cents. Equal confidence/reliability.
  // With 5 equal weights the weighted 25th pct lands on p1 (1.2M) and the 75th
  // on p3 (1.85M); band/median = 0.65M/1.5M = 0.43 > 0.40.
  const signals = makeSignals([
    { platform: 'ebay', priceCents: 1000000, confidence: 0.7 },
    { platform: 'alt', priceCents: 1200000, confidence: 0.7 },
    { platform: 'courtyard', priceCents: 1500000, confidence: 0.7 },
    { platform: 'pwcc', priceCents: 1850000, confidence: 0.7 },
    { platform: 'goldin', priceCents: 2100000, confidence: 0.7 },
  ]);

  const result = aggregate(CARD, signals, {});

  // Sanity: we want a real consensus computed (not short-circuited).
  assert.ok(result.consensusPriceCents > 0, 'consensus should be computed');
  const bandWidth = result.confidenceUpper - result.confidenceLower;
  const bandFraction = bandWidth / result.consensusPriceCents;
  assert.ok(bandFraction > 0.4, `band fraction ${bandFraction} should exceed 0.4 for this spread`);
  assert.ok(result.flags.includes('wide_disagreement'), 'should flag wide_disagreement (bridge treats as BLOCK)');
});

// ─────────────────────────────────────────────────────────────────────────
// 8. Coordinated MAD injection — honest majority still wins
// ─────────────────────────────────────────────────────────────────────────
test('multiple coordinated outliers vs honest majority — majority wins', () => {
  // 5 honest near $15k, 2 coordinated attackers near $48k.
  // Median sits in the honest cluster, so both attackers are MAD-rejected.
  const signals = makeSignals([
    { platform: 'ebay', priceCents: 1500000 },
    { platform: 'alt', priceCents: 1505000 },
    { platform: 'courtyard', priceCents: 1495000 },
    { platform: 'pwcc', priceCents: 1510000 },
    { platform: 'goldin', priceCents: 1490000 },
    { platform: 'attacker_a', priceCents: 4800000 },
    { platform: 'attacker_b', priceCents: 4810000 },
  ]);

  const result = aggregate(CARD, signals, {});

  const rejectedPlatforms = result.rejectedSources.map((r) => r.platform);
  assert.ok(rejectedPlatforms.includes('attacker_a'), 'attacker_a should be rejected');
  assert.ok(rejectedPlatforms.includes('attacker_b'), 'attacker_b should be rejected');

  // Honest majority drives consensus — within 5% of $15k.
  assert.ok(result.consensusPriceCents > 1425000, `consensus ${result.consensusPriceCents} too low`);
  assert.ok(result.consensusPriceCents < 1575000, `consensus ${result.consensusPriceCents} dragged up by attackers`);
});

// ─────────────────────────────────────────────────────────────────────────
// 9. Sybil sources — reputation/confidence weighting limits their pull
// ─────────────────────────────────────────────────────────────────────────
test('sybil low-reliability sources are out-weighted by a single high-reliability honest source', () => {
  // 3 identical sybil sources at $30k with LOW reliability + low confidence.
  // 2 honest sources at ~$15k with HIGH reliability + high confidence.
  // The sybils are the NUMERIC majority, so a plain (unweighted) median would
  // be captured. The defense under test is confidence × reliability weighting:
  // it must out-weigh the numerous-but-untrusted sybils.
  const signals = makeSignals([
    { platform: 'sybil_a', priceCents: 3000000, confidence: 0.2 },
    { platform: 'sybil_b', priceCents: 3000000, confidence: 0.2 },
    { platform: 'sybil_c', priceCents: 3000000, confidence: 0.2 },
    { platform: 'ebay', priceCents: 1500000, confidence: 0.95 },
    { platform: 'alt', priceCents: 1510000, confidence: 0.95 },
  ]);

  // Reputation: sybils are unknown/low reliability, honest sources proven.
  const reputation = {
    sybil_a: { reliability: 0.1 },
    sybil_b: { reliability: 0.1 },
    sybil_c: { reliability: 0.1 },
    ebay: { reliability: 1.0 },
    alt: { reliability: 1.0 },
  };

  const result = aggregate(CARD, signals, reputation);

  // Confirm weighting actually favors the honest sources: total honest weight
  // should exceed total sybil weight despite the sybils being more numerous.
  const wOf = (p) => result.contributingSources.find((s) => s.platform === p)?.weight ?? 0;
  const honestWeight = wOf('ebay') + wOf('alt');
  const sybilWeight = wOf('sybil_a') + wOf('sybil_b') + wOf('sybil_c');
  assert.ok(
    honestWeight > sybilWeight,
    `honest weight ${honestWeight} should exceed sybil weight ${sybilWeight}`,
  );

  // DEFENSE HOLDS: because honest aggregate weight exceeds sybil weight, the
  // weighted median's cumulative-weight crossing lands inside the honest
  // cluster (~$15k) rather than the sybil cluster ($30k) — even though the
  // sybils are MORE NUMEROUS (3 vs 2). Confidence × reliability weighting beats
  // a naive count majority. Consensus stays near $15k.
  assert.ok(result.consensusPriceCents > 0, 'consensus computed');
  assert.ok(
    result.consensusPriceCents < 1600000,
    `consensus ${result.consensusPriceCents} should stay near $15k, not be captured by sybils`,
  );
});
