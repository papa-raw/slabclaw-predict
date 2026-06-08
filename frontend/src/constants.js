/// SlabClaw Predict — onchain constants and config.

// EVIDENCE deployment (2026-06-08). Markets settle in faucet-minted tUSD AND
// cannot settle without a verifiable Walrus evidence blob referenced onchain.
export const PACKAGE_ID = '0x66debb86ea160e10334a3fba2d5afd07660d15e307037f7b1665535e4d9a802a';
export const REGISTRY_ID = '0x8dedbb371903b9fec334aaab1f10fc8275962209e2aa386914b9664fbb8d8f48';
export const FAUCET_ID = '0xaebce6a9a79cef13c660f2a17fbcf3f4723a1939757a32f59ac023ad8aebdf79';
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
// off-chain oracle/evidence layer can hydrate each market (live + snapshot).
export const DEMO_MARKETS = [
  {
    id: '0x372e2f8f29980077ebb199236c7e976adb527aa29e4d716c73d91266139e2181',
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
    id: '0xbeef11f535c89d972ac0c0efdfbdfcf8e280e8707907f17fedee9f552434019d',
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
    id: '0xa6aebeead1c6741a8740b3d3f3e333432404dd468b093de3559f448eac85a38a',
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
    id: '0xaf7c5ab1d7c41dc20be9b488445e8f748a5203373da9c6c633bfa2fa7c9b732f',
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
