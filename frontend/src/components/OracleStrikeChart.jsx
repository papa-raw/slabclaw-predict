/// OracleStrikeChart — the prediction-market centerpiece.
///
/// Shows everything a bettor needs to price YES/NO on
/// "Will [grader grade] exceed [strike] by [expiry]?":
///   • sold-comps scatter (real sales, grader+grade matched)
///   • oracle TWAP line (smoothed from comps, hoverable crosshair)
///   • strike reference line + YES (above, green) / NO (below, red) zones
///   • expiry marker + countdown
///   • hover tooltip per comp OR per TWAP point

import { useMemo, useState, useCallback, useRef } from 'react';
import { usd, shortDate, timeUntil } from '../lib/format';

const W = 760, H = 360;
const M = { top: 26, right: 64, bottom: 30, left: 8 };
const PLOT_W = W - M.left - M.right;
const PLOT_H = H - M.top - M.bottom;

const DAY = 86400000;

export default function OracleStrikeChart({
  series = [],          // [{t, price, date, platform, url, source, crossGrader}]
  oracleLine = [],      // [{t, price, source}]
  oracleNow = null,     // number ($)
  strike,               // number ($)
  expiryMs,
  startMs = null,       // optional x-axis floor (e.g. Oct 1 2025)
  grader = 'PSA',
  grade = 10,
}) {
  const [hover, setHover] = useState(null);         // index into series (comp dot)
  const [twapHover, setTwapHover] = useState(null); // index into oracleLine
  const svgRef = useRef(null);

  const model = useMemo(() => {
    const all = [...series, ...oracleLine];
    if (!all.length && oracleNow == null) return null;

    const now = Date.now();
    const ts = all.map((p) => p.t);
    let tMin = startMs ?? (ts.length ? Math.min(...ts) : now - 90 * DAY);
    let tMax = Math.max(expiryMs || now, ts.length ? Math.max(...ts) : now, now);
    if (startMs == null) tMin -= (tMax - tMin) * 0.03;

    const prices = [
      ...all.map((p) => p.price),
      strike,
      oracleNow,
    ].filter((v) => v != null && !isNaN(v));
    let pMin = Math.min(...prices);
    let pMax = Math.max(...prices);
    if (pMin === pMax) { pMin *= 0.9; pMax *= 1.1; }
    const padP = (pMax - pMin) * 0.12;
    pMin = Math.max(0, pMin - padP);
    pMax += padP;

    const x = (t) => M.left + ((t - tMin) / (tMax - tMin)) * PLOT_W;
    const y = (p) => M.top + (1 - (p - pMin) / (pMax - pMin)) * PLOT_H;
    const tFromX = (svgX) => tMin + ((svgX - M.left) / PLOT_W) * (tMax - tMin);

    const priceTicks = [];
    for (let i = 0; i <= 4; i++) priceTicks.push(pMin + ((pMax - pMin) * i) / 4);
    const timeTicks = [];
    for (let i = 0; i <= 4; i++) timeTicks.push(tMin + ((tMax - tMin) * i) / 4);

    const oraclePath = oracleLine.length
      ? oracleLine.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ')
      : null;

    return { x, y, tFromX, tMin, tMax, pMin, pMax, priceTicks, timeTicks, oraclePath, now };
  }, [series, oracleLine, oracleNow, strike, expiryMs, startMs]);

  // Find nearest TWAP point by mouse x position
  const handleMouseMove = useCallback((e) => {
    if (!model || !oracleLine.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < M.left || svgX > M.left + PLOT_W) { setTwapHover(null); return; }

    const t = model.tFromX(svgX);
    let best = 0;
    let bestDist = Math.abs(oracleLine[0].t - t);
    for (let i = 1; i < oracleLine.length; i++) {
      const d = Math.abs(oracleLine[i].t - t);
      if (d < bestDist) { best = i; bestDist = d; }
      else break; // sorted — once distance increases we're past it
    }
    setTwapHover(best);
  }, [model, oracleLine]);

  const clearHovers = useCallback(() => { setHover(null); setTwapHover(null); }, []);

  if (!model) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-sc-muted bg-sc-card border border-sc-border rounded-xl">
        No sold comps available for {grader} {grade} yet
      </div>
    );
  }

  const { x, y, priceTicks, timeTicks, oraclePath, now } = model;
  const strikeY = y(strike);
  const expiryX = expiryMs ? x(expiryMs) : null;
  const nowX = x(now);
  const twapPt = twapHover != null ? oracleLine[twapHover] : null;
  const showTwap = twapPt && hover == null;

  return (
    <div className="relative">
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 'auto' }}
        onMouseMove={handleMouseMove}
        onMouseLeave={clearHovers}>
        {/* YES / NO zones */}
        <rect x={M.left} y={M.top} width={PLOT_W} height={Math.max(0, strikeY - M.top)} fill="#4CAF50" opacity="0.06" />
        <rect x={M.left} y={strikeY} width={PLOT_W} height={Math.max(0, M.top + PLOT_H - strikeY)} fill="#ef4444" opacity="0.06" />

        {/* price gridlines + right-axis labels */}
        {priceTicks.map((p, i) => (
          <g key={i}>
            <line x1={M.left} y1={y(p)} x2={M.left + PLOT_W} y2={y(p)} stroke="#ffffff" strokeOpacity="0.05" />
            <text x={M.left + PLOT_W + 6} y={y(p) + 3} fontSize="10" fill="#6b6b7e" className="tnum">{usd(p)}</text>
          </g>
        ))}

        {/* time axis labels */}
        {timeTicks.map((t, i) => (
          <text key={i} x={x(t)} y={H - 10} fontSize="10" fill="#6b6b7e" textAnchor={i === 0 ? 'start' : i === 4 ? 'end' : 'middle'}>{shortDate(new Date(t))}</text>
        ))}

        {/* strike line */}
        <line x1={M.left} y1={strikeY} x2={M.left + PLOT_W} y2={strikeY} stroke="#f5c542" strokeWidth="1.25" strokeDasharray="5 3" />
        <text x={M.left + 4} y={strikeY - 4} fontSize="10" fill="#f5c542" className="tnum font-semibold">STRIKE {usd(strike)}</text>

        {/* now marker */}
        <line x1={nowX} y1={M.top} x2={nowX} y2={M.top + PLOT_H} stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
        <text x={nowX} y={M.top - 10} fontSize="9" fill="#aaaab8" textAnchor="middle">now</text>

        {/* expiry marker */}
        {expiryX != null && (
          <>
            <line x1={expiryX} y1={M.top} x2={expiryX} y2={M.top + PLOT_H} stroke="#f5c542" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 3" />
            <text x={expiryX} y={M.top - 10} fontSize="9" fill="#f5c542" textAnchor="middle">expiry</text>
          </>
        )}

        {/* oracle trendline — glow + line */}
        {oraclePath && (
          <>
            <path d={oraclePath} fill="none" stroke="#ffffff" strokeOpacity="0.12" strokeWidth="6" strokeLinejoin="round" />
            <path d={oraclePath} fill="none" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="2" strokeLinejoin="round" />
          </>
        )}

        {/* TWAP crosshair on hover */}
        {showTwap && (
          <g>
            <line x1={x(twapPt.t)} y1={M.top} x2={x(twapPt.t)} y2={M.top + PLOT_H}
              stroke="#ffffff" strokeOpacity="0.25" strokeWidth="1" strokeDasharray="3 3" />
            <line x1={M.left} y1={y(twapPt.price)} x2={M.left + PLOT_W} y2={y(twapPt.price)}
              stroke="#ffffff" strokeOpacity="0.12" strokeWidth="1" strokeDasharray="3 3" />
            <circle cx={x(twapPt.t)} cy={y(twapPt.price)} r="4.5" fill="#fff" stroke="#000" strokeWidth="1.5" />
          </g>
        )}

        {/* current oracle marker — label above the dot */}
        {oracleNow != null && (
          <g>
            <circle cx={nowX} cy={y(oracleNow)} r="5" fill="#fff" stroke="#000" strokeWidth="1.5" />
            <text x={nowX - 7} y={y(oracleNow) - 10} fontSize="11" fill="#fff" textAnchor="end" className="tnum font-bold">{usd(oracleNow)}</text>
          </g>
        )}

        {/* sold-comp dots */}
        {series.map((p, i) => {
          const cx = x(p.t), cy = y(p.price);
          const above = p.price >= strike;
          const col = above ? '#4CAF50' : '#ef4444';
          return (
            <circle
              key={i}
              cx={cx} cy={cy}
              r={hover === i ? 5 : 3.2}
              fill={col}
              fillOpacity={p.crossGrader ? 0.35 : 0.9}
              stroke={hover === i ? '#fff' : 'none'}
              strokeWidth="1"
              style={{ cursor: p.url ? 'pointer' : 'default' }}
              onMouseEnter={() => { setHover(i); setTwapHover(null); }}
              onMouseLeave={() => setHover(null)}
              onClick={() => p.url && window.open(p.url, '_blank')}
            />
          );
        })}
      </svg>

      {/* comp hover tooltip */}
      {hover != null && series[hover] && (
        <CompTooltip p={series[hover]} model={model} strike={strike} />
      )}

      {/* TWAP hover tooltip */}
      {showTwap && (
        <TwapTooltip pt={twapPt} model={model} strike={strike} />
      )}

      {/* footer: legend + stats */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] mt-2 pt-2 px-1 border-t border-sc-border/60">
        <span className="flex items-center gap-1 text-sc-muted"><span className="inline-block w-2 h-2 rounded-full bg-sc-yes" />sold comp ({grader} {grade})</span>
        <span className="flex items-center gap-1 text-sc-muted"><span className="inline-block w-3 h-0.5 bg-white/70" />oracle TWAP</span>
        <span className="flex items-center gap-1 text-sc-muted"><span className="inline-block w-3 border-t border-dashed border-sc-accent" />strike {usd(strike)}</span>
        <span className="flex items-center gap-1 text-sc-muted"><span className="inline-block w-2 h-2 bg-sc-yes/20 border border-sc-yes/40" />YES zone</span>
        <span className="flex items-center gap-1 text-sc-muted"><span className="inline-block w-2 h-2 bg-sc-no/20 border border-sc-no/40" />NO zone</span>
        <span className="hidden sm:inline-block w-px h-3 bg-sc-border mx-0.5" />
        <span className="text-sc-muted tnum">comps <span className="text-sc-text font-semibold">{series.length}</span></span>
        <span className="text-sc-muted tnum">to expiry <span className="text-sc-text font-semibold">{timeUntil(expiryMs)}</span></span>
        {oracleNow != null && (
          <span className="text-sc-muted tnum">oracle vs strike{' '}
            <span className={`font-semibold ${oracleNow >= strike ? 'text-sc-yes' : 'text-sc-no'}`}>{oracleNow >= strike ? 'ABOVE' : 'BELOW'}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function CompTooltip({ p, model, strike }) {
  const above = p.price >= strike;
  const leftPct = (model.x(p.t) / W) * 100;
  const topPct = (model.y(p.price) / H) * 100;
  return (
    <div className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full"
      style={{ left: `${leftPct}%`, top: `calc(${topPct}% - 6px)` }}>
      <div className="bg-black border border-sc-border rounded-md px-2 py-1 text-[10px] whitespace-nowrap shadow-xl">
        <div className="font-semibold tnum text-white">{usd(p.price)} <span className={above ? 'text-sc-yes' : 'text-sc-no'}>{above ? 'YES' : 'NO'}</span></div>
        <div className="text-sc-muted">{shortDate(p.date)} · {p.platform}{p.crossGrader ? ' · cross-grade' : ''}</div>
      </div>
    </div>
  );
}

function TwapTooltip({ pt, model, strike }) {
  const above = pt.price >= strike;
  const leftPct = (model.x(pt.t) / W) * 100;
  const topPct = (model.y(pt.price) / H) * 100;
  const dist = strike > 0 ? ((pt.price - strike) / strike) * 100 : 0;
  return (
    <div className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-full"
      style={{ left: `${leftPct}%`, top: `calc(${topPct}% - 10px)` }}>
      <div className="bg-black/95 border border-white/20 rounded-md px-2.5 py-1.5 text-[10px] whitespace-nowrap shadow-xl">
        <div className="font-bold tnum text-white text-[11px]">{usd(pt.price)} <span className={above ? 'text-sc-yes' : 'text-sc-no'}>{above ? 'YES' : 'NO'}</span></div>
        <div className="text-sc-muted mt-0.5">{shortDate(new Date(pt.t))} · TWAP 30d</div>
        <div className={`text-[9px] mt-0.5 font-semibold tnum ${above ? 'text-sc-yes' : 'text-sc-no'}`}>
          {dist >= 0 ? '+' : ''}{dist.toFixed(1)}% vs strike
        </div>
      </div>
    </div>
  );
}
