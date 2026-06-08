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

    // Extract eBay listings from bands
    const ebayListings = [];
    for (const band of cardData.bands || []) {
      for (const listing of band.listings || []) {
        if (listing.platform === 'ebay' &&
            (listing.grader || '').toUpperCase() === grader &&
            Number(listing.grade) === grade) {
          ebayListings.push(listing);
        }
      }
    }

    // Extract eBay sold transactions
    const ebayComps = [];
    for (const tx of cardData.soldTransactions || []) {
      if ((tx.platform || '').toLowerCase() === 'ebay' &&
          (tx.grader || '').toUpperCase() === grader &&
          Number(tx.grade) === grade) {
        ebayComps.push(tx);
      }
    }

    // Also pull from soldComps if available
    for (const comp of cardData.soldComps || []) {
      if ((comp.grader || '').toUpperCase() === grader &&
          Number(comp.grade) === grade) {
        ebayComps.push(comp);
      }
    }

    if (ebayListings.length === 0 && ebayComps.length === 0) return null;

    // Price signal: prefer sold comps (real clearing prices), fall back to active listings
    let priceCents, source, confidence;
    const comps = [];

    if (ebayComps.length > 0) {
      const prices = ebayComps.map((c) => c.price || c.soldPrice).filter(Boolean);
      if (prices.length === 0) return null;
      prices.sort((a, b) => a - b);
      const median = prices[Math.floor(prices.length / 2)];
      priceCents = Math.round(median * 100);
      source = 'ebay_sold';
      confidence = Math.min(1.0, prices.length / 5);
      for (const c of ebayComps) {
        comps.push({ price: c.price || c.soldPrice, seller: c.seller, date: c.date || c.endTime });
      }
    } else {
      const prices = ebayListings.map((l) => l.price).filter(Boolean);
      if (prices.length === 0) return null;
      prices.sort((a, b) => a - b);
      // Use 25th percentile of active listings (conservative — asking > sold)
      const p25idx = Math.max(0, Math.floor(prices.length * 0.25));
      priceCents = Math.round(prices[p25idx] * 100);
      source = 'ebay_active';
      confidence = Math.min(0.7, prices.length / 10); // active listings are weaker signal
      for (const l of ebayListings.slice(0, 10)) {
        comps.push({ price: l.price, seller: l.seller, url: l.url });
      }
    }

    return {
      cardId,
      platform: 'ebay',
      priceCents,
      priceUsd: priceCents / 100,
      confidence,
      source,
      compCount: ebayComps.length || ebayListings.length,
      comps,
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
