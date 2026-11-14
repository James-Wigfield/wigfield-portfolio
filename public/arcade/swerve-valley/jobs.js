/* ============================================================================
   SWERVE VALLEY — passenger jobs (the back of the bus)
   ----------------------------------------------------------------------------
   Every passenger's phone, during a drive, is a little WarioWare cabinet: the
   server deals out 3–5 second jobs (catch the bottle, sit Doug down, cure the
   hiccups, save the hat, pass the cheese, sing along) plus group moments for
   the whole bus (lean into the bend, smile for the photo). Fumble one and the
   bus lurches under the driver.

     createJobs(root, api) -> { update(view), destroy() }

   What the panel shows, in priority order:
     1. a live GROUP job (lean / photo) I haven't answered
     2. my own job (dealt to me, or an NPC's trouble I claimed), incl. 'wake'
     3. claim cards for NPC trouble nobody has taken yet
     4. idle — "All quiet back here"

   Each job is answered exactly once with {t:'job', id, ok, q}. The server is
   the authority on what that answer is worth; this file only judges the
   local skill (did you tap the bottle) — see the arcade vault note.

   My own tipsiness changes how this panel behaves: tier 1 sways, tier 2 adds a
   double-vision ghost that does nothing when tapped, tier 3 mirrors the
   controls on one job in three ("your brain is lying").
   ========================================================================== */

import { JOBS, CAST_BY_ID, TIERS, tier as tierOf } from './world.js';

const INK = '#2a1020';
const WINE = '#7a1f3d';
const CREAM = '#f6ecd2';
const BEAT_MS = 750;
const CLAIM_MS = 2600; //   mirrors the server: an NPC's trouble waits this long
const SEND_EARLY = 260; //  group answers go in before the window shuts
const GOT_IT_MS = 1300; //  how long "Kelly's got it" lingers

const REDUCED =
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const CSS = `
.svj-root { position: relative; overflow: hidden; }
.svj {
  position: absolute; inset: 0;
  font-family: var(--ar-mono, ui-monospace, monospace);
  color: ${INK};
  user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
  touch-action: none;
}
.svj-panel {
  position: absolute; left: 8px; right: 8px; top: 8px; bottom: 12px;
  background: ${CREAM};
  border: 3px solid ${INK};
  box-shadow: 0 4px 0 ${INK};
  display: flex; flex-direction: column;
  overflow: hidden;
}
.svj-panel--dark { background: #171026; color: #d9d2f2; }
.svj-panel--dark .svj-title { color: #b9a8ff; }
.svj-panel--dark .svj-hint { color: #8d84b0; }
.svj-panel--dark .svj-timer { background: #2a2140; }
.svj-panel--dark .svj-timer > i { background: #b9a8ff; }
.svj-head { padding: 10px 12px 7px; border-bottom: 2px dashed rgba(122,31,61,.3); }
.svj-panel--dark .svj-head { border-bottom-color: rgba(185,168,255,.25); }
.svj-title {
  font-family: var(--ar-display, monospace);
  font-size: 15px; line-height: 1.35; color: ${WINE};
  letter-spacing: .02em;
}
.svj-title--big { font-size: 19px; }
.svj-hint { font-size: 12px; line-height: 1.35; color: #5a3a40; margin-top: 5px; }
.svj-hint b { color: ${WINE}; }
.svj-lie { color: #b0306a; font-style: italic; }
.svj-timer { height: 7px; background: #e6d6b0; flex: 0 0 auto; }
.svj-timer > i { display: block; height: 100%; background: ${WINE}; transform-origin: left center; }
.svj-stage { position: relative; flex: 1; min-height: 0; overflow: hidden; touch-action: none; }
.svj-px { image-rendering: pixelated; image-rendering: crisp-edges; display: block; }
.svj-abs { position: absolute; left: 0; top: 0; will-change: transform; }
.svj-hit {
  appearance: none; background: none; border: 0; padding: 12px; margin: 0;
  cursor: pointer; touch-action: none; -webkit-tap-highlight-color: transparent;
}
.svj-ghost { opacity: .38; filter: saturate(.6); }
.svj-real { opacity: .92; }
.svj-floor {
  position: absolute; left: 0; right: 0; bottom: 0; height: 30%;
  background: repeating-linear-gradient(90deg, #d8c597 0 18px, #cfba88 18px 36px);
  border-top: 3px solid #a98c58;
}
.svj-btn {
  appearance: none; font-family: var(--ar-display, monospace);
  font-size: 14px; letter-spacing: .04em;
  color: ${CREAM}; background: ${WINE};
  border: 3px solid ${INK}; box-shadow: 0 4px 0 ${INK};
  padding: 0 14px; min-height: 58px; cursor: pointer;
  touch-action: none; -webkit-tap-highlight-color: transparent;
}
.svj-btn:active, .svj-btn[data-down="1"] { transform: translateY(3px); box-shadow: 0 1px 0 ${INK}; }
.svj-btn[disabled] { opacity: .55; }
.svj-btn--gold { background: #e9b440; color: ${INK}; }
.svj-meter {
  position: absolute; background: #e6d6b0; border: 3px solid ${INK};
  box-shadow: 0 3px 0 ${INK}; overflow: hidden;
}
.svj-meter > i { position: absolute; left: 0; bottom: 0; background: ${WINE}; }
.svj-band { position: absolute; left: 0; right: 0; background: rgba(63,174,90,.55); border-top: 2px solid #2e7d46; border-bottom: 2px solid #2e7d46; }
.svj-seat {
  position: absolute; width: 124px; height: 46px; background: ${WINE};
  border: 3px solid ${INK}; border-bottom: 0;
  box-shadow: inset 0 6px 0 #a8324f;
}
.svj-port { border: 3px solid ${INK}; background: #fff3d6; box-shadow: 0 3px 0 ${INK}; }
.svj-seats { position: absolute; left: 6px; right: 6px; top: 10px; display: flex; justify-content: space-between; }
.svj-seatcell { display: flex; flex-direction: column; align-items: center; gap: 4px; width: 19%; }
.svj-seatcell span { font-size: 10px; color: #5a3a40; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
.svj-seatcell .svj-port { padding: 2px; }
.svj-glow { animation: svj-glow .5s steps(2) infinite; }
@keyframes svj-glow { 0% { box-shadow: 0 0 0 3px #ffcf5a, 0 3px 0 ${INK}; } 100% { box-shadow: 0 0 0 6px #ffcf5a, 0 3px 0 ${INK}; } }
.svj-big { font-family: var(--ar-display, monospace); }
.svj-halves { position: absolute; inset: 0; display: flex; }
.svj-half {
  flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px;
  border: 0; margin: 0; padding: 0; background: #efe1bd; color: ${WINE};
  font-family: var(--ar-display, monospace); font-size: 13px; touch-action: none;
}
.svj-half + .svj-half { border-left: 3px dashed rgba(42,16,32,.35); }
.svj-half[data-on="1"] { background: #e9b440; color: ${INK}; }
.svj-arrow { font-size: 38px; line-height: 1; }
.svj-pct {
  position: absolute; left: 50%; top: 10px; transform: translateX(-50%);
  font-family: var(--ar-display, monospace); font-size: 13px;
  background: ${CREAM}; border: 3px solid ${INK}; padding: 6px 8px; pointer-events: none;
}
.svj-flash { position: absolute; inset: 0; background: #fff; opacity: 0; pointer-events: none; }
.svj-count { position: absolute; left: 0; right: 0; text-align: center; font-family: var(--ar-display, monospace); font-size: 26px; color: ${WINE}; pointer-events: none; }
.svj-line { position: absolute; left: 0; right: 0; height: 4px; background: ${WINE}; }
.svj-lyric { position: absolute; left: 10px; right: 10px; text-align: center; font-size: 12px; color: #5a3a40; font-style: italic; pointer-events: none; }
.svj-zzz { position: absolute; font-family: var(--ar-display, monospace); color: #b9a8ff; pointer-events: none; }
.svj-wind { position: absolute; height: 3px; background: rgba(122,31,61,.25); pointer-events: none; }
.svj-hicpop { position: absolute; font-family: var(--ar-display, monospace); font-size: 16px; color: #c0392b; pointer-events: none; }

.svj-beat {
  position: absolute; inset: 8px 8px 12px; display: flex; flex-direction: column;
  align-items: center; justify-content: center; gap: 12px; pointer-events: none;
  background: rgba(246,236,210,.94); border: 3px solid ${INK};
}
.svj-beat b {
  font-family: var(--ar-display, monospace); font-size: 44px; line-height: 1;
  animation: svj-stamp .28s steps(4) both;
}
.svj-beat span { font-family: var(--ar-display, monospace); font-size: 14px; text-align: center; padding: 0 16px; line-height: 1.4; }
.svj-beat[data-ok="1"] b, .svj-beat[data-ok="1"] span { color: #2e7d46; }
.svj-beat[data-ok="0"] b, .svj-beat[data-ok="0"] span { color: #c0392b; }
@keyframes svj-stamp { 0% { transform: scale(2.2); opacity: 0; } 100% { transform: scale(1); opacity: 1; } }

.svj-idle { display: flex; flex-direction: column; }
.svj-idle canvas { flex: 1; min-height: 0; width: 100%; }
.svj-cards { display: flex; flex-direction: column; gap: 12px; padding: 10px 10px 6px; flex: 1; min-height: 0; overflow: hidden; }
.svj-card {
  display: grid; grid-template-columns: 74px 1fr; grid-template-rows: auto auto auto; gap: 6px 10px; align-items: center;
  background: #fff6df; border: 3px solid ${INK}; box-shadow: 0 4px 0 ${INK}; padding: 8px;
}
.svj-card .svj-port { grid-row: 1 / span 2; padding: 2px; }
.svj-card .svj-port canvas { width: 64px; height: 64px; }
.svj-card p { margin: 0; font-family: var(--ar-display, monospace); font-size: 11px; line-height: 1.4; color: ${WINE}; align-self: center; }
.svj-card .svj-btn { grid-column: 2; min-height: 46px; font-size: 12px; padding: 0 8px; }
.svj-card .svj-timer { grid-column: 1 / span 2; }
.svj-card--taken { opacity: .7; }
.svj-card--taken p { color: #2e7d46; }
.svj-cardshead { font-family: var(--ar-display, monospace); font-size: 12px; color: ${WINE}; padding: 12px 12px 0; }
`;

