/* ============================================================================
   The one place that understands every shell shape (CONTRACTS.md section 6):
     box      (v1, v2)  { width, depth, height, ... }
     polygon  (v2)      { outline: [[x, z]...], height, ceiling: { shape... } }
     building (v2)      { building, room } -> the room of a building.json
   resolveShell() turns any of them into one normalised shell in the room's
   own frame, so the viewer, check-scene, the walk grid and AR never branch on
   the shape. Python mirror: scene_io.resolve_shell().

   Normalised shell:
   {
     kind: 'box' | 'polygon' | 'building',
     outline: [[x, z]...]     inner faces of the walls, positive winding (polygon.js)
     box: { min: [x, z], max: [x, z] }   the outline's bounding box (min = [0, 0] for box and
                              polygon shells; a building room's starts at its walls' half thickness)
     width, depth             the box's size
     height                   walls at the eaves (flat: the ceiling)
     top                      highest point of the ceiling
     ceiling: { shape, peak, axis, ridgeAt, eaves, apex, low, show, color }
     walls: [{ id, node, a, b, out, length, thickness, legacy }]
        node = the GLB node: legacy `wall_<side>` (v1), else `wall__<id>`
        a, b = the inner face's ends; offsets along it run from a
        out  = outward unit normal [x, z]; legacy = 'north'… for v1 names
     openings: [{ index, wall, type, offset, width, height, sill, head, from, to, spec }]
     floor, wallsSpec           the finishes (scene shell or building room)
   }
   ========================================================================== */

import { bbox, centroid, edgeOut, insetEdges, insetPolygon, rayScale, windingSign } from './polygon.js';
import { levelById, roomById, roomEdges, roomFrame, wallOpenings } from '../building/geometry.js';

export const SIDES = ['north', 'south', 'east', 'west'];
/** Outward normal of each legacy box wall. */
export const SIDE_OUT = { north: [0, -1], south: [0, 1], west: [-1, 0], east: [1, 0] };

export function shellKind(shell) {
  if (!shell) return null;
  if (shell.building) return 'building';
  if (shell.outline) return 'polygon';
  return 'box';
}

const defaultSill = (op) => op.sill ?? (op.type === 'window' ? 0.9 : 0);

/**
 * Normalise a scene's shell. `building` (a building.json) is needed for a room
 * of a building; without it that shell resolves to null. `legacyNames` (default:
 * v1 scenes) keeps the v1 GLB wall names `wall_<side>`.
 */
export function resolveShell(scene, building = null, { legacyNames = (scene?.version ?? 1) < 2 } = {}) {
  const sh = scene?.shell;
  const kind = shellKind(sh);
  if (!kind) return null;
  if (kind === 'building') return building ? buildingRoomShell(building, sh.room) : null;

  let outline;
  let walls;
  if (kind === 'box') {
    const W = sh.width;
    const D = sh.depth;
    outline = [[0, 0], [W, 0], [W, D], [0, D]];
    const ends = { north: [[0, 0], [W, 0]], south: [[0, D], [W, D]], west: [[0, 0], [0, D]], east: [[W, 0], [W, D]] };
    walls = SIDES.map((side) => {
      const [a, b] = ends[side];
      return {
        id: side,
        node: legacyNames ? `wall_${side}` : `wall__${side}`,
        a,
        b,
        out: SIDE_OUT[side],
        length: side === 'north' || side === 'south' ? W : D,
        thickness: sh.walls?.thickness ?? 0.12,
        legacy: side,
      };
    });
  } else {
    const pts = sh.outline.map(([x, z]) => [x, z]);
    const sign = windingSign(pts);
    walls = pts.map((a, i) => {
      const b = pts[(i + 1) % pts.length];
      return { id: `e${i}`, node: `wall__e${i}`, a, b, out: edgeOut(a, b, sign), length: Math.hypot(b[0] - a[0], b[1] - a[1]), thickness: sh.walls?.thickness ?? 0.12, legacy: null };
    });
    outline = sign > 0 ? pts : [...pts].reverse();
  }
  const box = bbox(outline);
  const byId = new Map(walls.map((w) => [w.id, w]));
  const openings = (sh.openings || [])
    .map((op, index) => {
      const w = byId.get(op.edge !== undefined ? `e${op.edge}` : op.wall);
      return w ? placeOpening(index, w, op) : null;
    })
    .filter(Boolean);
  return finish({ kind, outline, box, walls, openings, height: sh.height, ceilingSpec: sh.ceiling || {}, floor: sh.floor || {}, wallsSpec: sh.walls || {} });
}

