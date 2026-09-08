/**
 * One portlet: its state machine (out of the portal, down the steps, to the
 * letter, the job, a step back to look, home again), its body (steering,
 * ride height, gait, pose blending) and its tool (carried in the hand, or
 * solved from the contact with the arm aiming at the grip).
 *
 * THE TOOL LIVES IN WORLD SPACE. While working, its transform is computed
 * from the action's contact point and normal: axis into the surface, tip on
 * the point (depth never negative), roll from the tool's rule. The grip that
 * falls out of that is what the arm aims at; if the grip is a little beyond
 * the arm, the body leans in (a damped nudge of the root, capped) rather than
 * the tool moving off the surface. So the tool cannot enter a letter, and
 * the hand still lands on it. Between contacts the tool follows the hand
 * socket, and the two are crossfaded.
 */
import * as THREE from "three";
import { PORTLET_CONFIG as C } from "./config";
import { insideLetter } from "./contact";
import { bump, chase, clamp, frameQuaternion, lerp, rand, smoothstep, Spring, TAU } from "./math";
import { type Measure, toolQuaternion } from "./reach";
import type { Rig } from "./rig";
import { type GroundFn, Motion } from "./steering";
import type { ToolSpec } from "./tools";
import { type Job, makeFrame, POSE_KEYS, type Pose, REST, resetFrame } from "./types";

export type PortletState =
  | "free"
  | "spawn"
  | "drop"
  | "travel"
  | "draw"
  | "work"
  | "move"
  | "stow"
  | "inspect"
  | "leave"
  | "wait"
  | "climb"
  | "rise"
  | "vanish";

const MOVING = new Set<PortletState>(["travel", "move", "inspect", "leave", "wait", "climb", "work", "draw", "stow"]);
const WORKING = new Set<PortletState>(["draw", "work", "move", "stow"]);

/** The ways in and out, world space, built by the manager for a job. */
export type Routes = {
  door: THREE.Vector3;
  plinth: THREE.Vector3;
  outHeading: number;
  out: THREE.Vector3[];
  back: (from: THREE.Vector3) => THREE.Vector3[];
  climb: THREE.Vector3[];
};

export type PortletEnv = {
  ground: GroundFn;
  others: readonly Motion[];
  time: number;
  checkPenetration: boolean;
};

const DOWN = new THREE.Vector3(0, -1, 0);
const FWD = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();
const _d = new THREE.Vector3();
const _h = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _s = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _qs = new THREE.Quaternion();
const _carryQ = new THREE.Quaternion();

function setRot(part: THREE.Object3D, rest: THREE.Euler, x: number, y: number, z: number) {
  part.rotation.set(rest.x + x, rest.y + y, rest.z + z);
}

export class Portlet {
  readonly motion = new Motion();
  state: PortletState = "free";
  t = 0;
  fade = 0;
  /** 0..1 how hard the portal glows for this one. */
  flash = 0;
  job: Job | null = null;
  tool: ToolSpec | null = null;
  /** Set by the manager when the gate is theirs to climb. */
  gateGranted = false;
  /** Debug: this frame the tool was found inside the letter. */
  penetrating = false;
  checked = false;
  readonly shoulder = new THREE.Vector3();
  readonly tipWorld = new THREE.Vector3();
  readonly probesWorld: THREE.Vector3[] = [];
  readonly frame = makeFrame();
  /** How much of the tool is showing (0..1) and how much of it is solved from the contact. */
  toolS = 0;
  toolW = 0;