// ── Pixel sprites ────────────────────────────────────────────────────────────

function px(w, h, scale, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g);
  c.className = 'svj-px';
  c.style.width = `${w * scale}px`;
  c.style.height = `${h * scale}px`;
  return c;
}

function fromRows(rows, pal, scale) {
  const w = Math.max(...rows.map((r) => r.length));
  return px(w, rows.length, scale, (g) => {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        g.fillStyle = pal[ch];
        g.fillRect(x, y, 1, 1);
      }
    });
  });
}

function rect(g, c, x, y, w, h) {
  g.fillStyle = c;
  g.fillRect(x, y, w, h);
}

// A wine bottle lying on its side, base on the left.
function bottleSprite(scale) {
  return px(30, 11, scale, (g) => {
    const k = INK;
    // body
    rect(g, k, 1, 1, 19, 9);
    rect(g, k, 0, 2, 1, 7);
    rect(g, '#5c1530', 1, 2, 19, 7);
    rect(g, '#7a1f3d', 1, 2, 19, 5);
    rect(g, '#b4415f', 2, 3, 16, 1); // glint
    // shoulder + neck
    rect(g, k, 20, 2, 2, 7);
    rect(g, '#7a1f3d', 20, 3, 2, 5);
    rect(g, k, 22, 3, 5, 5);
    rect(g, '#7a1f3d', 22, 4, 5, 3);
    rect(g, '#c9a227', 23, 4, 3, 3); // foil
    rect(g, k, 27, 3, 1, 5);
    rect(g, '#a8763e', 27, 4, 2, 3); // cork
    rect(g, k, 29, 4, 1, 3);
    // label
    rect(g, k, 5, 2, 9, 7);
    rect(g, CREAM, 6, 3, 7, 5);
    rect(g, '#d9c49a', 6, 7, 7, 1);
    rect(g, '#7a1f3d', 7, 4, 5, 1);
    rect(g, '#7a1f3d', 8, 6, 3, 1);
  });
}

function platterSprite(scale) {
  return px(32, 14, scale, (g) => {
    rect(g, INK, 1, 3, 30, 10);
    rect(g, INK, 0, 4, 32, 8);
    rect(g, '#a0703f', 1, 4, 30, 8);
    rect(g, '#6e4a26', 1, 11, 30, 1);
    rect(g, '#c08a52', 2, 5, 27, 1);
    // cheese wedges
    rect(g, INK, 3, 1, 8, 7);
    rect(g, '#f2d16b', 4, 2, 6, 5);
    rect(g, '#ffe9a0', 4, 2, 6, 1);
    rect(g, '#e0b94a', 6, 4, 1, 1);
    rect(g, '#e0b94a', 8, 5, 1, 1);
    // brie
    rect(g, INK, 12, 3, 7, 6);
    rect(g, '#fbf4e0', 13, 4, 5, 4);
    rect(g, '#e6dcc0', 13, 7, 5, 1);
    // grapes
    for (const [x, y] of [[21, 4], [23, 4], [22, 6], [24, 6], [20, 6], [23, 8], [21, 8]]) {
      rect(g, INK, x, y, 2, 2);
      rect(g, '#7b3a8a', x, y, 2, 2);
      rect(g, '#b07bc0', x, y, 1, 1);
    }
    // crackers
    rect(g, INK, 26, 5, 5, 5);
    rect(g, '#e8c48a', 27, 6, 3, 3);
  });
}

function cameraSprite(scale) {
  return px(28, 20, scale, (g) => {
    rect(g, INK, 2, 4, 24, 15);
    rect(g, '#3a3a48', 3, 5, 22, 13);
    rect(g, '#55556a', 3, 5, 22, 2);
    rect(g, INK, 8, 1, 9, 4);
    rect(g, '#3a3a48', 9, 2, 7, 3);
    rect(g, '#e9e6d8', 20, 6, 4, 3); // flash
    rect(g, INK, 18, 1, 5, 3);
    rect(g, '#c0392b', 19, 2, 3, 1); // button
    // lens
    rect(g, INK, 8, 7, 12, 10);
    rect(g, '#1c1c28', 9, 8, 10, 8);
    rect(g, '#2d3550', 10, 9, 8, 6);
    rect(g, '#6fa8dc', 11, 10, 3, 2);
    rect(g, '#cfe3f7', 11, 10, 1, 1);
  });
}

function noteSprite(scale, colour) {
  return px(9, 13, scale, (g) => {
    rect(g, INK, 5, 0, 2, 10);
    rect(g, INK, 7, 0, 2, 2);
    rect(g, INK, 7, 2, 1, 2);
    rect(g, INK, 0, 8, 7, 5);
    rect(g, colour, 1, 9, 5, 3);
    rect(g, '#ffffff', 2, 9, 1, 1);
  });
}

const PAL_GLASSES = { k: '#1a1220', g: '#3a3550', G: '#a9c4ff' };
const GLASSES = [
  'kkkkkkkkkkkkkkkkkkkk',
  'kggggGkk....kkggggGk',
  'kgggggk......kgggggk',
  'kgggggk......kgggggk',
  '.kgggk........kgggk.',
  '..kkk..........kkk..',
];
const HAT = [
  '.......kkkkkkkk.......',
  '......khhhhhhhhk......',
  '......khhhhhhhhk......',
  '......kbbbbbbbbk......',
  '.kkkkkkhhhhhhhhkkkkkk.',
  'khhhhhhhhhhhhhhhhhhhhk',
  'kHHHHHHHHHHHHHHHHHHHHk',
  '.kkkkkkkkkkkkkkkkkkkk.',
];
const CAP = [
  '....kkkkkkk.......',
  '...khhhhhhhk......',
  '..khhhhhhhhhk.....',
  '..khhhhhhhhhk.....',
  '..kHHHHHHHHHkkkkk.',
  '..khhhhhhhhhhhhhhk',
  '...kkkkkkkkkkkkkk.',
];
const SCARF = [
  '.kkkkkkkkkkkkkkkk...',
  'kssssssssssssssssk..',
  'kSSssSSssSSssSSssk..',
  '.kkkkkkkkkkkkksssk..',
  '.............ksssk..',
  '.............kSSSk..',
  '.............ksssk..',
  '.............kkkkk..',
];
const FLOWER = [
  '...kkkkk...',
  '..kpppppk..',
  'kkkpPpPpkkk',
  'kppkyyykppk',
  'kppkyYykppk',
  'kppkyyykppk',
  'kkkpPpPpkkk',
  '..kpppppk..',
  '...kkkkk...',
  '.....g.....',
  '....ggg....',
];

function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.round(((n >> 16) & 255) * f);
  const g = Math.round(((n >> 8) & 255) * f);
  const b = Math.round((n & 255) * f);
  return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
}

function wearSprite(wear, cid, scale) {
  const col = CAST_BY_ID[cid]?.color || '#c9a227';
  const w = String(wear || '').toLowerCase();
  if (w.includes('sunnies') || w.includes('aviator') || w.includes('glasses')) {
    const pal = w.includes('aviator') ? { ...PAL_GLASSES, k: '#b8902a' } : PAL_GLASSES;
    return fromRows(GLASSES, pal, scale);
  }
  if (w.includes('scarf')) return fromRows(SCARF, { k: INK, s: col, S: shade(col, 0.72) }, scale);
  if (w.includes('flower')) {
    return fromRows(FLOWER, { k: INK, p: '#ff7ab6', P: '#ffb3d6', y: '#ffd84a', Y: '#fff4b0', g: '#3f8f4a' }, scale);
  }
  if (w.includes('cap') && !w.includes('bucket')) {
    const c = w.includes('flat') ? '#8a6a45' : '#d64545';
    return fromRows(CAP, { k: INK, h: c, H: shade(c, 0.7) }, scale);
  }
  const hatCol = w.includes('straw') ? '#e3c06a' : w.includes('sun') ? '#f07fb0' : w.includes('bucket') ? '#b9a27a' : col;
  return fromRows(HAT, { k: INK, h: hatCol, H: shade(hatCol, 0.75), b: WINE }, scale);
}

