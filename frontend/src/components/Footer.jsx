/// Footer — pinned on every page. Carries the tUSD faucet so judges can fund
/// a wallet and trade without spending real SUI.

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { buildFaucetMint } from '../lib/transactions';
import { FAUCET_DRIP } from '../constants';
import { useTusdBalance } from '../hooks/useTusd';

export default function Footer({ onFunded }) {
  const account = useCurrentAccount();
  const { mutateAsync: signAndExecute } = useSignAndExecuteTransaction();
  const { balance, refetch, hasWallet, isLoading: balLoading } = useTusdBalance();
  const [status, setStatus] = useState(null); // null | 'minting' | 'ok' | 'err'

  async function faucet() {
    if (!account) return;
    setStatus('minting');
    try {
      await signAndExecute({ transaction: buildFaucetMint(FAUCET_DRIP) });
      setStatus('ok');
      setTimeout(() => { refetch(); onFunded?.(); }, 1200);
      setTimeout(() => setStatus(null), 3000);
    } catch {
      setStatus('err');
      setTimeout(() => setStatus(null), 3000);
    }
  }

  return (
    <footer className="fixed bottom-0 inset-x-0 z-[60] border-t border-sc-border bg-sc-bg/95 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-4 lg:px-6 py-2">
        {/* links + faucet */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-sc-muted">
          <a href="#architecture" className="hover:text-sc-accent transition font-semibold text-sc-dim">Architecture &amp; docs ↗</a>
          <span className="hidden sm:inline">·</span>
          <span className="hidden sm:inline">Walrus track</span>
          <span className="hidden sm:inline">·</span>
          <a href="#legal" className="hover:text-sc-accent transition">Legal</a>
          <span className="hidden md:inline">·</span>
          <span className="hidden md:inline">Built by{' '}
            <a href="https://x.com/papa_raw" target="_blank" rel="noopener noreferrer"
              className="text-sc-dim hover:text-sc-accent transition">paparaw.eth</a>
          </span>

          {/* faucet — pushed right */}
          <div className="flex items-center gap-2.5 ml-auto">
            {/* tx fees need testnet SUI, which we can't mint for you — a cold visitor
                with an empty wallet would otherwise hit a silent wall on first trade */}
            <a href="https://faucet.sui.io/?network=testnet" target="_blank" rel="noopener noreferrer"
              className="hidden sm:inline text-[11px] text-sc-dim hover:text-sc-accent transition"
              title="Transactions need a little testnet SUI for gas — free from the official faucet">
              Need gas? Get testnet SUI ↗
            </a>
            {hasWallet && (
              <span className="tnum text-sc-dim">
                Balance <span className="text-sc-text font-semibold">{balLoading ? '—' : balance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span> tUSD
              </span>
            )}
            <button
              onClick={faucet}
              disabled={!account || status === 'minting'}
              title={!account ? 'Connect a wallet first' : `Mint ${FAUCET_DRIP.toLocaleString()} test USD`}
              className="inline-flex items-center gap-1.5 rounded-md bg-sc-accent text-black font-semibold text-[11px] uppercase tracking-wide px-3 py-1.5 hover:bg-sc-accentHover active:scale-[.97] disabled:opacity-40 disabled:hover:bg-sc-accent transition"
            >
              {status === 'minting' ? 'Minting…' : status === 'ok' ? '✓ Funded' : status === 'err' ? 'Failed' : `Faucet · +${(FAUCET_DRIP / 1000)}k tUSD`}
            </button>
          </div>
        </div>

        {/* disclaimer — protective notice; full text at #legal */}
        <p className="text-[11.5px] leading-snug text-sc-muted/70 mt-1.5">
          Testnet demonstration · not financial advice · tUSD has no monetary value · prices from publicly-available
          marketplace data · not affiliated with any marketplace or grader · all names &amp; marks © their owners ·
          © 2026 Ecofrontiers SARL. <a href="#legal" className="underline hover:text-sc-accent">Full disclaimer</a>
        </p>
      </div>
    </footer>
  );
}
