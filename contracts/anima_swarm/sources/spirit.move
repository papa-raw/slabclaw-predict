/// spirit.move — Spirit NFT on Sui.
/// Spirits are owned objects minted by the server (AdminCap required).
/// Each spirit has a name, personality hash, generation, creation timestamp,
/// owner address, and optional parent ID for lineage tracking.
#[allow(lint(public_entry))]
module anima_swarm::spirit {
    use sui::clock::{Self, Clock};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID, ID};
    use std::option::{Self, Option};

    // ── Capability ────────────────────────────────────────────────────────────

    /// Capability required for server-side minting operations.
    public struct AdminCap has key {
        id: UID,
    }

    // ── Objects ───────────────────────────────────────────────────────────────

    /// A Spirit NFT: an AI swarm member with persistent identity.
    public struct Spirit has key, store {
        id: UID,
        /// Display name (UTF-8 encoded)
        name: vector<u8>,
        /// SHA-256 of personality prompt, for verifiable identity
        personality_hash: vector<u8>,
        /// Generation number (0 = seed spirit, +1 per spawn)
        generation: u64,
        /// Unix timestamp (milliseconds) when minted
        created_at: u64,
        /// Current owner address (transfers on realm handoff)
        owner: address,
        /// Object ID of parent spirit; none for gen-0 spirits
        parent_id: Option<ID>,
    }

    // ── Init ──────────────────────────────────────────────────────────────────

    /// Package initializer: creates and transfers AdminCap to the publisher.
    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));
    }

    // ── Entry functions ───────────────────────────────────────────────────────

    /// Mint a new Spirit. Requires AdminCap.
    /// Returns the Spirit object (caller must transfer or share).
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
        }
    }

    /// Mint and immediately transfer to a recipient address.
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

    // ── Read accessors ────────────────────────────────────────────────────────

    public fun name(spirit: &Spirit): &vector<u8> { &spirit.name }
    public fun personality_hash(spirit: &Spirit): &vector<u8> { &spirit.personality_hash }
    public fun generation(spirit: &Spirit): u64 { spirit.generation }
    public fun created_at(spirit: &Spirit): u64 { spirit.created_at }
    public fun owner(spirit: &Spirit): address { spirit.owner }
    public fun parent_id(spirit: &Spirit): &Option<ID> { &spirit.parent_id }
    public fun id(spirit: &Spirit): &UID { &spirit.id }

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
