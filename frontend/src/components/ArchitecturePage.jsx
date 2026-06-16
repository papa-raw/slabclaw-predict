/// ArchitecturePage — the "how it works + docs" page reached from the navbar (#architecture).
///
/// Two jobs: (1) make the pipeline legible — a memory-backed multi-agent oracle swarm
/// (source → consensus → self-audit → chain) that settles markets on Sui with verifiable
/// evidence on Walrus; (2) be the docs hub that links every piece of the work.
///
/// Every named mechanism (MAD, family, learned calibration, PII-redaction…) is a hoverable
/// <Term> with a precise definition, so the page reads at a glance but rewards inspection.
/// Aesthetic: the locked sc-* dark Bloomberg terminal — single gold accent, hairline
/// borders, tabular-nums. No gradients.

import { PACKAGE_ID, REGISTRY_ID, FAUCET_ID, EXPLORER_URL, DEMO_MARKETS } from '../constants';

const REPO = 'https://github.com/papa-raw/slabclaw-predict';
const WALRUSCAN = 'https://walruscan.com/testnet/blob';
// The evidence bundle referenced ONCHAIN by the live DISPUTED market — the strongest
// verification anchor: read market.evidence_blob_id on Suiscan, fetch this blob on
// Walrus, re-run the math.
const EVIDENCE_BLOB = '2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA';
// Shared SwarmMemory object — the ONCHAIN pointer to the swarm's latest memory
// snapshot on Walrus. The serving node restores from this, not from any disk.
const SWARM_MEMORY_ID = '0xf31c41b1b68b6607fa68ef504e9332b129825957d21294f9483e6805214c8883';
const PREDICT_API = 'https://api.slabclaw.com/predict';

const obj = (id) => `${EXPLORER_URL}/object/${id}`;
const short = (id) => `${id.slice(0, 10)}…${id.slice(-4)}`;

// Hoverable mechanism term — dotted underline + a dark popover with a precise definition.
function Term({ children, def }) {
  return (
    <span className="relative inline-block group/term align-baseline">
      <span className="border-b border-dotted border-sc-muted/70 text-sc-text cursor-help">{children}</span>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 z-40 opacity-0 group-hover/term:opacity-100 transition-opacity duration-150 rounded-lg border border-sc-border bg-sc-panel px-2.5 py-2 text-[11px] font-normal normal-case tracking-normal leading-relaxed text-sc-dim shadow-xl"
      >
        {def}
      </span>
    </span>
  );
}

