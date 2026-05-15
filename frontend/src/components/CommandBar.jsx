import { useRef, useEffect, useState } from 'react';

const EVENT_PRIORITY = {
  game_over: 10,
  battle_resolved: 9,
  spawn_complete: 8,
  spirit_died: 7,
  battle_started: 6,
  spawn_started: 5,
  spirit_gathered: 4,
  territory_claimed: 3,
  whisper_arrived: 3,
  explore_started: 2,
  movement_complete: 1,
  spirit_moving: 0,
};

function relativeTime(ts) {
  if (!ts) return '';
  const sec = Math.round((Date.now() - ts) / 1000);
  if (sec < 5) return 'now';
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  return `${min}m ago`;
}

const EXPAND_LEVELS = ['h-40', 'h-80', 'h-[60vh]'];

export default function CommandBar({ timers, events, spirits, gameState }) {
  const logRef = useRef(null);
  const [expandLevel, setExpandLevel] = useState(0);

  const significantEvents = events
    .filter(e => (EVENT_PRIORITY[e.type] ?? 0) >= 2)
    .slice(-40)
    .reverse();

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [significantEvents.length]);

  return (
    <div className={`${EXPAND_LEVELS[expandLevel]} bg-gray-900/90 backdrop-blur border-t border-gray-700/50 flex transition-all duration-300`}>
      {/* Active Timers */}
      <div className="flex-1 p-2 overflow-x-auto">
        <div className="text-[10px] text-gray-500 mb-1 font-mono tracking-wider">ACTIVE</div>
        <div className="flex gap-2 flex-wrap">
          {timers.filter(t => {
            const spirit = gameState.spirits[t.spiritId];
            return spirit && spirits.some(s => s.id === spirit.id);
          }).map(timer => {
            const remaining = Math.max(0, Math.round((timer.completesAt - Date.now()) / 1000));
            const spirit = gameState.spirits[timer.spiritId];
            const typeColors = {
              movement: 'text-blue-400', battle: 'text-red-400',
              spawn: 'text-purple-400', whisper_propagation: 'text-amber-400',
            };
            return (
              <div key={timer.id} className="bg-gray-800/80 border border-gray-700/50 rounded px-2 py-1 min-w-[120px]">
                <div className={`text-[10px] font-mono ${typeColors[timer.type] || 'text-gray-400'}`}>{timer.type}</div>
                <div className="text-xs text-gray-300">{spirit?.name}</div>
                <div className="text-sm font-mono text-white">{remaining}s</div>
              </div>
            );
          })}
          {timers.length === 0 && (
            <div className="text-xs text-gray-600 italic">No active timers</div>
          )}
        </div>
      </div>

      {/* Event Log */}
      <div ref={logRef} className="w-[420px] border-l border-gray-700/50 p-2 overflow-y-auto">
        <div className="text-[10px] text-gray-500 mb-1 font-mono tracking-wider flex justify-between items-center">
          <span>CHRONICLE</span>
          <button onClick={() => setExpandLevel(v => (v + 1) % EXPAND_LEVELS.length)} className="text-gray-600 hover:text-gray-400 transition-colors px-1" title="Expand/collapse">
            {expandLevel === 0 ? '▴' : expandLevel === 1 ? '▴▴' : '▾'}
          </button>
        </div>
        {significantEvents.map((evt, i) => (
          <EventEntry key={`${evt.type}-${i}`} evt={evt} gs={gameState} />
        ))}
        {significantEvents.length === 0 && (
          <div className="text-xs text-gray-600 italic">The realm awaits...</div>
        )}
      </div>
    </div>
  );
}

