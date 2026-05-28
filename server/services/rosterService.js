import { computeEssence } from './essenceService.js';
import { storeEssence } from './walrusService.js';
import { recallMemoriesServer } from './memwalServer.js';
import { getCachedAvatarBlobId } from './avatarService.js';
import { mintSpirit } from './suiService.js';
import crypto from 'crypto';

const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io';
const PACKAGE_ID = process.env.PACKAGE_ID;

const rosterCache = new Map();

// ── Sui RPC helper ───────────────────────────────────────────────────────────

// NOTE: This local queryOwnedSpirits is used by loadRoster (which needs raw objects
// for parseOnchainSpirit). suiService.js has its own version used by queryOwnedSpirits
// exported from suiService — these serve different purposes and are not duplicates.
async function queryOwnedSpirits(walletAddress) {
  const res = await fetch(SUI_RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'suix_getOwnedObjects',
      params: [
        walletAddress,
        {
          filter: { StructType: `${PACKAGE_ID}::spirit::Spirit` },
          options: { showContent: true, showType: true },
        },
        null,
        50,
      ],
    }),
  });

  const json = await res.json();
  if (json.error) throw new Error(`Sui RPC error: ${json.error.message}`);
  return json.result?.data || [];
}

// Helper: decode a Sui vector<u8> field from base64 to UTF-8 string.
// Sui BCS encodes vector<u8> fields as base64 in JSON responses.
function _decodeVecU8(value, fallback = '') {
  if (!value) return fallback;
  try {
    return Buffer.from(value, 'base64').toString('utf-8');
  } catch {
    return String(value);
  }
}

function parseOnchainSpirit(obj) {
  const objectId = obj.data?.objectId;
  const fields = obj.data?.content?.fields;
  if (!fields) return null;

  return {
    objectId,
    // fields.name is vector<u8> returned as base64 — must decode, not use as plain string
    name: _decodeVecU8(fields.name, 'Unknown'),
    personalityHash: fields.personality_hash || '',
    generation: parseInt(fields.generation || '0', 10),
    createdAt: parseInt(fields.created_at || '0', 10),
    owner: fields.owner || '',
    parentId: fields.parent_id || null,
    specialization: _decodeVecU8(fields.specialization, 'warrior'),
    memwalAccountId: _decodeVecU8(fields.memwal_account_id, ''),
    essenceBlobId: _decodeVecU8(fields.essence_blob_id, ''),
    avatarBlobId: _decodeVecU8(fields.avatar_blob_id, '') || null,
    status: parseInt(fields.status || '0', 10),
    gamesPlayed: parseInt(fields.games_played || '0', 10),
    totalKills: parseInt(fields.total_kills || '0', 10),
    totalHexesClaimed: parseInt(fields.total_hexes_claimed || '0', 10),
    bondDepth: parseInt(fields.bond_depth || '40', 10),
    bondLoyalty: parseInt(fields.bond_loyalty || '30', 10),
    reincarnationCount: parseInt(fields.reincarnation_count || '0', 10),
  };
}

// ── loadRoster ───────────────────────────────────────────────────────────────

export async function loadRoster(walletAddress) {
  if (!PACKAGE_ID) {
    console.log('[roster] No PACKAGE_ID — returning empty roster (mock mode)');
    return [];
  }

  try {
    console.log(`[roster] Loading roster for ${walletAddress}`);
    const rawObjects = await queryOwnedSpirits(walletAddress);
    const spirits = rawObjects.map(parseOnchainSpirit).filter(Boolean);

    // Cache for later use in initializeFromRoster
    for (const s of spirits) {
      rosterCache.set(s.objectId, s);
    }

    console.log(`[roster] Found ${spirits.length} spirit(s) for ${walletAddress}`);
    return spirits;
  } catch (err) {
    console.error('[roster] Failed to load roster:', err.message);
    return [];
  }
}

// ── initializeFromRoster ─────────────────────────────────────────────────────

