/// PortfolioPage — the user's positions across every market + activity history.
/// The "Portfolio tab" pattern from Polymarket/Kalshi (their weak spot → our edge).

import { useState, useEffect } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClientQuery } from '@mysten/dapp-kit';
import { DEMO_MARKETS, PACKAGE_ID, EXPLORER_URL } from '../constants';
import { useMultipleMarkets } from '../hooks/useMarket';
import { usePosition } from '../hooks/usePosition';
import { useTusdBalance } from '../hooks/useTusd';
import { usd, sui, timeUntil } from '../lib/format';

const STATE_LABEL = { 0: 'Active', 1: 'Resolving', 2: 'Disputed', 3: 'Settled' };

export default function PortfolioPage({ onOpenMarket }) {
  const account = useCurrentAccount();
  const { balance: tusd, isLoading: balLoading } = useTusdBalance();
  const { markets } = useMultipleMarkets(DEMO_MARKETS.map((m) => m.id));
  const enriched = markets.map((m) => ({ ...m, meta: DEMO_MARKETS.find((d) => d.id === m.id) }));

  // Each PositionRow self-hides when the wallet holds nothing there; track which
  // markets have reported so we can show a real empty state vs a half-loaded page.
  const [held, setHeld] = useState({});
  const reportState = (id, has) => setHeld((h) => (h[id] === has ? h : { ...h, [id]: has }));
  const allReported = enriched.length > 0 && enriched.every((m) => m.id in held);
  const noneHeld = allReported && !enriched.some((m) => held[m.id]);

  return (
    <main className="max-w-3xl mx-auto px-4 lg:px-6 py-7 pb-32">
      <div className="mb-6">
        <div className="text-[10px] font-semibold text-sc-accent uppercase tracking-wide mb-1.5">Portfolio</div>
        <h2 className="text-xl lg:text-2xl font-bold text-white">Your positions</h2>
      </div>

      {!account ? (
        <div className="bg-sc-card border border-sc-border rounded-xl py-14 px-6 text-center text-sc-muted text-sm">
          Connect your wallet to see your positions and activity.
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-sc-card border border-sc-border rounded-xl px-4 py-3 mb-5">
            <span className="text-[11px] text-sc-muted uppercase tracking-wide">tUSD balance</span>
            <span className="text-[15px] font-bold tnum text-white">
              {balLoading ? '—' : tusd.toLocaleString(undefined, { maximumFractionDigits: 0 })} tUSD
            </span>
          </div>

          <div className="space-y-2.5 mb-9">
            {enriched.length === 0
              ? <SkeletonRows />
              : enriched.map((m) => <PositionRow key={m.id} market={m} onOpen={onOpenMarket} onState={reportState} />)}
            {noneHeld && (
              <div className="bg-sc-card border border-sc-border rounded-xl py-10 px-6 text-center">
                <div className="text-sc-dim text-sm font-semibold mb-1">No open positions yet</div>
                <div className="text-sc-muted text-xs">Open a market and buy YES or NO — your position and potential payout will show here.</div>
              </div>
            )}
          </div>

          <h3 className="text-sm font-semibold uppercase tracking-wide text-white mb-3">Activity</h3>
          <Activity account={account} />
        </>
      )}
    </main>
  );
}

