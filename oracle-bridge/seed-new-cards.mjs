#!/usr/bin/env node
/// seed-new-cards.mjs — Register + create + seed the two replacement markets
/// (Typhlosion, Dark Raichu) settling in tUSD. Each market is created in its OWN
/// transaction so the resulting Market objectId maps unambiguously to its card.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction } from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';
import { writeFileSync } from 'fs';

const DAY = 86_400_000;
const EXPIRY_MS = Date.now() + 30 * DAY;
const tUSD = (n) => Math.round(n * 1e9);

const CARDS = [
  { productId: 'neo1-1st-18', name: 'Typhlosion',  set: 'Neo Genesis — 1st Edition', number: '18', grader: 'PSA', grade: 10, strikeCents: 400000, platforms: 10, seedYes: 600, seedNo: 250 },
  { productId: 'base5-1st-83', name: 'Dark Raichu', set: 'Team Rocket — 1st Edition', number: '83', grader: 'PSA', grade: 10, strikeCents: 600000, platforms: 10, seedYes: 540, seedNo: 220 },
];

const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));

async function main() {
  const me = getAddress();
  const client = getClient();
  console.log(`Deployer: ${me}\nPackage:  ${CONFIG.packageId}\n`);

  for (const c of CARDS) {
    const assetId = toAssetId(c.productId, c.grader, c.grade);
    // 1. register asset (idempotent)
    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${CONFIG.packageId}::registry::register_asset`,
        arguments: [
          tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId),
          pureVec(tx, assetId), pureVec(tx, c.set), pureVec(tx, c.number),
          pureVec(tx, c.grader), tx.pure.u64(gradeToBps(c.grade)), tx.pure.u64(c.platforms),
        ],
      });
      const r = await executeTransaction(tx);
      console.log(`✓ Registered ${assetId} (${r.digest})`);
    } catch (e) {
      console.log(`⊘ ${assetId} register: ${e.message.slice(0, 90)}`);
    }

    // 2. create market — own tx → unambiguous id
    const desc = `Will ${c.grader} ${c.grade} ${c.name} exceed $${(c.strikeCents / 100).toLocaleString()} by ${new Date(EXPIRY_MS).toLocaleDateString()}?`;
    const tx2 = new Transaction();
    tx2.moveCall({
      target: `${CONFIG.packageId}::market::create_market`,
      arguments: [
        tx2.object(CONFIG.adminCapId), tx2.object(CONFIG.registryId),
        pureVec(tx2, assetId), tx2.pure.u64(c.strikeCents), tx2.pure.u64(EXPIRY_MS),
        pureVec(tx2, desc), tx2.object(CONFIG.clockId),
      ],
    });
    const created = await executeTransaction(tx2);
    c.marketId = (created.objectChanges || []).find(
      (o) => o.type === 'created' && o.objectType?.endsWith('::market::Market')
    )?.objectId;
    console.log(`✓ Market ${c.name}: ${c.marketId} (strike $${c.strikeCents / 100})`);
  }

  // 3. mint enough tUSD
  const need = CARDS.reduce((s, c) => s + c.seedYes + c.seedNo, 0) + 100;
  const txMint = new Transaction();
  txMint.moveCall({ target: `${CONFIG.packageId}::test_usd::mint`, arguments: [txMint.object(CONFIG.faucetId), txMint.pure.u64(tUSD(need))] });
  await executeTransaction(txMint);
  console.log(`✓ Minted ${need} tUSD`);

  // 4. seed positions (one PTB)
  await new Promise((r) => setTimeout(r, 1500));
  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  // merge coins if fragmented, else use the largest
  const coinId = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0].coinObjectId;
  const tx3 = new Transaction();
  if (coins.data.length > 1) tx3.mergeCoins(tx3.object(coinId), coins.data.slice(1).map((c) => tx3.object(c.coinObjectId)));
  const amts = CARDS.flatMap((c) => [tUSD(c.seedYes), tUSD(c.seedNo)]);
  const parts = tx3.splitCoins(tx3.object(coinId), amts);
  CARDS.forEach((c, i) => {
    tx3.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [tx3.object(c.marketId), parts[i * 2], tx3.object(CONFIG.clockId)] });
    tx3.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [tx3.object(c.marketId), parts[i * 2 + 1], tx3.object(CONFIG.clockId)] });
  });
  const seeded = await executeTransaction(tx3);
  console.log(`✓ Seeded positions (${seeded.digest})`);

  const out = CARDS.map((c) => ({
    productId: c.productId, name: c.name, set: c.set, number: c.number,
    grader: c.grader, grade: c.grade, strikeUsdCents: c.strikeCents,
    assetId: toAssetId(c.productId, c.grader, c.grade), marketId: c.marketId,
  }));
  writeFileSync(new URL('./new-markets.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log('\n=== DONE ===');
  out.forEach((m) => console.log(`  ${m.name.padEnd(14)} ${m.marketId}  strike $${(m.strikeUsdCents / 100).toLocaleString()}`));
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