// ── The pipeline: source → consensus → self-audit → chain ──────────────────────
const TIERS = [
  {
    n: 1,
    tag: 'Tier 1',
    title: 'Source agents — 13 specialists, 11 independent venue families',
    body: (
      <>
        Thirteen venue specialists each read their OWN marketplace — eBay, PriceCharting, Courtyard, TCGPlayer,
        Beezie, Collector Crypt, PSA APR, Goldin, Fanatics, ALT, Cardmarket, Yahoo Auctions JP, 130point.
        Same-origin feeds collapse into one voting family (eBay + PriceCharting + 130point = one eBay-sold vote),
        so correlated tapes never inflate the source count. Every observation is tagged{' '}
        <Term def="Realized = a completed sale. Ask = a live listing. Asks sit above the clearing price, so they bound the range but never vote in the settle.">realized sale vs live ask</Term>{' '}
        and written to MemWal. Three memories accumulate in MemWal and refine each run:{' '}
        <Term def="Per-card baselines — the card's typical realized price and its grade-to-grade price ratios — held as exponentially-weighted averages. Cold-start global bands converge to card-specific ones, so false-positive flags fall as the card is learned.">a per-card price calibration</Term>,{' '}
        <Term def="An EMA of how often each source agreed with the final consensus. A chronically-noisy venue loses weight over time.">a reputation score per source</Term>, and{' '}
        <Term def="The last good price per venue. A transient scrape miss reuses it (down-weighted by age) instead of dropping the source entirely.">a warm-cache of each venue's last good price</Term>.
      </>
    ),
  },
  {
    n: 2,
    tag: 'Tier 2',
    title: 'Coordinator — manipulation-resistant consensus',
    body: (
      <>
        Same-origin feeds collapse to one{' '}
        <Term def="Feeds that share a data origin count as one. eBay and PriceCharting both derive from eBay-sold data, so they cast a single combined vote — two windows on one market aren't two markets.">family</Term>{' '}
        (eBay + PriceCharting = one vote). Outliers are{' '}
        <Term def="Median Absolute Deviation — a robust outlier test. A source is dropped when its price is more than 3.5 modified-z-scores from the median of the others; robust because the median itself isn't pulled by the outlier.">MAD</Term>-rejected,
        thin wrong-variant grabs are caught by a{' '}
        <Term def="Anchored on the well-supported (3+ sale) sources, a thin 1–2 sale source is rejected if it lands outside ±50% of that anchor — catching a snippet that grabbed the wrong card, grade, or variant.">cross-source plausibility gate</Term>,
        and the market settles on a confidence-weighted median of{' '}
        <Term def="Completed sales only. Live listings (asks) sit above the clearing price, so they bound the range but are never counted in the settle median.">realized sales</Term>{' '}
        — asks bound the range but never vote.
      </>
    ),
  },
  {
    n: '2.5',
    tag: 'Tier 2.5',
    title: 'Self-audit — the swarm checks its own price',
    body: (
      <>
        Each round reconciles the settle against the grade-matched PSA-10 oracle and runs{' '}
        <Term def="A lower grade listed above a higher grade of the same card — physically backwards in a clean market, so it flags a mis-grade or manipulation.">grade-inversion</Term>{' '}
        and{' '}
        <Term def="Grades trade at stable ratios (a PSA 9 is typically 25–48% of a PSA 10). A comp that breaks the expected ratio for that card is flagged as suspect.">multiplier-divergence</Term>{' '}
        checks against the card's{' '}
        <Term def="What the swarm has remembered about THIS specific card — its baseline price and grade ratios — refined a little every round and stored in MemWal. 'Learned' means not hard-coded: it converges from the card's own data.">learned calibration</Term>.
        A contested price widens the dispute window instead of settling on a shaky number. A{' '}
        <Term def="Some cards (e.g. a rare 1st-ed Japanese PSA 10) genuinely have only two independent sold-sources because clean sales are scarce. Rather than refuse forever, the oracle settles on those agreeing sources, records the thin-market status in the evidence, and extends the challenge window so anyone can contest before it finalizes.">genuinely rare card</Term>{' '}
        still settles on the independent sales that agree — its thinness is recorded in the evidence and its challenge window is extended, not the price suppressed.
      </>
    ),
  },
  {
    n: 3,
    tag: 'Tier 3',
    title: 'Keeper — onchain settlement with evidence',
    body: (
      <>
        A keeper proposes the resolution onchain on Sui with the evidence blob ID. An{' '}
        <Term def="UMA-style: the proposed price is accepted unless someone challenges it with a bond inside 24 hours. Undisputed → auto-settles; disputed → escalates to staked community voting.">optimistic 24-hour dispute</Term>{' '}
        window lets anyone challenge with a bond. No market settles without a verifiable,{' '}
        <Term def="Walrus blobs are immutable — you can't delete them. So before publishing, seller names and personal data are stripped and replaced with salted-hash tokens (the seller-concentration signal is kept, the identity isn't). GDPR-safe by construction.">PII-redacted</Term>{' '}
        Walrus evidence blob referenced onchain. The settlement math itself is{' '}
        <Term def="The payout arithmetic in market.move was proven by the Sui Prover (Z3 + Boogie): solvency (payout ≤ pool), no silent truncation on the u128→u64 cast, bounded probability, and overflow-safety — all machine-checked. See docs/FORMAL-VERIFICATION.md.">machine-checked
        by the Sui Prover</Term>{' '}
        — a winner can never be paid more than the pool.
      </>
    ),
  },
];

