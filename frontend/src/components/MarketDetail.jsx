/// MarketDetail — full evidence-rich market page (echoes registry card-detail layout).
/// Chart (centerpiece) + evidence ladder + recent comps + resolution + onchain trade.

import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { buildBuyYes, buildBuyNo, buildClaim, buildDispute, buildFinalize } from '../lib/transactions';
import { MARKET_STATE, EXPLORER_URL } from '../constants';
import { useCard } from '../hooks/useRegistry';
import { useTusdBalance } from '../hooks/useTusd';
import { useLiveConsensus } from '../hooks/useLiveConsensus';
import {
  oracleForGrade, priceSeries, smoothOracleHistory, distanceToStrike, sourceLabel,
} from '../lib/registry';
import { usd, usdFull, pct, arrow, sui, timeUntil } from '../lib/format';
import GradeBadge from './GradeBadge';
import { EditionMarks } from './EditionBadges';
import OracleStrikeChart from './OracleStrikeChart';
import RegistryCardLadder from './RegistryCardLadder';
import OracleConsensusPanel from './OracleConsensusPanel';
import WalletButton from './WalletButton';

export default function MarketDetail({ market, meta, onClose, onTxSuccess }) {
  const { data: card, isLoading } = useCard(meta?.productId);

  const strikeDollars = market.strikeUsdCents / 100;
  const start = meta?.chartStartMs ?? null;
  const oracle = card ? oracleForGrade(card, meta.grader, meta.grade) : null;
  const series = card ? priceSeries(card, meta.grader, meta.grade).filter((p) => !start || p.t >= start) : [];
  const oLine = card ? smoothOracleHistory(card, meta.grader, meta.grade).filter((p) => !start || p.t >= start) : [];

  // The headline "Oracle now" must agree with the OracleConsensusPanel's "SETTLES AT"
  // number — that's the value this bet actually resolves against. Prefer the live swarm
  // consensus (same source the panel reads) and fall back to the registry oracle only
  // when no consensus exists for this product.
  const { data: consensusData } = useLiveConsensus();
  const consensusCents = consensusData?.consensus?.[meta?.productId]?.consensusPriceCents ?? null;
  const settlePrice = consensusCents != null ? consensusCents / 100 : (oracle?.price ?? null);

  const dist = settlePrice != null ? distanceToStrike(settlePrice, market.strikeUsdCents) : null;
  const oracleAbove = settlePrice != null && settlePrice >= strikeDollars;

  const totalShares = market.totalYes + market.totalNo;
  const yesPct = totalShares > 0 ? Math.round((market.totalYes / totalShares) * 100) : 50;
  const expiryDate = new Date(market.expiryMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  // Accessible dialog: ESC to close, focus trap, body scroll-lock, restore focus
  // to the triggering card on close. (The market is a modal over the list.)
  const dialogRef = useRef(null);
  useEffect(() => {
    const prevFocus = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const root = dialogRef.current;
    root?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
      if (e.key !== 'Tab' || !root) return;
      const f = root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])');
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (prevFocus && typeof prevFocus.focus === 'function') prevFocus.focus();
    };
  }, [onClose]);

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="market-dialog-title" tabIndex={-1}
      className="fixed inset-0 z-50 bg-sc-bg overflow-y-auto focus:outline-none">
      {/* top bar */}
      <div className="sticky top-0 z-10 bg-sc-bg/95 backdrop-blur border-b border-sc-border/60 px-4 lg:px-6 h-[52px] flex items-center gap-4">
        {/* Left: logo */}
        <button onClick={onClose} className="flex items-center gap-2 shrink-0 hover:opacity-80 transition-opacity">
          <img src="/assets/app-icon.png" alt="SlabClaw" className="w-7 h-7 object-contain rounded-[2px]" />
          <span className="font-bold text-[14px] tracking-brand text-white">SLABCLAW</span>
          <span className="text-[10px] font-semibold text-sc-accent tracking-wide">PREDICT</span>
        </button>

        {/* Center: card identity chip — hidden below md so it can't collide with the
            left logo on a 390px viewport (centered on the full width, it lands on top of
            SLABCLAW PREDICT). Mirrors Header.jsx's `hidden md:flex` KPI strip. */}
        <div className="hidden md:flex items-center min-w-0 flex-1 justify-center">
          <div className="inline-flex items-center gap-2 bg-sc-surface/60 border border-sc-border/60 rounded-full px-3.5 py-1">
            <span className="text-[13px] font-semibold text-white truncate">{meta.name}</span>
            <span className="text-[11px] text-sc-muted shrink-0">#{meta.number}</span>
            <GradeBadge grader={meta.grader} grade={meta.grade} />
            <EditionMarks edition={meta.edition} language={meta.language} variant={meta.variant} />
            {market.state !== 0 && (
              <span className={`text-[10px] uppercase tracking-wide ${market.state === 2 ? 'text-sc-no font-semibold' : 'text-sc-amber'}`}>{MARKET_STATE[market.state]}</span>
            )}
          </div>
        </div>

        {/* Right: wallet (its pill already carries the TESTNET badge). ml-auto keeps it
            right-aligned on mobile, where the centered identity chip is hidden. */}
        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
          <WalletButton />
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-5 pb-20">
        {/* question header */}
        <div className="flex flex-col lg:flex-row lg:items-start gap-5 mb-5">
          {/* card image — larger, elevated */}
          <div className="w-24 h-[132px] rounded-lg overflow-hidden bg-sc-surface ring-1 ring-sc-border shrink-0">
            {meta.image && <img src={meta.image} alt={meta.name} className="w-full h-full object-cover" />}
          </div>

          <div className="flex-1 min-w-0">
            {/* question */}
            <h1 id="market-dialog-title" className="text-lg lg:text-xl font-semibold text-white leading-snug mb-2">
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
              <span className="inline-flex items-center gap-1 font-mono text-[10px] text-sc-dim">
                {meta.assetId}
                <InfoTip>
                  The immutable <span className="text-sc-text">onchain asset ID</span> this market settles on.
                  It encodes set · card number · grader · grade (grade in basis points — PSA 10 = 1000),
                  binding the market to exactly one product so resolution is never ambiguous.
                </InfoTip>
              </span>
            </div>

            {/* stat cards — pill-style with subtle bg */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard label="Oracle now"
                value={settlePrice != null ? usd(settlePrice) : '—'}
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

        {/* dispute/resolution banner for non-active markets */}
        {market.state !== 0 && (
          <DisputePanel market={market} meta={meta} strikeDollars={strikeDollars} onTxSuccess={onTxSuccess} />
        )}

        {/* chart (with tabs) + trade, side by side */}
        <div className="grid lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2">
            <GraphPanel
              isLoading={isLoading}
              oracle={oracle}
              productId={meta?.productId}
              chart={
                <OracleStrikeChart
                  series={series}
                  oracleLine={oLine}
                  oracleNow={settlePrice}
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
              <TradeBox market={market} meta={meta} settlePrice={settlePrice} strikeDollars={strikeDollars} onTxSuccess={onTxSuccess} />
            </div>
          </div>
        </div>

        {/* listings for the exact product — full width */}
        <RegistryCardLadder card={card} grader={meta.grader} grade={meta.grade} oracle={oracle} />
      </div>
    </div>
  );
}

