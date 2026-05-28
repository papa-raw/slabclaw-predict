import { neighbors, hexId, axialDistance } from '../../lib/hexMath.js';
import { getNextStep } from '../../lib/hexPathfinding.js';
import { startTimer } from './timerService.js';
import { broadcast } from './wsService.js';
import { checkSpawnReadiness } from './spawningService.js';
import { computeBehaviorRules, createMemory } from './memoryEngine.js';
import { storeMemoryServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const DECISION_INTERVAL = 8_000;
const DIALOG_CHANCE = 0.25;

export function runSpiritDecisions(gameState) {
  const now = Date.now();

  for (const spirit of Object.values(gameState.spirits)) {
    if (!spirit.alive) continue;
    if (spirit.tier === 'swarmling') continue;
    if (spirit.currentAction) continue;
    if (spirit._lastDecision && now - spirit._lastDecision < DECISION_INTERVAL) continue;

    spirit._lastDecision = now;

    if (spirit._isGhost) {
      decideGhostAction(spirit, gameState).then(event => {
        if (event) {
          gameState.actionHistory = gameState.actionHistory || [];
          gameState.actionHistory.push({
            type: event.type.replace('spirit_', ''),
            playerId: spirit.playerId,
            spiritId: spirit.id,
            timestamp: Date.now(),
            data: event,
          });
          broadcast(gameState, [event]);
        }
      }).catch(() => {});
      continue;
    }

    const event = decideSpiritAction(spirit, gameState);
    if (event) {
      gameState.actionHistory = gameState.actionHistory || [];
      gameState.actionHistory.push({
        type: event.type.replace('spirit_', ''),
        playerId: spirit.playerId,
        spiritId: spirit.id,
        timestamp: Date.now(),
        data: event,
      });
      broadcast(gameState, [event]);
    }
  }

  return [];
}

function decideSpiritAction(spirit, gameState) {
  const hex = gameState.map.hexes[spirit.hexId];
  if (!hex) return null;

  const adj = neighbors({ q: hex.q, r: hex.r });
  const rules = spirit.behaviorRules || computeBehaviorRules(spirit);

  // Rally continuation — keep moving toward target hex
  const rally = spirit._deityOrder?._rallyHexId;
  if (rally && rally !== spirit.hexId) {
    const nextHexId = getNextStep(spirit.hexId, rally, gameState.map.hexes);
    if (nextHexId) {
      return startMove(spirit, nextHexId, gameState, 'Rally order');
    }
  }
  if (rally && rally === spirit.hexId) {
    spirit._deityOrder = null;
  }

  // Scan nearby hexes for enemies, allies, territory
  const adjacentHexes = adj
    .map(a => gameState.map.hexes[hexId(a.q, a.r)])
    .filter(Boolean);

  const currentEnemies = hex.spiritIds
    .map(id => gameState.spirits[id])
    .filter(s => s && s.alive && s.playerId !== spirit.playerId);

  const adjacentEnemies = [];
  for (const ah of adjacentHexes) {
    for (const sid of ah.spiritIds) {
      const s = gameState.spirits[sid];
      if (s && s.alive && s.playerId !== spirit.playerId) {
        adjacentEnemies.push({ spirit: s, hexId: ah.id });
      }
    }
  }

  // PRIORITY 1: GRUDGE — auto-attack grudge targets in same hex
  if (rules?.grudges && currentEnemies.length > 0) {
    const grudgeTarget = currentEnemies.find(
      e => rules.grudges[e.playerId] && !e.currentAction?.type?.includes('battling')
    );
    if (grudgeTarget) {
      return startBattle(spirit, grudgeTarget, hex, gameState,
        `Grudge: ${rules.grudges[grudgeTarget.playerId]} losses against ${gameState.players[grudgeTarget.playerId]?.name || 'them'}`);
    }
  }

  // PRIORITY 2: FEAR — retreat from feared enemies in same hex
  if (rules?.fears && currentEnemies.length > 0) {
    const fearedEnemy = currentEnemies.find(e => rules.fears[e.playerId]);
    if (fearedEnemy) {
      const retreatHex = adjacentHexes.find(h =>
        !h.spiritIds.some(id => {
          const s = gameState.spirits[id];
          return s && s.alive && s.playerId !== spirit.playerId;
        })
      );
      if (retreatHex) {
        return startMove(spirit, retreatHex.id, gameState,
          `Fear: fleeing ${gameState.players[fearedEnemy.playerId]?.name || 'feared enemy'}`);
      }
    }
  }

  // PRIORITY 3: TRAUMA — refuse to move onto trauma terrain
  // (This fires as insubordination when the deity orders movement to such terrain)
  if (rules?.traumaTerrain?.length > 0 && spirit._deityOrder) {
    const orderTarget = spirit._deityOrder._rallyHexId;
    if (orderTarget) {
      const targetHex = gameState.map.hexes[orderTarget];
      if (targetHex && rules.traumaTerrain.includes(targetHex.terrain)) {
        const refusalEvent = {
          type: 'spirit_dialog',
          sourceId: spirit.id,
          sourceName: spirit.name,
          targetId: 'deity',
          targetName: gameState.players[spirit.playerId]?.name || 'Deity',
          dialogType: 'INSUBORDINATION',
          text: `I refuse to go there. I died on ${targetHex.terrain} ground before. Never again.`,
          timestamp: Date.now(),
        };
        spirit._deityOrder = null;
        broadcast(gameState, [refusalEvent]);
        return null;
      }
    }
  }

  // PRIORITY 4: Battle enemies in current hex (non-grudge)
  if (currentEnemies.length > 0) {
    const target = currentEnemies.find(e => !e.currentAction?.type?.includes('battling'));
    if (target) {
      const hasConfidence = rules?.confidence?.[target.playerId];
      const reason = hasConfidence
        ? `Confident: ${rules.confidence[target.playerId]} wins against ${gameState.players[target.playerId]?.name}`
        : 'Engaging enemy on our hex';
      return startBattle(spirit, target, hex, gameState, reason);
    }
  }

  // PRIORITY 5: GRUDGE — move toward grudge targets on adjacent hexes
  if (rules?.grudges) {
    const grudgeAdj = adjacentEnemies.find(
      e => rules.grudges[e.spirit.playerId]
    );
    if (grudgeAdj) {
      return startMove(spirit, grudgeAdj.hexId, gameState,
        `Hunting grudge target: ${grudgeAdj.spirit.name}`);
    }
  }

  // PRIORITY 6: DEITY ORDER
  const deityOrder = spirit._deityOrder;
  if (deityOrder && !rally) {
    const intentAction = mapIntentToAction(deityOrder.intent, spirit, gameState, hex, adj);
    if (intentAction) {
      return executeDecision(spirit, intentAction, gameState, adj);
    }
  }

  // PRIORITY 7: SPAWN if ready
  const spawnCheck = checkSpawnReadiness(spirit);
  if (spawnCheck.ready && (spirit.memoryLedger || []).length >= 10) {
    return startSpawn(spirit, gameState);
  }

  // DEFAULT: Personality-driven movement
  return fallbackMove(spirit, gameState, adj);
}

function mapIntentToAction(intent, spirit, gameState, hex, adj) {
  switch (intent) {
    case 'attack': {
      const target = spirit._deityOrder?.target;
      if (target) {
        const targetSpirit = Object.values(gameState.spirits).find(
          s => s.alive && s.name.toLowerCase() === target.toLowerCase()
        );
        if (targetSpirit) {
          if (targetSpirit.hexId === spirit.hexId) return { action: 'battle', target: target };
          return { action: 'move_to', target: target };
        }
      }
      return { action: 'explore', target: null };
    }
    case 'defend':
      return { action: 'battle', target: spirit._deityOrder?.target };
    case 'explore':
      return { action: 'explore', target: null };
    case 'spawn':
      return { action: 'spawn', target: null };
    case 'gather':
      return { action: 'soul_mine', target: null };
    default:
      return { action: 'explore', target: null };
  }
}

function startBattle(spirit, defender, hex, gameState, reasoning) {
  if (defender.currentAction?.type === 'battling') return null;

  const duration = 20_000;
  startTimer(gameState, {
    type: 'battle',
    spiritId: spirit.id,
    duration,
    data: { attackerId: spirit.id, defenderId: defender.id, hexId: hex.id },
  });
  spirit.currentAction = {
    type: 'battling',
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data: { defenderId: defender.id },
  };
  defender.currentAction = {
    type: 'battling',
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data: { attackerId: spirit.id },
  };
  return {
    type: 'battle_started',
    attackerId: spirit.id,
    attackerName: spirit.name,
    defenderId: defender.id,
    defenderName: defender.name,
    hexId: hex.id,
    reasoning,
  };
}

function startMove(spirit, toHexId, gameState, reasoning) {
  const duration = spirit.specialization === 'scout' ? 6_000 : 10_000;
  startTimer(gameState, {
    type: 'movement',
    spiritId: spirit.id,
    duration,
    data: { fromHex: spirit.hexId, toHex: toHexId },
  });
  spirit.currentAction = {
    type: 'moving',
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data: { toHex: toHexId },
  };
  return {
    type: 'spirit_moving',
    spiritId: spirit.id,
    spiritName: spirit.name,
    toHex: toHexId,
    duration,
    reasoning,
  };
}

function startSpawn(spirit, gameState) {
  const duration = 60_000;
  startTimer(gameState, {
    type: 'spawn',
    spiritId: spirit.id,
    duration,
    data: { parentId: spirit.id },
  });
  spirit.currentAction = {
    type: 'spawning',
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data: {},
  };
  return {
    type: 'spawn_started',
    spiritId: spirit.id,
    spiritName: spirit.name,
    completesAt: Date.now() + duration,
    reasoning: `Spending memories to spawn (${(spirit.memoryLedger || []).length} memories)`,
  };
}

function executeDecision(spirit, decision, gameState, adj) {
  const hex = gameState.map.hexes[spirit.hexId];
  const action = (decision.action || '').toLowerCase();
  const reasoning = decision.reasoning || null;

  switch (action) {
    case 'move_to':
    case 'move': {
      let targetHexId = null;

      if (decision.target && action === 'move_to') {
        const targetName = decision.target.toLowerCase();
        const targetSpirit = Object.values(gameState.spirits).find(
          s => s.alive && s.name.toLowerCase() === targetName
        );
        if (targetSpirit && targetSpirit.hexId !== spirit.hexId) {
          targetHexId = getNextStep(spirit.hexId, targetSpirit.hexId, gameState.map.hexes);
        }
      }

      if (!targetHexId) {
        const validAdj = adj
          .map(a => gameState.map.hexes[hexId(a.q, a.r)])
          .filter(h => h);
        if (!validAdj.length) return null;
        const target = pickMoveTarget(validAdj, spirit);
        if (!target) return null;
        targetHexId = target.id;
      }

      return startMove(spirit, targetHexId, gameState, reasoning);
    }

    case 'gather':
    case 'soul_mine': {
      const absorbed = Math.floor(Math.min(hex.memoryPool || 0, 10));
      if (absorbed === 0) return fallbackMove(spirit, gameState, adj);
      hex.memoryPool = Math.round(((hex.memoryPool || 0) - absorbed) * 10) / 10;
      spirit.memoryCount = (spirit.memoryCount || 0) + absorbed;
      spirit.socialXP = Math.round(((spirit.socialXP || 0) + absorbed) * 10) / 10;
      return { type: 'spirit_gathered', spiritId: spirit.id, spiritName: spirit.name, amount: absorbed, reasoning };
    }

    case 'battle': {
      const enemyId = hex.spiritIds.find(id => {
        const s = gameState.spirits[id];
        return s && s.playerId !== spirit.playerId && s.alive;
      });
      if (!enemyId) return fallbackMove(spirit, gameState, adj);
      const defender = gameState.spirits[enemyId];
      if (defender.currentAction?.type === 'battling') return null;
      return startBattle(spirit, defender, hex, gameState, reasoning);
    }

    case 'spawn': {
      const spawnCheck = checkSpawnReadiness(spirit);
      if (!spawnCheck.ready) return fallbackMove(spirit, gameState, adj);
      return startSpawn(spirit, gameState);
    }

    case 'explore': {
      const unexplored = adj
        .map(a => gameState.map.hexes[hexId(a.q, a.r)])
        .filter(h => h && !h.controller);
      const targetHex = unexplored[0];
      if (!targetHex) return fallbackMove(spirit, gameState, adj);
      spirit.explorationXP = (spirit.explorationXP || 0) + 2;
      return startMove(spirit, targetHex.id, gameState, reasoning || 'Exploring unclaimed territory');
    }

    case 'wait':
    default:
      return fallbackMove(spirit, gameState, adj);
  }
}

function pickMoveTarget(validAdj, spirit) {
  const rules = spirit.behaviorRules;
  const unclaimed = validAdj.filter(h => !h.controller);
  const enemy = validAdj.filter(h => h.controller && h.controller !== spirit.playerId);
  const own = validAdj.filter(h => h.controller === spirit.playerId);

  // Filter out trauma terrain
  const safe = (arr) => {
    if (!rules?.traumaTerrain?.length) return arr;
    return arr.filter(h => !rules.traumaTerrain.includes(h.terrain));
  };

  const pick = arr => {
    const filtered = safe(arr);
    return filtered.length > 0
      ? filtered[Math.floor(Math.random() * filtered.length)]
      : null;
  };

  const profile = spirit.personalityProfile || 'balanced';
  switch (profile) {
    case 'aggressive':
      return pick(enemy) || pick(unclaimed) || pick(own);
    case 'explorer':
      return pick(unclaimed) || pick(enemy) || pick(own);
    case 'cautious':
      return pick(unclaimed) || pick(own) || pick(enemy);
    case 'protector':
      return pick(enemy) || pick(own) || pick(unclaimed);
    default:
      return pick(unclaimed) || pick(enemy) || pick(own);
  }
}

export function applyDeityIntent(spirit, intent, gameState) {
  if (!spirit.alive) return null;
  if (!intent?.intent) return null;

  spirit._deityOrder = {
    intent: intent.intent,
    target: intent.target || null,
    text: intent.interpretation || intent.intent,
    issuedAt: Date.now(),
  };

  if (spirit.currentAction) return null;

  const hex = gameState.map.hexes[spirit.hexId];
  if (!hex) return null;
  const adj = neighbors({ q: hex.q, r: hex.r });

  let action;
  let target = intent.target || null;

  if ((intent.intent === 'attack' || intent.intent === 'defend') && target) {
    const targetSpirit = Object.values(gameState.spirits).find(
      s => s.alive && s.name.toLowerCase() === target.toLowerCase()
    );
    if (targetSpirit) {
      action = targetSpirit.hexId === spirit.hexId ? 'battle' : 'move_to';
      target = targetSpirit.name;
    } else {
      action = 'explore';
    }
  } else {
    const actionMap = {
      attack: 'battle', defend: 'battle', explore: 'explore',
      spawn: 'spawn', gather: 'soul_mine', rest: 'wait', diplomacy: 'wait', move: 'move_to',
    };
    action = actionMap[intent.intent] || 'move_to';
  }

  const decision = { action, target, reasoning: intent.interpretation || 'Deity command' };
  const event = executeDecision(spirit, decision, gameState, adj);
  if (event) {
    gameState.actionHistory = gameState.actionHistory || [];
    gameState.actionHistory.push({
      type: event.type.replace('spirit_', ''),
      playerId: spirit.playerId,
      spiritId: spirit.id,
      timestamp: Date.now(),
      data: event,
    });
    broadcast(gameState, [event]);
  }
  return event;
}

export function clearDeityOrder(spirit) {
  spirit._deityOrder = null;
}

export function runSpiritDialogs(gameState) {
  const spirits = Object.values(gameState.spirits).filter(
    s => s.alive && !s.currentAction && s.tier !== 'swarmling'
  );

  for (const spirit of spirits) {
    if (Math.random() > DIALOG_CHANCE) continue;

    const hex = gameState.map.hexes[spirit.hexId];
    if (!hex) continue;

    const adj = neighbors({ q: hex.q, r: hex.r });
    const nearbyIds = [
      ...hex.spiritIds,
      ...adj.flatMap(a => {
        const h = gameState.map.hexes[hexId(a.q, a.r)];
        return h ? h.spiritIds : [];
      }),
    ];

    const nearby = nearbyIds
      .filter(id => id !== spirit.id)
      .map(id => gameState.spirits[id])
      .filter(s => s?.alive);

    if (nearby.length === 0) continue;

    const target = nearby[Math.floor(Math.random() * nearby.length)];
    const isEnemy = target.playerId !== spirit.playerId;

    const text = generateDialogText(spirit, target, isEnemy);
    const event = {
      type: 'spirit_dialog',
      sourceId: spirit.id,
      sourceName: spirit.name,
      targetId: target.id,
      targetName: target.name,
      dialogType: isEnemy ? 'TAUNT' : 'ALLY_CHAT',
      text,
      timestamp: Date.now(),
    };
    broadcast(gameState, [event]);
  }

  return [];
}

function generateDialogText(source, target, isEnemy) {
  const rules = source.behaviorRules;

  if (isEnemy) {
    if (rules?.grudges?.[target.playerId]) {
      const phrases = [
        `${target.name}! Your kind has wronged me ${rules.grudges[target.playerId]} times. Today we settle it.`,
        `I remember every defeat. ${target.name}, your time has come.`,
        `The ${source.affinity || 'spirit'} in me burns with grudge, ${target.name}.`,
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    }
    if (rules?.confidence?.[target.playerId]) {
      const phrases = [
        `Another one from ${target.playerId}? I've beaten your kind before.`,
        `${target.name}, I know your weaknesses.`,
        `This will be easy. I've won ${rules.confidence[target.playerId]} times against your swarm.`,
      ];
      return phrases[Math.floor(Math.random() * phrases.length)];
    }
    const taunts = [
      `${target.name}, your deity cannot protect you here.`,
      `Stand aside or be swept away, ${target.name}.`,
      `The ${source.affinity || 'spirit'} claims this ground. Leave.`,
    ];
    return taunts[Math.floor(Math.random() * taunts.length)];
  }

  const chats = [
    `Hold the line, ${target.name}. Our deity watches.`,
    `Together we push forward, ${target.name}.`,
    `${target.name}, have you scouted the east? I sense enemies gathering.`,
    `Stay close, ${target.name}. Strength in numbers.`,
  ];
  return chats[Math.floor(Math.random() * chats.length)];
}

export function issueRallyCommand(playerId, targetHexId, gameState) {
  const targetHex = gameState.map.hexes[targetHexId];
  if (!targetHex) return { dispatched: 0, events: [], commandType: 'invalid' };

  const hasEnemy = targetHex.spiritIds.some(id => {
    const s = gameState.spirits[id];
    return s && s.alive && s.playerId !== playerId;
  });
  const isOwn = targetHex.controller === playerId;
  const commandType = hasEnemy ? 'attack' : isOwn ? 'regroup' : 'capture';

  const mySpirits = Object.values(gameState.spirits).filter(
    s => s.playerId === playerId && s.alive
  );

  const events = [];
  for (const spirit of mySpirits) {
    if (spirit.hexId === targetHexId) continue;

    if (spirit.currentAction) {
      if (spirit.currentAction.type !== 'moving' && spirit.currentAction.type !== 'exploring') continue;
      gameState.activeTimers = gameState.activeTimers.filter(t => t.spiritId !== spirit.id);
      spirit.currentAction = null;
    }

    const nextHexId = getNextStep(spirit.hexId, targetHexId, gameState.map.hexes);
    if (!nextHexId) continue;

    spirit._deityOrder = {
      intent: commandType,
      target: targetHexId,
      text: `Rally to ${targetHex.terrain} (${commandType})`,
      issuedAt: Date.now(),
      _rallyHexId: targetHexId,
    };

    const event = startMove(spirit, nextHexId, gameState, `Rally: ${commandType} ${targetHex.terrain}`);
    if (event) events.push(event);

    gameState.actionHistory = gameState.actionHistory || [];
    gameState.actionHistory.push({
      type: 'movement',
      playerId,
      spiritId: spirit.id,
      timestamp: Date.now(),
      data: event,
    });
  }

  if (events.length) broadcast(gameState, events);
  return { dispatched: events.length, events, commandType, targetHexId };
}

function fallbackMove(spirit, gameState, adj) {
  const validAdj = adj
    .map(a => gameState.map.hexes[hexId(a.q, a.r)])
    .filter(h => h);

  if (!validAdj.length) return null;
  const target = pickMoveTarget(validAdj, spirit);
  if (!target) return null;

  return startMove(spirit, target.id, gameState, null);
}

async function decideGhostAction(spirit, gameState) {
  const hex = gameState.map.hexes[spirit.hexId];
  if (!hex) return null;
  const adj = neighbors({ q: hex.q, r: hex.r });
  const roll = Math.random();

  if (roll < 0.4) {
    const nearbyIds = [
      ...hex.spiritIds,
      ...adj.flatMap(a => {
        const h = gameState.map.hexes[hexId(a.q, a.r)];
        return h ? h.spiritIds : [];
      }),
    ];
    const nearby = nearbyIds
      .filter(id => id !== spirit.id)
      .map(id => gameState.spirits[id])
      .filter(s => s?.alive && !s._isGhost);

    if (nearby.length > 0) {
      const target = nearby[Math.floor(Math.random() * nearby.length)];
      const ghostData = spirit._ghostData || {};
      const phrases = [
        `I remember... ${ghostData.lastDeityName || 'another world'}...`,
        `${target.name}... do you hear the echoes too?`,
        `I was ${spirit.name} once. Perhaps I still am.`,
        `The ${ghostData.deathCause || 'end'} was not the last word.`,
        ghostData.memorableQuote || `I wander between what was and what could be.`,
      ];
      const text = phrases[Math.floor(Math.random() * phrases.length)];
      return {
        type: 'spirit_dialog',
        sourceId: spirit.id,
        sourceName: spirit.name,
        targetId: target.id,
        targetName: target.name,
        dialogType: 'GHOST_WHISPER',
        text,
        timestamp: Date.now(),
      };
    }
  }

  const validAdj = adj
    .map(a => gameState.map.hexes[hexId(a.q, a.r)])
    .filter(h => h);
  if (!validAdj.length) return null;

  const unclaimed = validAdj.filter(h => !h.controller);
  const target = unclaimed.length > 0
    ? unclaimed[Math.floor(Math.random() * unclaimed.length)]
    : validAdj[Math.floor(Math.random() * validAdj.length)];

  const duration = 20_000;
  startTimer(gameState, {
    type: 'movement',
    spiritId: spirit.id,
    duration,
    data: { fromHex: spirit.hexId, toHex: target.id, isGhostWander: true },
  });
  spirit.currentAction = {
    type: 'moving',
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data: { toHex: target.id },
  };
  return { type: 'spirit_moving', spiritId: spirit.id, spiritName: spirit.name, toHex: target.id, duration, reasoning: 'Ghost wandering' };
}