// ── Docs hub (links use explicit index.html so they resolve in dev AND prod) ────
const DOCS = [
  { title: 'Deck', desc: 'The full story — architecture, MemWal, observable learning, evidence.', href: '/deck/index.html' },
  { title: 'Source code', desc: 'Move contracts, oracle bridge, swarm, frontend — all open.', href: REPO },
  { title: 'Live evidence on Walrus', desc: 'The latest published consensus bundle; re-run the aggregation to check the price.', href: `${WALRUSCAN}/${EVIDENCE_BLOB}` },
  { title: 'Formal verification', desc: 'Settlement math machine-checked by the Sui Prover (Z3 + Boogie) — solvency, no truncation, bounded, overflow-safe.', href: `${REPO}/blob/main/docs/FORMAL-VERIFICATION.md` },
];

// Full system diagram: the SlabClaw scanner (data foundation) → 13 source agents
// (registry-fed + venue-direct) → MemWal → coordinator → Walrus + Sui → the
// two-node production topology that serves the live feed. The scanner and the
// serving topology are the pieces the textual pipeline below doesn't show.
const GOLD = '#f5c542', TEAL = '#46E3BE', BLUE = '#4DA2FF', INK = '#E8ECF5', DIM = '#8a8a9c', LINE = '#262633', PANEL = '#0E0E14';
function SystemDiagram() {
  const Node = ({ x, y, w, h, stroke = LINE, fill = PANEL, children }) => (
    <rect x={x} y={y} width={w} height={h} rx="7" fill={fill} stroke={stroke} strokeWidth="1.25" />
  );
  const T = ({ x, y, s = 11, fill = INK, w = 600, anchor = 'middle', children }) => (
    <text x={x} y={y} textAnchor={anchor} fontSize={s} fill={fill} fontFamily="Inter, sans-serif" fontWeight={w}>{children}</text>
  );
  const L = ({ x, y, fill = DIM }) => null;
  const label = (x, y, txt) => <text x={x} y={y} fontSize="9" letterSpacing="0.08em" fill="#5C6578" fontFamily="JetBrains Mono, monospace">{txt}</text>;
  return (
    <svg viewBox="0 0 920 580" style={{ width: '100%', minWidth: 640, height: 'auto' }} role="img" aria-label="SlabClaw Predict system architecture">
      {/* ── DATA FOUNDATION ── */}
      {label(2, 14, 'DATA SOURCES')}
      <Node x={0} y={22} w={430} h={50} stroke={GOLD + '88'} />
      <T x={215} y={42} s={12.5} w={600}>SlabClaw scanner</T>
      <T x={215} y={59} s={9.5} fill={DIM}>10-platform registry · 5,167 products · local SQLite</T>
      <Node x={490} y={22} w={430} h={50} stroke={GOLD + '88'} />
      <T x={705} y={42} s={12.5} w={600}>Direct venue reads</T>
      <T x={705} y={59} s={9.5} fill={DIM}>TinyFish agent + self-hosted stealth browser (auto-failover)</T>

      {/* arrows down to tier 1 */}
      <line x1={215} y1={72} x2={215} y2={96} stroke={GOLD + '66'} strokeWidth="1.25" />
      <line x1={705} y1={72} x2={705} y2={96} stroke={GOLD + '66'} strokeWidth="1.25" />

      {/* ── TIER 1 ── */}
      {label(2, 92, 'TIER 1 · 13 SOURCE AGENTS, IN PARALLEL')}
      <Node x={0} y={98} w={430} h={52} />
      <T x={215} y={118} s={11} w={600} fill={TEAL}>Registry-fed agents (6)</T>
      <T x={215} y={135} s={9.5} fill={DIM}>eBay · PriceCharting · Courtyard · TCGPlayer · Beezie · Collector&nbsp;Crypt</T>
      <Node x={490} y={98} w={430} h={52} />
      <T x={705} y={118} s={11} w={600} fill={TEAL}>Venue-direct agents (7)</T>
      <T x={705} y={135} s={9.5} fill={DIM}>Goldin · Fanatics · PSA&nbsp;APR · Yahoo&nbsp;JP · ALT · Cardmarket · 130point</T>

      <line x1={215} y1={150} x2={215} y2={170} stroke={TEAL + '55'} strokeWidth="1.25" strokeDasharray="3,3" />
      <line x1={705} y1={150} x2={705} y2={170} stroke={TEAL + '55'} strokeWidth="1.25" strokeDasharray="3,3" />

      {/* ── MemWal shared memory ── */}
      <rect x={0} y={170} width={920} height={30} rx="5" fill="rgba(70,227,190,.06)" stroke="rgba(70,227,190,.22)" strokeWidth="1" />
      <T x={460} y={189} s={10.5} fill={TEAL} w={600}>SHARED SIGNALS → MemWal &nbsp;·&nbsp; per-card calibration · source reputation · warm cache</T>

      <line x1={460} y1={200} x2={460} y2={222} stroke={TEAL} strokeWidth="1.5" />
      <polygon points="455,220 460,228 465,220" fill={TEAL} opacity="0.6" />

      {/* ── TIER 2 ── */}
      {label(2, 218, 'TIER 2 · COORDINATOR')}
      <Node x={150} y={228} w={620} h={50} stroke={`url(#sgrad)`} />
      <defs><linearGradient id="sgrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor={BLUE} /><stop offset="100%" stopColor={TEAL} /></linearGradient></defs>
      <T x={460} y={248} s={12.5} w={600}>Manipulation-resistant coordinator</T>
      <T x={460} y={265} s={9.5} fill={DIM}>family dedup · MAD outlier cut · anchor gate · realized sales settle · 2-source rare-card gate</T>

      {/* fork to walrus + sui */}
      <path d={`M460,278 V300 H250 V320`} fill="none" stroke={TEAL + '55'} strokeWidth="1.5" />
      <path d={`M460,278 V300 H670 V320`} fill="none" stroke={BLUE + '55'} strokeWidth="1.5" />
      <polygon points="245,318 250,326 255,318" fill={TEAL} opacity="0.6" />
      <polygon points="665,318 670,326 675,318" fill={BLUE} opacity="0.6" />

      {/* ── TIER 3 ── */}
      {label(2, 314, 'TIER 3 · ONCHAIN')}
      <Node x={70} y={324} w={360} h={48} stroke={TEAL + '66'} />
      <T x={250} y={344} s={12} fill={TEAL} w={600}>Walrus</T>
      <T x={250} y={360} s={9.5} fill={DIM}>evidence blobs + MemWal snapshots (permanent, verifiable)</T>
      <Node x={490} y={324} w={360} h={48} stroke={BLUE + '66'} />
      <T x={670} y={344} s={12} fill={BLUE} w={600}>Sui Move contracts</T>
      <T x={670} y={360} s={9.5} fill={DIM}>market · oracle · registry · memory · test_usd</T>

      {/* cold-start restore loop (Walrus → tier 1) */}
      <path d="M70,348 H18 V158 H40" fill="none" stroke={TEAL + '44'} strokeWidth="1" strokeDasharray="3,3" />
      <polygon points="38,154 46,158 38,162" fill={TEAL} opacity="0.5" />
      <text x={24} y={250} fontSize="8.5" fill={TEAL} fontFamily="JetBrains Mono, monospace" transform="rotate(-90 24 250)">cold-start restore</text>

      {/* ── PRODUCTION TOPOLOGY ── */}
      {label(2, 404, 'IN PRODUCTION · WALRUS IS THE MEMORY BUS BETWEEN TWO NODES')}
      <line x1={0} y1={388} x2={920} y2={388} stroke={LINE} strokeWidth="1" />
      {/* row of 4 boxes with arrows */}
      <Node x={0} y={414} w={200} h={56} stroke={GOLD + '66'} />
      <T x={100} y={436} s={11} w={600}>Data-plane node</T>
      <T x={100} y={452} s={9} fill={DIM}>runs full swarm daily</T>
      <T x={100} y={463} s={9} fill={DIM}>→ snapshots to Walrus</T>

      <Node x={245} y={414} w={190} h={56} stroke={TEAL + '66'} />
      <T x={340} y={436} s={11} fill={TEAL} w={600}>Walrus + Sui</T>
      <T x={340} y={452} s={9} fill={DIM}>memory blob id</T>
      <T x={340} y={463} s={9} fill={DIM}>anchored onchain</T>

      <Node x={480} y={414} w={200} h={56} stroke={BLUE + '66'} />
      <T x={580} y={433} s={11} w={600}>Serving node (keyless)</T>
      <T x={580} y={449} s={9} fill={DIM}>restores memory from chain</T>
      <T x={580} y={460} s={9} fill={DIM}>+ Walrus, every 6h</T>

      <Node x={725} y={414} w={195} h={56} stroke={LINE} />
      <T x={822} y={433} s={11} w={600}>slabclaw.com</T>
      <T x={822} y={449} s={9} fill={DIM}>live /predict feed</T>
      <T x={822} y={460} s={9} fill={DIM}>baked-snapshot fallback</T>

      <line x1={200} y1={442} x2={245} y2={442} stroke={DIM} strokeWidth="1.25" /><polygon points="243,438 251,442 243,446" fill={DIM} />
      <line x1={435} y1={442} x2={480} y2={442} stroke={DIM} strokeWidth="1.25" /><polygon points="478,438 486,442 478,446" fill={DIM} />
      <line x1={680} y1={442} x2={725} y2={442} stroke={DIM} strokeWidth="1.25" /><polygon points="723,438 731,442 723,446" fill={DIM} />

      <T x={460} y={500} s={9.5} fill={DIM} w={500}>Kill either node and the other rebuilds the swarm&rsquo;s memory from the onchain pointer + Walrus. No file moves between machines.</T>
    </svg>
  );
}

