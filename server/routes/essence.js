/**
 * essence.js — API routes for SwarmEssence export/import/confirm.
 *
 * POST /api/essence/export   — compute essence from game state + store on Walrus
 * POST /api/essence/import   — read essence from Walrus + return preview
 * POST /api/essence/confirm  — apply essence to game state (replace seed spirits)
 */

import { Router } from 'express';
import { computeEssence, applyEssence, buildReincarnationPreview } from '../services/essenceService.js';
import { storeEssence, readEssence } from '../services/walrusService.js';

const router = Router();

let getGameState;
export function setGameStateGetter(fn) { getGameState = fn; }

/**
 * POST /api/essence/export
 * Body: { playerId }
 * Returns: { blobId, essence }
 */
router.post('/export', async (req, res) => {
  try {
    const { playerId } = req.body;
    if (!playerId) return res.status(400).json({ error: 'playerId is required' });

    const gameState = getGameState();
    if (!gameState) return res.status(404).json({ error: 'No active game' });

    const player = gameState.players[playerId];
    if (!player) return res.status(404).json({ error: `Player ${playerId} not found` });

    // Build essence chain from prior game if available
    const previousEssences = gameState._essenceChain || [];

    const essence = computeEssence(gameState, playerId, previousEssences);
    const blobId = await storeEssence(essence);

    // Attach blobId to the essence object so it can be referenced in lineage chains
    essence.blobId = blobId;

    res.json({ blobId, essence });
  } catch (err) {
    console.error('[essence/export] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/essence/import
 * Body: { blobId }
 * Returns: { essence, preview }
 */
router.post('/import', async (req, res) => {
  try {
    const { blobId } = req.body;
    if (!blobId) return res.status(400).json({ error: 'blobId is required' });

    const essence = await readEssence(blobId);
    const preview = buildReincarnationPreview(essence);

    res.json({ essence, preview });
  } catch (err) {
    console.error('[essence/import] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/essence/confirm
 * Body: { blobId, playerId }
 * Returns: { success, message, updatedSpirits }
 */
router.post('/confirm', async (req, res) => {
  try {
    const { blobId, playerId } = req.body;
    if (!blobId || !playerId) return res.status(400).json({ error: 'blobId and playerId are required' });

    const gameState = getGameState();
    if (!gameState) return res.status(404).json({ error: 'No active game' });

    const player = gameState.players[playerId];
    if (!player) return res.status(404).json({ error: `Player ${playerId} not found` });

    const essence = await readEssence(blobId);
    // Attach blobId so applyEssence can track the chain
    essence.blobId = blobId;

    applyEssence(gameState, essence, playerId);

    // Return updated spirits for this player
    const updatedSpirits = Object.values(gameState.spirits)
      .filter(s => s.playerId === playerId)
      .map(s => ({
        id: s.id,
        name: s.name,
        reincarnationCount: s.reincarnationCount || 0,
        previousNames: s.previousNames || [],
        pastLifeMemories: s.pastLifeMemories || [],
        combatXP: s.combatXP || 0,
        explorationXP: s.explorationXP || 0,
        bond: s.bond,
      }));

    res.json({
      success: true,
      message: 'Essence applied — your spirits carry memories of past lives',
      updatedSpirits,
    });
  } catch (err) {
    console.error('[essence/confirm] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
