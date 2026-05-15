import { createHexGrid, getStartingPositions } from '../../lib/hexGrid.js';
import { SEED_SPIRITS } from '../../lib/seedSpirits.js';
import { setKey } from './keyStore.js';
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
    names: ['You', ...shuffled.slice(0, 4)],
    titles: ['the Awakened', ...titles.slice(0, 4)],
  };
}

export async function createInitialGameState() {
  const map = createHexGrid();
  const startPositions = getStartingPositions();
  const { names: DEITY_NAMES, titles: DEITY_TITLES } = pickDeityNames();

  const players = {};
  const spirits = {};
  const usedHexIds = new Set();

  for (let i = 0; i < 5; i++) {
    const playerId = `player-${i + 1}`;
    const isHuman = i === 0; // player 1 is human, rest are bots

    // Find starting hex — fallback to nearest unclaimed if position collides
    let startHex = Object.values(map.hexes).find(
      h => h.q === startPositions[i].q && h.r === startPositions[i].r && !usedHexIds.has(h.id)
    );
    if (!startHex) {
      // Pick any unclaimed outer-ring hex as fallback
      startHex = Object.values(map.hexes).find(
        h => Math.max(Math.abs(h.q), Math.abs(h.r), Math.abs(-h.q - h.r)) >= 2 && !usedHexIds.has(h.id)
      );
    }
    if (startHex) usedHexIds.add(startHex.id);

    const SEED_PROFILES = ['aggressive', 'explorer', 'cautious', 'cautious', 'aggressive'];

    players[playerId] = {
      id: playerId,
      name: isHuman ? 'You' : DEITY_NAMES[i],
      deityTitle: DEITY_TITLES[i],
      walletAddress: null,
      hexesControlled: 1,
      spiritCount: 1,
      isBot: !isHuman,
      connected: isHuman,
      lastSeen: Date.now(),
    };

    // Claim starting hex
    if (startHex) {
      startHex.controller = playerId;
    }

    // Create seed spirit
    const seed = SEED_SPIRITS[i];
    // Sprint 1: use mock delegate key instead of MemWal generateDelegateKey
    const delegateKey = { privateKey: crypto.randomBytes(32).toString('hex') };
    const spiritId = `spirit-${playerId}-seed`;
    const namespace = `swarm-${playerId}`;

    // Bots get higher starting bond so they can spawn without human chat
    const startBond = isHuman
      ? { depth: 40, harmony: 40, adventure: 30, loyalty: 30 }
      : { depth: 55, harmony: 55, adventure: 45, loyalty: 45 };

    spirits[spiritId] = {
      id: spiritId,
      name: seed.name,
      personality: seed.personality,
      _style: seed.style || null,
      specialization: seed.specialization,
      generation: 0,
      parentId: null,
      hexId: startHex?.id || '1010',
      playerId,
      bond: startBond,
      alive: true,
      memwalNamespace: namespace,
      memwalAccountId: '', // populated when MemWal account created (Sprint 4)
      spawnCount: 0,
      memoryCount: isHuman ? 0 : 12, // bots start with 12 memories so they can spawn
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
      previousNames: [],
      pastLifeMemories: [],
      memorableActions: [],
      lastSpawnAt: 0, // enables spawn readiness check immediately
      _lastDecision: 0, // forces immediate first decision
    };

    // Store delegate key separately (never serialized with game state)
    setKey(spiritId, delegateKey.privateKey);

    // Add spirit to hex
    if (startHex) {
      startHex.spiritIds.push(spiritId);
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
