# SlabClaw Predict — UX/UI Audit & Improvement Plan

*Synthesis of 7 surface-level audits (116 raw findings) against the product intent: a Bloomberg-terminal-dark Sui prediction-market dapp where a collector/degen reads price charts and bets YES/NO on whether a graded card beats a strike — fast, with conviction, "bet with data, not vibes."*

**Scope:** `frontend/` — `tailwind.config.js` + `index.css` + `App.jsx` + 13 components in `src/components/`.
**Deduped findings:** 47 (from 116 raw). **Critical:** 3 themes. **High:** 9 themes.

---

## Executive Summary — Top 5 to Fix

1. **No focus states anywhere (keyboard is blind).** Every button, tab, chip, tile, input, and link lacks a visible `:focus-visible` ring; the two text inputs *actively remove* the native outline (`focus:outline-none` → 1px border shift). For a dapp that signs real transactions, keyboard users cannot tell where they are. One global rule in `index.css` fixes the entire app. *(F1 / A11Y-02 / MD-02 / ML-01 / CH-03 / ORC-03 / ORC-08)*

2. **The market-detail "modal" is not a dialog and not a route.** `MarketDetail.jsx` is a `fixed inset-0` overlay driven by `useState(selectedId)` — no `role="dialog"`, no ESC-to-close, no focus trap, no focus restore, no body-scroll-lock, **and no URL**. Browser Back exits the app instead of closing it; judges cannot deep-link to the disputed Flareon market. This is the single most consequential wayfinding gap. *(MD-01 / F6 / A11Y-04 / FLOW-01 / FLOW-02 / NAV-01)*

3. **Two competing golds dilute the single-accent signature.** `sc.accent #f5c542` (strike, links) and `sc.amber #f59e0b` (Connect pill, Faucet, PREDICT wordmark, "proposed" state) run in parallel with no rule. The squint test fails — the eye can't tell which yellow is "the brand." Pick one gold for brand/CTA, demote amber to the *proposed/caution semantic only*. *(CH-01 / F12 / ML-06 / MD-16)*

4. **`sc-muted #6b6b7e` fails WCAG AA and carries most of the labels.** It's 3.48:1 on `sc-card` — the actual background for nearly every label — and it's the dominant tertiary color, almost always at 8–11px. The terminal's entire label tier is unreadable to low-vision users. Lighten the token; don't shrink below a 10px floor. *(A11Y-01 / MD-08 / ML-12 / CH-10 / ORC-05 / DENS-01)*

5. **Two near-duplicate oracle consensus panels drift apart.** `OracleConsensusPanel` (live, line 175) and `OracleSwarmPanel` (a tab, line 477) render the same concept with conflicting platform-color systems, different hero-number sizes, different empty/loading handling, and a duplicated WalrusIcon. `OracleSwarmPanel` has **no loading state** — it flashes a dev-facing "Run node swarm.mjs" message to bettors during fetch. Consolidate on `OracleConsensusPanel`. *(ORC-16 / ORC-01 / ORC-02 / ORC-07 / F2 / F3)*

---

## Strengths to Preserve (do NOT regress these)

The craft floor here is genuinely high. Improvements must make the terminal/slab aesthetic *more itself*, not replace it.

- **Card atomic unit is intact and on-signature** — image + slab-colored GradeBadge + price travel together in `MarketCard.jsx:43-83`, the detail header, and the ladder. Keep this triplet inseparable.
- **Grade badges use real slab colors** — PSA `#ef4444` red, BGS `#D4A017` gold, CGC `#3b82f6` blue, SGC slate, centralized in `GradeBadge.jsx`. This is a load-bearing signature.
- **`tabular-nums` is applied everywhere numbers matter** — strike, oracle, YES/NO %, pool, weights, comps, axes, ladder. The terminal feel rests heavily on this; never drop it.
- **The strike line is the visual hero exactly as intended** — gold `#f5c542` dashed with green-above / red-below zone tints, in both the big `OracleStrikeChart` and the tile `Sparkline`. The chart-to-decision read ("am I above or below strike?") is immediate.
- **Surface elevation ramp is disciplined and quiet** — `bg #000 → panel #0a0a0c → surface #111118 → card #15151d → border #23232f`, a ~2–4% lightness ladder that nails the Bloomberg intent.
- **Resolution lifecycle is well-taught** — the 5-step `FlowStep` stepper with state-driven coloring (`MarketDetail.jsx:259-279`) explains an unfamiliar optimistic-oracle flow better than most production dapps.
- **Manipulation-resistance is made visible** — `OracleConsensusPanel` shows MAD-rejected outliers struck-through with reason, "X of N sources agree," and the Walrus → raw-JSON → onchain verifiability chain. This *is* "bet with data."
- **Data-region state completeness is strong** — the top-level markets region handles loading (skeleton mirrors real card geometry), error, empty, loaded; every chart/panel has an empty state. The headline ask is mostly met.
- **Cross-grader comps are de-emphasized** (`fillOpacity 0.35` + "cross-grade" label) honoring the "never compare PSA 9 to PSA 10" gotcha at the viz layer.

