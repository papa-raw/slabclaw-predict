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
