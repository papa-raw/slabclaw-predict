import { useState, useEffect } from 'react';
import WalletConnect from './WalletConnect.jsx';
import EssenceImport from './EssenceImport.jsx';
import OnchainFooter from './OnchainFooter.jsx';
import { getAvatarUrl } from '@lib/avatarUrl.js';

const SPEC_COLORS = {
  warrior: 'var(--spec-warrior)',
  scout: 'var(--spec-scout)',
  gatherer: 'var(--spec-gatherer)',
  sage: 'var(--spec-sage)',
  generalist: 'var(--spec-generalist)',
};

function WalrusIcon({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'inline-block', verticalAlign: 'middle' }}>
      {/* Ethereal glow */}
      <circle cx="14" cy="13" r="10" fill="#d4a052" opacity="0.04"/>
      {/* Head — rounded, mystical beast */}
      <ellipse cx="14" cy="11" rx="7.5" ry="6.5" fill="none" stroke="#d4a052" strokeWidth="0.7" opacity="0.5"/>
      <ellipse cx="14" cy="11" rx="7.5" ry="6.5" fill="#d4a052" opacity="0.06"/>
      {/* Crown rune marks */}
      <path d="M10 6.5 L11 5 L12 6.5" stroke="#d4a052" strokeWidth="0.5" opacity="0.4" fill="none"/>
      <path d="M13 5.5 L14 4 L15 5.5" stroke="#d4a052" strokeWidth="0.6" opacity="0.5" fill="none"/>
      <path d="M16 6.5 L17 5 L18 6.5" stroke="#d4a052" strokeWidth="0.5" opacity="0.4" fill="none"/>
      {/* Eyes — glowing, knowing */}
      <ellipse cx="11" cy="10.5" rx="1.2" ry="0.9" fill="#d4a052" opacity="0.7"/>
      <ellipse cx="17" cy="10.5" rx="1.2" ry="0.9" fill="#d4a052" opacity="0.7"/>
      <circle cx="11" cy="10.5" r="0.4" fill="#fff" opacity="0.6"/>
      <circle cx="17" cy="10.5" r="0.4" fill="#fff" opacity="0.6"/>
      {/* Snout */}
      <ellipse cx="14" cy="13" rx="2.5" ry="1.5" fill="none" stroke="#d4a052" strokeWidth="0.6" opacity="0.4"/>
      <circle cx="13" cy="12.8" r="0.35" fill="#d4a052" opacity="0.5"/>
      <circle cx="15" cy="12.8" r="0.35" fill="#d4a052" opacity="0.5"/>
      {/* Tusks — ornamental, curved */}
      <path d="M11.5 14 Q10.5 18 9.5 21" stroke="#d4a052" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.7"/>
      <path d="M16.5 14 Q17.5 18 18.5 21" stroke="#d4a052" strokeWidth="0.9" strokeLinecap="round" fill="none" opacity="0.7"/>
      {/* Tusk rune notches */}
      <line x1="10.8" y1="16" x2="10.2" y2="16.5" stroke="#d4a052" strokeWidth="0.4" opacity="0.35"/>
      <line x1="10.5" y1="18" x2="9.9" y2="18.5" stroke="#d4a052" strokeWidth="0.4" opacity="0.3"/>
      <line x1="17.2" y1="16" x2="17.8" y2="16.5" stroke="#d4a052" strokeWidth="0.4" opacity="0.35"/>
      <line x1="17.5" y1="18" x2="18.1" y2="18.5" stroke="#d4a052" strokeWidth="0.4" opacity="0.3"/>
      {/* Whiskers — flowing, ethereal */}
      <path d="M8 11.5 Q9.5 12 11 12.5" stroke="#d4a052" strokeWidth="0.4" opacity="0.3" fill="none"/>
      <path d="M7.5 13 Q9.5 13 11 13.2" stroke="#d4a052" strokeWidth="0.4" opacity="0.25" fill="none"/>
      <path d="M17 12.5 Q18.5 12 20 11.5" stroke="#d4a052" strokeWidth="0.4" opacity="0.3" fill="none"/>
      <path d="M17 13.2 Q18.5 13 20.5 13" stroke="#d4a052" strokeWidth="0.4" opacity="0.25" fill="none"/>
    </svg>
  );
}

