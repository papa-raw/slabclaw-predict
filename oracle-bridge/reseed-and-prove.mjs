#!/usr/bin/env node
/// reseed-and-prove.mjs — Re-seed the 4 demo markets on the evidence package AND
/// prove the full onchain-evidence loop end to end:
///   swarm → coordinator → redacted Walrus upload → create markets →
///   propose_resolution(WITH evidence blob) → read evidence_blob_id back onchain →
///   verifyEvidence (recompute consensus from the blob).
///
/// The proof card (≥3 live sources) is created with a short expiry, settled with
/// the real Walrus blob id, then we read the Market object back and assert its
/// onchain evidence_blob_id equals the blob we uploaded. This is the thing that
/// makes the submission a *Walrus* project: settlement is impossible without a
/// verifiable evidence artifact, and the reference lives onchain.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction, proposeResolution } from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';
import { uploadEvidence, verifyEvidence } from './walrus-evidence.mjs';
import { runCoordinator } from './agents/coordinator.mjs';
import { EbayAgent } from './agents/ebay-agent.mjs';
import { CourtyardAgent } from './agents/courtyard-agent.mjs';
import { TcgplayerAgent } from './agents/tcgplayer-agent.mjs';
import { AltAgent } from './agents/alt-agent.mjs';
import { CardmarketAgent } from './agents/cardmarket-agent.mjs';
import { BeezieAgent } from './agents/beezie-agent.mjs';
import { CollectorCryptAgent } from './agents/collector-crypt-agent.mjs';
import { GoldinAgent } from './agents/goldin-agent.mjs';
import { PricechartingAgent } from './agents/pricecharting-agent.mjs';
import { writeFileSync } from 'fs';

const DAY = 86_400_000;
const FUTURE = Date.now() + 30 * DAY;
const PROOF_EXPIRY = Date.now() + 45_000; // ~45s out
const tUSD = (n) => Math.round(n * 1e9);
const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The 4 demo markets (strikes mirror frontend DEMO_MARKETS).
const CARDS = [
  { productId: 'neo1-1st-18',  name: 'Typhlosion',     set: 'Neo Genesis — 1st Edition',   number: '18',  grader: 'PSA', grade: 10, strikeCents: 400000,  platforms: 10, seedYes: 600, seedNo: 250 },
  { productId: 'jp-vs-091',    name: "Karen's Umbreon", set: 'Pokémon Card VS — 1st Ed',     number: '091', grader: 'PSA', grade: 10, strikeCents: 1500000, platforms: 10, seedYes: 800, seedNo: 300 },
  { productId: 'base5-1st-83', name: 'Dark Raichu',     set: 'Team Rocket — 1st Edition',    number: '83',  grader: 'PSA', grade: 10, strikeCents: 600000,  platforms: 10, seedYes: 540, seedNo: 220 },
  { productId: 'base2-1st-3',  name: 'Flareon',         set: 'Jungle — 1st Edition',         number: '3',   grader: 'PSA', grade: 10, strikeCents: 250000,  platforms: 10, seedYes: 420, seedNo: 380 },
];
const CARD_IDS = CARDS.map((c) => c.productId);

function agents() {
  const cfg = { slabclawApi: CONFIG.slabclawApi, cardIds: CARD_IDS, grader: 'PSA', grade: 10 };
  return [
    new EbayAgent(cfg), new CourtyardAgent(cfg), new TcgplayerAgent(cfg), new AltAgent(cfg),
    new CardmarketAgent(cfg), new BeezieAgent(cfg), new CollectorCryptAgent(cfg),
    new GoldinAgent(cfg), new PricechartingAgent(cfg),
  ];
}

/// Decode a Sui RPC vector<u8> field (array of byte ints OR base64 string).
function decodeBytes(field) {
  if (field == null) return '';
  if (Array.isArray(field)) return Buffer.from(field).toString('utf8');
  if (typeof field === 'string') return Buffer.from(field, 'base64').toString('utf8');
  return '';
}

