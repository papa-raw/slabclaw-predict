#!/usr/bin/env node
/// restage-dispute-demo.mjs — stand up a fresh PROPOSED Dark Raichu market whose
/// dispute window stays OPEN across the judging window (shortlist Jul 8, demo days
/// Jul 20-21), referencing the current thin_market-aware evidence blob.
///
/// The original PROPOSED market's 24h dispute window expired ~Jun 10, so the dispute
/// CTA (a core resolution-flow differentiator) is dead for judges. Fix: temporarily
/// widen the governance dispute window to 110 days, create+expire+propose a fresh
/// Dark Raichu market (the long window snapshots into it at proposal time), then
/// restore the 24h default for every other market.
///
/// Prints the new market id + evidence blob; update frontend/src/constants.js +
/// the README/deck/ArchitecturePage citations afterward.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction, proposeResolution } from './sui-client.mjs';
import { CONFIG, toAssetId } from './config.mjs';

const EVIDENCE_BLOB = process.argv[2] || '2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA';
const PRICE_CENTS = 798656;      // Dark Raichu consensus this round ($7,987, 3 families)
const STRIKE_CENTS = 600000;     // "exceed $6,000?" → settles YES
const SOURCES = 3;
const ASSET = toAssetId('base5-1st-83', 'PSA', 10);
const DAY = 86_400_000;
const LONG_WINDOW = 110 * DAY;   // covers Jul 8 + Jul 20-21 from today
const tUSD = (n) => Math.round(n * 1e9);
const vec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const client = getClient();
const me = getAddress();

async function exec(tx, label) {
  const r = await executeTransaction(tx);
  await client.waitForTransaction({ digest: r.digest });
  if (r.effects?.status?.status !== 'success') throw new Error(`${label} failed: ${r.effects?.status?.error}`);
  return r;
}
async function setWindow(ms) {
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::registry::set_dispute_window_ms`, arguments: [tx.object(CONFIG.adminCapId), tx.object(CONFIG.configId), tx.pure.u64(ms)] });
  await exec(tx, `set_dispute_window_ms(${ms})`);
}

console.log(`Operator ${me.slice(0, 12)}…  ·  evidence ${EVIDENCE_BLOB}\n`);

// 1. widen the dispute window so the new proposal's snapshotted window covers judging
await setWindow(LONG_WINDOW);
console.log(`1) dispute window → ${LONG_WINDOW / DAY} days`);

try {
  // 2. create a fresh Dark Raichu market with a short expiry
  const expiry = Date.now() + 45_000;
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::market::create_market`, arguments: [
    tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId), vec(tx, ASSET),
    tx.pure.u64(STRIKE_CENTS), tx.pure.u64(expiry),
    vec(tx, `Will PSA 10 Dark Raichu exceed $6,000?`), tx.object(CONFIG.clockId),
  ] });
  const r = await exec(tx, 'create_market');
  const marketId = (r.objectChanges || []).find((o) => o.type === 'created' && o.objectType?.endsWith('::market::Market'))?.objectId;
  console.log(`2) created market ${marketId}`);

  // 3. seed YES/NO positions so the pool + odds render in the demo
  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  if (!coins.data.length) {
    const m = new Transaction();
    m.moveCall({ target: `${CONFIG.packageId}::test_usd::mint`, arguments: [m.object(CONFIG.faucetId), m.pure.u64(tUSD(2000))] });
    await exec(m, 'mint'); await sleep(1500);
  }
  const cs = (await client.getCoins({ owner: me, coinType: CONFIG.testUsdType })).data.sort((a, b) => Number(b.balance) - Number(a.balance));
  const tx2 = new Transaction();
  const [yes, no] = tx2.splitCoins(tx2.object(cs[0].coinObjectId), [tUSD(540), tUSD(220)]);
  tx2.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [tx2.object(marketId), yes, tx2.object(CONFIG.clockId)] });
  tx2.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [tx2.object(marketId), no, tx2.object(CONFIG.clockId)] });
  await exec(tx2, 'seed positions');
  console.log(`3) seeded 540 YES / 220 NO`);

  // 4. wait for expiry, then propose with the fresh evidence blob
  console.log(`4) waiting for expiry…`);
  await sleep(50_000);
  await proposeResolution({ oracleCapId: CONFIG.oracleCapId, marketId, priceUsdCents: PRICE_CENTS, sourcesCount: SOURCES, evidenceBlobId: EVIDENCE_BLOB });
  console.log(`   proposed $${(PRICE_CENTS / 100).toLocaleString()} with evidence`);

  // 5. verify state + window
  const obj = await client.getObject({ id: marketId, options: { showContent: true } });
  const f = obj.data.content.fields;
  const deadlineDays = (Number(f.dispute_deadline_ms) - Date.now()) / DAY;
  console.log(`5) state=${f.state?.variant} · dispute window open ${deadlineDays.toFixed(0)} more days · evidence=${Buffer.from(f.evidence_blob_id).toString().slice(0, 16)}…`);

  console.log(`\n✅ NEW DARK RAICHU MARKET: ${marketId}`);
  console.log(`   evidence blob:  ${EVIDENCE_BLOB}`);
  console.log(`   → update constants.js base5-1st-83 id + the evidence-blob citations`);
} finally {
  // 6. always restore the 24h default
  await setWindow(DAY);
  console.log(`6) dispute window restored → 24h`);
}
