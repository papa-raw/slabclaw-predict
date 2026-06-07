# SlabClaw Predict

**Prediction markets on real-world collectibles, settled on Sui — priced by a memory-backed, manipulation-resistant multi-agent oracle.**

> *"Will PSA 10 Karen's Umbreon exceed $15,000 by July 7, 2026?"* — YES/NO, on-chain, settled against real marketplace data.

**Sui Overflow 2026** · **Walrus track** (memory-backed agents / MemWal) · Explorations / RWA price discovery (secondary)

---

## The one-liner

Anyone can trade YES/NO on whether a graded card exceeds a strike price by expiry. The market resolves against a **real price** — not a single feed, but a **swarm of source-specialist agents** that read every major collectibles venue, **remember** each card's history and past manipulation attempts across sessions (persisted on **MemWal / Walrus Memory**), coordinate to a manipulation-resistant consensus, and store their evidence as verifiable artifacts on **Walrus**.

The prediction market is the showcase. **The agentic, memory-backed oracle is the product.**

## Why this is a Walrus project

The Walrus track asks for *AI agents / agentic workflows with long-term memory (MemWal), long-running workflows where agents track state over time (research/trading/monitoring agents), and artifact-driven workflows.* Our oracle is exactly that:

- **Multi-agent** — one specialist agent per source (eBay · Fanatics/PWCC · Heritage · Goldin · ALT · CardLadder · Courtyard · TCGplayer · GemRate pop). Each is an expert on its venue's quirks, bot-protection, and PDF result formats.
- **Long-running + stateful** — agents continuously monitor prices and **remember**: a card's comp history, each source's reliability weight, and previously-seen wash-trade / thin-market manipulation. Cold-start gets smarter every run because memory lives on **MemWal**, not in a single process.
- **Coordinated** — agents reconcile heterogeneous inputs (last-sale, range, index, auction-realized) into one consensus via **median-of-medians + confidence-weighted median + MAD outlier rejection**, with a **UMA-style dispute/bond** escalation for high-value cards.
- **Artifact-driven** — every resolution emits an evidence bundle (consensus price, contributing comps, source weights, timestamps) stored on **Walrus** and referenced on-chain, so resolutions are **independently auditable**: don't trust the oracle, verify the blob.

This is durable, portable, multi-agent memory — applied to a real $2B+/yr market that has never had a trustworthy on-chain price.

## Architecture

```
   Source-specialist agents (the swarm)                MemWal (Walrus Memory)
 eBay·PWCC  Heritage  Goldin  ALT  CardLadder  ───────►  per-card price memory,
 Courtyard  TCGplayer  GemRate(pop)  …                    source reliability,
      │  (TinyFish scrapers + PDF resolvers)              manipulation patterns
      ▼                                                         ▲
 Manipulation-resistant aggregator  ──────────────────────────┘
 (median-of-medians · conf-weighted · MAD · dispute layer)
      │  consensus price + evidence bundle
      ├──────────────►  Walrus  (verifiable evidence artifact)
      ▼
 Oracle bridge (off-chain keeper)  ──►  propose_resolution(price, sources) at expiry
      ▼
 Move contracts on Sui testnet  ──►  React dapp (browse · bet YES/NO · settle · claim)
 market · oracle · registry · test_usd
```

### How it works

1. **Market** — a binary prediction: exact product (set · number · grader · grade), strike, expiry.
2. **Trade** — buy YES or NO with **tUSD** (faucet-minted test USD); parimutuel pool.
3. **Settle** — after expiry the oracle bridge proposes the real price from the agent consensus.
4. **Dispute** — 24h window; anyone can challenge with a tUSD bond (UMA-style optimistic resolution).
5. **Claim** — undisputed → auto-finalize; winners claim from the pool. Evidence lives on Walrus.

## What's live today

