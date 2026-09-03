// The office builder's data model, shared by the 3D client and the server
// action. The floor is a freeform set of painted tiles (integer coords);
// walls sit on the EDGES between cells; furniture lives on the tiles.
// Agents are stationed at a desk and roam the ROOM the desk sits in - the
// zone is derived (flood fill from the desk, stopping at walls AND doorways),
// never hand-painted, and recomputed by `normalizeZones` on every mutation.
// The server sanitises every incoming layout through `sanitizeLayout` before
// it touches the database.

export type Rot = 0 | 1 | 2 | 3; // quarter turns, clockwise from +Z

export type Tile = [x: number, z: number];

export type FurnitureType =
  | "desk"
  | "plant"
  | "beanbag"
  | "bookshelf"
  | "coffee"
  | "lamp"
  | "whiteboard"
  | "server";

const FURNITURE_TYPES: readonly FurnitureType[] = [
  "desk",
  "plant",
  "beanbag",
  "bookshelf",
  "coffee",
  "lamp",
  "whiteboard",
  "server",
];

/** Furniture that can seat an agent. A desk, and only a desk: an agent works
    at a workstation, and beanbags are scenery. (Layouts saved before
    2026-08-03 could seat someone in one - sanitizeLayout migrates those.) */
export function isSeat(type: FurnitureType): boolean {
  return type === "desk";
}

export type Item = {
  id: string;
  type: FurnitureType;
  x: number;
  z: number;
  rot: Rot;
};

/**
 * A wall segment on a cell edge. Orientation "h" is the edge between cells
 * (x, z-1) and (x, z) - a segment running along the X axis at z-0.5.
 * Orientation "v" is the edge between (x-1, z) and (x, z) - running along
 * the Z axis at x-0.5. `door` turns the segment into a doorway.
 */
export type WallOrientation = "h" | "v";
export type Wall = {
  x: number;
  z: number;
  o: WallOrientation;
  door: boolean;
};

export type AgentPlacement = {
  workerId: string;
  /** The desk this agent is stationed at - agents always live at a desk. */
  deskId: string;
  /**
   * Floor tiles the agent may roam. Always contains the desk tile and stays
   * connected to it (walking through doors, never through solid walls).
   */
  zone: Tile[];
};

/** Optional room-size hint the auto-planner honours (MCP-driven offices). */
export type RoomSize = "small" | "medium" | "large";
/** Direction a room sits relative to another (MCP-driven offices). */
export type RoomDir = "above" | "below" | "left" | "right";

/** A named colour the user painted into their legend, e.g. "Marketing".
    The optional `size`/`place` hints are only set by the MCP auto-planner; the
    hand builder ignores them, but they persist here so re-layouts stay stable. */
export type LegendEntry = {
  id: string;
  name: string;
  color: string; // #rrggbb
  size?: RoomSize;
  place?: { dir: RoomDir; of: string };
};

const ROOM_SIZES: readonly string[] = ["small", "medium", "large"];
const ROOM_DIRS: readonly string[] = ["above", "below", "left", "right"];

export type OfficeLayout = {
  v: 1;
  tiles: Tile[];
  walls: Wall[];
  items: Item[];
  agents: AgentPlacement[];
  legend: LegendEntry[];
  /** Floor colouring: tile key (`keyOf`) → legend entry id. */
  tints: Record<string, string>;
};

/** Legacy fixed grid half-width - only the auto-planner and the legacy
    {bounds} import still think in these terms. Hand painting is bounded by
    MAX_SPAN below, which travels with the office instead. */
export const PAINT_RADIUS = 9;
/** Max floor footprint per axis, in tiles. A SPAN, not an area around the
    origin: the box is measured over whatever is painted, so an office that
    grew east keeps growing east until it is 19 wide - it is never cut off
    on one side while the other has room. */
export const MAX_SPAN = PAINT_RADIUS * 2 + 1;
/** Absolute backstop so tile coordinates can't wander to silly magnitudes
    (an office CAN drift - erase one side, paint the other - just not this far). */
