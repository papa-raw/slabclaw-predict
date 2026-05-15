# Attack Report: Contracts + Data Flow — Anima Swarm PRD

**Date:** 2026-05-14
**Scope:** Sections 3.3, 3.7, 7.1, 7.9
**Verdict:** 7 Critical / 7 High / 3 Medium-Low

---

## Critical Findings

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| C1 | Bond field split: `bond_depth` (v1/Move) vs `bond.depth` (v2 JS) | 3.3:427 vs 7.1:1966 | Standardize — rewrite v1 services to v2 shape |
| C2 | hexId type mismatch: `hexId()` returns string, Move expects u64 | 3.3:430 vs hexMath:1403 | Return number from hexId(), or parseInt in suiService |
| C3 | Specialization: u8 in Move vs string enum in v2 GameState | 3.3:427 vs 7.1:1961 | Add mapping utility for u8↔string conversion |
| C4 | `buildSpawnTx` is a documented stub — no implementation | 3.4:1039 | Write complete tx.moveCall sequence for spawn |
| C5 | No access control on Move contracts — any address can kill/claim/update | 3.3:620 | Add AdminCap param or rely on Sui object ownership model |
| C6 | `spirit::mint()` v1 returns Spirit, v2 transfers internally — incompatible | 3.3:459 vs 7.9:3913 | Provide complete v2 spirit.move code |
| C7 | No server whisperService — `propagateWhisperServer` doesn't exist | 7.4:2587 | Write server/services/whisperService.js |

## High Findings

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| H1 | SpiritState missing 8 fields used by essenceService + gameInit | 7.1:1957 | Add kills, hexesClaimed, whispers*, reincarnation*, memorableActions |
| H2 | WalletConnect.jsx + PlayerHud.jsx imported but never specced | 7.5:3119 | Write component implementations |
| H3 | `explore` action in LLM prompt but no handler in executeDecision | 7.2:2093 | Add case 'explore' to switch |
| H4 | Data flow trace (3.7) describes v1 frontend arch, not v2 server | 3.7:1664 | Mark SUPERSEDED or rewrite |
| H5 | birth_epoch hardcoded to 0 in v1, v2 says use tx_context::epoch | 3.3:485 vs 7.9:3916 | Provide corrected code |
| H6 | v2 real-time timers vs Move epoch-based cooldowns — conceptual mismatch | 7.2 vs 3.3:729 | Bridge with synthetic epoch counter or timestamp contract |
| H7 | `battle::record_battle` return vs transfer conflict (same as mint) | 3.3:683 vs 7.9:3914 | Provide complete v2 battle.move |

## Medium/Low

| # | Finding | Fix |
|---|---------|-----|
| M1 | `mood` field in Move contract but absent from v2 schema/services | Remove from contract or add to schema |
| M2 | `territory::create_map` + `init()` both create GameMap | Remove create_map (init handles it) |
| M3 | memwalService cache key collision (namespace only, ignores accountId) | Cache by `${namespace}-${accountId}` |
| M4 | Move abort codes not mapped to user-facing errors | Add error mapping utility |
| M5 | `memwalService.restore()` may not exist in SDK | Verify or replace with recall |
| M6 | spawningService.executeSpawn uses parent accountId for child | Create child MemWal account first |
| M7 | Vite config has no WebSocket proxy | Add ws proxy for /ws |

## Root Patterns

1. **No complete v2 contracts** — Section 3.3 has full v1, Section 7.9 has bullet fixes, nowhere has the merged result
2. **Bond field naming** ripples through every service computing bond averages
3. **Frontend vs server ambiguity** — v1 services labeled "stays" but architecture is server-side in v2
