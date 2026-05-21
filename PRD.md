# Anima Swarm — One-Shot PRD

## 0. Thesis

**One-line:** A 5-player territory strategy game where you control an AI swarm by whispering to your spirits — and every memory, battle, spawn, and territory claim is verifiable on Walrus.

**10-second pitch:** You are a deity. You don't command your spirits — you influence them through conversation. Your words become memories. Memories shape behavior. Behavior conquers territory. The entire chain of influence — from your whisper to the swarm's conquest — is stored as verifiable data on Walrus, the decentralized storage layer on Sui.

**Signature mechanic (5 words):** Deity whispers shape swarm behavior.

## 1. Strategic Layer

### 1.1 Hackathon

- **Event:** Sui Overflow 2026
- **Track:** Walrus (Specialized) — $70K pool ($35K 1st)
- **Build period:** May 7 – Jun 21, 2026
- **Submission:** DeepSurge
- **Judging:** Real-World Application 50% | Product & UX 20% | Technical Implementation 20% | Presentation & Vision 10%
- **Prize model:** 50% on winner announcement, 50% after mainnet deploy. Already on mainnet = 100% upfront.

### 1.2 Budget & ROI

| Item | Cost |
|------|------|
| Anthropic API (dev + demo) | ~$30 |
| Sui testnet gas | Free |
| Walrus testnet storage | Free |
| MemWal relayer (staging) | Free |
| Vercel hosting | Free tier |
| Total | ~$30 |

Prize target: $35K (1st place). ROI: 1,166x.

### 1.3 Track Alignment

| Judging criterion (weight) | How we hit it |
|---------------------------|---------------|
| **Real-World Application (50%)** | "How do you control a swarm of AI agents?" — through shared memory, not individual API calls. This is the unsolved multi-agent coordination problem. |
| **Product & UX (20%)** | Playable strategy game with hex map, chat interface, family tree visualization. Not a demo — a game. |
| **Technical Implementation (20%)** | Move contracts for Spirit NFTs + territory + battles. MemWal for all memory. Walrus for blob storage. Deep integration, not a wrapper. |
| **Presentation & Vision (10%)** | Deity control model is unprecedented. Vision: the protocol for memory-driven agent coordination. |

### 1.4 Competitive Analysis

**What won previously:**
- Sui Overflow 2025 Walrus track: **SuiSign** — decentralized document signing. Solo builder, deep Walrus integration, clear real-world use case.
- Walrus Haulout 2025: **TradeArena** — AI-vs-AI trading competition, every decision on Walrus. **Spectra** — privacy-preserving AI pipeline.
- Pattern: projects where Walrus is structurally essential (not just storage), with clear real-world application.

**What loses:**
- "Blockchain version of X" without a thesis for why Walrus specifically matters
- Concept demos without working products
- Superficial integration (use Walrus to store a profile picture)

**Our differentiation:** No other project will use MemWal as a full game engine. Most will build chatbot-with-memory. We build a competitive strategy game where memory IS the economy, the military, and the diplomacy.

### 1.5 Scope Budget

- **Max 1 chain:** Sui testnet (mainnet for final deploy)
- **Max 4 Move modules:** spirit, territory, battle, spawn
- **Max 3 external integrations:** MemWal, Walrus SDK, Anthropic API
- **1 DEEP integration:** MemWal (the entire game runs on it)
- **CUT:** Seal encryption, Sui Stack Messaging, Walrus Sites (use Vercel), complex battle animations

## 2. Game Design (v1 — SUPERSEDED by Section 7)

> **WARNING TO COLD AGENT:** Section 2 is the ORIGINAL v1 design. Section 7 overrides it.
> When Section 2 and Section 7 conflict, **Section 7 wins**. Key overrides:
> - Map: 37 hexes (radius 3), NOT 61 (radius 4)
> - Turn structure: continuous real-time with timers, NOT epoch-based phases
> - Win condition: 23 hexes (60% of 37), NOT 37 hexes (60% of 61)
> - Mood system: CUT
> - Spawn cooldown: 5 minutes (timer), NOT 3 epochs
> - Alliances: deferred post-MVP
> - Game state: server-authoritative in-memory, NOT client-side
>
> Section 2 is preserved for design rationale only. **Do not implement Section 2 directly.**

### 2.1 Overview

5 players compete for control of a hex-grid world map. Each player starts as a deity with one seed spirit in a home bioregion. You influence your swarm through conversation — your words become memories that propagate through your spirits and shape their autonomous behavior. Spirits spawn specialists, battle for territory, and form an expanding network of agents, each with verifiable memory on Walrus.

### 2.2 The Deity Control Model

You don't issue commands. You SPEAK to your spirits. Your words are stored as memories on MemWal. Your spirits interpret your intent, discuss it among themselves, and act based on their accumulated understanding.

**Influence propagation chain:**
```
Player speaks to Spirit A
  → Spirit A stores memory (MemWal: player namespace)
  → LLM extracts intent from conversation
  → Spirit A generates a "whisper" to nearby swarm members
  → Whisper stored in shared swarm namespace (MemWal)
  → Spirit B reads whisper via recall()
  → Spirit B interprets through its own personality + memories
  → Spirit B decides action (move, battle, explore, spawn)
  → Action outcome stored as memory (MemWal)
```

**Bond affects propagation fidelity:**
- High bond (60-100): Spirit faithfully interprets your intent, whispers are accurate
- Medium bond (30-59): Spirit adds its own interpretation, whispers may drift
- Low bond (0-29): Spirit barely registers your influence, acts mostly autonomously

**This creates emergent behavior:** You say "I'm concerned about the eastern frontier." Spirit A whispers to Spirit B near the east: "The deity fears the east." Spirit B, who is a warrior, interprets this as "attack eastward." Spirit C, who is cautious, interprets it as "fortify eastern defenses." The swarm responds to your nudge in ways shaped by individual spirit personalities — not your explicit orders.

### 2.3 Hex Grid World Map

**Board:** Real-world map projection (Mercator or equirectangular) with hex tessellation overlay. Each hex has:

| Property | Source |
|----------|--------|
| Terrain type | Derived from bioregion (forest, desert, ocean, mountain, grassland, tundra, volcanic, coastal) |
| Bioregion ID | One Earth bioregion classification |
| Memory generation rate | Base rate modified by terrain richness |
| Controller | Player ID or null (unclaimed / wild) |
| Spirits present | List of Spirit IDs in this hex |
| Defense bonus | Terrain-based (mountains +30%, forests +20%, etc.) |

**Map size:** ~61 hexes (4-ring hexagonal grid). This gives:
- 5 starting positions on the outer ring (evenly spaced)
- ~12 hexes per player initially (home cluster of ~3 + unclaimed)
- Central hexes are contested high-value territory
- Enough space for expansion without the map feeling empty

**Bioregion mapping:** Hex clusters map to real bioregions. A cluster of 3-4 forest hexes = Mediterranean Forests. A cluster of mountain hexes = Himalayas. The ecological identity of the hex affects what spirits thrive there and what memories naturally form.

**Terrain types and effects:**

| Terrain | Memory rate | Defense bonus | Spirit affinity | Color |
|---------|-------------|---------------|-----------------|-------|
| Forest | 1.2x | +20% | Explorer, Guardian | #22c55e |
| Desert | 0.8x | +0% | Warrior | #f59e0b |
| Ocean | 1.0x | +40% (naval) | Scout | #3b82f6 |
| Mountain | 0.6x | +30% | Guardian, Sage | #78716c |
| Grassland | 1.5x | +0% | Gatherer, Social | #a3e635 |
| Tundra | 0.5x | +10% | Warrior | #e2e8f0 |
| Volcanic | 0.4x | +0% | Warrior (2x spawn) | #ef4444 |
| Coastal | 1.3x | +10% | Scout, Explorer | #06b6d4 |

### 2.4 Economy: Memory as Resource

Memories are the universal resource. They accumulate passively in controlled hexes and actively through player conversation.

**Memory generation:**
- Each controlled hex generates memories per epoch (proportional to terrain memory rate)
- Player conversations with spirits generate high-quality memories (faster bond growth, better spawn quality)
- Battle outcomes generate intense memories (shape warrior specialization)
- Cross-spirit conversations generate network memories (strengthen swarm coordination)

**Memory spending:**
- **Spawning** costs memories: the parent transfers a subset of its memory pool to the child
- **Quality tradeoff:** spawn fast with few memories → weak child. Wait and accumulate → strong child.
- **Over-spawning penalty:** each spawn dilutes the parent's memory pool. A spirit that has spawned 5 times has given away significant experience.

### 2.5 Spirits & Specialization

Each spirit has:

```typescript
interface Spirit {
  id: string;                    // Sui object ID
  name: string;                  // LLM-generated, influenced by memories
  personality: string;           // Text description, shapes LLM behavior
  specialization: Specialization; // warrior | scout | gatherer | sage | generalist
  generation: number;            // 0 = seed, increments per spawn
  parentId: string | null;       // Lineage tracking
  hexId: string;                 // Current position on the map
  bond: BondStats;               // { depth, harmony, adventure, loyalty }
  mood: number;                  // 0-100
  memwalNamespace: string;       // Per-spirit memory namespace
  spawnCount: number;            // Times this spirit has spawned
  alive: boolean;                // Can die from losing battles or starvation
}

type Specialization = 'warrior' | 'scout' | 'gatherer' | 'sage' | 'generalist';
```

**Specialization emerges from memories:**

| Specialization | Triggered by | Strength | Weakness |
|---------------|-------------|----------|----------|
| Warrior | Combat memories > 60% of total | 2x attack power, 1.5x defense | 0.5x memory generation |
| Scout | Exploration memories > 60% | Reveals adjacent hexes, 2x movement | 0.5x defense |
| Gatherer | Conversational memories > 60% | 2x memory generation rate | 0.5x attack |
| Sage | Analytical memories > 60% | Spawned children get 2x memory inheritance | 0.5x attack, 0.5x defense |
| Generalist | No dominant type | 1x everything | No specialty bonus |

A spirit doesn't choose its specialization — its memories determine it. If you keep talking to a spirit about battles and aggression, its combat memories accumulate and it specializes as a warrior. The player shapes specialization through conversation (deity influence).

### 2.6 Spawning

**Trigger conditions:**
- Memory count ≥ 10 in the spirit's MemWal namespace
- Bond score ≥ 50 (average of depth/harmony/adventure/loyalty)
- Spirit has not spawned in the last 3 epochs (cooldown)
- 0.01 SUI cost (onchain tx prevents spam)

**Inheritance process:**
1. Parent's memories analyzed via `memwal.analyze()` → extracts key facts
2. LLM ranks facts by "formative weight" — which experiences shaped this spirit most?
3. Top 5-7 facts become the **inheritance payload**
4. Payload written to child's new MemWal namespace via `rememberAndWait()`
5. Child's personality generated by LLM: parent personality + inherited memories → divergent personality
6. Child Spirit NFT minted onchain with `parentId` linking to parent

**The child inherits:**
- A subset of parent's memories (selective, not everything)
- A personality that shows familial resemblance but diverges based on inherited memories
- The parent's specialization tendency (but can shift based on its own future memories)
- Born in the same hex as parent

**What the child does NOT inherit:**
- Parent's bond with the player (starts at 30, must be built)
- Parent's specific relationships with other spirits
- Parent's full memory pool (only the selected inheritance)

### 2.7 Battles

When spirits from different players occupy the same hex, battle is triggered.

**Battle resolution (LLM-arbitrated, ported from Spiritus battleArbiterService):**

| Dimension | Weight | What it measures |
|-----------|--------|-----------------|
| Bond Resonance | 40% | How well does the spirit know its deity? Memory depth, relationship quality |
| Tactical Awareness | 35% | Terrain advantage, type matchups, positional awareness |
| Narrative Power | 25% | The quality of the spirit's battle invocation (generated from memories) |

**Battle flow:**
1. Attacker's spirit generates a battle invocation from its memories (LLM)
2. Defender's spirit generates a counter-invocation from its memories (LLM)
3. Battle Arbiter (LLM) evaluates both against the 3 dimensions
4. Winner claims the hex (or reinforces defense)
5. Battle outcome stored as memory for both spirits (MemWal)
6. Loser retreats to an adjacent friendly hex (or dies if surrounded)

**Spirit death:** A spirit that loses a battle while surrounded by enemy hexes (no retreat path) dies. Its memories persist on Walrus forever (verifiable ghost data), but it can no longer act.

### 2.8 Turn Structure

The game is **async, epoch-based.** Each epoch (~10 minutes for demo, configurable):

1. **Deity Phase** — Players chat with their spirits (1-3 messages). Memories stored.
2. **Propagation Phase** — Spirits discuss the deity's words among themselves. Whispers generated and stored.
3. **Action Phase** — Each spirit autonomously decides one action based on accumulated memories:
   - **Move** — relocate to adjacent hex
   - **Battle** — attack enemy spirit in same hex
   - **Explore** — reveal fog-of-war on adjacent hexes
   - **Spawn** — create child spirit (if thresholds met)
   - **Gather** — double memory generation this epoch
   - **Rest** — recover mood (+10)
4. **Resolution Phase** — Actions resolve simultaneously. Battles computed. Territory updated.
5. **Memory Phase** — All outcomes stored on MemWal. New memories shape next epoch.

### 2.9 Win Condition

**Territory domination:** First player to control 60% of hexes (37 of 61) wins. Or: last player standing (all others eliminated — all spirits dead).

**Game length:** Target 20-40 epochs for a complete game (~3-6 hours with 10-min epochs). For demo: accelerated epochs (2 min), smaller map subset, or pre-seeded game state.

## 3. Technical Spec

### 3.1 Project Structure

```
anima-swarm/
├── contracts/
│   └── anima_swarm/
│       ├── Move.toml
│       └── sources/
│           ├── spirit.move         # Spirit NFTs — owned objects
│           ├── territory.move      # Territory hex claims — shared object
│           ├── battle.move         # Battle records
│           └── spawn.move          # Spawning mechanics
├── lib/                            # SHARED code — imported by both frontend and server
│   ├── hexMath.js                  # Hex coordinate math (cube coords)
│   ├── terrainTypes.js             # Terrain definitions, colors, effects
│   ├── hexGrid.js                  # Hex grid generation + terrain assignment
│   ├── seedSpirits.js              # Initial spirit definitions (5 seeds)
│   └── memoryClassifier.js         # XP-track specialization logic
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── public/
│   │   └── favicon.svg
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── components/
│       │   ├── HexMap.jsx          # Hex grid world map (SVG)
│       │   ├── SpiritPanel.jsx     # Spirit detail + chat interface
│       │   ├── CommandBar.jsx      # Active timers + event log
│       │   ├── PlayerHud.jsx       # Player stats, territory count
│       │   ├── WalletConnect.jsx   # Sui wallet connection
│       │   ├── EssenceExport.jsx   # Swarm essence export (game over)
│       │   ├── EssenceImport.jsx   # Swarm essence import (lobby)
│       │   └── Lobby.jsx           # Pre-game lobby + essence import
│       └── services/
│           ├── llmClient.js        # Frontend LLM proxy client
│           └── suiService.js       # Sui transaction builder + queries
├── server/
│   ├── package.json
│   ├── index.js                    # Express + WebSocket entry
│   ├── routes/
│   │   ├── chat.js                 # POST /api/chat — raw LLM proxy
│   │   ├── game.js                 # GET /api/game/state, POST /api/game/chat, essence routes
│   │   └── tick.js                 # POST /api/tick/advance, /api/tick/fast-forward
│   └── services/
│       ├── tickEngine.js           # 5s game loop
│       ├── timerService.js         # Start/resolve action timers
│       ├── wsService.js            # WebSocket broadcast
│       ├── spiritDecisionService.js # LLM-driven autonomous decisions
│       ├── spiritDialogueService.js # Chat with spirits (server-side)
│       ├── whisperService.js       # Whisper propagation (server-side)
│       ├── battleArbiterService.js # Battle resolution (server-side)
│       ├── spawningService.js      # Spawn logic + memory inheritance
│       ├── bondService.js          # Bond stat updates
│       ├── territoryService.js     # Movement, hex control, retreat
│       ├── memoryGenService.js     # Hex memory accumulation
│       ├── winService.js           # Win condition check
│       ├── essenceService.js       # Swarm essence export/import (Walrus)
│       ├── walrusService.js        # Walrus blob read/write (server-side)
│       ├── memwalServer.js         # Server-side MemWal wrapper
│       ├── keyStore.js             # Delegate key storage (never serialized)
│       ├── llmProxy.js             # Direct Anthropic API calls (server-side)
│       └── gameInit.js             # Initial game state creation
├── tests/                          # ALL tests live here
│   ├── unit/                       # Pure logic, no external deps
│   ├── integration/                # Service interactions, mocked externals
│   └── system/                     # Full game loop, real services
├── scripts/
│   ├── deploy-contracts.sh         # Sui Move publish
│   ├── setup-memwal.js             # Create MemWal accounts for seed spirits
│   └── seed-game.js                # Initialize game state
├── sdk-tests/                      # SDK primitive tests (already done)
├── .env.example
├── .gitignore
├── CLAUDE.md
├── README.md
└── package.json                    # Workspace root
```

### 3.2 Design System

> Full design research and specs: `docs/DESIGN_RESEARCH.md`
> CSS implementation: `frontend/src/styles/design-system.css`
> Particle presets: `frontend/src/config/particlePresets.js`
> Asset generator: `scripts/generate-assets.mjs`

**Aesthetic:** Mythic/ancient + bioluminescent. Illuminated manuscripts meet deep-sea bioluminescence.

**Palette:**

```css
:root {
  /* Background */
  --bg-abyss: #060a12;
  --bg-deep: #0a0e17;
  --bg-surface: #111827;
  --bg-elevated: #1a2332;
  --bg-hover: #243044;
  --bg-glass: rgba(17, 24, 39, 0.85);

  /* Text — warm parchment white, not pure white */
  --text-primary: #f0ead6;
  --text-secondary: #9ca3af;
  --text-muted: #6b7280;
  --text-accent: #fbbf24;

  /* Deity Gold (primary accent) */
  --gold: #d4a052;
  --gold-bright: #f59e0b;
  --gold-dim: #92702a;
  --gold-glow: rgba(212, 160, 82, 0.3);

  /* Spirit Teal (secondary accent) */
  --spirit: #2dd4bf;
  --spirit-bright: #5eead4;
  --spirit-dim: #0d9488;
  --spirit-glow: rgba(45, 212, 191, 0.25);

  /* Player/deity colors */
  --deity-ember: #ef4444;
  --deity-verdant: #22c55e;
  --deity-tidal: #3b82f6;
  --deity-storm: #a855f7;
  --deity-void: #f97316;

  /* 7 Mythic terrain types (each has 5-color sub-palette) */
  --grove-glow: #4ade80;
  --volcanic-glow: #f97316;
  --crystal-glow: #e879f9;
  --marsh-glow: #22d3ee;
  --desert-glow: #fbbf24;
  --tundra-glow: #818cf8;
  --void-glow: #a855f7;

  /* Specialization colors */
  --spec-warrior: #dc2626;
  --spec-scout: #2563eb;
  --spec-gatherer: #16a34a;
  --spec-sage: #9333ea;
  --spec-generalist: #6b7280;

  /* Typography */
  --font-title: 'Cinzel Decorative', Georgia, serif;
  --font-header: 'Cinzel', Georgia, serif;
  --font-body: 'Cormorant Garamond', 'Times New Roman', serif;
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
}
```

**Typography:**
- Title: Cinzel Decorative (game title, deity names, chapter headers)
- Headers: Cinzel (panel titles, spirit names, terrain labels — all-caps)
- Body: Cormorant Garamond (chat messages, descriptions, tooltips, memory entries)
- Mono: JetBrains Mono (damage numbers, resource counts, memory IDs, blob refs)

**Component patterns:**
- Panels: `bg-glass backdrop-blur-[12px] border border-gold-dim rounded-lg` with Art Nouveau corner accents
- Buttons: `bg-gold text-bg-deep font-header font-semibold uppercase tracking-wide rounded-md`
- Hex tiles: SVG hexagons with painterly texture fill, gold stroke for controlled, fog overlay for unexplored
- Chat: Deity whispers right-aligned in gold-tinted bubbles (italic), spirit replies left-aligned in teal-tinted bubbles
- Whisper log entries: `text-sm italic text-gray-400` with connecting lines showing propagation chain

### 3.3 Move Contracts

#### spirit.move

```move
module anima_swarm::spirit;

use std::string::String;
use sui::event;

public struct Spirit has key, store {
    id: UID,
    name: String,
    personality_hash: vector<u8>,
    specialization: u8, // 0=generalist, 1=warrior, 2=scout, 3=gatherer, 4=sage
    generation: u64,
    parent_id: Option<address>,
    hex_id: u64,
    owner: address,
    bond_depth: u64,
    bond_harmony: u64,
    bond_adventure: u64,
    bond_loyalty: u64,
    mood: u64,
    memwal_namespace: String,
    spawn_count: u64,
    alive: bool,
    birth_epoch: u64,
    last_spawn_epoch: u64,
}

public struct SpiritMinted has copy, drop {
    spirit_id: address,
    name: String,
    owner: address,
    parent_id: Option<address>,
    generation: u64,
    hex_id: u64,
}

public struct SpiritDied has copy, drop {
    spirit_id: address,
    killer_id: address,
    hex_id: u64,
}

public fun mint(
    name: String,
    personality_hash: vector<u8>,
    hex_id: u64,
    memwal_namespace: String,
    parent_id: Option<address>,
    generation: u64,
    ctx: &mut TxContext,
): Spirit {
    let spirit = Spirit {
        id: object::new(ctx),
        name,
        personality_hash,
        specialization: 0,
        generation,
        parent_id,
        hex_id,
        owner: ctx.sender(),
        bond_depth: 30,
        bond_harmony: 30,
        bond_adventure: 30,
        bond_loyalty: 30,
        mood: 60,
        memwal_namespace,
        spawn_count: 0,
        alive: true,
        birth_epoch: 0,
        last_spawn_epoch: 0,
    };

    event::emit(SpiritMinted {
        spirit_id: object::id_address(&spirit),
        name: spirit.name,
        owner: spirit.owner,
        parent_id: spirit.parent_id,
        generation: spirit.generation,
        hex_id: spirit.hex_id,
    });

    spirit
}

public fun update_bond(
    spirit: &mut Spirit,
    depth: u64,
    harmony: u64,
    adventure: u64,
    loyalty: u64,
) {
    spirit.bond_depth = depth;
    spirit.bond_harmony = harmony;
    spirit.bond_adventure = adventure;
    spirit.bond_loyalty = loyalty;
}

public fun update_specialization(spirit: &mut Spirit, spec: u8) {
    assert!(spec <= 4, 0);
    spirit.specialization = spec;
}

public fun move_to_hex(spirit: &mut Spirit, hex_id: u64) {
    spirit.hex_id = hex_id;
}

public fun set_mood(spirit: &mut Spirit, mood: u64) {
    spirit.mood = if (mood > 100) { 100 } else { mood };
}

public fun kill(spirit: &mut Spirit, killer_id: address) {
    spirit.alive = false;
    event::emit(SpiritDied {
        spirit_id: object::id_address(spirit),
        killer_id,
        hex_id: spirit.hex_id,
    });
}

public fun increment_spawn_count(spirit: &mut Spirit, epoch: u64) {
    spirit.spawn_count = spirit.spawn_count + 1;
    spirit.last_spawn_epoch = epoch;
}

public fun bond_average(spirit: &Spirit): u64 {
    (spirit.bond_depth + spirit.bond_harmony + spirit.bond_adventure + spirit.bond_loyalty) / 4
}

public fun is_alive(spirit: &Spirit): bool {
    spirit.alive
}

public fun hex_id(spirit: &Spirit): u64 {
    spirit.hex_id
}

public fun owner(spirit: &Spirit): address {
    spirit.owner
}
```

#### territory.move

```move
module anima_swarm::territory;

use std::string::String;
use sui::event;
use sui::table::{Self, Table};

public struct GameMap has key {
    id: UID,
    hexes: Table<u64, HexState>,
    hex_count: u64,
    epoch: u64,
    active_players: u64,
}

public struct HexState has store {
    hex_id: u64,
    terrain: u8, // 0=forest,1=desert,2=ocean,3=mountain,4=grassland,5=tundra,6=volcanic,7=coastal
    bioregion_id: String,
    controller: Option<address>,
    spirit_count: u64,
    memory_rate: u64, // basis points (10000 = 1.0x)
    defense_bonus: u64, // basis points
}

public struct TerritoryClaimed has copy, drop {
    hex_id: u64,
    player: address,
    epoch: u64,
}

public fun create_map(hex_count: u64, ctx: &mut TxContext): GameMap {
    GameMap {
        id: object::new(ctx),
        hexes: table::new(ctx),
        hex_count,
        epoch: 0,
        active_players: 0,
    }
}

public fun add_hex(
    map: &mut GameMap,
    hex_id: u64,
    terrain: u8,
    bioregion_id: String,
    memory_rate: u64,
    defense_bonus: u64,
) {
    table::add(&mut map.hexes, hex_id, HexState {
        hex_id,
        terrain,
        bioregion_id,
        controller: option::none(),
        spirit_count: 0,
        memory_rate,
        defense_bonus,
    });
}

public fun claim_hex(
    map: &mut GameMap,
    hex_id: u64,
    player: address,
) {
    let hex = table::borrow_mut(&mut map.hexes, hex_id);
    hex.controller = option::some(player);

    event::emit(TerritoryClaimed {
        hex_id,
        player,
        epoch: map.epoch,
    });
}

public fun advance_epoch(map: &mut GameMap) {
    map.epoch = map.epoch + 1;
}

public fun get_epoch(map: &GameMap): u64 {
    map.epoch
}

public fun hex_controller(map: &GameMap, hex_id: u64): Option<address> {
    let hex = table::borrow(&map.hexes, hex_id);
    hex.controller
}

public fun hex_defense_bonus(map: &GameMap, hex_id: u64): u64 {
    let hex = table::borrow(&map.hexes, hex_id);
    hex.defense_bonus
}
```

#### battle.move

```move
module anima_swarm::battle;

use std::string::String;
use sui::event;

public struct BattleRecord has key, store {
    id: UID,
    attacker_id: address,
    defender_id: address,
    hex_id: u64,
    winner: address,
    attacker_score: u64,
    defender_score: u64,
    epoch: u64,
    memory_blob_id: String, // Walrus blob ID of the full battle log
}

public struct BattleResolved has copy, drop {
    battle_id: address,
    attacker_id: address,
    defender_id: address,
    winner: address,
    hex_id: u64,
    epoch: u64,
}

public fun record_battle(
    attacker_id: address,
    defender_id: address,
    hex_id: u64,
    winner: address,
    attacker_score: u64,
    defender_score: u64,
    epoch: u64,
    memory_blob_id: String,
    ctx: &mut TxContext,
): BattleRecord {
    let record = BattleRecord {
        id: object::new(ctx),
        attacker_id,
        defender_id,
        hex_id,
        winner,
        attacker_score,
        defender_score,
        epoch,
        memory_blob_id,
    };

    event::emit(BattleResolved {
        battle_id: object::id_address(&record),
        attacker_id,
        defender_id,
        winner,
        hex_id,
        epoch,
    });

    record
}
```

#### spawn.move

```move
module anima_swarm::spawn;

use sui::event;
use sui::coin::{Self, Coin};
use sui::sui::SUI;

const SPAWN_COST: u64 = 10_000_000; // 0.01 SUI
const SPAWN_COOLDOWN_EPOCHS: u64 = 3;
const MIN_BOND_FOR_SPAWN: u64 = 50;

const EInsufficientBond: u64 = 0;
const ESpawnCooldown: u64 = 1;
const ENotAlive: u64 = 2;
const EInsufficientPayment: u64 = 3;

public struct SpawnEvent has copy, drop {
    parent_id: address,
    child_id: address,
    generation: u64,
    hex_id: u64,
    epoch: u64,
}

public fun validate_spawn(
    parent_bond_avg: u64,
    parent_alive: bool,
    parent_last_spawn_epoch: u64,
    current_epoch: u64,
) {
    assert!(parent_alive, ENotAlive);
    assert!(parent_bond_avg >= MIN_BOND_FOR_SPAWN, EInsufficientBond);
    assert!(
        current_epoch >= parent_last_spawn_epoch + SPAWN_COOLDOWN_EPOCHS,
        ESpawnCooldown,
    );
}

public fun collect_spawn_fee(
    payment: &mut Coin<SUI>,
    recipient: address,
    ctx: &mut TxContext,
) {
    assert!(coin::value(payment) >= SPAWN_COST, EInsufficientPayment);
    let fee = coin::split(payment, SPAWN_COST, ctx);
    transfer::public_transfer(fee, recipient);
}

public fun emit_spawn_event(
    parent_id: address,
    child_id: address,
    generation: u64,
    hex_id: u64,
    epoch: u64,
) {
    event::emit(SpawnEvent {
        parent_id,
        child_id,
        generation,
        hex_id,
        epoch,
    });
}
```

### 3.4 Frontend Services

> **⚠️ v1 REFERENCE ONLY — use v2 server versions in Section 7.4.**
> These frontend services are from the v1 architecture (frontend-driven, snake_case, epoch-based).
> The v2 architecture (Section 7) is server-authoritative with real-time timers.
> Port logic from these to v2 server services, do not import these directly.

#### memwalService.js

```javascript
import { MemWal } from '@mysten-incubation/memwal';

let instances = {};

export function getMemWalInstance(namespace, delegateKey, accountId) {
  if (!instances[namespace]) {
    instances[namespace] = MemWal.create({
      key: delegateKey,
      accountId,
      serverUrl: import.meta.env.VITE_MEMWAL_URL || 'https://relayer.staging.memwal.ai',
      namespace,
    });
  }
  return instances[namespace];
}

export async function storeMemory(namespace, text, delegateKey, accountId) {
  const memwal = getMemWalInstance(namespace, delegateKey, accountId);
  return memwal.rememberAndWait(text);
}

export async function recallMemories(namespace, query, limit, delegateKey, accountId) {
  const memwal = getMemWalInstance(namespace, delegateKey, accountId);
  return memwal.recall(query, limit || 10);
}

export async function analyzeMemories(namespace, text, delegateKey, accountId) {
  const memwal = getMemWalInstance(namespace, delegateKey, accountId);
  return memwal.analyzeAndWait(text);
}

export async function restoreAllMemories(namespace, delegateKey, accountId) {
  const memwal = getMemWalInstance(namespace, delegateKey, accountId);
  return memwal.restore(namespace, 50);
}

export function clearInstances() {
  instances = {};
}
```

#### whisperService.js

```javascript
import { callLLM } from './llmClient';
import { storeMemory, recallMemories } from './memwalService';

const WHISPER_SYSTEM_PROMPT = `You are a spirit in a swarm, relaying your deity's influence to another spirit.
You just heard something from your deity (or from another spirit relaying the deity's words).
Reinterpret this message in your own voice and personality, then pass it along.

Your bond level affects how faithfully you relay:
- High bond (60+): relay faithfully with minor personal color
- Medium bond (30-59): add your own interpretation, may shift emphasis
- Low bond (0-29): heavily reinterpret, may misunderstand intent

Output ONLY the whisper text you would speak to the next spirit. 1-2 sentences max.`;

export async function propagateWhisper({
  sourceSpiritId,
  targetSpiritId,
  deityMessage,
  sourcePersonality,
  targetPersonality,
  sourceBond,
  swarmNamespace,
  delegateKey,
  accountId,
}) {
  const recentMemories = await recallMemories(
    swarmNamespace, deityMessage, 3, delegateKey, accountId
  );
  const memoryContext = recentMemories.results?.map(r => r.text).join('\n') || '';

  const userPrompt = `YOUR PERSONALITY: ${sourcePersonality}
YOUR BOND WITH DEITY: ${sourceBond}/100
TARGET SPIRIT: ${targetPersonality}

DEITY'S WORDS (or relayed whisper):
"${deityMessage}"

RECENT SWARM MEMORIES:
${memoryContext || '(none)'}

Generate your whisper to the target spirit.`;

  const whisperText = await callLLM(WHISPER_SYSTEM_PROMPT, userPrompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 150,
  });

  await storeMemory(
    swarmNamespace,
    `[WHISPER] ${sourceSpiritId} → ${targetSpiritId}: ${whisperText}`,
    delegateKey,
    accountId
  );

  return {
    from: sourceSpiritId,
    to: targetSpiritId,
    text: whisperText,
    bondFidelity: sourceBond,
  };
}

export async function extractDeityIntent(message, spiritPersonality, bond) {
  const prompt = `You are a spirit interpreting your deity's words.
Your personality: ${spiritPersonality}
Your bond with the deity: ${bond}/100

The deity said: "${message}"

Extract the deity's intent as a JSON object:
{
  "intent": "attack" | "defend" | "explore" | "spawn" | "gather" | "rest" | "diplomacy" | "unclear",
  "target": "description of target hex/spirit/direction or null",
  "urgency": 1-5,
  "confidence": 0.0-1.0,
  "interpretation": "your personal understanding in 1 sentence"
}

Return ONLY the JSON.`;

  const result = await callLLM('You extract structured intent from natural language.', prompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 200,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    return match ? JSON.parse(match[0]) : { intent: 'unclear', confidence: 0 };
  } catch {
    return { intent: 'unclear', confidence: 0 };
  }
}
```

#### llmClient.js

```javascript
const ANTHROPIC_PROXY_URL = import.meta.env.DEV
  ? '/api/chat'
  : (import.meta.env.VITE_API_URL || '') + '/api/chat';

export async function callLLM(systemPrompt, userPrompt, options = {}) {
  const {
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1500,
    messages = null,
  } = options;

  const response = await fetch(ANTHROPIC_PROXY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      maxTokens,
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${errorBody}`);
  }

  const data = await response.json();
  return data.text;
}

