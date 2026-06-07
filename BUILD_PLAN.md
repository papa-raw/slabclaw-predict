# SlabClaw Predict — Build Plan

> Sui Overflow 2026 | DeepBook Track ($70K) | Deadline: Jun 21, 2026
> **Today: Jun 6** — 15 days remaining

---

## Critical Discovery: DeepBook Predict Architecture

From API research (agent a3ecd0e), the DeepBook Predict system on testnet:

- **3,647 total oracles** — ALL for BTC (no other assets yet)
- **3,640 settled, 7 active** — Block Scholes operates the oracle
- **Testnet server live** at `predict-server.testnet.mystenlabs.com`
- **19 pipelines tracked**: predict_created, oracle_created, oracle_prices_updated, oracle_settled, position_minted, position_redeemed, range_minted, range_redeemed, etc.
- **SDK**: `@mysten/deepbook-v3` v1.4.1, has Predict-specific methods
- **Sandbox**: Docker-based localnet with Sui node, oracle service (Pyth), market maker, indexer, postgres, dashboard
- **Example contract template** exists in the sandbox repo

**Key insight**: DeepBook Predict uses Block Scholes as the oracle provider. All current markets are crypto (BTC). We'd be the first non-crypto oracle + the first real-world asset prediction market on the platform. This is exactly what judges want to see.

**Integration approach**: We do NOT replace Block Scholes. We create our own oracle (OracleCap) that feeds into DeepBook Predict's settlement mechanism. Our Move contracts bridge SlabClaw's off-chain price data into DeepBook's on-chain oracle format.

---

## Oracle Security Assessment (Critical — From Adversarial Audit)

The adversarial audit (agent a0f8f6e) identified 12 attack vectors. Top 3 that MUST be addressed:

### Risk 1: Oracle Operator Compromise (25/25)
The oracle is single-operator, single-machine, no signing, no multi-sig. `CORS: *`, no auth on API. A single `sqlite3` command changes any settlement price.

**Hackathon fix**: Signed settlement endpoint + API auth + oracle staleness check.

### Risk 2: Low-Liquidity Manipulation (25/25)
Oracle uses avg of last 3 sales in 30 days. Many cards have 0-2 sales. A single wash trade ($200-$3K in eBay fees) can flip settlement.

**Hackathon fix**: Minimum 3 independent sales for settlement. 7-day TWAP instead of point-in-time. Refuse to settle low-liquidity cards.

### Risk 3: PriceCharting as Single Point of Failure (20/25)
Tier 1 (pc_sold) unconditionally overwrites all other tiers. Fake eBay sold comps flow through PriceCharting into our oracle unfiltered.

**Hackathon fix**: Cross-source validation for settlement. Require 2+ independent sources to agree within 20%.

### Minimum Viable Oracle Security (for demo)
1. `/api/settlement/:productId/:grade` endpoint with server-signed responses
2. Minimum liquidity gate (< 3 recent sales = `insufficient_liquidity`)
3. 7-day TWAP from `price_observations` table
4. API key auth on settlement endpoints
5. Oracle staleness rejection (> 72h = stale)

These 5 changes are the difference between "portfolio tracker repurposed as oracle" and "settlement-grade price feed." They're achievable in a day of work.

---

## Design Research Summary (From UI Research)

Key patterns from Polymarket, Kalshi, and Manifold:

### Market Card (the atomic unit)
```
┌──────────────────────────────────────┐
│  [Card Image]  PSA 10 Base Set       │
│               Charizard #4           │
│                                      │
│  Will price exceed $15,000           │
│  by December 2026?                   │
│                                      │
│  YES 67%  ████████░░░  NO 33%        │
│                                      │
│  $12,450 current oracle              │
│  Volume: $8,200 | Expires: Dec 31    │
│  ┌─────────┐  ┌─────────┐           │
│  │  Buy YES │  │  Buy NO │           │
│  └─────────┘  └─────────┘           │
└──────────────────────────────────────┘
```

