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

      {/* Two-column layout */}
      <div
        className="relative z-10 flex-1 flex items-center justify-center px-8 pb-10 transition-all duration-1000"
        style={{ opacity: fadeIn ? 1 : 0, transform: fadeIn ? 'translateY(0)' : 'translateY(16px)' }}
      >
        <div className="w-full max-w-5xl grid grid-cols-[1fr_400px] gap-10 items-center">

          {/* LEFT COLUMN — Title + CTA */}
          <div className="flex flex-col">
            <div className="mb-6">
              <h1
                className="font-title tracking-widest mb-2"
                style={{
                  fontSize: 'clamp(2.2rem, 4.5vw, 3.5rem)',
                  color: 'var(--gold-bright)',
                  textShadow: '0 0 40px var(--gold-glow)',
                  lineHeight: 1.1,
                }}
              >
                Anima Swarm
              </h1>
              <p className="font-body text-lg italic" style={{ color: 'var(--text-secondary)' }}>
                Command AI spirits through whispers
              </p>
              <p className="font-mono text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                Memories persist on Walrus &middot; Sui Overflow 2026
              </p>
            </div>

            {/* Deities + Wallet — compact inline row */}
            <div className="flex items-center gap-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm" style={{ color: 'var(--gold-bright)' }}>{playerCount}/{totalPlayers}</span>
                <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>deities</span>
                <div className="flex gap-1 ml-1">
                  {Object.values(gameState.players).map((p, i) => (
                    <div
                      key={p.id}
                      className="w-1.5 h-1.5 rounded-full transition-all duration-500"
                      style={{
                        background: p.connected
                          ? i === 0 ? 'var(--gold-bright)' : 'var(--spirit)'
                          : 'var(--bg-elevated)',
                      }}
                    />
                  ))}
                </div>
              </div>
              <div className="h-4 w-px" style={{ background: 'var(--gold-dim)' }} />
              <WalletConnect />
            </div>

            {/* Awaken Button */}
            <button
              onClick={handleReady}
              disabled={ready}
              className="group transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
            >
              <img
                src="/images/landing/awaken-btn.png"
                alt={ready ? 'Starting...' : 'Awaken'}
                className="h-14 w-auto transition-all duration-300 group-hover:brightness-125"
                style={{ filter: ready ? 'grayscale(1) brightness(0.5)' : 'drop-shadow(0 0 20px rgba(212,160,82,0.4))' }}
                draggable={false}
              />
            </button>
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

            {/* Flavor text */}
            <div className="text-center pt-1">
              <p className="font-body text-xs italic" style={{ color: 'var(--text-muted)' }}>
                6 deities. 18 spirits. One hex grid.
              </p>
              <p className="font-body text-xs italic" style={{ color: 'var(--text-muted)' }}>
                Your whispers shape their fate.
              </p>
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
