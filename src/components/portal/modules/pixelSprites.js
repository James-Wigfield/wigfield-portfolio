/* ============================================================================
   PIXEL SPRITES — the studio's built-in example animations (pure data)
   ----------------------------------------------------------------------------
   Generated in-app so the GIF studio works out of the box. Kept framework-free
   and separate from the view so (a) the art can be unit-tested headlessly and
   (b) the future Claude Code / MCP wrapper can reuse the SAME builders to emit a
   sprite in the shape the studio + encoder expect (see pixelGif.js):

     { id, name, width, height, palette[], transparentIndex, frames[][], delayMs }
   ========================================================================== */

// Build `count` frames of a w×h grid from a per-pixel function that returns a
// palette index (0 = transparent by convention).
export function buildFrames(w, h, count, fn) {
  const frames = [];
  for (let t = 0; t < count; t++) {
    const f = new Array(w * h).fill(0);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) f[y * w + x] = fn(x, y, t, count) | 0;
    }
    frames.push(f);
  }
  return frames;
}

// Author a sprite from char-grids (one string per row). `map` maps a char to a
// hex colour; `transparent` is the empty char. This is the human-/MCP-friendly
// data format — exactly what a generator would emit.
export function spriteFromGrids({ id, name, map, transparent = '.', grids, delayMs = 200 }) {
  const palette = ['#000000']; // index 0 = transparent slot
  const lut = { [transparent]: 0 };
  for (const [ch, hex] of Object.entries(map)) {
    lut[ch] = palette.length;
    palette.push(hex);
  }
  const height = grids[0].length;
  const width = grids[0][0].length;
  const frames = grids.map((rows) => {
    const f = [];
    for (const row of rows) for (const ch of row) f.push(lut[ch] ?? 0);
    return f;
  });
  return { id, name, width, height, palette, transparentIndex: 0, frames, delayMs };
}

// Centre a small char-grid inside a W×H grid (so every built-in is a tidy square
// and the square size presets scale it without distortion).
export function centerPad(rows, W, H, fill = '.') {
  const w = rows[0].length;
  const h = rows.length;
  const px = Math.floor((W - w) / 2);
  const py = Math.floor((H - h) / 2);
  const out = [];
  for (let y = 0; y < H; y++) {
    let line = '';
    for (let x = 0; x < W; x++) {
      const sx = x - px;
      const sy = y - py;
      line += sy >= 0 && sy < h && sx >= 0 && sx < w ? rows[sy][sx] : fill;
    }
    out.push(line);
  }
  return out;
}

// 1 · BOUNCE — a teal ball with squash-on-impact + a stretching ground shadow.
const BOUNCE = (() => {
  const W = 16, H = 16, T = 8;
  const cx = 7.5, topY = 3, floorY = 14, R = 3.4;
  const frames = buildFrames(W, H, T, (x, y, t) => {
    const phase = (1 - Math.cos((2 * Math.PI * t) / T)) / 2; // 0 top → 1 floor → 0
    const squash = phase > 0.8;
    const rx = squash ? R + 1.4 : R;
    const ry = squash ? R - 1.3 : R;
    const cy = topY + (floorY - ry - topY) * phase;
    // ball (drawn over the shadow)
    const bx = (x - cx) / rx;
    const by = (y - cy) / ry;
    const d2 = bx * bx + by * by;
    if (d2 <= 1) {
      const hx = x - (cx - 1.2);
      const hy = y - (cy - 1.3);
      if (hx * hx + hy * hy <= 1.6) return 2; // highlight
      return d2 > 0.58 ? 3 : 1; // rim : fill
    }
    // ground shadow (grows as the ball nears the floor)
    const srx = 2 + 3 * phase;
    const sdx = (x - cx) / srx;
    const sdy = (y - (floorY + 0.6)) / 1.1;
    if (sdx * sdx + sdy * sdy <= 1) return 4;
    return 0;
  });
  return {
    id: 'bounce',
    name: 'Bounce',
    width: W,
    height: H,
    palette: ['#000000', '#15a292', '#8af0e2', '#0b5d52', '#9fb9bf'],
    transparentIndex: 0,
    frames,
    delayMs: 80,
  };
})();