export default function ArchitecturePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 lg:px-6 py-7 pb-32">
      {/* Hero */}
      <div className="mb-8">
        <div className="text-[10px] font-semibold text-sc-accent uppercase tracking-wide mb-1.5">Architecture &amp; docs</div>
        <h2 className="text-xl lg:text-2xl font-bold text-white">A memory-backed oracle swarm, settled onchain</h2>
        <p className="text-sc-dim mt-2 text-sm max-w-2xl leading-relaxed">
          SlabClaw Predict prices graded collectibles with a multi-agent oracle swarm: independent venue
          agents reach a manipulation-resistant consensus, audit their own number, and settle markets on{' '}
          <a href="https://sui.io" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">Sui</a> — with
          every settlement published as a verifiable blob on{' '}
          <a href="https://www.walrus.xyz" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">Walrus</a>.
        </p>
      </div>

      {/* Full system diagram — scanner → swarm → chain → production */}
      <SectionTitle>System at a glance · scanner → swarm → chain</SectionTitle>
      <p className="text-[11px] text-sc-muted mb-3 -mt-1">Where the data comes from, how it becomes a price, and how that price is served in production.</p>
      <div className="bg-sc-card border border-sc-border rounded-xl p-4 mb-10 overflow-x-auto">
        <SystemDiagram />
      </div>

      {/* Pipeline — source → consensus → self-audit → chain */}
      <SectionTitle>The pipeline · source → consensus → chain</SectionTitle>
      <p className="text-[11px] text-sc-muted mb-3 -mt-1">Hover any underlined term for what it means.</p>
      <div className="relative mb-8">
        {TIERS.map((t, i) => (
          <TierRow key={t.n} tier={t} last={i === TIERS.length - 1} />
        ))}
      </div>

      {/* Running in production — the MemWal bootstrap is the live system, not a slide */}
      <SectionTitle>Running in production · two-node topology</SectionTitle>
      <div className="bg-sc-card border border-sc-border rounded-xl p-4 mb-10">
        <p className="text-[12px] leading-relaxed text-sc-dim mb-3">
          The swarm runs in two places, and <span className="text-sc-text font-medium">Walrus is the memory bus between them</span>.
          A data-plane node runs the full swarm where its marketplaces are reachable, snapshots the agents&rsquo;
          entire memory to Walrus every round, and{' '}
          <Term def="memory::checkpoint on the shared SwarmMemory object — the blob id of the latest memory snapshot, anchored onchain by the oracle operator. The same trust pattern as market evidence (evidence_blob_id), applied to the agents' memory itself.">anchors
          the blob id onchain</Term>. A keyless serving node on independent infrastructure{' '}
          <Term def="memwal-sync.mjs restore — reads the SwarmMemory object on Sui for the latest blob id, fetches that blob from a Walrus aggregator, and rebuilds the swarm's full MemWal state. No file ever moves between the machines; /predict/health reports restoredFromBlobId + pointerSource so you can check.">resolves
          that pointer from chain and restores the memory from Walrus</Term>{' '}
          on cold start, then serves the rounds the data-plane node publishes as a public feed. Kill either machine and the
          other rebuilds the swarm&rsquo;s accumulated knowledge — price calibrations, source reputations, warm
          caches — from the blob. The dapp you&rsquo;re reading ships a build-time snapshot and{' '}
          <Term def="useLiveConsensus: the page fetches the production feed at load and swaps it in only if the full payload validates for every market — a partial or malformed payload is discarded whole, and the panel labels itself 'live' or 'snapshot'.">upgrades
          to the live feed</Term>{' '}
          when it&rsquo;s reachable — each oracle panel tells you which one you&rsquo;re seeing.
        </p>
        <div className="grid gap-1.5 sm:grid-cols-2">
          <a href={`${PREDICT_API}/consensus`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-sc-surface border border-sc-border hover:border-sc-accent/50 transition text-[11px]">
            <span className="text-sc-dim">Live consensus feed</span>
            <span className="font-mono text-sc-muted">/predict/consensus ↗</span>
          </a>
          <a href={`${PREDICT_API}/health`} target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-between px-3 py-2 rounded-lg bg-sc-surface border border-sc-border hover:border-sc-accent/50 transition text-[11px]">
            <span className="text-sc-dim">Feed health · consensus age</span>
            <span className="font-mono text-sc-muted">/predict/health ↗</span>
          </a>
        </div>
      </div>

      {/* How agents read the venues — two transports, no single point of failure */}
      <div className="bg-sc-card border border-sc-border rounded-xl p-4 mb-10">
        <div className="text-[10px] font-semibold text-sc-accent uppercase tracking-wide mb-1.5">How agents read the venues</div>
        <p className="text-[12px] leading-relaxed text-sc-dim">
          Many venues — Fanatics&rsquo; sold-history, Cardmarket, Goldin, live Yahoo auction pages — are
          JavaScript-heavy apps whose publicly-listed prices a plain HTTP fetch can&rsquo;t read. Agents reach them
          through{' '}
          <a href="https://www.tinyfish.ai" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">TinyFish</a>{' '}
          browser agents and{' '}
          <Term def="A self-hosted stealth-Chromium transport (patchright) that renders the real page — headed where Cloudflare demands it — and extracts grade-matched sold comps straight from the DOM. When TinyFish is rate-limited or out of credits, a circuit breaker opens and every agent routes through this backup automatically, so the swarm never goes blind.">a
          self-hosted stealth-browser backup</Term>{' '}
          that takes over automatically when the API is rate-limited — so the oracle never goes blind because a
          single provider ran dry. Both render the page and read grade-matched realized prices from genuinely
          independent venues.{' '}
          <a href="#legal" className="text-sc-accent hover:underline">Data &amp; sources →</a>
        </p>
      </div>

      {/* Onchain registry — verify it yourself */}
      <SectionTitle>Onchain objects</SectionTitle>
      <div className="bg-sc-card border border-sc-border rounded-xl overflow-hidden mb-10">
        <div className="px-3 py-2 border-b border-sc-border flex items-center justify-between">
          <span className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide">Sui testnet objects</span>
          <span className="text-[9px] font-mono text-sc-muted border border-sc-border rounded px-1 py-px">TESTNET</span>
        </div>
        <div className="divide-y divide-sc-border/60">
          <RegistryRow label="Package" id={PACKAGE_ID} href={obj(PACKAGE_ID)} note="market · oracle · registry · test_usd" />
          <RegistryRow label="AssetRegistry" id={REGISTRY_ID} href={obj(REGISTRY_ID)} note="shared object" />
          <RegistryRow label="tUSD Faucet" id={FAUCET_ID} href={obj(FAUCET_ID)} note="mint test USD to trade" />
          {DEMO_MARKETS.map((m) => (
            <RegistryRow key={m.id} label={`Market · ${m.name}`} id={m.id} href={obj(m.id)}
              note={`${m.grader} ${m.grade} · strike $${(m.strikeUsdCents / 100000).toFixed(1)}k`} />
          ))}
          <RegistryRow label="SwarmMemory · onchain memory pointer" id={SWARM_MEMORY_ID} href={obj(SWARM_MEMORY_ID)}
            note="latest MemWal snapshot blob, anchored onchain each round" />
          <RegistryRow label="Evidence blob" id={EVIDENCE_BLOB} href={`${WALRUSCAN}/${EVIDENCE_BLOB}`}
            note="referenced onchain by the DISPUTED market" walrus />
        </div>
      </div>

      {/* Docs & links hub */}
      <SectionTitle>Read more · the full build</SectionTitle>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {DOCS.map((d) => <DocCard key={d.title} doc={d} />)}
      </div>
    </main>
  );
}

