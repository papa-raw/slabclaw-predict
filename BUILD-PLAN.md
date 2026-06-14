# Build Plan — "Crush Synapse" sprint (Jun 14 → Jun 21)

Goal: close the one real gap vs Synapse Vault (the strongest Walrus-track competitor) and
make our existing memory *visibly do work*, without diluting our winning thesis (real-world
asset + formal rigor + credibly-neutral public oracle). Synapse went wide on primitives; we
go deep on realness + rigor and close exactly one thesis gap, not five.

Deadline reality: **the video is the real deadline.** Items 1 and 4 land mostly *inside* the
video. Item 2 is the only thing that needs real build + an onchain upgrade. Order: 1 → 2 → 3 → 4.

Competitor facts (verified): `SuyashAlphaC/Synapse`, repo created 2026-05-21, TypeScript,
Move pkg v6. MemWal recall/remember per tick, Walrus audit artifact + onchain `ArtifactRef`
(blob+SHA-256), cross-agent MemWal (`CrossAgentReadEvent`), Move policy gates, Nautilus
attestation, strategy marketplace w/ royalties, LangGraph `SynapseStore` adapter.

Our standing edges to PRESS (not rebuild): real-world $2B asset (50% rubric) vs their
crypto-on-crypto; **formal verification** (Sui Prover) vs their tests/attestation; public
re-verifiable Walrus evidence (re-run the math, no special hardware); onchain MemWal anchor
already shipped (`memory::checkpoint` + `prove-memory-loop`).

---

## Item 1 — Make memory the protagonist (perturbation-response) ★ highest ROI

**Thesis:** our memory has a *job* — manipulation resistance — which beats a generic
audit-artifact-per-tick. Show it learning on camera.

**The arc (one reproducible script, offline-safe for filming):**
1. Baseline: honest signals → consensus C0, target source reliability R0.
2. Attack: inject a shill-high spoof from one source on Dark Raichu (best-covered card,
   anchor ≈ $7,987). The anchor/MAD gate **rejects** it (visible in `rejectedSources`),
   consensus stays ≈ C0 (manipulation absorbed), the source's reliability drops R0 → R1.
3. Memory: source behaves again next round → its vote now carries **lower weight** (R1 < R0).
   The swarm remembers the betrayal and trusts it less.
4. Persistence: snapshot → Walrus → **kill memory** → restore → R1 survives. The lesson
   outlived the process. (This is `prove-memory-loop` aimed at the *learned* value, not price.)

**Deliverables**
- [x] `oracle-bridge/prove-learning-loop.mjs` — drives real `runCoordinator` + reputation +
      `snapshotToWalrus`/`restoreFromWalrus`. Sandboxed (backs up + restores live memory).
      PASS = manipulation rejected AND reliability dropped AND consensus stable AND R1
      survived the Walrus round-trip. Deterministic (observedAt stamped) so it films identically.
- [x] `oracle-bridge/test/learning-loop.test.mjs` — asserts the four invariants headless.
- [x] UI surfacing in `OracleConsensusPanel.jsx`: source rows now show learned trust over
      rounds ("41% trust · learned over 158 rounds"); coordinator stamps `roundsObserved`/
      `agreements` on each source (live feed carries it); baked snapshot patched (blob kept);
      existing "Manipulation rejected (MAD)" box already shows the catch. Frontend builds green.
- [x] README "memory has a job" perturbation-response proof block added. (deck line: pending, Item 4)

## Item 2 — Cross-agent memory coordination, anchored onchain ★ the one real build

**Gap:** agents write signals; the coordinator reads them. Agents don't read *each other's*
memory, and nothing onchain proves coordination. Synapse's `CrossAgentReadEvent` is the
literal track ask. Close it.

**Build**
- [ ] `base-agent.mjs`: before emitting, each agent **recalls shared memory** — the
      coordinator's last-round reputation + any manipulation flags on its own/peer families —
      and self-adjusts: a family flagged for shilling last round enters this round
      pre-discounted (lower starting confidence); an agent diverging hard from a family it
      historically agrees with widens its own CI. Record the recall in the agent's run log.
- [ ] `coordinator.mjs`: emit a `coordination` summary per round (who read whom, what
      adjustments fired) into the evidence bundle.
- [ ] `memory.move`: **additive upgrade** — new `CoordinationEvent { round, reads, adjustments,
      memory_blob_id }` + `record_coordination(OracleCap, SwarmMemory, …)` entry. Additive to an
      existing module → upgrade-compatible via `upgradeCapId 0x8d918a08…`. New `packageIdV3`.
- [ ] `memwal-sync.mjs`: `recordCoordinationOnchain(summary)` (mirror of `checkpointOnchain`).
- [ ] Wire into `swarm.mjs` after the coordinator pass; emit the onchain event when the keeper key is present.
- [ ] `memory_tests.move`: +tests for `record_coordination` (happy path, empty-reads guard).
- [ ] Update config IDs + frontend constants + README/architecture for the new package.

## Item 3 — Thin reusable primitive + one-pager (answers the platform axis cheaply)

No marketplace. Extract the pattern so we're "an app on reusable infra," not just an app.
- [ ] `packages/memory-oracle/` (or `oracle-bridge/sdk/`): `BaseAgent` + `Coordinator` +
      MemWal store interface as a documented, importable module with a tiny example agent.
- [ ] `README.md` recipe: "point this swarm at any authenticated RWA — watches, sneakers,
      wine — same memory, same family-independence, same manipulation gates." 5 lines of usage.

## Item 4 — Name our non-choices (≈0 build, deck + video)

Absence reads as weakness unless we frame it.
- [ ] Redaction **over Seal**: a price oracle is a public commons — evidence anyone can
      re-verify beats encrypted artifacts.
- [ ] Formal proofs **over Nautilus**: for the two functions that move money, "proven for
      every input" beats "attested for one run." (Nautilus roadmap line: consensus *can* be
      TEE-attested; the value version needs in-enclave fetch, which fights our scraping stack.)
- [ ] One deck slide / video beat each.

**Stretch (post-video):** Seal-gated *raw* evidence for dispute arbitrators (public gets
redacted, voters decrypt full bundle via SessionKey). **Skip:** Nautilus build, strategy marketplace.

---

### Verification gates (every item)
- JS: `cd oracle-bridge && npm test` (node --test). Move: `sui move test`. Frontend: `npm run build`.
- No regressions in existing consensus on the 4 demo cards.
- Evidence: cite path:line on each claim.