---

## Themes

### T1 — Missing interaction states (focus / active / disabled-mid-tx) `[CRITICAL]`
**Problem:** No `:focus-visible` ring exists anywhere; inputs strip the native outline. No `:active` pressed state on any button. During an in-flight tx (`status==='signing'`) only the submit button disables — the YES/NO side toggle, quick-amount chips, and amount/bond inputs stay live, so a user can change side/amount while a signature is pending.
**Why it matters for this user:** A degen betting real money taps fast and needs press confirmation before the wallet popup appears; a keyboard user signing a transaction must see focus. Color-only state changes (a 1px border hue shift) are invisible on `#000`.
**Surfaces/states:** Global — every interactive element; `MarketCard.jsx:38`, `MarketDetail.jsx:342/569/576/582/590/615`, `Footer.jsx:50`, `WalletButton.jsx:9/48`, tabs `:459`, chips `:582`.
**Fix:** One global `index.css` rule: `*:focus-visible{ outline:2px solid #f5c542; outline-offset:2px }`; remove the bare `focus:outline-none` from inputs (keep border shift as secondary). Add `active:scale-[.98] active:opacity-90` to shared button classes. Gate the whole TradeBox/DisputePanel form (not just submit) on `status==='signing'` via `fieldset[disabled]` + `aria-busy`.

### T2 — Modal loses wayfinding (no dialog, no route, no deep-link) `[CRITICAL]`
**Problem:** `MarketDetail` is a `fixed inset-0 z-50` overlay with no `role="dialog"`/`aria-modal`, no ESC handler, no focus trap, no focus restore, no body-scroll-lock, no explicit ✕, and no URL sync. Back exits the app; markets can't be shared.
**Why it matters:** Hackathon judging weights Product & UX at 20% and reviewers *will* try to link a live market (e.g. the disputed Flareon `0x2dae…`). Back/forward being broken and no deep-link is a hard dead-end. The logo-as-close is non-obvious (users expect logo→home).
**Surfaces/states:** `MarketDetail.jsx:42-71`, `App.jsx:53-60`. Same dialog gaps in the `WalletButton.jsx:53-72` dropdown (closes on outside-click only, no ESC/trap/restore).
**Fix:** Wrap in a dialog primitive: `role="dialog" aria-modal="true" aria-labelledby={questionId}`, ESC→`onClose`, focus to heading on open / restore to triggering card on close, `body{overflow:hidden}` while open, explicit ✕ at top-right. Sync `selectedId` to the URL (`pushState ?market=<id>` + `popstate`) so Back closes the modal and markets deep-link. Apply ESC+restore to the wallet dropdown too.

### T3 — Accent dilution: two competing golds `[HIGH]`
**Problem:** `sc.accent #f5c542` and `sc.amber #f59e0b` (plus a duplicate `sc.warn` = same hex) split brand duty arbitrarily — accent for links/strike, amber for Connect/Faucet/PREDICT/proposed. Amber doubles as brand chrome AND the "proposed/caution" semantic.
**Why it matters:** "Single gold accent" is a core signature. Two yellows 12px apart in hue means the loudest thing onscreen isn't unambiguously "the brand."
**Surfaces/states:** `tailwind.config.js:17-22`, `Header.jsx:28/54`, `WalletButton.jsx:9`, `Footer.jsx:54`, `index.css:24-36`, `MarketCard.jsx:143`, `constants.js MARKET_STATE_COLORS`.
**Fix:** Make `#f5c542` the brand/CTA/accent gold — re-skin Connect pill, Faucet, and PREDICT wordmark to it. Reserve amber **strictly** as the proposed/caution state color (push it warmer, e.g. `#e08a1e`, so it reads as state not chrome). Delete the duplicate `sc.warn`; point `MARKET_STATE_COLORS` and `StateBanner` at one token. Add an `accentHover` token to kill the repeated `#d97706` literal.

### T4 — Contrast + sub-10px legibility floor `[HIGH]`
**Problem:** `sc-muted #6b6b7e` is 3.48:1 on `sc-card` (fails AA) and carries most labels; type bottoms out at 6px (1st-ed superscript) / 8px (era labels, chips) where tracked uppercase becomes a smear on `#000`.
**Why it matters:** The "dense yet scannable" terminal goal collapses into clutter when labels are unreadable. Density without legibility is just noise.
**Surfaces/states:** App-wide labels; `EditionBadges.jsx:9` (6px), `Header.jsx:43-44` (8px), `MarketCard.jsx:66/73`, `OracleConsensusPanel.jsx:105-110`, axis ticks in `OracleStrikeChart`.
**Fix:** Lighten tertiary token to ~`#8a8a9c` (≈5.3:1 on `#000`, ≈4.6:1 on card), or restrict `#6b6b7e` to non-essential decoration. Set a **hard 10px floor** for any text a bettor reads; reserve <10px for purely decorative marks. Render 1st-ed as `8-9px` "st" or inline "1st," not a 6px sup. Re-test labels on `sc-card`/`sc-surface`, not just `#000`.

