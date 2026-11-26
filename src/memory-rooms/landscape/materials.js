/* The shaders of a v2 landscape. Unlike the rooms (baked in Blender, drawn unlit), a landscape is lit live:
   one sun (its shadows on the ground baked into shade.png at 1 m by tools/.../v2/shade.py), a sky dome, the
   same light on the ground, the plants, the rocks and the battery, and its own tone curve, so nothing here
   depends on the renderer's tone mapping (the viewer keeps NoToneMapping for its baked rooms).

     const env = makeEnv(meta)                 // sun, sky, fog: shared uniforms (one object, every material)
     terrainMaterial(env, maps)                // maps: { splat, shade, water, veg, alb, nrm (DataArrayTextures) }
     waterMaterial(env, maps)  skyMaterial(env)  litMaterial(env, maps, { map, vertexColors })
     env.uniforms.uTime.value = t              // every frame (water, caustics, wind)

   Under the sea (world y < 0) the ground is seen through the water: its light is absorbed along the path down
   and back up (red first), scattered toward the water's own colour, with caustics. So the water surface only
   adds what the surface itself does: reflection, sun glint and foam. */

import * as THREE from 'three';

export const LAYERS = ['sand', 'limestone', 'soil', 'weed', 'path', 'concrete', 'bitumen', 'brick'];

export const srgb = (hex) => new THREE.Color(hex).convertSRGBToLinear();

export function makeEnv({ sun = { azimuth: 320, elevation: 42 }, frame } = {}) {
  const az = THREE.MathUtils.degToRad(sun.azimuth); // clockwise from north
  const el = THREE.MathUtils.degToRad(sun.elevation);
  // world: x east, y up, z south; north = -z
  const dir = new THREE.Vector3(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el)).normalize();
  const uniforms = {
    uSunDir: { value: dir },
    uSunColor: { value: new THREE.Color(1.0, 0.95, 0.86).multiplyScalar(2.2) },
    uSkyColor: { value: srgb('#a9c8e4').multiplyScalar(1.35) },
    uSkyTop: { value: srgb('#2466bd') },
    uSkyHorizon: { value: srgb('#b9d6ee') },
    uBounce: { value: srgb('#c2ae88').multiplyScalar(0.9) },
    uFogColor: { value: srgb('#c0d7ea') },
    uFogDensity: { value: 1 / 3400 },
    uExposure: { value: 0.86 },
    uTime: { value: 0 },
    uFrame: { value: new THREE.Vector4(frame.x0, -frame.y1, frame.cols * frame.cell, frame.rows * frame.cell) },
    // water optics (per metre): red goes first; the scatter colour is Peron's turquoise over sand
    uAbsorb: { value: new THREE.Vector3(0.42, 0.11, 0.075) },
    uScatter: { value: srgb('#2f8f9a').multiplyScalar(0.55) },
    uDeep: { value: srgb('#0f4f6e') },
  };
  return { uniforms, sunDir: dir };
}

