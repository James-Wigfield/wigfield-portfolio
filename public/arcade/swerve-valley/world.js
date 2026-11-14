/* ============================================================================
   SWERVE VALLEY — shared world module
   ----------------------------------------------------------------------------
   Imported by BOTH sides:
     • the page   (public/arcade/swerve-valley/*.js → ./world.js)
     • the server (workers/arcade/games/swerve-valley.js, bundled by wrangler)
   so the road, every kangaroo, every fork and every quiz question come from
   one seed through one function and the two sides can never disagree.

   Pure and deterministic: seeded PRNG, no Date, no Math.random, no DOM.

   The road is a classic pseudo-3D segment road. z is distance along the road
   in world units (SEG per segment). x is the bus's lateral position in ROAD
   HALF-WIDTHS: −1 and +1 are the edges of the bitumen, 0 is the centre line.

   The trick that keeps every moving hazard server-checkable: a hazard's
   position is a function of the BUS's z, never of time. A cyclist rides at
   55 % of whatever the bus does, so the bus always overtakes them at the same
   z (`cz`), and a kangaroo is halfway across the road when the bus is a fixed
   distance away. The server can therefore judge every hit from two position
   reports without knowing anything about frame timing.
   ========================================================================== */

export const SLUG = 'swerve-valley';

// ── The tour party ───────────────────────────────────────────────────────────
// Real people, so every joke in this game is about the DAY, never about them.
// `wear` is the thing the wind tries to steal on the open top deck.
export const CAST = [
  { id: 'mandyh', name: 'Mandy Hoare', short: 'Mandy H', wear: 'sunnies', color: '#ff7a6b' },
  { id: 'doug', name: 'Doug Corby', short: 'Doug', wear: 'straw hat', color: '#5b8dd6' },
  { id: 'kathy', name: 'Kathy Wigfield', short: 'Kathy', wear: 'scarf', color: '#2bb5a6' },
  { id: 'david', name: 'David Wilson', short: 'David', wear: 'aviators', color: '#3d4f8f' },
  { id: 'john', name: 'John Patton', short: 'John', wear: 'flat cap', color: '#9a7b4f' },
  { id: 'kelly', name: 'Kelly Savin', short: 'Kelly', wear: 'flower', color: '#e8b52f' },
  { id: 'louise', name: 'Louise Slater', short: 'Louise', wear: 'sun hat', color: '#f07fb0' },
  { id: 'nick', name: 'Nick Hoare', short: 'Nick', wear: 'cap', color: '#3fae5a' },
  { id: 'james', name: 'James Wigfield', short: 'James', wear: 'sunnies', color: '#6fa8dc' },
  { id: 'mandyf', name: 'Mandy Fletcher', short: 'Mandy F', wear: 'scarf', color: '#9b6bd6' },
  { id: 'mike', name: 'Mike Savin', short: 'Mike', wear: 'bucket hat', color: '#f08a2c' },
];
export const CAST_IDS = CAST.map((c) => c.id);
export const CAST_BY_ID = Object.fromEntries(CAST.map((c, i) => [c.id, { ...c, index: i }]));

// ── Wineries ─────────────────────────────────────────────────────────────────
// Made-up cellar doors (puns on the party's surnames). Each one has its own
// tasting game. The server shuffles their ORDER per tour, not their game.
export const WINERIES = [
  {
    id: 'cabsavin',
    name: 'Cab Savin Estate',
    wine: 'Cabernet Sauvignon',
    game: 'pour',
    colour: '#6b0f24',
    host: 'The cellar hand',
    line: 'A firm Cabernet. Pour to the line — we can tell.',
  },
  {
    id: 'corby',
    name: 'Corby Creek',
    wine: 'Shiraz',
    game: 'stomp',
    colour: '#4a0b2e',
    host: 'The winemaker',
    line: 'Shoes off. This vintage is stomped by guests.',
  },
  {
    id: 'patton',
    name: 'Patton Ridge',
    wine: 'Chardonnay',
    game: 'cheese',
    colour: '#e9d27a',
    host: 'The kitchen',
    line: 'The cheese board is out. It will not last.',
  },
  {
    id: 'slater',
    name: "Slater's Folly",
    wine: 'Sauvignon Blanc',
    game: 'quiz',
    colour: '#e6e08a',
    host: 'The sommelier',
    line: 'A quick quiz on tasting notes. No phones. Well — only phones.',
  },
  {
    id: 'fletcher',
    name: "Fletcher's Hill",
    wine: 'Rosé',
    game: 'stack',
    colour: '#f29bb0',
    host: 'The cellar hand',
    line: 'You bought six cases. They go on the bus. Carefully.',
  },
];
// Wrong-way signs at the forks.
export const DECOYS = [
  'Hoare Hill',
  'Wilson & Sons',
  'Wigfield Cellars',
  'Gravel Pit Rd',
  'Muddy Creek',
  'Dead End',
  'Somebody’s Farm',
];
export const HOME = { id: 'home', name: 'The Pickup Point', decoy: 'One More Winery?' };

