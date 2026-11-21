/* ============================================================================
   building.json v1 validator: the schema (with the scene validator's keyword
   subset, so it runs in the Worker too) plus the rules a schema can't say:
   ids that refer to real things, a clean wall graph (every wall once, split at
   junctions, nothing crossing), simple non-overlapping rooms, openings that fit
   their wall, stairs that go up, exterior walls that close into a loop.
   Python mirror: tools/memory-rooms/blender/building_io.py (same checks, same paths).

     import { validateBuilding } from './validate.js';
     const { ok, errors } = validateBuilding(building);   // errors: [{ path, message }]
   ========================================================================== */

import schema from './building.schema.json' with { type: 'json' };
import { validateAgainst } from '../scene/validate.js';
import { area, bbox, collinearOverlap, isSimple, pointInPolygon, properCrossing, segDist, signedArea } from '../scene/polygon.js';
import { SLAB, levelById, nodeClearance, nodeMap, roomPolygon, wallLines } from './geometry.js';

export const BUILDING_SCHEMA = schema;
export const BUILDING_VERSION = 1;

const TOL = 0.01; // 1 cm: a node this close to a wall's line sits on it
const fmt = (p) => `[${p.map((v) => +v.toFixed(3)).join(', ')}]`;

export function validateBuilding(building) {
  const errors = validateAgainst(schema, building);
  if (errors.length || !building || typeof building !== 'object') return { ok: errors.length === 0, errors };
  const err = (path, message) => errors.push({ path, message });

  // ── ids ────────────────────────────────────────────────────────────────
  const uniq = (list, path, label) => {
    const seen = new Map();
    (list || []).forEach((x, i) => {
      if (seen.has(x.id)) err(`${path}/${i}/id`, `duplicate ${label} id "${x.id}" (also ${path}/${seen.get(x.id)})`);
      else seen.set(x.id, i);
    });
    return seen;
  };
  uniq(building.levels, '/levels', 'level');
  uniq(building.rooms, '/rooms', 'room');
  uniq(building.openings, '/openings', 'opening');
  uniq(building.stairs, '/stairs', 'stair');
  uniq(building.site?.areas, '/site/areas', 'area');
  uniq(building.site?.fences, '/site/fences', 'fence');
  uniq(building.site?.trees, '/site/trees', 'tree');
  const wallAt = new Map(); // wall id -> path, building-wide
  building.levels.forEach((level, li) => {
    uniq(level.nodes, `/levels/${li}/nodes`, 'node');
    level.walls.forEach((w, wi) => {
      if (wallAt.has(w.id)) err(`/levels/${li}/walls/${wi}/id`, `duplicate wall id "${w.id}" (also ${wallAt.get(w.id)}); wall ids are unique across the building`);
      else wallAt.set(w.id, `/levels/${li}/walls/${wi}`);
    });
  });

  // ── the wall graph, per level ──────────────────────────────────────────
  building.levels.forEach((level, li) => {
    const nodes = nodeMap(level);
    const at = `/levels/${li}`;
    level.walls.forEach((w, wi) => {
      if (!nodes.has(w.a)) err(`${at}/walls/${wi}/a`, `no node "${w.a}" on level "${level.id}"`);
      if (!nodes.has(w.b)) err(`${at}/walls/${wi}/b`, `no node "${w.b}" on level "${level.id}"`);
      if (w.a === w.b) err(`${at}/walls/${wi}`, 'a wall needs two different nodes');
    });
    const lines = wallLines(building, level.id);
    const pathOf = new Map(level.walls.map((w, wi) => [w.id, `${at}/walls/${wi}`]));
    for (const w of lines) if (w.length < 0.05) err(pathOf.get(w.id), `is only ${(w.length * 100).toFixed(1)} cm long`);
    for (let i = 0; i < lines.length; i++) {
      for (let j = i + 1; j < lines.length; j++) {
        const p = lines[i];
        const q = lines[j];
        const samePair = (p.a === q.a && p.b === q.b) || (p.a === q.b && p.b === q.a);
        if (samePair) {
          err(pathOf.get(q.id), `walls "${p.id}" and "${q.id}" join the same two nodes: a shared wall exists once`);
          continue;
        }
        const overlap = collinearOverlap(p.pa, p.pb, q.pa, q.pb, TOL);
        if (overlap > TOL) err(pathOf.get(q.id), `walls "${p.id}" and "${q.id}" overlap along ${overlap.toFixed(2)} m: a shared wall exists once`);
        const x = properCrossing(p.pa, p.pb, q.pa, q.pb);
        if (x) err(pathOf.get(q.id), `walls "${p.id}" and "${q.id}" cross at ${fmt(x)} without a node: split both there`);
      }
    }
    // a node on the middle of a wall it doesn't end: the wall must be split there
    for (const n of level.nodes) {
      for (const w of lines) {
        if (w.a === n.id || w.b === n.id) continue;
        const { d, t } = segDist(n.at, w.pa, w.pb);
        if (d <= TOL && t > 1e-6 && t < 1 - 1e-6) err(pathOf.get(w.id), `node "${n.id}" sits on wall "${w.id}": split the wall at it`);
      }
    }
    // exterior walls close into loops: every node they touch has exactly two of them
    const degree = new Map();
    for (const w of lines) {
      if (!w.exterior) continue;
      degree.set(w.a, (degree.get(w.a) || 0) + 1);
      degree.set(w.b, (degree.get(w.b) || 0) + 1);
    }
    for (const [id, deg] of degree) {
      if (deg !== 2) err(`${at}/walls`, `the exterior walls must close into loops, but node "${id}" has ${deg} exterior wall${deg === 1 ? '' : 's'}`);
    }
  });

  // ── rooms ──────────────────────────────────────────────────────────────
  const polys = [];
  const spotRoom = new Map();
  building.rooms.forEach((room, ri) => {
    const at = `/rooms/${ri}`;
    const level = levelById(building, room.level);
    if (!level) {
      err(`${at}/level`, `no level "${room.level}"`);
      return;
    }
    const nodes = nodeMap(level);
    let bad = false;
    room.outline.forEach((id, k) => {
      if (!nodes.has(id)) {
        err(`${at}/outline/${k}`, `no node "${id}" on level "${level.id}"`);
        bad = true;
      }
    });
    if (new Set(room.outline).size !== room.outline.length) {
      err(`${at}/outline`, 'lists a node twice');
      bad = true;
    }
    (room.spotIds || []).forEach((sid, k) => {
      if (spotRoom.has(sid)) err(`${at}/spotIds/${k}`, `spot ${sid} is already in room "${spotRoom.get(sid)}"`);
      else spotRoom.set(sid, room.id);
    });
    if (bad) return;
    const pts = roomPolygon(building, room);
    if (!isSimple(pts, 0.05)) {
      err(`${at}/outline`, 'must be a simple polygon (no crossing or touching sides, no spikes, every side at least 5 cm)');
      return;
    }
    if (area(pts) < 0.5) err(`${at}/outline`, `encloses only ${area(pts).toFixed(2)} m² (at least 0.5)`);
    // a side with no wall must not secretly run past a node or along a wall (the outline skipped a junction)
    const lines = wallLines(building, level.id);
    room.outline.forEach((idA, k) => {
      const idB = room.outline[(k + 1) % room.outline.length];
      if (lines.some((w) => (w.a === idA && w.b === idB) || (w.a === idB && w.b === idA))) return;
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      const skipped = level.nodes.find((n) => n.id !== idA && n.id !== idB && (({ d, t }) => d <= TOL && t > 1e-6 && t < 1 - 1e-6)(segDist(n.at, a, b)));
      if (skipped) err(`${at}/outline/${k}`, `the side from "${idA}" to "${idB}" passes node "${skipped.id}": list it in the outline`);
      else {
        const along = lines.find((w) => collinearOverlap(a, b, w.pa, w.pb, TOL) > TOL);
        if (along) err(`${at}/outline/${k}`, `the side from "${idA}" to "${idB}" runs along wall "${along.id}" without using its nodes`);
      }
    });
    const c = room.ceiling || {};
    const h = c.height ?? level.height;
    if (c.shape && c.shape !== 'flat' && !(c.peak > Math.max(h, ...(c.eaves || [h])))) err(`${at}/ceiling/peak`, `must be above the eaves (${Math.max(h, ...(c.eaves || [h]))} m), got ${c.peak}`);
    if (c.shape === 'gable' || c.shape === 'pyramid') {
      // in the room frame: the centreline bounding box starts at [0, 0]
      const box = bbox(pts);
      const local = pts.map(([x, z]) => [x - box.min[0], z - box.min[1]]);
      const w = box.max[0] - box.min[0];
      const d = box.max[1] - box.min[1];
      if (c.shape === 'gable' && c.ridgeAt !== undefined) {
        const axis = c.axis || (w >= d ? 'x' : 'z');
        const hi = axis === 'x' ? d : w;
        if (!(c.ridgeAt > 0 && c.ridgeAt < hi)) err(`${at}/ceiling/ridgeAt`, `must lie inside the room across the ridge (0–${+hi.toFixed(3)} in the room frame), got ${c.ridgeAt}`);
      }
      if (c.shape === 'pyramid' && c.apex && !pointInPolygon(c.apex, local)) err(`${at}/ceiling/apex`, `[${c.apex}] is outside the room (room frame)`);
    }
    polys.push({ room, ri, pts });
  });
  // two rooms on one level must not overlap (a corner well inside the other, or sides crossing)
  for (let i = 0; i < polys.length; i++) {
    for (let j = i + 1; j < polys.length; j++) {
      const A = polys[i];
      const B = polys[j];
      if (A.room.level !== B.room.level) continue;
      if (roomsOverlap(A.pts, B.pts)) err(`/rooms/${B.ri}/outline`, `overlaps room "${A.room.id}"`);
    }
  }

  // ── openings ───────────────────────────────────────────────────────────
  const allWalls = new Map();
  for (const l of building.levels) for (const w of wallLines(building, l.id)) allWalls.set(w.id, w);
  const byWall = new Map();
  (building.openings || []).forEach((o, oi) => {
    const at = `/openings/${oi}`;
    const w = allWalls.get(o.wall);
    if (!w) {
      err(`${at}/wall`, `no wall "${o.wall}"`);
      return;
    }
    const sill = o.sill ?? (o.type === 'window' ? 0.9 : 0);
    if (o.offset + o.width > w.length + 0.001) err(at, `runs ${(o.offset + o.width - w.length).toFixed(2)} m past the end of wall "${w.id}" (${w.length.toFixed(2)} m)`);
    else {
      // clear of the walls it meets at each end (the faces stop there; a door can't start inside a wall)
      const lines = wallLines(building, w.level);
      const ca = nodeClearance(lines, w.a, w.id);
      const cb = nodeClearance(lines, w.b, w.id);
      if (o.offset < ca - 0.001) err(at, `starts inside the wall at node "${w.a}": offset must be at least ${+ca.toFixed(3)}`);
      else if (o.offset + o.width > w.length - cb + 0.001) err(at, `ends inside the wall at node "${w.b}": offset + width must be at most ${+(w.length - cb).toFixed(3)}`);
    }
    if (sill + o.height > w.height + 0.001) err(at, `its top (${(sill + o.height).toFixed(2)} m) is above wall "${w.id}" (${w.height} m)`);
    if (!byWall.has(o.wall)) byWall.set(o.wall, []);
    byWall.get(o.wall).push({ oi, a: o.offset, b: o.offset + o.width, s: sill, h: sill + o.height });
  });
  for (const list of byWall.values()) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const p = list[i];
        const q = list[j];
        if (Math.min(p.b, q.b) - Math.max(p.a, q.a) > 0.001 && Math.min(p.h, q.h) - Math.max(p.s, q.s) > 0.001) {
          err(`/openings/${q.oi}`, `overlaps opening ${p.oi} (${building.openings[p.oi].id}) on wall "${building.openings[q.oi].wall}"`);
        }
      }
    }
  }

  // ── levels stack: a floor's structure may not cut into the rooms below ──
  const stack = building.levels.map((l, li) => ({ l, li })).sort((p, q) => p.l.elevation - q.l.elevation);
  for (let k = 1; k < stack.length; k++) {
    const below = stack[k - 1].l;
    const { l, li } = stack[k];
    const underside = l.elevation - (l.slab ?? SLAB);
    if (underside < below.elevation + below.height - 0.001) {
      err(`/levels/${li}/elevation`, `its floor (${l.elevation} m, ${l.slab ?? SLAB} m thick) cuts into "${below.id}" below (its ceiling at ${+(below.elevation + below.height).toFixed(3)} m)`);
    }
  }

  // ── stairs, roof ───────────────────────────────────────────────────────
  (building.stairs || []).forEach((s, si) => {
    const from = levelById(building, s.from);
    const to = levelById(building, s.to);
    if (!from) err(`/stairs/${si}/from`, `no level "${s.from}"`);
    if (!to) err(`/stairs/${si}/to`, `no level "${s.to}"`);
    if (from && to && !(to.elevation > from.elevation)) err(`/stairs/${si}/to`, `must be above "${s.from}" (${to.elevation} m vs ${from.elevation} m)`);
  });
  if (building.roof?.level && !levelById(building, building.roof.level)) err('/roof/level', `no level "${building.roof.level}"`);
  (building.roof?.parts || []).forEach((p, pi) => {
    if (!isSimple(p.outline, 0.05)) err(`/roof/parts/${pi}/outline`, 'must be a simple polygon');
    if (p.level && !levelById(building, p.level)) err(`/roof/parts/${pi}/level`, `no level "${p.level}"`);
  });
  if (building.site) {
    if (!isSimple(building.site.lot, 0.05)) err('/site/lot', 'must be a simple polygon');
    (building.site.areas || []).forEach((a, ai) => isSimple(a.outline, 0.02) || err(`/site/areas/${ai}/outline`, 'must be a simple polygon'));
  }
  return { ok: errors.length === 0, errors };
}