### Key UI Decisions
1. **Card image + grade badge** in every market card (our visual advantage over text-only prediction markets)
2. **Oracle price prominently displayed** — real-time price from our 10-platform feed
3. **Probability bar** (YES/NO split) as the primary visual
4. **Price chart** showing oracle history overlaid with strike price line
5. **Resolution status indicator**: Active → Proposed → Dispute Window → Settled
6. **Mobile-first** — prediction markets are mobile-heavy

### Page Structure (React + Vite, fork from Anima Swarm)
1. **Markets** — browse/filter active markets by set, grader, grade, expiry
2. **Market Detail** — chart, order book depth, position management, resolution status
3. **Portfolio** — user's open positions, P&L
4. **Oracle** — price feed dashboard, settlement history, dispute status

---

## Phase-by-Phase Build Sequence

### Phase 1: Move Contracts (Days 1-3)

Already done: `registry.move` (asset class registry).

**Next: `oracle.move`**
```
Objects:
- OracleCap (capability — authorizes price proposals)
- PriceProposal (shared — holds proposed price + timestamp + evidence hash)

Functions:
- propose_price(cap, registry, asset_id, price_bps, timestamp, evidence_hash)
- get_latest_price(registry, asset_id) -> (price, timestamp, proposer)
```

**Next: `resolution.move`** (UMA-style optimistic oracle)
```
Objects:
- Resolution (shared — tracks dispute state machine)
- DisputeBond (escrow — SUI staked by disputer)
- VoterBallot (owned — tracks individual votes)

State machine:
  Proposed → (24h no dispute) → Accepted → Settled
  Proposed → Disputed → Voting (48h) → Resolved → Settled

Functions:
- propose_resolution(oracle_cap, market_id, outcome, evidence_hash)
- dispute(resolution, bond_sui, evidence_hash)
- vote(resolution, ballot_sui, vote_yes: bool)
- finalize(resolution) — auto-settle if dispute window passed
- settle(resolution) — count votes, distribute bonds
```

**Next: `market.move`** (market factory)
```
Objects:
- PredictionMarket (shared — defines the binary question)
  - asset_id, strike_price_bps, expiry_timestamp
  - resolution_status, outcome

Functions:
- create_market(admin_cap, registry, asset_id, strike_bps, expiry_ts, description)
- resolve_market(oracle_cap, market, resolution)

DeepBook Predict integration:
- Bridge our Resolution outcome to DeepBook Predict settlement
- This is the key composability — our oracle settles DeepBook positions
```

**Build verification:**
```bash
cd contracts/slabclaw_predict
sui move build
sui move test
```

### Phase 2: Oracle Bridge Service (Days 3-4)

Off-chain Node.js service that reads SlabClaw prices and submits on-chain.

```
oracle-bridge/
├── package.json
├── src/
│   ├── index.mjs          # Main loop
│   ├── price-reader.mjs   # Reads from SlabClaw API (with auth)
│   ├── settlement.mjs     # Computes TWAP, liquidity checks
│   ├── sui-client.mjs     # Submits on-chain transactions
│   └── config.mjs         # Asset mappings, thresholds
```

Key functions:
1. Poll SlabClaw API `/api/settlement/:productId/:grade` every 6 hours
2. Compute 7-day TWAP from price history
3. Check minimum liquidity (>= 3 independent sales)
4. Submit `propose_price` transaction via `@mysten/sui` SDK
5. At market expiry: submit `propose_resolution` with final TWAP
6. Monitor disputes, submit evidence if challenged

### Phase 3: Testnet Deploy + Backtest Demo (Days 4-6)

**Deploy:**
```bash
sui client publish --gas-budget 100000000
```

**Backtest Demo (critical for judges):**

Pick a real card with strong historical data — e.g., PSA 10 Base Set Charizard:
- Jan 2024 oracle: ~$28,000
- Create hypothetical market: "Will PSA 10 Base Set Charizard exceed $30,000 by Jun 2024?"
- Show oracle price history from real `price_observations` table
- Walk through resolution:
  1. Oracle proposes: price was $26,500 at expiry → NO wins
  2. 24h dispute window passes (no dispute — price data is verifiable)
  3. Auto-settlement: NO positions pay out
- Calculate P&L for hypothetical YES/NO positions

This uses REAL oracle data from our production database. The prediction market mechanics are hypothetical but the price data is not. This is incredibly compelling for judges (50% weight on "Real-World Application").

