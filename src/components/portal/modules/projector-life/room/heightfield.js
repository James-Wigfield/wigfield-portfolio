/* ============================================================================
   PROJECTOR LIFE — landing heightfield (pure data, Node-safe)
   ----------------------------------------------------------------------------
   Built once at load from the upward-facing triangles of the floor, the loft
   and the furniture (world-space triangle soups, see measure.js). A grid of
   4 cm cells over the bounding square; each cell keeps up to LAYERS heights,
   each tagged with its source, so a body falling from the roof over the loft
   finds the deck (or the bags on it) and one dropped under the deck finds the
   cabinet or the floor.

     landing(x, z, fromY, { furniture, loft }) →
       { y, patchId: 'floor'|'loft'|null, local: [x, y], surface: 'floor'|'loft'|'furniture' }

   `local` is always in the FLOOR/LOFT frame (x east, y north from the SW
   bounding corner) — on furniture it is where the body sits in plan.
   ========================================================================== */

import { SHED, pointInPolygon } from './roomModel.js';
import { MEASURED } from './measured.js';
import { toFloorLocal, octagonDist, octagonFloorLocal } from './geom2d.js';
import { forTris } from './measure.js';

export const SRC = Object.freeze({ NONE: 0, FLOOR: 1, LOFT: 2, LOFT_OTHER: 3, FURNITURE: 4 });
const LAYERS = 8;
const MERGE = 0.03; //        same source within 3 cm → one layer
const UP = 0.35; //           normal.y above this counts as something to land on (≲ 70° slope)
const LOFT_PILE = 0.45; //    mattress and bags up to this far above the deck still count as "the loft"

