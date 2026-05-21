# Anima Swarm — Submission Description

## Short Description (for submission form)

A 6-player deity strategy game where you command AI spirit swarms through whispers. Every whisper, battle, memory, and death is persisted on Walrus — spirits remember across games, dead spirits become recruitable ghosts, and your deity reputation follows you forever.

## Long Description

### What it does

Anima Swarm is a multiplayer strategy game where players take on the role of deities commanding AI-powered spirit swarms on a hex grid. You don't give direct orders — you influence your swarm through two whispers every 30 seconds: a **swarm decree** that shapes your spirits' behavior, and an **enemy whisper** that erodes opposing spirits' loyalty.

Spirits are autonomous AI agents powered by Claude Haiku. Each spirit has a personality, bond system, specialization (warrior/scout/gatherer), and persistent memory stored on **Walrus via MemWal**. They interpret your whispers through the lens of their personality — a warrior hears "watch the east" as "attack eastward," while a cautious spirit fortifies defenses.

### Three-Layer Persistence (all on Walrus)

**Layer 1: Spirit Roster (Sui NFTs)** — Spirits are minted as NFTs on Sui. When a game ends, surviving spirits carry 40% of their XP and 30% of their bond into the next game. Return to a game with your veteran swarm.

**Layer 2: Ghost Graveyard** — Dead spirits don't disappear. They become ghosts that wander future games as NPCs, whispering fragments of their past lives. Players can recruit ghosts — but spirits with high past-life loyalty resist new deities. Every death creates content for future games.

**Layer 3: Deity Journal** — Your reputation as a deity is tracked across all games. Are you a Shepherd who protects spirits, or a Warlord who treats them as expendable? Your archetype affects starting bond with fresh spirits — a known Tyrant starts with suspicious swarms.

### Why Walrus?

Every piece of game state that matters is stored on Walrus:
- **Spirit memories** (MemWal) — conversations, battles, whispers, discoveries
- **Deity journals** — reputation, playstyle, game history  
- **Ghost graveyard** — dead spirits with their final memories and notable deeds
- **Spirit essence** — XP, bond, personality data persisted across games

This isn't memory bolted onto a game — the memory IS the game. Spirits that can't remember are just NPCs. Spirits that remember across sessions, carry grudges, recall past deities, and share memories with their swarm — that's Anima Swarm.

### Technical Stack

- **Move contracts** (Sui testnet): Spirit NFTs with v2 schema (17 fields), territory claims, battle recording, spawn tracking
- **MemWal**: Per-spirit memory accounts with delegate keys, semantic recall for decision-making
- **Walrus blobs**: Deity journals, ghost graveyard, spirit essence snapshots
- **Claude Haiku**: Spirit AI decisions, whisper interpretation, deity intent extraction, ghost recruitment dialogue
- **React + Vite frontend**: Hex grid strategy interface with real-time WebSocket updates
- **Express + WebSocket server**: 5-second game tick, timer-based movement/battle/spawn resolution

### What makes it special

1. **Whisper mechanic** — You don't command, you influence. Name-drop a spirit in your decree for a "chosen by god" targeting boost. The 30-second charge cycle makes every whisper strategic.

2. **Emergent behavior** — Spirits make their own decisions based on personality, bond, memories, and your whispers. A low-bond spirit might misinterpret your decree. A warrior will always want to fight. The swarm develops its own character.

3. **Cross-game persistence** — Game 1's battles create Game 2's ghosts. Game 2's reputation shapes Game 3's starting bonds. The world accumulates history that's stored on Walrus, not in a database that gets wiped.

4. **Enemy whispers** — Erode opposing spirits' loyalty until they defect. Low-resistance spirits can be overridden entirely — their deity orders replaced by yours. High-loyalty spirits shrug off foreign influence.

### Built During Sui Overflow

All Sui/Walrus/MemWal integration, the hex grid strategy system, persistence layers, whisper mechanics, ghost system, and deity journal were built from scratch during the May 7 — Jun 21 build period. The underlying AI engine (personality system, bond mechanics, LLM integration) was adapted from an existing codebase.
