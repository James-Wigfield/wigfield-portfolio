/* ============================================================================
   LECTURE 5 STUDY — AUTOENCODER MATHS
   ----------------------------------------------------------------------------
   Everything the labs compute, in plain JS, deterministic (seeded) and small
   enough to run at module load:

     rng / gauss         a seeded PRNG (mulberry32) and Box–Muller normals
     make3D              this page's own 60-point 3D training set, lying near
                         a tilted plane (slide 8 elides its data: `X_train =
                         [...]`, "the same 3D data used in Chapter 8")
     pca                 mean, 3×3 covariance, eigen-decomposition (Jacobi)
     LinearAE            Figure 17-1's network: Dense(2) → Dense(3), no
                         activation, MSE, SGD — Keras's maths (y = xW + b,
                         Glorot-uniform kernels, zero biases, mini-batches of
                         32 shuffled each epoch)
     planeAngle          the angle between two planes through the origin, and
                         principalAngles between two 2D subspaces of ℝ³
     denseParams         one Dense layer: inputs × units + units
     stackParams         a stack of Dense layers, layer by layer
     tiedParams          the same stack with the decoder's kernels tied to the
                         encoder's (slide 19): only the decoder's biases remain

   Numbers produced here are this page's own run, never the slides' results.
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

/* ── small linear algebra (3D and 2D only) ─────────────────────────────── */
export const dot = (a, b) => a.reduce((s, v, i) => s + v * b[i], 0);
export const norm = (a) => Math.sqrt(dot(a, a));
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const unit = (a) => {
  const n = norm(a) || 1;
  return a.map((v) => v / n);
};

function rotX(t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [[1, 0, 0], [0, c, -s], [0, s, c]];
}
function rotY(t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [[c, 0, s], [0, 1, 0], [-s, 0, c]];
}
function rotZ(t) {
  const c = Math.cos(t);
  const s = Math.sin(t);
  return [[c, -s, 0], [s, c, 0], [0, 0, 1]];
}
const matVec = (M, v) => M.map((row) => dot(row, v));

/* ── this page's 3D data set ────────────────────────────────────────────── */
// 60 points on a curved band in a plane, with small noise off the plane,
// then tilted and shifted. Seeded, so every visit (and the PDF) sees the same
// set. Not the slide's data, which the slides don't give.
export const DATA_SEED = 42;
export const N_POINTS = 60;

export function make3D(seed = DATA_SEED, m = N_POINTS) {
  const rand = rng(seed);
  const pts = [];
  for (let i = 0; i < m; i++) {
    const ang = (rand() ** 3 + 0.5) * 2 * Math.PI;
    let p = [Math.cos(ang) + 0.22 * gauss(rand), Math.sin(ang) * 0.5 + 0.22 * gauss(rand), 0.1 * gauss(rand)];
    p = matVec(rotX(-Math.PI / 4), p);
    p = matVec(rotY(Math.PI / 30), p);
    p = matVec(rotZ(-Math.PI / 20), p);
    pts.push([p[0] + 0.2, p[1], p[2] + 0.2]);
  }
  return pts;
}

/* ── PCA via the covariance matrix ──────────────────────────────────────── */
// Jacobi eigenvalue iteration for a symmetric 3×3 matrix.
function jacobi3(A) {
  const a = A.map((r) => r.slice());
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 50; sweep++) {
    let off = 0;
    for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < 3; p++) {
      for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-30) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;
        for (let k = 0; k < 3; k++) {
          const akp = a[k][p];
          const akq = a[k][q];
          a[k][p] = c * akp - s * akq;
          a[k][q] = s * akp + c * akq;
        }
        for (let k = 0; k < 3; k++) {
          const apk = a[p][k];
          const aqk = a[q][k];
          a[p][k] = c * apk - s * aqk;
          a[q][k] = s * apk + c * aqk;
        }
        for (let k = 0; k < 3; k++) {
          const vkp = V[k][p];
          const vkq = V[k][q];
          V[k][p] = c * vkp - s * vkq;
          V[k][q] = s * vkp + c * vkq;
        }
      }
    }
  }
  return { values: [a[0][0], a[1][1], a[2][2]], vectors: [0, 1, 2].map((j) => [V[0][j], V[1][j], V[2][j]]) };
}