  private pose: Pose = { ...REST };
  private target: Pose = { ...REST };
  private blendFrom: Pose = { ...REST };
  private blendT = 1;
  private hover = new Spring(C.hover.omega);
  private nudgeX = new Spring(C.reach.nudgeOmega);
  private nudgeZ = new Spring(C.reach.nudgeOmega);
  private ride = 0;
  private routes: Routes | null = null;
  private riseFrom = new THREE.Vector3();
  private inspectDur = 1.5;
  private phases = { bob: rand(0, TAU), j1: rand(0, TAU), j2: rand(0, TAU), sway: rand(0, TAU) };
  private blinkAt = 1;
  private blinkUntil = 0;
  private time = 0;
  private carriedPos = new THREE.Vector3();
  private carriedQ = new THREE.Quaternion();
  private solvedPos = new THREE.Vector3();
  private solvedQ = new THREE.Quaternion();
  private grip = new THREE.Vector3();
  private tipOff = new THREE.Vector3();
  private actionRan = false;
  private faceSet: number | null = null;

  /** The pose as applied this frame (read-only, for the console). */
  get currentPose(): Readonly<Pose> {
    return this.pose;
  }

  constructor(
    readonly slot: number,
    readonly rig: Rig,
    private readonly m: Measure,
  ) {
    rig.root.visible = false;
    rig.root.rotation.order = "YXZ";
    for (let i = 0; i < 8; i++) this.probesWorld.push(new THREE.Vector3());
  }

  get active() {
    return this.state !== "free";
  }

  /** Out of the portal with a job. */
  start(job: Job, tool: ToolSpec, routes: Routes) {
    this.job = job;
    this.tool = tool;
    this.routes = routes;
    this.gateGranted = false;
    this.fade = 0;
    this.toolS = 0;
    this.toolW = 0;
    this.ride = 0;
    this.hover.reset(0);
    this.nudgeX.reset(0);
    this.nudgeZ.reset(0);
    this.pose = { ...REST };
    this.blendT = 1;
    this.faceSet = null;
    this.motion.teleport(routes.door, routes.outHeading);
    this.motion.present = true;
    tool.group.visible = false;
    this.rig.root.visible = true;
    this.setState("spawn");
  }

  /** Drop everything (an error, or the scene going away). */
  abort() {
    this.finish();
  }

  private setState(s: PortletState) {
    this.blendFrom = { ...this.pose };
    this.blendT = 0;
    this.state = s;
    this.t = 0;
  }

  private finish() {
    try {
      this.job?.action.end();
    } finally {
      if (this.tool) this.tool.group.visible = false;
      this.rig.root.visible = false;
      this.job = null;
      this.tool = null;
      this.routes = null;
      this.gateGranted = false;
      this.state = "free";
      this.fade = 0;
      this.flash = 0;
      this.penetrating = false;
      this.checked = false;
      this.motion.clear();
      this.motion.present = false;
    }
  }

