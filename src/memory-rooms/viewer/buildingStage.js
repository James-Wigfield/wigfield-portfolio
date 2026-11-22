/* The building page's stages, on a RoomViewer that loaded a place as a group:
   rooms `level-<levelId>` (one per level GLB, plan frame, absolute height) and `exterior` (roof + site).

     const stage = new BuildingStage(viewer, building);   // building = building.json (the row's `plan`)
     stage.set('outside')            // the whole house, roof on
     stage.set('inside', { open })   // the roof lifted off, level `open` cut away (dollhouse), the levels above it
                                     // lifted up and away (faded); default the top level
     stage.setOpen(p, { scrub })     // the Inside level slider: p = a level index, fractional while dragging
     stage.set('plan')               // EVERY level side by side (building/planLayout.js), each clipped at its 1.2 m
                                     // with its walls in section, top-down, the same scale and north, labelled
     stage.set('levels')             // every level pulled apart, each cut away, the roof floating above
     stage.roomAt(level, [x, z])     // the room (building.json) under a plan point, or null
     stage.dispose()

   Each level has a pose { x, y, z, alpha }; a stage change eases every level from where it is to its new pose
   (STAGE_MS), so the levels slide apart into the plan, lift away above the open level, and settle back.

   Walls in a level GLB carry `mrWall = { normal (left), exterior, rooms: { left, right } }`: the dollhouse hides
   an exterior wall when its OUTSIDE faces the camera, and never hides a partition (viewer/dollhouse.js).
   CONTRACTS.md 6.4. */

import { roomPolygon, wallLines, wallOpenings } from '../building/geometry.js';
import { levelPlanLayout } from '../building/planLayout.js';
import { pointInPolygon } from '../scene/polygon.js';
import { CUT_Y } from './planCut.js';