// 2 · PULSE — two concentric rings rippling out of a pulsing core (on-brand
// "signal"). Two rings half a cycle apart so the loop is seamless.
const PULSE = (() => {
  const W = 16, H = 16, T = 8;
  const cx = 7.5, cy = 7.5;
  const frames = buildFrames(W, H, T, (x, y, t) => {
    const dist = Math.hypot(x - cx, y - cy);
    const coreR = 1.5 + 0.7 * (0.5 + 0.5 * Math.sin((2 * Math.PI * t) / T));
    if (dist <= coreR) return 1; // core
    for (let i = 0; i < 2; i++) {
      const rr = ((t / T + i * 0.5) % 1) * 9;
      if (rr > 1 && Math.abs(dist - rr) < 1.1) {
        const k = rr / 9;
        return k < 0.4 ? 2 : k < 0.72 ? 3 : 4;
      }
    }
    return 0;
  });
  return {
    id: 'pulse',
    name: 'Pulse',
    width: W,
    height: H,
    palette: ['#000000', '#15a292', '#8af0e2', '#3fbfae', '#bfeee7'],
    transparentIndex: 0,
    frames,
    delayMs: 90,
  };
})();

// 3 · INVADER — the classic 2-frame crab, authored as char-grids to show the
// data format a generator would emit, centred in a 16×16 field.
const INVADER = (() => {
  const A = [
    '..#.....#..',
    '...#...#...',
    '..#######..',
    '.##.###.##.',
    '###########',
    '#.#######.#',
    '#.#.....#.#',
    '...##.##...',
  ];
  const B = [
    '..#.....#..',
    '...#...#...',
    '..#######..',
    '.##.###.##.',
    '###########',
    '.#######.#.',
    '..#.....#..',
    '.#.......#.',
  ];
  return spriteFromGrids({
    id: 'invader',
    name: 'Invader',
    map: { '#': '#15a292' },
    grids: [centerPad(A, 16, 16), centerPad(B, 16, 16)],
    delayMs: 280,
  });
})();

