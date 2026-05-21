export default class SpriteAnimator {
  constructor(ctx) {
    this.ctx = ctx;
    this.sheets = new Map();
    this.active = [];
  }

  async loadSheet(name, src, frameWidth, frameHeight, frameCount, cols) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.sheets.set(name, { img, frameWidth, frameHeight, frameCount, cols: cols || Math.floor(img.width / frameWidth) });
        resolve();
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async loadSequence(name, srcs, frameWidth, frameHeight) {
    const frames = [];
    for (const src of srcs) {
      await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => { frames.push(img); resolve(); };
        img.onerror = reject;
        img.src = src;
      });
    }
    this.sheets.set(name, { frames, frameWidth, frameHeight, frameCount: frames.length, sequence: true });
  }

  play(name, x, y, scale = 1, fps = 24, onComplete = null) {
    const sheet = this.sheets.get(name);
    if (!sheet) return;
    this.active.push({
      name, x, y, scale, fps,
      frame: 0, elapsed: 0,
      totalFrames: sheet.frameCount,
      onComplete,
    });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const anim = this.active[i];
      anim.elapsed += dt;
      const frameDur = 1 / anim.fps;
      while (anim.elapsed >= frameDur) {
        anim.elapsed -= frameDur;
        anim.frame++;
      }
      if (anim.frame >= anim.totalFrames) {
        if (anim.onComplete) anim.onComplete();
        this.active.splice(i, 1);
      }
    }
  }

  render() {
    const { ctx } = this;
    for (const anim of this.active) {
      const sheet = this.sheets.get(anim.name);
      if (!sheet) continue;

      const frame = Math.min(anim.frame, sheet.frameCount - 1);
      const w = sheet.frameWidth * anim.scale;
      const h = sheet.frameHeight * anim.scale;
      const dx = anim.x - w / 2;
      const dy = anim.y - h / 2;

      if (sheet.sequence) {
        ctx.drawImage(sheet.frames[frame], dx, dy, w, h);
      } else {
        const col = frame % sheet.cols;
        const row = Math.floor(frame / sheet.cols);
        const sx = col * sheet.frameWidth;
        const sy = row * sheet.frameHeight;
        ctx.drawImage(sheet.img, sx, sy, sheet.frameWidth, sheet.frameHeight, dx, dy, w, h);
      }
    }
  }

  clear() {
    this.active = [];
  }
}
