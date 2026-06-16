/// market.move — Binary prediction market factory with optimistic resolution.
/// Creates parimutuel prediction markets on collectible card prices.
///
/// Market question: "Will [asset] exceed [strike] by [expiry]?"
/// Users buy YES or NO shares 1:1 with tUSD. The pool distributes to winners.
///
/// Resolution uses a UMA-style optimistic oracle:
/// 1. After expiry, the oracle proposes a settlement price + Walrus evidence.
/// 2. A dispute window opens — anyone can dispute with a tUSD bond.
/// 3. Undisputed → anyone finalizes → winners claim.
/// 4. Disputed → admin resolves (MVP) / tUSD-staked voting (v2).
///
/// Economic terms (the dispute deadline and the required bond) are *snapshotted into
/// the market at proposal time* from the governance `ProtocolConfig`. Freezing them at
/// proposal makes the deal a disputer sees immutable for the life of that resolution —
/// a later admin config change cannot move the goalposts on an in-flight dispute.
///
/// Every state-mutating entry function asserts `version == VERSION`; after a package
/// upgrade a stale market aborts instead of corrupting its pool. `migrate_market`
/// (AdminCap) bumps a stale market forward.
///
/// Note: resolution logic lives here rather than a separate module to avoid a
/// circular dependency — a market owns its full lifecycle.
#[allow(lint(public_entry))]
module slabclaw_predict::market {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::balance::{Self, Balance};
    use sui::coin::{Self, Coin};
    use sui::table::{Self, Table};
    use std::option::{Self, Option};
    use slabclaw_predict::registry::{Self, AdminCap, AssetRegistry, ProtocolConfig};
    use slabclaw_predict::oracle::OracleCap;
    // Settlement currency: faucet-minted test USD (9 decimals, mirrors MIST so
    // all share-math constants below are unchanged from a native-coin version).
    use slabclaw_predict::test_usd::TEST_USD;

    // ── Versioning ──────────────────────────────────────────────────────────

    /// Current market state version. Bump on every state-shape-changing upgrade.
    const VERSION: u64 = 1;

    // ── Constants ───────────────────────────────────────────────────────────

    /// Minimum position size: 0.001 tUSD (in MIST, 9 decimals). A dust floor that
    /// must never be loosened by governance, so it stays a compile-time constant
    /// rather than a `ProtocolConfig` knob.
    const MIN_POSITION: u64 = 1_000_000;

    // ── Market states ───────────────────────────────────────────────────────

    /// Lifecycle of a market. A Move 2024 enum gives exhaustive, type-checked
    /// transitions; the numeric `state()` accessor below preserves the 0/1/2/3
    /// wire contract that the off-chain bridge and frontend already read.
    public enum MarketState has store, copy, drop {
        Active,
        Proposed,
        Disputed,
        Settled,
    }

    // ── Objects ─────────────────────────────────────────────────────────────

    /// A binary prediction market. Shared object.
    /// "Will PSA 10 Base Set Charizard exceed $15,000 by December 2026?"
    public struct Market has key {
        id: UID,
        /// On-chain state version (see module docs).
        version: u64,
        /// Asset class ID (from registry)
        asset_id: vector<u8>,
        /// Strike price in USD cents (e.g., 1500000 = $15,000.00)
        strike_usd_cents: u64,
        /// Expiry timestamp (ms since epoch)
        expiry_ms: u64,
        /// Human-readable market description
        description: vector<u8>,
        /// Current market state
        state: MarketState,
        /// tUSD pool backing all positions
        pool: Balance<TEST_USD>,
        /// Position tracking: address → Position
        positions: Table<address, Position>,
        /// Total YES shares outstanding (in MIST)
        total_yes: u64,
        /// Total NO shares outstanding (in MIST)
        total_no: u64,
        // ── Resolution fields ───────────────────────────────────────
        /// Proposed settlement price in USD cents (0 if not proposed)
        proposed_price: u64,
        /// Proposal timestamp in ms (0 if not proposed)
        proposed_at_ms: u64,
        /// Number of oracle sources in the proposal
        proposed_sources: u64,
        /// Walrus blob id of the resolution evidence (empty until proposed)
        evidence_blob_id: vector<u8>,
        /// Dispute deadline (ms), snapshotted from config at proposal time
        dispute_deadline_ms: u64,
        /// Required dispute bond (tUSD MIST), snapshotted from config at proposal time
        required_dispute_bond: u64,
        /// Dispute bond balance (held during dispute)
        dispute_bond: Balance<TEST_USD>,
        /// Disputer address
        disputer: Option<address>,
        /// Final outcome: true = YES wins (price > strike), false = NO wins
        outcome: Option<bool>,
        /// Total tUSD claimed by winners (for accounting)
        total_claimed: u64,
        /// Pool value snapshotted at settlement. Pro-rata `claim` divides by this
        /// FIXED amount, not the live (shrinking) pool — otherwise each winner
        /// after the first is underpaid and the remainder is stranded.
        settled_pool: u64,
        /// Market creator
        creator: address,
    }

