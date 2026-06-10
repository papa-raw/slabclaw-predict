#!/usr/bin/env node
/// prove-evidence-loop.mjs — Honest onchain evidence proof on the hardened package.
///
/// Runs the FULL swarm (9 base agents + 7 independent TinyFish venue agents),
/// computes consensus, uploads the redacted evidence bundle to Walrus, and — only
/// if a card legitimately clears the onchain MIN_SOURCES=3 gate with no wide
/// disagreement — creates a fresh short-expiry market and proposes its resolution
/// with the REAL source count and the REAL Walrus blob id. No fabricated counts:
/// if the swarm is thin right now, it reports that and leaves the 4 ACTIVE markets
/// untouched (the gate doing its job is the manipulation-resistance feature).

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
import { createTinyfishAgents } from './tinyfish-agents.mjs';

const tUSD = (n) => Math.round(n * 1e9);
const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CARDS = [
  { productId: 'neo1-1st-18',  name: 'Typhlosion',     set: 'Neo Genesis — 1st Edition', number: '18',  grader: 'PSA', grade: 10, strikeCents: 400000,  platforms: 10, seedYes: 600, seedNo: 250, image: 'https://images.pokemontcg.io/neo1/18.png' },
  { productId: 'jp-vs-091',    name: "Karen's Umbreon", set: 'Pokémon Card VS — 1st Edition', number: '091', grader: 'PSA', grade: 10, strikeCents: 1500000, platforms: 10, seedYes: 800, seedNo: 300, image: '/cards/jp-vs-091.jpg' },
  { productId: 'base5-1st-83', name: 'Dark Raichu',     set: 'Team Rocket — 1st Edition',  number: '83',  grader: 'PSA', grade: 10, strikeCents: 600000,  platforms: 10, seedYes: 540, seedNo: 220, image: 'https://images.pokemontcg.io/base5/83.png' },
  { productId: 'base2-1st-3',  name: 'Flareon',         set: 'Jungle — 1st Edition',       number: '3',   grader: 'PSA', grade: 10, strikeCents: 250000,  platforms: 10, seedYes: 420, seedNo: 380, image: 'https://images.pokemontcg.io/base2/3.png' },
];
const CARD_IDS = CARDS.map((c) => c.productId);

function decodeBytes(field) {
  if (field == null) return '';
  if (Array.isArray(field)) return Buffer.from(field).toString('utf8');
  if (typeof field === 'string') return Buffer.from(field, 'base64').toString('utf8');
  return '';
}

function allAgents() {
  const cfg = { slabclawApi: CONFIG.slabclawApi, cardIds: CARD_IDS, grader: 'PSA', grade: 10 };
  return [
    new EbayAgent(cfg), new CourtyardAgent(cfg), new TcgplayerAgent(cfg), new AltAgent(cfg),
    new CardmarketAgent(cfg), new BeezieAgent(cfg), new CollectorCryptAgent(cfg),
    new GoldinAgent(cfg), new PricechartingAgent(cfg),
    ...createTinyfishAgents(cfg),
  ];
}

