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
  const dist = oracle ? distanceToStrike(oracle.price, market.strikeUsdCents) : null;
  const oracleAbove = oracle && oracle.price >= strikeDollars;

  const isDisputed = market.state === 2;

  return (
    <button
      onClick={() => onSelect(market)}
      className={`group w-full text-left bg-sc-card border rounded-xl p-3.5 hover:bg-sc-card/80 active:scale-[.99] transition-all ${isDisputed ? 'border-sc-no/40 hover:border-sc-no/60' : 'border-sc-border hover:border-sc-accent/50'}`}
    >
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

          {/* Oracle vs strike — inline with identity */}
          <div className="mt-2">
            <div className="text-[9px] text-sc-muted uppercase tracking-wide">Oracle now</div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[15px] font-semibold tnum text-white">{oracle ? usd(oracle.price) : '—'}</span>
              {dist != null && (
                <span className={`text-[11px] font-semibold tnum ${oracleAbove ? 'text-sc-yes' : 'text-sc-no'}`}>
                  {arrow(dist)} {pct(Math.abs(dist), { sign: false })} {oracleAbove ? 'over' : 'under'}
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

      {market.state !== 0 && <StateBanner market={market} />}
    </button>
  );
}

// State-specific banner for non-active markets (proposed, disputed, settled)
function StateBanner({ market }) {
  const proposedDollars = market.proposedPrice ? market.proposedPrice / 100 : null;
  const strikeDollars = market.strikeUsdCents / 100;
  const proposedAbove = proposedDollars != null && proposedDollars > strikeDollars;

  // DISPUTED — red banner with dispute details
  if (market.state === 2) {
    return (
      <div className="mt-2.5 rounded-lg bg-sc-no/10 border border-sc-no/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sc-no">Disputed</span>
          {market.disputeBond > 0 && (
            <span className="text-[10px] tnum text-sc-dim">{sui(market.disputeBond)} tUSD bond</span>
          )}
        </div>
        {proposedDollars != null && (
          <div className="mt-1 text-[11px] text-sc-dim">
            Oracle proposed <span className={`font-semibold ${proposedAbove ? 'text-sc-yes' : 'text-sc-no'}`}>{usd(proposedDollars)}</span>
            <span className="text-sc-muted"> → {proposedAbove ? 'YES' : 'NO'} wins</span>
            <span className="text-sc-no ml-1.5">· challenged</span>
          </div>
        )}
      </div>
    );
  }

  // PROPOSED — amber banner with proposed price + countdown
  if (market.state === 1) {
    const deadlineMs = market.proposedAt ? market.proposedAt + 86_400_000 : null;
    return (
      <div className="mt-2.5 rounded-lg bg-sc-amber/10 border border-sc-amber/30 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sc-amber">Proposed</span>
          {deadlineMs && <span className="text-[10px] tnum text-sc-dim">dispute window: {timeUntil(deadlineMs)}</span>}
        </div>
        {proposedDollars != null && (
          <div className="mt-1 text-[11px] text-sc-dim">
            Oracle: <span className={`font-semibold ${proposedAbove ? 'text-sc-yes' : 'text-sc-no'}`}>{usd(proposedDollars)}</span>
            <span className="text-sc-muted"> → {proposedAbove ? 'YES' : 'NO'} wins if unchallenged</span>
          </div>
        )}
      </div>
    );
  }

  // SETTLED — muted banner
  if (market.state === 3) {
    const outcomeLabel = market.outcome === true ? 'YES' : market.outcome === false ? 'NO' : '—';
    const outcomeCls = market.outcome === true ? 'text-sc-yes' : market.outcome === false ? 'text-sc-no' : 'text-sc-muted';
    return (
      <div className="mt-2.5 rounded-lg bg-white/[0.03] border border-sc-border px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wide text-sc-muted">Settled</span>
          {proposedDollars != null && <span className="text-[10px] tnum text-sc-dim">at {usd(proposedDollars)}</span>}
        </div>
        <div className="mt-1 text-[11px]">
          <span className={`font-semibold ${outcomeCls}`}>{outcomeLabel}</span>
          <span className="text-sc-muted"> wins · claim open</span>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <div className="mt-2 text-[10px] text-sc-amber uppercase tracking-wide">{MARKET_STATE[market.state]}</div>
  );
}
