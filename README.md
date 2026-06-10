# SlabClaw Predict

**Prediction markets on real-world collectibles, settled on Sui — priced by a memory-backed, manipulation-resistant multi-agent oracle swarm.**

> *"Will PSA 10 Karen's Umbreon exceed $15,000 by October 1, 2026?"* — YES/NO, onchain, settled against real marketplace data from 13 source agents across 11 independent venue families.

**Sui Overflow 2026 · Walrus track** — memory-backed agents / MemWal

**Live:** [slabclaw.com](https://slabclaw.com) · [live consensus feed](https://api.slabclaw.com/predict/consensus) · [feed health](https://api.slabclaw.com/predict/health)

---

## The one-liner

Anyone can trade YES/NO on whether a graded card exceeds a strike price by expiry. The market resolves against a **real price** — not a single feed, but a **swarm of 13 source-specialist agents across 11 independent venue families** that reads every major collectibles venue, **remember** each card's history and past manipulation attempts across sessions (persisted on **MemWal / Walrus Memory**), coordinate to a manipulation-resistant consensus, and store their evidence as verifiable artifacts on **Walrus**.

The prediction market is the showcase. **The agentic, memory-backed oracle is the product.**

## Why this is a Walrus project

The Walrus track asks for *AI agents / agentic workflows with long-term memory (MemWal), long-running workflows where agents track state over time, and artifact-driven workflows.* Our oracle is exactly that:

- **Multi-agent (13 specialists, 11 independent venue families)** — one agent per marketplace source (eBay-origin feeds like PriceCharting and 130point collapse into a single voting family, so correlated tapes never inflate the count). Each agent knows its platform's data format, pricing patterns, and failure modes.
- **Long-running + stateful** — agents continuously monitor prices and **remember**: per-card comp history, source reliability weights (evolving over rounds), and previously-detected manipulation patterns. Kill the process, restart — memory persists via MemWal.
- **Coordinated** — agents reconcile heterogeneous inputs (sold comps, active listings, auction results, tokenized FMV) into one consensus via **confidence-weighted median + MAD outlier rejection**, with circuit breakers that block proposals when sources disagree.
- **Artifact-driven** — every consensus round emits an evidence bundle on **Walrus** containing all inputs, weights, rejections, and aggregation math. Disputes are nearly self-resolving: download the blob, re-run the computation, verify.

This is durable, portable, multi-agent memory — applied to a real $2B+/yr market that has never had a trustworthy onchain price.

## Provably solvent — the settlement contract is formally verified

Most hackathon contracts are *tested*. SlabClaw Predict's settlement math is **proven**: the two functions that move money are machine-checked by the [Sui Prover](https://github.com/asymptotic-code/sui-prover) (Z3 + Boogie) to hold for *every* input, not just the cases a unit test happens to try.

- **Solvency** — a winner's payout is always `≤` the pool. No claim can ever overdraw the market.
- **No silent truncation** — the `u128 → u64` payout narrowing is proven lossless.
- **Bounded probability** — the YES price is always a valid `[0–10000]` bps, and provably overflow-safe.

Behind that: a 40-check security review with every finding root-caused and fixed, **28/28 Move tests green**, onchain version-gating for safe upgrades, and governance-tunable economic parameters. Full writeup in [`docs/FORMAL-VERIFICATION.md`](docs/FORMAL-VERIFICATION.md); reproduce with `cd contracts/slabclaw_predict_proofs && sui-prover`.

## Architecture

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
  1. Source-count gate (≥3 independent sources)
  2. MAD outlier rejection (modified Z-score, threshold 3.5)
  3. Confidence-weighted median (weight = confidence × reliability × recency)
  4. Aggregator circuit breakers (disagreement >40% blocks proposal)
  5. Evidence bundle → Walrus blob

         │ consensus → shared/consensus/latest.json
         ▼
TIER 3: Bridge Keeper (conditional)
  Read consensus → quality gates → propose_resolution onchain
  Reference Walrus evidence blob ID in the proposal
```

### How it works

1. **Market** — a binary prediction: exact product (set · number · grader · grade), strike, expiry.
2. **Trade** — buy YES or NO with **tUSD** (faucet-minted test USD); parimutuel pool.
3. **Oracle swarm runs** — 13 agents fetch live marketplace data, coordinator aggregates, evidence uploads to Walrus.
4. **Settle** — after expiry the bridge keeper proposes the consensus price onchain (if quality gates pass).
5. **Dispute** — 24h window; anyone can challenge with a tUSD bond. Evidence on Walrus makes disputes nearly self-resolving.
6. **Claim** — undisputed → auto-finalize; winners claim from the pool.

## What's live

| Component | Status |
|---|---|
| Move contracts (`market`, `oracle`, `registry`, `test_usd`) on Sui testnet | ✅ deployed |
| 4 PSA-10 markets seeded with positions | ✅ live |
| React dapp — browse, faucet tUSD, buy YES/NO, oracle-vs-strike chart, registry ladder, dispute/resolution flow | ✅ working |
| **Oracle swarm** — 13 source agents (11 venue families) + coordinator + bridge keeper | ✅ working |
| **MemWal persistence** — per-agent card memory, shared signals, reputation weights | ✅ working |
| **Walrus evidence** — every consensus round uploaded as verifiable blob | ✅ working |
| **Frontend Oracle Swarm panel** — per-source signals, weights, confidence interval, reliability chart | ✅ working |
| **Seeded history** — 10 rounds demonstrating learning (reliability divergence, CI narrowing, manipulation detection) | ✅ working |
| Single-source oracle bridge (`bridge.mjs`) + offline snapshot fallback | ✅ working |
| Swarm-powered bridge (`bridge-swarm.mjs`) — replaces single-source with multi-agent consensus | ✅ working |
| **Production deployment** — [slabclaw.com](https://slabclaw.com) + 6-hour swarm rounds on a serving node | ✅ live |
| **Walrus memory bus** — serving node restores full agent memory from Walrus before every round | ✅ live |
| **Live consensus feed** — [`/predict/consensus`](https://api.slabclaw.com/predict/consensus) + honest [`/predict/health`](https://api.slabclaw.com/predict/health) | ✅ live |

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

Agent memory doesn't just survive process restarts — it lives on Walrus. After every swarm run, the full memory state (78 files: per-card observations, reputation weights, anomaly history, consensus) is snapshotted to a Walrus blob. On cold start, the swarm restores from the latest snapshot automatically.

The latest snapshot blob ID is in the live feed: [`/predict/health`](https://api.slabclaw.com/predict/health) · an onchain-referenced example: [`Q2dlXakO…`](https://walruscan.com/testnet/blob/Q2dlXakO8CMH3vL9BKJn60jL0Ac7uWN-jx8cSWosGRE)

### Evidence on Walrus

Every swarm run uploads a complete evidence bundle to Walrus containing:
- All agents' signals (price, confidence, comp count, source)
- MAD z-scores for every rejected outlier
- Confidence-weighted median computation
- Source reliability weights (evolving over rounds)
- Card-by-card consensus with confidence intervals

Each round's evidence blob ID ships inside [`/predict/consensus`](https://api.slabclaw.com/predict/consensus) (`evidence.blobId` per card); the one referenced ONCHAIN by the live PROPOSED market: [verify on Walruscan →](https://walruscan.com/testnet/blob/Q2dlXakO8CMH3vL9BKJn60jL0Ac7uWN-jx8cSWosGRE)

### Learning over time

Three behaviors, all visible in the dapp's reliability chart (*the 10 bootstrap rounds below are simulated via `seed-history.mjs` and labeled as such — production rounds accumulate live every 6 hours*):

1. **Source reliability divergence** — Round 1: all sources weight 1.0. Round 10: eBay 96%, collector-crypt 49%. The swarm learns which sources to trust.
2. **Confidence interval narrowing** — Round 1: ±25%. Round 10: ±4%. More data = tighter consensus.
3. **Anomaly memory** — Round 5: manipulation detected (fake 4x price signal). Round 6+: that source is pre-weighted down. The swarm remembers attacks.

## Running in production

The swarm runs as a two-node system with **Walrus as the memory bus**:

- **Data-plane node** — runs the full swarm where its marketplaces are reachable, snapshots the agents' entire memory (price calibrations, source reputations, warm caches) to Walrus every round, and **anchors the blob id onchain** (`memory::checkpoint` on the shared [`SwarmMemory`](https://suiscan.xyz/testnet/object/0x41dfc599a161c5ba620d56b051b3ac92ba1db189c83ed7ce4f863740ae54649d) object — the same trust pattern as settlement evidence, applied to memory itself).
- **Serving node** (independent infrastructure, holds **no key**) — resolves the pointer **from chain** and restores the memory from Walrus before each 6-hour round, then serves [`/predict/consensus`](https://api.slabclaw.com/predict/consensus). [`/predict/health`](https://api.slabclaw.com/predict/health) reports `restoredFromBlobId` + `pointerSource: "onchain"` — verify it with one curl.

Kill either machine and the other rebuilds the swarm's accumulated knowledge from chain + Walrus alone — *memory that outlives its operator*. Don't take it on faith: `node oracle-bridge/prove-memory-loop.mjs` destroys the local memory, restores it from the onchain pointer, and proves the consensus comes back identical. The dapp at [slabclaw.com](https://slabclaw.com) ships a build-time snapshot and atomically upgrades to the live feed when reachable; every oracle panel labels itself `live` or `snapshot`.

No autonomous settlement runs in production: consensus rounds are computed and published continuously, but onchain proposals remain operator-signed — the optimistic dispute window is the safety net, not a substitute for one.

## Live testnet deployment

| | |
|---|---|
| Package (hardened + formally verified) | [`0x9807050b…b14f115`](https://suiscan.xyz/testnet/object/0x9807050b60400d30c848dcf035a2038b615ffdb7d6d2ed46332959d39b14f115) |
| AssetRegistry | [`0x18c19b19…fc108a`](https://suiscan.xyz/testnet/object/0x18c19b198a263421ff7882af139ce3645bc1a94c7d4f6ab715e318dd44fc108a) |
| ProtocolConfig (governance) | [`0xecbaca29…e64bc3`](https://suiscan.xyz/testnet/object/0xecbaca290e63b931dce3014cb71d85bad2af75083625331942b0a72a23e64bc3) |
| SwarmMemory (onchain memory pointer, v2 `memory` module) | [`0x41dfc599…54649d`](https://suiscan.xyz/testnet/object/0x41dfc599a161c5ba620d56b051b3ac92ba1db189c83ed7ce4f863740ae54649d) |
| tUSD Faucet | [`0xa1e2ca66…6c8870`](https://suiscan.xyz/testnet/object/0xa1e2ca665f6d2b8aa11d5a6caf0d3cc4d88da68b942991a007c87d0b516c8870) |

| Market (PSA 10) | Strike | State | Market ID |
|---|---|---|---|
| Typhlosion (Neo Genesis, 1st Ed) | $4,000 | ACTIVE | [`0xf63f37a0…c1144ea`](https://suiscan.xyz/testnet/object/0xf63f37a07f61a38c78b3ea6d650315e903a6192b767c34cfc5a8a2266c1144ea) |
| Karen's Umbreon (VS, 1st Ed) | $15,000 | ACTIVE | [`0x2da84029…02c9720`](https://suiscan.xyz/testnet/object/0x2da84029427ff70dfafadb8643d4f3a83f76f5344bd1de05c1902cff102c9720) |
| Flareon (Jungle, 1st Ed) | $2,500 | ACTIVE | [`0x9700623a…c459b71`](https://suiscan.xyz/testnet/object/0x9700623a1e977a179b011908da25e7800d682e4bc8dd38929ac7bc121c459b71) |
| Dark Raichu (Team Rocket, 1st Ed) | $6,000 | PROPOSED + [evidence on Walrus](https://walruscan.com/testnet/blob/Q2dlXakO8CMH3vL9BKJn60jL0Ac7uWN-jx8cSWosGRE) | [`0xd77d6340…617879c`](https://suiscan.xyz/testnet/object/0xd77d634059460679568e4370fe570b758a47841ebf35a479d88f5b05f617879c) |

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
#   tinyfish CLI + credits       # the 7 venue-direct agents; without it they skip
# With neither, the swarm still produces consensus from restored MemWal memory —
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

# Move contracts
cd contracts/slabclaw_predict && sui move test
```

## Project structure

```
contracts/slabclaw_predict/      Move: market · oracle · registry · test_usd
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
docs/                            Problem statements + formal verification + oracle-source research
```

## Manipulation resistance

| Attack | Cost | Defense | Outcome |
|---|---|---|---|
| Single-source spoof | ~$6K fees | MAD rejection (1 of 11 families) | Caught & filtered |
| Multi-source coordination | ~$23K+ fees | New signals lack reputation + CUSUM drift detection | Extremely expensive & detectable |
| Agent compromise | Variable | Transparent aggregation on Walrus = anyone verifies | Provably detectable |
| Coordinator compromise | Key access | Evidence blob = re-computable math | Provably fraudulent |

The parimutuel market structure itself is self-correcting: wash trading is impossible (buying always increases pool), flash loans are neutralized (capital locked until resolution), and oracle manipulation requires simultaneously manipulating multiple independent real-world marketplaces.

## Tech stack

Sui Move (2024 edition) · React + Vite + Tailwind · `@mysten/dapp-kit` (wallet + signing) · `@mysten/sui` (RPC) · Walrus / MemWal (agent memory + evidence) · SlabClaw backend (10-platform registry API, 5,167 products).

## License

All rights reserved. This repository is public for hackathon judging purposes only. No license is granted to use, copy, modify, or distribute this code without explicit written permission from the author.

---

*Built by [paparaw.eth](https://x.com/papa_raw) · Ecofrontiers SARL. Testnet only; identifiers change at mainnet.*
