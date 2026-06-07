/// registry.move — Asset class registry for collectible prediction markets.
/// Maps (set_name, card_number, grader, grade) tuples to asset class IDs.
/// Shared object — single source of truth for which cards can have markets.
#[allow(lint(public_entry))]
module slabclaw_predict::registry {
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::event;

    // ── Capability ────────────────────────────────────────────────────────────

    /// Admin capability — held by the deployer. Required to register asset classes.
    public struct AdminCap has key {
        id: UID,
    }

    // ── Objects ───────────────────────────────────────────────────────────────

    /// An asset class definition. Represents a specific graded card configuration.
    /// e.g., "Base Set Charizard #4, PSA 10"
    public struct AssetClass has store, copy, drop {
        /// Unique asset class identifier (e.g., "BASE_SET_CHARIZARD_4_PSA_10")
        asset_id: vector<u8>,
        /// Card set name (e.g., "Base Set")
        set_name: vector<u8>,
        /// Card number within set (e.g., "4")
        card_number: vector<u8>,
        /// Grading service (e.g., "PSA", "CGC", "BGS")
        grader: vector<u8>,
        /// Numeric grade (stored as basis points: 1000 = 10.0, 950 = 9.5)
        grade_bps: u64,
        /// Number of oracle platforms that price this card
        platform_count: u64,
        /// Whether markets can be created for this asset class
        active: bool,
    }

    /// Shared registry — maps asset_id → AssetClass.
    public struct AssetRegistry has key {
        id: UID,
        /// asset_id → AssetClass
        assets: Table<vector<u8>, AssetClass>,
        /// Total registered asset classes
        total_assets: u64,
    }

    // ── Events ───────────────────────────────────────────────────────────────

    public struct AssetRegistered has copy, drop {
        asset_id: vector<u8>,
        set_name: vector<u8>,
        card_number: vector<u8>,
        grader: vector<u8>,
        grade_bps: u64,
    }

    public struct AssetDeactivated has copy, drop {
        asset_id: vector<u8>,
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        // Transfer admin cap to deployer
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Create and share the registry
        let registry = AssetRegistry {
            id: object::new(ctx),
            assets: table::new(ctx),
            total_assets: 0,
        };
        transfer::share_object(registry);
    }

    // ── Entry functions ──────────────────────────────────────────────────────

    /// Register a new asset class. Requires AdminCap.
    public entry fun register_asset(
        _: &AdminCap,
        registry: &mut AssetRegistry,
        asset_id: vector<u8>,
        set_name: vector<u8>,
        card_number: vector<u8>,
        grader: vector<u8>,
        grade_bps: u64,
        platform_count: u64,
    ) {
        assert!(!table::contains(&registry.assets, asset_id), EAssetAlreadyRegistered);
        assert!(grade_bps > 0 && grade_bps <= 1000, EInvalidGrade);

        let asset = AssetClass {
            asset_id,
            set_name,
            card_number,
            grader,
            grade_bps,
            platform_count,
            active: true,
        };

        event::emit(AssetRegistered {
            asset_id,
            set_name,
            card_number,
            grader,
            grade_bps,
        });

        table::add(&mut registry.assets, asset_id, asset);
        registry.total_assets = registry.total_assets + 1;
    }

    /// Deactivate an asset class (prevents new market creation).
    public entry fun deactivate_asset(
        _: &AdminCap,
        registry: &mut AssetRegistry,
        asset_id: vector<u8>,
    ) {
        assert!(table::contains(&registry.assets, asset_id), EAssetNotFound);
        let asset = table::borrow_mut(&mut registry.assets, asset_id);
        asset.active = false;

        event::emit(AssetDeactivated { asset_id });
    }

    /// Reactivate a previously deactivated asset class.
    public entry fun reactivate_asset(
        _: &AdminCap,
        registry: &mut AssetRegistry,
        asset_id: vector<u8>,
    ) {
        assert!(table::contains(&registry.assets, asset_id), EAssetNotFound);
        let asset = table::borrow_mut(&mut registry.assets, asset_id);
        asset.active = true;
    }

    /// Update platform count for an asset (e.g., when new scrapers come online).
    public entry fun update_platform_count(
        _: &AdminCap,
        registry: &mut AssetRegistry,
        asset_id: vector<u8>,
        platform_count: u64,
    ) {
        assert!(table::contains(&registry.assets, asset_id), EAssetNotFound);
        let asset = table::borrow_mut(&mut registry.assets, asset_id);
        asset.platform_count = platform_count;
    }

    // ── Read accessors ───────────────────────────────────────────────────────

    /// Check if an asset class exists and is active.
    public fun is_active(registry: &AssetRegistry, asset_id: vector<u8>): bool {
        if (!table::contains(&registry.assets, asset_id)) {
            return false
        };
        let asset = table::borrow(&registry.assets, asset_id);
        asset.active
    }

    /// Get asset class details. Aborts if not found.
    public fun get_asset(registry: &AssetRegistry, asset_id: vector<u8>): &AssetClass {
        assert!(table::contains(&registry.assets, asset_id), EAssetNotFound);
        table::borrow(&registry.assets, asset_id)
    }

    public fun asset_id(asset: &AssetClass): vector<u8> { asset.asset_id }
    public fun set_name(asset: &AssetClass): vector<u8> { asset.set_name }
    public fun card_number(asset: &AssetClass): vector<u8> { asset.card_number }
    public fun grader(asset: &AssetClass): vector<u8> { asset.grader }
    public fun grade_bps(asset: &AssetClass): u64 { asset.grade_bps }
    public fun platform_count(asset: &AssetClass): u64 { asset.platform_count }
    public fun active(asset: &AssetClass): bool { asset.active }
    public fun total_assets(registry: &AssetRegistry): u64 { registry.total_assets }

    // ── Error codes ──────────────────────────────────────────────────────────

    const EAssetAlreadyRegistered: u64 = 0;
    const EAssetNotFound: u64 = 1;
    const EInvalidGrade: u64 = 2;

    // ── Test helpers ─────────────────────────────────────────────────────────

    #[test_only]
    public fun create_admin_cap_for_testing(ctx: &mut TxContext): AdminCap {
        AdminCap { id: object::new(ctx) }
    }

    #[test_only]
    public fun destroy_admin_cap_for_testing(cap: AdminCap) {
        let AdminCap { id } = cap;
        object::delete(id);
    }

    #[test_only]
    public fun create_registry_for_testing(ctx: &mut TxContext): AssetRegistry {
        AssetRegistry {
            id: object::new(ctx),
            assets: table::new(ctx),
            total_assets: 0,
        }
    }

    #[test_only]
    public fun destroy_registry_for_testing(registry: AssetRegistry) {
        let AssetRegistry { id, assets, total_assets: _ } = registry;
        table::drop(assets);
        object::delete(id);
    }
}
