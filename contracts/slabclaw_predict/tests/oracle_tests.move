#[test_only]
module slabclaw_predict::oracle_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock::{Self};
    use slabclaw_predict::oracle::{Self};
    use slabclaw_predict::registry;

    const ADMIN: address = @0xAD;
    const ORACLE_OP: address = @0x0AC;

    #[test]
    fun test_authorize_oracle() {
        let mut scenario = ts::begin(ADMIN);

        // Admin authorizes oracle operator
        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            oracle::authorize_oracle(&admin_cap, ORACLE_OP, ctx);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };

        // Oracle operator should have received OracleCap
        ts::next_tx(&mut scenario, ORACLE_OP);
        {
            let cap = ts::take_from_sender<oracle::OracleCap>(&scenario);
            assert!(oracle::oracle_operator(&cap) == ORACLE_OP, 0);
            ts::return_to_sender(&scenario, cap);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_attest_price() {
        let mut scenario = ts::begin(ORACLE_OP);

        {
            let ctx = ts::ctx(&mut scenario);
            let cap = oracle::create_oracle_cap_for_testing(ctx);
            let mut clock = clock::create_for_testing(ctx);
            clock::set_for_testing(&mut clock, 1_700_000_000_000); // ~2023

            let att = oracle::attest_price(
                &cap,
                b"BASE_CHARIZARD_4_PSA_10",
                1500000, // $15,000.00
                5,       // 5 sources
                &clock,
            );

            assert!(oracle::attestation_price(&att) == 1500000, 0);
            assert!(oracle::attestation_sources(&att) == 5, 1);
            assert!(oracle::attestation_timestamp(&att) == 1_700_000_000_000, 2);
            assert!(oracle::attestation_asset_id(&att) == b"BASE_CHARIZARD_4_PSA_10", 3);

            clock::destroy_for_testing(clock);
            oracle::destroy_oracle_cap_for_testing(cap);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle::EInsufficientSources)]
    fun test_attest_too_few_sources_fails() {
        let mut scenario = ts::begin(ORACLE_OP);

        {
            let ctx = ts::ctx(&mut scenario);
            let cap = oracle::create_oracle_cap_for_testing(ctx);
            let clock = clock::create_for_testing(ctx);

            // Only 2 sources — below MIN_SOURCES (3)
            let _att = oracle::attest_price(
                &cap,
                b"TEST_ASSET",
                1000,
                2,
                &clock,
            );

            clock::destroy_for_testing(clock);
            oracle::destroy_oracle_cap_for_testing(cap);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle::EInvalidPrice)]
    fun test_attest_zero_price_fails() {
        let mut scenario = ts::begin(ORACLE_OP);

        {
            let ctx = ts::ctx(&mut scenario);
            let cap = oracle::create_oracle_cap_for_testing(ctx);
            let clock = clock::create_for_testing(ctx);

            let _att = oracle::attest_price(
                &cap,
                b"TEST_ASSET",
                0, // zero price
                5,
                &clock,
            );

            clock::destroy_for_testing(clock);
            oracle::destroy_oracle_cap_for_testing(cap);
        };

        ts::end(scenario);
    }
}
