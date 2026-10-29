/* ============================================================================
   SUMMIT FEVER — shared world module
   ----------------------------------------------------------------------------
   Imported by BOTH sides:
     • the page   (public/arcade/summit-fever/index.html → ./world.js)
     • the server (workers/arcade/games/summit-fever.js → this file, bundled
       by wrangler)
   so the mountain is generated from one seed by one function and the two can
   never disagree about where a ledge, an item, a bivvy or a gate is.

   Everything in here is pure and deterministic: integer maths over a seeded
   PRNG, no Date, no Math.random, no DOM.

   Coordinates are world pixels. x grows right, y grows DOWN (canvas style), so
   the summit is near y = 0 and the trailhead is at the bottom. A climber's
   (x, y) is the centre of their FEET.
   ========================================================================== */

export const TILE = 16;
export const COLS = 20;
export const WORLD_W = COLS * TILE; // 320 — exactly one phone screen wide

// Tile codes
export const EMPTY = 0;
export const ROCK = 1; //   cliff walls, solid
export const LEDGE = 2; //  one-way platform
export const ICE = 3; //    one-way platform, slippery
export const ROPE = 4; //   fixed line, climbable, not solid
export const GROUND = 5; // trailhead floor, solid

const TOP_PAD = 12; // open sky above the summit
const FLOOR_ROWS = 3;
export const GATE_GAP = 6; // rows between a camp and the weather-hold gate above it

// ── The five stages ──────────────────────────────────────────────────────────
// weather: [kind, minSeconds, maxSeconds] fronts in order; the server rolls the
// durations, and the last front runs until the stage ends.
export const STAGES = [
  {
    key: 'trailhead',
    name: 'The Trailhead',
    blurb: 'Pine forest and a cheerful sky. It will not last.',
    theme: 'forest',
    bg: 'forest',
    rows: 52,
    time: 55,
    ledge: [3, 6],
    ice: 0,
    ropes: 0,
    gem: 'berry',
    cold: 0,
    hazard: null,
    items: ['cookie', 'cookie', 'cocoa', 'bar', 'brolly'],
    // A stage takes ~35 s to climb, so every front has to land inside that.
    weather: [
      ['clear', 5, 7],
      ['drizzle', 4, 6],
      ['downpour', 9, 11],
      ['clear', 6, 8],
      ['drizzle', 30, 30],
    ],
  },
  {
    key: 'scree',
    name: 'Switchback Scree',
    blurb: 'Loose rock, fixed ropes, and a storm building in the west.',
    theme: 'rock',
    bg: 'alpine',
    rows: 60,
    time: 60,
    ledge: [3, 5],
    ice: 0,
    ropes: 0.14,
    gem: 'crystal',
    cold: -0.5,
    hazard: 'rock',
    items: ['cookie', 'brolly', 'bar', 'cocoa', 'axe', 'cookie'],
    weather: [
      ['clear', 3, 4],
      ['downpour', 4, 5],
      ['thunder', 10, 12],
      ['drizzle', 3, 4],
      ['thunder', 30, 30],
    ],
  },
  {
    key: 'glacier',
    name: 'The Glacier',
    blurb: 'Blue ice underfoot. Fog rolls in off the snowfield and the wind finds you.',
    theme: 'ice',
    bg: 'glacier',
    rows: 60,
    time: 65,
    ledge: [3, 6],
    ice: 0.6,
    ropes: 0.05,
    gem: 'crystal',
    cold: -0.8,
    hazard: null,
    items: ['axe', 'brolly', 'cookie', 'cocoa', 'lamp', 'down'],
    weather: [
      ['fog', 7, 9],
      ['gale', 6, 8],
      ['clear', 3, 4],
      ['snow', 6, 8],
      ['gale', 30, 30],
    ],
  },
  {
    key: 'icewall',
    name: 'The Ice Wall',
    blurb: 'Vertical ice, frozen ropes, and a blizzard with your name on it.',
    theme: 'snowrock',
    bg: 'glacier',
    rows: 64,
    time: 65,
    ledge: [2, 4],
    ice: 0.35,
    ropes: 0.24,
    gem: 'crystal',
    cold: -0.8,
    hazard: 'ice',
    avalanche: true,
    items: ['down', 'down', 'cookie', 'cookie', 'cocoa', 'lamp', 'axe'],
    weather: [
      ['snow', 4, 6],
      ['blizzard', 10, 12],
      ['gale', 4, 5],
      ['blizzard', 30, 30],
    ],
  },
  {
    key: 'summit',
    name: 'Summit Ridge',
    blurb: 'The last push, in a whiteout. The forecast swears the sky will break.',
    theme: 'snowrock',
    bg: 'summit',
    rows: 56,
    time: 70,
    ledge: [3, 5],
    ice: 0.25,
    ropes: 0.08,
    gem: 'flower',
    cold: -1.0,
    hazard: null,
    items: ['cookie', 'cookie', 'cocoa', 'lamp', 'down', 'bar'],
    // The server also breaks the sky the moment anyone gets close to the top,
    // so a fast party still gets its sunrise.
    weather: [
      ['whiteout', 8, 10],
      ['blizzard', 6, 8],
      ['snow', 3, 4],
      ['clear', 60, 60],
    ],
  },
];