export const LEGS = 6; //   five wineries, then home
export const STOPS = 5;

// Time of day per leg, for the sky and the copy.
export const TOD = [
  { clock: '10:00 am', sky: ['#5fb4ee', '#bfe6fb'], sun: '#fff6c8', ground: ['#7bb04a', '#6fa443'], dusk: 0 },
  { clock: '11:20 am', sky: ['#4aa6ea', '#b5e2fb'], sun: '#fff7d0', ground: ['#7aae48', '#6ca040'], dusk: 0 },
  { clock: '12:45 pm', sky: ['#3f9ce6', '#aedcf7'], sun: '#ffffff', ground: ['#82b44c', '#72a644'], dusk: 0 },
  { clock: '2:10 pm', sky: ['#58a2dc', '#f3e0a8'], sun: '#ffe9a0', ground: ['#8cb04a', '#7aa242'], dusk: 0.15 },
  { clock: '3:40 pm', sky: ['#6d8fd0', '#f7b878'], sun: '#ffc870', ground: ['#94a848', '#83993f'], dusk: 0.35 },
  { clock: '6:10 pm', sky: ['#2b2a5e', '#f08a5d'], sun: '#ff7a4a', ground: ['#4f6a3a', '#465f34'], dusk: 0.8 },
];

// ── Drinks ───────────────────────────────────────────────────────────────────
export const DRINKS = {
  spit: { label: 'Spit bucket', tip: 0, fun: 2, line: 'Swirl, sniff, spit. Very professional.' },
  sip: { label: 'A sip', tip: 10, fun: 8, line: 'Just a taste.' },
  glass: { label: 'A glass', tip: 20, fun: 16, line: 'Well, it would be rude not to.' },
  skull: { label: 'Skull it', tip: 32, fun: 28, line: 'Tasting notes: gone.' },
  juice: { label: 'Grape juice', tip: -10, fun: 4, line: 'Designated driver. Hero of the day.' },
};
export const DRINK_KEYS = ['spit', 'sip', 'glass', 'skull'];

// Tipsiness 0..100 → tier. Each tier changes how YOUR phone behaves.
export const TIERS = [
  { min: 0, name: 'Fresh', blurb: 'Steady as a rock.' },
  { min: 18, name: 'Merry', blurb: 'The bus is swaying. Or you are.' },
  { min: 36, name: 'Tipsy', blurb: 'Seeing double. Tap the real one.' },
  { min: 56, name: 'Sloshed', blurb: 'Left is right now. Sometimes.' },
  { min: 85, name: 'Snoozing', blurb: 'You may nod off on the bus.' },
];
export function tier(t) {
  for (let i = TIERS.length - 1; i >= 0; i--) if (t >= TIERS[i].min) return i;
  return 0;
}
export const SLEEP_AT = 85;

// ── Road + bus physics ───────────────────────────────────────────────────────
export const PHYS = {
  SEG: 200, //          world units per segment
  ROAD_W: 2000, //      half-width of the road in world units (for the renderer)
  CRUISE_V: 7400, //    auto-throttle target, units/s (~37 segments/s)
  MAX_V: 8000,
  ACCEL: 3800,
  BRAKE: 11000,
  OFF_MAX: 3600, //     top speed on the gravel
  OFF_DECEL: 7000,
  STEER: 2.3, //        road half-widths per second at full lock and full speed
  CENTRIFUGAL: 0.24,
  BUS_W: 0.5, //        bus width, in road half-widths
  X_LIMIT: 2.2,
  HIT_SLOW: 0.38, //    speed multiplier after a hit
  PARK_LEAD: 9000, //   the car park starts this far before the bay
  PARK_PERFECT: 520, // |z − bay| for a perfect park
  PARK_OK: 1500,
  PARK_V: 4300, //      the bus slows to car-park speed on its own
};

const SEG = PHYS.SEG;

