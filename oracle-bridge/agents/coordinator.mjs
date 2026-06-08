/// coordinator.mjs — Tier 2 aggregation agent.
///
/// Reads all source agent signals from shared MemWal context, applies:
///   1. Source-count gate (≥3)
///   2. MAD outlier rejection (modified Z-score, threshold 3.5)
///   3. Confidence-weighted median (Pyth pattern)
///   4. Aggregator-level circuit breakers
///   5. Evidence bundle generation
///
/// Writes consensus to shared context. Produces evidence for Walrus upload.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const MEMWAL_ROOT = join(new URL('.', import.meta.url).pathname, '..', 'memwal');
const SHARED = join(MEMWAL_ROOT, 'shared');

const MIN_SOURCES = 3;
const MAD_THRESHOLD = 3.5;
const DISAGREEMENT_THRESHOLD = 0.4; // 40% interval width triggers circuit breaker

function readShared(file) {
  const p = join(SHARED, file);
  if (!existsSync(p)) return null;
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
}

function writeShared(file, data) {
  const dir = join(SHARED, ...file.split('/').slice(0, -1));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(SHARED, file), JSON.stringify(data, null, 2));
}

// ── Statistical functions ────────────────────────────────────────────

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mad(arr) {
  const med = median(arr);
  const deviations = arr.map((x) => Math.abs(x - med));
  return median(deviations);
}

function modifiedZScore(value, med, madVal) {
  if (madVal === 0) return 0;
  return 0.6745 * (value - med) / madVal;
}

