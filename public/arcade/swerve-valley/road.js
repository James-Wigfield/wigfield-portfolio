/* ============================================================================
   SWERVE VALLEY — the road
   ----------------------------------------------------------------------------
   A classic pseudo-3D segment road (the OutRun / javascript-racer technique)
   drawn into a tiny canvas and scaled up with nearest-neighbour, so it reads
   as pixel art at any phone size.

   World: z along the road (PHYS.SEG units per segment), x in ROAD HALF-WIDTHS.
   The fork is real geometry: past `forkZ` the road splits into two branches
   whose centres sit at ±forkK(i). The bus's x is always relative to the road
   it is on, and the camera rides the branch it took, so the road you chose
   carries on straight ahead while the other one peels off.
   ========================================================================== */

import { PHYS, hazZ, hazX, rooPhase, TOD, clamp, mulberry32 } from './world.js';

const SEG = PHYS.SEG;
const ROAD_W = PHYS.ROAD_W;
const CAM_H = 1700; // high enough to see the road over the roof
const CAM_BACK = 1500;
const DEPTH = 1 / Math.tan((100 / 2) * (Math.PI / 180));
const DRAW = 170;
const RUMBLE = 3;
const FORK_SPREAD = 40;
const HORIZON = 0.4; // fraction of the canvas height

export const INTERNAL_W = 160;

/** How far each branch centre sits from the trunk, i segments in. */
export function forkK(i, forkSeg) {
  const d = i - forkSeg;
  if (d <= 0) return 0;
  return Math.pow(d / FORK_SPREAD, 1.6) * 2.4;
}

// ── tiny pixel-art helpers ───────────────────────────────────────────────────
function mk(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  draw(g, (x, y, ww, hh, col) => {
    g.fillStyle = col;
    g.fillRect(x, y, ww, hh);
  });
  return c;
}

