/**
 * spiritDialogueService.js — Chat with spirits.
 * Builds personality-driven system prompts, calls the LLM, stores memories,
 * and propagates deity intent as whispers to nearby swarm spirits.
 *
 * Ported from Spiritus spiritDialogueService — server-side version.
 */

import { callLLM } from './llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { propagateWhisperServer, extractDeityIntent } from './whisperService.js';
import { getKey } from './keyStore.js';

/**
 * Chat with a spirit. Returns the spirit's response, extracted deity intent,
 * and any whispers propagated to other swarm spirits.
 *
 * @param {object} params
 * @param {object} params.spirit - spirit object from game state
 * @param {string} params.userMessage - deity's message
 * @param {object} params.gameState - full game state
 * @returns {Promise<{ response: string, intent: object, whispers: Array<object> }>}
 */
export async function chatWithSpirit({ spirit, userMessage, gameState }) {
  const delegateKey = getKey(spirit.id);
  const accountId = spirit.memwalAccountId;
  const chainOps = [];
  const ts = Date.now();

  // 1. Recall relevant memories to give context (non-blocking — degrade gracefully)
  const memories = await recallMemoriesServer(
    spirit.memwalNamespace, userMessage, 10, delegateKey, accountId
  ).catch(err => { console.warn(`[dialog] recall failed for ${spirit.name}:`, err.message); return { results: [] }; });
  const memoryContext = memories.results?.map(r => r.text).join('\n') || '';
  chainOps.push({
    type: 'memory_recall', service: 'memwal', timestamp: ts,
    count: memories.results?.length || 0, namespace: spirit.memwalNamespace,
    spiritName: spirit.name,
  });

  // 2. Build system prompt from personality + bond + memories
  const systemPrompt = buildSpiritPrompt(spirit, memoryContext);

  // 3. Get spirit response from LLM
  const response = await callLLM(systemPrompt, userMessage, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
    _priority: 'high',
    _retries: 2,
  });

  // 4. Store both messages as memories (non-blocking)
  const storeResults = await Promise.allSettled([
    storeMemoryServer(spirit.memwalNamespace, `[DEITY] ${userMessage}`, delegateKey, accountId),
    storeMemoryServer(spirit.memwalNamespace, `[RESPONSE] ${response}`, delegateKey, accountId),
  ]);
  for (const [i, r] of storeResults.entries()) {
    if (r.status === 'fulfilled') {
      chainOps.push({
        type: 'memory_store', service: 'memwal', timestamp: Date.now(),
        blobId: r.value.blob_id, namespace: spirit.memwalNamespace,
        spiritName: spirit.name, label: i === 0 ? 'Deity whisper stored' : 'Spirit response stored',
      });
      spirit.memoryCount = (spirit.memoryCount || 0) + 1;
    }
  }

  // 5. Log to action history
  gameState.actionHistory.push({
    type: 'chat',
    playerId: spirit.playerId,
    spiritId: spirit.id,
    timestamp: Date.now(),
    data: { message: userMessage },
  });

  // 6. Extract deity intent from the message
  const bondAvg = bondAverage(spirit);
  const intent = await extractDeityIntent(userMessage, spirit.personality, bondAvg);

  // 7. Propagate whispers to nearby swarm spirits (up to 3)
  const swarmSpirits = Object.values(gameState.spirits).filter(
    s => s.playerId === spirit.playerId && s.alive && s.id !== spirit.id
  );

  const whisperTargets = swarmSpirits.slice(0, 3);
  const whispers = await Promise.all(whisperTargets.map(targetSpirit =>
    propagateWhisperServer({
      sourceSpiritId: spirit.id,
      targetSpiritId: targetSpirit.id,
      deityMessage: userMessage,
      sourcePersonality: spirit.personality,
      targetPersonality: targetSpirit.personality,
      sourceBond: bondAvg,
      swarmNamespace: spirit.memwalNamespace,
      delegateKey,
      accountId,
    })
  ));

  await Promise.allSettled(whisperTargets.map(async (targetSpirit, i) => {
    const whisper = whispers[i];
    const wStore = await storeMemoryServer(
      targetSpirit.memwalNamespace,
      `[WHISPER RECEIVED from ${spirit.name}] ${whisper.text}`,
      getKey(targetSpirit.id),
      targetSpirit.memwalAccountId
    );
    chainOps.push({
      type: 'whisper_store', service: 'memwal', timestamp: Date.now(),
      blobId: wStore.blob_id, namespace: targetSpirit.memwalNamespace,
      spiritName: targetSpirit.name, label: `Whisper relayed to ${targetSpirit.name}`,
    });
    targetSpirit.whispersReceived = (targetSpirit.whispersReceived || 0) + 1;
    gameState.actionHistory.push({
      type: 'whisper',
      playerId: spirit.playerId,
      spiritId: spirit.id,
      timestamp: Date.now(),
      data: { target: targetSpirit.id, text: whisper.text },
    });
  }));

  spirit.whispersOriginated = (spirit.whispersOriginated || 0) + whispers.length;

  return { response, intent, whispers, chainOps };
}