// ── Small helpers ────────────────────────────────────────────────────────────

const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);

function h(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

// Tipsy sway. Deterministic per job so every redraw agrees with itself.
function wobble(t, tr, seed) {
  if (tr < 1) return { x: 0, y: 0, r: 0 };
  const k = REDUCED ? 0.3 : 1;
  const a = (tr >= 3 ? 13 : tr >= 2 ? 9 : 5) * k;
  const s = t / 1000;
  return {
    x: Math.sin(s * 1.9 + seed) * a,
    y: Math.sin(s * 2.7 + seed * 1.3) * a * 0.6,
    r: Math.sin(s * 1.3 + seed) * tr * 2 * k,
  };
}
// mag ≈ how far apart the two images sit. Big targets need a big split or the
// real one (drawn on top) swallows every tap aimed at the ghost.
function ghostOffset(t, seed, mag = 18) {
  const s = t / 1000;
  const k = REDUCED ? 0.6 : 1;
  return { x: (mag + Math.sin(s * 2.3 + seed) * 8) * k, y: (mag * 0.25 + Math.cos(s * 1.7 + seed) * 4) * k };
}

function possessive(name) {
  return /s$/i.test(name) ? `${name}’` : `${name}’s`;
}

const LYRICS = [
  '♪ Ohhh the wine is fine, the bus is mine ♪',
  '♪ La la la-la LAAA, pass the rosé ♪',
  '♪ We’re all on the bus, the bus, the BUS ♪',
  '♪ Shiraz, Shiraz, wherefore art thou Shiraz ♪',
  '♪ Ninety-nine bottles of Cab Sav on the wall ♪',
  '♪ Doo-wop, doo-wop, grapes go stomp ♪',
];

// Success / failure stamp copy per job.
const BEAT = {
  bottle: ['Caught it!', 'SMASH!'],
  sitdown: ['Sit DOWN, {n}', '{n} went flying!'],
  hiccup: ['Cured!', 'HIC!'],
  hat: ['Saved it!', 'Gone with the wind'],
  platter: ['Cheese delivered', 'Cheese on the floor'],
  sing: ['Encore!', 'Off-key!'],
  lean: ['Nailed the bend!', 'Two wheels!'],
  photo: ['Say cheese!', 'Blinked!'],
  wake: ['Awake!', 'zzz…'],
};

// ── The micro-games ──────────────────────────────────────────────────────────
// Each factory takes ctx and returns { el, frame(now), destroy() }. It calls
// ctx.finish(ok, q, text?) exactly when the player has succeeded or failed;
// the controller sends the answer and shows the stamp.

function shell(ctx, title, hint, opts = {}) {
  const panel = h('div', `svj-panel${opts.dark ? ' svj-panel--dark' : ''}`);
  const head = h('div', 'svj-head');
  const t = h('div', `svj-title${opts.big ? ' svj-title--big' : ''}`, title);
  const hi = h('div', 'svj-hint');
  hi.textContent = hint;
  if (ctx.mirrored && opts.lie) {
    const lie = h('span', 'svj-lie', ' (your brain is lying)');
    hi.appendChild(lie);
  }
  head.append(t, hi);
  const timer = h('div', 'svj-timer');
  const fill = h('i');
  timer.appendChild(fill);
  const stage = h('div', 'svj-stage');
  panel.append(head, timer, stage);
  return {
    panel,
    stage,
    title: t,
    hint: hi,
    tick(now, until) {
      const end = until ?? ctx.deadline();
      const total = Math.max(1, end - ctx.start);
      const f = clamp((end - now) / total, 0, 1);
      fill.style.transform = `scaleX(${f})`;
    },
  };
}

function tapHandler(el, fn) {
  const on = (e) => {
    e.preventDefault();
    e.stopPropagation();
    fn(e);
  };
  el.addEventListener('pointerdown', on);
  return () => el.removeEventListener('pointerdown', on);
}

// 1 · BOTTLE — tap the rolling bottle before it smashes.
function gBottle(ctx) {
  const v = shell(ctx, 'Bottle loose!', 'Tap the rolling bottle before it hits the side');
  const floor = h('div', 'svj-floor');
  v.stage.appendChild(floor);
  const fromLeft = ctx.job.r % 2 === 0;
  const make = (ghost) => {
    const b = h('button', `svj-hit svj-abs ${ghost ? 'svj-ghost' : 'svj-real'}`);
    b.type = 'button';
    b.setAttribute('aria-label', ghost ? 'a blurry bottle' : 'the bottle');
    const spr = bottleSprite(4);
    if (!fromLeft) spr.style.transform = 'scaleX(-1)';
    b.appendChild(spr);
    return b;
  };
  const real = make(false);
  const ghost = ctx.tier >= 2 ? make(true) : null;
  if (ghost) v.stage.appendChild(ghost);
  v.stage.appendChild(real);
  let done = false;
  let p = 0;
  const offs = [
    tapHandler(real, () => {
      if (done) return;
      done = true;
      ctx.api.sfx('clink');
      ctx.finish(true, clamp(1 - p, 0.1, 1));
    }),
  ];
  if (ghost) {
    offs.push(
      tapHandler(ghost, () => {
        ctx.api.sfx('whoosh');
        ctx.api.haptic(15);
      }),
    );
  }
  const BW = 30 * 4 + 24;
  const BH = 11 * 4 + 24;
  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const travel = Math.max(800, (ctx.deadline() - ctx.start) * 0.86);
      p = clamp((now - ctx.start) / travel, 0, 1);
      const e = Math.pow(p, 1.45);
      const x0 = 2;
      const x1 = W - BW - 2;
      const x = fromLeft ? x0 + (x1 - x0) * e : x1 - (x1 - x0) * e;
      const bounce = -Math.abs(Math.sin(p * Math.PI * 4)) * 12 * (1 - p * 0.5);
      const w = wobble(now, ctx.tier, ctx.seed);
      const y = H * 0.7 - BH + bounce + w.y;
      real.style.transform = `translate(${x + w.x}px, ${y}px) rotate(${w.r}deg)`;
      if (ghost) {
        const g = ghostOffset(now, ctx.seed, 78);
        const gx = x + w.x + (fromLeft ? g.x : -g.x);
        ghost.style.transform = `translate(${gx}px, ${y - g.y}px) rotate(${-w.r}deg)`;
      }
      if (p >= 1 && !done) {
        done = true;
        ctx.api.sfx('smash');
        ctx.finish(false, 0);
      }
    },
    destroy() {
      offs.forEach((f) => f());
    },
  };
}

