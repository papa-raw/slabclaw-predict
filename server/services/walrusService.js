/**
 * walrusService.js — Walrus blob storage wrapper.
 *
 * Mock mode (default):
 *   - Stores blobs in _data/blobs.json (persisted across server restarts)
 *   - Generates mock blob IDs prefixed "mock-blob-"
 *
 * Testnet mode (WALRUS_NETWORK=testnet):
 *   - Uses Walrus HTTP API (publisher/aggregator) — no SUI keypair needed
 *   - Publisher handles the Sui transaction and WAL payment
 *   - Falls back to mock on network errors
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BLOBS_FILE = join(__dirname, '../../_data/blobs.json');

const WALRUS_PUBLISHER = process.env.WALRUS_PUBLISHER || 'https://publisher.walrus-testnet.walrus.space';
const WALRUS_AGGREGATOR = process.env.WALRUS_AGGREGATOR || 'https://aggregator.walrus-testnet.walrus.space';
const WALRUS_EPOCHS = parseInt(process.env.WALRUS_EPOCHS || '5', 10);

const isTestnet = process.env.WALRUS_NETWORK === 'testnet';

const mockBlobStore = new Map();

function _loadPersistedBlobs() {
  try {
    const raw = readFileSync(BLOBS_FILE, 'utf-8');
    const obj = JSON.parse(raw);
    for (const [k, v] of Object.entries(obj)) {
      mockBlobStore.set(k, v);
    }
    console.log(`[walrus:mock] Loaded ${mockBlobStore.size} blob(s) from ${BLOBS_FILE}`);
  } catch {
    // File doesn't exist yet
  }
}

function _persistBlobs() {
  try {
    mkdirSync(dirname(BLOBS_FILE), { recursive: true });
    const obj = Object.fromEntries(mockBlobStore);
    writeFileSync(BLOBS_FILE, JSON.stringify(obj, null, 2), 'utf-8');
  } catch (err) {
    console.warn('[walrus:mock] Failed to persist blobs:', err.message);
  }
}

_loadPersistedBlobs();

if (isTestnet) {
  console.log(`[walrus] Testnet mode — publisher: ${WALRUS_PUBLISHER}, aggregator: ${WALRUS_AGGREGATOR}`);
}

/**
 * Store an essence JSON object on Walrus (or mock store).
 * @param {object} essenceJson
 * @returns {Promise<string>} blobId
 */
export async function storeEssence(essenceJson) {
  if (isTestnet) {
    return await _storeEssenceTestnet(essenceJson);
  }
  return _storeEssenceMock(essenceJson);
}

/**
 * Read an essence JSON object from Walrus (or mock store) by blob ID.
 * @param {string} blobId
 * @returns {Promise<object>} SwarmEssence
 */
export async function readEssence(blobId) {
  if (blobId.startsWith('mock-blob-')) {
    return _readEssenceMock(blobId);
  }
  if (isTestnet) {
    return await _readEssenceTestnet(blobId);
  }
  return _readEssenceMock(blobId);
}

// ── Mock implementation ───────────────────────────────────────────────────────

function _storeEssenceMock(essenceJson) {
  const blobId = `mock-blob-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const serialized = JSON.stringify(essenceJson);
  mockBlobStore.set(blobId, serialized);
  _persistBlobs();
  console.log(`[walrus:mock] Stored blob ${blobId} (${serialized.length} bytes)`);
  return blobId;
}

function _readEssenceMock(blobId) {
  const data = mockBlobStore.get(blobId);
  if (!data) {
    throw new Error(`Blob not found: ${blobId}`);
  }
  console.log(`[walrus:mock] Read blob ${blobId}`);
  return JSON.parse(data);
}

// ── Walrus Testnet HTTP API ──────────────────────────────────────────────────

async function _storeEssenceTestnet(essenceJson) {
  const body = JSON.stringify(essenceJson);
  const url = `${WALRUS_PUBLISHER}/v1/blobs?epochs=${WALRUS_EPOCHS}`;

  try {
    const res = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body,
    });

    if (!res.ok) {
      throw new Error(`Publisher returned ${res.status}: ${await res.text()}`);
    }

    const result = await res.json();

    let blobId;
    if (result.newlyCreated) {
      blobId = result.newlyCreated.blobObject.blobId;
      console.log(`[walrus:testnet] Stored NEW blob ${blobId} (${body.length} bytes, ${WALRUS_EPOCHS} epochs, cost: ${result.newlyCreated.cost})`);
    } else if (result.alreadyCertified) {
      blobId = result.alreadyCertified.blobId;
      console.log(`[walrus:testnet] Blob already certified: ${blobId}`);
    } else {
      throw new Error('Unexpected publisher response: ' + JSON.stringify(result));
    }

    // Also cache locally for fast reads
    mockBlobStore.set(blobId, body);
    _persistBlobs();

    return blobId;
  } catch (err) {
    console.error('[walrus:testnet] Store failed, falling back to mock:', err.message);
    return _storeEssenceMock(essenceJson);
  }
}

async function _readEssenceTestnet(blobId) {
  // Try local cache first
  const cached = mockBlobStore.get(blobId);
  if (cached) {
    console.log(`[walrus:testnet] Read blob ${blobId} (from cache)`);
    return JSON.parse(cached);
  }

  const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;

  try {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Aggregator returned ${res.status}`);
    }

    const text = await res.text();
    console.log(`[walrus:testnet] Read blob ${blobId} (${text.length} bytes from aggregator)`);

    const parsed = JSON.parse(text);
    mockBlobStore.set(blobId, text);
    _persistBlobs();
    return parsed;
  } catch (err) {
    console.error('[walrus:testnet] Read failed:', err.message);
    throw new Error(`Blob not found on Walrus testnet: ${blobId}`);
  }
}

export function listMockBlobs() {
  return Array.from(mockBlobStore.keys());
}

export function getStorageMode() {
  return isTestnet ? 'testnet' : 'mock';
}
