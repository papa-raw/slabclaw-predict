#!/usr/bin/env node
/// prove-memory-loop.mjs — the kill-and-restore proof.
///
/// "Memory that outlives its operator" is a claim until you kill the memory
/// and watch it come back from chain + Walrus alone. This script:
///
///   1. Runs the coordinator on CURRENT memory → baseline consensus
///   2. DELETES the entire MemWal state (moved aside, nothing faked)
///   3. Reads the SwarmMemory object ONCHAIN for the latest snapshot blob id
///   4. Restores the full agent memory from that Walrus blob
///   5. Re-runs the coordinator → restored consensus
///   6. Diffs baseline vs restored, card by card
///
/// PASS = identical consensus from memory that was just destroyed and rebuilt
/// purely from public infrastructure. No local files, no operator disk.
///
///   node prove-memory-loop.mjs

import { renameSync, rmSync, existsSync } from 'fs';
import { join } from 'path';
import { fetchOnchainPointer, restoreFromWalrus } from './memwal-sync.mjs';
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

console.log('1) Baseline consensus from current memory');
const baseline = await consensusPass('baseline');

console.log('\n2) DESTROYING local agent memory (moved aside — nothing up the sleeve)');
if (existsSync(BACKUP)) rmSync(BACKUP, { recursive: true, force: true });
renameSync(MEMWAL, BACKUP);
console.log(`   memwal/ is gone: ${!existsSync(MEMWAL)}`);

let verdictPass = false;
try {
  console.log('\n3) Reading the SwarmMemory pointer ONCHAIN');
  const ptr = await fetchOnchainPointer();
  if (!ptr) throw new Error('no onchain pointer — has a checkpoint been written?');
  console.log(`   object ${CONFIG.swarmMemoryId.slice(0, 16)}… → blob ${ptr.blobId}`);
  console.log(`   round ${ptr.round} · ${ptr.fileCount} files · checkpointed ${new Date(ptr.checkpointedAtMs).toISOString()}`);

  console.log('\n4) Restoring agent memory from Walrus');
  const res = await restoreFromWalrus(); // resolves the pointer onchain by itself
  console.log(`   restored ${res.restored} files (pointer source: ${res.source})`);

  console.log('\n5) Consensus from RESTORED memory');
  const restored = await consensusPass('restored');

  console.log('\n6) Verdict');
  let same = true;
  for (const card of CARDS) {
    const match = baseline[card] === restored[card];
    if (!match) same = false;
    console.log(`   ${match ? '✅' : '❌'} ${card.padEnd(14)} ${usd(baseline[card])} → ${usd(restored[card])}`);
  }
  verdictPass = same;
  console.log(same
    ? '\n━━━ PASS: identical consensus from memory rebuilt off chain + Walrus alone ━━━'
    : '\n━━━ FAIL: consensus diverged after restore ━━━');
} finally {
  // The restored state IS canonical; keep it. The backup stays for inspection.
  if (!existsSync(MEMWAL) && existsSync(BACKUP)) {
    renameSync(BACKUP, MEMWAL);
    console.log('\n(restore never completed — original memory moved back)');
  } else {
    console.log(`\n(pre-proof memory kept at memwal.pre-proof-backup/ for inspection)`);
  }
}
process.exit(verdictPass ? 0 : 1);
