// PRIMORDIAL PARTICLE SYSTEM — Schmickl, Stefanec & Crailsheim (2016).
// One motion law, no chemistry, no birth or death:
//   dphi = alpha + beta * N * sign(R - L)
//   x   += v * cos(phi),  y += v * sin(phi)
// N is the number of particles within the reaction radius (self included),
// L and R how many of them lie to the left and right of the heading. At
// alpha=180, beta=17, r=5, v=0.67 the population sorts itself into walled
// cells that grow, divide and repair. Colour is by N alone, at the paper's
// thresholds of 13 / 15 / 35, so the structure you see is the structure the
// particles are actually reacting to.
import { makeRng } from '../lib/rng.js';
import { Surface } from '../lib/surface.js';
import { hex, pack } from '../lib/palette.js';

const TARGET_CELLS = 480000;
const WORLD_H = 260;      // simulation units; r = 5 of these
const MAX_DENSITY = 20;   // particles per 100 units^2, sets the capacity
const BG = pack(9, 9, 8);

// Paper thresholds. Below 13 a particle is free; 13-14 is the outside of a
// wall; 15-34 is wall proper; 35 and up is the crowded interior of a junction.
const CLASS_COLOUR = ['#7ba85e', '#b08040', '#4a86b8', '#c85a86'];
const CLASS_NAME = ['free', 'edge', 'wall', 'core'];

export const meta = {
  id: 'pps',
  name: 'Primordial Particles',
  latin: 'Primordium schmicklii',
  accession: 'AL·0817',
  plate: 'V',
  described: 2016,
  accent: '#86b063',
  note: 'Free particles condense into walled cells; cells grow, split in two and reseal a puncture. Nothing here is coded for cells — only a turn rate that depends on how crowded the neighbourhood is.',
  source: 'Schmickl, T., Stefanec, M. & Crailsheim, K. (2016) How a life-like system emerges from a simple particle motion law. Scientific Reports 6, 37969.',
};

