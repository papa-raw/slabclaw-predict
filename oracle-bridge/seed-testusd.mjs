#!/usr/bin/env node
/// seed-testusd.mjs — One-shot deploy seed for the TEST_USD package.
/// Registers the 3 demo assets, creates 3 markets (settling in tUSD), mints
/// tUSD from the faucet, and seeds YES/NO positions so markets look alive.
///
/// Gas-batched: registrations in one PTB, market creation in one PTB, seeding
/// in one PTB. Writes resulting market IDs to deployed-markets.json.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction } from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';
import { writeFileSync } from 'fs';

const DAY = 86_400_000;
const EXPIRY_MS = Date.now() + 30 * DAY; // 30 days out (must be > now)
const tUSD = (n) => Math.round(n * 1e9);  // 9 decimals, mirrors MIST

// productId MUST match the SlabClaw registry id (frontend hydration key).
const CARDS = [
  { productId: 'base1-1st-4', name: 'Charizard',        set: 'Base Set — 1st Edition',  number: '4',   grader: 'PSA', grade: 10, strikeCents: 700000,  platforms: 10, seedYes: 600, seedNo: 250 },
  { productId: 'jp-vs-091',   name: "Karen's Umbreon",  set: 'Pokémon Card VS — 1st Ed', number: '091', grader: 'PSA', grade: 10, strikeCents: 1500000, platforms: 6,  seedYes: 300, seedNo: 420 },
  { productId: 'base3-1st-5', name: 'Gengar 1st Edition',set: 'Fossil — 1st Edition',    number: '5',   grader: 'PSA', grade: 10, strikeCents: 15000,   platforms: 9,  seedYes: 540, seedNo: 180 },
];

const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));

async function main() {
  const me = getAddress();
  const client = getClient();
  console.log(`Deployer: ${me}`);
  console.log(`Package:  ${CONFIG.packageId}`);
  console.log(`Faucet:   ${CONFIG.faucetId}\n`);

  // ── 1. Register all assets (one PTB) ──────────────────────────────
  const assetIds = CARDS.map((c) => toAssetId(c.productId, c.grader, c.grade));
  try {
    const tx = new Transaction();
    CARDS.forEach((c, i) => {
      tx.moveCall({
        target: `${CONFIG.packageId}::registry::register_asset`,
        arguments: [
          tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId),
          pureVec(tx, assetIds[i]), pureVec(tx, c.set), pureVec(tx, c.number),
          pureVec(tx, c.grader), tx.pure.u64(gradeToBps(c.grade)), tx.pure.u64(c.platforms),
        ],
      });
    });
    const r = await executeTransaction(tx);
    console.log(`✓ Registered ${CARDS.length} assets (${r.digest})`);
  } catch (e) {
    console.log(`⊘ Register (may already exist): ${e.message.slice(0, 120)}`);
  }

  // ── 2. Create all markets (one PTB) ───────────────────────────────
  const tx2 = new Transaction();
  CARDS.forEach((c, i) => {
    const desc = `Will ${c.grader} ${c.grade} ${c.name} exceed $${(c.strikeCents / 100).toLocaleString()} by ${new Date(EXPIRY_MS).toLocaleDateString()}?`;
    tx2.moveCall({
      target: `${CONFIG.packageId}::market::create_market`,
      arguments: [
        tx2.object(CONFIG.adminCapId), tx2.object(CONFIG.registryId),
        pureVec(tx2, assetIds[i]), tx2.pure.u64(c.strikeCents), tx2.pure.u64(EXPIRY_MS),
        pureVec(tx2, desc), tx2.object(CONFIG.clockId),
      ],
    });
  });
  const created = await executeTransaction(tx2);
  const marketObjs = (created.objectChanges || []).filter(
    (c) => c.type === 'created' && c.objectType?.endsWith('::market::Market')
  );
  // objectChanges order matches call order
  CARDS.forEach((c, i) => { c.marketId = marketObjs[i]?.objectId; });
  console.log(`✓ Created ${marketObjs.length} markets (${created.digest})`);
  CARDS.forEach((c) => console.log(`    ${c.name.padEnd(20)} ${c.marketId}`));

  // ── 3. Drip tUSD from the faucet ──────────────────────────────────
  const totalSeed = CARDS.reduce((s, c) => s + c.seedYes + c.seedNo, 0);
  const txMint = new Transaction();
  txMint.moveCall({
    target: `${CONFIG.packageId}::test_usd::mint`,
    arguments: [txMint.object(CONFIG.faucetId), txMint.pure.u64(tUSD(totalSeed + 100))],
  });
  const minted = await executeTransaction(txMint);
  console.log(`✓ Minted ${totalSeed + 100} tUSD (${minted.digest})`);

  // ── 4. Seed positions (one PTB, split one tUSD coin) ──────────────
  // fetch a TEST_USD coin to spend
  await new Promise((r) => setTimeout(r, 1500));
  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  if (!coins.data.length) throw new Error('No tUSD coin found after mint');
  const coinId = coins.data[0].coinObjectId;

  const tx3 = new Transaction();
  const amounts = CARDS.flatMap((c) => [tUSD(c.seedYes), tUSD(c.seedNo)]);
  const parts = tx3.splitCoins(tx3.object(coinId), amounts);
  CARDS.forEach((c, i) => {
    tx3.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [tx3.object(c.marketId), parts[i * 2], tx3.object(CONFIG.clockId)] });
    tx3.moveCall({ target: `${CONFIG.packageId}::market::buy_no`,  arguments: [tx3.object(c.marketId), parts[i * 2 + 1], tx3.object(CONFIG.clockId)] });
  });
  const seeded = await executeTransaction(tx3);
  console.log(`✓ Seeded YES/NO positions on ${CARDS.length} markets (${seeded.digest})`);

  // ── 5. Output for constants.js ────────────────────────────────────
  const out = CARDS.map((c) => ({
    productId: c.productId, name: c.name, set: c.set, number: c.number,
    grader: c.grader, grade: c.grade, strikeUsdCents: c.strikeCents,
    expiryMs: EXPIRY_MS, assetId: toAssetId(c.productId, c.grader, c.grade),
    marketId: c.marketId,
  }));
  writeFileSync(new URL('./deployed-markets.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log('\n=== DONE — market IDs written to deployed-markets.json ===');
  out.forEach((m) => console.log(`  ${m.name.padEnd(20)} ${m.marketId}  strike $${(m.strikeUsdCents/100).toLocaleString()}`));
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