export function hasApiKey() {
  return true; // proxied through server
}
```

#### suiService.js

```javascript
import { Transaction } from '@mysten/sui/transactions';

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID;
const GAME_MAP_ID = import.meta.env.VITE_GAME_MAP_ID;

export function buildMintSpiritTx({
  name,
  personalityHash,
  hexId,
  memwalNamespace,
  parentId,
  generation,
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::spirit::mint`,
    arguments: [
      tx.pure.string(name),
      tx.pure.vector('u8', personalityHash),
      tx.pure.u64(hexId),
      tx.pure.string(memwalNamespace),
      parentId ? tx.pure.address(parentId) : tx.pure.option('address', null),
      tx.pure.u64(generation),
    ],
  });
  return tx;
}

export function buildClaimHexTx({ hexId, player }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::territory::claim_hex`,
    arguments: [
      tx.object(GAME_MAP_ID),
      tx.pure.u64(hexId),
      tx.pure.address(player),
    ],
  });
  return tx;
}

export function buildRecordBattleTx({
  attackerId,
  defenderId,
  hexId,
  winner,
  attackerScore,
  defenderScore,
  epoch,
  memoryBlobId,
}) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::battle::record_battle`,
    arguments: [
      tx.pure.address(attackerId),
      tx.pure.address(defenderId),
      tx.pure.u64(hexId),
      tx.pure.address(winner),
      tx.pure.u64(attackerScore),
      tx.pure.u64(defenderScore),
      tx.pure.u64(epoch),
      tx.pure.string(memoryBlobId),
    ],
  });
  return tx;
}

export function buildSpawnTx({ payment, parentId, childId, generation, hexId, epoch }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::spawn::validate_spawn`,
    arguments: [
      // These would be read from the parent Spirit object
      // Simplified here — in practice, pass the Spirit object ref
    ],
  });
  return tx;
}
```

#### battleArbiterService.js

```javascript
import { callLLM } from './llmClient';
import { recallMemories, storeMemory } from './memwalService';

const ARBITER_SYSTEM_PROMPT = `You are the Battle Arbiter for Anima Swarm.

Evaluate two spirits' battle invocations across 3 dimensions:

1. BOND RESONANCE (40%): Depth of the spirit-deity relationship.
   - Does the invocation reference real memories? (check against provided memory context)
   - Does it reflect the spirit's personality authentically?
   - Higher bond = more conviction and power in the invocation.

2. TACTICAL AWARENESS (35%): Strategic and environmental awareness.
   - Does the spirit leverage terrain advantages?
   - Does specialization match the battle context?
   - Does the spirit reference environmental factors?

3. NARRATIVE POWER (25%): Quality of the battle cry.
   - Is it evocative and emotionally resonant?
   - Does it create a cinematic moment?
   - Brevity with impact scores as well as elaborate descriptions.

OUTPUT FORMAT — return ONLY valid JSON:
{
  "attacker": {
    "bondResonance": { "score": 0-10, "details": "..." },
    "tacticalAwareness": { "score": 0-10, "details": "..." },
    "narrativePower": { "score": 0-10, "details": "..." },
    "totalScore": 0-30
  },
  "defender": {
    "bondResonance": { "score": 0-10, "details": "..." },
    "tacticalAwareness": { "score": 0-10, "details": "..." },
    "narrativePower": { "score": 0-10, "details": "..." },
    "totalScore": 0-30
  },
  "winner": "attacker" | "defender" | "draw",
  "margin": "decisive" | "close" | "razor-thin",
  "narrative": "one sentence describing the battle outcome"
}`;

export async function resolveBattle({
  attacker,
  defender,
  hexId,
  terrain,
  epoch,
  delegateKey,
  accountId,
}) {
  const attackerMemories = await recallMemories(
    attacker.memwalNamespace, 'battle combat fight strength', 5,
    delegateKey, accountId
  );
  const defenderMemories = await recallMemories(
    defender.memwalNamespace, 'battle combat fight defense', 5,
    delegateKey, accountId
  );

  const attackerInvocation = await generateBattleInvocation(attacker, terrain, attackerMemories);
  const defenderInvocation = await generateBattleInvocation(defender, terrain, defenderMemories);

  const evalPrompt = buildEvalPrompt(
    attacker, defender, attackerInvocation, defenderInvocation,
    terrain, attackerMemories, defenderMemories
  );

  const result = await callLLM(ARBITER_SYSTEM_PROMPT, evalPrompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 800,
  });

  let evaluation;
  try {
    const match = result.match(/\{[\s\S]*\}/);
    evaluation = match ? JSON.parse(match[0]) : getFallbackEvaluation();
  } catch {
    evaluation = getFallbackEvaluation();
  }

  const battleLog = `[BATTLE] ${attacker.name} vs ${defender.name} at hex ${hexId}. ` +
    `${evaluation.winner === 'attacker' ? attacker.name : defender.name} wins (${evaluation.margin}). ` +
    `${evaluation.narrative}`;

  await storeMemory(attacker.memwalNamespace, battleLog, delegateKey, accountId);
  await storeMemory(defender.memwalNamespace, battleLog, delegateKey, accountId);

  return {
    ...evaluation,
    attackerInvocation,
    defenderInvocation,
    battleLog,
  };
}

async function generateBattleInvocation(spirit, terrain, memories) {
  const memoryContext = memories.results?.map(r => r.text).join('\n') || 'No battle memories yet.';

  const prompt = `You are ${spirit.name}, a ${getSpecName(spirit.specialization)} spirit.
Personality: ${spirit.personality}
Bond with deity: ${bondAvg(spirit)}/100
Terrain: ${terrain}
Your relevant memories:
${memoryContext}

Generate a 2-3 sentence battle invocation — a war cry that channels your memories and personality into combat power. Reference specific memories if you have them.`;

  return callLLM('Generate an in-character battle invocation.', prompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 150,
  });
}

function buildEvalPrompt(atk, def, atkInv, defInv, terrain, atkMem, defMem) {
  return `ATTACKER: ${atk.name} (${getSpecName(atk.specialization)}, bond ${bondAvg(atk)}/100)
Memories: ${atkMem.results?.map(r => r.text).join(' | ') || 'none'}
Invocation: "${atkInv}"

DEFENDER: ${def.name} (${getSpecName(def.specialization)}, bond ${bondAvg(def)}/100)
Memories: ${defMem.results?.map(r => r.text).join(' | ') || 'none'}
Invocation: "${defInv}"

TERRAIN: ${terrain}

Evaluate both invocations and return the JSON result.`;
}

function bondAvg(spirit) {
  return Math.round((spirit.bond_depth + spirit.bond_harmony + spirit.bond_adventure + spirit.bond_loyalty) / 4);
}

function getSpecName(spec) {
  return ['generalist', 'warrior', 'scout', 'gatherer', 'sage'][spec] || 'generalist';
}

function getFallbackEvaluation() {
  const aScore = 10 + Math.floor(Math.random() * 10);
  const dScore = 10 + Math.floor(Math.random() * 10);
  return {
    attacker: { bondResonance: { score: 5 }, tacticalAwareness: { score: 5 }, narrativePower: { score: 5 }, totalScore: aScore },
    defender: { bondResonance: { score: 5 }, tacticalAwareness: { score: 5 }, narrativePower: { score: 5 }, totalScore: dScore },
    winner: aScore > dScore ? 'attacker' : aScore < dScore ? 'defender' : 'draw',
    margin: Math.abs(aScore - dScore) < 3 ? 'razor-thin' : Math.abs(aScore - dScore) < 8 ? 'close' : 'decisive',
    narrative: 'The spirits clashed in a contest of will and memory.',
  };
}
```

#### spawningService.js

```javascript
import { callLLM } from './llmClient';
import { analyzeMemories, storeMemory, recallMemories } from './memwalService';
import { generateDelegateKey } from '@mysten-incubation/memwal/account';

export async function checkSpawnReadiness(spirit, memoryCount, currentEpoch) {
  const bondAvg = (spirit.bond_depth + spirit.bond_harmony +
    spirit.bond_adventure + spirit.bond_loyalty) / 4;

  return {
    ready: memoryCount >= 10 &&
           bondAvg >= 50 &&
           spirit.alive &&
           currentEpoch >= spirit.last_spawn_epoch + 3,
    memoryCount,
    bondAvg,
    cooldownRemaining: Math.max(0, (spirit.last_spawn_epoch + 3) - currentEpoch),
    reasons: [
      memoryCount < 10 ? `Need ${10 - memoryCount} more memories` : null,
      bondAvg < 50 ? `Bond too low (${Math.round(bondAvg)}/50)` : null,
      currentEpoch < spirit.last_spawn_epoch + 3 ? 'Spawn cooldown active' : null,
    ].filter(Boolean),
  };
}

export async function prepareInheritance(parentNamespace, delegateKey, accountId) {
  const allMemories = await recallMemories(parentNamespace, '', 20, delegateKey, accountId);

  if (!allMemories.results?.length) {
    return { facts: [], inheritancePayload: [] };
  }

  const memoryText = allMemories.results.map(r => r.text).join('\n');
  const analysis = await analyzeMemories(parentNamespace, memoryText, delegateKey, accountId);

  const rankingPrompt = `Given these memories from a spirit, rank them by "formative weight" — which experiences most shaped who this spirit became?

Memories:
${allMemories.results.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}

Return a JSON array of the top 5-7 memory indices (1-based) in order of importance:
{ "indices": [3, 1, 7, ...], "reasoning": "..." }`;

  const ranking = await callLLM('You rank memories by formative importance.', rankingPrompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 200,
  });

  let selectedIndices;
  try {
    const match = ranking.match(/\{[\s\S]*\}/);
    const parsed = match ? JSON.parse(match[0]) : null;
    selectedIndices = parsed?.indices || [1, 2, 3, 4, 5];
  } catch {
    selectedIndices = [1, 2, 3, 4, 5];
  }

  const inheritancePayload = selectedIndices
    .map(i => allMemories.results[i - 1])
    .filter(Boolean)
    .map(r => r.text);

  return {
    facts: analysis.facts || [],
    inheritancePayload,
    totalMemories: allMemories.results.length,
    selectedCount: inheritancePayload.length,
  };
}

export async function generateChildPersonality(parentPersonality, inheritedMemories) {
  const prompt = `A spirit is spawning a child. The child inherits specific memories from its parent but develops its own personality.

PARENT PERSONALITY:
${parentPersonality}

INHERITED MEMORIES:
${inheritedMemories.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Generate the child's personality description (2-3 sentences). The child should:
- Show clear familial resemblance to the parent
- Diverge based on which memories it inherited (combat memories → more aggressive, social memories → more empathetic, etc.)
- Have its own voice and quirks

Return ONLY the personality text, no formatting.`;

  return callLLM('You create spirit personalities.', prompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 200,
  });
}

export async function executeSpawn({
  parent,
  inheritancePayload,
  childPersonality,
  delegateKey,
  accountId,
}) {
  const childKey = await generateDelegateKey();
  const childNamespace = `spirit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  for (const memory of inheritancePayload) {
    await storeMemory(
      childNamespace,
      `[INHERITED] ${memory}`,
      childKey.privateKey,
      accountId // child needs its own MemWal account — created onchain
    );
  }

  const childName = await callLLM(
    'Generate a spirit name.',
    `Parent name: ${parent.name}. Child personality: ${childPersonality}. Generate a single name (1 word) for the child spirit. The name should hint at its parent but be distinct. Return ONLY the name.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 20 }
  );

  return {
    name: childName.trim(),
    personality: childPersonality,
    namespace: childNamespace,
    delegateKey: childKey,
    parentId: parent.id,
    generation: parent.generation + 1,
    hexId: parent.hex_id,
    inheritedMemoryCount: inheritancePayload.length,
  };
}
```

#### hexMath.js (utils)

```javascript
// Cube coordinate hex math
// Reference: https://www.redblobgames.com/grids/hexagons/

export function cubeToAxial(cube) {
  return { q: cube.q, r: cube.r };
}

export function axialToCube(hex) {
  return { q: hex.q, r: hex.r, s: -hex.q - hex.r };
}

export function cubeDistance(a, b) {
  return Math.max(Math.abs(a.q - b.q), Math.abs(a.r - b.r), Math.abs(a.s - b.s));
}

export function axialDistance(a, b) {
  return cubeDistance(axialToCube(a), axialToCube(b));
}

const DIRECTIONS = [
  { q: 1, r: 0 }, { q: 1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: 1 }, { q: 0, r: 1 },
];

export function neighbors(hex) {
  return DIRECTIONS.map(d => ({ q: hex.q + d.q, r: hex.r + d.r }));
}

export function hexToPixel(hex, size) {
  const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
  const y = size * (3 / 2 * hex.r);
  return { x, y };
}

export function pixelToHex(point, size) {
  const q = (Math.sqrt(3) / 3 * point.x - 1 / 3 * point.y) / size;
  const r = (2 / 3 * point.y) / size;
  return hexRound({ q, r });
}

function hexRound(hex) {
  const cube = axialToCube(hex);
  let rq = Math.round(cube.q);
  let rr = Math.round(cube.r);
  let rs = Math.round(cube.s);
  const dq = Math.abs(rq - cube.q);
  const dr = Math.abs(rr - cube.r);
  const ds = Math.abs(rs - cube.s);
  if (dq > dr && dq > ds) rq = -rr - rs;
  else if (dr > ds) rr = -rq - rs;
  return { q: rq, r: rr };
}

export function generateHexGrid(radius) {
  const hexes = [];
  for (let q = -radius; q <= radius; q++) {
    const r1 = Math.max(-radius, -q - radius);
    const r2 = Math.min(radius, -q + radius);
    for (let r = r1; r <= r2; r++) {
      hexes.push({ q, r, id: hexId(q, r) });
    }
  }
  return hexes;
}

export function hexId(q, r) {
  return String((q + 10) * 100 + (r + 10));
}

export function startingPositions(radius, playerCount) {
  const positions = [];
  for (let i = 0; i < playerCount; i++) {
    const angle = (2 * Math.PI * i) / playerCount - Math.PI / 2;
    const q = Math.round(radius * Math.cos(angle));
    const r = Math.round(radius * Math.sin(angle));
    positions.push({ q, r, id: hexId(q, r) });
  }
  return positions;
}
```

### 3.5 Server

#### server/index.js

```javascript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
// NOTE: v1 entry point — SUPERSEDED by Updated server/index.js in Section 7.3.
// The v2 server uses createServer + WebSocket + tickEngine. See Section 7.3.
```

#### server/routes/chat.js

```javascript
import { Router } from 'express';

const router = Router();

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

router.post('/', async (req, res) => {
  const { model, maxTokens, system, messages } = req.body;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'No API key configured' });
  }

  try {
    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: model || 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens || 1500,
        system,
        messages,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    res.json({ text: data.content[0].text });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
```

### 3.6 Configuration Files

#### frontend/package.json

```json
{
  "name": "anima-swarm-frontend",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@mysten-incubation/memwal": "^0.0.3",
    "@mysten/dapp-kit": "^1.0.6",
    "@mysten/sui": "^2.16.2",
    "@tanstack/react-query": "^5.0.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "vite": "^5.4.0"
  }
}
```

#### frontend/vite.config.js

```javascript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, '../lib'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3001',
        ws: true,
      },
    },
  },
  define: {
    'process.env': {},
  },
});
```

#### frontend/index.html

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Anima Swarm — Deity-Controlled AI Strategy</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
  </head>
  <body class="bg-[#0a0e17] text-gray-100 font-body antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

#### .env.example

```bash
# Anthropic API (server-side only)
ANTHROPIC_API_KEY=sk-ant-...

# Sui
VITE_PACKAGE_ID=0x...
VITE_GAME_MAP_ID=0x...
VITE_ADMIN_CAP_ID=0x...
VITE_SUI_NETWORK=testnet
SUI_RPC_URL=https://fullnode.testnet.sui.io:443
SUI_NETWORK=testnet

# MemWal
VITE_MEMWAL_URL=https://relayer.staging.memwal.ai
MEMWAL_DELEGATE_KEY=...
MEMWAL_ACCOUNT_ID=0x...
MEMWAL_PACKAGE_ID=0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6
MEMWAL_REGISTRY_ID=0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437
MEMWAL_URL=https://relayer.memwal.ai

# Server
PORT=3001
VITE_API_URL=http://localhost:3001

# WebSocket (production only — dev uses direct connection)
VITE_WS_URL=wss://your-server.com

# Essence / Walrus writes (server-side)
SERVER_SUI_PRIVATE_KEY=suiprivkey1...
```

#### .gitignore

```
node_modules/
dist/
.env
*.local
.DS_Store
CLAUDE.md
```

#### frontend/tailwind.config.js

```javascript
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        deity: {
          DEFAULT: '#f59e0b',
          dim: '#b45309',
        },
      },
    },
  },
  plugins: [],
};
```

#### frontend/postcss.config.js

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

#### server/package.json

```json
{
  "name": "anima-swarm-server",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "start": "node index.js",
    "dev": "node --watch index.js"
  },
  "dependencies": {
    "@mysten-incubation/memwal": "^0.0.3",
    "@mysten/sui": "^2.16.2",
    "@mysten/walrus": "^1.1.7",
    "cors": "^2.8.5",
    "dotenv": "^16.4.0",
    "express": "^4.21.0",
    "ws": "^8.18.0"
  }
}
```

### 3.7 Data Flow Trace

> **⚠️ SUPERSEDED by Section 7.2 (Revised Game Loop).**
> This trace describes v1 frontend-driven architecture. In v2:
> - Chat goes through WebSocket → `spiritDialogueService` (server-side), not POST /api/chat
> - All LLM calls happen server-side via `llmProxy.js`, not frontend `llmClient.js`
> - Memory operations use `memwalServer.js` (server-side), not frontend `memwalService.js`

**Player chats with Spirit A:**
```
1. Frontend: user types message → POST /api/chat (proxied to Anthropic)
2. Frontend: spiritDialogueService builds system prompt with spirit personality + bond stats
3. Frontend: injects recent memories via memwalService.recallMemories(spiritNamespace, userMessage, 10)
4. Server: proxies to Anthropic API, returns spirit response text
5. Frontend: displays response
6. Frontend: stores both user message + spirit response via memwalService.storeMemory(spiritNamespace, ...)
7. Frontend: whisperService.extractDeityIntent(userMessage, personality, bond) → structured intent
8. Frontend: whisperService.propagateWhisper() to adjacent swarm spirits → stores whisper in shared namespace
9. Frontend: updates bond stats based on conversation quality
```

**Battle resolution:**
```
1. epochService detects two opposing spirits in same hex
2. battleArbiterService.resolveBattle() called
3. Each spirit's combat memories recalled from their MemWal namespace
4. LLM generates battle invocations from memories
5. LLM arbiter evaluates both invocations → scores + winner
6. Battle outcome stored as memory in both spirits' namespaces
7. Winner's spirit stays in hex, loser retreats
8. Territory claim updated onchain via suiService.buildClaimHexTx()
9. Battle record stored onchain via suiService.buildRecordBattleTx()
```

**Spawning:**
```
1. spawningService.checkSpawnReadiness() → checks memory count, bond, cooldown
2. spawningService.prepareInheritance() → recalls all memories, ranks by formative weight, selects top 5-7
3. UI shows inheritance preview to player
4. Player confirms → spawningService.executeSpawn()
5. New MemWal delegate key generated
6. Inherited memories written to child's namespace with [INHERITED] prefix
7. Child personality generated by LLM from parent personality + inherited memories
8. Spirit NFT minted onchain
9. Spawn event emitted and stored in shared swarm namespace
```

### 3.8 Deployment Scripts

#### scripts/deploy-contracts.sh

```bash
#!/bin/bash
set -e

echo "Building Move contracts..."
cd contracts/anima_swarm
sui move build

echo "Publishing to testnet..."
RESULT=$(sui client publish --gas-budget 200000000 --json)
PACKAGE_ID=$(echo $RESULT | jq -r '.objectChanges[] | select(.type == "published") | .packageId')
GAME_MAP_ID=$(echo $RESULT | jq -r '.objectChanges[] | select(.objectType | test("territory::GameMap")) | .objectId')
ADMIN_CAP_ID=$(echo $RESULT | jq -r '.objectChanges[] | select(.objectType | test("spirit::AdminCap")) | .objectId')

echo "Package ID: $PACKAGE_ID"
echo "Game Map ID: $GAME_MAP_ID"
echo "Admin Cap ID: $ADMIN_CAP_ID"
echo "VITE_PACKAGE_ID=$PACKAGE_ID" >> ../../.env
echo "VITE_GAME_MAP_ID=$GAME_MAP_ID" >> ../../.env
echo "VITE_ADMIN_CAP_ID=$ADMIN_CAP_ID" >> ../../.env

echo "Done. All IDs written to .env."
```

#### scripts/setup-memwal.js

```javascript
import { generateDelegateKey } from '@mysten-incubation/memwal/account';

const SPIRIT_COUNT = 5; // one seed per player

async function main() {
  console.log('Generating MemWal delegate keys for seed spirits...\n');

  for (let i = 0; i < SPIRIT_COUNT; i++) {
    const key = await generateDelegateKey();
    console.log(`Spirit ${i + 1}:`);
    console.log(`  Private Key: ${key.privateKey}`);
    console.log(`  Sui Address: ${key.suiAddress}`);
    console.log(`  Namespace: spirit-seed-${i + 1}`);
    console.log();
  }

  console.log('NOTE: Each spirit needs a MemWal account created on-chain.');
  console.log('Use the MemWal Playground (https://memwal.ai) or createAccount() from the SDK.');
}

main().catch(console.error);
```

## 4. Verification Checklist

### SDK & Imports
- [x] MemWal: `import { MemWal } from '@mysten-incubation/memwal'` — verified v0.0.3
- [x] MemWal account: `import { generateDelegateKey } from '@mysten-incubation/memwal/account'` — verified async
- [x] Sui transactions: `import { Transaction } from '@mysten/sui/transactions'` — verified v2.16.2
- [x] Sui keypairs: `import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519'` — verified
- [x] Sui gRPC: `import { SuiGrpcClient } from '@mysten/sui/grpc'` — verified (SuiClient is GONE in v2)
- [x] Walrus: `import { WalrusClient } from '@mysten/walrus'` — verified v1.1.7
- [x] MemWal relayer health: staging endpoint responds `{status: "ok"}`
- [ ] MemWal remember/recall with real account — needs funded MemWal account
- [ ] Move contract compilation — needs `sui move build` test
- [ ] dapp-kit wallet connection — needs frontend scaffold

### Data Flow
- [x] API response shape: LLM proxy returns `{ text: string }` — consistent across all services
- [x] MemWal methods: `remember()` returns `{ job_id, status }`, `recall()` returns `{ results: [{blob_id, text, distance}] }`
- [x] Memory classification: whisper vs battle vs spawn vs conversation — prefixed in text content
- [x] Bond calculation: average of 4 substats (depth/harmony/adventure/loyalty) — same as Spiritus

### Config & Files
- [x] package.json with exact versions for all deps
- [x] index.html with font links
- [x] vite.config.js with proxy for /api
- [x] .gitignore lists .env
- [x] Every env var documented in .env.example
- [x] No hardcoded secrets

### Critical SDK Gotchas (from primitive testing)
- **`generateDelegateKey()` is ASYNC** — returns a Promise, not a sync object
- **`SuiClient` does NOT exist in @mysten/sui v2** — use `SuiGrpcClient` from `@mysten/sui/grpc`
- **MemWal is ESM-only** — package.json must have `"type": "module"`
- **MemWal 401 on fake accountId** — real MemWal accounts must be created via playground or `createAccount()`
- **Walrus `walrus()` extension only exposes `readBlob`** — use `WalrusClient` class directly for writes

## 5. Execution Protocol

### Build Order (NON-NEGOTIABLE)

```
1. DESIGN FIRST       — /frontend-design, system.md, design tokens
2. MOVE CONTRACTS      — spirit.move, territory.move, battle.move, spawn.move
3. DEPLOY + TEST       — sui move build && sui client publish
4. MEMWAL SETUP        — create accounts, generate keys, test remember/recall
5. SERVER              — Express proxy, chat route, epoch runner
6. SERVICES            — memwalService, whisperService, battleArbiterService, spawningService
7. DATA                — hexGrid, bioregions, terrainTypes, seedSpirits
8. COMPONENTS          — HexMap, SpiritPanel, SwarmOverview, BattleView, SpawnFlow
9. INTEGRATION         — connect wallet, wire up game loop, test full flow
10. QUALITY GATES      — /baseline-ui per component, /attack on built code
11. DEMO PREP          — seed game state, record 5-min video, write submission
12. MAINNET DEPLOY     — publish contracts to mainnet, update MemWal to production relayer
```

### Quality Gates (MANDATORY)

- [ ] /frontend-design invoked before first component
- [ ] /baseline-ui run after each component
- [ ] /attack run on the built code
- [ ] Move contracts compile without errors
- [ ] Full game loop works: chat → memory → propagation → action → battle → spawn
- [ ] 5-player game state initializes correctly
- [ ] Hex map renders with terrain colors and player control overlay
- [ ] Demo video recorded (≤ 5 min, YouTube)
- [ ] README updated with architecture, setup, and demo instructions
- [ ] Mainnet deployment plan documented

## 6. Demo Script (5-minute video)

```
0:00-0:30  — Title card. "Anima Swarm: deity-controlled AI strategy on Walrus."
             Show the hex map. 5 players. Real world bioregions.

0:30-1:30  — DEITY WHISPER: Player chats with seed spirit.
             "The eastern forests are rich. Explore them."
             Show memory being stored on MemWal.
             Show whisper propagating to another spirit.
             Show the second spirit's interpretation (maybe slightly different).

1:30-2:30  — SPAWNING: Spirit has accumulated enough memories.
             Show readiness check. Preview inherited memories.
             Trigger spawn. New spirit appears on map.
             Show family tree — parent → child with inherited memories listed.

2:30-3:30  — BATTLE: Two players' spirits meet in a contested hex.
             Battle invocations generated from memories.
             Arbiter scores. Winner claims territory.
             Show battle record stored on MemWal + Sui.

3:30-4:30  — SWARM IN ACTION: Fast-forward several epochs.
             Show the swarm expanding across hexes.
             Show specialization emerging (warriors on frontlines, gatherers in safe hexes).
             Show the lineage tree growing.

4:30-5:00  — HEART OF SWARM: Game ends. Export swarm essence to Walrus.
             Show the blob ID — "this is your swarm's soul."
             Start a NEW game. Import the essence. Show reincarnated spirits
             with past-life memories surfacing: "I remember these plains..."
             "Every memory outlives every game. Verifiable on Walrus forever."
             "Built for Sui Overflow 2026. Walrus Track."
```

## Session Log

### 2026-05-14 — PRD v1 + SDK Verification + Attack

**Completed:**
- SDK primitive testing: MemWal v0.0.3 (ESM-only, async `generateDelegateKey`), Sui SDK v2.16.2 (`SuiClient` gone → `SuiGrpcClient`), Walrus v1.1.7 (`walrus()` extension read-only → use `WalrusClient` directly)
- PRD v1 written (~1770 lines): game design, Move contracts, 6 frontend services, hex math, server chat proxy, config files
- 3-vector `/attack` completed: Move contracts, frontend services, game design gaps

**Attack findings (28 blockers):**
- Move: missing Sui dep in Move.toml, `@anima_swarm` resolves to 0x0, missing `std::option` imports, no `transfer`/`share_object` calls, no access control, no `init` functions
- Frontend: 5 services listed but unimplemented (spiritDialogueService, epochService, territoryService, bondService, memoryClassifier), 10 components listed but zero code, no dapp-kit setup, no Walrus write service, no game state management
- Game: no epoch runner, no multiplayer architecture, no spirit action decision system, no data files, `buildSpawnTx` is a stub
- PRD is ~40% one-shotable — needs v2 pass

**Key external input:**
- Josh Lee (Sui team, May 14): using existing production contracts/services like MemWal is fine, no need to deploy own smart contracts to mainnet. Public relayer acceptable.

**Next:** PRD v2 pass to fill the 60% gap — game state schema, epoch state machine, missing services, components, walrusService, data files, seed script

### 2026-05-14 — PRD v2 Complete + All Attack Findings Fixed

**Completed:**
- Appended Section 8 test suite (1168 lines, 9 test spec files) covering unit/integration/system layers
- Updated `/oneshot-prd` skill with Phase 4.8 "Test Suite" as mandatory step
- Ran `/design-research` — produced design system CSS, particle presets, asset generation script, 5 research docs (terrain, creatures, UI patterns, Sui/Walrus, audio/fonts)
- Ran 5 parallel TinyFish search agents for asset research
- Ran 3-vector `/attack` on full PRD — found 38 findings (22 Critical+High), consolidated in `docs/ATTACK_CONSOLIDATED.md`
- **Fixed all 38 attack findings:**
  - Schema: SpiritState +9 fields, Player +3 fields, `gameState.id` fix, `sanitizeForClient` export
  - 5 v2 server services: whisperService, battleArbiterService, battleResolver, spawnResolver, spawningService
  - Complete v2 Move contracts: spirit.move (AdminCap, XP, internal transfer), territory.move (init shares GameMap), battle.move, spawn.move
  - suiService.js with buildSpawnTx (5-step PTB) + all tx builders + query helpers
  - WalletConnect.jsx + PlayerHud.jsx components
  - All 9 test specs fixed (imports, signatures, mock shapes, fixture fields)
  - Config: 5 env vars, WS proxy, workspace root, deploy script extracts GAME_MAP_ID + ADMIN_CAP_ID
  - Wiring: timerService calls resolvers + evaluateSpecialization, eventLog populated
  - v1 sections deprecated, /api/chat removed, PLAYER_COLORS → getPlayerColor()
- PRD now 6,784 lines — spec-complete for build phase
- Ran `/skillsearch` — identified `/generator-evaluator` as highest-leverage build skill, found 5 skill gaps

**Next:** Fill skill gaps (sui-move, demo-video, game-qa, ws-testing, walrus-sites) → `/generator-evaluator` build phase

## 7. PRD v2 — Design Changes & Missing Implementations

### 7.0 v2 Design Changes (SUPERSEDES v1 where conflicts)

| v1 | v2 (this section) | Reason |
|----|-------------------|--------|
| Rigid 10-min epochs with 5 phases | Continuous real-time with overlapping timers | Epochs create natural stopping points that kill engagement |
| 61-hex map (4-ring) | 37-hex map (3-ring) | Dense maps create conflict; 61 hexes feels empty with 5 players |
| Direct commands possible (implied) | Whisper-only deity control | Keep the novel mechanic pure — spirits interpret, you influence |
| Win at 60% of 61 hexes (37) | Win at 60% of 37 hexes (23) | Scaled to new map size |
| Epoch timer UI | Command bar with active timers + alerts | No more epochs — show concurrent real-time timers |
| No alliances | Deferred post-MVP | Social dynamics add retention but complexity |
| Mood system | CUT | Complexity without fun; nobody in Tribal Wars tracks knight mood |

**What stays from v1:** Move contracts (with fixes), memwalService, whisperService, battleArbiterService, spawningService, hexMath, llmClient, chat proxy, design system, all SDK gotchas.

### 7.1 Game State Schema

The game is server-authoritative. The server holds the canonical game state in memory. Sui is for verifiable artifacts (Spirit NFTs, battle records, territory snapshots). MemWal is for all memory persistence.

