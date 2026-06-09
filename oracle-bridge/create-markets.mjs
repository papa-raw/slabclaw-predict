#!/usr/bin/env node
/// create-markets.mjs — Stand up the 4 demo markets on the hardened+verified package.
/// Decoupled from the swarm: register assets → create markets (ACTIVE, future expiry)
/// → mint tUSD → seed YES/NO positions → write deployed-markets.json.
/// The evidence-bearing proposal is a separate step (propose-resolution / reseed-and-prove)
/// that runs once the swarm has ≥3 realized sources for a card.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction } from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';
import { writeFileSync } from 'fs';

const DAY = 86_400_000;
const FUTURE = Date.now() + 30 * DAY;
const tUSD = (n) => Math.round(n * 1e9);
const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CARDS = [
  { productId: 'neo1-1st-18',  name: 'Typhlosion',     set: 'Neo Genesis — 1st Edition', number: '18',  grader: 'PSA', grade: 10, strikeCents: 400000,  platforms: 10, seedYes: 600, seedNo: 250 },
  { productId: 'jp-vs-091',    name: "Karen's Umbreon", set: 'Pokémon Card VS — 1st Ed',   number: '091', grader: 'PSA', grade: 10, strikeCents: 1500000, platforms: 10, seedYes: 800, seedNo: 300 },
  { productId: 'base5-1st-83', name: 'Dark Raichu',     set: 'Team Rocket — 1st Edition',  number: '83',  grader: 'PSA', grade: 10, strikeCents: 600000,  platforms: 10, seedYes: 540, seedNo: 220 },
  { productId: 'base2-1st-3',  name: 'Flareon',         set: 'Jungle — 1st Edition',       number: '3',   grader: 'PSA', grade: 10, strikeCents: 250000,  platforms: 10, seedYes: 420, seedNo: 380 },
];

async function main() {
  const me = getAddress();
  const client = getClient();
  console.log(`Deployer: ${me}`);
  console.log(`Package:  ${CONFIG.packageId}\n`);

  console.log('── Register assets + create markets ──');
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
    } catch (e) { console.log(`   register ${assetId}: ${e.message.slice(0, 70)}`); }

    c.expiryMs = FUTURE;
    const desc = `Will ${c.grader} ${c.grade} ${c.name} exceed $${(c.strikeCents / 100).toLocaleString()}?`;
    const tx2 = new Transaction();
    tx2.moveCall({ target: `${CONFIG.packageId}::market::create_market`, arguments: [
      tx2.object(CONFIG.adminCapId), tx2.object(CONFIG.registryId), pureVec(tx2, assetId),
      tx2.pure.u64(c.strikeCents), tx2.pure.u64(c.expiryMs), pureVec(tx2, desc), tx2.object(CONFIG.clockId),
    ] });
    const r = await executeTransaction(tx2);
    await client.waitForTransaction({ digest: r.digest });
    c.marketId = (r.objectChanges || []).find((o) => o.type === 'created' && o.objectType?.endsWith('::market::Market'))?.objectId;
    console.log(`   ${c.name.padEnd(16)} ${c.marketId}  strike ${usd(c.strikeCents)}`);
  }

  console.log('\n── Mint tUSD + seed positions ──');
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

  const out = CARDS.map((c) => ({
    productId: c.productId, name: c.name, set: c.set, number: c.number,
    grader: c.grader, grade: c.grade, strikeUsdCents: c.strikeCents,
    expiryMs: c.expiryMs, assetId: c.assetId, marketId: c.marketId,
  }));
  writeFileSync(new URL('./deployed-markets.json', import.meta.url), JSON.stringify(out, null, 2));

  console.log('\n========== SUMMARY ==========');
  console.log(`Package: ${CONFIG.packageId}`);
  out.forEach((m) => console.log(`  ${m.productId.padEnd(14)} ${m.marketId}  ${usd(m.strikeUsdCents)}`));
  console.log('\n✅ 4 ACTIVE markets live on the hardened package.');
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