// ── Dispute / Resolution Panel ──────────────────────────────────────
// Full-width banner showing the current resolution state + dispute flow steps + participation CTAs.
const MIN_DISPUTE_BOND = 10_000; // tUSD (matches contract MIN_DISPUTE_BOND / 1e9)

function DisputePanel({ market, meta, strikeDollars, onTxSuccess }) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const [status, setStatus] = useState(null); // null | 'signing' | 'success' | 'error'
  const [txDigest, setTxDigest] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);
  const [bondAmount, setBondAmount] = useState(String(MIN_DISPUTE_BOND));

  const proposedDollars = market.proposedPrice ? market.proposedPrice / 100 : null;
  const proposedAbove = proposedDollars != null && proposedDollars > strikeDollars;
  const proposedOutcome = proposedAbove ? 'YES' : 'NO';
  const isDisputed = market.state === 2;
  const isProposed = market.state === 1;
  const isSettled = market.state === 3;

  // Dispute window: the ONCHAIN deadline snapshotted at proposal time (governance
  // can set a longer window for thin/rare markets), falling back to proposedAt + 24h
  // only if the chain field is unavailable. Reading the real value is what keeps the
  // dispute CTA correctly OPEN for a long-window market.
  const disputeDeadlineMs = market.disputeDeadlineMs ?? (market.proposedAt ? market.proposedAt + 86_400_000 : null);
  const disputeWindowOpen = disputeDeadlineMs && Date.now() < disputeDeadlineMs;

  // truncate address: 0xabcd…1234
  const short = (addr) => {
    if (!addr) return '—';
    const s = typeof addr === 'string' ? addr : addr?.toString?.() ?? '—';
    return s.length > 16 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
  };

  async function run(buildTx, label) {
    if (!account) return;
    setStatus('signing'); setErrorMsg(null); setTxDigest(null);
    try {
      const result = await signAndExecute({ transaction: buildTx() });
      setTxDigest(result.digest); setStatus('success'); onTxSuccess?.();
    } catch (err) {
      setErrorMsg(err.message || `${label} failed`); setStatus('error');
    }
  }

  const submitDispute = () => {
    const amt = parseFloat(bondAmount);
    if (isNaN(amt) || amt < MIN_DISPUTE_BOND) return;
    run(() => buildDispute(market.id, amt), 'Dispute');
  };

  const submitFinalize = () => {
    run(() => buildFinalize(market.id), 'Finalize');
  };

  // Color scheme by state
  const borderCls = isDisputed ? 'border-sc-no/40' : isProposed ? 'border-sc-amber/40' : 'border-sc-border';
  const bgCls = isDisputed ? 'bg-sc-no/5' : isProposed ? 'bg-sc-amber/5' : 'bg-sc-surface/30';

  return (
    <div className={`mb-5 rounded-xl ${bgCls} border ${borderCls} overflow-hidden`}>
      {/* header */}
      <div className={`px-4 py-2.5 border-b ${borderCls} flex items-center justify-between`}>
        <div className="flex items-center gap-2.5">
          <span className={`text-[11px] font-bold uppercase tracking-wide ${isDisputed ? 'text-sc-no' : isProposed ? 'text-sc-amber' : 'text-sc-muted'}`}>
            {MARKET_STATE[market.state]}
          </span>
          {isDisputed && <span className="text-[10px] text-sc-dim">Oracle proposal challenged — awaiting admin resolution</span>}
          {isProposed && disputeWindowOpen && <span className="text-[10px] text-sc-dim">Dispute window closes in {timeUntil(disputeDeadlineMs)}</span>}
          {isProposed && !disputeWindowOpen && <span className="text-[10px] text-sc-yes">Dispute window closed — ready to finalize</span>}
        </div>
        <a href={`${EXPLORER_URL}/object/${market.id}`} target="_blank" rel="noopener noreferrer"
          className="text-[10px] text-sc-accent hover:underline font-mono shrink-0">View onchain ↗</a>
      </div>

      <div className="px-4 py-3">
        {/* Flow steps — visualize where we are in the resolution lifecycle */}
        <div className="flex items-center gap-0 mb-4 overflow-x-auto">
          <FlowStep n={1} label="Expired" done active={false} />
          <FlowArrow />
          <FlowStep n={2} label="Oracle proposed" done active={false} />
          <FlowArrow />
          {isDisputed || isSettled ? (
            <>
              <FlowStep n={3} label="Disputed" done={isSettled} active={isDisputed} disputed={isDisputed} />
              <FlowArrow />
              <FlowStep n={4} label="Admin resolves" done={isSettled} active={false} />
            </>
          ) : (
            <>
              <FlowStep n={3} label="Dispute window" done={!disputeWindowOpen} active={disputeWindowOpen} />
              <FlowArrow />
              <FlowStep n={4} label="Finalize" done={isSettled} active={isProposed && !disputeWindowOpen} />
            </>
          )}
          <FlowArrow />
          <FlowStep n={5} label="Claim" done={false} active={false} />
        </div>

        {/* Detail grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {proposedDollars != null && (
            <div className="bg-sc-surface/50 rounded-lg px-3 py-2">
              <div className="text-[9px] text-sc-muted uppercase tracking-wide">Oracle proposed</div>
              <div className={`text-[15px] font-bold tnum ${proposedAbove ? 'text-sc-yes' : 'text-sc-no'}`}>{usd(proposedDollars)}</div>
              <div className="text-[10px] text-sc-dim">→ {proposedOutcome} wins · strike {usd(strikeDollars)}</div>
            </div>
          )}

          {market.proposedSources != null && (
            <div className="bg-sc-surface/50 rounded-lg px-3 py-2">
              <div className="text-[9px] text-sc-muted uppercase tracking-wide">Oracle sources</div>
              <div className="text-[15px] font-bold tnum text-white">{market.proposedSources}</div>
              <div className="text-[10px] text-sc-dim">platforms confirmed price</div>
            </div>
          )}

          {isDisputed && market.disputeBond > 0 && (
            <div className="bg-sc-surface/50 rounded-lg px-3 py-2">
              <div className="text-[9px] text-sc-muted uppercase tracking-wide">Dispute bond</div>
              <div className="text-[15px] font-bold tnum text-sc-no">{sui(market.disputeBond)} tUSD</div>
              <div className="text-[10px] text-sc-dim">staked by disputer</div>
            </div>
          )}

          {isDisputed && market.disputer && (
            <div className="bg-sc-surface/50 rounded-lg px-3 py-2">
              <div className="text-[9px] text-sc-muted uppercase tracking-wide">Disputer</div>
              <div className="text-[13px] font-mono tnum text-white mt-0.5">{short(market.disputer)}</div>
              <div className="text-[10px] text-sc-dim">challenged the oracle</div>
            </div>
          )}

          {isSettled && (
            <div className="bg-sc-surface/50 rounded-lg px-3 py-2">
              <div className="text-[9px] text-sc-muted uppercase tracking-wide">Outcome</div>
              <div className={`text-[15px] font-bold ${market.outcome === true ? 'text-sc-yes' : 'text-sc-no'}`}>
                {market.outcome === true ? 'YES' : 'NO'}
              </div>
              <div className="text-[10px] text-sc-dim">winners can claim</div>
            </div>
          )}
        </div>

        {/* ── Participation CTAs ────────────────────────────────────── */}

        {/* PROPOSED + window open → Dispute CTA */}
        {isProposed && disputeWindowOpen && (
          <div className="mt-4 pt-3 border-t border-sc-border/40">
            <div className="text-[11px] text-sc-dim leading-relaxed mb-3">
              <span className="text-sc-amber font-semibold">Think the oracle is wrong?</span>{' '}
              The oracle proposed <span className="text-white font-semibold">{usd(proposedDollars)}</span> which would make{' '}
              <span className={proposedAbove ? 'text-sc-yes font-semibold' : 'text-sc-no font-semibold'}>{proposedOutcome}</span> the winning side.
              Post a tUSD bond (min {MIN_DISPUTE_BOND.toLocaleString()} tUSD) to challenge. If the dispute is valid, your bond is returned.
              If frivolous, it's added to the pool.
            </div>
            {account ? (
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-[200px]">
                  <div className="text-[9px] text-sc-muted uppercase tracking-wide mb-1">Bond amount (tUSD)</div>
                  <input type="number" value={bondAmount} onChange={(e) => setBondAmount(e.target.value)}
                    min={MIN_DISPUTE_BOND} step="1000"
                    className="w-full bg-sc-surface border border-sc-border rounded-lg px-3 py-2 text-sm font-mono tnum focus:border-sc-no" />
                </div>
                <button onClick={submitDispute}
                  disabled={status === 'signing' || parseFloat(bondAmount) < MIN_DISPUTE_BOND}
                  className="px-5 py-2 rounded-lg bg-sc-no text-black font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition">
                  {status === 'signing' ? 'Confirm in wallet…' : 'Dispute'}
                </button>
              </div>
            ) : (
              <div className="text-[11px] text-sc-muted">Connect wallet to dispute</div>
            )}
          </div>
        )}

        {/* PROPOSED + window closed → Finalize CTA */}
        {isProposed && !disputeWindowOpen && (
          <div className="mt-4 pt-3 border-t border-sc-border/40">
            <div className="text-[11px] text-sc-dim leading-relaxed mb-3">
              The dispute window has closed with no challenges. Anyone can finalize this market to settle it
              at the oracle's proposed price of <span className="text-white font-semibold">{usd(proposedDollars)}</span>.
              {' '}<span className={proposedAbove ? 'text-sc-yes font-semibold' : 'text-sc-no font-semibold'}>{proposedOutcome}</span> wins.
            </div>
            {account ? (
              <button onClick={submitFinalize} disabled={status === 'signing'}
                className="px-5 py-2 rounded-lg bg-sc-yes text-black font-semibold text-sm hover:opacity-90 disabled:opacity-50 transition">
                {status === 'signing' ? 'Confirm in wallet…' : 'Finalize Market'}
              </button>
            ) : (
              <div className="text-[11px] text-sc-muted">Connect wallet to finalize</div>
            )}
          </div>
        )}

        {/* DISPUTED → Awaiting admin resolution */}
        {isDisputed && (
          <div className="mt-3 pt-3 border-t border-sc-border/40 text-[11px] text-sc-dim leading-relaxed">
            <span className="text-sc-no font-semibold">Dispute active.</span>{' '}
            The oracle proposed <span className="text-white font-semibold">{usd(proposedDollars)}</span> at expiry, which would make{' '}
            <span className={proposedAbove ? 'text-sc-yes font-semibold' : 'text-sc-no font-semibold'}>{proposedOutcome}</span> the winning side{settlePrice != null && (
              <> — but the swarm's live reading has since moved to <span className="text-white font-semibold">{usd(settlePrice)}</span> ({oracleAbove ? 'above' : 'below'} strike)</>
            )}.
            A disputer staked a <span className="text-white">{sui(market.disputeBond)} tUSD</span> bond to challenge the proposal.
            The admin reviews evidence and resolves with the correct price. If the dispute was valid, the bond is returned;
            if frivolous, it's added to the pool. In v2, resolution moves to{' '}
            <a href="https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work" target="_blank" rel="noopener noreferrer"
              className="text-sc-accent hover:underline">UMA-style</a> SUI-staked community voting.
          </div>
        )}

        {/* SETTLED → Claim reminder */}
        {isSettled && (
          <div className="mt-3 pt-3 border-t border-sc-border/40 text-[11px] text-sc-dim leading-relaxed">
            Market settled at <span className="text-white font-semibold">{usd(proposedDollars)}</span>.
            {' '}<span className={market.outcome === true ? 'text-sc-yes font-semibold' : 'text-sc-no font-semibold'}>
              {market.outcome === true ? 'YES' : 'NO'}
            </span> wins. Use the trade panel on the right to claim your winnings.
          </div>
        )}

        {/* Transaction feedback */}
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
    </div>
  );
}

