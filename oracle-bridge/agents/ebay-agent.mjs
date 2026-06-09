/// ebay-agent.mjs — eBay source specialist.
/// Richest data: 160-380 listings per card. Extracts grade-matched active
/// listings + sold comps from the SlabClaw registry API.

import { BaseAgent } from './base-agent.mjs';

export class EbayAgent extends BaseAgent {
  constructor(config) {
    super('ebay', config);
  }

  async fetchPlatformData(cardId, cardData) {
    const grader = this.grader.toUpperCase();
    const grade = this.grade;

    // eBay grade-matched ACTIVE listings = the live ask floor (the cheapest you could buy a
    // matching slab for right now). Realized clearing prices come from the PriceCharting
    // agent via the registry's recency-weighted grade-matched oracle, so eBay is the
    // independent ASK-side signal that bounds the range rather than a second realized vote.
    const listings = [];
    for (const band of cardData.bands || []) {
      for (const l of band.listings || []) {
        if ((l.platform || '').toLowerCase() === 'ebay' &&
            (l.grader || '').toUpperCase() === grader &&
            Number(l.grade) === grade && l.price > 0) {
          listings.push(l);
        }
      }
    }
    if (listings.length === 0) return null;

    const prices = listings.map((l) => l.price).sort((a, b) => a - b);
    const floor = prices[0]; // lowest grade-matched ask = the buyable floor

    return {
      cardId,
      platform: 'ebay',
      priceCents: Math.round(floor * 100),
      priceUsd: floor,
      confidence: Math.min(0.6, listings.length / 8),
      source: 'ebay_active', // ask — bounds the range, never settles
      compCount: listings.length,
      comps: listings.slice(0, 8).map((l) => ({ price: l.price, seller: l.seller, url: l.url })),
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