export default function Lobby({ playerId, gameState, chainInfo }) {
  const [ready, setReady] = useState(false);
  const [confirmedBlobId, setConfirmedBlobId] = useState(null);
  const [essencePreview, setEssencePreview] = useState(null);
  const [fadeIn, setFadeIn] = useState(false);

  useEffect(() => {
    requestAnimationFrame(() => setFadeIn(true));
  }, []);

  async function handleReady() {
    setReady(true);
    await fetch('/api/game/ready', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        playerId,
        ...(confirmedBlobId ? { blobId: confirmedBlobId } : {}),
      }),
    });
  }

  function handleEssenceConfirmed(blobId, preview) {
    setConfirmedBlobId(blobId);
    setEssencePreview(preview || null);
  }

  const playerCount = Object.values(gameState.players).filter(p => p.connected).length;
  const totalPlayers = Object.keys(gameState.players).length;
  const mySpirits = Object.values(gameState.spirits).filter(s => s.playerId === playerId);

  return (
    <div className="h-screen flex flex-col overflow-hidden relative" style={{ background: 'var(--bg-abyss)' }}>
      {/* Background image layer */}
      <div className="absolute inset-0">
        <img
          src="/images/landing/hero-volcanic.png"
          alt=""
          className="w-full h-full object-cover"
          style={{ opacity: 0.12 }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(135deg, rgba(6,10,18,0.9) 0%, rgba(6,10,18,0.4) 50%, rgba(6,10,18,0.85) 100%)',
          }}
        />
      </div>

      {/* Animated ambient orbs */}
      <div
        className="absolute top-1/4 left-[15%] w-72 h-72 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'var(--gold-glow)', animation: 'pulse 4s ease-in-out infinite' }}
      />
      <div
        className="absolute bottom-1/4 right-[20%] w-56 h-56 rounded-full blur-3xl pointer-events-none"
        style={{ background: 'var(--spirit-glow)', animation: 'pulse 5s ease-in-out infinite 1s' }}
      />

      {/* Navbar */}
      <nav
        className="relative z-20 flex items-center gap-4 px-6 py-3 flex-shrink-0"
        style={{
          background: 'rgba(6,10,18,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--gold-dim)',
        }}
      >
        <a href="/" className="flex items-center gap-2.5 no-underline">
          <img src="/logo-icon.svg" alt="Anima Swarm" className="w-7 h-7" />
          <span
            className="font-title text-sm tracking-widest"
            style={{ color: 'var(--gold-bright)' }}
          >
            Anima Swarm
          </span>
        </a>

        <div className="flex items-center gap-2 ml-4">
          <span className="font-mono text-sm" style={{ color: 'var(--gold-bright)' }}>{playerCount}/{totalPlayers}</span>
          <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>deities</span>
          <div className="flex gap-1 ml-1">
            {Object.values(gameState.players).map(p => (
              <div
                key={p.id}
                className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                style={{
                  background: p.walletAddress
                    ? 'var(--gold-bright)'
                    : p.connected ? 'var(--spirit)' : 'var(--bg-elevated)',
                  boxShadow: p.walletAddress ? '0 0 4px var(--gold-glow)' : 'none',
                }}
              />
            ))}
          </div>
        </div>

        <div className="flex-1" />

        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          Sui Overflow 2026
        </span>
        <div className="h-4 w-px" style={{ background: 'var(--gold-dim)' }} />
        <a
          href="/docs/"
          className="font-mono text-xs transition-colors hover:text-amber-400"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          Docs
        </a>
        <a
          href="https://github.com/papa-raw/anima-swarm"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-xs transition-colors hover:text-amber-400"
          style={{ color: 'var(--text-secondary)', textDecoration: 'none' }}
        >
          GitHub
        </a>
        <div className="h-4 w-px" style={{ background: 'var(--gold-dim)' }} />
        <WalletConnect />
      </nav>

      {/* Two-column layout */}
      <div
        className="relative z-10 flex-1 flex items-center justify-center px-8 pb-10 transition-all duration-1000"
        style={{ opacity: fadeIn ? 1 : 0, transform: fadeIn ? 'translateY(0)' : 'translateY(16px)' }}
      >
        <div className="w-full max-w-5xl grid grid-cols-[1fr_400px] gap-10 items-center">

          {/* LEFT COLUMN — Title + CTA */}
          <div className="flex flex-col">
            <div className="mb-8">
              <h1
                className="font-title tracking-widest mb-2"
                style={{
                  fontSize: 'clamp(2.6rem, 5.4vw, 4.2rem)',
                  color: 'var(--gold-bright)',
                  textShadow: '0 0 40px var(--gold-glow)',
                  lineHeight: 1.1,
                }}
              >
                Anima Swarm
              </h1>
              <p
                className="font-body italic"
                style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', lineHeight: 1.4 }}
              >
                Command AI spirits through whispers&hellip;
              </p>
            </div>

            <div className="flex flex-col items-start gap-4 mt-2">
              <div className="group relative py-4">
                <div
                  className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-all duration-700 group-hover:scale-110 group-hover:opacity-[0.18]"
                  style={{
                    opacity: 0.08,
                    animation: 'pulse 6s ease-in-out infinite',
                    filter: 'drop-shadow(0 0 30px rgba(212,160,82,0.3))',
                  }}
                >
                  <WalrusIcon size={180} />
                </div>
                <button
                  onClick={handleReady}
                  disabled={ready || !gameState.players[playerId]?.walletAddress}
                  className="relative z-10 transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  <img
                    src="/images/landing/awaken-btn.png"
                    alt={ready ? 'Starting...' : 'Awaken'}
                    className="w-auto transition-all duration-300 group-hover:brightness-125"
                    style={{
                      height: '4.4rem',
                      filter: ready ? 'grayscale(1) brightness(0.5)' : 'drop-shadow(0 0 20px rgba(212,160,82,0.4))',
                    }}
                    draggable={false}
                  />
                </button>
              </div>
              <span
                className="inline-flex items-center gap-1.5 font-body text-sm italic"
                style={{ color: 'var(--text-muted)' }}
              >
                <WalrusIcon size={15} />
                Memories persist on Walrus
              </span>
            </div>
          </div>

          {/* RIGHT COLUMN — Swarm + Essence (combined) */}
          <div className="flex flex-col gap-3">
            <div className={`anima-panel transition-all duration-300 ${confirmedBlobId ? 'ring-1 ring-purple-500/30' : ''}`}>
              <div className="anima-panel-header flex items-center justify-between">
                <span>Your Swarm</span>
                {confirmedBlobId && (
                  <span
                    className="text-xs font-mono px-2 py-0.5 rounded-full border"
                    style={{ background: 'rgba(168,85,247,0.15)', borderColor: 'rgba(168,85,247,0.3)', color: '#c084fc' }}
                  >
                    ✦ Reincarnated
                  </span>
                )}
              </div>
              <div className="anima-panel-body">
                <div className="grid grid-cols-3 gap-2 mb-3">
                  {mySpirits.map(s => {
                    const isReborn = confirmedBlobId && s.generation === 0;
                    const rawPrev = essencePreview?.candidates?.[0]?.pastLifeNames || [];
                    const prevNames = rawPrev.filter(n => n !== s.name);
                    const candidate = essencePreview?.candidates?.find(c => c.pastLifeNames?.includes(s.name) || c.name === prevNames[0]);
                    const avatarUrl = s.avatarBlobId ? getAvatarUrl(s.avatarBlobId) : (candidate?.avatarBlobId ? getAvatarUrl(candidate.avatarBlobId) : null);
                    const specColor = SPEC_COLORS[s.specialization] || SPEC_COLORS.generalist;

                    return (
                      <div
                        key={s.id}
                        className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg text-center"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--gold-dim)' }}
                      >
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={s.name}
                            className="w-12 h-12 rounded-full object-cover"
                            style={{ border: `2px solid ${specColor}`, boxShadow: `0 0 12px ${specColor}40` }}
                          />
                        ) : (
                          <div
                            className="w-12 h-12 rounded-full flex items-center justify-center font-header text-lg"
                            style={{ background: `${specColor}20`, border: `2px solid ${specColor}60`, color: specColor }}
                          >
                            {s.name[0]}
                          </div>
                        )}
                        <span className="font-header text-sm" style={{ color: isReborn ? '#c084fc' : 'var(--text-primary)' }}>
                          {s.name}
                        </span>
                        <span className="text-xs font-mono uppercase tracking-wider" style={{ color: specColor }}>
                          {s.specialization}
                        </span>
                        {isReborn && prevNames.length > 0 && (
                          <span className="text-xs italic" style={{ color: 'var(--text-muted)' }}>
                            was {prevNames[0]}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Essence Import — inside swarm panel */}
                <div style={{ borderTop: '1px solid var(--gold-dim)', paddingTop: '10px' }}>
                  <EssenceImport onEssenceConfirmed={handleEssenceConfirmed} confirmedBlobId={confirmedBlobId} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Onchain footer — pinned bottom */}
      <div className="relative z-10">
        <OnchainFooter chainInfo={chainInfo} />
      </div>
    </div>
  );
}
