/// battle.move — BattleRecord objects on Sui.
/// Immutable records of every battle, minted by the server (AdminCap required).
/// Stored as owned objects transferred to the winner's deity address.
#[allow(lint(public_entry))]
module anima_swarm::battle {
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID, ID};
    use anima_swarm::spirit::AdminCap;

    // ── Objects ───────────────────────────────────────────────────────────────

    /// An immutable record of a battle between two spirits.
    public struct BattleRecord has key, store {
        id: UID,
        /// Object ID of the attacking spirit
        attacker_id: ID,
        /// Object ID of the defending spirit
        defender_id: ID,
        /// Object ID of the winning spirit
        winner_id: ID,
        /// Battle margin score × 100 (e.g., 7250 = 72.50%)
        margin: u64,
        /// Terrain type where the battle occurred (UTF-8)
        terrain: vector<u8>,
        /// Unix timestamp (milliseconds) of the battle
        timestamp: u64,
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Record a battle. Requires AdminCap.
    /// Returns the BattleRecord object.
    public fun record(
        _: &AdminCap,
        attacker_id: ID,
        defender_id: ID,
        winner_id: ID,
        margin: u64,
        terrain: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ): BattleRecord {
        BattleRecord {
            id: object::new(ctx),
            attacker_id,
            defender_id,
            winner_id,
            margin,
            terrain,
            timestamp: clock::timestamp_ms(clock),
        }
    }

    /// Record a battle and transfer the record to a recipient.
    public entry fun record_and_transfer(
        cap: &AdminCap,
        attacker_id: ID,
        defender_id: ID,
        winner_id: ID,
        margin: u64,
        terrain: vector<u8>,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let record = record(cap, attacker_id, defender_id, winner_id, margin, terrain, clock, ctx);
        transfer::transfer(record, recipient);
    }

    // ── Read accessors ────────────────────────────────────────────────────────

    public fun attacker_id(record: &BattleRecord): ID { record.attacker_id }
    public fun defender_id(record: &BattleRecord): ID { record.defender_id }
    public fun winner_id(record: &BattleRecord): ID { record.winner_id }
    public fun margin(record: &BattleRecord): u64 { record.margin }
    public fun terrain(record: &BattleRecord): &vector<u8> { &record.terrain }
    public fun timestamp(record: &BattleRecord): u64 { record.timestamp }
}
