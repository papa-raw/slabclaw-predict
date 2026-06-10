/// SlabClaw Predict — onchain constants and config.

// HARDENED + FORMALLY-VERIFIED deployment (2026-06-09). Onchain version-gating,
// governance ProtocolConfig, enum state, and a Sui-Prover-verified payout. Markets
// settle in faucet-minted tUSD and cannot settle without a Walrus evidence blob.
export const PACKAGE_ID = '0x9807050b60400d30c848dcf035a2038b615ffdb7d6d2ed46332959d39b14f115';
export const REGISTRY_ID = '0x18c19b198a263421ff7882af139ce3645bc1a94c7d4f6ab715e318dd44fc108a';
export const FAUCET_ID = '0xa1e2ca665f6d2b8aa11d5a6caf0d3cc4d88da68b942991a007c87d0b516c8870';
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
    id: '0xf63f37a07f61a38c78b3ea6d650315e903a6192b767c34cfc5a8a2266c1144ea',
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
    id: '0x2da84029427ff70dfafadb8643d4f3a83f76f5344bd1de05c1902cff102c9720',
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
    id: '0xa291d583f9c2297b002298f033260ab7bc698af378539aa3564001254e72fdd7',
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
    id: '0x9700623a1e977a179b011908da25e7800d682e4bc8dd38929ac7bc121c459b71',
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
