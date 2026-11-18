/* ============================================================================
   PROVENANCE: adapted from public/artificial-life/src/systems/lenia.js (the
   Specimen Cabinet, Plate I, Chan 2019). Never edit the original.

   What changed:
   - No torus and no FFT: the cabinet convolves a 256² torus in the Fourier
     domain, which needs a periodic power-of-two grid. Patches are neither,
     so this copy does the convolution DIRECTLY with a pruned ring kernel
     (taps with weight < 3 % of the peak dropped) read through the domain's
     halo table — the kernel reaches across seams into the neighbouring
     patches; masks and seamless edges read as empty.
   - It runs on its own HALF-RESOLUTION domain (ppm / 2): the kernel is the
     expensive part (~60–100 taps per cell) and Lenia's structures are large
     anyway. paint() upsamples bilinearly into the full-resolution buffer.
   - The kernel radius is in metres (≈ 0.28 m), so creatures keep their size.
   - Budget: if the owned cells × taps exceed the per-tick budget, Lenia
     steps every k-th tick (slower, never a stall).
   - Pure-black background; palette from life.leniaPalette if present, else
     life.gsPalette. Preset from life.leniaPreset if present, else labyrinth.
   ========================================================================== */

import { palette } from '../palettes.js';

const RING_WEIGHTS = [[1], [1, 0.5], [1, 2 / 3, 1 / 3]];

export const LENIA_PRESETS = {
  labyrinth: { T: 10, mu: 0.32, sigma: 0.045, kmu: 0.5, ksig: 0.15, rings: 1, seed: 'soup', density: 0.5, cell: 0.15 },
  soup: { T: 10, mu: 0.15, sigma: 0.017, kmu: 0.5, ksig: 0.15, rings: 1, seed: 'soup', density: 0.42, cell: 0.2 },
  bubbles: { T: 10, mu: 0.26, sigma: 0.036, kmu: 0.5, ksig: 0.15, rings: 1, seed: 'soup', density: 0.35, cell: 0.2 },
};
const R_METRES = 0.28;

