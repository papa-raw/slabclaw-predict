/// tcgplayer-agent.mjs — TCGPlayer source specialist.
/// Active marketplace listings with grade-matched filtering.

import { BaseAgent } from './base-agent.mjs';

export class TcgplayerAgent extends BaseAgent {
  constructor(config) {
    super('tcgplayer', config);
  }

  async fetchPlatformData(cardId, cardData) {
    const grader = this.grader.toUpperCase();
    const grade = this.grade;

    const listings = [];
    for (const band of cardData.bands || []) {
      for (const l of band.listings || []) {
        if (l.platform === 'tcgplayer' &&
            (l.grader || '').toUpperCase() === grader &&
            Number(l.grade) === grade) {
          listings.push(l);
        }
      }
    }

    if (listings.length === 0) return null;

    const prices = listings.map((l) => l.price).filter(Boolean);
    if (prices.length === 0) return null;
    prices.sort((a, b) => a - b);
    // TCGPlayer listings often have phantom entries — use median, not min
    const median = prices[Math.floor(prices.length / 2)];

    return {
      cardId,
      platform: 'tcgplayer',
      priceCents: Math.round(median * 100),
      priceUsd: median,
      confidence: Math.min(0.75, listings.length / 5),
      source: 'tcgplayer_active',
      compCount: listings.length,
      comps: listings.slice(0, 5).map((l) => ({ price: l.price, url: l.url })),
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
