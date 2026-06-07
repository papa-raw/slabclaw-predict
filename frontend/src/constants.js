/// SlabClaw Predict — on-chain constants and config.

export const PACKAGE_ID = '0x4b9ff1da0e53e129e711ff0a0a8b1c532734f27f2b9f6eb3eadd383cb1b77368';
export const REGISTRY_ID = '0xd3ad92dd510c3bdcd4d600140a6425d0b205a54fe8b9dcd5ad4c5f0991713819';
export const CLOCK_ID = '0x6';

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

// Hardcoded testnet markets for demo (read from chain in production)
export const DEMO_MARKETS = [
  {
    id: '0x18b66b969c73540f13f0e8a1e0d3e52dd851846426a7f3c23da780753b12d1a5',
    assetId: 'BASE1_4_PSA_1000',
    name: 'Charizard',
    set: 'Base Set',
    number: '4',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 700000,
    expiryMs: 1783409438449,
    image: 'https://images.pokemontcg.io/base1/4.png',
    productId: 'base1-4',
  },
  {
    id: '0xc6fa8bd10463d6bbf34a1b47c78d266ffa5d1c9f28e07f5bcca1efa4ebb83d7b',
    assetId: 'JP_VS_091_PSA_1000',
    name: "Karen's Umbreon",
    set: 'Pokemon Card VS',
    number: '091',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 1500000,
    expiryMs: 1783409438449,
    image: 'https://storage.googleapis.com/images.pricecharting.com/93ce0926881c51b6c05f154908369f0d8832e13c0d12a632f366b0d7ebbdf90f/240.jpg',
    productId: 'jp-vs-091',
  },
  {
    id: '0x232b13e7c776a2b120be6d05679f199eac0d4b388bf022ffa53d78a31a513909',
    assetId: 'BASE3_1ST_5_PSA_1000',
    name: 'Gengar 1st Edition',
    set: 'Fossil',
    number: '5',
    grader: 'PSA',
    grade: 10,
    strikeUsdCents: 15000,
    expiryMs: 1783409440632,
    image: 'https://images.pokemontcg.io/base3/5.png',
    productId: 'base3-1st-5',
  },
];
