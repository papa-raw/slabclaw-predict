/**
 * avatarService.js — Soul-bound avatar generation via Replicate.
 *
 * Avatars are generated:
 *   1. For new spirits with no prior avatar (first game, spawned children)
 *   2. When essence materially changes mid-game (reincarnation, personality shift)
 *
 * NOT generated for imported spirits — they carry their previous avatar.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { storeBlob } from './walrusService.js';
import { broadcast } from './wsService.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const AVATAR_CACHE_FILE = join(__dirname, '../../_data/avatars.json');

function loadAvatarCache() {
  try {
    return JSON.parse(readFileSync(AVATAR_CACHE_FILE, 'utf-8'));
  } catch { return {}; }
}

function saveAvatarCache(cache) {
  try {
    mkdirSync(dirname(AVATAR_CACHE_FILE), { recursive: true });
    writeFileSync(AVATAR_CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch (err) {
    console.warn('[avatar] Failed to write cache:', err.message);
  }
}

export function cacheAvatarBlobId(spiritName, blobId) {
  const cache = loadAvatarCache();
  cache[spiritName] = blobId;
  saveAvatarCache(cache);
}

export function getCachedAvatarBlobId(spiritName) {
  const cache = loadAvatarCache();
  return cache[spiritName] || null;
}

const REPLICATE_API_TOKEN = process.env.REPLICATE_API_TOKEN;
const REPLICATE_MODEL = 'black-forest-labs/flux-schnell';

const SPEC_VISUAL_CUES = {
  warrior: 'battle-scarred, armored elements, fierce presence, weapons or shields nearby',
  scout: 'lithe and alert, hooded or cloaked, sharp eyes, wind-swept, arrows or daggers',
  gatherer: 'robed mystic, carrying staff or orb, surrounded by glowing runes or herbs',
  sage: 'ancient wisdom, crowned or haloed, celestial symbols, deep knowing gaze',
  generalist: 'balanced adventurer, versatile gear, determined expression',
};

const STYLE_SUFFIX = 'dark fantasy character portrait, painterly digital art, ethereal glowing accents, dramatic lighting, game art style, detailed, 4k, no text, no watermark';

function buildPrompt(spirit) {
  const spec = spirit.specialization || 'generalist';
  const specCue = SPEC_VISUAL_CUES[spec] || SPEC_VISUAL_CUES.generalist;

  const personalitySummary = (spirit.personality || '').slice(0, 200);

  const memoryCues = (spirit.pastLifeMemories || spirit.memorableActions || [])
    .slice(0, 3)
    .join('. ');

  const reincNote = spirit.reincarnationCount > 0
    ? `This being has lived ${spirit.reincarnationCount} previous lives and carries echoes of past existences.`
    : '';

  return `Portrait of a mystical spirit entity. ${personalitySummary}. Visual traits: ${specCue}. ${reincNote}${memoryCues ? ` Memories that shaped them: ${memoryCues}.` : ''} ${STYLE_SUFFIX}`;
}

/**
 * Generate an avatar for a spirit and store it on Walrus.
 * Returns the blobId or null on failure.
 */
export async function generateAvatar(spirit, gameState) {
  if (!REPLICATE_API_TOKEN) {
    console.warn('[avatar] No REPLICATE_API_TOKEN — skipping generation');
    return null;
  }

  const prompt = buildPrompt(spirit);
  console.log(`[avatar] Generating for ${spirit.name} (${spirit.specialization})...`);

  try {
    const res = await fetch(`https://api.replicate.com/v1/models/${REPLICATE_MODEL}/predictions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${REPLICATE_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        input: {
          prompt,
          num_outputs: 1,
          aspect_ratio: '1:1',
          output_format: 'webp',
          output_quality: 80,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Replicate returned ${res.status}: ${err}`);
    }

    const prediction = await res.json();

    // Flux Schnell is fast — poll for completion
    const outputUrl = await pollPrediction(prediction.id);
    if (!outputUrl) throw new Error('Prediction produced no output');

    // Fetch the generated image
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new Error(`Failed to fetch image: ${imgRes.status}`);
    const imgBuffer = Buffer.from(await imgRes.arrayBuffer());

    // Store on Walrus
    const blobId = await storeBlob(imgBuffer, 'image/webp');
    console.log(`[avatar] Generated for ${spirit.name} → blob ${blobId} (${imgBuffer.length} bytes)`);

    return blobId;
  } catch (err) {
    console.error(`[avatar] Generation failed for ${spirit.name}:`, err.message);
    return null;
  }
}

async function pollPrediction(predictionId, maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1000));

    const res = await fetch(`https://api.replicate.com/v1/predictions/${predictionId}`, {
      headers: { 'Authorization': `Bearer ${REPLICATE_API_TOKEN}` },
    });

    if (!res.ok) continue;
    const data = await res.json();

    if (data.status === 'succeeded') {
      return Array.isArray(data.output) ? data.output[0] : data.output;
    }
    if (data.status === 'failed' || data.status === 'canceled') {
      throw new Error(`Prediction ${data.status}: ${data.error || 'unknown'}`);
    }
  }
  throw new Error('Prediction timed out');
}

const avatarQueue = [];
let queueRunning = false;

async function processQueue() {
  if (queueRunning) return;
  queueRunning = true;

  while (avatarQueue.length > 0) {
    const { spirit, gameState } = avatarQueue[0];

    if (spirit.avatarBlobId || gameState.spirits[spirit.id]?.avatarBlobId) {
      avatarQueue.shift();
      continue;
    }

    let blobId = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      blobId = await generateAvatar(spirit, gameState);
      if (blobId) break;
      // Wait before retry (back off for rate limits)
      await new Promise(r => setTimeout(r, 12000 * (attempt + 1)));
    }

    if (blobId && gameState.spirits[spirit.id]) {
      gameState.spirits[spirit.id].avatarBlobId = blobId;
      cacheAvatarBlobId(spirit.name, blobId);

      const event = {
        type: 'avatar_ready',
        spiritId: spirit.id,
        avatarBlobId: blobId,
        timestamp: Date.now(),
      };
      gameState.events = gameState.events || [];
      gameState.events.push(event);
      if (gameState.events.length > 200) gameState.events = gameState.events.slice(-200);

      broadcast(gameState, [event]);
    }

    avatarQueue.shift();
  }

  queueRunning = false;
}

/**
 * Enqueue background avatar generation for a spirit.
 * Processes serially to respect Replicate rate limits.
 */
export function generateAvatarBackground(spirit, gameState) {
  if (spirit.avatarBlobId) return;
  avatarQueue.push({ spirit, gameState });
  processQueue().catch(err => {
    console.error(`[avatar] Queue error:`, err.message);
    queueRunning = false;
  });
}