// 2 · SITDOWN — swipe a standing toaster back into their seat.
function gSitdown(ctx) {
  const sub = ctx.job.sub || ctx.job.cid;
  const name = ctx.api.name(sub);
  const mine = sub === ctx.me;
  const v = shell(
    ctx,
    mine ? 'You’re up for a toast!' : `${name} is up for a toast!`,
    ctx.mirrored ? 'Swipe UP (or tap 3 times) to sit them down' : 'Swipe DOWN (or tap 3 times) to sit them down',
    { lie: true },
  );
  const seat = h('div', 'svj-seat');
  const make = (ghost) => {
    const wrap = h('div', `svj-abs svj-hit ${ghost ? 'svj-ghost' : 'svj-real'}`);
    wrap.style.padding = '10px 16px 0';
    const frame = h('div', 'svj-port');
    frame.style.padding = '3px';
    const pc = ctx.api.portrait(sub, 96);
    pc.style.width = 'min(96px, 22vh)';
    pc.style.height = 'min(96px, 22vh)';
    frame.appendChild(pc);
    wrap.appendChild(frame);
    const glass = wineGlassSprite(3);
    glass.style.position = 'absolute';
    glass.style.right = '-14px';
    glass.style.top = '4px';
    wrap.appendChild(glass);
    return wrap;
  };
  const real = make(false);
  const ghost = ctx.tier >= 2 ? make(true) : null;
  if (ghost) v.stage.appendChild(ghost);
  v.stage.appendChild(real);
  v.stage.appendChild(seat);
  const arrow = h('div', 'svj-count', ctx.mirrored ? '↑' : '↓');
  arrow.style.fontSize = '30px';
  v.stage.appendChild(arrow);

  let done = false;
  let sinkAt = 0;
  let y0 = null;
  let taps = 0;
  let lastTap = 0;
  const win = () => {
    if (done) return;
    done = true;
    sinkAt = ctx.api.now();
    ctx.api.sfx('swoosh');
    setTimeout(() => ctx.finish(true, clamp((ctx.deadline() - ctx.api.now()) / (ctx.deadline() - ctx.start), 0.2, 1)), 260);
  };
  const down = (e) => {
    e.preventDefault();
    if (done) return;
    y0 = e.clientY;
    const t = performance.now();
    taps = t - lastTap < 650 ? taps + 1 : 1;
    lastTap = t;
    ctx.api.sfx('tap');
    if (taps >= 3) win();
    try {
      real.setPointerCapture(e.pointerId);
    } catch {
      /* not capturable */
    }
  };
  const move = (e) => {
    if (y0 == null || done) return;
    const dy = e.clientY - y0;
    if (ctx.mirrored ? dy < -42 : dy > 42) win();
  };
  const up = () => {
    y0 = null;
  };
  real.addEventListener('pointerdown', down);
  real.addEventListener('pointermove', move);
  real.addEventListener('pointerup', up);
  real.addEventListener('pointercancel', up);
  const offGhost = ghost
    ? tapHandler(ghost, () => {
        ctx.api.sfx('whoosh');
      })
    : null;

  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const seatY = H - 46;
      seat.style.transform = `translate(${W / 2 - 62}px, ${seatY}px)`;
      const pop = clamp((now - ctx.start) / 300, 0, 1);
      const sink = sinkAt ? clamp((now - sinkAt) / 240, 0, 1) : 0;
      const standY = seatY - 128 + 10; // portrait top when standing
      const hideY = seatY + 10;
      const y = hideY + (standY - hideY) * pop + (hideY - standY) * sink;
      const sway = Math.sin(now / 260) * 6 * (1 - sink);
      const w = wobble(now, ctx.tier, ctx.seed);
      const x = W / 2 - 66;
      real.style.transform = `translate(${x + sway + w.x}px, ${y + w.y}px) rotate(${sway * 0.5 + w.r}deg)`;
      if (ghost) {
        const g = ghostOffset(now, ctx.seed, 74);
        const side = ctx.job.r % 2 ? 1 : -1;
        ghost.style.transform = `translate(${x + sway + w.x + g.x * side}px, ${y + w.y - g.y}px) rotate(${-sway * 0.5}deg)`;
      }
      const bob = Math.abs(Math.sin(now / 200)) * 6;
      arrow.style.top = `${Math.max(4, standY - 44) + bob}px`;
      arrow.style.opacity = sink ? '0' : '1';
      if (!done && now >= ctx.deadline()) {
        done = true;
        ctx.api.sfx('fail');
        ctx.finish(false, 0);
      }
    },
    destroy() {
      real.removeEventListener('pointerdown', down);
      real.removeEventListener('pointermove', move);
      real.removeEventListener('pointerup', up);
      real.removeEventListener('pointercancel', up);
      offGhost?.();
    },
  };
}

function wineGlassSprite(scale) {
  return px(9, 14, scale, (g) => {
    rect(g, INK, 0, 0, 9, 1);
    rect(g, INK, 0, 0, 1, 6);
    rect(g, INK, 8, 0, 1, 6);
    rect(g, '#f3eee4', 1, 1, 7, 2);
    rect(g, '#7a1f3d', 1, 3, 7, 3);
    rect(g, INK, 1, 6, 7, 1);
    rect(g, INK, 2, 7, 5, 1);
    rect(g, INK, 4, 8, 1, 4);
    rect(g, INK, 2, 12, 5, 2);
  });
}

// 3 · HICCUP — hold, and let go in the green.
function gHiccup(ctx) {
  const v = shell(ctx, 'Hiccups!', 'Hold the button. Let go while the bar is in the green.');
  const meter = h('div', 'svj-meter');
  const band = h('div', 'svj-band');
  const fill = h('i');
  meter.append(band, fill);
  const btn = h('button', 'svj-btn svj-abs', 'HOLD');
  btn.type = 'button';
  btn.style.width = '150px';
  btn.style.height = '96px';
  btn.style.fontSize = '18px';
  v.stage.append(meter, btn);
  const pop = h('div', 'svj-hicpop', 'HIC!');
  pop.style.opacity = '0';
  v.stage.appendChild(pop);

  const c0 = 0.55 + (ctx.job.r % 20) / 100;
  const hw = ctx.tier >= 3 ? 0.085 : 0.1;
  let level = 0;
  let holding = false;
  let done = false;
  let last = null;
  let popAt = 0;
  const bandC = (now) => (ctx.tier >= 3 ? clamp(c0 + Math.sin(now / 420) * 0.14, 0.3, 0.86) : c0);
  const hic = (now) => {
    ctx.api.sfx('hic');
    ctx.api.haptic(30);
    popAt = now;
    level = 0;
  };
  const down = (e) => {
    e.preventDefault();
    if (done) return;
    holding = true;
    btn.dataset.down = '1';
    try {
      btn.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
  };
  const release = () => {
    if (!holding || done) return;
    holding = false;
    btn.dataset.down = '0';
    const now = ctx.api.now();
    const c = bandC(now);
    if (Math.abs(level - c) <= hw) {
      done = true;
      ctx.api.sfx('ok');
      ctx.finish(true, clamp(1 - Math.abs(level - c) / hw, 0.3, 1));
    } else hic(now);
  };
  btn.addEventListener('pointerdown', down);
  btn.addEventListener('pointerup', release);
  btn.addEventListener('pointercancel', release);

  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const mh = Math.max(60, Math.min(H - 28, 260));
      meter.style.left = `${Math.max(16, W * 0.16)}px`;
      meter.style.top = '14px';
      meter.style.width = '48px';
      meter.style.height = `${mh}px`;
      const inner = mh - 6;
      const c = bandC(now);
      band.style.bottom = `${(c - hw) * inner}px`;
      band.style.height = `${hw * 2 * inner}px`;
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      if (holding && !done) {
        level += dt / 1.45;
        if (level >= 1) hic(now);
      }
      fill.style.width = '100%';
      fill.style.height = `${level * inner}px`;
      const w = wobble(now, ctx.tier, ctx.seed);
      btn.style.transform = `translate(${W * 0.62 - 75 + w.x * 0.5}px, ${H / 2 - 48 + w.y * 0.5}px)`;
      const pa = clamp(1 - (now - popAt) / 600, 0, 1);
      pop.style.opacity = String(pa);
      pop.style.transform = `translate(${W * 0.16 + 64}px, ${20 + (1 - pa) * -20 + H * 0.2}px)`;
      if (!done && now >= ctx.deadline()) {
        done = true;
        ctx.api.sfx('hic');
        ctx.finish(false, 0);
      }
    },
    destroy() {
      btn.removeEventListener('pointerdown', down);
      btn.removeEventListener('pointerup', release);
      btn.removeEventListener('pointercancel', release);
    },
  };
}

// 4 · HAT — mash to hang on to it.
function gHat(ctx) {
  const sub = ctx.job.sub || ctx.job.cid;
  const wear = ctx.api.wear(sub) || 'hat';
  const mine = sub === ctx.me;
  const v = shell(
    ctx,
    mine ? `Your ${wear}!` : `${possessive(ctx.api.name(sub))} ${wear}!`,
    'Big gust on the top deck. Tap it fast to hang on!',
  );
  const winds = [];
  for (let i = 0; i < 5; i++) {
    const w = h('div', 'svj-wind');
    v.stage.appendChild(w);
    winds.push(w);
  }
  const make = (ghost) => {
    const b = h('button', `svj-hit svj-abs ${ghost ? 'svj-ghost' : 'svj-real'}`);
    b.type = 'button';
    b.appendChild(wearSprite(wear, sub, 6));
    return b;
  };
  const real = make(false);
  const ghost = ctx.tier >= 2 ? make(true) : null;
  if (ghost) v.stage.appendChild(ghost);
  v.stage.appendChild(real);
  const meter = h('div', 'svj-meter');
  const fill = h('i');
  fill.style.background = '#2e7d46';
  meter.appendChild(fill);
  v.stage.appendChild(meter);
  const label = h('div', 'svj-count', 'GRIP');
  label.style.fontSize = '11px';
  v.stage.appendChild(label);

  let grip = 0.1;
  let done = false;
  let last = null;
  let jolt = 0;
  const offs = [
    tapHandler(real, () => {
      if (done) return;
      grip += 0.14;
      jolt = 1;
      ctx.api.sfx('tap');
      ctx.api.haptic(8);
      if (grip >= 1) {
        done = true;
        ctx.api.sfx('ok');
        ctx.finish(true, clamp((ctx.deadline() - ctx.api.now()) / (ctx.deadline() - ctx.start) + 0.3, 0.3, 1));
      }
    }),
  ];
  if (ghost) offs.push(tapHandler(ghost, () => ctx.api.sfx('whoosh')));
  const dir = ctx.job.r % 2 ? 1 : -1;

  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      if (!done) grip = Math.max(0, grip - dt * 0.08);
      jolt = Math.max(0, jolt - dt * 6);
      const pull = (1 - clamp(grip, 0, 1)) * W * 0.22 * dir;
      const flap = Math.sin(now / 70) * 6 * (1 - grip * 0.7);
      const w = wobble(now, ctx.tier, ctx.seed);
      const bx = W / 2 - 80 + pull + w.x;
      const by = H * 0.42 - 50 + flap + w.y - jolt * 6;
      real.style.transform = `translate(${bx}px, ${by}px) rotate(${flap * 1.5 * dir + w.r}deg)`;
      if (ghost) {
        const g = ghostOffset(now, ctx.seed, 70);
        ghost.style.transform = `translate(${bx - g.x * dir}px, ${by - g.y}px) rotate(${-flap}deg)`;
      }
      winds.forEach((wd, i) => {
        const len = 40 + ((i * 37) % 50);
        const yy = 14 + ((i * 53) % Math.max(40, H - 70));
        const xx = ((now / (3 + i) + i * 97) % (W + len)) - len;
        wd.style.width = `${len}px`;
        wd.style.transform = `translate(${dir > 0 ? xx : W - xx - len}px, ${yy}px)`;
      });
      meter.style.left = '18px';
      meter.style.right = '18px';
      meter.style.bottom = '14px';
      meter.style.height = '22px';
      fill.style.height = '100%';
      fill.style.width = `${clamp(grip, 0, 1) * 100}%`;
      label.style.top = `${H - 58}px`;
      if (!done && now >= ctx.deadline()) {
        done = true;
        ctx.api.sfx('whoosh');
        ctx.finish(false, 0);
      }
    },
    destroy() {
      offs.forEach((f) => f());
    },
  };
}

