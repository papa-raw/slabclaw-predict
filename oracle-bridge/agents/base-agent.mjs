/// base-agent.mjs — Base class for oracle swarm source agents.
///
/// Each platform agent extends this, implementing fetchPlatformData().
/// The base handles: MemWal read/write, signal normalization, circuit breakers,
/// reliability tracking, anomaly logging.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const MEMWAL_ROOT = join(new URL('.', import.meta.url).pathname, '..', 'memwal');

// How long a cached observation can stand in for a failed fresh fetch. Vintage graded
// prices move slowly; beyond this the memory is too stale to resurrect.
const WARM_TTL_MS = 30 * 86400000; // 30 days

export class BaseAgent {
  constructor(platform, config = {}) {
    this.platform = platform;
    this.slabclawApi = config.slabclawApi || 'http://localhost:3456';
    this.cardIds = config.cardIds || [];
    this.grader = config.grader || 'PSA';
    this.grade = config.grade || 10;

    this.agentDir = join(MEMWAL_ROOT, 'agents', platform);
    this.cardsDir = join(this.agentDir, 'cards');
    this.sharedDir = join(MEMWAL_ROOT, 'shared');
    this.signalsDir = join(this.sharedDir, 'agent-signals');
    this.historyDir = join(this.signalsDir, 'history');

    mkdirSync(this.cardsDir, { recursive: true });
    mkdirSync(this.historyDir, { recursive: true });
  }

  // ── MemWal read/write ────────────────────────────────────────────────

  readMemory(file) {
    const p = join(this.agentDir, file);
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
  }

  writeMemory(file, data) {
    writeFileSync(join(this.agentDir, file), JSON.stringify(data, null, 2));
  }

