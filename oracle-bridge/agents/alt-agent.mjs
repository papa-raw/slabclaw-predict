/// alt-agent.mjs — ALT.xyz source specialist.
/// Aggregated value estimates from sold transaction data.

import { BaseAgent } from './base-agent.mjs';

export class AltAgent extends BaseAgent {
  constructor(config) {
    super('alt', config);
  }

  async fetchPlatformData(cardId, cardData) {
    const grader = this.grader.toUpperCase();
    const grade = this.grade;

    // ALT data appears in soldTransactions
    const altComps = [];
    for (const tx of cardData.soldTransactions || []) {
      if ((tx.platform || '').toLowerCase() === 'alt' &&
          (tx.grader || '').toUpperCase() === grader &&
          Number(tx.grade) === grade) {
        altComps.push(tx);
      }
    }

    // Also check alt_items if referenced in bands
    const altListings = [];
    for (const band of cardData.bands || []) {
      for (const l of band.listings || []) {
        if (l.platform === 'alt' &&
            (l.grader || '').toUpperCase() === grader &&
            Number(l.grade) === grade) {
          altListings.push(l);
        }
      }
    }

    const allPrices = [
      ...altComps.map((c) => c.salePrice || c.price || c.soldPrice).filter(Boolean),
      ...altListings.map((l) => l.price).filter(Boolean),
    ];

    if (allPrices.length === 0) return null;

    allPrices.sort((a, b) => a - b);
    const median = allPrices[Math.floor(allPrices.length / 2)];

    return {
      cardId,
      platform: 'alt',
      priceCents: Math.round(median * 100),
      priceUsd: median,
      // ALT is an aggregator, not raw comps — lower base confidence
      confidence: Math.min(0.7, allPrices.length / 3),
      source: altComps.length > 0 ? 'alt_sold' : 'alt_listing',
      compCount: allPrices.length,
      comps: altComps.slice(0, 5).map((c) => ({ price: c.salePrice || c.price || c.soldPrice, date: c.saleDate || c.date })),
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
