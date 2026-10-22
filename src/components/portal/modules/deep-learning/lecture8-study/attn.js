/* ============================================================================
   LECTURE 8 STUDY — THE MATHS
   ----------------------------------------------------------------------------
   Everything the labs compute, in the slides' own notation, as small pure
   functions on plain arrays (a matrix is an array of rows). Checked by
   tools/dl-lecture8-study/check-attn.mjs.

     softmax / softmaxRows        slide 22, 25: α(t,i) = exp(e(t,i)) / Σᵢ′ exp(e(t,i′))
     weightedSum                  slides 20, 25: h̃(t) = Σᵢ α(t,i) y(i)
     alignScore                   slide 22: one Dense neuron on [h; y(i)]
     luong                        slide 25: dot, general, concat scores
     attention                    slides 37–38: softmax(QKᵀ / √d_keys) V, with
                                  every intermediate and its shape
     causalMask                   slide 31, 41–42: a word can't attend to the
                                  words after it
     splitHeads / concatHeads     slide 39: Split → … → Concat
     posEncoding                  slide 32 (base 1000, as typeset) and slide
                                  35's PositionalEncoding code (10_000)
     vitPatches                   slide 46: 16 × 16 × 3 = 768
     params                       Keras parameter counts for slide 9 and 14
     rng                          a seeded PRNG for the page's own random
                                  vectors (deterministic on every load)
   ========================================================================== */

/* ── vectors and matrices ─────────────────────────────────────────────── */
export const dot = (a, b) => a.reduce((s, x, i) => s + x * b[i], 0);
export const transpose = (A) => (A.length ? A[0].map((_, j) => A.map((r) => r[j])) : []);
export const matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, x, k) => s + x * B[k][j], 0)));
export const scaleM = (A, s) => A.map((r) => r.map((x) => x * s));
export const shape = (A) => [A.length, A[0]?.length ?? 0];
export const concat = (a, b) => [...a, ...b];

/* ── softmax: slide 25's α(t,i) = exp(e(t,i)) / Σᵢ′ exp(e(t,i′)) ───────────
   Subtracting the max first changes nothing mathematically (it cancels) and
   keeps exp() from overflowing. Masked entries (null) get weight 0.        */
export function softmax(xs) {
  const live = xs.filter((x) => x !== null && x !== undefined);
  if (!live.length) return xs.map(() => 0);
  const m = Math.max(...live);
  const ex = xs.map((x) => (x === null || x === undefined ? 0 : Math.exp(x - m)));
  const s = ex.reduce((a, b) => a + b, 0);
  return ex.map((x) => x / s);
}
export const softmaxRows = (M) => M.map(softmax);

/* ── the weighted sum: h̃(t) = Σᵢ α(t,i) y(i) (slide 25; slide 20 in words) */
export function weightedSum(alphas, ys) {
  return ys[0].map((_, j) => ys.reduce((s, y, i) => s + alphas[i] * y[j], 0));
}

/* ── Bahdanau's alignment model (slide 22) ────────────────────────────────
   One Dense neuron reads the decoder's previous hidden state with one encoder
   output, [h(t−1); y(i)], and gives a score e(t,i). The slide gives no
   activation for it, so the page's toy neuron is linear: w · [h; y] + b.    */
export const alignScore = (h, y, w, b = 0) => dot(w, concat(h, y)) + b;

/* ── Luong's three scores (slide 25) ──────────────────────────────────────
     dot      e = h(t)ᵀ y(i)
     general  e = h(t)ᵀ W y(i)
     concat   e = vᵀ tanh(W [h(t); y(i)])                                   */
export const luong = {
  dot: (h, y) => dot(h, y),
  general: (h, y, W) => dot(h, W.map((row) => dot(row, y))),
  concat: (h, y, W, v) => dot(v, W.map((row) => Math.tanh(dot(row, concat(h, y))))),
};

/* ── scaled dot-product attention (slides 37–38) ─────────────────────────
   Attention(Q, K, V) = softmax(QKᵀ / √d_keys) V
     Q [n_queries, d_keys] · K [n_keys, d_keys] · V [n_keys, d_values]
     QKᵀ [n_queries, n_keys] · output [n_queries, d_values]
   `mask` (optional) is an [n_queries, n_keys] grid of booleans: false
   entries are left out of their row's softmax (weight 0).                  */
export function attention(Q, K, V, { scale = true, mask = null } = {}) {
  const dKeys = K[0].length;
  if (Q[0].length !== dKeys) throw new Error('Q and K need the same d_keys');
  if (K.length !== V.length) throw new Error('K and V need the same n_keys');
  const scores = matmul(Q, transpose(K));
  const factor = scale ? 1 / Math.sqrt(dKeys) : 1;
  const scaled = scaleM(scores, factor);
  const masked = mask ? scaled.map((r, i) => r.map((x, j) => (mask[i][j] ? x : null))) : scaled;
  const weights = softmaxRows(masked);
  const out = matmul(weights, V);
  return {
    scores,
    scaled,
    weights,
    out,
    dKeys,
    factor,
    shapes: { Q: shape(Q), K: shape(K), V: shape(V), scores: shape(scores), out: shape(out) },
  };
}

