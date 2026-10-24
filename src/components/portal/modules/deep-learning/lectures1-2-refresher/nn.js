/* ============================================================================
   LECTURES 1–2 REFRESHER — THE MATHS
   ----------------------------------------------------------------------------
   Everything the labs compute, in the slides' notation, small enough to read:

     L1   step / heaviside / sign, the TLU, the perceptron learning rule
          (slide 10), sigmoid / tanh / ReLU / softplus and their derivatives
          (slides 20–25), a 2-2-1 MLP forward + backward pass (slide 19),
          softmax, cross-entropy (slide 29), MSE / MAE / Huber_δ (slides 27–28)
     L2   per-layer gradient sizes in a deep MLP under N(0,1) / Glorot / He
          initialisation (slides 6–8), leaky ReLU, ELU, SELU, GELU, Swish,
          Mish (slides 11–21), the batch-norm transform (slide 24), clipping by
          value and by norm (slide 29), the optimiser updates (slides 34–45),
          the learning-rate schedules (slides 50–59), ℓ1 / ℓ2 penalties (slide
          60) and a dropout mask (slide 63)

   Pure functions only (no React). Checked by
   tools/dl-lectures1-2-refresher/check-nn.mjs.
   ========================================================================== */

/* ── small helpers ───────────────────────────────────────────────────────── */
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm2 = (v) => Math.sqrt(dot(v, v));
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
export const fmt = (x, d = 2) => {
  if (!Number.isFinite(x)) return String(x);
  const s = x.toFixed(d);
  return (Number(s) === 0 ? (0).toFixed(d) : s).replace('-', '−');
};

// A seeded random number generator (mulberry32) with a normal sampler, so the
// labs draw the same "random" weights every time.
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare = null;
  const normal = () => {
    if (spare !== null) { const s = spare; spare = null; return s; }
    let u = 0;
    let v = 0;
    while (u === 0) u = next();
    while (v === 0) v = next();
    const r = Math.sqrt(-2 * Math.log(u));
    spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  };
  return { next, normal };
}

/* ── L1 · the TLU and the perceptron (slides 4–17) ───────────────────────── */
// slide 5: heaviside(z) = 0 if z < 0, 1 if z ≥ 0; sign(z) = −1, 0, +1
export const heaviside = (z) => (z < 0 ? 0 : 1);
export const sign = (z) => (z < 0 ? -1 : z > 0 ? 1 : 0);

// slide 4: z = w₁x₁ + … + wₙxₙ + b = wᵀx + b, h_w,b(x) = step(z)
export const tluZ = (w, b, x) => dot(w, x) + b;
export const tlu = (w, b, x) => heaviside(tluZ(w, b, x));

/* slide 10: w_i,j(next step) = w_i,j + η (y_j − ŷ_j) x_i, for one output
   neuron. The bias is updated the same way, as the weight of an input that
   is always 1 (this page's choice; slide 10 writes the rule for weights). */
export function perceptronStep(w, b, x, y, eta) {
  const yhat = tlu(w, b, x);
  const err = y - yhat;
  return {
    yhat,
    err,
    w: w.map((wi, i) => wi + eta * err * x[i]),
    b: b + eta * err,
  };
}

/* Rosenblatt's loop: one instance at a time, in order, epoch after epoch,
   until an epoch makes no mistakes (or maxEpochs). Returns every update (the
   instances it got wrong) so a lab can replay them. */
export function trainPerceptron(data, { w = [0, 0], b = 0, eta = 1, maxEpochs = 50 } = {}) {
  const updates = [];
  let cur = { w: [...w], b };
  let epoch = 0;
  for (; epoch < maxEpochs; epoch++) {
    let mistakes = 0;
    data.forEach((p, idx) => {
      const r = perceptronStep(cur.w, cur.b, p.x, p.y, eta);
      if (r.err !== 0) {
        mistakes += 1;
        updates.push({ epoch, idx, x: p.x, y: p.y, yhat: r.yhat, err: r.err, before: cur, after: { w: r.w, b: r.b } });
        cur = { w: r.w, b: r.b };
      }
    });
    if (mistakes === 0) return { updates, final: cur, epochs: epoch + 1, converged: true };
  }
  return { updates, final: cur, epochs: epoch, converged: false };
}

