/* ============================================================================
   Plain 2-D polygon maths in the plan's [x, z] (x east, z south), shared by
   scene shells (shell.js), building.json (building/geometry.js), check-scene
   and the viewer. No three.js, so Node and the Worker can import it.
   Python mirror: tools/memory-rooms/blender/polygon2d.py (same names, snake_case).

   Winding: "positive" = the shoelace sum over (x, z) is > 0, which is
   CLOCKWISE on a north-up map (NW -> NE -> SE -> SW). For a positive polygon
   the outward normal of edge a -> b is (dz, -dx) / |d|.
   ========================================================================== */

export const EPS = 1e-9;

/** Shoelace area over (x, z): > 0 for NW -> NE -> SE -> SW order. */
export function signedArea(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    s += x1 * z2 - x2 * z1;
  }
  return s / 2;
}

export const area = (pts) => Math.abs(signedArea(pts));

/** 1 when the polygon winds positive (see the header), -1 otherwise. */
export const windingSign = (pts) => (signedArea(pts) >= 0 ? 1 : -1);

/** Outward unit normal of edge a -> b of a polygon with winding `sign`. */
export function edgeOut(a, b, sign = 1) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l = Math.hypot(dx, dz) || 1;
  return [(sign * dz) / l, (-sign * dx) / l];
}

export function bbox(pts) {
  let x0 = Infinity;
  let z0 = Infinity;
  let x1 = -Infinity;
  let z1 = -Infinity;
  for (const [x, z] of pts) {
    if (x < x0) x0 = x;
    if (z < z0) z0 = z;
    if (x > x1) x1 = x;
    if (z > z1) z1 = z;
  }
  return { min: [x0, z0], max: [x1, z1] };
}

/** Area centroid (falls back to the vertex mean for a degenerate polygon). */
export function centroid(pts) {
  const a = signedArea(pts);
  if (Math.abs(a) < EPS) return [pts.reduce((s, p) => s + p[0], 0) / pts.length, pts.reduce((s, p) => s + p[1], 0) / pts.length];
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, z1] = pts[i];
    const [x2, z2] = pts[(i + 1) % pts.length];
    const f = x1 * z2 - x2 * z1;
    cx += (x1 + x2) * f;
    cz += (z1 + z2) * f;
  }
  return [cx / (6 * a), cz / (6 * a)];
}

/** Even-odd point in polygon (a point on an edge may go either way: use distToEdges for tolerance). */
export function pointInPolygon([x, z], poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

/** Distance from p to segment a-b, and the parameter t (0 at a, 1 at b) of the closest point. */
export function segDist(p, a, b) {
  const dx = b[0] - a[0];
  const dz = b[1] - a[1];
  const l2 = dx * dx + dz * dz;
  let t = l2 > EPS ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return { d: Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz)), t };
}

/** Shortest distance from p to the polygon's boundary. */
export function distToBoundary(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]).d);
  return best;
}

const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/**
 * Where segments p1-p2 and q1-q2 cross properly (each strictly between its ends), or null.
 * Touching at an end, or running collinear, is not a proper crossing (see collinearOverlap).
 */
export function properCrossing(p1, p2, q1, q2, tol = 1e-6) {
  const d1 = cross(q1, q2, p1);
  const d2 = cross(q1, q2, p2);
  const d3 = cross(p1, p2, q1);
  const d4 = cross(p1, p2, q2);
  if (((d1 > tol && d2 < -tol) || (d1 < -tol && d2 > tol)) && ((d3 > tol && d4 < -tol) || (d3 < -tol && d4 > tol))) {
    const t = d1 / (d1 - d2);
    return [p1[0] + t * (p2[0] - p1[0]), p1[1] + t * (p2[1] - p1[1])];
  }
  return null;
}

/** Length along which two segments lie on one line (0 if they don't), within `tol` metres. */
export function collinearOverlap(p1, p2, q1, q2, tol = 0.01) {
  const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
  if (len < EPS) return 0;
  const ux = (p2[0] - p1[0]) / len;
  const uz = (p2[1] - p1[1]) / len;
  const off = (q) => Math.abs((q[0] - p1[0]) * uz - (q[1] - p1[1]) * ux);
  if (off(q1) > tol || off(q2) > tol) return 0;
  const s = (q) => (q[0] - p1[0]) * ux + (q[1] - p1[1]) * uz;
  const a = Math.min(s(q1), s(q2));
  const b = Math.max(s(q1), s(q2));
  return Math.max(0, Math.min(len, b) - Math.max(0, a));
}

/**
 * A simple polygon: at least 3 corners, no edge shorter than `minEdge`, no
 * spike (an edge folding straight back on the previous one), and no two
 * non-adjacent edges crossing or touching.
 */
