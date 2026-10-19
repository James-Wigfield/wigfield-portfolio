/* ============================================================================
   LECTURE 4 STUDY — RNN MATHS
   ----------------------------------------------------------------------------
   The pure functions behind every lab: recurrent steps (SimpleRNN, LSTM,
   GRU) in the slides' row-vector notation, Keras parameter counts, a port of
   tf.keras.utils.timeseries_dataset_from_array, Conv1D, the naive-forecast
   metrics (MAE, MAPE), and a least-squares linear forecaster used as a
   labelled stand-in. No React, no DOM.

   Conventions (slide 9): a time step's vectors are ROW vectors, so a layer is
   x^T W with W of shape n_in × n_out, stored as an array of n_in rows.
   ========================================================================== */

// ── Formatting ──────────────────────────────────────────────────────────────
export const fmtInt = (n) => Math.round(n).toLocaleString('en-AU');
export const fmtNum = (v, dp = 2) => (Number.isFinite(v) ? v.toFixed(dp) : '—');
export const fmtSigned = (v, dp = 2) => (Number.isFinite(v) ? `${v < 0 ? '−' : ''}${Math.abs(v).toFixed(dp)}` : '—');
// a CSS class for the sign of a value (orange positive, blue negative)
export const signClass = (v) => (v > 0.005 ? 'dl4s-pos' : v < -0.005 ? 'dl4s-neg' : '');

// ── Activations ─────────────────────────────────────────────────────────────
export const sigmoid = (a) => 1 / (1 + Math.exp(-a));
export const relu = (a) => Math.max(0, a);
export const tanh = Math.tanh;
export const ACT = { tanh, relu, sigmoid, linear: (a) => a };
// derivatives, written in terms of the pre-activation a
export const DACT = {
  tanh: (a) => 1 - Math.tanh(a) ** 2,
  relu: (a) => (a > 0 ? 1 : 0),
  sigmoid: (a) => sigmoid(a) * (1 - sigmoid(a)),
  linear: () => 1,
};

// ── Small linear algebra (row-vector convention) ────────────────────────────
// x^T W: x has n_in entries, W is n_in rows of n_out
export function rowTimes(x, W) {
  const nOut = W[0]?.length ?? 0;
  const out = new Array(nOut).fill(0);
  for (let i = 0; i < x.length; i++) for (let j = 0; j < nOut; j++) out[j] += x[i] * W[i][j];
  return out;
}
export const addVec = (...vs) => vs[0].map((_, j) => vs.reduce((a, v) => a + v[j], 0));
export const mulVec = (a, b) => a.map((v, j) => v * b[j]); // element-wise ⊗
export const mapVec = (v, f) => v.map(f);
export const zeros = (n) => new Array(n).fill(0);

// Deterministic small weights for the toy layers (seeded, so the page shows
// the same numbers on every visit).
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function randMatrix(rows, cols, seed, scale = 0.6) {
  const rnd = mulberry32(seed);
  return Array.from({ length: rows }, () => Array.from({ length: cols }, () => Math.round((rnd() * 2 - 1) * scale * 100) / 100));
}

// ── SimpleRNN (slide 9) ─────────────────────────────────────────────────────
//   h^T_(t) = φ_h(h^T_(t−1) W_h + x^T_(t) W_x + b^T_h)
//   y^T_(t) = φ_y(h^T_(t) W_y + b^T_y)
export function rnnStep(h, x, { Wh, Wx, bh, phi = 'tanh' }) {
  const a = addVec(rowTimes(h, Wh), rowTimes(x, Wx), bh);
  return { a, h: a.map(ACT[phi]) };
}
export function rnnOut(h, { Wy, by, phiY = 'linear' }) {
  const a = addVec(rowTimes(h, Wy), by);
  return a.map(ACT[phiY]);
}
// Unroll over a whole sequence from h_(0) (zeros unless given).
export function rnnForward(xs, p, h0) {
  let h = h0 ?? zeros(p.Wh.length);
  const steps = [];
  xs.forEach((x) => {
    const s = rnnStep(h, x, p);
    const y = p.Wy ? rnnOut(s.h, p) : null;
    steps.push({ x, hPrev: h, a: s.a, h: s.h, y });
    h = s.h;
  });
  return steps;
}

