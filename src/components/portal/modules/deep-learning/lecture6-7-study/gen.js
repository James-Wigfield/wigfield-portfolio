/* ============================================================================
   LECTURES 6–7 STUDY — THE MATHS
   ----------------------------------------------------------------------------
   Everything the labs compute, in plain JS, deterministic (seeded):

     rng / gauss            a seeded PRNG (mulberry32) and Box–Muller normals
     *Params, *Out          one layer's parameter count and output size, as
                            Keras counts and sizes them (Dense, Conv2D,
                            Conv2DTranspose, BatchNormalization, pooling)
     flow                   a model spec (slideData.js MODELS) → every layer's
                            input shape, output shape and parameters
     convTranspose2d        a transposed convolution done by hand: each input
                            pixel stamps a weighted copy of the kernel onto
                            the output, `stride` apart; overlaps add up
     latentTerm, latentLoss the VAE's latent loss (slide 12) in its σ form and
                            its γ = log(σ²) form
     sampleCoding           slide 14's Sampling: μ + exp(γ / 2) · ε
     linspace / lerp        slide 18's np.linspace, endpoints included
     makeDecoder / decode   the page's trained VAE decoder (./data/vae.js,
                            int8 weights with one scale per unit) run in JS
     ToyGan                 a tiny generator and discriminator (MLPs) trained
                            on 1D numbers with binary cross-entropy and
                            RMSprop, alternating slides 21–22's two phases

   Numbers produced here are this page's own working or run, never the
   slides' results.
   ========================================================================== */