export const HAZARDS = {
  roo: { w: 0.34, rating: -3, label: 'Kangaroo!', bonk: 'BOING' },
  sheep: { w: 0.4, rating: -2, label: 'Sheep!', bonk: 'BAA' },
  cyclist: { w: 0.26, rating: -4, label: 'Cyclist!', bonk: 'OI!' },
  tractor: { w: 0.66, rating: -3, label: 'Tractor!', bonk: 'CLUNK' },
  barrel: { w: 0.32, rating: -2, label: 'Barrel!', bonk: 'THUD' },
  pothole: { w: 0.36, rating: -1, label: 'Pothole!', bonk: 'KA-DUNK' },
  sign: { w: 0.3, rating: -3, label: 'Signpost!', bonk: 'BONK' },
};

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const easeIn = (a, b, p) => a + (b - a) * p * p;
const easeOut = (a, b, p) => a + (b - a) * (1 - (1 - p) * (1 - p));
const easeInOut = (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5);
export const clamp = (n, a, b) => (n < a ? a : n > b ? b : n);
const smooth = (p) => p * p * (3 - 2 * p);

// Leg lengths in segments (before the fork / car park finale).
const LEG_SEGS = [950, 1150, 1200, 1250, 1300, 1350];

/**
 * Build one leg's road. Cached by callers — it is ~1 600 segments.
 * @returns {{
 *   leg:number, n:number, curve:Float32Array, y:Float32Array,
 *   forkZ:number, forkSide:-1|1, parkZ:number, endZ:number,
 *   haz:Array, leans:Array, photoZ:number, setZ:number, startZ:number
 * }}
 */
