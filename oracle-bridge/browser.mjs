/// browser.mjs — the TinyFish FALLBACK. A real headless browser (system Chrome via
/// Playwright) that renders JS-heavy / lightly-protected source pages and returns their
/// text, so the swarm's source agents keep working when TinyFish is rate-limited or out of
/// credits. No API, no credits — just a rendered page we parse ourselves.
///
/// Playwright is borrowed from the SlabClaw backend install (chrome channel = the system
/// browser, which clears more bot checks than a bare headless build).

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
// Resolve the browser from wherever it's installed: this package's own
// node_modules first (a fresh clone that ran `npm i playwright`), then the
// SlabClaw backend's install if it happens to be present (the data-plane box).
// If neither resolves, the venue-direct fallback is simply unavailable and
// those agents skip — the swarm degrades to its restored MemWal memory.
const BACKEND_NM = '/Users/pat/Desktop/1_projects/slabclaw/slabclaw-app/backend/node_modules';
function tryRequire(...ids) {
  for (const id of ids) { try { return require(id); } catch { /* next */ } }
  return null;
}

// Two pools: headless (fast, fine for most venues) and HEADED (clears Cloudflare
// challenges that headless fingerprints trip — the 130point lesson).
const _pool = { headless: null, headed: null };

// Concurrency limiter: the swarm fires ~13 agents in parallel, but a single
// browser can't run several interactive scrapes at once — they thrash and time out.
// SERIALIZE by default (1): the slow interactive searches (Fanatics' sold-history
// polls ~22s for rows to render) get STARVED even at 2 — that silently dropped
// Umbreon's independent Fanatics/PWCC family in a swarm run while it worked fine
// standalone. Reliability > speed for a once-a-cycle data-plane scan. Override with
// BROWSER_CONCURRENCY=N for faster, less-reliable parallel scrapes.
const MAX_CONCURRENT = Number(process.env.BROWSER_CONCURRENCY) || 1;
let _active = 0;
const _waiters = [];
async function acquire() {
  if (_active < MAX_CONCURRENT) { _active++; return; }
  await new Promise((resolve) => _waiters.push(resolve));
  _active++;
}
function release() {
  _active--;
  const next = _waiters.shift();
  if (next) next();
}

async function getBrowser(headed = false) {
  const key = headed ? 'headed' : 'headless';
  if (!_pool[key] || !_pool[key].isConnected()) {
    // Prefer patchright (stealth Chromium) — its fingerprint clears Cloudflare / light bot
    // checks that trip a vanilla Playwright + system Chrome. Fall back to system Chrome if
    // the stealth browser can't launch (e.g. its binary isn't installed).
    const patch = tryRequire('patchright', `${BACKEND_NM}/patchright`);
    if (patch) {
      _pool[key] = await patch.chromium.launch({ headless: !headed, args: ['--no-sandbox'] });
      return _pool[key];
    }
    const pw = tryRequire('playwright', `${BACKEND_NM}/playwright`);
    if (!pw) throw new Error('no browser available — `npm i playwright` (or patchright) to enable the venue-direct fallback');
    _pool[key] = await pw.chromium.launch({ channel: 'chrome', headless: !headed, args: ['--no-sandbox'] });
  }
  return _pool[key];
}

// Best-effort dismiss of cookie / consent banners that otherwise dominate body.innerText.
async function dismissBanners(page) {
  const labels = ['Accept all', 'Accept All', 'Accept', 'I agree', 'Agree', 'Got it', 'Close', 'OK'];
  for (const t of labels) {
    try { const b = page.getByRole('button', { name: t, exact: false }); if (await b.count()) { await b.first().click({ timeout: 1500 }); break; } } catch { /* ignore */ }
  }
}

// A Cloudflare interstitial reads as a near-empty page with one of these markers.
const CF_MARKERS = /verify you are human|checking your browser|just a moment|cf-chl|enable javascript and cookies/i;
function looksBlocked(text) {
  return !text || text.length < 400 || CF_MARKERS.test(text.slice(0, 600));
}

