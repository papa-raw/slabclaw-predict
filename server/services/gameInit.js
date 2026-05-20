import { createHexGrid, getStartingPositions } from '../../lib/hexGrid.js';
import { SEED_SPIRITS } from '../../lib/seedSpirits.js';
import { setKey } from './keyStore.js';
import { getCachedAvatarBlobId } from './avatarService.js';
import crypto from 'crypto';

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

function pickDeityNames() {
  const shuffled = [...DEITY_FIRST].sort(() => Math.random() - 0.5);
  const titles = [...DEITY_TITLE].sort(() => Math.random() - 0.5);
  return {
    names: shuffled.slice(0, 6),
    titles: titles.slice(0, 6),
  };
}

export async function createInitialGameState() {
  const map = createHexGrid();
  const startPositions = getStartingPositions();
  const { names: DEITY_NAMES, titles: DEITY_TITLES } = pickDeityNames();

  const players = {};
  const spirits = {};
  const usedHexIds = new Set();

  const SWARM_SPECS = [
    ['warrior', 'scout', 'gatherer'],
    ['scout', 'gatherer', 'warrior'],
    ['gatherer', 'warrior', 'scout'],
    ['warrior', 'scout', 'gatherer'],
    ['scout', 'warrior', 'gatherer'],
    ['gatherer', 'scout', 'warrior'],
  ];
  const CHILD_NAMES = [
    ['Ember', 'Flint', 'Ash'],
    ['Drift', 'Breeze', 'Wisp'],
    ['Moss', 'Fern', 'Thorn'],
    ['Shade', 'Dusk', 'Veil'],
    ['Gale', 'Tempest', 'Zephyr'],
    ['Coral', 'Reef', 'Surge'],
  ];
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
    if (startHex) usedHexIds.add(startHex.id);

    players[playerId] = {
      id: playerId,
      name: DEITY_NAMES[i],
      deityTitle: DEITY_TITLES[i],
      walletAddress: null,
      hexesControlled: 1,
      spiritCount: 3,
      isBot: !isHuman,
      connected: false,
      lastSeen: Date.now(),
      whisperCharges: { swarm: 1, enemy: 1 },
      lastWhisperReset: Date.now(),
    };

    if (startHex) startHex.controller = playerId;

    const namespace = `swarm-${playerId}`;
    const seed = SEED_SPIRITS[i];
    const specs = SWARM_SPECS[i];
    const names = CHILD_NAMES[i];

    for (let s = 0; s < 3; s++) {
      const delegateKey = { privateKey: crypto.randomBytes(32).toString('hex') };
      const spiritId = s === 0 ? `spirit-${playerId}-seed` : `spirit-${playerId}-${s}`;

      const startBond = isHuman
        ? { depth: 40, harmony: 40, adventure: 30, loyalty: 30 }
        : { depth: 55, harmony: 55, adventure: 45, loyalty: 45 };

      // Place additional spirits on adjacent hexes
      let spiritHex = startHex;
      if (s > 0 && startHex) {
        const adjCoords = [
          { q: startHex.q + 1, r: startHex.r },
          { q: startHex.q - 1, r: startHex.r },
          { q: startHex.q, r: startHex.r + 1 },
          { q: startHex.q, r: startHex.r - 1 },
        ];
        for (const ac of adjCoords) {
          const ah = Object.values(map.hexes).find(h => h.q === ac.q && h.r === ac.r && h.terrain !== 'ocean');
          if (ah && !usedHexIds.has(ah.id)) {
            spiritHex = ah;
            usedHexIds.add(ah.id);
            ah.controller = playerId;
            players[playerId].hexesControlled++;
            break;
          }
        }
      }

      spirits[spiritId] = {
        id: spiritId,
        name: names[s],
        personality: s === 0 ? seed.personality : `A ${specs[s]} spirit of the ${names[s]} lineage. ${specs[s] === 'warrior' ? 'Fierce and protective.' : specs[s] === 'scout' ? 'Quick and curious.' : 'Patient and resourceful.'}`,
        _style: s === 0 ? (seed.style || null) : null,
        specialization: specs[s],
        generation: s === 0 ? 0 : 1,
        parentId: s === 0 ? null : `spirit-${playerId}-seed`,
        hexId: spiritHex?.id || '1010',
        playerId,
        bond: startBond,
        alive: true,
        hp: 100,
        maxHp: 100,
        memwalNamespace: namespace,
        memwalAccountId: process.env.MEMWAL_ACCOUNT_ID || '',
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
        lastSpawnAt: 0,
        _lastDecision: s * 5000, // stagger initial decisions
        avatarBlobId: getCachedAvatarBlobId(names[s]) || null,
      };

      setKey(spiritId, delegateKey.privateKey);

      if (spiritHex) {
        spiritHex.spiritIds.push(spiritId);
      }
    }
  }

  return {
    id: `game-${Date.now()}`,
    status: 'lobby', // starts in lobby, transitions to active when player connects
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
