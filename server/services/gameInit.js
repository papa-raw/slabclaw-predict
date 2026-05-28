import { createHexGrid, getStartingPositions } from '../../lib/hexGrid.js';
import { SEED_SPIRITS } from '../../lib/seedSpirits.js';
import { AFFINITIES, AFFINITY_NAMES, getAffinityFromTerrain, pickSwarmlingName, CLASS_NAMES } from '../../lib/classSystem.js';
import { TERRAIN_TYPES } from '../../lib/terrainTypes.js';
import { setKey } from './keyStore.js';
import { getCachedAvatarBlobId } from './avatarService.js';
import { selectGhostsForGame } from './graveyardService.js';
import { neighbors, hexId } from '../../lib/hexMath.js';
import crypto from 'crypto';

const SWARMLINGS_PER_PLAYER = 12;
const CAPTAINS_PER_PLAYER = 6;

const DEITY_FIRST = [
  'Pyraxis', 'Thalwen', 'Umberis', 'Kaelix', 'Verathos',
  'Zendrik', 'Morwyn', 'Aethis', 'Calvor', 'Drethyn',
  'Iskara', 'Luthane', 'Nolvex', 'Sorveil', 'Treymon',
];
const DEITY_TITLE = [
  'the Smoldering', 'of the Deep', 'Nightwarden', 'Stormcaller',
  'the Unbowed', 'Dawnkeeper', 'Ashwalker', 'of the Pale',
  'Voidtouched', 'Thornbound', 'the Hollow', 'Worldwatcher',
];

const CAPTAIN_SEED_CLASSES = [
  ['vanguard', 'ranger', 'harvester', 'oracle', 'shieldbearer', 'bard'],
  ['ranger', 'oracle', 'bard', 'vanguard', 'shadowstep', 'warden'],
  ['harvester', 'warden', 'oracle', 'bard', 'ranger', 'vanguard'],
  ['shieldbearer', 'shadowstep', 'vanguard', 'harvester', 'oracle', 'ranger'],
  ['shadowstep', 'vanguard', 'ranger', 'warden', 'bard', 'shieldbearer'],
  ['bard', 'harvester', 'shieldbearer', 'shadowstep', 'oracle', 'vanguard'],
];

const SEED_AFFINITIES = ['flame', 'wind', 'growth', 'shadow', 'wind', 'tide'];

function pickDeityNames() {
  const shuffled = [...DEITY_FIRST].sort(() => Math.random() - 0.5);
  const titles = [...DEITY_TITLE].sort(() => Math.random() - 0.5);
  return { names: shuffled.slice(0, 6), titles: titles.slice(0, 6) };
}

function findOpenAdjacentHexes(startHex, map, usedHexIds, count) {
  const found = [];
  const queue = [startHex];
  const visited = new Set([startHex.id]);

  while (queue.length > 0 && found.length < count) {
    const current = queue.shift();
    const adjCoords = neighbors({ q: current.q, r: current.r });
    for (const ac of adjCoords) {
      const id = hexId(ac.q, ac.r);
      if (visited.has(id)) continue;
      visited.add(id);
      const hex = map.hexes[id];
      if (!hex) continue;
      if (!usedHexIds.has(id)) {
        found.push(hex);
        if (found.length >= count) break;
      }
      queue.push(hex);
    }
  }
  return found;
}

function pickAffinityForTerrain(terrain) {
  const terrainData = TERRAIN_TYPES[terrain];
  if (terrainData?.elementalAffinity?.length) {
    return terrainData.elementalAffinity[Math.floor(Math.random() * terrainData.elementalAffinity.length)];
  }
  return AFFINITY_NAMES[Math.floor(Math.random() * AFFINITY_NAMES.length)];
}