export function isSimple(pts, minEdge = 0.01) {
  const n = pts.length;
  if (n < 3) return false;
  for (let k = 0; k < n; k++) {
    const prev = pts[(k - 1 + n) % n];
    const cur = pts[k];
    const next = pts[(k + 1) % n];
    if (Math.hypot(next[0] - cur[0], next[1] - cur[1]) < minEdge) return false;
    const d1 = [cur[0] - prev[0], cur[1] - prev[1]];
    const d2 = [next[0] - cur[0], next[1] - cur[1]];
    const crs = d1[0] * d2[1] - d1[1] * d2[0];
    const dot = d1[0] * d2[0] + d1[1] * d2[1];
    if (Math.abs(crs) < 1e-9 * (Math.hypot(...d1) * Math.hypot(...d2) || 1) && dot < 0) return false;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (j === i + 1 || (i === 0 && j === n - 1)) continue; // neighbours share a corner
      const a1 = pts[i];
      const a2 = pts[(i + 1) % n];
      const b1 = pts[j];
      const b2 = pts[(j + 1) % n];
      if (properCrossing(a1, a2, b1, b2)) return false;
      if (segDist(b1, a1, a2).d < 1e-4 || segDist(b2, a1, a2).d < 1e-4 || segDist(a1, b1, b2).d < 1e-4 || segDist(a2, b1, b2).d < 1e-4) return false;
    }
  }
  return true;
}

/** Is the polygon convex (allowing straight, collinear corners)? */
export function isConvex(pts) {
  let sign = 0;
  for (let i = 0; i < pts.length; i++) {
    const c = cross(pts[i], pts[(i + 1) % pts.length], pts[(i + 2) % pts.length]);
    if (Math.abs(c) < 1e-9) continue;
    if (!sign) sign = Math.sign(c);
    else if (Math.sign(c) !== sign) return false;
  }
  return true;
}

/**
 * Move every edge inward by its own distance (dists[i] for edge i -> i+1) and
 * rejoin neighbours where their offset lines meet. Two parallel neighbours with
 * different distances get a small step between them. `sign` = windingSign(pts).
 */
export function insetPolygon(pts, dists, sign = windingSign(pts)) {
  const out = [];
  const add = (p) => {
    const last = out[out.length - 1];
    if (!last || Math.hypot(last[0] - p[0], last[1] - p[1]) > 1e-6) out.push(p);
  };
  for (const e of insetEdges(pts, dists, sign)) {
    add(e.start);
    add(e.end);
  }
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 1 && Math.hypot(last[0] - first[0], last[1] - first[1]) <= 1e-6) out.pop();
  return out;
}

/**
 * The inset edges themselves: [{ start, end }] per edge i, on its offset line. A corner
 * between non-parallel neighbours is shared (end of i-1 = start of i); between parallel
 * neighbours each keeps its own offset copy of the corner (insetPolygon adds the step).
 */
export function insetEdges(pts, dists, sign = windingSign(pts)) {
  const n = pts.length;
  const lines = pts.map((a, i) => {
    const b = pts[(i + 1) % n];
    const o = edgeOut(a, b, sign);
    const d = dists[i] || 0;
    return { a: [a[0] - o[0] * d, a[1] - o[1] * d], b: [b[0] - o[0] * d, b[1] - o[1] * d] };
  });
  const corner = (i) => {
    const L1 = lines[(i - 1 + n) % n];
    const L2 = lines[i];
    const hit = lineIntersect(L1.a, L1.b, L2.a, L2.b);
    return hit ? [hit, hit] : [L1.b, L2.a];
  };
  const corners = pts.map((_, i) => corner(i)); // [end of edge i-1, start of edge i]
  return lines.map((_, i) => {
    const s = corners[i][1];
    const e = corners[(i + 1) % n][0];
    return { start: s, end: e };
  });
}

/** Intersection of the infinite lines a1-a2 and b1-b2, or null when parallel. */
export function lineIntersect(a1, a2, b1, b2) {
  const d1 = [a2[0] - a1[0], a2[1] - a1[1]];
  const d2 = [b2[0] - b1[0], b2[1] - b1[1]];
  const den = d1[0] * d2[1] - d1[1] * d2[0];
  const scale = Math.hypot(...d1) * Math.hypot(...d2);
  if (Math.abs(den) < 1e-9 * (scale || 1)) return null;
  const t = ((b1[0] - a1[0]) * d2[1] - (b1[1] - a1[1]) * d2[0]) / den;
  return [a1[0] + t * d1[0], a1[1] + t * d1[1]];
}

/**
 * First boundary hit of the ray from c through p: returns s = |p - c| / |hit - c|
 * (0 at c, 1 on the boundary, > 1 outside). For a polygon star-shaped about c.
 */
export function rayScale(c, p, poly) {
  const dx = p[0] - c[0];
  const dz = p[1] - c[1];
  if (Math.hypot(dx, dz) < EPS) return 0;
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ex = b[0] - a[0];
    const ez = b[1] - a[1];
    const den = dx * ez - dz * ex;
    if (Math.abs(den) < EPS) continue;
    const t = ((a[0] - c[0]) * ez - (a[1] - c[1]) * ex) / den; // along the ray, 1 = p
    const u = ((a[0] - c[0]) * dz - (a[1] - c[1]) * dx) / den; // along the edge
    if (t > EPS && u >= -1e-9 && u <= 1 + 1e-9 && t < best) best = t;
  }
  return Number.isFinite(best) ? 1 / best : Infinity;
}