  update(dt: number, env: PortletEnv, leaving: boolean) {
    if (this.state === "free" || !this.job || !this.routes || !this.tool) return;
    this.t += dt;
    this.time = env.time;
    this.flash = 0;
    this.penetrating = false;
    this.checked = false;
    const f = this.frame;
    const mo = this.motion;
    const job = this.job;
    const R = this.routes;
    if (leaving && this.state !== "vanish") this.setState("vanish");

    if (MOVING.has(this.state)) mo.update(dt, env.others, env.ground);
    this.actionRan = false;

    switch (this.state) {
      case "spawn": {
        const u = clamp(this.t / C.ceremony.fade, 0, 1);
        this.fade = u;
        this.flash = bump(u);
        mo.pos.copy(R.door);
        if (u >= 1) this.setState("drop");
        break;
      }
      case "drop": {
        // Onto the plinth as the model actually has it under the door.
        const u = clamp(this.t / C.ceremony.drop, 0, 1);
        mo.pos.lerpVectors(R.door, R.plinth, u * u);
        const floor = env.ground(R.plinth.x, R.plinth.z);
        mo.pos.y = lerp(R.door.y, floor, u * u);
        if (u >= 1) {
          this.hover.kick(-C.hover.landSquash * 1.3);
          const s = job.spots[0];
          this.ride = s.ride;
          mo.setPath(R.out, s.heading);
          this.setState("travel");
        }
        break;
      }
      case "travel":
        if (mo.settled) {
          job.action.start(0);
          this.setState("draw");
        }
        break;
      case "draw":
        this.runAction(dt);
        if (this.t >= C.blend.toolDraw) this.setState("work");
        break;
      case "work":
        this.runAction(dt);
        // A turn on the spot while working (to the paint can and back): the
        // tool stays solved, the body turns under it.
        if (f.faceHeading !== null) {
          if (this.faceSet !== f.faceHeading) {
            mo.setHeading(f.faceHeading);
            this.faceSet = f.faceHeading;
          }
        } else {
          this.faceSet = null;
        }
        if (f.moveTo) {
          this.ride = f.moveTo.ride;
          mo.setGoal(f.moveTo.stance, f.moveTo.heading);
          this.setState("move");
        } else if (f.done) {
          this.setState("stow");
        }
        break;
      case "move":
        if (mo.settled) {
          job.action.arrived();
          this.setState("work");
        }
        break;
      case "stow":
        if (this.t >= C.blend.toolStow) {
          this.inspectDur = rand(C.ceremony.inspectMin, C.ceremony.inspectMax);
          const s = job.spots[job.spot] ?? job.spots[0];
          _v.set(Math.sin(s.heading), 0, Math.cos(s.heading));
          _w.copy(mo.pos).addScaledVector(_v, -C.ceremony.stepBack);
          mo.setGoal(_w, s.heading, true);
          this.ride = 0;
          this.setState("inspect");
        }
        break;
      case "inspect":
        if (this.t >= this.inspectDur && mo.arrived) {
          // Home to the foot of the gate; near enough is fine, it is only a place to wait.
          mo.setPath(R.back(mo.pos), R.outHeading + Math.PI, 0.12);
          this.setState("leave");
        }
        break;
      case "leave":
        if (mo.arrived) this.setState("wait");
        break;
      case "wait":
        if (this.gateGranted) {
          mo.setPath(R.climb, R.outHeading + Math.PI);
          mo.slow = true; // the steps are climbed at a walk, from the approach on
          this.setState("climb");
        }
        break;
      case "climb":
        if (mo.arrived) {
          mo.slow = false;
          this.riseFrom.copy(mo.pos);
          this.setState("rise");
        }
        break;
      case "rise": {
        const u = clamp(this.t / (C.ceremony.drop + 0.1), 0, 1);
        mo.pos.lerpVectors(this.riseFrom, R.door, 1 - (1 - u) * (1 - u));
        const out = clamp((this.t - 0.15) / C.ceremony.fade, 0, 1);
        this.fade = 1 - out;
        this.flash = out > 0 && out < 1 ? bump(out) : 0;
        if (u >= 1 && out >= 1) this.finish();
        break;
      }
      case "vanish": {
        const u = clamp(this.t / 0.3, 0, 1);
        this.fade = 1 - u;
        this.flash = 0.6 * bump(u);
        if (u >= 1) this.finish();
        break;
      }
    }
    if ((this.state as PortletState) === "free") return; // finished this frame
    if (!this.actionRan) {
      resetFrame(f);
      f.hold = true;
    }
    this.animate(dt, env);
  }

  private runAction(dt: number) {
    const f = this.frame;
    resetFrame(f);
    this.job!.action.update(dt, f, {
      shoulder: this.shoulder,
      time: this.time,
      scale: this.rig.scale,
      heading: this.motion.heading,
      oriented: this.motion.oriented,
    });
    this.actionRan = true;
  }

  /* ---------------------------------------------------------------------- */