async function main() {
  const me = getAddress();
  const client = getClient();
  console.log(`Deployer: ${me}`);
  console.log(`Package:  ${CONFIG.packageId}\n`);

  // ── 1. Run the live swarm → consensus + evidence bundle ──────────────
  console.log('── 1. Swarm: 9 source agents → coordinator ──');
  await Promise.allSettled(agents().map((a) => a.run()));
  const { consensus, evidence } = await runCoordinator(CARD_IDS);
  for (const c of CARDS) {
    const k = consensus[c.productId];
    console.log(`   ${c.name.padEnd(16)} ${usd(k?.consensusPriceCents || 0).padEnd(10)} ${k?.sourceCount || 0} src  ${(k?.flags || []).join(',') || '—'}`);
  }

  // ── 2. Upload evidence to Walrus (redacted) ──────────────────────────
  console.log('\n── 2. Walrus: upload redacted evidence bundle ──');
  const up = await uploadEvidence(evidence);
  if (!up.blobId) throw new Error('Walrus upload returned no blobId — cannot prove onchain evidence');
  console.log(`   blobId:   ${up.blobId}`);
  console.log(`   verified: ${up.verified}  (verify-after-write)`);
  console.log(`   view:     ${up.aggregatorUrl}`);

  // ── 3. Pick the proof card: ≥3 sources, no wide disagreement ─────────
  const eligible = CARDS.filter((c) => {
    const k = consensus[c.productId];
    return k && k.consensusPriceCents > 0 && (k.sourceCount || 0) >= 3 && !(k.flags || []).includes('wide_disagreement');
  });
  if (eligible.length === 0) throw new Error('No card has ≥3 live sources right now — re-run when the swarm has fuller data');
  const proof = eligible.find((c) => c.productId === 'base5-1st-83') || eligible[0];
  console.log(`\n   Proof card (live settlement): ${proof.name} — ${usd(consensus[proof.productId].consensusPriceCents)}, ${consensus[proof.productId].sourceCount} sources`);

  // ── 4. Register + create the 4 markets (proof card = short expiry) ───
  console.log('\n── 4. Create markets ──');
  for (const c of CARDS) {
    const assetId = toAssetId(c.productId, c.grader, c.grade);
    c.assetId = assetId;
    try {
      const tx = new Transaction();
      tx.moveCall({ target: `${CONFIG.packageId}::registry::register_asset`, arguments: [
        tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId), pureVec(tx, assetId),
        pureVec(tx, c.set), pureVec(tx, c.number), pureVec(tx, c.grader),
        tx.pure.u64(gradeToBps(c.grade)), tx.pure.u64(c.platforms),
      ] });
      const rr = await executeTransaction(tx);
      await client.waitForTransaction({ digest: rr.digest });
    } catch (e) { console.log(`   register ${assetId}: ${e.message.slice(0, 60)}`); }

    const expiry = c.productId === proof.productId ? PROOF_EXPIRY : FUTURE;
    c.expiryMs = expiry;
    const desc = `Will ${c.grader} ${c.grade} ${c.name} exceed $${(c.strikeCents / 100).toLocaleString()}?`;
    const tx2 = new Transaction();
    tx2.moveCall({ target: `${CONFIG.packageId}::market::create_market`, arguments: [
      tx2.object(CONFIG.adminCapId), tx2.object(CONFIG.registryId), pureVec(tx2, assetId),
      tx2.pure.u64(c.strikeCents), tx2.pure.u64(expiry), pureVec(tx2, desc), tx2.object(CONFIG.clockId),
    ] });
    const r = await executeTransaction(tx2);
    await client.waitForTransaction({ digest: r.digest });
    c.marketId = (r.objectChanges || []).find((o) => o.type === 'created' && o.objectType?.endsWith('::market::Market'))?.objectId;
    console.log(`   ${c.name.padEnd(16)} ${c.marketId}  strike ${usd(c.strikeCents)}${expiry === PROOF_EXPIRY ? '  [PROOF · short expiry]' : ''}`);
  }

  // ── 5. Mint tUSD + seed positions ────────────────────────────────────
  console.log('\n── 5. Seed positions ──');
  const need = CARDS.reduce((s, c) => s + c.seedYes + c.seedNo, 0) + 100;
  const txMint = new Transaction();
  txMint.moveCall({ target: `${CONFIG.packageId}::test_usd::mint`, arguments: [txMint.object(CONFIG.faucetId), txMint.pure.u64(tUSD(need))] });
  await executeTransaction(txMint);
  await sleep(1500);
  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  const coinId = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0].coinObjectId;
  const tx3 = new Transaction();
  if (coins.data.length > 1) tx3.mergeCoins(tx3.object(coinId), coins.data.slice(1).map((c) => tx3.object(c.coinObjectId)));
  const amts = CARDS.flatMap((c) => [tUSD(c.seedYes), tUSD(c.seedNo)]);
  const parts = tx3.splitCoins(tx3.object(coinId), amts);
  CARDS.forEach((c, i) => {
    tx3.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [tx3.object(c.marketId), parts[i * 2], tx3.object(CONFIG.clockId)] });
    tx3.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [tx3.object(c.marketId), parts[i * 2 + 1], tx3.object(CONFIG.clockId)] });
  });
  await executeTransaction(tx3);
  console.log('   seeded YES/NO on all 4 markets');

  // ── 6. Wait for proof expiry, then propose WITH evidence ─────────────
  const waitMs = proof.expiryMs - Date.now() + 2000;
  if (waitMs > 0) { console.log(`\n── 6. Waiting ${Math.ceil(waitMs / 1000)}s for proof market to expire ──`); await sleep(waitMs); }
  const pk = consensus[proof.productId];
  console.log(`\n── 7. propose_resolution WITH Walrus evidence ──`);
  const pr = await proposeResolution({
    oracleCapId: CONFIG.oracleCapId,
    marketId: proof.marketId,
    priceUsdCents: pk.consensusPriceCents,
    sourcesCount: pk.sourceCount,
    evidenceBlobId: up.blobId,
  });
  console.log(`   proposed ${usd(pk.consensusPriceCents)} (${pk.sourceCount} sources) — ${pr.digest}`);

  // ── 8. Read the Market back onchain → assert evidence_blob_id ────────
  await sleep(1500);
  const obj = await client.getObject({ id: proof.marketId, options: { showContent: true } });
  const f = obj?.data?.content?.fields || {};
  const onchainBlob = decodeBytes(f.evidence_blob_id);
  const matches = onchainBlob === up.blobId;
  console.log(`\n── 8. Read back onchain ──`);
  console.log(`   market.state           = ${f.state} (1 = PROPOSED / dispute window)`);
  console.log(`   market.proposed_price  = ${usd(Number(f.proposed_price))}`);
  console.log(`   market.evidence_blob_id= ${onchainBlob}`);
  console.log(`   matches uploaded blob  = ${matches ? 'YES ✓' : 'NO ✗'}`);

  // ── 9. Independent verify: recompute consensus from the blob ─────────
  const vv = await verifyEvidence(up.blobId);
  console.log(`\n── 9. verifyEvidence (recompute from blob) ──`);
  console.log(`   ${vv.ok ? 'OK ✓ — recomputed consensus matches stored' : 'FAILED ✗ ' + JSON.stringify(vv.mismatches)}`);

  // ── 10. Persist new market map ───────────────────────────────────────
  const out = CARDS.map((c) => ({
    productId: c.productId, name: c.name, set: c.set, number: c.number,
    grader: c.grader, grade: c.grade, strikeUsdCents: c.strikeCents,
    expiryMs: c.expiryMs, assetId: c.assetId, marketId: c.marketId,
  }));
  writeFileSync(new URL('./deployed-markets.json', import.meta.url), JSON.stringify(out, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(`Package:   ${CONFIG.packageId}`);
  out.forEach((m) => console.log(`  ${m.productId.padEnd(14)} ${m.marketId}  ${usd(m.strikeUsdCents)}`));
  console.log(`\nProof: ${proof.name} settled with onchain evidence ${up.blobId}`);
  const PASS = matches && vv.ok;
  console.log(PASS ? '\n✅ ONCHAIN EVIDENCE LOOP: PASS' : '\n❌ ONCHAIN EVIDENCE LOOP: FAIL');
  process.exit(PASS ? 0 : 1);
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
