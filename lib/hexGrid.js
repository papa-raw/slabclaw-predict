import { generateHexGrid, hexId, startingPositions } from './hexMath.js';
import { TERRAIN_TYPES } from './terrainTypes.js';

const RADIUS = 7; // 169-hex map (7-ring) — expanded for 150 spirits

const TERRAIN_PATTERN = [
  { maxDist: 0, terrain: 'grassland', biome: 'Central Plains' },
  { maxDist: 1, terrain: 'forest', biome: 'Temperate Forest' },
  { maxDist: 2, terrains: ['mountain', 'desert', 'coastal', 'forest', 'tundra', 'grassland'], biomes: ['Highland Range', 'Arid Basin', 'Coral Shore', 'Boreal Forest', 'Frozen Waste', 'Savanna'] },
  { maxDist: 3, terrains: ['volcanic', 'tundra', 'desert', 'coastal', 'forest', 'mountain', 'grassland', 'forest', 'coastal', 'desert'], biomes: ['Volcanic Isle', 'Arctic Shelf', 'Sand Sea', 'Reef Coast', 'Mangrove', 'Rim Peak', 'Steppe', 'Rain Forest', 'Bay Shore', 'Dune Sea'] },
  { maxDist: 4, terrains: ['coastal', 'mountain', 'forest', 'desert', 'coastal', 'volcanic', 'tundra', 'grassland', 'forest', 'mountain', 'coastal', 'tundra'], biomes: ['Shallow Shore', 'High Pass', 'Dark Wood', 'Glass Desert', 'Tide Pool', 'Caldera', 'Permafrost', 'Wild Prairie', 'Old Growth', 'Iron Peak', 'Storm Coast', 'Frost Reach'] },
  { maxDist: 5, terrains: ['coastal', 'desert', 'tundra', 'mountain', 'grassland', 'forest', 'volcanic', 'coastal', 'desert', 'tundra', 'volcanic', 'forest', 'tundra', 'coastal', 'mountain', 'grassland'], biomes: ['Storm Shore', 'Dust Reach', 'Ice Shelf', 'Rim Peak', 'Wild Steppe', 'Edge Forest', 'Ember Field', 'Barrier Reef', 'Sand Sea', 'Frozen Pass', 'Fire Isle', 'Dark Thicket', 'Frozen Edge', 'Bay Shore', 'Summit', 'Frontier'] },
  { maxDist: 6, terrains: ['tundra', 'coastal', 'mountain', 'desert', 'forest', 'volcanic', 'grassland', 'tundra', 'desert', 'coastal', 'grassland', 'forest', 'coastal', 'volcanic', 'mountain', 'tundra', 'forest', 'desert'], biomes: ['Outer Frost', 'Barrier Coast', 'Far Peak', 'Dune Channel', 'Wildwood', 'Ember Isle', 'Wide Steppe', 'Frost Shelf', 'Dune Ridge', 'Reef Edge', 'Frontier Steppe', 'Dark Grove', 'Storm Coast', 'Lava Flow', 'Iron Summit', 'Frozen Narrows', 'Ancient Grove', 'Sand Reach'] },
  { maxDist: 7, terrains: ['tundra', 'coastal', 'desert', 'coastal', 'volcanic', 'forest', 'mountain', 'tundra', 'grassland', 'volcanic', 'coastal', 'desert', 'tundra', 'mountain', 'forest', 'forest', 'coastal', 'grassland', 'desert', 'tundra'], biomes: ['Rim Frost', 'Edge Shore', 'Horizon Dune', 'Last Shore', 'World Forge', 'Edge Thicket', 'World Peak', 'Frozen Deep', 'Far Reach', 'Caldera Isle', 'Storm Shore', 'Twilight Dune', 'Ice Edge', 'Frozen Peak', 'Polar Wood', 'Edge Forest', 'Glass Shore', 'Mirror Steppe', 'Sand Reach', 'Abyss Frost'] },
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
