/// OracleSwarmPanel — Displays multi-agent oracle swarm consensus.
/// Shows: per-source signals, weights, MAD rejections, confidence interval,
/// source reliability evolution, and Walrus evidence link.

import { useState, useEffect, useMemo } from 'react';

const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

function useSwarmData() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch('/data/swarm-consensus.json')
      .then((r) => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => setData(null));
  }, []);
  return data;
}

export default function OracleSwarmPanel({ productId }) {
  const swarm = useSwarmData();
  if (!swarm) return <EmptyState />;

  const card = swarm.consensus?.[productId];
  if (!card) return <EmptyState msg="No swarm data for this card" />;

  const reputation = swarm.reputation || {};
  const walrusBlobId = swarm.walrusBlobId;
  const ts = swarm.timestamp;

  return (
    <div className="space-y-4">
      {/* Consensus header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[9px] text-sc-muted uppercase tracking-wide font-medium">SWARM CONSENSUS</div>
          <div className="text-[20px] font-bold tnum text-white">
            {card.consensusPriceCents ? `$${(card.consensusPriceCents / 100).toLocaleString()}` : '—'}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[9px] text-sc-muted uppercase tracking-wide">Confidence Interval</div>
          <div className="text-[13px] tnum text-sc-dim">
            {card.confidenceLower && card.confidenceUpper
              ? `$${(card.confidenceLower / 100).toLocaleString()} – $${(card.confidenceUpper / 100).toLocaleString()}`
              : '—'}
          </div>
        </div>
      </div>

      {/* Flags */}
      {card.flags?.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {card.flags.map((f) => (
            <span key={f} className={`text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
              f === 'wide_disagreement' ? 'bg-sc-no/20 text-sc-no border border-sc-no/30' :
              f === 'insufficient_sources' ? 'bg-sc-amber/20 text-sc-amber border border-sc-amber/30' :
              'bg-sc-surface text-sc-muted border border-sc-border'
            }`}>{f.replace(/_/g, ' ')}</span>
          ))}
        </div>
      )}

      {/* Source signals table */}
      <div className="bg-sc-surface/50 rounded-lg overflow-hidden border border-sc-border/60">
        <div className="px-3 py-2 border-b border-sc-border/60 flex items-center justify-between">
          <span className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide">
            Contributing Sources ({card.sourceCount || 0})
          </span>
          <span className="text-[9px] text-sc-muted">{card.contributingSources?.length || 0} active</span>
        </div>
        <div className="divide-y divide-sc-border/40">
          {(card.contributingSources || []).sort((a, b) => b.weight - a.weight).map((src) => (
            <SourceRow key={src.platform} src={src} consensus={card.consensusPriceCents} reputation={reputation} />
          ))}
        </div>
      </div>

      {/* Rejected sources */}
      {card.rejectedSources?.length > 0 && (
        <div className="bg-sc-no/5 rounded-lg overflow-hidden border border-sc-no/20">
          <div className="px-3 py-2 border-b border-sc-no/20">
            <span className="text-[10px] font-semibold text-sc-no uppercase tracking-wide">
              Rejected ({card.rejectedSources.length})
            </span>
          </div>
          <div className="divide-y divide-sc-no/10">
            {card.rejectedSources.map((rej, i) => (
              <div key={i} className="px-3 py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PlatformIcon platform={rej.platform} />
                  <span className="text-[12px] font-medium text-sc-no/80">{rej.platform}</span>
                </div>
                <div className="text-right">
                  <div className="text-[11px] tnum text-sc-no/60 line-through">${(rej.priceCents / 100).toLocaleString()}</div>
                  <div className="text-[9px] text-sc-no/50">{rej.reason}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Source reliability bars */}
      <ReliabilityChart reputation={reputation} />

      {/* Evidence footer */}
      <div className="flex items-center justify-between text-[10px] text-sc-muted pt-2 border-t border-sc-border/40">
        <span>Updated {ts ? new Date(ts).toLocaleTimeString() : '—'}</span>
        <div className="flex items-center gap-3">
          <span className="text-sc-dim">
            {card.contributingSources?.length || 0} sources · MAD z=3.5 · weighted median
          </span>
          {walrusBlobId && (
            <a href={`${AGGREGATOR}/v1/blobs/${walrusBlobId}`} target="_blank" rel="noopener noreferrer"
              className="text-sc-accent hover:underline flex items-center gap-1">
              <WalrusIcon /> Evidence
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function SourceRow({ src, consensus, reputation }) {
  const rep = reputation[src.platform];
  const deviation = consensus > 0
    ? ((src.priceCents - consensus) / consensus * 100).toFixed(1)
    : null;
  const devColor = deviation !== null
    ? (Math.abs(parseFloat(deviation)) < 5 ? 'text-sc-yes' : Math.abs(parseFloat(deviation)) < 15 ? 'text-sc-amber' : 'text-sc-no')
    : 'text-sc-muted';

  return (
    <div className="px-3 py-2 flex items-center gap-3">
      <PlatformIcon platform={src.platform} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-white">{src.platform}</span>
          {src.compCount > 0 && <span className="text-[9px] text-sc-muted">{src.compCount} comps</span>}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <WeightBar weight={src.weight} maxWeight={1.5} />
          <span className="text-[9px] text-sc-muted shrink-0">w={src.weight?.toFixed(2)}</span>
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-[13px] font-bold tnum text-white">${(src.priceCents / 100).toLocaleString()}</div>
        {deviation !== null && (
          <div className={`text-[10px] tnum ${devColor}`}>
            {parseFloat(deviation) >= 0 ? '+' : ''}{deviation}%
          </div>
        )}
      </div>
    </div>
  );
}

function WeightBar({ weight, maxWeight }) {
  const pct = Math.min(100, (weight / maxWeight) * 100);
  return (
    <div className="flex-1 h-1 rounded-full bg-sc-surface overflow-hidden">
      <div className="h-full rounded-full bg-sc-accent/60 transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

function ReliabilityChart({ reputation }) {
  const sorted = useMemo(() =>
    Object.entries(reputation)
      .map(([name, r]) => ({ name, ...r }))
      .sort((a, b) => b.reliability - a.reliability),
    [reputation],
  );

  if (sorted.length === 0) return null;

  return (
    <div className="bg-sc-surface/50 rounded-lg border border-sc-border/60 p-3">
      <div className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide mb-2">Source Reliability</div>
      <div className="space-y-1.5">
        {sorted.map((s) => (
          <div key={s.name} className="flex items-center gap-2">
            <span className="text-[10px] text-sc-muted w-24 shrink-0 truncate">{s.name}</span>
            <div className="flex-1 h-2 rounded-full bg-sc-bg overflow-hidden">
              <div className={`h-full rounded-full transition-all ${
                s.reliability > 0.8 ? 'bg-sc-yes/70' : s.reliability > 0.6 ? 'bg-sc-amber/70' : 'bg-sc-no/70'
              }`} style={{ width: `${s.reliability * 100}%` }} />
            </div>
            <span className="text-[10px] tnum text-sc-dim w-10 text-right shrink-0">
              {(s.reliability * 100).toFixed(0)}%
            </span>
            <span className="text-[9px] text-sc-muted w-12 text-right shrink-0">
              {s.hits}/{s.rounds}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlatformIcon({ platform }) {
  const colors = {
    ebay: 'bg-blue-500/20 text-blue-400',
    courtyard: 'bg-purple-500/20 text-purple-400',
    tcgplayer: 'bg-orange-500/20 text-orange-400',
    alt: 'bg-teal-500/20 text-teal-400',
    cardmarket: 'bg-yellow-500/20 text-yellow-400',
    beezie: 'bg-green-500/20 text-green-400',
    'collector-crypt': 'bg-pink-500/20 text-pink-400',
    goldin: 'bg-amber-500/20 text-amber-400',
    pricecharting: 'bg-cyan-500/20 text-cyan-400',
  };
  const cls = colors[platform] || 'bg-sc-surface text-sc-muted';
  return (
    <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[9px] font-bold ${cls}`}>
      {platform.slice(0, 2).toUpperCase()}
    </div>
  );
}

function WalrusIcon() {
  return (
    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({ msg = 'Oracle swarm not yet initialized' }) {
  return (
    <div className="text-center py-8">
      <div className="text-[11px] text-sc-muted">{msg}</div>
      <div className="text-[10px] text-sc-dim mt-1">Run <code className="font-mono text-sc-accent">node swarm.mjs</code> to generate consensus</div>
    </div>
  );
}