const HARD_RADIUS = 999;
export const MAX_TILES = 260;
export const MAX_WALLS = 300;
export const MAX_ITEMS = 120;
/** How many tiles one agent's room-roam may cover (big rooms get clipped
    to the nearest tiles so saved layouts stay bounded). */
export const MAX_ZONE = 80;
/** How many named colours the legend may hold. */
export const MAX_LEGEND = 12;
export const LEGEND_NAME_MAX = 24;

export const keyOf = (x: number, z: number) => `${x},${z}`;
export const wallKey = (x: number, z: number, o: WallOrientation) => `${x},${z},${o}`;

export function tileSet(layout: OfficeLayout): Set<string> {
  return new Set(layout.tiles.map(([x, z]) => keyOf(x, z)));
}

export function hasTile(layout: OfficeLayout, x: number, z: number) {
  return layout.tiles.some(([tx, tz]) => tx === x && tz === z);
}

export function findWall(layout: OfficeLayout, x: number, z: number, o: WallOrientation) {
  return layout.walls.find((w) => w.x === x && w.z === z && w.o === o);
}

/** Centre of mass of the floor - where the camera should look. */
export function centroid(layout: OfficeLayout): [number, number] {
  if (layout.tiles.length === 0) return [0, 0];
  let sx = 0;
  let sz = 0;
  for (const [x, z] of layout.tiles) {
    sx += x;
    sz += z;
  }
  return [sx / layout.tiles.length, sz / layout.tiles.length];
}

export type PaintBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

/**
 * The region a NEW tile may be painted into, in tile coords inclusive:
 * anywhere that keeps the floor's bounding box within MAX_SPAN per axis.
 * With no tiles yet, only the hard backstop applies. Once one axis is at
 * full span, that axis's range collapses to exactly the painted extent -
 * which is what the builder's barrier flash draws for the user.
 */
