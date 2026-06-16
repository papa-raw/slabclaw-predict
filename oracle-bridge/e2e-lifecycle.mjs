#!/usr/bin/env node
/// e2e-lifecycle.mjs — full oracle→resolution lifecycle test, all 4 products, all stages.
///
/// Runs against REAL swarm consensus + REAL Walrus evidence on Sui testnet, on
/// fresh short-expiry TEST markets (the live demo markets are never touched).
///
/// Stage coverage:
///   create → trade(YES/NO) → expiry → propose (honest refusal at floor=3 for
///   thin cards; success for cards that clear) → dispute window → [undisputed
///   finalize | dispute→admin_resolve(bond slashed) | dispute→admin_resolve
///   (bond returned)] → claim (winner paid, loser rejected, double-claim
///   rejected) → settled-no-winner emergency_refund → active-cancellation
///   emergency_refund → evidence verification → config restored + demo
///   markets untouched.
///
/// ProtocolConfig is temporarily tightened (45s window, 2 tUSD bond, then
/// floor 3→1 for the mechanics phase) and RESTORED at the end — safe because
/// dispute terms snapshot into each market at proposal time, and the live
/// PROPOSED demo market was proposed long before this run.
///
///   node e2e-lifecycle.mjs

import { readFileSync } from 'fs';
import { Transaction } from '@mysten/sui/transactions';
import { getAddress, getClient, executeTransaction, proposeResolution } from './sui-client.mjs';
import { verifyEvidence } from './walrus-evidence.mjs';
import { CONFIG, toAssetId, gradeToBps, marketStateCode } from './config.mjs';

