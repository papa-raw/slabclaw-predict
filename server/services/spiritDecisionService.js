import { callLLM, classifyPersonality } from './llmProxy.js';
import { recallMemoriesServer, storeMemoryServer } from './memwalServer.js';
import { neighbors, hexId, axialDistance } from '../../lib/hexMath.js';
import { findPath, getNextStep, hexDistance } from '../../lib/hexPathfinding.js';
import { startTimer } from './timerService.js';
import { broadcast } from './wsService.js';
import { checkSpawnReadiness } from './spawningService.js';
import { getKey } from './keyStore.js';

const DECISION_INTERVAL = 15_000; // 15s between autonomous decisions
const DIALOG_CHANCE = 0.3; // 30% chance a spirit speaks to nearby spirits each tick

const DECISION_PROMPT = `You are a spirit in a territorial strategy game. You are part of a SWARM — coordinate with your allies.

YOUR IDENTITY:
Name: {name}
Personality: {personality}
Specialization: {specialization} (warrior: +battle, scout: +speed, gatherer: +soul mining)
Bond with deity: {bondAvg}/100

YOUR SWARM:
Allied spirits nearby: {allyInfo}
Swarm size: {swarmSize} spirits alive
Swarm territory: {swarmTerritory} hexes

YOUR SITUATION:
Current hex: {hexTerrain} (controlled by: {hexController})
Adjacent hexes: {adjacentInfo}
Memory count: {memoryCount}
Spawn readiness: {spawnReady}

DEITY ORDERS:
{deityOrders}

PAST LIVES:
{pastLifeContext}

MAP ROSTER (all spirits on the map):
{mapRoster}

SWARM TACTICS:
- FOLLOW DEITY ORDERS above all else — they persist until completed or overridden
- Move TOWARD allies when outnumbered, spread out when dominant
- Warriors should engage enemies; scouts explore; gatherers mine soul deposits from hexes
- If an ally is in battle nearby, move to support them
- You can MOVE TOWARD any spirit by name — pathfinding handles multi-hop navigation
- NEVER idle — always push toward unclaimed or enemy territory. Standing still loses the game.
- If no deity orders exist, your DEFAULT is to expand: move toward unclaimed hexes or enemy territory.
- Prioritize capturing territory over waiting. A spirit that isn't moving is a spirit that's losing.

AVAILABLE ACTIONS (ordered by priority):
- EXPLORE — scout toward unclaimed territory (PREFERRED when unclaimed hexes are adjacent)
- MOVE_TO <spirit name or "unclaimed"> — navigate toward a target (pathfinding, multi-hop)
- BATTLE — attack an enemy spirit in your hex
- SPAWN — create a child spirit (2 min, needs 10+ memories and 35+ bond, consumes 10 memories)
- GATHER — mine soul deposits from your hex (instant, only if hex has soul energy)
- WAIT — hold position (DISCOURAGED — only when completely surrounded by allies with no path forward)

Respond with ONLY a JSON object:
{
  "action": "move_to|battle|explore|spawn|soul_mine|wait",
  "target": "spirit name, hex terrain, or null",
  "reasoning": "one sentence explaining why"
}`;

