import { useState } from 'react';
import { getPlayerColor } from '@lib/terrainTypes.js';

const TOTAL_HEXES = 91;

export default function PlayerHud({ player, spirits, gameState }) {
  const [showBoard, setShowBoard] = useState(false);
  if (!player) return null;

  const hexesControlled = player.hexesControlled || 0;
  const spiritCount = spirits?.length || 0;
  const territoryPct = TOTAL_HEXES > 0 ? Math.round((hexesControlled / TOTAL_HEXES) * 100) : 0;

  const totalMemories = spirits?.reduce((sum, s) => sum + (s.memoryCount || 0), 0) || 0;

  const divinePower = spiritCount > 0
    ? Math.round(spirits.reduce((sum, s) => {
        const b = s.bond || { depth: 0, harmony: 0, adventure: 0, loyalty: 0 };
        return sum + (b.depth + b.harmony + b.adventure + b.loyalty) / 4;
      }, 0) / spiritCount)
    : 0;

  const allPlayers = gameState?.players ? Object.entries(gameState.players).map(([id, p]) => {
    const pSpirits = Object.values(gameState.spirits || {}).filter(s => s.playerId === id && s.alive);
    const pHexes = p.hexesControlled || 0;
    return {
      id, name: p.name, deityTitle: p.deityTitle || '',
      hexes: pHexes, spirits: pSpirits.length,
      pct: Math.round((pHexes / TOTAL_HEXES) * 100),
      eliminated: pSpirits.length === 0,
    };
  }).sort((a, b) => b.hexes - a.hexes) : [];

  return (
    <div className="relative">
      <div
        className="flex items-center gap-3 px-3 py-1 rounded-md border border-gray-700/40 bg-gray-900/60 backdrop-blur-sm cursor-pointer"
        onClick={() => setShowBoard(v => !v)}
      >
        <span className="font-header text-xs text-amber-400 uppercase tracking-wider">
          {player.name || 'Unknown Deity'}
        </span>
        <div className="w-px h-4 bg-gray-700/50" />
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <HudStat label="HEX" value={hexesControlled} color="text-amber-400" title="Hexes Controlled" />
          <HudStat label="SPR" value={spiritCount} color="text-teal-400" title="Spirits Alive" />
          <HudStat label="TER" value={`${territoryPct}%`}
            color={territoryPct >= 50 ? 'text-amber-300' : 'text-gray-400'} title="Territory Percentage" />
          <HudStat label="PWR" value={divinePower}
            color={divinePower >= 70 ? 'text-amber-300' : divinePower >= 40 ? 'text-gray-300' : 'text-gray-500'}
            title="Bond Strength (avg)" />
          <HudStat label="MEM" value={totalMemories}
            color="text-teal-400" title="Total Memories on MemWal" />
        </div>
        <span className={`text-gray-500 text-[10px] transition-transform duration-200 ${showBoard ? 'rotate-180' : ''}`}>▾</span>
      </div>
      {showBoard && (
        <div className="absolute top-full right-0 mt-1 bg-gray-900/95 border border-gray-700/60 rounded-md p-2 z-50 min-w-[200px] backdrop-blur-sm">
          <div className="text-[9px] text-gray-500 font-mono mb-1">SCOREBOARD</div>
          {allPlayers.map(p => (
            <div key={p.id} className={`flex items-center gap-2 text-[11px] font-mono py-0.5 ${p.eliminated ? 'opacity-40' : ''}`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getPlayerColor(p.id, gameState) || '#666' }} />
              <span className={`flex-1 truncate ${p.id === player.id ? 'text-amber-400' : 'text-gray-300'}`}>
                {p.name}
                {p.deityTitle && <span className="text-gray-600 ml-1">{p.deityTitle}</span>}
              </span>
              <span className="text-gray-500 w-5 text-right">{p.spirits}s</span>
              <span className="text-gray-300 w-6 text-right">{p.hexes}h</span>
              <span className={`w-8 text-right ${p.pct >= 50 ? 'text-amber-400' : 'text-gray-500'}`}>{p.pct}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HudStat({ label, value, color, title }) {
  return (
    <div className="flex items-center gap-1" title={title}>
      <span className="text-gray-500 text-[10px]">{label}</span>
      <span className={`${color} tabular-nums`}>{value}</span>
    </div>
  );
}
