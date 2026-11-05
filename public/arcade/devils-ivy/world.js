/* ============================================================================
   DEVIL'S IVY — shared world, surface walker and round simulation
   ----------------------------------------------------------------------------
   Imported by BOTH the page (public/arcade/devils-ivy/index.html) and the rules
   module (workers/arcade/games/devils-ivy.js — wrangler bundles it from here),
   so the phones and the Durable Object run the same simulation, line for line.

   THE GAME. Every player is a devil's ivy vine crawling over every surface of
   one kitchen: floor, walls, ceiling, cupboards, the fridge, the bags on the
   bench. A vine never stops and never changes pace; it only steers. Reach a
   ledge and it creeps over; reach a wall and it climbs; reach the ceiling and
   it carries on upside down. Touch any vine — yours included — and you wilt.

   WHY A DETERMINISTIC SIMULATION. A round is a pure function of
   (seed, roster, input logs). Phones send only steering changes stamped with
   a tick number; the server keeps the logs, runs the round a little behind
   real time (DELAY_TICKS) and decides every death. Each phone re-runs the
   same round from the same logs to draw every vine, so a trail is never sent
   over the wire, and a phone's own vine is predicted exactly.

   For that to hold on V8 (Chrome, Workers) AND JavaScriptCore (iPhones) the
   simulation only uses + − × ÷, Math.sqrt, Math.floor, comparisons and
   integer ops — all exactly specified by IEEE-754 / ECMAScript. Never
   Math.sin/cos/hypot/pow/exp in here: their last bit is engine-dependent and
   one bit is enough for two phones to disagree about who crashed. The turn is
   a literal cos/sin pair for that reason.

   THE WORLD is the inside of one room box minus a list of solid boxes. Every
   boundary between free space and solid is walkable. Box rules (enforced by
   tools/devils-ivy-check.mjs):
     • no box thinner than 0.12 m — wrapping round anything thinner than the
       hit diameter puts a vine inside its own collision radius;
     • two facing surfaces either touch exactly or are ≥ 0.14 m apart — a slot
       narrower than that is a trap with nowhere for the camera to go.
   ========================================================================== */

// ── Timing and feel ──────────────────────────────────────────────────────────
export const TICK_MS = 40; //            25 simulation ticks a second
export const SUB = 3; //                 movement + collision substeps per tick
export const DELAY_TICKS = 7; //         server runs this far behind real time (280 ms)
export const BASE_STEP = 0.034; //       metres per tick at the start (0.85 m/s)
export const RAMP = 0.0003; //           pace gained per tick (+45% after a minute)
export const BOOST_MUL = 1.7;
// One tick of turning: 0.115 rad (2.9 rad/s, a ~0.3 m turning circle).
// cos/sin written out as literals — see the determinism note above.
export const TURN_C = 0.9933947843142158;
export const TURN_S = 0.11474668839366382;
export const HIT_R = 0.055; //           tip-to-vine distance that wilts you
export const SELF_IGNORE = 0.22; //      your own last 22 cm can't kill you
export const PICK_R = 0.12;
export const MAX_TICKS = 150 * 25; //    a round can't outlast two and a half minutes
export const STEM_R = 0.011; //          visual stem radius (page only)

// Sprint ("dew") energy, in integer units so it is exact everywhere.
export const ENERGY_MAX = 1000;
export const ENERGY_START = 450;
export const ENERGY_DRAIN = 22; //       per tick of sprinting  (~1.8 s from full)
export const ENERGY_REGEN = 2; //        per tick otherwise     (~20 s from empty)
export const DEW_ENERGY = 380;
export const SUN_ENERGY = 300;
export const DEW_COUNT = 3;
const SUN_FIRST = 40; //   first sun drop 1.6 s in
const SUN_GAP = 45; //     next one 1.8 s after it is taken
const DEW_GAP = 75;

// ── The kitchen ──────────────────────────────────────────────────────────────
// x → right, y → up, z → towards the camera in James's photo. The back wall
// (cupboards, rangehood, fridge) is z = 0; the island is in the foreground.
export const ROOM = { w: 5.2, h: 2.6, d: 4.8 };

function B(id, label, kind, min, max, spawn = false) {
  return { id, label, kind, min, max, spawn };
}

