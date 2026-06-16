#!/usr/bin/env node
/// post-publish.mjs — after a FRESH `sui client publish`, mint the two objects
/// that publish-time init does NOT create: the OracleCap (authorize_oracle) and
/// the shared SwarmMemory (memory::create). Decoupled from config.mjs on purpose
/// — config still points at the OLD package at this moment, so we take the new
/// package + admin cap explicitly via env and build the calls against those.
///
///   NEW_PKG=0x… ADMIN_CAP=0x… node post-publish.mjs
///
/// Prints a JSON line { oracleCapId, swarmMemoryId } for the redeploy to patch
/// into config.mjs / constants.js.

import { Transaction } from '@mysten/sui/transactions';
import { getAddress, executeTransaction } from './sui-client.mjs';

const NEW_PKG = process.env.NEW_PKG;
const ADMIN_CAP = process.env.ADMIN_CAP;
if (!NEW_PKG || !ADMIN_CAP) {
  console.error('post-publish: set NEW_PKG and ADMIN_CAP env vars');
  process.exit(1);
}

const find = (r, needle) =>
  (r.objectChanges || []).find(
    (o) => o.type === 'created' && o.objectType?.includes(needle),
  )?.objectId;

async function main() {
  const me = getAddress();
  console.log(`Deployer: ${me}`);
  console.log(`Package:  ${NEW_PKG}\n`);

  // 1. authorize_oracle(admin, operator=deployer) → OracleCap
  const tx1 = new Transaction();
  tx1.moveCall({
    target: `${NEW_PKG}::oracle::authorize_oracle`,
    arguments: [tx1.object(ADMIN_CAP), tx1.pure.address(me)],
  });
  const r1 = await executeTransaction(tx1);
  const oracleCapId = find(r1, '::oracle::OracleCap');
  console.log(`✓ OracleCap     ${oracleCapId}`);

  // 2. memory::create(admin) → shared SwarmMemory
  const tx2 = new Transaction();
  tx2.moveCall({
    target: `${NEW_PKG}::memory::create`,
    arguments: [tx2.object(ADMIN_CAP)],
  });
  const r2 = await executeTransaction(tx2);
  const swarmMemoryId = find(r2, '::memory::SwarmMemory');
  console.log(`✓ SwarmMemory   ${swarmMemoryId}`);

  console.log('\nDEPLOY_OUT ' + JSON.stringify({ oracleCapId, swarmMemoryId }));
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
