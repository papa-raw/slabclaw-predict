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

import marketSignals from '../data/market-signals.json';
import { DEMO_MARKETS, EXPLORER_URL } from '../constants';
import { useLiveConsensus } from '../hooks/useLiveConsensus';
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
  const { data: consensusData, source: consensusSource } = useLiveConsensus();
  const card = consensusData?.consensus?.[productId];
  const isSeed = consensusData?._seed === true;
  const signals = marketSignals?.cards?.[productId] || null;

  if (!card) return <EmptyState isSeed={isSeed} />;

  // Realized sales SETTLE the market; asks (live listings) only bound the range. Split
  // them so the table can't imply a $16k ask "counts" when it carries zero weight.
  const allSources = [...(card.contributingSources || [])];
  const realizedSources = allSources.filter((s) => s.kind !== 'ask').sort((a, b) => (b.weight || 0) - (a.weight || 0));
  const askSources = allSources.filter((s) => s.kind === 'ask').sort((a, b) => (a.priceCents || 0) - (b.priceCents || 0));
  const maxWeight = realizedSources.reduce((m, s) => Math.max(m, s.weight || 0), 0) || 1;
  // Two very different kinds of rejection: a MAD outlier is a genuine MANIPULATION catch
  // (worth showing off); an off-anchor / off-grade exclusion is just a wrong-grade scrape we
  // quietly dropped. Lumping them under one red "manipulation-resistant" box reads as broken.
  const allRejected = card.rejectedSources || [];
  const manipRejected = allRejected.filter((r) => /MAD/i.test(r.reason || ''));
  const dataExcluded = allRejected.filter((r) => !/MAD/i.test(r.reason || ''));
  const flags = card.flags || [];
  const agree = card.sourceCount ?? realizedSources.length;

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
          How this price is set
        </span>
        <div className="flex items-center gap-2">
          {isSeed && (
            <span className="text-[8px] font-bold uppercase tracking-wide text-sc-amber border border-sc-amber/40 rounded px-1 py-px">seed</span>
          )}
          <FreshnessChip source={consensusSource} timestamp={consensusData?.timestamp} />
          <span className="text-[10px] tnum text-sc-muted">
            <span className="text-sc-text font-semibold">{agree}</span> independent {agree === 1 ? 'source' : 'sources'}
            {manipRejected.length > 0 && <span className="text-sc-no/70"> · {manipRejected.length} manipulated cut</span>}
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

        {/* quality flags — grade inversions + multiplier divergence (manipulation signals) */}
        {signals?.flags?.length > 0 && <QualityFlags signals={signals} />}

        {/* sold prices — these SETTLE the market; "vs agreed" is trust at a glance */}
        <div className="bg-sc-surface/40 rounded-lg overflow-hidden border border-sc-border/60">
          <div className="px-3 py-1.5 border-b border-sc-border/60 flex items-center justify-between">
            <span className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide">Sold prices · these settle the market</span>
            <span className="text-[9px] text-sc-muted">{agree} independent source{agree === 1 ? '' : 's'} · weighted median</span>
          </div>
          <table className="w-full text-[12px] tnum">
            <thead>
              <tr className="text-[9px] text-sc-muted uppercase tracking-wide border-b border-sc-border/60">
                <th className="text-left font-medium px-3 py-1.5">Marketplace</th>
                <th className="text-right font-medium px-2 py-1.5">Sold for</th>
                <th className="text-right font-medium px-2 py-1.5" title="How far this source sits from the agreed price">vs&nbsp;agreed</th>
                <th className="text-left font-medium px-3 py-1.5 w-[26%]" title="How much this source counts toward the final price">Influence</th>
              </tr>
            </thead>
            <tbody>
              {realizedSources.length === 0 ? (
                <tr><td colSpan={4} className="px-3 py-3 text-center text-sc-muted">No realized sales yet — only asking prices below.</td></tr>
              ) : realizedSources.map((s) => <SourceRow key={s.platform} s={s} maxWeight={maxWeight} consensus={card.consensusPriceCents} />)}
            </tbody>
          </table>
        </div>

        {/* asking prices — listings that BOUND the range but never settle */}
        {askSources.length > 0 && (
          <div className="bg-sc-surface/20 rounded-lg overflow-hidden border border-sc-border/40">
            <div className="px-3 py-1.5 border-b border-sc-border/40 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide">Current listings · asking only</span>
              <span className="text-[9px] text-sc-muted">{askSources.length} live · don’t settle the market</span>
            </div>
            <table className="w-full text-[12px] tnum">
              <thead>
                <tr className="text-[9px] text-sc-muted uppercase tracking-wide border-b border-sc-border/40">
                  <th className="text-left font-medium px-3 py-1.5">Marketplace</th>
                  <th className="text-right font-medium px-2 py-1.5">Asking</th>
                  <th className="text-right font-medium px-3 py-1.5" title="How far this listing sits from the agreed price">vs&nbsp;agreed</th>
                </tr>
              </thead>
              <tbody>
                {askSources.map((s) => <AskRow key={s.platform} s={s} consensus={card.consensusPriceCents} />)}
              </tbody>
            </table>
            <div className="px-3 py-1.5 text-[9px] text-sc-muted leading-relaxed border-t border-sc-border/40">
              Asking prices sit above what cards actually sell for, so they bound the range but never set the settle price.
            </div>
          </div>
        )}

        {/* manipulation rejections — the genuine "we caught a wash trade" catch, shown off */}
        {manipRejected.length > 0 && (
          <div className="bg-sc-no/5 rounded-lg overflow-hidden border border-sc-no/20">
            <div className="px-3 py-1.5 border-b border-sc-no/20 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-sc-no uppercase tracking-wide">Manipulation rejected ({manipRejected.length})</span>
              <span className="text-[9px] text-sc-no/60">MAD filter</span>
            </div>
            <div className="divide-y divide-sc-no/10">
              {manipRejected.map((r, i) => (
                <div key={i} className="px-3 py-1.5 flex items-center justify-between">
                  <PlatformTag platform={r.platform} muted />
                  <div className="flex items-center gap-3">
                    <span className="text-[12px] tnum text-sc-no/70 line-through">{cents(r.priceCents)}</span>
                    <span className="text-[10px] text-sc-no/80 font-medium">{r.reason}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* off-grade data quietly excluded — a calm note, not a scary red box */}
        {dataExcluded.length > 0 && (
          <p className="text-[10px] text-sc-muted leading-relaxed">
            {dataExcluded.length} {dataExcluded.length === 1 ? 'source was' : 'sources were'} excluded as off-grade —
            their price sat too far from the grade-matched sales to be the same PSA&nbsp;10 card (a wrong-grade or
            wrong-variant listing). Only clean, grade-matched sales set the price.
          </p>
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

// Manipulation / oracle-quality flags: grade inversions, multiplier divergence,
// intra-grade spread. Below-grade slabs asking over the settled 10 → widen dispute.
function QualityFlags({ signals }) {
  const flags = signals.flags || [];
  return (
    <div className={`rounded-lg border px-3 py-2 ${signals.wideDispute ? 'border-sc-no/30 bg-sc-no/5' : 'border-sc-amber/30 bg-sc-amber/5'}`}>
      <div className="flex items-center justify-between mb-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wide ${signals.wideDispute ? 'text-sc-no' : 'text-sc-amber'}`}>
          ⚠ Sanity checks
        </span>
        <span className="text-[9px] text-sc-muted">
          confidence {Math.round((signals.confidence ?? 1) * 100)}%{signals.wideDispute ? ' · dispute window widened' : ''}
        </span>
      </div>
      <ul className="space-y-1">
        {flags.slice(0, 5).map((f, i) => (
          <li key={i} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-sc-dim">
            <span className={`mt-px shrink-0 ${f.severity === 'high' ? 'text-sc-no' : 'text-sc-amber'}`}>•</span>
            <span>{f.message}</span>
          </li>
        ))}
      </ul>
      {flags.length > 5 && <div className="text-[9px] text-sc-muted mt-1">+{flags.length - 5} more</div>}
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

// Asking-price row — no influence bar (asks carry zero settlement weight by design).
function AskRow({ s, consensus }) {
  const dev = consensus > 0 && s.priceCents != null ? ((s.priceCents - consensus) / consensus) * 100 : null;
  return (
    <tr className="border-t border-sc-border/30 first:border-t-0 hover:bg-white/[0.02]">
      <td className="px-3 py-1.5 align-top">
        <PlatformTag platform={s.platform} muted />
        <div className="text-[9px] text-sc-muted mt-0.5">live listing</div>
      </td>
      <td className="text-right px-2 py-1.5 font-medium text-sc-dim align-top">{cents(s.priceCents)}</td>
      <td className="text-right px-3 py-1.5 align-top text-sc-muted" title="difference from the agreed price">
        {dev == null ? '—' : `${dev >= 0 ? '+' : ''}${dev.toFixed(0)}%`}
      </td>
    </tr>
  );
}

// Translate a coordinator flag into a plain-language note for bettors.
function FlagNote({ flag, agree }) {
  const map = {
    insufficient_sources: { tone: 'amber', text: `Only ${agree} independent marketplace${agree === 1 ? '' : 's'} had recent sales, and they don't yet agree closely enough to settle on. More sold comps needed first.` },
    thin_market: { tone: 'amber', text: `This is a genuinely rare card — only ${agree} independent marketplaces have recent sales, but they agree, so the oracle settles on them. The thinness is recorded in the evidence and the challenge window is extended so anyone can contest before it finalizes.` },
    wide_disagreement: { tone: 'no', text: 'The marketplaces disagree by a lot right now. The oracle won’t settle on a shaky number — treat this price with caution.' },
    all_outliers: { tone: 'no', text: 'Every source looked manipulated and was rejected — no trustworthy price yet.' },
    asks_above_consensus: { tone: 'amber', text: 'Cards are currently listed well above the last sold prices — the market may be moving up. The settle price tracks actual sales, not asks.' },
    consensus_above_lowest_ask: { tone: 'amber', text: 'Someone is listing this below the agreed price right now. Could be a deal — or a stale listing. The settle price tracks completed sales.' },
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

// Honest data-provenance chip: green "live · 2h" when the production feed answered,
// neutral "snapshot · date" when rendering the build-time data. Never fakes liveness.
function FreshnessChip({ source, timestamp }) {
  if (!timestamp) return null;
  const ageMs = Date.now() - timestamp;
  const age = ageMs < 3_600_000 ? `${Math.max(1, Math.round(ageMs / 60_000))}m`
    : ageMs < 86_400_000 ? `${Math.round(ageMs / 3_600_000)}h`
    : `${Math.round(ageMs / 86_400_000)}d`;
  const live = source === 'live';
  return (
    <span
      className={`text-[8px] font-bold uppercase tracking-wide rounded px-1 py-px border ${
        live ? 'text-sc-yes border-sc-yes/40' : 'text-sc-muted border-sc-border'
      }`}
      title={live ? 'Served by the production oracle feed' : 'Build-time snapshot — production feed unreachable'}
    >
      {live ? 'live' : 'snapshot'} · {age}
    </span>
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
        How this price is set
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
