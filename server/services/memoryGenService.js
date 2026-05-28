export function accumulateMemories(gameState) {
  const hexes = Object.values(gameState.map.hexes);
  for (const hex of hexes) {
    if (Math.random() < 0.03) {
      const deposit = 8 + Math.floor(Math.random() * 12);
      hex.memoryPool = Math.round(Math.min(
        hex.memoryCap || 80,
        (hex.memoryPool || 0) + deposit
      ) * 10) / 10;
    }
  }
}
