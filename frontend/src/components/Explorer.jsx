import { useState, useEffect, useRef, useCallback } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { useDevWallet } from '../lib/devWallet.jsx';
import WalletConnect from './WalletConnect.jsx';
import OnchainFooter from './OnchainFooter.jsx';
import { getAvatarUrl } from '@lib/avatarUrl.js';

const SPEC_COLORS = { warrior: '#dc2626', scout: '#2563eb', gatherer: '#16a34a', sage: '#9333ea', generalist: '#6b7280' };
const SPEC_ICONS = { warrior: '⚔', scout: '⌖', gatherer: '◈', sage: '✦', generalist: '◉' };
const ARCHETYPE_COLORS = {
  Warlord: '#dc2626', Shepherd: '#22c55e', Sage: '#8b5cf6',
  Tyrant: '#ef4444', Phoenix: '#f97316', Wanderer: '#3b82f6', Balanced: '#d4a052',
};
const CATEGORY_META = {
  deity:    { label: 'Deity',   icon: '👁', color: '#d4a052' },
  dialog:   { label: 'Dialog',  icon: '💬', color: '#60a5fa' },
  battle:   { label: 'Battle',  icon: '⚔',  color: '#f87171' },
  enemy:    { label: 'Enemy',   icon: '🐍', color: '#fb923c' },
  response: { label: 'Thought', icon: '✦',  color: '#2dd4bf' },
  other:    { label: 'Other',   icon: '◦',  color: '#9ca3af' },
};
const MEM_PER_PAGE = 8;

function specColor(s) { return SPEC_COLORS[s] || SPEC_COLORS.generalist; }
function specIcon(s) { return SPEC_ICONS[s] || '◉'; }
function bondAvg(b) { return b ? Math.round(((b.depth||0)+(b.harmony||0)+(b.adventure||0)+(b.loyalty||0))/4) : 0; }
function ago(ts) { if (!ts) return ''; const s = Math.floor((Date.now()-ts)/1000); if (s<60) return s+'s ago'; if (s<3600) return Math.floor(s/60)+'m ago'; return Math.floor(s/3600)+'h ago'; }
function categorizeMem(text) {
  if (text.startsWith('[DEITY')) return 'deity';
  if (text.startsWith('[DIALOG')) return 'dialog';
  if (text.startsWith('[BATTLE')) return 'battle';
  if (text.startsWith('[ENEMY')) return 'enemy';
  if (text.startsWith('[RESPONSE')) return 'response';
  return 'other';
}
function extractEffects(text, cat) {
  const effects = [];
  if (cat === 'deity') {
    effects.push({ label: 'depth +', color: '#8b5cf6' });
    if (/loyalty|trust/i.test(text)) effects.push({ label: 'loyalty +', color: '#3b82f6' });
  } else if (cat === 'dialog') {
    if (text.includes('ALLY_CHAT')) effects.push({ label: 'harmony +', color: '#22c55e' });
    if (text.includes('TAUNT')) effects.push({ label: 'adventure +', color: '#f97316' });
  } else if (cat === 'battle') {
    effects.push({ label: 'personality shift', color: '#ef4444' });
    if (text.includes('wins')) effects.push({ label: 'adventure +', color: '#f97316' });
    if (/died|Loser died/.test(text)) effects.push({ label: 'death', color: '#dc2626' });
  } else if (cat === 'enemy') {
    effects.push({ label: 'loyalty −', color: '#ef4444' });
    effects.push({ label: 'resistance −', color: '#f97316' });
  } else if (cat === 'response') {
    effects.push({ label: 'personality growth', color: '#2dd4bf' });
  }
  return effects;
}

