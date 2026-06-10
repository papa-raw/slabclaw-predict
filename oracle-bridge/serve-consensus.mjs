#!/usr/bin/env node
/// serve-consensus.mjs — tiny read-only API for the swarm's latest consensus round.
///
/// Serves the same envelope the frontend ships as a build-time snapshot, so the
/// dapp can upgrade to live data when this endpoint is reachable (useLiveConsensus).
///
///   GET /predict/consensus  → latest oracle-consensus envelope (CORS: public)
///   GET /predict/signals    → market quality signals (grade inversions etc.)
///   GET /predict/health     → { ok, consensusAgeMs, roundId, generatedAt }
///
/// Run: node serve-consensus.mjs   (PORT env, default 3457 — localhost only;
/// nginx terminates TLS and proxies api.slabclaw.com/predict/* here.)

import http from 'node:http';
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CONSENSUS_PATH = join(__dirname, '..', 'frontend', 'src', 'data', 'oracle-consensus.json');
const SIGNALS_PATH = join(__dirname, '..', 'frontend', 'src', 'data', 'market-signals.json');
const RESTORE_STATE_PATH = join(__dirname, 'memwal', '.restore-state.json');
const PORT = parseInt(process.env.PORT, 10) || 3457;

// A round older than ~2 missed 6h swarm cycles is unhealthy — say so honestly.
const STALE_MS = 26 * 60 * 60 * 1000;

function readJson(path) {
  return { body: readFileSync(path, 'utf8'), mtimeMs: statSync(path).mtimeMs };
}

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, {
    'Content-Type': type,
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'public, max-age=300',
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const path = new URL(req.url, 'http://x').pathname.replace(/\/+$/, '');
  try {
    if (path === '/predict/consensus') {
      const { body } = readJson(CONSENSUS_PATH);
      return send(res, 200, body);
    }
    if (path === '/predict/signals') {
      const { body } = readJson(SIGNALS_PATH);
      return send(res, 200, body);
    }
    if (path === '/predict/health') {
      const { body, mtimeMs } = readJson(CONSENSUS_PATH);
      const envelope = JSON.parse(body);
      const generatedAt = envelope.timestamp || mtimeMs;
      const ageMs = Date.now() - generatedAt;
      const ok = ageMs < STALE_MS;
      // Memory provenance: which Walrus blob this node's agent memory was
      // restored from, and whether the pointer came from the onchain
      // SwarmMemory object (operator-independent) or a local log.
      let memory = null;
      try {
        const rs = JSON.parse(readFileSync(RESTORE_STATE_PATH, 'utf8'));
        memory = {
          restoredFromBlobId: rs.blobId, pointerSource: rs.source,
          restoredAt: rs.restoredAt, files: rs.restored,
        };
      } catch { /* never restored on this node yet */ }
      return send(res, ok ? 200 : 503, JSON.stringify({
        ok, consensusAgeMs: ageMs, roundId: envelope.roundId || null,
        generatedAt, markets: Object.keys(envelope.consensus || {}).length,
        memory,
      }));
    }
    return send(res, 404, JSON.stringify({ error: 'not found' }));
  } catch (e) {
    return send(res, 500, JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[predict-api] serving consensus on http://127.0.0.1:${PORT}/predict/*`);
});