// ── LSTM (slide 47) ─────────────────────────────────────────────────────────
//   i, f, o = σ(x^T W_x· + h^T_(t−1) W_h· + b^T_·)   g = tanh(…)
//   c_(t) = f ⊗ c_(t−1) + i ⊗ g        y_(t) = h_(t) = o ⊗ tanh(c_(t))
export const LSTM_GATES = ['i', 'f', 'o', 'g'];
export function lstmStep(x, hPrev, cPrev, W) {
  const pre = {};
  const out = {};
  LSTM_GATES.forEach((k) => {
    pre[k] = addVec(rowTimes(x, W[`Wx${k}`]), rowTimes(hPrev, W[`Wh${k}`]), W[`b${k}`]);
    out[k] = pre[k].map(k === 'g' ? tanh : sigmoid);
  });
  const keep = mulVec(out.f, cPrev);
  const add = mulVec(out.i, out.g);
  const c = addVec(keep, add);
  const tc = c.map(tanh);
  const h = mulVec(out.o, tc);
  return { pre, ...out, keep, add, c, tc, h };
}
export function lstmForward(xs, W, units) {
  let h = zeros(units);
  let c = zeros(units);
  return xs.map((x) => {
    const s = lstmStep(x, h, c, W);
    const row = { x, hPrev: h, cPrev: c, ...s };
    h = s.h;
    c = s.c;
    return row;
  });
}

// ── GRU (slide 49) ──────────────────────────────────────────────────────────
//   z, r = σ(x^T W_x· + h^T_(t−1) W_h· + b^T_·)
//   g = tanh(x^T W_xg + (r^T ⊗ h^T_(t−1)) W_hg + b^T_g)
//   h_(t) = z ⊗ h_(t−1) + (1 − z) ⊗ g
export function gruStep(x, hPrev, W) {
  const preZ = addVec(rowTimes(x, W.Wxz), rowTimes(hPrev, W.Whz), W.bz);
  const preR = addVec(rowTimes(x, W.Wxr), rowTimes(hPrev, W.Whr), W.br);
  const z = preZ.map(sigmoid);
  const r = preR.map(sigmoid);
  const rh = mulVec(r, hPrev);
  const preG = addVec(rowTimes(x, W.Wxg), rowTimes(rh, W.Whg), W.bg);
  const g = preG.map(tanh);
  const keep = mulVec(z, hPrev);
  const add = mulVec(z.map((v) => 1 - v), g);
  const h = addVec(keep, add);
  return { pre: { z: preZ, r: preR, g: preG }, z, r, rh, g, keep, add, h };
}
export function gruForward(xs, W, units) {
  let h = zeros(units);
  return xs.map((x) => {
    const s = gruStep(x, h, W);
    const row = { x, hPrev: h, ...s };
    h = s.h;
    return row;
  });
}

// ── Keras parameter counts ──────────────────────────────────────────────────
export const denseParams = (nIn, units) => nIn * units + units;
// SimpleRNN: W_x (n_in × units) + W_h (units × units) + b (units)
export const simpleRnnParams = (units, nIn) => units * nIn + units * units + units;
// LSTM: four such blocks (i, f, o, g)
export const lstmParams = (units, nIn) => 4 * (units * nIn + units * units + units);
// GRU: three blocks (z, r, g). The slide-49 equations have one bias per block;
// Keras's default GRU (reset_after=True) keeps two bias vectors per block —
// that is what makes slide 49's 1,401.
export const gruParams = (units, nIn, resetAfter = true) => 3 * (units * nIn + units * units + (resetAfter ? 2 : 1) * units);
export const conv1dParams = (filters, kernel, nIn) => kernel * nIn * filters + filters;

// Conv1D output length (Keras): "valid" never leaves the sequence; "same"
// pads so that out = ⌈n / s⌉; "causal" pads only on the left.
export function conv1dLen(n, k, s, padding = 'valid') {
  if (padding === 'same' || padding === 'causal') return Math.ceil(n / s);
  return n >= k ? Math.floor((n - k) / s) + 1 : 0;
}

// One Conv1D filter over a 1-D sequence ("valid"), with the window positions.
export function conv1d(seq, kernel, stride = 1, bias = 0) {
  const k = kernel.length;
  const out = [];
  for (let start = 0; start + k <= seq.length; start += stride) {
    let s = bias;
    for (let j = 0; j < k; j++) s += seq[start + j] * kernel[j];
    out.push({ start, value: s });
  }
  return out;
}