function BondRing({ label, value, color }) {
  const r = 22, stroke = 4, circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  return (
    <div style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg-elevated)', borderRadius: 8 }}>
      <div style={{ width: 56, height: 56, margin: '0 auto 6px', position: 'relative' }}>
        <svg width="56" height="56" viewBox="0 0 56 56" style={{ position: 'absolute', top: 0, left: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="28" cy="28" r={r} fill="none" stroke="var(--bg-deep)" strokeWidth={stroke} />
          <circle cx="28" cy="28" r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" />
        </svg>
        <span style={{ position: 'absolute', top: 0, left: 0, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 600, color }}>{value}</span>
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
    </div>
  );
}

export default function Explorer() {
  const account = useCurrentAccount();
  const devWallet = useDevWallet();
  const walletAddress = account?.address || devWallet.address;

  const [gameState, setGameState] = useState(null);
  const [graveyard, setGraveyard] = useState([]);
  const [chainInfo, setChainInfo] = useState(null);
  const [tab, setTab] = useState('spirits');
  const [selected, setSelected] = useState({ type: null, id: null });
  const wsRef = useRef(null);

  // WebSocket for real-time state
  useEffect(() => {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws`);
    wsRef.current = ws;
    ws.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === 'tick' || msg.type === 'state_change') {
          setGameState(msg.state);
        }
      } catch {}
    };
    ws.onclose = () => {
      setTimeout(() => {
        const reconnect = new WebSocket(`${proto}//${window.location.host}/ws`);
        wsRef.current = reconnect;
        reconnect.onmessage = ws.onmessage;
      }, 3000);
    };
    return () => ws.close();
  }, []);

  // Initial state fetch + polling fallback
  useEffect(() => {
    fetch('/api/game/state').then(r => r.ok ? r.json() : null).then(s => { if (s) setGameState(s); }).catch(() => {});
    fetch('/api/game/chain-info').then(r => r.json()).then(setChainInfo).catch(() => {});
    const interval = setInterval(() => {
      fetch('/api/game/state').then(r => r.ok ? r.json() : null).then(s => { if (s) setGameState(s); }).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Load graveyard
  useEffect(() => {
    function loadGhosts() {
      fetch('/api/game/graveyard').then(r => r.json()).then(data => setGraveyard(data.ghosts || data || [])).catch(() => {});
    }
    loadGhosts();
    const interval = setInterval(loadGhosts, 10000);
    return () => clearInterval(interval);
  }, []);

  const spirits = gameState ? Object.values(gameState.spirits || {}).sort((a, b) => (a.playerId || '').localeCompare(b.playerId || '') || a.name.localeCompare(b.name)) : [];
  const deities = gameState ? Object.entries(gameState.players || {}).filter(([, p]) => p.walletAddress) : [];

  function selectItem(type, id) {
    setSelected({ type, id });
  }

  const TABS = [
    { id: 'spirits', label: 'Spirits', count: spirits.length },
    { id: 'ghosts', label: '☽ Ghosts', count: graveyard.length },
    { id: 'deities', label: 'Deities', count: deities.length },
    { id: 'essence', label: 'Essence' },
  ];

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--bg-abyss)' }}>
      {/* Background atmosphere */}
      <div className="absolute inset-0 pointer-events-none">
        <img src="/images/landing/hero-volcanic.png" alt="" className="w-full h-full object-cover" style={{ opacity: 0.06 }} />
        <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(6,10,18,0.95) 0%, rgba(6,10,18,0.6) 40%, rgba(6,10,18,0.9) 100%)' }} />
      </div>

      {/* Navbar */}
      <nav className="relative z-20 flex items-center gap-4 px-6 py-3 flex-shrink-0" style={{ background: 'rgba(6,10,18,0.85)', backdropFilter: 'blur(12px)', borderBottom: '1px solid var(--gold-dim)' }}>
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <img src="/logo-icon.svg" alt="Anima Swarm" className="w-7 h-7" />
          <span className="font-title text-sm tracking-widest" style={{ color: 'var(--gold-bright)' }}>Anima Swarm</span>
        </a>
        <span className="font-mono text-xs px-2 py-0.5 rounded" style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>Explorer</span>
        <div className="flex-1" />
        <a href="/" className="font-mono text-xs transition-colors hover:text-amber-400" style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}>Play</a>
        <div className="h-4 w-px" style={{ background: 'var(--gold-dim)' }} />
        <WalletConnect />
      </nav>

      {/* Main two-column layout */}
      <div className="relative z-10 flex flex-1 overflow-hidden" style={{ minHeight: 0 }}>
        {/* LEFT SIDEBAR */}
        <div className="flex flex-col flex-shrink-0" style={{ width: 340, borderRight: '1px solid var(--gold-dim)', background: 'rgba(13,17,23,0.9)' }}>
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--gold-dim)' }}>
            <h1 className="font-header" style={{ fontSize: '1.3rem', color: 'var(--gold-bright)', marginBottom: 2 }}>Memory Explorer</h1>
            <div className="font-body text-xs italic" style={{ color: 'var(--text-muted)' }}>Browse spirits, ghosts, deities — verify onchain</div>
          </div>

          {/* Tabs */}
          <div className="flex flex-shrink-0" style={{ borderBottom: '1px solid var(--gold-dim)' }}>
            {TABS.map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className="flex-1 py-2 text-center font-mono transition-colors"
                style={{
                  fontSize: 11,
                  color: tab === t.id ? 'var(--gold-bright)' : 'var(--text-muted)',
                  background: 'none', border: 'none',
                  borderBottom: `2px solid ${tab === t.id ? 'var(--gold-bright)' : 'transparent'}`,
                  cursor: 'pointer',
                }}
              >
                {t.label}{t.count != null ? ` (${t.count})` : ''}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto" style={{ padding: 8 }}>
            {tab === 'spirits' && <SpiritList spirits={spirits} gameState={gameState} selected={selected} onSelect={id => selectItem('spirit', id)} />}
            {tab === 'ghosts' && <GhostList ghosts={graveyard} selected={selected} onSelect={id => selectItem('ghost', id)} />}
            {tab === 'deities' && <DeityList deities={deities} gameState={gameState} selected={selected} onSelect={id => selectItem('deity', id)} />}
            {tab === 'essence' && <EssenceInput onEssenceLoaded={(e) => { selectItem('essence', e._blobId); }} />}
          </div>
        </div>

        {/* RIGHT DETAIL PANEL */}
        <div className="flex-1 overflow-y-auto" style={{ minWidth: 0 }}>
          <div style={{ padding: '24px 32px 64px', maxWidth: 720 }}>
            <DetailPanel selected={selected} gameState={gameState} graveyard={graveyard} />
          </div>
        </div>
      </div>

      <div className="relative z-10"><OnchainFooter chainInfo={chainInfo} /></div>
    </div>
  );
}

