export function accumulateMemories(gameState) {
  const hexes = Object.values(gameState.map.hexes);
  const landHexes = hexes.filter(h => h.terrain !== 'ocean');

  for (const hex of landHexes) {
    if (Math.random() < 0.03) {
      const deposit = 8 + Math.floor(Math.random() * 12);
      hex.memoryPool = Math.round(Math.min(
        hex.memoryCap || 80,
        (hex.memoryPool || 0) + deposit
      ) * 10) / 10;
    }
  }
}
