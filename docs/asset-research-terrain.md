# Hex Terrain Asset Research — Anima Swarm

**Date:** 2026-05-14
**Finding:** No existing free hex tileset matches mythic/bioluminescent. Generate custom via Replicate Flux.

---

## Strategy

### Phase 1 — Prototyping
Use **Screaming Brain Studios CC0 tiles** (128x128) as placeholders.
- URL: https://opengameart.org/content/180-seamless-hex-tiles
- License: CC0, covers volcanic/forest/water/desert/rocky
- Format: 128x144 PNG + Tiled .tsx

### Phase 2 — Custom Generation (Flux + Seamless Texture LoRA)
- **Model:** Flux via Replicate + [Seamless Texture LoRA](https://huggingface.co/gokaygokay/Flux-Seamless-Texture-LoRA)
- **Alt model:** [flux-2d-game-assets](https://replicate.com/replicate/flux-2d-game-assets)
- **Cost:** ~$0.013/image, under $5 total
- **Token:** ~/.zshenv (REPLICATE_API_TOKEN)
- **Trigger:** `smlstxtr, <description>, seamless texture`

#### Prompts (7 terrain types)

| Terrain | Prompt |
|---------|--------|
| Sacred Grove | `smlstxtr, sacred grove with ancient twisted trees, bioluminescent moss and glowing roots, gold leaf illuminated manuscript style, dark forest floor with cyan luminescence, seamless texture` |
| Volcanic Rift | `smlstxtr, volcanic rift terrain, cracked obsidian with molten amber veins, glowing lava beneath dark stone, illuminated manuscript border details, seamless texture` |
| Crystal Cavern | `smlstxtr, crystal cavern floor, amethyst and sapphire formations, bioluminescent crystalline glow, deep purple shadows, ancient mystical aesthetic, seamless texture` |
| Deep Marsh | `smlstxtr, deep marsh terrain, dark water with luminescent lily pads, glowing algae, murky green-teal bioluminescence, ancient wetland, seamless texture` |
| Spirit Desert | `smlstxtr, spirit desert terrain, pale golden sand with ethereal blue spirit wisps, scattered ancient ruins, ghostly luminescent particles, seamless texture` |
| Frozen Tundra | `smlstxtr, frozen tundra terrain, deep blue ice with trapped bioluminescent organisms, aurora-like glow beneath frost surface, ancient glacial, seamless texture` |
| Void Scar | `smlstxtr, void scar terrain, torn reality dark matter, purple-black with crackling energy veins, eldritch glow, cosmic horror illuminated manuscript style, seamless texture` |

### Phase 3 — Polish
**David Baumgart location overlays** ($16) for temples, shrines, altars on top of terrain.
- URL: https://dgbaumgart.itch.io/hex-medieval-fantasy-locations
- Free sample: https://dgbaumgart.itch.io/hex-and-tile-terrain-sample-set

## Hex Masking
CSS `clip-path: polygon(...)` on square textures — no pre-cut hex PNGs needed.
Any square seamless texture becomes a hex tile.

## All Sources Evaluated

| Rank | Source | License | Aesthetic (1-5) | Cost | Notes |
|------|--------|---------|-----------------|------|-------|
| 1 | Flux + Seamless LoRA | Open | 5 (custom) | ~$5 | Best path, full control |
| 2 | David Baumgart | Commercial OK | 3 | $16 | Hand-painted medieval, good overlays |
| 3 | Screaming Brain CC0 | CC0 | 2 | Free | Best placeholder set |
| 4 | Kenney Hexagon Pack | CC0 | 1.5 | Free | Clean 3D, wrong aesthetic, good geometry ref |
| 5 | CuddlyClover | CC-BY 4.0 | 1.5 | Free | Pixel art, huge ecosystem |
| 6 | RatbyteBoss | Free commercial | 1.5 | Free | Good terrain variety, small |
| 7 | adythewolf | CC0 | 1 | Free | Too basic |
| 8 | HextoryWorld | Open source | N/A (tool) | Free | Procedural layout generator |