// mean, covariance, and the principal components sorted by variance
export function pca(X) {
  const m = X.length;
  const mean = [0, 1, 2].map((j) => X.reduce((s, p) => s + p[j], 0) / m);
  const C = [0, 1, 2].map((i) => [0, 1, 2].map((j) => X.reduce((s, p) => s + (p[i] - mean[i]) * (p[j] - mean[j]), 0) / m));
  const { values, vectors } = jacobi3(C);
  const order = [0, 1, 2].sort((i, j) => values[j] - values[i]);
  const comps = order.map((i) => {
    const v = unit(vectors[i]);
    // a fixed sign convention, so the drawing never flips between visits
    const big = v.reduce((b, x, k) => (Math.abs(x) > Math.abs(v[b]) ? k : b), 0);
    return v[big] < 0 ? v.map((x) => -x) : v;
  });
  const vars = order.map((i) => values[i]);
  const total = vars.reduce((s, v) => s + v, 0);
  // the 2D projection (the codings PCA would give) and its reconstruction
  const proj = X.map((p) => {
    const d = p.map((v, j) => v - mean[j]);
    return [dot(d, comps[0]), dot(d, comps[1])];
  });
  const recon = proj.map(([a, b]) => mean.map((mu, j) => mu + a * comps[0][j] + b * comps[1][j]));
  return { mean, cov: C, comps, vars, explained: vars.map((v) => v / total), proj, recon, mse: mse(X, recon) };
}

// Keras's MeanSquaredError: mean over the features, then over the instances
export function mse(X, Y) {
  let s = 0;
  let n = 0;
  X.forEach((p, i) => {
    p.forEach((v, j) => {
      s += (Y[i][j] - v) ** 2;
      n += 1;
    });
  });
  return s / n;
}

/* ── Figure 17-1's linear autoencoder: 3 → 2 → 3 ───────────────────────── */
// encoder = Dense(2): codings = x·W1 + b1     W1 is 3×2, b1 has 2
// decoder = Dense(3): output  = c·W2 + b2     W2 is 2×3, b2 has 3
export const AE_DEFAULTS = { lr: 0.5, epochs: 500, batch: 32, seed: 7 };

export function initAE(seed = AE_DEFAULTS.seed) {
  const rand = rng(seed);
  // Keras's default kernel initialiser, Glorot uniform: U(−lim, lim),
  // lim = √(6 / (fan_in + fan_out)); biases start at zero
  const glorot = (fin, fout) => {
    const lim = Math.sqrt(6 / (fin + fout));
    return Array.from({ length: fin }, () => Array.from({ length: fout }, () => (rand() * 2 - 1) * lim));
  };
  return { W1: glorot(3, 2), b1: [0, 0], W2: glorot(2, 3), b2: [0, 0, 0] };
}

export function encode(ae, x) {
  return [0, 1].map((k) => x[0] * ae.W1[0][k] + x[1] * ae.W1[1][k] + x[2] * ae.W1[2][k] + ae.b1[k]);
}
export function decode(ae, c) {
  return [0, 1, 2].map((j) => c[0] * ae.W2[0][j] + c[1] * ae.W2[1][j] + ae.b2[j]);
}
export const reconstruct = (ae, x) => decode(ae, encode(ae, x));
export const aeLoss = (ae, X) => mse(X, X.map((x) => reconstruct(ae, x)));

const cloneAE = (ae) => ({ W1: ae.W1.map((r) => r.slice()), b1: ae.b1.slice(), W2: ae.W2.map((r) => r.slice()), b2: ae.b2.slice() });

// One epoch of mini-batch SGD on the MSE, the way Keras's fit() runs it: the
// instances are shuffled, cut into batches of `batch`, and each batch takes
// one step of size lr on its own mean loss. Returns a new model.
export function trainEpoch(model, X, { lr = AE_DEFAULTS.lr, batch = AE_DEFAULTS.batch, rand } = {}) {
  const ae = cloneAE(model);
  const idx = X.map((_, i) => i);
  if (rand) {
    for (let i = idx.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
  }
  for (let s = 0; s < idx.length; s += batch) {
    const B = idx.slice(s, s + batch);
    const g = { W1: [[0, 0], [0, 0], [0, 0]], b1: [0, 0], W2: [[0, 0, 0], [0, 0, 0]], b2: [0, 0, 0] };
    const scale = 2 / (B.length * 3); // d/dŷ of mean over 3 features and B instances
    B.forEach((i) => {
      const x = X[i];
      const c = encode(ae, x);
      const y = decode(ae, c);
      const dy = y.map((v, j) => scale * (v - x[j]));
      for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) g.W2[k][j] += c[k] * dy[j];
      for (let j = 0; j < 3; j++) g.b2[j] += dy[j];
      const dc = [0, 1].map((k) => dot(ae.W2[k], dy));
      for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) g.W1[r][k] += x[r] * dc[k];
      for (let k = 0; k < 2; k++) g.b1[k] += dc[k];
    });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) ae.W1[r][k] -= lr * g.W1[r][k];
    for (let k = 0; k < 2; k++) ae.b1[k] -= lr * g.b1[k];
    for (let k = 0; k < 2; k++) for (let j = 0; j < 3; j++) ae.W2[k][j] -= lr * g.W2[k][j];
    for (let j = 0; j < 3; j++) ae.b2[j] -= lr * g.b2[j];
  }
  return ae;
}

