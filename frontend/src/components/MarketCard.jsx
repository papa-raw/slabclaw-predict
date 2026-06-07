import { MARKET_STATE } from '../constants';
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

  return (
    <button
      onClick={() => onSelect(market)}
      className="group w-full text-left bg-sc-card border border-sc-border rounded-xl p-3.5 hover:border-sc-accent/50 hover:bg-sc-card/80 transition-all"
    >
      {/* Top: image + identity + headline strike */}
      <div className="flex gap-3.5">
        <div className="w-[72px] h-[100px] rounded-lg overflow-hidden bg-sc-surface shrink-0 ring-1 ring-sc-border shadow-md shadow-black/20">
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

      {market.state !== 0 && (
        <div className="mt-2 text-[10px] text-sc-amber uppercase tracking-wide">{MARKET_STATE[market.state]}</div>
      )}
    </button>
  );
}
