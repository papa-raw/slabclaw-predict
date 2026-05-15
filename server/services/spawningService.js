import { callLLM } from './llmProxy.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';

const SPAWN_COOLDOWN_MS = 60_000; // 1 minute
const MIN_MEMORIES = 5;
const MIN_BOND_AVG = 35;

export function checkSpawnReadiness(spirit) {
  const avg = bondAvg(spirit);
  const now = Date.now();
  const cooldownEnd = (spirit.lastSpawnAt || 0) + SPAWN_COOLDOWN_MS;
  const cooldownReady = now >= cooldownEnd;

  const reasons = [
    spirit.memoryCount < MIN_MEMORIES
      ? `Need ${MIN_MEMORIES - spirit.memoryCount} more memories`
      : null,
    avg < MIN_BOND_AVG ? `Bond too low (${Math.round(avg)}/${MIN_BOND_AVG})` : null,
    !cooldownReady ? `Cooldown: ${Math.round((cooldownEnd - now) / 1000)}s` : null,
    !spirit.alive ? 'Dead' : null,
  ].filter(Boolean);

  return {
    ready:
      spirit.alive &&
      spirit.memoryCount >= MIN_MEMORIES &&
      avg >= MIN_BOND_AVG &&
      cooldownReady,
    memoryCount: spirit.memoryCount,
    bondAvg: avg,
    reasons,
  };
}

export async function calculateChildTraits(parent, gameState) {
  const key = getKey(parent.id);
  const allMem = await recallMemoriesServer(
    parent.memwalNamespace, '', 20, key, parent.memwalAccountId
  ).catch(() => ({ results: [] }));

  let inherited = [];
  if (allMem.results?.length) {
    const r = await callLLM(
      'Rank memories.',
      `Memories:\n${allMem.results.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}\nReturn JSON: {"indices":[...]}`,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 200 }
    );
    let idx;
    try {
      const m = r.match(/\{[\s\S]*\}/);
      idx = m ? JSON.parse(m[0]).indices : [1, 2, 3, 4, 5];
    } catch {
      idx = [1, 2, 3, 4, 5];
    }
    inherited = idx.map(i => allMem.results[i - 1]).filter(Boolean).map(r => r.text);
  }

  const hex = gameState.map.hexes[parent.hexId];
  const personality = await callLLM(
    'Create personality.',
    `Parent: ${parent.personality}\nTerrain: ${hex?.terrain || 'unknown'}\nMemories:\n${inherited.join('\n') || '(none)'}\nGenerate 2-3 sentence child personality.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 200 }
  );

  const nameRaw = await callLLM(
    'Name.',
    `Parent: ${parent.name}. Child: ${personality}. 1 word.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 20 }
  );
  const name = nameRaw.trim().split(/\s+/)[0] || `Child-${parent.name}`;

  const jit = r => Math.floor(Math.random() * (r * 2 + 1)) - r;
  return {
    childPersonality: personality,
    childName: name,
    inheritedMemories: inherited,
    childBond: {
      depth: clamp(Math.round(parent.bond.depth * 0.3 + jit(5)), 0, 100),
      harmony: clamp(Math.round(parent.bond.harmony * 0.3 + jit(5)), 0, 100),
      adventure: clamp(Math.round(parent.bond.adventure * 0.3 + jit(5)), 0, 100),
      loyalty: clamp(Math.round(parent.bond.loyalty * 0.3 + jit(5)), 0, 100),
    },
  };
}

function bondAvg(s) {
  const b = s.bond;
  return (b.depth + b.harmony + b.adventure + b.loyalty) / 4;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
