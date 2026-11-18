// PARTICLE LIFE — six species on a torus, each pair with its own attraction
// coefficient a(i,j) which is NOT equal to a(j,i). Below the repulsion core
// every pair pushes apart regardless of species, which is what stops the
// attractive pairs collapsing to a point. Asymmetry is the whole engine: it
// makes chases, orbits and shelled aggregates possible.
//   f(q) = q/beta - 1                            for q < beta
//   f(q) = a * (1 - |2q - 1 - beta| / (1 - beta)) for beta <= q < 1
// with q = distance / rmax.
import { makeRng } from '../lib/rng.js';
import { Surface } from '../lib/surface.js';
import { hex, pack } from '../lib/palette.js';

const DT = 0.02;
const K = 6; // species
const TARGET_CELLS = 480000;

// half-stencil: self cell, then east, south-west, south, south-east
const HSX = [0, 1, -1, 0, 1];
const HSY = [0, 0, 1, 1, 1];

const SPECIES = [
  { name: 'rosea', hex: '#d8607f' },
  { name: 'flava', hex: '#e0a54a' },
  { name: 'muscosa', hex: '#93b96b' },
  { name: 'caerulea', hex: '#5f9fc8' },
  { name: 'ossea', hex: '#cfc7b4' },
  { name: 'aeruginosa', hex: '#45b3a0' },
];

const BG = pack(9, 9, 8);

// Two tables kept from a search over random matrices: 60 candidates were run
// for 650 steps each and scored on how clustered and how mobile they stayed;
// these two were then rendered and chosen by eye. Rows are the acting caste,
// columns the caste acted upon, so the asymmetry is visible in the source.
const TABLES = {
  shells: [
    [-0.26, -0.20, -0.12, 0.95, 0.41, -0.62],
    [-0.95, -0.37, 0.47, -0.98, 0.11, -0.01],
    [-0.64, -0.09, 0.72, -0.13, -0.41, 0.43],
    [0.58, 0.73, 0.34, 0.45, 0.66, -0.49],
    [0.23, -0.55, 0.70, 0.90, -0.60, -0.53],
    [0.84, 0.56, 0.92, -0.66, -0.08, -0.73],
  ],
  diatoms: [
    [0.93, -0.03, -0.34, -0.40, 0.71, 0.45],
    [-0.12, 0.41, -0.19, -0.13, 0.25, -0.58],
    [-0.20, -0.83, 0.68, 0.47, -0.84, 0.04],
    [0.76, 0.68, -0.97, -0.93, -0.46, -0.70],
    [0.91, 0.05, 0.95, -0.82, 0.36, 0.80],
    [0.56, -0.43, -0.86, 0.26, -0.60, 0.50],
  ],
};

export const meta = {
  id: 'particle-life',
  name: 'Particle Life',
  latin: 'Hexachroma affinis',
  accession: 'AL·0631',
  plate: 'IV',
  described: 2017,
  accent: '#d8607f',
  note: 'Six castes with a lopsided table of affinities. Look for chase-cycles that never close, and for aggregates that grow a shell of one caste around a core of another.',
  source: 'Ventrella, J. (2017) Clusters, and Mohr, T. (2022) Particle Life. Force law after Mohr.',
};

