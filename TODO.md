# SlabClaw Predict — Next Steps (Walrus track)

> Goal: a **memory-backed multi-agent oracle swarm** (MemWal) that prices the four PSA-10 markets, persists learning across sessions, and stores verifiable evidence on Walrus. The prediction market is the showcase. Deadline: **Jun 21, 2026**.
>
> The deliverable that wins the track = Phases 1–2 (agents + MemWal memory). Everything else makes it legible and complete.

## Phase 0 — Foundations / accounts (½ day)
- [ ] Create a **MemWal (Walrus Memory)** account + delegate key for the agents (playground: memwal docs). Store key out of repo (read at runtime).
- [ ] Install **Walrus CLI** + confirm a testnet publisher/aggregator; do a hello-world blob `put`/`get`.
- [ ] Confirm **TinyFish** is the scrape transport (`tinyfish fetch/search`); fallback plan for bot-protected sources.
- [ ] Request **DUSDC?** — N/A (we settle in our own TEST_USD; no DeepBook). Skip.
- [ ] Pick the agent runtime: Node ESM in `oracle-bridge/` (matches existing bridge/sui-client). MemWal is ESM-only → `"type": "module"` already set.

## Phase 1 — The multi-agent oracle swarm (the core deliverable) (3–4 days)
One **source-specialist agent** per venue. Each: scrape → extract a per-card PSA-10 value → write to MemWal → report to aggregator.
- [ ] Agent framework: `oracle-bridge/agents/` — base agent (fetch, parse, validate, memory read/write, confidence self-score).
- [ ] **eBay / Fanatics-PWCC agent** — `sales-history.fanaticscollect.com` scrape (no auth; grade-matched last-sales; paid-only). Highest-signal raw comp.
- [ ] **Heritage agent** — `ha.com` archive (free-login HTML, 7.6M records, realized prices). → needs PDF/HTML resolver.
- [ ] **Goldin agent** — `goldin.co/results` weekly TCG/Pokémon realized prices (HTML).
- [ ] **ALT agent** — `alt.xyz` item/sold pages "ALT VALUE" point + range (Instant Pricer is app-gated; scrape the public sold/value page).
- [ ] **CardLadder agent** — last-sold / pop / market-cap / index (note: CardLadder Value is index-derived, weight accordingly).
- [ ] **Courtyard agent** — tokenized FMV / Algolia (best-effort; PSA-10 coverage is thin).
- [ ] **TCGplayer agent** — JP product-line comps (pokemon-japan slugs for the Umbreon JP card).
- [ ] **GemRate (pop) agent** — JSON Partner API for PSA/BGS/SGC/CGC population (scarcity input, not price).
- [ ] **Coordinator/aggregator** — collect agent outputs → manipulation-resistant consensus:
  - median-of-medians across sources
  - confidence-weighted median (per-agent self-score × source-reliability memory)
  - MAD outlier rejection (drop comps outside k·MAD)
  - recency weighting; min-source threshold (≥3 independent sources)
  - flag thin-market / wash-trade patterns → mark low-confidence
- [ ] **PDF smart-resolvers** — `oracle-bridge/resolvers/` parse auction-result PDFs (Heritage/Goldin/PWCC) into structured comps for the smart parser.
- [ ] Scope to the **4 products only**: `jp-vs-091`, `neo1-1st-18`, `base5-1st-83`, `base2-1st-3` (all PSA 10).