function FlowStep({ n, label, done, active, disputed }) {
  const bg = active
    ? (disputed ? 'bg-sc-no/20 border-sc-no/50 text-sc-no' : 'bg-sc-amber/20 border-sc-amber/50 text-sc-amber')
    : done
      ? 'bg-sc-yes/10 border-sc-yes/30 text-sc-yes'
      : 'bg-sc-surface/50 border-sc-border text-sc-muted';
  return (
    <div className={`flex items-center gap-2 border rounded-lg px-2.5 py-1.5 shrink-0 ${bg}`}>
      <span className="text-[10px] font-bold">{n}</span>
      <span className="text-[10px] font-semibold whitespace-nowrap">{label}</span>
    </div>
  );
}

function FlowArrow() {
  return <span className="text-sc-muted text-[10px] px-1 shrink-0">→</span>;
}

function InfoTip({ children }) {
  return (
    <span className="relative inline-flex items-center align-middle group/info">
      <span className="ml-0.5 w-3 h-3 rounded-full border border-sc-muted/70 text-sc-muted text-[8px] font-bold leading-none flex items-center justify-center cursor-help">i</span>
      <span className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-1.5 w-60 rounded-md border border-sc-border bg-black px-2.5 py-2 text-[10px] leading-relaxed text-sc-dim opacity-0 group-hover/info:opacity-100 transition-opacity z-50 normal-case font-sans">
        {children}
      </span>
    </span>
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

function GraphPanel({ isLoading, oracle, chart, productId }) {
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
        <Tab id="swarm">How it’s priced</Tab>
        <Tab id="resolve">How it settles</Tab>
      </div>
      <div className="p-3">
        {tab === 'chart'
          ? (isLoading
              ? <div className="h-[300px] grid place-items-center text-sm text-sc-muted">Loading oracle history…</div>
              : chart)
          : tab === 'resolve'
            ? <Resolution oracle={oracle} bare />
            : <OracleConsensusPanel productId={productId} />}
      </div>
    </div>
  );
}

function Resolution({ oracle, bare }) {
  const inner = (
    <>
      {!bare && <div className="text-[11px] font-semibold text-sc-dim uppercase tracking-wide mb-2">How this resolves</div>}
      <p className="text-[12px] leading-relaxed text-sc-dim mb-3">
        When this market closes it settles itself on real card sales, not opinions. Here’s exactly how a winner gets paid.
      </p>
      <ol className="space-y-2.5">
        <ResolveStep n="1" title="The market closes">
          At expiry, the oracle posts the card’s real price: the swarm consensus under the{' '}
          <span className="text-sc-text font-medium">How it’s priced</span> tab
          {oracle ? <> (right now, the median of <span className="text-sc-text font-semibold">{oracle.saleCount}</span> completed sale{oracle.saleCount === 1 ? '' : 's'})</> : ''}.
        </ResolveStep>
        <ResolveStep n="2" title="Who wins">
          <span className="text-sc-yes font-semibold">YES</span> wins if that price is above the strike.{' '}
          <span className="text-sc-no font-semibold">NO</span> wins if it’s at or below.
        </ResolveStep>
        <ResolveStep n="3" title="A 24-hour window to challenge it">
          Think the price is wrong? Anyone can challenge it by staking a deposit. Get it right and you earn a
          reward; get it wrong and you lose the stake. (This is the “optimistic oracle” design{' '}
          <a href="https://docs.uma.xyz/protocol-overview/how-does-umas-oracle-work" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">UMA</a> pioneered.)
        </ResolveStep>
        <ResolveStep n="4" title="Winners get paid">
          If nobody challenges, the market settles automatically and winners claim. Every sale and the math
          behind the price is stored on <span className="text-sc-text">Walrus</span> and referenced onchain,
          so anyone can re-check it.
        </ResolveStep>
      </ol>
      {oracle && (
        <div className="mt-2.5 pt-2.5 border-t border-sc-border/60 flex flex-wrap gap-x-4 gap-y-1 text-[11px] tnum">
          <span className="text-sc-muted">priced from <span className="text-sc-text font-mono">{sourceLabel(oracle.source)}</span></span>
          <span className="text-sc-muted"><span className="text-sc-text">{oracle.saleCount}</span> sale{oracle.saleCount === 1 ? '' : 's'}</span>
          {oracle.graderMatched ? <span className="text-sc-yes">same grade</span> : <span className="text-sc-amber">estimated</span>}
        </div>
      )}
    </>
  );
  if (bare) return <div className="text-[12px]">{inner}</div>;
  return <div className="bg-sc-card border border-sc-border rounded-xl p-3 text-[12px]">{inner}</div>;
}

function ResolveStep({ n, title, children }) {
  return (
    <li className="flex gap-2.5">
      <span className="shrink-0 w-5 h-5 rounded-full bg-sc-accent/15 text-sc-accent text-[10px] font-bold grid place-items-center mt-px">{n}</span>
      <div className="text-sc-dim leading-relaxed">
        <span className="text-sc-text font-semibold">{title}.</span> {children}
      </div>
    </li>
  );
}

function TradeBox({ market, meta, settlePrice, strikeDollars, onTxSuccess }) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { balance: tusd, isLoading: balLoading } = useTusdBalance();
  const [side, setSide] = useState('yes');
  const [amount, setAmount] = useState('100');
  const [status, setStatus] = useState(null);
  const [txDigest, setTxDigest] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const settled = market.state === 3;
  const active = market.state === 0;
  const totalShares = market.totalYes + market.totalNo;
  const yesPct = totalShares > 0 ? Math.round((market.totalYes / totalShares) * 100) : 50;
  const broke = account && !balLoading && tusd <= 0;

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
      <fieldset disabled={status === 'signing'} aria-busy={status === 'signing'} className="border-0 p-0 m-0 min-w-0 disabled:opacity-60 transition-opacity">
      <div className="flex gap-2 mb-3">
        <Side active={side === 'yes'} color="yes" pct={yesPct} onClick={() => setSide('yes')} label="YES" />
        <Side active={side === 'no'} color="no" pct={100 - yesPct} onClick={() => setSide('no')} label="NO" />
      </div>

      {settlePrice != null && (
        <div className="text-[11px] text-sc-muted mb-3 tnum">
          Oracle {usd(settlePrice)} ·{' '}
          <span className={settlePrice >= strikeDollars ? 'text-sc-yes' : 'text-sc-no'}>
            {settlePrice >= strikeDollars ? 'above' : 'below'} strike {usd(strikeDollars)}
          </span>
        </div>
      )}

      {account && (
        <div className="flex items-center justify-between text-[11px] mb-2.5 tnum">
          <span className="text-sc-muted">Balance</span>
          <span className={broke ? 'text-sc-amber font-semibold' : 'text-sc-text font-semibold'}>
            {balLoading ? '—' : tusd.toLocaleString(undefined, { maximumFractionDigits: 0 })} tUSD
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
              className="w-full bg-sc-surface border border-sc-border rounded-lg px-3 py-2.5 text-sm font-mono tnum focus:border-sc-accent" placeholder="Amount" />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-sc-muted">tUSD</span>
          </div>
          <div className="flex gap-2 mb-3">
            {['25', '100', '250', '500'].map((v) => (
              <button key={v} onClick={() => setAmount(v)}
                className="flex-1 py-2 text-xs font-mono bg-sc-surface border border-sc-border rounded hover:border-sc-accent/50 active:scale-[.97] transition">{v}</button>
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
      </fieldset>

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
