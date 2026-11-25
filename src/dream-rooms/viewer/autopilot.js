/* Dream Rooms · ?autopilot=1: follow world.route link by link to the wake.
     · a walk/teleport link: A* to the departure doorway, then through its stub
       (c → b1 → past the jump point), and out of the arrival stub on the far side;
     · a dissolve link: wander forward along the walkable area until it fires;
     · the last module: keep walking, and turn round once before the wake so a swap
       behind him can be witnessed.
   It only ever returns a drive ({ forward, yawTarget }), the same as a hand would. */

import { findPath, freeRun } from './grid.js';
import { yawTo, wrapAngle } from './walker.js';

const add = (p, v, k) => ({ x: p.x + v[0] * k, z: p.z + v[2] * k });
const pt = (a) => ({ x: a[0], z: a[2] });

export class Autopilot {
  constructor(runner) {
    this.r = runner;
    this.plan = null;
    this.ri = Math.max(0, (runner.world.route || []).indexOf(runner.module));
    this.lastModule = runner.module;
    this.wanderYaw = null;
    this.turned = false;
    this.stuckT = 0;
    this.lastPos = null;
  }

  onWrap(shift) {
    if (this.plan?.pts) for (const p of this.plan.pts) p.z += shift;
    if (this.lastPos) this.lastPos.z += shift;
  }

  onJump() {
    this.plan = null;
    this.lastPos = null;
  }

  syncRoute() {
    const r = this.r;
    if (r.module === this.lastModule) return;
    const route = r.world.route || [];
    if (route[this.ri + 1] === r.module) this.ri += 1;
    else if (route[this.ri] !== r.module) {
      const i = route.indexOf(r.module);
      if (i >= 0) this.ri = i;
    }
    this.lastModule = r.module;
    this.plan = null;
    this.wanderYaw = null;
    this.turned = false;
  }

  drive(dt) {
    this.syncRoute();
    const r = this.r;
    const w = r.S.walker;
    if (!this.plan) this.plan = this.makePlan();
    // stuck? replan (and nudge the wander)
    if (this.lastPos) {
      const d = Math.hypot(w.x - this.lastPos.x, w.z - this.lastPos.z);
      this.stuckT = d < 0.06 * dt ? this.stuckT + dt : 0;
      if (this.stuckT > 1.6) {
        this.stuckT = 0;
        this.plan = null;
        if (this.wanderYaw !== null) this.wanderYaw += Math.PI * 0.6;
      }
    }
    this.lastPos = { x: w.x, z: w.z };
    if (!this.plan) return { forward: 0, yawTarget: w.yaw };
    if (this.plan.kind === 'path') return this.follow();
    return this.wander();
  }

  makePlan() {
    const r = this.r;
    const w = r.S.walker;
    const mod = r.mods.get(r.module);
    const route = r.world.route || [];
    const next = route[this.ri + 1];
    const here = { x: w.x, z: w.z };
    // standing in a stub (just arrived): walk back out through its doorway, unless it's the way on
    const o = mod.origin;
    const outside = w.x < o[0] || w.x > o[0] + mod.size[0] || (!mod.repeat && (w.z < o[2] || w.z > o[2] + mod.size[2]));
    let dep = null;
    if (next) dep = [...r.departures.values()].find((d) => d.from.module === r.module && d.to.module === next) || null;
    if (outside) {
      let best = null;
      let bd = Infinity;
      for (const f of mod.frames) {
        const d = Math.hypot(f.m[0] - w.x, f.m[2] - w.z);
        if (d < bd) {
          bd = d;
          best = f;
        }
      }
      if (best && (!dep || dep.from.id !== best.id)) {
        return { kind: 'path', pts: [pt(best.b1), pt(best.centre), add(pt(best.centre), best.inward, 1.4)] };
      }
    }
    if (dep) {
      const f = dep.from;
      const grid = r.gridFor(r.module);
      const approach = add(pt(f.centre), f.inward, 0.9);
      const path = findPath(grid, here, approach);
      const lead = path ? path.slice(1) : [approach];
      return {
        kind: 'path',
        pts: [...lead, add(pt(f.centre), f.inward, 0.2), pt(f.centre), pt(f.b1), add(pt(f.m), f.side, 0.55), add(pt(f.m), f.side, 1.1)],
      };
    }
    return { kind: 'wander', last: !next };
  }

  follow() {
    const w = this.r.S.walker;
    const pts = this.plan.pts;
    while (pts.length && Math.hypot(pts[0].x - w.x, pts[0].z - w.z) < 0.22) pts.shift();
    if (!pts.length) {
      this.plan = null;
      return { forward: 0.4, yawTarget: w.yaw };
    }
    const yawTarget = yawTo(w, pts[0]);
    const err = Math.abs(wrapAngle(yawTarget - w.yaw));
    return { forward: err > 1.1 ? 0.12 : err > 0.5 ? 0.6 : 1, yawTarget };
  }

  wander() {
    const r = this.r;
    const w = r.S.walker;
    const mod = r.mods.get(r.module);
    const grid = r.gridFor(r.module);
    if (this.wanderYaw === null) {
      // a corridor: along its length, the way he's facing; anywhere else: straight on
      if (mod.repeat || mod.size[2] > mod.size[0] * 2) this.wanderYaw = Math.cos(w.yaw) >= 0 ? 0 : Math.PI;
      else if (mod.size[0] > mod.size[2] * 2) this.wanderYaw = Math.sin(w.yaw) >= 0 ? Math.PI / 2 : -Math.PI / 2;
      else this.wanderYaw = w.yaw;
    }
    if (this.plan.last && !this.turned) {
      const delay = r.world.wake?.delay ?? 14;
      if (mod.moved > Math.max(3, delay - 4.5)) {
        this.turned = true;
        this.wanderYaw += Math.PI;
        r.event('turn');
      }
    }
    const here = { x: w.x, z: w.z };
    const offs = [0, 0.3, -0.3, 0.6, -0.6, 1.0, -1.0, 1.5, -1.5, 2.1, -2.1, 2.8, -2.8];
    let pick = null;
    let bestRun = -1;
    let bestH = this.wanderYaw;
    for (const o of offs) {
      const h = this.wanderYaw + o;
      const run = freeRun(grid, here, -Math.sin(h), -Math.cos(h), 3);
      if (run >= 2.2) {
        pick = h;
        break;
      }
      if (run > bestRun) {
        bestRun = run;
        bestH = h;
      }
    }
    if (pick === null) pick = bestH;
    // follow the walls round a corner (the pool's edge band)
    if (Math.abs(wrapAngle(pick - this.wanderYaw)) > 0.5) this.wanderYaw = pick;
    // keep to the middle of whatever band he's in
    const lx = -Math.cos(pick);
    const lz = Math.sin(pick);
    const left = freeRun(grid, here, lx, lz, 1.4);
    const right = freeRun(grid, here, -lx, -lz, 1.4);
    const centre = Math.max(-0.25, Math.min(0.25, (left - right) * 0.3));
    const yawTarget = pick + centre;
    const err = Math.abs(wrapAngle(yawTarget - w.yaw));
    return { forward: err > 1.3 ? 0.15 : 1, yawTarget };
  }
}
