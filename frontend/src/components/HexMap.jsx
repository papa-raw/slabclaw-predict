import { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { hexToPixel } from '@lib/hexMath.js';
import { getPlayerColor } from '@lib/terrainTypes.js';

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

function adj(hex, amount) {
  const r = Math.max(0, Math.min(255, parseInt(hex.slice(1, 3), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(hex.slice(3, 5), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(hex.slice(5, 7), 16) + amount));
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

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

const WALK_FRAMES = [
  { leftStep: 3, rightStep: -3, bounce: -1.5 },
  { leftStep: 1, rightStep: -1, bounce: 0 },
  { leftStep: -3, rightStep: 3, bounce: -1.5 },
  { leftStep: -1, rightStep: 1, bounce: 0 },
];
const ATTACK_FRAMES = [
  { weaponAngle: -35, lunge: -2, bounce: 0 },
  { weaponAngle: 65, lunge: 6, bounce: -2 },
  { weaponAngle: 35, lunge: 3, bounce: -1 },
  { weaponAngle: 0, lunge: 0, bounce: 0 },
];
const IDLE_FRAMES = [
  { bounce: 0 },
  { bounce: -0.5 },
];

function getAnimData(animState, frame) {
  if (animState === 'walk') return WALK_FRAMES[frame % 4];
  if (animState === 'attack') return ATTACK_FRAMES[frame % 4];
  return IDLE_FRAMES[Math.floor(frame / 4) % 2];
}

function SpiritSprite({ spec, color, animState = 'idle', animFrame = 0, facing = 1 }) {
  const dk = adj(color, -50);
  const lt = adj(color, 60);
  const skin = '#e8c8a0';
  const skinDk = '#c8a078';
  const hair = '#4a3828';
  const outline = '#1a1420';
  const metalLt = '#c0c8d8';
  const metalDk = '#707888';
  const wood = '#5a3a1a';

  const f = getAnimData(animState, animFrame);
  const lStep = f.leftStep || 0;
  const rStep = f.rightStep || 0;
  const bounce = f.bounce || 0;
  const lunge = f.lunge || 0;
  const wAngle = f.weaponAngle || 0;
  const isSpawning = animState === 'spawn';

  const spawnGlow = isSpawning ? (
    <circle cx={0} cy={-14} r={16} fill="none" stroke={lt} strokeWidth={0.8} opacity={0.3}>
      <animate attributeName="r" values="14;20;14" dur="2s" repeatCount="indefinite" />
      <animate attributeName="opacity" values="0.3;0.1;0.3" dur="2s" repeatCount="indefinite" />
    </circle>
  ) : null;

  switch (spec) {
    case 'warrior':
      return (
        <g transform={`scale(${facing}, 1)`}>
          {spawnGlow}
          <ellipse cx={0} cy={2} rx={8} ry={2.5} fill="#000" opacity={0.25} />
          {/* Left leg + boot */}
          <g transform={`translate(${lStep}, 0)`}>
            <rect x={-5.5} y={-2} width={4} height={3} rx={0.8} fill={outline} />
            <rect x={-5} y={-1.5} width={3.5} height={2} rx={0.5} fill={metalDk} />
            <rect x={-4.5} y={-7} width={3.5} height={5.5} fill={dk} stroke={outline} strokeWidth={0.6} />
          </g>
          {/* Right leg + boot */}
          <g transform={`translate(${rStep}, 0)`}>
            <rect x={1.5} y={-2} width={4} height={3} rx={0.8} fill={outline} />
            <rect x={2} y={-1.5} width={3.5} height={2} rx={0.5} fill={metalDk} />
            <rect x={1} y={-7} width={3.5} height={5.5} fill={dk} stroke={outline} strokeWidth={0.6} />
          </g>
          {/* Upper body — bounces + lunges */}
          <g transform={`translate(${lunge}, ${bounce})`}>
            <rect x={-6.5} y={-15} width={13} height={8.5} rx={1.5} fill={color} stroke={outline} strokeWidth={0.8} />
            <rect x={-5} y={-14.5} width={10} height={3} rx={0.5} fill={lt} opacity={0.2} />
            <ellipse cx={-7} cy={-13} rx={3} ry={2.5} fill={color} stroke={outline} strokeWidth={0.7} />
            <ellipse cx={7} cy={-13} rx={3} ry={2.5} fill={color} stroke={outline} strokeWidth={0.7} />
            <rect x={-6} y={-7.5} width={12} height={2} rx={0.5} fill="#3a2a18" stroke={outline} strokeWidth={0.5} />
            <rect x={-1.2} y={-7.5} width={2.4} height={2} rx={0.5} fill="#8a7030" />
            <rect x={-2} y={-17} width={4} height={2.5} fill={skin} />
            <circle cx={0} cy={-21.5} r={5.5} fill={skin} stroke={outline} strokeWidth={0.8} />
            <path d="M-5.5,-22 Q-6,-28 0,-30 Q6,-28 5.5,-22" fill={metalDk} stroke={outline} strokeWidth={0.7} />
            <rect x={-5} y={-23.5} width={10} height={2.8} rx={0.5} fill={metalLt} stroke={outline} strokeWidth={0.5} />
            <rect x={-6} y={-22} width={12} height={1.5} fill={metalDk} />
            <rect x={-3} y={-22} width={6} height={1.2} fill={outline} rx={0.3} />
            <rect x={-2.2} y={-21.8} width={1.5} height={0.8} rx={0.2} fill="#ff6040" opacity={0.8} />
            <rect x={0.7} y={-21.8} width={1.5} height={0.8} rx={0.2} fill="#ff6040" opacity={0.8} />
            <rect x={-0.6} y={-31} width={1.2} height={5} rx={0.4} fill={color} stroke={outline} strokeWidth={0.4} />
            {/* Shield (left arm) */}
            <path d="M-10,-16 L-10,-8 Q-10,-4 -7.5,-3 Q-5,-4 -5,-8 L-5,-16 Z" fill={dk} stroke={outline} strokeWidth={0.7} />
            <path d="M-9.5,-15.5 L-9.5,-8.5 Q-9.5,-5 -7.5,-4 L-7.5,-15.5 Z" fill={color} opacity={0.4} />
            <circle cx={-7.5} cy={-10.5} r={1.5} fill={lt} opacity={0.5} />
            {/* Sword arm — rotates for attack */}
            <g transform={`rotate(${wAngle}, 9.9, -9)`}>
              <rect x={9} y={-25} width={1.8} height={16} rx={0.3} fill={metalLt} stroke={outline} strokeWidth={0.5} />
              <rect x={9} y={-26} width={1.8} height={2} rx={0.5} fill={metalLt} />
              <rect x={7.5} y={-10} width={4.8} height={2} rx={0.5} fill={wood} stroke={outline} strokeWidth={0.4} />
              <rect x={8.5} y={-8.5} width={2.8} height={3.5} rx={0.3} fill="#3a2820" />
              {animState === 'attack' && animFrame % 4 === 1 && (
                <line x1={10} y1={-26} x2={10} y2={-30} stroke="#fff" strokeWidth={1.2} opacity={0.8} />
              )}
            </g>
          </g>
        </g>
      );

    case 'scout':
      return (
        <g transform={`scale(${facing}, 1)`}>
          {spawnGlow}
          <ellipse cx={0} cy={2} rx={7} ry={2.2} fill="#000" opacity={0.25} />
          <g transform={`translate(${lStep}, 0)`}>
            <rect x={-4} y={-1.5} width={3.5} height={2.5} rx={0.8} fill="#3a2a18" stroke={outline} strokeWidth={0.5} />
            <rect x={-3.5} y={-7} width={3} height={5.5} fill={dk} stroke={outline} strokeWidth={0.5} />
          </g>
          <g transform={`translate(${rStep}, 0)`}>
            <rect x={0.5} y={-1.5} width={3.5} height={2.5} rx={0.8} fill="#3a2a18" stroke={outline} strokeWidth={0.5} />
            <rect x={0.5} y={-7} width={3} height={5.5} fill={dk} stroke={outline} strokeWidth={0.5} />
          </g>
          <g transform={`translate(${lunge}, ${bounce})`}>
            <path d="M-4,-14.5 Q-6,-8 -8,-2 Q-5,1 -3,-2 Q-2,-6 -4,-14.5 Z" fill={dk} opacity={0.6} stroke={outline} strokeWidth={0.4} />
            <rect x={-5} y={-14.5} width={10} height={8} rx={1} fill={color} stroke={outline} strokeWidth={0.7} />
            <rect x={-4.5} y={-7.5} width={9} height={1.5} rx={0.3} fill="#3a2a18" stroke={outline} strokeWidth={0.4} />
            <rect x={3} y={-8} width={2.5} height={3} rx={0.5} fill="#4a3a20" stroke={outline} strokeWidth={0.3} />
            <rect x={-6} y={-13.5} width={2} height={6} rx={0.8} fill={color} stroke={outline} strokeWidth={0.5} />
            <rect x={4} y={-13.5} width={2} height={6} rx={0.8} fill={color} stroke={outline} strokeWidth={0.5} />
            <rect x={-1.5} y={-16.5} width={3} height={2.5} fill={skin} />
            <path d="M-3,-16 Q0,-14.5 3,-16 Q3,-15 0,-13.5 Q-3,-15 -3,-16 Z" fill={color} stroke={outline} strokeWidth={0.4} />
            <circle cx={0} cy={-21} r={5} fill={skin} stroke={outline} strokeWidth={0.7} />
            <path d="M-5.5,-21 Q-6,-28 0,-30 Q6,-28 5.5,-21 Q3,-19 0,-19.5 Q-3,-19 -5.5,-21 Z" fill={color} stroke={outline} strokeWidth={0.6} />
            <path d="M-4.5,-21 Q-5,-27 0,-28.5 Q5,-27 4.5,-21 Q2,-19.5 0,-20 Q-2,-19.5 -4.5,-21 Z" fill={dk} opacity={0.3} />
            <ellipse cx={-1.8} cy={-20.8} rx={1} ry={0.7} fill={outline} />
            <ellipse cx={1.8} cy={-20.8} rx={1} ry={0.7} fill={outline} />
            <rect x={-1.5} y={-21} width={0.6} height={0.4} rx={0.2} fill="#80d0ff" />
            <rect x={1.5} y={-21} width={0.6} height={0.4} rx={0.2} fill="#80d0ff" />
            {/* Quiver on back */}
            <rect x={3.5} y={-17} width={2.5} height={6} rx={0.5} fill="#4a2a10" stroke={outline} strokeWidth={0.4} />
            <line x1={4} y1={-17.5} x2={4} y2={-19} stroke={metalLt} strokeWidth={0.4} />
            <line x1={5} y1={-17.5} x2={5} y2={-18.5} stroke={metalLt} strokeWidth={0.4} />
            {/* Bow arm — rotates for attack */}
            <g transform={`rotate(${wAngle * 0.6}, -8, -10)`}>
              <g transform="translate(-8, -14)">
                <path d="M0,-8 Q-3,-4 0,4 Q-2,-4 0,-8 Z" fill={wood} stroke={outline} strokeWidth={0.5} />
                <line x1={0} y1={-8} x2={0} y2={4} stroke="#888" strokeWidth={0.4} />
              </g>
            </g>
            {/* Arrow flies on strike frame */}
            {animState === 'attack' && (animFrame % 4 === 1 || animFrame % 4 === 2) && (
              <g>
                <line x1={-6} y1={-14} x2={-6 + (animFrame % 4 === 1 ? 10 : 18)} y2={-14} stroke={metalLt} strokeWidth={0.8} />
                <polygon points={`${-6 + (animFrame % 4 === 1 ? 10 : 18)},-15 ${-4 + (animFrame % 4 === 1 ? 10 : 18)},-14 ${-6 + (animFrame % 4 === 1 ? 10 : 18)},-13`} fill={metalLt} />
              </g>
            )}
          </g>
        </g>
      );

    case 'gatherer':
      return (
        <g transform={`scale(${facing}, 1)`}>
          {spawnGlow}
          <ellipse cx={0} cy={2} rx={7} ry={2.2} fill="#000" opacity={0.25} />
          <g transform={`translate(${lStep * 0.6}, 0)`}>
            <rect x={-4} y={-1} width={3} height={2} rx={0.5} fill="#4a3a20" stroke={outline} strokeWidth={0.4} />
          </g>
          <g transform={`translate(${rStep * 0.6}, 0)`}>
            <rect x={1} y={-1} width={3} height={2} rx={0.5} fill="#4a3a20" stroke={outline} strokeWidth={0.4} />
          </g>
          <g transform={`translate(${lunge}, ${bounce})`}>
            <path d="M-6,-14.5 Q-7,-7 -7.5,-1 L-4,1 L4,1 L7.5,-1 Q7,-7 6,-14.5 Z" fill={color} stroke={outline} strokeWidth={0.7} />
            <path d="M-5.5,-8 Q0,-6.5 5.5,-8" fill="none" stroke="#8a7050" strokeWidth={1.2} />
            <ellipse cx={6.5} cy={-9} rx={3} ry={3.5} fill="#5a3a18" stroke={outline} strokeWidth={0.5} />
            <path d="M-6,-14 Q-9,-10 -8,-7" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
            <path d="M6,-14 Q9,-10 8,-7" fill="none" stroke={color} strokeWidth={3} strokeLinecap="round" />
            <circle cx={-8} cy={-7} r={1.5} fill={skin} stroke={outline} strokeWidth={0.4} />
            <circle cx={8} cy={-7} r={1.5} fill={skin} stroke={outline} strokeWidth={0.4} />
            {/* Staff — rotates for attack, orb flares */}
            <g transform={`rotate(${wAngle * 0.5}, -9.25, -5)`}>
              <rect x={-10} y={-28} width={1.5} height={27} rx={0.5} fill={wood} stroke={outline} strokeWidth={0.4} />
              <circle cx={-9.25} cy={-28.5} r={2.5} fill="#40b070" stroke={outline} strokeWidth={0.5} opacity={0.8} />
              <circle cx={-9.25} cy={-28.5} r={1.3} fill="#80f0a0" opacity={0.5} />
              {animState === 'attack' && animFrame % 4 === 1 && (
                <circle cx={-9.25} cy={-28.5} r={6} fill="#40b070" opacity={0.3}>
                  <animate attributeName="r" values="3;8;3" dur="0.3s" repeatCount="1" />
                  <animate attributeName="opacity" values="0.5;0;0.5" dur="0.3s" repeatCount="1" />
                </circle>
              )}
            </g>
            <rect x={-1.5} y={-16.5} width={3} height={2.5} fill={skin} />
            <circle cx={0} cy={-21} r={5.2} fill={skin} stroke={outline} strokeWidth={0.7} />
            <ellipse cx={0} cy={-24.5} rx={8.5} ry={2.2} fill={color} stroke={outline} strokeWidth={0.6} />
            <path d="M-4.5,-24.5 Q-4,-30 0,-32 Q4,-30 4.5,-24.5 Z" fill={dk} stroke={outline} strokeWidth={0.5} />
            <ellipse cx={0} cy={-24.5} rx={4} ry={1.5} fill={color} opacity={0.5} />
            <ellipse cx={-1.8} cy={-20.5} rx={1} ry={0.8} fill={outline} />
            <ellipse cx={1.8} cy={-20.5} rx={1} ry={0.8} fill={outline} />
            <rect x={-1.5} y={-20.7} width={0.5} height={0.4} fill="#fff" />
            <rect x={1.5} y={-20.7} width={0.5} height={0.4} fill="#fff" />
            <path d="M-1.5,-18.5 Q0,-17.5 1.5,-18.5" fill="none" stroke={outline} strokeWidth={0.5} />
          </g>
        </g>
      );

    case 'sage':
      return (
        <g transform={`scale(${facing}, 1)`}>
          {spawnGlow}
          <ellipse cx={0} cy={2} rx={8} ry={2.5} fill="#000" opacity={0.25} />
          <g transform={`translate(${lunge}, ${bounce})`}>
            <path d="M-7,-14 L-8.5,-1 Q-6,2 0,2.5 Q6,2 8.5,-1 L7,-14 Z" fill={color} stroke={outline} strokeWidth={0.7} />
            <line x1={0} y1={-13} x2={0} y2={1} stroke={dk} strokeWidth={0.5} opacity={0.4} />
            <path d="M-7,-14 Q-11,-9 -10,-5 L-7,-6 Z" fill={dk} stroke={outline} strokeWidth={0.5} />
            <path d="M7,-14 Q11,-9 10,-5 L7,-6 Z" fill={dk} stroke={outline} strokeWidth={0.5} />
            <circle cx={-9} cy={-5.5} r={1.5} fill={skin} stroke={outline} strokeWidth={0.3} />
            <circle cx={9} cy={-5.5} r={1.5} fill={skin} stroke={outline} strokeWidth={0.3} />
            <path d="M-5,-14 Q0,-12 5,-14 Q5,-15.5 0,-16 Q-5,-15.5 -5,-14 Z" fill="#8a6030" stroke={outline} strokeWidth={0.4} />
            <circle cx={0} cy={-14.5} r={1} fill="#ffd040" opacity={0.8} />
            <rect x={-1.5} y={-18} width={3} height={2.5} fill={skin} />
            <circle cx={0} cy={-22.5} r={5.5} fill={skin} stroke={outline} strokeWidth={0.7} />
            <path d="M-7,-24 L0,-38 L7,-24 Z" fill={color} stroke={outline} strokeWidth={0.7} />
            <path d="M-7.5,-24 L7.5,-24 Q7,-22.5 0,-22 Q-7,-22.5 -7.5,-24 Z" fill={dk} stroke={outline} strokeWidth={0.5} />
            <circle cx={0} cy={-32} r={1.5} fill="#ffd040" opacity={0.9} />
            <path d="M-3.5,-22.5 Q-2,-21.5 -0.5,-22.5" fill="none" stroke={outline} strokeWidth={0.8} />
            <path d="M0.5,-22.5 Q2,-21.5 3.5,-22.5" fill="none" stroke={outline} strokeWidth={0.8} />
            <rect x={-2.5} y={-22.5} width={0.6} height={0.4} fill="#6040ff" />
            <rect x={1.9} y={-22.5} width={0.6} height={0.4} fill="#6040ff" />
            <path d="M-2,-19.5 Q-2.5,-16 -1,-14 Q0,-13 1,-14 Q2.5,-16 2,-19.5" fill="#c0b8a0" stroke={outline} strokeWidth={0.3} opacity={0.7} />
            {/* Staff — raises for cast, orb bursts */}
            <g transform={`rotate(${wAngle * 0.7}, 11.4, -5)`}>
              <rect x={10.5} y={-32} width={1.8} height={30} rx={0.5} fill={wood} stroke={outline} strokeWidth={0.4} />
              <circle cx={11.4} cy={-33} r={3.5} fill="#5080d8" stroke={outline} strokeWidth={0.6} opacity={0.8} />
              <circle cx={11.4} cy={-33} r={2} fill="#80b8ff" opacity={0.5} />
            </g>
            {/* Magic burst on strike frame */}
            {animState === 'attack' && animFrame % 4 === 1 && (
              <g>
                <circle cx={11.4} cy={-36} r={8} fill="none" stroke="#80b8ff" strokeWidth={1.5} opacity={0.6} />
                <circle cx={11.4} cy={-36} r={4} fill="#80b8ff" opacity={0.4} />
                {[0, 60, 120, 180, 240, 300].map(a => (
                  <line key={a} x1={11.4 + 5 * Math.cos(a * Math.PI / 180)} y1={-36 + 5 * Math.sin(a * Math.PI / 180)}
                    x2={11.4 + 9 * Math.cos(a * Math.PI / 180)} y2={-36 + 9 * Math.sin(a * Math.PI / 180)}
                    stroke="#b0d8ff" strokeWidth={0.8} opacity={0.7} />
                ))}
              </g>
            )}
          </g>
        </g>
      );

    case 'generalist':
    default:
      return (
        <g transform={`scale(${facing}, 1)`}>
          {spawnGlow}
          <ellipse cx={0} cy={2} rx={7.5} ry={2.3} fill="#000" opacity={0.25} />
          <g transform={`translate(${lStep}, 0)`}>
            <rect x={-5} y={-1.5} width={3.5} height={2.5} rx={0.6} fill={outline} />
            <rect x={-4.5} y={-1} width={3} height={1.5} rx={0.4} fill={metalDk} />
            <rect x={-4} y={-7} width={3} height={5.5} fill={dk} stroke={outline} strokeWidth={0.5} />
          </g>
          <g transform={`translate(${rStep}, 0)`}>
            <rect x={1.5} y={-1.5} width={3.5} height={2.5} rx={0.6} fill={outline} />
            <rect x={2} y={-1} width={3} height={1.5} rx={0.4} fill={metalDk} />
            <rect x={1} y={-7} width={3} height={5.5} fill={dk} stroke={outline} strokeWidth={0.5} />
          </g>
          <g transform={`translate(${lunge}, ${bounce})`}>
            <path d="M-5,-14.5 Q-8,-8 -9.5,-1 Q-7,2 -4,1 Q-3,-5 -4,-14.5 Z" fill={dk} stroke={outline} strokeWidth={0.4} opacity={0.7} />
            <path d="M5,-14.5 Q8,-8 9.5,-1 Q7,2 4,1 Q3,-5 4,-14.5 Z" fill={dk} stroke={outline} strokeWidth={0.4} opacity={0.5} />
            <rect x={-5.5} y={-14.5} width={11} height={8} rx={1.2} fill={color} stroke={outline} strokeWidth={0.7} />
            <circle cx={0} cy={-11} r={2} fill={dk} stroke={lt} strokeWidth={0.4} opacity={0.5} />
            <path d="M-0.8,-12 L0,-13 L0.8,-12 L0,-9.5 Z" fill={lt} opacity={0.5} />
            <ellipse cx={-6} cy={-13} rx={2.5} ry={2} fill={color} stroke={outline} strokeWidth={0.5} />
            <ellipse cx={6} cy={-13} rx={2.5} ry={2} fill={color} stroke={outline} strokeWidth={0.5} />
            <rect x={-5} y={-7.5} width={10} height={1.8} rx={0.3} fill="#2a1a08" stroke={outline} strokeWidth={0.4} />
            <rect x={-1} y={-7.5} width={2} height={1.8} rx={0.3} fill="#8a7030" />
            <rect x={-1.5} y={-16.5} width={3} height={2.5} fill={skin} />
            <circle cx={0} cy={-21} r={5.2} fill={skin} stroke={outline} strokeWidth={0.7} />
            <path d="M-5.5,-21.5 Q-6,-28 0,-30 Q6,-28 5.5,-21.5" fill={hair} stroke={outline} strokeWidth={0.5} />
            <path d="M-4,-24.5 L-3,-26.5 L-1,-24.5 L0,-27 L1,-24.5 L3,-26.5 L4,-24.5" fill="none" stroke="#ffd040" strokeWidth={0.8} />
            <circle cx={0} cy={-27} r={0.8} fill="#ffd040" opacity={0.9} />
            <ellipse cx={-1.8} cy={-20.8} rx={1} ry={0.8} fill={outline} />
            <ellipse cx={1.8} cy={-20.8} rx={1} ry={0.8} fill={outline} />
            <rect x={-1.5} y={-21} width={0.5} height={0.4} fill="#f0d080" />
            <rect x={1.5} y={-21} width={0.5} height={0.4} fill="#f0d080" />
            <rect x={-1} y={-18.5} width={2} height={0.5} rx={0.2} fill={skinDk} />
            {/* Sword arm — rotates for attack */}
            <g transform={`rotate(${wAngle}, 8.75, -9)`}>
              <rect x={8} y={-22} width={1.5} height={14} rx={0.3} fill={metalLt} stroke={outline} strokeWidth={0.4} />
              <rect x={6.5} y={-9} width={4.5} height={1.8} rx={0.5} fill="#8a7030" stroke={outline} strokeWidth={0.3} />
              <rect x={7.5} y={-7.5} width={2.5} height={3} rx={0.3} fill="#3a2820" stroke={outline} strokeWidth={0.3} />
              {animState === 'attack' && animFrame % 4 === 1 && (
                <line x1={8.75} y1={-22} x2={8.75} y2={-26} stroke="#fff" strokeWidth={1} opacity={0.8} />
              )}
            </g>
          </g>
        </g>
      );
  }
}

export default function HexMap({ hexes, spirits, playerId, selectedSpirit, onSelectSpirit, gameState, whisperTrails = [], events = [] }) {
  const hexArray = useMemo(() => Object.values(hexes), [hexes]);
  const [hoveredHex, setHoveredHex] = useState(null);
  const [hoveredSpirit, setHoveredSpirit] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const [activeTrails, setActiveTrails] = useState([]);
  const [pulsingSpirits, setPulsingSpirits] = useState(new Set());
  const [dyingSpirits, setDyingSpirits] = useState(new Set());
  const [moveTrails, setMoveTrails] = useState([]);
  const [battleEffects, setBattleEffects] = useState([]);
  const [spawnEffects, setSpawnEffects] = useState([]);
  const [claimFlashes, setClaimFlashes] = useState([]);
  const prevSpiritsRef = useRef({});
  const processedEventsRef = useRef(new Set());

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
    }
    prevSpiritsRef.current = spirits;
  }, [spirits]);

  useEffect(() => {
    if (!events.length) return;
    const now = Date.now();
    for (const evt of events) {
      const eid = `${evt.type}-${evt.timestamp || ''}-${evt.hexId || evt.spiritId || ''}`;
      if (processedEventsRef.current.has(eid)) continue;
      processedEventsRef.current.add(eid);
      if (evt.timestamp && now - evt.timestamp > 5000) continue;

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
          const pc = winner ? (getPlayerColor(winner.playerId, gameState) || '#dc3545') : '#dc3545';
          setBattleEffects(prev => [...prev, { id: eid, pos: p, color: pc, fatal: evt.loserOutcome === 'died', margin: evt.margin || 0 }]);
          setTimeout(() => setBattleEffects(prev => prev.filter(e => e.id !== eid)), 2000);
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
    dragRef.current = { startX: e.clientX, startY: e.clientY, startPan: { ...pan }, dragged: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [pan]);

  const handlePointerMove = useCallback((e) => {
    if (!dragRef.current) return;
    const dist = Math.abs(e.clientX - dragRef.current.startX) + Math.abs(e.clientY - dragRef.current.startY);
    if (dist > 4) dragRef.current.dragged = true;
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const vw = baseW / zoom;
    const vh = baseH / zoom;
    const dx = ((e.clientX - dragRef.current.startX) / rect.width) * vw;
    const dy = ((e.clientY - dragRef.current.startY) / rect.height) * vh;
    setPan({ x: dragRef.current.startPan.x - dx, y: dragRef.current.startPan.y - dy });
  }, [zoom, baseW, baseH]);

  const handlePointerUp = useCallback(() => { dragRef.current = null; }, []);

  const vbW = baseW / zoom;
  const vbH = baseH / zoom;
  const vbX = baseCx - vbW / 2 + pan.x;
  const vbY = baseCy - vbH / 2 + pan.y;

  return (
    <div className="relative w-full h-full" style={{ background: '#0c1018' }}>
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

              {hex.memoryPool > 0 && (
                <text x={0} y={HEX_SIZE * 0.45} textAnchor="middle" fontSize="5"
                  fill="rgba(45,212,191,0.3)" fontFamily="monospace">{Math.round(hex.memoryPool)}m</text>
              )}
            </g>
          );
        })}

        {hexArray.flatMap(hex => {
          const { x, y } = hexToPixel({ q: hex.q, r: hex.r }, HEX_SIZE);
          const hexSpirits = hex.spiritIds.map(id => spirits[id]).filter(Boolean);

          return hexSpirits.map((spirit, i) => {
            if (spirit.hexId !== hex.id) return null;
            const angle = (2 * Math.PI * i) / Math.max(hexSpirits.length, 1);
            const spread = hexSpirits.length === 1 ? 0 : HEX_SIZE * 0.3;
            const sx = x + spread * Math.cos(angle);
            const sy = y + spread * Math.sin(angle);
            const isSelected = spirit.id === selectedSpirit;
            const isDying = dyingSpirits.has(spirit.id);
            if (!spirit.alive && !isDying) return null;

            const pc = getPlayerColor(spirit.playerId, gameState) || '#6b7280';
            const spec = spirit.specialization || 'generalist';

            const isHovered = hoveredSpirit === spirit.id;
            const isMine = spirit.playerId === playerId;

            // --- Movement detection + facing ---
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

            return (
              <g
                key={spirit.id}
                style={{
                  transform: `translate(${sx}px, ${sy + 5}px)`,
                  transition: 'transform 0.6s ease-in-out, opacity 1s',
                  cursor: spirit.alive ? 'pointer' : 'default',
                  opacity: isDying ? 0 : 1,
                }}
                onClick={(e) => { e.stopPropagation(); if (spirit.alive && !dragRef.current?.dragged) onSelectSpirit(spirit.id); }}
                onMouseEnter={() => setHoveredSpirit(spirit.id)}
                onMouseLeave={() => setHoveredSpirit(null)}
              >
                {/* Hover glow ring */}
                {isHovered && !isSelected && (
                  <ellipse cx={0} cy={-10} rx={10} ry={14} fill="none"
                    stroke={isMine ? '#f0c040' : pc} strokeWidth={1} opacity={0.4} strokeDasharray="3 2" />
                )}

                <SpiritSprite spec={spec} color={pc} animState={animState} animFrame={animTick} facing={face} />

                {isSelected && (
                  <g>
                    <rect x={-8} y={-26} width={16} height={28} rx={2}
                      fill="none" stroke="#f0c040" strokeWidth={1.5} strokeDasharray="4 2" opacity={0.7}>
                      <animate attributeName="stroke-dashoffset" values="0;-12" dur="1.5s" repeatCount="indefinite" />
                    </rect>
                    <polygon points="-3,-28 0,-31 3,-28" fill="#f0c040" opacity={0.8} />
                  </g>
                )}

                {/* Name label on hover */}
                {isHovered && (
                  <g>
                    <rect x={-20} y={-38} width={40} height={9} rx={2}
                      fill="rgba(12,16,24,0.9)" stroke="rgba(200,180,100,0.25)" strokeWidth={0.5} />
                    <text x={0} y={-31.5} textAnchor="middle" fontSize="5.5"
                      fill="#e8dcc0" fontFamily="'Cinzel', serif" fontWeight="600">
                      {spirit.name}
                    </text>
                  </g>
                )}

                {/* Battle ring effect */}
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
                {!spirit.currentAction?.type && spirit.generation > 0 && !isDying && !isHovered && (
                  <text x={0} y={-28} textAnchor="middle" fontSize="5" fill="#a080e0" fontFamily="monospace" opacity={0.6}>
                    G{spirit.generation}
                  </text>
                )}
                {spirit.generation > 0 && !isDying && isHovered && (
                  <text x={0} y={-42} textAnchor="middle" fontSize="4" fill="#a080e0" fontFamily="monospace" opacity={0.7}>
                    gen {spirit.generation}
                  </text>
                )}
              </g>
            );
          });
        })}

        {activeTrails.map(trail => {
          const from = spirits[trail.from];
          const to = spirits[trail.to];
          if (!from || !to) return null;
          const fh = hexes[from.hexId];
          const th = hexes[to.hexId];
          if (!fh || !th) return null;
          const p1 = hexToPixel({ q: fh.q, r: fh.r }, HEX_SIZE);
          const p2 = hexToPixel({ q: th.q, r: th.r }, HEX_SIZE);
          const mx = (p1.x + p2.x) / 2;
          const my = (p1.y + p2.y) / 2 - 12;
          return (
            <path
              key={trail.id}
              d={`M${p1.x},${p1.y} Q${mx},${my} ${p2.x},${p2.y}`}
              fill="none" stroke="#e0b040" strokeWidth={1.2}
              strokeDasharray="3 3" opacity={0.5}
            >
              <animate attributeName="opacity" values="0.6;0.2;0" dur="2s" fill="freeze" />
              <animate attributeName="stroke-dashoffset" values="0;-12" dur="0.6s" repeatCount="3" />
            </path>
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
            <circle cx={0} cy={0} r={2} fill="#fff" opacity={0.9}>
              <animate attributeName="r" values="2;22" dur="0.4s" fill="freeze" />
              <animate attributeName="opacity" values="0.9;0" dur="0.4s" fill="freeze" />
            </circle>
            {/* Expanding ring */}
            <circle cx={0} cy={0} r={4} fill="none" stroke={fx.color} strokeWidth={2.5} opacity={0.8}>
              <animate attributeName="r" values="4;30" dur="0.8s" fill="freeze" />
              <animate attributeName="opacity" values="0.8;0" dur="0.8s" fill="freeze" />
              <animate attributeName="stroke-width" values="2.5;0.5" dur="0.8s" fill="freeze" />
            </circle>
            {fx.fatal && (
              <circle cx={0} cy={0} r={8} fill="none" stroke="#ff4040" strokeWidth={1.5} opacity={0.6}>
                <animate attributeName="r" values="8;35" dur="1s" begin="0.2s" fill="freeze" />
                <animate attributeName="opacity" values="0.6;0" dur="1s" begin="0.2s" fill="freeze" />
              </circle>
            )}
            {/* Crossed swords */}
            <g opacity={0.9}>
              <animate attributeName="opacity" values="0.9;0" dur="1.5s" fill="freeze" />
              <line x1={-8} y1={-8} x2={8} y2={8} stroke="#fff" strokeWidth={2} strokeLinecap="round">
                <animate attributeName="x1" values="0;-8" dur="0.2s" fill="freeze" />
                <animate attributeName="y1" values="0;-8" dur="0.2s" fill="freeze" />
                <animate attributeName="x2" values="0;8" dur="0.2s" fill="freeze" />
                <animate attributeName="y2" values="0;8" dur="0.2s" fill="freeze" />
              </line>
              <line x1={8} y1={-8} x2={-8} y2={8} stroke="#fff" strokeWidth={2} strokeLinecap="round">
                <animate attributeName="x1" values="0;8" dur="0.2s" fill="freeze" />
                <animate attributeName="y1" values="0;-8" dur="0.2s" fill="freeze" />
                <animate attributeName="x2" values="0;-8" dur="0.2s" fill="freeze" />
                <animate attributeName="y2" values="0;8" dur="0.2s" fill="freeze" />
              </line>
            </g>
            {/* Sparks */}
            {[0, 60, 120, 180, 240, 300].map((angle, i) => {
              const rad = (angle * Math.PI) / 180;
              const ex = Math.cos(rad) * 20;
              const ey = Math.sin(rad) * 20;
              return (
                <circle key={i} cx={0} cy={0} r={1.2} fill={i % 2 === 0 ? '#ffd040' : fx.color} opacity={0.8}>
                  <animate attributeName="cx" values={`0;${ex}`} dur="0.5s" fill="freeze" />
                  <animate attributeName="cy" values={`0;${ey}`} dur="0.5s" fill="freeze" />
                  <animate attributeName="opacity" values="0.8;0" dur="0.6s" fill="freeze" />
                  <animate attributeName="r" values="1.2;0.3" dur="0.6s" fill="freeze" />
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
            <div style={{ color: '#60a890', fontSize: '10px' }}>{Math.round(hoveredHex.hex.memoryPool)} memories</div>
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
          className="w-7 h-7 rounded bg-gray-900/80 border border-gray-700/50 text-gray-400 hover:text-white hover:border-gray-500 text-[9px] font-mono flex items-center justify-center backdrop-blur-sm"
          title="Reset view">
          R
        </button>
      </div>

      {zoom !== 1 && (
        <div className="absolute bottom-3 left-12 text-[9px] font-mono text-gray-500 bg-gray-900/60 px-1.5 py-0.5 rounded backdrop-blur-sm">
          {Math.round(zoom * 100)}%
        </div>
      )}
    </div>
  );
}