/* ── randomness ─────────────────────────────────────────────────────────── */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function gauss(rand) {
  let u = 0;
  while (u === 0) u = rand();
  const v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/* ── one layer: parameters and output size (Keras's rules) ──────────────── */
// Dense: a weight per input per unit, plus a bias per unit
export const denseParams = (inputs, units) => inputs * units + units;
// Conv2D: a k × k kernel per input channel per filter, plus a bias per filter
export const conv2dParams = (k, cin, filters) => k * k * cin * filters + filters;
// Conv2DTranspose: Keras stores its kernel as (k, k, filters, cin), so the
// count has the same form as Conv2D's
export const convTransposeParams = (k, cin, filters) => k * k * filters * cin + filters;
// BatchNormalization: γ and β are trained; the moving mean and variance are
// counted too, but are not trainable
export const bnParams = (channels) => ({ total: 4 * channels, trainable: 2 * channels });

// Conv2D output size: "same" keeps ⌈n / s⌉, "valid" fits whole windows
export const convOut = (n, k, s = 1, padding = 'valid') => (padding === 'same' ? Math.ceil(n / s) : Math.floor((n - k) / s) + 1);
// MaxPool2D(pool_size=p): strides default to p, padding "valid"
export const poolOut = (n, p) => Math.floor((n - p) / p) + 1;
// Conv2DTranspose output size (Keras's deconv_output_length, no
// output_padding): "same" gives n × s; "valid" gives n × s + max(k − s, 0)
export const convTransposeOut = (n, k, s = 1, padding = 'valid') => (padding === 'same' ? n * s : n * s + Math.max(k - s, 0));

const prod = (shape) => shape.reduce((a, v) => a * v, 1);

/* ── a whole model, layer by layer ──────────────────────────────────────────
   spec: { input: [..shape], layers: [{ type, ...args }] } (slideData.js).
   Returns each layer's in/out shapes and parameters, and the totals. A layer
   with `same: true` reads the same input as the layer before it (the VAE's
   two parallel heads); `Sampling` takes those two and outputs one of them. */
export function flow(spec) {
  let shape = spec.input.slice();
  let prevIn = shape;
  const rows = spec.layers.map((L) => {
    const inShape = L.same ? prevIn : shape;
    let out = inShape;
    let params = 0;
    let trainable = 0;
    switch (L.type) {
      case 'Reshape':
        out = L.to.slice();
        break;
      case 'Flatten':
        out = [prod(inShape)];
        break;
      case 'Dense':
        params = denseParams(inShape[inShape.length - 1], L.units);
        out = [...inShape.slice(0, -1), L.units];
        break;
      case 'Conv2D': {
        const [h, w, c] = inShape;
        params = conv2dParams(L.k, c, L.filters);
        out = [convOut(h, L.k, L.s ?? 1, L.padding ?? 'valid'), convOut(w, L.k, L.s ?? 1, L.padding ?? 'valid'), L.filters];
        break;
      }
      case 'Conv2DTranspose': {
        const [h, w, c] = inShape;
        params = convTransposeParams(L.k, c, L.filters);
        out = [convTransposeOut(h, L.k, L.s ?? 1, L.padding ?? 'valid'), convTransposeOut(w, L.k, L.s ?? 1, L.padding ?? 'valid'), L.filters];
        break;
      }
      case 'MaxPool2D': {
        const [h, w, c] = inShape;
        out = [poolOut(h, L.pool), poolOut(w, L.pool), c];
        break;
      }
      case 'GlobalAvgPool2D':
        out = [inShape[inShape.length - 1]];
        break;
      case 'BatchNormalization': {
        const b = bnParams(inShape[inShape.length - 1]);
        params = b.total;
        trainable = b.trainable;
        break;
      }
      case 'Sampling':
      case 'Dropout':
      default:
        break;
    }
    if (L.type !== 'BatchNormalization') trainable = params;
    if (!L.same) prevIn = inShape;
    shape = out;
    return { ...L, in: inShape, out, params, trainable };
  });
  const total = rows.reduce((a, r) => a + r.params, 0);
  const trainable = rows.reduce((a, r) => a + r.trainable, 0);
  return { rows, total, trainable, out: shape };
}

export const shapeText = (s) => s.join(' × ');

/* ── a transposed convolution, by hand ──────────────────────────────────────
   input: n × n numbers; kernel: k × k. Each input pixel (i, j) adds
   input[i][j] × kernel onto the output at rows i·s … i·s + k − 1, columns
   j·s … j·s + k − 1. "valid" keeps the whole (n − 1)·s + k grid; "same"
   keeps n·s of it, dropping the extra rows and columns from the far edge
   (TensorFlow puts the odd one of the padding there; for slide 5's layers
   the full grid is 15 and 14 is kept, so the last row and column go). */
export function convTranspose2d(input, kernel, s, padding = 'valid') {
  const n = input.length;
  const k = kernel.length;
  const full = (n - 1) * s + k;
  const outN = padding === 'same' ? n * s : full;
  const crop = padding === 'same' ? Math.floor((full - outN) / 2) : 0;
  const out = Array.from({ length: outN }, () => new Array(outN).fill(0));
  const hits = Array.from({ length: outN }, () => new Array(outN).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let a = 0; a < k; a++) {
        for (let b = 0; b < k; b++) {
          const r = i * s + a - crop;
          const c = j * s + b - crop;
          if (r < 0 || c < 0 || r >= outN || c >= outN) continue;
          out[r][c] += input[i][j] * kernel[a][b];
          hits[r][c] += 1;
        }
      }
    }
  }
  return { out, hits, full, outN, crop };
}

/* ── the VAE's latent loss (slide 12) ───────────────────────────────────── */
// one coding dimension's term, inside the sum (with the −½ applied)
export const latentTermSigma = (mu, sigma) => -0.5 * (1 + Math.log(sigma * sigma) - sigma * sigma - mu * mu);
export const latentTermGamma = (mu, gamma) => -0.5 * (1 + gamma - Math.exp(gamma) - mu * mu);
export const latentLossSigma = (mus, sigmas) => mus.reduce((a, m, i) => a + latentTermSigma(m, sigmas[i]), 0);
export const latentLossGamma = (mus, gammas) => mus.reduce((a, m, i) => a + latentTermGamma(m, gammas[i]), 0);
export const sigmaOfGamma = (gamma) => Math.exp(gamma / 2);
export const gammaOfSigma = (sigma) => Math.log(sigma * sigma);

// slide 14's Sampling: tf.random.normal(...) * tf.exp(logvar / 2) + mean
export const sampleCoding = (mean, logVar, eps) => mean.map((m, i) => eps[i] * Math.exp(logVar[i] / 2) + m);
export const normals = (rand, n) => Array.from({ length: n }, () => gauss(rand));