// How many points a line gets right.
export const accuracy = (data, w, b) => data.filter((p) => tlu(w, b, p.x) === p.y).length;

/* slide 17, Figure 10-6b: the MLP that solves XOR. Hidden TLUs: weights 1, 1
   and biases −3/2 and −1/2; output TLU: weights −1, 1 and bias −1/2. */
export const XOR_MLP = {
  hidden: [
    { w: [1, 1], b: -1.5 },
    { w: [1, 1], b: -0.5 },
  ],
  out: { w: [-1, 1], b: -0.5 },
};
export function xorMlp(x, net = XOR_MLP) {
  const h = net.hidden.map((n) => tlu(n.w, n.b, x));
  return { h, y: tlu(net.out.w, net.out.b, h) };
}
export const XOR_DATA = [
  { x: [0, 0], y: 0 },
  { x: [0, 1], y: 1 },
  { x: [1, 0], y: 1 },
  { x: [1, 1], y: 0 },
];

/* ── L1 · activation functions (slides 20–25) ───────────────────────────── */
export const sigmoid = (z) => 1 / (1 + Math.exp(-z));
export const dSigmoid = (z) => { const s = sigmoid(z); return s * (1 - s); }; // slide 20: σ(1 − σ)
export const tanh = (z) => Math.tanh(z);
export const dTanh = (z) => 1 - Math.tanh(z) ** 2;
export const relu = (z) => Math.max(0, z);
export const dRelu = (z) => (z > 0 ? 1 : 0); // undefined at 0; drawn as a jump
export const softplus = (z) => (z > 30 ? z : Math.log(1 + Math.exp(z)));
export const dHeaviside = () => 0; // 0 everywhere it exists (undefined at 0)

/* ── L2 · nonsaturating activations (slides 11–21) ──────────────────────── */
export const leakyRelu = (z, alpha = 0.2) => Math.max(alpha * z, z);
export const dLeakyRelu = (z, alpha = 0.2) => (z > 0 ? 1 : alpha);
export const elu = (z, alpha = 1) => (z < 0 ? alpha * (Math.exp(z) - 1) : z);
export const dElu = (z, alpha = 1) => (z < 0 ? alpha * Math.exp(z) : 1);
// slide 16: SELU(z) = s · ELU_1.6733(z), s = 1.0507
export const SELU_ALPHA = 1.6733;
export const SELU_S = 1.0507;
export const selu = (z) => SELU_S * elu(z, SELU_ALPHA);
export const dSelu = (z) => SELU_S * dElu(z, SELU_ALPHA);

// The error function (Abramowitz & Stegun 7.1.26, |error| < 1.5e-7), for Φ.
export function erf(x) {
  const s = x < 0 ? -1 : 1;
  const a = Math.abs(x);
  const t = 1 / (1 + 0.3275911 * a);
  const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}
export const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2)); // standard normal CDF
export const phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
// slide 18: GELU(z) = z Φ(z)
export const gelu = (z) => z * Phi(z);
export const dGelu = (z) => Phi(z) + z * phi(z);
// slide 19: Swish_β(z) = z σ(βz); SiLU = Swish with β = 1
export const swish = (z, beta = 1) => z * sigmoid(beta * z);
export const dSwish = (z, beta = 1) => { const s = sigmoid(beta * z); return s + beta * z * s * (1 - s); };
// slide 20: Mish(z) = z tanh(softplus(z))
export const mish = (z) => z * Math.tanh(softplus(z));
export const dMish = (z) => {
  const t = Math.tanh(softplus(z));
  return t + z * (1 - t * t) * sigmoid(z);
};

