#!/usr/bin/env node
/// demo.mjs — End-to-end demo of SlabClaw Predict on Sui testnet.
///
/// Runs the full lifecycle:
/// 1. Register asset classes (real cards from SlabClaw universe)
/// 2. Authorize oracle operator
/// 3. Create prediction markets
/// 4. Place YES/NO positions
/// 5. Propose resolution with real oracle prices
/// 6. (Optional) Dispute + admin resolve
/// 7. Finalize + claim winnings
///
/// Usage: node demo.mjs

import {
  getClient,
  getAddress,
  registerAsset,
  authorizeOracle,
  createMarket,
  proposeResolution,
  finalizeMarket,
  executeTransaction,
} from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps, priceToCents } from './config.mjs';
import { Transaction } from '@mysten/sui/transactions';

// ── Demo cards from SlabClaw universe ─────────────────────────────────

const DEMO_CARDS = [
  {
    productId: 'base1-4',
    name: 'Charizard',
    set: 'Base Set',
    number: '4',
    grader: 'PSA',
    grade: 10,
    // Real oracle price: ~$34,181 (non-1st edition)
    currentPrice: 3418125, // $34,181.25 in cents
    strikePrice: 700000,   // $7,000 strike
    platforms: 5,
  },
  {
    productId: 'jp-vs-091',
    name: "Karen's Umbreon",
    set: 'Pokemon Card VS',
    number: '091',
    grader: 'PSA',
    grade: 10,
    // Real oracle price: ~$15,879
    currentPrice: 1587917, // $15,879.17
    strikePrice: 1500000,  // $15,000 strike
    platforms: 5,
  },
  {
    productId: 'base3-1st-5',
    name: 'Gengar 1st Edition',
    set: 'Fossil',
    number: '5',
    grader: 'PSA',
    grade: 10,
    // Real oracle price: ~$155
    currentPrice: 15504,   // $155.04
    strikePrice: 15000,    // $150 strike
    platforms: 4,
  },
];

// ── Helpers ───────────────────────────────────────────────────────────

function log(step, msg) {
  console.log(`\n[${'='.repeat(60)}]`);
  console.log(`[STEP ${step}] ${msg}`);
  console.log(`[${'='.repeat(60)}]`);
}

function logResult(label, result) {
  console.log(`  ${label}: ${result.digest}`);
  if (result.events?.length) {
    result.events.forEach(e => {
      console.log(`  Event: ${e.type.split('::').pop()}`);
      if (e.parsedJson) {
        const json = e.parsedJson;
        // Show key fields
        for (const [k, v] of Object.entries(json)) {
          if (typeof v === 'string' && v.length > 40) continue; // skip long byte arrays
          console.log(`    ${k}: ${v}`);
        }
      }
    });
  }
}

function findCreatedObject(result, typeSuffix) {
  const change = result.objectChanges?.find(c =>
    c.type === 'created' && c.objectType?.includes(typeSuffix)
  );
  return change?.objectId;
}

// ── Main demo ─────────────────────────────────────────────────────────

