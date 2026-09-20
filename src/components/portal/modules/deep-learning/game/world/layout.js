/* ============================================================================
   WORLD LAYOUT — the village plan, in metres, three.js frame
   ----------------------------------------------------------------------------
     +X east · +Z south (towards the sea) · +Y up.

   tools/build_village.py mirrors these numbers (Blender is Z-up; the script
   converts with B(x, y, z) = (x, -z, y)). Change a house here and there
   together, then rebuild the GLB with one command.

   Everything that needs to agree — the GLB, the grey-box fallback, the wall
   colliders, the ground height the player stands on, the room mechanisms —
   reads from this one file.
   ========================================================================== */

export const WALL_T = 0.45;

/* Houses: centre on the ground plane, full outer size [x, y, z], and the
   face the door is cut in. `exit` is a second door (House III lets you out
   the far end once the test is passed). */
export const HOUSES = {
  window: {
    id: 'window',
    c: [-16.5, 0],
    size: [11, 4.6, 11],
    door: { side: '+x', w: 1.8, h: 2.7, at: 0 },
    wall: 'cream',
  },
  eyes: {
    id: 'eyes',
    c: [0, -20],
    size: [13, 10.5, 13],
    door: { side: '+z', w: 2.2, h: 3.2, at: 0 },
    wall: 'ochre',
  },
  door: {
    id: 'door',
    c: [19, -3],
    size: [20, 5, 9],
    door: { side: '-x', w: 1.8, h: 2.7, at: 0 },
    exit: { side: '+x', w: 1.8, h: 2.7, at: 0 },
    wall: 'sandstone',
  },
};
export const HOUSE_LIST = Object.values(HOUSES);

export const PLAZA = { r: 9, lip: 0.12 };
export const TERRACE = { z: -30, y: 3.2, zEnd: -48 };
export const STAIR = { x0: -15, x1: -9, z0: -25.5, z1: -30 }; // ramp: y = 0 at z0 → TERRACE.y at z1
export const SEA = { z: 13, y: -2.4, water: -1.1, parapet: 1.0 };
export const HILL = { z: -46, slope: 0.35 }; // ground rises beyond the colonnade
export const BOUNDS = { x0: -30, x1: 31.5, z0: -44, z1: 12.4 };

/* Eight lamps round the plaza, off the door axes; scroll k lights lamp k. */
export const LAMPS = Array.from({ length: 8 }, (_, i) => {
  const a = ((22.5 + 45 * i) * Math.PI) / 180;
  return { x: 10.6 * Math.cos(a), z: 10.6 * Math.sin(a), h: 2.6 };
});

export const BUST = { x: 4.5, z: 6, h: 1.1 };

export const COLONNADE = { z: -36, xs: [-14, -10, -6, -2, 2, 6, 10, 14], h: 5.5, r: 0.42 };

export const CYPRESSES = [
  [-27, -10], [-27, -5], [-27, 0], [-27, 5], [-27, 10],
  [-19, -28], [9.5, -28.5], [-5, -28.5], [14.5, -28],
  [-22, 10.5], [22, 10.5],
];
export const OLIVES = [
  [-22, -40], [-18, -41], [18, -41], [22, -40],
  [29, -12], [29.5, 3], [28.5, 8.5],
];

export const SPAWN = { x: 0, z: 6.5, yaw: Math.PI }; // on the plaza, facing north

/* ── Geometry helpers ────────────────────────────────────────────────────── */
export function houseBox(h) {
  const [sx, sy, sz] = h.size;
  return { x0: h.c[0] - sx / 2, x1: h.c[0] + sx / 2, z0: h.c[1] - sz / 2, z1: h.c[1] + sz / 2, y1: sy };
}
export function houseInterior(h) {
  const b = houseBox(h);
  return { x0: b.x0 + WALL_T, x1: b.x1 - WALL_T, z0: b.z0 + WALL_T, z1: b.z1 - WALL_T, y1: b.y1 };
}

