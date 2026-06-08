/// walrus-evidence.mjs — Upload evidence bundles to Walrus.
///
/// Uses the Walrus testnet public publisher HTTP API.
/// Each consensus round becomes a verifiable blob on Walrus.
///
/// Production hardening:
///   - retry with exponential backoff on transient failures
///   - payload size guard (refuses > 10MB)
///   - error classification (network/timeout vs 4xx vs 5xx)
///   - verify-after-write: round-trip the blob through the aggregator and
///     confirm the stored consensus matches what was sent
///   - verifyEvidence(blobId): re-runs the aggregation math offchain and
///     asserts the recomputed consensus equals the stored consensus
///     ("don't trust, verify")
///
/// Usage:
///   import { uploadEvidence, readEvidence, verifyEvidence } from './walrus-evidence.mjs';
///   const result = await uploadEvidence(bundle);
///   const blob = await readEvidence(blobId);
///   const check = await verifyEvidence(blobId);

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { aggregate } from './agents/coordinator.mjs';

const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const MEMWAL_ROOT = join(new URL('.', import.meta.url).pathname, 'memwal');
const BLOB_LOG = join(MEMWAL_ROOT, 'shared', 'evidence', 'blobs.json');

const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024; // 10MB hard ceiling
const UPLOAD_ATTEMPTS = 3;
const UPLOAD_TIMEOUT_MS = 30000;
const READ_TIMEOUT_MS = 15000;
const READ_RETRIES = 3; // tolerate aggregator propagation lag

function loadBlobLog() {
  if (!existsSync(BLOB_LOG)) return [];
  try { return JSON.parse(readFileSync(BLOB_LOG, 'utf8')); } catch { return []; }
}

