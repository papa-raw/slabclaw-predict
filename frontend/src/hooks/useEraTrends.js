/// useEraTrends — navbar KPI strip data from /api/registry/era-trends.
/// Hybrid: live-first; falls back to a small static snapshot for the demo.

import { useQuery } from '@tanstack/react-query';

// Fallback mirrors a recent /api/registry/era-trends snapshot (90d_5v5).
const FALLBACK = {
  'base:_all': { pct: 36.4 },
  'rocket:_all': { pct: 44.4 },
  'neo:_all': { pct: 46.3 },
  'ecard:_all': { pct: 174.9 },
  'promo:_all': { pct: 96.3 },
};

async function fetchEraTrends() {
  try {
    const res = await fetch('/api/registry/era-trends', { signal: AbortSignal.timeout?.(4000) });
    if (res.ok) {
      const json = await res.json();
      if (json?.trends) return { trends: json.trends, source: 'live' };
    }
  } catch {
    /* fall through */
  }
  return { trends: FALLBACK, source: 'fallback' };
}

/** Returns { byEra: { base: pct, rocket: pct, ... }, headline: avgPct }. */
export function useEraTrends() {
  const q = useQuery({
    queryKey: ['era-trends'],
    queryFn: fetchEraTrends,
    staleTime: 10 * 60 * 1000,
    retry: 0,
  });

  const trends = q.data?.trends || FALLBACK;
  const pick = (era) => {
    const t = trends[`${era}:_all`] || trends[`${era}:en`];
    return t ? t.pct : null;
  };
  const byEra = {
    base: pick('base'),
    rocket: pick('rocket'),
    neo: pick('neo'),
    ecard: pick('ecard'),
    promo: pick('promo'),
  };
  // headline = the strong "all eras" move (registry shows a 3MO aggregate)
  const vals = Object.values(byEra).filter((v) => v != null);
  const headline = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;

  return { byEra, headline, source: q.data?.source };
}
