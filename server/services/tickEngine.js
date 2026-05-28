import { resolveTimers } from './timerService.js';
import { accumulateMemories } from './memoryGenService.js';
import { runSpiritDecisions, runSpiritDialogs } from './spiritDecisionService.js';
import { runSwarmlingTick } from './swarmlingAI.js';
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

export function pauseGame() {
  if (!gameState || gameState.status !== 'active') return false;
  gameState.status = 'paused';
  broadcastStateChange(gameState);
  return true;
}

export function resumeGame() {
  if (!gameState || gameState.status !== 'paused') return false;
  gameState.status = 'active';
  broadcastStateChange(gameState);
  return true;
}

async function tick() {
  if (!gameState || gameState.status !== 'active') return;

  let events = [];
  try {
    // 1. Resolve completed timers (movements arrive, battles finish, spawns complete)
    events = await resolveTimers(gameState);
  } catch (err) {
    console.error('[tick] Timer resolution error (non-fatal):', err.message);
  }

  // 2. Accumulate memories in controlled hexes
  accumulateMemories(gameState);

  // 2b. Reset whisper charges every 30s + drift enemy resistance
  const now = Date.now();
  for (const player of Object.values(gameState.players)) {
    if (now - (player.lastWhisperReset || 0) >= 30_000) {
      player.whisperCharges = { swarm: 1, enemy: 1 };
      player.lastWhisperReset = now;
    }
  }
  for (const spirit of Object.values(gameState.spirits)) {
    if (!spirit.alive) continue;
    if (spirit.enemyResistance == null) spirit.enemyResistance = 50;
    if (spirit.bond.loyalty >= 75) {
      spirit.enemyResistance = Math.min(80, spirit.enemyResistance + 0.2);
    } else if (spirit.bond.loyalty < 25) {
      spirit.enemyResistance = Math.max(10, spirit.enemyResistance - 0.1);
    }
  }

  // 3. Swarmling AI — deterministic, no LLM calls
  runSwarmlingTick(gameState);

  // 3b. Captain/Hero decision cycle (LLM-powered, fire-and-forget)
  runSpiritDecisions(gameState);

  // 3c. Spirit dialog — spirits talk to each other and taunt enemies
  runSpiritDialogs(gameState);

  // 4. Check win condition
  const winner = checkWinCondition(gameState);
  if (winner) {
    gameState.status = 'finished';
    gameState.winner = winner;
    events.push({ type: 'game_over', winner });
  }

  // 5. Broadcast state delta to all connected clients
  broadcast(gameState, events);
}
