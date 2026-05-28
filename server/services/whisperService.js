/**
 * whisperService.js — Whisper propagation between swarm spirits.
 * A deity's message to one spirit ripples through the swarm, colored by
 * each relaying spirit's personality and bond fidelity.
 */

import { callLLM } from './llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';
import { broadcast } from './wsService.js';
import { createMemory } from './memoryEngine.js';

const WHISPER_SYSTEM_PROMPT = `You are a spirit in a swarm, relaying your deity's influence to another spirit.
Reinterpret the deity's message in your own voice and personality, then pass it along.

Bond level affects relay fidelity:
- High bond (60+): relay faithfully with minor personal color
- Medium bond (30-59): add your own interpretation, may shift emphasis
- Low bond (0-29): heavily reinterpret, may misunderstand intent

Output ONLY the whisper text. 1-2 sentences max.`;

/**
 * Generate a whisper from one spirit to another, relaying the deity's message.
 * Bond fidelity determines how faithfully the message is transmitted.
 *
 * @param {object} params
 * @param {string} params.sourceSpiritId
 * @param {string} params.targetSpiritId
 * @param {string} params.deityMessage - original deity message
 * @param {string} params.sourcePersonality - source spirit's personality
 * @param {string} params.targetPersonality - target spirit's personality
 * @param {number} params.sourceBond - source spirit's bond average (0–100)
 * @param {string} params.swarmNamespace - shared swarm memory namespace
 * @param {string} params.delegateKey - for memory storage
 * @param {string} params.accountId - for memory storage
 * @returns {Promise<{ from: string, to: string, text: string, bondFidelity: number }>}
 */
export async function propagateWhisperServer({
  sourceSpiritId, targetSpiritId, deityMessage,
  sourcePersonality, targetPersonality, sourceBond,
  swarmNamespace, delegateKey, accountId,
}) {
  const recentMemories = await recallMemoriesServer(
    swarmNamespace, deityMessage, 3, delegateKey, accountId
  ).catch(() => ({ results: [] }));
  const memoryContext = recentMemories.results?.map(r => r.text).join('\n') || '';

  const whisperText = await callLLM(
    WHISPER_SYSTEM_PROMPT,
    `YOUR PERSONALITY: ${sourcePersonality}\nBOND: ${sourceBond}/100\nTARGET: ${targetPersonality}\n\nDEITY'S WORDS: "${deityMessage}"\n\nSWARM MEMORIES:\n${memoryContext || '(none)'}\n\nGenerate your whisper.`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 150, _priority: 'high' }
  );

  // Store the whisper in shared swarm memory (non-blocking)
  storeMemoryServer(
    swarmNamespace,
    `[WHISPER] ${sourceSpiritId} → ${targetSpiritId}: ${whisperText}`,
    delegateKey,
    accountId
  ).catch(err => console.warn(`[whisper] store failed:`, err.message));

  return { from: sourceSpiritId, to: targetSpiritId, text: whisperText, bondFidelity: sourceBond };
}

/**
 * Extract a deity's intent from their message, filtered through a spirit's personality.
 * Returns structured JSON describing what action the deity likely wants.
 *
 * @param {string} message - deity's raw message
 * @param {string} spiritPersonality - the spirit's personality (affects interpretation)
 * @param {number} bond - bond average (higher = more accurate interpretation)
 * @returns {Promise<{ intent: string, target: string, urgency: number, confidence: number, interpretation: string }>}
 */
export async function extractDeityIntent(message, spiritPersonality, bond) {
  const result = await callLLM(
    'You extract structured intent from natural language.',
    `Spirit personality: ${spiritPersonality}\nBond: ${bond}/100\nDeity said: "${message}"\n\nExtract JSON: { "intent": "attack"|"defend"|"explore"|"spawn"|"gather"|"rest"|"diplomacy"|"unclear", "target": "...", "urgency": 1-5, "confidence": 0.0-1.0, "interpretation": "..." }`,
    { model: 'claude-haiku-4-5-20251001', maxTokens: 200, _priority: 'high' }
  );

  const match = result.match(/\{[\s\S]*\}/);
  if (match) {
    try {
      return JSON.parse(match[0]);
    } catch {
      // JSON parse failed — return safe default
    }
  }

  return { intent: 'unclear', target: '', urgency: 1, confidence: 0, interpretation: message };
}

/**
 * Broadcast a deity decree to all spirits in the player's swarm.
 * Each spirit stores the decree as memory and gets a deity order set.
 * If a spirit's name is mentioned, they get "chosen by god" status.
 */
