/* ============================================================================
   PROJECTOR LIFE — cutaway fades (the Memory Rooms dollhouse, per flat/facet)
   ----------------------------------------------------------------------------
   Each wall flat (8), each new-roof facet (8) and each old-roof sector (8) is
   a fade group with its own material clones; hip battens follow the brighter
   of their two facets, the apex boss the brightest facet. Per frame, from the
   camera position:
     · room.cutaway off, or the camera inside the room → everything shows;
     · outside → a wall hides when the camera is round to its outside
       (out_k · camDir > HIDE_DOT, as dollhouse.js); a roof facet shows only
       when the camera sees its UNDERSIDE (camera below the facet's plane) and
       it isn't one of the near facets (same test as the walls). So from a
       three-quarter view the far facets show as a tent over the far walls,
       and from above (the plan view) the whole roof is gone.
   Fades move over FADE_MS. A fully faded mesh is moved to FADED_LAYER (not
   .visible = false) so the main camera skips it but a projector's depth
   camera can still include it (`camera.layers.enable(FADED_LAYER)`): the
   cutaway is a viewing aid, not a change to the room.
   ========================================================================== */

import { SHED, flatOut } from './roomModel.js';
import { octagonDist, flatDist } from './geom2d.js';

export const FADED_LAYER = 7;
const HIDE_DOT = 0.18;
const FADE_MS = 220;
const OVERHEAD = 0.35; // camera within this horizontal distance of the centre counts as straight above

/** A fade group over meshes (their materials are the group's own instances). */
export function fadeGroup(meshes, extraMats = []) {
  const mats = [];
  for (const o of meshes) {
    o.traverse?.((c) => {
      if (c.isMesh && !mats.includes(c.material)) mats.push(c.material);
    });
  }
  for (const m of extraMats) if (!mats.includes(m)) mats.push(m);
  for (const m of mats) {
    m.userData.baseOpacity = m.opacity;
    m.userData.baseTransparent = m.transparent;
  }
  return { meshes, mats, value: 1, target: 1, applied: 1 };
}

function apply(g) {
  if (g.applied === g.value) return;
  g.applied = g.value;
  for (const m of g.mats) {
    m.opacity = m.userData.baseOpacity * g.value;
    const tr = m.userData.baseTransparent || g.value < 1;
    if (m.transparent !== tr) {
      m.transparent = tr;
      m.needsUpdate = true; // OPAQUE is a program define in three r185
    }
  }
  const hidden = g.value <= 0.001;
  for (const o of g.meshes) {
    o.traverse((c) => {
      if (hidden) c.layers.set(FADED_LAYER);
      else c.layers.set(0);
    });
  }
}

function step(g, dtMs, snap) {
  if (g.value !== g.target) {
    const d = snap ? 1 : dtMs / FADE_MS;
    g.value = g.target > g.value ? Math.min(g.target, g.value + d) : Math.max(g.target, g.value - d);
  }
  apply(g);
}

/**
 * groups = { walls: G[8], roof: G[8], hips: G[8], boss: G, oldRoof: G[8] }
 * update(camera, dtMs, { cutaway, newApex, oldRoof })
 */
export function createFades(groups) {
  let fresh = true;
  const A = SHED.apothem;
  const H = SHED.eaveY;
  const outs = Array.from({ length: 8 }, (_, k) => flatOut(k));

  function update(camera, dtMs, { cutaway = true, apex = SHED.apex.default, oldRoof = false } = {}) {
    const p = camera.position;
    const tan = ((oldRoof ? SHED.oldRoof.apex : apex) - H) / A;
    const od = octagonDist(p.x, p.z);
    const roofY = H + (A - od) * tan; // the roof's underside above the camera (inside the footprint)
    const inside = od < A - 0.01 && p.y > -0.05 && p.y < roofY - 0.02;
    const dx = p.x - SHED.centre[0];
    const dz = p.z - SHED.centre[2];
    const dh = Math.hypot(dx, dz);
    const all = !cutaway || inside;
    const ux = dh > 1e-6 ? dx / dh : 0;
    const uz = dh > 1e-6 ? dz / dh : 0;

    for (let k = 0; k < 8; k++) {
      const near = !all && dh > OVERHEAD && outs[k][0] * ux + outs[k][2] * uz > HIDE_DOT;
      groups.walls[k].target = near ? 0 : 1;
      // the camera sees facet k's underside ⇔ it is below the facet's plane
      const planeY = H + (A - flatDist(k, p.x, p.z)) * tan;
      const under = p.y < planeY - 0.01;
      const show = all || (under && !near);
      groups.roof[k].target = show ? 1 : 0;
      if (groups.oldRoof[k]) groups.oldRoof[k].target = show ? 1 : 0;
    }
    const snap = fresh;
    fresh = false;
    for (const g of groups.walls) step(g, dtMs, snap);
    for (const g of groups.roof) step(g, dtMs, snap);
    for (const g of groups.oldRoof) if (g) step(g, dtMs, snap);
    let maxRoof = 0;
    for (let j = 0; j < 8; j++) {
      const v = Math.max(groups.roof[(j + 7) % 8].value, groups.roof[j].value);
      groups.hips[j].value = groups.hips[j].target = v;
      apply(groups.hips[j]);
      maxRoof = Math.max(maxRoof, groups.roof[j].value);
    }
    groups.boss.value = groups.boss.target = maxRoof;
    apply(groups.boss);
  }

  return {
    update,
    /** Current fade value (0..1) of a patch's surface ('wall-N', 'roof-NE', 'floor', 'loft'). */
    patchValue(patch) {
      if (patch.kind === 'wall') return groups.walls[patch.k].value;
      if (patch.kind === 'roof') return groups.roof[patch.k].value;
      return 1;
    },
    snapNext() {
      fresh = true;
    },
  };
}
