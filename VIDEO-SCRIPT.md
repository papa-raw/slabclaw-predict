% SlabClaw Predict — Demo Video Script
% Sui Overflow 2026 · Walrus Track
% Target run time ≈ 4:50 (hard cap 5:00) · YouTube

---

## Before you record — setup & shot list

**Have these open and ready (don't fumble on camera):**

- **Browser tab 1** — `https://slabclaw.com` (the dapp), already on the **Dark Raichu** market. Confirm it reads **PROPOSED / "Resolving"** with an open dispute window (it's staged with a ~110-day window). If it's not, ping me to re-stage before you shoot.
- **Browser tab 2** — `https://slabclaw.com/deck`, on **slide 4 "Who it's for"** (for the market beat) and **slide 1** to open on.
- **Terminal** — in `oracle-bridge/`, font size bumped up (18–22pt), dark theme. Pre-type these two commands but **don't run them yet**:
  - `node prove-learning-loop.mjs goldin base5-1st-83`
  - `node prove-memory-loop.mjs`
- **One dry run of each script** right before recording so the Walrus calls are warm (first call can be slow).

**Tone:** you're showing a working system, not pitching vaporware. Calm, specific, a little proud. Let the numbers do the bragging.

**Total budget:** problem ≤ 0:45 · demo ≈ 3:00 · close ≈ 0:45. If you run long, cut from the swarm-architecture beat, never from the manipulation beat — that's the one judges remember.

---

## 0:00 – 0:45 · The problem

**On screen:** slabclaw.com market list, then slowly scroll the oracle panel for one card (lots of source rows).

**Say:**
> A PSA 10 Charizard. A graded Umbreon. These are real, valuable assets — a two-billion-dollar-a-year market. But ask "what's it worth?" and you get a different answer from every venue, and in a thin market one wash trade can set the "price."
>
> That's the wall in front of onchain collectibles. You can't build a prediction market, a loan, or an index on a number nobody trusts. So we built the number — a price oracle that's manipulation-resistant, remembers what it's seen, and shows its work onchain.

---

## 0:45 – 1:05 · Who it's for (why it matters)

**On screen:** deck slide 4 "Who it's for · the market" — let the two columns and the $500M / $40M / $2B band sit on screen.

**Say:**
> Two sides of one market. People who *hold* cards — collectors who bought tokenized slabs on Courtyard, Collector Crypt, Beezie, now sitting on something volatile and illiquid, who want to hedge. And people who *price* cards — the marketplaces holding inventory, and the lenders who need a mark they can trust to make a loan against a slab. There's half a billion in tokenized cards already onchain. They all need one honest price.

---

## 1:05 – 1:45 · The market (the showcase)

**On screen:** the Dark Raichu market on slabclaw.com. Point to the strike, the YES/NO, then the oracle panel: **"Settles at $7,987."**

**Say:**
> Here's a live market on testnet: *will this Dark Raichu close above the strike by expiry?* You take YES or NO with test USD, parimutuel pool.
>
> But the interesting part isn't the bet — it's how it settles. This price, $7,987, isn't from one feed. It's the agreement of a swarm of agents, and every one of them is shown right here: what they reported, how far they sit from consensus, and — this is the part that matters — *how much the swarm trusts each one.*

**On screen:** hover a source row showing **"41% trust · learned over 158 rounds."**

> See that? "Forty-one percent trust, learned over 158 rounds." Trust here is *earned*, not assigned. Which brings me to the actual product.

---

## 1:45 – 2:20 · How the price is set (the swarm)

**On screen:** scroll the panel — sold rows vs asking rows, the "manipulation rejected" box, the "independent sources" count.

**Say:**
> Thirteen source agents across eleven independent venues. Completed sales set the price; asking prices only bound it. Feeds that resell the same data — like PriceCharting reselling eBay — collapse into one vote, so nobody pads the numbers by quoting eBay five different ways. Outliers get cut by a median-absolute-deviation filter. What survives is a confidence-weighted median. That's the consensus.
>
> And all of it persists on Walrus as the agents' memory — comp history, the trust scores, every manipulation they've ever caught.

---

## 2:20 – 3:10 · The memory has a job: catching manipulation ★ (the star beat)

**On screen:** switch to the terminal. Run `node prove-learning-loop.mjs goldin base5-1st-83`. Let the four beats print live.

**Say (over the output):**
> Let me prove that memory does real work. This runs the actual pipeline. Baseline: consensus, $7,987.
>
> Now I attack it — one source starts posting a price three times too high, a classic shill, four rounds straight.

**On screen:** the rejection rows + the trust column ticking down 41.9 → 40.9 → 40.0 → 39.0 → 38.1%.

> Every spoof — rejected. The consensus never moves, not by a cent. And watch the trust column: the liar's reputation erodes, round after round. The swarm caught it, and it *remembered* who lied.

**On screen:** the PERSIST beat — snapshot to Walrus, memory destroyed, restored from the blob.

> Then the real test. I snapshot the memory to Walrus, I **delete it**, and I restore it from the blob alone — no local files. The grudge comes back. The swarm still knows who tried to manipulate it, even after its memory was wiped and rebuilt from public infrastructure. That's the difference between memory that *remembers* and memory that *learns*.

---

## 3:10 – 3:40 · Memory that outlives its operator

**On screen:** run `node prove-memory-loop.mjs`. Show the destroy → restore-from-chain → identical-consensus verdict.

**Say:**
> One more. Here the snapshot's blob ID is anchored *onchain*. I destroy the entire memory, read the pointer from the Sui contract, pull the blob from Walrus, and rebuild. Identical consensus on every card. The oracle's memory doesn't depend on us being alive — anyone can cold-start it from chain plus Walrus. That's the Walrus thesis, made load-bearing.

---

## 3:40 – 4:10 · Don't trust us — verify

**On screen:** back to the dapp. Click **"Verify evidence on Walrus."** Show the blob. Then the market object on the explorer (the onchain `evidence_blob_id`).

**Say:**
> And none of this asks for your trust. Every settlement ships its full evidence to Walrus — every input, every weight, every rejection. Here's the blob; anyone can re-run the math and get the same number. The market references that blob's ID onchain, so the receipt and the settlement are bound together. On top of that, the contract that moves the money is *formally verified* — the Sui Prover proves it can never pay out more than the pool holds, for every possible input.

---

## 4:10 – 4:50 · Close + vision

**On screen:** deck slide 9 (the close) — "Every collectible has a price opinion. We make it verifiable, neutral, and onchain."

**Say:**
> So that's SlabClaw Predict: prediction markets on real collectibles, settled by a memory-backed, manipulation-resistant oracle swarm — built on Sui, with its memory living on Walrus.
>
> Cards are the wedge. The same oracle prices watches, sneakers, wine — anything graded and authenticated. And it's not just a market; it's an oracle a lender or a marketplace can plug into for a price they don't have to mark themselves.
>
> Every collectible has a price opinion. We make it verifiable, neutral, and onchain. Thanks for watching.

---

### Reference — exact artifacts to point at

- **Live dapp:** slabclaw.com · **Deck:** slabclaw.com/deck
- **Dark Raichu market** settles at **$7,987**; PROPOSED with an open dispute window.
- **Learned-trust line:** "41% trust · learned over 158 rounds" (Goldin row).
- **Manipulation proof:** `prove-learning-loop.mjs` — spoof rejected (MAD z≈9.2), trust 41.9→38.1%, survives Walrus kill/restore.
- **Memory proof:** `prove-memory-loop.mjs` — destroy → restore from onchain pointer + Walrus → identical consensus.
- **Walrus evidence blob** referenced onchain by the market's `evidence_blob_id`.
- **Formal verification:** Sui Prover — solvency, no truncation, bounded probability, overflow-safe.
- **Package:** `0x9807050b…` (hardened, formally verified) · memory module v2 `0x2bfc147c…` · SwarmMemory `0x41dfc599…`.
