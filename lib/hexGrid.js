import { generateHexGrid, hexId, startingPositions } from './hexMath.js';
import { TERRAIN_TYPES } from './terrainTypes.js';

const RADIUS = 3; // 37-hex map (3-ring)

// Terrain assignment pattern: center ring = contested high-value, edges = varied
const TERRAIN_PATTERN = [
  // Ring 0 (center): grassland (high value, contested)
  { maxDist: 0, terrain: 'grassland', biome: 'Central Plains' },
  // Ring 1: mixed forest/coastal
  { maxDist: 1, terrain: 'forest', biome: 'Temperate Forest' },
  // Ring 2: varied
  { maxDist: 2, terrains: ['mountain', 'desert', 'coastal', 'forest', 'tundra', 'grassland'], biomes: ['Highland Range', 'Arid Basin', 'Coral Shore', 'Boreal Forest', 'Frozen Waste', 'Savanna'] },
  // Ring 3 (edge): varied with some ocean
  { maxDist: 3, terrains: ['ocean', 'volcanic', 'tundra', 'desert', 'coastal', 'forest', 'mountain', 'grassland', 'ocean', 'forest', 'coastal', 'ocean'], biomes: ['Deep Ocean', 'Volcanic Isle', 'Arctic Shelf', 'Sand Sea', 'Reef Coast', 'Mangrove', 'Rim Peak', 'Steppe', 'Open Water', 'Rain Forest', 'Bay Shore', 'Sea'] },
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
  return startingPositions(RADIUS, 5);
}

export const HEX_COUNT = generateHexGrid(RADIUS).length; // 37