// ─── Spirit List ────────────────────────────────────────────────────────
function SpiritList({ spirits, gameState, selected, onSelect }) {
  if (!spirits.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        <h3 className="font-header" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 6 }}>No active game</h3>
        <p style={{ fontSize: 13 }}>Start a game at <a href="/" style={{ color: 'var(--spirit)' }}>the lobby</a></p>
      </div>
    );
  }
  return spirits.map(s => {
    const sc = specColor(s.specialization);
    const si = specIcon(s.specialization);
    const player = gameState?.players?.[s.playerId];
    const deityName = player ? player.name : s.playerId;
    const isActive = selected.type === 'spirit' && selected.id === s.id;
    const url = s.avatarBlobId ? getAvatarUrl(s.avatarBlobId) : null;
    return (
      <div
        key={s.id}
        onClick={() => onSelect(s.id)}
        className="rounded-lg cursor-pointer transition-colors"
        style={{
          background: isActive ? 'rgba(212,160,82,0.06)' : 'var(--bg-elevated)',
          border: `1px solid ${isActive ? 'var(--gold-bright)' : 'transparent'}`,
          padding: 12, marginBottom: 6, opacity: s.alive ? 1 : 0.55,
        }}
      >
        <div className="flex items-center gap-2.5">
          {url ? (
            <img src={url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${sc}` }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center font-header text-sm flex-shrink-0" style={{ background: `${sc}20`, color: sc, border: `2px solid ${sc}60` }}>{si}</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="font-header text-sm" style={{ color: 'var(--text-primary)', lineHeight: 1.2 }}>{s.name}</div>
            <div className="font-mono flex items-center gap-1" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: sc }}>{si}</span>
              <span style={{ color: sc }}>{s.specialization || 'generalist'}</span>
              <span>&middot;</span>
              <span>{deityName}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="font-mono rounded-full px-1.5" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: s.alive ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', color: s.alive ? '#4ade80' : '#ef4444', border: `1px solid ${s.alive ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>{s.alive ? 'ALIVE' : 'DEAD'}</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>MEM {s.memoryCount || 0}</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>BOND {bondAvg(s.bond)}</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>{s.kills || 0}/{(s.reincarnationCount || 0) + (s.alive ? 0 : 1)} K/D</span>
        </div>
      </div>
    );
  });
}

// ─── Ghost List ─────────────────────────────────────────────────────────
function GhostList({ ghosts, selected, onSelect }) {
  if (!ghosts.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        <h3 className="font-header" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 6 }}>No ghosts yet</h3>
        <p style={{ fontSize: 13 }}>Play a game — fallen spirits become ghosts</p>
      </div>
    );
  }
  return ghosts.map(g => {
    const sc = specColor(g.specialization);
    const si = specIcon(g.specialization);
    const gid = g.id || g.spiritNftId || g.spiritId;
    const isActive = selected.type === 'ghost' && selected.id === gid;
    const url = g.avatarBlobId ? getAvatarUrl(g.avatarBlobId) : null;
    return (
      <div
        key={gid}
        onClick={() => onSelect(gid)}
        className="rounded-lg cursor-pointer transition-colors"
        style={{
          background: isActive ? 'rgba(168,85,247,0.06)' : 'var(--bg-elevated)',
          border: `1px solid ${isActive ? '#a855f7' : 'transparent'}`,
          padding: 12, marginBottom: 6, opacity: isActive ? 1 : 0.75,
        }}
      >
        <div className="flex items-center gap-2.5">
          {url ? (
            <img src={url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${sc}`, opacity: 0.7 }} />
          ) : (
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm flex-shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '2px solid rgba(168,85,247,0.4)' }}>☽</div>
          )}
          <div style={{ minWidth: 0 }}>
            <div className="font-header text-sm" style={{ color: '#c084fc', lineHeight: 1.2 }}>{g.name}</div>
            <div className="font-mono flex items-center gap-1" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span style={{ color: sc }}>{si}</span>
              <span style={{ color: sc }}>{g.specialization || 'unknown'}</span>
              <span>&middot;</span>
              <span>{g.lastDeityName || 'unknown deity'}</span>
            </div>
          </div>
        </div>
        {g.memorableQuote && (
          <div className="font-body italic mt-1.5" style={{ fontSize: 12, color: 'rgba(192,132,252,0.7)', lineHeight: 1.4 }}>
            &ldquo;{g.memorableQuote.length > 80 ? g.memorableQuote.slice(0, 80) + '...' : g.memorableQuote}&rdquo;
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="font-mono rounded-full" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>GHOST</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>Loyalty {g.pastLifeLoyalty ?? '?'}</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>{g.kills || 0} kills</span>
        </div>
      </div>
    );
  });
}

// ─── Deity List ─────────────────────────────────────────────────────────
function DeityList({ deities, gameState, selected, onSelect }) {
  if (!deities.length) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        <h3 className="font-header" style={{ fontSize: '1rem', color: 'var(--text-secondary)', marginBottom: 6 }}>No deities</h3>
        <p style={{ fontSize: 13 }}>Deities appear when players join a game</p>
      </div>
    );
  }
  return deities.map(([pid, p]) => {
    const isActive = selected.type === 'deity' && selected.id === pid;
    const spiritCount = Object.values(gameState?.spirits || {}).filter(s => s.playerId === pid).length;
    const aliveCount = Object.values(gameState?.spirits || {}).filter(s => s.playerId === pid && s.alive).length;
    const hexCount = Object.values(gameState?.hexes || {}).filter(h => h.owner === pid).length;
    return (
      <div
        key={pid}
        onClick={() => onSelect(pid)}
        className="rounded-lg cursor-pointer transition-colors"
        style={{
          background: isActive ? 'rgba(212,160,82,0.06)' : 'var(--bg-elevated)',
          border: `1px solid ${isActive ? 'var(--gold-bright)' : 'transparent'}`,
          padding: 12, marginBottom: 6,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-full flex items-center justify-center text-base flex-shrink-0" style={{ background: 'rgba(212,160,82,0.12)', color: 'var(--gold-bright)', border: '2px solid rgba(212,160,82,0.3)' }}>👁</div>
          <div style={{ minWidth: 0 }}>
            <div className="font-header text-sm" style={{ color: 'var(--gold-bright)', lineHeight: 1.2 }}>{p.name || pid}</div>
            <div className="font-mono flex items-center gap-1" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              <span>{aliveCount}/{spiritCount} spirits</span>
              <span>&middot;</span>
              <span style={{ color: p.connected ? '#4ade80' : '#ef4444' }}>{p.connected ? 'online' : 'offline'}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-1 mt-1.5">
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>Hex {hexCount}</span>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-secondary)', background: 'var(--bg-deep)', padding: '1px 6px', borderRadius: 4 }}>{p.walletAddress?.slice(0, 8)}...</span>
        </div>
      </div>
    );
  });
}

// ─── Essence Input ──────────────────────────────────────────────────────
function EssenceInput({ onEssenceLoaded }) {
  const [blobId, setBlobId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [essence, setEssence] = useState(null);

  async function fetchEssence() {
    if (!blobId.trim()) { setError('Enter a blob ID.'); return; }
    setError(''); setLoading(true);
    try {
      const r = await fetch('/api/essence/import', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blobId: blobId.trim() }),
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.error || 'Import failed'); }
      const { essence: data } = await r.json();
      if (!data) throw new Error('No essence data');
      data._blobId = blobId.trim();
      setEssence(data);
      onEssenceLoaded(data);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  return (
    <div>
      <div style={{ padding: '12px 4px' }}>
        <input
          type="text" value={blobId} onChange={e => setBlobId(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') fetchEssence(); }}
          placeholder="Walrus blob ID..."
          className="w-full font-mono text-xs rounded-md px-2.5 py-2 mb-2 focus:outline-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)', color: 'var(--text-primary)' }}
        />
        <button onClick={fetchEssence} disabled={loading} className="w-full font-mono text-xs font-semibold rounded-md py-2" style={{ background: 'var(--gold-bright)', color: 'var(--bg-deep)', border: 'none', cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
          {loading ? 'Loading...' : 'Inspect Essence'}
        </button>
      </div>
      {error && <p className="font-mono text-xs" style={{ color: '#ef4444', padding: '0 4px' }}>{error}</p>}
      <p className="font-body text-xs italic" style={{ color: 'var(--text-muted)', padding: '4px 4px', lineHeight: 1.4 }}>
        Paste an exported swarm essence blob ID to inspect deity stats, spirit legacies, and game history stored on Walrus.
      </p>
      {essence?.spiritLegacies?.map((s, i) => {
        const sc = specColor(s.specialization);
        const si = specIcon(s.specialization);
        const url = s.avatarBlobId ? getAvatarUrl(s.avatarBlobId) : null;
        return (
          <div key={i} onClick={() => onEssenceLoaded({ ...essence, _selectedLegacy: i })} className="rounded-lg cursor-pointer transition-colors" style={{ background: 'var(--bg-elevated)', padding: 10, margin: '4px 4px', border: '1px solid transparent' }}>
            <div className="flex items-center gap-2.5">
              {url ? <img src={url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${sc}` }} />
                : <div className="w-9 h-9 rounded-full flex items-center justify-center font-header text-sm flex-shrink-0" style={{ background: `${sc}20`, color: sc, border: `2px solid ${sc}60` }}>{si}</div>}
              <div>
                <div className="font-header text-sm" style={{ color: 'var(--text-primary)' }}>{s.name}</div>
                <div className="font-mono" style={{ fontSize: 11, color: sc }}>{si} {s.specialization || 'generalist'}</div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Detail Panel ───────────────────────────────────────────────────────
function DetailPanel({ selected, gameState, graveyard }) {
  if (!selected.type || !selected.id) {
    return (
      <div className="flex items-center justify-center" style={{ height: 300, color: 'var(--text-muted)', fontStyle: 'italic', fontSize: 14 }}>
        Select a spirit, ghost, or deity to view details
      </div>
    );
  }
  if (selected.type === 'spirit') return <SpiritDetail id={selected.id} gameState={gameState} />;
  if (selected.type === 'ghost') return <GhostDetail id={selected.id} graveyard={graveyard} />;
  if (selected.type === 'deity') return <DeityDetail id={selected.id} gameState={gameState} />;
  return null;
}

// ─── Spirit Detail ──────────────────────────────────────────────────────
function SpiritDetail({ id, gameState }) {
  const [memories, setMemories] = useState([]);
  const [memFilter, setMemFilter] = useState('all');
  const [memPage, setMemPage] = useState(0);
  const [memLoading, setMemLoading] = useState(true);

  const s = gameState?.spirits?.[id];

  useEffect(() => {
    if (!id) return;
    setMemLoading(true); setMemFilter('all'); setMemPage(0);
    fetch(`/api/game/spirit/${encodeURIComponent(id)}/memories`)
      .then(r => r.ok ? r.json() : { memories: [] })
      .then(data => {
        const mems = (data.memories || []).map(m => {
          const text = m.text || m.content || m.memory || JSON.stringify(m);
          return { ...m, text, cat: categorizeMem(text) };
        });
        setMemories(mems);
      })
      .catch(() => setMemories([]))
      .finally(() => setMemLoading(false));
  }, [id]);

  if (!s) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Spirit not found</div>;

  const sc = specColor(s.specialization);
  const si = specIcon(s.specialization);
  const player = gameState?.players?.[s.playerId];
  const deityName = player ? player.name : s.playerId;
  const url = s.avatarBlobId ? getAvatarUrl(s.avatarBlobId) : null;
  const deaths = (s.reincarnationCount || 0) + (s.alive ? 0 : 1);
  const b = s.bond || {};
  const pastNames = (s.previousNames || []).filter(n => n !== s.name);

  const filtered = memFilter === 'all' ? memories : memories.filter(m => m.cat === memFilter);
  const totalPages = Math.max(1, Math.ceil(filtered.length / MEM_PER_PAGE));
  const page = filtered.slice(memPage * MEM_PER_PAGE, (memPage + 1) * MEM_PER_PAGE);
  const counts = { all: memories.length };
  memories.forEach(m => { counts[m.cat] = (counts[m.cat] || 0) + 1; });

  return (
    <>
      {/* Identity header */}
      <div className="flex items-center gap-3.5 mb-3.5">
        {url ? (
          <img src={url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${sc}` }} />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: `${sc}15`, color: sc, border: `2px solid ${sc}50` }}>{si}</div>
        )}
        <div>
          <div className="font-header flex items-center gap-2 flex-wrap" style={{ fontSize: '1.2rem', color: 'var(--gold-bright)' }}>
            {s.name}
            <span className="font-mono flex items-center gap-1 rounded-full" style={{ fontSize: 11, padding: '2px 8px', background: `${sc}15`, color: sc, border: `1px solid ${sc}30` }}>{si} {s.specialization || 'generalist'}</span>
            <span className="font-mono rounded-full" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: s.alive ? 'rgba(74,222,128,0.1)' : 'rgba(239,68,68,0.1)', color: s.alive ? '#4ade80' : '#ef4444', border: `1px solid ${s.alive ? 'rgba(74,222,128,0.2)' : 'rgba(239,68,68,0.2)'}` }}>{s.alive ? 'ALIVE' : 'DEAD'}</span>
          </div>
          <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {deityName}&rsquo;s swarm &middot; Gen {s.generation || 0}
            {s.reincarnationCount > 0 && <span style={{ color: '#a78bfa' }}> &middot; ✦ {s.reincarnationCount}x reborn</span>}
            &middot; {s.memoryCount || 0} memories &middot; {s.kills || 0}/{deaths} K/D
          </div>
          {s.personality && <div className="font-body italic" style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2, maxWidth: 400, lineHeight: 1.4 }}>{s.personality.slice(0, 120)}{s.personality.length > 120 ? '...' : ''}</div>}
        </div>
      </div>

      {/* Bond rings */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <BondRing label="Depth" value={b.depth || 0} color="#8b5cf6" />
        <BondRing label="Harmony" value={b.harmony || 0} color="#22c55e" />
        <BondRing label="Adventure" value={b.adventure || 0} color="#f97316" />
        <BondRing label="Loyalty" value={b.loyalty || 0} color="#3b82f6" />
      </div>

      {/* Lineage */}
      <div className="mb-4">
        <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Lineage</div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {pastNames.map((n, i) => (
            <span key={i} className="flex items-center gap-1.5">
              <span className="font-mono rounded-md px-3 py-1.5" style={{ fontSize: 12, background: 'var(--bg-elevated)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.2)' }}>
                {n} <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>Gen {i}</span>
              </span>
              <span style={{ color: 'var(--text-muted)', fontSize: 14 }}>&rarr;</span>
            </span>
          ))}
          <span className="font-mono rounded-md px-3 py-1.5" style={{ fontSize: 12, background: 'var(--bg-elevated)', color: sc, border: `1px solid ${sc}40` }}>
            {si} {s.name} <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 4 }}>Gen {s.generation || 0} {pastNames.length === 0 ? '(first life)' : '(current)'}</span>
          </span>
        </div>
      </div>

      {/* Onchain verification */}
      {(s.memwalAccountId || s.avatarBlobId) && (
        <div className="mb-4">
          <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--spirit)' }}>Onchain Verification</div>
          <div className="rounded-lg p-2.5" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(45,212,191,0.12)' }}>
            {s.memwalAccountId && (
              <div className="my-0.5"><a href={`https://suiscan.xyz/testnet/object/${s.memwalAccountId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs" style={{ color: 'var(--spirit)', textDecoration: 'none' }}>MemWal Account on SuiScan &rarr;</a></div>
            )}
            {s.avatarBlobId && (
              <div className="my-0.5"><a href={`https://walruscan.com/testnet/blob/${s.avatarBlobId}`} target="_blank" rel="noopener noreferrer" className="font-mono text-xs" style={{ color: 'var(--spirit)', textDecoration: 'none' }}>Avatar Blob on WalrusScan &rarr;</a></div>
            )}
            {s.memwalNamespace && <div className="font-mono mt-1" style={{ fontSize: 11, color: 'var(--text-muted)' }}>namespace: {s.memwalNamespace}</div>}
          </div>
        </div>
      )}

      {/* Memories */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="font-mono uppercase tracking-wider" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Memories on MemWal</div>
          <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>{s.memoryCount || 0} stored</span>
        </div>

        {/* Category filters */}
        <div className="flex flex-wrap gap-1.5 mb-2.5">
          <button onClick={() => { setMemFilter('all'); setMemPage(0); }} className="font-mono rounded-full cursor-pointer transition-colors" style={{ fontSize: 10, padding: '3px 8px', background: memFilter === 'all' ? 'var(--bg-elevated)' : 'var(--bg-deep)', color: memFilter === 'all' ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${memFilter === 'all' ? 'var(--gold-dim)' : 'transparent'}`, textTransform: 'uppercase', letterSpacing: '0.03em' }}>All ({counts.all})</button>
          {Object.entries(CATEGORY_META).map(([cat, meta]) => counts[cat] ? (
            <button key={cat} onClick={() => { setMemFilter(cat); setMemPage(0); }} className="font-mono rounded-full cursor-pointer transition-colors" style={{ fontSize: 10, padding: '3px 8px', background: memFilter === cat ? 'var(--bg-elevated)' : 'var(--bg-deep)', color: memFilter === cat ? 'var(--text-primary)' : 'var(--text-muted)', border: `1px solid ${memFilter === cat ? 'var(--gold-dim)' : 'transparent'}`, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{meta.icon} {meta.label} ({counts[cat]})</button>
          ) : null)}
        </div>

        {memLoading ? (
          <div className="font-mono italic text-xs" style={{ color: 'var(--text-muted)', padding: '12px 0' }}>Loading memories from Walrus...</div>
        ) : filtered.length === 0 ? (
          <div className="font-mono italic text-xs" style={{ color: 'var(--text-muted)', padding: '12px 0' }}>No memories{memFilter !== 'all' ? ' in this category' : ' stored yet'}.</div>
        ) : (
          <>
            {page.map((m, i) => {
              const meta = CATEGORY_META[m.cat];
              const effects = extractEffects(m.text, m.cat);
              const cleanText = m.text.replace(/^\[[^\]]*\]\s*/, '');
              return (
                <div key={i} className="rounded-lg mb-2.5 relative overflow-hidden" style={{ background: 'var(--bg-elevated)', padding: '12px 14px', border: '1px solid transparent' }}>
                  <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, borderRadius: '3px 0 0 3px', background: meta.color }} />
                  <div className="font-mono inline-flex items-center gap-1 rounded mb-1.5" style={{ fontSize: 10, padding: '1px 7px', textTransform: 'uppercase', letterSpacing: '0.04em', background: `${meta.color}15`, color: meta.color }}>{meta.icon} {meta.label}</div>
                  <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{cleanText}</div>
                  <div className="flex items-center gap-2 flex-wrap mt-1.5">
                    {effects.map((e, j) => (
                      <span key={j} className="font-mono inline-flex items-center gap-1 rounded-full" style={{ fontSize: 10, padding: '2px 7px', background: `${e.color}15`, color: e.color, border: `1px solid ${e.color}30` }}>{e.label}</span>
                    ))}
                    {m.score && <span className="font-mono" style={{ fontSize: 10, color: 'var(--text-muted)' }}>relevance {Math.round(m.score * 100)}%</span>}
                  </div>
                </div>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1.5 mt-3">
                <button onClick={() => setMemPage(0)} disabled={memPage === 0} className="font-mono rounded cursor-pointer" style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)', color: 'var(--text-secondary)', opacity: memPage === 0 ? 0.3 : 1 }}>&laquo;</button>
                <button onClick={() => setMemPage(p => p - 1)} disabled={memPage === 0} className="font-mono rounded cursor-pointer" style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)', color: 'var(--text-secondary)', opacity: memPage === 0 ? 0.3 : 1 }}>&lsaquo;</button>
                <span className="font-mono" style={{ fontSize: 11, color: 'var(--text-muted)' }}>{memPage + 1} / {totalPages}</span>
                <button onClick={() => setMemPage(p => p + 1)} disabled={memPage >= totalPages - 1} className="font-mono rounded cursor-pointer" style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)', color: 'var(--text-secondary)', opacity: memPage >= totalPages - 1 ? 0.3 : 1 }}>&rsaquo;</button>
                <button onClick={() => setMemPage(totalPages - 1)} disabled={memPage >= totalPages - 1} className="font-mono rounded cursor-pointer" style={{ fontSize: 11, padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)', color: 'var(--text-secondary)', opacity: memPage >= totalPages - 1 ? 0.3 : 1 }}>&raquo;</button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Ghost Detail ───────────────────────────────────────────────────────
function GhostDetail({ id, graveyard }) {
  const g = graveyard.find(gh => (gh.id || gh.spiritNftId || gh.spiritId) === id);
  if (!g) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Ghost not found</div>;

  const sc = specColor(g.specialization);
  const si = specIcon(g.specialization);
  const url = g.avatarBlobId ? getAvatarUrl(g.avatarBlobId) : null;
  const b = g.bond || {};

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-3.5">
        {url ? (
          <img src={url} alt="" className="w-14 h-14 rounded-full object-cover flex-shrink-0" style={{ border: `2px solid ${sc}`, opacity: 0.7 }} />
        ) : (
          <div className="w-14 h-14 rounded-full flex items-center justify-center text-2xl flex-shrink-0" style={{ background: 'rgba(168,85,247,0.15)', color: '#a855f7', border: '2px solid rgba(168,85,247,0.4)' }}>☽</div>
        )}
        <div>
          <div className="font-header flex items-center gap-2 flex-wrap" style={{ fontSize: '1.2rem', color: '#c084fc' }}>
            {g.name}
            <span className="font-mono flex items-center gap-1 rounded-full" style={{ fontSize: 11, padding: '2px 8px', background: `${sc}15`, color: sc, border: `1px solid ${sc}30` }}>{si} {g.specialization || 'unknown'}</span>
            <span className="font-mono rounded-full" style={{ fontSize: 10, padding: '1px 6px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>GHOST</span>
          </div>
          <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Served {g.lastDeityName || 'unknown'} &middot; Gen {g.generation ?? '?'} &middot; {g.kills || 0} kills &middot; Died: {g.deathCause || 'unknown'}
          </div>
        </div>
      </div>

      {/* Memorable quote */}
      {g.memorableQuote && (
        <div className="font-body italic rounded-lg mb-4" style={{ padding: '14px 16px', background: 'rgba(168,85,247,0.06)', border: '1px solid rgba(168,85,247,0.15)', color: '#c084fc', fontSize: 14, lineHeight: 1.5 }}>
          &ldquo;{g.memorableQuote}&rdquo;
        </div>
      )}

      {/* Stats */}
      <div className="mb-4">
        <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Ghost Stats</div>
        <div className="grid grid-cols-3 gap-2">
          {[
            { val: g.pastLifeLoyalty ?? '?', lbl: 'Past Loyalty', color: '#a855f7' },
            { val: g.kills || 0, lbl: 'Kills' },
            { val: g.generation ?? '?', lbl: 'Generation' },
          ].map((stat, i) => (
            <div key={i} className="rounded-md text-center py-2.5 px-2" style={{ background: 'var(--bg-elevated)' }}>
              <div className="font-mono text-lg" style={{ color: stat.color || 'var(--text-primary)' }}>{stat.val}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{stat.lbl}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bond rings if available */}
      {(b.depth || b.harmony || b.adventure || b.loyalty) ? (
        <div className="grid grid-cols-4 gap-2 mb-4">
          <BondRing label="Depth" value={b.depth || 0} color="#8b5cf6" />
          <BondRing label="Harmony" value={b.harmony || 0} color="#22c55e" />
          <BondRing label="Adventure" value={b.adventure || 0} color="#f97316" />
          <BondRing label="Loyalty" value={b.loyalty || 0} color="#3b82f6" />
        </div>
      ) : null}

      {/* Notable deeds */}
      {g.memorableActions?.length > 0 && (
        <div className="mb-4">
          <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: '#a855f7' }}>Notable Deeds</div>
          {g.memorableActions.map((action, i) => (
            <div key={i} className="rounded-lg mb-2 relative overflow-hidden" style={{ background: 'var(--bg-elevated)', padding: '12px 14px', border: '1px solid rgba(168,85,247,0.12)' }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.55 }}>{typeof action === 'string' ? action : action.text || JSON.stringify(action)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Recruitment info */}
      <div className="rounded-lg p-3" style={{ background: 'var(--bg-elevated)', border: '1px solid rgba(168,85,247,0.12)' }}>
        <div className="font-mono mb-1" style={{ fontSize: 12, color: 'var(--text-muted)' }}>Recruitment Difficulty</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {(g.pastLifeLoyalty || 0) >= 80 ? 'High loyalty to past deity — will resist new masters' :
           (g.pastLifeLoyalty || 0) >= 50 ? 'Moderate loyalty — may be persuaded with the right words' :
           'Low loyalty — likely to accept a new deity quickly'}
        </div>
      </div>
    </>
  );
}

// ─── Deity Detail ───────────────────────────────────────────────────────
function DeityDetail({ id, gameState }) {
  const [journal, setJournal] = useState(null);
  const [journalLoading, setJournalLoading] = useState(true);

  const p = gameState?.players?.[id];

  useEffect(() => {
    if (!p?.walletAddress) { setJournalLoading(false); return; }
    setJournalLoading(true);
    fetch(`/api/game/deity-journal/${p.walletAddress}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => setJournal(data?.journal || null))
      .catch(() => setJournal(null))
      .finally(() => setJournalLoading(false));
  }, [p?.walletAddress]);

  if (!p) return <div style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Deity not found</div>;

  const spirits = Object.values(gameState?.spirits || {}).filter(s => s.playerId === id);
  const alive = spirits.filter(s => s.alive);
  const hexCount = Object.values(gameState?.hexes || {}).filter(h => h.owner === id).length;

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-3.5 mb-4">
        <div className="w-14 h-14 rounded-full flex items-center justify-center text-3xl flex-shrink-0" style={{ background: 'rgba(212,160,82,0.12)', color: 'var(--gold-bright)', border: '2px solid rgba(212,160,82,0.4)' }}>👁</div>
        <div>
          <div className="font-header" style={{ fontSize: '1.2rem', color: 'var(--gold-bright)' }}>{p.name || id}</div>
          <div className="font-mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            {alive.length}/{spirits.length} spirits alive &middot; {hexCount} hexes &middot;
            <span style={{ color: p.connected ? '#4ade80' : '#ef4444' }}> {p.connected ? 'online' : 'offline'}</span>
          </div>
        </div>
      </div>

      {/* Current swarm */}
      {spirits.length > 0 && (
        <div className="mb-4">
          <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Current Swarm</div>
          <div className="grid gap-2" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
            {spirits.map(s => {
              const sc = specColor(s.specialization);
              const si = specIcon(s.specialization);
              const url = s.avatarBlobId ? getAvatarUrl(s.avatarBlobId) : null;
              return (
                <div key={s.id} className="rounded-md text-center py-2 px-1.5" style={{ background: 'var(--bg-elevated)', opacity: s.alive ? 1 : 0.5 }}>
                  {url ? (
                    <img src={url} alt="" className="w-8 h-8 rounded-full object-cover mx-auto mb-1" style={{ border: `2px solid ${sc}` }} />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm mx-auto mb-1" style={{ background: `${sc}20`, color: sc, border: `2px solid ${sc}60` }}>{si}</div>
                  )}
                  <div className="font-header" style={{ fontSize: 11, color: s.alive ? 'var(--text-primary)' : '#ef4444' }}>{s.name}</div>
                  <div className="font-mono" style={{ fontSize: 10, color: sc }}>{si} {s.specialization || ''}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Journal */}
      {journalLoading ? (
        <div className="font-mono italic text-xs" style={{ color: 'var(--text-muted)', padding: '12px 0' }}>Loading deity journal from Walrus...</div>
      ) : journal ? (
        <JournalSection journal={journal} />
      ) : (
        <div className="font-mono italic text-xs" style={{ color: 'var(--text-muted)', padding: '8px 0' }}>No deity journal yet — finish a game to create one.</div>
      )}

      {/* Wallet */}
      {p.walletAddress && (
        <div className="font-mono text-center mt-6" style={{ fontSize: 11, color: 'var(--text-muted)' }}>
          {p.walletAddress.slice(0, 10)}...{p.walletAddress.slice(-6)}
        </div>
      )}
    </>
  );
}

function JournalSection({ journal }) {
  const rep = journal.reputation || {};
  const archetype = journal.playstyle?.deityArchetype || 'Unknown';
  const arcColor = ARCHETYPE_COLORS[archetype] || 'var(--gold-bright)';

  const repBars = [
    { label: 'Benevolence', value: rep.benevolence || 0, color: '#22c55e' },
    { label: 'Ruthlessness', value: rep.ruthlessness || 0, color: '#ef4444' },
    { label: 'Wisdom', value: rep.wisdom || 0, color: '#8b5cf6' },
    { label: 'Loyalty', value: rep.loyalty || 0, color: '#3b82f6' },
    { label: 'Expansion', value: rep.expansion || 0, color: '#f97316' },
  ];

  return (
    <>
      {/* Archetype badge */}
      <div className="text-center mb-4">
        <span className="font-mono inline-block rounded-full" style={{ padding: '6px 16px', fontSize: 13, background: `${arcColor}20`, color: arcColor, border: `1px solid ${arcColor}40`, letterSpacing: '0.05em' }}>{archetype}</span>
        <div className="font-mono mt-1.5" style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          {journal.gamesPlayed || 0} games played{journal.totalBattlesWon ? ` · ${journal.totalBattlesWon} battles won` : ''}
        </div>
      </div>

      {/* Reputation bars */}
      <div className="mb-4">
        <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Reputation</div>
        {repBars.map(bar => (
          <div key={bar.label} className="flex items-center gap-2 my-1">
            <span className="font-mono uppercase" style={{ fontSize: 11, color: 'var(--text-muted)', width: 80 }}>{bar.label}</span>
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: 8, background: 'var(--bg-elevated)' }}>
              <div className="rounded-full transition-all" style={{ height: '100%', width: `${Math.min(100, bar.value)}%`, background: bar.color, minWidth: 2 }} />
            </div>
            <span className="font-mono text-right" style={{ fontSize: 11, color: bar.color, width: 32 }}>{Math.round(bar.value)}</span>
          </div>
        ))}
      </div>

      {/* Playstyle */}
      {journal.playstyle && (
        <div className="mb-4">
          <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Playstyle</div>
          <div className="flex flex-wrap gap-2">
            {journal.playstyle.avgGameLength && <span className="font-mono rounded" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--text-secondary)', background: 'var(--bg-deep)' }}>Avg Game {Math.round(journal.playstyle.avgGameLength / 60)}min</span>}
            {journal.playstyle.favoriteSpecialization && <span className="font-mono rounded" style={{ fontSize: 11, padding: '3px 8px', color: specColor(journal.playstyle.favoriteSpecialization), background: 'var(--bg-deep)' }}>Favorite: {journal.playstyle.favoriteSpecialization}</span>}
            {journal.playstyle.whisperRate != null && <span className="font-mono rounded" style={{ fontSize: 11, padding: '3px 8px', color: 'var(--text-secondary)', background: 'var(--bg-deep)' }}>Whispers: {journal.playstyle.whisperRate}/game</span>}
            {journal.playstyle.spiritSurvivalRate != null && <span className="font-mono rounded" style={{ fontSize: 11, padding: '3px 8px', color: journal.playstyle.spiritSurvivalRate >= 70 ? '#22c55e' : journal.playstyle.spiritSurvivalRate >= 40 ? '#fbbf24' : '#ef4444', background: 'var(--bg-deep)' }}>Survival: {Math.round(journal.playstyle.spiritSurvivalRate)}%</span>}
          </div>
        </div>
      )}

      {/* Game history */}
      {journal.games?.length > 0 && (
        <div className="mb-4">
          <div className="font-mono uppercase tracking-wider mb-2" style={{ fontSize: 10, color: 'var(--text-muted)' }}>Game History</div>
          <div className="flex flex-col gap-1">
            {journal.games.slice(-10).reverse().map((game, i) => (
              <div key={i} className="flex items-center gap-2 rounded px-2.5 py-1.5 font-mono" style={{ fontSize: 12, background: 'var(--bg-elevated)' }}>
                <span style={{ color: game.won ? 'var(--gold-bright)' : 'var(--text-muted)' }}>{game.won ? '★' : '·'}</span>
                <span className="flex-1" style={{ color: 'var(--text-primary)' }}>{game.won ? 'Victory' : 'Defeat'}</span>
                <span style={{ color: 'var(--text-muted)' }}>{game.spiritsSurvived || 0}/{game.spiritsTotal || 3} survived</span>
                <span style={{ color: 'var(--text-muted)' }}>{game.hexesClaimed || 0}h</span>
                {game.date && <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{new Date(game.date).toLocaleDateString()}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
