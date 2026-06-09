import { MARKET_STATE, MARKET_STATE_COLORS } from '../constants';
import { useCard } from '../hooks/useRegistry';
import { oracleForGrade, smoothOracleHistory, distanceToStrike } from '../lib/registry';
import { usd, pct, arrow, timeUntil, sui } from '../lib/format';
import GradeBadge from './GradeBadge';
import Sparkline from './Sparkline';
import { EditionMarks } from './EditionBadges';

// Strip redundant "1st Edition" / "— 1st Edition" from set name when edition badge already shows it
function cleanSet(set, edition) {
  if (!set) return set;
  const ed = (edition || '').toLowerCase();
  if (ed === '1st edition' || ed === '1st') {
    return set.replace(/\s*[—–-]\s*1st Edition/i, '').replace(/\s+1st Edition/i, '').trim();
  }
  return set;
}

export default function MarketCard({ market, meta, onSelect }) {
  const { data: card } = useCard(meta?.productId);

  const totalShares = market.totalYes + market.totalNo;
  const yesPct = totalShares > 0 ? Math.round((market.totalYes / totalShares) * 100) : 50;
  const noPct = 100 - yesPct;
  const expired = market.expiryMs <= Date.now();
  const strikeDollars = market.strikeUsdCents / 100;

  const oracle = card ? oracleForGrade(card, meta.grader, meta.grade) : null;
  const rawSeries = card ? smoothOracleHistory(card, meta.grader, meta.grade) : [];
  const recentMs = Date.now() - 180 * 86400_000; // last 6 months — trims TWAP warmup ramp
  const series = rawSeries.filter(p => p.t >= recentMs);
  // For resolving markets (proposed/disputed/settled) the bet settles on the ONCHAIN
  // proposed price, not the live oracle — lead the headline with THAT one number so the
  // card never shows a live-oracle-vs-proposed-settle contradiction (e.g. "$8.0k over" up
  // top while the settle is "$4.2k → NO" below).
  const proposedDollars = market.proposedPrice ? market.proposedPrice / 100 : null;
  const resolving = market.state !== 0 && proposedDollars != null;
  const headLabel = resolving ? (market.state === 3 ? 'Settled at' : 'Proposed settle') : 'Oracle now';
  const headValue = resolving ? proposedDollars : (oracle ? oracle.price : null);
  const headDist = headValue != null ? distanceToStrike(headValue, market.strikeUsdCents) : null;
  const headAbove = headValue != null && headValue >= strikeDollars;

  // Outline colour cues the market's life-stage: red = disputed, amber = resolving
  // (proposed, dispute window open), default otherwise.
  const borderCls = market.state === 2 ? 'border-sc-no/40 hover:border-sc-no/60'
    : market.state === 1 ? 'border-sc-amber/40 hover:border-sc-amber/60'
    : 'border-sc-border hover:border-sc-accent/50';

  return (
    <button
      onClick={() => onSelect(market)}
      className={`group w-full text-left bg-sc-card border rounded-xl p-3.5 hover:bg-sc-card/80 active:scale-[.99] transition-all ${borderCls}`}
    >
      {/* Resolution status — pinned to the top for non-active markets */}
      {market.state !== 0 && <div className="mb-3"><StateBanner market={market} /></div>}

      {/* Top: image + identity + headline strike */}
      <div className="flex gap-3.5">
        <div className="w-[72px] h-[100px] rounded-lg overflow-hidden bg-sc-surface shrink-0 ring-1 ring-sc-border">
          {meta?.image ? (
            <img src={meta.image} alt={meta.name} className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform" loading="lazy" />
          ) : (
            <div className="w-full h-full grid place-items-center text-[9px] text-sc-muted">no img</div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-[13px] text-white truncate">{meta?.name}</span>
                <span className="text-[11px] text-sc-muted shrink-0">#{meta?.number}</span>
              </div>
              <div className="text-[11px] text-sc-muted truncate">{cleanSet(meta?.set, meta?.edition)}</div>
              <div className="mt-1 flex items-center gap-1.5">
                <GradeBadge grader={meta?.grader} grade={meta?.grade} />
                <EditionMarks edition={meta?.edition} language={meta?.language} variant={meta?.variant} />
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[9px] text-sc-muted uppercase tracking-wide">Strike</div>
              <div className="text-[15px] font-bold text-sc-accent tnum leading-tight">{usd(strikeDollars)}</div>
            </div>
          </div>

          {/* Oracle / settle vs strike — inline with identity */}
          <div className="mt-2">
            <div className="text-[9px] text-sc-muted uppercase tracking-wide">{headLabel}</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold tnum text-white">{headValue != null ? usd(headValue) : '—'}</span>
              {headDist != null && (
                <span className={`text-[11px] font-semibold tnum ${headAbove ? 'text-sc-yes' : 'text-sc-no'}`}>
                  {arrow(headDist)} {pct(Math.abs(headDist), { sign: false })} {headAbove ? 'over' : 'under'}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Market-implied YES/NO bar */}
      <div className="mt-3">
        <div className="h-1.5 rounded-full overflow-hidden flex bg-sc-surface">
          <div className="bg-sc-yes h-full" style={{ width: `${yesPct}%` }} />
          <div className="bg-sc-no h-full" style={{ width: `${noPct}%` }} />
        </div>
        <div className="mt-1.5 flex items-center gap-3 text-[11px] font-semibold tnum">
          <span className="text-sc-yes">YES {yesPct}%</span>
          <span className="text-sc-no">NO {noPct}%</span>
          <span className="text-sc-muted ml-auto font-normal">{sui(market.poolBalance)} tUSD pool</span>
          <span className={`font-normal ${expired ? 'text-sc-no' : 'text-sc-dim'}`}>
            {expired ? 'Expired' : timeUntil(market.expiryMs)}
          </span>
        </div>
      </div>

      {/* Sparkline — full width below the bar */}
      <div className="mt-2">
        <Sparkline points={series} strike={strikeDollars} height={40} />
      </div>
    </button>
  );
}

// Resolution strip for non-active markets. One tidy row: status dot + label + outcome +
// (countdown / bond) right-aligned. The settle PRICE lives in the headline now, so the
// strip never repeats (or contradicts) it — it only carries procedural status.
function StateBanner({ market }) {
  const proposedDollars = market.proposedPrice ? market.proposedPrice / 100 : null;
  const strikeDollars = market.strikeUsdCents / 100;
  const above = proposedDollars != null && proposedDollars > strikeDollars;
  const outCls = above ? 'text-sc-yes' : 'text-sc-no';
  const outcome = above ? 'YES' : 'NO';

  // PROPOSED — resolving, dispute window open
  if (market.state === 1) {
    const deadlineMs = market.proposedAt ? market.proposedAt + 86_400_000 : null;
    return (
      <ResolutionStrip
        tone="amber" label="Resolving"
        detail={proposedDollars != null
          ? <><span className={`font-semibold ${outCls}`}>{outcome}</span> wins if unchallenged</>
          : 'awaiting settlement'}
        right={deadlineMs ? `${timeUntil(deadlineMs)} to dispute` : null}
      />
    );
  }

  // DISPUTED — challenged, in voting
  if (market.state === 2) {
    return (
      <ResolutionStrip
        tone="no" label="Disputed"
        detail={<>in community voting{proposedDollars != null && <> · <span className={`font-semibold ${outCls}`}>{outcome}</span> proposed</>}</>}
        right={market.disputeBond > 0 ? `${sui(market.disputeBond)} tUSD bond` : null}
      />
    );
  }

  // SETTLED — final outcome, claim open
  if (market.state === 3) {
    const out = market.outcome === true ? 'YES' : market.outcome === false ? 'NO' : '—';
    const cls = market.outcome === true ? 'text-sc-yes' : market.outcome === false ? 'text-sc-no' : 'text-sc-muted';
    return (
      <ResolutionStrip
        tone="muted" label="Settled"
        detail={<><span className={`font-semibold ${cls}`}>{out}</span> won · claim open</>}
        right={null}
      />
    );
  }

  return <div className="text-[10px] text-sc-amber uppercase tracking-wide">{MARKET_STATE[market.state]}</div>;
}

function ResolutionStrip({ tone, label, detail, right }) {
  const dot = tone === 'no' ? 'bg-sc-no' : tone === 'amber' ? 'bg-sc-amber' : 'bg-sc-muted';
  const text = tone === 'no' ? 'text-sc-no' : tone === 'amber' ? 'text-sc-amber' : 'text-sc-muted';
  return (
    <div className="rounded-lg bg-sc-surface/60 border border-sc-border px-3 py-2">
      {/* row 1: status + countdown/bond */}
      <div className="flex items-center gap-2 text-[11px]">
        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} />
        <span className={`font-bold uppercase tracking-wide text-[10px] ${text}`}>{label}</span>
        {right && <span className="ml-auto tnum text-sc-muted shrink-0">{right}</span>}
      </div>
      {/* row 2: outcome — full, never truncated */}
      {detail && <div className="text-[11px] text-sc-dim mt-1 leading-snug">{detail}</div>}
    </div>
  );
}
