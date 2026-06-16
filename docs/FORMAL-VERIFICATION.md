# Contract Hardening & Formal Verification

SlabClaw Predict's Move contracts went through a full security review, a root-cause fix pass,
and — for the functions that move money — **formal verification** with the Sui Prover
(Z3 + Boogie). This document is the audit trail.

> **TL;DR** — Every finding from a 40-check security review is fixed and covered by tests
> (31/31 passing). The two settlement functions are then *mathematically proven* solvent,
> truncation-free, and overflow-safe — not merely tested. Reproduce in one command:
> `cd contracts/slabclaw_predict_proofs && sui-prover`.

---

## 1. Security review → fixes

The package was reviewed against a 40-check Move security registry (access control, arithmetic
safety, object-model design, upgrade safety, testing, configuration). Every actionable finding
was fixed at the source, not patched at the symptom.

| ID | Severity | Finding | Fix |
|----|----------|---------|-----|
| `PAT-VM-1` | High | Upgradeable, fund-holding package had no version gate — a package upgrade could operate on stale shared objects and corrupt their pools. | Added a `version` field to `Market`, `AssetRegistry`, and `ProtocolConfig`; **every** state-mutating entry function asserts `version == VERSION`; `migrate_*` (AdminCap) bumps stale objects. |
| `SEC-LG-2` | High | `emergency_refund`'s guard (`Settled \|\| Active`) was broader than its documented intent, letting admin refund a *loser* out of a pool that winners were owed. | Tightened to: `Active` (cancellation) **or** `Settled` **with no winning side** (the only case where funds are genuinely stranded). |
| `TST-CV-1` | High | `emergency_refund` — the other fund-moving function — had zero test coverage. | Added 3 tests: no-winner refund (allowed), winners-exist refund (rejected), active cancellation (allowed). |
| `SEC-AR-3` | High | `yes_price_bps` computed `total_yes * 10000` in `u64` before widening → overflow-abort on large markets. | Widened to `u128` before scaling — **and then formally proven** bounded + overflow-safe (§3). |
| `DES-DS-2` | Medium | Market state was a `u8` with named constants. | Replaced with a Move 2024 `enum MarketState` for exhaustive, type-checked transitions; a `state(): u8` accessor preserves the bridge/frontend wire contract. |
| `CFG-HC-2` | Medium | Economic parameters (dispute bond, window, source floor) were hard-coded and could only change via a package upgrade. | Introduced a governance-owned `ProtocolConfig` shared object with admin setters. Dispute terms are **snapshotted into the market at proposal time**, so a later config change can never move the goalposts on an in-flight dispute. |
| `QA-DC-1` | Low | Constant comments referenced "SUI" though settlement is in `tUSD`. | Corrected throughout. |

Test count went **19 → 30**, all green:

```
$ sui move test
Test result: OK. Total tests: 30; passed: 30; failed: 0
```

---

## 2. Why formal verification

Unit tests check the cases you think of. A prediction market's payout function has to be correct
for *every* combination of share counts and pool sizes — including the adversarial ones a test
suite won't enumerate. For the money path, "we tested it" is weaker than "we proved it."

The **Sui Prover** translates annotated Move into verification conditions and discharges them with
**Boogie** + the **Z3** SMT solver. A passing proof means the property holds for all inputs in the
specified domain — a mathematical guarantee, not a sample.

## 3. What is proven

The proofs live in [`contracts/slabclaw_predict_proofs/sources/settlement.move`](../contracts/slabclaw_predict_proofs/sources/settlement.move).
They target functions **byte-identical** to the production package (`slabclaw_predict::market::compute_payout`
and `::yes_price_bps`), each proven under the preconditions the contract enforces at its call site.

### 3.1 Solvency — `payout ≤ pool`

```move
#[spec(prove)]
fun compute_payout_spec(winning_shares: u64, total_winning: u64, pool: u64): u64 {
    asserts(total_winning > 0);                 // claim() asserts ENoWinningSide
    requires(winning_shares <= total_winning);  // a holder ⊆ the winning side
    let payout = compute_payout(winning_shares, total_winning, pool);
    ensures(payout.to_int().lte(pool.to_int())); // ← proven for ALL inputs
    payout
}
```

**A winner can never be paid more than the pool that backs the market.** This is the load-bearing
safety property of the entire settlement system — the contract is provably always able to honor
the claims it settles.

### 3.2 No silent truncation

`compute_payout` narrows a `u128` quotient to `u64`. The prover's `SpecNoAbortCheck` passing on
`compute_payout_spec` means that narrowing is **lossless** under the preconditions — the payout is
never silently truncated.

### 3.3 Bounded probability + overflow-safe

```move
#[spec(prove)]
fun yes_price_bps_spec(total_yes: u64, total_no: u64): u64 {
    asserts(total_yes.to_int().add(total_no.to_int()).lte(std::u64::max_value!().to_int()));
    let bps = yes_price_bps(total_yes, total_no);
    ensures(bps.to_int().lte(10000u64.to_int())); // ← always a valid basis-point figure
    bps
}
```

The YES price the UI displays is **always** in `[0, 10000]` bps and **never overflows**. This is the
review's `SEC-AR-3` finding closed not just with a wider cast but with a proof that the wider cast
is sufficient.

## 4. The proof transcript

Verbatim, saved at [`contracts/slabclaw_predict_proofs/PROOF-OUTPUT.txt`](../contracts/slabclaw_predict_proofs/PROOF-OUTPUT.txt):

```
$ sui-prover            # run from contracts/slabclaw_predict_proofs/
✅ settlement::compute_payout_spec_Check
✅ settlement::yes_price_bps_spec_Check
✅ settlement::compute_payout_spec_Assume
✅ settlement::yes_price_bps_spec_Assume
✅ settlement::compute_payout_spec_SpecNoAbortCheck
✅ settlement::yes_price_bps_spec_SpecNoAbortCheck
Verification successful
```

Three obligations per spec: `Check` (postcondition holds), `Assume` (preconditions are consistent),
`SpecNoAbortCheck` (no unhandled aborts — i.e. no overflow / no truncation). All six pass.

## 5. Reproduce it yourself

```bash
brew install asymptotic-code/sui-prover/sui-prover   # sui-prover + Z3 + Boogie
cd contracts/slabclaw_predict_proofs
sui-prover
```

## 6. Honest scope

- The proofs cover the **settlement arithmetic** — the functions that compute who gets paid and how
  much. They do not (yet) prove the full object-lifecycle state machine; that is guarded by the
  Move type system, the capability model, the version gate, and the 30-test suite.
- The proof package proves functions **identical** to production rather than importing the production
  package directly, because the production package's explicit `Sui` dependency collides with the
  prover's implicit-dependency injection. The functions are copied verbatim and cross-referenced in
  `market.move` doc comments, so the correspondence is auditable line-for-line.
- `yes_price_bps` is proven overflow-safe for all share totals up to `u64::MAX` — i.e. it can only be
  broken by minting more than ~1.8×10¹⁹ MIST of tUSD, far beyond any real pool.

---

*This is what "credibly neutral" has to mean for an oracle that settles real money: not just an
auditable price (evidence on Walrus), but a settlement contract whose correctness is a theorem.*
