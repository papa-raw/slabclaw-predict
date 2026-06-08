/// oracle.move — Oracle interface for SlabClaw prediction markets.
/// Manages oracle operator authorization and price attestations.
/// OracleCap holders can propose settlement prices for expired markets.
///
/// Architecture note: DeepBook Predict requires AdminCap (held by Mysten Labs)
/// to create custom oracles. We build our own oracle + settlement contracts
/// instead, composable with DeepBook Spot for secondary position trading (v2).
#[allow(lint(public_entry))]
module slabclaw_predict::oracle {
    use sui::object::{Self, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::event;
    use sui::clock::{Self, Clock};
    use slabclaw_predict::registry::AdminCap;

    // ── Objects ─────────────────────────────────────────────────────────

    /// Oracle operator capability. Authorizes submission of price attestations.
    /// Created by admin via authorize_oracle(), transferred to operator address.
    public struct OracleCap has key, store {
        id: UID,
        /// Authorized operator address
        operator: address,
    }

    /// A price attestation from the off-chain oracle.
    /// Created by oracle operator, consumed by market resolution.
    /// Not an object (no key) — passed by value in programmable transaction blocks.
    public struct PriceAttestation has store, copy, drop {
        /// Asset class ID (must match registry entry)
        asset_id: vector<u8>,
        /// Settlement price in USD cents (e.g., 1500000 = $15,000.00)
        price_usd_cents: u64,
        /// Timestamp of price observation (ms since epoch)
        timestamp_ms: u64,
        /// Number of marketplace sources that contributed to this price
        sources_count: u64,
        /// Walrus blob id of the verifiable evidence for this attestation
        evidence_blob_id: vector<u8>,
    }

    // ── Events ──────────────────────────────────────────────────────────

    public struct OracleAuthorized has copy, drop {
        operator: address,
    }

    public struct PriceAttested has copy, drop {
        asset_id: vector<u8>,
        price_usd_cents: u64,
        timestamp_ms: u64,
        sources_count: u64,
        evidence_blob_id: vector<u8>,
    }

    // ── Admin functions ─────────────────────────────────────────────────

    /// Authorize a new oracle operator. Requires AdminCap from registry.
    /// The OracleCap is transferred to the operator address.
    public entry fun authorize_oracle(
        _admin: &AdminCap,
        operator: address,
        ctx: &mut TxContext,
    ) {
        let cap = OracleCap {
            id: object::new(ctx),
            operator,
        };
        event::emit(OracleAuthorized { operator });
        transfer::transfer(cap, operator);
    }

    // ── Oracle functions ────────────────────────────────────────────────

    /// Create a price attestation. Called by oracle operator.
    /// Returns the attestation by value — caller passes it to market resolution.
    /// Enforces minimum source count (3 platforms must agree).
    public fun attest_price(
        _cap: &OracleCap,
        asset_id: vector<u8>,
        price_usd_cents: u64,
        sources_count: u64,
        evidence_blob_id: vector<u8>,
        clock: &Clock,
    ): PriceAttestation {
        assert!(sources_count >= MIN_SOURCES, EInsufficientSources);
        assert!(price_usd_cents > 0, EInvalidPrice);
        // A market cannot settle without verifiable Walrus evidence.
        assert!(std::vector::length(&evidence_blob_id) > 0, EMissingEvidence);

        let timestamp_ms = clock::timestamp_ms(clock);

        event::emit(PriceAttested {
            asset_id,
            price_usd_cents,
            timestamp_ms,
            sources_count,
            evidence_blob_id,
        });

        PriceAttestation {
            asset_id,
            price_usd_cents,
            timestamp_ms,
            sources_count,
            evidence_blob_id,
        }
    }

    // ── Read accessors ──────────────────────────────────────────────────

    public fun attestation_asset_id(att: &PriceAttestation): vector<u8> { att.asset_id }
    public fun attestation_price(att: &PriceAttestation): u64 { att.price_usd_cents }
    public fun attestation_timestamp(att: &PriceAttestation): u64 { att.timestamp_ms }
    public fun attestation_sources(att: &PriceAttestation): u64 { att.sources_count }
    public fun attestation_evidence(att: &PriceAttestation): vector<u8> { att.evidence_blob_id }
    public fun oracle_operator(cap: &OracleCap): address { cap.operator }

    // ── Constants ───────────────────────────────────────────────────────

    /// Minimum number of marketplace sources required for a valid attestation.
    /// SlabClaw oracle aggregates from 10 platforms; 3 is the safety floor.
    const MIN_SOURCES: u64 = 3;

    // ── Error codes ─────────────────────────────────────────────────────

    const EInsufficientSources: u64 = 0;
    const EInvalidPrice: u64 = 1;
    const EMissingEvidence: u64 = 2;

    // ── Test helpers ────────────────────────────────────────────────────

    #[test_only]
    public fun create_oracle_cap_for_testing(ctx: &mut TxContext): OracleCap {
        OracleCap {
            id: object::new(ctx),
            operator: tx_context::sender(ctx),
        }
    }

    #[test_only]
    public fun destroy_oracle_cap_for_testing(cap: OracleCap) {
        let OracleCap { id, operator: _ } = cap;
        object::delete(id);
    }

    #[test_only]
    public fun create_attestation_for_testing(
        asset_id: vector<u8>,
        price_usd_cents: u64,
        timestamp_ms: u64,
        sources_count: u64,
        evidence_blob_id: vector<u8>,
    ): PriceAttestation {
        PriceAttestation {
            asset_id,
            price_usd_cents,
            timestamp_ms,
            sources_count,
            evidence_blob_id,
        }
    }
}
