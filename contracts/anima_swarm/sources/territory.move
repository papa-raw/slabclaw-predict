/// territory.move — GameMap shared object for territory claims.
/// Tracks which address controls each hex by hex_id string.
/// One GameMap per game, shared object so all players can read/update.
#[allow(lint(public_entry))]
module anima_swarm::territory {
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use anima_swarm::spirit::AdminCap;

    // ── Objects ───────────────────────────────────────────────────────────────

    /// Shared object: maps hex_id (UTF-8 string bytes) → controller address.
    public struct GameMap has key {
        id: UID,
        /// hex_id → controller address
        claims: Table<vector<u8>, address>,
        /// Total hexes claimed (monotonically increasing)
        total_claims: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Create a new GameMap and share it. Called once per game deployment.
    public entry fun create_map(ctx: &mut TxContext) {
        let map = GameMap {
            id: object::new(ctx),
            claims: table::new(ctx),
            total_claims: 0,
        };
        transfer::share_object(map);
    }

    /// Claim a hex for a controller address. Requires AdminCap.
    /// Overwrites any existing claim (territory is contested).
    public entry fun claim_hex(
        _: &AdminCap,
        map: &mut GameMap,
        hex_id: vector<u8>,
        controller: address,
    ) {
        if (table::contains(&map.claims, hex_id)) {
            // Update existing claim
            let existing = table::borrow_mut(&mut map.claims, hex_id);
            *existing = controller;
        } else {
            table::add(&mut map.claims, hex_id, controller);
            map.total_claims = map.total_claims + 1;
        };
    }

    /// Release a hex claim (e.g., when a spirit dies and holds no territory).
    public entry fun release_hex(
        _: &AdminCap,
        map: &mut GameMap,
        hex_id: vector<u8>,
    ) {
        if (table::contains(&map.claims, hex_id)) {
            table::remove(&mut map.claims, hex_id);
        };
    }

    // ── Read accessors ────────────────────────────────────────────────────────

    /// Get the controller of a hex (returns 0x0 if unclaimed).
    public fun get_controller(map: &GameMap, hex_id: vector<u8>): address {
        if (table::contains(&map.claims, hex_id)) {
            *table::borrow(&map.claims, hex_id)
        } else {
            @0x0
        }
    }

    public fun is_claimed(map: &GameMap, hex_id: vector<u8>): bool {
        table::contains(&map.claims, hex_id)
    }

    public fun total_claims(map: &GameMap): u64 {
        map.total_claims
    }
}
