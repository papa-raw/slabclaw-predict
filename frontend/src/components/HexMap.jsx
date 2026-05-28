import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { hexToPixel } from '@lib/hexMath.js';
import { getPlayerColor } from '@lib/terrainTypes.js';
import { AFFINITIES, CAPTAIN_CLASSES } from '@lib/classSystem.js';
import VFXOverlay from '../vfx/VFXOverlay.jsx';
import SpiritSprite from './SpiritSprite.jsx';

const HEX_SIZE = 40;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3.0;
const ZOOM_STEP = 0.12;

const TERRAIN = {
  forest:    { base: '#1a4528', light: '#246832', dark: '#0f301a', feature: '#0a2010' },
  desert:    { base: '#b89040', light: '#c8a050', dark: '#987028', feature: '#806018' },
  ocean:     { base: '#142e50', light: '#1c3e60', dark: '#0c2040', feature: '#24507a' },
  mountain:  { base: '#3e3e4e', light: '#4e4e5e', dark: '#2e2e3e', feature: '#d0d0d8' },
  grassland: { base: '#1e6225', light: '#28722f', dark: '#14521b', feature: '#0e3a10' },
  tundra:    { base: '#7898b0', light: '#88a8c0', dark: '#6888a0', feature: '#a8c0d8' },
  volcanic:  { base: '#200a0a', light: '#301212', dark: '#140606', feature: '#d03810' },
  coastal:   { base: '#164838', light: '#1e5848', dark: '#0e3828', feature: '#308870' },
};

function createRng(seed) {
  let s = Math.abs(seed * 2654435761 | 0) || 1;
  return () => { s = (s * 16807 + 12345) % 2147483647; return (s & 0x7fffffff) / 2147483647; };
}

// adj moved to SpiritSprite.jsx

function hexPoly(size) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 6;
    pts.push(`${size * Math.cos(a)},${size * Math.sin(a)}`);
  }
  return pts.join(' ');
}

const HEX_POINTS = hexPoly(HEX_SIZE);
const HEX_POINTS_INNER = hexPoly(HEX_SIZE - 3);

function TerrainDetail({ type, seed }) {
  const rng = createRng(seed);
  const S = HEX_SIZE * 0.7;

  switch (type) {
    case 'forest': {
      const count = 3 + (seed % 3);
      return Array.from({ length: count }, (_, i) => {
        const tx = (rng() - 0.5) * S * 1.4;
        const ty = (rng() - 0.5) * S * 1.4;
        const h = 7 + rng() * 6;
        return (
          <g key={i} transform={`translate(${tx},${ty})`}>
            <polygon points={`0,${-h} ${h * 0.5},0 ${-h * 0.5},0`} fill={TERRAIN.forest.feature} opacity={0.8} />
            <polygon points={`0,${-h * 0.65} ${h * 0.35},${h * 0.15} ${-h * 0.35},${h * 0.15}`} fill={TERRAIN.forest.dark} opacity={0.6} />
            <rect x={-0.8} y={0} width={1.6} height={h * 0.22} fill="#2a1a08" opacity={0.6} />
          </g>
        );
      });
    }

    case 'desert': {
      const elements = [];
      for (let i = 0; i < 2; i++) {
        const dy = (i - 0.5) * S * 0.6 + (rng() - 0.5) * 6;
        elements.push(
          <path key={`d${i}`}
            d={`M${-S * 0.9},${dy} Q${-S * 0.3},${dy - 4 - rng() * 3} ${S * 0.1},${dy} Q${S * 0.5},${dy + 3} ${S * 0.9},${dy - 1}`}
            fill="none" stroke={TERRAIN.desert.dark} strokeWidth={1.5} opacity={0.3}
          />
        );
      }
      for (let i = 0; i < 4; i++) {
        elements.push(
          <circle key={`r${i}`} cx={(rng() - 0.5) * S * 1.4} cy={(rng() - 0.5) * S * 1.4}
            r={0.6 + rng() * 0.6} fill={TERRAIN.desert.dark} opacity={0.25} />
        );
      }
      return elements;
    }

    case 'ocean': {
      return Array.from({ length: 3 }, (_, i) => {
        const wy = (i - 1) * S * 0.5 + (rng() - 0.5) * 4;
        const amp = 2 + rng() * 2;
        return (
          <path key={i}
            d={`M${-S},${wy} q${S * 0.4},${-amp} ${S * 0.8},0 q${S * 0.4},${amp} ${S * 0.8},0`}
            fill="none" stroke={TERRAIN.ocean.feature} strokeWidth={1} opacity={0.25 + rng() * 0.15}
          />
        );
      });
    }

    case 'mountain': {
      const count = 2 + (seed % 2);
      return Array.from({ length: count }, (_, i) => {
        const px = (rng() - 0.5) * S * 1.0;
        const py = (rng() - 0.5) * S * 0.8 + 2;
        const h = 10 + rng() * 8;
        const w = h * 0.65;
        return (
          <g key={i} transform={`translate(${px},${py})`}>
            <polygon points={`0,${-h} ${w},${h * 0.2} ${-w},${h * 0.2}`} fill={TERRAIN.mountain.dark} opacity={0.7} />
            <polygon points={`0,${-h} ${w * 0.3},${-h * 0.45} ${-w * 0.3},${-h * 0.45}`} fill={TERRAIN.mountain.feature} opacity={0.5} />
          </g>
        );
      });
    }

    case 'grassland': {
      const elements = [];
      for (let i = 0; i < 7; i++) {
        const gx = (rng() - 0.5) * S * 1.6;
        const gy = (rng() - 0.5) * S * 1.6;
        elements.push(
          <g key={i} transform={`translate(${gx},${gy})`}>
            <line x1={-1} y1={1.5} x2={-1.5} y2={-2} stroke={TERRAIN.grassland.feature} strokeWidth={0.7} opacity={0.5} />
            <line x1={0.5} y1={1.5} x2={0.8} y2={-2.5} stroke={TERRAIN.grassland.dark} strokeWidth={0.7} opacity={0.5} />
            <line x1={2} y1={1.5} x2={1.5} y2={-1.5} stroke={TERRAIN.grassland.feature} strokeWidth={0.7} opacity={0.4} />
          </g>
        );
      }
      if (seed % 4 === 0) {
        elements.push(<circle key="fl" cx={(rng() - 0.5) * S} cy={(rng() - 0.5) * S} r={1.5} fill="#c8a030" opacity={0.5} />);
      }
      return elements;
    }

    case 'tundra': {
      const elements = [];
      for (let i = 0; i < 3; i++) {
        const cx = (rng() - 0.5) * S * 1.2;
        const cy = (rng() - 0.5) * S * 1.2;
        const dx = (rng() - 0.5) * 14;
        const dy = (rng() - 0.5) * 14;
        elements.push(
          <line key={`c${i}`} x1={cx} y1={cy} x2={cx + dx} y2={cy + dy}
            stroke={TERRAIN.tundra.dark} strokeWidth={0.8} opacity={0.25} />
        );
      }
      for (let i = 0; i < 2; i++) {
        elements.push(
          <ellipse key={`s${i}`} cx={(rng() - 0.5) * S} cy={(rng() - 0.5) * S}
            rx={3 + rng() * 4} ry={1.5 + rng() * 1.5} fill={TERRAIN.tundra.feature} opacity={0.2} />
        );
      }
      return elements;
    }

    case 'volcanic': {
      const elements = [];
      for (let i = 0; i < 4; i++) {
        const cx = (rng() - 0.5) * S * 1.2;
        const cy = (rng() - 0.5) * S * 1.2;
        const dx = (rng() - 0.5) * 16;
        const dy = (rng() - 0.5) * 16;
        elements.push(
          <line key={`l${i}`} x1={cx} y1={cy} x2={cx + dx} y2={cy + dy}
            stroke={TERRAIN.volcanic.feature} strokeWidth={0.8 + rng() * 0.8} opacity={0.4 + rng() * 0.3} />
        );
      }
      for (let i = 0; i < 3; i++) {
        elements.push(
          <circle key={`e${i}`} cx={(rng() - 0.5) * S * 1.1} cy={(rng() - 0.5) * S * 1.1}
            r={0.6 + rng() * 0.5} fill="#ff6020" opacity={0.5} />
        );
      }
      return elements;
    }

    case 'coastal': {
      const elements = [];
      elements.push(
        <path key="water"
          d={`M${S},${-S * 0.8} Q${S * 0.3},${-S * 0.1} ${-S * 0.2},${S * 0.3} L${-S},${S} L${S},${S} Z`}
          fill={TERRAIN.ocean.base} opacity={0.35}
        />
      );
      elements.push(
        <path key="shore"
          d={`M${S * 0.9},${-S * 0.7} Q${S * 0.3},${0} ${-S * 0.3},${S * 0.4}`}
          fill="none" stroke={TERRAIN.coastal.feature} strokeWidth={1.5} opacity={0.35}
        />
      );
      for (let i = 0; i < 3; i++) {
        elements.push(
          <circle key={`f${i}`} cx={rng() * S * 0.6} cy={(rng() - 0.3) * S * 0.8}
            r={0.8} fill="#fff" opacity={0.12} />
        );
      }
      return elements;
    }

    default:
      return null;
  }
}

