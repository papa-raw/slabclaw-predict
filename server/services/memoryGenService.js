export function accumulateMemories(gameState) {
  for (const hex of Object.values(gameState.map.hexes)) {
    if (hex.controller) {
      hex.memoryPool = Math.round(Math.min(
        hex.memoryCap || 50,
        (hex.memoryPool || 0) + (hex.memoryRate || 1)
      ) * 10) / 10;
    }
  }
}
