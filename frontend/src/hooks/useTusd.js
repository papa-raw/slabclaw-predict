/// useTusd — connected wallet's tUSD balance.

import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';
import { TEST_USD_TYPE, USD_DECIMALS } from '../constants';

export function useTusdBalance() {
  const account = useCurrentAccount();
  const { data, refetch, isLoading } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address, coinType: TEST_USD_TYPE },
    // Re-read on every (re)connect, on focus, and on a short poll — the tUSD is
    // always onchain, so a stale/0 read after reconnect should self-correct fast.
    { enabled: !!account, staleTime: 0, refetchOnMount: 'always', refetchOnWindowFocus: true, refetchInterval: 8000 },
  );
  const raw = data?.totalBalance ? Number(data.totalBalance) : 0;
  const balance = raw / 10 ** USD_DECIMALS;
  return { balance, raw, refetch, isLoading, hasWallet: !!account };
}
