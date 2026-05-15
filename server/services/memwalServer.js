/**
 * memwalServer.js — In-memory mock for Sprint 2.
 * Real MemWal SDK integration deferred to Sprint 4.
 * API shape matches real MemWal so the Sprint 4 swap is minimal.
 *
 * Real MemWal API (Sprint 4):
 *   storeMemoryServer → memwal.rememberAndWait(text) → returns blob_id
 *   recallMemoriesServer → memwal.recall(query, limit) → { results: [{ text, score }] }
 */

// In-memory store: namespace → [{ text, timestamp }]
const memoryStore = new Map();

function getNamespaceStore(namespace) {
  if (!memoryStore.has(namespace)) {
    memoryStore.set(namespace, []);
  }
  return memoryStore.get(namespace);
}

/**
 * Store a memory text in the given namespace.
 * Returns a mock blob_id for API shape compatibility.
 *
 * @param {string} namespace
 * @param {string} text
 * @param {string} delegateKey - unused in mock, reserved for Sprint 4
 * @param {string} accountId - unused in mock, reserved for Sprint 4
 * @returns {Promise<{ blob_id: string }>}
 */
export async function storeMemoryServer(namespace, text, delegateKey, accountId) {
  const store = getNamespaceStore(namespace);
  const blob_id = `mock-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  store.push({ text, timestamp: Date.now(), blob_id });

  // Keep max 200 memories per namespace to avoid unbounded growth
  if (store.length > 200) {
    store.splice(0, store.length - 200);
  }

  return { blob_id };
}

/**
 * Recall memories from a namespace matching the query.
 * Uses substring matching as a mock for semantic search.
 * Returns in the same shape as the real MemWal recall() response.
 *
 * @param {string} namespace
 * @param {string} query
 * @param {number} limit
 * @param {string} delegateKey - unused in mock
 * @param {string} accountId - unused in mock
 * @returns {Promise<{ results: Array<{ text: string, score: number }> }>}
 */
export async function recallMemoriesServer(namespace, query, limit = 10, delegateKey, accountId) {
  const store = getNamespaceStore(namespace);
  if (store.length === 0) {
    return { results: [] };
  }

  const lowerQuery = query.toLowerCase();
  const queryTokens = lowerQuery.split(/\s+/).filter(t => t.length > 2);

  // Score each memory by how many query tokens it contains
  const scored = store.map(mem => {
    const lowerText = mem.text.toLowerCase();
    let score = 0;
    for (const token of queryTokens) {
      if (lowerText.includes(token)) score++;
    }
    // Recency boost: memories from last 5 minutes score slightly higher
    const recencyBoost = (Date.now() - mem.timestamp) < 300000 ? 0.1 : 0;
    return { text: mem.text, score: score + recencyBoost };
  });

  // Sort by score descending, then return top limit
  scored.sort((a, b) => b.score - a.score);
  const results = scored.slice(0, limit).map(r => ({ text: r.text, score: r.score }));

  return { results };
}

/**
 * Get the number of memories stored in a namespace.
 * Utility for debugging — not part of the real MemWal API.
 */
export function getMemoryCount(namespace) {
  return getNamespaceStore(namespace).length;
}

/**
 * Clear all memories (for testing purposes).
 */
export function clearAllMemories() {
  memoryStore.clear();
}
