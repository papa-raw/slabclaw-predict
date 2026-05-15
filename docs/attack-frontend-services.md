# Attack Report: Frontend + Services — Anima Swarm PRD

**Date:** 2026-05-14
**Scope:** Sections 3.2, 3.4, 7.4, 7.5, 7.6
**Verdict:** 8 Critical / 10 High / 11 Medium / 2 Low

---

## Immediate Build Crashers (fix before build)

1. **No server-side whisperService** — spiritDialogueService imports `propagateWhisperServer` which doesn't exist. The only whisperService is v1 frontend code.
2. **sanitizeForClient not exported** — wsService defines it but doesn't export it; game.js imports it.
3. **WalletConnect.jsx and PlayerHud.jsx never specced** — App.jsx imports both, no implementation anywhere.

## Critical Findings

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| C1 | No server whisperService, `propagateWhisperServer` missing | 7.4:2587 | Write `server/services/whisperService.js` using llmProxy + memwalServer |
| C2 | `spirit.delegateKey` read but never on SpiritState (lives in keyStore) | 7.2:2140 | Import `getKey(spirit.id)` from keyStore.js |
| C3 | `sanitizeForClient` not exported from wsService | 7.3:2285 | Add `export` keyword |
| C4 | `gameState.gameId` doesn't exist — schema has `gameState.id` | 7.11:4075 | Replace `.gameId` with `.id` |
| C5 | battleArbiterService uses `spirit.bond_depth` (snake_case) — v2 is `spirit.bond.depth` | 3.4:1183 | Rewrite against v2 SpiritState schema |
| C6 | spawningService uses snake_case + epoch cooldowns — incompatible with v2 | 3.4:1211 | Rewrite with timestamp cooldown, nested bond fields |
| C7 | SpiritState missing 8 fields used by gameInit + essenceService | 7.1:1957 | Add kills, hexesClaimed, whispersReceived, etc. to schema |
| C8 | WalletConnect.jsx and PlayerHud.jsx — no specs provided | 3.1:298 | Write component implementations |

## High Findings

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| H1 | memwalService cache key ignores accountId — cross-spirit contamination | 3.4:796 | Cache by `${namespace}-${accountId}` |
| H2 | Data flow trace (3.7) describes v1 client arch, not v2 server-authoritative | 3.7:1662 | Delete or rewrite for v2 |
| H3 | Frontend battleArbiterService/spawningService unused in v2 — no server equivalents exist | 3.4:1052 | Write server-side versions |
| H4 | battleResolver.js and spawnResolver.js referenced but never specced | 7.3:2350 | Write both services |
| H5 | HexMap biome label truncates to 6 chars — "Central Plains" → "Centra" | 7.6:3345 | Use terrain type or icon instead |
| H6 | Race condition: HTTP /api/game/state can overwrite newer WS state | 7.5:3149 | Remove HTTP fetch, use WS initial state |
| H7 | player.importedEssenceBlobId and player.peakHexes not in Player schema | 7.11:4057 | Add to schema, update /ready route |
| H8 | PLAYER_COLORS keyed "player-1" but playerId is wallet address when connected | 7.7:3667 | Map wallet → internal index for colors |
| H9 | memoryClassifier.js never called — spirits can't specialize | 7.4:2804 | Wire into timerService after XP changes |
| H10 | Section 3.4 is ~600 lines of dead code in v2 (5 frontend services unused) | 3.4:786 | Deprecate or remove |

## Medium Findings

| # | Finding | Fix |
|---|---------|-----|
| M1 | Design system CSS vars defined but components hardcode Tailwind | Wire Tailwind to CSS vars |
| M2 | index.css not specced — Tailwind directives missing | Add file with @tailwind + :root vars |
| M3 | dapp-kit CSS import path unverified | Check against v1.0.6 |
| M4 | CommandBar timer filter misses incoming enemy battles | Check timer.data.defenderId |
| M5 | v2 spawningService still uses epoch cooldown | Replace with timestamp |
| M6 | No lastSpawnAt field on SpiritState | Add to schema |
| M7 | @lib alias is frontend-only — document for server code | Note relative paths for server |
| M8 | bondService.js header missing server/ prefix | Fix path |
| M9 | No WebSocket reconnection logic | Add backoff reconnect |
| M10 | Lobby starts game at 1 player — lobby screen useless | Document or change threshold |
| M11 | v1 frontend services need explicit deprecation notice | Mark dead code |

## Root Cause

**The v1/v2 schism.** Section 3.4 defines frontend services with v1 conventions (snake_case, client-side, epoch-based). Section 7 redefines everything server-authoritative with nested objects and real-time timers. The PRD claims five v1 services "stay" without acknowledging structural incompatibility. A cold agent building both sections produces code that compiles but silently fails at runtime.
