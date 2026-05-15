# UI + Strategy Game Patterns Research — Anima Swarm

**Date:** 2026-05-14

---

## Recommended UI Stack

| Component | Solution | License |
|-----------|----------|---------|
| Hex grid | `react-hexgrid` (SVG-based) | MIT |
| Icons | game-icons.net (4,180 SVGs) | CC BY 3.0 |
| Panel borders | Kenney Fantasy UI Borders (140 sprites + vector) | CC0 |
| Deity power menu | `@spaceymonk/react-radial-menu` | MIT |
| Ambient particles | Sparticles (glow + twinkle + drift) | MIT |
| Resource bars | Custom SVG (stroke-dasharray animation) | N/A |

## Key References

- **Hades**: 88+ UI screenshots at interfaceingame.com/games/hades/
- **Armello**: hex hover = semi-transparent overlay on hex itself
- **Cultist Simulator**: card-on-table metaphor, minimal chrome
- **Dark RPG UI System (Figma)**: Free community file by UXzavr
- **Behance Dark Fantasy UI**: Gothic main menu reference

## UI Patterns Extracted

### Resource Bars
- Corner-anchored widgets, not full bottom bar (strategy game standard)
- Memory Essence: horizontal fill with particle glow
- Divine Power: radial/arc gauge (SVG arc + animated stroke-dasharray)
- Spirit Bond: 4-segment bar (Depth/Harmony/Adventure/Loyalty)

### Tooltips
- Single root `<HexTooltip>` — any hex fires onMouseEnter with data
- Notification/event queue pattern from patternsgameprog.com

### Deity Power Menu
- `@spaceymonk/react-radial-menu` v2.1.0 — nested sub-menus, CSS variable theming, animations
- Fallback: CSS-only radial layout with SVG icons

### Hex Grid
- `react-hexgrid` for SVG rendering — CSS styling per hex, SVG patterns for textures
- SVG `<filter>` for bioluminescent glow on owned/contested hexes
- Overlay Sparticles canvas on top for ambient particles

### Particles
- Sparticles: `glow: 15, twinkle: true, drift: true, composition: "screen"` = bioluminescent wisps
- tsParticles for mouse-interactive particles (hover = swirl)
- Codrops offscreen canvas blur + composite for advanced glow