/* The door as a world segment on its face: centre + the axis it runs along. */
export function doorSpan(h, d = h.door) {
  const b = houseBox(h);
  const cx = h.c[0];
  const cz = h.c[1];
  switch (d.side) {
    case '+x': return { x: b.x1, z: cz + d.at, axis: 'z', w: d.w, h: d.h, nx: 1, nz: 0 };
    case '-x': return { x: b.x0, z: cz + d.at, axis: 'z', w: d.w, h: d.h, nx: -1, nz: 0 };
    case '+z': return { x: cx + d.at, z: b.z1, axis: 'x', w: d.w, h: d.h, nx: 0, nz: 1 };
    default:   return { x: cx + d.at, z: b.z0, axis: 'x', w: d.w, h: d.h, nx: 0, nz: -1 };
  }
}

/* Wall boxes for one house, split around its doorways. Doubles as the
   grey-box geometry and as the collider list. `closed` names doors that are
   currently shut (their gap gets a collider too). */
export function houseWalls(h, closed = new Set()) {
  const b = houseBox(h);
  const t = WALL_T;
  const doors = [['door', h.door], h.exit ? ['exit', h.exit] : null].filter(Boolean);
  const out = [];

  const face = (side, x0, x1, z0, z1) => {
    const d = doors.find(([, dd]) => dd.side === side);
    if (!d) return out.push({ x0, x1, z0, z1, y0: 0, y1: b.y1 });
    const [name, dd] = d;
    const span = doorSpan(h, dd);
    const gap0 = (span.axis === 'z' ? span.z : span.x) - dd.w / 2;
    const gap1 = gap0 + dd.w;
    if (span.axis === 'z') {
      out.push({ x0, x1, z0, z1: gap0, y0: 0, y1: b.y1 });
      out.push({ x0, x1, z0: gap1, z1, y0: 0, y1: b.y1 });
      out.push({ x0, x1, z0: gap0, z1: gap1, y0: dd.h, y1: b.y1, lintel: true });
      if (closed.has(name)) out.push({ x0, x1, z0: gap0, z1: gap1, y0: 0, y1: dd.h, door: name });
    } else {
      out.push({ x0, x1: gap0, z0, z1, y0: 0, y1: b.y1 });
      out.push({ x0: gap1, x1, z0, z1, y0: 0, y1: b.y1 });
      out.push({ x0: gap0, x1: gap1, z0, z1, y0: dd.h, y1: b.y1, lintel: true });
      if (closed.has(name)) out.push({ x0: gap0, x1: gap1, z0, z1, y0: 0, y1: dd.h, door: name });
    }
  };

  face('-x', b.x0, b.x0 + t, b.z0, b.z1);
  face('+x', b.x1 - t, b.x1, b.z0, b.z1);
  face('-z', b.x0 + t, b.x1 - t, b.z0, b.z0 + t);
  face('+z', b.x0 + t, b.x1 - t, b.z1 - t, b.z1);
  return out;
}

export function houseContaining(x, z) {
  for (const h of HOUSE_LIST) {
    const i = houseInterior(h);
    if (x > i.x0 && x < i.x1 && z > i.z0 && z < i.z1) return h.id;
  }
  return null;
}

/* Static colliders: walls (doors open), the terrace wall bar the stair gap,
   the sea parapet, the world edge, columns, lamp posts, trunks, the bust. */
