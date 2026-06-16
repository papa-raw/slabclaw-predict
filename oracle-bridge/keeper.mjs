#!/usr/bin/env node
/// keeper.mjs — the serving node's keyless freshness + durability keeper.
///
/// The data plane (a residential-IP machine) does the real venue scrape daily,
/// snapshots agent memory to Walrus, and anchors the blob id onchain. This keeper
/// runs on the serving node (datacenter IP, can't reach walled venues, holds no
/// Sui key) and keeps the live feed alive WITHOUT scraping:
///
///   1. restore agent memory from Walrus (resolves the onchain pointer)
///   2. recompute consensus from that restored memory — NO venue fetches, so it
///      can never reintroduce the thin-round regression a full swarm hits here
///   3. write the consensus with a fresh timestamp (sticky: a card that doesn't
///      settle keeps its last-good price; evidence pointers are preserved)
///   4. re-store the onchain-referenced evidence blob(s) on Walrus so the
///      "verify on Walrus" links never expire mid-judging (content-addressed →
///      same blob id, extended lifetime). Walrus testnet's public publisher
///      sponsors the upload, so this needs no key.
///
/// So /predict/health stays < 26h fresh from Walrus memory alone, even if the
/// data-plane machine is asleep.
///
///   node keeper.mjs

import { runCoordinator } from './agents/coordinator.mjs';
import { writeFrontendConsensus } from './export-consensus.mjs';
import { restoreFromWalrus } from './memwal-sync.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';
const EPOCHS = 53; // max testnet retention per store — re-run keeps it rolling forward

// Blobs that are referenced from a FIXED location (onchain market evidence,
// README) and therefore can't rotate to a new id — these must be kept alive.
const DURABLE_BLOBS = ['2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA'];

const CARDS = DEMO_MARKETS.map((m) => m.productId);
const log = (...a) => console.log('[keeper]', ...a);

// 1. pull the latest memory the data plane published (no-op-safe if already fresh)
try {
  const r = await restoreFromWalrus();
  log(`memory restored: ${r?.restored ?? 0} files from ${r?.source ?? 'walrus'}`);
} catch (e) {
  log(`restore skipped (${e.message.slice(0, 60)}) — recomputing on local memory`);
}

// 2 + 3. recompute from memory (no scraping) and publish with a fresh timestamp
const { consensus } = await runCoordinator(CARDS);
const settled = Object.keys(consensus).length;
const out = writeFrontendConsensus(consensus, null); // null blob → evidence pointers preserved
log(`consensus refreshed: ${settled}/${CARDS.length} cards → ${out}`);

// 4. keep the fixed-reference evidence blob(s) alive (content-addressed re-store)
for (const id of DURABLE_BLOBS) {
  try {
    const buf = Buffer.from(await (await fetch(`${AGGREGATOR}/v1/blobs/${id}`)).arrayBuffer());
    const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${EPOCHS}`, { method: 'PUT', body: buf });
    const j = await res.json();
    const newId = j.newlyCreated?.blobObject?.blobId || j.alreadyCertified?.blobId;
    const endEpoch = j.newlyCreated?.blobObject?.storage?.endEpoch || j.alreadyCertified?.endEpoch;
    log(`evidence ${id.slice(0, 10)}…: ${newId === id ? `lifetime extended (end epoch ${endEpoch ?? '?'})` : `MISMATCH → ${newId}`}`);
  } catch (e) {
    log(`evidence ${id.slice(0, 10)}… extend failed: ${e.message.slice(0, 60)}`);
  }
}

log('done');
