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

const MIN_SOURCES = 3;        // full confidence — no thinness flag at/above this
const MIN_SOURCES_THIN = 2;   // a genuinely-rare card settles here IF the two sold-families agree
const THIN_CORROBORATION = 0.30; // the family medians must sit within ±30% to settle thin

// Source families — sources drawing on the SAME underlying data count once toward the
// independence gate. eBay + PriceCharting are both eBay-sold (PriceCharting scrapes eBay
// sold; the eBay agent falls back to PriceCharting comps). Fanatics + PWCC are one venue.
const SOURCE_FAMILY = {
  ebay: 'ebay-sold', pricecharting: 'ebay-sold', ebay_sold: 'ebay-sold', 'ebay-api': 'ebay-sold',
  // 130point aggregates eBay-completed sales (same tape, same shill-exposure) → eBay family,
  // so it cross-checks/backs up the eBay vote rather than inflating independent-source count.
  point130: 'ebay-sold',
  fanatics: 'fanatics-pwcc', pwcc: 'fanatics-pwcc', 'fanatics-pwcc': 'fanatics-pwcc',
};
const familyOf = (p) => SOURCE_FAMILY[String(p || '').toLowerCase()] || String(p || '').toLowerCase();

// Sources that report ASKS (live listings / FMV), not realized sales. Asks bound the
// price — you can't realistically settle above the lowest ask — but must NOT vote in
// the settlement median: an ask structurally sits above the clearing price.
// tcgplayer is a LISTINGS venue (active asks), not a realized-sold feed — classify it as
// an ask regardless of source suffix (tcgplayer_active / _seeded both dodge the regex).
const ASK_PLATFORMS = new Set(['alt', 'cardmarket', 'courtyard', 'beezie', 'collector-crypt', 'tcgplayer']);
const kindOf = (platform, source) =>
  (/ask|listing|active|fmv/i.test(source || '') || ASK_PLATFORMS.has(String(platform || '').toLowerCase())) ? 'ask' : 'realized';
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

  // Step 1: bail only if there is nothing at all; the INDEPENDENCE gate is applied
  // after outlier rejection, counting distinct source families (not platforms).
  if (signals.length === 0) return result;

  // ── Realized vs asks ───────────────────────────────────────────────────────
  // Tag each signal. Settlement uses REALIZED sales; ASKS (Cardmarket / ALT / tokenized
  // listings) bound the price but never vote — an ask structurally sits above the clearing
  // price. So MAD outlier rejection, which would wrongly cut a legitimately-high ask, runs
  // over REALIZED signals ONLY.
  for (const s of signals) s.kind = kindOf(s.platform, s.source);
  const realizedRaw = signals.filter((s) => s.kind === 'realized');
  let asks = signals.filter((s) => s.kind === 'ask');

  // Step 2: MAD outlier rejection (realized only)
  const prices = realizedRaw.map((s) => s.priceCents);
  const priceMedian = median(prices);
  const priceMad = mad(prices);
  let realized = [];
  for (const s of realizedRaw) {
    const z = modifiedZScore(s.priceCents, priceMedian, priceMad);
    if (Math.abs(z) > MAD_THRESHOLD) {
      result.rejectedSources.push({
        platform: s.platform,
        priceCents: s.priceCents,
        reason: `MAD outlier (z=${z.toFixed(2)})`,
        zScore: z,
      });
    } else {
      realized.push(s);
    }
  }

  if (realized.length === 0 && asks.length === 0) {
    result.flags.push('all_outliers');
    return result;
  }

  // ── Cross-source plausibility gate (anchored on the registry's grade-matched oracle) ─
  // Prefer the registry's grade-matched current_oracle (pc_sold / pc_consensus) as the anchor:
  // it's the production-quality, recency-weighted, validated PSA-10 price. A naive median over
  // all "realized" sources is itself poisoned by wrong-grade scrapers (a PSA-APR or Fanatics
  // snippet that grabbed a lower-grade sale), which then drag the anchor down and let other
  // wrong sources survive. With the true anchor, anything >50% below it is a wrong-grade/variant
  // grab and is rejected; trusted feeds keep a lenient 2.5x ceiling.
  const wellSupported = realized.filter((s) => (s.compCount || 0) >= 3);
  const registryOracle = realized.find((s) => /pc_sold|pc_consensus/.test(s.source || '') && (s.compCount || 0) >= 3);
  const anchor = registryOracle
    ? registryOracle.priceCents
    : median((wellSupported.length ? wellSupported : realized).map((s) => s.priceCents));
  if (anchor > 0) {
    realized = realized.filter((s) => {
      const thin = (s.compCount || 0) < 3 && wellSupported.length > 0;
      const lo = 0.5;                  // a realized PSA-10 sale 50%+ below the grade-matched oracle
      const hi = thin ? 1.5 : 2.5;     // is a wrong grade/variant, not a real comp
      if (s.priceCents < lo * anchor || s.priceCents > hi * anchor) {
        result.rejectedSources.push({
          platform: s.platform,
          priceCents: s.priceCents,
          reason: `implausible vs anchor (${(s.priceCents / anchor).toFixed(2)}x of $${Math.round(anchor / 100)}${thin ? ', thin source' : ''})`,
        });
        return false;
      }
      return true;
    });
  }

  // Asks must be plausibly the SAME asset. Asks legitimately sit ABOVE the realized clearing
  // price (you list higher than you'd sell), so an ask well BELOW it is almost always a
  // wrong-grade/variant match — e.g. a tokenized agent averaging raw / lower-grade listings
  // for the card instead of the graded slab. Keep asks within [0.6x, 5x] of the realized
  // anchor; surface the rest as rejected so the wrong-card catch is visible.
  if (anchor > 0) {
    asks = asks.filter((a) => {
      if (a.priceCents < 0.6 * anchor || a.priceCents > 5 * anchor) {
        result.rejectedSources.push({
          platform: a.platform,
          priceCents: a.priceCents,
          reason: `listing off-anchor (${(a.priceCents / anchor).toFixed(2)}x of $${Math.round(anchor / 100)} — likely wrong grade/variant)`,
        });
        return false;
      }
      return true;
    });
  }

  // ── Independence gate (REALIZED families only — asks don't establish a market) ──
  const familyCounts = {};
  for (const s of realized) familyCounts[familyOf(s.platform)] = (familyCounts[familyOf(s.platform)] || 0) + 1;
  const independentSources = Object.keys(familyCounts).length;
  result.sourceCount = independentSources;
  result.rawSourceCount = realized.length;
  result.sourceFamilies = Object.keys(familyCounts);
  result.askCount = asks.length;
  // The independence-gate decision is made AFTER settlement (below), because a
  // genuinely-rare card can settle on 2 corroborating sold-families — we need
  // the per-family prices to judge corroboration first.

  // ── Settlement: comp-weighted median of REALIZED, ONE vote per source family ──
  const rep = reputationWeights || {};
  const recencyHalfLife = 7 * 24 * 3600 * 1000; // 1 week
  const values = [];
  const weights = [];
  for (const s of realized) {
    const reliability = rep[s.platform]?.reliability || 1.0;
    const ageMs = s.observedAt ? Date.now() - new Date(s.observedAt).getTime() : 0;
    const recency = Math.exp(-ageMs / recencyHalfLife);
    const sampleWeight = Math.sqrt(Math.max(1, s.compCount || 1)); // a 12-sale comp outweighs a 1-sale comp
    // Divide by family size so same-origin sources (eBay+PriceCharting) cast ONE vote total.
    const weight = ((s.confidence || 0.5) * reliability * recency * sampleWeight) / familyCounts[familyOf(s.platform)];
    values.push(s.priceCents);
    weights.push(weight);
    result.contributingSources.push({
      platform: s.platform,
      family: familyOf(s.platform),
      kind: 'realized',
      priceCents: s.priceCents,
      confidence: s.confidence,
      reliability,
      weight,
      source: s.source,
      compCount: s.compCount || 0,
    });
  }

  // Asks are recorded for transparency (weight 0) — they bound, they don't vote.
  for (const s of asks) {
    result.contributingSources.push({
      platform: s.platform,
      family: familyOf(s.platform),
      kind: 'ask',
      priceCents: s.priceCents,
      confidence: s.confidence,
      reliability: rep[s.platform]?.reliability || 1.0,
      weight: 0,
      source: s.source,
      compCount: s.compCount || 0,
    });
  }

  if (values.length === 0) {
    // No realized sales survive — we can only price provisionally off the ask floor.
    result.flags.push('asks_only');
    if (asks.length === 0) return result;
    const askPrices = asks.map((a) => a.priceCents);
    result.consensusPriceCents = Math.min(...askPrices);
    result.confidenceLower = Math.min(...askPrices);
    result.confidenceUpper = Math.max(...askPrices);
    return result;
  }

  result.consensusPriceCents = Math.round(weightedMedian(values, weights));
  result.confidenceLower = Math.round(weightedPercentile(values, weights, 0.25));
  result.confidenceUpper = Math.round(weightedPercentile(values, weights, 0.75));

  // ── Independence gate (rare-card aware) ──────────────────────────────────────
  // 3+ independent sold-families → clean settle, no flag.
  // Exactly 2 → a genuinely-rare card (clean sales are scarce). Rather than refuse
  // forever, settle IF the two families AGREE (medians within ±THIN_CORROBORATION),
  // record the thinness in the evidence, and extend the challenge window. If they
  // disagree, or there's only 1 family, it can't settle (insufficient_sources).
  if (independentSources < MIN_SOURCES) {
    const famMedians = {};
    for (const fam of Object.keys(familyCounts)) {
      const fv = realized.filter((s) => familyOf(s.platform) === fam).map((s) => s.priceCents);
      famMedians[fam] = fv.sort((a, b) => a - b)[Math.floor(fv.length / 2)];
    }
    const m = Object.values(famMedians);
    const corroborate = independentSources >= MIN_SOURCES_THIN &&
      m.length >= 2 && (Math.max(...m) - Math.min(...m)) / Math.min(...m) <= THIN_CORROBORATION;
    if (corroborate) {
      result.flags.push('thin_market');     // settleable — rarity disclosed, window extended
      result.thinMarket = true;
      result.disputeWindowMultiplier = 3;   // 3× the normal challenge window
    } else {
      result.flags.push('insufficient_sources'); // genuinely can't settle (1 family or disagreement)
    }
  }

  // ── Ask sanity band ────────────────────────────────────────────────────────
  // Asks are a ceiling on the clearing price. If the realized consensus sits ABOVE the
  // cheapest live listing, that's suspicious (we'd settle above buyable). If asks sit
  // well ABOVE the realized consensus, the market may have moved up since the last sale
  // — informational, and the quality tier widens the dispute window on it.
  if (asks.length) {
    const lowestAsk = Math.min(...asks.map((a) => a.priceCents));
    result.lowestAskCents = lowestAsk;
    if (result.consensusPriceCents > lowestAsk) {
      result.flags.push('consensus_above_lowest_ask');
    } else if (result.consensusPriceCents < 0.7 * lowestAsk) {
      result.flags.push('asks_above_consensus');
    }
  }

  // ── Aggregator circuit breaker (wide disagreement) ─────────────────────────
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