export const STAGES = ['outside', 'inside', 'plan', 'levels'];
const LEVEL_GAP = 3.2; // metres between pulled-apart levels
const ROOF_LIFT = 2.4;
const INSIDE_LIFT = 7; // metres a level above the open one lifts (and fades) away
const STAGE_MS = 750;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const smooth = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const lerp = (a, b, t) => a + (b - a) * t;

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
    // only the levels that loaded (a level without its model has nothing to show), lowest first
    this.levels = [...building.levels].sort((p, q) => p.elevation - q.elevation).filter((l) => viewer.rooms.some((r) => r.id === `level-${l.id}`));
    this.open = Math.max(0, this.levels.length - 1); // Inside: the open level (an index), the top one by default
    this.poses = new Map(this.levels.map((l) => [l.id, { x: 0, y: 0, z: 0, alpha: 1 }]));
    this.layout = null;
    this.tween = null;
    // the viewer hands taps to the page, and lets the stage re-frame itself on a resize (a plan that turned
    // from wide to portrait re-lays its levels out)
    viewer.buildingMode = true;
    viewer.buildingRefit = (animate = false) => {
      if (this.stage === 'plan' && this.planLayout().direction !== this.layout?.direction) this.set('plan', { animate, force: true });
      else this.frame(animate);
    };
  }

  planLayout() {
    const v = this.viewer;
    return levelPlanLayout(this.b, v.width / Math.max(1, v.height), { ids: this.levels.map((l) => l.id) });
  }

  frame(animate) {
    const el = this.stage === 'plan' ? 82 : this.stage === 'outside' ? 26 : 44;
    // Inside frames the open level only (the ones above are lifting away)
    const only = this.stage === 'inside' && this.levels.length ? [`level-${this.levels[Math.round(this.open)].id}`] : null;
    this.viewer.frameBuilding(this.stage, { elevation: el, animate, only, goal: this.goalBox(only) });
  }

  /** The framing box once the levels have landed (they may still be easing there). */
  goalBox(only) {
    const v = this.viewer;
    const goal = this.goal;
    if (!goal) return null;
    const box = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    let any = false;
    for (const r of v.rooms) {
      if (!r.holder.visible && !goal.has(r.id.slice(6))) continue;
      if (only && !only.includes(r.id)) continue;
      const g = r.id.startsWith('level-') ? goal.get(r.id.slice(6)) : null;
      if (g && g.alpha < 0.05) continue;
      if (!r.localBox) {
        // the room's box in its holder's frame (holders only ever move, never turn or scale)
        const hb = r.holder.position.clone();
        r.localBox = new r.box.constructor().setFromObject(r.root);
        r.localBox.min.sub(hb);
        r.localBox.max.sub(hb);
      }
      const o = g ? [g.x, g.y, g.z] : [r.holder.position.x, r.holder.position.y, r.holder.position.z];
      if (r.id === 'exterior' && this.stage === 'plan') continue;
      for (const k of [0, 1, 2]) {
        const key = 'xyz'[k];
        box.min[k] = Math.min(box.min[k], r.localBox.min[key] + o[k]);
        box.max[k] = Math.max(box.max[k], r.localBox.max[key] + o[k]);
      }
      any = true;
    }
    return any ? box : null;
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

  /** Each level's pose for a stage (and, for Inside, the open level p). */
  targets(stage, p = this.open) {
    const out = new Map();
    if (stage === 'plan') {
      this.layout = this.planLayout();
      // every floor down onto the drafting table, the cells side by side: one scale, one north, one cut height
      for (const l of this.layout.levels) out.set(l.id, { x: l.offset[0], y: -l.elevation, z: l.offset[1], alpha: 1 });
      return out;
    }
    this.levels.forEach((lv, i) => {
      if (stage === 'levels') out.set(lv.id, { x: 0, y: i * LEVEL_GAP, z: 0, alpha: 1 });
      else if (stage === 'inside') {
        const k = smooth(i - p); // 0 at or below the open level, 1 a whole level above it
        out.set(lv.id, { x: 0, y: k * INSIDE_LIFT, z: 0, alpha: 1 - k });
      } else out.set(lv.id, { x: 0, y: 0, z: 0, alpha: 1 });
    });
    return out;
  }

  /** Put every level at its pose, now. */
  place(poses) {
    const v = this.viewer;
    for (const lv of this.levels) {
      const p = poses.get(lv.id);
      if (!p) continue;
      this.poses.set(lv.id, { ...p });
      v.setRoomPosition(`level-${lv.id}`, [p.x, p.y, p.z]);
      v.setRoomFade(`level-${lv.id}`, p.alpha);
    }
  }

  /** Ease every level from where it is to `goal` (or snap there), then `done`. */
  move(goal, animate, done) {
    const v = this.viewer;
    if (this.tween) v.tweens.delete(this.tween);
    this.tween = null;
    this.goal = goal;
    if (!animate || v.reducedMotion) {
      this.place(goal);
      done?.();
      return;
    }
    const from = new Map([...this.poses].map(([k, p]) => [k, { ...p }]));
    this.tween = v.tween({
      kind: 'stage',
      ms: STAGE_MS,
      easing: ease,
      step: (t) => {
        const now = new Map();
        for (const [id, g] of goal) {
          const f = from.get(id) || g;
          now.set(id, { x: lerp(f.x, g.x, t), y: lerp(f.y, g.y, t), z: lerp(f.z, g.z, t), alpha: lerp(f.alpha, g.alpha, t) });
        }
        this.place(now);
      },
      done: () => {
        this.tween = null;
        done?.();
      },
    });
  }

  roofLift(stage, p) {
    const top = this.levels.length - 1;
    if (stage === 'outside') return 0;
    if (stage === 'levels') return top * LEVEL_GAP + ROOF_LIFT;
    return ROOF_LIFT + (stage === 'inside' ? INSIDE_LIFT * smooth(top - p) : 0);
  }

  set(stage, { open = this.open, animate = true, force = false } = {}) {
    if (!STAGES.includes(stage)) return;
    const v = this.viewer;
    const was = this.stage;
    this.stage = stage;
    this.open = Math.max(0, Math.min(this.levels.length - 1, Math.round(open)));
    const ext = this.roomOf('exterior');
    v.clearBuildingCuts();
    v.setLabels([]);
    const goal = this.targets(stage);
    const openId = this.levels[this.open]?.id;
    // the drafting table: under the whole laid-out plan (no contact shadow: a plan is a drawing), else as built
    if (stage === 'plan' && this.layout?.bounds) {
      const { min, max } = this.layout.bounds;
      v.setGround({ centre: [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2], radius: 0.5 * Math.hypot(max[0] - min[0], max[1] - min[1]) * 1.5, box: null });
    } else v.setGround();
    for (const lv of this.levels) {
      const id = `level-${lv.id}`;
      v.setRoomVisible(id, true);
      // outside: everything up; inside: the open level cut away (the ones above lift off, the ones below stay
      // closed under it); levels: all opened; plan: every wall up (the cut opens it, as a spot's plan)
      const cut = stage === 'outside' || stage === 'plan' ? 'never' : stage === 'inside' ? (lv.id === openId ? 'auto' : 'never') : 'auto';
      v.setRoomCutaway(id, cut);
    }
    if (ext) {
      v.setRoomVisible(ext.id, stage !== 'plan');
      // the roof lifts off (and floats above the pulled-apart levels, or above the lifted ones); the ground stays
      v.setNodeLift(ext.id, /^roof/, this.roofLift(stage, this.open), stage === 'outside' ? 1 : stage === 'inside' ? 0 : 0.35);
    }
    // the plan's cuts sit at one world height once every floor is down on the table: draw them when they land
    const landed = () => {
      if (this.stage !== 'plan') return;
      for (const l of this.layout?.levels || []) {
        v.setBuildingCut(`level-${l.id}`, { y: CUT_Y, cap: levelSectionCap(this.b, l.id, l.elevation + CUT_Y - 0.002) });
      }
      if ((this.layout?.levels.length || 0) > 1) {
        // each level's name above the north-west corner of its cell
        v.setLabels(this.layout.levels.map((l) => ({ id: l.id, text: l.name, at: [l.cell.min[0], CUT_Y, l.cell.min[1] - 0.45] })));
      }
    };
    this.move(goal, animate && (was !== stage || force), landed);
    this.frame(animate);
  }

  /**
   * The Inside level slider. `p` = a level index (0 = lowest); fractional while dragging (scrub: the levels above
   * follow the finger, the camera glides with the floor). Letting go (scrub false) settles on the nearest level,
   * eased, and re-frames on it.
   */
  setOpen(p, { scrub = false, animate = true } = {}) {
    if (this.stage !== 'inside' || !this.levels.length) return;
    const v = this.viewer;
    const n = this.levels.length - 1;
    p = Math.max(0, Math.min(n, p));
    if (!scrub) p = Math.round(p);
    const prev = this.open;
    this.open = p;
    const openId = this.levels[Math.round(p)].id;
    for (const lv of this.levels) v.setRoomCutaway(`level-${lv.id}`, lv.id === openId ? 'auto' : 'never');
    const ext = this.roomOf('exterior');
    if (ext) v.setNodeLift(ext.id, /^roof/, this.roofLift('inside', p), 0);
    if (scrub) {
      if (this.tween) v.tweens.delete(this.tween);
      this.tween = null;
      const goal = this.targets('inside', p);
      this.goal = goal;
      this.place(goal);
      // the camera glides with the floor under it
      const dy = this.elevationAt(p) - this.elevationAt(prev);
      if (dy) {
        for (const tw of v.tweens) if (tw.kind === 'orbit') v.tweens.delete(tw);
        v.camera.position.y += dy;
        v.controls.target.y += dy;
        v.requestRender();
      }
      return;
    }
    this.move(this.targets('inside', p), animate, null);
    this.frame(animate);
  }

  elevationAt(q) {
    const n = this.levels.length - 1;
    const i = Math.max(0, Math.min(n, Math.floor(q)));
    const j = Math.min(n, i + 1);
    return lerp(this.levels[i].elevation, this.levels[j].elevation, q - i);
  }

  dispose() {
    if (this.tween) this.viewer.tweens.delete(this.tween);
    this.viewer.clearBuildingCuts();
    this.viewer.setLabels([]);
    this.viewer.setGround();
    this.viewer.buildingMode = false;
    this.viewer.buildingRefit = null;
  }
}
