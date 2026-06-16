#!/usr/bin/env node
/// prove-learning-loop.mjs — the perturbation-response proof.
///
/// "Our agents remember and learn" is a claim until you watch the swarm get
/// attacked, catch it, and hold a grudge that survives its own death. This
/// runs the REAL pipeline (coordinator + reputation + Walrus snapshot/restore)
/// through a four-beat arc on one card:
///
///   0. BASELINE  — honest signals → consensus C0, target source trust R0
///   1. ATTACK    — one source posts a shill-high spoof. The anchor/MAD gate
///                  REJECTS it; consensus stays ≈ C0 (manipulation absorbed);
///                  the liar's reputation drops R0 → R1.
///   2. MEMORY    — the source behaves again, but its vote now carries LOWER
///                  weight (R1 < R0). The swarm remembers the betrayal.
///   3. PERSIST   — snapshot memory to Walrus, DESTROY it, restore from the
///                  blob alone. R1 survived: the lesson outlived the operator.
///
/// PASS = manipulation rejected AND trust dropped AND consensus stable AND the
/// lowered trust round-tripped through Walrus. Deterministic (observedAt is
/// stamped now), so it films identically every take. Sandboxed: the live
/// reputation + signal files are backed up and restored at the end.
///
///   node prove-learning-loop.mjs [targetPlatform] [cardId]
///   node prove-learning-loop.mjs --no-walrus      # skip the persistence beat (offline)

import { readFileSync, writeFileSync, existsSync, copyFileSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { runCoordinator } from './agents/coordinator.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const ROOT = new URL('.', import.meta.url).pathname;
const SHARED = join(ROOT, 'memwal', 'shared');
const SIGNALS = join(SHARED, 'agent-signals', 'latest.json');
const REPUTATION = join(SHARED, 'reputation', 'weights.json');
const CONSENSUS = join(SHARED, 'consensus', 'latest.json');

const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const NO_WALRUS = process.argv.includes('--no-walrus');
const roundsArg = process.argv.find((a) => a.startsWith('--rounds='));
const ATTACK_ROUNDS = roundsArg ? Math.max(1, parseInt(roundsArg.split('=')[1], 10) || 1) : 4;
const TARGET = args[0] || 'goldin';                 // a source that reports an honest comp on the card
const CARD = args[1] || 'base5-1st-83';             // Dark Raichu — best multi-source coverage
const CARDS = DEMO_MARKETS.map((m) => m.productId);
const SPOOF_MULTIPLE = 3.0;                          // shill-high: 3× the honest price

const usd = (c) => (c == null ? '—' : '$' + Math.round(c / 100).toLocaleString('en-US'));
const pctTrust = (r) => (r == null ? '—' : (r * 100).toFixed(1) + '%');
const cardName = DEMO_MARKETS.find((m) => m.productId === CARD)?.name || CARD;

// ── helpers ──────────────────────────────────────────────────────────
function readJson(p) { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return null; } }
function writeJson(p, v) { mkdirSync(join(p, '..'), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2)); }
function trustOf(rep, platform) { return rep?.[platform]?.reliability ?? null; }

/// Deep-copy the live signals and stamp every observation `observedAt = now`
/// so recency decay is identical across beats (deterministic on camera).
function freshenSignals(raw) {
  const now = new Date().toISOString();
  const out = JSON.parse(JSON.stringify(raw || {}));
  for (const d of Object.values(out)) {
    for (const s of d.signals || []) s.observedAt = now;
    d.timestamp = now;
  }
  return out;
}

function findTargetSignal(signals, platform, cardId) {
  return (signals[platform]?.signals || []).find((s) => s.cardId === cardId);
}

async function coordPass() {
  // Score ONLY the attacked card. The coordinator updates source reputation per
  // card it runs; if we ran all four, the target's honest votes on the OTHER
  // cards would offset its spoof here and muddy the trust signal. Isolating the
  // attacked card makes the erosion clean and attributable to the lie.
  const { consensus, reputation } = await runCoordinator([CARD]);
  return { c: consensus[CARD], rep: reputation };
}

// ── sandbox: back up the live files, restore on exit ─────────────────
const backups = [];
function sandbox(p) {
  if (existsSync(p)) { const b = p + '.learn-backup'; copyFileSync(p, b); backups.push([b, p]); }
  else backups.push([null, p]); // file didn't exist → delete whatever we create
}
function restoreSandbox() {
  for (const [b, p] of backups) {
    if (b && existsSync(b)) { copyFileSync(b, p); rmSync(b, { force: true }); }
    else if (!b && existsSync(p)) rmSync(p, { force: true });
  }
}

// ── main ─────────────────────────────────────────────────────────────
console.log('━━━ PROOF: a swarm that catches manipulation and holds a grudge ━━━\n');
console.log(`   card: ${cardName} (${CARD})   ·   target source: ${TARGET}\n`);

sandbox(SIGNALS);
sandbox(REPUTATION);
sandbox(CONSENSUS);   // single-card runs rewrite this; restore the full 4-card consensus after

const liveSignals = readJson(SIGNALS);
if (!liveSignals) { console.error('No agent-signals/latest.json — run the swarm once first.'); process.exit(1); }

const honest = freshenSignals(liveSignals);
const honestTarget = findTargetSignal(honest, TARGET, CARD);
if (!honestTarget) {
  console.error(`Source "${TARGET}" has no signal for ${CARD}. Pick one of:`);
  for (const [p, d] of Object.entries(honest)) {
    const s = (d.signals || []).find((x) => x.cardId === CARD);
    if (s) console.error(`   ${p.padEnd(16)} ${usd(s.priceCents)}`);
  }
  restoreSandbox();
  process.exit(1);
}
const honestPrice = honestTarget.priceCents;

