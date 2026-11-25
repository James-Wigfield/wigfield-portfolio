/* Dream Rooms · materials. Three.js only shows the bake (decision 2):

     toBasic(root)                every mesh → MeshBasicMaterial (map = the baked atlas, fog on)
     glowMaterial(geometry, opts) the sourceless light (door spill, the line under a shut door,
                                  the glow in a stub): additive, fogged toward black, a soft
                                  gradient worked out from the geometry itself
     waterMaterial(map, envMap)   the ONE live material: still water with a cube-map reflection
     disposeTree(root)            geometries, materials, textures */

import * as THREE from 'three';

export function toBasic(root) {
  const made = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    const conv = (m) => {
      if (!m) return m;
      if (made.has(m)) return made.get(m);
      let out;
      if (m.isMeshBasicMaterial) {
        out = m;
        out.fog = true;
      } else {
        out = new THREE.MeshBasicMaterial({
          name: m.name,
          map: m.map || m.emissiveMap || null,
          color: m.map || m.emissiveMap ? new THREE.Color(1, 1, 1) : (m.color || m.emissive || new THREE.Color(0.6, 0.6, 0.6)).clone(),
          vertexColors: !!m.vertexColors,
          side: m.side,
          transparent: !!m.transparent,
          opacity: m.opacity ?? 1,
          alphaTest: m.alphaTest || 0,
          fog: true,
        });
        m.dispose();
      }
      if (out.map) out.map.anisotropy = 4;
      made.set(m, out);
      return out;
    };
    o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
  });
}

const GLOW_VERT = /* glsl */ `
  #include <fog_pars_vertex>
  varying vec3 vLocal;
  void main() {
    vLocal = position;
    vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const GLOW_FRAG = /* glsl */ `
  uniform vec3 uColor;
  uniform float uStrength;
  uniform vec2 uX;      // the near edge (at the gap / the door) and the far edge, local x
  uniform vec2 uNear;   // z range at the near edge
  uniform vec2 uFar;    // z range at the far edge
  uniform float uPow;
  uniform float uMode;  // 0 = floor wedge (x falloff), 1 = vertical slit (y falloff)
  #include <fog_pars_fragment>
  varying vec3 vLocal;
  void main() {
    float t = clamp((vLocal.x - uX.x) / max(1e-4, uX.y - uX.x), 0.0, 1.0);
    if (uMode > 0.5) t = clamp(vLocal.y / 2.2, 0.0, 1.0);
    vec2 zr = mix(uNear, uFar, uMode > 0.5 ? 0.0 : t);
    float mid = 0.5 * (zr.x + zr.y);
    float hw = max(1e-3, 0.5 * abs(zr.y - zr.x));
    float across = 1.0 - smoothstep(0.35, 1.0, abs(vLocal.z - mid) / hw);
    float a = uStrength * pow(1.0 - t, uPow) * across;
    vec3 c = uColor * a;
    #if defined(USE_FOG) && defined(FOG_EXP2)
      float fogFactor = 1.0 - exp(-fogDensity * fogDensity * vFogDepth * vFogDepth);
      c *= 1.0 - fogFactor;
    #endif
    gl_FragColor = vec4(c, 1.0);
  }
`;

/** The extents a glow gradient needs, read off its geometry (local space). */
export function glowExtents(geometry) {
  geometry.computeBoundingBox();
  const bb = geometry.boundingBox;
  const pos = geometry.attributes.position;
  const xs = [bb.min.x, bb.max.x];
  const span = Math.max(1e-4, xs[1] - xs[0]);
  const near = [Infinity, -Infinity];
  const far = [Infinity, -Infinity];
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    if (x - xs[0] < span * 0.15) {
      near[0] = Math.min(near[0], z);
      near[1] = Math.max(near[1], z);
    }
    if (xs[1] - x < span * 0.15) {
      far[0] = Math.min(far[0], z);
      far[1] = Math.max(far[1], z);
    }
  }
  if (!Number.isFinite(near[0])) near.splice(0, 2, bb.min.z, bb.max.z);
  if (!Number.isFinite(far[0])) far.splice(0, 2, bb.min.z, bb.max.z);
  return { x: xs, near, far };
}

export function glowMaterial(geometry, { color = '#ffd29a', strength = 0.6, pow = 1.6, mode = 0 } = {}) {
  const ext = glowExtents(geometry);
  return new THREE.ShaderMaterial({
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uColor: { value: new THREE.Color(color) },
        uStrength: { value: strength },
        uX: { value: new THREE.Vector2(ext.x[0], ext.x[1]) },
        uNear: { value: new THREE.Vector2(ext.near[0], ext.near[1]) },
        uFar: { value: new THREE.Vector2(ext.far[0], ext.far[1]) },
        uPow: { value: pow },
        uMode: { value: mode },
      },
    ]),
    vertexShader: GLOW_VERT,
    fragmentShader: GLOW_FRAG,
    fog: true,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

/** Still water: the baked map, mixed with a cube-map reflection rendered once on entry. */
export function waterMaterial(map, envMap, base) {
  return new THREE.MeshBasicMaterial({
    map: map || null,
    // the bake carries the water's own colour: keep the reflection a sheen on top, so still water
    // never reads as a slab of fog-coloured concrete (fresh-review fix, DECISIONS)
    color: map ? new THREE.Color(0.9, 1.0, 1.03) : base || new THREE.Color('#4f6a6c'),
    envMap,
    combine: THREE.MixOperation,
    reflectivity: 0.2,
    fog: true,
  });
}

export function disposeTree(root) {
  const seen = new Set();
  root.traverse((o) => {
    if (o.geometry && !seen.has(o.geometry)) {
      seen.add(o.geometry);
      o.geometry.dispose();
    }
    const mats = o.material ? (Array.isArray(o.material) ? o.material : [o.material]) : [];
    for (const m of mats) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const k of ['map', 'envMap', 'alphaMap', 'emissiveMap']) {
        if (m[k] && !seen.has(m[k]) && !m[k].isRenderTargetTexture) {
          seen.add(m[k]);
          m[k].dispose();
        }
      }
      m.dispose();
    }
  });
}
