/* ============================================================================
   SIGNAL KEEPER — THE STACK SIMULATION (pure, seeded; no React, no DOM)
   ----------------------------------------------------------------------------
   A random-weight MLP of LAYERS × UNITS dense layers (no biases) on a batch
   of standard-normal inputs, run forward and backward once, so the page can
   draw what the slides describe (Lecture 2, slides 5–29):

     forward    z = a·W, a = f(z) per layer; optional BatchNormalization in
                training mode over the batch (slide 24's four equations with
                γ = 1, β = 0), before the activation (slide 28) or after it
                (slide 26)
     backward   a unit-variance ∂L/∂a at the top, back-propagated to every
                layer's ∂L/∂z (through BN too): "gradients get smaller and
                smaller as the algorithm progresses down to the lower layers"
                (slide 5) shows as the std of ∂L/∂z falling layer by layer

   Inits (slides 6–8): 'n01' = N(0, 1) (the old technique, slide 6),
   Glorot normal σ² = 1/fan_avg or uniform over [−r, r] with r = √(3/fan_avg)
   (slide 7), He normal σ² = 2/fan_in, LeCun normal σ² = 1/fan_in (slide 8,
   Table 11-1). Activations as the slides define them: sigmoid (slide 6),
   tanh, ReLU (slide 10), leaky ReLU max(αz, z) (slide 11), ELU (slide 15),
   SELU = 1.0507·ELU₁.₆₇₃₃ (slide 16), GELU zΦ(z) (slide 18), SiLU zσ(z)
   (slide 19), Mish z·tanh(softplus(z)) (slide 20), and 'none' (linear).

     run(config, X0?)  the raw forward + backward pass (the check's finite
                       differences use it)
     simulate(config)  → { layers: [{ actStd, zStd, mean, hist, under,
                           over, sat, gradStd, ratio, status, gstatus }],
                           healthy, config }   (memoised by config)
     ACT_FNS, initSigma2(init, fanIn, fanOut), glorotLimit, fanAvg,
     layerStatus(...)  the thresholds the stage's dots use
   The internal BN ε (1e-3) is a simulation detail; the slides give ε no value.
   ========================================================================== */
import { rng } from '../core/rng.js';

export const LAYERS = 10;
export const UNITS = 50;
export const BATCH = 64;
export const SIM_SEED = 5017;
const BN_EPS = 1e-3;
const BINS = 15;

/* ── activations (value, derivative) ──────────────────────────────────── */
const sig = (z) => 1 / (1 + Math.exp(-z));
// Abramowitz & Stegun 7.1.26 (|error| < 1.5e-7) for Φ(z) = ½(1 + erf(z/√2))
function erf(x) {
  const s = x < 0 ? -1 : 1;
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return s * y;
}
const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
const phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
const softplus = (z) => (z > 30 ? z : Math.log1p(Math.exp(z)));

export const LEAKY_ALPHA_SIM = 0.2; // the slide 12 code's LeakyReLU(negative_slope=0.2)
export const SELU_S = 1.0507;       // slide 16
export const SELU_ALPHA = 1.6733;   // slide 16
export const ELU_ALPHA_SIM = 1;     // slide 15's α = 1 curve (smooth everywhere)

