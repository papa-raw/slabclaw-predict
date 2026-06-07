import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { buildBuyYes, buildBuyNo, buildClaim } from '../lib/transactions';
import { MARKET_STATE, EXPLORER_URL } from '../constants';

function formatUsd(cents) {
  if (!cents && cents !== 0) return '—';
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatSui(mist) {
  return (mist / 1_000_000_000).toFixed(2);
}

export default function TradingPanel({ market, meta, oracle, onClose, onTxSuccess }) {
  const account = useCurrentAccount();
  const client = useSuiClient();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [side, setSide] = useState('yes');
  const [amount, setAmount] = useState('0.5');
  const [status, setStatus] = useState(null); // null | 'signing' | 'success' | 'error'
  const [txDigest, setTxDigest] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const totalShares = market.totalYes + market.totalNo;
  const yesPercent = totalShares > 0 ? Math.round((market.totalYes / totalShares) * 100) : 50;
  const noPercent = 100 - yesPercent;
  const settled = market.state === 3;
  const active = market.state === 0;

  async function handleTrade() {
    if (!account) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;

    setStatus('signing');
    setErrorMsg(null);

    try {
      const tx = side === 'yes'
        ? buildBuyYes(market.id, amt)
        : buildBuyNo(market.id, amt);

      const result = await signAndExecute({ transaction: tx });
      setTxDigest(result.digest);
      setStatus('success');
      onTxSuccess?.();
    } catch (err) {
      setErrorMsg(err.message || 'Transaction failed');
      setStatus('error');
    }
  }

  async function handleClaim() {
    if (!account) return;
    setStatus('signing');
    setErrorMsg(null);

    try {
      const tx = buildClaim(market.id);
      const result = await signAndExecute({ transaction: tx });
      setTxDigest(result.digest);
      setStatus('success');
      onTxSuccess?.();
    } catch (err) {
      setErrorMsg(err.message || 'Claim failed');
      setStatus('error');
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-sc-card border border-sc-border rounded-2xl max-w-md w-full shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-sc-border flex items-center gap-3">
          {meta?.image && (
            <img src={meta.image} alt="" className="w-12 h-16 rounded-lg object-cover" />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-sm">{meta?.name || market.assetId}</h2>
            <p className="text-xs text-sc-muted">{meta?.set} · {meta?.grader} {meta?.grade}</p>
          </div>
          <button onClick={onClose} className="text-sc-muted hover:text-sc-text text-lg">
            ✕
          </button>
        </div>

        {/* Market question */}
        <div className="p-4 border-b border-sc-border">
          <p className="text-sm">
            Will this card exceed{' '}
            <span className="text-sc-accent font-bold">{formatUsd(market.strikeUsdCents)}</span>
            ?
          </p>

          {/* Probability */}
          <div className="mt-3 flex gap-2">
            <div className="flex-1 text-center p-2 rounded-lg bg-sc-yes/10 border border-sc-yes/20">
              <div className="text-sc-yes text-xl font-bold font-mono">{yesPercent}%</div>
              <div className="text-[10px] text-sc-muted mt-0.5">YES · {formatSui(market.totalYes)} SUI</div>
            </div>
            <div className="flex-1 text-center p-2 rounded-lg bg-sc-no/10 border border-sc-no/20">
              <div className="text-sc-no text-xl font-bold font-mono">{noPercent}%</div>
              <div className="text-[10px] text-sc-muted mt-0.5">NO · {formatSui(market.totalNo)} SUI</div>
            </div>
          </div>

          {/* Oracle price */}
          {oracle?.price && (
            <div className="mt-3 p-2 rounded-lg bg-sc-surface text-xs">
              <div className="flex justify-between">
                <span className="text-sc-muted">Oracle Price</span>
                <span className="font-mono font-medium">
                  ${oracle.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-sc-muted">Source</span>
                <span className="font-mono text-sc-muted">{oracle.source} ({oracle.saleCount} sales)</span>
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-sc-muted">vs Strike</span>
                <span className={`font-mono font-medium ${oracle.price * 100 > market.strikeUsdCents ? 'text-sc-yes' : 'text-sc-no'}`}>
                  {oracle.price * 100 > market.strikeUsdCents ? 'ABOVE' : 'BELOW'} strike
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Trading form */}
        <div className="p-4">
          {!account ? (
            <div className="text-center text-sc-muted text-sm py-4">
              Connect your wallet to trade
            </div>
          ) : settled ? (
            <button
              onClick={handleClaim}
              disabled={status === 'signing'}
              className="w-full py-3 rounded-lg bg-sc-accent text-white font-semibold text-sm hover:bg-sc-accent/80 disabled:opacity-50 transition-colors"
            >
              {status === 'signing' ? 'Claiming...' : 'Claim Winnings'}
            </button>
          ) : active ? (
            <>
              {/* Side selector */}
              <div className="flex gap-2 mb-3">
                <button
                  onClick={() => setSide('yes')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    side === 'yes'
                      ? 'bg-sc-yes text-white'
                      : 'bg-sc-surface text-sc-muted hover:text-sc-yes border border-sc-border'
                  }`}
                >
                  Buy YES
                </button>
                <button
                  onClick={() => setSide('no')}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    side === 'no'
                      ? 'bg-sc-no text-white'
                      : 'bg-sc-surface text-sc-muted hover:text-sc-no border border-sc-border'
                  }`}
                >
                  Buy NO
                </button>
              </div>

              {/* Amount */}
              <div className="relative mb-3">
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0.1"
                  step="0.1"
                  className="w-full bg-sc-surface border border-sc-border rounded-lg px-3 py-2.5 text-sm font-mono focus:outline-none focus:border-sc-accent"
                  placeholder="Amount in SUI"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sc-muted">
                  SUI
                </span>
              </div>

              {/* Quick amounts */}
              <div className="flex gap-2 mb-3">
                {['0.1', '0.5', '1', '5'].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAmount(v)}
                    className="flex-1 py-1 text-xs font-mono bg-sc-surface border border-sc-border rounded hover:border-sc-accent/40 transition-colors"
                  >
                    {v}
                  </button>
                ))}
              </div>

              {/* Submit */}
              <button
                onClick={handleTrade}
                disabled={status === 'signing' || !amount || parseFloat(amount) <= 0}
                className={`w-full py-3 rounded-lg text-white font-semibold text-sm disabled:opacity-50 transition-colors ${
                  side === 'yes'
                    ? 'bg-sc-yes hover:bg-sc-yes/80'
                    : 'bg-sc-no hover:bg-sc-no/80'
                }`}
              >
                {status === 'signing'
                  ? 'Confirm in wallet...'
                  : `Buy ${side.toUpperCase()} — ${amount} SUI`}
              </button>
            </>
          ) : (
            <div className="text-center text-sc-muted text-sm py-4">
              Market is {MARKET_STATE[market.state]?.toLowerCase() || 'inactive'}
            </div>
          )}

          {/* Status messages */}
          {status === 'success' && txDigest && (
            <div className="mt-3 p-2 rounded-lg bg-sc-yes/10 border border-sc-yes/20 text-xs">
              <span className="text-sc-yes font-medium">Transaction successful!</span>
              <a
                href={`${EXPLORER_URL}/tx/${txDigest}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block mt-1 text-sc-accent hover:underline font-mono truncate"
              >
                {txDigest}
              </a>
            </div>
          )}
          {status === 'error' && errorMsg && (
            <div className="mt-3 p-2 rounded-lg bg-sc-no/10 border border-sc-no/20 text-xs text-sc-no">
              {errorMsg}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
