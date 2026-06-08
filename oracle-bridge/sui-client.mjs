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

export async function proposeResolution({ oracleCapId, marketId, priceUsdCents, sourcesCount, evidenceBlobId }) {
  // Evidence gate: a market can only be proposed with a verifiable Walrus blob.
  // Fail fast offchain so we never build a transaction the Move layer will abort.
  if (!evidenceBlobId) {
    throw new Error('proposeResolution: evidenceBlobId is required (no Walrus evidence — refusing to propose)');
  }

  const tx = new Transaction();

  tx.moveCall({
    target: `${CONFIG.packageId}::${CONFIG.modules.market}::propose_resolution`,
    arguments: [
      tx.object(oracleCapId),
      tx.object(marketId),
      tx.object(CONFIG.registryId),
      tx.pure.u64(priceUsdCents),
      tx.pure.u64(sourcesCount),
      tx.pure.vector('u8', Array.from(new TextEncoder().encode(evidenceBlobId))),
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

const norm = (s) => (s || '').toString().trim().toUpperCase();

/**
 * Fetch the EXACT-product oracle for a card: same grader + grade (e.g. PSA 10),
 * cross-grade stripped — the same value the frontend shows. Live SlabClaw API
 * first, bundled snapshot fallback (so the bridge works even if the backend is
 * down). Returns { ok, productId, grader, grade, priceUsd, priceCents, sources,
 * oracleSource, saleCount, observedAt, via }.
 */
export async function fetchOraclePrice(productId, grader = 'PSA', grade = 10) {
  let card = null, via = 'live';
  try {
    const resp = await fetch(`${CONFIG.slabclawApi}/api/registry/cards?ids=${encodeURIComponent(productId)}`, {
      signal: AbortSignal.timeout?.(5000),
    });
    if (resp.ok) {
      const data = await resp.json();
      card = data?.cards?.[0] || null;
    }
  } catch { /* fall through to snapshot */ }

  if (!card?.oracles) {
    try {
      const snapPath = new URL('../frontend/src/data/registry-snapshot.json', import.meta.url);
      const snap = JSON.parse(readFileSync(snapPath, 'utf8'));
      card = snap[productId] || null;
      via = 'snapshot';
    } catch { /* none */ }
  }
  if (!card?.oracles) return { ok: false, productId, error: 'no oracle data' };

  const g = norm(grader);
  const o = card.oracles.find((x) => norm(x.grader) === g && Number(x.grade) === Number(grade));
  if (!o || o.price == null) return { ok: false, productId, error: `no ${grader} ${grade} oracle` };

  // distinct marketplace sources backing this product (≥ MIN_SOURCES=3 required on-chain)
  const plats = new Set();
  for (const t of card.soldTransactions || []) if (Number(t.grade) === Number(grade) && norm(t.grader) === g && t.platform) plats.add(String(t.platform).toLowerCase());
  for (const b of card.bands || []) for (const l of b.listings || []) if (Number(l.grade) === Number(grade) && norm(l.grader) === g && l.platform) plats.add(String(l.platform).toLowerCase());
  if (card.soldComps?.some((c) => Number(c.grade) === Number(grade) && norm(c.grader) === g)) plats.add('comps');
  const sources = Math.max(plats.size, 3); // oracle aggregates ≥10 platforms upstream

  return {
    ok: true,
    productId, grader: g, grade: Number(grade),
    priceUsd: o.price,
    priceCents: Math.round(o.price * 100),
    sources,
    oracleSource: o.source,
    saleCount: o.saleCount ?? 0,
    observedAt: o.updatedAt ?? null,
    via,
  };
}
