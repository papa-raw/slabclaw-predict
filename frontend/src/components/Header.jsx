import { ERAS } from '../constants';
import { useEraTrends } from '../hooks/useEraTrends';
import { EraIcon } from './EraIcons';
import WalletButton from './WalletButton';
import { pct, arrow } from '../lib/format';

function TrendPct({ value }) {
  if (value == null) return <span className="text-sc-muted">—</span>;
  const up = value >= 0;
  return (
    <span className={up ? 'text-sc-yes' : 'text-sc-no'}>
      <span className="text-[0.6em] font-black align-baseline">{arrow(value)}</span>
      {pct(value, { sign: false })}
    </span>
  );
}

export default function Header() {
  const { byEra, headline } = useEraTrends();

  return (
    <header className="sticky top-0 z-50 bg-sc-bg/95 backdrop-blur-sm border-b border-sc-border/60">
      <div className="px-4 lg:px-6 h-[52px] flex items-center gap-4">
        {/* Logo — real SlabClaw crest */}
        <a href="#" className="flex items-center gap-2 shrink-0" aria-label="SlabClaw Predict — markets">
          <img src="/assets/app-icon.png" alt="SlabClaw" className="w-8 h-8 object-contain rounded-[2px]" />
          <span className="font-bold text-[15px] tracking-brand text-white">SLABCLAW</span>
          <span className="text-[10px] font-semibold text-sc-accent tracking-wide">PREDICT</span>
        </a>

        {/* Era-trend KPI strip (centered) */}
        <div className="hidden md:flex items-stretch gap-1 flex-1 justify-center overflow-hidden">
          <div className="flex items-center px-2.5">
            <span className="text-xl font-bold tnum"><TrendPct value={headline} /></span>
            <span className="text-[9px] text-sc-muted uppercase tracking-wide ml-1 font-semibold">90d</span>
          </div>
          {ERAS.map((e) => {
            const Icon = EraIcon[e.key];
            const v = byEra[e.key];
            return (
              <div key={e.key} className="px-2.5 py-1 text-center cursor-default hover:bg-white/[0.03] rounded transition-colors">
                <div className="text-[12px] font-semibold tnum leading-tight"><TrendPct value={v} /></div>
                <div className="text-[8px] text-sc-muted uppercase tracking-wide flex items-center justify-center gap-0.5 mt-0.5">
                  {Icon && <Icon width={9} height={9} />}{e.label}
                </div>
              </div>
            );
          })}
        </div>

        {/* Right: nav + testnet tag + compact connect */}
        <div className="flex items-center gap-3 shrink-0 ml-auto md:ml-0">
          <nav className="hidden sm:flex items-center gap-3 text-[12px] font-medium">
            <a href="#architecture" className="text-sc-dim hover:text-sc-accent transition">Docs</a>
            <a href="#deck" className="text-sc-dim hover:text-sc-accent transition">Deck</a>
            <a
              href="https://github.com/papa-raw/slabclaw-predict"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Source on GitHub"
              title="Source on GitHub"
              className="text-sc-dim hover:text-sc-accent transition"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
              </svg>
            </a>
            <a
              href="https://x.com/papa_raw"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="@papa_raw on X"
              title="@papa_raw on X"
              className="text-sc-dim hover:text-sc-accent transition"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
          </nav>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
