import { Router } from 'express';
import { sanitizeForClient, broadcastStateChange } from '../services/wsService.js';
import { chatWithSpirit, chatWithEnemySpirit } from '../services/spiritDialogueService.js';
import { applyBondAction } from '../services/bondService.js';
import { applyDeityIntent, issueRallyCommand } from '../services/spiritDecisionService.js';
import { readEssence, getStorageMode } from '../services/walrusService.js';
import { applyEssence } from '../services/essenceService.js';
import { generateAvatarBackground } from '../services/avatarService.js';
import { pauseGame, resumeGame } from '../services/tickEngine.js';

const PACKAGE_ID = process.env.PACKAGE_ID || '0xb0f9ba3da143c92225ada477204a57fd61bae3f2c5c70e8593ce29eac309da21';
const ADMIN_CAP = process.env.ADMIN_CAP_ID || '0x87faef3092e7568ecac9c9e2475828ed521bace50f3747e87abb07dc585a6f88';
const MEMWAL_PKG = process.env.MEMWAL_PACKAGE_ID || '0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6';
const MEMWAL_REGISTRY = process.env.MEMWAL_REGISTRY_ID || '0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437';

const router = Router();

let getGameState;
export function setGameStateGetter(fn) { getGameState = fn; }

let restartCallback;
export function setRestartCallback(fn) { restartCallback = fn; }

