/// walrus-evidence.test.mjs — Unit tests for the Walrus evidence layer.
///
/// All network I/O is mocked by replacing global.fetch (saved/restored per
/// test). Nothing here touches the real Walrus testnet.
///
/// Run: node --test test/walrus-evidence.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { uploadEvidence, readEvidence, verifyEvidence } from '../walrus-evidence.mjs';
import { aggregate } from '../agents/coordinator.mjs';

// ── Fixtures ──────────────────────────────────────────────────────────

/// Build agentSignals with N sources clustered tightly so MAD keeps them all.
function makeAgentSignals(cardId, prices) {
  const signals = {};
  const platforms = ['ebay', 'alt', 'courtyard', 'tcgplayer', 'goldin', 'beezie'];
  prices.forEach((priceCents, i) => {
    const platform = platforms[i] || `src${i}`;
    signals[platform] = {
      signals: [{
        cardId,
        priceCents,
        confidence: 1,
        rejected: false,
        source: `${platform}_sold`,
        compCount: 10,
        observedAt: '2026-06-08T00:00:00.000Z',
      }],
    };
  });
  return signals;
}

/// Build a self-consistent bundle: agentSignals + the consensus that the real
/// aggregate() produces from them. This guarantees verifyEvidence() passes for
/// an untampered bundle.
function makeBundle(cardId = 'test-card-1', prices = [10000, 10100, 9900]) {
  const agentSignals = makeAgentSignals(cardId, prices);
  const reputationWeights = {};
  const consensus = { [cardId]: aggregate(cardId, agentSignals, reputationWeights) };
  return {
    version: '1.0.0',
    swarmId: 'slabclaw-oracle-swarm',
    timestamp: '2026-06-08T00:00:00.000Z',
    cardIds: [cardId],
    consensus,
    agentSignals,
    reputationWeights,
    aggregationMethod: 'confidence_weighted_median',
    outlierMethod: 'MAD_modified_z_score',
    madThreshold: 3.5,
    minSources: 3,
  };
}

// ── Fetch mock harness ────────────────────────────────────────────────

const realFetch = global.fetch;

function restoreFetch() { global.fetch = realFetch; }

/// Install a fetch mock. `handler(url, options)` returns either a Response-like
/// object or throws (to simulate a network/timeout error).
function installFetch(handler) {
  global.fetch = async (url, options = {}) => handler(String(url), options);
}

/// Build a minimal Response-like object the module understands.
function jsonResponse(status, body) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    async text() { return typeof body === 'string' ? body : JSON.stringify(body); },
  };
}

const newlyCreatedBody = (blobId, objectId = '0xobj') => ({
  newlyCreated: { blobObject: { blobId, id: objectId } },
});

const alreadyCertifiedBody = (blobId, txDigest = '0xtx') => ({
  alreadyCertified: { blobId, event: { txDigest } },
});

// ── Tests: blobId extraction ──────────────────────────────────────────