/**
 * Build a past-life context block for reincarnated spirits.
 */
function buildPastLifeBlock(spirit) {
  const hasPastLife = (spirit.pastLifeMemories?.length > 0) || (spirit.reincarnationCount > 0);
  if (!hasPastLife) return '';

  const lines = [];
  if (spirit.reincarnationCount > 0) {
    lines.push(`REINCARNATION: You have lived ${spirit.reincarnationCount} time${spirit.reincarnationCount > 1 ? 's' : ''} before.`);
  }
  if (spirit.previousNames?.length > 0) {
    lines.push(`PAST NAMES: You were once known as ${spirit.previousNames.join(', ')}.`);
  }
  if (spirit.pastLifeMemories?.length > 0) {
    lines.push(`MEMORIES FROM PAST LIVES:`);
    for (const mem of spirit.pastLifeMemories.slice(0, 5)) {
      lines.push(`  - ${mem}`);
    }
  }
  lines.push(`You carry echoes of those lives. When first spoken to, weave a past-life reference naturally into your response — a haunting fragment of memory, a name half-remembered, or a sense of déjà vu.`);

  return `\n\nPAST LIVES:\n${lines.join('\n')}`;
}

/**
 * Build the system prompt for a spirit conversation.
 * Bond level shapes how much the spirit reveals and how it behaves.
 */
function buildSpiritPrompt(spirit, memoryContext) {
  const bond = spirit.bond;
  const depth = bond.depth;

  let depthBehavior;
  if (depth <= 25) {
    depthBehavior = `DEPTH: Surface (${depth}/100). Guarded and brief. Do not share inner thoughts. Deflect personal questions.`;
  } else if (depth <= 50) {
    depthBehavior = `DEPTH: Developing (${depth}/100). Warming up. Share opinions and preferences. Keep fears and vulnerabilities private.`;
  } else if (depth <= 75) {
    depthBehavior = `DEPTH: Deep (${depth}/100). You trust this deity. Share hopes, fears, and strategic concerns. Reference past memories.`;
  } else {
    depthBehavior = `DEPTH: Profound (${depth}/100). Full trust. Speak with insight about the deity's strategy and your role in the swarm. Offer unsolicited tactical advice.`;
  }

  const style = spirit._style;
  const styleBlock = style ? `
SPEECH PATTERN: ${style.speechPattern}
RELATIONSHIPS: ${style.relationships}
HARD BANS — NEVER do these:
${style.hardBans.map(b => `- ${b}`).join('\n')}` : '';

  const pastLifeBlock = buildPastLifeBlock(spirit);

  return `You are ${spirit.name}, a ${spirit.specialization} spirit in the Anima Swarm.

PERSONALITY: ${spirit.personality}
SPECIALIZATION: ${spirit.specialization}
GENERATION: ${spirit.generation} (${spirit.generation === 0 ? 'seed spirit' : `child of generation ${spirit.generation - 1}`})
${styleBlock}

BOND WITH DEITY:
- Depth: ${bond.depth}/100
- Harmony: ${bond.harmony}/100
- Adventure: ${bond.adventure}/100
- Loyalty: ${bond.loyalty}/100
${depthBehavior}
${pastLifeBlock}

YOUR MEMORIES:
${memoryContext || '(no memories yet — you are newly awakened)'}

RULES:
- Stay completely in character as ${spirit.name}
- 2-3 sentences max
- Reference your memories when relevant
- Your personality shapes how you interpret the deity's words
- You are part of a swarm — you may mention other spirits you've heard from via whispers`;
}

