# Anima Swarm

AI companions with persistent verifiable memory on Sui + Walrus. Sui Overflow 2026, Walrus Track.

## Key Facts

- **Hackathon:** Sui Overflow 2026 (Walrus Track, $35K 1st place)
- **Build period:** May 7–Jun 21, 2026
- **Submission deadline:** Jun 21, 2026
- **Shortlist announcement:** Jul 8
- **Demo Day:** Jul 20-21 (virtual)
- **Winners:** Aug 27 (Sui Basecamp)
- **Registration:** DeepSurge
- **Stack:** Move (Sui), TypeScript, React + Vite, Walrus/MemWal, Seal
- **Remote:** github.com/papa-raw/anima-swarm
- **Team:** Patrick Rawson (paparaw.eth)
- **Source engine:** `~/Desktop/1_projects/anima-synthesis/spiritus/` (61K LOC)

## Submission Requirements

| Field | Requirement |
|-------|------------|
| Project Name | Anima Swarm |
| Description | What it does, why it matters |
| Project Logo | 1:1 ratio (JPG/PNG) |
| Public GitHub | Must be public during judging |
| Demo Video | YouTube preferred, ≤5 min |
| Website | Optional but highly recommended |
| Deployment | Testnet or mainnet |
| Package ID | Required if deployed onchain |

## Eligibility

- Must be **built during May 7–Jun 21**. Existing projects OK if substantial new functionality during build period.
- Must be deployed to testnet/mainnet at shortlisting and demo day.
- Anima engine (spiritus/) is the existing codebase. All Sui/Walrus/MemWal integration is NEW work during the build period.

## Award Structure

- **50% at winner announcement** (Aug 27)
- **50% after successful mainnet deployment**
- If already on mainnet by Aug = 100% upfront

## Judging Criteria

| Criterion | Weight | Our strategy |
|-----------|--------|-------------|
| **Real-World Application** | **50%** | Persistent agent memory is THE unsolved problem in AI gaming. Every chatbot, NPC, companion forgets. We solve that with verifiable memory. |
| Product & UX | 20% | Anima already has a polished companion interface (Globe, AgentDetail, CaptureFlow). Port the UX. |
| Technical Implementation | 20% | 61K LOC engine + MemWal + Move contracts = genuine depth. Not a wrapper. |
| Presentation & Vision | 10% | Emergent swarm world from individual memories. Long-term: portable AI companions that remember you forever. |

## Walrus Track — What They Want

From the problem statement — they're looking for working systems that show:

1. **How agents become more useful when they can remember and build over time** — spirits that remember conversations, battles, and relationships across sessions
2. **How workflows improve when data is shared, durable, and portable** — swarm coordination where spirits read each other's public memories
3. **How developers can move beyond fragile, siloed memory setups** — MemWal as the persistent layer replacing localStorage/SQLite

**Especially interested in:**
- Long-running workflows where agents track state over time ✓ (spirit life cycle)
- Multi-agent coordination (negotiation, task delegation) ✓ (swarm behavior, battles)
- Artifact-driven workflows (agents generate, store, reuse outputs) ✓ (memory art, battle logs)

**For integrations:** Plugins/adapters for MemWal, workflow orchestration combining memory + messaging + execution, cross-agent memory sharing, dev tools to inspect agent memory.

## Architecture

### Onchain (Move)

```
contracts/anima_swarm/sources/
├── spirit.move          # Spirit NFTs — owned objects on Sui
├── territory.move       # Territory claims — shared objects
├── swarm.move           # Swarm state — cross-spirit coordination
└── game.move            # Game mechanics — battles, encounters
```

**Key objects:**
- `Spirit` — owned object. Character stats, personality hash, creation timestamp, owner.
- `Territory` — shared object. Geographic claim, current champion, challenger queue.
- `SwarmState` — shared object. Global swarm metrics, active spirit count, epoch.
- `MemoryRef` — struct stored in Spirit. Points to Walrus blob ID for that spirit's memory.

### Memory Layer (Walrus + MemWal)

Each spirit gets a MemWal account (delegate key). Memories are stored as Walrus blobs:

