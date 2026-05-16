import { useState, useEffect } from 'react';
import { getAvatarUrl } from '@lib/avatarUrl.js';

export default function LineageSection({ spirit }) {
  const [expanded, setExpanded] = useState(false);
  const [lineage, setLineage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const hasHistory = spirit.reincarnationCount > 0 || spirit.previousNames?.length > 0;
  if (!hasHistory) return null;

  async function fetchLineage() {
    if (lineage || loading) return;
    setLoading(true);
    setError(null);
    try {
      // We need the essence blobId from the game state's chain
      const res = await fetch('/api/game/state');
      const state = await res.json();
      const chainBlobId = state._essenceChain?.slice(-1)[0];
      if (!chainBlobId) {
        setLineage([]);
        return;
      }
      const lineageRes = await fetch(`/api/essence/lineage?blobId=${chainBlobId}`);
      const data = await lineageRes.json();
      setLineage(data.chain || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleToggle() {
    const next = !expanded;
    setExpanded(next);
    if (next && !lineage) fetchLineage();
  }

  return (
    <div className="border-t border-gray-700/30 mt-2">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-1 py-2 text-left hover:bg-gray-800/30 transition-colors rounded"
      >
        <div className="flex items-center gap-2">
          <span className="text-purple-400 text-xs">✦</span>
          <span className="text-[11px] text-gray-400 font-mono">
            Past Lives ({spirit.reincarnationCount})
          </span>
        </div>
        <span className="text-gray-600 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="space-y-2 pb-2">
          {/* Quick local view from spirit data */}
          {spirit.previousNames?.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap px-1">
              {spirit.previousNames.map((name, i) => (
                <span key={i} className="text-[10px] px-1.5 py-0.5 rounded bg-purple-900/30 text-purple-300 border border-purple-800/30">
                  {name}
                </span>
              ))}
              <span className="text-[10px] text-gray-600">→</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-900/30 text-amber-300 border border-amber-800/30">
                {spirit.name}
              </span>
            </div>
          )}

          {/* Past life memories */}
          {spirit.pastLifeMemories?.length > 0 && (
            <div className="px-1 space-y-1">
              <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">Echoes</div>
              {spirit.pastLifeMemories.slice(0, 3).map((mem, i) => (
                <p key={i} className="text-[10px] text-gray-500 italic leading-tight">"{mem}"</p>
              ))}
            </div>
          )}

          {/* Deep lineage from Walrus */}
          {loading && (
            <div className="px-1 text-[10px] text-gray-500 font-mono animate-pulse">
              Fetching lineage from Walrus...
            </div>
          )}

          {error && (
            <div className="px-1 text-[10px] text-red-400 font-mono">{error}</div>
          )}

          {lineage && lineage.length > 0 && (
            <div className="px-1 space-y-2">
              <div className="text-[9px] text-gray-500 font-mono uppercase tracking-wider">
                Full Lineage ({lineage.length} game{lineage.length > 1 ? 's' : ''})
              </div>
              {lineage.map((essence, i) => (
                <LineageEntry key={essence.blobId || i} essence={essence} index={i} isLast={i === lineage.length - 1} />
              ))}
            </div>
          )}

          {lineage && lineage.length === 0 && !loading && (
            <div className="px-1 text-[10px] text-gray-600 italic">
              No previous games found on Walrus
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function LineageEntry({ essence, index, isLast }) {
  const spirits = essence.spiritLegacies || [];
  const topSpirit = spirits[0];

  return (
    <div className={`relative pl-4 ${!isLast ? 'pb-2' : ''}`}>
      {/* Timeline connector */}
      {!isLast && (
        <div className="absolute left-[5px] top-3 bottom-0 w-px bg-purple-800/40" />
      )}
      <div className="absolute left-0 top-1.5 w-2.5 h-2.5 rounded-full bg-purple-900/60 border border-purple-600/50" />

      <div className="bg-gray-800/30 rounded px-2 py-1.5 border border-gray-700/20">
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] text-gray-400 font-mono">
            {essence.deityName || `Game ${index + 1}`}
          </span>
          {essence.gameOutcome && (
            <span className={`text-[9px] font-mono ${essence.gameOutcome.isVictory ? 'text-green-400' : 'text-gray-500'}`}>
              {essence.gameOutcome.isVictory ? '✓ Won' : '✗ Lost'}
            </span>
          )}
        </div>

        {/* Spirit avatars from this game */}
        <div className="flex gap-1.5 mt-1">
          {spirits.slice(0, 4).map((s, i) => (
            <div key={i} className="flex items-center gap-1">
              {s.avatarBlobId ? (
                <img
                  src={getAvatarUrl(s.avatarBlobId)}
                  alt={s.name}
                  className="w-5 h-5 rounded-full object-cover border border-purple-700/40"
                />
              ) : (
                <div className="w-5 h-5 rounded-full bg-purple-900/40 border border-purple-700/40 flex items-center justify-center text-[8px] text-purple-300">
                  {s.name?.[0]}
                </div>
              )}
              <span className="text-[9px] text-gray-400">{s.name}</span>
            </div>
          ))}
        </div>

        {/* Key stats */}
        <div className="flex gap-3 mt-1 text-[9px] text-gray-500 font-mono">
          {essence.gameOutcome?.totalBattles > 0 && <span>⚔ {essence.gameOutcome.totalBattles}</span>}
          {essence.gameOutcome?.totalSpawns > 0 && <span>✦ {essence.gameOutcome.totalSpawns}</span>}
          {essence.playstyle?.dominantThemes?.[0] && (
            <span className="text-purple-400/60">{essence.playstyle.dominantThemes[0]}</span>
          )}
        </div>
      </div>
    </div>
  );
}
