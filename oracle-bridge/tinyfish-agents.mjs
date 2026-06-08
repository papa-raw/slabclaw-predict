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

const CACHE_TTL = 6 * 3600 * 1000; // 6h — realized prices move slowly

/// Query metadata per product (good search strings matter for hit-rate).
export const CARD_META = {
  'neo1-1st-18':  { query: '2000 Pokemon Neo Genesis 1st Edition Typhlosion #18' },
  'jp-vs-091':    { query: 'Pokemon Card VS Umbreon Karen 091 Japanese 1st Edition' },
  'base5-1st-83': { query: '2000 Pokemon Team Rocket 1st Edition Dark Raichu #83' },
  'base2-1st-3':  { query: '1999 Pokemon Jungle 1st Edition Flareon #3' },
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
          const r = await this.fetchSignal(meta);
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
    const results = await tfSearch(`alt.xyz ${meta.query} PSA 10 value lowest price`);
    const prices = results
      .filter((r) => /alt\.xyz/i.test(r.url || '') && /PSA\s*10/i.test(r.snippet || ''))
      .flatMap((r) => {
        const s = r.snippet || '';
        const m = s.match(/Lowest price\s*\$?([\d,]+)/i) || s.match(/\$\s?([\d,]+)/);
        return m ? [parseInt(m[1].replace(/,/g, ''), 10)] : [];
      })
      .filter((v) => v >= 100 && v <= 2_000_000);
    const p = median(prices);
    if (!p) return null;
    return { priceCents: Math.round(p * 100), source: 'alt-ask', confidence: 0.4, compCount: 1 };
  }
}

/// Build the independent TinyFish source agents for a swarm config.
export function createTinyfishAgents(cfg) {
  const c = { ...cfg, cardMetas: cfg.cardMetas || CARD_META };
  return [new PsaAprAgent(c), new GoldinTfAgent(c), new FanaticsTfAgent(c), new AltTfAgent(c)];
}

export { TinyfishAgent, PsaAprAgent, GoldinTfAgent, FanaticsTfAgent, AltTfAgent };
