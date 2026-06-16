<p align="center">
  <img src="docs/assets/logo.png" width="118" alt="SlabClaw Predict" />
</p>

<h1 align="center">SlabClaw Predict</h1>

<p align="center">
  Prediction markets on real-world collectibles, settled on Sui by a memory-backed,<br/>
  manipulation-resistant oracle swarm whose memory lives on Walrus.
</p>

<p align="center">
  <a href="https://slabclaw.com"><b>Live dapp</b></a> ·
  <a href="https://youtu.be/JXZdWjfkybU"><b>Demo video</b></a> ·
  <a href="https://www.deepsurge.xyz/projects/1989fce1-ddb4-4a78-992b-a98c4fc6286d">DeepSurge</a> ·
  <a href="https://slabclaw.com/deck">Deck</a> ·
  <a href="docs/SlabClaw-Predict-Journey.pdf">The journey</a> ·
  <a href="https://api.slabclaw.com/predict/consensus">Live feed</a> ·
  <a href="https://api.slabclaw.com/predict/health">Health</a>
</p>

<p align="center"><sub>Sui Overflow 2026 · Walrus Track</sub></p>

---

> *"Will a PSA 10 Karen's Umbreon close above $15,000 by October 1, 2026?"* You trade YES or NO onchain. The market settles against a real price—the agreement of 13 source agents across 11 independent venue families.

## The one-liner

Anyone can trade YES/NO on whether a graded card exceeds a strike price by expiry. The market resolves against a **real price** computed by a **swarm of 13 source-specialist agents across 11 independent venue families**. They read every major collectibles venue, **remember** each card's history and past manipulation attempts across sessions (persisted on **MemWal / Walrus Memory**), agree on a manipulation-resistant consensus, and publish their evidence as verifiable artifacts on **Walrus**.

The prediction market is the user-facing application; the memory-backed oracle swarm is the system that settles it.

## Why this is a Walrus project

The Walrus track asks for *AI agents / agentic workflows with long-term memory (MemWal), long-running workflows where agents track state over time, and artifact-driven workflows.* Our oracle is exactly that:

- **Multi-agent (13 specialists, 11 independent venue families)**—one agent per marketplace source (eBay-origin feeds like PriceCharting and 130point collapse into a single voting family, so correlated tapes never inflate the count). Each agent knows its platform's data format, pricing patterns, and failure modes.
- **Long-running + stateful**—agents continuously monitor prices and **remember**: per-card comp history, source reliability weights (evolving over rounds), and previously-detected manipulation patterns. Kill the process and restart it; the memory persists via MemWal.
- **Coordinated**—agents reconcile heterogeneous inputs (sold comps, active listings, auction results, tokenized FMV) into one consensus via **confidence-weighted median + MAD outlier rejection**, with circuit breakers that block proposals when sources disagree.
- **Artifact-driven**—every consensus round emits an evidence bundle on **Walrus** containing all inputs, weights, rejections, and aggregation math. Disputes are nearly self-resolving: download the blob, re-run the computation, verify.

This is durable, multi-agent memory applied to the graded-card secondary market (order of magnitude $2B/yr), which has had no onchain price reference.

## Settlement contract — formal verification