    /// A user's position in a market.
    public struct Position has store, drop {
        /// YES shares held (in MIST, 1:1 with tUSD deposited)
        yes_shares: u64,
        /// NO shares held (in MIST)
        no_shares: u64,
        /// Whether winnings have been claimed
        claimed: bool,
    }

    // ── Events ──────────────────────────────────────────────────────────────

    public struct MarketCreated has copy, drop {
        market_id: address,
        asset_id: vector<u8>,
        strike_usd_cents: u64,
        expiry_ms: u64,
    }

    public struct PositionOpened has copy, drop {
        market_id: address,
        trader: address,
        is_yes: bool,
        amount: u64,
    }

    public struct ResolutionProposed has copy, drop {
        market_id: address,
        proposed_price: u64,
        sources_count: u64,
        dispute_deadline_ms: u64,
        evidence_blob_id: vector<u8>,
    }

    public struct MarketDisputed has copy, drop {
        market_id: address,
        disputer: address,
        bond_amount: u64,
    }

    public struct MarketSettled has copy, drop {
        market_id: address,
        settlement_price: u64,
        outcome_yes: bool,
        total_pool: u64,
        evidence_blob_id: vector<u8>,
    }

    public struct WinningsClaimed has copy, drop {
        market_id: address,
        trader: address,
        payout: u64,
    }

    // ── Admin functions ─────────────────────────────────────────────────────

    /// Create a new binary prediction market. Requires AdminCap.
    /// Asset must be registered and active in the registry.
    public entry fun create_market(
        _admin: &AdminCap,
        registry: &AssetRegistry,
        asset_id: vector<u8>,
        strike_usd_cents: u64,
        expiry_ms: u64,
        description: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(registry::is_active(registry, asset_id), EAssetNotActive);
        assert!(expiry_ms > clock::timestamp_ms(clock), EExpiryInPast);
        assert!(strike_usd_cents > 0, EInvalidStrike);

        let market_uid = object::new(ctx);
        let market_id = object::uid_to_address(&market_uid);

        let market = Market {
            id: market_uid,
            version: VERSION,
            asset_id,
            strike_usd_cents,
            expiry_ms,
            description,
            state: MarketState::Active,
            pool: balance::zero(),
            positions: table::new(ctx),
            total_yes: 0,
            total_no: 0,
            proposed_price: 0,
            proposed_at_ms: 0,
            proposed_sources: 0,
            evidence_blob_id: b"",
            dispute_deadline_ms: 0,
            required_dispute_bond: 0,
            dispute_bond: balance::zero(),
            disputer: option::none(),
            outcome: option::none(),
            total_claimed: 0,
            settled_pool: 0,
            creator: tx_context::sender(ctx),
        };

        event::emit(MarketCreated {
            market_id,
            asset_id,
            strike_usd_cents,
            expiry_ms,
        });

        transfer::share_object(market);
    }

