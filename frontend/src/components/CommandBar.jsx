import { useRef, useEffect } from 'react';

const EVENT_PRIORITY = {
  game_over: 10,
  battle_resolved: 9,
  spawn_complete: 8,
  spirit_died: 7,
  battle_started: 6,
  spawn_started: 5,
  spirit_dialog: 4,
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

function timeSince(ts) {
  const s = Math.round((Date.now() - ts) / 1000);
  if (s < 5) return 'now';
  if (s < 60) return `${s}s`;
  return `${Math.round(s / 60)}m`;
}

function truncId(id) {
  if (!id || id.length <= 16) return id || '';
  return `${id.slice(0, 8)}...${id.slice(-6)}`;
}

const SUI_EXPLORER = 'https://suiscan.xyz/testnet/object/';
const WALRUS_SCAN = 'https://walruscan.com/testnet/blob/';

const OP_CONFIG = {
  memory_recall:   { icon: '↓', color: '#5eead4', label: 'Memory Recall',   svc: 'MemWal' },
  memory_store:    { icon: '↑', color: '#2dd4bf', label: 'Memory Store',    svc: 'MemWal' },
  whisper_store:   { icon: '~', color: '#fbbf24', label: 'Whisper Stored',  svc: 'MemWal' },
  essence_store:   { icon: '◆', color: '#a78bfa', label: 'Essence Stored',  svc: 'Walrus' },
  essence_read:    { icon: '◇', color: '#c4b5fd', label: 'Essence Read',    svc: 'Walrus' },
  battle_recall:   { icon: '⚔', color: '#f87171', label: 'Battle Recall',   svc: 'MemWal' },
  decision_recall: { icon: '◎', color: '#60a5fa', label: 'Decision Recall', svc: 'MemWal' },
  territory_claim: { icon: '⬡', color: '#4ade80', label: 'Territory Claim', svc: 'Sui' },
  battle_record:   { icon: '⚔', color: '#ef4444', label: 'Battle Record',   svc: 'Sui' },
  spawn_record:    { icon: '✦', color: '#c084fc', label: 'Spawn Record',    svc: 'Sui' },
};

export default function CommandBar({ timers, events, spirits, gameState, chainOps = [], chainInfo = null, mode = null }) {
  const logRef = useRef(null);

  const significantEvents = events
    .filter(e => (EVENT_PRIORITY[e.type] ?? 0) >= 2)
    .slice(-40)
    .reverse();

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = 0;
  }, [significantEvents.length, chainOps.length]);

  const memwalOps = chainOps.filter(o => o.service === 'memwal').length;
  const suiOps = chainOps.filter(o => o.service === 'sui').length;

  if (mode === 'chronicle') {
    return (
      <div ref={logRef} className="flex-1 overflow-y-auto min-h-0 flex flex-col">
        {/* Active Timers */}
        {timers.length > 0 && (
          <div className="p-2 border-b border-gray-700/40 flex-shrink-0">
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
                  <div key={timer.id} className="bg-gray-800/80 border border-gray-700/50 rounded px-2 py-1 min-w-[110px]">
                    <div className={`text-[10px] font-mono ${typeColors[timer.type] || 'text-gray-400'}`}>{timer.type}</div>
                    <div className="text-xs text-gray-300">{spirit?.name}</div>
                    <div className="text-sm font-mono text-white">{remaining}s</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          {significantEvents.map((evt, i) => (
            <EventEntry key={`${evt.type}-${i}`} evt={evt} gs={gameState} />
          ))}
          {significantEvents.length === 0 && (
            <div className="text-xs text-gray-600 italic py-4 text-center">The realm awaits...</div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'chain') {
    return (
      <div ref={logRef} className="flex-1 overflow-y-auto px-3 py-2 min-h-0">
        {chainOps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <div className="text-2xl mb-2 opacity-30">⛓</div>
            <p className="text-[10px] text-gray-600 italic">Waiting for chain operations...</p>
            <p className="text-[9px] text-gray-700 mt-1">MemWal memories, Walrus blobs, and Sui transactions appear here</p>
          </div>
        ) : (
          [...chainOps].reverse().map((op, i) => <ChainOpEntry key={op.id || i} op={op} />)
        )}

        {chainInfo && (
          <div className="border-t border-gray-800/50 mt-2 pt-2 space-y-2">
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px]">
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Package</span>
                <a href={`${SUI_EXPLORER}${chainInfo.contracts.package.id}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[9px] text-blue-400 hover:text-blue-300 underline">{truncId(chainInfo.contracts.package.id)}</a>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">MemWal</span>
                <a href={`${SUI_EXPLORER}${chainInfo.memwal.registry.id}`} target="_blank" rel="noopener noreferrer"
                  className="font-mono text-[9px] text-teal-400 hover:text-teal-300 underline">{truncId(chainInfo.memwal.registry.id)}</a>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Network</span>
                <span className="font-mono text-teal-400">{chainInfo.network}</span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-gray-500">Storage</span>
                <span className={`font-mono ${chainInfo.storageMode === 'testnet' ? 'text-green-400' : 'text-amber-400'}`}>
                  Walrus {chainInfo.storageMode}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px]">
              <span className="text-gray-500">Ops: <span className="text-teal-400 font-mono">{chainOps.length}</span></span>
              <span className="text-gray-500">MemWal: <span className="text-cyan-400 font-mono">{memwalOps}</span></span>
              <span className="text-gray-500">Sui: <span className="text-blue-400 font-mono">{suiOps}</span></span>
              <span className="text-gray-500">Stored: <span className="text-teal-300 font-mono">{chainOps.filter(o => o.type === 'memory_store').length}</span></span>
              <span className="text-gray-500">Recalled: <span className="text-teal-300 font-mono">{chainOps.filter(o => o.type === 'memory_recall').reduce((s, o) => s + (o.count || 0), 0)}</span></span>
            </div>
            <div className="flex items-center gap-3 pt-1">
              <a href={`${SUI_EXPLORER}${chainInfo.contracts.package.id}`}
                target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-mono text-blue-400 hover:text-blue-300 underline">Sui Explorer</a>
              <a href="https://www.walruscan.com" target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-mono text-purple-400 hover:text-purple-300 underline">WalrusScan</a>
              <a href="https://memwal.ai" target="_blank" rel="noopener noreferrer"
                className="text-[9px] font-mono text-teal-400 hover:text-teal-300 underline">MemWal</a>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}

function ChainOpEntry({ op }) {
  const cfg = OP_CONFIG[op.type] || { icon: '•', color: '#9ca3af', label: op.type, svc: '?' };
  const blobLink = op.blobId && !op.blobId.startsWith('mock-')
    ? `${WALRUS_SCAN}${op.blobId}` : null;

  return (
    <div className="flex items-start gap-2 py-1 border-b border-gray-800/30 last:border-0 text-[11px] leading-tight">
      <span style={{ color: cfg.color }} className="font-mono text-xs flex-shrink-0 w-4 text-center mt-px">
        {cfg.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-gray-300">{op.label || cfg.label}</span>
          <span className="text-gray-600 font-mono text-[9px] px-1 py-px rounded bg-gray-800/60">
            {cfg.svc}
          </span>
        </div>
        {op.spiritName && <span className="text-gray-500 text-[10px]">{op.spiritName}</span>}
        {op.count != null && <span className="text-gray-500 text-[10px] ml-1">({op.count} results)</span>}
        {op.blobId && (
          <div className="flex items-center gap-1 mt-0.5">
            <span className="font-mono text-[9px] text-gray-600">{truncId(op.blobId)}</span>
            {blobLink && (
              <a href={blobLink} target="_blank" rel="noopener noreferrer"
                className="text-[9px] text-teal-500 hover:text-teal-400 underline">view</a>
            )}
          </div>
        )}
      </div>
      <span className="text-gray-600 text-[9px] font-mono flex-shrink-0 mt-px">
        {timeSince(op.timestamp)}
      </span>
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

    case 'spirit_dialog': {
      const isEnemy = evt.dialogType === 'TAUNT';
      return (
        <div className={`mb-1 border-l-2 ${isEnemy ? 'border-orange-500/40' : 'border-cyan-500/30'} pl-2`}>
          <div className={`text-[11px] ${isEnemy ? 'text-orange-300/80' : 'text-cyan-300/70'} flex justify-between`}>
            <span>{isEnemy ? '🗡' : '💬'} {evt.sourceName} → {evt.targetName}</span>
            {timeLabel && <span className="text-gray-600 text-[9px] ml-2 flex-shrink-0">{timeLabel}</span>}
          </div>
          <div className={`text-[10px] ${isEnemy ? 'text-orange-400/50' : 'text-cyan-400/50'} italic leading-tight mt-0.5`}>
            "{evt.text}"
          </div>
        </div>
      );
    }

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
