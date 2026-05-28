import { useState, useEffect } from 'react';
import { SPEC_COLORS, SPEC_ICONS, getPlayerColor } from '@lib/terrainTypes.js';
import { AFFINITIES, CAPTAIN_CLASSES } from '@lib/classSystem.js';
import { getAvatarUrl } from '@lib/avatarUrl.js';
import LineageSection from './LineageSection.jsx';

/** SpiritPanel — Spirit detail sidebar with memory ledger and behavior rules. */
export default function SpiritPanel({ spirit, gameState, playerId, onClose }) {
  const isMine = spirit?.playerId === playerId;
  const isGhost = spirit?._isGhost || spirit?.playerId === 'ghost';
  const [memories, setMemories] = useState([]);
  const [loadingMem, setLoadingMem] = useState(false);
  const [showMemories, setShowMemories] = useState(spirit?.tier === 'captain');
  const [recruitMsg, setRecruitMsg] = useState('');
  const [recruitResult, setRecruitResult] = useState(null);
  const [recruiting, setRecruiting] = useState(false);

  useEffect(() => {
    setMemories([]);
    setShowMemories(spirit?.tier === 'captain');
    setRecruitResult(null);
    setRecruitMsg('');
  }, [spirit?.id]);

  async function handleRecruit() {
    if (!recruitMsg.trim() || recruiting) return;
    setRecruiting(true);
    try {
      const res = await fetch('/api/game/ghost/recruit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ghostSpiritId: spirit.id, playerId, message: recruitMsg.trim() }),
      });
      const data = await res.json();
      setRecruitResult(data);
    } catch {
      setRecruitResult({ success: false, dialogue: 'Connection lost...' });
    } finally {
      setRecruiting(false);
    }
  }

  useEffect(() => {
    if (!showMemories || !spirit?.id) return;
    setLoadingMem(true);
    fetch(`/api/game/spirit/${spirit.id}/memories`)
      .then(r => r.json())
      .then(d => setMemories(d.memoryLedger || []))
      .catch(() => setMemories([]))
      .finally(() => setLoadingMem(false));
  }, [showMemories, spirit?.id]);

  if (!spirit) return null;

  const bondAvg = Math.round(
    (spirit.bond.depth + spirit.bond.harmony + spirit.bond.adventure + spirit.bond.loyalty) / 4
  );

  const affData = AFFINITIES[spirit.affinity];
  const classData = spirit.captainClass ? CAPTAIN_CLASSES[spirit.captainClass] : null;
  const spiritColor = affData?.color || SPEC_COLORS[spirit.specialization] || getPlayerColor(spirit.playerId, gameState) || '#6b7280';
  const tierLabel = spirit.tier === 'captain' ? 'CAPTAIN' : 'SWARMLING';
  const tierColor = spirit.tier === 'captain' ? '#60a5fa' : '#9ca3af';
  const memoryLedger = spirit.memoryLedger || [];
  const behaviorRules = spirit.behaviorRules || null;

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
              <div className="flex items-center gap-1.5 flex-wrap text-xs" style={{ color: 'var(--text-secondary)' }}>
                {isGhost && <span style={{ color: '#a855f7' }}>☽ Ghost</span>}
                {!isGhost && (
                  <span className="font-mono font-bold px-1 py-0.5 rounded text-[9px] leading-none"
                    style={{ background: `${tierColor}20`, color: tierColor, border: `1px solid ${tierColor}40` }}>
                    {tierLabel}
                  </span>
                )}
                {affData && (
                  <span style={{ color: affData.color }}>{affData.icon} {spirit.affinity}</span>
                )}
                {classData && (
                  <span style={{ color: '#93c5fd' }}>{classData.icon} {classData.label}</span>
                )}
                {!isGhost && <span style={{ color: 'var(--text-muted)' }}>· {getBondTierName(bondAvg)} ({bondAvg})</span>}
              </div>
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

        {/* Behavior Rules (from memory engine) */}
        {behaviorRules && spirit.tier === 'captain' && (
          <div className="space-y-1 mb-1">
            {Object.keys(behaviorRules.grudges || {}).length > 0 && (
              <div className="px-2 py-1 rounded text-xs flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span style={{ color: '#ef4444' }}>⚔</span>
                <span style={{ color: '#fca5a5' }}>
                  GRUDGE: {Object.entries(behaviorRules.grudges).map(([team, count]) => {
                    const player = gameState?.players?.[team];
                    return `${player?.name || team} (${count}x)`;
                  }).join(', ')}
                </span>
              </div>
            )}
            {Object.keys(behaviorRules.confidence || {}).length > 0 && (
              <div className="px-2 py-1 rounded text-xs flex items-center gap-1.5" style={{ background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <span style={{ color: '#22c55e' }}>★</span>
                <span style={{ color: '#86efac' }}>
                  CONFIDENT vs {Object.entries(behaviorRules.confidence).map(([team, count]) => {
                    const player = gameState?.players?.[team];
                    return `${player?.name || team} (${count} wins)`;
                  }).join(', ')}
                </span>
              </div>
            )}
            {Object.keys(behaviorRules.fears || {}).length > 0 && (
              <div className="px-2 py-1 rounded text-xs flex items-center gap-1.5" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
                <span style={{ color: '#a855f7' }}>◈</span>
                <span style={{ color: '#d8b4fe' }}>
                  FEARS: {Object.entries(behaviorRules.fears).map(([team]) => {
                    const player = gameState?.players?.[team];
                    return player?.name || team;
                  }).join(', ')}
                </span>
              </div>
            )}
            {behaviorRules.traumaTerrain?.length > 0 && (
              <div className="px-2 py-1 rounded text-xs flex items-center gap-1.5" style={{ background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)' }}>
                <span style={{ color: '#fbbf24' }}>⚠</span>
                <span style={{ color: '#fde68a' }}>
                  TRAUMA: Avoids {behaviorRules.traumaTerrain.join(', ')} terrain
                </span>
              </div>
            )}
            {behaviorRules.insubordinate && (
              <div className="px-2 py-1 rounded text-xs flex items-center gap-1.5" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
                <span style={{ color: '#ef4444' }}>!</span>
                <span style={{ color: '#fca5a5' }}>INSUBORDINATE — may refuse orders</span>
              </div>
            )}
            {behaviorRules.veteranBonus > 0 && (
              <div className="px-2 py-1 rounded text-xs flex items-center gap-1.5" style={{ background: 'rgba(96,165,250,0.08)', border: '1px solid rgba(96,165,250,0.2)' }}>
                <span style={{ color: '#60a5fa' }}>◆</span>
                <span style={{ color: '#93c5fd' }}>
                  VETERAN +{Math.round(behaviorRules.veteranBonus * 100)}% combat ({behaviorRules.totalMemories} memories)
                </span>
              </div>
            )}
          </div>
        )}

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
          {spirit.commandRadius > 0 && (
            <div className="flex justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cmd Range</span>
              <span style={{ color: '#60a5fa' }}>{spirit.commandRadius}</span>
            </div>
          )}
          {spirit.tier === 'captain' && (
            <div className="flex justify-between px-2 py-1 rounded" style={{ background: 'var(--bg-elevated)' }}>
              <span style={{ color: 'var(--text-muted)' }}>Ledger</span>
              <span style={{ color: '#2dd4bf' }}>{memoryLedger.length} memories</span>
            </div>
          )}
          {!isMine && (
            <div className="flex justify-between px-2 py-1 rounded col-span-2" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
              <span style={{ color: '#ef4444' }}>Resistance</span>
              <span style={{ color: '#ef4444' }}>{Math.round(spirit.enemyResistance ?? 50)}/100</span>
            </div>
          )}
        </div>

        {/* Captain aura description */}
        {classData && (
          <div className="px-2 py-1.5 rounded text-xs" style={{ background: 'rgba(96,165,250,0.06)', border: '1px solid rgba(96,165,250,0.15)' }}>
            <span className="font-mono" style={{ color: '#93c5fd' }}>{classData.icon} {classData.label} Aura</span>
            <span style={{ color: 'var(--text-muted)' }}> — {classData.desc}</span>
          </div>
        )}

        {/* Memory Ledger */}
        <div className="pt-2 border-t border-gray-800/50">
          <button
            onClick={() => setShowMemories(v => !v)}
            className="w-full flex items-center justify-between text-xs font-mono py-1 hover:text-teal-300 transition-colors"
            style={{ color: '#2dd4bf' }}
          >
            <span className="flex items-center gap-1.5">
              <span>🧠</span>
              <span>{memoryLedger.length > 0 ? `${memoryLedger.length} memories` : `${spirit.memoryCount || 0} memories`}</span>
              {spirit.tier === 'captain' && <span style={{ color: 'rgba(45,212,191,0.4)', fontSize: '9px' }}>WALRUS</span>}
            </span>
            <span>{showMemories ? '▾' : '▸'}</span>
          </button>
          {showMemories && (
            <div className="mt-1 space-y-1 max-h-52 overflow-y-auto">
              {memoryLedger.length === 0 ? (
                loadingMem ? (
                  <p className="text-xs text-gray-500 italic animate-pulse">Loading...</p>
                ) : memories.length === 0 ? (
                  <p className="text-xs text-gray-500 italic">No memories yet</p>
                ) : (
                  memories.map((m, i) => (
                    <div key={i} className="text-xs px-2 py-1 rounded leading-tight" style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}>
                      {m.text?.length > 120 ? m.text.slice(0, 117) + '...' : m.text}
                    </div>
                  ))
                )
              ) : (
                [...memoryLedger].reverse().map((m) => {
                  const typeColors = {
                    BATTLE: m.outcome === 'WIN' ? '#4ade80' : m.outcome === 'LOSS' ? '#ef4444' : '#fbbf24',
                    DECREE: '#60a5fa',
                    SCOUT: '#22d3ee',
                    BETRAYAL: '#a855f7',
                    ALLIANCE: '#22c55e',
                    DEATH_WITNESS: '#dc2626',
                    ENCOUNTER: '#f97316',
                  };
                  const color = typeColors[m.type] || '#9ca3af';
                  return (
                    <div key={m.id} className="text-xs px-2 py-1 rounded leading-tight flex items-start gap-1.5"
                      style={{ background: 'var(--bg-elevated)', borderLeft: `2px solid ${color}` }}>
                      <span className="font-mono shrink-0" style={{ color, fontSize: '9px' }}>
                        {m.type}{m.outcome ? `:${m.outcome}` : ''}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{m.text}</span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>

        {isGhost ? (
          <div className="pt-2 border-t border-purple-800/30">
            <div className="rounded-lg p-3 space-y-2" style={{ background: 'rgba(168,85,247,0.08)', border: '1px solid rgba(168,85,247,0.2)' }}>
              <div className="text-xs font-mono tracking-wider" style={{ color: '#a855f7' }}>GHOST ENCOUNTER</div>
              {spirit._ghostData?.memorableQuote && (
                <p className="text-sm italic leading-relaxed" style={{ color: '#c084fc' }}>
                  "{spirit._ghostData.memorableQuote}"
                </p>
              )}
              <div className="grid grid-cols-2 gap-1 text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
                <span>Former deity: {spirit._ghostData?.lastDeityName || 'unknown'}</span>
                <span>Death: {spirit._ghostData?.deathCause || 'unknown'}</span>
                <span>Killed by: {spirit._ghostData?.killedBy || 'unknown'}</span>
                <span>Loyalty: {spirit._ghostData?.pastLifeLoyalty ?? '?'}/100</span>
              </div>

              {recruitResult ? (
                <div className="text-sm rounded p-2" style={{
                  background: recruitResult.success ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${recruitResult.success ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  color: recruitResult.success ? '#4ade80' : '#fca5a5',
                }}>
                  <p className="font-mono text-xs mb-1">{recruitResult.success ? 'RECRUITED' : 'REFUSED'}</p>
                  <p className="italic">"{recruitResult.dialogue}"</p>
                </div>
              ) : (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={recruitMsg}
                    onChange={e => setRecruitMsg(e.target.value)}
                    placeholder="Whisper to recruit..."
                    maxLength={200}
                    className="flex-1 px-2 py-1.5 rounded text-sm font-body"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid rgba(168,85,247,0.3)',
                      color: 'var(--text-primary)',
                      outline: 'none',
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && recruitMsg.trim() && !recruiting) {
                        e.preventDefault();
                        handleRecruit();
                      }
                    }}
                  />
                  <button
                    onClick={handleRecruit}
                    disabled={!recruitMsg.trim() || recruiting}
                    className="px-3 py-1.5 rounded font-mono text-xs transition-colors disabled:opacity-40"
                    style={{
                      background: 'rgba(168,85,247,0.2)',
                      border: '1px solid rgba(168,85,247,0.4)',
                      color: '#c084fc',
                    }}
                  >
                    {recruiting ? '...' : 'Recruit'}
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="pt-2">
            <p className="text-xs italic text-center" style={{ color: 'var(--text-muted)' }}>
              {isMine
                ? 'Use the Whisper Bar below to decree to your swarm'
                : 'Use the Enemy Whisper to influence this swarm'
              }
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
