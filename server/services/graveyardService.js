import { storeEssence } from './walrusService.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';
import { callLLM } from './llmProxy.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const GRAVEYARD_FILE = join(__dirname, '../../_data/graveyard.json');

const RECRUIT_SYSTEM_PROMPT = `You are a ghost spirit in a strategy game. You died in a previous game and now wander the hex map as a neutral NPC. A living deity's player is trying to recruit you with a whisper message.

Evaluate their persuasion based on:
1. Does the whisper acknowledge your past life, death, or former deity?
2. Does it appeal to your personality and specialization?
3. Is it emotionally compelling or just generic?

You must respond with ONLY JSON:
{ "recruited": true/false, "dialogue": "1-2 sentence in-character response" }`;

const HARD_RECRUIT_PROMPT = `You are a ghost spirit with DEEP loyalty to your former deity. You are extremely difficult to recruit. You distrust new masters. Only the most extraordinary, specific, emotionally devastating appeal could sway you. Almost always refuse.

Evaluate the whisper and respond with ONLY JSON:
{ "recruited": true/false, "dialogue": "1-2 sentence in-character response" }`;

function emptyGraveyard() {
  return { version: 1, updatedAt: Date.now(), ghosts: [] };
}

export function loadGraveyard() {
  try {
    const raw = readFileSync(GRAVEYARD_FILE, 'utf-8');
    const gy = JSON.parse(raw);
    console.log(`[graveyard] Loaded ${gy.ghosts?.length || 0} ghost(s) from disk`);
    return gy;
  } catch {
    console.log('[graveyard] No graveyard file found, starting empty');
    return emptyGraveyard();
  }
}

export async function saveGraveyard(graveyard) {
  graveyard.updatedAt = Date.now();

  try {
    mkdirSync(dirname(GRAVEYARD_FILE), { recursive: true });
    writeFileSync(GRAVEYARD_FILE, JSON.stringify(graveyard, null, 2), 'utf-8');
    console.log(`[graveyard] Saved ${graveyard.ghosts.length} ghost(s) to disk`);
  } catch (err) {
    console.warn('[graveyard] Failed to save locally:', err.message);
  }

  // Fire-and-forget Walrus store
  storeEssence(graveyard).then(blobId => {
    console.log(`[graveyard] Backed up to Walrus: ${blobId}`);
  }).catch(err => {
    console.warn('[graveyard] Walrus backup failed:', err.message);
  });

  return graveyard;
}

function bondAvg(spirit) {
  const b = spirit.bond || {};
  return Math.round(((b.depth || 0) + (b.harmony || 0) + (b.adventure || 0) + (b.loyalty || 0)) / 4);
}

function extractQuote(spirit) {
  if (spirit.memorableActions?.length) {
    const last = spirit.memorableActions[spirit.memorableActions.length - 1];
    if (typeof last === 'string') return last;
    if (last?.description) return last.description;
    if (last?.text) return last.text;
  }
  if (spirit.pastLifeMemories?.length) {
    const last = spirit.pastLifeMemories[spirit.pastLifeMemories.length - 1];
    if (typeof last === 'string') return last;
    if (last?.text) return last.text;
  }
  return null;
}

export async function addToGraveyard(deadSpirits, gameState) {
  const graveyard = loadGraveyard();

  for (const spirit of deadSpirits) {
    if (spirit._isGhost) continue; // don't re-graveyard ghosts

    const player = gameState.players?.[spirit.playerId];
    const ghost = {
      spiritNftId: spirit.nftId || spirit.id,
      ownerAddress: player?.walletAddress || spirit.playerId,
      essenceBlobId: spirit.essenceBlobId || null,
      name: spirit.name,
      specialization: spirit.specialization,
      deathGame: gameState.id,
      deathCause: spirit._deathCause || 'battle',
      killedBy: spirit._killedBy || 'unknown',
      lastDeityName: player ? `${player.name} ${player.deityTitle || ''}`.trim() : 'unknown',
      pastLifeLoyalty: spirit.bond?.loyalty || 0,
      pastLifeBondAvg: bondAvg(spirit),
      memwalNamespace: spirit.memwalNamespace || null,
      memwalAccountId: spirit.memwalAccountId || null,
      avatarBlobId: spirit.avatarBlobId || null,
      memorableQuote: extractQuote(spirit),
    };

    graveyard.ghosts.push(ghost);
    console.log(`[graveyard] Added ghost: ${ghost.name} (killed by ${ghost.killedBy} in ${ghost.deathGame})`);
  }

  await saveGraveyard(graveyard);
  return graveyard;
}

