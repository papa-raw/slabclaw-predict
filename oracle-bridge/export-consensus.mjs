/// export-consensus.mjs — Write a frontend-readable consensus artifact.
///
/// After the coordinator produces consensus and the round's evidence is
/// uploaded to Walrus, this helper writes a compact, per-product artifact the
/// frontend can read directly: consensus price, confidence band, contributing
/// and rejected sources, and a verifiable Walrus evidence pointer.
///
/// STICKY by design: a card that is currently settling is NEVER regressed to
/// "insufficient" by a round that merely failed to FETCH fresh data (a flaky
/// venue scrape, a transient miss). It carries the last-good price forward —
/// which is correct oracle behavior: a price persists between sales. Only a
/// card with no prior good value is published as insufficient. This is what
/// keeps the production feed from flickering when a rare-card source is slow.
///
/// Usage:
///   import { writeFrontendConsensus } from './export-consensus.mjs';
///   writeFrontendConsensus(consensus, walrusBlobId);

import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

// frontend/src/data/oracle-consensus.json
const OUT_PATH = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  'frontend',
  'src',
  'data',
  'oracle-consensus.json',
);

export function aggregatorUrl(blobId) {
  return blobId ? `${AGGREGATOR}/v1/blobs/${blobId}` : null;
}

/// A card "settles" when it has a real price and isn't blocked on missing data.
/// thin_market / consensus_above_lowest_ask / wide-ish flags still settle —
/// only insufficient_sources / asks_only / all_outliers / a null price do not.
const BLOCKING = new Set(['insufficient_sources', 'asks_only', 'all_outliers']);
export function settles(card) {
  return !!card
    && card.consensusPriceCents != null
    && !(card.flags || []).some((f) => BLOCKING.has(f));
}

/**
 * Build the per-product frontend artifact from a consensus map (keyed by
 * cardId, as produced by runCoordinator) and a Walrus blob id.
 *
 * `prev` is the previous per-product map (the last published consensus). If
 * this round did NOT settle a card but the previous round did, the previous
 * (settling) card is carried forward, tagged `carriedForward: true` and keeping
 * its own `updatedAt` so freshness stays honest per-card. Returns the artifact
 * object (also used by tests without touching disk).
 */
export function buildFrontendConsensus(consensus, blobId, prev = {}) {
  const updatedAt = new Date().toISOString();
  const roundEvidence = blobId ? { blobId, aggregatorUrl: aggregatorUrl(blobId) } : null;
  const out = {};

  for (const m of DEMO_MARKETS) {
    const c = consensus?.[m.productId];
    const last = prev?.[m.productId];
    // A keeper (memory-only) round uploads no fresh blob. Keep the card's
    // last-known evidence pointer instead of nulling a live "verify on Walrus"
    // link; only a real round with its own blob replaces it.
    const evidence = roundEvidence
      || (last?.evidence?.blobId ? last.evidence : { blobId: null, aggregatorUrl: null });
    const fresh = c ? {
      productId: m.productId,
      consensusPriceCents: c.consensusPriceCents ?? null,
      confidenceLower: c.confidenceLower ?? null,
      confidenceUpper: c.confidenceUpper ?? null,
      sourceCount: c.sourceCount ?? 0,
      flags: c.flags ?? [],
      contributingSources: c.contributingSources ?? [],
      rejectedSources: c.rejectedSources ?? [],
      updatedAt,
      evidence,
    } : null;

    if (settles(fresh)) {
      out[m.productId] = fresh;                       // good fresh round — publish it
    } else if (settles(last)) {
      out[m.productId] = { ...last, carriedForward: true }; // flaky round — keep the last-good price
    } else if (fresh) {
      out[m.productId] = fresh;                        // no prior good value — publish as-is (insufficient)
    }
  }

  return out;
}

/// Read the previously-published per-product consensus (for sticky carry-forward).
function readPrevConsensus(outPath) {
  try {
    if (!existsSync(outPath)) return {};
    const env = JSON.parse(readFileSync(outPath, 'utf8'));
    return env?.consensus && !env._seed ? env.consensus : {};
  } catch { return {}; }
}

/**
 * Write the frontend consensus artifact to frontend/src/data/oracle-consensus.json.
 *
 * Sticky: merges against the previously-published consensus so a fetch-miss
 * round can't erase a settling price. Resilient: ensures the data directory
 * exists first. Returns the written path.
 */
export function writeFrontendConsensus(consensus, blobId, outPath = OUT_PATH) {
  const prev = readPrevConsensus(outPath);
  const byProduct = buildFrontendConsensus(consensus, blobId, prev);
  const envelope = {
    _seed: false,
    roundId: `live-${Date.now()}`,
    timestamp: Date.now(),
    consensus: byProduct,
  };
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(envelope, null, 2));
  return outPath;
}
