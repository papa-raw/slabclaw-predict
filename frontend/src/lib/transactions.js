/// transactions.js — Build Sui Move call transactions for SlabClaw Predict.
/// Markets settle in TEST_USD (tUSD). Bets spend tUSD coins; gas is still SUI.

import { Transaction, coinWithBalance } from '@mysten/sui/transactions';
import { PACKAGE_ID, CLOCK_ID, FAUCET_ID, TEST_USD_TYPE, USD_DECIMALS } from '../constants';

const USD_UNIT = 10 ** USD_DECIMALS;
const toUnits = (tusd) => Math.round(tusd * USD_UNIT);

/// Buy YES shares. Amount in tUSD (e.g. 100 = 100 tUSD).
/// coinWithBalance auto-selects/merges the sender's tUSD coins at sign time.
export function buildBuyYes(marketId, amountTusd) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::market::buy_yes`,
    arguments: [
      tx.object(marketId),
      coinWithBalance({ balance: toUnits(amountTusd), type: TEST_USD_TYPE }),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/// Buy NO shares. Amount in tUSD.
export function buildBuyNo(marketId, amountTusd) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::market::buy_no`,
    arguments: [
      tx.object(marketId),
      coinWithBalance({ balance: toUnits(amountTusd), type: TEST_USD_TYPE }),
      tx.object(CLOCK_ID),
    ],
  });
  return tx;
}

/// Claim winnings from a settled market (pays out tUSD).
export function buildClaim(marketId) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::market::claim`,
    arguments: [tx.object(marketId), tx.object(CLOCK_ID)],
  });
  return tx;
}

/// Mint test USD to the connected wallet from the public faucet.
export function buildFaucetMint(amountTusd) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::test_usd::mint`,
    arguments: [tx.object(FAUCET_ID), tx.pure.u64(toUnits(amountTusd))],
  });
  return tx;
}
