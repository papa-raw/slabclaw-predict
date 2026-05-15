import { useMemo, useState, useEffect, useRef } from 'react';
import { hexToPixel } from '@lib/hexMath.js';
import { TERRAIN_COLORS, getPlayerColor } from '@lib/terrainTypes.js';

const HEX_SIZE = 40;

export default function HexMap({ hexes, spirits, playerId, selectedSpirit, onSelectSpirit, gameState, whisperTrails = [] }) {
  const hexArray = useMemo(() => Object.values(hexes), [hexes]);
  const [hoveredHex, setHoveredHex] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeTrails, setActiveTrails] = useState([]);
  const [pulsingSpirits, setPulsingSpirits] = useState(new Set());
  const [dyingSpirits, setDyingSpirits] = useState(new Set()); // fade-out animation
  const prevSpiritsRef = useRef({});

  // Detect spirit deaths for fade-out animation
  useEffect(() => {
    const prev = prevSpiritsRef.current;
    const newlyDead = new Set();
    for (const [id, spirit] of Object.entries(spirits)) {
      if (!spirit.alive && prev[id]?.alive) {
        newlyDead.add(id);
      }
    }
    if (newlyDead.size > 0) {
      setDyingSpirits(prev => new Set([...prev, ...newlyDead]));
      // Remove after animation completes
      setTimeout(() => {
        setDyingSpirits(prev => {
          const next = new Set(prev);
          newlyDead.forEach(id => next.delete(id));
          return next;
        });
      }, 1000);
    }
    prevSpiritsRef.current = spirits;
  }, [spirits]);

  useEffect(() => {
    if (!whisperTrails.length) return;
    const newTrails = whisperTrails.map(t => ({ ...t, id: `${t.from}-${t.to}-${Date.now()}` }));
    setActiveTrails(prev => [...prev, ...newTrails]);
    const arrivalIds = new Set(whisperTrails.map(t => t.to));
    setPulsingSpirits(prev => new Set([...prev, ...arrivalIds]));
    const timer = setTimeout(() => {
      setActiveTrails(prev => prev.filter(t => !newTrails.some(n => n.id === t.id)));
      setPulsingSpirits(prev => { const next = new Set(prev); arrivalIds.forEach(id => next.delete(id)); return next; });
    }, 2000);
    return () => clearTimeout(timer);
  }, [whisperTrails]);

  // Calculate SVG viewBox to fit all hexes
  const points = hexArray.map(h => hexToPixel({ q: h.q, r: h.r }, HEX_SIZE));
  const minX = Math.min(...points.map(p => p.x)) - HEX_SIZE * 2;
  const maxX = Math.max(...points.map(p => p.x)) + HEX_SIZE * 2;
  const minY = Math.min(...points.map(p => p.y)) - HEX_SIZE * 2;
  const maxY = Math.max(...points.map(p => p.y)) + HEX_SIZE * 2;

  return (
    <div className="relative w-full h-full">
    <svg
      viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`}
      className="w-full h-full"
      style={{ background: 'var(--bg-deep)' }}
      onMouseLeave={() => setHoveredHex(null)}
    >
      {hexArray.map(hex => {
        const { x, y } = hexToPixel({ q: hex.q, r: hex.r }, HEX_SIZE);
        const terrainColor = TERRAIN_COLORS[hex.terrain] || '#374151';
        const controlColor = hex.controller ? (getPlayerColor(hex.controller, gameState) || '#6b7280') : null;
        const hexSpirits = hex.spiritIds.map(id => spirits[id]).filter(Boolean);
        const rawName = hex.controller ? (gameState.players[hex.controller]?.name || hex.controller) : null;
        const controllerName = rawName === 'You' ? 'Your' : rawName ? `${rawName}'s` : null;

        return (
          <g
            key={hex.id}
            transform={`translate(${x}, ${y})`}
            onMouseEnter={(e) => {
              setHoveredHex({ hex, controllerName, hexSpirits });
              const containerRect = e.currentTarget.closest('div').getBoundingClientRect();
              setTooltipPos({
                x: e.clientX - containerRect.left + 10,
                y: e.clientY - containerRect.top - 10,
              });
            }}
            onMouseMove={(e) => {
              const containerRect = e.currentTarget.closest('div').getBoundingClientRect();
              setTooltipPos({
                x: e.clientX - containerRect.left + 10,
                y: e.clientY - containerRect.top - 10,
              });
            }}
            onMouseLeave={() => setHoveredHex(null)}
          >
            {/* Hex shape */}
            <polygon
              points={hexPoints(HEX_SIZE)}
              fill={terrainColor}
              stroke={controlColor || '#1f2937'}
              strokeWidth={controlColor ? 3 : 1}
              opacity={0.85}
              className="cursor-pointer hover:opacity-100 transition-opacity"
              style={{ transition: 'stroke 0.5s ease, stroke-width 0.3s ease' }}
            />

            {/* Territory control glow */}
            {controlColor && (
              <polygon
                points={hexPoints(HEX_SIZE - 4)}
                fill="none"
                stroke={controlColor}
                strokeWidth={1}
                opacity={0.4}
              />
            )}

            {/* Memory pool indicator */}
            {hex.memoryPool > 0 && (
              <text x={0} y={HEX_SIZE * 0.55} textAnchor="middle" fontSize="9" fill="rgba(251,191,36,0.6)" fontFamily="monospace">
                {Math.round(hex.memoryPool)}
              </text>
            )}

            {/* Spirit indicators */}
            {hexSpirits.map((spirit, i) => {
              const angle = (2 * Math.PI * i) / Math.max(hexSpirits.length, 1);
              const r = hexSpirits.length === 1 ? 0 : HEX_SIZE * 0.35;
              const sx = r * Math.cos(angle);
              const sy = r * Math.sin(angle);
              const isSelected = spirit.id === selectedSpirit;
              const isDying = dyingSpirits.has(spirit.id);
              const isDead = !spirit.alive;

              // Skip rendering fully-dead spirits (not in dying animation)
              if (isDead && !isDying) return null;

              return (
                <g
                  key={spirit.id}
                  transform={`translate(${sx}, ${sy})`}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (spirit.alive) onSelectSpirit(spirit.id);
                  }}
                  style={{ cursor: spirit.alive ? 'pointer' : 'default' }}
                >
                  {/* Reincarnation ring — pulsing purple ring for spirits with past lives */}
                  {(spirit.reincarnationCount > 0 || spirit.pastLifeMemories?.length > 0) && !isDying && (
                    <circle
                      r={10}
                      fill="none"
                      stroke="#a855f7"
                      strokeWidth={1.5}
                    >
                      <animate attributeName="opacity" values="0.4;0.9;0.4" dur="3s" repeatCount="indefinite" />
                      <animate attributeName="r" values="9.5;10.5;9.5" dur="3s" repeatCount="indefinite" />
                    </circle>
                  )}
                  <circle
                    r={6}
                    fill={getPlayerColor(spirit.playerId, gameState) || '#6b7280'}
                    stroke={isSelected ? '#f59e0b' : spirit.generation > 0 ? 'rgba(255,255,255,0.5)' : 'none'}
                    strokeWidth={isSelected ? 2 : spirit.generation > 0 ? 1.5 : 0}
                    opacity={isDying ? undefined : 1}
                  >
                    {isDying && (
                      <animate attributeName="opacity" values="1;0" dur="1s" fill="freeze" />
                    )}
                    {isDying && (
                      <animate attributeName="r" values="6;12" dur="1s" fill="freeze" />
                    )}
                  </circle>
                  {spirit.generation > 0 && !isDying && (
                    <circle r={2} fill="rgba(255,255,255,0.6)" />
                  )}
                  {spirit.currentAction && !isDying && (
                    <circle r={8} fill="none" stroke="#f59e0b" strokeWidth={1} opacity={0.5}>
                      <animate attributeName="r" values="8;10;8" dur="2s" repeatCount="indefinite" />
                    </circle>
                  )}
                </g>
              );
            })}

            {/* Terrain label */}
            <text x={0} y={-HEX_SIZE * 0.15} textAnchor="middle" fontSize="7" fill="rgba(255,255,255,0.25)" fontFamily="monospace" style={{ pointerEvents: 'none' }}>
              {hex.terrain}
            </text>
          </g>
        );
      })}

      {/* Whisper trail lines */}
      {activeTrails.map(trail => {
        const fromSpirit = spirits[trail.from];
        const toSpirit = spirits[trail.to];
        if (!fromSpirit || !toSpirit) return null;
        const fromHex = hexes[fromSpirit.hexId];
        const toHex = hexes[toSpirit.hexId];
        if (!fromHex || !toHex) return null;
        const p1 = hexToPixel({ q: fromHex.q, r: fromHex.r }, HEX_SIZE);
        const p2 = hexToPixel({ q: toHex.q, r: toHex.r }, HEX_SIZE);
        return (
          <line key={trail.id} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
            stroke="#f59e0b" strokeWidth={1.5} opacity={0.6} strokeDasharray="4 3">
            <animate attributeName="opacity" values="0.8;0.2;0" dur="2s" fill="freeze" />
            <animate attributeName="stroke-dashoffset" values="0;-14" dur="0.5s" repeatCount="4" />
          </line>
        );
      })}

      {/* Whisper arrival pulse on receiving spirits */}
      {[...pulsingSpirits].map(spiritId => {
        const s = spirits[spiritId];
        if (!s) return null;
        const hex = hexes[s.hexId];
        if (!hex) return null;
        const pos = hexToPixel({ q: hex.q, r: hex.r }, HEX_SIZE);
        return (
          <circle key={`pulse-${spiritId}`} cx={pos.x} cy={pos.y} r={6} fill="none"
            stroke="#f59e0b" strokeWidth={2}>
            <animate attributeName="r" values="6;18" dur="1s" repeatCount="2" />
            <animate attributeName="opacity" values="0.8;0" dur="1s" repeatCount="2" />
          </circle>
        );
      })}
      </svg>

    {/* Hex tooltip */}
    {hoveredHex && (
      <div
        className="absolute pointer-events-none z-10 bg-gray-900/95 border border-gray-600/50 rounded px-2.5 py-2 text-xs shadow-lg"
        style={{ left: tooltipPos.x, top: tooltipPos.y, maxWidth: 220 }}
      >
        <div className="font-mono text-gray-300 uppercase text-[10px] mb-0.5">
          {hoveredHex.hex.terrain} {hoveredHex.hex.biome ? `· ${hoveredHex.hex.biome}` : ''}
        </div>
        {hoveredHex.controllerName && (
          <div className="text-amber-400/80 text-[10px]">
            {hoveredHex.controllerName} territory
          </div>
        )}
        {hoveredHex.hex.memoryPool > 0 && (
          <div className="text-amber-500/50 text-[10px]">
            {Math.round(hoveredHex.hex.memoryPool)} memories pooled
          </div>
        )}
        {hoveredHex.hexSpirits?.length > 0 && (
          <div className="mt-1 border-t border-gray-700/50 pt-1">
            {hoveredHex.hexSpirits.filter(s => s.alive).map(s => (
              <div key={s.id} className="text-[10px] py-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: getPlayerColor(s.playerId, gameState) }} />
                  <span className="text-gray-200">{s.name}</span>
                  <span className="text-gray-500">{s.personalityProfile || s.specialization}</span>
                  {s.reincarnationCount > 0 && (
                    <span className="text-purple-400">✦{s.reincarnationCount}</span>
                  )}
                  {s.currentAction && (
                    <span className="text-amber-400/60 italic">{s.currentAction.type}</span>
                  )}
                </div>
                {s.previousNames?.length > 0 && (() => {
                  const pastNames = s.previousNames.filter(n => n !== s.name);
                  return pastNames.length > 0 ? (
                    <div className="text-[9px] text-purple-400/50 pl-3 italic">
                      past: {pastNames.slice(0, 2).join(', ')}
                    </div>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
        )}
      </div>
    )}
    </div>
  );
}

function hexPoints(size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${size * Math.cos(angle)},${size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}
