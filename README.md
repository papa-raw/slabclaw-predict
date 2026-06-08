# SlabClaw Predict

**Prediction markets on real-world collectibles, settled on Sui — priced by a memory-backed, manipulation-resistant multi-agent oracle swarm.**

> *"Will PSA 10 Karen's Umbreon exceed $15,000 by July 7, 2026?"* — YES/NO, onchain, settled against real marketplace data from 9 independent source agents.

**Sui Overflow 2026 · Walrus track** — memory-backed agents / MemWal

---

## The one-liner

Anyone can trade YES/NO on whether a graded card exceeds a strike price by expiry. The market resolves against a **real price** — not a single feed, but a **swarm of 9 source-specialist agents** that read every major collectibles venue, **remember** each card's history and past manipulation attempts across sessions (persisted on **MemWal / Walrus Memory**), coordinate to a manipulation-resistant consensus, and store their evidence as verifiable artifacts on **Walrus**.

The prediction market is the showcase. **The agentic, memory-backed oracle is the product.**

## Why this is a Walrus project

The Walrus track asks for *AI agents / agentic workflows with long-term memory (MemWal), long-running workflows where agents track state over time, and artifact-driven workflows.* Our oracle is exactly that:

- **Multi-agent (9 specialists)** — one agent per marketplace source. Each knows its platform's data format, pricing patterns, and failure modes.
- **Long-running + stateful** — agents continuously monitor prices and **remember**: per-card comp history, source reliability weights (evolving over rounds), and previously-detected manipulation patterns. Kill the process, restart — memory persists via MemWal.
- **Coordinated** — agents reconcile heterogeneous inputs (sold comps, active listings, auction results, tokenized FMV) into one consensus via **confidence-weighted median + MAD outlier rejection**, with circuit breakers that block proposals when sources disagree.
- **Artifact-driven** — every consensus round emits an evidence bundle on **Walrus** containing all inputs, weights, rejections, and aggregation math. Disputes are nearly self-resolving: download the blob, re-run the computation, verify.

This is durable, portable, multi-agent memory — applied to a real $2B+/yr market that has never had a trustworthy onchain price.

## Architecture

