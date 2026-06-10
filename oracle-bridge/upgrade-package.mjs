#!/usr/bin/env node
/// upgrade-package.mjs — publish a package upgrade via the TS SDK.
///
/// Used when the local sui CLI trails the network protocol version (the CLI
/// hard-panics on a version it doesn't know; the SDK doesn't care). The
/// bytecode comes from an offline `sui move build --dump-bytecode-as-base64`.
///
///   cd ../contracts/slabclaw_predict && sui move build --dump-bytecode-as-base64 > /tmp/pkg-bytecode.json
///   node upgrade-package.mjs /tmp/pkg-bytecode.json

import { readFileSync } from 'fs';
import { Transaction, UpgradePolicy } from '@mysten/sui/transactions';
import { getClient, executeTransaction } from './sui-client.mjs';
import { CONFIG } from './config.mjs';

const bytecodePath = process.argv[2] || '/tmp/pkg-bytecode.json';
const { modules, dependencies, digest } = JSON.parse(readFileSync(bytecodePath, 'utf8'));

const tx = new Transaction();
const cap = tx.object(CONFIG.upgradeCapId);
const ticket = tx.moveCall({
  target: '0x2::package::authorize_upgrade',
  arguments: [cap, tx.pure.u8(UpgradePolicy.COMPATIBLE), tx.pure.vector('u8', digest)],
});
const receipt = tx.upgrade({ modules, dependencies, package: CONFIG.packageId, ticket });
tx.moveCall({ target: '0x2::package::commit_upgrade', arguments: [cap, receipt] });

const res = await executeTransaction(tx);
const client = getClient();
await client.waitForTransaction({ digest: res.digest });
const published = (res.objectChanges || []).find((c) => c.type === 'published');
console.log('status:', res.effects?.status?.status);
console.log('digest:', res.digest);
console.log('NEW PACKAGE:', published?.packageId, 'version:', published?.version);
