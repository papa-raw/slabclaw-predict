/// useLiveConsensus — production consensus feed with a baked-snapshot fallback.
///
/// The dapp ships with a build-time snapshot (src/data/oracle-consensus.json) so it
/// renders with zero backend. In production the swarm also serves its latest round at
/// api.slabclaw.com/predict/consensus; this hook upgrades to that feed when reachable.
///
/// The swap is ATOMIC: the live payload replaces the snapshot only if it validates for
/// EVERY demo market. A partial, drifted, or malformed payload is discarded whole —
/// mixed live/baked state on a pricing panel is worse than an honest snapshot.

import { useState, useEffect } from 'react';
import { DEMO_MARKETS } from '../constants';
import bakedConsensus from '../data/oracle-consensus.json';

const LIVE_URL = import.meta.env.VITE_PREDICT_API_URL || 'https://api.slabclaw.com/predict/consensus';
const TIMEOUT_MS = 4000;

const SNAPSHOT = { data: bakedConsensus, source: 'snapshot' };

function validates(payload) {
  if (!payload || typeof payload.consensus !== 'object' || !payload.timestamp) return false;
  return DEMO_MARKETS.every((m) => {
    const c = payload.consensus[m.productId];
    return c && c.productId === m.productId && Array.isArray(c.contributingSources);
  });
}

// Module-level singleton: one fetch per page load, every panel shares the result.
let livePromise = null;
function getConsensus() {
  if (!livePromise) {
    livePromise = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(LIVE_URL, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        if (!validates(payload)) throw new Error('payload failed validation');
        return { data: payload, source: 'live' };
      } catch (e) {
        console.warn(`[oracle] live consensus unavailable (${e.message}) — using baked snapshot`);
        return SNAPSHOT;
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return livePromise;
}

export function useLiveConsensus() {
  const [state, setState] = useState(SNAPSHOT);
  useEffect(() => {
    let mounted = true;
    getConsensus().then((s) => { if (mounted) setState(s); });
    return () => { mounted = false; };
  }, []);
  return state;
}

/// useMemoryProvenance — the live proof that the serving node rebuilt its agent
/// memory from Walrus. Reads /predict/health.memory; returns null unless the live
/// node answers (we never fake this — it's a "don't trust, verify" element).
const HEALTH_URL = (import.meta.env.VITE_PREDICT_API_URL || 'https://api.slabclaw.com/predict/consensus')
  .replace(/\/consensus$/, '/health');

let healthPromise = null;
function getMemoryProvenance() {
  if (!healthPromise) {
    healthPromise = (async () => {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
      try {
        const res = await fetch(HEALTH_URL, { signal: ctrl.signal });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const j = await res.json();
        const m = j.memory;
        if (!m || !m.restoredFromBlobId) return null;
        return {
          blobId: m.restoredFromBlobId,
          pointerSource: m.pointerSource,
          files: m.files,
          restoredAt: m.restoredAt,
          consensusAgeMs: j.consensusAgeMs,
        };
      } catch {
        return null; // offline / unreachable — strip simply doesn't render
      } finally {
        clearTimeout(timer);
      }
    })();
  }
  return healthPromise;
}

export function useMemoryProvenance() {
  const [state, setState] = useState(null);
  useEffect(() => {
    let mounted = true;
    getMemoryProvenance().then((s) => { if (mounted) setState(s); });
    return () => { mounted = false; };
  }, []);
  return state;
}
