#!/usr/bin/env node
/// swarm.mjs — Oracle Swarm runner.
///
/// Orchestrates: 8 Tier 1 source agents (parallel) -> Tier 2 coordinator ->
/// Tier 3 keeper (bridge). Reads from SlabClaw backend, writes consensus to
/// MemWal, optionally proposes onchain resolution.
///
/// Usage:
///   node swarm.mjs                   # one-shot: run all agents, aggregate, print
///   node swarm.mjs --watch [sec]     # poll loop (default 300s)
///   node swarm.mjs --propose         # also propose onchain if markets expired
///   node swarm.mjs --dry             # skip onchain actions
///   node swarm.mjs --verbose         # show per-agent detail

import { EbayAgent } from './agents/ebay-agent.mjs';
import { CourtyardAgent } from './agents/courtyard-agent.mjs';
import { TcgplayerAgent } from './agents/tcgplayer-agent.mjs';
import { AltAgent } from './agents/alt-agent.mjs';
import { CardmarketAgent } from './agents/cardmarket-agent.mjs';
import { BeezieAgent } from './agents/beezie-agent.mjs';
import { CollectorCryptAgent } from './agents/collector-crypt-agent.mjs';
import { GoldinAgent } from './agents/goldin-agent.mjs';
import { PricechartingAgent } from './agents/pricecharting-agent.mjs';
import { createTinyfishAgents } from './tinyfish-agents.mjs';
import { runCoordinator } from './agents/coordinator.mjs';
import { runQualityTier } from './quality-tier.mjs';
import { getClient, proposeResolution } from './sui-client.mjs';
import { uploadEvidence } from './walrus-evidence.mjs';
import { snapshotToWalrus, restoreFromWalrus, memwalIsEmpty } from './memwal-sync.mjs';
import { writeFrontendConsensus } from './export-consensus.mjs';
import { CONFIG, marketStateCode } from './config.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const PROPOSE = args.includes('--propose');
const DRY = args.includes('--dry');
const VERBOSE = args.includes('--verbose');
const INTERVAL = (parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 300) * 1000;

const MEMWAL_ROOT = join(new URL('.', import.meta.url).pathname, 'memwal');
const CARD_IDS = DEMO_MARKETS.map((m) => m.productId);
const GRADER = 'PSA';
const GRADE = 10;
const STATE_LABELS = { 0: 'ACTIVE', 1: 'PROPOSED', 2: 'DISPUTED', 3: 'SETTLED' };

const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const pct = (n) => (n * 100).toFixed(1) + '%';

function createAgents() {
  const cfg = { slabclawApi: CONFIG.slabclawApi, cardIds: CARD_IDS, grader: GRADER, grade: GRADE };
  return [
    // Backend-fed agents (eBay/PriceCharting are the eBay-sold origin)
    new EbayAgent(cfg),
    new CourtyardAgent(cfg),
    new TcgplayerAgent(cfg),
    new BeezieAgent(cfg),
    new CollectorCryptAgent(cfg),
    new PricechartingAgent(cfg),
    // Genuinely-independent venues scraped directly via TinyFish (psa-apr, goldin,
    // fanatics, alt) — these are what get a card to 3+ independent sources.
    ...createTinyfishAgents(cfg),
  ];
}

function loadReputation() {
  const p = join(MEMWAL_ROOT, 'shared', 'reputation', 'weights.json');
  if (!existsSync(p)) return {};
  try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return {}; }
}

async function readMarket(client, id) {
  try {
    const o = await client.getObject({ id, options: { showContent: true } });
    const f = o?.data?.content?.fields;
    if (!f) return null;
    return { id, state: marketStateCode(f.state), strikeCents: Number(f.strike_usd_cents), expiryMs: Number(f.expiry_ms) };
  } catch { return null; }
}

// ── Main pass ────────────────────────────────────────────────────────

