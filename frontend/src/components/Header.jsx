import { ConnectButton, useCurrentAccount } from '@mysten/dapp-kit';
import { EXPLORER_URL } from '../constants';

export default function Header() {
  const account = useCurrentAccount();

  return (
    <header className="border-b border-sc-border bg-sc-surface/80 backdrop-blur-sm sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-bold font-display tracking-tight">
            <span className="text-sc-accent">Slab</span>
            <span>Claw</span>
            <span className="text-sc-muted font-normal ml-1.5 text-sm">Predict</span>
          </h1>
          <span className="text-[10px] font-mono bg-sc-accent/15 text-sc-accent px-1.5 py-0.5 rounded">
            TESTNET
          </span>
        </div>

        <div className="flex items-center gap-3">
          {account && (
            <a
              href={`${EXPLORER_URL}/account/${account.address}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-mono text-sc-muted hover:text-sc-accent transition-colors"
            >
              {account.address.slice(0, 6)}...{account.address.slice(-4)}
            </a>
          )}
          <ConnectButton
            className="!bg-sc-accent !text-white !text-xs !px-3 !py-1.5 !rounded-md !font-medium hover:!bg-sc-accent/80 !transition-colors"
          />
        </div>
      </div>
    </header>
  );
}
