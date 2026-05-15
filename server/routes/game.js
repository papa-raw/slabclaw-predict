import { Router } from 'express';
import { sanitizeForClient, broadcastStateChange } from '../services/wsService.js';
import { chatWithSpirit } from '../services/spiritDialogueService.js';
import { applyBondAction } from '../services/bondService.js';
import { readEssence, getStorageMode } from '../services/walrusService.js';
import { applyEssence } from '../services/essenceService.js';

const PACKAGE_ID = '0xb0f9ba3da143c92225ada477204a57fd61bae3f2c5c70e8593ce29eac309da21';
const ADMIN_CAP = '0x87faef3092e7568ecac9c9e2475828ed521bace50f3747e87abb07dc585a6f88';
const MEMWAL_PKG = '0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6';
const MEMWAL_REGISTRY = '0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437';

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

router.get('/state', (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  res.json(sanitizeForClient(state));
});

router.post('/ready', async (req, res) => {
  const { playerId, importedEssence, blobId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });

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
  if (spirit.playerId !== playerId) return res.status(403).json({ error: 'Not your spirit' });
  if (!spirit.alive) return res.status(400).json({ error: 'Spirit is not alive' });

  try {
    console.log(`[chat] ${playerId} → ${spirit.name} (${spiritId}): "${message.slice(0, 60)}"`);
    const result = await chatWithSpirit({ spirit, userMessage: message, gameState: state });
    applyBondAction(spirit, 'chat');
    console.log(`[chat] ${spirit.name} responded, ${result.whispers?.length || 0} whispers propagated`);
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
