const rand = (min, max) => min + Math.random() * (max - min);
const randInt = (min, max) => Math.floor(rand(min, max + 1));
const TAU = Math.PI * 2;

const AFFINITY_COLORS = {
  flame:  { r: 255, g: 120, b: 30,  r2: 180, g2: 30,  b2: 0   },
  tide:   { r: 100, g: 200, b: 255, r2: 30,  g2: 80,  b2: 200 },
  stone:  { r: 160, g: 130, b: 90,  r2: 80,  g2: 60,  b2: 40  },
  wind:   { r: 180, g: 240, b: 230, r2: 80,  g2: 200, b2: 180 },
  shadow: { r: 180, g: 80,  b: 255, r2: 60,  g2: 20,  b2: 120 },
  growth: { r: 80,  g: 220, b: 80,  r2: 30,  g2: 120, b2: 20  },
};

function affinityColor(affinity) {
  return AFFINITY_COLORS[affinity] || { r: 255, g: 200, b: 50, r2: 150, g2: 80, b2: 0 };
}

export function explosion(pm, x, y, opts = {}) {
  const count = opts.count || 45;
  const speed = opts.speed || 250;
  const colors = affinityColor(opts.affinity);
  const fatal = opts.fatal || false;

  // Core burst
  pm.emit(count, (i, n) => {
    const angle = (TAU * i) / n + rand(-0.3, 0.3);
    const v = rand(speed * 0.4, speed);
    return {
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      maxLife: rand(0.3, 0.7),
      size: rand(6, 14),
      sizeEnd: rand(0, 2),
      alpha: 1, alphaEnd: 0,
      ...colors,
      gravity: rand(50, 200),
      friction: 0.96,
      texture: 'flame',
      additive: true,
      rotation: rand(0, TAU),
      rotationSpeed: rand(-5, 5),
    };
  });

  // White-hot center flash
  pm.emit(8, () => ({
    x: x + rand(-4, 4), y: y + rand(-4, 4),
    vx: rand(-30, 30), vy: rand(-30, 30),
    maxLife: rand(0.15, 0.3),
    size: rand(20, 35), sizeEnd: rand(40, 60),
    alpha: 0.9, alphaEnd: 0,
    r: 255, g: 255, b: 255, r2: 255, g2: 220, b2: 180,
    texture: 'star',
    additive: true,
  }));

  // Sparks flying outward
  pm.emit(12, (i) => {
    const angle = (TAU * i) / 12 + rand(-0.2, 0.2);
    const v = rand(speed * 0.8, speed * 1.5);
    return {
      x, y,
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      maxLife: rand(0.4, 0.8),
      size: rand(2, 4), sizeEnd: 0,
      alpha: 1, alphaEnd: 0,
      r: 255, g: 240, b: 150, r2: 255, g2: 100, b2: 30,
      gravity: 300,
      friction: 0.98,
      additive: true,
    };
  });

  // Smoke aftermath
  pm.emit(6, () => ({
    x: x + rand(-10, 10), y: y + rand(-10, 10),
    vx: rand(-20, 20), vy: rand(-60, -20),
    maxLife: rand(0.6, 1.2),
    size: rand(10, 20), sizeEnd: rand(25, 40),
    alpha: 0.4, alphaEnd: 0,
    r: 80, g: 80, b: 80, r2: 40, g2: 40, b2: 40,
    texture: 'smoke',
    friction: 0.97,
  }));

  if (fatal) {
    // Extra debris ring for fatal kills
    pm.emit(20, (i, n) => {
      const angle = (TAU * i) / n;
      const v = rand(speed * 0.6, speed * 1.2);
      return {
        x, y,
        vx: Math.cos(angle) * v,
        vy: Math.sin(angle) * v,
        maxLife: rand(0.5, 1.0),
        size: rand(3, 7), sizeEnd: 0,
        alpha: 0.8, alphaEnd: 0,
        ...colors,
        gravity: 400,
        friction: 0.97,
        rotation: rand(0, TAU),
        rotationSpeed: rand(-8, 8),
      };
    });
  }
}

