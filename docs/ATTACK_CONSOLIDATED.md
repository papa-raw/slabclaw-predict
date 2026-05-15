# CONSOLIDATED ATTACK REPORT — Anima Swarm PRD v2

**Date:** 2026-05-14
**Sources:** 3 parallel adversarial agents covering contracts+dataflow, frontend+services, server+config+tests
**PRD size:** 5,731 lines across 8 sections

---

## Verdict: 22 unique Critical+High findings after dedup

The PRD has a systemic v1/v2 schism. Section 3 defines v1 (frontend-driven, snake_case, epoch-based). Section 7 redefines everything (server-authoritative, nested objects, real-time timers). The PRD says 5 v1 services "stay" but they are structurally incompatible with v2. A cold agent building both sections produces code that compiles but silently fails at runtime.

---

## TIER 1: BUILD CRASHERS (fix these or the project doesn't start)

| # | Finding | Agents | Fix |
|---|---------|--------|-----|
| 1 | **No server whisperService** — spiritDialogueService imports `propagateWhisperServer` which doesn't exist | All 3 | Write `server/services/whisperService.js` using llmProxy + memwalServer |
| 2 | **`sanitizeForClient` not exported** from wsService.js | 2/3 | Add `export` keyword |
| 3 | **WalletConnect.jsx + PlayerHud.jsx** imported but never specced | 2/3 | Write both component implementations |
| 4 | **v1 services import wrong modules** — `./llmClient`, `./memwalService` don't exist server-side | 2/3 | Port to `./llmProxy.js`, `./memwalServer.js` |
| 5 | **MemWal accounts never created** — `memwalAccountId: ''` everywhere | 1/3 | Add createAccount + addDelegateKey to gameInit or setup script |
| 6 | **Test imports non-existent functions** — `classifyXP`, `getSpecialization`, `getBondLevel` | 1/3 | Align all test imports to actual module exports |

## TIER 2: SILENT RUNTIME FAILURES (builds but core mechanics broken)

| # | Finding | Agents | Fix |
|---|---------|--------|-----|
| 7 | **Bond field naming split** — `spirit.bond_depth` (v1) vs `spirit.bond.depth` (v2) | All 3 | Rewrite all v1 services to v2 nested object shape |
| 8 | **`spirit.delegateKey` read from state** but lives in separate keyStore | 2/3 | Use `getKey(spirit.id)` from keyStore.js |
| 9 | **`gameState.gameId` doesn't exist** — schema has `gameState.id` | 2/3 | Replace `.gameId` with `.id` in essenceService |
| 10 | **SpiritState missing 8 fields** used by gameInit + essenceService (kills, hexesClaimed, etc.) | 2/3 | Add all fields to SpiritState interface |
| 11 | **battleResolver.js + spawnResolver.js** referenced by timerService but never defined | 2/3 | Write both services (battles/spawns currently resolve to no-ops) |
| 12 | **`explore` action** in LLM prompt but no handler in executeDecision switch | 2/3 | Add `case 'explore'` with 15s timer |
| 13 | **Specialization type mismatch** — u8 in Move vs string enum in v2 JS | 1/3 | Add mapping utility; remove `getSpecName()` |
| 14 | **hexId type mismatch** — JS returns string, Move expects u64 | 1/3 | Return number from `hexId()` or parseInt in suiService |
| 15 | **`buildSpawnTx` is a documented stub** — no tx.moveCall implementation | 1/3 | Write complete spawn transaction sequence |
| 16 | **No access control on Move contracts** — any address can kill/claim/update | 1/3 | Add AdminCap params or document server-key ownership model |
| 17 | **`spirit::mint()` signature conflict** — v1 returns Spirit, v2 transfers internally | 1/3 | Provide complete v2 spirit.move code |
| 18 | **PLAYER_COLORS keyed "player-1"** but playerId is wallet address when connected | 1/3 | Map wallet → internal index for colors |

## TIER 3: DATA/PERSISTENCE FAILURES

