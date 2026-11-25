/* Dream Rooms · the grey box. Two stand-ins built in JS with the same node names
   as the real GLBs, so the viewer never needs a special path:

     greyboxDream(world) → Group      the §6 contract (M_/__shell/P_/S_/W_/F_/D_ nodes)
     greyboxKit()        → Group      the §7 corridor kit (K_entrance … K_underline)

   Used before the Blender kit has baked anything, when a GLB fails to load, and by
   the dev harness (`&greybox=1`). Everything is flat colour with a little vertex
   shading standing in for the bake: plain, grey, fogged (decision 9's "invented"
   look), never a finished space. */

import * as THREE from 'three';
import { DIMS, STUB, DOOR, wallInfo, doorwayFrame, add, mul, leftOf } from '../contracts/layout.js';

const C = DIMS.corridor;

/* ── a tiny geometry builder (positions + vertex colours) ─────────────────── */

function builder() {
  const pos = [];
  const col = [];
  const idx = [];
  const api = {
    /** a quad p0..p3 (counter-clockwise seen from its front), with a colour per corner */
    quad(p, c) {
      const base = pos.length / 3;
      for (let k = 0; k < 4; k++) {
        pos.push(p[k][0], p[k][1], p[k][2]);
        const ck = Array.isArray(c) && c[k]?.isColor ? c[k] : c;
        col.push(ck.r, ck.g, ck.b);
      }
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
      return api;
    },
    empty: () => idx.length === 0,
    geometry() {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      g.computeBoundingBox();
      return g;
    },
  };
  return api;
}

const vmat = () => new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: true });
const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Wall shading standing in for a bake: darker at the skirting, a soft sourceless band, dim at the top. */
function wallShade(base, y, h, glow = 1) {
  const up = 0.58 + 0.42 * smoothstep(0, Math.min(1.4, h * 0.5), y);
  const top = 1 - 0.28 * smoothstep(h * 0.62, h, y);
  return base.clone().multiplyScalar(up * top * glow);
}

/**
 * A wall on a plane: from p0 running `along` for `length`, `h` tall, with openings
 * [{ from, to, top }] (metres along the wall). Rows break at the opening tops and a
 * couple of heights so the vertex shading has somewhere to live.
 */
function wall(B, p0, along, length, h, openings, base, { glow = 1, rows = null, fade = null } = {}) {
  const xs = new Set([0, length]);
  for (const o of openings) {
    xs.add(Math.max(0, o.from));
    xs.add(Math.min(length, o.to));
  }
  const cols = [...xs].sort((a, b) => a - b);
  const ys = new Set(rows || [0, Math.min(h, 0.45), Math.min(h, 1.5), h * 0.75, h]);
  for (const o of openings) ys.add(Math.min(h, o.top));
  const rowsY = [...ys].filter((y) => y <= h).sort((a, b) => a - b);
  const P = (s, y) => [p0[0] + along[0] * s, y, p0[2] + along[2] * s];
  const shade = (s, y) => {
    const c = wallShade(base, y, h, glow);
    return fade ? c.multiplyScalar(fade(s)) : c;
  };
  for (let i = 0; i < cols.length - 1; i++) {
    const s0 = cols[i];
    const s1 = cols[i + 1];
    if (s1 - s0 < 1e-4) continue;
    const mid = (s0 + s1) / 2;
    const hole = openings.find((o) => mid > o.from && mid < o.to);
    for (let j = 0; j < rowsY.length - 1; j++) {
      const y0 = rowsY[j];
      const y1 = rowsY[j + 1];
      if (y1 - y0 < 1e-4) continue;
      if (hole && (y0 + y1) / 2 < hole.top) continue;
      B.quad([P(s0, y0), P(s1, y0), P(s1, y1), P(s0, y1)], [shade(s0, y0), shade(s1, y0), shade(s1, y1), shade(s0, y1)]);
    }
  }
}

/** A horizontal rectangle (x0..x1, z0..z1) at y, darker toward its edges when `edge` > 0. */
function slab(B, x0, x1, z0, z1, y, base, { edge = 0.6, dark = 0.72, fade = null } = {}) {
  const xs = [x0, Math.min(x1, x0 + edge), Math.max(x0, x1 - edge), x1].sort((a, b) => a - b);
  const zs = [z0, Math.min(z1, z0 + edge), Math.max(z0, z1 - edge), z1].sort((a, b) => a - b);
  const shade = (x, z) => {
    const ex = x <= x0 + 1e-6 || x >= x1 - 1e-6;
    const ez = z <= z0 + 1e-6 || z >= z1 - 1e-6;
    const c = base.clone().multiplyScalar(ex || ez ? dark : 1);
    return fade ? c.multiplyScalar(fade(x, z)) : c;
  };
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const a = xs[i];
      const b = xs[i + 1];
      const c = zs[j];
      const d = zs[j + 1];
      if (b - a < 1e-4 || d - c < 1e-4) continue;
      B.quad([[a, y, c], [b, y, c], [b, y, d], [a, y, d]], [shade(a, c), shade(b, c), shade(b, d), shade(a, d)]);
    }
  }
}

