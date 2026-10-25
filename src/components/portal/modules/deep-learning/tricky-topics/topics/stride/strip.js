import { windows } from '../../maths/strideRules.js';

/* The height StripView.jsx needs for a given strip (kept in .js so the .jsx
   exports components only). */
export function stripHeight(n, k, s, pad, width, mode = 'brackets') {
  const W = windows(n, k, s, pad);
  const total = n + W.padLeft + W.padRight;
  const cell = Math.min(38, width / Math.max(total, 1));
  const inY = mode === 'brackets' ? 34 + Math.min(W.out, 8) * 10 : 70;
  return inY + cell + 4;
}
