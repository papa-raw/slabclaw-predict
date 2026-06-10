/// fanatics-scraper.mjs — deterministic Fanatics Collect sold-history scraper.
///
/// Fanatics Collect (the PWCC successor) publishes a public, no-auth sold-items
/// search at sales-history.fanaticscollect.com. It is a genuinely INDEPENDENT
/// realized source — its own auction + buy-now tape, not eBay-derived — with a
/// deep dated history per card. This replaces the flaky search-snippet approach
/// (which depended on a web-search result happening to quote a grade-10 price).
///
/// We render the page, type the card query into the "Search Sold Items..." box,
/// read the result rows, filter to grade-matched PSA-10 realized sales within a
/// recency window, and return the median.

import { searchAndExtract } from './browser.mjs';

const SEARCH_URL = 'https://sales-history.fanaticscollect.com/';
const SEARCH_INPUT = 'input[placeholder="Search Sold Items..."]';
const RECENCY_DAYS = 540; // ~18mo — vintage PSA-10s sell a few times a year
const MIN_USD = 200, MAX_USD = 2_000_000;

// DOM extractor (runs in page context): each sold item is a "Sold on …" <p>;
// walk up to the card container that also holds the title + price, read all three
// as a unit so price/title/date never get cross-associated.
const FANATICS_EXTRACT = () => {
  const dateEls = Array.from(document.querySelectorAll('p')).filter((p) => /^Sold on /.test(p.textContent || ''));
  const out = [];
  for (const d of dateEls) {
    let el = d;
    for (let up = 0; up < 6 && el; up++) {
      el = el.parentElement;
      if (!el) break;
      const t = el.innerText || '';
      if (/pokemon/i.test(t) && /\$/.test(t) && t.length < 400) {
        const title = (t.split('\n').map((s) => s.trim()).find((s) => /pokemon/i.test(s))) || '';
        const price = (t.match(/\$\s?([\d][\d,]{2,})/) || [])[1] || '';
        out.push({ title, price, date: d.textContent.trim() });
        break;
      }
    }
  }
  return out;
};

// Each card needs a query precise enough to exclude other prints/grades. The
// title in results carries set + edition + number + "PSA 10", so we match on those.
const QUERIES = {
  'neo1-1st-18':  { q: 'Typhlosion Neo Genesis 1st Edition PSA 10', must: [/typhlosion/i, /neo\s*genesis/i] },
  'jp-vs-091':    { q: "Karen's Umbreon VS PSA 10", must: [/umbreon/i] },
  'base5-1st-83': { q: 'Dark Raichu Team Rocket 1st Edition PSA 10', must: [/dark\s*raichu/i, /rocket/i] },
  'base2-1st-3':  { q: 'Flareon Jungle 1st Edition PSA 10', must: [/flareon/i, /jungle/i] },
};

const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
function parseSoldDate(s) {
  // "Sold on Apr 12, 2026 in Auction"
  const m = /sold on\s+([a-z]{3})\w*\s+(\d{1,2}),\s+(\d{4})/i.exec(s);
  if (!m) return null;
  const mo = MONTHS[m[1].toLowerCase()];
  if (mo == null) return null;
  return Date.UTC(Number(m[3]), mo, Number(m[2]));
}

/// Filter structured {title, price, date} rows into grade-matched, on-variant,
/// recent realized PSA-10 comps for a card.
export function filterFanaticsRows(rows, card, now = Date.now()) {
  if (!rows) return [];
  const comps = [];
  for (const r of rows) {
    const title = r.title || '';
    // grade gate: PSA 10 only — reject any other grade or grader in the title
    if (!/psa\s*10|gem\s*mint?\s*10/i.test(title)) continue;
    if (/\b(psa|bgs|cgc|sgc|beckett)\s*([1-9](?:\.5)?)\b/i.test(title.replace(/psa\s*10/ig, ''))) continue;
    // card-identity gate
    if (!card.must.every((re) => re.test(title))) continue;
    const sold = parseSoldDate(r.date || '');
    if (!sold || now - sold > RECENCY_DAYS * 86_400_000) continue;
    const usd = parseInt(String(r.price).replace(/,/g, ''), 10);
    if (!usd || usd < MIN_USD || usd > MAX_USD) continue;
    comps.push({ usd, soldMs: sold });
  }
  const seen = new Set();
  return comps.filter((c) => { const k = `${c.usd}@${c.soldMs}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/// Scrape one card's Fanatics realized history → { priceUsd, compCount, salesUsd } | null.
export async function scrapeFanatics(cardId) {
  const card = QUERIES[cardId];
  if (!card) return null;
  // Fanatics is a load-bearing independent family — give it a second attempt on an
  // empty first pass (its search can be slow under concurrent swarm load).
  // Poll until rows actually match THIS card — Fanatics renders default results
  // before the query filter lands, so "any rows" isn't good enough.
  const validate = (rows) => rows.some((r) => card.must.every((re) => re.test(r.title || '')));
  let comps = [];
  for (let attempt = 0; attempt < 2 && !comps.length; attempt++) {
    const rows = await searchAndExtract(SEARCH_URL, card.q, SEARCH_INPUT, FANATICS_EXTRACT, { waitMs: 6500, timeout: 45000, pollMs: 22000, validate });
    comps = filterFanaticsRows(rows, card);
  }
  if (!comps.length) return null;
  // Intra-source wrong-variant guard: a title can pass the grade+identity gates but
  // still be a cheaper print (unlimited, off-variant). Drop comps far below the set's
  // own median before settling — the legit grade-matched cluster dominates.
  const center = median(comps.map((c) => c.usd));
  comps = comps.filter((c) => c.usd >= center * 0.4 && c.usd <= center * 3.0);
  if (!comps.length) return null;
  // most recent first; cap to the 5 freshest so an old cluster can't drag the median
  comps.sort((a, b) => b.soldMs - a.soldMs);
  const recent = comps.slice(0, 5).map((c) => c.usd);
  return { priceUsd: Math.round(median(recent)), compCount: recent.length, salesUsd: recent };
}

// CLI: node fanatics-scraper.mjs <cardId>
if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] || 'base5-1st-83';
  const r = await scrapeFanatics(id);
  const { closeBrowser } = await import('./browser.mjs');
  console.log(`${id}:`, r ? `$${r.priceUsd} (${r.compCount} comps: ${r.salesUsd.join(', ')})` : 'no data');
  await closeBrowser();
}