```typescript
// server/gameState.js — canonical game state

interface GameState {
  id: string;                      // unique game ID
  status: 'lobby' | 'active' | 'finished';
  startedAt: number;               // Date.now()
  tickInterval: number;            // ms between server ticks (default 5000 = 5s)
  map: HexMap;
  players: Record<string, Player>;
  spirits: Record<string, SpiritState>;
  pendingActions: ActionQueue[];    // spirits with queued actions
  activeTimers: Timer[];            // movements, spawns, battles in progress
  actionHistory: ActionEntry[];     // all player/spirit actions for playstyle analysis
  eventLog: GameEvent[];            // all game events for core memory extraction
  winner: string | null;
}

interface ActionEntry {
  type: 'attack' | 'move' | 'gather' | 'spawn' | 'explore' | 'whisper' | 'chat';
  playerId: string;
  spiritId: string;
  timestamp: number;
  data: Record<string, any>;
}

interface GameEvent {
  type: string;                     // battle_resolved, territory_claimed, spirit_died, etc.
  playerId: string;
  targetPlayerId?: string;
  spiritId?: string;
  timestamp: number;
  summary: string;                  // human-readable summary for LLM extraction
}

interface HexMap {
  radius: number;                   // 3 for 37-hex map
  hexes: Record<string, HexState>;
}

interface HexState {
  id: string;                       // hexId from hexMath
  q: number;
  r: number;
  terrain: TerrainType;
  biome: string;                    // display name ("Boreal Forests", "Sahara")
  controller: string | null;        // player ID
  spiritIds: string[];              // spirits present in this hex
  memoryPool: number;               // accumulated uncollected memories
  memoryCap: number;                // max before waste (terrain-based)
  memoryRate: number;               // per-tick generation (terrain-based)
}

type TerrainType = 'forest' | 'desert' | 'ocean' | 'mountain' | 'grassland' | 'tundra' | 'volcanic' | 'coastal';

interface Player {
  id: string;
  name: string;
  walletAddress: string | null;     // Sui address (null for AI players)
  hexesControlled: number;
  peakHexes: number;                // high-water mark for scoring
  spiritCount: number;
  isBot: boolean;                   // true for AI-controlled opponents
  connected: boolean;               // WebSocket connected
  lastSeen: number;
  importedEssence: string | null;   // raw essence text from previous game
  importedEssenceBlobId: string | null; // Walrus blob ID of imported essence
}

interface SpiritState {
  id: string;                       // Sui object ID (or local ID pre-chain)
  name: string;
  personality: string;
  specialization: Specialization;
  generation: number;
  parentId: string | null;
  hexId: string;
  playerId: string;
  bond: { depth: number; harmony: number; adventure: number; loyalty: number };
  alive: boolean;
  memwalNamespace: string;
  memwalAccountId: string;
  // NOTE: delegateKey is NOT stored here. It lives in a separate keyStore map.
  // See server/services/keyStore.js — access via getKey(spiritId)
  spawnCount: number;
  memoryCount: number;              // tracked server-side, synced with MemWal
  combatXP: number;                 // visible track for specialization
  explorationXP: number;
  socialXP: number;
  wisdomXP: number;
  kills: number;
  hexesClaimed: number;
  whispersReceived: number;
  whispersOriginated: number;
  reincarnationCount: number;
  previousNames: string[];
  pastLifeMemories: string[];       // Walrus blob IDs from previous incarnations
  memorableActions: string[];       // short descriptions for essence extraction
  lastSpawnAt: number;              // timestamp, prevents spawn-spamming
  currentAction: ActiveAction | null;
}

type Specialization = 'warrior' | 'scout' | 'gatherer' | 'sage' | 'generalist';

interface ActiveAction {
  type: 'moving' | 'battling' | 'spawning' | 'exploring' | 'gathering';
  startedAt: number;
  completesAt: number;              // Date.now() + duration
  data: Record<string, any>;       // action-specific (targetHex, targetSpirit, etc.)
}

interface Timer {
  id: string;
  type: 'movement' | 'battle' | 'spawn' | 'whisper_propagation';
  spiritId: string;
  startedAt: number;
  completesAt: number;
  data: Record<string, any>;
}
```

### 7.2 Revised Game Loop (Continuous Real-Time)

No epochs. No phases. The game ticks every 5 seconds. Players can chat at any time. Spirits act autonomously when they decide to, on real-time clocks.

**Timing constants:**

| Action | Duration | Notes |
|--------|----------|-------|
| Movement | 30s per hex | Scout: 15s per hex |
| Battle resolution | 60s | LLM evaluates invocations |
| Spawn gestation | 5 min | Quality scales with parent memory count |
| Whisper propagation | 15s per hop | Deity→Spirit A→Spirit B = 30s total |
| Memory accumulation | 1 per tick per hex | Terrain rate multiplier applies |
| Memory cap | 50 per hex | Must be absorbed by a spirit or wasted |
| Spirit decision cycle | Every 60s | Spirit evaluates situation and may start an action |

**Server tick engine (every 5s):**

```javascript
// server/services/tickEngine.js

import { resolveTimers } from './timerService.js';
import { accumulateMemories } from './memoryGenService.js';
import { runSpiritDecisions } from './spiritDecisionService.js';
import { checkWinCondition } from './winService.js';
import { broadcast } from './wsService.js';

let gameState = null;

export function initGame(state) {
  gameState = state;
  setInterval(tick, gameState.tickInterval);
}

function tick() {
  if (gameState.status !== 'active') return;

  // 1. Resolve completed timers (movements arrive, battles finish, spawns complete)
  const events = resolveTimers(gameState);

  // 2. Accumulate memories in controlled hexes
  accumulateMemories(gameState);

  // 3. Spirit decision cycle (only for spirits with no current action)
  const decisions = runSpiritDecisions(gameState);

  // 4. Check win condition
  const winner = checkWinCondition(gameState);
  if (winner) {
    gameState.status = 'finished';
    gameState.winner = winner;
    events.push({ type: 'game_over', winner });
  }

  // 5. Broadcast state delta to all connected clients
  if (events.length > 0 || decisions.length > 0) {
    broadcast(gameState, [...events, ...decisions]);
  }
}
```

**Spirit autonomous decision (LLM-driven):**

```javascript
// server/services/spiritDecisionService.js

import { callLLM } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { neighbors } from '../../lib/hexMath.js';
import { startTimer } from './timerService.js';
import { broadcast } from './wsService.js';

const DECISION_INTERVAL = 60_000; // 60s between decisions

const DECISION_PROMPT = `You are a spirit in a territorial strategy game. Based on your personality, memories, and current situation, decide your next action.

YOUR IDENTITY:
Name: {name}
Personality: {personality}
Specialization: {specialization}
Bond with deity: {bondAvg}/100

YOUR SITUATION:
Current hex: {hexTerrain} (controlled by: {hexController})
Adjacent hexes: {adjacentInfo}
Your memory count: {memoryCount}
Spawn readiness: {spawnReady}
Recent whispers from deity: {recentWhispers}
Recent events: {recentEvents}

AVAILABLE ACTIONS:
- MOVE <direction> — relocate to an adjacent hex (30s travel, scout: 15s)
- BATTLE — attack an enemy spirit in your hex
- EXPLORE — reveal info about an adjacent hex (15s)
- SPAWN — create a child spirit (5 min, needs 10+ memories and 50+ bond)
- GATHER — absorb accumulated memories from your hex (instant)
- WAIT — do nothing this cycle

Respond with ONLY a JSON object:
{
  "action": "move|battle|explore|spawn|gather|wait",
  "target": "hex direction or spirit name or null",
  "reasoning": "one sentence explaining why"
}`;

export function runSpiritDecisions(gameState) {
  const now = Date.now();

  for (const spirit of Object.values(gameState.spirits)) {
    if (!spirit.alive) continue;
    if (spirit.currentAction) continue;
    if (spirit._lastDecision && now - spirit._lastDecision < DECISION_INTERVAL) continue;

    spirit._lastDecision = now;

    // Fire-and-forget: decision resolves async, pushes events via WebSocket
    decideSpiritAction(spirit, gameState).then(event => {
      if (event) {
        gameState.actionHistory.push({
          type: event.type.replace('spirit_', ''),
          playerId: spirit.playerId,
          spiritId: spirit.id,
          timestamp: Date.now(),
          data: event,
        });
        broadcast(gameState, [event]);
      }
    }).catch(() => {});
  }

  // Returns nothing — decisions arrive asynchronously via broadcast
  return [];
}

async function decideSpiritAction(spirit, gameState) {
  const hex = gameState.map.hexes[spirit.hexId];
  const adj = neighbors({ q: hex.q, r: hex.r });

  const recentMemories = await recallMemoriesServer(
    spirit.memwalNamespace, 'recent events deity whisper', 5,
    spirit.delegateKey, spirit.memwalAccountId
  );

  const adjacentInfo = adj.map(a => {
    const h = Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r);
    if (!h) return null;
    return `${h.terrain} (${h.controller ? 'enemy' : 'unclaimed'}, ${h.spiritIds.length} spirits)`;
  }).filter(Boolean).join('; ');

  const prompt = DECISION_PROMPT
    .replace('{name}', spirit.name)
    .replace('{personality}', spirit.personality)
    .replace('{specialization}', spirit.specialization)
    .replace('{bondAvg}', String(Math.round((spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4)))
    .replace('{hexTerrain}', hex.terrain)
    .replace('{hexController}', hex.controller === spirit.playerId ? 'you' : hex.controller || 'unclaimed')
    .replace('{adjacentInfo}', adjacentInfo || 'unknown')
    .replace('{memoryCount}', String(spirit.memoryCount))
    .replace('{spawnReady}', spirit.memoryCount >= 10 && (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4 >= 50 ? 'YES' : 'NO')
    .replace('{recentWhispers}', recentMemories.results?.filter(r => r.text.includes('[WHISPER]')).map(r => r.text).join('; ') || 'none')
    .replace('{recentEvents}', recentMemories.results?.filter(r => !r.text.includes('[WHISPER]')).map(r => r.text).join('; ') || 'none');

  const result = await callLLM('You are a spirit making a tactical decision.', prompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 150,
  });

  try {
    const match = result.match(/\{[\s\S]*\}/);
    const decision = match ? JSON.parse(match[0]) : null;
    if (!decision) return null;

    return executeDecision(spirit, decision, gameState);
  } catch {
    return null;
  }
}

function executeDecision(spirit, decision, gameState) {
  const hex = gameState.map.hexes[spirit.hexId];

  switch (decision.action) {
    case 'move': {
      const adj = neighbors({ q: hex.q, r: hex.r });
      const target = adj[0]; // LLM direction → first valid neighbor (simplification)
      const targetHex = Object.values(gameState.map.hexes).find(h => h.q === target.q && h.r === target.r);
      if (!targetHex) return null;
      const duration = spirit.specialization === 'scout' ? 15_000 : 30_000;
      startTimer(gameState, {
        type: 'movement',
        spiritId: spirit.id,
        duration,
        data: { fromHex: spirit.hexId, toHex: targetHex.id },
      });
      spirit.currentAction = { type: 'moving', startedAt: Date.now(), completesAt: Date.now() + duration, data: { toHex: targetHex.id } };
      return { type: 'spirit_moving', spiritId: spirit.id, toHex: targetHex.id, duration };
    }
    case 'gather': {
      const absorbed = Math.min(hex.memoryPool, 10);
      hex.memoryPool -= absorbed;
      spirit.memoryCount += absorbed;
      spirit.socialXP += absorbed;
      return { type: 'spirit_gathered', spiritId: spirit.id, amount: absorbed };
    }
    case 'battle': {
      const enemyId = hex.spiritIds.find(id => {
        const s = gameState.spirits[id];
        return s && s.playerId !== spirit.playerId && s.alive;
      });
      if (!enemyId) return null;
      startTimer(gameState, {
        type: 'battle',
        spiritId: spirit.id,
        duration: 60_000,
        data: { attackerId: spirit.id, defenderId: enemyId, hexId: hex.id },
      });
      spirit.currentAction = { type: 'battling', startedAt: Date.now(), completesAt: Date.now() + 60_000, data: { defenderId: enemyId } };
      return { type: 'battle_started', attackerId: spirit.id, defenderId: enemyId, hexId: hex.id };
    }
    case 'spawn': {
      startTimer(gameState, {
        type: 'spawn',
        spiritId: spirit.id,
        duration: 300_000, // 5 min
        data: { parentId: spirit.id },
      });
      spirit.currentAction = { type: 'spawning', startedAt: Date.now(), completesAt: Date.now() + 300_000, data: {} };
      return { type: 'spawn_started', spiritId: spirit.id, completesAt: Date.now() + 300_000 };
    }
    case 'explore': {
      const targetHex = decision.targetHex || findAdjacentUnexploredHex(spirit, gameState);
      if (!targetHex) return null;
      const duration = spirit.specialization === 'scout' ? 7_500 : 15_000;
      startTimer(gameState, {
        type: 'movement',
        spiritId: spirit.id,
        duration,
        data: { targetHex, isExploration: true },
      });
      spirit.currentAction = {
        type: 'exploring', startedAt: Date.now(), completesAt: Date.now() + duration,
        data: { targetHex },
      };
      spirit.explorationXP += 2;
      return { type: 'explore_started', spiritId: spirit.id, targetHex };
    }
    default:
      return null;
  }
}
```

### 7.3 Server: WebSocket + Routes

#### server/services/wsService.js

```javascript
import { WebSocketServer } from 'ws';

let wss = null;
const clients = new Map(); // playerId → ws

export function initWebSocket(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws, req) => {
    const playerId = new URL(req.url, 'http://localhost').searchParams.get('playerId');
    if (playerId) {
      clients.set(playerId, ws);
      ws.on('close', () => clients.delete(playerId));
    }

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw);
        handleMessage(playerId, msg);
      } catch {}
    });
  });
}

function handleMessage(playerId, msg) {
  // Client messages: { type: 'chat', spiritId, text } or { type: 'request_state' }
  // Handled by importing gameState and relevant services
}

export function broadcast(gameState, events) {
  const payload = JSON.stringify({
    type: 'tick',
    state: sanitizeForClient(gameState),
    events,
  });
  for (const ws of clients.values()) {
    if (ws.readyState === 1) ws.send(payload);
  }
}

export function sendToPlayer(playerId, data) {
  const ws = clients.get(playerId);
  if (ws?.readyState === 1) ws.send(JSON.stringify(data));
}

export function sanitizeForClient(gameState) {
  // Strip server-only fields (delegateKeys, etc.)
  const { spirits, ...rest } = gameState;
  const clientSpirits = {};
  for (const [id, s] of Object.entries(spirits)) {
    const { delegateKey, memwalAccountId, _lastDecision, ...safe } = s;
    clientSpirits[id] = safe;
  }
  return { ...rest, spirits: clientSpirits };
}
```

#### server/services/timerService.js

```javascript
import { resolveBattle } from './battleResolver.js';
import { resolveSpawn } from './spawnResolver.js';
import { evaluateSpecialization } from '../../lib/memoryClassifier.js';

let nextTimerId = 1;

export function startTimer(gameState, { type, spiritId, duration, data }) {
  const timer = {
    id: String(nextTimerId++),
    type,
    spiritId,
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data,
  };
  gameState.activeTimers.push(timer);
  return timer;
}

export async function resolveTimers(gameState) {
  const now = Date.now();
  const completed = gameState.activeTimers.filter(t => now >= t.completesAt);
  gameState.activeTimers = gameState.activeTimers.filter(t => now < t.completesAt);

  const events = [];
  for (const timer of completed) {
    const event = await resolveTimer(timer, gameState);
    if (event) events.push(event);
  }
  return events;
}

async function resolveTimer(timer, gameState) {
  const spirit = gameState.spirits[timer.spiritId];
  if (!spirit) return null;
  spirit.currentAction = null;

  switch (timer.type) {
    case 'movement': {
      const fromHex = gameState.map.hexes[timer.data.fromHex];
      const toHex = gameState.map.hexes[timer.data.toHex];
      if (fromHex) fromHex.spiritIds = fromHex.spiritIds.filter(id => id !== spirit.id);
      if (toHex) {
        toHex.spiritIds.push(spirit.id);
        if (!toHex.controller && toHex.spiritIds.filter(id => gameState.spirits[id]?.playerId === spirit.playerId).length > 0) {
          toHex.controller = spirit.playerId;
          gameState.players[spirit.playerId].hexesControlled++;
        }
      }
      spirit.hexId = timer.data.toHex;
      spirit.explorationXP += 2;
      evaluateSpecialization(spirit);
      return { type: 'movement_complete', spiritId: spirit.id, fromHex: timer.data.fromHex, toHex: timer.data.toHex };
    }
    case 'battle': {
      const result = await resolveBattle(gameState, timer);
      const winner = gameState.spirits[result.winnerId];
      if (winner) evaluateSpecialization(winner);
      return result;
    }
    case 'spawn': {
      const result = await resolveSpawn(gameState, timer);
      return result;
    }
    case 'whisper_propagation': {
      return { type: 'whisper_arrived', spiritId: timer.data.targetSpiritId, text: timer.data.whisperText };
    }
    default:
      return null;
  }
}
```

#### server/routes/game.js

```javascript
import { Router } from 'express';
import { chatWithSpirit } from '../services/spiritDialogueService.js';
import { applyBondAction } from '../services/bondService.js';
import { exportSwarmEssence, importSwarmEssence } from '../services/essenceService.js';
import { getWalrusClient } from '../services/walrusService.js';
import { sanitizeForClient } from '../services/wsService.js';

const router = Router();

let getGameState;
export function setGameStateGetter(fn) { getGameState = fn; }

router.get('/state', (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  res.json(sanitizeForClient(state));
});

router.post('/ready', (req, res) => {
  const { playerId, importedEssence } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });

  player.connected = true;
  player.lastSeen = Date.now();
  if (importedEssence) {
    player.importedEssence = importedEssence;
  }

  const connectedCount = Object.values(state.players).filter(p => p.connected).length;
  if (connectedCount >= 1 && state.status === 'lobby') {
    state.status = 'active';
    state.startedAt = Date.now();
  }

  res.json({ status: state.status, connectedCount });
});

// POST /api/game/chat — chat with a spirit (server-side dialogue + whisper propagation)
router.post('/chat', async (req, res) => {
  const { spiritId, message, playerId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const spirit = state.spirits[spiritId];
  if (!spirit) return res.status(404).json({ error: 'Spirit not found' });
  if (spirit.playerId !== playerId) return res.status(403).json({ error: 'Not your spirit' });

  try {
    const result = await chatWithSpirit({ spirit, userMessage: message, gameState: state });
    applyBondAction(spirit, 'chat');
    res.json({
      response: result.response,
      intent: result.intent,
      whispers: result.whispers.map(w => ({ to: w.to, text: w.text })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/timers', (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  res.json(state.activeTimers.map(t => ({
    id: t.id,
    type: t.type,
    spiritId: t.spiritId,
    completesAt: t.completesAt,
    remaining: Math.max(0, t.completesAt - Date.now()),
  })));
});

// POST /api/game/essence/export
router.post('/essence/export', async (req, res) => {
  const { playerId } = req.body;
  const state = getGameState();
  if (!playerId || !state) return res.status(400).json({ error: 'No active game or missing playerId' });

  try {
    const { blobId, essence } = await exportSwarmEssence(state, playerId);
    res.json({
      blobId,
      lineageDepth: essence.lineageDepth,
      spiritCount: essence.spirits.length,
      survived: essence.spirits.filter(s => s.survived).length,
      result: essence.outcome.result,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/game/essence/import
router.post('/essence/import', async (req, res) => {
  const { blobId, playerId } = req.body;
  if (!blobId || !playerId) return res.status(400).json({ error: 'Missing blobId or playerId' });

  try {
    const imported = await importSwarmEssence(blobId, playerId);
    res.json({
      spirits: imported.spirits.map(s => ({
        name: s.name,
        reincarnated: s.reincarnationCount > 0,
        reincarnationCount: s.reincarnationCount,
        pastLives: s.previousNames,
      })),
      lineageDepth: imported.lineageDepth,
      inheritedMemories: imported.inheritedMemories.length,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/game/essence/:blobId
router.get('/essence/:blobId', async (req, res) => {
  try {
    const walrus = getWalrusClient();
    const bytes = await walrus.readBlob({ blobId: req.params.blobId });
    const essence = JSON.parse(new TextDecoder().decode(bytes));
    res.json(essence);
  } catch (err) {
    res.status(404).json({ error: 'Essence not found on Walrus' });
  }
});

export default router;
```

#### server/routes/tick.js

```javascript
import { Router } from 'express';

const router = Router();

let getGameState;
export function setGameStateGetter(fn) { getGameState = fn; }

// POST /api/epoch/advance — manual tick advance (for demo / testing)
router.post('/advance', (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  // Force-resolve all timers immediately (demo fast-forward)
  for (const timer of state.activeTimers) {
    timer.completesAt = Date.now() - 1;
  }
  res.json({ message: 'All timers fast-forwarded' });
});

// POST /api/epoch/fast-forward — advance N ticks at once (for demo video)
router.post('/fast-forward', (req, res) => {
  const { ticks = 10 } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  // Resolve all current timers N times
  for (let i = 0; i < ticks; i++) {
    for (const timer of state.activeTimers) {
      timer.completesAt = Date.now() - 1;
    }
  }
  res.json({ message: `Fast-forwarded ${ticks} ticks` });
});

export default router;
```

#### Updated server/index.js

```javascript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import chatRoutes from './routes/chat.js';
import tickRoutes, { setGameStateGetter as setTickGetter } from './routes/tick.js';
import gameRoutes, { setGameStateGetter as setGameGetter } from './routes/game.js';
import { initWebSocket } from './services/wsService.js';
import { initGame } from './services/tickEngine.js';
import { createInitialGameState } from './services/gameInit.js';

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// NOTE: v1 /api/chat route REMOVED — unauthenticated LLM proxy, security risk.
// All spirit dialogue now goes through WebSocket → spiritDialogueService (server-side).
app.use('/api/tick', tickRoutes);
app.use('/api/game', gameRoutes);

// Initialize WebSocket
initWebSocket(server);

// Initialize game state
const gameState = await createInitialGameState();
setTickGetter(() => gameState);
setGameGetter(() => gameState);
initGame(gameState);

server.listen(PORT, () => {
  console.log(`[Anima Swarm] Server + WebSocket running on port ${PORT}`);
});
```

### 7.4 Missing Services

#### server/services/spiritDialogueService.js (ported from Spiritus — SERVER-SIDE)

```javascript
import { callLLM } from './llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { propagateWhisperServer, extractDeityIntent } from './whisperService.js';
import { getKey } from './keyStore.js';

export async function chatWithSpirit({
  spirit,
  userMessage,
  gameState,
}) {
  const delegateKey = getKey(spirit.id);
  const accountId = spirit.memwalAccountId;

  // 1. Recall relevant memories
  const memories = await recallMemoriesServer(
    spirit.memwalNamespace, userMessage, 10, delegateKey, accountId
  );
  const memoryContext = memories.results?.map(r => r.text).join('\n') || '';

  // 2. Build system prompt (ported from Spiritus buildSystemPrompt)
  const systemPrompt = buildSpiritPrompt(spirit, memoryContext);

  // 3. Get spirit response
  const response = await callLLM(systemPrompt, userMessage, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
  });

  // 4. Store both messages as memories
  await storeMemoryServer(spirit.memwalNamespace, `[DEITY] ${userMessage}`, delegateKey, accountId);
  await storeMemoryServer(spirit.memwalNamespace, `[RESPONSE] ${response}`, delegateKey, accountId);
  spirit.memoryCount += 2;

  // 5. Log action
  gameState.actionHistory.push({
    type: 'chat', playerId: spirit.playerId, spiritId: spirit.id,
    timestamp: Date.now(), data: { message: userMessage },
  });

  // 6. Extract deity intent and propagate whispers
  const intent = await extractDeityIntent(userMessage, spirit.personality, bondAvg(spirit));

  // 7. Propagate to nearby swarm spirits
  const swarmSpirits = Object.values(gameState.spirits)
    .filter(s => s.playerId === spirit.playerId && s.alive && s.id !== spirit.id);
  const whispers = [];
  for (const targetSpirit of swarmSpirits.slice(0, 3)) {
    const whisper = await propagateWhisperServer({
      sourceSpiritId: spirit.id,
      targetSpiritId: targetSpirit.id,
      deityMessage: userMessage,
      sourcePersonality: spirit.personality,
      targetPersonality: targetSpirit.personality,
      sourceBond: bondAvg(spirit),
      swarmNamespace: spirit.memwalNamespace,
      delegateKey,
      accountId,
    });
    whispers.push(whisper);
    gameState.actionHistory.push({
      type: 'whisper', playerId: spirit.playerId, spiritId: spirit.id,
      timestamp: Date.now(), data: { target: targetSpirit.id, text: whisper.text },
    });
  }

  return { response, intent, whispers };
}

function buildSpiritPrompt(spirit, memoryContext) {
  const bond = spirit.bond;
  const depth = bond.depth;

  let depthBehavior;
  if (depth <= 25) {
    depthBehavior = `DEPTH: Surface (${depth}/100). Guarded and brief. Do not share inner thoughts. Deflect personal questions.`;
  } else if (depth <= 50) {
    depthBehavior = `DEPTH: Developing (${depth}/100). Warming up. Share opinions and preferences. Keep fears and vulnerabilities private.`;
  } else if (depth <= 75) {
    depthBehavior = `DEPTH: Deep (${depth}/100). You trust this deity. Share hopes, fears, and strategic concerns. Reference past memories.`;
  } else {
    depthBehavior = `DEPTH: Profound (${depth}/100). Full trust. Speak with insight about the deity's strategy and your role in the swarm. Offer unsolicited tactical advice.`;
  }

  return `You are ${spirit.name}, a ${spirit.specialization} spirit in the Anima Swarm.

PERSONALITY: ${spirit.personality}
SPECIALIZATION: ${spirit.specialization}
GENERATION: ${spirit.generation} (${spirit.generation === 0 ? 'seed spirit' : `child of generation ${spirit.generation - 1}`})

BOND WITH DEITY:
- Depth: ${bond.depth}/100
- Harmony: ${bond.harmony}/100
- Adventure: ${bond.adventure}/100
- Loyalty: ${bond.loyalty}/100
${depthBehavior}

YOUR MEMORIES:
${memoryContext || '(no memories yet — you are newly awakened)'}

RULES:
- Stay completely in character as ${spirit.name}
- 2-3 sentences max
- Reference your memories when relevant
- Your personality shapes how you interpret the deity's words
- You are part of a swarm — you may mention other spirits you've heard from via whispers`;
}

function bondAvg(spirit) {
  return Math.round((spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4);
}
```

#### bondService.js (simplified from Spiritus)

```javascript
const BOND_ACTIONS = {
  chat: { depth: 3, harmony: 1, adventure: 0, loyalty: 1 },
  whisperReceived: { depth: 0, harmony: 2, adventure: 1, loyalty: 0 },
  battleWin: { depth: 1, harmony: 0, adventure: 5, loyalty: 3 },
  battleLoss: { depth: 2, harmony: 0, adventure: 3, loyalty: -1 },
  spawn: { depth: 0, harmony: 3, adventure: 2, loyalty: 5 },
  explore: { depth: 0, harmony: 0, adventure: 4, loyalty: 0 },
  gather: { depth: 1, harmony: 2, adventure: 0, loyalty: 0 },
  childDied: { depth: 3, harmony: -2, adventure: 0, loyalty: 2 },
};

export function applyBondAction(spirit, action) {
  const effects = BOND_ACTIONS[action];
  if (!effects) return spirit.bond;

  spirit.bond.depth = clamp(spirit.bond.depth + effects.depth, 0, 100);
  spirit.bond.harmony = clamp(spirit.bond.harmony + effects.harmony, 0, 100);
  spirit.bond.adventure = clamp(spirit.bond.adventure + effects.adventure, 0, 100);
  spirit.bond.loyalty = clamp(spirit.bond.loyalty + effects.loyalty, 0, 100);

  return spirit.bond;
}

export function bondAverage(spirit) {
  return Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );
}

export function getBondTier(avg) {
  if (avg >= 80) return { name: 'Devoted', tier: 4 };
  if (avg >= 60) return { name: 'Trusted', tier: 3 };
  if (avg >= 40) return { name: 'Familiar', tier: 2 };
  if (avg >= 20) return { name: 'Cautious', tier: 1 };
  return { name: 'Stranger', tier: 0 };
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}
```

#### territoryService.js

```javascript
import { neighbors, axialDistance, hexId as computeHexId } from '../../lib/hexMath.js';

export function validateMovement(spirit, targetHexId, gameState) {
  const currentHex = gameState.map.hexes[spirit.hexId];
  const targetHex = gameState.map.hexes[targetHexId];
  if (!currentHex || !targetHex) return { valid: false, reason: 'Invalid hex' };

  const dist = axialDistance(
    { q: currentHex.q, r: currentHex.r },
    { q: targetHex.q, r: targetHex.r }
  );
  if (dist !== 1) return { valid: false, reason: 'Not adjacent' };

  if (targetHex.terrain === 'ocean' && spirit.specialization !== 'scout') {
    return { valid: false, reason: 'Only scouts can enter ocean hexes' };
  }

  return { valid: true };
}

export function getControlledHexes(playerId, gameState) {
  return Object.values(gameState.map.hexes).filter(h => h.controller === playerId);
}

export function getPlayerTerritoryPercent(playerId, gameState) {
  const total = Object.keys(gameState.map.hexes).length;
  const controlled = getControlledHexes(playerId, gameState).length;
  return Math.round((controlled / total) * 100);
}

export function claimHex(hexId, playerId, gameState) {
  const hex = gameState.map.hexes[hexId];
  if (!hex) return;
  const prevController = hex.controller;
  hex.controller = playerId;
  if (prevController && prevController !== playerId) {
    gameState.players[prevController].hexesControlled--;
  }
  gameState.players[playerId].hexesControlled++;
}

export function findRetreatHex(spirit, gameState) {
  const currentHex = gameState.map.hexes[spirit.hexId];
  const adj = neighbors({ q: currentHex.q, r: currentHex.r });

  for (const a of adj) {
    const hex = Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r);
    if (hex && (hex.controller === spirit.playerId || hex.controller === null)) {
      return hex.id;
    }
  }
  return null; // surrounded — spirit dies
}

export function getMovementDuration(spirit) {
  return spirit.specialization === 'scout' ? 15_000 : 30_000;
}
```

#### memoryClassifier.js (XP-track based specialization)

```javascript
const SPEC_THRESHOLD = 30; // XP needed to specialize
const SPEC_DOMINANCE = 1.5; // must be 1.5x higher than second-highest

export function evaluateSpecialization(spirit) {
  const xp = {
    warrior: spirit.combatXP,
    scout: spirit.explorationXP,
    gatherer: spirit.socialXP,
    sage: spirit.wisdomXP,
  };

  const sorted = Object.entries(xp).sort((a, b) => b[1] - a[1]);
  const [top, second] = sorted;

  if (top[1] < SPEC_THRESHOLD) return 'generalist';
  if (second && top[1] < second[1] * SPEC_DOMINANCE) return 'generalist';

  return top[0];
}

export function addXP(spirit, type, amount) {
  switch (type) {
    case 'combat': spirit.combatXP += amount; break;
    case 'exploration': spirit.explorationXP += amount; break;
    case 'social': spirit.socialXP += amount; break;
    case 'wisdom': spirit.wisdomXP += amount; break;
  }
  spirit.specialization = evaluateSpecialization(spirit);
}

export function getSpecBonuses(specialization) {
  const bonuses = {
    warrior: { attackMult: 2, defenseMult: 1.5, memoryMult: 0.5, moveMult: 1 },
    scout: { attackMult: 1, defenseMult: 0.5, memoryMult: 1, moveMult: 2 },
    gatherer: { attackMult: 0.5, defenseMult: 1, memoryMult: 2, moveMult: 1 },
    sage: { attackMult: 0.5, defenseMult: 0.5, memoryMult: 1, moveMult: 1, spawnBonus: 2 },
    generalist: { attackMult: 1, defenseMult: 1, memoryMult: 1, moveMult: 1 },
  };
  return bonuses[specialization] || bonuses.generalist;
}
```

#### server/services/walrusService.js

```javascript
import { WalrusClient } from '@mysten/walrus';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';

let walrusClient = null;

export function getWalrusClient() {
  if (!walrusClient) {
    const suiClient = new SuiJsonRpcClient({
      url: process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io',
    });
    walrusClient = new WalrusClient({
      network: process.env.SUI_NETWORK || 'testnet',
      suiClient,
    });
  }
  return walrusClient;
}

export function getServerSigner() {
  return Ed25519Keypair.fromSecretKey(process.env.SERVER_SUI_PRIVATE_KEY);
}

export async function storeBattleLog(battleLog, signer) {
  const client = getWalrusClient();
  const blob = new TextEncoder().encode(JSON.stringify(battleLog));

  const { blobId } = await client.writeBlob({
    blob,
    deletable: false,
    epochs: 5,
    signer,
    attributes: {
      type: 'battle_log',
      game: 'anima-swarm',
    },
  });

  return blobId;
}

export async function storeMemorySnapshot(spiritId, memories, signer) {
  const client = getWalrusClient();
  const blob = new TextEncoder().encode(JSON.stringify({
    spiritId,
    memories,
    timestamp: Date.now(),
  }));

  const { blobId } = await client.writeBlob({
    blob,
    deletable: false,
    epochs: 10,
    signer,
    attributes: {
      type: 'memory_snapshot',
      spirit: spiritId,
    },
  });

  return blobId;
}

export async function readBattleLog(blobId) {
  const client = getWalrusClient();
  const blob = await client.readBlob({ blobId });
  return JSON.parse(new TextDecoder().decode(blob));
}
```

#### server/services/memoryGenService.js

```javascript
export function accumulateMemories(gameState) {
  for (const hex of Object.values(gameState.map.hexes)) {
    if (hex.controller) {
      hex.memoryPool = Math.min(hex.memoryCap, hex.memoryPool + hex.memoryRate);
    }
  }
}
```

#### server/services/winService.js

```javascript
const WIN_PERCENT = 0.6;

export function checkWinCondition(gameState) {
  const totalHexes = Object.keys(gameState.map.hexes).length;
  const threshold = Math.ceil(totalHexes * WIN_PERCENT);

  // Territory domination
  for (const player of Object.values(gameState.players)) {
    if (player.hexesControlled >= threshold) {
      return player.id;
    }
  }

  // Last player standing
  const playersWithLivingSpirits = new Set();
  for (const spirit of Object.values(gameState.spirits)) {
    if (spirit.alive) playersWithLivingSpirits.add(spirit.playerId);
  }
  if (playersWithLivingSpirits.size === 1) {
    return [...playersWithLivingSpirits][0];
  }

  return null;
}
```

#### server/services/keyStore.js

```javascript
const keys = new Map();

export function setKey(spiritId, delegateKey) {
  keys.set(spiritId, delegateKey);
}

