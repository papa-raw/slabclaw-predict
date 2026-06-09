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

    // ── Governance config ────────────────────────────────────────────────

    #[test]
    fun test_config_setters() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut config = registry::create_config_for_testing(ctx);

            // Genesis defaults
            assert!(registry::min_dispute_bond(&config) == 10_000_000_000, 0);
            assert!(registry::dispute_window_ms(&config) == 86_400_000, 1);
            assert!(registry::min_sources(&config) == 3, 2);

            // Governance tunes them
            registry::set_min_dispute_bond(&admin_cap, &mut config, 25_000_000_000);
            registry::set_dispute_window_ms(&admin_cap, &mut config, 43_200_000);
            registry::set_min_sources(&admin_cap, &mut config, 5);

            assert!(registry::min_dispute_bond(&config) == 25_000_000_000, 3);
            assert!(registry::dispute_window_ms(&config) == 43_200_000, 4);
            assert!(registry::min_sources(&config) == 5, 5);

            registry::destroy_config_for_testing(config);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::EInvalidConfig)]
    fun test_config_zero_rejected() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut config = registry::create_config_for_testing(ctx);
            registry::set_min_sources(&admin_cap, &mut config, 0); // aborts EInvalidConfig
            registry::destroy_config_for_testing(config);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };
        ts::end(scenario);
    }

    // ── Upgrade safety ───────────────────────────────────────────────────

    #[test]
    fun test_migrate_registry() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut registry = registry::create_registry_for_testing(ctx);

            // Simulate a pre-upgrade object stuck at an older version
            registry::set_registry_version_for_testing(&mut registry, 0);
            assert!(registry::registry_version(&registry) == 0, 0);

            registry::migrate_registry(&admin_cap, &mut registry);
            assert!(registry::registry_version(&registry) == registry::version(), 1);

            registry::destroy_registry_for_testing(registry);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = registry::EWrongVersion)]
    fun test_register_wrong_version_fails() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let admin_cap = registry::create_admin_cap_for_testing(ctx);
            let mut registry = registry::create_registry_for_testing(ctx);
            // A stale (un-migrated) registry must reject state mutations
            registry::set_registry_version_for_testing(&mut registry, 0);
            registry::register_asset(
                &admin_cap, &mut registry,
                b"STALE", b"Set", b"1", b"PSA", 1000, 3,
            );
            registry::destroy_registry_for_testing(registry);
            registry::destroy_admin_cap_for_testing(admin_cap);
        };
        ts::end(scenario);
    }
}
