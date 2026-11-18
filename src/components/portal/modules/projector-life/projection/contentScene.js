/* ============================================================================
   PROJECTOR LIFE — content scene: what each projector must OUTPUT
   ----------------------------------------------------------------------------
   MAPPED: every patch is a flat polygon in world space carrying its life
   buffer (DataTexture, CONTRACTS §2 convention: geometry uv = local metres,
   texture.repeat = ppm / buffer size). Rendering this from a projector's
   camera IS the pre-warp the mapping software computes: project that image
   back from the same lens and each patch gets its content undistorted.
     * region.<id>.on = false → the patch draws black
     * map.mask.door|window|loft|furniture → the patch's mask polygons draw
       black on top, and furniture / loft geometry (proxies sharing the
       room's geometry) draws black and depth-tested, so mapped content
       doesn't spill onto them.
   RAW: life.frame() stretched over the whole frame (one flat rectangle) —
   the "before" picture that shows why mapping matters.
   ========================================================================== */

import * as THREE from 'three';
import { toWorld } from '../room/roomModel.js';
import { classify, physicallyVisible } from './shadows.js';
import { makeTestFrame, makeTestSurface } from './testCard.js';

export const OUT_W = 1024;
const MASK_LIFT = 0.002; // m toward the room, on top of the patch

function getSurface(surfaces, id) {
  if (!surfaces) return null;
  if (typeof surfaces.get === 'function') return surfaces.get(id) || null;
  return surfaces[id] || null;
}