function EventEntry({ evt, gs }) {
  const spiritName = (id, fallback) => gs.spirits[id]?.name || fallback || 'a spirit';
  const playerName = (id) => gs.players[id]?.name || id;
  const timeLabel = relativeTime(evt.timestamp);

  switch (evt.type) {
    case 'battle_started':
      return (
        <div className="mb-1">
          <div className="text-[11px] text-red-400 flex justify-between">
            <span>⚔ {spiritName(evt.attackerId, evt.attackerName)} challenges {spiritName(evt.defenderId, evt.defenderName)}</span>
            {timeLabel && <span className="text-gray-600 text-[9px] ml-2 flex-shrink-0">{timeLabel}</span>}
          </div>
          {evt.reasoning && (
            <div className="text-[9px] text-red-400/50 italic leading-tight mt-0.5">"{evt.reasoning}"</div>
          )}
        </div>
      );

    case 'battle_resolved': {
      const winner = spiritName(evt.winnerId, evt.winnerName);
      const loser = spiritName(evt.loserId, evt.loserName);
      const outcome = evt.loserOutcome === 'died' ? 'slain' : 'retreated';
      const marginLabel = evt.margin >= 8 ? 'decisive' : evt.margin >= 4 ? 'close' : 'razor-thin';
      return (
        <div className="mb-1.5 border-l-2 border-red-500/40 pl-2">
          <div className="text-[11px] text-red-300 font-medium flex justify-between">
            <span>⚔ {winner} defeats {loser} ({outcome}, {marginLabel})</span>
            {timeLabel && <span className="text-gray-600 text-[9px] ml-2 flex-shrink-0">{timeLabel}</span>}
          </div>
          {evt.narrative && (
            <div className="text-[10px] text-gray-500 italic leading-tight mt-0.5">
              {evt.narrative}
            </div>
          )}
          {evt.attackerInvocation && (
            <div className="text-[9px] text-red-400/40 leading-tight mt-0.5">
              "{evt.attackerInvocation.substring(0, 80)}..."
            </div>
          )}
        </div>
      );
    }

    case 'spawn_complete':
      return (
        <div className="mb-1.5 border-l-2 border-purple-500/40 pl-2">
          <div className="text-[11px] text-purple-300 flex justify-between">
            <span>✦ {spiritName(evt.parentId, evt.parentName)} spawned <span className="text-purple-200">{evt.childName}</span> (gen {evt.generation})</span>
            {timeLabel && <span className="text-gray-600 text-[9px] ml-2 flex-shrink-0">{timeLabel}</span>}
          </div>
          {evt.childPersonality && (
            <div className="text-[10px] text-gray-500 italic leading-tight mt-0.5">
              {evt.childPersonality.substring(0, 100)}...
            </div>
          )}
        </div>
      );

    case 'spawn_started':
      return (
        <div className="text-[11px] text-purple-400/70 mb-0.5">
          <div>✦ {spiritName(evt.spiritId, evt.spiritName)} begins the spawning ritual...</div>
          {evt.reasoning && (
            <div className="text-[9px] text-purple-400/40 italic leading-tight">"{evt.reasoning}"</div>
          )}
        </div>
      );

    case 'spirit_gathered':
      return (
        <div className="text-[11px] text-amber-400/60 mb-0.5">
          {spiritName(evt.spiritId, evt.spiritName)} gathered {evt.amount} memories
        </div>
      );

    case 'spirit_died':
      return (
        <div className="text-[11px] text-gray-500 mb-0.5">
          ☽ {spiritName(evt.spiritId, evt.spiritName)} has fallen
        </div>
      );

    case 'territory_claimed':
      return (
        <div className="text-[11px] text-green-400/60 mb-0.5">
          {playerName(evt.playerId)} claimed new territory
        </div>
      );

    case 'whisper_arrived':
      return (
        <div className="text-[11px] text-amber-300/60 mb-0.5">
          ~ a whisper reached {spiritName(evt.spiritId, evt.spiritName)}
        </div>
      );

    case 'explore_started':
      return (
        <div className="text-[11px] text-blue-400/60 mb-0.5">
          <div>{spiritName(evt.spiritId, evt.spiritName)} ventures into the unknown</div>
          {evt.reasoning && (
            <div className="text-[9px] text-blue-400/40 italic leading-tight">"{evt.reasoning}"</div>
          )}
        </div>
      );

    case 'game_over':
      return (
        <div className="mb-2 border-l-2 border-amber-500/60 pl-2">
          <div className="text-[12px] text-amber-400 font-medium flex justify-between">
            <span>★ {playerName(evt.winner)} conquers the realm</span>
            {timeLabel && <span className="text-gray-600 text-[9px] ml-2 flex-shrink-0">{timeLabel}</span>}
          </div>
        </div>
      );

    default:
      return (
        <div className="text-[11px] text-gray-500 mb-0.5">
          {evt.type.replace(/_/g, ' ')}
        </div>
      );
  }
}
