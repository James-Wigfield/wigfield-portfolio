/**
 * How a portlet moves: a steering model, not a lerp.
 *
 * Each frame a DESIRED VELOCITY is worked out (toward a point a little way
 * ahead along the path, at a speed that falls off toward the goal and round
 * tight bends, pushed sideways away from anyone too close), the change from
 * the current velocity is CAPPED by an acceleration limit, and the velocity
 * moves the position. Nothing ever snaps: a new target just bends the
 * velocity toward it, and the last step lands on the point exactly.
 *
 * FACING is separate. The heading chases the direction of travel with its
 * own angular velocity, capped, damped, and eased out into the heading (never
 * faster than `angDecel` can stop in the angle left). Anything under
 * `turnInPlace` is an arc: they curve into the new heading while moving. Only
 * a near-reversal is made standing still, eased in over `ramp`, and the body
 * STEPS through it: `turnStride` advances with the angle turned so the feet
 * shuffle in time, and `headingErr` lets the head lead. The body BANKS into
 * moving turns and springs back level.
 *
 * The GROUND is sampled by raycast at both feet and both toes (the toes
 * looked ahead by a little travel), and the body follows the HIGHEST sample
 * with a spring, so they step UP onto each stair before the foot reaches its
 * edge rather than gliding through it; a rise of `stepMin` or more raises
 * `stepUp` for the climb animation. Walking off an edge is a ballistic drop,
 * and landings report their speed so the body can squash.
 *
 * The GAIT phase advances with ground speed over stride length, so the feet
 * never skate, and settles to feet-together when stopped.
 */
import * as THREE from "three";
import { PORTLET_CONFIG } from "./config";
import { angleDiff, chase, clamp, headingOf, smoothstep, Spring, TAU } from "./math";

export type GroundFn = (x: number, z: number) => number;

const _a = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _sep = new THREE.Vector3();
const _want = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _look = new THREE.Vector3();

export class Motion {
  /** Feet position (y is the body's base height over the ground). */
  pos = new THREE.Vector3();
  /** Horizontal velocity. */
  vel = new THREE.Vector3();
  heading = 0;
  angVel = 0;
  /** Bank roll, radians. */
  roll = new Spring(PORTLET_CONFIG.turning.bankSpring);
  speed = 0;
  /** Signed forward acceleration, smoothed. */
  accelFwd = 0;
  /** Gait phase (radians) and how much of the walk cycle shows (0..1). */
  stride = 0;
  strideAmp = 0;
  airborne = false;
  /** Set for one frame on landing: the vertical speed absorbed. */
  landed = 0;
  /** True while a near-reversal is made on the spot. */
  turning = false;
  /** Signed angle still to turn to where they want to face (rad). */
  headingErr = 0;
  /** 0..1 how hard they are turning (|angVel| over the cap). */
  turnRate = 0;
  /** Shuffle phase while turning on the spot: one foot per half cycle. */
  turnStride = 0;
  /** 0..1 progress of a step up onto a riser; 0 when not climbing. */
  stepUp = 0;
  /** Which leg leads the step: 1 left, -1 right. */
  stepLeg = 1;
  /** Ground under each foot this frame (world y), including the toe looked ahead. */
  groundL = 0;
  groundR = 0;
  /** Ground under each foot's centre only. */
  footL = 0;
  footR = 0;
  /** On or about to be on the steps: speed is capped. */
  stairs = false;
  /** Set by the portlet for a whole leg (the climb back up): take it slowly. */
  slow = false;
  /** Walking backwards (a step back to inspect). */
  reverse = false;
  /** Out in the scene (so others keep clear of it). Set by the portlet. */
  present = false;

  private vy = 0;
  private rise = new Spring(PORTLET_CONFIG.ground.riseOmega);
  private climbT = -1;
  private turnT = 0;
  private curve: THREE.CatmullRomCurve3 | null = null;
  private len = 0;
  private u = 0;
  private goal: THREE.Vector3 | null = null;
  private goalHeading: number | null = null;
  private arrivedFlag = true;
  private prevSpeed = 0;
  private tolerance = PORTLET_CONFIG.locomotion.stopRadius;
  private end = new THREE.Vector3();

  teleport(p: THREE.Vector3, heading: number) {
    this.pos.copy(p);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.angVel = 0;
    this.speed = 0;
    this.prevSpeed = 0;
    this.accelFwd = 0;
    this.vy = 0;
    this.airborne = false;
    this.rise.reset(p.y);
    this.climbT = -1;
    this.stepUp = 0;
    this.turnStride = 0;
    this.turnRate = 0;
    this.headingErr = 0;
    this.slow = false;
    this.roll.reset(0);
    this.clear();
  }

