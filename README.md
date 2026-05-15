# Anima Swarm

5-player deity-controlled AI swarm strategy on a 37-hex grid. You whisper to your spirits through natural language — they interpret, propagate, and act autonomously based on accumulated memories. Battles, spawning, territory claims, and cross-game reincarnation — all verifiable on Walrus and Sui.

Built for [Sui Overflow 2026](https://overflow.sui.io/) (Walrus Track).

## The Idea

You are a deity. Your only tool is conversation. Whisper to your seed spirit, and your words become memories stored on Walrus via MemWal. Those memories shape how your swarm decides to move, fight, explore, or spawn — autonomously. When the game ends, your swarm's entire soul exports as a **SwarmEssence** blob on Walrus: playstyle fingerprint, spirit legacies, core memories, and lineage chain. Import that essence into your next game and your spirits reincarnate with echoes of past lives — deeper lineages carry stronger bonds.

## Architecture

```
┌──────────────────────────────────────────────────┐
│  React + Vite frontend (:5173)                   │
│  HexMap · SpiritPanel · Lobby · EssenceExport    │
└──────────────────┬───────────────────────────────┘
                   │ WebSocket + REST
┌──────────────────▼───────────────────────────────┐
│  Express server (:3001)                          │
│  tickEngine · spiritDecision · battleResolver     │
│  whisperService · essenceService · walrusService  │
└──────┬────────────────┬──────────────────────────┘
       │                │
┌──────▼──────┐  ┌──────▼──────────────────────────┐
│  MemWal     │  │  Walrus                         │
│  agent      │  │  SwarmEssence blobs             │
│  memory     │  │  (export/import/reincarnation)  │
└─────────────┘  └─────────────────────────────────┘
       │
┌──────▼──────────────────────────────────────────┐
│  Sui (Move contracts)                           │
│  spirit.move · battle.move · territory.move     │
│  spawn.move (0.01 SUI fee)                      │
└─────────────────────────────────────────────────┘
```

## Quick Start

```bash
# 1. Install dependencies
npm install
cd frontend && npm install && cd ..

# 2. Move contracts (optional — compile and test)
cd contracts/anima_swarm
sui move build    # 0 errors
sui move test     # 4 tests, all pass
cd ../..

# 3. Start the server
node server/index.js
# → [Anima Swarm] Server + WebSocket running on port 3001

# 4. Start the frontend (separate terminal)
cd frontend
npx vite
# → http://localhost:5173
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | For AI dialogue | LLM for spirit dialogue, battle narration, decisions |
| `PORT` | No (default 3001) | Express server port |
| `WALRUS_NETWORK` | No (default mock) | `testnet` for real Walrus blob storage via HTTP API |
| `WALRUS_PUBLISHER` | No | Override publisher URL (default: Mysten testnet publisher) |
| `WALRUS_AGGREGATOR` | No | Override aggregator URL (default: Mysten testnet aggregator) |
| `PACKAGE_ID` | No (mock mode) | Sui Move package ID after `sui client publish` |

Without API keys, the game runs in mock mode — spirits make random decisions, battles use RNG, and blobs store in-memory (persisted to `_data/blobs.json`).

Set `WALRUS_NETWORK=testnet` to store SwarmEssence blobs on real Walrus testnet — no SUI keypair or WAL tokens needed (the publisher handles it via HTTP API).

## Demo Flow

```bash
# Start server + frontend (see Quick Start)

# Open http://localhost:5173 → Lobby screen
# Click "Start Game" → Game begins with 1 human + 4 AI deities

# Fast-forward the game:
curl -X POST http://localhost:3001/api/tick/fast-forward \
  -H 'Content-Type: application/json' \
  -d '{"ticks": 50}'
# Game typically completes in 20-40 ticks

# Export SwarmEssence after game over:
curl -X POST http://localhost:3001/api/essence/export \
  -H 'Content-Type: application/json' \
  -d '{"playerId": "player-1"}' | jq .blobId
# → "mock-blob-..."

# Restart to fresh lobby:
curl -X POST http://localhost:3001/api/game/restart

# Import essence in new game:
curl -X POST http://localhost:3001/api/essence/import \
  -H 'Content-Type: application/json' \
  -d '{"blobId": "mock-blob-..."}'
# → Preview with reincarnation candidates, lineage depth, memories

# Start game with imported essence:
curl -X POST http://localhost:3001/api/game/ready \
  -H 'Content-Type: application/json' \
  -d '{"playerId": "player-1", "blobId": "mock-blob-..."}'
# → Seed spirit now has past-life memories, XP carryover, purple ring on map
```

### Walrus Testnet Mode

```bash
# Start server with real Walrus blob storage:
WALRUS_NETWORK=testnet node server/index.js

# Export now writes to Walrus testnet — blob IDs are real:
# → "76epk5lDY5DNm0c3eDlFdr4nGlamOaT5XJhYg8M236k"

# Anyone can verify the blob:
curl https://aggregator.walrus-testnet.walrus.space/v1/blobs/<BLOB_ID>
```

## Project Structure

```
anima-swarm/
├── contracts/anima_swarm/
│   ├── sources/          # 4 Move modules (spirit, battle, territory, spawn)
│   └── tests/            # 4 Move tests
├── frontend/src/
│   ├── components/       # HexMap, SpiritPanel, Lobby, CommandBar, EssenceExport/Import
│   ├── styles/           # design-system.css (dark mythic theme)
│   └── App.jsx           # Main app with lobby → active → finished routing
├── server/
│   ├── routes/           # game, tick, essence API endpoints
│   └── services/         # 17 services (tick engine, battle, spawn, whisper, essence, etc.)
├── lib/                  # Shared: hexMath, hexGrid, terrainTypes, seedSpirits
└── _data/                # Mock blob persistence (blobs.json)
```

## Key Features

- **Memory-as-control** — no direct unit commands; all behavior emerges from whispered memories
- **SwarmEssence** — export your swarm's soul to Walrus, import in future games
- **Reincarnation** — spirits carry 20%+ XP and 15%+ bond from past lives (deeper lineages = stronger bonuses)
- **Autonomous AI** — spirits decide, move, battle, and spawn on their own every 30s
- **4 Move contracts** — Spirit NFTs, BattleRecords, shared GameMap, spawn fees (0.01 SUI)
- **Real-time hex grid** — 37 hexes, 8 terrain types, territory borders, spirit animations

## License

MIT
