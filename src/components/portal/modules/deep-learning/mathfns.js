/* ============================================================================
   DEEP LEARNING — LECTURE MATH
   ----------------------------------------------------------------------------
   Pure functions behind the Lecture 1 playgrounds: the activation-function zoo
   (exact definitions from the slides), a numerically-stable softplus/erf, a
   seeded PRNG so every simulation is deterministic, and a small Monte-Carlo
   forward/backward pass through a deep MLP used by the gradient-flow lab.
   No React, no DOM — everything here is unit-testable maths.
   ========================================================================== */

// ── Formatting ───────────────────────────────────────────────────────────────
const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (n) => String(n).split('').map((c) => SUP[c] ?? c).join('');

// 3.2×10⁻⁵ — scientific formatting for the log-scale labs.
export function fmtSci(v) {
  if (!Number.isFinite(v) || v === 0) return '0';
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e <= 2) return v.toPrecision(3).replace(/\.?0+$/, '');
  const m = v / 10 ** e;
  return `${m.toFixed(1)}×10${sup(e)}`;
}

// ── Stable primitives ────────────────────────────────────────────────────────
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));

// softplus(z) = log(1 + e^z), computed without overflow for large |z|.
export const softplus = (z) => Math.log1p(Math.exp(-Math.abs(z))) + Math.max(z, 0);

// Abramowitz & Stegun 7.1.26 — max abs error 1.5e-7, plenty for plotting.
export function erf(x) {
  const s = Math.sign(x);
  const ax = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * ax);
  const y =
    1 -
    (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-ax * ax);
  return s * y;
}

// Standard Gaussian CDF Φ(z) — the GELU building block.
export const gaussCdf = (z) => 0.5 * (1 + erf(z / Math.SQRT2));

// ── The activation zoo (slide definitions, exactly) ─────────────────────────
// SELU constants from slide 16: s = 1.0507, α = 1.6733.
export const SELU_SCALE = 1.0507;
export const SELU_ALPHA = 1.6733;

export const ACT_FNS = {
  sigmoid: (z) => sigmoid(z),
  tanh: (z) => Math.tanh(z),
  relu: (z) => Math.max(0, z),
  leaky: (z, { alpha = 0.2 } = {}) => Math.max(alpha * z, z),
  elu: (z, { alpha = 1 } = {}) => (z < 0 ? alpha * (Math.exp(z) - 1) : z),
  selu: (z) => SELU_SCALE * (z < 0 ? SELU_ALPHA * (Math.exp(z) - 1) : z),
  gelu: (z) => z * gaussCdf(z),
  swish: (z, { beta = 1 } = {}) => z * sigmoid(beta * z),
  mish: (z) => z * Math.tanh(softplus(z)),
};

// Central-difference derivative — uniform for every activation, and exactly
// what the plots need (the analytic forms live on the slides themselves).
export function numDeriv(f, z, params) {
  const h = 1e-4;
  return (f(z + h, params) - f(z - h, params)) / (2 * h);
}

// Sample a function over [xmin, xmax] into {z, y} pairs (n points, inclusive).
export function sampleFn(f, xmin, xmax, n, params) {
  const pts = new Array(n);
  for (let i = 0; i < n; i++) {
    const z = xmin + ((xmax - xmin) * i) / (n - 1);
    pts[i] = { z, y: f(z, params) };
  }
  return pts;
}

// ── Seeded randomness (deterministic labs) ──────────────────────────────────
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Box–Muller: one N(0,1) draw per call.
export function makeRandn(rng) {
  let spare = null;
  return function () {
    if (spare !== null) {
      const v = spare;
      spare = null;
      return v;
    }
    let u = 0;
    let v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    const m = Math.sqrt(-2 * Math.log(u));
    spare = m * Math.sin(2 * Math.PI * v);
    return m * Math.cos(2 * Math.PI * v);
  };
}