/** A box (centre, size, rotation about y) as six quads. */
function box(B, centre, size, yaw, base, { shadeTop = 1.06, shadeSide = 0.86 } = {}) {
  const [sx, sy, sz] = size.map((v) => v / 2);
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const P = (x, y, z) => [centre[0] + x * c + z * s, centre[1] + y, centre[2] - x * s + z * c];
  const top = base.clone().multiplyScalar(shadeTop);
  const side = base.clone().multiplyScalar(shadeSide);
  const low = base.clone().multiplyScalar(0.62);
  const faces = [
    [P(-sx, -sy, sz), P(sx, -sy, sz), P(sx, sy, sz), P(-sx, sy, sz), [low, low, base, base]],
    [P(sx, -sy, -sz), P(-sx, -sy, -sz), P(-sx, sy, -sz), P(sx, sy, -sz), [low, low, base, base]],
    [P(sx, -sy, sz), P(sx, -sy, -sz), P(sx, sy, -sz), P(sx, sy, sz), [low, low, side, side]],
    [P(-sx, -sy, -sz), P(-sx, -sy, sz), P(-sx, sy, sz), P(-sx, sy, -sz), [low, low, side, side]],
    [P(-sx, sy, sz), P(sx, sy, sz), P(sx, sy, -sz), P(-sx, sy, -sz), top],
  ];
  for (const f of faces) B.quad(f.slice(0, 4), f[4]);
}

/** A vertical rectangle on a wall: centre point on the wall plane, the wall's along axis, w × h, pushed `off` into the room. */
function plate(B, centre, along, inward, w, h, base, off = 0.01) {
  const o = mul(inward, off);
  const a = mul(along, w / 2);
  const p = (sa, y) => add(add(add(centre, o), mul(a, sa)), [0, y, 0]);
  B.quad([p(-1, -h / 2), p(1, -h / 2), p(1, h / 2), p(-1, h / 2)], base);
}

/** The Z-stub behind a doorway frame (world or piece coordinates): floor, ceiling, walls; dimmer further in. */
function stub(B, f, colors) {
  const h = STUB.width / 2;
  const H = STUB.height;
  const P0 = f.centre;
  const P1 = f.b1;
  const P2 = f.b2;
  const P3 = f.b3;
  const { out, side } = f;
  const at = (p, a, b) => add(add(p, mul(side, a)), mul(out, b));
  const L = [at(P0, h, 0), at(P1, h, -h), at(P2, h, -h), at(P3, h, 0)];
  const R = [at(P0, -h, 0), at(P1, -h, h), at(P2, -h, h), at(P3, -h, 0)];
  // how far along the stub each corner is (0 at the doorway → 1 at the dead end) → dimmer
  const total = STUB.leg1 + STUB.leg2 + STUB.leg3;
  const dist = [0, STUB.leg1, STUB.leg1 + STUB.leg2, total];
  const dim = (k) => 0.95 - 0.6 * (dist[k] / total);
  const wallRun = (pts) => {
    for (let k = 0; k < 3; k++) {
      const a = pts[k];
      const b = pts[k + 1];
      const ca = colors.wall.clone().multiplyScalar(dim(k));
      const cb = colors.wall.clone().multiplyScalar(dim(k + 1));
      const lo = 0.6;
      B.quad([[a[0], 0, a[2]], [b[0], 0, b[2]], [b[0], H, b[2]], [a[0], H, a[2]]], [ca.clone().multiplyScalar(lo), cb.clone().multiplyScalar(lo), cb, ca]);
    }
  };
  wallRun(L);
  wallRun(R);
  // the dead end
  const ce = colors.wall.clone().multiplyScalar(dim(3) * 0.9);
  B.quad([[L[3][0], 0, L[3][2]], [R[3][0], 0, R[3][2]], [R[3][0], H, R[3][2]], [L[3][0], H, L[3][2]]], ce);
  // floor and ceiling: one quad per leg
  const legs = [
    [P0, add(P1, mul(out, h)), out, 0, 1],
    [add(P1, mul(side, -h)), add(P2, mul(side, h)), side, 1, 2],
    [add(P2, mul(out, -h)), P3, out, 2, 3],
  ];
  for (const [a, b, dir, ka, kb] of legs) {
    const n = leftOf(dir);
    const q = [add(a, mul(n, h)), add(b, mul(n, h)), add(b, mul(n, -h)), add(a, mul(n, -h))];
    const fa = colors.floor.clone().multiplyScalar(dim(ka));
    const fb = colors.floor.clone().multiplyScalar(dim(kb));
    B.quad(q.map((p) => [p[0], 0.001, p[2]]), [fa, fb, fb, fa]);
    const ca = colors.ceiling.clone().multiplyScalar(dim(ka) * 0.8);
    const cb = colors.ceiling.clone().multiplyScalar(dim(kb) * 0.8);
    B.quad(q.map((p) => [p[0], H, p[2]]), [ca, cb, cb, ca]);
  }
}

/* ── finishes → colours ─────────────────────────────────────────────────── */

const FINISH_DEFAULT = {
  carpet: '#5b5a55', tile: '#a4aca8', terrazzo: '#a9a49a', 'painted-block': '#9c9890', wallpaper: '#8f8a7c',
  timber: '#7a644c', linoleum: '#8b8a7c', water: '#5f7a7c', plain: '#86847e',
};

function finishColor(f, fallback) {
  if (!f) return new THREE.Color(fallback);
  return new THREE.Color(f.color || FINISH_DEFAULT[f.is] || fallback);
}

