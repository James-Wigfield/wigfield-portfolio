/* ============================================================================
   "Recall": a room remembers itself. The spot's small map model (model/map,
   0.3–1 MB, CONTRACTS.md §4) loads first; its surfaces are sampled into a
   cloud of points coloured from the baked atlas, scattered, which drift in and
   condense onto the walls, floor and furniture. When the full room.glb has
   arrived the solid room fades up under them and the points dissolve.

   Plain three.js (MeshSurfaceSampler + one ShaderMaterial; the condense runs on
   the GPU from a single uniform). The viewer owns the lifecycle:

     const cloud = buildRecall(mapRoot, { count, hidden, centre, radius });
     scene.add(cloud.points);  cloud.update(elapsedMs, opacity);  cloud.dispose();
   ========================================================================== */

import * as THREE from 'three';
import { MeshSurfaceSampler } from 'three/addons/math/MeshSurfaceSampler.js';

export const CONDENSE_MS = 2200; // scattered -> on the surfaces
export const MIN_RECALL_MS = 1750; // the solid room never arrives before this, so the condensed cloud reads
export const DISSOLVE_MS = 900; // points fade out while the room fades up
export const ROOM_FADE_MS = 700;

const MAX_DELAY = 0.42; // share of CONDENSE_MS a point may wait before it moves

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);

/** Pixel reader for a texture's image (an ImageBitmap or <img> from GLTFLoader). */
function texturePixels(tex, cache) {
  const img = tex?.image;
  if (!img || !img.width || !img.height) return null;
  if (cache.has(img)) return cache.get(img);
  let out = null;
  try {
    const w = Math.min(img.width, 512);
    const h = Math.min(img.height, 512);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    out = { w, h, data: g.getImageData(0, 0, w, h).data };
  } catch {
    out = null; // a tainted or unreadable image: fall back to the material colour
  }
  cache.set(img, out);
  return out;
}

function triangleArea(geo, matrix) {
  const pos = geo.attributes.position;
  const idx = geo.index;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const c = new THREE.Vector3();
  let total = 0;
  const tri = idx ? idx.count / 3 : pos.count / 3;
  for (let i = 0; i < tri; i++) {
    const i0 = idx ? idx.getX(i * 3) : i * 3;
    const i1 = idx ? idx.getX(i * 3 + 1) : i * 3 + 1;
    const i2 = idx ? idx.getX(i * 3 + 2) : i * 3 + 2;
    a.fromBufferAttribute(pos, i0).applyMatrix4(matrix);
    b.fromBufferAttribute(pos, i1).applyMatrix4(matrix);
    c.fromBufferAttribute(pos, i2).applyMatrix4(matrix);
    total += b.sub(a).cross(c.sub(a)).length() / 2;
  }
  return total;
}

/**
 * Sample the visible surfaces of `root` (world space) into coloured points.
 *   count   points in all (spread by surface area)
 *   hidden  (mesh) => true for meshes the opening view hides (near walls, ceiling)
 *   centre  THREE.Vector3 the cloud gathers round; radius = the room's half diagonal
 */
