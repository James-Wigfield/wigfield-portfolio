/* ============================================================================
   RIG — a side-view pictogram person (facing right) built from round-capped
   strokes, posed by a handful of angles. Used for sit-to-stands, heel drops,
   seated trunk work and the muscle map. Muscle groups are thin bands laid
   inside a limb's front or back edge, hidden until a beat lights them.

   Angles are degrees. Leg and trunk angles are measured from straight UP
   (positive = leaning forward, towards +x); arm angles from straight DOWN
   (positive = swung forward). The near (stance) leg is solved upward from a
   fixed toe; the far leg hangs down from the hip.
   ========================================================================== */

const NS = 'http://www.w3.org/2000/svg';
const D = Math.PI / 180;

export const LEN = { shank: 168, thigh: 176, trunk: 214, upper: 116, fore: 106, headR: 34, neck: 28 };
const W = { trunk: 62, thigh: 40, shank: 30, foot: 18, upper: 24, fore: 20 };
const TOE = [70, 20];
const HEEL = [-24, 20];

const rot = ([x, y], r) => [x * Math.cos(r) - y * Math.sin(r), x * Math.sin(r) + y * Math.cos(r)];
const add = (a, b) => [a[0] + b[0], a[1] + b[1]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const mul = (a, k) => [a[0] * k, a[1] * k];
const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
const up = (len, deg) => [len * Math.sin(deg * D), -len * Math.cos(deg * D)];
const down = (len, deg) => [len * Math.sin(deg * D), len * Math.cos(deg * D)];

/** Standard poses. Spread one and override what a scene needs. */
export const POSES = {
  stand: { x: 0, g: 0, r: 0, s: 0, t: 0, k: 3, hd: 0, u: 6, f: 12, dx2: -10 },
  sit: { x: 0, g: 0, r: 0, s: 8, t: -86, k: 6, hd: 0, u: 18, f: 70, dx2: -10 },
};

/** Sit-to-stand keyframes (the near and far legs move together). */
export const STS = [
  { s: 8, t: -86, k: 6, u: 18, f: 70 },
  { s: 15, t: -84, k: 40, u: 40, f: 80 },
  { s: 19, t: -52, k: 36, u: 36, f: 76 },
  { s: 4, t: -12, k: 12, u: 20, f: 50 },
  { s: 0, t: 0, k: 3, u: 6, f: 12 },
];

function el(tag, attrs, parent) {
  const e = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v));
  parent.appendChild(e);
  return e;
}

function setLine(line, a, b) {
  line.setAttribute('x1', a[0].toFixed(1));
  line.setAttribute('y1', a[1].toFixed(1));
  line.setAttribute('x2', b[0].toFixed(1));
  line.setAttribute('y2', b[1].toFixed(1));
}

/** A band inside segment P->Q (P distal), from fraction a to b, offset towards the front (+) or back (-). */
function bandPts(P, Q, a, b, off) {
  const d = sub(Q, P);
  const len = Math.hypot(d[0], d[1]) || 1;
  const u = mul(d, 1 / len);
  const n = [-u[1], u[0]];
  const o = mul(n, off);
  return [add(lerp(P, Q, a), o), add(lerp(P, Q, b), o)];
}

export const BAND_NAMES = ['quads', 'hams', 'glutes', 'abductors', 'calf', 'tib', 'abs', 'back'];

/** Joint positions for a pose (pure; the Rig draws from this). */
export function solve(p) {
  const r = (p.r || 0) * D;
  const toe = [p.x, p.g];
  const ankle = sub(toe, rot(TOE, r));
  const knee = add(ankle, up(LEN.shank, p.s));
  const hip = add(knee, up(LEN.thigh, p.t));
  const shoulder = add(hip, up(LEN.trunk, p.k));
  const armRoot = add(hip, up(LEN.trunk - 16, p.k));
  const head = add(shoulder, up(LEN.neck + LEN.headR, p.k * 0.55 + (p.hd || 0)));
  const elbow = add(armRoot, down(LEN.upper, p.u));
  const wrist = add(elbow, down(LEN.fore, p.f));
  const footA = add(ankle, rot([-18, 9], r));
  const footB = add(ankle, rot([62, 12], r));
  const heel = add(ankle, rot(HEEL, r));

  const r2 = (p.r2 ?? p.r ?? 0) * D;
  const hip2 = add(hip, [p.dx2 ?? -10, -2]);
  const knee2 = sub(hip2, up(LEN.thigh, p.t2 ?? p.t));
  const ankle2 = sub(knee2, up(LEN.shank, p.s2 ?? p.s));
  const elbow2 = add(armRoot, down(LEN.upper, p.u2 ?? p.u - 12));
  const wrist2 = add(elbow2, down(LEN.fore, p.f2 ?? p.f - 8));
  const far = { hip: hip2, knee: knee2, ankle: ankle2, elbow: elbow2, wrist: wrist2, r2 };
  return { r, toe, ankle, heel, knee, hip, shoulder, armRoot, head, elbow, wrist, footA, footB, far };
}

