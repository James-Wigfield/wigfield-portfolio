/* ============================================================================
   PROJECTOR LIFE — room model (pure maths, no three.js, runs in Node)
   ----------------------------------------------------------------------------
   The She'd as a list of planar PATCHES (8 wall flats, 8 roof facets, the
   octagonal floor, the loft deck) with local 2-D frames, masks, SEAMS and
   per-patch GRAVITY. See CONTRACTS.md §2 for the shape of every field.

   World frame = the GLB's own frame (measured, CONTRACTS.md §1):
     metres, +y up, origin at the NW corner of the 4.36 m bounding square,
     octagon centre C = (2.18, ·, 2.18), north = −z, east = +x.

   Every patch is right-handed about its INWARD normal (the side that faces
   the room, which is the side life lives on and projectors light):
     normal = u × v,  polygon wound CCW in local (x, y),
   so a shared edge is walked in opposite directions by its two patches and
   the seam map between them is a plain 2-D rotation + translation.

   Lead-authored reference implementation; the room agent owns and extends it
   (measured loft polygon + deck height, measured masks, old-roof apex)
   without changing the patch shape. Measured numbers come from measured.js,
   generated from the GLB by tools/projector-life/room-check.mjs --write.
   ========================================================================== */

import { MEASURED } from './measured.js';

// The old roof: a low pyramid from the eave (apothem 2.18, y 2.25) to a flat
// octagonal cap (circumradius 0.28 at y 2.68). Extended through the cap its
// facets meet at a virtual apex of ≈ 2.738 m (pitch ≈ 12.6°).
const OLD_CAP_APOTHEM = 0.28 * Math.cos(Math.PI / 8);
const OLD_SLOPE = (2.68 - 2.25) / (2.18 - OLD_CAP_APOTHEM);

export const SHED = Object.freeze({
  centre: [2.18, 0, 2.18],
  apothem: 2.18,
  circumradius: 2.18 / Math.cos(Math.PI / 8), // 2.3596
  side: 2 * 2.18 * Math.tan(Math.PI / 8), //     1.8059
  wallThickness: 0.1, //                          outer face at apothem 2.28
  floorY: 0,
  eaveY: 2.25,
  fasciaY: 2.14,
  jointY: 1.23,
  oldRoof: Object.freeze({
    capY: 2.68,
    capR: 0.28,
    apex: 2.25 + 2.18 * OLD_SLOPE, //           2.7379
    pitchDeg: (Math.atan(OLD_SLOPE) * 180) / Math.PI, // 12.6
  }),
  loftDeckY: MEASURED.deck.y, //                 1.100 (measured)
  apex: Object.freeze({ min: 2.7, max: 4.2, default: 3.3 }),
});

/** Apex the roof patches use: the slider's value, or the old roof's virtual apex. */
export function effectiveApex(values) {
  return values['room.oldRoof'] ? SHED.oldRoof.apex : values['room.apex'];
}

/** Flat k = 0..7, clockwise from north seen from above. */
export const FLATS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

// ── tiny vector helpers (arrays, not objects, so it all serialises) ─────────
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const norm = (a) => mul(a, 1 / (len(a) || 1));
export const vec = { add, sub, mul, dot, cross, len, norm };

/** Outward (away from the room) horizontal unit normal of flat k. */
export function flatOut(k) {
  const a = (k * Math.PI) / 4;
  return [Math.sin(a), 0, -Math.cos(a)];
}

/** Corner k sits between flat k−1 and flat k (flat k runs corner k → k+1). */
export function cornerXZ(k, y = 0) {
  const a = (k * Math.PI) / 4 - Math.PI / 8;
  const [cx, , cz] = SHED.centre;
  return [cx + SHED.circumradius * Math.sin(a), y, cz - SHED.circumradius * Math.cos(a)];
}

export function pitchDeg(apexY) {
  return (Math.atan2(apexY - SHED.eaveY, SHED.apothem) * 180) / Math.PI;
}

export function apexForPitch(deg) {
  return SHED.eaveY + SHED.apothem * Math.tan((deg * Math.PI) / 180);
}

/** Habitat type from the inward normal (y component against world up). */
export function surfaceTypeFromNormal(n) {
  if (n[1] > 0.5) return 'floor';
  if (n[1] < -0.5) return 'ceiling';
  return 'wall';
}

/** Local (x, y) → world. */
export function toWorld(p, x, y) {
  return add(p.origin, add(mul(p.u, x), mul(p.v, y)));
}

/** World → local (x, y) and signed height above the plane (along normal). */
export function toLocal(p, w) {
  const d = sub(w, p.origin);
  return [dot(d, p.u), dot(d, p.v), dot(d, p.normal)];
}

