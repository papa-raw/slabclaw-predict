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
        <div className="flex items-center gap-2 shrink-0">
          <img src="/assets/app-icon.png" alt="SlabClaw" className="w-8 h-8 object-contain rounded-[2px]" />
          <span className="font-bold text-[15px] tracking-brand text-white">SLABCLAW</span>
          <span className="text-[10px] font-semibold text-sc-amber tracking-wide">PREDICT</span>
        </div>

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

        {/* Right: testnet tag + compact connect */}
        <div className="flex items-center gap-2 shrink-0 ml-auto md:ml-0">
          <span className="hidden sm:block text-[9px] font-mono text-sc-muted border border-sc-border rounded px-1 py-px">TESTNET</span>
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
