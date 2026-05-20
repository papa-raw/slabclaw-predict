import { useState, useEffect } from 'react';
import { SPEC_COLORS, SPEC_ICONS, getPlayerColor } from '@lib/terrainTypes.js';
import { getAvatarUrl } from '@lib/avatarUrl.js';
import LineageSection from './LineageSection.jsx';

/**
 * SpiritPanel — Spirit detail sidebar with chat interface.
 *
 * Props:
 *   spirit     - spirit object from gameState.spirits
 *   gameState  - full (sanitized) game state
 *   playerId   - current player's ID
 *   onClose    - called when the panel's close button is clicked
 *   messages   - persisted message history for this spirit (lifted to App.jsx)
 *   onMessages - setter to update message history
 */
export default function SpiritPanel({ spirit, gameState, playerId, onClose }) {
  const isMine = spirit?.playerId === playerId;
  const [memories, setMemories] = useState([]);
  const [loadingMem, setLoadingMem] = useState(false);
  const [showMemories, setShowMemories] = useState(false);

  useEffect(() => {
    setMemories([]);
    setShowMemories(false);
  }, [spirit?.id]);

  useEffect(() => {
    if (!showMemories || !spirit?.id) return;
    setLoadingMem(true);
    fetch(`/api/game/spirit/${spirit.id}/memories`)
      .then(r => r.json())
      .then(d => setMemories(d.memories || []))
      .catch(() => setMemories([]))
      .finally(() => setLoadingMem(false));
  }, [showMemories, spirit?.id]);

  if (!spirit) return null;

  const bondAvg = Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );

  const spiritColor = SPEC_COLORS[spirit.specialization] || getPlayerColor(spirit.playerId, gameState) || '#6b7280';

  // Bond tier label
  function getBondTierName(avg) {
    if (avg >= 80) return 'Devoted';
    if (avg >= 60) return 'Trusted';
    if (avg >= 40) return 'Familiar';
    if (avg >= 20) return 'Cautious';
    return 'Stranger';
  }

  const bondDimensions = [
    { label: 'Depth',     abbr: 'DEP', value: spirit.bond.depth,     color: '#8b5cf6', tip: 'Emotional connection — grows from meaningful conversations' },
    { label: 'Harmony',   abbr: 'HAR', value: spirit.bond.harmony,   color: '#22c55e', tip: 'Alignment with deity — grows when orders match personality' },
    { label: 'Adventure', abbr: 'ADV', value: spirit.bond.adventure, color: '#f97316', tip: 'Boldness — grows from exploration and risky decisions' },
    { label: 'Loyalty',   abbr: 'LOY', value: spirit.bond.loyalty,   color: '#3b82f6', tip: 'Resistance to enemy whispers — eroded by foreign deities' },
  ];

  const xpBars = [
    { label: 'COM', value: spirit.combatXP,      color: '#dc2626', tip: 'Combat XP — earned by fighting and winning battles' },
    { label: 'EXP', value: spirit.explorationXP, color: '#2563eb', tip: 'Exploration XP — earned by discovering new hexes' },
    { label: 'SOC', value: spirit.socialXP,      color: '#16a34a', tip: 'Social XP — earned by gathering memories from hexes' },
    { label: 'WIS', value: spirit.wisdomXP,      color: '#9333ea', tip: 'Wisdom XP — earned from whispers and deep conversations' },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Spirit Header */}
      <div className="p-4 border-b border-gray-700/50 flex-shrink-0">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            {/* Spirit Avatar */}
            {spirit.avatarBlobId ? (
              <img
                src={getAvatarUrl(spirit.avatarBlobId)}
                alt={spirit.name}
                className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2"
                style={{ borderColor: spiritColor }}
              />
            ) : (
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                style={{ background: spiritColor }}
              >
                {spirit.name[0]}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 leading-tight">
                <h2 className="font-display text-base font-semibold text-white">
                  {spirit.name}
                </h2>
                {spirit.reincarnationCount > 0 && (
                  <span className="text-xs font-mono px-1.5 py-0.5 rounded-full bg-purple-900/60 text-purple-300 border border-purple-700/40 flex-shrink-0">
                    ✦ {spirit.reincarnationCount}x
                  </span>
                )}
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span style={{ color: SPEC_COLORS[spirit.specialization] || '#6b7280' }}>{SPEC_ICONS[spirit.specialization] || '◉'}</span> {spirit.specialization} · gen {spirit.generation} · {getBondTierName(bondAvg)} ({bondAvg})
              </p>
              {spirit.memwalAccountId ? (
                <a
                  href={`https://suiscan.xyz/testnet/object/${spirit.memwalAccountId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-teal-400/60 font-mono flex items-center gap-1 mt-0.5 hover:text-teal-300 transition-colors cursor-pointer"
                >
                  <span className="w-1 h-1 rounded-full bg-teal-400/60" />
                  {spirit.memoryCount || 0} memories on MemWal
                  {spirit.memwalNamespace && (
                    <span className="text-gray-400">· {spirit.memwalNamespace}</span>
                  )}
                  <span className="text-teal-500/40 ml-0.5">↗</span>
                </a>
              ) : (
                <p className="text-xs text-teal-400/60 font-mono flex items-center gap-1 mt-0.5">
                  <span className="w-1 h-1 rounded-full bg-teal-400/60" />
                  {spirit.memoryCount || 0} memories on MemWal
                  {spirit.memwalNamespace && (
                    <span className="text-gray-400">· {spirit.memwalNamespace}</span>
                  )}
                </p>
              )}
              {spirit.previousNames?.length > 0 && (() => {
                const pastNames = spirit.previousNames.filter(n => n !== spirit.name);
                return pastNames.length > 0 ? (
                  <p className="text-xs text-purple-400/70 italic mt-0.5">
                    was {pastNames.slice(0, 2).join(', ')}
                  </p>
                ) : null;
              })()}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-300 text-xl leading-none w-7 h-7 flex items-center justify-center rounded hover:bg-gray-700/50 transition-colors"
            aria-label="Close spirit panel"
          >
            &times;
          </button>
        </div>

        {/* XP Bars */}
        <div className="grid grid-cols-4 gap-1 mb-3">
          {xpBars.map(xp => (
            <div key={xp.label} className="text-center cursor-help" title={xp.tip}>
              <div className="text-xs text-gray-500 mb-0.5">{xp.label}</div>
              <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (xp.value / 30) * 100)}%`,
                    background: xp.color,
                  }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{xp.value}</div>
            </div>
          ))}
        </div>

        {/* Bond Dimensions */}
        <div className="grid grid-cols-4 gap-1 mb-2">
          {bondDimensions.map(dim => (
            <div key={dim.label} className="text-center cursor-help" title={dim.tip}>
              <div className="text-xs text-gray-500 mb-0.5">{dim.abbr}</div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{ width: `${dim.value}%`, background: dim.color }}
                />
              </div>
              <div className="text-xs text-gray-400 mt-0.5">{dim.value}</div>
            </div>
          ))}
        </div>

        {/* Lineage / Past Lives */}
        <LineageSection spirit={spirit} />

        {/* Current Action */}
        {spirit.currentAction && (
          <div className="px-2 py-1 bg-amber-500/10 border border-amber-500/20 rounded text-xs text-amber-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            {spirit.currentAction.type}
            {spirit.currentAction.completesAt && (
              <span className="ml-auto font-mono">
                {Math.max(0, Math.round((spirit.currentAction.completesAt - Date.now()) / 1000))}s
              </span>
            )}
          </div>
        )}
      </div>

      {/* Spirit status — replaces per-spirit chat */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
        {spirit.personality && (
          <div className="text-sm italic leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {spirit.personality.slice(0, 200)}
          </div>
        )}

        {/* Stats grid */}
        <div className="grid grid-cols-2 gap-2 text-xs font-mono">
          <div className="flex justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
            <span style={{ color: 'var(--text-muted)' }}>HP</span>
            <span style={{ color: (spirit.hp ?? 100) > 60 ? '#4ade80' : (spirit.hp ?? 100) > 30 ? '#fbbf24' : '#ef4444' }}>
              {spirit.hp ?? 100}/{spirit.maxHp || 100}
            </span>
          </div>
          <div className="flex justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Kills</span>
            <span style={{ color: 'var(--text-primary)' }}>{spirit.kills || 0}</span>
          </div>
          <div className="flex justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Memories</span>
            <span style={{ color: '#2dd4bf' }}>{spirit.memoryCount || 0}</span>
          </div>
          <div className="flex justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
            <span style={{ color: 'var(--text-muted)' }}>Hexes</span>
            <span style={{ color: 'var(--text-primary)' }}>{spirit.hexesClaimed || 0}</span>
          </div>
          {!isMine && (
            <div className="flex justify-between px-2 py-1 rounded col-span-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span style={{ color: '#ef4444' }}>Resistance</span>
              <span style={{ color: '#ef4444' }}>{Math.round(spirit.enemyResistance ?? 50)}/100</span>
            </div>
          )}
        </div>

        {/* Memories */}
        <div className="pt-2 border-t border-gray-800/50">
          <button
            onClick={() => setShowMemories(v => !v)}
            className="w-full flex items-center justify-between text-xs font-mono py-1 hover:text-teal-300 transition-colors"
            style={{ color: '#2dd4bf' }}
          >
            <span>{spirit.memoryCount || 0} memories on MemWal</span>
            <span>{showMemories ? '▾' : '▸'}</span>
          </button>
          {showMemories && (
            <div className="mt-1 space-y-1 max-h-40 overflow-y-auto">
              {loadingMem ? (
                <p className="text-xs text-gray-500 italic animate-pulse">Recalling memories...</p>
              ) : memories.length === 0 ? (
                <p className="text-xs text-gray-500 italic">No memories found</p>
              ) : (
                memories.map((m, i) => (
                  <div key={i} className="text-xs px-2 py-1 rounded leading-tight" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                    {m.text?.length > 120 ? m.text.slice(0, 117) + '...' : m.text}
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        <div className="pt-2">
          <p className="text-xs italic text-center" style={{ color: 'var(--text-muted)' }}>
            {isMine
              ? 'Use the Whisper Bar below to decree to your swarm'
              : 'Use the Enemy Whisper to influence this swarm'
            }
          </p>
        </div>
      </div>
    </div>
  );
}
