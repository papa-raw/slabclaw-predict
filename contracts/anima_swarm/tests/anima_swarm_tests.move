#[test_only]
module anima_swarm::anima_swarm_tests {
    use sui::clock;
    use sui::test_scenario::{Self as ts};
    use sui::coin;
    use sui::sui::SUI;
    use std::option;
    use anima_swarm::spirit::{Self, Spirit, AdminCap};
    use anima_swarm::battle::{Self, BattleRecord};
    use anima_swarm::territory::{Self, GameMap};
    use anima_swarm::spawn::{Self};

    // ── Test addresses ─────────────────────────────────────────────────────────

    const ADMIN: address = @0xAD;
    const PLAYER: address = @0xBB;

    // ── Test 1: Mint spirit ───────────────────────────────────────────────────

    #[test]
    fun test_mint_spirit() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let cap = spirit::create_admin_cap_for_testing(ctx);
            let clk = clock::create_for_testing(ctx);

            let s = spirit::mint(
                &cap,
                b"Ignis",
                b"abc123",
                0,
                option::none(),
                &clk,
                ctx,
            );

            // Verify fields via accessors
            assert!(*spirit::name(&s) == b"Ignis", 1);
            assert!(*spirit::personality_hash(&s) == b"abc123", 2);
            assert!(spirit::generation(&s) == 0, 3);
            assert!(option::is_none(spirit::parent_id(&s)), 4);

            // Clean up: Spirit has store so public_transfer is valid
            sui::transfer::public_transfer(s, ADMIN);
            // AdminCap has key only (no store) — use test helper to destroy
            spirit::destroy_admin_cap_for_testing(cap);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ── Test 2: Record battle ─────────────────────────────────────────────────

    #[test]
    fun test_record_battle() {
        let mut scenario = ts::begin(ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let cap = spirit::create_admin_cap_for_testing(ctx);
            let clk = clock::create_for_testing(ctx);

            // Create two dummy spirits to get their IDs
            let attacker = spirit::mint(&cap, b"Ignis", b"h1", 0, option::none(), &clk, ctx);
            let defender = spirit::mint(&cap, b"Aeron", b"h2", 0, option::none(), &clk, ctx);

            let attacker_id = sui::object::id(&attacker);
            let defender_id = sui::object::id(&defender);
            let winner_id = attacker_id;

            let rec = battle::record(
                &cap,
                attacker_id,
                defender_id,
                winner_id,
                7250, // 72.50% margin × 100
                b"forest",
                &clk,
                ctx,
            );

            assert!(battle::attacker_id(&rec) == attacker_id, 1);
            assert!(battle::defender_id(&rec) == defender_id, 2);
            assert!(battle::winner_id(&rec) == winner_id, 3);
            assert!(battle::margin(&rec) == 7250, 4);
            assert!(*battle::terrain(&rec) == b"forest", 5);

            // Clean up
            sui::transfer::public_transfer(attacker, ADMIN);
            sui::transfer::public_transfer(defender, ADMIN);
            sui::transfer::public_transfer(rec, ADMIN);
            spirit::destroy_admin_cap_for_testing(cap);
            clock::destroy_for_testing(clk);
        };
        ts::end(scenario);
    }

    // ── Test 3: Claim hex ─────────────────────────────────────────────────────

    #[test]
    fun test_claim_hex() {
        let mut scenario = ts::begin(ADMIN);

        // Create the shared GameMap
        {
            let ctx = ts::ctx(&mut scenario);
            territory::create_map(ctx);
        };

        ts::next_tx(&mut scenario, ADMIN);
        {
            let ctx = ts::ctx(&mut scenario);
            let cap = spirit::create_admin_cap_for_testing(ctx);
            let mut map = ts::take_shared<GameMap>(&scenario);

            // Claim hex "0001" for PLAYER
            territory::claim_hex(&cap, &mut map, b"0001", PLAYER);

            assert!(territory::get_controller(&map, b"0001") == PLAYER, 1);
            assert!(territory::is_claimed(&map, b"0001"), 2);
            assert!(territory::total_claims(&map) == 1, 3);

            // Claim a second hex
            territory::claim_hex(&cap, &mut map, b"0002", ADMIN);
            assert!(territory::total_claims(&map) == 2, 4);

            // Overwrite first hex (contested territory)
            territory::claim_hex(&cap, &mut map, b"0001", ADMIN);
            assert!(territory::get_controller(&map, b"0001") == ADMIN, 5);
            // total_claims stays at 2 (update, not new entry)
            assert!(territory::total_claims(&map) == 2, 6);

            ts::return_shared(map);
            spirit::destroy_admin_cap_for_testing(cap);
        };
        ts::end(scenario);
    }

    // ── Test 4: Collect spawn fee ─────────────────────────────────────────────

    #[test]
    fun test_collect_spawn_fee() {
        let mut scenario = ts::begin(PLAYER);
        {
            let ctx = ts::ctx(&mut scenario);
            // Mint a test coin with 0.02 SUI (20_000_000 MIST)
            let mut coin = coin::mint_for_testing<SUI>(20_000_000, ctx);

            assert!(coin::value(&coin) == 20_000_000, 1);

            // Collect fee: 10_000_000 MIST goes to ADMIN
            spawn::collect_fee(&mut coin, ADMIN, ctx);

            // Remaining balance should be 10_000_000
            assert!(coin::value(&coin) == 10_000_000, 2);

            // Verify spawn fee constant
            assert!(spawn::spawn_fee() == 10_000_000, 3);

            sui::transfer::public_transfer(coin, PLAYER);
        };
        ts::end(scenario);
    }
}
