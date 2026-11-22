/* Planar 3-DOF boat model (surge, sway, yaw) on a fixed 60 Hz step.
   Pure JS: no DOM, no three.js, deterministic — tools/skippers/sim-check.mjs
   drives it in Node.

   Frames: world metres, x = east, y = north (the Blender frame of
   public/skippers-sim/venue-layout.json). Heading psi is a compass angle
   (radians, 0 = north, clockwise +); yaw rate r is clockwise +.
   Body: u = surge (forward +), v = sway (starboard +).

   The boat is an ASSUMED ~5.5 m outboard centre-console runabout (~100 hp);
   ABC's exact boat is unknown. Every number here is a game tuning value. */

export const DT = 1 / 60;
export const KN = 1.943844; // m/s → knots

export const BOAT = {
  L: 5.5, B: 2.2,
  m: 1200, // hull + motor + fuel + 3 people
  addX: 0.1, addY: 0.8, addI: 0.5, // added-mass fractions
  Iz: 1200 * (5.5 * 5.5 + 2.2 * 2.2) / 12,
  xT: -2.6, // transom (thrust point) aft of CG
  xW: 0.8, // windage centre of effort forward of CG
  legMax: 30 * Math.PI / 180, // outboard leg angle at full lock
  wheelRate: 1 / 1.4, // full lock in 1.4 s
};

/* Lever notches: R2 R1 N F1 … F6 (index -2 … 6). */
export const NOTCHES = ['R2', 'R1', 'N', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6'];
export const notchLabel = (g) => NOTCHES[g + 2];
const RPM_TARGET = { '-2': 1600, '-1': 750, 0: 700, 1: 750, 2: 1400, 3: 2200, 4: 3200, 5: 4300, 6: 5500 };
const THRUST = [[0, 0], [700, 200], [750, 230], [1400, 830], [1600, 1000], [2200, 2030], [3200, 3500], [4300, 4500], [5500, 6000]];
export const RPM_CLUNK = 1100; // engaging a gear above this rpm = a straight, rough shift
export const RPM_CHURN = 2000; // reverse above this rpm mostly churns (ventilates)

function lerpTable(t, x) {
  if (x <= t[0][0]) return t[0][1];
  for (let i = 1; i < t.length; i++) {
    if (x <= t[i][0]) { const [x0, y0] = t[i - 1]; const [x1, y1] = t[i]; return y0 + (y1 - y0) * (x - x0) / (x1 - x0); }
  }
  return t[t.length - 1][1];
}

/* Hull footprint (boat frame: x = starboard, y = forward), CCW. */
export const FOOTPRINT = [
  [0, 2.75], [0.55, 2.2], [0.95, 1.2], [1.1, 0], [1.1, -2.6], [-1.1, -2.6], [-1.1, 0], [-0.95, 1.2], [-0.55, 2.2],
].reverse();

export const fwd = (psi) => [Math.sin(psi), Math.cos(psi)];
export const stbd = (psi) => [Math.cos(psi), -Math.sin(psi)];
export const toWorld = (b, px, py) => {
  const f = fwd(b.psi); const s = stbd(b.psi);
  return [b.x + px * s[0] + py * f[0], b.y + px * s[1] + py * f[1]];
};
export const wrapPi = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

/* Seeded RNG (mulberry32) so runs are reproducible. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeBoat(x = 0, y = 0, psi = 0) {
  return {
    x, y, psi, u: 0, v: 0, r: 0,
    gear: 0, // lever notch -2…6
    wheel: 0, // -1 (port lock) … 1 (starboard lock)
    rpm: 0, running: false, stalled: null,
    lastNeutralAt: 0, neutralSince: 0,
    lines: {}, // id → { boatPt:[x,y], anchor:[x,y], rest }
    fouled: false,
  };
}

/* World velocity of the hull's CG. */
export const velWorld = (b) => {
  const f = fwd(b.psi); const s = stbd(b.psi);
  return [b.u * f[0] + b.v * s[0], b.u * f[1] + b.v * s[1]];
};

/* ---------- geometry (convex SAT) ---------- */
function project(pts, ax) {
  let lo = Infinity; let hi = -Infinity;
  for (const p of pts) { const d = p[0] * ax[0] + p[1] * ax[1]; if (d < lo) lo = d; if (d > hi) hi = d; }
  return [lo, hi];
}
function axesOf(pts) {
  const out = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]; const c = pts[(i + 1) % pts.length];
    const ex = c[0] - a[0]; const ey = c[1] - a[1]; const l = Math.hypot(ex, ey) || 1;
    out.push([-ey / l, ex / l]);
  }
  return out;
}
const centroid = (pts) => { let x = 0; let y = 0; for (const p of pts) { x += p[0]; y += p[1]; } return [x / pts.length, y / pts.length]; };