export function buildHeightfield(prims, { cell = 0.04, deck = MEASURED.deck } = {}) {
  const pad = 0.14;
  const x0 = SHED.centre[0] - SHED.apothem - pad;
  const z0 = SHED.centre[2] - SHED.apothem - pad;
  const span = 2 * (SHED.apothem + pad);
  const n = Math.ceil(span / cell);
  const cells = n * n;
  const heights = new Float32Array(cells * LAYERS).fill(-Infinity);
  const srcs = new Uint8Array(cells * LAYERS);
  const counts = new Uint8Array(cells);

  function insert(c, y, src) {
    const base = c * LAYERS;
    const m = counts[c];
    for (let i = 0; i < m; i++) {
      if (srcs[base + i] === src && Math.abs(heights[base + i] - y) < MERGE) {
        if (y > heights[base + i]) heights[base + i] = y;
        return;
      }
    }
    if (m < LAYERS) {
      heights[base + m] = y;
      srcs[base + m] = src;
      counts[c] = m + 1;
      return;
    }
    // Full: merge the closest pair (keeps the higher one) to make room.
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < m; i++) {
      const d = Math.abs(heights[base + i] - y);
      if (d < bd) [bd, bi] = [d, i];
    }
    if (y > heights[base + bi]) {
      heights[base + bi] = y;
      srcs[base + bi] = src;
    }
  }

  const deckPoly = deck.polygon;
  const srcOf = (prim, cx, cy, cz) => {
    if (prim.kind === 'floor') return SRC.FLOOR;
    if (prim.kind === 'loft') {
      const [lx, ly] = toFloorLocal(cx, cz);
      if (cy > deck.y - 0.02 && cy < deck.y + LOFT_PILE && pointInPolygon(lx, ly, deckPoly)) return SRC.LOFT;
      return SRC.LOFT_OTHER;
    }
    return SRC.FURNITURE;
  };

  for (const prim of prims) {
    if (!['floor', 'loft', 'furniture'].includes(prim.kind)) continue;
    const P = prim.positions;
    forTris(prim, (a, b, c) => {
      const ax = P[a], ay = P[a + 1], az = P[a + 2];
      const bx = P[b], by = P[b + 1], bz = P[b + 2];
      const cx = P[c], cy = P[c + 1], cz = P[c + 2];
      // normal y (unnormalised) and length
      const e1x = bx - ax, e1y = by - ay, e1z = bz - az;
      const e2x = cx - ax, e2y = cy - ay, e2z = cz - az;
      const nx = e1y * e2z - e1z * e2y;
      const ny = e1z * e2x - e1x * e2z;
      const nz = e1x * e2y - e1y * e2x;
      const L = Math.hypot(nx, ny, nz);
      if (L < 1e-12 || ny / L < UP) return;
      const src = srcOf(prim, (ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
      // barycentric in xz
      const det = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz);
      if (Math.abs(det) < 1e-14) return;
      const i0 = Math.max(0, Math.floor((Math.min(ax, bx, cx) - x0) / cell));
      const i1 = Math.min(n - 1, Math.floor((Math.max(ax, bx, cx) - x0) / cell));
      const j0 = Math.max(0, Math.floor((Math.min(az, bz, cz) - z0) / cell));
      const j1 = Math.min(n - 1, Math.floor((Math.max(az, bz, cz) - z0) / cell));
      let hit = false;
      for (let j = j0; j <= j1; j++) {
        const pz = z0 + (j + 0.5) * cell;
        for (let i = i0; i <= i1; i++) {
          const px = x0 + (i + 0.5) * cell;
          const l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / det;
          const l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / det;
          const l3 = 1 - l1 - l2;
          if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
          insert(j * n + i, l1 * ay + l2 * by + l3 * cy, src);
          hit = true;
        }
      }
      if (!hit) {
        // Smaller than a cell: register it where its centroid falls.
        const gx = (ax + bx + cx) / 3;
        const gz = (az + bz + cz) / 3;
        const i = Math.min(n - 1, Math.max(0, Math.floor((gx - x0) / cell)));
        const j = Math.min(n - 1, Math.max(0, Math.floor((gz - z0) / cell)));
        insert(j * n + i, (ay + by + cy) / 3, src);
      }
    });
  }

  const floorPoly = octagonFloorLocal();
  const A = SHED.apothem;
  const [Cx, , Cz] = SHED.centre;

  /**
   * Where a body dropped at (x, fromY, z) comes to rest: the highest enabled
   * surface at or below fromY. Points outside the inner octagon are pulled
   * just inside it first (bodies only fall from the room's own surfaces).
   */
  function landing(x, z, fromY, { furniture = true, loft = true } = {}) {
    const d = octagonDist(x, z);
    if (d > A - 0.002) {
      const s = (A - 0.002) / d;
      x = Cx + (x - Cx) * s;
      z = Cz + (z - Cz) * s;
    }
    const i = Math.min(n - 1, Math.max(0, Math.floor((x - x0) / cell)));
    const j = Math.min(n - 1, Math.max(0, Math.floor((z - z0) / cell)));
    const c = j * n + i;
    const base = c * LAYERS;
    let y = -Infinity;
    let src = SRC.NONE;
    for (let k = 0; k < counts[c]; k++) {
      const s = srcs[base + k];
      if (!furniture && s === SRC.FURNITURE) continue;
      if (!loft && (s === SRC.LOFT || s === SRC.LOFT_OTHER)) continue;
      const h = heights[base + k];
      if (h <= fromY + 1e-3 && h > y) [y, src] = [h, s];
    }
    if (src === SRC.NONE) [y, src] = [SHED.floorY, SRC.FLOOR];
    const local = toFloorLocal(x, z);
    if (src === SRC.FLOOR) {
      return { y, patchId: pointInPolygon(local[0], local[1], floorPoly) ? 'floor' : null, local, surface: 'floor' };
    }
    if (src === SRC.LOFT) return { y, patchId: 'loft', local, surface: 'loft' };
    return { y, patchId: null, local, surface: 'furniture' };
  }

  return { cell, n, x0, z0, layers: LAYERS, heights, srcs, counts, landing };
}