/* ── interpolation (slide 18) ───────────────────────────────────────────── */
export const lerp = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
// np.linspace(a, b, n): n evenly spaced points, both endpoints included
export const linspace = (a, b, n) => Array.from({ length: n }, (_, i) => lerp(a, b, n === 1 ? 0 : i / (n - 1)));

export const mse = (a, b) => a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length;

/* ── the page's trained VAE decoder, run in JS ──────────────────────────────
   ./data/vae.js stores each Dense layer as int8 weights (base64, row-major,
   W[i][j] at i·out + j) with one scale per output unit, and float biases. */
function b64Int8(b64) {
  const bin = atob(b64);
  const out = new Int8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = (bin.charCodeAt(i) << 24) >> 24;
  return out;
}

export function makeDecoder(vae) {
  const layers = vae.decoder.layers.map((L) => {
    const q = b64Int8(L.w);
    const W = new Float32Array(L.in * L.out);
    for (let i = 0; i < L.in; i++) {
      for (let j = 0; j < L.out; j++) W[i * L.out + j] = q[i * L.out + j] * L.scale[j];
    }
    return { in: L.in, out: L.out, act: L.activation, W, b: Float32Array.from(L.b) };
  });
  return { layers };
}

const ACT = {
  relu: (v) => (v > 0 ? v : 0),
  sigmoid: (v) => 1 / (1 + Math.exp(-v)),
  linear: (v) => v,
};

// one coding (array of codingsSize numbers) → 784 pixel values (raw output)
export function decode(dec, z) {
  let x = Float32Array.from(z);
  dec.layers.forEach((L) => {
    const y = new Float32Array(L.out);
    for (let j = 0; j < L.out; j++) y[j] = L.b[j];
    for (let i = 0; i < L.in; i++) {
      const xi = x[i];
      if (xi === 0) continue;
      const row = i * L.out;
      for (let j = 0; j < L.out; j++) y[j] += xi * L.W[row + j];
    }
    const f = ACT[L.act] ?? ACT.linear;
    for (let j = 0; j < L.out; j++) y[j] = f(y[j]);
    x = y;
  });
  return x;
}

// raw output → bytes for display (clipped to [0, 1], × 255)
export const toBytes = (px) => Uint8Array.from(px, (v) => Math.round(Math.min(1, Math.max(0, v)) * 255));

/* ── a toy GAN on numbers (the page's own; slides 21–22's two phases) ──────
   generator      z (zDim normals) → `hidden` tanh units → 1 number
   discriminator  x (1 number) → `hidden` leaky-ReLU units → sigmoid
   loss           binary cross-entropy; optimiser RMSprop (as slide 24
                  compiles both models), this page's own learning rate
   phase 1        `batch` fake numbers labelled 0 + `batch` real numbers
                  labelled 1: one step on the discriminator only
   phase 2        `batch` fake numbers labelled 1, through the discriminator
                  with its weights frozen: one step on the generator only   */

export const TARGETS = {
  one: { name: 'one bump', modes: [{ m: 1.5, s: 0.35, w: 1 }] },
  two: { name: 'two bumps', modes: [{ m: -3, s: 0.3, w: 0.5 }, { m: 3, s: 0.3, w: 0.5 }] },
};

// The page's toy runs (seeds and sizes chosen by this page; checked in
// tools/dl-lecture6-7-study/check-gen.mjs):
//   one       learns the one-bump target with Keras's default RMSprop rate
//   balanced  the same networks on two bumps: both bumps get covered
//   weak      a smaller generator (1 noise number, 8 units) learning 4× faster
//             than the discriminator: with this seed it collapses onto one
//             bump for a long stretch, then becomes unstable
export const GAN_PRESETS = {
  one: { target: 'one', zDim: 2, hidden: 16, lrD: 0.001, lrG: 0.001, seed: 1, iters: 1500 },
  balanced: { target: 'two', zDim: 2, hidden: 16, lrD: 0.004, lrG: 0.004, seed: 1, iters: 2400 },
  weak: { target: 'two', zDim: 1, hidden: 8, lrD: 0.001, lrG: 0.004, seed: 4, iters: 2400 },
};

// share of the samples within 3 standard deviations of each mode
export function modeCover(target, xs) {
  return target.modes.map((md) => xs.filter((x) => Math.abs(x - md.m) < 3 * md.s).length / xs.length);
}