**Candidate cards for backtest** (high liquidity, well-documented price movements):
1. PSA 10 Base Set Charizard #4 (iconic, highest volume)
2. PSA 10 1st Ed Shadowless Charizard (high value, clear trends)
3. PSA 10 Gold Star Rayquaza (recent price volatility)
4. PSA 10 Illustrator (ultra-rare, dramatic price swings)

### Phase 4: Frontend (Days 6-9)

Fork Anima Swarm React + Vite + dapp-kit setup.

**Pages:**

1. **Markets Browser** (`/`)
   - Grid of market cards (card image + question + YES/NO bar + volume)
   - Filter by: set, grader, grade range, expiry window, status
   - Sort by: volume, expiry (soonest), probability (most contested)

2. **Market Detail** (`/market/:id`)
   - Hero: card image + question + large probability display
   - Price chart: oracle history + strike price line + current price
   - Order interface: Buy YES / Buy NO with amount input
   - Resolution timeline: Proposed → Dispute → Settled
   - Oracle data: source breakdown (which platforms, sample size, TWAP)

3. **Portfolio** (`/portfolio`)
   - Open positions with P&L
   - Settlement history
   - Total volume traded

4. **Oracle Dashboard** (`/oracle`)
   - Live price feeds for registered assets
   - Platform breakdown (10 sources with status indicators)
   - Settlement history with evidence hashes
   - Dispute log

**SDK gotchas** (from Anima Swarm):
- `SuiGrpcClient` not `SuiClient` in `@mysten/sui` v2
- dapp-kit returns snake_case field names
- Slush/Suiet wallets only (no MetaMask)
- All hooks above conditional returns

### Phase 5: Walrus Evidence Layer (Days 9-10)

Store oracle attestations as Walrus blobs:
1. Every settlement proposal → price snapshot blob (all 10 platform prices + timestamps)
2. Every dispute → counter-evidence blob
3. Every resolution → final settlement blob with voter breakdown

```typescript
// Publish evidence to Walrus
const blob = await walrus.publish({
  type: 'settlement_evidence',
  asset_id: 'BASE_SET_CHARIZARD_4_PSA_10',
  timestamp: Date.now(),
  prices: { pricecharting: 26500, ebay_sold: 26200, goldin: 27000, ... },
  twap_7d: 26450,
  sample_size: 12,
  liquidity_score: 'sufficient',
});
```

This makes us eligible for the Walrus track ($70K pool) as a secondary submission.

### Phase 6: End-to-End Demo + Video (Days 10-12)

**Demo flow (5 min video max):**
1. (0:00) Hook: "Every collectible has a price opinion. We make those opinions tradeable."
2. (0:30) Show the oracle: 10 live marketplaces, 5,167 cards, real prices
3. (1:00) Create a prediction market: "Will PSA 10 Charizard exceed $15K by Dec 2026?"
4. (1:30) Trade: Buy YES/NO positions on DeepBook Predict
5. (2:30) Resolution: Oracle proposes price, dispute window, settlement
6. (3:30) Backtest: Show a historical market that would have resolved correctly
7. (4:00) Walrus: Evidence blobs for verifiable settlement
8. (4:30) Vision: Expand to watches, sneakers, wine — any graded collectible

### Phase 7: Polish + Submit (Days 12-15)

- Clean up UI
- Write README for public repo
- Verify testnet deployment
- Submit on DeepSurge
- Fill submission form (name, description, logo, repo, video, package ID)

---

## DeepBook Predict Integration Strategy

### Option A: Full DeepBook Predict Composability (preferred)
Our Move contracts create oracle entries that DeepBook Predict reads. Users trade YES/NO positions natively on DeepBook. Our resolution contract triggers DeepBook settlement.

**Pros:** True composability (judges love this), leverages DeepBook liquidity, positions compose with Spot and Margin.

**Cons:** Need to understand DeepBook Predict's oracle interface deeply. May require coordination with DeepBook team (Tony at Mysten Labs).

### Option B: Standalone Markets + DeepBook for Settlement
Our contracts handle market creation and resolution independently. We use DeepBook Spot for USDC escrow only.