export function prepCollider(c) {
  const xs = c.poly.map((p) => p[0]); const ys = c.poly.map((p) => p[1]);
  return { ...c, axes: axesOf(c.poly), c: centroid(c.poly), box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
}

export function hullWorld(b) { return FOOTPRINT.map(([px, py]) => toWorld(b, px, py)); }

/* Returns { n:[nx,ny] (collider → boat), depth, pt } or null. */
export function sat(hull, col) {
  let best = null;
  const axes = [...axesOf(hull), ...col.axes];
  for (const ax of axes) {
    const [a0, a1] = project(hull, ax); const [b0, b1] = project(col.poly, ax);
    const o = Math.min(a1, b1) - Math.max(a0, b0);
    if (o <= 0) return null;
    if (!best || o < best.depth) best = { n: ax, depth: o };
  }
  const hc = centroid(hull);
  let n = best.n;
  if ((hc[0] - col.c[0]) * n[0] + (hc[1] - col.c[1]) * n[1] < 0) n = [-n[0], -n[1]];
  // contact point: hull vertices deepest along -n
  let min = Infinity; for (const p of hull) min = Math.min(min, p[0] * n[0] + p[1] * n[1]);
  const deep = hull.filter((p) => p[0] * n[0] + p[1] * n[1] < min + 0.05);
  return { n, depth: best.depth, pt: centroid(deep) };
}

/* ---------- one fixed step ---------- */
export function step(b, env, cmd, out) {
  const dt = DT;
  // wheel (holds position; A/D move it, C centres)
  if (cmd.wheelTo !== undefined) b.wheel = cmd.wheelTo;
  else if (cmd.wheelDir) b.wheel = Math.max(-1, Math.min(1, b.wheel + cmd.wheelDir * BOAT.wheelRate * dt));
  // engine rpm
  const target = b.running ? RPM_TARGET[b.gear] : 0;
  const tau = target > b.rpm ? 0.6 : 0.45;
  b.rpm += (target - b.rpm) * (1 - Math.exp(-dt / tau));
  if (b.gear === 0) b.neutralSince += dt; else b.neutralSince = 0;

  // thrust (only in gear, engine running, prop not fouled)
  let T = 0;
  if (b.running && b.gear !== 0 && !b.fouled) {
    const base = lerpTable(THRUST, b.rpm);
    T = b.gear > 0 ? base : -0.6 * base * (b.rpm > RPM_CHURN ? 0.35 : 1);
  }
  const delta = b.wheel * BOAT.legMax;

  // water-relative body velocity
  const f = fwd(b.psi); const s = stbd(b.psi);
  const cur = env.current; const wnd = env.wind;
  const ur = b.u - (cur[0] * f[0] + cur[1] * f[1]);
  const vr = b.v - (cur[0] * s[0] + cur[1] * s[1]);
  const au = Math.abs(ur);
  const bq = au < 4.5 ? 110 : au > 9 ? 35 : 110 - (au - 4.5) * (75 / 4.5);
  let X = -(40 * ur + bq * ur * au);
  let Y = -(300 * vr + 1200 * vr * Math.abs(vr));
  let N = -((1800 + 1700 * au) * b.r + 2500 * b.r * Math.abs(b.r));

  // thrust vectored at the transom along the leg
  X += T * Math.cos(delta);
  const Yt = -T * Math.sin(delta);
  // yaw moment of a starboard force Y at x forward of CG: N = x * Y (clockwise +)
  Y += Yt; N += BOAT.xT * Yt;
  // leg as a small rudder (almost nothing in neutral)
  const Yl = -40 * ur * au * Math.sin(delta);
  Y += Yl; N += BOAT.xT * Yl;

  // windage: relative wind on the topsides, centre of effort forward
  const vw = velWorld(b);
  const rw = [wnd[0] - vw[0], wnd[1] - vw[1]];
  const rwb = [rw[0] * f[0] + rw[1] * f[1], rw[0] * s[0] + rw[1] * s[1]];
  const q = 0.5 * 1.225;
  const Xw = q * 0.6 * 2.4 * rwb[0] * Math.abs(rwb[0]);
  const Yw = q * 1.0 * 5.5 * rwb[1] * Math.abs(rwb[1]);
  X += Xw; Y += Yw; N += BOAT.xW * Yw;

  // mooring lines (ropes: pull only)
  for (const id in b.lines) {
    const ln = b.lines[id];
    const p = toWorld(b, ln.boatPt[0], ln.boatPt[1]);
    const dx = ln.anchor[0] - p[0]; const dy = ln.anchor[1] - p[1];
    const d = Math.hypot(dx, dy);
    if (d > ln.rest) {
      const k = 6000 * (d - ln.rest);
      // damping on the stretch rate
      const pv = pointVel(b, p);
      const nx = dx / d; const ny = dy / d;
      const rate = -(pv[0] * nx + pv[1] * ny);
      const Fm = Math.max(0, k + 900 * rate);
      const Fx = Fm * nx; const Fy = Fm * ny;
      const Xs = Fx * f[0] + Fy * f[1];
      const Ys = Fx * s[0] + Fy * s[1];
      X += Xs; Y += Ys; N += ln.boatPt[1] * Ys - ln.boatPt[0] * Xs;
    }
  }

  const mX = BOAT.m * (1 + BOAT.addX); const mY = BOAT.m * (1 + BOAT.addY); const I = BOAT.Iz * (1 + BOAT.addI);
  const du = (X + mY * b.v * b.r) / mX;
  const dv = (Y - mX * b.u * b.r) / mY;
  const dr = N / I;
  b.u += du * dt; b.v += dv * dt; b.r += dr * dt;
  const v2 = velWorld(b);
  b.x += v2[0] * dt; b.y += v2[1] * dt;
  b.psi = wrapPi(b.psi + b.r * dt);
  out.thrust = T;

  // collisions
  if (env.colliders) collide(b, env.colliders, out);
}

/* World velocity of a world point p on the hull. */
export function pointVel(b, p) {
  const v = velWorld(b); const w = -b.r; // CCW
  const rx = p[0] - b.x; const ry = p[1] - b.y;
  return [v[0] - w * ry, v[1] + w * rx];
}

function collide(b, colliders, out) {
  const hull = hullWorld(b);
  let hx0 = Infinity; let hy0 = Infinity; let hx1 = -Infinity; let hy1 = -Infinity;
  for (const p of hull) { hx0 = Math.min(hx0, p[0]); hy0 = Math.min(hy0, p[1]); hx1 = Math.max(hx1, p[0]); hy1 = Math.max(hy1, p[1]); }
  for (const c of colliders) {
    if (c.box[0] > hx1 || c.box[2] < hx0 || c.box[1] > hy1 || c.box[3] < hy0) continue;
    const hit = sat(hull, c);
    if (!hit) continue;
    const { n, depth, pt } = hit;
    const pv = pointVel(b, pt);
    const vn = pv[0] * n[0] + pv[1] * n[1];
    const rx = pt[0] - b.x; const ry = pt[1] - b.y;
    const rn = rx * n[1] - ry * n[0];
    const m = BOAT.m; const I = BOAT.Iz;
    let wv = velWorld(b); let w = -b.r;
    if (vn < 0) {
      const e = 0.15;
      const j = -(1 + e) * vn / (1 / m + rn * rn / I);
      wv = [wv[0] + j * n[0] / m, wv[1] + j * n[1] / m];
      w += rn * j / I;
      // friction along the face
      const t = [-n[1], n[0]];
      const vt = pv[0] * t[0] + pv[1] * t[1];
      const rt = rx * t[1] - ry * t[0];
      const jt = Math.max(-0.3 * j, Math.min(0.3 * j, -vt / (1 / m + rt * rt / I)));
      wv = [wv[0] + jt * t[0] / m, wv[1] + jt * t[1] / m];
      w += rt * jt / I;
      out.contacts.push({ name: c.name, kind: c.kind, speed: -vn });
    }
    // push out
    b.x += n[0] * depth; b.y += n[1] * depth;
    const f = fwd(b.psi); const s = stbd(b.psi);
    b.u = wv[0] * f[0] + wv[1] * f[1]; b.v = wv[0] * s[0] + wv[1] * s[1]; b.r = -w;
    out.touching.push(c.name);
  }
}
