/* Paths, roads and car parks of a v2 landscape as geometry, built in the browser from data.json `ways` (OSM).

   A path is a ribbon draped on the ground, sunk between two low verges: across it, five columns of vertices
   (verge, lip, centre, lip, verge); the centre sits ~6 cm under the verges, the verges' outer edge breaks up
   into the ground (an irregular, noise-cut edge, no blending). Where a path climbs steeply its tread
   is cut into steps (0.17 m risers, concrete) where it climbs faster than 3 in 10, like the steps up to the observation post. Surfaces by OSM tag:
   unsealed = crushed limestone, sand = sand, paved = concrete; roads are bitumen with concrete kerbs; car parks
   are bitumen draped over their outline.

     const ways = buildWays(meta.ways, field, env, maps)   // a Group
*/

import * as THREE from 'three';
import { COMMON, OUT } from './materials.js';

const LAYER = { sand: 0, path: 4, concrete: 5, bitumen: 6, paint: 9 }; // 9: white line paint (no texture)
const RISER = 0.17;

function surfaceOf(p) {
  if (p.surface === 'paved' || p.surface === 'concrete') return 'concrete';
  if (p.surface === 'asphalt') return 'bitumen';
  if (p.surface === 'sand') return 'sand';
  return 'path';
}

/** resample a polyline to <= step m and smooth it (Chaikin, twice) so corners don't kink */
function resample(pts, step = 0.8) {
  let p = pts.map(([x, z]) => [x, z]);
  for (let k = 0; k < 2 && p.length > 2; k++) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i++) {
      const [ax, az] = p[i];
      const [bx, bz] = p[i + 1];
      q.push([ax * 0.75 + bx * 0.25, az * 0.75 + bz * 0.25], [ax * 0.25 + bx * 0.75, az * 0.25 + bz * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  const out = [p[0]];
  for (let i = 1; i < p.length; i++) {
    const [ax, az] = out[out.length - 1];
    const [bx, bz] = p[i];
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(d / step));
    for (let k = 1; k <= n; k++) out.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  return out;
}

class Builder {
  constructor() {
    this.pos = [];
    this.uv = [];
    this.attr = []; // layer, edge, ao
    this.idx = [];
  }
  v(x, y, z, u, w, layer, edge, ao) {
    this.pos.push(x, y, z);
    this.uv.push(u, w);
    this.attr.push(layer, edge, ao);
    return this.pos.length / 3 - 1;
  }
  tri(a, b, c) {
    this.idx.push(a, b, c);
  }
  quad(a, b, c, d) {
    this.idx.push(a, b, c, a, c, d);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('aSurf', new THREE.Float32BufferAttribute(this.attr, 3));
    g.setIndex(this.idx);
    g.computeVertexNormals();
    g.computeBoundingSphere();
    return g;
  }
}

function ribbon(B, field, line, { width, layer, sunk = 0.06, verge = 0.35, steps = true }) {
  // steps want short rows (one per tread); a concrete path can be stepped, so it's sampled finer
  const pts = resample(line, layer === LAYER.concrete ? 0.35 : 0.8);
  if (pts.length < 2) return;
  const hw = width / 2;
  const ys = pts.map(([x, z]) => field.heightAt(x, z));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const steep = ys.map((_, i) => {
    let a = i;
    let b = i;
    while (a > 0 && cum[i] - cum[a] < 1.5) a--;
    while (b < ys.length - 1 && cum[b] - cum[i] < 1.5) b++;
    // a paved (concrete) path is stepped from 1 in 4.5 (the steps up to the observation post), an unsealed one from 3 in 10
    return Math.abs(ys[b] - ys[a]) / Math.max(0.1, cum[b] - cum[a]) > (layer === LAYER.concrete ? 0.22 : 0.3);
  });
  const stepped = steps && layer !== LAYER.bitumen;
  // a step is flat across the whole width, so it takes the highest ground under it (a path cut across a side slope
  // would otherwise have the ground poke through each tread's uphill half)
  const hiAcross = pts.map(([x, z], i) => {
    const [px, pz] = pts[Math.max(0, i - 1)];
    const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    const l = Math.hypot(nx - px, nz - pz) || 1;
    const sx = -(nz - pz) / l;
    const sz = (nx - px) / l;
    let m = -Infinity;
    for (const o of [-hw, -hw / 2, 0, hw / 2, hw]) m = Math.max(m, field.heightAt(x + sx * o, z + sz * o));
    return m;
  });
  const tread = ys.map((y, i) => (stepped && steep[i] ? Math.ceil((hiAcross[i] + 0.02) / RISER) * RISER : y));
  // rows: where a stepped tread changes level, the row is repeated in place (old level, the riser in concrete,
  // new level), so each tread is flat and each riser vertical
  const specs = [];
  for (let i = 0; i < pts.length; i++) {
    if (i > 0 && stepped && steep[i] && steep[i - 1] && Math.abs(tread[i] - tread[i - 1]) > 0.05) {
      specs.push({ i, level: tread[i - 1], layer, riser: false });
      specs.push({ i, level: tread[i - 1], layer: LAYER.concrete, riser: true });
      specs.push({ i, level: tread[i], layer: LAYER.concrete, riser: true });
    }
    specs.push({ i, level: tread[i], layer, riser: false });
  }
  const rows = specs.map(({ i, level, layer: lay, riser }) => {
    const [x, z] = pts[i];
    const [px, pz] = pts[Math.max(0, i - 1)];
    const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
    let tx = nx - px;
    let tz = nz - pz;
    const l = Math.hypot(tx, tz) || 1;
    tx /= l;
    tz /= l;
    const sx = -tz;
    const sz = tx;
    const across = [-(hw + verge), -hw, -hw * 0.6, 0, hw * 0.6, hw, hw + verge];
    const edge = [1, 0.55, 0.15, 0, 0.15, 0.55, 1];
    return across.map((o, k) => {
      const vx = x + sx * o;
      const vz = z + sz * o;
      const g = field.heightAt(vx, vz);
      // the verges ride the ground a little proud; the tread sits sunk below them (a step stays flat across)
      const centreY = level - sunk + 0.06;
      const onSteps = steep[i] && stepped;
      const y =
        k === 0 || k === 6
          ? g + 0.015
          : k === 1 || k === 5
            ? // on steps the whole tread is flat out to the verge; the verge's outer edge meets the ground (each step's cheek)
              onSteps
              ? centreY + 0.02
              : Math.max(g + 0.05, centreY + sunk * 0.6)
            : onSteps
              ? centreY
              : Math.max(centreY, g - 0.25);
      return B.v(vx, y, vz, (o + hw) / 2, riser ? level : cum[i] / 2, k > 0 && k < 6 ? lay : layer, edge[k], riser ? 0.85 : k === 1 || k === 5 ? 0.82 : 1);
    });
  });
  for (let r = 0; r < rows.length - 1; r++) {
    const a = rows[r];
    const b = rows[r + 1];
    for (let k = 0; k < 6; k++) B.quad(a[k], b[k], b[k + 1], a[k + 1]);
  }
}

function kerbs(B, field, line, width) {
  const pts = resample(line, 1.0);
  for (const side of [-1, 1]) {
    let prev = null;
    for (let i = 0; i < pts.length; i++) {
      const [x, z] = pts[i];
      const [px, pz] = pts[Math.max(0, i - 1)];
      const [nx, nz] = pts[Math.min(pts.length - 1, i + 1)];
      let tx = nx - px;
      let tz = nz - pz;
      const l = Math.hypot(tx, tz) || 1;
      tx /= l;
      tz /= l;
      const o = side * (width / 2);
      const ix = x - tz * o;
      const iz = z + tx * o;
      const ox = x - tz * (o + side * 0.3);
      const oz = z + tx * (o + side * 0.3);
      const g = field.heightAt(ix, iz);
      const cur = [
        B.v(ix, g + 0.02, iz, 0, i, LAYER.concrete, 0, 0.85),
        B.v(ix, g + 0.13, iz, 0.15, i, LAYER.concrete, 0, 1),
        B.v(ox, g + 0.15, oz, 0.3, i, LAYER.concrete, 0, 1),
        B.v(ox, field.heightAt(ox, oz) - 0.05, oz, 0.45, i, LAYER.concrete, 0, 0.9),
      ];
      if (prev) {
        for (let k = 0; k < 3; k++) {
          if (side > 0) B.quad(prev[k], cur[k], cur[k + 1], prev[k + 1]);
          else B.quad(prev[k + 1], cur[k + 1], cur[k], prev[k]);
        }
      }
      prev = cur;
    }
  }
}

/** a car park: its outline triangulated and split until no edge is over 1.2 m (so it drapes over the ground with a
    clean edge), a low concrete kerb round it, and for a surface car park white bay lines along its longest side */
function carpark(B, field, poly, kind) {
  const ring = poly.map(([x, z]) => new THREE.Vector2(x, z));
  if (ring.length < 3) return;
  const tris = THREE.ShapeUtils.triangulateShape(ring, []);
  const v = (x, z) => B.v(x, field.heightAt(x, z) + 0.05, z, x / 2, z / 2, LAYER.bitumen, 0, 1);
  const emit = (a, b, c, depth) => {
    const ab = Math.hypot(a[0] - b[0], a[1] - b[1]);
    const bc = Math.hypot(b[0] - c[0], b[1] - c[1]);
    const ca = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const m = Math.max(ab, bc, ca);
    if (m > 1.2 && depth < 12) {
      if (m === ab) {
        const d = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
        emit(a, d, c, depth + 1);
        emit(d, b, c, depth + 1);
      } else if (m === bc) {
        const d = [(b[0] + c[0]) / 2, (b[1] + c[1]) / 2];
        emit(a, b, d, depth + 1);
        emit(a, d, c, depth + 1);
      } else {
        const d = [(c[0] + a[0]) / 2, (c[1] + a[1]) / 2];
        emit(a, b, d, depth + 1);
        emit(d, b, c, depth + 1);
      }
      return;
    }
    B.tri(v(a[0], a[1]), v(b[0], b[1]), v(c[0], c[1]));
  };
  for (const [i, j, k] of tris) emit(poly[i], poly[j], poly[k], 0);
  // the kerb: a low concrete strip just outside the outline
  let cx = 0;
  let cz = 0;
  for (const [x, z] of poly) {
    cx += x / poly.length;
    cz += z / poly.length;
  }
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L < 0.2) continue;
    let nx = -(b[1] - a[1]) / L;
    let nz = (b[0] - a[0]) / L;
    if (((a[0] + b[0]) / 2 - cx) * nx + ((a[1] + b[1]) / 2 - cz) * nz < 0) {
      nx = -nx;
      nz = -nz;
    }
    const n = Math.max(1, Math.ceil(L / 1.0));
    for (let s = 0; s < n; s++) {
      const p0 = [a[0] + ((b[0] - a[0]) * s) / n, a[1] + ((b[1] - a[1]) * s) / n];
      const p1 = [a[0] + ((b[0] - a[0]) * (s + 1)) / n, a[1] + ((b[1] - a[1]) * (s + 1)) / n];
      const q = (p, o, up) => B.v(p[0] + nx * o, field.heightAt(p[0] + nx * o, p[1] + nz * o) + up, p[1] + nz * o, o, 0, LAYER.concrete, 0, 1);
      const i0 = q(p0, 0, 0.13);
      const i1 = q(p1, 0, 0.13);
      const o0 = q(p0, 0.18, 0.13);
      const o1 = q(p1, 0.18, 0.13);
      const g0 = q(p0, 0.22, -0.03);
      const g1 = q(p1, 0.22, -0.03);
      const b0 = q(p0, -0.01, 0.0);
      const b1 = q(p1, -0.01, 0.0);
      B.quad(b0, b1, i1, i0);
      B.quad(i0, i1, o1, o0);
      B.quad(o0, o1, g1, g0);
    }
  }
  if (kind !== 'surface') return;
  // bays: lines 4.8 m long, 2.6 m apart, square to the longest side, kept inside the outline
  let best = 0;
  let ua = null;
  for (let k = 0; k < poly.length; k++) {
    const a = poly[k];
    const b = poly[(k + 1) % poly.length];
    const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (L > best) {
      best = L;
      ua = [a, b];
    }
  }
  if (!ua || best < 6) return;
  const [a, b] = ua;
  const ux = (b[0] - a[0]) / best;
  const uz = (b[1] - a[1]) / best;
  let px = -uz;
  let pz = ux;
  if ((cx - a[0]) * px + (cz - a[1]) * pz < 0) {
    px = -px;
    pz = -pz;
  }
  const inside = (x, z) => {
    let c = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, zi] = poly[i];
      const [xj, zj] = poly[j];
      if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) c = !c;
    }
    return c;
  };
  for (let t = 1.3; t < best - 1; t += 2.6) {
    const s0 = [a[0] + ux * t + px * 0.4, a[1] + uz * t + pz * 0.4];
    const s1 = [s0[0] + px * 4.8, s0[1] + pz * 4.8];
    if (!inside(...s0) || !inside(...s1)) continue;
    const w = 0.06;
    const n = 5;
    let prev = null;
    for (let k = 0; k <= n; k++) {
      const x = s0[0] + (s1[0] - s0[0]) * (k / n);
      const z = s0[1] + (s1[1] - s0[1]) * (k / n);
      const y = field.heightAt(x, z) + 0.065;
      const l = B.v(x - ux * w, y, z - uz * w, 0, 0, LAYER.paint, 0, 1);
      const r = B.v(x + ux * w, y, z + uz * w, 0, 0, LAYER.paint, 0, 1);
      if (prev) B.quad(prev[0], l, r, prev[1]);
      prev = [l, r];
    }
  }
}

