#[test_only]
module slabclaw_predict::market_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use slabclaw_predict::market::{Self, Market};
    use slabclaw_predict::oracle;
    use slabclaw_predict::registry;

    const ADMIN: address = @0xAD;
    const ORACLE_OP: address = @0x0AC;
    const TRADER_A: address = @0xA;
    const TRADER_B: address = @0xB;
    const DISPUTER: address = @0xD;

    /// 1 SUI in MIST
    const ONE_SUI: u64 = 1_000_000_000;

    // ── Helper: set up registry + market ────────────────────────────────

    /// Creates a registered asset and returns admin_cap, registry, oracle_cap
    fun setup_market_prereqs(scenario: &mut ts::Scenario): (
        registry::AdminCap,
        registry::AssetRegistry,
        oracle::OracleCap,
    ) {
        let ctx = ts::ctx(scenario);
        let admin_cap = registry::create_admin_cap_for_testing(ctx);
        let mut registry = registry::create_registry_for_testing(ctx);
        let oracle_cap = oracle::create_oracle_cap_for_testing(ctx);

        registry::register_asset(
            &admin_cap,
            &mut registry,
            b"BASE_CHARIZARD_4_PSA_10",
            b"Base Set",
            b"4",
            b"PSA",
            1000, // 10.0
            5,
        );

        (admin_cap, registry, oracle_cap)
    }

    // ── Market creation tests ───────────────────────────────────────────

    #[test]
    fun test_create_market() {
        let mut scenario = ts::begin(ADMIN);

        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_700_000_000_000);

            market::create_market(
                &admin_cap,
                &registry,
                b"BASE_CHARIZARD_4_PSA_10",
                1500000, // $15,000 strike
                1_800_000_000_000, // expiry in future
                b"Will PSA 10 Charizard exceed $15,000?",
                &clock,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clock);
        };

        // Verify market was shared
        ts::next_tx(&mut scenario, ADMIN);
        {
            let market = ts::take_shared<Market>(&scenario);
            assert!(market::asset_id(&market) == b"BASE_CHARIZARD_4_PSA_10", 0);
            assert!(market::strike_usd_cents(&market) == 1500000, 1);
            assert!(market::state(&market) == market::state_active(), 2);
            assert!(market::total_yes(&market) == 0, 3);
            assert!(market::total_no(&market) == 0, 4);
            assert!(market::yes_price_bps(&market) == 5000, 5); // 50/50 with no positions
            ts::return_shared(market);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = market::EExpiryInPast)]
    fun test_create_market_expired_fails() {
        let mut scenario = ts::begin(ADMIN);
        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_800_000_000_000);

            // Expiry is before current time
            market::create_market(
                &admin_cap,
                &registry,
                b"BASE_CHARIZARD_4_PSA_10",
                1500000,
                1_700_000_000_000, // in the past
                b"Past market",
                &clock,
                ts::ctx(&mut scenario),
            );

            clock::destroy_for_testing(clock);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }

    // ── Trading tests ───────────────────────────────────────────────────

    #[test]
    fun test_buy_yes_and_no() {
        let mut scenario = ts::begin(ADMIN);
        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        // Create market
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_700_000_000_000);
            market::create_market(
                &admin_cap, &registry,
                b"BASE_CHARIZARD_4_PSA_10", 1500000,
                1_800_000_000_000, b"Test market",
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
        };

        // Trader A buys 10 SUI of YES
        ts::next_tx(&mut scenario, TRADER_A);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_700_000_000_000);

            let payment = coin::mint_for_testing<SUI>(10 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_yes(&mut market, payment, &clock, ts::ctx(&mut scenario));

            assert!(market::total_yes(&market) == 10 * ONE_SUI, 0);
            assert!(market::total_no(&market) == 0, 1);
            assert!(market::pool_value(&market) == 10 * ONE_SUI, 2);
            // 100% YES probability
            assert!(market::yes_price_bps(&market) == 10000, 3);

            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Trader B buys 5 SUI of NO
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_700_000_000_000);

            let payment = coin::mint_for_testing<SUI>(5 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_no(&mut market, payment, &clock, ts::ctx(&mut scenario));

            assert!(market::total_yes(&market) == 10 * ONE_SUI, 4);
            assert!(market::total_no(&market) == 5 * ONE_SUI, 5);
            assert!(market::pool_value(&market) == 15 * ONE_SUI, 6);
            // YES: 10/15 = 6666 bps ≈ 66.66%
            assert!(market::yes_price_bps(&market) == 6666, 7);

            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }

    // ── Full lifecycle: trade → propose → finalize → claim ──────────────

    #[test]
    fun test_full_lifecycle_yes_wins() {
        let mut scenario = ts::begin(ADMIN);
        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        // 1. Create market: "Will Charizard exceed $15,000?"
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000_000_000_000); // t=1000s
            market::create_market(
                &admin_cap, &registry,
                b"BASE_CHARIZARD_4_PSA_10", 1500000,
                1_100_000_000_000, // expires at t=1100s
                b"Charizard > $15K?",
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
        };

        // 2. Trader A buys 10 SUI of YES
        ts::next_tx(&mut scenario, TRADER_A);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_050_000_000_000);
            let payment = coin::mint_for_testing<SUI>(10 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_yes(&mut market, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // 3. Trader B buys 5 SUI of NO
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_050_000_000_000);
            let payment = coin::mint_for_testing<SUI>(5 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_no(&mut market, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // 4. Oracle proposes resolution: $16,000 (YES wins)
        ts::next_tx(&mut scenario, ORACLE_OP);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_100_000_000_001); // just past expiry
            market::propose_resolution(
                &oracle_cap, &mut market, &registry,
                1600000, // $16,000 > $15,000 strike
                5,       // 5 sources
                &clock,
            );
            assert!(market::state(&market) == market::state_proposed(), 0);
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // 5. Finalize after dispute window (24h = 86_400_000ms)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            // proposed_at + DISPUTE_WINDOW_MS + 1
            clock::set_for_testing(&mut clock, 1_100_000_000_001 + 86_400_000 + 1);
            market::finalize(&mut market, &clock);
            assert!(market::is_settled(&market), 1);
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // 6. Trader A claims winnings (YES won → gets entire 15 SUI pool)
        ts::next_tx(&mut scenario, TRADER_A);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            market::claim(&mut market, ts::ctx(&mut scenario));
            // Trader A had 10 SUI of YES, total YES = 10 SUI, pool = 15 SUI
            // Payout = (10/10) × 15 = 15 SUI
            assert!(market::total_claimed(&market) == 15 * ONE_SUI, 2);
            ts::return_shared(market);
        };

        // 7. Trader B tries to claim (NO lost → should fail)
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let market = ts::take_shared<Market>(&scenario);
            // Trader B has no winning position — can't claim
            // (We don't test the failure here to keep the test passing;
            // see test_claim_loser_fails for the negative case)
            ts::return_shared(market);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = market::ENoWinningPosition)]
    fun test_claim_loser_fails() {
        let mut scenario = ts::begin(ADMIN);
        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        // Create + trade + resolve (YES wins)
        {
            let ctx = ts::ctx(&mut scenario);
            let mut clock = clock::create_for_testing(ctx);
            clock::set_for_testing(&mut clock, 1_000_000_000_000);
            market::create_market(
                &admin_cap, &registry,
                b"BASE_CHARIZARD_4_PSA_10", 1500000,
                1_100_000_000_000, b"Test",
                &clock, ctx,
            );
            clock::destroy_for_testing(clock);
        };

        // Trader B buys NO
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_050_000_000_000);
            let payment = coin::mint_for_testing<SUI>(5 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_no(&mut market, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Also need a YES buyer so total_winning > 0
        ts::next_tx(&mut scenario, TRADER_A);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_050_000_000_000);
            let payment = coin::mint_for_testing<SUI>(5 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_yes(&mut market, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Propose + finalize (YES wins)
        ts::next_tx(&mut scenario, ORACLE_OP);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_100_000_000_001);
            market::propose_resolution(
                &oracle_cap, &mut market, &registry,
                1600000, 5, &clock,
            );
            clock::set_for_testing(&mut clock, 1_100_000_000_001 + 86_400_001);
            market::finalize(&mut market, &clock);
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Trader B (NO) tries to claim — should fail
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            market::claim(&mut market, ts::ctx(&mut scenario));
            ts::return_shared(market);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }

    // ── Dispute flow test ───────────────────────────────────────────────

    #[test]
    fun test_dispute_and_admin_resolve() {
        let mut scenario = ts::begin(ADMIN);
        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        // Create market
        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000_000_000_000);
            market::create_market(
                &admin_cap, &registry,
                b"BASE_CHARIZARD_4_PSA_10", 1500000,
                1_100_000_000_000, b"Dispute test",
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
        };

        // Trader A buys YES, Trader B buys NO
        ts::next_tx(&mut scenario, TRADER_A);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_050_000_000_000);
            let payment = coin::mint_for_testing<SUI>(10 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_yes(&mut market, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_050_000_000_000);
            let payment = coin::mint_for_testing<SUI>(10 * ONE_SUI, ts::ctx(&mut scenario));
            market::buy_no(&mut market, payment, &clock, ts::ctx(&mut scenario));
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Oracle proposes $16,000 (YES would win)
        ts::next_tx(&mut scenario, ORACLE_OP);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_100_000_000_001);
            market::propose_resolution(
                &oracle_cap, &mut market, &registry,
                1600000, 5, &clock,
            );
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Disputer disputes with 10 SUI bond
        ts::next_tx(&mut scenario, DISPUTER);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_100_000_000_002);
            let bond = coin::mint_for_testing<SUI>(10 * ONE_SUI, ts::ctx(&mut scenario));
            market::dispute(&mut market, bond, &clock, ts::ctx(&mut scenario));
            assert!(market::state(&market) == market::state_disputed(), 0);
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Admin resolves: oracle was wrong, actual price was $14,000 (NO wins)
        // Return bond to disputer (dispute was valid)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            market::admin_resolve(
                &admin_cap, &mut market,
                1400000, // $14,000 < $15,000 strike → NO wins
                true,    // return bond
                ts::ctx(&mut scenario),
            );
            assert!(market::is_settled(&market), 1);
            ts::return_shared(market);
        };

        // Trader B (NO) claims winnings — gets entire 20 SUI pool
        ts::next_tx(&mut scenario, TRADER_B);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            market::claim(&mut market, ts::ctx(&mut scenario));
            assert!(market::total_claimed(&market) == 20 * ONE_SUI, 2);
            ts::return_shared(market);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }

    // ── Edge case: dispute window timing ────────────────────────────────

    #[test]
    #[expected_failure(abort_code = market::EDisputeWindowOpen)]
    fun test_finalize_too_early_fails() {
        let mut scenario = ts::begin(ADMIN);
        let (admin_cap, registry, oracle_cap) = setup_market_prereqs(&mut scenario);

        {
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_000_000_000_000);
            market::create_market(
                &admin_cap, &registry,
                b"BASE_CHARIZARD_4_PSA_10", 1500000,
                1_100_000_000_000, b"Early finalize test",
                &clock, ts::ctx(&mut scenario),
            );
            clock::destroy_for_testing(clock);
        };

        // Propose
        ts::next_tx(&mut scenario, ORACLE_OP);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            clock::set_for_testing(&mut clock, 1_100_000_000_001);
            market::propose_resolution(
                &oracle_cap, &mut market, &registry,
                1600000, 5, &clock,
            );
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        // Try to finalize within dispute window — should fail
        ts::next_tx(&mut scenario, ADMIN);
        {
            let mut market = ts::take_shared<Market>(&scenario);
            let mut clock = clock::create_for_testing(ts::ctx(&mut scenario));
            // Only 1 hour after proposal, not 24h
            clock::set_for_testing(&mut clock, 1_100_000_000_001 + 3_600_000);
            market::finalize(&mut market, &clock);
            clock::destroy_for_testing(clock);
            ts::return_shared(market);
        };

        oracle::destroy_oracle_cap_for_testing(oracle_cap);
        registry::destroy_registry_for_testing(registry);
        registry::destroy_admin_cap_for_testing(admin_cap);
        ts::end(scenario);
    }
}