// ── tf.keras.utils.timeseries_dataset_from_array, ported ────────────────────
// Faithful to Keras's logic: num_seqs = end − start − (sequence_length − 1) ·
// sampling_rate, capped at len(targets); windows start every sequence_stride;
// the target of the window starting at p is targets[p]; the last batch may be
// short. shuffle uses this page's own seeded RNG (not TensorFlow's), so the
// ORDER of shuffled windows will differ from TF even with the same seed.
export function timeseriesDataset(data, targets, {
  sequence_length,
  sequence_stride = 1,
  sampling_rate = 1,
  batch_size = 128,
  shuffle = false,
  seed = 0,
  start_index = 0,
  end_index = data.length,
} = {}) {
  let numSeqs = end_index - start_index - (sequence_length - 1) * sampling_rate;
  if (targets != null) numSeqs = Math.min(numSeqs, targets.length);
  numSeqs = Math.max(0, numSeqs);
  const starts = [];
  for (let p = 0; p < numSeqs; p += sequence_stride) starts.push(p);
  if (shuffle) {
    const rnd = mulberry32(seed);
    for (let i = starts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [starts[i], starts[j]] = [starts[j], starts[i]];
    }
  }
  const windows = starts.map((p) => {
    const idx = Array.from({ length: sequence_length }, (_, i) => start_index + p + i * sampling_rate);
    return { start: p, idx, x: idx.map((i) => data[i]), y: targets != null ? targets[start_index + p] : undefined, yIdx: start_index + p };
  });
  const batches = [];
  for (let b = 0; b < windows.length; b += batch_size) batches.push(windows.slice(b, b + batch_size));
  return { numSeqs, windows, batches };
}

// Shape of a batch as Keras prints it: (batch, sequence_length[, features]).
export function batchShape(batch, features = null) {
  const n = batch.length;
  const len = batch[0]?.x.length ?? 0;
  return features == null ? `(${n}, ${len})` : `(${n}, ${len}, ${features})`;
}

// ── Series helpers (pandas semantics) ───────────────────────────────────────
// diff(k): out[t] = s[t] − s[t − k]; NaN for the first k rows
export const diff = (s, k) => s.map((v, t) => (t >= k ? v - s[t - k] : NaN));
export const shift = (s, k) => s.map((_, t) => (t - k >= 0 && t - k < s.length ? s[t - k] : NaN));

export function mae(err) {
  let sum = 0;
  let n = 0;
  err.forEach((e) => { if (Number.isFinite(e)) { sum += Math.abs(e); n += 1; } });
  return n ? sum / n : NaN;
}
// MAPE as slide 18 computes it: mean of |error / target| (a fraction, not %)
export function mape(err, target) {
  let sum = 0;
  let n = 0;
  err.forEach((e, i) => { if (Number.isFinite(e) && target[i]) { sum += Math.abs(e / target[i]); n += 1; } });
  return n ? sum / n : NaN;
}

// ── Dates (UTC day arithmetic over the contiguous daily index) ──────────────
const DAY = 86400000;
export const dayIndex = (startISO, iso) => Math.round((Date.parse(`${iso}T00:00:00Z`) - Date.parse(`${startISO}T00:00:00Z`)) / DAY);
export const isoAt = (startISO, i) => new Date(Date.parse(`${startISO}T00:00:00Z`) + i * DAY).toISOString().slice(0, 10);
// The pandas partial-string slice "YYYY-MM":"YYYY-MM" → inclusive index range
export function monthRange(startISO, from, to) {
  const a = dayIndex(startISO, `${from}-01`);
  const [y, m] = to.split('-').map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const b = dayIndex(startISO, `${to}-${String(last).padStart(2, '0')}`);
  return [a, b];
}

// ── A least-squares linear forecaster (this page's stand-in) ────────────────
// Fits y ≈ w·window + b on training windows by ridge-regularised normal
// equations. Used only where a page needs *a* trained one-step predictor to
// show a mechanism (the slide-34 loop); its numbers are never the slides'.
export function fitLinear(windows, ys, lambda = 1e-4) {
  const d = windows[0].length + 1;
  const A = Array.from({ length: d }, () => new Array(d).fill(0));
  const v = new Array(d).fill(0);
  windows.forEach((w, n) => {
    const row = [...w, 1];
    for (let i = 0; i < d; i++) {
      v[i] += row[i] * ys[n];
      for (let j = 0; j < d; j++) A[i][j] += row[i] * row[j];
    }
  });
  for (let i = 0; i < d - 1; i++) A[i][i] += lambda * windows.length;
  return solve(A, v);
}
export const predictLinear = (wts, window) => window.reduce((a, x, i) => a + x * wts[i], wts[wts.length - 1]);

// Gaussian elimination with partial pivoting (A is copied).
function solve(A0, b0) {
  const n = b0.length;
  const A = A0.map((r) => [...r]);
  const b = [...b0];
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    [b[c], b[p]] = [b[p], b[c]];
    for (let r = c + 1; r < n; r++) {
      const f = A[r][c] / A[c][c];
      if (!f) continue;
      for (let k = c; k < n; k++) A[r][k] -= f * A[c][k];
      b[r] -= f * b[c];
    }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) {
    let s = b[r];
    for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k];
    x[r] = s / A[r][r];
  }
  return x;
}