const client = getClient();
const me = getAddress();
const tUSD = (n) => Math.round(n * 1e9);
const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const vec = (tx, s) => tx.pure.vector('u8', Array.from(Buffer.from(s)));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Production floor is 2 (two corroborating independent sold-families — the
// rare-card thin-market gate does the rest off-chain). Restore to that.
const DEFAULTS = { windowMs: 86_400_000, bond: 10_000_000_000, minSources: 2 };
const TEST = { windowMs: 45_000, bond: tUSD(2), expiryDeltaMs: 50_000 };

// Real swarm output — prices, family counts, and the round's evidence blob.
const consensusArtifact = JSON.parse(readFileSync(new URL('../frontend/src/data/oracle-consensus.json', import.meta.url), 'utf8'));
const CC = consensusArtifact.consensus;
const cardState = (id) => ({
  price: CC[id].consensusPriceCents,
  sources: CC[id].sourceCount,
  blobId: CC[id].evidence?.blobId,
});

const PRODUCTS = [
  { productId: 'neo1-1st-18',  name: 'Typhlosion', set: 'Neo Genesis — 1st Edition', number: '18', strike: 400000, path: 'undisputed-finalize' },
  { productId: 'jp-vs-091',    name: "Karen's Umbreon", set: 'Pokémon Card VS — 1st Ed', number: '091', strike: 1500000, path: 'dispute-slash-bond' },
  { productId: 'base5-1st-83', name: 'Dark Raichu', set: 'Team Rocket — 1st Edition', number: '83', strike: 600000, path: 'honest-floor-finalize' },
  { productId: 'base2-1st-3',  name: 'Flareon', set: 'Jungle — 1st Edition', number: '3', strike: 250000, path: 'dispute-return-bond' },
];

const results = [];
let failures = 0;
function record(product, stage, ok, detail = '') {
  results.push({ product, stage, ok, detail });
  if (!ok) failures++;
  console.log(`   ${ok ? '✅' : '❌'} [${product}] ${stage}${detail ? ' — ' + detail : ''}`);
}

async function exec(tx) {
  const res = await executeTransaction(tx);
  await client.waitForTransaction({ digest: res.digest });
  if (res.effects?.status?.status !== 'success') {
    throw new Error(`tx failed: ${res.effects?.status?.error || 'unknown'}`);
  }
  return res;
}

/// Expect a Move abort with a specific error code; returns true when it happened.
async function expectAbort(buildTx, codeWanted) {
  try {
    await exec(buildTx());
    return { aborted: false };
  } catch (e) {
    const m = /MoveAbort\(.*?, (\d+)\)/.exec(e.message);
    const code = m ? Number(m[1]) : null;
    return { aborted: true, code, match: code === codeWanted, msg: e.message.slice(0, 120) };
  }
}

async function readMarket(id) {
  const r = await client.getObject({ id, options: { showContent: true } });
  const f = r.data.content.fields;
  return {
    state: marketStateCode(f.state),
    pool: Number(f.pool),
    totalYes: Number(f.total_yes),
    totalNo: Number(f.total_no),
    totalClaimed: Number(f.total_claimed),
    proposedPrice: Number(f.proposed_price),
    evidence: f.evidence_blob_id?.length ? Buffer.from(f.evidence_blob_id).toString() : null,
    disputeDeadline: Number(f.dispute_deadline_ms),
    expiry: Number(f.expiry_ms),
  };
}

async function tusdBalance() {
  const b = await client.getBalance({ owner: me, coinType: CONFIG.testUsdType });
  return Number(b.totalBalance);
}

async function setConfig({ windowMs, bond, minSources }) {
  const tx = new Transaction();
  if (windowMs) tx.moveCall({ target: `${CONFIG.packageId}::registry::set_dispute_window_ms`, arguments: [tx.object(CONFIG.adminCapId), tx.object(CONFIG.configId), tx.pure.u64(windowMs)] });
  if (bond) tx.moveCall({ target: `${CONFIG.packageId}::registry::set_min_dispute_bond`, arguments: [tx.object(CONFIG.adminCapId), tx.object(CONFIG.configId), tx.pure.u64(bond)] });
  if (minSources) tx.moveCall({ target: `${CONFIG.packageId}::registry::set_min_sources`, arguments: [tx.object(CONFIG.adminCapId), tx.object(CONFIG.configId), tx.pure.u64(minSources)] });
  await exec(tx);
}

async function readConfig() {
  const r = await client.getObject({ id: CONFIG.configId, options: { showContent: true } });
  const f = r.data.content.fields;
  return { windowMs: Number(f.dispute_window_ms), bond: Number(f.min_dispute_bond), minSources: Number(f.min_sources) };
}

/// Create a test market (asset assumed registered) + optionally seed positions.
async function createTestMarket(p, { expiryMs, seedYes = 50, seedNo = 30 }) {
  const assetId = toAssetId(p.productId, 'PSA', 10);
  const desc = `E2E TEST — ${p.name} > ${usd(p.strike)}?`;
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::market::create_market`, arguments: [
    tx.object(CONFIG.adminCapId), tx.object(CONFIG.registryId), vec(tx, assetId),
    tx.pure.u64(p.strike), tx.pure.u64(expiryMs), vec(tx, desc), tx.object(CONFIG.clockId),
  ] });
  const r = await exec(tx);
  const marketId = (r.objectChanges || []).find((o) => o.type === 'created' && o.objectType?.endsWith('::market::Market'))?.objectId;

  if (seedYes > 0 || seedNo > 0) {
    const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
    const coinId = coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0].coinObjectId;
    const tx2 = new Transaction();
    const amts = [seedYes, seedNo].filter((n) => n > 0).map((n) => tUSD(n));
    const parts = tx2.splitCoins(tx2.object(coinId), amts);
    let i = 0;
    if (seedYes > 0) tx2.moveCall({ target: `${CONFIG.packageId}::market::buy_yes`, arguments: [tx2.object(marketId), parts[i++], tx2.object(CONFIG.clockId)] });
    if (seedNo > 0) tx2.moveCall({ target: `${CONFIG.packageId}::market::buy_no`, arguments: [tx2.object(marketId), parts[i++], tx2.object(CONFIG.clockId)] });
    await exec(tx2);
  }
  return marketId;
}

function disputeTx(marketId, bondAmount, coinId) {
  const tx = new Transaction();
  const [bond] = tx.splitCoins(tx.object(coinId), [bondAmount]);
  tx.moveCall({ target: `${CONFIG.packageId}::market::dispute`, arguments: [tx.object(marketId), bond, tx.object(CONFIG.clockId)] });
  return tx;
}

function finalizeTx(marketId) {
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::market::finalize`, arguments: [tx.object(marketId), tx.object(CONFIG.clockId)] });
  return tx;
}

