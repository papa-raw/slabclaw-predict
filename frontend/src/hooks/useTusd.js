/// useTusd — connected wallet's tUSD balance.

import { useSuiClientQuery, useCurrentAccount } from '@mysten/dapp-kit';
import { TEST_USD_TYPE, USD_DECIMALS } from '../constants';

export function useTusdBalance() {
  const account = useCurrentAccount();
  const { data, refetch, isLoading } = useSuiClientQuery(
    'getBalance',
    { owner: account?.address, coinType: TEST_USD_TYPE },
    { enabled: !!account },
  );
  const raw = data?.totalBalance ? Number(data.totalBalance) : 0;
  const balance = raw / 10 ** USD_DECIMALS;
  return { balance, raw, refetch, isLoading, hasWallet: !!account };
}
