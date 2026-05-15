import { Router } from 'express';
import { sanitizeForClient, broadcastStateChange } from '../services/wsService.js';
import { chatWithSpirit } from '../services/spiritDialogueService.js';
import { applyBondAction } from '../services/bondService.js';
import { readEssence } from '../services/walrusService.js';
import { applyEssence } from '../services/essenceService.js';

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
    const result = await chatWithSpirit({ spirit, userMessage: message, gameState: state });
    applyBondAction(spirit, 'chat');
    res.json({
      response: result.response,
      intent: result.intent,
      whispers: result.whispers.map(w => ({ to: w.to, text: w.text })),
    });
  } catch (err) {
    console.error('[chat] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
