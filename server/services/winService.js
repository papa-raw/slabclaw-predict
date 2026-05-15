const WIN_PERCENT = 0.5;
const MAX_TICKS = 500;

export function checkWinCondition(gameState) {
  const totalHexes = Object.keys(gameState.map.hexes).length;
  const threshold = Math.ceil(totalHexes * WIN_PERCENT);

  // Territory domination
  for (const player of Object.values(gameState.players)) {
    if ((player.hexesControlled || 0) >= threshold) {
      return player.id;
    }
  }

  // Last player standing
  const playersWithLivingSpirits = new Set();
  for (const spirit of Object.values(gameState.spirits)) {
    if (spirit.alive) playersWithLivingSpirits.add(spirit.playerId);
  }
  if (playersWithLivingSpirits.size === 1) {
    return [...playersWithLivingSpirits][0];
  }

  // Max duration timeout — player with most territory wins
  gameState._tickCount = (gameState._tickCount || 0) + 1;
  if (gameState._tickCount >= MAX_TICKS) {
    let leader = null;
    let maxHexes = 0;
    for (const player of Object.values(gameState.players)) {
      if ((player.hexesControlled || 0) > maxHexes) {
        maxHexes = player.hexesControlled || 0;
        leader = player.id;
      }
    }
    return leader;
  }

  return null;
}
