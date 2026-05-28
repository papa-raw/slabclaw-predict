# Anima Swarm

AI spirits that remember everything — and that's the problem.

6-player deity-controlled strategy on a 169-hex grid where **persistent memory on Walrus is the gameplay mechanic**, not just storage. Spirits form grudges from repeated losses, develop fears from witnessing death, acquire terrain trauma, and become insubordinate when loyalty breaks. These memories persist across games on Walrus — your veterans from Game 1 carry their scars into Game 2.

Built for [Sui Overflow 2026](https://overflow.sui.io/) (Walrus Track).

## Why Walrus

This game couldn't exist without Walrus. Every captain maintains a structured memory ledger that drives deterministic behavior:

| Memory Type | Trigger | Behavior Effect |
|------------|---------|-----------------|
| **Grudge** | 3+ losses to a team | Auto-attacks that team on sight |
| **Confidence** | 3+ wins vs a team | +10% combat bonus against them |
| **Fear** | Witnessed ally death | Flees from that team |
| **Trauma** | Died on a terrain type | Refuses to enter that terrain |
| **Insubordination** | Low loyalty + grudges | Ignores deity orders |

At game end, captain memory ledgers serialize to Walrus blobs. At game start, they auto-load from the player's wallet. No manual import/export — connect wallet, memories load.

**The tension:** Captains can spend memories to spawn new swarmlings. Bigger army, but your veteran loses their grudges and confidence. Memory is the currency.

## Architecture

```
Frontend (React + Vite :5173)
  HexMap  SpiritPanel  MemoryTimeline  MemoryBanner  Lobby
      |
      | WebSocket + REST
      v
Server (Express :3001)
  tickEngine        - 96 ticks at 5s (~8 min games)
  memoryEngine      - structured memories, behavior rules, Walrus serialization
  spiritDecision    - deterministic rule-based (zero LLM in game loop)
  battleArbiter     - stat-based + memory bonuses
  battleResolver    - creates BATTLE memories on every fight
  wsService         - broadcasts memory_events to all clients
      |         |
  MemWal SDK    Walrus HTTP API
  (per-spirit   (captain memory
   agent memory) ledger blobs)
      |
  Sui Move Contracts (testnet)
  spirit.move  battle.move  territory.move  spawn.move
```

## Quick Start

```bash
# Install
npm install && cd frontend && npm install && cd ..

# Start server
node server/index.js
# -> [Anima Swarm] Server on port 3001

# Start frontend (separate terminal)
cd frontend && npx vite
# -> http://localhost:5173
```

Open the browser, connect a wallet (or use dev mode), and start the game. 6 players auto-fill with AI deities. Games last ~8 minutes.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `ANTHROPIC_API_KEY` | No | Spirit dialogue flavor text (game works without it) |
| `PORT` | No (3001) | Express server port |
| `WALRUS_NETWORK` | No (mock) | `testnet` for real Walrus blob storage |
| `WALRUS_PUBLISHER` | No | Override Walrus publisher URL |
| `WALRUS_AGGREGATOR` | No | Override Walrus aggregator URL |
| `PACKAGE_ID` | No (mock) | Sui Move package ID |

Without keys, everything runs in mock mode with local blob storage.

## Game Parameters

| Parameter | Value |
|-----------|-------|
| Players | 6 (human + AI deities) |
| Captains per player | 6 (36 total) |
| Swarmlings per player | 12 (72 total) |
| Total spirits | 108 + 2 ghosts |
| Map | 169 hexes (radius 7), 7 terrain types |
| Game duration | 96 ticks (~8 minutes) |
| Win condition | 45% territory OR timer |
| Decision interval | 8s (deterministic, zero LLM) |
| Max memories per captain | 50 |
| Spawn cost | 5 memories from captain ledger |

## Memory System

### How Memories Form

Every battle, decree, scout mission, betrayal, alliance, death witness, and encounter creates a structured memory:

```json
{
  "type": "BATTLE",
  "outcome": "LOSS",
  "targetTeam": "player-3",
  "targetSpirit": "Captain Kelp",
  "terrain": "volcanic",
  "tick": 24,
  "text": "Fell to Captain Kelp on volcanic ground"
}
```

### How Memories Drive Behavior

`computeBehaviorRules()` scans the ledger and produces deterministic rules:
- 3+ losses to a team = **grudge** (auto-attack on sight)
- 3+ wins vs a team = **confidence** (+10% combat bonus)
- Witnessed death by a team = **fear** (auto-retreat)
- Died on a terrain = **trauma** (refuses entry)
- Low loyalty + grudges = **insubordinate** (ignores orders)

### Cross-Game Persistence

1. **Game ends** -> `serializeForWalrus(captain)` -> Walrus blob per captain
2. **Game starts** -> wallet query -> fetch blobs -> `deserializeFromWalrus()` -> memories loaded
3. Captain from Game 1 with a grudge against Tide enters Game 2 still hostile to Tide

### Memory as Economy

Captains with 10+ memories can spend 5 to spawn a swarmling. This erases 5 memories from their ledger, potentially removing grudges or confidence bonuses. Army size vs. behavioral depth is a real trade-off.

## Frontend Features

- **Hex map** with 169 hexes, 7 terrain types, territory borders, spirit sprites
- **Memory tab** with live feed of all memory events, filters (All/Dramatic/My Swarm)
- **Memory banners** overlay the map when dramatic events fire (grudge formed, fear acquired, trauma)
- **Spirit panel** with behavior rule indicators, memory ledger timeline, XP/bond stats
- **Header counter** showing total memories + Walrus branding
- **Game-over screen** with memory persistence summary and Walrus blob links
- **Onboarding** explains the Walrus memory system to new viewers
- **Onchain tab** showing live Sui + Walrus operations

## Project Structure

```
anima-swarm/
  contracts/anima_swarm/
    sources/            4 Move modules (spirit, battle, territory, spawn)
    tests/              4 Move tests
  frontend/src/
    components/         HexMap, SpiritPanel, MemoryTimeline, MemoryBanner, Lobby
    vfx/                Canvas particle engine (explosions, blood, spawn, death)
    styles/             design-system.css (dark mythic theme)
  server/
    routes/             game.js (REST + persistence endpoints)
    services/           memoryEngine, spiritDecision, battleResolver, tickEngine, etc.
  lib/                  hexMath, terrainTypes, classSystem, seedSpirits
```

## License

MIT
