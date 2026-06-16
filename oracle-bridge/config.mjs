/// config.mjs — Deployment configuration for SlabClaw Predict oracle bridge.
/// All object IDs from testnet deployment.

export const CONFIG = {
  // Sui network
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  // Package + objects from the HARDENED + FORMALLY-VERIFIED deployment (redeployed
  // 2026-06-16 to ship the settled_pool claim fix — pool snapshotted at finalize so
  // every winner is paid from a fixed pool, never the live shrinking one). Onchain
  // version-gating, governance ProtocolConfig, enum state, Sui-Prover-verified payout,
  // and a first-class evidence_blob_id (markets cannot settle without a Walrus blob).
  // (Prev pkg 0x9807050b… retired; the struct change is upgrade-incompatible.)
  packageId: '0x616ef59e783935b976db451f4a7087e89ac1c76190c3f91e929226ba3ce2bd76',
  adminCapId: '0x97b908e0e57aeb8a8e7971593fc950e2091c3f69a7ff3247a68641f336c5fc1f',
  registryId: '0x3295fe9c7c40f4dbe7560f4d988c3bf1bb7e7f4ea5c8cc9c862b97b1b7829859',

  // Governance config — admin-tunable dispute bond / window / source floor.
  // propose_resolution snapshots its terms into each market at proposal time.
  configId: '0xa88ad739248cbea400254ad91c63d0b8551e470e76d98fa3bd9ec3034fb26956',

  // Shared faucet holding the TEST_USD treasury (public mint)
  faucetId: '0x430c1d7ed1c5ab589b73530db09122b7820a4767a9329db3044143fb9f7f3b8b',
  testUsdType: '0x616ef59e783935b976db451f4a7087e89ac1c76190c3f91e929226ba3ce2bd76::test_usd::TEST_USD',

  // OracleCap — authorized oracle operator on the hardened package (2026-06-09).
  oracleCapId: '0x32305051db6e9f5352d8920c16dab4ec52cbb3fd58dfb9016e1505b37f429914',

  // UpgradeCap for the hardened package (used by migrate_* after future upgrades)
  upgradeCapId: '0x251af869eb68fa96eda314cc7e913304f93da5ad28b6ef4c929fd7319fab7d52',

  // The `memory` module now ships in the single fresh package (no upgrade split):
  // packageIdV2 === packageId. memory::* calls go through the same package id.
  packageIdV2: '0x616ef59e783935b976db451f4a7087e89ac1c76190c3f91e929226ba3ce2bd76',
  // Shared SwarmMemory object — the canonical onchain pointer to the swarm's
  // latest memory snapshot on Walrus ("memory that outlives its operator").
  swarmMemoryId: '0xf31c41b1b68b6607fa68ef504e9332b129825957d21294f9483e6805214c8883',

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
