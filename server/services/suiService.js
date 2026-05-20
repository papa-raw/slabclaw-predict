/**
 * suiService.js — Sui transaction builders for Anima Swarm Move contracts.
 *
 * Mock mode (default, when PACKAGE_ID is not set):
 *   - All functions return mock object IDs and log to console
 *   - No actual transactions submitted
 *
 * Real mode (when PACKAGE_ID is set):
 *   - Builds Transaction objects for deployed Move contract entry functions
 *   - Requires SUI_PRIVATE_KEY for signing
 */

const PACKAGE_ID = process.env.PACKAGE_ID;
const SUI_PRIVATE_KEY = process.env.SUI_PRIVATE_KEY;
const SUI_RPC_URL = process.env.SUI_RPC_URL || 'https://fullnode.testnet.sui.io';

/**
 * Mint a Spirit NFT onchain.
 * @param {string} name
 * @param {string} personalityHash - hex string
 * @param {number} generation
 * @param {string|null} parentId - object ID of parent spirit, or null
 * @returns {Promise<string|null>} objectId or null
 */
export async function mintSpirit(name, personalityHash, generation, parentId = null) {
  if (!PACKAGE_ID) {
    const mockId = `0x${_mockObjectId('spirit', name)}`;
    console.log(`[sui:mock] mintSpirit name=${name} gen=${generation} → ${mockId}`);
    return mockId;
  }
  return _mintSpiritReal(name, personalityHash, generation, parentId);
}

/**
 * Record a battle onchain.
 * @param {string} attackerId - object ID
 * @param {string} defenderId - object ID
 * @param {string} winnerId - object ID
 * @param {number} margin - battle margin score
 * @param {string} terrain - terrain type
 * @returns {Promise<string|null>} objectId of BattleRecord or null
 */
export async function recordBattle(attackerId, defenderId, winnerId, margin, terrain) {
  if (!PACKAGE_ID) {
    const mockId = `0x${_mockObjectId('battle', `${attackerId}-${winnerId}`)}`;
    console.log(`[sui:mock] recordBattle attacker=${attackerId} winner=${winnerId} terrain=${terrain} → ${mockId}`);
    return mockId;
  }
  return _recordBattleReal(attackerId, defenderId, winnerId, margin, terrain);
}

/**
 * Claim a territory hex onchain.
 * @param {string} hexId
 * @param {string} controllerId - spirit or player address
 * @returns {Promise<void>}
 */
export async function claimTerritory(hexId, controllerId) {
  if (!PACKAGE_ID) {
    console.log(`[sui:mock] claimTerritory hexId=${hexId} controller=${controllerId}`);
    return;
  }
  return _claimTerritoryReal(hexId, controllerId);
}

/**
 * Collect spawn fee onchain.
 * @param {string} recipientAddress - SUI address
 * @returns {Promise<void>}
 */
export async function collectSpawnFee(recipientAddress) {
  if (!PACKAGE_ID) {
    console.log(`[sui:mock] collectSpawnFee recipient=${recipientAddress}`);
    return;
  }
  return _collectSpawnFeeReal(recipientAddress);
}

// ── Mock helpers ──────────────────────────────────────────────────────────────

function _mockObjectId(prefix, seed) {
  // Deterministic-looking 64-char hex from seed
  let hash = 0;
  const str = `${prefix}-${seed}-${Date.now()}`;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  const base = Math.abs(hash).toString(16).padStart(8, '0');
  return base.repeat(8).slice(0, 64);
}

// ── Real Sui implementation ───────────────────────────────────────────────────