function makeSprites(art) {
  const S = {};
  S.vine = mk(14, 13, (g, r) => {
    r(6, 4, 2, 9, '#6b4a2b'); // trellis post
    r(2, 2, 10, 6, '#3f7d2a');
    r(1, 4, 12, 4, '#3f7d2a');
    r(3, 1, 8, 2, '#56a03a');
    r(2, 3, 4, 2, '#6cbf45');
    r(8, 5, 3, 2, '#6cbf45');
    r(4, 7, 2, 2, '#5b2a6e'); // grapes
    r(9, 8, 2, 2, '#5b2a6e');
    r(1, 8, 12, 1, '#2c5a1e');
  });
  S.post = mk(3, 10, (g, r) => {
    r(0, 0, 3, 10, '#8a6a43');
    r(0, 0, 1, 10, '#a98652');
  });
  S.roosign = mk(15, 22, (g, r) => {
    r(7, 12, 1, 10, '#777');
    for (let y = 0; y < 13; y++) {
      const half = 6 - Math.abs(6 - y);
      r(7 - half, y, half * 2 + 1, 1, '#f2c21b');
    }
    r(5, 4, 4, 2, '#111');
    r(4, 6, 5, 2, '#111');
    r(3, 8, 2, 1, '#111');
    r(8, 3, 2, 2, '#111');
  });
  S.cone = mk(7, 9, (g, r) => {
    r(2, 0, 3, 2, '#ff7a1a');
    r(2, 2, 3, 2, '#ffffff');
    r(1, 4, 5, 2, '#ff7a1a');
    r(0, 6, 7, 1, '#ffffff');
    r(0, 7, 7, 2, '#ff7a1a');
  });
  S.hedge = mk(64, 18, (g, r) => {
    r(0, 2, 64, 16, '#2d5a26');
    for (let i = 0; i < 64; i += 4) {
      r(i, (i * 7) % 3, 4, 3, '#3c7330');
      r(i + 1, 6 + ((i * 3) % 5), 2, 2, '#4f8f3a');
      r(i + 2, 11 + ((i * 5) % 4), 2, 2, '#244a1f');
    }
  });
  S.welcome = mk(34, 24, (g, r) => {
    r(3, 12, 2, 12, '#6b4a2b');
    r(29, 12, 2, 12, '#6b4a2b');
    r(0, 0, 34, 14, '#7a1f3d');
    r(1, 1, 32, 12, '#f6ecd2');
    // a wine glass and two lines of "text"
    r(4, 3, 5, 3, '#7a1f3d');
    r(6, 6, 1, 3, '#7a1f3d');
    r(4, 9, 5, 1, '#7a1f3d');
    r(12, 4, 18, 2, '#7a1f3d');
    r(12, 8, 14, 2, '#a8324f');
  });
  // Fork signboards, one each side of the road, arrows pointing outwards.
  const board = (dir) =>
    mk(34, 30, (g, r) => {
      r(dir < 0 ? 26 : 5, 14, 3, 16, '#8a8a8a');
      r(0, 0, 34, 16, '#f3f3f3');
      r(1, 1, 32, 14, '#1e6b3a');
      const ax = dir < 0 ? 4 : 18;
      r(ax, 7, 12, 2, '#fff');
      if (dir < 0) {
        r(ax, 5, 2, 6, '#fff');
        r(ax - 1, 6, 1, 4, '#fff');
      } else {
        r(ax + 10, 5, 2, 6, '#fff');
        r(ax + 12, 6, 1, 4, '#fff');
      }
      r(dir < 0 ? 19 : 4, 4, 10, 1, '#cfe9d6');
      r(dir < 0 ? 19 : 4, 11, 8, 1, '#cfe9d6');
    });
  S.fsignL = board(-1);
  S.fsignR = board(1);
  S.sign = mk(26, 22, (g, r) => {
    r(12, 6, 2, 16, '#6b4a2b');
    r(1, 2, 12, 5, '#1e6b3a');
    r(0, 4, 2, 1, '#1e6b3a');
    r(13, 7, 12, 5, '#1e6b3a');
    r(24, 9, 2, 1, '#1e6b3a');
    r(3, 4, 8, 1, '#fff');
    r(15, 9, 8, 1, '#fff');
  });
  S.cyclist = mk(13, 20, (g, r) => {
    r(5, 13, 3, 7, '#222'); // wheel
    r(4, 0, 5, 3, '#e33'); // helmet
    r(5, 3, 3, 2, '#e8b48a');
    r(3, 5, 7, 5, '#ffd51e'); // jersey
    r(2, 6, 2, 4, '#ffd51e');
    r(9, 6, 2, 4, '#ffd51e');
    r(4, 10, 5, 3, '#1b1b1b');
    r(3, 12, 2, 4, '#e8b48a');
    r(8, 12, 2, 4, '#e8b48a');
    r(1, 9, 2, 2, '#999'); // bars
    r(10, 9, 2, 2, '#999');
  });
  S.tractor = mk(30, 24, (g, r) => {
    r(0, 8, 8, 16, '#1d1d1d');
    r(22, 8, 8, 16, '#1d1d1d');
    r(1, 10, 6, 12, '#333');
    r(23, 10, 6, 12, '#333');
    r(8, 6, 14, 14, '#c8261f');
    r(9, 7, 12, 4, '#e2453a');
    r(10, 0, 10, 7, '#8fb8c8'); // cab glass
    r(10, 0, 10, 1, '#c8261f');
    r(13, 13, 4, 3, '#555');
    r(18, 1, 1, 6, '#444'); // exhaust
  });
  S.barrel = mk(13, 13, (g, r) => {
    r(1, 0, 11, 13, '#7a4a24');
    r(0, 2, 13, 9, '#7a4a24');
    r(0, 3, 13, 1, '#3a3a3a');
    r(0, 9, 13, 1, '#3a3a3a');
    r(3, 1, 2, 11, '#94602f');
    r(9, 1, 1, 11, '#5e381b');
  });
  S.pothole = mk(18, 5, (g, r) => {
    r(3, 0, 12, 5, '#2b2725');
    r(1, 1, 16, 3, '#2b2725');
    r(4, 1, 8, 2, '#1a1716');
  });
  S.bay = mk(4, 4, (g, r) => r(0, 0, 4, 4, '#fff'));
  // Images from PixelLab (may be missing while loading — draw nothing then).
  S.roo = art.roo;
  S.sheep = art.sheep;
  S.gum = art.gum;
  S.cellar = art.cellar;
  S.busRear = art['bus-rear'];
  return S;
}

// World widths (road half-widths) for every sprite kind.
const WORLD_W = {
  vine: 0.3,
  post: 0.05,
  roosign: 0.28,
  cone: 0.11,
  hedge: 2.6,
  welcome: 0.9,
  fsignL: 0.75,
  fsignR: 0.75,
  sign: 0.48,
  cyclist: 0.28,
  tractor: 0.7,
  barrel: 0.3,
  pothole: 0.4,
  roo: 0.36,
  sheep: 0.42,
  gum: 1.3,
  cellar: 2.4,
};