export function projectileTrail(pm, fromX, fromY, toX, toY, opts = {}) {
  const colors = affinityColor(opts.affinity);
  const steps = opts.steps || 20;
  const dx = toX - fromX;
  const dy = toY - fromY;

  for (let i = 0; i < steps; i++) {
    const t = i / steps;
    const px = fromX + dx * t;
    const py = fromY + dy * t;
    const delay = t * 0.3;

    setTimeout(() => {
      // Trail particles
      pm.emit(3, () => ({
        x: px + rand(-3, 3), y: py + rand(-3, 3),
        vx: rand(-15, 15), vy: rand(-15, 15),
        maxLife: rand(0.2, 0.5),
        size: rand(4, 8), sizeEnd: 0,
        alpha: 0.7, alphaEnd: 0,
        ...colors,
        texture: 'magic',
        additive: true,
      }));

      // Head glow at leading edge
      if (i === steps - 1) {
        pm.emit(1, () => ({
          x: px, y: py,
          vx: 0, vy: 0,
          maxLife: 0.2,
          size: 16, sizeEnd: 24,
          alpha: 0.8, alphaEnd: 0,
          r: 255, g: 255, b: 255, r2: colors.r, g2: colors.g, b2: colors.b,
          texture: 'star',
          additive: true,
        }));
      }
    }, delay * 1000);
  }
}

export function bloodSplatter(pm, x, y, dirX, dirY, opts = {}) {
  const count = opts.count || 25;
  const speed = opts.speed || 200;

  const baseAngle = Math.atan2(dirY, dirX);
  const spread = 0.8;

  pm.emit(count, () => {
    const angle = baseAngle + rand(-spread, spread);
    const v = rand(speed * 0.3, speed);
    return {
      x: x + rand(-3, 3), y: y + rand(-3, 3),
      vx: Math.cos(angle) * v,
      vy: Math.sin(angle) * v,
      maxLife: rand(0.5, 1.5),
      size: rand(3, 8), sizeEnd: rand(2, 5),
      alpha: 0.9, alphaEnd: 0.3,
      r: 180, g: 10, b: 10, r2: 80, g2: 0, b2: 0,
      gravity: 350,
      friction: 0.95,
    };
  });

  // Mist spray
  pm.emit(5, () => ({
    x: x + rand(-5, 5), y: y + rand(-5, 5),
    vx: Math.cos(baseAngle) * rand(30, 80),
    vy: Math.sin(baseAngle) * rand(30, 80) - rand(20, 50),
    maxLife: rand(0.3, 0.6),
    size: rand(10, 20), sizeEnd: rand(15, 30),
    alpha: 0.3, alphaEnd: 0,
    r: 120, g: 5, b: 5, r2: 60, g2: 0, b2: 0,
    texture: 'smoke',
  }));
}

export function deathDissolve(pm, x, y, playerColor, opts = {}) {
  const hex = playerColor || '#6b7280';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Phase 1: Spirit essence rising
  pm.emit(30, (i) => ({
    x: x + rand(-12, 12), y: y + rand(-25, 5),
    vx: rand(-30, 30),
    vy: rand(-80, -30),
    maxLife: rand(0.8, 1.5),
    size: rand(3, 8), sizeEnd: rand(1, 3),
    alpha: 0.8, alphaEnd: 0,
    r, g, b, r2: 255, g2: 255, b2: 255,
    friction: 0.98,
    texture: 'magic',
    additive: true,
    rotation: rand(0, TAU),
    rotationSpeed: rand(-3, 3),
  }));

  // Phase 2: Bright flash
  pm.emit(4, () => ({
    x: x + rand(-5, 5), y: y - 10 + rand(-5, 5),
    vx: 0, vy: 0,
    maxLife: 0.4,
    size: 20, sizeEnd: 40,
    alpha: 0.6, alphaEnd: 0,
    r: 255, g: 255, b: 255, r2: r, g2: g, b2: b,
    texture: 'circle',
    additive: true,
  }));

  // Phase 3: Lingering wisps
  setTimeout(() => {
    pm.emit(10, () => ({
      x: x + rand(-8, 8), y: y - 10 + rand(-8, 8),
      vx: rand(-15, 15), vy: rand(-40, -10),
      maxLife: rand(1.0, 2.0),
      size: rand(2, 5), sizeEnd: 0,
      alpha: 0.5, alphaEnd: 0,
      r, g, b, r2: 200, g2: 200, b2: 220,
      friction: 0.99,
      additive: true,
    }));
  }, 400);
}

