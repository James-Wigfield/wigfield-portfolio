/* Pure view maths for the map. A view is { k, cx, cy }: zoom over the home fit
   (the trip area, see geo.js WORLD), and the world point at the container centre. */

import { PAN, WORLD } from './geo.js';

export const HOME = { k: 1, cx: WORLD.x + WORLD.w / 2, cy: WORLD.y + WORLD.h / 2 };
export const MIN_K = 0.6;
/** Roughly state level: closer than this the atlas has nothing left to show. */
export const MAX_K = 16;
const PAD = 16;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Scale of the home view for a container size. */
export function baseScale(size) {
  return Math.max(1e-6, Math.min((size.w - 2 * PAD) / WORLD.w, (size.h - 2 * PAD) / WORLD.h));
}

/** { s, tx, ty }: screen = world * s + t */
export function transformOf(view, size) {
  const s = baseScale(size) * view.k;
  return { s, tx: size.w / 2 - view.cx * s, ty: size.h / 2 - view.cy * s, k: view.k };
}

export function clampView(v, maxK = MAX_K) {
  return {
    k: clamp(v.k, MIN_K, maxK),
    cx: clamp(v.cx, PAN.x, PAN.x + PAN.w),
    cy: clamp(v.cy, PAN.y, PAN.y + PAN.h),
  };
}

const pads = (pad) => (typeof pad === 'number' ? { t: pad, r: pad, b: pad, l: pad } : { t: 16, r: 16, b: 16, l: 16, ...pad });

/**
 * The view that fits a world-space box inside the container minus `pad`
 * (a number, or { t, r, b, l } to keep clear of controls).
 */
export function fitBox(box, size, { pad = 64, maxK = MAX_K, minK = MIN_K } = {}) {
  const p = pads(pad);
  const b = baseScale(size);
  const aw = Math.max(1, size.w - p.l - p.r);
  const ah = Math.max(1, size.h - p.t - p.b);
  const w = Math.max(box.x1 - box.x0, 1e-9);
  const h = Math.max(box.y1 - box.y0, 1e-9);
  const k = clamp(Math.min(aw / (w * b), ah / (h * b)), minK, maxK);
  const s = b * k;
  // the box centre goes to the centre of the padded area
  const ax = p.l + aw / 2;
  const ay = p.t + ah / 2;
  return clampView({ k, cx: (box.x0 + box.x1) / 2 - (ax - size.w / 2) / s, cy: (box.y0 + box.y1) / 2 - (ay - size.h / 2) / s }, maxK);
}

/** Zoom by `factor` keeping the screen point (px, py) fixed. */
export function zoomAround(view, size, factor, px = size.w / 2, py = size.h / 2, maxK = MAX_K) {
  const t = transformOf(view, size);
  const wx = (px - t.tx) / t.s;
  const wy = (py - t.ty) / t.s;
  const k = clamp(view.k * factor, MIN_K, maxK);
  const s = baseScale(size) * k;
  return clampView({ k, cx: wx - (px - size.w / 2) / s, cy: wy - (py - size.h / 2) / s }, maxK);
}

/* Smooth zoom-and-pan (van Wijk & Nuij 2003, as in d3-interpolate's interpolateZoom),
   so a long zoom never loses its target off screen. p = [cx, cy, width in world units]. */
const RHO = Math.SQRT2;
const cosh = (x) => ((x = Math.exp(x)) + 1 / x) / 2;
const sinh = (x) => ((x = Math.exp(x)) - 1 / x) / 2;
const tanh = (x) => ((x = Math.exp(2 * x)) - 1) / (x + 1);

function interpolateZoom(p0, p1) {
  const [ux0, uy0, w0] = p0;
  const [ux1, uy1, w1] = p1;
  const dx = ux1 - ux0;
  const dy = uy1 - uy0;
  const d2 = dx * dx + dy * dy;
  let S;
  let at;
  if (d2 < 1e-12) {
    S = Math.log(w1 / w0) / RHO;
    at = (t) => [ux0 + t * dx, uy0 + t * dy, w0 * Math.exp(RHO * t * S)];
  } else {
    const d1 = Math.sqrt(d2);
    const b0 = (w1 * w1 - w0 * w0 + 4 * d2) / (2 * w0 * 2 * d1);
    const b1 = (w1 * w1 - w0 * w0 - 4 * d2) / (2 * w1 * 2 * d1);
    const r0 = Math.log(Math.sqrt(b0 * b0 + 1) - b0);
    const r1 = Math.log(Math.sqrt(b1 * b1 + 1) - b1);
    S = (r1 - r0) / RHO;
    at = (t) => {
      const s = t * S;
      const c0 = cosh(r0);
      const u = (w0 / (2 * d1)) * (c0 * tanh(RHO * s + r0) - sinh(r0));
      return [ux0 + u * dx, uy0 + u * dy, (w0 * c0) / cosh(RHO * s + r0)];
    };
  }
  return { at, duration: Math.abs(S) * 1000 };
}

/** Interpolator between two views for a container size, plus a sensible duration (ms). */
export function viewTween(from, to, size) {
  const b = baseScale(size);
  const span = Math.min(size.w, size.h);
  const z = interpolateZoom([from.cx, from.cy, span / (b * from.k)], [to.cx, to.cy, span / (b * to.k)]);
  return {
    at: (t) => {
      const [cx, cy, w] = z.at(t);
      return { k: span / (b * w), cx, cy };
    },
    duration: Math.min(1100, Math.max(380, (z.duration || 0) * 0.9)),
  };
}

export const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
