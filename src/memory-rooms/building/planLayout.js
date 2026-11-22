/* Every level of a building in ONE top-down plan (CONTRACTS.md 6.5): the standard for a multi-level place.

     const lay = levelPlanLayout(building, aspect)   // aspect = view width / height
     lay.direction         'row' (left → right, wide views) | 'column' (top → bottom, portrait views)
     lay.levels[i]         { id, name, index, offset: [dx, dz], cell: { min, max }, box: { min, max } }   lowest first
     lay.bounds            { min: [x, z], max: [x, z] }   everything, in layout space
     levelAtLayoutPoint(lay, [x, z]) → { id, plan: [x, z] } | null   a layout point back to its level's plan point

   Pure: plan metres, x east, z south (north up on screen = −z). Every level keeps the SAME scale and north, and is
   moved by `offset` only: cells are the union of every level's footprint (so a level with a smaller footprint sits
   where it sits on the plan, registered with the levels beside it, aligned on the shared plan origin), one cell per
   level at a fixed pitch (the union's extent along the layout axis + `gap`). Lowest level first: on the left in a
   row, on top in a column. */

import { stairFootprint, wallLines } from './geometry.js';

export const PLAN_GAP = 1.8; // metres between two levels' cells (room for the level's name above it)
const PAD = 0.15; // metres round a level's walls

/** A level's plan footprint: its wall centrelines grown by half their thickness (+ a hair) and its stair flights, or its nodes. */
export function levelFootprint(b, levelId) {
  const min = [Infinity, Infinity];
  const max = [-Infinity, -Infinity];
  const grow = (p, h) => {
    min[0] = Math.min(min[0], p[0] - h);
    min[1] = Math.min(min[1], p[1] - h);
    max[0] = Math.max(max[0], p[0] + h);
    max[1] = Math.max(max[1], p[1] + h);
  };
  for (const w of wallLines(b, levelId)) {
    grow(w.pa, w.thickness / 2 + PAD);
    grow(w.pb, w.thickness / 2 + PAD);
  }
  // a flight from this level counts too (an external stair stands outside the walls)
  for (const s of b.stairs || []) if (s.from === levelId) for (const p of stairFootprint(s)) grow(p, PAD);
  if (!Number.isFinite(min[0])) {
    const level = b.levels.find((l) => l.id === levelId);
    for (const n of level?.nodes || []) grow(n.at, PAD);
  }
  return Number.isFinite(min[0]) ? { min, max } : null;
}

export function levelPlanLayout(b, aspect = 1, { gap = PLAN_GAP, ids = null } = {}) {
  const levels = [...(b.levels || [])]
    .filter((l) => !ids || ids.includes(l.id))
    .sort((p, q) => p.elevation - q.elevation)
    .map((l) => ({ level: l, box: levelFootprint(b, l.id) }))
    .filter((x) => x.box);
  const U = { min: [Infinity, Infinity], max: [-Infinity, -Infinity] };
  for (const { box } of levels) {
    for (const k of [0, 1]) {
      U.min[k] = Math.min(U.min[k], box.min[k]);
      U.max[k] = Math.max(U.max[k], box.max[k]);
    }
  }
  const direction = aspect >= 1 ? 'row' : 'column';
  const axis = direction === 'row' ? 0 : 1;
  const pitch = levels.length ? U.max[axis] - U.min[axis] + gap : 0;
  const shift = (p, o) => [p[0] + o[0], p[1] + o[1]];
  const out = levels.map(({ level, box }, i) => {
    const offset = axis === 0 ? [i * pitch, 0] : [0, i * pitch];
    return {
      id: level.id,
      name: level.name || level.id,
      index: i,
      elevation: level.elevation,
      offset,
      cell: { min: shift(U.min, offset), max: shift(U.max, offset) },
      box: { min: shift(box.min, offset), max: shift(box.max, offset) },
    };
  });
  const last = out[out.length - 1];
  const bounds = out.length ? { min: [...U.min], max: [...last.cell.max] } : null;
  return { direction, gap, pitch, levels: out, bounds };
}

/** A point in layout space → the level whose cell holds it and the plan point under it, or null (a gap). */
export function levelAtLayoutPoint(lay, [x, z]) {
  for (const l of lay.levels) {
    if (x >= l.cell.min[0] && x <= l.cell.max[0] && z >= l.cell.min[1] && z <= l.cell.max[1]) return { id: l.id, plan: [x - l.offset[0], z - l.offset[1]] };
  }
  return null;
}
