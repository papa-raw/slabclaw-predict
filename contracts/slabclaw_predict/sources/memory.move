/// memory.move — Onchain anchor for the swarm's Walrus-persisted memory.
///
/// The oracle swarm snapshots its entire MemWal state (per-card calibrations,
/// source reputations, warm caches, anomaly history) to Walrus every round.
/// This module anchors the LATEST snapshot blob id onchain, making the memory
/// lineage operator-independent: any fresh node reads the pointer from chain,
/// fetches the blob from a Walrus aggregator, and cold-starts the full swarm.
/// Same trust pattern as market settlement evidence (`evidence_blob_id`),
/// applied to the agents' memory itself.
#[allow(lint(public_entry))]
module slabclaw_predict::memory {
    use sui::object::{Self, UID};
    use sui::tx_context::TxContext;
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use slabclaw_predict::registry::AdminCap;
    use slabclaw_predict::oracle::OracleCap;

    // ── Objects ─────────────────────────────────────────────────────────

    /// Shared singleton: the canonical pointer to the swarm's latest memory
    /// snapshot on Walrus. Anyone can read it; only the authorized oracle
    /// operator can advance it.
    public struct SwarmMemory has key {
        id: UID,
        /// Walrus blob id (base64url string bytes) of the latest MemWal snapshot
        latest_blob_id: vector<u8>,
        /// Number of files in the snapshot (cheap integrity signal for restorers)
        file_count: u64,
        /// When the snapshot was checkpointed (ms since epoch, onchain clock)
        checkpointed_at_ms: u64,
        /// Monotonic checkpoint counter
        round: u64,
    }

    // ── Events ──────────────────────────────────────────────────────────

    public struct MemoryCheckpointed has copy, drop {
        blob_id: vector<u8>,
        file_count: u64,
        checkpointed_at_ms: u64,
        round: u64,
    }

    // ── Error codes ─────────────────────────────────────────────────────

    const EMissingBlob: u64 = 0;

    // ── Admin functions ─────────────────────────────────────────────────

    /// Create and share the SwarmMemory anchor. Admin-gated, run once after
    /// the package upgrade that introduced this module (init does not re-run
    /// on upgrades).
    public entry fun create(_admin: &AdminCap, ctx: &mut TxContext) {
        transfer::share_object(SwarmMemory {
            id: object::new(ctx),
            latest_blob_id: std::vector::empty(),
            file_count: 0,
            checkpointed_at_ms: 0,
            round: 0,
        });
    }

    // ── Oracle functions ────────────────────────────────────────────────

    /// Anchor a new memory snapshot. OracleCap-gated — the same trust level
    /// as price attestations: whoever may price markets may advance memory.
    public entry fun checkpoint(
        _cap: &OracleCap,
        mem: &mut SwarmMemory,
        blob_id: vector<u8>,
        file_count: u64,
        clock: &Clock,
    ) {
        assert!(std::vector::length(&blob_id) > 0, EMissingBlob);
        mem.latest_blob_id = blob_id;
        mem.file_count = file_count;
        mem.checkpointed_at_ms = clock::timestamp_ms(clock);
        mem.round = mem.round + 1;
        event::emit(MemoryCheckpointed {
            blob_id: mem.latest_blob_id,
            file_count,
            checkpointed_at_ms: mem.checkpointed_at_ms,
            round: mem.round,
        });
    }

    // ── Read accessors ──────────────────────────────────────────────────

    public fun latest_blob_id(m: &SwarmMemory): vector<u8> { m.latest_blob_id }
    public fun file_count(m: &SwarmMemory): u64 { m.file_count }
    public fun checkpointed_at_ms(m: &SwarmMemory): u64 { m.checkpointed_at_ms }
    public fun round(m: &SwarmMemory): u64 { m.round }

    // ── Test helpers ────────────────────────────────────────────────────

    #[test_only]
    public fun create_for_testing(ctx: &mut TxContext): SwarmMemory {
        SwarmMemory {
            id: object::new(ctx),
            latest_blob_id: std::vector::empty(),
            file_count: 0,
            checkpointed_at_ms: 0,
            round: 0,
        }
    }

    #[test_only]
    public fun destroy_for_testing(m: SwarmMemory) {
        let SwarmMemory { id, latest_blob_id: _, file_count: _, checkpointed_at_ms: _, round: _ } = m;
        object::delete(id);
    }
}
