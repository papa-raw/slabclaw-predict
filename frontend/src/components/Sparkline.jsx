/// Sparkline — mini oracle-vs-strike line for market tiles. SVG, no deps.
/// Downsamples to ~60 pts, trims warmup, gradient fill, strike-split coloring.

function downsample(pts, maxPts = 60) {
  if (pts.length <= maxPts) return pts;
  const step = (pts.length - 1) / (maxPts - 1);
  const out = [];
  for (let i = 0; i < maxPts - 1; i++) {
    out.push(pts[Math.round(i * step)]);
  }
  out.push(pts[pts.length - 1]); // always include last point
  return out;
}

export default function Sparkline({ points = [], strike = null, height = 40 }) {
  if (!points.length) {
    return (
      <div className="flex items-center justify-center text-[9px] text-sc-muted w-full" style={{ height }}>
        no data
      </div>
    );
  }

  // Fixed internal coordinate space — CSS handles actual width via w-full
  const W = 200;
  const H = height;

  const pts = downsample(points);
  const prices = pts.map((p) => p.price);
  const ts = pts.map((p) => p.t);
  let lo = Math.min(...prices, strike ?? Infinity);
  let hi = Math.max(...prices, strike ?? -Infinity);
  if (lo === hi) { lo -= 1; hi += 1; }
  const pad = (hi - lo) * 0.12;
  lo -= pad; hi += pad;
  const t0 = Math.min(...ts), t1 = Math.max(...ts) || t0 + 1;
  const x = (t) => (t1 === t0 ? W / 2 : ((t - t0) / (t1 - t0)) * (W - 2) + 1);
  const y = (p) => H - ((p - lo) / (hi - lo)) * (H - 2) - 1;

  const linePath = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
  const last = pts[pts.length - 1];
  const lastX = x(last.t);
  const lastY = y(last.price);
  const strikeY = strike != null ? y(strike) : null;

  // Area fill path: line path closed down to bottom-right → bottom-left
  const areaPath = linePath + ` L${lastX.toFixed(1)},${H} L${x(pts[0].t).toFixed(1)},${H} Z`;

  // Unique ID for gradients/clips (avoid collisions with multiple sparklines)
  const id = `sp-${Math.random().toString(36).slice(2, 8)}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" style={{ height }} preserveAspectRatio="xMidYMid meet">
      <defs>
        {/* Gradient for area fill — fades to transparent at bottom */}
        <linearGradient id={`${id}-gUp`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#4CAF50" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#4CAF50" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${id}-gDn`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ef4444" stopOpacity="0" />
          <stop offset="100%" stopColor="#ef4444" stopOpacity="0.18" />
        </linearGradient>
        <linearGradient id={`${id}-gNeutral`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f5c542" stopOpacity="0.15" />
          <stop offset="100%" stopColor="#f5c542" stopOpacity="0" />
        </linearGradient>
        {/* Clip paths for strike-split line coloring */}
        {strikeY != null && (
          <>
            <clipPath id={`${id}-above`}>
              <rect x="0" y="0" width={W} height={Math.max(0, strikeY)} />
            </clipPath>
            <clipPath id={`${id}-below`}>
              <rect x="0" y={strikeY} width={W} height={Math.max(0, H - strikeY)} />
            </clipPath>
          </>
        )}
      </defs>

      {/* Background tint zones */}
      {strikeY != null && (
        <>
          <rect x="0" y="0" width={W} height={Math.max(0, strikeY)} fill="#4CAF50" opacity="0.04" />
          <rect x="0" y={strikeY} width={W} height={Math.max(0, H - strikeY)} fill="#ef4444" opacity="0.04" />
        </>
      )}

      {/* Area fill under line */}
      {strikeY != null ? (
        <>
          <path d={areaPath} clipPath={`url(#${id}-above)`} fill={`url(#${id}-gUp)`} />
          <path d={areaPath} clipPath={`url(#${id}-below)`} fill={`url(#${id}-gDn)`} />
        </>
      ) : (
        <path d={areaPath} fill={`url(#${id}-gNeutral)`} />
      )}

      {/* Strike line */}
      {strikeY != null && (
        <line x1="0" y1={strikeY} x2={W} y2={strikeY} stroke="#f5c542" strokeWidth="1" strokeDasharray="3 2" opacity="0.6" vectorEffect="non-scaling-stroke" />
      )}

      {/* Price line — split at strike into green (above) / red (below) */}
      {strikeY != null ? (
        <>
          <path d={linePath} fill="none" stroke="#4CAF50" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${id}-above)`} />
          <path d={linePath} fill="none" stroke="#ef4444" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" clipPath={`url(#${id}-below)`} />
        </>
      ) : (
        <path d={linePath} fill="none" stroke="#f5c542" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      )}

      {/* Terminal dot — rect with rx avoids oval distortion from non-uniform scaling */}
      <rect
        x={lastX - 2} y={lastY - 2} width={4} height={4} rx={2}
        fill={strike == null ? '#f5c542' : last.price >= strike ? '#4CAF50' : '#ef4444'}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
