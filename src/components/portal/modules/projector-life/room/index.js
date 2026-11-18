/* ============================================================================
   PROJECTOR LIFE — room runtime: loadRoom({ renderer, values })  (CONTRACTS §3)
   ----------------------------------------------------------------------------
   The She'd GLB as unlit baked twins (walls split into 8 flats, the old roof
   into 8 sectors), the new pointed roof, the patch model with measured masks,
   the landing heightfield, cutaway fades, visual aids and picking.

     loadShed.js   GLB → twins, per-flat split, triangle soups
     roof.js       the new roof (in-place apex updates)
     roomModel.js  patches, seams, gravity (pure)    measured.js  GLB numbers
     heightfield.js landing() (pure)                  views.js     camera views
     fades.js      cutaway                            aids.js      gravity/seams/labels
     pick.js       patch under a ray                  NOTES.md     decisions
   ========================================================================== */

import * as THREE from 'three';
import glbUrl from '../assets/she-d.glb?url';
import { buildPatches, effectiveApex, FLATS, SHED } from './roomModel.js';
import { MEASURED } from './measured.js';
import { loadShed, worldSoup } from './loadShed.js';
import { createRoof } from './roof.js';
import { createFades, fadeGroup, FADED_LAYER } from './fades.js';
import { createAids } from './aids.js';
import { pickPatch } from './pick.js';
import { buildHeightfield } from './heightfield.js';
import { VIEWS, cutawayView, planView } from './views.js';

/** What each surface mesh is (mesh.userData.pjl), for the projection's albedo and per-patch work. */
const ALBEDO = { wall: '#cfdad2', floor: '#5f4b3c', roof: '#efede8', trim: '#f1efe9' };

const ROOM_KEYS = ['room.apex', 'room.oldRoof', 'room.furniture', 'room.loft'];