/* Every activation a lab can draw: f, f′, and the slide that defines it. */
export const ACT = {
  heaviside: { f: heaviside, d: dHeaviside, name: 'Heaviside', slide: 'L1 · 5' },
  sigmoid: { f: sigmoid, d: dSigmoid, name: 'sigmoid', slide: 'L1 · 20' },
  tanh: { f: tanh, d: dTanh, name: 'tanh', slide: 'L1 · 21' },
  relu: { f: relu, d: dRelu, name: 'ReLU', slide: 'L1 · 21' },
  leaky: { f: (z) => leakyRelu(z, 0.2), d: (z) => dLeakyRelu(z, 0.2), name: 'leaky ReLU (α = 0.2)', slide: 'L2 · 11' },
  elu: { f: (z) => elu(z, 1), d: (z) => dElu(z, 1), name: 'ELU (α = 1)', slide: 'L2 · 15' },
  selu: { f: selu, d: dSelu, name: 'SELU', slide: 'L2 · 16' },
  gelu: { f: gelu, d: dGelu, name: 'GELU', slide: 'L2 · 18' },
  swish: { f: (z) => swish(z, 1), d: (z) => dSwish(z, 1), name: 'Swish = SiLU', slide: 'L2 · 19' },
  mish: { f: mish, d: dMish, name: 'Mish', slide: 'L2 · 20' },
};

/* ── L1 · a tiny MLP and backprop (slides 18–20) ─────────────────────────── */
/* A 2-2-1 net, sigmoid everywhere, one training instance, the loss
   L = ½(ŷ − y)² (the loss slide 11's handwriting uses). Weights:
   W[i][j] input i → hidden j, b[j]; v[j] hidden j → output, c. */
export function mlpForward(net, x) {
  const z = [0, 1].map((j) => x[0] * net.W[0][j] + x[1] * net.W[1][j] + net.b[j]);
  const h = z.map(sigmoid);
  const zo = h[0] * net.v[0] + h[1] * net.v[1] + net.c;
  const yhat = sigmoid(zo);
  return { z, h, zo, yhat };
}

export function mlpBackward(net, x, y) {
  const f = mlpForward(net, x);
  const loss = 0.5 * (f.yhat - y) ** 2;
  const dOut = (f.yhat - y) * f.yhat * (1 - f.yhat); // ∂L/∂z_o, using σ′ = σ(1 − σ)
  const gv = f.h.map((hj) => dOut * hj);
  const gc = dOut;
  const dHid = f.h.map((hj, j) => dOut * net.v[j] * hj * (1 - hj)); // ∂L/∂z_j
  const gW = [0, 1].map((i) => [0, 1].map((j) => dHid[j] * x[i]));
  const gb = dHid;
  return { ...f, loss, dOut, dHid, gW, gb, gv, gc };
}

export function mlpUpdate(net, g, eta) {
  return {
    W: net.W.map((row, i) => row.map((w, j) => w - eta * g.gW[i][j])),
    b: net.b.map((bj, j) => bj - eta * g.gb[j]),
    v: net.v.map((vj, j) => vj - eta * g.gv[j]),
    c: net.c - eta * g.gc,
  };
}

/* ── L1 · output layers and losses (slides 24–31) ───────────────────────── */
export function softmax(z) {
  const m = Math.max(...z);
  const e = z.map((v) => Math.exp(v - m));
  const s = e.reduce((a, v) => a + v, 0);
  return e.map((v) => v / s);
}
// slide 29: J(θ) = −(1/m) Σᵢ Σₖ y_k log p̂_k ; for one instance with a
// one-hot target this is −log p̂ of the true class
export const crossEntropy = (p, k) => -Math.log(Math.max(1e-12, p[k]));
export const sqErr = (z) => z * z; // slide 28's left panel: "sq. error" = z² (Huber's quadratic part is ½z²)
export const absErr = (z) => Math.abs(z);
// slide 28: Huber_δ(z) = ½z² if |z| ≤ δ, δ(|z| − ½δ) otherwise
export const huber = (z, delta = 1) => (Math.abs(z) <= delta ? 0.5 * z * z : delta * (Math.abs(z) - 0.5 * delta));

