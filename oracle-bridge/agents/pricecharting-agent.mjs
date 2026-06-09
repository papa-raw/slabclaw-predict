/// pricecharting-agent.mjs — PriceCharting sold comps specialist.
/// Richest source: 30-232+ graded sold comps per card from PC scraping.

import { BaseAgent } from './base-agent.mjs';

export class PricechartingAgent extends BaseAgent {
  constructor(config) {
    super('pricecharting', config);
  }

  async fetchPlatformData(cardId, cardData) {
    const grader = this.grader.toUpperCase();
    const grade = this.grade;

    // Report the REGISTRY's grade-matched current_oracle — the production-quality price that
    // already does recency-weighting (5 most recent sales), the eBay validation gate, and
    // contamination guards. Re-deriving a naive median from all 250 raw comps UNDER-prices
    // the card: old low sales drag it down (e.g. Dark Raichu $4,161 vs the real $7,987).
    const oracle = (cardData.oracles || []).find(
      (o) => (o.grader || '').toUpperCase() === grader && Number(o.grade) === grade && o.price > 0,
    );
    if (!oracle) return null;

    // T1 (real grade-matched sales) is trustworthy; T2 thinner; anything display-only weak.
    const realSale = /pc_sold/.test(oracle.source || '');
    const confidence = !realSale ? 0.35
      : oracle.tier === 1 ? Math.min(0.95, 0.65 + (oracle.saleCount || 0) * 0.05)
      : 0.6;

    return {
      cardId,
      platform: 'pricecharting',
      priceCents: Math.round(oracle.price * 100),
      priceUsd: oracle.price,
      confidence,
      source: oracle.source || 'pc_sold',
      compCount: oracle.saleCount || 0,
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