function weightedMedian(values, weights) {
  if (values.length === 0) return 0;
  const pairs = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
  const totalWeight = pairs.reduce((s, p) => s + p.w, 0);
  let cumWeight = 0;
  for (const p of pairs) {
    cumWeight += p.w;
    if (cumWeight >= totalWeight / 2) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

function weightedPercentile(values, weights, pct) {
  if (values.length === 0) return 0;
  const pairs = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
  const totalWeight = pairs.reduce((s, p) => s + p.w, 0);
  const target = totalWeight * pct;
  let cumWeight = 0;
  for (const p of pairs) {
    cumWeight += p.w;
    if (cumWeight >= target) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

// ── Reputation system ────────────────────────────────────────────────

function loadReputation() {
  return readShared('reputation/weights.json') || {};
}

function saveReputation(weights) {
  writeShared('reputation/weights.json', weights);
}

function updateReputation(weights, platform, agreedWithConsensus, deviation) {
  const current = weights[platform] || { reliability: 1.0, rounds: 0, hits: 0, misses: 0 };
  current.rounds++;
  if (agreedWithConsensus) {
    current.hits++;
  } else {
    current.misses++;
  }
  // Exponential moving average: recent performance matters more
  const hitRate = current.rounds > 0 ? current.hits / current.rounds : 0.5;
  current.reliability = 0.7 * hitRate + 0.3 * current.reliability;
  current.lastDeviation = deviation;
  current.lastUpdated = new Date().toISOString();
  weights[platform] = current;
}

// ── Main aggregation ─────────────────────────────────────────────────

export function aggregate(cardId, allSignals, reputationWeights) {
  const result = {
    cardId,
    consensusPriceCents: null,
    confidenceLower: null,
    confidenceUpper: null,
    contributingSources: [],
    rejectedSources: [],
    flags: [],
    sourceCount: 0,
    roundId: `${cardId}_${Date.now()}`,
    timestamp: new Date().toISOString(),
  };

  // Collect all valid signals for this card
  const signals = [];
  for (const [platform, data] of Object.entries(allSignals)) {
    if (!data?.signals) continue;
    const cardSignal = data.signals.find((s) => s.cardId === cardId);
    if (cardSignal && !cardSignal.rejected && cardSignal.priceCents > 0) {
      signals.push({ ...cardSignal, platform });
    }
  }

  // Step 1: Source-count gate
  if (signals.length < MIN_SOURCES) {
    result.flags.push('insufficient_sources');
    result.sourceCount = signals.length;
    // Still compute if we have any signals, just flag it
    if (signals.length === 0) return result;
  }
  result.sourceCount = signals.length;

  // Step 2: MAD outlier rejection
  const prices = signals.map((s) => s.priceCents);
  const priceMedian = median(prices);
  const priceMad = mad(prices);

  const surviving = [];
  for (const s of signals) {
    const z = modifiedZScore(s.priceCents, priceMedian, priceMad);
    if (Math.abs(z) > MAD_THRESHOLD) {
      result.rejectedSources.push({
        platform: s.platform,
        priceCents: s.priceCents,
        reason: `MAD outlier (z=${z.toFixed(2)})`,
        zScore: z,
      });
    } else {
      surviving.push(s);
    }
  }

  if (surviving.length === 0) {
    result.flags.push('all_outliers');
    return result;
  }

  // Step 3: Confidence-weighted median
  const rep = reputationWeights || {};
  const recencyHalfLife = 7 * 24 * 3600 * 1000; // 1 week

  const values = [];
  const weights = [];
  for (const s of surviving) {
    const reliability = rep[s.platform]?.reliability || 1.0;
    const ageMs = s.observedAt ? Date.now() - new Date(s.observedAt).getTime() : 0;
    const recency = Math.exp(-ageMs / recencyHalfLife);
    const weight = (s.confidence || 0.5) * reliability * recency;
    values.push(s.priceCents);
    weights.push(weight);

    result.contributingSources.push({
      platform: s.platform,
      priceCents: s.priceCents,
      confidence: s.confidence,
      reliability,
      weight,
      source: s.source,
      compCount: s.compCount || 0,
    });
  }

  result.consensusPriceCents = Math.round(weightedMedian(values, weights));
  result.confidenceLower = Math.round(weightedPercentile(values, weights, 0.25));
  result.confidenceUpper = Math.round(weightedPercentile(values, weights, 0.75));

  // Step 4: Aggregator circuit breakers
  const intervalWidth = result.confidenceUpper - result.confidenceLower;
  if (result.consensusPriceCents > 0 && intervalWidth / result.consensusPriceCents > DISAGREEMENT_THRESHOLD) {
    result.flags.push('wide_disagreement');
  }

  return result;
}

// ── Coordinator run ──────────────────────────────────────────────────

export async function runCoordinator(cardIds) {
  const allSignals = readShared('agent-signals/latest.json') || {};
  const reputationWeights = loadReputation();

  const consensus = {};
  const evidence = [];

  for (const cardId of cardIds) {
    const result = aggregate(cardId, allSignals, reputationWeights);
    consensus[cardId] = result;

    // Update reputation for each contributing source
    if (result.consensusPriceCents) {
      for (const src of result.contributingSources) {
        const deviation = Math.abs(src.priceCents - result.consensusPriceCents) / result.consensusPriceCents;
        const agreed = deviation < 0.15; // within 15% = agreement
        updateReputation(reputationWeights, src.platform, agreed, deviation);
      }
      for (const rej of result.rejectedSources) {
        updateReputation(reputationWeights, rej.platform, false, 1.0);
      }
    }

    evidence.push(result);
  }

  // Write consensus
  writeShared('consensus/latest.json', consensus);

  // Write historical snapshot
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  writeShared(`consensus/history/${ts}.json`, consensus);

  // Write reputation
  saveReputation(reputationWeights);

  // Build evidence bundle (for Walrus upload)
  const bundle = {
    version: '1.0.0',
    swarmId: 'slabclaw-oracle-swarm',
    timestamp: new Date().toISOString(),
    cardIds,
    consensus,
    agentSignals: allSignals,
    reputationWeights,
    aggregationMethod: 'confidence_weighted_median',
    outlierMethod: 'MAD_modified_z_score',
    madThreshold: MAD_THRESHOLD,
    minSources: MIN_SOURCES,
  };
  writeShared('evidence/latest-bundle.json', bundle);
  writeShared(`evidence/history/${ts}.json`, bundle);

  return { consensus, evidence: bundle, reputation: reputationWeights };
}
