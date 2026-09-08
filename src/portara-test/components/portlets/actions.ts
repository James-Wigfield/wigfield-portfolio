/**
 * The jobs: hammering a nail, polishing, painting, welding a seam,
 * tightening a bolt, vacuuming. Each one plans where on the letter it can
 * work (through the contact sampler and the reach solver), then drives the
 * tool's TIP each frame in a frame on the surface: N the normal, U up along
 * the surface, V across it. Depth along N is never negative, so the tool can
 * only ever touch the surface, not enter it; contact is sold by squash,
 * recoil and follow-through instead.
 *
 * Every job runs anticipation (the tool eases in from a standoff) -> the
 * strokes -> follow-through (eases off), and multi-spot jobs ask the portlet
 * to move between spots. Timing, amplitude and phase are randomised per
 * instance so two runs never look copy-pasted.
 */
import * as THREE from "three";
import { type ActionKind, PORTLET_CONFIG as C } from "./config";
import { type Candidate, candidateToWorld } from "./contact";
import { bump, chance, chase, clamp, easeIn, easeInCubic, easeOut, headingOf, lerp, rand, randInt, smootherstep, smoothstep, TAU } from "./math";
import type { ToolId } from "./tools";
import type { Action, CanTarget, PlanContext, PortletView, Spot, WorkFrame } from "./types";

const UP = new THREE.Vector3(0, 1, 0);
const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();

/** The standoff the tool eases in from and out to. */
const APPROACH = 0.06;

type Phase = "idle" | "anticipate" | "work" | "follow" | "moving" | "done";

abstract class BaseAction implements Action {
  abstract readonly kind: ActionKind;
  abstract readonly toolId: ToolId;
  protected ctx!: PlanContext;
  protected spots: Spot[] = [];
  protected spot = 0;
  protected phase: Phase = "idle";
  protected t = 0;
  /** The current contact in the world, refreshed every frame. */
  protected P = new THREE.Vector3();
  protected N = new THREE.Vector3();
  protected U = new THREE.Vector3();
  protected V = new THREE.Vector3();
  private lastTip = new THREE.Vector3();
  /** Per-instance flavour. */
  protected amp = 1;
  protected phi = 0;

  plan(ctx: PlanContext): Spot[] | null {
    this.ctx = ctx;
    this.amp = rand(0.85, 1.15);
    this.phi = rand(0, TAU);
    const spots = this.planSpots(ctx);
    if (!spots || !spots.length) return null;
    this.spots = spots;
    return spots;
  }

  start(i: number) {
    this.spot = i;
    this.phase = "anticipate";
    this.t = 0;
    this.refresh();
    this.beginSpot();
  }

  arrived() {
    if (this.phase !== "moving") return;
    this.spot += 1;
    this.phase = "anticipate";
    this.t = 0;
    this.refresh();
    this.beginSpot();
  }

  update(dt: number, f: WorkFrame, view: PortletView) {
    this.t += dt;
    this.refresh();
    f.normal.copy(this.N);
    switch (this.phase) {
      case "anticipate": {
        const u = this.t / C.ceremony.anticipation;
        this.restTip(f.tip);
        f.tip.addScaledVector(this.N, APPROACH * (1 - smoothstep(u)));
        f.swing = this.restSwing() * smoothstep(u);
        if (u >= 1) {
          this.phase = "work";
          this.t = 0;
          this.beginStrokes();
        }
        break;
      }
      case "work": {
        const finished = this.stroke(dt, f, view);
        this.lastTip.copy(f.tip);
        if (finished) {
          this.phase = "follow";
          this.t = 0;
          this.endStrokes();
        }
        break;
      }
      case "follow": {
        const u = this.t / C.ceremony.followThrough;
        f.tip.copy(this.lastTip).addScaledVector(this.N, APPROACH * easeOut(u));
        f.swing = this.restSwing() * (1 - smoothstep(u));
        f.working = 0;
        if (u >= 1) {
          this.endSpot();
          if (this.spot + 1 < this.spots.length) {
            const s = this.spots[this.spot + 1];
            f.moveTo = { stance: s.stance, heading: s.heading, ride: s.ride };
            this.phase = "moving";
          } else {
            this.phase = "done";
            f.done = true;
          }
        }
        break;
      }
      case "moving":
        f.hold = true;
        break;
      case "done":
        f.hold = true;
        f.done = true;
        break;
      default:
        f.hold = true;
    }
  }