function adminResolveTx(marketId, price, returnBond) {
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::market::admin_resolve`, arguments: [
    tx.object(CONFIG.adminCapId), tx.object(marketId), tx.pure.u64(price), tx.pure.bool(returnBond),
  ] });
  return tx;
}

function claimTx(marketId) {
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::market::claim`, arguments: [tx.object(marketId)] });
  return tx;
}

function refundTx(marketId, recipient) {
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::market::emergency_refund`, arguments: [
    tx.object(CONFIG.adminCapId), tx.object(marketId), tx.pure.address(recipient),
  ] });
  return tx;
}

async function biggestTusdCoin() {
  const coins = await client.getCoins({ owner: me, coinType: CONFIG.testUsdType });
  return coins.data.sort((a, b) => Number(b.balance) - Number(a.balance))[0].coinObjectId;
}

// ════════════════════════════════════════════════════════════════════════════
console.log('━━━ E2E lifecycle · all 4 products · all stages ━━━');
console.log(`operator ${me.slice(0, 12)}… · round ${consensusArtifact.roundId}\n`);

const ageMin = (Date.now() - consensusArtifact.timestamp) / 60000;
if (ageMin > 120) {
  console.error(`consensus artifact is ${ageMin.toFixed(0)}min old — run "node swarm.mjs --dry" first`);
  process.exit(1);
}
for (const p of PRODUCTS) {
  const cs = cardState(p.productId);
  console.log(`  ${p.productId.padEnd(14)} ${usd(cs.price).padEnd(9)} families=${cs.sources} evidence=${cs.blobId?.slice(0, 12)}… path=${p.path}`);
  if (!cs.blobId) { console.error('missing evidence blob — aborting'); process.exit(1); }
}

// Snapshot demo-market state for the leave-no-trace check at the end.
const DEMO_IDS = ['0xa0d4021e89140c8d1fe6ccacca596e1c72e22281fa49fff22bbff54ac8c001ae',
  '0x3cb150d18f5a7cc1764c1ec52eac41d2905bfc47cde2bb075d217ef49d3c0bad',
  '0x1750bdd11a60f777716a15d54e48caff8ae4d6baca94124c5bf0223a6d503788',
  '0xb8f8751687f1f71eb6f81a7122bdb13a9db7fa0da036203355385d6f4374af12'];
const demoBefore = [];
for (const id of DEMO_IDS) demoBefore.push(await readMarket(id));

console.log('\n── Stage 0 · mint tUSD + tighten config for the test ──');
{
  const tx = new Transaction();
  tx.moveCall({ target: `${CONFIG.packageId}::test_usd::mint`, arguments: [tx.object(CONFIG.faucetId), tx.pure.u64(tUSD(600))] });
  await exec(tx);
  // Set the FULL baseline (window+bond+floor) so the test is deterministic regardless
  // of any prior governance drift. Stage 3 pins floor=3 for the refusal test; Stage 5
  // drops to 2 for the thin-market path; Stage 11 restores DEFAULTS.
  await setConfig({ windowMs: TEST.windowMs, bond: TEST.bond, minSources: DEFAULTS.minSources });
  const cfg = await readConfig();
  record('config', 'test config applied', cfg.windowMs === TEST.windowMs && cfg.bond === TEST.bond && cfg.minSources === DEFAULTS.minSources,
    `window=${cfg.windowMs}ms bond=${cfg.bond / 1e9}tUSD floor=${cfg.minSources}`);
}

console.log('\n── Stage 1 · create + trade: 4 product markets + 2 refund-path markets ──');
const expiryMs = Date.now() + TEST.expiryDeltaMs;
const M = {};
for (const p of PRODUCTS) {
  M[p.productId] = await createTestMarket(p, { expiryMs });
  const m = await readMarket(M[p.productId]);
  record(p.productId, 'create+trade', m.state === 0 && m.totalYes > 0 && m.totalNo > 0,
    `market ${M[p.productId].slice(0, 10)}… pool ${(m.pool / 1e9).toFixed(0)} tUSD`);
}
// no-winner market: only NO shares; consensus > strike means YES wins → nobody to pay
const NOWIN = await createTestMarket(PRODUCTS[0], { expiryMs, seedYes: 0, seedNo: 25 });
record('no-winner', 'create (NO-only positions)', (await readMarket(NOWIN)).totalNo > 0);
// active-cancel market: far expiry, refunded while still Active
const CANCEL = await createTestMarket(PRODUCTS[0], { expiryMs: Date.now() + 3_600_000 });
record('active-cancel', 'create (long expiry)', (await readMarket(CANCEL)).state === 0);

console.log(`\n── Stage 2 · waiting ${Math.ceil(TEST.expiryDeltaMs / 1000) + 8}s for expiry ──`);
await sleep(TEST.expiryDeltaMs + 8_000);

console.log('\n── Stage 3 · HONEST REFUSAL below the floor ──');
// Pin floor=3, then attempt to propose every product market with a deliberately-low
// source count (1). The contract must reject all of them — deterministic regardless of
// how many families each card actually has this round (the data shifts as scrapers improve).
await setConfig({ minSources: 3 });
for (const p of PRODUCTS) {
  const cs = cardState(p.productId);
  const r = await expectAbort(() => {
    const tx = new Transaction();
    tx.moveCall({ target: `${CONFIG.packageId}::market::propose_resolution`, arguments: [
      tx.object(CONFIG.oracleCapId), tx.object(M[p.productId]), tx.object(CONFIG.registryId), tx.object(CONFIG.configId),
      tx.pure.u64(cs.price), tx.pure.u64(1), vec(tx, cs.blobId), tx.object(CONFIG.clockId),
    ] });
    return tx;
  }, 16 /* EInsufficientSources */);
  record(p.productId, 'propose below the source floor correctly REFUSED', r.aborted && r.match,
    r.aborted ? `abort code ${r.code}` : 'tx unexpectedly succeeded');
}

// Partition the 4 products by their LIVE family count: ≥3 = clean (settle at floor 3),
// 2 = thin rare-card (settle at floor 2 with thin_market). Routes itself as data changes.
const cleanCards = PRODUCTS.map((p) => p.productId).filter((pid) => cardState(pid).sources >= 3);
const thinCards = PRODUCTS.map((p) => p.productId).filter((pid) => cardState(pid).sources < 3);

console.log(`\n── Stage 4 · clean cards (≥3 families) settle at floor 3 → PROPOSED ──`);
for (const pid of cleanCards) {
  const cs = cardState(pid);
  const pr = await proposeResolution({ oracleCapId: CONFIG.oracleCapId, marketId: M[pid], priceUsdCents: cs.price, sourcesCount: cs.sources, evidenceBlobId: cs.blobId });
  await client.waitForTransaction({ digest: pr.digest });
  const m = await readMarket(M[pid]);
  record(pid, `propose at floor=3 (${cs.sources} families, real evidence)`, m.state === 1 && m.evidence === cs.blobId, `${usd(m.proposedPrice)}`);
}

console.log(`\n── Stage 5 · rare-card thin_market settles at floor 2 → PROPOSED ──`);
await setConfig({ minSources: 2 });
for (const pid of thinCards) {
  const cs = cardState(pid);
  const pr = await proposeResolution({ oracleCapId: CONFIG.oracleCapId, marketId: M[pid], priceUsdCents: cs.price, sourcesCount: cs.sources, evidenceBlobId: cs.blobId });
  await client.waitForTransaction({ digest: pr.digest });
  const m = await readMarket(M[pid]);
  record(pid, `thin_market propose at floor=2 (${cs.sources} families)`, m.state === 1, usd(m.proposedPrice));
}
// the no-winner market needs a proposal too (uses a clean card's price/evidence)
{
  const seed = cleanCards[0] || 'base5-1st-83';
  const cs = cardState(seed);
  const pr = await proposeResolution({ oracleCapId: CONFIG.oracleCapId, marketId: NOWIN, priceUsdCents: cs.price, sourcesCount: cs.sources, evidenceBlobId: cs.blobId });
  await client.waitForTransaction({ digest: pr.digest });
  record('no-winner', 'propose', (await readMarket(NOWIN)).state === 1);
}

console.log('\n── Stage 6 · dispute paths (within the 45s window) ──');
{
  // Umbreon: dispute then bond SLASHED into the pool (dispute judged invalid)
  const before = await readMarket(M['jp-vs-091']);
  await exec(disputeTx(M['jp-vs-091'], TEST.bond, await biggestTusdCoin()));
  const disputed = await readMarket(M['jp-vs-091']);
  record('jp-vs-091', 'dispute accepted (bond posted)', disputed.state === 2);
  const cs = cardState('jp-vs-091');
  await exec(adminResolveTx(M['jp-vs-091'], cs.price, false));
  const settled = await readMarket(M['jp-vs-091']);
  record('jp-vs-091', 'admin_resolve · bond slashed into pool', settled.state === 3 && settled.pool === before.pool + TEST.bond,
    `pool ${(before.pool / 1e9).toFixed(0)}→${(settled.pool / 1e9).toFixed(0)} tUSD`);
}
{
  // Flareon: dispute then bond RETURNED (dispute judged valid; price corrected -2%)
  const balBefore = await tusdBalance();
  await exec(disputeTx(M['base2-1st-3'], TEST.bond, await biggestTusdCoin()));
  record('base2-1st-3', 'dispute accepted', (await readMarket(M['base2-1st-3'])).state === 2);
  const cs = cardState('base2-1st-3');
  const corrected = Math.round(cs.price * 0.98);
  await exec(adminResolveTx(M['base2-1st-3'], corrected, true));
  const m = await readMarket(M['base2-1st-3']);
  const balAfter = await tusdBalance();
  record('base2-1st-3', 'admin_resolve · corrected price + bond returned',
    m.state === 3 && m.proposedPrice === corrected && balAfter > balBefore - TEST.bond * 0.01,
    `settled ${usd(corrected)} · bond back`);
}
console.log('\n── Stage 7 · window closes → finalize the undisputed markets ──');
await sleep(TEST.windowMs + 6_000);
{
  const coin = await biggestTusdCoin();
  const r = await expectAbort(() => disputeTx(M['neo1-1st-18'], TEST.bond, coin), 8 /* EDisputeWindowClosed */);
  record('neo1-1st-18', 'late dispute correctly REFUSED', r.aborted && r.match, r.aborted ? `abort code ${r.code}` : 'unexpectedly succeeded');
}
for (const pid of ['neo1-1st-18', 'base5-1st-83']) {
  await exec(finalizeTx(M[pid]));
  const m = await readMarket(M[pid]);
  const cs = cardState(pid);
  const strike = PRODUCTS.find((p) => p.productId === pid).strike;
  record(pid, 'finalize (undisputed)', m.state === 3, `${usd(cs.price)} vs strike ${usd(strike)} → ${cs.price > strike ? 'YES' : 'NO'}`);
}
await exec(finalizeTx(NOWIN));
record('no-winner', 'finalize (YES wins, zero YES shares)', (await readMarket(NOWIN)).state === 3);

console.log('\n── Stage 8 · claims: winner paid exactly, double-claim + no-winner rejected ──');
for (const pid of ['neo1-1st-18', 'jp-vs-091', 'base5-1st-83', 'base2-1st-3']) {
  const m = await readMarket(M[pid]);
  const balBefore = await tusdBalance();
  await exec(claimTx(M[pid]));
  const after = await readMarket(M[pid]);
  const got = (await tusdBalance()) - balBefore;
  // single trader holds the whole winning side → payout must equal the full pool
  record(pid, 'claim pays the full pool to the sole winner', got === m.pool && after.totalClaimed === m.pool && after.pool === 0,
    `paid ${(got / 1e9).toFixed(1)} tUSD`);
  const dbl = await expectAbort(() => claimTx(M[pid]), 14 /* EAlreadyClaimed */);
  record(pid, 'double-claim correctly REFUSED', dbl.aborted && dbl.match);
}
{
  // ENoWinningPosition(15) — the personal-shares check fires before the side
  // total, and winning_shares <= total_winning makes ENoWinningSide(18)
  // unreachable from claim. The loser is rejected either way.
  const r = await expectAbort(() => claimTx(NOWIN), 15 /* ENoWinningPosition */);
  record('no-winner', 'claim with zero winning shares REFUSED', r.aborted && r.match, r.aborted ? `abort code ${r.code}` : '');
}

console.log('\n── Stage 9 · emergency refunds (the two narrow escape hatches) ──');
{
  const balBefore = await tusdBalance();
  await exec(refundTx(NOWIN, me));
  const got = (await tusdBalance()) - balBefore;
  record('no-winner', 'settled-no-winner refund', got > 0, `refunded ${(got / 1e9).toFixed(1)} tUSD`);
}
{
  const balBefore = await tusdBalance();
  await exec(refundTx(CANCEL, me));
  const got = (await tusdBalance()) - balBefore;
  record('active-cancel', 'active-market cancellation refund', got > 0, `refunded ${(got / 1e9).toFixed(1)} tUSD`);
}

console.log('\n── Stage 10 · evidence verification (recompute from the public blob) ──');
{
  const cs = cardState('base5-1st-83');
  try {
    const v = await verifyEvidence(cs.blobId);
    const ok = v && (v.ok === true || (Array.isArray(v) && v.length === 0) || v.mismatches?.length === 0);
    record('base5-1st-83', 'evidence blob recomputes', !!ok, JSON.stringify(v).slice(0, 80));
  } catch (e) {
    record('base5-1st-83', 'evidence blob recomputes', false, e.message.slice(0, 80));
  }
}

console.log('\n── Stage 11 · restore governance config + leave-no-trace check ──');
await setConfig(DEFAULTS);
{
  const cfg = await readConfig();
  record('config', 'defaults restored', cfg.windowMs === DEFAULTS.windowMs && cfg.bond === DEFAULTS.bond && cfg.minSources === DEFAULTS.minSources,
    `window=24h bond=10tUSD floor=${cfg.minSources}`);
}
for (let i = 0; i < DEMO_IDS.length; i++) {
  const after = await readMarket(DEMO_IDS[i]);
  const b = demoBefore[i];
  record('demo-' + DEMO_IDS[i].slice(0, 8), 'demo market untouched',
    after.state === b.state && after.pool === b.pool && after.evidence === b.evidence && after.expiry === b.expiry);
}

console.log('\n━━━ RESULT ━━━');
const byProduct = {};
for (const r of results) (byProduct[r.product] ||= []).push(r);
console.log(`${results.length} checks · ${results.length - failures} passed · ${failures} failed`);
if (failures > 0) { console.log('\nFAILED:'); results.filter((r) => !r.ok).forEach((r) => console.log(`  ❌ [${r.product}] ${r.stage} ${r.detail}`)); }
process.exit(failures ? 1 : 0);