| Memory type | Storage | Privacy | Shared? |
|-------------|---------|---------|---------|
| Conversation history | MemWal | Seal-encrypted (owner only) | No |
| Battle outcomes | MemWal | Public | Yes (other spirits can read) |
| Relationship graph | MemWal | Seal-encrypted | No |
| Territory discoveries | MemWal | Public | Yes |
| Memory art (generated images) | Walrus blob | Public | Yes |

**Cross-agent memory sharing:** Spirits can read each other's public memories (battle outcomes, territory discoveries). This enables emergent swarm behavior — a spirit encountering another can check their battle history and decide whether to challenge or ally.

### Frontend

React + Vite, deployed on Walrus Sites. Ported from Spiritus UI:
- Globe view (Mapbox GL) — territory map with spirit locations
- Spirit detail — personality, memory timeline, relationship graph
- Battle flow — real-time LLM-arbitrated encounters
- Swarm view — emergent patterns from collective memory

### AI Engine

Ported from Spiritus (61K LOC):
- `llmClient` — provider-agnostic LLM abstraction (Anthropic/Windfall)
- `battleArbiterService` — LLM-scored battles (Bond 40% + Tactical 35% + Narrative 25%)
- `spiritDialogueService` — personality-driven conversation
- `conversationMemoryService` — **REPLACED: localStorage → MemWal**
- `bondService` — relationship tracking (Depth/Harmony/Adventure/Loyalty)

## Source Assets (from Spiritus)

Port these services from `~/Desktop/1_projects/anima-synthesis/spiritus/`:

**Core (must port):**
- `src/services/llmClient.js` — LLM abstraction
- `src/services/spiritDialogueService.js` — chat engine
- `src/services/bondService.js` — relationship mechanics
- `src/services/conversationMemoryService.js` — memory (rewrite for MemWal)
- `src/services/battleArbiterService.js` — battle scoring
- `src/services/territoryService.js` — territory mechanics
- `src/components/AgentDetail.jsx` — spirit detail UI
- `src/components/territory/` — territory system UI
- `src/data/agents.js` — spirit definitions
- `server/souls/` — spirit personality files

**Adapt:**
- `src/services/walletService.js` — Thirdweb (EVM) → @mysten/dapp-kit (Sui)
- `src/services/astralService.js` — EAS proofs → Walrus attestations
- `server/services/agentLoop.js` — autonomy tick → MemWal-backed state

**Skip:**
- `src/services/clankerService.js` — Base-specific token launch
- `src/services/diemService.js` — Venice VVV staking
- `server/services/auctionService.js` — SuperRare Bazaar
- `server/services/lpService.js` — Uniswap V4 LP

## Development

```bash
# Move contracts
cd contracts/anima_swarm
sui move build
sui move test
sui client publish --gas-budget 100000000

# Frontend
cd frontend
npm install
npm run dev

# Walrus Sites deployment
site-builder publish frontend/dist
```

## Key Resources

- [Walrus docs](https://docs.walrus.site/)
- [MemWal docs](https://docs.walrus.site/build/memwal/)
- [MemWal Playground](https://memwal-playground.walrus.site/) — create account + delegate key
- [MemWal GitHub](https://github.com/buidly/memwal) — sample apps, skills
- [Seal docs](https://docs.seal.mystenlabs.com/)
- [Sui Stack Messaging](https://docs.walrus.site/build/sui-stack-messaging/)
- [Walrus Sites docs](https://docs.walrus.site/walrus-sites/)
- [Sui Move docs](https://docs.sui.io/concepts/sui-move-concepts)
- [@mysten/dapp-kit](https://sdk.mystenlabs.com/dapp-kit)
- [Walrus Builder Telegram](https://go.sui.io/ofw-walrus-tg)
- [Overflow Telegram](https://t.me/suioverflow) (assumed)

## Prospecting

Pipeline entry: P225 in `~/Desktop/1_projects/prospecting/pipeline-active.md`
Prospect folder: `~/Desktop/1_projects/prospecting/active/anima-swarm/`

## Rules

1. All Sui/Walrus/MemWal work must be new (built during May 7–Jun 21).
2. Existing Anima engine code is the foundation — port and adapt, don't copy blindly.
3. Memory architecture is the differentiator. Every design decision should ask: "Does this show off persistent verifiable memory?"
4. Target Walrus track primarily, but structure for Agentic Web cross-submission.
5. Mainnet deployment by Aug 27 = 100% prize upfront. Plan for it.
