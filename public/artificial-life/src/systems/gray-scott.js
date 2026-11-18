// GRAY-SCOTT reaction-diffusion.
//   du/dt = Du*Lap(u) - u*v^2 + F*(1 - u)
//   dv/dt = Dv*Lap(v) + u*v^2 - (F + k)*v
// u is the fed chemical, v the autocatalyst that consumes it. Explicit Euler,
// dt = 1, 5-point Laplacian on a 256x256 torus, two substeps per frame
// (Du*dt/dx^2 = 0.16, comfortably inside the 0.25 stability limit).
import { makeRng } from '../lib/rng.js';
import { ramp } from '../lib/palette.js';
import { Surface } from '../lib/surface.js';

const DT = 1; // explicit Euler; Du*DT/dx^2 = 0.16 < 0.25

export const meta = {
  id: 'gray-scott',
  name: 'Reaction–Diffusion',
  latin: 'Turingia coralligena',
  accession: 'AL·0547',
  plate: 'II',
  described: 1993,
  accent: '#d8703c',
  note: 'Two chemicals: one fed, one self-catalysing. Growing tips divide and never fuse — the pattern is a standing wave in the concentration of v.',
  source: 'Pearson, J. E. (1993) Complex Patterns in a Simple System. Science 261, 189–192.',
};