export const BOXES = [
  // Back run
  B('pillar', 'the pillar', 'pillar', [1.0, 0, 0], [1.3, 2.6, 0.5], true),
  B('bench', 'the back bench', 'bench', [1.3, 0, 0], [3.9, 0.92, 0.62], true),
  B('hood', 'the rangehood', 'hood', [1.5, 1.62, 0], [1.8, 2.6, 0.28]),
  B('overheads', 'the overhead cupboards', 'overheads', [2.0, 1.5, 0], [3.9, 2.22, 0.35], true),
  B('fridge', 'the fridge', 'fridge', [3.9, 0, 0], [4.8, 2.22, 0.68], true),
  B('basket', 'the wicker basket', 'basket', [4.1, 2.22, 0], [4.6, 2.42, 0.42]),
  // On the back bench
  B('jug', 'the water filter', 'jug', [2.0, 0.92, 0], [2.15, 1.2, 0.2]),
  B('toaster', 'the toaster', 'toaster', [2.3, 0.92, 0], [2.6, 1.12, 0.24]),
  B('coffee', 'the coffee machine', 'coffee', [2.75, 0.92, 0], [3.1, 1.34, 0.4]),
  B('grinder', 'the grinder', 'grinder', [3.1, 0.92, 0], [3.24, 1.3, 0.24]),
  B('microwave', 'the microwave', 'microwave', [3.4, 0.92, 0], [3.9, 1.21, 0.42]),
  // On top of the overhead cupboards
  B('board', 'the chopping board', 'board', [2.04, 2.22, 0], [2.34, 2.44, 0.12]),
  B('oil', 'the olive oil', 'oil', [2.34, 2.22, 0], [2.46, 2.44, 0.12]),
  B('vase', 'the roses', 'vase', [2.62, 2.22, 0], [2.82, 2.4, 0.2]),
  B('figurine', 'the little black figurine', 'figurine', [3.0, 2.22, 0], [3.14, 2.45, 0.14]),
  B('books', 'the books', 'books', [3.3, 2.22, 0], [3.56, 2.35, 0.22]),
  B('ivypot', 'the pothos pot', 'ivypot', [3.72, 2.22, 0], [3.88, 2.38, 0.16]),
  // The island (foreground, left) and what's on it
  B('island', 'the island bench', 'island', [0.7, 0, 2.05], [2.5, 0.92, 2.75], true),
  B('bag1', 'a Woolies bag', 'bag', [0.8, 0.92, 2.2], [1.2, 1.32, 2.5]),
  B('salt', 'the salt', 'salt', [1.36, 0.92, 2.45], [1.48, 1.06, 2.57]),
  B('bag2', 'a Woolies bag', 'bag', [1.62, 0.92, 2.18], [1.96, 1.26, 2.48]),
  B('bag3', 'a Woolies bag', 'bag', [1.96, 0.92, 2.16], [2.28, 1.36, 2.46]),
  B('glass', 'the glass', 'glass', [2.3, 0.92, 2.55], [2.42, 1.04, 2.67]),
  // The end bench (foreground, right)
  B('peninsula', 'the end bench', 'peninsula', [3.3, 0, 2.05], [4.4, 0.92, 2.75], true),
  B('airfryer', 'the air fryer', 'airfryer', [3.48, 0.92, 2.2], [3.86, 1.28, 2.56]),
  // On the floor
  B('floorbag1', 'a Woolies bag', 'bag', [3.55, 0, 3.05], [3.95, 0.42, 3.33]),
  B('floorbag2', 'a Woolies bag', 'bag', [4.12, 0, 3.1], [4.48, 0.38, 3.38]),
  B('plant', 'the plant pot', 'plantpot', [0.3, 0, 0], [0.65, 0.48, 0.35]),
];

const NB = BOXES.length;
const BX = new Float64Array(NB * 6);
BOXES.forEach((b, i) => {
  for (let a = 0; a < 3; a++) {
    BX[i * 6 + a] = b.min[a];
    BX[i * 6 + 3 + a] = b.max[a];
  }
});
const RW = [ROOM.w, ROOM.h, ROOM.d];

// ── Vine varieties (one per seat) ────────────────────────────────────────────
export const VARIETIES = [
  { key: 'golden', name: 'Golden Pothos', css: '#f2c94c', leaf: '#3f8d2c', streak: '#e8d65c', glow: '#ffd34d', stem: '#5c8a2e' },
  { key: 'neon', name: 'Neon Pothos', css: '#b8f03c', leaf: '#9fdc2e', streak: '#e4ff8a', glow: '#c8ff3a', stem: '#86b52a' },
  { key: 'marble', name: 'Marble Queen', css: '#f2f2e6', leaf: '#4c8648', streak: '#f6f7ee', glow: '#ffffff', stem: '#7d9a5a' },
  { key: 'cebu', name: 'Cebu Blue', css: '#6fd6e4', leaf: '#5c9c97', streak: '#bfe0da', glow: '#5fd9ff', stem: '#5b8a7c' },
];