// 5 · PLATTER — drag the cheese to the glowing seat.
function gPlatter(ctx) {
  const sub = ctx.job.sub && ctx.job.sub !== ctx.me ? ctx.job.sub : null;
  const others = Object.keys(CAST_BY_ID).filter((id) => id !== ctx.me && id !== sub);
  // deterministic pick of four other faces
  const seq = [];
  let r = ctx.job.r >>> 0;
  while (seq.length < (sub ? 4 : 5) && others.length) {
    r = (Math.imul(r, 1103515245) + 12345) >>> 0;
    seq.push(others.splice(r % others.length, 1)[0]);
  }
  const ti = ctx.job.r % 5;
  const target = sub || seq[ti];
  if (sub) seq.splice(ti, 0, sub);
  const v = shell(
    ctx,
    'Pass the cheese!',
    ctx.mirrored ? `Drag it to ${ctx.api.name(target)} — the platter goes the other way` : `Drag the platter to ${ctx.api.name(target)}`,
    { lie: true },
  );
  const row = h('div', 'svj-seats');
  const cells = seq.map((cid, i) => {
    const cell = h('div', 'svj-seatcell');
    const fr = h('div', `svj-port${i === ti ? ' svj-glow' : ''}`);
    const pc = ctx.api.portrait(cid, 64);
    pc.style.width = '48px';
    pc.style.height = '48px';
    fr.appendChild(pc);
    cell.append(fr, h('span', '', ctx.api.name(cid)));
    row.appendChild(cell);
    return fr;
  });
  v.stage.appendChild(row);
  const make = (ghost) => {
    const b = h('div', `svj-abs svj-hit ${ghost ? 'svj-ghost' : 'svj-real'}`);
    b.appendChild(platterSprite(3));
    return b;
  };
  const real = make(false);
  const ghost = ctx.tier >= 2 ? make(true) : null;
  if (ghost) v.stage.appendChild(ghost);
  v.stage.appendChild(real);
  real.style.cursor = 'grab';

  let done = false;
  let drag = null; // {sx, sy, ox, oy}
  let off = { x: 0, y: 0 };
  let home = { x: 0, y: 0 };
  const down = (e) => {
    e.preventDefault();
    if (done) return;
    drag = { sx: e.clientX, sy: e.clientY, ox: off.x, oy: off.y };
    try {
      real.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    ctx.api.sfx('tap');
  };
  const move = (e) => {
    if (!drag || done) return;
    const dx = (e.clientX - drag.sx) * (ctx.mirrored ? -1 : 1);
    off = { x: drag.ox + dx, y: drag.oy + (e.clientY - drag.sy) };
  };
  const up = () => {
    if (!drag || done) return;
    drag = null;
    const pr = real.getBoundingClientRect();
    const cx = pr.left + pr.width / 2;
    const cy = pr.top + pr.height / 2;
    let hitIdx = -1;
    cells.forEach((c, i) => {
      const b = c.getBoundingClientRect();
      if (cx >= b.left - 14 && cx <= b.right + 14 && cy >= b.top - 14 && cy <= b.bottom + 30) hitIdx = i;
    });
    if (hitIdx === ti) {
      done = true;
      ctx.api.sfx('ok');
      ctx.finish(true, clamp((ctx.deadline() - ctx.api.now()) / (ctx.deadline() - ctx.start) + 0.3, 0.3, 1));
      return;
    }
    if (hitIdx >= 0) {
      ctx.api.sfx('buzz');
      ctx.api.haptic(25);
    }
    off = { x: 0, y: 0 };
  };
  real.addEventListener('pointerdown', down);
  real.addEventListener('pointermove', move);
  real.addEventListener('pointerup', up);
  real.addEventListener('pointercancel', up);

  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      home = { x: W / 2 - (32 * 3 + 24) / 2, y: H - 14 * 3 - 24 - 6 };
      const w = drag ? { x: 0, y: 0, r: 0 } : wobble(now, ctx.tier, ctx.seed);
      const x = home.x + off.x + w.x;
      const y = home.y + off.y + w.y;
      real.style.transform = `translate(${x}px, ${y}px) rotate(${w.r}deg)`;
      if (ghost) {
        const g = ghostOffset(now, ctx.seed, 56);
        ghost.style.transform = `translate(${x + g.x}px, ${y - g.y}px)`;
      }
      if (!done && now >= ctx.deadline()) {
        done = true;
        ctx.api.sfx('fail');
        ctx.finish(false, 0);
      }
    },
    destroy() {
      real.removeEventListener('pointerdown', down);
      real.removeEventListener('pointermove', move);
      real.removeEventListener('pointerup', up);
      real.removeEventListener('pointercancel', up);
    },
  };
}

// 6 · SING — tap as each note hits the line.
function gSing(ctx) {
  const v = shell(ctx, 'Sing-along!', 'Tap LA! as each note lands on the line. Three of four.');
  const lyric = h('div', 'svj-lyric', LYRICS[ctx.job.r % LYRICS.length]);
  const line = h('div', 'svj-line');
  v.stage.append(lyric, line);
  const btn = h('button', 'svj-btn svj-btn--gold svj-abs', 'LA!');
  btn.type = 'button';
  btn.style.fontSize = '18px';
  v.stage.appendChild(btn);

  const dur = ctx.deadline() - ctx.start;
  const gap = clamp((dur - 1500) / 4, 380, 700);
  const lead = Math.min(1000, dur * 0.22);
  const notes = [];
  const colours = ['#e9b440', '#ff7ab6', '#6fa8dc', '#3fae5a'];
  for (let i = 0; i < 4; i++) {
    const t = ctx.start + lead + i * gap + (((ctx.job.r >> i) % 3) - 1) * 50;
    const el = noteSprite(4, colours[i]);
    el.classList.add('svj-abs');
    v.stage.appendChild(el);
    let gh = null;
    if (ctx.tier >= 2) {
      gh = noteSprite(4, colours[i]);
      gh.classList.add('svj-abs', 'svj-ghost');
      v.stage.appendChild(gh);
    }
    notes.push({ t, el, gh, state: 0, lane: (ctx.job.r >> (i * 2)) % 3 });
  }
  const WIN = 210;
  let done = false;
  const settle = () => {
    if (done) return;
    if (notes.every((n) => n.state !== 0)) {
      done = true;
      const hits = notes.filter((n) => n.state === 1).length;
      if (hits >= 3) ctx.api.sfx('cheer');
      ctx.finish(hits >= 3, hits / 4);
    }
  };
  const tap = () => {
    if (done) return;
    const now = ctx.api.now();
    let best = null;
    for (const n of notes) {
      if (n.state) continue;
      const d = Math.abs(now - n.t);
      if (d <= WIN && (!best || d < Math.abs(now - best.t))) best = n;
    }
    if (best) {
      best.state = 1;
      ctx.api.sfx('ding');
      ctx.api.haptic(10);
    } else {
      ctx.api.sfx('buzz');
    }
    settle();
  };
  btn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    btn.dataset.down = '1';
    tap();
  });
  btn.addEventListener('pointerup', () => (btn.dataset.down = '0'));
  const stageTap = (e) => {
    if (e.target === btn) return;
    e.preventDefault();
    tap();
  };
  v.stage.addEventListener('pointerdown', stageTap);

  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const btnH = 58;
      const lineY = H - btnH - 34;
      line.style.top = `${lineY}px`;
      lyric.style.top = '8px';
      btn.style.width = `${W - 28}px`;
      btn.style.transform = `translate(14px, ${H - btnH - 12}px)`;
      const speed = (lineY - 10) / 1200; // px per ms: each note is on screen ~1.2 s
      for (const n of notes) {
        if (!n.state && now > n.t + WIN) {
          n.state = 2;
        }
        const w = wobble(now + n.lane * 300, ctx.tier, ctx.seed + n.lane);
        const x = W * (0.25 + n.lane * 0.25) - 18 + w.x;
        const y = lineY - 26 - (n.t - now) * speed;
        const vis = y > -60 && (n.state !== 1 || now - n.t < 300);
        n.el.style.display = vis ? '' : 'none';
        n.el.style.opacity = n.state === 2 ? '0.3' : '1';
        n.el.style.transform = `translate(${x}px, ${n.state === 1 ? lineY - 40 - (now - n.t) * 0.08 : y}px) scale(${n.state === 1 ? 1.25 : 1})`;
        if (n.gh) {
          const g = ghostOffset(now, ctx.seed + n.lane);
          n.gh.style.display = vis && !n.state ? '' : 'none';
          n.gh.style.transform = `translate(${x + g.x}px, ${y - g.y - 14}px)`;
        }
      }
      settle();
      if (!done && now >= ctx.deadline()) {
        notes.forEach((n) => {
          if (!n.state) n.state = 2;
        });
        settle();
      }
    },
    destroy() {
      v.stage.removeEventListener('pointerdown', stageTap);
    },
  };
}

