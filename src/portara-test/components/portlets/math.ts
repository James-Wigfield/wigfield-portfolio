/** Small maths shared by the portlets: easing, randomness, angles, springs. */
import * as THREE from "three";

export const clamp = THREE.MathUtils.clamp;
export const lerp = THREE.MathUtils.lerp;
export const TAU = Math.PI * 2;

export const rand = (a: number, b: number) => a + Math.random() * (b - a);
export const randInt = (a: number, b: number) => Math.floor(rand(a, b + 1));
export const pick = <T>(xs: readonly T[]) => xs[Math.floor(Math.random() * xs.length)];
export const chance = (p: number) => Math.random() < p;

export const smoothstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * (3 - 2 * x);
};
export const smootherstep = (t: number) => {
  const x = clamp(t, 0, 1);
  return x * x * x * (x * (x * 6 - 15) + 10);
};
export const easeIn = (t: number) => clamp(t, 0, 1) ** 2;
export const easeOut = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 2;
export const easeInCubic = (t: number) => clamp(t, 0, 1) ** 3;
export const easeOutCubic = (t: number) => 1 - (1 - clamp(t, 0, 1)) ** 3;
export const easeOutBack = (t: number, k = 1.4) => {
  const x = clamp(t, 0, 1) - 1;
  return 1 + x * x * ((k + 1) * x + k);
};
/** 0 -> 1 -> 0 over t in 0..1, a rounded bump. */
export const bump = (t: number) => Math.sin(Math.PI * clamp(t, 0, 1));

/** Shortest signed difference from a to b, in (-pi, pi]. */
export function angleDiff(a: number, b: number) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
export const lerpAngle = (a: number, b: number, f: number) => a + angleDiff(a, b) * f;

/** 1 - exp(-rate*dt): the per-frame factor for an exponential chase. */
export const chase = (rate: number, dt: number) => 1 - Math.exp(-rate * dt);

/**
 * A damped spring (critically damped by default). Semi-implicit Euler,
 * substepped so a long frame cannot blow it up.
 */
export class Spring {
  x = 0;
  v = 0;
  constructor(
    public omega: number,
    public zeta = 1,
  ) {}
  reset(x: number) {
    this.x = x;
    this.v = 0;
    return this;
  }
  step(target: number, dt: number) {
    const n = Math.max(1, Math.ceil((this.omega * dt) / 0.4));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -2 * this.zeta * this.omega * this.v - this.omega * this.omega * (this.x - target);
      this.v += a * h;
      this.x += this.v * h;
    }
    return this.x;
  }
  kick(impulse: number) {
    this.v += impulse;
  }
}

/** A quaternion that maps a local frame (axis, up) onto a world frame. */
const _m1 = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _a = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
export function frameQuaternion(
  out: THREE.Quaternion,
  localAxis: THREE.Vector3,
  localUp: THREE.Vector3,
  worldAxis: THREE.Vector3,
  worldUp: THREE.Vector3,
) {
  // World basis: axis, up made perpendicular, and their cross.
  _a.copy(worldAxis).normalize();
  _b.copy(worldUp).addScaledVector(_a, -_a.dot(worldUp));
  if (_b.lengthSq() < 1e-8) _b.set(0, 1, 0).addScaledVector(_a, -_a.y);
  if (_b.lengthSq() < 1e-8) _b.set(1, 0, 0).addScaledVector(_a, -_a.x);
  _b.normalize();
  _c.crossVectors(_a, _b);
  _m1.makeBasis(_a, _b, _c);
  // Local basis the same way, then world = M1 * M2^-1.
  _a.copy(localAxis).normalize();
  _b.copy(localUp).addScaledVector(_a, -_a.dot(localUp)).normalize();
  _c.crossVectors(_a, _b);
  _m2.makeBasis(_a, _b, _c);
  _q.setFromRotationMatrix(_m2).invert();
  out.setFromRotationMatrix(_m1).multiply(_q);
  return out;
}

/** The part of v perpendicular to unit n. */
export function perp(out: THREE.Vector3, v: THREE.Vector3, n: THREE.Vector3) {
  return out.copy(v).addScaledVector(n, -n.dot(v));
}

/** Heading (yaw about y) of a horizontal direction; +z is 0, +x is +90deg. */
export const headingOf = (x: number, z: number) => Math.atan2(x, z);
