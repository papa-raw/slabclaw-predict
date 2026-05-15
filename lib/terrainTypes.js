export const TERRAIN_TYPES = {
  forest: { memoryRate: 1.2, defenseMult: 1.2, label: 'Forest', spiritAffinity: ['scout', 'gatherer'] },
  desert: { memoryRate: 0.8, defenseMult: 1.0, label: 'Desert', spiritAffinity: ['warrior'] },
  ocean: { memoryRate: 1.0, defenseMult: 1.4, label: 'Ocean', spiritAffinity: ['scout'] },
  mountain: { memoryRate: 0.6, defenseMult: 1.3, label: 'Mountain', spiritAffinity: ['sage'] },
  grassland: { memoryRate: 1.5, defenseMult: 1.0, label: 'Grassland', spiritAffinity: ['gatherer'] },
  tundra: { memoryRate: 0.5, defenseMult: 1.1, label: 'Tundra', spiritAffinity: ['warrior'] },
  volcanic: { memoryRate: 0.4, defenseMult: 1.0, label: 'Volcanic', spiritAffinity: ['warrior'] },
  coastal: { memoryRate: 1.3, defenseMult: 1.1, label: 'Coastal', spiritAffinity: ['scout', 'gatherer'] },
};

export const TERRAIN_COLORS = {
  forest: '#166534',
  desert: '#a16207',
  ocean: '#1e40af',
  mountain: '#57534e',
  grassland: '#4d7c0f',
  tundra: '#94a3b8',
  volcanic: '#991b1b',
  coastal: '#0e7490',
};

// Player color palette — assigned by join order, not by ID string.
// Use getPlayerColor(playerId, gameState) to resolve wallet addresses to colors.
const PLAYER_COLOR_PALETTE = ['#ef4444', '#3b82f6', '#22c55e', '#a855f7', '#f97316'];
const playerColorCache = new Map();

export function getPlayerColor(playerId, gameState) {
  if (playerColorCache.has(playerId)) return playerColorCache.get(playerId);
  const playerIds = Object.keys(gameState?.players || {});
  const index = playerIds.indexOf(playerId);
  const color = PLAYER_COLOR_PALETTE[index >= 0 ? index % PLAYER_COLOR_PALETTE.length : 0];
  playerColorCache.set(playerId, color);
  return color;
}

export function resetPlayerColors() { playerColorCache.clear(); }

export const SPEC_COLORS = {
  warrior: '#dc2626',
  scout: '#2563eb',
  gatherer: '#16a34a',
  sage: '#9333ea',
  generalist: '#6b7280',
};
