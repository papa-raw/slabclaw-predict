#!/usr/bin/env node
/// stage-darkraichu-disputed.mjs — reproduce the Dark Raichu DISPUTED demo market
/// on a freshly-published package, byte-for-byte with the prior live state:
///   register base5-1st-83 → widen dispute window to 110d (covers judging) →
///   create $6,000 market (short expiry) → seed 540 YES / 220 NO → wait expiry →
///   propose $7,986.56 / 3 sources with the keeper-durable Walrus evidence blob →
///   dispute with a 10,000 tUSD bond → restore the 24h governance window.
///
/// Run AFTER config.mjs is updated with the new package + oracleCap + config IDs.
/// Prints the new market id + the constants.js DEMO_MARKETS entry.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction, proposeResolution } from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';

const DAY = 86_400_000;
const tUSD = (n) => Math.round(n * 1e9);
const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Execute + wait for the tx to land so the NEXT tx sees the fresh version of any
// owned object it consumes (AdminCap/coins). Avoids the version-race abort.
async function execWait(tx) {
  const r = await executeTransaction(tx);
  await getClient().waitForTransaction({ digest: r.digest });
  return r;
}

const CARD = {
  productId: 'base5-1st-83', name: 'Dark Raichu', set: 'Team Rocket — 1st Edition',
  number: '83', grader: 'PSA', grade: 10, strikeCents: 600000, platforms: 10,
  seedYes: 540, seedNo: 220,
};
const EVIDENCE_BLOB = process.argv[2] || '2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA';
const PRICE_CENTS = 798656;   // $7,986.56 consensus (3 families) — above $6,000 strike → YES
const SOURCES = 3;
const BOND = 10_000;          // 10,000 tUSD (>= MIN_DISPUTE_BOND)
const LONG_WINDOW = 110 * DAY;