export function buildLeg(seed, leg) {
  const rnd = mulberry32((seed ^ Math.imul(leg + 1, 0x9e3779b1)) >>> 0);
  const curves = [];
  const ys = [];
  const leans = [];
  let lastY = 0;

  const add = (enter, hold, leave, curve, hill) => {
    const startY = lastY;
    const endY = startY + hill * SEG;
    const total = enter + hold + leave;
    for (let n = 0; n < enter; n++) {
      curves.push(easeIn(0, curve, n / enter));
      ys.push(easeInOut(startY, endY, (n + 1) / total));
    }
    for (let n = 0; n < hold; n++) {
      curves.push(curve);
      ys.push(easeInOut(startY, endY, (enter + n + 1) / total));
    }
    for (let n = 0; n < leave; n++) {
      curves.push(easeOut(curve, 0, n / leave));
      ys.push(easeInOut(startY, endY, (enter + hold + n + 1) / total));
    }
    lastY = endY;
  };
  const straight = (n, hill = 0) => add(Math.floor(n / 4), Math.ceil(n / 2), Math.floor(n / 4), 0, hill);
  const pickHill = () => {
    const r = rnd();
    if (r < 0.45) return 0;
    const h = (r < 0.75 ? 12 : 26) * (rnd() < 0.5 ? -1 : 1);
    // keep the road roughly at sea level so the horizon never vanishes
    if (Math.abs(lastY / SEG + h) > 50) return -h;
    return h;
  };

  // Opening straight: the bus pulls away from the kerb.
  straight(40);
  const target = LEG_SEGS[leg] ?? 1200;
  const bigChance = [0.25, 0.4, 0.45, 0.5, 0.55, 0.55][leg] ?? 0.5;

  while (curves.length < target) {
    const r = rnd();
    if (r < 0.22) {
      straight(30 + Math.floor(rnd() * 40), pickHill());
    } else if (r < 0.22 + bigChance * 0.5) {
      // big bend → passengers must lean
      const dir = rnd() < 0.5 ? -1 : 1;
      const c = dir * (3.2 + rnd() * 1.4);
      leans.push({ z: curves.length * SEG, dir });
      add(18, 30 + Math.floor(rnd() * 25), 18, c, pickHill());
    } else if (r < 0.22 + bigChance * 0.5 + 0.12 && leg > 0) {
      // S-bend
      const dir = rnd() < 0.5 ? -1 : 1;
      const c = 2.6 + rnd() * 1.2;
      leans.push({ z: curves.length * SEG, dir });
      add(14, 22, 14, dir * c, 0);
      leans.push({ z: curves.length * SEG, dir: -dir });
      add(14, 22, 14, -dir * c, pickHill());
    } else {
      const dir = rnd() < 0.5 ? -1 : 1;
      add(20, 25 + Math.floor(rnd() * 30), 20, dir * (1.2 + rnd() * 1.3), pickHill());
    }
  }

  // Finale: level straight to the fork, then the car park and the hedge.
  add(20, 20, 20, 0, -lastY / SEG);
  const forkSeg = curves.length + 30;
  straight(30);
  straight(84);
  const parkSeg = forkSeg + 70;
  const endSeg = parkSeg + 9;
  straight(200); // tail so the renderer always has road to draw

  const n = curves.length;
  const curve = new Float32Array(curves);
  const y = new Float32Array(ys);

  const forkZ = forkSeg * SEG;
  const parkZ = parkSeg * SEG;
  const endZ = endSeg * SEG;
  const startZ = 6 * SEG;
  const forkSide = rnd() < 0.5 ? -1 : 1;

  // ── Hazards ────────────────────────────────────────────────────────────
  const haz = [];
  let hid = 0;
  const mk = (k, cz, x, extra = {}) =>
    haz.push({ id: `${leg}.${hid++}`, k, cz, base: cz, kz: 0, a: x, b: x, span: 0, w: HAZARDS[k].w, ...extra });

  const gapBase = [84, 72, 66, 60, 56, 52][leg] ?? 60;
  let s = 70;
  const lastHazSeg = forkSeg - 40;
  const weights = [
    { pothole: 3, sheep: 3, barrel: 2, roo: 1 },
    { pothole: 2, sheep: 3, barrel: 2, roo: 2, cyclist: 2 },
    { pothole: 2, sheep: 2, barrel: 1, roo: 3, cyclist: 2, tractor: 2, mob: 1 },
    { pothole: 2, sheep: 2, barrel: 2, roo: 3, cyclist: 3, tractor: 2, mob: 2 },
    { pothole: 1, sheep: 2, barrel: 2, roo: 4, cyclist: 3, tractor: 2, mob: 2 },
    { pothole: 1, sheep: 1, barrel: 1, roo: 5, cyclist: 1, tractor: 1, mob: 2 },
  ][leg];
  const pick = () => {
    let total = 0;
    for (const k in weights) total += weights[k];
    let r = rnd() * total;
    for (const k in weights) {
      r -= weights[k];
      if (r <= 0) return k;
    }
    return 'pothole';
  };
  const side = () => (rnd() < 0.5 ? -1 : 1);

  while (s < lastHazSeg) {
    const cz = s * SEG;
    const k = pick();
    if (k === 'roo') {
      const from = side() * 1.6;
      const to = -Math.sign(from) * (0.15 + rnd() * 0.75);
      mk('roo', cz, to, { a: from, b: to, span: PHYS.CRUISE_V * 1.4 });
      if (leg >= 4 && rnd() < 0.4) {
        // a second roo a beat behind, the other way
        const f2 = -from;
        const t2 = -to * 0.6;
        mk('roo', cz + 9 * SEG, t2, { a: f2, b: t2, span: PHYS.CRUISE_V * 1.2 });
      }
    } else if (k === 'cyclist' || k === 'tractor') {
      const kz = k === 'cyclist' ? 0.55 : 0.38;
      const x = k === 'tractor' ? side() * 0.5 : side() * (0.35 + rnd() * 0.3);
      mk(k, cz, x, { kz, base: cz * (1 - kz) });
      if (k === 'cyclist' && rnd() < 0.45) {
        const x2 = clamp(x + (x > 0 ? -0.3 : 0.3), -0.8, 0.8);
        mk('cyclist', cz + 3 * SEG, x2, { kz, base: (cz + 3 * SEG) * (1 - kz) });
      }
    } else if (k === 'mob') {
      // three sheep across the road with one gap the bus fits through
      const gap = [-0.62, 0, 0.62][Math.floor(rnd() * 3)];
      for (const x of [-0.62, 0, 0.62]) {
        if (x === gap) continue;
        mk('sheep', cz + Math.floor(rnd() * 3) * SEG, x + (rnd() - 0.5) * 0.08);
      }
    } else {
      mk(k, cz, side() * (0.1 + rnd() * 0.65));
    }
    s += Math.floor(gapBase * (0.7 + rnd() * 0.6));
  }
  // The fork's own signpost, slap in the middle.
  mk('sign', forkZ, 0);

  const len = n * SEG;
  return {
    leg,
    n,
    len,
    curve,
    y,
    forkZ,
    forkSide,
    parkZ,
    endZ,
    startZ,
    haz,
    leans: spaceLeans(leans, forkZ, LEAN_CAP[leg] ?? 3).map((l, i) => ({ id: `L${leg}.${i}`, ...l })),
    photoZ: Math.floor(lastHazSeg * 0.45) * SEG,
    setZ: Math.floor(lastHazSeg * 0.62) * SEG,
  };
}