// ── Weather ──────────────────────────────────────────────────────────────────
// cold: warmth per second (+ warms you), wet: wetness per second,
// wind: peak sideways push in px/s², vis: fraction of the screen you can see.
export const WEATHER = {
  clear: { label: 'Clear skies', cold: 1.2, wet: -6, wind: 0, vis: 1 },
  drizzle: { label: 'Drizzle', cold: -0.6, wet: 5, wind: 40, vis: 1 },
  downpour: { label: 'Downpour', cold: -1.0, wet: 11, wind: 80, vis: 0.9 },
  thunder: { label: 'Thunderstorm', cold: -1.0, wet: 11, wind: 120, vis: 0.85, bolts: true },
  fog: { label: 'Fog', cold: -0.8, wet: 2, wind: 0, vis: 0.16 },
  gale: { label: 'Gale', cold: -1.6, wet: -2, wind: 560, vis: 1, gusty: true },
  snow: { label: 'Snowfall', cold: -1.6, wet: 2, wind: 90, vis: 0.8 },
  blizzard: { label: 'Blizzard', cold: -3.0, wet: 3, wind: 430, vis: 0.42, gusty: true },
  whiteout: { label: 'Whiteout', cold: -2.2, wet: 1, wind: 160, vis: 0.12 },
};

/** Sideways wind (px/s²) for a front at server time t. Both sides compute it. */
export function windAt(front, t) {
  if (!front) return 0;
  const w = WEATHER[front.kind];
  if (!w || !w.wind) return 0;
  const s = (t - front.from) / 1000;
  if (w.gusty) {
    const g = 0.5 + 0.5 * Math.sin(s * 1.25 + front.ph);
    return front.dir * w.wind * (0.15 + 0.85 * g * g);
  }
  return front.dir * w.wind * (0.75 + 0.25 * Math.sin(s * 0.7 + front.ph));
}

// ── Power-ups ────────────────────────────────────────────────────────────────
export const ITEM_KINDS = ['cookie', 'cocoa', 'axe', 'brolly', 'bar', 'down', 'lamp'];
export const ITEMS = {
  cookie: {
    label: 'Choc-chip cookie',
    desc: 'Pocket one (only one). It saves you the instant you would freeze — or USE it on a frozen friend.',
  },
  cocoa: {
    label: 'Thermos of cocoa',
    desc: 'USE: +40 warmth for you, +30 for everyone huddled close.',
  },
  axe: {
    label: 'Ice axe',
    dur: 20000,
    desc: 'Grip on ice. Push into a cliff to cling to it, and jump to kick off it (twice per leap).',
  },
  brolly: {
    label: 'Umbrella',
    dur: 20000,
    desc: 'Stay dry, float down gently, and ride a strong gust upward like a kite. Hates thunderstorms.',
  },
  bar: { label: 'Energy bar', dur: 14000, desc: 'Bigger jumps, faster legs.' },
  down: { label: 'Down jacket', dur: 30000, desc: 'Lose warmth at 40% of the rate.' },
  lamp: { label: 'Headlamp', dur: 30000, desc: 'See through fog, blizzard and whiteout.' },
};
export const GEM_POINTS = 10;

// ── Physics ──────────────────────────────────────────────────────────────────
export const PHYS = {
  G: 1150,
  JUMP: 365, // ≈ 58 px apex — three rows with room to spare, never four
  RUN: 92,
  ACC: 1500,
  AIR: 950,
  FRIC: 1700,
  ICE_ACC: 240,
  ICE_FRIC: 80,
  MAXFALL: 430,
  GLIDE: 62,
  CLIMB: 80,
  CLING: 28,
  W: 10,
  H: 22,
  COYOTE: 0.09,
  BUFFER: 0.12,
  CUT: 0.45,
  MAXVX: 175,
};

// ── PRNG ─────────────────────────────────────────────────────────────────────
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

// ── World generation ─────────────────────────────────────────────────────────
/**
 * Build the whole mountain from a seed.
 * @returns {{
 *   seed:number, rows:number, height:number, grid:Uint8Array,
 *   lt:Uint8Array, rt:Uint8Array, floorRow:number, floorY:number,
 *   stages:object[], ledges:object[], ropes:object[], gates:object[],
 *   items:object[], gems:object[], bivvies:object[], pickups:Map<number,object>,
 *   summitY:number, flagX:number
 * }}
 */
