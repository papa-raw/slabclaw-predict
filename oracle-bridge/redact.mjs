/// redact.mjs — Strip seller / personal data from evidence before it leaves the process.
///
/// WHY: evidence bundles are published to Walrus — a public, effectively
/// permanent, decentralized store. Marketplace seller usernames are personal
/// data; publishing them immutably collides with GDPR's right-to-erasure and
/// serves no oracle purpose. The manipulation-resistance signal we actually
/// need is *concentration* ("one seller is 64% of comps"), NOT *identity*.
///
/// WHAT: redactPII() deep-clones a bundle and removes every plaintext seller
/// identifier, replacing it with a per-bundle salted hash. Within a single
/// bundle the same seller maps to the same token (so concentration stays
/// detectable); across bundles the salt differs (so blobs can't be linked by
/// seller). The aggregate concentration metric is preserved/derived so the
/// defense loses nothing.
///
/// This is pseudonymisation, not a claim of perfect anonymisation — but it
/// removes plaintext usernames from public immutable storage, which is the
/// proportionate, root-cause fix for the actual exposure.

import { createHash, randomBytes } from 'node:crypto';

/// Keys whose VALUE is a seller/handle identifier and must be hashed.
const SELLER_KEYS = new Set(['seller', 'sellerId', 'seller_id', 'sellerName', 'seller_name', 'buyer', 'username', 'handle']);

/// Flag strings of the form "seller:<name>" leak identity — rewrite the name.
const SELLER_FLAG_RE = /^(seller|buyer|username|handle):(.+)$/i;

function tokenFor(value, salt) {
  return 'sh_' + createHash('sha256').update(salt).update(String(value)).digest('hex').slice(0, 12);
}

function deepClone(obj) {
  if (typeof structuredClone === 'function') return structuredClone(obj);
  return JSON.parse(JSON.stringify(obj));
}

/// Recursively scrub an arbitrary JSON value in place.
function scrub(node, salt) {
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i];
      if (typeof v === 'string') {
        const m = v.match(SELLER_FLAG_RE);
        if (m) node[i] = `${m[1].toLowerCase()}:${tokenFor(m[2].trim(), salt)}`;
      } else if (v && typeof v === 'object') {
        scrub(v, salt);
      }
    }
    return node;
  }
  if (node && typeof node === 'object') {
    for (const key of Object.keys(node)) {
      const val = node[key];
      if (SELLER_KEYS.has(key)) {
        // Replace identity with a stable-within-bundle token. Null stays null.
        node[key] = val == null || val === '' ? null : tokenFor(val, salt);
      } else if (typeof val === 'string') {
        const m = val.match(SELLER_FLAG_RE);
        if (m) node[key] = `${m[1].toLowerCase()}:${tokenFor(m[2].trim(), salt)}`;
      } else if (val && typeof val === 'object') {
        scrub(val, salt);
      }
    }
  }
  return node;
}

/// Derive a concentration metric from a signal's comps BEFORE identities are
/// hashed away, so the defense signal survives redaction explicitly.
function annotateConcentration(signal, salt) {
  const comps = Array.isArray(signal?.comps) ? signal.comps : null;
  if (!comps || comps.length === 0) return;
  const sellers = comps.map((c) => c?.seller).filter((s) => s != null && s !== '');
  if (sellers.length === 0) return;
  const freq = {};
  for (const s of sellers) freq[s] = (freq[s] || 0) + 1;
  const max = Math.max(...Object.values(freq));
  signal.sellerConcentration = {
    distinctSellers: Object.keys(freq).length,
    topSellerShare: Number((max / sellers.length).toFixed(3)),
    sampleSize: sellers.length,
  };
}

/**
 * Redact personal/seller data from an evidence bundle (or any nested object)
 * prior to publishing it to Walrus. Returns a redacted DEEP COPY; the input is
 * left untouched (local MemWal can keep richer detail offchain).
 *
 * @param {object} bundle  evidence bundle (consensus, agentSignals, …)
 * @param {object} [opts]
 * @param {string} [opts.salt]  fixed salt (else a fresh per-call random salt)
 * @returns {object} redacted copy
 */
export function redactPII(bundle, opts = {}) {
  if (bundle == null || typeof bundle !== 'object') return bundle;
  const salt = opts.salt || randomBytes(16).toString('hex');
  const copy = deepClone(bundle);

  // Preserve concentration signal from any signals' comps before scrubbing.
  const sigSets = copy.agentSignals && typeof copy.agentSignals === 'object'
    ? Object.values(copy.agentSignals)
    : [];
  for (const set of sigSets) {
    for (const sig of (set?.signals || [])) annotateConcentration(sig, salt);
  }

  scrub(copy, salt);
  copy.redaction = { applied: true, method: 'sha256-salted-token', scope: 'seller-pii', version: '1.0.0' };
  return copy;
}

/// Quick boolean check: does a bundle still contain any plaintext seller value?
/// Used by tests and as a publish-time assertion guard.
export function hasPlaintextSeller(node, _seen = new Set()) {
  if (node == null || typeof node !== 'object' || _seen.has(node)) return false;
  _seen.add(node);
  if (Array.isArray(node)) {
    for (const v of node) {
      if (typeof v === 'string' && SELLER_FLAG_RE.test(v) && !v.includes('sh_')) return true;
      if (v && typeof v === 'object' && hasPlaintextSeller(v, _seen)) return true;
    }
    return false;
  }
  for (const [k, v] of Object.entries(node)) {
    if (SELLER_KEYS.has(k) && v != null && v !== '' && !String(v).startsWith('sh_')) return true;
    if (typeof v === 'string' && SELLER_FLAG_RE.test(v) && !v.includes('sh_')) return true;
    if (v && typeof v === 'object' && hasPlaintextSeller(v, _seen)) return true;
  }
  return false;
}