// ── Deterministic RNG (mulberry32 over an explicit integer state) ───────────
function rnd(o) {
  o.rs = (o.rs + 0x6d2b79f5) >>> 0;
  let t = o.rs;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// ── Geometry queries ─────────────────────────────────────────────────────────
// -2 = outside the room (inside a wall, the floor or the ceiling), -1 = free
// air, otherwise the index of the box that contains the point. Boxes are
// closed (≤), the room is open, so a point exactly on a face counts as solid.
export function solidAt(x, y, z) {
  if (x < 0 || y < 0 || z < 0 || x > RW[0] || y > RW[1] || z > RW[2]) return -2;
  for (let i = 0; i < NB; i++) {
    const o = i * 6;
    if (x >= BX[o] && x <= BX[o + 3] && y >= BX[o + 1] && y <= BX[o + 4] && z >= BX[o + 2] && z <= BX[o + 5]) return i;
  }
  return -1;
}

const _o = [0, 0, 0];
const _d = [0, 0, 0];

/**
 * Cast a ray through free air. Returns the distance to the first solid face
 * within maxT (or Infinity) and writes the face into `out`:
 * out.axis, out.sign (the face normal, pointing back into the air),
 * out.plane (its coordinate), out.box (-2 for a room face).
 */
export function castFree(ox, oy, oz, dx, dy, dz, maxT, out) {
  _o[0] = ox; _o[1] = oy; _o[2] = oz;
  _d[0] = dx; _d[1] = dy; _d[2] = dz;
  let best = maxT;
  let found = false;
  for (let a = 0; a < 3; a++) {
    const d = _d[a];
    if (d > 0) {
      const t = (RW[a] - _o[a]) / d;
      if (t < best) { best = t; found = true; out.axis = a; out.sign = -1; out.plane = RW[a]; out.box = -2; }
    } else if (d < 0) {
      const t = (0 - _o[a]) / d;
      if (t < best) { best = t; found = true; out.axis = a; out.sign = 1; out.plane = 0; out.box = -2; }
    }
  }
  for (let i = 0; i < NB; i++) {
    let tin = -Infinity;
    let tout = Infinity;
    let inAxis = -1;
    let miss = false;
    for (let a = 0; a < 3; a++) {
      const lo = BX[i * 6 + a];
      const hi = BX[i * 6 + 3 + a];
      const d = _d[a];
      if (d === 0) {
        if (_o[a] < lo || _o[a] > hi) { miss = true; break; }
        continue;
      }
      let t0 = (lo - _o[a]) / d;
      let t1 = (hi - _o[a]) / d;
      if (t0 > t1) { const s = t0; t0 = t1; t1 = s; }
      if (t0 > tin) { tin = t0; inAxis = a; }
      if (t1 < tout) tout = t1;
    }
    // tin < 0 means the ray starts inside this box on the entering axis, i.e.
    // it is leaving it — not a wall ahead. (-0 is fine: we are touching it.)
    if (miss || inAxis < 0 || tin > tout || tin < 0 || tin >= best) continue;
    best = tin;
    found = true;
    const d = _d[inAxis];
    out.axis = inAxis;
    out.sign = d > 0 ? -1 : 1;
    out.plane = d > 0 ? BX[i * 6 + inAxis] : BX[i * 6 + 3 + inAxis];
    out.box = i;
  }
  return found ? best : Infinity;
}

/**
 * From a point INSIDE solid, find where the ray first comes out into free air
 * (the edge of whatever the vine is standing on). Walks through adjacent
 * boxes, so two cupboards of the same height read as one surface. Inside the
 * room's own shell (behind a wall, under the floor) it never comes out.
 */
function castExit(ix, iy, iz, dx, dy, dz, maxT, out) {
  _d[0] = dx; _d[1] = dy; _d[2] = dz;
  let t = 0;
  let edge = Infinity;
  for (let iter = 0; iter < 8; iter++) {
    const px = ix + dx * t;
    const py = iy + dy * t;
    const pz = iz + dz * t;
    const s = solidAt(px, py, pz);
    if (s === -2) return Infinity;
    if (s === -1) return edge; // stepped into the air: the edge we just left
    _o[0] = px; _o[1] = py; _o[2] = pz;
    let tex = Infinity;
    let ax = -1;
    for (let a = 0; a < 3; a++) {
      const d = _d[a];
      if (d > 0) {
        const te = (BX[s * 6 + 3 + a] - _o[a]) / d;
        if (te < tex) { tex = te; ax = a; }
      } else if (d < 0) {
        const te = (BX[s * 6 + a] - _o[a]) / d;
        if (te < tex) { tex = te; ax = a; }
      }
    }
    if (ax < 0) return Infinity;
    const tEdge = t + tex;
    if (tEdge >= maxT) return Infinity;
    edge = tEdge;
    out.axis = ax;
    out.sign = _d[ax] > 0 ? 1 : -1;
    out.plane = _d[ax] > 0 ? BX[s * 6 + 3 + ax] : BX[s * 6 + ax];
    out.box = s;
    t = tEdge + 1e-7;
  }
  return Infinity;
}

// ── The surface walker ───────────────────────────────────────────────────────
// A walker is { x, y, z, na, ns, dx, dy, dz }: a point on a surface, the
// surface normal (axis na ∈ 0..2, sign ns = ±1 — the world is axis-aligned, so
// every normal is one of six) and a unit heading lying in the surface.
const EPS = 1e-4;
const hitC = { axis: 0, sign: 0, plane: 0, box: 0 };
const hitV = { axis: 0, sign: 0, plane: 0, box: 0 };

function setComp(w, a, v) {
  if (a === 0) w.dx = v;
  else if (a === 1) w.dy = v;
  else w.dz = v;
}
function getComp(w, a) {
  return a === 0 ? w.dx : a === 1 ? w.dy : w.dz;
}

// Rotate the heading by 90° about the edge, taking normal n onto normal m.
// With n = sn·e_a and m = sm·e_b: d'_b = sn·sm·d_a (= 0), d'_a = −sn·sm·d_b.
function fold(w, b, sm) {
  const a = w.na;
  const sn = w.ns;
  const db = getComp(w, b);
  setComp(w, a, -sn * sm * db);
  setComp(w, b, 0);
  w.na = b;
  w.ns = sm;
}

/**
 * Move a walker `dist` metres along the surface, folding over ledges and up
 * walls as it meets them. Returns the number of folds (edges crossed); calls
 * onFold(x, y, z, oldCode, newCode) at each, for the trail's corner points.
 */
export function walk(w, dist, onFold) {
  let remaining = dist;
  let folds = 0;
  for (let iter = 0; iter < 6 && remaining > 0; iter++) {
    const nx = w.na === 0 ? w.ns : 0;
    const ny = w.na === 1 ? w.ns : 0;
    const nz = w.na === 2 ? w.ns : 0;
    // Concave: a wall in front of us, just above the surface.
    const tc = castFree(w.x + nx * EPS, w.y + ny * EPS, w.z + nz * EPS, w.dx, w.dy, w.dz, remaining, hitC);
    // Convex: the end of whatever is underneath us, just below the surface.
    const tv = castExit(w.x - nx * EPS, w.y - ny * EPS, w.z - nz * EPS, w.dx, w.dy, w.dz, remaining, hitV);
    if (tc === Infinity && tv === Infinity) {
      w.x += w.dx * remaining;
      w.y += w.dy * remaining;
      w.z += w.dz * remaining;
      break;
    }
    const concave = tc <= tv;
    const t = concave ? tc : tv;
    const h = concave ? hitC : hitV;
    w.x += w.dx * t;
    w.y += w.dy * t;
    w.z += w.dz * t;
    if (h.axis === 0) w.x = h.plane;
    else if (h.axis === 1) w.y = h.plane;
    else w.z = h.plane;
    remaining -= t;
    const before = w.na * 2 + (w.ns > 0 ? 0 : 1);
    fold(w, h.axis, h.sign);
    folds++;
    if (onFold) onFold(w.x, w.y, w.z, before, w.na * 2 + (w.ns > 0 ? 0 : 1));
  }
  return folds;
}

/** Steer: +1 = left, −1 = right, as seen from behind with the surface below. */
export function turn(w, steer) {
  // left = d·cos + (n × d)·sin, with n = ns·e_na
  const s = TURN_S * steer * w.ns;
  let x = w.dx;
  let y = w.dy;
  let z = w.dz;
  if (w.na === 0) { // e_x × d = (0, −dz, dy)
    const ny = y * TURN_C - z * s;
    const nz = z * TURN_C + y * s;
    y = ny; z = nz; x = 0;
  } else if (w.na === 1) { // e_y × d = (dz, 0, −dx)
    const nx = x * TURN_C + z * s;
    const nz = z * TURN_C - x * s;
    x = nx; z = nz; y = 0;
  } else { // e_z × d = (−dy, dx, 0)
    const nx = x * TURN_C - y * s;
    const ny = y * TURN_C + x * s;
    x = nx; y = ny; z = 0;
  }
  const len = Math.sqrt(x * x + y * y + z * z);
  w.dx = x / len;
  w.dy = y / len;
  w.dz = z / len;
}

export function normalOf(code) {
  // code = axis*2 + (sign > 0 ? 0 : 1)
  const a = code >> 1;
  const s = code & 1 ? -1 : 1;
  return [a === 0 ? s : 0, a === 1 ? s : 0, a === 2 ? s : 0];
}

// ── Labels ───────────────────────────────────────────────────────────────────
const ROOM_FACE = {
  0: 'the floor', // +y
  1: 'the ceiling', // −y
  2: 'the back wall', // +z (z = 0)
  3: 'the hallway wall', // −z
  4: 'the photo wall', // +x (x = 0, the framed photos)
  5: 'the window wall', // −x
};

/** Which named thing a point on a surface is on — "the fridge", "the ceiling". */
export function surfaceAt(x, y, z, na, ns) {
  const n = normalOf(na * 2 + (ns > 0 ? 0 : 1));
  const s = solidAt(x - n[0] * 1e-3, y - n[1] * 1e-3, z - n[2] * 1e-3);
  if (s >= 0) {
    const b = BOXES[s];
    if (b.id === 'fridge' && y > 1.86 && !(na === 1 && ns > 0)) return { key: 'fridge', label: 'the cupboard above the fridge' };
    return { key: b.id, label: b.label };
  }
  const face = na === 1 ? (ns > 0 ? 0 : 1) : na === 2 ? (ns > 0 ? 2 : 3) : ns > 0 ? 4 : 5;
  if (face === 2 && y > 0.92 && y < 1.5 && x > 1.3 && x < 3.9) return { key: 'splash', label: 'the splashback' };
  const key = ['floor', 'ceiling', 'backwall', 'hallway', 'photowall', 'windowwall'][face];
  return { key, label: ROOM_FACE[face] };
}

// ── Random surface points ────────────────────────────────────────────────────
// Every face of the room and of the big boxes, weighted by area. A candidate
// is kept only if it really is on a surface: air above it, solid below, and
// room for a vine (12 cm of air) over it.
const FACES = [];
(function buildFaces() {
  const add = (box, axis, sign, plane, lo, hi) => {
    const u = (axis + 1) % 3;
    const v = (axis + 2) % 3;
    const area = (hi[u] - lo[u]) * (hi[v] - lo[v]);
    if (area > 0.02) FACES.push({ box, axis, sign, plane, lo, hi, area });
  };
  for (let a = 0; a < 3; a++) {
    add(-2, a, 1, 0, [0, 0, 0], RW);
    add(-2, a, -1, RW[a], [0, 0, 0], RW);
  }
  BOXES.forEach((b, i) => {
    if (!b.spawn) return;
    for (let a = 0; a < 3; a++) {
      add(i, a, -1, b.min[a], b.min, b.max);
      add(i, a, 1, b.max[a], b.min, b.max);
    }
  });
})();
const FACE_TOTAL = FACES.reduce((s, f) => s + f.area, 0);

export function sampleSurface(o, margin = 0.15) {
  for (let tries = 0; tries < 40; tries++) {
    let r = rnd(o) * FACE_TOTAL;
    let f = FACES[FACES.length - 1];
    for (const face of FACES) {
      r -= face.area;
      if (r <= 0) { f = face; break; }
    }
    const p = [0, 0, 0];
    p[f.axis] = f.plane;
    for (const a of [(f.axis + 1) % 3, (f.axis + 2) % 3]) {
      const lo = f.lo[a] + margin;
      const hi = f.hi[a] - margin;
      p[a] = hi > lo ? lo + rnd(o) * (hi - lo) : (f.lo[a] + f.hi[a]) / 2;
    }
    const n = [0, 0, 0];
    n[f.axis] = f.sign;
    if (solidAt(p[0] + n[0] * 0.002, p[1] + n[1] * 0.002, p[2] + n[2] * 0.002) !== -1) continue;
    if (solidAt(p[0] + n[0] * 0.12, p[1] + n[1] * 0.12, p[2] + n[2] * 0.12) !== -1) continue;
    if (solidAt(p[0] - n[0] * 0.002, p[1] - n[1] * 0.002, p[2] - n[2] * 0.002) === -1) continue;
    return { x: p[0], y: p[1], z: p[2], na: f.axis, ns: f.sign };
  }
  return { x: 2.6, y: 0, z: 1.4, na: 1, ns: 1 }; // the middle of the floor
}

// ── The trail store (spatial hash over every vine's points) ─────────────────
const CELL = 0.1;
function cellKey(ix, iy, iz) {
  return ix + 4 + 64 * (iy + 4 + 40 * (iz + 4));
}

function newLane() {
  // a: normal code of the face the point is on (0..5), or 6 + 6·from + to for
  // a corner point laid where the vine folded over an edge.
  return { x: [], y: [], z: [], s: [], a: [] };
}

export class Trail {
  constructor(n) {
    this.cells = new Map();
    this.v = Array.from({ length: n }, newLane);
    this.lastD2 = 0;
  }

  add(i, x, y, z, s, a) {
    const lane = this.v[i];
    const j = lane.x.length;
    lane.x.push(x); lane.y.push(y); lane.z.push(z); lane.s.push(s); lane.a.push(a);
    const k = cellKey(Math.floor(x / CELL), Math.floor(y / CELL), Math.floor(z / CELL));
    let c = this.cells.get(k);
    if (!c) this.cells.set(k, (c = []));
    c.push(i * 1048576 + j);
  }

  /** Owner of the nearest point within r of (x,y,z), ignoring `self`'s own
   *  points newer than selfMaxS; -1 if none. Sets this.lastD2. */
  hit(x, y, z, r, self, selfMaxS) {
    const r2 = r * r;
    let best = -1;
    let bd = r2;
    const ix = Math.floor(x / CELL);
    const iy = Math.floor(y / CELL);
    const iz = Math.floor(z / CELL);
    const reach = Math.ceil(r / CELL); // 1 for a vine hit; more for wide "is it cluttered here" asks
    for (let a = -reach; a <= reach; a++) {
      for (let b = -reach; b <= reach; b++) {
        for (let c = -reach; c <= reach; c++) {
          const cell = this.cells.get(cellKey(ix + a, iy + b, iz + c));
          if (!cell) continue;
          for (let q = 0; q < cell.length; q++) {
            const id = cell[q];
            const i = Math.floor(id / 1048576);
            const j = id - i * 1048576;
            const lane = this.v[i];
            if (i === self && lane.s[j] > selfMaxS) continue;
            const ddx = lane.x[j] - x;
            const ddy = lane.y[j] - y;
            const ddz = lane.z[j] - z;
            const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
            if (d2 < bd || (d2 === bd && best >= 0 && i < best)) {
              bd = d2;
              best = i;
            }
          }
        }
      }
    }
    this.lastD2 = bd;
    return best;
  }

  count() {
    return this.v.reduce((n, l) => n + l.x.length, 0);
  }
}

/** A speculative layer over a Trail: reads through to the base, writes to
 *  itself. The page runs its prediction on one of these every frame. */
class TrailOverlay {
  constructor(base) {
    this.base = base;
    this.v = base.v.map(newLane);
    this.lastD2 = 0;
  }

  add(i, x, y, z, s, a) {
    const lane = this.v[i];
    lane.x.push(x); lane.y.push(y); lane.z.push(z); lane.s.push(s); lane.a.push(a);
  }

  hit(x, y, z, r, self, selfMaxS) {
    let best = this.base.hit(x, y, z, r, self, selfMaxS);
    let bd = this.base.lastD2;
    for (let i = 0; i < this.v.length; i++) {
      const lane = this.v[i];
      for (let j = 0; j < lane.x.length; j++) {
        if (i === self && lane.s[j] > selfMaxS) continue;
        const ddx = lane.x[j] - x;
        const ddy = lane.y[j] - y;
        const ddz = lane.z[j] - z;
        const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
        if (d2 < bd || (d2 === bd && best >= 0 && i < best)) {
          bd = d2;
          best = i;
        }
      }
    }
    this.lastD2 = bd;
    return best;
  }
}

// ── Inputs ───────────────────────────────────────────────────────────────────
// One integer per input: steer (−1 right, 0, +1 left) and sprint (0/1).
export const code = (steer, boost) => steer + 1 + (boost ? 3 : 0);
export const steerOf = (c) => (c % 3) - 1;
export const boostOf = (c) => c >= 3;

// ── The round simulation ─────────────────────────────────────────────────────
/**
 * new Sim(seed, n) — n vines, spawned from the seed. Each vine reads its
 * inputs from vine.log, an array of [tick, code] sorted by tick, which the
 * owner (server rules, or the page) keeps up to date. step() advances one
 * tick; events (deaths, pickups) accumulate in sim.events for the caller.
 */
export class Sim {
  constructor(seed, n) {
    this.seed = seed >>> 0;
    this.rs = this.seed;
    this.tick = 0;
    this.n = n;
    this.trail = new Trail(n);
    this.events = [];
    this.pid = 0;
    this.pickups = [];
    this.sunAt = SUN_FIRST;
    this.dewAt = [];
    this.vines = [];
    this.spec = false;

    // Spawns: random surface points at least 1.6 m apart (relaxing if the
    // dice won't co-operate), each facing a random direction in its surface.
    const spots = [];
    for (let i = 0; i < n; i++) {
      let spot = null;
      for (let tries = 0; tries < 30 && !spot; tries++) {
        const c = sampleSurface(this, 0.3);
        const need = tries < 20 ? 1.6 : 0.9;
        if (spots.every((s) => dist2(s, c) >= need * need)) spot = c;
      }
      if (!spot) spot = sampleSurface(this, 0.3);
      spots.push(spot);
      const w = { x: spot.x, y: spot.y, z: spot.z, na: spot.na, ns: spot.ns, dx: 0, dy: 0, dz: 0 };
      let u = 0;
      let v = 0;
      let len = 0;
      while (len < 0.2) {
        u = rnd(this) * 2 - 1;
        v = rnd(this) * 2 - 1;
        len = Math.sqrt(u * u + v * v);
      }
      setComp(w, (spot.na + 1) % 3, u / len);
      setComp(w, (spot.na + 2) % 3, v / len);
      this.vines.push({
        i,
        w,
        alive: true,
        s: 0,
        energy: ENERGY_START,
        boosting: false,
        code: code(0, false),
        log: [],
        lp: 0,
        deadTick: -1,
        by: -1,
        stats: { suns: 0, dews: 0, kills: 0, ceiling: 0, fridge: 0, floor: 0, walls: 0, boost: 0, folds: 0 },
      });
      this.trail.add(i, w.x, w.y, w.z, 0, w.na * 2 + (w.ns > 0 ? 0 : 1));
    }
    for (let k = 0; k < DEW_COUNT; k++) this.spawnPickup(1);
  }

  alive() {
    return this.vines.filter((v) => v.alive).length;
  }

  stepLen(tick, boosting) {
    return BASE_STEP * (1 + RAMP * tick) * (boosting ? BOOST_MUL : 1);
  }

  /** Advance one tick. */
  step() {
    const k = ++this.tick;
    const moving = [];
    for (const v of this.vines) {
      if (!v.alive) continue;
      while (v.lp < v.log.length && v.log[v.lp][0] <= k) v.code = v.log[v.lp++][1];
      const steer = steerOf(v.code);
      if (steer !== 0) turn(v.w, steer);
      v.boosting = boostOf(v.code) && v.energy > 0;
      if (v.boosting) {
        v.energy = Math.max(0, v.energy - ENERGY_DRAIN);
        v.stats.boost++;
      } else {
        v.energy = Math.min(ENERGY_MAX, v.energy + ENERGY_REGEN);
      }
      v.sub = this.stepLen(k, v.boosting) / SUB;
      moving.push(v);
    }

    for (let sub = 0; sub < SUB; sub++) {
      // 1. everyone moves
      for (const v of moving) {
        if (!v.alive) continue;
        const i = v.i;
        walk(v.w, v.sub, (x, y, z, from, to) => {
          this.trail.add(i, x, y, z, v.s, 6 + from * 6 + to);
          v.stats.folds++;
        });
        v.s += v.sub;
      }
      // 2. everyone checks, against the trail as it stood before this substep
      const dead = [];
      for (const v of moving) {
        if (!v.alive) continue;
        const w = v.w;
        let by = this.trail.hit(w.x, w.y, w.z, HIT_R, v.i, v.s - SELF_IGNORE);
        if (by < 0) {
          for (const o of moving) {
            if (o === v || !o.alive) continue;
            const ddx = o.w.x - w.x;
            const ddy = o.w.y - w.y;
            const ddz = o.w.z - w.z;
            if (ddx * ddx + ddy * ddy + ddz * ddz < HIT_R * HIT_R) {
              by = o.i;
              break;
            }
          }
        }
        if (by >= 0) dead.push([v, by]);
      }
      // 3. deaths land together, so nobody wins a tie by being first in the list
      for (const [v, by] of dead) {
        v.alive = false;
        v.deadTick = k;
        v.by = by;
        if (by !== v.i) this.vines[by].stats.kills++;
        const where = surfaceAt(v.w.x, v.w.y, v.w.z, v.w.na, v.w.ns);
        this.events.push({ t: 'die', k, i: v.i, by, x: v.w.x, y: v.w.y, z: v.w.z, where: where.label });
      }
      // 4. lay the new points (the dead vine's last one too — it is part of the vine)
      for (const v of moving) {
        if (v.deadTick !== -1 && v.deadTick !== k) continue;
        if (!v.alive && v.layedLast) continue;
        const w = v.w;
        this.trail.add(v.i, w.x, w.y, w.z, v.s, w.na * 2 + (w.ns > 0 ? 0 : 1));
        if (!v.alive) v.layedLast = true;
      }
      // 5. pickups
      for (const p of this.pickups) {
        if (!p.live) continue;
        let taker = null;
        let bd = PICK_R * PICK_R;
        for (const v of moving) {
          if (!v.alive) continue;
          const ddx = v.w.x - p.x;
          const ddy = v.w.y - p.y;
          const ddz = v.w.z - p.z;
          const d2 = ddx * ddx + ddy * ddy + ddz * ddz;
          if (d2 < bd) {
            bd = d2;
            taker = v;
          }
        }
        if (!taker) continue;
        p.live = false;
        if (p.kind === 0) {
          taker.stats.suns++;
          taker.energy = Math.min(ENERGY_MAX, taker.energy + SUN_ENERGY);
          this.sunAt = k + SUN_GAP;
        } else {
          taker.stats.dews++;
          taker.energy = Math.min(ENERGY_MAX, taker.energy + DEW_ENERGY);
          this.dewAt.push(k + DEW_GAP);
        }
        this.events.push({ t: 'pick', k, i: taker.i, kind: p.kind, id: p.id, x: p.x, y: p.y, z: p.z });
      }
    }

    // Where everyone is, for the end-of-match awards.
    for (const v of moving) {
      if (!v.alive) continue;
      const w = v.w;
      if (w.na === 1) {
        if (w.ns < 0 && w.y >= RW[1]) v.stats.ceiling++;
        else if (w.ns > 0 && w.y <= 0) v.stats.floor++;
      } else if ((w.na === 0 && (w.x <= 0 || w.x >= RW[0])) || (w.na === 2 && (w.z <= 0 || w.z >= RW[2]))) {
        v.stats.walls++;
      }
      if (w.x >= 3.9 && w.x <= 4.8 && w.z <= 0.68 && w.y <= 2.22) v.stats.fridge++;
    }

    // Respawn pickups.
    if (!this.pickups.some((p) => p.live && p.kind === 0) && k >= this.sunAt) this.spawnPickup(0);
    for (let q = this.dewAt.length - 1; q >= 0; q--) {
      if (k >= this.dewAt[q]) {
        this.dewAt.splice(q, 1);
        this.spawnPickup(1);
      }
    }
  }

  spawnPickup(kind) {
    const away = kind === 0 ? 1.1 : 0.6;
    let pick = null;
    let bestScore = -1;
    for (let tries = 0; tries < 16; tries++) {
      const c = sampleSurface(this, 0.18);
      let near = Infinity;
      for (const v of this.vines) {
        if (!v.alive) continue;
        near = Math.min(near, dist2(v.w, c));
      }
      const clutter = this.trail.hit(c.x, c.y, c.z, 0.2, -1, 0) >= 0;
      const score = (clutter ? 0 : 10) + Math.min(near, away * away);
      if (score > bestScore) {
        bestScore = score;
        pick = c;
      }
      if (!clutter && near >= away * away) break;
    }
    // Float a little off the surface so it reads as a droplet, not a decal.
    const n = normalOf(pick.na * 2 + (pick.ns > 0 ? 0 : 1));
    this.pickups.push({
      id: ++this.pid,
      kind,
      live: true,
      x: pick.x + n[0] * 0.03,
      y: pick.y + n[1] * 0.03,
      z: pick.z + n[2] * 0.03,
      na: pick.na,
      ns: pick.ns,
      at: this.tick,
    });
    if (this.pickups.length > 40) this.pickups = this.pickups.filter((p) => p.live);
  }

  /** A cheap copy for prediction: vines, pickups and RNG are copied, the
   *  trail is a read-through overlay. Logs are shared (read-only here). */
  fork() {
    const f = Object.create(Sim.prototype);
    f.seed = this.seed;
    f.rs = this.rs;
    f.tick = this.tick;
    f.n = this.n;
    f.trail = new TrailOverlay(this.trail);
    f.events = [];
    f.pid = this.pid;
    f.pickups = this.pickups.map((p) => ({ ...p }));
    f.sunAt = this.sunAt;
    f.dewAt = this.dewAt.slice();
    f.spec = true;
    f.vines = this.vines.map((v) => ({
      ...v,
      w: { ...v.w },
      stats: { ...v.stats },
    }));
    return f;
  }
}

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

// ── Bots ─────────────────────────────────────────────────────────────────────
// Server only. A bot looks ~0.7 s ahead along a handful of steering choices,
// throws out the ones that crash, and prefers the one that gets closest to
// the sun drop (or a dew drop). Its choices go into its log like anyone
// else's, so replays and phones never run this.
const probe = { x: 0, y: 0, z: 0, na: 0, ns: 0, dx: 0, dy: 0, dz: 0 };
const PLANS = [
  [0, 99], [1, 99], [-1, 99], [1, 10], [-1, 10], [1, 5], [-1, 5], [1, 2], [-1, 2],
];

export function botDecide(sim, v, random = Math.random) {
  const k = sim.tick + 1;
  let target = null;
  let td = Infinity;
  for (const p of sim.pickups) {
    if (!p.live) continue;
    const d = dist2(v.w, p) * (p.kind === 0 ? 0.45 : 1);
    if (d < td) {
      td = d;
      target = p;
    }
  }
  const H = 26;
  let best = null;
  let bestScore = -Infinity;
  const cur = steerOf(v.code);
  for (const [steer, hold] of PLANS) {
    Object.assign(probe, v.w);
    let s = v.s;
    let survived = 0;
    let closest = target ? Math.sqrt(dist2(probe, target)) : 0;
    const len = sim.stepLen(k, false) / SUB;
    let crashed = false;
    let cramped = 0;
    for (let t = 0; t < H && !crashed; t++) {
      if (t < hold && steer !== 0) turn(probe, steer);
      for (let q = 0; q < SUB; q++) {
        walk(probe, len, null);
        s += len;
        if (sim.trail.hit(probe.x, probe.y, probe.z, HIT_R * 1.6, v.i, s - SELF_IGNORE - 0.05) >= 0) {
          crashed = true;
          break;
        }
        for (const o of sim.vines) {
          if (o === v || !o.alive) continue;
          if (dist2(o.w, probe) < 0.22 * 0.22) {
            crashed = true;
            break;
          }
        }
        if (crashed) break;
      }
      if (!crashed) survived = t + 1;
      if (target) closest = Math.min(closest, Math.sqrt(dist2(probe, target)));
      // Room to manoeuvre: vine within a turning circle of where this plan
      // goes is a trap even if the plan itself doesn't touch it.
      if (!crashed && (t === 12 || t === H - 1) && sim.trail.hit(probe.x, probe.y, probe.z, 0.3, v.i, s - 0.6) >= 0) cramped++;
    }
    // Not crashing dominates everything; then open space; among those,
    // closing on the target wins, with a little noise so bots don't mirror.
    let score = (survived === H ? 400 : survived * 14) - cramped * 70 - closest * 9 + random() * 3;
    if (steer === cur) score += 5; // hysteresis: don't flip-flop between near-equal plans
    if (hold === 99 && steer !== 0) score -= 2; // circling is a last resort
    if (score > bestScore) {
      bestScore = score;
      best = { steer, survived };
    }
  }
  const boost = v.energy > 350 && best.survived === H && target && td < 2.2 && random() < 0.7;
  return code(best.steer, boost);
}
