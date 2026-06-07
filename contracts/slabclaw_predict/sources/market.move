/// market.move — Binary prediction market factory with optimistic resolution.
/// Creates parimutuel prediction markets on collectible card prices.
///
/// Market question: "Will [asset] exceed [strike] by [expiry]?"
/// Users buy YES or NO shares at 1:1 with SUI. Pool distributes to winners.
///
/// Resolution uses UMA-style optimistic oracle:
/// 1. After expiry, oracle proposes settlement price
/// 2. 24h dispute window — anyone can dispute with SUI bond
/// 3. Undisputed → auto-finalize → winners claim
/// 4. Disputed → admin resolves (MVP) / SUI-staked voting (v2)
///
/// Note: resolution.move from the original spec is combined here to avoid
/// circular dependencies. Market owns its full lifecycle.
#[allow(lint(public_entry))]
module slabclaw_predict::market {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::coin::{Self, Coin};
    use sui::table::{Self, Table};
    use std::option::{Self, Option};
    use slabclaw_predict::registry::{Self, AdminCap, AssetRegistry};
    use slabclaw_predict::oracle::OracleCap;

    // ── Constants ───────────────────────────────────────────────────────

    /// 24 hours in milliseconds
    const DISPUTE_WINDOW_MS: u64 = 86_400_000;
    /// Minimum dispute bond: 10 SUI (in MIST)
    const MIN_DISPUTE_BOND: u64 = 10_000_000_000;
    /// Minimum position size: 0.001 SUI (in MIST)
    const MIN_POSITION: u64 = 1_000_000;
    /// Minimum oracle sources for settlement proposal
    const MIN_SOURCES: u64 = 3;

    // ── Market states ───────────────────────────────────────────────────

    const STATE_ACTIVE: u8 = 0;
    const STATE_PROPOSED: u8 = 1;
    const STATE_DISPUTED: u8 = 2;
    const STATE_SETTLED: u8 = 3;

    // ── Objects ─────────────────────────────────────────────────────────

    /// A binary prediction market. Shared object.
    /// "Will PSA 10 Base Set Charizard exceed $15,000 by December 2026?"
    public struct Market has key {
        id: UID,
        /// Asset class ID (from registry)
        asset_id: vector<u8>,
        /// Strike price in USD cents (e.g., 1500000 = $15,000.00)
        strike_usd_cents: u64,
        /// Expiry timestamp (ms since epoch)
        expiry_ms: u64,
        /// Human-readable market description
        description: vector<u8>,
        /// Current market state
        state: u8,
        /// SUI pool backing all positions
        pool: Balance<SUI>,
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
        /// Dispute bond balance (held during dispute)
        dispute_bond: Balance<SUI>,
        /// Disputer address
        disputer: Option<address>,
        /// Final outcome: true = YES wins (price > strike), false = NO wins
        outcome: Option<bool>,
        /// Total SUI claimed by winners (for accounting)
        total_claimed: u64,
        /// Market creator
        creator: address,
    }

    /// A user's position in a market.
    public struct Position has store, drop {
        /// YES shares held (in MIST, 1:1 with SUI deposited)
        yes_shares: u64,
        /// NO shares held (in MIST)
        no_shares: u64,
        /// Whether winnings have been claimed
        claimed: bool,
    }