export function createLenia({ rng, budget }) {
  let D = null; // fine domain (buffers)
  let C = null; // coarse domain (simulation)
  let owned = [];
  let ownedMask = null;
  let A = null, B = null; // length C.N + 1 (last cell is a permanent 0)
  let taps = null; // { dx: Int16Array, dy: Int16Array, w: Float32Array }
  let R = 6;
  const halo2 = new Map(); // patch idx → { HW, idx (with -1 → C.N), off: Int32Array tap offsets }
  let preset = 'labyrinth', pr = LENIA_PRESETS.labyrinth;
  let pal = palette('aurora');
  let every = 1, tickN = 0, mass = 0;

  function buildKernel() {
    R = Math.max(4, Math.min(9, Math.round(R_METRES * C.ppm)));
    const rings = Math.max(1, pr.rings | 0);
    const beta = RING_WEIGHTS[rings - 1];
    const dxs = [], dys = [], ws = [];
    let sum = 0, peak = 0;
    const twoSig2 = 2 * pr.ksig * pr.ksig;
    const raw = [];
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const r = Math.hypot(dx, dy) / R;
        if (r >= 1) continue;
        const br = r * rings;
        const idx = Math.min(rings - 1, br | 0);
        const q = br - (br | 0);
        const w = beta[idx] * Math.exp(-((q - pr.kmu) * (q - pr.kmu)) / twoSig2);
        raw.push([dx, dy, w]);
        if (w > peak) peak = w;
      }
    }
    for (const [dx, dy, w] of raw) {
      if (w < peak * 0.03) continue;
      dxs.push(dx);
      dys.push(dy);
      ws.push(w);
      sum += w;
    }
    taps = { dx: Int16Array.from(dxs), dy: Int16Array.from(dys), w: Float32Array.from(ws.map((w) => w / sum)) };
    halo2.clear();
  }

  function haloFor(pi) {
    if (halo2.has(pi)) return halo2.get(pi);
    const H = C.halo(pi, R + 1);
    const idx = Int32Array.from(H.idx, (v) => (v < 0 ? C.N : v));
    const off = new Int32Array(taps.w.length);
    for (let t = 0; t < off.length; t++) off[t] = taps.dy[t] * H.HW + taps.dx[t];
    const h = { HW: H.HW, pad: R + 1, idx, off };
    halo2.set(pi, h);
    return h;
  }

  function blankPatch(pi) {
    const p = C.P[pi];
    A.fill(0, p.off, p.off + p.w * p.h);
    B.fill(0, p.off, p.off + p.w * p.h);
  }

  function seedPatch(pi) {
    blankPatch(pi);
    const p = C.P[pi];
    // smoothed random soup on a coarse lattice (the cabinet's soup())
    const cell = Math.max(2, Math.round(pr.cell * C.ppm));
    const cw = Math.ceil(p.w / cell) + 2, ch = Math.ceil(p.h / cell) + 2;
    const coarse = new Float32Array(cw * ch);
    for (let i = 0; i < coarse.length; i++) coarse[i] = rng() < pr.density ? rng() : 0;
    for (const g of p.valid) {
      const k = g - p.off;
      const y = (k / p.w) | 0;
      const x = k - y * p.w;
      const fx = x / cell, fy = y / cell;
      const x0 = fx | 0, y0 = fy | 0, tx = fx - x0, ty = fy - y0;
      const a = coarse[y0 * cw + x0], b = coarse[y0 * cw + x0 + 1];
      const c = coarse[(y0 + 1) * cw + x0], d = coarse[(y0 + 1) * cw + x0 + 1];
      const top = a + (b - a) * tx, bot = c + (d - c) * tx;
      A[g] = Math.min(1, top + (bot - top) * ty);
    }
  }

  function costPerStep() {
    let cells = 0;
    for (const pi of owned) cells += C.P[pi].valid.length;
    return cells * (taps ? taps.w.length : 0);
  }

  const S = {
    id: 'lenia',

    rebind(newD, oldD, resample, makeCoarse) {
      const oldC = C, oldA = A;
      D = newD;
      C = makeCoarse();
      A = new Float32Array(C.N + 1);
      B = new Float32Array(C.N + 1);
      if (oldC && oldA) resample(oldC, C, oldA.subarray(0, oldC.N), A.subarray(0, C.N), 0);
      buildKernel();
      // indices may have changed (patches come and go): ownership is re-given by ID in assign()
      owned = [];
      ownedMask = new Uint8Array(C.P.length);
    },

    assign(list, fresh) {
      const was = ownedMask && ownedMask.length === C.P.length ? ownedMask : new Uint8Array(C.P.length);
      owned = list.slice();
      ownedMask = new Uint8Array(C.P.length);
      for (const pi of owned) ownedMask[pi] = 1;
      for (let pi = 0; pi < C.P.length; pi++) if (was[pi] && !ownedMask[pi]) blankPatch(pi);
      for (const pi of fresh) seedPatch(pi);
      every = Math.max(1, Math.ceil(costPerStep() / budget.leniaOps));
    },

    owns: (pi) => !!ownedMask?.[pi],

    setParams(values) {
      const name = values['life.leniaPreset'] || 'labyrinth';
      const changed = name !== preset;
      preset = LENIA_PRESETS[name] ? name : 'labyrinth';
      pr = LENIA_PRESETS[preset];
      pal = palette(values['life.leniaPalette'] || values['life.gsPalette']);
      if (changed && C) buildKernel();
      return changed;
    },

    step(substeps) {
      if (!owned.length) return;
      tickN++;
      if (tickN % every !== 0) return;
      const invT = (1 / pr.T) * every; // keep the rate when stepping less often
      const dt = Math.min(0.5, invT);
      const denom = 2 * pr.sigma * pr.sigma;
      const mu = pr.mu;
      const W = taps.w, nT = W.length;
      for (let s = 0; s < substeps; s++) {
        let m = 0, cnt = 0;
        for (const pi of owned) {
          const p = C.P[pi];
          const h = haloFor(pi);
          const { HW, pad, idx, off } = h;
          for (const g of p.valid) {
            const k = g - p.off;
            const j = (k / p.w) | 0;
            const i = k - j * p.w;
            const b0 = (j + pad) * HW + i + pad;
            let u = 0;
            for (let t = 0; t < nT; t++) u += A[idx[b0 + off[t]]] * W[t];
            const d = u - mu;
            const gr = 2 * Math.exp(-(d * d) / denom) - 1;
            let v = A[g] + dt * gr;
            v = v < 0 ? 0 : v > 1 ? 1 : v;
            B[g] = v;
            m += v;
          }
          cnt += p.valid.length;
        }
        const t = A;
        A = B;
        B = t;
        A[C.N] = 0;
        // cells outside owned patches must stay 0 in both buffers
        mass = cnt ? m / cnt : 0;
      }
    },

    paint(pi, out) {
      const p = D.P[pi];
      const c = C.P[pi];
      const lut = pal.lut;
      const n = p.w * p.h, st = p.state;
      const r = C.ppm / D.ppm;
      for (let k = 0; k < n; k++) {
        if (st[k] !== 2) {
          out[k] = 0xff000000;
          continue;
        }
        const j = (k / p.w) | 0;
        const i = k - j * p.w;
        // bilinear sample of the coarse field at this cell's centre
        const fx = (i + 0.5) * r - 0.5, fy = (j + 0.5) * r - 0.5;
        let x0 = Math.floor(fx), y0 = Math.floor(fy);
        const tx = fx - x0, ty = fy - y0;
        let x1 = x0 + 1, y1 = y0 + 1;
        x0 = x0 < 0 ? 0 : x0 >= c.w ? c.w - 1 : x0;
        x1 = x1 < 0 ? 0 : x1 >= c.w ? c.w - 1 : x1;
        y0 = y0 < 0 ? 0 : y0 >= c.h ? c.h - 1 : y0;
        y1 = y1 < 0 ? 0 : y1 >= c.h ? c.h - 1 : y1;
        const a = A[c.off + y0 * c.w + x0], b = A[c.off + y0 * c.w + x1];
        const cc = A[c.off + y1 * c.w + x0], d = A[c.off + y1 * c.w + x1];
        const top = a + (b - a) * tx, bot = cc + (d - cc) * tx;
        const v = top + (bot - top) * ty;
        out[k] = lut[v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0];
      }
    },

    food: (g) => {
      const pi = D.cellPatch[g];
      const p = D.P[pi], c = C.P[pi];
      const k = g - p.off;
      const j = (k / p.w) | 0;
      const i = k - j * p.w;
      const r = C.ppm / D.ppm;
      const ci = Math.min(c.w - 1, Math.floor((i + 0.5) * r)), cj = Math.min(c.h - 1, Math.floor((j + 0.5) * r));
      return A[c.off + cj * c.w + ci];
    },

    seedAt(pi, x, y) {
      const p = C.P[pi];
      const cx = x * C.ppm, cy = y * C.ppm;
      const rad = Math.max(3, R * 0.8);
      const r2 = rad * rad;
      for (let dy = -Math.ceil(rad); dy <= rad; dy++) {
        for (let dx = -Math.ceil(rad); dx <= rad; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const i = (cx + dx) | 0, j = (cy + dy) | 0;
          if (i < 0 || j < 0 || i >= p.w || j >= p.h || p.state[j * p.w + i] !== 2) continue;
          const g = p.off + j * p.w + i;
          const f = 1 - d2 / r2;
          A[g] = Math.min(1, A[g] + f * f * (0.6 + 0.4 * rng()));
        }
      }
    },

    touch(pi, x, y) {
      const p = C.P[pi];
      const i = Math.floor(x * C.ppm), j = Math.floor(y * C.ppm);
      if (i < 0 || j < 0 || i >= p.w || j >= p.h || p.state[j * p.w + i] !== 2) return;
      A[p.off + j * p.w + i] = Math.min(1, A[p.off + j * p.w + i] + 0.5);
    },

    reseed() {
      for (const pi of owned) seedPatch(pi);
    },

    clear() {
      for (const pi of owned) blankPatch(pi);
    },

    field: () => ({ A, C }),
    stats: () => ({ mass, every, taps: taps ? taps.w.length : 0, R }),
    dispose() {
      A = B = null;
      halo2.clear();
    },
  };
  return S;
}
