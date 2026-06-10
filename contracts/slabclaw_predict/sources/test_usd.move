/// test_usd.move — Faucet-minted test settlement currency for SlabClaw Predict.
///
/// TESTNET ONLY. Markets settle in tUSD instead of SUI so judges can trade without
/// spending real SUI. 9 decimals (mirrors MIST) so market share-math is unchanged.
///
/// The TreasuryCap is wrapped in a shared `Faucet` object and `mint` is public —
/// anyone can mint themselves test USD from the dapp footer faucet.
module slabclaw_predict::test_usd {
    use sui::object::{Self, UID};
    use sui::coin::{Self, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::url;
    use std::option;

    /// One-time witness.
    public struct TEST_USD has drop {}

    /// Shared faucet holding the treasury. Public mint.
    public struct Faucet has key {
        id: UID,
        treasury: TreasuryCap<TEST_USD>,
    }

    /// Default faucet drip: 10,000 tUSD (9 decimals).
    const DRIP: u64 = 10_000_000_000_000;
    /// Cap a single mint at 1,000,000 tUSD to avoid silly overflows.
    const MAX_MINT: u64 = 1_000_000_000_000_000;

    const EAmountTooLarge: u64 = 0;

    #[allow(deprecated_usage)]
    fun init(witness: TEST_USD, ctx: &mut TxContext) {
        let (treasury, metadata) = coin::create_currency(
            witness,
            9,
            b"tUSD",
            b"SlabClaw Test USD",
            b"Faucet-minted test USD for SlabClaw Predict markets (testnet only).",
            option::some(url::new_unsafe_from_bytes(b"https://slabclaw.com/assets/app-icon.png")),
            ctx,
        );
        transfer::public_freeze_object(metadata);
        let faucet = Faucet { id: object::new(ctx), treasury };
        transfer::share_object(faucet);
    }

    /// Mint `amount` tUSD to the caller. Public — this is a testnet faucet.
    public entry fun mint(faucet: &mut Faucet, amount: u64, ctx: &mut TxContext) {
        assert!(amount <= MAX_MINT, EAmountTooLarge);
        let c = coin::mint(&mut faucet.treasury, amount, ctx);
        transfer::public_transfer(c, tx_context::sender(ctx));
    }

    /// Convenience faucet — mints the default 10,000 tUSD drip to the caller.
    public entry fun drip(faucet: &mut Faucet, ctx: &mut TxContext) {
        let c = coin::mint(&mut faucet.treasury, DRIP, ctx);
        transfer::public_transfer(c, tx_context::sender(ctx));
    }

    public fun drip_amount(): u64 { DRIP }
}
