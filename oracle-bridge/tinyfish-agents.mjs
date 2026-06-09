/// tinyfish-agents.mjs — genuinely-independent source-specialist agents that
/// scrape their OWN venue via TinyFish, NOT the SlabClaw backend. This is the fix
/// for the "PriceCharting + eBay are the same eBay-sold data" problem: PSA APR,
/// Goldin and Fanatics/PWCC are independent realized-price origins, so a market
/// can reach 3+ truly-independent sources for settlement.
///
/// Each agent caches its result per card in MemWal for CACHE_TTL so repeat swarm
/// runs are fast and the memory "warms" over time (the track's "smarter every run").

import { BaseAgent } from './agents/base-agent.mjs';
import { tfSearch, tfFetch, tfResolve, grade10Prices, psaCardfactsGem10, median } from './tinyfish.mjs';
import { scrapeYahooJp } from './yahoo-jp-tinyfish.mjs';
import { searchSold130, close130 } from './point130.mjs';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const MEMWAL = join(new URL('.', import.meta.url).pathname, 'memwal');
const EUR_USD = 1.08; // approximate FX for EUR-denominated Cardmarket asks

const CACHE_TTL = 6 * 3600 * 1000; // 6h — realized prices move slowly

/// Query metadata per product (good search strings matter for hit-rate).
export const CARD_META = {
  'neo1-1st-18':  { query: '2000 Pokemon Neo Genesis 1st Edition Typhlosion #18', point130Tokens: ['typhlosion'] },
  'jp-vs-091':    { query: 'Pokemon Card VS Umbreon Karen 091 Japanese 1st Edition', point130Tokens: ['umbreon'] },
  'base5-1st-83': { query: '2000 Pokemon Team Rocket 1st Edition Dark Raichu #83', point130Tokens: ['dark raichu'] },
  'base2-1st-3':  { query: '1999 Pokemon Jungle 1st Edition Flareon #3', point130Tokens: ['flareon'] },
};

class TinyfishAgent extends BaseAgent {
  constructor(platform, config = {}) {
    super(platform, config);
    this.metas = config.cardMetas || CARD_META;
  }

  // Subclasses implement: async fetchSignal(meta) -> { priceCents, source, confidence, compCount } | null
  async fetchSignal() { throw new Error(`${this.platform}: fetchSignal not implemented`); }

  // Override BaseAgent.run() — no backend dependency; drive off card metadata + TinyFish.
  async run() {
    const signals = [];
    const log = { platform: this.platform, timestamp: new Date().toISOString(), cards: {} };

    for (const cardId of this.cardIds) {
      const meta = this.metas[cardId];
      if (!meta) { log.cards[cardId] = { error: 'no card meta' }; continue; }
      try {
        // Warm cache: reuse a recent observation from this platform's memory.
        const mem = this.readCardMemory(cardId);
        const last = mem.observations?.[mem.observations.length - 1];
        let priceCents, source, confidence, compCount, cached = false;

        if (last?.priceCents > 0 && (Date.now() - new Date(last.date).getTime()) < CACHE_TTL) {
          ({ priceCents, confidence } = last);
          source = last.source; compCount = last.comps; cached = true;
        } else {
          const r = await this.fetchSignal(meta, cardId);
          if (!r || r.priceCents == null) { log.cards[cardId] = { error: 'no data from venue' }; continue; }
          ({ priceCents, source, confidence, compCount } = r);
        }

        const raw = {
          cardId, priceCents,
          confidence: confidence ?? 0.6,
          compCount: compCount ?? 1,
          source: source || this.platform,
          platform: this.platform,
          observedAt: new Date().toISOString(),
        };
        const cardMem = this.readCardMemory(cardId);
        const { signal, flags } = this.applyCircuitBreakers(raw, cardMem);
        this.updateCardMemory(cardId, signal, flags);
        if (!signal.rejected) signals.push(signal);
        log.cards[cardId] = { priceCents: signal.priceCents, confidence: signal.confidence, cached, flags };
      } catch (err) {
        log.cards[cardId] = { error: err.message };
      }
    }

    this.writeSignals(signals);
    this.writeMemory('state.json', { lastRun: new Date().toISOString(), signalsEmitted: signals.length });
    return { platform: this.platform, signals, log };
  }
}