export function create({ cells = TARGET_CELLS } = {}) {
  const params = [
    { key: 'density', label: 'density', min: 1, max: MAX_DENSITY, step: 0.25, value: 8, unit: '/100u²' },
    { key: 'alpha', label: 'base turn α', min: 90, max: 270, step: 1, value: 180, unit: '°' },
    { key: 'beta', label: 'crowd turn β', min: 0, max: 40, step: 0.5, value: 17, unit: '°' },
    { key: 'r', label: 'reaction radius', min: 2, max: 12, step: 0.25, value: 5, unit: 'u' },
    { key: 'v', label: 'velocity', min: 0.1, max: 2, step: 0.01, value: 0.67, unit: 'u/step' },
  ];
  const p = {};
  for (const d of params) p[d.key] = d.value;

  let worldW = WORLD_H * 1.78, worldH = WORLD_H;
  let capacity = 0, count = 0;
  let px = null, py = null, ph = null;      // current
  let px2 = null, py2 = null, ph2 = null;   // next (ping-pong)
  let nb = null;                            // neighbour count per particle
  let start = null, counts = null, items = null;
  let nx = 0, ny = 0, cw = 0, ch = 0;
  let surf = null, SW = 0, SH = 0;
  let discDX = null, discDY = null, discW = null;
  let rng = makeRng();
  let structured = 0;
  const classes = CLASS_COLOUR.map(hex);

  function classOf(n) {
    return n < 13 ? 0 : n < 15 ? 1 : n < 35 ? 2 : 3;
  }

  function targetCount(density) {
    return Math.max(50, Math.round((worldW * worldH * density) / 100));
  }

  function allocate() {
    capacity = targetCount(MAX_DENSITY);
    px = new Float32Array(capacity); py = new Float32Array(capacity); ph = new Float32Array(capacity);
    px2 = new Float32Array(capacity); py2 = new Float32Array(capacity); ph2 = new Float32Array(capacity);
    nb = new Uint16Array(capacity);
    items = new Uint32Array(capacity);
  }

  function buildCells() {
    nx = Math.max(4, Math.floor(worldW / p.r));
    ny = Math.max(4, Math.floor(worldH / p.r));
    cw = worldW / nx;
    ch = worldH / ny;
    counts = new Uint32Array(nx * ny + 1);
    start = new Uint32Array(nx * ny + 1);
  }

  function scatter(density, box = 1) {
    count = Math.min(capacity, targetCount(density));
    const x0 = (worldW * (1 - box)) / 2, y0 = (worldH * (1 - box)) / 2;
    for (let i = 0; i < count; i++) {
      px[i] = x0 + rng() * worldW * box;
      py[i] = y0 + rng() * worldH * box;
      ph[i] = rng() * Math.PI * 2;
      nb[i] = 0;
    }
    syncDensity();
  }

  function syncDensity() {
    const d = (count * 100) / (worldW * worldH);
    p.density = Math.round(d * 4) / 4;
    const desc = params.find((q) => q.key === 'density');
    if (desc) desc.value = p.density;
  }

  function buildSurface(aspect) {
    const h = Math.max(240, Math.round(Math.sqrt(cells / aspect)));
    const w = Math.max(240, Math.round(h * aspect));
    if (surf && w === SW && h === SH) return;
    if (surf) surf.dispose();
    SW = w; SH = h;
    surf = new Surface(SW, SH);
    const rad = Math.max(1.3, SH * 0.0038);
    const ri = Math.ceil(rad);
    const dxs = [], dys = [], ws = [];
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > rad + 0.5) continue;
        const t = Math.max(0, Math.min(1, (rad + 0.5 - d) / 1.3));
        dxs.push(dx); dys.push(dy); ws.push(t * t * (3 - 2 * t));
      }
    }
    discDX = Int8Array.from(dxs);
    discDY = Int8Array.from(dys);
    discW = Float32Array.from(ws);
  }

  function setParam(key, val) {
    if (!(key in p)) return;
    if (key === 'density') {
      const want = Math.min(capacity, targetCount(val));
      if (want > count) {
        for (let i = count; i < want; i++) {
          px[i] = rng() * worldW; py[i] = rng() * worldH; ph[i] = rng() * Math.PI * 2; nb[i] = 0;
        }
      }
      count = want;
      p.density = val;
      const d = params.find((q) => q.key === 'density');
      if (d) d.value = val;
      return;
    }
    p[key] = val;
    const d = params.find((q) => q.key === key);
    if (d) d.value = val;
    if (key === 'r') buildCells();
  }

  const DEFAULTS = { alpha: 180, beta: 17, r: 5, v: 0.67 };

  const presets = [
    {
      name: 'field',
      note: 'paper defaults at density 10 — walled cells among free swimmers',
      values: { ...DEFAULTS, density: 10 },
      seed() { scatter(10); },
    },
    {
      name: 'crowded',
      note: 'density 14: cells jammed against their neighbours, walls shared',
      values: { ...DEFAULTS, density: 14 },
      seed() { scatter(14); },
    },
    {
      name: 'broken walls',
      note: 'β 25: walls can no longer close — arcs and edges, no cells',
      values: { ...DEFAULTS, beta: 25, density: 12 },
      seed() { scatter(12); },
    },
    {
      name: 'inoculum',
      note: 'the population dropped into the middle of the plate, jammed, relaxing',
      values: { ...DEFAULTS, density: 10 },
      seed() { scatter(10, 0.45); },
    },
  ];

  let current = 0;

  function applyPreset(i) {
    const pr = presets[Math.max(0, Math.min(presets.length - 1, i))];
    for (const k in pr.values) if (k !== 'density') setParam(k, pr.values[k]);
    buildCells();
    pr.seed();
    current = presets.indexOf(pr);
  }

  const S = {
    ...meta,
    params,
    presets,
    legend: CLASS_NAME.map((name, i) => ({
      name,
      colour: CLASS_COLOUR[i],
      range: ['N < 13', 'N 13–14', 'N 15–34', 'N ≥ 35'][i],
    })),

    init(cwid, chei) {
      const aspect = (cwid || 16) / (chei || 9);
      worldW = WORLD_H * aspect;
      worldH = WORLD_H;
      buildSurface(aspect);
      allocate();
      buildCells();
      applyPreset(0);
    },

    step() {
      const r = p.r, r2 = r * r, v = p.v;
      const alpha = (p.alpha * Math.PI) / 180;
      const beta = (p.beta * Math.PI) / 180;
      const halfW = worldW / 2, halfH = worldH / 2;
      const nCells = nx * ny;

      // --- spatial hash (counting sort)
      counts.fill(0);
      for (let i = 0; i < count; i++) {
        let c = ((py[i] / ch) | 0) * nx + ((px[i] / cw) | 0);
        counts[c < 0 ? 0 : c >= nCells ? nCells - 1 : c]++;
      }
      let acc = 0;
      for (let c = 0; c < nCells; c++) { start[c] = acc; acc += counts[c]; }
      start[nCells] = acc;
      for (let c = 0; c < nCells; c++) counts[c] = start[c];
      for (let i = 0; i < count; i++) {
        let c = ((py[i] / ch) | 0) * nx + ((px[i] / cw) | 0);
        c = c < 0 ? 0 : c >= nCells ? nCells - 1 : c;
        items[counts[c]++] = i;
      }

      // --- one synchronous update: count, turn, step
      let struct = 0;
      for (let i = 0; i < count; i++) {
        const xi = px[i], yi = py[i], hi = ph[i];
        const hx = Math.cos(hi), hy = Math.sin(hi);
        const gx0 = (xi / cw) | 0, gy0 = (yi / ch) | 0;
        let left = 0, right = 0;
        for (let oy = -1; oy <= 1; oy++) {
          let gy = gy0 + oy;
          if (gy < 0) gy += ny; else if (gy >= ny) gy -= ny;
          const base = gy * nx;
          for (let ox = -1; ox <= 1; ox++) {
            let gx = gx0 + ox;
            if (gx < 0) gx += nx; else if (gx >= nx) gx -= nx;
            const c = base + gx;
            const end = start[c + 1];
            for (let k = start[c]; k < end; k++) {
              const j = items[k];
              if (j === i) continue;
              let dx = px[j] - xi;
              if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
              let dy = py[j] - yi;
              if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
              if (dx * dx + dy * dy > r2) continue;
              // cross product of heading with the offset: sign gives the side
              if (hx * dy - hy * dx > 0) right++; else left++;
            }
          }
        }
        const n = left + right + 1; // the paper's N counts the particle itself
        nb[i] = n;
        if (n >= 15) struct++;
        const turn = alpha + beta * n * (right > left ? 1 : right < left ? -1 : 0);
        let nh = hi + turn;
        if (nh > Math.PI * 2) nh -= Math.PI * 2; else if (nh < 0) nh += Math.PI * 2;
        ph2[i] = nh;
        let nxp = xi + v * Math.cos(nh);
        let nyp = yi + v * Math.sin(nh);
        if (nxp < 0) nxp += worldW; else if (nxp >= worldW) nxp -= worldW;
        if (nyp < 0) nyp += worldH; else if (nyp >= worldH) nyp -= worldH;
        px2[i] = nxp; py2[i] = nyp;
      }
      let t = px; px = px2; px2 = t;
      t = py; py = py2; py2 = t;
      t = ph; ph = ph2; ph2 = t;
      structured = count ? struct / count : 0;
    },

    paintInto(out) {
      out.fill(BG);
      const sx = SW / worldW, sy = SH / worldH;
      const nOff = discW.length;
      for (let i = 0; i < count; i++) {
        const x = (px[i] * sx) | 0, y = (py[i] * sy) | 0;
        const c = classes[classOf(nb[i])];
        const cr = c[0], cg = c[1], cb = c[2];
        for (let k = 0; k < nOff; k++) {
          let xx = x + discDX[k];
          if (xx < 0) xx += SW; else if (xx >= SW) xx -= SW;
          let yy = y + discDY[k];
          if (yy < 0) yy += SH; else if (yy >= SH) yy -= SH;
          const idx = yy * SW + xx;
          const w = discW[k];
          const vv = out[idx];
          const rr = (vv & 255) + (cr - (vv & 255)) * w;
          const gg = ((vv >>> 8) & 255) + (cg - ((vv >>> 8) & 255)) * w;
          const bb = ((vv >>> 16) & 255) + (cb - ((vv >>> 16) & 255)) * w;
          out[idx] = 0xff000000 | ((bb | 0) << 16) | ((gg | 0) << 8) | (rr | 0);
        }
      }
    },

    render(ctx) {
      S.paintInto(surf.u32);
      surf.blit(ctx, { smooth: true, mode: 'stretch' });
    },

    mapPointer(pxx, pyy, cwid, chei) { return surf.toLocal(pxx, pyy, cwid, chei, 'stretch'); },

    seed(nxn, nyn, strength) {
      // inject free particles: they either join a wall or wander off
      const add = Math.min(capacity - count, Math.round(40 * strength));
      const cx = nxn * worldW, cy = nyn * worldH;
      const rad = p.r * 3;
      for (let k = 0; k < add; k++) {
        const a = rng() * Math.PI * 2, d = Math.sqrt(rng()) * rad;
        px[count] = (cx + Math.cos(a) * d + worldW) % worldW;
        py[count] = (cy + Math.sin(a) * d + worldH) % worldH;
        ph[count] = rng() * Math.PI * 2;
        nb[count] = 0;
        count++;
      }
      syncDensity();
    },

    reset() {
      rng = makeRng();
      presets[current].seed();
    },

    metric() {
      return { label: 'in structure', value: structured, text: (structured * 100).toFixed(1) + '%' };
    },

    // Read-only accessors. paintInto() plus these are what let the system be
    // rendered and measured outside a browser.
    field() { return { data: nb, w: count, h: 1 }; },
    stats() { return { count, structured, worldW, worldH }; },
    grab() { S.paintInto(surf.u32); return { data: surf.u32, w: SW, h: SH }; },
    applyPreset,
    get preset() { return current; },
    setParam,

    resize(cwid, chei) {
      const aspect = cwid / chei;
      const w = WORLD_H * aspect;
      const scale = w / worldW;
      for (let i = 0; i < count; i++) px[i] *= scale;
      worldW = w;
      buildCells();
      buildSurface(aspect);
      // The arrays keep the capacity they were allocated with, so a wider
      // plate just caps the top of the density dial rather than reallocating.
      count = Math.min(count, capacity);
      syncDensity();
    },

    dispose() {
      if (surf) surf.dispose();
      surf = null;
      px = py = ph = px2 = py2 = ph2 = nb = items = start = counts = null;
    },
  };
  return S;
}
