#!/usr/bin/env node
/// propose-resolution.mjs — propose on-chain resolution for ONE expired market
/// using the genuine SlabClaw exact-product oracle.
///
/// Usage: node propose-resolution.mjs <marketId> [productId] [grader] [grade]
/// productId/grader/grade are inferred from constants if the market is one of ours.

import { fetchOraclePrice, proposeResolution } from './sui-client.mjs';
import { CONFIG } from './config.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const [marketId, productIdArg, graderArg, gradeArg] = process.argv.slice(2);
if (!marketId) { console.error('usage: node propose-resolution.mjs <marketId> [productId] [grader] [grade]'); process.exit(1); }

const meta = DEMO_MARKETS.find((m) => m.id === marketId);
const productId = productIdArg || meta?.productId;
const grader = graderArg || meta?.grader || 'PSA';
const grade = Number(gradeArg || meta?.grade || 10);
if (!productId) { console.error('No productId — pass it explicitly for a non-demo market.'); process.exit(1); }

const o = await fetchOraclePrice(productId, grader, grade);
if (!o.ok) { console.error(`Oracle unavailable: ${o.error}`); process.exit(1); }
console.log(`Oracle ${grader} ${grade} ${productId}: $${(o.priceCents / 100).toLocaleString()} · ${o.sources} sources · ${o.oracleSource} · via ${o.via}`);
if (o.sources < 3) { console.error('Refusing: < 3 sources (on-chain MIN_SOURCES).'); process.exit(1); }

try {
  const r = await proposeResolution({ oracleCapId: CONFIG.oracleCapId, marketId, priceUsdCents: o.priceCents, sourcesCount: o.sources });
  console.log(`✓ Proposed ${marketId.slice(0, 10)}… @ $${(o.priceCents / 100).toLocaleString()} — ${r.digest}`);
  console.log('  24h dispute window open. Run `node finalize.mjs <marketId>` after it closes (or dispute).');
} catch (e) {
  console.error(`✗ propose failed: ${e.message}`);
  process.exit(1);
}
