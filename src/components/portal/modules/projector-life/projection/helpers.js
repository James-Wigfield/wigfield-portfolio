/* ============================================================================
   PROJECTOR LIFE — projector helpers in the 3-D room
   ----------------------------------------------------------------------------
   Per projector: a small dark body with a lens (always, it's a real object),
   and with proj.frustum on:
     * four edge rays from the lens to where the frame corners land,
     * the frame's outline as it lands on the room (ray-cast against the
       patches, so it bends across corners — the warp, drawn),
     * a very faint additive light volume hugging that outline.
   Readable but quiet in a dark room. Rebuilt only when poses/roof change.
   ========================================================================== */

import * as THREE from 'three';
import { PROJECTOR_COLORS, rayPatches, rayThrough } from './projector.js';

const EDGE_SAMPLES = 40; // per frame edge
const OUTLINE_LIFT = 0.006; // m back toward the lens (no z-fighting)

/**
 * The frame boundary as landed points (CCW from bottom-left) with the patch
 * each one landed on (ids, null = nothing hit), + the 4 corner hits.
 */
export function footprint(P, patches) {
  const pts = [];
  const ids = [];
  const corners = [];
  const edges = [
    [[-1, -1], [1, -1]],
    [[1, -1], [1, 1]],
    [[1, 1], [-1, 1]],
    [[-1, 1], [-1, -1]],
  ];
  for (const [[ax, ay], [bx, by]] of edges) {
    for (let k = 0; k < EDGE_SAMPLES; k++) {
      const s = k / EDGE_SAMPLES;
      const dir = rayThrough(P, ax + (bx - ax) * s, ay + (by - ay) * s);
      const h = rayPatches(patches, P.pos, dir);
      const t = h ? h.t : 3;
      const q = [P.pos[0] + dir[0] * (t - OUTLINE_LIFT), P.pos[1] + dir[1] * (t - OUTLINE_LIFT), P.pos[2] + dir[2] * (t - OUTLINE_LIFT)];
      pts.push(q);
      ids.push(h ? h.patch.id : null);
      if (k === 0) corners.push(q);
    }
  }
  return { pts, ids, corners };
}