export const COMMON = /* glsl */ `
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uSkyColor;
uniform vec3 uSkyTop;
uniform vec3 uSkyHorizon;
uniform vec3 uBounce;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uExposure;
uniform float uTime;
uniform vec4 uFrame;
uniform vec3 uAbsorb;
uniform vec3 uScatter;
uniform vec3 uDeep;

vec3 lsTonemap(vec3 c) {
  c *= uExposure;
  c = clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0);
  // ACES washes the brights out: give the colour back (the photos: golden sand, deep sky, turquoise water)
  float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
  return clamp(mix(vec3(l), c, 1.2), 0.0, 1.0);
}
vec3 lsSky(vec3 d) {
  float up = clamp(d.y, -0.2, 1.0);
  vec3 c = mix(uSkyHorizon, uSkyTop, pow(max(up, 0.0), 0.55));
  float s = max(dot(normalize(d), uSunDir), 0.0);
  c += vec3(1.0, 0.9, 0.75) * (0.35 * pow(s, 8.0) + 0.6 * pow(s, 64.0));
  return c;
}
vec3 lsFog(vec3 c, vec3 wp) {
  float d = distance(cameraPosition, wp);
  float f = 1.0 - exp(-pow(d * uFogDensity, 1.25));
  vec3 v = normalize(wp - cameraPosition);
  vec3 fc = uFogColor + vec3(1.0, 0.85, 0.65) * 0.35 * pow(max(dot(v, uSunDir), 0.0), 6.0);
  return mix(c, fc, f);
}
vec2 lsFrameUV(vec2 xz) { return (xz - uFrame.xy) / uFrame.zw; }
float lsHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float lsNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(lsHash(i), lsHash(i + vec2(1, 0)), u.x), mix(lsHash(i + vec2(0, 1)), lsHash(i + vec2(1, 1)), u.x), u.y);
}
// light seen through the sea to a point wp below y = 0 (camera above the water)
vec3 lsUnderwater(vec3 lit, vec3 wp) {
  float dw = max(-wp.y, 0.0);
  if (dw <= 0.0) return lit;
  vec3 V = normalize(cameraPosition - wp);
  float path = dw / max(abs(V.y), 0.12) + dw / max(uSunDir.y, 0.2);
  vec3 tr = exp(-uAbsorb * path);
  return lit * tr + uScatter * (1.0 - exp(-0.35 * path));
}
// cheap caustics: two warped interference layers, sharpened
float lsCaustic(vec2 p, float t) {
  vec2 q = p * 0.9;
  float c = 0.0;
  for (int i = 0; i < 3; i++) {
    float fi = float(i);
    q += vec2(sin(q.y * 1.7 + t * (0.6 + 0.2 * fi)), cos(q.x * 1.3 - t * (0.5 + 0.15 * fi))) * 0.45;
    c += abs(sin(q.x + q.y * 0.5 + t * 0.4));
  }
  c /= 3.0;
  return pow(clamp(1.0 - c, 0.0, 1.0), 4.0);
}
`;

export const OUT = /* glsl */ `
  gl_FragColor = vec4(lsTonemap(col), alpha);
  #include <colorspace_fragment>
`;

/* ---------------------------------------------------------------- terrain */

