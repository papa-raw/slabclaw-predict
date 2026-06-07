/// useMarket — fetch and parse on-chain Market objects from Sui.

import { useSuiClientQuery } from '@mysten/dapp-kit';

function parseMarketFields(fields) {
  const toStr = (bcsBytes) => {
    if (!bcsBytes) return '';
    if (Array.isArray(bcsBytes)) return new TextDecoder().decode(new Uint8Array(bcsBytes));
    return String(bcsBytes);
  };

  return {
    assetId: toStr(fields.asset_id),
    strikeUsdCents: Number(fields.strike_usd_cents),
    expiryMs: Number(fields.expiry_ms),
    state: Number(fields.state),
    totalYes: Number(fields.total_yes_shares),
    totalNo: Number(fields.total_no_shares),
    poolBalance: Number(fields.pool_balance),
    proposedPrice: fields.proposed_price_usd_cents ? Number(fields.proposed_price_usd_cents) : null,
    proposedAt: fields.proposed_at_ms ? Number(fields.proposed_at_ms) : null,
    disputeBond: Number(fields.dispute_bond),
    outcome: fields.outcome !== undefined ? Number(fields.outcome) : null,
    description: toStr(fields.description),
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
