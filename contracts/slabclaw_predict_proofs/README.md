# slabclaw_predict_proofs

Machine-checked proofs of SlabClaw Predict's **settlement arithmetic**, discharged by the
[Sui Prover](https://github.com/asymptotic-code/sui-prover) (Z3 + Boogie).

Most hackathon contracts are *tested*. This one is *proven*: the two functions that move
money are verified to hold for **every** input, not just the cases a unit test happens to try.

## What is proven

The specs live in [`sources/settlement.move`](sources/settlement.move) and target functions
that are **byte-identical** to the production package (`slabclaw_predict::market`):

| Spec | Production fn | Property proven |
|------|---------------|-----------------|
| `compute_payout_spec` | `market::compute_payout` | **Solvency** — a winner's payout is always `≤` the pool that backs the market. No claim can ever overdraw the pool. |
| `compute_payout_spec` | `market::compute_payout` | **No silent truncation** — the `u128 → u64` narrowing of the payout is lossless (discharged by the prover's `SpecNoAbortCheck`). |
| `yes_price_bps_spec` | `market::yes_price_bps` | **Bounded probability** — the YES price is always a valid basis-point figure in `[0, 10000]`. |
| `yes_price_bps_spec` | `market::yes_price_bps` | **Overflow-safe** — the probability read never overflows `u64` (the fix for review finding SEC-AR-3, now *proven*). |

Each property is proven under the exact preconditions the contract enforces at the call site:
`total_winning > 0` (asserted `ENoWinningSide` in `claim`) and `winning_shares ≤ total_winning`
(a holder's winning shares are a subset of the winning side's outstanding total).

## Why a separate package

The production package declares an explicit `Sui` dependency, which collides with the Sui
Prover's implicit-dependency injection. Proving the identical expressions in a self-contained
package (no `Sui` dep, `edition = "2024.beta"`) is the robust, documented way to machine-check
the money math. The proof functions are copied verbatim from `market.move` and cross-referenced
there in doc comments.

## Reproduce

```bash
brew install asymptotic-code/sui-prover/sui-prover   # installs sui-prover + Z3 + Boogie
cd contracts/slabclaw_predict_proofs
sui-prover
```

Expected output (saved in [`PROOF-OUTPUT.txt`](PROOF-OUTPUT.txt)):

```
✅ settlement::compute_payout_spec_Check
✅ settlement::yes_price_bps_spec_Check
✅ settlement::compute_payout_spec_Assume
✅ settlement::yes_price_bps_spec_Assume
✅ settlement::compute_payout_spec_SpecNoAbortCheck
✅ settlement::yes_price_bps_spec_SpecNoAbortCheck
Verification successful
```
