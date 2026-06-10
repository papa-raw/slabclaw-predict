#!/usr/bin/env node
/// memwal-sync.mjs — Walrus-backed MemWal persistence.
///
/// Snapshots the entire agent memory state to Walrus and restores on cold start.
/// Kill the process, restart on a new machine, restore from a blob ID — the
/// swarm picks up where it left off. This is what makes MemWal real: memory
/// that outlives its operator.
///
/// Usage:
///   import { snapshotToWalrus, restoreFromWalrus } from './memwal-sync.mjs';
///   const snap = await snapshotToWalrus();       // after each pass
///   const res  = await restoreFromWalrus();       // on cold start
///
/// CLI:
///   node memwal-sync.mjs snapshot          # upload current memory
///   node memwal-sync.mjs restore [blobId]  # restore (latest or specific)
///   node memwal-sync.mjs log               # list all snapshots

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const MEMWAL_ROOT = join(new URL('.', import.meta.url).pathname, 'memwal');
const SYNC_LOG = join(MEMWAL_ROOT, '.walrus-sync.json');
const UPLOAD_TIMEOUT_MS = 60_000;
const READ_TIMEOUT_MS = 30_000;
const MAX_PAYLOAD_BYTES = 10 * 1024 * 1024;

function walkDir(dir, base = dir) {
  const entries = [];
  for (const name of readdirSync(dir)) {
    if (name.startsWith('.')) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      entries.push(...walkDir(full, base));
    } else if (name.endsWith('.json')) {
      const rel = relative(base, full);
      try {
        entries.push({ path: rel, content: JSON.parse(readFileSync(full, 'utf8')) });
      } catch { /* skip malformed */ }
    }
  }
  return entries;
}

function memwalIsEmpty() {
  if (!existsSync(MEMWAL_ROOT)) return true;
  const items = readdirSync(MEMWAL_ROOT).filter(n => !n.startsWith('.'));
  return items.length === 0;
}

function loadSyncLog() {
  if (!existsSync(SYNC_LOG)) return { snapshots: [] };
  try { return JSON.parse(readFileSync(SYNC_LOG, 'utf8')); } catch { return { snapshots: [] }; }
}

function saveSyncLog(log) {
  mkdirSync(join(MEMWAL_ROOT), { recursive: true });
  writeFileSync(SYNC_LOG, JSON.stringify(log, null, 2));
}

export async function snapshotToWalrus() {
  const files = walkDir(MEMWAL_ROOT);
  if (files.length === 0) return null;

  const snapshot = {
    version: '1.0.0',
    type: 'memwal-snapshot',
    swarmId: 'slabclaw-oracle-swarm',
    timestamp: new Date().toISOString(),
    fileCount: files.length,
    files,
  };

  const payload = JSON.stringify(snapshot);
  const byteLength = Buffer.byteLength(payload, 'utf8');

  if (byteLength > MAX_PAYLOAD_BYTES) {
    console.warn(`  MemWal snapshot too large: ${(byteLength / 1024 / 1024).toFixed(2)}MB — skipping`);
    return null;
  }

  // 53 epochs ≈ max testnet retention — memory snapshots must outlive the judging window
  const resp = await fetch(`${PUBLISHER}/v1/blobs?epochs=53`, {
    method: 'PUT',
    body: payload,
    headers: { 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout?.(UPLOAD_TIMEOUT_MS),
  });

  if (!resp.ok) {
    const text = await resp.text().catch(() => '');
    throw new Error(`MemWal snapshot upload failed: ${resp.status} ${text.slice(0, 200)}`);
  }

  const result = await resp.json();
  const blobId = result.newlyCreated?.blobObject?.blobId
    || result.alreadyCertified?.blobId
    || null;

  const entry = {
    blobId,
    timestamp: snapshot.timestamp,
    fileCount: files.length,
    sizeBytes: byteLength,
    aggregatorUrl: blobId ? `${AGGREGATOR}/v1/blobs/${blobId}` : null,
  };

  if (blobId) {
    const log = loadSyncLog();
    log.snapshots.push(entry);
    if (log.snapshots.length > 20) log.snapshots = log.snapshots.slice(-20);
    saveSyncLog(log);
  }

  return entry;
}

/// Read the canonical memory pointer from the onchain SwarmMemory object.
/// Read-only RPC — works on machines that hold no key at all (e.g. the
/// production serving node). Returns null when unset/unreachable.
export async function fetchOnchainPointer() {
  const { CONFIG } = await import('./config.mjs');
  if (!CONFIG.swarmMemoryId) return null;
  try {
    const resp = await fetch(CONFIG.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'sui_getObject',
        params: [CONFIG.swarmMemoryId, { showContent: true }],
      }),
      signal: AbortSignal.timeout?.(READ_TIMEOUT_MS),
    });
    const fields = (await resp.json())?.result?.data?.content?.fields;
    if (!fields?.latest_blob_id?.length) return null;
    return {
      blobId: Buffer.from(fields.latest_blob_id).toString(),
      fileCount: Number(fields.file_count),
      checkpointedAtMs: Number(fields.checkpointed_at_ms),
      round: Number(fields.round),
    };
  } catch {
    return null;
  }
}

