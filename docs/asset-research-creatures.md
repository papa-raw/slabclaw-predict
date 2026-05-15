# Spirit Creature Art Research — Anima Swarm

**Date:** 2026-05-14
**Finding:** No pre-made assets match the aesthetic. Generate with Flux 2 Pro via Replicate API.

---

## Generation Strategy

**Primary pipeline:** Flux 2 Pro via Replicate (`black-forest-labs/flux-2-pro`)
- Multi-reference image support for style consistency
- Commercial license OK
- Cost: ~$2-5 total for all 5 creatures (5 variants each)

### Style Prefix (all creatures)
```
Mythic illustrated creature portrait in the style of Peter Mohrbacher's Angelarium
crossed with Art Nouveau framing. Dark background (#0a0e17). Pen-and-ink
foundation with selective color. Bioluminescent rim lighting. Bust/shoulder
crop, 3/4 view. Ancient, mystical, luminous. NOT photorealistic, NOT anime,
NOT pixel art. Illustrated with visible brushwork and ink linework.
```

### Per-Creature Prompts

| Creature | Dominant Hues | Prompt Additions |
|----------|--------------|------------------|
| Ember Wyrm | #ef4444, #f97316, #fbbf24 | Ancient fire serpent, sinuous coils, bioluminescent scales glowing ember-orange, volcanic light beneath obsidian scales, wisps of flame, Art Nouveau volcanic border |
| Moss Golem | #22c55e, #06b6d4, #78716c | Massive humanoid of ancient weathered stone, luminescent moss and bioluminescent fungi, glowing green-blue veins, mushroom colonies on shoulders, amber eyes, fern motif border |
| Tide Wraith | #3b82f6, #06b6d4, #818cf8 | Spectral entity of translucent deep-sea water, jellyfish bioluminescence visible through body, trailing luminous tendrils, abyssal blue eyes, wave and kelp border |
| Storm Raptor | #818cf8, #fbbf24, #e2e8f0 | Massive thunderbird with spread wings crackling lightning, dark iron-grey feathers with electric blue bioluminescent edges, white-gold lightning eyes, cloud spiral border |
| Void Oracle | #7c3aed, #1e1b4b, #e879f9 | Cosmic entity emerging from dark matter, floating eye motifs, stars visible within nebula body, geometric void patterns, celestial and eye border |

### Reference Artists
1. **Peter Mohrbacher (Angelarium)** — single strongest match, divine/mythic/bioluminescent
2. **Jen Zee (Hades)** — production pipeline model (ink foundation + selective color)
3. **James Jean** — layered mythic scenes, creature-environment integration
4. **Iris Compiet** — watercolor+graphite creature illustration, organic feel

### LoRAs for Local Generation (Flux Dev)
| LoRA | Trigger | Weight | Use |
|------|---------|--------|-----|
| V67 Art Nouveau | `v67` + `(Art Nouveau:1.1)` | 0.65-0.75 | Mucha-style framing |
| Painterly Fantasy Portrait | `in the style of chargen_oil_painting` | 0.5-0.6 | Creature painterly quality |
| Creature Shock | `cre4tur3` | 0.7-0.8 | Creature texture detail |

**License note:** Flux Dev LoRAs are non-commercial. Use Flux 2 Pro via API for commercial output.

### Dev Placeholders
- game-icons.net (CC BY 3.0): 122 creature SVG icons for wireframing
- Pull dragon, golem, ghost, bird, eye icons for hex overlays
