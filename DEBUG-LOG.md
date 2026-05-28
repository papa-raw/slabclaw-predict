# Debug Log

### 2026-05-19 — WindfallRouter 502 Bad Gateway
**Symptom:** LLM calls via windfall provider returning 502
**Root cause:** nginx on Hetzner (46.225.135.67) had `proxy_pass` to port 3403, but the Node app listens on port 3402
**Fix:** `sed` on `/etc/nginx/sites-enabled/windfallrouter` to change 3403→3402, `nginx -s reload`
**Mechanism:** nginx could reach itself but not forward to the backend — port mismatch meant the upstream was unreachable

### 2026-05-19 — Spirit rallied in wrong direction
**Symptom:** After issuing a rally command, one spirit moved away from the target hex
**Root cause:** Rally only dispatched idle spirits (`!spirit.currentAction`). Spirits mid-move from prior autonomous decisions were skipped, continuing their old trajectory
**Fix:** `issueRallyCommand()` cancels in-progress movement timers (filters `gameState.activeTimers`), clears `currentAction`, then redirects. Only cancels `moving`/`exploring` types, not battles/spawns.
**Mechanism:** Without cancelling existing movement, the spirit completed its old pathfinding step before the rally could redirect it on the next tick

### 2026-05-19 — Game enterable without wallet connection
**Symptom:** Player could enter the game (click Awaken) without connecting a wallet first. Deity counter showed 1/6 immediately.
**Root cause:** Two gaps: (1) `gameInit.js` set `connected: isHuman` (true for player-1) instead of `connected: false`, (2) `POST /ready` endpoint had no wallet check before setting `player.connected = true`
**Fix:** Changed `connected: false` for all players in gameInit. Added `if (!player.walletAddress) return 400` guard on `/ready`. Disabled Awaken button in Lobby when no walletAddress.
**Mechanism:** Both frontend (disabled button) and server (400 rejection) now enforce wallet connection before game entry

### 2026-05-19 — "Rendered more hooks" crash on game load
**Symptom:** White screen with React error "Rendered more hooks than during the previous render" when transitioning between lobby and game states
**Root cause:** `isPaused` derived state and its `useEffect` (keyboard listener for Space) were placed AFTER early `return` statements for lobby/finished/loading screens in App.jsx. React requires identical hook count on every render.
**Fix:** Moved `const isPaused = gameState?.status === 'paused'` and the `useEffect` for keyboard handling above all early returns
**Mechanism:** When gameState transitioned from lobby to active, the component rendered past the early returns for the first time, encountering new hooks that didn't exist in the previous render

### 2026-05-28 — SpiritPanel memory API field mismatch
**Symptom:** Clicking "show memories" on a spirit loaded nothing from the API — always showed "No memories yet" even for captains with memories
**Root cause:** API returns `d.memoryLedger` but SpiritPanel read `d.memories` — undefined always fell back to `[]`
**Fix:** Changed `d.memories` to `d.memoryLedger` in the fetch handler (SpiritPanel.jsx line 58)
**Mechanism:** The structured memory ledger was inline in the game state (from WebSocket updates) so the timeline display worked — only the API-fetch fallback path was broken

### 2026-05-28 — End-persist blobId silently discarded
**Symptom:** Captain memory blobs stored to Walrus successfully but `memoryBlobs` array in persist results always had `blobId: undefined`
**Root cause:** `storeEssence()` returns a plain string blobId. Code destructured as `const blobResult = await storeEssence(serialized)` then read `blobResult?.blobId` — string has no `.blobId` property.
**Fix:** Changed to `const blobId = await storeEssence(serialized)` + `if (blobId)` direct use
**Mechanism:** JavaScript string primitives silently return `undefined` for arbitrary property access — no error thrown, blobId was always stored but never recorded in the response

### 2026-05-28 — Cross-game persistence loop broken (no NFT link-back)
**Symptom:** Captain memories stored to Walrus at game end but never loaded at game start — cross-game persistence didn't work
**Root cause:** Design assumed blobIds would be written to Spirit NFT's `essence_blob_id` field, but NFT minting itself was failing (wrong Move entry function + game IDs instead of Sui object IDs)
**Fix:** Added local captain blob index (`_data/captain-blobs.json`) as a persistent fallback keyed by wallet address + spirit name. Written at end-persist, read at game ready.
**Mechanism:** Bypasses the broken NFT→blobId link entirely. Local file persists across server restarts. Full NFT path can be restored later when Sui minting is reliable.

### 2026-05-28 — Ghost recruit always 404
**Symptom:** Clicking "Recruit" on a ghost spirit in SpiritPanel always returned 404
**Root cause:** Frontend POST to `/api/ghost/recruit` but server route is mounted at `/api/game/ghost/recruit`
**Fix:** Changed path in SpiritPanel.jsx fetch call
**Mechanism:** Express route hierarchy nests ghost routes under `/api/game/` prefix

### 2026-05-28 — Hero tier spirits invisible on map
**Symptom:** After promotion VFX, promoted spirits vanished from the hex map
**Root cause:** HexMap.jsx filtered visible spirits with `s.tier === 'captain'` — hero tier was excluded
**Fix:** Changed filter to `s.tier === 'captain' || s.tier === 'hero'`
**Mechanism:** Promotion changes tier from 'captain' to 'hero' but the rendering filter only checked for 'captain'

### 2026-05-28 — MemWal per-spirit writes were dead code
**Symptom:** No per-spirit memories were ever written to MemWal despite the SDK being initialized
**Root cause:** `memoryEngine.js` guarded MemWal writes with `if (key) { storeMemoryServer(...) }` where `key` came from `keyStore.getKey(spirit.id)`. But `keyStore.setKey()` was never called during game lifecycle — the store was always empty.
**Fix:** Removed the `getKey` guard entirely. MemWal writes are now unconditional. Errors caught and logged only when `isRealMemwalMode()` is true.
**Mechanism:** The keyStore was designed for a per-spirit encryption key model that was never implemented. The guard was always false, making all MemWal writes dead code.