async function main() {
  const address = getAddress();
  console.log('\nSlabClaw Predict — Testnet Demo');
  console.log('================================');
  console.log(`Deployer/Admin: ${address}`);
  console.log(`Package: ${CONFIG.packageId}`);
  console.log(`Registry: ${CONFIG.registryId}`);
  console.log(`AdminCap: ${CONFIG.adminCapId}`);

  // ── Step 1: Register asset classes ────────────────────────────────

  log(1, 'Registering asset classes from SlabClaw universe');

  const assetIds = [];
  for (const card of DEMO_CARDS) {
    const assetId = toAssetId(card.productId, card.grader, card.grade);
    assetIds.push(assetId);

    try {
      const result = await registerAsset({
        assetId,
        setName: card.set,
        cardNumber: card.number,
        grader: card.grader,
        gradeBps: gradeToBps(card.grade),
        platformCount: card.platforms,
      });
      console.log(`  ✓ Registered: ${card.name} (${card.grader} ${card.grade}) → ${assetId}`);
      logResult('  Tx', result);
    } catch (err) {
      if (err.message.includes('0')) {
        console.log(`  ⊘ Already registered: ${assetId}`);
      } else {
        console.error(`  ✗ Failed: ${err.message}`);
      }
    }
  }

  // ── Step 2: Authorize oracle ──────────────────────────────────────

  log(2, 'Authorizing oracle operator');

  let oracleCapId = CONFIG.oracleCapId;
  if (!oracleCapId) {
    try {
      const result = await authorizeOracle(address);
      oracleCapId = findCreatedObject(result, 'OracleCap');
      console.log(`  ✓ OracleCap created: ${oracleCapId}`);
      console.log(`  ⚠ Update config.mjs with: oracleCapId: '${oracleCapId}'`);
      logResult('  Tx', result);
    } catch (err) {
      console.error(`  ✗ Failed: ${err.message}`);
      return;
    }
  } else {
    console.log(`  ⊘ Using existing OracleCap: ${oracleCapId}`);
  }

  // ── Step 3: Create prediction markets ─────────────────────────────

  log(3, 'Creating prediction markets');

  // Expiry: 30 days from now
  const expiryMs = Date.now() + (30 * 24 * 60 * 60 * 1000);
  const marketIds = [];

  for (let i = 0; i < DEMO_CARDS.length; i++) {
    const card = DEMO_CARDS[i];
    const assetId = assetIds[i];
    const description = `Will ${card.grader} ${card.grade} ${card.name} exceed $${(card.strikePrice / 100).toLocaleString()} by ${new Date(expiryMs).toLocaleDateString()}?`;

    try {
      const result = await createMarket({
        assetId,
        strikeUsdCents: card.strikePrice,
        expiryMs,
        description,
      });
      const marketId = findCreatedObject(result, 'Market');
      marketIds.push(marketId);
      console.log(`  ✓ Market created: ${description}`);
      console.log(`    Market ID: ${marketId}`);
      logResult('    Tx', result);
    } catch (err) {
      console.error(`  ✗ Failed to create market for ${card.name}: ${err.message}`);
      marketIds.push(null);
    }
  }

  // ── Step 4: Place demo positions ──────────────────────────────────

  log(4, 'Placing demo YES/NO positions');

  for (let i = 0; i < marketIds.length; i++) {
    const marketId = marketIds[i];
    if (!marketId) continue;

    const card = DEMO_CARDS[i];

    // Buy 0.01 SUI of YES
    try {
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [10_000_000]); // 0.01 SUI
      tx.moveCall({
        target: `${CONFIG.packageId}::market::buy_yes`,
        arguments: [
          tx.object(marketId),
          coin,
          tx.object(CONFIG.clockId),
        ],
      });
      const result = await executeTransaction(tx);
      console.log(`  ✓ Bought 0.01 SUI YES on ${card.name}`);
      logResult('    Tx', result);
    } catch (err) {
      console.error(`  ✗ Failed YES buy for ${card.name}: ${err.message}`);
    }

    // Buy 0.005 SUI of NO
    try {
      const tx = new Transaction();
      const [coin] = tx.splitCoins(tx.gas, [5_000_000]); // 0.005 SUI
      tx.moveCall({
        target: `${CONFIG.packageId}::market::buy_no`,
        arguments: [
          tx.object(marketId),
          coin,
          tx.object(CONFIG.clockId),
        ],
      });
      const result = await executeTransaction(tx);
      console.log(`  ✓ Bought 0.005 SUI NO on ${card.name}`);
      logResult('    Tx', result);
    } catch (err) {
      console.error(`  ✗ Failed NO buy for ${card.name}: ${err.message}`);
    }
  }

  // ── Summary ───────────────────────────────────────────────────────

  log('✓', 'Demo complete!');
  console.log('\nCreated objects:');
  console.log(`  Package: ${CONFIG.packageId}`);
  console.log(`  Registry: ${CONFIG.registryId}`);
  console.log(`  OracleCap: ${oracleCapId}`);
  console.log(`  Markets:`);
  for (let i = 0; i < DEMO_CARDS.length; i++) {
    if (marketIds[i]) {
      console.log(`    ${DEMO_CARDS[i].name}: ${marketIds[i]}`);
    }
  }

  console.log('\nNext steps:');
  console.log('  1. Wait for market expiry (or use testnet clock manipulation)');
  console.log('  2. Run: node propose-resolution.mjs <market-id> <price-cents> <sources>');
  console.log('  3. Wait 24h (dispute window)');
  console.log('  4. Run: node finalize.mjs <market-id>');
  console.log('  5. Winners call claim() to collect winnings');
}

main().catch(err => {
  console.error('\nFatal error:', err.message);
  process.exit(1);
});
