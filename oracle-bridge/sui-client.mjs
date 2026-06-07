/// sui-client.mjs — Sui transaction builder for SlabClaw Predict.
/// Wraps @mysten/sui to build + execute Move calls.

import { getFullnodeUrl, SuiClient } from '@mysten/sui/client';
import { Transaction } from '@mysten/sui/transactions';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { CONFIG } from './config.mjs';
import { readFileSync, existsSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

// ── Client setup ──────────────────────────────────────────────────────

let _client = null;
let _keypair = null;

export function getClient() {
  if (!_client) {
    _client = new SuiClient({ url: CONFIG.rpcUrl });
  }
  return _client;
}

export function getKeypair() {
  if (!_keypair) {
    // Read from sui keystore (same as `sui client`)
    const keystorePath = join(homedir(), '.sui', 'sui_config', 'sui.keystore');
    if (!existsSync(keystorePath)) {
      throw new Error(`Sui keystore not found at ${keystorePath}. Run 'sui client' first.`);
    }
    const keystore = JSON.parse(readFileSync(keystorePath, 'utf8'));
    // Use the first key (active address)
    if (keystore.length === 0) {
      throw new Error('Sui keystore is empty. Generate a key with `sui client new-address ed25519`.');
    }
    // Keystore stores base64-encoded keys with a 1-byte scheme flag prefix.
    // Decode the base64, strip the flag byte, and create the keypair.
    const raw = Buffer.from(keystore[0], 'base64');
    // First byte is scheme flag (0x00 = Ed25519), rest is 32-byte secret key
    const secretKey = raw.slice(1);
    _keypair = Ed25519Keypair.fromSecretKey(secretKey);
  }
  return _keypair;
}

export function getAddress() {
  return getKeypair().toSuiAddress();
}

// ── Transaction execution ─────────────────────────────────────────────

export async function executeTransaction(tx) {
  const client = getClient();
  const keypair = getKeypair();

  const result = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: {
      showEffects: true,
      showObjectChanges: true,
      showEvents: true,
    },
  });

  if (result.effects?.status?.status !== 'success') {
    const error = result.effects?.status?.error || 'Unknown error';
    throw new Error(`Transaction failed: ${error}`);
  }

  return result;
}

// ── Registry operations ───────────────────────────────────────────────

export async function registerAsset({ assetId, setName, cardNumber, grader, gradeBps, platformCount }) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.packageId}::${CONFIG.modules.registry}::register_asset`,
    arguments: [
      tx.object(CONFIG.adminCapId),
      tx.object(CONFIG.registryId),
      tx.pure.vector('u8', Array.from(Buffer.from(assetId))),
      tx.pure.vector('u8', Array.from(Buffer.from(setName))),
      tx.pure.vector('u8', Array.from(Buffer.from(cardNumber))),
      tx.pure.vector('u8', Array.from(Buffer.from(grader))),
      tx.pure.u64(gradeBps),
      tx.pure.u64(platformCount),
    ],
  });

  return executeTransaction(tx);
}

// ── Oracle operations ─────────────────────────────────────────────────

export async function authorizeOracle(operatorAddress) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.packageId}::${CONFIG.modules.oracle}::authorize_oracle`,
    arguments: [
      tx.object(CONFIG.adminCapId),
      tx.pure.address(operatorAddress),
    ],
  });

  return executeTransaction(tx);
}

// ── Market operations ─────────────────────────────────────────────────

export async function createMarket({ assetId, strikeUsdCents, expiryMs, description }) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.packageId}::${CONFIG.modules.market}::create_market`,
    arguments: [
      tx.object(CONFIG.adminCapId),
      tx.object(CONFIG.registryId),
      tx.pure.vector('u8', Array.from(Buffer.from(assetId))),
      tx.pure.u64(strikeUsdCents),
      tx.pure.u64(expiryMs),
      tx.pure.vector('u8', Array.from(Buffer.from(description))),
      tx.object(CONFIG.clockId),
    ],
  });

  return executeTransaction(tx);
}

export async function proposeResolution({ oracleCapId, marketId, priceUsdCents, sourcesCount }) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.packageId}::${CONFIG.modules.market}::propose_resolution`,
    arguments: [
      tx.object(oracleCapId),
      tx.object(marketId),
      tx.object(CONFIG.registryId),
      tx.pure.u64(priceUsdCents),
      tx.pure.u64(sourcesCount),
      tx.object(CONFIG.clockId),
    ],
  });

  return executeTransaction(tx);
}

export async function finalizeMarket(marketId) {
  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.packageId}::${CONFIG.modules.market}::finalize`,
    arguments: [
      tx.object(marketId),
      tx.object(CONFIG.clockId),
    ],
  });

  return executeTransaction(tx);
}

// ── SlabClaw Oracle API ───────────────────────────────────────────────

export async function fetchOraclePrice(productId, grader, grade) {
  const url = `${CONFIG.slabclawApi}/api/v3/deals?oracle=true&limit=1`;
  // For the bridge, we query the current_oracle directly via a dedicated endpoint
  // Fallback: use the deals endpoint and filter
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`SlabClaw API error: ${resp.status}`);
    const data = await resp.json();
    return data;
  } catch (err) {
    console.error(`Failed to fetch oracle price: ${err.message}`);
    return null;
  }
}