  readCardMemory(cardId) {
    const p = join(this.cardsDir, `${cardId}.json`);
    if (!existsSync(p)) return { cardId, observations: [], anomalies: [] };
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return { cardId, observations: [], anomalies: [] }; }
  }

  writeCardMemory(cardId, data) {
    writeFileSync(join(this.cardsDir, `${cardId}.json`), JSON.stringify(data, null, 2));
  }

  readShared(file) {
    const p = join(this.sharedDir, file);
    if (!existsSync(p)) return null;
    try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; }
  }

  writeShared(file, data) {
    const dir = join(this.sharedDir, ...file.split('/').slice(0, -1));
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(this.sharedDir, file), JSON.stringify(data, null, 2));
  }

  // ── Fetch from SlabClaw backend ──────────────────────────────────────

  async fetchCardData(cardId) {
    const resp = await fetch(
      `${this.slabclawApi}/api/registry/cards?ids=${encodeURIComponent(cardId)}`,
      { signal: AbortSignal.timeout?.(8000) },
    );
    if (!resp.ok) throw new Error(`API ${resp.status} for ${cardId}`);
    const data = await resp.json();
    return data?.cards?.[0] || null;
  }

  async fetchListings(cardId) {
    const resp = await fetch(
      `${this.slabclawApi}/api/listings?product_id=${encodeURIComponent(cardId)}&platform=${this.platform}`,
      { signal: AbortSignal.timeout?.(8000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : data?.listings || [];
  }

  async fetchDeals(cardId) {
    const resp = await fetch(
      `${this.slabclawApi}/api/deals?product_id=${encodeURIComponent(cardId)}&platform=${this.platform}&limit=50`,
      { signal: AbortSignal.timeout?.(8000) },
    );
    if (!resp.ok) return [];
    const data = await resp.json();
    return Array.isArray(data) ? data : data?.deals || [];
  }

  // ── Platform-specific (override in subclass) ─────────────────────────

  async fetchPlatformData(cardId, cardData) {
    throw new Error(`${this.platform}: fetchPlatformData() not implemented`);
  }

  // ── Circuit breakers ─────────────────────────────────────────────────

  applyCircuitBreakers(signal, cardMemory) {
    const flags = [];

    if (signal.priceCents <= 0) {
      flags.push('zero_price');
      signal.rejected = true;
      signal.rejectReason = 'zero or negative price';
      return { signal, flags };
    }

    // Price jump guard: >5x or <0.2x of last known price
    const lastObs = cardMemory.observations?.[cardMemory.observations.length - 1];
    if (lastObs?.priceCents && signal.priceCents > 0) {
      const ratio = signal.priceCents / lastObs.priceCents;
      if (ratio > 5 || ratio < 0.2) {
        flags.push('price_jump');
        signal.confidence = Math.min(signal.confidence, 0.3);
        signal.flags = [...(signal.flags || []), `jump_${ratio.toFixed(1)}x`];
      }
    }

    // Stale feed: signal older than 14 days
    if (signal.observedAt) {
      const ageMs = Date.now() - new Date(signal.observedAt).getTime();
      if (ageMs > 14 * 86400000) {
        flags.push('stale_feed');
        signal.confidence = Math.min(signal.confidence, 0.2);
      }
    }

    // Seller concentration: >60% of comps from single seller
    if (signal.comps?.length >= 3) {
      const sellers = signal.comps.map((c) => c.seller).filter(Boolean);
      const freq = {};
      for (const s of sellers) freq[s] = (freq[s] || 0) + 1;
      const max = Math.max(...Object.values(freq));
      if (max / sellers.length > 0.6) {
        flags.push('seller_concentration');
        signal.confidence = Math.min(signal.confidence, 0.4);
        const dominant = Object.entries(freq).find(([, v]) => v === max)?.[0];
        signal.flags = [...(signal.flags || []), `seller:${dominant}`];
      }
    }

    return { signal, flags };
  }

  // ── Update memory with new observation ───────────────────────────────

  updateCardMemory(cardId, signal, flags) {
    const mem = this.readCardMemory(cardId);

    if (!signal.rejected) {
      mem.observations.push({
        date: new Date().toISOString(),
        priceCents: signal.priceCents,
        confidence: signal.confidence,
        comps: signal.compCount || 0,
        source: signal.source || this.platform,
      });
      // Keep last 100 observations
      if (mem.observations.length > 100) mem.observations = mem.observations.slice(-100);
    }

    if (flags.length > 0) {
      mem.anomalies.push({
        date: new Date().toISOString(),
        flags,
        priceCents: signal.priceCents,
        detail: signal.rejectReason || flags.join(', '),
      });
      if (mem.anomalies.length > 50) mem.anomalies = mem.anomalies.slice(-50);
    }

    this.writeCardMemory(cardId, mem);
    return mem;
  }

  // ── Warm-cache fallback ──────────────────────────────────────────────
  // When a fresh fetch fails this run (backend down, scrape miss), reuse the most recent
  // cached observation within WARM_TTL so a transient miss doesn't DROP the source — a
  // memory-backed swarm shouldn't forget a realized price it already knows. The cached
  // observedAt is preserved, so recency decay + the stale_feed breaker down-weight the
  // resurrected signal honestly (present, but never treated as fresh).
  warmFallback(cardId) {
    const mem = this.readCardMemory(cardId);
    const last = mem.observations?.[mem.observations.length - 1];
    if (!last?.priceCents) return null;
    const ageMs = Date.now() - new Date(last.date).getTime();
    if (!(ageMs >= 0) || ageMs > WARM_TTL_MS) return null;
    return {
      cardId,
      priceCents: last.priceCents,
      confidence: last.confidence ?? 0.5,
      compCount: last.comps ?? 0,
      source: last.source || this.platform,
      platform: this.platform,
      observedAt: last.date, // keep the ORIGINAL time → honest staleness downstream
      flags: ['warm_cache'],
      warmCache: true,
    };
  }

  // ── Main run loop ────────────────────────────────────────────────────

  async run() {
    const signals = [];
    const runLog = { platform: this.platform, timestamp: new Date().toISOString(), cards: {} };

    for (const cardId of this.cardIds) {
      let rawSignal = null;
      let fetchErr = null;
      try {
        const cardData = await this.fetchCardData(cardId);
        rawSignal = cardData ? await this.fetchPlatformData(cardId, cardData) : null;
      } catch (err) {
        fetchErr = err.message;
      }

      // Fresh data this run? If not, stand in the last good cached observation.
      const fresh = !!(rawSignal && rawSignal.priceCents != null);
      if (!fresh) rawSignal = this.warmFallback(cardId);

      if (!rawSignal || rawSignal.priceCents == null) {
        runLog.cards[cardId] = { error: fetchErr || 'no platform data (no warm cache)' };
        continue;
      }

      const cardMemory = this.readCardMemory(cardId);
      const { signal, flags } = this.applyCircuitBreakers(rawSignal, cardMemory);

      // Only RECORD fresh observations — never re-stamp a resurrected one as new memory.
      if (fresh) this.updateCardMemory(cardId, signal, flags);

      if (!signal.rejected) signals.push(signal);

      runLog.cards[cardId] = {
        priceCents: signal.priceCents,
        confidence: signal.confidence,
        flags,
        rejected: signal.rejected || false,
        compCount: signal.compCount || 0,
        warmCache: fresh ? undefined : true,
      };
    }

    // Write signals to shared context
    this.writeSignals(signals);

    // Update state
    this.writeMemory('state.json', {
      lastRun: new Date().toISOString(),
      cardsProcessed: this.cardIds.length,
      signalsEmitted: signals.length,
    });

    return { platform: this.platform, signals, log: runLog };
  }

  writeSignals(signals) {
    // Read existing shared signals, update this platform's section
    const existing = this.readShared('agent-signals/latest.json') || {};
    existing[this.platform] = {
      timestamp: new Date().toISOString(),
      signals,
    };
    this.writeShared('agent-signals/latest.json', existing);
  }
}
