/* ============================================================================
   LECTURES 1–2 REFRESHER — PART 2 LAB HELPERS (pure, no React)
   ----------------------------------------------------------------------------
   The toy data and small computations behind ./labsL2b.jsx. The maths itself
   lives in ../nn.js (read-only here); this file only arranges it for drawing:
     spansWhere      the z-intervals where a predicate holds (shading)
     stackLevels     dot-plot stacking so close dots never overlap
     LR_*            the five schedules of §2.7 on one t = 0…50 axis
     VAL_LOSS        the performance schedule's toy validation loss
     plateaus        where ReduceLROnPlateau's patience ran out
     penaltyRun      a run of gradient steps on an ℓ1 / ℓ2 penalty alone
     dropoutRun      one seeded dropout mask per training step
   ========================================================================== */
import { rng, dropoutMask, penaltyStep, l1Penalty, l2Penalty, powerLR, expLR, piecewiseLR, oneCycleLR, performanceLR } from '../nn';

// the [a, b] intervals of [z0, z1] where pred(z) holds, sampled at n + 1 points
export function spansWhere(pred, z0, z1, n = 280) {
  const out = [];
  let start = null;
  const dz = (z1 - z0) / n;
  for (let i = 0; i <= n; i++) {
    const z = z0 + dz * i;
    const on = pred(z);
    if (on && start === null) start = z;
    if (start !== null && (!on || i === n)) {
      out.push([start, on ? z : z - dz]);
      start = null;
    }
  }
  return out.filter(([a, b]) => b - a > dz * 0.5);
}

// Dot-plot stacking: each dot (screen x) gets the lowest level where no dot
// already placed sits closer than `gap` pixels.
export function stackLevels(px, gap) {
  const order = px.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]);
  const levels = new Array(px.length).fill(0);
  const placed = [];
  order.forEach(([x, i]) => {
    let lv = 0;
    while (placed.some(([x2, l]) => l === lv && Math.abs(x2 - x) < gap)) lv += 1;
    levels[i] = lv;
    placed.push([x, lv]);
  });
  return levels;
}

/* ── §2.7 · learning-rate schedules ─────────────────────────────────────── */
export const LR_T = 50;

/* The performance schedule's validation loss, epochs 0…50 (this page's own,
   shaped like slide 58's chart: a fast fall, a minimum, a stall, a drop after
   each halving of η). */
export const VAL_LOSS = [
  0.48, 0.445, 0.42, 0.405, 0.395, 0.389, 0.385, 0.382, 0.38, 0.379, 0.378, 0.377, 0.379, 0.381, 0.38, 0.383, 0.384,
  0.362, 0.358, 0.356, 0.355, 0.354, 0.3535, 0.353, 0.352, 0.3525, 0.353, 0.3522, 0.3528, 0.353,
  0.346, 0.343, 0.341, 0.34, 0.3395, 0.34, 0.3398, 0.3401, 0.3399, 0.3402,
  0.336, 0.334, 0.333, 0.3325, 0.3322, 0.3321, 0.3323, 0.3322, 0.3324, 0.3323, 0.3325,
];

// The settings each curve uses (slide values where the slides give them).
export const LR_HP = {
  power: { eta0: 0.01, r: 1, s: 10, c: 1 }, // slide 50's blue curve
  exponential: { eta0: 0.1, r: 0.5, s: 10 }, // slide 52's blue curve
  piecewise: { boundaries: [5, 20, 30], values: [0.1, 0.04, 0.02, 0.01] }, // slide 55's chart
  performance: { eta0: 0.01, factor: 0.5, patience: 5 }, // slides 57–58
  onecycle: { T: LR_T, eta0: 0.01, eta1: 0.1, tail: 0.1, floor: 0.0001 }, // this page's own (slide 59 has no numbers)
};

export const PERF_ETAS = performanceLR(VAL_LOSS, LR_HP.performance);

export function lrAt(kind, t) {
  switch (kind) {
    case 'power': return powerLR(t, LR_HP.power);
    case 'exponential': return expLR(t, LR_HP.exponential);
    case 'piecewise': return piecewiseLR(t, LR_HP.piecewise);
    case 'performance': return PERF_ETAS[Math.max(0, Math.min(LR_T, Math.floor(t)))];
    case 'onecycle': return oneCycleLR(t, LR_HP.onecycle);
    default: return NaN;
  }
}

// [t, η] points to draw: smooth curves sampled finely, steps with risers
export function lrPoints(kind) {
  if (kind === 'piecewise') {
    const { boundaries: b, values: v } = LR_HP.piecewise;
    const pts = [[0, v[0]]];
    b.forEach((t, i) => { pts.push([t, v[i]], [t, v[i + 1]]); });
    pts.push([LR_T, v[v.length - 1]]);
    return pts;
  }
  if (kind === 'performance') {
    const pts = [[0, PERF_ETAS[0]]];
    for (let t = 1; t <= LR_T; t++) {
      pts.push([t, PERF_ETAS[t - 1]]);
      if (PERF_ETAS[t] !== PERF_ETAS[t - 1]) pts.push([t, PERF_ETAS[t]]);
    }
    return pts;
  }
  const pts = [];
  for (let i = 0; i <= LR_T * 4; i++) pts.push([i / 4, lrAt(kind, i / 4)]);
  return pts;
}

/* Where ReduceLROnPlateau's patience ran out on VAL_LOSS: for each cut, the
   epoch of the best loss so far, the `patience` epochs with no new best, and
   the epoch from which η is multiplied by `factor`. Mirrors performanceLR. */
export function plateaus(val = VAL_LOSS, { patience = 5 } = {}) {
  const out = [];
  let best = Infinity;
  let bestAt = -1;
  let wait = 0;
  val.forEach((v, t) => {
    if (v < best - 1e-9) { best = v; bestAt = t; wait = 0; } else {
      wait += 1;
      if (wait >= patience) {
        out.push({ best: bestAt, from: t - patience + 1, to: t, cut: t + 1 });
        wait = 0;
      }
    }
  });
  return out.filter((p) => p.cut <= val.length - 1);
}

/* ── §2.8 · ℓ1 / ℓ2 on the weights alone ────────────────────────────────── */
export function penaltyRun(w0, kind, lam, eta, steps) {
  const out = [w0];
  let w = w0;
  for (let k = 0; k < steps; k++) {
    w = penaltyStep(w, kind, lam, eta);
    out.push(w);
  }
  return out;
}
export const penaltyOf = (w, kind, lam) => (kind === 'l1' ? l1Penalty(w, lam) : l2Penalty(w, lam));
// the first step at which each weight is exactly 0 (null if never)
export function zeroSteps(run) {
  return run[0].map((_, i) => {
    const k = run.findIndex((w) => w[i] === 0);
    return k === -1 ? null : k;
  });
}

/* ── §2.8 · dropout ─────────────────────────────────────────────────────── */
// One mask per training step over the n droppable neurons (true = kept).
export function dropoutRun(p, seed, steps = 6, n = 6) {
  const R = rng(seed);
  return Array.from({ length: steps }, () => dropoutMask(n, p, R));
}
