// Projector Life — projection maths checks (Node, no GPU).
//   node tools/projector-life/projection-check.mjs
// Throw ratio → FOV, pose conventions, image round trips, ray casts against the
// room's patches, the depth packing the shaders use, coverage sampling, and
// the unfolded net's seams. Exits 1 on any failure.

import { buildPatches, SHED } from '../../src/components/portal/modules/projector-life/room/roomModel.js';
import {
  activeProjectors,
  axisHit,
  FAR,
  hfovFromThrow,
  imageWidthAt,
  poseBasis,
  projectPoint,
  projectorFromValues,
  rayPatches,
  rayThrough,
  vfovFromThrow,
} from '../../src/components/portal/modules/projector-life/projection/projector.js';
import { computeCoverage } from '../../src/components/portal/modules/projector-life/projection/coverage.js';
import { netTransforms } from '../../src/components/portal/modules/projector-life/projection/netInset.js';

let fails = 0;
let passes = 0;
function ok(cond, msg, extra = '') {
  if (cond) passes++;
  else {
    fails++;
    console.log(`FAIL  ${msg} ${extra}`);
  }
}
const near = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;
const deg = (r) => (r * 180) / Math.PI;
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = (a) => Math.hypot(...a);

// ── 1. throw ratio → field of view ──────────────────────────────────────────
for (const [t, h] of [[1.5, 36.8699], [0.5, 90], [0.25, 126.8699], [1, 53.1301]]) {
  ok(near(deg(hfovFromThrow(t)), h, 1e-3), `hfov(t=${t}) = ${h}°`, deg(hfovFromThrow(t)));
}
ok(near(deg(vfovFromThrow(0.5, 16 / 9)), deg(2 * Math.atan(9 / 16)), 1e-9), 'vfov(0.5, 16:9) = 2·atan(9/16)');
// image width at distance = distance / throw, by construction
for (const t of [0.25, 0.5, 1.5]) {
  const d = 3;
  const half = d * Math.tan(hfovFromThrow(t) / 2);
  ok(near(2 * half, imageWidthAt(t, d), 1e-9), `image width at 3 m, t=${t}`);
}

// ── 2. pose conventions ─────────────────────────────────────────────────────
const vNear = (a, b, eps = 1e-9) => near(a[0], b[0], eps) && near(a[1], b[1], eps) && near(a[2], b[2], eps);
ok(vNear(poseBasis(0, 0, 0).f, [0, 0, -1]), 'yaw 0 looks north (−z)');
ok(vNear(poseBasis(90, 0, 0).f, [1, 0, 0]), 'yaw 90 looks east (+x)');
ok(vNear(poseBasis(180, 0, 0).f, [0, 0, 1]), 'yaw 180 looks south (+z)');
ok(vNear(poseBasis(0, 90, 0).f, [0, 1, 0]), 'pitch +90 looks up');
ok(vNear(poseBasis(0, 0, 0).right, [1, 0, 0]) && vNear(poseBasis(0, 0, 0).up, [0, 1, 0]), 'facing north: right = east, up = +y');
{
  const b = poseBasis(0, 0, 90);
  ok(vNear(b.up, [1, 0, 0]), 'roll +90: the image top points right (clockwise from behind)');
}
for (let k = 0; k < 200; k++) {
  const b = poseBasis(Math.random() * 360 - 180, Math.random() * 180 - 90, Math.random() * 90 - 45);
  const ortho = near(dot(b.f, b.right), 0, 1e-9) && near(dot(b.f, b.up), 0, 1e-9) && near(dot(b.right, b.up), 0, 1e-9);
  const unit = near(len(b.f), 1, 1e-9) && near(len(b.right), 1, 1e-9) && near(len(b.up), 1, 1e-9);
  const rh = vNear(cross(b.right, b.up), b.f.map((x) => -x), 1e-9);
  if (!(ortho && unit && rh)) {
    ok(false, 'pose basis orthonormal + right × up = −forward');
    break;
  }
  if (k === 199) ok(true, '');
}

