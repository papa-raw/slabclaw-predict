/// settlement.move — Formal proofs of SlabClaw Predict's settlement arithmetic.
///
/// The two functions below are **byte-identical** to the production package
/// (`slabclaw_predict::market::compute_payout` and `::yes_price_bps`), lifted into
/// a standalone prover package so the Sui Prover (Z3 + Boogie) can discharge them.
/// The production package carries an explicit `Sui` dependency, which collides with
/// the prover's implicit-dependency injection; proving the identical expressions in
/// isolation is the robust, self-contained way to machine-check the money math.
///
/// Each `_spec` follows the canonical same-module pattern from the Sui Prover guide
/// (`simple_lp.move`): assume the contract's call-site preconditions, call the
/// function, assert the postcondition. A spec that proves with the narrowing casts
/// present (and without `ignore_abort`) has, by the prover's abort analysis, also
/// proven those casts never silently truncate.
module slabclaw_proofs::settlement;

#[spec_only]
use prover::prover::{requires, ensures, asserts};

// ── Parimutuel payout ────────────────────────────────────────────────────────

/// Identical to `slabclaw_predict::market::compute_payout`.
/// payout = winning_shares * pool / total_winning, computed in u128, narrowed to u64.
public fun compute_payout(winning_shares: u64, total_winning: u64, pool: u64): u64 {
    (((winning_shares as u128) * (pool as u128) / (total_winning as u128)) as u64)
}

/// SOLVENCY + NO SILENT TRUNCATION.
///
/// Preconditions the contract guarantees at the `claim` call site:
///   • `total_winning > 0`              — asserted as ENoWinningSide in claim().
///   • `winning_shares <= total_winning` — a holder's winning shares are a subset
///                                         of the winning side's outstanding total.
///
/// Postcondition: `payout <= pool`. A winner can never be paid more than the pool
/// that backs the market — the contract is always solvent. Because the spec proves
/// with the `as u64` narrowing present, the prover has also shown that cast is
/// lossless (no silent truncation of the payout).
#[spec(prove)]
fun compute_payout_spec(winning_shares: u64, total_winning: u64, pool: u64): u64 {
    asserts(total_winning > 0);
    requires(winning_shares <= total_winning);

    let payout = compute_payout(winning_shares, total_winning, pool);

    ensures(payout.to_int().lte(pool.to_int()));
    payout
}

// ── YES probability (basis points) ──────────────────────────────────────────

/// Identical to `slabclaw_predict::market::yes_price_bps`.
/// 5000 (50%) when the market is empty; otherwise total_yes * 10000 / total.
public fun yes_price_bps(total_yes: u64, total_no: u64): u64 {
    let total = total_yes + total_no;
    if (total == 0) { return 5000 };
    ((((total_yes as u128) * 10000) / (total as u128)) as u64)
}

/// BOUNDED PROBABILITY + OVERFLOW-SAFE.
///
/// Precondition: the share sum fits u64 (true for any market — the pool is bounded
/// by minted tUSD supply, far below 2^64 MIST). Postcondition: the result is always
/// a valid basis-point figure in [0, 10000]. The u128→u64 narrowing is proven lossless.
#[spec(prove)]
fun yes_price_bps_spec(total_yes: u64, total_no: u64): u64 {
    asserts(total_yes.to_int().add(total_no.to_int()).lte(std::u64::max_value!().to_int()));

    let bps = yes_price_bps(total_yes, total_no);

    ensures(bps.to_int().lte(10000u64.to_int()));
    bps
}