| Component | Status |
|---|---|
| Move contracts (`market`, `oracle`, `registry`, `test_usd`) on Sui testnet | ✅ deployed |
| 4 PSA-10 markets seeded with positions | ✅ live |
| React dapp — browse, faucet tUSD, buy YES/NO, oracle-vs-strike chart w/ 95% cone, registry ladder, dispute/resolution flow | ✅ working |
| Oracle bridge — reads exact-product PSA-10 oracle, auto-proposes resolution at expiry (`bridge.mjs`, `propose-resolution.mjs`, `finalize.mjs`) | ✅ working |
| Exact-product oracle (grader+grade, cross-grade stripped) + offline snapshot fallback | ✅ working |
| **Multi-agent oracle swarm + MemWal memory** (the Walrus deliverable) | 🚧 in progress |
| Source scanners (ALT, CardLadder, Courtyard, …) + PDF smart-resolvers | 🚧 in progress |
| Walrus evidence-artifact upload + on-chain reference | 🚧 in progress |

> Independent source landscape + manipulation-resistant aggregation design: [`docs/deep-research-oracle-sources.json`](docs/deep-research-oracle-sources.json).

## Live testnet deployment

| | |
|---|---|
| Package | [`0xdc18fc79030aea4a39198d95c73271c41d955b3b548dc5090627bf224af7b141`](https://suiscan.xyz/testnet/object/0xdc18fc79030aea4a39198d95c73271c41d955b3b548dc5090627bf224af7b141) |
| AssetRegistry | `0x4ce60524409d492d25c46c4d03eb0fa884f51bbdecb4412093723b54b215da3d` |
| OracleCap | `0x183ae11027654706f8061221e62f5eccd56d0e0d56357293cf9e9f715fa424ac` |
| tUSD Faucet | `0x53100cc63e89f2a600b65af0efa894f22b20de78f455cafc4f0713c51c26c671` |
| Quote / settlement asset | `…::test_usd::TEST_USD` (faucet-minted) |

| Market (PSA 10) | Strike | Market ID |
|---|---|---|
| Karen's Umbreon (VS, 1st Ed) | $15,000 | `0x9ff720…fdc44e` |
| Typhlosion (Neo Genesis, 1st Ed) | $4,000 | `0x6d2131…fc5253` |
| Dark Raichu (Team Rocket, 1st Ed) | $6,000 | `0x87a816…b6bcade` |
| Flareon (Jungle, 1st Ed) — dispute demo | $2,500 | `0x04fe86…71e1da` |

## Run it

```bash
# Frontend (dapp)
cd frontend && npm install && npm run dev        # http://localhost:5174

# Oracle bridge — read real oracle per market, auto-propose on expiry
cd oracle-bridge && node bridge.mjs --dry         # one status pass
node bridge.mjs --watch                           # keeper daemon

# Rebuild the bundled oracle snapshot from the SlabClaw DB (read-only)
python3 oracle-bridge/build-snapshot.py

# Move contracts
cd contracts/slabclaw_predict && sui move test    # 16/16
```

## Project structure

```
contracts/slabclaw_predict/   Move: market · oracle · registry · test_usd
oracle-bridge/                off-chain keeper + oracle reader + (coming) MemWal swarm
frontend/                     React + Vite + @mysten/dapp-kit dapp
docs/                         problem statements + oracle-source research
```

## Tech stack

Sui Move (2024 edition) · React + Vite + Tailwind · `@mysten/dapp-kit` (wallet + signing) · `@mysten/sui` (RPC) · Walrus / MemWal (agent memory + evidence) · TinyFish (source scraping swarm).

## Track positioning

- **Walrus (primary).** The memory-backed multi-agent oracle is the deliverable; the markets are the showcase.
- **Explorations / RWA price discovery (secondary).** Prediction markets as a coordination mechanism for real-world asset valuation.
- **Not DeepBook.** DeepBook Predict prices against a BTC **volatility surface** with sub-hour expiries; illiquid collectibles have no vol surface, so the protocol structurally cannot price them. (See `docs/DeepBook-Predict-Problem-Statement.pdf`.)

## License

All rights reserved. This repository is public for hackathon judging purposes only. No license is granted to use, copy, modify, or distribute this code without explicit written permission from the author.

---

*Built by [paparaw.eth](https://x.com/papa_raw) · Ecofrontiers SARL. Testnet only; identifiers change at mainnet.*