export const ACT_FNS = {
  none: { f: (z) => z, d: () => 1 },
  sigmoid: { f: sig, d: (z) => { const s = sig(z); return s * (1 - s); } },
  tanh: { f: Math.tanh, d: (z) => { const t = Math.tanh(z); return 1 - t * t; } },
  relu: { f: (z) => Math.max(0, z), d: (z) => (z > 0 ? 1 : 0) },
  leaky: { f: (z) => Math.max(LEAKY_ALPHA_SIM * z, z), d: (z) => (z > 0 ? 1 : LEAKY_ALPHA_SIM) },
  elu: { f: (z) => (z < 0 ? ELU_ALPHA_SIM * (Math.exp(z) - 1) : z), d: (z) => (z < 0 ? ELU_ALPHA_SIM * Math.exp(z) : 1) },
  selu: { f: (z) => SELU_S * (z < 0 ? SELU_ALPHA * (Math.exp(z) - 1) : z), d: (z) => SELU_S * (z < 0 ? SELU_ALPHA * Math.exp(z) : 1) },
  gelu: { f: (z) => z * Phi(z), d: (z) => Phi(z) + z * phi(z) },
  silu: { f: (z) => z * sig(z), d: (z) => { const s = sig(z); return s + z * s * (1 - s); } },
  mish: {
    f: (z) => z * Math.tanh(softplus(z)),
    d: (z) => { const t = Math.tanh(softplus(z)); return t + z * (1 - t * t) * sig(z); },
  },
};

// the activation's display range for the per-layer histogram (bounded ones
// show their whole range; the rest a fixed window, with overflow counted)
export const HIST_RANGE = { sigmoid: [0, 1], tanh: [-1, 1] };
export const histRange = (act) => HIST_RANGE[act] ?? [-3, 3];

/* ── initialisation (slides 6–8) ──────────────────────────────────────── */
export const fanAvg = (fanIn, fanOut) => (fanIn + fanOut) / 2;
export function initSigma2(init, fanIn, fanOut) {
  switch (init) {
    case 'n01': return 1;
    case 'glorot': case 'glorotUniform': return 1 / fanAvg(fanIn, fanOut);
    case 'he': return 2 / fanIn;
    case 'lecun': return 1 / fanIn;
    default: throw new Error(`unknown init ${init}`);
  }
}
export const glorotLimit = (fanIn, fanOut) => Math.sqrt(3 / fanAvg(fanIn, fanOut));

/* ── the run ──────────────────────────────────────────────────────────── */
function bnForward(X, m, n) {
  // per column: μ_B, σ²_B over the batch (1/m_B), x̂ = (x − μ_B)/√(σ²_B + ε); γ = 1, β = 0
  const out = new Float64Array(m * n);
  const inv = new Float64Array(n);
  for (let j = 0; j < n; j++) {
    let mu = 0;
    for (let i = 0; i < m; i++) mu += X[i * n + j];
    mu /= m;
    let v = 0;
    for (let i = 0; i < m; i++) { const d = X[i * n + j] - mu; v += d * d; }
    v /= m;
    inv[j] = 1 / Math.sqrt(v + BN_EPS);
    for (let i = 0; i < m; i++) out[i * n + j] = (X[i * n + j] - mu) * inv[j];
  }
  return { out, inv };
}
function bnBackward(G, Xhat, inv, m, n) {
  // ∂L/∂x = (1/m)·inv·(m·g − Σg − x̂·Σ(g·x̂)) per column (γ = 1)
  const dx = new Float64Array(m * n);
  for (let j = 0; j < n; j++) {
    let sg = 0;
    let sgx = 0;
    for (let i = 0; i < m; i++) { sg += G[i * n + j]; sgx += G[i * n + j] * Xhat[i * n + j]; }
    for (let i = 0; i < m; i++) dx[i * n + j] = (inv[j] / m) * (m * G[i * n + j] - sg - Xhat[i * n + j] * sgx);
  }
  return dx;
}
function matmul(A, W, m, n) {
  // (m × n)·(n × n)
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      const a = A[i * n + k];
      if (a === 0) continue;
      const row = k * n;
      const o = i * n;
      for (let j = 0; j < n; j++) out[o + j] += a * W[row + j];
    }
  }
  return out;
}
function matmulT(G, W, m, n) {
  // (m × n)·(n × n)ᵀ
  const out = new Float64Array(m * n);
  for (let i = 0; i < m; i++) {
    for (let k = 0; k < n; k++) {
      let s = 0;
      const row = k * n;
      for (let j = 0; j < n; j++) s += G[i * n + j] * W[row + j];
      out[i * n + k] = s;
    }
  }
  return out;
}
function stats(arr) {
  let mu = 0;
  for (let i = 0; i < arr.length; i++) mu += arr[i];
  mu /= arr.length;
  let v = 0;
  for (let i = 0; i < arr.length; i++) { const d = arr[i] - mu; v += d * d; }
  return { mean: mu, std: Math.sqrt(v / arr.length) };
}
function histogram(arr, lo, hi) {
  const bins = new Array(BINS).fill(0);
  let under = 0;
  let over = 0;
  const w = (hi - lo) / BINS;
  for (let i = 0; i < arr.length; i++) {
    const v = arr[i];
    if (v < lo) { under++; bins[0]++; } else if (v > hi) { over++; bins[BINS - 1]++; } else bins[Math.min(BINS - 1, Math.floor((v - lo) / w))]++;
  }
  return { bins: bins.map((b) => b / arr.length), under: under / arr.length, over: over / arr.length };
}

