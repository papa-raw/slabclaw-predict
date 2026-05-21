import { useRef, useState, useCallback, useEffect } from 'react';
import VFXOverlay from '../vfx/VFXOverlay.jsx';
import SpiritSprite, { SPIRIT_SPECS } from './SpiritSprite.jsx';
import { AFFINITIES as AFF_DATA, CAPTAIN_CLASSES as CLASS_DATA } from '@lib/classSystem.js';

const AFFINITY_NAMES = Object.keys(AFF_DATA);
const PLAYER_COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#a855f7', '#f97316', '#06b6d4'];
const ANIM_STATES = ['idle', 'walk', 'attack', 'spawn'];
const TIER_NAMES = ['swarmling', 'captain', 'hero'];
const CLASS_NAMES = Object.keys(CLASS_DATA);

function AnimControls({ selectedAnim, setSelectedAnim, selectedColor, setSelectedColor, speed, setSpeed, paused, setPaused, animTick }) {
  return (
    <div className="flex flex-wrap gap-3 items-center">
      <div className="flex gap-1">
        {ANIM_STATES.map(a => (
          <button
            key={a}
            onClick={() => setSelectedAnim(a)}
            className="px-2.5 py-1 rounded text-xs font-mono capitalize transition-all"
            style={{
              background: a === selectedAnim ? 'rgba(212,160,82,0.2)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${a === selectedAnim ? 'var(--gold-dim)' : 'rgba(255,255,255,0.06)'}`,
              color: a === selectedAnim ? 'var(--gold-bright)' : 'var(--text-secondary)',
            }}
          >
            {a}
          </button>
        ))}
      </div>
      <div className="flex gap-1.5">
        {PLAYER_COLORS.map((c, i) => (
          <button
            key={c}
            onClick={() => setSelectedColor(i)}
            className="w-5 h-5 rounded-full transition-all"
            style={{
              background: c,
              border: `2px solid ${i === selectedColor ? '#fff' : 'transparent'}`,
              opacity: i === selectedColor ? 1 : 0.4,
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>FPS</span>
        <input
          type="range" min="1" max="16" value={speed}
          onChange={e => setSpeed(Number(e.target.value))}
          className="w-16 accent-amber-500"
        />
        <span className="text-xs font-mono w-4" style={{ color: 'var(--text-secondary)' }}>{speed}</span>
      </div>
      <button
        onClick={() => setPaused(!paused)}
        className="px-2 py-1 rounded text-xs font-mono"
        style={{
          background: paused ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.06)',
          color: paused ? '#ef4444' : 'var(--text-secondary)',
        }}
      >
        {paused ? 'PAUSED' : 'PAUSE'}
      </button>
      <div className="text-xs font-mono" style={{ color: 'var(--text-muted)' }}>
        Frame {animTick % 4}
      </div>
    </div>
  );
}

function SectionHeader({ children, gold }) {
  return (
    <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: gold ? 'var(--gold-dim)' : 'var(--text-muted)' }}>
      {children}
    </div>
  );
}

const AFFINITY_TO_CHAR = {
  flame: 'fire_knight', tide: 'water_priestess', stone: 'ground_monk',
  wind: 'wind_hashashin', growth: 'leaf_ranger', shadow: 'crystal_mauler',
};

function CaptainSprite({ spec, affinity, cls, animState, animFrame, facing, showHp }) {
  const affData = AFF_DATA[affinity];
  const classData = CLASS_DATA[cls];
  const color = affData?.color || '#6b7280';
  const glowColor = affData?.glow || color;
  const charName = AFFINITY_TO_CHAR[affinity] || 'metal_bladekeeper';
  const portraitSrc = `/sprites/${charName}/portrait.png`;
  const barW = 20;
  const barH = 3;
  const barY = -38;
  const avatarR = 6;
  const avatarX = -barW / 2 - avatarR - 2;
  const avatarY = barY + barH / 2;
  const clipId = `cap-clip-${affinity}-${cls}`;
  return (
    <g>
      <circle cx={0} cy={-16} r={20} fill="none" stroke={glowColor} strokeWidth={0.6} opacity={0.25}>
        <animate attributeName="opacity" values="0.25;0.12;0.25" dur="3s" repeatCount="indefinite" />
      </circle>
      <SpiritSprite spec={spec} color={color} animState={animState} animFrame={animFrame} facing={facing} affinity={affinity} />
      <circle cx={-12} cy={-34} r={2.5} fill={color} opacity={0.7} />
      {classData && <text x={12} y={-32} textAnchor="middle" fontSize="6" opacity={0.8}>{classData.icon}</text>}
      <defs>
        <clipPath id={clipId}>
          <circle cx={avatarX} cy={avatarY} r={avatarR} />
        </clipPath>
      </defs>
      <circle cx={avatarX} cy={avatarY} r={avatarR + 0.5} fill="rgba(0,0,0,0.5)" stroke={color} strokeWidth={0.6} />
      <image
        href={portraitSrc}
        x={avatarX - avatarR}
        y={avatarY - avatarR}
        width={avatarR * 2}
        height={avatarR * 2}
        clipPath={`url(#${clipId})`}
        style={{ imageRendering: 'pixelated' }}
      />
      {showHp && (
        <g>
          <rect x={-barW / 2} y={barY} width={barW} height={barH} rx={1} fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.3} />
          <rect x={-barW / 2 + 0.5} y={barY + 0.5} width={(barW - 1) * 0.7} height={barH - 1} rx={0.5} fill="#fbbf24" opacity={0.9} />
        </g>
      )}
    </g>
  );
}

function HeroSprite({ spec, affinity, cls, animState, animFrame, facing, title }) {
  const affData = AFF_DATA[affinity];
  const classData = CLASS_DATA[cls];
  const color = affData?.color || '#6b7280';
  const glowColor = affData?.glow || color;
  return (
    <g transform="scale(1.3)">
      <ellipse cx={0} cy={-16} rx={22} ry={28} fill={glowColor} opacity={0.08}>
        <animate attributeName="opacity" values="0.08;0.15;0.08" dur="2s" repeatCount="indefinite" />
      </ellipse>
      <circle cx={0} cy={-16} r={20} fill="none" stroke={glowColor} strokeWidth={0.6} opacity={0.25}>
        <animate attributeName="opacity" values="0.25;0.12;0.25" dur="3s" repeatCount="indefinite" />
      </circle>
      <SpiritSprite spec={spec} color={color} animState={animState} animFrame={animFrame} facing={facing} affinity={affinity} />
      <circle cx={-12} cy={-34} r={2.5} fill={color} opacity={0.7} />
      {classData && <text x={12} y={-32} textAnchor="middle" fontSize="6" opacity={0.8}>{classData.icon}</text>}
      {title && (
        <text x={0} y={-48} textAnchor="middle" fontSize="5" fill="#f0c040" fontFamily="'Cinzel', serif" fontWeight="700" opacity={0.9}>
          {title}
        </text>
      )}
    </g>
  );
}

function SwarmlingDot({ affinity, playerColor, count }) {
  const affData = AFF_DATA[affinity];
  const glowColor = affData?.glow || playerColor;
  if (count && count > 3) {
    return (
      <g>
        <circle cx={0} cy={0} r={6 + Math.min(count, 15) * 0.3} fill={glowColor} opacity={0.25}>
          <animate attributeName="r" values={`${5 + count * 0.2};${7 + count * 0.3};${5 + count * 0.2}`} dur="2s" repeatCount="indefinite" />
        </circle>
        <circle cx={0} cy={0} r={4} fill={glowColor} stroke={playerColor} strokeWidth={1} opacity={0.85} />
        <text x={0} y={1.5} textAnchor="middle" fontSize="5" fill="#fff" fontWeight="bold" fontFamily="monospace">{count}</text>
      </g>
    );
  }
  return <circle cx={0} cy={0} r={3} fill={glowColor} stroke={playerColor} strokeWidth={0.8} opacity={0.9} />;
}

function SpriteShowcase() {
  const [animTick, setAnimTick] = useState(0);
  const [selectedAnim, setSelectedAnim] = useState('idle');
  const [selectedColor, setSelectedColor] = useState(0);
  const [speed, setSpeed] = useState(6);
  const [paused, setPaused] = useState(false);
  const [section, setSection] = useState('specs');

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => setAnimTick(t => t + 1), 1000 / speed);
    return () => clearInterval(id);
  }, [speed, paused]);

  const color = PLAYER_COLORS[selectedColor];

  const sections = [
    { id: 'specs', label: 'Base Specs' },
    { id: 'tiers', label: 'Tier Rendering' },
    { id: 'affinities', label: 'Affinities' },
    { id: 'classes', label: 'Captain Classes' },
    { id: 'heroes', label: 'Heroes' },
    { id: 'frames', label: 'Frame Strips' },
  ];

  return (
    <div className="space-y-4">
      <AnimControls {...{ selectedAnim, setSelectedAnim, selectedColor, setSelectedColor, speed, setSpeed, paused, setPaused, animTick }} />

      {/* Sub-navigation */}
      <div className="flex gap-1 flex-wrap">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            className="px-3 py-1.5 rounded text-xs font-mono transition-all"
            style={{
              background: s.id === section ? 'rgba(212,160,82,0.15)' : 'rgba(255,255,255,0.03)',
              border: `1px solid ${s.id === section ? 'var(--gold-dim)' : 'rgba(255,255,255,0.06)'}`,
              color: s.id === section ? 'var(--gold-bright)' : 'var(--text-muted)',
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* === BASE SPECS === */}
      {section === 'specs' && (
        <div>
          <SectionHeader>ALL 5 CHARACTER SPECS</SectionHeader>
          <div className="flex gap-4 justify-center py-2 flex-wrap">
            {AFFINITY_NAMES.map(aff => (
              <div key={aff} className="text-center">
                <svg viewBox="-40 -36 80 42" width="160" height="100" className="mx-auto">
                  <SpiritSprite spec="warrior" color={AFF_DATA[aff]?.color || '#888'} animState={selectedAnim} animFrame={animTick} facing={1} affinity={aff} />
                </svg>
                <div className="text-xs font-mono capitalize mt-1" style={{ color: AFF_DATA[aff]?.color || 'var(--text-secondary)' }}>{aff}</div>
              </div>
            ))}
          </div>
          <div className="flex gap-4 justify-center py-2 flex-wrap opacity-60">
            {AFFINITY_NAMES.map(aff => (
              <div key={aff} className="text-center">
                <svg viewBox="-40 -36 80 42" width="130" height="80" className="mx-auto">
                  <SpiritSprite spec="warrior" color={AFF_DATA[aff]?.color || '#888'} animState={selectedAnim} animFrame={animTick} facing={-1} affinity={aff} />
                </svg>
                <div className="text-[10px] font-mono capitalize" style={{ color: 'var(--text-muted)' }}>facing left</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* === TIER RENDERING === */}
      {section === 'tiers' && (
        <div className="space-y-6">
          <SectionHeader gold>THREE-TIER SYSTEM — SWARMLING / CAPTAIN / HERO</SectionHeader>

          {/* Swarmlings */}
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-secondary)' }}>
              SWARMLINGS — Rule-based AI, rendered as colored dots
            </div>
            <div className="flex gap-6 items-end flex-wrap">
              {AFFINITY_NAMES.map(aff => {
                const ad = AFF_DATA[aff];
                return (
                  <div key={aff} className="text-center">
                    <svg viewBox="-12 -12 24 24" width="48" height="48" className="mx-auto">
                      <SwarmlingDot affinity={aff} playerColor={ad.color} />
                    </svg>
                    <div className="text-[10px] font-mono capitalize" style={{ color: ad.color }}>{aff}</div>
                  </div>
                );
              })}
              <div className="text-center">
                <svg viewBox="-15 -15 30 30" width="64" height="64" className="mx-auto">
                  <SwarmlingDot affinity="flame" playerColor="#ef4444" count={7} />
                </svg>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>cluster (7)</div>
              </div>
              <div className="text-center">
                <svg viewBox="-15 -15 30 30" width="64" height="64" className="mx-auto">
                  <SwarmlingDot affinity="tide" playerColor="#3b82f6" count={15} />
                </svg>
                <div className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>cluster (15)</div>
              </div>
            </div>
          </div>

          {/* Captains */}
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-secondary)' }}>
              CAPTAINS — LLM-driven, full sprite + aura ring + class icon + affinity dot
            </div>
            <div className="flex gap-4 flex-wrap justify-center">
              {SPIRIT_SPECS.map((spec, i) => {
                const aff = AFFINITY_NAMES[i % AFFINITY_NAMES.length];
                const cls = CLASS_NAMES[i % CLASS_NAMES.length];
                return (
                  <div key={spec} className="text-center">
                    <svg viewBox="-40 -48 80 54" width="130" height="110" className="mx-auto">
                      <CaptainSprite spec={spec} affinity={aff} cls={cls} animState={selectedAnim} animFrame={animTick} facing={1} showHp />
                    </svg>
                    <div className="text-[10px] font-mono capitalize" style={{ color: AFF_DATA[aff]?.color }}>
                      {spec} — {CLASS_DATA[cls]?.label}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Heroes */}
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-secondary)' }}>
              HEROES — 1.3x scale + glow aura + title text
            </div>
            <div className="flex gap-6 flex-wrap justify-center">
              {['warrior', 'sage', 'scout'].map((spec, i) => {
                const aff = AFFINITY_NAMES[i * 2];
                const cls = CLASS_NAMES[i];
                const titles = ['The Undying', 'Starweaver', 'Windwalker'];
                return (
                  <div key={spec} className="text-center">
                    <svg viewBox="-55 -68 110 76" width="160" height="130" className="mx-auto">
                      <HeroSprite spec={spec} affinity={aff} cls={cls} animState={selectedAnim} animFrame={animTick} facing={1} title={titles[i]} />
                    </svg>
                    <div className="text-[10px] font-mono capitalize" style={{ color: '#f0c040' }}>
                      {titles[i]}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side-by-side comparison */}
          <div>
            <div className="text-xs font-mono mb-2" style={{ color: 'var(--text-secondary)' }}>
              TIER COMPARISON — same spec, all three tiers
            </div>
            <div className="flex gap-8 justify-center items-end">
              <div className="text-center">
                <svg viewBox="-12 -12 24 24" width="48" height="48" className="mx-auto">
                  <SwarmlingDot affinity="flame" playerColor="#ef4444" />
                </svg>
                <div className="text-[10px] font-mono mt-1" style={{ color: 'var(--text-muted)' }}>Swarmling</div>
              </div>
              <div className="text-center">
                <svg viewBox="-40 -48 80 54" width="130" height="110" className="mx-auto">
                  <CaptainSprite spec="warrior" affinity="flame" cls="vanguard" animState={selectedAnim} animFrame={animTick} facing={1} showHp />
                </svg>
                <div className="text-[10px] font-mono mt-1" style={{ color: AFF_DATA.flame.color }}>Captain</div>
              </div>
              <div className="text-center">
                <svg viewBox="-55 -68 110 76" width="160" height="130" className="mx-auto">
                  <HeroSprite spec="warrior" affinity="flame" cls="vanguard" animState={selectedAnim} animFrame={animTick} facing={1} title="The Undying" />
                </svg>
                <div className="text-[10px] font-mono mt-1" style={{ color: '#f0c040' }}>Hero</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === AFFINITY GRID === */}
      {section === 'affinities' && (
        <div>
          <SectionHeader gold>6 AFFINITIES × 5 SPECS — {selectedAnim.toUpperCase()}</SectionHeader>
          <div className="text-[10px] font-mono mb-3" style={{ color: 'var(--text-muted)' }}>
            Dual-triangle advantage wheel: flame {'>'} growth {'>'} tide {'>'} flame | stone {'>'} wind {'>'} shadow {'>'} stone
          </div>
          <div className="grid gap-2" style={{ gridTemplateColumns: `80px repeat(${SPIRIT_SPECS.length}, 1fr)` }}>
            <div />
            {SPIRIT_SPECS.map(spec => (
              <div key={spec} className="text-center text-[10px] font-mono capitalize" style={{ color: 'var(--text-secondary)' }}>
                {spec}
              </div>
            ))}
            {AFFINITY_NAMES.map(aff => {
              const ad = AFF_DATA[aff];
              return [
                <div key={`label-${aff}`} className="flex items-center gap-1.5 justify-end pr-2">
                  <span className="text-sm">{ad.icon}</span>
                  <span className="text-[10px] font-mono capitalize" style={{ color: ad.color }}>{aff}</span>
                </div>,
                ...SPIRIT_SPECS.map(spec => (
                  <div
                    key={`${aff}-${spec}`}
                    className="flex justify-center rounded"
                    style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}
                  >
                    <svg viewBox="-40 -36 80 42" width="80" height="56">
                      <SpiritSprite spec={spec} color={ad.color} animState={selectedAnim} animFrame={animTick} facing={1} affinity={aff} />
                    </svg>
                  </div>
                )),
              ];
            })}
          </div>
          <div className="mt-4">
            <SectionHeader>AFFINITY ADVANTAGE WHEEL</SectionHeader>
            <svg viewBox="-80 -80 160 160" width="240" height="240" className="mx-auto">
              {AFFINITY_NAMES.map((aff, i) => {
                const ad = AFF_DATA[aff];
                const angle = (i / AFFINITY_NAMES.length) * Math.PI * 2 - Math.PI / 2;
                const x = Math.cos(angle) * 55;
                const y = Math.sin(angle) * 55;
                const strongIdx = AFFINITY_NAMES.indexOf(ad.strong);
                const sa = (strongIdx / AFFINITY_NAMES.length) * Math.PI * 2 - Math.PI / 2;
                const sx = Math.cos(sa) * 55;
                const sy = Math.sin(sa) * 55;
                return (
                  <g key={aff}>
                    <line x1={x} y1={y} x2={sx} y2={sy} stroke={ad.color} strokeWidth={1.5} opacity={0.4} markerEnd="url(#arrowhead)" />
                    <circle cx={x} cy={y} r={14} fill={ad.color} opacity={0.15} stroke={ad.color} strokeWidth={1} />
                    <text x={x} y={y - 2} textAnchor="middle" fontSize="10">{ad.icon}</text>
                    <text x={x} y={y + 8} textAnchor="middle" fontSize="5" fill={ad.color} fontFamily="monospace">{aff}</text>
                  </g>
                );
              })}
              <defs>
                <marker id="arrowhead" markerWidth="6" markerHeight="4" refX="5" refY="2" orient="auto">
                  <polygon points="0 0, 6 2, 0 4" fill="rgba(255,255,255,0.5)" />
                </marker>
              </defs>
            </svg>
          </div>
        </div>
      )}

      {/* === CAPTAIN CLASSES === */}
      {section === 'classes' && (
        <div>
          <SectionHeader gold>8 CAPTAIN CLASSES — {selectedAnim.toUpperCase()}</SectionHeader>
          <div className="grid grid-cols-4 gap-3">
            {CLASS_NAMES.map((cls, ci) => {
              const cd = CLASS_DATA[cls];
              const aff = AFFINITY_NAMES[ci % AFFINITY_NAMES.length];
              const spec = SPIRIT_SPECS[ci % SPIRIT_SPECS.length];
              return (
                <div
                  key={cls}
                  className="rounded p-3 text-center"
                  style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <svg viewBox="-40 -48 80 54" width="110" height="95" className="mx-auto">
                    <CaptainSprite spec={spec} affinity={aff} cls={cls} animState={selectedAnim} animFrame={animTick} facing={1} />
                  </svg>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <span className="text-lg">{cd.icon}</span>
                    <span className="text-xs font-mono font-bold" style={{ color: AFF_DATA[aff]?.color }}>{cd.label}</span>
                  </div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>{cd.desc}</div>
                  <div className="flex gap-1 justify-center mt-1.5">
                    <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(212,160,82,0.1)', color: 'var(--gold-dim)' }}>
                      R{cd.radius}
                    </span>
                    <span className="text-[8px] font-mono px-1 py-0.5 rounded" style={{ background: 'rgba(255,255,255,0.05)', color: 'var(--text-muted)' }}>
                      {cd.aura}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t mt-4 pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <SectionHeader>ALL CLASSES × ALL SPECS</SectionHeader>
            <div className="grid gap-1" style={{ gridTemplateColumns: `70px repeat(${CLASS_NAMES.length}, 1fr)` }}>
              <div />
              {CLASS_NAMES.map(cls => (
                <div key={cls} className="text-center text-lg" title={CLASS_DATA[cls].label}>{CLASS_DATA[cls].icon}</div>
              ))}
              {SPIRIT_SPECS.map(spec => [
                <div key={`l-${spec}`} className="text-[10px] font-mono capitalize flex items-center justify-end pr-1" style={{ color: 'var(--text-muted)' }}>
                  {spec}
                </div>,
                ...CLASS_NAMES.map(cls => (
                  <div key={`${spec}-${cls}`} className="flex justify-center rounded" style={{ background: 'rgba(255,255,255,0.02)' }}>
                    <svg viewBox="-40 -48 80 54" width="68" height="58">
                      <CaptainSprite spec={spec} affinity={AFFINITY_NAMES[CLASS_NAMES.indexOf(cls) % AFFINITY_NAMES.length]} cls={cls} animState={selectedAnim} animFrame={animTick} facing={1} />
                    </svg>
                  </div>
                )),
              ])}
            </div>
          </div>
        </div>
      )}

      {/* === HEROES === */}
      {section === 'heroes' && (
        <div className="space-y-4">
          <SectionHeader gold>HERO TIER — 1.3× SCALE + GLOW + TITLE</SectionHeader>
          <div className="flex gap-4 flex-wrap justify-center">
            {SPIRIT_SPECS.map((spec, i) => {
              const aff = AFFINITY_NAMES[i];
              const cls = CLASS_NAMES[i];
              const titles = ['The Undying', 'Windwalker', 'Rootmother', 'Starweaver', 'Ironbound'];
              return (
                <div key={spec} className="text-center">
                  <svg viewBox="-55 -68 110 76" width="160" height="130" className="mx-auto">
                    <HeroSprite spec={spec} affinity={aff} cls={cls} animState={selectedAnim} animFrame={animTick} facing={1} title={titles[i]} />
                  </svg>
                  <div className="text-xs font-mono capitalize" style={{ color: '#f0c040' }}>{titles[i]}</div>
                  <div className="text-[9px] font-mono" style={{ color: 'var(--text-muted)' }}>
                    {spec} / {aff} / {CLASS_DATA[cls]?.label}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <SectionHeader>HEROES × ALL AFFINITIES</SectionHeader>
            <div className="grid grid-cols-6 gap-2">
              {AFFINITY_NAMES.map(aff => (
                <div key={aff} className="text-center">
                  <svg viewBox="-55 -68 110 76" width="140" height="110" className="mx-auto">
                    <HeroSprite spec="warrior" affinity={aff} cls="vanguard" animState={selectedAnim} animFrame={animTick} facing={1} title={AFF_DATA[aff].icon} />
                  </svg>
                  <div className="text-[10px] font-mono capitalize" style={{ color: AFF_DATA[aff].color }}>{aff}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <SectionHeader>ALL ANIMATIONS — HERO WARRIOR</SectionHeader>
            <div className="flex gap-6 justify-center">
              {ANIM_STATES.map(anim => (
                <div key={anim} className="text-center">
                  <svg viewBox="-55 -68 110 76" width="150" height="120" className="mx-auto">
                    <HeroSprite spec="warrior" affinity="flame" cls="vanguard" animState={anim} animFrame={animTick} facing={1} title="The Undying" />
                  </svg>
                  <div className="text-[10px] font-mono capitalize" style={{ color: 'var(--text-secondary)' }}>{anim}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* === FRAME STRIPS === */}
      {section === 'frames' && (
        <div>
          <SectionHeader>FRAME STRIP: {selectedAnim.toUpperCase()}</SectionHeader>
          {AFFINITY_NAMES.map(aff => (
            <div key={aff} className="flex items-center gap-2 mb-2">
              <span className="text-xs font-mono w-20 text-right capitalize" style={{ color: AFF_DATA[aff]?.color || 'var(--text-muted)' }}>{aff}</span>
              <div className="flex gap-1">
                {[0, 1, 2, 3, 4, 5, 6, 7].map(frame => (
                  <div
                    key={frame}
                    className="relative rounded"
                    style={{
                      background: frame === (animTick % 8) ? 'rgba(212,160,82,0.12)' : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${frame === (animTick % 8) ? 'var(--gold-dim)' : 'rgba(255,255,255,0.04)'}`,
                    }}
                  >
                    <svg viewBox="-40 -36 80 42" width="72" height="50">
                      <SpiritSprite spec="warrior" color={AFF_DATA[aff]?.color || '#888'} animState={selectedAnim} animFrame={frame} facing={1} affinity={aff} />
                    </svg>
                    <div className="absolute bottom-0 left-0 right-0 text-center text-[8px] font-mono" style={{ color: 'var(--text-muted)' }}>F{frame}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="border-t mt-3 pt-3" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <SectionHeader>ALL ANIMATIONS × FLAME</SectionHeader>
            {ANIM_STATES.map(anim => (
              <div key={anim} className="flex items-center gap-2 mb-2">
                <span className="text-xs font-mono w-16 text-right capitalize" style={{ color: 'var(--text-muted)' }}>{anim}</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(frame => (
                    <div key={frame} className="rounded" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <svg viewBox="-40 -36 80 42" width="72" height="50">
                        <SpiritSprite spec="warrior" color="#ef4444" animState={anim} animFrame={frame} facing={1} affinity="flame" />
                      </svg>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function VFXTestPage() {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  const vfxRef = useRef(null);
  const [lastFired, setLastFired] = useState(null);
  const [affIdx, setAffIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);
  const [tab, setTab] = useState('vfx');

  const affinity = AFFINITY_NAMES[affIdx];
  const playerColor = PLAYER_COLORS[colorIdx];

  const center = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const vb = svg.viewBox?.baseVal;
    return { x: vb.x + vb.width / 2, y: vb.y + vb.height / 2 };
  }, []);

  const rand = (min, max) => min + Math.random() * (max - min);

  const fire = useCallback((name, fn) => {
    fn();
    setLastFired(name);
  }, []);

  const effects = [
    {
      name: 'Explosion',
      desc: 'Core burst + sparks + smoke',
      fn: () => {
        const c = center();
        vfxRef.current?.explosion(c.x + rand(-40, 40), c.y + rand(-40, 40), { affinity });
      },
    },
    {
      name: 'Fatal Explosion',
      desc: 'Heavy burst + debris ring + blood + heavy shake',
      fn: () => {
        const c = center();
        vfxRef.current?.explosion(c.x, c.y, { fatal: true, affinity });
      },
    },
    {
      name: 'Projectile',
      desc: 'Trail from left to right with head glow',
      fn: () => {
        const c = center();
        vfxRef.current?.projectile(c.x - 120, c.y, c.x + 120, c.y, { affinity });
      },
    },
    {
      name: 'Projectile (diagonal)',
      desc: 'Trail from top-left to bottom-right',
      fn: () => {
        const c = center();
        vfxRef.current?.projectile(c.x - 100, c.y - 80, c.x + 100, c.y + 80, { affinity });
      },
    },
    {
      name: 'Blood Splatter',
      desc: 'Directional cone with mist spray',
      fn: () => {
        const c = center();
        const angle = Math.random() * Math.PI * 2;
        vfxRef.current?.blood(c.x, c.y, Math.cos(angle) * 50, Math.sin(angle) * 50);
      },
    },
    {
      name: 'Death Dissolve',
      desc: 'Spirit essence rising + flash + lingering wisps',
      fn: () => {
        const c = center();
        vfxRef.current?.death(c.x, c.y, playerColor);
      },
    },
    {
      name: 'Spawn Vortex',
      desc: 'Swirling inward particles + center burst',
      fn: () => {
        const c = center();
        vfxRef.current?.spawn(c.x, c.y, playerColor);
      },
    },
    {
      name: 'Whisper Pulse',
      desc: 'Radial magic particles (spirit whisper)',
      fn: () => {
        const c = center();
        vfxRef.current?.whisper(c.x, c.y, { decree: false });
      },
    },
    {
      name: 'Decree Pulse',
      desc: 'Golden radial burst (deity decree)',
      fn: () => {
        const c = center();
        vfxRef.current?.whisper(c.x, c.y, { decree: true });
      },
    },
    {
      name: 'Hit Flash',
      desc: 'Quick sprite sheet flash',
      fn: () => {
        const c = center();
        vfxRef.current?.hitFlash(c.x + rand(-30, 30), c.y + rand(-30, 30));
      },
    },
    {
      name: 'Damage Number',
      desc: 'Floating "-27" text with CSS animation',
      fn: () => {
        const c = center();
        const amount = Math.floor(Math.random() * 40 + 5);
        vfxRef.current?.damageNumber(c.x + rand(-40, 40), c.y + rand(-20, 20), amount, {
          critical: Math.random() > 0.5,
        });
      },
    },
    {
      name: 'Screen Shake (light)',
      desc: '3px shake',
      fn: () => vfxRef.current?.shake('light'),
    },
    {
      name: 'Screen Shake (heavy)',
      desc: '15px shake',
      fn: () => vfxRef.current?.shake('heavy'),
    },
  ];

  const combos = [
    {
      name: 'Battle Hit',
      desc: 'Explosion + damage number + shake',
      fn: () => {
        const c = center();
        vfxRef.current?.explosion(c.x, c.y, { affinity });
        vfxRef.current?.damageNumber(c.x, c.y, Math.floor(Math.random() * 30 + 10));
        vfxRef.current?.hitFlash(c.x, c.y);
      },
    },
    {
      name: 'Fatal Kill',
      desc: 'Fatal explosion + blood + death dissolve + heavy shake',
      fn: () => {
        const c = center();
        vfxRef.current?.explosion(c.x, c.y, { fatal: true, affinity });
        vfxRef.current?.blood(c.x, c.y, 1, 0);
        vfxRef.current?.damageNumber(c.x, c.y, 42, { critical: true });
        setTimeout(() => {
          vfxRef.current?.death(c.x + 30, c.y, playerColor);
        }, 300);
      },
    },
    {
      name: 'Spawn Ceremony',
      desc: 'Spawn vortex + whisper pulse + damage number',
      fn: () => {
        const c = center();
        vfxRef.current?.spawn(c.x, c.y, playerColor);
        setTimeout(() => {
          vfxRef.current?.whisper(c.x, c.y, { decree: true });
          vfxRef.current?.damageNumber(c.x, c.y, 0, { text: 'BORN', color: '#22c55e' });
        }, 1200);
      },
    },
    {
      name: 'Projectile → Impact',
      desc: 'Trail then explosion at destination',
      fn: () => {
        const c = center();
        vfxRef.current?.projectile(c.x - 140, c.y - 40, c.x + 60, c.y + 20, { affinity });
        setTimeout(() => {
          vfxRef.current?.explosion(c.x + 60, c.y + 20, { affinity });
          vfxRef.current?.damageNumber(c.x + 60, c.y + 20, 28);
          vfxRef.current?.hitFlash(c.x + 60, c.y + 20);
        }, 350);
      },
    },
    {
      name: 'Chaos (everything)',
      desc: 'All effects at once',
      fn: () => {
        const c = center();
        vfxRef.current?.explosion(c.x - 60, c.y - 40, { fatal: true, affinity: 'flame' });
        vfxRef.current?.explosion(c.x + 60, c.y + 30, { affinity: 'tide' });
        vfxRef.current?.blood(c.x + 20, c.y - 20, -1, 1);
        vfxRef.current?.projectile(c.x - 120, c.y + 50, c.x + 80, c.y - 30, { affinity: 'shadow' });
        vfxRef.current?.spawn(c.x - 40, c.y + 60, '#a855f7');
        vfxRef.current?.whisper(c.x + 80, c.y + 60, { decree: true });
        vfxRef.current?.damageNumber(c.x - 60, c.y - 40, 99, { critical: true });
        vfxRef.current?.damageNumber(c.x + 60, c.y + 30, 15);
        vfxRef.current?.hitFlash(c.x, c.y);
        setTimeout(() => {
          vfxRef.current?.death(c.x, c.y, '#ef4444');
          vfxRef.current?.damageNumber(c.x, c.y, 0, { text: 'KILLED', color: '#ff4040', critical: true });
        }, 400);
      },
    },
  ];

  return (
    <div className="h-screen flex flex-col" style={{ background: 'var(--bg-abyss)' }}>
      {/* Tab bar */}
      <div className="flex border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
        {[
          { id: 'vfx', label: 'Particle VFX' },
          { id: 'sprites', label: 'Character Sprites' },
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="px-5 py-3 text-sm font-mono tracking-wider transition-colors"
            style={{
              color: tab === t.id ? 'var(--gold-bright)' : 'var(--text-muted)',
              borderBottom: tab === t.id ? '2px solid var(--gold-bright)' : '2px solid transparent',
              background: tab === t.id ? 'rgba(212,160,82,0.05)' : 'transparent',
            }}
          >
            {t.label}
          </button>
        ))}
        <div className="flex-1" />
        <a
          href="/"
          className="px-4 py-3 text-xs font-mono transition-colors hover:text-amber-400"
          style={{ color: 'var(--text-muted)' }}
        >
          ← Back to game
        </a>
      </div>

      {tab === 'sprites' ? (
        <div className="flex-1 overflow-y-auto p-6">
          <SpriteShowcase />
        </div>
      ) : (
        <div className="flex-1 flex">
          {/* Left: Canvas + SVG arena */}
          <div className="flex-1 relative">
            <div ref={containerRef} className="absolute inset-0">
              <VFXOverlay ref={vfxRef} svgRef={svgRef} containerRef={containerRef} />
              <svg
                ref={svgRef}
                viewBox="-200 -150 400 300"
                preserveAspectRatio="xMidYMid meet"
                className="w-full h-full"
                onClick={(e) => {
                  const svg = svgRef.current;
                  if (!svg || !vfxRef.current) return;
                  const pt = svg.createSVGPoint();
                  pt.x = e.clientX;
                  pt.y = e.clientY;
                  const svgPt = pt.matrixTransform(svg.getScreenCTM().inverse());
                  vfxRef.current.explosion(svgPt.x, svgPt.y, { affinity });
                  vfxRef.current.damageNumber(svgPt.x, svgPt.y, Math.floor(Math.random() * 50 + 5), {
                    critical: Math.random() > 0.6,
                  });
                }}
              >
                {[
                  [0, 0], [-60, -35], [60, -35], [-60, 35], [60, 35],
                  [-120, 0], [120, 0], [0, -70], [0, 70],
                ].map(([x, y], i) => (
                  <g key={i} transform={`translate(${x}, ${y})`}>
                    <polygon
                      points="30,0 15,26 -15,26 -30,0 -15,-26 15,-26"
                      fill="rgba(255,255,255,0.03)"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                    {i === 0 && (
                      <text
                        textAnchor="middle" dy="4"
                        fill="rgba(255,255,255,0.15)" fontSize="8" fontFamily="monospace"
                      >
                        CENTER
                      </text>
                    )}
                  </g>
                ))}
                <text
                  x="0" y="130" textAnchor="middle"
                  fill="rgba(255,255,255,0.12)" fontSize="10" fontFamily="monospace"
                >
                  Click anywhere to spawn an explosion
                </text>
              </svg>
            </div>

            {lastFired && (
              <div
                className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full text-xs font-mono"
                style={{
                  background: 'rgba(212,160,82,0.15)',
                  border: '1px solid var(--gold-dim)',
                  color: 'var(--gold-bright)',
                }}
              >
                {lastFired}
              </div>
            )}
          </div>

          {/* Right: Controls panel */}
          <div
            className="w-80 flex flex-col overflow-y-auto border-l"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'rgba(255,255,255,0.08)',
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <h1
                className="font-title text-xl tracking-widest"
                style={{ color: 'var(--gold-bright)' }}
              >
                VFX Test
              </h1>
              <p className="text-xs mt-1 font-mono" style={{ color: 'var(--text-muted)' }}>
                Click buttons or click the arena
              </p>
            </div>

            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                AFFINITY
              </div>
              <div className="flex flex-wrap gap-1.5">
                {AFFINITY_NAMES.map((a, i) => (
                  <button
                    key={a}
                    onClick={() => setAffIdx(i)}
                    className="px-2 py-1 rounded text-xs font-mono capitalize transition-all"
                    style={{
                      background: i === affIdx ? 'rgba(212,160,82,0.2)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${i === affIdx ? 'var(--gold-dim)' : 'rgba(255,255,255,0.06)'}`,
                      color: i === affIdx ? 'var(--gold-bright)' : 'var(--text-secondary)',
                    }}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                PLAYER COLOR
              </div>
              <div className="flex gap-2">
                {PLAYER_COLORS.map((c, i) => (
                  <button
                    key={c}
                    onClick={() => setColorIdx(i)}
                    className="w-7 h-7 rounded-full transition-all"
                    style={{
                      background: c,
                      border: `2px solid ${i === colorIdx ? '#fff' : 'transparent'}`,
                      boxShadow: i === colorIdx ? `0 0 8px ${c}` : 'none',
                      opacity: i === colorIdx ? 1 : 0.5,
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="p-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
              <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: 'var(--text-muted)' }}>
                INDIVIDUAL EFFECTS
              </div>
              <div className="space-y-1.5">
                {effects.map((e) => (
                  <button
                    key={e.name}
                    onClick={() => fire(e.name, e.fn)}
                    className="w-full text-left px-3 py-2 rounded transition-all hover:brightness-110"
                    style={{
                      background: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.06)',
                    }}
                  >
                    <div className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>
                      {e.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {e.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3">
              <div className="text-xs font-mono mb-2 tracking-wider" style={{ color: 'var(--gold-dim)' }}>
                COMBOS
              </div>
              <div className="space-y-1.5">
                {combos.map((c) => (
                  <button
                    key={c.name}
                    onClick={() => fire(c.name, c.fn)}
                    className="w-full text-left px-3 py-2 rounded transition-all hover:brightness-110"
                    style={{
                      background: 'rgba(212,160,82,0.06)',
                      border: '1px solid rgba(212,160,82,0.15)',
                    }}
                  >
                    <div className="text-sm font-mono" style={{ color: 'var(--gold-bright)' }}>
                      {c.name}
                    </div>
                    <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {c.desc}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
