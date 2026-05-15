import 'dotenv/config';
import { MemWal } from '@mysten-incubation/memwal';

const NS = 'test-spirit-e2e';

const client = MemWal.create({
  key: process.env.MEMWAL_DELEGATE_KEY,
  accountId: process.env.MEMWAL_ACCOUNT_ID,
  serverUrl: process.env.MEMWAL_URL,
  namespace: NS,
});

async function main() {
  console.log('--- MemWal E2E Test (with wait) ---\n');

  console.log('1. Storing memory (wait for completion)...');
  const r1 = await client.rememberAndWait('I battled Kaelix near the volcano and won decisively');
  console.log('   blob_id:', r1.blob_id);

  console.log('\n2. Storing second memory...');
  const r2 = await client.rememberAndWait('The deity whispered: guard the northern passage');
  console.log('   blob_id:', r2.blob_id);

  console.log('\n3. Recalling "battle"...');
  const recall1 = await client.recall('battle combat fight', 5);
  console.log('   Results:', JSON.stringify(recall1, null, 2));

  console.log('\n4. Recalling "deity whisper"...');
  const recall2 = await client.recall('deity whisper command', 5);
  console.log('   Results:', JSON.stringify(recall2, null, 2));

  console.log('\n--- Done ---');
}

main().catch(err => {
  console.error('Test failed:', err.message || err);
  process.exit(1);
});
