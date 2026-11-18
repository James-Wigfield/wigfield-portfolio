/* ============================================================================
   PROJECTOR LIFE — the new pointed roof (built at runtime, no re-bake)
   ----------------------------------------------------------------------------
   8 facets from the eave corners (circumradius 2.3596 at y 2.25) to one apex
   (2.18, apex, 2.18). Each facet is one mesh pair:
     under  — the room side (a projection surface, the "ceiling" habitat):
              the patch triangle eave→apex, plus its own plane carried on
              past the wall's outer face (apothem 2.28) to an overhang at
              apothem OVERHANG. Its plane passes exactly through the inner
              wall face's top edge (hidden behind the 16 mm fascia band), and
              from the inner face outward it runs INSIDE the wall slab, so the
              eave closes with no gap and no coplanar faces (no z-fighting).
     top    — the outside sheet: the same pyramid lifted by Δ = t/cos(pitch)
              with t ≥ 0.1·sin(pitch) + 3 cm, so it buries the wall's top lip,
              plus the fascia strip at the overhang.
   Hip battens (one per hip, from the eave corner to a small boss under the
   apex) hang 2.5 cm below the hips. Unlit MeshBasicMaterial throughout, the
   colour in linear vertex colours (material colour white): each facet runs
   from its sector's eave colour to a common apex colour, sampled from the
   OLD roof's bake (paint #efede8 under the night lamp), with a ±3.5 %
   per-facet shade so neighbours read (see ROOF_LOOK).

   setApex() rewrites positions IN PLACE (same vertex counts, same geometry
   and material objects), so the projection's onBeforeCompile patches and
   references stay valid.
   ========================================================================== */

import * as THREE from 'three';
import { SHED, cornerXZ } from './roomModel.js';

const OVERHANG = 2.46; //       apothem of the overhang's edge (outer wall face 2.28 + 18 cm)
const BATTEN_W = 0.06; //       hip batten width
const BATTEN_H = 0.025; //      …and how far it hangs below the hip
const BOSS_R = 0.075; //        apex boss (where the battens meet)
const BOSS_H = 0.06;

/**
 * The look, calibrated against the OLD roof's bake: its underside (paint
 * #efede8) was sampled from the atlas along each facet's centre line
 * (room agent, 2026-11-18): at the eave it bakes to these warm greys, darker
 * on the W/NW/N side, and every sector converges to ≈ (169, 150, 124) at the
 * cap. The new roof is unlit, so its colour IS its baked look: each facet runs
 * from its sector's eave colour to the common apex colour (vertex colours,
 * linear), times a ±3.5 % per-facet shade so neighbouring facets read. The
 * paint colours stay the albedo the projection multiplies its light by.
 */
export const ROOF_LOOK = {
  albedo: '#efede8', //  the old ceiling's paint (the projection's albedo)
  trimAlbedo: '#f1efe9',
  eave: [[156, 142, 117], [156, 138, 112], [167, 150, 126], [173, 158, 134], [170, 152, 125], [154, 136, 111], [148, 133, 109], [152, 137, 113]],
  apex: [169, 150, 124],
  facetShade: (k) => 1 + 0.035 * Math.cos(((k * 45 - 135) * Math.PI) / 180),
  trim: [184, 170, 146], //   battens + boss, a touch brighter than the ceiling (white trim in the same light)
  top: [64, 70, 68], //       the roof sheet from outside, at night (old top paint #5d6662)
};
const lin = (rgb, s = 1) => new THREE.Color().setRGB((rgb[0] / 255) * s, (rgb[1] / 255) * s, (rgb[2] / 255) * s, THREE.SRGBColorSpace);

const [CX, , CZ] = SHED.centre;

function facetFrame(k, apex) {
  const H = SHED.eaveY;
  const A = SHED.apothem;
  const tan = (apex - H) / A;
  const ro = OVERHANG / Math.cos(Math.PI / 8);
  const yo = H - (OVERHANG - A) * tan;
  const cornerOut = (j) => {
    const a = (j * Math.PI) / 4 - Math.PI / 8;
    return [CX + ro * Math.sin(a), yo, CZ - ro * Math.cos(a)];
  };
  const pitch = Math.atan(tan);
  const lift = (0.03 + 0.1 * Math.sin(pitch)) / Math.cos(pitch);
  return {
    eL: cornerXZ(k, H),
    eR: cornerXZ((k + 1) % 8, H),
    oL: cornerOut(k),
    oR: cornerOut((k + 1) % 8),
    apex: [CX, apex, CZ],
    lift,
    tan,
  };
}

