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

### 2026-06-08 — AdminCap version race across rapid back-to-back txns
**Symptom:** `reseed-and-prove.mjs` created 3 markets fine then aborted: "object <AdminCap> version 0x35658814 is unavailable for consumption, current version: 0x35658815".
**Root cause:** Each `register_asset`/`create_market` consumes (mutates) the owned `AdminCap`, bumping its version. The next tx's build phase resolved the AdminCap from a fullnode replica that hadn't yet indexed the new version → stale object reference.
**Fix:** `await client.waitForTransaction({ digest })` after every AdminCap-consuming tx, so the node syncs the new version before the next build. **Mechanism:** `signAndExecuteTransaction` returns once executed, but a *different* fullnode read can lag; `waitForTransaction` blocks until that checkpoint is indexed on the node you'll query next.

### 2026-06-08 — Frontend consensus exporter wrote wrong shape (silent blank panels)
**Symptom:** Caught by the workflow's integration Critic before shipping: the first live `swarm`/`bridge-swarm` run would overwrite the seed `oracle-consensus.json` and blank every consensus panel (EmptyState) for all 4 markets.
**Root cause:** `export-consensus.mjs writeFrontendConsensus()` wrote a FLAT top-level `{ productId: {...} }` map, but the panel reads a nested envelope `consensusData.consensus[productId]` + `consensusData._seed`.
**Fix:** `writeFrontendConsensus` now writes `{ _seed:false, roundId, timestamp, consensus:{...} }`; wiring test strengthened to assert the envelope. **Lesson:** a separate Critic node that validates against the *consumer's* contract catches integration drift that each builder's own unit tests miss.

### 2026-06-09 — Asks voting in settlement biased every consensus upward
**Symptom:** Thin cards settled high; Umbreon "settled" $16k off a single Cardmarket listing.
**Root cause:** The coordinator averaged ALL signals into the weighted median, including asks (live listings). Asks structurally sit above the clearing price, so they dragged every settle up — and a single ask could "set" a thin market's price.
**Fix:** `kindOf`/`ASK_PLATFORMS` tag each signal realized|ask. Settlement = REALIZED sales only (comp-weighted, one vote per family); asks bound the range at weight 0 and never vote. MAD runs on realized only (asks legitimately sit high — must not be MAD-cut). `asks_only` provisional fallback + ask sanity-band flags.
**Mechanism:** A prediction market settles on what a card SOLD for, not what it's listed at. Separating the two is the difference between a price and an asking price.

### 2026-06-09 — Wrong-variant snippet mis-grabs survived MAD (Goldin $425, Fanatics $27k)
**Symptom:** Flareon dragged to $3,380 by a Goldin "$425" (real PSA-10 ~$5,600); Umbreon pulled up by a Fanatics "$27k". Both inside MAD tolerance amid a wide spread.
**Root cause:** TinyFish search-snippet agents (goldin/fanatics/alt) can grab a price for the wrong variant/grade/lot. With few realized sources the MAD median/spread is too coarse to reject a single plausible-looking outlier.
**Fix:** Cross-source plausibility anchor gate — anchor = median of well-supported (≥3-comp) realized; reject realized <0.4x or >2.5x. THIN (<3-comp) snippet sources tightened to ±50% of the anchor. Goldin $425 (0.08x) and Fanatics $27k (1.87x) both rejected. Generalizes the production oracle's eBay validation gate.
**Mechanism:** Trust scales with corroboration. A 1-comp snippet far from a 12-sale eBay anchor is almost always a mis-parse, not a real outlier sale.

### 2026-06-09 — Transient backend miss collapsed cards to asks-only
**Symptom:** A swarm run showed Umbreon/Flareon with NO eBay/PriceCharting realized data → Umbreon fell to `asks_only` $16,740.
**Root cause:** `BaseAgent.run()` emitted nothing when `fetchCardData`/`fetchPlatformData` failed — no warm-cache fallback (only the TinyFish agents had one). A single backend blip dropped the realized eBay-origin source.
**Fix:** `run()` now reuses the last good cached observation (≤30d) with its ORIGINAL observedAt when a fresh fetch fails; never re-stamped as fresh (recency decay + stale_feed breaker down-weight it). Re-running the swarm restored the realized data.
**Mechanism:** A memory-backed swarm shouldn't forget a price it already knows. The preserved timestamp keeps the resurrected signal honestly down-weighted.

### 2026-06-09 — TCGPlayer active listings counted as realized sales
**Symptom:** TCGPlayer's low Flareon price ($2,089) contaminated the settlement median and widened the dispute; removing it let a Fanatics $27k grab survive MAD.
**Root cause:** `TcgplayerAgent` feeds ACTIVE listings (`tcgplayer_active`/`_seeded`) — asks — but `tcgplayer` wasn't in `ASK_PLATFORMS`, so it voted as a realized source. The `/active/` regex also missed the `_seeded` warm-cache variant.
**Fix:** Added `tcgplayer` to `ASK_PLATFORMS` (classify by venue, not source-string suffix). It now bounds at weight 0.
**Mechanism:** TCGPlayer is a listings marketplace, not a realized-sold feed — its venue identity, not a string suffix, should decide its kind.

### 2026-06-09 — Yahoo JP broad query matched wrong Umbreon variant
**Symptom:** Yahoo Auctions JP closed-auction scrape returned $3,667 for "Karen's Umbreon PSA 10" — far below the ~$13–16k VS-091 card.
**Root cause:** `カリンのブラッキー` (Karen's Umbreon) names SEVERAL prints; the broad query caught a cheaper one. The valuable card is the Pokémon Card VS series (VS-091).
**Fix:** Query is card-specific (`ポケモンカードVS カリンのブラッキー PSA10`) and the agent must confirm BOTH isPsa10 AND isVsSeries. With the strict filter the scrape returns null — VS-091 PSA-10 has no clean JP closed sales right now (and the thin-source anchor band would reject a wrong-variant grab anyway). Honest null > contaminated comp.
**Mechanism:** Grade-matching isn't enough for shared-name cards — you must also card-match the specific print/set.