// ── 3. image round trip ─────────────────────────────────────────────────────
{
  const P = projectorFromValues({ 'p0.x': 1, 'p0.y': 2, 'p0.z': 3, 'p0.yaw': 37, 'p0.pitch': -21, 'p0.roll': 9, 'p0.throw': 0.7, 'p0.aspect': '4:3' }, 0);
  let worst = 0;
  for (let k = 0; k < 100; k++) {
    const sx = Math.random() * 2 - 1;
    const sy = Math.random() * 2 - 1;
    const d = rayThrough(P, sx, sy);
    const t = 0.5 + Math.random() * 4;
    const q = projectPoint(P, [P.pos[0] + d[0] * t, P.pos[1] + d[1] * t, P.pos[2] + d[2] * t]);
    worst = Math.max(worst, Math.abs(q.sx - sx), Math.abs(q.sy - sy));
  }
  ok(worst < 1e-9, 'rayThrough → projectPoint round trip', worst);
  ok(projectPoint(P, [P.pos[0] - P.f[0], P.pos[1] - P.f[1], P.pos[2] - P.f[2]]) === null, 'behind the lens → null');
  ok(near(P.aspect, 4 / 3), "aspect '4:3' parses");
}

// ── 4. ray casts against the room's own patches ─────────────────────────────
const patches = buildPatches({ apex: 3.3 });
const C = SHED.centre;
{
  const o = [C[0], 1, C[2]];
  const hN = rayPatches(patches, o, [0, 0, -1]);
  ok(hN && hN.patch.id === 'wall-N' && near(hN.t, SHED.apothem, 1e-9), 'centre → north hits wall-N at the apothem', hN && `${hN.patch.id} ${hN.t}`);
  const hD = rayPatches(patches, o, [0, -1, 0]);
  ok(hD && hD.patch.id === 'floor' && near(hD.t, 1, 1e-9), 'centre → down hits the floor at 1 m', hD && hD.patch.id);
  const hU = rayPatches(patches, [C[0] + 0.3, 1, C[2] + 0.01], [0, 1, 0]);
  ok(hU && hU.patch.kind === 'roof' && hU.t > 2.25 - 1 && hU.t < 3.3 - 1, 'centre → up hits a roof facet below the apex', hU && `${hU.patch.id} ${hU.t}`);
  const P = projectorFromValues({ 'p0.x': C[0], 'p0.y': 1.2, 'p0.z': C[2], 'p0.yaw': 90, 'p0.pitch': 0, 'p0.throw': 1.5 }, 0);
  ok(near(axisHit(patches, P), SHED.apothem, 1e-9), 'axisHit east = apothem');
}

// ── 5. depth packing (GLSL in shadows.js / lightMaterial.js) ────────────────
{
  const fract = (x) => x - Math.floor(x);
  let worst = 0;
  for (let k = 0; k <= 4000; k++) {
    const z = (k / 4000) * (FAR - 0.01);
    const v = Math.min(Math.max(z / FAR, 0), 0.9999);
    let e = [fract(v), fract(v * 255), fract(v * 65025)];
    e = [e[0] - e[1] / 255, e[1] - e[2] / 255, e[2]];
    const bytes = e.map((c) => Math.round(c * 255)); // 8-bit render target
    const back = (bytes[0] / 255 + bytes[1] / 65025 + bytes[2] / 16581375) * FAR; // shadows.js unpackDepth
    worst = Math.max(worst, Math.abs(back - z));
  }
  ok(worst < 0.001, 'packed depth round trip < 1 mm over [0, FAR]', `${(worst * 1000).toFixed(3)} mm`);
}