  private animate(dt: number, env: PortletEnv) {
    const mo = this.motion;
    const f = this.frame;
    const rig = this.rig;
    const G = C.gait;
    const H = C.hover;
    const time = this.time;
    const T = this.target;
    const run = mo.strideAmp;
    const swing = Math.sin(mo.stride) * run;
    const carrying = this.toolS > 0.5;

    // ---- The pose this state wants.
    T.lift = 0;
    T.bodyPitch = G.lean * clamp(mo.speed / C.locomotion.maxSpeed, 0, 1) + 0.02 * Math.sin(time * 1.1 + this.phases.sway);
    T.bodyYaw = G.sway * swing;
    T.bodyRoll = 0.03 * swing * run + 0.012 * Math.sin(time * 0.8 + this.phases.sway);
    T.headPitch = -0.05 * run + (mo.airborne ? -0.12 : 0);
    T.headYaw = 0;
    T.armLx = G.armSwing * swing;
    T.armLz = -0.1;
    T.armRx = carrying ? -0.55 - 0.2 * swing * run : -G.armSwing * swing * 0.8;
    T.armRz = 0.12;
    T.legLx = G.legSwing * swing;
    T.legRx = -G.legSwing * swing;
    if (mo.airborne) {
      T.legLx = T.legRx = 0.45;
      T.armLz = -0.35;
      T.armRz = 0.35;
    }
    // Knees bend when the body is pressed down.
    const squat = clamp(-this.hover.x / 0.08, 0, 1);
    T.legLx += 0.45 * squat;
    T.legRx += 0.45 * squat;
    T.bodyPitch += 0.25 * squat;
    T.headPitch += 0.1 * squat;

    // Turning on the spot is stepped, not spun: the feet shuffle in time with
    // the turn, the weight shifts onto each, the torso leads the hips and
    // the head leads the torso toward the new heading.
    const Tn = C.turning;
    const shuffle = clamp(mo.turnRate * (1 - clamp(mo.speed / 0.3, 0, 1)), 0, 1);
    if (shuffle > 0.01) {
      const s = Math.sin(mo.turnStride);
      const dir = Math.sign(mo.angVel) || 1;
      T.legLx += Tn.shuffleSwing * s * shuffle;
      T.legRx -= Tn.shuffleSwing * s * shuffle;
      T.bodyRoll += Tn.weightShift * s * shuffle * dir;
      T.armLz -= 0.15 * shuffle;
      T.armRz += 0.15 * shuffle;
    }
    T.bodyYaw += Tn.torsoLead * (mo.angVel / Tn.maxAngVel);
    T.headYaw += clamp(mo.headingErr, -Tn.headLead, Tn.headLead) * (WORKING.has(this.state) ? 0.35 : 1);
    // Stepping up a riser: the leading leg lifts with the rise.
    if (mo.stepUp > 0) {
      const b = bump(mo.stepUp);
      if (mo.stepLeg > 0) T.legLx -= C.ground.climbLift * b;
      else T.legRx -= C.ground.climbLift * b;
      T.bodyPitch += 0.1 * b;
    }

    switch (this.state) {
      case "spawn":
      case "drop":
      case "rise":
        T.armLz = -0.3;
        T.armRz = 0.3;
        T.headPitch = -0.15;
        T.legLx += 0.15;
        T.legRx += 0.15;
        break;
      case "inspect": {
        const u = clamp(this.t / this.inspectDur, 0, 1);
        T.headPitch = -0.28 + 0.4 * (0.5 - 0.5 * Math.cos(u * TAU * 0.8)) + (u > 0.82 ? 0.1 * Math.sin((u - 0.82) * 34) : 0);
        T.armLx = -0.35;
        T.armLz = -0.3;
        T.armRx = -0.3;
        T.armRz = 0.3;
        T.bodyPitch += 0.05;
        break;
      }
      case "wait": {
        T.headYaw = 0.5 * Math.sin((this.t * TAU) / C.ceremony.waitLook);
        T.headPitch = -0.08;
        T.armLx = -0.4;
        T.armLz = -0.3;
        break;
      }
      default:
        break;
    }
    if (WORKING.has(this.state)) {
      for (const k of POSE_KEYS) {
        const v = f.pose[k];
        if (v !== undefined && k !== "lift") T[k] = v;
      }
      // The head follows the tool's tip.
      if (f.lookAtTip && this.toolW > 0.3 && !f.hold) {
        rig.parts.head.getWorldPosition(_v);
        rig.parts.bodyG.getWorldQuaternion(_q).invert();
        _d.copy(f.tip).sub(_v).applyQuaternion(_q);
        const yaw = clamp(Math.atan2(_d.x, _d.z), -0.8, 0.8);
        const pitch = clamp(-Math.atan2(_d.y, Math.hypot(_d.x, _d.z)), -0.35, 0.85);
        T.headYaw = lerp(T.headYaw, yaw, this.toolW);
        T.headPitch = lerp(T.headPitch, pitch, this.toolW);
      }
    }
    // Hard caps: a reach is arm, not spine, and the face stays up.
    T.bodyPitch = clamp(T.bodyPitch, -0.25, C.reach.maxTorsoPitch);
    T.headPitch = clamp(T.headPitch, -0.45, C.reach.maxHeadPitch);

    // ---- Blend from the previous state's pose, then smooth.
    if (this.blendT < 1) {
      this.blendT = Math.min(1, this.blendT + dt / C.blend.state);
      const w = smoothstep(this.blendT);
      for (const k of POSE_KEYS) T[k] = lerp(this.blendFrom[k], T[k], w);
    }
    const fp = chase(C.blend.pose, dt);
    const P = this.pose;
    for (const k of POSE_KEYS) P[k] += (T[k] - P[k]) * fp;

    // ---- Ride height: a critically damped spring with layered idle noise,
    //      dipping into acceleration, rising out of it, kicked by landings
    //      and blows.
    const [j1, j2] = H.jitterHz;
    let ride =
      H.bobAmp * Math.sin(TAU * H.bobHz * time + this.phases.bob) +
      H.jitterAmp * (Math.sin(TAU * j1 * time + this.phases.j1) + 0.6 * Math.sin(TAU * j2 * time + this.phases.j2)) -
      H.accelDip * clamp(mo.accelFwd / C.locomotion.accel, 0, 1) +
      H.decelRise * clamp(-mo.accelFwd / C.locomotion.decel, 0, 1) -
      H.shuffleBob * Math.abs(Math.sin(mo.turnStride)) * shuffle;
    if (WORKING.has(this.state)) ride += this.ride + (f.pose.lift ?? 0);
    if (mo.landed > 0) this.hover.kick(-H.landSquash * mo.landed);
    if (f.recoil > 0) this.hover.kick(f.recoil);
    this.hover.step(ride, dt);

    // ---- Onto the rig.
    const root = rig.root;
    root.position.set(mo.pos.x + this.nudgeX.x, mo.pos.y + this.hover.x, mo.pos.z + this.nudgeZ.x);
    root.rotation.set(0, mo.heading, mo.roll.x);
    const parts = rig.parts;
    const rest = rig.rest;
    setRot(parts.bodyG, rest.bodyG, P.bodyPitch, P.bodyYaw, P.bodyRoll);
    setRot(parts.head, rest.head, P.headPitch, P.headYaw, 0);
    setRot(parts.armL, rest.armL, P.armLx, 0, P.armLz);
    setRot(parts.armR, rest.armR, P.armRx, 0, P.armRz);
    setRot(parts.legL, rest.legL, P.legLx, 0, 0);
    setRot(parts.legR, rest.legR, P.legRx, 0, 0);
    setRot(parts.bobble, rest.bobble, -P.headPitch * 1.2 - 0.2 * run, 0, -P.bodyRoll * 1.5 + 0.05 * Math.sin(time * 9 + this.slot));
    if (time > this.blinkAt) {
      this.blinkUntil = time + 0.12;
      this.blinkAt = time + 2 + Math.random() * 3;
    }
    parts.eyes.scale.y = time < this.blinkUntil ? 0.12 : 1;

    // Materialising: opacity and a little pop.
    const solid = this.fade > 0.995;
    rig.material.opacity = this.fade;
    rig.material.transparent = !solid;
    root.visible = this.fade > 0.02;
    const sc = rig.scale * (0.75 + 0.25 * this.fade);
    rig.inner.scale.setScalar(sc);
    rig.inner.position.y = -rig.minY * sc;

    this.placeTool(dt, env);
  }

