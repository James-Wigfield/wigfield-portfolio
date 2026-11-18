/* ============================================================================
   PROJECTOR LIFE — small pure geometry helpers shared by the room modules
   (2-D polygons, the octagon's frames). No three.js: Node-safe.
   ========================================================================== */

import { SHED, cornerXZ, flatOut, polygonArea } from './roomModel.js';

/** Floor/loft local frame: x = east, y = north, origin at the SW corner of the bounding square. */
export const FLOOR_ORIGIN = [SHED.centre[0] - SHED.apothem, 0, SHED.centre[2] + SHED.apothem];
export const toFloorLocal = (x, z) => [x - FLOOR_ORIGIN[0], FLOOR_ORIGIN[2] - z];
export const fromFloorLocal = (lx, ly) => [lx + FLOOR_ORIGIN[0], FLOOR_ORIGIN[2] - ly];

/** Signed distance of (x, z) from the centre along flat k's outward normal. */
export function flatDist(k, x, z) {
  const o = flatOut(k);
  return (x - SHED.centre[0]) * o[0] + (z - SHED.centre[2]) * o[2];
}

/** Wall-local x of (x, z) on flat k (0 at the left corner seen from inside). */
export function wallLocalX(k, x, z) {
  const a = (k * Math.PI) / 4;
  const c = cornerXZ(k);
  return (x - c[0]) * Math.cos(a) + (z - c[2]) * Math.sin(a);
}

/** The flat (0..7) whose outward normal is nearest the direction of (x, z) from the centre. */
export function flatOfXZ(x, z) {
  const a = Math.atan2(x - SHED.centre[0], -(z - SHED.centre[2]));
  return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
}

/** Max over the 8 flats of the outward distance: < apothem ⇔ inside the octagon. */
export function octagonDist(x, z) {
  let m = -Infinity;
  for (let k = 0; k < 8; k++) m = Math.max(m, flatDist(k, x, z));
  return m;
}

/** The inner octagon in world xz, CCW seen from above in (x, −z) terms → CCW in floor-local. */
export function octagonFloorLocal() {
  const out = [];
  for (let k = 0; k < 8; k++) {
    const w = cornerXZ((8 - k) % 8);
    out.push(toFloorLocal(w[0], w[2]));
  }
  return out;
}

// ── 2-D polygons ────────────────────────────────────────────────────────────
const cross2 = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Convex hull (monotone chain), CCW, no collinear points. */
export function convexHull(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  if (pts.length < 3) return pts;
  const lower = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross2(lower[lower.length - 2], lower[lower.length - 1], p) <= 1e-12) lower.pop();
    lower.push(p);
  }
  const upper = [];
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i];
    while (upper.length >= 2 && cross2(upper[upper.length - 2], upper[upper.length - 1], p) <= 1e-12) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

/** Sutherland–Hodgman: clip `poly` to the CONVEX, CCW polygon `clip`. */
export function clipConvex(poly, clip) {
  let out = poly.slice();
  for (let i = 0; i < clip.length && out.length; i++) {
    const a = clip[i];
    const b = clip[(i + 1) % clip.length];
    const inside = (p) => cross2(a, b, p) >= -1e-12;
    const hit = (p, q) => {
      const d1 = cross2(a, b, p);
      const d2 = cross2(a, b, q);
      const t = d1 / (d1 - d2);
      return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    };
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const p = input[j];
      const q = input[(j + 1) % input.length];
      const pin = inside(p);
      const qin = inside(q);
      if (pin) out.push(p);
      if (pin !== qin) out.push(hit(p, q));
    }
  }
  return out;
}

/**
 * Drop vertices that barely change the outline: duplicates, collinear points
 * and corners whose removal changes the area by < `tol` m² (keeps hull shape
 * within ~1 cm with the default).
 */
export function simplifyPolygon(poly, tol = 2e-4, minEdge = 0.01) {
  let p = poly.slice();
  // merge neighbours closer than minEdge (to their midpoint)
  for (let i = 0; p.length > 3 && i < p.length; ) {
    const a = p[i];
    const b = p[(i + 1) % p.length];
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < minEdge) {
      p[i] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      p.splice((i + 1) % p.length, 1);
    } else i++;
  }
  let changed = true;
  while (changed && p.length > 3) {
    changed = false;
    let best = -1;
    let bestA = Infinity;
    for (let i = 0; i < p.length; i++) {
      const a = p[(i + p.length - 1) % p.length];
      const b = p[i];
      const c = p[(i + 1) % p.length];
      const area = Math.abs(cross2(a, b, c)) / 2;
      if (area < bestA) {
        bestA = area;
        best = i;
      }
    }
    if (bestA < tol) {
      p.splice(best, 1);
      changed = true;
    }
  }
  return p;
}

export const round3 = (poly) => poly.map(([x, y]) => [Math.round(x * 1000) / 1000, Math.round(y * 1000) / 1000]);

/**
 * Pull points that lie up to `tol` outside the CONVEX, CCW polygon `convex`
 * back onto its boundary (after rounding to mm, points on an irrational
 * octagon edge sit a fraction of a mm outside it).
 */
export function snapInto(poly, convex, tol = 0.003) {
  return poly.map(([x0, y0]) => {
    let x = x0;
    let y = y0;
    for (let it = 0; it < 8; it++) {
      let moved = false;
      for (let i = 0; i < convex.length; i++) {
        const a = convex[i];
        const b = convex[(i + 1) % convex.length];
        const ex = b[0] - a[0];
        const ey = b[1] - a[1];
        const L = Math.hypot(ex, ey);
        const d = (ex * (y - a[1]) - ey * (x - a[0])) / L; // > 0 inside (left of the edge)
        if (d < 0 && d > -tol) {
          // step −d along the inward (left) normal (−ey, ex)/L
          x += (ey / L) * d;
          y -= (ex / L) * d;
          moved = true;
        }
      }
      if (!moved) break;
    }
    return [x, y];
  });
}

export function ensureCCW(poly) {
  return polygonArea(poly) < 0 ? poly.slice().reverse() : poly;
}

export function rect(x0, y0, x1, y1) {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}

export function bbox2(poly) {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of poly) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

/** Barycentric point-in-triangle (2-D) with a small tolerance. */
export function inTri2(px, py, ax, ay, bx, by, cx, cy, eps = 1e-9) {
  const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
  if (Math.abs(d) < 1e-18) return false;
  const l1 = ((by - cy) * (px - cx) + (cx - bx) * (py - cy)) / d;
  const l2 = ((cy - ay) * (px - cx) + (ax - cx) * (py - cy)) / d;
  return l1 >= -eps && l2 >= -eps && 1 - l1 - l2 >= -eps;
}
