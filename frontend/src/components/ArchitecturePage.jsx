/// ArchitecturePage — the "how it works + docs" page reached from the navbar (#architecture).
///
/// Two jobs: (1) make the pipeline legible — a memory-backed multi-agent oracle swarm
/// (source → consensus → self-audit → chain) that settles markets on Sui with verifiable
/// evidence on Walrus; (2) be the docs hub that links every piece of the work (deck,
/// swarm explainer, source code, track brief, onchain objects, live Walrus evidence).
///
/// Layout follows the design brief: pipeline as a numbered tier-flow (UMA pattern), docs as
/// a resource card grid (Walrus pattern), onchain registry as the "verify it yourself" block.
/// Aesthetic is the locked sc-* dark Bloomberg terminal — single gold accent, hairline
/// borders, tabular-nums. No gradients.

import { PACKAGE_ID, REGISTRY_ID, FAUCET_ID, EXPLORER_URL, DEMO_MARKETS } from '../constants';

const REPO = 'https://github.com/papa-raw/slabclaw-predict';
const WALRUSCAN = 'https://walruscan.com/testnet/blob';
const EVIDENCE_BLOB = 'UxI0mIQDb45JHJyJ1xVY38XPch7NN7Nh02MK3C_MmPM'; // latest published evidence bundle

const obj = (id) => `${EXPLORER_URL}/object/${id}`;
const short = (id) => `${id.slice(0, 10)}…${id.slice(-4)}`;

// ── The pipeline: source → consensus → self-audit → chain ──────────────────────
const TIERS = [
  {
    n: 1,
    tag: 'Tier 1',
    title: 'Source agents — nine independent venues',
    body: 'Nine venue specialists each scrape their OWN marketplace — eBay, PriceCharting, Cardmarket, ALT, Goldin, Fanatics, PSA APR, Yahoo Auctions JP, TCGPlayer. Every observation is tagged realized sale vs live ask and written to MemWal, so the swarm remembers comp history and gets sharper each run.',
    chips: ['realized vs ask', 'per-venue independence', 'MemWal memory', 'warm-cache fallback'],
  },
  {
    n: 2,
    tag: 'Tier 2',
    title: 'Coordinator — manipulation-resistant consensus',
    body: 'Same-origin feeds collapse to one family (eBay + PriceCharting = one vote). Outliers are MAD-rejected, thin wrong-variant grabs are caught by a cross-source plausibility gate, and the market settles on a confidence-weighted median of REALIZED sales only — asks bound the range but never vote.',
    chips: ['family dedup', 'MAD outlier rejection', 'anchor gate', 'realized-settles · asks-bound'],
  },
  {
    n: '2.5',
    tag: 'Tier 2.5',
    title: 'Self-audit — the swarm checks its own price',
    body: 'Each round reconciles the settle against the grade-matched PSA-10 oracle and runs grade-inversion + multiplier-divergence checks against the card’s LEARNED calibration in MemWal. A contested price widens the dispute window instead of settling on a shaky number.',
    chips: ['grade-inversion', 'multiplier-divergence', 'self-calibrating', 'dispute-widening'],
  },
  {
    n: 3,
    tag: 'Tier 3',
    title: 'Keeper — onchain settlement with evidence',
    body: 'A keeper proposes the resolution onchain on Sui with the evidence blob ID. A 24-hour optimistic dispute window (UMA-style) lets anyone challenge with a bond. No market can settle without a verifiable, PII-redacted Walrus evidence blob referenced onchain.',
    chips: ['Sui Move', 'optimistic 24h dispute', 'evidence-gated settlement', 'PII-redacted'],
  },
];

// ── Docs hub ──────────────────────────────────────────────────────────────────
const DOCS = [
  { title: 'Pitch deck', desc: 'The 60-second story — credibly-neutral price commons.', href: '/deck/', kind: 'page' },
  { title: 'Swarm explainer', desc: 'MemWal, shared context, verifiable evidence, observable learning.', href: '/explain/', kind: 'page' },
  { title: 'Source code', desc: 'Move contracts, oracle bridge, swarm, frontend — all open.', href: REPO, kind: 'ext' },
  { title: 'Walrus track brief', desc: 'The problem statement this is built against.', href: '/docs/walrus-track-problem-statement.pdf', kind: 'ext' },
  { title: 'Oracle source research', desc: 'The 10-platform source hierarchy + independence map.', href: '/docs/oracle-source-research.json', kind: 'ext' },
  { title: 'Live evidence on Walrus', desc: 'The latest published consensus bundle — re-run the math yourself.', href: `${WALRUSCAN}/${EVIDENCE_BLOB}`, kind: 'ext' },
];

export default function ArchitecturePage() {
  return (
    <main className="max-w-5xl mx-auto px-4 lg:px-6 py-7 pb-24">
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
          The market is the showcase; the agentic oracle is the deliverable.
        </p>
      </div>

      {/* Pipeline — source → consensus → self-audit → chain */}
      <SectionTitle>The pipeline · source → consensus → chain</SectionTitle>
      <div className="relative mb-10">
        {TIERS.map((t, i) => (
          <TierRow key={t.n} tier={t} last={i === TIERS.length - 1} />
        ))}
      </div>

      {/* Onchain registry — verify it yourself */}
      <SectionTitle>Verify it yourself · onchain</SectionTitle>
      <div className="bg-sc-card border border-sc-border rounded-xl overflow-hidden mb-3">
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
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-8">
        {DOCS.map((d) => <DocCard key={d.title} doc={d} />)}
      </div>

      {/* Built-on strip */}
      <div className="border-t border-sc-border/60 pt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-sc-muted">
        <span className="text-sc-dim font-semibold">Built on</span>
        {['Sui Move', 'Walrus', 'MemWal', 'TinyFish agents', '10-platform price oracle'].map((b, i) => (
          <span key={b} className="flex items-center gap-2">
            {i > 0 && <span className="text-sc-border">·</span>}
            <span>{b}</span>
          </span>
        ))}
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
        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {tier.chips.map((c) => (
            <span key={c} className="text-[10px] font-medium text-sc-dim bg-sc-surface border border-sc-border/60 rounded px-1.5 py-0.5">{c}</span>
          ))}
        </div>
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
  const external = doc.kind === 'ext';
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