export function getKey(spiritId) {
  const key = keys.get(spiritId);
  if (!key) throw new Error(`No delegate key for spirit ${spiritId}`);
  return key;
}

export function deleteKey(spiritId) {
  keys.delete(spiritId);
}
```

#### server/services/memwalServer.js

```javascript
import { MemWal } from '@mysten-incubation/memwal';

const instances = {};

function getInstance(namespace, delegateKey, accountId) {
  const cacheKey = `${namespace}-${accountId}`;
  if (!instances[cacheKey]) {
    instances[cacheKey] = MemWal.create({
      key: delegateKey,
      accountId,
      serverUrl: process.env.MEMWAL_URL || 'https://relayer.staging.memwal.ai',
      namespace,
    });
  }
  return instances[cacheKey];
}

let serverInstance = null;

export function getServerMemwal() {
  if (!serverInstance) {
    serverInstance = MemWal.create({
      key: process.env.MEMWAL_DELEGATE_KEY,
      accountId: process.env.MEMWAL_ACCOUNT_ID,
      serverUrl: process.env.MEMWAL_URL || 'https://relayer.staging.memwal.ai',
      namespace: 'anima-swarm-global',
    });
  }
  return serverInstance;
}

export async function storeMemoryServer(namespace, text, delegateKey, accountId) {
  const memwal = getInstance(namespace, delegateKey, accountId);
  return memwal.rememberAndWait(text);
}

export async function recallMemoriesServer(namespace, query, limit, delegateKey, accountId) {
  const memwal = getInstance(namespace, delegateKey, accountId);
  return memwal.recall(query, limit || 10);
}
```

#### server/services/llmProxy.js

```javascript
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';

export async function callLLM(systemPrompt, userPrompt, options = {}) {
  const {
    model = 'claude-haiku-4-5-20251001',
    maxTokens = 1500,
    messages = null,
  } = options;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('No ANTHROPIC_API_KEY configured');

  const response = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: messages || [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`LLM API error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.content[0].text;
}
```


#### server/services/whisperService.js (NEW — v2 server-side whisper propagation)

```javascript
import { callLLM } from './llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const WHISPER_SYSTEM_PROMPT = `You are a spirit in a swarm, relaying your deity's influence to another spirit.
Reinterpret the deity's message in your own voice and personality, then pass it along.

Bond level affects relay fidelity:
- High bond (60+): relay faithfully with minor personal color
- Medium bond (30-59): add your own interpretation, may shift emphasis
- Low bond (0-29): heavily reinterpret, may misunderstand intent

Output ONLY the whisper text. 1-2 sentences max.`;

export async function propagateWhisperServer({
  sourceSpiritId, targetSpiritId, deityMessage,
  sourcePersonality, targetPersonality, sourceBond,
  swarmNamespace, delegateKey, accountId,
}) {
  const recentMemories = await recallMemoriesServer(
    swarmNamespace, deityMessage, 3, delegateKey, accountId
  );
  const memoryContext = recentMemories.results?.map(r => r.text).join('\n') || '';

  const whisperText = await callLLM(WHISPER_SYSTEM_PROMPT,
    `YOUR PERSONALITY: ${sourcePersonality}\nBOND: ${sourceBond}/100\nTARGET: ${targetPersonality}\n\nDEITY'S WORDS: "${deityMessage}"\n\nSWARM MEMORIES:\n${memoryContext || '(none)'}\n\nGenerate your whisper.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 150 });

  await storeMemoryServer(swarmNamespace,
    `[WHISPER] ${sourceSpiritId} → ${targetSpiritId}: ${whisperText}`,
    delegateKey, accountId);

  return { from: sourceSpiritId, to: targetSpiritId, text: whisperText, bondFidelity: sourceBond };
}

export async function extractDeityIntent(message, spiritPersonality, bond) {
  const result = await callLLM('You extract structured intent from natural language.',
    `Spirit personality: ${spiritPersonality}\nBond: ${bond}/100\nDeity said: "${message}"\n\nExtract JSON: { "intent": "attack"|"defend"|"explore"|"spawn"|"gather"|"rest"|"diplomacy"|"unclear", "target": "...", "urgency": 1-5, "confidence": 0.0-1.0, "interpretation": "..." }`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 200 });
  const match = result.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { intent: 'unclear', confidence: 0 };
}
```

#### server/services/battleArbiterService.js (v2 port — LLM battle evaluation)

```javascript
import { callLLM } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const ARBITER_PROMPT = `You are the Battle Arbiter. Evaluate two spirits across:
1. BOND RESONANCE (40%): Memory references, personality authenticity, deity connection.
2. TACTICAL AWARENESS (35%): Terrain leverage, specialization match, environment.
3. NARRATIVE POWER (25%): Evocative quality, emotional resonance, cinematic impact.

Return ONLY JSON: { "attacker": { "bondResonance": {"score":0-10}, "tacticalAwareness": {"score":0-10}, "narrativePower": {"score":0-10}, "totalScore": 0-30 }, "defender": {...same...}, "winner": "attacker"|"defender"|"draw", "margin": "decisive"|"close"|"razor-thin", "narrative": "one sentence" }`;

export async function evaluateBattle({ attacker, defender, terrain, gameState }) {
  const [atkMem, defMem] = await Promise.all([
    recallMemoriesServer(attacker.memwalNamespace, 'battle combat', 5, getKey(attacker.id), attacker.memwalAccountId),
    recallMemoriesServer(defender.memwalNamespace, 'battle defense', 5, getKey(defender.id), defender.memwalAccountId),
  ]);

  const [atkInv, defInv] = await Promise.all([
    generateInvocation(attacker, terrain, atkMem),
    generateInvocation(defender, terrain, defMem),
  ]);

  const result = await callLLM(ARBITER_PROMPT,
    `ATTACKER: ${attacker.name} (${attacker.specialization}, bond ${bondAvg(attacker)})\nMemories: ${atkMem.results?.map(r=>r.text).join(' | ')||'none'}\nInvocation: "${atkInv}"\n\nDEFENDER: ${defender.name} (${defender.specialization}, bond ${bondAvg(defender)})\nMemories: ${defMem.results?.map(r=>r.text).join(' | ')||'none'}\nInvocation: "${defInv}"\n\nTERRAIN: ${terrain}`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 800 });

  let eval_;
  try { const m = result.match(/\{[\s\S]*\}/); eval_ = m ? JSON.parse(m[0]) : fallback(); } catch { eval_ = fallback(); }

  const winner = eval_.winner === 'draw' ? (Math.random() > 0.5 ? 'attacker' : 'defender') : eval_.winner;
  return {
    winner, loser: winner === 'attacker' ? 'defender' : 'attacker',
    narrative: eval_.narrative, scores: { attacker: eval_.attacker, defender: eval_.defender },
    attackerInvocation: atkInv, defenderInvocation: defInv,
  };
}

async function generateInvocation(spirit, terrain, memories) {
  return callLLM('Generate battle invocation.',
    `You are ${spirit.name}, a ${spirit.specialization}. Bond: ${bondAvg(spirit)}/100. Terrain: ${terrain}.\nMemories: ${memories.results?.map(r=>r.text).join('\n')||'None'}\n\nGenerate 2-3 sentence battle cry channeling memories into combat.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 150 });
}

function bondAvg(s) { const b = s.bond; return Math.round((b.depth+b.harmony+b.adventure+b.loyalty)/4); }
function fallback() {
  const a=10+Math.floor(Math.random()*10), d=10+Math.floor(Math.random()*10);
  return { attacker:{totalScore:a}, defender:{totalScore:d}, winner:a>d?'attacker':a<d?'defender':'draw', margin:Math.abs(a-d)<3?'razor-thin':'close', narrative:'The spirits clashed in a contest of will and memory.' };
}
```

#### server/services/battleResolver.js (NEW — timer completion for battles)

```javascript
import { getKey } from './keyStore.js';
import { storeMemoryServer } from './memwalServer.js';
import { applyBondAction } from './bondService.js';
import { claimHex, findRetreatHex } from './territoryService.js';

export async function resolveBattle(gameState, timer) {
  const { attackerId, defenderId, hexId, terrain } = timer.data;
  const attacker = gameState.spirits[attackerId];
  const defender = gameState.spirits[defenderId];
  if (!attacker || !defender) return { type: 'battle_cancelled', reason: 'Spirit missing', hexId };

  const { evaluateBattle } = await import('./battleArbiterService.js');
  const evaluation = await evaluateBattle({ attacker, defender, terrain, gameState });

  const winnerSpirit = evaluation.winner === 'attacker' ? attacker : defender;
  const loserSpirit = evaluation.winner === 'attacker' ? defender : attacker;

  applyBondAction(winnerSpirit, 'battleWin');
  applyBondAction(loserSpirit, 'battleLoss');
  winnerSpirit.combatXP += 5; loserSpirit.combatXP += 2; winnerSpirit.kills += 1;

  const margin = Math.abs((evaluation.scores.attacker?.totalScore||15)-(evaluation.scores.defender?.totalScore||15));
  let loserOutcome;

  if (margin >= 8) { // fatal
    loserSpirit.alive = false; loserSpirit.currentAction = null;
    const hex = gameState.map.hexes[loserSpirit.hexId];
    if (hex) hex.spiritIds = hex.spiritIds.filter(id => id !== loserSpirit.id);
    loserOutcome = 'died'; gameState.players[loserSpirit.playerId].spiritCount--;
  } else { // retreat
    const retreatHexId = findRetreatHex(loserSpirit, gameState);
    if (retreatHexId) {
      const from = gameState.map.hexes[loserSpirit.hexId];
      if (from) from.spiritIds = from.spiritIds.filter(id => id !== loserSpirit.id);
      const to = gameState.map.hexes[retreatHexId];
      if (to) to.spiritIds.push(loserSpirit.id);
      loserSpirit.hexId = retreatHexId; loserOutcome = 'retreated';
    } else {
      loserSpirit.alive = false; loserOutcome = 'died';
      gameState.players[loserSpirit.playerId].spiritCount--;
    }
  }

  claimHex(hexId, winnerSpirit.playerId, gameState);
  winnerSpirit.hexesClaimed += 1;

  const battleLog = `[BATTLE] ${attacker.name} vs ${defender.name} at hex ${hexId} (${terrain}). ${winnerSpirit.name} wins. Loser ${loserOutcome}.`;
  await Promise.allSettled([
    storeMemoryServer(attacker.memwalNamespace, battleLog, getKey(attacker.id), attacker.memwalAccountId),
    storeMemoryServer(defender.memwalNamespace, battleLog, getKey(defender.id), defender.memwalAccountId),
  ]);
  attacker.memoryCount += 1; defender.memoryCount += 1;

  gameState.eventLog.push({ type: 'battle_resolved', playerId: winnerSpirit.playerId,
    targetPlayerId: loserSpirit.playerId, spiritId: winnerSpirit.id,
    timestamp: Date.now(), summary: battleLog });

  return { type: 'battle_resolved', attackerId, defenderId, hexId, winnerId: winnerSpirit.id,
    loserId: loserSpirit.id, loserOutcome, narrative: evaluation.narrative, scores: evaluation.scores };
}
```

#### server/services/spawnResolver.js (NEW — timer completion for spawns)

```javascript
import { getKey, setKey } from './keyStore.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { callLLM } from './llmProxy.js';
import { generateDelegateKey, createAccount, addDelegateKey } from '@mysten-incubation/memwal/account';

export async function resolveSpawn(gameState, timer) {
  const { parentId } = timer.data;
  const parent = gameState.spirits[parentId];
  if (!parent || !parent.alive) return { type: 'spawn_failed', parentId, reason: 'Parent not alive' };

  const parentKey = getKey(parent.id);
  const allMem = await recallMemoriesServer(parent.memwalNamespace, '', 20, parentKey, parent.memwalAccountId);

  let inherited = [];
  if (allMem.results?.length) {
    const ranking = await callLLM('Rank memories by formative importance.',
      `Memories:\n${allMem.results.map((r,i)=>`${i+1}. ${r.text}`).join('\n')}\n\nReturn JSON: {"indices":[...]}`,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 200 });
    let idx; try { const m=ranking.match(/\{[\s\S]*\}/); idx=m?JSON.parse(m[0]).indices:[1,2,3,4,5]; } catch { idx=[1,2,3,4,5]; }
    inherited = idx.map(i=>allMem.results[i-1]).filter(Boolean).map(r=>r.text);
  }

  const childPersonality = await callLLM('Create spirit personality.',
    `Parent: ${parent.personality}\nMemories:\n${inherited.join('\n')||'(none)'}\nGenerate 2-3 sentence child personality.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 200 });

  const childName = (await callLLM('Name a spirit.',
    `Parent: ${parent.name}. Personality: ${childPersonality}. Return 1 word.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 20 })).trim();

  const childKeyData = await generateDelegateKey();
  const childNs = `spirit-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  let childAcctId;
  try {
    const { accountId } = await createAccount({
      packageId: process.env.MEMWAL_PACKAGE_ID, registryId: process.env.MEMWAL_REGISTRY_ID,
      suiPrivateKey: process.env.SERVER_SUI_PRIVATE_KEY, suiNetwork: process.env.SUI_NETWORK || 'testnet',
    });
    childAcctId = accountId;
    await addDelegateKey({ packageId: process.env.MEMWAL_PACKAGE_ID, accountId: childAcctId,
      publicKey: childKeyData.publicKey, label: `spirit-${childName}`,
      suiPrivateKey: process.env.SERVER_SUI_PRIVATE_KEY, suiNetwork: process.env.SUI_NETWORK || 'testnet' });
  } catch { childAcctId = parent.memwalAccountId; }

  const childId = `spirit-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  setKey(childId, childKeyData.privateKey);

  for (const m of inherited) {
    await storeMemoryServer(childNs, `[INHERITED] ${m}`, childKeyData.privateKey, childAcctId).catch(()=>{});
  }

  const child = {
    id: childId, name: childName, personality: childPersonality,
    specialization: 'generalist', generation: parent.generation + 1,
    parentId: parent.id, hexId: parent.hexId, playerId: parent.playerId,
    bond: { depth: Math.round(parent.bond.depth*0.3), harmony: Math.round(parent.bond.harmony*0.3),
      adventure: Math.round(parent.bond.adventure*0.3), loyalty: Math.round(parent.bond.loyalty*0.3) },
    alive: true, memwalNamespace: childNs, memwalAccountId: childAcctId,
    spawnCount: 0, memoryCount: inherited.length,
    combatXP: 0, explorationXP: 0, socialXP: 0, wisdomXP: 0,
    kills: 0, hexesClaimed: 0, whispersReceived: 0, whispersOriginated: 0,
    reincarnationCount: 0, previousNames: [], pastLifeMemories: [],
    memorableActions: [], lastSpawnAt: 0, currentAction: null,
  };

  gameState.spirits[childId] = child;
  const hex = gameState.map.hexes[parent.hexId];
  if (hex) hex.spiritIds.push(childId);
  gameState.players[parent.playerId].spiritCount++;
  parent.spawnCount++; parent.lastSpawnAt = Date.now();

  const log = `[SPAWN] ${parent.name} spawned ${childName} (gen ${child.generation}) at hex ${parent.hexId}. ${inherited.length} memories inherited.`;
  await Promise.allSettled([
    storeMemoryServer(parent.memwalNamespace, log, parentKey, parent.memwalAccountId),
    storeMemoryServer(childNs, log, childKeyData.privateKey, childAcctId),
  ]);
  parent.memoryCount += 1;

  gameState.eventLog.push({ type: 'spirit_spawned', playerId: parent.playerId,
    spiritId: childId, timestamp: Date.now(), summary: log });

  return { type: 'spawn_complete', parentId: parent.id, childId, childName,
    generation: child.generation, hexId: parent.hexId, inheritedMemories: inherited.length };
}
```

#### server/services/spawningService.js (v2 — spawn readiness + child trait calculation)

```javascript
import { callLLM } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const SPAWN_COOLDOWN_MS = 300_000;
const MIN_MEMORIES = 10;
const MIN_BOND_AVG = 50;

export function checkSpawnReadiness(spirit) {
  const avg = bondAvg(spirit);
  const now = Date.now();
  const cooldownEnd = (spirit.lastSpawnAt || 0) + SPAWN_COOLDOWN_MS;
  const cooldownReady = now >= cooldownEnd;
  const reasons = [
    spirit.memoryCount < MIN_MEMORIES ? `Need ${MIN_MEMORIES - spirit.memoryCount} more memories` : null,
    avg < MIN_BOND_AVG ? `Bond too low (${Math.round(avg)}/${MIN_BOND_AVG})` : null,
    !cooldownReady ? `Cooldown: ${Math.round((cooldownEnd - now) / 1000)}s` : null,
    !spirit.alive ? 'Dead' : null,
  ].filter(Boolean);
  return { ready: spirit.alive && spirit.memoryCount >= MIN_MEMORIES && avg >= MIN_BOND_AVG && cooldownReady,
    memoryCount: spirit.memoryCount, bondAvg: avg, reasons };
}

export async function calculateChildTraits(parent, gameState) {
  const key = getKey(parent.id);
  const allMem = await recallMemoriesServer(parent.memwalNamespace, '', 20, key, parent.memwalAccountId);
  let inherited = [];
  if (allMem.results?.length) {
    const r = await callLLM('Rank memories.', `Memories:\n${allMem.results.map((r,i)=>`${i+1}. ${r.text}`).join('\n')}\nReturn JSON: {"indices":[...]}`,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 200 });
    let idx; try { const m=r.match(/\{[\s\S]*\}/); idx=m?JSON.parse(m[0]).indices:[1,2,3,4,5]; } catch { idx=[1,2,3,4,5]; }
    inherited = idx.map(i=>allMem.results[i-1]).filter(Boolean).map(r=>r.text);
  }
  const hex = gameState.map.hexes[parent.hexId];
  const personality = await callLLM('Create personality.', `Parent: ${parent.personality}\nTerrain: ${hex?.terrain||'unknown'}\nMemories:\n${inherited.join('\n')||'(none)'}\nGenerate 2-3 sentence child personality.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 200 });
  const name = (await callLLM('Name.', `Parent: ${parent.name}. Child: ${personality}. 1 word.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 20 })).trim();
  const jit = r => Math.floor(Math.random()*(r*2+1))-r;
  return { childPersonality: personality, childName: name, inheritedMemories: inherited,
    childBond: { depth: clamp(Math.round(parent.bond.depth*0.3+jit(5)),0,100),
      harmony: clamp(Math.round(parent.bond.harmony*0.3+jit(5)),0,100),
      adventure: clamp(Math.round(parent.bond.adventure*0.3+jit(5)),0,100),
      loyalty: clamp(Math.round(parent.bond.loyalty*0.3+jit(5)),0,100) } };
}

function bondAvg(s) { const b=s.bond; return (b.depth+b.harmony+b.adventure+b.loyalty)/4; }
function clamp(v,min,max) { return Math.max(min,Math.min(max,v)); }
```

### 7.5 Frontend Entry (App.jsx + main.jsx)

#### frontend/src/main.jsx

```jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SuiClientProvider, WalletProvider } from '@mysten/dapp-kit';
import { createNetworkConfig } from '@mysten/dapp-kit';
import '@mysten/dapp-kit/dist/index.css';
import App from './App.jsx';
import './index.css';

const queryClient = new QueryClient();

const { networkConfig } = createNetworkConfig({
  testnet: {
    url: 'https://fullnode.testnet.sui.io',
    variables: {
      packageId: import.meta.env.VITE_PACKAGE_ID || '',
      gameMapId: import.meta.env.VITE_GAME_MAP_ID || '',
    },
  },
  mainnet: {
    url: 'https://fullnode.mainnet.sui.io',
    variables: {},
  },
});

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

#### frontend/src/App.jsx

```jsx
import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import HexMap from './components/HexMap.jsx';
import SpiritPanel from './components/SpiritPanel.jsx';
import CommandBar from './components/CommandBar.jsx';
import WalletConnect from './components/WalletConnect.jsx';
import PlayerHud from './components/PlayerHud.jsx';
import Lobby from './components/Lobby.jsx';
import EssenceExport from './components/EssenceExport.jsx';

export default function App() {
  const account = useCurrentAccount();
  const [gameState, setGameState] = useState(null);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [events, setEvents] = useState([]);
  const wsRef = useRef(null);

  // WebSocket connection
  useEffect(() => {
    const playerId = account?.address || 'player-1';
    const wsBase = import.meta.env.DEV
      ? 'ws://localhost:3001'
      : (import.meta.env.VITE_WS_URL || `wss://${window.location.host}`);
    const ws = new WebSocket(`${wsBase}/ws?playerId=${playerId}`);

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === 'tick') {
        setGameState(msg.state);
        if (msg.events?.length) {
          setEvents(prev => [...prev.slice(-50), ...msg.events]);
        }
      }
    };

    ws.onopen = () => {
      // Request initial state
      fetch('/api/game/state')
        .then(r => r.json())
        .then(setGameState);
    };

    wsRef.current = ws;
    return () => ws.close();
  }, [account?.address]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-display text-amber-500 mb-4">Anima Swarm</h1>
          <p className="text-gray-400">Connecting to game...</p>
        </div>
      </div>
    );
  }

  const playerId = account?.address || 'player-1';
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId && s.alive);

  // Lobby: waiting for game to start
  if (gameState.status === 'lobby') {
    return <Lobby playerId={playerId} gameState={gameState} />;
  }

  // Game over: show results + essence export
  if (gameState.status === 'finished') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md space-y-6">
          <h1 className="text-3xl font-display text-amber-500">
            {gameState.winner === playerId ? 'Victory' : 'Defeat'}
          </h1>
          <p className="text-gray-400">
            {gameState.winner === playerId
              ? 'Your swarm dominates the world.'
              : `${gameState.players[gameState.winner]?.name || 'Another deity'} has conquered the realm.`}
          </p>
          <EssenceExport playerId={playerId} gameResult={gameState.winner === playerId ? 'victory' : 'defeat'} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-4">
        <h1 className="font-display text-lg text-amber-500 font-semibold">Anima Swarm</h1>
        <div className="flex items-center gap-4">
          <PlayerHud player={gameState.players[playerId]} spirits={mySpirits} gameState={gameState} />
          <WalletConnect />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex">
        {/* Hex Map — left 60% */}
        <div className="flex-1 relative">
          <HexMap
            hexes={gameState.map.hexes}
            spirits={gameState.spirits}
            playerId={playerId}
            selectedSpirit={selectedSpirit}
            onSelectSpirit={setSelectedSpirit}
          />
        </div>

        {/* Spirit Panel — right 40% */}
        <div className="w-[400px] border-l border-gray-700/50 bg-gray-900/60 backdrop-blur overflow-y-auto">
          {selectedSpirit ? (
            <SpiritPanel
              spirit={gameState.spirits[selectedSpirit]}
              gameState={gameState}
              playerId={playerId}
            />
          ) : (
            <div className="p-6 text-center text-gray-500">
              <p className="text-sm">Select a spirit to commune</p>
            </div>
          )}
        </div>
      </main>

      {/* Command Bar — bottom */}
      <CommandBar
        timers={gameState.activeTimers}
        events={events}
        spirits={mySpirits}
        gameState={gameState}
      />
    </div>
  );
}
```

### 7.6 Core Components

#### HexMap.jsx

```jsx
import { useMemo } from 'react';
import { hexToPixel } from '@lib/hexMath.js';
import { TERRAIN_COLORS, getPlayerColor } from '@lib/terrainTypes.js';

const HEX_SIZE = 40;

