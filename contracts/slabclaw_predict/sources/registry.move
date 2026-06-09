/// registry.move — Asset registry + protocol governance for SlabClaw Predict.
///
/// Two admin-governed shared objects:
///   • `AssetRegistry`  — the single source of truth for which graded cards may have markets.
///   • `ProtocolConfig` — governance-tunable economic parameters (dispute bond, dispute
///     window, oracle source floor). Safety *floors* that must never be loosened
///     (e.g. the dust-sized minimum position) stay as compile-time constants in `market`;
///     only economically meaningful knobs are governed here.
///
/// Both objects carry an on-chain `version`. Every state-mutating entry function asserts
/// `version == VERSION` so that, after a package upgrade, calls against a not-yet-migrated
/// object abort instead of silently corrupting state — the standard Sui upgrade-safety
/// pattern. `migrate_*` bumps a stale object to the current version under `AdminCap`.
#[allow(lint(public_entry))]
module slabclaw_predict::registry {
    use sui::table::{Self, Table};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};
    use sui::object::{Self, UID};
    use sui::event;

    // ── Versioning ──────────────────────────────────────────────────────────────

    /// Current on-chain state version. Bump on every state-shape-changing upgrade,
    /// then call `migrate_registry` / `migrate_config` on the live shared objects.
    const VERSION: u64 = 1;

    // ── Capability ──────────────────────────────────────────────────────────────

    /// Admin capability — held by the deployer. Required to register assets and to
    /// tune the protocol config.
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
        /// On-chain state version (see module docs).
        version: u64,
        /// asset_id → AssetClass
        assets: Table<vector<u8>, AssetClass>,
        /// Total registered asset classes
        total_assets: u64,
    }

    /// Governance-tunable economic parameters. Shared, admin-mutable.
    public struct ProtocolConfig has key {
        id: UID,
        /// On-chain state version (see module docs).
        version: u64,
        /// Minimum dispute bond, in tUSD MIST (9 decimals).
        min_dispute_bond: u64,
        /// Optimistic-oracle dispute window, in milliseconds.
        dispute_window_ms: u64,
        /// Minimum independent oracle sources required to propose a resolution.
        min_sources: u64,
    }

    // Default governance parameters at genesis.
    /// 10 tUSD (9 decimals).
    const DEFAULT_MIN_DISPUTE_BOND: u64 = 10_000_000_000;
    /// 24 hours.
    const DEFAULT_DISPUTE_WINDOW_MS: u64 = 86_400_000;
    /// Three independent marketplace sources.
    const DEFAULT_MIN_SOURCES: u64 = 3;

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

    public struct ConfigUpdated has copy, drop {
        min_dispute_bond: u64,
        dispute_window_ms: u64,
        min_sources: u64,
    }

    // ── Init ─────────────────────────────────────────────────────────────────

    fun init(ctx: &mut TxContext) {
        // Transfer admin cap to deployer
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::transfer(admin_cap, tx_context::sender(ctx));

        // Create and share the registry
        let registry = AssetRegistry {
            id: object::new(ctx),
            version: VERSION,
            assets: table::new(ctx),
            total_assets: 0,
        };
        transfer::share_object(registry);

        // Create and share the governance config with genesis defaults
        let config = ProtocolConfig {
            id: object::new(ctx),
            version: VERSION,
            min_dispute_bond: DEFAULT_MIN_DISPUTE_BOND,
            dispute_window_ms: DEFAULT_DISPUTE_WINDOW_MS,
            min_sources: DEFAULT_MIN_SOURCES,
        };
        transfer::share_object(config);
    }

    // ── Asset entry functions ──────────────────────────────────────────────────

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
        assert!(registry.version == VERSION, EWrongVersion);
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
        assert!(registry.version == VERSION, EWrongVersion);
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
        assert!(registry.version == VERSION, EWrongVersion);
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
        assert!(registry.version == VERSION, EWrongVersion);
        assert!(table::contains(&registry.assets, asset_id), EAssetNotFound);
        let asset = table::borrow_mut(&mut registry.assets, asset_id);
        asset.platform_count = platform_count;
    }

    // ── Governance entry functions ──────────────────────────────────────────────

    /// Set the minimum dispute bond (tUSD MIST). Requires AdminCap.
    public entry fun set_min_dispute_bond(
        _: &AdminCap,
        config: &mut ProtocolConfig,
        value: u64,
    ) {
        assert!(config.version == VERSION, EWrongVersion);
        assert!(value > 0, EInvalidConfig);
        config.min_dispute_bond = value;
        emit_config(config);
    }

    /// Set the optimistic-oracle dispute window (ms). Requires AdminCap.
    public entry fun set_dispute_window_ms(
        _: &AdminCap,
        config: &mut ProtocolConfig,
        value: u64,
    ) {
        assert!(config.version == VERSION, EWrongVersion);
        assert!(value > 0, EInvalidConfig);
        config.dispute_window_ms = value;
        emit_config(config);
    }

    /// Set the minimum independent oracle source floor. Requires AdminCap.
    public entry fun set_min_sources(
        _: &AdminCap,
        config: &mut ProtocolConfig,
        value: u64,
    ) {
        assert!(config.version == VERSION, EWrongVersion);
        assert!(value > 0, EInvalidConfig);
        config.min_sources = value;
        emit_config(config);
    }

    fun emit_config(config: &ProtocolConfig) {
        event::emit(ConfigUpdated {
            min_dispute_bond: config.min_dispute_bond,
            dispute_window_ms: config.dispute_window_ms,
            min_sources: config.min_sources,
        });
    }

    // ── Migration ──────────────────────────────────────────────────────────────

    /// Bump a stale registry to the current version after a package upgrade.
    public entry fun migrate_registry(_: &AdminCap, registry: &mut AssetRegistry) {
        assert!(registry.version < VERSION, ENotStale);
        registry.version = VERSION;
    }

    /// Bump a stale config to the current version after a package upgrade.
    public entry fun migrate_config(_: &AdminCap, config: &mut ProtocolConfig) {
        assert!(config.version < VERSION, ENotStale);
        config.version = VERSION;
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

    /// Governance parameter accessors — read by `market` at proposal time.
    public fun min_dispute_bond(config: &ProtocolConfig): u64 { config.min_dispute_bond }
    public fun dispute_window_ms(config: &ProtocolConfig): u64 { config.dispute_window_ms }
    public fun min_sources(config: &ProtocolConfig): u64 { config.min_sources }

    /// Version accessors.
    public fun version(): u64 { VERSION }
    public fun registry_version(registry: &AssetRegistry): u64 { registry.version }
    public fun config_version(config: &ProtocolConfig): u64 { config.version }

    // ── Error codes ──────────────────────────────────────────────────────────

    const EAssetAlreadyRegistered: u64 = 0;
    const EAssetNotFound: u64 = 1;
    const EInvalidGrade: u64 = 2;
    const EWrongVersion: u64 = 3;
    const EInvalidConfig: u64 = 4;
    const ENotStale: u64 = 5;

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
            version: VERSION,
            assets: table::new(ctx),
            total_assets: 0,
        }
    }

    #[test_only]
    public fun destroy_registry_for_testing(registry: AssetRegistry) {
        let AssetRegistry { id, version: _, assets, total_assets: _ } = registry;
        table::drop(assets);
        object::delete(id);
    }

    #[test_only]
    public fun create_config_for_testing(ctx: &mut TxContext): ProtocolConfig {
        ProtocolConfig {
            id: object::new(ctx),
            version: VERSION,
            min_dispute_bond: DEFAULT_MIN_DISPUTE_BOND,
            dispute_window_ms: DEFAULT_DISPUTE_WINDOW_MS,
            min_sources: DEFAULT_MIN_SOURCES,
        }
    }

    #[test_only]
    public fun destroy_config_for_testing(config: ProtocolConfig) {
        let ProtocolConfig {
            id,
            version: _,
            min_dispute_bond: _,
            dispute_window_ms: _,
            min_sources: _,
        } = config;
        object::delete(id);
    }

    #[test_only]
    /// Force a registry's version backwards to exercise the migrate path.
    public fun set_registry_version_for_testing(registry: &mut AssetRegistry, v: u64) {
        registry.version = v;
    }
}
