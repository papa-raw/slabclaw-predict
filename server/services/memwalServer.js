import { MemWal } from '@mysten-incubation/memwal';

const MEMWAL_KEY = process.env.MEMWAL_DELEGATE_KEY;
const MEMWAL_ACCOUNT_ID = process.env.MEMWAL_ACCOUNT_ID;
const MEMWAL_URL = process.env.MEMWAL_URL || 'https://relayer.staging.memwal.ai';

const USE_REAL = !!(MEMWAL_KEY && MEMWAL_ACCOUNT_ID);

const clients = new Map();
const localCache = new Map();

function getClient(namespace) {
  if (!USE_REAL) return null;
  if (!clients.has(namespace)) {
    clients.set(namespace, MemWal.create({
      key: MEMWAL_KEY,
      accountId: MEMWAL_ACCOUNT_ID,
      serverUrl: MEMWAL_URL,
      namespace,
    }));
  }
  return clients.get(namespace);
}

function getLocalCache(namespace) {
  if (!localCache.has(namespace)) localCache.set(namespace, []);
  return localCache.get(namespace);
}

function localRecall(namespace, query, limit) {
  const store = getLocalCache(namespace);
  if (store.length === 0) return { results: [] };
  const tokens = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  const scored = store.map(mem => {
    const lower = mem.text.toLowerCase();
    let score = 0;
    for (const t of tokens) { if (lower.includes(t)) score++; }
    if (Date.now() - mem.timestamp < 300000) score += 0.1;
    return { text: mem.text, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return { results: scored.slice(0, limit).map(r => ({ text: r.text, score: r.score })) };
}

export async function storeMemoryServer(namespace, text, _delegateKey, _accountId) {
  const client = getClient(namespace);
  if (client) {
    const result = await client.remember(text, namespace);
    getLocalCache(namespace).push({ text, timestamp: Date.now(), blob_id: result.job_id });
    return { blob_id: result.job_id };
  }
  const store = getLocalCache(namespace);
  const blob_id = `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.push({ text, timestamp: Date.now(), blob_id });
  if (store.length > 200) store.splice(0, store.length - 200);
  return { blob_id };
}

export async function recallMemoriesServer(namespace, query, limit = 10, _delegateKey, _accountId) {
  const client = getClient(namespace);
  if (client) {
    const result = await client.recall(query, limit, namespace);
    return {
      results: (result.results || []).map(r => ({
        text: r.text,
        score: r.distance != null ? (1 - r.distance) : 1,
      })),
    };
  }
  return localRecall(namespace, query, limit);
}

export function getMemoryCount(namespace) {
  return getLocalCache(namespace).length;
}

export function isRealMemwalMode() {
  return USE_REAL;
}

export function clearAllMemories() {
  localCache.clear();
}

if (USE_REAL) {
  console.log('[MemWal] Real SDK active — account:', MEMWAL_ACCOUNT_ID.slice(0, 10) + '...');
} else {
  console.log('[MemWal] Local cache only — set MEMWAL_DELEGATE_KEY + MEMWAL_ACCOUNT_ID for Walrus-backed memory');
}
