/// transactions.js — Build Sui Move call transactions for SlabClaw Predict.

import { Transaction } from '@mysten/sui/transactions';
import { PACKAGE_ID, CLOCK_ID } from '../constants';

const MIST_PER_SUI = 1_000_000_000;

/// Buy YES shares on a market. Amount in SUI (e.g. 0.5 = 0.5 SUI).
export function buildBuyYes(marketId, amountSui) {
  const tx = new Transaction();
  const amountMist = Math.round(amountSui * MIST_PER_SUI);
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::market::buy_yes`,
    arguments: [tx.object(marketId), coin, tx.object(CLOCK_ID)],
  });
  return tx;
}

/// Buy NO shares on a market. Amount in SUI.
export function buildBuyNo(marketId, amountSui) {
  const tx = new Transaction();
  const amountMist = Math.round(amountSui * MIST_PER_SUI);
  const [coin] = tx.splitCoins(tx.gas, [amountMist]);
  tx.moveCall({
    target: `${PACKAGE_ID}::market::buy_no`,
    arguments: [tx.object(marketId), coin, tx.object(CLOCK_ID)],
  });
  return tx;
}

/// Claim winnings from a settled market.
export function buildClaim(marketId) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::market::claim`,
    arguments: [tx.object(marketId), tx.object(CLOCK_ID)],
  });
  return tx;
}
