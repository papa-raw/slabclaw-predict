#!/usr/bin/env node
/// bridge-swarm.mjs — Swarm-powered oracle bridge.
///
/// Replaces the single-source bridge.mjs with multi-agent consensus:
///   1. Runs the full swarm (13 source agents + coordinator)
///   2. Reads consensus from MemWal
///   3. Proposes onchain resolution if quality gates pass
///   4. Uploads evidence to Walrus
///
/// Usage:
///   node bridge-swarm.mjs                  # one pass
///   node bridge-swarm.mjs --watch [sec]    # poll loop (default 300s)
///   node bridge-swarm.mjs --dry            # never propose onchain

import { EbayAgent } from './agents/ebay-agent.mjs';
import { CourtyardAgent } from './agents/courtyard-agent.mjs';
import { TcgplayerAgent } from './agents/tcgplayer-agent.mjs';
import { BeezieAgent } from './agents/beezie-agent.mjs';
import { CollectorCryptAgent } from './agents/collector-crypt-agent.mjs';
import { PricechartingAgent } from './agents/pricecharting-agent.mjs';
import { createTinyfishAgents } from './tinyfish-agents.mjs';
import { runCoordinator } from './agents/coordinator.mjs';
import { getClient, proposeResolution } from './sui-client.mjs';
import { uploadEvidence } from './walrus-evidence.mjs';
import { writeFrontendConsensus } from './export-consensus.mjs';
import { CONFIG, marketStateCode } from './config.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const DRY = args.includes('--dry');
const INTERVAL = (parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 300) * 1000;

const CARD_IDS = DEMO_MARKETS.map((m) => m.productId);
const GRADER = 'PSA';
const GRADE = 10;
const STATE = { 0: 'ACTIVE', 1: 'PROPOSED', 2: 'DISPUTED', 3: 'SETTLED' };
// Full-confidence family count. Exactly 2 agreeing families settle via the coordinator's
// thin_market flag (onchain ProtocolConfig.min_sources is now 2). Mirrors coordinator.mjs.
const MIN_SOURCES = 3;

const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });

// Mirrors swarm.mjs createAgents() so the served keeper sees the SAME 13-agent roster
// (6 backend-fed + 7 independent venue-direct via TinyFish) and therefore the same
// source/family counts the consensus is computed from. Diverging here silently
// under-counts families for the same cards.
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
    // fanatics, alt, cardmarket, yahoo-jp, 130point) — these get a card to 3+
    // independent families.
    ...createTinyfishAgents(cfg),
  ];
}

async function readMarket(client, id) {
  try {
    const o = await client.getObject({ id, options: { showContent: true } });
    const f = o?.data?.content?.fields;
    if (!f) return null;
    return { id, state: marketStateCode(f.state), strikeCents: Number(f.strike_usd_cents), expiryMs: Number(f.expiry_ms) };
  } catch { return null; }
}

async function pass() {
  const t0 = Date.now();
  console.log(`\n[bridge-swarm] ${new Date().toISOString()}`);

  // Tier 1: Run all source agents
  const agents = createAgents();
  await Promise.allSettled(agents.map((a) => a.run()));

  // Tier 2: Coordinator aggregation
  const { consensus, evidence } = await runCoordinator(CARD_IDS);

  // Upload evidence to Walrus. The blob id is the evidence gate: without it,
  // no market may be proposed this round.
  let walrusBlobId = null;
  try {
    const w = await uploadEvidence(evidence);
    walrusBlobId = w.blobId;
    console.log(`  Walrus evidence: ${w.blobId}`);
  } catch (e) {
    console.log(`  Walrus upload failed: ${e.message.slice(0, 80)}`);
  }

  // Write the frontend-readable consensus artifact (per product + evidence pointer).
  try {
    const p = writeFrontendConsensus(consensus, walrusBlobId);
    console.log(`  Frontend consensus: ${p}`);
  } catch (e) {
    console.log(`  Frontend consensus write failed: ${e.message.slice(0, 80)}`);
  }

  // Tier 3: Propose onchain
  if (!CONFIG.oracleCapId) {
    console.log('  No oracleCapId — skipping proposals');
    return;
  }

  const client = getClient();
  console.log('─'.repeat(88));
  console.log(['  card'.padEnd(18), 'state'.padEnd(9), 'consensus'.padEnd(11), 'strike'.padEnd(9), 'sources', 'action'].join(' '));
  console.log('─'.repeat(88));

  for (const m of DEMO_MARKETS) {
    const mkt = await readMarket(client, m.id);
    if (!mkt) { console.log(`  ${m.name.padEnd(16)} not found`); continue; }

    const c = consensus[m.productId];
    const price = c?.consensusPriceCents;
    const expired = mkt.expiryMs <= Date.now();

    // Quality gates. Settleable = 3+ agreeing sold-families (full confidence) OR a
    // genuinely-rare card that cleared the coordinator's thin-market corroboration gate
    // (exactly 2 agreeing families, rarity recorded). The coordinator already decided
    // this; the keeper honors the thin_market flag rather than re-gating on a literal 3.
    const hasConsensus = price != null && price > 0;
    const noDisagreement = !c?.flags?.includes('wide_disagreement');
    const insufficient = c?.flags?.includes('insufficient_sources');
    const hasSources = ((c?.sourceCount || 0) >= MIN_SOURCES || c?.flags?.includes('thin_market')) && !insufficient;
    const hasEvidence = !!walrusBlobId; // evidence gate: no Walrus blob → no proposal
    const canPropose = expired && mkt.state === 0 && hasConsensus && hasSources && noDisagreement && hasEvidence;

    let action = '';
    if (mkt.state === 3) action = 'settled';
    else if (mkt.state === 1) action = 'dispute window';
    else if (mkt.state === 2) action = 'disputed';
    else if (!expired) action = 'live';
    else if (!hasConsensus) action = 'no consensus';
    else if (insufficient) action = `${c.sourceCount} families (insufficient)`;
    else if (!noDisagreement) action = 'BLOCKED: disagreement';
    else if (!hasSources) action = `${c.sourceCount} sources (need ${MIN_SOURCES} or thin_market)`;
    else if (!hasEvidence) action = 'BLOCKED: no evidence';
    else if (c?.flags?.includes('thin_market')) action = DRY ? 'would propose (thin_market)' : 'PROPOSING (thin_market)...';
    else action = DRY ? 'would propose' : 'PROPOSING...';

    console.log([
      `  ${m.name}`.padEnd(18),
      (STATE[mkt.state] || '?').padEnd(9),
      (price ? usd(price) : '—').padEnd(11),
      usd(mkt.strikeCents).padEnd(9),
      String(c?.sourceCount || 0).padEnd(7),
      action,
    ].join(' '));

    if (canPropose && !DRY) {
      try {
        const r = await proposeResolution({
          oracleCapId: CONFIG.oracleCapId,
          marketId: m.id,
          priceUsdCents: price,
          sourcesCount: c.sourceCount,
          evidenceBlobId: walrusBlobId,
        });
        console.log(`    → proposed ${usd(price)} (${c.sourceCount} sources, walrus:${walrusBlobId.slice(0, 16)}…) — ${r.digest}`);
      } catch (e) {
        console.log(`    → failed: ${e.message.slice(0, 90)}`);
      }
    }
  }

  console.log(`\n  Done in ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}

async function main() {
  await pass();
  if (WATCH) {
    console.log(`[bridge-swarm] watching every ${INTERVAL / 1000}s — Ctrl-C to stop`);
    setInterval(() => pass().catch((e) => console.error('pass error:', e.message)), INTERVAL);
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });
