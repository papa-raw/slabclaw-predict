# Attack Report: Server + Config + Tests — Anima Swarm PRD

**Date:** 2026-05-14
**Scope:** Sections 3.5, 3.6, 3.8, 7.2, 7.3, 7.11, 8
**Verdict:** 7 Critical / 12 High / 11 Medium / 1 Low

---

## Critical Findings

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| C1 | `sanitizeForClient` not exported from wsService | 7.3:2285 | Add `export` keyword |
| C2 | battleResolver.js + spawnResolver.js referenced, never defined | 7.3:2351 | Write both services or inline into timerService |
| C3 | `explore` action in LLM prompt, no handler in executeDecision | 7.2:2093 | Add case 'explore' |
| C4 | Test imports non-existent functions: `classifyXP`, `getSpecialization` | 8:4766 | Align tests to actual exports |
| C5 | v1 whisperService incompatible — no `propagateWhisperServer` exists | 7.4:2587 | Write server/services/whisperService.js |
| C6 | MemWal accounts never created — `memwalAccountId: ''` everywhere | 3.8:1726 | Add createAccount + addDelegateKey to gameInit |
| C7 | Ed25519Keypair.fromSecretKey may not handle bech32 private keys | 7.4:2854 | Verify API, use decodeSuiPrivateKey if needed |

## High Findings

| # | Finding | Location | Fix |
|---|---------|----------|-----|
| H1 | startTimer API mismatch: tests pass positional args, service expects object | 8:5061 | Align test calls to service signature |
| H2 | timerService test expects duplicate rejection — service has no check | 8:5073 | Add duplicate timer check |
| H3 | Race condition: concurrent spirit decisions mutate gameState | 7.2:2116 | Serialize with for-await or mutex |
| H4 | recallMemoriesServer return shape mismatch between mock and service | 7.4:3022 | Verify MemWal recall() return type |
| H5 | Missing 5 env vars from .env.example (SUI_RPC_URL etc.) | 3.6:1563 | Add all to .env.example |
| H6 | v1 services import ./llmClient, ./memwalService — wrong paths for server | 3.4:835 | Port to ./llmProxy.js, ./memwalServer.js |
| H7 | bond_depth snake_case vs bond.depth nested — systematic v1/v2 | 3.4:1183 | Rewrite v1 services to v2 schema |
| H8 | getSpecName treats specialization as number, v2 is string | 3.4:1186 | Remove function, use spec directly |
| H9 | player.importedEssenceBlobId vs importedEssence — field mismatch | 7.11:4057 | Store blobId separately in /ready route |
| H10 | eventLog never populated — extractCoreMemories always empty | 7.11:4183 | Push events from timer resolution |
| H11 | chatRoutes (v1 /api/chat) still mounted — unauthenticated LLM proxy | 7.3:2548 | Remove from v2 server |
| H12 | bondService test uses 'battle'/'neglect' — neither key exists | 8:4843 | Add keys or fix test actions |

## Medium Findings

| # | Finding | Fix |
|---|---------|-----|
| M1 | Game state in-memory only — crash loses everything | Periodic JSON snapshot to disk |
| M2 | No WebSocket proxy in vite.config | Add '/ws': { ws: true } |
| M3 | No WS reconnection logic | Add backoff reconnect |
| M4 | Root package.json has no workspace config — test imports fail | Add workspaces or root devDeps |
| M5 | SuiJsonRpcClient import path may not be public export | Verify against @mysten/sui version |
| M6 | deploy-contracts.sh doesn't extract GAME_MAP_ID | Add jq extraction |
| M7 | setup-memwal.js disconnected from actual gameInit flow | Reconcile or remove |
| M8 | loadLineageChain unbounded depth | Cap at N=20 |
| M9 | battleArbiter.test.js wrong call signature | Align to actual API |
| M10 | spiritDialogue.test mock doesn't chain for extractDeityIntent | Chain mock returns |
| M11 | No tests for spiritDecisionService, memoryGenService, gameInit | Add test specs |