export function buildWorld(seed) {
  const rng = mulberry32(seed);
  const ri = (a, b) => a + Math.floor(rng() * (b - a + 1));

  const rows = TOP_PAD + STAGES.reduce((n, s) => n + s.rows, 0) + FLOOR_ROWS;
  const grid = new Uint8Array(rows * COLS);
  const at = (c, r) => (c < 0 || c >= COLS || r < 0 || r >= rows ? ROCK : grid[r * COLS + c]);
  const put = (c, r, v) => {
    if (c >= 0 && c < COLS && r >= 0 && r < rows) grid[r * COLS + c] = v;
  };

  const floorRow = rows - FLOOR_ROWS;
  const summitRow = TOP_PAD;

  // Stage bands, bottom up.
  const bands = [];
  {
    let start = floorRow;
    for (const def of STAGES) {
      const camp = start - def.rows;
      bands.push({ start, camp });
      start = camp;
    }
  }
  const campRows = new Set(bands.map((b) => b.camp));
  const gateRows = new Set(bands.slice(0, -1).map((b) => b.camp - GATE_GAP));

  // Cliff walls: a slow random walk between one and two tiles thick, pinned to
  // one tile around camps so every camp runs wall to wall. Above the summit the
  // walls fall away and it is all sky.
  const lt = new Uint8Array(rows);
  const rt = new Uint8Array(rows);
  {
    let l = 1;
    let r = 1;
    let seg = 0;
    for (let row = rows - 1; row >= 0; row--) {
      if (seg-- <= 0) {
        l = rng() < 0.35 ? 2 : 1;
        r = rng() < 0.35 ? 2 : 1;
        seg = ri(5, 12);
      }
      let nearCamp = false;
      for (const c of campRows) if (row >= c - GATE_GAP - 1 && row <= c + 2) nearCamp = true;
      lt[row] = row < summitRow ? 0 : nearCamp ? 1 : l;
      rt[row] = row < summitRow ? 0 : nearCamp ? 1 : r;
    }
  }
  for (let row = 0; row < rows; row++) {
    for (let c = 0; c < lt[row]; c++) put(c, row, ROCK);
    for (let c = COLS - rt[row]; c < COLS; c++) put(c, row, ROCK);
  }
  for (let row = floorRow; row < rows; row++) for (let c = 0; c < COLS; c++) put(c, row, GROUND);

  // Interior column range that is clear of wall over a band of rows.
  function inner(r0, r1) {
    let l = 0;
    let r = 0;
    for (let row = Math.max(0, r0); row <= Math.min(rows - 1, r1); row++) {
      l = Math.max(l, lt[row]);
      r = Math.max(r, rt[row]);
    }
    return [Math.max(1, l), COLS - 1 - Math.max(1, r)];
  }

  const rowClear = (c0, c1, row) => {
    for (let c = c0; c <= c1; c++) if (at(c, row) !== EMPTY) return false;
    return true;
  };

  const stages = [];
  const ledges = [];
  const ropes = [];
  const gates = [];
  const items = [];
  const gems = [];
  const bivvies = [];
  let nextId = 1;

  STAGES.forEach((def, si) => {
    const { start, camp } = bands[si];
    const route = [];
    const sides = [];
    const caches = [];

    // The camp itself: a wide ledge with a two-tile hole at the far end from
    // the hut, so anyone who has arrived can drop back down for a friend.
    const hutLeft = si % 2 === 0;
    const hole = hutLeft ? [COLS - 3, COLS - 2] : [1, 2];
    for (let c = 1; c < COLS - 1; c++) if (c < hole[0] || c > hole[1]) put(c, camp, LEDGE);

    let row = start;
    let prev = { c0: 1, c1: COLS - 2, ice: false };
    let guard = 0;
    while (row - camp > 3 && guard++ < 200) {
      let gap = rng() < 0.4 ? 2 : 3;
      let rope = false;
      // A rope must start above the weather-hold gate of the camp below, or a
      // climber could be stuck on it under a closed gate.
      if (def.ropes && row - camp > 10 && row <= start - GATE_GAP - 1 && rng() < def.ropes) {
        rope = true;
        gap = ri(5, 6);
      }
      if (row - gap - camp < 2) gap = row - camp - 2;
      let nr = row - gap;
      // Never put a ledge on a gate row or right under the camp floor.
      if (gateRows.has(nr) || campRows.has(nr)) {
        nr += 1;
        gap -= 1;
      }
      if (gap < 1) break;

      const [lo, hi] = inner(nr - 2, nr + 1);
      // Widest edge-to-edge gap, in tiles, that a standing jump clears. Off ice
      // you can't build speed from a standstill, so keep those closer.
      const reach = prev.ice ? 1 : 2;
      let placed = null;
      for (let attempt = 0; attempt < 40 && !placed; attempt++) {
        const w = Math.min(ri(def.ledge[0], def.ledge[1]), hi - lo + 1);
        const c0 = ri(lo, hi - w + 1);
        const c1 = c0 + w - 1;
        const overlap = Math.min(c1, prev.c1) - Math.max(c0, prev.c0) + 1;
        const edgeGap = overlap > 0 ? 0 : Math.max(c0 - prev.c1, prev.c0 - c1) - 1;
        if (rope) {
          if (overlap < 1) continue;
        } else {
          if (edgeGap > reach) continue;
          // Don't stack ledges straight on top of each other — it makes the
          // climb a ladder. Allow it only after many failed rolls.
          const shift = Math.abs((c0 + c1) / 2 - (prev.c0 + prev.c1) / 2);
          if (shift < 2 && attempt < 25) continue;
        }
        if (!rowClear(c0, c1, nr)) continue;
        placed = { c0, c1 };
      }
      if (!placed) {
        // Fallback that always exists: overlap the previous ledge.
        const c0 = Math.max(lo, Math.min(prev.c0, hi - 2));
        placed = { c0, c1: Math.min(hi, c0 + 2) };
      }

      const ice = def.ice > 0 && route.length > 0 && rng() < def.ice;
      for (let c = placed.c0; c <= placed.c1; c++) put(c, nr, ice ? ICE : LEDGE);
      const ledge = { row: nr, c0: placed.c0, c1: placed.c1, ice, stage: si, main: true };
      ledges.push(ledge);
      route.push(ledge);

      if (rope) {
        const lo2 = Math.max(placed.c0, prev.c0);
        const hi2 = Math.min(placed.c1, prev.c1);
        const col = ri(lo2, hi2);
        for (let r = nr + 1; r < row; r++) put(col, r, ROPE);
        ropes.push({ col, top: nr, bottom: row - 1, stage: si });
        ledge.rope = col;
      }

      // A side ledge on the far side of the same band — gems, items, bivvies.
      if (rng() < 0.5) {
        const w = ri(2, 3);
        const leftRoom = placed.c0 - 3 - lo;
        const rightRoom = hi - (placed.c1 + 3);
        const goLeft = leftRoom >= w - 1 && (rightRoom < w - 1 || rng() < 0.5);
        const goRight = !goLeft && rightRoom >= w - 1;
        if (goLeft || goRight) {
          const sr = nr + (rng() < 0.5 ? 0 : 1);
          const c0 = goLeft ? ri(lo, placed.c0 - 2 - w) : ri(placed.c1 + 3, hi - w + 1);
          const c1 = c0 + w - 1;
          if (
            c0 >= lo &&
            c1 <= hi &&
            !campRows.has(sr) &&
            !gateRows.has(sr) &&
            rowClear(c0 - 1, c1 + 1, sr) &&
            rowClear(c0, c1, sr - 1) &&
            rowClear(c0, c1, sr + 1)
          ) {
            for (let c = c0; c <= c1; c++) put(c, sr, LEDGE);
            const side = { row: sr, c0, c1, ice: false, stage: si, main: false };
            ledges.push(side);
            sides.push(side);

            // A cache: four rows up from a side ledge. Out of reach of one
            // jump, in reach if you stand on a friend's head or eat a bar.
            const cr = sr - 4;
            if (rng() < 0.35 && cr - camp > 2 && !gateRows.has(cr)) {
              const cc0 = Math.max(lo, c0 - (rng() < 0.5 ? 1 : 0));
              const cc1 = Math.min(hi, cc0 + 1);
              let free = true;
              for (let r = cr - 2; r <= cr + 3; r++) if (!rowClear(cc0 - 1, cc1 + 1, r)) free = false;
              if (free) {
                for (let c = cc0; c <= cc1; c++) put(c, cr, LEDGE);
                const cache = { row: cr, c0: cc0, c1: cc1, ice: false, stage: si, main: false, cache: true };
                ledges.push(cache);
                caches.push(cache);
              }
            }
          }
        }
      }

      prev = { ...placed, ice };
      row = nr;
    }

    // ── Pickups ──────────────────────────────────────────────────────────
    const surface = (l) => l.row * TILE;
    const centre = (l) => ((l.c0 + l.c1 + 1) / 2) * TILE;
    const used = new Set();
    const spot = (l, jitter = 0) => ({
      x: Math.round(centre(l) + jitter),
      y: surface(l) - 10,
    });

    // Bivvy shelters on wide-ish main ledges, never the first or last.
    const bivvyCount = si === 0 ? 1 : 2;
    const wide = route.filter((l, i) => i > 1 && i < route.length - 2 && l.c1 - l.c0 >= 3);
    for (let k = 0; k < bivvyCount && wide.length; k++) {
      const l = wide.splice(Math.floor(rng() * wide.length), 1)[0];
      const x = Math.round(centre(l));
      bivvies.push({ x, y: surface(l), x0: x - 15, x1: x + 15, y0: surface(l) - 26, y1: surface(l), stage: si });
      used.add(l);
    }

    // Items: caches first (that is what caches are for), then side ledges, then
    // the route itself, skipping the first couple of ledges of a stage.
    const itemSlots = [
      ...caches,
      ...shuffled(sides, rng),
      ...shuffled(route.slice(2, -1), rng),
    ];
    for (const kind of def.items) {
      const l = itemSlots.find((s) => !used.has(s));
      if (!l) break;
      used.add(l);
      items.push({ id: nextId++, kind, ...spot(l), stage: si });
    }

    // Gems: whatever ledges are left, about one in two.
    for (const l of [...sides, ...route.slice(1)]) {
      if (used.has(l) || rng() < 0.45) continue;
      const n = l.c1 - l.c0 >= 3 && rng() < 0.4 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        gems.push({ id: nextId++, kind: def.gem, ...spot(l, n === 2 ? (k ? 10 : -10) : 0), stage: si });
      }
    }

    const [lo0, hi0] = inner(camp - 1, camp + 1);
    const lo = hutLeft ? lo0 : hole[1] + 1;
    const hi = hutLeft ? hole[0] - 1 : hi0;
    stages.push({
      index: si,
      key: def.key,
      startRow: start,
      campRow: camp,
      startY: start * TILE,
      campY: camp * TILE,
      gateRow: si < STAGES.length - 1 ? camp - GATE_GAP : null,
      gateY: si < STAGES.length - 1 ? (camp - GATE_GAP) * TILE : null,
      route,
      campLo: lo,
      campHi: hi,
      hole,
      hutX: hutLeft ? (lo + 2.5) * TILE : (hi - 1.5) * TILE,
      fireX: hutLeft ? (lo + 2.5) * TILE + 34 : (hi - 1.5) * TILE - 34,
    });
    if (si < STAGES.length - 1) gates.push({ row: camp - GATE_GAP, index: si });
  });

  const pickups = new Map();
  for (const p of items) pickups.set(p.id, p);
  for (const p of gems) pickups.set(p.id, p);

  return {
    seed,
    rows,
    height: rows * TILE,
    grid,
    lt,
    rt,
    floorRow,
    floorY: floorRow * TILE,
    stages,
    ledges,
    ropes,
    gates,
    items,
    gems,
    bivvies,
    pickups,
    summitY: stages[stages.length - 1].campY,
    flagX: WORLD_W / 2,
  };
}