/* thresholds for the stage's dots (one place, so the check and the page agree).
   σ(z) is the std of what a layer feeds its activation f (after BN when BN
   comes first), the same yardstick for every f:
   forward  'saturated'  sigmoid/tanh with ≥ 30% of the units' f′(z) under
                         a tenth of f′'s maximum (|z| ≳ 3.7 for the
                         sigmoid, ≳ 1.8 for tanh)
            'exploding'  σ(z) > 8
            'vanishing'  σ(z) < 0.15
            'healthy'    otherwise
   backward ∂L/∂z std relative to the top layer: < 0.1 'vanishing', > 10
            'exploding', else 'healthy' */
export const SAT_FRAC = 0.3;
export const SAT_DERIV = 0.1;
export const STD_HIGH = 8;
export const STD_LOW = 0.15;
export const GRAD_LOW = 0.1;
export const GRAD_HIGH = 10;
const DERIV_MAX = { sigmoid: 0.25, tanh: 1 };

export function layerStatus({ act, zStd, sat }) {
  if ((act === 'sigmoid' || act === 'tanh') && sat >= SAT_FRAC) return 'saturated';
  if (zStd > STD_HIGH) return 'exploding';
  if (zStd < STD_LOW) return 'vanishing';
  return 'healthy';
}
export const gradStatus = (ratio) => (ratio < GRAD_LOW ? 'vanishing' : ratio > GRAD_HIGH ? 'exploding' : 'healthy');

/* run(config, X0?) — the raw pass: { tape, gradStd, gradIn, loss, m, n, L }.
   The loss is L = Σ T ⊙ a_top with T a fixed random matrix, so ∂L/∂a at the
   top is T; gradIn is ∂L/∂x (the check compares it with finite
   differences). config: { act, init, bn: null | 'before' | 'after',
   layers?, units?, batch?, seed? } */
