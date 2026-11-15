// Hand trails. Every tracked hand leaves a faint ribbon that fades after
// about a second. Only fast swings ("chops") become a hot blade that can cut.

const TRAIL_LIFE = 1000;      // ms a trail point stays visible
const CHOP_ON = 1.1;          // screen-heights per second to start a chop
const CHOP_OFF = 0.55;        // ...and the speed below which it ends
const GAP_RESET = 250;        // ms without a sample before the trail breaks
const SMOOTH = 0.65;          // position smoothing (1 = raw)

export class Blade {
  constructor() {
    this.hands = new Map();
  }

  reset(id) {
    if (id === undefined) this.hands.clear();
    else this.hands.delete(id);
  }

  /**
   * Feed a new hand position (canvas px). Returns the segment travelled since
   * the previous sample and whether it counts as a chop, or null.
   */
  addSample(id, x, y, now, screenH) {
    let h = this.hands.get(id);
    if (!h || now - h.t > GAP_RESET) {
      h = { x, y, t: now, speed: 0, hot: false, points: h ? h.points : [] };
      h.points.push({ x, y, t: now, hot: false, start: true });
      this.hands.set(id, h);
      return null;
    }
    const dt = (now - h.t) / 1000;
    if (dt <= 0) return null;
    const nx = h.x + (x - h.x) * SMOOTH;
    const ny = h.y + (y - h.y) * SMOOTH;
    const inst = Math.hypot(nx - h.x, ny - h.y) / dt / screenH;
    h.speed = h.speed * 0.4 + inst * 0.6;
    h.hot = h.hot ? h.speed > CHOP_OFF : h.speed > CHOP_ON;
    const seg = { x1: h.x, y1: h.y, x2: nx, y2: ny, hot: h.hot };
    h.x = nx; h.y = ny; h.t = now;
    h.points.push({ x: nx, y: ny, t: now, hot: h.hot });
    return seg;
  }

  draw(ctx, now, unit) {
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const [id, h] of this.hands) {
      const pts = h.points;
      while (pts.length && now - pts[0].t > TRAIL_LIFE) pts.shift();
      if (!pts.length && now - h.t > GAP_RESET) { this.hands.delete(id); continue; }

      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        if (b.start) continue;
        const life = 1 - (now - b.t) / TRAIL_LIFE;
        if (life <= 0) continue;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        if (b.hot) {
          ctx.strokeStyle = `rgba(246,196,83,${0.45 * life})`;
          ctx.lineWidth = unit * 0.55 * life + 2;
          ctx.stroke();
          ctx.strokeStyle = `rgba(255,255,255,${life})`;
          ctx.lineWidth = unit * 0.2 * life + 1;
          ctx.stroke();
        } else {
          ctx.strokeStyle = `rgba(200,230,255,${0.4 * life})`;
          ctx.lineWidth = unit * 0.08 + 1;
          ctx.stroke();
        }
      }

      // Hand cursor so players can see where they are tracked
      if (now - h.t < GAP_RESET) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, unit * (h.hot ? 0.22 : 0.15), 0, Math.PI * 2);
        ctx.fillStyle = h.hot ? '#fff' : 'rgba(255,255,255,.55)';
        ctx.fill();
        ctx.lineWidth = Math.max(2, unit * 0.05);
        ctx.strokeStyle = h.hot ? '#f6c453' : 'rgba(200,230,255,.7)';
        ctx.stroke();
      }
    }
  }
}
