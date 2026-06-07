import { useState, useEffect } from 'react';
import { useMultipleMarkets } from './hooks/useMarket';
import { useOraclePrice } from './hooks/useOracle';
import { DEMO_MARKETS, EXPLORER_URL, PACKAGE_ID } from './constants';
import Header from './components/Header';
import MarketCard from './components/MarketCard';
import TradingPanel from './components/TradingPanel';

function OracleProvider({ productId, grader, grade, children }) {
  const { data, loading, error } = useOraclePrice(productId, grader, grade);
  return children({ oracle: data, oracleLoading: loading, oracleError: error });
}

export default function App() {
  const [selectedMarket, setSelectedMarket] = useState(null);
  const marketIds = DEMO_MARKETS.map((m) => m.id);
  const { markets, isLoading, error, refetch } = useMultipleMarkets(marketIds);

  // Merge on-chain data with demo metadata
  const enriched = markets.map((m) => {
    const meta = DEMO_MARKETS.find((d) => d.id === m.id);
    return { ...m, meta };
  });

  const selectedMeta = selectedMarket
    ? DEMO_MARKETS.find((d) => d.id === selectedMarket.id)
    : null;

  return (
    <div className="min-h-screen bg-sc-bg">
      <Header />

      <main className="max-w-6xl mx-auto px-4 py-8">
        {/* Hero */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold font-display">
            Prediction Markets for Collectibles
          </h2>
          <p className="text-sc-muted mt-2 text-sm max-w-xl">
            Trade on the future prices of graded Pokemon cards. Powered by a
            10-platform price oracle and settled on{' '}
            <a
              href="https://sui.io"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sc-accent hover:underline"
            >
              Sui
            </a>
            .
          </p>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatBox label="Markets" value={markets.length} />
          <StatBox
            label="Total Volume"
            value={
              formatSui(
                enriched.reduce((sum, m) => sum + (m.poolBalance || 0), 0)
              ) + ' SUI'
            }
          />
          <StatBox label="Oracle Sources" value="10 platforms" />
          <StatBox label="Card Universe" value="5,166 cards" />
        </div>

        {/* Markets grid */}
        {isLoading ? (
          <div className="text-center py-20 text-sc-muted">
            Loading markets from Sui testnet...
          </div>
        ) : error ? (
          <div className="text-center py-20 text-sc-no">
            Failed to load markets: {error.message}
          </div>
        ) : enriched.length === 0 ? (
          <div className="text-center py-20 text-sc-muted">
            No markets found
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enriched.map((m) => (
              <MarketCard
                key={m.id}
                market={m}
                meta={m.meta}
                onSelect={setSelectedMarket}
              />
            ))}
          </div>
        )}

        {/* How it works */}
        <div className="mt-16 border-t border-sc-border pt-8">
          <h3 className="text-lg font-semibold font-display mb-4">How It Works</h3>
          <div className="grid sm:grid-cols-3 gap-6">
            <Step
              n={1}
              title="Pick a Market"
              desc="Each market asks: will a specific graded card exceed a strike price by the expiry date?"
            />
            <Step
              n={2}
              title="Buy YES or NO"
              desc="Deposit SUI to buy shares. Your payout depends on how many shares are on each side."
            />
            <Step
              n={3}
              title="Oracle Settles"
              desc="At expiry, SlabClaw's 10-platform oracle proposes the price. After a 24h dispute window, winners claim their payout."
            />
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-16 border-t border-sc-border pt-6 pb-8 flex flex-wrap items-center gap-4 text-xs text-sc-muted">
          <a
            href={`${EXPLORER_URL}/object/${PACKAGE_ID}`}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-sc-accent transition-colors font-mono"
          >
            Contract: {PACKAGE_ID.slice(0, 10)}...
          </a>
          <span>·</span>
          <span>Sui Overflow 2026 — DeepBook Track</span>
          <span>·</span>
          <span>Built by paparaw.eth</span>
        </footer>
      </main>

      {/* Trading modal */}
      {selectedMarket && selectedMeta && (
        <OracleProvider
          productId={selectedMeta.productId}
          grader={selectedMeta.grader}
          grade={selectedMeta.grade}
        >
          {({ oracle }) => (
            <TradingPanel
              market={selectedMarket}
              meta={selectedMeta}
              oracle={oracle}
              onClose={() => setSelectedMarket(null)}
              onTxSuccess={() => {
                refetch();
                setTimeout(() => refetch(), 3000);
              }}
            />
          )}
        </OracleProvider>
      )}
    </div>
  );
}

function StatBox({ label, value }) {
  return (
    <div className="bg-sc-card border border-sc-border rounded-lg p-3">
      <div className="text-xs text-sc-muted">{label}</div>
      <div className="text-sm font-semibold font-mono mt-1">{value}</div>
    </div>
  );
}

function Step({ n, title, desc }) {
  return (
    <div className="flex gap-3">
      <div className="w-7 h-7 rounded-full bg-sc-accent/15 text-sc-accent text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
        {n}
      </div>
      <div>
        <h4 className="text-sm font-semibold">{title}</h4>
        <p className="text-xs text-sc-muted mt-1">{desc}</p>
      </div>
    </div>
  );
}

function formatSui(mist) {
  return (mist / 1_000_000_000).toFixed(2);
}