function polygonGeometry(patch, poly, lift = 0) {
  const contour = poly.map(([x, y]) => new THREE.Vector2(x, y));
  const tris = THREE.ShapeUtils.triangulateShape(contour, []);
  const pos = new Float32Array(poly.length * 3);
  const uv = new Float32Array(poly.length * 2);
  const n = patch.normal;
  poly.forEach(([x, y], k) => {
    const w = toWorld(patch, x, y);
    pos[k * 3] = w[0] + n[0] * lift;
    pos[k * 3 + 1] = w[1] + n[1] * lift;
    pos[k * 3 + 2] = w[2] + n[2] * lift;
    uv[k * 2] = x;
    uv[k * 2 + 1] = y;
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(tris.flat());
  return g;
}

function dataTexture(s) {
  const t = new THREE.DataTexture(s.data, s.w, s.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  t.colorSpace = THREE.SRGBColorSpace;
  t.flipY = false;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearFilter;
  t.generateMipmaps = false;
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  t.needsUpdate = true;
  t.userData.version = s.version;
  return t;
}

/** Keep `tex` in step with buffer `s`; returns [texture, changed]. */
function syncTexture(tex, s) {
  if (!s || !s.data) {
    if (tex) tex.dispose();
    return [null, !!tex];
  }
  if (!tex || tex.image.data !== s.data || tex.image.width !== s.w || tex.image.height !== s.h) {
    tex?.dispose();
    return [dataTexture(s), true];
  }
  if (tex.userData.version !== s.version) {
    tex.userData.version = s.version;
    tex.needsUpdate = true;
    return [tex, true];
  }
  return [tex, false];
}

export function createContent(renderer) {
  const scene = new THREE.Scene();
  const black = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
  const maskMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -8,
  });

  const patchMeshes = new Map(); // id → { mesh, patch, tex }
  const maskMeshes = []; // { mesh, kind }
  let proxies = []; // { src, mesh, cls }
  let patches = [];

  // raw mode: one quad over the whole frame
  const rawScene = new THREE.Scene();
  const rawCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const rawMat = new THREE.MeshBasicMaterial({ color: 0xffffff, map: null, depthTest: false, depthWrite: false });
  const rawQuad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rawMat);
  rawScene.add(rawQuad);
  let rawTex = null;

  // test card
  let testCard = false;
  let testSurfaces = null;
  let testFrame = null;

  function clearPatches() {
    for (const rec of patchMeshes.values()) {
      scene.remove(rec.mesh);
      rec.mesh.geometry.dispose();
      rec.mesh.material.dispose();
      rec.tex?.dispose();
    }
    patchMeshes.clear();
    for (const m of maskMeshes) {
      scene.remove(m.mesh);
      m.mesh.geometry.dispose();
    }
    maskMeshes.length = 0;
  }

  function setPatches(list) {
    clearPatches();
    patches = list || [];
    testSurfaces = null;
    for (const p of patches) {
      const mat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        map: null,
        side: THREE.DoubleSide,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -4,
      });
      const mesh = new THREE.Mesh(polygonGeometry(p, p.polygon), mat);
      mesh.name = `pjl-content-${p.id}`;
      mesh.frustumCulled = false;
      scene.add(mesh);
      patchMeshes.set(p.id, { mesh, patch: p, tex: null, on: true });
      for (const m of p.masks || []) {
        if (!m.polygon || m.polygon.length < 3) continue;
        const mm = new THREE.Mesh(polygonGeometry(p, m.polygon, MASK_LIFT), maskMat);
        mm.frustumCulled = false;
        mm.renderOrder = 1;
        scene.add(mm);
        maskMeshes.push({ mesh: mm, kind: m.kind });
      }
    }
  }

  function setOccluders(list) {
    for (const p of proxies) scene.remove(p.mesh);
    proxies = [];
    for (const src of list) {
      if (!src?.isMesh) continue;
      const cls = classify(src);
      if (cls !== 'furniture' && cls !== 'loft') continue;
      const mesh = new THREE.Mesh(src.geometry, black);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      proxies.push({ src, mesh, cls });
    }
  }

  /** Region on/off, masks, furniture/loft visibility. */
  function applyParams(values) {
    for (const [id, rec] of patchMeshes) {
      rec.on = values[`region.${id}.on`] !== false;
      rec.mesh.material.color.setScalar(rec.on && rec.tex ? 1 : 0);
    }
    for (const m of maskMeshes) m.mesh.visible = !!values[`map.mask.${m.kind}`];
    for (const p of proxies) {
      p.src.updateWorldMatrix(true, false);
      p.mesh.geometry = p.src.geometry;
      p.mesh.matrix.copy(p.src.matrixWorld);
      p.mesh.matrixWorldNeedsUpdate = true;
      p.mesh.visible = !!values[`map.mask.${p.cls}`] && physicallyVisible(p.src, p.cls);
    }
  }

  function setTestCard(on) {
    testCard = !!on;
  }

  /** The patch buffers in use (test card or the life host's). */
  function surfaces(life) {
    if (testCard) {
      if (!testSurfaces) {
        testSurfaces = new Map();
        for (const p of patches) testSurfaces.set(p.id, makeTestSurface(p));
      }
      return testSurfaces;
    }
    return life?.surfaces?.() || null;
  }

  /** Pull the life buffers into textures. Returns true if anything changed. */
  function syncLife(life, values) {
    let changed = false;
    if (values['map.mode'] === 'raw') {
      let f = null;
      if (testCard) f = testFrame || (testFrame = makeTestFrame());
      else f = life?.frame?.() || null;
      if (!f) f = testFrame || (testFrame = makeTestFrame()); // no frame from the host yet
      const [t, c] = syncTexture(rawTex, f);
      rawTex = t;
      if (rawMat.map !== t) {
        rawMat.map = t;
        rawMat.needsUpdate = true;
      }
      return c;
    }
    const list = surfaces(life);
    for (const [id, rec] of patchMeshes) {
      const s = getSurface(list, id);
      const [t, c] = syncTexture(rec.tex, s);
      if (!c) continue;
      changed = true;
      rec.tex = t;
      const mat = rec.mesh.material;
      if (t) t.repeat.set(s.ppm / s.w, s.ppm / s.h);
      if (mat.map !== t) {
        const hadMap = !!mat.map;
        mat.map = t;
        if (hadMap !== !!t) mat.needsUpdate = true;
      }
      // no buffer → draw black (nothing to project there)
      mat.color.setScalar(rec.on !== false && t ? 1 : 0);
    }
    return changed;
  }

  function render(camera, rt, mode) {
    const prev = renderer.getRenderTarget();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0x000000, 1);
    renderer.clear(true, true, false);
    if (mode === 'raw') renderer.render(rawScene, rawCam);
    else renderer.render(scene, camera);
    renderer.setRenderTarget(prev);
  }

  function dispose() {
    clearPatches();
    for (const p of proxies) scene.remove(p.mesh);
    proxies = [];
    black.dispose();
    maskMat.dispose();
    rawQuad.geometry.dispose();
    rawMat.dispose();
    rawTex?.dispose();
    rawTex = null;
  }

  return {
    setPatches,
    setOccluders,
    applyParams,
    setTestCard,
    surfaces,
    syncLife,
    render,
    dispose,
    get testCard() {
      return testCard;
    },
  };
}
