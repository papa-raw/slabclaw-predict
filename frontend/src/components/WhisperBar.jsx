import { useState, useEffect, useRef } from 'react';
import { getPlayerColor } from '@lib/terrainTypes.js';

export default function WhisperBar({ playerId, gameState }) {
  const [swarmMsg, setSwarmMsg] = useState('');
  const [enemyMsg, setEnemyMsg] = useState('');
  const [targetPlayer, setTargetPlayer] = useState('');
  const [sendingSwarm, setSendingSwarm] = useState(false);
  const [sendingEnemy, setSendingEnemy] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const swarmRef = useRef(null);

  const player = gameState.players[playerId];
  const charges = player?.whisperCharges || { swarm: 0, enemy: 0 };
  const resetIn = Math.max(0, 30 - Math.floor((Date.now() - (player?.lastWhisperReset || 0)) / 1000));

  const enemies = Object.entries(gameState.players).filter(
    ([id, p]) => id !== playerId
  );

  useEffect(() => {
    if (!targetPlayer && enemies.length > 0) setTargetPlayer(enemies[0][0]);
  }, [enemies.length]);

  // Recharge countdown
  const [countdown, setCountdown] = useState(resetIn);
  useEffect(() => {
    const iv = setInterval(() => {
      const r = Math.max(0, 30 - Math.floor((Date.now() - (player?.lastWhisperReset || 0)) / 1000));
      setCountdown(r);
    }, 1000);
    return () => clearInterval(iv);
  }, [player?.lastWhisperReset]);

  async function sendSwarm(e) {
    e.preventDefault();
    if (!swarmMsg.trim() || sendingSwarm || charges.swarm <= 0) return;
    setSendingSwarm(true);
    try {
      const res = await fetch('/api/game/whisper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, type: 'swarm', message: swarmMsg.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult({ type: 'swarm', count: data.spirits?.length || 0 });
        setSwarmMsg('');
        setTimeout(() => setLastResult(null), 3000);
      }
    } catch {}
    setSendingSwarm(false);
  }

  async function sendEnemy(e) {
    e.preventDefault();
    if (!enemyMsg.trim() || sendingEnemy || charges.enemy <= 0 || !targetPlayer) return;
    setSendingEnemy(true);
    try {
      const res = await fetch('/api/game/whisper', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, type: 'enemy', message: enemyMsg.trim(), targetPlayerId: targetPlayer }),
      });
      const data = await res.json();
      if (res.ok) {
        setLastResult({ type: 'enemy', spirits: data.spirits });
        setEnemyMsg('');
        setTimeout(() => setLastResult(null), 4000);
      }
    } catch {}
    setSendingEnemy(false);
  }

  const targetName = targetPlayer ? gameState.players[targetPlayer]?.name : '';
  const targetColor = targetPlayer ? getPlayerColor(targetPlayer, gameState) : '#ef4444';

  return (
    <div
      className="flex items-stretch gap-3 px-4 py-2.5 flex-shrink-0 relative"
      style={{ background: 'rgba(6,10,18,0.9)', borderTop: '1px solid var(--gold-dim)' }}
    >
      {/* Swarm Decree */}
      <form onSubmit={sendSwarm} className="flex-1 flex items-center gap-2">
        <div className="flex flex-col items-center gap-0.5 w-14 flex-shrink-0">
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: 'var(--gold-bright)' }}>
            Swarm
          </span>
          <span className="text-xs font-mono" style={{ color: charges.swarm > 0 ? 'var(--gold-bright)' : 'var(--text-muted)' }}>
            {charges.swarm}/1
          </span>
        </div>
        <input
          ref={swarmRef}
          value={swarmMsg}
          onChange={e => setSwarmMsg(e.target.value)}
          placeholder={charges.swarm > 0 ? 'Decree to your swarm...' : `Recharging (${countdown}s)`}
          disabled={sendingSwarm || charges.swarm <= 0}
          className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors"
          style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${charges.swarm > 0 ? 'var(--gold-dim)' : 'var(--bg-surface)'}`,
            color: 'var(--text-primary)',
            opacity: charges.swarm > 0 ? 1 : 0.5,
          }}
        />
        <button
          type="submit"
          disabled={sendingSwarm || !swarmMsg.trim() || charges.swarm <= 0}
          className="px-3 py-2 rounded-lg text-sm font-header uppercase tracking-wider font-semibold transition-colors disabled:opacity-30"
          style={{ background: 'var(--gold-bright)', color: 'var(--bg-abyss)' }}
        >
          {sendingSwarm ? '...' : '⚡'}
        </button>
      </form>

      {/* Divider */}
      <div className="w-px self-stretch" style={{ background: 'var(--gold-dim)' }} />

      {/* Enemy Whisper */}
      <form onSubmit={sendEnemy} className="flex-1 flex items-center gap-2">
        <div className="flex flex-col items-center gap-0.5 w-14 flex-shrink-0">
          <span className="text-xs font-mono uppercase tracking-wider" style={{ color: '#ef4444' }}>
            Enemy
          </span>
          <span className="text-xs font-mono" style={{ color: charges.enemy > 0 ? '#ef4444' : 'var(--text-muted)' }}>
            {charges.enemy}/1
          </span>
        </div>
        <select
          value={targetPlayer}
          onChange={e => setTargetPlayer(e.target.value)}
          disabled={sendingEnemy || charges.enemy <= 0}
          className="px-2 py-2 rounded-lg text-xs font-mono focus:outline-none w-24 flex-shrink-0"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: targetColor,
          }}
        >
          {enemies.map(([id, p]) => (
            <option key={id} value={id} style={{ color: getPlayerColor(id, gameState) }}>
              {p.name}
            </option>
          ))}
        </select>
        <input
          value={enemyMsg}
          onChange={e => setEnemyMsg(e.target.value)}
          placeholder={charges.enemy > 0 ? `Whisper to ${targetName}...` : `Recharging (${countdown}s)`}
          disabled={sendingEnemy || charges.enemy <= 0}
          className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors"
          style={{
            background: 'var(--bg-elevated)',
            border: `1px solid ${charges.enemy > 0 ? 'rgba(239,68,68,0.3)' : 'var(--bg-surface)'}`,
            color: 'var(--text-primary)',
            opacity: charges.enemy > 0 ? 1 : 0.5,
          }}
        />
        <button
          type="submit"
          disabled={sendingEnemy || !enemyMsg.trim() || charges.enemy <= 0 || !targetPlayer}
          className="px-3 py-2 rounded-lg text-sm font-header uppercase tracking-wider font-semibold transition-colors disabled:opacity-30"
          style={{ background: '#dc2626', color: '#fff' }}
        >
          {sendingEnemy ? '...' : '🗡'}
        </button>
      </form>

      {/* Result flash */}
      {lastResult && (
        <div
          className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-4 py-2 rounded-lg text-xs font-mono pointer-events-none"
          style={{
            background: lastResult.type === 'swarm' ? 'rgba(212,160,82,0.2)' : 'rgba(239,68,68,0.2)',
            border: `1px solid ${lastResult.type === 'swarm' ? 'var(--gold-dim)' : 'rgba(239,68,68,0.3)'}`,
            color: lastResult.type === 'swarm' ? 'var(--gold-bright)' : '#ef4444',
            animation: 'whisper-flash 3s ease-out forwards',
          }}
        >
          {lastResult.type === 'swarm' ? (
            <span>Decree heard by {lastResult.count} spirits</span>
          ) : (
            <div className="flex flex-col gap-0.5">
              <span>{lastResult.spirits?.filter(s => s.effect !== 'ignored').length || 0} spirits affected</span>
              {lastResult.spirits?.filter(s => s.effect !== 'ignored').slice(0, 3).map(s => (
                <span key={s.spiritId} style={{ color: s.effect === 'defecting' ? '#f87171' : s.effect === 'overridden' ? '#fb923c' : '#fbbf24' }}>
                  {s.name}: {s.effect}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes whisper-flash {
          0% { opacity: 1; transform: translate(-50%, 0); }
          70% { opacity: 1; transform: translate(-50%, 0); }
          100% { opacity: 0; transform: translate(-50%, -8px); }
        }
      `}</style>
    </div>
  );
}
