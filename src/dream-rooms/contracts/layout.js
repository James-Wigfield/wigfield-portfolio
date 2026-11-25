/* Dream Rooms · shared geometry (CONTRACTS.md §5). Pure functions, no three.js:
   the viewer, check-world.mjs and the tests all use these. The Blender kit mirrors
   them in tools/dream-rooms/blender/common.py: change one, change both.

   Module-local frame: x across (0..w), y up (0..h), z (0..d); north is −z.
   World = module.origin + local. Vectors are plain [x, y, z] arrays. */

import dims from './dims.json' with { type: 'json' };

export const DIMS = dims;
export const DOOR = dims.door;
export const STUB = dims.stub;
export const SPACING = dims.moduleSpacing;

/** yaw (rotation about +y; 0 looks along −z) for each facing. */
export const FACING_YAW = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 };

/** The wall table: plane, inward normal, the direction `at` runs and the wall's length. */
export function wallInfo(wall, size) {
  const [w, , d] = size;
  switch (wall) {
    case 'n': return { inward: [0, 0, 1], along: [1, 0, 0], length: w, point: (at) => [at, 0, 0] };
    case 's': return { inward: [0, 0, -1], along: [1, 0, 0], length: w, point: (at) => [at, 0, d] };
    case 'w': return { inward: [1, 0, 0], along: [0, 0, 1], length: d, point: (at) => [0, 0, at] };
    case 'e': return { inward: [-1, 0, 0], along: [0, 0, 1], length: d, point: (at) => [w, 0, at] };
    default: throw new Error(`unknown wall ${wall}`);
  }
}

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a, k) => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
/** Left of a horizontal heading h (as seen walking along h, y up). */
export const leftOf = (h) => [h[2], 0, -h[0]];
/** yaw of a horizontal heading (0 = −z). */
export const yawOf = (h) => Math.atan2(-h[0], -h[2]);
/** Rotate a vector about +y by yaw (same sense as three.js Object3D.rotation.y). */
export function rotY(v, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [v[0] * c + v[2] * s, v[1], -v[0] * s + v[2] * c];
}

export const moduleById = (world, id) => world.modules.find((m) => m.id === id) || null;

/** The module's box in world coordinates. */
export function moduleBox(module) {
  return { min: [...module.origin], max: add(module.origin, module.size) };
}

/**
 * A doorway's frame in world coordinates:
 * { centre, inward, out, side, width, height, wall, module, b1, b2, b3, m }
 * centre = the opening's centre on the wall plane at floor height. The Z-stub runs
 * out → side → out (CONTRACTS.md §5); m is the jump point (middle of leg 2).
 */
export function doorwayFrame(world, doorway) {
  const module = moduleById(world, doorway.module);
  if (!module) throw new Error(`doorway ${doorway.id}: no module ${doorway.module}`);
  const info = wallInfo(doorway.wall, module.size);
  const centre = add(module.origin, info.point(doorway.at));
  const inward = info.inward;
  const out = mul(inward, -1);
  const side = leftOf(out);
  const b1 = add(centre, mul(out, STUB.leg1));
  const b2 = add(b1, mul(side, STUB.leg2));
  const b3 = add(b2, mul(out, STUB.leg3));
  const m = add(b1, mul(side, STUB.leg2 / 2));
  return { id: doorway.id, module: module.id, wall: doorway.wall, centre, inward, out, side, b1, b2, b3, m, width: DOOR.w, height: DOOR.h };
}

/**
 * The rigid map across a teleport/walk link, from doorway frame a to doorway frame b:
 * m_a → m_b, side_a → −side_b, out_a → −out_b. Returns { pos(p), yaw(y), delta }.
 */
export function linkTransform(fa, fb) {
  const delta = yawOf(mul(fb.out, -1)) - yawOf(fa.out);
  return {
    delta,
    pos: (p) => add(fb.m, rotY(sub(p, fa.m), delta)),
    yaw: (y) => y + delta,
  };
}

/** Which side of a's jump plane p is on: > 0 = past it (moving along side_a). */
export const pastJump = (frame, p) => dot(sub(p, frame.m), frame.side);

/** True when p (world) is inside the stub's leg 2 corridor of this frame (with a margin). */
export function inLeg2(frame, p, margin = 0.05) {
  const half = STUB.width / 2 + margin;
  const rel = sub(p, frame.b1);
  const along = dot(rel, frame.side);
  const across = dot(rel, frame.out);
  return along > -half && along < STUB.leg2 + half && Math.abs(across) < half;
}

/** Everything a doorway adds outside its module: the stub's footprint as convex quads [[x, z]…] (world). */
export function stubFootprint(frame) {
  const h = STUB.width / 2;
  const quad = (a, b, dir) => {
    const n = leftOf(dir);
    return [add(a, mul(n, h)), add(b, mul(n, h)), add(b, mul(n, -h)), add(a, mul(n, -h))].map((p) => [p[0], p[2]]);
  };
  const ext = (p, dir, k) => add(p, mul(dir, k));
  return [
    quad(frame.centre, ext(frame.b1, frame.out, h), frame.out),
    quad(ext(frame.b1, frame.side, -h), ext(frame.b2, frame.side, h), frame.side),
    quad(ext(frame.b2, frame.out, -h), frame.b3, frame.out),
  ];
}

/** Surface area estimate of a module (m²) split by how sharp it must be. */
export function surfaceArea(module) {
  const [w, h, d] = module.size;
  const floor = w * d;
  const walls = 2 * (w + d) * h;
  return { floor, ceiling: floor, walls };
}

/**
 * Atlas estimate for a module: floor + walls at texelsPerMetre, the ceiling at half
 * (fog swallows it), plus 25 % for props and stubs, packed at 70 %.
 */
export function atlasEstimate(module) {
  const { texelsPerMetre: t, atlasPx } = dims.budget;
  const a = surfaceArea(module);
  const repeatFactor = module.repeat ? 1 : 1;
  const texels = (a.floor * t * t + a.walls * t * t + a.ceiling * (t / 2) * (t / 2)) * 1.25 * repeatFactor;
  return Math.max(1, Math.ceil(texels / (atlasPx * atlasPx * 0.7)));
}

/** Rough GLB bytes for a world: ~520 KB per 2048 WebP atlas + 120 KB geometry per module. */
export function glbEstimate(world) {
  let bytes = 0;
  for (const m of world.modules) bytes += Math.min(dims.budget.atlasesPerModule, atlasEstimate(m)) * 520 * 1024 + 120 * 1024;
  return bytes;
}