| # | Finding | Agents | Fix |
|---|---------|--------|-----|
| 19 | **eventLog never populated** — extractCoreMemories always returns `[]` | 1/3 | Push GameEvents from timer resolution |
| 20 | **player.importedEssenceBlobId** vs importedEssence — field mismatch | 2/3 | Store blobId separately in /ready route + add to Player interface |
| 21 | **Race condition: concurrent spirit decisions** mutate gameState | 1/3 | Serialize with for-await or mutex |
| 22 | **`SuiJsonRpcClient` should be `SuiGrpcClient`** + walrus() extension | 1/3 (Walrus research) | Replace import per verified SDK pattern |

## TIER 4: STRUCTURAL (address during build, not before)

| # | Finding | Fix |
|---|---------|-----|
| 23 | Data flow trace (3.7) describes v1 frontend arch | Mark SUPERSEDED or rewrite for v2 |
| 24 | v2 real-time timers vs Move epoch-based cooldowns | Bridge with synthetic epoch or timestamp contract |
| 25 | Missing 5 env vars from .env.example | Add SUI_RPC_URL, SUI_NETWORK, MEMWAL_URL, MEMWAL_PACKAGE_ID, MEMWAL_REGISTRY_ID |
| 26 | No WebSocket proxy in vite.config | Add '/ws': { ws: true } |
| 27 | No WS reconnection logic | Add backoff reconnect |
| 28 | Game state in-memory only — crash loses everything | Periodic JSON snapshot |
| 29 | Design system CSS vars orphaned (components use hardcoded Tailwind) | Wire Tailwind to CSS vars or remove |
| 30 | index.css not specced — Tailwind directives missing | Add file |
| 31 | memoryClassifier never called — spirits can't specialize | Wire into timerService after XP changes |
| 32 | ~600 lines of dead v1 frontend services | Mark deprecated or remove from Section 3.4 |
| 33 | deploy-contracts.sh doesn't extract GAME_MAP_ID | Add jq extraction |
| 34 | chatRoutes (v1 /api/chat) still mounted — unauthenticated LLM proxy | Remove from v2 server |
| 35 | Root package.json has no workspace config — test imports fail | Add workspaces |
| 36 | startTimer API mismatch between tests and service | Align test calls |
| 37 | bondService test uses 'battle'/'neglect' — neither key exists | Add keys or fix tests |
| 38 | No tests for spiritDecisionService, memoryGenService, gameInit | Add test specs |

---

## ROOT CAUSE: The V1/V2 Schism

**The single fix that resolves 60%+ of findings:**

Write complete v2 versions of these 5 services that currently only exist as v1 frontend code:

1. `server/services/whisperService.js` (new — C1, C7)
2. `server/services/battleArbiterService.js` (port from v1 — C5, H7, H8)
3. `server/services/spawningService.js` (port from v1 — C6)
4. `server/services/battleResolver.js` (new — H4)
5. `server/services/spawnResolver.js` (new — H4)

Each must use `./llmProxy.js` + `./memwalServer.js` (not frontend modules), `spirit.bond.depth` (not `spirit.bond_depth`), `spirit.specialization` as string (not index), and timestamp-based cooldowns (not epoch).

Then mark Section 3.4 services as **"v1 REFERENCE ONLY — use v2 server versions"**.

---

## RECOMMENDED FIX ORDER

1. **Schema fixes** (#7, 9, 10, 13, 14, 18) — 1 hour. Fix the data shapes first so everything built on top is correct.
2. **Write missing v2 services** (#1-4, 11, 12) — 3 hours. The 5 services above plus the explore handler.
3. **Contract fixes** (#15, 16, 17, 22) — 2 hours. Complete v2 contracts, add access control, fix Walrus SDK usage.
4. **Test alignment** (#6, 36, 37, 38) — 1 hour. Fix test imports and signatures to match actual APIs.
5. **Config + infra** (#5, 25, 26, 27, 28, 33, 35) — 1 hour. env vars, WS proxy, workspace config, MemWal accounts.
6. **Cleanup** (#23, 29, 30, 31, 32, 34) — 30 min. Deprecation notices, dead code removal.

**Estimated total: ~8-9 hours of PRD revision before build.**
