# Sui/Walrus Technical Research — Anima Swarm

**Date:** 2026-05-14

---

## Walrus Track 2026 — Confirmed Details

- **Prize:** $70K (1st: $35K, 2nd: $15K, 3rd: $7.5K, 4th: $5K + $7.5K honorable)
- **Build period:** May 7 — Jun 21
- **Shortlist:** Jul 8 | **Demo Day:** Jul 20-21 | **Winners:** Aug 27
- **Award:** 50% at announcement, 50% after mainnet deploy (100% if already on mainnet)
- **Track focus:** "AI agents and agentic workflows powered by Walrus as verifiable data and memory layer"
- **MemWal explicitly listed** in participant handbook resources

### Judging Criteria
| Criterion | Weight |
|-----------|--------|
| Real-World Application | 50% |
| Product & UX | 20% |
| Technical Implementation | 20% |
| Presentation & Vision | 10% |

---

## Walrus SDK — Working Patterns

### TypeScript SDK (`@mysten/walrus`)

```ts
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { walrus } from '@mysten/walrus';

const client = new SuiGrpcClient({
  network: 'testnet',
  baseUrl: 'https://fullnode.testnet.sui.io:443',
}).$extend(walrus());

// Write blob
const { blobId } = await client.walrus.writeBlob({
  blob: new TextEncoder().encode(JSON.stringify(essenceData)),
  deletable: true, epochs: 3, signer: keypair,
});

// Read blob
const bytes = await client.walrus.readBlob({ blobId });
```

**IMPORTANT PRD FIX:** The PRD uses `SuiJsonRpcClient` — this should be `SuiGrpcClient` with the `walrus()` extension. The `WalrusClient` constructor pattern in the PRD is wrong.

### HTTP API (simpler for server-side)
```bash
# Store
curl -X PUT "https://publisher.walrus-testnet.walrus.space/v1/blobs?epochs=5&deletable=true" --upload-file state.json

# Read
GET https://aggregator.walrus-testnet.walrus.space/v1/blobs/{blobId}
```

### Gotchas
- Without upload relay: ~2200 requests to write, ~335 to read
- Upload relay: `https://upload-relay.testnet.walrus.space` (single call)
- Vite WASM import: `import walrusWasmUrl from '@mysten/walrus-wasm/web/walrus_wasm_bg.wasm?url'`
- Blob IDs are content-addressed (same content = same ID)

---

## Move Contract Patterns (from Hero Game Example)

### Architecture
- **Shared object** for global state (GameMap): `transfer::share_object(game)`
- **Owned objects** for player assets (Spirit): `transfer::public_transfer(spirit, owner)`
- **Capability-based admin** (AdminCap): required param for state-mutating functions
- **game_id cross-referencing**: `assert!(hero.game_id == boar.game_id, EWrongGame)`
- **Events** for all game actions: `event::emit(BattleEvent { ... })`

### Dynamic Fields for Hex Map
```move
use sui::dynamic_field;
dynamic_field::add(&mut game.id, hex_key, territory_data);
let territory = dynamic_field::borrow_mut<u64, Territory>(&mut game.id, hex_key);
```
Better than 37 separate shared objects (avoids contention).

---

## 2025 Winner Patterns

| Place | Project | Why It Won |
|-------|---------|------------|
| 1st | SuiSign | Walrus structurally essential (not optional storage) |
| 2nd | WalGraph | Novel primitive on Walrus (graph DB) |
| 3rd | SuiMail | Walrus as messaging backbone |

**Pattern:** "What new primitive does Walrus enable that was previously impossible?"

**Anima Swarm's answer:** Verifiable persistent multi-agent memory as a game mechanic — agents share battle logs and territory discoveries through MemWal, enabling emergent swarm behavior. Structurally impossible without Walrus.

---

## PRD Impact (things to fix)

1. Replace `SuiJsonRpcClient` with `SuiGrpcClient` + `walrus()` extension in walrusService.js
2. Add HTTP API as fallback for server-side blob operations
3. Consider dynamic fields for hex map instead of flat struct
4. Add `game_id` cross-referencing pattern to contracts
5. Add event emission to all state-mutating contract functions
