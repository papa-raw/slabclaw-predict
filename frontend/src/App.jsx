import { useState } from 'react';
import { useMultipleMarkets } from './hooks/useMarket';
import { DEMO_MARKETS } from './constants';
import Header from './components/Header';
import MarketCard from './components/MarketCard';
import MarketDetail from './components/MarketDetail';
import Footer from './components/Footer';

export default function App() {
  const [selectedId, setSelectedId] = useState(null);
  const marketIds = DEMO_MARKETS.map((m) => m.id);
  const { markets, isLoading, error, refetch } = useMultipleMarkets(marketIds);

  const enriched = markets.map((m) => ({ ...m, meta: DEMO_MARKETS.find((d) => d.id === m.id) }));
  const selected = enriched.find((m) => m.id === selectedId) || null;


  return (
    <div className="min-h-screen bg-sc-bg">
      <Header />

      <main className="max-w-6xl mx-auto px-4 lg:px-6 py-7 pb-24">
        {/* Hero */}
        <div className="mb-6">
          <h2 className="text-xl lg:text-2xl font-bold text-white">Prediction markets for graded collectibles</h2>
          <p className="text-sc-dim mt-1.5 text-sm max-w-2xl">
            Bet YES/NO on whether a graded card exceeds a strike price by expiry — priced against a
            real 10-platform oracle and a live history of sold comps. Settled on{' '}
            <a href="https://sui.io" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">Sui</a> via{' '}
            <a href="https://www.deepbook.tech" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">DeepBook</a> Predict.
            Each market shows the oracle value over time, the strike line, and every recent sold comp — so you bet with data, not vibes.
            Mint test USD from the faucet below, buy YES or NO, and at expiry the oracle proposes the price.
            After a 24h dispute window, winners claim.
          </p>
        </div>

        {/* Markets */}
        {isLoading ? (
          <SkeletonGrid />
        ) : error ? (
          <div className="text-center py-16 text-sc-no text-sm">
            Failed to load markets from Sui testnet: {error.message}
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-16 text-sc-muted text-sm">No markets found</div>
        ) : (
          <MarketSections markets={enriched} onSelect={(mk) => setSelectedId(mk.id)} />
        )}
      </main>

      <Footer onFunded={refetch} />

      {selected && (
        <MarketDetail
          market={selected}
          meta={selected.meta}
          onClose={() => setSelectedId(null)}
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
        <div className={active.length > 0 ? 'mt-8' : ''}>
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