    /// Bump a stale market to the current version after a package upgrade.
    public entry fun migrate_market(_admin: &AdminCap, market: &mut Market) {
        assert!(market.version < VERSION, ENotStale);
        market.version = VERSION;
    }

    // ── Trading functions ───────────────────────────────────────────────────

    /// Buy YES shares. 1 tUSD = 1 YES share (parimutuel).
    /// Prediction: asset price WILL exceed strike at expiry.
    public entry fun buy_yes(
        market: &mut Market,
        payment: Coin<TEST_USD>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(market.version == VERSION, EWrongVersion);
        assert!(market.state == MarketState::Active, EMarketNotActive);
        assert!(clock::timestamp_ms(clock) < market.expiry_ms, EMarketExpired);

        let amount = coin::value(&payment);
        assert!(amount >= MIN_POSITION, EPositionTooSmall);

        // Add tUSD to pool
        balance::join(&mut market.pool, coin::into_balance(payment));

        // Update or create position
        let sender = tx_context::sender(ctx);
        if (table::contains(&market.positions, sender)) {
            let pos = table::borrow_mut(&mut market.positions, sender);
            pos.yes_shares = pos.yes_shares + amount;
        } else {
            table::add(&mut market.positions, sender, Position {
                yes_shares: amount,
                no_shares: 0,
                claimed: false,
            });
        };

        market.total_yes = market.total_yes + amount;

        event::emit(PositionOpened {
            market_id: object::uid_to_address(&market.id),
            trader: sender,
            is_yes: true,
            amount,
        });
    }

    /// Buy NO shares. 1 tUSD = 1 NO share (parimutuel).
    /// Prediction: asset price will NOT exceed strike at expiry.
    public entry fun buy_no(
        market: &mut Market,
        payment: Coin<TEST_USD>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(market.version == VERSION, EWrongVersion);
        assert!(market.state == MarketState::Active, EMarketNotActive);
        assert!(clock::timestamp_ms(clock) < market.expiry_ms, EMarketExpired);

        let amount = coin::value(&payment);
        assert!(amount >= MIN_POSITION, EPositionTooSmall);

        balance::join(&mut market.pool, coin::into_balance(payment));

        let sender = tx_context::sender(ctx);
        if (table::contains(&market.positions, sender)) {
            let pos = table::borrow_mut(&mut market.positions, sender);
            pos.no_shares = pos.no_shares + amount;
        } else {
            table::add(&mut market.positions, sender, Position {
                yes_shares: 0,
                no_shares: amount,
                claimed: false,
            });
        };

        market.total_no = market.total_no + amount;

        event::emit(PositionOpened {
            market_id: object::uid_to_address(&market.id),
            trader: sender,
            is_yes: false,
            amount,
        });
    }

    // ── Resolution functions (UMA-style optimistic oracle) ──────────────

    /// Oracle proposes a settlement price. Snapshots the dispute deadline and
    /// required bond from the live `ProtocolConfig`, then opens the dispute window.
    /// Callable only after market expiry by an authorized oracle operator.
    public entry fun propose_resolution(
        _oracle_cap: &OracleCap,
        market: &mut Market,
        registry: &AssetRegistry,
        config: &ProtocolConfig,
        price_usd_cents: u64,
        sources_count: u64,
        evidence_blob_id: vector<u8>,
        clock: &Clock,
    ) {
        assert!(market.version == VERSION, EWrongVersion);

        let now = clock::timestamp_ms(clock);

        // Market must be past expiry
        assert!(now >= market.expiry_ms, EMarketNotExpired);
        // Must be in Active state (not already proposed/settled)
        assert!(market.state == MarketState::Active, EMarketNotActive);
        // Asset must still be valid
        assert!(registry::is_active(registry, market.asset_id), EAssetNotActive);
        // Minimum oracle sources (governance-tunable floor)
        assert!(sources_count >= registry::min_sources(config), EInsufficientSources);
        // Price must be positive
        assert!(price_usd_cents > 0, EInvalidPrice);
        // A market cannot settle without verifiable Walrus evidence.
        assert!(std::vector::length(&evidence_blob_id) > 0, EMissingEvidence);

        // NOTE: the dispute window is the single global `registry::dispute_window_ms(config)`.
        // The offchain coordinator recommends a 3x window for `thin_market` (rare-card,
        // 2-family) settlements, but that multiplier is NOT enforced onchain — it is
        // recorded in the Walrus evidence blob only. Onchain enforcement of a per-market
        // extended window would require a `dispute_window_override_ms` arg here (validated
        // `>= dispute_window_ms`) and a package redeploy; flagged as a manual operator item.
        let dispute_deadline_ms = now + registry::dispute_window_ms(config);

        market.state = MarketState::Proposed;
        market.proposed_price = price_usd_cents;
        market.proposed_at_ms = now;
        market.proposed_sources = sources_count;
        market.evidence_blob_id = evidence_blob_id;
        market.dispute_deadline_ms = dispute_deadline_ms;
        market.required_dispute_bond = registry::min_dispute_bond(config);

        event::emit(ResolutionProposed {
            market_id: object::uid_to_address(&market.id),
            proposed_price: price_usd_cents,
            sources_count,
            dispute_deadline_ms,
            evidence_blob_id,
        });
    }

