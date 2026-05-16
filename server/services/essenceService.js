/**
 * essenceService.js — Compute and apply SwarmEssence JSON from game state.
 * Pure logic, no external deps.
 */

/**
 * Compute a SwarmEssence object for a given player from the current game state.
 * @param {object} gameState
 * @param {string} playerId
 * @param {Array} previousEssences - optional chain of prior essence blob IDs
 * @returns {object} SwarmEssence JSON
 */
export function computeEssence(gameState, playerId, previousEssences = []) {
  const player = gameState.players[playerId];
  if (!player) throw new Error(`Player ${playerId} not found`);

  const allSpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId);
  const events = [
    ...(gameState.eventLog || []),
    ...(gameState.events || []),
  ];

  // ── Playstyle fingerprint ─────────────────────────────────────────────────
  const totalActions = allSpirits.reduce((sum, s) => {
    return sum + (s.kills || 0) + (s.hexesClaimed || 0) + (s.whispersReceived || 0) + (s.spawnCount || 0);
  }, 0);
  const totalBattles = allSpirits.reduce((sum, s) => sum + (s.kills || 0), 0);

  const aggressionRatio = totalActions > 0 ? +(totalBattles / totalActions).toFixed(3) : 0;

  const whisperFrequency = allSpirits.reduce((sum, s) => sum + (s.whispersReceived || 0), 0);

  // Derive dominant themes from event log
  const themeCounters = {};
  for (const evt of events) {
    if (evt.playerId !== playerId && !allSpirits.some(s => s.id === evt.spiritId)) continue;
    if (evt.type === 'battle_resolved') themeCounters['combat'] = (themeCounters['combat'] || 0) + 1;
    if (evt.type === 'territory_claimed') themeCounters['exploration'] = (themeCounters['exploration'] || 0) + 1;
    if (evt.type === 'spawn_complete') themeCounters['growth'] = (themeCounters['growth'] || 0) + 1;
    if (evt.type === 'whisper_sent' || evt.type === 'whisper_received') themeCounters['influence'] = (themeCounters['influence'] || 0) + 1;
  }
  // Fallback themes if no events captured
  if (Object.keys(themeCounters).length === 0) {
    themeCounters['exploration'] = 1;
  }
  const dominantThemes = Object.entries(themeCounters)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([theme]) => theme);

  // Spec tendency from spirits
  const specCounts = {};
  for (const s of allSpirits) {
    const spec = s.personalityProfile || s.specialization || 'unknown';
    specCounts[spec] = (specCounts[spec] || 0) + 1;
  }
  const specTendency = Object.entries(specCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'balanced';

  // ── Spirit legacies ───────────────────────────────────────────────────────
  const spiritLegacies = allSpirits.map(s => ({
    name: s.name,
    personality: s.personality || '',
    personalityProfile: s.personalityProfile || 'balanced',
    generation: s.generation || 0,
    bond: s.bond || { depth: 0, harmony: 0, adventure: 0, loyalty: 0 },
    combatXP: s.combatXP || 0,
    explorationXP: s.explorationXP || 0,
    socialXP: s.socialXP || 0,
    wisdomXP: s.wisdomXP || 0,
    kills: s.kills || 0,
    hexesClaimed: s.hexesClaimed || 0,
    alive: s.alive !== false,
    memorableActions: s.memorableActions || [],
    reincarnationCount: s.reincarnationCount || 0,
    previousNames: s.previousNames || [],
    specialization: s.specialization || '',
    parentId: s.parentId || null,
    avatarBlobId: s.avatarBlobId || null,
  }));

  // ── Core memories (top 10 from event log relevant to this player) ─────────
  const playerSpiritIds = new Set(allSpirits.map(s => s.id));
  const relevantEvents = events.filter(e =>
    e.playerId === playerId ||
    e.targetPlayerId === playerId ||
    playerSpiritIds.has(e.spiritId) ||
    playerSpiritIds.has(e.winnerId) ||
    playerSpiritIds.has(e.loserId) ||
    playerSpiritIds.has(e.attackerId) ||
    playerSpiritIds.has(e.defenderId) ||
    playerSpiritIds.has(e.parentId) ||
    playerSpiritIds.has(e.childId)
  );

  const coreMemories = relevantEvents
    .filter(e => e.narrative || e.summary || e.description || e.message)
    .slice(-20)
    .map(e => e.narrative || e.summary || e.description || e.message)
    .filter(Boolean)
    .slice(-10);

  // Ensure at least some memories from spirit memorableActions
  if (coreMemories.length < 5) {
    for (const s of allSpirits) {
      for (const action of (s.memorableActions || [])) {
        if (!coreMemories.includes(action)) coreMemories.push(action);
        if (coreMemories.length >= 10) break;
      }
      if (coreMemories.length >= 10) break;
    }
  }

  // ── Game outcome ──────────────────────────────────────────────────────────
  const finalStandings = Object.entries(gameState.players)
    .map(([id, p]) => ({
      playerId: id,
      name: p.name,
      deityTitle: p.deityTitle || '',
      hexes: p.hexesControlled || 0,
      spirits: Object.values(gameState.spirits).filter(s => s.playerId === id && s.alive).length,
    }))
    .sort((a, b) => b.hexes - a.hexes);

  const allEvents = gameState.eventLog || gameState.events || [];
  const totalBattleCount = allEvents.filter(e => e.type === 'battle_resolved').length;
  const totalSpawnCount = allEvents.filter(e => e.type === 'spawn_complete').length;
  const totalDeathCount = Object.values(gameState.spirits).filter(s => !s.alive).length;

  const gameOutcome = {
    winner: gameState.winner || null,
    isVictory: gameState.winner === playerId,
    finalStandings,
    totalBattles: totalBattleCount,
    totalSpawns: totalSpawnCount,
    totalDeaths: totalDeathCount,
    gameDurationTicks: gameState._tickCount || 0,
  };

  return {
    version: 1,
    gameId: gameState.id,
    exportedAt: Date.now(),
    deityName: `${player.name} ${player.deityTitle || ''}`.trim(),
    playstyle: {
      aggressionRatio,
      whisperFrequency,
      dominantThemes,
      specTendency,
    },
    spiritLegacies,
    coreMemories,
    gameOutcome,
    previousEssences: Array.isArray(previousEssences) ? previousEssences : [],
  };
}