// ── 2-D helpers ─────────────────────────────────────────────────────────────
export function polygonArea(poly) {
  let a = 0;
  for (let i = 0; i < poly.length; i++) {
    const [x0, y0] = poly[i];
    const [x1, y1] = poly[(i + 1) % poly.length];
    a += x0 * y1 - x1 * y0;
  }
  return a / 2; // > 0 for CCW
}

export function pointInPolygon(x, y, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Apply a seam map M = [a, b, c, d, tx, ty] to a point. */
export function mapPoint(M, x, y) {
  return [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]];
}

/** Apply only the rotation part of M to a direction. */
export function mapDir(M, dx, dy) {
  return [M[0] * dx + M[1] * dy, M[2] * dx + M[3] * dy];
}

/** Rotation angle (radians) of a seam map; add it to a heading. */
export function mapAngle(M) {
  return Math.atan2(M[2], M[0]);
}

function gravityOf(p) {
  // World gravity, unit length (sims scale it by their own strength).
  const g = [0, -1, 0];
  return {
    gt: [dot(g, p.u), dot(g, p.v)], // the along-surface pull, in local axes
    gn: -dot(g, p.normal), //         + presses into the surface, − peels off
  };
}

function makePatch(id, kind, origin, u, v, polygon, extra = {}) {
  const normal = norm(cross(u, v));
  const xs = polygon.map((q) => q[0]);
  const ys = polygon.map((q) => q[1]);
  const p = {
    id,
    kind, // geometric family: 'wall' | 'roof' | 'floor' | 'loft'
    flat: null, // 'N'..'NW' for walls and roof facets
    origin,
    u,
    v,
    normal,
    polygon,
    width: Math.max(...xs),
    height: Math.max(...ys),
    area: polygonArea(polygon),
    typeAuto: surfaceTypeFromNormal(normal),
    masks: [],
    seams: [],
    ...extra,
  };
  if (Math.min(...xs) < -1e-9 || Math.min(...ys) < -1e-9) throw new Error(`patch ${id}: polygon leaves the +x/+y quadrant`);
  p.type = p.typeAuto;
  p.corners3d = polygon.map(([x, y]) => toWorld(p, x, y));
  p.centroid3d = mul(p.corners3d.reduce((s, c) => add(s, c), [0, 0, 0]), 1 / p.corners3d.length);
  p.gravity = gravityOf(p);
  return p;
}

/** Edge i of a patch runs polygon[i] → polygon[i+1]. World endpoints. */
function edgeWorld(p, i) {
  const a = p.polygon[i];
  const b = p.polygon[(i + 1) % p.polygon.length];
  return [toWorld(p, a[0], a[1]), toWorld(p, b[0], b[1])];
}

const near = (a, b, eps = 1e-6) => len(sub(a, b)) < eps;

/**
 * Seam map from patch A's local frame to patch B's across a shared edge:
 * the unfolding isometry (rotation + translation) that takes A's edge
 * (a0→a1) onto the same world points in B. A point just outside A lands
 * just inside B, and directions rotate by mapAngle(M).
 */
function seamMap(a0, a1, b0, b1) {
  const ta = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
  const tb = Math.atan2(b1[1] - b0[1], b1[0] - b0[0]);
  const r = tb - ta;
  const c = Math.cos(r);
  const s = Math.sin(r);
  // p' = R (p − a0) + b0
  return [c, -s, s, c, b0[0] - (c * a0[0] - s * a0[1]), b0[1] - (s * a0[0] + c * a0[1])];
}

/** Pair every edge whose world endpoints match another patch's edge. */
export function linkSeams(patches) {
  for (const p of patches) p.seams = [];
  const edges = [];
  for (const p of patches) {
    for (let i = 0; i < p.polygon.length; i++) {
      if (p.noSeams) continue;
      const [w0, w1] = edgeWorld(p, i);
      edges.push({ p, i, w0, w1 });
    }
  }
  for (const A of edges) {
    for (const B of edges) {
      if (A.p === B.p) continue;
      // Consistent winding: the shared edge runs the other way in B.
      if (!(near(A.w0, B.w1) && near(A.w1, B.w0))) continue;
      const a0 = A.p.polygon[A.i];
      const a1 = A.p.polygon[(A.i + 1) % A.p.polygon.length];
      const b1 = B.p.polygon[B.i]; //            B's edge start = A's edge end
      const b0 = B.p.polygon[(B.i + 1) % B.p.polygon.length];
      A.p.seams.push({ edge: A.i, to: B.p.id, toEdge: B.i, length: len(sub(A.w1, A.w0)), M: seamMap(a0, a1, b0, b1) });
    }
  }
  return patches;
}

