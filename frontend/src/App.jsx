import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import HexMap from './components/HexMap.jsx';
import CommandBar from './components/CommandBar.jsx';
import WalletConnect from './components/WalletConnect.jsx';
import PlayerHud from './components/PlayerHud.jsx';
import Lobby from './components/Lobby.jsx';
import SpiritPanel from './components/SpiritPanel.jsx';
import EssenceExport from './components/EssenceExport.jsx';
import OnboardingHints from './components/OnboardingHints.jsx';
import { getAvatarUrl } from '@lib/avatarUrl.js';

function getSessionPlayerId() {
  let id = sessionStorage.getItem('anima-player-id');
  if (!id) {
    id = 'player-1';
    sessionStorage.setItem('anima-player-id', id);
  }
  return id;
}

export default function App() {
  const account = useCurrentAccount();
  const [gameState, setGameState] = useState(null);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [events, setEvents] = useState([]);
  const [spiritMessages, setSpiritMessages] = useState({});
  const [whisperTrails, setWhisperTrails] = useState([]);
  const [chainOps, setChainOps] = useState([]);
  const [chainInfo, setChainInfo] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [rightTab, setRightTab] = useState('spirit');
  const wsRef = useRef(null);
  const chainOpIdRef = useRef(0);

  useEffect(() => {
    fetch('/api/game/chain-info').then(r => r.json()).then(setChainInfo).catch(() => {});
  }, []);

  function addChainOps(ops) {
    setChainOps(prev => {
      const tagged = ops.map(op => ({ ...op, id: `op-${++chainOpIdRef.current}` }));
      return [...prev, ...tagged].slice(-200);
    });
  }

  // WebSocket connection with reconnection
  useEffect(() => {
    const playerId = account?.address || getSessionPlayerId();
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
            const gameOverEvt = msg.events.find(e => e.type === 'game_over');
            if (gameOverEvt) {
              setGameState(prev => prev ? { ...prev, status: 'finished', winner: gameOverEvt.winner } : prev);
            }
            // Chain ops come from real server responses (chat endpoint), not fabricated here
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

  const playerId = account?.address || getSessionPlayerId();
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId && s.alive);

  if (gameState.status === 'lobby') {
    return <Lobby playerId={playerId} gameState={gameState} chainInfo={chainInfo} />;
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
        pct: Math.round(((p.hexesControlled || 0) / (Object.keys(gameState.map?.hexes || {}).length || 91)) * 100),
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
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
      {/* Header */}
      <header className="h-12 bg-gray-900/80 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-4 relative z-30 overflow-visible">
        <h1 className="font-display text-lg text-amber-500 font-semibold">Anima Swarm</h1>
        <div className="flex items-center gap-4">
          <PlayerHud player={gameState.players[playerId]} spirits={mySpirits} gameState={gameState} />
          <WalletConnect />
        </div>
      </header>

      {/* Main: Map left, Panel right */}
      <main className="flex-1 flex overflow-hidden">
        {/* Hex Map — 70% left */}
        <div className="flex-1 relative min-w-0">
          <HexMap
            hexes={gameState.map.hexes}
            spirits={gameState.spirits}
            playerId={playerId}
            selectedSpirit={selectedSpirit}
            onSelectSpirit={(id) => { setSelectedSpirit(id); if (id) setRightTab('spirit'); }}
            gameState={gameState}
            whisperTrails={whisperTrails}
            events={events}
          />
        </div>

        {/* Right Panel — tabbed: Spirit | Chronicle | Chain */}
        <div className="w-[360px] border-l border-gray-700/50 bg-gray-900/60 backdrop-blur flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-700/40 flex-shrink-0">
            {[
              { id: 'spirit', label: 'Spirit' },
              { id: 'chronicle', label: 'Chronicle' },
              { id: 'chain', label: 'Chain', badge: chainOps.length || null },
            ].map(tab => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)}
                className={`flex-1 py-2 text-[11px] font-mono tracking-wider transition-colors
                  ${rightTab === tab.id
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-800/30'
                    : 'text-gray-500 hover:text-gray-300'}`}>
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 text-[9px] px-1 py-px rounded-full bg-teal-900/60 text-teal-400 border border-teal-700/30">
                    {tab.badge}
                  </span>
                ) : null}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {rightTab === 'spirit' && (
              selectedSpirit && gameState.spirits[selectedSpirit] ? (
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
                  onChainOps={addChainOps}
                  chainInfo={chainInfo}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-3xl mb-3 opacity-40">⬡</div>
                  <p className="text-gray-400 text-sm">Select a spirit on the map</p>
                  <p className="text-gray-600 text-xs mt-1">Click any spirit to view stats and whisper commands</p>
                  {mySpirits.length > 0 && (
                    <div className="mt-4 space-y-1">
                      <div className="text-[10px] text-gray-500 font-mono">YOUR SWARM</div>
                      {mySpirits.map(s => (
                        <button key={s.id} onClick={() => { setSelectedSpirit(s.id); }}
                          className="flex items-center gap-2 text-xs text-gray-400 hover:text-amber-400 transition-colors px-2 py-1 rounded hover:bg-gray-800/40 w-full">
                          {s.avatarBlobId ? (
                            <img src={getAvatarUrl(s.avatarBlobId)} alt={s.name}
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0 border border-amber-500/40" />
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-amber-500/30 border border-amber-500/40 flex items-center justify-center text-[8px] text-amber-400 flex-shrink-0">
                              {s.name[0]}
                            </span>
                          )}
                          <span>{s.name}</span>
                          <span className="text-gray-600 text-[10px]">{s.specialization}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            )}

            {rightTab === 'chronicle' && (
              <CommandBar
                timers={gameState.activeTimers}
                events={events}
                spirits={mySpirits}
                gameState={gameState}
                chainOps={chainOps}
                chainInfo={chainInfo}
                mode="chronicle"
              />
            )}

            {rightTab === 'chain' && (
              <CommandBar
                timers={gameState.activeTimers}
                events={events}
                spirits={mySpirits}
                gameState={gameState}
                chainOps={chainOps}
                chainInfo={chainInfo}
                mode="chain"
              />
            )}
          </div>
        </div>
      </main>

      {/* Onboarding */}
      {showOnboarding && (
        <OnboardingHints
          gameState={gameState}
          selectedSpirit={selectedSpirit}
          onDismissAll={() => setShowOnboarding(false)}
        />
      )}
    </div>
  );
}