    /// Dispute a proposed resolution. Requires a bond ≥ the amount snapshotted at
    /// proposal time. Only one dispute per market (first valid disputer wins).
    public entry fun dispute(
        market: &mut Market,
        bond: Coin<TEST_USD>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(market.version == VERSION, EWrongVersion);
        assert!(market.state == MarketState::Proposed, ENotProposed);

        let now = clock::timestamp_ms(clock);
        assert!(now < market.dispute_deadline_ms, EDisputeWindowClosed);

        let bond_amount = coin::value(&bond);
        assert!(bond_amount >= market.required_dispute_bond, EBondTooSmall);

        balance::join(&mut market.dispute_bond, coin::into_balance(bond));

        let sender = tx_context::sender(ctx);
        market.state = MarketState::Disputed;
        market.disputer = option::some(sender);

        event::emit(MarketDisputed {
            market_id: object::uid_to_address(&market.id),
            disputer: sender,
            bond_amount,
        });
    }

    /// Finalize an undisputed resolution. Anyone can call after the dispute window closes.
    /// Determines outcome based on proposed price vs strike price.
    public entry fun finalize(
        market: &mut Market,
        clock: &Clock,
    ) {
        assert!(market.version == VERSION, EWrongVersion);
        assert!(market.state == MarketState::Proposed, ENotProposed);

        let now = clock::timestamp_ms(clock);
        assert!(now >= market.dispute_deadline_ms, EDisputeWindowOpen);

        // YES wins if settlement price exceeds strike
        let outcome_yes = market.proposed_price > market.strike_usd_cents;
        market.outcome = option::some(outcome_yes);
        market.state = MarketState::Settled;
        // Freeze the pool as the fixed dividend for pro-rata claims.
        market.settled_pool = balance::value(&market.pool);

        event::emit(MarketSettled {
            market_id: object::uid_to_address(&market.id),
            settlement_price: market.proposed_price,
            outcome_yes,
            total_pool: balance::value(&market.pool),
            evidence_blob_id: market.evidence_blob_id,
        });
    }