  end() {
    this.phase = "idle";
    this.hideProps();
  }

  describe(): string {
    return this.phase;
  }

  /** The contact's world point and normal, and the surface frame. On a
      concave wall the point is lifted by the surface's bulge within the
      tool's footprint, so the tool's rim cannot dip into the curve. */
  protected refresh() {
    const s = this.spots[this.spot];
    if (!s) return;
    candidateToWorld(this.ctx.mesh, s.contact, this.P, this.N);
    if (s.contact.bulge > 0) this.P.addScaledVector(this.N, s.contact.bulge * this.ctx.letterScale + 0.001);
    this.U.copy(UP).addScaledVector(this.N, -this.N.y);
    if (this.U.lengthSq() < 1e-6) this.U.copy(this.ctx.right).addScaledVector(this.N, -this.N.dot(this.ctx.right));
    this.U.normalize();
    this.V.crossVectors(this.N, this.U);
  }

  /** Where the tip rests on the surface when not stroking (default: the contact). */
  protected restTip(out: THREE.Vector3) {
    out.copy(this.P);
  }
  protected restSwing() {
    return 0;
  }

  /** Pick a spot: a usable contact, on the face or (when allowed) a wall.
      `extra`: flat surface needed beyond the tool's footprint; `edge`: how
      far round the point the surface must continue (what sits on it). */
  protected pickSpot(ctx: PlanContext, extra: number, edge: number, allowWalls: boolean, near?: Spot, minD = 0.1, maxD = 0.28): Spot | null {
    const want = allowWalls && chance(C.reach.wallChance) ? false : true;
    const pool: Candidate[] = [];
    const fallback: Candidate[] = [];
    for (const c of ctx.contacts.candidates) {
      if (!allowWalls && !c.face) continue;
      if (!ctx.usable(c, extra, edge)) continue;
      (c.face === want ? pool : fallback).push(c);
    }
    const tryFrom = (cands: Candidate[]) => {
      // Shuffle a copy, take the first that reaches.
      const xs = cands.slice();
      for (let i = xs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [xs[i], xs[j]] = [xs[j], xs[i]];
      }
      let tried = 0;
      for (const c of xs) {
        if (tried++ > 40) break;
        candidateToWorld(ctx.mesh, c, _p, _n);
        if (near) {
          const d = _p.distanceTo(near.stance);
          if (d < minD || d > maxD) continue;
        }
        const st = ctx.solve(_p, _n);
        if (st) return { contact: c, ...st };
      }
      return null;
    };
    return tryFrom(pool) ?? tryFrom(fallback);
  }

  protected abstract planSpots(ctx: PlanContext): Spot[] | null;
  protected beginSpot() {}
  protected beginStrokes() {}
  /** Drive the tip; return true when the strokes at this spot are finished. */
  protected abstract stroke(dt: number, f: WorkFrame, view: PortletView): boolean;
  protected endStrokes() {}
  protected endSpot() {}
  protected hideProps() {}
}

/* -------------------------------------------------------------------------- */

/** Hammering: a nail driven home over several blows, each with wind-up,
    strike, and recoil, the gaps between them uneven. */
class HammerAction extends BaseAction {
  readonly kind = "hammer" as const;
  readonly toolId = "hammer" as const;
  private showing = 0;
  private strikes = 0;
  private k = 0;
  private sub: "gap" | "windUp" | "strike" | "recoil" = "gap";
  private st = 0;
  private gap = 0.4;
  private arc = 1;
  private done = false;
  private tip = new THREE.Vector3();