function moduleColors(world, m) {
  const fin = m.finishes || {};
  const warm = world.look?.warmth ?? 0.5;
  const tint = new THREE.Color(1 + (warm - 0.5) * 0.08, 1, 1 - (warm - 0.5) * 0.14);
  const light = m.lights?.is || 'glow';
  const k = light === 'none' ? 0.55 : light === 'windows' ? 0.8 : 1;
  const mk = (c) => c.multiply(tint).multiplyScalar(k);
  return {
    floor: mk(finishColor(fin.floor, '#6e6c66').multiplyScalar(0.8)),
    wall: mk(finishColor(fin.walls, '#8c8a84')),
    ceiling: mk(finishColor(fin.ceiling, m.ceiling?.is === 'high-dark' ? '#3a3936' : '#7c7a74').multiplyScalar(0.78)),
    glow: light === 'glow' ? 1.12 : 1,
  };
}

/* ── greyboxDream ───────────────────────────────────────────────────────── */

function emptyNode(name, extras = {}) {
  const o = new THREE.Object3D();
  o.name = name;
  Object.assign(o.userData, extras);
  return o;
}

function surfaceNode(name, extras, centre, normal, w, h, up = [0, 1, 0]) {
  const g = new THREE.PlaneGeometry(w, h);
  const mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ visible: false }));
  mesh.name = name;
  Object.assign(mesh.userData, extras, { w, h });
  mesh.position.set(...centre);
  const n = new THREE.Vector3(...normal).normalize();
  const u = new THREE.Vector3(...up).normalize();
  const r = new THREE.Vector3().crossVectors(u, n).normalize();
  const uu = new THREE.Vector3().crossVectors(n, r).normalize();
  mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(r, uu, n));
  return mesh;
}

/** Where along a wall something of `len` fits, as far as possible from the doorways on it. */
function freeSpot(wallLen, len, taken, prefer = wallLen / 2) {
  let best = prefer;
  let bestScore = -Infinity;
  for (let s = len / 2 + 0.3; s <= wallLen - len / 2 - 0.3; s += 0.25) {
    let gap = Infinity;
    for (const t of taken) gap = Math.min(gap, Math.abs(s - t.at) - len / 2 - t.half);
    const score = Math.min(gap, 3) - Math.abs(s - prefer) * 0.05;
    if (score > bestScore) {
      bestScore = score;
      best = s;
    }
  }
  return best;
}

