/// WalletButton — custom amber connect pill + styled dark account dropdown.
/// Replaces dapp-kit's default (white, unstyled) dropdown so it matches the
/// SlabClaw theme and adds a copy-address pill.

import { useEffect, useRef, useState } from 'react';
import { ConnectModal, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { shortAddr } from '../lib/format';

const PILL = 'inline-flex items-center gap-1.5 rounded-[5px] bg-sc-accent text-black font-bold text-[12px] leading-none px-3 py-[7px] hover:bg-sc-accentHover active:scale-[.97] transition';

// Network badge folded INTO the amber pill (replaces the separate TESTNET tag).
function TestnetTag() {
  return (
    <>
      <span className="text-[8px] font-bold uppercase tracking-wider text-black/55">Testnet</span>
      <span className="w-px h-3 bg-black/25" aria-hidden />
    </>
  );
}

function CopyIcon({ done }) {
  if (done) {
    return (
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
  );
}

export default function WalletButton() {
  const account = useCurrentAccount();
  const { mutate: disconnect } = useDisconnectWallet();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  if (!account) {
    return (
      <ConnectModal trigger={<button className={PILL}><TestnetTag />Connect</button>} />
    );
  }

  const copy = async () => {
    try { await navigator.clipboard.writeText(account.address); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((o) => !o)} className={PILL} aria-haspopup="menu" aria-expanded={open} aria-label="Wallet account menu">
        <TestnetTag />
        <span className="font-mono">{shortAddr(account.address)}</span>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform ${open ? 'rotate-180' : ''}`}><polyline points="6 9 12 15 18 9" /></svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-1.5 w-56 rounded-lg border border-sc-border bg-sc-surface overflow-hidden z-[70]">
          <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-sc-border">
            <span className="font-mono text-[12px] text-sc-text truncate">{shortAddr(account.address)}</span>
            <button
              onClick={copy}
              title={copied ? 'Copied' : 'Copy address'}
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-semibold transition ${copied ? 'border-sc-yes/40 bg-sc-yes/10 text-sc-yes' : 'border-sc-border bg-sc-surface text-sc-dim hover:text-white hover:border-sc-accent/50'}`}
            >
              <CopyIcon done={copied} />{copied ? 'Copied' : 'Copy'}
            </button>
          </div>
          <a
            href="#portfolio"
            onClick={() => setOpen(false)}
            className="block px-3 py-2.5 text-[12px] text-sc-dim hover:bg-white/[0.04] hover:text-white transition border-b border-sc-border"
          >
            My positions
          </a>
          <button
            onClick={() => { disconnect(); setOpen(false); }}
            className="w-full text-left px-3 py-2.5 text-[12px] text-sc-dim hover:bg-white/[0.04] hover:text-sc-no transition"
          >
            Disconnect
          </button>
        </div>
      )}
    </div>
  );
}