// POST /api/game/restart — reset to fresh lobby
router.post('/restart', async (req, res) => {
  if (!restartCallback) {
    return res.status(503).json({ error: 'Restart not configured' });
  }
  try {
    await restartCallback();
    res.json({ status: 'restarted', message: 'Game reset to fresh lobby' });
  } catch (err) {
    console.error('[restart] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

router.post('/pause', (req, res) => {
  if (pauseGame()) return res.json({ status: 'paused' });
  res.status(400).json({ error: 'Game is not active' });
});

router.post('/resume', (req, res) => {
  if (resumeGame()) return res.json({ status: 'active' });
  res.status(400).json({ error: 'Game is not paused' });
});

router.get('/state', (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  res.json(sanitizeForClient(state));
});

router.post('/claim-slot', (req, res) => {
  const { walletAddress } = req.body;
  if (!walletAddress) return res.status(400).json({ error: 'Missing walletAddress' });

  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  const existing = Object.entries(state.players).find(([, p]) => p.walletAddress === walletAddress);
  if (existing) return res.json({ playerId: existing[0], player: existing[1], alreadyClaimed: true });

  if (state.status !== 'lobby') return res.status(400).json({ error: 'Game already started' });

  const available = Object.entries(state.players).find(([, p]) => !p.walletAddress);
  if (!available) return res.status(400).json({ error: 'All deity slots are taken' });

  const [playerId, player] = available;
  player.walletAddress = walletAddress;
  player.connected = true;
  player.lastSeen = Date.now();

  broadcastStateChange(state);
  console.log(`[claim-slot] ${walletAddress.slice(0, 10)}... claimed ${playerId} (${player.name})`);
  res.json({ playerId, player, alreadyClaimed: false });
});

router.post('/ready', async (req, res) => {
  const { playerId, importedEssence, blobId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });
  if (!player.walletAddress) return res.status(400).json({ error: 'Connect wallet first' });

  player.connected = true;
  player.lastSeen = Date.now();

  // Apply imported essence if blobId is provided
  if (blobId) {
    try {
      const essence = await readEssence(blobId);
      essence.blobId = blobId;
      applyEssence(state, essence, playerId);
      console.log(`[game/ready] Applied essence blob ${blobId} for player ${playerId}`);
    } catch (err) {
      console.warn(`[game/ready] Could not apply essence blob ${blobId}:`, err.message);
    }
  } else if (importedEssence) {
    // Legacy: accept raw essence object directly
    try {
      applyEssence(state, importedEssence, playerId);
    } catch (err) {
      console.warn('[game/ready] Could not apply importedEssence:', err.message);
    }
  }

  const connectedCount = Object.values(state.players).filter(p => p.connected).length;
  if (connectedCount >= 1 && state.status === 'lobby') {
    state.status = 'active';
    state.startedAt = Date.now();
    // Generate avatars for spirits that don't have one (new souls only — imported keep theirs)
    for (const spirit of Object.values(state.spirits)) {
      if (!spirit.avatarBlobId) {
        generateAvatarBackground(spirit, state);
      }
    }
    // Push state_change to all WS clients so lobby transitions seamlessly
    broadcastStateChange(state);
  }

  res.json({ status: state.status, connectedCount });
});

// POST /api/game/chat — chat with a spirit (server-side dialogue + whisper propagation)
router.post('/chat', async (req, res) => {
  const { spiritId, message, playerId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  if (!spiritId || !message || !playerId) {
    return res.status(400).json({ error: 'Missing spiritId, message, or playerId' });
  }

  const spirit = state.spirits[spiritId];
  if (!spirit) return res.status(404).json({ error: 'Spirit not found' });
  if (!spirit.alive) return res.status(400).json({ error: 'Spirit is not alive' });

  const isOwned = spirit.playerId === playerId;

  // Enemy spirit interaction — propaganda/diplomacy mechanic
  if (!isOwned) {
    try {
      console.log(`[chat:influence] ${playerId} → enemy ${spirit.name} (${spiritId}): "${message.slice(0, 60)}"`);
      const result = await chatWithEnemySpirit({ spirit, userMessage: message, gameState: state, foreignPlayerId: playerId });

      state.events = state.events || [];
      const responseSnippet = result.response.length > 60 ? result.response.slice(0, 60) + '...' : result.response;
      state.events.push({
        type: 'spirit_dialog',
        dialogType: 'INFLUENCE',
        sourceId: spiritId,
        sourceName: spirit.name,
        targetId: playerId,
        targetName: state.players[playerId]?.name || 'Foreign Deity',
        text: responseSnippet,
        timestamp: Date.now(),
      });

      return res.json({
        response: result.response,
        intent: null,
        whispers: [],
        chainOps: result.chainOps || [],
        influence: true,
      });
    } catch (err) {
      console.error('[chat:influence] Error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  try {
    console.log(`[chat] ${playerId} → ${spirit.name} (${spiritId}): "${message.slice(0, 60)}"`);
    const result = await chatWithSpirit({ spirit, userMessage: message, gameState: state });
    applyBondAction(spirit, 'chat');
    console.log(`[chat] ${spirit.name} responded, ${result.whispers?.length || 0} whispers propagated`);

    // Emit spirit_dialog event so the map shows a speech bubble
    state.events = state.events || [];
    const responseSnippet = result.response.length > 60 ? result.response.slice(0, 60) + '...' : result.response;
    state.events.push({
      type: 'spirit_dialog',
      dialogType: 'RESPONSE',
      sourceId: spiritId,
      sourceName: spirit.name,
      targetId: playerId,
      targetName: state.players[playerId]?.name || 'Deity',
      text: responseSnippet,
      timestamp: Date.now(),
    });

    // Act on deity intent immediately if the spirit is idle
    if (result.intent?.intent && result.intent.intent !== 'unclear') {
      const actionEvent = applyDeityIntent(spirit, result.intent, state);
      if (actionEvent) {
        console.log(`[chat] ${spirit.name} acting on deity intent: ${result.intent.intent} → ${actionEvent.type}`);
      }
    }

    res.json({
      response: result.response,
      intent: result.intent,
      whispers: result.whispers.map(w => ({ to: w.to, text: w.text })),
      chainOps: result.chainOps || [],
    });
  } catch (err) {
    console.error('[chat] Error:', err.message, err.stack?.split('\n').slice(0, 3).join('\n'));
    res.status(500).json({ error: err.message });
  }
});

// POST /api/game/command — direct tactical command (click hex to rally/attack)
router.post('/command', (req, res) => {
  const { playerId, targetHexId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  if (!playerId || !targetHexId) return res.status(400).json({ error: 'Missing playerId or targetHexId' });

  const targetHex = state.map.hexes[targetHexId];
  if (!targetHex) return res.status(400).json({ error: 'Invalid hex' });
  if (targetHex.terrain === 'ocean') return res.status(400).json({ error: 'Cannot rally to ocean' });

  const result = issueRallyCommand(playerId, targetHexId, state);
  res.json(result);
});

// POST /api/game/exit — return to lobby without disconnecting wallet
router.post('/exit', (req, res) => {
  const { playerId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });

  player.connected = false;
  player.lastSeen = Date.now();

  broadcastStateChange(state);
  console.log(`[exit] ${player.name} (${playerId}) returned to lobby`);
  res.json({ status: 'exited' });
});

// GET /api/game/chain-info — exposes deployed contract/storage metadata for UI
router.get('/chain-info', (req, res) => {
  const state = getGameState();
  const totalMemories = state
    ? Object.values(state.spirits).reduce((sum, s) => sum + (s.memoryCount || 0), 0)
    : 0;
  const totalSpirits = state
    ? Object.values(state.spirits).length
    : 0;

  res.json({
    network: 'testnet',
    storageMode: getStorageMode(),
    contracts: {
      package: { id: PACKAGE_ID, label: 'Anima Swarm Package', modules: ['spirit', 'territory', 'battle', 'spawn'] },
      adminCap: { id: ADMIN_CAP, label: 'AdminCap' },
    },
    memwal: {
      package: { id: MEMWAL_PKG, label: 'MemWal Package' },
      registry: { id: MEMWAL_REGISTRY, label: 'Account Registry' },
      relayer: process.env.MEMWAL_URL || 'https://relayer.staging.memwal.ai',
      mode: process.env.MEMWAL_DELEGATE_KEY ? 'live' : 'mock',
    },
    walrus: {
      publisher: process.env.WALRUS_PUBLISHER || 'https://publisher.walrus-testnet.walrus.space',
      aggregator: process.env.WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space',
    },
    explorers: {
      sui: 'https://suiscan.xyz/testnet/object/',
      walrusScan: 'https://walruscan.com/testnet/blob/',
      walrusAgg: (process.env.WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space') + '/v1/blobs/',
    },
    stats: { totalMemories, totalSpirits },
  });
});

export default router;
