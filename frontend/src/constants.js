/// SlabClaw Predict — onchain constants and config.

// TEST_USD deployment (2026-06-07). Markets settle in faucet-minted tUSD.
export const PACKAGE_ID = '0xdc18fc79030aea4a39198d95c73271c41d955b3b548dc5090627bf224af7b141';
export const REGISTRY_ID = '0x4ce60524409d492d25c46c4d03eb0fa884f51bbdecb4412093723b54b215da3d';
export const FAUCET_ID = '0x53100cc63e89f2a600b65af0efa894f22b20de78f455cafc4f0713c51c26c671';
export const TEST_USD_TYPE = `${PACKAGE_ID}::test_usd::TEST_USD`;
export const CLOCK_ID = '0x6';

// Faucet drip + bet denomination (tUSD has 9 decimals, mirrors MIST).
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
    id: '0x6d2131461188679225353fb3c299cc16a761e575b68d7b246d9672b025fc5253',
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
    id: '0x9ff720825c07801568a46dede7e6f8f54b16b90077e5dc0bf287483661fdc44e',
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
    id: '0x87a8163df2c4667140f88869df65825182609e633e3b9d772ab6e3a92b6bcade',
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
    id: '0x2dae76174f4acb3a543c9701940420da1ff2f05a2733fb794a7366e22ea5fd58',
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