// Not every bend is a lean: a handful per leg, well apart, so "LEAN!" stays an
// event rather than a chore.
const LEAN_CAP = [1, 2, 3, 3, 4, 4];
function spaceLeans(leans, forkZ, cap) {
  const out = [];
  for (const l of leans) {
    if (l.z < 70 * SEG || l.z > forkZ - 40 * SEG) continue;
    if (out.length && l.z - out[out.length - 1].z < 240 * SEG) continue;
    out.push(l);
  }
  // keep the biggest spread if there are too many: drop every other
  while (out.length > cap) out.splice(1 + Math.floor((out.length - 1) / 2), 1);
  return out;
}

/** Where a hazard is along the road when the bus is at Z. */
export function hazZ(h, Z) {
  return h.kz ? h.base + h.kz * Z : h.cz;
}
/** Where a hazard is across the road when the bus is at Z. */
export function hazX(h, Z) {
  if (h.k === 'roo') {
    const p = clamp((Z - (h.cz - h.span * 0.72)) / h.span, 0, 1);
    return h.a + (h.b - h.a) * smooth(p);
  }
  if (h.k === 'sheep') return h.a + 0.06 * Math.sin((Z - h.cz) / 900);
  return h.a;
}
/** Roo hop phase 0..1 (for animation only). */
export function rooPhase(h, Z) {
  return clamp((Z - (h.cz - h.span * 0.72)) / h.span, 0, 1);
}

/**
 * Hazards the bus crossed between two reports, and whether it hit them.
 * Shared by the driver's phone (instant feedback) and the server (authority).
 */
export function crossings(track, z0, x0, z1, x1, skip) {
  const out = [];
  if (z1 <= z0) return out;
  for (const h of track.haz) {
    if (h.cz <= z0 || h.cz > z1) continue;
    if (skip && skip.has(h.id)) continue;
    const t = (h.cz - z0) / (z1 - z0);
    const xc = x0 + (x1 - x0) * t;
    const hx = hazX(h, h.cz);
    const hit = Math.abs(xc - hx) < (h.w + PHYS.BUS_W) / 2 - 0.03;
    out.push({ h, hit, xc });
  }
  return out;
}

/**
 * Best lateral line through whatever is coming up — the autopilot (and the
 * headless checks' robot driver) steer for this.
 */
export function safeLine(track, z, x, look = 9000) {
  let best = 0;
  let bestCost = Infinity;
  for (let c = -0.8; c <= 0.801; c += 0.1) {
    let cost = Math.abs(c - x) * 0.4 + Math.abs(c) * 0.15;
    for (const h of track.haz) {
      const dz = h.cz - z;
      if (dz <= 0 || dz > look) continue;
      const clear = (h.w + PHYS.BUS_W) / 2 + 0.1;
      if (Math.abs(c - hazX(h, h.cz)) < clear) cost += 10 * (1 - dz / (look * 1.5));
    }
    if (cost < bestCost) {
      bestCost = cost;
      best = c;
    }
  }
  if (z > track.forkZ - 7000 && z < track.forkZ + 400) best = track.forkSide * 0.6;
  return best;
}

export function segAt(track, z) {
  const i = Math.floor(z / SEG);
  return clamp(i, 0, track.n - 1);
}

/** Lateral push from the bend the bus is on, per second, at speed v. */
export function bendPush(track, z, v) {
  const c = track.curve[segAt(track, z)];
  const sp = v / PHYS.MAX_V;
  return -c * sp * sp * PHYS.CENTRIFUGAL * 2;
}

/**
 * One physics step for the bus (driver's phone only).
 * input: { steer: -1..1, brake: bool, hold: bool (stopped by a penalty) }
 * env:   { drift: lateral velocity from the party (road widths/s), grip: 0..1 bend multiplier }
 */
