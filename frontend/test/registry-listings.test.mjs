/// Regression test for the "ALT $1.8k dead listing" bug: the PSA-10 listings
/// ladder must never surface auction bids, link-less rows, or implausibly-low
/// (wrong-grade/variant/dead-auction) prices. Run: node --test test/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';

// Re-declare the predicate to test it without importing the Vite-only JSON module.
// MUST stay byte-identical to isSurfaceableListing in src/lib/registry.js.
function isSurfaceableListing(l, oracleAnchorPrice) {
  if (!l || l.price == null || l.price <= 0) return false;
  const type = (l.listing_type || l.type || '').toString().toLowerCase();
  if (type === 'bid') return false;
  if (!l.url) return false;
  const oracle = oracleAnchorPrice ?? l.oracle_price ?? l.oracle_anchor?.price ?? null;
  if (oracle != null && oracle > 0 && l.price < 0.4 * oracle) return false;
  return true;
}

const snap = JSON.parse(readFileSync(new URL('../src/data/registry-snapshot.json', import.meta.url)));

test('predicate rejects the ALT auction-bid that caused the bug', () => {
  const altBid = { platform: 'alt', grader: 'PSA', grade: 10, price: 1765, listing_type: 'bid', url: 'https://alt.xyz/itm/cfe0ca8b' };
  assert.equal(isSurfaceableListing(altBid, 7986.56), false);
});

test('predicate rejects link-less and implausibly-low rows', () => {
  assert.equal(isSurfaceableListing({ price: 5000, url: null }, 8000), false);
  assert.equal(isSurfaceableListing({ price: 80, url: 'x', listing_type: 'buy' }, 8000), false); // 1% of oracle
});

test('predicate keeps a real (high) PSA-10 ask', () => {
  const ebay = { platform: 'ebay', price: 14999.95, listing_type: 'buy', url: 'https://ebay.com/itm/188060533997' };
  assert.equal(isSurfaceableListing(ebay, 7986.56), true);
});

test('cleaned snapshot surfaces no junk in any displayed grade band', () => {
  const offenders = [];
  for (const [cid, c] of Object.entries(snap)) {
    for (const b of c.bands || []) {
      for (const l of b.listings || []) {
        if (!isSurfaceableListing(l, b.oracle_anchor?.price)) {
          offenders.push(`${cid} band${b.grade_band} ${l.platform} $${l.price}`);
        }
      }
    }
  }
  assert.deepEqual(offenders, [], `snapshot still contains junk listings: ${offenders.join(', ')}`);
});

test('Dark Raichu PSA-10 ladder no longer contains the $1765 ALT row', () => {
  const raichu = snap['base5-1st-83'];
  const psa10 = (raichu.bands || []).filter((b) => Number(b.grade_band) === 10)
    .flatMap((b) => b.listings || [])
    .filter((l) => String(l.grader).toUpperCase() === 'PSA' && Number(l.grade) === 10);
  assert.equal(psa10.some((l) => Math.round(l.price) === 1765), false);
});