/// PSA Auction Prices Realized — fetch the card's CardFacts page, read the
/// GEM-MT 10 row (PSA's own realized average). Independent of eBay/PriceCharting.
class PsaAprAgent extends TinyfishAgent {
  constructor(c) { super('psa-apr', c); }
  async fetchSignal(meta) {
    const url = meta.psaUrl
      || await tfResolve(`psacard cardfacts ${meta.query}`, 'psacard.com/cardfacts');
    if (!url) return null;
    // The cardfacts fetch is non-deterministic in how much of the page it returns;
    // retry until the "Prices By Grade" table is present. Table-only (no snippet
    // fallback) so we never mis-pair an off-grade price.
    let table = null;
    for (let i = 0; i < 3 && !table; i++) {
      const { text } = await tfFetch(url);
      table = psaCardfactsGem10(text);
    }
    if (!table) return null;
    const price = table.average ?? table.mostRecent;
    if (!price || price < 300) return null; // vintage PSA-10 here is well above $300 — guard mis-parse
    return { priceCents: Math.round(price * 100), source: 'psa-apr', confidence: 0.85, compCount: 3 };
  }
}

/// Goldin Auctions realized prices (independent auction house).
class GoldinTfAgent extends TinyfishAgent {
  constructor(c) { super('goldin', c); }
  async fetchSignal(meta) {
    const results = await tfSearch(`${meta.query} PSA 10 Goldin sold realized price`);
    const prices = results
      .filter((r) => /goldin/i.test((r.snippet || '') + (r.url || '')))
      .flatMap((r) => grade10Prices(r.snippet || ''));
    const p = median(prices);
    if (!p) return null;
    return { priceCents: Math.round(p * 100), source: 'goldin-auctions', confidence: 0.8, compCount: prices.length || 1 };
  }
}

/// Fanatics Collect / PWCC realized + buy-now (independent marketplace).
class FanaticsTfAgent extends TinyfishAgent {
  constructor(c) { super('fanatics', c); }
  async fetchSignal(meta) {
    const results = await tfSearch(`${meta.query} PSA 10 Fanatics Collect PWCC sold price`);
    const prices = results
      .filter((r) => /fanaticscollect|pwcc/i.test((r.snippet || '') + (r.url || '')))
      .flatMap((r) => grade10Prices(r.snippet || ''));
    const p = median(prices);
    if (!p) return null;
    return { priceCents: Math.round(p * 100), source: 'fanatics-pwcc', confidence: 0.7, compCount: prices.length || 1 };
  }
}

/// ALT — public listings only (the model "ALT Value" is app-gated). Lowest ask is
/// an upper bound, so it ships at low confidence and is easily out-weighted/MAD-cut.
class AltTfAgent extends TinyfishAgent {
  constructor(c) { super('alt', c); }
  async fetchSignal(meta) {
    const results = await tfSearch(`alt.xyz ${meta.query} PSA 10 lowest price`);
    // Strict grade pairing — alt snippets mix grades ("PSA 9 $4,196 … PSA 10 …"),
    // so use grade10Prices (each $ must immediately follow a PSA-10/GEM-MT-10 token)
    // instead of grabbing the first dollar amount and landing on a PSA-9 price.
    const prices = results
      .filter((r) => /alt\.xyz/i.test(r.url || ''))
      .flatMap((r) => grade10Prices(r.snippet || ''));
    const p = median(prices);
    if (!p) return null;
    return { priceCents: Math.round(p * 100), source: 'alt-ask', confidence: 0.4, compCount: 1 };
  }
}