async function main() {
  const me = getAddress();
  const client = getClient();
  console.log(`Deployer: ${me}`);
  console.log(`Package:  ${CONFIG.packageId}\n`);

  console.log('── 1. Full swarm: 9 base + 7 TinyFish venue agents → coordinator ──');
  await Promise.allSettled(allAgents().map((a) => a.run()));
  const { consensus, evidence } = await runCoordinator(CARD_IDS);
  for (const c of CARDS) {
    const k = consensus[c.productId];
    console.log(`   ${c.name.padEnd(16)} ${usd(k?.consensusPriceCents || 0).padEnd(10)} ${k?.sourceCount || 0} src  ${(k?.flags || []).join(',') || '—'}`);
  }

  console.log('\n── 2. Walrus: upload redacted evidence bundle ──');
  const up = await uploadEvidence(evidence);
  if (!up.blobId) throw new Error('Walrus upload returned no blobId');
  console.log(`   blobId:   ${up.blobId}  (verified: ${up.verified})`);
  console.log(`   view:     ${up.aggregatorUrl}`);

  // Settleable = 3+ agreeing sold-families (clean), OR a genuinely-rare card that
  // cleared the thin-market corroboration gate (2 agreeing families, rarity recorded).
  const settleable = (k) => k && k.consensusPriceCents > 0 && !(k.flags || []).includes('wide_disagreement')
    && !(k.flags || []).includes('insufficient_sources')
    && ((k.sourceCount || 0) >= CONFIG_MIN_SOURCES || (k.flags || []).includes('thin_market'));
  const eligible = CARDS
    .map((c) => ({ c, k: consensus[c.productId] }))
    .filter(({ k }) => settleable(k))
    .sort((a, b) => (b.k.sourceCount || 0) - (a.k.sourceCount || 0));

  if (eligible.length === 0) {
    console.log(`\n⚠️  No card has ≥${CONFIG_MIN_SOURCES} realized sources this run — the MIN_SOURCES gate correctly`);
    console.log('   refuses to settle on thin data. The 4 ACTIVE markets remain live and tradeable.');
    console.log('   Re-run when the swarm has fuller data to mint a PROPOSED + evidence demo market.');
    process.exit(0);
  }

  const { c: proof, k: pk } = eligible[0];
  console.log(`\n── 3. Proof card: ${proof.name} — ${usd(pk.consensusPriceCents)}, ${pk.sourceCount} REAL sources ──`);

  const assetId = toAssetId(proof.productId, proof.grader, proof.grade);
  const expiryMs = Date.now() + 60_000;

  try {
    const tx = new Transaction();
    tx.moveCall({ target: `${CONFIG.packageId}::registry::register_asset`, arguments: [
      tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId), pureVec(tx, assetId),
      pureVec(tx, proof.set), pureVec(tx, proof.number), pureVec(tx, proof.grader),
      tx.pure.u64(gradeToBps(proof.grade)), tx.pure.u64(proof.platforms),
    ] });
    const rr = await executeTransaction(tx); await client.waitForTransaction({ digest: rr.digest });
  } catch (e) { console.log(`   register (likely already exists): ${e.message.slice(0, 60)}`); }

  const desc = `Will ${proof.grader} ${proof.grade} ${proof.name} exceed $${(proof.strikeCents / 100).toLocaleString()}? [LIVE EVIDENCE]`;
  const txc = new Transaction();
  txc.moveCall({ target: `${CONFIG.packageId}::market::create_market`, arguments: [
    txc.object(CONFIG.adminCapId), txc.object(CONFIG.registryId), pureVec(txc, assetId),
    txc.pure.u64(proof.strikeCents), txc.pure.u64(expiryMs), pureVec(txc, desc), txc.object(CONFIG.clockId),
  ] });
  const rc = await executeTransaction(txc); await client.waitForTransaction({ digest: rc.digest });
  const marketId = (rc.objectChanges || []).find((o) => o.type === 'created' && o.objectType?.endsWith('::market::Market'))?.objectId;
  console.log(`   market: ${marketId}`);

  // seed
  const txMint = new Transaction();
  txMint.moveCall({ target: `${CONFIG.packageId}::test_usd::mint`, arguments: [txMint.object(CONFIG.faucetId), txMint.pure.u64(tUSD(proof.seedYes + proof.seedNo + 50))] });
  await executeTransaction(txMint); await sleep(1500);
  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  const sorted = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance));
  const txs = new Transaction();
  if (sorted.length > 1) txs.mergeCoins(txs.object(sorted[0].coinObjectId), sorted.slice(1).map((c) => txs.object(c.coinObjectId)));
  const [y, n] = txs.splitCoins(txs.object(sorted[0].coinObjectId), [tUSD(proof.seedYes), tUSD(proof.seedNo)]);
  txs.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [txs.object(marketId), y, txs.object(CONFIG.clockId)] });
  txs.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [txs.object(marketId), n, txs.object(CONFIG.clockId)] });
  await executeTransaction(txs);
  console.log(`   seeded ${proof.seedYes} YES / ${proof.seedNo} NO`);

  const waitMs = expiryMs - Date.now() + 2000;
  if (waitMs > 0) { console.log(`\n── 4. Waiting ${Math.ceil(waitMs / 1000)}s for expiry ──`); await sleep(waitMs); }

  console.log('\n── 5. propose_resolution WITH real count + Walrus evidence ──');
  const pr = await proposeResolution({
    oracleCapId: CONFIG.oracleCapId, marketId,
    priceUsdCents: pk.consensusPriceCents, sourcesCount: pk.sourceCount, evidenceBlobId: up.blobId,
  });
  console.log(`   proposed ${usd(pk.consensusPriceCents)} (${pk.sourceCount} sources) — ${pr.digest}`);

  await sleep(1500);
  const obj = await client.getObject({ id: marketId, options: { showContent: true } });
  const f = obj?.data?.content?.fields || {};
  const onchainBlob = decodeBytes(f.evidence_blob_id);
  const matches = onchainBlob === up.blobId;
  console.log(`\n── 6. Read back onchain ──`);
  console.log(`   state=${f.state} (1=PROPOSED)  proposed_price=${usd(Number(f.proposed_price))}  evidence_blob_id=${onchainBlob}`);
  console.log(`   matches uploaded blob: ${matches ? 'YES ✓' : 'NO ✗'}`);
  const vv = await verifyEvidence(up.blobId);
  console.log(`   verifyEvidence (recompute from blob): ${vv.ok ? 'OK ✓' : 'FAILED ✗'}`);

  console.log(`\n=== PROPOSED + EVIDENCE MARKET (update DEMO_MARKETS ${proof.productId}) ===`);
  console.log(JSON.stringify({ id: marketId, productId: proof.productId, blobId: up.blobId, sources: pk.sourceCount, priceCents: pk.consensusPriceCents }, null, 2));
  process.exit(matches && vv.ok ? 0 : 1);
}

const CONFIG_MIN_SOURCES = 3;
main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