export function createHelpers(scene) {
  const root = new THREE.Group();
  root.name = 'pjl-projectors';
  scene.add(root);

  const bodyGeo = new THREE.BoxGeometry(0.3, 0.1, 0.24);
  bodyGeo.translate(0, 0, 0.13); // behind the lens (local −z = forward)
  // the lens sits exactly on the projection origin, so the rays leave from it
  const lensGeo = new THREE.CylinderGeometry(0.034, 0.04, 0.03, 20);
  lensGeo.rotateX(Math.PI / 2);
  const ventGeo = new THREE.BoxGeometry(0.2, 0.004, 0.12);
  ventGeo.translate(0, 0.051, 0.16);
  const bodyMat = new THREE.MeshBasicMaterial({ color: 0x2a2e36 });
  const ventMat = new THREE.MeshBasicMaterial({ color: 0x14161b });

  const slots = []; // per projector: { group, body, frustum, mats, geos }

  function clearSlot(s) {
    root.remove(s.group);
    for (const g of s.geos) g.dispose();
    for (const m of s.mats) m.dispose();
  }

  /**
   * Rebuild for the active projector list.
   *   projectors: projectorFromValues() records; patches: the room's patches.
   */
  function rebuild(projectors, patches, showFrustum) {
    for (const s of slots) clearSlot(s);
    slots.length = 0;
    projectors.forEach((P, i) => {
      const color = new THREE.Color(PROJECTOR_COLORS[i]);
      const group = new THREE.Group();
      group.name = `pjl-projector-${i}`;
      const mats = [];
      const geos = [];

      // body, oriented by the pose basis (local x = right, y = up, z = back)
      const body = new THREE.Group();
      body.matrixAutoUpdate = false;
      const back = [-P.f[0], -P.f[1], -P.f[2]];
      body.matrix.makeBasis(new THREE.Vector3(...P.right), new THREE.Vector3(...P.up), new THREE.Vector3(...back)).setPosition(...P.pos);
      const lensMat = new THREE.MeshBasicMaterial({ color: color.clone().lerp(new THREE.Color(0xffffff), 0.5) });
      mats.push(lensMat);
      body.add(new THREE.Mesh(bodyGeo, bodyMat), new THREE.Mesh(ventGeo, ventMat), new THREE.Mesh(lensGeo, lensMat));
      group.add(body);

      const frustum = new THREE.Group();
      frustum.visible = !!showFrustum;
      const outline = new Map(); // patch id → LineSegments (hidden while that patch is cut away)
      if (patches?.length) {
        const { pts, ids, corners } = footprint(P, patches);
        const lens = new THREE.Vector3(...P.pos);
        // four edge rays (from the lens)
        const rayPos = [];
        for (const c of corners) rayPos.push(lens.x, lens.y, lens.z, c[0], c[1], c[2]);
        const rayGeo = new THREE.BufferGeometry();
        rayGeo.setAttribute('position', new THREE.Float32BufferAttribute(rayPos, 3));
        const rayMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
        frustum.add(new THREE.LineSegments(rayGeo, rayMat));
        // the frame's outline where it lands, one segment set per patch
        const outMat = new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false });
        const byPatch = new Map();
        for (let k = 0; k < pts.length; k++) {
          const id = ids[k] ?? ids[(k + 1) % pts.length] ?? '-';
          if (!byPatch.has(id)) byPatch.set(id, []);
          byPatch.get(id).push(...pts[k], ...pts[(k + 1) % pts.length]);
        }
        for (const [id, arr] of byPatch) {
          const g = new THREE.BufferGeometry();
          g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
          const seg = new THREE.LineSegments(g, outMat);
          frustum.add(seg);
          outline.set(id, seg);
          geos.push(g);
        }
        // faint light volume: a fan from the lens along the outline
        const vol = [];
        for (let k = 0; k < pts.length; k++) {
          const a = pts[k];
          const b = pts[(k + 1) % pts.length];
          vol.push(lens.x, lens.y, lens.z, a[0], a[1], a[2], b[0], b[1], b[2]);
        }
        const volGeo = new THREE.BufferGeometry();
        volGeo.setAttribute('position', new THREE.Float32BufferAttribute(vol, 3));
        const volMat = new THREE.MeshBasicMaterial({
          color,
          transparent: true,
          opacity: 0.035,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
          toneMapped: false,
        });
        frustum.add(new THREE.Mesh(volGeo, volMat));
        mats.push(rayMat, outMat, volMat);
        geos.push(rayGeo, volGeo);
      }
      group.add(frustum);
      for (const o of [group, frustum]) o.traverse((c) => (c.frustumCulled = false));
      root.add(group);
      slots.push({ group, body, frustum, outline, mats, geos, pos: P.pos });
    });
  }

  function setFrustumVisible(on) {
    for (const s of slots) s.frustum.visible = !!on;
  }

  /**
   * Per frame: hide a projector's own helpers when the camera sits in its
   * lens, and the landed outline on patches the cutaway has faded
   * (fadeOf(patchId) → 0..1; segments that landed nowhere stay visible).
   */
  function beforeRender(camera, fadeOf = null) {
    const c = camera.position;
    for (const s of slots) {
      const d = Math.hypot(c.x - s.pos[0], c.y - s.pos[1], c.z - s.pos[2]);
      s.group.visible = d > 0.2;
      if (fadeOf && s.frustum.visible) for (const [id, seg] of s.outline) seg.visible = id === '-' || fadeOf(id) > 0.5;
    }
  }

  function dispose() {
    for (const s of slots) clearSlot(s);
    slots.length = 0;
    scene.remove(root);
    bodyGeo.dispose();
    lensGeo.dispose();
    ventGeo.dispose();
    bodyMat.dispose();
    ventMat.dispose();
  }

  return { rebuild, setFrustumVisible, beforeRender, dispose, root };
}
