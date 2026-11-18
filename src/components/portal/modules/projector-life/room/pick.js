/* ============================================================================
   PROJECTOR LIFE — picking a patch under the pointer
   ----------------------------------------------------------------------------
   pick(raycaster) → { patchId, local: [x, y], world: [x, y, z] } | null
     1. intersect the ray with every SHOWN patch's plane, from its room side
        only (we always see the inside of a patch), inside its polygon;
     2. if a visible mesh (furniture, loft, the walls' and roof's outsides) is
        hit first and stands more than 3 cm off that surface → null (the
        surface's own mesh and its trims — band, skirting, battens — don't);
     3. if the hit is inside an ACTIVE mask (map.mask.*) → null.
   ========================================================================== */

import { toLocal, pointInPolygon } from './roomModel.js';



/**
 * ctx = {
 *   patches, shown(patch) → bool, blockers: Object3D[] (visible-aware),
 *   maskOn: { door, window, loft, furniture },
 * }
 */
export function pickPatch(raycaster, ctx) {
  const { origin, direction } = raycaster.ray;
  const o = [origin.x, origin.y, origin.z];
  const d = [direction.x, direction.y, direction.z];
  let best = null;
  for (const p of ctx.patches) {
    if (!ctx.shown(p)) continue;
    const n = p.normal;
    const dn = d[0] * n[0] + d[1] * n[1] + d[2] * n[2];
    if (dn > -1e-6) continue; // seen from behind (or edge-on)
    const q = toLocal(p, o); //   q[2] = height of the origin above the plane (room side +)
    const t = q[2] / -dn;
    if (t < raycaster.near || t > raycaster.far) continue;
    if (best && t >= best.t) continue;
    const w = [o[0] + d[0] * t, o[1] + d[1] * t, o[2] + d[2] * t];
    const l = toLocal(p, w);
    if (!pointInPolygon(l[0], l[1], p.polygon)) continue;
    best = { t, p, local: [l[0], l[1]], world: w };
  }
  if (!best) return null;

  // something solid in front of the surface?
  const hits = []; // local: a module-level array would keep the last mesh (and its atlas) alive
  const blockers = ctx.blockers.filter((b) => b.visible !== false && isShown(b));
  raycaster.intersectObjects(blockers, true, hits);
  const first = hits.find((h) => isShown(h.object));
  if (first && first.distance < best.t - 1e-4) {
    // Trim proud of the surface (band, skirting, battens: ≤ 2 cm) and the
    // surface's own mesh don't block; anything standing further out does.
    const h = toLocal(best.p, [first.point.x, first.point.y, first.point.z])[2];
    if (h > 0.03) return null;
  }

  for (const m of best.p.masks) {
    if (!ctx.maskOn[m.kind]) continue;
    if (pointInPolygon(best.local[0], best.local[1], m.polygon)) return null;
  }
  return { patchId: best.p.id, local: best.local, world: best.world };
}

/** Visible all the way up the tree. */
function isShown(o) {
  for (let x = o; x; x = x.parent) if (x.visible === false) return false;
  return true;
}
