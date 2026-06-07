#[test_only]
module slabclaw_predict::registry_tests {
    use sui::test_scenario::{Self as ts};
    use slabclaw_predict::registry::{Self, AdminCap, AssetRegistry};

    const ADMIN: address = @0xAD;

    #[test]
    fun test_register_asset() {
        let mut scenario = ts::begin(ADMIN);

        // Init creates AdminCap + AssetRegistry
        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut registry = registry::create_registry_for_testing(ctx);

            // Register a PSA 10 Base Set Charizard
            registry::register_asset(
                &admin_cap,
                &mut registry,
                b"BASE_CHARIZARD_4_PSA_10",
                b"Base Set",
                b"4",
                b"PSA",
                1000, // 10.0 grade
                5,    // 5 platform sources
            );

            assert!(registry::total_assets(&registry) == 1, 0);
            assert!(registry::is_active(&registry, b"BASE_CHARIZARD_4_PSA_10"), 1);

            // Verify asset details
            let asset = registry::get_asset(&registry, b"BASE_CHARIZARD_4_PSA_10");
            assert!(registry::grade_bps(asset) == 1000, 2);
            assert!(registry::platform_count(asset) == 5, 3);
            assert!(registry::active(asset) == true, 4);

            registry::destroy_registry_for_testing(registry);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_deactivate_reactivate() {
        let mut scenario = ts::begin(ADMIN);

        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut registry = registry::create_registry_for_testing(ctx);

            registry::register_asset(
                &admin_cap,
                &mut registry,
                b"JUNGLE_PIKACHU_60_PSA_10",
                b"Jungle",
                b"60",
                b"PSA",
                1000,
                3,
            );

            assert!(registry::is_active(&registry, b"JUNGLE_PIKACHU_60_PSA_10"), 0);

            // Deactivate
            registry::deactivate_asset(&admin_cap, &mut registry, b"JUNGLE_PIKACHU_60_PSA_10");
            assert!(!registry::is_active(&registry, b"JUNGLE_PIKACHU_60_PSA_10"), 1);

            // Reactivate
            registry::reactivate_asset(&admin_cap, &mut registry, b"JUNGLE_PIKACHU_60_PSA_10");
            assert!(registry::is_active(&registry, b"JUNGLE_PIKACHU_60_PSA_10"), 2);

            registry::destroy_registry_for_testing(registry);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::EAssetAlreadyRegistered)]
    fun test_duplicate_registration_fails() {
        let mut scenario = ts::begin(ADMIN);

        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut registry = registry::create_registry_for_testing(ctx);

            registry::register_asset(
                &admin_cap, &mut registry,
                b"DUPE_TEST", b"Set", b"1", b"PSA", 1000, 3,
            );
            // Second registration should abort
            registry::register_asset(
                &admin_cap, &mut registry,
                b"DUPE_TEST", b"Set", b"1", b"PSA", 1000, 3,
            );

            registry::destroy_registry_for_testing(registry);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::EInvalidGrade)]
    fun test_invalid_grade_fails() {
        let mut scenario = ts::begin(ADMIN);

        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut registry = registry::create_registry_for_testing(ctx);

            // Grade 0 is invalid
            registry::register_asset(
                &admin_cap, &mut registry,
                b"BAD_GRADE", b"Set", b"1", b"PSA", 0, 3,
            );

            registry::destroy_registry_for_testing(registry);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_nonexistent_asset_not_active() {
        let mut scenario = ts::begin(ADMIN);

        {
            let ctx = ts::ctx(&mut scenario);
            let registry = registry::create_registry_for_testing(ctx);

            assert!(!registry::is_active(&registry, b"DOES_NOT_EXIST"), 0);

            registry::destroy_registry_for_testing(registry);
        };

        ts::end(scenario);
    }
}
