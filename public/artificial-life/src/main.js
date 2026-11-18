// One canvas, one requestAnimationFrame loop, one live system. Switching
// specimens disposes the old one's buffers before the new one allocates.
import { catalogue, instantiate } from './systems/index.js';
import { createUI } from './ui.js';

const FIXED = 1 / 60;   // simulation tick
const MAX_CATCHUP = 3;  // ticks per frame before we stop trying to catch up
const BUDGET_MS = 28;   // simulation wall clock per displayed frame
const MAX_DPR = 2;

const canvas = document.getElementById('plate');
const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });

let sys = null;
let index = -1;
let paused = false;
let singleStep = false;
let speed = 1;
let acc = 0;
let prevTime = 0;
let ticks = 0;
let fpsEma = 0;
let msEma = 0;
let uiClock = 0;
let uiHidden = false;
let resizeTimer = 0;

const ui = createUI({
  catalogue,
  speed,
  onSelect: (i) => switchTo(i),
  onPreset: (i) => {
    sys.applyPreset(i);
    ui.setPreset(i);
    ui.syncDials();
    ticks = 0;
    settle();
  },
  onSpeed: (v) => { speed = Math.max(1, Math.round(v)); },
  onPause: () => { paused = !paused; },
  onMatrix: () => { if (paused) draw(); },
});

// ---------- sizing ------------------------------------------------------

function sizeCanvas() {
  const dpr = Math.min(MAX_DPR, window.devicePixelRatio || 1);
  const w = Math.max(2, Math.round(window.innerWidth * dpr));
  const h = Math.max(2, Math.round(window.innerHeight * dpr));
  if (canvas.width === w && canvas.height === h) return false;
  canvas.width = w;
  canvas.height = h;
  return true;
}

function onResize() {
  const changed = sizeCanvas();
  ui.layoutTrace();
  if (!changed) return;
  // Reallocating a trail map or a particle world is expensive; the systems
  // letterbox or stretch happily in the meantime.
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    if (sys && sys.resize) sys.resize(canvas.width, canvas.height);
    if (paused) draw();
  }, 160);
  if (paused) draw();
}

window.addEventListener('resize', onResize);

// A resolution query only fires when it stops matching, so re-arm it for the
// new ratio each time: this is what catches a drag onto a second display.
function watchPixelRatio() {
  const mq = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
  mq.addEventListener('change', () => { onResize(); watchPixelRatio(); }, { once: true });
}
watchPixelRatio();

// ---------- specimen switching -----------------------------------------

function crossfade() {
  for (const old of document.querySelectorAll('.fade')) old.remove();
  const snap = document.createElement('canvas');
  snap.className = 'fade';
  snap.width = canvas.width;
  snap.height = canvas.height;
  snap.getContext('2d', { alpha: false }).drawImage(canvas, 0, 0);
  document.body.appendChild(snap);
  requestAnimationFrame(() => {
    snap.classList.add('fade--out');
    setTimeout(() => snap.remove(), 700);
  });
}

function switchTo(i, fade = true) {
  if (i === index || i < 0 || i >= catalogue.length) return;
  if (sys && fade) crossfade();
  if (sys) {
    sys.dispose();
    sys = null;
  }
  index = i;
  sys = instantiate(i);
  sys.init(canvas.width, canvas.height);
  document.documentElement.style.setProperty('--accent', sys.accent);
  document.title = `Specimen Cabinet — Plate ${sys.plate} · ${sys.latin}`;
  ticks = 0;
  acc = 0;
  msEma = 0;
  ui.bind(sys, i);
  settle();
}

// One tick after any reseed. Metrics and, for the Primordial Particle System,
// the neighbour colouring are products of a step: without this a freshly
// seeded plate would read zero until the next frame, and would read zero
// indefinitely while held.
function settle() {
  if (!sys) return;
  sys.step(FIXED);
  ticks++;
  acc = 0;
  draw();
  ui.readout({ fps: fpsEma, ms: msEma, metric: sys.metric(), ticks, paused, accent: sys.accent });
  uiClock = 0;
}

// ---------- pointer: seed / perturb ------------------------------------

let seeding = false;
let lastDialSync = 0;

function seedFrom(ev) {
  if (!sys) return;
  const rect = canvas.getBoundingClientRect();
  const x = (ev.clientX - rect.left) * (canvas.width / rect.width);
  const y = (ev.clientY - rect.top) * (canvas.height / rect.height);
  const p = sys.mapPointer(x, y, canvas.width, canvas.height);
  sys.seed(p.x, p.y, 1);
  // Seeding can move a dial (the PPS density follows its population), but not
  // often enough to justify repainting the instruments on every pointermove.
  const now = performance.now();
  if (now - lastDialSync > 120) {
    lastDialSync = now;
    ui.syncDials();
  }
  if (paused) draw();
}

canvas.addEventListener('pointerdown', (ev) => {
  seeding = true;
  canvas.setPointerCapture(ev.pointerId);
  seedFrom(ev);
});
canvas.addEventListener('pointermove', (ev) => { if (seeding) seedFrom(ev); });
const stopSeeding = (ev) => {
  seeding = false;
  if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
};
canvas.addEventListener('pointerup', stopSeeding);
canvas.addEventListener('pointercancel', stopSeeding);

// ---------- keys --------------------------------------------------------