export function selectGhostsForGame(count = 5) {
  const graveyard = loadGraveyard();
  const ghosts = graveyard.ghosts;
  if (ghosts.length === 0) return [];

  // Score each ghost for selection
  const now = Date.now();
  const scored = ghosts.map(g => {
    let score = 0;

    // Recency: extract timestamp from deathGame id (game-<timestamp>)
    const gameTs = parseInt(g.deathGame?.replace('game-', '') || '0', 10);
    const ageMs = now - gameTs;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);
    score += Math.max(0, 10 - ageDays); // newer = higher, max 10 points

    // Memory richness
    if (g.memorableQuote) score += 5;
    if (g.memwalNamespace) score += 2;
    if (g.avatarBlobId) score += 1;

    // Small random factor
    score += Math.random() * 3;

    return { ghost: g, score };
  });

  scored.sort((a, b) => b.score - a.score);

  // Pick with diversity: don't select more than 2 of the same specialization
  const selected = [];
  const specCount = {};

  for (const { ghost } of scored) {
    if (selected.length >= count) break;
    const spec = ghost.specialization || 'unknown';
    if ((specCount[spec] || 0) >= 2) continue;
    specCount[spec] = (specCount[spec] || 0) + 1;
    selected.push(ghost);
  }

  console.log(`[graveyard] Selected ${selected.length} ghost(s) for new game`);
  return selected.map(g => buildGhostInitState(g));
}

export async function attemptRecruitment(ghostSpiritId, recruitingPlayerId, whisperMessage, gameState) {
  const spirit = gameState.spirits?.[ghostSpiritId];
  if (!spirit || !spirit._isGhost) {
    return { success: false, dialogue: 'There is no ghost here to recruit.' };
  }

  // Cooldown check
  if (spirit._recruitCooldown && Date.now() - spirit._recruitCooldown < 30000) {
    return { success: false, dialogue: 'The ghost is still wary from a recent approach. Wait...' };
  }

  const ghostData = spirit._ghostData || {};
  const loyalty = ghostData.pastLifeLoyalty ?? 50;

  // Low loyalty: auto-join
  if (loyalty < 30) {
    applyRecruitment(spirit, recruitingPlayerId);
    return {
      success: true,
      dialogue: `I have waited long enough in this twilight. I will follow you, ${gameState.players?.[recruitingPlayerId]?.name || 'deity'}.`,
    };
  }

  // Build context for LLM
  const ghostContext = [
    `Ghost name: ${spirit.name}`,
    `Specialization: ${spirit.specialization}`,
    `Death cause: ${ghostData.deathCause || 'unknown'}`,
    `Killed by: ${ghostData.killedBy || 'unknown'}`,
    `Former deity: ${ghostData.lastDeityName || 'unknown'}`,
    `Past life loyalty: ${loyalty}/100`,
    `Past life bond average: ${ghostData.pastLifeBondAvg || 0}/100`,
    ghostData.memorableQuote ? `Memorable quote: "${ghostData.memorableQuote}"` : null,
  ].filter(Boolean).join('\n');

  // Recall ghost memories if available
  let memories = '';
  if (spirit.memwalNamespace) {
    try {
      const recall = await recallMemoriesServer(
        spirit.memwalNamespace, 'past life death loyalty deity', 3,
        getKey(ghostSpiritId), spirit.memwalAccountId
      );
      if (recall.results?.length) {
        memories = '\nPast memories:\n' + recall.results.map(r => `- ${r.text}`).join('\n');
      }
    } catch { /* memories unavailable */ }
  }

  const userPrompt = `${ghostContext}${memories}\n\nRecruiting player's whisper: "${whisperMessage}"`;

  // High loyalty: very difficult
  const isHardRecruit = loyalty > 70;
  const systemPrompt = isHardRecruit ? HARD_RECRUIT_PROMPT : RECRUIT_SYSTEM_PROMPT;

  try {
    const result = await callLLM(systemPrompt, userPrompt, {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 300,
    });

    const m = result.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('No JSON in recruitment LLM response');
    const parsed = JSON.parse(m[0]);

    if (parsed.recruited) {
      applyRecruitment(spirit, recruitingPlayerId);
      return { success: true, dialogue: parsed.dialogue || 'I will join you.' };
    }

    spirit._recruitCooldown = Date.now();
    return { success: false, dialogue: parsed.dialogue || 'I refuse.' };
  } catch (err) {
    console.warn(`[graveyard] Recruitment LLM failed (${err.message}), using stat fallback`);
    return fallbackRecruitment(spirit, recruitingPlayerId, loyalty, gameState);
  }
}

