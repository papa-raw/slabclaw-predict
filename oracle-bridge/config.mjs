/// config.mjs — Deployment configuration for SlabClaw Predict oracle bridge.
/// All object IDs from testnet deployment.

export const CONFIG = {
  // Sui network
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  // Package + objects from the HARDENED + FORMALLY-VERIFIED deployment (2026-06-09):
  // onchain version-gating, governance ProtocolConfig, enum state, scope-fixed
  // emergency_refund, and a Sui-Prover-verified payout. evidence_blob_id remains a
  // first-class field — markets cannot settle without a Walrus blob.
  // (Prev evidence pkg 0x66debb86… retired; struct/signature changes are upgrade-incompatible.)
  packageId: '0x9807050b60400d30c848dcf035a2038b615ffdb7d6d2ed46332959d39b14f115',
  adminCapId: '0x440584ef9721924d6832345e42da6f804108d7cea5362b6cf59d094468ac1634',
  registryId: '0x18c19b198a263421ff7882af139ce3645bc1a94c7d4f6ab715e318dd44fc108a',

  // Governance config — admin-tunable dispute bond / window / source floor.
  // propose_resolution snapshots its terms into each market at proposal time.
  configId: '0xecbaca290e63b931dce3014cb71d85bad2af75083625331942b0a72a23e64bc3',

  // Shared faucet holding the TEST_USD treasury (public mint)
  faucetId: '0xa1e2ca665f6d2b8aa11d5a6caf0d3cc4d88da68b942991a007c87d0b516c8870',
  testUsdType: '0x9807050b60400d30c848dcf035a2038b615ffdb7d6d2ed46332959d39b14f115::test_usd::TEST_USD',

  // OracleCap — authorized oracle operator on the hardened package (2026-06-09).
  oracleCapId: '0x2a859611dfb8279c46a3d211227ceb43a4ca4aae444269cc016e6fa966bb44b7',

  // UpgradeCap for the hardened package (used by migrate_* after future upgrades)
  upgradeCapId: '0x8d918a08746ac1bd1cc25813e00ab6b369cc6b242995ce5a06ccd3ace54fdc06',

  // v2 upgrade (2026-06-10): adds the `memory` module — the onchain anchor for
  // MemWal snapshots. Calls to memory::* go through the v2 package id; all
  // original types/objects keep the original packageId above.
  packageIdV2: '0x2bfc147c040cdf194a1c959b8843404d767c706f9d3abf6a1f74d06731117c64',
  // Shared SwarmMemory object — the canonical onchain pointer to the swarm's
  // latest memory snapshot on Walrus ("memory that outlives its operator").
  swarmMemoryId: '0x41dfc599a161c5ba620d56b051b3ac92ba1db189c83ed7ce4f863740ae54649d',

  // SlabClaw backend API (override with SLABCLAW_API when the registry
  // serves on a different port, e.g. on the production VPS)
  slabclawApi: process.env.SLABCLAW_API || 'http://localhost:3456',

  // Module names
  modules: {
    registry: 'registry',
    oracle: 'oracle',
    market: 'market',
  },

  // Clock object (system)
  clockId: '0x6',
};

/// Map SlabClaw product IDs to on-chain asset IDs.
/// Format: SET_NAME_NUMBER_GRADER_GRADEBPS
export function toAssetId(productId, grader, grade) {
  const clean = productId
    .replace(/[^a-zA-Z0-9]/g, '_')
    .toUpperCase();
  const gradeBps = Math.round(grade * 100);
  return `${clean}_${grader.toUpperCase()}_${gradeBps}`;
}

/// Convert grade to basis points (10.0 → 1000, 9.5 → 950)
export function gradeToBps(grade) {
  return Math.round(grade * 100);
}

/// Convert USD price to cents (15000.00 → 1500000)
export function priceToCents(priceUsd) {
  return Math.round(priceUsd * 100);
}

/// Map the onchain MarketState to its numeric code (0=Active,1=Proposed,2=Disputed,3=Settled).
/// The Move 2024 enum serializes over JSON-RPC as { variant: 'Proposed', ... }; the legacy
/// u8 came through as a number/string. Handle both so state checks never silently fail.
export function marketStateCode(s) {
  const CODE = { Active: 0, Proposed: 1, Disputed: 2, Settled: 3 };
  if (s && typeof s === 'object' && s.variant) return CODE[s.variant] ?? 0;
  return Number(s);
}
