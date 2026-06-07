# SlabClaw Predict

Prediction markets for physical collectibles on Sui. Binary markets settle against real-world price data from SlabClaw's 10-platform oracle.

> "Will PSA 10 Base Set Charizard exceed $7,000 by July 2026?" -- YES/NO, on-chain, settled with real marketplace data.

**Sui Overflow 2026** | DeepBook Track

## Architecture

```
SlabClaw Oracle (off-chain)                Frontend (React + dapp-kit)
  10 platforms, 5,167 cards                   Browse markets, trade YES/NO
  eBay, PWCC, MySlabs, Goldin,               Connect wallet (Slush/Suiet)
  Alt, COMC, Courtyard...                     Real-time oracle prices
         |                                            |
         v                                            v
  Oracle Bridge (Node.js)  ------>  Move Contracts (Sui Testnet)
  Reads prices, proposes                market.move   - binary market factory
  settlement on-chain                   oracle.move   - oracle authorization
                                        registry.move - asset class registry
```

### How It Works

1. **Market creation** -- Define a binary prediction: asset, strike price, expiry date
2. **Trading** -- Users buy YES or NO positions with SUI (parimutuel pool)
3. **Oracle settlement** -- After expiry, the oracle proposes the real price from aggregated marketplace data
4. **Dispute window** -- 24 hours for anyone to dispute the proposed price (UMA-style optimistic resolution)
5. **Payout** -- Undisputed resolution auto-finalizes; winning positions claim from the pool

### Minimum position: 0.001 SUI (testnet)

## Live Markets (Testnet)

| Card | Strike | Market ID |
|------|--------|-----------|
| PSA 10 Charizard (Base Set) | $7,000 | `0x18b6...d1a5` |
| PSA 10 Karen's Umbreon (VS) | $15,000 | `0xc6fa...3d7b` |
| PSA 10 Gengar 1st Ed (Fossil) | $150 | `0x232b...3909` |

Package: [`0x4b9ff1da0e53e129e711ff0a0a8b1c532734f27f2b9f6eb3eadd383cb1b77368`](https://suiscan.xyz/testnet/object/0x4b9ff1da0e53e129e711ff0a0a8b1c532734f27f2b9f6eb3eadd383cb1b77368)

## Project Structure

```
contracts/slabclaw_predict/
  sources/
    market.move       Binary market factory + optimistic resolution
    oracle.move       Oracle authorization + price attestations
    registry.move     Asset class registry (set, number, grader, grade)
  tests/
    market_tests.move
    oracle_tests.move
    registry_tests.move

oracle-bridge/
  config.mjs          Deployment IDs + helpers
  sui-client.mjs      Sui transaction builders
  demo.mjs            Market creation + demo positions

frontend/
  src/
    App.jsx           Market grid + trading flow
    components/       Header, MarketCard, TradingPanel
    hooks/            useMarket (on-chain), useOracle (off-chain prices)
    lib/              Sui transaction builders
    constants.js      Package IDs, market data
```

## Development

### Move Contracts

```bash
cd contracts/slabclaw_predict
sui move build
sui move test     # 16/16 tests
sui client publish --gas-budget 100000000
```

### Oracle Bridge

```bash
cd oracle-bridge
npm install
node demo.mjs     # Register assets, create markets, place demo positions
```

### Frontend

```bash
cd frontend
npm install
npm run dev       # Vite dev server on localhost:5173
```

The frontend proxies `/api/*` to `localhost:3456` (SlabClaw backend) for live oracle prices.

## Oracle Data

SlabClaw aggregates prices from 10 platforms across the graded collectibles market:

- eBay (sold listings)
- PWCC Marketplace
- MySlabs
- Goldin Auctions
- Alt (formerly PWCC Vault)
- COMC
- Courtyard.io
- PriceCharting (sold data)
- Mavin
- CardMarket

The oracle produces a weighted median price per card/grade combination, used to settle prediction markets at expiry.

## Tech Stack

- **Sui Move** -- Smart contracts (2024 edition)
- **React + Vite** -- Frontend with Tailwind CSS
- **@mysten/dapp-kit** -- Wallet connection + transaction signing
- **@mysten/sui** -- RPC client for on-chain reads

## License

All rights reserved. This repository is public for hackathon judging purposes only. No license is granted to use, copy, modify, or distribute this code without explicit written permission from the author.