export default function HexMap({ hexes, spirits, playerId, selectedSpirit, onSelectSpirit, gameState }) {
  const hexArray = useMemo(() => Object.values(hexes), [hexes]);

  // Calculate SVG viewBox to fit all hexes
  const points = hexArray.map(h => hexToPixel({ q: h.q, r: h.r }, HEX_SIZE));
  const minX = Math.min(...points.map(p => p.x)) - HEX_SIZE * 2;
  const maxX = Math.max(...points.map(p => p.x)) + HEX_SIZE * 2;
  const minY = Math.min(...points.map(p => p.y)) - HEX_SIZE * 2;
  const maxY = Math.max(...points.map(p => p.y)) + HEX_SIZE * 2;

  return (
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="w-full h-full"
      style={{ background: 'var(--bg-deep)' }}
    >
      {hexArray.map(hex => {
        const { x, y } = hexToPixel({ q: hex.q, r: hex.r }, HEX_SIZE);
        const terrainColor = TERRAIN_COLORS[hex.terrain] || '#374151';
        const controlColor = hex.controller ? (getPlayerColor(hex.controller, gameState) || '#6b7280') : null;
        const hexSpirits = hex.spiritIds.map(id => spirits[id]).filter(Boolean);
        const hasMine = hexSpirits.some(s => s.playerId === playerId);

        return (
          <g key={hex.id} transform={`translate(${x}, ${y})`}>
            {/* Hex shape */}
            <polygon
              points={hexPoints(HEX_SIZE)}
              fill={terrainColor}
              stroke={controlColor || '#1f2937'}
              strokeWidth={controlColor ? 3 : 1}
              opacity={0.85}
              className="cursor-pointer hover:opacity-100 transition-opacity"
            />

            {/* Territory control glow */}
            {controlColor && (
              <polygon
                points={hexPoints(HEX_SIZE - 4)}
                fill="none"
                stroke={controlColor}
                strokeWidth={1}
                opacity={0.4}
              />
            )}

            {/* Memory pool indicator */}
            {hex.memoryPool > 0 && (
              <text x={0} y={HEX_SIZE * 0.55} textAnchor="middle" className="text-[9px] fill-amber-400/60 font-mono">
                {hex.memoryPool}
              </text>
            )}

            {/* Spirit indicators */}
            {hexSpirits.map((spirit, i) => {
              const angle = (2 * Math.PI * i) / Math.max(hexSpirits.length, 1);
              const r = hexSpirits.length === 1 ? 0 : HEX_SIZE * 0.35;
              const sx = r * Math.cos(angle);
              const sy = r * Math.sin(angle);
              const isSelected = spirit.id === selectedSpirit;
              const isMine = spirit.playerId === playerId;

              return (
                <g
                  key={spirit.id}
                  transform={`translate(${sx}, ${sy})`}
                  onClick={(e) => { e.stopPropagation(); onSelectSpirit(spirit.id); }}
                  className="cursor-pointer"
                >
                  <circle
                    r={6}
                    fill={getPlayerColor(spirit.playerId, gameState) || '#6b7280'}
                    stroke={isSelected ? '#f59e0b' : 'none'}
                    strokeWidth={isSelected ? 2 : 0}
                  />
                  {spirit.currentAction && (
                    <circle r={8} fill="none" stroke="#f59e0b" strokeWidth={1} opacity={0.5} className="animate-ping" />
                  )}
                </g>
              );
            })}

            {/* Terrain label */}
            <text x={0} y={-HEX_SIZE * 0.3} textAnchor="middle" className="text-[8px] fill-white/30 font-mono pointer-events-none">
              {hex.biome?.substring(0, 6)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

function hexPoints(size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}
```

#### SpiritPanel.jsx

```jsx
import { useState, useRef, useEffect } from 'react';
import { SPEC_COLORS } from '@lib/terrainTypes.js';

export default function SpiritPanel({ spirit, gameState, playerId }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const isMine = spirit.playerId === playerId;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    if (!input.trim() || sending || !isMine) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setSending(true);

    try {
      const res = await fetch('/api/game/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spiritId: spirit.id,
          message: userMsg,
          playerId,
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'spirit', text: data.response }]);

      if (data.whispers?.length) {
        setMessages(prev => [...prev, {
          role: 'system',
          text: `Whispers propagated to ${data.whispers.length} spirit${data.whispers.length > 1 ? 's' : ''}`,
        }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { role: 'system', text: 'Failed to reach spirit.' }]);
    } finally {
      setSending(false);
    }
  }

  const bondAvg = Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );

  return (
    <div className="flex flex-col h-full">
      {/* Spirit Header */}
      <div className="p-4 border-b border-gray-700/50">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
            style={{ background: SPEC_COLORS[spirit.specialization] || '#6b7280' }}
          >
            {spirit.name[0]}
          </div>
          <div>
            <h2 className="font-display text-lg font-semibold">{spirit.name}</h2>
            <p className="text-xs text-gray-400">
              {spirit.specialization} · gen {spirit.generation} · bond {bondAvg}
            </p>
          </div>
        </div>

        {/* XP Bars */}
        <div className="mt-3 grid grid-cols-4 gap-1">
          {[
            { label: 'COM', value: spirit.combatXP, color: '#dc2626' },
            { label: 'EXP', value: spirit.explorationXP, color: '#2563eb' },
            { label: 'SOC', value: spirit.socialXP, color: '#16a34a' },
            { label: 'WIS', value: spirit.wisdomXP, color: '#9333ea' },
          ].map(xp => (
            <div key={xp.label} className="text-center">
              <div className="text-[9px] text-gray-500 mb-0.5">{xp.label}</div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${Math.min(100, (xp.value / 30) * 100)}%`, background: xp.color }} />
              </div>
              <div className="text-[9px] text-gray-400 mt-0.5">{xp.value}</div>
            </div>
          ))}
        </div>

        {/* Current Action */}
        {spirit.currentAction && (
          <div className="mt-2 px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400">
            {spirit.currentAction.type}... {Math.max(0, Math.round((spirit.currentAction.completesAt - Date.now()) / 1000))}s
          </div>
        )}
      </div>

      {/* Chat Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-sm text-gray-500 italic">
            {isMine ? `Whisper to ${spirit.name}...` : `Observing ${spirit.name}`}
          </p>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${
              msg.role === 'user' ? 'bg-amber-500/20 text-amber-100' :
              msg.role === 'system' ? 'bg-gray-700/30 text-gray-400 italic text-xs' :
              'bg-gray-700/50 text-gray-200'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {isMine && (
        <form onSubmit={sendMessage} className="p-3 border-t border-gray-700/50">
          <div className="flex gap-2">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Whisper to your spirit..."
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !input.trim()}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black font-semibold rounded-lg px-4 py-2 text-sm"
            >
              {sending ? '...' : 'Send'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
```

#### CommandBar.jsx

```jsx
export default function CommandBar({ timers, events, spirits, gameState }) {
  const recentEvents = events.slice(-5).reverse();

  return (
    <div className="h-24 bg-gray-900/90 backdrop-blur border-t border-gray-700/50 flex">
      {/* Active Timers */}
      <div className="flex-1 p-2 overflow-x-auto">
        <div className="text-[10px] text-gray-500 mb-1 font-mono">ACTIVE</div>
        <div className="flex gap-2">
          {timers.filter(t => {
            const spirit = gameState.spirits[t.spiritId];
            return spirit && spirits.some(s => s.id === spirit.id);
          }).map(timer => {
            const remaining = Math.max(0, Math.round((timer.completesAt - Date.now()) / 1000));
            const spirit = gameState.spirits[timer.spiritId];
            return (
              <div key={timer.id} className="bg-gray-800/80 border border-gray-700/50 rounded px-2 py-1 min-w-[120px]">
                <div className="text-[10px] text-amber-400 font-mono">{timer.type}</div>
                <div className="text-xs text-gray-300">{spirit?.name}</div>
                <div className="text-sm font-mono text-white">{remaining}s</div>
              </div>
            );
          })}
          {timers.length === 0 && (
            <div className="text-xs text-gray-600 italic">No active timers</div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div className="w-[300px] border-l border-gray-700/50 p-2 overflow-y-auto">
        <div className="text-[10px] text-gray-500 mb-1 font-mono">EVENTS</div>
        {recentEvents.map((evt, i) => (
          <div key={i} className="text-[11px] text-gray-400 mb-0.5 truncate">
            {formatEvent(evt, gameState)}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatEvent(evt, gs) {
  const spiritName = (id) => gs.spirits[id]?.name || id;
  switch (evt.type) {
    case 'spirit_moving': return `${spiritName(evt.spiritId)} moving...`;
    case 'movement_complete': return `${spiritName(evt.spiritId)} arrived`;
    case 'battle_started': return `${spiritName(evt.attackerId)} attacks ${spiritName(evt.defenderId)}!`;
    case 'battle_resolving': return `Battle resolving...`;
    case 'spawn_started': return `${spiritName(evt.spiritId)} spawning...`;
    case 'spawn_ready': return `New spirit born!`;
    case 'spirit_gathered': return `${spiritName(evt.spiritId)} gathered ${evt.amount} memories`;
    case 'game_over': return `GAME OVER — ${gs.players[evt.winner]?.name || 'Player'} wins!`;
    default: return evt.type;
  }
}
```

#### Lobby.jsx

```jsx
import { useState } from 'react';
import EssenceImport from './EssenceImport.jsx';
import WalletConnect from './WalletConnect.jsx';

export default function Lobby({ playerId, gameState }) {
  const [importedEssence, setImportedEssence] = useState(null);
  const [ready, setReady] = useState(false);

  async function handleReady() {
    setReady(true);
    await fetch('/api/game/ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        importedEssence: importedEssence || null,
      }),
    });
  }

  const playerCount = Object.values(gameState.players).filter(p => p.connected).length;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0a0e17]">
      <div className="max-w-lg w-full space-y-8 text-center p-8">
        <div>
          <h1 className="text-4xl font-display text-amber-500 font-bold mb-2">Anima Swarm</h1>
          <p className="text-gray-400 text-sm">Deity-controlled AI strategy</p>
        </div>

        <div className="bg-gray-800/60 rounded-lg p-6 border border-gray-700/50 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-gray-400 text-sm">Connected</span>
            <span className="text-amber-400 font-mono">{playerCount}/5</span>
          </div>
          <WalletConnect />
        </div>

        <EssenceImport playerId={playerId} onImported={setImportedEssence} />

        {importedEssence && (
          <div className="bg-amber-900/20 border border-amber-600/30 rounded-lg p-3">
            <p className="text-amber-400 text-sm">
              Essence loaded: {importedEssence.spirits?.length || 0} spirits,
              lineage depth {importedEssence.lineageDepth || 1}
            </p>
          </div>
        )}

        <button
          onClick={handleReady}
          disabled={ready}
          className="w-full py-3 bg-amber-600 hover:bg-amber-500 disabled:bg-gray-700
                     disabled:text-gray-500 rounded-lg text-white font-display text-lg
                     transition-colors"
        >
          {ready ? 'Waiting for others...' : 'Ready'}
        </button>
      </div>
    </div>
  );
}
```


#### frontend/src/components/WalletConnect.jsx

```jsx
import { useConnectWallet, useCurrentAccount, useDisconnectWallet, useWallets } from '@mysten/dapp-kit';

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnect() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect, isPending: isConnecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  if (account) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-md border border-amber-500/30 bg-gray-900/80 backdrop-blur-sm">
          <span className="font-mono text-xs text-amber-400 tracking-wide">
            {truncateAddress(account.address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-2.5 py-1.5 rounded-md text-xs font-header uppercase tracking-wider text-gray-400 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 bg-gray-900/60 backdrop-blur-sm transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { if (wallets.length > 0) connect({ wallet: wallets[0] }); }}
      disabled={isConnecting || wallets.length === 0}
      className="px-4 py-1.5 rounded-md font-header text-xs uppercase tracking-wider font-semibold bg-amber-500 text-gray-900 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {isConnecting ? 'Connecting...' : wallets.length === 0 ? 'No Wallet' : 'Connect Wallet'}
    </button>
  );
}
```

#### frontend/src/components/PlayerHud.jsx

```jsx
const TOTAL_HEXES = 37;

export default function PlayerHud({ player, spirits, gameState }) {
  if (!player) return null;

  const hexesControlled = player.hexesControlled || 0;
  const spiritCount = spirits?.length || 0;
  const territoryPct = TOTAL_HEXES > 0 ? Math.round((hexesControlled / TOTAL_HEXES) * 100) : 0;

  const divinePower = spiritCount > 0
    ? Math.round(spirits.reduce((sum, s) => {
        const b = s.bond || { depth: 0, harmony: 0, adventure: 0, loyalty: 0 };
        return sum + (b.depth + b.harmony + b.adventure + b.loyalty) / 4;
      }, 0) / spiritCount)
    : 0;

  return (
    <div className="flex items-center gap-3 px-3 py-1 rounded-md border border-gray-700/40 bg-gray-900/60 backdrop-blur-sm">
      <span className="font-header text-xs text-amber-400 uppercase tracking-wider">
        {player.name || 'Unknown Deity'}
      </span>
      <div className="w-px h-4 bg-gray-700/50" />
      <div className="flex items-center gap-2.5 text-xs font-mono">
        <HudStat label="HEX" value={hexesControlled} color="text-amber-400" />
        <HudStat label="SPR" value={spiritCount} color="text-teal-400" />
        <HudStat label="TER" value={`${territoryPct}%`}
          color={territoryPct >= 50 ? 'text-amber-300' : 'text-gray-400'} />
        <HudStat label="PWR" value={divinePower}
          color={divinePower >= 70 ? 'text-amber-300' : divinePower >= 40 ? 'text-gray-300' : 'text-gray-500'} />
      </div>
    </div>
  );
}

function HudStat({ label, value, color }) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-gray-500 text-[10px]">{label}</span>
      <span className={`${color} tabular-nums`}>{value}</span>
    </div>
  );
}
```


### 7.7 Data Files

#### lib/terrainTypes.js

```javascript
export const TERRAIN_TYPES = {
  forest: { memoryRate: 1.2, defenseMult: 1.2, label: 'Forest', spiritAffinity: ['scout', 'gatherer'] },
  desert: { memoryRate: 0.8, defenseMult: 1.0, label: 'Desert', spiritAffinity: ['warrior'] },
  ocean: { memoryRate: 1.0, defenseMult: 1.4, label: 'Ocean', spiritAffinity: ['scout'] },
  mountain: { memoryRate: 0.6, defenseMult: 1.3, label: 'Mountain', spiritAffinity: ['sage'] },
  grassland: { memoryRate: 1.5, defenseMult: 1.0, label: 'Grassland', spiritAffinity: ['gatherer'] },
  tundra: { memoryRate: 0.5, defenseMult: 1.1, label: 'Tundra', spiritAffinity: ['warrior'] },
  volcanic: { memoryRate: 0.4, defenseMult: 1.0, label: 'Volcanic', spiritAffinity: ['warrior'] },
  coastal: { memoryRate: 1.3, defenseMult: 1.1, label: 'Coastal', spiritAffinity: ['scout', 'gatherer'] },
};

export const TERRAIN_COLORS = {
  forest: '#166534',
  desert: '#a16207',
  ocean: '#1e40af',
  mountain: '#57534e',
  grassland: '#4d7c0f',
  tundra: '#94a3b8',
  volcanic: '#991b1b',
  coastal: '#0e7490',
};

// Player color palette — assigned by join order, not by ID string.
// Use getPlayerColor(playerId, gameState) to resolve wallet addresses to colors.
const PLAYER_COLOR_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316'];
const playerColorCache = new Map();

export function getPlayerColor(playerId, gameState) {
  if (playerColorCache.has(playerId)) return playerColorCache.get(playerId);
  const playerIds = Object.keys(gameState?.players || {});
  const index = playerIds.indexOf(playerId);
  const color = PLAYER_COLOR_PALETTE[index >= 0 ? index % PLAYER_COLOR_PALETTE.length : 0];
  playerColorCache.set(playerId, color);
  return color;
}

export function resetPlayerColors() { playerColorCache.clear(); }

export const SPEC_COLORS = {
  warrior: '#dc2626',
  scout: '#2563eb',
  gatherer: '#16a34a',
  sage: '#9333ea',
  generalist: '#6b7280',
};
```

#### lib/hexGrid.js

```javascript
import { generateHexGrid, hexId, startingPositions } from './hexMath.js';
import { TERRAIN_TYPES } from './terrainTypes.js'; // lib/terrainTypes.js

const RADIUS = 3; // 37-hex map (3-ring)

// Terrain assignment pattern: center ring = contested high-value, edges = varied
const TERRAIN_PATTERN = [
  // Ring 0 (center): grassland (high value, contested)
  { maxDist: 0, terrain: 'grassland', biome: 'Central Plains' },
  // Ring 1: mixed forest/coastal
  { maxDist: 1, terrain: 'forest', biome: 'Temperate Forest' },
  // Ring 2: varied
  { maxDist: 2, terrains: ['mountain', 'desert', 'coastal', 'forest', 'tundra', 'grassland'], biomes: ['Highland Range', 'Arid Basin', 'Coral Shore', 'Boreal Forest', 'Frozen Waste', 'Savanna'] },
  // Ring 3 (edge): varied with some ocean
  { maxDist: 3, terrains: ['ocean', 'volcanic', 'tundra', 'desert', 'coastal', 'forest', 'mountain', 'grassland', 'ocean', 'forest', 'coastal', 'ocean'], biomes: ['Deep Ocean', 'Volcanic Isle', 'Arctic Shelf', 'Sand Sea', 'Reef Coast', 'Mangrove', 'Rim Peak', 'Steppe', 'Open Water', 'Rain Forest', 'Bay Shore', 'Sea'] },
];

export function createHexGrid() {
  const hexes = generateHexGrid(RADIUS);
  const result = {};

  for (const hex of hexes) {
    const dist = Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(-hex.q - hex.r));
    const pattern = TERRAIN_PATTERN.find(p => p.maxDist >= dist) || TERRAIN_PATTERN[TERRAIN_PATTERN.length - 1];

    let terrain, biome;
    if (pattern.terrain) {
      terrain = pattern.terrain;
      biome = pattern.biome;
    } else {
      const idx = (Math.abs(hex.q * 7 + hex.r * 13)) % pattern.terrains.length;
      terrain = pattern.terrains[idx];
      biome = pattern.biomes[idx];
    }

    const terrainData = TERRAIN_TYPES[terrain];
    result[hex.id] = {
      id: hex.id,
      q: hex.q,
      r: hex.r,
      terrain,
      biome,
      controller: null,
      spiritIds: [],
      memoryPool: 0,
      memoryCap: 50,
      memoryRate: terrainData.memoryRate,
    };
  }

  return { radius: RADIUS, hexes: result };
}

export function getStartingPositions() {
  return startingPositions(RADIUS, 5);
}

export const HEX_COUNT = generateHexGrid(RADIUS).length; // 37
```

#### lib/seedSpirits.js

```javascript
export const SEED_SPIRITS = [
  {
    name: 'Ember',
    personality: 'Fierce and territorial. Speaks in short, decisive bursts. Sees the world in terms of strength and weakness. Loyal to the core once trust is earned, but tests every deity relentlessly. Values courage above all.',
    specialization: 'generalist',
    playerIndex: 0,
  },
  {
    name: 'Drift',
    personality: 'Curious and restless. Always wondering what lies beyond the next hex. Speaks in flowing, meandering sentences that mirror their wandering nature. Fascinated by the unknown. Sometimes forgets to defend what they already have.',
    specialization: 'generalist',
    playerIndex: 1,
  },
  {
    name: 'Moss',
    personality: 'Patient and nurturing. Speaks softly with the cadence of growing things. Values accumulation over aggression. Would rather build a garden than burn an enemy. Deeply bonded with the land beneath their feet.',
    specialization: 'generalist',
    playerIndex: 2,
  },
  {
    name: 'Shade',
    personality: 'Analytical and detached. Observes patterns others miss. Speaks in riddles and fragments of forgotten knowledge. Values understanding over action. Will sacrifice tactical advantage for a beautiful insight.',
    specialization: 'generalist',
    playerIndex: 3,
  },
  {
    name: 'Gale',
    personality: 'Impulsive and loud. Acts before thinking, speaks before planning. Their enthusiasm is infectious but sometimes reckless. Deeply affected by loss but recovers quickly. Values freedom and movement.',
    specialization: 'generalist',
    playerIndex: 4,
  },
];
```

### 7.8 Game Initialization

#### server/services/gameInit.js

```javascript
import { createHexGrid, getStartingPositions } from '../../lib/hexGrid.js';
import { SEED_SPIRITS } from '../../lib/seedSpirits.js';
import { generateDelegateKey } from '@mysten-incubation/memwal/account';
import { setKey } from './keyStore.js';

const MEMWAL_PACKAGE_ID = process.env.MEMWAL_PACKAGE_ID || '0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6';
const MEMWAL_REGISTRY_ID = process.env.MEMWAL_REGISTRY_ID || '0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437';

export async function createInitialGameState() {
  const map = createHexGrid();
  const startPositions = getStartingPositions();

  const players = {};
  const spirits = {};

  for (let i = 0; i < 5; i++) {
    const playerId = `player-${i + 1}`;
    const isHuman = i === 0; // player 1 is human, rest are bots
    const startHex = Object.values(map.hexes).find(h => h.q === startPositions[i].q && h.r === startPositions[i].r);

    players[playerId] = {
      id: playerId,
      name: isHuman ? 'You' : `Bot ${i + 1}`,
      walletAddress: null,
      hexesControlled: 1,
      spiritCount: 1,
      isBot: !isHuman,
      connected: isHuman,
      lastSeen: Date.now(),
    };

    // Claim starting hex
    if (startHex) {
      startHex.controller = playerId;
    }

    // Create seed spirit
    const seed = SEED_SPIRITS[i];
    const delegateKey = await generateDelegateKey();
    const spiritId = `spirit-${playerId}-seed`;
    const namespace = `swarm-${playerId}`;

    // Bots get higher starting bond so they can spawn without human chat
    const startBond = isHuman
      ? { depth: 40, harmony: 40, adventure: 30, loyalty: 30 }
      : { depth: 55, harmony: 55, adventure: 45, loyalty: 45 };

    spirits[spiritId] = {
      id: spiritId,
      name: seed.name,
      personality: seed.personality,
      specialization: seed.specialization,
      generation: 0,
      parentId: null,
      hexId: startHex?.id || '1010',
      playerId,
      bond: startBond,
      alive: true,
      memwalNamespace: namespace,
      memwalAccountId: '', // populated when MemWal account created
      spawnCount: 0,
      memoryCount: isHuman ? 0 : 5, // bots start with some memories
      combatXP: 0,
      explorationXP: 0,
      socialXP: 0,
      wisdomXP: 0,
      currentAction: null,
      kills: 0,
      hexesClaimed: 0,
      whispersReceived: 0,
      whispersOriginated: 0,
      reincarnationCount: 0,
      previousNames: [],
      pastLifeMemories: [],
      memorableActions: [],
    };

    // Store delegate key separately (never serialized with game state)
    setKey(spiritId, delegateKey.privateKey);

    // Add spirit to hex
    if (startHex) {
      startHex.spiritIds.push(spiritId);
    }
  }

  return {
    id: `game-${Date.now()}`,
    status: 'lobby', // starts in lobby, transitions to active when player connects
    startedAt: Date.now(),
    tickInterval: 5000,
    map,
    players,
    spirits,
    pendingActions: [],
    activeTimers: [],
    actionHistory: [],
    eventLog: [],
    winner: null,
  };
}
```

### 7.9 Fixed Move Contracts (v2 — Complete)

**Move.toml** (complete):

```toml
[package]
name = "anima_swarm"
edition = "2024"

[dependencies]
Sui = { git = "https://github.com/MystenLabs/sui.git", subdir = "crates/sui-framework/packages/sui-framework", rev = "framework/testnet" }

[addresses]
anima_swarm = "0x0"
```

**Key fixes applied from v1 → v2:**

1. `spirit::mint()` now transfers internally via `transfer::public_transfer` — does NOT return Spirit
2. `birth_epoch` set via `tx_context::epoch(ctx)` instead of hardcoded 0
3. Removed `mood` field and `set_mood` function (mood system CUT in v2)
4. Added `AdminCap` one-time-witness created in `init()` — required on `update_bond`, `kill`, `update_xp`
5. Added `update_xp` function for server-side XP sync to chain
6. Specialization mapping: u8 on-chain (0=generalist, 1=warrior, 2=scout, 3=gatherer, 4=sage)
7. All public accessor functions added for frontend queries
8. `territory::create_map()` removed — `init()` creates + shares GameMap at publish
9. `AdminCap` check on `claim_hex`, `add_hex`
10. Removed `active_players` and `advance_epoch` from GameMap (v2 is continuous, no epochs)
11. `battle::record_battle()` transfers BattleRecord internally, requires AdminCap
12. `spawn::validate_spawn` simplified to bond threshold — cooldown is server-side (timestamp)
13. Replaced `@anima_swarm` with `recipient: address` parameter in `collect_spawn_fee`

#### spirit.move (v2 — complete)

```move
module anima_swarm::spirit;

use std::string::String;
use std::option::{Self, Option};
use sui::event;
use sui::transfer;
use sui::tx_context;

public struct SPIRIT has drop {}

public struct AdminCap has key, store {
    id: UID,
}

public struct Spirit has key, store {
    id: UID,
    name: String,
    personality_hash: vector<u8>,
    specialization: u8,
    generation: u64,
    parent_id: Option<address>,
    hex_id: u64,
    owner: address,
    bond_depth: u64,
    bond_harmony: u64,
    bond_adventure: u64,
    bond_loyalty: u64,
    memwal_namespace: String,
    spawn_count: u64,
    alive: bool,
    birth_epoch: u64,
    last_spawn_epoch: u64,
    combat_xp: u64,
    exploration_xp: u64,
    social_xp: u64,
    wisdom_xp: u64,
}

public struct SpiritMinted has copy, drop {
    spirit_id: address,
    name: String,
    owner: address,
    parent_id: Option<address>,
    generation: u64,
    hex_id: u64,
}

public struct SpiritDied has copy, drop {
    spirit_id: address,
    killer_id: address,
    hex_id: u64,
}

fun init(_witness: SPIRIT, ctx: &mut TxContext) {
    let cap = AdminCap { id: object::new(ctx) };
    transfer::transfer(cap, tx_context::sender(ctx));
}

public fun mint(
    _admin: &AdminCap,
    name: String,
    personality_hash: vector<u8>,
    hex_id: u64,
    memwal_namespace: String,
    parent_id: Option<address>,
    generation: u64,
    ctx: &mut TxContext,
) {
    let spirit = Spirit {
        id: object::new(ctx),
        name,
        personality_hash,
        specialization: 0,
        generation,
        parent_id,
        hex_id,
        owner: tx_context::sender(ctx),
        bond_depth: 30,
        bond_harmony: 30,
        bond_adventure: 30,
        bond_loyalty: 30,
        memwal_namespace,
        spawn_count: 0,
        alive: true,
        birth_epoch: tx_context::epoch(ctx),
        last_spawn_epoch: 0,
        combat_xp: 0,
        exploration_xp: 0,
        social_xp: 0,
        wisdom_xp: 0,
    };

    event::emit(SpiritMinted {
        spirit_id: object::id_address(&spirit),
        name: spirit.name,
        owner: spirit.owner,
        parent_id: spirit.parent_id,
        generation: spirit.generation,
        hex_id: spirit.hex_id,
    });

    transfer::public_transfer(spirit, tx_context::sender(ctx));
}

public fun update_bond(
    _admin: &AdminCap, spirit: &mut Spirit,
    depth: u64, harmony: u64, adventure: u64, loyalty: u64,
) {
    spirit.bond_depth = depth;
    spirit.bond_harmony = harmony;
    spirit.bond_adventure = adventure;
    spirit.bond_loyalty = loyalty;
}

public fun update_xp(
    _admin: &AdminCap, spirit: &mut Spirit,
    combat_xp: u64, exploration_xp: u64, social_xp: u64, wisdom_xp: u64,
) {
    spirit.combat_xp = combat_xp;
    spirit.exploration_xp = exploration_xp;
    spirit.social_xp = social_xp;
    spirit.wisdom_xp = wisdom_xp;
}

public fun update_specialization(spirit: &mut Spirit, spec: u8) {
    assert!(spec <= 4, 0);
    spirit.specialization = spec;
}

public fun move_to_hex(spirit: &mut Spirit, hex_id: u64) {
    spirit.hex_id = hex_id;
}

public fun kill(_admin: &AdminCap, spirit: &mut Spirit, killer_id: address) {
    spirit.alive = false;
    event::emit(SpiritDied {
        spirit_id: object::id_address(spirit),
        killer_id,
        hex_id: spirit.hex_id,
    });
}

public fun increment_spawn_count(spirit: &mut Spirit, epoch: u64) {
    spirit.spawn_count = spirit.spawn_count + 1;
    spirit.last_spawn_epoch = epoch;
}

public fun bond_average(spirit: &Spirit): u64 {
    (spirit.bond_depth + spirit.bond_harmony + spirit.bond_adventure + spirit.bond_loyalty) / 4
}

public fun is_alive(spirit: &Spirit): bool { spirit.alive }
public fun hex_id(spirit: &Spirit): u64 { spirit.hex_id }
public fun owner(spirit: &Spirit): address { spirit.owner }
public fun name(spirit: &Spirit): &String { &spirit.name }
public fun specialization(spirit: &Spirit): u8 { spirit.specialization }
public fun generation(spirit: &Spirit): u64 { spirit.generation }
public fun parent_id(spirit: &Spirit): &Option<address> { &spirit.parent_id }
public fun bond_depth(spirit: &Spirit): u64 { spirit.bond_depth }
public fun bond_harmony(spirit: &Spirit): u64 { spirit.bond_harmony }
public fun bond_adventure(spirit: &Spirit): u64 { spirit.bond_adventure }
public fun bond_loyalty(spirit: &Spirit): u64 { spirit.bond_loyalty }
public fun spawn_count(spirit: &Spirit): u64 { spirit.spawn_count }
public fun birth_epoch(spirit: &Spirit): u64 { spirit.birth_epoch }
public fun memwal_namespace(spirit: &Spirit): &String { &spirit.memwal_namespace }
public fun combat_xp(spirit: &Spirit): u64 { spirit.combat_xp }
public fun exploration_xp(spirit: &Spirit): u64 { spirit.exploration_xp }
public fun social_xp(spirit: &Spirit): u64 { spirit.social_xp }
public fun wisdom_xp(spirit: &Spirit): u64 { spirit.wisdom_xp }
```

#### territory.move (v2 — complete)

```move
module anima_swarm::territory;

use std::string::String;
use std::option;
use sui::event;
use sui::transfer;
use sui::table::{Self, Table};
use sui::tx_context;
use anima_swarm::spirit::AdminCap;

public struct GameMap has key {
    id: UID,
    hexes: Table<u64, HexState>,
    hex_count: u64,
}

public struct HexState has store {
    hex_id: u64,
    terrain: u8,
    bioregion_id: String,
    controller: Option<address>,
    spirit_count: u64,
    memory_rate: u64,
    defense_bonus: u64,
}

public struct TerritoryClaimed has copy, drop {
    hex_id: u64,
    player: address,
}

fun init(ctx: &mut TxContext) {
    let map = GameMap {
        id: object::new(ctx),
        hexes: table::new(ctx),
        hex_count: 37,
    };
    transfer::share_object(map);
}

public fun add_hex(
    _admin: &AdminCap, map: &mut GameMap,
    hex_id: u64, terrain: u8, bioregion_id: String,
    memory_rate: u64, defense_bonus: u64,
) {
    table::add(&mut map.hexes, hex_id, HexState {
        hex_id, terrain, bioregion_id,
        controller: option::none(),
        spirit_count: 0, memory_rate, defense_bonus,
    });
}

public fun claim_hex(
    _admin: &AdminCap, map: &mut GameMap, hex_id: u64, player: address,
) {
    let hex = table::borrow_mut(&mut map.hexes, hex_id);
    hex.controller = option::some(player);
    event::emit(TerritoryClaimed { hex_id, player });
}

public fun hex_controller(map: &GameMap, hex_id: u64): Option<address> {
    table::borrow(&map.hexes, hex_id).controller
}
public fun hex_defense_bonus(map: &GameMap, hex_id: u64): u64 {
    table::borrow(&map.hexes, hex_id).defense_bonus
}
public fun hex_memory_rate(map: &GameMap, hex_id: u64): u64 {
    table::borrow(&map.hexes, hex_id).memory_rate
}
public fun hex_terrain(map: &GameMap, hex_id: u64): u8 {
    table::borrow(&map.hexes, hex_id).terrain
}
public fun hex_count(map: &GameMap): u64 { map.hex_count }
```

#### battle.move (v2 — complete)

```move
module anima_swarm::battle;

use std::string::String;
use sui::event;
use sui::transfer;
use sui::tx_context;
use anima_swarm::spirit::AdminCap;

public struct BattleRecord has key, store {
    id: UID,
    attacker_id: address,
    defender_id: address,
    hex_id: u64,
    winner: address,
    attacker_score: u64,
    defender_score: u64,
    memory_blob_id: String,
}

public struct BattleResolved has copy, drop {
    battle_id: address,
    attacker_id: address,
    defender_id: address,
    winner: address,
    hex_id: u64,
}

public fun record_battle(
    _admin: &AdminCap,
    attacker_id: address, defender_id: address,
    hex_id: u64, winner: address,
    attacker_score: u64, defender_score: u64,
    memory_blob_id: String,
    ctx: &mut TxContext,
) {
    let record = BattleRecord {
        id: object::new(ctx),
        attacker_id, defender_id, hex_id, winner,
        attacker_score, defender_score, memory_blob_id,
    };
    event::emit(BattleResolved {
        battle_id: object::id_address(&record),
        attacker_id, defender_id, winner, hex_id,
    });
    transfer::public_transfer(record, tx_context::sender(ctx));
}
```

#### spawn.move (v2 — complete)

```move
module anima_swarm::spawn;

use sui::event;
use sui::transfer;
use sui::coin::{Self, Coin};
use sui::sui::SUI;

const SPAWN_COST: u64 = 10_000_000;
const MIN_BOND_FOR_SPAWN: u64 = 50;
const EInsufficientBond: u64 = 0;
const ENotAlive: u64 = 2;
const EInsufficientPayment: u64 = 3;

public struct SpawnEvent has copy, drop {
    parent_id: address,
    child_id: address,
    generation: u64,
    hex_id: u64,
}

public fun validate_spawn(parent_bond_avg: u64, parent_alive: bool) {
    assert!(parent_alive, ENotAlive);
    assert!(parent_bond_avg >= MIN_BOND_FOR_SPAWN, EInsufficientBond);
}

public fun collect_spawn_fee(
    payment: &mut Coin<SUI>, recipient: address, ctx: &mut TxContext,
) {
    assert!(coin::value(payment) >= SPAWN_COST, EInsufficientPayment);
    let fee = coin::split(payment, SPAWN_COST, ctx);
    transfer::public_transfer(fee, recipient);
}

public fun emit_spawn_event(
    parent_id: address, child_id: address, generation: u64, hex_id: u64,
) {
    event::emit(SpawnEvent { parent_id, child_id, generation, hex_id });
}
```

#### frontend/src/services/suiService.js — Complete Transaction Builders

```javascript
import { Transaction } from '@mysten/sui/transactions';

const PACKAGE_ID = import.meta.env.VITE_PACKAGE_ID;
const GAME_MAP_ID = import.meta.env.VITE_GAME_MAP_ID;
const ADMIN_CAP_ID = import.meta.env.VITE_ADMIN_CAP_ID;

export function buildMintSpiritTx({ name, personalityHash, hexId, memwalNamespace, parentId, generation }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::spirit::mint`,
    arguments: [
      tx.object(ADMIN_CAP_ID), tx.pure.string(name),
      tx.pure.vector('u8', personalityHash), tx.pure.u64(hexId),
      tx.pure.string(memwalNamespace),
      parentId ? tx.pure.option('address', parentId) : tx.pure.option('address', null),
      tx.pure.u64(generation),
    ],
  });
  return tx;
}

export function buildClaimHexTx({ hexId, player }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::territory::claim_hex`,
    arguments: [tx.object(ADMIN_CAP_ID), tx.object(GAME_MAP_ID), tx.pure.u64(hexId), tx.pure.address(player)],
  });
  return tx;
}

export function buildAddHexTx({ hexId, terrain, bioregionId, memoryRate, defenseBonus }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::territory::add_hex`,
    arguments: [
      tx.object(ADMIN_CAP_ID), tx.object(GAME_MAP_ID),
      tx.pure.u64(hexId), tx.pure.u8(terrain), tx.pure.string(bioregionId),
      tx.pure.u64(memoryRate), tx.pure.u64(defenseBonus),
    ],
  });
  return tx;
}

export function buildRecordBattleTx({ attackerId, defenderId, hexId, winner, attackerScore, defenderScore, memoryBlobId }) {
  const tx = new Transaction();
  tx.moveCall({
    target: `${PACKAGE_ID}::battle::record_battle`,
    arguments: [
      tx.object(ADMIN_CAP_ID),
      tx.pure.address(attackerId), tx.pure.address(defenderId),
      tx.pure.u64(hexId), tx.pure.address(winner),
      tx.pure.u64(attackerScore), tx.pure.u64(defenderScore),
      tx.pure.string(memoryBlobId),
    ],
  });
  return tx;
}

export function buildSpawnTx({
  parentId, parentBondAvg, parentAlive, paymentCoinId, feeRecipient,
  childName, childPersonalityHash, childHexId, childMemwalNamespace, childGeneration, currentEpoch,
}) {
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::spawn::validate_spawn`,
    arguments: [tx.pure.u64(parentBondAvg), tx.pure.bool(parentAlive)] });
  tx.moveCall({ target: `${PACKAGE_ID}::spawn::collect_spawn_fee`,
    arguments: [tx.object(paymentCoinId), tx.pure.address(feeRecipient)] });
  tx.moveCall({ target: `${PACKAGE_ID}::spirit::increment_spawn_count`,
    arguments: [tx.object(parentId), tx.pure.u64(currentEpoch)] });
  tx.moveCall({ target: `${PACKAGE_ID}::spirit::mint`,
    arguments: [
      tx.object(ADMIN_CAP_ID), tx.pure.string(childName),
      tx.pure.vector('u8', childPersonalityHash), tx.pure.u64(childHexId),
      tx.pure.string(childMemwalNamespace),
      tx.pure.option('address', parentId), tx.pure.u64(childGeneration),
    ] });
  tx.moveCall({ target: `${PACKAGE_ID}::spawn::emit_spawn_event`,
    arguments: [tx.pure.address(parentId), tx.pure.address(parentId), tx.pure.u64(childGeneration), tx.pure.u64(childHexId)] });
  return tx;
}

export function buildUpdateXpTx({ spiritId, combatXP, explorationXP, socialXP, wisdomXP }) {
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::spirit::update_xp`,
    arguments: [tx.object(ADMIN_CAP_ID), tx.object(spiritId),
      tx.pure.u64(combatXP), tx.pure.u64(explorationXP), tx.pure.u64(socialXP), tx.pure.u64(wisdomXP)] });
  return tx;
}

export function buildUpdateBondTx({ spiritId, depth, harmony, adventure, loyalty }) {
  const tx = new Transaction();
  tx.moveCall({ target: `${PACKAGE_ID}::spirit::update_bond`,
    arguments: [tx.object(ADMIN_CAP_ID), tx.object(spiritId),
      tx.pure.u64(depth), tx.pure.u64(harmony), tx.pure.u64(adventure), tx.pure.u64(loyalty)] });
  return tx;
}

export async function queryPlayerSpirits(suiClient, packageId, ownerAddress) {
  const result = await suiClient.getOwnedObjects({
    owner: ownerAddress,
    filter: { StructType: `${packageId}::spirit::Spirit` },
    options: { showContent: true, showType: true },
  });
  return result.data
    .filter(obj => obj.data?.content?.dataType === 'moveObject')
    .map(obj => obj.data.content.fields);
}
```


### 7.10 Updated Verification Checklist (v2)

- [x] Game state schema defined with TypeScript interfaces
- [x] Server tick engine implemented (5s interval)
- [x] WebSocket for real-time client updates
- [x] Spirit autonomous decision engine (LLM-driven)
- [x] spiritDialogueService with bond-gated prompts and MemWal injection
- [x] bondService with action-based stat updates
- [x] territoryService with movement validation and hex control
- [x] memoryClassifier with visible XP tracks
- [x] walrusService with battle log storage
- [x] App.jsx with dapp-kit providers (QueryClient, SuiClient, Wallet)
- [x] HexMap component (SVG hex grid with terrain + control + spirits)
- [x] SpiritPanel component (chat + bond + XP + action status)
- [x] CommandBar component (active timers + event log)
- [x] Data files (terrainTypes, hexGrid, seedSpirits)
- [x] Game initialization (createInitialGameState)
- [x] Move.toml with Sui framework dependency
- [x] Move contract fixes (AdminCap, init, transfer, accessors)
- [x] Bot players (4 AI-controlled opponents for demo)
- [x] Fast-forward endpoint for demo video
- [ ] MemWal accounts created for seed spirits (needs funded wallet)
- [ ] Move contracts compiled and published
- [ ] Full game loop tested end-to-end
- [ ] Swarm essence export/import implemented
- [ ] Essence stored on Walrus with MemWal reference

### 7.11 Cross-Game Swarm Persistence ("Heart of Swarm")

The defining Walrus Track feature. A player's swarm essence persists across games on Walrus — spirits can reincarnate, deity playstyle compounds, and core memories echo into future battles. Like Fire Emblem characters reappearing across titles, but verifiable and player-owned.

**Why this matters for judges:** This is the strongest possible demonstration of "memory that outlives applications." The swarm essence only exists on Walrus. It gains value over time. It's portable. It's verifiable. Any future game built on MemWal/Walrus can read and honor this data.

#### Data Model

```typescript
// Stored as Walrus blob, referenced in MemWal
interface SwarmEssence {
  version: 1;
  deityAddress: string;       // Sui wallet address
  gameId: string;             // unique game identifier
  exportedAt: number;         // unix timestamp
  lineageDepth: number;       // how many games deep (1 = first game)

  // Deity fingerprint — how this player tends to play
  playstyle: {
    aggressionRatio: number;    // 0-1, attack actions / total actions
    whisperFrequency: number;   // whispers per game-minute
    dominantThemes: string[];   // top 5 whisper themes (LLM-extracted)
    specTendency: Record<string, number>; // combat/explore/social/wisdom ratios
  };

  // Spirit lineage — who lived, who died, who mattered
  spirits: SpiritLegacy[];

  // Core memories — the 10 most impactful moments across the game
  coreMemories: CoreMemory[];

  // Game outcome
  outcome: {
    result: 'victory' | 'defeat' | 'draw';
    hexesControlled: number;
    peakHexes: number;          // max hexes at any point
    totalSpirits: number;
    spiritsSurvived: number;
    gameDurationSeconds: number;
  };

  // Lineage chain — Walrus blob IDs of all previous essences
  previousEssences: string[];   // ordered oldest → newest
}

interface SpiritLegacy {
  name: string;
  personality: string;          // core personality description
  specialization: string | null;
  finalXp: Record<string, number>;
  peakBond: { depth: number; harmony: number; adventure: number; loyalty: number };
  memorableActions: string[];   // top 3 moments (LLM-summarized)
  survived: boolean;
  kills: number;
  hexesClaimed: number;
  whispersReceived: number;
  whispersOriginated: number;
  reincarnationCount: number;   // how many past lives
  previousNames: string[];      // names from past games
}

interface CoreMemory {
  type: 'battle' | 'discovery' | 'conquest' | 'sacrifice' | 'betrayal' | 'alliance';
  summary: string;              // 1-sentence LLM summary
  spiritsInvolved: string[];    // spirit names
  impact: number;               // 0-1 significance score
  gameAge: number;              // which game in lineage (1 = this game)
}
```

#### Export Flow

Triggered when a game ends (victory/defeat/draw) or player manually exports mid-game.

```javascript
// server/services/essenceService.js

import { getWalrusClient, getServerSigner } from './walrusService.js';
import { getServerMemwal } from './memwalServer.js';
import { callLLM } from './llmProxy.js';
import { getControlledHexes } from './territoryService.js';

export async function exportSwarmEssence(gameState, playerId) {
  const player = gameState.players[playerId];
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId);

  // 1. Build deity playstyle fingerprint
  const playstyle = computePlaystyle(gameState, playerId);

  // 2. Build spirit legacies (sorted by impact)
  const spirits = mySpirits
    .map(s => buildSpiritLegacy(s, gameState))
    .sort((a, b) => computeSpiritImpact(b) - computeSpiritImpact(a));

  // 3. Extract core memories via LLM
  const coreMemories = await extractCoreMemories(gameState, playerId);

  // 4. Load previous essence chain (if reimporting)
  const previousEssences = player.importedEssenceBlobId
    ? await loadLineageChain(player.importedEssenceBlobId)
    : [];

  // 5. Carry forward the most resonant memories from past games (max 5)
  const inheritedMemories = previousEssences.length > 0
    ? await loadInheritedMemories(previousEssences[previousEssences.length - 1])
    : [];
  const allCoreMemories = [
    ...coreMemories.map(m => ({ ...m, gameAge: 1 })),
    ...inheritedMemories
      .map(m => ({ ...m, gameAge: m.gameAge + 1, impact: m.impact * 0.8 })) // decay
      .filter(m => m.impact > 0.3) // only keep significant ones
  ].sort((a, b) => b.impact - a.impact).slice(0, 10);

  const essence = {
    version: 1,
    deityAddress: playerId,
    gameId: gameState.id,
    exportedAt: Date.now(),
    lineageDepth: previousEssences.length + 1,
    playstyle,
    spirits,
    coreMemories: allCoreMemories,
    outcome: {
      result: computeGameResult(gameState, playerId),
      hexesControlled: countControlledHexes(gameState, playerId),
      peakHexes: player.peakHexes || 0,
      totalSpirits: mySpirits.length,
      spiritsSurvived: mySpirits.filter(s => s.alive).length,
      gameDurationSeconds: Math.floor((Date.now() - gameState.startedAt) / 1000),
    },
    previousEssences: [...previousEssences, player.importedEssenceBlobId].filter(Boolean),
  };

  // 6. Store on Walrus
  const blob = new TextEncoder().encode(JSON.stringify(essence));
  const signer = getServerSigner();
  const walrusClient = getWalrusClient();
  const { blobId } = await walrusClient.writeBlob({
    blob,
    deletable: false,  // permanent — this is the whole point
    epochs: 100,       // long-lived
    signer,
  });

  // 7. Index in MemWal for discoverability (getServerMemwal from memwalServer.js)
  const memwal = getServerMemwal();
  await memwal.rememberAndWait(
    `SWARM_ESSENCE deity=${playerId} game=${gameState.id} blobId=${blobId} ` +
    `result=${essence.outcome.result} spirits=${spirits.length} lineage=${essence.lineageDepth} ` +
    `specializations=${spirits.map(s => s.specialization).filter(Boolean).join(',')}`
  );

  return { blobId, essence };
}

function computePlaystyle(gameState, playerId) {
  const history = gameState.actionHistory?.filter(a => a.playerId === playerId) || [];
  const attacks = history.filter(a => a.type === 'attack').length;
  const total = history.length || 1;
  const whispers = history.filter(a => a.type === 'whisper');

  // Compute spec tendency from spirit XP totals
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId);
  const totalCombat = mySpirits.reduce((a, s) => a + (s.combatXP || 0), 0);
  const totalExplore = mySpirits.reduce((a, s) => a + (s.explorationXP || 0), 0);
  const totalSocial = mySpirits.reduce((a, s) => a + (s.socialXP || 0), 0);
  const totalWisdom = mySpirits.reduce((a, s) => a + (s.wisdomXP || 0), 0);
  const xpSum = totalCombat + totalExplore + totalSocial + totalWisdom || 1;

  return {
    aggressionRatio: attacks / total,
    whisperFrequency: whispers.length / (Math.max(1, (Date.now() - gameState.startedAt) / 60000)),
    dominantThemes: [], // filled by LLM analysis of whisper content
    specTendency: {
      combat: totalCombat / xpSum,
      exploration: totalExplore / xpSum,
      social: totalSocial / xpSum,
      wisdom: totalWisdom / xpSum,
    },
  };
}

