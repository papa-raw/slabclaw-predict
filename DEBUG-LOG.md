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
