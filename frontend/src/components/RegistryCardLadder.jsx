/// RegistryCardLadder — live listings for the EXACT product the market is on
/// (one grader + grade, e.g. PSA 10). Built natively from /api/registry/cards
/// (bands → listings). Columns: platform × price × oracle × spread × pop × action.

import { useMemo, useState } from 'react';
import { usd } from '../lib/format';
import { popForGrade } from '../lib/registry';

const VISIBLE = 12;

const PLAT_LABEL = {
  ebay: 'eBay', tcgplayer: 'TCG', cardmarket: 'CM', fanatics: 'Fanatics',
  alt: 'Alt', courtyard: 'CY', beezie: 'BZ', phygitals: 'PHY', goldin: 'Goldin', heritage: 'HA',
};
const PLAT_COLOR = {
  ebay: '#e8a838', tcgplayer: '#7c8cf8', cardmarket: '#f5c542', fanatics: '#e879f9',
  alt: '#60a5fa', courtyard: '#38b2ac', beezie: '#e8a838', solana: '#9945ff',
};

const norm = (s) => (s || 'PSA').toString().trim().toUpperCase();
const gradeNumOf = (l) => (typeof l.grade === 'number' ? l.grade : parseFloat(l.grade) || 0);

function tierColor(tier) {
  if (tier == null) return '#6b6b7e';
  if (tier <= 1) return '#4CAF50';
  if (tier <= 3) return '#f59e0b';
  return '#6b6b7e';
}

// spread % vs the listing's grade-matched oracle (backend value, or computed)
function listingSpread(l) {
  const oracle = l.oracle_price ?? l.oracle_anchor?.price ?? null;
  if (oracle != null && oracle > 0 && l.price != null) return ((l.price - oracle) / oracle) * 100;
  return l.spread ?? null;
}

export default function RegistryCardLadder({ card, grader = 'PSA', grade = 10, oracle = null }) {
  const [showAll, setShowAll] = useState(false);

  const listings = useMemo(() => {
    if (!card?.bands) return [];
    const G = norm(grader);
    const flat = [];
    for (const b of card.bands) {
      for (const l of b.listings || []) {
        if (norm(l.grader) !== G) continue;          // exact grader
        if (gradeNumOf(l) !== Number(grade)) continue; // exact grade
        if ((l.platform || '').toLowerCase() === 'pricecharting') continue; // never surface aggregator rows
        flat.push({ ...l, oracle_anchor: b.oracle_anchor });
      }
    }
    flat.sort((a, b) => (a.price || 0) - (b.price || 0)); // cheapest first = best deals
    return flat;
  }, [card, grader, grade]);

  const pop = card ? popForGrade(card, grader, grade) : null;

  if (!card) return null;

  const rows = showAll ? listings : listings.slice(0, VISIBLE);
  const hidden = listings.length - rows.length;

  return (
    <div className="bg-sc-card border border-sc-border rounded-xl overflow-hidden">
      <div className="px-3 py-2 border-b border-sc-border flex items-center justify-between">
        <span className="text-[11px] font-semibold text-sc-dim uppercase tracking-wide">Card registry · {grader} {grade} listings</span>
        <div className="flex items-center gap-3">
          {pop?.exact != null && (
            <span className="text-[11px] tnum text-sc-muted">
              pop <span className="text-sc-text font-semibold">{pop.exact.toLocaleString()}</span>
              {pop.total ? <span className="text-sc-muted">/{pop.total.toLocaleString()}</span> : null}
            </span>
          )}
          {oracle && (
            <span className="flex items-center gap-1.5 text-[11px] tnum font-semibold">
              <span className="w-1.5 h-1.5 rounded-full bg-sc-yes animate-pulse" />
              <span className="text-white">{usd(oracle.price)}</span>
              <span className="text-sc-muted font-normal">oracle</span>
            </span>
          )}
          <span className="text-[10px] text-sc-muted">{listings.length} live</span>
        </div>
      </div>

      {listings.length === 0 ? (
        <div className="p-6 text-center text-sm text-sc-muted">No active {grader} {grade} listings</div>
      ) : (
        <table className="w-full text-[12px] tnum">
          <thead>
            <tr className="text-[9px] text-sc-muted uppercase tracking-wide border-b border-sc-border/60">
              <th className="text-left font-medium px-3 py-1.5">Platform</th>
              <th className="text-right font-medium px-2 py-1.5">Price</th>
              <th className="text-right font-medium px-2 py-1.5">Oracle</th>
              <th className="text-right font-medium px-2 py-1.5">Spread</th>
              <th className="text-right font-medium px-3 py-1.5">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((l, i) => <ListingRow key={i} l={l} />)}
            {hidden > 0 && (
              <tr className="border-t border-sc-border/60 cursor-pointer hover:bg-white/[0.02]" onClick={() => setShowAll(true)}>
                <td colSpan={6} className="px-3 py-1.5 text-[10px] uppercase tracking-wide text-sc-dim">
                  +{hidden} more · <span className="text-sc-accent">show all</span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </div>
  );
}

function ListingRow({ l }) {
  const oracle = l.oracle_price ?? l.oracle_anchor?.price ?? null;
  let tier = l.oracle_tier ?? l.oracle_anchor?.tier ?? null;
  if (l.grader_matched === 0 && tier != null && tier < 2) tier = 2;
  const spread = listingSpread(l);
  const isDeal = spread != null && spread < 0;
  const absPct = Math.abs(spread || 0);
  const spreadCls = spread == null ? 'text-sc-muted'
    : isDeal ? (absPct >= 5 ? 'text-sc-yes font-semibold' : 'text-sc-yes')
    : (absPct >= 20 ? 'text-sc-no' : 'text-sc-amber');
  const plat = (l.platform || '').toLowerCase();
  const platColor = PLAT_COLOR[plat] || '#9ca3af';
  const intl = l.marketplace && l.marketplace !== 'EBAY_US' && plat === 'ebay';

  return (
    <tr className="border-t border-sc-border/40 hover:bg-white/[0.02]">
      <td className="px-3 py-1.5">
        <span className="text-[10px] font-bold uppercase tracking-wide" style={{ color: platColor }}>{PLAT_LABEL[plat] || l.platform}</span>
        {l.listing_type === 'offer' && <span className="ml-1 text-[8px] text-sc-muted">OFFER</span>}
      </td>
      <td className="text-right px-2 py-1.5 font-semibold text-white">
        {usd(l.price)}{intl && <span className="ml-1 text-[8px] text-sc-muted border border-sc-border rounded px-0.5">INTL</span>}
      </td>
      <td className="text-right px-2 py-1.5">
        {oracle != null ? (
          <span className="inline-flex items-center gap-1 justify-end">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: tierColor(tier) }} />
            <span className="text-sc-dim">{usd(oracle)}</span>
          </span>
        ) : <span className="text-sc-muted">—</span>}
      </td>
      <td className={`text-right px-2 py-1.5 ${spreadCls}`}>
        {spread != null ? `${isDeal ? '-' : '+'}${absPct.toFixed(1)}%` : '—'}
      </td>
      <td className="text-right px-2 py-1.5 text-sc-dim">
        {l.pop_exact != null ? l.pop_exact.toLocaleString() : '—'}
      </td>
      <td className="text-right px-3 py-1.5">
        {l.url
          ? <a href={l.url} target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline text-[11px]">{l.listing_type === 'offer' ? 'Offer' : 'Buy'} ↗</a>
          : <span className="text-sc-muted">—</span>}
      </td>
    </tr>
  );
}