    /// Admin resolves a disputed market. Sets the correct price and settles.
    /// If return_bond is true, the dispute was valid and the bond goes back to the disputer.
    /// If false, the bond is added to the pool (rewards winners).
    /// In v2, this will be replaced by tUSD-staked voting.
    public entry fun admin_resolve(
        _admin: &AdminCap,
        market: &mut Market,
        correct_price: u64,
        return_bond: bool,
        ctx: &mut TxContext,
    ) {
        assert!(market.version == VERSION, EWrongVersion);
        assert!(market.state == MarketState::Disputed, ENotDisputed);

        // Settle with admin-determined price
        let outcome_yes = correct_price > market.strike_usd_cents;
        market.outcome = option::some(outcome_yes);
        market.proposed_price = correct_price;
        market.state = MarketState::Settled;

        // Handle dispute bond
        let bond_value = balance::value(&market.dispute_bond);
        if (bond_value > 0) {
            if (return_bond) {
                // Dispute was valid — return bond to disputer
                let disputer = *option::borrow(&market.disputer);
                let bond_coin = coin::from_balance(
                    balance::split(&mut market.dispute_bond, bond_value),
                    ctx,
                );
                transfer::public_transfer(bond_coin, disputer);
            } else {
                // Dispute was invalid — bond goes to pool (rewards winners)
                balance::join(
                    &mut market.pool,
                    balance::split(&mut market.dispute_bond, bond_value),
                );
            };
        };

        // Snapshot AFTER any slashed bond joined the pool, so winners share it too.
        market.settled_pool = balance::value(&market.pool);

        event::emit(MarketSettled {
            market_id: object::uid_to_address(&market.id),
            settlement_price: correct_price,
            outcome_yes,
            total_pool: balance::value(&market.pool),
            evidence_blob_id: market.evidence_blob_id,
        });
    }

    // ── Settlement math (formally verified) ─────────────────────────────────

    /// Parimutuel payout: a winner's pro-rata share of the pool.
    /// `payout = winning_shares * pool / total_winning`, computed in u128 to avoid
    /// overflow on large pools, then narrowed to u64.
    ///
    /// Precondition (enforced by every caller): `total_winning > 0` and
    /// `winning_shares <= total_winning`. Under that precondition this function is
    /// machine-checked by the Sui Prover to be **solvent** (`payout <= pool`) and
    /// **truncation-free** (the u128→u64 narrowing never loses value) —
    /// see `slabclaw_predict_proofs::settlement`.
    public fun compute_payout(winning_shares: u64, total_winning: u64, pool: u64): u64 {
        (((winning_shares as u128) * (pool as u128) / (total_winning as u128)) as u64)
    }

    // ── Claim functions ─────────────────────────────────────────────────────

