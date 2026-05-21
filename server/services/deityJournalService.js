import { storeEssence, readEssence } from './walrusService.js';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const INDEX_FILE = join(__dirname, '../../_data/deity-journals.json');

// ── Index persistence ────────────────────────────────────────────────────────

export function loadJournalIndex() {
  try {
    const raw = readFileSync(INDEX_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveJournalIndex(index) {
  mkdirSync(dirname(INDEX_FILE), { recursive: true });
  writeFileSync(INDEX_FILE, JSON.stringify(index, null, 2), 'utf-8');
  console.log(`[deity-journal] Saved index (${Object.keys(index).length} entries)`);
}

// ── Load / Read ──────────────────────────────────────────────────────────────

export async function loadDeityJournal(walletAddress) {
  const index = loadJournalIndex();
  const entry = index[walletAddress];
  if (!entry?.blobId) return null;

  try {
    const journal = await readEssence(entry.blobId);
    console.log(`[deity-journal] Loaded journal for ${walletAddress} (blob ${entry.blobId})`);
    return journal;
  } catch (err) {
    console.warn(`[deity-journal] Failed to read blob ${entry.blobId}:`, err.message);
    return null;
  }
}

// ── Update after game ends ───────────────────────────────────────────────────

export async function updateDeityJournal(walletAddress, gameState, playerId) {
  const player = gameState.players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found in gameState`);

  let journal = await loadDeityJournal(walletAddress);

  if (!journal) {
    journal = {
      version: 1,
      walletAddress,
      deityName: `${player.name} ${player.deityTitle || ''}`.trim(),
      updatedAt: Date.now(),
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      totalSpiritsCommanded: 0,
      totalSpiritsLost: 0,
      totalSpiritsReincarnated: 0,
      totalSpiritsGhosted: 0,
      playstyle: {
        aggressionRatio: 0,
        whisperFrequency: 0,
        dominantThemes: [],
        specTendency: 'balanced',
        deityArchetype: 'Wanderer',
      },
      bondAverages: { depth: 0, harmony: 0, adventure: 0, loyalty: 0 },
      reputation: { benevolence: 50, ruthlessness: 50, wisdom: 50, loyalty: 50 },
      memorableDeeds: [],
      gameHistory: [],
      blobId: null,
    };
    console.log(`[deity-journal] Creating new journal for ${walletAddress}`);
  }

  // ── Compute game results ─────────────────────────────────────────────────
  const allSpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId);
  const spiritsAlive = allSpirits.filter(s => s.alive).length;
  const spiritsLost = allSpirits.filter(s => !s.alive).length;
  const spiritsReincarnated = allSpirits.filter(s => (s.reincarnationCount || 0) > 0).length;
  const spiritsGhosted = allSpirits.filter(s => !s.alive && (s.reincarnationCount || 0) === 0).length;
  const hexesControlled = player.hexesControlled || 0;
  const isVictory = gameState.winner === playerId;

  // ── Cumulative stats ─────────────────────────────────────────────────────
  journal.gamesPlayed++;
  if (isVictory) journal.wins++;
  else journal.losses++;
  journal.totalSpiritsCommanded += allSpirits.length;
  journal.totalSpiritsLost += spiritsLost;
  journal.totalSpiritsReincarnated += spiritsReincarnated;
  journal.totalSpiritsGhosted += spiritsGhosted;
  journal.updatedAt = Date.now();

  // ── Recompute playstyle from this game's essenceService patterns ─────────
  const totalActions = allSpirits.reduce((sum, s) => {
    return sum + (s.kills || 0) + (s.hexesClaimed || 0) + (s.whispersReceived || 0) + (s.spawnCount || 0);
  }, 0);
  const totalBattles = allSpirits.reduce((sum, s) => sum + (s.kills || 0), 0);
  const gameAggression = totalActions > 0 ? totalBattles / totalActions : 0;
  const gameWhisperFreq = allSpirits.reduce((sum, s) => sum + (s.whispersReceived || 0), 0);

  // Rolling average: blend previous playstyle with this game's values
  const n = journal.gamesPlayed;
  journal.playstyle.aggressionRatio = +((journal.playstyle.aggressionRatio * (n - 1) + gameAggression) / n).toFixed(3);
  journal.playstyle.whisperFrequency = Math.round((journal.playstyle.whisperFrequency * (n - 1) + gameWhisperFreq) / n);

  // Dominant themes from event log
  const events = [...(gameState.eventLog || []), ...(gameState.events || [])];
  const playerSpiritIds = new Set(allSpirits.map(s => s.id));
  const themeCounters = {};
  for (const evt of events) {
    if (evt.playerId !== playerId && !playerSpiritIds.has(evt.spiritId)) continue;
    if (evt.type === 'battle_resolved') themeCounters['combat'] = (themeCounters['combat'] || 0) + 1;
    if (evt.type === 'territory_claimed') themeCounters['exploration'] = (themeCounters['exploration'] || 0) + 1;
    if (evt.type === 'spawn_complete') themeCounters['growth'] = (themeCounters['growth'] || 0) + 1;
    if (evt.type === 'whisper_sent' || evt.type === 'whisper_received') themeCounters['influence'] = (themeCounters['influence'] || 0) + 1;
  }
  if (Object.keys(themeCounters).length > 0) {
    journal.playstyle.dominantThemes = Object.entries(themeCounters)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([theme]) => theme);
  }

  // Spec tendency
  const specCounts = {};
  for (const s of allSpirits) {
    const spec = s.personalityProfile || s.specialization || 'unknown';
    specCounts[spec] = (specCounts[spec] || 0) + 1;
  }
  journal.playstyle.specTendency = Object.entries(specCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';

  // ── Bond averages (running average across all games) ─────────────────────
  const gameBonds = { depth: 0, harmony: 0, adventure: 0, loyalty: 0 };
  if (allSpirits.length > 0) {
    for (const s of allSpirits) {
      gameBonds.depth += (s.bond?.depth || 0);
      gameBonds.harmony += (s.bond?.harmony || 0);
      gameBonds.adventure += (s.bond?.adventure || 0);
      gameBonds.loyalty += (s.bond?.loyalty || 0);
    }
    gameBonds.depth = Math.round(gameBonds.depth / allSpirits.length);
    gameBonds.harmony = Math.round(gameBonds.harmony / allSpirits.length);
    gameBonds.adventure = Math.round(gameBonds.adventure / allSpirits.length);
    gameBonds.loyalty = Math.round(gameBonds.loyalty / allSpirits.length);
  }
  journal.bondAverages = {
    depth: Math.round((journal.bondAverages.depth * (n - 1) + gameBonds.depth) / n),
    harmony: Math.round((journal.bondAverages.harmony * (n - 1) + gameBonds.harmony) / n),
    adventure: Math.round((journal.bondAverages.adventure * (n - 1) + gameBonds.adventure) / n),
    loyalty: Math.round((journal.bondAverages.loyalty * (n - 1) + gameBonds.loyalty) / n),
  };

  // ── Recompute reputation ─────────────────────────────────────────────────
  const totalCommanded = journal.totalSpiritsCommanded || 1;
  const totalLost = journal.totalSpiritsLost;
  const totalKills = allSpirits.reduce((sum, s) => sum + (s.kills || 0), 0);
  const totalSocialXP = allSpirits.reduce((sum, s) => sum + (s.socialXP || 0), 0);
  const reincarnated = journal.totalSpiritsReincarnated;
  const ghosted = journal.totalSpiritsGhosted;

  // Benevolence: spirits surviving vs lost (0-100)
  const survivalRate = totalCommanded > 0 ? (totalCommanded - totalLost) / totalCommanded : 0.5;
  journal.reputation.benevolence = Math.round(Math.min(100, Math.max(0, survivalRate * 100)));

  // Ruthlessness: kills and aggression (0-100)
  const killPressure = Math.min(1, totalKills / Math.max(1, journal.gamesPlayed * 3));
  journal.reputation.ruthlessness = Math.round(Math.min(100, Math.max(0,
    killPressure * 50 + journal.playstyle.aggressionRatio * 50
  )));

  // Wisdom: whisper frequency and social XP (0-100)
  const whisperPressure = Math.min(1, journal.playstyle.whisperFrequency / 30);
  const socialPressure = Math.min(1, totalSocialXP / Math.max(1, journal.gamesPlayed * 50));
  journal.reputation.wisdom = Math.round(Math.min(100, Math.max(0,
    whisperPressure * 60 + socialPressure * 40
  )));

  // Loyalty: reincarnation vs ghosting rate (0-100)
  const totalDeparted = reincarnated + ghosted;
  const reincarnationRate = totalDeparted > 0 ? reincarnated / totalDeparted : 0.5;
  journal.reputation.loyalty = Math.round(Math.min(100, Math.max(0, reincarnationRate * 100)));

  // ── Derive archetype ─────────────────────────────────────────────────────
  const spiritLossRate = totalCommanded > 0 ? totalLost / totalCommanded : 0;
  journal.playstyle.deityArchetype = deriveArchetype(
    journal.reputation,
    journal.playstyle,
    { gamesPlayed: journal.gamesPlayed, spiritLossRate, reincarnationRate }
  );

  // ── Memorable deed from this game ────────────────────────────────────────
  const deed = _extractMemorableDeed(gameState, playerId, allSpirits, isVictory);
  if (deed) {
    journal.memorableDeeds.push(deed);
    if (journal.memorableDeeds.length > 20) {
      journal.memorableDeeds = journal.memorableDeeds.slice(-20);
    }
  }

  // ── Append game history (cap 20) ────────────────────────────────────────
  const essenceBlobId = gameState._appliedEssenceBlobId || null;
  journal.gameHistory.push({
    gameId: gameState.id,
    result: isVictory ? 'victory' : 'defeat',
    spiritsAlive,
    spiritsLost,
    hexesControlled,
    essenceBlobId,
  });
  if (journal.gameHistory.length > 20) {
    journal.gameHistory = journal.gameHistory.slice(-20);
  }

  // ── Store on Walrus ──────────────────────────────────────────────────────
  const blobId = await storeEssence(journal);
  journal.blobId = blobId;
  console.log(`[deity-journal] Stored journal for ${walletAddress} → blob ${blobId}`);

  // ── Update local index ───────────────────────────────────────────────────
  const index = loadJournalIndex();
  index[walletAddress] = { blobId, deityName: journal.deityName };
  saveJournalIndex(index);

  return blobId;
}

// ── Reputation modifiers for starting spirits ────────────────────────────────

export function computeReputationModifiers(journal) {
  const mods = { depth: 0, harmony: 0, adventure: 0, loyalty: 0, promptFragment: '' };
  if (!journal) return mods;

  const rep = journal.reputation;
  const winRate = journal.gamesPlayed > 0 ? journal.wins / journal.gamesPlayed : 0;

  if (rep.benevolence > 60) {
    mods.loyalty += 10;
    mods.harmony += 5;
  }
  if (rep.ruthlessness > 70) {
    mods.loyalty -= 10;
    mods.adventure += 5;
  }
  if (rep.wisdom > 60) {
    mods.depth += 5;
  }
  if (rep.loyalty < 30) {
    mods.loyalty -= 15;
  }
  if (winRate > 0.6) {
    mods.depth += 5;
    mods.harmony += 5;
    mods.adventure += 5;
    mods.loyalty += 5;
  }
  if (winRate < 0.2 && journal.gamesPlayed >= 3) {
    mods.loyalty -= 5;
  }

  mods.promptFragment = buildReputationPrompt(journal);
  return mods;
}

// ── LLM prompt injection ─────────────────────────────────────────────────────

export function buildReputationPrompt(journal) {
  if (!journal || journal.gamesPlayed === 0) return '';

  const name = journal.deityName;
  const archetype = journal.playstyle.deityArchetype || 'Unknown';
  const lines = [
    'DEITY REPUTATION:',
    `Your deity, ${name}, is known as a ${archetype}.`,
    `They have commanded ${journal.totalSpiritsCommanded} spirits across ${journal.gamesPlayed} games.`,
  ];

  const rep = journal.reputation;
  const winRate = journal.gamesPlayed > 0 ? journal.wins / journal.gamesPlayed : 0;

  if (rep.benevolence > 70) {
    lines.push(`${name} is renowned for protecting their spirits — few are lost under their watch.`);
  } else if (rep.benevolence < 30) {
    lines.push(`${name} treats spirits as expendable. Many have perished serving this deity.`);
  }

  if (rep.ruthlessness > 70) {
    lines.push(`${name} is feared for their aggression — enemy spirits dread their approach.`);
  } else if (rep.ruthlessness < 30) {
    lines.push(`${name} rarely seeks conflict, preferring expansion over bloodshed.`);
  }

  if (rep.wisdom > 70) {
    lines.push(`${name} speaks often to their spirits, guiding them with frequent whispers.`);
  } else if (rep.wisdom < 30) {
    lines.push(`${name} is a distant deity, rarely communicating with their swarm.`);
  }

  if (rep.loyalty > 70) {
    lines.push(`Fallen spirits are often reborn under ${name} — they honor the departed.`);
  } else if (rep.loyalty < 30) {
    lines.push(`${name} lets fallen spirits fade into nothing. The ghosted outnumber the reborn.`);
  }

  if (winRate > 0.7) {
    lines.push(`A dominant force — ${name} wins more often than not.`);
  } else if (winRate < 0.2 && journal.gamesPlayed >= 3) {
    lines.push(`${name} has struggled to claim victory. Spirits may question their leadership.`);
  }

  return lines.join('\n');
}

// ── Archetype derivation ─────────────────────────────────────────────────────

export function deriveArchetype(reputation, playstyle, stats) {
  // Tyrant takes priority (ruthless + disloyal)
  if (reputation.ruthlessness > 70 && reputation.loyalty < 30) return 'Tyrant';

  // Warlord: aggressive fighter
  if (reputation.ruthlessness > 65 && (playstyle.aggressionRatio || 0) > 0.5) return 'Warlord';

  // Shepherd: benevolent protector
  if (reputation.benevolence > 65 && (stats.spiritLossRate || 1) < 0.2) return 'Shepherd';

  // Sage: wise influencer
  if (reputation.wisdom > 60 && (playstyle.dominantThemes || []).includes('influence')) return 'Sage';

  // Phoenix: reincarnation-focused
  if ((stats.reincarnationRate || 0) > 0.6) return 'Phoenix';

  // Wanderer: too new to classify
  if ((stats.gamesPlayed || 0) < 3) return 'Wanderer';

  return 'Balanced';
}

// ── Internal helpers ─────────────────────────────────────────────────────────

function _extractMemorableDeed(gameState, playerId, allSpirits, isVictory) {
  const events = [...(gameState.eventLog || []), ...(gameState.events || [])];
  const playerSpiritIds = new Set(allSpirits.map(s => s.id));

  // Find the most dramatic event: battle narratives, deaths, victories
  const candidates = events
    .filter(e =>
      e.playerId === playerId ||
      playerSpiritIds.has(e.spiritId) ||
      playerSpiritIds.has(e.winnerId) ||
      playerSpiritIds.has(e.loserId) ||
      playerSpiritIds.has(e.attackerId) ||
      playerSpiritIds.has(e.defenderId)
    )
    .filter(e => e.narrative || e.summary || e.description)
    .map(e => e.narrative || e.summary || e.description);

  if (candidates.length > 0) {
    // Pick the last dramatic event (most recent = climax)
    return candidates[candidates.length - 1];
  }

  // Fallback: generate a generic deed from outcome
  if (isVictory) {
    const alive = allSpirits.filter(s => s.alive);
    if (alive.length === 1) {
      return `${alive[0].name} stood alone as the last spirit standing, claiming victory for their deity.`;
    }
    return `Led a swarm of ${alive.length} spirits to domination.`;
  }

  const lost = allSpirits.filter(s => !s.alive);
  if (lost.length === allSpirits.length) {
    return `All spirits perished. The swarm was extinguished.`;
  }

  return null;
}