// ── Gradient-flow Monte-Carlo ────────────────────────────────────────────────
// A real (small) forward + backward pass through a `depth`-layer MLP of width
// `width`: standardized inputs, weights drawn per the chosen init, then a unit
// upstream gradient backpropagated to every layer. Returns, per layer, the
// std-dev of the activations (forward signal) and the RMS of ∂L/∂z (backward
// gradient) — the two curves the vanishing/exploding story is about.
//
//   init: 'normal1' → N(0, 1)            (the “old default” from slide 6)
//         'glorot'  → N(0, 1/fan_avg)    (slide 7; fan_in = fan_out here)
//         'he'      → N(0, 2/fan_in)     (slide 8)
export function simulateGradientFlow({
  act = 'sigmoid',
  init = 'normal1',
  depth = 10,
  width = 32,
  batch = 64,
  seed = 42,
} = {}) {
  const rng = mulberry32(seed);
  const randn = makeRandn(rng);
  const f = ACT_FNS[act];
  const df = (z) => numDeriv(f, z);

  const wStd =
    init === 'glorot' ? Math.sqrt(1 / width) : init === 'he' ? Math.sqrt(2 / width) : 1;

  // Weights: depth matrices of width×width.
  const W = [];
  for (let l = 0; l < depth; l++) {
    const m = new Float64Array(width * width);
    for (let i = 0; i < m.length; i++) m[i] = randn() * wStd;
    W.push(m);
  }

  // Forward: a₀ standardized, aₗ = f(aₗ₋₁ Wₗ). Keep every zₗ for the backward.
  let a = new Float64Array(batch * width);
  for (let i = 0; i < a.length; i++) a[i] = randn();
  const zs = [];
  const actStd = [];
  for (let l = 0; l < depth; l++) {
    const z = new Float64Array(batch * width);
    const w = W[l];
    for (let b = 0; b < batch; b++) {
      const ao = b * width;
      for (let j = 0; j < width; j++) {
        let s = 0;
        for (let i = 0; i < width; i++) s += a[ao + i] * w[i * width + j];
        z[ao + j] = s;
      }
    }
    zs.push(z);
    const next = new Float64Array(batch * width);
    for (let i = 0; i < z.length; i++) next[i] = f(z[i]);
    a = next;
    actStd.push(stdOf(a));
  }

  // Backward: unit gradient w.r.t. the last activations, chain to each ∂L/∂zₗ.
  let g = new Float64Array(batch * width).fill(1);
  const gradRms = new Array(depth);
  for (let l = depth - 1; l >= 0; l--) {
    const z = zs[l];
    const dz = new Float64Array(batch * width);
    for (let i = 0; i < dz.length; i++) dz[i] = g[i] * df(z[i]);
    gradRms[l] = rmsOf(dz);
    if (l > 0) {
      const w = W[l];
      const prev = new Float64Array(batch * width);
      for (let b = 0; b < batch; b++) {
        const o = b * width;
        for (let i = 0; i < width; i++) {
          let s = 0;
          for (let j = 0; j < width; j++) s += dz[o + j] * w[i * width + j];
          prev[o + i] = s;
        }
      }
      g = prev;
    }
  }

  const first = Math.max(gradRms[0], 1e-300);
  const last = Math.max(gradRms[depth - 1], 1e-300);
  const ratio = first / last; // gradient reaching layer 1 vs at the top
  return {
    layers: gradRms.map((gr, i) => ({ layer: i + 1, grad: gr, act: actStd[i] })),
    ratio,
    verdict: ratio < 1e-2 ? 'vanishing' : ratio > 1e2 ? 'exploding' : 'healthy',
  };
}

function stdOf(arr) {
  let m = 0;
  for (let i = 0; i < arr.length; i++) m += arr[i];
  m /= arr.length;
  let v = 0;
  for (let i = 0; i < arr.length; i++) v += (arr[i] - m) ** 2;
  return Math.sqrt(v / arr.length);
}

function rmsOf(arr) {
  let s = 0;
  for (let i = 0; i < arr.length; i++) s += arr[i] * arr[i];
  return Math.sqrt(s / arr.length);
}

// ── Batch-norm lab helpers ───────────────────────────────────────────────────
// One fixed “minibatch of activations for a single feature” — deliberately
// off-centre and spread out so normalisation visibly does something.
export const BN_BATCH = [2.1, 3.4, 2.8, 4.9, 3.1, 5.6, 2.4, 3.9, 4.4, 1.8, 3.3, 6.2, 2.9, 3.7];

export function bnStats(xs = BN_BATCH) {
  const m = xs.reduce((s, x) => s + x, 0) / xs.length;
  const v = xs.reduce((s, x) => s + (x - m) ** 2, 0) / xs.length;
  return { mu: m, var: v, sd: Math.sqrt(v) };
}
