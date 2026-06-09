/// cardmarket-tinyfish.mjs — LIVE Cardmarket graded-listing scraper via the TinyFish
/// stealth browser agent. This is the path that finally beats Cardmarket's Cloudflare
/// (the fleet + local Playwright scrapers were CF-blocked on the product page; the
/// TinyFish stealth agent renders it and extracts the offers — including the grade,
/// which Cardmarket hides in the seller's comment, not the condition badge).

import { execFile } from 'node:child_process';

export const CARDMARKET_URLS = {
  'neo1-1st-18': 'https://www.cardmarket.com/en/Pokemon/Products/Singles/Neo-Genesis/Typhlosion-NG18?language=1&minCondition=3&isFirstEd=Y',
  'jp-vs-091': 'https://www.cardmarket.com/en/Pokemon/Products/Singles/Pokemon-CardVS/Karens-Umbreon',
  'base5-1st-83': 'https://www.cardmarket.com/en/Pokemon/Products/Singles/Team-Rocket/Dark-Raichu-TR83?language=1&minCondition=3&isFirstEd=Y',
  'base2-1st-3': 'https://www.cardmarket.com/en/Pokemon/Products/Singles/Jungle/Flareon-V1-JU3?language=1&minCondition=3&isFirstEd=Y',
};

const GOAL =
  "Extract every seller offer in the offers table on this Cardmarket page. Output ONLY a JSON array, " +
  "one object per offer with keys: seller, country, condition (the MT/NM/EX/GD badge), grade (the grade text " +
  "in the Product Information/comment column like 'PSA 9','BGS 9.5','CGC 9'; use '' if raw), priceEur (number). " +
  "No prose, just the JSON array.";

const GRADER_MAP = { BECKETT: 'BGS', PSA: 'PSA', BGS: 'BGS', CGC: 'CGC', SGC: 'SGC', AOG: 'AOG', AIG: 'AIG', GRAAD: 'GRAAD', CDZ: 'CDZ', ACE: 'ACE', TAG: 'TAG' };

function tfAgent(url, timeoutMs = 150000) {
  return new Promise((resolve) => {
    execFile('tinyfish',
      ['agent', 'run', '--sync', '--browser-profile', 'stealth', '--max-steps', '45', '--url', url, GOAL],
      { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 },
      (err, stdout) => {
        if (!stdout) return resolve(null);
        try {
          const d = JSON.parse(stdout);
          const arr = d?.result?.result ?? d?.result ?? null;
          resolve(Array.isArray(arr) ? arr : null);
        } catch { resolve(null); }
      });
  });
}

/// Parse "PSA 9" / "BGS 9,5" / "BECKETT 9" / "psa5" → { grader, grade }.
export function parseGrade(s) {
  if (!s) return { grader: null, grade: null };
  const m = String(s).match(/(PSA|BGS|BECKETT|CGC|SGC|AOG|AIG|GRAAD|CDZ|ACE|TAG)\s*(\d+(?:[.,]\d)?)/i);
  if (!m) return { grader: null, grade: null };
  return { grader: GRADER_MAP[m[1].toUpperCase()] || m[1].toUpperCase(), grade: parseFloat(m[2].replace(',', '.')) };
}

/// Scrape one card's Cardmarket offers → normalized listings (incl. grade from notes).
export async function scrapeCardmarketCard(cardId) {
  const url = CARDMARKET_URLS[cardId];
  if (!url) return [];
  const raw = await tfAgent(url);
  if (!raw) return [];
  return raw.map((o) => {
    const { grader, grade } = parseGrade(o.grade);
    return {
      platform: 'cardmarket', seller: o.seller, country: o.country, condition: o.condition,
      grader, grade, note: o.grade || null, priceEur: typeof o.priceEur === 'number' ? o.priceEur : null, currency: 'EUR',
    };
  }).filter((l) => l.priceEur > 0);
}

// CLI: node cardmarket-tinyfish.mjs <cardId>
if (import.meta.url === `file://${process.argv[1]}`) {
  const id = process.argv[2] || 'base5-1st-83';
  const ls = await scrapeCardmarketCard(id);
  console.log(`${id}: ${ls.length} offers`);
  for (const l of ls) console.log(`  ${(l.grader ? `${l.grader} ${l.grade}` : 'raw').padEnd(10)} €${l.priceEur}  ${l.seller} (${l.country})`);
}
