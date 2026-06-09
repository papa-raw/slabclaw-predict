import { useState, useEffect } from 'react';
import { useMultipleMarkets } from './hooks/useMarket';
import { DEMO_MARKETS } from './constants';
import Header from './components/Header';
import MarketCard from './components/MarketCard';
import MarketDetail from './components/MarketDetail';
import ArchitecturePage from './components/ArchitecturePage';
import LegalPage from './components/LegalPage';
import Footer from './components/Footer';

const hashView = () => {
  const h = typeof window !== 'undefined' ? window.location.hash : '';
  if (h === '#architecture') return 'architecture';
  if (h === '#legal') return 'legal';
  return 'markets';
};

export default function App() {
  const [selectedId, setSelectedId] = useState(() =>
    typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('market') : null,
  );
  const [view, setView] = useState(hashView);
  const marketIds = DEMO_MARKETS.map((m) => m.id);
  const { markets, isLoading, error, refetch } = useMultipleMarkets(marketIds);

  // #architecture toggles the docs/architecture page; the navbar links drive the hash.
  useEffect(() => {
    const onHash = () => { setView(hashView()); window.scrollTo({ top: 0 }); };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Deep-link the open market to ?market=<id> so the browser Back button closes
  // it and a specific market (e.g. the disputed Flareon) is shareable.
  useEffect(() => {
    const onPop = () => setSelectedId(new URLSearchParams(window.location.search).get('market'));
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const openMarket = (id) => {
    setSelectedId(id);
    const u = new URL(window.location);
    u.searchParams.set('market', id);
    window.history.pushState({ scModal: true }, '', u);
  };
  const closeMarket = () => {
    if (window.history.state?.scModal) { window.history.back(); return; } // pop back to the list
    setSelectedId(null);
    const u = new URL(window.location);
    u.searchParams.delete('market');
    window.history.replaceState({}, '', u);
  };

  const enriched = markets.map((m) => ({ ...m, meta: DEMO_MARKETS.find((d) => d.id === m.id) }));
  const selected = enriched.find((m) => m.id === selectedId) || null;


  return (
    <div className="min-h-screen bg-sc-bg">
      <Header />

      {view === 'architecture' ? (
        <ArchitecturePage />
      ) : view === 'legal' ? (
        <LegalPage />
      ) : (
      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-7 pb-32">
        {/* Hero */}
        <div className="mb-6">
          <h2 className="text-xl lg:text-2xl font-bold text-white">Prediction markets for graded collectibles</h2>
          <p className="text-sc-dim mt-1.5 text-sm max-w-2xl">
            Trade YES/NO on whether a graded card exceeds a strike price by expiry — priced by a
            memory-backed multi-agent oracle swarm across real card marketplaces and a live history of sold comps.
            Settled on{' '}
            <a href="https://sui.io" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">Sui</a>,
            with every settlement published as a verifiable blob on{' '}
            <a href="https://www.walrus.xyz" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">Walrus</a>.
            Each market shows the oracle value over time, the strike line, and every recent sold comp — so you trade with data, not vibes.
            Mint test USD from the faucet below, buy YES or NO, and at expiry the oracle proposes the price.
            After a 24h dispute window, winners claim. <a href="#architecture" className="text-sc-accent hover:underline">See how it works ↗</a>
          </p>
        </div>

        {/* Markets */}
        {isLoading ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="bg-sc-card border border-sc-no/30 rounded-xl py-12 px-6 text-center">
            <div className="text-sc-no text-sm font-semibold mb-1">Couldn’t load markets from Sui testnet</div>
            <div className="text-sc-muted text-xs mb-4 font-mono break-all">{error.message}</div>
            <button onClick={refetch}
              className="px-4 py-2 rounded-lg bg-sc-surface border border-sc-border text-sc-text text-sm font-semibold hover:border-sc-accent/50 active:scale-[.98] transition">
              Retry
            </button>
          </div>
        ) : enriched.length === 0 ? (
          <div className="bg-sc-card border border-sc-border rounded-xl py-14 px-6 text-center">
            <div className="text-sc-dim text-sm font-semibold mb-1">No markets yet</div>
            <div className="text-sc-muted text-xs">Markets will appear here once they’re created onchain.</div>
          </div>
        ) : (
          <MarketSections markets={enriched} onSelect={(mk) => openMarket(mk.id)} />
        )}
      </main>
      )}

      <Footer onFunded={refetch} />

      {view === 'markets' && selected && (
        <MarketDetail
          market={selected}
          meta={selected.meta}
          onClose={closeMarket}
          onTxSuccess={() => { refetch(); setTimeout(refetch, 3000); }}
        />
      )}
    </div>
  );
}

function MarketSections({ markets, onSelect }) {
  const active = markets.filter((m) => m.state === 0);
  const past = markets.filter((m) => m.state !== 0);

  return (
    <>
      {active.length > 0 && (
        <>
          <SectionHeader label="Active" count={active.length} />
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((m) => (
              <MarketCard key={m.id} market={m} meta={m.meta} onSelect={onSelect} />
            ))}
          </div>
        </>
      )}
      {past.length > 0 && (
        <div className={`opacity-70 hover:opacity-100 transition-opacity ${active.length > 0 ? 'mt-8' : ''}`}>
          <SectionHeader label="Past" count={past.length} muted />
          <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((m) => (
              <MarketCard key={m.id} market={m} meta={m.meta} onSelect={onSelect} />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function SectionHeader({ label, count, muted }) {
  return (
    <div className="flex items-center gap-2.5 mb-3">
      <h3 className={`text-sm font-semibold uppercase tracking-wide ${muted ? 'text-sc-muted' : 'text-white'}`}>{label}</h3>
      <span className={`text-[10px] font-mono tnum px-1.5 py-0.5 rounded-full ${muted ? 'bg-sc-surface text-sc-muted' : 'bg-sc-accent/15 text-sc-accent'}`}>{count}</span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-sc-card border border-sc-border rounded-xl p-3.5 animate-pulse">
          <div className="flex gap-3">
            <div className="w-[52px] h-[72px] rounded-md bg-sc-surface" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-3 bg-sc-surface rounded w-2/3" />
              <div className="h-2.5 bg-sc-surface rounded w-1/2" />
              <div className="h-4 bg-sc-surface rounded w-1/3" />
            </div>
          </div>
          <div className="h-9 bg-sc-surface rounded mt-3" />
          <div className="h-1.5 bg-sc-surface rounded-full mt-3" />
        </div>
      ))}
    </div>
  );
}