function saveBlobLog(log) {
  const dir = join(MEMWAL_ROOT, 'shared', 'evidence');
  mkdirSync(dir, { recursive: true });
  writeFileSync(BLOB_LOG, JSON.stringify(log, null, 2));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/// Classify an HTTP / fetch error into a coarse family so callers (and the
/// retry loop) can decide whether retrying is worthwhile.
///   - 'network'   : DNS/connection-level failure (fetch threw)
///   - 'timeout'   : request aborted by AbortSignal.timeout
///   - 'client'    : 4xx — our request is bad, retrying won't help
///   - 'server'    : 5xx — upstream hiccup, worth retrying
///   - 'unknown'   : anything else
function classifyError(err, status) {
  if (typeof status === 'number') {
    if (status >= 400 && status < 500) return 'client';
    if (status >= 500) return 'server';
  }
  if (err) {
    const name = err.name || '';
    const msg = err.message || '';
    if (name === 'TimeoutError' || /timed? out|timeout/i.test(msg)) return 'timeout';
    if (name === 'AbortError') return 'timeout';
    if (name === 'TypeError' || /fetch failed|network|ENOTFOUND|ECONNREFUSED|ECONNRESET/i.test(msg)) return 'network';
  }
  return 'unknown';
}

function isRetryable(family) {
  return family === 'network' || family === 'timeout' || family === 'server';
}

/// Pull the per-card consensus price map out of a bundle for comparison.
function consensusPriceMap(bundle) {
  const map = {};
  const consensus = bundle?.consensus || {};
  for (const [cardId, c] of Object.entries(consensus)) {
    map[cardId] = c?.consensusPriceCents ?? null;
  }
  return map;
}

/// Compare two consensus price maps. Returns the list of mismatching cardIds.
function diffConsensus(sent, fetched) {
  const mismatches = [];
  const cardIds = new Set([...Object.keys(sent), ...Object.keys(fetched)]);
  for (const cardId of cardIds) {
    if (sent[cardId] !== fetched[cardId]) {
      mismatches.push({ cardId, sent: sent[cardId] ?? null, fetched: fetched[cardId] ?? null });
    }
  }
  return mismatches;
}

export async function uploadEvidence(bundle, epochs = 5) {
  const payload = JSON.stringify(bundle);
  const byteLength = Buffer.byteLength(payload, 'utf8');

  // Payload size guard — refuse to upload anything that blows past the ceiling.
  if (byteLength > MAX_PAYLOAD_BYTES) {
    throw new Error(
      `Walrus payload too large: ${(byteLength / 1024 / 1024).toFixed(2)}MB exceeds ${MAX_PAYLOAD_BYTES / 1024 / 1024}MB limit`,
    );
  }
  if (byteLength > MAX_PAYLOAD_BYTES * 0.8) {
    console.warn(`  Walrus payload large: ${(byteLength / 1024 / 1024).toFixed(2)}MB (approaching ${MAX_PAYLOAD_BYTES / 1024 / 1024}MB limit)`);
  }

  // Retry with exponential backoff (3 attempts) on transient failures.
  let result = null;
  let lastErr = null;
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    try {
      const resp = await fetch(`${PUBLISHER}/v1/blobs?epochs=${epochs}`, {
        method: 'PUT',
        body: payload,
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout?.(UPLOAD_TIMEOUT_MS),
      });

      if (!resp.ok) {
        const text = await resp.text().catch(() => '');
        const family = classifyError(null, resp.status);
        const err = new Error(`Walrus upload failed: ${resp.status} ${text.slice(0, 200)} [${family}]`);
        err.family = family;
        err.status = resp.status;
        if (isRetryable(family) && attempt < UPLOAD_ATTEMPTS) {
          lastErr = err;
          const backoff = 500 * 2 ** (attempt - 1);
          console.warn(`  Walrus upload attempt ${attempt}/${UPLOAD_ATTEMPTS} failed (${family} ${resp.status}); retrying in ${backoff}ms`);
          await sleep(backoff);
          continue;
        }
        throw err;
      }

      result = await resp.json();
      break;
    } catch (err) {
      // Re-throw non-retryable HTTP errors we already classified above.
      if (err.family && !isRetryable(err.family)) throw err;
      const family = err.family || classifyError(err);
      err.family = family;
      lastErr = err;
      if (!isRetryable(family) || attempt >= UPLOAD_ATTEMPTS) {
        throw new Error(`Walrus upload failed after ${attempt} attempt(s): ${err.message} [${family}]`);
      }
      const backoff = 500 * 2 ** (attempt - 1);
      console.warn(`  Walrus upload attempt ${attempt}/${UPLOAD_ATTEMPTS} failed (${family}); retrying in ${backoff}ms`);
      await sleep(backoff);
    }
  }

  if (!result) {
    throw new Error(`Walrus upload failed: ${lastErr ? lastErr.message : 'no response'}`);
  }

  // Extract blob ID from either newlyCreated or alreadyCertified response
  const blobId = result.newlyCreated?.blobObject?.blobId
    || result.alreadyCertified?.blobId
    || null;

  const objectId = result.newlyCreated?.blobObject?.id
    || result.alreadyCertified?.event?.txDigest
    || null;

  // Verify-after-write: round-trip the blob through the aggregator and confirm
  // the stored consensus matches what we sent. Tolerate propagation lag.
  let verified = false;
  if (blobId) {
    try {
      const fetched = await readEvidenceWithRetry(blobId);
      const sentMap = consensusPriceMap(bundle);
      const fetchedMap = consensusPriceMap(fetched);
      const mismatches = diffConsensus(sentMap, fetchedMap);
      verified = mismatches.length === 0;
      if (!verified) {
        console.warn(`  Walrus verify-after-write MISMATCH on ${mismatches.length} card(s): ${mismatches.map((m) => m.cardId).join(', ')}`);
      }
    } catch (err) {
      const family = err.family || classifyError(err);
      console.warn(`  Walrus verify-after-write read failed (${family}): ${(err.message || '').slice(0, 120)}`);
      verified = false;
    }
  }

  const entry = {
    blobId,
    objectId,
    verified,
    timestamp: new Date().toISOString(),
    cardIds: bundle.cardIds || [],
    roundId: bundle.consensus ? Object.values(bundle.consensus)[0]?.roundId : null,
    size: byteLength,
    epochs,
    aggregatorUrl: blobId ? `${AGGREGATOR}/v1/blobs/${blobId}` : null,
  };

  // Append to blob log
  const log = loadBlobLog();
  log.push(entry);
  saveBlobLog(log);

  return entry;
}