async function _getSuiClient() {
  const { SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc');
  return new SuiJsonRpcClient({ url: SUI_RPC_URL });
}

async function _getKeypair() {
  const { Ed25519Keypair } = await import('@mysten/sui/keypairs/ed25519');
  return Ed25519Keypair.fromSecretKey(SUI_PRIVATE_KEY);
}

async function _executeTransaction(tx) {
  try {
    const { SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc');
    const client = new SuiJsonRpcClient({ url: SUI_RPC_URL });
    const keypair = await _getKeypair();

    const result = await client.signAndExecuteTransaction({
      transaction: tx,
      signer: keypair,
      options: { showEffects: true, showObjectChanges: true },
    });

    // Extract created object ID from effects
    const created = result.objectChanges?.find(c => c.type === 'created');
    return created?.objectId || result.digest || null;
  } catch (err) {
    console.error('[sui:real] Transaction failed:', err.message);
    return null;
  }
}

async function _mintSpiritReal(name, personalityHash, generation, parentId) {
  try {
    const { Transaction } = await import('@mysten/sui/transactions');
    const ADMIN_CAP_ID = process.env.ADMIN_CAP_ID;
    if (!ADMIN_CAP_ID) {
      console.warn('[sui:real] ADMIN_CAP_ID not set — cannot mint spirit');
      return null;
    }

    const tx = new Transaction();
    const nameBytes = Array.from(Buffer.from(name, 'utf-8'));
    const hashBytes = Array.from(Buffer.from(personalityHash || '', 'utf-8'));

    if (parentId) {
      tx.moveCall({
        target: `${PACKAGE_ID}::spirit::mint`,
        arguments: [
          tx.object(ADMIN_CAP_ID),
          tx.pure.vector('u8', nameBytes),
          tx.pure.vector('u8', hashBytes),
          tx.pure.u64(generation),
          tx.pure.option('address', parentId),
        ],
      });
    } else {
      tx.moveCall({
        target: `${PACKAGE_ID}::spirit::mint`,
        arguments: [
          tx.object(ADMIN_CAP_ID),
          tx.pure.vector('u8', nameBytes),
          tx.pure.vector('u8', hashBytes),
          tx.pure.u64(generation),
          tx.pure.option('address', null),
        ],
      });
    }

    return await _executeTransaction(tx);
  } catch (err) {
    console.error('[sui:real] mintSpirit failed:', err.message);
    return null;
  }
}

async function _recordBattleReal(attackerId, defenderId, winnerId, margin, terrain) {
  try {
    const { Transaction } = await import('@mysten/sui/transactions');
    const { SuiJsonRpcClient } = await import('@mysten/sui/jsonRpc');
    const ADMIN_CAP_ID = process.env.ADMIN_CAP_ID;
    if (!ADMIN_CAP_ID) return null;

    const suiClient = new SuiJsonRpcClient({ url: SUI_RPC_URL });
    const clockObj = '0x6'; // Sui system clock object

    const tx = new Transaction();
    const terrainBytes = Array.from(Buffer.from(terrain || 'plains', 'utf-8'));

    tx.moveCall({
      target: `${PACKAGE_ID}::battle::record`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.pure.id(attackerId),
        tx.pure.id(defenderId),
        tx.pure.id(winnerId),
        tx.pure.u64(Math.round(margin * 100)),
        tx.pure.vector('u8', terrainBytes),
        tx.object(clockObj),
      ],
    });

    return await _executeTransaction(tx);
  } catch (err) {
    console.error('[sui:real] recordBattle failed:', err.message);
    return null;
  }
}

async function _claimTerritoryReal(hexId, controllerId) {
  try {
    const { Transaction } = await import('@mysten/sui/transactions');
    const ADMIN_CAP_ID = process.env.ADMIN_CAP_ID;
    const GAME_MAP_ID = process.env.GAME_MAP_ID;
    if (!ADMIN_CAP_ID || !GAME_MAP_ID) return;

    const tx = new Transaction();
    const hexBytes = Array.from(Buffer.from(hexId, 'utf-8'));

    tx.moveCall({
      target: `${PACKAGE_ID}::territory::claim_hex`,
      arguments: [
        tx.object(ADMIN_CAP_ID),
        tx.object(GAME_MAP_ID),
        tx.pure.vector('u8', hexBytes),
        tx.pure.address(controllerId),
      ],
    });

    await _executeTransaction(tx);
  } catch (err) {
    console.error('[sui:real] claimTerritory failed:', err.message);
  }
}

async function _collectSpawnFeeReal(recipientAddress) {
  try {
    const { Transaction } = await import('@mysten/sui/transactions');
    const SPAWN_FEE = 10_000_000; // 0.01 SUI in MIST

    const tx = new Transaction();
    const [coin] = tx.splitCoins(tx.gas, [tx.pure.u64(SPAWN_FEE)]);

    tx.moveCall({
      target: `${PACKAGE_ID}::spawn::collect_fee`,
      arguments: [
        coin,
        tx.pure.address(recipientAddress),
      ],
    });

    await _executeTransaction(tx);
  } catch (err) {
    console.error('[sui:real] collectSpawnFee failed:', err.message);
  }
}
