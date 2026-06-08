/// collector-crypt-agent.mjs — Collector Crypt (Solana pNFTs via MagicEden) specialist.

import { BaseAgent } from './base-agent.mjs';

export class CollectorCryptAgent extends BaseAgent {
  constructor(config) {
    super('collector-crypt', config);
  }

  async fetchPlatformData(cardId, cardData) {
    const grader = this.grader.toUpperCase();
    const grade = this.grade;

    const listings = [];
    for (const band of cardData.bands || []) {
      for (const l of band.listings || []) {
        if ((l.platform === 'collector-crypt' || l.platform === 'magiceden') &&
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
    const median = prices[Math.floor(prices.length / 2)];

    return {
      cardId,
      platform: 'collector-crypt',
      priceCents: Math.round(median * 100),
      priceUsd: median,
      confidence: Math.min(0.7, listings.length / 3),
      source: 'collector_crypt_active',
      compCount: listings.length,
      comps: listings.slice(0, 5).map((l) => ({ price: l.price, url: l.url })),
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