## Phase 2 — MemWal memory + Walrus evidence (2 days)  ← what the track judges
- [x] **Persistent agent memory on MemWal**: per-card price history, per-source reliability weights, seen manipulation patterns. Agents read memory on start (warm), write after each run → "smarter every run" (the track's "remember and build over time").
- [x] **Cross-agent shared context** on Walrus/MemWal: the coordinator reads each agent's latest memory; agents can read each other's (source-disagreement detection).
- [x] **Walrus evidence artifacts**: on each consensus, upload an evidence bundle (consensus price, contributing comps + sources + weights, timestamps, dispute basis) → blob ID. *(redacted of seller PII before publish — `redact.mjs`)*
- [x] **Onchain reference**: `propose_resolution` now takes `evidence_blob_id: vector<u8>` stored on `Market` + emitted in events; settlement aborts without it. **Proven onchain via `reseed-and-prove.mjs`.**
- [x] **MemWal Walrus persistence** (`memwal-sync.mjs`): full agent memory snapshots to Walrus after every run; cold-start restore from blob ID. Live: `puArzfwFivKREcWXy-ndLen8lhufJyoIDr_2nNGfXJc`. Integrated into `swarm.mjs`.
- [ ] Keeper memory: bridge remembers which markets it has proposed/finalized (idempotent, MemWal-backed).

## Phase 3 — Bridge + onchain wiring (½ day)
- [ ] Swap `fetchOraclePrice` to read the **swarm consensus** (not the single snapshot oracle) + attach the Walrus evidence blob ID.
- [ ] `bridge.mjs` proposes consensus price + sources + evidence ref at expiry.
- [ ] `demo.mjs` → **happy-path settlement demo** (short-expiry → seed → propose → finalize → claim) to pair with `create-disputed.mjs` (dispute path). *(deferred earlier)*

## Phase 4 — Frontend: make it legible (1–2 days)
- [ ] **Strip remaining DeepBook framing** from the app (hero/footer linter added a "DeepBook Predict" mention).
- [x] **Oracle-consensus panel** on the market page: per-source values, agreement, the agents' weights, "X of N sources agree." *(`OracleConsensusPanel.jsx`)*
- [x] **"View evidence on Walrus"** link in the resolution panel — Walruscan (human) + raw aggregator + Suiscan market object.
- [ ] **Agent-memory view**: show how the oracle's confidence/sources evolved over time (the "builds over time" story).
- [ ] /attack-driven UI: surface manipulation-resistance (e.g., "rejected N outliers", thin-market warning).
- [ ] Reframe hero copy around the agentic oracle (not just "10-platform oracle").

## Phase 5 — Adversarial hardening (`/attack`) (½ day)
- [x] Run `/attack` on the oracle: enumerate attacks (single-source spoof, wash trade, thin-market push, stale-feed, seller-concentration, outlier injection, Sybil sources). *(`oracle-bridge/test/attack.test.mjs`, 9 scenarios)*
- [x] Verify the aggregator defends each; add tests / a kill-switch on source disagreement. *(MAD rejection, ≥3-source gate, wide-disagreement block)*
- [ ] Document the threat model + defenses (great for judges + the Walrus "trust" angle).

## Phase 6 — Submission essentials (1–2 days)
- [ ] **End-to-end test** of the full flow (the brief: "we will test the entire flow"): connect wallet → faucet tUSD → trade → swarm prices → bridge proposes → dispute/finalize → claim → evidence on Walrus.
- [ ] **Deploy the frontend** — consider **Walrus Sites** (`site-builder publish frontend/dist`) for an extra Walrus signal.
- [ ] **Demo video** (≤ 5 min): the agents remembering/coordinating, a real resolution + the Walrus evidence blob.
- [ ] **DeepSurge submission**: name, logo (1:1), public repo, demo video, deployment. Track = **Walrus**.
- [ ] README: flip Phase-1/2 🚧 rows to ✅ as they land; add demo-video + live-site links.

## Cleanup / tech-debt (rolling)
- [ ] Get the hackathon folder fully clean in git (done — papa-raw/slabclaw-predict).
- [ ] Remove dead/unused files; ensure `sui move test` (16/16) + frontend build stay green.
- [ ] Backend `:3456` hangs intermittently — bridge already falls back to snapshot; keep that resilience.
- [ ] Keep "onchain" (one word) in all copy.

---

### Critical path to qualify
**Phase 1 (swarm) + Phase 2 (MemWal memory) + a working end-to-end resolution.** That's the minimum that genuinely uses Walrus/MemWal as agent memory and shows agents that remember and build over time. Phases 3–4 make it demoable; 5–6 win it.
