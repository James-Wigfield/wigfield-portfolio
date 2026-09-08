/**
 * Where to stand so the tool's tip lands on a contact.
 *
 * Given the contact P and normal N (world), the tool's tip offset and roll
 * rule give the GRIP G (where the hand must be). The shoulder S then has to be
 * one arm's length from G, at shoulder height give or take a squat or a
 * stretch, with the body centre clear of the word's footprint. Approach
 * directions are tried in order of how well they face the contact: straight
 * from the front, from the front at an angle, and from either side (which
 * only ever clears the footprint for the end letters). The result is the
 * stance (feet), the heading, and the ride-height offset that made the reach.
 *
 * Nothing about the tool is hard-coded here: the standoff comes out of the
 * tool's own tip vector, scaled with the portlet.
 */
import * as THREE from "three";
import { PORTLET_CONFIG as C } from "./config";
import { clamp, frameQuaternion, headingOf, perp } from "./math";
import type { ToolSpec } from "./tools";
import type { Stance } from "./types";

/** Measured from the rig at rest, world units. */
export type Measure = { shoulderH: number; armLen: number; shoulderSide: number; shoulderFwd: number };

/** The word's horizontal frame and footprint, world units. */
export type WordFrame = {
  origin: THREE.Vector3;
  right: THREE.Vector3;
  front: THREE.Vector3;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

const UP = new THREE.Vector3(0, 1, 0);
const _ref = new THREE.Vector3();
const _axis = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _tip = new THREE.Vector3();
const _a = new THREE.Vector3();
const _f = new THREE.Vector3();
const _r = new THREE.Vector3();
const _S = new THREE.Vector3();
const _G = new THREE.Vector3();
const _B = new THREE.Vector3();
const _Nh = new THREE.Vector3();
const _d = new THREE.Vector3();

/** The tool's orientation for a contact: axis into the surface, roll from
    the rule (`rollAngle` added about the normal). */
export function toolQuaternion(
  out: THREE.Quaternion,
  tool: ToolSpec,
  N: THREE.Vector3,
  P: THREE.Vector3,
  shoulder: THREE.Vector3,
  rollAngle = 0,
) {
  if (tool.roll === "shoulder") perp(_ref, _a.copy(shoulder).sub(P), N);
  else perp(_ref, UP, N);
  if (_ref.lengthSq() < 1e-6) perp(_ref, UP, N);
  if (_ref.lengthSq() < 1e-6) perp(_ref, _a.set(1, 0, 0), N);
  _ref.normalize();
  if (rollAngle) _ref.applyAxisAngle(N, rollAngle);
  _axis.copy(N).negate();
  return frameQuaternion(out, tool.axis, tool.up, _axis, _ref);
}

/** Where the hand must be for the tip to sit on P. */
export function gripFor(out: THREE.Vector3, tool: ToolSpec, scale: number, N: THREE.Vector3, P: THREE.Vector3, shoulder: THREE.Vector3) {
  toolQuaternion(_q, tool, N, P, shoulder);
  _tip.copy(tool.tip).multiplyScalar(scale).applyQuaternion(_q);
  return out.copy(P).sub(_tip);
}

function clear(B: THREE.Vector3, w: WordFrame, c: number) {
  _d.copy(B).sub(w.origin);
  const bx = _d.dot(w.right);
  const bz = _d.dot(w.front);
  if (bz < w.minZ - c) return false; // never behind the word
  const outsideX = bx < w.minX - c || bx > w.maxX + c;
  const inFront = bz > w.maxZ + c;
  return inFront || outsideX;
}

export function solveStance(P: THREE.Vector3, N: THREE.Vector3, tool: ToolSpec, scale: number, m: Measure, w: WordFrame): Stance | null {
  const R = C.reach;
  const L = m.armLen * 0.97;
  _Nh.set(N.x, 0, N.z);
  const nh = _Nh.length();
  if (nh > 1e-4) _Nh.divideScalar(nh);

  // Approach directions (from the contact toward where the body stands),
  // best-facing first; the front gets a bonus so it wins whenever it faces
  // the contact at all.
  const scored: { v: THREE.Vector3; s: number }[] = [];
  const push = (v: THREE.Vector3, bonus = 0) => {
    const u = v.clone().setY(0).normalize();
    scored.push({ v: u, s: (nh > 0.3 ? u.dot(_Nh) : 0) + bonus });
  };
  push(w.front, 0.35);
  push(_a.copy(w.front).applyAxisAngle(UP, 0.55), 0.1);
  push(_a.copy(w.front).applyAxisAngle(UP, -0.55), 0.1);
  if (nh > 0.3) push(_a.copy(w.front).lerp(_Nh, 0.7));
  push(w.right);
  push(_a.copy(w.right).negate());
  scored.sort((p, q) => q.s - p.s);
  const approaches = scored.map((x) => x.v);

  for (const a of approaches) {
    if (nh > 0.3 && a.dot(_Nh) < -0.2) continue; // would have to reach round the back of the surface
    _f.copy(a).negate();
    _r.crossVectors(UP, _f).normalize();
    // First guess of the shoulder fixes the tool's roll; one refinement after.
    _S.copy(P).addScaledVector(a, 0.15).addScaledVector(_r, m.shoulderSide);
    _S.y = m.shoulderH;
    let ok = false;
    let ride = 0;
    for (let iter = 0; iter < 2; iter++) {
      gripFor(_G, tool, scale, N, P, _S);
      // The smallest standoff that keeps the body clear of the word.
      let hx = -1;
      for (let d = 0.02; d <= L; d += 0.01) {
        _B.copy(_G).addScaledVector(a, d).addScaledVector(_r, -m.shoulderSide).addScaledVector(_f, -m.shoulderFwd);
        _B.y = 0;
        if (clear(_B, w, R.bodyClearance)) {
          hx = d;
          break;
        }
      }
      if (hx < 0) {
        ok = false;
        break;
      }
      const dyMax = Math.sqrt(Math.max(0, L * L - hx * hx));
      const lo = Math.max(_G.y - dyMax, m.shoulderH - R.squat);
      const hi = Math.min(_G.y + dyMax, m.shoulderH + R.stretch);
      if (lo > hi) {
        ok = false;
        break;
      }
      const Sy = clamp(m.shoulderH, lo, hi);
      const hxReal = Math.sqrt(Math.max(hx * hx, L * L - (Sy - _G.y) * (Sy - _G.y)));
      _S.copy(_G).addScaledVector(a, hxReal);
      _S.y = Sy;
      ride = Sy - m.shoulderH;
      ok = true;
    }
    if (!ok) continue;
    _B.copy(_S).addScaledVector(_r, -m.shoulderSide).addScaledVector(_f, -m.shoulderFwd);
    _B.y = 0;
    if (!clear(_B, w, R.bodyClearance * 0.98)) continue;
    return { stance: _B.clone(), heading: headingOf(_f.x, _f.z), ride };
  }
  return null;
}