export function sampleTarget(target, rand) {
  let u = rand();
  const modes = target.modes;
  let mode = modes[modes.length - 1];
  for (const md of modes) {
    if (u < md.w) { mode = md; break; }
    u -= md.w;
  }
  return mode.m + mode.s * gauss(rand);
}

export function targetDensity(target, x) {
  return target.modes.reduce((a, md) => a + (md.w / (md.s * Math.sqrt(2 * Math.PI))) * Math.exp(-0.5 * ((x - md.m) / md.s) ** 2), 0);
}

function initLayer(rand, nIn, nOut, scale) {
  const W = Array.from({ length: nIn }, () => Array.from({ length: nOut }, () => gauss(rand) * scale));
  return { W, b: new Array(nOut).fill(0) };
}

const zeroLike = (L) => ({ W: L.W.map((r) => r.map(() => 0)), b: L.b.map(() => 0) });
const leak = 0.2;

export class ToyGan {
  constructor({ seed = 1, target = 'one', zDim = 2, hidden = 16, batch = 32, lrD = 0.001, lrG = 0.001 } = {}) {
    this.cfg = { seed, target, zDim, hidden, batch, lrD, lrG };
    this.target = TARGETS[target];
    this.rand = rng(seed);
    const r = rng(seed * 7919 + 13);
    this.G = [initLayer(r, zDim, hidden, Math.sqrt(1 / zDim)), initLayer(r, hidden, 1, Math.sqrt(1 / hidden))];
    this.D = [initLayer(r, 1, hidden, 1), initLayer(r, hidden, 1, Math.sqrt(2 / hidden))];
    // RMSprop accumulators (rho 0.9, epsilon 1e-7, as Keras's defaults; the
    // step is lr · g / √(v + ε), Keras 3's form)
    this.sG = this.G.map(zeroLike);
    this.sD = this.D.map(zeroLike);
    this.step = 0;
    this.history = [];
  }

  noise() {
    return Array.from({ length: this.cfg.zDim }, () => gauss(this.rand));
  }

  // generator forward: returns the number and what backprop needs
  gen(z) {
    const [L1, L2] = this.G;
    const h = L1.b.map((b, j) => Math.tanh(b + z.reduce((a, zi, i) => a + zi * L1.W[i][j], 0)));
    const x = L2.b[0] + h.reduce((a, hj, j) => a + hj * L2.W[j][0], 0);
    return { z, h, x };
  }

  // discriminator forward: probability that x is real
  disc(x) {
    const [L1, L2] = this.D;
    const a = L1.b.map((b, j) => b + x * L1.W[0][j]);
    const h = a.map((v) => (v > 0 ? v : leak * v));
    const logit = L2.b[0] + h.reduce((s, hj, j) => s + hj * L2.W[j][0], 0);
    return { x, a, h, p: 1 / (1 + Math.exp(-logit)) };
  }

  // d(loss)/d(params of D) for one example, and d(loss)/dx; label y ∈ {0, 1}
  discBack(f, y, gD, scale) {
    const [L1, L2] = this.D;
    const dLogit = (f.p - y) * scale; // BCE through a sigmoid
    let dx = 0;
    for (let j = 0; j < f.h.length; j++) {
      if (gD) {
        gD[1].W[j][0] += dLogit * f.h[j];
      }
      const dh = dLogit * L2.W[j][0];
      const da = dh * (f.a[j] > 0 ? 1 : leak);
      if (gD) {
        gD[0].W[0][j] += da * f.x;
        gD[0].b[j] += da;
      }
      dx += da * L1.W[0][j];
    }
    if (gD) gD[1].b[0] += dLogit;
    return dx;
  }

  rmsprop(params, grads, acc, lr) {
    const rho = 0.9;
    const eps = 1e-7;
    params.forEach((L, li) => {
      L.W.forEach((row, i) => row.forEach((_, j) => {
        const g = grads[li].W[i][j];
        acc[li].W[i][j] = rho * acc[li].W[i][j] + (1 - rho) * g * g;
        L.W[i][j] -= (lr * g) / Math.sqrt(acc[li].W[i][j] + eps);
      }));
      L.b.forEach((_, j) => {
        const g = grads[li].b[j];
        acc[li].b[j] = rho * acc[li].b[j] + (1 - rho) * g * g;
        L.b[j] -= (lr * g) / Math.sqrt(acc[li].b[j] + eps);
      });
    });
  }

