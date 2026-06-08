/// wiring.test.mjs — Evidence-gate wiring tests.
///
/// Covers the offchain half of the "no settlement without a verifiable Walrus
/// evidence blob" contract:
///   1. proposeResolution fails fast when evidenceBlobId is empty/falsy.
///   2. The blob id round-trips through the u8 vector encoding (TextEncoder →
///      TextDecoder), matching what tx.pure.vector('u8', …) puts onchain.
///   3. writeFrontendConsensus produces the exact per-product artifact shape,
///      including the Walrus aggregator URL.
///
/// No network and no real onchain transactions: proposeResolution aborts
/// before building a transaction, and the export helper is unit-tested against
/// a temp output path.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { proposeResolution } from '../sui-client.mjs';
import {
  buildFrontendConsensus,
  writeFrontendConsensus,
  aggregatorUrl,
} from '../export-consensus.mjs';
import { DEMO_MARKETS } from '../../frontend/src/constants.js';

const SAMPLE_BLOB_ID = 'dHWTDxbxXzGV_qwh9qeb52RH31SWssvST40GWj1mtS4';
const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

// ── 1. proposeResolution fails fast without evidence ────────────────────

test('proposeResolution throws when evidenceBlobId is missing', async () => {
  await assert.rejects(
    () => proposeResolution({
      oracleCapId: '0xcap',
      marketId: '0xmkt',
      priceUsdCents: 700000,
      sourcesCount: 5,
      // evidenceBlobId omitted
    }),
    /evidenceBlobId is required/,
  );
});

test('proposeResolution throws when evidenceBlobId is empty string', async () => {
  await assert.rejects(
    () => proposeResolution({
      oracleCapId: '0xcap',
      marketId: '0xmkt',
      priceUsdCents: 700000,
      sourcesCount: 5,
      evidenceBlobId: '',
    }),
    /evidenceBlobId is required/,
  );
});

test('proposeResolution throws when evidenceBlobId is null', async () => {
  await assert.rejects(
    () => proposeResolution({
      oracleCapId: '0xcap',
      marketId: '0xmkt',
      priceUsdCents: 700000,
      sourcesCount: 5,
      evidenceBlobId: null,
    }),
    /no Walrus evidence/,
  );
});

// ── 2. u8 vector encoding round-trips ───────────────────────────────────

test('blob id encodes to a u8 vector that round-trips via TextDecoder', () => {
  // This is exactly what proposeResolution feeds tx.pure.vector('u8', …).
  const bytes = Array.from(new TextEncoder().encode(SAMPLE_BLOB_ID));

  // Every element is a valid u8.
  assert.ok(bytes.length > 0, 'encoding must be non-empty');
  for (const b of bytes) {
    assert.ok(Number.isInteger(b) && b >= 0 && b <= 255, `byte out of u8 range: ${b}`);
  }

  // Base64url blob ids are ASCII, so byte length == char length.
  assert.equal(bytes.length, SAMPLE_BLOB_ID.length);

  const decoded = new TextDecoder().decode(Uint8Array.from(bytes));
  assert.equal(decoded, SAMPLE_BLOB_ID);
});

// ── 3. writeFrontendConsensus produces the exact shape ──────────────────

function sampleConsensus() {
  const productId = DEMO_MARKETS[0].productId;
  return {
    [productId]: {
      cardId: productId,
      consensusPriceCents: 712345,
      confidenceLower: 690000,
      confidenceUpper: 735000,
      contributingSources: [
        { platform: 'ebay', priceCents: 710000, confidence: 0.9, reliability: 0.95, weight: 0.4, source: 'sold', compCount: 8 },
      ],
      rejectedSources: [
        { platform: 'cardmarket', priceCents: 950000, reason: 'outlier', zScore: 4.2 },
      ],
      flags: [],
      sourceCount: 5,
      roundId: `${productId}_123`,
      timestamp: '2026-06-08T00:00:00.000Z',
    },
  };
}

test('aggregatorUrl builds the Walrus blob URL (and is null when no blob)', () => {
  assert.equal(aggregatorUrl(SAMPLE_BLOB_ID), `${AGGREGATOR}/v1/blobs/${SAMPLE_BLOB_ID}`);
  assert.equal(aggregatorUrl(null), null);
});

test('buildFrontendConsensus produces the exact per-product shape with evidence', () => {
  const productId = DEMO_MARKETS[0].productId;
  const artifact = buildFrontendConsensus(sampleConsensus(), SAMPLE_BLOB_ID);
  const entry = artifact[productId];

  assert.ok(entry, 'product entry must exist');
  assert.deepEqual(Object.keys(entry).sort(), [
    'confidenceLower', 'confidenceUpper', 'consensusPriceCents',
    'contributingSources', 'evidence', 'flags', 'productId',
    'rejectedSources', 'sourceCount', 'updatedAt',
  ].sort());

  assert.equal(entry.productId, productId);
  assert.equal(entry.consensusPriceCents, 712345);
  assert.equal(entry.confidenceLower, 690000);
  assert.equal(entry.confidenceUpper, 735000);
  assert.equal(entry.sourceCount, 5);
  assert.deepEqual(entry.flags, []);
  assert.equal(entry.contributingSources.length, 1);
  assert.equal(entry.rejectedSources.length, 1);
  assert.equal(typeof entry.updatedAt, 'string');

  // Evidence pointer
  assert.deepEqual(entry.evidence, {
    blobId: SAMPLE_BLOB_ID,
    aggregatorUrl: `${AGGREGATOR}/v1/blobs/${SAMPLE_BLOB_ID}`,
  });
});

test('writeFrontendConsensus writes resilient JSON to a (created) data dir', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sc-consensus-'));
  const outPath = join(dir, 'nested', 'data', 'oracle-consensus.json');
  try {
    const written = writeFrontendConsensus(sampleConsensus(), SAMPLE_BLOB_ID, outPath);
    assert.equal(written, outPath);

    const onDisk = JSON.parse(readFileSync(outPath, 'utf8'));
    const productId = DEMO_MARKETS[0].productId;
    // On-disk envelope is nested under `consensus` (+ _seed flag) — the exact
    // shape OracleConsensusPanel/MarketDetail read (consensusData.consensus[id]).
    assert.equal(onDisk._seed, false, 'live writes flag _seed: false');
    assert.ok(onDisk.consensus, 'written file has a consensus envelope');
    assert.ok(onDisk.consensus[productId], 'written file has the product entry');
    assert.equal(
      onDisk.consensus[productId].evidence.aggregatorUrl,
      `${AGGREGATOR}/v1/blobs/${SAMPLE_BLOB_ID}`,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('buildFrontendConsensus carries a null evidence pointer when no blob exists', () => {
  const productId = DEMO_MARKETS[0].productId;
  const artifact = buildFrontendConsensus(sampleConsensus(), null);
  assert.deepEqual(artifact[productId].evidence, { blobId: null, aggregatorUrl: null });
});
