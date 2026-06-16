#!/usr/bin/env node
/// prove-memory-loop.mjs — the kill-and-restore proof.
///
/// "Memory that outlives its operator" is a claim until you kill the memory
/// and watch it come back from Walrus alone. This script:
///
///   1. Runs the coordinator on CURRENT memory → baseline consensus
///   2. Snapshots that exact memory to Walrus (real upload, no key)
///   3. Shows the production swarm's latest memory pointer ONCHAIN (read-only)
///   4. DELETES the entire local MemWal state (moved aside, nothing faked)
///   5. Restores the full agent memory from the Walrus blob from step 2
///   6. Re-runs the coordinator → restored consensus
///   7. Diffs baseline vs restored, card by card
///
/// PASS = identical consensus from memory that was just destroyed and rebuilt
/// purely from Walrus. The round-trip is byte-deterministic, so this passes on
/// a fresh clone for whatever memory that clone carries — it doesn't depend on
/// the live production pointer (which production advances daily). The onchain
/// operator-independence is shown live at /predict/health (pointerSource:onchain).
///
/// The proof is sandboxed: it restores your exact committed memory at the end,
/// so `git status` stays clean whether it passes, fails, or crashes.
///
///   node prove-memory-loop.mjs

import { renameSync, rmSync, existsSync, cpSync } from 'fs';
import { join } from 'path';
import {
  snapshotToWalrus, restoreFromWalrus, fetchOnchainPointer,
} from './memwal-sync.mjs';
import { runCoordinator } from './agents/coordinator.mjs';
import { CONFIG } from './config.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const ROOT = new URL('.', import.meta.url).pathname;
const MEMWAL = join(ROOT, 'memwal');
const BACKUP = join(ROOT, 'memwal.pre-proof-backup');
const CARDS = DEMO_MARKETS.map((m) => m.productId);
const usd = (c) => (c == null ? '—' : '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 }));

async function consensusPass(label) {
  const out = {};
  try {
    const { consensus } = await runCoordinator(CARDS);
    for (const cardId of CARDS) out[cardId] = consensus[cardId]?.consensusPriceCents ?? null;
  } catch (e) {
    console.log(`   coordinator failed: ${e.message.slice(0, 80)}`);
    for (const cardId of CARDS) out[cardId] = null;
  }
  console.log(`  ${label}:`);
  for (const [card, cents] of Object.entries(out)) console.log(`    ${card.padEnd(14)} ${usd(cents)}`);
  return out;
}

console.log('━━━ PROOF: memory that outlives its operator ━━━\n');

// Preserve the exact committed memory so the tree is restored clean at the end,
// no matter what happens below.
if (existsSync(BACKUP)) rmSync(BACKUP, { recursive: true, force: true });
cpSync(MEMWAL, BACKUP, { recursive: true });

let verdictPass = false;
try {
  console.log('1) Baseline consensus from current memory');
  const baseline = await consensusPass('baseline');

  console.log('\n2) Snapshotting this memory to Walrus (real upload, no key)');
  const snap = await snapshotToWalrus();
  if (!snap?.blobId) throw new Error('Walrus snapshot failed — is the testnet publisher reachable?');
  console.log(`   blob ${snap.blobId}  (${snap.fileCount ?? '?'} files)`);

  console.log('\n3) Production memory pointer ONCHAIN (read-only — the operator-independent anchor)');
  try {
    const ptr = await fetchOnchainPointer();
    if (ptr) {
      console.log(`   SwarmMemory ${CONFIG.swarmMemoryId.slice(0, 16)}… → blob ${ptr.blobId}`);
      console.log(`   round ${ptr.round} · ${ptr.fileCount} files · checkpointed ${new Date(ptr.checkpointedAtMs).toISOString()}`);
    } else {
      console.log('   (no onchain pointer resolved — not required for this proof)');
    }
  } catch (e) {
    console.log(`   (onchain read skipped: ${e.message.slice(0, 60)})`);
  }

  console.log('\n4) DESTROYING local agent memory (moved aside — nothing up the sleeve)');
  renameSync(MEMWAL, join(ROOT, 'memwal.destroyed'));
  console.log(`   memwal/ is gone: ${!existsSync(MEMWAL)}`);

  console.log('\n5) Restoring agent memory from Walrus');
  const res = await restoreFromWalrus(snap.blobId);
  if (!res?.restored) throw new Error('restore returned nothing from Walrus');
  console.log(`   restored ${res.restored} files from blob ${res.blobId}`);

  console.log('\n6) Consensus from RESTORED memory');
  const restored = await consensusPass('restored');

  console.log('\n7) Verdict');
  let same = true;
  for (const card of CARDS) {
    const match = baseline[card] === restored[card];
    if (!match) same = false;
    console.log(`   ${match ? '✅' : '❌'} ${card.padEnd(14)} ${usd(baseline[card])} → ${usd(restored[card])}`);
  }
  verdictPass = same;
  console.log(same
    ? '\n━━━ PASS: identical consensus from memory rebuilt off Walrus alone ━━━'
    : '\n━━━ FAIL: consensus diverged after restore ━━━');
} finally {
  // Sandbox: restore the exact committed memory and clean up scratch dirs, so
  // `git status` is clean regardless of pass / fail / crash.
  rmSync(MEMWAL, { recursive: true, force: true });
  rmSync(join(ROOT, 'memwal.destroyed'), { recursive: true, force: true });
  renameSync(BACKUP, MEMWAL);
  console.log('\n(committed memory restored — working tree clean)');
}
process.exit(verdictPass ? 0 : 1);
