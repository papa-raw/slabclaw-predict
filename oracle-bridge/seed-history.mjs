#!/usr/bin/env node
/// seed-history.mjs — Generate realistic MemWal history for demo.
///
/// Creates 10 rounds of agent observations + coordinator consensus with:
///   - Confidence intervals that narrow over rounds (learning visible)
///   - Source reliability that diverges (some agents more accurate)
///   - One manipulation event at round 5 (wash trade on alt → caught by MAD)
///   - Anomaly memory that persists and pre-filters in subsequent rounds
///
/// Usage:
///   node seed-history.mjs            # seed 10 rounds
///   node seed-history.mjs --clean    # wipe memwal/ first
///   node seed-history.mjs --rounds N # custom round count

import { mkdirSync, writeFileSync, rmSync, existsSync } from 'fs';
import { join } from 'path';

const MEMWAL = join(new URL('.', import.meta.url).pathname, 'memwal');
const args = process.argv.slice(2);
const CLEAN = args.includes('--clean');
const ROUNDS = parseInt(args.find((_, i, a) => a[i - 1] === '--rounds'), 10) || 10;

// Card "true" prices in cents — these are the real-world anchors
const CARDS = {
  'neo1-1st-18': { name: 'Typhlosion', truePriceCents: 350000 },
  'jp-vs-091': { name: "Karen's Umbreon", truePriceCents: 1200000 },
  'base5-1st-83': { name: 'Dark Raichu', truePriceCents: 520000 },
  'base2-1st-3': { name: 'Flareon', truePriceCents: 220000 },
};

const PLATFORMS = [
  { name: 'ebay', baseNoise: 0.05, coverage: 0.95, initReliability: 1.0 },
  { name: 'courtyard', baseNoise: 0.08, coverage: 0.80, initReliability: 1.0 },
  { name: 'tcgplayer', baseNoise: 0.06, coverage: 0.70, initReliability: 1.0 },
  { name: 'alt', baseNoise: 0.10, coverage: 0.65, initReliability: 1.0 },
  { name: 'cardmarket', baseNoise: 0.12, coverage: 0.50, initReliability: 1.0 },
  { name: 'beezie', baseNoise: 0.15, coverage: 0.35, initReliability: 1.0 },
  { name: 'collector-crypt', baseNoise: 0.14, coverage: 0.30, initReliability: 1.0 },
  { name: 'goldin', baseNoise: 0.07, coverage: 0.40, initReliability: 1.0 },
];