export function stepBus(track, bus, input, dt, env) {
  const b = { ...bus };
  const off = Math.abs(b.x) > 1.02;
  if (input.hold) {
    b.v = Math.max(0, b.v - PHYS.BRAKE * dt);
  } else if (input.brake) {
    b.v = Math.max(0, b.v - PHYS.BRAKE * dt);
  } else {
    const inPark = b.z > track.parkZ - PHYS.PARK_LEAD;
    const top = off ? PHYS.OFF_MAX : inPark ? PHYS.PARK_V : PHYS.CRUISE_V;
    if (b.v < top) b.v = Math.min(top, b.v + PHYS.ACCEL * dt);
    else b.v = Math.max(top, b.v - PHYS.OFF_DECEL * dt);
  }
  const sp = b.v / PHYS.MAX_V;
  // Steering works at any speed (so you can line up in the car park), but
  // bites hardest when moving.
  b.x += input.steer * PHYS.STEER * dt * (0.25 + 0.75 * sp);
  b.x += bendPush(track, b.z, b.v) * (env.grip ?? 1) * dt;
  b.x += (env.drift || 0) * dt * (0.3 + 0.7 * sp);
  b.x = clamp(b.x, -PHYS.X_LIMIT, PHYS.X_LIMIT);
  b.z += b.v * dt;
  if (b.z >= track.endZ) {
    b.z = track.endZ;
    b.v = 0;
  }
  return b;
}

/**
 * The party's sway: a slow, lurching lateral drift that grows with how tipsy
 * the passengers are. A function of server time so every phone agrees.
 */
export function partySway(party, t) {
  const amp = 0.08 + 0.85 * party;
  const s = t / 1000;
  return amp * (Math.sin(s * 1.37) * 0.6 + Math.sin(s * 0.53 + 1.3) * 0.4 + Math.sin(s * 2.9 + 0.4) * 0.15 * party);
}

/** Sum of live impulses (road widths/s) at time t. */
export function impulseDrift(imps, t) {
  let d = 0;
  for (const im of imps || []) {
    const age = (t - im.at) / 1000;
    if (age < 0 || age > 2.5) continue;
    d += im.dx * Math.exp(-age * 1.6);
  }
  return d;
}

// ── Passenger jobs ───────────────────────────────────────────────────────────
// The server deals these out during a drive. Each is a 3–5 s micro-game on
// one phone. `group` jobs go to every passenger at once.
export const JOBS = {
  bottle: { dur: 3400, title: 'Bottle loose!', hint: 'Tap the rolling bottle', rating: -1, imp: 0.25 },
  sitdown: { dur: 3600, title: 'Toast incoming!', hint: 'Swipe them back into their seat', rating: 0, imp: 0.7 },
  hiccup: { dur: 4200, title: 'Hiccups!', hint: 'Hold, and let go in the green', rating: 0, imp: 0.3 },
  hat: { dur: 3400, title: 'Gust!', hint: 'Tap fast to hang on', rating: 0, imp: 0 },
  platter: { dur: 4200, title: 'Pass the cheese!', hint: 'Drag the platter to the glowing seat', rating: 0, imp: 0.15 },
  sing: { dur: 4600, title: 'Sing-along!', hint: 'Tap each note on the line', rating: 0, imp: 0.35 },
  lean: { dur: 2800, title: 'LEAN!', hint: 'Hold the side of your screen', rating: -2, imp: 1.1, group: true },
  photo: { dur: 3200, title: 'Group photo!', hint: 'Tap SMILE on the flash', rating: 0, imp: 0, group: true },
  wake: { dur: 7000, title: 'You nodded off', hint: 'Mash to wake up', rating: 0, imp: 0 },
};
export const SOLO_JOBS = ['bottle', 'sitdown', 'hiccup', 'hat', 'platter', 'sing'];

// Set pieces: one escalating moment per leg.
export const SETPIECES = [
  null,
  { k: 'singalong', title: 'Sing-along!', line: 'Somebody found the aux cord.' },
  { k: 'conga', title: 'Conga line!', line: 'A conga line is heading down the aisle.' },
  { k: 'cork', title: 'Cork!', line: 'A sparkling cork just hit the windscreen.' },
  { k: 'gust', title: 'Big gust!', line: 'Hold on to your hats. All of them.' },
  { k: 'roos', title: 'Dusk!', line: 'The roos are out. All of them.' },
];

// ── Winery games ─────────────────────────────────────────────────────────────
export const GAMES = {
  pour: { title: 'The Perfect Pour', how: 'Hold to pour. Let go on the line. Three glasses.', ms: 13500 },
  stomp: { title: 'Grape Stomp', how: 'Tap LEFT, RIGHT, LEFT, RIGHT. Fill the barrel.', ms: 12000 },
  cheese: { title: 'Cheese Board Dash', how: 'Tap food to eat it. Food sobers you up. Golden brie!', ms: 15000 },
  quiz: { title: 'Tasting Notes', how: 'Real tasting note, or made up? Be quick.', ms: 27500 },
  stack: { title: 'Load the Bus', how: 'Tap to drop each case of wine on the stack.', ms: 16000 },
};
export const GAME_INTRO_MS = 2800;

