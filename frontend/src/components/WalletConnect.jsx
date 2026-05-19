import { useState } from 'react';
import { useConnectWallet, useCurrentAccount, useDisconnectWallet, useWallets } from '@mysten/dapp-kit';
import { useDevWallet } from '../lib/devWallet.jsx';

function truncateAddress(address) {
  if (!address) return '';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export default function WalletConnect() {
  const account = useCurrentAccount();
  const wallets = useWallets();
  const { mutate: connect, isPending: isConnecting } = useConnectWallet();
  const { mutate: disconnect } = useDisconnectWallet();
  const devWallet = useDevWallet();
  const [showDevInput, setShowDevInput] = useState(false);
  const [devAddr, setDevAddr] = useState('');

  const connectedAddress = account?.address || devWallet.address;

  if (connectedAddress) {
    return (
      <button
        onClick={() => { if (account) disconnect(); else devWallet.disconnect(); }}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-amber-500/30 bg-gray-900/80 backdrop-blur-sm hover:border-red-500/30 transition-colors group"
      >
        <span className="font-mono text-xs text-amber-400 tracking-wide group-hover:text-red-400 transition-colors">
          {truncateAddress(connectedAddress)}
        </span>
        <svg className="w-3 h-3 text-gray-500 group-hover:text-red-400 transition-colors" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M6 1H3a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3M11 12l4-4-4-4M15 8H6" />
        </svg>
      </button>
    );
  }

  if (showDevInput) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={devAddr}
          onChange={e => setDevAddr(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && devAddr.startsWith('0x')) { devWallet.connect(devAddr); setShowDevInput(false); } }}
          placeholder="0x..."
          className="w-36 px-2 py-1.5 rounded-md font-mono text-xs focus:outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)', color: 'var(--text-primary)' }}
          autoFocus
        />
        <button
          onClick={() => { if (devAddr.startsWith('0x')) { devWallet.connect(devAddr); setShowDevInput(false); } }}
          disabled={!devAddr.startsWith('0x')}
          className="px-3 py-1.5 rounded-md font-header text-xs uppercase tracking-wider font-semibold transition-colors disabled:opacity-40"
          style={{ background: 'var(--gold-bright)', color: 'var(--bg-abyss)' }}
        >
          Go
        </button>
        <button
          onClick={() => setShowDevInput(false)}
          className="text-xs transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {wallets.length > 0 ? (
        <button
          onClick={() => connect({ wallet: wallets[0] })}
          disabled={isConnecting}
          className="px-4 py-1.5 rounded-md font-header text-xs uppercase tracking-wider font-semibold bg-amber-500 text-gray-900 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {isConnecting ? 'Connecting...' : 'Connect Wallet'}
        </button>
      ) : (
        <button
          onClick={() => setShowDevInput(true)}
          className="px-4 py-1.5 rounded-md font-header text-xs uppercase tracking-wider font-semibold transition-colors"
          style={{ background: 'var(--gold-bright)', color: 'var(--bg-abyss)' }}
        >
          Dev Connect
        </button>
      )}
    </div>
  );
}
