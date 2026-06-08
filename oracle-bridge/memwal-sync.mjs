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

  const resp = await fetch(`${PUBLISHER}/v1/blobs?epochs=5`, {
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

export async function restoreFromWalrus(blobId) {
  if (!blobId) {
    const log = loadSyncLog();
    if (log.snapshots.length === 0) return null;
    blobId = log.snapshots[log.snapshots.length - 1].blobId;
    if (!blobId) return null;
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

  return { blobId, restored, timestamp: snapshot.timestamp };
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