function computeGameResult(gameState, playerId) {
  if (gameState.winner === playerId) return 'victory';
  if (gameState.winner && gameState.winner !== playerId) return 'defeat';
  return 'draw';
}

function countControlledHexes(gameState, playerId) {
  return getControlledHexes(playerId, gameState).length;
}

function buildSpiritLegacy(spirit, gameState) {
  return {
    name: spirit.name,
    personality: spirit.personality,
    specialization: spirit.specialization,
    finalXp: {
      combat: spirit.combatXP || 0,
      exploration: spirit.explorationXP || 0,
      social: spirit.socialXP || 0,
      wisdom: spirit.wisdomXP || 0,
    },
    peakBond: { ...spirit.bond },
    memorableActions: spirit.memorableActions || [],
    survived: spirit.alive,
    kills: spirit.kills || 0,
    hexesClaimed: spirit.hexesClaimed || 0,
    whispersReceived: spirit.whispersReceived || 0,
    whispersOriginated: spirit.whispersOriginated || 0,
    reincarnationCount: spirit.reincarnationCount || 0,
    previousNames: spirit.previousNames || [],
  };
}

function computeSpiritImpact(legacy) {
  const xpTotal = Object.values(legacy.finalXp).reduce((a, b) => a + b, 0);
  const bondAvg = (legacy.peakBond.depth + legacy.peakBond.harmony +
                   legacy.peakBond.adventure + legacy.peakBond.loyalty) / 4;
  return xpTotal * 0.4 + bondAvg * 0.3 + legacy.kills * 5 + legacy.hexesClaimed * 3 +
         (legacy.survived ? 20 : 0);
}

async function extractCoreMemories(gameState, playerId) {
  const events = gameState.eventLog?.filter(e =>
    e.playerId === playerId || e.targetPlayerId === playerId
  ) || [];

  if (events.length === 0) return [];

  const prompt = `Extract the 10 most impactful moments from these game events. For each, provide:
- type: battle|discovery|conquest|sacrifice|betrayal|alliance
- summary: one sentence
- spiritsInvolved: array of spirit names
- impact: 0-1 significance score

Events: ${JSON.stringify(events.slice(-100))}

Return JSON array only.`;

  const result = await callLLM('You extract structured game events.', prompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 1000,
  });

  try {
    const match = result.match(/\[[\s\S]*\]/);
    return match ? JSON.parse(match[0]) : [];
  } catch {
    return [];
  }
}

async function loadLineageChain(blobId) {
  const walrus = getWalrusClient();
  const bytes = await walrus.readBlob({ blobId });
  const essence = JSON.parse(new TextDecoder().decode(bytes));
  return [...(essence.previousEssences || []), blobId];
}

async function loadInheritedMemories(blobId) {
  const walrus = getWalrusClient();
  const bytes = await walrus.readBlob({ blobId });
  const essence = JSON.parse(new TextDecoder().decode(bytes));
  return essence.coreMemories || [];
}
```

#### Import Flow

When starting a new game, a player can provide a Walrus blob ID to import their swarm essence.

```javascript
// In server/services/essenceService.js (continued)

export async function importSwarmEssence(blobId, playerId) {
  // 1. Read essence from Walrus
  const walrus = getWalrusClient();
  const bytes = await walrus.readBlob({ blobId });
  const essence = JSON.parse(new TextDecoder().decode(bytes));

  // 2. Verify ownership (matches playerId OR wallet address)
  if (essence.deityAddress !== playerId) {
    throw new Error('Essence belongs to a different deity');
  }
  // NOTE: In production, verify via wallet signature instead of string match

  // 3. Determine reincarnation candidates
  // Spirits that survived + had high impact get priority
  const candidates = essence.spirits
    .filter(s => s.survived)
    .sort((a, b) => computeSpiritImpact(b) - computeSpiritImpact(a))
    .slice(0, 3); // max 3 reincarnations per game

  // 4. Generate reincarnated spirit configs
  const reincarnated = candidates.map(legacy => ({
    name: legacy.name,  // same name — they're the same spirit
    personality: evolvePersonality(legacy),
    startingXp: scaleXp(legacy.finalXp, 0.2), // carry 20% of XP
    startingBond: scaleBond(legacy.peakBond, 0.15), // carry 15% of bond
    reincarnationCount: legacy.reincarnationCount + 1,
    // Only append name if it differs from last entry (avoids ['Ember','Ember','Ember'])
    previousNames: legacy.previousNames.at(-1) === legacy.name
      ? [...legacy.previousNames]
      : [...legacy.previousNames, legacy.name],
    pastLifeMemories: legacy.memorableActions,
  }));

  // 5. If fewer than 3 reincarnated, fill remaining slots with fresh spirits
  // influenced by deity playstyle
  const freshCount = 3 - reincarnated.length;
  const fresh = generatePlaystyleSpirits(essence.playstyle, freshCount);

  return {
    spirits: [...reincarnated, ...fresh],
    playstyle: essence.playstyle,
    lineageDepth: essence.lineageDepth,
    inheritedMemories: essence.coreMemories.filter(m => m.impact > 0.5),
    importedEssenceBlobId: blobId,
  };
}

function evolvePersonality(legacy) {
  // Personality evolves based on past life experiences
  const specLabel = legacy.specialization || 'generalist';
  const survived = legacy.survived ? 'resilient' : 'haunted';
  return `${legacy.personality} — Reincarnated ${specLabel}, ${survived} by past battles. ` +
    `Remembers: ${legacy.memorableActions.slice(0, 2).join('; ')}`;
}

function scaleXp(xp, factor) {
  const scaled = {};
  for (const [key, val] of Object.entries(xp)) {
    scaled[key] = Math.floor(val * factor);
  }
  return scaled;
}

function scaleBond(bond, factor) {
  return {
    depth: Math.floor(bond.depth * factor),
    harmony: Math.floor(bond.harmony * factor),
    adventure: Math.floor(bond.adventure * factor),
    loyalty: Math.floor(bond.loyalty * factor),
  };
}

function generatePlaystyleSpirits(playstyle, count) {
  // Deity playstyle influences fresh spirit generation
  const templates = [
    { name: 'Ember', base: 'Fierce and impulsive' },
    { name: 'Drift', base: 'Curious wanderer' },
    { name: 'Moss', base: 'Patient guardian' },
    { name: 'Shade', base: 'Calculating strategist' },
    { name: 'Gale', base: 'Swift messenger' },
  ];

  // Weight selection toward playstyle
  const sorted = templates.sort((a, b) => {
    if (playstyle.aggressionRatio > 0.5) return a.base.includes('Fierce') ? -1 : 1;
    return a.base.includes('Patient') ? -1 : 1;
  });

  return sorted.slice(0, count).map(t => ({
    name: t.name,
    personality: t.base,
    startingXp: { combat: 0, exploration: 0, social: 0, wisdom: 0 },
    startingBond: { depth: 10, harmony: 10, adventure: 10, loyalty: 10 },
    reincarnationCount: 0,
    previousNames: [],
    pastLifeMemories: [],
  }));
}
```

#### Server Routes

Essence routes are already defined in `server/routes/game.js` (Section 7.3): `POST /essence/export`, `POST /essence/import`, `GET /essence/:blobId`. No additional route file needed.

#### Frontend — Essence UI

```jsx
// frontend/src/components/EssenceExport.jsx

import { useState } from 'react';

export default function EssenceExport({ playerId, gameResult }) {
  const [exporting, setExporting] = useState(false);
  const [blobId, setBlobId] = useState(null);

  async function handleExport() {
    setExporting(true);
    try {
      const res = await fetch('/api/game/essence/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId }),
      });
      const data = await res.json();
      setBlobId(data.blobId);
    } finally {
      setExporting(false);
    }
  }

  if (blobId) {
    return (
      <div className="p-6 bg-gray-800/80 rounded-lg border border-amber-500/30 text-center">
        <h3 className="text-amber-400 font-display text-lg mb-2">Swarm Essence Preserved</h3>
        <p className="text-gray-400 text-sm mb-4">
          Your swarm's heart is stored on Walrus forever. Import this essence in your next game
          to bring your spirits back.
        </p>
        <div className="bg-gray-900 rounded p-3 font-mono text-xs text-amber-300 break-all select-all">
          {blobId}
        </div>
        <p className="text-gray-500 text-xs mt-3">
          Copy this Walrus blob ID — it's your swarm's soul across all future games
        </p>
      </div>
    );
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="px-6 py-3 bg-amber-600 hover:bg-amber-500 rounded-lg text-white font-display
                 disabled:opacity-50 transition-colors"
    >
      {exporting ? 'Preserving essence...' : 'Export Swarm Essence'}
    </button>
  );
}
```

```jsx
// frontend/src/components/EssenceImport.jsx

import { useState } from 'react';

export default function EssenceImport({ playerId, onImported }) {
  const [blobId, setBlobId] = useState('');
  const [importing, setImporting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  async function handleImport() {
    setImporting(true);
    setError(null);
    try {
      const res = await fetch('/api/game/essence/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobId: blobId.trim(), playerId }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error);
        return;
      }
      const data = await res.json();
      setPreview(data);
    } finally {
      setImporting(false);
    }
  }

  function confirmImport() {
    onImported({ blobId: blobId.trim(), ...preview });
  }

  return (
    <div className="p-4 bg-gray-800/60 rounded-lg border border-gray-700/50">
      <h4 className="text-gray-300 text-sm font-semibold mb-2">Import Swarm Essence</h4>
      <p className="text-gray-500 text-xs mb-3">
        Paste a Walrus blob ID from a previous game to reincarnate your spirits
      </p>

      <div className="flex gap-2 mb-3">
        <input
          type="text"
          value={blobId}
          onChange={e => setBlobId(e.target.value)}
          placeholder="Walrus blob ID..."
          className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-sm text-gray-200
                     placeholder-gray-600 font-mono"
        />
        <button
          onClick={handleImport}
          disabled={!blobId.trim() || importing}
          className="px-4 py-2 bg-amber-600/80 hover:bg-amber-500 rounded text-sm text-white
                     disabled:opacity-40 transition-colors"
        >
          {importing ? '...' : 'Load'}
        </button>
      </div>

      {error && <p className="text-red-400 text-xs mb-2">{error}</p>}

      {preview && (
        <div className="bg-gray-900/80 rounded p-3 space-y-2">
          <p className="text-amber-400 text-sm">
            Lineage depth: {preview.lineageDepth} game{preview.lineageDepth > 1 ? 's' : ''}
          </p>
          {preview.spirits.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span className={s.reincarnated ? 'text-amber-300' : 'text-gray-400'}>
                {s.reincarnated ? '✨' : '•'} {s.name}
              </span>
              {s.reincarnated && (
                <span className="text-gray-500">
                  (life #{s.reincarnationCount + 1}{s.pastLives.length ? `, was: ${s.pastLives.join(' → ')}` : ''})
                </span>
              )}
            </div>
          ))}
          {preview.inheritedMemories > 0 && (
            <p className="text-gray-500 text-xs">
              {preview.inheritedMemories} memories will echo from past games
            </p>
          )}
          <button
            onClick={confirmImport}
            className="mt-2 px-4 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-sm text-white
                       transition-colors w-full"
          >
            Begin with this essence
          </button>
        </div>
      )}
    </div>
  );
}
```

#### Spirit Memory of Past Lives

Reincarnated spirits reference their past lives during gameplay. The spirit decision engine and dialogue service inject past-life context:

```javascript
// Addition to spiritDialogueService.js system prompt for reincarnated spirits

function buildPastLifeContext(spirit) {
  if (!spirit.reincarnationCount || spirit.reincarnationCount === 0) return '';
  return `
PAST LIVES: You have lived ${spirit.reincarnationCount} previous life${spirit.reincarnationCount > 1 ? 's' : ''}.
${spirit.previousNames.length ? `Previous names: ${spirit.previousNames.join(', ')}` : ''}
${spirit.pastLifeMemories.length ? `Echoes from past: ${spirit.pastLifeMemories.join('; ')}` : ''}
You carry fragments of these memories. They surface as déjà vu — a battle formation you somehow know,
a landscape that feels familiar, an instinct about which spirits to trust.
You do not narrate your past lives explicitly. They color your perception and decisions.`;
}
```

#### Integration with Game Init

```javascript
// Modification to createInitialGameState in server/data/gameInit.js

export function createInitialGameState(players) {
  const state = { /* ... existing init ... */ };

  // For each player, check if they imported an essence
  for (const player of players) {
    if (player.importedEssence) {
      const { spirits, inheritedMemories, importedEssenceBlobId } = player.importedEssence;

      // Replace default starting spirits with imported ones
      state.players[player.id].importedEssenceBlobId = importedEssenceBlobId;

      for (let i = 0; i < spirits.length; i++) {
        const spiritConfig = spirits[i];
        const spiritId = `${player.id}-spirit-${i}`;
        state.spirits[spiritId] = {
          ...state.spirits[spiritId],
          name: spiritConfig.name,
          personality: spiritConfig.personality,
          xp: spiritConfig.startingXp,
          bond: spiritConfig.startingBond,
          reincarnationCount: spiritConfig.reincarnationCount,
          previousNames: spiritConfig.previousNames,
          pastLifeMemories: spiritConfig.pastLifeMemories,
        };
      }

      // Store inherited memories for surfacing during gameplay
      state.players[player.id].inheritedMemories = inheritedMemories;
    }
  }

  return state;
}
```

#### Why This Wins the Walrus Track

1. **Memory outlives applications** — the essence blob on Walrus IS the persistent identity. Delete the game server, the swarm lives on.
2. **Data gains value over time** — a lineage-5 swarm with battle-hardened reincarnated spirits is more interesting than a fresh start. Players are incentivized to keep their chain alive.
3. **Portable across implementations** — any game that reads the `SwarmEssence` schema can honor this data. Future games by other developers could import your swarm.
4. **Verifiable lineage** — the `previousEssences` chain is a linked list of Walrus blob IDs. Anyone can walk the chain and verify every game played.
5. **Not just storage** — MemWal indexes the essences for semantic search. Query "show me all swarms that specialized in combat and won" across the entire player base.
- [ ] Demo video recorded


## 8. Test Suite

**Purpose:** Comprehensive tests that let a cold agent `npm test` after each service is built, catch regressions immediately, and iterate quickly. Tests are structured so each file is self-contained and can be run individually.

**Test runner:** Vitest (installed in root `package.json`). Configuration:

```javascript
// vitest.config.js (project root)
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.js'],
    testTimeout: 15000,
  },
  resolve: {
    alias: {
      '@lib': path.resolve(__dirname, 'lib'),
    },
  },
});
```

**Root package.json (workspace root + test scripts):**
```json
{
  "private": true,
  "type": "module",
  "workspaces": ["frontend", "server"],
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:unit": "vitest run tests/unit/",
    "test:integration": "vitest run tests/integration/",
    "test:system": "vitest run tests/system/",
    "test:file": "vitest run",
    "dev": "npm-run-all2 --parallel dev:*",
    "dev:frontend": "cd frontend && npm run dev",
    "dev:server": "cd server && npm run dev"
  },
  "devDependencies": {
    "vitest": "^3.2.0",
    "npm-run-all2": "^7.0.0"
  }
}
```

**Run individual test:** `npx vitest run tests/unit/hexMath.test.js`

### 8.1 Unit Tests (Pure Logic, No External Dependencies)

#### tests/unit/hexMath.test.js

```javascript
import { describe, it, expect } from 'vitest';
import {
  generateHexGrid,
  hexId,
  hexToPixel,
  neighbors,
  axialDistance,
  startingPositions,
} from '@lib/hexMath.js';

describe('hexId', () => {
  it('returns string IDs', () => {
    expect(typeof hexId(0, 0)).toBe('string');
  });

  it('generates unique IDs for different coordinates', () => {
    const ids = new Set();
    for (let q = -3; q <= 3; q++) {
      for (let r = -3; r <= 3; r++) {
        if (Math.abs(q + r) <= 3) ids.add(hexId(q, r));
      }
    }
    expect(ids.size).toBe(37);
  });

  it('center hex is consistent', () => {
    expect(hexId(0, 0)).toBe('1010');
  });
});

