/// tinyfish.mjs — thin wrapper over the TinyFish CLI so source agents can scrape
/// their OWN venue directly (independent of the SlabClaw backend). This is what
/// makes the swarm a real source-specialist swarm instead of one feed relabeled.
///
/// Two primitives: tfSearch (web search → results[]) and tfFetch (URL → markdown).
/// Plus tfResolve ("google into" a page: search, then take the first result whose
/// host matches) and grade-matched price extractors.
///
/// SELF-HEALING: when the TinyFish CLI fails (credits exhausted, rate-limited,
/// not installed), a circuit breaker opens and every call transparently routes
/// through the backup transport — the patchright stealth browser (browser.mjs,
/// headed when Cloudflare demands it) for fetches and DuckDuckGo-HTML for
/// search. The swarm never goes blind because an API ran dry.

import { execFile } from 'node:child_process';
import { renderText } from './browser.mjs';

// ── TinyFish circuit breaker ────────────────────────────────────────────────
// Open after this many consecutive CLI failures; everything then goes straight
// to the backup transport for the rest of the process (and logs it once).
const TF_TRIP_AFTER = 2;
let _tfFailures = 0;
let _tfDown = false;
let _tfDownLogged = false;

function tfAvailable() {
  return !_tfDown;
}
function tfRecordResult(ok) {
  if (ok) { _tfFailures = 0; return; }
  _tfFailures++;
  if (_tfFailures >= TF_TRIP_AFTER && !_tfDown) {
    _tfDown = true;
    if (!_tfDownLogged) {
      _tfDownLogged = true;
      console.log('  [tinyfish] CLI unavailable (credits/limits) — backup browser transport engaged for this run');
    }
  }
}

function runCli(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile('tinyfish', args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout, stderr) => {
      // Credit exhaustion / quota errors come back on stderr with empty stdout —
      // treat any empty/unparseable response as a CLI failure for the breaker.
      if (err || !stdout) return resolve(null);
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}

// ── Backup search: DuckDuckGo HTML endpoint (no JS, no API, parseable) ──────
async function ddgSearch(query, timeoutMs = 20000) {
  try {
    const resp = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36' },
      signal: AbortSignal.timeout?.(timeoutMs),
    });
    if (!resp.ok) return [];
    const html = await resp.text();
    const out = [];
    // result blocks: <a class="result__a" href="…">title</a> … <a class="result__snippet">snippet</a>
    const re = /<a[^>]*class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>)?/g;
    let m;
    while ((m = re.exec(html)) !== null && out.length < 10) {
      let url = m[1];
      // DDG wraps results: //duckduckgo.com/l/?uddg=<encoded>&rut=…
      const uddg = /[?&]uddg=([^&]+)/.exec(url);
      if (uddg) url = decodeURIComponent(uddg[1]);
      const strip = (s) => (s || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
      out.push({ position: out.length + 1, site_name: '', title: strip(m[2]), snippet: strip(m[3]), url });
    }
    return out;
  } catch {
    return [];
  }
}

/// Web search. Returns [{ position, site_name, title, snippet, url }].
/// TinyFish when available; DuckDuckGo-HTML backup otherwise.
export async function tfSearch(query, timeoutMs = 45000) {
  if (tfAvailable()) {
    const d = await runCli(['search', 'query', query], timeoutMs);
    const results = Array.isArray(d?.results) ? d.results : null;
    tfRecordResult(results !== null);
    if (results !== null) return results;
  }
  return ddgSearch(query);
}

/// Fetch a URL as markdown/text. Returns { text, finalUrl }.
/// TinyFish when available; patchright stealth browser (headless→headed) backup.
export async function tfFetch(url, timeoutMs = 70000) {
  if (tfAvailable()) {
    const d = await runCli(['fetch', 'content', 'get', url], timeoutMs);
    const r = (Array.isArray(d?.results) ? d.results[0] : d) || {};
    const ok = !!r.text;
    tfRecordResult(ok);
    if (ok) return { text: r.text, finalUrl: r.final_url || url };
  }
  const text = await renderText(url, { timeout: Math.min(timeoutMs, 45000) });
  return { text: text || '', finalUrl: url };
}

/// "Google into" a page: search, return the first result URL whose host matches.
export async function tfResolve(query, hostIncludes) {
  const results = await tfSearch(query);
  const hit = results.find((r) => (r.url || '').includes(hostIncludes));
  return hit?.url || null;
}

/// Extract grade-10 prices from snippet/markdown text. Each $amount is paired with
/// a nearby PSA-10 / GEM-MT-10 token so we never grab a PSA-9, raw, or off-grade
/// price. Returns an array of integer dollars within a sane band.
const GRADE10 = /(PSA\s*GEM\s*MT?\s*10|GEM[\s-]*MINT\s*10|GEM[\s-]*MT?\s*10|PSA\s*10)\b/ig;
export function grade10Prices(text) {
  if (!text) return [];
  const out = [];
  GRADE10.lastIndex = 0;
  let m;
  while ((m = GRADE10.exec(text)) !== null) {
    const window = text.slice(m.index, m.index + 64); // look just after the grade token
    const pm = window.match(/\$\s?([\d][\d,]{2,})(?:\.\d{2})?/);
    if (pm) {
      const v = parseInt(pm[1].replace(/,/g, ''), 10);
      if (v >= 100 && v <= 2_000_000) out.push(v);
    }
  }
  return out;
}

/// Parse the "Prices By Grade" table on a psacard.com CardFacts page → the
/// GEM-MT 10 row's { mostRecent, average }. The row is newline-separated:
///   GEM - MT 10 / $mostRecent / $average / $psaPrice / population
export function psaCardfactsGem10(text) {
  if (!text) return null;
  // Anchor inside the "Prices By Grade" table — the Condition Census section above
  // also says "GEM MT 10 (246)" (no dash), which would mis-anchor the parse.
  let body = text;
  const pbg = text.search(/Prices\s+By\s+Grade/i);
  if (pbg >= 0) body = text.slice(pbg);
  // The prices-table row is "GEM - MT 10" (with dash); the census has no dash.
  const idx = body.search(/GEM\s*-\s*MT\s*10/i);
  if (idx < 0) return null;
  const seg = body.slice(idx, idx + 160); // row: GEM-MT10 / $mostRecent / $average / $psaPrice / pop
  const amts = [...seg.matchAll(/\$\s?([\d][\d,]{2,})(?:\.\d{2})?/g)]
    .map((x) => parseInt(x[1].replace(/,/g, ''), 10))
    .filter((v) => v >= 100 && v <= 2_000_000);
  if (amts.length === 0) return null;
  return { mostRecent: amts[0] ?? null, average: amts[1] ?? amts[0] };
}

export function median(arr) {
  if (!arr || arr.length === 0) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