export async function broadcastSwarmWhisper({ playerId, message, gameState }) {
  const allSpirits = Object.values(gameState.spirits).filter(
    s => s.playerId === playerId && s.alive
  );
  if (!allSpirits.length) return { spirits: [], events: [] };

  const captains = allSpirits.filter(s => s.tier === 'captain');
  const spiritNames = allSpirits.map(s => s.name.toLowerCase());
  const mentionedName = spiritNames.find(n => message.toLowerCase().includes(n));

  const events = [];
  const results = [];

  // Deity whispers propagate to captains/heroes only — they relay to swarmlings via command radius
  const targets = captains.length > 0 ? captains : allSpirits;

  await Promise.allSettled(targets.map(async (spirit) => {
    const key = getKey(spirit.id);
    const isChosen = mentionedName && spirit.name.toLowerCase() === mentionedName;

    storeMemoryServer(
      spirit.memwalNamespace,
      `[DEITY DECREE] "${message}"${isChosen ? ' (YOU WERE NAMED)' : ''}`,
      key, spirit.memwalAccountId
    ).catch(() => {});
    spirit.memoryCount = (spirit.memoryCount || 0) + 1;

    const bondAvg = Math.round(
      (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
    );
    const effectiveBond = isChosen ? Math.min(100, bondAvg + 10) : bondAvg;

    const intent = await extractDeityIntent(message, spirit.personality, effectiveBond);
    if (isChosen) {
      intent.confidence = Math.min(1, (intent.confidence || 0.5) + 0.2);
      spirit._chosenByGod = true;
    }

    spirit._swarmDecree = { text: message, issuedAt: Date.now() };
    spirit._deityOrder = {
      intent: intent.intent,
      target: intent.target || null,
      text: intent.interpretation || message,
      issuedAt: Date.now(),
    };

    if (spirit.tier === 'captain') {
      createMemory(spirit, 'DECREE', message, { playerId }, gameState);
      spirit._captainOrder = intent.intent;
    }

    spirit.whispersReceived = (spirit.whispersReceived || 0) + 1;

    const event = {
      type: 'spirit_dialog',
      sourceId: 'deity',
      sourceName: gameState.players[playerId]?.name || 'You',
      targetId: spirit.id,
      targetName: spirit.name,
      dialogType: 'DECREE',
      text: message,
      timestamp: Date.now(),
    };
    events.push(event);
    results.push({ spiritId: spirit.id, name: spirit.name, intent, chosen: !!isChosen });
  }));

  broadcast(gameState, events);
  return { spirits: results, events };
}

/**
 * Broadcast an enemy whisper to all spirits of a target player.
 * Effect depends on each spirit's enemyResistance stat.
 */
export async function broadcastEnemyWhisper({ playerId, targetPlayerId, message, gameState }) {
  const targetSpirits = Object.values(gameState.spirits).filter(
    s => s.playerId === targetPlayerId && s.alive
  );
  if (!targetSpirits.length) return { spirits: [], events: [] };

  const attackerName = gameState.players[playerId]?.name || 'A foreign deity';
  const events = [];
  const results = [];

  await Promise.allSettled(targetSpirits.map(async (spirit) => {
    const key = getKey(spirit.id);
    const resistance = spirit.enemyResistance ?? 50;

    storeMemoryServer(
      spirit.memwalNamespace,
      `[ENEMY WHISPER from ${attackerName}] "${message}"`,
      key, spirit.memwalAccountId
    ).catch(() => {});
    spirit.memoryCount = (spirit.memoryCount || 0) + 1;

    spirit.enemyResistance = Math.max(0, (spirit.enemyResistance ?? 50) - 1);

    let effect;
    if (resistance >= 70) {
      effect = 'ignored';
    } else if (resistance >= 40) {
      spirit.bond.loyalty = Math.max(0, spirit.bond.loyalty - 2);
      effect = 'eroded';
    } else if (resistance >= 10) {
      spirit.bond.loyalty = Math.max(0, spirit.bond.loyalty - 5);
      const intent = await extractDeityIntent(message, spirit.personality, 30);
      if (intent.intent !== 'unclear' && Math.random() < 0.4) {
        spirit._deityOrder = {
          intent: intent.intent,
          target: intent.target || null,
          text: `[ENEMY INFLUENCE] ${intent.interpretation || message}`,
          issuedAt: Date.now(),
        };
        effect = 'overridden';
      } else {
        effect = 'shaken';
      }
    } else {
      spirit.bond.loyalty = Math.max(0, spirit.bond.loyalty - 8);
      const intent = await extractDeityIntent(message, spirit.personality, 50);
      spirit._deityOrder = {
        intent: intent.intent,
        target: intent.target || null,
        text: `[DEFECTION] ${intent.interpretation || message}`,
        issuedAt: Date.now(),
      };
      effect = 'defecting';
    }

    if (spirit.tier === 'captain') {
      createMemory(spirit, 'ENCOUNTER', effect, { playerId, name: attackerName }, gameState);
    }

    const event = {
      type: 'spirit_dialog',
      sourceId: playerId,
      sourceName: attackerName,
      targetId: spirit.id,
      targetName: spirit.name,
      dialogType: 'ENEMY_WHISPER',
      text: message,
      timestamp: Date.now(),
    };
    events.push(event);
    results.push({ spiritId: spirit.id, name: spirit.name, resistance, effect });
  }));

  broadcast(gameState, events);
  return { spirits: results, events };
}