    // ── Events ──────────────────────────────────────────────────────────

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
    }

    public struct WinningsClaimed has copy, drop {
        market_id: address,
        trader: address,
        payout: u64,
    }

    // ── Admin functions ─────────────────────────────────────────────────

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
            asset_id,
            strike_usd_cents,
            expiry_ms,
            description,
            state: STATE_ACTIVE,
            pool: balance::zero(),
            positions: table::new(ctx),
            total_yes: 0,
            total_no: 0,
            proposed_price: 0,
            proposed_at_ms: 0,
            proposed_sources: 0,
            dispute_bond: balance::zero(),
            disputer: option::none(),
            outcome: option::none(),
            total_claimed: 0,
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

    // ── Trading functions ───────────────────────────────────────────────

    /// Buy YES shares. 1 SUI = 1 YES share (parimutuel).
    /// Prediction: asset price WILL exceed strike at expiry.
    public entry fun buy_yes(
        market: &mut Market,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(market.state == STATE_ACTIVE, EMarketNotActive);
        assert!(clock::timestamp_ms(clock) < market.expiry_ms, EMarketExpired);

        let amount = coin::value(&payment);
        assert!(amount >= MIN_POSITION, EPositionTooSmall);

        // Add SUI to pool
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

    /// Buy NO shares. 1 SUI = 1 NO share (parimutuel).
    /// Prediction: asset price will NOT exceed strike at expiry.
    public entry fun buy_no(
        market: &mut Market,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(market.state == STATE_ACTIVE, EMarketNotActive);
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

    /// Oracle proposes a settlement price. Starts 24h dispute window.
    /// Can only be called after market expiry by an authorized oracle operator.
    public entry fun propose_resolution(
        _oracle_cap: &OracleCap,
        market: &mut Market,
        registry: &AssetRegistry,
        price_usd_cents: u64,
        sources_count: u64,
        clock: &Clock,
    ) {
        let now = clock::timestamp_ms(clock);

        // Market must be past expiry
        assert!(now >= market.expiry_ms, EMarketNotExpired);
        // Must be in ACTIVE state (not already proposed/settled)
        assert!(market.state == STATE_ACTIVE, EMarketNotActive);
        // Asset must still be valid
        assert!(registry::is_active(registry, market.asset_id), EAssetNotActive);
        // Minimum oracle sources
        assert!(sources_count >= MIN_SOURCES, EInsufficientSources);
        // Price must be positive
        assert!(price_usd_cents > 0, EInvalidPrice);

        market.state = STATE_PROPOSED;
        market.proposed_price = price_usd_cents;
        market.proposed_at_ms = now;
        market.proposed_sources = sources_count;

        event::emit(ResolutionProposed {
            market_id: object::uid_to_address(&market.id),
            proposed_price: price_usd_cents,
            sources_count,
            dispute_deadline_ms: now + DISPUTE_WINDOW_MS,
        });
    }

    /// Dispute a proposed resolution. Requires SUI bond (min 10 SUI).
    /// Only one dispute per market (first valid disputer wins).
    public entry fun dispute(
        market: &mut Market,
        bond: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(market.state == STATE_PROPOSED, ENotProposed);

        let now = clock::timestamp_ms(clock);
        assert!(now < market.proposed_at_ms + DISPUTE_WINDOW_MS, EDisputeWindowClosed);

        let bond_amount = coin::value(&bond);
        assert!(bond_amount >= MIN_DISPUTE_BOND, EBondTooSmall);

        balance::join(&mut market.dispute_bond, coin::into_balance(bond));

        let sender = tx_context::sender(ctx);
        market.state = STATE_DISPUTED;
        market.disputer = option::some(sender);

        event::emit(MarketDisputed {
            market_id: object::uid_to_address(&market.id),
            disputer: sender,
            bond_amount,
        });
    }

    /// Finalize an undisputed resolution. Anyone can call after dispute window closes.
    /// Determines outcome based on proposed price vs strike price.
    public entry fun finalize(
        market: &mut Market,
        clock: &Clock,
    ) {
        assert!(market.state == STATE_PROPOSED, ENotProposed);

        let now = clock::timestamp_ms(clock);
        assert!(now >= market.proposed_at_ms + DISPUTE_WINDOW_MS, EDisputeWindowOpen);

        // YES wins if settlement price exceeds strike
        let outcome_yes = market.proposed_price > market.strike_usd_cents;
        market.outcome = option::some(outcome_yes);
        market.state = STATE_SETTLED;

        event::emit(MarketSettled {
            market_id: object::uid_to_address(&market.id),
            settlement_price: market.proposed_price,
            outcome_yes,
            total_pool: balance::value(&market.pool),
        });
    }

    /// Admin resolves a disputed market. Sets the correct price and settles.
    /// If return_bond is true, the dispute was valid and bond goes back to disputer.
    /// If false, bond is added to the pool (rewards winners).
    /// In v2, this will be replaced by SUI-staked voting.
    public entry fun admin_resolve(
        _admin: &AdminCap,
        market: &mut Market,
        correct_price: u64,
        return_bond: bool,
        ctx: &mut TxContext,
    ) {
        assert!(market.state == STATE_DISPUTED, ENotDisputed);

        // Settle with admin-determined price
        let outcome_yes = correct_price > market.strike_usd_cents;
        market.outcome = option::some(outcome_yes);
        market.proposed_price = correct_price;
        market.state = STATE_SETTLED;

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

        event::emit(MarketSettled {
            market_id: object::uid_to_address(&market.id),
            settlement_price: correct_price,
            outcome_yes,
            total_pool: balance::value(&market.pool),
        });
    }

    // ── Claim functions ─────────────────────────────────────────────────

    /// Claim winnings from a settled market.
    /// Payout = (your winning shares / total winning shares) × total pool
    /// Uses u128 arithmetic to prevent overflow on large pools.
    public entry fun claim(
        market: &mut Market,
        ctx: &mut TxContext,
    ) {
        assert!(market.state == STATE_SETTLED, ENotSettled);

        let outcome_yes = *option::borrow(&market.outcome);
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&market.positions, sender), ENoPosition);

        let pos = table::borrow_mut(&mut market.positions, sender);
        assert!(!pos.claimed, EAlreadyClaimed);

        let winning_shares = if (outcome_yes) { pos.yes_shares } else { pos.no_shares };
        assert!(winning_shares > 0, ENoWinningPosition);

        let total_winning = if (outcome_yes) { market.total_yes } else { market.total_no };
        assert!(total_winning > 0, ENoWinningSide);

        let total_pool = balance::value(&market.pool);

        // Payout = (winning_shares / total_winning) × total_pool
        let payout_128 = (winning_shares as u128) * (total_pool as u128) / (total_winning as u128);
        let payout = (payout_128 as u64);

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

    /// Emergency refund — admin can refund all positions if no winning side exists
    /// or if a market needs to be cancelled.
    public entry fun emergency_refund(
        _admin: &AdminCap,
        market: &mut Market,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        // Only callable on settled markets where one side has 0 shares,
        // or by admin on any non-settled market for cancellation
        assert!(
            market.state == STATE_SETTLED || market.state == STATE_ACTIVE,
            EMarketNotActive,
        );

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

    // ── Read accessors ──────────────────────────────────────────────────

    public fun asset_id(market: &Market): vector<u8> { market.asset_id }
    public fun strike_usd_cents(market: &Market): u64 { market.strike_usd_cents }
    public fun expiry_ms(market: &Market): u64 { market.expiry_ms }
    public fun description(market: &Market): vector<u8> { market.description }
    public fun state(market: &Market): u8 { market.state }
    public fun total_yes(market: &Market): u64 { market.total_yes }
    public fun total_no(market: &Market): u64 { market.total_no }
    public fun pool_value(market: &Market): u64 { balance::value(&market.pool) }
    public fun proposed_price(market: &Market): u64 { market.proposed_price }
    public fun proposed_at_ms(market: &Market): u64 { market.proposed_at_ms }
    public fun is_settled(market: &Market): bool { market.state == STATE_SETTLED }
    public fun outcome(market: &Market): Option<bool> { market.outcome }
    public fun total_claimed(market: &Market): u64 { market.total_claimed }

    /// YES probability as basis points (0-10000). 5000 = 50% when no positions.
    public fun yes_price_bps(market: &Market): u64 {
        let total = market.total_yes + market.total_no;
        if (total == 0) { return 5000 };
        (market.total_yes * 10000) / total
    }

    /// NO probability as basis points (0-10000).
    public fun no_price_bps(market: &Market): u64 {
        10000 - yes_price_bps(market)
    }

    /// State constant accessors (for client-side state checking)
    public fun state_active(): u8 { STATE_ACTIVE }
    public fun state_proposed(): u8 { STATE_PROPOSED }
    public fun state_disputed(): u8 { STATE_DISPUTED }
    public fun state_settled(): u8 { STATE_SETTLED }

    // ── Error codes ─────────────────────────────────────────────────────

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

    // ── Test helpers ────────────────────────────────────────────────────

    #[test_only]
    public fun create_market_for_testing(
        asset_id: vector<u8>,
        strike_usd_cents: u64,
        expiry_ms: u64,
        ctx: &mut TxContext,
    ): Market {
        Market {
            id: object::new(ctx),
            asset_id,
            strike_usd_cents,
            expiry_ms,
            description: b"Test market",
            state: STATE_ACTIVE,
            pool: balance::zero(),
            positions: table::new(ctx),
            total_yes: 0,
            total_no: 0,
            proposed_price: 0,
            proposed_at_ms: 0,
            proposed_sources: 0,
            dispute_bond: balance::zero(),
            disputer: option::none(),
            outcome: option::none(),
            total_claimed: 0,
            creator: tx_context::sender(ctx),
        }
    }

    #[test_only]
    public fun destroy_market_for_testing(market: Market) {
        let Market {
            id,
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
            dispute_bond,
            disputer: _,
            outcome: _,
            total_claimed: _,
            creator: _,
        } = market;
        balance::destroy_for_testing(pool);
        balance::destroy_for_testing(dispute_bond);
        table::drop(positions);
        object::delete(id);
    }

    #[test_only]
    public fun set_state_for_testing(market: &mut Market, new_state: u8) {
        market.state = new_state;
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
        market.state = STATE_PROPOSED;
    }
}
