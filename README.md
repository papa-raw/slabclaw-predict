# Anima Swarm

AI companions with persistent, verifiable memory on Sui and Walrus. Each creature remembers, learns, and builds relationships over time — forming an emergent swarm world where individual memories shape collective behavior.

Built for [Sui Overflow 2026](https://overflow.sui.io/) (Walrus Track).

## What is this?

Anima Swarm is a multi-agent game world where AI-powered creatures (spirits) have persistent memory stored on [Walrus](https://docs.walrus.site/) via [MemWal](https://github.com/buidly/memwal). Every conversation, battle, and encounter is remembered — not in a database you control, but on a verifiable, decentralized data layer that the creature (and its owner) truly owns.

Spirits interact in a shared world. Their accumulated experiences shape emergent behavior: alliances form from repeated positive encounters, rivalries develop from territorial conflicts, and the swarm self-organizes based on collective memory — not programmed rules.

## Why Walrus?

AI agents today are stateless. They forget everything between sessions. Memory that does persist is locked in proprietary databases — fragile, siloed, and unverifiable.

Walrus changes this:

- **Persistent** — memories survive across sessions, devices, and platforms
- **Verifiable** — every memory has a cryptographic proof of when it was created and by whom
- **Portable** — memories aren't locked to one app; any client can read a spirit's history
- **Private** — Seal encryption means only the owner can read sensitive memories

## Architecture

```
                    ┌─────────────────────────────┐
                    │      Walrus Sites           │
                    │   (decentralized frontend)  │
                    └──────────┬──────────────────┘
                               │
                    ┌──────────▼──────────────────┐
                    │     TypeScript Engine        │
                    │  (AI, game logic, UX)        │
                    │                              │
                    │  ┌────────┐  ┌───────────┐  │
                    │  │ LLM    │  │ Battle    │  │
                    │  │ Client │  │ Arbiter   │  │
                    │  └───┬────┘  └─────┬─────┘  │
                    └──────┼─────────────┼────────┘
                           │             │
              ┌────────────▼─────────────▼────────────┐
              │           MemWal (Walrus Memory)       │
              │  store / retrieve / share agent memory │
              │         + Seal (encryption)            │
              └────────────────┬───────────────────────┘
                               │
              ┌────────────────▼───────────────────────┐
              │           Sui Blockchain                │
              │  Spirit NFTs, ownership, game state,    │
              │  territory claims, swarm coordination   │
              │         (Move smart contracts)          │
              └────────────────────────────────────────┘
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Onchain | Move (Sui) — spirit ownership, game state, territory |
| Memory | Walrus + MemWal — persistent verifiable agent memory |
| Privacy | Seal — encrypted memories only the owner can read |
| Frontend | Walrus Sites — decentralized hosting |
| AI Engine | LLM-powered dialogue, personality, battle arbitration |
| Messaging | Sui Stack Messaging — multi-agent coordination |

## Project Structure

```
anima-swarm/
├── contracts/           # Sui Move smart contracts
│   └── anima_swarm/     # Spirit NFTs, game state, territories
├── frontend/            # React + Vite frontend
├── docs/                # Architecture, design docs
└── scripts/             # Deployment, testing utilities
```

## Development

```bash
# Prerequisites
brew install sui        # Sui CLI

# Move contracts
cd contracts/anima_swarm
sui move build
sui move test

# Frontend (coming soon)
cd frontend
npm install
npm run dev
```

## License

MIT