/* ── masking (slides 31, 41–42) ───────────────────────────────────────────
   causalMask(n)[i][j] is true when word i may attend to word j: itself and
   the words before it, never the words after it.                          */
export const causalMask = (n) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => j <= i));

/* ── multi-head split / concatenate (slide 39) ───────────────────────────
   splitHeads cuts each row of X [n, d] into H consecutive parts of d / H
   columns: head h gets columns h·d/H … (h+1)·d/H − 1. concatHeads joins
   them back, head after head.                                              */
export function splitHeads(X, H) {
  const d = X[0].length;
  if (d % H !== 0) throw new Error('d must divide evenly into H heads');
  const w = d / H;
  return Array.from({ length: H }, (_, h) => X.map((r) => r.slice(h * w, (h + 1) * w)));
}
export const concatHeads = (heads) => heads[0].map((_, i) => heads.flatMap((Hm) => Hm[i]));

/* ── positional encodings (slides 32–35) ──────────────────────────────────
   P[p][i] for position p and dimension i of a d-dimensional embedding.
     'code'  slide 35's PositionalEncoding: dimension pairs (2k, 2k + 1) get
             sin / cos of p / 10_000 ** (2k / embed_size)
     'slide' slide 32's formula as typeset: sin(p / 1000^(i/d)) for even i,
             cos(p / 1000^((i−1)/d)) for odd i
   The two are the same shape of formula; only the base differs (10,000 in
   the code, 1000 on slide 32).                                             */
export const PE_BASE = { code: 10000, slide: 1000 };
export function posEncoding(maxLen, d, variant = 'code') {
  const base = PE_BASE[variant] ?? variant;
  return Array.from({ length: maxLen }, (_, p) =>
    Array.from({ length: d }, (_, i) => {
      const even = i % 2 === 0;
      const angle = p / base ** ((even ? i : i - 1) / d);
      return even ? Math.sin(angle) : Math.cos(angle);
    }));
}

/* ── ViT patching (slide 46) ──────────────────────────────────────────────
   The slides give the patch size (16 × 16) and the channels (3), so a patch
   flattens to 16 × 16 × 3 = 768 numbers. They give no image size: any image
   size used here is the page's own (e.g. 224 × 224 → 14 × 14 = 196 patches). */
export function vitPatches(H, W, P = 16, C = 3) {
  return { rows: Math.floor(H / P), cols: Math.floor(W / P), count: Math.floor(H / P) * Math.floor(W / P), dim: P * P * C };
}

/* ── Keras parameter counts (slides 9, 14) ────────────────────────────────
   SimpleRNN(units) on `inputs` features: units·(units + inputs) + units;
   Bidirectional doubles it; Dense(units) on `inputs`: inputs·units + units. */
export const params = {
  simpleRnn: (units, inputs) => units * (units + inputs) + units,
  bidirectional: (inner) => 2 * inner,
  dense: (units, inputs) => inputs * units + units,
};
// slide 9: Bidirectional(SimpleRNN(16)) on (bus, rail) + Dense(2) → 674
export function simpleBiRnnParams() {
  const bi = params.bidirectional(params.simpleRnn(16, 2));
  const out = params.dense(2, 32);
  return { bi, out, total: bi + out };
}
// slide 14: encoder Bidirectional(SimpleRNN(16)), decoder SimpleRNN(32) on 2
// inputs, Dense(2) on the decoder's 32 outputs
export function rnnEdParams() {
  const enc = params.bidirectional(params.simpleRnn(16, 2));
  const dec = params.simpleRnn(32, 2);
  const out = params.dense(2, 32);
  return { enc, dec, out, total: enc + dec + out };
}

/* ── a seeded PRNG (mulberry32) and standard normals ──────────────────── */
export function rng(seed = 1) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const normal = () => {
    const u = Math.max(next(), 1e-12);
    const v = next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { next, normal };
}

/* ── small formatting helpers for the maths drawers ───────────────────── */
export const fmt = (x, dp = 2) => {
  if (x === null || x === undefined) return '−∞';
  const s = Math.abs(x) < 0.5 * 10 ** -dp ? (0).toFixed(dp) : x.toFixed(dp);
  return s.replace('-', '−');
};
export const fmtVec = (v, dp = 2) => `[${v.map((x) => fmt(x, dp)).join(', ')}]`;
export const pct = (x) => `${Math.round(x * 100)}%`;