/** Write triangles (arrays of 3 points) into a position attribute, fixing winding toward `want`. */
function writeTris(attr, tris, want) {
  const a = attr.array;
  let i = 0;
  for (const t of tris) {
    let [p, q, r] = t;
    const e1 = [q[0] - p[0], q[1] - p[1], q[2] - p[2]];
    const e2 = [r[0] - p[0], r[1] - p[1], r[2] - p[2]];
    const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
    const w = typeof want === 'function' ? want(t) : want;
    if (n[0] * w[0] + n[1] * w[1] + n[2] * w[2] < 0) [q, r] = [r, q];
    for (const v of [p, q, r]) {
      a[i++] = v[0];
      a[i++] = v[1];
      a[i++] = v[2];
    }
  }
  attr.needsUpdate = true;
}

/** Vertex colours: `colors` are THREE.Color (linear) or numbers (a grey scale of `base`). */
function writeColors(attr, colors, base = null) {
  const a = attr.array;
  for (let i = 0; i < colors.length; i++) {
    const c = colors[i];
    const [r, g, b] = typeof c === 'number' ? [base.r * c, base.g * c, base.b * c] : [c.r, c.g, c.b];
    a[i * 3] = r;
    a[i * 3 + 1] = g;
    a[i * 3 + 2] = b;
  }
  attr.needsUpdate = true;
}

function geometry(nVerts) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nVerts * 3), 3));
  g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nVerts * 3).fill(1), 3));
  return g;
}

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => mul(a, 1 / (Math.hypot(...a) || 1));

/** A box along a → b: 12 triangles, colour per face (bottom bright, sides darker, ends darkest). */
function beamTris(a, b, w, h) {
  const d = norm(sub(b, a));
  const side = norm(cross(d, [0, 1, 0]));
  let down = norm(cross(side, d));
  if (down[1] > 0) down = mul(down, -1);
  const c = (p, ss, dd) => add(add(p, mul(side, ss)), mul(down, dd));
  const a0 = c(a, -w / 2, 0), a1 = c(a, w / 2, 0), a2 = c(a, w / 2, h), a3 = c(a, -w / 2, h);
  const b0 = c(b, -w / 2, 0), b1 = c(b, w / 2, 0), b2 = c(b, w / 2, h), b3 = c(b, -w / 2, h);
  const faces = [
    { q: [a3, a2, b2, b3], out: down, shade: 1.0 }, //            bottom (what you see from the room)
    { q: [a1, a2, b2, b1], out: side, shade: 0.82 }, //            sides
    { q: [a0, a3, b3, b0], out: mul(side, -1), shade: 0.82 },
    { q: [a0, a1, a2, a3], out: mul(d, -1), shade: 0.7 }, //      ends
    { q: [b0, b1, b2, b3], out: d, shade: 0.7 },
    { q: [a0, a1, b1, b0], out: mul(down, -1), shade: 0.6 }, //   top (buried in the roof)
  ];
  const tris = [];
  const shades = [];
  for (const f of faces) {
    const [p, q, r, s] = f.q;
    tris.push({ t: [p, q, r], out: f.out }, { t: [p, r, s], out: f.out });
    shades.push(f.shade, f.shade, f.shade, f.shade, f.shade, f.shade);
  }
  return { tris, shades };
}

/** An octagonal boss under the apex where the battens meet: 8 side quads + a bottom fan (24 triangles). */
function bossTris(apex) {
  const tris = [];
  const shades = [];
  const top = apex[1] - 0.004; // tucked just under the apex: never pokes through the sheet
  const bot = apex[1] - BOSS_H;
  const ring = (y) => Array.from({ length: 8 }, (_, j) => {
    const a = (j * Math.PI) / 4 - Math.PI / 8;
    return [CX + BOSS_R * Math.sin(a), y, CZ - BOSS_R * Math.cos(a)];
  });
  const T = ring(top);
  const B = ring(bot);
  for (let j = 0; j < 8; j++) {
    const j1 = (j + 1) % 8;
    const a = (j * Math.PI) / 4;
    const out = [Math.sin(a), 0, -Math.cos(a)];
    tris.push({ t: [B[j], B[j1], T[j1]], out }, { t: [B[j], T[j1], T[j]], out });
    shades.push(0.8, 0.8, 0.8, 0.8, 0.8, 0.8);
    tris.push({ t: [[CX, bot, CZ], B[j], B[j1]], out: [0, -1, 0] });
    shades.push(1, 1, 1);
  }
  return { tris, shades };
}

function writeShaded(geo, list, base) {
  const pos = geo.attributes.position;
  let i = 0;
  const a = pos.array;
  for (const { t, out } of list.tris) {
    let [p, q, r] = t;
    const n = cross(sub(q, p), sub(r, p));
    if (n[0] * out[0] + n[1] * out[1] + n[2] * out[2] < 0) [q, r] = [r, q];
    for (const v of [p, q, r]) {
      a[i++] = v[0];
      a[i++] = v[1];
      a[i++] = v[2];
    }
  }
  pos.needsUpdate = true;
  writeColors(geo.attributes.color, list.shades, base);
}

