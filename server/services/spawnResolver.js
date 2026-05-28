import crypto from 'crypto';
import { setKey } from './keyStore.js';
import { storeMemoryServer } from './memwalServer.js';
import { mintSpirit } from './suiService.js';
import { calculateChildTraits } from './spawningService.js';

export async function resolveSpawn(gameState, timer) {
  const { parentId } = timer.data;
  const parent = gameState.spirits[parentId];
  if (!parent || !parent.alive) {
    return { type: 'spawn_failed', parentId, reason: 'Parent not alive' };
  }

  const traits = calculateChildTraits(parent, gameState);

  const childDelegateKey = crypto.randomBytes(32).toString('hex');
  const childNs = `spirit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const childAcctId = process.env.MEMWAL_ACCOUNT_ID || '';
  const childId = `spirit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  setKey(childId, childDelegateKey);

  const child = {
    id: childId,
    name: traits.childName,
    personality: traits.childPersonality,
    _style: null,
    specialization: ['warrior', 'scout', 'gatherer', 'sage'][Math.floor(Math.random() * 4)],
    tier: 'swarmling',
    affinity: parent.affinity,
    captainClass: null,
    commandRadius: 0,
    orderText: null,
    orderSource: null,
    generation: parent.generation + 1,
    parentId: parent.id,
    hexId: parent.hexId,
    playerId: parent.playerId,
    bond: traits.childBond,
    alive: true,
    hp: 60,
    maxHp: 60,
    personalityProfile: 'swarmling',
    memwalNamespace: childNs,
    memwalAccountId: childAcctId,
    memoryLedger: [],
    spawnCount: 0,
    memoryCount: 0,
    combatXP: 0,
    explorationXP: 0,
    socialXP: 0,
    wisdomXP: 0,
    kills: 0,
    hexesClaimed: 0,
    whispersReceived: 0,
    whispersOriginated: 0,
    reincarnationCount: 0,
    enemyResistance: 30,
    previousNames: [],
    pastLifeMemories: [],
    memorableActions: [],
    legendaryDeeds: 0,
    lastSpawnAt: 0,
    currentAction: null,
    _lastDecision: 0,
    avatarBlobId: null,
  };

  gameState.spirits[childId] = child;
  const hex = gameState.map.hexes[parent.hexId];
  if (hex) hex.spiritIds.push(childId);
  if (gameState.players[parent.playerId]) {
    gameState.players[parent.playerId].spiritCount =
      (gameState.players[parent.playerId].spiritCount || 0) + 1;
  }
  parent.spawnCount = (parent.spawnCount || 0) + 1;
  parent.lastSpawnAt = Date.now();
  parent.memorableActions = parent.memorableActions || [];
  parent.memorableActions.push(`Spawned ${traits.childName} (spent ${traits.memoriesSpent} memories)`);
  if (parent.memorableActions.length > 10) parent.memorableActions = parent.memorableActions.slice(-10);

  const log = `[SPAWN] ${parent.name} spent ${traits.memoriesSpent} memories to spawn ${traits.childName} at hex ${parent.hexId}`;
  Promise.allSettled([
    storeMemoryServer(parent.memwalNamespace, log),
    storeMemoryServer(childNs, log),
    mintSpirit(traits.childName, crypto.createHash('sha256').update(traits.childPersonality).digest('hex'), child.generation, parent.id)
      .then(objectId => {
        if (objectId) {
          gameState.events = gameState.events || [];
          gameState.events.push({
            type: 'chain_op', opType: 'spawn_record', suiObjectId: objectId,
            label: `Minted: ${traits.childName} (gen ${child.generation})`,
            timestamp: Date.now(),
          });
        }
      }),
  ]);

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
    childName: traits.childName,
    childPersonality: traits.childPersonality.substring(0, 120),
    generation: child.generation,
    hexId: parent.hexId,
    memoriesSpent: traits.memoriesSpent,
  };

  gameState.events = gameState.events || [];
  gameState.events.push(event);
  if (gameState.events.length > 200) gameState.events = gameState.events.slice(-200);

  return event;
}
