import { useState } from 'react';
import { getPlayerColor } from '@lib/terrainTypes.js';

export default function PlayerHud({ player, spirits, gameState }) {
  const [showBoard, setShowBoard] = useState(false);
  if (!player) return null;

  const totalHexes = gameState?.map?.hexes ? Object.keys(gameState.map.hexes).length : 91;
  const hexesControlled = player.hexesControlled || 0;
  const spiritCount = spirits?.length || 0;
  const territoryPct = totalHexes > 0 ? Math.round((hexesControlled / totalHexes) * 100) : 0;

  const totalMemories = spirits?.reduce((sum, s) => sum + (s.memoryCount || 0), 0) || 0;
  const heroCount = spirits?.filter(s => s.tier === 'hero').length || 0;
  const captainCount = spirits?.filter(s => s.tier === 'captain').length || 0;
  const swarmlingCount = spirits?.filter(s => s.tier === 'swarmling').length || 0;

  const divinePower = spiritCount > 0
    ? Math.round(spirits.reduce((sum, s) => {
        const b = s.bond || { depth: 0, harmony: 0, adventure: 0, loyalty: 0 };
        return sum + (b.depth + b.harmony + b.adventure + b.loyalty) / 4;
      }, 0) / spiritCount)
    : 0;

  const allPlayers = gameState?.players ? Object.entries(gameState.players).map(([id, p]) => {
    const pSpirits = Object.values(gameState.spirits || {}).filter(s => s.playerId === id && s.alive);
    const pHexes = p.hexesControlled || 0;
    const pH = pSpirits.filter(s => s.tier === 'hero').length;
    const pC = pSpirits.filter(s => s.tier === 'captain').length;
    const pS = pSpirits.filter(s => s.tier === 'swarmling').length;
    return {
      id, name: p.name, deityTitle: p.deityTitle || '',
      hexes: pHexes, spirits: pSpirits.length, heroes: pH, captains: pC, swarmlings: pS,
      pct: Math.round((pHexes / totalHexes) * 100),
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
          <HudStat label="SPR" value={`${heroCount > 0 ? heroCount + '★ ' : ''}${captainCount}C ${swarmlingCount}S`} color="text-teal-400" title={`${heroCount} Heroes, ${captainCount} Captains, ${swarmlingCount} Swarmlings`} />
          <HudStat label="TER" value={`${territoryPct}%`}
            color={territoryPct >= 50 ? 'text-amber-300' : 'text-gray-400'} title="Territory Percentage" />
          <HudStat label="PWR" value={divinePower}
            color={divinePower >= 70 ? 'text-amber-300' : divinePower >= 40 ? 'text-gray-300' : 'text-gray-500'}
            title="Bond Strength (avg)" />
          <HudStat label="MEM" value={totalMemories}
            color="text-teal-400" title="Total Memories on MemWal" />
        </div>
        <span className={`text-gray-500 text-xs transition-transform duration-200 ${showBoard ? 'rotate-180' : ''}`}>▾</span>
      </div>
      {showBoard && (
        <div className="absolute top-full right-0 mt-1 bg-gray-900/95 border border-gray-700/60 rounded-md p-2 z-50 min-w-[200px] backdrop-blur-sm">
          <div className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>SCOREBOARD</div>
          {allPlayers.map(p => (
            <div key={p.id} className={`flex items-center gap-2 text-xs font-mono py-0.5 ${p.eliminated ? 'opacity-40' : ''}`}>
              <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: getPlayerColor(p.id, gameState) || '#666' }} />
              <span className={`flex-1 truncate ${p.id === player.id ? 'text-amber-400' : 'text-gray-300'}`}>
                {p.name}
                {p.deityTitle && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{p.deityTitle}</span>}
              </span>
              <span className="text-right" style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>
                {p.heroes > 0 && <span style={{ color: '#f0c040' }}>{p.heroes}★</span>}
                {p.captains}C {p.swarmlings}S
              </span>
              <span className="w-6 text-right" style={{ color: 'var(--text-primary)' }}>{p.hexes}h</span>
              <span className={`w-8 text-right ${p.pct >= 50 ? 'text-amber-400' : ''}`} style={p.pct < 50 ? { color: 'var(--text-secondary)' } : undefined}>{p.pct}%</span>
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
      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
      <span className={`${color} tabular-nums`}>{value}</span>
    </div>
  );
}
