/* eslint-disable react-hooks/immutability -- the world object is frame-rate state mutated on purpose; see world.js */
/* ============================================================================
   PLAYER — movement, collision, ground, the camera rig
   ----------------------------------------------------------------------------
   Camera-relative walking (W along the view, A/D strafe), a circle-vs-box
   push-out against every collider on the XZ plane, ground height from the
   terrain function or a room's override, and a third-person camera that
   tightens to over-the-shoulder inside a house and is clamped to the room
   so it never sees through a wall. The body is whatever children are given
   (the philosopher, once he is in); this component only moves the group.
   ========================================================================== */
import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { allColliders, groundUnder, useGame } from './world';
import { groundY, houseContaining, houseInterior, HOUSES, SEA } from './layout';
import { audio } from './audio';

const R = 0.38;
const WALK = 2.7; // he is 1.2 m tall; 2.7 m/s reads as a brisk walk
const RUN = 4.6;
const HEAD = 1.1; // he is 1.2 m tall

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerpAngle = (a, b, t) => {
  let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
};

/* Push a circle of radius R at pos out of every box it overlaps. Boxes with
   a y-range that clears the body are ignored (lintels, high shelves). */
function resolve(pos, colliders) {
  for (const c of colliders) {
    if (c.y0 !== undefined && (c.y0 > pos.y + 1.3 || c.y1 < pos.y + 0.25)) continue;
    const cx = clamp(pos.x, c.x0, c.x1);
    const cz = clamp(pos.z, c.z0, c.z1);
    const dx = pos.x - cx;
    const dz = pos.z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 >= R * R) continue;
    if (d2 < 1e-9) {
      const l = pos.x - c.x0;
      const r = c.x1 - pos.x;
      const f = pos.z - c.z0;
      const b = c.z1 - pos.z;
      const m = Math.min(l, r, f, b);
      if (m === l) pos.x = c.x0 - R;
      else if (m === r) pos.x = c.x1 + R;
      else if (m === f) pos.z = c.z0 - R;
      else pos.z = c.z1 + R;
    } else {
      const d = Math.sqrt(d2);
      pos.x = cx + (dx / d) * R;
      pos.z = cz + (dz / d) * R;
    }
  }
}

const fwd = new THREE.Vector3();
const right = new THREE.Vector3();
const vel = new THREE.Vector3();
const target = new THREE.Vector3();
const eye = new THREE.Vector3();

export function Player({ children }) {
  const { world } = useGame();
  const group = useRef();
  const camPos = useRef(null);
  const lastStep = useRef(0);
  const { camera } = useThree();

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const { player: p, camera: cam, input } = world;
    world.clock += dt;
    world.frame += 1;

    /* ── look ─────────────────────────────────────────────────────────── */
    cam.yaw -= input.yawDelta;
    cam.pitch = clamp(cam.pitch + input.pitchDelta, 0.06, 1.25);
    input.yawDelta = 0;
    input.pitchDelta = 0;
    const keys = input.keys;
    if (!input.locked) {
      if (keys.has('arrowleft')) cam.yaw += 1.9 * dt;
      if (keys.has('arrowright')) cam.yaw -= 1.9 * dt;
    }

    /* ── walk ─────────────────────────────────────────────────────────── */
    let f = 0;
    let s = 0;
    if (!input.locked) {
      if (keys.has('w') || keys.has('arrowup')) f += 1;
      if (keys.has('s') || keys.has('arrowdown')) f -= 1;
      if (keys.has('a')) s -= 1;
      if (keys.has('d')) s += 1;
    }
    fwd.set(Math.sin(cam.yaw), 0, Math.cos(cam.yaw));
    right.set(-Math.cos(cam.yaw), 0, Math.sin(cam.yaw));
    vel.set(0, 0, 0).addScaledVector(fwd, f).addScaledVector(right, s);
    const wants = vel.lengthSq() > 0;
    if (wants) vel.normalize();
    const maxSpeed = keys.has('shift') ? RUN : WALK;
    const targetSpeed = wants ? maxSpeed : 0;
    p.speed += (targetSpeed - p.speed) * (1 - Math.pow(wants ? 0.0005 : 0.00001, dt));
    if (p.speed < 0.02) p.speed = 0;
    p.moving = p.speed > 0.05;

    if (wants) {
      p.pos.addScaledVector(vel, p.speed * dt);
      p.heading = lerpAngle(p.heading, Math.atan2(vel.x, vel.z), 1 - Math.pow(0.00002, dt));
    } else if (p.speed > 0) {
      // coast along the last heading
      p.pos.x += Math.sin(p.heading) * p.speed * dt;
      p.pos.z += Math.cos(p.heading) * p.speed * dt;
    }
    resolve(p.pos, allColliders(world));

    /* ── ground ───────────────────────────────────────────────────────── */
    const gy = groundUnder(world, p.pos.x, p.pos.z, groundY);
    p.pos.y += (gy - p.pos.y) * (1 - Math.pow(0.000001, dt));
    if (Math.abs(gy - p.pos.y) < 0.002) p.pos.y = gy;

    /* ── footsteps ────────────────────────────────────────────────────── */
    if (p.moving) {
      p.walkPhase += dt * p.speed * 2.7;
      const half = Math.floor(p.walkPhase / Math.PI);
      if (half !== lastStep.current) {
        lastStep.current = half;
        audio.footstep(p.speed > WALK + 0.5);
      }
    } else {
      // settle the legs back to standing
      const rest = Math.round(p.walkPhase / Math.PI) * Math.PI;
      p.walkPhase += (rest - p.walkPhase) * (1 - Math.pow(0.001, dt));
    }

    /* ── where he is ──────────────────────────────────────────────────── */
    p.house = houseContaining(p.pos.x, p.pos.z);
    cam.mode = p.house ? 'room' : 'outside';
    audio.setSeaLevel(clamp(1 - Math.abs(SEA.z - p.pos.z) / 30, 0, 1) * (p.house ? 0.25 : 1));

    /* ── body ─────────────────────────────────────────────────────────── */
    if (group.current) {
      group.current.position.copy(p.pos);
      group.current.rotation.y = p.heading;
    }

    /* ── camera ───────────────────────────────────────────────────────── */
    target.set(p.pos.x, p.pos.y + HEAD, p.pos.z);
    const inside = p.house ? HOUSES[p.house] : null;
    const dist = inside ? Math.min(cam.dist, 4.4) : cam.dist;
    const pitch = inside ? Math.min(cam.pitch + 0.16, 1.25) : cam.pitch;
    eye.copy(target)
      .addScaledVector(fwd, -dist * Math.cos(pitch))
      .add(new THREE.Vector3(0, dist * Math.sin(pitch), 0));
    if (inside) {
      const i = houseInterior(inside);
      eye.x = clamp(eye.x, i.x0 + 0.35, i.x1 - 0.35);
      eye.z = clamp(eye.z, i.z0 + 0.35, i.z1 - 0.35);
      eye.y = clamp(eye.y, p.pos.y + 0.7, i.y1 - 0.35);
    } else {
      eye.y = Math.max(eye.y, groundY(eye.x, eye.z) + 0.55);
    }
    if (!camPos.current) camPos.current = eye.clone();
    else camPos.current.lerp(eye, 1 - Math.pow(0.0008, dt));
    camera.position.copy(camPos.current);
    camera.lookAt(target);
  });

  return <group ref={group}>{children}</group>;
}
