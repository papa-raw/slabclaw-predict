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
// The evidence bundle referenced ONCHAIN by the live PROPOSED market — the strongest
// verification anchor: read market.evidence_blob_id on Suiscan, fetch this blob on
// Walrus, re-run the math.
const EVIDENCE_BLOB = 'Q2dlXakO8CMH3vL9BKJn60jL0Ac7uWN-jx8cSWosGRE';
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
    title: 'Source agents — nine independent venues',
    body: (
      <>
        Nine venue specialists each scrape their OWN marketplace — eBay, PriceCharting, Cardmarket, ALT,
        Goldin, Fanatics, PSA APR, Yahoo Auctions JP, TCGPlayer. Every observation is tagged{' '}
        <Term def="Realized = a completed sale. Ask = a live listing. Asks sit above the clearing price, so they bound the range but never vote in the settle.">realized sale vs live ask</Term>{' '}
        and written to MemWal. It gets sharper each run because three memories refine in MemWal:{' '}
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
        A contested price widens the dispute window instead of settling on a shaky number.
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
        Walrus evidence blob referenced onchain.
      </>
    ),
  },
];

// ── Docs hub (links use explicit index.html so they resolve in dev AND prod) ────
const DOCS = [
  { title: 'Deck', desc: 'The full story — architecture, MemWal, observable learning, evidence.', href: '/deck/index.html' },
  { title: 'Source code', desc: 'Move contracts, oracle bridge, swarm, frontend — all open.', href: REPO },
  { title: 'Live evidence on Walrus', desc: 'The latest published consensus bundle — re-run the math yourself.', href: `${WALRUSCAN}/${EVIDENCE_BLOB}` },
];

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

      {/* Pipeline — source → consensus → self-audit → chain */}
      <SectionTitle>The pipeline · source → consensus → chain</SectionTitle>
      <p className="text-[11px] text-sc-muted mb-3 -mt-1">Hover any underlined term for what it means.</p>
      <div className="relative mb-8">
        {TIERS.map((t, i) => (
          <TierRow key={t.n} tier={t} last={i === TIERS.length - 1} />
        ))}
      </div>

      {/* Running in production — the MemWal bootstrap is the live system, not a slide */}
      <SectionTitle>Running in production · memory that outlives its operator</SectionTitle>
      <div className="bg-sc-card border border-sc-border rounded-xl p-4 mb-10">
        <p className="text-[12px] leading-relaxed text-sc-dim mb-3">
          The swarm runs in two places, and <span className="text-sc-text font-medium">Walrus is the memory bus between them</span>.
          A data-plane node runs the full swarm where its marketplaces are reachable and snapshots the agents&rsquo;
          entire memory to Walrus every round. A serving node on independent infrastructure{' '}
          <Term def="node memwal-sync.mjs restore — fetches the latest memory snapshot blob from a Walrus aggregator and rebuilds the swarm's MemWal state from it. The serving node never needs the data-plane machine to be online.">restores
          that memory from Walrus</Term>{' '}
          before each 6-hour consensus round and serves the result as a public feed. Kill either machine and the
          other rebuilds the swarm&rsquo;s accumulated knowledge — price calibrations, source reputations, warm
          caches — from the blob. The dapp you&rsquo;re reading ships a build-time snapshot and{' '}
          <Term def="useLiveConsensus: the page fetches the production feed at load and swaps it in only if the full payload validates for every market — a partial or malformed payload is discarded whole, and the panel honestly labels itself 'live' or 'snapshot'.">upgrades
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

      {/* Why TinyFish */}
      <div className="bg-sc-card border border-sc-border rounded-xl p-4 mb-10">
        <div className="text-[10px] font-semibold text-sc-accent uppercase tracking-wide mb-1.5">Why TinyFish</div>
        <p className="text-[12px] leading-relaxed text-sc-dim">
          The source agents read prices through{' '}
          <a href="https://www.tinyfish.ai" target="_blank" rel="noopener noreferrer" className="text-sc-accent hover:underline">TinyFish</a>{' '}
          browser agents. Many venues — Cardmarket, Goldin, live Yahoo auction pages — are JavaScript-heavy
          single-page apps whose publicly-listed prices a plain HTTP fetch can’t read. TinyFish renders the
          real page in a browser and returns structured data from a plain-language goal, so the swarm reaches
          a wider set of genuinely independent, uncorrelated sources for its consensus.{' '}
          <a href="#legal" className="text-sc-accent hover:underline">Data &amp; sources →</a>
        </p>
      </div>

      {/* Onchain registry — verify it yourself */}
      <SectionTitle>Verify it yourself · onchain</SectionTitle>
      <div className="bg-sc-card border border-sc-border rounded-xl overflow-hidden mb-10">
        <div className="px-3 py-2 border-b border-sc-border flex items-center justify-between">
          <span className="text-[10px] font-semibold text-sc-dim uppercase tracking-wide">Sui testnet objects</span>
          <span className="text-[9px] font-mono text-sc-muted border border-sc-border rounded px-1 py-px">TESTNET</span>
        </div>
        <div className="divide-y divide-sc-border/60">
          <RegistryRow label="Package" id={PACKAGE_ID} href={obj(PACKAGE_ID)} note="market · oracle · resolution · registry" />
          <RegistryRow label="AssetRegistry" id={REGISTRY_ID} href={obj(REGISTRY_ID)} note="shared object" />
          <RegistryRow label="tUSD Faucet" id={FAUCET_ID} href={obj(FAUCET_ID)} note="mint test USD to trade" />
          {DEMO_MARKETS.map((m) => (
            <RegistryRow key={m.id} label={`Market · ${m.name}`} id={m.id} href={obj(m.id)}
              note={`${m.grader} ${m.grade} · strike $${(m.strikeUsdCents / 100000).toFixed(1)}k`} />
          ))}
          <RegistryRow label="Evidence blob" id={EVIDENCE_BLOB} href={`${WALRUSCAN}/${EVIDENCE_BLOB}`}
            note="latest consensus bundle on Walrus" walrus />
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