/** Do two simple polygons share area (beyond touching along a side or at a corner)? */
export function roomsOverlap(P, Q) {
  for (let i = 0; i < P.length; i++) {
    for (let j = 0; j < Q.length; j++) {
      if (properCrossing(P[i], P[(i + 1) % P.length], Q[j], Q[(j + 1) % Q.length])) return true;
    }
  }
  const inside = (p, poly) => pointInPolygon(p, poly) && minDist(p, poly) > TOL;
  if (P.some((p) => inside(p, Q)) || Q.some((q) => inside(q, P))) return true;
  if (inside(interiorPoint(P), Q) || inside(interiorPoint(Q), P)) return true;
  // every corner on the other's sides (a strip overlap, a room listed twice): cut each side at the
  // other's corners and look just inside the middle of every piece
  return nudgedPieces(P, Q).some((p) => inside(p, Q)) || nudgedPieces(Q, P).some((p) => inside(p, P));
}

/** Points 5 cm inside `poly`, one per piece of its sides cut at `other`'s corners that lie on them. */
function nudgedPieces(poly, other) {
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  const out = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const ts = [0, 1];
    for (const q of other) {
      const { d, t } = segDist(q, a, b);
      if (d <= TOL && t > 1e-6 && t < 1 - 1e-6) ts.push(t);
    }
    ts.sort((x, y) => x - y);
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const inward = [(-sign * (b[1] - a[1])) / l, (sign * (b[0] - a[0])) / l];
    for (let k = 0; k < ts.length - 1; k++) {
      const t = (ts[k] + ts[k + 1]) / 2;
      out.push([a[0] + (b[0] - a[0]) * t + inward[0] * 0.05, a[1] + (b[1] - a[1]) * t + inward[1] * 0.05]);
    }
  }
  return out;
}

function minDist(p, poly) {
  let best = Infinity;
  for (let i = 0; i < poly.length; i++) best = Math.min(best, segDist(p, poly[i], poly[(i + 1) % poly.length]).d);
  return best;
}

/** A point well inside a simple polygon (the centroid when it's inside, else a nudged edge midpoint). */
export function interiorPoint(poly) {
  let cx = 0;
  let cz = 0;
  for (const [x, z] of poly) {
    cx += x;
    cz += z;
  }
  const c = [cx / poly.length, cz / poly.length];
  if (pointInPolygon(c, poly) && minDist(c, poly) > 0.05) return c;
  const sign = signedArea(poly) >= 0 ? 1 : -1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const l = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const inward = [(-sign * (b[1] - a[1])) / l, (sign * (b[0] - a[0])) / l];
    const p = [(a[0] + b[0]) / 2 + inward[0] * 0.05, (a[1] + b[1]) / 2 + inward[1] * 0.05];
    if (pointInPolygon(p, poly)) return p;
  }
  return c;
}

export const formatErrors = (errors) => errors.map((e) => `${e.path || '/'} ${e.message}`).join('\n');
