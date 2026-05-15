import { resolveTimers } from './timerService.js';
import { accumulateMemories } from './memoryGenService.js';
import { runSpiritDecisions } from './spiritDecisionService.js';
import { checkWinCondition } from './winService.js';
import { broadcast, broadcastStateChange } from './wsService.js';
import { createInitialGameState } from './gameInit.js';
import { clearKeys } from './keyStore.js';

let gameState = null;
let tickIntervalId = null;

export function initGame(state) {
  gameState = state;
  tickIntervalId = setInterval(tick, gameState.tickInterval);
}

/**
 * Restart the game: create fresh state, restart tick, notify WS clients.
 * Returns the new gameState.
 */
export async function restartGame(setterCallbacks = []) {
  // Stop current tick
  if (tickIntervalId) {
    clearInterval(tickIntervalId);
    tickIntervalId = null;
  }

  // Clear spirit delegate keys
  clearKeys();

  // Create fresh game state
  const newState = await createInitialGameState();
  gameState = newState;

  // Update all route getters to point at new state
  for (const setter of setterCallbacks) {
    setter(() => gameState);
  }

  // Start fresh tick
  tickIntervalId = setInterval(tick, gameState.tickInterval);

  // Notify all WS clients
  broadcastStateChange(gameState);

  return gameState;
}

export function getCurrentGameState() {
  return gameState;
}

async function tick() {
  if (!gameState || gameState.status !== 'active') return;

  // 1. Resolve completed timers (movements arrive, battles finish, spawns complete)
  const events = await resolveTimers(gameState);

  // 2. Accumulate memories in controlled hexes
  accumulateMemories(gameState);

  // 3. Spirit decision cycle (fire-and-forget, async)
  runSpiritDecisions(gameState);

  // 4. Check win condition
  const winner = checkWinCondition(gameState);
  if (winner) {
    gameState.status = 'finished';
    gameState.winner = winner;
    events.push({ type: 'game_over', winner });
  }

  // 5. Broadcast state delta to all connected clients
  // Always broadcast so clients stay in sync
  broadcast(gameState, events);
}
