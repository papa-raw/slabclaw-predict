/**
 * essence.js — LEGACY (v1) API routes for SwarmEssence export/import/confirm.
 * DEPRECATED: Replaced by v2 persistence system (PRD §9) — rosterService,
 * graveyardService, deityJournalService. Routes kept for backward compat.
 *
 * POST /api/essence/export   — compute essence from game state + store on Walrus
 * POST /api/essence/import   — read essence from Walrus + return preview
 * POST /api/essence/confirm  — apply essence to game state (replace seed spirits)
 */

import { Router } from 'express';
import { computeEssence, applyEssence, buildReincarnationPreview } from '../services/essenceService.js';
import { storeEssence, readEssence, getMockBlobRaw, getAggregatorUrl } from '../services/walrusService.js';

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

/**
 * GET /api/essence/lineage?blobId=X
 * Recursively fetches the full reincarnation chain from Walrus.
 * Returns: { chain: [oldest → newest essence objects] }
 */
router.get('/lineage', async (req, res) => {
  try {
    const { blobId } = req.query;
    if (!blobId) return res.status(400).json({ error: 'blobId query param required' });

    const chain = [];
    const visited = new Set();
    let currentBlobId = blobId;

    while (currentBlobId && !visited.has(currentBlobId)) {
      visited.add(currentBlobId);
      try {
        const essence = await readEssence(currentBlobId);
        chain.push({ blobId: currentBlobId, ...essence });
        // Walk backwards through previousEssences
        const prev = essence.previousEssences;
        currentBlobId = Array.isArray(prev) && prev.length > 0 ? prev[prev.length - 1] : null;
      } catch {
        break; // Blob not found — end of chain
      }
      if (chain.length > 20) break; // Safety cap
    }

    res.json({ chain: chain.reverse() }); // oldest first
  } catch (err) {
    console.error('[essence/lineage] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/blob/:blobId — serve mock blobs for local dev (binary data as base64-decoded)
 */
router.get('/blob/:blobId', (req, res) => {
  const { blobId } = req.params;
  const raw = getMockBlobRaw(blobId);
  if (!raw) return res.status(404).json({ error: 'Blob not found' });

  // If it's base64 encoded binary (avatar images)
  if (typeof raw === 'string' && !raw.startsWith('{')) {
    const buffer = Buffer.from(raw, 'base64');
    res.set('Content-Type', 'image/webp');
    res.send(buffer);
  } else {
    // JSON essence data
    res.set('Content-Type', 'application/json');
    res.send(raw);
  }
});

export default router;