  protected planSpots(ctx: PlanContext) {
    // The nail's head must sit wholly on the face.
    const s = this.pickSpot(ctx, 0, 0.012, false);
    return s ? [s] : null;
  }
  protected beginSpot() {
    const a = C.actions.hammer;
    this.showing = a.nailLen * a.nailStart;
    this.strikes = randInt(a.strikesMin, a.strikesMax);
    this.k = 0;
    this.done = false;
    this.sub = "gap";
    this.st = 0;
    this.gap = rand(a.gapMin, a.gapMax) * 0.6;
    this.arc = rand(0.85, 1.2);
    this.ctx.props.nail.set(this.P, this.N, this.showing);
  }
  protected restTip(out: THREE.Vector3) {
    this.ctx.props.nail.top(out, this.P, this.N, this.showing);
  }
  protected restSwing() {
    return C.actions.hammer.pullArc * 0.18;
  }
  protected stroke(dt: number, f: WorkFrame) {
    const a = C.actions.hammer;
    this.st += dt;
    this.ctx.props.nail.set(this.P, this.N, this.showing);
    this.restTip(f.tip);
    const restSwing = this.restSwing();
    switch (this.sub) {
      case "gap":
        f.swing = restSwing;
        if (this.st >= this.gap) {
          this.sub = "windUp";
          this.st = 0;
        }
        break;
      case "windUp": {
        const u = this.st / a.windUp;
        f.swing = lerp(restSwing, a.pullArc * this.arc, easeOut(u));
        if (u >= 1) {
          this.sub = "strike";
          this.st = 0;
        }
        break;
      }
      case "strike": {
        const u = this.st / a.strike;
        f.swing = a.pullArc * this.arc * (1 - easeInCubic(u));
        if (u >= 1) {
          // Impact.
          f.swing = 0;
          const step = ((a.nailStart - a.nailEnd) * a.nailLen) / this.strikes;
          this.showing = Math.max(a.nailLen * a.nailEnd, this.showing - step * rand(0.75, 1.25));
          this.ctx.props.nail.set(this.P, this.N, this.showing);
          this.ctx.props.nail.hit();
          f.recoil = a.bodyRecoil * rand(0.8, 1.2);
          this.k += 1;
          this.sub = "recoil";
          this.st = 0;
        }
        break;
      }
      case "recoil": {
        const u = this.st / a.recoilTime;
        f.swing = lerp(0, restSwing, smoothstep(u)) + a.pullArc * 0.25 * bump(u);
        if (u >= 1) {
          if (this.k >= this.strikes) this.done = true;
          this.sub = "gap";
          this.st = 0;
          this.gap = rand(a.gapMin, a.gapMax);
          this.arc = rand(0.85, 1.2);
        }
        break;
      }
    }
    // The free arm braces; the body leans in with the swing.
    f.pose = { armLx: -0.55, armLz: -0.3, bodyPitch: 0.08 + 0.05 * (f.swing / a.pullArc) };
    return this.done && this.sub === "gap" && this.st > 0.25;
  }
  protected hideProps() {
    this.ctx?.props.nail.hide();
  }
}

/** Polishing: a spinning pad in a figure-eight over two patches, leaving a
    shine that fades. */
class PolishAction extends BaseAction {
  readonly kind = "polish" as const;
  readonly toolId = "buffer" as const;
  private dur = 3;

  protected planSpots(ctx: PlanContext) {
    const a = C.actions.polish;
    // Most of the pad on the surface, so the buffing reads.
    const edge = ctx.tool.footprint * ctx.scale * 0.5;
    const first = this.pickSpot(ctx, a.radius, edge, false);
    if (!first) return null;
    const spots = [first];
    for (let i = 1; i < a.spots; i++) {
      const next = this.pickSpot(ctx, a.radius, edge, false, spots[spots.length - 1]);
      if (next) spots.push(next);
    }
    return spots;
  }
  protected beginSpot() {
    const a = C.actions.polish;
    this.dur = rand(a.perSpotMin, a.perSpotMax);
    this.ctx.props.shine.place(this.P, this.N);
  }
  protected stroke(dt: number, f: WorkFrame) {
    const a = C.actions.polish;
    const w = TAU * a.hz;
    const t = this.t;
    const env = Math.min(1, t / 0.5, (this.dur - t) / 0.5); // ease the pattern in and out
    const u = a.radius * this.amp * Math.sin(w * t + this.phi) * env;
    const v = 0.55 * a.radius * this.amp * Math.sin(2 * w * t + 2 * this.phi) * env;
    f.tip.copy(this.P).addScaledVector(this.U, u).addScaledVector(this.V, v);
    f.squash = 0.08;
    f.working = 1;
    this.ctx.props.shine.add(dt * 0.55);
    f.pose = { armLx: -0.4, armLz: -0.35, bodyYaw: 0.5 * v, bodyPitch: 0.1 };
    return t >= this.dur;
  }
  protected hideProps() {
    /* the shine fades by itself */
  }
}

