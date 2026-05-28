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

### Session Log — 2026-05-20
- **Whisper system:** `WhisperBar.jsx` — swarm decree + enemy whisper with 2 charges per 30s cycle. `whisperService.js` with `broadcastSwarmWhisper()` and `broadcastEnemyWhisper()`. Enemy resistance mechanic (4 tiers: ignored/eroded/influenced/defected). "Chosen by god" name-drop targeting. Charge reset in tickEngine every 6th tick.
- **Soul mining economy:** Replaced "memory harvesting" with soul mining. `memoryGenService.js` rewritten: 3% spawn chance per hex (was 10%), 8-19 energy per deposit (was 2-5), cap 80. Spawning costs 10 memories (`MIN_MEMORIES=10` in spawningService, deducted in spawnResolver). Gatherers renamed to soul miners in decision prompts.
- **Soul deposit visualization:** SVG particle layer on HexMap — pulsing teal circles scaled by pool intensity, replacing plain text overlay. Hex tooltip changed to "soul energy".
- **SpiritPanel overhaul:** Removed chat input (whispers now swarm-level). Added XP/bond stat tooltips (`cursor-help` + `title`). Added expandable MemWal memory recall section with `GET /api/game/spirit/:id/memories` endpoint.
- **Target hex highlights:** Pulsing dashed outlines on hexes spirits are moving/exploring toward, player-colored with glow filter. Removed "Moving..."/"Exploring!" speech bubble labels.
- **Dialog feed improvements:** Cards clickable to open spirit info panels. Three dialog types (DECREE/ENEMY_WHISPER/TAUNT) with distinct styling. Fixed deity decree events for non-spirit sourceIds.
- **HP bars repositioned:** Moved above spirit heads (barY=-35, was -27).
- **Deity naming fix:** All 6 players get random deity names from pool (removed hardcoded "You" for player-1).
- **Enemy dropdown fix:** WhisperBar filter removed `connected !== false` check — AI bot players now appear as selectable targets.
- **Docs rewritten:** `frontend/public/docs/index.html` updated with all current mechanics (whisper system, soul mining, enemy resistance tiers, spawning costs, XP/bond descriptions, game timing).
- **Vite docs route:** Added middleware plugin to rewrite `/docs/` → `/docs/index.html` before SPA fallback.
- **Remaining:** Player name selection (lobby input), stats bars deeper revisit, target hex highlight browser verification, demo video, submission.

### Session Log — 2026-05-28
**Memory-centric pivot — all 6 phases completed on `memory-pivot` branch (worktree).**

Core changes (17 files, +920/-777 lines):
- **memoryEngine.js (NEW):** Structured memory schema (BATTLE/DECREE/SCOUT/BETRAYAL/ALLIANCE/DEATH_WITNESS/ENCOUNTER), `createMemory()`, `computeBehaviorRules()` (grudges, confidence, fears, traumaTerrain, insubordinate, veteranBonus), `serializeForWalrus()`/`deserializeFromWalrus()`.
- **gameInit.js:** 6 captains per player (was 3), 12 swarmlings kept → 108 total spirits. Added `memoryLedger: []` and `behaviorRules: null` to captain struct. Removed heroTitle/heroAbility/promotionXP. Reduced ghosts from 5→2.
- **winService.js:** 96 ticks (~8 min, was 500/~42 min), 45% territory win (was 50%).
- **tickEngine.js:** Removed promotionService import and checkPromotions call.
- **spiritDecisionService.js (complete rewrite, 450 lines from 821):** Decision interval 8s (was 15s). Fully deterministic priority pipeline: Rally→GRUDGE same hex→FEAR retreat→TRAUMA insubordination→Battle current→GRUDGE adjacent→DEITY ORDER→SPAWN→Personality fallback. Template-based dialog (no LLM). Movement speeds: scout 6s, normal 10s.
- **battleArbiterService.js (complete rewrite):** Stat-based combat (bondAvg + combatXP + specBonus + tierBonus + affinityBonus + memoryBonus). Zero LLM calls.
- **battleResolver.js:** Creates structured BATTLE WIN/LOSS and DEATH_WITNESS memories for captains after each battle.
- **spawningService.js + spawnResolver.js (complete rewrite):** Costs 5 memories from captain's ledger (memory economy), 60s duration, no LLM calls. Deterministic child traits.
- **whisperService.js:** Creates DECREE memories (friendly) and ENCOUNTER memories (enemy) for captains.
- **game.js routes:** Auto-load captain memories from Walrus on ready (Spirit NFT query). Auto-persist captain memory ledgers to Walrus blobs on end-persist. New `/api/game/spirit/:id/memories` endpoint.
- **SpiritPanel.jsx:** Behavior rules display (GRUDGE/CONFIDENT/FEARS/TRAUMA/INSUBORDINATE/VETERAN badges). Color-coded memory timeline. Fixed API field name bug (d.memories → d.memoryLedger). Removed PROMOTION_THRESHOLDS import.
- **PlayerHud.jsx:** Removed hero tier references, added captain memory count to stats.
- **HexMap.jsx:** Removed hero tier filter, veteran captains (5+ memories) scale 1.1x.
- **App.jsx:** Game-over screen shows memory ledger summary (grudges, trauma, fears formed), captain memory blob persistence to Walrus with WalrusScan links, "Play Again — memories will auto-load" button, countdown timer in header.
- **OnchainFooter.jsx:** Replaced Windfall Router link with live captain memory count.

