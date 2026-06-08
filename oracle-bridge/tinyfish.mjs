/// tinyfish.mjs — thin wrapper over the TinyFish CLI so source agents can scrape
/// their OWN venue directly (independent of the SlabClaw backend). This is what
/// makes the swarm a real source-specialist swarm instead of one feed relabeled.
///
/// Two primitives: tfSearch (web search → results[]) and tfFetch (URL → markdown).
/// Plus tfResolve ("google into" a page: search, then take the first result whose
/// host matches) and grade-matched price extractors.

import { execFile } from 'node:child_process';

function runCli(args, timeoutMs) {
  return new Promise((resolve) => {
    execFile('tinyfish', args, { timeout: timeoutMs, maxBuffer: 16 * 1024 * 1024 }, (err, stdout) => {
      if (!stdout) return resolve(null);
      try { resolve(JSON.parse(stdout)); } catch { resolve(null); }
    });
  });
}

/// Web search. Returns [{ position, site_name, title, snippet, url }].
export async function tfSearch(query, timeoutMs = 45000) {
  const d = await runCli(['search', 'query', query], timeoutMs);
  return Array.isArray(d?.results) ? d.results : [];
}

/// Fetch a URL as markdown. Returns { text, finalUrl }.
export async function tfFetch(url, timeoutMs = 70000) {
  const d = await runCli(['fetch', 'content', 'get', url], timeoutMs);
  const r = (Array.isArray(d?.results) ? d.results[0] : d) || {};
  return { text: r.text || '', finalUrl: r.final_url || url };
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