// ── 6. coverage sampling ────────────────────────────────────────────────────
{
  const vals = { 'proj.count': 1, 'proj.occlusion': true, 'p0.x': C[0], 'p0.y': 2.2, 'p0.z': C[2], 'p0.yaw': 0, 'p0.pitch': -90, 'p0.roll': 0, 'p0.throw': 0.25, 'p0.aspect': '16:9' };
  const noMask = buildPatches({ apex: 3.3, loft: false, furniture: false, masks: [] });
  const prj = activeProjectors(vals);
  const c = computeCoverage({ patches: noMask, values: vals, projectors: prj, depthAt: null });
  ok(c.floor > 0.6 && c.ceiling === 0, 'straight down, wide lens: most of the floor, none of the roof', `floor ${c.floor.toFixed(3)} ceiling ${c.ceiling}`);
  const sum = c.byCount.reduce((a, b) => a + b, 0);
  ok(near(sum, 1, 1e-9), 'byCount sums to 1');
  ok(near(c.byCount[1], c.total, 1e-9), 'one projector: byCount[1] = total');
  // a depth map that says "something 10 cm in front of the lens" everywhere → all shadowed
  const blocked = computeCoverage({ patches: noMask, values: vals, projectors: prj, depthAt: () => 0.1 });
  ok(blocked.total === 0, 'fully occluded depth → 0 coverage');
  // an infinitely far depth map changes nothing
  const open = computeCoverage({ patches: noMask, values: vals, projectors: prj, depthAt: () => FAR });
  ok(near(open.total, c.total, 1e-12), 'far depth = occlusion off');
  // area is honest: floor octagon area within one grid cell row of the analytic value
  const octArea = 2 * Math.SQRT2 * SHED.circumradius ** 2;
  ok(Math.abs(c.area.floor - octArea) < 0.1, 'sampled floor area ≈ octagon area', `${c.area.floor.toFixed(3)} vs ${octArea.toFixed(3)}`);
  // masks are excluded from the denominator
  const masked = buildPatches({ apex: 3.3 });
  const cm = computeCoverage({ patches: masked, values: { ...vals, 'map.mask.door': true, 'map.mask.window': true, 'map.mask.loft': true, 'map.mask.furniture': true }, projectors: prj, depthAt: null });
  const cu = computeCoverage({ patches: masked, values: { ...vals, 'map.mask.door': false, 'map.mask.window': false, 'map.mask.loft': false, 'map.mask.furniture': false }, projectors: prj, depthAt: null });
  ok(cm.samples < cu.samples, 'active masks are excluded from the sampled area', `${cm.samples} < ${cu.samples}`);
  // three projectors: counts up to 3 are possible and fractions stay in [0, 1]
  const three = { ...vals, 'proj.count': 3, 'p1.x': 1, 'p1.y': 1.5, 'p1.z': 2, 'p1.yaw': 90, 'p1.pitch': 0, 'p1.throw': 0.5, 'p2.x': 3.3, 'p2.y': 1.5, 'p2.z': 2.3, 'p2.yaw': -90, 'p2.pitch': 0, 'p2.throw': 0.5 };
  const c3 = computeCoverage({ patches: noMask, values: three, projectors: activeProjectors(three), depthAt: null });
  ok(c3.total >= c.total && c3.total <= 1, 'adding projectors never lowers coverage');
  ok(c3.ms < 50, 'coverage recompute < 50 ms (CPU part)', `${c3.ms} ms`);
}

// ── 7. the unfolded net ─────────────────────────────────────────────────────
for (const apex of [2.7, 3.3, 4.2]) {
  const ps = buildPatches({ apex });
  const T = netTransforms(ps);
  const ap = (M, [x, y]) => [M[0] * x + M[1] * y + M[4], M[2] * x + M[3] * y + M[5]];
  let joined = 0;
  let cut = 0;
  const byId = new Map(ps.map((p) => [p.id, p]));
  for (const p of ps) {
    if (!T.has(p.id)) continue;
    for (const s of p.seams) {
      const q = byId.get(s.to);
      if (!T.has(q.id)) continue;
      const a0 = ap(T.get(p.id), p.polygon[s.edge]);
      const a1 = ap(T.get(p.id), p.polygon[(s.edge + 1) % p.polygon.length]);
      const b0 = ap(T.get(q.id), q.polygon[s.toEdge]);
      const b1 = ap(T.get(q.id), q.polygon[(s.toEdge + 1) % q.polygon.length]);
      const same = Math.hypot(a0[0] - b1[0], a0[1] - b1[1]) < 1e-9 && Math.hypot(a1[0] - b0[0], a1[1] - b0[1]) < 1e-9;
      if (same) joined++;
      else cut++;
    }
  }
  // joined: floor↔wall (8 pairs) + wall↔roof (8 pairs), counted from both sides
  ok(joined === 32, `net @ apex ${apex}: 32 joined seam sides`, joined);
  ok(cut === 32, `net @ apex ${apex}: 32 cut seam sides (wall corners + hips)`, cut);
  ok(T.size === 17, `net @ apex ${apex}: floor + 8 walls + 8 roofs placed`, T.size);
}

console.log(`projection-check: ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