export function runSpiritDecisions(gameState) {
  const now = Date.now();

  for (const spirit of Object.values(gameState.spirits)) {
    if (!spirit.alive) continue;
    if (spirit.currentAction) continue;
    if (spirit._lastDecision && now - spirit._lastDecision < DECISION_INTERVAL) continue;

    spirit._lastDecision = now;

    // Fire-and-forget: decision resolves async, pushes events via WebSocket
    decideSpiritAction(spirit, gameState).then(event => {
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
  }

  // Returns nothing — decisions arrive asynchronously via broadcast
  return [];
}

async function decideSpiritAction(spirit, gameState) {
  const hex = gameState.map.hexes[spirit.hexId];
  if (!hex) return null;

  const adj = neighbors({ q: hex.q, r: hex.r });

  // Rally continuation — skip LLM, just keep moving toward the rally hex
  const rally = spirit._deityOrder?._rallyHexId;
  if (rally && rally !== spirit.hexId) {
    const nextHexId = getNextStep(spirit.hexId, rally, gameState.map.hexes);
    if (nextHexId) {
      const duration = spirit.specialization === 'scout' ? 8_000 : 15_000;
      startTimer(gameState, {
        type: 'movement',
        spiritId: spirit.id,
        duration,
        data: { fromHex: spirit.hexId, toHex: nextHexId },
      });
      spirit.currentAction = {
        type: 'moving',
        startedAt: Date.now(),
        completesAt: Date.now() + duration,
        data: { toHex: nextHexId },
      };
      return { type: 'spirit_moving', spiritId: spirit.id, spiritName: spirit.name, toHex: nextHexId, duration, reasoning: 'Rally order' };
    }
  }
  // Clear rally order if spirit arrived at the target hex
  if (rally && rally === spirit.hexId) {
    spirit._deityOrder = null;
  }

  let recentMemories = { results: [] };
  try {
    const key = getKey(spirit.id);
    recentMemories = await recallMemoriesServer(
      spirit.memwalNamespace, 'recent events deity whisper order', 5,
      key, spirit.memwalAccountId
    );
  } catch {}

  const adjacentInfo = adj.map(a => {
    const aId = hexId(a.q, a.r);
    const h = gameState.map.hexes[aId];
    if (!h) return null;
    const controlLabel = h.controller === spirit.playerId
      ? 'yours'
      : h.controller
        ? 'enemy'
        : 'unclaimed';
    const spiritCount = h.spiritIds.filter(id => gameState.spirits[id]?.alive).length;
    return `${h.terrain} (${controlLabel}, ${spiritCount} spirits)`;
  }).filter(Boolean).join('; ');

  const allies = Object.values(gameState.spirits).filter(
    s => s.playerId === spirit.playerId && s.alive && s.id !== spirit.id
  );
  const allyInfo = allies.length === 0 ? 'none nearby' : allies.map(a => {
    const aHex = gameState.map.hexes[a.hexId];
    const dist = aHex ? axialDistance({ q: hex.q, r: hex.r }, { q: aHex.q, r: aHex.r }) : 99;
    const action = a.currentAction?.type || 'idle';
    return `${a.name} (${a.specialization}, ${dist} hops, ${action})`;
  }).join('; ');

  const swarmSize = allies.length + 1;
  const swarmTerritory = Object.values(gameState.map.hexes).filter(h => h.controller === spirit.playerId).length;

  // Full map roster — all spirits with distance and hex info
  const allSpirits = Object.values(gameState.spirits).filter(s => s.alive && s.id !== spirit.id);
  const mapRoster = allSpirits.map(s => {
    const sHex = gameState.map.hexes[s.hexId];
    if (!sHex) return null;
    const dist = axialDistance({ q: hex.q, r: hex.r }, { q: sHex.q, r: sHex.r });
    const team = s.playerId === spirit.playerId ? 'ALLY' : 'ENEMY';
    const playerName = gameState.players[s.playerId]?.name || 'unknown';
    const action = s.currentAction?.type || 'idle';
    return `${s.name} [${team}/${playerName}] ${s.specialization}, ${dist} hops, ${sHex.terrain}, ${action}`;
  }).filter(Boolean).join('\n');

  const bondAvg = Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );

  const spawnCheck = checkSpawnReadiness(spirit);

  // Persistent deity orders
  const deityOrder = spirit._deityOrder || null;
  let deityOrdersText = 'None — act freely based on swarm tactics';
  if (deityOrder) {
    const age = Math.round((Date.now() - deityOrder.issuedAt) / 1000);
    deityOrdersText = `"${deityOrder.text}" (issued ${age}s ago, priority: HIGH)`;
  }
  // Swarm decree — softer guidance from broadcast whisper
  const decree = spirit._swarmDecree;
  if (decree && !deityOrder) {
    const age = Math.round((Date.now() - decree.issuedAt) / 1000);
    if (age < 60) {
      deityOrdersText = `Swarm decree: "${decree.text}" (${age}s ago)`;
    }
  }
  // "Chosen by god" — direct divine attention
  if (spirit._chosenByGod) {
    deityOrdersText += '\n⚡ YOUR DEITY HAS SPOKEN YOUR NAME DIRECTLY — you feel a surge of divine attention. Act with conviction.';
    spirit._chosenByGod = false;
  }
  const whisperOrders = recentMemories.results
    ?.filter(r => r.text.includes('[WHISPER]') || r.text.includes('[DEITY]') || r.text.includes('[DECREE]'))
    .map(r => r.text) || [];
  if (whisperOrders.length && !deityOrder && !decree) {
    deityOrdersText = `From memory: ${whisperOrders.slice(0, 2).join('; ')}`;
  }

  // Build past-life context for reincarnated spirits
  let pastLifeContext;
  if (spirit.reincarnationCount > 0) {
    const namesList = (spirit.previousNames || []).join(', ') || 'unknown';
    const memoriesList = (spirit.pastLifeMemories || []).map(m => `- ${m}`).join('\n');
    pastLifeContext = `You have lived ${spirit.reincarnationCount} time(s) before. Previous names: ${namesList}.`
      + (memoriesList ? `\nMemories from past lives:\n${memoriesList}` : '');
  } else {
    pastLifeContext = 'No past lives — this is your first existence.';
  }

  const prompt = DECISION_PROMPT
    .replace('{name}', spirit.name)
    .replace('{personality}', spirit.personality)
    .replace('{specialization}', spirit.specialization)
    .replace('{bondAvg}', String(bondAvg))
    .replace('{allyInfo}', allyInfo)
    .replace('{swarmSize}', String(swarmSize))
    .replace('{swarmTerritory}', String(swarmTerritory))
    .replace('{hexTerrain}', hex.terrain)
    .replace('{hexController}', hex.controller === spirit.playerId ? 'you' : hex.controller || 'unclaimed')
    .replace('{adjacentInfo}', adjacentInfo || 'unknown')
    .replace('{memoryCount}', String(spirit.memoryCount))
    .replace('{spawnReady}', spawnCheck.ready ? 'YES' : `NO (${spawnCheck.reasons.join(', ')})`)
    .replace('{deityOrders}', deityOrdersText)
    .replace('{pastLifeContext}', pastLifeContext)
    .replace('{mapRoster}', mapRoster || 'No other spirits visible');

  if (!spirit.personalityProfile) {
    spirit.personalityProfile = classifyPersonality(spirit.personality);
  }

  const result = await callLLM(
    'You are a spirit making a tactical decision.',
    prompt,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 150, _spiritContext: { spirit, gameState } }
  );

  try {
    const match = result.match(/\{[\s\S]*\}/);
    const decision = match ? JSON.parse(match[0]) : null;
    if (!decision) return null;

    return executeDecision(spirit, decision, gameState, adj);
  } catch {
    return null;
  }
}