export function terrainMaterial(env, maps) {
  return new THREE.ShaderMaterial({
    name: 'landscape__terrain',
    uniforms: {
      ...env.uniforms,
      uSplat: { value: maps.splat },
      uShade: { value: maps.shade },
      uWater: { value: maps.water },
      uVeg: { value: maps.veg },
      uAlb: { value: maps.alb },
      uNrm: { value: maps.nrm },
      uTile: { value: maps.tiles }, // vec4: sand, limestone, soil, weed tile sizes (m)
      uRough: { value: maps.rough },
      uDebug: { value: 0 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      varying vec3 vNormal;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        vNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      precision highp sampler2DArray;
      ${COMMON}
      uniform sampler2D uSplat;
      uniform sampler2D uShade;
      uniform sampler2D uWater;
      uniform sampler2D uVeg;
      uniform sampler2DArray uAlb;
      uniform sampler2DArray uNrm;
      uniform vec4 uTile;
      uniform int uDebug;
      uniform vec4 uRough;
      varying vec3 vWorld;
      varying vec3 vNormal;

      // one layer, sampled at two scales (the second rotated and larger) and blended by a slow noise: no
      // visible repeat at walking height or from the air
      void layer(float id, float tile, vec2 xz, float mixN, out vec4 a, out vec4 n) {
        vec2 uv1 = xz / tile;
        vec2 uv2 = mat2(0.8, -0.6, 0.6, 0.8) * xz / (tile * 2.7) + 0.37;
        vec4 a1 = texture(uAlb, vec3(uv1, id));
        vec4 a2 = texture(uAlb, vec3(uv2, id));
        vec4 n1 = texture(uNrm, vec3(uv1, id));
        vec4 n2 = texture(uNrm, vec3(uv2, id));
        a = mix(a1, a2, mixN);
        n = mix(n1, n2, mixN);
      }

      void main() {
        vec2 xz = vWorld.xz;
        vec2 fuv = lsFrameUV(xz);
        vec4 w = texture(uSplat, fuv);
        w.a = max(0.0, 1.0 - w.r - w.g - w.b); // weed: what the other three leave
        vec4 sh = texture(uShade, fuv);
        vec3 veg = texture(uVeg, fuv).rgb;
        float dist = distance(cameraPosition, vWorld);
        float mixN = smoothstep(0.25, 0.75, lsNoise(xz * 0.11));

        vec3 N = normalize(vNormal);
        // steep ground is rock whatever the map says (cliff faces, gun-pit walls)
        float steep = smoothstep(0.82, 0.62, N.y);
        w = mix(w, vec4(0.0, 1.0, 0.0, 0.0), steep * (vWorld.y > -0.3 ? 1.0 : 0.6));

        vec4 aS, nS, aL, nL, aO, nO, aW, nW;
        layer(0.0, uTile.x, xz, mixN, aS, nS);
        layer(1.0, uTile.y, xz, mixN, aL, nL);
        layer(2.0, uTile.z, xz, mixN, aO, nO);
        layer(3.0, uTile.w, xz, mixN, aW, nW);
        // on a cliff face the planar xz projection smears: sample limestone on the face's own plane too
        if (steep > 0.01) {
          vec2 side = abs(N.x) > abs(N.z) ? vWorld.zy : vWorld.xy;
          vec4 aL2, nL2;
          layer(1.0, uTile.y, side, mixN, aL2, nL2);
          aL = mix(aL, aL2, steep);
          nL = mix(nL, nL2, steep);
        }
        // height blend: where two grounds meet, the higher grains win (crisp, natural edges)
        vec4 hgt = vec4(nS.b, nL.b, nO.b, nW.b);
        vec4 wb = w + hgt * 0.35;
        float m = max(max(wb.x, wb.y), max(wb.z, wb.w)) - 0.22;
        wb = max(wb - m, 0.0) * step(0.003, w);
        wb /= max(dot(wb, vec4(1.0)), 1e-4);

        vec3 alb = aS.rgb * wb.x + aL.rgb * wb.y + aO.rgb * wb.z + aW.rgb * wb.w;
        // from the air the tiles' pattern would repeat: fade to each layer's mean colour (its last mip) with a slow
        // large-scale variation instead
        float macro = smoothstep(90.0, 420.0, dist);
        if (macro > 0.0) {
          vec3 mS = textureLod(uAlb, vec3(0.5, 0.5, 0.0), 12.0).rgb;
          vec3 mL = textureLod(uAlb, vec3(0.5, 0.5, 1.0), 12.0).rgb;
          vec3 mO = textureLod(uAlb, vec3(0.5, 0.5, 2.0), 12.0).rgb;
          vec3 mW = textureLod(uAlb, vec3(0.5, 0.5, 3.0), 12.0).rgb;
          vec3 mean = mS * wb.x + mL * wb.y + mO * wb.z + mW * wb.w;
          alb = mix(alb, mean, macro * 0.85);
        }
        alb *= 0.9 + 0.2 * lsNoise(xz * 0.013) * (0.4 + 0.6 * macro);
        vec4 nt = nS * wb.x + nL * wb.y + nO * wb.z + nW * wb.w;
        float rough = dot(wb, uRough);
        float ao = mix(0.55, 1.0, nt.b); // crevices (low in the height map) are darker
        // detail normal (tangent frame on the ground: x east, y = -z south... the map's +y is north)
        vec2 dn = (nt.rg * 2.0 - 1.0) * smoothstep(90.0, 15.0, dist);
        vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
        vec3 B = normalize(cross(T, N)); // = -z on flat ground: north
        vec3 Nd = normalize(N + T * dn.x + B * dn.y * -1.0);

        // far away the plants are gone: the ground carries their colour instead
        float far = smoothstep(70.0, 260.0, dist);
        vec3 heath = vec3(0.10, 0.13, 0.06);
        alb = mix(alb, heath, clamp(veg.r * 0.85 + veg.g, 0.0, 1.0) * far * 0.85);
        alb = mix(alb, vec3(0.30, 0.30, 0.17), veg.b * far * 0.5);

        // wet sand along the water's edge (the swash): darker, glossier
        float wet = smoothstep(0.45, 0.1, vWorld.y + 0.08 * sin(uTime * 0.6 + xz.x * 0.05)) * (wb.x + 0.5 * wb.y);
        alb *= mix(1.0, 0.62, wet);
        rough = mix(rough, 0.25, wet);

        float sun = sh.r;
        float aoG = sh.g;
        float ndl = max(dot(Nd, uSunDir), 0.0);
        vec3 col = alb * (uSunColor * ndl * sun
                          + uSkyColor * (0.55 + 0.45 * Nd.y) * aoG * ao
                          + uBounce * (0.5 - 0.5 * Nd.y) * aoG);
        // a little sheen (wet sand, polished rock)
        vec3 V = normalize(cameraPosition - vWorld);
        vec3 H = normalize(V + uSunDir);
        float spec = pow(max(dot(Nd, H), 0.0), mix(200.0, 12.0, rough)) * (1.0 - rough) * 1.5;
        col += uSunColor * spec * sun * ndl;

        if (vWorld.y < 0.0) {
          float dw = -vWorld.y;
          col += uSunColor * alb * lsCaustic(xz * 0.9, uTime * 1.3) * 0.9 * exp(-0.35 * dw) * sun * smoothstep(0.0, 0.25, dw);
          col = lsUnderwater(col, vWorld);
        }
        col = lsFog(col, vWorld);
        float alpha = 1.0;
        if (uDebug == 1) col = alb;
        else if (uDebug == 2) col = Nd * 0.5 + 0.5;
        else if (uDebug == 3) col = w.rgb + vec3(w.a);
        else if (uDebug == 4) col = sh.rgb;
        else if (uDebug == 5) col = vec3(nt.rg, rough);
        else if (uDebug == 6) col = wb.rgb;
        if (uDebug > 0) { gl_FragColor = vec4(col, 1.0); return; }
        ${OUT}
      }
    `,
  });
}

/* ---------------------------------------------------------------- water surface */

export function waterMaterial(env, maps) {
  return new THREE.ShaderMaterial({
    name: 'landscape__water',
    transparent: true,
    depthWrite: false,
    uniforms: {
      ...env.uniforms,
      uWater: { value: maps.water },
      uWaves: { value: maps.waves },
    },
    vertexShader: /* glsl */ `
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      uniform sampler2D uWater;
      uniform sampler2D uWaves;
      varying vec3 vWorld;

      vec3 waveN(vec2 p, float t) {
        vec2 a = texture(uWaves, p / 31.0 + vec2(t * 0.0042, -t * 0.0061)).rg * 2.0 - 1.0;
        vec2 b = texture(uWaves, mat2(0.8, -0.6, 0.6, 0.8) * p / 11.3 + vec2(-t * 0.009, -t * 0.012)).rg * 2.0 - 1.0;
        vec2 c = texture(uWaves, mat2(0.28, 0.96, -0.96, 0.28) * p / 4.1 + vec2(t * 0.021, -t * 0.015)).rg * 2.0 - 1.0;
        vec2 d = a * 0.7 + b * 0.55 + c * 0.3;
        return normalize(vec3(d.x, 2.2, d.y));
      }

      void main() {
        vec2 xz = vWorld.xz;
        vec2 fuv = lsFrameUV(xz);
        bool inside = all(greaterThanEqual(fuv, vec2(0.0))) && all(lessThanEqual(fuv, vec2(1.0)));
        vec4 wm = inside ? texture(uWater, fuv) : vec4(1.0, 0.0, 0.0, 1.0);
        float depth = wm.r * 25.5;
        float shore = (wm.g * 255.0 - 128.0) / 2.0;      // + land, - sea (m)
        float dist = distance(cameraPosition, vWorld);
        // the edge of the frame: no sea floor beyond it, so the water turns opaque toward it
        vec2 e = min(fuv, 1.0 - fuv);
        float edge = inside ? smoothstep(0.0, 0.035, min(e.x, e.y)) : 0.0;

        vec3 n = waveN(xz, uTime);
        float calm = smoothstep(0.0, 2.5, depth);        // very shallow water is flatter
        n = normalize(mix(vec3(0.0, 1.0, 0.0), n, mix(0.35, 1.0, calm) * smoothstep(1400.0, 200.0, dist) + 0.05));
        vec3 V = normalize(cameraPosition - vWorld);
        float ndv = max(dot(n, V), 0.0);
        float fres = 0.02 + 0.98 * pow(1.0 - ndv, 5.0);
        vec3 refl = lsSky(reflect(-V, n));
        vec3 R = reflect(-uSunDir, n);
        float glint = pow(max(dot(R, V), 0.0), 900.0) * 30.0 + pow(max(dot(R, V), 0.0), 90.0) * 0.6;

        // foam: the swash on the beach and a lace over the rock platforms and where waves meet the cliffs
        float t = uTime;
        float band = sin(shore * 1.6 + t * 0.9 + lsNoise(xz * 0.15) * 4.0);
        float nearShore = smoothstep(-7.0, -0.2, shore) * (1.0 - smoothstep(-0.2, 0.6, shore));
        float lace = smoothstep(0.55, 0.95, lsNoise(xz * 1.3 + vec2(t * 0.3, -t * 0.2)) * 0.6 + lsNoise(xz * 3.1 - t * 0.4) * 0.5);
        float foam = nearShore * (0.35 + 0.65 * smoothstep(0.3, 0.9, band)) * lace;
        foam += wm.b * smoothstep(0.35, 0.05, depth) * lace * 0.8;      // breaking over the platforms
        // the swash: a lace of foam wherever the water runs thin over the sand or the rock, moving with the waves
        float thin = 1.0 - smoothstep(0.0, 0.45, depth + 0.12 * sin(t * 0.8 + lsNoise(xz * 0.2) * 6.0));
        foam += thin * smoothstep(0.35, 0.8, lsNoise(xz * 2.2 + vec2(t * 0.35, -t * 0.25)) * 0.7 + 0.35 * band);
        foam = clamp(foam, 0.0, 1.0) * smoothstep(900.0, 60.0, dist);

        vec3 deep = uDeep * (uSkyColor * 0.6 + uSunColor * 0.12);
        vec3 col = refl * fres + uSunColor * glint;
        float alpha = clamp(fres * 1.05 + 0.04, 0.0, 1.0);
        // outside the floor: opaque deep sea
        col = mix(deep * (1.0 - fres) + col, col, edge);
        alpha = mix(1.0, alpha, edge);
        vec3 foamC = vec3(0.95, 0.97, 1.0) * (uSunColor * 0.42 + uSkyColor * 0.5);
        col = mix(col, foamC, foam);
        alpha = max(alpha, foam * 0.95);
        // a soft lip where the water thins out on the sand
        alpha *= smoothstep(-0.02, 0.06, depth + (inside ? 0.0 : 1.0));
        col = lsFog(col, vWorld);
        alpha = mix(alpha, 1.0, 1.0 - exp(-pow(dist * uFogDensity, 1.25)));
        ${OUT}
      }
    `,
  });
}

/* ---------------------------------------------------------------- sky */

export function skyMaterial(env) {
  return new THREE.ShaderMaterial({
    name: 'landscape__sky',
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { ...env.uniforms },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      precision highp float;
      ${COMMON}
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        vec3 col = lsSky(d);
        col = mix(col, uFogColor, smoothstep(0.12, -0.02, d.y) * 0.8);
        col += vec3(1.0, 0.95, 0.85) * 40.0 * smoothstep(0.9996, 0.99985, dot(d, uSunDir));
        float alpha = 1.0;
        ${OUT}
      }
    `,
  });
}

/* ---------------------------------------------------------------- the waves' normal map (made here, tileable) */

export function makeWaveTexture(size = 256) {
  // a sum of random sine swells with integer wave numbers (so it tiles), as a normal map in RG
  const data = new Uint8Array(size * size * 4);
  const waves = [];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 28; k++) {
    const kx = Math.round((rnd() * 2 - 1) * 9);
    const ky = Math.round((rnd() * 2 - 1) * 9);
    if (!kx && !ky) continue;
    const amp = 1 / Math.hypot(kx, ky) ** 1.2;
    waves.push([kx, ky, amp, rnd() * Math.PI * 2]);
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let dx = 0;
      let dy = 0;
      for (const [kx, ky, amp, ph] of waves) {
        const p = ((kx * x + ky * y) / size) * Math.PI * 2 + ph;
        const c = Math.cos(p) * amp * Math.PI * 2;
        dx += c * kx;
        dy += c * ky;
      }
      const o = (y * size + x) * 4;
      data[o] = Math.max(0, Math.min(255, 128 + dx * 3.2));
      data[o + 1] = Math.max(0, Math.min(255, 128 + dy * 3.2));
      data[o + 2] = 255;
      data[o + 3] = 255;
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.needsUpdate = true;
  return tex;
}
