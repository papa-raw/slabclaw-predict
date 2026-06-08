/// OracleConsensusPanel — makes the agent oracle swarm legible and verifiable.
///
/// Reads frontend/src/data/oracle-consensus.json (imported at build time so the
/// dapp renders WITHOUT a backend). For a market's productId it renders:
///   • consensus price + 25–75% confidence band + "X of N sources agree"
///   • per-source breakdown (price, confidence, reliability, contribution weight bar), sorted by weight desc
///   • rejected outliers (struck-through, loss color) — visible manipulation resistance
///   • flags as chips
///   • a prominent "Verify evidence on Walrus" button (opens the aggregator blob in a new tab)
///
/// Seed data (consensusData._seed === true) renders before the live swarm runs.

import consensusData from '../data/oracle-consensus.json';
import { DEMO_MARKETS, EXPLORER_URL } from '../constants';
import { usdFull } from '../lib/format';

const AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const WALRUSCAN = 'https://walruscan.com/testnet/blob'; // human-readable Walrus blob explorer

// price helpers — consensus prices are integer cents
const cents = (c) => (c == null ? '—' : usdFull(c / 100));

const PLAT_COLOR = {
  ebay: '#e8a838', tcgplayer: '#7c8cf8', cardmarket: '#f5c542', fanatics: '#e879f9',
  alt: '#60a5fa', courtyard: '#38b2ac', beezie: '#e8a838', goldin: '#f59e0b',
  heritage: '#9ca3af', 'collector-crypt': '#ec4899', pricecharting: '#22d3ee',
};

