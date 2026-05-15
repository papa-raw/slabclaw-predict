import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import HexMap from './components/HexMap.jsx';
import CommandBar from './components/CommandBar.jsx';
import WalletConnect from './components/WalletConnect.jsx';
import PlayerHud from './components/PlayerHud.jsx';
import Lobby from './components/Lobby.jsx';
import SpiritPanel from './components/SpiritPanel.jsx';
import EssenceExport from './components/EssenceExport.jsx';

export default function App() {
  const account = useCurrentAccount();
  const [gameState, setGameState] = useState(null);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [events, setEvents] = useState([]);
  // Persisted chat messages per spirit within the session — Map<spiritId, Message[]>
  const [spiritMessages, setSpiritMessages] = useState({});
  const [whisperTrails, setWhisperTrails] = useState([]);
  const wsRef = useRef(null);

  // WebSocket connection with reconnection
  useEffect(() => {
    const playerId = account?.address || 'player-1';
    let ws = null;
    let retryCount = 0;
    let retryTimer = null;
    let closed = false;

    function connect() {
      if (closed) return;
      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      ws = new WebSocket(`${proto}//${window.location.host}/ws?playerId=${playerId}`);

      ws.onopen = () => {
        retryCount = 0;
        fetch('/api/game/state')
          .then(r => r.json())
          .then(state => {
            setGameState(state);
            if (state.events?.length) setEvents(state.events);
          });
      };

      ws.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        if (msg.type === 'tick') {
          setGameState(prev => {
            // If selected spirit just died, deselect it
            if (msg.state && prev) {
              setSelectedSpirit(sel => {
                if (!sel) return sel;
                const wasAlive = prev.spirits?.[sel]?.alive;
                const nowDead = !msg.state.spirits?.[sel]?.alive;
                if (wasAlive && nowDead) return null;
                return sel;
              });
            }
            return msg.state;
          });
          if (msg.events?.length) {
            setEvents(prev => [...prev.slice(-50), ...msg.events]);
            // Handle game_over event from WebSocket
            const gameOverEvt = msg.events.find(e => e.type === 'game_over');
            if (gameOverEvt) {
              setGameState(prev => prev ? { ...prev, status: 'finished', winner: gameOverEvt.winner } : prev);
            }
          }
        } else if (msg.type === 'state_change') {
          // Lobby → active (or any status transition) — update without a page reload
          setGameState(msg.state);
        }
      };

      ws.onclose = () => {
        if (closed) return;
        const delay = Math.min(1000 * 2 ** retryCount, 10000);
        retryCount++;
        retryTimer = setTimeout(connect, delay);
      };

      wsRef.current = ws;
    }

    connect();
    return () => {
      closed = true;
      clearTimeout(retryTimer);
      ws?.close();
    };
  }, [account?.address]);

  if (!gameState) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
        <div className="text-center">
          <h1 className="text-3xl font-display text-amber-500 mb-4">Anima Swarm</h1>
          <p className="text-gray-400">Connecting to game...</p>
        </div>
      </div>
    );
  }

  const playerId = account?.address || 'player-1';
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId && s.alive);

  // Lobby: waiting for game to start
  if (gameState.status === 'lobby') {
    return <Lobby playerId={playerId} gameState={gameState} />;
  }

  // Game over: show results
  if (gameState.status === 'finished') {
    const winnerPlayer = gameState.players[gameState.winner];
    const isVictory = gameState.winner === playerId;
    const finalScores = Object.entries(gameState.players)
      .map(([id, p]) => ({
        id, name: p.name, title: p.deityTitle || '',
        hexes: p.hexesControlled || 0,
        spirits: Object.values(gameState.spirits).filter(s => s.playerId === id && s.alive).length,
        pct: Math.round(((p.hexesControlled || 0) / 37) * 100),
      }))
      .sort((a, b) => b.hexes - a.hexes);
    const totalBattles = (gameState.events || []).filter(e => e.type === 'battle_resolved').length;
    const totalSpawns = (gameState.events || []).filter(e => e.type === 'spawn_complete').length;
    const totalDeaths = Object.values(gameState.spirits).filter(s => !s.alive).length;

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-deep)' }}>
        <div className="text-center max-w-lg space-y-6">
          <h1 className="text-4xl font-display text-amber-500">
            {isVictory ? 'Victory' : 'Defeat'}
          </h1>
          <p className="text-gray-400 text-lg">
            {isVictory
              ? 'Your swarm dominates the world.'
              : `${winnerPlayer?.name || 'Another deity'}${winnerPlayer?.deityTitle ? ` ${winnerPlayer.deityTitle}` : ''} has conquered the realm.`}
          </p>

          <div className="bg-gray-900/60 border border-gray-700/40 rounded-lg p-4 text-left">
            <div className="text-[10px] text-gray-500 font-mono mb-2 tracking-wider">FINAL STANDINGS</div>
            {finalScores.map((p, i) => (
              <div key={p.id} className={`flex items-center gap-3 py-1 text-sm font-mono ${i === 0 ? 'text-amber-400' : p.spirits === 0 ? 'text-gray-600' : 'text-gray-400'}`}>
                <span className="w-4 text-right text-gray-600">{i + 1}.</span>
                <span className="flex-1">{p.name} {p.title && <span className="text-gray-600 text-xs">{p.title}</span>}</span>
                <span>{p.hexes}h</span>
                <span className="text-gray-500">{p.pct}%</span>
                <span className="text-gray-600">{p.spirits}s</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-6 text-xs text-gray-500 font-mono">
            <span>⚔ {totalBattles} battles</span>
            <span>✦ {totalSpawns} spawns</span>
            <span>☽ {totalDeaths} fallen</span>
          </div>

          <EssenceExport gameState={gameState} playerId={playerId} />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <header className="h-14 bg-gray-900/80 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-4 relative z-30 overflow-visible">
        <h1 className="font-display text-lg text-amber-500 font-semibold">Anima Swarm</h1>
        <div className="flex items-center gap-4">
          <PlayerHud player={gameState.players[playerId]} spirits={mySpirits} gameState={gameState} />
          <WalletConnect />
        </div>
      </header>

      {/* Main */}
      <main className="flex-1 flex overflow-hidden">
        {/* Hex Map — full width in Sprint 1 */}
        <div className="flex-1 relative">
          <HexMap
            hexes={gameState.map.hexes}
            spirits={gameState.spirits}
            playerId={playerId}
            selectedSpirit={selectedSpirit}
            onSelectSpirit={setSelectedSpirit}
            gameState={gameState}
            whisperTrails={whisperTrails}
          />
        </div>

        {/* Spirit Panel — Sprint 2 */}
        {selectedSpirit && gameState.spirits[selectedSpirit] && (
          <div className="w-[400px] border-l border-gray-700/50 bg-gray-900/60 backdrop-blur flex flex-col overflow-hidden animate-slide-in-right">
            <SpiritPanel
              spirit={gameState.spirits[selectedSpirit]}
              gameState={gameState}
              playerId={playerId}
              onClose={() => setSelectedSpirit(null)}
              messages={spiritMessages[selectedSpirit] || []}
              onMessages={(updater) => setSpiritMessages(prev => ({
                ...prev,
                [selectedSpirit]: typeof updater === 'function'
                  ? updater(prev[selectedSpirit] || [])
                  : updater,
              }))}
              onWhispers={(trails) => setWhisperTrails(trails)}
            />
          </div>
        )}
      </main>

      {/* Command Bar — bottom */}
      <CommandBar
        timers={gameState.activeTimers}
        events={events}
        spirits={mySpirits}
        gameState={gameState}
      />
    </div>
  );
}
