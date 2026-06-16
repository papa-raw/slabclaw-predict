/// usePosition — the connected wallet's Position in a market (read onchain).
///
/// Each Market holds `positions: Table<address, Position>`. A trader's Position
/// (yes_shares / no_shares / claimed) is a dynamic field of that table keyed by
/// their address. This reads it and derives the parimutuel "to win" payout:
/// if a side wins, the winner takes their pro-rata share of the whole pool —
///   payout = your_shares / total_winning_shares × pool.

import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';

export function usePosition(market) {
  const account = useCurrentAccount();
  const tableId = market?.positionsTableId;

  const { data, isLoading, refetch } = useSuiClientQuery(
    'getDynamicFieldObject',
    { parentId: tableId, name: { type: 'address', value: account?.address } },
    { enabled: !!tableId && !!account, staleTime: 0, refetchOnMount: 'always', refetchInterval: 8000 },
  );

  // Table value is a Field<address, Position>; the Position struct sits under value.fields.
  const f = data?.data?.content?.fields;
  const pos = f?.value?.fields ?? f?.value ?? f;
  const yesShares = Number(pos?.yes_shares ?? 0);
  const noShares = Number(pos?.no_shares ?? 0);
  const claimed = Boolean(pos?.claimed);
  const hasPosition = yesShares > 0 || noShares > 0;

  // Parimutuel payout: your pro-rata share of the whole pool if your side wins.
  const pool = market?.poolBalance ?? 0;
  const totalYes = market?.totalYes ?? 0;
  const totalNo = market?.totalNo ?? 0;
  const toWinYes = totalYes > 0 ? (yesShares / totalYes) * pool : 0;
  const toWinNo = totalNo > 0 ? (noShares / totalNo) * pool : 0;

  return { yesShares, noShares, claimed, hasPosition, toWinYes, toWinNo, isLoading, refetch, hasWallet: !!account };
}
