/// browser.mjs — the TinyFish FALLBACK. A real headless browser (system Chrome via
/// Playwright) that renders JS-heavy / lightly-protected source pages and returns their
/// text, so the swarm's source agents keep working when TinyFish is rate-limited or out of
/// credits. No API, no credits — just a rendered page we parse ourselves.
///
/// Playwright is borrowed from the SlabClaw backend install (chrome channel = the system
/// browser, which clears more bot checks than a bare headless build).

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const BK = '/Users/pat/Desktop/1_projects/slabclaw/slabclaw-app/backend/node_modules';

let _chromium = null;
let _browser = null;
let _stealth = false;

async function getBrowser() {
  // Prefer patchright (stealth Chromium) — its fingerprint clears Cloudflare / light bot
  // checks that trip a vanilla Playwright + system Chrome. Fall back to system Chrome if the
  // stealth browser can't launch (e.g. its binary isn't installed).
  if (!_browser || !_browser.isConnected()) {
    if (!_stealth) {
      try {
        const pw = require(`${BK}/patchright`).chromium;
        _browser = await pw.launch({ args: ['--no-sandbox'] });
        _chromium = pw; _stealth = true;
        return _browser;
      } catch { /* fall through to system Chrome */ }
    }
    if (!_chromium) _chromium = require(`${BK}/playwright`).chromium;
    _browser = await _chromium.launch({ channel: 'chrome', args: ['--no-sandbox'] });
  }
  return _browser;
}

// Best-effort dismiss of cookie / consent banners that otherwise dominate body.innerText.
async function dismissBanners(page) {
  const labels = ['Accept all', 'Accept All', 'Accept', 'I agree', 'Agree', 'Got it', 'Close', 'OK'];
  for (const t of labels) {
    try { const b = page.getByRole('button', { name: t, exact: false }); if (await b.count()) { await b.first().click({ timeout: 1500 }); break; } } catch { /* ignore */ }
  }
}

/// Render a URL and return its visible text (document.body.innerText). null on failure.
export async function renderText(url, { waitMs = 2500, timeout = 30000 } = {}) {
  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage({
      viewport: { width: 1280, height: 1800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(1200);
    await dismissBanners(page);
    await page.waitForTimeout(waitMs);
    return await page.evaluate(() => document.body.innerText);
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

/// Render and run a DOM extraction fn in the page context. null on failure.
export async function renderEval(url, evalFn, { waitMs = 2500, timeout = 30000 } = {}) {
  let page;
  try {
    const b = await getBrowser();
    page = await b.newPage({ viewport: { width: 1280, height: 1800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(waitMs);
    return await page.evaluate(evalFn);
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
  }
}

export async function closeBrowser() {
  if (_browser) { await _browser.close().catch(() => {}); _browser = null; }
}
