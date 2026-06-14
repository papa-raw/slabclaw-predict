#!/usr/bin/env node
/// mcp-server.mjs — the SlabClaw oracle, exposed as an MCP server.
///
/// Most Walrus-track entries are memory you can store. This makes our oracle
/// a primitive any AI agent can CONSUME: point Claude Desktop, Cursor, or any
/// MCP client at this server and an agent can ask "what's a PSA 10 Dark Raichu
/// worth?" — and get a manipulation-resistant, onchain-verifiable consensus
/// price, plus the Walrus evidence to check it without trusting us.
///
/// Tools:
///   get_card_price(card)      → consensus price + confidence + sources + evidence blob
///   list_markets()            → the live prediction markets (strike, consensus, onchain id)
///   get_market(card)          → market detail + onchain state + implied YES/NO
///   verify_evidence(blobId)   → re-runs the aggregation on the Walrus blob; "don't trust, verify"
///
/// Run:  node mcp-server.mjs        (stdio transport)
/// Add to a client's mcpServers config — see README "Use the oracle from any agent (MCP)".

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { verifyEvidence } from './walrus-evidence.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const API = process.env.SLABCLAW_PREDICT_API || 'https://api.slabclaw.com/predict';
const RPC = 'https://fullnode.testnet.sui.io:443';
const EXPLORER = 'https://suiscan.xyz/testnet';
const AGG = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs';
const usd = (c) => (c == null ? '—' : '$' + Math.round(c / 100).toLocaleString('en-US'));

const FLAG_PLAIN = {
  insufficient_sources: 'not enough independent sold-sources to settle yet — routes to the dispute path',
  thin_market: 'rare card — settled on 2 agreeing independent sources with an extended dispute window',
  wide_disagreement: 'sources disagree too much to settle safely',
  consensus_above_lowest_ask: 'consensus sits above the cheapest live listing (informational)',
  asks_above_consensus: 'current listings are above recent sold prices — market may be moving up',
  all_outliers: 'every source looked manipulated and was rejected',
  asks_only: 'only live listings available, no realized sales',
};

async function fetchConsensus() {
  const r = await fetch(`${API}/consensus`, { signal: AbortSignal.timeout?.(8000) });
  if (!r.ok) throw new Error(`consensus API ${r.status}`);
  const j = await r.json();
  return j.consensus || j.data?.consensus || {};
}

function findMarket(card) {
  const q = String(card || '').toLowerCase().trim();
  return DEMO_MARKETS.find((m) => m.productId.toLowerCase() === q)
    || DEMO_MARKETS.find((m) => m.name.toLowerCase() === q)
    || DEMO_MARKETS.find((m) => m.name.toLowerCase().includes(q) || (q && q.includes(m.name.toLowerCase())))
    || DEMO_MARKETS.find((m) => m.productId.toLowerCase().includes(q));
}

async function fetchMarketState(id) {
  try {
    const r = await fetch(RPC, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'sui_getObject', params: [id, { showContent: true }] }),
      signal: AbortSignal.timeout?.(8000),
    });
    const f = (await r.json())?.result?.data?.content?.fields;
    if (!f) return null;
    const raw = f.state?.variant ?? f.state;
    const STATES = { Active: 'ACTIVE', Proposed: 'PROPOSED', Disputed: 'DISPUTED', Settled: 'SETTLED', 0: 'ACTIVE', 1: 'PROPOSED', 2: 'DISPUTED', 3: 'SETTLED' };
    return { state: STATES[raw] ?? String(raw), expiryMs: Number(f.expiry_ms), strikeCents: Number(f.strike_usd_cents) };
  } catch { return null; }
}

// ── Tool logic (exported pure functions, so they're testable without MCP) ──

export async function getCardPrice(card) {
  const m = findMarket(card);
  if (!m) return { error: `No market for "${card}". Available: ${DEMO_MARKETS.map((x) => x.name).join(', ')}` };
  const consensus = await fetchConsensus();
  const c = consensus[m.productId];
  if (!c) return { error: `No consensus computed for ${m.name} yet.` };
  const sources = (c.contributingSources || []).filter((s) => s.kind !== 'ask').slice(0, 6).map((s) => ({
    venue: s.platform, price: usd(s.priceCents),
    learnedTrust: s.reliability != null ? Math.round(s.reliability * 100) + '%' : null,
  }));
  return {
    card: m.name, grade: `${m.grader} ${m.grade}`, productId: m.productId,
    consensusPrice: usd(c.consensusPriceCents),
    confidenceBand: c.confidenceLower != null ? `${usd(c.confidenceLower)} – ${usd(c.confidenceUpper)}` : null,
    independentSources: c.sourceCount,
    status: (c.flags || []).map((f) => FLAG_PLAIN[f] || f),
    sources,
    evidenceBlobId: c.evidence?.blobId || null,
    walrusVerifyUrl: c.evidence?.blobId ? `${AGG}/${c.evidence.blobId}` : null,
    note: c.evidence?.blobId
      ? 'Call verify_evidence with this evidenceBlobId to recompute the price yourself from the Walrus evidence — you do not have to trust the operator.'
      : undefined,
  };
}