/**
 * Painting: rows laid top to bottom in a serpentine, with trips to the can.
 * The can is a REACH TARGET, not a work surface: it stands to the right at
 * its own standoff, placed so that once the portlet turns to it the paint is
 * a comfortable arm's length in front of the right shoulder. The reload is
 * one eased sequence - turn and carry the brush over the can (with a little
 * anticipation), dip, hold, lift, dip again, then turn back and carry the
 * brush to the next row - with the body dipping only a touch; the portlet
 * caps torso and head pitch, and checks that only the bristles enter the
 * paint and nothing touches the tin.
 */
class PaintAction extends BaseAction {
  readonly kind = "paint" as const;
  readonly toolId = "brush" as const;
  private row = 0;
  private rows = 4;
  private sub: "row" | "lift" | "reload" = "row";
  private st = 0;
  private reload: "reach" | "dip" | "hold" | "lift" | "out" = "reach";
  private dips = 0;
  private from = new THREE.Vector3();
  private hover = new THREE.Vector3();
  private dipPt = new THREE.Vector3();
  private nextStart = new THREE.Vector3();
  private canHeading = 0;
  private can: CanTarget | null = null;
  private rowStart = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private squat = 0;

  protected planSpots(ctx: PlanContext) {
    const a = C.actions.paint;
    const extra = Math.max(a.rowHalf, ((a.rows - 1) / 2) * a.rowSpacing);
    const s = this.pickSpot(ctx, extra, 0, true);
    return s ? [s] : null;
  }
  protected beginSpot() {
    const a = C.actions.paint;
    const s = this.spots[this.spot];
    const props = this.ctx.props;
    this.rows = a.rows;
    this.row = 0;
    this.sub = "row";
    this.st = 0;
    this.squat = 0;
    // The can stands to the portlet's right, a little forward.
    const right = _a.set(Math.cos(s.heading), 0, -Math.sin(s.heading));
    const fwd = _b.set(Math.sin(s.heading), 0, Math.cos(s.heading));
    const at = s.stance.clone().addScaledVector(right, a.canOffset).addScaledVector(fwd, a.canForward);
    props.can.place(at, s.heading);
    // Face it so the paint sits straight in front of the RIGHT shoulder: the
    // heading of the can from the stance, turned back by the angle the
    // shoulder's offset subtends.
    const d = _a.set(at.x - s.stance.x, 0, at.z - s.stance.z);
    const dist = d.length();
    const side = Math.min(this.ctx.shoulderSide, dist * 0.95);
    this.canHeading = headingOf(d.x, d.z) - Math.asin(side / dist);
    this.can = {
      centre: at.clone(),
      paintY: at.y + props.can.paintY,
      rimY: at.y + props.can.rim,
      bottomY: at.y + props.can.bottom,
      innerR: props.can.innerR,
      maxUnder: 0.07 * this.ctx.scale, // the bristles' length
    };
    props.can.surface(this.hover).setY(this.can.paintY + a.hoverAbove);
    this.dipPt.copy(this.hover).setY(this.can.paintY - a.dipDepth);
    props.strips.reset();
    this.startRow();
  }
  private rowU(j: number) {
    const a = C.actions.paint;
    return ((this.rows - 1) / 2 - j) * a.rowSpacing;
  }
  /** Where row j begins on the surface. */
  private rowBegin(out: THREE.Vector3, j: number) {
    const a = C.actions.paint;
    const side = j % 2 ? 1 : -1;
    return out.copy(this.P).addScaledVector(this.U, this.rowU(j)).addScaledVector(this.V, -side * a.rowHalf);
  }
  private startRow() {
    const side = this.row % 2 ? 1 : -1;
    this.rowBegin(this.rowStart, this.row);
    this.dir.copy(this.V).multiplyScalar(side);
    this.ctx.props.strips.begin(this.rowStart, this.N, this.dir, 0.026);
  }
  protected stroke(dt: number, f: WorkFrame, view: PortletView) {
    const a = C.actions.paint;
    this.st += dt;
    const side = this.row % 2 ? 1 : -1;
    switch (this.sub) {
      case "row": {
        const u = smoothstep(this.st / a.stroke);
        f.tip
          .copy(this.P)
          .addScaledVector(this.U, this.rowU(this.row))
          .addScaledVector(this.V, side * a.rowHalf * (2 * u - 1));
        f.squash = 0.1;
        f.working = 1;
        this.ctx.props.strips.extend(f.tip);
        f.pose = { armLx: -0.3, armLz: -0.3, bodyYaw: 0.35 * side * (2 * u - 1) * a.rowHalf * 4, bodyPitch: 0.08 };
        if (this.st >= a.stroke) {
          this.st = 0;
          this.row += 1;
          if (this.row >= this.rows) return true;
          if (this.row % a.reloadEvery === 0) {
            this.sub = "reload";
            this.reload = "reach";
            this.dips = 0;
            this.from.copy(f.tip);
          } else {
            this.sub = "lift";
          }
        }
        break;
      }
      case "lift": {
        // Off the surface, down to the next row's start (the serpentine
        // begins each row where the last ended), back on.
        const u = this.st / 0.35;
        this.rowBegin(_a, this.row).addScaledVector(this.U, this.rowU(this.row - 1) - this.rowU(this.row));
        this.rowBegin(_b, this.row);
        f.tip.lerpVectors(_a, _b, smoothstep(u)).addScaledVector(this.N, a.lift * bump(u));
        f.pose = { armLx: -0.3, armLz: -0.3, bodyPitch: 0.08 };
        if (u >= 1) {
          this.sub = "row";
          this.st = 0;
          this.startRow();
        }
        break;
      }
      case "reload":
        this.doReload(dt, f, view);
        break;
    }
    return false;
  }