function SectionTitle({ children }) {
  return <h3 className="text-sm font-semibold uppercase tracking-wide text-white mb-3">{children}</h3>;
}

function TierRow({ tier, last }) {
  return (
    <div className="relative pl-12 pb-5 last:pb-0">
      {/* connector rail + numbered node */}
      {!last && <div className="absolute left-[18px] top-9 bottom-0 w-px bg-sc-border" aria-hidden />}
      <div className="absolute left-0 top-0 w-9 h-9 rounded-lg bg-sc-surface border border-sc-accent/40 flex items-center justify-center">
        <span className="text-sc-accent font-bold tnum text-[13px]">{tier.n}</span>
      </div>

      <div className="bg-sc-card border border-sc-border rounded-xl p-3.5">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-semibold text-sc-accent uppercase tracking-wide">{tier.tag}</span>
          <span className="text-[13px] font-semibold text-white">{tier.title}</span>
        </div>
        <p className="text-[12px] leading-relaxed text-sc-dim">{tier.body}</p>
      </div>
    </div>
  );
}

function RegistryRow({ label, id, href, note, walrus }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-white/[0.02] transition group">
      <div className="min-w-0">
        <div className="text-[12px] text-sc-text font-medium truncate">{label}</div>
        {note && <div className="text-[10px] text-sc-muted truncate">{note}</div>}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[11px] font-mono text-sc-muted group-hover:text-sc-dim transition">{short(id)}</span>
        <span className={`text-[9px] font-semibold uppercase tracking-wide ${walrus ? 'text-sc-accent' : 'text-sc-dim'}`}>
          {walrus ? 'Walruscan' : 'Suiscan'} ↗
        </span>
      </div>
    </a>
  );
}

function DocCard({ doc }) {
  return (
    <a href={doc.href} target="_blank" rel="noopener noreferrer"
      className="block bg-sc-card border border-sc-border rounded-xl p-3.5 hover:border-sc-accent/50 hover:bg-white/[0.02] active:scale-[.99] transition group">
      <div className="flex items-center justify-between gap-2 mb-1">
        <span className="text-[13px] font-semibold text-white group-hover:text-sc-accent transition">{doc.title}</span>
        <span className="text-sc-muted group-hover:text-sc-accent transition text-[12px]">↗</span>
      </div>
      <p className="text-[11px] leading-relaxed text-sc-dim">{doc.desc}</p>
    </a>
  );
}
