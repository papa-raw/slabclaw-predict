/// useRegistry — hybrid card-registry hooks (live API, snapshot fallback).

import { useQuery } from '@tanstack/react-query';
import { loadCard } from '../lib/registry';

/** Full registry record for one card (product + oracles + pop + series). */
export function useCard(productId) {
  return useQuery({
    queryKey: ['registry-card', productId],
    queryFn: () => loadCard(productId),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