Live-tested full game loop:
- 108 spirits spawned on 169-hex map
- 53 captain memories created across 8-minute game
- Behavior rules computed correctly (grudges, fears, trauma terrain avoidance, veteran bonuses)
- Game ended at tick 96 with territory-based winner
- Zero LLM calls during gameplay (all deterministic)

**Bug fixed:** SpiritPanel `d.memories` → `d.memoryLedger` (API field name mismatch — memories never loaded from API endpoint).

**Remaining:** Merge `memory-pivot` branch back to main. Activate real MemWal/Walrus testnet (currently mock). Demo video (5 min max). Submission materials for Sui Overflow.

### Session Log — 2026-05-28

**Memory Event Broadcasting + UX Overhaul**

Added live memory event system:
- `memoryEngine.js` — `detectDramaticChanges()` emits `GRUDGE_FORMED`, `FEAR_ACQUIRED`, `TRAUMA_ACQUIRED`, `INSUBORDINATE` events
- `tickEngine.js` — flushes `_pendingMemoryEvents` to broadcast each tick
- `wsService.js` — `memory_event` added to `PERSIST_TYPES`, `_pendingMemoryEvents` stripped from client state
- `MemoryBanner.jsx` (NEW) — 7s transient toasts for dramatic events, color-coded by type
- `MemoryTimeline.jsx` (NEW) — scrolling event feed with stats bar, filters (All/Dramatic/My Swarm), dedup, Walrus footer

UX adversarial review (9 findings, all fixed):
1. [CRITICAL] Header Walrus counter — persistent "🧠 N memories | Walrus" always visible
2. [HIGH] Memory tab defaults when no spirit selected (was empty Spirit panel)
3. [HIGH] Memory tab badge shows dramatic event count
4. [HIGH] Onboarding hints rewritten for Walrus Track judges
5. [MEDIUM] Banner duration 4s → 7s
6. [MEDIUM] "Chain" → "Onchain" tab rename
7. [MEDIUM] Timer now shows "⏱ X:XX left"
8. [LOW] Empty dramatic filter contextual copy
9. [LOW] Walrus footer restyled with 🦭 branding

VFX toning (second pass):
- Canvas explosions: captain 0.45 (was 1.0), swarmling 0.3 (was 0.6), promo 0.6 (was 1.5)
- SVG effects: impact flash r 1→10 (was 2→22), ring r 3→14 (was 4→30), fatal r 5→18 (was 8→35)
- Sparks: 4 at distance 10 (was 6 at distance 20), crossed swords 5px (was 8px)

SpiritPanel improvements:
- Memory ledger default-open for captains
- 🧠 + WALRUS label on memory section header

Docs updated: README rewritten for memory-centric pivot, project memory updated.

**E2E verified:** Full game recording with Playwright, all 7 steps complete, screenshots confirm all UX fixes render correctly.

### Session Log — 2026-05-28 (late evening)

**Walrus Testnet Activation + Bug Fix**

- **Created `.env`** with `WALRUS_NETWORK=testnet` — Walrus blob storage now hits real testnet (publisher.walrus-testnet.walrus.space)
- **Fixed critical bug in `game.js` end-persist:** `storeEssence()` returns a plain string blobId, but code checked `blobResult?.blobId` (always undefined). Captain memory blobs were silently never recorded. Fixed: `const blobId = await storeEssence(serialized)` + `if (blobId)`.
- **Verified full Walrus testnet pipeline:**
  - Direct curl store + read: confirmed working
  - Server startup: `Walrus: testnet` mode logged
  - Game run: battles generate structured captain memories (BATTLE WIN/LOSS, DEATH_WITNESS)
  - End-persist: 6 captain memory blobs stored to real Walrus testnet
  - Read-back: verified blob content from aggregator (structured memory ledger with behaviorRules)
  - Avatar blobs also storing to Walrus testnet (image/webp)
  - Roster essence blobs storing to Walrus testnet (~10KB per spirit)
- **MemWal:** Still in local cache mode (needs `MEMWAL_DELEGATE_KEY` + `MEMWAL_ACCOUNT_ID` from setup-memwal.js). Not critical for Walrus Track — the captain memory blob storage IS the Walrus integration.
- **Sui onchain calls:** Failing as expected (spirits use game-internal IDs, not real NFT addresses). Doesn't affect Walrus storage.
- **Production readiness audit:** 3-agent parallel scan found 5 critical, 4 high, 4 medium issues. Key: all Sui NFT calls fail (wrong Move function targets + game IDs instead of Sui object IDs), cross-game memory loop broken (blobId never written back to NFT), MemWal per-spirit writes dead code (keyStore never populated), ghost recruit 404 (wrong API path), hero tier invisible on map.
- **Committed + pushed** `memory-pivot` branch to `origin` (a165ef6). 20 files, +813/-249.
- **Remaining:** Demo video (5 min max), submission materials, optional MemWal testnet activation. See production audit for full buildout plan (Phases 1-4).