export const POUR_ROUNDS = 3;
export const POUR_ROUND_MS = 4500;
export const QUIZ_Q = 5;
export const QUIZ_Q_MS = 5500;
export const STOMP_MAX_RATE = 15; // stomps per second, ever

export const FOOD = {
  cheese: { fun: 6, tip: -3, r: 0.13 },
  cracker: { fun: 4, tip: -2, r: 0.12 },
  grapes: { fun: 4, tip: -2, r: 0.13 },
  olive: { fun: 3, tip: -1, r: 0.1 },
  chilli: { fun: 2, tip: 3, r: 0.1 },
  brie: { fun: 20, tip: -8, r: 0.14 },
};
export const FOOD_TTL = 2600;

/** The cheese board: deterministic from seed + stop. x,y in 0..1 of the board. */
export function buildPlatter(seed, stop) {
  const rnd = mulberry32((seed ^ Math.imul(stop + 7, 0x85ebca6b)) >>> 0);
  const items = [];
  const kinds = ['cheese', 'cracker', 'grapes', 'olive', 'cheese', 'cracker', 'grapes', 'chilli'];
  const ms = GAMES.cheese.ms;
  let t = 300;
  let i = 0;
  while (t < ms - 1200) {
    const k = i === 13 ? 'brie' : kinds[Math.floor(rnd() * kinds.length)];
    items.push({ id: i, k, at: Math.round(t), x: 0.12 + rnd() * 0.76, y: 0.14 + rnd() * 0.72 });
    // two at a time, then a breath
    t += i % 2 === 0 ? 120 + rnd() * 160 : 520 + rnd() * 420;
    i++;
  }
  return items;
}

// Tasting-note quiz. Every "real" note here is a genuine descriptor wine
// people use; every fake is not. Both lists are deliberately absurd.
export const NOTES_REAL = [
  'Cat’s pee on a gooseberry bush',
  'Pencil shavings',
  'Petrol',
  'Sweaty saddle',
  'Wet stone',
  'Forest floor',
  'Tar and roses',
  'Cigar box',
  'Struck match',
  'Wet wool',
  'Barnyard',
  'Kerosene',
  'Tomato leaf',
  'Graphite',
  'Lanolin',
  'Bacon fat',
  'Gunflint',
  'Brioche',
  'Eucalypt',
  'Violets',
];
export const NOTES_FAKE = [
  'A Bunnings sausage sizzle',
  'The inside of a Commodore',
  'Wet labrador',
  'Nan’s good lounge room',
  'Sunscreen at the cricket',
  'A servo pie at 2 am',
  'Thongs left in the sun',
  'Mozzie spray',
  'A damp Akubra',
  'A Kmart candle',
  'Bin night',
  'New car dashboard',
  'Footy oval at half-time',
  'Last night’s barbie',
  'A Tim Tam slam',
  'Rottnest ferry diesel',
  'The fun police',
  'Your uncle’s speech',
];

/** Five questions for one quiz. kind 'real' = pick the one real note; 'fake' = pick the made-up one. */
export function buildQuiz(seed, stop) {
  const rnd = mulberry32((seed ^ Math.imul(stop + 3, 0xc2b2ae35)) >>> 0);
  const real = shuffle(NOTES_REAL.slice(), rnd);
  const fake = shuffle(NOTES_FAKE.slice(), rnd);
  const qs = [];
  for (let q = 0; q < QUIZ_Q; q++) {
    const kind = q % 2 === 0 ? 'real' : 'fake';
    let opts;
    let answer;
    if (kind === 'real') {
      const r = real.pop();
      opts = [r, fake.pop(), fake.pop(), fake.pop()];
      answer = r;
    } else {
      const f = fake.pop();
      opts = [f, real.pop(), real.pop(), real.pop()];
      answer = f;
    }
    shuffle(opts, rnd);
    qs.push({ kind, opts, a: opts.indexOf(answer) });
  }
  return qs;
}

export function shuffle(arr, rnd) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Pour targets per round (fraction of the glass). */
export function pourTargets(seed, stop) {
  const rnd = mulberry32((seed ^ Math.imul(stop + 11, 0x27d4eb2f)) >>> 0);
  return Array.from({ length: POUR_ROUNDS }, () => Math.round((0.38 + rnd() * 0.42) * 100) / 100);
}

