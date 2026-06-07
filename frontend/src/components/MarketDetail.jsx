/// MarketDetail — full evidence-rich market page (echoes registry card-detail layout).
/// Chart (centerpiece) + evidence ladder + recent comps + resolution + on-chain trade.

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { buildBuyYes, buildBuyNo, buildClaim } from '../lib/transactions';
import { MARKET_STATE, EXPLORER_URL } from '../constants';
import { useCard } from '../hooks/useRegistry';
import { useTusdBalance } from '../hooks/useTusd';
import {
  oracleForGrade, priceSeries, smoothOracleHistory, distanceToStrike, sourceLabel,
} from '../lib/registry';
import { usd, usdFull, pct, arrow, sui, timeUntil } from '../lib/format';
import GradeBadge from './GradeBadge';
import { EditionMarks } from './EditionBadges';
import OracleStrikeChart from './OracleStrikeChart';
import RegistryCardLadder from './RegistryCardLadder';
import WalletButton from './WalletButton';

export default function MarketDetail({ market, meta, onClose, onTxSuccess }) {
  const { data: card, isLoading } = useCard(meta?.productId);

  const strikeDollars = market.strikeUsdCents / 100;
  const start = meta?.chartStartMs ?? null;
  const oracle = card ? oracleForGrade(card, meta.grader, meta.grade) : null;
  const series = card ? priceSeries(card, meta.grader, meta.grade).filter((p) => !start || p.t >= start) : [];
  const oLine = card ? smoothOracleHistory(card, meta.grader, meta.grade).filter((p) => !start || p.t >= start) : [];
  const dist = oracle ? distanceToStrike(oracle.price, market.strikeUsdCents) : null;
  const oracleAbove = oracle && oracle.price >= strikeDollars;

  const totalShares = market.totalYes + market.totalNo;
  const yesPct = totalShares > 0 ? Math.round((market.totalYes / totalShares) * 100) : 50;
  const expiryDate = new Date(market.expiryMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="fixed inset-0 z-50 bg-sc-bg overflow-y-auto">
      {/* top bar */}
      <div className="sticky top-0 z-10 bg-sc-bg/95 backdrop-blur border-b border-sc-border/60 px-4 lg:px-6 h-[52px] flex items-center gap-4">
        {/* Left: logo */}
        <button onClick={onClose} className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
          <img src="/assets/app-icon.png" alt="SlabClaw" className="w-7 h-7 object-contain rounded-[2px]" />
          <span className="font-bold text-[14px] tracking-brand text-white">SLABCLAW</span>
          <span className="text-[10px] font-semibold text-sc-amber tracking-wide">PREDICT</span>
        </button>

        {/* Center: card identity */}
        <div className="flex items-center gap-2 min-w-0 flex-1 justify-center">
          <span className="text-[13px] font-semibold text-white truncate">{meta.name}</span>
          <span className="text-[11px] text-sc-muted shrink-0">#{meta.number}</span>
          <GradeBadge grader={meta.grader} grade={meta.grade} />
          <EditionMarks edition={meta.edition} language={meta.language} variant={meta.variant} />
          {market.state !== 0 && (
            <span className="text-[10px] text-sc-amber uppercase tracking-wide">{MARKET_STATE[market.state]}</span>
          )}
        </div>

        {/* Right: testnet + wallet */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="hidden sm:block text-[9px] font-mono text-sc-muted border border-sc-border rounded px-1 py-px">TESTNET</span>
          <WalletButton />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-5 pb-20">
        {/* question header */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-5 mb-5">
          {/* card image — larger, elevated */}
          <div className="w-24 h-[132px] rounded-lg overflow-hidden bg-sc-surface ring-1 ring-sc-border shrink-0 shadow-lg shadow-black/30">
            {meta.image && <img src={meta.image} alt={meta.name} className="w-full h-full object-cover" />}
          </div>

          <div className="flex-1 min-w-0">
            {/* question */}
            <h1 className="text-lg lg:text-xl font-semibold text-white leading-snug mb-2">
              Will {meta.grader} {meta.grade} <span className="text-white">{meta.name}</span> exceed{' '}
              <span className="text-sc-accent">{usdFull(strikeDollars)}</span> by {expiryDate},{' '}
              <span className="text-sc-dim font-normal">according to SlabClaw's oracle?</span>
            </h1>

            {/* exact product identity — pins set/edition/language/year/number so the
                headline stays short while the market resolves on one specific product. */}
            <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-sc-muted">
              <span className="text-sc-dim font-medium">{meta.set}</span>
              <span className="text-sc-border">·</span>
              <span>{meta.language === 'ja' ? 'Japanese' : 'English'}</span>
              <span className="text-sc-border">·</span>
              <span>#{meta.number}</span>
              {meta.year && (<><span className="text-sc-border">·</span><span>{meta.year}</span></>)}
              <span className="text-sc-border">·</span>
              <span>{meta.grader} {meta.grade}</span>
              <span className="text-sc-border">·</span>
              <span className="font-mono text-[10px] text-sc-dim" title="On-chain asset id">{meta.assetId}</span>
            </div>

            {/* stat cards — pill-style with subtle bg */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Oracle now"
                value={oracle ? usd(oracle.price) : '—'}
                sub={dist != null ? `${arrow(dist)} ${pct(Math.abs(dist), { sign: false })} ${oracleAbove ? 'over' : 'under'} strike` : null}
                subColor={oracleAbove ? 'text-sc-yes' : 'text-sc-no'}
                accent={oracleAbove ? 'border-sc-yes/30' : 'border-sc-no/30'} />
              <StatCard label="Market implied"
                value={`${yesPct}% YES`}
                sub={`${100 - yesPct}% NO`}
                valueColor="text-sc-yes" subColor="text-sc-no"
                accent="border-sc-yes/30"
                bar={<div className="mt-1.5 h-1 rounded-full overflow-hidden flex bg-sc-surface">
                  <div className="bg-sc-yes h-full" style={{ width: `${yesPct}%` }} />
                  <div className="bg-sc-no h-full" style={{ width: `${100 - yesPct}%` }} />
                </div>} />
              <StatCard label="Expires in"
                value={timeUntil(market.expiryMs)}
                sub={expiryDate} />
              <StatCard label="Pool"
                value={`${sui(market.poolBalance)} tUSD`}
                sub={`${sui(market.totalYes)} Y / ${sui(market.totalNo)} N`} />
            </div>
          </div>
        </div>

        {/* chart (with tabs) + trade, side by side */}
        <div className="grid lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2">
            <GraphPanel
              isLoading={isLoading}
              oracle={oracle}
              chart={
                <OracleStrikeChart
                  series={series}
                  oracleLine={oLine}
                  oracleNow={oracle?.price ?? null}
                  strike={strikeDollars}
                  expiryMs={market.expiryMs}
                  startMs={start}
                  grader={meta.grader}
                  grade={meta.grade}
                />
              }
            />
          </div>
          <div className="lg:col-span-1">
            <div className="lg:sticky lg:top-16">
              <TradeBox market={market} meta={meta} oracle={oracle} strikeDollars={strikeDollars} onTxSuccess={onTxSuccess} />
            </div>
          </div>
        </div>

        {/* listings for the exact product — full width */}
        <RegistryCardLadder card={card} grader={meta.grader} grade={meta.grade} oracle={oracle} />
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, subColor = 'text-sc-muted', valueColor = 'text-white', accent = 'border-sc-border', bar }) {
  return (
    <div className={`bg-sc-surface/50 border ${accent} rounded-lg px-3 py-2`}>
      <div className="text-[9px] text-sc-muted uppercase tracking-wide font-medium">{label}</div>
      <div className={`text-[15px] font-bold tnum ${valueColor} leading-tight mt-0.5`}>{value}</div>
      {sub && <div className={`text-[11px] tnum ${subColor} mt-0.5`}>{sub}</div>}
      {bar}
    </div>
  );
}

function GraphPanel({ isLoading, oracle, chart }) {
  const [tab, setTab] = useState('chart');
  const Tab = ({ id, children }) => (
    <button onClick={() => setTab(id)}
      className={`px-3 py-2 text-[12px] font-semibold border-b-2 -mb-px transition ${tab === id ? 'border-sc-accent text-white' : 'border-transparent text-sc-muted hover:text-sc-dim'}`}>
      {children}
    </button>
  );
  return (
    <div className="bg-sc-card border border-sc-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-1 border-b border-sc-border px-2">
        <Tab id="chart">Chart</Tab>
        <Tab id="resolve">Resolution Guide</Tab>
      </div>
      <div className="p-3">
        {tab === 'chart'
          ? (isLoading
              ? <div className="h-[300px] grid place-items-center text-sm text-sc-muted">Loading oracle history…</div>
              : chart)
          : <Resolution oracle={oracle} bare />}
      </div>
    </div>
  );
}

function Resolution({ oracle, bare }) {
  const inner = (
    <>
      {!bare && <div className="text-[11px] font-semibold text-sc-dim uppercase tracking-wide mb-2">How this resolves</div>}
      <ol className="space-y-1.5 text-sc-dim list-decimal list-inside">
        <li>At expiry, SlabClaw's multi-platform oracle proposes the settlement price{oracle ? <> (currently sourced from <span className="text-sc-text font-mono">{sourceLabel(oracle.source)}</span>, {oracle.saleCount} comp{oracle.saleCount === 1 ? '' : 's'})</> : ''}.</li>
        <li>YES wins if the oracle price exceeds the strike; otherwise NO wins.</li>
        <li>24h dispute window — anyone can challenge with a tUSD bond (UMA-style).</li>
        <li>Undisputed → auto-settles. Evidence snapshots stored on Walrus.</li>
      </ol>
      {oracle && (
        <div className="mt-2.5 pt-2.5 border-t border-sc-border/60 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tnum">
          <span className="text-sc-muted">current source <span className="text-sc-text font-mono">{sourceLabel(oracle.source)}</span></span>
          <span className="text-sc-muted">tier <span className="text-sc-text">T{oracle.tier}</span></span>
          <span className="text-sc-muted">comps <span className="text-sc-text">{oracle.saleCount}</span></span>
          {oracle.graderMatched ? <span className="text-sc-yes">grader-matched</span> : <span className="text-sc-amber">estimated</span>}
        </div>
      )}
    </>
  );
  if (bare) return <div className="text-[12px]">{inner}</div>;
  return <div className="bg-sc-card border border-sc-border rounded-xl p-3 text-[12px]">{inner}</div>;
}

function TradeBox({ market, meta, oracle, strikeDollars, onTxSuccess }) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { balance: tusd } = useTusdBalance();
  const [side, setSide] = useState('yes');
  const [amount, setAmount] = useState('100');
  const [status, setStatus] = useState(null);
  const [txDigest, setTxDigest] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const settled = market.state === 3;
  const active = market.state === 0;
  const totalShares = market.totalYes + market.totalNo;
  const yesPct = totalShares > 0 ? Math.round((market.totalYes / totalShares) * 100) : 50;
  const broke = account && tusd <= 0;

  async function run(buildTx, okMsg) {
    if (!account) return;
    setStatus('signing'); setErrorMsg(null);
    try {
      const result = await signAndExecute({ transaction: buildTx() });
      setTxDigest(result.digest); setStatus('success'); onTxSuccess?.();
    } catch (err) {
      setErrorMsg(err.message || okMsg); setStatus('error');
    }
  }

  const trade = () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    run(() => (side === 'yes' ? buildBuyYes(market.id, amt) : buildBuyNo(market.id, amt)), 'Transaction failed');
  };

  return (
    <div className="bg-sc-card border border-sc-border rounded-xl p-3.5">
      <div className="flex gap-2 mb-3">
        <Side active={side === 'yes'} color="yes" pct={yesPct} onClick={() => setSide('yes')} label="YES" />
        <Side active={side === 'no'} color="no" pct={100 - yesPct} onClick={() => setSide('no')} label="NO" />
      </div>

      {oracle && (
        <div className="text-[11px] text-sc-muted mb-3 tnum">
          Oracle {usd(oracle.price)} ·{' '}
          <span className={oracle.price >= strikeDollars ? 'text-sc-yes' : 'text-sc-no'}>
            {oracle.price >= strikeDollars ? 'above' : 'below'} strike {usd(strikeDollars)}
          </span>
        </div>
      )}

      {account && (
        <div className="flex items-center justify-between text-[11px] mb-2.5 tnum">
          <span className="text-sc-muted">Balance</span>
          <span className={broke ? 'text-sc-amber font-semibold' : 'text-sc-text font-semibold'}>
            {tusd.toLocaleString(undefined, { maximumFractionDigits: 0 })} tUSD
          </span>
        </div>
      )}

      {!account ? (
        <div className="text-center text-sc-muted text-sm py-4">Connect wallet to trade</div>
      ) : settled ? (
        <button onClick={() => run(() => buildClaim(market.id), 'Claim failed')} disabled={status === 'signing'}
          className="w-full py-2.5 rounded-lg bg-sc-accent text-black font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition">
          {status === 'signing' ? 'Claiming…' : 'Claim winnings'}
        </button>
      ) : active ? (
        <>
          <div className="relative mb-2.5">
            <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} min="1" step="10"
              className="w-full bg-sc-surface border border-sc-border rounded-lg px-3 py-2.5 text-sm font-mono tnum focus:outline-none focus:border-sc-accent" placeholder="Amount" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sc-muted">tUSD</span>
          </div>
          <div className="flex gap-2 mb-3">
            {['25', '100', '250', '500'].map((v) => (
              <button key={v} onClick={() => setAmount(v)}
                className="flex-1 py-1 text-xs font-mono bg-sc-surface border border-sc-border rounded hover:border-sc-accent/50 transition">{v}</button>
            ))}
          </div>
          {broke ? (
            <div className="text-center text-[12px] text-sc-amber py-2">Out of tUSD — grab some from the faucet below ↓</div>
          ) : (
            <button onClick={trade} disabled={status === 'signing' || !amount || parseFloat(amount) <= 0}
              className={`w-full py-2.5 rounded-lg text-black font-semibold text-sm disabled:opacity-50 transition ${side === 'yes' ? 'bg-sc-yes hover:opacity-90' : 'bg-sc-no hover:opacity-90'}`}>
              {status === 'signing' ? 'Confirm in wallet…' : `Buy ${side.toUpperCase()} — ${amount} tUSD`}
            </button>
          )}
        </>
      ) : (
        <div className="text-center text-sc-muted text-sm py-4">Market is {MARKET_STATE[market.state]?.toLowerCase()}</div>
      )}

      {status === 'success' && txDigest && (
        <a href={`${EXPLORER_URL}/tx/${txDigest}`} target="_blank" rel="noopener noreferrer"
          className="block mt-3 p-2 rounded-lg bg-sc-yes/10 border border-sc-yes/20 text-[11px] text-sc-yes hover:underline font-mono truncate">
          ✓ {txDigest}
        </a>
      )}
      {status === 'error' && errorMsg && (
        <div className="mt-3 p-2 rounded-lg bg-sc-no/10 border border-sc-no/20 text-[11px] text-sc-no">{errorMsg}</div>
      )}
    </div>
  );
}

function Side({ active, color, pct, onClick, label }) {
  const on = color === 'yes' ? 'bg-sc-yes text-black' : 'bg-sc-no text-black';
  return (
    <button onClick={onClick}
      className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${active ? on : 'bg-sc-surface text-sc-muted border border-sc-border hover:text-white'}`}>
      {label} <span className="tnum opacity-80">{pct}%</span>
    </button>
  );
}
