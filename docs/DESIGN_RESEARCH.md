# Anima Swarm -- Design Research

**Date:** 2026-05-14
**Target:** Sui Overflow 2026 Walrus Track
**Aesthetic:** Mythic/ancient + bioluminescent (illuminated manuscripts meet deep-sea bioluminescence)

---

## 1. Mood Board -- Visual References by Category

### 1A. Hex Terrain Textures

**Core direction:** Painterly, hand-drawn hex textures. NOT photorealistic, NOT pixel art. Think watercolor washes with ink outlines and bioluminescent accents.

| Reference | Source | Pattern Extracted |
|-----------|--------|-------------------|
| David Baumgart Hex Tile Set | [dgbaumgart.itch.io](https://dgbaumgart.itch.io/hex-and-tile-terrain-sample-set) | Hand-painted 2D terrain hexes with organic brush strokes. Tiling approach: each hex has a base texture with edge-blending system. Key insight -- hexes use layered watercolor washes, not flat fills. |
| Armello Board Tiles | [armello.com](https://armello.com/) | Dark fantasy hex board with painterly terrain. Hexes have internal texture variation (grass tufts, rock formations) that break up visual monotony. Terrain types read instantly at zoom-out through color temperature. |
| Pentiment Environment Art | [gamedeveloper.com](https://www.gamedeveloper.com/art/deep-dive-the-art-of-pentiment) | Illuminated manuscript approach: flat perspective, rich hand-drawn detail, ink outlines with interior color fills. No 3D perspective -- everything reads as a decorated page. Directly applicable to our "illuminated manuscript" direction. |
| Dorfromantik Hex Landscapes | [Steam](https://store.steampowered.com/app/1455840/Dorfromantik/) | Relaxing hex placement game with soft, painterly terrain. Proves hex tiles can feel organic and hand-crafted at small scale. Edge transitions between terrain types use gradient blending. |
| Ori & the Blind Forest Environments | [wyattcoe.com](https://www.wyattcoe.com/blog/ori-review) | Layered parallax with rich color depth. Dark backgrounds with bioluminescent foreground elements. The glow-on-dark principle is directly applicable to our terrain accents. |

**Technique for Anima Swarm:** Generate base hex textures as 256x256 painterly tiles using Flux with a "watercolor wash with ink border" style prefix. Each terrain type gets a unique color temperature + one signature bioluminescent accent element (glowing roots for Sacred Grove, lava veins for Volcanic Rift, etc.).

---

### 1B. Spirit Creature Portraits

**Core direction:** Illustrated character portraits with strong silhouettes. Hades-style portraiture (pen-and-ink foundation with selective color) crossed with James Jean's mythic layering and Moebius's creature anatomy.

| Reference | Source | Pattern Extracted |
|-----------|--------|-------------------|
| Hades Character Portraits (Jen Zee) | [pointnthink.fr](https://www.pointnthink.fr/en/the-art-of-hades-en/) | Pen-and-ink line art as foundation, then selective cel-shading with hard edge shadows. Characters are posed dynamically with a "larger-than-life" energy. Key palette technique: limited color per character (2-3 dominant hues) against dark backgrounds. 59 portraits shipped in Hades. |
| Hades Production Pipeline (MCV) | [mcvuk.com](https://mcvuk.com/business-news/behind-the-art-of-hades-we-value-artistic-integrity-and-excellence-in-artistic-craft-at-supergiant-however-were-first-and-foremost-a-game-design-lead-team/) | Ink-based workflow chosen deliberately because "making assets in pen and ink goes much faster than painterly work." Strong influence from Mike Mignola (Hellboy) and Fred Taylor (poster art). Characters use high-contrast silhouettes with rim lighting in accent colors. |
| James Jean Mythic Illustration | [instagram.com/jamesjeanart](https://www.instagram.com/jamesjeanart/) | Layered mythic scenes with intertwining organic forms. Creatures emerge from and merge with their environments. Color palettes shift across warm/cool gradients within a single piece. Applicable to our spirit portraits -- creatures should feel like they ARE their terrain, not just standing on it. |
| Moebius Creature Design | [characterdesignreferences.com](https://characterdesignreferences.com/artist-of-the-week-3/moebius) | Precise linework with surreal anatomy. Creatures feel plausible despite being impossible. Key technique: clear anatomical logic even in fantastical forms. Every limb, joint, and surface has a consistent internal logic. |
| Armello Character Portraits | [artstation.com](https://www.artstation.com/artwork/OvxzVg) | Anthropomorphic character portraits for a hex strategy game. Each character has a distinct silhouette, faction color coding, and personality-driven pose. Portrait format: bust/shoulder crop with decorative frame border. |

**Technique for Anima Swarm:** Each spirit gets a portrait in bust/shoulder format (512x512 or 768x768). Consistent style: dark background, creature in 3/4 view, 2-3 dominant hues per creature matching their terrain affinity, bioluminescent accent glow as rim lighting. Strong silhouette reads at thumbnail size for hex tile overlays.

---

### 1C. UI Chrome/Panels

**Core direction:** Hades meets Civilization but through an Art Nouveau/illuminated manuscript lens. Ornamental frames with organic curves, not geometric/sci-fi chrome. Dark surfaces with gold and bioluminescent accent borders.

| Reference | Source | Pattern Extracted |
|-----------|--------|-------------------|
| Cultist Simulator Card Interface | [cultistsimulator.com](https://weatherfactory.biz/cultist-simulator/) | Cards-as-primary-UI-element on a dark workspace. Minimal chrome -- the content IS the interface. Tooltip-heavy, hover-for-details pattern. Dark parchment backgrounds with hand-drawn iconography. |
| Darkest Dungeon HUD | [youtube.com](https://www.youtube.com/watch?v=onm8lIWBMEE) | Ornate Gothic panel frames. Resource bars embedded in decorative borders. Key pattern: bottom-screen action bar with character portraits, top-screen resource/status bar. Tooltips use parchment backgrounds with ink-style text. Strong hierarchy through ornamental framing weight. |
| Slay the Spire Card UI | [interfaceingame.com](https://interfaceingame.com/games/slay-the-spire/) | Resource display as discrete icons (mana orbs), not fill bars. Card hand layout at bottom of screen. Health as segmented bar. Clean typography hierarchy despite dark fantasy theme. |
| Civilization VI Hex UI | [gamepressure.com](https://www.gamepressure.com/sidmeierscivilization6/interface/ze92ba) | Top bar: resources. Bottom bar: unit actions/turn controls. Hex info panel as popup on hover. Minimap in bottom-right corner. This is the canonical hex strategy layout -- we follow it but reskin with our mythic aesthetic. |
| Mucha Art Nouveau Frames | [muchafoundation.org](https://www.muchafoundation.org/gallery/browse-works/object_type/decorative-designs) | Organic, flowing border designs with botanical motifs. Asymmetric frames that feel alive. Gold/amber tones on dark grounds. Applicable to: panel borders, tooltip frames, minimap border, deity power menu frame. |
| Dark Fantasy UI (Behance) | [behance.net](https://www.behance.net/gallery/229293389/Dark-Fantasy-UI-Game-Main-Menu) | Modern dark fantasy UI art direction. Layered depth with glow effects. Panel backgrounds use subtle noise/texture (parchment feel). Buttons with ornamental borders and inner glow on hover. |
| Synty Dark Fantasy HUD | [syntystore.com](https://syntystore.com/products/interface-dark-fantasy-hud) | Component kit pattern: health/mana flasks, compass, minimap frame, action bar slots, inventory panels. All share consistent ornamental border language. Health bars use decorative end-caps. |

**Layout pattern for Anima Swarm (from Civ VI + Darkest Dungeon hybrid):**

```
+-------------------------------------------------------+
| [Resources: Memory/Essence/Influence] [Turn/Epoch] [?] |  <- Top bar
|                                                         |
|                                                         |
|              [HEX GRID GAME BOARD]                      |
|                                                         |
|                          +-------------+                |
|                          | Hex Info     |  <- Hover tooltip
|                          | Terrain/Owner|
|                          +-------------+                |
|  +----------+                           +----------+    |
|  | Minimap  |                           | Deity    |    |
|  | Frame    |                           | Powers   |    |
|  +----------+                           +----------+    |
|                                                         |
| [Spirit Portrait] [Spirit Stats] [Actions: Move/Claim/  |  <- Bottom bar
|                                   Battle/Whisper/Spawn] |
+---------------------------------------------------------+
```

---

### 1D. Logo + Favicon

**Core direction:** "Anima Swarm" wordmark with mythic, ancient feel. Bioluminescent accents. NOT clean/modern tech branding.

| Reference | Source | Pattern Extracted |
|-----------|--------|-------------------|
| Hades Logo | Supergiant Games | Hand-drawn lettering with rough edges. Gold/amber on dark. Greek key pattern accents. |
| Armello Logo | League of Geeks | Ornamental serif with decorative flourishes. Heraldic quality. |
| Cultist Simulator Logo | Weather Factory | Hand-lettered serif with subtle wear/age texture. Occult feel through letter spacing and weight. |
| Pentiment Logo | Obsidian | Calligraphic lettering directly referencing medieval manuscript hands. Letters feel written, not typed. |
| Art Nouveau Letterforms | Mucha reference | Organic curves integrating floral/biological motifs into letter strokes. |

**Logo spec:**
- Wordmark: "ANIMA" in Cinzel Decorative (or hand-lettered equivalent) with custom ligatures
- "SWARM" in lighter weight below or integrated
- Accent: bioluminescent glow effect behind/around key letters (the A's especially)
- Favicon: Stylized "A" with spirit wisp emerging from the crossbar, teal glow on dark
- Color: Gold (#d4a052) primary letterforms, teal (#2dd4bf) glow accents, on deep navy (#0a0e17)

---

### 1E. Ambient Particles

**Core direction:** Floating spirit wisps, mana motes, and terrain-specific ambient particles. Ori and the Blind Forest is the gold standard.

| Reference | Source | Pattern Extracted |
|-----------|--------|-------------------|
| Ori Spirit Light Particles | [sketchfab.com](https://sketchfab.com/blogs/community/art-spotlight-ori/) | Small white/cyan spheres with soft glow halos. Gentle sine-wave float motion. Parallax response to camera movement. Particles fade in/out rather than popping. |
| Ori Ambient Environment VFX | [sixwingstories.org](https://sixwingstories.org/2024/01/07/how-art-direction-is-used-to-create-a-sense-of-atmosphere-in-ori-and-the-blind-forest/) | Layered particle systems: background (slow, large, dim), midground (medium, varied color), foreground (fast, small, bright). The layering creates depth on a 2D plane. |
| tsParticles Library | [particles.js.org](https://particles.js.org/) | React-compatible particle engine. Supports: custom shapes, glow effects, parallax, inter-particle connections, mouse interaction. Config-driven -- perfect for per-terrain particle presets. |
| Canvas Particle Effects | [css-tricks.com](https://css-tricks.com/adding-particle-effects-to-dom-elements-with-canvas/) | Overlay canvas on DOM elements. Particle rendering in `requestAnimationFrame` loop. Key for our hex grid overlay approach. |

**Implementation:** Use `@tsparticles/react` with per-terrain preset configs. Each terrain type emits unique ambient particles:

| Terrain | Particle Type | Color | Behavior |
|---------|--------------|-------|----------|
| Sacred Grove | Floating leaf motes + fireflies | #4ade80 (green), #fbbf24 (amber) | Gentle upward drift, firefly blink |
| Volcanic Rift | Ember sparks + heat shimmer | #ef4444 (red), #f97316 (orange) | Rising with turbulence, fade-out at top |
| Crystal Cavern | Prismatic shards + light refractions | #818cf8 (indigo), #e879f9 (pink) | Slow rotation, prismatic color shift |
| Deep Marsh | Swamp gas wisps + fog tendrils | #22d3ee (cyan), #a3e635 (lime) | Horizontal drift, low to ground |
| Spirit Desert | Sand motes + mirage shimmer | #fbbf24 (amber), #f5f5f4 (bone) | Wind-driven horizontal, shimmer waves |
| Frozen Tundra | Snowflakes + aurora wisps | #e2e8f0 (ice), #818cf8 (aurora) | Slow fall, gentle sway |
| Void Scar | Dark matter motes + rift sparks | #7c3aed (violet), #1e1b4b (void) | Inward spiral toward center, pulsing |

---

## 2. Color Palette

### 2A. Core UI Palette

**Philosophy:** Dark forest lit by spirit fire and glowing fungi. Backgrounds are deep and cool. Accents are warm (amber/gold for deity power) and cool-bright (teal/cyan for spirit energy).

```css
:root {
  /* === BACKGROUNDS === */
  --bg-abyss:     #060a12;  /* Deepest layer -- void */
  --bg-deep:      #0a0e17;  /* Primary game board background */
  --bg-surface:   #111827;  /* Panel backgrounds */
  --bg-elevated:  #1a2332;  /* Hover states, active panels */
  --bg-glass:     rgba(17, 24, 39, 0.85);  /* Glassmorphism panels with backdrop-blur */

  /* === TEXT === */
  --text-primary:   #f0ead6;  /* Warm parchment white, not pure white */
  --text-secondary: #9ca3af;  /* Muted descriptions */
  --text-muted:     #6b7280;  /* Disabled, tertiary info */
  --text-accent:    #fbbf24;  /* Deity gold for important callouts */

  /* === DEITY GOLD (primary accent) === */
  --gold:         #d4a052;  /* Primary gold -- borders, active states */
  --gold-bright:  #f59e0b;  /* Highlight gold -- buttons, emphasis */
  --gold-dim:     #92702a;  /* Muted gold -- inactive borders */
  --gold-glow:    rgba(212, 160, 82, 0.3);  /* Glow effect */

  /* === SPIRIT TEAL (secondary accent) === */
  --spirit:       #2dd4bf;  /* Primary spirit energy color */
  --spirit-bright:#5eead4;  /* Active/hover spirit elements */
  --spirit-dim:   #0d9488;  /* Muted spirit indicators */
  --spirit-glow:  rgba(45, 212, 191, 0.25);  /* Spirit glow effect */

  /* === DANGER/DAMAGE === */
  --damage:       #ef4444;  /* Damage numbers, health loss */
  --damage-glow:  rgba(239, 68, 68, 0.3);

  /* === PLAYER COLORS (5 deities) === */
  --deity-ember:   #ef4444;  /* Player 1 -- Flame Deity */
  --deity-verdant: #22c55e;  /* Player 2 -- Growth Deity */
  --deity-tidal:   #3b82f6;  /* Player 3 -- Ocean Deity */
  --deity-storm:   #a855f7;  /* Player 4 -- Storm Deity */
  --deity-void:    #f97316;  /* Player 5 -- Void Deity */
}
```

### 2B. Terrain-Specific Palettes

Each terrain has a 5-color palette: base, midtone, highlight, bioluminescent accent, border.

```css
:root {
  /* Sacred Grove -- deep emerald forest with golden firefly light */
  --grove-base:       #0f3d1e;
  --grove-mid:        #166534;
  --grove-highlight:  #22c55e;
  --grove-glow:       #4ade80;  /* bioluminescent accent */
  --grove-border:     #15803d;

  /* Volcanic Rift -- obsidian black with magma veins */
  --volcanic-base:    #1c0a0a;
  --volcanic-mid:     #450a0a;
  --volcanic-highlight:#991b1b;
  --volcanic-glow:    #f97316;  /* molten glow */
  --volcanic-border:  #7f1d1d;

  /* Crystal Cavern -- deep indigo with prismatic refractions */
  --crystal-base:     #0f0b2e;
  --crystal-mid:      #1e1b4b;
  --crystal-highlight:#4338ca;
  --crystal-glow:     #e879f9;  /* prismatic accent */
  --crystal-border:   #312e81;

  /* Deep Marsh -- murky teal-green with phosphorescent algae */
  --marsh-base:       #042f2e;
  --marsh-mid:        #134e4a;
  --marsh-highlight:  #0d9488;
  --marsh-glow:       #22d3ee;  /* phosphorescent */
  --marsh-border:     #115e59;

  /* Spirit Desert -- bone white sands with amber spirit fire */
  --desert-base:      #292524;
  --desert-mid:       #57534e;
  --desert-highlight: #a8a29e;
  --desert-glow:      #fbbf24;  /* spirit fire */
  --desert-border:    #78716c;

  /* Frozen Tundra -- pale blue-grey with aurora wisps */
  --tundra-base:      #1e293b;
  --tundra-mid:       #334155;
  --tundra-highlight: #94a3b8;
  --tundra-glow:      #818cf8;  /* aurora */
  --tundra-border:    #475569;

  /* Void Scar -- absolute dark with violet rift energy */
  --void-base:        #030712;
  --void-mid:         #0f0620;
  --void-highlight:   #3b0764;
  --void-glow:        #a855f7;  /* rift energy */
  --void-border:      #2e1065;
}
```

---

## 3. Typography Recommendation

### Font Stack

| Role | Font | Google Fonts | Fallback | Rationale |
|------|------|-------------|----------|-----------|
| **Game Title / Logo** | Cinzel Decorative | [fonts.google.com/specimen/Cinzel+Decorative](https://fonts.google.com/specimen/Cinzel+Decorative) | Georgia, serif | Roman inscription inspired. Ornamental capitals. Ancient feel without being unreadable. Used for "ANIMA SWARM" wordmark, deity names, chapter headers. |
| **UI Headers** | Cinzel | [fonts.google.com/specimen/Cinzel](https://fonts.google.com/specimen/Cinzel) | Georgia, serif | Same family as title but in regular weight. Classical proportions. All-caps for panel titles, spirit names, terrain labels. |
| **Body Text** | Cormorant Garamond | [fonts.google.com/specimen/Cormorant+Garamond](https://fonts.google.com/specimen/Cormorant+Garamond) | 'Times New Roman', serif | High x-height Garamond with excellent screen readability. Elegant but functional. For chat messages, descriptions, tooltips, memory entries. Weights: 400 (body), 500 (emphasis), 600 (strong). |
| **Damage Numbers / Stats** | JetBrains Mono | [fonts.google.com/specimen/JetBrains+Mono](https://fonts.google.com/specimen/JetBrains+Mono) | 'Courier New', monospace | Monospace for numerical precision. Tabular figures. Used for: damage numbers, resource counts, epoch counters, memory IDs, blob references. |

### Typography Scale

```css
:root {
  /* Title (Cinzel Decorative) */
  --font-title: 'Cinzel Decorative', Georgia, serif;
  --title-size: clamp(2rem, 5vw, 3.5rem);
  --title-weight: 700;
  --title-tracking: 0.15em;

  /* Headers (Cinzel) */
  --font-header: 'Cinzel', Georgia, serif;
  --h1-size: 1.5rem;
  --h2-size: 1.25rem;
  --h3-size: 1rem;
  --header-weight: 600;
  --header-tracking: 0.08em;

  /* Body (Cormorant Garamond) */
  --font-body: 'Cormorant Garamond', 'Times New Roman', serif;
  --body-size: 1rem;       /* 16px base */
  --body-leading: 1.6;
  --body-weight: 400;
  --body-tracking: 0.01em;

  /* Mono/Stats (JetBrains Mono) */
  --font-mono: 'JetBrains Mono', 'Courier New', monospace;
  --mono-size: 0.875rem;
  --mono-weight: 500;

  /* Damage numbers -- special treatment */
  --damage-size: 1.5rem;
  --damage-weight: 700;
}
```

### CSS Import

```css
@import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700&family=Cinzel:wght@400;600;700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&family=JetBrains+Mono:wght@500;700&display=swap');
```

**Why we replaced Space Grotesk from the PRD:** Space Grotesk is a geometric sans-serif -- it reads as tech/modern. The mythic/ancient direction demands serif and calligraphic faces. Cinzel + Cormorant Garamond give us the illuminated manuscript feel while maintaining excellent web rendering. JetBrains Mono stays for numerical/technical readouts where monospace precision matters.

---

## 4. Art Generation Prompt Templates (Replicate / Flux)

### 4A. Style Prefix (consistent across all generations)

All prompts use this prefix to maintain visual consistency:

```
STYLE_PREFIX = "painterly illustration in the style of illuminated manuscripts and bioluminescent fantasy, watercolor wash textures with fine ink linework, rich deep colors with glowing accents, hand-drawn quality with slight texture grain, mythic ancient aesthetic, dark background"
```

### 4B. Terrain Hex Textures (256x256, square, tileable)

**Model:** `black-forest-labs/flux-1.1-pro` on Replicate
**Dimensions:** 1024x1024 (downscale to 256x256 for hex tiles)
**Guidance scale:** 3.5
**Steps:** 50

```
TERRAIN_PREFIX = "top-down hexagonal terrain tile for a strategy game, painterly watercolor texture with fine ink border, seamless edges, flat perspective looking straight down"
```

| Terrain | Prompt |
|---------|--------|
| **Sacred Grove** | `{TERRAIN_PREFIX}, ancient sacred forest grove, massive twisted tree roots with bioluminescent moss, golden firefly light scattered among dark emerald canopy, mushrooms with soft green glow at base, rich dark green and amber palette, spirit energy wisps floating between branches` |
| **Volcanic Rift** | `{TERRAIN_PREFIX}, volcanic rift terrain with cracked obsidian surface, glowing magma veins cutting through dark basalt rock, red and orange embers rising from fissures, smoke wisps at edges, molten lava glow illuminating jagged terrain, black and crimson palette` |
| **Crystal Cavern** | `{TERRAIN_PREFIX}, crystal cavern surface seen from above, clusters of translucent amethyst and quartz crystals emerging from dark stone, prismatic light refractions creating rainbow accents, deep indigo base with pink and violet crystal glow, geometric crystal facets catching light` |
| **Deep Marsh** | `{TERRAIN_PREFIX}, murky swamp marsh terrain, dark teal-green stagnant water with floating lily pads, phosphorescent algae creating cyan glow patterns, gnarled roots breaking the surface, fog wisps hovering above water, mysterious and eerie atmosphere` |
| **Spirit Desert** | `{TERRAIN_PREFIX}, ancient spirit desert with bone-white sand dunes, weathered stone ruins partially buried, amber spirit fire flickering above sand, wind-carved patterns in pale stone, scattered ancient glyphs with faint golden glow, warm desert tones with supernatural amber accents` |
| **Frozen Tundra** | `{TERRAIN_PREFIX}, frozen tundra ice field, pale blue-grey permafrost with cracks revealing deep blue ice beneath, delicate frost crystal patterns, aurora borealis reflections on ice surface casting purple and indigo hues, sparse frozen vegetation with ice crystals, cold ethereal atmosphere` |
| **Void Scar** | `{TERRAIN_PREFIX}, otherworldly void scar terrain, absolute darkness with fractures revealing violet rift energy beneath the surface, reality-warping distortion at edges, dark matter particles floating upward, eldritch geometric patterns in the cracks, deep black and electric purple palette, unsettling and alien` |

### 4C. Spirit Creature Portraits (512x512 or 768x768)

**Model:** `black-forest-labs/flux-1.1-pro` on Replicate
**Dimensions:** 1024x1024 (crop to portrait)
**Guidance scale:** 3.5
**Steps:** 50

```
CREATURE_PREFIX = "character portrait illustration, bust and shoulders view, three-quarter angle, dark background, painterly style with ink linework and selective cel-shading, bioluminescent rim lighting, mythic fantasy creature, strong silhouette, rich detail"
```

| Spirit | Prompt |
|--------|--------|
| **Ember Wyrm** | `{CREATURE_PREFIX}, ember wyrm creature portrait, serpentine dragon with elongated neck and flickering flame mane, scales that shift from obsidian black to molten orange at the edges, eyes like twin furnaces burning amber-gold, wisps of smoke and ember particles rising from its body, internal glow visible through scale gaps like magma beneath stone, warm red and orange bioluminescent accents, fierce and ancient expression` |
| **Moss Golem** | `{CREATURE_PREFIX}, moss golem creature portrait, massive hulking figure made of ancient stone and living wood, face formed from gnarled bark with deep-set eyes glowing soft emerald green, thick moss and ferns growing across shoulders and head like a crown, bioluminescent mushrooms sprouting from joints and crevices casting warm golden light, roots and vines winding around its form, patient and wise expression, earth tones with green and amber glow accents` |
| **Tide Wraith** | `{CREATURE_PREFIX}, tide wraith creature portrait, ethereal aquatic spirit with translucent flowing form, face partially visible through swirling water and mist, eyes like deep ocean bioluminescence in piercing cyan, trailing tentacle-like appendages made of concentrated sea foam and current, barnacles and coral fragments embedded in its shifting form, cold teal and deep blue palette with bright cyan glow accents, haunting and mysterious expression` |
| **Storm Raptor** | `{CREATURE_PREFIX}, storm raptor creature portrait, majestic predatory bird with massive wingspan folded behind, feathers crackling with static electricity at the tips, eyes like ball lightning in brilliant white-violet, crown of storm cloud formations swirling above its head, talons visible at shoulder level with arcing electricity between them, plumage shifting from slate grey to electric purple, charged atmosphere around it, proud and fierce expression, violet and white bioluminescent accents` |
| **Void Oracle** | `{CREATURE_PREFIX}, void oracle creature portrait, enigmatic floating entity with an elongated skull-like head, multiple eyes arranged asymmetrically each glowing different shade of violet, body dissolving into dark matter particles at the edges, reality warping subtly around its form, ancient glyphs and sigils orbiting its head in slow rotation, robes or wrappings made of solidified darkness with purple rift energy bleeding through tears, unsettling cosmic wisdom in its gaze, deep black and electric violet palette` |

### 4D. Replicate API Usage

```bash
# Token is in ~/.zshenv (REPLICATE_API_TOKEN)
source ~/.zshenv

# Generate a terrain tile
curl -s -X POST https://api.replicate.com/v1/predictions \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "black-forest-labs/flux-1.1-pro",
    "input": {
      "prompt": "YOUR_PROMPT_HERE",
      "aspect_ratio": "1:1",
      "output_format": "png",
      "safety_tolerance": 5
    }
  }'

# Poll for result
curl -s https://api.replicate.com/v1/predictions/PREDICTION_ID \
  -H "Authorization: Bearer $REPLICATE_API_TOKEN"
```

**Batch generation script pattern:**

```javascript
// scripts/generate-assets.mjs
import Replicate from 'replicate';

const replicate = new Replicate();

const STYLE_PREFIX = "painterly illustration in the style of illuminated manuscripts and bioluminescent fantasy, watercolor wash textures with fine ink linework, rich deep colors with glowing accents, hand-drawn quality with slight texture grain, mythic ancient aesthetic, dark background";

const TERRAIN_PREFIX = `top-down hexagonal terrain tile for a strategy game, ${STYLE_PREFIX}, seamless edges, flat perspective looking straight down`;

const terrains = {
  'sacred-grove': `${TERRAIN_PREFIX}, ancient sacred forest grove, massive twisted tree roots with bioluminescent moss, golden firefly light scattered among dark emerald canopy, mushrooms with soft green glow at base, rich dark green and amber palette, spirit energy wisps floating between branches`,
  // ... other terrains
};

for (const [name, prompt] of Object.entries(terrains)) {
  const output = await replicate.run("black-forest-labs/flux-1.1-pro", {
    input: { prompt, aspect_ratio: "1:1", output_format: "png" }
  });
  // Save to frontend/public/assets/terrain/{name}.png
  console.log(`Generated ${name}: ${output}`);
}
```

---

## 5. UI Component Patterns

### 5A. Panel System

All panels share a base component with consistent chrome:

```css
/* Base panel */
.anima-panel {
  background: var(--bg-glass);
  backdrop-filter: blur(12px);
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  box-shadow:
    0 0 20px rgba(0, 0, 0, 0.5),        /* Depth shadow */
    inset 0 1px 0 rgba(212, 160, 82, 0.1); /* Inner gold highlight */
  position: relative;
  overflow: hidden;
}

/* Ornamental corner accents (Art Nouveau inspired) */
.anima-panel::before,
.anima-panel::after {
  content: '';
  position: absolute;
  width: 24px;
  height: 24px;
  border-color: var(--gold);
  border-style: solid;
  opacity: 0.6;
}
.anima-panel::before {
  top: 4px; left: 4px;
  border-width: 2px 0 0 2px;
  border-radius: 4px 0 0 0;
}
.anima-panel::after {
  bottom: 4px; right: 4px;
  border-width: 0 2px 2px 0;
  border-radius: 0 0 4px 0;
}

/* Panel header */
.anima-panel-header {
  font-family: var(--font-header);
  font-size: var(--h3-size);
  font-weight: var(--header-weight);
  letter-spacing: var(--header-tracking);
  text-transform: uppercase;
  color: var(--gold-bright);
  padding: 12px 16px 8px;
  border-bottom: 1px solid rgba(212, 160, 82, 0.15);
}
```

### 5B. Resource Bar (Top Bar)

```
+--[Memory: 234]--[Essence: 12]--[Influence: 67%]--[    ]--[Epoch 7 / Turn 3]--+
```

```css
.resource-bar {
  display: flex;
  align-items: center;
  gap: 24px;
  padding: 8px 16px;
  background: var(--bg-surface);
  border-bottom: 1px solid var(--gold-dim);
}

.resource-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: var(--mono-size);
  color: var(--text-primary);
}

.resource-icon {
  width: 20px;
  height: 20px;
  /* SVG icon with terrain-colored glow */
}

.resource-value {
  color: var(--gold-bright);
  font-weight: 700;
}

.epoch-display {
  margin-left: auto;
  font-family: var(--font-header);
  font-size: var(--h3-size);
  color: var(--text-secondary);
  letter-spacing: var(--header-tracking);
}
```

### 5C. Hex Info Tooltip

Appears on hover over any hex tile. Positioned relative to cursor.

```css
.hex-tooltip {
  /* extends .anima-panel */
  width: 220px;
  padding: 12px;
  pointer-events: none;
  z-index: 100;
}

.hex-tooltip-terrain {
  font-family: var(--font-header);
  font-size: var(--h3-size);
  text-transform: uppercase;
  color: var(--gold-bright);
  margin-bottom: 4px;
}

.hex-tooltip-owner {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--text-secondary);
  margin-bottom: 8px;
}

.hex-tooltip-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 4px;
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-muted);
}

.hex-tooltip-stat-value {
  color: var(--spirit);
  text-align: right;
}
```

**Tooltip content layout:**
```
+---SACRED GROVE-----------+
| Controlled by: Ember Deity|
|                           |
| Memory Rate    1.2x       |
| Defense Bonus  +20%       |
| Spirits        3          |
| Contested      No         |
+---------------------------+
```

### 5D. Spirit Portrait Card (Bottom Bar)

```css
.spirit-card {
  /* extends .anima-panel */
  display: flex;
  gap: 12px;
  padding: 8px 12px;
  min-width: 320px;
}

.spirit-portrait {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  border: 2px solid var(--gold);
  box-shadow: 0 0 12px var(--spirit-glow);
  object-fit: cover;
}

.spirit-info {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
}

.spirit-name {
  font-family: var(--font-header);
  font-size: var(--h2-size);
  color: var(--text-primary);
}

.spirit-species {
  font-family: var(--font-body);
  font-size: 0.875rem;
  color: var(--text-secondary);
  font-style: italic;
}

.spirit-health-bar {
  height: 6px;
  background: var(--bg-elevated);
  border-radius: 3px;
  overflow: hidden;
}

.spirit-health-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--damage) 0%, var(--gold-bright) 100%);
  border-radius: 3px;
  transition: width 0.3s ease;
}
```

### 5E. Action Panel (Bottom Bar)

```css
.action-panel {
  display: flex;
  gap: 8px;
  padding: 8px;
  align-items: center;
}

.action-button {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 16px;
  background: var(--bg-elevated);
  border: 1px solid var(--gold-dim);
  border-radius: 6px;
  color: var(--text-primary);
  cursor: pointer;
  font-family: var(--font-header);
  font-size: 0.75rem;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  transition: all 0.2s ease;
}

.action-button:hover {
  background: var(--bg-hover);
  border-color: var(--gold);
  box-shadow: 0 0 12px var(--gold-glow);
}

.action-button:active {
  background: var(--gold-dim);
  color: var(--bg-deep);
}

.action-button--primary {
  background: var(--gold);
  color: var(--bg-deep);
  border-color: var(--gold-bright);
  font-weight: 700;
}

.action-button--disabled {
  opacity: 0.4;
  cursor: not-allowed;
  pointer-events: none;
}

.action-icon {
  width: 24px;
  height: 24px;
  /* SVG icon */
}
```

**Action button set:**
```
[Move] [Claim] [Battle] [Whisper] [Spawn]
  ^       ^       ^         ^        ^
 foot   flag    sword     speech   spirit
```

### 5F. Deity Power Menu (Right Side)

Radial or vertical panel for deity-level powers.

```css
.deity-menu {
  /* extends .anima-panel */
  width: 200px;
  padding: 12px;
}

.deity-power {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.2s;
}

.deity-power:hover {
  background: rgba(212, 160, 82, 0.1);
}

.deity-power-icon {
  width: 32px;
  height: 32px;
  border: 1px solid var(--gold-dim);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg-elevated);
}

.deity-power-name {
  font-family: var(--font-header);
  font-size: 0.875rem;
  color: var(--text-primary);
}

.deity-power-cost {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  color: var(--text-accent);
  margin-left: auto;
}
```

### 5G. Minimap Frame (Bottom Left)

```css
.minimap-container {
  /* extends .anima-panel */
  width: 180px;
  height: 180px;
  padding: 4px;
  border: 2px solid var(--gold-dim);
  /* Art Nouveau ornamental border via SVG background-image */
}

.minimap-canvas {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  /* Render simplified hex grid with player colors */
}

.minimap-viewport {
  /* White/gold rectangle showing current camera view */
  border: 1px solid var(--gold-bright);
  position: absolute;
}
```

### 5H. Chat/Whisper Panel

Deity-to-spirit conversation interface. Core differentiator for the game.

```css
.whisper-panel {
  /* extends .anima-panel */
  width: 360px;
  height: 480px;
  display: flex;
  flex-direction: column;
}

.whisper-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.whisper-message--deity {
  align-self: flex-end;
  background: rgba(212, 160, 82, 0.15);
  border: 1px solid var(--gold-dim);
  border-radius: 16px 16px 4px 16px;
  padding: 8px 12px;
  max-width: 80%;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-style: italic;  /* Deity whispers are always italic */
}

.whisper-message--spirit {
  align-self: flex-start;
  background: rgba(45, 212, 191, 0.1);
  border: 1px solid var(--spirit-dim);
  border-radius: 16px 16px 16px 4px;
  padding: 8px 12px;
  max-width: 80%;
  color: var(--text-primary);
  font-family: var(--font-body);
}

.whisper-input {
  display: flex;
  gap: 8px;
  padding: 12px;
  border-top: 1px solid rgba(212, 160, 82, 0.15);
}

.whisper-input input {
  flex: 1;
  background: var(--bg-elevated);
  border: 1px solid var(--gold-dim);
  border-radius: 8px;
  padding: 8px 12px;
  color: var(--text-primary);
  font-family: var(--font-body);
  font-style: italic;
}

.whisper-input input::placeholder {
  color: var(--text-muted);
  font-style: italic;
}

.whisper-send {
  /* Uses .action-button--primary */
}
```

---

## 6. Reference Games -- Key Takeaways

### Hades (Art Direction)
- **Technique:** Pen-and-ink linework with selective cel-shading (NOT full painterly)
- **Color:** Limited palette per character (2-3 hues). Dark backgrounds. Accent colors for rim lighting.
- **Portraits:** Dynamic poses. Larger-than-life energy. Characters feel mythic, not realistic.
- **Production insight:** Ink-based workflow is FASTER than painterly. Critical for our hackathon timeline.
- **Apply to Anima Swarm:** Spirit portraits use this ink + cel-shade approach. Each spirit gets 2-3 dominant colors. Dark backgrounds unify the set.

### Armello (Hex Strategy + Creature Art)
- **Hex board:** Painterly terrain with strong color-temperature differentiation between terrain types. Hexes are readable at zoom-out through color alone.
- **Characters:** Anthropomorphic portraits with strong silhouettes and faction-coded colors.
- **UI:** Clean overlay on hex board. Turn indicator prominent. Card-hand at bottom.
- **Apply to Anima Swarm:** Hex terrain color-temperature approach. Terrain types must read at the minimap scale through color alone.

### Ori and the Blind Forest (Ambient Particles)
- **Particles:** Layered system -- background (slow, large, dim) + midground (varied) + foreground (fast, small, bright).
- **Technique:** Particles are soft circles with additive blending. Gentle sine-wave motion. Fade in/out, never pop.
- **Depth illusion:** Particles at different layers create parallax depth on a 2D plane.
- **Apply to Anima Swarm:** Three-layer particle system per terrain type. tsParticles with custom presets. Particles are the primary "this world is alive" signal.

### Cultist Simulator (UI Chrome)
- **Philosophy:** The content IS the interface. Minimal chrome. Cards on a workspace.
- **Tooltips:** Rich text on parchment-feel backgrounds. Hover-heavy information architecture.
- **Typography:** Serif body text. Occult-feel headers. The text styling alone conveys the theme.
- **Apply to Anima Swarm:** Our serif typography (Cinzel + Cormorant Garamond) does the same work. Panels are translucent with subtle gold borders, not heavy chrome.

### Pentiment (Illuminated Manuscripts)
- **Technique:** 2D hand-drawn assets referencing historical woodcuts and manuscripts. Flat perspective. Rich internal detail.
- **Production insight:** Small team (13 people). "Being informal and flexible about development" was key. They grey-boxed scenes as rough sketches and played them in-engine before polishing.
- **Typography as art:** Different character classes used different historical typefaces. The text rendering is a core visual feature.
- **Apply to Anima Swarm:** Our typography choices serve the same function. Cinzel Decorative for deity-level text, Cormorant Garamond for spirit-level. The font shift signals the speaker's authority.

---

## 7. Implementation Priority

Given the hackathon deadline (Jun 21, 2026), prioritize assets in this order:

1. **CSS Design System** -- Variables, fonts, panel components (Day 1)
2. **7 Terrain Hex Textures** -- Flux-generated, one batch run (Day 1-2)
3. **5 Spirit Portraits** -- Flux-generated with consistent style prefix (Day 2)
4. **Ambient Particle Presets** -- tsParticles configs for each terrain (Day 3)
5. **Logo/Favicon** -- Cinzel Decorative wordmark + manual glow effect (Day 3)
6. **UI Polish** -- Ornamental borders, tooltip refinement (ongoing)

### Asset Generation Budget (Replicate)

| Asset | Count | Model | Est. Cost |
|-------|-------|-------|-----------|
| Terrain textures | 7 x 3 variants | Flux 1.1 Pro | ~$0.84 |
| Spirit portraits | 5 x 3 variants | Flux 1.1 Pro | ~$0.60 |
| Logo variants | 3 | Flux 1.1 Pro | ~$0.12 |
| UI texture elements | 5 | Flux 1.1 Pro | ~$0.20 |
| **Total** | | | **~$1.76** |

---

## 8. Particle System Config (tsParticles)

### Installation

```bash
cd frontend
pnpm add @tsparticles/react @tsparticles/engine @tsparticles/slim
```

### Sacred Grove Preset (example)

```json
{
  "particles": {
    "number": { "value": 30 },
    "color": {
      "value": ["#4ade80", "#fbbf24", "#22c55e"]
    },
    "shape": { "type": "circle" },
    "opacity": {
      "value": { "min": 0.2, "max": 0.8 },
      "animation": {
        "enable": true,
        "speed": 0.5,
        "minimumValue": 0.1,
        "sync": false
      }
    },
    "size": {
      "value": { "min": 1, "max": 4 },
      "animation": {
        "enable": true,
        "speed": 1,
        "minimumValue": 0.5,
        "sync": false
      }
    },
    "move": {
      "enable": true,
      "speed": 0.3,
      "direction": "top",
      "outModes": "out",
      "random": true,
      "straight": false
    },
    "shadow": {
      "enable": true,
      "color": "#4ade80",
      "blur": 8
    }
  },
  "background": { "color": "transparent" }
}
```

---

## 9. Fog of War Treatment

Unexplored hexes need a distinct visual treatment:

```css
.hex-fog {
  fill: var(--bg-abyss);
  opacity: 0.85;
  filter: url(#fog-noise);
  transition: opacity 0.5s ease;
}

.hex-fog--partial {
  /* Adjacent to explored -- dimly visible terrain */
  opacity: 0.5;
  filter: url(#fog-noise) blur(2px);
}

.hex-fog--revealed {
  opacity: 0;
  pointer-events: auto;
}
```

**SVG noise filter for fog:**
```xml
<filter id="fog-noise">
  <feTurbulence type="fractalNoise" baseFrequency="0.03" numOctaves="3" />
  <feColorMatrix type="saturate" values="0" />
  <feBlend in="SourceGraphic" mode="multiply" />
</filter>
```

This gives fog a hand-drawn, organic quality rather than a flat black overlay -- consistent with the illuminated manuscript aesthetic where unexplored areas of a map would be decorated rather than blank.