  /** The trip to the can, one eased sequence. */
  private doReload(dt: number, f: WorkFrame, view: PortletView) {
    const a = C.actions.paint;
    const s = this.spots[this.spot];
    const r = this.reload;
    f.can = this.can;
    f.working = 0;
    f.faceHeading = r === "out" ? s.heading : this.canHeading;
    // The body dips a touch while the brush is down; the rest is arm.
    const wantSquat = r === "dip" || r === "hold" || r === "lift" ? 1 : 0;
    this.squat += (wantSquat - this.squat) * chase(6, dt);
    f.pose = { bodyPitch: 0.2 * this.squat, armLx: -0.2 - 0.15 * this.squat, armLz: -0.4, lift: -a.squat * this.squat };
    switch (r) {
      case "reach": {
        // Turn to the can while carrying the brush over it, lifting a little
        // on the way (anticipation), the brush turning upright.
        const u = clamp(this.st / a.reach, 0, 1);
        const e = smoothstep(u);
        f.tip.lerpVectors(this.from, this.hover, e).addScaledVector(UP, 0.035 * bump(u));
        f.normal.copy(this.N).lerp(UP, e).normalize();
        if (u >= 1 && view.oriented) {
          this.reload = "dip";
          this.st = 0;
        }
        break;
      }
      case "dip": {
        const u = clamp(this.st / a.dip, 0, 1);
        f.tip.lerpVectors(this.hover, this.dipPt, smootherstep(u));
        f.normal.copy(UP);
        if (u >= 1) {
          this.reload = "hold";
          this.st = 0;
        }
        break;
      }
      case "hold": {
        f.tip.copy(this.dipPt).addScaledVector(this.V, 0.002 * Math.sin(this.st * 18));
        f.normal.copy(UP);
        if (this.st >= a.hold) {
          this.reload = "lift";
          this.st = 0;
        }
        break;
      }
      case "lift": {
        const u = clamp(this.st / a.liftOut, 0, 1);
        f.tip.lerpVectors(this.dipPt, this.hover, smootherstep(u));
        f.normal.copy(UP);
        if (u >= 1) {
          this.st = 0;
          this.dips += 1;
          if (this.dips < a.reloadDips) {
            this.reload = "dip";
          } else {
            this.reload = "out";
            this.rowBegin(this.nextStart, this.row);
          }
        }
        break;
      }
      case "out": {
        // Turn back and carry the brush to the next row, in an arc, the
        // brush laying back down onto the surface's normal.
        const u = clamp(this.st / a.out, 0, 1);
        const e = smoothstep(u);
        f.tip.lerpVectors(this.hover, this.nextStart, e).addScaledVector(UP, 0.04 * bump(u));
        f.normal.copy(UP).lerp(this.N, e).normalize();
        if (u >= 1 && view.oriented) {
          this.sub = "row";
          this.st = 0;
          this.startRow();
        }
        break;
      }
    }
  }
  describe() {
    return `${this.phase}/${this.sub}${this.sub === "reload" ? "/" + this.reload : ""} row ${this.row}`;
  }
  protected endStrokes() {
    this.ctx.props.strips.fadeOut();
  }
  /** The can goes with them when they step back. */
  protected endSpot() {
    this.ctx.props.can.hide();
  }
  protected hideProps() {
    this.ctx?.props.can.hide();
    this.ctx?.props.strips.fadeOut();
  }
}

