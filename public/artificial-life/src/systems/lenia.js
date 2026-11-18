// LENIA — continuous cellular automata (Bert Wang-Chak Chan, 2018).
// State A in [0,1] on a 256x256 torus. Each step convolves A with a smooth
// ring kernel K, maps the potential U = K*A through a bell-shaped growth
// function G, and integrates A += (1/T) * G(U).
// The convolution is done in the Fourier domain: a 27x27 kernel is 729 taps
// per cell (48M multiply-adds per step) done directly, versus two 256x256
// FFTs here.
import { FFT2D } from '../lib/fft.js';
import { makeRng } from '../lib/rng.js';
import { ramp } from '../lib/palette.js';
import { Surface } from '../lib/surface.js';

const RING_WEIGHTS = [[1], [1, 0.5], [1, 2 / 3, 1 / 3]];
const KERNEL_KEYS = new Set(['R', 'kmu', 'ksig', 'rings']);

// Orbium: the canonical Lenia glider for R=13, T=10, mu=0.15, sigma=0.017.
// Recovered by seeding crescents and keeping the survivor that translated
// without deforming; quantised to 1/100 and re-verified. See README.
const ORBIUM = {
  w: 21,
  h: 21,
  cells: Float32Array.from([
    [   0,   0,   0,   0,   0,   0,   0,   0,   0, .16,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0,   0],
    [   0,   0,   0,   0,   0,   0,   0,   0,   0,   0, .14, .39,   0,   0,   0,   0,   0,   0,   0,   0,   0],
    [   0,   0,   0,   0,   0,   0,   0,   0, .06, .11, .15, .17, .71, .19,   0,   0,   0,   0,   0,   0,   0],
    [   0,   0,   0,   0,   0,   0, .01, .12, .18, .17, .14, .12, .15, .46, .82,   0,   0,   0,   0,   0,   0],
    [   0,   0,   0,   0, .03,   0, .12, .18, .14, .03,   0,   0,   0,   0,   0, .59, .35,   0,   0,   0,   0],
    [   0,   0, .03, .14, .23, .29, .29, .16, .04,   0,   0,   0,   0,   0,   0,   0, .25, .37,   0,   0,   0],
    [   0,   0, .06, .23, .38, .47, .44, .23,   0,   0,   0,   0,   0,   0,   0,   0,   0, .19, .27,   0,   0],
    [   0,   0, .04, .26, .44, .53, .45, .28, .21, .21,   0,   0,   0,   0,   0,   0,   0,   0, .24, .15,   0],
    [   0,   0,   0,  .2,  .4, .45, .36, .31, .35, .41, .47, .31,   0,   0,   0,   0,   0,   0, .13, .23, .02],
    [   0,   0, .03, .15, .18, .24, .24, .32, .44, .56, .65, .72, .77, .37,   0,   0,   0,   0, .12, .23,  .1],
    [   0,   0, .07, .18, .12,   0, .12, .31, .48, .64, .77, .88, .95, .99,  .8, .38, .14,  .1, .17, .24, .15],
    [   0,   0, .11, .17, .05,   0,   0, .12, .48, .67, .85, .96,   1,   1,   1, .91, .56, .33, .28, .27, .16],
    [   0,   0, .12, .17,   0,   0,   0,   0, .04, .65, .86,   1,   1, .94, .92, .91, .77, .53, .38,  .3, .16],
    [ .11,   0, .09, .19,   0,   0,   0,   0,   0,   0, .68, .99,   1, .94, .83,  .8, .72, .58, .42, .29, .14],
    [   0, .28, .16, .22, .06,   0,   0,   0,   0,   0,   0, .58,   1,   1, .86, .75, .65, .54,  .4, .25,  .1],
    [   0,   0, .02, .65, .22,   0,   0,   0,   0,   0,   0,   0, .45, .75, .78, .68, .57, .46, .33, .19, .05],
    [   0,   0,   0,   0, .81, .27,   0,   0,   0,   0,   0,   0, .07, .33,  .5, .52, .46, .36, .25, .12, .01],
    [   0,   0,   0,   0,   0, .52, .55,   0,   0,   0,   0,   0, .02, .17, .31, .37, .34, .26, .14, .04,   0],
    [   0,   0,   0,   0,   0,   0, .07, .54, .24, .06, .02, .03,  .1, .19, .26, .29, .23, .13, .04,   0,   0],
    [   0,   0,   0,   0,   0,   0,   0,   0,  .2, .31, .26, .23, .23, .23, .22, .16, .07, .01,   0,   0,   0],
    [   0,   0,   0,   0,   0,   0,   0,   0,   0,   0, .04, .08, .09, .07, .04,   0,   0,   0,   0,   0,   0],
  ].flat()),
};

export const meta = {
  id: 'lenia',
  name: 'Lenia',
  latin: 'Orbium unicaudatum',
  accession: 'AL·0113',
  plate: 'I',
  described: 2019,
  accent: '#4fc6b2',
  note: 'A single specimen translates without deforming. Watch a collision: two gliders annihilate far more often than they merge, and the debris sometimes blooms.',
  source: 'Chan, B. W-C. (2019) Lenia: Biology of Artificial Life. Complex Systems 28(3).',
};