/// Anchor a snapshot onchain (memory::checkpoint on the SwarmMemory object).
/// Requires the oracle operator key — data-plane only; the serving node never
/// signs. Imported lazily so keyless machines can still use restore.
export async function checkpointOnchain(entry) {
  const { CONFIG } = await import('./config.mjs');
  if (!CONFIG.packageIdV2 || !CONFIG.swarmMemoryId || !entry?.blobId) return null;
  const { Transaction } = await import('@mysten/sui/transactions');
  const { getClient, executeTransaction } = await import('./sui-client.mjs');
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONFIG.packageIdV2}::memory::checkpoint`,
    arguments: [
      tx.object(CONFIG.oracleCapId),
      tx.object(CONFIG.swarmMemoryId),
      tx.pure.vector('u8', Array.from(Buffer.from(entry.blobId))),
      tx.pure.u64(entry.fileCount || 0),
      tx.object(CONFIG.clockId),
    ],
  });
  const res = await executeTransaction(tx);
  await getClient().waitForTransaction({ digest: res.digest });
  return { digest: res.digest, blobId: entry.blobId };
}

export async function restoreFromWalrus(blobId) {
  let source = 'explicit';
  if (!blobId) {
    // The ONCHAIN pointer is canonical — a fresh machine needs nothing but
    // chain + Walrus. The local sync log is only a fallback for offline work.
    const onchain = await fetchOnchainPointer();
    if (onchain?.blobId) {
      blobId = onchain.blobId;
      source = 'onchain';
    } else {
      const log = loadSyncLog();
      if (log.snapshots.length === 0) return null;
      blobId = log.snapshots[log.snapshots.length - 1].blobId;
      source = 'local-log';
      if (!blobId) return null;
    }
  }

  const resp = await fetch(`${AGGREGATOR}/v1/blobs/${blobId}`, {
    signal: AbortSignal.timeout?.(READ_TIMEOUT_MS),
  });

  if (!resp.ok) throw new Error(`MemWal restore failed: ${resp.status}`);

  const snapshot = await resp.json();
  if (snapshot.type !== 'memwal-snapshot') {
    throw new Error(`Not a MemWal snapshot (type: ${snapshot.type})`);
  }

  let restored = 0;
  for (const file of snapshot.files) {
    const fullPath = join(MEMWAL_ROOT, file.path);
    const dir = join(fullPath, '..');
    mkdirSync(dir, { recursive: true });
    writeFileSync(fullPath, JSON.stringify(file.content, null, 2));
    restored++;
  }

  // Provenance marker for /predict/health — which blob this node's memory
  // came from, and whether the pointer was resolved from chain.
  writeFileSync(join(MEMWAL_ROOT, '.restore-state.json'), JSON.stringify({
    blobId, source, restored, snapshotTimestamp: snapshot.timestamp,
    restoredAt: new Date().toISOString(),
  }, null, 2));

  return { blobId, restored, timestamp: snapshot.timestamp, source };
}

export function getLatestSnapshotBlobId() {
  const log = loadSyncLog();
  if (log.snapshots.length === 0) return null;
  return log.snapshots[log.snapshots.length - 1].blobId;
}

export { memwalIsEmpty };

// ── CLI ──────────────────────────────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];

  if (cmd === 'snapshot') {
    console.log('Snapshotting MemWal to Walrus...');
    const result = await snapshotToWalrus();
    if (result) {
      console.log(`  Blob ID: ${result.blobId}`);
      console.log(`  Files:   ${result.fileCount}`);
      console.log(`  Size:    ${(result.sizeBytes / 1024).toFixed(1)}KB`);
      console.log(`  View:    ${result.aggregatorUrl}`);
      // --checkpoint anchors the pointer onchain (needs the oracle key)
      if (process.argv.includes('--checkpoint')) {
        try {
          const cp = await checkpointOnchain(result);
          console.log(`  Onchain: SwarmMemory advanced (tx ${cp.digest})`);
        } catch (e) {
          console.error(`  Onchain checkpoint failed: ${e.message}`);
        }
      }
    } else {
      console.log('  Nothing to snapshot (empty memory).');
    }
  } else if (cmd === 'restore') {
    const id = process.argv[3];
    console.log(`Restoring MemWal from Walrus${id ? ` (${id.slice(0, 20)}…)` : ' (latest)'}...`);
    try {
      const result = await restoreFromWalrus(id);
      if (result) {
        console.log(`  Restored: ${result.restored} files from ${result.timestamp}`);
        console.log(`  Blob:     ${result.blobId}`);
        if (result.source) console.log(`  Pointer:  ${result.source === 'onchain' ? 'ONCHAIN SwarmMemory object' : result.source}`);
      } else {
        console.log('  No snapshot found.');
      }
    } catch (e) {
      console.error(`  Restore failed: ${e.message}`);
      process.exit(1);
    }
  } else if (cmd === 'log') {
    const log = loadSyncLog();
    if (log.snapshots.length === 0) { console.log('No snapshots yet.'); process.exit(0); }
    for (const s of log.snapshots) {
      console.log(`${s.timestamp}  ${s.fileCount} files  ${(s.sizeBytes / 1024).toFixed(1)}KB  ${s.blobId?.slice(0, 24)}…`);
    }
  } else {
    console.log('Usage: node memwal-sync.mjs <snapshot|restore [blobId]|log>');
  }
}
