/* Signal Keeper — pure picture geometry for SignalKeeper.jsx (no facts here:
   numbers come from maths/, words from content/). */
import { STD_LOW, STD_HIGH, GRAD_LOW, GRAD_HIGH, LAYERS } from '../../maths/signalKeeperSim.js';
import { curvePoints } from '../../maths/signalKeeper.js';

/* ── the stack: one row per layer, layer 10 on top ─────────────────────── */
export function stackGeometry(width) {
  const W = Math.round(Math.max(300, Math.min(760, width || 640)));
  const narrow = W < 520;
  const rowH = narrow ? 21 : 24;
  const top = 26;
  const lab = narrow ? 24 : 32;
  const dot = 14;
  const gap = narrow ? 7 : 14;
  const rest = W - lab - dot - gap * 3;
  const hist = Math.round(rest * (narrow ? 0.34 : 0.38));
  const bar = Math.floor((rest - hist) / 2);
  const x = { lab: 0, hist: lab, std: lab + gap + hist, grad: lab + gap * 2 + hist + bar, dot: W - dot / 2 };
  const H = top + LAYERS * rowH + 34;
  return { W, H, rowH, top, x, hist, bar, dot, narrow, layers: LAYERS };
}
export const rowY = (g, l) => g.top + (g.layers - l) * g.rowH; // l = 1 … 10

// log10 domains of the two bar columns, the healthy band inside each
export const STD_DOMAIN = { lo: -2, hi: 2, band: [Math.log10(STD_LOW), Math.log10(STD_HIGH)], ticks: [[-2, '0.01'], [0, '1'], [2, '100']] };
export const GRAD_DOMAIN = { lo: -4, hi: 4, band: [Math.log10(GRAD_LOW), Math.log10(GRAD_HIGH)], ticks: [[-4, '10⁻⁴'], [0, '1'], [4, '10⁴']] };

// a diverging bar from the column's centre line (value 1) on a log scale
export function logBar(g, col, value, dom) {
  const half = g.bar / 2 - 5;
  const cx = g.x[col] + g.bar / 2;
  const lv = Math.log10(Math.max(value, 1e-12));
  const clamped = Math.max(dom.lo, Math.min(dom.hi, lv));
  const len = (clamped / dom.hi) * half;
  return { cx, len: Math.abs(len) < 1.2 ? Math.sign(len || 1) * 1.2 : len, over: lv > dom.hi, under: lv < dom.lo, half };
}
export const domX = (g, col, lv, dom) => g.x[col] + g.bar / 2 + (lv / dom.hi) * (g.bar / 2 - 5);

/* ── an activation curve on the slides' window (z ∈ [−4, 4]) ───────────── */
export const CURVE = { W: 360, H: 220, pad: 26, z0: -4, z1: 4, y0: -2.2, y1: 3.2 };
export const cx = (z) => CURVE.pad + ((z - CURVE.z0) / (CURVE.z1 - CURVE.z0)) * (CURVE.W - 2 * CURVE.pad);
export const cy = (y) => CURVE.H - CURVE.pad + 6 - ((y - CURVE.y0) / (CURVE.y1 - CURVE.y0)) * (CURVE.H - 2 * CURVE.pad);
export function curveD(act, alpha) {
  return curvePoints(act, alpha, CURVE.z0, CURVE.z1, 161)
    .map(([z, y], i) => `${i ? 'L' : 'M'}${cx(z).toFixed(1)} ${cy(Math.max(CURVE.y0 - 2, Math.min(CURVE.y1 + 2, y))).toFixed(1)}`)
    .join(' ');
}

/* ── a number line for the BN batch ────────────────────────────────────── */
export function lineScale(xs, W = 360, pad = 26) {
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const span = Math.max(4, hi - lo);
  const a = lo - span * 0.15;
  const b = hi + span * 0.15;
  return { W, pad, a, b, x: (v) => pad + ((v - a) / (b - a)) * (W - 2 * pad) };
}
