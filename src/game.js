// Game rules and entities: falling baubles and bombs, slicing, lives.

const BAUBLE_COLORS = [
  ['#ff6b78', '#d62839', '#8f1020'],
  ['#5fd39a', '#1f9d5f', '#0d5a34'],
  ['#ffe08a', '#f0a92b', '#a8690a'],
  ['#7cc4ff', '#2b7fd9', '#12468a'],
  ['#d7a4ff', '#8e44d6', '#4f1d85'],
  ['#ffffff', '#c9d6e6', '#7f8fa6'],
];

export const MAX_LIVES = 3;

export class Game {
  constructor({ onScore, onLives, onGameOver, onStart }) {
    this.cb = { onScore, onLives, onGameOver, onStart };
    this.w = 0; this.h = 0; this.unit = 40;
    this.mode = 'idle'; // idle | menu | playing | over
    this.objects = [];
    this.halves = [];
    this.particles = [];
    this.popups = [];
    this.score = 0;
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.spawnIn = 0;
    this.flash = 0;
    this.shake = 0;
    this.overTimer = 0;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.unit = Math.min(w, h) * 0.058; // bauble radius
  }

  showMenu() {
    this.mode = 'menu';
    this.objects = [{
      kind: 'start', x: this.w * 0.72, y: this.h * 0.42, baseY: this.h * 0.42,
      vx: 0, vy: 0, r: this.unit * 1.5, rot: 0, spin: 0, color: BAUBLE_COLORS[2], t: 0,
    }];
  }

  start() {
    this.mode = 'playing';
    this.objects = [];
    this.score = 0;
    this.lives = MAX_LIVES;
    this.elapsed = 0;
    this.spawnIn = 0.8;
    this.cb.onScore(0);
    this.cb.onLives(this.lives);
    this.cb.onStart();
  }