// ── Decor: deterministic per leg ─────────────────────────────────────────────
const decorCache = new WeakMap();
function decorFor(track, seed) {
  let d = decorCache.get(track);
  if (d) return d;
  const rnd = mulberry32((seed ^ Math.imul(track.leg + 5, 0x2545f491)) >>> 0);
  const forkSeg = Math.round(track.forkZ / SEG);
  const parkSeg = Math.round(track.parkZ / SEG);
  const endSeg = Math.round(track.endZ / SEG);
  const bySeg = new Map();
  const add = (i, x, k, b = 0) => {
    if (!bySeg.has(i)) bySeg.set(i, []);
    bySeg.get(i).push({ x, k, b });
  };
  const fs = track.forkSide;
  for (let i = 3; i < track.n - 2; i++) {
    const post = i > forkSeg;
    if (post && i > endSeg + 30) break;
    const b = post ? fs : 0;
    if (i % 3 === 0) {
      for (const x of [1.6, 2.1, 2.6, 3.1]) {
        // keep the gore between the branches clear: outer side only
        if (post && i < forkSeg + 50) {
          add(i, x * fs, 'vine', b);
          continue;
        }
        add(i, x, 'vine', b);
        add(i, -x, 'vine', b);
      }
    }
    if (i % 6 === 0 && !post) {
      add(i, 1.25, 'post');
      add(i, -1.25, 'post');
    }
    if (i % 11 === 0 && rnd() < 0.45) add(i, (rnd() < 0.5 ? -1 : 1) * (3.7 + rnd() * 2.6), 'gum', b);
  }
  add(14, -1.5, 'welcome');
  // Roo warning signs ahead of every roo.
  for (const h of track.haz) {
    if (h.k !== 'roo') continue;
    const i = Math.floor(h.cz / SEG) - 34;
    if (i > 8) add(i, h.a > 0 ? 1.4 : -1.4, 'roosign');
  }
  // The fork: a signboard each side, then a line of cones up to the signpost.
  add(forkSeg - 28, -1.55, 'fsignL');
  add(forkSeg - 28, 1.55, 'fsignR');
  for (let i = forkSeg - 16; i < forkSeg; i += 2) add(i, 0, 'cone');
  // The cellar door, the car park and the hedge — all down the right branch.
  add(parkSeg + 2, 1.9, 'cellar', fs);
  add(parkSeg + 1, -2.0, 'gum', fs);
  add(endSeg + 1, 0, 'hedge', fs);
  d = { bySeg, forkSeg, parkSeg, endSeg };
  decorCache.set(track, d);
  return d;
}

