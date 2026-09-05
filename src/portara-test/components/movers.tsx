/**
 * The crew: seven portlets who bring PORTARA out of the portal.
 *
 * The choreography itself lives in hero-3d.tsx (the Wordmark owns the
 * timeline, because it owns the letters); every frame it writes each runner's
 * feet position, heading, speed and a few pose weights into the shared Stage.
 * This component turns those into bodies: a fade-and-grow as they step out of
 * (and back into) the portal's plane, a walk whose stride follows the ground
 * actually covered (so nobody's legs ever windmill), arms overhead for the
 * carry, a squat to set the letter down, a pat on the letter, and an easy
 * stance between. Every joint chases its target with a little lag, so phases
 * blend without seams.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

import { PORTLET_MODEL } from "./portlets";

export const CREW = 7;
/** The runners' height, world units (the letters' cap is 0.64). */
export const RUNNER_H = 0.75;

/** What the choreography says about one runner, this frame. World space. */
export type Carrier = {
  x: number;
  z: number;
  /** Heading to face when standing still (radians about y). */
  yaw: number;
  /** World units per second actually covered, magnitude. */
  speed: number;
  /** Heading of travel, unit vector, meaningful while moving. */
  vx: number;
  vz: number;
  /** 0 arms down .. 1 arms overhead. */
  arms: number;
  /** 0 .. 1 crouch. */
  squat: number;
  /** 0 .. 1 the right arm out to pat the letter, with a nod. */
  pat: number;
  /** 0 not there .. 1 fully stepped out of the portal. */
  fade: number;
};
export type Stage = {
  /** 0 .. 1 how hard the portal is glowing (someone is stepping through). */
  flash: number;
  carriers: Carrier[];
};

export function makeStage(): Stage {
  return {
    flash: 0,
    carriers: Array.from({ length: CREW }, () => ({
      x: 0,
      z: 0,
      yaw: 0,
      speed: 0,
      vx: 0,
      vz: 1,
      arms: 0,
      squat: 0,
      pat: 0,
      fade: 0,
    })),
  };
}

type Pose = {
  lift: number;
  bodyPitch: number;
  bodyYaw: number;
  bodyRoll: number;
  headPitch: number;
  headYaw: number;
  armLx: number;
  armLz: number;
  armRx: number;
  armRz: number;
  legLx: number;
  legRx: number;
};
const REST: Pose = {
  lift: 0,
  bodyPitch: 0,
  bodyYaw: 0,
  bodyRoll: 0,
  headPitch: 0,
  headYaw: 0,
  armLx: 0,
  armLz: 0,
  armRx: 0,
  armRz: 0,
  legLx: 0,
  legRx: 0,
};

