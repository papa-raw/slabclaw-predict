#!/usr/bin/env node
/// create-proposed.mjs — Create a real onchain market in PROPOSED state.
/// Steps: authorize oracle → register asset → create market (90s expiry)
///      → seed positions → wait for expiry → propose resolution.
/// Leaves the market in PROPOSED (state 1) with a 24h dispute window so
/// a user can dispute it from the frontend UI.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction } from './sui-client.mjs';
import { CONFIG, toAssetId, gradeToBps } from './config.mjs';

const tUSD = (n) => Math.round(n * 1e9);
const pureVec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));

const CARD = {
  productId: 'base2-1st-3',
  name: 'Flareon',
  set: 'Jungle — 1st Edition',
  number: '3',
  grader: 'PSA',
  grade: 10,
  strikeCents: 250000,  // $2,500 strike
  platforms: 8,
  seedYes: 400,
  seedNo: 350,
};

const EXPIRY_WAIT_S = 90;

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const me = getAddress();
  const client = getClient();
  const assetId = toAssetId(CARD.productId, CARD.grader, CARD.grade);
  const expiryMs = Date.now() + EXPIRY_WAIT_S * 1000;

  console.log(`Deployer: ${me}`);
  console.log(`Package:  ${CONFIG.packageId}`);
  console.log(`Asset:    ${assetId}`);
  console.log(`Expiry:   ${new Date(expiryMs).toISOString()} (${EXPIRY_WAIT_S}s from now)\n`);

  // ── 1. Authorize oracle (creates OracleCap for deployer) ────────────
  let oracleCapId;
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONFIG.packageId}::oracle::authorize_oracle`,
      arguments: [
        tx.object(CONFIG.adminCapId),
        tx.pure.address(me),
      ],
    });
    const r = await executeTransaction(tx);
    oracleCapId = (r.objectChanges || []).find(
      o => o.type === 'created' && o.objectType?.includes('OracleCap')
    )?.objectId;
    console.log(`✓ OracleCap created: ${oracleCapId}`);
  } catch (e) {
    console.error(`✗ Oracle auth failed: ${e.message}`);
    process.exit(1);
  }

  // ── 2. Register asset (idempotent — will fail if already registered) ─
  try {
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONFIG.packageId}::registry::register_asset`,
      arguments: [
        tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId),
        pureVec(tx, assetId), pureVec(tx, CARD.set), pureVec(tx, CARD.number),
        pureVec(tx, CARD.grader), tx.pure.u64(gradeToBps(CARD.grade)),
        tx.pure.u64(CARD.platforms),
      ],
    });
    await executeTransaction(tx);
    console.log(`✓ Registered ${assetId}`);
  } catch (e) {
    console.log(`⊘ Asset register (may already exist): ${e.message.slice(0, 80)}`);
  }

  // ── 3. Create market with short expiry ──────────────────────────────
  let marketId;
  {
    const desc = `Will ${CARD.grader} ${CARD.grade} ${CARD.name} exceed $${(CARD.strikeCents / 100).toLocaleString()} by ${new Date(expiryMs).toLocaleDateString()}? [DISPUTE DEMO]`;
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONFIG.packageId}::market::create_market`,
      arguments: [
        tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId),
        pureVec(tx, assetId), tx.pure.u64(CARD.strikeCents), tx.pure.u64(expiryMs),
        pureVec(tx, desc), tx.object(CONFIG.clockId),
      ],
    });
    const r = await executeTransaction(tx);
    marketId = (r.objectChanges || []).find(
      o => o.type === 'created' && o.objectType?.endsWith('::market::Market')
    )?.objectId;
    console.log(`✓ Market created: ${marketId}`);
  }

  // ── 4. Mint tUSD and seed positions ─────────────────────────────────
  const seedTotal = CARD.seedYes + CARD.seedNo;
  {
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONFIG.packageId}::test_usd::mint`,
      arguments: [tx.object(CONFIG.faucetId), tx.pure.u64(tUSD(seedTotal))],
    });
    await executeTransaction(tx);
    console.log(`✓ Minted ${seedTotal} tUSD`);
  }

  await sleep(2000);

  // Seed YES/NO positions
  {
    const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
    const sorted = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance));
    const coinId = sorted[0].coinObjectId;

    const tx = new Transaction();
    if (sorted.length > 1) {
      tx.mergeCoins(tx.object(coinId), sorted.slice(1).map(c => tx.object(c.coinObjectId)));
    }
    const [yesAmt, noAmt] = tx.splitCoins(tx.object(coinId), [tUSD(CARD.seedYes), tUSD(CARD.seedNo)]);
    tx.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [tx.object(marketId), yesAmt, tx.object(CONFIG.clockId)] });
    tx.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [tx.object(marketId), noAmt, tx.object(CONFIG.clockId)] });
    await executeTransaction(tx);
    console.log(`✓ Seeded: ${CARD.seedYes} YES / ${CARD.seedNo} NO`);
  }

  // ── 5. Wait for market to expire ────────────────────────────────────
  const waitMs = expiryMs - Date.now() + 2000; // +2s buffer
  if (waitMs > 0) {
    console.log(`⏳ Waiting ${Math.ceil(waitMs / 1000)}s for market expiry...`);
    await sleep(waitMs);
  }

  // ── 6. Propose resolution (oracle proposes price) ───────────────────
  // Propose $2,800 — above $2,500 strike → YES would win if unchallenged.
  // Market stays in PROPOSED (state 1) with a 24h dispute window.
  {
    const proposedPrice = 280000; // $2,800 in cents
    const tx = new Transaction();
    tx.moveCall({
      target: `${CONFIG.packageId}::market::propose_resolution`,
      arguments: [
        tx.object(oracleCapId), tx.object(marketId), tx.object(CONFIG.registryId),
        tx.pure.u64(proposedPrice), tx.pure.u64(8), // 8 sources
        tx.object(CONFIG.clockId),
      ],
    });
    await executeTransaction(tx);
    console.log(`✓ Proposed resolution: $${proposedPrice / 100} (above $${CARD.strikeCents / 100} strike → YES)`);
  }

  // No dispute step — market stays PROPOSED for the user to dispute from the UI.

  console.log(`\n=== DONE ===`);
  console.log(`Market ID:  ${marketId}`);
  console.log(`State:      PROPOSED (1) — 24h dispute window is open`);
  console.log(`Card:       ${CARD.name} — ${CARD.set}`);
  console.log(`Strike:     $${CARD.strikeCents / 100}`);
  console.log(`Proposed:   $2,800 (YES wins if unchallenged)`);
  console.log(`\nReplace Flareon entry in DEMO_MARKETS (constants.js) with:`);
  console.log(JSON.stringify({
    id: marketId,
    assetId,
    name: CARD.name,
    set: CARD.set,
    number: CARD.number,
    grader: CARD.grader,
    grade: CARD.grade,
    strikeUsdCents: CARD.strikeCents,
    edition: '1st Edition',
    language: 'en',
    image: 'https://images.pokemontcg.io/base2/3.png',
    productId: CARD.productId,
  }, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