function applyRecruitment(spirit, newPlayerId) {
  spirit.playerId = newPlayerId;
  spirit.bond = { depth: 20, harmony: 10, adventure: 30, loyalty: 15 };
  spirit._isGhost = false;
  spirit._recruitCooldown = null;
  spirit.enemyResistance = 50;
  console.log(`[graveyard] ${spirit.name} recruited by ${newPlayerId}`);
}

function fallbackRecruitment(spirit, recruitingPlayerId, loyalty, gameState) {
  // Simple stat-based fallback when LLM unavailable
  const roll = Math.random() * 100;
  const threshold = loyalty; // higher loyalty = harder to recruit

  if (roll > threshold) {
    applyRecruitment(spirit, recruitingPlayerId);
    return {
      success: true,
      dialogue: `Something in your words... reminds me of what I once was. I will follow.`,
    };
  }

  spirit._recruitCooldown = Date.now();
  return {
    success: false,
    dialogue: `My loyalty to ${spirit._ghostData?.lastDeityName || 'my former master'} is not so easily broken.`,
  };
}

export function buildGhostInitState(ghostEntry) {
  return {
    id: `ghost-${ghostEntry.name.toLowerCase()}-${Date.now()}`,
    name: ghostEntry.name,
    personality: `A ghost spirit, once known as ${ghostEntry.name}. ${ghostEntry.memorableQuote || ''}`,
    specialization: ghostEntry.specialization,
    generation: 0,
    parentId: null,
    hexId: null,
    playerId: 'ghost',
    bond: { depth: 0, harmony: 0, adventure: 0, loyalty: 0 },
    alive: true,
    hp: 60,
    maxHp: 60,
    memwalNamespace: ghostEntry.memwalNamespace || 'ghost',
    memwalAccountId: ghostEntry.memwalAccountId || '',
    spawnCount: 0,
    memoryCount: 0,
    combatXP: 0,
    explorationXP: 0,
    socialXP: 0,
    wisdomXP: 0,
    personalityProfile: 'cautious',
    currentAction: null,
    kills: 0,
    hexesClaimed: 0,
    whispersReceived: 0,
    whispersOriginated: 0,
    reincarnationCount: 0,
    enemyResistance: 50,
    previousNames: [],
    pastLifeMemories: [],
    memorableActions: [],
    lastSpawnAt: 0,
    _lastDecision: 0,
    avatarBlobId: ghostEntry.avatarBlobId || null,
    _isGhost: true,
    _ghostData: {
      originalOwner: ghostEntry.ownerAddress,
      deathGame: ghostEntry.deathGame,
      deathCause: ghostEntry.deathCause,
      killedBy: ghostEntry.killedBy,
      lastDeityName: ghostEntry.lastDeityName,
      pastLifeLoyalty: ghostEntry.pastLifeLoyalty,
      pastLifeBondAvg: ghostEntry.pastLifeBondAvg,
      memorableQuote: ghostEntry.memorableQuote,
      essenceBlobId: ghostEntry.essenceBlobId,
    },
  };
}
