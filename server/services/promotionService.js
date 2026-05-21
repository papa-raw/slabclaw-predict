import { assignCaptainClass, PROMOTION_THRESHOLDS, LEGENDARY_DEED_XP, CAPTAIN_CLASSES, pickSwarmlingName, AFFINITIES } from '../../lib/classSystem.js';
import { callLLM } from './llmProxy.js';
import { storeMemoryServer, recallMemoriesServer } from './memwalServer.js';
import { getKey } from './keyStore.js';
import { broadcast } from './wsService.js';

export function checkPromotions(gameState) {
  const events = [];

  for (const spirit of Object.values(gameState.spirits)) {
    if (!spirit.alive) continue;

    if (spirit.tier === 'swarmling') {
      const threshold = spirit.promotionThreshold || PROMOTION_THRESHOLDS.swarmling_to_captain;
      if ((spirit.promotionXP || 0) >= threshold) {
        promoteToCapt(spirit, gameState, events);
      }
    }

    if (spirit.tier === 'captain') {
      updateLegendaryDeeds(spirit);
      if ((spirit.legendaryDeeds || 0) >= PROMOTION_THRESHOLDS.captain_to_hero) {
        const heroCount = Object.values(gameState.spirits).filter(
          s => s.alive && s.playerId === spirit.playerId && s.tier === 'hero'
        ).length;
        if (heroCount < 2) {
          promoteToHero(spirit, gameState, events);
        }
      }
    }
  }

  if (events.length > 0) {
    broadcast(gameState, events);
  }
}

function promoteToCapt(spirit, gameState, events) {
  spirit.tier = 'captain';
  spirit.captainClass = assignCaptainClass(spirit);
  spirit.commandRadius = CAPTAIN_CLASSES[spirit.captainClass]?.radius || 2;
  spirit.maxHp = 100;
  spirit.hp = Math.min(spirit.hp + 40, spirit.maxHp);
  spirit.promotionXP = 0;
  spirit.promotionThreshold = null;

  const cls = CAPTAIN_CLASSES[spirit.captainClass];
  spirit.personality = `Promoted ${spirit.captainClass} captain. ${cls?.desc || ''} Formerly a ${spirit.affinity} swarmling. ${spirit.kills > 0 ? `${spirit.kills} kills in the swarm.` : 'Untested in battle.'}`;

  generateCaptainPersonality(spirit, gameState);

  events.push({
    type: 'promotion',
    spiritId: spirit.id,
    spiritName: spirit.name,
    playerId: spirit.playerId,
    fromTier: 'swarmling',
    toTier: 'captain',
    captainClass: spirit.captainClass,
    hexId: spirit.hexId,
    timestamp: Date.now(),
  });
}

async function generateCaptainPersonality(spirit, gameState) {
  try {
    const result = await callLLM(
      'Generate a 2-sentence personality for a newly promoted spirit captain.',
      `Spirit ${spirit.name} was a ${spirit.affinity} swarmling. Promoted to ${spirit.captainClass} captain after ${spirit.kills} kills and claiming ${spirit.hexesClaimed} hexes. Generate a brief personality in 2 sentences.`,
      { model: 'deepseek/deepseek-v4-flash:free', maxTokens: 100 }
    );
    if (result) spirit.personality = result;
  } catch {
    // keep generated personality
  }
}

function promoteToHero(spirit, gameState, events) {
  spirit.tier = 'hero';
  spirit.commandRadius = 3;
  spirit.maxHp = 150;
  spirit.hp = Math.min(spirit.hp + 50, spirit.maxHp);
  spirit.legendaryDeeds = 0;

  generateHeroTitle(spirit, gameState);

  events.push({
    type: 'promotion',
    spiritId: spirit.id,
    spiritName: spirit.name,
    playerId: spirit.playerId,
    fromTier: 'captain',
    toTier: 'hero',
    captainClass: spirit.captainClass,
    hexId: spirit.hexId,
    timestamp: Date.now(),
  });
}

async function generateHeroTitle(spirit, gameState) {
  try {
    const key = getKey(spirit.id);
    const memories = await recallMemoriesServer(
      spirit.memwalNamespace, `${spirit.name} legendary deeds`, 5, key, spirit.memwalAccountId
    ).catch(() => ({ results: [] }));

    const memContext = memories.results?.map(r => r.text).join('\n') || '(no memories recalled)';

    const result = await callLLM(
      'Generate a unique hero title and special ability for a promoted spirit hero. Return JSON.',
      `Spirit: ${spirit.name}\nClass: ${spirit.captainClass}\nAffinity: ${spirit.affinity}\nKills: ${spirit.kills}\nHexes claimed: ${spirit.hexesClaimed}\nMemories:\n${memContext}\n\nReturn JSON: {"title": "...", "ability": "...", "description": "..."}`,
      { model: 'deepseek/deepseek-v4-flash:free', maxTokens: 200 }
    );

    const match = result?.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      spirit.heroTitle = parsed.title || `${spirit.name} the Ascended`;
      spirit.heroAbility = parsed.ability || 'Inspiring Presence';
    } else {
      spirit.heroTitle = `${spirit.name} the Ascended`;
      spirit.heroAbility = 'Inspiring Presence';
    }

    storeMemoryServer(
      spirit.memwalNamespace,
      `[HERO ASCENSION] ${spirit.name} became ${spirit.heroTitle}. Ability: ${spirit.heroAbility}`,
      key, spirit.memwalAccountId
    ).catch(() => {});
  } catch {
    spirit.heroTitle = `${spirit.name} the Ascended`;
    spirit.heroAbility = 'Inspiring Presence';
  }
}

function updateLegendaryDeeds(spirit) {
  let deeds = 0;
  if ((spirit.kills || 0) >= 3) deeds += Math.floor(spirit.kills / 3) * LEGENDARY_DEED_XP.kill_captain_or_hero;
  if ((spirit.combatXP || 0) >= 15) deeds += LEGENDARY_DEED_XP.survive_5_battles;
  if ((spirit.hexesClaimed || 0) >= 10) deeds += LEGENDARY_DEED_XP.claim_10_hexes;
  if ((spirit.whispersReceived || 0) >= 20) deeds += LEGENDARY_DEED_XP.receive_20_whispers;
  if ((spirit.spawnCount || 0) >= 3) deeds += LEGENDARY_DEED_XP.spawn_3_children;
  spirit.legendaryDeeds = deeds;
}