  /* ---------------------------------------------------------------------- */

  private placeTool(dt: number, env: PortletEnv) {
    const tool = this.tool!;
    const f = this.frame;
    const rig = this.rig;
    const scale = rig.scale;
    const st = this.state;

    // How much of the tool shows, and how much of it is solved from the contact.
    let wantS = 0;
    if (st === "draw") wantS = smoothstep(this.t / C.blend.toolDraw);
    else if (st === "work" || st === "move") wantS = 1;
    else if (st === "stow") wantS = 1 - smoothstep(this.t / C.blend.toolStow);
    const wantW = st === "draw" ? smoothstep(this.t / C.blend.toolDraw) : st === "work" && !f.hold ? 1 : 0;
    this.toolS += (wantS - this.toolS) * chase(14, dt);
    this.toolW += (wantW - this.toolW) * chase(11, dt);
    if (wantS === 0 && this.toolS < 0.02) this.toolS = 0;
    if (wantW === 0 && this.toolW < 0.01) this.toolW = 0;

    rig.root.updateMatrixWorld(true);
    rig.parts.armR.getWorldPosition(this.shoulder);
    if (this.toolS <= 0.001) {
      tool.group.visible = false;
      this.nudgeX.step(0, dt);
      this.nudgeZ.step(0, dt);
      return;
    }
    tool.group.visible = true;

    const solving = this.toolW > 0.001 && !f.hold;
    let nx = 0;
    let nz = 0;
    if (solving) {
      // The tool from the contact: axis into the surface, tip on the point.
      toolQuaternion(_q, tool, f.normal, f.tip, this.shoulder, f.rollAngle);
      this.tipOff.copy(tool.tip).multiplyScalar(scale);
      if (f.squash > 0) this.tipOff.addScaledVector(tool.axis, -f.squash * this.tipOff.dot(tool.axis));
      this.tipOff.applyQuaternion(_q);
      this.grip.copy(f.tip).sub(this.tipOff);
      this.solvedQ.copy(_q);
      if (f.swing !== 0) {
        // Swing about the grip so the tip arcs off the surface.
        _h.set(0, 1, 0).applyQuaternion(_q);
        _ax.crossVectors(f.normal, _h);
        if (_ax.lengthSq() > 1e-4) {
          _qs.setFromAxisAngle(_ax.normalize(), f.swing);
          this.solvedQ.premultiply(_qs);
        }
      }
      this.solvedPos.copy(this.grip);
      // Lean in (or back) by whatever the arm cannot cover, capped.
      _d.copy(this.grip).sub(this.shoulder);
      const e = _d.length() - this.m.armLen;
      _d.y = 0;
      if (_d.lengthSq() > 1e-8) {
        _d.normalize();
        const n = clamp(e, -C.reach.maxNudge, C.reach.maxNudge) * this.toolW;
        nx = _d.x * n;
        nz = _d.z * n;
      }
    }
    this.nudgeX.step(nx, dt);
    this.nudgeZ.step(nz, dt);
    rig.root.position.x = this.motion.pos.x + this.nudgeX.x;
    rig.root.position.z = this.motion.pos.z + this.nudgeZ.x;
    rig.root.updateMatrixWorld(true);
    rig.parts.armR.getWorldPosition(this.shoulder);

    if (solving) {
      // The arm aims at the grip; blended with the pose's arm by the solve weight.
      _d.copy(this.grip).sub(this.shoulder).normalize();
      rig.parts.bodyG.getWorldQuaternion(_q2);
      _w.copy(FWD).applyQuaternion(_q2);
      frameQuaternion(_q, DOWN, FWD, _d, _w);
      _q2.invert().multiply(_q);
      rig.parts.armR.quaternion.slerp(_q2, this.toolW);
      rig.root.updateMatrixWorld(true);
    }

    // Carried: the grip sits in the hand socket with the tool's own offset.
    rig.hand.matrixWorld.decompose(this.carriedPos, this.carriedQ, _s);
    _carryQ.setFromEuler(tool.carry.rotation);
    _v.copy(tool.carry.position).multiplyScalar(scale).applyQuaternion(this.carriedQ);
    this.carriedPos.add(_v);
    this.carriedQ.multiply(_carryQ);

    const g = tool.group;
    if (solving) {
      g.position.lerpVectors(this.carriedPos, this.solvedPos, this.toolW);
      g.quaternion.copy(this.carriedQ).slerp(this.solvedQ, this.toolW);
    } else {
      g.position.copy(this.carriedPos);
      g.quaternion.copy(this.carriedQ);
    }
    const base = scale * this.toolS;
    const sq = solving ? f.squash * this.toolW : 0;
    g.scale.set(base * (1 - sq * Math.abs(tool.axis.x)), base * (1 - sq * Math.abs(tool.axis.y)), base * (1 - sq * Math.abs(tool.axis.z)));
    tool.tick?.(dt, f.working * this.toolW, this.time);

    // Debug: where the tip and probes actually are, and whether any is inside the letter.
    g.updateMatrixWorld(true);
    this.tipWorld.copy(tool.tip).applyMatrix4(g.matrixWorld);
    const n = Math.min(tool.probes.length, this.probesWorld.length);
    for (let i = 0; i < n; i++) this.probesWorld[i].copy(tool.probes[i]).applyMatrix4(g.matrixWorld);
    if (env.checkPenetration && solving && this.toolW > 0.95 && this.job) {
      this.checked = true;
      const mesh = this.job.mesh;
      let bad = insideLetter(mesh, this.tipWorld, f.normal) ? "tip" : "";
      for (let i = 0; i < n && !bad; i++) if (insideLetter(mesh, this.probesWorld[i], f.normal)) bad = `probe ${i}`;
      this.penetrating = !!bad;
      if (bad) {
        const spot = this.job.spots[this.job.spot];
        console.warn(
          `[portlets] ${tool.id} ${bad} inside letter ${this.job.letter} (${this.job.action.kind}, ${spot?.contact.face ? "face" : "wall"}, swing ${f.swing.toFixed(2)}, roll ${f.rollAngle.toFixed(2)}, squash ${f.squash.toFixed(2)})`,
        );
      }
    }
    // The can: only the bristles go under the paint, and nothing touches the tin.
    if (env.checkPenetration && solving && this.toolW > 0.95 && f.can) {
      const c = f.can;
      this.checked = true;
      const test = (p: THREE.Vector3, isTip: boolean) => {
        const r = Math.hypot(p.x - c.centre.x, p.z - c.centre.z);
        // Only points within the tin's own footprint can meet it.
        if (p.y < c.rimY && r < c.innerR + 0.012) {
          if (r > c.innerR - 0.001) return "the tin's wall";
          if (p.y < c.bottomY + 0.004) return "the tin's bottom";
          if (isTip && p.y < c.paintY - c.maxUnder) return "too deep in the paint";
        }
        return "";
      };
      let bad = test(this.tipWorld, true);
      for (let i = 0; i < n && !bad; i++) bad = test(this.probesWorld[i], false);
      if (bad) {
        this.penetrating = true;
        console.warn(`[portlets] ${tool.id} met ${bad} (${this.job?.action.describe()})`);
      }
    }
  }
}