export async function initializeFromRoster(selectedSpiritIds, playerId, gameState) {
  if (!selectedSpiritIds?.length) return;

  const playerSpirits = Object.values(gameState.spirits)
    .filter(s => s.playerId === playerId)
    .sort((a, b) => a.id.localeCompare(b.id));

  if (!playerSpirits.length) {
    console.warn('[roster] No default spirits found for player', playerId);
    return;
  }

  console.log(`[roster] Initializing ${selectedSpiritIds.length} roster spirit(s) for ${playerId}`);

  for (let i = 0; i < Math.min(selectedSpiritIds.length, 3); i++) {
    const nftId = selectedSpiritIds[i];
    const nft = rosterCache.get(nftId);
    if (!nft) {
      console.warn(`[roster] Spirit ${nftId} not in cache — skipping`);
      continue;
    }

    const slot = playerSpirits[i];
    if (!slot) continue;

    const hexId = slot.hexId;
    const oldId = slot.id;

    // Load past-life memories from MemWal
    let pastLifeMemories = [];
    try {
      const namespace = `swarm-${playerId}`;
      const recall = await recallMemoriesServer(namespace, `${nft.name} spirit memories battles`, 5);
      pastLifeMemories = (recall.results || []).map(r => r.text).filter(Boolean);
    } catch (err) {
      console.warn(`[roster] MemWal recall failed for ${nft.name}:`, err.message);
    }

    // XP carryover: estimate lifetime XP from games played + kills + hexes
    const estimatedCombatXP = nft.totalKills * 25 + nft.gamesPlayed * 10;
    const estimatedExplorationXP = nft.totalHexesClaimed * 15 + nft.gamesPlayed * 10;

    const rosterSpirit = {
      id: oldId,
      name: nft.name,
      personality: `A reborn ${nft.specialization} spirit with ${nft.gamesPlayed} games of experience.`,
      specialization: nft.specialization,
      generation: nft.generation,
      parentId: nft.parentId || null,
      hexId,
      playerId,
      bond: {
        depth: Math.min(100, 40 + Math.floor(nft.bondDepth * 0.3)),
        harmony: Math.min(100, 40 + Math.floor(nft.bondDepth * 0.25)),
        adventure: Math.min(100, 30 + Math.floor(nft.bondLoyalty * 0.2)),
        loyalty: Math.min(100, 30 + Math.floor(nft.bondLoyalty * 0.3)),
      },
      alive: true,
      hp: 100,
      maxHp: 100,
      memwalNamespace: `swarm-${playerId}`,
      memwalAccountId: process.env.MEMWAL_ACCOUNT_ID || '',
      spawnCount: 0,
      memoryCount: 3,
      combatXP: Math.floor(estimatedCombatXP * 0.4),
      explorationXP: Math.floor(estimatedExplorationXP * 0.4),
      socialXP: 0,
      wisdomXP: 0,
      personalityProfile: nft.specialization === 'warrior' ? 'aggressive' : nft.specialization === 'scout' ? 'explorer' : 'cautious',
      currentAction: null,
      kills: 0,
      hexesClaimed: 0,
      whispersReceived: 0,
      whispersOriginated: 0,
      reincarnationCount: nft.reincarnationCount,
      enemyResistance: 50,
      previousNames: [],
      pastLifeMemories,
      memorableActions: [],
      lastSpawnAt: 0,
      _lastDecision: i * 5000,
      avatarBlobId: nft.avatarBlobId || getCachedAvatarBlobId(nft.name) || null,
      _fromRoster: true,
      _nftObjectId: nftId,
    };

    // Replace in gameState, preserving hex references
    const hex = gameState.map?.hexes?.[hexId];
    if (hex) {
      const idx = hex.spiritIds?.indexOf(oldId);
      if (idx >= 0) hex.spiritIds[idx] = rosterSpirit.id;
    }

    delete gameState.spirits[oldId];
    gameState.spirits[rosterSpirit.id] = rosterSpirit;

    console.log(`[roster] Slotted ${nft.name} (${nftId.slice(0, 10)}...) into ${rosterSpirit.id}`);
  }

  // Remaining slots keep their generated spirits (partial selection)
  const remaining = playerSpirits.length - Math.min(selectedSpiritIds.length, 3);
  if (remaining > 0) {
    console.log(`[roster] ${remaining} slot(s) kept as generated spirits`);
  }
}

// ── persistPostGame ──────────────────────────────────────────────────────────

export async function persistPostGame(gameState, playerId) {
  const playerSpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId);
  if (!playerSpirits.length) {
    console.log('[roster] No spirits to persist for', playerId);
    return { minted: [], updated: [], essenceBlobIds: [] };
  }

  const minted = [];
  const updated = [];
  const essenceBlobIds = [];

  for (const spirit of playerSpirits) {
    // Compute and store essence for every spirit
    let essenceBlobId = null;
    try {
      const essence = computeEssence(gameState, playerId);
      essenceBlobId = await storeEssence(essence);
      essenceBlobIds.push(essenceBlobId);
      console.log(`[roster] Stored essence for ${spirit.name} → ${essenceBlobId}`);
    } catch (err) {
      console.error(`[roster] Essence storage failed for ${spirit.name}:`, err.message);
    }

    if (spirit._nftObjectId) {
      // Returning spirit — log update needed
      updated.push({
        objectId: spirit._nftObjectId,
        name: spirit.name,
        alive: spirit.alive,
        gamesPlayed: 1,
        kills: spirit.kills || 0,
        hexesClaimed: spirit.hexesClaimed || 0,
        essenceBlobId,
        status: spirit.alive ? 0 : 1,
      });
      console.log(`[roster] Update queued: ${spirit.name} (${spirit._nftObjectId.slice(0, 10)}...) alive=${spirit.alive}`);
    } else {
      // New spirit — needs minting
      const personalityHash = crypto.createHash('sha256')
        .update(spirit.personality || spirit.name)
        .digest('hex')
        .slice(0, 32);

      let objectId = null;
      try {
        objectId = await mintSpirit(
          spirit.name,
          personalityHash,
          spirit.generation || 0,
          spirit.parentId || null,
          spirit.specialization || 'warrior',
          spirit.memwalAccountId || process.env.MEMWAL_ACCOUNT_ID || '',
          spirit.avatarBlobId || '',
          null, // recipient: defaults to server keypair address inside mintSpirit
        );
      } catch (err) {
        console.error(`[roster] Mint failed for ${spirit.name}:`, err.message);
      }

      // Persist the NFT object ID on the spirit so subsequent calls treat it as returning
      if (objectId) {
        spirit._nftObjectId = objectId;
      }

      minted.push({
        objectId,
        name: spirit.name,
        alive: spirit.alive,
        essenceBlobId,
      });
      console.log(`[roster] Minted: ${spirit.name} → ${objectId || 'FAILED'}`);
    }
  }

  console.log(`[roster] Post-game summary for ${playerId}: ${minted.length} minted, ${updated.length} updated, ${essenceBlobIds.length} essences`);
  return { minted, updated, essenceBlobIds };
}
