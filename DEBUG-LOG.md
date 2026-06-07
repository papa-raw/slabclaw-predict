# SlabClaw Predict — Debug Log

### 2026-06-07 — "Pop PSA 10 = 0" off-by-one
**Symptom:** Card detail showed Pop PSA 10 = 0 despite thousands graded.
**Root cause:** `popForGrade` read `grades[round(grade)]`; the grade_array is indexed `grades[i] = grade (i+1)`, so grade 10 is index **9** (index 10 is the BL/black-label slot, usually 0).
**Fix:** `gi = round(grade) - 1` in `frontend/src/lib/registry.js`.
**Mechanism:** Aligns the index with the registry's 1-based grade array (grade10→idx9, grade11/BL→idx10).

### 2026-06-07 — Oracle TWAP line started ~30 days late
**Symptom:** White oracle line began well after the first sold-comp dots (left gap).
**Root cause:** `smoothOracleHistory` generated from `comps[0].t + WINDOW_MS` (first comp + 30-day TWAP window).
**Fix:** `genStart = comps[0].t` (start at first comp; early points use a shorter effective window).
**Mechanism:** TWAP at the first comp = that comp's price; no leading dead space. Also made the chart x-axis floor = first plotted point instead of a hard `startMs`.

### 2026-06-07 — Cross-grade comps contaminating the oracle/chart
**Symptom:** Gengar chart had wild PSA-10 scatter; "I worry something is wrong."
**Root cause:** `priceSeries` matched grade only, not grader+grade — cross-grade comps leaked in.
**Fix:** Require exact `grader` AND `grade` (PSA 10) in `priceSeries`; cross-grade stripped entirely (not down-weighted).

### 2026-06-07 — On-chain market IDs scrambled in a single PTB
**Symptom:** After creating 3 markets in one transaction, `objectChanges` order did NOT match `moveCall` order — constants mislabeled (Charizard id was actually Gengar).
**Root cause:** `objectChanges` ordering is not guaranteed to match call order within one PTB.
**Fix:** Create each market in its OWN transaction (`seed-new-cards.mjs`) so each tx's single created Market maps unambiguously; verify by reading onchain `strike_usd_cents`/`asset_id`.

### 2026-06-07 — Renamed component, stale JSX reference (no build error)
**Symptom:** Opening a market detail would throw at runtime.
**Root cause:** Import swapped `RegistryLadderEmbed` → `RegistryCardLadder` but the JSX usage still said `<RegistryLadderEmbed>`. Vite/Rollup don't error on undefined component refs at build time.
**Fix:** Update the usage too. Lesson: undefined JSX component refs are runtime ReferenceErrors, not build failures — grep usages after a rename.

### 2026-06-07 — Git history wiped by `git init` in cloned directory
**Symptom:** GitHub showed only 3 commits instead of 25. User: "where did all our previous commits go?"
**Root cause:** A previous session ran `git init` inside the `slabclaw-sui-hackathon/` directory (which was cloned from `anima-swarm`), wiping the 22-commit Anima Swarm history and creating a new root commit. The force-push replaced the remote history.
**Fix:** Found the original 22-commit history in `/Users/pat/Desktop/1_projects/anima/anima-swarm/` (same remote). Fetched it as branch `anima-history`, ran `git rebase --onto anima-history --root main` to graft the 3 SlabClaw commits onto the original history. Resolved all 13 conflicts by accepting "theirs" (the SlabClaw code being replayed). Force-pushed with `--force-with-lease`.
**Mechanism:** `git rebase --onto <newbase> --root` replays every commit starting from root onto the new base. The first replayed commit (7846884 "SlabClaw Predict") was a full codebase replacement, so all conflicts were resolved by accepting the incoming version (`git checkout --theirs .`). The remaining 2 commits replayed cleanly.