export async function readEvidence(blobId) {
  let resp;
  try {
    resp = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`, {
      signal: AbortSignal.timeout?.(READ_TIMEOUT_MS),
    });
  } catch (err) {
    const family = classifyError(err);
    const e = new Error(`Walrus read failed: ${err.message} [${family}]`);
    e.family = family;
    throw e;
  }
  if (!resp.ok) {
    const family = classifyError(null, resp.status);
    const e = new Error(`Walrus read failed: ${resp.status} [${family}]`);
    e.family = family;
    e.status = resp.status;
    throw e;
  }
  return resp.json();
}

/// Read with a short retry loop — the aggregator may lag behind the publisher
/// by a few seconds after a fresh write.
async function readEvidenceWithRetry(blobId, retries = READ_RETRIES) {
  let lastErr = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await readEvidence(blobId);
    } catch (err) {
      lastErr = err;
      const family = err.family || classifyError(err);
      // 404 while propagating is expected lag; retry. Other 4xx won't recover.
      const retryable = isRetryable(family) || err.status === 404;
      if (!retryable || attempt >= retries) throw err;
      const backoff = 500 * 2 ** (attempt - 1);
      await sleep(backoff);
    }
  }
  throw lastErr || new Error('Walrus read failed');
}

/// verifyEvidence — "don't trust, verify". Download the blob and RE-RUN the
/// aggregation math on the bundle's own agentSignals, asserting the recomputed
/// consensus equals the stored consensus per card.
///
/// Returns { blobId, ok, mismatches: [{ cardId, stored, recomputed }] }.
export async function verifyEvidence(blobId) {
  const bundle = await readEvidence(blobId);
  const mismatches = [];

  const storedConsensus = bundle?.consensus || {};
  const agentSignals = bundle?.agentSignals || {};
  const reputationWeights = bundle?.reputationWeights || {};
  const cardIds = bundle?.cardIds || Object.keys(storedConsensus);

  for (const cardId of cardIds) {
    const stored = storedConsensus[cardId]?.consensusPriceCents ?? null;
    const recomputedResult = aggregate(cardId, agentSignals, reputationWeights);
    const recomputed = recomputedResult?.consensusPriceCents ?? null;
    if (stored !== recomputed) {
      mismatches.push({ cardId, stored, recomputed });
    }
  }

  return { blobId, ok: mismatches.length === 0, mismatches };
}

export function getLatestBundle() {
  const p = join(MEMWAL_ROOT, 'shared', 'evidence', 'latest-bundle.json');
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, 'utf8'));
}

export function getBlobLog() {
  return loadBlobLog();
}

// CLI: node walrus-evidence.mjs upload
// CLI: node walrus-evidence.mjs read <blobId>
// CLI: node walrus-evidence.mjs verify <blobId>
// CLI: node walrus-evidence.mjs log
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];

  if (cmd === 'upload') {
    const bundle = getLatestBundle();
    if (!bundle) { console.error('No evidence bundle found. Run swarm.mjs first.'); process.exit(1); }
    console.log(`Uploading ${Buffer.byteLength(JSON.stringify(bundle), 'utf8')} bytes to Walrus...`);
    const result = await uploadEvidence(bundle);
    console.log('Uploaded!');
    console.log(`  Blob ID:  ${result.blobId}`);
    console.log(`  Verified: ${result.verified}`);
    console.log(`  View:     ${result.aggregatorUrl}`);
    console.log(`  Object:   ${result.objectId}`);
  } else if (cmd === 'read') {
    const blobId = process.argv[3];
    if (!blobId) { console.error('Usage: node walrus-evidence.mjs read <blobId>'); process.exit(1); }
    const data = await readEvidence(blobId);
    console.log(JSON.stringify(data, null, 2));
  } else if (cmd === 'verify') {
    const blobId = process.argv[3];
    if (!blobId) { console.error('Usage: node walrus-evidence.mjs verify <blobId>'); process.exit(1); }
    const check = await verifyEvidence(blobId);
    console.log(`Blob:     ${check.blobId}`);
    console.log(`Verified: ${check.ok ? 'OK — recomputed consensus matches stored' : 'FAILED'}`);
    if (!check.ok) {
      for (const m of check.mismatches) {
        console.log(`  ${m.cardId}: stored=${m.stored} recomputed=${m.recomputed}`);
      }
      process.exit(1);
    }
  } else if (cmd === 'log') {
    const log = getBlobLog();
    if (log.length === 0) { console.log('No blobs uploaded yet.'); process.exit(0); }
    for (const entry of log) {
      const v = entry.verified === true ? '✓' : entry.verified === false ? '✗' : '?';
      console.log(`${entry.timestamp}  ${v}  ${entry.blobId?.slice(0, 20)}…  ${entry.size}B  ${entry.cardIds?.join(', ')}`);
    }
  } else {
    console.log('Usage: node walrus-evidence.mjs <upload|read|verify|log>');
  }
}
