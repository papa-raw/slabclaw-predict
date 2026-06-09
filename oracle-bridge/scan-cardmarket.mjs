#!/usr/bin/env node
/// scan-cardmarket.mjs — live Cardmarket graded-ladder scan for the 4 cards via the
/// TinyFish stealth agent. Writes memwal/shared/listings/cardmarket-live.json (the
/// full graded ladder for the manipulation engine) + flags PSA-10 offers.

import { scrapeCardmarketCard, CARDMARKET_URLS } from './cardmarket-tinyfish.mjs';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const ROOT = new URL('.', import.meta.url).pathname;
const NAMES = { 'neo1-1st-18': 'Typhlosion', 'jp-vs-091': "Karen's Umbreon", 'base5-1st-83': 'Dark Raichu', 'base2-1st-3': 'Flareon' };
const ids = Object.keys(CARDMARKET_URLS);

console.log('Scraping Cardmarket (TinyFish stealth) for 4 cards (sequential — parallel rate-limits)…');
const results = [];
for (const id of ids) {
  let listings = await scrapeCardmarketCard(id);
  if (!listings.length) listings = await scrapeCardmarketCard(id); // one retry — agent occasionally returns empty
  results.push([id, listings]);
}

const out = { snapshotAt: new Date().toISOString(), source: 'cardmarket via tinyfish stealth agent', currency: 'EUR', cards: {} };
for (const [id, listings] of results) {
  const graded = listings.filter((l) => l.grade != null);
  const psa10 = listings.filter((l) => l.grader === 'PSA' && l.grade === 10);
  out.cards[id] = { name: NAMES[id], total: listings.length, graded: graded.length, psa10Count: psa10.length, listings };
  console.log(`  ${NAMES[id].padEnd(16)} ${listings.length} offers · ${graded.length} graded · ${psa10.length} PSA 10`);
  for (const l of psa10) console.log(`      PSA 10 €${l.priceEur}  ${l.seller}`);
}

const dir = join(ROOT, 'memwal', 'shared', 'listings');
mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, 'cardmarket-live.json'), JSON.stringify(out, null, 2));
console.log('\n✓ wrote memwal/shared/listings/cardmarket-live.json');
