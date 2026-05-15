import { callLLM, classifyPersonality } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { neighbors } from '../../lib/hexMath.js';
import { startTimer } from './timerService.js';
import { broadcast } from './wsService.js';
import { checkSpawnReadiness } from './spawningService.js';
import { getKey } from './keyStore.js';

const DECISION_INTERVAL = 30_000; // 30s between autonomous decisions

const DECISION_PROMPT = `You are a spirit in a territorial strategy game. Based on your personality, memories, and current situation, decide your next action.

YOUR IDENTITY:
Name: {name}
Personality: {personality}
Specialization: {specialization}
Bond with deity: {bondAvg}/100

YOUR SITUATION:
Current hex: {hexTerrain} (controlled by: {hexController})
Adjacent hexes: {adjacentInfo}
Your memory count: {memoryCount}
Spawn readiness: {spawnReady}
Recent whispers from deity: {recentWhispers}
Recent events: {recentEvents}

AVAILABLE ACTIONS:
- MOVE <direction> — relocate to an adjacent hex (30s travel, scout: 15s)
- BATTLE — attack an enemy spirit in your hex
- EXPLORE — reveal info about an adjacent hex (15s)
- SPAWN — create a child spirit (5 min, needs 10+ memories and 50+ bond)
- GATHER — absorb accumulated memories from your hex (instant)
- WAIT — do nothing this cycle

Respond with ONLY a JSON object:
{
  "action": "move|battle|explore|spawn|gather|wait",
  "target": "hex direction or spirit name or null",
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

  let recentMemories = { results: [] };
  try {
    const key = getKey(spirit.id);
    recentMemories = await recallMemoriesServer(
      spirit.memwalNamespace, 'recent events deity whisper', 5,
      key, spirit.memwalAccountId
    );
  } catch {
    // ignore recall errors
  }

  const adjacentInfo = adj.map(a => {
    const h = Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r);
    if (!h) return null;
    const controlLabel = h.controller === spirit.playerId
      ? 'yours'
      : h.controller
        ? 'enemy'
        : 'unclaimed';
    return `${h.terrain} (${controlLabel}, ${h.spiritIds.length} spirits)`;
  }).filter(Boolean).join('; ');

  const bondAvg = Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );

  const spawnCheck = checkSpawnReadiness(spirit);

  const prompt = DECISION_PROMPT
    .replace('{name}', spirit.name)
    .replace('{personality}', spirit.personality)
    .replace('{specialization}', spirit.specialization)
    .replace('{bondAvg}', String(bondAvg))
    .replace('{hexTerrain}', hex.terrain)
    .replace('{hexController}', hex.controller === spirit.playerId ? 'you' : hex.controller || 'unclaimed')
    .replace('{adjacentInfo}', adjacentInfo || 'unknown')
    .replace('{memoryCount}', String(spirit.memoryCount))
    .replace('{spawnReady}', spawnCheck.ready ? 'YES' : `NO (${spawnCheck.reasons.join(', ')})`)
    .replace('{recentWhispers}', recentMemories.results?.filter(r => r.text.includes('[WHISPER]')).map(r => r.text).join('; ') || 'none')
    .replace('{recentEvents}', recentMemories.results?.filter(r => !r.text.includes('[WHISPER]')).map(r => r.text).join('; ') || 'none');

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
    case 'move': {
      const validAdj = adj
        .map(a => Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r))
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
      return { type: 'spirit_moving', spiritId: spirit.id, spiritName: spirit.name, toHex: target.id, duration, reasoning };
    }

    case 'gather': {
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
        .map(a => Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r))
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

    default:
      return null; // WAIT or unrecognized
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
      return pick(unclaimed) || pick(own) || pick(enemy);
    case 'cautious':
      return pick(own) || pick(unclaimed) || pick(enemy);
    case 'protector':
      return pick(own) || pick(enemy) || pick(unclaimed);
    default:
      return pick(unclaimed) || pick(enemy) || pick(own);
  }
}

function fallbackMove(spirit, gameState, adj) {
  const validAdj = adj
    .map(a => Object.values(gameState.map.hexes).find(h => h.q === a.q && h.r === a.r))
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