export function greyboxDream(world) {
  const root = new THREE.Group();
  root.name = 'greybox';
  const wordsOn = new Set((world.words || []).map((w) => w.on));
  for (const m of world.modules) {
    const M = new THREE.Group();
    M.name = `M_${m.id}`;
    M.userData = { dr: 'module', module: m.id };
    root.add(M);
    const [w, h, d] = m.size;
    const o = m.origin;
    const colors = moduleColors(world, m);
    const scale = m.scale || 1;
    const B = builder();
    const doorways = (world.doorways || []).filter((dw) => dw.module === m.id);
    const frames = doorways.map((dw) => doorwayFrame(world, dw));
    const taken = { n: [], s: [], e: [], w: [] };
    doorways.forEach((dw) => taken[dw.wall].push({ at: dw.at, half: DOOR.w / 2 + 0.2 }));

    // decorative numbered doors (corridor kit) are openings-without-stubs: a shut leaf in a recess
    const deco = [];
    if (m.kit === 'corridor' && m.doors?.count) {
      const sides = m.doors.sides === 'e' ? ['e'] : m.doors.sides === 'w' ? ['w'] : ['w', 'e'];
      for (let k = 0; k < m.doors.count; k++) {
        let side = sides[k % sides.length];
        let at = ((k + 0.5) * d) / m.doors.count;
        const clash = (sd, a) => taken[sd].some((t) => Math.abs(a - t.at) < t.half + 0.6);
        if (clash(side, at) && sides.length > 1) side = sides[(k + 1) % sides.length];
        for (let tries = 0; tries < 6 && clash(side, at); tries++) at = Math.min(d - 0.8, Math.max(0.8, at + (tries % 2 ? -1.3 : 1.3)));
        taken[side].push({ at, half: 0.7 });
        deco.push({ k, side, at });
      }
    }

    // walls (repeat corridors are open at n and s)
    const walls = m.repeat ? ['w', 'e'] : ['n', 's', 'w', 'e'];
    for (const side of walls) {
      const info = wallInfo(side, m.size);
      const p0 = add(o, info.point(0));
      const openings = doorways.filter((dw) => dw.wall === side).map((dw) => ({ from: dw.at - DOOR.w / 2, to: dw.at + DOOR.w / 2, top: DOOR.h }));
      wall(B, p0, info.along, info.length, h, openings, colors.wall, { glow: colors.glow });
      // door frames: a slightly darker reveal round each real opening
      for (const op of openings) {
        const c = add(p0, mul(info.along, (op.from + op.to) / 2));
        const dark = colors.wall.clone().multiplyScalar(0.5);
        const jh = (DOOR.h + 0.07) / 2;
        plate(B, add(c, add(mul(info.along, -0.54), [0, jh, 0])), info.along, info.inward, 0.07, DOOR.h + 0.07, dark, 0.012);
        plate(B, add(c, add(mul(info.along, 0.54), [0, jh, 0])), info.along, info.inward, 0.07, DOOR.h + 0.07, dark, 0.012);
        plate(B, add(c, [0, DOOR.h + 0.035, 0]), info.along, info.inward, 1.15, 0.07, dark, 0.012);
      }
    }
    // floor and ceiling (a pool's floor is a ring round the water)
    if (m.kit === 'pool') {
      const e = 1.6;
      const fx = [o[0], o[0] + e, o[0] + w - e, o[0] + w];
      const fz = [o[2], o[2] + e, o[2] + d - e, o[2] + d];
      slab(B, fx[0], fx[3], fz[0], fz[1], 0, colors.floor, { edge: 0.3 });
      slab(B, fx[0], fx[3], fz[2], fz[3], 0, colors.floor, { edge: 0.3 });
      slab(B, fx[0], fx[1], fz[1], fz[2], 0, colors.floor, { edge: 0.3 });
      slab(B, fx[2], fx[3], fz[1], fz[2], 0, colors.floor, { edge: 0.3 });
      // the basin's lip
      const lip = colors.floor.clone().multiplyScalar(0.6);
      B.quad([[fx[1], -0.35, fz[1]], [fx[2], -0.35, fz[1]], [fx[2], 0, fz[1]], [fx[1], 0, fz[1]]], lip);
      B.quad([[fx[1], -0.35, fz[2]], [fx[2], -0.35, fz[2]], [fx[2], 0, fz[2]], [fx[1], 0, fz[2]]], lip);
      B.quad([[fx[1], -0.35, fz[1]], [fx[1], -0.35, fz[2]], [fx[1], 0, fz[2]], [fx[1], 0, fz[1]]], lip);
      B.quad([[fx[2], -0.35, fz[1]], [fx[2], -0.35, fz[2]], [fx[2], 0, fz[2]], [fx[2], 0, fz[1]]], lip);
      const wb = builder();
      wb.quad([[fx[1], -0.06, fz[1]], [fx[2], -0.06, fz[1]], [fx[2], -0.06, fz[2]], [fx[1], -0.06, fz[2]]], finishColor(m.finishes?.water, '#5f7a7c'));
      const water = new THREE.Mesh(wb.geometry(), vmat());
      water.name = `W_${m.id}`;
      water.userData = { dr: 'water', module: m.id, id: 'water' };
      M.add(water);
      if (wordsOn.has(`${m.id}/water`)) {
        const ww = Math.min(6, w - 2 * e - 1);
        M.add(surfaceNode(`S_${m.id}__water`, { dr: 'surface', module: m.id, id: 'water' }, [o[0] + w / 2, -0.05, o[2] + d * 0.45], [0, 1, 0], ww, 1.1, [0, 0, 1]));
      }
    } else {
      slab(B, o[0], o[0] + w, o[2], o[2] + d, 0, colors.floor, { edge: m.repeat ? 0.35 : 0.8, dark: 0.7 });
    }
    if (m.ceiling?.is !== 'none') slab(B, o[0], o[0] + w, o[2], o[2] + d, h, colors.ceiling, { edge: 0.5, dark: 0.75 });

    // columns in a big hall
    if (m.kit === 'hall' && w * d > 150) {
      const col = colors.wall.clone().multiplyScalar(0.92);
      for (let x = 6; x < w - 3; x += 6) {
        for (let z = 5; z < d - 3; z += 6) box(B, [o[0] + x, h / 2, o[2] + z], [0.55, h, 0.55], 0, col);
      }
    }

    // stubs
    for (const f of frames) stub(B, f, colors);

    // decorative doors + their signs
    const decoB = builder();
    for (const dd of deco) {
      const info = wallInfo(dd.side, m.size);
      const c = add(o, info.point(dd.at));
      const leaf = colors.wall.clone().multiplyScalar(0.55).lerp(new THREE.Color('#5a4632'), 0.5);
      const p = (sa, y, off) => add(add(c, mul(info.along, sa)), add([0, y, 0], mul(info.inward, off)));
      decoB.quad([p(-0.48, 0, 0.012), p(0.48, 0, 0.012), p(0.48, 2.05, 0.012), p(-0.48, 2.05, 0.012)], [leaf.clone().multiplyScalar(0.7), leaf.clone().multiplyScalar(0.7), leaf, leaf]);
      const frameC = colors.wall.clone().multiplyScalar(0.62);
      decoB.quad([p(-0.56, 0, 0.016), p(-0.48, 0, 0.016), p(-0.48, 2.12, 0.016), p(-0.56, 2.12, 0.016)], frameC);
      decoB.quad([p(0.48, 0, 0.016), p(0.56, 0, 0.016), p(0.56, 2.12, 0.016), p(0.48, 2.12, 0.016)], frameC);
      decoB.quad([p(-0.56, 2.05, 0.016), p(0.56, 2.05, 0.016), p(0.56, 2.12, 0.016), p(-0.56, 2.12, 0.016)], frameC);
      // the sign plate the number is drawn on
      const plateC = colors.wall.clone().multiplyScalar(1.15);
      decoB.quad([p(-0.2, 2.17, 0.014), p(0.2, 2.17, 0.014), p(0.2, 2.39, 0.014), p(-0.2, 2.39, 0.014)], plateC);
      M.add(surfaceNode(`S_${m.id}__doors-sign-${dd.k}`, { dr: 'surface', module: m.id, id: `doors-sign-${dd.k}` }, add(add(c, [0, 2.28, 0]), mul(info.inward, 0.016)), info.inward, 0.38, 0.2));
    }
    if (!decoB.empty()) {
      const dm = new THREE.Mesh(decoB.geometry(), vmat());
      dm.name = `M_${m.id}__shell_1`;
      dm.userData = { dr: 'shell', module: m.id };
      M.add(dm);
    }

    // props
    for (const p of m.props || []) {
      const pb = builder();
      const pid = `${m.id}__${p.id}`;
      let anchor = null;
      let info = null;
      if (p.wall) {
        info = wallInfo(p.wall, m.size);
        anchor = add(o, info.point(p.at ?? info.length / 2));
      } else if (p.pos) anchor = add(o, p.pos);
      else anchor = add(o, [w / 2, 0, d / 2]);
      const yaw = info ? Math.atan2(info.inward[0], info.inward[2]) : ((p.rotY || 0) * Math.PI) / 180;
      const base = new THREE.Color(p.color || '#7d827c').multiplyScalar(0.9);
      let surface = null;
      if (p.kit === 'locker-bank') {
        const len = Math.min((p.length || 4) * 1, info ? info.length - 0.4 : 20);
        const hh = 1.85 * scale;
        const dep = 0.5 * scale;
        box(pb, add(add(anchor, mul(info?.inward || [0, 0, 1], dep / 2 + 0.01)), [0, hh / 2, 0]), [len, hh, dep], yaw, base);
        // the door seams of the lockers
        const seam = base.clone().multiplyScalar(0.55);
        const n = Math.max(2, Math.round(len / (0.42 * scale)));
        for (let k = 1; k < n; k++) {
          const s = -len / 2 + (k * len) / n;
          const c0 = add(add(anchor, mul(info.along, s)), mul(info.inward, dep + 0.014));
          plate(pb, add(c0, [0, hh / 2, 0]), info.along, info.inward, 0.018, hh * 0.96, seam, 0);
        }
      } else if (p.kit === 'board') {
        const bw = 2.4 * scale;
        const bh = 1.05 * scale;
        const yc = 1.95 * scale;
        plate(pb, add(anchor, [0, yc, 0]), info?.along || [1, 0, 0], info?.inward || [0, 0, 1], bw, bh, new THREE.Color('#262a2a'), 0.02);
        surface = { centre: add(add(anchor, [0, yc, 0]), mul(info?.inward || [0, 0, 1], 0.025)), normal: info?.inward || [0, 0, 1], w: bw * 0.9, h: bh * 0.8 };
      } else if (p.kit === 'sign') {
        const yc = 2.25 * scale;
        plate(pb, add(anchor, [0, yc, 0]), info?.along || [1, 0, 0], info?.inward || [0, 0, 1], 0.9 * scale, 0.36 * scale, colors.wall.clone().multiplyScalar(1.2), 0.02);
        surface = { centre: add(add(anchor, [0, yc, 0]), mul(info?.inward || [0, 0, 1], 0.024)), normal: info?.inward || [0, 0, 1], w: 0.84 * scale, h: 0.3 * scale };
      } else if (p.kit === 'window-dark') {
        const count = p.count || 1;
        const len = info ? Math.min(info.length - 1, count * 2.6) : 3;
        for (let k = 0; k < count; k++) {
          const s = -len / 2 + ((k + 0.5) * len) / count;
          const c0 = add(anchor, mul(info?.along || [1, 0, 0], s));
          plate(pb, add(c0, [0, 1.0 + 0.95 * scale, 0]), info?.along || [1, 0, 0], info?.inward || [0, 0, 1], 1.5 * scale, 1.9 * scale, colors.wall.clone().multiplyScalar(0.55), 0.008);
          plate(pb, add(c0, [0, 1.0 + 0.95 * scale, 0]), info?.along || [1, 0, 0], info?.inward || [0, 0, 1], 1.36 * scale, 1.76 * scale, new THREE.Color('#0b0e14'), 0.012);
        }
      } else if (p.kit === 'chair') {
        const c0 = info ? add(anchor, mul(info.inward, 0.6)) : anchor;
        box(pb, add(c0, [0, 0.45 * scale, 0]), [0.46 * scale, 0.05, 0.46 * scale], yaw, base);
        box(pb, add(add(c0, [0, 0.72 * scale, 0]), mul(info?.inward || [0, 0, 1], -0.21 * scale)), [0.46 * scale, 0.5 * scale, 0.04], yaw, base);
        for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) box(pb, add(c0, [a * 0.2 * scale, 0.22 * scale, b * 0.2 * scale]), [0.035, 0.44 * scale, 0.035], yaw, base.clone().multiplyScalar(0.6));
      } else if (p.kit === 'door') {
        plate(pb, add(anchor, [0, 1.05 * scale, 0]), info?.along || [1, 0, 0], info?.inward || [0, 0, 1], 0.95 * scale, 2.1 * scale, colors.wall.clone().multiplyScalar(0.6), 0.012);
      } else if (p.kit === 'light-panel') {
        const c0 = p.pos ? add(o, p.pos) : add(o, [w / 2, h - 0.01, d / 2]);
        const F = builder();
        F.quad([[c0[0] - 0.3, h - 0.012, c0[2] - 0.6], [c0[0] + 0.3, h - 0.012, c0[2] - 0.6], [c0[0] + 0.3, h - 0.012, c0[2] + 0.6], [c0[0] - 0.3, h - 0.012, c0[2] + 0.6]], new THREE.Color(1.0, 0.98, 0.9));
        const fm = new THREE.Mesh(F.geometry(), vmat());
        fm.name = `F_${m.id}__p${p.id}`;
        fm.userData = { dr: 'fixture', module: m.id, id: p.id };
        M.add(fm);
        continue;
      }
      if (pb.empty() && !surface) continue;
      const P = new THREE.Group();
      P.name = `P_${pid}`;
      P.userData = { dr: 'prop', module: m.id, id: p.id };
      // the prop's node sits at its anchor; its geometry is built in world space, so shift it back
      P.position.set(...anchor);
      if (!pb.empty()) {
        const g = pb.geometry();
        g.translate(-anchor[0], -anchor[1], -anchor[2]);
        const pm = new THREE.Mesh(g, vmat());
        pm.name = `P_${pid}_mesh`;
        P.add(pm);
      }
      M.add(P);
      if (surface) M.add(surfaceNode(`S_${pid}`, { dr: 'surface', module: m.id, id: p.id }, surface.centre, surface.normal, surface.w, surface.h));
    }

    // fixture panels along the ceiling
    if (m.lights?.is === 'panels') {
      let k = 0;
      const step = 2.7;
      const along = d >= w ? 'z' : 'x';
      const len = along === 'z' ? d : w;
      const across = along === 'z' ? w : d;
      const rows = Math.max(1, Math.round(across / 4));
      for (let s = step / 2; s < len; s += step) {
        for (let r = 0; r < rows; r++) {
          const a = ((r + 0.5) * across) / rows;
          const cxp = along === 'z' ? o[0] + a : o[0] + s;
          const czp = along === 'z' ? o[2] + s : o[2] + a;
          const F = builder();
          const hx = along === 'z' ? 0.3 : 0.6;
          const hz = along === 'z' ? 0.6 : 0.3;
          F.quad([[cxp - hx, h - 0.012, czp - hz], [cxp + hx, h - 0.012, czp - hz], [cxp + hx, h - 0.012, czp + hz], [cxp - hx, h - 0.012, czp + hz]], new THREE.Color(0.98, 1.0, 0.9));
          const fm = new THREE.Mesh(F.geometry(), vmat());
          fm.name = `F_${m.id}__${k}`;
          fm.userData = { dr: 'fixture', module: m.id, id: String(k) };
          M.add(fm);
          k += 1;
        }
      }
    }

    // text surfaces for words on walls / the floor
    for (const side of ['n', 's', 'e', 'w']) {
      if (!wordsOn.has(`${m.id}/wall-${side}`)) continue;
      const info = wallInfo(side, m.size);
      const sw = Math.min(4.2, info.length * 0.6);
      const at = freeSpot(info.length, sw, taken[side]);
      const c = add(add(o, info.point(at)), [0, 1.62, 0]);
      M.add(surfaceNode(`S_${m.id}__wall-${side}`, { dr: 'surface', module: m.id, id: `wall-${side}` }, add(c, mul(info.inward, 0.004)), info.inward, sw, 0.62));
    }
    if (wordsOn.has(`${m.id}/floor`)) {
      M.add(surfaceNode(`S_${m.id}__floor`, { dr: 'surface', module: m.id, id: 'floor' }, [o[0] + w / 2, 0.004, o[2] + d / 2], [0, 1, 0], Math.min(3.5, w * 0.6), 1.0, [0, 0, -1]));
    }

    // doorway empties (+z = inward)
    for (const f of frames) {
      const D = emptyNode(`D_${m.id}__${f.id}`, { dr: 'doorway', module: m.id, id: f.id });
      D.position.set(...f.centre);
      D.rotation.y = Math.atan2(f.inward[0], f.inward[2]);
      M.add(D);
    }

    const shell = new THREE.Mesh(B.geometry(), vmat());
    shell.name = `M_${m.id}__shell`;
    shell.userData = { dr: 'shell', module: m.id };
    M.add(shell);
  }
  return root;
}