export class Rig {
  constructor(g, { far = true, bandWidth = 12 } = {}) {
    g.replaceChildren();
    this.g = g;
    const limb = (name, w, cls) => {
      const grp = el('g', { class: `rig-${name}` }, g);
      const casing = el('line', { class: 'rig-casing', 'stroke-width': w + 7, 'stroke-linecap': 'round' }, grp);
      const fill = el('line', { class: cls, 'stroke-width': w, 'stroke-linecap': 'round' }, grp);
      return { casing, fill, grp };
    };
    this.far = far;
    this.parts = {};
    if (far) {
      this.parts.farUpper = limb('far-upper', W.upper, 'rig-far');
      this.parts.farFore = limb('far-fore', W.fore, 'rig-far');
      this.parts.farThigh = limb('far-thigh', W.thigh, 'rig-far');
      this.parts.farShank = limb('far-shank', W.shank, 'rig-far');
      this.parts.farFoot = limb('far-foot', W.foot, 'rig-far');
    }
    this.parts.trunk = limb('trunk', W.trunk, 'rig-near');
    this.head = el('circle', { class: 'rig-near rig-head', r: LEN.headR }, g);
    this.parts.thigh = limb('thigh', W.thigh, 'rig-near');
    this.parts.shank = limb('shank', W.shank, 'rig-near');
    this.parts.foot = limb('foot', W.foot, 'rig-near');
    this.bandG = el('g', { class: 'rig-bands' }, g);
    this.band = {};
    BAND_NAMES.forEach((n) => {
      this.band[n] = el('line', { class: `rig-band rig-band--${n}`, 'stroke-width': bandWidth, 'stroke-linecap': 'round', opacity: 0 }, this.bandG);
    });
    this.parts.upper = limb('upper', W.upper, 'rig-arm');
    this.parts.fore = limb('fore', W.fore, 'rig-arm');
    this.j = {};
  }

  set(p) {
    const J = solve(p);
    const { ankle, knee, hip, shoulder, armRoot, head, elbow, wrist, footA, footB } = J;
    const P = this.parts;
    const both = (part, a, b) => {
      setLine(part.casing, a, b);
      setLine(part.fill, a, b);
    };
    both(P.trunk, add(hip, up(18, p.k)), sub(shoulder, up(20, p.k)));
    both(P.thigh, knee, hip);
    both(P.shank, ankle, knee);
    both(P.foot, footA, footB);
    both(P.upper, armRoot, elbow);
    both(P.fore, elbow, wrist);
    this.head.setAttribute('cx', head[0].toFixed(1));
    this.head.setAttribute('cy', head[1].toFixed(1));

    if (this.far) {
      const { hip: hip2, knee: knee2, ankle: ankle2, elbow: elbow2, wrist: wrist2, r2 } = J.far;
      both(P.farThigh, knee2, hip2);
      both(P.farShank, ankle2, knee2);
      both(P.farFoot, add(ankle2, rot([-18, 9], r2)), add(ankle2, rot([62, 12], r2)));
      both(P.farUpper, armRoot, elbow2);
      both(P.farFore, elbow2, wrist2);
    }

    // Muscle bands (front = +, back = -). Offsets sit inside the limb's edge.
    const B = this.band;
    const put = (name, pts) => setLine(B[name], pts[0], pts[1]);
    put('quads', bandPts(knee, hip, 0.18, 0.78, 11));
    put('hams', bandPts(knee, hip, 0.2, 0.7, -11));
    put('glutes', bandPts(hip, shoulder, -0.02, 0.16, -19));
    put('abductors', bandPts(hip, shoulder, 0.02, 0.2, 0));
    put('calf', bandPts(ankle, knee, 0.32, 0.84, -7));
    put('tib', bandPts(ankle, knee, 0.28, 0.84, 7));
    put('abs', bandPts(hip, shoulder, 0.16, 0.66, 20));
    put('back', bandPts(hip, shoulder, 0.1, 0.84, -20));

    this.j = J;
    return J;
  }
}

/** Interpolate between pose keyframes, k in [0, keys.length - 1]. */
export function blendPose(base, keys, k) {
  const i = Math.max(0, Math.min(keys.length - 2, Math.floor(k)));
  const f = Math.max(0, Math.min(1, k - i));
  const a = keys[i];
  const b = keys[i + 1];
  const out = { ...base };
  Object.keys(a).forEach((key) => {
    out[key] = a[key] + (b[key] - a[key]) * f;
  });
  return out;
}

/** A seated pose whose hip rests on a seat top at y = seatY (thigh half-width above it). */
export function sitOn(base, seatY) {
  const J = solve({ ...base, t: -90 });
  const want = seatY - 20;
  const c = Math.max(-0.6, Math.min(0.6, (J.knee[1] - want) / LEN.thigh));
  return { ...base, t: -(Math.acos(c) * 180) / Math.PI };
}