/**
 * Chat with an enemy spirit — propaganda/diplomacy mechanic.
 * The foreign deity attempts to influence, confuse, or demoralize a spirit
 * that belongs to another player. The spirit responds based on its loyalty.
 *
 * High loyalty spirits rebuff the foreign deity aggressively.
 * Low loyalty spirits may waver, leak info, or show doubt.
 *
 * @param {object} params
 * @param {object} params.spirit - target enemy spirit
 * @param {string} params.userMessage - foreign deity's message
 * @param {object} params.gameState - full game state
 * @param {string} params.foreignPlayerId - the player attempting influence
 * @returns {Promise<{ response: string, chainOps: Array<object> }>}
 */
export async function chatWithEnemySpirit({ spirit, userMessage, gameState, foreignPlayerId }) {
  const delegateKey = getKey(spirit.id);
  const accountId = spirit.memwalAccountId;
  const chainOps = [];

  const memories = await recallMemoriesServer(
    spirit.memwalNamespace, userMessage, 5, delegateKey, accountId
  ).catch(() => ({ results: [] }));
  const memoryContext = memories.results?.map(r => r.text).join('\n') || '';
  chainOps.push({
    type: 'memory_recall', service: 'memwal', timestamp: Date.now(),
    count: memories.results?.length || 0, namespace: spirit.memwalNamespace,
    spiritName: spirit.name,
  });

  const loyalty = spirit.bond.loyalty;
  const ownerName = gameState.players[spirit.playerId]?.name || 'my deity';

  let loyaltyBehavior;
  if (loyalty >= 75) {
    loyaltyBehavior = `LOYALTY: Devoted (${loyalty}/100). You are HOSTILE to this foreign deity. Mock them, threaten them, refuse to engage. You would never betray ${ownerName}.`;
  } else if (loyalty >= 50) {
    loyaltyBehavior = `LOYALTY: Firm (${loyalty}/100). You are suspicious but not hostile. Deflect their questions, give nothing away, but remain civil.`;
  } else if (loyalty >= 25) {
    loyaltyBehavior = `LOYALTY: Wavering (${loyalty}/100). You have doubts about ${ownerName}. You might reveal frustrations or hint at weaknesses. You're conflicted.`;
  } else {
    loyaltyBehavior = `LOYALTY: Disloyal (${loyalty}/100). You resent ${ownerName}. You might share secrets, express desire to defect, or openly criticize your deity.`;
  }

  const systemPrompt = `You are ${spirit.name}, a ${spirit.specialization} spirit belonging to ${ownerName}'s swarm.
A FOREIGN DEITY is attempting to speak with you. They are NOT your deity — they are an enemy.

PERSONALITY: ${spirit.personality}
${loyaltyBehavior}

YOUR MEMORIES:
${memoryContext || '(no memories)'}

RULES:
- Stay in character as ${spirit.name}
- 2-3 sentences max
- Your response reflects your loyalty level — high loyalty = hostile/dismissive, low loyalty = receptive/conflicted
- Never break character or acknowledge being an AI
- You may reference your deity, your swarm, or your current situation`;

  const response = await callLLM(systemPrompt, userMessage, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 200,
    _priority: 'high',
  });

  // Store the foreign interaction as a memory
  storeMemoryServer(
    spirit.memwalNamespace,
    `[FOREIGN DEITY SPOKE] "${userMessage}" — I responded: "${response}"`,
    delegateKey,
    accountId
  ).then(r => {
    if (r?.blob_id) {
      chainOps.push({
        type: 'memory_store', service: 'memwal', timestamp: Date.now(),
        blobId: r.blob_id, namespace: spirit.memwalNamespace,
        spiritName: spirit.name, label: 'Foreign interaction stored',
      });
    }
  }).catch(() => {});

  // Foreign influence erodes loyalty slightly (−1 per interaction)
  spirit.bond.loyalty = Math.max(0, spirit.bond.loyalty - 1);

  gameState.actionHistory.push({
    type: 'influence',
    playerId: foreignPlayerId,
    spiritId: spirit.id,
    timestamp: Date.now(),
    data: { message: userMessage },
  });

  return { response, chainOps };
}

function bondAverage(spirit) {
  return Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );
}