function executeDecision(spirit, decision, gameState, adj) {
  const hex = gameState.map.hexes[spirit.hexId];
  const action = (decision.action || '').toLowerCase();
  const reasoning = decision.reasoning || null;

  switch (action) {
    case 'move_to':
    case 'move': {
      let targetHexId = null;

      // Try to resolve target by spirit name
      if (decision.target && action === 'move_to') {
        const targetName = decision.target.toLowerCase();
        const targetSpirit = Object.values(gameState.spirits).find(
          s => s.alive && s.name.toLowerCase() === targetName
        );
        if (targetSpirit && targetSpirit.hexId !== spirit.hexId) {
          targetHexId = getNextStep(spirit.hexId, targetSpirit.hexId, gameState.map.hexes);
        }
      }

      // Fallback: pick adjacent hex by personality
      if (!targetHexId) {
        const validAdj = adj
          .map(a => gameState.map.hexes[hexId(a.q, a.r)])
          .filter(h => h && h.terrain !== 'ocean');
        if (!validAdj.length) return null;
        const target = pickMoveTarget(validAdj, spirit);
        if (!target) return null;
        targetHexId = target.id;
      }

      const duration = spirit.specialization === 'scout' ? 8_000 : 15_000;
      startTimer(gameState, {
        type: 'movement',
        spiritId: spirit.id,
        duration,
        data: { fromHex: spirit.hexId, toHex: targetHexId },
      });
      spirit.currentAction = {
        type: 'moving',
        startedAt: Date.now(),
        completesAt: Date.now() + duration,
        data: { toHex: targetHexId },
      };
      return { type: 'spirit_moving', spiritId: spirit.id, spiritName: spirit.name, toHex: targetHexId, duration, reasoning };
    }

    case 'gather':
    case 'soul_mine': {
      const absorbed = Math.floor(Math.min(hex.memoryPool || 0, 10));
      if (absorbed === 0) {
        return fallbackMove(spirit, gameState, adj);
      }
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
      if (!enemyId) {
        // No enemy present — move instead
        return fallbackMove(spirit, gameState, adj);
      }
      // Don't start a battle if the defender is already in a battle
      const defender = gameState.spirits[enemyId];
      if (defender.currentAction?.type === 'battling') return null;

      const duration = 30_000;
      startTimer(gameState, {
        type: 'battle',
        spiritId: spirit.id,
        duration,
        data: { attackerId: spirit.id, defenderId: enemyId, hexId: hex.id },
      });
      spirit.currentAction = {
        type: 'battling',
        startedAt: Date.now(),
        completesAt: Date.now() + duration,
        data: { defenderId: enemyId },
      };
      // Lock defender too
      defender.currentAction = {
        type: 'battling',
        startedAt: Date.now(),
        completesAt: Date.now() + duration,
        data: { attackerId: spirit.id },
      };
      return { type: 'battle_started', attackerId: spirit.id, attackerName: spirit.name, defenderId: enemyId, defenderName: defender.name, hexId: hex.id, reasoning };
    }

    case 'spawn': {
      const spawnCheck = checkSpawnReadiness(spirit);
      if (!spawnCheck.ready) {
        // Not ready — move instead
        return fallbackMove(spirit, gameState, adj);
      }
      const duration = 120_000; // 2 min
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
      return { type: 'spawn_started', spiritId: spirit.id, spiritName: spirit.name, completesAt: Date.now() + duration, reasoning };
    }

    case 'explore': {
      // Pick an unclaimed adjacent hex
      const unexplored = adj
        .map(a => gameState.map.hexes[hexId(a.q, a.r)])
        .filter(h => h && !h.controller && h.terrain !== 'ocean');

      const targetHex = unexplored[0];
      if (!targetHex) return fallbackMove(spirit, gameState, adj);

      const duration = spirit.specialization === 'scout' ? 4_000 : 8_000;
      startTimer(gameState, {
        type: 'movement',
        spiritId: spirit.id,
        duration,
        data: { fromHex: spirit.hexId, toHex: targetHex.id, isExploration: true },
      });
      spirit.currentAction = {
        type: 'exploring',
        startedAt: Date.now(),
        completesAt: Date.now() + duration,
        data: { targetHex: targetHex.id },
      };
      spirit.explorationXP = (spirit.explorationXP || 0) + 2;
      return { type: 'explore_started', spiritId: spirit.id, spiritName: spirit.name, targetHex: targetHex.id, reasoning };
    }

    case 'wait':
    default:
      return fallbackMove(spirit, gameState, adj);
  }
}

