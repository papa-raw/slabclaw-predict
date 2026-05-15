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

  // 1. Recall relevant memories to give context
  const memories = await recallMemoriesServer(
    spirit.memwalNamespace, userMessage, 10, delegateKey, accountId
  );
  const memoryContext = memories.results?.map(r => r.text).join('\n') || '';

  // 2. Build system prompt from personality + bond + memories
  const systemPrompt = buildSpiritPrompt(spirit, memoryContext);

  // 3. Get spirit response from LLM
  const response = await callLLM(systemPrompt, userMessage, {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 300,
  });

  // 4. Store both messages as memories
  await storeMemoryServer(spirit.memwalNamespace, `[DEITY] ${userMessage}`, delegateKey, accountId);
  await storeMemoryServer(spirit.memwalNamespace, `[RESPONSE] ${response}`, delegateKey, accountId);
  spirit.memoryCount = (spirit.memoryCount || 0) + 2;

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

  await Promise.all(whisperTargets.map(async (targetSpirit, i) => {
    const whisper = whispers[i];
    await storeMemoryServer(
      targetSpirit.memwalNamespace,
      `[WHISPER RECEIVED from ${spirit.name}] ${whisper.text}`,
      getKey(targetSpirit.id),
      targetSpirit.memwalAccountId
    );
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

  return { response, intent, whispers };
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

function bondAverage(spirit) {
  return Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );
}