/* Dense layer parameters: inputs × units weights + units biases. */
export const denseParams = (inputs, units) => inputs * units + units;

/* ── L2 · gradients through depth (slides 5–8) ──────────────────────────── */
/* A deep MLP of `layers` dense layers of `width` units. Weights are drawn
   from N(0, σ²) with σ² from the initialisation (slide 7–8):
     'normal'  σ² = 1            ("usually drawn from N(0, 1)", slide 6)
     'glorot'  σ² = 1/fan_avg    (slide 7)
     'he'      σ² = 2/fan_in     (slide 8)
   A batch of standardised inputs goes forward; the gradient of a loss whose
   output gradient is N(0, 1) goes back. Returns, per layer (1 = nearest the
   input), the mean |∂L/∂W| and the std of the layer's outputs. */
export const INIT_VAR = {
  normal: () => 1,
  glorot: (fin, fout) => 1 / ((fin + fout) / 2),
  he: (fin) => 2 / fin,
};
const ACT_FD = {
  sigmoid: [sigmoid, dSigmoid],
  tanh: [tanh, dTanh],
  relu: [relu, dRelu],
};

export function gradientFlow({ init = 'glorot', act = 'sigmoid', layers = 10, width = 40, batch = 32, seed = 7 } = {}) {
  const R = rng(seed);
  const [f, df] = ACT_FD[act];
  const Ws = [];
  for (let l = 0; l < layers; l++) {
    const sd = Math.sqrt(INIT_VAR[init](width, width));
    Ws.push(Array.from({ length: width }, () => Array.from({ length: width }, () => sd * R.normal())));
  }
  // forward: keep each layer's input and pre-activation
  let a = Array.from({ length: batch }, () => Array.from({ length: width }, () => R.normal()));
  const inputs = [];
  const zs = [];
  const outStd = [];
  for (let l = 0; l < layers; l++) {
    inputs.push(a);
    const W = Ws[l];
    const z = a.map((row) => Array.from({ length: width }, (_, j) => row.reduce((s, v, i) => s + v * W[i][j], 0)));
    zs.push(z);
    a = z.map((row) => row.map(f));
    const flat = a.flat();
    const mean = flat.reduce((s, v) => s + v, 0) / flat.length;
    outStd.push(Math.sqrt(flat.reduce((s, v) => s + (v - mean) ** 2, 0) / flat.length));
  }
  // backward
  let g = Array.from({ length: batch }, () => Array.from({ length: width }, () => R.normal()));
  const gradW = new Array(layers);
  for (let l = layers - 1; l >= 0; l--) {
    const delta = g.map((row, n) => row.map((v, j) => v * df(zs[l][n][j])));
    let sum = 0;
    for (let i = 0; i < width; i++) {
      for (let j = 0; j < width; j++) {
        let s = 0;
        for (let n = 0; n < batch; n++) s += inputs[l][n][i] * delta[n][j];
        sum += Math.abs(s / batch);
      }
    }
    gradW[l] = sum / (width * width);
    const W = Ws[l];
    g = delta.map((row) => Array.from({ length: width }, (_, i) => row.reduce((s, v, j) => s + v * W[i][j], 0)));
  }
  return { gradW, outStd };
}

