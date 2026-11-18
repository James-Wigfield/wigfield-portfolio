/* ============================================================================
   PROJECTOR LIFE — projection/ entry (CONTRACTS.md §5)
   ----------------------------------------------------------------------------
   What a REAL projector would put on the She'd:

     projector.js     pose + lens maths (pure; throw ratio → FOV, ray casts)
     contentScene.js  what each projector must OUTPUT (mapped / raw)
     shadows.js       packed depth map per projector (occluder proxies)
     lightMaterial.js the onBeforeCompile patch: light landing on paint
     coverage.js      area-weighted coverage readout (CPU, on change)
     helpers.js       projector bodies, frustum rays, landed outline
     netInset.js      the unfolded-room inset
     testCard.js      debug content (setTestCard(true))

   Per frame: upload changed life buffers, re-render each active projector's
   output ONLY if its content or pose changed (one render per projector).
   Depth maps re-render only when projectors / roof / furniture / loft change.
   ========================================================================== */

import * as THREE from 'three';
import {
  activeProjectors,
  axisHit,
  DEPTH_W,
  FAR,
  MAX_PROJECTORS,
  NEAR,
  projectorFromValues,
} from './projector.js';
import { createLightUniforms, disposeLightUniforms, patchMaterial, receivesLight, unpatchMaterial, W_REF } from './lightMaterial.js';
import { createShadows, unpackDepth } from './shadows.js';
import { createContent, OUT_W } from './contentScene.js';
import { createHelpers } from './helpers.js';
import { computeCoverage } from './coverage.js';
import { createNet } from './netInset.js';

export { COVERAGE_LEGEND, PIXEL_LEGEND, GRID_PX } from './lightMaterial.js';
export { PROJECTOR_COLORS, hfovFromThrow, vfovFromThrow } from './projector.js';

const POSE_RE = /^p(\d)\.(x|y|z|yaw|pitch|roll|throw|aspect)$/;
const LEVEL_RE = /^p(\d)\.(brightness|black)$/;
const ROOM_GEOM = new Set(['room.apex', 'room.furniture', 'room.loft', 'room.oldRoof']);
const COVERAGE_MIN_MS = 200; // recompute at most 5×/s while something is being dragged

/** Room meshes, from the runtime when it provides them, else by traversal. */
function roomMeshes(room, which) {
  const given = room?.[which];
  if (Array.isArray(given) && given.length) return given;
  const out = [];
  room?.root?.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData?.pjlAid) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    if (mats.every((m) => /glass/i.test(m?.name || ''))) return;
    out.push(o);
  });
  return out;
}

