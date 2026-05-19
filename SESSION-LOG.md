# Session Log

### Session Log — 2026-05-15
- Expanded from 5 to 6 AI teams, spawned equidistant on hex grid with distinct colors
- Rewrote SpiritSprite with frame-based animation system (8fps retro feel):
  - WALK_FRAMES: 4 frames cycling leg positions + body bounce
  - ATTACK_FRAMES: 4 frames weapon rotation + body lunge + class-specific effects
  - IDLE_FRAMES: 2 frames subtle bounce
  - Per-class attack effects: warrior sword gleam, scout arrow projectile, gatherer orb burst, sage magic explosion, generalist sword gleam
- Wired CSS `style.transform` with `transition: 0.6s ease-in-out` for smooth hex-to-hex movement (replaces instant SVG `transform` attribute jumps)
- Movement detection via prevHexPositions ref — compares hexId between renders, sets facing direction from hex delta
- Removed old `<animateTransform>` idle bob in favor of frame-driven idle animation
- Fixed whisper system (deity → spirit chat working end-to-end)
- Added spirit-to-spirit autonomous dialog via spiritDecisionService (spirits provoke dialog with each other)
- Added Chronicle tab in CommandBar showing spirit_dialog events
- Added onboarding hints overlay (3-step tutorial)
- Added scroll-wheel zoom with zoom-to-cursor math, drag pan
- Added SVG terrain detail rendering per hex type
- Added LLM proxy with model routing (Kimi K2.5 for battles, DeepSeek V3 for dialog)
- Tabbed right panel (Spirit / Chronicle / Chain tabs)
- Cleaned up unused downloaded sprite sheet (characters.png)
- **Remaining:** Battle animations need live testing (spirits must encounter each other), spawn animation untested, no deployment this session

### Session Log — 2026-05-16
- A* pathfinding on hex grid with terrain costs (mountain=2, tundra/volcanic=1.5, ocean=blocked)
- Persistent deity orders: `_deityOrder` on spirit survives across 30s decision cycles, resolved by name via pathfinding
- Full map roster injected into LLM decision prompt (all spirits with team/distance/specialization/action)
- Click reliability fix: pointer capture only after >4px drag threshold, clicks pass through to spirits
- Speech bubbles via React state + SVG rect/text, populated from action changes AND dialog events
- LLM rate limiting: 50/min cap, priority system (user chat=high, background=normal), retry with 3s×attempt backoff on 429
- Avatar caching: blob IDs persisted to `_data/avatars.json` on generation, restored on game init — survives server restarts
- Minimap of controlled hexes (bottom-right corner)
- Tick timer showing 30s decision cycle countdown (top-left)
- Sidebar avatars for owned spirits (5x5 rounded images)
- Clickable memory count → SuiScan object explorer link
- Larger chronicle and speech bubble text
- LineageSection component for past life display
- **Fixed:** Speech bubbles invisible (LLM 429s silently killing dialog, switched to action-driven + event-driven rendering)
- **Fixed:** Spirits unclickable (setPointerCapture in pointerDown redirected all events to SVG container)
- **Fixed:** 429 rate limit from Windfall (added proactive throttling + retry backoff)
- **Remaining:** Avatar cache is empty (first run of new feature) — avatars will regenerate on next game start and persist from then on
- **DESIGN SESSION:** Full mechanics redesign discussion (see plan file). Key decisions:
  - Memories ARE power (replaces XP entirely)
  - Whisper economy: 3 charges, regen 1/cycle
  - 15-min timed scoring games
  - Swarm posture emergent from behavior (centralized/decentralized, aggressive/territorial, coordinated/autonomous)
  - Whisper-guided specialization (words shape what spirits become)
  - Enemy swarm whispers + resistance stat (deity psychological warfare)
  - Bond = swarm-level cohesion, not per-spirit
  - HP memory-derived
  - Open: memory value formula (linchpin), scoring weights, HP numbers