// ── Gradients through time (slide 40) ───────────────────────────────────────
// One recurrent unit, h_(t) = φ(w·h_(t−1) + u·x_(t) + b), run for T steps.
// The gradient of h_(t) with respect to h_(0) is the product of w·φ′(a_k)
// over the steps — the same w at every step, so it shrinks or grows
// geometrically.
export function gradientThroughTime({ w, u = 1, b = 0, phi = 'tanh', xs, h0 = 0 }) {
  let h = h0;
  let g = 1;
  const rows = [{ t: 0, h, g }];
  xs.forEach((x, k) => {
    const a = w * h + u * x + b;
    h = ACT[phi](a);
    g *= w * DACT[phi](a);
    rows.push({ t: k + 1, h, g, a });
  });
  return rows;
}

// Batch norm vs layer norm over a [batch × features] grid (slide 41): which
// cells share one mean and variance.
export function normStats(grid, axis) {
  // axis 'batch' → one (μ, σ) per feature column; 'features' → per row
  const rows = grid.length;
  const cols = grid[0].length;
  const groups = axis === 'batch' ? cols : rows;
  return Array.from({ length: groups }, (_, g) => {
    const vals = axis === 'batch' ? grid.map((r) => r[g]) : grid[g];
    const mu = vals.reduce((a, v) => a + v, 0) / vals.length;
    const sd = Math.sqrt(vals.reduce((a, v) => a + (v - mu) ** 2, 0) / vals.length);
    return { mu, sd, norm: vals.map((v) => (sd ? (v - mu) / sd : 0)) };
  });
}

// ── Backpropagation through time (slide 14, the §5 lab) ────────────────────
// One scalar recurrent unit, h(t) = tanh(w·h(t−1) + u·x(t) + b), ŷ(t) = h(t),
// h before step 0 = 0.
export function scalarRnnForward({ w, u, b }, xs) {
  let h = 0;
  return xs.map((x) => {
    const hPrev = h;
    const a = w * hPrev + u * x + b;
    h = Math.tanh(a);
    return { x, hPrev, a, h };
  });
}

// Mean squared error over the time steps in S (0 when S is empty).
export function seqMse(f, ys, S) {
  if (!S.length) return 0;
  return S.reduce((acc, t) => acc + (f[t].h - ys[t]) ** 2, 0) / S.length;
}

// Backpropagation through time for the unit above, written out step by step:
//   ∂ℒ/∂ŷ(t) = 2(ŷ(t) − y(t)) / |S|  for t in S, else 0
//   ∂ℒ/∂h(t) = ∂ℒ/∂ŷ(t) + w · ∂ℒ/∂a(t+1)        (nothing after the last step)
//   ∂ℒ/∂a(t) = ∂ℒ/∂h(t) · (1 − h(t)²)
// and each step's share of the shared parameters' gradients:
//   ∂ℒ/∂w ← ∂ℒ/∂a(t)·h(t−1)   ∂ℒ/∂u ← ∂ℒ/∂a(t)·x(t)   ∂ℒ/∂b ← ∂ℒ/∂a(t)
export function scalarBptt(p, xs, ys, S) {
  const f = scalarRnnForward(p, xs);
  const T = xs.length;
  const n = S.length;
  const inS = new Set(S);
  const gy = f.map((s, t) => (inS.has(t) ? (2 / n) * (s.h - ys[t]) : 0));
  const gh = new Array(T).fill(0);
  const ga = new Array(T).fill(0);
  for (let t = T - 1; t >= 0; t--) {
    gh[t] = gy[t] + (t < T - 1 ? p.w * ga[t + 1] : 0);
    ga[t] = gh[t] * (1 - f[t].h ** 2);
  }
  const share = {
    w: ga.map((g, t) => g * f[t].hPrev),
    u: ga.map((g, t) => g * xs[t]),
    b: ga.slice(),
  };
  const sum = (v) => v.reduce((a, x) => a + x, 0);
  return { f, L: seqMse(f, ys, S), gy, gh, ga, share, total: { w: sum(share.w), u: sum(share.u), b: sum(share.b) } };
}

// Central finite difference of the loss with respect to one parameter.
export function numericalGrad(p, key, xs, ys, S, eps = 1e-4) {
  const lossAt = (v) => seqMse(scalarRnnForward({ ...p, [key]: v }, xs), ys, S);
  return (lossAt(p[key] + eps) - lossAt(p[key] - eps)) / (2 * eps);
}
