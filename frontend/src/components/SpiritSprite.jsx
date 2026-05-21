import { useMemo } from 'react';

const AFFINITY_TO_CHAR = {
  flame: 'fire_knight',
  tide: 'water_priestess',
  stone: 'ground_monk',
  wind: 'wind_hashashin',
  growth: 'leaf_ranger',
  shadow: 'crystal_mauler',
};

const DEFAULT_CHAR = 'metal_bladekeeper';

const FRAME_COUNTS = {
  fire_knight:       { idle: 8,  walk: 8,  attack: 11, hit: 6, death: 13 },
  water_priestess:   { idle: 8,  walk: 10, attack: 7,  hit: 7, death: 16 },
  ground_monk:       { idle: 6,  walk: 8,  attack: 23, hit: 6, death: 18 },
  wind_hashashin:    { idle: 8,  walk: 8,  attack: 26, hit: 6, death: 19 },
  leaf_ranger:       { idle: 12, walk: 10, attack: 12, hit: 6, death: 19 },
  crystal_mauler:    { idle: 8,  walk: 8,  attack: 17, hit: 6, death: 15 },
  metal_bladekeeper: { idle: 8,  walk: 8,  attack: 6,  hit: 6, death: 12 },
};

const STATE_MAP = { idle: 'idle', walk: 'walk', attack: 'attack', spawn: 'death' };

const AFFINITY_TO_FLASH = {
  flame: 'golden', stone: 'golden',
  tide: 'cyan', wind: 'cyan',
  growth: 'green',
  shadow: 'pink',
};
const FLASH_FRAMES = 10;
const FLASH_SIZE = 30;

const FRAME_W = 288;
const FRAME_H = 128;
const SCALE = 80 / FRAME_H;
const DISPLAY_W = FRAME_W * SCALE;
const DISPLAY_H = FRAME_H * SCALE;

const imgCache = {};
function preloadFrame(src) {
  if (!imgCache[src]) {
    const img = new Image();
    img.src = src;
    imgCache[src] = true;
  }
}

export const SPIRIT_SPECS = ['warrior', 'scout', 'gatherer', 'sage', 'generalist'];

export function getAnimData() {
  return { bounce: 0, leftStep: 0, rightStep: 0, lunge: 0, weaponAngle: 0 };
}

export default function SpiritSprite({ spec, color, animState = 'idle', animFrame = 0, facing = 1, affinity }) {
  const charName = AFFINITY_TO_CHAR[affinity] || DEFAULT_CHAR;
  const isSpawn = animState === 'spawn';
  const mappedState = STATE_MAP[animState] || 'idle';
  const counts = FRAME_COUNTS[charName] || FRAME_COUNTS[DEFAULT_CHAR];
  const maxFrames = counts[mappedState] || counts.idle;

  let frameNum, spawnProgress;
  if (isSpawn) {
    const spawnFrames = Math.min(maxFrames, 10);
    const frame = animFrame % spawnFrames;
    frameNum = maxFrames - frame;
    spawnProgress = Math.min(1, frame / Math.max(1, spawnFrames - 1));
  } else {
    frameNum = (animFrame % maxFrames) + 1;
    spawnProgress = 1;
  }
  const src = `/sprites/${charName}/${mappedState}/${frameNum}.png`;

  const flashVariant = AFFINITY_TO_FLASH[affinity] || 'golden';
  const flashFrame = isSpawn ? Math.min(FLASH_FRAMES, (animFrame % FLASH_FRAMES) + 1) : 0;
  const flashSrc = isSpawn ? `/sprites/fx/spawn/${flashVariant}/${flashFrame}.png` : null;

  const nextFrame = isSpawn
    ? Math.max(1, frameNum - 1)
    : (frameNum % maxFrames) + 1;
  useMemo(() => {
    preloadFrame(`/sprites/${charName}/${mappedState}/${nextFrame}.png`);
    if (isSpawn && flashFrame < FLASH_FRAMES) {
      preloadFrame(`/sprites/fx/spawn/${flashVariant}/${flashFrame + 1}.png`);
    }
  }, [charName, mappedState, nextFrame, isSpawn, flashVariant, flashFrame]);

  const spawnScale = isSpawn ? 0.5 + spawnProgress * 0.5 : 1;
  const spawnOpacity = isSpawn ? 0.3 + spawnProgress * 0.7 : 1;

  return (
    <g>
      {isSpawn && flashSrc && (
        <image
          href={flashSrc}
          x={-FLASH_SIZE / 2}
          y={-DISPLAY_H * 0.2 - FLASH_SIZE / 2}
          width={FLASH_SIZE}
          height={FLASH_SIZE}
          style={{ mixBlendMode: 'screen', imageRendering: 'pixelated' }}
          opacity={0.85 + spawnProgress * 0.15}
        />
      )}
      <g transform={`scale(${facing * spawnScale}, ${spawnScale})`} opacity={spawnOpacity}>
        <image
          href={src}
          x={-DISPLAY_W / 2}
          y={-DISPLAY_H}
          width={DISPLAY_W}
          height={DISPLAY_H}
          style={{
            imageRendering: 'pixelated',
            filter: isSpawn
              ? `brightness(${1 + Math.max(0, 1 - spawnProgress * 1.5) ** 2 * 4}) saturate(${Math.max(0, (spawnProgress - 0.4) / 0.6)})`
              : undefined,
          }}
        />
      </g>
    </g>
  );
}