export function run(config, X0 = null) {
  const { act, init, bn = null } = config;
  const L = config.layers ?? LAYERS;
  const n = config.units ?? UNITS;
  const m = config.batch ?? BATCH;
  const F = ACT_FNS[act];
  if (!F) throw new Error(`unknown activation ${act}`);
  const R = rng(config.seed ?? SIM_SEED);
  // inputs: standard normal (standardized features, slide 16's first constraint)
  let A = new Float64Array(m * n);
  for (let i = 0; i < A.length; i++) A[i] = R.normal();
  if (X0) A = Float64Array.from(X0);
  const X = A;
  // weights: the same base draws for every init (only the scale differs)
  const Ws = [];
  for (let l = 0; l < L; l++) {
    const W = new Float64Array(n * n);
    if (init === 'glorotUniform') {
      const r = glorotLimit(n, n);
      for (let i = 0; i < W.length; i++) W[i] = (2 * R.next() - 1) * r;
    } else {
      const s = Math.sqrt(initSigma2(init, n, n));
      for (let i = 0; i < W.length; i++) W[i] = R.normal() * s;
    }
    Ws.push(W);
  }
  const top = new Float64Array(m * n);
  for (let i = 0; i < top.length; i++) top[i] = R.normal();

  const tape = [];
  for (let l = 0; l < L; l++) {
    const pre = matmul(A, Ws[l], m, n);
    let zin = pre; // what f is applied to
    let bnB = null;
    if (bn === 'before') { bnB = bnForward(pre, m, n); zin = bnB.out; }
    const a0 = new Float64Array(m * n);
    for (let i = 0; i < a0.length; i++) a0[i] = F.f(zin[i]);
    let out = a0;
    let bnA = null;
    if (bn === 'after') { bnA = bnForward(a0, m, n); out = bnA.out; }
    tape.push({ pre, zin, bnB, bnA, out });
    A = out;
  }
  let loss = 0;
  for (let i = 0; i < A.length; i++) loss += top[i] * A[i];
  // backward: ∂L/∂a at the top down to each layer's ∂L/∂z, then ∂L/∂x
  let G = top;
  const gradStd = new Array(L);
  for (let l = L - 1; l >= 0; l--) {
    const t = tape[l];
    let g = G;
    if (t.bnA) g = bnBackward(g, t.bnA.out, t.bnA.inv, m, n);
    const gz = new Float64Array(m * n);
    for (let i = 0; i < gz.length; i++) gz[i] = g[i] * F.d(t.zin[i]);
    gradStd[l] = stats(gz).std; // ∂L/∂z for the z that f is applied to
    const gpre = t.bnB ? bnBackward(gz, t.bnB.out, t.bnB.inv, m, n) : gz;
    G = matmulT(gpre, Ws[l], m, n);
  }
  return { X, tape, gradStd, gradIn: G, loss, m, n, L };
}

const cache = new Map();
const keyOf = (c) => JSON.stringify([c.act, c.init, c.bn ?? null, c.layers ?? LAYERS, c.units ?? UNITS, c.batch ?? BATCH, c.seed ?? SIM_SEED]);

/* simulate(config) — the run summarised per layer for the stage (memoised) */
export function simulate(config) {
  const key = keyOf(config);
  if (cache.has(key)) return cache.get(key);
  const { act, init, bn = null } = config;
  const { tape, gradStd, L } = run(config);
  const F = ACT_FNS[act];
  const [lo, hi] = histRange(act);
  const dmax = DERIV_MAX[act] ?? 1;
  const layers = tape.map((t, l) => {
    const st = stats(t.out);
    const h = histogram(t.out, lo, hi);
    let satN = 0;
    for (let i = 0; i < t.zin.length; i++) if (F.d(t.zin[i]) < SAT_DERIV * dmax) satN++;
    const sat = satN / t.zin.length;
    const ratio = gradStd[l] / gradStd[L - 1];
    const zStd = stats(t.zin).std;
    const row = { l: l + 1, mean: st.mean, actStd: st.std, zStd, hist: h.bins, under: h.under, over: h.over, sat, gradStd: gradStd[l], ratio };
    row.status = layerStatus({ act, zStd, sat });
    row.gstatus = gradStatus(ratio);
    return row;
  });
  const healthy = layers.filter((r) => r.status === 'healthy' && r.gstatus === 'healthy').length;
  const result = { config: { act, init, bn }, layers, healthy };
  cache.set(key, result);
  return result;
}

/* the overall verdict of a run, by the slides' words: the lower layers'
   gradients (slide 5) and the layers' activations (slide 6) */
export function verdict(sim) {
  const low = sim.layers[0];
  if (low.gstatus === 'vanishing') return 'vanishing';
  if (low.gstatus === 'exploding' || sim.layers.some((r) => r.status === 'exploding')) return 'exploding';
  if (sim.layers.some((r) => r.status === 'saturated')) return 'saturated';
  if (sim.layers.some((r) => r.status === 'vanishing')) return 'vanishing';
  return 'healthy';
}