function shuffled(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── Queries ──────────────────────────────────────────────────────────────────
export function tileAt(world, c, r) {
  if (c < 0 || c >= COLS) return ROCK;
  if (r < 0) return EMPTY;
  if (r >= world.rows) return GROUND;
  return world.grid[r * COLS + c];
}

/** Which stage band a y belongs to (the stage you are climbing at that height). */
export function stageAtY(world, y) {
  for (const s of world.stages) if (y > s.campY - GATE_GAP * TILE) return s.index;
  return world.stages.length - 1;
}

/** The surface y of the first ledge or ground at or below (x, y). */
export function groundBelow(world, x, y) {
  const c = Math.max(0, Math.min(COLS - 1, Math.floor(x / TILE)));
  for (let r = Math.max(0, Math.floor((y - 1) / TILE)); r < world.rows; r++) {
    const t = tileAt(world, c, r);
    if (t === LEDGE || t === ICE || t === ROCK || t === GROUND) return r * TILE;
  }
  return world.floorY;
}

/** Standing by a camp's fire (any camp — including the one a stage starts from). */
export function byFire(world, x, y) {
  for (const s of world.stages) {
    if (s.index === world.stages.length - 1) continue;
    if (Math.abs(x - s.fireX) <= 36 && y <= s.campY + 1 && y >= s.campY - 24) return true;
  }
  return false;
}

export function inBivvy(world, x, y) {
  for (const b of world.bivvies) if (x >= b.x0 && x <= b.x1 && y >= b.y0 && y <= b.y1 + 2) return true;
  return false;
}

/** Gate g is solid while the stage above it has not started (g >= stage). */
function gateSolid(world, r, gatesFrom) {
  for (const g of world.gates) if (g.row === r && g.index >= gatesFrom) return true;
  return false;
}

function solid(world, c, r, gatesFrom) {
  const t = tileAt(world, c, r);
  if (t === ROCK || t === GROUND) return true;
  return gateSolid(world, r, gatesFrom);
}

function oneWay(t) {
  return t === LEDGE || t === ICE;
}

// ── The body ─────────────────────────────────────────────────────────────────
export function makeBody(x, y) {
  return {
    x,
    y,
    vx: 0,
    vy: 0,
    ground: false,
    onIce: false,
    climbing: false,
    coyote: 0,
    buffer: 0,
    cut: false,
    ropeCd: 0,
    face: 1,
    wall: 0,
    standOn: null,
    jumped: false,
  };
}

/**
 * Advance one body by dt seconds. Mutates and returns b.
 * input: { left, right, jump (held), jumpPressed (edge this step) }
 * env:   { gatesFrom, wind, buffs:{axe,brolly,bar}, locked, others:[{id,x,y}] }
 * Sets b.jumped = true on the step a jump starts (for sound).
 */
export function stepBody(world, b, input, dt, env) {
  const P = PHYS;
  const buffs = env.buffs || {};
  const locked = !!env.locked;
  const L = !locked && input.left;
  const R = !locked && input.right;
  const dir = (R ? 1 : 0) - (L ? 1 : 0);
  b.jumped = false;

  if (input.jumpPressed && !locked) b.buffer = P.BUFFER;
  else b.buffer = Math.max(0, b.buffer - dt);
  b.ropeCd = Math.max(0, b.ropeCd - dt);
  b.coyote = Math.max(0, b.coyote - dt);
  if (dir) b.face = dir;

  const ropeHere = overlapsRope(world, b);

  // ── On a fixed line ───────────────────────────────────────────────────
  if (b.climbing) {
    if (locked || !ropeHere) {
      b.climbing = false;
      if (!locked && !ropeHere) b.vy = -300; // popped off the top onto the ledge
    } else if (dir) {
      b.climbing = false;
      b.ropeCd = 0.3;
      b.vx = dir * 90;
      b.vy = -170;
    } else {
      const col = ropeHere.col;
      const cx = (col + 0.5) * TILE;
      b.x += (cx - b.x) * Math.min(1, dt * 14);
      b.vx = 0;
      b.vy = input.jump ? -P.CLIMB : 0;
      const ny = b.y + b.vy * dt;
      // A closed gate is a ceiling even on a rope.
      if (!solid(world, col, Math.floor((ny - P.H) / TILE), env.gatesFrom)) b.y = ny;
      // Reached the ledge the rope hangs from — pop up onto it.
      if (b.y <= ropeHere.topY + TILE + 2) {
        b.climbing = false;
        b.vy = -300;
      }
      b.ground = false;
      return b;
    }
  }

  if (!b.climbing && !locked && input.jump && ropeHere && b.ropeCd <= 0 && (!b.ground || b.buffer > 0)) {
    // Only grab once the body is properly on the line (not just brushing it
    // from a ledge beside it).
    if (Math.abs((ropeHere.col + 0.5) * TILE - b.x) < 9) {
      b.climbing = true;
      b.buffer = 0;
      b.vx = 0;
      b.vy = 0;
      return b;
    }
  }

  // ── Horizontal ────────────────────────────────────────────────────────
  const speed = P.RUN * (buffs.bar ? 1.25 : 1);
  const icy = b.ground && b.onIce && !buffs.axe;
  const acc = b.ground ? (icy ? P.ICE_ACC : P.ACC) : P.AIR;
  if (dir) b.vx = approach(b.vx, dir * speed, acc * dt);
  else if (b.ground) b.vx = approach(b.vx, 0, (icy ? P.ICE_FRIC : P.FRIC) * dt);
  const wind = env.wind || 0;
  if (wind) b.vx += wind * (b.ground ? 0.42 : 1) * (buffs.brolly ? 1.9 : 1) * dt;
  b.vx = clampAbs(b.vx, P.MAXVX);

  // ── Jump ──────────────────────────────────────────────────────────────
  // With the ice axe, a climber pushing into a cliff in mid-air is clinging
  // to it, and a jump from there kicks off the face.
  // At most two kicks per leap (reset on landing or a rope), or a lucky
  // stretch of straight cliff becomes an elevator.
  if (b.ground || b.climbing) b.kicks = 0;
  const cling = !!buffs.axe && !b.ground && dir !== 0 && dir === b.wall && !locked;
  if (b.buffer > 0 && cling && (b.kicks || 0) < 2) {
    b.vy = -P.JUMP * 0.95;
    b.vx = -dir * 150;
    b.buffer = 0;
    b.cut = true;
    b.jumped = true;
    b.kicks = (b.kicks || 0) + 1;
  } else if (b.buffer > 0 && (b.ground || b.coyote > 0) && !locked) {
    b.vy = -P.JUMP * (buffs.bar ? 1.22 : 1);
    b.ground = false;
    b.coyote = 0;
    b.buffer = 0;
    b.cut = true;
    b.jumped = true;
    b.standOn = null;
  }
  if (b.cut && !input.jump && b.vy < 0) {
    b.vy *= P.CUT;
    b.cut = false;
  }
  if (b.vy >= 0) b.cut = false;

  // ── Gravity, glide, axe ───────────────────────────────────────────────
  b.vy += P.G * dt;
  if (buffs.brolly && b.vy > P.GLIDE) b.vy = P.GLIDE;
  // An open umbrella in a strong gust is a kite: it lifts you.
  if (buffs.brolly && !b.ground && Math.abs(wind) > 150) b.vy = Math.max(-120, b.vy - Math.abs(wind) * 0.45 * dt);
  if (b.vy > P.MAXFALL) b.vy = P.MAXFALL;
  if (cling && b.vy > P.CLING) b.vy = P.CLING;

  // ── Move X, collide with solids ───────────────────────────────────────
  const hw = P.W / 2;
  b.wall = 0;
  let nx = b.x + b.vx * dt;
  {
    const top = b.y - P.H + 1;
    const bot = b.y - 1;
    const r0 = Math.floor(top / TILE);
    const r1 = Math.floor(bot / TILE);
    if (b.vx > 0) {
      const c = Math.floor((nx + hw) / TILE);
      for (let r = r0; r <= r1; r++)
        if (solid(world, c, r, env.gatesFrom)) {
          nx = c * TILE - hw - 0.01;
          b.vx = 0;
          b.wall = 1;
          break;
        }
    } else if (b.vx < 0) {
      const c = Math.floor((nx - hw) / TILE);
      for (let r = r0; r <= r1; r++)
        if (solid(world, c, r, env.gatesFrom)) {
          nx = (c + 1) * TILE + hw + 0.01;
          b.vx = 0;
          b.wall = -1;
          break;
        }
    }
    // Pushing into a wall while standing still still counts as touching it.
    if (!b.wall && dir) {
      const c = Math.floor((nx + dir * (hw + 1)) / TILE);
      for (let r = r0; r <= r1; r++) if (solid(world, c, r, env.gatesFrom)) b.wall = dir;
    }
  }
  b.x = Math.max(hw + 1, Math.min(WORLD_W - hw - 1, nx));

  // ── Move Y ────────────────────────────────────────────────────────────
  const wasGround = b.ground;
  const prevFeet = b.y;
  let ny = b.y + b.vy * dt;
  b.ground = false;
  b.onIce = false;
  const c0 = Math.floor((b.x - hw + 0.5) / TILE);
  const c1 = Math.floor((b.x + hw - 0.5) / TILE);

  if (b.vy < 0) {
    const headR = Math.floor((ny - P.H) / TILE);
    for (let c = c0; c <= c1; c++) {
      if (solid(world, c, headR, env.gatesFrom)) {
        ny = (headR + 1) * TILE + P.H;
        b.vy = 0;
        break;
      }
    }
  } else {
    const rA = Math.floor(prevFeet / TILE);
    const rB = Math.floor(ny / TILE);
    let landed = false;
    for (let r = rA; r <= rB && !landed; r++) {
      const topY = r * TILE;
      for (let c = c0; c <= c1; c++) {
        const t = tileAt(world, c, r);
        const isSolid = solid(world, c, r, env.gatesFrom);
        if (isSolid || (oneWay(t) && prevFeet <= topY + 0.5 && ny >= topY)) {
          if (isSolid && prevFeet > topY + 0.5) continue; // already inside — let X resolve it
          ny = topY;
          b.vy = 0;
          b.ground = true;
          b.onIce = t === ICE;
          landed = true;
          break;
        }
      }
    }
    // Other climbers' heads are platforms too. That is the whole "give us a
    // leg up" mechanic. Someone already standing on a head rides it — up when
    // the friend underneath jumps, rather than falling through them.
    if (!landed && env.others) {
      for (const o of env.others) {
        const head = o.y - P.H;
        const riding = b.standOn === o.id && Math.abs(o.x - b.x) < P.W && ny >= head - 24 && ny <= head + 6;
        if (riding || (Math.abs(o.x - b.x) < P.W - 1 && prevFeet <= head + 0.5 && ny >= head)) {
          ny = head;
          b.vy = 0;
          b.ground = true;
          b.standOn = o.id;
          landed = true;
          break;
        }
      }
    }
    if (!landed) b.standOn = null;
  }
  b.y = Math.min(ny, world.floorY);
  if (b.y >= world.floorY) {
    b.y = world.floorY;
    b.ground = true;
    b.vy = Math.min(b.vy, 0);
  }

  if (wasGround && !b.ground && b.vy >= 0) b.coyote = P.COYOTE;
  return b;
}

function overlapsRope(world, b) {
  const c = Math.floor(b.x / TILE);
  const rMid = Math.floor((b.y - PHYS.H * 0.5) / TILE);
  const rFeet = Math.floor((b.y - 2) / TILE);
  if (tileAt(world, c, rMid) !== ROPE && tileAt(world, c, rFeet) !== ROPE) return null;
  for (const rp of world.ropes) {
    if (rp.col === c && rMid >= rp.top - 1 && rFeet <= rp.bottom + 1) return { col: c, topY: rp.top * TILE };
  }
  return null;
}

function approach(v, target, step) {
  if (v < target) return Math.min(target, v + step);
  if (v > target) return Math.max(target, v - step);
  return v;
}

function clampAbs(v, m) {
  return v > m ? m : v < -m ? -m : v;
}

// ── Bots ─────────────────────────────────────────────────────────────────────
// Bot "guides" fill a party up to three. They are kinematic, not physical: they
// walk ledge to ledge along the stage's main route and hop between them on a
// parabola. The host's browser drives them and reports their positions like
// any other climber; the server treats them exactly the same.
export function makeBot(x, y) {
  return { x, y, face: 1, mode: 'wait', t: 0, wait: 0.6, i: -1, stage: 0, hop: null, anim: 'idle' };
}

/**
 * ctx: { stage, frozen, stunned, gatesFrom, others:[{x,y,frozen}], pace }
 */
export function stepBot(world, bot, dt, ctx) {
  if (ctx.frozen || ctx.stunned) {
    bot.anim = ctx.frozen ? 'idle' : 'fall';
    return bot;
  }
  const st = world.stages[ctx.stage];
  if (!st) return bot;
  if (bot.stage !== ctx.stage) {
    bot.stage = ctx.stage;
    bot.i = -1;
    bot.mode = 'wait';
    bot.wait = 0.4 + Math.random() * 0.8;
  }
  const route = st.route;
  const atCamp = bot.y <= st.campY + 1;
  const floor = { row: st.startRow, c0: 1, c1: COLS - 2 };
  const cur = bot.i < 0 ? floor : route[bot.i] || floor;
  const pace = ctx.pace || 1;

  if (bot.mode === 'hop') {
    const h = bot.hop;
    h.t += dt;
    const u = Math.min(1, h.t / h.dur);
    bot.x = h.x0 + (h.x1 - h.x0) * u;
    bot.y = h.y0 + (h.y1 - h.y0) * u - h.arc * 4 * u * (1 - u);
    bot.anim = u < 0.5 ? 'jump' : 'fall';
    if (u >= 1) {
      bot.mode = 'wait';
      // Guides are steady, not fast: a little slower than a decent human, so a
      // bot never wins a stage a person was racing for.
      bot.wait = (0.4 + Math.random() * 0.8) / pace;
      bot.i = h.to;
      bot.anim = 'idle';
    }
    return bot;
  }

  if (bot.mode === 'climb') {
    bot.y -= PHYS.CLIMB * 0.9 * dt;
    bot.anim = 'climb';
    if (bot.y <= bot.climbTo + TILE) {
      bot.mode = 'hop';
      bot.hop = { t: 0, dur: 0.3, x0: bot.x, y0: bot.y, x1: bot.x, y1: bot.climbTo, arc: 12, to: bot.climbI };
    }
    return bot;
  }

  if (atCamp || (bot.i >= route.length && route.length)) {
    // Mill about near the hut.
    bot.anim = 'idle';
    return bot;
  }

  if (bot.mode === 'wait') {
    bot.wait -= dt;
    bot.anim = 'idle';
    // A frozen friend close by on this ledge? Go and stand with them.
    const friend = (ctx.others || []).find(
      (o) => o.frozen && Math.abs(o.y - bot.y) < 6 && Math.abs(o.x - bot.x) < 90,
    );
    if (friend) {
      if (Math.abs(friend.x - bot.x) > 10) {
        const d = Math.sign(friend.x - bot.x);
        bot.x += d * 60 * dt;
        bot.face = d;
        bot.anim = 'walk';
      }
      return bot;
    }
    if (bot.wait > 0) return bot;
    bot.mode = 'walk';
  }

  // Walk to the take-off point for the next ledge (or the camp).
  const nextI = bot.i + 1;
  const next = nextI < route.length ? route[nextI] : { row: st.campRow, c0: st.campLo, c1: st.campHi, camp: true };
  const nLo = next.c0 * TILE + 6;
  const nHi = (next.c1 + 1) * TILE - 6;
  const cLo = cur.c0 * TILE + 5;
  const cHi = (cur.c1 + 1) * TILE - 5;

  if (next.rope != null) {
    const rx = (next.rope + 0.5) * TILE;
    if (Math.abs(rx - bot.x) > 2) {
      const d = Math.sign(rx - bot.x);
      bot.x += d * 70 * pace * dt;
      bot.face = d;
      bot.anim = 'walk';
      if (Math.sign(rx - bot.x) !== d) bot.x = rx;
      return bot;
    }
    bot.mode = 'climb';
    bot.climbTo = next.row * TILE;
    bot.climbI = nextI;
    return bot;
  }

  // Best take-off x: as close as possible to the target's span.
  const want = Math.max(cLo, Math.min(cHi, Math.max(nLo, Math.min(nHi, bot.x))));
  if (Math.abs(want - bot.x) > 2) {
    const d = Math.sign(want - bot.x);
    bot.x += d * 70 * pace * dt;
    bot.face = d;
    bot.anim = 'walk';
    if (Math.sign(want - bot.x) !== d) bot.x = want;
    return bot;
  }
  const land = Math.max(nLo, Math.min(nHi, bot.x + (Math.random() - 0.5) * 20));
  const y1 = next.row * TILE;
  const rise = bot.y - y1;
  bot.face = Math.sign(land - bot.x) || bot.face;
  bot.mode = 'hop';
  bot.hop = {
    t: 0,
    dur: 0.42 + Math.abs(land - bot.x) / 260,
    x0: bot.x,
    y0: bot.y,
    x1: land,
    y1,
    arc: Math.max(14, Math.min(26, 58 - rise)),
    to: nextI,
  };
  return bot;
}