const lerp = THREE.MathUtils.lerp;
const clamp = THREE.MathUtils.clamp;
/** Shortest-way blend between two headings. */
function lerpAngle(a: number, b: number, f: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

type Part = THREE.Object3D | undefined;
type Runner = {
  inner: THREE.Object3D;
  scale: number;
  minY: number;
  parts: { bodyG: Part; head: Part; armL: Part; armR: Part; legL: Part; legR: Part; bobble: Part; eyes: Part };
  rest: Record<string, THREE.Euler>;
  mats: THREE.Material[];
  pose: Pose;
  yaw: number;
  stride: number;
  blinkAt: number;
  blinkUntil: number;
};

function setRot(part: Part, rest: THREE.Euler | undefined, x: number, y: number, z: number) {
  if (!part || !rest) return;
  part.rotation.set(rest.x + x, rest.y + y, rest.z + z);
}

export function Movers({ stage, animate }: { stage: React.MutableRefObject<Stage>; animate: boolean }) {
  const { scene } = useGLTF(PORTLET_MODEL);
  const roots = useRef<(THREE.Group | null)[]>([]);
  const clock = useRef(0);

  const crew = useMemo<Runner[]>(
    () =>
      Array.from({ length: CREW }, (_, i) => {
        const inner = scene.clone(true);
        // Own materials, so each one can fade through the portal's plane.
        const mats: THREE.Material[] = [];
        inner.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.material = (m.material as THREE.Material).clone();
          mats.push(m.material as THREE.Material);
        });
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        // A little variety in height, so the crew is not a row of clones.
        const h = RUNNER_H * (0.95 + 0.1 * (((i * 5) % 3) / 2));
        const scale = h / (box.max.y - box.min.y || 1);
        const part = (name: string) => inner.getObjectByName(name) ?? undefined;
        const parts = {
          bodyG: part("bodyG"),
          head: part("head"),
          armL: part("armL"),
          armR: part("armR"),
          legL: part("legL"),
          legR: part("legR"),
          bobble: part("bobble"),
          eyes: part("eyes"),
        };
        const rest: Record<string, THREE.Euler> = {};
        for (const [k, p] of Object.entries(parts)) if (p) rest[k] = p.rotation.clone();
        return {
          inner,
          scale,
          minY: box.min.y,
          parts,
          rest,
          mats,
          pose: { ...REST },
          yaw: 0,
          stride: i * 1.3,
          blinkAt: 1 + i * 0.6,
          blinkUntil: 0,
        };
      }),
    [scene],
  );

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    clock.current += step;
    const now = clock.current;
    crew.forEach((r, i) => {
      const root = roots.current[i];
      const k = stage.current.carriers[i];
      if (!root || !k) return;
      const there = k.fade > 0.02;
      root.visible = there;
      if (!there) return;

      // Stepping through the portal's plane: grow and solidify.
      const solid = k.fade > 0.995;
      for (const m of r.mats) {
        m.opacity = k.fade;
        m.transparent = !solid;
      }
      root.scale.setScalar(0.7 + 0.3 * k.fade);

      // Heading: the way of travel when moving, else where the choreography
      // says to look. Turned through smoothly.
      const want = k.speed > 0.25 ? Math.atan2(k.vx, k.vz) : k.yaw;
      r.yaw = lerpAngle(r.yaw, want, 1 - Math.exp(-9 * step));

      // The stride advances with distance covered: about 0.75 world units per
      // full cycle at this size. Standing still, the legs stop.
      r.stride += (k.speed * step * (Math.PI * 2)) / 0.75;
      const run = clamp(k.speed / 2.4, 0, 1);
      const swing = Math.sin(r.stride);
      const overhead = clamp(k.arms, 0, 1);

      const target: Pose = animate
        ? {
            lift: 0.035 * Math.abs(swing) * run - 0.15 * k.squat,
            bodyPitch: 0.16 * run + 0.38 * k.squat + 0.1 * k.pat + 0.03 * Math.sin(now * 1.1 + i),
            bodyYaw: 0.06 * swing * run,
            bodyRoll: 0.03 * swing * run + 0.02 * Math.sin(now * 0.9 + i * 2),
            headPitch: -0.06 * run + 0.12 * k.squat - 0.1 * overhead + 0.2 * k.pat,
            headYaw: 0,
            armLx: lerp(0.6 * swing * run, -2.85, overhead),
            armRx: lerp(lerp(-0.6 * swing * run, -2.85, overhead), -1.35, k.pat),
            armLz: -0.12 - 0.22 * overhead,
            armRz: 0.12 + 0.22 * overhead - 0.1 * k.pat,
            legLx: 0.7 * swing * run + 0.45 * k.squat,
            legRx: -0.7 * swing * run + 0.45 * k.squat,
          }
        : { ...REST };

      const f = 1 - Math.exp(-14 * step);
      const p = r.pose;
      for (const key of Object.keys(p) as (keyof Pose)[]) p[key] += (target[key] - p[key]) * f;

      root.position.set(k.x, p.lift, k.z);
      root.rotation.y = r.yaw;
      setRot(r.parts.bodyG, r.rest.bodyG, p.bodyPitch, p.bodyYaw, p.bodyRoll);
      setRot(r.parts.head, r.rest.head, p.headPitch, p.headYaw, 0);
      setRot(r.parts.armL, r.rest.armL, p.armLx, 0, p.armLz);
      setRot(r.parts.armR, r.rest.armR, p.armRx, 0, p.armRz);
      setRot(r.parts.legL, r.rest.legL, p.legLx, 0, 0);
      setRot(r.parts.legR, r.rest.legR, p.legRx, 0, 0);
      setRot(r.parts.bobble, r.rest.bobble, -p.headPitch * 1.2 - 0.25 * run, 0, -p.bodyRoll * 1.5 + 0.06 * Math.sin(now * 9 + i));
      if (now > r.blinkAt) {
        r.blinkUntil = now + 0.12;
        r.blinkAt = now + 2 + ((i * 7919) % 30) / 10;
      }
      if (r.parts.eyes) r.parts.eyes.scale.y = now < r.blinkUntil ? 0.12 : 1;
    });
  });

  return (
    <group>
      {crew.map((r, i) => (
        <group
          key={i}
          ref={(el) => {
            roots.current[i] = el;
          }}
          visible={false}
        >
          <primitive object={r.inner} scale={r.scale} position-y={-r.minY * r.scale} />
        </group>
      ))}
    </group>
  );
}
