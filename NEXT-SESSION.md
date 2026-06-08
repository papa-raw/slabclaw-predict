# SlabClaw Predict — Next Session Kickstart

> Walrus track (Sui Overflow 2026). The deliverable is a **memory-backed, manipulation-resistant multi-agent oracle swarm** on MemWal/Walrus; the prediction market is the showcase. Everything below is on branch **`ux-audit-quickwins`** (NOT merged to `main` — fully revertable).

## Paste-to-resume prompt
> Resume SlabClaw Predict on branch `ux-audit-quickwins`. Build the **manipulation-signal engine**: (1) grade-inversion detector, (2) cross-grade/cross-grader multiplier-divergence detector — both compute from the existing oracle ladder + the captured Cardmarket graded ladder, emit confidence penalties + "widen dispute window" flags on concluded markets, and surface as plain-language warnings in the Oracle Swarm tab. Then (3) the listing→sale relation engine off `pull-listings.mjs` snapshots. Read `NEXT-SESSION.md`, `CLAUDE.md` session logs, and `oracle-bridge/memwal/shared/listings/` first.

## Where we are (done, committed)
- **Onchain Walrus evidence** is mandatory: `evidence_blob_id` is a first-class field; markets can't settle without a verifiable blob. Pkg `0x66debb86…`. Proven via `reseed-and-prove.mjs`. PII redaction in `redact.mjs`. Move 19/19, JS 41/41.
- **Independent per-venue source agents (TinyFish)** — `oracle-bridge/tinyfish.mjs` + `tinyfish-agents.mjs`: `psa-apr` (PSA CardFacts table), `goldin`, `fanatics`, `alt`. Every card now ≥3 sources. ALT fixed to strict grade-pairing.
- **UX audit implemented** (7 batches): focus rings, AA contrast, single-gold, accessible dialog + `?market=` deep-link, tx-gating, error/empty, consolidated panel, Oracle-Swarm + Resolution-Guide tabs primed/de-jargoned (incl. salvaged **vs-agreed** deviation column + reliability track-record).
- **Listing snapshot #1** captured (`oracle-bridge/pull-listings.mjs` → `memwal/shared/listings/`): eBay PSA-10 per card + **Cardmarket graded ladder manually extracted** (`cardmarket-2026-06-09.json`).

## The headline next build — manipulation-signal engine (Pat's idea)
Both signals are computable NOW from data we already have (oracle ladder + Cardmarket graded ladder). No scraping needed.

1. **Grade-inversion detector** — flag when `oracle[higherGrade] ≤ oracle[lowerGrade]`, OR any below-grade *listing* ≥ the settled price.
   - Live example: **Dark Raichu BGS 9.5 listed €9,999 (~$10.7k) > PSA 10 oracle $7,987** — a 9.5 above the 10.
2. **Multiplier-divergence detector** — expected PSA 9/10 ≈ 0.30–0.45; cross-grader CGC=0.75×PSA, BGS=0.80×PSA, SGC=0.55×. Flag deviations beyond a band.
   - Live flags (PSA 9÷10): **Typhlosion 0.14 · Dark Raichu 0.09 · Flareon 0.11** (all anomalously low) · Umbreon 0.33 (ok).
3. **Behavior:** these are NOT hard rejections (extreme ratios on ultra-scarce vintage PSA 10s can be real scarcity). They **lower settlement confidence + widen the dispute window** and surface a plain-language warning ("a graded 9.5 is asking more than the settled 10 — treat with caution"). Plug into `coordinator.mjs` flags + a "concluded-market audit."
4. **Intra-grade spread** is a bonus signal: Dark Raichu PSA 9 listed €850 vs €3,460 (4×) = fishing/thin-liquidity flag.

## Supporting builds (priority order)
- **Listing→sale relation engine**: re-run `pull-listings.mjs` each cycle → diff snapshots by `url` → inferred sales (vanished), relists (reappeared), ask↔realized divergence. Capture `certNumber` from titles for same-physical-card wash detection (currently null in DB).
- **Umbreon now HAS a real PSA-10 source**: Cardmarket `PSA 10 €15,500` + `€19,500` (cert 71876478). Wire it so Umbreon's 3rd source is genuinely independent (EU), not eBay-derived.
- **Scrydex agent** (`scrydex.com/pokemon/cards/<slug>?variant=…`): easy JP/coverage win via TinyFish fetch — but note it's eBay-derived like PriceCharting (boosts count, not true independence).
- **Cardmarket scraping is Cloudflare-blocked** on all IPs tried (2 Hetzner geos + local residential — product-page CF TIMEOUT). The fleet scraper (`slabclaw-app/backend/`: `cardmarket-scraper.mjs`, `cm-scope-runner.mjs`, `fleet.mjs --platform=cardmarket`) works but needs a **residential/rotating proxy**. Until then, manual export → vision-extract (as done for the 4 cards) or TinyFish aggregate.
- **Frontend**: surface inversion/spread warnings + the cross-grade ladder in the Oracle Swarm tab.
- **UX branch**: decide merge of `ux-audit-quickwins` → `main`. The one opinionated change to eyeball is the single-gold CTA reskin.

## Key files & commands
- Swarm: `cd oracle-bridge && node swarm.mjs --dry` (TinyFish agents cached 6h; ≥3 sources/card)
- Listings: `node pull-listings.mjs` (PSA-10 eBay snapshot → `memwal/shared/listings/`)
- Onchain proof: `node reseed-and-prove.mjs`
- Tests: `cd contracts/slabclaw_predict && sui move test` (19/19); `cd oracle-bridge && node --test "test/*.test.mjs"` (41/41)
- Frontend: `cd frontend && npm run dev`
- Scanner ops doc `/slabclaw` is STALE (says "cardmarket not viable" — false; fleet has cardmarket/goldin/fanatics/heritage/alt scrapers + tinyfish-swarm). Real backend: `slabclaw-app/backend/` (NOT `slabclaw/backend/`).

## Watch-outs
- Cardmarket lists graded slabs under a raw condition badge (MT/NM/EX); the **grade is in the seller comment** (collapsed in print-to-PDF — extract from notes/HTML, not condition).
- Listing snapshots contain seller handles (public marketplace data) — **redact before any Walrus publish** (same posture as evidence bundles via `redact.mjs`).
- macOS has no `timeout` command (use the harness tool timeout, not `timeout` in shell).
