/// config.mjs — Deployment configuration for SlabClaw Predict oracle bridge.
/// All object IDs from testnet deployment.

export const CONFIG = {
  // Sui network
  rpcUrl: 'https://fullnode.testnet.sui.io:443',

  // Package + objects from deployment
  packageId: '0x4b9ff1da0e53e129e711ff0a0a8b1c532734f27f2b9f6eb3eadd383cb1b77368',
  adminCapId: '0x14b5855d11c30364983c2b12b71a73644ff7a906c0fe7320fe1a5085fd5852b7',
  registryId: '0xd3ad92dd510c3bdcd4d600140a6425d0b205a54fe8b9dcd5ad4c5f0991713819',

  // OracleCap — authorized oracle operator
  oracleCapId: '0x4c293a92e3baea5730fd7188efbe3a8165e9b812f1937c779f071e5bb80c1a39',

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
