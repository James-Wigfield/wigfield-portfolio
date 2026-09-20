/* ============================================================================
   House III data — sizes through a conv layer and a pooling layer
   ----------------------------------------------------------------------------
   Slides 20–21 (padding, stride) and 25–27 (pooling). Pure arithmetic:
     valid:  out = floor((n − k) / s) + 1
     same:   out = ceil(n / s)
     pool 2×2, stride 2, no padding:  out = floor(n / 2)
   ========================================================================== */

export const N1 = 6;
export const KS = 3;

/* The picture in the first room: a low sun over a horizon, 6×6, bright = 1. */
export const IMAGE = [
  [0.10, 0.20, 0.85, 0.85, 0.20, 0.10],
  [0.10, 0.85, 0.95, 0.95, 0.85, 0.10],
  [0.20, 0.85, 0.45, 0.45, 0.85, 0.20],
  [0.30, 0.30, 0.30, 0.30, 0.30, 0.30],
  [0.80, 0.80, 0.80, 0.80, 0.80, 0.80],
  [0.50, 0.55, 0.50, 0.55, 0.50, 0.55],
];

/* The gate's kernel: slide 6's averaging filter, so a padded edge visibly darkens. */
export const KERNEL = [[1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9], [1 / 9, 1 / 9, 1 / 9]];

export const outSize = (n, k, s, padding) => (padding === 'same' ? Math.ceil(n / s) : Math.floor((n - k) / s) + 1);
export const poolSize = (n) => Math.floor(n / 2);

/* Convolve with the given stride/padding. `same` zero-pads so the output is
   ceil(n/s); the pad amount follows the Keras rule. */
export function convolve(img, k, s, padding) {
  const n = img.length;
  const out = outSize(n, k.length, s, padding);
  let padTop = 0;
  if (padding === 'same') {
    const total = Math.max((out - 1) * s + k.length - n, 0);
    padTop = Math.floor(total / 2);
  }
  const res = [];
  for (let j = 0; j < out; j++) {
    const row = [];
    for (let i = 0; i < out; i++) {
      let acc = 0;
      for (let b = 0; b < k.length; b++) {
        for (let a = 0; a < k.length; a++) {
          const y = j * s + b - padTop;
          const x = i * s + a - padTop;
          const v = y >= 0 && y < n && x >= 0 && x < n ? img[y][x] : 0;
          acc += v * k[b][a];
        }
      }
      row.push(acc);
    }
    res.push(row);
  }
  return { out: res, padTop, padded: padding === 'same' ? n + 2 * padTop : n };
}

export function pool(map, mode) {
  const n = map.length;
  const out = poolSize(n);
  const res = [];
  for (let j = 0; j < out; j++) {
    const row = [];
    for (let i = 0; i < out; i++) {
      const vals = [map[2 * j][2 * i], map[2 * j][2 * i + 1], map[2 * j + 1][2 * i], map[2 * j + 1][2 * i + 1]];
      row.push(mode === 'max' ? Math.max(...vals) : vals.reduce((a, b) => a + b, 0) / 4);
    }
    res.push(row);
  }
  return res;
}

/* The door's questions. One is picked per session; the answer is computed,
   never typed, so the door can also show its working. */
export const QUESTIONS = [
  { n: 6, k: 3, s: 1, padding: 'valid', pool: false },
  { n: 6, k: 3, s: 2, padding: 'same', pool: false },
  { n: 6, k: 3, s: 2, padding: 'valid', pool: false },
  { n: 6, k: 3, s: 1, padding: 'same', pool: true },
  { n: 8, k: 3, s: 1, padding: 'valid', pool: true },
];
export function answer(q) {
  const c = outSize(q.n, q.k, q.s, q.padding);
  return q.pool ? poolSize(c) : c;
}
export function working(q) {
  const c = outSize(q.n, q.k, q.s, q.padding);
  const conv =
    q.padding === 'same'
      ? `same: ceil(n / s) = ceil(${q.n} / ${q.s}) = ${c}`
      : `valid: floor((n − k) / s) + 1 = floor((${q.n} − ${q.k}) / ${q.s}) + 1 = ${c}`;
  return q.pool ? `${conv}; then 2×2 pool, stride 2: floor(${c} / 2) = ${poolSize(c)}` : conv;
}
export const grey = (v) => {
  const g = Math.round(30 + Math.min(1, Math.max(0, v)) * 200);
  return `rgb(${g},${g - 2},${g - 6})`;
};
