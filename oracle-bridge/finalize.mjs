#!/usr/bin/env node
/// finalize.mjs — finalize an undisputed, proposed market after its 24h dispute
/// window closes. Settles the outcome (YES if oracle price > strike); winners claim.
///
/// Usage: node finalize.mjs <marketId>

import { finalizeMarket } from './sui-client.mjs';

const [marketId] = process.argv.slice(2);
if (!marketId) { console.error('usage: node finalize.mjs <marketId>'); process.exit(1); }

try {
  const r = await finalizeMarket(marketId);
  console.log(`✓ Finalized ${marketId.slice(0, 10)}… — ${r.digest}`);
  const settled = (r.events || []).find((e) => e.type.endsWith('::MarketSettled'));
  if (settled?.parsedJson) {
    const j = settled.parsedJson;
    console.log(`  settlement $${(Number(j.settlement_price) / 100).toLocaleString()} → ${j.outcome_yes ? 'YES' : 'NO'} wins · pool ${Number(j.total_pool) / 1e9} tUSD`);
  }
  console.log('  Winners now call claim() to collect.');
} catch (e) {
  console.error(`✗ finalize failed: ${e.message}`);
  process.exit(1);
}