/** Welding: a slow pass along a seam with the arc on, sparks flying, a bead
    left behind; the free arm shields the visor. */
class WeldAction extends BaseAction {
  readonly kind = "weld" as const;
  readonly toolId = "torch" as const;
  private dur = 3.5;
  private seamDir = new THREE.Vector3();
  private seamStart = new THREE.Vector3();

  protected planSpots(ctx: PlanContext) {
    const s = this.pickSpot(ctx, C.actions.weld.seamHalf, 0, true);
    return s ? [s] : null;
  }
  protected beginSpot() {
    const a = C.actions.weld;
    this.dur = rand(a.timeMin, a.timeMax);
    this.seamDir.copy(this.V).multiplyScalar(chance(0.5) ? 1 : -1);
    this.seamStart.copy(this.P).addScaledVector(this.seamDir, -a.seamHalf);
  }
  protected restTip(out: THREE.Vector3) {
    out.copy(this.seamStart).addScaledVector(this.N, C.actions.weld.gap);
  }
  protected beginStrokes() {
    this.ctx.props.bead.begin(this.seamStart, this.N, this.seamDir);
  }
  protected stroke(dt: number, f: WorkFrame) {
    const a = C.actions.weld;
    const t = this.t;
    const u = clamp(t / this.dur, 0, 1);
    const along = -a.seamHalf + 2 * a.seamHalf * u + 0.004 * Math.sin(t * 9 + this.phi);
    const wob = a.wobble * (0.5 * Math.sin(t * 13.1 + this.phi) + 0.5 * Math.sin(t * 7.3));
    f.tip
      .copy(this.P)
      .addScaledVector(this.seamDir, along)
      .addScaledVector(this.U, wob)
      .addScaledVector(this.N, a.gap + Math.max(0, wob));
    f.working = 1;
    this.ctx.props.sparks.emit(f.tip, this.N, a.sparkRate * rand(0.6, 1.4), dt);
    _a.copy(f.tip).addScaledVector(this.N, -a.gap - Math.max(0, wob));
    this.ctx.props.bead.extend(_a);
    f.pose = { armLx: -2.25, armLz: 0.55, bodyPitch: 0.14, headPitch: 0.25 };
    f.lookAtTip = false;
    return t >= this.dur;
  }
  protected endStrokes() {
    this.ctx.props.sparks.stop();
  }
  protected hideProps() {
    this.ctx?.props.bead.hide();
    this.ctx?.props.sparks.stop();
  }
}

/** A bolt tightened with the socket wrench: drop on, drive, lift and turn back. */
class WrenchAction extends BaseAction {
  readonly kind = "wrench" as const;
  readonly toolId = "wrench" as const;
  private turns = 5;
  private k = 0;
  private sub: "engage" | "drive" | "back" = "engage";
  private st = 0;
  private sink = 0;
  private boltAngle = 0;
  private baseRoll = 0;