/**
 * Apply an imported essence to the game state, replacing a player's seed spirit
 * with reincarnated versions carrying past-life data.
 * @param {object} gameState
 * @param {object} essenceData - SwarmEssence object
 * @param {string} playerId
 */
export function applyEssence(gameState, essenceData, playerId) {
  if (!essenceData?.spiritLegacies?.length) return;

  // Idempotency guard: skip if this exact blob has already been applied
  if (essenceData.blobId && gameState._appliedEssenceBlobId === essenceData.blobId) {
    console.log(`[applyEssence] Skipping duplicate blobId: ${essenceData.blobId}`);
    return;
  }

  // Find the player's current seed spirit (generation 0, lowest id)
  const playerSpirits = Object.values(gameState.spirits)
    .filter(s => s.playerId === playerId)
    .sort((a, b) => (a.generation || 0) - (b.generation || 0));

  if (!playerSpirits.length) return;

  // The primary seed spirit to receive reincarnation data
  const seedSpirit = playerSpirits[0];

  // The best legacy to reincarnate from (highest XP, alive preferred)
  const candidates = essenceData.spiritLegacies.slice().sort((a, b) => {
    const aXP = (a.combatXP || 0) + (a.explorationXP || 0) + (a.socialXP || 0) + (a.wisdomXP || 0);
    const bXP = (b.combatXP || 0) + (b.explorationXP || 0) + (b.socialXP || 0) + (b.wisdomXP || 0);
    return bXP - aXP;
  });
  const bestLegacy = candidates[0];
  if (!bestLegacy) return;

  // Lineage depth bonus: deeper lineages carry more forward
  const lineageDepth = (essenceData.previousEssences || []).length;
  const depthBonus = Math.min(lineageDepth * 0.02, 0.10); // +2% per generation, cap at +10%
  const xpCarryover = 0.20 + depthBonus;
  const bondCarryover = 0.15 + depthBonus;

  seedSpirit.combatXP = Math.floor((seedSpirit.combatXP || 0) + (bestLegacy.combatXP || 0) * xpCarryover);
  seedSpirit.explorationXP = Math.floor((seedSpirit.explorationXP || 0) + (bestLegacy.explorationXP || 0) * xpCarryover);
  seedSpirit.socialXP = Math.floor((seedSpirit.socialXP || 0) + (bestLegacy.socialXP || 0) * xpCarryover);
  seedSpirit.wisdomXP = Math.floor((seedSpirit.wisdomXP || 0) + (bestLegacy.wisdomXP || 0) * xpCarryover);

  const prevBond = bestLegacy.bond || { depth: 0, harmony: 0, adventure: 0, loyalty: 0 };
  seedSpirit.bond = {
    depth: Math.min(100, Math.floor((seedSpirit.bond?.depth || 40) + (prevBond.depth || 0) * bondCarryover)),
    harmony: Math.min(100, Math.floor((seedSpirit.bond?.harmony || 40) + (prevBond.harmony || 0) * bondCarryover)),
    adventure: Math.min(100, Math.floor((seedSpirit.bond?.adventure || 30) + (prevBond.adventure || 0) * bondCarryover)),
    loyalty: Math.min(100, Math.floor((seedSpirit.bond?.loyalty || 30) + (prevBond.loyalty || 0) * bondCarryover)),
  };

  // Past life data
  seedSpirit.reincarnationCount = (bestLegacy.reincarnationCount || 0) + 1;
  seedSpirit.previousNames = [bestLegacy.name, ...(bestLegacy.previousNames || [])];
  seedSpirit.pastLifeMemories = [
    ...(essenceData.coreMemories || []).slice(0, 5),
    ...((bestLegacy.memorableActions || []).slice(0, 3)),
  ];
  seedSpirit.memorableActions = seedSpirit.memorableActions || [];

  // Inherit avatar from previous life (soul-bound — stable unless essence changes)
  if (bestLegacy.avatarBlobId) {
    seedSpirit.avatarBlobId = bestLegacy.avatarBlobId;
  }

  // Track that this essence was applied
  gameState._appliedEssenceBlobId = essenceData.blobId || null;
  gameState._essenceChain = [
    ...(essenceData.previousEssences || []),
    ...(essenceData.blobId ? [essenceData.blobId] : []),
  ];
}

