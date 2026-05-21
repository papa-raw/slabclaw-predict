import { generateHexGrid, hexId, startingPositions } from './hexMath.js';
import { TERRAIN_TYPES } from './terrainTypes.js';

const RADIUS = 7; // 169-hex map (7-ring) — expanded for 150 spirits

const TERRAIN_PATTERN = [
  { maxDist: 0, terrain: 'grassland', biome: 'Central Plains' },
  { maxDist: 1, terrain: 'forest', biome: 'Temperate Forest' },
  { maxDist: 2, terrains: ['mountain', 'desert', 'coastal', 'forest', 'tundra', 'grassland'], biomes: ['Highland Range', 'Arid Basin', 'Coral Shore', 'Boreal Forest', 'Frozen Waste', 'Savanna'] },
  { maxDist: 3, terrains: ['volcanic', 'tundra', 'desert', 'coastal', 'forest', 'mountain', 'grassland', 'forest', 'coastal', 'desert'], biomes: ['Volcanic Isle', 'Arctic Shelf', 'Sand Sea', 'Reef Coast', 'Mangrove', 'Rim Peak', 'Steppe', 'Rain Forest', 'Bay Shore', 'Dune Sea'] },
  { maxDist: 4, terrains: ['ocean', 'mountain', 'forest', 'desert', 'coastal', 'volcanic', 'tundra', 'grassland', 'forest', 'mountain', 'coastal', 'ocean'], biomes: ['Shallow Sea', 'High Pass', 'Dark Wood', 'Glass Desert', 'Tide Pool', 'Caldera', 'Permafrost', 'Wild Prairie', 'Old Growth', 'Iron Peak', 'Storm Coast', 'Deep Water'] },
  { maxDist: 5, terrains: ['ocean', 'ocean', 'tundra', 'mountain', 'ocean', 'forest', 'ocean', 'coastal', 'desert', 'ocean', 'volcanic', 'ocean', 'tundra', 'ocean', 'mountain', 'ocean'], biomes: ['Open Ocean', 'Deep Ocean', 'Ice Shelf', 'Rim Peak', 'Sea', 'Edge Forest', 'Open Water', 'Barrier Reef', 'Sand Sea', 'Abyss', 'Fire Isle', 'Strait', 'Frozen Edge', 'Bay', 'Summit', 'Channel'] },
  { maxDist: 6, terrains: ['ocean', 'coastal', 'mountain', 'ocean', 'forest', 'volcanic', 'ocean', 'tundra', 'desert', 'ocean', 'grassland', 'ocean', 'coastal', 'ocean', 'mountain', 'ocean', 'forest', 'ocean'], biomes: ['Outer Sea', 'Barrier Coast', 'Far Peak', 'Deep Channel', 'Wildwood', 'Ember Isle', 'Wide Strait', 'Frost Shelf', 'Dune Ridge', 'Abyss', 'Frontier Steppe', 'Tide Pool', 'Reef Edge', 'Bay Channel', 'Iron Summit', 'Narrows', 'Ancient Grove', 'Outer Depths'] },
  { maxDist: 7, terrains: ['ocean', 'ocean', 'ocean', 'coastal', 'ocean', 'ocean', 'mountain', 'ocean', 'ocean', 'volcanic', 'ocean', 'ocean', 'tundra', 'ocean', 'ocean', 'forest', 'ocean', 'ocean', 'desert', 'ocean'], biomes: ['Rim Ocean', 'Edge Water', 'Horizon Sea', 'Last Shore', 'World Edge', 'Void Sea', 'World Peak', 'Endless Deep', 'Far Reach', 'Caldera Isle', 'Storm Water', 'Twilight Sea', 'Ice Edge', 'Frozen Deep', 'Polar Sea', 'Edge Thicket', 'Glass Water', 'Mirror Sea', 'Sand Reach', 'Abyss Edge'] },
];

export function createHexGrid() {
  const hexes = generateHexGrid(RADIUS);
  const result = {};

  for (const hex of hexes) {
    const dist = Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(-hex.q - hex.r));
    const pattern = TERRAIN_PATTERN.find(p => p.maxDist >= dist) || TERRAIN_PATTERN[TERRAIN_PATTERN.length - 1];

    let terrain, biome;
    if (pattern.terrain) {
      terrain = pattern.terrain;
      biome = pattern.biome;
    } else {
      const idx = (Math.abs(hex.q * 7 + hex.r * 13)) % pattern.terrains.length;
      terrain = pattern.terrains[idx];
      biome = pattern.biomes[idx];
    }

    const terrainData = TERRAIN_TYPES[terrain];
    result[hex.id] = {
      id: hex.id,
      q: hex.q,
      r: hex.r,
      terrain,
      biome,
      controller: null,
      spiritIds: [],
      memoryPool: 0,
      memoryCap: 50,
      memoryRate: terrainData.memoryRate,
    };
  }

  return { radius: RADIUS, hexes: result };
}

export function getStartingPositions() {
  return startingPositions(RADIUS, 6);
}

export const HEX_COUNT = generateHexGrid(RADIUS).length; // 91
