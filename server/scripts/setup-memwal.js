import { createAccount, addDelegateKey, generateDelegateKey } from '@mysten-incubation/memwal/account';
import { SuiJsonRpcClient } from '@mysten/sui/jsonRpc';

const MEMWAL_PACKAGE_ID = '0xcf6ad755a1cdff7217865c796778fabe5aa399cb0cf2eba986f4b582047229c6';
const MEMWAL_REGISTRY_ID = '0xe80f2feec1c139616a86c9f71210152e2a7ca552b20841f2e192f99f75864437';
const SUI_PRIVATE_KEY = process.argv[2];

if (!SUI_PRIVATE_KEY) {
  console.error('Usage: node setup-memwal.js <suiprivkey1...>');
  process.exit(1);
}

const suiClient = new SuiJsonRpcClient({ url: 'https://fullnode.testnet.sui.io' });

async function main() {
  console.log('1. Generating delegate key...');
  const delegate = await generateDelegateKey();
  console.log('   Delegate address:', delegate.suiAddress);
  console.log('   Private key (hex):', delegate.privateKey);

  console.log('\n2. Creating MemWal account on testnet...');
  const { accountId, owner, digest } = await createAccount({
    packageId: MEMWAL_PACKAGE_ID,
    registryId: MEMWAL_REGISTRY_ID,
    suiPrivateKey: SUI_PRIVATE_KEY,
    suiNetwork: 'testnet',
    suiClient,
  });
  console.log('   Account ID:', accountId);
  console.log('   Owner:', owner);
  console.log('   Tx digest:', digest);

  console.log('\n3. Adding delegate key to account...');
  const addResult = await addDelegateKey({
    packageId: MEMWAL_PACKAGE_ID,
    accountId,
    publicKey: delegate.publicKey,
    label: 'Anima Swarm Server',
    suiPrivateKey: SUI_PRIVATE_KEY,
    suiNetwork: 'testnet',
    suiClient,
  });
  console.log('   Delegate added, tx:', addResult.digest);

  console.log('\n=== Add these to .env ===');
  console.log(`MEMWAL_ACCOUNT_ID=${accountId}`);
  console.log(`MEMWAL_DELEGATE_KEY=${delegate.privateKey}`);
  console.log(`MEMWAL_PACKAGE_ID=${MEMWAL_PACKAGE_ID}`);
  console.log(`MEMWAL_REGISTRY_ID=${MEMWAL_REGISTRY_ID}`);
  console.log(`MEMWAL_URL=https://relayer.memwal.ai`);
}

main().catch(err => {
  console.error('Setup failed:', err.message || err);
  process.exit(1);
});