async function pass() {
  const t0 = Date.now();
  console.log(`\n${'='.repeat(80)}`);
  console.log(`  ORACLE SWARM  |  ${new Date().toISOString()}  |  ${CARD_IDS.length} cards`);
  console.log(`${'='.repeat(80)}\n`);

  // ── Tier 1: Source agents (parallel) ───────────────────────────────
  console.log('--- TIER 1: Source Agents ---\n');
  const agents = createAgents();
  const results = await Promise.allSettled(agents.map((a) => a.run()));

  const agentSummary = [];
  for (let i = 0; i < agents.length; i++) {
    const name = agents[i].platform;
    const r = results[i];
    if (r.status === 'fulfilled') {
      const { signals, log } = r.value;
      const signalCount = signals.length;
      const errorCount = Object.values(log.cards).filter((c) => c.error).length;
      const flagged = Object.values(log.cards).filter((c) => c.flags?.length > 0).length;
      agentSummary.push({ name, signals: signalCount, errors: errorCount, flagged });
      const icon = signalCount > 0 ? '✓' : (errorCount > 0 ? '✗' : '—');
      console.log(`  ${icon} ${name.padEnd(16)} ${signalCount} signals, ${errorCount} errors${flagged ? `, ${flagged} flagged` : ''}`);

      if (VERBOSE) {
        for (const [cardId, info] of Object.entries(log.cards)) {
          if (info.error) {
            console.log(`      ${cardId}: ${info.error}`);
          } else {
            console.log(`      ${cardId}: ${usd(info.priceCents)} conf=${pct(info.confidence)} comps=${info.compCount}${info.flags?.length ? ' [' + info.flags.join(',') + ']' : ''}`);
          }
        }
      }
    } else {
      agentSummary.push({ name, signals: 0, errors: 1, flagged: 0 });
      console.log(`  ✗ ${name.padEnd(16)} FAILED: ${r.reason?.message || r.reason}`);
    }
  }

  // ── Tier 2: Coordinator ────────────────────────────────────────────
  console.log('\n--- TIER 2: Coordinator ---\n');
  const { consensus, evidence, reputation } = await runCoordinator(CARD_IDS);

  console.log('  ' + ['card'.padEnd(16), 'consensus'.padEnd(11), 'CI 25-75%'.padEnd(18), 'sources', 'rejected', 'flags'].join(' '));
  console.log('  ' + '─'.repeat(80));

  for (const cardId of CARD_IDS) {
    const c = consensus[cardId];
    if (!c) { console.log(`  ${cardId.padEnd(16)} no consensus`); continue; }
    const ci = c.consensusPriceCents
      ? `[${usd(c.confidenceLower)} - ${usd(c.confidenceUpper)}]`
      : '—';
    console.log(`  ${cardId.padEnd(16)} ${(c.consensusPriceCents ? usd(c.consensusPriceCents) : '—').padEnd(11)} ${ci.padEnd(18)} ${String(c.sourceCount).padEnd(7)} ${String(c.rejectedSources.length).padEnd(8)} ${c.flags.join(', ') || '—'}`);
  }

  // Reputation summary
  console.log('\n  Source Reliability:');
  for (const [platform, r] of Object.entries(reputation).sort((a, b) => b[1].reliability - a[1].reliability)) {
    console.log(`    ${platform.padEnd(16)} ${pct(r.reliability).padEnd(8)} (${r.hits}/${r.rounds} rounds)`);
  }

  // ── Tier 2.5: Self-audit quality pass (anchor reconciliation + learned calibration) ─
  // Reconciles the settle vs the grade-matched oracle, runs inversion/divergence
  // checks against each card's LEARNED baseline, persists what it learned to MemWal,
  // and widens the dispute window when the PSA-10 anchor itself is contested.
  console.log('\n--- TIER 2.5: Self-audit (learned calibration → MemWal) ---');
  try {
    const quality = await runQualityTier(CARD_IDS, consensus);
    for (const [id, q] of Object.entries(quality.cards)) {
      console.log(`  ${(q.name || id).padEnd(16)} ${q.flags.length} flag(s)  ${q.wideDispute ? '⚠ dispute widened' : `conf ${q.confidence}`}`);
    }
  } catch (e) {
    console.log(`  quality tier failed: ${e.message.slice(0, 100)}`);
  }

  // ── Evidence bundle → Walrus (must precede proposals: it's the gate) ─
  console.log(`\n--- Evidence ---`);
  console.log(`  Bundle: memwal/shared/evidence/latest-bundle.json`);
  console.log(`  Cards: ${evidence.cardIds.length}, Agents: ${Object.keys(evidence.agentSignals).length}`);
  console.log(`  Method: ${evidence.aggregationMethod} + ${evidence.outlierMethod} (threshold ${evidence.madThreshold})`);

  let walrusBlobId = null;
  let walrusAggregatorUrl = null;
  try {
    const walrus = await uploadEvidence(evidence);
    walrusBlobId = walrus.blobId;
    walrusAggregatorUrl = walrus.aggregatorUrl;
    console.log(`  Walrus: ${walrus.blobId}`);
    console.log(`  View:   ${walrus.aggregatorUrl}`);
  } catch (e) {
    console.log(`  Walrus upload failed: ${e.message.slice(0, 100)}`);
  }

  // Write the frontend-readable consensus artifact (per product + evidence pointer).
  try {
    const p = writeFrontendConsensus(consensus, walrusBlobId);
    console.log(`  Frontend consensus: ${p}`);
  } catch (e) {
    console.log(`  Frontend consensus write failed: ${e.message.slice(0, 100)}`);
  }

  // ── Tier 3: Keeper (onchain proposals) ─────────────────────────────
  if (PROPOSE) {
    console.log('\n--- TIER 3: Bridge Keeper ---\n');
    const client = getClient();

    for (const m of DEMO_MARKETS) {
      const mkt = await readMarket(client, m.id);
      if (!mkt) { console.log(`  ${m.name.padEnd(16)} not found onchain`); continue; }

      const c = consensus[m.productId];
      if (!c?.consensusPriceCents) { console.log(`  ${m.name.padEnd(16)} no consensus price`); continue; }

      const expired = mkt.expiryMs <= Date.now();
      const hasEvidence = !!walrusBlobId; // evidence gate: no Walrus blob → no proposal
      const canPropose = expired && mkt.state === 0 && c.sourceCount >= 3 && !c.flags.includes('wide_disagreement') && hasEvidence;

      let action = '';
      if (mkt.state === 3) action = 'settled';
      else if (mkt.state === 1) action = 'in dispute window';
      else if (mkt.state === 2) action = 'disputed';
      else if (!expired) action = 'live';
      else if (c.sourceCount < 3) action = `only ${c.sourceCount} sources`;
      else if (c.flags.includes('wide_disagreement')) action = 'BLOCKED: source disagreement';
      else if (!hasEvidence) action = 'BLOCKED: no evidence';
      else action = DRY ? 'would propose' : 'PROPOSING...';

      console.log(`  ${m.name.padEnd(16)} ${STATE_LABELS[mkt.state].padEnd(9)} consensus=${usd(c.consensusPriceCents)} strike=${usd(mkt.strikeCents)} -> ${action}`);

      if (canPropose && !DRY) {
        try {
          const r = await proposeResolution({
            oracleCapId: CONFIG.oracleCapId,
            marketId: m.id,
            priceUsdCents: c.consensusPriceCents,
            sourcesCount: c.sourceCount,
            evidenceBlobId: walrusBlobId,
          });
          console.log(`    → proposed ${usd(c.consensusPriceCents)} (${c.sourceCount} sources, walrus:${walrusBlobId.slice(0, 16)}…) — ${r.digest}`);
        } catch (e) {
          console.log(`    → propose failed: ${e.message.slice(0, 90)}`);
        }
      }
    }
  }

  // Write frontend snapshot for the UI (evidence already uploaded above).
  const snapshotPath = join(new URL('.', import.meta.url).pathname, '..', 'frontend', 'public', 'data');
  mkdirSync(snapshotPath, { recursive: true });
  const snapshot = {
    timestamp: new Date().toISOString(),
    consensus,
    reputation,
    agents: agentSummary,
    walrusBlobId,
    walrusAggregatorUrl,
  };
  writeFileSync(join(snapshotPath, 'swarm-consensus.json'), JSON.stringify(snapshot, null, 2));

  // ── MemWal snapshot → Walrus (memory persistence) ───────────────
  let memwalBlobId = null;
  try {
    const snap = await snapshotToWalrus();
    if (snap?.blobId) {
      memwalBlobId = snap.blobId;
      console.log(`\n--- MemWal Snapshot ---`);
      console.log(`  Blob:  ${snap.blobId}`);
      console.log(`  Files: ${snap.fileCount} (${(snap.sizeBytes / 1024).toFixed(1)}KB)`);
      console.log(`  View:  ${snap.aggregatorUrl}`);
    }
  } catch (e) {
    console.log(`\n  MemWal snapshot failed: ${e.message.slice(0, 100)}`);
  }

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`\n  Completed in ${elapsed}s\n`);

  return { consensus, evidence, reputation, agentSummary, memwalBlobId };
}

// ── Entry point ──────────────────────────────────────────────────────

async function main() {
  // Cold-start restore: if memwal/ is empty, try to restore from latest Walrus snapshot
  if (memwalIsEmpty()) {
    console.log('[swarm] No local memory — attempting MemWal restore from Walrus...');
    try {
      const res = await restoreFromWalrus();
      if (res) {
        console.log(`[swarm] Restored ${res.restored} files from ${res.timestamp}`);
      } else {
        console.log('[swarm] No snapshot found — cold start.');
      }
    } catch (e) {
      console.log(`[swarm] Restore failed (${e.message.slice(0, 80)}) — cold start.`);
    }
  }

  await pass();
  if (WATCH) {
    console.log(`[swarm] watching every ${INTERVAL / 1000}s — Ctrl-C to stop\n`);
    setInterval(() => pass().catch((e) => console.error('pass error:', e.message)), INTERVAL);
  }
}

main().catch((e) => { console.error('Fatal:', e.message, e.stack); process.exit(1); });
