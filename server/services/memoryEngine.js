import crypto from 'crypto';
import { storeMemoryServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const GRUDGE_THRESHOLD = 3;
const CONFIDENCE_THRESHOLD = 3;
const FEAR_THRESHOLD = 1;
const TRAUMA_THRESHOLD = 1;
const BETRAYAL_THRESHOLD = 1;
const MAX_LEDGER_SIZE = 50;

export function createMemory(spirit, type, outcome, target, gameState) {
  const hex = gameState.map.hexes[spirit.hexId];
  const targetSpirit = target?.spiritId ? gameState.spirits[target.spiritId] : null;
  const targetPlayer = target?.playerId || targetSpirit?.playerId || null;

  const memory = {
    id: crypto.randomUUID(),
    type,
    outcome,
    targetTeam: targetPlayer,
    targetSpirit: targetSpirit?.name || target?.name || null,
    hexId: spirit.hexId,
    terrain: hex?.terrain || 'unknown',
    gameId: gameState.id,
    tick: gameState._tickCount || 0,
    text: generateMemoryText(spirit, type, outcome, targetSpirit, hex),
    timestamp: Date.now(),
  };

  if (!spirit.memoryLedger) spirit.memoryLedger = [];
  const oldRules = spirit.behaviorRules;
  spirit.memoryLedger.push(memory);

  if (spirit.memoryLedger.length > MAX_LEDGER_SIZE) {
    spirit.memoryLedger = spirit.memoryLedger.slice(-MAX_LEDGER_SIZE);
  }

  spirit.memoryCount = (spirit.memoryCount || 0) + 1;

  spirit.behaviorRules = computeBehaviorRules(spirit);

  const dramaticEvents = detectDramaticChanges(oldRules, spirit.behaviorRules, spirit, targetPlayer, gameState);
  if (dramaticEvents.length > 0) {
    gameState._pendingMemoryEvents = gameState._pendingMemoryEvents || [];
    gameState._pendingMemoryEvents.push(...dramaticEvents);
  }

  const tick = gameState._tickCount || 0;

  gameState._pendingMemoryEvents = gameState._pendingMemoryEvents || [];
  gameState._pendingMemoryEvents.push({
    type: 'memory_event',
    subtype: type,
    outcome,
    spiritId: spirit.id,
    spiritName: spirit.name,
    playerId: spirit.playerId,
    targetName: targetSpirit?.name || target?.name || null,
    targetPlayerId: targetPlayer,
    text: memory.text,
    terrain: memory.terrain,
    hexId: spirit.hexId,
    tick,
    dramatic: false,
    timestamp: Date.now(),
  });

  const key = getKey(spirit.id);
  if (key) {
    storeMemoryServer(
      spirit.memwalNamespace,
      `[${type}:${outcome}] ${memory.text}`,
      key,
      spirit.memwalAccountId
    ).catch(() => {});
  }

  return memory;
}

function detectDramaticChanges(oldRules, newRules, spirit, targetPlayer, gameState) {
  const events = [];
  if (!newRules) return events;

  const tick = gameState._tickCount || 0;
  const oldGrudges = oldRules?.grudges || {};
  const oldFears = oldRules?.fears || {};
  const oldTrauma = oldRules?.traumaTerrain || [];

  for (const [team, count] of Object.entries(newRules.grudges || {})) {
    if (!oldGrudges[team]) {
      const teamName = gameState.players[team]?.name || 'an enemy';
      events.push({
        type: 'memory_event',
        subtype: 'GRUDGE_FORMED',
        spiritId: spirit.id,
        spiritName: spirit.name,
        playerId: spirit.playerId,
        targetPlayerId: team,
        text: `${spirit.name} now holds a grudge against ${teamName} (${count} losses)`,
        tick,
        dramatic: true,
        timestamp: Date.now(),
      });
    }
  }

  for (const [team, count] of Object.entries(newRules.fears || {})) {
    if (!oldFears[team]) {
      const teamName = gameState.players[team]?.name || 'an enemy';
      events.push({
        type: 'memory_event',
        subtype: 'FEAR_ACQUIRED',
        spiritId: spirit.id,
        spiritName: spirit.name,
        playerId: spirit.playerId,
        targetPlayerId: team,
        text: `${spirit.name} now fears ${teamName}`,
        tick,
        dramatic: true,
        timestamp: Date.now(),
      });
    }
  }

  for (const terrain of newRules.traumaTerrain || []) {
    if (!oldTrauma.includes(terrain)) {
      events.push({
        type: 'memory_event',
        subtype: 'TRAUMA_ACQUIRED',
        spiritId: spirit.id,
        spiritName: spirit.name,
        playerId: spirit.playerId,
        terrain,
        text: `${spirit.name} now refuses to enter ${terrain} terrain`,
        tick,
        dramatic: true,
        timestamp: Date.now(),
      });
    }
  }

  if (newRules.insubordinate && (!oldRules || !oldRules.insubordinate)) {
    events.push({
      type: 'memory_event',
      subtype: 'INSUBORDINATE',
      spiritId: spirit.id,
      spiritName: spirit.name,
      playerId: spirit.playerId,
      text: `${spirit.name} has become insubordinate — loyalty broken`,
      tick,
      dramatic: true,
      timestamp: Date.now(),
    });
  }

  return events;
}

export function computeBehaviorRules(spirit) {
  const ledger = spirit.memoryLedger || [];
  if (ledger.length === 0) return null;

  const grudges = {};
  const confidence = {};
  const fears = {};
  const traumaTerrain = new Set();
  const refuseAlliance = new Set();
  let totalBattles = 0;

  for (const mem of ledger) {
    if (mem.type === 'BATTLE') {
      totalBattles++;
      const team = mem.targetTeam;
      if (!team) continue;

      if (mem.outcome === 'LOSS') {
        grudges[team] = (grudges[team] || 0) + 1;
      } else if (mem.outcome === 'WIN') {
        confidence[team] = (confidence[team] || 0) + 1;
      }
    }

    if (mem.type === 'DEATH_WITNESS') {
      if (mem.targetTeam) {
        fears[mem.targetTeam] = (fears[mem.targetTeam] || 0) + 1;
      }
      if (mem.terrain) {
        traumaTerrain.add(mem.terrain);
      }
    }

    if (mem.type === 'BETRAYAL') {
      if (mem.targetTeam) {
        refuseAlliance.add(mem.targetTeam);
        grudges[mem.targetTeam] = (grudges[mem.targetTeam] || 0) + 2;
      }
    }
  }

  const filteredGrudges = {};
  for (const [team, count] of Object.entries(grudges)) {
    if (count >= GRUDGE_THRESHOLD) filteredGrudges[team] = count;
  }

  const filteredConfidence = {};
  for (const [team, count] of Object.entries(confidence)) {
    if (count >= CONFIDENCE_THRESHOLD) filteredConfidence[team] = count;
  }

  const filteredFears = {};
  for (const [team, count] of Object.entries(fears)) {
    if (count >= FEAR_THRESHOLD) filteredFears[team] = count;
  }

  const loyalty = spirit.bond?.loyalty || 50;
  const insubordinate = loyalty < 20 && Object.keys(filteredGrudges).length > 0;

  const veteranBonus = Math.min(0.5, totalBattles * 0.05);

  return {
    grudges: filteredGrudges,
    confidence: filteredConfidence,
    fears: filteredFears,
    traumaTerrain: [...traumaTerrain],
    insubordinate,
    refuseAlliance: [...refuseAlliance],
    veteranBonus,
    totalMemories: ledger.length,
  };
}

export function serializeForWalrus(spirit) {
  return JSON.stringify({
    version: 2,
    spiritName: spirit.name,
    affinity: spirit.affinity,
    captainClass: spirit.captainClass,
    memoryLedger: spirit.memoryLedger || [],
    stats: {
      combatXP: spirit.combatXP || 0,
      explorationXP: spirit.explorationXP || 0,
      kills: spirit.kills || 0,
      hexesClaimed: spirit.hexesClaimed || 0,
      spawnCount: spirit.spawnCount || 0,
    },
    behaviorRules: spirit.behaviorRules,
    exportedAt: Date.now(),
  });
}

export function deserializeFromWalrus(blob, spirit) {
  const data = typeof blob === 'string' ? JSON.parse(blob) : blob;
  if (data.version !== 2) return false;

  spirit.memoryLedger = [
    ...(data.memoryLedger || []),
    ...(spirit.memoryLedger || []),
  ].slice(-MAX_LEDGER_SIZE);

  if (data.stats) {
    spirit.combatXP = (spirit.combatXP || 0) + (data.stats.combatXP || 0);
    spirit.explorationXP = (spirit.explorationXP || 0) + (data.stats.explorationXP || 0);
    spirit.kills = (spirit.kills || 0) + (data.stats.kills || 0);
  }

  spirit.behaviorRules = computeBehaviorRules(spirit);
  return true;
}

function generateMemoryText(spirit, type, outcome, targetSpirit, hex) {
  const terrain = hex?.terrain || 'unknown';
  const target = targetSpirit?.name || 'unknown';

  switch (type) {
    case 'BATTLE':
      if (outcome === 'WIN') return `Defeated ${target} on ${terrain} ground`;
      if (outcome === 'LOSS') return `Fell to ${target} on ${terrain} ground`;
      return `Fought ${target} to a standstill on ${terrain}`;

    case 'DECREE':
      return `Received divine decree: "${outcome}"`;

    case 'SCOUT':
      return `Scouted ${terrain} territory held by ${target}`;

    case 'BETRAYAL':
      return `${target}'s alliance was broken on ${terrain}`;

    case 'ALLIANCE':
      return `Formed alliance near ${terrain}`;

    case 'DEATH_WITNESS':
      return `Witnessed death on ${terrain} at the hands of ${target}`;

    case 'ENCOUNTER':
      return `Met ${target} on ${terrain}`;

    default:
      return `${type}: ${outcome} involving ${target} on ${terrain}`;
  }
}