export async function listMarkets() {
  const consensus = await fetchConsensus().catch(() => ({}));
  return DEMO_MARKETS.map((m) => {
    const c = consensus[m.productId];
    return {
      card: m.name, grade: `${m.grader} ${m.grade}`, productId: m.productId,
      strike: usd(m.strikeUsdCents), consensus: c ? usd(c.consensusPriceCents) : '—',
      marketObject: m.id, explorer: `${EXPLORER}/object/${m.id}`,
    };
  });
}

export async function getMarket(card) {
  const m = findMarket(card);
  if (!m) return { error: `No market for "${card}". Available: ${DEMO_MARKETS.map((x) => x.name).join(', ')}` };
  const consensus = await fetchConsensus().catch(() => ({}));
  const c = consensus[m.productId];
  const st = await fetchMarketState(m.id);
  const settle = c?.consensusPriceCents;
  const over = settle != null ? settle >= m.strikeUsdCents : null;
  return {
    card: m.name, grade: `${m.grader} ${m.grade}`, productId: m.productId,
    strike: usd(m.strikeUsdCents),
    consensus: settle != null ? usd(settle) : '—',
    impliedOutcome: over == null ? null : (over ? 'YES — consensus is above the strike' : 'NO — consensus is below the strike'),
    onchainState: st?.state ?? 'unknown',
    expiry: st?.expiryMs ? new Date(st.expiryMs).toISOString() : null,
    marketObject: m.id, explorer: `${EXPLORER}/object/${m.id}`,
    evidenceBlobId: c?.evidence?.blobId || null,
  };
}

export async function verifyEvidenceTool(blobId) {
  if (!blobId) return { error: 'blobId is required.' };
  const res = await verifyEvidence(blobId);
  return {
    blobId,
    verified: res.ok,
    summary: res.ok
      ? 'Re-ran the aggregation math on the evidence bundle\'s own source signals — the recomputed consensus MATCHES the stored prices for every card. The oracle did not lie.'
      : `MISMATCH on ${res.mismatches.length} card(s): the stored consensus does not match a fresh recomputation.`,
    mismatches: res.mismatches,
    note: 'verify_evidence downloads the public Walrus blob and recomputes the price from scratch. Anyone can do this — it is the whole point.',
  };
}

// ── MCP wiring ────────────────────────────────────────────────────────
const server = new McpServer({ name: 'slabclaw-oracle', version: '1.0.0' });
const asText = (obj) => ({ content: [{ type: 'text', text: JSON.stringify(obj, null, 2) }] });

server.registerTool('get_card_price', {
  title: 'Get graded-card price',
  description: 'Get the manipulation-resistant consensus price for a graded collectible card from SlabClaw\'s memory-backed oracle swarm, with the Walrus evidence blob to verify it.',
  inputSchema: { card: z.string().describe('Card name (e.g. "Dark Raichu", "Charizard") or productId (e.g. "base5-1st-83")') },
}, async ({ card }) => asText(await getCardPrice(card)));

server.registerTool('list_markets', {
  title: 'List prediction markets',
  description: 'List the live collectibles prediction markets on Sui testnet (card, strike, current consensus, onchain market object).',
  inputSchema: {},
}, async () => asText(await listMarkets()));

server.registerTool('get_market', {
  title: 'Get market detail',
  description: 'Get full detail for one collectibles prediction market: strike, consensus, implied YES/NO, onchain state and expiry, and the evidence blob.',
  inputSchema: { card: z.string().describe('Card name or productId') },
}, async ({ card }) => asText(await getMarket(card)));

server.registerTool('verify_evidence', {
  title: 'Verify a settlement (don\'t trust, verify)',
  description: 'Download a Walrus evidence blob and re-run the exact aggregation math on its source signals, confirming the published price was computed honestly.',
  inputSchema: { blobId: z.string().describe('Walrus evidence blob id (from get_card_price or get_market)') },
}, async ({ blobId }) => asText(await verifyEvidenceTool(blobId)));

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('slabclaw-oracle MCP server ready (stdio) — tools: get_card_price, list_markets, get_market, verify_evidence');
}

const isMain = (() => { try { return import.meta.url === `file://${process.argv[1]}`; } catch { return false; } })();
if (isMain) main().catch((e) => { console.error('fatal:', e.message); process.exit(1); });
