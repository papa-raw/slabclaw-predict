import crypto from 'crypto';
import { getKey, setKey } from './keyStore.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { callLLM, classifyPersonality } from './llmProxy.js';
import { mintSpirit } from './suiService.js';
import { generateAvatarBackground } from './avatarService.js';

export async function resolveSpawn(gameState, timer) {
  const { parentId } = timer.data;
  const parent = gameState.spirits[parentId];
  if (!parent || !parent.alive) {
    return { type: 'spawn_failed', parentId, reason: 'Parent not alive' };
  }

  const parentKey = getKey(parent.id);
  const allMem = await recallMemoriesServer(
    parent.memwalNamespace, '', 20, parentKey, parent.memwalAccountId
  ).catch(() => ({ results: [] }));

  let inherited = [];
  if (allMem.results?.length) {
    const ranking = await callLLM(
      'Rank memories by formative importance.',
      `Memories:\n${allMem.results.map((r, i) => `${i + 1}. ${r.text}`).join('\n')}\n\nReturn JSON: {"indices":[...]}`,
      { model: 'claude-haiku-4-5-20251001', maxTokens: 200 }
    );
    let idx;
    try {
      const m = ranking.match(/\{[\s\S]*\}/);
      idx = m ? JSON.parse(m[0]).indices : [1, 2, 3, 4, 5];
    } catch {
      idx = [1, 2, 3, 4, 5];
    }
    inherited = idx.map(i => allMem.results[i - 1]).filter(Boolean).map(r => r.text);
  }

  const childPersonality = await callLLM(
    'Create spirit personality.',
    `Parent: ${parent.personality}\nMemories:\n${inherited.join('\n') || '(none)'}\nGenerate 2-3 sentence child personality.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 200 }
  );

  const childNameRaw = await callLLM(
    'Name a spirit.',
    `Parent: ${parent.name}. Personality: ${childPersonality}. Return 1 word.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 20 }
  );
  const childName = childNameRaw.trim().split(/\s+/)[0] || `Child-${parent.name}`;

  const childDelegateKey = crypto.randomBytes(32).toString('hex');
  const childNs = `spirit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const childAcctId = process.env.MEMWAL_ACCOUNT_ID || '';

  const childId = `spirit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setKey(childId, childDelegateKey);

  // Store inherited memories for child
  for (const m of inherited) {
    storeMemoryServer(childNs, `[INHERITED] ${m}`, childDelegateKey, childAcctId).catch(() => {});
  }

  const child = {
    id: childId,
    name: childName,
    personality: childPersonality,
    _style: null,
    specialization: 'generalist',
    generation: parent.generation + 1,
    parentId: parent.id,
    hexId: parent.hexId,
    playerId: parent.playerId,
    bond: {
      depth: Math.round(parent.bond.depth * 0.3),
      harmony: Math.round(parent.bond.harmony * 0.3),
      adventure: Math.round(parent.bond.adventure * 0.3),
      loyalty: Math.round(parent.bond.loyalty * 0.3),
    },
    alive: true,
    personalityProfile: classifyPersonality(childPersonality),
    memwalNamespace: childNs,
    memwalAccountId: childAcctId,
    spawnCount: 0,
    memoryCount: inherited.length,
    combatXP: 0,
    explorationXP: 0,
    socialXP: 0,
    wisdomXP: 0,
    kills: 0,
    hexesClaimed: 0,
    whispersReceived: 0,
    whispersOriginated: 0,
    reincarnationCount: 0,
    previousNames: [],
    pastLifeMemories: [],
    memorableActions: [],
    lastSpawnAt: 0,
    currentAction: null,
    _lastDecision: 0,
    avatarBlobId: null,
  };

  gameState.spirits[childId] = child;
  generateAvatarBackground(child, gameState);
  const hex = gameState.map.hexes[parent.hexId];
  if (hex) hex.spiritIds.push(childId);
  if (gameState.players[parent.playerId]) {
    gameState.players[parent.playerId].spiritCount =
      (gameState.players[parent.playerId].spiritCount || 0) + 1;
  }
  parent.spawnCount = (parent.spawnCount || 0) + 1;
  parent.lastSpawnAt = Date.now();
  parent.memoryCount = Math.max(0, (parent.memoryCount || 0) - 10);
  parent.memorableActions = parent.memorableActions || [];
  parent.memorableActions.push(`Spawned ${childName} (gen ${child.generation})`);
  if (parent.memorableActions.length > 10) parent.memorableActions = parent.memorableActions.slice(-10);

  const log = `[SPAWN] ${parent.name} spawned ${childName} (gen ${child.generation}) at hex ${parent.hexId}. ${inherited.length} memories inherited.`;
  const personalityHash = crypto.createHash('sha256').update(childPersonality).digest('hex');
  Promise.allSettled([
    storeMemoryServer(parent.memwalNamespace, log, parentKey, parent.memwalAccountId),
    storeMemoryServer(childNs, log, childDelegateKey, childAcctId),
    mintSpirit(childName, personalityHash, child.generation, parent.id)
      .then(objectId => {
        if (objectId) {
          gameState.events = gameState.events || [];
          gameState.events.push({
            type: 'chain_op', opType: 'spawn_record', suiObjectId: objectId,
            label: `Minted: ${childName} (gen ${child.generation})`,
            timestamp: Date.now(),
          });
        }
      }),
  ]);
  parent.memoryCount = (parent.memoryCount || 0) + 1;

  gameState.eventLog = gameState.eventLog || [];
  gameState.eventLog.push({
    type: 'spirit_spawned',
    playerId: parent.playerId,
    spiritId: childId,
    timestamp: Date.now(),
    summary: log,
  });

  const event = {
    type: 'spawn_complete',
    parentId: parent.id,
    parentName: parent.name,
    childId,
    childName,
    childPersonality: childPersonality.substring(0, 120),
    generation: child.generation,
    hexId: parent.hexId,
    inheritedMemories: inherited.length,
  };

  gameState.events = gameState.events || [];
  gameState.events.push(event);
  if (gameState.events.length > 200) gameState.events = gameState.events.slice(-200);

  return event;
}
