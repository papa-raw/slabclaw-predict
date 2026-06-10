#[test_only]
module slabclaw_predict::memory_tests {
    use sui::test_scenario::{Self as ts};
    use sui::clock;
    use slabclaw_predict::memory::{Self};
    use slabclaw_predict::oracle::{Self};

    const OPERATOR: address = @0x0A;

    #[test]
    fun test_checkpoint_advances_pointer() {
        let mut scenario = ts::begin(OPERATOR);
        {
            let ctx = ts::ctx(&mut scenario);
            let cap = oracle::create_oracle_cap_for_testing(ctx);
            let mut mem = memory::create_for_testing(ctx);
            let mut clk = clock::create_for_testing(ctx);
            clock::set_for_testing(&mut clk, 1_700_000_000_000);

            assert!(memory::round(&mem) == 0, 0);
            assert!(std::vector::length(&memory::latest_blob_id(&mem)) == 0, 1);

            memory::checkpoint(&cap, &mut mem, b"hk5HrxTh_blob_one", 135, &clk);
            assert!(memory::round(&mem) == 1, 2);
            assert!(memory::latest_blob_id(&mem) == b"hk5HrxTh_blob_one", 3);
            assert!(memory::file_count(&mem) == 135, 4);
            assert!(memory::checkpointed_at_ms(&mem) == 1_700_000_000_000, 5);

            // A later checkpoint replaces the pointer and increments the round.
            clock::set_for_testing(&mut clk, 1_700_000_600_000);
            memory::checkpoint(&cap, &mut mem, b"Q2dlXakO_blob_two", 140, &clk);
            assert!(memory::round(&mem) == 2, 6);
            assert!(memory::latest_blob_id(&mem) == b"Q2dlXakO_blob_two", 7);
            assert!(memory::checkpointed_at_ms(&mem) == 1_700_000_600_000, 8);

            clock::destroy_for_testing(clk);
            memory::destroy_for_testing(mem);
            oracle::destroy_oracle_cap_for_testing(cap);
        };
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = memory::EMissingBlob)]
    fun test_checkpoint_rejects_empty_blob() {
        let mut scenario = ts::begin(OPERATOR);
        {
            let ctx = ts::ctx(&mut scenario);
            let cap = oracle::create_oracle_cap_for_testing(ctx);
            let mut mem = memory::create_for_testing(ctx);
            let clk = clock::create_for_testing(ctx);

            // The memory anchor must never point at nothing.
            memory::checkpoint(&cap, &mut mem, b"", 0, &clk);

            clock::destroy_for_testing(clk);
            memory::destroy_for_testing(mem);
            oracle::destroy_oracle_cap_for_testing(cap);
        };
        ts::end(scenario);
    }
}