### T5 — Flat text hierarchy + no type scale `[HIGH]`
**Problem:** Only 3 text tokens (`text/dim/muted`) but the UI reaches for raw `text-white` ~30 times as a 4th (brighter) tier — so the brightest level is untokenized and the real hierarchy (white→text→dim→muted) isn't named. There is **no fontSize scale**: 166 ad-hoc `text-[Npx]` literals across 11 distinct sizes. On tiles, the two hero numbers (Strike, Oracle-now) are the *same* 15px, differentiated by color alone.
**Why it matters:** "Numbers are the hero" fails the SWAP test — swap in a generic sans and the feel barely changes because hierarchy is size-only, not size+weight+tracking+treatment.
**Surfaces/states:** `tailwind.config.js:13-16`; `MarketCard.jsx:67/75`; `OracleConsensusPanel.jsx:71` (24px) vs `OracleSwarmPanel.jsx:37` (20px) — same hero number, two sizes.
**Fix:** Add a 4th token `sc.bright` (`#f5f5fa`) for headline numbers; replace raw `text-white`. Define a `theme.fontSize` scale (micro 10 / label 11 / body 13 / value 15 / h3 18 / hero 24–28) with paired weight/tracking. Make Oracle-now the dominant tile figure (live datum, ~17px bold) vs Strike as reference; consider `font-mono` (already provisioned) on both hero numbers and the consensus headline price to land the terminal signature.

### T6 — Data-viz accessibility, legibility & robustness `[HIGH]`
**Problem:** `OracleStrikeChart` is mouse-only — comp dots are bare `<circle>` (no tabindex/role/keyboard/focus ring/aria), the SVG has no `role="img"`/label, tooltips have no touch support and clip at chart edges (`whitespace-nowrap` + fixed `-translate-x-1/2`). Axis colors are hardcoded hex (forks from tokens). Silent degradations: the forecast cone simply vanishes when `<2` comps (legend still claims "95% cone"); `OracleSwarmPanel` WeightBar hardcodes `maxWeight=1.5`.
**Why it matters:** The chart *is* the "bet with data" thesis, and degens bet on phones where the entire tooltip/crosshair layer is currently unreachable.
**Surfaces/states:** `OracleStrikeChart.jsx:62/116-134/178-199/230-250/298-330`, `OracleSwarmPanel.jsx:128/161`.
**Fix:** Add `role="img"` + summary `aria-label` to the SVG; make comp dots focusable links with Enter-to-open + focus stroke; bind `onPointerDown` for touch; provide an offscreen comps `<table>` for SR (the ladder already covers much of this). Clamp tooltip x-anchor when `x%>80/<20` and flip vertical near the top. Route SVG text through token hex constants. When `n<2`, render "forecast unavailable — too few comps" and hide the "95% cone" chip; compute WeightBar `maxWeight` dynamically.

### T7 — Error ≠ empty; missing intermediate states `[HIGH]`
**Problem:** Several async regions collapse failure into "no data." `OracleSwarmPanel`'s fetch `.catch(()=>setData(null))` shows "Oracle swarm not yet initialized / Run node swarm.mjs" — dev copy — on any network error or during loading. `RegistryCardLadder` returns `null` (blank gap) while `useCard` loads/errors. `MarketDetail` doesn't thread `useCard` error/empty, so an oracle outage looks like a normal market with em-dashes. The top-level markets *error* dumps a raw RPC string with no Retry, despite `refetch` being in scope (`App.jsx:12`).
**Why it matters:** A bettor can't tell "broken" from "slow" from "genuinely no data" — eroding trust at the exact decision moment.
**Surfaces/states:** `OracleSwarmPanel.jsx:9-18`, `RegistryCardLadder.jsx`, `MarketDetail.jsx:24/114/548`, `App.jsx:40-45`, `Header.jsx` era strip (5 dashes look identical to a load failure).
**Fix:** Split loading / loaded / empty / error everywhere, mirroring the `LoadingStateView` discipline used elsewhere in SlabClaw. Never show "Run node swarm.mjs" to an end user (dev flag only). Give `App.jsx` error/empty a centered `sc-card` panel with glyph + human sentence + raw message in `text-[11px]` + a Retry wired to `refetch`. Add skeleton rows to the ladder/swarm/chart and a pulse to the era strip while loading.