  #spawn() {
    const t = this.elapsed;
    const bombChance = t < 6 ? 0 : Math.min(0.28, 0.12 + t * 0.002);
    const bomb = Math.random() < bombChance;
    const r = this.unit * (bomb ? 1 : 0.9 + Math.random() * 0.3);
    const speed = this.h * (0.2 + Math.min(0.26, t * 0.003)) * (0.85 + Math.random() * 0.3);
    this.objects.push({
      kind: bomb ? 'bomb' : 'bauble',
      x: this.w * (0.1 + Math.random() * 0.8),
      y: -r * 1.5,
      vx: this.w * (Math.random() - 0.5) * 0.04,
      vy: speed,
      r,
      rot: (Math.random() - 0.5) * 0.5,
      spin: (Math.random() - 0.5) * 1.2,
      color: BAUBLE_COLORS[(Math.random() * BAUBLE_COLORS.length) | 0],
      t: Math.random() * 10,
    });
    this.spawnIn = Math.max(0.42, 1.25 - t * 0.012) * (0.75 + Math.random() * 0.5);
  }

  #loseLife() {
    if (this.mode !== 'playing') return;
    this.lives--;
    this.cb.onLives(this.lives);
    if (this.lives <= 0) {
      this.mode = 'over';
      this.overTimer = 1.4;
      // Clear the field: remaining items pop harmlessly
      for (const o of this.objects) this.#burst(o.x, o.y, o.kind === 'bomb' ? '#555' : o.color[1], 8);
      this.objects = [];
      this.cb.onGameOver(this.score);
    }
  }

  update(dt) {
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shake = Math.max(0, this.shake - dt * 2.5);

    if (this.mode === 'playing') {
      this.elapsed += dt;
      this.spawnIn -= dt;
      if (this.spawnIn <= 0) this.#spawn();
    } else if (this.mode === 'over') {
      this.overTimer -= dt;
      if (this.overTimer <= 0) this.showMenu();
    }

    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      o.t += dt;
      if (o.kind === 'start') {
        o.y = o.baseY + Math.sin(o.t * 2) * this.unit * 0.25;
        o.rot = Math.sin(o.t * 1.3) * 0.12;
        continue;
      }
      o.x += o.vx * dt;
      o.y += o.vy * dt;
      o.rot += o.spin * dt;
      if (o.x < o.r || o.x > this.w - o.r) o.vx *= -1;
      if (o.y - o.r > this.h) {
        this.objects.splice(i, 1);
        if (o.kind === 'bauble') {
          this.popups.push({ x: o.x, y: this.h - this.unit * 1.2, text: '✕', color: '#ff5a6a', life: 1 });
          this.#loseLife();
        }
      }
    }

    const g = this.h * 1.6;
    for (let i = this.halves.length - 1; i >= 0; i--) {
      const p = this.halves[i];
      p.vy += g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.spin * dt;
      p.life -= dt;
      if (p.life <= 0 || p.y - p.r > this.h) this.halves.splice(i, 1);
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vy += g * 0.5 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      p.life -= dt * 1.6;
      if (p.life <= 0) this.particles.splice(i, 1);
    }
    for (let i = this.popups.length - 1; i >= 0; i--) {
      const p = this.popups[i];
      p.y -= this.unit * 1.2 * dt;
      p.life -= dt * 1.3;
      if (p.life <= 0) this.popups.splice(i, 1);
    }
  }

  /** Test a blade segment against everything on screen. */
  slice(seg) {
    if (!seg || !seg.hot) return;
    const angle = Math.atan2(seg.y2 - seg.y1, seg.x2 - seg.x1);
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const o = this.objects[i];
      if (distToSegment(o.x, o.y, seg) > o.r * 1.1) continue;
      this.objects.splice(i, 1);
      if (o.kind === 'bomb') {
        this.flash = 1;
        this.shake = 1;
        this.#burst(o.x, o.y, '#ff8a3c', 26);
        this.#burst(o.x, o.y, '#333', 14);
        this.popups.push({ x: o.x, y: o.y, text: 'BOOM', color: '#ff8a3c', life: 1 });
        this.#loseLife();
      } else {
        this.#split(o, angle);
        this.#burst(o.x, o.y, o.color[0], 12);
        if (o.kind === 'start') { this.start(); return; }
        this.score++;
        this.cb.onScore(this.score);
        this.popups.push({ x: o.x, y: o.y - o.r, text: '+1', color: '#fff', life: 1 });
      }
    }
  }

  #split(o, angle) {
    const nx = -Math.sin(angle), ny = Math.cos(angle);
    const push = this.h * 0.22;
    for (const side of [1, -1]) {
      this.halves.push({
        x: o.x, y: o.y, r: o.r, color: o.color, angle, side,
        vx: o.vx + nx * push * side + Math.cos(angle) * push * 0.4,
        vy: ny * push * side - this.h * 0.25,
        rot: 0, spin: side * (2 + Math.random() * 3), life: 1.6,
      });
    }
  }

  #burst(x, y, color, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = this.h * (0.1 + Math.random() * 0.5);
      this.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - this.h * 0.1,
        r: this.unit * (0.06 + Math.random() * 0.1), color, life: 1,
      });
    }
  }

  draw(ctx, now) {
    for (const o of this.objects) {
      ctx.save();
      ctx.translate(o.x, o.y);
      ctx.rotate(o.rot);
      if (o.kind === 'bomb') drawBomb(ctx, o.r, now);
      else drawBauble(ctx, o.r, o.color, o.kind === 'start' ? 'PLAY' : null);
      ctx.restore();
    }
    for (const p of this.halves) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, p.life * 2);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle + p.rot);
      ctx.beginPath();
      ctx.rect(-p.r * 1.6, p.side > 0 ? 0 : -p.r * 1.6, p.r * 3.2, p.r * 1.6);
      ctx.clip();
      ctx.rotate(-p.angle);
      drawBauble(ctx, p.r, p.color, null);
      ctx.restore();
    }
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `800 ${this.unit * 0.8}px Nunito, system-ui, sans-serif`;
    for (const p of this.popups) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.lineWidth = this.unit * 0.12;
      ctx.strokeStyle = 'rgba(8,18,38,.7)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = p.color;
      ctx.fillText(p.text, p.x, p.y);
    }
    ctx.globalAlpha = 1;
  }
}