export function create({ cells = TARGET_CELLS } = {}) {
  const params = [
    { key: 'count', label: 'population', min: 1000, max: 12000, step: 250, value: 4000, integer: true },
    { key: 'rmax', label: 'interaction radius', min: 0.04, max: 0.2, step: 0.005, value: 0.1 },
    { key: 'force', label: 'force factor', min: 1, max: 40, step: 0.5, value: 10 },
    { key: 'friction', label: 'friction', min: 0.5, max: 0.98, step: 0.005, value: 0.85 },
    { key: 'beta', label: 'repulsion core', min: 0.1, max: 0.5, step: 0.01, value: 0.3 },
    { key: 'persist', label: 'plate persistence', min: 0, max: 0.92, step: 0.02, value: 0.55 },
  ];
  const p = {};
  for (const d of params) p[d.key] = d.value;

  // world: height 1, width = viewport aspect
  let worldW = 1.78, worldH = 1;
  let nx = 17, ny = 10, cw = 0.1, ch = 0.1;
  let count = 0;
  let px = null, py = null, vx = null, vy = null, sp = null;
  let fxs = null, fys = null;
  let start = null, items = null, counts = null;
  let surf = null, SW = 0, SH = 0;
  let discDX = null, discDY = null, discW = null;
  let rng = makeRng();
  let speed = 0;
  const mat = new Float32Array(K * K);
  const colours = SPECIES.map((s) => hex(s.hex));

  function rerollMatrix(kind = 'random') {
    if (TABLES[kind]) {
      const t = TABLES[kind];
      for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) mat[i * K + j] = t[i][j];
    } else if (kind === 'chase') {
      // i chases i+1 and flees i-1: cyclic and maximally asymmetric
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          mat[i * K + j] = i === j ? 0.55
            : j === (i + 1) % K ? 0.95
              : j === (i + K - 1) % K ? -0.75
                : -0.1 + rng() * 0.2;
        }
      }
    } else {
      for (let i = 0; i < K * K; i++) mat[i] = Math.round((rng() * 2 - 1) * 100) / 100;
    }
  }

  function allocParticles(n) {
    count = n;
    px = new Float32Array(n); py = new Float32Array(n);
    vx = new Float32Array(n); vy = new Float32Array(n);
    sp = new Uint8Array(n);
    items = new Uint32Array(n);
    fxs = new Float32Array(n); fys = new Float32Array(n);
    scatter();
  }

  function scatter() {
    for (let i = 0; i < count; i++) {
      px[i] = rng() * worldW;
      py[i] = rng() * worldH;
      vx[i] = 0; vy[i] = 0;
      sp[i] = rng.int(K);
    }
  }

  function bands() {
    // one vertical band per species: segregation has to be undone, not given
    for (let i = 0; i < count; i++) {
      const s = rng.int(K);
      sp[i] = s;
      px[i] = ((s + rng()) / K) * worldW;
      py[i] = rng() * worldH;
      vx[i] = 0; vy[i] = 0;
    }
  }

  function buildCells() {
    nx = Math.max(4, Math.floor(worldW / p.rmax));
    ny = Math.max(4, Math.floor(worldH / p.rmax));
    cw = worldW / nx;
    ch = worldH / ny;
    counts = new Uint32Array(nx * ny + 1);
    start = new Uint32Array(nx * ny + 1);
  }

  function buildSurface(aspect) {
    const h = Math.max(240, Math.round(Math.sqrt(cells / aspect)));
    const w = Math.max(240, Math.round(h * aspect));
    if (surf && w === SW && h === SH) return;
    if (surf) surf.dispose();
    SW = w; SH = h;
    surf = new Surface(SW, SH);
    surf.u32.fill(BG);
    // soft disc stamp, sized to the plate
    const rad = Math.max(1.4, SH * 0.0042);
    const ri = Math.ceil(rad);
    const dxs = [], dys = [], ws = [];
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > rad + 0.5) continue;
        const t = Math.max(0, Math.min(1, (rad + 0.5 - d) / 1.4));
        dxs.push(dx); dys.push(dy);
        ws.push(t * t * (3 - 2 * t));
      }
    }
    discDX = Int8Array.from(dxs);
    discDY = Int8Array.from(dys);
    discW = Float32Array.from(ws);
  }

  function setParam(key, val) {
    if (!(key in p)) return;
    if (key === 'count') {
      const n = Math.max(200, Math.round(val));
      p.count = n;
      const d = params.find((q) => q.key === 'count');
      if (d) d.value = n;
      allocParticles(n);
      return;
    }
    p[key] = val;
    const d = params.find((q) => q.key === key);
    if (d) d.value = val;
    if (key === 'rmax') buildCells();
  }

  const presets = [
    {
      name: 'shells',
      note: 'a kept table: cored aggregates that grow a shell of another caste',
      values: { rmax: 0.1, force: 10, friction: 0.85, beta: 0.3 },
      seed() { rerollMatrix('shells'); scatter(); },
    },
    {
      name: 'chase cycle',
      note: 'each caste pursues the next and flees the last',
      values: { rmax: 0.11, force: 12, friction: 0.86, beta: 0.3 },
      seed() { rerollMatrix('chase'); scatter(); },
    },
    {
      name: 'diatoms',
      note: 'a slow table: discrete ring organisms that hold their shape',
      values: { rmax: 0.1, force: 9, friction: 0.86, beta: 0.3 },
      seed() { rerollMatrix('diatoms'); scatter(); },
    },
    {
      name: 'random table',
      note: 'a fresh asymmetric matrix — most are dull, some are not',
      values: { rmax: 0.1, force: 10, friction: 0.85, beta: 0.3 },
      seed() { rerollMatrix('random'); scatter(); },
    },
  ];

  let current = 0;

  function applyPreset(i) {
    const pr = presets[Math.max(0, Math.min(presets.length - 1, i))];
    for (const k in pr.values) setParam(k, pr.values[k]);
    buildCells();
    pr.seed();
    current = presets.indexOf(pr);
  }

  const S = {
    ...meta,
    params,
    presets,

    // exposed so the panel can draw and edit the affinity table
    matrix: {
      size: K,
      species: SPECIES.map((s) => s.name),
      colours: SPECIES.map((s) => s.hex),
      get: (i, j) => mat[i * K + j],
      set: (i, j, v) => { mat[i * K + j] = Math.max(-1, Math.min(1, v)); },
      reroll: () => rerollMatrix('random'),
    },

    init(cwid, chei) {
      const aspect = (cwid || 16) / (chei || 9);
      worldW = aspect; worldH = 1;
      buildSurface(aspect);
      allocParticles(p.count);
      applyPreset(0);
    },

    step() {
      const rmax = p.rmax, beta = p.beta, fric = p.friction;
      const kick = rmax * p.force * DT;
      const rmax2 = rmax * rmax;
      const halfW = worldW / 2, halfH = worldH / 2;
      const nCells = nx * ny;

      // --- spatial hash by counting sort
      counts.fill(0);
      for (let i = 0; i < count; i++) {
        const c = ((py[i] / ch) | 0) * nx + ((px[i] / cw) | 0);
        counts[c < 0 ? 0 : c >= nCells ? nCells - 1 : c]++;
      }
      let acc = 0;
      for (let c = 0; c < nCells; c++) { start[c] = acc; acc += counts[c]; }
      start[nCells] = acc;
      const cursor = counts; // reuse as write cursors
      for (let c = 0; c < nCells; c++) cursor[c] = start[c];
      for (let i = 0; i < count; i++) {
        let c = ((py[i] / ch) | 0) * nx + ((px[i] / cw) | 0);
        c = c < 0 ? 0 : c >= nCells ? nCells - 1 : c;
        items[cursor[c]++] = i;
      }

      // --- pairwise force. Each unordered pair is visited once: within-cell
      // pairs plus four of the eight neighbours (the other four are covered
      // from the far side), and both reciprocal forces are applied on the
      // spot. Halves the distance work versus scanning 3x3 per particle.
      const invBeta = 1 / beta, invRest = 1 / (1 - beta);
      fxs.fill(0); fys.fill(0);
      for (let gy = 0; gy < ny; gy++) {
        for (let gx = 0; gx < nx; gx++) {
          const c = gy * nx + gx;
          const a0 = start[c], a1 = start[c + 1];
          if (a1 === a0) continue;
          for (let t = 0; t < 5; t++) {
            let d;
            if (t === 0) {
              d = c;
            } else {
              let hx = gx + HSX[t], hy = gy + HSY[t];
              if (hx < 0) hx += nx; else if (hx >= nx) hx -= nx;
              if (hy >= ny) hy -= ny;
              d = hy * nx + hx;
            }
            const b0 = start[d], b1 = start[d + 1];
            if (b1 === b0) continue;
            for (let k1 = a0; k1 < a1; k1++) {
              const i = items[k1];
              const xi = px[i], yi = py[i], rowi = sp[i] * K;
              const k2s = t === 0 ? k1 + 1 : b0;
              for (let k2 = k2s; k2 < b1; k2++) {
                const j = items[k2];
                let dx = px[j] - xi;
                if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
                let dy = py[j] - yi;
                if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
                const d2 = dx * dx + dy * dy;
                if (d2 >= rmax2 || d2 === 0) continue;
                const dist = Math.sqrt(d2);
                const q = dist / rmax;
                let fi, fj;
                if (q < beta) {
                  fi = q * invBeta - 1;
                  fj = fi;
                } else {
                  const shape = 1 - Math.abs(2 * q - 1 - beta) * invRest;
                  const sj = sp[j];
                  fi = mat[rowi + sj] * shape;
                  fj = mat[sj * K + sp[i]] * shape;
                }
                const ux = dx / dist, uy = dy / dist;
                fxs[i] += ux * fi; fys[i] += uy * fi;
                fxs[j] -= ux * fj; fys[j] -= uy * fj;
              }
            }
          }
        }
      }
      for (let i = 0; i < count; i++) {
        vx[i] = vx[i] * fric + fxs[i] * kick;
        vy[i] = vy[i] * fric + fys[i] * kick;
      }

      // --- integrate
      let sv = 0;
      for (let i = 0; i < count; i++) {
        let x = px[i] + vx[i] * DT;
        let y = py[i] + vy[i] * DT;
        if (x < 0) x += worldW; else if (x >= worldW) x -= worldW;
        if (y < 0) y += worldH; else if (y >= worldH) y -= worldH;
        px[i] = x; py[i] = y;
        sv += Math.abs(vx[i]) + Math.abs(vy[i]);
      }
      speed = sv / (2 * count);
    },

    paintInto(out) {
      const n = SW * SH;
      const keep = p.persist;
      if (keep <= 0.001) {
        out.fill(BG);
      } else {
        // fade towards the plate ground: a short exposure, not a trail toy
        const br = BG & 255, bg = (BG >>> 8) & 255, bb = (BG >>> 16) & 255;
        for (let i = 0; i < n; i++) {
          const v = out[i];
          const r = br + ((v & 255) - br) * keep;
          const g = bg + (((v >>> 8) & 255) - bg) * keep;
          const b = bb + (((v >>> 16) & 255) - bb) * keep;
          out[i] = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
        }
      }
      const sx = SW / worldW, sy = SH / worldH;
      const nOff = discW.length;
      // Alpha compositing, not addition: a cluster of forty particles must
      // still read as its own colour instead of clipping to white.
      for (let i = 0; i < count; i++) {
        const x = (px[i] * sx) | 0, y = (py[i] * sy) | 0;
        const c = colours[sp[i]];
        const cr = c[0], cg = c[1], cb = c[2];
        for (let k = 0; k < nOff; k++) {
          let xx = x + discDX[k];
          if (xx < 0) xx += SW; else if (xx >= SW) xx -= SW;
          let yy = y + discDY[k];
          if (yy < 0) yy += SH; else if (yy >= SH) yy -= SH;
          const idx = yy * SW + xx;
          const w = discW[k];
          const v = out[idx];
          const r = (v & 255) + (cr - (v & 255)) * w;
          const g = ((v >>> 8) & 255) + (cg - ((v >>> 8) & 255)) * w;
          const b = ((v >>> 16) & 255) + (cb - ((v >>> 16) & 255)) * w;
          out[idx] = 0xff000000 | ((b | 0) << 16) | ((g | 0) << 8) | (r | 0);
        }
      }
    },

    render(ctx) {
      S.paintInto(surf.u32);
      surf.blit(ctx, { smooth: true, mode: 'stretch' });
    },

    mapPointer(pxx, pyy, cwid, chei) { return surf.toLocal(pxx, pyy, cwid, chei, 'stretch'); },

    seed(nxn, nyn, strength) {
      // radial impulse: shove the neighbourhood outwards and watch it heal
      const cx = nxn * worldW, cy = nyn * worldH;
      const rad = p.rmax * 2.5;
      const halfW = worldW / 2, halfH = worldH / 2;
      for (let i = 0; i < count; i++) {
        let dx = px[i] - cx;
        if (dx > halfW) dx -= worldW; else if (dx < -halfW) dx += worldW;
        let dy = py[i] - cy;
        if (dy > halfH) dy -= worldH; else if (dy < -halfH) dy += worldH;
        const d = Math.hypot(dx, dy);
        if (d > rad || d === 0) continue;
        const f = (1 - d / rad) * strength * 12;
        vx[i] += (dx / d) * f;
        vy[i] += (dy / d) * f;
      }
    },

    reset() {
      rng = makeRng();
      presets[current].seed();
    },

    metric() {
      return { label: 'mean speed', value: speed, text: (speed * 1000).toFixed(1) };
    },

    // Read-only accessors. paintInto() plus these are what let the system be
    // rendered and measured outside a browser.
    field() { return { data: px, w: count, h: 1 }; },
    grab() { S.paintInto(surf.u32); return { data: surf.u32, w: SW, h: SH }; },
    stats() { return { speed, count, cells: nx * ny }; },
    state() { return { px, py, vx, vy, sp, worldW, worldH, rmax: p.rmax }; },
    applyPreset,
    get preset() { return current; },
    setParam,

    resize(cwid, chei) {
      const aspect = cwid / chei;
      const scale = aspect / worldW;
      for (let i = 0; i < count; i++) px[i] *= scale;
      worldW = aspect;
      buildCells();
      buildSurface(aspect);
    },

    dispose() {
      if (surf) surf.dispose();
      surf = null;
      px = py = vx = vy = sp = items = start = counts = fxs = fys = null;
    },
  };
  return S;
}