export function createProjection({ renderer, scene, room, life, values }) {
  let vals = values;
  let roomRef = room || null;
  let patches = room?.patches || [];
  const uniforms = createLightUniforms();
  const shadows = createShadows(renderer);
  const content = createContent(renderer);
  const helpers = createHelpers(scene);
  const net = createNet();
  const cams = Array.from({ length: MAX_PROJECTORS }, () => new THREE.PerspectiveCamera(40, 16 / 9, NEAR, FAR));
  const outs = Array(MAX_PROJECTORS).fill(null);
  const patched = new Set();
  let projectors = [];
  let attached = false;
  let disposed = false;
  let cov = null;
  let covT = -Infinity;
  const dirty = { pose: true, depth: true, output: true, coverage: true, helpers: true };
  const counters = { depthRenders: 0, outputRenders: 0, coverageMs: 0, lastCoverageAt: 0 };

  // ── setup helpers ─────────────────────────────────────────────────────────
  function syncSurfaces() {
    // A paint-colour hint applies to a material only when every mesh using it
    // carries the same one (the floor shares the atlas twin with furniture).
    const hints = new Map();
    const meshes = roomMeshes(roomRef, 'surfaceMeshes');
    for (const mesh of meshes) {
      const h = mesh.userData?.pjl?.albedo || null;
      for (const m of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) {
        if (!hints.has(m)) hints.set(m, h);
        else if (hints.get(m) !== h) hints.set(m, null);
      }
    }
    for (const [m, h] of hints) if (receivesLight(m) && patchMaterial(m, uniforms, h)) patched.add(m);
    // patch id → the room meshes that show it (for the cutaway-aware outline)
    patchMeshes.clear();
    for (const mesh of meshes) {
      const id = mesh.userData?.pjl?.patchId;
      if (!id) continue;
      if (!patchMeshes.has(id)) patchMeshes.set(id, []);
      patchMeshes.get(id).push(mesh);
    }
  }

  const patchMeshes = new Map();
  const shownChain = (o) => {
    for (let p = o; p; p = p.parent) if (!p.visible) return false;
    return true;
  };
  /** How much of a patch the main camera sees right now (the room's cutaway fade), 0..1. */
  function fadeOf(id) {
    const list = patchMeshes.get(id);
    if (!list) return 1;
    let v = 0;
    for (const m of list) {
      if (!m.layers.isEnabled(0) || !shownChain(m)) continue;
      const mat = Array.isArray(m.material) ? m.material[0] : m.material;
      v = Math.max(v, mat.opacity / (mat.userData?.baseOpacity || 1));
    }
    return v;
  }

  let occluderList = null;
  function syncOccluders() {
    const list = roomMeshes(roomRef, 'occluders');
    if (occluderList && list.length === occluderList.length && list.every((m, i) => m === occluderList[i])) return;
    occluderList = list.slice();
    shadows.setOccluders(occluderList);
    content.setOccluders(occluderList);
  }

  function outTarget(i, aspect) {
    const h = Math.max(1, Math.round(OUT_W / aspect));
    let rt = outs[i];
    if (!rt || rt.height !== h) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(OUT_W, h, {
        colorSpace: THREE.SRGBColorSpace,
        minFilter: THREE.LinearFilter,
        magFilter: THREE.LinearFilter,
        generateMipmaps: false,
        depthBuffer: true,
      });
      rt.texture.name = `pjl-output-${i}`;
      outs[i] = rt;
    }
    return rt;
  }

  function applyMode() {
    uniforms.pjlMode.value = (vals['proj.coverage'] ? 1 : 0) | (vals['proj.pixels'] ? 2 : 0);
    uniforms.pjlOcc.value = vals['proj.occlusion'] === false ? 0 : 1;
    uniforms.pjlAmbient.value = +(vals['room.ambient'] ?? 0.14);
  }

  function updateProjectors() {
    projectors = activeProjectors(vals);
    const res = +(vals['proj.res'] || 1920);
    const vp = new THREE.Matrix4();
    for (let i = 0; i < MAX_PROJECTORS; i++) {
      const P = projectors[i];
      if (!P) {
        uniforms[`pjlOut${i}`].value = uniforms.placeholders.black;
        uniforms[`pjlDep${i}`].value = uniforms.placeholders.far;
        continue;
      }
      const cam = cams[i];
      cam.position.set(...P.pos);
      cam.up.set(...P.up);
      cam.lookAt(P.pos[0] + P.f[0], P.pos[1] + P.f[1], P.pos[2] + P.f[2]);
      cam.fov = (P.vfov * 180) / Math.PI;
      cam.aspect = P.aspect;
      cam.near = NEAR;
      cam.far = FAR;
      cam.updateProjectionMatrix();
      cam.updateMatrixWorld(true);
      vp.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse);
      uniforms.pjlVP.value[i].copy(vp);
      uniforms.pjlPos.value[i].set(...P.pos);
      uniforms.pjlFwd.value[i].set(...P.f);
      uniforms.pjlA.value[i].set(P.brightness, P.black, (W_REF * P.throw) ** 2, FAR);
      uniforms.pjlB.value[i].set(P.throw, res, DEPTH_W, P.aspect);
    }
    uniforms.pjlCount.value = projectors.length;
    dirty.pose = false;
  }

  function renderDepth() {
    shadows.sync();
    for (const P of projectors) {
      const rt = shadows.render(P.index, cams[P.index], P.aspect, { synced: true });
      uniforms[`pjlDep${P.index}`].value = rt.texture;
    }
    counters.depthRenders++;
    dirty.depth = false;
    dirty.coverage = true;
  }

  function renderOutputs() {
    const mode = vals['map.mode'] === 'raw' ? 'raw' : 'mapped';
    for (const P of projectors) {
      const rt = outTarget(P.index, P.aspect);
      content.render(cams[P.index], rt, mode);
      uniforms[`pjlOut${P.index}`].value = rt.texture;
    }
    counters.outputRenders++;
    dirty.output = false;
  }

  function rebuildHelpers() {
    helpers.rebuild(projectors, patches, !!vals['proj.frustum']);
    dirty.helpers = false;
  }

  function markAll() {
    dirty.pose = dirty.depth = dirty.output = dirty.coverage = dirty.helpers = true;
  }

  // ── public API ────────────────────────────────────────────────────────────
  const api = {
    attach(r) {
      if (disposed) return;
      roomRef = r || roomRef;
      patches = roomRef?.patches || patches;
      syncSurfaces();
      syncOccluders();
      content.setPatches(patches);
      content.applyParams(vals);
      applyMode();
      markAll();
      attached = true;
    },

    setPatches(list) {
      if (disposed) return;
      patches = list || [];
      syncSurfaces(); // the roof may have a new material
      syncOccluders();
      content.setPatches(patches);
      content.applyParams(vals);
      markAll();
    },

    setParams(v, changed = []) {
      if (disposed) return;
      vals = v;
      let content2 = false;
      for (const k of changed) {
        if (k === 'proj.count' || POSE_RE.test(k)) {
          markAll();
        } else if (LEVEL_RE.test(k)) {
          dirty.pose = true; // brightness / black level: uniforms only
        } else if (k === 'proj.frustum') {
          helpers.setFrustumVisible(!!vals['proj.frustum']);
        } else if (k === 'proj.coverage' || k === 'proj.pixels' || k === 'room.ambient') {
          applyMode();
        } else if (k === 'proj.occlusion') {
          applyMode();
          dirty.coverage = true;
        } else if (k === 'proj.res') {
          dirty.pose = true;
          dirty.coverage = true;
        } else if (k === 'map.mode') {
          dirty.output = true;
        } else if (k.startsWith('map.mask.')) {
          content2 = true;
          dirty.output = dirty.coverage = true;
        } else if (/^region\.[^.]+\.on$/.test(k)) {
          content2 = true;
          dirty.output = true;
        } else if (/^region\.[^.]+\.type$/.test(k)) {
          dirty.coverage = true;
        } else if (ROOM_GEOM.has(k)) {
          syncSurfaces();
          syncOccluders();
          content2 = true;
          dirty.depth = dirty.output = dirty.coverage = true;
          if (k === 'room.apex') dirty.helpers = true;
        }
      }
      if (content2) content.applyParams(vals);
    },

    update() {
      if (disposed || !attached) return;
      if (dirty.pose) updateProjectors();
      if (dirty.depth) renderDepth();
      if (dirty.helpers) rebuildHelpers();
      const changed = content.syncLife(life, vals);
      if (changed || dirty.output) renderOutputs();
    },

    beforeRender(camera) {
      if (disposed) return;
      helpers.beforeRender(camera, patchMeshes.size ? fadeOf : null);
    },

    outputs() {
      if (disposed) return [];
      return projectors.filter((P) => outs[P.index]).map((P) => ({ index: P.index, texture: outs[P.index].texture, aspect: P.aspect }));
    },

    projectorView(i = 0) {
      const P = projectorFromValues(vals, i);
      const d = axisHit(patches, P);
      return {
        position: P.pos.slice(),
        target: [P.pos[0] + P.f[0] * d, P.pos[1] + P.f[1] * d, P.pos[2] + P.f[2] * d],
        fov: (P.vfov * 180) / Math.PI,
        up: P.up.slice(),
        aspect: P.aspect,
      };
    },

    coverage({ force = false } = {}) {
      if (disposed || !attached || !patches.length) return cov;
      if (!dirty.coverage && cov) return cov;
      const now = performance.now();
      if (!force && cov && now - covT < COVERAGE_MIN_MS) return cov;
      if (dirty.pose) updateProjectors();
      if (dirty.depth) renderDepth();
      const occl = vals['proj.occlusion'] !== false;
      const reads = occl ? projectors.map((P) => shadows.readback(P.index)) : [];
      const depthAt = (i, sx, sy) => {
        const r = reads[i];
        if (!r) return null;
        const px = Math.min(r.w - 1, Math.max(0, Math.floor((sx * 0.5 + 0.5) * r.w)));
        const py = Math.min(r.h - 1, Math.max(0, Math.floor((sy * 0.5 + 0.5) * r.h)));
        const k = (py * r.w + px) * 4;
        return unpackDepth(r.buf[k], r.buf[k + 1], r.buf[k + 2]);
      };
      cov = computeCoverage({ patches, values: vals, projectors, depthAt: occl ? depthAt : null, resW: +(vals['proj.res'] || 1920) });
      cov.computeMs = cov.ms;
      cov.ms = Math.round((performance.now() - now) * 10) / 10; // incl. depth render + readback
      covT = now;
      counters.coverageMs = cov.ms;
      counters.lastCoverageAt = now;
      dirty.coverage = false;
      return cov;
    },

    drawNet(canvas) {
      if (disposed) return;
      net.draw(canvas, { patches, surfaces: content.surfaces(life, vals), values: vals });
    },

    /** Debug content: 25 cm checkers per patch (mapped) / a flat card (raw). */
    setTestCard(on) {
      content.setTestCard(on);
      dirty.output = true;
    },

    /** Internal counters for perf checks (not part of the contract). */
    debug() {
      return { ...counters, projectors: projectors.length, patched: patched.size, dirty: { ...dirty } };
    },

    dispose() {
      if (disposed) return;
      disposed = true;
      for (const m of patched) unpatchMaterial(m);
      patched.clear();
      helpers.dispose();
      content.dispose();
      shadows.dispose();
      for (let i = 0; i < outs.length; i++) {
        outs[i]?.dispose();
        outs[i] = null;
      }
      disposeLightUniforms(uniforms);
      net.dispose();
      roomRef = null;
      patches = [];
    },
  };
  return api;
}
