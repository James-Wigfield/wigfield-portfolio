/* ============================================================================
   TOPIC 3 · SOFTMAX — small helpers for the labs
   ----------------------------------------------------------------------------
   Kept in a .js file so the .jsx files export components only. These only
   format and lay out: every number a lab shows is computed by
   ../../../maths/softmax.js (softmax, exps, sigmoid, crossEntropy, argmax,
   attention, percents).
   ========================================================================== */

export const MINUS = '−';

// a number for the picture: fixed decimals and a real minus sign
export function num(v, d = 2) {
  const s = Math.abs(v).toFixed(d);
  return `${v < 0 && Number(s) !== 0 ? MINUS : ''}${s}`;
}

// a score with only the decimals it needs (2, 0.1, −1.25)
export function score(v) {
  const r = Math.round(v * 100) / 100;
  return `${r < 0 ? MINUS : ''}${Math.abs(r)}`;
}

// the same two for TeX (TeX draws its own minus sign)
export const tex = (v, d = 3) => {
  const s = v.toFixed(d);
  return Number(s) === 0 ? Math.abs(v).toFixed(d) : s;
};
export const texScore = (v) => String(Math.round(v * 100) / 100);

export const sum = (xs) => xs.reduce((a, b) => a + b, 0);

// prefix sums [0, x0, x0 + x1, …] (where each segment of a stacked strip starts)
export const starts = (xs) => xs.reduce((a, v) => [...a, a[a.length - 1] + v], [0]);

// n evenly spaced label slots across a span (so strip labels never collide)
export const slots = (x0, len, n) => Array.from({ length: n }, (_, i) => x0 + ((i + 0.5) * len) / n);

// the toy scores of the formula's walk-through (topic.js, step 2) and the hero
export const Z_WALK = [2, 1, 0.1];
export const Z_HERO = [2, 1, 0.1, -1];