/// Cardmarket (EU) — genuinely independent of eBay. Reads the live graded ladder
/// scraped by scan-cardmarket.mjs (TinyFish stealth agent) and feeds the LOWEST PSA-10
/// ask (the floor). It's an ASK source, so the coordinator BOUNDS the consensus with it
/// (weight 0) rather than letting it vote in the settlement median.
class CardmarketLiveAgent extends TinyfishAgent {
  constructor(c) { super('cardmarket', c); }
  async fetchSignal(_meta, cardId) {
    const p = join(MEMWAL, 'shared', 'listings', 'cardmarket-live.json');
    if (!existsSync(p)) return null;
    let cm;
    try { cm = JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
    const psa10 = (cm.cards?.[cardId]?.listings || []).filter(
      (l) => String(l.grader).toUpperCase() === 'PSA' && Number(l.grade) === 10 && l.priceEur > 0);
    if (!psa10.length) return null;
    const lowEur = Math.min(...psa10.map((l) => l.priceEur)); // lowest ask = the floor
    return { priceCents: Math.round(lowEur * EUR_USD * 100), source: 'cardmarket-eu-ask', confidence: 0.5, compCount: psa10.length };
  }
}

/// Yahoo Auctions JAPAN — closed (落札 / realized) auction prices. The ONLY genuinely-
/// independent REALIZED source for the JP Umbreon market: every other realized feed it had
/// is eBay-origin. Scrapes the closed-search page via the stealth agent (see
/// yahoo-jp-tinyfish.mjs); only JP cards have a query, others return null. Thin and
/// auction-by-auction, so mid confidence — the coordinator's thin-source anchor band guards
/// against the wrong-variant grabs this rare card is prone to.
class YahooJpAgent extends TinyfishAgent {
  constructor(c) { super('yahoo-jp', c); }
  async fetchSignal(_meta, cardId) {
    const r = await scrapeYahooJp(cardId);
    if (!r || !(r.priceUsd > 0)) return null;
    return { priceCents: Math.round(r.priceUsd * 100), source: 'yahoo-jp-sold', confidence: 0.6, compCount: r.compCount };
  }
}

/// 130point.com realized SOLD comps — the CREDIT-FREE, browser-native source (no TinyFish
/// API). 130point aggregates COMPLETED sales across eBay + auction houses, grade-searchable,
/// each row stamped with its sold date; we recency-filter, strip non-single-card lots, and
/// take the median. The data is eBay-origin, so the coordinator dedups it into the eBay-sold
/// family (`point130 → ebay-sold` in SOURCE_FAMILY): it's a realized cross-check and a
/// credit-free BACKUP for the eBay vote when TinyFish/PriceCharting are unavailable — not a
/// new independent family. Runs a HEADED stealth browser; if no display is available the
/// fetch simply fails per-card and the swarm continues (graceful, optional).
class Point130Agent extends TinyfishAgent {
  constructor(c) { super('point130', c); }
  async fetchSignal(meta) {
    const rows = await searchSold130(meta.query, { withinDays: 365 });
    if (!rows?.length) return null;
    const tokens = (meta.point130Tokens || []).map((t) => t.toLowerCase());
    const clean = rows.filter((r) => {
      const t = r.title.toLowerCase();
      if (/pack|unopened|sealed|\blot\b|bundle|booster|complete set|jumbo|sticker|proxy/.test(t)) return false; // single graded card only
      // Grade-match strictly to PSA 10 — the grader the markets settle in. 130point mixes PSA
      // 7/8/9, raw, AND other graders. CGC 10 / BGS 10 trade at a steep discount to PSA 10
      // (different population), so mixing them corrupts the median: keep PSA 10 only, reject
      // any other grader and any sub-10 PSA. ("GEM MT/MINT 10" is PSA's own phrasing — allow
      // it only when no rival grader is named in the title.)
      const otherGrader = /\b(cgc|bgs|sgc|ace|tag)\b/.test(t);
      const isPsaTen = /\bpsa\s*10\b/.test(t) || (/gem\s*m(?:t|int)\s*10\b/.test(t) && !otherGrader);
      const isSubPsa = /\bpsa\s*[1-9](?:\.5)?\b/.test(t);
      if (!isPsaTen || otherGrader || isSubPsa) return false;
      return tokens.every((tok) => t.includes(tok));
    });
    if (!clean.length) return null;
    // Prefer a tight 180d window when it has enough comps; else fall back to the full 365d.
    const recent = clean.filter((r) => r.ageDays <= 180);
    const pool = recent.length >= 3 ? recent : clean;
    const med = median(pool.map((r) => r.priceUsd));
    if (!(med >= 300)) return null; // vintage PSA-10 here is well above $300 — guard mis-parse
    return {
      priceCents: Math.round(med * 100),
      source: 'point130-sold',
      confidence: pool.length >= 3 ? 0.72 : 0.5,
      compCount: pool.length,
    };
  }
  // Tear down the shared headed browser once all cards for this agent are done.
  async run() { try { return await super.run(); } finally { await close130(); } }
}

/// Build the independent TinyFish source agents for a swarm config.
export function createTinyfishAgents(cfg) {
  const c = { ...cfg, cardMetas: cfg.cardMetas || CARD_META };
  return [new PsaAprAgent(c), new GoldinTfAgent(c), new FanaticsTfAgent(c), new AltTfAgent(c), new CardmarketLiveAgent(c), new YahooJpAgent(c), new Point130Agent(c)];
}

export { TinyfishAgent, PsaAprAgent, GoldinTfAgent, FanaticsTfAgent, AltTfAgent, CardmarketLiveAgent, YahooJpAgent, Point130Agent };
