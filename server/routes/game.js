import { Router } from 'express';
import { sanitizeForClient, broadcastStateChange } from '../services/wsService.js';
import { chatWithSpirit, chatWithEnemySpirit } from '../services/spiritDialogueService.js';
import { applyBondAction } from '../services/bondService.js';
import { applyDeityIntent, issueRallyCommand } from '../services/spiritDecisionService.js';
import { readEssence, getStorageMode } from '../services/walrusService.js';
import { recallMemoriesServer } from '../services/memwalServer.js';
import { getKey } from '../services/keyStore.js';
import { applyEssence } from '../services/essenceService.js';
import { generateAvatarBackground } from '../services/avatarService.js';
import { pauseGame, resumeGame } from '../services/tickEngine.js';
import { broadcastSwarmWhisper, broadcastEnemyWhisper } from '../services/whisperService.js';
import { loadRoster, initializeFromRoster, persistPostGame } from '../services/rosterService.js';
import { loadDeityJournal, updateDeityJournal, computeReputationModifiers } from '../services/deityJournalService.js';
import { loadGraveyard, addToGraveyard, attemptRecruitment } from '../services/graveyardService.js';
import { queryOwnedSpirits, updateSpiritPostGame, markSpiritGhost } from '../services/suiService.js';

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
  const { playerId, importedEssence, blobId, selectedSpiritIds } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });
  if (!player.walletAddress) return res.status(400).json({ error: 'Connect wallet first' });

  player.connected = true;
  player.lastSeen = Date.now();

  // v2: Initialize from Spirit NFT roster
  if (selectedSpiritIds?.length > 0) {
    try {
      await initializeFromRoster(selectedSpiritIds, playerId, state);
      console.log(`[game/ready] Initialized ${selectedSpiritIds.length} spirits from roster for ${playerId}`);
    } catch (err) {
      console.warn('[game/ready] Roster init failed, using defaults:', err.message);
    }
  } else if (blobId) {
    // Legacy v1: Apply imported essence by blob ID
    try {
      const essence = await readEssence(blobId);
      essence.blobId = blobId;
      applyEssence(state, essence, playerId);
      console.log(`[game/ready] Applied essence blob ${blobId} for player ${playerId}`);
    } catch (err) {
      console.warn(`[game/ready] Could not apply essence blob ${blobId}:`, err.message);
    }
  } else if (importedEssence) {
    try {
      applyEssence(state, importedEssence, playerId);
    } catch (err) {
      console.warn('[game/ready] Could not apply importedEssence:', err.message);
    }
  }

  // Apply deity reputation modifiers to fresh (non-roster) spirits
  if (player.walletAddress) {
    try {
      const journal = await loadDeityJournal(player.walletAddress);
      if (journal) {
        const mods = computeReputationModifiers(journal);
        for (const spirit of Object.values(state.spirits)) {
          if (spirit.playerId === playerId && !spirit._fromRoster) {
            spirit.bond.depth = Math.min(100, Math.max(0, spirit.bond.depth + mods.depth));
            spirit.bond.harmony = Math.min(100, Math.max(0, spirit.bond.harmony + mods.harmony));
            spirit.bond.adventure = Math.min(100, Math.max(0, spirit.bond.adventure + mods.adventure));
            spirit.bond.loyalty = Math.min(100, Math.max(0, spirit.bond.loyalty + mods.loyalty));
          }
        }
        state._deityJournal = journal;
        console.log(`[game/ready] Applied deity reputation mods for ${player.walletAddress.slice(0, 10)}...`);
      }
    } catch (err) {
      console.warn('[game/ready] Deity journal load failed:', err.message);
    }
  }

  const connectedCount = Object.values(state.players).filter(p => p.connected).length;
  if (connectedCount >= 1 && state.status === 'lobby') {
    state.status = 'active';
    state.startedAt = Date.now();
    for (const spirit of Object.values(state.spirits)) {
      if (!spirit.avatarBlobId) {
        generateAvatarBackground(spirit, state);
      }
    }
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

// POST /api/game/whisper — swarm decree or enemy whisper (2 per 30s cycle)
router.post('/whisper', async (req, res) => {
  const { playerId, type, message, targetPlayerId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  if (!playerId || !type || !message?.trim()) return res.status(400).json({ error: 'Missing fields' });
  if (type !== 'swarm' && type !== 'enemy') return res.status(400).json({ error: 'type must be swarm or enemy' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });

  if (!player.whisperCharges) player.whisperCharges = { swarm: 0, enemy: 0 };
  if (player.whisperCharges[type] <= 0) {
    const resetIn = 30 - Math.floor((Date.now() - (player.lastWhisperReset || 0)) / 1000);
    return res.status(429).json({ error: 'No charges left', resetIn: Math.max(0, resetIn) });
  }

  player.whisperCharges[type] -= 1;

  try {
    if (type === 'swarm') {
      console.log(`[whisper:swarm] ${player.name}: "${message.slice(0, 60)}"`);
      const result = await broadcastSwarmWhisper({ playerId, message: message.trim(), gameState: state });
      broadcastStateChange(state);
      res.json({ type: 'swarm', spirits: result.spirits, charges: player.whisperCharges });
    } else {
      if (!targetPlayerId || !state.players[targetPlayerId]) {
        player.whisperCharges[type] += 1;
        return res.status(400).json({ error: 'Invalid targetPlayerId' });
      }
      console.log(`[whisper:enemy] ${player.name} → ${state.players[targetPlayerId].name}: "${message.slice(0, 60)}"`);
      const result = await broadcastEnemyWhisper({
        playerId, targetPlayerId, message: message.trim(), gameState: state,
      });
      broadcastStateChange(state);
      res.json({ type: 'enemy', spirits: result.spirits, charges: player.whisperCharges });
    }
  } catch (err) {
    console.error('[whisper] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/game/spirit/:id/memories — recall a spirit's stored memories
router.get('/spirit/:id/memories', async (req, res) => {
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const spirit = state.spirits[req.params.id];
  if (!spirit) return res.status(404).json({ error: 'Spirit not found' });

  try {
    const key = getKey(spirit.id);
    const result = await recallMemoriesServer(
      spirit.memwalNamespace, 'all memories', 50, key, spirit.memwalAccountId
    );
    res.json({
      spiritId: spirit.id,
      name: spirit.name,
      memories: result.results || [],
      count: spirit.memoryCount || 0,
    });
  } catch (err) {
    console.error('[memories] Error:', err.message);
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

// ── v2 Persistence Routes ────────────────────────────────────────────────────

// GET /api/roster/:walletAddress — load Spirit NFTs from wallet
router.get('/roster/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  if (!walletAddress) return res.status(400).json({ error: 'Missing walletAddress' });

  try {
    const spirits = await queryOwnedSpirits(walletAddress);
    res.json({ walletAddress, spirits, count: spirits.length });
  } catch (err) {
    console.error('[roster] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/game/end-persist — persist all game results (spirits, journal, graveyard)
router.post('/end-persist', async (req, res) => {
  const { playerId } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });

  const player = state.players[playerId];
  if (!player) return res.status(404).json({ error: 'Player not found' });

  const results = { roster: null, journal: null, graveyard: null, onchain: [] };

  try {
    // 1. Persist roster (mint new spirits, store essence for all)
    results.roster = await persistPostGame(state, playerId);

    // 2. Update onchain spirit stats for returning NFTs
    for (const updated of (results.roster?.updated || [])) {
      try {
        await updateSpiritPostGame(
          updated.objectId,
          updated.essenceBlobId || '',
          updated.status,
          updated.kills,
          updated.hexesClaimed,
          0, 0, // bondDepth/bondLoyalty — computed from game state
          updated.gamesPlayed,
        );
        if (!updated.alive) {
          await markSpiritGhost(updated.objectId);
        }
        results.onchain.push({ objectId: updated.objectId, status: 'ok' });
      } catch (err) {
        console.warn(`[end-persist] Onchain update failed for ${updated.objectId}:`, err.message);
        results.onchain.push({ objectId: updated.objectId, status: 'failed', error: err.message });
      }
    }

    // 3. Update deity journal
    if (player.walletAddress) {
      try {
        results.journal = await updateDeityJournal(player.walletAddress, state, playerId);
      } catch (err) {
        console.warn('[end-persist] Deity journal update failed:', err.message);
      }
    }

    // 4. Add dead spirits to graveyard
    const deadSpirits = Object.values(state.spirits).filter(
      s => s.playerId === playerId && !s.alive && !s._isGhost
    );
    if (deadSpirits.length > 0) {
      try {
        await addToGraveyard(deadSpirits, state);
        results.graveyard = { added: deadSpirits.length };
      } catch (err) {
        console.warn('[end-persist] Graveyard update failed:', err.message);
      }
    }

    console.log(`[end-persist] Complete for ${playerId}: ${results.roster?.minted?.length || 0} minted, ${results.roster?.updated?.length || 0} updated, ${deadSpirits.length} ghosted`);
    res.json(results);
  } catch (err) {
    console.error('[end-persist] Error:', err.message);
    res.status(500).json({ error: err.message, partial: results });
  }
});

// POST /api/ghost/recruit — attempt to recruit a ghost spirit
router.post('/ghost/recruit', async (req, res) => {
  const { ghostSpiritId, playerId, message } = req.body;
  const state = getGameState();
  if (!state) return res.status(404).json({ error: 'No active game' });
  if (!ghostSpiritId || !playerId || !message?.trim()) {
    return res.status(400).json({ error: 'Missing ghostSpiritId, playerId, or message' });
  }

  try {
    const result = await attemptRecruitment(ghostSpiritId, playerId, message.trim(), state);
    if (result.success) {
      broadcastStateChange(state);
    }
    res.json(result);
  } catch (err) {
    console.error('[ghost/recruit] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/deity-journal/:walletAddress — load deity journal
router.get('/deity-journal/:walletAddress', async (req, res) => {
  const { walletAddress } = req.params;
  if (!walletAddress) return res.status(400).json({ error: 'Missing walletAddress' });

  try {
    const journal = await loadDeityJournal(walletAddress);
    if (!journal) return res.json({ walletAddress, journal: null, exists: false });
    res.json({ walletAddress, journal, exists: true });
  } catch (err) {
    console.error('[deity-journal] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// GET /api/graveyard — list all ghosts
router.get('/graveyard', (req, res) => {
  try {
    const graveyard = loadGraveyard();
    res.json(graveyard);
  } catch (err) {
    console.error('[graveyard] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

export default router;
