/* Shaders for what stands on a v2 landscape: instanced plants and the built sites. Same light, fog and tone
   curve as the ground (materials.js COMMON / OUT). */

import * as THREE from 'three';
import { COMMON, OUT, srgb } from './materials.js';

/* ---------------------------------------------------------------- plants (instanced) */

const PLANT_COL = {
  olearia: ['#7d8a6e', '#a3ad93'],
  scaevola: ['#3f6b2a', '#5f8f3c'],
  acacia: ['#3d4a26', '#5b6436'],
  tall: ['#34421f', '#55603a'],
  tussock: ['#8d9067', '#b5a66d'],
  dead: ['#8a8174', '#a49b8c'],
};

/** kind: 'cards' (alpha-tested leaf cards, the atlas), 'blob' (solid far mound), 'bark' (stems, dead twigs) */
export function plantMaterial(env, maps, { kind, species, lod, near, far, band }) {
  const [c0, c1] = PLANT_COL[species] || PLANT_COL.olearia;
  return new THREE.ShaderMaterial({
    name: `landscape__plant_${species}_${lod}_${kind}`,
    vertexColors: true,
    side: kind === 'cards' ? THREE.DoubleSide : THREE.FrontSide,
    // soft leaf edges with MSAA (alpha to coverage) instead of a hard cut-out
    alphaToCoverage: kind === 'cards',
    uniforms: {
      ...env.uniforms,
      uLeaves: { value: maps.leaves },
      uShade: { value: maps.shade },
      uCol0: { value: srgb(c0) },
      uCol1: { value: srgb(c1) },
      uKind: { value: kind === 'cards' ? 0 : kind === 'blob' ? 1 : 2 },
      uLod: { value: lod },
      uNear: { value: near },
      uFar: { value: far },
      uBand: { value: band },
    },
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform int uLod;
      uniform float uNear;
      uniform float uFar;
      uniform float uBand;
      attribute float aTint;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      varying vec3 vRoot;
      varying float vAo;
      varying float vFade;
      varying float vTint;
      void main() {
        mat4 im = modelMatrix * instanceMatrix;
        vec3 root = (im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 w = im * vec4(position, 1.0);
        float sway = color.g;
        float ph = dot(root.xz, vec2(0.21, 0.17));
        vec2 gust = vec2(0.8, -0.6) * (0.55 + 0.45 * sin(uTime * 0.7 + ph * 0.35));
        vec2 flutter = vec2(sin(uTime * 2.1 + ph * 3.0), cos(uTime * 1.7 + ph * 2.3));
        w.xz += (gust * 0.07 + flutter * 0.03) * sway * (1.0 + 0.25 * max(w.y - root.y, 0.0));
        vW = w.xyz;
        vRoot = root;
        vN = normalize(mat3(im) * normal);
        vUv = uv;
        vAo = color.r;
        vTint = aTint;
        float d = distance(cameraPosition, root);
        float inF = smoothstep(uNear - uBand, uNear + uBand, d);
        vFade = uLod == 0 ? 1.0 - inF : inF * (1.0 - smoothstep(uFar - uBand, uFar + uBand, d));
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      uniform sampler2D uLeaves;
      uniform sampler2D uShade;
      uniform vec3 uCol0;
      uniform vec3 uCol1;
      uniform int uKind;
      varying vec2 vUv;
      varying vec3 vN;
      varying vec3 vW;
      varying vec3 vRoot;
      varying float vAo;
      varying float vFade;
      varying float vTint;
      float bayer(vec2 p) {
        vec2 q = mod(floor(p), 4.0);
        int i = int(q.x) + int(q.y) * 4;
        int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
        return (float(m[i]) + 0.5) / 16.0;
      }
      void main() {
        if (vFade < 0.999 && vFade < bayer(gl_FragCoord.xy)) discard;
        vec3 alb;
        float cov = 1.0;
        if (uKind == 0) {
          vec4 t = texture(uLeaves, vUv);
          cov = smoothstep(0.3, 0.6, t.a);
          if (cov < 0.02) discard;
          // the sprites are drawn bright; the heath in the photos is muted, grey-green under a hard sun
          alb = mix(t.rgb, vec3(dot(t.rgb, vec3(0.3, 0.55, 0.15))), 0.2) * 0.8;
        } else if (uKind == 1) {
          float n = lsNoise(vW.xz * 2.7 + vW.y * 1.9) * 0.6 + lsNoise(vW.xz * 8.0 - vW.y * 5.0) * 0.4;
          alb = mix(uCol0, uCol1, n);
        } else {
          alb = uCol0 * (0.75 + 0.35 * lsNoise(vW.xy * 9.0 + vW.z * 4.0));
        }
        alb *= mix(vec3(0.86, 0.9, 0.84), vec3(1.12, 1.07, 0.98), vTint);
        float shade = texture(uShade, lsFrameUV(vRoot.xz)).b;
        vec3 N = normalize(vN);
        float ndl = dot(N, uSunDir);
        float diff = clamp(ndl * 0.6 + 0.4, 0.0, 1.0);
        vec3 V = normalize(cameraPosition - vW);
        float trans = pow(clamp(dot(-V, uSunDir), 0.0, 1.0), 3.0) * (uKind == 0 ? 0.55 : 0.2);
        float self = mix(0.45, 1.0, vAo);
        vec3 col = alb * (uSunColor * (diff * self + trans * vAo) * mix(0.35, 1.0, shade)
                          + uSkyColor * vAo * (0.55 + 0.45 * N.y));
        col = lsFog(col, vW);
        float alpha = cov;
        ${OUT}
      }
    `,
  });
}

/* ---------------------------------------------------------------- built sites (concrete, brick, paint...) */

const SITE = {
  concrete: { layer: 5, tint: [1, 1, 1], tile: 2.0, rough: 0.8 },
  brick: { layer: 7, tint: [1, 1, 1], tile: 2.0, rough: 0.85 },
  paint: { layer: 5, tint: [0.36, 0.5, 0.33], tile: 2.0, rough: 0.6, flat: 0.75 }, // the battery's dark green
  steel: { layer: -1, color: '#4a4f52', rough: 0.4 },
  rust: { layer: -1, color: '#8a5434', rough: 0.9 },
  sign: { layer: -1, color: '#d9d2b8', rough: 0.7 },
  gun: { layer: -1, color: '#5d6447', rough: 0.55 }, // the replica's olive drab (photos 2021)
  tyre: { layer: -1, color: '#1e1e1d', rough: 0.85 },
  limestone: { layer: 1, tint: [1.04, 0.92, 0.74], tile: 3.0, rough: 0.9, strata: 1 }, // cliffs, Mushroom Rock: golden aeolianite
};

export function siteMaterial(env, maps, kind) {
  const s = SITE[kind] || SITE.concrete;
  return new THREE.ShaderMaterial({
    name: `landscape__site_${kind}`,
    vertexColors: true,
    uniforms: {
      ...env.uniforms,
      uAlb: { value: maps.alb },
      uNrm: { value: maps.nrm },
      uShade: { value: maps.shade },
      uLayer: { value: s.layer },
      uTint: { value: new THREE.Vector3(...(s.tint || [1, 1, 1])) },
      uFlat: { value: s.flat ?? 0 },
      uColor: { value: srgb(s.color || '#ffffff') },
      uTileM: { value: s.tile || 2 },
      uRoughS: { value: s.rough },
      uStrata: { value: s.strata || 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      varying vec3 vN;
      varying float vAo;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vAo = color.r;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler2DArray;
      ${COMMON}
      uniform sampler2DArray uAlb;
      uniform sampler2DArray uNrm;
      uniform sampler2D uShade;
      uniform float uLayer;
      uniform vec3 uTint;
      uniform float uFlat;
      uniform vec3 uColor;
      uniform float uTileM;
      uniform float uRoughS;
      uniform float uStrata;
      varying vec3 vW;
      varying vec3 vN;
      varying float vAo;
      void main() {
        vec3 N = normalize(vN);
        vec3 alb;
        float hgt = 0.5;
        if (uLayer >= 0.0) {
          vec3 w3 = pow(abs(N), vec3(4.0));
          w3 /= dot(w3, vec3(1.0));
          vec3 ax = texture(uAlb, vec3(vW.zy / uTileM, uLayer)).rgb;
          vec3 ay = texture(uAlb, vec3(vW.xz / uTileM, uLayer)).rgb;
          vec3 az = texture(uAlb, vec3(vW.xy / uTileM, uLayer)).rgb;
          alb = ax * w3.x + ay * w3.y + az * w3.z;
          hgt = texture(uNrm, vec3(vW.xz / uTileM, uLayer)).b * w3.y + texture(uNrm, vec3(vW.zy / uTileM, uLayer)).b * w3.x
              + texture(uNrm, vec3(vW.xy / uTileM, uLayer)).b * w3.z;
          // paint: the concrete's pattern faintly under a flat colour
          alb = mix(alb, vec3(dot(alb, vec3(0.33))) * 0.5 + 0.25, uFlat) * uTint;
        } else {
          alb = uColor * (0.85 + 0.3 * lsNoise(vW.xz * 7.0 + vW.y * 5.0));
        }
        if (uStrata > 0.0) {
          // cross-bedded aeolianite: thin leaning beds, ochre stains; dark weed and wet rock at the waterline
          float bed = sin(vW.y * 7.5 + 2.0 * lsNoise(vW.xz * 0.25) + vW.x * 0.08);
          alb *= 0.9 + 0.1 * bed;
          alb = mix(alb, alb * vec3(1.08, 0.95, 0.78), smoothstep(0.55, 0.9, lsNoise(vW.xz * 0.12 + vW.y * 0.2)) * 0.6);
          float wl = 1.0 - smoothstep(0.15, 0.9, vW.y + 0.1 * sin(uTime * 0.7 + vW.x * 0.3));
          alb = mix(alb, vec3(0.08, 0.09, 0.06), wl * 0.75);
        }
        float ao = vAo * mix(0.75, 1.0, hgt);
        float shade = mix(1.0, texture(uShade, lsFrameUV(vW.xz)).b, smoothstep(0.3, 0.85, N.y));
        float ndl = max(dot(N, uSunDir), 0.0);
        vec3 V = normalize(cameraPosition - vW);
        vec3 H = normalize(V + uSunDir);
        float spec = pow(max(dot(N, H), 0.0), mix(160.0, 10.0, uRoughS)) * (1.0 - uRoughS) * 1.2;
        float aoS = sqrt(ao); // sky light still reaches into a recess, just less
        vec3 col = alb * (uSunColor * ndl * shade * mix(0.6, 1.0, vAo) + uSkyColor * aoS * (0.6 + 0.4 * N.y)
                          + uBounce * aoS * (0.65 - 0.35 * N.y))
                 + uSunColor * spec * shade * ndl;
        col = lsFog(col, vW);
        float alpha = 1.0;
        ${OUT}
      }
    `,
  });
}

/* ---------------------------------------------------------------- boulders (instanced limestone) */

export function rockMaterial(env, maps, { lod, near, far, band }) {
  return new THREE.ShaderMaterial({
    name: `landscape__rock_${lod}`,
    vertexColors: true,
    uniforms: {
      ...env.uniforms,
      uAlb: { value: maps.alb },
      uNrm: { value: maps.nrm },
      uShade: { value: maps.shade },
      uLod: { value: lod },
      uNear: { value: near },
      uFar: { value: far },
      uBand: { value: band },
    },
    vertexShader: /* glsl */ `
      uniform int uLod;
      uniform float uNear;
      uniform float uFar;
      uniform float uBand;
      attribute float aTint;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vRoot;
      varying float vAo;
      varying float vFade;
      varying float vTint;
      void main() {
        mat4 im = modelMatrix * instanceMatrix;
        vec3 root = (im * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 w = im * vec4(position, 1.0);
        vW = w.xyz;
        vRoot = root;
        vN = normalize(mat3(im) * normal);
        vAo = color.r;
        vTint = aTint;
        float d = distance(cameraPosition, root);
        float inF = smoothstep(uNear - uBand, uNear + uBand, d);
        vFade = uLod == 0 ? 1.0 - inF : inF * (1.0 - smoothstep(uFar - uBand, uFar + uBand, d));
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler2DArray;
      ${COMMON}
      uniform sampler2DArray uAlb;
      uniform sampler2DArray uNrm;
      uniform sampler2D uShade;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vRoot;
      varying float vAo;
      varying float vFade;
      varying float vTint;
      float bayer(vec2 p) {
        vec2 q = mod(floor(p), 4.0);
        int i = int(q.x) + int(q.y) * 4;
        int m[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
        return (float(m[i]) + 0.5) / 16.0;
      }
      void main() {
        if (vFade < 0.999 && vFade < bayer(gl_FragCoord.xy)) discard;
        vec3 N = normalize(vN);
        vec3 w3 = pow(abs(N), vec3(4.0));
        w3 /= dot(w3, vec3(1.0));
        float T = 3.0;
        vec3 alb = texture(uAlb, vec3(vW.zy / T, 1.0)).rgb * w3.x + texture(uAlb, vec3(vW.xz / T, 1.0)).rgb * w3.y
                 + texture(uAlb, vec3(vW.xy / T, 1.0)).rgb * w3.z;
        float hgt = texture(uNrm, vec3(vW.xz / T, 1.0)).b * w3.y + texture(uNrm, vec3(vW.zy / T, 1.0)).b * w3.x
                  + texture(uNrm, vec3(vW.xy / T, 1.0)).b * w3.z;
        alb *= mix(vec3(0.86, 0.86, 0.84), vec3(1.08, 1.03, 0.94), vTint);
        float wl = 1.0 - smoothstep(0.1, 0.7, vW.y);
        alb = mix(alb, vec3(0.08, 0.09, 0.06), wl * 0.7);
        float ao = vAo * mix(0.7, 1.0, hgt);
        float shade = mix(texture(uShade, lsFrameUV(vRoot.xz)).b, 1.0, 0.3);
        float ndl = max(dot(N, uSunDir), 0.0);
        vec3 col = alb * (uSunColor * ndl * shade + uSkyColor * sqrt(ao) * (0.6 + 0.4 * N.y) + uBounce * sqrt(ao) * (0.65 - 0.35 * N.y));
        if (vW.y < 0.0) col = lsUnderwater(col, vW);
        col = lsFog(col, vW);
        float alpha = 1.0;
        ${OUT}
      }
    `,
  });
}