// 4 · FOREST WALK — a 128×128 scene: a hooded, cloaked medieval traveller with a
// staff walking (8-frame articulated cycle) through a parallax-scrolling forest.
// Fully procedural — hand-authoring a 128² × 8-frame scene isn't feasible.
//
// SEAMLESS LOOP: every scrolling layer scrolls EXACTLY one period over the cycle
// (frames × speed = period) and each period is identical, so frame 8 ≡ frame 0.
// (Per-cell random variation would shift by a cell each loop → popping, so the
// layers are fixed patterns, with depth coming from parallax + colour, not noise.)
const FOREST_WALK = (() => {
  const W = 128, H = 128, FRAMES = 8, GROUND = 96;

  // palette (index → hex); burgundy cloak so the figure pops on green forest
  const palette = [
    '#8fc0db', '#b6d8e8', '#d9eef4', // 0 sky-top  1 sky-mid  2 sky-horizon
    '#fff3c4',                        // 3 sun
    '#2f5a4d', '#38695a',             // 4 far tree 5 far tree-lit
    '#3f8a4f', '#5cab66', '#2c6b3c',  // 6 foliage  7 foliage-hi 8 foliage-sh
    '#6b4a30', '#4e3420',             // 9 trunk   10 trunk-sh
    '#7a5a39', '#5f4528', '#4f8f3f', '#67a84e', // 11 ground 12 ground-sh 13 grass 14 grass-hi
    '#8a4a3a', '#5e2e24', '#a86250',  // 15 cloak  16 cloak-sh 17 cloak-hi
    '#4a3526', '#38271b', '#271a10',  // 18 leg    19 leg-far  20 boot
    '#7a4036', '#1c160e', '#d8a87c',  // 21 hood   22 face-shadow 23 skin
    '#6b4a2f', '#8a6b3f',             // 24 staff  25 staff-knob
  ];
  const SKY1 = 0, SKY2 = 1, SKY3 = 2, SUN = 3, FAR1 = 4, FAR2 = 5,
    FOL = 6, FOLHI = 7, FOLSH = 8, TRUNK = 9, TRUNKSH = 10,
    GROUNDC = 11, GROUNDSH = 12, GRASS = 13, GRASSHI = 14,
    CLOAK = 15, CLOAKSH = 16, CLOAKHI = 17, LEG = 18, LEG2 = 19, BOOT = 20,
    HOOD = 21, FACE = 22, SKIN = 23, STAFF = 24, STAFFK = 25;

  const mod = (n, m) => ((n % m) + m) % m;
  const segDist = (px, py, ax, ay, bx, by) => {
    const dx = bx - ax, dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  };

  // ── forest layers ──
  const Pfar = 24, vFar = Pfar / FRAMES;    // far treeline  (3 px/frame)
  const Pnear = 48, vNear = Pnear / FRAMES; // near trees + ground (6 px/frame)

  const farTree = (wx, y) => {
    const lx = mod(wx, Pfar) - Pfar / 2;
    const top = GROUND - 16;
    if (y < top || y >= GROUND) return 0;
    const hw = 1.5 + 6.5 * ((y - top) / (GROUND - top));
    if (Math.abs(lx) > hw) return 0;
    return (mod(wx, 3) === 0 || y < top + 3) ? FAR2 : FAR1;
  };
  const blobCanopy = (cxp, y, cx, canCy, scale) => {
    const blobs = [
      [0, canCy, 12], [-8, canCy + 7, 9], [8, canCy + 6, 9],
      [0, canCy + 12, 11], [-5, canCy - 6, 7], [6, canCy - 5, 7],
    ];
    for (const [bx, by, r0] of blobs) {
      const r = r0 * scale;
      const dx = cxp - cx - bx * scale, dy = y - by;
      if (dx * dx + dy * dy <= r * r) {
        if (dx + dy < -r * 0.5) return FOLHI;
        if (dx + dy > r * 0.7) return FOLSH;
        return FOL;
      }
    }
    return 0;
  };
  const nearLayer = (wx, y) => {
    const cxp = mod(wx, Pnear);
    const tcx = 12; // main tree
    if (y >= GROUND - 22 && y < GROUND && Math.abs(cxp - tcx) <= 2) return cxp < tcx ? TRUNKSH : TRUNK;
    let c = blobCanopy(cxp, y, tcx, GROUND - 40 + 12, 1);
    if (c) return c;
    const bcx = 36; // side bush
    if (y >= GROUND - 9 && y < GROUND && Math.abs(cxp - bcx) <= 1) return TRUNKSH;
    return blobCanopy(cxp, y, bcx, GROUND - 16, 0.5);
  };
  const background = (x, y, t) => {
    const farShift = t * vFar, nearShift = t * vNear;
    if (y >= GROUND) {
      if (y < GROUND + 3) return mod(x + nearShift, 8) < 2 ? GRASSHI : GRASS;
      const f = mod(x + nearShift, 16);
      if (f === 0 || f === 1) return GROUNDSH;
      if (mod(x * 3 + y * 5 + nearShift, 48) < 2) return GROUNDSH; // periodic pebbles
      return GROUNDC;
    }
    const nt = nearLayer(x + nearShift, y);
    if (nt) return nt;
    const ft = farTree(x + farShift, y);
    if (ft) return ft;
    if (Math.hypot(x - 99, y - 22) < 9) return SUN;
    if (y < 34) return SKY1;
    if (y < 66) return SKY2;
    return SKY3;
  };

  // ── walk-cycle character (articulated; drawn over the scene) ──
  const L1 = 9, L2 = 9, TAMP = 0.55, FBASE = 0.1, FAMP = 1.0, FPH = -0.05, BOB = 3.0, SWAY = 1.5;
  const drawCharacter = (buf, t) => {
    const set = (x, y, c) => {
      const xi = Math.round(x), yi = Math.round(y);
      if (xi >= 0 && xi < W && yi >= 0 && yi < H) buf[yi * W + xi] = c;
    };
    const disk = (cx, cy, r, c) => {
      for (let y = Math.floor(cy - r); y <= cy + r; y++)
        for (let x = Math.floor(cx - r); x <= cx + r; x++)
          if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) set(x, y, c);
    };
    const capsule = (ax, ay, bx, by, r, c) => {
      for (let y = Math.floor(Math.min(ay, by) - r); y <= Math.max(ay, by) + r; y++)
        for (let x = Math.floor(Math.min(ax, bx) - r); x <= Math.max(ax, bx) + r; x++)
          if (segDist(x, y, ax, ay, bx, by) <= r) set(x, y, c);
    };

    const cx0 = 46;
    const p = t / FRAMES;
    const e = -Math.cos(4 * Math.PI * p);
    const hipY = GROUND - 17 - BOB * 0.5 * e;
    const shoulderX = cx0 + 2, shoulderY = hipY - 13;

    // ground shadow
    for (let x = cx0 - 9; x <= cx0 + 11; x++) {
      const dx = (x - (cx0 + 1)) / 10;
      if (dx * dx <= 1) { set(x, GROUND + 1, GROUNDSH); if (Math.abs(dx) < 0.6) set(x, GROUND + 2, GROUNDSH); }
    }

    const leg = (phase, hipX) => {
      const th1 = TAMP * Math.cos(2 * Math.PI * phase);
      const flex = FBASE + FAMP * Math.max(0, Math.sin(2 * Math.PI * (phase + FPH)));
      const th2 = th1 - flex;
      const kx = hipX + L1 * Math.sin(th1), ky = hipY + L1 * Math.cos(th1);
      return { kx, ky, fx: kx + L2 * Math.sin(th2), fy: ky + L2 * Math.cos(th2) };
    };
    const drawLeg = (lg, legc) => {
      capsule(cx0, hipY, lg.kx, lg.ky, 3, legc);
      capsule(lg.kx, lg.ky, lg.fx, lg.fy, 2.4, legc);
      capsule(lg.fx, lg.fy, lg.fx + 2, lg.fy, 2.2, BOOT);
    };
    drawLeg(leg(p + 0.5, cx0 - 1), LEG2); // far leg
    drawLeg(leg(p, cx0 + 1), LEG);        // near leg

    // cloak (covers torso + thighs; lower legs show below the hem)
    const hemY = hipY + 8, topY = shoulderY - 2;
    for (let y = Math.floor(topY); y <= hemY; y++) {
      const f = (y - topY) / (hemY - topY);
      const spine = shoulderX + (cx0 - shoulderX) * f;
      const sway = SWAY * Math.sin(2 * Math.PI * p) * f;
      let hw = 3.4 + 4.6 * f;
      if (y < shoulderY + 2) hw *= 0.7;
      const left = spine - hw + sway, right = spine + hw + sway;
      for (let x = Math.floor(left); x <= right; x++) {
        let c = CLOAK;
        if (x < left + 1.6) c = CLOAKSH;
        else if (x > right - 1.6) c = CLOAKHI;
        set(x, y, c);
      }
    }
    for (let x = Math.floor(shoulderX - 3); x <= shoulderX + 3; x++) set(x, hipY - 1, CLOAKSH); // belt

    // hood + head
    const hx = shoulderX + 1, hy = shoulderY - 6;
    disk(hx, hy, 4.2, HOOD);
    capsule(hx - 2.5, hy - 2.5, hx - 4, hy + 3, 1.5, HOOD); // hood peak
    disk(hx + 1.6, hy + 1, 2.6, FACE);
    set(hx + 3, hy + 1, SKIN);
    set(hx + 2, hy + 1, SKIN);

    // staff (held in front, bobs with the body)
    const handX = shoulderX + 4, handY = hipY - 1;
    capsule(handX, handY, cx0 + 12, GROUND + 1, 1.0, STAFF);
    disk(handX, handY - 1, 1.4, STAFFK);
  };

  const frames = [];
  for (let t = 0; t < FRAMES; t++) {
    const buf = new Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) buf[y * W + x] = background(x, y, t);
    drawCharacter(buf, t);
    frames.push(buf);
  }
  return { id: 'forest-walk', name: 'Forest Walk', width: W, height: H, palette, transparentIndex: null, frames, delayMs: 110 };
})();

export const EXAMPLES = [BOUNCE, PULSE, INVADER, FOREST_WALK];
