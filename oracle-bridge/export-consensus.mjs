/// export-consensus.mjs — Write a frontend-readable consensus artifact.
///
/// After the coordinator produces consensus and the round's evidence is
/// uploaded to Walrus, this helper writes a compact, per-product artifact the
/// frontend can read directly: consensus price, confidence band, contributing
/// and rejected sources, and a verifiable Walrus evidence pointer.
///
/// Usage:
///   import { writeFrontendConsensus } from './export-consensus.mjs';
///   writeFrontendConsensus(consensus, walrusBlobId);

import { writeFileSync, mkdirSync } from 'fs';
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

/**
 * Build the per-product frontend artifact from a consensus map (keyed by
 * cardId, as produced by runCoordinator) and a Walrus blob id.
 * Returns the artifact object (also used by tests without touching disk).
 */
export function buildFrontendConsensus(consensus, blobId) {
  const updatedAt = new Date().toISOString();
  const evidence = { blobId: blobId || null, aggregatorUrl: aggregatorUrl(blobId) };
  const out = {};

  for (const m of DEMO_MARKETS) {
    const c = consensus?.[m.productId];
    if (!c) continue;
    out[m.productId] = {
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
    };
  }

  return out;
}

/**
 * Write the frontend consensus artifact to frontend/src/data/oracle-consensus.json.
 *
 * The frontend (OracleConsensusPanel / MarketDetail) reads
 * `consensusData.consensus[productId]` and the `_seed` flag, so the on-disk
 * shape is the nested envelope `{ _seed, roundId, timestamp, consensus: {…} }`
 * — matching the hand-authored seed file. buildFrontendConsensus still returns
 * the bare per-product map (the tested unit contract); this writer wraps it.
 *
 * Resilient: ensures the data directory exists first. Returns the written path.
 */
export function writeFrontendConsensus(consensus, blobId, outPath = OUT_PATH) {
  const byProduct = buildFrontendConsensus(consensus, blobId);
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