**Pros:** Simpler, more control.

**Cons:** Less composability, weaker track pitch.

**Decision:** Start with Option B scaffolding but architect for Option A. Ask Tony during office hours about the oracle integration interface.

---

## Backtest Specification

### Data Source
Real `price_observations` table from production SlabClaw database.

### Query
```sql
SELECT po.*, p.name, p.set_name
FROM price_observations po
JOIN products p ON po.product_id = p.id
WHERE p.name LIKE '%Charizard%'
  AND po.grader = 'PSA'
  AND po.grade = 10
ORDER BY po.observed_at DESC;
```

### Backtest Script
```javascript
// backtest/run.mjs
// 1. Query historical oracle data for selected card
// 2. Create hypothetical market with past expiry
// 3. Show oracle price at each checkpoint
// 4. Resolve using TWAP at expiry
// 5. Calculate YES/NO payouts
// 6. Output: JSON + visual timeline
```

### Output
HTML page showing:
- Price chart with strike line
- Oracle snapshots from each platform over time
- Settlement resolution walkthrough
- P&L calculation for sample positions

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| DeepBook Predict API not documented enough | High | High | Use sandbox example_contract, ask Tony in office hours |
| Oracle security concerns from judges | Medium | High | Present the adversarial audit honestly + show mitigations |
| Low demo volume (no real traders) | High | Medium | Seed with example positions, focus on oracle quality |
| Walrus integration breaks | Medium | Low | It's secondary track — core demo works without it |
| Frontend time pressure | High | Medium | Fork Anima Swarm aggressively, minimal custom UI |

---

## File Structure

```
slabclaw-sui-hackathon/
├── CLAUDE.md                    # Project spec (done)
├── BUILD_PLAN.md                # This file
├── contracts/
│   └── slabclaw_predict/
│       ├── Move.toml            # (done)
│       └── sources/
│           ├── registry.move    # (done)
│           ├── oracle.move      # Phase 1
│           ├── resolution.move  # Phase 1
│           └── market.move      # Phase 1
├── oracle-bridge/
│   ├── package.json
│   └── src/                     # Phase 2
├── backtest/
│   ├── run.mjs                  # Phase 3
│   └── index.html               # Phase 3
├── frontend/
│   ├── package.json
│   └── src/                     # Phase 4 (fork Anima Swarm)
└── walrus/
    └── evidence.mjs             # Phase 5
```

---

## Daily Schedule (Jun 6-21)

| Day | Date | Focus |
|-----|------|-------|
| 1 | Jun 7 | oracle.move + resolution.move |
| 2 | Jun 8 | market.move + tests |
| 3 | Jun 9 | Build verification + testnet deploy attempt |
| 4 | Jun 10 | Oracle bridge service |
| 5 | Jun 11 | Oracle bridge + settlement endpoint hardening |
| 6 | Jun 12 | Backtest demo (query real data, build visualization) |
| 7 | Jun 13 | Frontend scaffold (fork Anima Swarm) |
| 8 | Jun 14 | Frontend: Markets browser + Market detail |
| 9 | Jun 15 | Frontend: Portfolio + Oracle dashboard |
| 10 | Jun 16 | Walrus evidence layer |
| 11 | Jun 17 | End-to-end integration testing |
| 12 | Jun 18 | Demo video recording |
| 13 | Jun 19 | Polish, README, public repo setup |
| 14 | Jun 20 | Final testing + submission prep |
| 15 | Jun 21 | Submit on DeepSurge |

---

## Judging Optimization

| Criterion | Weight | Our strategy |
|-----------|--------|-------------|
| **Real-World Application** | **50%** | 10-platform oracle with 5,167 real cards. Backtest with actual historical prices. This isn't synthetic — every data point is real. |
| Product & UX | 20% | Card images + grade badges make our markets visually distinct. Polymarket-inspired clean UI. |
| Technical Implementation | 20% | Four Move contracts + DeepBook Predict + optimistic oracle + Walrus. Three composable primitives. |
| Presentation & Vision | 10% | "Every collectible has a price opinion. We make those opinions tradeable." Expand to watches, sneakers, wine. |
