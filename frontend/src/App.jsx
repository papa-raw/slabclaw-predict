import { useState, useEffect, useRef } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDevWallet } from './lib/devWallet.jsx';
import HexMap from './components/HexMap.jsx';
import CommandBar from './components/CommandBar.jsx';
import WalletConnect from './components/WalletConnect.jsx';
import PlayerHud from './components/PlayerHud.jsx';
import Lobby from './components/Lobby.jsx';
import SpiritPanel from './components/SpiritPanel.jsx';
import OnboardingHints from './components/OnboardingHints.jsx';
import OnchainFooter from './components/OnchainFooter.jsx';
import WhisperBar from './components/WhisperBar.jsx';
import Explorer from './components/Explorer.jsx';
import VFXTestPage from './components/VFXTestPage.jsx';
import MemoryBanner from './components/MemoryBanner.jsx';
import MemoryTimeline from './components/MemoryTimeline.jsx';
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
  if (window.location.pathname.startsWith('/explorer')) return <Explorer />;
  if (window.location.pathname.startsWith('/vfx-test')) return <VFXTestPage />;
  return <GameApp />;
}

function GameApp() {
  const account = useCurrentAccount();
  const devWallet = useDevWallet();
  const walletAddress = account?.address || devWallet.address;
  const [gameState, setGameState] = useState(null);
  const [claimedPlayerId, setClaimedPlayerId] = useState(null);
  const [selectedSpirit, setSelectedSpirit] = useState(null);
  const [events, setEvents] = useState([]);
  const [whisperTrails, setWhisperTrails] = useState([]);
  const [chainOps, setChainOps] = useState([]);
  const [chainInfo, setChainInfo] = useState(null);
  const [showOnboarding, setShowOnboarding] = useState(true);
  const [rightTab, setRightTab] = useState('memory');
  const [persistStatus, setPersistStatus] = useState('idle');
  const [persistResults, setPersistResults] = useState(null);
  const wsRef = useRef(null);
  const chainOpIdRef = useRef(0);

  useEffect(() => {
    fetch('/api/game/chain-info').then(r => r.json()).then(setChainInfo).catch(() => {});
  }, []);

  // Auto-persist swarm state when game finishes
  useEffect(() => {
    if (gameState?.status !== 'finished' || persistStatus !== 'idle') return;
    setPersistStatus('persisting');
    const pid = claimedPlayerId || getSessionPlayerId();
    fetch('/api/game/end-persist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId: pid }),
    })
      .then(r => r.json())
      .then(data => {
        setPersistResults(data);
        setPersistStatus('done');
      })
      .catch(() => setPersistStatus('error'));
  }, [gameState?.status, persistStatus, claimedPlayerId]);

  useEffect(() => {
    if (!walletAddress) { setClaimedPlayerId(null); return; }
    fetch('/api/game/claim-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walletAddress }),
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.playerId) setClaimedPlayerId(data.playerId); })
      .catch(() => {});
  }, [walletAddress]);

  function addChainOps(ops) {
    setChainOps(prev => {
      const tagged = ops.map(op => ({ ...op, id: `op-${++chainOpIdRef.current}` }));
      return [...prev, ...tagged].slice(-200);
    });
  }

  // WebSocket connection with reconnection
  useEffect(() => {
    const playerId = claimedPlayerId || getSessionPlayerId();
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
  }, [claimedPlayerId, walletAddress]);

  const isPaused = gameState?.status === 'paused';

  useEffect(() => {
    function handleKey(e) {
      if (e.code === 'Space' && !e.target.closest('input, textarea') && gameState) {
        e.preventDefault();
        const paused = gameState.status === 'paused';
        fetch(`/api/game/${paused ? 'resume' : 'pause'}`, { method: 'POST' });
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  });

  if (!gameState) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-6" style={{ background: 'var(--bg-abyss)' }}>
        <img src="/logo-icon.svg" alt="" className="w-16 h-16 opacity-60" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
        <div className="text-center">
          <h1 className="font-title text-2xl tracking-widest mb-3" style={{ color: 'var(--gold-bright)' }}>Anima Swarm</h1>
          <p className="text-sm font-body" style={{ color: 'var(--text-muted)' }}>Awakening the realm&hellip;</p>
        </div>
        <div className="w-48 h-1 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
          <div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, var(--gold-dim), var(--gold-bright))',
              animation: 'loading-bar 1.5s ease-in-out infinite',
            }}
          />
        </div>
        <style>{`
          @keyframes loading-bar {
            0% { width: 0%; margin-left: 0; }
            50% { width: 60%; margin-left: 20%; }
            100% { width: 0%; margin-left: 100%; }
          }
        `}</style>
      </div>
    );
  }

  const playerId = claimedPlayerId || getSessionPlayerId();
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId && s.alive);

  if (gameState.status === 'lobby') {
    return <Lobby playerId={playerId} gameState={gameState} chainInfo={chainInfo} />;
  }

  // Game over: show results — always, regardless of connection
  const myPlayer = gameState.players[playerId];

  // Player exited — show lobby so they can rejoin
  if (gameState.status === 'active' && myPlayer && !myPlayer.connected) {
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
    const allCaptains = Object.values(gameState.spirits).filter(s => s.tier === 'captain');
    const totalCaptainMemories = allCaptains.reduce((sum, c) => sum + (c.memoryLedger || []).length, 0);
    const captainsWithGrudges = allCaptains.filter(c => c.behaviorRules && Object.keys(c.behaviorRules.grudges || {}).length > 0).length;
    const captainsWithTrauma = allCaptains.filter(c => c.behaviorRules && (c.behaviorRules.traumaTerrain || []).length > 0).length;
    const captainsWithFears = allCaptains.filter(c => c.behaviorRules && Object.keys(c.behaviorRules.fears || {}).length > 0).length;

    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-abyss)' }}>
        <div className="text-center max-w-lg space-y-6">
          <h1
            className="font-title text-4xl tracking-widest"
            style={{ color: 'var(--gold-bright)', textShadow: isVictory ? '0 0 40px var(--gold-glow)' : 'none' }}
          >
            {isVictory ? 'Victory' : 'Defeat'}
          </h1>
          <p className="text-lg font-body" style={{ color: 'var(--text-secondary)' }}>
            {isVictory
              ? 'Your swarm dominates the world.'
              : `${winnerPlayer?.name || 'Another deity'}${winnerPlayer?.deityTitle ? ` ${winnerPlayer.deityTitle}` : ''} has conquered the realm.`}
          </p>

          <div className="rounded-lg p-4 text-left" style={{ background: 'var(--bg-surface)', border: '1px solid var(--gold-dim)' }}>
            <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: 'var(--text-muted)' }}>FINAL STANDINGS</div>
            {finalScores.map((p, i) => (
              <div
                key={p.id}
                className="flex items-center gap-3 py-1.5 text-sm font-mono"
                style={{ color: i === 0 ? 'var(--gold-bright)' : p.spirits === 0 ? 'var(--text-muted)' : 'var(--text-primary)' }}
              >
                <span className="w-4 text-right" style={{ color: 'var(--text-muted)' }}>{i + 1}.</span>
                <span className="flex-1">{p.name} {p.title && <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{p.title}</span>}</span>
                <span>{p.hexes}h</span>
                <span style={{ color: 'var(--text-muted)' }}>{p.pct}%</span>
                <span style={{ color: 'var(--text-muted)' }}>{p.spirits}s</span>
              </div>
            ))}
          </div>

          <div className="flex justify-center gap-6 text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
            <span>⚔ {totalBattles} battles</span>
            <span>✦ {totalSpawns} spawns</span>
            <span>☽ {totalDeaths} fallen</span>
          </div>

          {totalCaptainMemories > 0 && (
            <div className="rounded-lg p-3 text-left" style={{ background: 'rgba(45,212,191,0.05)', border: '1px solid rgba(45,212,191,0.2)' }}>
              <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: '#2dd4bf' }}>MEMORY LEDGER</div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Captain memories</span>
                  <span style={{ color: '#2dd4bf' }}>{totalCaptainMemories}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Grudges formed</span>
                  <span style={{ color: '#ef4444' }}>{captainsWithGrudges}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Terrain trauma</span>
                  <span style={{ color: '#fbbf24' }}>{captainsWithTrauma}</span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: 'var(--text-muted)' }}>Fears acquired</span>
                  <span style={{ color: '#a855f7' }}>{captainsWithFears}</span>
                </div>
              </div>
              <p className="text-xs mt-2 italic" style={{ color: 'var(--text-muted)' }}>
                These memories persist across games on Walrus — your captains will remember.
              </p>
            </div>
          )}

          <div className="rounded-lg p-3 text-center" style={{ background: 'var(--bg-surface)', border: '1px solid var(--gold-dim)' }}>
            {persistStatus === 'persisting' && (
              <p className="text-sm font-mono" style={{ color: 'var(--text-secondary)' }}>
                Persisting swarm to Walrus + Sui...
              </p>
            )}
            {persistStatus === 'done' && persistResults && (
              <div className="space-y-2">
                <p className="text-sm font-mono" style={{ color: 'var(--gold-bright)' }}>
                  Swarm persisted to Walrus
                </p>
                {persistResults.memoryBlobs?.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-mono" style={{ color: '#2dd4bf' }}>
                      {persistResults.memoryBlobs.length} captain memory ledgers stored on Walrus
                    </p>
                    {persistResults.memoryBlobs.map(blob => (
                      <div key={blob.spiritId} className="flex items-center justify-between text-xs px-2 py-0.5 rounded" style={{ background: 'rgba(45,212,191,0.08)' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>{blob.spiritName}</span>
                        <span className="font-mono" style={{ color: '#2dd4bf' }}>{blob.memoryCount} memories</span>
                        {blob.blobId && (
                          <a href={`https://walruscan.com/testnet/blob/${blob.blobId}`} target="_blank" rel="noopener noreferrer"
                            className="text-teal-500 hover:text-teal-300 transition-colors" style={{ fontSize: '9px' }}>
                            view on Walrus
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {persistResults.roster?.minted?.length || 0} minted, {persistResults.roster?.updated?.length || 0} updated
                  {persistResults.journal ? ' · Journal saved' : ''}
                  {persistResults.graveyard ? ` · ${persistResults.graveyard.added} ghost(s) added` : ''}
                </p>
              </div>
            )}
            {persistStatus === 'error' && (
              <p className="text-sm font-mono" style={{ color: '#ef4444' }}>
                Persist failed — your spirits are safe locally
              </p>
            )}
            {persistStatus === 'idle' && (
              <p className="text-sm font-mono" style={{ color: 'var(--text-muted)' }}>
                Preparing to save...
              </p>
            )}
          </div>

          <button
            onClick={() => {
              setPersistStatus('idle');
              setPersistResults(null);
              fetch('/api/game/restart', { method: 'POST' });
            }}
            className="font-mono text-sm px-4 py-2 rounded transition-colors"
            style={{ color: '#2dd4bf', border: '1px solid rgba(45,212,191,0.3)', background: 'rgba(45,212,191,0.08)' }}
          >
            Play Again — memories will auto-load from Walrus
          </button>
        </div>
      </div>
    );
  }

  function togglePause() {
    fetch(`/api/game/${isPaused ? 'resume' : 'pause'}`, { method: 'POST' });
  }

  function handleExit() {
    fetch('/api/game/exit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId }),
    });
  }

  function handleHexCommand(targetHexId) {
    fetch('/api/game/command', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ playerId, targetHexId }),
    })
      .then(r => r.json())
      .then(result => {
        if (result.events?.length) {
          setEvents(prev => [...prev.slice(-50), ...result.events]);
        }
      })
      .catch(() => {});
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-deep)' }}>
      {/* Pause overlay */}
      {isPaused && (
        <div
          className="absolute inset-0 z-50 flex items-center justify-center cursor-pointer"
          style={{ background: 'rgba(6,10,18,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={togglePause}
        >
          <div className="text-center">
            <h2 className="font-title text-3xl tracking-widest mb-3" style={{ color: 'var(--gold-bright)' }}>
              Paused
            </h2>
            <p className="font-mono text-sm" style={{ color: 'var(--text-muted)' }}>
              Press Space or click to resume
            </p>
          </div>
        </div>
      )}

      {/* Header */}
      <header className="h-12 bg-gray-900/80 backdrop-blur border-b border-gray-700/50 flex items-center justify-between px-4 relative z-30 overflow-visible">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-lg text-amber-500 font-semibold">Anima Swarm</h1>
          <button
            onClick={togglePause}
            className="px-2 py-1 rounded text-xs font-mono transition-colors"
            style={{
              color: isPaused ? 'var(--gold-bright)' : 'var(--text-muted)',
              background: isPaused ? 'rgba(212,160,82,0.15)' : 'transparent',
              border: `1px solid ${isPaused ? 'var(--gold-dim)' : 'transparent'}`,
            }}
            title="Space to toggle"
          >
            {isPaused ? '▶ Resume' : '⏸ Pause'}
          </button>
          {gameState._tickCount != null && (
            <span className="text-xs font-mono tabular-nums px-2 py-1 rounded" style={{
              color: gameState._tickCount > 80 ? '#ef4444' : '#2dd4bf',
              background: gameState._tickCount > 80 ? 'rgba(239,68,68,0.08)' : 'rgba(45,212,191,0.06)',
            }}>
              ⏱ {Math.max(0, Math.ceil((96 - gameState._tickCount) * 5 / 60))}:{String(Math.max(0, ((96 - gameState._tickCount) * 5) % 60)).padStart(2, '0')} left
            </span>
          )}
          <button
            onClick={handleExit}
            className="px-2 py-1 rounded text-xs font-mono transition-colors hover:text-red-400"
            style={{ color: 'var(--text-muted)' }}
            title="Return to lobby"
          >
            ↩ Exit
          </button>
        </div>
        <div className="flex items-center gap-4">
          {(() => {
            const allSpirits = Object.values(gameState.spirits);
            const memCount = allSpirits.reduce((sum, s) => sum + (s.memoryLedger?.length || 0), 0);
            const dramaticCount = events.filter(e => e.type === 'memory_event' && e.dramatic).length;
            return (
              <div className="flex items-center gap-2 px-2.5 py-1 rounded-md"
                style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.15)' }}>
                <span style={{ fontSize: 13 }}>🧠</span>
                <span className="text-xs font-mono tabular-nums" style={{ color: '#2dd4bf' }}>
                  {memCount}
                </span>
                <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>memories</span>
                {dramaticCount > 0 && (
                  <>
                    <span style={{ color: 'rgba(107,114,128,0.4)' }}>|</span>
                    <span className="text-xs font-mono tabular-nums" style={{ color: '#ef4444' }}>
                      {dramaticCount}
                    </span>
                    <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>dramatic</span>
                  </>
                )}
                <span style={{ color: 'rgba(107,114,128,0.4)' }}>|</span>
                <span className="text-[10px] font-mono" style={{ color: 'rgba(45,212,191,0.5)' }}>Walrus</span>
              </div>
            );
          })()}
          <PlayerHud player={gameState.players[playerId]} spirits={mySpirits} gameState={gameState} />
          <WalletConnect />
        </div>
      </header>

      {/* Main: Map left, Panel right */}
      <main className="flex-1 flex overflow-hidden">
        {/* Hex Map — 70% left */}
        <div className="flex-1 relative min-w-0">
          <MemoryBanner events={events} />
          <HexMap
            hexes={gameState.map.hexes}
            spirits={gameState.spirits}
            playerId={playerId}
            selectedSpirit={selectedSpirit}
            onSelectSpirit={(id) => { setSelectedSpirit(id); if (id) setRightTab('spirit'); }}
            onHexCommand={handleHexCommand}
            gameState={gameState}
            whisperTrails={whisperTrails}
            events={events}
          />
        </div>

        {/* Right Panel — tabbed: Spirit | Chronicle | Chain */}
        <div className="w-[360px] border-l border-gray-700/50 bg-gray-900/60 backdrop-blur flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-gray-700/40 flex-shrink-0">
            {(() => {
              const dramaticCount = events.filter(e => e.type === 'memory_event' && e.dramatic).length;
              return [
                { id: 'spirit', label: 'Spirit' },
                { id: 'memory', label: 'Memory', badge: dramaticCount || null, badgeColor: 'teal' },
                { id: 'chronicle', label: 'Chronicle' },
                { id: 'chain', label: 'Onchain', badge: chainOps.length || null },
              ];
            })().map(tab => (
              <button key={tab.id} onClick={() => setRightTab(tab.id)}
                className={`flex-1 py-2 text-xs font-mono tracking-wider transition-colors
                  ${rightTab === tab.id
                    ? 'text-amber-400 border-b-2 border-amber-400 bg-gray-800/30'
                    : 'hover:text-gray-200'}`}
                style={rightTab !== tab.id ? { color: 'var(--text-secondary)' } : undefined}>
                {tab.label}
                {tab.badge ? (
                  <span className="ml-1 text-xs px-1 py-px rounded-full bg-teal-900/60 text-teal-400 border border-teal-700/30">
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
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                  <div className="text-3xl mb-3 opacity-40">⬡</div>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>Select a spirit on the map</p>
                  <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Click any spirit to view stats and whisper commands</p>
                  {mySpirits.length > 0 && (
                    <div className="mt-4 w-full">
                      <div className="text-xs font-mono mb-1" style={{ color: 'var(--text-muted)' }}>YOUR SWARM</div>
                      <div className="grid grid-cols-2 gap-0.5">
                        {mySpirits.map(s => (
                          <button key={s.id} onClick={() => { setSelectedSpirit(s.id); }}
                            className="flex items-center gap-1.5 text-xs hover:text-amber-400 transition-colors px-1.5 py-1 rounded hover:bg-gray-800/40"
                            style={{ color: 'var(--text-secondary)' }}>
                            {s.avatarBlobId ? (
                              <img src={getAvatarUrl(s.avatarBlobId)} alt={s.name}
                                className="w-4 h-4 rounded-full object-cover flex-shrink-0 border border-amber-500/40" />
                            ) : (
                              <span className="w-4 h-4 rounded-full bg-amber-500/30 border border-amber-500/40 flex items-center justify-center text-[7px] text-amber-400 flex-shrink-0">
                                {s.name[0]}
                              </span>
                            )}
                            <span className="truncate">{s.name}</span>
                            <span className="text-[10px] flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{s.specialization}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            )}

            {rightTab === 'memory' && (
              <MemoryTimeline
                events={events}
                gameState={gameState}
                playerId={playerId}
              />
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

      <WhisperBar playerId={playerId} gameState={gameState} />
      <OnchainFooter chainInfo={chainInfo} />

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