```
TIER 1: Source Specialists (9 agents, parallel)
  eBay ─────────────┐
  PriceCharting ────┤
  Courtyard ────────┤
  TCGPlayer ────────┤  Each reads from SlabClaw's 10-platform
  ALT.xyz ──────────┼─ registry API → platform-specific filtering
  Cardmarket ───────┤  → local circuit breakers (price jump, stale
  Beezie (Base) ────┤  feed, seller concentration, zero price)
  Collector Crypt ──┤  → writes signal to shared MemWal context
  Goldin Auctions ──┘

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
3. **Oracle swarm runs** — 9 agents fetch live marketplace data, coordinator aggregates, evidence uploads to Walrus.
4. **Settle** — after expiry the bridge keeper proposes the consensus price onchain (if quality gates pass).
5. **Dispute** — 24h window; anyone can challenge with a tUSD bond. Evidence on Walrus makes disputes nearly self-resolving.
6. **Claim** — undisputed → auto-finalize; winners claim from the pool.

## What's live

| Component | Status |
|---|---|
| Move contracts (`market`, `oracle`, `registry`, `test_usd`) on Sui testnet | ✅ deployed |
| 4 PSA-10 markets seeded with positions | ✅ live |
| React dapp — browse, faucet tUSD, buy YES/NO, oracle-vs-strike chart, registry ladder, dispute/resolution flow | ✅ working |
| **Oracle swarm** — 9 source agents + coordinator + bridge keeper | ✅ working |
| **MemWal persistence** — per-agent card memory, shared signals, reputation weights | ✅ working |
| **Walrus evidence** — every consensus round uploaded as verifiable blob | ✅ working |
| **Frontend Oracle Swarm panel** — per-source signals, weights, confidence interval, reliability chart | ✅ working |
| **Seeded history** — 10 rounds demonstrating learning (reliability divergence, CI narrowing, manipulation detection) | ✅ working |
| Single-source oracle bridge (`bridge.mjs`) + offline snapshot fallback | ✅ working |
| Swarm-powered bridge (`bridge-swarm.mjs`) — replaces single-source with multi-agent consensus | ✅ working |

## Key deliverables

### Oracle Swarm (Walrus track)

| File | What it does |
|---|---|
| `oracle-bridge/agents/base-agent.mjs` | Base class: MemWal I/O, circuit breakers, signal normalization |
| `oracle-bridge/agents/{ebay,pricecharting,courtyard,tcgplayer,alt,cardmarket,beezie,collector-crypt,goldin}-agent.mjs` | 9 platform-specific source agents |
| `oracle-bridge/agents/coordinator.mjs` | MAD outlier rejection → confidence-weighted median → evidence bundle |
| `oracle-bridge/swarm.mjs` | Orchestrator: runs all agents in parallel → coordinator → Walrus upload |
| `oracle-bridge/bridge-swarm.mjs` | Swarm-powered bridge: agents → consensus → onchain proposal |
| `oracle-bridge/walrus-evidence.mjs` | Upload/read evidence bundles on Walrus testnet |
| `oracle-bridge/seed-history.mjs` | Generate 10 rounds of realistic MemWal history for demo |
| `oracle-bridge/memwal/` | MemWal persistence: per-agent memory, shared context, consensus history |

### Evidence on Walrus

Every swarm run uploads a complete evidence bundle to Walrus containing:
- All 9 agents' signals (price, confidence, comp count, source)
- MAD z-scores for every rejected outlier
- Confidence-weighted median computation
- Source reliability weights (evolving over rounds)
- Card-by-card consensus with confidence intervals

[View latest evidence blob →](https://aggregator.walrus-testnet.walrus.space/v1/blobs/DsshTPEVIBg0LsCZaue6JpJacQizjuTF_Yzola8oVcQ)

### Learning over time (what judges see)

1. **Source reliability divergence** — Round 1: all sources weight 1.0. Round 10: eBay 96%, collector-crypt 49%. The swarm learns which sources to trust.
2. **Confidence interval narrowing** — Round 1: ±25%. Round 10: ±4%. More data = tighter consensus.
3. **Anomaly memory** — Round 5: manipulation detected (fake 4x price signal). Round 6+: that source is pre-weighted down. The swarm remembers attacks.

## Live testnet deployment

| | |
|---|---|
| Package | [`0xdc18fc79…af7b141`](https://suiscan.xyz/testnet/object/0xdc18fc79030aea4a39198d95c73271c41d955b3b548dc5090627bf224af7b141) |
| AssetRegistry | `0x4ce60524…b215da3d` |
| OracleCap | `0x183ae110…fa424ac` |
| tUSD Faucet | `0x53100cc6…c26c671` |

| Market (PSA 10) | Strike | Market ID |
|---|---|---|
| Karen's Umbreon (VS, 1st Ed) | $15,000 | `0x9ff720…fdc44e` |
| Typhlosion (Neo Genesis, 1st Ed) | $4,000 | `0x6d2131…fc5253` |
| Dark Raichu (Team Rocket, 1st Ed) | $6,000 | `0x87a816…b6bcade` |
| Flareon (Jungle, 1st Ed) | $2,500 | `0x2dae76…a5fd58` |

## Run it

```bash
# Frontend (dapp)
cd frontend && npm install && npm run dev        # http://localhost:5174

# Oracle swarm — run all 9 agents + coordinator + Walrus upload
cd oracle-bridge
node seed-history.mjs --clean    # seed 10 rounds of MemWal history
node swarm.mjs                   # one-shot: all agents → consensus → Walrus
node swarm.mjs --verbose         # with per-agent detail
node swarm.mjs --watch           # poll every 300s

# Swarm-powered bridge — agents + consensus + onchain proposal
node bridge-swarm.mjs            # one pass
node bridge-swarm.mjs --watch    # keeper daemon

# Walrus evidence
node walrus-evidence.mjs upload  # upload latest evidence bundle
node walrus-evidence.mjs log     # list all uploaded blobs

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
  agents/                        9 source agents + coordinator
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
    coordinator.mjs              Aggregation: MAD → weighted median → evidence
  swarm.mjs                      Orchestrator (all agents → coordinator → Walrus)
  bridge-swarm.mjs               Swarm-powered onchain bridge
  walrus-evidence.mjs            Walrus upload/read/log
  seed-history.mjs               Demo history generator
  memwal/                        MemWal persistence root
  bridge.mjs                     Legacy single-source bridge
frontend/                        React + Vite + @mysten/dapp-kit
  src/components/
    OracleSwarmPanel.jsx         Swarm consensus visualization
    MarketDetail.jsx             Market detail with Oracle Swarm tab
explain-site/                    Standalone explanation site for judges
docs/                            Problem statements + oracle-source research
```

## Manipulation resistance

| Attack | Cost | Defense | Outcome |
|---|---|---|---|
| Single-source spoof | ~$6K fees | MAD rejection (1/9 sources) | Caught & filtered |
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