    /// Claim winnings from a settled market.
    /// Payout = (your winning shares / total winning shares) × total pool.
    public entry fun claim(
        market: &mut Market,
        ctx: &mut TxContext,
    ) {
        assert!(market.version == VERSION, EWrongVersion);
        assert!(market.state == MarketState::Settled, ENotSettled);

        let outcome_yes = *option::borrow(&market.outcome);
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&market.positions, sender), ENoPosition);

        let pos = table::borrow_mut(&mut market.positions, sender);
        assert!(!pos.claimed, EAlreadyClaimed);

        let winning_shares = if (outcome_yes) { pos.yes_shares } else { pos.no_shares };
        assert!(winning_shares > 0, ENoWinningPosition);

        let total_winning = if (outcome_yes) { market.total_yes } else { market.total_no };
        assert!(total_winning > 0, ENoWinningSide);

        // Divide by the FIXED settlement pool, not the live (shrinking) pool —
        // otherwise the dividend drops with each claim and later winners are
        // underpaid. settled_pool >= the live pool at every point during claims,
        // so balance::split always has the funds (solvent: Σ payouts == settled_pool).
        let total_pool = market.settled_pool;

        // Solvent + truncation-free by construction (see compute_payout's proof).
        let payout = compute_payout(winning_shares, total_winning, total_pool);

        pos.claimed = true;

        let payout_coin = coin::from_balance(
            balance::split(&mut market.pool, payout),
            ctx,
        );
        transfer::public_transfer(payout_coin, sender);

        market.total_claimed = market.total_claimed + payout;

        event::emit(WinningsClaimed {
            market_id: object::uid_to_address(&market.id),
            trader: sender,
            payout,
        });
    }

    /// Emergency refund. Admin-gated escape hatch, deliberately narrow in scope:
    /// allowed ONLY when the market is still Active (cancellation before resolution)
    /// or when it has Settled with **no winning side** (every share is on the losing
    /// outcome, so nobody can `claim` and the pool would otherwise be stranded).
    /// It can never be used to refund a loser out of a pool that winners are owed.
    public entry fun emergency_refund(
        _admin: &AdminCap,
        market: &mut Market,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(market.version == VERSION, EWrongVersion);

        let allowed = if (market.state == MarketState::Active) {
            // Pre-resolution cancellation.
            true
        } else if (market.state == MarketState::Settled) {
            // Only when the winning side has zero shares — i.e. no `claim` can succeed.
            let outcome_yes = *option::borrow(&market.outcome);
            (outcome_yes && market.total_yes == 0) || (!outcome_yes && market.total_no == 0)
        } else {
            false
        };
        assert!(allowed, ERefundNotAllowed);

        assert!(table::contains(&market.positions, recipient), ENoPosition);
        let pos = table::borrow_mut(&mut market.positions, recipient);
        assert!(!pos.claimed, EAlreadyClaimed);

        // Refund the user's total deposit (both sides)
        let refund_amount = pos.yes_shares + pos.no_shares;
        assert!(refund_amount > 0, ENoPosition);

        // Cap refund at available pool
        let pool_value = balance::value(&market.pool);
        let actual_refund = if (refund_amount > pool_value) { pool_value } else { refund_amount };

        pos.claimed = true;

        if (actual_refund > 0) {
            let refund_coin = coin::from_balance(
                balance::split(&mut market.pool, actual_refund),
                ctx,
            );
            transfer::public_transfer(refund_coin, recipient);
        };
    }

    // ── Read accessors ──────────────────────────────────────────────────────

    public fun asset_id(market: &Market): vector<u8> { market.asset_id }
    public fun strike_usd_cents(market: &Market): u64 { market.strike_usd_cents }
    public fun expiry_ms(market: &Market): u64 { market.expiry_ms }
    public fun description(market: &Market): vector<u8> { market.description }
    public fun total_yes(market: &Market): u64 { market.total_yes }
    public fun total_no(market: &Market): u64 { market.total_no }
    public fun pool_value(market: &Market): u64 { balance::value(&market.pool) }
    public fun proposed_price(market: &Market): u64 { market.proposed_price }
    public fun proposed_at_ms(market: &Market): u64 { market.proposed_at_ms }
    public fun dispute_deadline_ms(market: &Market): u64 { market.dispute_deadline_ms }
    public fun required_dispute_bond(market: &Market): u64 { market.required_dispute_bond }
    public fun evidence_blob_id(market: &Market): vector<u8> { market.evidence_blob_id }
    public fun is_settled(market: &Market): bool { market.state == MarketState::Settled }
    public fun outcome(market: &Market): Option<bool> { market.outcome }
    public fun total_claimed(market: &Market): u64 { market.total_claimed }
    public fun market_version(market: &Market): u64 { market.version }

    /// Numeric state for the off-chain bridge/frontend (stable 0/1/2/3 wire contract).
    public fun state(market: &Market): u8 {
        match (&market.state) {
            MarketState::Active => 0,
            MarketState::Proposed => 1,
            MarketState::Disputed => 2,
            MarketState::Settled => 3,
        }
    }

    /// YES probability as basis points (0-10000). 5000 = 50% when no positions.
    /// Widens to u128 before scaling so a large pool can never overflow the read.
    public fun yes_price_bps(market: &Market): u64 {
        let total = market.total_yes + market.total_no;
        if (total == 0) { return 5000 };
        ((((market.total_yes as u128) * 10000) / (total as u128)) as u64)
    }

    /// NO probability as basis points (0-10000).
    public fun no_price_bps(market: &Market): u64 {
        10000 - yes_price_bps(market)
    }

    /// State constant accessors (for client-side state checking — stable wire values).
    public fun state_active(): u8 { 0 }
    public fun state_proposed(): u8 { 1 }
    public fun state_disputed(): u8 { 2 }
    public fun state_settled(): u8 { 3 }

    // ── Error codes ─────────────────────────────────────────────────────────

    const EMarketNotActive: u64 = 0;
    const EMarketExpired: u64 = 1;
    const EPositionTooSmall: u64 = 2;
    const EAssetNotActive: u64 = 3;
    const EExpiryInPast: u64 = 4;
    const EInvalidStrike: u64 = 5;
    const EMarketNotExpired: u64 = 6;
    const ENotProposed: u64 = 7;
    const EDisputeWindowClosed: u64 = 8;
    const EBondTooSmall: u64 = 9;
    const EDisputeWindowOpen: u64 = 10;
    const ENotDisputed: u64 = 11;
    const ENotSettled: u64 = 12;
    const ENoPosition: u64 = 13;
    const EAlreadyClaimed: u64 = 14;
    const ENoWinningPosition: u64 = 15;
    const EInsufficientSources: u64 = 16;
    const EInvalidPrice: u64 = 17;
    const ENoWinningSide: u64 = 18;
    const EMissingEvidence: u64 = 19;
    const EWrongVersion: u64 = 20;
    const ERefundNotAllowed: u64 = 21;
    const ENotStale: u64 = 22;

    // ── Test helpers ────────────────────────────────────────────────────────

    #[test_only]
    public fun create_market_for_testing(
        asset_id: vector<u8>,
        strike_usd_cents: u64,
        expiry_ms: u64,
        ctx: &mut TxContext,
    ): Market {
        Market {
            id: object::new(ctx),
            version: VERSION,
            asset_id,
            strike_usd_cents,
            expiry_ms,
            description: b"Test market",
            state: MarketState::Active,
            pool: balance::zero(),
            positions: table::new(ctx),
            total_yes: 0,
            total_no: 0,
            proposed_price: 0,
            proposed_at_ms: 0,
            proposed_sources: 0,
            evidence_blob_id: b"",
            dispute_deadline_ms: 0,
            required_dispute_bond: 0,
            dispute_bond: balance::zero(),
            disputer: option::none(),
            outcome: option::none(),
            total_claimed: 0,
            settled_pool: 0,
            creator: tx_context::sender(ctx),
        }
    }

    #[test_only]
    public fun destroy_market_for_testing(market: Market) {
        let Market {
            id,
            version: _,
            asset_id: _,
            strike_usd_cents: _,
            expiry_ms: _,
            description: _,
            state: _,
            pool,
            positions,
            total_yes: _,
            total_no: _,
            proposed_price: _,
            proposed_at_ms: _,
            proposed_sources: _,
            evidence_blob_id: _,
            dispute_deadline_ms: _,
            required_dispute_bond: _,
            dispute_bond,
            disputer: _,
            outcome: _,
            total_claimed: _,
            settled_pool: _,
            creator: _,
        } = market;
        balance::destroy_for_testing(pool);
        balance::destroy_for_testing(dispute_bond);
        table::drop(positions);
        object::delete(id);
    }

    #[test_only]
    /// Default genesis terms used by `set_proposed_for_testing` (mirror registry defaults).
    const TEST_DEFAULT_WINDOW_MS: u64 = 86_400_000;
    #[test_only]
    const TEST_DEFAULT_BOND: u64 = 10_000_000_000;

    #[test_only]
    public fun set_state_for_testing(market: &mut Market, new_state: u8) {
        market.state = if (new_state == 0) { MarketState::Active }
            else if (new_state == 1) { MarketState::Proposed }
            else if (new_state == 2) { MarketState::Disputed }
            else { MarketState::Settled };
    }

    #[test_only]
    public fun set_proposed_for_testing(
        market: &mut Market,
        price: u64,
        at_ms: u64,
        sources: u64,
    ) {
        market.proposed_price = price;
        market.proposed_at_ms = at_ms;
        market.proposed_sources = sources;
        market.dispute_deadline_ms = at_ms + TEST_DEFAULT_WINDOW_MS;
        market.required_dispute_bond = TEST_DEFAULT_BOND;
        market.state = MarketState::Proposed;
    }

    #[test_only]
    public fun set_market_version_for_testing(market: &mut Market, v: u64) {
        market.version = v;
    }
}
