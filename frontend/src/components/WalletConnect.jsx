import { useConnectWallet, useCurrentAccount, useDisconnectWallet, useWallets } from '@mysten/dapp-kit';

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnect() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect, isPending: isConnecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();

  if (account) {
    return (
      <div className="flex items-center gap-2">
        <div className="px-3 py-1.5 rounded-md border border-amber-500/30 bg-gray-900/80 backdrop-blur-sm">
          <span className="font-mono text-xs text-amber-400 tracking-wide">
            {truncateAddress(account.address)}
          </span>
        </div>
        <button
          onClick={() => disconnect()}
          className="px-2.5 py-1.5 rounded-md text-xs font-header uppercase tracking-wider text-gray-400 hover:text-red-400 border border-gray-700/50 hover:border-red-500/30 bg-gray-900/60 backdrop-blur-sm transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { if (wallets.length > 0) connect({ wallet: wallets[0] }); }}
      disabled={isConnecting || wallets.length === 0}
      className="px-4 py-1.5 rounded-md font-header text-xs uppercase tracking-wider font-semibold bg-amber-500 text-gray-900 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
    >
      {isConnecting ? 'Connecting...' : wallets.length === 0 ? 'No Wallet' : 'Connect Wallet'}
    </button>
  );
}
