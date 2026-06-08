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

    const comps = (cardData.soldComps || []).filter(
      (c) => (c.grader || '').toUpperCase() === grader && Number(c.grade) === grade && c.price > 0,
    );

    if (comps.length === 0) return null;

    const prices = comps.map((c) => c.price);
    prices.sort((a, b) => a - b);
    const median = prices[Math.floor(prices.length / 2)];

    // Recent comps weighted higher
    const now = Date.now();
    const recentComps = comps.filter((c) => {
      if (!c.sale_date) return true;
      return now - new Date(c.sale_date).getTime() < 30 * 86400000;
    });

    const recentMedian = recentComps.length >= 3
      ? (() => { const p = recentComps.map((c) => c.price).sort((a, b) => a - b); return p[Math.floor(p.length / 2)]; })()
      : null;

    const finalPrice = recentMedian || median;

    return {
      cardId,
      platform: 'pricecharting',
      priceCents: Math.round(finalPrice * 100),
      priceUsd: finalPrice,
      confidence: Math.min(0.95, comps.length / 10),
      source: recentMedian ? 'pc_sold_recent' : 'pc_sold_all',
      compCount: comps.length,
      recentCount: recentComps.length,
      comps: comps.slice(-5).map((c) => ({ price: c.price, date: c.sale_date, url: c.url })),
      observedAt: new Date().toISOString(),
      flags: [],
    };
  }
}
