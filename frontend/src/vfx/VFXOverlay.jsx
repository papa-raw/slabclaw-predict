import { useRef, useEffect, useCallback, useImperativeHandle, forwardRef } from 'react';
import ParticleManager from './ParticleManager.js';
import SpriteAnimator from './SpriteAnimator.js';
import {
  explosion, projectileTrail, bloodSplatter, deathDissolve,
  spawnVortex, whisperPulse, screenShake, damageNumber,
} from './effects.js';

import flameTex from '../assets/vfx/particles/kenney/flame_06.png';
import smokeTex from '../assets/vfx/particles/kenney/smoke_10.png';
import sparkTex from '../assets/vfx/particles/kenney/spark_07.png';
import starTex from '../assets/vfx/particles/kenney/star_09.png';
import magicTex from '../assets/vfx/particles/kenney/magic_05.png';
import circleTex from '../assets/vfx/particles/kenney/circle_05.png';
import fireTex from '../assets/vfx/particles/kenney/fire_02.png';

import explosionSheet3 from '../assets/vfx/sprites/explosions/2d_explosion_animations_2/Free Explosion Animations 2/Half Sized/3.png';
import explosionSheet4 from '../assets/vfx/sprites/explosions/2d_explosion_animations_2/Free Explosion Animations 2/Half Sized/4.png';
import bloodHitSheet from '../assets/vfx/sprites/blood/blood_hit_combined.png';
import hitFlashSheet from '../assets/vfx/sprites/blood/hit_flash.png';
import bloodSplashSheet from '../assets/vfx/sprites/blood/blood_splash.png';
import spawnFlash1 from '../assets/vfx/sprites/magic/spell_animations/flash01.png';
import spawnFlash2 from '../assets/vfx/sprites/magic/spell_animations/flash02.png';
import spawnFlash3 from '../assets/vfx/sprites/magic/spell_animations/flash03.png';
import spawnFlash4 from '../assets/vfx/sprites/magic/spell_animations/flash04.png';

const SPAWN_FLASH_BY_AFFINITY = {
  flame: 'spawnFlash1', tide: 'spawnFlash2', stone: 'spawnFlash1',
  wind: 'spawnFlash2', growth: 'spawnFlash3', shadow: 'spawnFlash4',
};

const TEXTURE_MANIFEST = [
  ['flame', flameTex],
  ['smoke', smokeTex],
  ['spark', sparkTex],
  ['star', starTex],
  ['magic', magicTex],
  ['circle', circleTex],
  ['fire', fireTex],
];

const SHEET_MANIFEST = [
  ['explosion3', explosionSheet3, 64, 64, 56, 8],
  ['explosion4', explosionSheet4, 64, 64, 56, 8],
  ['bloodHit', bloodHitSheet, 512, 512, 16, 4],
  ['hitFlash', hitFlashSheet, 256, 256, 16, 4],
  ['bloodSplash', bloodSplashSheet, 512, 512, 16, 4],
  ['spawnFlash1', spawnFlash1, 64, 64, 10, 5],
  ['spawnFlash2', spawnFlash2, 64, 64, 10, 5],
  ['spawnFlash3', spawnFlash3, 64, 64, 10, 5],
  ['spawnFlash4', spawnFlash4, 64, 64, 10, 5],
];