// Seeded pseudo-random (deterministic for reproducible demo)
let _seed = 42;
function rand() {
  _seed = (_seed * 16807 + 0) % 2147483647;
  return _seed / 2147483647;
}
function gaussian() {
  const u1 = rand(), u2 = rand();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function mad(arr) {
  const med = median(arr);
  return median(arr.map((x) => Math.abs(x - med)));
}

function write(path, data) {
  const dir = path.split('/').slice(0, -1).join('/');
  mkdirSync(dir, { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2));
}

function roundTs(round) {
  // Space rounds 6 hours apart, starting 3 days ago
  const base = Date.now() - 3 * 86400000;
  return new Date(base + round * 6 * 3600000).toISOString();
}

// ── Main ─────────────────────────────────────────────────────────────

if (CLEAN && existsSync(MEMWAL)) {
  rmSync(MEMWAL, { recursive: true });
  console.log('Cleaned memwal/');
}

console.log(`Seeding ${ROUNDS} rounds of oracle swarm history...\n`);

const reputation = {};
for (const p of PLATFORMS) {
  reputation[p.name] = { reliability: p.initReliability, rounds: 0, hits: 0, misses: 0 };
}

const agentMemory = {};
for (const p of PLATFORMS) {
  agentMemory[p.name] = {};
  for (const cardId of Object.keys(CARDS)) {
    agentMemory[p.name][cardId] = { cardId, observations: [], anomalies: [] };
  }
}

for (let round = 0; round < ROUNDS; round++) {
  const ts = roundTs(round);
  const tsSlug = ts.replace(/[:.]/g, '-');
  const allSignals = {};
  const isManipRound = round === 4; // Round 5 (0-indexed 4): manipulation injection

  console.log(`Round ${round + 1}/${ROUNDS}  ${ts}${isManipRound ? '  ← MANIPULATION INJECTION' : ''}`);

  // ── Tier 1: Generate agent signals ─────────────────────────────────
  for (const platform of PLATFORMS) {
    const signals = [];
    for (const [cardId, card] of Object.entries(CARDS)) {
      // Platform may not have data for this card
      if (rand() > platform.coverage) continue;

      // Base price with noise that decreases over rounds (agents get better)
      const noiseFactor = platform.baseNoise * (1 - round * 0.05);
      let price = card.truePriceCents * (1 + gaussian() * noiseFactor);

      // Manipulation: alt-agent reports 4x true price at round 5
      let manipulated = false;
      if (isManipRound && platform.name === 'alt' && cardId === 'base5-1st-83') {
        price = card.truePriceCents * 4.2; // Dark Raichu inflated to ~$21,800
        manipulated = true;
      }

      // Comp count increases over rounds (more data)
      const compCount = Math.max(1, Math.floor(3 + round * 0.8 + rand() * 3));

      // Confidence increases with comps and rounds
      const confidence = Math.min(0.95, (compCount / 8) * (1 + round * 0.03));

      const signal = {
        cardId,
        platform: platform.name,
        priceCents: Math.round(price),
        priceUsd: Math.round(price) / 100,
        confidence: Math.round(confidence * 100) / 100,
        source: `${platform.name}_seeded`,
        compCount,
        observedAt: ts,
        flags: manipulated ? ['seeded_manipulation'] : [],
      };

      signals.push(signal);

      // Update agent card memory
      const mem = agentMemory[platform.name][cardId];
      mem.observations.push({
        date: ts,
        priceCents: signal.priceCents,
        confidence: signal.confidence,
        comps: compCount,
        source: signal.source,
      });
      if (manipulated) {
        mem.anomalies.push({
          date: ts,
          flags: ['price_jump', 'seeded_manipulation'],
          priceCents: signal.priceCents,
          detail: `Manipulated signal: ${signal.priceCents} vs true ~${card.truePriceCents}`,
        });
      }
    }

    allSignals[platform.name] = { timestamp: ts, signals };
  }

  // Write agent signals snapshot
  write(join(MEMWAL, 'shared', 'agent-signals', `history`, `${tsSlug}.json`), allSignals);
  write(join(MEMWAL, 'shared', 'agent-signals', 'latest.json'), allSignals);

  // ── Tier 2: Coordinator aggregation ────────────────────────────────
  const consensus = {};
  for (const cardId of Object.keys(CARDS)) {
    const cardSignals = [];
    for (const [platform, data] of Object.entries(allSignals)) {
      const s = data.signals.find((s) => s.cardId === cardId);
      if (s && s.priceCents > 0) cardSignals.push({ ...s, platform });
    }

    if (cardSignals.length === 0) {
      consensus[cardId] = { cardId, consensusPriceCents: null, flags: ['no_signals'], sourceCount: 0, contributingSources: [], rejectedSources: [] };
      continue;
    }

    // MAD outlier rejection
    const prices = cardSignals.map((s) => s.priceCents);
    const med = median(prices);
    const madVal = mad(prices);
    const surviving = [];
    const rejected = [];
    for (const s of cardSignals) {
      const z = madVal > 0 ? 0.6745 * (s.priceCents - med) / madVal : 0;
      if (Math.abs(z) > 3.5) {
        rejected.push({ platform: s.platform, priceCents: s.priceCents, reason: `MAD outlier (z=${z.toFixed(2)})`, zScore: z });
      } else {
        surviving.push(s);
      }
    }

    // Weighted median
    const values = surviving.map((s) => s.priceCents);
    const weights = surviving.map((s) => (s.confidence || 0.5) * (reputation[s.platform]?.reliability || 1.0));
    const pairs = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
    const totalW = pairs.reduce((s, p) => s + p.w, 0);
    let cumW = 0, consensusPrice = pairs[pairs.length - 1]?.v || 0;
    for (const p of pairs) { cumW += p.w; if (cumW >= totalW / 2) { consensusPrice = p.v; break; } }

    // CI
    cumW = 0;
    let ci25 = pairs[0]?.v || 0;
    for (const p of pairs) { cumW += p.w; if (cumW >= totalW * 0.25) { ci25 = p.v; break; } }
    cumW = 0;
    let ci75 = pairs[pairs.length - 1]?.v || 0;
    for (const p of pairs) { cumW += p.w; if (cumW >= totalW * 0.75) { ci75 = p.v; break; } }

    const flags = [];
    if (surviving.length < 3) flags.push('insufficient_sources');
    const interval = ci75 - ci25;
    if (consensusPrice > 0 && interval / consensusPrice > 0.4) flags.push('wide_disagreement');

    consensus[cardId] = {
      cardId,
      consensusPriceCents: Math.round(consensusPrice),
      confidenceLower: Math.round(ci25),
      confidenceUpper: Math.round(ci75),
      contributingSources: surviving.map((s) => ({
        platform: s.platform,
        priceCents: s.priceCents,
        confidence: s.confidence,
        weight: (s.confidence || 0.5) * (reputation[s.platform]?.reliability || 1.0),
      })),
      rejectedSources: rejected,
      flags,
      sourceCount: surviving.length,
      roundId: `${cardId}_round${round}`,
      timestamp: ts,
    };

    // Update reputation
    for (const s of surviving) {
      const dev = Math.abs(s.priceCents - consensusPrice) / consensusPrice;
      const agreed = dev < 0.15;
      const rep = reputation[s.platform];
      rep.rounds++;
      if (agreed) rep.hits++; else rep.misses++;
      rep.reliability = 0.7 * (rep.hits / rep.rounds) + 0.3 * rep.reliability;
      rep.lastDeviation = dev;
      rep.lastUpdated = ts;
    }
    for (const r of rejected) {
      const rep = reputation[r.platform];
      rep.rounds++;
      rep.misses++;
      rep.reliability = 0.7 * (rep.hits / rep.rounds) + 0.3 * rep.reliability;
      rep.lastDeviation = 1.0;
      rep.lastUpdated = ts;
    }
  }

  // Write consensus
  write(join(MEMWAL, 'shared', 'consensus', 'latest.json'), consensus);
  write(join(MEMWAL, 'shared', 'consensus', 'history', `${tsSlug}.json`), consensus);

  // Log round summary
  for (const [cardId, c] of Object.entries(consensus)) {
    const rej = c.rejectedSources.length > 0 ? ` [REJECTED: ${c.rejectedSources.map((r) => r.platform).join(', ')}]` : '';
    const width = c.consensusPriceCents ? ((c.confidenceUpper - c.confidenceLower) / c.consensusPriceCents * 100).toFixed(1) : '?';
    console.log(`  ${cardId.padEnd(16)} ${('$' + (c.consensusPriceCents / 100).toFixed(0)).padEnd(9)} ±${width}%  ${c.sourceCount} sources${rej}`);
  }
}

// ── Write final state ────────────────────────────────────────────────

// Write reputation
write(join(MEMWAL, 'shared', 'reputation', 'weights.json'), reputation);

// Write per-agent memory
for (const platform of PLATFORMS) {
  for (const [cardId, mem] of Object.entries(agentMemory[platform.name])) {
    write(join(MEMWAL, 'agents', platform.name, 'cards', `${cardId}.json`), mem);
  }
  write(join(MEMWAL, 'agents', platform.name, 'state.json'), {
    lastRun: roundTs(ROUNDS - 1),
    cardsProcessed: Object.keys(CARDS).length,
    signalsEmitted: Object.values(agentMemory[platform.name]).filter((m) => m.observations.length > 0).length,
    seededRounds: ROUNDS,
  });
}

// Write evidence bundle
const finalConsensus = {};
for (const cardId of Object.keys(CARDS)) {
  const mem = agentMemory.ebay[cardId];
  finalConsensus[cardId] = { lastObservation: mem?.observations?.slice(-1)[0] };
}
const bundle = {
  version: '1.0.0',
  swarmId: 'slabclaw-oracle-swarm',
  timestamp: roundTs(ROUNDS - 1),
  cardIds: Object.keys(CARDS),
  consensus: finalConsensus,
  reputationWeights: reputation,
  aggregationMethod: 'confidence_weighted_median',
  outlierMethod: 'MAD_modified_z_score',
  madThreshold: 3.5,
  minSources: 3,
  seeded: true,
  rounds: ROUNDS,
};
write(join(MEMWAL, 'shared', 'evidence', 'latest-bundle.json'), bundle);

console.log(`\n${'='.repeat(60)}`);
console.log('Seeding complete.\n');
console.log('Final Reputation:');
for (const [p, r] of Object.entries(reputation).sort((a, b) => b[1].reliability - a[1].reliability)) {
  console.log(`  ${p.padEnd(16)} ${(r.reliability * 100).toFixed(1)}%  (${r.hits}/${r.rounds} agreed)`);
}
console.log(`\nMemWal root: ${MEMWAL}`);
console.log('Run `node swarm.mjs` to add a live round on top of seeded history.\n');
