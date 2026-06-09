#!/usr/bin/env node
/// bridge.mjs — SlabClaw oracle bridge daemon.
///
/// The off-chain half of the loop: for every live market it reads the GENUINE
/// SlabClaw exact-product PSA-10 oracle (cross-grade stripped, the same value
/// the app shows) and — once a market is past expiry — submits an on-chain
/// `propose_resolution` with the real price + source count. After the 24h
/// dispute window anyone can `finalize`; winners `claim`.
///
/// Usage:
///   node bridge.mjs                 # one status pass + auto-propose expired markets
///   node bridge.mjs --watch [sec]   # poll loop (default 60s)
///   node bridge.mjs --dry           # status only, never propose

import { getClient, fetchOraclePrice, proposeResolution } from './sui-client.mjs';
import { CONFIG, marketStateCode } from './config.mjs';
import { DEMO_MARKETS } from '../frontend/src/constants.js';

const STATE = { 0: 'ACTIVE', 1: 'PROPOSED', 2: 'DISPUTED', 3: 'SETTLED' };
const args = process.argv.slice(2);
const WATCH = args.includes('--watch');
const DRY = args.includes('--dry');
const INTERVAL = (parseInt(args.find((a) => /^\d+$/.test(a)), 10) || 60) * 1000;

const usd = (c) => '$' + (c / 100).toLocaleString('en-US', { maximumFractionDigits: 0 });
const dur = (ms) => {
  if (ms <= 0) return 'EXPIRED';
  const d = Math.floor(ms / 86400000), h = Math.floor((ms % 86400000) / 3600000);
  return d > 0 ? `${d}d ${h}h` : `${h}h ${Math.floor((ms % 3600000) / 60000)}m`;
};

async function readMarket(client, id) {
  const o = await client.getObject({ id, options: { showContent: true } });
  const f = o?.data?.content?.fields;
  if (!f) return null;
  return {
    id,
    state: marketStateCode(f.state),
    strikeCents: Number(f.strike_usd_cents),
    expiryMs: Number(f.expiry_ms),
    totalYes: Number(f.total_yes),
    totalNo: Number(f.total_no),
  };
}

async function pass(client) {
  const now = Date.now();
  console.log(`\n[bridge] ${new Date(now).toISOString()}  oracleCap=${CONFIG.oracleCapId?.slice(0, 10)}…`);
  console.log('─'.repeat(92));
  console.log(['card'.padEnd(16), 'state'.padEnd(9), 'oracle'.padEnd(9), 'strike'.padEnd(9), 'side'.padEnd(5), 'expires'.padEnd(10), 'action'].join(' '));
  console.log('─'.repeat(92));

  for (const m of DEMO_MARKETS) {
    const mkt = await readMarket(client, m.id);
    if (!mkt) { console.log(`${m.name.padEnd(16)} <not found on-chain>`); continue; }
    const oracle = await fetchOraclePrice(m.productId, m.grader, m.grade);
    const oStr = oracle.ok ? usd(oracle.priceCents) : '—';
    const side = oracle.ok ? (oracle.priceCents > mkt.strikeCents ? 'YES' : 'NO') : '?';
    const expd = mkt.expiryMs - now;

    let action = '';
    const expired = expd <= 0;
    const canPropose = expired && mkt.state === 0 && oracle.ok;
    if (mkt.state === 3) action = 'settled';
    else if (mkt.state === 1) action = 'in dispute window';
    else if (mkt.state === 2) action = 'disputed';
    else if (!expired) action = 'live';
    else if (!oracle.ok) action = 'NO ORACLE';
    else if (oracle.sources < 3) action = `only ${oracle.sources} sources`;
    else action = DRY ? 'would propose' : 'PROPOSING…';

    console.log([
      m.name.padEnd(16), (STATE[mkt.state] || '?').padEnd(9), oStr.padEnd(9),
      usd(mkt.strikeCents).padEnd(9), side.padEnd(5), dur(expd).padEnd(10), action,
    ].join(' '));

    if (canPropose && !DRY && oracle.sources >= 3) {
      try {
        const r = await proposeResolution({
          oracleCapId: CONFIG.oracleCapId, marketId: m.id,
          priceUsdCents: oracle.priceCents, sourcesCount: oracle.sources,
        });
        console.log(`   ↳ proposed ${usd(oracle.priceCents)} (${oracle.sources} sources, ${oracle.oracleSource}, via ${oracle.via}) — ${r.digest}`);
      } catch (e) {
        console.log(`   ↳ propose failed: ${e.message.slice(0, 90)}`);
      }
    }
  }
}

async function main() {
  if (!CONFIG.oracleCapId) { console.error('No oracleCapId in config — run authorize_oracle first.'); process.exit(1); }
  const client = getClient();
  await pass(client);
  if (WATCH) {
    console.log(`\n[bridge] watching every ${INTERVAL / 1000}s — Ctrl-C to stop`);
    setInterval(() => pass(client).catch((e) => console.error('pass error:', e.message)), INTERVAL);
  }
}

main().catch((e) => { console.error('Fatal:', e.message); process.exit(1); });