export function create({ size = 256 } = {}) {
  const GW = size, GH = size, N = GW * GH;
  const params = [
    { key: 'R', label: 'kernel radius', min: 6, max: 20, step: 1, value: 13, unit: 'px' },
    { key: 'T', label: 'time constant', min: 2, max: 30, step: 1, value: 10 },
    { key: 'mu', label: 'growth centre', min: 0.05, max: 0.4, step: 0.001, value: 0.15 },
    { key: 'sigma', label: 'growth width', min: 0.002, max: 0.08, step: 0.001, value: 0.017 },
    { key: 'kmu', label: 'ring centre', min: 0.2, max: 0.8, step: 0.005, value: 0.5 },
    { key: 'ksig', label: 'ring width', min: 0.04, max: 0.3, step: 0.005, value: 0.15 },
    { key: 'rings', label: 'kernel rings', min: 1, max: 3, step: 1, value: 1 },
  ];
  const p = {};
  for (const d of params) p[d.key] = d.value;

  let A = new Float32Array(N);
  let B = new Float32Array(N);
  const re = new Float64Array(N);
  const im = new Float64Array(N);
  const Kre = new Float64Array(N);
  const Kim = new Float64Array(N);
  const fft = new FFT2D(GW, GH);
  const surf = new Surface(GW, GH);
  let rng = makeRng();
  let kernelDirty = true;
  let mass = 0;

  // A saturates at 1 across the interior of every structure, so the top of
  // the ramp is the accent rather than white; the rim gradient does the work.
  const lut = ramp([
    [0.0, '#050c0c'],
    [0.18, '#0a2725'],
    [0.42, '#0f504a'],
    [0.66, '#1d8175'],
    [0.86, '#3fb3a2'],
    [1.0, '#83dbc9'],
  ]);

  function buildKernel() {
    const R = p.R, rings = Math.max(1, Math.round(p.rings));
    const beta = RING_WEIGHTS[rings - 1];
    Kre.fill(0);
    Kim.fill(0);
    let sum = 0;
    const twoSig2 = 2 * p.ksig * p.ksig;
    for (let dy = -R; dy <= R; dy++) {
      for (let dx = -R; dx <= R; dx++) {
        const r = Math.hypot(dx, dy) / R;
        if (r >= 1) continue;
        const br = r * rings;
        const idx = Math.min(rings - 1, br | 0);
        const q = br - (br | 0);
        const w = beta[idx] * Math.exp(-((q - p.kmu) * (q - p.kmu)) / twoSig2);
        const x = (dx + GW) % GW, y = (dy + GH) % GH;
        Kre[y * GW + x] = w;
        sum += w;
      }
    }
    if (sum > 0) for (let i = 0; i < N; i++) Kre[i] /= sum;
    fft.forward(Kre, Kim);
    kernelDirty = false;
  }

  function stamp(cells, cw, ch, ox, oy, scale = 1) {
    for (let y = 0; y < ch; y++) {
      for (let x = 0; x < cw; x++) {
        const v = cells[y * cw + x] * scale;
        if (v <= 0) continue;
        const gx = (((ox + x) % GW) + GW) % GW;
        const gy = (((oy + y) % GH) + GH) % GH;
        A[gy * GW + gx] = Math.min(1, A[gy * GW + gx] + v);
      }
    }
  }

  // Rotate the 20x20 glider by a multiple of 90 degrees so a flotilla can
  // travel in four directions.
  function rotated(src, w, h, turns) {
    let cells = Float32Array.from(src), cw = w, chh = h;
    for (let t = 0; t < ((turns % 4) + 4) % 4; t++) {
      const out = new Float32Array(cw * chh);
      for (let y = 0; y < chh; y++) {
        for (let x = 0; x < cw; x++) out[x * chh + (chh - 1 - y)] = cells[y * cw + x];
      }
      cells = out;
      const t2 = cw; cw = chh; chh = t2;
    }
    return { cells, w: cw, h: chh };
  }

  function soup(density = 0.42, cell = 8) {
    A.fill(0);
    const cw = Math.ceil(GW / cell) + 1, ch = Math.ceil(GH / cell) + 1;
    const coarse = new Float32Array(cw * ch);
    for (let i = 0; i < coarse.length; i++) coarse[i] = rng() < density ? rng() : 0;
    for (let y = 0; y < GH; y++) {
      const fy = y / cell, y0 = fy | 0, ty = fy - y0;
      for (let x = 0; x < GW; x++) {
        const fx = x / cell, x0 = fx | 0, tx = fx - x0;
        const a = coarse[y0 * cw + x0], b = coarse[y0 * cw + x0 + 1];
        const c = coarse[(y0 + 1) * cw + x0], d = coarse[(y0 + 1) * cw + x0 + 1];
        const top = a + (b - a) * tx, bot = c + (d - c) * tx;
        A[y * GW + x] = Math.min(1, top + (bot - top) * ty);
      }
    }
  }

  function orbium(count) {
    A.fill(0);
    // Kept inside the vertical band that survives 'cover' cropping on a
    // landscape viewport, so the flotilla stays on screen.
    const placements = [
      [0.50, 0.50, 0], [0.24, 0.38, 1], [0.70, 0.35, 3], [0.34, 0.64, 2], [0.78, 0.62, 0],
    ];
    for (let i = 0; i < Math.min(count, placements.length); i++) {
      const [fx, fy, turns] = placements[i];
      const r = rotated(ORBIUM.cells, ORBIUM.w, ORBIUM.h, turns);
      stamp(r.cells, r.w, r.h, Math.round(fx * GW) - (r.w >> 1), Math.round(fy * GH) - (r.h >> 1));
    }
  }

  const DEFAULTS = { R: 13, T: 10, mu: 0.15, sigma: 0.017, kmu: 0.5, ksig: 0.15, rings: 1 };

  const presets = [
    {
      name: 'flotilla',
      note: 'five gliders on crossing courses — collision debris blooms',
      values: DEFAULTS,
      seed() { orbium(5); },
    },
    {
      name: 'orbium',
      note: 'one glider, undisturbed torus',
      values: DEFAULTS,
      seed() { orbium(1); },
    },
    {
      name: 'soup',
      note: 'smoothed random field: most of it dies, the rest organises',
      values: DEFAULTS,
      seed() { soup(0.42, 8); },
    },
    {
      name: 'labyrinth',
      note: 'wide growth band — no solitons, a space-filling ridge pattern',
      values: { R: 13, T: 10, mu: 0.32, sigma: 0.045, kmu: 0.5, ksig: 0.15, rings: 1 },
      seed() { soup(0.5, 6); },
    },
  ];

  let current = 0;

  function applyPreset(i) {
    const pr = presets[Math.max(0, Math.min(presets.length - 1, i))];
    for (const k in pr.values) setParam(k, pr.values[k]);
    if (kernelDirty) buildKernel();
    pr.seed();
    current = presets.indexOf(pr);
  }

  function setParam(key, v) {
    if (!(key in p)) return;
    p[key] = v;
    const d = params.find((q) => q.key === key);
    if (d) d.value = v;
    if (KERNEL_KEYS.has(key)) kernelDirty = true;
  }

  const S = {
    ...meta,
    params,
    presets,

    init() {
      buildKernel();
      applyPreset(0);
    },

    step(dt) {
      if (kernelDirty) buildKernel();
      for (let i = 0; i < N; i++) { re[i] = A[i]; im[i] = 0; }
      fft.forward(re, im);
      // Complex multiply by the kernel spectrum.
      for (let i = 0; i < N; i++) {
        const ar = re[i], ai = im[i], br = Kre[i], bi = Kim[i];
        re[i] = ar * br - ai * bi;
        im[i] = ar * bi + ai * br;
      }
      fft.inverse(re, im);

      const invT = 1 / p.T;
      const denom = 2 * p.sigma * p.sigma;
      const mu = p.mu;
      let m = 0;
      for (let i = 0; i < N; i++) {
        const d = re[i] - mu;
        const g = 2 * Math.exp(-(d * d) / denom) - 1;
        let v = A[i] + invT * g;
        v = v < 0 ? 0 : v > 1 ? 1 : v;
        B[i] = v;
        m += v;
      }
      const t = A; A = B; B = t; // ping-pong
      mass = m / N;
    },

    paintInto(out) {
      for (let i = 0; i < N; i++) {
        const v = A[i];
        out[i] = lut[v <= 0 ? 0 : v >= 1 ? 255 : (v * 255) | 0];
      }
    },

    render(ctx) {
      S.paintInto(surf.u32);
      surf.blit(ctx, { smooth: false, mode: 'cover' });
    },

    mapPointer(px, py, cw, ch) {
      return surf.toLocal(px, py, cw, ch, 'cover');
    },

    seed(nx, ny, strength) {
      const cx = nx * GW, cy = ny * GH;
      const rad = Math.max(4, p.R * 0.75);
      const r2 = rad * rad;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const x = (((cx + dx) | 0) % GW + GW) % GW;
          const y = (((cy + dy) | 0) % GH + GH) % GH;
          const f = (1 - d2 / r2);
          const i = y * GW + x;
          A[i] = Math.min(1, A[i] + strength * f * f * (0.6 + 0.4 * rng()));
        }
      }
    },

    reset() {
      rng = makeRng();
      presets[current].seed();
    },

    metric() {
      return { label: 'mass', value: mass, text: (mass * 1000).toFixed(1) + '‰' };
    },

    // Read-only accessor; with paintInto() it makes the system measurable
    // and renderable outside a browser.
    field() { return { data: A, w: GW, h: GH }; },
    applyPreset,
    get preset() { return current; },
    setParam,
    resize() {},
    dispose() {
      surf.dispose();
      A = B = null;
    },
  };
  return S;
}