  // Phase 1 — training the discriminator (slide 21)
  phase1() {
    const n = this.cfg.batch;
    const fake = Array.from({ length: n }, () => this.gen(this.noise()).x);
    const real = Array.from({ length: n }, () => sampleTarget(this.target, this.rand));
    const xs = [...fake, ...real];
    const ys = [...fake.map(() => 0), ...real.map(() => 1)];
    const gD = this.D.map(zeroLike);
    let loss = 0;
    xs.forEach((x, i) => {
      const f = this.disc(x);
      loss += -(ys[i] * Math.log(f.p + 1e-12) + (1 - ys[i]) * Math.log(1 - f.p + 1e-12));
      this.discBack(f, ys[i], gD, 1 / xs.length);
    });
    this.rmsprop(this.D, gD, this.sD, this.cfg.lrD);
    return { fake, real, labels: ys, loss: loss / xs.length };
  }

  // Phase 2 — training the generator (slide 22): all labels 1, D frozen
  phase2() {
    const n = this.cfg.batch;
    const gG = this.G.map(zeroLike);
    let loss = 0;
    const fake = [];
    for (let k = 0; k < n; k++) {
      const g = this.gen(this.noise());
      fake.push(g.x);
      const f = this.disc(g.x);
      loss += -Math.log(f.p + 1e-12);
      // through the discriminator without touching its weights (frozen)
      const dx = this.discBack(f, 1, null, 1 / n);
      const [, L2] = this.G;
      gG[1].b[0] += dx;
      g.h.forEach((hj, j) => {
        gG[1].W[j][0] += dx * hj;
        const dpre = dx * L2.W[j][0] * (1 - hj * hj);
        gG[0].b[j] += dpre;
        g.z.forEach((zi, i) => { gG[0].W[i][j] += dpre * zi; });
      });
    }
    this.rmsprop(this.G, gG, this.sG, this.cfg.lrG);
    return { fake, labels: fake.map(() => 1), loss: loss / n };
  }

  // one training iteration: phase 1 then phase 2 (slide 25's loop body)
  iterate() {
    const p1 = this.phase1();
    const p2 = this.phase2();
    this.step += 1;
    this.history.push({ step: this.step, dLoss: p1.loss, gLoss: p2.loss });
    return { p1, p2 };
  }

  // a fixed set of generated numbers (same noise every time, for drawing)
  samples(n = 400, seed = 99) {
    const r = rng(seed);
    return Array.from({ length: n }, () => this.gen(Array.from({ length: this.cfg.zDim }, () => gauss(r))).x);
  }

  snapshot() {
    const copy = (net) => net.map((L) => ({ W: L.W.map((r) => r.slice()), b: L.b.slice() }));
    return { G: copy(this.G), D: copy(this.D) };
  }
}

// largest absolute change between two copies of a network's weights
export function maxChange(a, b) {
  let m = 0;
  a.forEach((L, li) => {
    L.W.forEach((row, i) => row.forEach((v, j) => { m = Math.max(m, Math.abs(v - b[li].W[i][j])); }));
    L.b.forEach((v, j) => { m = Math.max(m, Math.abs(v - b[li].b[j])); });
  });
  return m;
}

// share of the samples nearer each of the target's modes
export function modeShares(target, xs) {
  const counts = target.modes.map(() => 0);
  xs.forEach((x) => {
    let best = 0;
    target.modes.forEach((md, i) => { if (Math.abs(x - md.m) < Math.abs(x - target.modes[best].m)) best = i; });
    counts[best] += 1;
  });
  return counts.map((c) => c / xs.length);
}

/* ── formatting ─────────────────────────────────────────────────────────── */
export const fmtInt = (n) => Math.round(n).toLocaleString('en-AU');
export const fmt = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');
// the same, with a typographic minus (for text, not for TeX)
export const fmtS = (n, d = 3) => fmt(n, d).replace(/^-/, '−');
