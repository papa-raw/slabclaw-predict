import { resolveBattle } from './battleResolver.js';
import { resolveSpawn } from './spawnResolver.js';
import { evaluateSpecialization } from '../../lib/memoryClassifier.js';
import { claimHex } from './territoryService.js';

let nextTimerId = 1;

export function startTimer(gameState, { type, spiritId, duration, data }) {
  const timer = {
    id: String(nextTimerId++),
    type,
    spiritId,
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data,
  };
  gameState.activeTimers.push(timer);
  return timer;
}

export async function resolveTimers(gameState) {
  const now = Date.now();
  const completed = gameState.activeTimers.filter(t => now >= t.completesAt);
  gameState.activeTimers = gameState.activeTimers.filter(t => now < t.completesAt);

  const events = [];
  for (const timer of completed) {
    try {
      const event = await resolveTimer(timer, gameState);
      if (event) events.push(event);
    } catch (err) {
      console.error(`[timer] Failed to resolve ${timer.type} for ${timer.spiritId}:`, err.message);
      const spirit = gameState.spirits[timer.spiritId];
      if (spirit) spirit.currentAction = null;
    }
  }
  return events;
}

async function resolveTimer(timer, gameState) {
  const spirit = gameState.spirits[timer.spiritId];
  if (!spirit) return null;

  // Always clear the spirit's current action when their timer completes
  spirit.currentAction = null;

  switch (timer.type) {
    case 'movement': {
      const fromHex = gameState.map.hexes[timer.data.fromHex];
      const toHex = gameState.map.hexes[timer.data.toHex];

      if (fromHex) {
        fromHex.spiritIds = fromHex.spiritIds.filter(id => id !== spirit.id);
      }

      if (toHex) {
        // Only add if not already present
        if (!toHex.spiritIds.includes(spirit.id)) {
          toHex.spiritIds.push(spirit.id);
        }

        // Check for enemy spirits on the destination hex — auto-engage
        const enemyOnHex = toHex.spiritIds.find(id => {
          const s = gameState.spirits[id];
          return s && s.id !== spirit.id && s.playerId !== spirit.playerId && s.alive && s.currentAction?.type !== 'battling';
        });

        if (enemyOnHex) {
          // Auto-start battle with the first enemy found
          const battleDuration = 30_000;
          startTimer(gameState, {
            type: 'battle',
            spiritId: spirit.id,
            duration: battleDuration,
            data: { attackerId: spirit.id, defenderId: enemyOnHex, hexId: toHex.id },
          });
          spirit.hexId = timer.data.toHex;
          spirit.currentAction = { type: 'battling', startedAt: Date.now(), completesAt: Date.now() + battleDuration };
          const defender = gameState.spirits[enemyOnHex];
          if (defender) {
            defender.currentAction = { type: 'battling', startedAt: Date.now(), completesAt: Date.now() + battleDuration };
          }
          spirit.explorationXP = (spirit.explorationXP || 0) + 2;
          evaluateSpecialization(spirit);
          return {
            type: 'battle_started',
            attackerId: spirit.id,
            attackerName: spirit.name,
            defenderId: enemyOnHex,
            defenderName: defender?.name || '?',
            hexId: toHex.id,
            autoEngaged: true,
          };
        }

        // Territory claim logic:
        // - Unclaimed: auto-claim
        // - Enemy hex: claim if spirit's team has a presence and enemy doesn't
        const myTeamCount = toHex.spiritIds.filter(
          id => gameState.spirits[id]?.playerId === spirit.playerId
        ).length;
        const enemyCount = toHex.spiritIds.filter(id => {
          const s = gameState.spirits[id];
          return s && s.playerId !== spirit.playerId && s.alive;
        }).length;

        if (!toHex.controller) {
          toHex.controller = spirit.playerId;
          if (gameState.players[spirit.playerId]) {
            gameState.players[spirit.playerId].hexesControlled =
              (gameState.players[spirit.playerId].hexesControlled || 0) + 1;
          }
        } else if (toHex.controller !== spirit.playerId && myTeamCount > 0 && enemyCount === 0) {
          claimHex(toHex.id, spirit.playerId, gameState);
        }
      }

      spirit.hexId = timer.data.toHex;
      spirit.explorationXP = (spirit.explorationXP || 0) + 2;
      evaluateSpecialization(spirit);

      return {
        type: 'movement_complete',
        spiritId: spirit.id,
        fromHex: timer.data.fromHex,
        toHex: timer.data.toHex,
        isExploration: timer.data.isExploration || false,
      };
    }

    case 'battle': {
      // timer.spiritId is the attacker; timer.data has attackerId + defenderId
      const result = await resolveBattle(gameState, timer);
      const winner = result.winnerId ? gameState.spirits[result.winnerId] : null;
      if (winner) evaluateSpecialization(winner);
      return result;
    }

    case 'spawn': {
      const result = await resolveSpawn(gameState, timer);
      return result;
    }

    case 'whisper_propagation': {
      const targetSpirit = gameState.spirits[timer.data.targetSpiritId];
      if (targetSpirit) {
        targetSpirit.whispersReceived = (targetSpirit.whispersReceived || 0) + 1;
      }
      return {
        type: 'whisper_arrived',
        from: timer.spiritId,
        to: timer.data.targetSpiritId,
        text: timer.data.whisperText,
      };
    }

    default:
      return null;
  }
}