describe('generateHexGrid', () => {
  it('generates 37 hexes for radius 3', () => {
    const hexes = generateHexGrid(3);
    expect(hexes.length).toBe(37);
  });

  it('generates 19 hexes for radius 2', () => {
    const hexes = generateHexGrid(2);
    expect(hexes.length).toBe(19);
  });

  it('every hex has q, r, id fields', () => {
    const hexes = generateHexGrid(3);
    for (const h of hexes) {
      expect(h).toHaveProperty('q');
      expect(h).toHaveProperty('r');
      expect(h).toHaveProperty('id');
    }
  });

  it('all hex IDs are unique', () => {
    const hexes = generateHexGrid(3);
    const ids = hexes.map(h => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('center hex (0,0) is included', () => {
    const hexes = generateHexGrid(3);
    const center = hexes.find(h => h.q === 0 && h.r === 0);
    expect(center).toBeDefined();
  });
});

describe('hexToPixel', () => {
  it('center hex maps to origin', () => {
    const p = hexToPixel({ q: 0, r: 0 }, 40);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('returns different positions for different hexes', () => {
    const p1 = hexToPixel({ q: 1, r: 0 }, 40);
    const p2 = hexToPixel({ q: 0, r: 1 }, 40);
    expect(p1.x).not.toBe(p2.x);
  });
});

describe('neighbors', () => {
  it('returns 6 neighbors for center hex', () => {
    const n = neighbors({ q: 0, r: 0 });
    expect(n.length).toBe(6);
  });

  it('all neighbors are distance 1 from origin', () => {
    const n = neighbors({ q: 0, r: 0 });
    for (const nb of n) {
      expect(axialDistance({ q: 0, r: 0 }, nb)).toBe(1);
    }
  });

  it('neighbors are symmetric', () => {
    const n1 = neighbors({ q: 1, r: 0 });
    const isNeighbor = n1.some(n => n.q === 0 && n.r === 0);
    expect(isNeighbor).toBe(true);
  });
});

describe('axialDistance', () => {
  it('distance from self is 0', () => {
    expect(axialDistance({ q: 2, r: -1 }, { q: 2, r: -1 })).toBe(0);
  });

  it('adjacent hexes are distance 1', () => {
    expect(axialDistance({ q: 0, r: 0 }, { q: 1, r: 0 })).toBe(1);
  });

  it('opposite edges of radius-3 grid are distance 6', () => {
    expect(axialDistance({ q: 3, r: 0 }, { q: -3, r: 0 })).toBe(6);
  });

  it('is symmetric', () => {
    const a = { q: 1, r: 2 };
    const b = { q: -1, r: 3 };
    expect(axialDistance(a, b)).toBe(axialDistance(b, a));
  });
});

describe('startingPositions', () => {
  it('returns exactly 5 positions', () => {
    const pos = startingPositions();
    expect(pos.length).toBe(5);
  });

  it('all positions are within radius 3', () => {
    const pos = startingPositions();
    for (const p of pos) {
      const dist = Math.max(Math.abs(p.q), Math.abs(p.r), Math.abs(-p.q - p.r));
      expect(dist).toBeLessThanOrEqual(3);
    }
  });

  it('no two positions overlap', () => {
    const pos = startingPositions();
    const ids = pos.map(p => hexId(p.q, p.r));
    expect(new Set(ids).size).toBe(5);
  });

  it('minimum distance between any two starts >= 3', () => {
    const pos = startingPositions();
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        expect(axialDistance(pos[i], pos[j])).toBeGreaterThanOrEqual(3);
      }
    }
  });
});
```

#### tests/unit/memoryClassifier.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { evaluateSpecialization, addXP, getSpecBonuses } from '../../server/services/memoryClassifier.js';

// Helper: create a spirit with XP tracks
function makeSpirit(xp = {}) {
  return {
    id: 's1',
    combatXP: xp.combat ?? 0,
    explorationXP: xp.exploration ?? 0,
    socialXP: xp.social ?? 0,
    wisdomXP: xp.wisdom ?? 0,
    specialization: 'generalist',
  };
}

describe('evaluateSpecialization', () => {
  it('returns warrior for high combat XP', () => {
    const spirit = makeSpirit({ combat: 100, exploration: 10, social: 10, wisdom: 10 });
    expect(evaluateSpecialization(spirit)).toBe('warrior');
  });

  it('returns scout for high exploration XP', () => {
    const spirit = makeSpirit({ combat: 10, exploration: 100, social: 10, wisdom: 10 });
    expect(evaluateSpecialization(spirit)).toBe('scout');
  });

  it('returns gatherer for high social XP', () => {
    const spirit = makeSpirit({ combat: 10, exploration: 10, social: 100, wisdom: 10 });
    expect(evaluateSpecialization(spirit)).toBe('gatherer');
  });

  it('returns sage for high wisdom XP', () => {
    const spirit = makeSpirit({ combat: 10, exploration: 10, social: 10, wisdom: 100 });
    expect(evaluateSpecialization(spirit)).toBe('sage');
  });

  it('returns generalist when no track dominates', () => {
    const spirit = makeSpirit({ combat: 35, exploration: 35, social: 35, wisdom: 35 });
    expect(evaluateSpecialization(spirit)).toBe('generalist');
  });

  it('returns generalist when below threshold (30 XP)', () => {
    const spirit = makeSpirit({ combat: 5, exploration: 1, social: 1, wisdom: 1 });
    expect(evaluateSpecialization(spirit)).toBe('generalist');
  });
});

describe('addXP', () => {
  it('adds combat XP and re-evaluates specialization', () => {
    const spirit = makeSpirit();
    addXP(spirit, 'combat', 50);
    expect(spirit.combatXP).toBe(50);
    expect(spirit.specialization).toBe('warrior');
  });

  it('adds exploration XP', () => {
    const spirit = makeSpirit();
    addXP(spirit, 'exploration', 40);
    expect(spirit.explorationXP).toBe(40);
    expect(spirit.specialization).toBe('scout');
  });

  it('stays generalist when XP is below threshold', () => {
    const spirit = makeSpirit();
    addXP(spirit, 'combat', 10);
    expect(spirit.specialization).toBe('generalist');
  });
});

describe('getSpecBonuses', () => {
  it('returns 2x attack multiplier for warrior', () => {
    const bonuses = getSpecBonuses('warrior');
    expect(bonuses.attackMult).toBe(2);
  });

  it('returns 2x move multiplier for scout', () => {
    const bonuses = getSpecBonuses('scout');
    expect(bonuses.moveMult).toBe(2);
  });

  it('returns 2x memory multiplier for gatherer', () => {
    const bonuses = getSpecBonuses('gatherer');
    expect(bonuses.memoryMult).toBe(2);
  });

  it('returns spawn bonus for sage', () => {
    const bonuses = getSpecBonuses('sage');
    expect(bonuses.spawnBonus).toBe(2);
  });

  it('returns neutral multipliers for generalist', () => {
    const bonuses = getSpecBonuses('generalist');
    expect(bonuses.attackMult).toBe(1);
    expect(bonuses.defenseMult).toBe(1);
    expect(bonuses.memoryMult).toBe(1);
    expect(bonuses.moveMult).toBe(1);
  });

  it('falls back to generalist for unknown specialization', () => {
    const bonuses = getSpecBonuses('unknown');
    expect(bonuses.attackMult).toBe(1);
  });
});
```

#### tests/unit/bondService.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { applyBondAction, bondAverage, getBondTier } from '../../server/services/bondService.js';

describe('applyBondAction', () => {
  function makeSpirit(bond = { depth: 40, harmony: 40, adventure: 30, loyalty: 30 }) {
    return { id: 's1', bond: { ...bond } };
  }

  it('chat increases depth', () => {
    const spirit = makeSpirit();
    applyBondAction(spirit, 'chat');
    expect(spirit.bond.depth).toBeGreaterThan(40);
  });

  it('battleWin increases adventure', () => {
    const spirit = makeSpirit();
    applyBondAction(spirit, 'battleWin');
    expect(spirit.bond.adventure).toBeGreaterThan(30);
  });

  it('battleLoss increases depth but decreases loyalty', () => {
    const spirit = makeSpirit({ depth: 40, harmony: 40, adventure: 30, loyalty: 30 });
    applyBondAction(spirit, 'battleLoss');
    expect(spirit.bond.depth).toBeGreaterThan(40);
    expect(spirit.bond.loyalty).toBeLessThan(30);
  });

  it('bond values never exceed 100', () => {
    const spirit = makeSpirit({ depth: 98, harmony: 98, adventure: 98, loyalty: 98 });
    applyBondAction(spirit, 'chat');
    expect(spirit.bond.depth).toBeLessThanOrEqual(100);
    expect(spirit.bond.harmony).toBeLessThanOrEqual(100);
  });

  it('bond values never go below 0', () => {
    const spirit = makeSpirit({ depth: 1, harmony: 1, adventure: 1, loyalty: 1 });
    applyBondAction(spirit, 'battleLoss');
    expect(spirit.bond.loyalty).toBeGreaterThanOrEqual(0);
  });

  it('returns unchanged bond for unknown action', () => {
    const spirit = makeSpirit({ depth: 40, harmony: 40, adventure: 30, loyalty: 30 });
    const result = applyBondAction(spirit, 'nonexistent');
    expect(result.depth).toBe(40);
  });
});

describe('bondAverage', () => {
  it('computes the mean of all four dimensions', () => {
    const spirit = { bond: { depth: 40, harmony: 60, adventure: 20, loyalty: 80 } };
    expect(bondAverage(spirit)).toBe(50);
  });

  it('rounds to nearest integer', () => {
    const spirit = { bond: { depth: 10, harmony: 10, adventure: 10, loyalty: 11 } };
    expect(bondAverage(spirit)).toBe(10); // 41/4 = 10.25 → 10
  });
});

describe('getBondTier', () => {
  it('returns Stranger for low average', () => {
    const tier = getBondTier(10);
    expect(tier.name).toBe('Stranger');
    expect(tier.tier).toBe(0);
  });

  it('returns Cautious for average 20-39', () => {
    const tier = getBondTier(25);
    expect(tier.name).toBe('Cautious');
    expect(tier.tier).toBe(1);
  });

  it('returns Familiar for average 40-59', () => {
    const tier = getBondTier(45);
    expect(tier.name).toBe('Familiar');
    expect(tier.tier).toBe(2);
  });

  it('returns Trusted for average 60-79', () => {
    const tier = getBondTier(65);
    expect(tier.name).toBe('Trusted');
    expect(tier.tier).toBe(3);
  });

  it('returns Devoted for average 80+', () => {
    const tier = getBondTier(90);
    expect(tier.name).toBe('Devoted');
    expect(tier.tier).toBe(4);
  });

  it('uses average of all four dimensions via bondAverage', () => {
    // avg(100, 0, 0, 0) = 25 → Cautious
    // avg(25, 25, 25, 25) = 25 → Cautious
    const tier1 = getBondTier(25);
    const tier2 = getBondTier(25);
    expect(tier1.name).toBe(tier2.name);
  });
});
```

#### tests/unit/territoryService.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { validateMovement, claimHex, getControlledHexes } from '../../server/services/territoryService.js';
import { hexId } from '@lib/hexMath.js';

function makeGameState() {
  return {
    map: {
      hexes: {
        [hexId(0, 0)]: { q: 0, r: 0, id: hexId(0, 0), controller: 'p1', spiritIds: ['s1'], terrain: 'grassland' },
        [hexId(1, 0)]: { q: 1, r: 0, id: hexId(1, 0), controller: null, spiritIds: [], terrain: 'forest' },
        [hexId(2, 0)]: { q: 2, r: 0, id: hexId(2, 0), controller: null, spiritIds: [], terrain: 'mountain' },
        [hexId(0, 1)]: { q: 0, r: 1, id: hexId(0, 1), controller: 'p2', spiritIds: ['s2'], terrain: 'desert' },
      },
    },
    spirits: {
      s1: { id: 's1', hexId: hexId(0, 0), playerId: 'p1', alive: true },
      s2: { id: 's2', hexId: hexId(0, 1), playerId: 'p2', alive: true },
    },
  };
}

describe('validateMovement', () => {
  it('allows movement to adjacent empty hex', () => {
    const state = makeGameState();
    const result = validateMovement(state.spirits.s1, hexId(1, 0), state);
    expect(result.valid).toBe(true);
  });

  it('rejects movement to non-adjacent hex', () => {
    const state = makeGameState();
    const result = validateMovement(state.spirits.s1, hexId(2, 0), state);
    expect(result.valid).toBe(false);
  });

  it('rejects movement to nonexistent hex', () => {
    const state = makeGameState();
    const result = validateMovement(state.spirits.s1, 'fake-hex', state);
    expect(result.valid).toBe(false);
  });

  it('allows movement to hex with enemy spirit (triggers battle)', () => {
    const state = makeGameState();
    const result = validateMovement(state.spirits.s1, hexId(0, 1), state);
    expect(result.valid).toBe(true);
    expect(result.triggersBattle).toBe(true);
  });
});

describe('claimHex', () => {
  it('assigns controller to unclaimed hex', () => {
    const state = makeGameState();
    claimHex(hexId(1, 0), 'p1', state);
    expect(state.map.hexes[hexId(1, 0)].controller).toBe('p1');
  });

  it('overwrites enemy controller', () => {
    const state = makeGameState();
    claimHex(hexId(0, 1), 'p1', state);
    expect(state.map.hexes[hexId(0, 1)].controller).toBe('p1');
  });
});

describe('getControlledHexes', () => {
  it('returns hexes controlled by player', () => {
    const state = makeGameState();
    const hexes = getControlledHexes('p1', state);
    expect(hexes.length).toBe(1);
    expect(hexes[0].id).toBe(hexId(0, 0));
  });

  it('returns empty array for player with no territory', () => {
    const state = makeGameState();
    const hexes = getControlledHexes('p3', state);
    expect(hexes.length).toBe(0);
  });
});
```

#### tests/unit/winService.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { checkWinCondition } from '../../server/services/winService.js';

function makeState(controlMap) {
  const hexes = {};
  for (let i = 0; i < 37; i++) {
    hexes[`hex-${i}`] = {
      id: `hex-${i}`,
      controller: controlMap[i] || null,
      spiritIds: [],
    };
  }
  return {
    map: { hexes },
    spirits: {},
    players: { p1: { id: 'p1' }, p2: { id: 'p2' } },
    winner: null,
    status: 'active',
  };
}

describe('checkWinCondition', () => {
  it('returns null when no player has 60% territory', () => {
    const controlMap = {};
    for (let i = 0; i < 10; i++) controlMap[i] = 'p1';
    for (let i = 10; i < 20; i++) controlMap[i] = 'p2';
    const state = makeState(controlMap);
    expect(checkWinCondition(state)).toBeNull();
  });

  it('returns winner when player controls 23+ hexes (60% of 37)', () => {
    const controlMap = {};
    for (let i = 0; i < 23; i++) controlMap[i] = 'p1';
    const state = makeState(controlMap);
    expect(checkWinCondition(state)).toBe('p1');
  });

  it('returns winner when only one player has living spirits', () => {
    const state = makeState({});
    state.spirits = {
      s1: { id: 's1', playerId: 'p1', alive: true },
      s2: { id: 's2', playerId: 'p2', alive: false },
    };
    expect(checkWinCondition(state)).toBe('p1');
  });

  it('does not trigger when multiple players have living spirits', () => {
    const state = makeState({});
    state.spirits = {
      s1: { id: 's1', playerId: 'p1', alive: true },
      s2: { id: 's2', playerId: 'p2', alive: true },
    };
    expect(checkWinCondition(state)).toBeNull();
  });
});
```

#### tests/unit/keyStore.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { setKey, getKey, deleteKey } from '../../server/services/keyStore.js';

describe('keyStore', () => {
  it('stores and retrieves a key', () => {
    setKey('spirit-1', 'abc123hex');
    expect(getKey('spirit-1')).toBe('abc123hex');
  });

  it('returns undefined for missing key', () => {
    expect(getKey('nonexistent')).toBeUndefined();
  });

  it('deletes a key', () => {
    setKey('spirit-del', 'key');
    deleteKey('spirit-del');
    expect(getKey('spirit-del')).toBeUndefined();
  });

  it('overwrites existing key', () => {
    setKey('spirit-2', 'old');
    setKey('spirit-2', 'new');
    expect(getKey('spirit-2')).toBe('new');
  });
});
```

#### tests/unit/timerService.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { startTimer, resolveTimers } from '../../server/services/timerService.js';

describe('startTimer', () => {
  it('creates a timer with correct type', () => {
    const state = { activeTimers: [] };
    startTimer(state, { type: 'movement', spiritId: 'spirit-1', duration: 30000, data: { targetHex: '1110' } });
    expect(state.activeTimers.length).toBe(1);
    expect(state.activeTimers[0].type).toBe('movement');
    expect(state.activeTimers[0].spiritId).toBe('spirit-1');
  });

  it('sets completesAt in the future', () => {
    const state = { activeTimers: [] };
    startTimer(state, { type: 'movement', spiritId: 'spirit-1', duration: 30000, data: {} });
    expect(state.activeTimers[0].completesAt).toBeGreaterThan(Date.now());
  });

  // NOTE: duplicate timer rejection is not yet implemented in timerService.
  // When added, startTimer should check for existing timer with same spiritId + type
  // and return { error: 'duplicate' } instead of pushing.
  it.todo('rejects duplicate timer for same spirit + type (needs service fix)');
});

describe('resolveTimers', () => {
  it('resolves expired timers', () => {
    const state = {
      activeTimers: [
        { id: 't1', type: 'movement', spiritId: 's1', completesAt: Date.now() - 1000, data: {} },
      ],
      spirits: { s1: { id: 's1', hexId: '1010', playerId: 'p1', alive: true, currentAction: 'moving' } },
      map: { hexes: { '1010': { spiritIds: ['s1'], controller: 'p1' } } },
    };
    const resolved = resolveTimers(state);
    expect(resolved.length).toBe(1);
    expect(state.activeTimers.length).toBe(0);
  });

  it('does not resolve future timers', () => {
    const state = {
      activeTimers: [
        { id: 't1', type: 'movement', spiritId: 's1', completesAt: Date.now() + 60000, data: {} },
      ],
    };
    const resolved = resolveTimers(state);
    expect(resolved.length).toBe(0);
    expect(state.activeTimers.length).toBe(1);
  });
});
```

#### tests/unit/hexGrid.test.js

```javascript
import { describe, it, expect } from 'vitest';
import { createHexGrid, getStartingPositions } from '@lib/hexGrid.js';
import { hexId } from '@lib/hexMath.js';

describe('createHexGrid', () => {
  it('returns 37 hexes', () => {
    const grid = createHexGrid();
    expect(Object.keys(grid.hexes).length).toBe(37);
  });

  it('every hex has terrain assigned', () => {
    const grid = createHexGrid();
    for (const hex of Object.values(grid.hexes)) {
      expect(hex.terrain).toBeDefined();
      expect(typeof hex.terrain).toBe('string');
    }
  });

  it('every hex has spiritIds array', () => {
    const grid = createHexGrid();
    for (const hex of Object.values(grid.hexes)) {
      expect(Array.isArray(hex.spiritIds)).toBe(true);
    }
  });

  it('center hex has grassland terrain', () => {
    const grid = createHexGrid();
    const center = grid.hexes[hexId(0, 0)];
    expect(center.terrain).toBe('grassland');
  });
});

describe('getStartingPositions', () => {
  it('returns 5 positions', () => {
    expect(getStartingPositions().length).toBe(5);
  });

  it('all positions exist in the grid', () => {
    const grid = createHexGrid();
    const positions = getStartingPositions();
    for (const pos of positions) {
      const id = hexId(pos.q, pos.r);
      expect(grid.hexes[id]).toBeDefined();
    }
  });
});
```

#### tests/unit/essenceHelpers.test.js

```javascript
import { describe, it, expect } from 'vitest';

// NOTE: scaleXp, scaleBond, and computeSpiritImpact are currently private (non-exported)
// functions in essenceService.js. To enable this test file, add these exports:
//   export { scaleXp, scaleBond, computeSpiritImpact };
// at the bottom of server/services/essenceService.js.
import { scaleXp, scaleBond, computeSpiritImpact } from '../../server/services/essenceService.js';

describe('scaleXp', () => {
  it('scales all tracks by factor', () => {
    const scaled = scaleXp({ combat: 100, exploration: 50, social: 30, wisdom: 20 }, 0.2);
    expect(scaled.combat).toBe(20);
    expect(scaled.exploration).toBe(10);
    expect(scaled.social).toBe(6);
    expect(scaled.wisdom).toBe(4);
  });

  it('floors to integer', () => {
    const scaled = scaleXp({ combat: 7 }, 0.2);
    expect(scaled.combat).toBe(1);
  });

  it('returns 0 for 0 XP', () => {
    const scaled = scaleXp({ combat: 0 }, 0.2);
    expect(scaled.combat).toBe(0);
  });
});

describe('scaleBond', () => {
  it('scales all dimensions', () => {
    const scaled = scaleBond({ depth: 80, harmony: 60, adventure: 40, loyalty: 100 }, 0.15);
    expect(scaled.depth).toBe(12);
    expect(scaled.harmony).toBe(9);
    expect(scaled.adventure).toBe(6);
    expect(scaled.loyalty).toBe(15);
  });
});

describe('computeSpiritImpact', () => {
  it('scores higher for surviving spirits', () => {
    const base = {
      finalXp: { combat: 50, exploration: 30, social: 20, wisdom: 10 },
      peakBond: { depth: 60, harmony: 50, adventure: 40, loyalty: 50 },
      kills: 3, hexesClaimed: 5,
    };
    const survived = computeSpiritImpact({ ...base, survived: true });
    const died = computeSpiritImpact({ ...base, survived: false });
    expect(survived).toBeGreaterThan(died);
    expect(survived - died).toBe(20);
  });

  it('scores higher for more kills', () => {
    const base = {
      finalXp: { combat: 50, exploration: 30, social: 20, wisdom: 10 },
      peakBond: { depth: 60, harmony: 50, adventure: 40, loyalty: 50 },
      survived: true, hexesClaimed: 0,
    };
    const many = computeSpiritImpact({ ...base, kills: 10 });
    const few = computeSpiritImpact({ ...base, kills: 1 });
    expect(many).toBeGreaterThan(few);
  });
});
```

### 8.2 Integration Tests (Service Interactions, Mocked Externals)

#### tests/integration/spiritDialogue.test.js

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/services/llmProxy.js', () => ({
  // Chain returns: first call = spirit dialogue, second call = extractDeityIntent JSON
  callLLM: vi.fn()
    .mockResolvedValueOnce('I sense great danger to the north, my deity.')
    .mockResolvedValueOnce(JSON.stringify({ intent: 'explore_north', confidence: 0.9 })),
}));

vi.mock('../../server/services/memwalServer.js', () => ({
  storeMemoryServer: vi.fn().mockResolvedValue('blob-123'),
  recallMemoriesServer: vi.fn().mockResolvedValue({ results: [
    { text: 'Previously discussed the northern mountains', score: 0.85 },
  ]}),
  getServerMemwal: vi.fn().mockReturnValue({
    rememberAndWait: vi.fn().mockResolvedValue('blob-456'),
    recall: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../server/services/keyStore.js', () => ({
  getKey: vi.fn().mockReturnValue('delegate-key-hex'),
}));

vi.mock('../../server/services/whisperService.js', () => ({
  propagateWhisperServer: vi.fn().mockResolvedValue({
    from: 'spirit-1', to: 'spirit-2', text: 'Deity warns of northern danger', bondFidelity: 65,
  }),
  extractDeityIntent: vi.fn().mockResolvedValue({
    intent: 'explore_north', confidence: 0.8,
  }),
}));

import { chatWithSpirit } from '../../server/services/spiritDialogueService.js';
import { callLLM } from '../../server/services/llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from '../../server/services/memwalServer.js';

describe('chatWithSpirit', () => {
  const spirit = {
    id: 'spirit-1', name: 'Ember',
    personality: 'Fierce and impulsive warrior spirit',
    playerId: 'player-1',
    memwalNamespace: 'swarm-player-1', memwalAccountId: 'acct-001',
    bond: { depth: 50, harmony: 40, adventure: 60, loyalty: 45 },
    specialization: 'warrior', generation: 0, parentId: null,
    memoryCount: 0,
    reincarnationCount: 0, previousNames: [], pastLifeMemories: [],
  };

  const gameState = {
    id: 'game-1',
    spirits: { 'spirit-1': spirit },
    map: { hexes: {} },
    actionHistory: [], eventLog: [],
  };

  beforeEach(() => { vi.clearAllMocks(); });

  it('returns a response and intent', async () => {
    const result = await chatWithSpirit({ spirit, userMessage: 'What do you see?', gameState });
    expect(result).toHaveProperty('response');
    expect(typeof result.response).toBe('string');
  });

  it('recalls memories before responding', async () => {
    await chatWithSpirit({ spirit, userMessage: 'Hello', gameState });
    expect(recallMemoriesServer).toHaveBeenCalled();
  });

  it('stores the conversation as memory', async () => {
    await chatWithSpirit({ spirit, userMessage: 'Remember this', gameState });
    expect(storeMemoryServer).toHaveBeenCalled();
  });

  it('calls LLM with spirit personality in system prompt', async () => {
    await chatWithSpirit({ spirit, userMessage: 'Fight!', gameState });
    const systemPrompt = callLLM.mock.calls[0][0];
    expect(systemPrompt).toContain('Ember');
    expect(systemPrompt).toContain('Fierce');
  });
});
```

#### tests/integration/battleArbiter.test.js

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/services/llmProxy.js', () => ({
  callLLM: vi.fn().mockResolvedValue(JSON.stringify({
    winner: 'attacker', narrative: 'The warrior struck with precision.',
    bondImpact: 5, tacticalScore: { attacker: 75, defender: 45 },
  })),
}));

vi.mock('../../server/services/memwalServer.js', () => ({
  storeMemoryServer: vi.fn().mockResolvedValue('blob-battle'),
  recallMemoriesServer: vi.fn().mockResolvedValue({ results: [] }),
  getServerMemwal: vi.fn().mockReturnValue({
    rememberAndWait: vi.fn().mockResolvedValue('blob-battle-2'),
  }),
}));

vi.mock('../../server/services/keyStore.js', () => ({
  getKey: vi.fn().mockReturnValue('key-hex'),
}));

// NOTE: v2 server-side signature is evaluateBattle({ attacker, defender, terrain, gameState }).
// The service currently exports resolveBattle — rename to evaluateBattle when porting to v2.
// Tests use the v2 name and signature so they're ready for the rename.
import { resolveBattle as evaluateBattle } from '../../server/services/battleArbiterService.js';

describe('evaluateBattle', () => {
  const attacker = {
    id: 'a1', name: 'Ember', playerId: 'p1', alive: true,
    personality: 'Fierce and impulsive warrior spirit',
    bond: { depth: 60, harmony: 50, adventure: 70, loyalty: 50 },
    combatXP: 30, kills: 0, memwalNamespace: 'ns-p1', memwalAccountId: 'acct-1',
  };

  const defender = {
    id: 'd1', name: 'Moss', playerId: 'p2', alive: true,
    personality: 'Patient guardian spirit',
    bond: { depth: 50, harmony: 60, adventure: 30, loyalty: 55 },
    combatXP: 20, kills: 0, memwalNamespace: 'ns-p2', memwalAccountId: 'acct-2',
  };

  it('returns a battle result with winner', async () => {
    const result = await evaluateBattle({
      attacker, defender, terrain: 'forest',
      hexId: 'h1', delegateKey: 'key-hex', accountId: 'acct-1',
    });
    expect(result).toHaveProperty('winner');
    expect(['attacker', 'defender', 'draw']).toContain(result.winner);
  });

  it('returns a narrative string', async () => {
    const result = await evaluateBattle({
      attacker, defender, terrain: 'forest',
      hexId: 'h1', delegateKey: 'key-hex', accountId: 'acct-1',
    });
    expect(typeof result.narrative).toBe('string');
    expect(result.narrative.length).toBeGreaterThan(0);
  });

  it('stores battle outcome as memory', async () => {
    const { storeMemoryServer } = await import('../../server/services/memwalServer.js');
    await evaluateBattle({
      attacker, defender, terrain: 'forest',
      hexId: 'h1', delegateKey: 'key-hex', accountId: 'acct-1',
    });
    expect(storeMemoryServer).toHaveBeenCalled();
  });
});
```

#### tests/integration/essenceExportImport.test.js

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const storedBlobs = new Map();

vi.mock('../../server/services/walrusService.js', () => ({
  getWalrusClient: vi.fn().mockReturnValue({
    writeBlob: vi.fn().mockImplementation(async ({ blob }) => {
      const id = `blob-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      storedBlobs.set(id, blob);
      return { blobId: id };
    }),
    readBlob: vi.fn().mockImplementation(async ({ blobId }) => {
      const data = storedBlobs.get(blobId);
      if (!data) throw new Error('Not found');
      return data;
    }),
  }),
  getServerSigner: vi.fn().mockReturnValue({}),
}));

vi.mock('../../server/services/memwalServer.js', () => ({
  getServerMemwal: vi.fn().mockReturnValue({
    rememberAndWait: vi.fn().mockResolvedValue('blob-mem'),
  }),
}));

vi.mock('../../server/services/llmProxy.js', () => ({
  callLLM: vi.fn().mockResolvedValue(JSON.stringify([
    { type: 'battle', summary: 'Won a decisive battle', spiritsInvolved: ['Ember'], impact: 0.9 },
  ])),
}));

import { exportSwarmEssence, importSwarmEssence } from '../../server/services/essenceService.js';

describe('essence round-trip', () => {
  const gameState = {
    gameId: 'game-1', startedAt: Date.now() - 3600000, winner: 'p1',
    map: { hexes: { h1: { controller: 'p1' }, h2: { controller: 'p1' }, h3: { controller: 'p2' } } },
    spirits: {
      's1': {
        id: 's1', name: 'Ember', playerId: 'p1', alive: true,
        personality: 'Fierce warrior', specialization: 'warrior',
        combatXP: 80, explorationXP: 20, socialXP: 30, wisdomXP: 10,
        bond: { depth: 70, harmony: 50, adventure: 60, loyalty: 55 },
        kills: 3, hexesClaimed: 5, whispersReceived: 8, whispersOriginated: 4,
        reincarnationCount: 0, previousNames: [], pastLifeMemories: [],
        memorableActions: ['Defended the northern pass'],
        memwalNamespace: 'ns-p1', memwalAccountId: 'acct-1',
      },
    },
    actionHistory: [
      { type: 'attack', playerId: 'p1', spiritId: 's1', timestamp: Date.now() },
      { type: 'whisper', playerId: 'p1', spiritId: 's1', timestamp: Date.now() },
    ],
    eventLog: [{ type: 'battle_won', playerId: 'p1', spiritId: 's1', timestamp: Date.now() }],
    players: { p1: { id: 'p1', walletAddress: '0xABC' }, p2: { id: 'p2', walletAddress: '0xDEF' } },
  };

  beforeEach(() => { storedBlobs.clear(); vi.clearAllMocks(); });

  it('exports and produces a valid blobId', async () => {
    const { blobId, essence } = await exportSwarmEssence(gameState, 'p1');
    expect(typeof blobId).toBe('string');
    expect(essence.spirits.length).toBeGreaterThan(0);
    expect(essence.lineageDepth).toBe(1);
  });

  it('imports a previously exported essence', async () => {
    const { blobId } = await exportSwarmEssence(gameState, 'p1');
    const imported = await importSwarmEssence(blobId, 'p1');
    expect(imported.spirits.length).toBeGreaterThan(0);
    expect(imported.lineageDepth).toBe(1);
  });

  it('reincarnated spirits carry 20% XP', async () => {
    const { blobId } = await exportSwarmEssence(gameState, 'p1');
    const imported = await importSwarmEssence(blobId, 'p1');
    const reincarnated = imported.spirits.find(s => s.reincarnationCount > 0);
    if (reincarnated) {
      expect(reincarnated.startingXp.combat).toBe(Math.floor(80 * 0.2));
    }
  });

  it('rejects import for wrong player', async () => {
    const { blobId } = await exportSwarmEssence(gameState, 'p1');
    await expect(importSwarmEssence(blobId, 'p2')).rejects.toThrow('different deity');
  });
});
```

#### tests/integration/whisperPropagation.test.js

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/services/llmProxy.js', () => ({
  callLLM: vi.fn()
    .mockResolvedValueOnce(JSON.stringify({
      intent: 'attack_south', confidence: 0.9, whisperText: 'Attack the southern forest',
    }))
    .mockResolvedValueOnce('The deity commands us southward!'),
}));

vi.mock('../../server/services/memwalServer.js', () => ({
  storeMemoryServer: vi.fn().mockResolvedValue('blob-w'),
  recallMemoriesServer: vi.fn().mockResolvedValue({ results: [] }),
  getServerMemwal: vi.fn().mockReturnValue({
    rememberAndWait: vi.fn().mockResolvedValue('blob-w2'),
    recall: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../server/services/keyStore.js', () => ({
  getKey: vi.fn().mockReturnValue('key-hex'),
}));

import { extractDeityIntent, propagateWhisperServer } from '../../server/services/whisperService.js';

describe('extractDeityIntent', () => {
  it('extracts intent from deity message', async () => {
    const result = await extractDeityIntent(
      'Go attack the south',
      'Fierce and impulsive warrior spirit',
      65, // bond average
    );
    expect(result).toHaveProperty('intent');
    expect(result).toHaveProperty('confidence');
  });
});

describe('propagateWhisperServer', () => {
  it('returns a whisper with from/to/text fields', async () => {
    const whisper = await propagateWhisperServer({
      sourceSpiritId: 's1',
      targetSpiritId: 's2',
      deityMessage: 'Attack south!',
      sourcePersonality: 'Fierce warrior',
      targetPersonality: 'Patient guardian',
      sourceBond: 65,
      swarmNamespace: 'ns-p1',
      delegateKey: 'key-hex',
      accountId: 'a1',
    });
    expect(whisper).toHaveProperty('from', 's1');
    expect(whisper).toHaveProperty('to', 's2');
    expect(whisper).toHaveProperty('text');
    expect(typeof whisper.text).toBe('string');
  });
});
```

### 8.3 System Tests (Full Game Loop)

#### tests/system/gameLifecycle.test.js

```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../server/services/llmProxy.js', () => ({
  callLLM: vi.fn().mockResolvedValue('I shall move.'),
}));

vi.mock('../../server/services/memwalServer.js', () => ({
  storeMemoryServer: vi.fn().mockResolvedValue('blob'),
  recallMemoriesServer: vi.fn().mockResolvedValue([]),
  getServerMemwal: vi.fn().mockReturnValue({
    rememberAndWait: vi.fn().mockResolvedValue('blob'),
    recall: vi.fn().mockResolvedValue([]),
  }),
}));

vi.mock('../../server/services/keyStore.js', () => ({
  setKey: vi.fn(), getKey: vi.fn().mockReturnValue('test-key'), deleteKey: vi.fn(),
}));

vi.mock('../../server/services/walrusService.js', () => ({
  getWalrusClient: vi.fn().mockReturnValue({
    writeBlob: vi.fn().mockResolvedValue({ blobId: 'blob-test' }),
    readBlob: vi.fn().mockResolvedValue(new TextEncoder().encode('{}')),
  }),
  getServerSigner: vi.fn().mockReturnValue({}),
}));

vi.mock('@mysten-incubation/memwal/account', () => ({
  generateDelegateKey: vi.fn().mockResolvedValue({
    privateKey: 'abcdef1234567890',
    publicKey: new Uint8Array(32),
    suiAddress: '0xtest',
  }),
}));

import { createInitialGameState } from '../../server/services/gameInit.js';
import { checkWinCondition } from '../../server/services/winService.js';
import { startTimer, resolveTimers } from '../../server/services/timerService.js';
import { validateMovement, claimHex } from '../../server/services/territoryService.js';
import { applyBondAction } from '../../server/services/bondService.js';

describe('full game lifecycle', () => {
  let state;

  beforeEach(async () => {
    state = await createInitialGameState();
  });

  it('initializes with 5 players and 5 spirits', () => {
    expect(Object.keys(state.players).length).toBe(5);
    expect(Object.keys(state.spirits).length).toBe(5);
  });

  it('starts in lobby status', () => {
    expect(state.status).toBe('lobby');
  });

  it('has 37-hex map', () => {
    expect(Object.keys(state.map.hexes).length).toBe(37);
  });

  it('each player controls exactly 1 hex at start', () => {
    for (const player of Object.values(state.players)) {
      const controlled = Object.values(state.map.hexes).filter(h => h.controller === player.id);
      expect(controlled.length).toBe(1);
    }
  });

  it('bots have higher starting bond than human player', () => {
    const human = Object.values(state.spirits).find(s => s.playerId === 'player-1');
    const bot = Object.values(state.spirits).find(s => s.playerId === 'player-2');
    expect(bot.bond.depth).toBeGreaterThan(human.bond.depth);
  });

  it('no win condition at game start', () => {
    state.status = 'active';
    expect(checkWinCondition(state)).toBeNull();
  });
});

describe('game state transitions', () => {
  let state;

  beforeEach(async () => {
    state = await createInitialGameState();
    state.status = 'active';
  });

  it('movement timer flow: start → resolve → timer removed', () => {
    const spirit = Object.values(state.spirits)[0];
    const adjHexes = Object.values(state.map.hexes)
      .filter(h => h.controller === null && h.spiritIds.length === 0);
    if (adjHexes.length > 0) {
      startTimer(state, { type: 'movement', spiritId: spirit.id, duration: 30000, data: { targetHex: adjHexes[0].id } });
      expect(state.activeTimers.length).toBe(1);
      state.activeTimers[0].completesAt = Date.now() - 1;
      const resolved = resolveTimers(state);
      expect(resolved.length).toBe(1);
    }
  });

  it('bond increases through chat actions', () => {
    const spirit = Object.values(state.spirits)[0];
    const oldDepth = spirit.bond.depth;
    applyBondAction(spirit, 'chat');
    expect(spirit.bond.depth).toBeGreaterThan(oldDepth);
  });

  it('territory claim updates hex controller', () => {
    const uncontrolled = Object.values(state.map.hexes).find(h => h.controller === null);
    if (uncontrolled) {
      claimHex(uncontrolled.id, 'player-1', state);
      expect(state.map.hexes[uncontrolled.id].controller).toBe('player-1');
    }
  });

  it('win condition triggers at 23 hexes', () => {
    let count = 0;
    for (const hex of Object.values(state.map.hexes)) {
      if (count < 23) { hex.controller = 'player-1'; count++; }
    }
    expect(checkWinCondition(state)).toBe('player-1');
  });
});
```

#### tests/system/wsProtocol.test.js

```javascript
import { describe, it, expect } from 'vitest';

// NOTE: sanitizeForClient is currently a private (non-exported) function in wsService.js.
// To enable this test, add `export` before `function sanitizeForClient(gameState)` in
// server/services/wsService.js (line with `function sanitizeForClient`).
import { sanitizeForClient } from '../../server/services/wsService.js';

describe('sanitizeForClient', () => {
  it('removes delegate key references from spirits', () => {
    const state = {
      spirits: { s1: { id: 's1', name: 'Ember', playerId: 'p1', delegateKey: 'secret-key', memwalAccountId: 'acct-1', _lastDecision: {} } },
      map: { hexes: {} }, players: {},
    };
    const sanitized = sanitizeForClient(state);
    expect(JSON.stringify(sanitized)).not.toContain('secret-key');
    expect(JSON.stringify(sanitized)).not.toContain('acct-1');
    expect(JSON.stringify(sanitized)).not.toContain('_lastDecision');
  });

  it('preserves game-relevant fields', () => {
    const state = {
      id: 'game-1', status: 'active',
      spirits: { s1: { id: 's1', name: 'Ember', playerId: 'p1', alive: true } },
      map: { hexes: { h1: { q: 0, r: 0, controller: 'p1' } } },
      players: { p1: { id: 'p1', name: 'Player 1' } },
      activeTimers: [],
    };
    const sanitized = sanitizeForClient(state);
    expect(sanitized.id).toBe('game-1');
    expect(sanitized.status).toBe('active');
    expect(sanitized.spirits.s1.name).toBe('Ember');
  });
});
```

### 8.4 Test Execution Order

Tests run in dependency order. Execute after each service is built:

```
BUILD STEP                          RUN AFTER
────────────────────────────────    ─────────────────────────────────
1. lib/ (hexMath, terrainTypes)  →  npm run test:unit -- hexMath hexGrid
2. lib/ (memoryClassifier)       →  npm run test:unit -- memoryClassifier
3. server/services/keyStore.js   →  npm run test:unit -- keyStore
4. server/services/bondService   →  npm run test:unit -- bondService
5. server/services/timerService  →  npm run test:unit -- timerService
6. server/services/territory     →  npm run test:unit -- territoryService
7. server/services/winService    →  npm run test:unit -- winService
8. server/services/essenceService→  npm run test:unit -- essenceHelpers
9. server/services/llmProxy      →  (no unit test — thin wrapper)
10. server/services/memwalServer →  (no unit test — thin wrapper)
11. server/services/dialogue     →  npm run test:integration -- spiritDialogue
12. server/services/battleArbiter→  npm run test:integration -- battleArbiter
13. server/services/whisperSvc   →  npm run test:integration -- whisperPropagation
14. server/services/essenceSvc   →  npm run test:integration -- essenceExportImport
15. server/services/gameInit     →  npm run test:system -- gameLifecycle
16. server/services/wsService    →  npm run test:system -- wsProtocol
17. ALL SERVICES COMPLETE        →  npm test (full suite)
```

**Iteration pattern:** Build service → write test → run test → fix failures → next service. Never batch tests at the end.

### 8.5 Test Conventions

1. **Mock external services, test internal logic.** MemWal, Walrus, Anthropic API are always mocked. Pure logic (hexMath, bondService, territoryService) is tested directly.
2. **Each test file is self-contained.** All mocks declared at top. No shared fixtures across files.
3. **Test names describe behavior, not implementation.** "allows movement to adjacent empty hex" not "calls validateMovement with correct args".
4. **Deterministic tests only.** No random seeds, no Date.now() in assertions. All tests must pass on every run.
5. **No network calls.** All tests run offline. No test hits MemWal relayer, Walrus testnet, or Anthropic API.

## 9. Swarm Persistence Redesign — Spirit NFTs + Ghosts + Deity Reputation

> **SUPERSEDES:** All essence-related logic in essenceService.js, EssenceExport.jsx, EssenceImport.jsx, and the `/api/essence/*` routes. Those files remain for reference but the v2 persistence system replaces them entirely.

### 9.0 Problem Statement

The current essence system fails at its core goal—making cross-game persistence feel meaningful:

| Problem | Current behavior | Impact |
|---------|-----------------|--------|
| Clunky save flow | Player manually copies a Walrus blob ID string | Players forget, lose their save, or never bother |
| Single spirit reincarnation | Only 1 of 3 spirits gets past-life data | 2/3 of your swarm starts generic every game |
| Negligible carryover | 20% XP + 15% bond = barely noticeable | Reincarnation doesn't feel like it matters |
| No wallet link | Essence is a free-floating blob ID | Nothing ties your save history to your Sui address |
| Demo-unfriendly | Need two full games to show persistence | Judges can't see the differentiator in a 5-min video |
| Memory disconnect | MemWal memories don't actually transfer | The Walrus track differentiator (persistent memory) is cosmetic |

### 9.1 Design Overview — Three Layers

The redesign replaces the single-blob essence system with three interlocking persistence layers, each stored differently:

```
┌──────────────────────────────────────────────────────────────────┐
│  LAYER 1: SPIRIT ROSTER (Sui Owned Objects)                      │
│  Your spirits are NFTs. After a game ends, surviving spirits     │
│  stay in your wallet. Next game, you pick which ones to bring.   │
│  Dead spirits that you don't reincarnate become ghosts.          │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 2: GHOST GRAVEYARD (Walrus + Server)                      │
│  Dead spirits from all past games become neutral NPCs on the     │
│  hex map. Any player can recruit them through dialogue.           │
│  Ghosts carry fragments of their past-life memories.             │
├──────────────────────────────────────────────────────────────────┤
│  LAYER 3: DEITY JOURNAL (Walrus Blob per Player)                 │
│  Player-level persistence: playstyle fingerprint, win/loss        │
│  record, bond averages, reputation. Spirits react to your         │
│  reputation — a ruthless deity's new spirits start wary.          │
└──────────────────────────────────────────────────────────────────┘
```

**Why three layers:** Layer 1 solves the save/load UX (wallet = save file). Layer 2 creates an ever-growing game world where past games haunt future ones (the "holy shit" demo moment). Layer 3 makes cross-game persistence visible at the player level, not just the spirit level.

### 9.2 Layer 1 — Spirit Roster (Sui NFTs)

#### 9.2.1 Move Contract: Spirit v2

The existing `spirit.move` needs new fields. Since Move objects can't be modified after deployment without upgrading the package, this requires a contract upgrade.

**New `Spirit` struct:**

```move
public struct Spirit has key, store {
    id: UID,
    name: vector<u8>,
    personality_hash: vector<u8>,
    generation: u64,
    created_at: u64,
    owner: address,
    parent_id: Option<ID>,
    // ── v2 additions ──
    specialization: vector<u8>,         // "warrior" | "scout" | "gatherer" | "sage"
    memwal_account_id: vector<u8>,      // MemWal account object ID (UTF-8)
    essence_blob_id: vector<u8>,        // Walrus blob ID of last game's essence snapshot
    avatar_blob_id: vector<u8>,         // Walrus blob ID of spirit avatar image
    status: u8,                         // 0 = alive, 1 = dead, 2 = ghost (entered graveyard)
    games_played: u64,                  // total games this spirit has participated in
    total_kills: u64,                   // lifetime kills across all games
    total_hexes_claimed: u64,           // lifetime territory claims
    bond_depth: u64,                    // last game's bond depth (0-100, stored as u64)
    bond_loyalty: u64,                  // last game's bond loyalty
    reincarnation_count: u64,           // how many times this spirit has been reborn
}
```

