/* The building page's stages, on a RoomViewer that loaded a place as a group:
   rooms `level-<levelId>` (one per level GLB, plan frame, absolute height) and `exterior` (roof + site).

     const stage = new BuildingStage(viewer, building);   // building = building.json (the row's `plan`)
     stage.set('outside')            // the whole house, roof on
     stage.set('inside')             // the roof lifted off, the top level's ceilings cut away (dollhouse)
     stage.set('plan', { level })    // one level, clipped at 1.2 m, its walls in section, top-down
     stage.set('levels')             // every level pulled apart, each cut away, the roof floating above
     stage.roomAt(level, [x, z])     // the room (building.json) under a plan point, or null
     stage.dispose()

   Walls in a level GLB carry `mrWall = { normal (left), exterior, rooms: { left, right } }`: the dollhouse hides
   an exterior wall when its OUTSIDE faces the camera, and never hides a partition (viewer/dollhouse.js).
   CONTRACTS.md 6.4. */

import { roomPolygon, wallLines, wallOpenings } from '../building/geometry.js';
import { pointInPolygon } from '../scene/polygon.js';
import { CUT_Y } from './planCut.js';

export const STAGES = ['outside', 'inside', 'plan', 'levels'];
const LEVEL_GAP = 3.2; // metres between pulled-apart levels
const ROOF_LIFT = 2.4;

/**
 * A level's walls at its cut height as triangles (plan frame, absolute y): each wall's band (centreline ±
 * half its thickness), with a gap wherever an opening crosses the cut, and a square at each node so corners
 * close. Overlaps are the same ink, so no mitring is needed here.
 */
export function levelSectionCap(b, levelId, y) {
  const level = b.levels.find((l) => l.id === levelId);
  const lines = wallLines(b, levelId);
  const pos = [];
  const quad = (p0, p1, p2, p3) => pos.push(p0[0], y, p0[1], p1[0], y, p1[1], p2[0], y, p2[1], p0[0], y, p0[1], p2[0], y, p2[1], p3[0], y, p3[1]);
  const cut = y - (level?.elevation || 0);
  for (const w of lines) {
    const h = w.thickness / 2;
    const holes = wallOpenings(b, w.id)
      .filter((o) => o.sill <= cut && o.head >= cut)
      .map((o) => [Math.max(0, o.u0), Math.min(w.length, o.u1)])
      .sort((p, q) => p[0] - q[0]);
    let u = 0;
    const solid = [];
    for (const [a, c] of holes) {
      if (a > u + 1e-4) solid.push([u, a]);
      u = Math.max(u, c);
    }
    if (u < w.length - 1e-4) solid.push([u, w.length]);
    for (const [u0, u1] of solid) {
      const a = [w.pa[0] + w.dir[0] * u0, w.pa[1] + w.dir[1] * u0];
      const c = [w.pa[0] + w.dir[0] * u1, w.pa[1] + w.dir[1] * u1];
      quad([a[0] + w.left[0] * h, a[1] + w.left[1] * h], [c[0] + w.left[0] * h, c[1] + w.left[1] * h], [c[0] - w.left[0] * h, c[1] - w.left[1] * h], [a[0] - w.left[0] * h, a[1] - w.left[1] * h]);
    }
  }
  // close the corners: a square of the thickest wall's size at every node
  const half = new Map();
  for (const w of lines) {
    for (const [id, p] of [[w.a, w.pa], [w.b, w.pb]]) half.set(id, { p, h: Math.max(half.get(id)?.h || 0, w.thickness / 2) });
  }
  for (const { p, h } of half.values()) quad([p[0] - h, p[1] - h], [p[0] + h, p[1] - h], [p[0] + h, p[1] + h], [p[0] - h, p[1] + h]);
  return pos;
}

export class BuildingStage {
  constructor(viewer, building) {
    this.viewer = viewer;
    this.b = building;
    this.stage = 'outside';
    this.level = building.levels[0]?.id || null;
    this.levels = [...building.levels].sort((p, q) => p.elevation - q.elevation);
    // the viewer hands taps to the page, and lets the stage re-frame itself on a resize
    viewer.buildingMode = true;
    viewer.buildingRefit = () => this.frame(false);
  }

  frame(animate) {
    const el = this.stage === 'plan' ? 82 : this.stage === 'outside' ? 26 : 44;
    this.viewer.frameBuilding(this.stage, { elevation: el, animate });
  }

  roomOf(id) {
    return this.viewer.rooms.find((r) => r.id === id) || null;
  }

  /** The room (building.json) under plan point [x, z] on a level, or null. */
  roomAt(levelId, xz) {
    for (const r of this.b.rooms.filter((x) => x.level === levelId)) {
      if (pointInPolygon(xz, roomPolygon(this.b, r))) return r;
    }
    return null;
  }

  set(stage, { level = this.level, animate = true } = {}) {
    if (!STAGES.includes(stage)) return;
    const v = this.viewer;
    this.stage = stage;
    if (level) this.level = level;
    const top = this.levels[this.levels.length - 1]?.id;
    const ext = this.roomOf('exterior');
    v.clearBuildingCuts?.();
    for (const lv of this.levels) {
      const room = this.roomOf(`level-${lv.id}`);
      if (!room) continue;
      const i = this.levels.indexOf(lv);
      // which levels show, how far they're pulled apart, and how the dollhouse treats them
      const shown = stage === 'plan' ? lv.id === this.level : true;
      v.setRoomVisible(room.id, shown);
      v.setRoomOffset(room.id, stage === 'levels' ? i * LEVEL_GAP : 0);
      // outside: everything up; inside: the top level opened (lower ones stay closed under it); levels: all opened
      const cut = stage === 'outside' ? 'never' : stage === 'inside' ? (lv.id === top ? 'auto' : 'never') : 'auto';
      v.setRoomCutaway(room.id, cut);
      if (stage === 'plan' && lv.id === this.level) {
        const y = lv.elevation + CUT_Y;
        v.setBuildingCut(room.id, { y, cap: levelSectionCap(this.b, lv.id, y - 0.002) });
      }
    }
    if (ext) {
      v.setRoomVisible(ext.id, stage !== 'plan');
      // the roof lifts off (and floats above the pulled-apart levels); the ground stays
      const lift = stage === 'outside' ? 0 : stage === 'levels' ? (this.levels.length - 1) * LEVEL_GAP + ROOF_LIFT : ROOF_LIFT;
      v.setNodeLift?.(ext.id, /^roof/, lift, stage === 'outside' ? 1 : stage === 'inside' ? 0 : 0.35);
    }
    this.frame(animate);
  }

  dispose() {
    this.viewer.clearBuildingCuts?.();
    this.viewer.buildingMode = false;
    this.viewer.buildingRefit = null;
  }
}
