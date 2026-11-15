import { Vision } from './vision.js';
import { Scene } from './scene.js';
import { Blade } from './blade.js';
import { Game, MAX_LIVES } from './game.js';

const $ = (id) => document.getElementById(id);
const canvas = $('stage');
const ctx = canvas.getContext('2d');
const video = $('cam');

const screens = ['intro', 'loading', 'error', 'ready', 'over'];
function show(name) {
  for (const s of screens) $('screen-' + s).hidden = s !== name;
}

const vision = new Vision(video);
const scene = new Scene();
const blade = new Blade();
const game = new Game({
  onScore: (n) => { $('score').textContent = n; },
  onLives: (n) => {
    [...$('lives').children].forEach((el, i) => el.classList.toggle('lost', i >= n));
  },
  onStart: () => { show(null); $('hud').hidden = false; },
  onGameOver: (score) => { $('final-score').textContent = score; show('over'); },
});

let W = 0, H = 0, dpr = 1;
let cameraOn = false;

function resize() {
  dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  W = canvas.width = Math.round(window.innerWidth * dpr);
  H = canvas.height = Math.round(window.innerHeight * dpr);
  scene.resize(W, H);
  game.resize(W, H);
  if (game.mode === 'menu') game.showMenu();
}
window.addEventListener('resize', resize);
resize();

// Where the (mirrored, cover-fitted) video lands on the canvas.
function videoRect() {
  const vw = video.videoWidth || 640, vh = video.videoHeight || 480;
  const s = Math.max(W / vw, H / vh);
  const dw = vw * s, dh = vh * s;
  return { x: (W - dw) / 2, y: (H - dh) / 2, w: dw, h: dh };
}

async function enableCamera() {
  show('loading');
  try {
    $('loading-text').textContent = 'Waiting for your camera…';
    await vision.startCamera();
    $('loading-text').textContent = 'Waking up the elves…';
    await vision.loadModel();
    cameraOn = true;
    ready();
  } catch (err) {
    console.error(err);
    $('error-text').textContent = err && err.name === 'NotAllowedError'
      ? 'Allow camera access in your browser, then try again.'
      : 'Something went wrong starting the camera or the tracking model. Check your connection and try again.';
    show('error');
  }
}

function ready() {
  show('ready');
  game.showMenu();
}

$('btn-camera').addEventListener('click', enableCamera);
$('btn-retry').addEventListener('click', enableCamera);
$('btn-mouse').addEventListener('click', ready);

// Mouse / touch also works as a blade (handy fallback and for testing).
let pointerDown = false;
canvas.addEventListener('pointerdown', (e) => { pointerDown = true; pointerSample(e); });
window.addEventListener('pointerup', () => { pointerDown = false; blade.reset('pointer'); });
canvas.addEventListener('pointermove', (e) => { if (pointerDown) pointerSample(e); });
function pointerSample(e) {
  game.slice(blade.addSample('pointer', e.clientX * dpr, e.clientY * dpr, e.timeStamp, H));
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (cameraOn && vision.update(now)) {
    const r = videoRect();
    for (const side of ['left', 'right']) {
      const p = vision.hands[side];
      if (!p) continue;
      const x = r.x + (1 - p.x) * r.w; // mirror
      const y = r.y + p.y * r.h;
      game.slice(blade.addSample(side, x, y, now, H));
    }
  }
  $('hint').hidden = !(cameraOn && now - vision.lastSeen > 1500);

  game.update(dt);

  ctx.save();
  if (game.shake > 0) {
    const s = game.shake * game.unit * 0.5;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  scene.draw(ctx);
  scene.drawSnow(ctx, now / 1000, dt);

  if (cameraOn && now - vision.lastSeen < 400) {
    const r = videoRect();
    ctx.save();
    ctx.translate(W, 0);
    ctx.scale(-1, 1);
    ctx.shadowColor = 'rgba(190,225,255,.7)';
    ctx.shadowBlur = 18 * dpr;
    ctx.drawImage(vision.personCanvas, r.x, r.y, r.w, r.h);
    ctx.restore();
  }

  game.draw(ctx, now);
  blade.draw(ctx, now, game.unit);
  ctx.restore();

  if (game.flash > 0) {
    ctx.fillStyle = `rgba(255,60,40,${game.flash * 0.45})`;
    ctx.fillRect(0, 0, W, H);
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// Debug handle for automated tests
window.__game = { game, blade, vision, MAX_LIVES };