// 7 · LEAN (group) — hold the right half of the screen.
function gLean(ctx) {
  const dir = ctx.job.dir || 1;
  const want = dir > 0 ? 'RIGHT' : 'LEFT';
  const other = dir > 0 ? 'LEFT' : 'RIGHT';
  const title = ctx.job.conga ? 'CONGA LINE!' : `LEAN ${want}!`;
  const hint = ctx.job.conga
    ? `It’s swinging ${other} — lean ${want}! Hold that side.`
    : `Big bend coming. Hold the ${want} side and keep holding.`;
  const v = shell(ctx, title, hint, { big: true, lie: true });
  // The halves: mirrored → the LABELS swap sides, so a tipsy brain that goes
  // by position gets it wrong.
  const halves = h('div', 'svj-halves');
  const mk = (side) => {
    const b = h('div', 'svj-half');
    const label = ctx.mirrored ? (side < 0 ? 'RIGHT' : 'LEFT') : side < 0 ? 'LEFT' : 'RIGHT';
    const arrow = h('div', 'svj-arrow', label === 'LEFT' ? '◀' : '▶');
    b.append(arrow, h('div', '', label));
    b.dataset.side = String(side);
    return b;
  };
  const L = mk(-1);
  const R = mk(1);
  halves.append(L, R);
  const pct = h('div', 'svj-pct', '0%');
  v.stage.append(halves, pct);

  const correct = ctx.mirrored ? -dir : dir; // the physical half that counts
  const ptrs = new Map();
  const sideOf = (e) => {
    const r = v.stage.getBoundingClientRect();
    return e.clientX < r.left + r.width / 2 ? -1 : 1;
  };
  const down = (e) => {
    e.preventDefault();
    ptrs.set(e.pointerId, sideOf(e));
    try {
      v.stage.setPointerCapture(e.pointerId);
    } catch {
      /* fine */
    }
    ctx.api.haptic(10);
  };
  const move = (e) => {
    if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, sideOf(e));
  };
  const up = (e) => ptrs.delete(e.pointerId);
  v.stage.addEventListener('pointerdown', down);
  v.stage.addEventListener('pointermove', move);
  v.stage.addEventListener('pointerup', up);
  v.stage.addEventListener('pointercancel', up);

  const sendAt = () => ctx.deadline() - SEND_EARLY;
  let held = 0;
  let last = null;
  let done = false;
  ctx.api.sfx('alarm');
  return {
    el: v.panel,
    frame(now) {
      v.tick(now, sendAt());
      const dt = last == null ? 0 : Math.min(100, now - last);
      last = now;
      const sides = new Set(ptrs.values());
      const good = sides.has(correct) && !sides.has(-correct);
      if (good && !done) held += dt;
      L.dataset.on = sides.has(-1) ? '1' : '0';
      R.dataset.on = sides.has(1) ? '1' : '0';
      const windowMs = Math.max(600, sendAt() - ctx.start);
      const q = clamp(held / (windowMs * 0.72), 0, 1);
      pct.textContent = `${Math.round(q * 100)}%`;
      pct.style.color = q >= 0.6 ? '#2e7d46' : WINE;
      if (!done && now >= sendAt()) {
        done = true;
        ctx.finish(q >= 0.6, q);
      }
    },
    destroy() {
      v.stage.removeEventListener('pointerdown', down);
      v.stage.removeEventListener('pointermove', move);
      v.stage.removeEventListener('pointerup', up);
      v.stage.removeEventListener('pointercancel', up);
    },
  };
}

// 8 · PHOTO (group) — tap SMILE right after the flash.
function gPhoto(ctx) {
  const v = shell(ctx, 'Group photo!', 'Wait for the FLASH, then tap SMILE. Too early = blink.');
  const cam = cameraSprite(4);
  cam.classList.add('svj-abs');
  const count = h('div', 'svj-count', '');
  const btn = h('button', 'svj-btn svj-btn--gold svj-abs', 'SMILE');
  btn.type = 'button';
  btn.style.fontSize = '20px';
  const flash = h('div', 'svj-flash');
  v.stage.append(cam, count, btn, flash);
  const flashAt = ctx.job.at + 900 + (ctx.job.r % 1300);
  const LATE = 650;
  let done = false;
  let flashed = false;
  const tap = (e) => {
    e.preventDefault();
    if (done) return;
    btn.dataset.down = '1';
    const now = ctx.api.now();
    done = true;
    if (now < flashAt) {
      ctx.api.sfx('buzz');
      ctx.finish(false, 0, 'Blinked!');
    } else if (now - flashAt <= LATE) {
      ctx.finish(true, clamp(1 - (now - flashAt) / LATE, 0.2, 1));
    } else {
      ctx.finish(false, 0, 'Looked away!');
    }
  };
  btn.addEventListener('pointerdown', tap);
  btn.addEventListener('pointerup', () => (btn.dataset.down = '0'));
  return {
    el: v.panel,
    frame(now) {
      v.tick(now, Math.min(ctx.deadline(), flashAt + LATE));
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const w = wobble(now, ctx.tier, ctx.seed);
      const cs = clamp((H - 120) / 80, 0.55, 1);
      cam.style.transformOrigin = 'top left';
      cam.style.transform = `translate(${W / 2 - 56 * cs + w.x}px, ${8 + w.y}px) scale(${cs})`;
      btn.style.width = `${W - 28}px`;
      btn.style.transform = `translate(14px, ${H - 70}px)`;
      const toFlash = flashAt - now;
      count.style.top = `${Math.max(8, Math.min(8 + 80 * cs + 6, H - 70 - 34))}px`;
      count.textContent = toFlash > 0 ? '•'.repeat(clamp(Math.ceil(toFlash / 400), 1, 4)) : 'NOW!';
      if (!flashed && now >= flashAt) {
        flashed = true;
        ctx.api.sfx('camera');
      }
      flash.style.opacity = flashed ? String(clamp(1 - (now - flashAt) / 380, 0, 1)) : '0';
      if (!done && now > flashAt + LATE) {
        done = true;
        ctx.finish(false, 0, 'Eyes shut!');
      }
    },
    destroy() {
      btn.removeEventListener('pointerdown', tap);
    },
  };
}

