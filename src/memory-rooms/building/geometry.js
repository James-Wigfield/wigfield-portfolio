/* ============================================================================
   building.json geometry: the wall graph, room polygons and frames, exterior
   outlines, stairs, and where the plan sits on Earth. Plain maths (no three.js):
   the viewer, check-building, the Worker and the scripts share it.
   Python mirror: tools/memory-rooms/blender/building_io.py (same names, snake_case).

   Frames (CONTRACTS.md section 6):
     plan / building frame: x east, z south, y up; a level's floor is at y = elevation.
     room frame: the building frame moved so the room's wall-CENTRELINE bounding box
       starts at [0, 0], on its level's floor (y = 0). A room's scene.json v2 uses it.
   ========================================================================== */

import { bbox, edgeOut, insetPolygon, signedArea, windingSign } from '../scene/polygon.js';

export const THICKNESS = { exterior: 0.25, interior: 0.1 };
export const SLAB = 0.25;
export const STEP_RISE = 0.18;

export const levelById = (b, id) => (b.levels || []).find((l) => l.id === id) || null;
export const roomById = (b, id) => (b.rooms || []).find((r) => r.id === id) || null;

export function nodeMap(level) {
  return new Map((level?.nodes || []).map((n) => [n.id, n.at]));
}

export const wallThickness = (w) => w.thickness ?? (w.exterior ? THICKNESS.exterior : THICKNESS.interior);

/** The walls of one level as segments: { id, a, b, pa, pb, length, dir, left, thickness, height, exterior, level }. */
export function wallLines(b, levelId) {
  const level = levelById(b, levelId);
  if (!level) return [];
  const nodes = nodeMap(level);
  const out = [];
  for (const w of level.walls || []) {
    const pa = nodes.get(w.a);
    const pb = nodes.get(w.b);
    if (!pa || !pb) continue;
    const dx = pb[0] - pa[0];
    const dz = pb[1] - pa[1];
    const length = Math.hypot(dx, dz);
    const dir = length ? [dx / length, dz / length] : [1, 0];
    out.push({
      id: w.id,
      a: w.a,
      b: w.b,
      pa,
      pb,
      length,
      dir,
      left: [dir[1], -dir[0]], // looking from a to b, this side is on the left
      thickness: wallThickness(w),
      height: w.height ?? level.height,
      exterior: Boolean(w.exterior),
      level: level.id,
      spec: w,
    });
  }
  return out;
}

/** Every wall of the building by id. */
export function wallIndex(b) {
  const m = new Map();
  for (const l of b.levels || []) for (const w of wallLines(b, l.id)) m.set(w.id, w);
  return m;
}

/** The wall joining two nodes on a level (either direction), or null. */
export function wallBetween(lines, a, c) {
  return lines.find((w) => (w.a === a && w.b === c) || (w.a === c && w.b === a)) || null;
}

/** A room's polygon on its wall centrelines, building frame, in its listed order. */
export function roomPolygon(b, room) {
  const nodes = nodeMap(levelById(b, room.level));
  return room.outline.map((id) => nodes.get(id)).filter(Boolean);
}

/** The room frame: { level, origin: [x, y, z] } in the building frame (centreline bbox min, the level's floor). */
export function roomFrame(b, room) {
  const level = levelById(b, room.level);
  const box = bbox(roomPolygon(b, room));
  return { level: level?.id ?? null, origin: [box.min[0], level?.elevation ?? 0, box.min[1]] };
}

/** Building-frame point -> room frame, and back. */
export const toRoomFrame = ([x, y, z], frame) => [x - frame.origin[0], y - frame.origin[1], z - frame.origin[2]];
export const fromRoomFrame = ([x, y, z], frame) => [x + frame.origin[0], y + frame.origin[1], z + frame.origin[2]];

/**
 * A room's sides: [{ i, a, b (building frame, centreline), wall (id) | null, thickness, out }].
 * `out` is the outward normal from this room. A side with no wall between its nodes is open.
 */
export function roomEdges(b, room) {
  const lines = wallLines(b, room.level);
  const pts = roomPolygon(b, room);
  const sign = windingSign(pts);
  return pts.map((a, i) => {
    const c = pts[(i + 1) % pts.length];
    const w = wallBetween(lines, room.outline[i], room.outline[(i + 1) % room.outline.length]);
    return { i, a, b: c, wall: w?.id ?? null, thickness: w ? w.thickness : 0, out: edgeOut(a, c, sign), line: w };
  });
}

/** The room's floor polygon on the inner faces of its walls (building frame, same order as its outline). */
export function roomInnerPolygon(b, room) {
  const edges = roomEdges(b, room);
  const pts = edges.map((e) => e.a);
  return insetPolygon(pts, edges.map((e) => e.thickness / 2), windingSign(pts));
}

