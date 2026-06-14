/// learning-loop.test.mjs — headless invariants for the perturbation-response proof.
///
/// Hermetic: seeds its own honest fixture + a fresh reputation so the result is
/// deterministic regardless of prior swarm runs. Sandboxes the live shared files
/// (signals, reputation, consensus) and restores them after. No network — the
/// Walrus persistence beat is covered separately by prove-learning-loop.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync, copyFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { runCoordinator } from '../agents/coordinator.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const SHARED = join(ROOT, 'memwal', 'shared');
const SIGNALS = join(SHARED, 'agent-signals', 'latest.json');
const REPUTATION = join(SHARED, 'reputation', 'weights.json');
const CONSENSUS = join(SHARED, 'consensus', 'latest.json');

const CARD = 'base5-1st-83';      // Dark Raichu
const TARGET = 'goldin';
const now = () => new Date().toISOString();

// Honest fixture: 3 independent realized families clustered ~$6–8k → clean settle.
// pricecharting + point130 = eBay-sold family; fanatics = fanatics-pwcc; goldin = goldin.
function honestSignals() {
  const t = now();
  const mk = (cardId, priceCents, source, compCount, confidence = 0.8) =>
    ({ cardId, priceCents, source, compCount, confidence, observedAt: t });
  return {
    pricecharting: { timestamp: t, signals: [mk(CARD, 798700, 'pc_sold', 5)] },
    point130:      { timestamp: t, signals: [mk(CARD, 589000, 'point130', 3)] },
    fanatics:      { timestamp: t, signals: [mk(CARD, 711300, 'fanatics', 4)] },
    goldin:        { timestamp: t, signals: [mk(CARD, 793000, 'goldin', 3)] },
  };
}

function spoofedSignals(multiple = 3) {
  const s = honestSignals();
  s[TARGET].signals[0].priceCents = Math.round(793000 * multiple);
  return s;
}

const writeJson = (p, v) => { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2)); };
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } };
const trust = (rep) => rep?.[TARGET]?.reliability ?? null;

test('perturbation-response: catch manipulation, drop trust, hold consensus, keep the grudge', async () => {
  // ── sandbox live files ──
  const guard = [SIGNALS, REPUTATION, CONSENSUS].map((p) => {
    const b = existsSync(p) ? p + '.test-bak' : null;
    if (b) copyFileSync(p, b);
    return [b, p];
  });
  const restore = () => {
    for (const [b, p] of guard) {
      if (b && existsSync(b)) { copyFileSync(b, p); rmSync(b, { force: true }); }
      else if (!b && existsSync(p)) rmSync(p, { force: true });
    }
  };

  try {
    writeJson(REPUTATION, {});                  // fresh reputation → deterministic

    // Beat 0: baseline (honest)
    writeJson(SIGNALS, honestSignals());
    const base = await runCoordinator([CARD]);
    const C0 = base.consensus[CARD]?.consensusPriceCents;
    const R0 = trust(base.reputation);
    assert.ok(C0 > 0, 'baseline produced a consensus price');
    assert.ok(R0 > 0, 'target has a baseline trust');

    // Beat 1: attack (spoof) — rejected, consensus stable, trust drops
    writeJson(SIGNALS, spoofedSignals(3));
    const atk = await runCoordinator([CARD]);
    const C1 = atk.consensus[CARD]?.consensusPriceCents;
    const R1 = trust(atk.reputation);
    const rejected = (atk.consensus[CARD]?.rejectedSources || []).some((r) => r.platform === TARGET);

    assert.ok(rejected, 'the spoof was rejected at the gate');
    assert.ok(Math.abs(C1 - C0) / C0 <= 0.05, `consensus held under attack (drift ${(Math.abs(C1 - C0) / C0 * 100).toFixed(1)}%)`);
    assert.ok(R1 < R0, `trust dropped after the lie (${R0.toFixed(3)} → ${R1.toFixed(3)})`);

    // Beat 2: honest again — grudge held (trust still below baseline)
    writeJson(SIGNALS, honestSignals());
    const mem = await runCoordinator([CARD]);
    const R2 = trust(mem.reputation);
    assert.ok(R2 < R0, `grudge held: trust still below baseline (${R2.toFixed(3)} < ${R0.toFixed(3)})`);

    // Reputation persisted to disk (the file a snapshot would carry to Walrus)
    assert.ok(Math.abs(trust(readJson(REPUTATION)) - R2) < 1e-9, 'lowered trust is on disk for persistence');
  } finally {
    restore();
  }
});