// 9 · WAKE — you nodded off; mash to wake.
function gWake(ctx) {
  const v = shell(ctx, 'You nodded off', 'Mash anywhere to wake up!', { dark: true });
  const fr = h('div', 'svj-port svj-abs');
  fr.style.padding = '3px';
  fr.style.filter = 'brightness(.55) saturate(.5)';
  fr.appendChild(ctx.api.portrait(ctx.me, 96));
  v.stage.appendChild(fr);
  const zs = [];
  for (let i = 0; i < 3; i++) {
    const z = h('div', 'svj-zzz', 'Z');
    v.stage.appendChild(z);
    zs.push(z);
  }
  const meter = h('div', 'svj-meter');
  meter.style.borderColor = '#b9a8ff';
  meter.style.boxShadow = 'none';
  meter.style.background = '#2a2140';
  const fill = h('i');
  fill.style.background = '#ffcf5a';
  meter.appendChild(fill);
  v.stage.appendChild(meter);
  const NEED = 18;
  let level = 0;
  let done = false;
  let last = null;
  let nextSnore = ctx.start + 300;
  const tap = (e) => {
    e.preventDefault();
    if (done) return;
    level += 1 / NEED;
    ctx.api.sfx('tap');
    ctx.api.haptic(8);
    if (level >= 1) {
      done = true;
      ctx.api.sfx('alarm');
      ctx.finish(true, 1);
    }
  };
  v.stage.addEventListener('pointerdown', tap);
  return {
    el: v.panel,
    frame(now) {
      v.tick(now);
      const W = v.stage.clientWidth;
      const H = v.stage.clientHeight;
      const dt = last == null ? 0 : (now - last) / 1000;
      last = now;
      if (!done) level = Math.max(0, level - (dt * 0.5) / NEED);
      if (now >= nextSnore && !done) {
        ctx.api.sfx('snore');
        nextSnore = now + 1700;
      }
      const sway = Math.sin(now / 900) * 4;
      fr.style.transform = `translate(${W / 2 - 51}px, ${Math.max(6, H / 2 - 80) + sway}px) rotate(${sway * 2}deg)`;
      zs.forEach((z, i) => {
        const p = ((now / 1400 + i / 3) % 1 + 1) % 1;
        z.style.fontSize = `${12 + i * 5}px`;
        z.style.opacity = String(1 - p);
        z.style.transform = `translate(${W / 2 + 40 + p * 40 + i * 6}px, ${H / 2 - 70 - p * 60}px)`;
      });
      meter.style.left = '18px';
      meter.style.right = '18px';
      meter.style.bottom = '14px';
      meter.style.height = '24px';
      fill.style.height = '100%';
      fill.style.width = `${level * 100}%`;
      if (!done && now >= ctx.deadline()) {
        done = true;
        ctx.finish(false, 0);
      }
    },
    destroy() {
      v.stage.removeEventListener('pointerdown', tap);
    },
  };
}

const FACTORIES = {
  bottle: gBottle,
  sitdown: gSitdown,
  hiccup: gHiccup,
  hat: gHat,
  platter: gPlatter,
  sing: gSing,
  lean: gLean,
  photo: gPhoto,
  wake: gWake,
};

// ── Claim-card copy ──────────────────────────────────────────────────────────
function troubleLine(api, j) {
  const n = api.name(j.cid);
  switch (j.k) {
    case 'bottle':
      return `${possessive(n)} bottle is loose!`;
    case 'sitdown':
      return `${n} is up for a toast!`;
    case 'hat':
      return `${possessive(n)} ${api.wear(j.cid) || 'hat'} is blowing away!`;
    case 'hiccup':
      return `${n} has the hiccups!`;
    case 'platter':
      return `${n} wants the cheese!`;
    case 'sing':
      return `${n} started a sing-along!`;
    default:
      return `${n} needs a hand!`;
  }
}

// ── Controller ───────────────────────────────────────────────────────────────

