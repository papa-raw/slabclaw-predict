#!/usr/bin/env node
/// add-umbreon.mjs — Register Karen's Umbreon and create a prediction market.

import {
  getAddress,
  registerAsset,
  createMarket,
  executeTransaction,
} from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';
import { Transaction } from '@mysten/sui/transactions';

const CARD = {
  productId: 'jp-vs-091',
  name: "Karen's Umbreon",
  set: 'Pokemon Card VS',
  number: '091',
  grader: 'PSA',
  grade: 10,
  currentPrice: 1587917, // $15,879.17
  strikePrice: 1500000,  // $15,000 strike
  platforms: 5,
};

async function main() {
  const address = getAddress();
  console.log(`\nAdding Karen's Umbreon market`);
  console.log(`Deployer: ${address}`);

  // 1. Register asset
  const assetId = toAssetId(CARD.productId, CARD.grader, CARD.grade);
  console.log(`\nAsset ID: ${assetId}`);

  try {
    const result = await registerAsset({
      assetId,
      setName: CARD.set,
      cardNumber: CARD.number,
      grader: CARD.grader,
      gradeBps: gradeToBps(CARD.grade),
      platformCount: CARD.platforms,
    });
    console.log(`✓ Registered: ${CARD.name} → ${assetId}`);
    console.log(`  Tx: ${result.digest}`);
  } catch (err) {
    if (err.message.includes('already')) {
      console.log(`⊘ Already registered: ${assetId}`);
    } else {
      console.log(`Registration error (may already exist): ${err.message.slice(0, 100)}`);
    }
  }

  // 2. Create market — 30 days from now
  const expiryMs = Date.now() + (30 * 24 * 60 * 60 * 1000);
  const description = `Will ${CARD.grader} ${CARD.grade} ${CARD.name} exceed $${(CARD.strikePrice / 100).toLocaleString()} by ${new Date(expiryMs).toLocaleDateString()}?`;

  try {
    const result = await createMarket({
      assetId,
      strikeUsdCents: CARD.strikePrice,
      expiryMs,
      description,
    });

    const marketId = result.objectChanges?.find(c =>
      c.type === 'created' && c.objectType?.includes('Market')
    )?.objectId;

    console.log(`\n✓ Market created: ${description}`);
    console.log(`  Market ID: ${marketId}`);
    console.log(`  Tx: ${result.digest}`);

    // 3. Place demo positions
    console.log('\nPlacing demo positions...');

    // Buy 0.5 SUI YES
    const tx1 = new Transaction();
    const [coin1] = tx1.splitCoins(tx1.gas, [500_000_000]);
    tx1.moveCall({
      target: `${CONFIG.packageId}::market::buy_yes`,
      arguments: [tx1.object(marketId), coin1, tx1.object(CONFIG.clockId)],
    });
    const r1 = await executeTransaction(tx1);
    console.log(`  ✓ Bought 0.5 SUI YES (${r1.digest})`);

    // Buy 0.3 SUI NO
    const tx2 = new Transaction();
    const [coin2] = tx2.splitCoins(tx2.gas, [300_000_000]);
    tx2.moveCall({
      target: `${CONFIG.packageId}::market::buy_no`,
      arguments: [tx2.object(marketId), coin2, tx2.object(CONFIG.clockId)],
    });
    const r2 = await executeTransaction(tx2);
    console.log(`  ✓ Bought 0.3 SUI NO (${r2.digest})`);

    console.log(`\n=== DONE ===`);
    console.log(`Market ID: ${marketId}`);
    console.log(`Update frontend/src/constants.js with this ID.`);
  } catch (err) {
    console.error(`✗ Failed: ${err.message}`);
  }
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
