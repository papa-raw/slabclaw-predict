/// spirit.move — Spirit NFT on Sui (v2).
/// Spirits are owned objects minted by the server (AdminCap required).
/// v2 adds: specialization, memwal linkage, essence blob, avatar, status,
/// lifetime stats, and reincarnation tracking.
#[allow(lint(public_entry))]
module anima_swarm::spirit {
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID, ID};
    use std::option::{Self, Option};
    // ── Capability ────────────────────────────────────────────────────────────

    public struct AdminCap has key {
        id: UID,
    }

    // ── Objects ───────────────────────────────────────────────────────────────

    /// A Spirit NFT: an AI swarm member with persistent identity.
    /// Status codes: 0 = alive, 1 = dead, 2 = ghost (entered graveyard)
    public struct Spirit has key, store {
        id: UID,
        name: vector<u8>,
        personality_hash: vector<u8>,
        generation: u64,
        created_at: u64,
        owner: address,
        parent_id: Option<ID>,
        specialization: vector<u8>,
        memwal_account_id: vector<u8>,
        essence_blob_id: vector<u8>,
        avatar_blob_id: vector<u8>,
        status: u8,
        games_played: u64,
        total_kills: u64,
        total_hexes_claimed: u64,
        bond_depth: u64,
        bond_loyalty: u64,
        reincarnation_count: u64,
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Mint a v2 Spirit with all fields and transfer to recipient.
    public entry fun mint_v2(
        _: &AdminCap,
        name: vector<u8>,
        personality_hash: vector<u8>,
        generation: u64,
        parent_id: Option<ID>,
        specialization: vector<u8>,
        memwal_account_id: vector<u8>,
        avatar_blob_id: vector<u8>,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let spirit = Spirit {
            id: object::new(ctx),
            name,
            personality_hash,
            generation,
            created_at: clock::timestamp_ms(clock),
            owner: recipient,
            parent_id,
            specialization,
            memwal_account_id,
            essence_blob_id: vector[],
            avatar_blob_id,
            status: 0,
            games_played: 0,
            total_kills: 0,
            total_hexes_claimed: 0,
            bond_depth: 0,
            bond_loyalty: 0,
            reincarnation_count: 0,
        };
        transfer::transfer(spirit, recipient);
    }

    /// Legacy mint (v1 compat) — returns Spirit for caller to transfer.
    public fun mint(
        _: &AdminCap,
        name: vector<u8>,
        personality_hash: vector<u8>,
        generation: u64,
        parent_id: Option<ID>,
        clock: &Clock,
        ctx: &mut TxContext,
    ): Spirit {
        Spirit {
            id: object::new(ctx),
            name,
            personality_hash,
            generation,
            created_at: clock::timestamp_ms(clock),
            owner: tx_context::sender(ctx),
            parent_id,
            specialization: vector[],
            memwal_account_id: vector[],
            essence_blob_id: vector[],
            avatar_blob_id: vector[],
            status: 0,
            games_played: 0,
            total_kills: 0,
            total_hexes_claimed: 0,
            bond_depth: 0,
            bond_loyalty: 0,
            reincarnation_count: 0,
        }
    }

    /// Legacy mint_to (v1 compat).
    public entry fun mint_to(
        cap: &AdminCap,
        name: vector<u8>,
        personality_hash: vector<u8>,
        generation: u64,
        parent_id: Option<ID>,
        recipient: address,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let spirit = mint(cap, name, personality_hash, generation, parent_id, clock, ctx);
        transfer::transfer(spirit, recipient);
    }

    /// Update spirit stats after a game ends.
    public entry fun update_post_game(
        _: &AdminCap,
        spirit: &mut Spirit,
        essence_blob_id: vector<u8>,
        status: u8,
        kills: u64,
        hexes: u64,
        bond_depth: u64,
        bond_loyalty: u64,
        games_played: u64,
    ) {
        spirit.essence_blob_id = essence_blob_id;
        spirit.status = status;
        spirit.total_kills = spirit.total_kills + kills;
        spirit.total_hexes_claimed = spirit.total_hexes_claimed + hexes;
        spirit.bond_depth = bond_depth;
        spirit.bond_loyalty = bond_loyalty;
        spirit.games_played = games_played;
    }

    /// Mark a spirit as ghost (entered the graveyard).
    public entry fun mark_ghost(
        _: &AdminCap,
        spirit: &mut Spirit,
    ) {
        spirit.status = 2;
    }

    /// Reincarnate: reset status to alive, increment reincarnation count.
    public entry fun reincarnate(
        _: &AdminCap,
        spirit: &mut Spirit,
    ) {
        spirit.status = 0;
        spirit.reincarnation_count = spirit.reincarnation_count + 1;
    }

    /// Update avatar blob ID.
    public entry fun set_avatar(
        _: &AdminCap,
        spirit: &mut Spirit,
        avatar_blob_id: vector<u8>,
    ) {
        spirit.avatar_blob_id = avatar_blob_id;
    }

    // ── Read accessors ────────────────────────────────────────────────────────

    public fun name(spirit: &Spirit): &vector<u8> { &spirit.name }
    public fun personality_hash(spirit: &Spirit): &vector<u8> { &spirit.personality_hash }
    public fun generation(spirit: &Spirit): u64 { spirit.generation }
    public fun created_at(spirit: &Spirit): u64 { spirit.created_at }
    public fun owner(spirit: &Spirit): address { spirit.owner }
    public fun parent_id(spirit: &Spirit): &Option<ID> { &spirit.parent_id }
    public fun id(spirit: &Spirit): &UID { &spirit.id }
    public fun specialization(spirit: &Spirit): &vector<u8> { &spirit.specialization }
    public fun status(spirit: &Spirit): u8 { spirit.status }
    public fun games_played(spirit: &Spirit): u64 { spirit.games_played }
    public fun total_kills(spirit: &Spirit): u64 { spirit.total_kills }
    public fun total_hexes_claimed(spirit: &Spirit): u64 { spirit.total_hexes_claimed }
    public fun reincarnation_count(spirit: &Spirit): u64 { spirit.reincarnation_count }

    // ── Tests ─────────────────────────────────────────────────────────────────

    #[test_only]
    public fun create_admin_cap_for_testing(ctx: &mut TxContext): AdminCap {
        AdminCap { id: object::new(ctx) }
    }

    #[test_only]
    public fun destroy_admin_cap_for_testing(cap: AdminCap) {
        let AdminCap { id } = cap;
        object::delete(id);
    }
}