/**
 * Build a reincarnation preview from essence data (for the import endpoint).
 * @param {object} essenceData
 * @returns {object} preview
 */
export function buildReincarnationPreview(essenceData) {
  const lineageDepth = (essenceData.previousEssences || []).length + 1;
  const depthBonus = Math.min((lineageDepth - 1) * 0.02, 0.10);
  const effectiveXpRate = 0.20 + depthBonus;
  const effectiveBondRate = 0.15 + depthBonus;

  const candidates = (essenceData.spiritLegacies || []).map(s => {
    const totalXP = (s.combatXP || 0) + (s.explorationXP || 0) + (s.socialXP || 0) + (s.wisdomXP || 0);
    return {
      name: s.name,
      personalityProfile: s.personalityProfile || 'balanced',
      generation: s.generation || 0,
      xpCarryover: Math.floor(totalXP * effectiveXpRate),
      bondCarryover: {
        depth: Math.floor((s.bond?.depth || 0) * effectiveBondRate),
        harmony: Math.floor((s.bond?.harmony || 0) * effectiveBondRate),
        adventure: Math.floor((s.bond?.adventure || 0) * effectiveBondRate),
        loyalty: Math.floor((s.bond?.loyalty || 0) * effectiveBondRate),
      },
      pastLifeNames: [s.name, ...(s.previousNames || [])],
      kills: s.kills || 0,
      hexesClaimed: s.hexesClaimed || 0,
      alive: s.alive !== false,
      reincarnationCount: s.reincarnationCount || 0,
      avatarBlobId: s.avatarBlobId || null,
    };
  });

  return {
    lineageDepth,
    lineageBonus: depthBonus > 0 ? `+${Math.round(depthBonus * 100)}% from lineage depth` : null,
    deityName: essenceData.deityName || 'Unknown Deity',
    gameOutcome: essenceData.gameOutcome || null,
    candidates,
    coreMemories: (essenceData.coreMemories || []).slice(0, 5),
    playstyle: essenceData.playstyle || null,
  };
}
