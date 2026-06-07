import { MARKET_STATE, MARKET_STATE_COLORS } from '../constants';

function formatUsd(cents) {
  if (!cents && cents !== 0) return '—';
  return '$' + (cents / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
}

function formatSui(mist) {
  if (!mist && mist !== 0) return '0';
  return (mist / 1_000_000_000).toFixed(2);
}

function timeUntil(ms) {
  const diff = ms - Date.now();
  if (diff <= 0) return 'Expired';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days}d ${hours}h`;
  const mins = Math.floor((diff % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}

export default function MarketCard({ market, meta, onSelect }) {
  const totalShares = market.totalYes + market.totalNo;
  const yesPercent = totalShares > 0
    ? Math.round((market.totalYes / totalShares) * 100)
    : 50;
  const noPercent = 100 - yesPercent;
  const stateLabel = MARKET_STATE[market.state] || 'Unknown';
  const stateColor = MARKET_STATE_COLORS[market.state] || 'text-sc-muted';
  const expired = market.expiryMs <= Date.now();

  return (
    <button
      onClick={() => onSelect(market)}
      className="bg-sc-card border border-sc-border rounded-xl p-4 text-left hover:border-sc-accent/40 transition-all group w-full"
    >
      <div className="flex gap-4">
        {/* Card image */}
        <div className="w-20 h-28 rounded-lg overflow-hidden bg-sc-surface flex-shrink-0">
          {meta?.image ? (
            <img
              src={meta.image}
              alt={meta.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-sc-muted text-xs">
              No img
            </div>
          )}
        </div>

        {/* Market info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <h3 className="font-semibold text-sm truncate">
                {meta?.name || market.assetId}
              </h3>
              <p className="text-xs text-sc-muted mt-0.5">
                {meta?.set} · {meta?.grader} {meta?.grade}
              </p>
            </div>
            <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${stateColor} bg-sc-surface`}>
              {stateLabel}
            </span>
          </div>

          {/* Question */}
          <p className="text-xs text-sc-text/80 mt-2">
            Will {meta?.grader || 'PSA'} {meta?.grade || 10}{' '}
            <span className="font-medium">{meta?.name || 'this card'}</span>{' '}
            exceed{' '}
            <span className="text-sc-accent font-semibold">
              {formatUsd(market.strikeUsdCents)}
            </span>
            ?
          </p>

          {/* Probability bar */}
          <div className="mt-3 flex items-center gap-2">
            <div className="flex-1 h-2 bg-sc-surface rounded-full overflow-hidden flex">
              <div
                className="bg-sc-yes h-full transition-all"
                style={{ width: `${yesPercent}%` }}
              />
              <div
                className="bg-sc-no h-full transition-all"
                style={{ width: `${noPercent}%` }}
              />
            </div>
          </div>

          {/* Stats row */}
          <div className="mt-2 flex items-center gap-4 text-[11px] font-mono">
            <span className="text-sc-yes">
              YES {yesPercent}%
            </span>
            <span className="text-sc-no">
              NO {noPercent}%
            </span>
            <span className="text-sc-muted ml-auto">
              {formatSui(market.poolBalance)} SUI
            </span>
            <span className="text-sc-muted">
              {expired ? 'Expired' : timeUntil(market.expiryMs)}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}