/* ── greyboxKit: the corridor pieces (§7) ───────────────────────────────── */

const BAY_NARROW = 0.6; // the bay's narrow ends, as the Blender kit builds them

const KIT_COL = {
  wall: new THREE.Color('#857869'),
  floor: new THREE.Color('#3a3029'),
  ceiling: new THREE.Color('#4f473e'),
  trim: new THREE.Color('#4a4037'),
  leaf: new THREE.Color('#4e3c2f'),
};

function kitPiece(name, length, { width = C.width, doors = [], back = false, endWall = null, fadeEnd = false, bay = false } = {}) {
  const B = builder();
  const hw = width / 2;
  const H = C.height;
  const fade = fadeEnd ? (s) => Math.max(0, 1 - s / length) ** 1.4 : null;
  const fadeZ = fadeEnd ? (x, z) => Math.max(0, 1 + z / length) ** 1.4 : null;
  if (bay) {
    // narrow ends at corridor width (so the bay tiles, as the Blender kit's does), the wide bay between
    const nw = C.width / 2;
    const a = -BAY_NARROW;
    const b = -length + BAY_NARROW;
    for (const [z0, z1] of [[a, 0], [-length, b]]) {
      slab(B, -nw, nw, z0, z1, 0, KIT_COL.floor, { edge: 0.3, dark: 0.7 });
      slab(B, -nw, nw, z0, z1, H, KIT_COL.ceiling, { edge: 0.3, dark: 0.75 });
      wall(B, [-nw, 0, z1], [0, 0, -1], z1 - z0, H, [], KIT_COL.wall);
      wall(B, [nw, 0, z1], [0, 0, -1], z1 - z0, H, [], KIT_COL.wall);
    }
    slab(B, -hw, hw, b, a, 0, KIT_COL.floor, { edge: 0.3, dark: 0.7 });
    slab(B, -hw, hw, b, a, H, KIT_COL.ceiling, { edge: 0.3, dark: 0.75 });
    wall(B, [-hw, 0, a], [0, 0, -1], a - b, H, [], KIT_COL.wall);
    wall(B, [hw, 0, a], [0, 0, -1], a - b, H, [], KIT_COL.wall);
    const step = KIT_COL.wall.clone().multiplyScalar(0.8);
    for (const z of [a, b]) {
      wall(B, [-hw, 0, z], [1, 0, 0], hw - nw, H, [], step);
      wall(B, [nw, 0, z], [1, 0, 0], hw - nw, H, [], step);
    }
    const mesh = new THREE.Mesh(B.geometry(), vmat());
    mesh.name = `K_${name}`;
    mesh.userData = { dr: 'kit', piece: name };
    return mesh;
  }
  // floor + ceiling
  slab(B, -hw, hw, -length, 0, 0, KIT_COL.floor, { edge: 0.3, dark: 0.7, fade: fadeZ });
  slab(B, -hw, hw, -length, 0, H, KIT_COL.ceiling, { edge: 0.3, dark: 0.75, fade: fadeZ });
  const leftOpen = doors.filter((d) => d === 'l').map(() => ({ from: C.doorZ - DOOR.w / 2, to: C.doorZ + DOOR.w / 2, top: DOOR.h }));
  const rightOpen = doors.filter((d) => d === 'r').map(() => ({ from: C.doorZ - DOOR.w / 2, to: C.doorZ + DOOR.w / 2, top: DOOR.h }));
  // left wall at x = −hw runs along −z; right wall at x = +hw
  wall(B, [-hw, 0, 0], [0, 0, -1], length, H, leftOpen, KIT_COL.wall, { fade });
  wall(B, [hw, 0, 0], [0, 0, -1], length, H, rightOpen, KIT_COL.wall, { fade });
  if (back) wall(B, [-hw, 0, 0], [1, 0, 0], width, H, [], KIT_COL.wall.clone().multiplyScalar(0.85));
  if (endWall) wall(B, [-hw, 0, -length], [1, 0, 0], width, H, endWall, KIT_COL.wall.clone().multiplyScalar(0.9));
  // door openings: a reveal + the Z-stub behind
  for (const side of doors) {
    const sx = side === 'l' ? -1 : 1;
    const zc = -C.doorZ;
    const trim = KIT_COL.trim;
    const xo = sx * (hw - 0.012);
    const q = (z0, z1, y0, y1) => B.quad([[xo, y0, z0], [xo, y0, z1], [xo, y1, z1], [xo, y1, z0]], trim);
    q(zc + 0.58, zc + 0.5, 0, DOOR.h + 0.08);
    q(zc - 0.5, zc - 0.58, 0, DOOR.h + 0.08);
    q(zc + 0.58, zc - 0.58, DOOR.h, DOOR.h + 0.08);
    const out = [sx, 0, 0];
    const sideV = leftOf(out);
    const centre = [sx * hw, 0, zc];
    const b1 = add(centre, mul(out, STUB.leg1));
    const b2 = add(b1, mul(sideV, STUB.leg2));
    const b3 = add(b2, mul(out, STUB.leg3));
    stub(B, { centre, out, side: sideV, b1, b2, b3 }, { wall: KIT_COL.wall.clone().multiplyScalar(0.7), floor: KIT_COL.floor, ceiling: KIT_COL.ceiling });
  }
  const mesh = new THREE.Mesh(B.geometry(), vmat());
  mesh.name = `K_${name}`;
  mesh.userData = { dr: 'kit', piece: name };
  return mesh;
}

