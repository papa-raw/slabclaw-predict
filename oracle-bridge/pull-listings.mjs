#!/usr/bin/env node
/// pull-listings.mjs — First / forward listing snapshot for the listing→sale
/// relation engine. Pulls CURRENT listings from the SlabClaw scanner (read-only,
/// via /api/registry/cards) for the 4 markets and writes a timestamped snapshot
/// into MemWal. Cardmarket is supplemented via TinyFish where the scanner doesn't
/// carry it. Each listing is keyed by its url (stable identity) so future runs can
/// detect disappearance→sale, relists, and ask↔realized divergence — the inputs to
/// manipulation measurement.
///
/// Run this each cycle: snapshot N → snapshot N+1 → diff = sales/relists/washes.

import { CONFIG } from './config.mjs';
import { tfSearch } from './tinyfish.mjs';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

const CARDS = [
  { id: 'neo1-1st-18',  name: 'Typhlosion',     cm: '2000 Pokemon Neo Genesis 1st Edition Typhlosion 18' },
  { id: 'jp-vs-091',    name: "Karen's Umbreon", cm: 'Karen Umbreon Pokemon Card VS 091 Japanese' },
  { id: 'base5-1st-83', name: 'Dark Raichu',     cm: '2000 Pokemon Team Rocket 1st Edition Dark Raichu 83' },
  { id: 'base2-1st-3',  name: 'Flareon',         cm: '1999 Pokemon Jungle 1st Edition Flareon 3' },
];

const MEMWAL = join(new URL('.', import.meta.url).pathname, 'memwal');

function normalize(l) {
  return {
    platform: (l.platform || l.marketplace || '?').toLowerCase(),
    listingId: l.url || null,           // url = stable cross-run identity
    url: l.url || null,
    price: l.price ?? null,
    grade: l.grade ?? null,
    grader: l.grader ?? null,
    gradeBand: l.grade_band ?? null,
    listingType: l.listing_type ?? 'listing',
    endTime: l.end_time ?? null,
    sellerCountry: l.sellerCountry ?? null,
    title: l.title ?? null,
  };
}

async function backendListings(cardId) {
  try {
    const r = await fetch(`${CONFIG.slabclawApi}/api/registry/cards?ids=${encodeURIComponent(cardId)}`, {
      signal: AbortSignal.timeout?.(8000),
    });
    if (!r.ok) return [];
    const d = await r.json();
    const c = d?.cards?.[0];
    // PSA 10 ONLY — every market in this universe is PSA 10; ignore other grades/graders.
    return (c?.bands || []).flatMap((b) => b.listings || [])
      .filter((l) => Number(l.grade) === 10 && /psa/i.test(String(l.grader || '')))
      .map(normalize);
  } catch { return []; }
}

const eur = (m) => (m ? parseFloat(m[1].replace(/\./g, '').replace(',', '.')) : null);

async function cardmarketViaTinyfish(cm) {
  // Cardmarket individual listings are CAPTCHA-gated; the public snippet carries the
  // market aggregate (From / Price Trend). Record it as one 'aggregate' entry so
  // Cardmarket is represented and trackable over time.
  const res = await tfSearch(`cardmarket ${cm} PSA 10 price from trend`);
  const hit = res.find((r) => /cardmarket\.com/i.test(r.url || ''));
  if (!hit) return [];
  const s = hit.snippet || '';
  const from = eur(s.match(/From:\s*([\d.,]+)\s*€/i));
  const trend = eur(s.match(/Trend:\s*([\d.,]+)\s*€/i));
  if (from == null && trend == null) return [];
  return [{
    platform: 'cardmarket', listingId: hit.url, url: hit.url,
    price: from, priceTrendEur: trend, currency: 'EUR',
    grade: 10, grader: 'PSA', listingType: 'aggregate', source: 'tinyfish', title: hit.title,
  }];
}

async function main() {
  const snapshotAt = new Date().toISOString();
  const out = { snapshotAt, source: 'slabclaw-scanner (ebay/cardmarket/…) + tinyfish(cardmarket fallback)', cards: {} };

  for (const card of CARDS) {
    // PSA 10 listings from the scanner. (Cardmarket's TinyFish snippet is a market
    // aggregate, not PSA-10-specific, so it's excluded — we only want PSA 10.)
    const listings = await backendListings(card.id);
    const counts = {};
    for (const l of listings) counts[l.platform] = (counts[l.platform] || 0) + 1;
    out.cards[card.id] = { name: card.name, counts, listings };
    console.log(`${card.name.padEnd(16)} ${String(listings.length).padStart(3)} listings  ${JSON.stringify(counts)}`);
  }

  const dir = join(MEMWAL, 'shared', 'listings');
  mkdirSync(dir, { recursive: true });
  const ts = snapshotAt.replace(/[:.]/g, '-');
  writeFileSync(join(dir, `${ts}.json`), JSON.stringify(out, null, 2));
  writeFileSync(join(dir, 'latest.json'), JSON.stringify(out, null, 2));

  // index of all snapshots (for the relation engine to diff over)
  const idxPath = join(dir, 'index.json');
  const idx = existsSync(idxPath) ? JSON.parse(readFileSync(idxPath, 'utf8')) : [];
  idx.push({ snapshotAt, file: `${ts}.json`, total: Object.values(out.cards).reduce((n, c) => n + c.listings.length, 0) });
  writeFileSync(idxPath, JSON.stringify(idx, null, 2));

  const total = idx[idx.length - 1].total;
  console.log(`\n✓ Listing snapshot #${idx.length}: ${total} listings across ${CARDS.length} cards`);
  console.log(`  → memwal/shared/listings/${ts}.json  (latest.json + index.json updated)`);
  if (idx.length === 1) console.log('  This is the FIRST entry — re-run later to diff for sales / relists / washes.');
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