export function waysMaterial(env, maps) {
  return new THREE.ShaderMaterial({
    name: 'landscape__ways',
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: { ...env.uniforms, uAlb: { value: maps.alb }, uNrm: { value: maps.nrm }, uShade: { value: maps.shade } },
    vertexShader: /* glsl */ `
      attribute vec3 aSurf;
      varying vec3 vW;
      varying vec3 vN;
      varying vec3 vSurf;
      varying vec2 vUv;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        vN = normalize(mat3(modelMatrix) * normal);
        vSurf = aSurf;
        vUv = uv;
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
      varying vec3 vSurf;
      varying vec2 vUv;
      void main() {
        float layer = floor(vSurf.x + 0.5);
        float edge = vSurf.y;
        // the verge's outer edge breaks up into the ground
        float n = lsNoise(vW.xz * 1.7) * 0.6 + lsNoise(vW.xz * 6.0) * 0.4;
        if (edge > 0.62 + 0.35 * n) discard;
        vec2 uv = vW.xz / 2.0;
        vec3 alb = layer > 8.5 ? vec3(0.78, 0.78, 0.74) * (0.9 + 0.1 * lsNoise(vW.xz * 9.0)) : texture(uAlb, vec3(uv, layer)).rgb;
        vec4 nt = texture(uNrm, vec3(uv, min(layer, 6.0)));
        // verges: the path's grit trodden into the soil
        vec3 soil = texture(uAlb, vec3(uv * 0.9, 2.0)).rgb;
        alb = mix(alb, mix(alb, soil, 0.65), smoothstep(0.1, 0.6, edge));
        vec3 N = normalize(vN);
        if (N.y < 0.0 && abs(N.y) > 0.3) N = -N; // ribbons are built either way round
        if (!gl_FrontFacing && abs(N.y) <= 0.3) N = -N;
        vec3 T = normalize(vec3(1.0, 0.0, 0.0) - N * N.x);
        vec3 B = normalize(cross(T, N));
        vec2 dn = (nt.rg * 2.0 - 1.0) * smoothstep(60.0, 8.0, distance(cameraPosition, vW));
        N = normalize(N + T * dn.x - B * dn.y);
        vec2 fuv = lsFrameUV(vW.xz);
        vec4 sh = texture(uShade, fuv);
        float ao = vSurf.z * mix(0.7, 1.0, nt.b) * sh.g;
        float ndl = max(dot(N, uSunDir), 0.0);
        vec3 col = alb * (uSunColor * ndl * sh.r + uSkyColor * ao * (0.6 + 0.4 * N.y) + uBounce * ao * (0.7 - 0.4 * N.y));
        col = lsFog(col, vW);
        float alpha = 1.0;
        ${OUT}
      }
    `,
  });
}

export function buildWays(ways, field, env, maps) {
  const B = new Builder();
  for (const p of ways.paths || []) {
    const s = surfaceOf(p);
    ribbon(B, field, p.pts, { width: p.width || 1.3, layer: LAYER[s], sunk: s === 'concrete' ? 0.0 : 0.06, verge: s === 'concrete' ? 0.15 : 0.35 });
  }
  for (const r of ways.roads || []) {
    ribbon(B, field, r.pts, { width: r.width || 6, layer: LAYER.bitumen, sunk: 0, verge: 0.12, steps: false });
    kerbs(B, field, r.pts, r.width || 6);
  }
  for (const c of ways.parking || []) if (c.pts.length >= 4) carpark(B, field, c.pts.slice(0, -1), c.kind);
  const mesh = new THREE.Mesh(B.geometry(), waysMaterial(env, maps));
  mesh.name = 'landscape__ways';
  mesh.userData.mrLand = 'ways';
  return mesh;
}