  /** Follow a smooth curve through these points (world), then face `heading`.
      `tolerance` is how close counts as arrived. */
  setPath(points: THREE.Vector3[], finalHeading: number | null = null, tolerance = PORTLET_CONFIG.locomotion.stopRadius) {
    const pts = [this.pos.clone(), ...points].map((p) => new THREE.Vector3(p.x, 0, p.z));
    // Drop points too close to their predecessor; Catmull-Rom hates them.
    const clean: THREE.Vector3[] = [pts[0]];
    for (const p of pts.slice(1)) if (p.distanceToSquared(clean[clean.length - 1]) > 0.02 * 0.02) clean.push(p);
    if (clean.length < 2) {
      this.setGoal(points[points.length - 1], finalHeading, false, tolerance);
      return;
    }
    this.curve = new THREE.CatmullRomCurve3(clean, false, "centripetal", 0.5);
    this.curve.arcLengthDivisions = 200;
    this.len = this.curve.getLength();
    this.u = 0;
    this.goal = null;
    this.end.copy(clean[clean.length - 1]);
    this.goalHeading = finalHeading;
    this.tolerance = tolerance;
    this.arrivedFlag = false;
    this.reverse = false;
  }

  /** Go straight to a point (world). `reverse` walks backwards keeping the given heading. */
  setGoal(point: THREE.Vector3, heading: number | null = null, reverse = false, tolerance = PORTLET_CONFIG.locomotion.stopRadius) {
    this.curve = null;
    this.goal = new THREE.Vector3(point.x, 0, point.z);
    this.end.copy(this.goal);
    this.goalHeading = heading;
    this.tolerance = tolerance;
    this.arrivedFlag = false;
    this.reverse = reverse;
  }

  /** Just turn to face this way. */
  setHeading(heading: number) {
    this.curve = null;
    this.goal = null;
    this.goalHeading = heading;
    this.arrivedFlag = true;
    this.reverse = false;
  }

  clear() {
    this.curve = null;
    this.goal = null;
    this.goalHeading = null;
    this.arrivedFlag = true;
    this.turning = false;
    this.reverse = false;
  }

  get arrived() {
    return this.arrivedFlag;
  }
  get oriented() {
    return this.goalHeading === null || (Math.abs(angleDiff(this.heading, this.goalHeading)) < 0.05 && Math.abs(this.angVel) < 0.25);
  }
  get settled() {
    return this.arrived && this.oriented && this.speed < 0.04;
  }

  /** Where they face, horizontal unit. */
  forward(out: THREE.Vector3) {
    return out.set(Math.sin(this.heading), 0, Math.cos(this.heading));
  }
  /** Their right, horizontal unit. */
  rightward(out: THREE.Vector3) {
    return out.set(Math.cos(this.heading), 0, -Math.sin(this.heading));
  }

