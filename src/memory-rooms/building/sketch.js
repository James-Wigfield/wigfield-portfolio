/* ============================================================================
   The phone's sketch plan (building/sketch.schema.json): validate it, and turn
   its rectangles into a first building.json (a clean wall graph: shared walls
   once, split at every junction; exterior = walls with a room on one side only).
   The render side starts from that draft and refines it from the photos or a
   real floor plan; room ids carry over so captured spots stay in their rooms.
   ========================================================================== */

import schema from './sketch.schema.json' with { type: 'json' };
import { validateAgainst } from '../scene/validate.js';

export const SKETCH_SCHEMA = schema;
export const DEFAULT_GRID = 0.5;
export const LEVEL_HEIGHT = 2.6;
export const LEVEL_RISE = 3.0;

/** Schema + cross-references: unique ids, rooms on real levels, drawn rooms not overlapping. */
export function validateSketch(sketch) {
  const errors = validateAgainst(schema, sketch);
  if (errors.length || !sketch || typeof sketch !== 'object') return { ok: errors.length === 0, errors };
  const uniq = (list, path, label) => {
    const seen = new Map();
    list.forEach((x, i) => {
      if (seen.has(x.id)) errors.push({ path: `${path}/${i}/id`, message: `duplicate ${label} id "${x.id}"` });
      else seen.set(x.id, i);
    });
    return seen;
  };
  const levels = uniq(sketch.levels, '/levels', 'level');
  uniq(sketch.rooms, '/rooms', 'room');
  sketch.rooms.forEach((r, i) => {
    if (!levels.has(r.level)) errors.push({ path: `/rooms/${i}/level`, message: `no level "${r.level}"` });
  });
  for (let i = 0; i < sketch.rooms.length; i++) {
    for (let j = i + 1; j < sketch.rooms.length; j++) {
      const a = sketch.rooms[i];
      const b = sketch.rooms[j];
      if (a.level !== b.level || !a.rect || !b.rect) continue;
      const ox = Math.min(a.rect[0] + a.rect[2], b.rect[0] + b.rect[2]) - Math.max(a.rect[0], b.rect[0]);
      const oz = Math.min(a.rect[1] + a.rect[3], b.rect[1] + b.rect[3]) - Math.max(a.rect[1], b.rect[1]);
      if (ox > 0.02 && oz > 0.02) errors.push({ path: `/rooms/${j}/rect`, message: `overlaps "${a.name}"` });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** A new room id from a name: "Bed 2" -> "bed-2" (made unique against `taken`). */
export function roomIdFor(name, taken = []) {
  const base = String(name || 'room').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28) || 'room';
  const used = new Set(taken);
  if (!used.has(base) && /^[a-z0-9]/.test(base)) return base;
  for (let n = 2; ; n++) {
    const id = `${/^[a-z0-9]/.test(base) ? base : `r-${base}`}-${n}`.slice(0, 32);
    if (!used.has(id)) return id;
  }
}

const key = (x, z) => `${Math.round(x * 1000)},${Math.round(z * 1000)}`;

/**
 * Rectangles of one level -> { nodes, walls, rooms } (ids prefixed with `prefix`).
 * Every rect edge is cut at every corner of every other rect that lies on it, equal
 * pieces merge, and each piece is exterior when only one of its sides is in a room.
 */
export function rectsToGraph(rects, prefix = 'l0') {
  const EPS = 1e-6;
  const xs = (r) => [r.rect[0], r.rect[0] + r.rect[2]];
  const zs = (r) => [r.rect[1], r.rect[1] + r.rect[3]];
  const corners = [];
  for (const r of rects) for (const x of xs(r)) for (const z of zs(r)) corners.push([x, z]);
  // pieces along each rect edge, cut at every corner lying on it
  const pieces = new Map();
  const addEdge = (a, b) => {
    const horizontal = Math.abs(a[1] - b[1]) < EPS;
    const lo = horizontal ? Math.min(a[0], b[0]) : Math.min(a[1], b[1]);
    const hi = horizontal ? Math.max(a[0], b[0]) : Math.max(a[1], b[1]);
    const c = horizontal ? a[1] : a[0];
    const cuts = new Set([lo, hi]);
    for (const [x, z] of corners) {
      const along = horizontal ? x : z;
      const across = horizontal ? z : x;
      if (Math.abs(across - c) < EPS && along > lo + EPS && along < hi - EPS) cuts.add(along);
    }
    const sorted = [...cuts].sort((p, q) => p - q);
    for (let i = 0; i < sorted.length - 1; i++) {
      const p = horizontal ? [sorted[i], c] : [c, sorted[i]];
      const q = horizontal ? [sorted[i + 1], c] : [c, sorted[i + 1]];
      const k = [key(...p), key(...q)].sort().join('|');
      pieces.set(k, [p, q]);
    }
  };
  for (const r of rects) {
    const [x0, x1] = xs(r);
    const [z0, z1] = zs(r);
    addEdge([x0, z0], [x1, z0]);
    addEdge([x1, z0], [x1, z1]);
    addEdge([x0, z1], [x1, z1]);
    addEdge([x0, z0], [x0, z1]);
  }
  // nodes
  const nodes = new Map();
  const nodeFor = (p) => {
    const k = key(...p);
    if (!nodes.has(k)) nodes.set(k, { id: `${prefix}-n${nodes.size + 1}`, at: [round(p[0]), round(p[1])] });
    return nodes.get(k).id;
  };
  const inRect = (p) => rects.some((r) => p[0] > r.rect[0] + EPS && p[0] < r.rect[0] + r.rect[2] - EPS && p[1] > r.rect[1] + EPS && p[1] < r.rect[1] + r.rect[3] - EPS);
  const walls = [];
  for (const [p, q] of pieces.values()) {
    const mid = [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
    const horizontal = Math.abs(p[1] - q[1]) < EPS;
    const side1 = inRect(horizontal ? [mid[0], mid[1] - 0.01] : [mid[0] - 0.01, mid[1]]);
    const side2 = inRect(horizontal ? [mid[0], mid[1] + 0.01] : [mid[0] + 0.01, mid[1]]);
    const wall = { id: `${prefix}-w${walls.length + 1}`, a: nodeFor(p), b: nodeFor(q) };
    if (side1 !== side2) wall.exterior = true;
    walls.push(wall);
  }
  // each room: its corners + every node on its boundary, clockwise on a north-up map
  const all = [...nodes.values()];
  const rooms = rects.map((r) => {
    const [x0, x1] = xs(r);
    const [z0, z1] = zs(r);
    const on = (pred, sortKey, dir) =>
      all
        .filter((n) => pred(n.at))
        .sort((a, b) => dir * (sortKey(a.at) - sortKey(b.at)))
        .map((n) => n.id);
    const near = (a, b) => Math.abs(a - b) < 1e-3;
    const north = on(([x, z]) => near(z, z0) && x >= x0 - 1e-3 && x < x1 - 1e-3, ([x]) => x, 1);
    const east = on(([x, z]) => near(x, x1) && z >= z0 - 1e-3 && z < z1 - 1e-3, ([, z]) => z, 1);
    const south = on(([x, z]) => near(z, z1) && x <= x1 + 1e-3 && x > x0 + 1e-3, ([x]) => x, -1);
    const west = on(([x, z]) => near(x, x0) && z <= z1 + 1e-3 && z > z0 + 1e-3, ([, z]) => z, -1);
    return { id: r.id, outline: [...north, ...east, ...south, ...west] };
  });
  return { nodes: all, walls, rooms };
}

const round = (v) => Math.round(v * 1000) / 1000;

/**
 * A first building.json from a sketch (only drawn rooms; marks-only rooms are listed in notes).
 * `title` names it; `geo` (optional) places it. The result validates with validateBuilding.
 */
export function sketchToBuilding(sketch, { title = 'Sketched place', geo = null } = {}) {
  const levels = sketch.levels.map((l, i) => {
    const drawn = sketch.rooms.filter((r) => r.level === l.id && r.rect);
    const g = rectsToGraph(drawn, `l${i}`);
    return { level: { id: l.id, name: l.name, elevation: i * LEVEL_RISE, height: LEVEL_HEIGHT, nodes: g.nodes, walls: g.walls }, rooms: g.rooms };
  });
  const names = new Map(sketch.rooms.map((r) => [r.id, r]));
  const rooms = levels.flatMap(({ level, rooms: rs }) => rs.map((r) => ({ id: r.id, name: names.get(r.id).name, level: level.id, outline: r.outline })));
  const undrawn = sketch.rooms.filter((r) => !r.rect).map((r) => r.name);
  const b = {
    version: 1,
    title,
    source: 'sketch',
    levels: levels.map((l) => l.level),
    rooms,
  };
  if (undrawn.length) b.notes = `Rooms on the checklist but not drawn: ${undrawn.join(', ')}.`;
  if (geo) b.geo = { lat: geo.lat, lng: geo.lng, north: sketch.north ?? 0 };
  return b;
}