// ── The renderer ─────────────────────────────────────────────────────────────
export function createRoad(canvas, art) {
  const ctx = canvas.getContext('2d');
  let W = INTERNAL_W;
  let H = 200;
  let S = makeSprites(art);
  let skyOff = 0;
  let lastZ = null;
  let drawnHaz = []; // last frame's hazard rectangles, for tap-to-spot

  function resize() {
    const r = canvas.getBoundingClientRect();
    if (!r.width || !r.height) return;
    H = Math.max(120, Math.round((W * r.height) / r.width));
    canvas.width = W;
    canvas.height = H;
    ctx.imageSmoothingEnabled = false;
  }

  function setArt(a) {
    S = makeSprites(a);
  }

  /**
   * o = { z, x, v, side (null|-1|1), t, leg, seed, hits:Set, knock:Map(id→t),
   *       steer, brake, tilt, shake, flash, splat:{n,wiped}, showBus }
   */
  function render(track, o) {
    if (!canvas.width) resize();
    const tod = TOD[o.leg] || TOD[0];
    const dusk = tod.dusk;
    const deco = decorFor(track, o.seed);
    const forkSeg = deco.forkSeg;
    const hz = H * HORIZON;

    const z = clamp(o.z, 0, track.len - SEG * 2);
    const camZ = z - CAM_BACK;
    const baseI = Math.max(0, Math.floor(camZ / SEG));
    const basePct = (camZ - baseI * SEG) / SEG;
    const yAt = (i) => (i < 0 ? 0 : track.y[Math.min(i, track.n - 1)]);
    const busI = Math.min(track.n - 1, Math.floor(z / SEG));
    const busPct = (z - busI * SEG) / SEG;
    const busY = yAt(busI - 1) + (yAt(busI) - yAt(busI - 1)) * busPct;
    const camY = busY + CAM_H;
    const side = o.side ?? null;
    const camXW = (side ? side * forkK(busI + busPct, forkSeg) : 0) + o.x;

    if (lastZ != null && z > lastZ && z - lastZ < 4000) {
      skyOff += track.curve[busI] * (z - lastZ) * 0.00009;
    }
    lastZ = z;

    // shake
    const sh = o.shake || 0;
    ctx.save();
    if (sh > 0) ctx.translate(Math.round((Math.random() - 0.5) * sh), Math.round((Math.random() - 0.5) * sh));

    drawSky(tod, hz);

    // ── segments, near to far ──
    const segs = [];
    let maxy = H;
    let cx = 0;
    let dx = -(track.curve[baseI] * basePct);
    for (let n = 0; n < DRAW; n++) {
      const i = baseI + n;
      if (i >= track.n - 1) break;
      const z1 = i * SEG - camZ;
      const z2 = (i + 1) * SEG - camZ;
      const c1 = cx;
      const c2 = cx + dx;
      cx += dx;
      dx += track.curve[i];
      if (z1 <= 20) {
        segs.push(null);
        continue;
      }
      const s1 = DEPTH / z1;
      const s2 = DEPTH / z2;
      const y1 = hz - s1 * (yAt(i - 1) - camY) * (H / 2);
      const y2 = hz - s2 * (yAt(i) - camY) * (H / 2);
      const seg = { i, s1, s2, y1, y2, c1, c2, clip: maxy };
      segs.push(seg);
      if (y2 >= y1 || y2 >= maxy) continue;
      drawSegment(seg, track, tod, forkSeg, camXW, dusk);
      maxy = y2;
    }

    // ── sprites, far to near ──
    const list = [];
    const screenX = (seg, pct, b, xw) => {
      const s = seg.s1 + (seg.s2 - seg.s1) * pct;
      const c = seg.c1 + (seg.c2 - seg.c1) * pct;
      return W / 2 + s * (c + (b - camXW + xw) * ROAD_W) * (W / 2);
    };
    const pushSprite = (zw, xw, b, key, extra) => {
      const n = Math.floor(zw / SEG) - baseI;
      const seg = segs[n];
      if (!seg) return;
      const pct = (zw - seg.i * SEG) / SEG;
      const s = seg.s1 + (seg.s2 - seg.s1) * pct;
      const y = seg.y1 + (seg.y2 - seg.y1) * pct;
      const x = screenX(seg, pct, b, xw);
      list.push({ zw, x, y, s, key, clip: seg.clip, ...extra });
    };

    for (let n = segs.length - 1; n >= 0; n--) {
      const seg = segs[n];
      if (!seg) continue;
      const items = deco.bySeg.get(seg.i);
      if (!items) continue;
      for (const it of items) {
        const bc = it.b ? it.b * forkK(seg.i + 0.5, forkSeg) : 0;
        pushSprite(seg.i * SEG + SEG * 0.5, it.x, bc, it.k);
      }
    }
    for (const h of track.haz) {
      const hzw = hazZ(h, z);
      if (hzw < camZ + 60 || hzw > camZ + DRAW * SEG) continue;
      const knocked = o.knock?.get(h.id);
      let xw = hazX(h, z);
      let lift = 0;
      if (knocked != null) {
        const p = clamp((z - h.cz) / 2500, 0, 1);
        xw += (xw >= o.x ? 1 : -1) * p * 1.8;
        lift = Math.sin(p * Math.PI) * 30;
      }
      const key = h.k;
      let hop = 0;
      let flip = false;
      if (h.k === 'roo') {
        const ph = rooPhase(h, z);
        if (ph > 0 && ph < 1) hop = Math.abs(Math.sin(ph * Math.PI * 5)) * 7;
        flip = h.b < h.a;
      }
      if (h.k === 'cyclist') hop = Math.abs(Math.sin(z / 260)) * 0.6;
      pushSprite(hzw, xw, 0, key, { hop: hop + lift, flip, haz: true, id: h.id });
    }
    list.push({ zw: z, bus: true });
    list.sort((a, b) => b.zw - a.zw);

    const busScreenY = hz - (DEPTH / CAM_BACK) * (busY - camY) * (H / 2);
    drawnHaz = [];
    for (const sp of list) {
      if (sp.bus) {
        if (o.showBus !== false) drawBus(o, busScreenY, dusk);
        continue;
      }
      const r = drawSprite(sp);
      if (sp.haz && r) drawnHaz.push({ id: sp.id, ...r });
    }
    // X-ray: anything AHEAD of the bus that the bus picture covers is drawn
    // again, see-through, on top — you should never hit what you can't see.
    if (o.showBus !== false) {
      ctx.globalAlpha = 0.55;
      for (const sp of list) if (sp.haz && sp.zw > z && sp.zw < z + 9000) drawSprite(sp);
      ctx.globalAlpha = 1;
    }
    if (o.spotted && o.spotted.size) {
      const blink = Math.floor((o.t || 0) / 160) % 2 === 0;
      for (const r of drawnHaz) {
        if (!o.spotted.has(r.id)) continue;
        ctx.strokeStyle = blink ? '#ffcf5a' : '#ff3b30';
        ctx.lineWidth = 1;
        ctx.strokeRect(Math.round(r.x) - 1.5, Math.round(r.y) - 1.5, Math.round(r.w) + 3, Math.round(r.h) + 3);
        ctx.fillStyle = ctx.strokeStyle;
        const ax = Math.round(r.x + r.w / 2);
        const ay = Math.round(r.y) - 4;
        ctx.fillRect(ax - 2, ay - 3, 5, 2);
        ctx.fillRect(ax - 1, ay - 1, 3, 1);
        ctx.fillRect(ax, ay, 1, 1);
      }
    }

    if (dusk > 0.5) drawNight(o, busScreenY, dusk);
    if (o.flash && o.t - o.flash < 220) {
      ctx.fillStyle = 'rgba(255,60,60,0.28)';
      ctx.fillRect(0, 0, W, H);
    }
    ctx.restore();
    if (o.splat && o.splat.n > 0) drawSplat(o.splat);
    return { busScreenY: busScreenY / H };
  }

  function drawSky(tod, hz) {
    const g = ctx.createLinearGradient(0, 0, 0, hz);
    g.addColorStop(0, tod.sky[0]);
    g.addColorStop(1, tod.sky[1]);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, Math.ceil(hz) + 2);
    // sun — lower and redder as the day goes on
    const sunY = hz * (0.25 + tod.dusk * 0.62);
    const sunX = W * 0.72 - skyOff * 6;
    ctx.fillStyle = tod.sun;
    const sx = ((sunX % (W * 1.6)) + W * 1.6) % (W * 1.6) - W * 0.3;
    ctx.beginPath();
    ctx.arc(Math.round(sx), Math.round(sunY), 9, 0, Math.PI * 2);
    ctx.fill();
    // far ranges, then near rolling hills (parallax on bends)
    hills(hz, 16, 0.35, mixColor(tod.sky[1], '#4a5d7a', 0.55 - tod.dusk * 0.2), 0.045, 1.0);
    hills(hz, 10, 0.75, mixColor(tod.ground[1], '#2f4a2a', 0.45 + tod.dusk * 0.3), 0.09, 2.3);
  }

  function hills(hz, amp, par, col, freq, phase) {
    ctx.fillStyle = col;
    const off = skyOff * 40 * par;
    for (let x = 0; x < W; x++) {
      const xx = x + off;
      const h = amp * (0.55 + 0.45 * Math.sin(xx * freq + phase) * Math.sin(xx * freq * 0.37 + phase * 2));
      ctx.fillRect(x, Math.round(hz - h), 1, Math.ceil(h) + 2);
    }
  }

  function drawSegment(seg, track, tod, forkSeg, camXW, dusk) {
    const { i, s1, s2, y1, y2, c1, c2 } = seg;
    const band = Math.floor(i / RUMBLE) % 2;
    const zw = i * SEG;
    const yTop = Math.floor(y2);
    const yBot = Math.ceil(y1);
    // grass across the whole width
    ctx.fillStyle = tod.ground[band];
    ctx.fillRect(0, yTop, W, yBot - yTop + 1);

    const carpark = zw >= track.parkZ - PHYS.PARK_LEAD && zw < track.endZ + SEG * 10;
    const roadCol = carpark ? (band ? '#b0956a' : '#a88d62') : band ? '#615d5a' : '#5a5653';
    const branches = i > forkSeg ? [-1, 1] : [0];
    for (const b of branches) {
      if (b !== 0 && i > forkSeg + 80 && b !== (track.forkSide || 1)) continue;
      const k = b ? b * forkK(i, forkSeg) : 0;
      const k2 = b ? b * forkK(i + 1, forkSeg) : 0;
      const x1 = W / 2 + s1 * (c1 + (k - camXW) * ROAD_W) * (W / 2);
      const x2 = W / 2 + s2 * (c2 + (k2 - camXW) * ROAD_W) * (W / 2);
      const w1 = s1 * ROAD_W * (W / 2);
      const w2 = s2 * ROAD_W * (W / 2);
      const r1 = w1 / 8;
      const r2 = w2 / 8;
      // dirt shoulder, rumble, road
      quad(x1 - w1 - r1 * 1.6, y1, x1 + w1 + r1 * 1.6, x2 - w2 - r2 * 1.6, y2, x2 + w2 + r2 * 1.6, band ? '#a0603a' : '#9a5a35');
      if (!carpark) quad(x1 - w1 - r1, y1, x1 + w1 + r1, x2 - w2 - r2, y2, x2 + w2 + r2, band ? '#efe6d6' : '#b8322f');
      quad(x1 - w1, y1, x1 + w1, x2 - w2, y2, x2 + w2, roadCol);
      if (!carpark && band) {
        const l1 = w1 / 40;
        const l2 = w2 / 40;
        quad(x1 - l1, y1, x1 + l1, x2 - l2, y2, x2 + l2, '#e9e4d8');
      }
      if (carpark) {
        // the bay: side lines, the stop line and a green "perfect" band
        const bz = track.parkZ;
        if (zw >= bz - PHYS.PARK_OK && zw <= bz + PHYS.PARK_OK) {
          const l1 = w1 / 16;
          const l2 = w2 / 16;
          for (const bx of [-0.62, 0.62]) {
            const ax1 = x1 + bx * w1;
            const ax2 = x2 + bx * w2;
            quad(ax1 - l1, y1, ax1 + l1, ax2 - l2, y2, ax2 + l2, '#f4f1e8');
          }
          if (Math.abs(zw - bz) <= PHYS.PARK_PERFECT) {
            ctx.globalAlpha = 0.5;
            quad(x1 - w1 * 0.6, y1, x1 + w1 * 0.6, x2 - w2 * 0.6, y2, x2 + w2 * 0.6, '#5fdc8a');
            ctx.globalAlpha = 1;
          }
          if (zw <= bz + SEG && zw + SEG > bz - SEG) {
            quad(x1 - w1 * 0.62, y1, x1 + w1 * 0.62, x2 - w2 * 0.62, y2, x2 + w2 * 0.62, '#ffffff');
          }
        }
      }
    }
    if (dusk > 0) {
      ctx.fillStyle = `rgba(20,10,40,${dusk * 0.35})`;
      ctx.fillRect(0, yTop, W, yBot - yTop + 1);
    }
  }

  function quad(x1, y1, x2, x3, y3, x4, col) {
    ctx.fillStyle = col;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y1);
    ctx.lineTo(x4, y3);
    ctx.lineTo(x3, y3);
    ctx.closePath();
    ctx.fill();
  }

  function drawSprite(sp) {
    const img = S[sp.key];
    if (!img || !img.width) return;
    const ww = WORLD_W[sp.key] ?? 0.4;
    const w = sp.s * ww * ROAD_W * (W / 2);
    if (w < 0.6) return;
    const h = (w * img.height) / img.width;
    const x = Math.round(sp.x - w / 2);
    let y = sp.y - h - (sp.hop ? sp.hop * sp.s * 900 : 0);
    if (sp.key === 'pothole') y = sp.y - h * 0.6;
    // clip behind hills
    const clipH = sp.clip != null ? Math.max(0, Math.min(h, sp.clip - y)) : h;
    if (clipH <= 0) return;
    const srcH = (img.height * clipH) / h;
    const rect = { x, y, w, h: clipH };
    if (sp.flip) {
      ctx.save();
      ctx.translate(x + w, 0);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, img.width, srcH, 0, Math.round(y), Math.max(1, Math.round(w)), Math.round(clipH));
      ctx.restore();
    } else {
      ctx.drawImage(img, 0, 0, img.width, srcH, x, Math.round(y), Math.max(1, Math.round(w)), Math.round(clipH));
    }
    return rect;
  }

  function drawBus(o, by, dusk) {
    const img = S.busRear;
    if (!img || !img.width) return;
    const bw = img.width;
    const bh = img.height;
    const off = Math.abs(o.x) > 1.02;
    const bounce = off ? Math.round(Math.random() * 2) : Math.round(Math.sin(o.t / 90) * 0.5 * (o.v / PHYS.MAX_V));
    const bx = W / 2 + (o.steer || 0) * 3;
    const tilt = clamp(o.tilt || 0, -0.35, 0.35);
    // Small enough that the road ahead shows over the roof; a short road view
    // (passengers) gets a smaller bus still.
    const sc = clamp(H / 330, 0.4, 0.72);
    ctx.save();
    ctx.translate(Math.round(bx), Math.round(by - 2 + bounce));
    ctx.rotate(tilt);
    ctx.scale(sc, sc);
    // shadow
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(-bw / 2 + 2, -3, bw - 4, 5);
    ctx.drawImage(img, Math.round(-bw / 2), -bh, bw, bh);
    // brake lights
    if (o.brake || dusk > 0.5) {
      ctx.fillStyle = o.brake ? '#ff2b2b' : 'rgba(255,60,60,0.75)';
      ctx.fillRect(Math.round(-bw / 2) + 5, -bh + 50, 5, 9);
      ctx.fillRect(Math.round(bw / 2) - 10, -bh + 50, 5, 9);
      if (o.brake) {
        ctx.fillStyle = 'rgba(255,40,40,0.25)';
        ctx.fillRect(Math.round(-bw / 2) + 1, -bh + 46, 13, 17);
        ctx.fillRect(Math.round(bw / 2) - 14, -bh + 46, 13, 17);
      }
    }
    ctx.restore();
  }

  function drawNight(o, by, dusk) {
    // darken everything except a headlight pool ahead of the bus
    const a = (dusk - 0.5) * 1.1;
    const g = ctx.createRadialGradient(W / 2, by - H * 0.22, 6, W / 2, by - H * 0.2, W * 0.75);
    g.addColorStop(0, 'rgba(255,240,180,0)');
    g.addColorStop(0.45, `rgba(10,6,30,${a * 0.35})`);
    g.addColorStop(1, `rgba(10,6,30,${a * 0.85})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `rgba(255,236,170,${0.1 + a * 0.08})`;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 22, by - 30);
    ctx.lineTo(W / 2 + 22, by - 30);
    ctx.lineTo(W / 2 + 60, by - H * 0.42);
    ctx.lineTo(W / 2 - 60, by - H * 0.42);
    ctx.closePath();
    ctx.fill();
  }

  function drawSplat(sp) {
    const rnd = mulberry32(sp.seed || 7);
    for (let i = 0; i < sp.n; i++) {
      const x = 10 + rnd() * (W - 20);
      const y = 8 + rnd() * (H * 0.6);
      const r = 8 + rnd() * 14;
      ctx.fillStyle = 'rgba(110,12,36,0.88)';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(150,25,55,0.9)';
      ctx.beginPath();
      ctx.arc(x - r * 0.25, y - r * 0.25, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      for (let d = 0; d < 3; d++) {
        const dx = x - r * 0.6 + rnd() * r * 1.2;
        ctx.fillStyle = 'rgba(110,12,36,0.85)';
        ctx.fillRect(Math.round(dx), Math.round(y), 2, Math.round(r * (0.8 + rnd() * 1.4)));
      }
    }
  }

  /** Hazard under a tap at (fx, fy), as fractions of the canvas. */
  function pick(fx, fy) {
    const px = fx * W;
    const py = fy * H;
    let best = null;
    let bestD = 1e9;
    for (const r of drawnHaz) {
      const pad = Math.max(6, r.w * 0.6);
      if (px < r.x - pad || px > r.x + r.w + pad || py < r.y - pad || py > r.y + r.h + pad) continue;
      const d = Math.hypot(px - (r.x + r.w / 2), py - (r.y + r.h / 2));
      if (d < bestD) {
        bestD = d;
        best = r.id;
      }
    }
    return best;
  }

  resize();
  return { render, resize, setArt, pick, get height() { return H; } };
}

function mixColor(a, b, t) {
  const pa = hex(a);
  const pb = hex(b);
  const m = pa.map((v, i) => Math.round(v + (pb[i] - v) * t));
  return `rgb(${m[0]},${m[1]},${m[2]})`;
}
function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