export function createJobs(root, api) {
  if (!document.getElementById('svj-css')) {
    const st = document.createElement('style');
    st.id = 'svj-css';
    st.textContent = CSS;
    document.head.appendChild(st);
  }
  root.classList.add('svj-root');
  const host = h('div', 'svj');
  root.appendChild(host);

  let view = null;
  let current = null; //   { key, job, game, mode }
  let beat = null; //      { el, until }
  let mode = null; //      'game' | 'cards' | 'idle'
  let idle = null;
  let cards = null;
  let raf = 0;
  let alive = true;
  const answered = new Set(); // `${id}@${at}`
  const claiming = new Map(); // key -> sentAt
  const takenSeen = new Map(); // key -> first time we saw someone else claim it
  const keyOf = (j) => `${j.id}@${j.at}`;

  const meId = () => api.me() || view?.me || null;
  const myTier = () => {
    const m = meId();
    if (!m) return 0;
    try {
      return api.tier(m);
    } catch {
      return tierOf(api.tip?.(m) || 0);
    }
  };

  function sendResult(job, ok, q) {
    const k = keyOf(job);
    if (answered.has(k)) return;
    answered.add(k);
    api.send({ t: 'job', id: job.id, ok: !!ok, q: Math.round(clamp(q || 0, 0, 1) * 100) / 100 });
  }

  function showBeat(kind, ok, text, sub) {
    clearBeat();
    const el = h('div', 'svj-beat');
    el.dataset.ok = ok ? '1' : '0';
    el.appendChild(h('b', '', ok ? '✓' : '✗'));
    const name = sub ? api.name(sub) : '';
    const copy = (text || (BEAT[kind] ? BEAT[kind][ok ? 0 : 1] : ok ? 'Nice!' : 'Whoops')).replace('{n}', name || 'them');
    el.appendChild(h('span', '', copy));
    host.appendChild(el);
    beat = { el, until: performance.now() + BEAT_MS };
    if (ok) {
      api.sfx(kind === 'lean' || kind === 'sing' ? 'cheer' : 'ok');
      api.haptic(20);
    } else {
      api.sfx(kind === 'bottle' ? 'smash' : 'fail');
      api.haptic(60);
    }
  }
  function clearBeat() {
    if (beat) {
      beat.el.remove();
      beat = null;
    }
  }

  function stopGame() {
    if (!current) return;
    try {
      current.game.destroy();
    } catch {
      /* best effort */
    }
    current.game.el.remove();
    current = null;
  }

  function startGame(job, kind) {
    stopGame();
    clearMode();
    const me = meId();
    const tr = myTier();
    const ref = { job };
    const ctx = {
      api,
      job,
      me,
      tier: tr,
      mirrored: tr >= 3 && job.r % 3 === 0,
      seed: (job.r % 1000) / 159,
      start: api.now(),
      deadline: () => ref.job.end,
      finish: (ok, q, text) => {
        if (!current || current.key !== keyOf(job)) return;
        const live = ref.job;
        sendResult(live, ok, q);
        stopGame();
        showBeat(kind, ok, text, live.sub || live.cid);
      },
    };
    const game = FACTORIES[kind](ctx);
    host.appendChild(game.el);
    current = { key: keyOf(job), ref, job, game, kind };
    mode = 'game';
  }

  function clearMode() {
    if (idle) {
      idle.el.remove();
      idle = null;
    }
    if (cards) {
      cards.el.remove();
      cards = null;
    }
    mode = null;
  }

  // ── Idle ─────────────────────────────────────────────────────────────────
  function showIdle() {
    if (mode === 'idle' && idle) return;
    clearMode();
    const panel = h('div', 'svj-panel svj-idle');
    const head = h('div', 'svj-head');
    const t = h('div', 'svj-title', 'All quiet back here');
    const hint = h('div', 'svj-hint', '');
    head.append(t, hint);
    const cv = document.createElement('canvas');
    cv.className = 'svj-px';
    cv.width = 120;
    cv.height = 60;
    panel.append(head, cv);
    host.appendChild(panel);
    idle = { el: panel, cv, hint, lastHint: '' };
    mode = 'idle';
  }
  function drawIdle(now) {
    const cv = idle.cv;
    // Keep one canvas pixel = 3 css px at the panel's real aspect ratio.
    const S = 3;
    const cw = Math.max(40, Math.floor(cv.clientWidth / S));
    const ch = Math.max(30, Math.floor(cv.clientHeight / S));
    if (cv.width !== cw || cv.height !== ch) {
      cv.width = cw;
      cv.height = ch;
    }
    const g = cv.getContext('2d');
    const W = cw;
    const H = ch;
    g.imageSmoothingEnabled = false;
    const tr = myTier();
    const k = REDUCED ? 0.3 : 1;

    // the bus wall
    g.fillStyle = '#efe1bd';
    g.fillRect(0, 0, W, H);
    // the window, top ~58 %
    const wx = 4;
    const wy = 3;
    const ww = W - 8;
    const wh = Math.max(16, Math.round(H * 0.58));
    const horizon = wy + Math.round(wh * 0.45);
    g.fillStyle = '#bfe6fb';
    g.fillRect(wx, wy, ww, horizon - wy);
    g.fillStyle = '#9fcb70';
    g.fillRect(wx, horizon, ww, wy + wh - horizon);
    // a gum on the skyline drifting past
    const gumX = wx + ((W * 1.5 - ((now / 90) % (W * 1.5))) | 0) - 10;
    if (gumX > wx - 12 && gumX < wx + ww) {
      g.fillStyle = '#e8e2d2';
      g.fillRect(gumX + 4, horizon - 7, 2, 7);
      g.fillStyle = '#6f8f6a';
      g.fillRect(gumX, horizon - 12, 10, 6);
      g.fillRect(gumX + 2, horizon - 14, 6, 2);
    }
    // vine rows, nearer rows faster
    const rows = Math.max(2, Math.floor((wy + wh - horizon - 2) / 5));
    for (let r = 0; r < rows; r++) {
      const y = horizon + 2 + r * 5;
      const sp = 0.6 + r * 0.55;
      const off = (now / 30) * sp;
      for (let x = -12; x < ww + 12; x += 10) {
        const xx = wx + Math.round(x - (off % 10));
        if (xx < wx - 1 || xx + 7 > wx + ww) continue;
        g.fillStyle = r % 2 ? '#4f8a35' : '#5f9d3e';
        g.fillRect(xx, y, 7, 3);
        g.fillStyle = '#3c6b28';
        g.fillRect(xx + 3, y + 3, 1, 1);
      }
    }
    // frame
    g.fillStyle = WINE;
    g.fillRect(wx - 2, wy - 2, ww + 4, 2);
    g.fillRect(wx - 2, wy + wh, ww + 4, 2);
    g.fillRect(wx - 2, wy - 2, 2, wh + 4);
    g.fillRect(wx + ww, wy - 2, 2, wh + 4);
    g.fillRect(wx + Math.round(ww / 2) - 1, wy, 2, wh);
    // the sill / table
    const sillY = wy + wh + 2;
    g.fillStyle = '#a0703f';
    g.fillRect(0, sillY, W, 3);
    g.fillStyle = '#6e4a26';
    g.fillRect(0, sillY + 3, W, 1);
    g.fillStyle = '#7a1f3d';
    g.fillRect(0, sillY + 4, W, H - sillY - 4);
    g.fillStyle = '#5c1530';
    for (let x = 6; x < W; x += 16) g.fillRect(x, sillY + 6, 10, H - sillY - 8);

    // a glass of red on the sill, sloshing with the bus (and you)
    const sway = Math.sin(now / 650) * (1.2 + tr * 1.4) * k;
    const gx = Math.round(W / 2 - 6);
    const gy = sillY - 21;
    g.fillStyle = INK;
    g.fillRect(gx, gy, 13, 1);
    g.fillRect(gx, gy, 1, 10);
    g.fillRect(gx + 12, gy, 1, 10);
    g.fillRect(gx + 1, gy + 10, 11, 1);
    g.fillRect(gx + 2, gy + 11, 9, 1);
    g.fillRect(gx + 6, gy + 12, 1, 7);
    g.fillRect(gx + 3, gy + 19, 7, 2);
    g.fillStyle = '#f7f3ea';
    g.fillRect(gx + 1, gy + 1, 11, 9);
    g.fillStyle = '#ffffff';
    g.fillRect(gx + 2, gy + 2, 1, 3);
    for (let x = 1; x < 12; x++) {
      const level = clamp(5 + Math.round(((x - 6) * sway) / 6), 2, 9);
      g.fillStyle = WINE;
      g.fillRect(gx + x, gy + level, 1, 10 - level);
      g.fillStyle = '#a8324f';
      g.fillRect(gx + x, gy + level, 1, 1);
    }

    const m = meId();
    const t = TIERS[tr] || TIERS[0];
    const line = m
      ? `You: ${t.name}. ${t.blurb} Spot a roo? Tap it on the road to warn the driver.`
      : 'Enjoy the view.';
    if (line !== idle.lastHint) {
      idle.hint.textContent = line;
      idle.lastHint = line;
    }
  }

  // ── Claim cards ──────────────────────────────────────────────────────────
  function showCards(list) {
    const sig = list.map((j) => `${keyOf(j)}:${j.by || ''}:${claiming.has(keyOf(j)) ? 1 : 0}`).join('|');
    if (mode === 'cards' && cards && cards.sig === sig) return;
    clearMode();
    const panel = h('div', 'svj-panel');
    const headline = h('div', 'svj-cardshead', 'Trouble on the bus!');
    const wrap = h('div', 'svj-cards');
    const timers = [];
    for (const j of list) {
      const card = h('div', `svj-card${j.by ? ' svj-card--taken' : ''}`);
      const fr = h('div', 'svj-port');
      fr.appendChild(api.portrait(j.cid, 64));
      const p = h('p', '', j.by ? `${api.name(j.by)}’s got it` : troubleLine(api, j));
      card.append(fr, p);
      if (!j.by) {
        const b = h('button', 'svj-btn', claiming.has(keyOf(j)) ? '…' : 'I’VE GOT IT');
        b.type = 'button';
        if (claiming.has(keyOf(j))) b.disabled = true;
        b.addEventListener('pointerdown', (e) => {
          e.preventDefault();
          if (claiming.has(keyOf(j))) return;
          claiming.set(keyOf(j), performance.now());
          api.sfx('tap');
          api.haptic(15);
          api.send({ t: 'claim', id: j.id });
          b.textContent = '…';
          b.disabled = true;
        });
        const tm = h('div', 'svj-timer');
        const f = h('i');
        tm.appendChild(f);
        card.append(b, tm);
        timers.push({ f, j });
      }
      wrap.appendChild(card);
    }
    panel.append(headline, wrap);
    host.appendChild(panel);
    cards = { el: panel, sig, timers };
    mode = 'cards';
  }

  // ── Decide what the panel shows ──────────────────────────────────────────
  function decide() {
    const now = api.now();
    const me = meId();
    if (beat) {
      if (performance.now() < beat.until) return;
      clearBeat();
    }
    const jobs = (view && view.jobs) || [];
    const isLive = (j) => j.at <= now;

    // The game in progress vanished from the view: the server closed it.
    if (current) {
      const still = jobs.find((j) => keyOf(j) === current.key);
      if (still) {
        current.job = still;
        current.ref.job = still;
      }
      else {
        const k = current.kind;
        const wasAnswered = answered.has(current.key);
        const sub = current.job.sub || current.job.cid;
        stopGame();
        if (!wasAnswered) showBeat(k, false, k === 'wake' ? null : 'Too slow!', sub);
        return;
      }
    }

    let target = null;
    if (me && view && view.driver !== me) {
      // 1 · group moments
      for (const j of jobs) {
        const def = JOBS[j.k];
        if (!def || !def.group) continue;
        if (!isLive(j) || now >= j.end) continue;
        // joining a group moment with under ~0.7 s left is just a free fail —
        // but one already on screen runs to its own finish
        const running = current && current.key === keyOf(j);
        if (!running && j.end - now < 700) continue;
        if (answered.has(keyOf(j))) continue;
        target = j;
        break;
      }
      // 2 · my own job
      if (!target) {
        for (const j of jobs) {
          const def = JOBS[j.k];
          if (!def || def.group || !isLive(j)) continue;
          const mine = (!j.open && j.cid === me) || (j.open && j.by === me);
          if (!mine || answered.has(keyOf(j))) continue;
          target = j;
          break;
        }
      }
    }

    if (target) {
      if (!current || current.key !== keyOf(target)) {
        // a group moment pre-empts a personal job; that job restarts fresh
        // afterwards (the server already gave it the time back)
        startGame(target, target.k);
      }
      return;
    }
    if (current) {
      // still mine but no longer the target (answered elsewhere) — drop it
      if (answered.has(current.key)) stopGame();
      else return;
    }

    // 3 · claim cards
    if (me && view && view.driver !== me) {
      const tnow = performance.now();
      const list = [];
      for (const j of jobs) {
        if (!j.open || !JOBS[j.k] || JOBS[j.k].group || !isLive(j)) continue;
        if (j.by === me) continue;
        if (j.by) {
          const k = keyOf(j);
          if (!takenSeen.has(k)) takenSeen.set(k, tnow);
          if (tnow - takenSeen.get(k) > GOT_IT_MS) continue;
          list.push(j);
          continue;
        }
        if (now >= j.at + CLAIM_MS) continue;
        list.push(j);
      }
      list.sort((a, b) => (a.by ? 1 : 0) - (b.by ? 1 : 0) || a.at - b.at);
      if (list.length) {
        showCards(list.slice(0, 2));
        return;
      }
    }
    showIdle();
  }

  function loop() {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    try {
      decide();
      const now = api.now();
      if (current) current.game.frame(now);
      else if (mode === 'idle' && idle) drawIdle(now);
      else if (mode === 'cards' && cards) {
        for (const { f, j } of cards.timers) {
          f.style.transform = `scaleX(${clamp((j.at + CLAIM_MS - now) / CLAIM_MS, 0, 1)})`;
        }
      }
    } catch (err) {
      console.error('[swerve-valley jobs]', err);
    }
    // forget stale bookkeeping
    if (claiming.size > 40) claiming.clear();
    if (takenSeen.size > 40) takenSeen.clear();
  }
  raf = requestAnimationFrame(loop);

  return {
    update(v) {
      view = v;
      // a claim that the server gave to someone else (or that expired) frees the button
      if (v && v.jobs) {
        for (const k of [...claiming.keys()]) {
          const j = v.jobs.find((x) => keyOf(x) === k);
          if (!j || (j.by && j.by !== (api.me() || v.me))) claiming.delete(k);
        }
      }
    },
    destroy() {
      alive = false;
      cancelAnimationFrame(raf);
      stopGame();
      clearMode();
      clearBeat();
      host.remove();
      root.classList.remove('svj-root');
    },
  };
}