// Animation frames & getAnimData moved to SpiritSprite.jsx

export default function HexMap({ hexes, spirits, playerId, selectedSpirit, onSelectSpirit, onHexCommand, gameState, whisperTrails = [], events = [] }) {
  const hexArray = useMemo(() => Object.values(hexes), [hexes]);
  const [hoveredHex, setHoveredHex] = useState(null);
  const [hoveredSpirit, setHoveredSpirit] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeTrails, setActiveTrails] = useState([]);
  const [speechBubbles, setSpeechBubbles] = useState({});
  const [pulsingSpirits, setPulsingSpirits] = useState(new Set());
  const [dyingSpirits, setDyingSpirits] = useState(new Set());
  const [moveTrails, setMoveTrails] = useState([]);
  const [battleEffects, setBattleEffects] = useState([]);
  const [spawnEffects, setSpawnEffects] = useState([]);
  const [claimFlashes, setClaimFlashes] = useState([]);
  const [decreeWaves, setDecreeWaves] = useState([]);
  const [rallyPoint, setRallyPoint] = useState(null);
  const prevSpiritsRef = useRef({});
  const processedEventsRef = useRef(new Set());
  const vfxRef = useRef(null);
  const gameContainerRef = useRef(null);

  // --- Animation system: 8fps frame counter for retro sprite feel ---
  const [animTick, setAnimTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setAnimTick(t => (t + 1) % 240), 125);
    return () => clearInterval(id);
  }, []);

  // Track previous hex positions for smooth movement + facing direction
  const prevHexPositions = useRef({});
  const spiritFacing = useRef({});
  const movingUntilRef = useRef({});

  useEffect(() => {
    const prev = prevSpiritsRef.current;
    const newlyDead = new Set();
    for (const [id, spirit] of Object.entries(spirits)) {
      if (!spirit.alive && prev[id]?.alive) newlyDead.add(id);
    }
    if (newlyDead.size > 0) {
      setDyingSpirits(p => new Set([...p, ...newlyDead]));
      setTimeout(() => {
        setDyingSpirits(p => { const n = new Set(p); newlyDead.forEach(id => n.delete(id)); return n; });
      }, 1200);

      // Canvas VFX death dissolve
      if (vfxRef.current) {
        for (const id of newlyDead) {
          const spirit = prev[id];
          if (!spirit) continue;
          const h = hexes[spirit.hexId];
          if (!h) continue;
          const p = hexToPixel({ q: h.q, r: h.r }, HEX_SIZE);
          const pc = getPlayerColor(spirit.playerId, gameState) || '#6b7280';
          vfxRef.current.death(p.x, p.y, pc);
        }
      }
    }

    // Generate speech bubbles for combat/spawning only (not move/explore)
    for (const [id, spirit] of Object.entries(spirits)) {
      if (!spirit.alive) continue;
      const prevAction = prev[id]?.currentAction?.type;
      const curAction = spirit.currentAction?.type;
      if (curAction && curAction !== prevAction) {
        const labels = {
          battling: 'To battle!',
          spawning: 'Creating new life...',
        };
        const text = labels[curAction];
        if (text) {
          setSpeechBubbles(p => ({ ...p, [id]: { text, ts: Date.now() } }));
          setTimeout(() => setSpeechBubbles(p => { const n = { ...p }; if (n[id]?.text === text) delete n[id]; return n; }), 4000);
        }
      }
    }

    prevSpiritsRef.current = spirits;
  }, [spirits]);

  useEffect(() => {
    if (!events.length) return;
    const now = Date.now();
    for (const evt of events) {
      const eid = `${evt.type}-${evt.timestamp || ''}-${evt.hexId || evt.spiritId || evt.sourceId || evt.from || ''}-${evt.targetId || evt.to || ''}`;
      if (processedEventsRef.current.has(eid)) continue;
      processedEventsRef.current.add(eid);
      if (evt.timestamp && now - evt.timestamp > 8000) continue;

      if (evt.type === 'movement_complete' && evt.fromHex && evt.toHex) {
        const fh = hexes[evt.fromHex];
        const th = hexes[evt.toHex];
        if (fh && th) {
          const p1 = hexToPixel({ q: fh.q, r: fh.r }, HEX_SIZE);
          const p2 = hexToPixel({ q: th.q, r: th.r }, HEX_SIZE);
          const spirit = spirits[evt.spiritId];
          const pc = spirit ? (getPlayerColor(spirit.playerId, gameState) || '#6b7280') : '#6b7280';
          setMoveTrails(prev => [...prev, { id: eid, p1, p2, color: pc }]);
          setTimeout(() => setMoveTrails(prev => prev.filter(t => t.id !== eid)), 1200);
        }
      }

      if (evt.type === 'battle_resolved' && evt.hexId) {
        const bh = hexes[evt.hexId];
        if (bh) {
          const p = hexToPixel({ q: bh.q, r: bh.r }, HEX_SIZE);
          const winner = spirits[evt.winnerId];
          const loser = spirits[evt.loserId];
          const pc = winner ? (getPlayerColor(winner.playerId, gameState) || '#dc3545') : '#dc3545';
          const fatal = evt.loserOutcome === 'died';
          setBattleEffects(prev => [...prev, { id: eid, pos: p, color: pc, fatal, margin: evt.margin || 0 }]);
          setTimeout(() => setBattleEffects(prev => prev.filter(e => e.id !== eid)), 2000);

          // Canvas VFX explosion
          if (vfxRef.current) {
            const affinity = winner?.affinity || undefined;
            vfxRef.current.explosion(p.x, p.y, { fatal, affinity, scale: 0.45 });
            vfxRef.current.damageNumber(p.x, p.y, evt.margin || Math.floor(Math.random() * 30 + 10), { critical: fatal });
            if (fatal && loser) {
              const lh = hexes[loser.hexId || evt.hexId];
              if (lh) {
                const lp = hexToPixel({ q: lh.q, r: lh.r }, HEX_SIZE);
                const dirX = lp.x - p.x;
                const dirY = lp.y - p.y;
                vfxRef.current.blood(p.x, p.y, dirX || 1, dirY || 0);
              }
            }
          }
        }
      }

      if (evt.type === 'swarmling_battle' && evt.hexId) {
        const bh = hexes[evt.hexId];
        if (bh) {
          const p = hexToPixel({ q: bh.q, r: bh.r }, HEX_SIZE);
          const winner = spirits[evt.winnerId];
          const pc = winner ? (getPlayerColor(winner.playerId, gameState) || '#dc3545') : '#dc3545';
          setBattleEffects(prev => [...prev, { id: eid, pos: p, color: pc, fatal: evt.killed, margin: evt.damage || 0 }]);
          setTimeout(() => setBattleEffects(prev => prev.filter(e => e.id !== eid)), 1500);

          if (vfxRef.current) {
            const affinity = winner?.affinity || undefined;
            vfxRef.current.explosion(p.x, p.y, { fatal: evt.killed, affinity, scale: 0.3 });
            vfxRef.current.damageNumber(p.x, p.y, evt.damage || 0, { critical: evt.killed });
          }
        }
      }

      if (evt.type === 'spawn_complete' && evt.hexId) {
        const sh = hexes[evt.hexId];
        if (sh) {
          const p = hexToPixel({ q: sh.q, r: sh.r }, HEX_SIZE);
          const parent = spirits[evt.parentId];
          const pc = parent ? (getPlayerColor(parent.playerId, gameState) || '#22c55e') : '#22c55e';
          setSpawnEffects(prev => [...prev, { id: eid, pos: p, color: pc, gen: evt.generation || 1 }]);
          setTimeout(() => setSpawnEffects(prev => prev.filter(e => e.id !== eid)), 2500);

          if (vfxRef.current) {
            const spawnedSpirit = evt.spiritId ? spirits[evt.spiritId] : null;
            vfxRef.current.spawn(p.x, p.y, pc, { affinity: spawnedSpirit?.affinity || evt.affinity });
          }
        }
      }

      if (evt.type === 'promotion' && evt.hexId) {
        const ph = hexes[evt.hexId];
        if (ph) {
          const p = hexToPixel({ q: ph.q, r: ph.r }, HEX_SIZE);
          const pc = evt.toTier === 'hero' ? '#f0c040' : '#60a5fa';
          setSpawnEffects(prev => [...prev, { id: eid, pos: p, color: pc, gen: 0 }]);
          setTimeout(() => setSpawnEffects(prev => prev.filter(e => e.id !== eid)), 3000);

          if (vfxRef.current) {
            const promoSpirit = evt.spiritId ? spirits[evt.spiritId] : null;
            vfxRef.current.spawn(p.x, p.y, pc, { affinity: promoSpirit?.affinity || evt.affinity });
            if (evt.toTier === 'hero') {
              vfxRef.current.explosion(p.x, p.y, { fatal: false, scale: 0.6 });
            }
          }
        }
      }

      if (evt.type === 'territory_claimed' && evt.hexId) {
        const ch = hexes[evt.hexId];
        if (ch) {
          const p = hexToPixel({ q: ch.q, r: ch.r }, HEX_SIZE);
          const pc = getPlayerColor(evt.playerId, gameState) || '#f59e0b';
          setClaimFlashes(prev => [...prev, { id: eid, pos: p, color: pc }]);
          setTimeout(() => setClaimFlashes(prev => prev.filter(e => e.id !== eid)), 1000);
        }
      }

      if ((evt.type === 'whisper_arrived' || evt.type === 'spirit_dialog') && (evt.from || evt.sourceId) && (evt.to || evt.targetId)) {
        const fromId = evt.from || evt.sourceId;
        const toId = evt.to || evt.targetId;
        const fromIsSpirit = !!spirits[fromId];
        const toIsSpirit = !!spirits[toId];

        if (fromIsSpirit && toIsSpirit) {
          const trail = { from: fromId, to: toId, text: evt.text || '~', id: eid };
          setActiveTrails(prev => [...prev, trail]);
          setTimeout(() => setActiveTrails(prev => prev.filter(t => t.id !== eid)), 3500);
        }

        // Decree/enemy whisper broadcast wave — emanates from target spirit
        if (!fromIsSpirit && toIsSpirit && (evt.dialogType === 'DECREE' || evt.dialogType === 'ENEMY_WHISPER')) {
          const targetSpirit = spirits[toId];
          if (targetSpirit) {
            const tHex = hexes[targetSpirit.hexId];
            if (tHex) {
              const isDecree = evt.dialogType === 'DECREE';
              setDecreeWaves(prev => [...prev, {
                id: eid,
                hexId: tHex.id,
                q: tHex.q, r: tHex.r,
                color: isDecree ? '#d4a052' : '#ef4444',
                ts: Date.now(),
              }]);
              setTimeout(() => setDecreeWaves(prev => prev.filter(w => w.id !== eid)), 2000);

              if (vfxRef.current) {
                const wp = hexToPixel({ q: tHex.q, r: tHex.r }, HEX_SIZE);
                vfxRef.current.whisper(wp.x, wp.y, { decree: isDecree });
              }
            }
          }
        }

        if (toIsSpirit) {
          setPulsingSpirits(prev => new Set([...prev, toId]));
          setTimeout(() => setPulsingSpirits(prev => { const n = new Set(prev); n.delete(toId); return n; }), 3500);
        }

        const bubbleTarget = toIsSpirit ? toId : fromIsSpirit ? fromId : null;
        if (bubbleTarget) {
          const bubbleText = evt.text ? (evt.text.length > 50 ? evt.text.slice(0, 47) + '...' : evt.text) : '...';
          setSpeechBubbles(prev => ({ ...prev, [bubbleTarget]: { text: bubbleText, ts: Date.now() } }));
          setTimeout(() => setSpeechBubbles(prev => { const n = { ...prev }; if (n[bubbleTarget]?.ts <= Date.now()) delete n[bubbleTarget]; return n; }), 5000);
        }
      }
    }
    if (processedEventsRef.current.size > 500) {
      const arr = [...processedEventsRef.current];
      processedEventsRef.current = new Set(arr.slice(-200));
    }
  }, [events, hexes, spirits, gameState]);

  useEffect(() => {
    if (!whisperTrails.length) return;
    const newTrails = whisperTrails.map(t => ({ ...t, id: `${t.from}-${t.to}-${Date.now()}` }));
    setActiveTrails(prev => [...prev, ...newTrails]);
    const arrivalIds = new Set(whisperTrails.map(t => t.to));
    setPulsingSpirits(prev => new Set([...prev, ...arrivalIds]));
    const timer = setTimeout(() => {
      setActiveTrails(prev => prev.filter(t => !newTrails.some(n => n.id === t.id)));
      setPulsingSpirits(prev => { const n = new Set(prev); arrivalIds.forEach(id => n.delete(id)); return n; });
    }, 2000);
    return () => clearTimeout(timer);
  }, [whisperTrails]);

  const worldBounds = useMemo(() => {
    const pts = hexArray.map(h => hexToPixel({ q: h.q, r: h.r }, HEX_SIZE));
    const pad = HEX_SIZE * 2.5;
    return {
      minX: Math.min(...pts.map(p => p.x)) - pad,
      maxX: Math.max(...pts.map(p => p.x)) + pad,
      minY: Math.min(...pts.map(p => p.y)) - pad,
      maxY: Math.max(...pts.map(p => p.y)) + pad,
    };
  }, [hexArray]);

  const baseW = worldBounds.maxX - worldBounds.minX;
  const baseH = worldBounds.maxY - worldBounds.minY;
  const baseCx = worldBounds.minX + baseW / 2;
  const baseCy = worldBounds.minY + baseH / 2;

  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const dragRef = useRef(null);
  const svgRef = useRef(null);

  const svgToWorld = useCallback((clientX, clientY) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();
    const vw = baseW / zoom;
    const vh = baseH / zoom;
    const vx = baseCx - vw / 2 + pan.x;
    const vy = baseCy - vh / 2 + pan.y;
    return {
      x: vx + ((clientX - rect.left) / rect.width) * vw,
      y: vy + ((clientY - rect.top) / rect.height) * vh,
    };
  }, [zoom, pan, baseW, baseH, baseCx, baseCy]);

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const worldBefore = svgToWorld(e.clientX, e.clientY);
    const dir = e.deltaY < 0 ? 1 : -1;
    setZoom(prev => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, prev * (1 + dir * ZOOM_STEP)));
      const scale = next / prev;
      setPan(p => ({
        x: p.x + (worldBefore.x - baseCx) * (1 - 1 / scale),
        y: p.y + (worldBefore.y - baseCy) * (1 - 1 / scale),
      }));
      return next;
    });
  }, [svgToWorld, baseCx, baseCy]);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  const handlePointerDown = useCallback((e) => {
    if (e.button !== 0) return;
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan }, dragged: false, pointerId: e.pointerId, target: e.currentTarget };
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dist = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY);
    if (dist > 4) {
      if (!dragRef.current.dragged) {
        dragRef.current.dragged = true;
        dragRef.current.target?.setPointerCapture(dragRef.current.pointerId);
      }
    }
    if (!dragRef.current.dragged) return;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vw = baseW / zoom;
    const vh = baseH / zoom;
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * vw;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * vh;
    setPan({ x: dragRef.current.startPan.x - dx, y: dragRef.current.startPan.y - dy });
  }, [zoom, baseW, baseH]);

  const handlePointerUp = useCallback((e) => {
    if (dragRef.current?.dragged) {
      e.currentTarget.releasePointerCapture?.(dragRef.current.pointerId);
    }
    dragRef.current = null;
  }, []);

  const vbW = baseW / zoom;
  const vbH = baseH / zoom;
  const vbX = baseCx - vbW / 2 + pan.x;
  const vbY = baseCy - vbH / 2 + pan.y;

  return (
    <div ref={gameContainerRef} className="relative w-full h-full" style={{ background: '#0c1018' }}>
      <VFXOverlay ref={vfxRef} svgRef={svgRef} containerRef={gameContainerRef} />
      <svg
        ref={svgRef}
        viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full h-full"
        onMouseLeave={() => setHoveredHex(null)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{ touchAction: 'none' }}
      >
        <defs>
          <clipPath id="hex-clip">
            <polygon points={HEX_POINTS} />
          </clipPath>
          <filter id="glow-battle" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-spawn" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="glow-target" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <rect x={vbX - vbW} y={vbY - vbH} width={vbW * 3} height={vbH * 3} fill="#0c1018" />

        {hexArray.map(hex => {
          const { x, y } = hexToPixel({ q: hex.q, r: hex.r }, HEX_SIZE);
          const t = TERRAIN[hex.terrain] || TERRAIN.grassland;
          const cc = hex.controller ? (getPlayerColor(hex.controller, gameState) || '#6b7280') : null;
          const hovered = hoveredHex?.hex?.id === hex.id;
          const seed = hex.q * 73 + hex.r * 137;

          return (
            <g
              key={hex.id}
              transform={`translate(${x}, ${y})`}
              onMouseEnter={(e) => {
                const hexSpirits = hex.spiritIds.map(id => spirits[id]).filter(Boolean);
                const rawName = hex.controller ? (gameState.players[hex.controller]?.name || hex.controller) : null;
                const controllerName = rawName === 'You' ? 'Your' : rawName ? `${rawName}'s` : null;
                setHoveredHex({ hex, controllerName, hexSpirits });
                const cr = e.currentTarget.closest('div').getBoundingClientRect();
                setTooltipPos({ x: e.clientX - cr.left + 14, y: e.clientY - cr.top - 10 });
              }}
              onMouseMove={(e) => {
                const cr = e.currentTarget.closest('div').getBoundingClientRect();
                setTooltipPos({ x: e.clientX - cr.left + 14, y: e.clientY - cr.top - 10 });
              }}
              onMouseLeave={() => setHoveredHex(null)}
              onClick={(e) => {
                if (dragRef.current?.dragged) return;
                if (onHexCommand) {
                  e.stopPropagation();
                  onHexCommand(hex.id);
                  setRallyPoint({ hexId: hex.id, ts: Date.now() });
                  setTimeout(() => setRallyPoint(rp => rp?.hexId === hex.id ? null : rp), 4000);
                }
              }}
              className="cursor-pointer"
            >
              <polygon points={HEX_POINTS} fill={t.base} />

              <g clipPath="url(#hex-clip)">
                <TerrainDetail type={hex.terrain} seed={seed} />
              </g>

              <polygon
                points={HEX_POINTS}
                fill="none"
                stroke={hovered ? '#f0d080' : (cc || 'rgba(255,255,255,0.07)')}
                strokeWidth={hovered ? 2 : (cc ? 2 : 0.6)}
                style={{ transition: 'stroke 0.2s, stroke-width 0.15s' }}
              />

              {cc && !hovered && (
                <polygon points={HEX_POINTS_INNER} fill="none" stroke={cc} strokeWidth={1.2} opacity={0.3} />
              )}

              {hex.memoryPool > 0 && (() => {
                const pool = Math.round(hex.memoryPool);
                const intensity = Math.min(1, pool / 40);
                const particles = Math.min(5, Math.ceil(pool / 8));
                const r = HEX_SIZE * 0.25;
                return (
                  <g opacity={0.3 + intensity * 0.5}>
                    {Array.from({ length: particles }, (_, i) => {
                      const angle = (2 * Math.PI * i) / particles;
                      const px = r * Math.cos(angle) * (0.5 + (seed + i) % 3 * 0.25);
                      const py = r * Math.sin(angle) * (0.5 + (seed + i * 7) % 3 * 0.25);
                      const sz = 1.2 + intensity * 1.5;
                      return (
                        <circle key={i} cx={px} cy={py} r={sz} fill="#2dd4bf" opacity={0.6}>
                          <animate attributeName="opacity" values="0.6;0.2;0.6" dur={`${1.5 + (i % 3) * 0.5}s`} repeatCount="indefinite" />
                        </circle>
                      );
                    })}
                    <circle cx={0} cy={0} r={2 + intensity * 3} fill="#2dd4bf" opacity={0.15 + intensity * 0.15}>
                      <animate attributeName="r" values={`${2 + intensity * 2};${3 + intensity * 4};${2 + intensity * 2}`} dur="2s" repeatCount="indefinite" />
                    </circle>
                    <text x={0} y={HEX_SIZE * 0.45} textAnchor="middle" fontSize="4.5"
                      fill="rgba(45,212,191,0.5)" fontFamily="monospace">{pool}</text>
                  </g>
                );
              })()}
            </g>
          );
        })}

        {/* Target hex highlights — where spirits are heading */}
        {Object.values(spirits).filter(s => s.alive && (s.currentAction?.type === 'moving' || s.currentAction?.type === 'exploring')).map(spirit => {
          const targetHexId = spirit.currentAction?.data?.toHex || spirit.currentAction?.data?.targetHex;
          const targetHex = targetHexId ? hexes[targetHexId] : null;
          if (!targetHex) return null;
          const { x, y } = hexToPixel({ q: targetHex.q, r: targetHex.r }, HEX_SIZE);
          const pc = getPlayerColor(spirit.playerId, gameState) || '#6b7280';
          return (
            <g key={`target-${spirit.id}`} transform={`translate(${x}, ${y})`} filter="url(#glow-target)">
              <polygon points={HEX_POINTS} fill="none" stroke={pc} strokeWidth={1.8} opacity={0.6} strokeDasharray="4 3">
                <animate attributeName="opacity" values="0.6;0.2;0.6" dur="1.5s" repeatCount="indefinite" />
              </polygon>
            </g>
          );
        })}

        {hexArray.flatMap(hex => {
          const { x, y } = hexToPixel({ q: hex.q, r: hex.r }, HEX_SIZE);
          const hexSpirits = hex.spiritIds.map(id => spirits[id]).filter(s => s && s.alive);
          if (hexSpirits.length === 0) return [];

          const captains = hexSpirits.filter(s => s.tier === 'captain' || s.tier === 'hero');
          const swarmlings = hexSpirits.filter(s => s.tier === 'swarmling');
          const featured = captains;

          const elements = [];

          // --- Swarmling cluster: colored dots grouped by player ---
          if (swarmlings.length > 0) {
            const byPlayer = {};
            for (const sw of swarmlings) {
              (byPlayer[sw.playerId] = byPlayer[sw.playerId] || []).push(sw);
            }
            const playerGroups = Object.entries(byPlayer);
            playerGroups.forEach(([pid, group], gi) => {
              const pc = getPlayerColor(pid, gameState) || '#6b7280';
              const affColor = AFFINITIES[group[0]?.affinity]?.glow || pc;
              const count = group.length;
              const baseAngle = (2 * Math.PI * gi) / Math.max(playerGroups.length, 1);
              const groupOffset = playerGroups.length > 1 ? HEX_SIZE * 0.22 : 0;
              const gx = x + groupOffset * Math.cos(baseAngle);
              const gy = y + groupOffset * Math.sin(baseAngle);

              if (count <= 3) {
                group.forEach((sw, si) => {
                  const a = (2 * Math.PI * si) / Math.max(count, 1);
                  const r = count === 1 ? 0 : 5;
                  elements.push(
                    <g key={sw.id} style={{ transform: `translate(${gx + r * Math.cos(a)}px, ${gy + r * Math.sin(a)}px)`, cursor: 'pointer' }}
                      onClick={e => { e.stopPropagation(); onSelectSpirit(sw.id); }}
                      onMouseEnter={() => setHoveredSpirit(sw.id)}
                      onMouseLeave={() => setHoveredSpirit(null)}>
                      <circle cx={0} cy={0} r={3} fill={affColor} stroke={pc} strokeWidth={0.8} opacity={0.9} />
                      {hoveredSpirit === sw.id && (
                        <text x={0} y={-6} textAnchor="middle" fontSize="4" fill="#e8dcc0" fontFamily="'Cinzel', serif">{sw.name}</text>
                      )}
                    </g>
                  );
                });
              } else {
                elements.push(
                  <g key={`swarm-${pid}-${hex.id}`} style={{ transform: `translate(${gx}px, ${gy}px)` }}
                    onClick={e => { e.stopPropagation(); if (group[0]) onSelectSpirit(group[0].id); }}>
                    <circle cx={0} cy={0} r={6 + Math.min(count, 15) * 0.3} fill={affColor} opacity={0.25}>
                      <animate attributeName="r" values={`${5 + count * 0.2};${7 + count * 0.3};${5 + count * 0.2}`} dur="2s" repeatCount="indefinite" />
                    </circle>
                    <circle cx={0} cy={0} r={4} fill={affColor} stroke={pc} strokeWidth={1} opacity={0.85} />
                    <text x={0} y={1.5} textAnchor="middle" fontSize="5" fill="#fff" fontWeight="bold" fontFamily="monospace">{count}</text>
                  </g>
                );
              }
            });
          }

          // --- Captains & Heroes: full sprites ---
          featured.forEach((spirit, i) => {
            const angle = (2 * Math.PI * i) / Math.max(featured.length, 1);
            const spread = featured.length === 1 && swarmlings.length === 0 ? 0
              : featured.length === 1 ? HEX_SIZE * 0.15 : HEX_SIZE * 0.3;
            const sx = x + spread * Math.cos(angle);
            const sy = y + spread * Math.sin(angle) + 5;
            const isSelected = spirit.id === selectedSpirit;
            const isDying = dyingSpirits.has(spirit.id);

            const isGhost = spirit._isGhost || spirit.playerId === 'ghost';
            const pc = isGhost ? '#a855f7' : (getPlayerColor(spirit.playerId, gameState) || '#6b7280');
            const spec = spirit.specialization || 'generalist';
            const affData = AFFINITIES[spirit.affinity];
            const affColor = affData?.glow || pc;
            const classData = spirit.captainClass ? CAPTAIN_CLASSES[spirit.captainClass] : null;

            const isHovered = hoveredSpirit === spirit.id;
            const isMine = spirit.playerId === playerId;

            const prevHex = prevHexPositions.current[spirit.id];
            const now = Date.now();
            if (prevHex && prevHex !== spirit.hexId) {
              movingUntilRef.current[spirit.id] = now + 600;
              const prevHexData = hexes[prevHex];
              const curHexData = hexes[spirit.hexId];
              if (prevHexData && curHexData) {
                const oldPos = hexToPixel({ q: prevHexData.q, r: prevHexData.r }, HEX_SIZE);
                const newPos = hexToPixel({ q: curHexData.q, r: curHexData.r }, HEX_SIZE);
                spiritFacing.current[spirit.id] = newPos.x >= oldPos.x ? 1 : -1;
              }
            }
            prevHexPositions.current[spirit.id] = spirit.hexId;

            const isMoving = (movingUntilRef.current[spirit.id] || 0) > now;
            const isBattling = spirit.currentAction?.type === 'battling';
            const isSpawning = spirit.currentAction?.type === 'spawning';
            const animState = isBattling ? 'attack' : isMoving ? 'walk' : isSpawning ? 'spawn' : 'idle';
            const face = spiritFacing.current[spirit.id] || 1;
            const hasMemories = (spirit.memoryLedger || []).length > 5;
            const scale = hasMemories ? 1.1 : 1;

            elements.push(
              <g
                key={spirit.id}
                style={{
                  transform: `translate(${sx}px, ${sy}px) scale(${scale})`,
                  transition: 'transform 0.6s ease-in-out, opacity 1s',
                  cursor: spirit.alive ? 'pointer' : 'default',
                  opacity: isDying ? 0 : isGhost ? 0.7 : 1,
                }}
                onClick={(e) => { e.stopPropagation(); if (spirit.alive && !dragRef.current?.dragged) onSelectSpirit(spirit.id); }}
                onMouseEnter={() => setHoveredSpirit(spirit.id)}
                onMouseLeave={() => setHoveredSpirit(null)}
              >
                {/* Captain aura ring */}
                {classData && !isDying && (
                  <circle cx={0} cy={-10} r={14} fill="none" stroke={affColor} strokeWidth={0.6} opacity={0.25}>
                    <animate attributeName="opacity" values="0.25;0.12;0.25" dur="3s" repeatCount="indefinite" />
                  </circle>
                )}


                {isGhost && (
                  <ellipse cx={0} cy={-16} rx={18} ry={22} fill="none"
                    stroke="#a855f7" strokeWidth={0.8} opacity={0.35}
                    strokeDasharray="4 3"
                    style={{ animation: 'pulse 3s ease-in-out infinite' }} />
                )}

                {isHovered && !isSelected && (
                  <ellipse cx={0} cy={-16} rx={16} ry={20} fill="none"
                    stroke={isMine ? '#f0c040' : pc} strokeWidth={1} opacity={0.4} strokeDasharray="3 2" />
                )}

                <SpiritSprite spec={spec} color={pc} animState={animState} animFrame={animTick} facing={face} affinity={spirit.affinity} />

                {/* Affinity indicator dot */}
                {affData && (
                  <circle cx={-12} cy={-34} r={2.5} fill={affData.color} opacity={0.7} />
                )}

                {/* Class icon */}
                {classData && (
                  <text x={12} y={-32} textAnchor="middle" fontSize="6" opacity={0.8}>{classData.icon}</text>
                )}


                {/* Portrait + HP bar */}
                {spirit.alive && (() => {
                  const maxHp = spirit.maxHp || 100;
                  const hp = spirit.hp != null ? spirit.hp : maxHp;
                  const pct = Math.max(0, Math.min(1, hp / maxHp));
                  const barW = 20;
                  const barH = 3;
                  const barY = -38;
                  const avatarR = 6;
                  const avatarX = -barW / 2 - avatarR - 2;
                  const avatarY = barY + barH / 2;
                  const charMap = { flame: 'fire_knight', tide: 'water_priestess', stone: 'ground_monk', wind: 'wind_hashashin', growth: 'leaf_ranger', shadow: 'crystal_mauler' };
                  const charName = charMap[spirit.affinity] || 'metal_bladekeeper';
                  const portraitSrc = `/sprites/${charName}/portrait.png`;
                  const fillColor = pct > 0.6 ? '#4ade80' : pct > 0.3 ? '#fbbf24' : '#ef4444';
                  return (
                    <g>
                      <defs>
                        <clipPath id={`avatar-clip-${spirit.id}`}>
                          <circle cx={avatarX} cy={avatarY} r={avatarR} />
                        </clipPath>
                      </defs>
                      <circle cx={avatarX} cy={avatarY} r={avatarR + 0.5} fill="rgba(0,0,0,0.5)" stroke={affColor} strokeWidth={0.5} />
                      <image
                        href={portraitSrc}
                        x={avatarX - avatarR}
                        y={avatarY - avatarR}
                        width={avatarR * 2}
                        height={avatarR * 2}
                        clipPath={`url(#avatar-clip-${spirit.id})`}
                        style={{ imageRendering: 'pixelated' }}
                      />
                      {pct < 1 && (
                        <>
                          <rect x={-barW / 2} y={barY} width={barW} height={barH} rx={1}
                            fill="rgba(0,0,0,0.6)" stroke="rgba(255,255,255,0.15)" strokeWidth={0.3} />
                          <rect x={-barW / 2 + 0.5} y={barY + 0.5} width={(barW - 1) * pct} height={barH - 1} rx={0.5}
                            fill={fillColor} opacity={0.9} />
                        </>
                      )}
                    </g>
                  );
                })()}

                {speechBubbles[spirit.id] && (
                  <circle cx={16} cy={-38} r={3} fill={pc} opacity={0.9}>
                    <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}

                {isSelected && (
                  <g>
                    <rect x={-14} y={-34} width={28} height={38} rx={3}
                      fill="none" stroke="#f0c040" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.7}>
                      <animate attributeName="stroke-dashoffset" values="0;-12" dur="1.5s" repeatCount="indefinite" />
                    </rect>
                    <polygon points="-4,-36 0,-40 4,-36" fill="#f0c040" opacity={0.8} />
                  </g>
                )}

                {/* Name label */}
                {(isHovered || isSelected) && (
                  <g>
                    <rect x={-22} y={-44} width={44} height={10} rx={2}
                      fill="rgba(12,16,24,0.9)" stroke="rgba(200,180,100,0.25)" strokeWidth={0.5} />
                    <text x={0} y={-37} textAnchor="middle" fontSize="5.5"
                      fill="#e8dcc0" fontFamily="'Cinzel', serif" fontWeight="600">
                      {spirit.name}
                    </text>
                  </g>
                )}

                {isBattling && !isDying && (
                  <circle cx={0} cy={-10} r={12} fill="none" stroke="#ff4040" strokeWidth={0.8} opacity={0.4}>
                    <animate attributeName="r" values="10;14;10" dur="1.2s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="0.4;0.15;0.4" dur="1.2s" repeatCount="indefinite" />
                  </circle>
                )}
                {isSpawning && !isDying && (
                  <circle cx={0} cy={-10} r={10} fill="none" stroke="#a080e0" strokeWidth={0.6} opacity={0.3}>
                    <animate attributeName="r" values="8;12;8" dur="2s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          });

          return elements;
        })}

        {/* Speech bubbles removed — dialog shown in feed overlay */}

        {activeTrails.map(trail => {
          const from = spirits[trail.from];
          const to = spirits[trail.to];
          if (!from || !to) return null;
          const fh = hexes[from.hexId];
          const th = hexes[to.hexId];
          if (!fh || !th) return null;
          const p1 = hexToPixel({ q: fh.q, r: fh.r }, HEX_SIZE);
          const p2 = hexToPixel({ q: th.q, r: th.r }, HEX_SIZE);
          const dx = p2.x - p1.x;
          const dy = p2.y - p1.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const arcHeight = Math.max(25, dist * 0.3);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2 - arcHeight;
          const pathId = `trail-${trail.id}`;
          const whisperText = trail.text ? (trail.text.length > 20 ? trail.text.slice(0, 20) + '...' : trail.text) : '~';
          return (
            <g key={trail.id}>
              <defs>
                <path id={pathId} d={`M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`} />
              </defs>
              <use href={`#${pathId}`} fill="none" stroke="#e0b040" strokeWidth={1.5}
                strokeDasharray="4 4" opacity={0.6}>
                <animate attributeName="opacity" values="0.7;0.3;0" dur="3s" fill="freeze" />
                <animate attributeName="stroke-dashoffset" values="0;-16" dur="0.8s" repeatCount="4" />
              </use>
              <text fontSize="8" fill="#ffe0a0" fontFamily="'Inter', sans-serif" fontWeight="500">
                <animate attributeName="opacity" values="0;1;1;0" dur="3s" fill="freeze" />
                <textPath href={`#${pathId}`} startOffset="5%">
                  <animate attributeName="startOffset" values="5%;75%" dur="2.5s" fill="freeze" />
                  {whisperText}
                </textPath>
              </text>
            </g>
          );
        })}

        {[...pulsingSpirits].map(sid => {
          const s = spirits[sid];
          if (!s) return null;
          const h = hexes[s.hexId];
          if (!h) return null;
          const p = hexToPixel({ q: h.q, r: h.r }, HEX_SIZE);
          return (
            <circle key={`p-${sid}`} cx={p.x} cy={p.y} r={5} fill="none" stroke="#e0b040" strokeWidth={1.5}>
              <animate attributeName="r" values="5;18" dur="1s" repeatCount="2" />
              <animate attributeName="opacity" values="0.6;0" dur="1s" repeatCount="2" />
            </circle>
          );
        })}

        {/* Decree / Enemy whisper broadcast waves */}
        {decreeWaves.map(wave => {
          const p = hexToPixel({ q: wave.q, r: wave.r }, HEX_SIZE);
          return (
            <g key={wave.id}>
              <circle cx={p.x} cy={p.y} r={4} fill="none" stroke={wave.color} strokeWidth={2} opacity={0}>
                <animate attributeName="r" values="4;40" dur="1.5s" fill="freeze" />
                <animate attributeName="opacity" values="0.7;0" dur="1.5s" fill="freeze" />
              </circle>
              <circle cx={p.x} cy={p.y} r={4} fill="none" stroke={wave.color} strokeWidth={1} opacity={0}>
                <animate attributeName="r" values="4;30" dur="1s" fill="freeze" begin="0.2s" />
                <animate attributeName="opacity" values="0.5;0" dur="1s" fill="freeze" begin="0.2s" />
              </circle>
            </g>
          );
        })}

        {/* Movement trails */}
        {moveTrails.map(trail => {
          const mx = (trail.p1.x + trail.p2.x) / 2;
          const my = (trail.p1.y + trail.p2.y) / 2 - 8;
          return (
            <g key={trail.id}>
              <path
                d={`M${trail.p1.x},${trail.p1.y} Q${mx},${my} ${trail.p2.x},${trail.p2.y}`}
                fill="none" stroke={trail.color} strokeWidth={2} strokeLinecap="round"
                strokeDasharray="4 4" opacity={0.6}
              >
                <animate attributeName="opacity" values="0.6;0" dur="1.2s" fill="freeze" />
                <animate attributeName="stroke-dashoffset" values="0;-24" dur="0.8s" repeatCount="2" />
              </path>
              <circle cx={trail.p1.x} cy={trail.p1.y} r={3} fill={trail.color} opacity={0.3}>
                <animate attributeName="r" values="3;8" dur="0.8s" fill="freeze" />
                <animate attributeName="opacity" values="0.3;0" dur="0.8s" fill="freeze" />
              </circle>
            </g>
          );
        })}

        {/* Battle effects */}
        {battleEffects.map(fx => (
          <g key={fx.id} transform={`translate(${fx.pos.x},${fx.pos.y})`} filter="url(#glow-battle)">
            {/* Impact flash */}
            <circle cx={0} cy={0} r={1} fill="#fff" opacity={0.8}>
              <animate attributeName="r" values="1;10" dur="0.3s" fill="freeze" />
              <animate attributeName="opacity" values="0.8;0" dur="0.3s" fill="freeze" />
            </circle>
            {/* Expanding ring */}
            <circle cx={0} cy={0} r={3} fill="none" stroke={fx.color} strokeWidth={1.5} opacity={0.7}>
              <animate attributeName="r" values="3;14" dur="0.6s" fill="freeze" />
              <animate attributeName="opacity" values="0.7;0" dur="0.6s" fill="freeze" />
              <animate attributeName="stroke-width" values="1.5;0.3" dur="0.6s" fill="freeze" />
            </circle>
            {fx.fatal && (
              <circle cx={0} cy={0} r={5} fill="none" stroke="#ff4040" strokeWidth={1} opacity={0.5}>
                <animate attributeName="r" values="5;18" dur="0.8s" begin="0.15s" fill="freeze" />
                <animate attributeName="opacity" values="0.5;0" dur="0.8s" begin="0.15s" fill="freeze" />
              </circle>
            )}
            {/* Crossed swords */}
            <g opacity={0.8}>
              <animate attributeName="opacity" values="0.8;0" dur="1s" fill="freeze" />
              <line x1={-5} y1={-5} x2={5} y2={5} stroke="#fff" strokeWidth={1.5} strokeLinecap="round">
                <animate attributeName="x1" values="0;-5" dur="0.15s" fill="freeze" />
                <animate attributeName="y1" values="0;-5" dur="0.15s" fill="freeze" />
                <animate attributeName="x2" values="0;5" dur="0.15s" fill="freeze" />
                <animate attributeName="y2" values="0;5" dur="0.15s" fill="freeze" />
              </line>
              <line x1={5} y1={-5} x2={-5} y2={5} stroke="#fff" strokeWidth={1.5} strokeLinecap="round">
                <animate attributeName="x1" values="0;5" dur="0.15s" fill="freeze" />
                <animate attributeName="y1" values="0;-5" dur="0.15s" fill="freeze" />
                <animate attributeName="x2" values="0;-5" dur="0.15s" fill="freeze" />
                <animate attributeName="y2" values="0;5" dur="0.15s" fill="freeze" />
              </line>
            </g>
            {/* Sparks */}
            {[0, 90, 180, 270].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const ex = Math.cos(rad) * 10;
              const ey = Math.sin(rad) * 10;
              return (
                <circle key={i} cx={0} cy={0} r={0.8} fill={i % 2 === 0 ? '#ffd040' : fx.color} opacity={0.7}>
                  <animate attributeName="cx" values={`0;${ex}`} dur="0.4s" fill="freeze" />
                  <animate attributeName="cy" values={`0;${ey}`} dur="0.4s" fill="freeze" />
                  <animate attributeName="opacity" values="0.7;0" dur="0.5s" fill="freeze" />
                  <animate attributeName="r" values="0.8;0.2" dur="0.5s" fill="freeze" />
                </circle>
              );
            })}
          </g>
        ))}

        {/* Spawn effects */}
        {spawnEffects.map(fx => (
          <g key={fx.id} transform={`translate(${fx.pos.x},${fx.pos.y})`} filter="url(#glow-spawn)">
            {/* Central glow */}
            <circle cx={0} cy={0} r={1} fill={fx.color} opacity={0}>
              <animate attributeName="r" values="1;12;6" dur="1.2s" fill="freeze" />
              <animate attributeName="opacity" values="0;0.7;0" dur="1.2s" fill="freeze" />
            </circle>
            {/* Outer ring pulse */}
            <circle cx={0} cy={0} r={3} fill="none" stroke={fx.color} strokeWidth={1.5} opacity={0}>
              <animate attributeName="r" values="3;25" dur="1.5s" fill="freeze" />
              <animate attributeName="opacity" values="0;0.5;0" dur="1.5s" fill="freeze" />
              <animate attributeName="stroke-width" values="1.5;0.3" dur="1.5s" fill="freeze" />
            </circle>
            {/* Inner star burst */}
            <circle cx={0} cy={0} r={2} fill="#fff" opacity={0}>
              <animate attributeName="opacity" values="0;0.8;0" dur="0.6s" begin="0.3s" fill="freeze" />
              <animate attributeName="r" values="2;8;3" dur="0.6s" begin="0.3s" fill="freeze" />
            </circle>
            {/* Spiral sparkles */}
            {[0, 45, 90, 135, 180, 225, 270, 315].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const d = 15 + (i % 3) * 4;
              const ex = Math.cos(rad) * d;
              const ey = Math.sin(rad) * d;
              const delay = `${i * 0.08}s`;
              return (
                <circle key={i} cx={0} cy={0} r={0.8} fill="#fff" opacity={0}>
                  <animate attributeName="cx" values={`${ex * 0.2};${ex}`} dur="1s" begin={delay} fill="freeze" />
                  <animate attributeName="cy" values={`${ey * 0.2};${ey}`} dur="1s" begin={delay} fill="freeze" />
                  <animate attributeName="opacity" values="0;0.7;0" dur="1s" begin={delay} fill="freeze" />
                  <animate attributeName="r" values="0.8;1.5;0" dur="1s" begin={delay} fill="freeze" />
                </circle>
              );
            })}
            {/* Generation text */}
            <text x={0} y={-20} textAnchor="middle" fontSize="6" fill={fx.color} fontFamily="monospace" opacity={0}>
              <animate attributeName="opacity" values="0;0.8;0" dur="2s" begin="0.5s" fill="freeze" />
              <animate attributeName="y" values="-15;-25" dur="2s" begin="0.5s" fill="freeze" />
              ★ gen {fx.gen}
            </text>
          </g>
        ))}

        {/* Territory claim flashes */}
        {claimFlashes.map(fx => (
          <g key={fx.id} transform={`translate(${fx.pos.x},${fx.pos.y})`}>
            <polygon points={HEX_POINTS} fill={fx.color} opacity={0}>
              <animate attributeName="opacity" values="0;0.3;0" dur="0.8s" fill="freeze" />
            </polygon>
            <polygon points={HEX_POINTS} fill="none" stroke={fx.color} strokeWidth={3} opacity={0}>
              <animate attributeName="opacity" values="0;0.7;0" dur="0.8s" fill="freeze" />
            </polygon>
          </g>
        ))}

        {/* Rally point marker */}
        {rallyPoint && (() => {
          const rh = hexes[rallyPoint.hexId];
          if (!rh) return null;
          const rp = hexToPixel({ q: rh.q, r: rh.r }, HEX_SIZE);
          const hasEnemy = rh.spiritIds?.some(id => {
            const s = spirits[id];
            return s && s.alive && s.playerId !== playerId;
          });
          const isOwn = rh.controller === playerId;
          const color = hasEnemy ? '#ef4444' : isOwn ? '#60a5fa' : '#f59e0b';
          const label = hasEnemy ? 'ATTACK' : isOwn ? 'REGROUP' : 'CAPTURE';
          return (
            <g transform={`translate(${rp.x},${rp.y})`}>
              <polygon points={HEX_POINTS} fill={color} opacity={0.15}>
                <animate attributeName="opacity" values="0.2;0.08;0.2" dur="1.5s" repeatCount="indefinite" />
              </polygon>
              <polygon points={HEX_POINTS} fill="none" stroke={color} strokeWidth={2.5} strokeDasharray="6 4" opacity={0.7}>
                <animate attributeName="stroke-dashoffset" values="0;-20" dur="1.5s" repeatCount="indefinite" />
              </polygon>
              {/* Chevron pointing down into the hex */}
              <g>
                <animate attributeName="opacity" values="0.9;0.4;0.9" dur="1.5s" repeatCount="indefinite" />
                <polygon points="0,-6 -5,-14 5,-14" fill={color} opacity={0.8}>
                  <animate attributeName="transform" values="translate(0,-2);translate(0,2);translate(0,-2)" dur="1s" repeatCount="indefinite" />
                </polygon>
              </g>
              <text x={0} y={-22} textAnchor="middle" fontSize="6" fontFamily="monospace" fontWeight="700"
                fill={color} opacity={0.8} letterSpacing="0.1em">
                <animate attributeName="opacity" values="0.9;0.5;0.9" dur="1.5s" repeatCount="indefinite" />
                {label}
              </text>
            </g>
          );
        })()}
      </svg>

      {hoveredHex && (
        <div
          className="absolute pointer-events-none z-10 rounded px-3 py-2 text-xs"
          style={{
            left: tooltipPos.x, top: tooltipPos.y, maxWidth: 220,
            background: 'rgba(12, 16, 24, 0.94)',
            border: '1px solid rgba(200, 180, 100, 0.3)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
          }}
        >
          <div style={{ color: '#d4a840', fontSize: '10px', fontWeight: 600, letterSpacing: '0.06em', marginBottom: 3 }}>
            {hoveredHex.hex.terrain?.toUpperCase()}{hoveredHex.hex.biome ? ` · ${hoveredHex.hex.biome}` : ''}
          </div>
          {hoveredHex.controllerName && (
            <div style={{ color: '#a09060', fontSize: '10px' }}>{hoveredHex.controllerName} territory</div>
          )}
          {hoveredHex.hex.memoryPool > 0 && (
            <div style={{ color: '#2dd4bf', fontSize: '10px' }}>⬡ {Math.round(hoveredHex.hex.memoryPool)} soul energy</div>
          )}
          {hoveredHex.hexSpirits?.length > 0 && (
            <div style={{ marginTop: 4, paddingTop: 4, borderTop: '1px solid rgba(160, 140, 80, 0.15)' }}>
              {hoveredHex.hexSpirits.filter(s => s.alive).map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '1px 0', fontSize: '10px' }}>
                  <span style={{ width: 6, height: 6, borderRadius: 3, background: getPlayerColor(s.playerId, gameState), display: 'inline-block' }} />
                  <span style={{ color: '#e8e0d0' }}>{s.name}</span>
                  <span style={{ color: '#706858', fontStyle: 'italic' }}>{s.specialization}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zoom controls */}
      <div className="absolute bottom-3 left-3 flex flex-col gap-1 z-10">
        <button onClick={() => setZoom(z => Math.min(MAX_ZOOM, z * (1 + ZOOM_STEP)))}
          className="w-7 h-7 rounded bg-gray-900/80 border border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-mono flex items-center justify-center backdrop-blur-sm">
          +
        </button>
        <button onClick={() => setZoom(z => Math.max(MIN_ZOOM, z * (1 - ZOOM_STEP)))}
          className="w-7 h-7 rounded bg-gray-900/80 border border-gray-700/50 text-gray-300 hover:text-white hover:border-gray-500 text-sm font-mono flex items-center justify-center backdrop-blur-sm">
          -
        </button>
        <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
          className="w-7 h-7 rounded bg-gray-900/80 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-500 text-xs font-mono flex items-center justify-center backdrop-blur-sm"
          title="Reset view">
          R
        </button>
      </div>

      {zoom !== 1 && (
        <div className="absolute bottom-3 left-12 text-xs font-mono text-gray-500 bg-gray-900/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
          {Math.round(zoom * 100)}%
        </div>
      )}

      {/* Dialog feed — floating overlay */}
      <div
        className="absolute bottom-14 left-3 w-72 max-h-48 overflow-hidden flex flex-col-reverse gap-1"
        style={{ zIndex: 20 }}
      >
        {Object.entries(speechBubbles).slice(-5).reverse().map(([spiritId, bubble]) => {
          const spirit = spirits[spiritId];
          if (!spirit) return null;
          const pc = getPlayerColor(spirit.playerId, gameState) || '#6b7280';
          const isMine = spirit.playerId === playerId;
          const cleanText = bubble.text.replace(/\*+/g, '').trim();
          const age = Date.now() - bubble.ts;
          const opacity = age > 3000 ? Math.max(0, 1 - (age - 3000) / 1500) : 1;
          return (
            <div
              key={`feed-${spiritId}-${bubble.ts}`}
              className="rounded-md px-2.5 py-1.5 text-xs backdrop-blur-sm cursor-pointer hover:brightness-125 transition-all"
              style={{
                background: isMine ? 'rgba(30,24,12,0.85)' : 'rgba(12,16,24,0.85)',
                borderLeft: `3px solid ${pc}`,
                opacity,
                transition: 'opacity 0.5s',
              }}
              onClick={() => onSelectSpirit(spirit.id)}
            >
              <span className="font-header font-semibold text-xs" style={{ color: pc }}>
                {spirit.name}
              </span>
              <span className="ml-1.5" style={{ color: isMine ? '#f0d080' : '#d0d4dc' }}>
                {cleanText.length > 60 ? cleanText.slice(0, 57) + '...' : cleanText}
              </span>
            </div>
          );
        })}
      </div>

      {/* Minimap */}
      <Minimap hexArray={hexArray} spirits={spirits} playerId={playerId} gameState={gameState} />

      {/* Tick timer */}
      <TickTimer />
    </div>
  );
}

function Minimap({ hexArray, spirits, playerId, gameState }) {
  const size = 3;
  const points = useMemo(() => {
    return hexArray.map(hex => {
      const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
      const y = size * (3 / 2 * hex.r);
      return { x, y, controller: hex.controller, id: hex.id, spiritIds: hex.spiritIds };
    });
  }, [hexArray]);

  const bounds = useMemo(() => {
    const xs = points.map(p => p.x);
    const ys = points.map(p => p.y);
    return {
      minX: Math.min(...xs) - size * 2,
      maxX: Math.max(...xs) + size * 2,
      minY: Math.min(...ys) - size * 2,
      maxY: Math.max(...ys) + size * 2,
    };
  }, [points]);

  const w = bounds.maxX - bounds.minX;
  const h = bounds.maxY - bounds.minY;

  return (
    <div className="absolute bottom-3 right-3 z-10 rounded-lg overflow-hidden border border-gray-700/50 bg-gray-900/80 backdrop-blur-sm"
      style={{ width: 120, height: 100 }}>
      <svg viewBox={`${bounds.minX} ${bounds.minY} ${w} ${h}`} className="w-full h-full">
        {points.map(p => {
          const color = p.controller
            ? (getPlayerColor(p.controller, gameState) || '#4a5568')
            : '#1a202c';
          return (
            <circle key={p.id} cx={p.x} cy={p.y} r={size * 0.75}
              fill={color} opacity={p.controller ? 0.8 : 0.3} />
          );
        })}
        {Object.values(spirits).filter(s => s.alive).map(s => {
          const hex = hexArray.find(h => h.id === s.hexId);
          if (!hex) return null;
          const x = size * (Math.sqrt(3) * hex.q + Math.sqrt(3) / 2 * hex.r);
          const y = size * (3 / 2 * hex.r);
          const isMine = s.playerId === playerId;
          return (
            <circle key={s.id} cx={x} cy={y} r={isMine ? 1.8 : 1.2}
              fill={isMine ? '#f59e0b' : '#ef4444'} opacity={0.9} />
          );
        })}
      </svg>
    </div>
  );
}

function TickTimer() {
  const [elapsed, setElapsed] = useState(0);
  const DECISION_INTERVAL = 15;

  useEffect(() => {
    const id = setInterval(() => {
      setElapsed(prev => (prev + 1) % DECISION_INTERVAL);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const remaining = DECISION_INTERVAL - elapsed;
  const pct = (elapsed / DECISION_INTERVAL) * 100;

  return (
    <div className="absolute top-3 left-3 z-10 flex items-center gap-2 bg-gray-900/80 backdrop-blur-sm rounded px-2 py-1.5 border border-gray-700/50">
      <span className="text-xs font-mono text-gray-500">NEXT CYCLE</span>
      <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full bg-amber-500/60 rounded-full transition-all duration-1000 ease-linear"
          style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-mono text-gray-400">{remaining}s</span>
    </div>
  );
}
