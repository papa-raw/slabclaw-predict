import { neighbors, hexId, axialDistance } from '../../lib/hexMath.js';
import { getAffinityAdvantage, affinityMatchesTerrain, AFFINITIES } from '../../lib/classSystem.js';
import { getNextStep, hexDistance } from '../../lib/hexPathfinding.js';
import { broadcast } from './wsService.js';

const SWARMLING_TICK_INTERVAL = 3000;

const ORDER_TYPES = {
  ADVANCE: 'advance',
  DEFEND: 'defend',
  GATHER: 'gather',
  SWARM: 'swarm',
  SCATTER: 'scatter',
  RETREAT: 'retreat',
};

const AFFINITY_DEFAULTS = {
  flame:  ORDER_TYPES.ADVANCE,
  tide:   ORDER_TYPES.SCATTER,
  stone:  ORDER_TYPES.DEFEND,
  wind:   ORDER_TYPES.SCATTER,
  shadow: ORDER_TYPES.ADVANCE,
  growth: ORDER_TYPES.GATHER,
};

export function runSwarmlingTick(gameState) {
  const now = Date.now();
  const events = [];
  const hexes = gameState.map.hexes;
  const allSpirits = gameState.spirits;

  for (const spirit of Object.values(allSpirits)) {
    if (!spirit.alive || spirit.tier !== 'swarmling') continue;
    if (spirit.currentAction) continue;
    if (spirit._lastSwarmTick && now - spirit._lastSwarmTick < SWARMLING_TICK_INTERVAL) continue;
    spirit._lastSwarmTick = now;

    const hex = hexes[spirit.hexId];
    if (!hex) continue;

    const captain = findNearestCaptain(spirit, allSpirits, hexes);
    const order = captain?._captainOrder || captain?._deityOrder?.intent;
    const orderType = mapIntentToOrder(order) || AFFINITY_DEFAULTS[spirit.affinity] || ORDER_TYPES.SCATTER;

    spirit.orderSource = captain?.id || null;
    spirit.orderText = orderType;

    const enemiesOnHex = hex.spiritIds
      .map(id => allSpirits[id])
      .filter(s => s && s.alive && s.playerId !== spirit.playerId);

    if (enemiesOnHex.length > 0 && orderType !== ORDER_TYPES.RETREAT) {
      const captainRules = captain?.behaviorRules;
      let target = enemiesOnHex[0];
      if (captainRules?.grudges) {
        const grudgeTarget = enemiesOnHex.find(e => captainRules.grudges[e.playerId]);
        if (grudgeTarget) target = grudgeTarget;
      }
      const result = autoResolveBattle(spirit, target, gameState);
      events.push(makeBattleEvent(spirit, target, result, gameState));
      continue;
    }

    const targetHexId = pickTargetHex(spirit, orderType, captain, gameState);
    if (targetHexId && targetHexId !== spirit.hexId) {
      moveSpirit(spirit, targetHexId, hexes, gameState);
    }
  }

  if (events.length > 0) {
    broadcast(gameState, events);
  }
}

function findNearestCaptain(swarmling, allSpirits, hexes) {
  const swHex = hexes[swarmling.hexId];
  if (!swHex) return null;

  let nearest = null;
  let nearestDist = Infinity;

  for (const s of Object.values(allSpirits)) {
    if (!s.alive || s.playerId !== swarmling.playerId) continue;
    if (s.tier !== 'captain') continue;
    const captHex = hexes[s.hexId];
    if (!captHex) continue;

    const dist = axialDistance(swHex, captHex);
    const radius = s.commandRadius || 2;
    if (dist <= radius && dist < nearestDist) {
      nearest = s;
      nearestDist = dist;
    }
  }
  return nearest;
}

function mapIntentToOrder(intent) {
  if (!intent) return null;
  const lower = typeof intent === 'string' ? intent.toLowerCase() : '';
  if (lower === 'attack' || lower === 'advance') return ORDER_TYPES.ADVANCE;
  if (lower === 'defend') return ORDER_TYPES.DEFEND;
  if (lower === 'gather' || lower === 'rest') return ORDER_TYPES.GATHER;
  if (lower === 'explore' || lower === 'scatter') return ORDER_TYPES.SCATTER;
  if (lower === 'spawn' || lower === 'swarm') return ORDER_TYPES.SWARM;
  if (lower === 'retreat' || lower === 'diplomacy') return ORDER_TYPES.RETREAT;
  return null;
}

