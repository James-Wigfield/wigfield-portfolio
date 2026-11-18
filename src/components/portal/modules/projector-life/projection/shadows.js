/* ============================================================================
   PROJECTOR LIFE — projection shadows (one packed depth map per projector)
   ----------------------------------------------------------------------------
   The room's occluders are mirrored as PROXY meshes that share the room's
   geometry (no copies on the GPU) in a private scene. A depth pass renders
   linear depth along the projector axis (÷ FAR), packed into RGB8, so

     * the light shader compares a fragment's axial depth against it, and
     * coverage() can read the same texels back on the CPU,

   with one render target and one convention. Re-rendered only when a
   projector, the roof, the furniture/loft/old-roof visibility changes —
   never per frame.

   Which occluders count: the shell (walls, floor) ALWAYS — the cutaway that
   fades near walls is a viewing aid, not a physical change. Everything else
   (furniture, loft, roofs) counts when it is actually visible, unless a node
   on its path is hidden by the cutaway (`userData.cutaway`).
   ========================================================================== */

import * as THREE from 'three';
import { DEPTH_W, FAR } from './projector.js';

const DEPTH_VERT = /* glsl */ `
varying float vPjlZ;
void main() {
  vec4 mv = modelViewMatrix * vec4( position, 1.0 );
  vPjlZ = -mv.z;
  gl_Position = projectionMatrix * mv;
}
`;

const DEPTH_FRAG = /* glsl */ `
uniform float pjlFar;
varying float vPjlZ;
void main() {
  float v = clamp( vPjlZ / pjlFar, 0.0, 0.9999 );
  vec3 e = fract( v * vec3( 1.0, 255.0, 65025.0 ) );
  e -= e.yzz * vec3( 1.0 / 255.0, 1.0 / 255.0, 0.0 );
  gl_FragColor = vec4( e, 1.0 );
}
`;

/**
 * Classify a room mesh: the room runtime's tag (userData.pjl.part) when it
 * has one, else the named GLB node it hangs from.
 */
export function classify(obj) {
  const part = obj?.userData?.pjl?.part;
  if (part) {
    if (part === 'furniture' || part === 'loft') return part;
    if (part === 'wall' || part === 'floor') return part;
    if (part === 'oldRoof') return 'oldroof';
    return 'other';
  }
  for (let o = obj; o; o = o.parent) {
    const n = o.name || '';
    if (n.startsWith('obj__loft')) return 'loft';
    if (n.startsWith('obj__')) return 'furniture';
    if (n.startsWith('wall_')) return 'wall';
    if (n === 'floor') return 'floor';
    if (n === 'ceiling') return 'oldroof';
  }
  return 'other';
}

/** Physically present? (ignores the cutaway's viewing-aid fades). */
export function physicallyVisible(obj, cls = classify(obj)) {
  if (cls === 'wall' || cls === 'floor') return true;
  for (let o = obj; o; o = o.parent) {
    if (!o.visible && !o.userData?.cutaway) return false;
  }
  return true;
}

/** Unpack one texel written by DEPTH_FRAG (bytes) → depth in metres. */
export function unpackDepth(r, g, b) {
  return (r / 255 + g / 65025 + b / 16581375) * FAR;
}

export function createShadows(renderer) {
  const scene = new THREE.Scene();
  scene.matrixWorldAutoUpdate = false;
  const material = new THREE.ShaderMaterial({
    uniforms: { pjlFar: { value: FAR } },
    vertexShader: DEPTH_VERT,
    fragmentShader: DEPTH_FRAG,
    side: THREE.DoubleSide,
  });
  scene.overrideMaterial = material;

  let proxies = []; // { src, mesh, cls }
  const targets = [null, null, null];
  const reads = [null, null, null]; // cached CPU readbacks { buf, w, h }
  const clear = new THREE.Color();

  function setOccluders(list) {
    for (const p of proxies) scene.remove(p.mesh);
    proxies = [];
    for (const src of list) {
      if (!src?.isMesh) continue;
      const mesh = new THREE.Mesh(src.geometry, material);
      mesh.matrixAutoUpdate = false;
      mesh.frustumCulled = false;
      scene.add(mesh);
      proxies.push({ src, mesh, cls: classify(src) });
    }
  }

  function sync() {
    for (const p of proxies) {
      p.src.updateWorldMatrix(true, false);
      p.mesh.geometry = p.src.geometry; // the room may rebuild the roof geometry
      p.mesh.matrixWorld.copy(p.src.matrixWorld);
      p.mesh.visible = physicallyVisible(p.src, p.cls);
    }
  }

  function target(i, aspect) {
    const h = Math.max(1, Math.round(DEPTH_W / aspect));
    let rt = targets[i];
    if (!rt || rt.height !== h) {
      rt?.dispose();
      rt = new THREE.WebGLRenderTarget(DEPTH_W, h, {
        minFilter: THREE.NearestFilter,
        magFilter: THREE.NearestFilter,
        generateMipmaps: false,
        depthBuffer: true,
      });
      rt.texture.name = `pjl-depth-${i}`;
      targets[i] = rt;
    }
    return rt;
  }

  /** Render projector i's depth map from `camera` (a PerspectiveCamera at the lens). */
  function render(i, camera, aspect, { synced = false } = {}) {
    if (!synced) sync();
    const rt = target(i, aspect);
    const prevTarget = renderer.getRenderTarget();
    renderer.getClearColor(clear);
    const prevAlpha = renderer.getClearAlpha();
    renderer.setRenderTarget(rt);
    renderer.setClearColor(0xffffff, 1);
    renderer.clear(true, true, false);
    renderer.render(scene, camera);
    renderer.setRenderTarget(prevTarget);
    renderer.setClearColor(clear, prevAlpha);
    reads[i] = null;
    return rt;
  }

  /** CPU copy of projector i's depth map (cached until the next render). */
  function readback(i) {
    const rt = targets[i];
    if (!rt) return null;
    if (!reads[i]) {
      const buf = new Uint8Array(rt.width * rt.height * 4);
      renderer.readRenderTargetPixels(rt, 0, 0, rt.width, rt.height, buf);
      reads[i] = { buf, w: rt.width, h: rt.height };
    }
    return reads[i];
  }

  function dispose() {
    for (const p of proxies) scene.remove(p.mesh);
    proxies = [];
    for (let i = 0; i < targets.length; i++) {
      targets[i]?.dispose();
      targets[i] = null;
      reads[i] = null;
    }
    material.dispose();
  }

  return { setOccluders, sync, render, readback, target: (i) => targets[i], dispose };
}