export function staticColliders() {
  const c = [];
  for (const h of HOUSE_LIST) for (const w of houseWalls(h)) if (!w.lintel) c.push(w);
  // terrace retaining wall, leaving the stair gap
  c.push({ x0: BOUNDS.x0 - 5, x1: STAIR.x0, z0: TERRACE.z - 1, z1: TERRACE.z });
  c.push({ x0: STAIR.x1, x1: BOUNDS.x1 + 5, z0: TERRACE.z - 1, z1: TERRACE.z });
  // stair side cheeks so you cannot step off the ramp edge mid-climb
  c.push({ x0: STAIR.x0 - 0.5, x1: STAIR.x0, z0: STAIR.z1, z1: STAIR.z0 });
  c.push({ x0: STAIR.x1, x1: STAIR.x1 + 0.5, z0: STAIR.z1, z1: STAIR.z0 });
  // sea parapet
  c.push({ x0: BOUNDS.x0 - 5, x1: BOUNDS.x1 + 5, z0: SEA.z - 0.4, z1: SEA.z + 1 });
  // world edge
  c.push({ x0: BOUNDS.x0 - 5, x1: BOUNDS.x0, z0: BOUNDS.z0 - 5, z1: BOUNDS.z1 + 5 });
  c.push({ x0: BOUNDS.x1, x1: BOUNDS.x1 + 5, z0: BOUNDS.z0 - 5, z1: BOUNDS.z1 + 5 });
  c.push({ x0: BOUNDS.x0 - 5, x1: BOUNDS.x1 + 5, z0: BOUNDS.z0 - 5, z1: BOUNDS.z0 });
  for (const x of COLONNADE.xs) c.push({ x0: x - 0.5, x1: x + 0.5, z0: COLONNADE.z - 0.5, z1: COLONNADE.z + 0.5 });
  for (const l of LAMPS) c.push({ x0: l.x - 0.18, x1: l.x + 0.18, z0: l.z - 0.18, z1: l.z + 0.18 });
  for (const [x, z] of [...CYPRESSES, ...OLIVES]) c.push({ x0: x - 0.3, x1: x + 0.3, z0: z - 0.3, z1: z + 0.3 });
  c.push({ x0: BUST.x - 0.5, x1: BUST.x + 0.5, z0: BUST.z - 0.5, z1: BUST.z + 0.5 });
  return c;
}

/* Ground height under (x, z): plaza level, the stair ramp, the terrace and
   the hill behind it, the sea. Rooms may override (mezzanines) via the world. */
export function groundY(x, z) {
  if (x >= STAIR.x0 && x <= STAIR.x1 && z <= STAIR.z0 && z >= STAIR.z1) {
    const t = (STAIR.z0 - z) / (STAIR.z0 - STAIR.z1);
    return TERRACE.y * t;
  }
  if (z <= TERRACE.z) {
    let h = TERRACE.y;
    if (z < HILL.z) h += (HILL.z - z) * HILL.slope;
    return h;
  }
  if (z > SEA.z) return SEA.y;
  let h = 0;
  if (x < -28) h += (-28 - x) * 0.12;
  if (x > 32) h += (x - 32) * 0.12;
  return h;
}

/* Interior rooms: the grid each mechanism is built on. Everything else in a
   room file derives from these so the collider, the tiles and the Python
   shell agree. */
export const ROOMS = {
  window: {
    n: 8, tile: 1.0, k: 3,
    // floor grid origin (min x, min z) — centred in the interior
    origin: [HOUSES.window.c[0] - 4, HOUSES.window.c[1] - 4],
    // the feature map builds on the west (far) wall
    wallX: houseInterior(HOUSES.window).x0 + 0.02,
    wallTile: 0.6,
    wallY0: 0.6,
  },
  eyes: {
    n: 6, tile: 1.0, k: 3,
    origin: [HOUSES.eyes.c[0] - 3, HOUSES.eyes.c[1] - 3],
    channelY: [0.14, 0.42, 0.7],
    sheetY: 3.6,       // layer-1 output sheets + mezzanine deck
    sheetGap: 0.16,
    deckY: 3.75,
    topY: 7.2,         // layer-2 output
    stair: { x0: 3.9, x1: 5.6, z0: -18.8, z1: -25.8 }, // along the east wall, rising northward
    eqWallZ: houseInterior(HOUSES.eyes).z0 + 0.03,
  },
  door: {
    tile: 0.8,
    // three floors along the corridor (x increases eastward)
    r1: { n: 6, x0: 10.2, zc: -3 },
    gate1X: 16.4,
    r2: { x0: 17.4, zc: -3 },
    gate2X: 23.2,
    r3: { x0: 24.2, zc: -3 },
    exitX: houseBox(HOUSES.door).x1,
  },
};