export function buildRecall(root, { count = 36000, hidden = () => false, centre, radius = 3, seed = 1, eye = null } = {}) {
  root.updateMatrixWorld(true);
  const meshes = [];
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || hidden(o)) return;
    const mat = Array.isArray(o.material) ? o.material[0] : o.material;
    if (/^glass/i.test(mat?.name || '')) return; // glass would sprinkle points across the windows
    const area = triangleArea(o.geometry, o.matrixWorld);
    if (area > 1e-4) meshes.push({ mesh: o, mat, area });
  });
  const total = meshes.reduce((s, m) => s + m.area, 0) || 1;

  let s = seed >>> 0 || 1;
  const rand = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };

  const positions = new Float32Array(count * 3);
  const starts = new Float32Array(count * 3);
  const colors = new Float32Array(count * 3);
  const delays = new Float32Array(count);
  const cache = new Map();
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  const nm = new THREE.Matrix3();
  const toEye = new THREE.Vector3();
  const uv = new THREE.Vector2();
  const tmpColor = new THREE.Color();
  const c = centre || new THREE.Vector3();
  let k = 0;
  meshes.forEach((m, mi) => {
    const want = mi === meshes.length - 1 ? count - k : Math.round((count * m.area) / total);
    if (want <= 0 || k >= count) return;
    const geo = m.mesh.geometry;
    const sampler = new MeshSurfaceSampler(m.mesh).setRandomGenerator(rand).build();
    const hasUv = Boolean(geo.attributes.uv);
    const px = hasUv ? texturePixels(m.mat?.map, cache) : null;
    const base = m.mat?.color ? tmpColor.copy(m.mat.color) : tmpColor.setRGB(0.6, 0.6, 0.6);
    const baseR = base.r;
    const baseG = base.g;
    const baseB = base.b;
    nm.getNormalMatrix(m.mesh.matrixWorld);
    // surfaces facing away from the opening view (a far wall's dark outer face) are skipped, with a
    // bounded number of retries so a mesh seen only edge-on still gets its share
    for (let j = 0, tries = 0; j < want && k < count && tries < want * 4; tries++) {
      sampler.sample(p, n, undefined, hasUv ? uv : undefined);
      p.applyMatrix4(m.mesh.matrixWorld);
      if (eye) {
        n.applyMatrix3(nm);
        if (n.dot(toEye.copy(eye).sub(p)) < 0) continue;
      }
      j++;
      positions.set([p.x, p.y, p.z], k * 3);
      let r = baseR;
      let g = baseG;
      let b = baseB;
      if (px) {
        const u = ((uv.x % 1) + 1) % 1;
        const v = ((uv.y % 1) + 1) % 1;
        const i = (Math.min(px.h - 1, Math.floor(v * px.h)) * px.w + Math.min(px.w - 1, Math.floor(u * px.w))) * 4;
        r = toLinear(px.data[i] / 255);
        g = toLinear(px.data[i + 1] / 255);
        b = toLinear(px.data[i + 2] / 255);
      }
      colors.set([r, g, b], k * 3);
      // scattered start: out from where the point lands, lifted, as if blown off the surface
      const dir = new THREE.Vector3(p.x - c.x, (p.y - c.y) * 0.6, p.z - c.z);
      if (dir.lengthSq() < 1e-6) dir.set(rand() - 0.5, 0.5, rand() - 0.5);
      dir.normalize();
      const spread = radius * (0.12 + rand() * 0.5);
      starts.set(
        [p.x + dir.x * spread + (rand() - 0.5) * radius * 0.28, p.y + Math.abs(dir.y) * spread * 0.4 + rand() * radius * 0.25, p.z + dir.z * spread + (rand() - 0.5) * radius * 0.28],
        k * 3,
      );
      delays[k] = rand() * MAX_DELAY;
      k++;
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, k * 3), 3));
  geometry.setAttribute('aStart', new THREE.BufferAttribute(starts.subarray(0, k * 3), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(colors.subarray(0, k * 3), 3));
  geometry.setAttribute('aDelay', new THREE.BufferAttribute(delays.subarray(0, k), 1));
  geometry.boundingSphere = new THREE.Sphere(c.clone(), radius * 3);

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    vertexColors: true,
    uniforms: {
      uT: { value: 0 },
      uTime: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: 2.5 },
      uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
      uDrift: { value: radius * 0.012 },
    },
    vertexShader: /* glsl */ `
      uniform float uT;
      uniform float uTime;
      uniform float uSize;
      uniform float uPixelRatio;
      uniform float uDrift;
      uniform float uOpacity;
      attribute vec3 aStart;
      attribute float aDelay;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float k = clamp((uT - aDelay) / (1.0 - ${MAX_DELAY.toFixed(2)}), 0.0, 1.0);
        k = 1.0 - pow(1.0 - k, 3.0);
        vec3 p = mix(aStart, position, k);
        float d = (1.0 - k) * 6.0 + 0.35;
        p += uDrift * d * vec3(sin(uTime * 1.3 + aDelay * 41.0), cos(uTime * 1.1 + aDelay * 29.0), sin(uTime * 0.9 + aDelay * 17.0));
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = uSize * uPixelRatio * mix(1.7, 1.0, k);
        vColor = color;
        vAlpha = (0.3 + 0.7 * k) * uOpacity;
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float r = dot(q, q);
        if (r > 0.25) discard;
        gl_FragColor = vec4(vColor, vAlpha * (1.0 - smoothstep(0.16, 0.25, r)));
        #include <colorspace_fragment>
      }
    `,
  });
  const points = new THREE.Points(geometry, material);
  points.name = 'viewer__recall';
  points.frustumCulled = false;
  points.raycast = () => {};
  points.renderOrder = 2;

  return {
    points,
    count: k,
    /** elapsed ms since the recall began; opacity 0..1 for the whole cloud. */
    update(elapsed, opacity) {
      material.uniforms.uT.value = Math.min(1, elapsed / CONDENSE_MS);
      material.uniforms.uTime.value = elapsed / 1000;
      material.uniforms.uOpacity.value = opacity;
    },
    dispose() {
      points.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}

/**
 * Every material of a room, with how the dollhouse fades it (so a fade-up can
 * multiply on top without fighting the wall fades).
 */
export function roomMaterials(room) {
  const fadeOf = new Map();
  for (const [key, f] of Object.entries(room.fades || {})) for (const m of f.mats) fadeOf.set(m, key);
  const seen = new Map();
  room.root.traverse((o) => {
    for (const m of Array.isArray(o.material) ? o.material : o.material ? [o.material] : []) {
      if (seen.has(m)) continue;
      const key = fadeOf.get(m) || null;
      seen.set(m, {
        mat: m,
        key,
        base: key ? m.userData.baseOpacity : m.opacity,
        baseTransparent: key ? m.userData.baseTransparent : m.transparent,
      });
    }
  });
  return [...seen.values()];
}

/** Multiply a room's opacity by k (0..1) on top of its dollhouse fades; k = 1 restores it exactly. */
export function setRoomAlpha(room, mats, k) {
  for (const e of mats) {
    const f = e.key ? room.fades[e.key].value : 1;
    e.mat.opacity = e.base * f * k;
    e.mat.transparent = k < 1 || e.baseTransparent || f < 1;
  }
}