const VFXOverlay = forwardRef(function VFXOverlay({ svgRef, containerRef }, ref) {
  const canvasRef = useRef(null);
  const pmRef = useRef(null);
  const saRef = useRef(null);
  const resizeObserverRef = useRef(null);
  const animFrameRef = useRef(null);

  const worldToCanvas = useCallback((worldX, worldY) => {
    const svg = svgRef?.current;
    const canvas = canvasRef.current;
    if (!svg || !canvas) return { x: 0, y: 0 };

    const vb = svg.viewBox?.baseVal;
    if (!vb || vb.width === 0) return { x: 0, y: 0 };

    return {
      x: ((worldX - vb.x) / vb.width) * canvas.width,
      y: ((worldY - vb.y) / vb.height) * canvas.height,
    };
  }, [svgRef]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pm = new ParticleManager(canvas);
    const sa = new SpriteAnimator(canvas.getContext('2d'));
    pmRef.current = pm;
    saRef.current = sa;

    const loadAll = async () => {
      await Promise.all(TEXTURE_MANIFEST.map(([name, src]) => pm.loadTexture(name, src)));
      await Promise.all(SHEET_MANIFEST.map(([name, src, fw, fh, fc, cols]) => sa.loadSheet(name, src, fw, fh, fc, cols)));
      pm.start();

      const origRender = pm._render.bind(pm);
      pm._render = function () {
        const dt = Math.min((performance.now() - (this._lastRenderTime || performance.now())) / 1000, 0.05);
        this._lastRenderTime = performance.now();
        origRender();
        sa.update(dt);
        sa.render();
      };
    };
    loadAll();

    const syncSize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      canvas.style.width = rect.width + 'px';
      canvas.style.height = rect.height + 'px';
    };
    syncSize();

    resizeObserverRef.current = new ResizeObserver(syncSize);
    resizeObserverRef.current.observe(canvas.parentElement);

    return () => {
      pm.stop();
      resizeObserverRef.current?.disconnect();
    };
  }, []);

  useImperativeHandle(ref, () => ({
    explosion: (worldX, worldY, opts = {}) => {
      if (!pmRef.current) return;
      const { x, y } = worldToCanvas(worldX, worldY);
      explosion(pmRef.current, x, y, opts);
      if (saRef.current) {
        const sheet = opts.fatal ? 'explosion3' : 'explosion4';
        const scale = opts.fatal ? 2.0 : 1.4;
        saRef.current.play(sheet, x, y, scale, opts.fatal ? 30 : 24);
      }
      if (opts.fatal) {
        saRef.current?.play('bloodHit', x, y, 0.8, 20);
      }
    },

    projectile: (fromWX, fromWY, toWX, toWY, opts = {}) => {
      if (!pmRef.current) return;
      const from = worldToCanvas(fromWX, fromWY);
      const to = worldToCanvas(toWX, toWY);
      projectileTrail(pmRef.current, from.x, from.y, to.x, to.y, opts);
    },

    blood: (worldX, worldY, dirWX, dirWY, opts = {}) => {
      if (!pmRef.current) return;
      const { x, y } = worldToCanvas(worldX, worldY);
      const dir = worldToCanvas(worldX + dirWX, worldY + dirWY);
      bloodSplatter(pmRef.current, x, y, dir.x - x, dir.y - y, opts);
      saRef.current?.play('bloodSplash', x, y, 0.6, 20);
    },

    death: (worldX, worldY, playerColor, opts = {}) => {
      if (!pmRef.current) return;
      const { x, y } = worldToCanvas(worldX, worldY);
      deathDissolve(pmRef.current, x, y, playerColor, opts);
    },

    spawn: (worldX, worldY, playerColor, opts = {}) => {
      if (!pmRef.current) return;
      const { x, y } = worldToCanvas(worldX, worldY);
      spawnVortex(pmRef.current, x, y, playerColor, opts);
      if (saRef.current) {
        const flashSheet = SPAWN_FLASH_BY_AFFINITY[opts.affinity] || 'spawnFlash1';
        saRef.current.play(flashSheet, x, y, 3.0, 12);
        setTimeout(() => saRef.current?.play(flashSheet, x, y, 1.8, 16), 150);
      }
    },

    whisper: (worldX, worldY, opts = {}) => {
      if (!pmRef.current) return;
      const { x, y } = worldToCanvas(worldX, worldY);
      whisperPulse(pmRef.current, x, y, opts);
    },

    hitFlash: (worldX, worldY) => {
      if (!saRef.current) return;
      const { x, y } = worldToCanvas(worldX, worldY);
      saRef.current.play('hitFlash', x, y, 0.5, 24);
    },

    damageNumber: (worldX, worldY, amount, opts = {}) => {
      const svg = svgRef?.current;
      const container = containerRef?.current;
      if (!svg || !container) return;
      const rect = svg.getBoundingClientRect();
      const vb = svg.viewBox?.baseVal;
      if (!vb || vb.width === 0) return;
      const screenX = ((worldX - vb.x) / vb.width) * rect.width;
      const screenY = ((worldY - vb.y) / vb.height) * rect.height;
      damageNumber(container, screenX, screenY, amount, opts);
    },

    shake: () => {},
  }), [worldToCanvas, svgRef, containerRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0, left: 0,
        width: '100%', height: '100%',
        pointerEvents: 'none',
        zIndex: 15,
      }}
    />
  );
});

export default VFXOverlay;