function pickTargetHex(spirit, orderType, captain, gameState) {
  const hexes = gameState.map.hexes;
  const hex = hexes[spirit.hexId];
  if (!hex) return null;

  const adj = neighbors({ q: hex.q, r: hex.r })
    .map(a => hexes[hexId(a.q, a.r)])
    .filter(h => h && h.terrain !== 'ocean');

  switch (orderType) {
    case ORDER_TYPES.ADVANCE: {
      const enemyHex = adj.find(h =>
        h.spiritIds.some(id => {
          const s = gameState.spirits[id];
          return s && s.alive && s.playerId !== spirit.playerId;
        })
      );
      if (enemyHex) return enemyHex.id;
      const uncontrolled = adj.filter(h => h.controller !== spirit.playerId);
      if (uncontrolled.length > 0) return uncontrolled[Math.floor(Math.random() * uncontrolled.length)].id;
      return adj.length > 0 ? adj[Math.floor(Math.random() * adj.length)].id : null;
    }
    case ORDER_TYPES.DEFEND:
      return null;
    case ORDER_TYPES.GATHER: {
      const best = adj.reduce((a, b) => (b.memoryPool > a.memoryPool ? b : a), hex);
      const terrainMatch = adj.filter(h => affinityMatchesTerrain(spirit.affinity, h.terrain));
      if (terrainMatch.length > 0) return terrainMatch[Math.floor(Math.random() * terrainMatch.length)].id;
      return best.id !== hex.id ? best.id : null;
    }
    case ORDER_TYPES.SWARM: {
      if (!captain) return null;
      return getNextStep(spirit.hexId, captain.hexId, hexes) || null;
    }
    case ORDER_TYPES.SCATTER: {
      const unclaimed = adj.filter(h => !h.controller);
      if (unclaimed.length > 0) return unclaimed[Math.floor(Math.random() * unclaimed.length)].id;
      const enemy = adj.filter(h => h.controller && h.controller !== spirit.playerId);
      if (enemy.length > 0) return enemy[Math.floor(Math.random() * enemy.length)].id;
      return adj.length > 0 ? adj[Math.floor(Math.random() * adj.length)].id : null;
    }
    case ORDER_TYPES.RETREAT: {
      const enemies = Object.values(gameState.spirits).filter(
        s => s.alive && s.playerId !== spirit.playerId
      );
      if (enemies.length === 0) return null;
      const nearestEnemy = enemies.reduce((best, e) => {
        const d = hexDistance(spirit.hexId, e.hexId, hexes);
        return d < best.dist ? { spirit: e, dist: d } : best;
      }, { spirit: null, dist: Infinity });
      if (!nearestEnemy.spirit) return null;
      const enemyHex = hexes[nearestEnemy.spirit.hexId];
      if (!enemyHex) return null;
      const away = adj.reduce((best, h) => {
        const d = axialDistance(h, enemyHex);
        return d > best.dist ? { hex: h, dist: d } : best;
      }, { hex: null, dist: -1 });
      return away.hex ? away.hex.id : null;
    }
    default:
      return null;
  }
}

function moveSpirit(spirit, targetHexId, hexes, gameState) {
  const oldHex = hexes[spirit.hexId];
  const newHex = hexes[targetHexId];
  if (!oldHex || !newHex) return;

  oldHex.spiritIds = oldHex.spiritIds.filter(id => id !== spirit.id);
  newHex.spiritIds.push(spirit.id);
  spirit.hexId = targetHexId;

  if (!newHex.controller || newHex.controller !== spirit.playerId) {
    const oldController = newHex.controller;
    newHex.controller = spirit.playerId;
    spirit.hexesClaimed = (spirit.hexesClaimed || 0) + 1;
    spirit.explorationXP = (spirit.explorationXP || 0) + 0.5;
    spirit.combatXP = (spirit.combatXP || 0) + 0.5;

    const player = gameState.players[spirit.playerId];
    if (player) player.hexesControlled = (player.hexesControlled || 0) + 1;
    if (oldController && gameState.players[oldController]) {
      gameState.players[oldController].hexesControlled = Math.max(0, (gameState.players[oldController].hexesControlled || 1) - 1);
    }
  }
}

export function autoResolveBattle(attacker, defender, gameState) {
  const AFFINITY_BONUS = getAffinityAdvantage(attacker.affinity || 'shadow', defender.affinity || 'shadow');
  const hex = gameState.map.hexes[attacker.hexId];
  const terrain = hex?.terrain || 'grassland';
  const TERRAIN_BONUS = affinityMatchesTerrain(attacker.affinity || 'shadow', terrain) ? 10 : 0;

  const atkScore = (attacker.hp || 60) + ((attacker.combatXP || 0) * 2) + AFFINITY_BONUS + TERRAIN_BONUS + Math.random() * 20;
  const defScore = (defender.hp || 60) + ((defender.combatXP || 0) * 2) - AFFINITY_BONUS + Math.random() * 20;

  const winner = atkScore >= defScore ? attacker : defender;
  const loser = winner === attacker ? defender : attacker;

  const damage = Math.floor(20 + Math.random() * 30);
  loser.hp -= damage;

  if (loser.hp <= 0) {
    loser.alive = false;
    winner.kills = (winner.kills || 0) + 1;
    winner.combatXP = (winner.combatXP || 0) + 3;
    winner.combatXP = (winner.combatXP || 0) + 1;

    const hex = gameState.map.hexes[loser.hexId];
    if (hex) {
      hex.spiritIds = hex.spiritIds.filter(id => id !== loser.id);
    }

    const loserPlayer = gameState.players[loser.playerId];
    if (loserPlayer) {
      loserPlayer.spiritCount = Math.max(0, (loserPlayer.spiritCount || 1) - 1);
    }
  } else {
    winner.combatXP = (winner.combatXP || 0) + 1;
    loser.combatXP = (loser.combatXP || 0) + 1;
  }

  return { winner, loser, damage, killed: loser.hp <= 0 };
}

function makeBattleEvent(attacker, defender, result, gameState) {
  return {
    type: 'swarmling_battle',
    attackerId: attacker.id,
    attackerName: attacker.name,
    defenderId: defender.id,
    defenderName: defender.name,
    winnerId: result.winner.id,
    loserId: result.loser.id,
    damage: result.damage,
    killed: result.killed,
    hexId: attacker.hexId,
    timestamp: Date.now(),
  };
}