function placeOpening(index, w, op) {
  const ux = (w.b[0] - w.a[0]) / (w.length || 1);
  const uz = (w.b[1] - w.a[1]) / (w.length || 1);
  const sill = defaultSill(op);
  return {
    index,
    wall: w.id,
    type: op.type,
    offset: op.offset,
    width: op.width,
    height: op.height,
    sill,
    head: sill + op.height,
    from: [w.a[0] + ux * op.offset, w.a[1] + uz * op.offset],
    to: [w.a[0] + ux * (op.offset + op.width), w.a[1] + uz * (op.offset + op.width)],
    spec: op,
  };
}

/** A building's room as a normalised shell, in the room frame. */
export function buildingRoomShell(building, roomId) {
  const room = roomById(building, roomId);
  if (!room) return null;
  const level = levelById(building, room.level);
  const frame = roomFrame(building, room);
  const [ox, , oz] = frame.origin;
  const loc = ([x, z]) => [x - ox, z - oz];
  const edges = roomEdges(building, room);
  const centre = edges.map((e) => e.a);
  const faces = insetEdges(centre, edges.map((e) => e.thickness / 2), windingSign(centre));
  const inner = insetPolygon(centre, edges.map((e) => e.thickness / 2), windingSign(centre)).map(loc);
  const walls = [];
  const openings = [];
  edges.forEach((e, i) => {
    const a = loc(e.a);
    const b = loc(e.b);
    const ia = loc(faces[i].start);
    const ib = loc(faces[i].end);
    const id = e.wall || `open-${i}`;
    const length = Math.hypot(ib[0] - ia[0], ib[1] - ia[1]);
    const w = { id, node: e.wall ? `wall__${e.wall}` : null, a: ia, b: ib, out: e.out, length, thickness: e.thickness, legacy: null, open: !e.wall };
    walls.push(w);
    if (!e.wall) return;
    // offsets are measured on the centreline from the WALL's node a; map them onto this inner face
    const line = e.line;
    const forward = line.a === room.outline[i];
    const shift = projectAlong(ia, a, b); // where the inner face starts, measured along the centreline from a
    for (const o of wallOpenings(building, e.wall)) {
      const u0 = forward ? o.u0 : line.length - o.u1;
      const op = { type: o.type, offset: u0 - shift, width: o.u1 - o.u0, height: o.head - o.sill, sill: o.sill, id: o.id };
      openings.push(placeOpening(openings.length, w, op));
    }
  });
  const sign = windingSign(inner);
  const outline = sign > 0 ? inner : [...inner].reverse();
  const c = room.ceiling || {};
  return finish({
    kind: 'building',
    outline,
    box: bbox(outline),
    walls,
    openings,
    height: c.height ?? level?.height ?? 2.6,
    ceilingSpec: c,
    floor: room.floor || {},
    wallsSpec: room.walls || {},
    frame,
    room,
  });
}

const projectAlong = (p, a, b) => {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  return ((p[0] - a[0]) * (b[0] - a[0]) + (p[1] - a[1]) * (b[1] - a[1])) / l;
};