export default function OracleConsensusPanel({ productId }) {
  const card = consensusData?.consensus?.[productId];
  const isSeed = consensusData?._seed === true;

  if (!card) return <EmptyState isSeed={isSeed} />;

  const sources = [...(card.contributingSources || [])].sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const maxWeight = sources.reduce((m, s) => Math.max(m, s.weight || 0), 0) || 1;
  const rejected = card.rejectedSources || [];
  const flags = card.flags || [];
  const agree = card.sourceCount ?? sources.length;
  const total = agree + rejected.length;

  const blobId = card.evidence?.blobId || null;
  const aggregatorUrl = card.evidence?.aggregatorUrl || (blobId ? `${AGGREGATOR}/v1/blobs/${blobId}` : null);
  const walruscanUrl = blobId ? `${WALRUSCAN}/${blobId}` : null;
  const marketId = DEMO_MARKETS.find((m) => m.productId === productId)?.id || null;
  const marketOnchainUrl = marketId ? `${EXPLORER_URL}/object/${marketId}` : null;

  return (
    <div className="bg-sc-card border border-sc-border rounded-xl overflow-hidden">
      {/* header */}
      <div className="px-3 py-2 border-b border-sc-border flex items-center justify-between">
        <span className="flex items-center gap-2 text-[11px] font-semibold text-sc-dim uppercase tracking-wide">
          <span className="w-1.5 h-1.5 rounded-full bg-sc-yes animate-pulse" />
          Oracle swarm consensus
        </span>
        <div className="flex items-center gap-2">
          {isSeed && (
            <span className="text-[8px] font-bold uppercase tracking-wide text-sc-amber border border-sc-amber/40 rounded px-1 py-px">seed</span>
          )}
          <span className="text-[10px] tnum text-sc-muted">
            <span className="text-sc-text font-semibold">{agree}</span> of {total} sources agree
          </span>
        </div>
      </div>

      <div className="p-3 space-y-3">
        {/* priming — what this is, in one human sentence */}
        <p className="text-[11px] leading-relaxed text-sc-dim">
          We poll real card marketplaces, throw out prices that look manipulated, and settle
          this market against the price they agree on — so no single seller can move it.
        </p>

        {/* the number that matters, in plain words */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="text-[9px] text-sc-muted uppercase tracking-wide font-medium">Settles at</div>
            <div className="text-[24px] font-bold tnum text-white leading-tight">{cents(card.consensusPriceCents)}</div>
            <div className="text-[10px] text-sc-muted">the price your YES/NO is judged against</div>
          </div>
          <div className="text-right">
            <div className="text-[9px] text-sc-muted uppercase tracking-wide">Typical range</div>
            <div className="text-[13px] tnum text-sc-dim">
              {card.confidenceLower != null && card.confidenceUpper != null
                ? `${cents(card.confidenceLower)} – ${cents(card.confidenceUpper)}`
                : '—'}
            </div>
            <div className="text-[10px] text-sc-muted">where most sales land</div>
          </div>
        </div>

        {/* confidence band bar — consensus dot within lower→upper range */}
        {card.confidenceLower != null && card.confidenceUpper != null && card.confidenceUpper > card.confidenceLower && (
          <ConfidenceBand lower={card.confidenceLower} upper={card.confidenceUpper} mid={card.consensusPriceCents} />
        )}

        {/* plain-language status notes (was jargon flag chips) */}
        {flags.length > 0 && (
          <div className="space-y-1.5">
            {flags.map((f) => <FlagNote key={f} flag={f} agree={agree} />)}
          </div>
        )}

        {/* who priced it — plain columns; "vs agreed" is trust at a glance */}
        <div className="bg-sc-surface/40 rounded-lg overflow-hidden border border-sc-border/60">
          <div className="px-3 py-1.5 border-b border-sc-border/60 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide">Who priced it</span>
            <span className="text-[9px] text-sc-muted">{agree} marketplace{agree === 1 ? '' : 's'} · weighted median</span>
          </div>
          <table className="w-full text-[12px] tnum">
            <thead>
              <tr className="text-[9px] text-sc-muted uppercase tracking-wide border-b border-sc-border/60">
                <th className="text-left font-medium px-3 py-1.5">Marketplace</th>
                <th className="text-right font-medium px-2 py-1.5">Their price</th>
                <th className="text-right font-medium px-2 py-1.5" title="How far this source sits from the agreed price">vs&nbsp;agreed</th>
                <th className="text-left font-medium px-3 py-1.5 w-[26%]" title="How much this source counts toward the final price">Influence</th>
              </tr>
            </thead>
            <tbody>
              {sources.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-3 text-center text-sc-muted">No contributing sources</td></tr>
              ) : sources.map((s) => <SourceRow key={s.platform} s={s} maxWeight={maxWeight} consensus={card.consensusPriceCents} />)}
            </tbody>
          </table>
        </div>

        {/* rejected outliers — manipulation resistance, visible */}
        {rejected.length > 0 && (
          <div className="bg-sc-no/5 rounded-lg overflow-hidden border border-sc-no/20">
            <div className="px-3 py-1.5 border-b border-sc-no/20 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-sc-no uppercase tracking-wide">Rejected outliers ({rejected.length})</span>
              <span className="text-[9px] text-sc-no/60">MAD filter · manipulation-resistant</span>
            </div>
            <div className="divide-y divide-sc-no/10">
              {rejected.map((r, i) => (
                <div key={i} className="px-3 py-1.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <PlatformTag platform={r.platform} muted />
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] tnum text-sc-no/70 line-through">{cents(r.priceCents)}</span>
                    <span className="text-[10px] text-sc-no/80 font-medium">{r.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* proof — primed: you don't have to trust us */}
        <div className="pt-2 border-t border-sc-border/40 space-y-1.5">
          <div className="text-[10px] text-sc-muted leading-relaxed">
            <span className="font-semibold text-sc-dim">Don’t trust us — check it.</span> Every settlement
            publishes its full evidence onchain, so anyone can re-run the math themselves.
          </div>
          {walruscanUrl ? (
            <a href={walruscanUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sc-accent text-black font-semibold text-[13px] hover:opacity-90 transition">
              <WalrusIcon /> Verify evidence on Walrus
              <span className="text-[11px]">↗</span>
            </a>
          ) : (
            <div className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg bg-sc-surface border border-dashed border-sc-border text-sc-muted text-[12px]">
              <WalrusIcon /> Evidence pending — blob not yet stored onchain
            </div>
          )}
          {blobId && (
            <div className="grid grid-cols-2 gap-1.5">
              <a href={aggregatorUrl} target="_blank" rel="noopener noreferrer"
                className="text-center py-1.5 rounded-md bg-sc-surface border border-sc-border text-[10px] text-sc-dim hover:text-sc-text hover:border-sc-dim transition">
                raw JSON ↗
              </a>
              {marketOnchainUrl && (
                <a href={marketOnchainUrl} target="_blank" rel="noopener noreferrer"
                  className="text-center py-1.5 rounded-md bg-sc-surface border border-sc-border text-[10px] text-sc-dim hover:text-sc-text hover:border-sc-dim transition">
                  market onchain ↗
                </a>
              )}
            </div>
          )}
          {blobId && (
            <div className="text-center text-[9px] text-sc-muted font-mono truncate">evidence ID {blobId}</div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConfidenceBand({ lower, upper, mid }) {
  const span = upper - lower;
  const pos = mid != null ? Math.min(100, Math.max(0, ((mid - lower) / span) * 100)) : 50;
  return (
    <div className="relative h-1.5 rounded-full bg-sc-surface overflow-visible">
      <div className="absolute inset-0 rounded-full bg-gradient-to-r from-sc-no/30 via-sc-accent/40 to-sc-yes/30" />
      <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-white ring-2 ring-black"
        style={{ left: `${pos}%` }} title="consensus" />
    </div>
  );
}

function SourceRow({ s, maxWeight, consensus }) {
  const barPct = Math.min(100, ((s.weight || 0) / maxWeight) * 100);
  const rel = s.reliability != null ? `${Math.round(s.reliability * 100)}% reliable` : null;
  const dev = consensus > 0 && s.priceCents != null ? ((s.priceCents - consensus) / consensus) * 100 : null;
  const devColor = dev == null ? 'text-sc-muted'
    : Math.abs(dev) < 5 ? 'text-sc-yes' : Math.abs(dev) < 15 ? 'text-sc-amber' : 'text-sc-no';
  const meta = [rel, s.compCount > 0 ? `${s.compCount} sale${s.compCount === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ');
  return (
    <tr className="border-t border-sc-border/40 first:border-t-0 hover:bg-white/[0.02]">
      <td className="px-3 py-1.5 align-top">
        <PlatformTag platform={s.platform} />
        <div className="text-[9px] text-sc-muted mt-0.5">{meta || '—'}</div>
      </td>
      <td className="text-right px-2 py-1.5 font-semibold text-white align-top">{cents(s.priceCents)}</td>
      <td className={`text-right px-2 py-1.5 align-top font-medium ${devColor}`} title="difference from the agreed price">
        {dev == null ? '—' : `${dev >= 0 ? '+' : ''}${dev.toFixed(0)}%`}
      </td>
      <td className="px-3 py-1.5 align-top">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 rounded-full bg-sc-surface overflow-hidden">
            <div className="h-full rounded-full bg-sc-accent/70" style={{ width: `${barPct}%` }} />
          </div>
          <span className="text-[9px] text-sc-muted shrink-0 w-7 text-right">{Math.round(barPct)}%</span>
        </div>
      </td>
    </tr>
  );
}

// Translate a coordinator flag into a plain-language note for bettors.
function FlagNote({ flag, agree }) {
  const map = {
    insufficient_sources: { tone: 'amber', text: `Only ${agree} marketplace${agree === 1 ? '' : 's'} had recent sales. A market needs at least 3 independent sources before it can settle — more comps needed first.` },
    wide_disagreement: { tone: 'no', text: 'The marketplaces disagree by a lot right now. The oracle won’t settle on a shaky number — treat this price with caution.' },
    all_outliers: { tone: 'no', text: 'Every source looked manipulated and was rejected — no trustworthy price yet.' },
  };
  const m = map[flag] || { tone: 'muted', text: flag.replace(/_/g, ' ') };
  const cls = m.tone === 'no' ? 'border-sc-no/30 bg-sc-no/5 text-sc-no'
    : m.tone === 'amber' ? 'border-sc-amber/30 bg-sc-amber/5 text-sc-amber'
    : 'border-sc-border bg-sc-surface text-sc-muted';
  return (
    <div className={`flex items-start gap-2 text-[11px] leading-relaxed rounded-lg border px-2.5 py-1.5 ${cls}`}>
      <span className="mt-px shrink-0">⚠</span><span>{m.text}</span>
    </div>
  );
}

function PlatformTag({ platform, muted }) {
  const color = PLAT_COLOR[platform] || '#9ca3af';
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide ${muted ? 'opacity-70' : ''}`} style={{ color }}>
      {platform}
    </span>
  );
}

function WalrusIcon() {
  return (
    <svg className="w-3.5 h-3.5" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5 8h6M8 5v6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function EmptyState({ isSeed }) {
  return (
    <div className="bg-sc-card border border-sc-border rounded-xl p-6 text-center">
      <div className="flex items-center justify-center gap-2 text-[11px] font-semibold text-sc-dim uppercase tracking-wide mb-2">
        <span className="w-1.5 h-1.5 rounded-full bg-sc-muted" />
        Oracle swarm consensus
      </div>
      <div className="text-[12px] text-sc-muted">No swarm consensus for this market yet.</div>
      <div className="text-[10px] text-sc-dim mt-1">
        {isSeed
          ? 'Seed data covers the demo markets — run the swarm to populate live rounds.'
          : <>Run <code className="font-mono text-sc-accent">node bridge-swarm.mjs</code> to generate consensus + evidence.</>}
      </div>
    </div>
  );
}