export function create({ size = 256 } = {}) {
  const W = size, H = size, N = W * H;

  const params = [
    { key: 'F', label: 'feed rate', min: 0.005, max: 0.09, step: 0.0001, value: 0.0545, digits: 4 },
    { key: 'k', label: 'kill rate', min: 0.03, max: 0.075, step: 0.0001, value: 0.062, digits: 4 },
    { key: 'Du', label: 'diffusion u', min: 0.05, max: 0.24, step: 0.005, value: 0.16 },
    { key: 'Dv', label: 'diffusion v', min: 0.02, max: 0.16, step: 0.005, value: 0.08 },
    { key: 'brush', label: 'brush radius', min: 2, max: 24, step: 1, value: 7, unit: 'px' },
  ];
  const p = {};
  for (const d of params) p[d.key] = d.value;

  let u = new Float32Array(N).fill(1);
  let v = new Float32Array(N);
  let u2 = new Float32Array(N).fill(1);
  let v2 = new Float32Array(N);
  const surf = new Surface(W, H);
  let rng = makeRng();
  let meanV = 0;

  const lut = ramp([
    [0.0, '#0a0a09'],
    [0.1, '#1d1108'],
    [0.3, '#5e2a10'],
    [0.52, '#a8471c'],
    [0.72, '#dd7a3c'],
    [0.9, '#efb173'],
    [1.0, '#f6e2c4'],
  ]);

  function blank() {
    u.fill(1); v.fill(0);
    u2.fill(1); v2.fill(0);
  }

  function blob(cx, cy, r, amount = 0.5) {
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const x = (((cx + dx) | 0) % W + W) % W;
        const y = (((cy + dy) | 0) % H + H) % H;
        const i = y * W + x;
        const f = 1 - Math.sqrt(d2) / r;
        v[i] = Math.min(1, v[i] + amount * (0.7 + 0.3 * f));
        u[i] = Math.max(0, u[i] - 0.5 * amount * (0.7 + 0.3 * f));
      }
    }
  }

  function scatter(count, r) {
    for (let i = 0; i < count; i++) blob(rng.int(W), rng.int(H), r, 0.55);
  }

  // Single-cell nuclei. In the low-feed regimes a fat disc of v burns through
  // its own u supply and the whole colony collapses; point nuclei grow.
  function nuclei(density, box = 1) {
    const x0 = ((W * (1 - box)) / 2) | 0, y0 = ((H * (1 - box)) / 2) | 0;
    const bw = (W * box) | 0, bh = (H * box) | 0;
    for (let y = 0; y < bh; y++) {
      for (let x = 0; x < bw; x++) {
        if (rng() >= density) continue;
        const i = (y0 + y) * W + (x0 + x);
        v[i] = 1; u[i] = 0;
      }
    }
  }

  function bar() {
    for (let y = (H >> 1) - 4; y < (H >> 1) + 4; y++) {
      for (let x = 0; x < W; x++) { v[y * W + x] = 0.6; u[y * W + x] = 0.4; }
    }
    // a little noise so the front breaks symmetry
    for (let i = 0; i < N; i++) if (rng() < 0.0006) v[i] = 0.5;
  }

  function setParam(key, val) {
    if (!(key in p)) return;
    p[key] = val;
    const d = params.find((q) => q.key === key);
    if (d) d.value = val;
  }



  // Every preset below was run headless for 6000 steps and looked at; the
  // note is what it actually does at Du=0.16 / Dv=0.08, not what the (F,k)
  // chart promises for another discretisation.
  const presets = [
    {
      name: 'coral',
      note: 'F 0.0545 / k 0.0620 — branching growth, tips that never rejoin',
      values: { F: 0.0545, k: 0.062, Du: 0.16, Dv: 0.08 },
      seed() { blank(); scatter(14, 6); },
    },
    {
      name: 'worms',
      note: 'F 0.0400 / k 0.0625 — filaments that elongate and split',
      values: { F: 0.04, k: 0.0625, Du: 0.16, Dv: 0.08 },
      seed() { blank(); nuclei(0.02, 1); },
    },
    {
      name: 'mitosis',
      note: 'F 0.0367 / k 0.0649 — a colony that expands only by dividing',
      values: { F: 0.0367, k: 0.0649, Du: 0.16, Dv: 0.08 },
      seed() { blank(); nuclei(0.06, 0.16); },
    },
    {
      name: 'front',
      note: 'one straight inoculation line, left to destabilise',
      values: { F: 0.0545, k: 0.062, Du: 0.16, Dv: 0.08 },
      seed() { blank(); bar(); },
    },
  ];

  let current = 0;

  function applyPreset(i) {
    const pr = presets[Math.max(0, Math.min(presets.length - 1, i))];
    for (const k in pr.values) setParam(k, pr.values[k]);
    pr.seed();
    current = presets.indexOf(pr);
  }

  const S = {
    ...meta,
    params,
    presets,

    init() { applyPreset(0); },

    step() {
      const { Du, Dv, F, k } = p;
      const dt = DT;
      for (let pass = 0; pass < 2; pass++) {
        let m = 0;
        for (let y = 0; y < H; y++) {
          const row = y * W;
          const rowN = (y === 0 ? H - 1 : y - 1) * W;
          const rowS = (y === H - 1 ? 0 : y + 1) * W;
          for (let x = 0; x < W; x++) {
            const xw = x === 0 ? W - 1 : x - 1;
            const xe = x === W - 1 ? 0 : x + 1;
            const i = row + x;
            const uc = u[i], vc = v[i];
            const lu = u[row + xw] + u[row + xe] + u[rowN + x] + u[rowS + x] - 4 * uc;
            const lv = v[row + xw] + v[row + xe] + v[rowN + x] + v[rowS + x] - 4 * vc;
            const reac = uc * vc * vc;
            let nu = uc + dt * (Du * lu - reac + F * (1 - uc));
            let nv = vc + dt * (Dv * lv + reac - (F + k) * vc);
            nu = nu < 0 ? 0 : nu > 1 ? 1 : nu;
            nv = nv < 0 ? 0 : nv > 1 ? 1 : nv;
            u2[i] = nu; v2[i] = nv;
            m += nv;
          }
        }
        let t = u; u = u2; u2 = t;   // ping-pong
        t = v; v = v2; v2 = t;
        meanV = m / N;
      }
    },

    paintInto(out) {
      // v tops out around 0.35 for these regimes; 2.7 puts that at the
      // bright end of the ramp without clipping the interesting midtones.
      for (let i = 0; i < N; i++) {
        let t = v[i] * 2.7;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        out[i] = lut[(t * 255) | 0];
      }
    },

    render(ctx) {
      S.paintInto(surf.u32);
      surf.blit(ctx, { smooth: false, mode: 'cover' });
    },

    mapPointer(px, py, cw, ch) { return surf.toLocal(px, py, cw, ch, 'cover'); },

    seed(nx, ny, strength) {
      blob(nx * W, ny * H, p.brush, 0.6 * strength);
    },

    reset() {
      rng = makeRng();
      presets[current].seed();
    },

    metric() {
      return { label: 'substrate v', value: meanV, text: (meanV * 1000).toFixed(1) + '‰' };
    },

    // Read-only accessors, plus the nucleus seeder the presets use.
    field() { return { data: v, w: W, h: H }; },
    uField() { return u; },
    nuclei,
    applyPreset,
    get preset() { return current; },
    setParam,
    resize() {},
    dispose() { surf.dispose(); u = v = u2 = v2 = null; },
  };
  return S;
}