function pickMoveTarget(validAdj, spirit) {
  const unclaimed = validAdj.filter(h => !h.controller);
  const enemy = validAdj.filter(h => h.controller && h.controller !== spirit.playerId);
  const own = validAdj.filter(h => h.controller === spirit.playerId);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

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

/**
 * Apply a deity intent as an immediate spirit action + set persistent order.
 * Called from the chat endpoint after intent extraction.
 */
export function applyDeityIntent(spirit, intent, gameState) {
  if (!spirit.alive) return null;
  if (!intent?.intent) return null;

  // Set persistent deity order — survives across decision cycles
  spirit._deityOrder = {
    intent: intent.intent,
    target: intent.target || null,
    text: intent.interpretation || intent.intent,
    issuedAt: Date.now(),
  };

  // If spirit is busy, the order will be picked up next cycle
  if (spirit.currentAction) return null;

  const hex = gameState.map.hexes[spirit.hexId];
  if (!hex) return null;
  const adj = neighbors({ q: hex.q, r: hex.r });

  // Map deity intent to action, with pathfinding for targeted attacks
  let action;
  let target = intent.target || null;

  if ((intent.intent === 'attack' || intent.intent === 'defend') && target) {
    // Find the named target spirit
    const targetSpirit = Object.values(gameState.spirits).find(
      s => s.alive && s.name.toLowerCase() === target.toLowerCase()
    );
    if (targetSpirit) {
      // If same hex, battle directly
      if (targetSpirit.hexId === spirit.hexId) {
        action = 'battle';
      } else {
        // Navigate toward them
        action = 'move_to';
        target = targetSpirit.name;
      }
    } else {
      action = 'explore';
    }
  } else {
    const actionMap = {
      attack: 'battle',
      defend: 'battle',
      explore: 'explore',
      spawn: 'spawn',
      gather: 'soul_mine',
      rest: 'wait',
      diplomacy: 'wait',
      move: 'move_to',
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

/**
 * Clear a spirit's deity order (on completion or override).
 */
export function clearDeityOrder(spirit) {
  spirit._deityOrder = null;
}

/**
 * Spirit-to-spirit dialog: spirits on the same or adjacent hexes may speak
 * to allies (coordination) or taunt enemies (provocation).
 */
export function runSpiritDialogs(gameState) {
  const spirits = Object.values(gameState.spirits).filter(s => s.alive && !s.currentAction);
  const dialogEvents = [];

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

    generateSpiritDialog(spirit, target, isEnemy, gameState)
      .then(event => { if (event) dialogEvents.push(event); })
      .catch(() => {});
  }

  return dialogEvents;
}

async function generateSpiritDialog(source, target, isEnemy, gameState) {
  const key = getKey(source.id);
  let recentMemories = { results: [] };
  try {
    recentMemories = await recallMemoriesServer(
      source.memwalNamespace, `${target.name} ${isEnemy ? 'enemy battle' : 'ally swarm'}`, 3, key, source.memwalAccountId
    );
  } catch {}

  const memContext = recentMemories.results?.map(r => r.text).join('\n') || '';
  const dialogType = isEnemy ? 'TAUNT' : 'ALLY_CHAT';

  const systemPrompt = isEnemy
    ? `You are ${source.name}, a ${source.specialization} spirit. Generate a short taunt or challenge directed at an enemy spirit. Stay in character. 1 sentence max.`
    : `You are ${source.name}, a ${source.specialization} spirit. Say something to your ally — coordinate, encourage, share intel, or just bond. Stay in character. 1 sentence max.`;

  const userPrompt = `YOUR PERSONALITY: ${source.personality.slice(0, 200)}
TARGET: ${target.name} (${target.specialization}, ${isEnemy ? 'ENEMY — ' + (gameState.players[target.playerId]?.name || 'unknown deity') : 'ALLY'})
YOUR MEMORIES: ${memContext || '(none)'}
Generate your ${isEnemy ? 'taunt' : 'message'}.`;

  const text = await callLLM(systemPrompt, userPrompt, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 80,
  });

  await storeMemoryServer(
    source.memwalNamespace,
    `[DIALOG ${dialogType}] ${source.name} → ${target.name}: ${text}`,
    key, source.memwalAccountId
  );

  source.socialXP = (source.socialXP || 0) + 1;

  const event = {
    type: 'spirit_dialog',
    sourceId: source.id,
    sourceName: source.name,
    targetId: target.id,
    targetName: target.name,
    dialogType,
    text,
    timestamp: Date.now(),
  };

  broadcast(gameState, [event]);
  return event;
}

/**
 * Rally all idle player spirits toward a target hex. Direct command — no LLM.
 * Returns { dispatched, events, commandType } for the response.
 */
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

    // Cancel in-progress movement to redirect (but don't interrupt battles/spawns)
    if (spirit.currentAction) {
      if (spirit.currentAction.type !== 'moving' && spirit.currentAction.type !== 'exploring') continue;
      gameState.activeTimers = gameState.activeTimers.filter(t => t.spiritId !== spirit.id);
      spirit.currentAction = null;
    }

    const nextHexId = getNextStep(spirit.hexId, targetHexId, gameState.map.hexes);
    if (!nextHexId) continue;

    // Set persistent deity order so spirits keep moving toward the target
    spirit._deityOrder = {
      intent: commandType,
      target: targetHexId,
      text: `Rally to ${targetHex.terrain} (${commandType})`,
      issuedAt: Date.now(),
      _rallyHexId: targetHexId,
    };

    const duration = spirit.specialization === 'scout' ? 8_000 : 15_000;
    startTimer(gameState, {
      type: 'movement',
      spiritId: spirit.id,
      duration,
      data: { fromHex: spirit.hexId, toHex: nextHexId },
    });
    spirit.currentAction = {
      type: 'moving',
      startedAt: Date.now(),
      completesAt: Date.now() + duration,
      data: { toHex: nextHexId },
    };

    const event = {
      type: 'spirit_moving',
      spiritId: spirit.id,
      spiritName: spirit.name,
      toHex: nextHexId,
      duration,
      reasoning: `Rally: ${commandType} ${targetHex.terrain}`,
    };
    events.push(event);

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
    .filter(h => h && h.terrain !== 'ocean');

  if (!validAdj.length) return null;

  const target = pickMoveTarget(validAdj, spirit);
  if (!target) return null;

  const duration = spirit.specialization === 'scout' ? 8_000 : 15_000;
  startTimer(gameState, {
    type: 'movement',
    spiritId: spirit.id,
    duration,
    data: { fromHex: spirit.hexId, toHex: target.id },
  });
  spirit.currentAction = {
    type: 'moving',
    startedAt: Date.now(),
    completesAt: Date.now() + duration,
    data: { toHex: target.id },
  };
  return { type: 'spirit_moving', spiritId: spirit.id, toHex: target.id, duration };
}