/** The kit's lights, each in its own frame (see corridor.js for how they're placed). */
function glowQuad(name, pts) {
  const B = builder();
  B.quad(pts, new THREE.Color(1, 1, 1));
  const mesh = new THREE.Mesh(B.geometry(), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  mesh.material.name = name;
  mesh.name = `K_${name}`;
  return mesh;
}

export function greyboxKit() {
  const root = new THREE.Group();
  root.name = 'greybox-kit';
  const S = C.segment;
  root.add(kitPiece('entrance', C.entrance.length, { back: true }));
  root.add(kitPiece('plain', S));
  root.add(kitPiece('door_l', S, { doors: ['l'] }));
  root.add(kitPiece('door_r', S, { doors: ['r'] }));
  root.add(kitPiece('door_lr', S, { doors: ['l', 'r'] }));
  root.add(kitPiece('end', C.end.length, { fadeEnd: true }));
  {
    // the empty-state end: its shut leaf is part of the piece (it never opens), as in the Blender kit
    const endDoor = kitPiece('end_door', S, { endWall: [{ from: C.width / 2 - DOOR.w / 2, to: C.width / 2 + DOOR.w / 2, top: DOOR.h }] });
    const B = builder();
    const z = -S - 0.04;
    const leafC = KIT_COL.leaf;
    B.quad([[-DOOR.w / 2, 0, z], [DOOR.w / 2, 0, z], [DOOR.w / 2, DOOR.h, z], [-DOOR.w / 2, DOOR.h, z]], [leafC.clone().multiplyScalar(0.7), leafC.clone().multiplyScalar(0.7), leafC, leafC]);
    for (const [x0, x1, y0, y1] of [[-0.58, -0.5, 0, DOOR.h + 0.08], [0.5, 0.58, 0, DOOR.h + 0.08], [-0.58, 0.58, DOOR.h, DOOR.h + 0.08]]) {
      B.quad([[x0, y0, -S + 0.012], [x1, y0, -S + 0.012], [x1, y1, -S + 0.012], [x0, y1, -S + 0.012]], KIT_COL.trim);
    }
    const extra = B.geometry();
    const merged = mergeTwo(endDoor.geometry, extra);
    endDoor.geometry.dispose();
    extra.dispose();
    endDoor.geometry = merged;
    endDoor.userData.door = { x: 0, z: -S, facing: '+z', signY: C.signY };
    root.add(endDoor);
  }
  // the night-break bay: wider, a dark window on the left, a blank wall on the right (the stencil's)
  const bay = kitPiece('break', C.break.length, { width: C.break.width, bay: true });
  {
    const B = builder();
    const hw = C.break.width / 2;
    const zc = -C.break.length / 2;
    const y0 = C.break.windowSill;
    const y1 = y0 + C.break.windowH;
    const ww = C.break.windowW / 2;
    const frame = KIT_COL.trim.clone().multiplyScalar(0.8);
    // the dark window is on the right (+x), as in the Blender kit; the blank wall on the left takes the stencil
    const xw = hw - 0.01;
    B.quad([[xw, y0 - 0.06, zc + ww + 0.06], [xw, y0 - 0.06, zc - ww - 0.06], [xw, y1 + 0.06, zc - ww - 0.06], [xw, y1 + 0.06, zc + ww + 0.06]], frame);
    const glass = new THREE.Color('#06080c');
    const glassHi = new THREE.Color('#121722');
    B.quad([[xw - 0.006, y0, zc + ww], [xw - 0.006, y0, zc - ww], [xw - 0.006, y1, zc - ww], [xw - 0.006, y1, zc + ww]], [glass, glass, glassHi, glassHi]);
    // the mullion
    B.quad([[xw - 0.01, y0, zc + 0.025], [xw - 0.01, y0, zc - 0.025], [xw - 0.01, y1, zc - 0.025], [xw - 0.01, y1, zc + 0.025]], frame);
    const g = bay.geometry;
    const extra = B.geometry();
    const merged = mergeTwo(g, extra);
    bay.geometry.dispose();
    extra.dispose();
    bay.geometry = merged;
  }
  Object.assign(bay.userData, {
    width: C.break.width,
    narrow: BAY_NARROW,
    window: { side: 'r', x: C.break.width / 2, z: -C.break.length / 2 },
    stencil: { side: 'l', x: -C.break.width / 2, y: C.break.stencilY, z: -C.break.length / 2, facing: '+x' },
  });
  root.add(bay);
  // the door leaf: hinge at the origin, leaf along −z, its face at x = 0 facing +x (a left opening)
  {
    const B = builder();
    box(B, [-0.022, DOOR.h / 2 - 0.01, -DOOR.w / 2], [0.044, DOOR.h - 0.03, DOOR.w - 0.02], 0, KIT_COL.leaf, { shadeSide: 0.8, shadeTop: 0.9 });
    // a handle
    box(B, [0.03, 1.0, -DOOR.w + 0.1], [0.05, 0.03, 0.12], 0, KIT_COL.leaf.clone().multiplyScalar(1.6));
    const leaf = new THREE.Mesh(B.geometry(), vmat());
    leaf.name = 'K_leaf';
    root.add(leaf);
  }
  // the spill: a floor wedge in the leaf's frame, out of the latch-side gap into the corridor (+x)
  root.add(glowQuad('spill', [[0, 0.004, -0.78], [0, 0.004, -1.06], [1.7, 0.004, -2.0], [1.7, 0.004, -0.25]]));
  root.add(glowQuad('underline', [[0, 0.003, -0.04], [0, 0.003, -0.96], [0.32, 0.003, -1.02], [0.32, 0.003, 0.02]]));
  return root;
}

function mergeTwo(a, b) {
  const g = new THREE.BufferGeometry();
  const pa = a.attributes.position.array;
  const pb = b.attributes.position.array;
  const ca = a.attributes.color.array;
  const cb = b.attributes.color.array;
  const pos = new Float32Array(pa.length + pb.length);
  pos.set(pa);
  pos.set(pb, pa.length);
  const col = new Float32Array(ca.length + cb.length);
  col.set(ca);
  col.set(cb, ca.length);
  const ia = Array.from(a.index.array);
  const off = pa.length / 3;
  const ib = Array.from(b.index.array).map((i) => i + off);
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.setIndex([...ia, ...ib]);
  g.computeBoundingSphere();
  g.computeBoundingBox();
  return g;
}