export async function createInitialGameState() {
  const map = createHexGrid();
  const startPositions = getStartingPositions();
  const { names: DEITY_NAMES, titles: DEITY_TITLES } = pickDeityNames();

  const players = {};
  const spirits = {};
  const usedHexIds = new Set();
  const usedNames = new Set();

  const SEED_PROFILES = ['aggressive', 'explorer', 'cautious', 'cautious', 'aggressive', 'explorer'];

  for (let i = 0; i < 6; i++) {
    const playerId = `player-${i + 1}`;
    const isHuman = i === 0;

    let startHex = Object.values(map.hexes).find(
      h => h.q === startPositions[i].q && h.r === startPositions[i].r && !usedHexIds.has(h.id)
    );
    if (!startHex) {
      startHex = Object.values(map.hexes).find(
        h => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r)) >= 3 && !usedHexIds.has(h.id)
      );
    }
    if (startHex) {
      usedHexIds.add(startHex.id);
      startHex.controller = playerId;
    }

    const adjacentHexes = startHex
      ? findOpenAdjacentHexes(startHex, map, usedHexIds, SWARMLINGS_PER_PLAYER + CAPTAINS_PER_PLAYER)
      : [];
    for (const ah of adjacentHexes) {
      usedHexIds.add(ah.id);
      ah.controller = playerId;
    }

    const totalSpirits = CAPTAINS_PER_PLAYER + SWARMLINGS_PER_PLAYER;
    players[playerId] = {
      id: playerId,
      name: DEITY_NAMES[i],
      deityTitle: DEITY_TITLES[i],
      walletAddress: null,
      hexesControlled: 1 + adjacentHexes.length,
      spiritCount: totalSpirits,
      isBot: !isHuman,
      connected: false,
      lastSeen: Date.now(),
      whisperCharges: { swarm: 1, enemy: 1 },
      lastWhisperReset: Date.now(),
    };

    const namespace = `swarm-${playerId}`;
    const seed = SEED_SPIRITS[i];
    const captainClasses = CAPTAIN_SEED_CLASSES[i];
    const playerAffinity = SEED_AFFINITIES[i];

    const allHexes = [startHex, ...adjacentHexes].filter(Boolean);
    let hexCursor = 0;
    function nextHex() {
      const h = allHexes[hexCursor % allHexes.length];
      hexCursor++;
      return h;
    }

    // --- Spawn 3 Captains (existing seed spirits) ---
    const CAPTAIN_NAMES_BY_PLAYER = [
      [seed.name, 'Flint', 'Ash', 'Cinder', 'Blaze', 'Scoria'],
      [seed.name, 'Breeze', 'Wisp', 'Gale', 'Cirrus', 'Zephyr'],
      [seed.name, 'Fern', 'Thorn', 'Moss', 'Briar', 'Root'],
      [seed.name, 'Dusk', 'Veil', 'Shade', 'Shroud', 'Eclipse'],
      [seed.name, 'Tempest', 'Squall', 'Bolt', 'Gust', 'Howl'],
      [seed.name, 'Reef', 'Surge', 'Coral', 'Kelp', 'Riptide'],
    ];
    const captainNames = CAPTAIN_NAMES_BY_PLAYER[i];

    for (let c = 0; c < CAPTAINS_PER_PLAYER; c++) {
      const spiritId = c === 0 ? `spirit-${playerId}-seed` : `spirit-${playerId}-cap-${c}`;
      const spiritHex = nextHex();
      const delegateKey = { privateKey: crypto.randomBytes(32).toString('hex') };
      const captainClass = captainClasses[c];
      const affinity = c === 0 ? playerAffinity : pickAffinityForTerrain(spiritHex?.terrain || 'grassland');

      const startBond = isHuman
        ? { depth: 40, harmony: 40, adventure: 30, loyalty: 30 }
        : { depth: 55, harmony: 55, adventure: 45, loyalty: 45 };

      const personality = c === 0 ? seed.personality
        : `A ${captainClass} captain of the ${captainNames[c]} lineage. ${captainClass === 'vanguard' ? 'Fierce and protective.' : captainClass === 'ranger' ? 'Quick and perceptive.' : captainClass === 'harvester' ? 'Patient and resourceful.' : captainClass === 'oracle' ? 'Wise and contemplative.' : captainClass === 'shieldbearer' ? 'Stalwart and loyal.' : captainClass === 'shadowstep' ? 'Cunning and swift.' : captainClass === 'warden' ? 'Resolute and territorial.' : 'Inspiring and harmonious.'}`;

      spirits[spiritId] = {
        id: spiritId,
        name: captainNames[c],
        personality,
        _style: c === 0 ? (seed.style || null) : null,
        specialization: captainClass === 'vanguard' || captainClass === 'shieldbearer' || captainClass === 'shadowstep' ? 'warrior'
          : captainClass === 'ranger' ? 'scout'
          : captainClass === 'harvester' || captainClass === 'bard' ? 'gatherer'
          : 'sage',
        tier: 'captain',
        affinity,
        captainClass,
        commandRadius: 2,
        orderText: null,
        orderSource: null,
        generation: c === 0 ? 0 : 1,
        parentId: c === 0 ? null : `spirit-${playerId}-seed`,
        hexId: spiritHex?.id || '1010',
        playerId,
        bond: startBond,
        alive: true,
        hp: 100,
        maxHp: 100,
        memwalNamespace: namespace,
        memwalAccountId: process.env.MEMWAL_ACCOUNT_ID || '',
        memoryLedger: [],
        behaviorRules: null,
        spawnCount: 0,
        memoryCount: isHuman ? 3 : 12,
        combatXP: 0,
        explorationXP: 0,
        socialXP: 0,
        wisdomXP: 0,
        personalityProfile: SEED_PROFILES[i],
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
        legendaryDeeds: 0,
        lastSpawnAt: 0,
        _lastDecision: c * 5000,
        avatarBlobId: getCachedAvatarBlobId(captainNames[c]) || null,
      };

      usedNames.add(captainNames[c]);
      setKey(spiritId, delegateKey.privateKey);

      if (spiritHex) {
        spiritHex.spiritIds.push(spiritId);
      }
    }

    // --- Spawn 12 Swarmlings ---
    for (let s = 0; s < SWARMLINGS_PER_PLAYER; s++) {
      const spiritHex = nextHex();
      const affinity = pickAffinityForTerrain(spiritHex?.terrain || 'grassland');
      const swarmName = pickSwarmlingName(affinity, usedNames);
      usedNames.add(swarmName);

      const spiritId = `spirit-${playerId}-sw-${s}`;
      const delegateKey = { privateKey: crypto.randomBytes(32).toString('hex') };

      spirits[spiritId] = {
        id: spiritId,
        name: swarmName,
        personality: `A ${affinity} swarmling of the ${DEITY_NAMES[i]} swarm.`,
        _style: null,
        specialization: ['warrior', 'scout', 'gatherer', 'sage'][s % 4],
        tier: 'swarmling',
        affinity,
        captainClass: null,
        commandRadius: 0,
        orderText: null,
        orderSource: null,
        generation: 2,
        parentId: `spirit-${playerId}-seed`,
        hexId: spiritHex?.id || '1010',
        playerId,
        bond: { depth: 20, harmony: 20, adventure: 15, loyalty: 15 },
        alive: true,
        hp: 60,
        maxHp: 60,
        memwalNamespace: namespace,
        memwalAccountId: process.env.MEMWAL_ACCOUNT_ID || '',
        memoryLedger: [],
        spawnCount: 0,
        memoryCount: 0,
        combatXP: 0,
        explorationXP: 0,
        socialXP: 0,
        wisdomXP: 0,
        personalityProfile: 'swarmling',
        currentAction: null,
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
        _lastDecision: (CAPTAINS_PER_PLAYER + s) * 2000,
        avatarBlobId: null,
      };

      setKey(spiritId, delegateKey.privateKey);
      if (spiritHex) {
        spiritHex.spiritIds.push(spiritId);
      }
    }
  }

  const ghostSpirits = selectGhostsForGame(2);
  const unclaimedHexes = Object.values(map.hexes).filter(
    h => !h.controller && !usedHexIds.has(h.id)
  );
  const shuffledUnclaimed = [...unclaimedHexes].sort(() => Math.random() - 0.5);

  for (let g = 0; g < ghostSpirits.length && g < shuffledUnclaimed.length; g++) {
    const ghost = ghostSpirits[g];
    const hex = shuffledUnclaimed[g];
    ghost.hexId = hex.id;
    ghost.tier = ghost.tier || 'captain';
    ghost.affinity = ghost.affinity || 'shadow';
    ghost.captainClass = ghost.captainClass || null;
    ghost.commandRadius = ghost.tier === 'captain' ? 2 : 0;
    ghost.promotionXP = ghost.promotionXP || 0;
    ghost.legendaryDeeds = ghost.legendaryDeeds || 0;
    hex.spiritIds.push(ghost.id);
    usedHexIds.add(hex.id);

    const delegateKey = { privateKey: crypto.randomBytes(32).toString('hex') };
    setKey(ghost.id, delegateKey.privateKey);
    spirits[ghost.id] = ghost;
  }

  if (ghostSpirits.length > 0) {
    console.log(`[gameInit] Placed ${Math.min(ghostSpirits.length, shuffledUnclaimed.length)} ghost(s) on the map`);
  }

  const totalSpirits = Object.keys(spirits).length;
  const captainCount = Object.values(spirits).filter(s => s.tier === 'captain').length;
  const swarmlingCount = Object.values(spirits).filter(s => s.tier === 'swarmling').length;
  console.log(`[gameInit] Spawned ${totalSpirits} spirits (${captainCount} captains, ${swarmlingCount} swarmlings)`);

  return {
    id: `game-${Date.now()}`,
    status: 'lobby',
    startedAt: Date.now(),
    tickInterval: 5000,
    map,
    players,
    spirits,
    pendingActions: [],
    activeTimers: [],
    actionHistory: [],
    eventLog: [],
    winner: null,
  };
}