/**
 * Where each opening on a wall sits along the wall's two faces. Returns
 * [{ id, type, wall, sill, head, u0, u1 (metres from node a along the centreline), spec }].
 */
export function wallOpenings(b, wallId) {
  return (b.openings || [])
    .filter((o) => o.wall === wallId)
    .map((o) => {
      const sill = o.sill ?? (o.type === 'window' ? 0.9 : 0);
      return { id: o.id, type: o.type, wall: wallId, sill, head: sill + o.height, u0: o.offset, u1: o.offset + o.width, spec: o };
    });
}

/**
 * The exterior walls of a level joined into closed loops (building frame, positive winding,
 * largest first). Walls whose ends don't close into a loop are left out (validate reports them).
 */
export function exteriorLoops(b, levelId) {
  const lines = wallLines(b, levelId).filter((w) => w.exterior);
  const nodes = nodeMap(levelById(b, levelId));
  const adj = new Map();
  for (const w of lines) {
    for (const [p, q] of [[w.a, w.b], [w.b, w.a]]) {
      if (!adj.has(p)) adj.set(p, []);
      adj.get(p).push({ to: q, wall: w.id });
    }
  }
  const used = new Set();
  const loops = [];
  for (const w of lines) {
    if (used.has(w.id)) continue;
    const ids = [w.a];
    used.add(w.id);
    let cur = w.b;
    let ok = true;
    while (cur !== w.a) {
      ids.push(cur);
      const next = (adj.get(cur) || []).find((e) => !used.has(e.wall));
      if (!next || ids.length > lines.length + 1) {
        ok = false;
        break;
      }
      used.add(next.wall);
      cur = next.to;
    }
    if (!ok || ids.length < 3) continue;
    let pts = ids.map((id) => nodes.get(id));
    if (signedArea(pts) < 0) pts = pts.reverse();
    loops.push(pts);
  }
  return loops.sort((p, q) => signedArea(q) - signedArea(p));
}

/** The level a roof sits on: `roof.level`, else the top one. */
export function roofLevel(b) {
  if (b.roof?.level) return levelById(b, b.roof.level);
  return [...(b.levels || [])].sort((p, q) => q.elevation - p.elevation)[0] || null;
}

const DIRS = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] };

/** A straight flight's 4 corners (bottom-left, bottom-right, top-right, top-left looking up the stair). */
export function stairFootprint(s) {
  const d = DIRS[s.dir];
  const r = [-d[1], d[0]]; // to the climber's right
  const h = s.width / 2;
  const [x, z] = s.start;
  const top = [x + d[0] * s.length, z + d[1] * s.length];
  return [
    [x - r[0] * h, z - r[1] * h],
    [x + r[0] * h, z + r[1] * h],
    [top[0] + r[0] * h, top[1] + r[1] * h],
    [top[0] - r[0] * h, top[1] - r[1] * h],
  ];
}

/** Rise and step count of a flight. */
export function stairSteps(b, s) {
  const rise = (levelById(b, s.to)?.elevation ?? 0) - (levelById(b, s.from)?.elevation ?? 0);
  return { rise, steps: s.steps ?? Math.max(2, Math.round(rise / STEP_RISE)) };
}

/** Bounds of everything drawn: walls (with their thickness), the lot, plan frame. */
export function buildingBounds(b) {
  const pts = [];
  for (const l of b.levels || []) for (const n of l.nodes || []) pts.push(n.at);
  for (const p of b.site?.lot || []) pts.push(p);
  if (!pts.length) return { min: [0, 0], max: [1, 1] };
  const box = bbox(pts);
  const pad = THICKNESS.exterior;
  return { min: [box.min[0] - pad, box.min[1] - pad], max: [box.max[0] + pad, box.max[1] + pad] };
}

/** Top of the building (the highest level's floor + its height), for framing views. */
export function buildingTop(b) {
  return Math.max(0, ...(b.levels || []).map((l) => l.elevation + l.height));
}

// ── on Earth ─────────────────────────────────────────────────────────────────
const M_PER_DEG_LAT = 111_320;

/**
 * Plan [x, z] -> [lng, lat] using geo (origin + bearing of plan north).
 * Plan north (-z) points at compass bearing `north`; plan east (+x) at `north + 90`.
 */
export function planToLngLat(geo, [x, z]) {
  const t = ((geo.north || 0) * Math.PI) / 180;
  // metres east (e) and north (n) of the origin
  const e = x * Math.cos(t) - z * Math.sin(t);
  const n = -x * Math.sin(t) - z * Math.cos(t);
  const lat = geo.lat + n / M_PER_DEG_LAT;
  const lng = geo.lng + e / (M_PER_DEG_LAT * Math.cos((geo.lat * Math.PI) / 180));
  return [lng, lat];
}
