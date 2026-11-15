// The designed Christmas backdrop: a static night scene rendered once per
// resize, plus animated snowfall.

function rng(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

export class Scene {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.flakes = [];
    this.w = 0;
    this.h = 0;
  }

  resize(w, h) {
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.#paint(this.canvas.getContext('2d'), w, h);
    const r = rng(7);
    this.flakes = Array.from({ length: Math.round((w * h) / 16000) }, () => ({
      x: r() * w,
      y: r() * h,
      r: (0.6 + r() * 2.2) * (h / 800),
      speed: 0.03 + r() * 0.07,
      phase: r() * Math.PI * 2,
    }));
  }

  #paint(ctx, w, h) {
    const r = rng(42);

    // Sky
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#081226');
    sky.addColorStop(0.55, '#143a63');
    sky.addColorStop(1, '#2c6a8f');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Stars
    for (let i = 0; i < 140; i++) {
      ctx.globalAlpha = 0.3 + r() * 0.7;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(r() * w, r() * h * 0.6, (0.5 + r() * 1.4) * (h / 800), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Moon with halo
    const mx = w * 0.84, my = h * 0.2, mr = h * 0.075;
    const halo = ctx.createRadialGradient(mx, my, mr * 0.8, mx, my, mr * 4);
    halo.addColorStop(0, 'rgba(255,244,214,.35)');
    halo.addColorStop(1, 'rgba(255,244,214,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#fff4d6';
    ctx.beginPath();
    ctx.arc(mx, my, mr, 0, Math.PI * 2);
    ctx.fill();

    // Hills and trees, back to front
    this.#hill(ctx, w, h, 0.66, 0.05, '#3f7fa6', 1.1);
    this.#trees(ctx, w, h, r, 0.66, 0.10, '#0f3b4d', 9);
    this.#hill(ctx, w, h, 0.76, 0.06, '#9cc7e0', 2.3);
    this.#trees(ctx, w, h, r, 0.77, 0.16, '#0c2f3a', 6);
    this.#hill(ctx, w, h, 0.88, 0.04, '#eaf4fb', 3.7);
  }

  #hillY(w, h, base, amp, phase, x) {
    return h * (base + amp * Math.sin((x / w) * Math.PI * 2 + phase)
      + amp * 0.4 * Math.sin((x / w) * Math.PI * 5 + phase * 2));
  }

  #hill(ctx, w, h, base, amp, color, phase) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, this.#hillY(w, h, base, amp, phase, x));
    ctx.lineTo(w, h);
    ctx.fill();
  }

  #trees(ctx, w, h, r, base, size, color, count) {
    for (let i = 0; i < count; i++) {
      // Keep the middle clearer so the player stands out.
      let x = ((i + r() * 0.8) / count) * w;
      const th = h * size * (0.7 + r() * 0.6);
      const tw = th * 0.5;
      const y = h * (base + 0.03);
      for (let t = 0; t < 3; t++) {
        const top = y - th + (t * th) / 4.2;
        const half = (tw / 2) * (0.5 + t * 0.25);
        const bottom = top + th * 0.5;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + half, bottom);
        ctx.lineTo(x - half, bottom);
        ctx.fill();
        // Snow cap
        ctx.fillStyle = 'rgba(234,244,251,.85)';
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x + half * 0.42, top + (bottom - top) * 0.42);
        ctx.lineTo(x, top + (bottom - top) * 0.3);
        ctx.lineTo(x - half * 0.42, top + (bottom - top) * 0.42);
        ctx.fill();
      }
    }
  }

  draw(ctx, t, dt) {
    ctx.drawImage(this.canvas, 0, 0);
  }

  drawSnow(ctx, t, dt) {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath();
    for (const f of this.flakes) {
      f.y += f.speed * this.h * dt;
      if (f.y > this.h + 4) { f.y = -4; }
      const x = f.x + Math.sin(t * 0.8 + f.phase) * 14;
      ctx.moveTo(x + f.r, f.y);
      ctx.arc(x, f.y, f.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }
}
