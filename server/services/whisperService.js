/**
 * whisperService.js — Whisper propagation between swarm spirits.
 * A deity's message to one spirit ripples through the swarm, colored by
 * each relaying spirit's personality and bond fidelity.
 */

import { callLLM } from './llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';

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
