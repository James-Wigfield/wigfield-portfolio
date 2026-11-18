/* PROJECTOR LIFE — life/lib/geom.js: the few 2-D helpers the life host needs.
   Same maths as room/roomModel.js (mapPoint / mapDir / mapAngle / point in
   polygon / toWorld), kept local so life/ does not depend on room/ internals,
   only on the Patch shape in CONTRACTS.md §2. */

export function mapPoint(M, x, y) {
  return [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]];
}

export function mapDir(M, dx, dy) {
  return [M[0] * dx + M[1] * dy, M[2] * dx + M[3] * dy];
}

export function mapAngle(M) {
  return Math.atan2(M[2], M[0]);
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Patch-local (x, y) plus a height d along the inward normal → world [x, y, z]. */
export function toWorld(p, x, y, d = 0) {
  const o = p.origin, u = p.u, v = p.v, n = p.normal;
  return [
    o[0] + u[0] * x + v[0] * y + n[0] * d,
    o[1] + u[1] * x + v[1] * y + n[1] * d,
    o[2] + u[2] * x + v[2] * y + n[2] * d,
  ];
}

/** Local direction (dx, dy, dd) → world direction. */
export function dirToWorld(p, dx, dy, dd = 0) {
  const u = p.u, v = p.v, n = p.normal;
  return [
    u[0] * dx + v[0] * dy + n[0] * dd,
    u[1] * dx + v[1] * dy + n[1] * dd,
    u[2] * dx + v[2] * dy + n[2] * dd,
  ];
}

export const wrapAngle = (a) => {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  else if (a < -Math.PI) a += Math.PI * 2;
  return a;
};
