/* ============================================================================
   PROJECTOR LIFE — one-click camera views of the She'd (pure data)
   ----------------------------------------------------------------------------
   { position, target, fov } in the GLB frame (metres, +y up, north = −z).
   The Stage tweens between them; the room's fades (cutaway) follow the camera.
   ========================================================================== */

import { SHED, flatOut } from './roomModel.js';

const [CX, , CZ] = SHED.centre;
const deg = Math.PI / 180;

/** A point at `dist` from the room centre on bearing `bearingDeg` (0 = north, 90 = east), height y. */
export function onBearing(bearingDeg, dist, y) {
  return [CX + dist * Math.sin(bearingDeg * deg), y, CZ - dist * Math.cos(bearingDeg * deg)];
}

// The hero: three-quarter from outside the SSE, ≈ 22° down at the default
// apex. Near walls and near facets fade (fades.js); the far facets show their
// underside as a tent over the loft (W), the armchair (N) and the window (NE).
const HERO = { bearing: 152, dist: 6.3, maxY: 3.75, minY: 2.7, under: 1.1 };

/** How much further back a view must sit on a canvas narrower than square (same vertical fov). */
const backOff = (aspect, max = 1.75) => Math.min(max, Math.max(1, 1 / (aspect || 1)));

/**
 * The cutaway for a given roof apex (the patches' apex: 2.738 for the old
 * roof) and canvas aspect. A far facet's underside is only visible from below
 * its plane, and a low roof seen from just under its plane is a sliver; so the
 * camera sits at least `under` m below the highest far-facet plane, capped at
 * maxY (3.75 m for the default 3.3 m apex and anything steeper; 2.84 m at
 * apex 2.7). On a portrait canvas it dollies back (same angle) so the whole
 * octagon still fits across.
 */
export function cutawayView(apex = SHED.apex.default, aspect = 1) {
  const k = backOff(aspect);
  const tan = (apex - SHED.eaveY) / SHED.apothem;
  const [x, , z] = onBearing(HERO.bearing, HERO.dist * k, 0);
  let far = -Infinity;
  for (let j = 0; j < 8; j++) {
    const o = flatOut(j);
    const d = (x - CX) * o[0] + (z - CZ) * o[2];
    far = Math.max(far, SHED.eaveY + (SHED.apothem - d) * tan);
  }
  const want = 0.95 + (HERO.maxY - 0.95) * k;
  const y = Math.max(HERO.minY, Math.min(want, far - HERO.under));
  return { position: [x, y, z], target: [CX - 0.1, 0.95 + (want - y) * 0.25, CZ - 0.05], fov: 46 };
}

/** Top-down plan; higher on a portrait canvas so the octagon fits across. */
export function planView(aspect = 1) {
  return { position: [CX, 9.2 * backOff(aspect / 0.85, 1.6), CZ + 0.001], target: [CX, 0, CZ], fov: 40 };
}

export const VIEWS = Object.freeze({
  cutaway: Object.freeze(cutawayView()),
  // Standing in the doorway on the S flat, eye 1.6 m, looking in (a touch down
  // and toward the armchair: the floor, the far walls and the apex all in frame).
  door: Object.freeze({ position: [CX, 1.6, CZ + SHED.apothem - 0.06], target: [CX - 0.13, 1.5, CZ - 1.6], fov: 78 }),
  // Seated in the rust armchair against the N flat (eye ≈ 1.1 m), looking
  // across the room to the door and the loft.
  armchair: Object.freeze({ position: [2.72, 1.12, 0.42], target: [1.55, 1.25, 3.6], fov: 72 }),
  // Lying on the loft deck by the W wall (eye 1.3 m), looking up at the roof.
  loft: Object.freeze({ position: [0.32, 1.3, 2.25], target: [2.6, 3.5, 2.0], fov: 80 }),
  // Top-down plan, north up (roof hidden by the fades: the camera is above every facet).
  plan: Object.freeze(planView()),
});
