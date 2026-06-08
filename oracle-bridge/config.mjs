/// config.mjs — Deployment configuration for SlabClaw Predict oracle bridge.
/// All object IDs from testnet deployment.

export const CONFIG = {
  // Sui network
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  // Package + objects from EVIDENCE deployment (2026-06-08): evidence_blob_id is
  // now a first-class onchain field — markets cannot settle without a Walrus blob.
  // (Prev TEST_USD pkg 0xdc18fc79… retired; it lacked onchain evidence.)
  packageId: '0x66debb86ea160e10334a3fba2d5afd07660d15e307037f7b1665535e4d9a802a',
  adminCapId: '0x3601cdc3e240f8c7d9f368e5315677b0bd2f01bb4cb0a3d6e981c5967e98ef90',
  registryId: '0x8dedbb371903b9fec334aaab1f10fc8275962209e2aa386914b9664fbb8d8f48',

  // Shared faucet holding the TEST_USD treasury (public mint)
  faucetId: '0xaebce6a9a79cef13c660f2a17fbcf3f4723a1939757a32f59ac023ad8aebdf79',
  testUsdType: '0x66debb86ea160e10334a3fba2d5afd07660d15e307037f7b1665535e4d9a802a::test_usd::TEST_USD',

  // OracleCap — authorized oracle operator on the evidence package (2026-06-08)
  oracleCapId: '0xe7d28be03e6360be34d84a3c42d58e821d8dd4ca96ede9c776f514ec1006ebd8',

  // UpgradeCap for the evidence package (kept for future compatible upgrades)
  upgradeCapId: '0xf34cf3fe5271dd3ff3e544d48a8fc7cb236f69dfbae203f04742f32efaa4d063',

  // SlabClaw backend API
  slabclawApi: 'http://localhost:3456',

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
