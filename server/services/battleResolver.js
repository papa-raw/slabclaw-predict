import { storeMemoryServer } from './memwalServer.js';
import { applyBondAction } from './bondService.js';
import { claimHex, findRetreatHex } from './territoryService.js';
import { evaluateBattle } from './battleArbiterService.js';
import { recordBattle } from './suiService.js';
import { createMemory } from './memoryEngine.js';

export async function resolveBattle(gameState, timer) {
  const { attackerId, defenderId, hexId } = timer.data;
  const attacker = gameState.spirits[attackerId];
  const defender = gameState.spirits[defenderId];

  if (!attacker || !defender) {
    return { type: 'battle_cancelled', reason: 'Spirit missing', hexId };
  }

  const hex = gameState.map.hexes[hexId];
  const terrain = hex?.terrain || 'unknown';

  const evaluation = await evaluateBattle({ attacker, defender, terrain, gameState });

  const winnerSpirit = evaluation.winner === 'attacker' ? attacker : defender;
  const loserSpirit = evaluation.winner === 'attacker' ? defender : attacker;

  applyBondAction(winnerSpirit, 'battleWin');
  applyBondAction(loserSpirit, 'battleLoss');
  winnerSpirit.combatXP = (winnerSpirit.combatXP || 0) + 5;
  loserSpirit.combatXP = (loserSpirit.combatXP || 0) + 2;
  winnerSpirit.kills = (winnerSpirit.kills || 0) + 1;

  // Clear battling action on both spirits
  winnerSpirit.currentAction = null;
  loserSpirit.currentAction = null;

  const margin = Math.abs(
    (evaluation.scores?.attacker?.totalScore || 15) -
    (evaluation.scores?.defender?.totalScore || 15)
  );

  // HP damage — loser takes margin-scaled damage, winner takes minor chip damage
  if (loserSpirit.maxHp == null) loserSpirit.maxHp = 100;
  if (loserSpirit.hp == null) loserSpirit.hp = loserSpirit.maxHp;
  if (winnerSpirit.maxHp == null) winnerSpirit.maxHp = 100;
  if (winnerSpirit.hp == null) winnerSpirit.hp = winnerSpirit.maxHp;

  const loserDmg = 15 + margin * 3;
  const winnerDmg = Math.max(3, 10 - margin);
  loserSpirit.hp = Math.max(0, loserSpirit.hp - loserDmg);
  winnerSpirit.hp = Math.max(1, winnerSpirit.hp - winnerDmg);

  let loserOutcome;
  const isDead = loserSpirit.hp <= 0;

  if (isDead) {
    loserSpirit.alive = false;
    loserSpirit.hp = 0;
    loserSpirit.currentAction = null;
    const loserHex = gameState.map.hexes[loserSpirit.hexId];
    if (loserHex) {
      loserHex.spiritIds = loserHex.spiritIds.filter(id => id !== loserSpirit.id);
    }
    loserOutcome = 'died';
    if (gameState.players[loserSpirit.playerId]) {
      gameState.players[loserSpirit.playerId].spiritCount = Math.max(
        0,
        (gameState.players[loserSpirit.playerId].spiritCount || 0) - 1
      );
    }
  } else {
    // Retreat with HP remaining
    const retreatHexId = findRetreatHex(loserSpirit, gameState);
    if (retreatHexId) {
      const fromHex = gameState.map.hexes[loserSpirit.hexId];
      if (fromHex) {
        fromHex.spiritIds = fromHex.spiritIds.filter(id => id !== loserSpirit.id);
      }
      const toHex = gameState.map.hexes[retreatHexId];
      if (toHex) toHex.spiritIds.push(loserSpirit.id);
      loserSpirit.hexId = retreatHexId;
      loserOutcome = 'retreated';
    } else {
      // Surrounded — dies
      loserSpirit.alive = false;
      loserSpirit.hp = 0;
      const loserHex = gameState.map.hexes[loserSpirit.hexId];
      if (loserHex) {
        loserHex.spiritIds = loserHex.spiritIds.filter(id => id !== loserSpirit.id);
      }
      loserOutcome = 'died';
      if (gameState.players[loserSpirit.playerId]) {
        gameState.players[loserSpirit.playerId].spiritCount = Math.max(
          0,
          (gameState.players[loserSpirit.playerId].spiritCount || 0) - 1
        );
      }
    }
  }

  // Winner claims the hex
  claimHex(hexId, winnerSpirit.playerId, gameState);
  winnerSpirit.hexesClaimed = (winnerSpirit.hexesClaimed || 0) + 1;

  // Track memorable actions for essence export
  winnerSpirit.memorableActions = winnerSpirit.memorableActions || [];
  winnerSpirit.memorableActions.push(`Defeated ${loserSpirit.name} in the ${terrain}`);
  if (winnerSpirit.memorableActions.length > 10) winnerSpirit.memorableActions = winnerSpirit.memorableActions.slice(-10);

  // Structured memories for the memory engine
  if (winnerSpirit.tier === 'captain') {
    createMemory(winnerSpirit, 'BATTLE', 'WIN', { spiritId: loserSpirit.id, playerId: loserSpirit.playerId }, gameState);
  }
  if (loserSpirit.tier === 'captain') {
    createMemory(loserSpirit, 'BATTLE', 'LOSS', { spiritId: winnerSpirit.id, playerId: winnerSpirit.playerId }, gameState);
    if (loserOutcome === 'died') {
      createMemory(loserSpirit, 'DEATH_WITNESS', 'LOSS', { spiritId: winnerSpirit.id, playerId: winnerSpirit.playerId }, gameState);
    }
  }

  // Store battle memories + record on chain
  const battleLog = `[BATTLE] ${attacker.name} vs ${defender.name} at hex ${hexId} (${terrain}). ${winnerSpirit.name} wins. Loser ${loserOutcome}.`;
  const battleMargin = Math.abs(
    (evaluation.scores?.attacker?.totalScore || 0) - (evaluation.scores?.defender?.totalScore || 0)
  );
  Promise.allSettled([
    storeMemoryServer(attacker.memwalNamespace, battleLog),
    storeMemoryServer(defender.memwalNamespace, battleLog),
    recordBattle(attacker.id, defender.id, winnerSpirit.id, battleMargin, terrain)
      .then(objectId => {
        if (objectId) {
          gameState.events = gameState.events || [];
          gameState.events.push({
            type: 'chain_op', opType: 'battle_record', suiObjectId: objectId,
            label: `Battle: ${attacker.name} vs ${defender.name}`,
            timestamp: Date.now(),
          });
        }
      }),
  ]);
  attacker.memoryCount = (attacker.memoryCount || 0) + 1;
  defender.memoryCount = (defender.memoryCount || 0) + 1;

  gameState.eventLog = gameState.eventLog || [];
  gameState.eventLog.push({
    type: 'battle_resolved',
    playerId: winnerSpirit.playerId,
    targetPlayerId: loserSpirit.playerId,
    spiritId: winnerSpirit.id,
    timestamp: Date.now(),
    summary: battleLog,
  });

  const event = {
    type: 'battle_resolved',
    attackerId,
    attackerName: attacker.name,
    defenderId,
    defenderName: defender.name,
    hexId,
    winnerId: winnerSpirit.id,
    winnerName: winnerSpirit.name,
    loserId: loserSpirit.id,
    loserName: loserSpirit.name,
    loserOutcome,
    narrative: evaluation.narrative,
    attackerInvocation: evaluation.attackerInvocation,
    defenderInvocation: evaluation.defenderInvocation,
    margin: evaluation.scores ? Math.abs(
      (evaluation.scores.attacker?.totalScore || 0) - (evaluation.scores.defender?.totalScore || 0)
    ) : 0,
    scores: evaluation.scores,
  };

  gameState.events = gameState.events || [];
  gameState.events.push(event);
  if (gameState.events.length > 200) gameState.events = gameState.events.slice(-200);

  return event;
}