export function createRoof({ apex = SHED.apex.default } = {}) {
  const group = new THREE.Group();
  group.name = 'pjl-roof';
  const trim = lin(ROOF_LOOK.trim);
  const apexCol = lin(ROOF_LOOK.apex);

  const facets = [];
  for (let k = 0; k < 8; k++) {
    // Colours live in the vertex colours (linear); the material colour stays white.
    const underMat = new THREE.MeshBasicMaterial({ name: `pjl-roof-under-${k}`, vertexColors: true });
    const topMat = new THREE.MeshBasicMaterial({ name: `pjl-roof-top-${k}`, vertexColors: true });
    const under = new THREE.Mesh(geometry(9), underMat); //  patch triangle + overhang (2)
    const top = new THREE.Mesh(geometry(9), topMat); //      top triangle + fascia (2)
    under.name = `pjl-roof-${k}`;
    top.name = `pjl-roof-top-${k}`;
    group.add(under, top);
    facets.push({ k, under, top });
  }
  const battens = [];
  for (let j = 0; j < 8; j++) {
    const mat = new THREE.MeshBasicMaterial({ name: `pjl-roof-hip-${j}`, vertexColors: true });
    const mesh = new THREE.Mesh(geometry(36), mat);
    mesh.name = `pjl-roof-hip-${j}`;
    group.add(mesh);
    battens.push({ j, mesh });
  }
  const bossMat = new THREE.MeshBasicMaterial({ name: 'pjl-roof-boss', vertexColors: true });
  const boss = new THREE.Mesh(geometry(72), bossMat);
  boss.name = 'pjl-roof-boss';
  group.add(boss);

  function setApex(y) {
    for (const f of facets) {
      const F = facetFrame(f.k, y);
      const inward = norm([CX - (F.eL[0] + F.eR[0]) / 2, 0, CZ - (F.eL[2] + F.eR[2]) / 2]);
      // underside normal: down and toward the centre (= the patch's inward normal)
      const nIn = norm([inward[0] * F.tan, -1, inward[2] * F.tan]);
      writeTris(f.under.geometry.attributes.position, [
        [F.eL, F.eR, F.apex],
        [F.oL, F.oR, F.eR],
        [F.oL, F.eR, F.eL],
      ], nIn);
      // eave colour of this sector → the common apex colour (the overhang keeps the eave colour)
      const shade = ROOF_LOOK.facetShade(f.k);
      const eaveCol = lin(ROOF_LOOK.eave[f.k], shade);
      const apexK = apexCol.clone().multiplyScalar(shade);
      const s = (p) => (p === F.apex ? apexK : eaveCol);
      writeColors(f.under.geometry.attributes.color, [F.eL, F.eR, F.apex, F.oL, F.oR, F.eR, F.oL, F.eR, F.eL].map(s));
      const up = [0, F.lift, 0];
      const tA = add(F.apex, up);
      const tL = add(F.oL, up);
      const tR = add(F.oR, up);
      const nOut = mul(nIn, -1);
      const out = mul(inward, -1);
      writeTris(f.top.geometry.attributes.position, [
        [tL, tR, tA],
        [F.oL, F.oR, tR],
        [F.oL, tR, tL],
      ], (t) => (t[0] === tL ? nOut : out));
      writeColors(f.top.geometry.attributes.color, [1, 1, 1, 0.72, 0.72, 0.72, 0.72, 0.72, 0.72].map((v) => v * shade), lin(ROOF_LOOK.top));
      f.under.geometry.computeBoundingSphere();
      f.top.geometry.computeBoundingSphere();
    }
    const apexP = [CX, y, CZ];
    for (const b of battens) {
      const e = cornerXZ(b.j, SHED.eaveY);
      const d = sub(apexP, e);
      const L = Math.hypot(...d);
      const a = add(e, mul(d, 0.015 / L)); //               start just off the wall corner
      const z = add(e, mul(d, (L - BOSS_R * 0.6) / L)); //   end inside the boss
      writeShaded(b.mesh.geometry, beamTris(a, z, BATTEN_W, BATTEN_H), trim);
      b.mesh.geometry.computeBoundingSphere();
    }
    writeShaded(boss.geometry, bossTris(apexP), trim);
    boss.geometry.computeBoundingSphere();
  }
  setApex(apex);

  return {
    group,
    facets, //   [{ k, under, top }]
    battens, //  [{ j, mesh }] — hip j sits on corner j, between facet j−1 and facet j
    boss,
    setApex,
    /** Meshes that receive projector light (the room side). */
    surfaces: () => [...facets.map((f) => f.under), ...battens.map((b) => b.mesh), boss],
    dispose() {
      group.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        o.material.dispose();
      });
      group.removeFromParent();
    },
  };
}