export function spawnVortex(pm, x, y, playerColor, opts = {}) {
  const hex = playerColor || '#a855f7';
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  // Swirling inward particles
  const count = 24;
  for (let i = 0; i < count; i++) {
    const angle = (TAU * i) / count;
    const dist = 60 + rand(0, 20);
    const startX = x + Math.cos(angle) * dist;
    const startY = y + Math.sin(angle) * dist;
    const delay = i * 40;

    setTimeout(() => {
      pm.emit(1, () => ({
        x: startX, y: startY,
        vx: (x - startX) * 2.5 + rand(-20, 20),
        vy: (y - startY) * 2.5 + rand(-20, 20),
        maxLife: rand(0.4, 0.7),
        size: rand(4, 8), sizeEnd: rand(1, 3),
        alpha: 0.8, alphaEnd: 0,
        r, g, b, r2: 255, g2: 255, b2: 255,
        texture: 'star',
        additive: true,
        rotation: angle,
        rotationSpeed: rand(3, 8),
      }));
    }, delay);
  }

  // Final burst at center
  setTimeout(() => {
    pm.emit(15, (i, n) => {
      const a = (TAU * i) / n;
      return {
        x, y,
        vx: Math.cos(a) * rand(40, 100),
        vy: Math.sin(a) * rand(40, 100),
        maxLife: rand(0.3, 0.6),
        size: rand(6, 12), sizeEnd: 0,
        alpha: 0.9, alphaEnd: 0,
        r: 255, g: 255, b: 255, r2: r, g2: g, b2: b,
        texture: 'magic',
        additive: true,
      };
    });
  }, count * 40 + 100);
}

export function whisperPulse(pm, x, y, opts = {}) {
  const isDecree = opts.decree || false;
  const color = isDecree
    ? { r: 212, g: 160, b: 82, r2: 180, g2: 120, b2: 40 }
    : { r: 160, g: 120, b: 200, r2: 100, g2: 60, b2: 140 };

  pm.emit(12, (i, n) => {
    const angle = (TAU * i) / n;
    return {
      x, y,
      vx: Math.cos(angle) * rand(30, 60),
      vy: Math.sin(angle) * rand(30, 60),
      maxLife: rand(0.5, 1.0),
      size: rand(3, 6), sizeEnd: rand(1, 3),
      alpha: 0.6, alphaEnd: 0,
      ...color,
      texture: 'magic',
      additive: true,
    };
  });
}

export function screenShake(containerEl, intensity = 'medium') {
  if (!containerEl) return;
  const px = { light: 3, medium: 8, heavy: 15 }[intensity] || 8;
  const frames = 8;
  let frame = 0;
  const run = () => {
    const decay = 1 - frame / frames;
    const tx = (Math.random() - 0.5) * px * decay;
    const ty = (Math.random() - 0.5) * px * decay;
    containerEl.style.transform = `translate(${tx}px, ${ty}px)`;
    frame++;
    if (frame < frames) requestAnimationFrame(run);
    else containerEl.style.transform = '';
  };
  requestAnimationFrame(run);
}

export function damageNumber(containerEl, x, y, amount, opts = {}) {
  if (!containerEl) return;
  const el = document.createElement('div');
  el.textContent = opts.text || `-${amount}`;
  el.style.cssText = `
    position: absolute;
    left: ${x}px; top: ${y}px;
    font-family: monospace;
    font-size: ${opts.critical ? '18px' : '14px'};
    font-weight: 700;
    color: ${opts.color || '#ff4040'};
    text-shadow: 0 1px 3px rgba(0,0,0,0.8);
    pointer-events: none;
    z-index: 100;
    transform: translate(-50%, 0);
    animation: dmgFloat 1s ease-out forwards;
  `;
  if (opts.critical) {
    el.style.fontSize = '20px';
    el.style.color = '#ffd040';
  }
  containerEl.appendChild(el);
  setTimeout(() => el.remove(), 1100);
}

export const AFFINITY_MAP = AFFINITY_COLORS;
