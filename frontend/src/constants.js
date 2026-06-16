/// SlabClaw Predict — onchain constants and config.

// HARDENED + FORMALLY-VERIFIED deployment (redeployed 2026-06-16 to ship the
// settled_pool claim fix — pool snapshotted at finalize so every winner is paid
// from a fixed pool). Onchain version-gating, governance ProtocolConfig, enum
// state, Sui-Prover-verified payout. Markets settle in faucet-minted tUSD and
// cannot settle without a Walrus evidence blob.
export const PACKAGE_ID = '0x616ef59e783935b976db451f4a7087e89ac1c76190c3f91e929226ba3ce2bd76';
export const REGISTRY_ID = '0x3295fe9c7c40f4dbe7560f4d988c3bf1bb7e7f4ea5c8cc9c862b97b1b7829859';
export const FAUCET_ID = '0x430c1d7ed1c5ab589b73530db09122b7820a4767a9329db3044143fb9f7f3b8b';
export const TEST_USD_TYPE = `${PACKAGE_ID}::test_usd::TEST_USD`;
export const CLOCK_ID = '0x6';

// Faucet drip + trade denomination (tUSD has 9 decimals, mirrors MIST).
export const USD_DECIMALS = 9;
export const FAUCET_DRIP = 10_000; // tUSD per faucet click

export const NETWORK = 'testnet';
export const RPC_URL = 'https://fullnode.testnet.sui.io:443';
export const EXPLORER_URL = 'https://suiscan.xyz/testnet';

// Market states
export const MARKET_STATE = {
  0: 'Active',
  1: 'Proposed',
  2: 'Disputed',
  3: 'Settled',
};

export const MARKET_STATE_COLORS = {
  0: 'text-sc-yes',
  1: 'text-sc-warn',
  2: 'text-sc-no',
  3: 'text-sc-muted',
};

// Era metadata for the navbar KPI strip (mirrors registry.html). Keyed to
// /api/registry/era-trends ("base", "rocket", "neo", "ecard", "promo").
export const ERAS = [
  { key: 'base', label: 'Base' },
  { key: 'rocket', label: 'Rocket' },
  { key: 'neo', label: 'Neo' },
  { key: 'ecard', label: 'e-Card' },
  { key: 'promo', label: 'Promo' },
];

// Testnet markets. `productId` MUST match a SlabClaw registry id so the
// offchain oracle/evidence layer can hydrate each market (live + snapshot).
export const DEMO_MARKETS = [
  {
    id: '0xa0d4021e89140c8d1fe6ccacca596e1c72e22281fa49fff22bbff54ac8c001ae',
    assetId: 'NEO1_1ST_18_PSA_1000',
    name: 'Typhlosion',
    set: 'Neo Genesis — 1st Edition',
    year: 2000,
    number: '18',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 400000,
    edition: '1st Edition',
    language: 'en',
    image: 'https://images.pokemontcg.io/neo1/18.png',
    productId: 'neo1-1st-18',
  },
  {
    id: '0x3cb150d18f5a7cc1764c1ec52eac41d2905bfc47cde2bb075d217ef49d3c0bad',
    assetId: 'JP_VS_091_PSA_1000',
    name: "Karen's Umbreon",
    set: 'Pokémon Card VS — 1st Edition',
    year: 2001,
    number: '091',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 1500000,
    chartStartMs: 1759276800000, // start chart at Oct 1, 2025
    edition: '1st Edition',
    language: 'ja',
    image: '/cards/jp-vs-091.jpg',
    productId: 'jp-vs-091',
  },
  {
    id: '0xb8f8751687f1f71eb6f81a7122bdb13a9db7fa0da036203355385d6f4374af12',
    assetId: 'BASE5_1ST_83_PSA_1000',
    name: 'Dark Raichu',
    set: 'Team Rocket — 1st Edition',
    year: 2000,
    number: '83',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 600000,
    edition: '1st Edition',
    language: 'en',
    image: 'https://images.pokemontcg.io/base5/83.png',
    productId: 'base5-1st-83',
  },
  {
    id: '0x1750bdd11a60f777716a15d54e48caff8ae4d6baca94124c5bf0223a6d503788',
    assetId: 'BASE2_1ST_3_PSA_1000',
    name: 'Flareon',
    set: 'Jungle — 1st Edition',
    year: 1999,
    number: '3',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 250000,
    edition: '1st Edition',
    language: 'en',
    image: 'https://images.pokemontcg.io/base2/3.png',
    productId: 'base2-1st-3',
  },
];