/* ── L2 · batch normalisation (slide 24) ────────────────────────────────── */
export function batchNorm(xs, gamma = 1, beta = 0, eps = 1e-3) {
  const m = xs.length;
  const mu = xs.reduce((s, v) => s + v, 0) / m;
  const v2 = xs.reduce((s, v) => s + (v - mu) ** 2, 0) / m;
  const xhat = xs.map((v) => (v - mu) / Math.sqrt(v2 + eps));
  const z = xhat.map((v) => gamma * v + beta);
  return { mu, var: v2, xhat, z };
}

/* ── L2 · gradient clipping (slide 29) ──────────────────────────────────── */
export const clipValue = (g, c = 1) => g.map((v) => clamp(v, -c, c));
export function clipNorm(g, c = 1) {
  const n = norm2(g);
  return n > c ? g.map((v) => (v * c) / n) : [...g];
}
export const angleDeg = (g) => (Math.atan2(g[1], g[0]) * 180) / Math.PI;

/* ── L2 · optimisers (slides 34–45) ─────────────────────────────────────── */
/* One update of θ given ∇J, with the optimiser's state. Defaults are the
   slides': β = 0.9 (34), ρ = 0.9 (41), β₁ = 0.9 and β₂ = 0.999 (44),
   ε = 10⁻¹⁰ (38; Keras's own default differs). Every rule is element-wise.
   `gradAt(θ)` is the gradient function (NAG needs it at a look-ahead point). */
export const OPTIMISERS = ['sgd', 'momentum', 'nag', 'adagrad', 'rmsprop', 'adam'];

export function optStep(kind, theta, state, gradAt, hp = {}) {
  const { eta = 0.1, beta = 0.9, rho = 0.9, beta1 = 0.9, beta2 = 0.999, eps = 1e-10 } = hp;
  const n = theta.length;
  const zeros = () => new Array(n).fill(0);
  const m = state.m ?? zeros();
  const s = state.s ?? zeros();
  const t = (state.t ?? 0) + 1;
  switch (kind) {
    case 'sgd': { // θ ← θ − η∇J(θ)
      const g = gradAt(theta);
      return { theta: theta.map((v, i) => v - eta * g[i]), state: { t } };
    }
    case 'momentum': { // m ← βm − η∇J(θ); θ ← θ + m
      const g = gradAt(theta);
      const m2 = m.map((v, i) => beta * v - eta * g[i]);
      return { theta: theta.map((v, i) => v + m2[i]), state: { m: m2, t } };
    }
    case 'nag': { // m ← βm − η∇J(θ + βm); θ ← θ + m
      const g = gradAt(theta.map((v, i) => v + beta * m[i]));
      const m2 = m.map((v, i) => beta * v - eta * g[i]);
      return { theta: theta.map((v, i) => v + m2[i]), state: { m: m2, t } };
    }
    case 'adagrad': { // s ← s + ∇J ⊗ ∇J; θ ← θ − η∇J ⊘ √(s + ε)
      const g = gradAt(theta);
      const s2 = s.map((v, i) => v + g[i] * g[i]);
      return { theta: theta.map((v, i) => v - (eta * g[i]) / Math.sqrt(s2[i] + eps)), state: { s: s2, t } };
    }
    case 'rmsprop': { // s ← ρs + (1 − ρ)∇J ⊗ ∇J; θ ← θ − η∇J ⊘ √(s + ε)
      const g = gradAt(theta);
      const s2 = s.map((v, i) => rho * v + (1 - rho) * g[i] * g[i]);
      return { theta: theta.map((v, i) => v - (eta * g[i]) / Math.sqrt(s2[i] + eps)), state: { s: s2, t } };
    }
    case 'adam': { // slide 43, steps 1–5
      const g = gradAt(theta);
      const m2 = m.map((v, i) => beta1 * v + (1 - beta1) * g[i]);
      const s2 = s.map((v, i) => beta2 * v + (1 - beta2) * g[i] * g[i]);
      const mh = m2.map((v) => v / (1 - beta1 ** t));
      const sh = s2.map((v) => v / (1 - beta2 ** t));
      return { theta: theta.map((v, i) => v - (eta * mh[i]) / Math.sqrt(sh[i] + eps)), state: { m: m2, s: s2, t } };
    }
    default:
      throw new Error(`unknown optimiser ${kind}`);
  }
}