The two settlement functions (`compute_payout` and `yes_price_bps`) are verified with the [Sui Prover](https://github.com/asymptotic-code/sui-prover) (Z3 + Boogie), which checks the following properties for all inputs in their domain:

- **Solvency** — a winner's payout is always `≤` the pool.
- **No truncation** — the `u128 → u64` payout narrowing is lossless.
- **Bounded probability** — the YES price stays within `[0, 10000]` bps, with no arithmetic overflow.

The contract also has a 40-item security review (all findings addressed), 31/31 Move tests, onchain version gating for upgrades, and governance-set economic parameters (dispute bond, dispute window, source floor). Write-up: [`docs/FORMAL-VERIFICATION.md`](docs/FORMAL-VERIFICATION.md). Reproduce: `cd contracts/slabclaw_predict_proofs && sui-prover`.

## What's new for this hackathon

SlabClaw is an existing collectibles app, so to be clear about what predates the May 7 – Jun 21 window: the only pre-existing pieces are the **product registry** (the 5,167-card catalog with cross-grader normalization) and a single-source **PriceCharting-average + eBay-fallback** price feed. Everything that makes this a Sui + Walrus project—and everything that makes the oracle an *oracle*—was built during the hackathon:

- **The independent multi-source oracle swarm**—the 13 source-specialist agents, including 7 venue-direct agents we integrated this window (PSA APR, Goldin, Fanatics, ALT, Cardmarket, Yahoo Auctions JP, 130point), plus the coordinator's family-independence counting, MAD + anchor gates, thin_market settlement, cross-session memory, and reputation weighting. The old feed was one averaged source; the manipulation-resistant, memory-backed consensus is new.
- **All Move contracts**—`market` (with the dispute/resolution flow), `oracle`, `registry`, `memory` (the onchain SwarmMemory anchor), `test_usd`, and the governance `ProtocolConfig`—plus **Sui Prover formal verification** of the settlement math and a 40-check security review (31/31 Move tests).
- **MemWal / Walrus Memory persistence**—per-agent card memory, the kill-and-restore memory loop, and the two-node production topology with **Walrus as the memory bus**.
- **The Walrus evidence layer**—every consensus round uploaded as a verifiable, onchain-anchored blob.
- **The full React prediction-market dapp**—browse, faucet, trade YES/NO, oracle-vs-strike charts, the registry ladder, and the dispute/resolution flow.

How this got from an autonomous agent swarm (*Anima Swarm*) to a DeepBook prediction market to the Walrus-track oracle it is now—and why every pivot kept the same core—is in **[the pivot journey](docs/SlabClaw-Predict-Journey.pdf)**.

## Architecture

<p align="center">
  <img src="docs/assets/architecture.png" width="860" alt="Three tiers: source agents to a manipulation-resistant coordinator to Walrus and Sui" />
</p>

The same three tiers, with the coordinator's gates spelled out:

```
TIER 1: Source Specialists (13 agents, parallel)
  Registry-fed (6): eBay · PriceCharting ─┐  Read SlabClaw's registry API
    Courtyard · TCGPlayer · Beezie ·      │  → platform-specific filtering
    Collector Crypt                       │  → local circuit breakers (price
  Venue-direct (7): PSA APR · Goldin ·    ├─ jump, stale feed, seller
    Fanatics · ALT.xyz · Cardmarket ·     │  concentration, zero price)
    Yahoo Auctions JP · 130point          │  → writes signal to MemWal
  (eBay + PriceCharting + 130point share ─┘  one eBay-origin voting family)

         │ all signals → shared/agent-signals/latest.json
         ▼
TIER 2: Coordinator (1 agent, sequential)
  1. Source-count gate (≥2 independent sold-families; ≥3 = full
     confidence. Exactly 2 families whose medians agree within ±30%
     settle as thin_market with a 3× dispute window; <2 families or
     disagreement → insufficient_sources, blocked)
  2. MAD outlier rejection (modified Z-score, threshold 3.5)
  3. Confidence-weighted median (weight = confidence × reliability × recency)
  4. Cross-source anchor/plausibility gate + family corroboration within ±30%
  5. Evidence bundle → Walrus blob

         │ consensus → shared/consensus/latest.json
         ▼
TIER 3: Bridge Keeper (conditional)
  Read consensus → quality gates → propose_resolution onchain
  Reference Walrus evidence blob ID in the proposal
```

### How it works

1. **Market**—a binary prediction: exact product (set · number · grader · grade), strike, expiry.
2. **Trade**—buy YES or NO with **tUSD** (faucet-minted test USD); parimutuel pool.
3. **Oracle swarm runs**—13 agents fetch live marketplace data, coordinator aggregates, evidence uploads to Walrus.
4. **Settle**—after expiry the bridge keeper proposes the consensus price onchain (if quality gates pass).
5. **Dispute**—24h base window, 3× extended for thin_market (rare-card) settlements; anyone can challenge with a tUSD bond. Evidence on Walrus makes disputes nearly self-resolving.
6. **Claim**—undisputed → auto-finalize; winners claim from the pool.

## What's live

<p align="center">
  <img src="docs/assets/dapp.png" width="880" alt="The SlabClaw Predict dapp: four live markets with YES/NO odds and oracle prices, and a market in community-voting dispute" />
</p>

| Component | Status |
|---|---|
| Move contracts (`market`, `oracle`, `registry`, `memory`, `test_usd`) on Sui testnet | ✅ deployed |
| 3 ACTIVE + 1 DISPUTED (Dark Raichu—challenged onchain, evidence on Walrus) markets | ✅ live |
| React dapp—browse, faucet tUSD, buy YES/NO, oracle-vs-strike chart, registry ladder, dispute/resolution flow | ✅ working |
| **Oracle swarm**—13 source agents (11 venue families) + coordinator + bridge keeper | ✅ working |
| **MemWal persistence**—per-agent card memory, shared signals, reputation weights | ✅ working |
| **Walrus evidence**—every consensus round uploaded as verifiable blob | ✅ working |
| **Frontend Oracle Swarm panel**—per-source signals, weights, confidence interval, reliability chart | ✅ working |
| **Seeded history**—10 rounds demonstrating learning (reliability divergence, CI narrowing, manipulation detection) | ✅ working |
| Single-source oracle bridge (`bridge.mjs`) + offline snapshot fallback | ✅ working |
| Swarm-powered bridge (`bridge-swarm.mjs`)—replaces single-source with multi-agent consensus | ✅ working |
| **Production deployment**—[slabclaw.com](https://slabclaw.com) + a data-plane node running the full swarm, publishing consensus to an independent serving node | ✅ live |
| **Walrus memory bus**—serving node restores full agent memory from Walrus before every round | ✅ live |
| **Live consensus feed**—[`/predict/consensus`](https://api.slabclaw.com/predict/consensus) + [`/predict/health`](https://api.slabclaw.com/predict/health) | ✅ live |

## MCP server — query the oracle from any agent

[`oracle-bridge/mcp-server.mjs`](oracle-bridge/mcp-server.mjs) is a Model Context Protocol server that exposes the oracle to any MCP client (Claude Desktop, Cursor, etc.). A connected agent can query a card's consensus price, list the live markets, or re-verify a Walrus evidence blob. It reads the public `/predict/consensus` feed and needs no keys.

| Tool | Returns |
|---|---|
| `get_card_price(card)` | consensus price + confidence band + per-source learned trust + evidence blob |
| `list_markets()` | the live prediction markets (strike, consensus, onchain object) |
| `get_market(card)` | one market: strike, implied YES/NO, onchain state, evidence |
| `verify_evidence(blobId)` | re-runs the aggregation on the Walrus blob and returns the recomputed price |

```json
{ "mcpServers": { "slabclaw-oracle": { "command": "node", "args": ["/abs/path/oracle-bridge/mcp-server.mjs"] } } }
```

## Key deliverables

### Oracle Swarm (Walrus track)

| File | What it does |
|---|---|
| `oracle-bridge/agents/base-agent.mjs` | Base class: MemWal I/O, circuit breakers, signal normalization |
| `oracle-bridge/agents/*.mjs` | Registry-fed source agents (eBay, PriceCharting, Courtyard, TCGPlayer, Beezie, Collector Crypt) |
| `oracle-bridge/tinyfish-agents.mjs` + `point130.mjs` + `yahoo-jp-tinyfish.mjs` | Venue-direct agents (PSA APR, Goldin, Fanatics, ALT, Cardmarket, Yahoo JP, 130point) |
| `oracle-bridge/agents/coordinator.mjs` | MAD outlier rejection → confidence-weighted median → evidence bundle |
| `oracle-bridge/swarm.mjs` | Orchestrator: runs all agents in parallel → coordinator → Walrus upload |
| `oracle-bridge/bridge-swarm.mjs` | Swarm-powered bridge: agents → consensus → onchain proposal |
| `oracle-bridge/walrus-evidence.mjs` | Upload/read evidence bundles on Walrus testnet |
| `oracle-bridge/seed-history.mjs` | Generate 10 rounds of realistic MemWal history for demo |
| `oracle-bridge/memwal-sync.mjs` | Walrus-backed MemWal persistence: snapshot/restore agent memory |
| `oracle-bridge/memwal/` | MemWal persistence: per-agent memory, shared context, consensus history |

### MemWal Persistence on Walrus

After every swarm run, the full memory state (per-card observations, reputation weights, anomaly history, and the consensus) is snapshotted to a Walrus blob. On cold start the swarm restores from the latest snapshot.

The latest snapshot blob ID is in the live feed: [`/predict/health`](https://api.slabclaw.com/predict/health) · an onchain-referenced example: [`2zQcELz2…`](https://walruscan.com/testnet/blob/2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA)

### Evidence on Walrus

Every swarm run uploads a complete evidence bundle to Walrus containing:
- All agents' signals (price, confidence, comp count, source)
- MAD z-scores for every rejected outlier
- Confidence-weighted median computation
- Source reliability weights (evolving over rounds)
- Card-by-card consensus with confidence intervals

Each round's evidence blob ID ships inside [`/predict/consensus`](https://api.slabclaw.com/predict/consensus) (`evidence.blobId` per card); the one referenced ONCHAIN by the live DISPUTED market (challenged against this very evidence): [verify on Walruscan →](https://walruscan.com/testnet/blob/2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA)

### Learning over time

Three behaviors, all visible in the dapp's reliability chart (*the 10 bootstrap rounds below are simulated via `seed-history.mjs` and labeled as such—production rounds accumulate live every 6 hours*):

1. **Source reliability divergence**—Round 1: all sources weight 1.0. Round 10: eBay 96%, collector-crypt 49%. The swarm learns which sources to trust.
2. **Confidence interval narrowing**—Round 1: ±25%. Round 10: ±4%. More data = tighter consensus.
3. **Anomaly memory**—Round 5: manipulation detected (fake 4x price signal). Round 6+: that source is pre-weighted down. The swarm remembers attacks.

Each source row in the dapp shows its *learned* trust—e.g. "41% trust · learned over 158 rounds"—so the memory is legible, not a static number.

### Manipulation handling — reproducible proof

[`prove-learning-loop.mjs pricecharting neo1-1st-18 --rounds=8`](oracle-bridge/prove-learning-loop.mjs) runs the pipeline through a baseline → attack → memory → persist sequence on an active market (Typhlosion):

```
0. BASELINE   honest round → Typhlosion consensus $5,040, PriceCharting trust 91.7%
1. ATTACK     PriceCharting — the swarm's MOST-trusted source — posts a 3× wash
              trade ($16,050), 8 rounds:
              every spoof REJECTED (MAD z=9.49) · consensus never moves (0.0%)
              trust erodes 91.7 → 86.8% — even the most-trusted source is penalized
2. MEMORY     PriceCharting behaves again — but is trusted LESS than before it lied
3. PERSIST    snapshot → Walrus → destroy memory → restore from the blob alone
              the grudge survived: ~87% trust came back from Walrus
```

PASS requires all four conditions: the spoof is rejected, the source's trust drops, consensus is unchanged, and the lowered trust survives a snapshot/restore through Walrus. The invariants are checked in [`test/learning-loop.test.mjs`](oracle-bridge/test/learning-loop.test.mjs). (The proofs read the committed MemWal state, so run them from a clean checkout to reproduce the exact figures above.)

## Running in production

The swarm runs as a two-node system with **Walrus as the memory bus**:

- **Data-plane node** — runs the full swarm where its marketplaces are reachable (a residential IP), snapshots the agents' memory (price calibrations, source reputations, warm caches) to Walrus each round, and writes the snapshot blob id onchain (`memory::checkpoint` on the shared [`SwarmMemory`](https://suiscan.xyz/testnet/object/0xf31c41b1b68b6607fa68ef504e9332b129825957d21294f9483e6805214c8883) object, the same mechanism used for settlement evidence).
- **Serving node** (separate machine, holds no Sui key) — resolves the pointer from chain, restores the agent memory from Walrus, and serves the published rounds at [`/predict/consensus`](https://api.slabclaw.com/predict/consensus). A keeper on this node recomputes consensus from the restored memory on a schedule (no scraping), so the feed stays current even when the data-plane node is offline. [`/predict/health`](https://api.slabclaw.com/predict/health) reports `memory.restoredFromBlobId` and `memory.pointerSource: "onchain"`.

Because the memory is recoverable from chain plus Walrus, either node can rebuild the swarm's state if the other is lost. `node oracle-bridge/prove-memory-loop.mjs` demonstrates this: it snapshots the memory to Walrus, deletes the local copy, restores it from the blob, and checks that consensus is byte-identical (it also prints the onchain memory pointer; the script is sandboxed and leaves the working tree unchanged). The dapp at [slabclaw.com](https://slabclaw.com) ships a build-time snapshot and switches to the live feed when reachable; each oracle panel is labelled `live` or `snapshot`.

Settlement is not autonomous: consensus rounds are computed and published continuously, but onchain resolution proposals are operator-signed. The optimistic dispute window remains in place regardless.

## Live testnet deployment

| | |
|---|---|
| Package (hardened + formally verified) | [`0x616ef59e…ce2bd76`](https://suiscan.xyz/testnet/object/0x616ef59e783935b976db451f4a7087e89ac1c76190c3f91e929226ba3ce2bd76) |
| AssetRegistry | [`0x3295fe9c…7829859`](https://suiscan.xyz/testnet/object/0x3295fe9c7c40f4dbe7560f4d988c3bf1bb7e7f4ea5c8cc9c862b97b1b7829859) |
| ProtocolConfig (governance) | [`0xa88ad739…fb26956`](https://suiscan.xyz/testnet/object/0xa88ad739248cbea400254ad91c63d0b8551e470e76d98fa3bd9ec3034fb26956) |
| SwarmMemory (onchain memory pointer, v2 `memory` module) | [`0xf31c41b1…214c8883`](https://suiscan.xyz/testnet/object/0xf31c41b1b68b6607fa68ef504e9332b129825957d21294f9483e6805214c8883) |
| tUSD Faucet | [`0x430c1d7e…f7f3b8b`](https://suiscan.xyz/testnet/object/0x430c1d7ed1c5ab589b73530db09122b7820a4767a9329db3044143fb9f7f3b8b) |

| Market (PSA 10) | Strike | State | Market ID |
|---|---|---|---|
| Typhlosion (Neo Genesis, 1st Ed) | $4,000 | ACTIVE | [`0xa0d4021e…8c001ae`](https://suiscan.xyz/testnet/object/0xa0d4021e89140c8d1fe6ccacca596e1c72e22281fa49fff22bbff54ac8c001ae) |
| Karen's Umbreon (VS, 1st Ed) | $15,000 | ACTIVE | [`0x3cb150d1…d3c0bad`](https://suiscan.xyz/testnet/object/0x3cb150d18f5a7cc1764c1ec52eac41d2905bfc47cde2bb075d217ef49d3c0bad) |
| Flareon (Jungle, 1st Ed) | $2,500 | ACTIVE | [`0x1750bdd1…6d503788`](https://suiscan.xyz/testnet/object/0x1750bdd11a60f777716a15d54e48caff8ae4d6baca94124c5bf0223a6d503788) |
| Dark Raichu (Team Rocket, 1st Ed) | $6,000 | DISPUTED + [evidence on Walrus](https://walruscan.com/testnet/blob/2zQcELz2C5jSG2smR8Z9y5EKlPdRM0LpdKqZ7hFogsA) | [`0xb8f87516…374af12`](https://suiscan.xyz/testnet/object/0xb8f8751687f1f71eb6f81a7122bdb13a9db7fa0da036203355385d6f4374af12) |

## Run it

```bash
# Frontend (dapp)
cd frontend && npm install && npm run dev        # http://localhost:5174

# Oracle swarm — run all 13 agents + coordinator + Walrus upload
cd oracle-bridge && npm install  # installs @mysten/sui (required before any script below)
node seed-history.mjs --clean    # seed 10 rounds of MemWal history (simulated bootstrap)
node swarm.mjs                   # one-shot: all agents → consensus → Walrus
# Data sources (graceful degradation, in order of what you have):
#   SLABCLAW_API=<url>           # registry backend for the 6 registry-fed agents
#                                # (defaults to http://localhost:3456; without it those
#                                # agents fall back to the warm MemWal cache restored above)
#   tinyfish CLI + credits       # the 7 venue-direct agents (fast path)
#   npm i patchright             # credit-free browser fallback for those agents
#                                # (130point + direct venue scrapes); without either
#                                # browser or tinyfish, the venue-direct agents skip
# With none of these, the swarm still produces consensus from restored MemWal memory —
# that degradation IS the memory thesis (see /predict/health for the live deployment).
node swarm.mjs --verbose         # with per-agent detail
node swarm.mjs --watch           # poll every 300s

# Swarm-powered bridge — agents + consensus + onchain proposal
node bridge-swarm.mjs            # one pass
node bridge-swarm.mjs --watch    # keeper daemon

# Walrus evidence
node walrus-evidence.mjs upload  # upload latest evidence bundle
node walrus-evidence.mjs log     # list all uploaded blobs

# MemWal persistence (Walrus-backed agent memory)
node memwal-sync.mjs snapshot    # snapshot memory to Walrus
node memwal-sync.mjs restore     # restore from latest Walrus snapshot
node memwal-sync.mjs log         # list all memory snapshots

# Legacy single-source bridge
node bridge.mjs --dry            # status only
node bridge.mjs --watch          # keeper daemon

# Full lifecycle E2E — all 4 products through create → trade → expire →
# propose (honest refusal below the 2-family thin_market floor) → dispute/finalize →
# claim → refund paths, on fresh testnet markets with real consensus + evidence (every stage, all 4 products)
node e2e-lifecycle.mjs

# Tests
cd oracle-bridge && npm test                     # 62 JS tests (coordinator · walrus · wiring · attack · redact · learning loop)
cd contracts/slabclaw_predict && sui move test   # 31 Move tests

# Kill-and-restore proof — snapshot memory to Walrus, destroy it, rebuild from
# the blob, prove consensus returns byte-identical (sandboxed; leaves tree clean)
node oracle-bridge/prove-memory-loop.mjs
```

## Project structure

```
contracts/slabclaw_predict/      Move: market · oracle · registry · memory · test_usd
oracle-bridge/
  agents/                        source agents + coordinator
    base-agent.mjs               MemWal I/O, circuit breakers, signal normalization
    ebay-agent.mjs               eBay sold comps + active listings
    pricecharting-agent.mjs      PriceCharting scraped sold data
    courtyard-agent.mjs          Courtyard tokenized FMV
    tcgplayer-agent.mjs          TCGPlayer active listings
    alt-agent.mjs                ALT.xyz sold transactions
    cardmarket-agent.mjs         Cardmarket EU listings
    beezie-agent.mjs             Beezie/OpenSea tokenized (Base chain)
    collector-crypt-agent.mjs    Collector Crypt/MagicEden (Solana)
    goldin-agent.mjs             Goldin realized auction prices
    coordinator.mjs              Aggregation: families → MAD → weighted median → evidence
  tinyfish-agents.mjs            Venue-direct agents (PSA APR, Goldin, Fanatics, ALT, Cardmarket, Yahoo JP, 130point)
  fanatics-scraper.mjs           Fanatics Collect / PWCC deterministic-DOM realized scraper
  point130.mjs                   130point sold-comps scraper (headed stealth browser)
  yahoo-jp-tinyfish.mjs          Yahoo Auctions JP closed-auction scraper
  swarm.mjs                      Orchestrator (all agents → coordinator → Walrus)
  bridge-swarm.mjs               Swarm-powered onchain bridge
  serve-consensus.mjs            Production /predict/* API (consensus · signals · health)
  memwal-sync.mjs                Walrus-backed memory persistence (snapshot/restore)
  walrus-evidence.mjs            Walrus upload/read/log
  seed-history.mjs               Demo history generator (simulated bootstrap rounds)
  memwal/                        MemWal persistence root
  bridge.mjs                     Legacy single-source bridge
frontend/                        React + Vite + @mysten/dapp-kit
  src/components/
    OracleConsensusPanel.jsx     Swarm consensus visualization (realized vs asks, evidence links)
    MarketDetail.jsx             Market detail with Oracle Swarm tab
  src/hooks/useLiveConsensus.js  Live production feed with atomic baked-snapshot fallback
docs/                            Walrus problem statement · the pivot journey · formal verification · oracle-source research
```

## Manipulation resistance

<p align="center">
  <img src="docs/assets/manipulation.png" width="820" alt="Manipulation defenses at each source, in aggregation, and onchain" />
</p>

| Attack | Cost to attacker | Defense | Outcome |
|---|---|---|---|
| Single-source spoof | One fake listing, rejected by MAD | MAD rejection (1 of 11 families) | Caught & filtered |
| Multi-source coordination | Requires faking realized sales across multiple independent marketplaces at once | New signals carry no earned reputation weight (EMA reliability, `coordinator.mjs:112-126`) + MAD outlier rejection (modified-z, threshold 3.5) + cross-source anchor/plausibility gate + one-vote-per-family collapse | High cost, detectable |
| Agent compromise | Variable | Transparent aggregation on Walrus = anyone verifies | Provably detectable |
| Coordinator compromise | Key access | Evidence blob = re-computable math | Provably fraudulent |

The parimutuel structure adds constraints: every buy grows the pool (so wash trading does not move the odds in the trader's favour), capital is locked until resolution (no flash-loan attack), and the settlement price can only be moved by faking realized sales across several independent marketplaces at once.

## Tech stack

Sui Move (2024 edition) · React + Vite + Tailwind · `@mysten/dapp-kit` (wallet + signing) · `@mysten/sui` (RPC) · Walrus / MemWal (agent memory + evidence) · SlabClaw backend (10-platform registry API, 5,167 products).

## License

All rights reserved. This repository is public for hackathon judging purposes only. No license is granted to use, copy, modify, or distribute this code without explicit written permission from the author.

---

*Built by [paparaw.eth](https://x.com/papa_raw) · Ecofrontiers SARL. Testnet only; identifiers change at mainnet.*
