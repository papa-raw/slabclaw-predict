const MAX_PARTICLES = 2000;
const TEXTURE_SIZE = 64;

class Particle {
  constructor() {
    this.alive = false;
    this.x = 0; this.y = 0;
    this.vx = 0; this.vy = 0;
    this.life = 0; this.maxLife = 1;
    this.size = 4; this.sizeEnd = 0;
    this.alpha = 1; this.alphaEnd = 0;
    this.r = 255; this.g = 200; this.b = 50;
    this.r2 = 100; this.g2 = 30; this.b2 = 0;
    this.gravity = 0;
    this.friction = 1;
    this.rotation = 0; this.rotationSpeed = 0;
    this.texture = null;
    this.additive = false;
  }

  reset(cfg) {
    this.alive = true;
    this.x = cfg.x || 0;
    this.y = cfg.y || 0;
    this.vx = cfg.vx || 0;
    this.vy = cfg.vy || 0;
    this.life = 0;
    this.maxLife = cfg.maxLife || 1;
    this.size = cfg.size || 4;
    this.sizeEnd = cfg.sizeEnd ?? 0;
    this.alpha = cfg.alpha ?? 1;
    this.alphaEnd = cfg.alphaEnd ?? 0;
    this.r = cfg.r ?? 255; this.g = cfg.g ?? 200; this.b = cfg.b ?? 50;
    this.r2 = cfg.r2 ?? this.r * 0.4; this.g2 = cfg.g2 ?? this.g * 0.15; this.b2 = cfg.b2 ?? 0;
    this.gravity = cfg.gravity ?? 0;
    this.friction = cfg.friction ?? 1;
    this.rotation = cfg.rotation ?? 0;
    this.rotationSpeed = cfg.rotationSpeed ?? 0;
    this.texture = cfg.texture || null;
    this.additive = cfg.additive ?? false;
  }
}

export default class ParticleManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = Array.from({ length: MAX_PARTICLES }, () => new Particle());
    this.textures = new Map();
    this.running = false;
    this._lastTime = 0;
    this._frameId = null;
    this._tintCanvas = document.createElement('canvas');
    this._tintCanvas.width = TEXTURE_SIZE;
    this._tintCanvas.height = TEXTURE_SIZE;
    this._tintCtx = this._tintCanvas.getContext('2d');
  }

  async loadTexture(name, src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const offscreen = document.createElement('canvas');
        offscreen.width = TEXTURE_SIZE;
        offscreen.height = TEXTURE_SIZE;
        const octx = offscreen.getContext('2d');
        octx.drawImage(img, 0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        this.textures.set(name, offscreen);
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this._lastTime = performance.now();
    this._tick();
  }

  stop() {
    this.running = false;
    if (this._frameId) cancelAnimationFrame(this._frameId);
  }

  _tick() {
    if (!this.running) return;
    const now = performance.now();
    const dt = Math.min((now - this._lastTime) / 1000, 0.05);
    this._lastTime = now;
    this._update(dt);
    this._render();
    this._frameId = requestAnimationFrame(() => this._tick());
  }

  _getParticle() {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (!this.particles[i].alive) return this.particles[i];
    }
    return null;
  }

  emit(count, cfg) {
    for (let i = 0; i < count; i++) {
      const p = this._getParticle();
      if (!p) break;
      const c = typeof cfg === 'function' ? cfg(i, count) : { ...cfg };
      p.reset(c);
    }
  }

  _update(dt) {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;
      p.life += dt;
      if (p.life >= p.maxLife) { p.alive = false; continue; }
      p.vy += p.gravity * dt;
      p.vx *= p.friction;
      p.vy *= p.friction;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rotation += p.rotationSpeed * dt;
    }
  }

  _render() {
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    let prevComposite = 'source-over';
    ctx.globalCompositeOperation = 'source-over';

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.alive) continue;

      const t = p.life / p.maxLife;
      const size = p.size + (p.sizeEnd - p.size) * t;
      const alpha = p.alpha + (p.alphaEnd - p.alpha) * t;
      if (alpha <= 0 || size <= 0) continue;

      const r = Math.round(p.r + (p.r2 - p.r) * t);
      const g = Math.round(p.g + (p.g2 - p.g) * t);
      const b = Math.round(p.b + (p.b2 - p.b) * t);

      const composite = p.additive ? 'lighter' : 'source-over';
      if (composite !== prevComposite) {
        ctx.globalCompositeOperation = composite;
        prevComposite = composite;
      }

      ctx.globalAlpha = alpha;

      const tex = p.texture ? this.textures.get(p.texture) : null;

      ctx.save();
      ctx.translate(p.x, p.y);
      if (p.rotation) ctx.rotate(p.rotation);

      if (tex) {
        const tc = this._tintCanvas;
        const tctx = this._tintCtx;
        tctx.clearRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        tctx.globalCompositeOperation = 'source-over';
        tctx.drawImage(tex, 0, 0);
        tctx.globalCompositeOperation = 'source-atop';
        tctx.fillStyle = `rgb(${r},${g},${b})`;
        tctx.fillRect(0, 0, TEXTURE_SIZE, TEXTURE_SIZE);
        ctx.drawImage(tc, -size / 2, -size / 2, size, size);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size / 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  clear() {
    for (const p of this.particles) p.alive = false;
  }
}