export function optPath(kind, start, gradAt, steps, hp) {
  const path = [start];
  let theta = start;
  let state = {};
  for (let k = 0; k < steps; k++) {
    const r = optStep(kind, theta, state, gradAt, hp);
    theta = r.theta;
    state = r.state;
    path.push(theta);
  }
  return path;
}

/* ── L2 · learning-rate schedules (slides 50–59) ────────────────────────── */
// slide 50: η(t) = η₀ / (1 + rt/s)^c
export const powerLR = (t, { eta0 = 0.01, r = 1, s = 10, c = 1 } = {}) => eta0 / (1 + (r * t) / s) ** c;
// slide 52: η(t) = η₀ r^(t/s)
export const expLR = (t, { eta0 = 0.1, r = 0.1, s = 15 } = {}) => eta0 * r ** (t / s);
// slide 55–56: a constant rate per interval; boundaries like PiecewiseConstantDecay
export function piecewiseLR(t, { boundaries = [5, 20, 30], values = [0.1, 0.04, 0.02, 0.01] } = {}) {
  let k = 0;
  while (k < boundaries.length && t >= boundaries[k]) k += 1;
  return values[k];
}
/* slide 59 (1cycle): up linearly from η₀ to η₁ halfway, back down linearly to
   η₀, then the last few epochs drop by several orders of magnitude (still
   linearly). `tail` is the fraction of training spent on that last drop. */
export function oneCycleLR(t, { T = 50, eta0 = 0.01, eta1 = 0.1, tail = 0.1, floor = 0.0001 } = {}) {
  const tEnd = T * (1 - tail);
  const half = tEnd / 2;
  if (t <= half) return eta0 + ((eta1 - eta0) * t) / half;
  if (t <= tEnd) return eta1 - ((eta1 - eta0) * (t - half)) / half;
  return eta0 - ((eta0 - floor) * (t - tEnd)) / (T - tEnd);
}
/* slide 57 (performance scheduling, ReduceLROnPlateau(factor, patience)):
   multiply η by `factor` when the best validation loss hasn't improved for
   `patience` epochs. `val` is a validation-loss curve (this page's own). */
export function performanceLR(val, { eta0 = 0.01, factor = 0.5, patience = 5 } = {}) {
  const out = [];
  let eta = eta0;
  let best = Infinity;
  let wait = 0;
  val.forEach((v) => {
    out.push(eta);
    if (v < best - 1e-9) { best = v; wait = 0; } else {
      wait += 1;
      if (wait >= patience) { eta *= factor; wait = 0; }
    }
  });
  return out;
}

/* ── L2 · regularisation (slides 60–64) ─────────────────────────────────── */
export const l1Penalty = (w, lam) => lam * w.reduce((s, v) => s + Math.abs(v), 0);
export const l2Penalty = (w, lam) => lam * w.reduce((s, v) => s + v * v, 0);
/* One gradient step on the penalty alone. ℓ2's pull (2λw) shrinks with the
   weight; ℓ1's (λ sign w) doesn't, so a small weight is pulled right to 0
   (where a step would cross zero it stops at 0 — this page's handling). */
export function penaltyStep(w, kind, lam, eta) {
  if (kind === 'l2') return w.map((v) => v - eta * 2 * lam * v);
  return w.map((v) => {
    const nv = v - eta * lam * sign(v);
    return Math.sign(nv) !== Math.sign(v) ? 0 : nv;
  });
}

// slide 63: each neuron (inputs and hidden, never outputs) is dropped with
// probability p at a training step; true = kept
export function dropoutMask(n, p, R) {
  return Array.from({ length: n }, () => R.next() >= p);
}