/**
 * Build the patch list for a given apex height.
 *   opts.apex        roof apex height, m (SHED.apex.min..max; SHED.oldRoof.apex for the old roof)
 *   opts.loft        include the loft deck patch AND the loft masks (walls under/behind
 *                    the deck, the under-loft floor)
 *   opts.loftPolygon deck outline in floor-local coordinates (default: measured)
 *   opts.loftY       deck height (default: measured, 1.100)
 *   opts.furniture   include the furniture masks (floor footprints, walls stood against)
 *   opts.masks       mask list [{ patch, id, kind, polygon }] (default: measured, MEASURED.masks)
 * Masks are attached to their patch as { id, kind, polygon } (patch-local, CCW).
 */
export function buildPatches({
  apex = SHED.apex.default,
  loft = true,
  loftPolygon = null,
  loftY = null,
  furniture = true,
  masks = null,
} = {}) {
  const { side: s, eaveY: H, apothem: A, centre: C } = SHED;
  const up = [0, 1, 0];
  const patches = [];

  // Walls: origin = left corner (seen from inside) at floor level, x along the
  // flat to the right, y up. Edges: 0 bottom, 1 right, 2 top (eave), 3 left.
  for (let k = 0; k < 8; k++) {
    const nIn = mul(flatOut(k), -1);
    const u = cross(up, nIn);
    const origin = cornerXZ(k, SHED.floorY);
    patches.push(makePatch(`wall-${FLATS[k]}`, 'wall', origin, u, up, [[0, 0], [s, 0], [s, H], [0, H]], { flat: FLATS[k], k }));
  }

  // Roof facets: origin = left eave corner, x along the eave, y up the slope
  // to the apex. Edges: 0 eave, 1 right hip, 2 left hip.
  const h = apex - H;
  const slant = Math.hypot(A, h);
  for (let k = 0; k < 8; k++) {
    const out = flatOut(k);
    const vUp = norm([-out[0] * A, h, -out[2] * A]); // eave midpoint → apex
    const nIn = norm([-out[0] * h, -A, -out[2] * h]); //  down and toward the centre
    const u = cross(vUp, nIn);
    const origin = cornerXZ(k, H);
    patches.push(makePatch(`roof-${FLATS[k]}`, 'roof', origin, u, vUp, [[0, 0], [s, 0], [s / 2, slant]], { flat: FLATS[k], k, pitchDeg: pitchDeg(apex) }));
  }

  // Floor: x = east, y = north, origin at the SW corner of the bounding square
  // (world (cx − A, 0, cz + A)). Octagon wound CCW seen from above.
  const fo = [C[0] - A, SHED.floorY, C[2] + A];
  const floorU = [1, 0, 0];
  const floorV = [0, 0, -1];
  const toFloor = (w) => [w[0] - fo[0], fo[2] - w[2]];
  const floorPoly = [];
  for (let k = 0; k < 8; k++) floorPoly.push(toFloor(cornerXZ((8 - k) % 8)));
  patches.push(makePatch('floor', 'floor', fo, floorU, floorV, floorPoly));

  // Loft deck: a floor-type patch at 1.10 m, same axes as the floor. No seams
  // (its edges meet the walls mid-height, not edge to edge); creatures reach
  // it by falling. Polygon measured from the GLB by the room agent.
  if (loft) {
    const lo = [fo[0], loftY ?? SHED.loftDeckY, fo[2]];
    const poly = loftPolygon || DEFAULT_LOFT_POLYGON;
    patches.push(makePatch('loft', 'loft', lo, floorU, floorV, poly, { noSeams: true }));
  }

  const byId = new Map(patches.map((p) => [p.id, p]));
  for (const m of masks || MEASURED.masks) {
    if (m.kind === 'loft' && !loft) continue;
    if (m.kind === 'furniture' && !furniture) continue;
    const p = byId.get(m.patch);
    if (p) p.masks.push({ id: m.id, kind: m.kind, polygon: m.polygon.map((q) => q.slice()) });
  }

  linkSeams(patches);
  return patches;
}

/**
 * Loft deck outline in floor-local coordinates (x east, y north from the SW
 * bounding corner), CCW: measured from the GLB (the upward faces of `obj__loft`
 * at the deck height, clipped to the inner wall faces). The front edge runs
 * from the SW flat (1.148, 0.130) to the N flat (1.998, 4.360).
 */
export const DEFAULT_LOFT_POLYGON = MEASURED.deck.polygon.map((q) => q.slice());

/** Summary used by checks, the MCP preview and the Plan tab. */
export function describeRoom(patches) {
  const byType = { floor: 0, wall: 0, ceiling: 0 };
  for (const p of patches) byType[p.type] += p.area;
  return {
    patches: patches.length,
    areaByType: byType,
    seams: patches.reduce((n, p) => n + p.seams.length, 0),
  };
}