function finish(s) {
  const spec = s.ceilingSpec;
  const shape = spec.shape || 'flat';
  const W = s.box.max[0] - s.box.min[0];
  const D = s.box.max[1] - s.box.min[1];
  const axis = spec.axis || (W >= D ? 'x' : 'z');
  const ceiling = {
    shape,
    show: spec.show ?? true,
    color: spec.color ?? null,
    peak: shape === 'flat' ? s.height : spec.peak,
    axis,
    ridgeAt: spec.ridgeAt ?? (axis === 'x' ? (s.box.min[1] + s.box.max[1]) / 2 : (s.box.min[0] + s.box.max[0]) / 2),
    eaves: spec.eaves || [s.height, s.height],
    apex: spec.apex || centroid(s.outline),
    low: spec.low || null,
  };
  const out = {
    kind: s.kind,
    outline: s.outline,
    box: s.box,
    width: s.box.max[0] - s.box.min[0],
    depth: s.box.max[1] - s.box.min[1],
    height: s.height,
    ceiling,
    walls: s.walls,
    openings: s.openings,
    floor: s.floor,
    wallsSpec: s.wallsSpec,
  };
  if (s.frame) out.frame = s.frame;
  if (s.room) out.room = s.room;
  out.top = shape === 'flat' ? s.height : Math.max(s.height, ceiling.peak, ...ceiling.eaves);
  return out;
}

/** Ceiling height at [x, z] (room frame) for a normalised shell. */
export function ceilingAt(shell, x, z) {
  const c = shell.ceiling;
  const H = shell.height;
  const { min, max } = shell.box;
  switch (c.shape) {
    case 'gable': {
      const across = c.axis === 'x' ? z : x;
      const lo = c.axis === 'x' ? min[1] : min[0];
      const hi = c.axis === 'x' ? max[1] : max[0];
      const r = c.ridgeAt;
      if (across <= r) return r - lo < 1e-9 ? c.peak : c.eaves[0] + (c.peak - c.eaves[0]) * ((across - lo) / (r - lo));
      return hi - r < 1e-9 ? c.peak : c.eaves[1] + (c.peak - c.eaves[1]) * ((hi - across) / (hi - r));
    }
    case 'pyramid': {
      const s = Math.min(1, rayScale(c.apex, [x, z], shell.outline));
      return c.peak - (c.peak - H) * s;
    }
    case 'skillion': {
      const f = {
        north: (z - min[1]) / (max[1] - min[1] || 1),
        south: (max[1] - z) / (max[1] - min[1] || 1),
        west: (x - min[0]) / (max[0] - min[0] || 1),
        east: (max[0] - x) / (max[0] - min[0] || 1),
      }[c.low];
      return H + (c.peak - H) * Math.max(0, Math.min(1, f));
    }
    default:
      return H;
  }
}

/** Height of a wall's top at distance u (metres from its end a). */
export function wallTopAt(shell, wall, u) {
  const t = Math.max(0, Math.min(1, u / (wall.length || 1)));
  return ceilingAt(shell, wall.a[0] + (wall.b[0] - wall.a[0]) * t, wall.a[1] + (wall.b[1] - wall.a[1]) * t);
}

/** Lowest point of a wall's top between u0 and u1 (piecewise linear: ends + the ridge / apex crossings). */
export function wallTopMin(shell, wall, u0, u1) {
  const samples = 24;
  let m = Infinity;
  for (let k = 0; k <= samples; k++) m = Math.min(m, wallTopAt(shell, wall, u0 + ((u1 - u0) * k) / samples));
  return m;
}

/** GLB wall node name -> { id, legacy } (legacy = 'north'… for v1 names), or null. */
export function parseWallNode(name) {
  const m = /^wall__([a-z0-9][a-z0-9-]*)/.exec(name || '');
  if (m) return { id: m[1], legacy: SIDES.includes(m[1]) ? m[1] : null };
  const v1 = /^wall_(north|south|east|west)/.exec(name || '');
  return v1 ? { id: v1[1], legacy: v1[1] } : null;
}

/**
 * A wall node's outward normal [x, z]: its glTF extras (`mrWall.normal`, which the
 * GLTFLoader puts in userData) when there, else the legacy side's normal.
 */
export function wallNormalOf(node) {
  const n = node?.userData?.mrWall?.normal;
  if (Array.isArray(n) && n.length === 2) return n;
  const parsed = parseWallNode(node?.name);
  return parsed?.legacy ? SIDE_OUT[parsed.legacy] : null;
}
