/// useMarket — fetch and parse onchain Market objects from Sui.

import { useSuiClientQuery } from '@mysten/dapp-kit';

function parseMarketFields(fields) {
  const toStr = (bcsBytes) => {
    if (!bcsBytes) return '';
    if (Array.isArray(bcsBytes)) return new TextDecoder().decode(new Uint8Array(bcsBytes));
    return String(bcsBytes);
  };

  // Field names match the onchain Market struct: total_yes, total_no, pool
  // (Balance<TEST_USD> flattens to its u64 value string over JSON-RPC).
  return {
    assetId: toStr(fields.asset_id),
    strikeUsdCents: Number(fields.strike_usd_cents),
    expiryMs: Number(fields.expiry_ms),
    state: Number(fields.state),
    totalYes: Number(fields.total_yes),
    totalNo: Number(fields.total_no),
    poolBalance: Number(fields.pool?.fields?.value ?? fields.pool ?? 0),
    proposedPrice: fields.proposed_price ? Number(fields.proposed_price) : null,
    proposedAt: fields.proposed_at_ms ? Number(fields.proposed_at_ms) : null,
    disputeBond: Number(fields.dispute_bond?.fields?.value ?? fields.dispute_bond ?? 0),
    disputer: fields.disputer ?? null,
    outcome: fields.outcome === null || fields.outcome === undefined ? null : fields.outcome,
    description: toStr(fields.description),
    proposedSources: fields.proposed_sources ? Number(fields.proposed_sources) : null,
  };
}

export function useMarketObject(marketId) {
  const { data, isLoading, error, refetch } = useSuiClientQuery('getObject', {
    id: marketId,
    options: { showContent: true },
  });

  let market = null;
  if (data?.data?.content?.fields) {
    market = {
      id: marketId,
      ...parseMarketFields(data.data.content.fields),
    };
  }

  return { market, isLoading, error, refetch };
}

export function useMultipleMarkets(marketIds) {
  const { data, isLoading, error, refetch } = useSuiClientQuery('multiGetObjects', {
    ids: marketIds,
    options: { showContent: true },
  });

  const markets = (data || [])
    .map((obj, i) => {
      if (!obj?.data?.content?.fields) return null;
      return {
        id: marketIds[i],
        ...parseMarketFields(obj.data.content.fields),
      };
    })
    .filter(Boolean);

  return { markets, isLoading, error, refetch };
}
