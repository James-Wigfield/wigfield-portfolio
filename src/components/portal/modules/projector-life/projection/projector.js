/* ============================================================================
   PROJECTOR LIFE — projector maths (pure, no three.js, runs in Node)
   ----------------------------------------------------------------------------
   One virtual projector = a pinhole with a centred lens:
     throw ratio t = distance ÷ image width  ⇒  horizontal FOV = 2·atan(1 / 2t)
     vertical FOV = 2·atan(1 / (2t·aspect))
   Pose (params.js p{i}.*): yaw 0 = north (−z), 90 = east (+x); pitch + looks
   up; roll + turns the picture clockwise as seen from behind the projector.
   Basis: forward f, right r (image +x), up u (image +y), r × u = −f, so the
   three.js camera convention (looks down −z) is (r, u, −f).

   Lens offset: CENTRED (the optical axis goes through the image centre). Real
   ceiling/table projectors usually shift the image up (≈100 % offset); here
   the user aims with pitch instead, which keeps the maths and the controls
   honest and simple. Written down in NOTES.md.
   ========================================================================== */

import { toWorld, pointInPolygon, vec } from '../room/roomModel.js';

export const MAX_PROJECTORS = 3;
export const NEAR = 0.05;
export const FAR = 14;
/** Width (texels) of each projector's depth map; the height follows the aspect. */
export const DEPTH_W = 1024;

export { PROJECTOR_COLORS } from './legend.js';

const DEG = Math.PI / 180;

export function aspectValue(a) {
  if (typeof a === 'number') return a;
  const m = /^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/.exec(String(a || '16:9'));
  return m ? +m[1] / +m[2] : 16 / 9;
}

/** Horizontal FOV (radians) from a throw ratio. */
export function hfovFromThrow(t) {
  return 2 * Math.atan(1 / (2 * Math.max(0.05, t)));
}

/** Vertical FOV (radians) from a throw ratio and aspect (w/h). */
export function vfovFromThrow(t, aspect) {
  return 2 * Math.atan(1 / (2 * Math.max(0.05, t) * aspect));
}

/** Image width (m) at distance d along the axis. */
export function imageWidthAt(t, d) {
  return d / Math.max(0.05, t);
}

/** Forward / right / up unit vectors for a pose (degrees). */
export function poseBasis(yawDeg, pitchDeg, rollDeg = 0) {
  const y = yawDeg * DEG;
  const p = pitchDeg * DEG;
  const r = rollDeg * DEG;
  const f = [Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p)];
  // Right stays horizontal before roll, so it is defined at any pitch (even ±90°).
  const r0 = [Math.cos(y), 0, Math.sin(y)];
  const u0 = vec.cross(r0, f);
  const c = Math.cos(r);
  const s = Math.sin(r);
  const right = vec.norm(vec.sub(vec.mul(r0, c), vec.mul(u0, s)));
  const up = vec.norm(vec.add(vec.mul(u0, c), vec.mul(r0, s)));
  return { f, right, up };
}

/** Everything about projector i that the rest of the system needs. */
export function projectorFromValues(values, i) {
  const g = (k, d) => (values[`p${i}.${k}`] ?? d);
  const t = +g('throw', 1.5);
  const aspect = aspectValue(g('aspect', '16:9'));
  const pose = poseBasis(+g('yaw', 0), +g('pitch', 0), +g('roll', 0));
  return {
    index: i,
    pos: [+g('x', 2.18), +g('y', 2), +g('z', 2.18)],
    yaw: +g('yaw', 0),
    pitch: +g('pitch', 0),
    roll: +g('roll', 0),
    throw: t,
    aspect,
    hfov: hfovFromThrow(t),
    vfov: vfovFromThrow(t, aspect),
    brightness: +g('brightness', 1),
    black: +g('black', 0.025),
    ...pose,
  };
}

export function activeProjectors(values) {
  const n = Math.max(1, Math.min(MAX_PROJECTORS, Math.round(values['proj.count'] ?? 1)));
  const out = [];
  for (let i = 0; i < n; i++) out.push(projectorFromValues(values, i));
  return out;
}

/** Direction (unit) through image point (sx, sy) ∈ [−1, 1]² (sy up). */
export function rayThrough(P, sx, sy) {
  const tx = Math.tan(P.hfov / 2) * sx;
  const ty = Math.tan(P.vfov / 2) * sy;
  return vec.norm(vec.add(P.f, vec.add(vec.mul(P.right, tx), vec.mul(P.up, ty))));
}

/**
 * Where a world point lands in the projector's image: { sx, sy, depth } with
 * sx, sy ∈ [−1, 1] inside the frame (sy up) and depth along the axis, or null
 * behind the lens.
 */
export function projectPoint(P, w) {
  const d = vec.sub(w, P.pos);
  const z = vec.dot(d, P.f);
  if (z <= NEAR) return null;
  return {
    sx: vec.dot(d, P.right) / (z * Math.tan(P.hfov / 2)),
    sy: vec.dot(d, P.up) / (z * Math.tan(P.vfov / 2)),
    depth: z,
  };
}

/**
 * First patch hit along a ray (analytic plane + polygon test). Patches are
 * the room's own shell, so this is where light lands when nothing is in the
 * way. Returns { t, point, patch, local } or null.
 */
export function rayPatches(patches, origin, dir, maxT = FAR) {
  let best = null;
  for (const p of patches) {
    const denom = vec.dot(dir, p.normal);
    if (denom >= -1e-6) continue; // must hit the lit (inward) face
    const t = vec.dot(vec.sub(p.origin, origin), p.normal) / denom;
    if (t <= 1e-4 || t >= maxT || (best && t >= best.t)) continue;
    const hit = vec.add(origin, vec.mul(dir, t));
    const d = vec.sub(hit, p.origin);
    const lx = vec.dot(d, p.u);
    const ly = vec.dot(d, p.v);
    if (!pointInPolygon(lx, ly, p.polygon)) continue;
    best = { t, point: hit, patch: p, local: [lx, ly] };
  }
  return best;
}

/** Distance along the optical axis to the first surface (fallback 2.5 m). */
export function axisHit(patches, P) {
  const h = rayPatches(patches, P.pos, P.f);
  return h ? h.t : 2.5;
}

/**
 * Pixel density where the projector lands on a surface: projector pixels per
 * metre along the most-stretched direction (res wide, ray distance dist,
 * incidence cos).
 */
export function pixelsPerMetre(P, resW, dist, cosT) {
  return (resW * P.throw * Math.max(0, cosT)) / Math.max(1e-3, dist);
}

export { toWorld };
