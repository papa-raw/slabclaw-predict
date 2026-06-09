/// point130.mjs — 130point.com SOLD-comp scraper. The credit-free, browser-native source
/// that replaces the TinyFish auction-house agents (Goldin / Fanatics) when credits are out.
///
/// 130point aggregates COMPLETED (realized) sales across eBay + Goldin + Heritage + Pristine
/// + Fanatics + MySlabs, grade-searchable, each row stamped with its sold date. We read the
/// "Sold" tab and keep only rows carrying a past-date stamp (the realized comps), discarding
/// the "Live"/"Fixed Price Listing"/countdown rows (those are asks, handled elsewhere).
///
/// Requires a HEADED stealth Chromium (patchright): 130point sits behind Cloudflare, which a
/// headless browser trips. The production fleet uses the same patchright trick.

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const BK = '/Users/pat/Desktop/1_projects/slabclaw/slabclaw-app/backend/node_modules';

let _browser = null;

async function getBrowser() {
  if (_browser && _browser.isConnected()) return _browser;
  const { chromium } = require(`${BK}/patchright`);
  _browser = await chromium.launch({ headless: false, args: ['--no-sandbox'] });
  return _browser;
}

export async function close130() {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; }
}

// A SOLD row ends in a past-date stamp like "06 Jun 26 06:16:14" / "13 Apr 26".
// A LIVE row ends in a countdown ("5d 5h 57m") or says "Fixed Price Listing".
const SOLD_DATE = /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\s+(\d{2})\b/i;
const LIVE_COUNTDOWN = /\b\d+d\s+\d+h\s+\d+m\b/i;
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };

// Parse 130point's "DD Mon YY" sold stamp to a Date (20YY). Returns null if absent.
function parseSoldDate(text) {
  const m = text.match(SOLD_DATE);
  if (!m) return null;
  const d = new Date(2000 + Number(m[3]), MONTHS[m[2].toLowerCase()], Number(m[1]));
  return isNaN(d.getTime()) ? null : d;
}

/// Scrape realized SOLD comps for a query. Returns [{ title, priceUsd, saleType, soldDate,
/// ageDays, raw }], newest first, optionally filtered to a freshness window.
export async function searchSold130(query, { waitMs = 9000, withinDays = null } = {}) {
  const b = await getBrowser();
  const page = await b.newPage({ viewport: { width: 1400, height: 1700 } });
  try {
    await page.goto('https://130point.com/sales/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(7000); // let Cloudflare clear

    for (const label of ['Accept', 'Accept all', 'I agree', 'Got it']) {
      try { const btn = page.getByRole('button', { name: label, exact: false }); if (await btn.count()) { await btn.first().click({ timeout: 1500 }); break; } } catch { /* ignore */ }
    }

    const input = await page.$('input[type=search]');
    if (!input) return [];
    await input.fill(query);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(waitMs);

    // Switch to the SOLD tab (force-click: the tab fails Playwright's actionability check).
    await page.evaluate(() => { document.querySelectorAll('#sold-tab').forEach((e) => e.click()); }).catch(() => {});
    await page.waitForTimeout(4000);
    // Scroll to pull in lazily-rendered sold rows.
    for (let i = 0; i < 4; i++) { await page.evaluate(() => window.scrollBy(0, 2000)); await page.waitForTimeout(800); }

    const rows = await page.evaluate(() => {
      const all = [...document.querySelectorAll('div,li,tr,article')];
      const cand = all.filter((e) => { const t = e.innerText || ''; return /\$[0-9][0-9,]{2,}/.test(t) && t.length > 40 && t.length < 460; });
      const seen = new Set(); const out = [];
      for (const e of cand) { const t = (e.innerText || '').replace(/\s+/g, ' ').trim(); if (!seen.has(t)) { seen.add(t); out.push(t); } }
      return out;
    });

    const now = Date.now();
    const sold = [];
    for (const text of rows) {
      const soldDate = parseSoldDate(text);
      if (!soldDate || LIVE_COUNTDOWN.test(text)) continue; // realized only
      const ageDays = Math.round((now - soldDate.getTime()) / 86400000);
      if (withinDays != null && ageDays > withinDays) continue;
      // The realized price is the LAST $-amount before the date (handles "ask $X accepted $Y").
      const prices = [...text.matchAll(/\$([0-9][0-9,]*(?:\.[0-9]{2})?)/g)].map((m) => parseFloat(m[1].replace(/,/g, '')));
      if (!prices.length) continue;
      const priceUsd = prices[prices.length - 1];
      const saleType = /best offer accepted/i.test(text) ? 'best-offer'
        : /auction|bids/i.test(text) ? 'auction'
        : 'fixed';
      sold.push({ title: text.replace(/\$[0-9].*$/, '').trim().slice(0, 120), priceUsd, saleType, soldDate, ageDays, raw: text });
    }
    sold.sort((a, b) => a.ageDays - b.ageDays); // newest first
    return sold;
  } finally {
    await page.close().catch(() => {});
  }
}