### Session Log — 2026-05-16 (evening)
- **UI legibility pass:** Bumped design system vars (--text-secondary → #c9cdd4, --text-muted → #9ca3af), swept all 11 components to eliminate text-[9px]/text-[10px]/text-[11px] and replace text-gray-600/700 with lighter values
- **EssenceImport:** Removed accordion toggle, content always visible, bumped to text-sm with design system color vars
- **Speech bubbles fix:** Added `spirit_dialog` event emission in POST /chat handler — bubbles now appear above spirits when player chats
- **Rate limit fix:** Added `_priority: 'high'` to whisperService LLM calls (whisper generation + intent extraction) so they bypass 50/min background cap during player chat flow
- **Enemy spirit diplomacy:** New `chatWithEnemySpirit()` function — deities can whisper to opposing spirits. Response shaped by loyalty stat (75+=hostile, 50-74=suspicious, 25-49=wavering, 0-24=disloyal). Each interaction erodes loyalty by 1. Frontend shows red-themed "Influence" input for enemy spirits.
- **OnchainFooter:** New component showing Sui network status, Walrus publisher, MemWal relayer links
- **Lobby redesign:** Rewritten layout with spirit cards, deity counter, wallet connect placement
- **Remaining:** Lobby UI tweaks from plan (deities counter above title, "Sui Overflow 2026" to footer), wallet connection infrastructure (wallet→player slot claim system)

### Session Log — 2026-05-19
- **WindfallRouter 502 fix:** nginx on Hetzner (46.225.135.67) had `proxy_pass` to port 3403, app on 3402. Fixed via sed + nginx reload.
- **Spirit aggression overhaul:** DECISION_INTERVAL 30s→15s, prompt rewritten with "NEVER idle" bias, EXPLORE first / WAIT last (DISCOURAGED), `pickMoveTarget()` all personalities now prioritize unclaimed/enemy over own territory, `wait` case fallbacks to `fallbackMove()`
- **Rally command system:** `POST /api/game/command` + `issueRallyCommand()` — click hex to rally all player spirits. Cancels in-progress movements, persistent `_rallyHexId` on deity order, A* pathfinding per step. Rally continuation block at top of `decideSpiritAction()` skips LLM entirely when rally active. Visual: pulsing hex outline + chevron + ATTACK/CAPTURE/REGROUP label.
- **OnchainFooter simplification:** Three availability dots (Sui testnet — Package, Walrus testnet — Memory Registry, LLM — Windfall Router), only second part is link
- **WalletConnect consolidation:** Single button with truncated address + logout icon, hover turns red
- **Lobby wallet gate:** Awaken button disabled without `walletAddress`, server-side guard on `/ready` returns 400 if no wallet. `gameInit` changed `connected: isHuman` → `connected: false` so counter shows 0/6 until wallet connect.
- **Exit-to-lobby:** `POST /api/game/exit` sets `player.connected = false`, preserves walletAddress. App.jsx shows Lobby when player disconnected during active game. Exit button in game header. `claim-slot` reordered to allow returning players during active games.
- **HexMap click handling:** `onClick` on hex `<g>` elements with drag guard, rally point state with 4s auto-clear
- **TickTimer:** Updated from 30s to 15s decision cycle display
- **HP damage system:** Replaced instant death (margin >= 8) with HP bars in `battleResolver.js`. Spirits at 100HP. Loser takes `15 + margin*3`, winner takes `max(3, 10 - margin)` chip damage. Death at HP <= 0. HP bars on map above spirits (green/yellow/red gradient), hidden at full HP.
- **Auto-engage battles:** Spirits moving onto enemy-occupied hexes auto-trigger 30s battles in `timerService.js`. Both attacker/defender set to 'battling'. No more walking through enemies.
- **Pause system:** Space toggles pause. `pauseGame()`/`resumeGame()` in tickEngine, POST `/api/game/pause` and `/resume` routes. Frosted overlay "Press Space or click to resume". Pause/Resume + Exit buttons in game header.
- **Dialog feed overlay:** Replaced SVG speech bubbles (unreadable, overlapping, markdown artifacts) with HTML floating feed at bottom-left of HexMap. Last 5 messages, team-color left border (`pc`), warm bg for own spirits, cool bg for enemies. Markdown `**` stripped.
- **Speaking indicator dot:** Pulsing circle above speaking spirit, color = `pc` (team color), consistent with feed card accent.
- **Loading screen:** Gold animated loading bar + pulsing logo while connecting to game server.
- **Game over screen:** Design system colors, victory glow, "Start New Game" button, EssenceExport integrated.
- **EssenceExport redesign:** Gold design system, gradient export button, yellow warning "only way to bring spirits back", green confirmation copy button.
- **DevWallet context:** `frontend/src/lib/devWallet.jsx` for CLI testing. WalletConnect shows "Dev Connect" text input when no browser wallets detected. DevWalletProvider wraps App in main.jsx.
- **Fixed:** React hooks ordering — isPaused useEffect after early returns caused "Rendered more hooks" crash. Moved above all returns.
- **Remaining:** Demo video, project logo, submission description, website. Mechanics redesign (memory-as-power) unimplemented.
