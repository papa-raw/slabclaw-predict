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
  const [coneHover, setConeHover] = useState(false); // hovering the forecast cone
  const svgRef = useRef(null);

  const model = useMemo(() => {
    const all = [...series, ...oracleLine];
    if (!all.length && oracleNow == null) return null;

    const now = Date.now();
    const ts = all.map((p) => p.t);
    // Start the axis where the data actually begins (= where the oracle line
    // starts). `startMs` is applied upstream as a filter that trims early comps;
    // it is NOT a hard axis floor, so there's no dead space before the first point.
    let tMin = ts.length ? Math.min(...ts) : now - 90 * DAY;
    let tMax = Math.max(expiryMs || now, ts.length ? Math.max(...ts) : now, now);
    tMin -= (tMax - tMin) * 0.02; // small left breathing room

    // ── 99% forecast cone — where the oracle may land by expiry ──
    // Zero-drift geometric Brownian motion using realized daily volatility of
    // the sold comps. Fans out from (now, oracleNow) to expiry.
    let cone = null;
    if (oracleNow != null && expiryMs && expiryMs > now) {
      const sorted = [...series].filter((p) => p.price > 0).sort((a, b) => a.t - b.t);
      let v = 0, n = 0;
      for (let i = 1; i < sorted.length; i++) {
        const dtd = (sorted[i].t - sorted[i - 1].t) / DAY;
        if (dtd <= 0) continue;
        const r = Math.log(sorted[i].price / sorted[i - 1].price);
        v += (r * r) / dtd; n += 1;
      }
      if (n >= 2) {
        const sigmaD = Math.min(Math.sqrt(v / n), 0.035); // per-day vol, capped
        const Z = 1.96; // 95% two-sided
        const STEPS = 24;
        const upper = [], lower = [];
        for (let k = 0; k <= STEPS; k++) {
          const t = now + (expiryMs - now) * (k / STEPS);
          const hw = Math.min(Z * sigmaD * Math.sqrt(Math.max(0, (t - now) / DAY)), Math.log(2));
          upper.push({ t, price: oracleNow * Math.exp(hw) });
          lower.push({ t, price: oracleNow * Math.exp(-hw) });
        }
        cone = { upper, lower, hi: upper[upper.length - 1].price, lo: lower[lower.length - 1].price };
      }
    }

    const prices = [
      ...all.map((p) => p.price),
      strike,
      oracleNow,
      cone?.hi,
      cone?.lo,
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

    let conePaths = null;
    if (cone) {
      const up = cone.upper.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
      const lo = cone.lower.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ');
      const area = up + ' ' + [...cone.lower].reverse().map((p) => `L${x(p.t).toFixed(1)},${y(p.price).toFixed(1)}`).join(' ') + ' Z';
      conePaths = { up, lo, area, hi: cone.hi, loVal: cone.lo, hiY: y(cone.hi), loY: y(cone.lo) };
    }

    return { x, y, tFromX, tMin, tMax, pMin, pMax, priceTicks, timeTicks, oraclePath, conePaths, now };
  }, [series, oracleLine, oracleNow, strike, expiryMs, startMs]);

  // Find nearest TWAP point by mouse x position
  const handleMouseMove = useCallback((e) => {
    if (!model || !oracleLine.length || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const svgX = ((e.clientX - rect.left) / rect.width) * W;
    if (svgX < M.left || svgX > M.left + PLOT_W) { setTwapHover(null); return; }
    // forecast region (right of now) → no TWAP crosshair; cone handles its own hover
    const nowX = model.x(model.now);
    if (svgX > nowX) { setTwapHover(null); return; }

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

  const clearHovers = useCallback(() => { setHover(null); setTwapHover(null); setConeHover(false); }, []);

  if (!model) {
    return (
      <div className="h-[260px] grid place-items-center text-sm text-sc-muted bg-sc-card border border-sc-border rounded-xl">
        No sold comps available for {grader} {grade} yet
      </div>
    );
  }

  const { x, y, priceTicks, timeTicks, oraclePath, conePaths, now } = model;
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

        {/* 99% forecast cone — shape always shown; labels reveal on hover */}
        {conePaths && (
          <g>
            <path d={conePaths.area} fill="#ffffff" fillOpacity={coneHover ? 0.1 : 0.06} stroke="none"
              style={{ cursor: 'help' }}
              onMouseEnter={() => { setConeHover(true); setTwapHover(null); }}
              onMouseLeave={() => setConeHover(false)} />
            <path d={conePaths.up} fill="none" stroke="#ffffff" strokeOpacity={coneHover ? 0.5 : 0.28} strokeWidth="1" strokeDasharray="3 3" className="pointer-events-none" />
            <path d={conePaths.lo} fill="none" stroke="#ffffff" strokeOpacity={coneHover ? 0.5 : 0.28} strokeWidth="1" strokeDasharray="3 3" className="pointer-events-none" />
          </g>
        )}

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

      {/* cone hover — a floating comment, not a chart element */}
      {coneHover && conePaths && expiryX != null && (
        <ConeTooltip
          hi={conePaths.hi}
          lo={conePaths.loVal}
          leftPct={((nowX + expiryX) / 2 / W) * 100}
          topPct={((oracleNow != null ? y(oracleNow) : (conePaths.hiY + conePaths.loY) / 2) / H) * 100}
          days={timeUntil(expiryMs)}
        />
      )}

      {/* footer — one cohesive key: legend cluster (left) + stats cluster (right) */}
      <div className="mt-3 rounded-lg border border-sc-border/60 bg-sc-surface/30 px-3 py-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[10px]">
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-sc-muted">
          <span className="flex items-center gap-1.5"><span className="inline-block w-2 h-2 rounded-full bg-sc-yes" />sold comp · {grader} {grade}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-[2px] rounded bg-white/75" />oracle TWAP</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 border-t border-dashed border-sc-accent" />strike {usd(strike)}</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-3.5 h-2.5 rounded-sm bg-white/[0.08] border border-dashed border-white/30" />95% cone</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sc-yes/20 border border-sc-yes/40" />YES</span>
          <span className="flex items-center gap-1.5"><span className="inline-block w-2.5 h-2.5 rounded-sm bg-sc-no/20 border border-sc-no/40" />NO</span>
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 ml-auto tnum">
          <span className="text-sc-muted">comps <span className="text-sc-text font-semibold">{series.length}</span></span>
          <span className="text-sc-muted">to expiry <span className="text-sc-text font-semibold">{timeUntil(expiryMs)}</span></span>
          {oracleNow != null && (
            <span className="text-sc-muted">vs strike{' '}
              <span className={`font-semibold ${oracleNow >= strike ? 'text-sc-yes' : 'text-sc-no'}`}>{oracleNow >= strike ? 'ABOVE' : 'BELOW'}</span>
            </span>
          )}
        </div>
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

function ConeTooltip({ hi, lo, leftPct, topPct, days }) {
  return (
    <div className="absolute pointer-events-none z-10 -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${leftPct}%`, top: `${topPct}%` }}>
      <div className="bg-black/90 border border-white/15 rounded-lg px-4 py-3 text-[11px] leading-relaxed shadow-2xl w-[300px]">
        <div className="font-semibold text-white text-[12px]">95% confidence interval</div>
        <div className="text-sc-muted mt-1">
          In {days}, the oracle is <span className="text-sc-text">95%</span> likely to land between{' '}
          <span className="text-sc-text tnum">{usd(lo)}</span> and <span className="text-sc-text tnum">{usd(hi)}</span>.
        </div>
        <div className="text-[10px] text-sc-muted/70 mt-1.5">from realized comp volatility</div>
      </div>
    </div>
  );
}
