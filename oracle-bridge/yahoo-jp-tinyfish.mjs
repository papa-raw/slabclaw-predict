/// yahoo-jp-tinyfish.mjs — Yahoo Auctions Japan CLOSED-auction (realized) scraper via the
/// TinyFish stealth browser agent. This is the genuinely-independent JP realized source the
/// Karen's Umbreon market needed: every other realized feed it had was eBay-origin. Yahoo
/// Auctions is the canonical Japanese secondary market, its closed-search page lists FINAL
/// winning prices (落札 = realized, not asks), and it shares no data lineage with eBay.
///
/// Only JP-market cards have a query here; non-JP cards return nothing (their realized
/// coverage already comes from eBay / PriceCharting / PSA APR / Goldin / Fanatics).

import { execFile } from 'node:child_process';

const USD_JPY = 150; // approximate FX for yen-denominated closing prices

// Yahoo Auctions "落札相場" (closed/sold price) search. p = query; only closed listings.
const yahooClosedUrl = (q) =>
  `https://auctions.yahoo.co.jp/closedsearch/closedsearch?p=${encodeURIComponent(q)}&n=50`;

// Per-card Japanese search strings. Must be CARD-SPECIFIC: "カリンのブラッキー" (Karen's
// Umbreon) alone matches several cheaper prints — the valuable one is the Pokémon Card VS
// series card (ポケモンカードVS), so the set name is part of the query.
export const YAHOO_JP_QUERIES = {
  'jp-vs-091': 'ポケモンカードVS カリンのブラッキー PSA10', // Karen's Umbreon, VS series, PSA 10
};

const GOAL =
  'This is a Yahoo Auctions Japan CLOSED (落札済み / sold) search results page. Extract every ' +
  'sold auction listed. Output ONLY a JSON array, one object per sold auction with keys: ' +
  'title (the auction title, keep Japanese), priceYen (the final winning price in yen as a ' +
  'plain number, no commas or ¥), isPsa10 (true only if the title clearly indicates a PSA 10 / ' +
  'PSA10 graded card, otherwise false), isVsSeries (true only if the title indicates the ' +
  'Pokémon Card VS series card — look for "VS" or "ポケモンカードVS"; false for other Karen\'s ' +
  'Umbreon prints). No prose, just the JSON array.';

function tfAgent(url, timeoutMs = 150000) {
  return new Promise((resolve) => {
    execFile('tinyfish',
      ['agent', 'run', '--sync', '--browser-profile', 'stealth', '--max-steps', '40', '--url', url, GOAL],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (!stdout) return resolve(null);
        try {
          const d = JSON.parse(stdout);
          const arr = d?.result?.result ?? d?.result ?? null;
          resolve(Array.isArray(arr) ? arr : null);
        } catch { return resolve(null); }
      });
  });
}

/// Scrape one card's Yahoo JP closed auctions → { priceUsd, compCount, salesUsd } | null.
/// Returns the MEDIAN of PSA-10 closing prices (realized), converted to USD.
export async function scrapeYahooJp(cardId) {
  const q = YAHOO_JP_QUERIES[cardId];
  if (!q) return null;
  const raw = await tfAgent(yahooClosedUrl(q));
  if (!raw || !raw.length) return null;

  // PSA-10 AND the VS-series card only — exclude cheaper Karen's Umbreon prints.
  const psa10Yen = raw
    .filter((o) => o && o.isPsa10 === true && o.isVsSeries === true && Number(o.priceYen) > 0)
    .map((o) => Number(o.priceYen))
    .sort((a, b) => a - b);
  if (!psa10Yen.length) return null;

  const medYen = psa10Yen[Math.floor(psa10Yen.length / 2)];
  return {
    priceUsd: Math.round(medYen / USD_JPY),
    compCount: psa10Yen.length,
    salesUsd: psa10Yen.map((y) => Math.round(y / USD_JPY)),
  };
}