export async function loadRoom({ renderer, values }) {
  const shed = await loadShed(glbUrl, renderer);
  let vals = values;
  const flag = (k, d) => (vals[k] === undefined ? d : !!vals[k]);
  const state = {
    apex: vals['room.apex'] ?? SHED.apex.default,
    oldRoof: flag('room.oldRoof', false),
    furniture: flag('room.furniture', true),
    loft: flag('room.loft', true),
    cutaway: flag('room.cutaway', true),
  };

  // ── scene graph ──────────────────────────────────────────────────────────
  const root = new THREE.Group();
  root.name = 'pjl-room';
  root.add(shed.scene);

  const wallGroup = new THREE.Group();
  wallGroup.name = 'pjl-walls';
  shed.walls.forEach((m, k) => {
    m.name = `pjl-wall-${FLATS[k]}`;
    m.userData.pjl = { part: 'wall', patchId: `wall-${FLATS[k]}`, albedo: ALBEDO.wall };
    wallGroup.add(m);
  });
  if (shed.glass) {
    shed.glass.userData.pjl = { part: 'glass', patchId: null, albedo: null };
    wallGroup.add(shed.glass);
  }
  root.add(wallGroup);

  const oldGroup = new THREE.Group();
  oldGroup.name = 'pjl-old-roof';
  shed.oldRoof.forEach((m, k) => {
    if (!m) return;
    m.userData.pjl = { part: 'oldRoof', patchId: `roof-${FLATS[k]}`, albedo: ALBEDO.roof };
    oldGroup.add(m);
  });
  root.add(oldGroup);

  const roof = createRoof({ apex: state.apex });
  roof.facets.forEach((f) => {
    f.under.userData.pjl = { part: 'roof', patchId: `roof-${FLATS[f.k]}`, albedo: ALBEDO.roof };
    f.top.userData.pjl = { part: 'roofTop', patchId: null, albedo: null };
  });
  roof.battens.forEach((b) => (b.mesh.userData.pjl = { part: 'roofTrim', patchId: null, albedo: ALBEDO.trim }));
  roof.boss.userData.pjl = { part: 'roofTrim', patchId: null, albedo: ALBEDO.trim };
  root.add(roof.group);

  for (const m of shed.floor) m.userData.pjl = { part: 'floor', patchId: 'floor', albedo: ALBEDO.floor };
  for (const m of shed.loft) m.userData.pjl = { part: 'loft', patchId: 'loft', albedo: null };
  for (const f of shed.furniture) for (const m of f.meshes) m.userData.pjl = { part: 'furniture', patchId: null, albedo: null, object: f.name };

  const aids = createAids();
  root.add(aids.group);

  // ── fades ────────────────────────────────────────────────────────────────
  const groups = {
    walls: shed.walls.map((m, k) => fadeGroup(k === (shed.glass?.userData.flat ?? 1) && shed.glass ? [m, shed.glass] : [m])),
    roof: roof.facets.map((f) => fadeGroup([f.under, f.top])),
    hips: roof.battens.map((b) => fadeGroup([b.mesh])),
    boss: fadeGroup([roof.boss]),
    oldRoof: shed.oldRoof.map((m) => (m ? fadeGroup([m]) : null)),
  };
  const fades = createFades(groups);

  // ── landing heightfield (built once, honours the furniture/loft toggles) ─
  const prims = [
    ...shed.floor.map((m) => ({ kind: 'floor', name: 'floor', ...worldSoup(m) })),
    ...shed.loft.map((m) => ({ kind: 'loft', name: 'loft', ...worldSoup(m) })),
    ...shed.furniture.flatMap((f) => f.meshes.map((m) => ({ kind: 'furniture', name: f.name, ...worldSoup(m) }))),
  ];
  const hf = buildHeightfield(prims);
  prims.length = 0;

  // ── patches ──────────────────────────────────────────────────────────────
  const build = () => buildPatches({ apex: effectiveApex({ 'room.apex': state.apex, 'room.oldRoof': state.oldRoof }), loft: state.loft, furniture: state.furniture });
  let patches = build();
  const typeOf = (p) => {
    const o = vals[`region.${p.id}.type`];
    return o && o !== 'auto' ? o : p.typeAuto;
  };

  function applyVisibility() {
    for (const f of shed.furniture) f.node.visible = state.furniture;
    if (shed.loftNode) shed.loftNode.visible = state.loft;
    roof.group.visible = !state.oldRoof;
    oldGroup.visible = state.oldRoof;
  }
  function applyAids() {
    aids.setVisible({ gravity: vals['aid.gravity'], seams: vals['aid.seams'], labels: vals['aid.labels'] });
  }
  applyVisibility();
  aids.setPatches(patches, typeOf);
  applyAids();

  const surfaceMeshes = [
    ...shed.walls.filter(Boolean),
    ...shed.floor,
    ...shed.loft,
    ...shed.furniture.flatMap((f) => f.meshes),
    ...roof.surfaces(),
    ...shed.oldRoof.filter(Boolean),
  ];
  const occluders = surfaceMeshes.slice();
  const blockers = [...shed.furniture.map((f) => f.node), ...(shed.loftNode ? [shed.loftNode] : []), wallGroup, ...roof.surfaces(), oldGroup];
  const shown = (p) => fades.patchValue(p) > 0.5 && (p.kind !== 'loft' || state.loft);
  const roofApex = () => effectiveApex({ 'room.apex': state.apex, 'room.oldRoof': state.oldRoof });
  // The cutaway's height follows the roof pitch (a low roof's underside is
  // only visible from lower down) and, like the plan, backs off on a portrait
  // canvas (aspect seen in update()). The Stage reads views at setView time.
  let aspect = 1;
  {
    const sz = renderer?.getSize?.(new THREE.Vector2());
    if (sz && sz.x > 0 && sz.y > 0) aspect = sz.x / sz.y; // the Stage sizes the canvas before loading the room
  }
  const views = {
    get cutaway() {
      return cutawayView(roofApex(), aspect);
    },
    door: VIEWS.door,
    armchair: VIEWS.armchair,
    loft: VIEWS.loft,
    get plan() {
      return planView(aspect);
    },
  };

  return {
    root,
    get patches() {
      return patches;
    },
    landing(x, z, fromY) {
      return hf.landing(x, z, fromY, { furniture: state.furniture, loft: state.loft });
    },
    views,
    surfaceMeshes,
    occluders,
    /** Additions (NOTES.md): fully faded cutaway meshes sit on this layer, not .visible = false. */
    fadedLayer: FADED_LAYER,
    measured: MEASURED,
    /** The apex the roof patches use right now (room.apex, or the old roof's 2.738). */
    get roofApex() {
      return roofApex();
    },

    setParams(v, changed = []) {
      vals = v;
      const has = (k) => changed.includes(k);
      let patchesChanged = false;
      if (has('room.apex')) {
        state.apex = v['room.apex'];
        roof.setApex(state.apex); // in place: same geometries, same materials
      }
      if (has('room.oldRoof')) state.oldRoof = !!v['room.oldRoof'];
      if (has('room.furniture')) state.furniture = !!v['room.furniture'];
      if (has('room.loft')) state.loft = !!v['room.loft'];
      if (has('room.cutaway')) state.cutaway = !!v['room.cutaway'];
      if (ROOM_KEYS.some(has)) {
        applyVisibility();
        const apexOnly = changed.every((k) => k === 'room.apex' || !ROOM_KEYS.includes(k));
        if (!(apexOnly && state.oldRoof)) {
          // (the apex slider moving while the old roof shows changes nothing in the patches)
          patches = build();
          patchesChanged = true;
          aids.setPatches(patches, typeOf);
        }
      }
      if (changed.some((k) => k.startsWith('aid.'))) applyAids();
      if (changed.some((k) => /^region\..+\.type$/.test(k))) aids.relabel(typeOf);
      return { patchesChanged };
    },

    update(camera, dtMs) {
      if (camera.aspect) aspect = camera.aspect;
      fades.update(camera, dtMs, { cutaway: state.cutaway, apex: state.apex, oldRoof: state.oldRoof });
      aids.follow((p) => (p.kind === 'loft' && !state.loft ? 0 : fades.patchValue(p)), camera);
    },

    pick(raycaster) {
      return pickPatch(raycaster, {
        patches,
        shown,
        blockers,
        maskOn: {
          door: vals['map.mask.door'] !== false,
          window: vals['map.mask.window'] !== false,
          loft: vals['map.mask.loft'] !== false,
          furniture: vals['map.mask.furniture'] !== false,
        },
      });
    },

    dispose() {
      roof.dispose();
      aids.dispose();
      const textures = new Set();
      root.traverse((o) => {
        if (o.geometry) o.geometry.dispose();
        const list = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
        for (const m of list) {
          for (const val of Object.values(m)) if (val && val.isTexture) textures.add(val);
          m.dispose();
        }
      });
      for (const t of textures) t.dispose();
      root.removeFromParent();
      patches = [];
    },
  };
}