/// Render a URL and return its visible text (document.body.innerText). null on failure.
/// Tries headless first; when the page looks like a bot-challenge, retries HEADED
/// (slow but clears Cloudflare). Pass { headed: true } to go straight to headed.
export async function renderText(url, { waitMs = 2500, timeout = 30000, headed = false } = {}) {
  await acquire();
  try {
  for (const useHeaded of headed ? [true] : [false, true]) {
    let page;
    try {
      const b = await getBrowser(useHeaded);
      page = await b.newPage({
        viewport: { width: 1280, height: 1800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(useHeaded ? 4500 : 1200); // headed: give the CF check time to clear
      await dismissBanners(page);
      await page.waitForTimeout(waitMs);
      const text = await page.evaluate(() => document.body.innerText);
      if (!looksBlocked(text)) return text;
    } catch { /* try the next mode */ } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  return null;
  } finally { release(); }
}

/// Render and run a DOM extraction fn in the page context. null on failure.
export async function renderEval(url, evalFn, { waitMs = 2500, timeout = 30000, headed = false } = {}) {
  await acquire();
  let page;
  try {
    const b = await getBrowser(headed);
    page = await b.newPage({ viewport: { width: 1280, height: 1800 } });
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
    await page.waitForTimeout(waitMs);
    return await page.evaluate(evalFn);
  } catch {
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    release();
  }
}

/// Load a page, type a query into a search box, submit, and return the rendered
/// text after results load. For venues (Fanatics) whose sold-history is a
/// client-side search rather than a URL the swarm can hit directly. null on failure.
export async function renderSearch(url, query, inputSelector, { waitMs = 6000, timeout = 45000, headed = false } = {}) {
  await acquire();
  try {
  for (const useHeaded of headed ? [true] : [false, true]) {
    let page;
    try {
      const b = await getBrowser(useHeaded);
      page = await b.newPage({
        viewport: { width: 1280, height: 1800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(useHeaded ? 4000 : 2500);
      await dismissBanners(page);
      const input = page.locator(inputSelector).first();
      await input.fill(query, { timeout: 8000 });
      await page.waitForTimeout(700);
      await input.press('Enter');
      await page.waitForTimeout(waitMs);
      const text = await page.evaluate(() => document.body.innerText);
      if (!looksBlocked(text)) return text;
    } catch { /* try next mode */ } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  return null;
  } finally { release(); }
}

/// Like renderSearch, but run a DOM-extraction fn in the page after results load
/// and return its result. Structured extraction beats parsing flattened innerText
/// when rows carry title/price/date that must not be cross-associated. null on failure.
/// opts.validate(rows) -> bool: decides whether the polled rows are the REAL
/// search results (not the page's pre-filter default rows that render first).
/// Without it, any non-empty extract is accepted. Critical for sites (Fanatics)
/// that show default content before the query filter applies.
export async function searchAndExtract(url, query, inputSelector, extractFn, { waitMs = 6500, timeout = 45000, headed = false, pollMs = 18000, validate = null } = {}) {
  await acquire();
  try {
  let best = null;
  for (const useHeaded of headed ? [true] : [false, true]) {
    let page;
    try {
      const b = await getBrowser(useHeaded);
      page = await b.newPage({
        viewport: { width: 1280, height: 1800 },
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
      });
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
      await page.waitForTimeout(useHeaded ? 4000 : 2500);
      await dismissBanners(page);
      const input = page.locator(inputSelector).first();
      await input.fill(query, { timeout: 8000 });
      await page.waitForTimeout(700);
      await input.press('Enter');
      await page.waitForTimeout(1500);
      // Async results render on their own clock AND the page may show default rows
      // before the query filter lands — POLL until rows pass validate(), not just
      // until any rows appear.
      const deadline = Date.now() + pollMs;
      while (Date.now() < deadline) {
        const txt = await page.evaluate(() => document.body.innerText);
        if (!looksBlocked(txt)) {
          const rows = await page.evaluate(extractFn);
          if (rows && rows.length) {
            if (!validate || validate(rows)) return rows;
            best = rows; // remember in case nothing ever validates
          }
        }
        await page.waitForTimeout(1500);
      }
    } catch { /* try next mode */ } finally {
      if (page) await page.close().catch(() => {});
    }
  }
  // Nothing validated across both modes. Return best-effort (caller re-filters).
  return best;
  } finally { release(); }
}

export async function closeBrowser() {
  for (const key of ['headless', 'headed']) {
    if (_pool[key]) { await _pool[key].close().catch(() => {}); _pool[key] = null; }
  }
}
