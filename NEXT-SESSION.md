# SlabClaw Predict — Next Session Kickstart

> Walrus track (Sui Overflow 2026, **submit by Jun 18–19**, deadline Jun 21). The deliverable is a **memory-backed, manipulation-resistant multi-agent oracle swarm** on MemWal/Walrus; the prediction market is the showcase. Everything is on `main` and **live in production**.

## Paste-to-resume prompt
> Resume SlabClaw Predict. Run the **Judge Gauntlet fix sprint** in NEXT-SESSION.md order: (1) blob durability re-upload at max epochs, (2) canonical agent roster sweep, (3) fresh-cloner README fixes, (4) gas hint, then the **onchain MemWal anchor** package (SwarmMemory pointer onchain + prove-memory-loop.mjs + restoredFromBlobId in /predict/health). After the sprint: E2E full-flow test, then the demo video script. Read NEXT-SESSION.md and the CLAUDE.md 2026-06-10 session log first.

## Where we are (live)
- **slabclaw.com = the live submission** (Vercel, project `slabclaw-predict`), `/privacy` + `/terms` preserved. Live oracle feed: `api.slabclaw.com/predict/{consensus,signals,health}`.
- **Production topology**: data-plane node runs the full swarm daily and snapshots memory to Walrus; serving node **restores memory from Walrus** before each 6h round (systemd timer) and serves the feed. No autonomous settlement; proposals stay operator-signed.
- **Markets**: Typhlosion `0xf63f37a0…`, Umbreon `0x2da84029…`, Flareon `0x9700623a…` ACTIVE (expiry Oct 1 2026, post-judging); Dark Raichu `0xa291d583…` PROPOSED with onchain evidence blob `2zQcELz2…`.
- **Daily health monitor** runs 07:00 UTC through Aug 27.
- **Judge Gauntlet** (5 self-rubric judges + claim verifier + fresh cloner) scored: RWA 7.4 · UX 8.2 · Tech 7.7 · Presentation 7.8 · Walrus sponsor 7.4. The tech judge independently recomputed the settlement price from the onchain blob.

## The sprint (Gauntlet-ranked, deduped)

### Critical + cheap (~6h, do first)
1. **Blob durability** (2h) — re-upload demo evidence + MemWal snapshots at max epochs (~53 on testnet) and re-propose, so nothing 404s during judging.
2. **Canonical agent roster** (2h) — README says 9 (one list), deck says 9 (different list), code runs 13. One roster everywhere + fix ghosts: `OracleSwarmPanel.jsx` reference (README:223), `explain-site/` (doesn't exist), ArchitecturePage modules row says "market · oracle · resolution · registry" (real modules: market · oracle · registry · test_usd), stale hardcoded "latest blob" links (README:117,128).
3. **Fresh-cloner fixes** (1h) — README "Run it": add `cd oracle-bridge && npm install` (cold clone crashes with ERR_MODULE_NOT_FOUND), document `SLABCLAW_API` env var, note which agents need TinyFish credits, distinguish "backend unreachable" from "no data" in agent output.
4. **Gas hint** (1h) — next to Connect/Faucet: "Need gas? Get testnet SUI ↗" — a cold judge with an empty wallet can't trade and is never told why.

### The convergent #1 (6h) — onchain MemWal anchor
3 judges incl. the track decider converged: the latest-memory pointer is a LOCAL file (`memwal-sync.mjs:151`) — "memory that outlives its operator" currently dies with the operator's disk.
- Publish each round's snapshot blobId onchain (shared `SwarmMemory` object or `MemoryCheckpoint` event, same pattern as `evidence_blob_id`).
- Serving node restores from the ONCHAIN pointer; surface `restoredFromBlobId` in `/predict/health`.
- Ship `prove-memory-loop.mjs`: delete `memwal/` → restore from chain+Walrus → run consensus → diff (kill-and-restore proof, ON CAMERA in the video).

### High (~9h)
5. **Seeded-history honesty** (3h) — label seeded rounds "simulated bootstrap" at point of use (OracleSwarmPanel-successor + README:130 + deck:408); real rounds accumulate at 6h cadence (~40 by Jun 21). Fix deck's self-contradiction (Courtyard ~86% reputation vs ask-class weight-0 policy). Exclude asks from reputation updates (`coordinator.mjs`).
6. **Dispute window staged through judging** (3h) — keep one market in an OPEN dispute window (re-propose cycle); drive DisputePanel from onchain `disputeDeadlineMs`/`requiredDisputeBond` (already parsed in `useMarket.js:33-34`) instead of hardcoded 24h/min-bond.
7. **Era-trend strip honesty** (2h) — `/api/registry/era-trends` 404s in prod so static fallbacks render as if live; proxy via `/predict/` or label as snapshot.
8. **Vendor card images** (1h) — pokemontcg.io hotlinks into `/public` (CDN outage during judging = "no image" grid; also fixes the deck title slide offline).

### Big bets (Pat decides)
9. **"Swarm memory" tab in the dapp** (8h) — UX judge's #1: reputation/calibration/warm-cache evolving round-over-round, headed "memory restored from Walrus blob `<id>`". Pairs with fix #5's real-rounds data and the sponsor judge's Memory-tab ask.
10. **Real-user evidence** (10h, mostly Pat) — 10–20 waitlist/TestFlight collectors trade during judging; put "N real collectors traded" in README/deck. Converts the 50% RWA criterion from asserted to demonstrated.
11. **Repo presentation hygiene** (1h) — decide on DEBUG-LOG/NEXT-SESSION/TODO/BUILD_PLAN in the public repo (cloner: "reads as unswept"; counter: honest process docs); remove `contracts/slabclaw_predict/build/` from tracking; quarantine superseded scripts (`create-proposed.mjs` proposes without config/evidence).

### Then (the win condition)
- **E2E full-flow test** — wallet → faucet → trade → propose → dispute → finalize → claim → verify-on-Walrus, ONE uninterrupted pass.
- **Demo video** (Pat records; structure per organizers): 60s problem → ~3min Dark Raichu walkthrough (buy YES → swarm round → Walruscan blob → onchain price == blob → dispute window) + the kill-and-restore memory proof → 60s vision.
- `/release-checklist` gate, DeepSurge form (logo 1:1!), submit **Jun 18–19**.

## Standing cautions
- Keeper stays OFF in production (premortem finding #9). Old Jul-9-expiry markets are orphaned — never point anything at `0x2756a52b…`, `0x56ae16ad…`, `0xc977441b…`, `0x499d7f98…`.
- TinyFish credits at 0 — top up before the next full data-plane swarm run if venue coverage matters for the video.
- Cardmarket lists graded slabs under a raw condition badge; the **grade is in the seller comment** (extract from notes/HTML, not condition).
- Listing snapshots contain seller handles — **redact before any Walrus publish** (`redact.mjs` posture).
- macOS has no `timeout` command (use the harness tool timeout, not `timeout` in shell).
- Premortem reports: `../premortem-report-20260610-0012.html` (parent dir, outside this repo).