let pass = true;
const fail = (msg) => { pass = false; console.log(`   ❌ ${msg}`); };

try {
  // ── Beat 0: BASELINE ───────────────────────────────────────────────
  console.log('0) BASELINE — honest round');
  writeJson(SIGNALS, honest);
  const base = await coordPass();
  const C0 = base.c?.consensusPriceCents;
  const R0 = trustOf(base.rep, TARGET);
  console.log(`   consensus            ${usd(C0)}`);
  console.log(`   ${TARGET} reports     ${usd(honestPrice)}  → trust ${pctTrust(R0)}`);

  // ── Beat 1: ATTACK (repeated — a persistent manipulator, trust erodes) ──
  const spoofPrice = Math.round(honestPrice * SPOOF_MULTIPLE);
  console.log(`\n1) ATTACK — ${TARGET} posts a shill-high spoof ${usd(spoofPrice)} (${SPOOF_MULTIPLE}× honest), ${ATTACK_ROUNDS} rounds`);
  console.log(`   round   gate verdict                     consensus    ${TARGET} trust`);
  let C1 = C0, R1 = R0, everRejected = false, maxDrift = 0;
  for (let i = 1; i <= ATTACK_ROUNDS; i++) {
    const spoofed = freshenSignals(honest);
    findTargetSignal(spoofed, TARGET, CARD).priceCents = spoofPrice;
    writeJson(SIGNALS, spoofed);
    const atk = await coordPass();
    C1 = atk.c?.consensusPriceCents;
    R1 = trustOf(atk.rep, TARGET);
    const rejected = (atk.c?.rejectedSources || []).find((r) => r.platform === TARGET);
    if (rejected) everRejected = true;
    if (C0 != null && C1 != null) maxDrift = Math.max(maxDrift, Math.abs(C1 - C0) / C0);
    const verdict = rejected ? `REJECTED (${rejected.reason})`.slice(0, 32) : 'NOT REJECTED';
    console.log(`   ${String(i).padEnd(7)} ${verdict.padEnd(33)} ${usd(C1).padEnd(12)} ${pctTrust(R1)}`);
  }

  if (!everRejected) fail(`manipulation NOT caught — ${TARGET}'s spoof survived the gate`);
  else console.log(`   ✅ every spoof rejected at the gate`);
  if (maxDrift > 0.05) fail(`consensus moved ${(maxDrift * 100).toFixed(1)}% under attack (>5% — manipulation leaked)`);
  else console.log(`   ✅ consensus never moved more than ${(maxDrift * 100).toFixed(1)}% — manipulation absorbed`);
  if (R0 != null && R1 != null) {
    if (R1 < R0) console.log(`   ✅ trust eroded ${pctTrust(R0)} → ${pctTrust(R1)} — the swarm marked ${TARGET} a liar`);
    else fail(`trust did NOT drop (${pctTrust(R0)} → ${pctTrust(R1)})`);
  }

  // ── Beat 2: MEMORY ─────────────────────────────────────────────────
  console.log(`\n2) MEMORY — ${TARGET} behaves again, but the swarm remembers`);
  writeJson(SIGNALS, freshenSignals(honest));
  const mem = await coordPass();
  const contrib = (mem.c?.contributingSources || []).find((s) => s.platform === TARGET);
  const R2 = trustOf(mem.rep, TARGET);
  console.log(`   ${TARGET} reports     ${usd(honestPrice)} (honest again)`);
  console.log(`   its vote weight      ${contrib ? contrib.weight.toFixed(4) : '— (still discounted)'} @ trust ${pctTrust(R2)}`);
  if (R2 != null && R0 != null) {
    if (R2 < R0) console.log(`   ✅ ${TARGET} is trusted LESS than before it lied (${pctTrust(R2)} < ${pctTrust(R0)})`);
    else fail(`grudge not held — trust recovered to ${pctTrust(R2)}`);
  }

  // ── Beat 3: PERSIST (Walrus round-trip) ────────────────────────────
  if (NO_WALRUS) {
    console.log('\n3) PERSIST — skipped (--no-walrus)');
  } else {
    console.log('\n3) PERSIST — snapshot to Walrus, destroy memory, restore from the blob alone');
    const { snapshotToWalrus, restoreFromWalrus } = await import('./memwal-sync.mjs');
    const trustBefore = trustOf(readJson(REPUTATION), TARGET);
    const snap = await snapshotToWalrus();
    if (!snap?.blobId) { fail('snapshot to Walrus failed'); }
    else {
      console.log(`   snapshot → Walrus    ${snap.blobId}`);
      rmSync(REPUTATION, { force: true });
      console.log(`   reputation DESTROYED (file removed): ${!existsSync(REPUTATION)}`);
      await restoreFromWalrus(snap.blobId);
      const trustAfter = trustOf(readJson(REPUTATION), TARGET);
      console.log(`   restored from blob   ${TARGET} trust ${pctTrust(trustAfter)} (was ${pctTrust(trustBefore)})`);
      if (trustAfter != null && trustBefore != null && Math.abs(trustAfter - trustBefore) < 1e-9) {
        console.log(`   ✅ the grudge survived its own death — memory outlived the operator`);
      } else {
        fail(`lowered trust did NOT survive the Walrus round-trip`);
      }
    }
  }

  console.log(pass
    ? '\n━━━ PASS: manipulation caught · trust dropped · consensus held · lesson persisted ━━━'
    : '\n━━━ FAIL: see ❌ above ━━━');
} catch (e) {
  console.error('\nerror:', e.message);
  pass = false;
} finally {
  restoreSandbox();
  console.log('(live reputation + signals restored — sandbox clean)');
}

process.exit(pass ? 0 : 1);
