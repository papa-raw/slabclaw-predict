/// config.mjs — Deployment configuration for SlabClaw Predict oracle bridge.
/// All object IDs from testnet deployment.

export const CONFIG = {
  // Sui network
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  // Package + objects from TEST_USD deployment (2026-06-07, settles in tUSD)
  packageId: '0xdc18fc79030aea4a39198d95c73271c41d955b3b548dc5090627bf224af7b141',
  adminCapId: '0xb7034e084e679df692432a398fbe48d9b6545802ec0740bfedb7addaf4ec4668',
  registryId: '0x4ce60524409d492d25c46c4d03eb0fa884f51bbdecb4412093723b54b215da3d',

  // Shared faucet holding the TEST_USD treasury (public mint)
  faucetId: '0x53100cc63e89f2a600b65af0efa894f22b20de78f455cafc4f0713c51c26c671',
  testUsdType: '0xdc18fc79030aea4a39198d95c73271c41d955b3b548dc5090627bf224af7b141::test_usd::TEST_USD',

  // OracleCap — authorized via authorize_oracle after deploy (filled by seed script)
  oracleCapId: null,

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
