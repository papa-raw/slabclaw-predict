/// goldin-agent.mjs — Goldin Auctions source specialist.
/// Realized auction prices (weekly TCG/Pokemon auctions).

import { BaseAgent } from './base-agent.mjs';

export class GoldinAgent extends BaseAgent {
  constructor(config) {
    super('goldin', config);
  }

  async fetchPlatformData(cardId, cardData) {
    const grader = this.grader.toUpperCase();
    const grade = this.grade;

    // Goldin appears in both deals and listings
    const goldinData = [];
    for (const band of cardData.bands || []) {
      for (const l of band.listings || []) {
        if (l.platform === 'goldin' &&
            (l.grader || '').toUpperCase() === grader &&
            Number(l.grade) === grade) {
          goldinData.push(l);
        }
      }
    }

    // Also check sold transactions
    for (const tx of cardData.soldTransactions || []) {
      if ((tx.platform || '').toLowerCase() === 'goldin' &&
          (tx.grader || '').toUpperCase() === grader &&
          Number(tx.grade) === grade) {
        goldinData.push({ ...tx, price: tx.salePrice || tx.price || tx.soldPrice });
      }
    }

    if (goldinData.length === 0) return null;

    const prices = goldinData.map((d) => d.price).filter(Boolean);
    if (prices.length === 0) return null;
    prices.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];

    return {
      cardId,
      platform: 'goldin',
      priceCents: Math.round(median * 100),
      priceUsd: median,
      // Auction realized prices are strong signal
      confidence: Math.min(0.85, goldinData.length / 3),
      source: 'goldin_auction',
      compCount: goldinData.length,
      comps: goldinData.slice(0, 5).map((d) => ({ price: d.price, date: d.date || d.endTime })),
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
