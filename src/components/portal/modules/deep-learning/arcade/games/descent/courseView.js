/* Descent — view helpers (pure; kept out of the .jsx so Fast Refresh sees a
   components-only file). Geometry for the course, the η dial, the clipping
   arrows and the schedule chart. */
import { COURSE, toSvg, buildHole } from '../../maths/descentHoles.js';
import { initState, step, CLUB_IDS } from '../../maths/descent.js';

export { COURSE, toSvg };

// how many contour lines each kind of hole gets (the flats look flat)
export const LEVELS = { bowl: 13, flats: 6, dimple: 12, narrow: 13, valley: 11, round: 8, cliff: 15 };

export const pathD = (pts) => pts.map((p, i) => {
  const [x, y] = toSvg(p);
  return `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`;
}).join('');

/* the step the swing animation runs to: a bit past the later of your hole-out
   and par's; when your club never holes, long enough to show it failing */
export function endStep(item, mine) {
  const par = item.par.steps;
  const yours = mine ? item.results[mine]?.steps ?? null : null;
  const nMax = item.hole.nMax;
  if (yours !== null) return Math.min(nMax, Math.max(yours, par) + 3);
  return Math.min(nMax, Math.max(par * 2, par + 45));
}

export const at = (path, k) => path[Math.max(0, Math.min(k, path.length - 1))];

/* ── the learning-rate dial: log scale 10⁻³ … 10 over a 240° sweep ─────── */
export const DIAL_MIN = -3;
export const DIAL_MAX = 1;
export function dialAngle(eta) {
  const l = Math.log10(Math.max(1e-6, eta));
  const f = Math.max(0, Math.min(1, (l - DIAL_MIN) / (DIAL_MAX - DIAL_MIN)));
  return -120 + 240 * f;
}
export function polar(cx, cy, r, deg) {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
export function arcD(cx, cy, r, a0, a1) {
  const [x0, y0] = polar(cx, cy, r, a0);
  const [x1, y1] = polar(cx, cy, r, a1);
  const large = Math.abs(a1 - a0) > 180 ? 1 : 0;
  return `M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 ${large} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}`;
}
export const DIAL_TICKS = [0.001, 0.01, 0.1, 1, 10];
export const fmtTick = (v) => (v >= 1 ? String(v) : v === 0.1 ? '0.1' : v === 0.01 ? '0.01' : '0.001');

/* ── arrows on the course (clipping) ───────────────────────────────────── */
// the swing is −η·g from the ball; returns svg endpoints, cut at the course edge
export function swingArrow(ball, g, eta = 1) {
  const end = [ball[0] - eta * g[0], ball[1] - eta * g[1]];
  const [x0, y0] = toSvg(ball);
  let [x1, y1] = toSvg(end);
  let cut = false;
  const pad = 8;
  const tx = [];
  if (x1 > COURSE.W - pad) tx.push((COURSE.W - pad - x0) / (x1 - x0));
  if (x1 < pad) tx.push((pad - x0) / (x1 - x0));
  if (y1 > COURSE.H - pad) tx.push((COURSE.H - pad - y0) / (y1 - y0));
  if (y1 < pad) tx.push((pad - y0) / (y1 - y0));
  if (tx.length) {
    const t = Math.min(...tx);
    x1 = x0 + t * (x1 - x0);
    y1 = y0 + t * (y1 - y0);
    cut = true;
  }
  return { x0, y0, x1, y1, cut };
}
export function headD(x0, y0, x1, y1, size = 9) {
  const a = Math.atan2(y1 - y0, x1 - x0);
  const p = (da) => [x1 - size * Math.cos(a + da), y1 - size * Math.sin(a + da)];
  const [ax, ay] = p(0.45);
  const [bx, by] = p(-0.45);
  return `M${ax.toFixed(1)} ${ay.toFixed(1)}L${x1.toFixed(1)} ${y1.toFixed(1)}L${bx.toFixed(1)} ${by.toFixed(1)}`;
}

/* ── the maths drawer: the first step of a club, with numbers ─────────── */
const f3 = (v) => {
  const r = Math.round(v * 1000) / 1000;
  return (Object.is(r, -0) ? 0 : r).toString().replace('-', '−');
};
export const fmtV = (v) => `(${v.map(f3).join(', ')})`;
export function firstStep(spec, club) {
  const { grad } = buildHole(spec);
  const st0 = initState(spec.start);
  const g = grad(spec.start);
  const st1 = step(st0, grad, { club, eta: spec.eta });
  return { g, theta1: st1.theta, m: st1.m, s: st1.s, ahead: st1.ahead ?? null };
}

export const canonical = (bag) => CLUB_IDS.filter((c) => bag.includes(c));

/* ── the schedule chart ────────────────────────────────────────────────── */
export const CHART = { W: 600, H: 220, l: 40, r: 16, t: 16, b: 34 };
export function chartScale(curve) {
  const etaMax = Math.max(...curve.pts.map((p) => p.eta)) * 1.08;
  const X = (t) => CHART.l + ((CHART.W - CHART.l - CHART.r) * t) / curve.T;
  const Y = (eta) => CHART.H - CHART.b - ((CHART.H - CHART.t - CHART.b) * eta) / etaMax;
  return { X, Y, etaMax };
}
export function chartLine(curve, sc, key = 'eta') {
  return curve.pts.map((p, i) => `${i ? 'L' : 'M'}${sc.X(p.t).toFixed(1)} ${sc.Y(p[key]).toFixed(1)}`).join('');
}
export function lossLine(curve) {
  const lo = Math.min(...curve.loss);
  const hi = Math.max(...curve.loss);
  const X = (t) => CHART.l + ((CHART.W - CHART.l - CHART.r) * t) / curve.T;
  const Y = (v) => CHART.t + 8 + ((CHART.H - CHART.t - CHART.b - 16) * (hi - v)) / (hi - lo);
  return curve.loss.map((v, t) => `${t ? 'L' : 'M'}${X(t).toFixed(1)} ${Y(v).toFixed(1)}`).join('');
}