function distToSegment(px, py, s) {
  const dx = s.x2 - s.x1, dy = s.y2 - s.y1;
  const len2 = dx * dx + dy * dy;
  let t = len2 ? ((px - s.x1) * dx + (py - s.y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (s.x1 + dx * t), py - (s.y1 + dy * t));
}

function drawBauble(ctx, r, [light, mid, dark], label) {
  // Cap and hook
  ctx.fillStyle = '#f6c453';
  ctx.fillRect(-r * 0.2, -r * 1.2, r * 0.4, r * 0.3);
  ctx.strokeStyle = '#f6c453';
  ctx.lineWidth = r * 0.07;
  ctx.beginPath();
  ctx.arc(0, -r * 1.28, r * 0.13, 0, Math.PI * 2);
  ctx.stroke();

  // Body
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, light);
  g.addColorStop(0.55, mid);
  g.addColorStop(1, dark);
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  if (label) {
    ctx.fillStyle = '#7a1420';
    ctx.font = `800 ${r * 0.5}px Nunito, system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, 0, r * 0.04);
  } else {
    // Decorative band
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.55)';
    ctx.lineWidth = r * 0.09;
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.9, r * 1.3, r * 1.05, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.ellipse(0, -r * 0.6, r * 1.3, r * 1.05, 0, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    ctx.restore();
  }

  // Shine
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.42, -r * 0.48, r * 0.2, r * 0.11, -0.7, 0, Math.PI * 2);
  ctx.fill();
}

function drawBomb(ctx, r, now) {
  const pulse = 0.5 + 0.5 * Math.sin(now / 110);
  // Warning glow
  const glow = ctx.createRadialGradient(0, 0, r * 0.8, 0, 0, r * 1.9);
  glow.addColorStop(0, `rgba(255,70,40,${0.35 + pulse * 0.3})`);
  glow.addColorStop(1, 'rgba(255,70,40,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(0, 0, r * 1.9, 0, Math.PI * 2);
  ctx.fill();

  // Body
  const g = ctx.createRadialGradient(-r * 0.35, -r * 0.4, r * 0.1, 0, 0, r);
  g.addColorStop(0, '#5a5f6b');
  g.addColorStop(0.5, '#23262e');
  g.addColorStop(1, '#08090c');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = r * 0.09;
  ctx.strokeStyle = '#ff5a3c';
  ctx.stroke();

  // Skull-ish warning mark
  ctx.strokeStyle = '#ff5a3c';
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-r * 0.32, -r * 0.32); ctx.lineTo(r * 0.32, r * 0.32);
  ctx.moveTo(r * 0.32, -r * 0.32); ctx.lineTo(-r * 0.32, r * 0.32);
  ctx.stroke();

  // Fuse
  ctx.fillStyle = '#3a3d46';
  ctx.fillRect(-r * 0.18, -r * 1.15, r * 0.36, r * 0.25);
  ctx.strokeStyle = '#c9a36a';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.moveTo(0, -r * 1.15);
  ctx.quadraticCurveTo(r * 0.1, -r * 1.5, r * 0.4, -r * 1.5);
  ctx.stroke();
  // Spark
  ctx.fillStyle = pulse > 0.5 ? '#fff3b0' : '#ffb03c';
  ctx.beginPath();
  ctx.arc(r * 0.42, -r * 1.5, r * (0.12 + pulse * 0.1), 0, Math.PI * 2);
  ctx.fill();
}
