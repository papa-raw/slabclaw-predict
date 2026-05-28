import { pickSwarmlingName } from '../../lib/classSystem.js';

const SPAWN_COOLDOWN_MS = 60_000;
const MEMORY_COST = 5;

export function checkSpawnReadiness(spirit) {
  const now = Date.now();
  const cooldownEnd = (spirit.lastSpawnAt || 0) + SPAWN_COOLDOWN_MS;
  const cooldownReady = now >= cooldownEnd;
  const ledgerLen = (spirit.memoryLedger || []).length;

  const reasons = [
    spirit.tier !== 'captain' ? 'Only captains can spawn' : null,
    ledgerLen < MEMORY_COST ? `Need ${MEMORY_COST - ledgerLen} more memories (have ${ledgerLen})` : null,
    !cooldownReady ? `Cooldown: ${Math.round((cooldownEnd - now) / 1000)}s` : null,
    !spirit.alive ? 'Dead' : null,
  ].filter(Boolean);

  return {
    ready: spirit.alive && spirit.tier === 'captain' && ledgerLen >= MEMORY_COST && cooldownReady,
    memoryCost: MEMORY_COST,
    memoryCount: ledgerLen,
    reasons,
  };
}

export function calculateChildTraits(parent, gameState) {
  const spent = (parent.memoryLedger || []).splice(0, MEMORY_COST);

  const hex = gameState.map.hexes[parent.hexId];
  const affinity = parent.affinity;
  const usedNames = new Set(Object.values(gameState.spirits).map(s => s.name));
  const name = pickSwarmlingName(affinity, usedNames);

  const jit = r => Math.floor(Math.random() * (r * 2 + 1)) - r;
  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

  return {
    childPersonality: `A ${affinity} swarmling spawned from ${parent.name}'s memories on ${hex?.terrain || 'unknown'} terrain.`,
    childName: name,
    inheritedMemories: spent.map(m => m.text || m),
    childBond: {
      depth: clamp(Math.round(parent.bond.depth * 0.3 + jit(5)), 0, 100),
      harmony: clamp(Math.round(parent.bond.harmony * 0.3 + jit(5)), 0, 100),
      adventure: clamp(Math.round(parent.bond.adventure * 0.3 + jit(5)), 0, 100),
      loyalty: clamp(Math.round(parent.bond.loyalty * 0.3 + jit(5)), 0, 100),
    },
    memoriesSpent: spent.length,
  };
}