// The whole run, keeping snapshots for the lab's scrubber.
export function trainAE(X, { lr = AE_DEFAULTS.lr, epochs = AE_DEFAULTS.epochs, batch = AE_DEFAULTS.batch, seed = AE_DEFAULTS.seed, every = 5 } = {}) {
  const rand = rng(seed + 1000);
  let ae = initAE(seed);
  const history = [aeLoss(ae, X)];
  const snaps = [{ epoch: 0, ae }];
  for (let e = 1; e <= epochs; e++) {
    ae = trainEpoch(ae, X, { lr, batch, rand });
    history.push(aeLoss(ae, X));
    if (e % every === 0 || e === epochs) snaps.push({ epoch: e, ae });
  }
  return { ae, history, snaps };
}

// The plane the decoder's outputs lie on: b2 + span(rows of W2).
export function decoderPlane(ae) {
  return { origin: ae.b2.slice(), basis: [ae.W2[0].slice(), ae.W2[1].slice()], normal: unit(cross(ae.W2[0], ae.W2[1])) };
}

// The angle (degrees) between two planes, from their normals.
export function planeAngle(n1, n2) {
  const c = Math.min(1, Math.abs(dot(unit(n1), unit(n2))));
  return (Math.acos(c) * 180) / Math.PI;
}

// Principal angles (degrees, ascending) between span(A) and span(B), each a
// pair of 3D vectors: orthonormalise both, then the singular values of QaᵀQb
// are the cosines of the angles.
export function principalAngles(A, B) {
  const ortho = ([u, v]) => {
    const q1 = unit(u);
    const w = v.map((x, i) => x - dot(v, q1) * q1[i]);
    return [q1, unit(w)];
  };
  const qa = ortho(A);
  const qb = ortho(B);
  const M = qa.map((a) => qb.map((b) => dot(a, b)));
  // singular values of a 2×2 matrix, from MᵀM's eigenvalues
  const p = M[0][0] ** 2 + M[1][0] ** 2;
  const q = M[0][1] ** 2 + M[1][1] ** 2;
  const r = M[0][0] * M[0][1] + M[1][0] * M[1][1];
  const tr = p + q;
  const disc = Math.sqrt(Math.max(0, ((p - q) / 2) ** 2 + r * r));
  const s = [Math.sqrt(Math.max(0, tr / 2 + disc)), Math.sqrt(Math.max(0, tr / 2 - disc))];
  return s.map((c) => (Math.acos(Math.min(1, c)) * 180) / Math.PI).sort((a, b) => a - b);
}

// How the two learned code axes sit relative to each other: their lengths
// and the angle between them (90° and equal lengths would be PCA-like axes).
export function codeAxes(ae) {
  const [u, v] = ae.W2;
  const angle = (Math.acos(Math.max(-1, Math.min(1, dot(u, v) / (norm(u) * norm(v))))) * 180) / Math.PI;
  return { lengths: [norm(u), norm(v)], angle };
}

/* ── parameter counts ───────────────────────────────────────────────────── */
// Dense(units) on `inputs` inputs: a weight per input per unit, plus a bias
// per unit
export const denseParams = (inputs, units) => inputs * units + units;

// sizes = [784, 100, 30, 100, 784]: one Dense layer between each pair
export function stackParams(sizes) {
  const layers = [];
  for (let i = 1; i < sizes.length; i++) {
    layers.push({ inputs: sizes[i - 1], units: sizes[i], weights: sizes[i - 1] * sizes[i], biases: sizes[i], total: denseParams(sizes[i - 1], sizes[i]) });
  }
  return { layers, total: layers.reduce((s, l) => s + l.total, 0) };
}

// Tied weights (slide 19): with N weight layers, W_{N−ℓ+1} = W_ℓᵀ for
// ℓ = 1 … N/2. The decoder layers reuse the encoder's kernels (transposed)
// and keep only their own biases.
export function tiedParams(sizes) {
  const N = sizes.length - 1;
  const half = N / 2;
  const layers = [];
  for (let l = 1; l <= N; l++) {
    const inputs = sizes[l - 1];
    const units = sizes[l];
    if (l <= half) layers.push({ l, inputs, units, weights: inputs * units, biases: units, total: inputs * units + units, tiedTo: null });
    else layers.push({ l, inputs, units, weights: 0, biases: units, total: units, tiedTo: N - l + 1 });
  }
  return { layers, total: layers.reduce((s, x) => s + x.total, 0), N };
}

export const fmtInt = (n) => Math.round(n).toLocaleString('en-AU');
export const fmt = (n, d = 3) => (Number.isFinite(n) ? n.toFixed(d) : '—');