  update(dt: number, others: readonly Motion[], ground: GroundFn) {
    const L = PORTLET_CONFIG.locomotion;
    const T = PORTLET_CONFIG.turning;
    const Hv = PORTLET_CONFIG.hover;
    const G = PORTLET_CONFIG.gait;
    const Gr = PORTLET_CONFIG.ground;

    // ---- Where to aim, and how far is left.
    let remaining = 0;
    let haveAim = false;
    const SHUFFLE = 0.2; // this close to the goal, small corrections are made without turning
    if (this.curve && !this.arrivedFlag) {
      // Advance along the curve to the nearest point in a window ahead.
      let best = this.u;
      let bestD = Infinity;
      for (let k = 0; k <= 14; k++) {
        const uu = Math.min(1, this.u + k * 0.01);
        this.curve.getPointAt(uu, _a);
        const d = _a.distanceToSquared(this.pos);
        if (d < bestD) {
          bestD = d;
          best = uu;
        }
      }
      this.u = best;
      remaining = (1 - this.u) * this.len;
      const end = this.end.distanceTo(this.pos);
      remaining = Math.max(remaining, end * 0.999);
      if (remaining < L.lookahead) _aim.copy(this.end);
      else this.curve.getPointAt(Math.min(1, this.u + L.lookahead / this.len), _aim);
      haveAim = true;
    } else if (this.goal && !this.arrivedFlag) {
      _aim.copy(this.goal);
      remaining = _aim.distanceTo(this.pos);
      haveAim = true;
    }
    const endDist = haveAim ? Math.hypot(this.end.x - this.pos.x, this.end.z - this.pos.z) : 0;
    const shuffling = haveAim && endDist < SHUFFLE;

    // ---- Desired velocity.
    _want.set(0, 0, 0);
    let moveHeading = this.heading;
    if (haveAim) {
      _dir.set(_aim.x - this.pos.x, 0, _aim.z - this.pos.z);
      if (_dir.lengthSq() < 1e-8) this.forward(_dir);
      _dir.normalize();
      moveHeading = this.reverse ? headingOf(-_dir.x, -_dir.z) : headingOf(_dir.x, _dir.z);
      const err = Math.abs(angleDiff(this.heading, moveHeading));
      // Only a near-reversal is made on the spot; everything else arcs.
      if (err > T.turnInPlace && this.speed < 0.25 && !shuffling) {
        if (!this.turning) this.turnT = 0;
        this.turning = true;
      }
      if (this.turning && (err < T.resume || shuffling)) this.turning = false;
      // Arrive: slow so that the deceleration limit brings them to rest on the point.
      const vArrive = Math.sqrt(2 * L.decel * Math.max(0, remaining - this.tolerance * 0.5));
      let v = Math.min(L.maxSpeed, vArrive);
      if (this.reverse) v = Math.min(v, L.maxSpeed * 0.45);
      if (this.stairs || this.slow) v = Math.min(v, Gr.stairSpeed); // stairs are taken one at a time
      if (this.turning) v = 0;
      else if (!shuffling) v *= 1 - L.cornerSlow * smoothstep(err / T.turnInPlace);
      // Give way: slow behind someone moving close ahead.
      for (const o of others) {
        if (o === this || !o.present || o.speed < 0.1) continue;
        _a.set(o.pos.x - this.pos.x, 0, o.pos.z - this.pos.z);
        const d = _a.length();
        if (d < L.sepRadius * 1.3 && d > 1e-4 && _a.dot(_dir) / d > 0.6) v = Math.min(v, Math.max(o.speed * L.followSlow, L.maxSpeed * 0.25));
      }
      _want.copy(_dir).multiplyScalar(v);
      // Separation: only the one on the move gives way, so nobody is shoved
      // off the spot they are working at.
      _sep.set(0, 0, 0);
      for (const o of others) {
        if (o === this || !o.present) continue;
        _a.set(this.pos.x - o.pos.x, 0, this.pos.z - o.pos.z);
        const d = _a.length();
        if (d < L.sepRadius && d > 1e-4) _sep.addScaledVector(_a, ((1 - d / L.sepRadius) * L.sepStrength) / d);
      }
      _want.add(_sep);
    } else {
      this.turning = false;
    }
    if (_want.length() > L.maxSpeed) _want.setLength(L.maxSpeed);

    // ---- Capped acceleration -> velocity -> position.
    _a.copy(_want).sub(this.vel);
    const dv = _a.length();
    if (dv > 1e-6) {
      const slowing = _want.lengthSq() < this.vel.lengthSq();
      const aMax = slowing ? L.decel : L.accel;
      this.vel.addScaledVector(_a, Math.min(1, (aMax * dt) / dv));
    }
    // The last step lands on the point exactly rather than past it.
    let landedOnGoal = false;
    if (haveAim && endDist <= Math.max(this.tolerance, this.speed * dt * 1.05)) {
      this.pos.x = this.end.x;
      this.pos.z = this.end.z;
      this.vel.set(0, 0, 0);
      landedOnGoal = true;
    } else {
      this.pos.x += this.vel.x * dt;
      this.pos.z += this.vel.z * dt;
    }
    this.speed = this.vel.length();
    const acc = dt > 0 ? (this.speed - this.prevSpeed) / dt : 0;
    this.accelFwd += (acc - this.accelFwd) * chase(10, dt);
    this.prevSpeed = this.speed;

    // ---- Arrival.
    if (haveAim && (landedOnGoal || (endDist < this.tolerance && this.speed < 0.08))) {
      this.arrivedFlag = true;
      this.curve = null;
      this.goal = null;
      this.turning = false;
    }

    // ---- Facing: chase the wanted heading with a capped, eased angular velocity.
    let wantHeading = this.heading;
    if (this.turning) wantHeading = moveHeading;
    else if (this.goalHeading !== null && (this.arrivedFlag || shuffling)) wantHeading = this.goalHeading;
    else if (this.speed > 0.08 && haveAim) wantHeading = this.reverse ? headingOf(-this.vel.x, -this.vel.z) : headingOf(this.vel.x, this.vel.z);
    else if (haveAim && this.speed > 0.02) wantHeading = moveHeading;
    const errSigned = angleDiff(this.heading, wantHeading);
    this.headingErr = errSigned;
    let angTarget = clamp(T.gain * errSigned, -T.maxAngVel, T.maxAngVel);
    // Ease out: never faster than angDecel can stop within the angle left.
    const stopCap = Math.sqrt(2 * T.angDecel * Math.abs(errSigned));
    angTarget = clamp(angTarget, -stopCap, stopCap);
    // Ease in when turning on the spot.
    if (this.turning) {
      this.turnT += dt;
      angTarget *= smoothstep(this.turnT / T.ramp);
    }
    this.angVel += (angTarget - this.angVel) * chase(T.damping, dt);
    this.heading = (this.heading + this.angVel * dt) % TAU;
    this.turnRate = clamp(Math.abs(this.angVel) / T.maxAngVel, 0, 1);
    // Shuffle steps while turning on the spot: one foot per shuffleStep of turn.
    if (this.speed < 0.2 && Math.abs(this.angVel) > 0.25) {
      this.turnStride += (Math.abs(this.angVel) * dt * Math.PI) / T.shuffleStep;
    } else {
      const rest = Math.round(this.turnStride / Math.PI) * Math.PI;
      this.turnStride += (rest - this.turnStride) * chase(8, dt);
    }

    // ---- Bank into moving turns, spring back.
    const bankTarget = -T.bank * (this.angVel / T.maxAngVel) * clamp(this.speed / (0.5 * L.maxSpeed), 0, 1);
    this.roll.step(bankTarget, dt);

    // ---- Ground: both feet and both toes, the toes looked ahead a little
    //      travel, the body on the highest.
    this.forward(_fwd);
    this.rightward(_right);
    if (this.speed > 0.05) _look.copy(this.vel).divideScalar(this.speed);
    else _look.copy(_fwd).multiplyScalar(this.reverse ? -1 : 1);
    const ahead = Gr.toe + this.speed * Gr.toeLookahead;
    const fx = _right.x * Gr.footSpread;
    const fz = _right.z * Gr.footSpread;
    const gL = ground(this.pos.x - fx, this.pos.z - fz);
    const gR = ground(this.pos.x + fx, this.pos.z + fz);
    const tL = ground(this.pos.x - fx + _look.x * ahead, this.pos.z - fz + _look.z * ahead);
    const tR = ground(this.pos.x + fx + _look.x * ahead, this.pos.z + fz + _look.z * ahead);
    this.footL = gL;
    this.footR = gR;
    this.groundL = Math.max(gL, tL);
    this.groundR = Math.max(gR, tR);
    const gBody = Math.max(this.groundL, this.groundR);
    // On the steps, or with a riser or an edge under the toes: slow down.
    const under = Math.max(gL, gR);
    this.stairs = this.pos.y > 0.02 || Math.abs(Math.max(tL, tR) - under) > Gr.stepMin || Math.abs(Math.min(tL, tR) - under) > Gr.stepMin;
    this.landed = 0;
    // The position may have been set from outside (dropped onto the plinth):
    // the rise spring follows it rather than pulling it back.
    if (!this.airborne && Math.abs(this.rise.x - this.pos.y) > 0.05) this.rise.reset(this.pos.y);
    if (!this.airborne) {
      if (gBody < this.pos.y - Gr.dropMin && Math.max(gL, gR) < this.pos.y - Gr.dropMin) {
        // Walked off an edge (both feet past it).
        this.airborne = true;
        this.vy = 0;
      } else {
        if (gBody > this.rise.x + Gr.stepMin && (this.climbT < 0 || this.climbT > Gr.climbTime * 0.7)) {
          // A riser ahead: step up, leading with the foot that is forward.
          this.climbT = 0;
          this.stepLeg = Math.sin(this.stride) >= 0 ? -1 : 1;
        }
        this.pos.y = this.rise.step(gBody, dt);
      }
    }
    if (this.airborne) {
      this.vy -= Hv.gravity * dt;
      this.pos.y += this.vy * dt;
      if (this.pos.y <= gBody && this.vy <= 0) {
        this.pos.y = gBody;
        this.rise.reset(gBody);
        this.airborne = false;
        this.landed = -this.vy;
        this.vy = 0;
      }
    }
    if (this.climbT >= 0) {
      this.climbT += dt;
      this.stepUp = clamp(this.climbT / Gr.climbTime, 0, 1);
      if (this.climbT >= Gr.climbTime) {
        this.climbT = -1;
        this.stepUp = 0;
      }
    }

    // ---- Gait, from ground speed.
    const ampTarget = this.airborne ? 0 : clamp(this.speed / (0.45 * L.maxSpeed), 0, 1);
    this.strideAmp += (ampTarget - this.strideAmp) * chase(9, dt);
    if (this.speed > 0.05 && !this.airborne) {
      this.stride += (this.speed / G.stride) * TAU * dt;
    } else {
      // Settle to feet together.
      const rest = Math.round(this.stride / Math.PI) * Math.PI;
      this.stride += (rest - this.stride) * chase(8, dt);
    }
  }
}