test('uploadEvidence extracts blobId from newlyCreated shape', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle();
  installFetch((url, options) => {
    if (options.method === 'PUT') return jsonResponse(200, newlyCreatedBody('BLOB_NEW', '0xobj42'));
    // aggregator GET for verify-after-write returns the same bundle
    return jsonResponse(200, bundle);
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(entry.blobId, 'BLOB_NEW');
  assert.equal(entry.objectId, '0xobj42');
  assert.equal(entry.verified, true);
  assert.equal(entry.aggregatorUrl, 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/BLOB_NEW');
});

test('uploadEvidence extracts blobId from alreadyCertified shape', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle();
  installFetch((url, options) => {
    if (options.method === 'PUT') return jsonResponse(200, alreadyCertifiedBody('BLOB_CERT', '0xtxdig'));
    return jsonResponse(200, bundle);
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(entry.blobId, 'BLOB_CERT');
  assert.equal(entry.objectId, '0xtxdig');
  assert.equal(entry.verified, true);
});

// ── Tests: retry on transient failure ─────────────────────────────────

test('uploadEvidence retries on transient 500 then succeeds', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle();
  let putCalls = 0;
  installFetch((url, options) => {
    if (options.method === 'PUT') {
      putCalls++;
      if (putCalls < 2) return jsonResponse(500, 'internal error');
      return jsonResponse(200, newlyCreatedBody('BLOB_RETRY'));
    }
    return jsonResponse(200, bundle);
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(putCalls, 2, 'should have retried once');
  assert.equal(entry.blobId, 'BLOB_RETRY');
  assert.equal(entry.verified, true);
});

test('uploadEvidence retries on network error then succeeds', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle();
  let putCalls = 0;
  installFetch((url, options) => {
    if (options.method === 'PUT') {
      putCalls++;
      if (putCalls < 2) {
        const e = new TypeError('fetch failed');
        throw e;
      }
      return jsonResponse(200, newlyCreatedBody('BLOB_NET'));
    }
    return jsonResponse(200, bundle);
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(putCalls, 2);
  assert.equal(entry.blobId, 'BLOB_NET');
});

test('uploadEvidence gives up after 3 attempts on persistent 500', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle();
  let putCalls = 0;
  installFetch((url, options) => {
    if (options.method === 'PUT') { putCalls++; return jsonResponse(500, 'down'); }
    return jsonResponse(200, bundle);
  });

  await assert.rejects(() => uploadEvidence(bundle), /Walrus upload failed/);
  assert.equal(putCalls, 3, 'should have tried exactly 3 times');
});

// ── Tests: error classification ───────────────────────────────────────

test('uploadEvidence does NOT retry a 4xx client error', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle();
  let putCalls = 0;
  installFetch((url, options) => {
    if (options.method === 'PUT') { putCalls++; return jsonResponse(400, 'bad request'); }
    return jsonResponse(200, bundle);
  });

  await assert.rejects(() => uploadEvidence(bundle), /client/);
  assert.equal(putCalls, 1, '4xx is non-retryable — only one attempt');
});

test('readEvidence classifies a timeout error', async (t) => {
  t.after(restoreFetch);
  installFetch(() => {
    const e = new Error('The operation timed out');
    e.name = 'TimeoutError';
    throw e;
  });
  await assert.rejects(() => readEvidence('BLOB_X'), (err) => {
    assert.equal(err.family, 'timeout');
    return true;
  });
});

test('readEvidence classifies a 503 server error', async (t) => {
  t.after(restoreFetch);
  installFetch(() => jsonResponse(503, 'unavailable'));
  await assert.rejects(() => readEvidence('BLOB_X'), (err) => {
    assert.equal(err.family, 'server');
    assert.equal(err.status, 503);
    return true;
  });
});

// ── Tests: size guard ─────────────────────────────────────────────────

test('uploadEvidence refuses payloads over 10MB', async (t) => {
  t.after(restoreFetch);
  let putCalls = 0;
  installFetch((url, options) => {
    if (options.method === 'PUT') { putCalls++; return jsonResponse(200, newlyCreatedBody('X')); }
    return jsonResponse(200, {});
  });

  // Build an oversized bundle (>10MB of JSON).
  const huge = makeBundle();
  huge.padding = 'x'.repeat(11 * 1024 * 1024);

  await assert.rejects(() => uploadEvidence(huge), /too large/);
  assert.equal(putCalls, 0, 'must not hit the network when oversized');
});

// ── Tests: verify-after-write pass / fail ─────────────────────────────

test('verify-after-write passes when round-tripped consensus matches', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle('match-card', [20000, 20100, 19950]);
  installFetch((url, options) => {
    if (options.method === 'PUT') return jsonResponse(200, newlyCreatedBody('BLOB_OK'));
    return jsonResponse(200, bundle);
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(entry.verified, true);
});

test('verify-after-write fails when aggregator returns tampered consensus', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle('tamper-card', [30000, 30100, 29900]);
  // Aggregator returns a bundle whose consensus price has been altered.
  const tampered = JSON.parse(JSON.stringify(bundle));
  tampered.consensus['tamper-card'].consensusPriceCents += 99999;

  installFetch((url, options) => {
    if (options.method === 'PUT') return jsonResponse(200, newlyCreatedBody('BLOB_BAD'));
    return jsonResponse(200, tampered);
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(entry.verified, false, 'tampered round-trip must not verify');
  assert.equal(entry.blobId, 'BLOB_BAD');
});

test('verify-after-write tolerates propagation lag (404 then 200)', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle('lag-card', [40000, 40100, 39900]);
  let getCalls = 0;
  installFetch((url, options) => {
    if (options.method === 'PUT') return jsonResponse(200, newlyCreatedBody('BLOB_LAG'));
    getCalls++;
    if (getCalls < 2) return jsonResponse(404, 'not found yet');
    return jsonResponse(200, bundle);
  });

  const entry = await uploadEvidence(bundle);
  assert.ok(getCalls >= 2, 'should retry the read past the initial 404');
  assert.equal(entry.verified, true);
});

test('uploadEvidence reports verified:false when read keeps failing', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle('readfail-card', [50000, 50100, 49900]);
  installFetch((url, options) => {
    if (options.method === 'PUT') return jsonResponse(200, newlyCreatedBody('BLOB_RF'));
    return jsonResponse(500, 'aggregator down');
  });

  const entry = await uploadEvidence(bundle);
  assert.equal(entry.blobId, 'BLOB_RF');
  assert.equal(entry.verified, false, 'upload still succeeds but cannot verify');
});

// ── Tests: verifyEvidence (don't trust, verify) ───────────────────────

test('verifyEvidence re-runs aggregation and confirms a clean bundle', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle('verify-card', [60000, 60200, 59800]);
  installFetch(() => jsonResponse(200, bundle));

  const check = await verifyEvidence('BLOB_V');
  assert.equal(check.blobId, 'BLOB_V');
  assert.equal(check.ok, true);
  assert.deepEqual(check.mismatches, []);
});

test('verifyEvidence detects a tampered stored consensus', async (t) => {
  t.after(restoreFetch);
  const bundle = makeBundle('verify-bad', [70000, 70200, 69800]);
  // Tamper the STORED consensus so it no longer matches recomputed aggregation.
  bundle.consensus['verify-bad'].consensusPriceCents = 1;
  installFetch(() => jsonResponse(200, bundle));

  const check = await verifyEvidence('BLOB_VB');
  assert.equal(check.ok, false);
  assert.equal(check.mismatches.length, 1);
  assert.equal(check.mismatches[0].cardId, 'verify-bad');
  assert.equal(check.mismatches[0].stored, 1);
  assert.notEqual(check.mismatches[0].recomputed, 1);
});