function PositionRow({ market, onOpen, onState }) {
  const pos = usePosition(market);
  const { mutateAsync, isPending } = useSignAndExecuteTransaction();
  useEffect(() => {
    if (!pos.isLoading) onState(market.id, pos.hasPosition);
  }, [pos.isLoading, pos.hasPosition, market.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!pos.hasPosition) return null;

  const settled = market.state === 3;
  const wonYes = settled && market.outcome === true && pos.yesShares > 0;
  const wonNo = settled && market.outcome === false && pos.noShares > 0;
  const claimable = (wonYes || wonNo) && !pos.claimed;
  const payout = wonYes ? pos.toWinYes : wonNo ? pos.toWinNo : 0;

  const claim = async () => {
    const { buildClaim } = await import('../lib/transactions');
    try { await mutateAsync({ transaction: buildClaim(market.id) }); pos.refetch(); } catch { /* surfaced in market view */ }
  };

  const status = settled
    ? (claimable ? 'Claimable' : (pos.claimed ? 'Claimed' : (wonYes || wonNo ? 'Won' : 'Lost')))
    : STATE_LABEL[market.state];
  const statusCls = claimable ? 'text-sc-yes' : status === 'Lost' ? 'text-sc-no' : 'text-sc-muted';

  return (
    <div className="bg-sc-card border border-sc-border rounded-xl p-3.5 hover:border-sc-accent/40 transition">
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => onOpen(market.id)} className="min-w-0 text-left">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-[13px] text-white truncate">{market.meta?.name}</span>
            <span className={`text-[10px] uppercase tracking-wide ${statusCls}`}>{status}</span>
          </div>
          <div className="text-[11px] text-sc-muted">
            strike {usd(market.strikeUsdCents / 100)} · {market.state === 0 ? timeUntil(market.expiryMs) : STATE_LABEL[market.state]}
          </div>
        </button>
        {claimable && (
          <button onClick={claim} disabled={isPending}
            className="shrink-0 px-3.5 py-2 rounded-lg bg-sc-accent text-black font-semibold text-[12px] hover:opacity-90 disabled:opacity-50 transition">
            {isPending ? 'Claiming…' : `Claim ${usd(payout / 1e9)}`}
          </button>
        )}
      </div>
      <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] tnum">
        {pos.yesShares > 0 && (
          <span><span className="text-sc-yes font-semibold">YES</span> {sui(pos.yesShares)} · to win <span className="text-white">{usd(pos.toWinYes / 1e9)}</span></span>
        )}
        {pos.noShares > 0 && (
          <span><span className="text-sc-no font-semibold">NO</span> {sui(pos.noShares)} · to win <span className="text-white">{usd(pos.toWinNo / 1e9)}</span></span>
        )}
      </div>
    </div>
  );
}

function Activity({ account }) {
  const { data, isLoading } = useSuiClientQuery(
    'queryTransactionBlocks',
    { filter: { FromAddress: account.address }, options: { showEvents: true }, limit: 25, order: 'descending' },
    { enabled: !!account, refetchInterval: 12000 },
  );

  const ours = (data?.data || [])
    .map((tx) => {
      const ev = (tx.events || []).find((e) => e.type?.startsWith(`${PACKAGE_ID}::market::`));
      if (!ev) return null;
      const kind = ev.type.split('::').pop();
      return { digest: tx.digest, kind, fields: ev.parsedJson || {}, ts: Number(tx.timestampMs || 0) };
    })
    .filter(Boolean);

  if (isLoading) return <div className="text-[12px] text-sc-muted py-2">Loading activity…</div>;
  if (ours.length === 0) return <div className="text-[12px] text-sc-muted py-2">No activity yet.</div>;

  const label = (a) => {
    if (a.kind === 'PositionOpened') return <>Bought <span className={a.fields.is_yes ? 'text-sc-yes' : 'text-sc-no'}>{a.fields.is_yes ? 'YES' : 'NO'}</span>{a.fields.amount ? <> · {sui(Number(a.fields.amount))} tUSD</> : null}</>;
    if (a.kind === 'WinningsClaimed') return <>Claimed <span className="text-sc-accent">{usd(Number(a.fields.payout || 0) / 1e9)}</span></>;
    if (a.kind === 'PositionDisputed' || a.kind === 'ResolutionProposed' || a.kind === 'MarketSettled') return a.kind.replace(/([A-Z])/g, ' $1').trim();
    return a.kind;
  };

  return (
    <div className="space-y-1.5">
      {ours.map((a) => (
        <a key={a.digest} href={`${EXPLORER_URL}/tx/${a.digest}`} target="_blank" rel="noopener noreferrer"
          className="flex items-center justify-between bg-sc-card border border-sc-border rounded-lg px-3 py-2 hover:border-sc-accent/40 transition text-[12px]">
          <span className="text-sc-dim">{label(a)}</span>
          <span className="font-mono text-[10px] text-sc-muted shrink-0 ml-3">{a.digest.slice(0, 8)}… ↗</span>
        </a>
      ))}
    </div>
  );
}

function SkeletonRows() {
  return Array.from({ length: 2 }).map((_, i) => (
    <div key={i} className="bg-sc-card border border-sc-border rounded-xl p-3.5 animate-pulse">
      <div className="h-3 bg-sc-surface rounded w-1/3 mb-2" />
      <div className="h-2.5 bg-sc-surface rounded w-1/2" />
    </div>
  ));
}