  protected planSpots(ctx: PlanContext) {
    // The bolt's washer must sit wholly on the face.
    const s = this.pickSpot(ctx, 0, 0.018, false);
    return s ? [s] : null;
  }
  protected beginSpot() {
    const a = C.actions.wrench;
    this.turns = randInt(a.turnsMin, a.turnsMax);
    this.k = 0;
    this.sub = "engage";
    this.st = 0;
    this.sink = 0;
    this.boltAngle = rand(0, TAU);
    this.baseRoll = 0;
    this.ctx.props.bolt.set(this.P, this.N, 0, this.boltAngle);
  }
  protected restTip(out: THREE.Vector3) {
    this.ctx.props.bolt.mouth(out, this.P, this.N, this.sink);
  }
  protected stroke(dt: number, f: WorkFrame) {
    const a = C.actions.wrench;
    this.st += dt;
    this.restTip(f.tip);
    switch (this.sub) {
      case "engage": {
        const u = this.st / 0.16;
        f.tip.addScaledVector(this.N, a.lift * (1 - smoothstep(u)));
        f.rollAngle = this.baseRoll;
        if (u >= 1) {
          this.sub = "drive";
          this.st = 0;
        }
        break;
      }
      case "drive": {
        // Effort: slow to start, then it gives.
        const u = this.st / a.drive;
        const e = easeIn(Math.min(1, u * 1.15)) * 0.35 + smoothstep(u) * 0.65;
        f.rollAngle = this.baseRoll + a.angle * e;
        this.ctx.props.bolt.set(this.P, this.N, this.sink, this.boltAngle + a.angle * e);
        f.pose = { armLx: -0.45, armLz: -0.35, bodyYaw: -0.18 * e, bodyPitch: 0.12 + 0.05 * e };
        if (u >= 1) {
          this.boltAngle += a.angle;
          this.sink = Math.min(a.headH * 0.4, this.sink + a.sinkPerTurn);
          this.k += 1;
          this.sub = "back";
          this.st = 0;
        }
        break;
      }
      case "back": {
        const u = this.st / a.back;
        f.tip.addScaledVector(this.N, a.lift * bump(u));
        f.rollAngle = this.baseRoll + a.angle * (1 - smoothstep(u));
        f.pose = { armLx: -0.45, armLz: -0.35, bodyYaw: -0.18 * (1 - u), bodyPitch: 0.12 };
        if (u >= 1) {
          this.sub = "engage";
          this.st = 0;
          if (this.k >= this.turns) return true;
        }
        break;
      }
    }
    return false;
  }
  protected hideProps() {
    this.ctx?.props.bolt.hide();
  }
}

/** Vacuuming: slow sweeps with the nozzle a hair off the surface, dust drawn in. */
class VacuumAction extends BaseAction {
  readonly kind = "vacuum" as const;
  readonly toolId = "vacuum" as const;
  private dur = 4;

  protected planSpots(ctx: PlanContext) {
    const s = this.pickSpot(ctx, C.actions.vacuum.sweep, 0, true);
    return s ? [s] : null;
  }
  protected beginSpot() {
    const a = C.actions.vacuum;
    this.dur = rand(a.timeMin, a.timeMax);
    this.ctx.props.dust.start(this.P, this.N, a.sweep + 0.03);
  }
  protected restTip(out: THREE.Vector3) {
    out.copy(this.P).addScaledVector(this.N, C.actions.vacuum.gap);
  }
  protected stroke(dt: number, f: WorkFrame) {
    const a = C.actions.vacuum;
    const t = this.t;
    const w = TAU * a.hz;
    const env = Math.min(1, t / 0.6, (this.dur - t) / 0.6);
    const v = a.sweep * this.amp * Math.sin(w * t + this.phi) * env;
    const u = 0.6 * a.sweep * Math.sin(0.37 * w * t + 2 * this.phi) * env;
    const rumble = a.rumble * (Math.sin(t * 61) * Math.sin(t * 37 + 1));
    f.tip
      .copy(this.P)
      .addScaledVector(this.U, u + rumble)
      .addScaledVector(this.V, v)
      .addScaledVector(this.N, a.gap + Math.abs(rumble));
    f.working = 1;
    this.ctx.props.dust.update(dt, f.tip);
    f.pose = { armLx: -0.25, armLz: -0.3, bodyYaw: 0.3 * v * 4, bodyPitch: 0.1 };
    return t >= this.dur;
  }
  protected hideProps() {
    this.ctx?.props.dust.stop();
  }
}

/* -------------------------------------------------------------------------- */

export const ACTION_TOOL: Record<ActionKind, ToolId> = {
  hammer: "hammer",
  polish: "buffer",
  paint: "brush",
  weld: "torch",
  wrench: "wrench",
  vacuum: "vacuum",
};

export function makeAction(kind: ActionKind): Action {
  switch (kind) {
    case "hammer":
      return new HammerAction();
    case "polish":
      return new PolishAction();
    case "paint":
      return new PaintAction();
    case "weld":
      return new WeldAction();
    case "wrench":
      return new WrenchAction();
    case "vacuum":
      return new VacuumAction();
  }
}