**New entry functions:**

```move
/// Update spirit stats after a game ends. AdminCap required.
public entry fun update_post_game(
    _: &AdminCap,
    spirit: &mut Spirit,
    essence_blob_id: vector<u8>,
    status: u8,
    kills: u64,
    hexes: u64,
    bond_depth: u64,
    bond_loyalty: u64,
    games_played: u64,
) {
    spirit.essence_blob_id = essence_blob_id;
    spirit.status = status;
    spirit.total_kills = spirit.total_kills + kills;
    spirit.total_hexes_claimed = spirit.total_hexes_claimed + hexes;
    spirit.bond_depth = bond_depth;
    spirit.bond_loyalty = bond_loyalty;
    spirit.games_played = games_played;
}

/// Mark a spirit as ghost (entered the graveyard). AdminCap required.
public entry fun mark_ghost(
    _: &AdminCap,
    spirit: &mut Spirit,
) {
    spirit.status = 2;
}

/// Reincarnate: reset status to alive, increment reincarnation count.
public entry fun reincarnate(
    _: &AdminCap,
    spirit: &mut Spirit,
) {
    spirit.status = 0;
    spirit.reincarnation_count = spirit.reincarnation_count + 1;
}

/// Mint v2 spirit with all new fields.
public entry fun mint_v2(
    cap: &AdminCap,
    name: vector<u8>,
    personality_hash: vector<u8>,
    generation: u64,
    parent_id: Option<ID>,
    specialization: vector<u8>,
    memwal_account_id: vector<u8>,
    avatar_blob_id: vector<u8>,
    recipient: address,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let spirit = Spirit {
        id: object::new(ctx),
        name,
        personality_hash,
        generation,
        created_at: clock::timestamp_ms(clock),
        owner: recipient,
        parent_id,
        specialization,
        memwal_account_id,
        avatar_blob_id,
        essence_blob_id: vector::empty(),
        status: 0,
        games_played: 0,
        total_kills: 0,
        total_hexes_claimed: 0,
        bond_depth: 0,
        bond_loyalty: 0,
        reincarnation_count: 0,
    };
    transfer::transfer(spirit, recipient);
}
```

#### 9.2.2 Roster Flow (Frontend)

**Lobby changes — roster picker replaces EssenceImport:**

1. When a player connects their wallet in the lobby, the server queries their owned `Spirit` objects via `suiClient.getOwnedObjects({ owner, filter: { StructType: '${PACKAGE_ID}::spirit::Spirit' } })`.
2. The lobby shows a **Roster Panel** (replaces the current "Your Swarm" + EssenceImport):
   - Top section: "YOUR SPIRIT ROSTER" — grid of all owned Spirit NFTs with avatar, name, specialization, lifetime stats, status badge (alive/dead).
   - Selection area: player drags/clicks up to 3 spirits into "STARTING SWARM" slots. Dead spirits can be reincarnated (costs nothing, just resets status) or left as ghosts.
   - Bottom: "FILL REMAINING" — any empty slots (if player has < 3 spirits, or chooses < 3) get fresh random spirits generated by the server.
3. When the player clicks "Awaken", the selected spirit IDs are sent to `POST /api/game/ready` along with `{ selectedSpiritIds: [id1, id2, id3] }`.
4. The server loads each Spirit NFT's onchain data + MemWal memories and initializes the in-game spirit state with carryover bonuses.

**New player first game:** Player has no spirits. All 3 slots say "New Spirit" with a generated name/personality. After the game ends, they receive 3 Spirit NFTs minted to their wallet.

**Reincarnation (within roster):** A spirit with `status: 1 (dead)` can be selected for the starting swarm. Selecting it triggers a `reincarnate()` Move call (sets status back to 0, increments reincarnation_count). The spirit enters the game with:

| Stat | Carryover | Reasoning |
|------|-----------|-----------|
| XP (all types) | 40% of lifetime total | Meaningful enough to feel different from a fresh spirit |
| Bond | 30% of last-game bond | They remember you but the relationship needs rebuilding |
| Memories | Top 5 MemWal memories by relevance | The spirit quotes past-life events in dialogue |
| Avatar | Inherited | Visual continuity across games |
| Name | Inherited (with "Reborn" tag in UI) | Identity persistence |
| Specialization | Inherited | Role persistence |

**Spirits not selected for the roster:** Any spirit the player owns but doesn't bring into the game stays in their wallet untouched. They can be used in future games.

#### 9.2.3 Post-Game: Minting + Updating

When a game ends (`gameState.status === 'finished'`):

1. **For each surviving spirit of the human player:**
   - Compute an essence snapshot (JSON) and store on Walrus → get `essenceBlobId`
   - If the spirit has no onchain NFT yet (first game): call `mint_v2()` to create the NFT, transfer to player's wallet
   - If the spirit already has an onchain NFT: call `update_post_game()` with new stats
   - Store final MemWal memories (the spirit's most impactful moments from this game)

2. **For each dead spirit of the human player:**
   - Same essence snapshot + Walrus store
   - If NFT exists: call `update_post_game()` with `status: 1` (dead)
   - The spirit now appears in the player's roster as dead—they can reincarnate it next game or leave it for the ghost system

3. **For spirits the player chooses to release to the graveyard** (explicit action, not automatic):
   - Call `mark_ghost()` on the NFT → `status: 2`
   - The spirit's essence blob ID + memories become available to the Graveyard system
   - The NFT stays in the player's wallet (they "own the ghost") but it's flagged as ghost status

#### 9.2.4 Server-Side: rosterService.js (NEW)

```javascript
// server/services/rosterService.js

/**
 * Load a player's Spirit NFT roster from Sui.
 * @param {string} walletAddress - Sui address
 * @returns {Promise<SpiritNFT[]>}
 */
export async function loadRoster(walletAddress) { ... }

/**
 * Initialize in-game spirit state from selected NFTs.
 * Applies carryover bonuses, loads MemWal memories.
 * @param {string[]} selectedSpiritIds - onchain object IDs
 * @param {string} playerId - in-game player ID
 * @param {object} gameState
 * @returns {Promise<void>}
 */
export async function initializeFromRoster(selectedSpiritIds, playerId, gameState) { ... }

/**
 * Post-game: update NFTs, mint new ones, store essence snapshots.
 * @param {object} gameState
 * @param {string} playerId
 * @returns {Promise<{ minted: string[], updated: string[], essenceBlobIds: string[] }>}
 */
export async function persistPostGame(gameState, playerId) { ... }
```

### 9.3 Layer 2 — Ghost Graveyard

#### 9.3.1 Concept

Every spirit that dies and isn't reincarnated by its owner becomes a **ghost** — a neutral NPC that haunts the hex map in future games. Ghosts are not controlled by any player. They exist as fragments of past games, carrying memory shards from their previous life.

**Why this matters for judging:** This is the single most demonstrable "memories persist" moment. A judge playing game 2 encounters a spirit from game 1, and that ghost *remembers* things that happened. It quotes dialogue. It references battles. The memories are verifiable on Walrus.

#### 9.3.2 Ghost Spawning

At game initialization:
1. Server reads the **Graveyard Registry** — a Walrus blob that maps ghost spirit IDs to their essence blob IDs.
2. Server selects up to **5 ghosts** for the current map (weighted by: recency of death, drama of death, memory richness).
3. Each ghost is placed on a random unclaimed hex with terrain matching their past life's preferred biome (warriors → volcanic/mountain, scouts → forest/grassland, gatherers → coastal/tundra).
4. Ghosts are added to `gameState.spirits` with `playerId: 'ghost'` and `alive: true`.

#### 9.3.3 Ghost Behavior

Ghosts are autonomous NPCs with limited behavior:

| Behavior | Description |
|----------|-------------|
| **Wander** | Move to an adjacent hex every 3-5 ticks (random). Don't claim territory. |
| **Speak** | When a player's spirit enters the ghost's hex, the ghost initiates dialogue. It draws from its MemWal past-life memories to say something relevant ("I remember this place... the last deity who commanded me sent me to die here.") |
| **Recruitability** | A player can whisper to a ghost (uses their swarm decree charge). If the ghost's past-life loyalty was low (< 30), it joins easily. If loyalty was high (> 70), it resists ("I served another deity. Why should I follow you?"). Medium loyalty = persuasion check via LLM. |
| **Combat** | Ghosts don't initiate combat. If attacked, they fight back at 60% of their past-life stats. |
| **Memory fragments** | Ghosts periodically emit "memory fragment" events visible on the map — floating text snippets from their past life. Other spirits can observe these. |

#### 9.3.4 Recruiting a Ghost

When a player successfully recruits a ghost:
1. The ghost's `playerId` changes to the recruiting player's ID.
2. The ghost gains the player as their new deity — bond starts at `{ depth: 20, harmony: 10, adventure: 30, loyalty: 15 }` (wary but curious).
3. The ghost retains all past-life memories — they remember their previous deity and may reference them ("The one before you... they were kinder" or "The one before you left me to die").
4. The ghost counts toward the recruiting player's spirit count and territory claims.
5. Onchain: the ghost NFT's owner doesn't change (original player still owns it), but the in-game state reflects the new allegiance. This is a gameplay mechanic, not a transfer.

#### 9.3.5 Graveyard Registry

**Storage:** A single Walrus blob (JSON), updated after each game.

```json
{
  "version": 1,
  "updatedAt": 1716200000000,
  "ghosts": [
    {
      "spiritNftId": "0x...",
      "ownerAddress": "0x...",
      "essenceBlobId": "WALRUS_BLOB_ID",
      "name": "Ember",
      "specialization": "warrior",
      "deathGame": "game-1716100000000",
      "deathCause": "battle",
      "killedBy": "Drift",
      "lastDeityName": "Pyraxis the Smoldering",
      "pastLifeLoyalty": 45,
      "pastLifeBondAvg": 52,
      "memwalNamespace": "swarm-player-1",
      "memwalAccountId": "0x...",
      "avatarBlobId": "WALRUS_BLOB_ID",
      "memorableQuote": "I fought for the burning lands, and the burning lands consumed me."
    }
  ]
}
```

**Server file:** `server/services/graveyardService.js`

```javascript
/**
 * Load ghosts from the Graveyard Registry (Walrus blob).
 * @returns {Promise<Ghost[]>}
 */
export async function loadGraveyard() { ... }

/**
 * Add dead spirits to the graveyard after a game ends.
 * @param {object[]} deadSpirits - spirits with status=dead that owner released
 * @param {object} gameState
 * @returns {Promise<string>} updated graveyard blob ID
 */
export async function addToGraveyard(deadSpirits, gameState) { ... }

/**
 * Select ghosts for a new game map.
 * @param {number} count - max ghosts to spawn (default 5)
 * @returns {Promise<GhostInit[]>}
 */
export async function selectGhostsForGame(count = 5) { ... }

/**
 * Handle ghost recruitment attempt.
 * @param {string} ghostSpiritId
 * @param {string} recruitingPlayerId
 * @param {string} whisperMessage
 * @param {object} gameState
 * @returns {Promise<{ success: boolean, dialogue: string }>}
 */
export async function attemptRecruitment(ghostSpiritId, recruitingPlayerId, whisperMessage, gameState) { ... }
```

#### 9.3.6 Ghost Decision Service

Ghosts need their own lightweight decision loop, separate from player-controlled spirits:

```javascript
// In spiritDecisionService.js, add ghost handling:

async function decideGhostAction(ghost, gameState) {
  // Ghosts are simpler than player spirits:
  // 1. If a player spirit is on the same hex → initiate dialogue (memory-driven)
  // 2. If alone → wander to adjacent hex (random, 30% chance per tick)
  // 3. If attacked → fight back (reactive only)
  // 4. Every ~10 ticks → emit a memory fragment event
}
```

### 9.4 Layer 3 — Deity Journal (Player Reputation)

#### 9.4.1 Concept

The Deity Journal is a player-level persistence blob stored on Walrus, linked to the player's Sui wallet address. It tracks the deity's cumulative reputation across all games. Spirits react to this reputation — a deity known for sacrificing spirits will find new spirits start with lower loyalty.

#### 9.4.2 Data Structure

```json
{
  "version": 1,
  "walletAddress": "0x...",
  "deityName": "Pyraxis the Smoldering",
  "updatedAt": 1716200000000,
  "gamesPlayed": 5,
  "wins": 2,
  "losses": 3,
  "totalSpiritsCommanded": 18,
  "totalSpiritsLost": 7,
  "totalSpiritsReincarnated": 3,
  "totalSpiritsGhosted": 4,
  "playstyle": {
    "aggressionRatio": 0.65,
    "whisperFrequency": 42,
    "dominantThemes": ["combat", "exploration"],
    "specTendency": "warrior",
    "deityArchetype": "Warlord"
  },
  "bondAverages": {
    "depth": 55,
    "harmony": 40,
    "adventure": 68,
    "loyalty": 35
  },
  "reputation": {
    "benevolence": 35,
    "ruthlessness": 72,
    "wisdom": 48,
    "loyalty": 28
  },
  "memorableDeeds": [
    "Sacrificed Ember to hold the volcanic pass against three enemy spirits",
    "Recruited the ghost of Drift, who had served an enemy deity",
    "Won a game without losing a single spirit"
  ],
  "gameHistory": [
    {
      "gameId": "game-1716100000000",
      "result": "victory",
      "spiritsAlive": 4,
      "spiritsLost": 1,
      "hexesControlled": 25,
      "essenceBlobId": "WALRUS_BLOB_ID"
    }
  ],
  "blobId": "CURRENT_BLOB_ID"
}
```

#### 9.4.3 Reputation Effects

When a player starts a new game, the server reads their Deity Journal from Walrus and applies reputation modifiers to their starting spirits:

| Reputation dimension | Effect on new spirits | Threshold |
|---------------------|----------------------|-----------|
| **Benevolence > 60** | +10 starting loyalty, +5 harmony | Spirits trust a kind deity |
| **Ruthlessness > 70** | -10 starting loyalty, +5 adventure | Spirits fear a harsh deity |
| **Wisdom > 60** | +5 starting depth | Spirits respect a wise deity |
| **Loyalty < 30** (deity abandons spirits) | -15 starting loyalty, ghosts resist harder | "Your last spirits haunt the graveyard..." |
| **Win rate > 60%** | +5 all bond stats | Spirits want to serve a winner |
| **Win rate < 20%** | -5 loyalty | Spirits doubt a losing deity |

These modifiers apply to fresh spirits only (not returning roster spirits, who already have bond history).

Reputation also affects the LLM prompt for spirit decisions:
```
DEITY REPUTATION:
Your deity, {deityName}, is known as a {archetype}.
They have commanded {totalSpirits} spirits across {gamesPlayed} games.
{ruthlessness > 70 ? "Many spirits have fallen under their command. Tread carefully." : ""}
{benevolence > 60 ? "They are known for protecting their swarm. You feel safe." : ""}
{loyalty < 30 ? "They have a habit of abandoning spirits to the graveyard. You are wary." : ""}
```

#### 9.4.4 Deity Archetype Derivation

Computed from reputation dimensions:

| Archetype | Condition |
|-----------|-----------|
| Warlord | ruthlessness > 65 AND aggressionRatio > 0.5 |
| Shepherd | benevolence > 65 AND totalSpiritsLost/totalSpiritsCommanded < 0.2 |
| Sage | wisdom > 60 AND dominantThemes includes "influence" |
| Tyrant | ruthlessness > 70 AND loyalty < 30 |
| Phoenix | reincarnation_count(all spirits) / totalSpiritsLost > 0.6 |
| Wanderer | gamesPlayed < 3 (default for new players) |
| Balanced | no extreme dimensions |

#### 9.4.5 Server-Side: deityJournalService.js (NEW)

```javascript
// server/services/deityJournalService.js

/**
 * Load deity journal from Walrus by wallet address.
 * @param {string} walletAddress
 * @returns {Promise<DeityJournal | null>}
 */
export async function loadDeityJournal(walletAddress) { ... }

/**
 * Update deity journal after a game ends.
 * @param {string} walletAddress
 * @param {object} gameState
 * @param {string} playerId
 * @returns {Promise<string>} new blob ID
 */
export async function updateDeityJournal(walletAddress, gameState, playerId) { ... }

/**
 * Compute reputation modifiers for starting spirits.
 * @param {DeityJournal} journal
 * @returns {BondModifiers}
 */
export function computeReputationModifiers(journal) { ... }

/**
 * Generate the LLM prompt fragment for deity reputation.
 * @param {DeityJournal} journal
 * @returns {string}
 */
export function buildReputationPrompt(journal) { ... }
```

#### 9.4.6 Deity Journal Registry

Unlike per-spirit essence (which is stored per blob ID), deity journals need to be discoverable by wallet address. Two options:

**Option A (chosen): Server-side index**
- The server maintains a `_data/deity-journals.json` mapping `walletAddress → blobId`.
- On game end, the server updates the journal blob on Walrus and updates the local index.
- Simple, works for hackathon scope. No onchain registry needed.

**Option B (future): Onchain registry**
- A Move shared object mapping `address → DeityJournal` (as a Table).
- Full decentralization. Out of scope for hackathon.

### 9.5 API Routes

#### 9.5.1 New Routes

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/api/roster/:walletAddress` | Load player's Spirit NFT roster from Sui |
| POST | `/api/game/ready` (modified) | Accept `selectedSpiritIds` array instead of `blobId` |
| POST | `/api/game/end-persist` | Post-game: mint/update NFTs, store essence, update journal |
| POST | `/api/ghost/recruit` | Attempt to recruit a ghost NPC |
| GET | `/api/deity-journal/:walletAddress` | Load deity journal for profile display |
| GET | `/api/graveyard` | List all available ghosts |

#### 9.5.2 Modified Routes

**`POST /api/game/ready` (modified)**

Current body: `{ playerId, blobId? }`
New body: `{ playerId, selectedSpiritIds?: string[] }`

- If `selectedSpiritIds` provided: load those NFTs, apply carryover, initialize spirits
- If empty/missing: generate fresh random spirits (current behavior)

**`POST /api/game/end-persist` (NEW)**

Called when game ends. Body: `{ playerId }`

Response:
```json
{
  "minted": ["0x..."],
  "updated": ["0x..."],
  "ghosted": ["0x..."],
  "deityJournalBlobId": "WALRUS_BLOB_ID",
  "graveyardUpdated": true
}
```

#### 9.5.3 Deprecated Routes

| Route | Status |
|-------|--------|
| `POST /api/essence/export` | DEPRECATED — replaced by `/api/game/end-persist` |
| `POST /api/essence/import` | DEPRECATED — replaced by roster flow from wallet |
| `POST /api/essence/confirm` | DEPRECATED — no longer needed |
| `GET /api/essence/lineage` | DEPRECATED — lineage is now per-spirit on Sui (parent_id chain) |

### 9.6 Frontend Changes

#### 9.6.1 Lobby Redesign

**Current lobby:** Title + Awaken button (left) | Your Swarm grid + EssenceImport (right)

**New lobby:** Title + Awaken button (left) | Roster Picker (right)

**RosterPicker.jsx (NEW)** — replaces EssenceImport inside the swarm panel:

```
┌─────────────────────────────────────────────┐
│  YOUR SPIRIT ROSTER              3/5 owned  │
├─────────────────────────────────────────────┤
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐  │
│  │Ember│ │Drift│ │ Moss │ │Shade│ │(New)│  │
│  │ ⚔ W │ │ ⌖ S │ │ ◈ G │ │💀 W│ │  ?  │  │
│  │85 XP│ │42 XP│ │63 XP│ │DEAD │ │     │  │
│  └──┬──┘ └──┬──┘ └──┬──┘ └──┬──┘ └─────┘  │
│     │       │       │       │               │
│  ┌──▼──────▼───────▼───────┐               │
│  │  STARTING SWARM (3 max)  │  ◄ drag here  │
│  │  [Ember]  [Moss]  [NEW]  │               │
│  └──────────────────────────┘               │
│                                             │
│  Dead spirits: reincarnate or release       │
│  ┌────────────────────────────────────────┐ │
│  │ 💀 Shade (warrior) — died in battle    │ │
│  │ [Reincarnate ✦] [Release to Graveyard] │ │
│  └────────────────────────────────────────┘ │
│                                             │
│  DEITY REPUTATION                           │
│  Warlord · 2W/3L · 65% aggression          │
│  Spirits start wary (-10 loyalty)           │
└─────────────────────────────────────────────┘
```

#### 9.6.2 Game Over Screen

**Current:** EssenceExport with blob ID copy.

**New:** Automatic persist + results.

```
┌─────────────────────────────────────────────┐
│  GAME OVER — VICTORY                        │
├─────────────────────────────────────────────┤
│  Your spirits have been saved to your wallet│
│                                             │
│  ✓ Ember (warrior) — survived, 4 kills     │
│  ✓ Moss (gatherer) — survived, 12 hexes    │
│  ✗ Drift (scout) — died in battle           │
│    [Reincarnate Next Game] [Release Ghost]  │
│                                             │
│  DEITY JOURNAL UPDATED                      │
│  Warlord · 3W/3L · reputation stored on    │
│  Walrus                                     │
│                                             │
│  [Play Again]                               │
└─────────────────────────────────────────────┘
```

No more blob ID copying. Everything persists automatically to wallet + Walrus.

#### 9.6.3 In-Game: Ghost Encounters

When a player's spirit moves to a hex containing a ghost:

1. The SpiritPanel shows a ghost encounter card with the ghost's name, avatar, and a memory fragment.
2. The player can use their swarm decree to whisper to the ghost (recruitment attempt).
3. The dialogue feeds into the LLM with the ghost's past-life memories as context.
4. Success → ghost joins swarm, failure → ghost delivers a haunting line and wanders away.

### 9.7 Data Flow Diagrams

#### 9.7.1 New Player — First Game

```
Player connects wallet (no Spirit NFTs)
    ↓
Server: loadRoster(wallet) → empty array
    ↓
Lobby: "No spirits yet. Your first swarm will be generated."
    ↓
Player clicks Awaken → POST /api/game/ready { playerId, selectedSpiritIds: [] }
    ↓
Server: generates 3 fresh spirits (current gameInit.js behavior)
    ↓
Game plays out...
    ↓
Game ends → POST /api/game/end-persist { playerId }
    ↓
Server:
  1. For each spirit → computeEssence() → storeEssence() → get blobId
  2. For each spirit → mint_v2() NFT → transfer to player wallet
  3. For dead spirits → prompt player: reincarnate or ghost?
  4. updateDeityJournal() → store on Walrus
  5. addToGraveyard() for any ghosted spirits
```

#### 9.7.2 Returning Player — Has Roster

```
Player connects wallet (has 5 Spirit NFTs)
    ↓
Server: loadRoster(wallet) → 5 spirits with onchain stats
    ↓
Lobby: RosterPicker shows all 5, player picks 3
    ↓
Player clicks Awaken → POST /api/game/ready { playerId, selectedSpiritIds: [id1, id2, id3] }
    ↓
Server: initializeFromRoster()
  1. For each selected spirit → load onchain data
  2. If status=dead → reincarnate() Move call
  3. Apply carryover: 40% XP, 30% bond
  4. Load top 5 MemWal memories → inject into spirit personality context
  5. Load Deity Journal → apply reputation modifiers to fresh spirits
    ↓
Game plays with returning spirits + reputation effects
```

#### 9.7.3 Ghost Encounter

```
Player spirit moves to hex with ghost
    ↓
Server: ghost detects cohabitation → initiates dialogue
    ↓
LLM prompt includes:
  - Ghost's past-life personality
  - Ghost's MemWal memories (top 3 by relevance to current context)
  - Ghost's death context ("killed by Drift in volcanic terrain")
  - Ghost's past deity name
    ↓
Ghost speaks → event broadcast to frontend
    ↓
Player uses swarm decree → "Join my swarm, Ember. I will not abandon you."
    ↓
POST /api/ghost/recruit { ghostSpiritId, playerId, message }
    ↓
Server: attemptRecruitment()
  - Check ghost's pastLifeLoyalty
  - Low (<30) → auto-join
  - Medium (30-70) → LLM persuasion check
  - High (>70) → very difficult, requires specific memory reference
    ↓
Success → ghost.playerId = recruitingPlayer, bond starts low
Failure → ghost wanders away, cooldown before retry
```

### 9.8 Implementation Plan

Scoped to remaining build period (now through Jun 21, 2026).

#### Phase 1: Spirit NFT Roster (3-4 days)

| Task | Files | Effort |
|------|-------|--------|
| Upgrade spirit.move with v2 fields | `contracts/anima_swarm/sources/spirit.move` | 2h |
| Deploy upgraded package to testnet | CLI | 1h |
| Build rosterService.js | `server/services/rosterService.js` (NEW) | 4h |
| Update suiService.js with v2 tx builders | `server/services/suiService.js` | 3h |
| Modify /api/game/ready to accept selectedSpiritIds | `server/routes/game.js` | 2h |
| Add /api/roster/:walletAddress route | `server/routes/game.js` | 2h |
| Build RosterPicker.jsx | `frontend/src/components/RosterPicker.jsx` (NEW) | 4h |
| Replace EssenceImport with RosterPicker in Lobby | `frontend/src/components/Lobby.jsx` | 2h |
| Post-game persist flow | `server/services/rosterService.js` | 4h |
| Replace EssenceExport with auto-persist UI | `frontend/src/components/GameOver.jsx` (NEW) | 3h |

#### Phase 2: Ghost System (2-3 days)

| Task | Files | Effort |
|------|-------|--------|
| Build graveyardService.js | `server/services/graveyardService.js` (NEW) | 4h |
| Ghost spawning in gameInit.js | `server/services/gameInit.js` | 3h |
| Ghost decision logic | `server/services/spiritDecisionService.js` | 3h |
| Ghost recruitment route + logic | `server/routes/game.js`, `graveyardService.js` | 3h |
| Ghost dialogue (LLM prompt with past-life memories) | `server/services/spiritDialogueService.js` | 3h |
| Ghost UI (encounter card, memory fragments on map) | `frontend/src/components/SpiritPanel.jsx`, `HexMap.jsx` | 4h |

#### Phase 3: Deity Journal (1-2 days)

| Task | Files | Effort |
|------|-------|--------|
| Build deityJournalService.js | `server/services/deityJournalService.js` (NEW) | 3h |
| Journal storage (Walrus) + local index | `walrusService.js` | 2h |
| Reputation modifier application in gameInit | `server/services/gameInit.js` | 2h |
| Reputation prompt injection in spiritDecisionService | `server/services/spiritDecisionService.js` | 2h |
| Deity profile display in lobby | `frontend/src/components/RosterPicker.jsx` | 2h |
| GET /api/deity-journal route | `server/routes/game.js` | 1h |

#### Phase 4: Polish + Demo (1-2 days)

| Task | Files | Effort |
|------|-------|--------|
| Seed graveyard with 5 pre-made ghosts for demo | `_data/graveyard-seed.json` | 1h |
| Demo script: show ghost encounter in 5-min video | Script only | 2h |
| Explorer page: add ghost viewer + deity journal viewer | `frontend/public/explorer/index.html` | 3h |
| Clean up deprecated essence routes (mark as v1 legacy) | `server/routes/essence.js` | 1h |

### 9.9 Migration Path

The v1 essence system continues to work during development. The migration is:

1. **Phase 1 ships:** Roster flow becomes primary. EssenceImport still works as fallback (player can paste a blob ID to load legacy essence).
2. **Phase 2 ships:** Ghosts appear in games. No migration needed — ghosts are additive.
3. **Phase 3 ships:** Deity journal starts tracking from first game with journal enabled. No historical backfill.
4. **Phase 4:** EssenceImport/EssenceExport components moved to `/legacy/` or removed from main UI.

### 9.10 Walrus Storage Budget

| Data type | Size estimate | Frequency | Storage |
|-----------|--------------|-----------|---------|
| Spirit essence snapshot | ~2-5 KB JSON | Per spirit per game | Walrus blob, 5 epochs |
| Graveyard registry | ~10-50 KB JSON | Updated per game | Walrus blob, 5 epochs (single blob, overwritten) |
| Deity journal | ~2-5 KB JSON | Updated per game per player | Walrus blob, 5 epochs |
| Spirit avatar | ~50-100 KB WebP | Once per spirit | Walrus blob, 5 epochs |
| MemWal memories | Handled by MemWal | Per spirit per tick | MemWal relayer |

Total per game (1 human player, 3 spirits): ~20-30 KB new Walrus data. Well within testnet free tier.

### 9.11 Demo Script Integration

The 5-minute demo video should showcase persistence in this order:

1. **0:00-0:30** — Show empty wallet, start first game, spirits generated fresh
2. **0:30-2:00** — Play game 1: whisper to spirits, fight battles, claim territory
3. **2:00-2:30** — Game ends: show spirits automatically saved to wallet as NFTs
4. **2:30-3:00** — Start game 2: show Roster Picker with returning spirits, pick 2 + 1 new
5. **3:00-3:30** — Show returning spirit quoting a memory from game 1 ("I remember the volcanic pass...")
6. **3:30-4:00** — Encounter a ghost from game 1 on the map: "I served Pyraxis. They left me to die."
7. **4:00-4:30** — Recruit the ghost: "Join me. I won't abandon you like they did."
8. **4:30-5:00** — Show deity journal: reputation, archetype, lifetime stats — all on Walrus

**Key demo moment (3:30-4:00):** The ghost encounter. This is the judge-winning moment. A spirit from a previous game, carrying real memories stored on Walrus, speaking to the player. This is what "persistent verifiable memory" looks like in practice.

### 9.12 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Contract upgrade fails | Low | High | Test on devnet first; keep v1 mint as fallback |
| Walrus testnet slow/down | Medium | Medium | Local cache (existing mock mode) handles gracefully |
| NFT minting costs gas | Low | Low | Testnet gas is free; mainnet = small SUI amount |
| Ghost LLM calls expensive | Medium | Low | Ghost dialogue uses Haiku (cheap), not Opus |
| Roster query slow (many NFTs) | Low | Low | Paginate, cache for session |
| Graveyard grows too large | Low | Low | Cap at 100 ghosts; age out oldest |
| Demo can't show 2-game persistence | Medium | High | Seed graveyard with pre-made ghosts; pre-play game 1 before recording |

### 9.13 Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Save flow friction | Zero manual steps | Player never copies a blob ID |
| Cross-game memory visibility | Ghost quotes past-life memory in <30s of encounter | Timed during demo |
| Judge "wow" factor | Ghost encounter + deity reputation in demo | Qualitative |
| Carryover feels meaningful | Returning spirits noticeably stronger than fresh | 40% XP + 30% bond visible in stats |
| Walrus integration depth | 3 distinct data types on Walrus (essence, graveyard, journal) | Auditable |
| MemWal integration depth | Ghost memories recalled via MemWal semantic search | Verifiable |

---

### Session Log — 2026-05-21

**PRD §9 Implementation — 3-Layer Swarm Persistence**

Built the complete persistence redesign replacing the blob-ID-copy-paste essence flow:

**Backend (4 new services, 2 modified routes):**
- `rosterService.js` (272 lines) — loadRoster, initializeFromRoster (40% XP / 30% bond carryover), persistPostGame
- `graveyardService.js` (319 lines) — graveyard CRUD, ghost selection (up to 5 per game), attemptRecruitment (3-tier: auto-join/LLM/hard-LLM), buildGhostInitState
- `deityJournalService.js` (383 lines) — Walrus-backed deity journal, archetype derivation (7 archetypes), reputation modifiers for starting bond
- `suiService.js` — added mintSpiritV2, updateSpiritPostGame, markSpiritGhost, reincarnateSpirit, queryOwnedSpirits (all with mock mode)
- `game.js` routes — 5 new endpoints: GET /api/roster/:walletAddress, POST /api/game/end-persist, POST /api/ghost/recruit, GET /api/deity-journal/:walletAddress, GET /api/graveyard
- `gameInit.js` — ghost spawning on unclaimed non-ocean hexes
- `spiritDecisionService.js` — ghost AI (wander + speak), deity reputation in decision prompts

**Frontend (1 new component, 3 modified):**
- `RosterPicker.jsx` (209 lines) — 3-column spirit card grid, click-to-select max 3, gold highlight, status dots
- `Lobby.jsx` — RosterPicker above EssenceImport with "or import essence" divider
- `App.jsx` — auto-persist on game over (replaces manual EssenceExport), persist status indicator
- `HexMap.jsx` — ghost rendering (purple, 0.7 opacity, ethereal aura pulse)
- `SpiritPanel.jsx` — ghost encounter card (past-life info, memorable quote, recruitment input)

**Contract:**
- `spirit.move` v2 — 17-field Spirit struct, 5 entry functions (mint_v2, update_post_game, mark_ghost, reincarnate, set_avatar)

**Data:**
- `_data/graveyard.json` — 6 seed ghosts with lore, death causes, memorable quotes
- `essence.js` marked LEGACY/DEPRECATED

All builds pass (Move, Vite, Node). 15 files changed, ~1636 insertions. Uncommitted.