window.addEventListener('keydown', (ev) => {
  if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
  const onControl = ev.target instanceof Element && ev.target.closest('button, [role="slider"]');
  if (onControl && (ev.key === ' ' || ev.key === 'Enter')) return; // let it click

  switch (ev.key) {
    case ' ':
      paused = !paused;
      ev.preventDefault();
      break;
    case '.':
      paused = true;
      singleStep = true;
      break;
    case 'r': case 'R':
      sys.reset();
      ticks = 0;
      ui.syncDials();
      settle();
      break;
    case 'h': case 'H':
      uiHidden = !uiHidden;
      ui.setHidden(uiHidden);
      break;
    case 's': case 'S':
      savePlate();
      break;
    default:
      if (ev.key >= '1' && ev.key <= '9') switchTo(Number(ev.key) - 1);
      return;
  }
});

// ---------- save a plate ------------------------------------------------

function savePlate() {
  if (!sys) return;
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const c = out.getContext('2d', { alpha: false });
  c.drawImage(canvas, 0, 0);
  captionPlate(c, out.width, out.height);
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = sys.latin.toLowerCase().replace(/[^a-z]+/g, '-');
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plate-${sys.plate.toLowerCase()}-${slug}-${stamp}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }, 'image/png');
}

// The saved image gets the same furniture as the screen: corner marks, plate
// number, binomial, and the parameters it was actually running.
function captionPlate(c, w, h) {
  const s = Math.max(1, h / 900);
  const pad = 26 * s;
  const bone = '#e8e4d9';
  const dim = 'rgba(232,228,217,0.55)';

  c.save();
  c.globalAlpha = 0.55;
  c.fillStyle = bone;
  const m = 9 * s, t = 1 * s;
  for (const [mx, my] of [[pad, pad], [w - pad, pad], [pad, h - pad], [w - pad, h - pad]]) {
    c.fillRect(mx - t / 2, my - m, t, m * 2);
    c.fillRect(mx - m, my - t / 2, m * 2, t);
  }
  c.restore();

  const baseY = h - pad - 6 * s;
  c.textBaseline = 'alphabetic';

  c.fillStyle = dim;
  c.fillRect(pad, baseY - 46 * s, Math.min(w - pad * 2, 520 * s), t);

  c.fillStyle = bone;
  c.font = `${11 * s}px ${MONO}`;
  c.fillText(`PL. ${sys.plate}  ·  ${sys.accession}`, pad, baseY - 30 * s);

  c.font = `italic ${25 * s}px ${SERIF}`;
  c.fillText(sys.latin, pad, baseY - 6 * s);

  c.fillStyle = dim;
  c.font = `${10 * s}px ${MONO}`;
  const preset = sys.presets[sys.preset ?? 0];
  const bits = [`preset ${preset ? preset.name : '—'}`, `tick ${ticks}`];
  for (const d of sys.params) bits.push(`${d.key} ${trim(d.value)}`);
  let line = bits.join('   ');
  while (c.measureText(line).width > w - pad * 2 && bits.length > 2) {
    bits.pop();
    line = bits.join('   ') + '   …';
  }
  c.fillText(line, pad, baseY + 12 * s);
}

const MONO = 'ui-monospace, "SF Mono", Menlo, monospace';
const SERIF = '"Hoefler Text", "Iowan Old Style", Baskerville, Georgia, serif';

function trim(v) {
  if (Number.isInteger(v)) return String(v);
  return String(Math.round(v * 10000) / 10000);
}

// ---------- loop --------------------------------------------------------

function draw() {
  if (sys) sys.render(ctx);
}

function frame(now) {
  requestAnimationFrame(frame);
  if (!sys) return;

  // clamp both ways: a backwards or absurd timestamp must not stall the
  // accumulator or blow the catch-up budget
  const dt = prevTime ? Math.max(0, Math.min(0.25, (now - prevTime) / 1000)) : FIXED;
  prevTime = now;
  const inst = 1 / Math.max(1e-4, dt);
  fpsEma = fpsEma ? fpsEma + (inst - fpsEma) * 0.08 : inst;

  let stepped = 0;
  const t0 = performance.now();
  if (paused) {
    if (singleStep) {
      sys.step(FIXED);
      ticks++;
      stepped = 1;
      singleStep = false;
    }
    acc = 0;
  } else {
    acc += dt;
    let iter = 0;
    let spent = false;
    while (acc >= FIXED && iter < MAX_CATCHUP && !spent) {
      for (let k = 0; k < speed; k++) {
        sys.step(FIXED);
        ticks++;
        stepped++;
        // Cranking the substep dial on an expensive system must cost frame
        // rate, not responsiveness: abandon the rest of this frame's work.
        if (performance.now() - t0 > BUDGET_MS) { spent = true; break; }
      }
      acc -= FIXED;
      iter++;
    }
    if (spent || acc > FIXED * MAX_CATCHUP) acc = 0; // drop the debt
  }
  if (stepped) {
    const per = (performance.now() - t0) / stepped;
    msEma = msEma ? msEma + (per - msEma) * 0.12 : per;
  }

  draw();

  uiClock += dt;
  if (uiClock >= 0.1) {
    uiClock = 0;
    ui.readout({
      fps: fpsEma,
      ms: msEma,
      metric: sys.metric(),
      ticks,
      paused,
      accent: sys.accent,
    });
  }
}

// ---------- go ----------------------------------------------------------

sizeCanvas();
switchTo(0, false);
ui.layoutTrace();
requestAnimationFrame(frame);
