/// spawn.move — SpawnRecord objects and spawn fee collection on Sui.
/// Records lineage: parent_id → child_id with generation and timestamp.
/// Spawn fee is 0.01 SUI (10_000_000 MIST), paid to game treasury.
#[allow(lint(public_entry))]
module anima_swarm::spawn {
    use sui::clock::{Self, Clock};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID, ID};
    use anima_swarm::spirit::AdminCap;

    // ── Constants ─────────────────────────────────────────────────────────────

    /// Spawn fee: 0.01 SUI in MIST
    const SPAWN_FEE: u64 = 10_000_000;

    // ── Error codes ───────────────────────────────────────────────────────────

    const EInsufficientFee: u64 = 1;

    // ── Objects ───────────────────────────────────────────────────────────────

    /// An immutable record of a spirit spawning a child.
    public struct SpawnRecord has key, store {
        id: UID,
        /// Object ID of the parent spirit
        parent_id: ID,
        /// Object ID of the newly spawned child spirit
        child_id: ID,
        /// Generation of the child (parent.generation + 1)
        generation: u64,
        /// Unix timestamp (milliseconds) of the spawn
        timestamp: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Record a spawn. Requires AdminCap.
    /// Returns the SpawnRecord object.
    public fun record_spawn(
        _: &AdminCap,
        parent_id: ID,
        child_id: ID,
        generation: u64,
        clock: &Clock,
        ctx: &mut TxContext,
    ): SpawnRecord {
        SpawnRecord {
            id: object::new(ctx),
            parent_id,
            child_id,
            generation,
            timestamp: clock::timestamp_ms(clock),
        }
    }

    /// Record a spawn and transfer the record to a recipient.
    public entry fun record_spawn_and_transfer(
        cap: &AdminCap,
        parent_id: ID,
        child_id: ID,
        generation: u64,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = record_spawn(cap, parent_id, child_id, generation, clock, ctx);
        transfer::transfer(record, recipient);
    }

    /// Collect a spawn fee from the caller's coin.
    /// Splits SPAWN_FEE from the provided coin and transfers to recipient.
    public entry fun collect_fee(
        coin: &mut Coin<SUI>,
        recipient: address,
        ctx: &mut TxContext,
    ) {
        assert!(coin::value(coin) >= SPAWN_FEE, EInsufficientFee);
        let fee_coin = coin::split(coin, SPAWN_FEE, ctx);
        transfer::public_transfer(fee_coin, recipient);
    }

    // ── Read accessors ────────────────────────────────────────────────────────

    public fun parent_id(record: &SpawnRecord): ID { record.parent_id }
    public fun child_id(record: &SpawnRecord): ID { record.child_id }
    public fun generation(record: &SpawnRecord): u64 { record.generation }
    public fun timestamp(record: &SpawnRecord): u64 { record.timestamp }
    public fun spawn_fee(): u64 { SPAWN_FEE }
}