export function paintBounds(layout: OfficeLayout): PaintBounds {
  if (layout.tiles.length === 0) {
    return {
      minX: -HARD_RADIUS,
      maxX: HARD_RADIUS,
      minZ: -HARD_RADIUS,
      maxZ: HARD_RADIUS,
    };
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (const [x, z] of layout.tiles) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  return {
    minX: Math.max(maxX - (MAX_SPAN - 1), -HARD_RADIUS),
    maxX: Math.min(minX + (MAX_SPAN - 1), HARD_RADIUS),
    minZ: Math.max(maxZ - (MAX_SPAN - 1), -HARD_RADIUS),
    maxZ: Math.min(minZ + (MAX_SPAN - 1), HARD_RADIUS),
  };
}

export function inPaintBounds(b: PaintBounds, x: number, z: number) {
  return x >= b.minX && x <= b.maxX && z >= b.minZ && z <= b.maxZ;
}

/** Can a new floor tile be painted here? */
export function canPaint(layout: OfficeLayout, x: number, z: number) {
  return (
    inPaintBounds(paintBounds(layout), x, z) &&
    layout.tiles.length < MAX_TILES &&
    !hasTile(layout, x, z)
  );
}

/**
 * Can this floor tile be erased? Not while furniture stands on it, and
 * never the last tile. (Roam zones shrink automatically.)
 */
export function canErase(layout: OfficeLayout, x: number, z: number) {
  if (!hasTile(layout, x, z)) return false;
  if (layout.tiles.length <= 1) return false;
  const k = keyOf(x, z);
  if (layout.items.some((i) => keyOf(i.x, i.z) === k)) return false;
  return true;
}

export function paintTile(layout: OfficeLayout, x: number, z: number): OfficeLayout {
  if (!canPaint(layout, x, z)) return layout;
  return { ...layout, tiles: [...layout.tiles, [x, z]] };
}

export function eraseTile(layout: OfficeLayout, x: number, z: number): OfficeLayout {
  if (!canErase(layout, x, z)) return layout;
  const tiles = layout.tiles.filter(([tx, tz]) => !(tx === x && tz === z));
  const keys = new Set(tiles.map(([tx, tz]) => keyOf(tx, tz)));
  // Walls only exist against floor: drop segments left touching nothing.
  const walls = layout.walls.filter((w) => wallTouchesFloor(keys, w.x, w.z, w.o));
  const { [keyOf(x, z)]: _gone, ...tints } = layout.tints;
  return normalizeZones({ ...layout, tiles, walls, tints });
}

/* ── Legend & floor colours ────────────────────────────────────────────── */

const cleanColor = (s: unknown) =>
  typeof s === "string" && /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;

export function addLegendEntry(
  layout: OfficeLayout,
  entry: LegendEntry,
): OfficeLayout {
  const id = entry.id;
  const name = entry.name.trim().slice(0, LEGEND_NAME_MAX);
  const color = cleanColor(entry.color);
  if (!id || !name || !color) return layout;
  if (layout.legend.length >= MAX_LEGEND) return layout;
  if (layout.legend.some((e) => e.id === id)) return layout;
  return { ...layout, legend: [...layout.legend, { id, name, color }] };
}

/**
 * Rename a department or change its colour. Tiles keep pointing at the entry
 * ID, so a recolour repaints every room of that department at once - which is
 * the whole reason tints store the id rather than the hex.
 */
export function updateLegendEntry(
  layout: OfficeLayout,
  id: string,
  patch: { name?: string; color?: string },
): OfficeLayout {
  const entry = layout.legend.find((e) => e.id === id);
  if (!entry) return layout;
  const name =
    patch.name !== undefined
      ? patch.name.trim().slice(0, LEGEND_NAME_MAX)
      : entry.name;
  const color =
    patch.color !== undefined ? cleanColor(patch.color) : entry.color;
  if (!name || !color) return layout;
  if (name === entry.name && color === entry.color) return layout;
  return {
    ...layout,
    legend: layout.legend.map((e) =>
      e.id === id ? { ...e, name, color } : e,
    ),
  };
}

/** Remove a legend colour - every tile painted with it reverts to plain floor. */
export function removeLegendEntry(layout: OfficeLayout, id: string): OfficeLayout {
  if (!layout.legend.some((e) => e.id === id)) return layout;
  const tints = Object.fromEntries(
    Object.entries(layout.tints).filter(([, v]) => v !== id),
  );
  return { ...layout, legend: layout.legend.filter((e) => e.id !== id), tints };
}

export function tintTile(
  layout: OfficeLayout,
  x: number,
  z: number,
  legendId: string,
): OfficeLayout {
  if (!hasTile(layout, x, z)) return layout;
  if (!layout.legend.some((e) => e.id === legendId)) return layout;
  const k = keyOf(x, z);
  if (layout.tints[k] === legendId) return layout;
  return { ...layout, tints: { ...layout.tints, [k]: legendId } };
}

export function untintTile(layout: OfficeLayout, x: number, z: number): OfficeLayout {
  const k = keyOf(x, z);
  if (!(k in layout.tints)) return layout;
  const { [k]: _gone, ...tints } = layout.tints;
  return { ...layout, tints };
}

/* ── Walls ─────────────────────────────────────────────────────────────── */

/** The two cells an edge sits between. */
export function wallCells(
  x: number,
  z: number,
  o: WallOrientation,
): [Tile, Tile] {
  return o === "h"
    ? [[x, z - 1], [x, z]]
    : [[x - 1, z], [x, z]];
}

function wallTouchesFloor(
  tileKeys: Set<string>,
  x: number,
  z: number,
  o: WallOrientation,
) {
  const [[ax, az], [bx, bz]] = wallCells(x, z, o);
  return tileKeys.has(keyOf(ax, az)) || tileKeys.has(keyOf(bx, bz));
}

/** Can a wall segment go on this edge? It must border at least one tile. */
export function canPlaceWall(
  layout: OfficeLayout,
  x: number,
  z: number,
  o: WallOrientation,
) {
  if (layout.walls.length >= MAX_WALLS) return false;
  if (findWall(layout, x, z, o)) return false;
  return wallTouchesFloor(tileSet(layout), x, z, o);
}

export function addWall(
  layout: OfficeLayout,
  x: number,
  z: number,
  o: WallOrientation,
): OfficeLayout {
  if (!canPlaceWall(layout, x, z, o)) return layout;
  return normalizeZones({
    ...layout,
    walls: [...layout.walls, { x, z, o, door: false }],
  });
}

export function removeWall(
  layout: OfficeLayout,
  x: number,
  z: number,
  o: WallOrientation,
): OfficeLayout {
  if (!findWall(layout, x, z, o)) return layout;
  return {
    ...layout,
    walls: layout.walls.filter((w) => !(w.x === x && w.z === z && w.o === o)),
  };
}

/** Flip a wall segment between solid wall and doorway. */
export function toggleDoor(
  layout: OfficeLayout,
  x: number,
  z: number,
  o: WallOrientation,
): OfficeLayout {
  if (!findWall(layout, x, z, o)) return layout;
  return normalizeZones({
    ...layout,
    walls: layout.walls.map((w) =>
      w.x === x && w.z === z && w.o === o ? { ...w, door: !w.door } : w,
    ),
  });
}

/**
 * The cell edge nearest a world point - how the wall tools decide which
 * edge the pointer means. `dist` is the perpendicular distance (0..~0.5),
 * so callers can require the pointer to be close before acting.
 */
export function nearestEdge(
  wx: number,
  wz: number,
): { x: number; z: number; o: WallOrientation; dist: number } {
  const rx = Math.round(wx);
  const rz = Math.round(wz);
  const fx = wx - rx;
  const fz = wz - rz;
  const cands = [
    { x: rx, z: rz, o: "v" as const, dist: Math.abs(fx + 0.5) },
    { x: rx + 1, z: rz, o: "v" as const, dist: Math.abs(0.5 - fx) },
    { x: rx, z: rz, o: "h" as const, dist: Math.abs(fz + 0.5) },
    { x: rx, z: rz + 1, o: "h" as const, dist: Math.abs(0.5 - fz) },
  ];
  let best = cands[0];
  for (const c of cands) if (c.dist < best.dist) best = c;
  return best;
}

/* ── Wall occlusion (dollhouse fade) ───────────────────────────────────── */

/** Sample spots along a wall's 1-tile length × depths behind it. At the iso
    elevation (atan(1/√2)) a ~0.95-tall wall hides the ground up to
    0.95·√2 ≈ 1.34 units along the camera ray, so depths run to 1.3. */
const FADE_SPAN = [-0.45, -0.15, 0.15, 0.45];
const FADE_DEPTH = [0.25, 0.6, 0.95, 1.3];

/**
 * Ray-style occlusion test: project the wall's silhouette along the camera's
 * flattened view direction (fx, fz - normalized) onto the ground. True when
 * any of that footprint lands on a painted floor tile, i.e. the wall stands
 * between the camera and the office and should hollow out.
 */
export function wallOccludes(
  wall: Pick<Wall, "x" | "z" | "o">,
  fx: number,
  fz: number,
  tileKeys: Set<string>,
): boolean {
  const cx = wall.o === "h" ? wall.x : wall.x - 0.5;
  const cz = wall.o === "h" ? wall.z - 0.5 : wall.z;
  const ax = wall.o === "h" ? 1 : 0;
  const az = wall.o === "h" ? 0 : 1;
  for (const t of FADE_SPAN) {
    for (const s of FADE_DEPTH) {
      const gx = Math.round(cx + ax * t + fx * s);
      const gz = Math.round(cz + az * t + fz * s);
      if (tileKeys.has(keyOf(gx, gz))) return true;
    }
  }
  return false;
}

/* ── Walkability ───────────────────────────────────────────────────────── */

/** The edge between two 4-adjacent cells (null if not adjacent). */
export function edgeBetween(
  ax: number,
  az: number,
  bx: number,
  bz: number,
): { x: number; z: number; o: WallOrientation } | null {
  if (ax === bx && Math.abs(az - bz) === 1) {
    return { x: ax, z: Math.max(az, bz), o: "h" };
  }
  if (az === bz && Math.abs(ax - bx) === 1) {
    return { x: Math.max(ax, bx), z: az, o: "v" };
  }
  return null;
}

/** Can something walk between two adjacent cells? Doors are open. */
export function isOpen(
  walls: Wall[],
  ax: number,
  az: number,
  bx: number,
  bz: number,
) {
  const e = edgeBetween(ax, az, bx, bz);
  if (!e) return false;
  const w = walls.find((w) => w.x === e.x && w.z === e.z && w.o === e.o);
  return !w || w.door;
}

const NEIGHBOURS: Tile[] = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/**
 * Shortest walk between two tiles of a zone (BFS, doors open, solid walls
 * closed). `from` is always allowed as a start even if it fell out of the
 * zone. Returns the tile list from→to inclusive, or null if unreachable.
 */
export function zonePath(
  zone: Tile[],
  walls: Wall[],
  from: Tile,
  to: Tile,
): Tile[] | null {
  const allowed = new Set(zone.map(([x, z]) => keyOf(x, z)));
  allowed.add(keyOf(from[0], from[1]));
  if (!allowed.has(keyOf(to[0], to[1]))) return null;
  const startK = keyOf(from[0], from[1]);
  const parent = new Map<string, string | null>([[startK, null]]);
  const queue: Tile[] = [from];
  while (queue.length) {
    const [x, z] = queue.shift()!;
    if (x === to[0] && z === to[1]) {
      // Walk parents back into a path.
      const path: Tile[] = [];
      let k: string | null = keyOf(x, z);
      while (k) {
        const [px, pz] = k.split(",").map(Number);
        path.unshift([px, pz]);
        k = parent.get(k) ?? null;
      }
      return path;
    }
    for (const [dx, dz] of NEIGHBOURS) {
      const nx = x + dx;
      const nz = z + dz;
      const nk = keyOf(nx, nz);
      if (!allowed.has(nk) || parent.has(nk)) continue;
      if (!isOpen(walls, x, z, nx, nz)) continue;
      parent.set(nk, keyOf(x, z));
      queue.push([nx, nz]);
    }
  }
  return null;
}

/**
 * Flood-fill the floor reachable on foot from `start`: floor tiles free of
 * furniture (the start tile - usually the desk - excepted) reached through
 * open edges (doors count, solid walls don't), capped at `limit` tiles.
 *
 * With `throughDoors: false` the fill stops at doorways too, which turns it
 * into "the room around `start`" - a doorway is where the room ends, even
 * though an agent could physically step through it.
 */
export function walkableFrom(
  layout: OfficeLayout,
  start: Tile,
  limit = 40,
  throughDoors = true,
): Tile[] {
  const floor = tileSet(layout);
  const startK = keyOf(start[0], start[1]);
  if (!floor.has(startK)) return [[start[0], start[1]]];
  // Other furniture blocks a step; the agent's own desk tile stays walkable.
  const occupied = new Set(
    layout.items.map((i) => keyOf(i.x, i.z)).filter((k) => k !== startK),
  );
  const open = (ax: number, az: number, bx: number, bz: number) => {
    const e = edgeBetween(ax, az, bx, bz);
    if (!e) return false;
    const w = layout.walls.find(
      (w) => w.x === e.x && w.z === e.z && w.o === e.o,
    );
    return !w || (throughDoors && w.door);
  };
  const seen = new Set([startK]);
  const out: Tile[] = [[start[0], start[1]]];
  const queue: Tile[] = [start];
  while (queue.length && out.length < limit) {
    const [x, z] = queue.shift()!;
    for (const [dx, dz] of NEIGHBOURS) {
      const nx = x + dx;
      const nz = z + dz;
      const nk = keyOf(nx, nz);
      if (seen.has(nk) || !floor.has(nk) || occupied.has(nk)) continue;
      if (!open(x, z, nx, nz)) continue;
      seen.add(nk);
      out.push([nx, nz]);
      queue.push([nx, nz]);
      if (out.length >= limit) break;
    }
  }
  return out;
}

/**
 * The room an agent's desk sits in: the tiles reachable from the desk
 * without crossing a wall OR a doorway. This IS the agent's roam zone -
 * there is no hand-painted zone any more.
 */
export function roomFrom(layout: OfficeLayout, start: Tile): Tile[] {
  return walkableFrom(layout, start, MAX_ZONE, false);
}

/**
 * Re-establish every agent's invariants after the world changed under them:
 * their desk must still exist, and their zone IS the room the desk sits in,
 * recomputed from scratch. Stored zones are projections of this - moving a
 * wall, cutting a doorway or dropping furniture reshapes them automatically.
 */
export function normalizeZones(layout: OfficeLayout): OfficeLayout {
  const agents: AgentPlacement[] = [];
  for (const a of layout.agents) {
    const desk = layout.items.find((i) => i.id === a.deskId && isSeat(i.type));
    if (!desk) continue; // station gone - the agent goes off the floor
    agents.push({ ...a, zone: roomFrom(layout, [desk.x, desk.z]) });
  }
  return { ...layout, agents };
}

/* ── Furniture & agents ────────────────────────────────────────────────── */

/** Can `type` be placed at (x,z)? (Ignores the item `ignoreId`, for moves.) */
export function canPlaceItem(
  layout: OfficeLayout,
  x: number,
  z: number,
  ignoreId?: string,
) {
  if (!hasTile(layout, x, z)) return false;
  const k = keyOf(x, z);
  for (const it of layout.items) {
    if (it.id !== ignoreId && keyOf(it.x, it.z) === k) return false;
  }
  return true;
}

/**
 * The desk an agent would be stationed at if dropped on (x,z) - agents can
 * only be placed on an unoccupied desk. Null means "can't drop here".
 */
export function agentDropTarget(
  layout: OfficeLayout,
  x: number,
  z: number,
  ignoreWorkerId?: string,
): Item | null {
  const desk = layout.items.find(
    (i) => i.type === "desk" && i.x === x && i.z === z,
  );
  if (!desk) return null;
  const taken = layout.agents.some(
    (a) => a.workerId !== ignoreWorkerId && a.deskId === desk.id,
  );
  return taken ? null : desk;
}

function rectTiles(minX: number, maxX: number, minZ: number, maxZ: number): Tile[] {
  const tiles: Tile[] = [];
  for (let x = minX; x <= maxX; x++)
    for (let z = minZ; z <= maxZ; z++) tiles.push([x, z]);
  return tiles;
}

/** Starting office: a cosy 5×5. */
export function defaultLayout(): OfficeLayout {
  return {
    v: 1,
    tiles: rectTiles(-2, 2, -2, 2),
    walls: [],
    items: [],
    agents: [],
    legend: [],
    tints: {},
  };
}

/**
 * First visit for a business that already has workers: lay desks out in
 * neat rows and seat everyone, so the team shows up furnished, not empty.
 */
export function seedLayout(workerIds: string[]): OfficeLayout {
  const layout = defaultLayout();
  const n = Math.min(workerIds.length, 6);
  const cols = [-2, 0, 2];
  for (let i = 0; i < n; i++) {
    const x = cols[i % 3];
    const z = i < 3 ? -1 : 1;
    const desk: Item = { id: `seed-desk-${i}`, type: "desk", x, z, rot: 0 };
    layout.items.push(desk);
    layout.agents.push({ workerId: workerIds[i], deskId: desk.id, zone: [[x, z]] });
  }
  return layout;
}

/**
 * The layout a business actually looks at: their saved one, re-sanitised, or
 * the seeded starter office if they have never saved. Shared by the office
 * floor and the Workers screen - which reads it to know who has been PLACED,
 * since an unplaced worker is "Not onboarded".
 */
export function resolveLayout(
  stored: unknown,
  orderedWorkerIds: string[],
): OfficeLayout {
  if (stored != null) return sanitizeLayout(stored, new Set(orderedWorkerIds));
  return orderedWorkerIds.length > 0
    ? seedLayout(orderedWorkerIds)
    : defaultLayout();
}

/** Workers stationed at a desk in this layout - i.e. onboarded into the office. */
export function placedWorkerIds(layout: OfficeLayout): Set<string> {
  return new Set(layout.agents.map((a) => a.workerId));
}

const isInt = (n: unknown): n is number => Number.isInteger(n);
const cleanId = (s: unknown) =>
  typeof s === "string" && /^[\w-]{1,64}$/.test(s) ? s : null;

/**
 * Server-side gatekeeper: rebuild a trustworthy layout from arbitrary client
 * JSON. Anything malformed is dropped rather than rejected wholesale, so a
 * partially-bad save still lands the good parts. Understands the legacy
 * rectangle format ({bounds}) and legacy free-standing agents (which are
 * dropped - agents now require a desk).
 */
export function sanitizeLayout(
  raw: unknown,
  validWorkerIds: Set<string>,
): OfficeLayout {
  const out: OfficeLayout = {
    v: 1,
    tiles: [],
    walls: [],
    items: [],
    agents: [],
    legend: [],
    tints: {},
  };
  if (typeof raw !== "object" || raw === null) return defaultLayout();
  const r = raw as Record<string, unknown>;

  // ── Tiles ──
  // Span is enforced the same way painting built the array: in order, with
  // a running bounding box. A tile that would stretch the box past MAX_SPAN
  // is dropped; every tile painted before it keeps its place.
  const seenTiles = new Set<string>();
  let bb: PaintBounds | null = null;
  if (Array.isArray(r.tiles)) {
    for (const t of r.tiles.slice(0, MAX_TILES * 2)) {
      if (out.tiles.length >= MAX_TILES) break;
      if (!Array.isArray(t) || !isInt(t[0]) || !isInt(t[1])) continue;
      const [x, z] = t as [number, number];
      if (Math.abs(x) > HARD_RADIUS || Math.abs(z) > HARD_RADIUS) continue;
      const nb: PaintBounds = bb
        ? {
            minX: Math.min(bb.minX, x),
            maxX: Math.max(bb.maxX, x),
            minZ: Math.min(bb.minZ, z),
            maxZ: Math.max(bb.maxZ, z),
          }
        : { minX: x, maxX: x, minZ: z, maxZ: z };
      if (nb.maxX - nb.minX >= MAX_SPAN || nb.maxZ - nb.minZ >= MAX_SPAN) continue;
      const k = keyOf(x, z);
      if (seenTiles.has(k)) continue;
      bb = nb;
      seenTiles.add(k);
      out.tiles.push([x, z]);
    }
  } else if (typeof r.bounds === "object" && r.bounds !== null) {
    // Legacy rectangle layout from before the paint tool.
    const b = r.bounds as Record<string, unknown>;
    if (isInt(b.minX) && isInt(b.maxX) && isInt(b.minZ) && isInt(b.maxZ)) {
      const minX = Math.max(b.minX as number, -PAINT_RADIUS);
      const maxX = Math.min(b.maxX as number, PAINT_RADIUS);
      const minZ = Math.max(b.minZ as number, -PAINT_RADIUS);
      const maxZ = Math.min(b.maxZ as number, PAINT_RADIUS);
      if (maxX >= minX && maxZ >= minZ) {
        for (const [x, z] of rectTiles(minX, maxX, minZ, maxZ)) {
          if (out.tiles.length >= MAX_TILES) break;
          seenTiles.add(keyOf(x, z));
          out.tiles.push([x, z]);
        }
      }
    }
  }
  if (out.tiles.length === 0) return defaultLayout();

  // ── Legend ── (named colours for painting floor sections)
  const legendIds = new Set<string>();
  if (Array.isArray(r.legend)) {
    for (const rawEntry of r.legend.slice(0, MAX_LEGEND * 2)) {
      if (out.legend.length >= MAX_LEGEND) break;
      const e = rawEntry as Record<string, unknown>;
      const id = cleanId(e.id);
      const color = cleanColor(e.color);
      const name =
        typeof e.name === "string" ? e.name.trim().slice(0, LEGEND_NAME_MAX) : "";
      if (!id || legendIds.has(id) || !color || !name) continue;
      legendIds.add(id);
      const entry: LegendEntry = { id, name, color };
      if (typeof e.size === "string" && ROOM_SIZES.includes(e.size)) {
        entry.size = e.size as RoomSize;
      }
      if (e.place && typeof e.place === "object") {
        const pl = e.place as Record<string, unknown>;
        const of = cleanId(pl.of);
        if (typeof pl.dir === "string" && ROOM_DIRS.includes(pl.dir) && of) {
          entry.place = { dir: pl.dir as RoomDir, of };
        }
      }
      out.legend.push(entry);
    }
  }

  // ── Tints ── (tile key → legend id; both ends must exist)
  if (typeof r.tints === "object" && r.tints !== null) {
    for (const [k, v] of Object.entries(r.tints).slice(0, MAX_TILES * 2)) {
      if (!seenTiles.has(k)) continue;
      if (typeof v !== "string" || !legendIds.has(v)) continue;
      out.tints[k] = v;
    }
  }

  // ── Walls ──
  const seenWalls = new Set<string>();
  if (Array.isArray(r.walls)) {
    for (const rawWall of r.walls.slice(0, MAX_WALLS * 2)) {
      if (out.walls.length >= MAX_WALLS) break;
      const w = rawWall as Record<string, unknown>;
      if (!isInt(w.x) || !isInt(w.z)) continue;
      if (w.o !== "h" && w.o !== "v") continue;
      const k = wallKey(w.x as number, w.z as number, w.o);
      if (seenWalls.has(k)) continue;
      if (!wallTouchesFloor(seenTiles, w.x as number, w.z as number, w.o)) continue;
      seenWalls.add(k);
      out.walls.push({
        x: w.x as number,
        z: w.z as number,
        o: w.o,
        door: w.door === true,
      });
    }
  }

  // ── Items ──
  const seenItemTiles = new Set<string>();
  const seenIds = new Set<string>();
  if (Array.isArray(r.items)) {
    for (const rawItem of r.items.slice(0, MAX_ITEMS * 2)) {
      if (out.items.length >= MAX_ITEMS) break;
      const it = rawItem as Record<string, unknown>;
      const id = cleanId(it.id);
      if (!id || seenIds.has(id)) continue;
      if (!FURNITURE_TYPES.includes(it.type as FurnitureType)) continue;
      if (!isInt(it.x) || !isInt(it.z)) continue;
      const k = keyOf(it.x as number, it.z as number);
      if (!seenTiles.has(k) || seenItemTiles.has(k)) continue;
      const rot = (isInt(it.rot) ? (((it.rot as number) % 4) + 4) % 4 : 0) as Rot;
      seenItemTiles.add(k);
      seenIds.add(id);
      out.items.push({
        id,
        type: it.type as FurnitureType,
        x: it.x as number,
        z: it.z as number,
        rot,
      });
    }
  }

  // ── Agents ── (must claim a real, unclaimed desk; the zone is derived
  // from the desk's room below, so any incoming zone data is ignored)
  const seenWorkers = new Set<string>();
  const usedDesks = new Set<string>();
  if (Array.isArray(r.agents)) {
    for (const rawAgent of r.agents.slice(0, 200)) {
      const a = rawAgent as Record<string, unknown>;
      const workerId = cleanId(a.workerId);
      if (!workerId || !validWorkerIds.has(workerId)) continue;
      if (seenWorkers.has(workerId)) continue;
      const deskId = cleanId(a.deskId);
      if (!deskId || usedDesks.has(deskId)) continue;
      const desk = out.items.find((i) => i.id === deskId);
      // Beanbags used to be a second kind of workstation. They are scenery
      // now, so a claimed one becomes the desk it should always have been -
      // the agent keeps their spot instead of silently falling off the floor.
      if (desk?.type === "beanbag") desk.type = "desk";
      if (!desk || !isSeat(desk.type)) continue;

      seenWorkers.add(workerId);
      usedDesks.add(deskId);
      out.agents.push({ workerId, deskId, zone: [[desk.x, desk.z]] });
    }
  }

  // Derive every agent's zone (their desk's room) in one final pass.
  return normalizeZones(out);
}