async function setWindow(ms, label) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${CONFIG.packageId}::registry::set_dispute_window_ms`,
    arguments: [tx.object(CONFIG.adminCapId), tx.object(CONFIG.configId), tx.pure.u64(ms)],
  });
  await execWait(tx);
  console.log(`   dispute window → ${label}`);
}

async function main() {
  const me = getAddress();
  const client = getClient();
  const assetId = toAssetId(CARD.productId, CARD.grader, CARD.grade);
  console.log(`Deployer ${me}\nPackage  ${CONFIG.packageId}\nEvidence ${EVIDENCE_BLOB}\n`);

  // 1. register the asset (fresh registry is empty)
  try {
    const tx = new Transaction();
    tx.moveCall({ target: `${CONFIG.packageId}::registry::register_asset`, arguments: [
      tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId), pureVec(tx, assetId),
      pureVec(tx, CARD.set), pureVec(tx, CARD.number), pureVec(tx, CARD.grader),
      tx.pure.u64(gradeToBps(CARD.grade)), tx.pure.u64(CARD.platforms),
    ] });
    await execWait(tx);
    console.log(`1) registered ${assetId}`);
  } catch (e) { console.log(`1) register: ${e.message.slice(0, 70)}`); }

  // 2. widen the dispute window so the proposal snapshots a window that covers judging
  await setWindow(LONG_WINDOW, `${LONG_WINDOW / DAY} days`);

  // 3. create the market with a short expiry, then seed
  const expiry = Date.now() + 50_000;
  const desc = `Will PSA 10 Dark Raichu exceed $6,000?`;
  const txC = new Transaction();
  txC.moveCall({ target: `${CONFIG.packageId}::market::create_market`, arguments: [
    txC.object(CONFIG.adminCapId), txC.object(CONFIG.registryId), pureVec(txC, assetId),
    txC.pure.u64(CARD.strikeCents), txC.pure.u64(expiry), pureVec(txC, desc), txC.object(CONFIG.clockId),
  ] });
  const rC = await execWait(txC);
  const marketId = (rC.objectChanges || []).find((o) => o.type === 'created' && o.objectType?.endsWith('::market::Market'))?.objectId;
  console.log(`3) created market ${marketId}`);

  const need = CARD.seedYes + CARD.seedNo + BOND + 100;
  const txM = new Transaction();
  txM.moveCall({ target: `${CONFIG.packageId}::test_usd::mint`, arguments: [txM.object(CONFIG.faucetId), txM.pure.u64(tUSD(need))] });
  await execWait(txM);
  await sleep(1500);

  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  const sorted = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance));
  const txS = new Transaction();
  if (sorted.length > 1) txS.mergeCoins(txS.object(sorted[0].coinObjectId), sorted.slice(1).map((c) => txS.object(c.coinObjectId)));
  const [yes, no] = txS.splitCoins(txS.object(sorted[0].coinObjectId), [tUSD(CARD.seedYes), tUSD(CARD.seedNo)]);
  txS.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [txS.object(marketId), yes, txS.object(CONFIG.clockId)] });
  txS.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [txS.object(marketId), no, txS.object(CONFIG.clockId)] });
  await execWait(txS);
  console.log(`   seeded ${CARD.seedYes} YES / ${CARD.seedNo} NO`);

  // 4. wait for expiry, then propose with evidence
  const wait = expiry - Date.now() + 2500;
  if (wait > 0) { console.log(`4) waiting ${Math.ceil(wait / 1000)}s for expiry…`); await sleep(wait); }
  const rP = await proposeResolution({ oracleCapId: CONFIG.oracleCapId, marketId, priceUsdCents: PRICE_CENTS, sourcesCount: SOURCES, evidenceBlobId: EVIDENCE_BLOB });
  await client.waitForTransaction({ digest: rP.digest });
  console.log(`   proposed $${(PRICE_CENTS / 100).toLocaleString()} / ${SOURCES} sources with evidence`);

  // 5. dispute with a bond → DISPUTED
  await sleep(1500);
  const coins2 = (await client.getCoins({ owner: me, coinType: CONFIG.testUsdType })).data.sort((a, b) => Number(b.balance) - Number(a.balance));
  const txD = new Transaction();
  if (coins2.length > 1) txD.mergeCoins(txD.object(coins2[0].coinObjectId), coins2.slice(1).map((c) => txD.object(c.coinObjectId)));
  const [bond] = txD.splitCoins(txD.object(coins2[0].coinObjectId), [tUSD(BOND)]);
  txD.moveCall({ target: `${CONFIG.packageId}::market::dispute`, arguments: [txD.object(marketId), bond, txD.object(CONFIG.clockId)] });
  await execWait(txD);
  console.log(`5) DISPUTED with ${BOND.toLocaleString()} tUSD bond`);

  // 6. restore the governance window to 24h (only this proposal keeps its snapshotted 110d)
  await setWindow(DAY, '24h (restored)');

  // verify + print
  const obj = await client.getObject({ id: marketId, options: { showContent: true } });
  const f = obj.data.content.fields;
  console.log(`\n=== Dark Raichu DISPUTED ===`);
  console.log(`state=${f.state?.variant ?? f.state}  disputer=${f.disputer ? 'set' : '-'}  bond=${f.dispute_bond}  evidence=${Buffer.from(f.evidence_blob_id).toString().slice(0, 20)}…`);
  console.log(`dispute window open ${((Number(f.dispute_deadline_ms) - Date.now()) / DAY).toFixed(0)} more days`);
  console.log(`\nconstants.js DEMO_MARKETS entry:`);
  console.log(JSON.stringify({
    id: marketId, assetId, name: CARD.name, set: CARD.set, year: 2000, number: CARD.number,
    grader: CARD.grader, grade: CARD.grade, strikeUsdCents: CARD.strikeCents,
    edition: '1st Edition', language: 'en', image: 'https://images.pokemontcg.io/base5/83.png', productId: CARD.productId,
  }, null, 2));
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