// ── Endings ──────────────────────────────────────────────────────────────────
export const ENDINGS = [
  {
    min: 80,
    key: 'five-star',
    title: 'Five-Star Tour',
    line: 'The tour company wants to put you on the brochure.',
    body: 'Not a scratch on the bus, not a sheep out of place. Somebody even remembered the cheese knife. Swerve Valley Tours will be telling this story at the Christmas party, and for once it is a nice one.',
  },
  {
    min: 60,
    key: 'four-star',
    title: 'A Lovely Day Out',
    line: 'A couple of bumps. Nobody is talking about the bumps.',
    body: 'There was a moment with a kangaroo, and a moment with a hat, and a moment nobody will describe in front of the kids. But everybody got home with a case under their arm and a story for the group chat.',
  },
  {
    min: 40,
    key: 'a-word',
    title: 'The Tour Company Would Like a Word',
    line: 'Your review is “memorable”. They meant it as a warning.',
    body: 'The bus is technically fine. There is a dent shaped exactly like a tractor, Shiraz in places Shiraz should not be, and a cyclist who now has a lot to say on Facebook. They have offered you a 10% discount to never come back.',
  },
  {
    min: 20,
    key: 'damage',
    title: 'Bus Returned With Damage',
    line: 'The deposit is gone. So is a wing mirror.',
    body: 'The tow truck driver knew the tour company owner by first name, which is never a good sign. The photos from the day are excellent, though. Mostly blurry, everyone laughing, one of a sheep looking furious.',
  },
  {
    min: 0,
    key: 'banned',
    title: 'Banned From the Valley',
    line: 'Every cellar door from here to Guildford has your photo behind the counter.',
    body: 'Kangaroos were bonked. A signpost was flattened. Somebody stood on the top deck and gave a speech to a vineyard. It was, by every measure, the best day out anybody on that bus has ever had.',
  },
];
export function endingFor(rating) {
  return ENDINGS.find((e) => rating >= e.min) || ENDINGS[ENDINGS.length - 1];
}

// One award for every person on the bus, picked from what actually happened.
export const AWARDS = {
  party: { title: 'Life of the Party', line: 'Most fun points on the bus.' },
  legend: { title: 'Designated Legend', line: 'Best driving of the day.' },
  skull: { title: 'Bottoms Up', line: 'Skulled the most tastings.' },
  spit: { title: 'The Professional', line: 'Used the spit bucket like a real sommelier.' },
  somm: { title: 'Sommelier', line: 'Best nose for a tasting note.' },
  stomp: { title: 'Stomp Machine', line: 'Turned the most grapes into juice.' },
  cheese: { title: 'Cheese Fiend', line: 'Cleared the cheese board.' },
  steady: { title: 'Steady Hand', line: 'Best pours of the day.' },
  stack: { title: 'Forklift Licence', line: 'Loaded the most cases.' },
  hero: { title: 'Bus Hero', line: 'Saved the most bottles, hats and toasts.' },
  butter: { title: 'Butterfingers', line: 'Most bottles lost to the floor.' },
  nap: { title: 'Power Napper', line: 'Caught the most sleep on the top deck.' },
  smile: { title: 'Most Photogenic', line: 'Smiled in every group photo.' },
  blink: { title: 'Blinked Every Time', line: 'Eyes closed in the most photos.' },
  lost: { title: 'Lost Property', line: 'Somewhere out there is their {wear}.' },
  roo: { title: 'Roo Magnet', line: 'Met a kangaroo, up close.' },
};
export const AWARD_FALLBACKS = [
  { title: 'Window Seat Enjoyer', line: 'Watched a lot of vines go by.' },
  { title: 'Asked for the Aux Cord', line: 'Was told no. Asked again.' },
  { title: 'Just Happy to Be Here', line: 'Genuinely, the best attitude on the bus.' },
  { title: 'Bought a Case “For Later”', line: 'It will not last until later.' },
  { title: 'Chief Photographer', line: 'Took 400 photos of vines.' },
  { title: 'Made Friends With a Sheep', line: 'The sheep did not reciprocate.' },
  { title: 'Wore the Right Shoes', line: 'Dressed for grape stomping. Prophetic.' },
  { title: 'Kept the Snacks Coming', line: 'Nobody went hungry on their watch.' },
];