### T8 — Depth-strategy leaks (shadows in a borders-only system) `[MED]`
**Problem:** The committed strategy is borders/surface-tint, but drop shadows leak in: `MarketCard.jsx:44` (`shadow-md`), `MarketDetail.jsx:77` (`shadow-lg`), `WalletButton.jsx:54` (`shadow-2xl`), tooltips (`shadow-xl/2xl`). On `#000` these barely render yet still mix two depth languages — the exact "pick one approach" anti-pattern.
**Why it matters:** Inconsistency reads as a craft tell; the dropdown's `shadow-2xl` is the only loud shadow in the chrome.
**Surfaces/states:** card images, wallet dropdown, three chart tooltips.
**Fix:** Drop the shadows; the existing `ring-1 ring-sc-border` already gives the edge. For floating layers that need lift, use a slightly lighter surface (`sc-panel`/`sc-surface`) + border, not a shadow. Card *photo* shadows may stay if standardized to one value (they're on a physical object), but remove from the dropdown and tooltips.

### T9 — Token/spacing/radius inconsistency (no scales) `[MED]`
**Problem:** No radius tokens — `rounded-[5px]` (pill) sits beside `rounded-md` (faucet) and `rounded-[2px]` (logo); the skeleton image is `rounded-md` while the real card image is `rounded-lg` (corner pop on load). No spacing scale — heavy half-step `gap-3.5`/`p-3.5`/`py-[7px]` drift. Platform colors live in **three** disagreeing maps (`OracleSwarmPanel` raw Tailwind rainbow, `OracleConsensusPanel` PLAT_COLOR hex, `RegistryCardLadder` PLAT_COLOR) — eBay is amber in one, blue in another. Grade colors are duplicated between `tailwind.config` and `GradeBadge.GRADER_COLOR` (drift risk); TAG purple / ACE green / R-HOLO fuchsia exist in no token.
**Why it matters:** The TOKEN test fails — ~12 unmanaged hues in a "single-accent" system, and the same platform reads as different colors across panels.
**Surfaces/states:** `tailwind.config.js`, `WalletButton.jsx:9`, `App.jsx:110`, `OracleSwarmPanel.jsx:204-222`, `OracleConsensusPanel.jsx:23-27`, `EditionBadges.jsx:37`.
**Fix:** Define `theme.borderRadius` (sm 4 / md 6 / lg 8 / xl 12 / full) and replace literals; align skeleton image to `rounded-lg`. Single-source platform color (one SC-tokenized map, or neutral mono chips with 2-letter monograms — preferred, since saturated rainbow dilutes the accent). Single-source grader colors (GradeBadge imports from tokens); add `sc.tag`/`sc.ace`/`sc.rholo` tokens. Add `sc.borderStrong #34343f` (already the orphan scrollbar-hover value) for the emphasis border tier.

### T10 — Faucet/onboarding friction + touch targets `[MED]`
**Problem:** Onboarding-critical CTAs are below the 44px touch minimum — Connect/account pill (~26px), Faucet (~28px), quick-amount chips (~24px), InfoTip 'i' (12px, hover-only so unreachable on touch), 6px chart dots. The faucet error path only flips the label to "Failed" for 3s with no reason (out of gas? rejected? wrong network?); success uses a fixed `setTimeout(1200ms)` balance refetch that can show "Funded" while Balance stays stale. `useTusdBalance.isLoading` is never consumed, so a loading balance reads as "you have 0 tUSD."
**Why it matters:** Connect + Faucet are the onboarding gate for a fast-betting app; cramped/silent here loses users before their first bet.
**Surfaces/states:** `WalletButton.jsx:9`, `Footer.jsx:14/50-57`, `MarketDetail.jsx:437/582`.
**Fix:** Raise Connect/Faucet/chips/tabs to a 44px min hit area (invisible larger hit zone is fine). Make InfoTip a real focusable `<button>` that tap-toggles on touch. On faucet error, surface the truncated message in an `sc-no` line; on success, poll/refetch balance until it changes. Consume `isLoading` to show a shimmer/"—" for balance instead of `0`.

### T11 — Optimistic update + motion language `[MED]`
**Problem:** After a buy/dispute the YES/NO bar and pool only move after `refetch()` + a 3s delayed second `refetch` (`App.jsx:58`) — the user's own trade appears to do nothing for seconds. No spinner during "Confirm in wallet…" (multi-second round-trip looks frozen). Transitions use Tailwind's generic 150ms default (no duration/easing tokens), so micro-interactions have no committed motion identity.
**Why it matters:** On a terminal where actions commit money, perceived responsiveness is trust.
**Surfaces/states:** `MarketDetail.jsx:524-533/216-225`, `App.jsx:58`.
**Fix:** Optimistically bump local `totalYes`/`totalNo` by the bet amount to move the implied-% bar immediately, then reconcile on refetch. Add a small inline CSS-rotate spinner during signing (no spring — easing only, per signature). Define motion tokens (`duration-fast 120ms`, `ease-out`) and apply to interactive transitions; ban spring.

### T12 — Triage friction: live vs past markets read equally loud `[MED]`
**Problem:** Active and Past markets render in identical `bg-sc-card` tiles; a settled/expired market is as visually loud as a live, bettable one — the eye must read each banner to know what's actionable. Worse, a market can be `state===0` (Active, clickable, gold hover) yet `expired` (`MarketCard.jsx:25`) — presented as bettable but actually awaiting resolution. The hero paragraph is a 6-sentence protocol explainer above the markets, burying the markets.
**Why it matters:** A degen scanning for live bets is slowed by having to disambiguate every tile and may click into an un-bettable expired market.
**Surfaces/states:** `App.jsx:24-35/81-90`, `MarketCard.jsx:25/96-98`, `Footer.jsx:36` (footer still credits the abandoned "DeepBook track" — should read "Walrus track" per the 2026-06-07 pivot).
**Fix:** De-emphasize Past tiles as a group (`opacity-70`, restore on hover). For `state===0 && expired`, render an "Expired — awaiting oracle proposal" banner, drop the gold hover, and sort to the bottom of Active. Cut the hero to a one-line subhead; move "How it works" behind a disclosure near the faucet. Fix the footer track label to "Walrus track" (a one-word credibility fix for judges).

---

## Prioritized Roadmap (Impact × Effort)

### Quick Wins — high-impact, low-effort (do first)

| Title | Theme | Impact | Effort | Files | Exact change |
|---|---|---|---|---|---|
| Global focus-visible ring | T1 | H | S | `index.css`; remove `focus:outline-none` at `MarketDetail.jsx:344/577` | `*:focus-visible{outline:2px solid #f5c542;outline-offset:2px}`; inputs keep border shift + add `focus-visible:ring-2 ring-sc-accent/60` |
| Lighten `sc-muted` to AA | T4 | H | S | `tailwind.config.js:16` | `muted: '#8a8a9c'` (or restrict `#6b6b7e` to decoration); re-test on `sc-card` |
| Fix footer track label | T12 | M | S | `Footer.jsx:36` | "DeepBook track" → "Walrus track" |
| Add `:active` press feedback | T1 | M | S | shared button classes (`MarketCard.jsx:38`, `Footer.jsx:50`, `WalletButton.jsx:9`, chips `MarketDetail.jsx:582`, tabs `:459`) | `active:scale-[.98] active:opacity-90` |
| Reconcile the two golds | T3 | H | S→M | `tailwind.config.js:17-22`, `Header.jsx:54`, `Footer.jsx:54`, `WalletButton.jsx:9`, `index.css:24-36` | CTAs → `sc-accent`; amber→caution-only; delete duplicate `sc.warn`; add `accentHover` token for `#d97706` |
| Remove off-strategy shadows | T8 | M | S | `MarketCard.jsx:44`, `MarketDetail.jsx:77`, `WalletButton.jsx:54`, tooltips in `OracleStrikeChart` | Drop `shadow-md/lg/xl/2xl`; lift dropdown via `sc-surface` + border |
| Align skeleton radius + count | T9 | L | S | `App.jsx:110/104-123` | Image `rounded-md`→`rounded-lg`; key skeleton count to `marketIds.length` |
| Gate whole form during tx | T1 | M | S | `MarketDetail.jsx` TradeBox/DisputePanel | `fieldset[disabled]` on `status==='signing'` + `aria-busy`; disable Side toggle, chips, inputs |
| 10px legibility floor + 1st-ed fix | T4 | M | S | `EditionBadges.jsx:9`, `Header.jsx:43-44`, sub-10px labels | Raise meaningful labels to ≥10px; render "1st" inline not 6px sup |
| Consume balance loading state | T10 | M | S | `Footer.jsx`, `MarketDetail.jsx` TradeBox | Use `useTusdBalance.isLoading` → shimmer/"—" instead of `0` |
| De-emphasize Past + expired-active | T12 | M | S | `App.jsx:81-90`, `MarketCard.jsx:25/96` | Past group `opacity-70`; expired-active → "awaiting resolution" banner, no gold hover |
| 44px hit areas on onboarding CTAs | T10 | M | S | `WalletButton.jsx:9`, `Footer.jsx:54`, chips `MarketDetail.jsx:582` | `min-h-[44px]` / padded invisible hit zone |
| aria on icon-only controls | T6/T1 | M | S | `WalletButton.jsx:48`, `Header.jsx`, `OracleStrikeChart` SVGs | `aria-expanded`/`aria-haspopup` on toggle; `aria-label` on icons; `role="img"`+label on charts; `aria-hidden` on decorative SVGs |

### High-Impact Bigger Lifts

| Title | Theme | Impact | Effort | Files | Exact change |
|---|---|---|---|---|---|
| Make MarketDetail a real dialog | T2 | H | M | `MarketDetail.jsx:42-71`, `App.jsx:53-60` | `role="dialog" aria-modal` + `aria-labelledby` h1; ESC→close; focus trap + restore to card; body scroll-lock; explicit ✕ |
| Deep-link markets to URL | T2 | H | M | `App.jsx:10/53-60` | Sync `selectedId` ↔ `?market=<id>` via `pushState`/`popstate`; Back closes modal; shareable links |
| Consolidate the two consensus panels | T5/T9 | H | L | `OracleSwarmPanel.jsx`, `OracleConsensusPanel.jsx`, `MarketDetail.jsx:175/477` | Keep `OracleConsensusPanel` canonical; merge swarm's deviation column + reliability chart; delete `OracleSwarmPanel` (or its color map); one WalrusIcon module |
| Define type + radius + 4th-text scale | T5/T9 | H | L | `tailwind.config.js`, app-wide `text-[Npx]` | `theme.fontSize` scale + `theme.borderRadius`; add `sc.bright`; route `text-white`→token; differentiate Strike vs Oracle hero numbers by size+weight (+`font-mono`) |
| Single-source platform/grader colors | T3/T9 | H | M | `OracleSwarmPanel.jsx:204-222`, `OracleConsensusPanel.jsx:23-27`, `RegistryCardLadder.jsx`, `GradeBadge.jsx`, `tailwind.config.js` | One SC platform map (or neutral mono chips); GradeBadge imports grader tokens; add `sc.tag/ace/rholo` |
| Error ≠ empty across async regions | T7 | H | M | `OracleSwarmPanel.jsx:9-18`, `RegistryCardLadder.jsx`, `MarketDetail.jsx`, `App.jsx:40-45` | Split loading/empty/error; skeleton rows; Retry wired to `refetch`; never show "Run node swarm.mjs" to users |
| Chart keyboard + touch + edge-safe tooltips | T6 | H | L | `OracleStrikeChart.jsx:62/230-250/298-330` | Focusable comp dots (Enter→open, focus stroke); `onPointerDown` touch; offscreen comps table; clamp/flip tooltip anchors; hide "95% cone" when no cone |
| Wrong-network + connecting wallet states | T10 | H | M | `WalletButton.jsx:22-51`, `main.jsx` | Read active chain; if ≠ testnet render `sc-no` "Wrong network" pill + disable Faucet/trade; add connecting skeleton |
| Optimistic trade update + spinner | T11 | M | M | `MarketDetail.jsx:524-533`, `App.jsx:58` | Local bump `totalYes/totalNo` on success → reconcile on refetch; inline CSS spinner during signing; motion tokens (`duration-fast 120ms ease-out`) |
| Replace decorative confidence-band rainbow | T6/T3 | M | S | `OracleConsensusPanel.jsx:185` | Drop `from-sc-no via-sc-accent to-sc-yes`; neutral `sc-surface` track + consensus dot + bound ticks + gold strike tick |
| Detail-view loading skeletons | T7 | M | M | `MarketDetail.jsx` GraphPanel/stat cards, `RegistryCardLadder` | Chart axis+line shimmer, 4 stat-card blocks, 3–4 ladder rows — match App-grid skeleton quality |

---

## Appendix — Full Deduped Findings by Surface (with severity)

**Dedupe note:** the cross-surface "no focus state" (F1/A11Y-02/MD-02/ML-01/CH-03/ORC-03/ORC-08), "modal not a dialog/route" (MD-01/F6/A11Y-04/FLOW-01/FLOW-02/NAV-01), "two golds" (CH-01/F12/ML-06/MD-16), "sc-muted fails AA" (A11Y-01/MD-08/ML-12/CH-10/ORC-05), "shadow leaks" (F9/DEPTH-01/ML-03/MD-06/ORC-11/CH-04), "platform-color rainbow/maps" (F2/F3/COLOR-01/ORC-01), "no type scale / flat hierarchy" (F4/F5/ML-02/MD-05/ORC-07/DENS-01), "error≠empty" (STATE-02/F15/MD-10/ORC-02/CH-08/CH-14), "touch targets" (A11Y-05/F14/MD-09/CH-12), and "optimistic update/motion" (F8/MD-04/STATE-01/CH-08) findings were each merged once.

### Markets List (`App.jsx`, `MarketCard.jsx`, `Sparkline.jsx`)
- **HIGH** ML-01 tile `<button>` has no focus/active/aria — *see T1.*
- **HIGH** ML-02 only 3 text tiers; primary uses raw `text-white` — *see T5.*
- **HIGH** ML-03 image `shadow-md` in a borders-only system — *see T8.*
- **HIGH** ML-04 error/empty are bare lines, no Retry despite `refetch` in scope — *see T7.*
- **MED** ML-05 skeleton: unison pulse, low-contrast fill, hardcoded count of 3 — *see T7/T9.*
- **MED** ML-06 duplicate amber tokens compete with gold — *see T3.*
- **MED** ML-07 Strike vs Oracle hero numbers same 15px, differ by color only — *see T5.*
- **MED** ML-08 no loading distinction for unresolved oracle (bare em-dash) — *see T7.*
- **LOW** ML-09 skeleton image `rounded-md` vs card `rounded-lg` — *see T9.*
- **MED** ML-10 icon-free banners/headers carry state by color alone — *see T6/T1.*
- **LOW** ML-11 6-sentence hero wall buries the markets — *see T12.*
- **MED** ML-12 color-only YES/NO bar; `sc-muted` below AA — *see T4.*
- **LOW** ML-13 Past tiles as loud as Active — *see T12.*
- **MED** ML-14 expired-but-active tile styled as bettable — *see T12.*
- **LOW** ML-15 spacing drifts to `gap-3.5`/`py-7` half-steps — *see T9.*
- **LOW** ML-16 disputed `border-sc-no/40` at rest shouts before engagement — soften to `/25`, reserve bright for hover.

### Market Detail (`MarketDetail.jsx`)
- **CRITICAL** MD-01 no ESC/trap/restore/scroll-lock/role; logo-as-close — *see T2.*
- **HIGH** MD-02 no focus-visible; inputs strip outline — *see T1.*
- **HIGH** MD-03 insufficient-balance only handled as all-or-nothing `broke` — compute `insufficient = amount > tusd`, disable Buy + flag input amber.
- **HIGH** MD-04 no spinner/optimistic update; blunt `refetch + setTimeout(3s)` — *see T11.*
- **MED** MD-05 heavy 9–10px labels; 3-tier tokens collapse — *see T5/T4.*
- **MED** MD-06 card image `shadow-lg`; inputs not recessed vs info tiles — *see T8* (+ use `sc-panel` for input wells).
- **MED** MD-07 three radii stacked in one trade box — *see T9.*
- **MED** MD-08 `sc-muted` ~4.0:1; `opacity-50` disabled below AA — *see T4.*
- **MED** MD-09 chips `py-1`, InfoTip 12px hover-only, sub-44px CTAs — *see T10.*
- **MED** MD-10 `useCard` error/empty unhandled; UI silently degrades — *see T7.*
- **MED** MD-11 raw `err.message` in banner, no `role="alert"`, no dismiss — map failure classes to plain language; add dismiss + alert role.
- **LOW** MD-12 off-grid `h-[52px]`/`h-[132px]`; sticky `top-16` vs 52px bar mismatch — snap to grid, share a bar-height var.
- **LOW** MD-13 ad-hoc unicode glyphs (↗→✓↓) — adopt one icon set, `aria-hidden`.
- **LOW** MD-14 dense run-on Disputed/Settled banners; stale "on the right" wording on mobile — lead with bold verdict, layout-agnostic copy.
- **LOW** MD-15 disabled Dispute/Buy buttons give no reason — helper line / label the threshold ("Min 10,000 tUSD" / "Enter an amount").
- **LOW** MD-16 two near-identical golds — *see T3.*
- **LOW** MD-17 Proposed/Disputed TradeBox is a dead box disconnected from the DisputePanel CTA above — add a contextual pointer.
- **LOW** MD-18 number inputs lack `inputMode`/`aria-label`/`aria-describedby` — add them, tie to balance.

### Oracle / Data-Viz (`OracleStrikeChart`, `OracleConsensusPanel`, `OracleSwarmPanel`, `Sparkline`, `RegistryCardLadder`)
- **HIGH** ORC-01 SwarmPanel raw-Tailwind platform colors vs ConsensusPanel hex map — *see T9.*
- **HIGH** ORC-02 SwarmPanel has no loading state; flashes "Run node swarm.mjs" — *see T7.*
- **HIGH** ORC-03 chart mouse-only; dots/SVG not keyboard/SR/touch accessible — *see T6.*
- **MED** ORC-04 confidence band uses a meaningless red→gold→green rainbow — *see roadmap "Replace confidence-band rainbow."*
- **MED** ORC-05 hardcoded axis hex; pervasive 8–9px text — *see T4/T9.*
- **MED** ORC-06 four inconsistent empty states (SwarmPanel has no card wrapper) — one shared EmptyState primitive, match populated height.
- **MED** ORC-07 consensus hero 24px vs 20px across panels — *see T5.*
- **MED** ORC-08 Verify CTA / links / show-all `<tr>` lack focus/active; div-as-button — *see T1* (+ convert `<tr>` to real button).
- **LOW** ORC-09 tooltips/dot-radius hard-cut — add ≤90ms ease-out, `transition: r 80ms`.
- **MED** ORC-10 cone silently absent <2 comps; WeightBar hardcoded `maxWeight=1.5` — *see T6.*
- **LOW** ORC-11 tooltips use `shadow-xl/2xl` — *see T8.*
- **MED** ORC-12 tooltips clip/collide at chart edges — *see T6.*
- **LOW** ORC-13 generic circle-plus "WalrusIcon," duplicated in two files — use real Walrus mark, one shared module.
- **MED** ORC-14 grader slab tokens unused in viz; legend swatch hardcoded `sc-yes` (green triple-booked) — tint legend with grader token, keep dots = above/below strike.
- **LOW** ORC-15 footer legend half-step gaps; ad-hoc tooltip offsets — normalize to gap tokens + a named offset constant.
- **HIGH** ORC-16 two near-duplicate consensus panels drift — *see roadmap "Consolidate."*

### Chrome (`Header`, `Footer`, `WalletButton`, `GradeBadge`, `EditionBadges`, `EraIcons`, `index.css`)
- **HIGH** CH-01 every chrome CTA uses amber, not the gold accent — *see T3.*
- **CRITICAL** CH-02 no wrong-network / connecting state — *see roadmap "Wrong-network."*
- **HIGH** CH-03 dropdown: no ESC/trap/restore, no `aria-expanded` — *see T2.*
- **MED** CH-04 dropdown `shadow-2xl` — *see T8.*
- **MED** CH-05 five ad-hoc radii across chrome — *see T9.*
- **HIGH** CH-06 unscoped `button[data-dapp-kit]` `!important` override repaints the whole ConnectModal amber — scope to `.sc-connect`, delete the bare selector.
- **MED** CH-07 footer credits the abandoned DeepBook track — *see T12* (fix to "Walrus track").
- **MED** CH-08 faucet error/optimism: no reason on fail, fixed 1200ms refetch, no spinner — *see T10/T11.*
- **MED** CH-09 no breadcrumb/back in chrome on detail; era chips look interactive but filter nothing — add a context slot; either make era chips filter or remove hover affordance.
- **MED** CH-10 8–9px / 6px labels at `sc-muted` near legibility floor — *see T4.*
- **MED** CH-11 icon-only toggle/copy lack aria; decorative SVGs not `aria-hidden` — *see Quick Win "aria on icon-only."*
- **MED** CH-12 chrome CTAs sub-44px — *see T10.*
- **LOW** CH-13 footer border full-opacity vs header `/60` — match to `/60`.
- **LOW** CH-14 era strip no loading/error (5 dashes = "broke?") — *see T7.*
- **LOW** CH-15 R-HOLO `fuchsia-400` collides with TAG purple — promote a distinct `sc-rholo` token.
- **LOW** CH-16 `#d97706` hover hardcoded in 3 places — add `accentHover` token.

### Design-System / Cross-Cutting (`tailwind.config.js`, `index.css`, all components)
- **CRITICAL** F1 no visible focus anywhere — *see T1.*
- **HIGH** F2 SwarmPanel rainbow platform chips — *see T9.*
- **HIGH** F3 second/third disagreeing platform maps; untokenized grader colors — *see T9.*
- **HIGH** F4 166 ad-hoc `text-[Npx]`, no fontSize scale, 6–8px floor — *see T5/T4.*
- **MED** F5 only 3 text tiers; raw `text-white` is the untokenized 4th — *see T5.*
- **HIGH** F6 modal not a dialog — *see T2.*
- **HIGH** F7 icon-only buttons / InfoTip lack aria + keyboard reach — *see T6/T1.*
- **MED** F8 untuned motion; no optimistic update — *see T11.*
- **MED** F9 shadow leaks across cards/dropdown/tooltips — *see T8.*
- **MED** F10 `rounded-[5px]`/`[2px]` break the radius scale — *see T9.*
- **LOW** F11 lone off-grid `py-[7px]` — replace with grid value + line-height.
- **MED** F12 two parallel golds with no rule — *see T3.*
- **LOW** F13 single border token faked via opacity; orphan `#34343f` — add `sc.borderStrong`.
- **MED** F14 sub-44px header/InfoTip targets — *see T10.*
- **MED** F15 async regions miss loading/error split — *see T7.*
- **LOW** F16 SWAP test partially fails — type signature thin; strengthen wordmark/hero numeric treatment — *see T5.*
- **LOW** F17 raw hex in JSX; grader palette duplicated in two places — single-source via tokens; add `accentHover`.

### Journey / Information Architecture (`App.jsx`, `MarketDetail.jsx`, `Header`, `Footer`, `WalletButton`)
- **CRITICAL/HIGH** A11Y-01 `sc-muted` fails AA on cards — *see T4.*
- **CRITICAL** A11Y-02 / F1 no focus ring — *see T1.*
- **HIGH** STATE-01 no loading on disconnect/balance/post-tx — *see T10/T11.*
- **HIGH** STATE-02 error collapsed into empty (SwarmPanel/ladder/`useCard`) — *see T7.*
- **HIGH** STATE-03 form stays interactive mid-tx — *see T1.*
- **HIGH** A11Y-03 icon/role-less interactive elements; charts no `role="img"` — *see T6/T1.*
- **HIGH** A11Y-04 / FLOW-02 modal not a dialog — *see T2.*
- **HIGH** A11Y-05 sub-44px tap targets — *see T10.*
- **HIGH** FLOW-01 detail is `useState`, not a route — no deep-link, Back broken — *see T2 roadmap "Deep-link markets."*
- **MED** A11Y-06 number inputs lack labels/`inputMode`/`aria-describedby` + silent validation — associate labels, surface inline validation.
- **MED** STATE-04 no `:active` press state — *see T1.*
- **MED** DENS-01 8–9px labels compound the contrast failure — *see T4.*
- **MED** COLOR-01 rainbow platform chips + disagreeing maps + R-HOLO fuchsia — *see T9.*
- **LOW** DEPTH-01 image/dropdown shadows in borders-only system — *see T8.*
- **LOW** STATE-05 inconsistent loading craft (plain text vs skeleton) — *see roadmap "Detail-view skeletons."*
- **LOW** NAV-01 logo-only close, no ✕/back, no scroll restore — *see T2.*
- **LOW** DENS-02 implicit half-step spacing system — codify a base-4 scale.
