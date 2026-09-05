/**
 * The portlets: Portara's little AI agents, in a CONGA LINE far behind the
 * gate, dancing together in the distance.
 *
 * The model (temp/portlet.glb, a Claude Design export) has no animation of
 * its own but it is jointed - lift, hips, torso, shoulders, neck, antenna -
 * so the dance is procedural. Five of them follow one another round a wide
 * loop at the back of the floor, all to one beat: step, step, step, KICK,
 * kicking to alternate sides each bar, hands on the shoulders in front, heads
 * bobbing, each one a fraction of a beat behind the one ahead so the kick
 * runs down the line like a wave. The leader has no shoulders to hold, so
 * the leader's arms are in the air. Spacing along the loop is by arc length
 * (a table, because it is an ellipse), so they never bunch on the bends.
 * Scrolling the page speeds the music up (the rings' boost). Eyes blink.
 * Reduced motion: they stand in line, still.
 *
 * LAYOUT TOOL: the whole line is one selectable group ("Portlets"); its
 * position is the loop's centre, its scale the loop's size.
 */
import { useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import gsap from "gsap";

import { applyXform, pickHandlers, type Pick, type Xform } from "./layout-tool";

export const PORTLET_MODEL = "/portara-test/portlet.glb";

const COUNT = 5;
/* The loop, in the group's space: a wide ellipse, walked clockwise seen from
   above so the near side reads left to right. */
const LOOP = { rx: 5.5, rz: 1.4 };
const SPACING = 0.95; // arc length between dancers
const STRIDE = 0.36; // arc length per beat
const BPM = 122;
const LAG = 0.14; // beats each dancer is behind the one ahead
/* Tall for portlets: they are a long way off. */
const HEIGHTS = [0.9, 0.84, 0.8, 0.86, 0.82];
const ACCENT = "#ff4e2b";

type Pose = {
  lift: number; // hop height
  squash: number; // vertical scale, 1 = rest (x/z compensate)
  bodyPitch: number;
  bodyYaw: number;
  bodyRoll: number;
  headPitch: number;
  headYaw: number;
  headRoll: number;
  armLx: number; // negative raises the arm forward, -PI is straight up
  armLz: number; // negative swings the left arm out
  armRx: number;
  armRz: number; // positive swings the right arm out
  legLx: number; // negative kicks forward
  legLz: number; // negative kicks out to the left
  legRx: number;
  legRz: number; // positive kicks out to the right
};
const REST: Pose = {
  lift: 0,
  squash: 1,
  bodyPitch: 0,
  bodyYaw: 0,
  bodyRoll: 0,
  headPitch: 0,
  headYaw: 0,
  headRoll: 0,
  armLx: 0,
  armLz: 0,
  armRx: 0,
  armRz: 0,
  legLx: 0,
  legLz: 0,
  legRx: 0,
  legRz: 0,
};

const TAU = Math.PI * 2;
const S = Math.sin;
/** One hop per beat: 0 on the beat, 1 half-way. */
const hop = (b: number) => Math.max(0, S(Math.PI * (b % 1)));

/**
 * The conga, as a function of beats. A bar is four beats: three walking
 * steps and a kick, the kick to the left on even bars and the right on odd.
 */
function conga(beat: number, leader: boolean): Pose {
  const bar = Math.floor(beat / 4);
  const within = beat - bar * 4;
  const kicking = within >= 3;
  const k = kicking ? hop(within) : 0; // the kick's own arc
  const left = bar % 2 === 0;
  const side = left ? -1 : 1;
  const walk = S(Math.PI * beat); // legs alternate, period two beats
  const p: Pose = {
    ...REST,
    lift: kicking ? 0.12 * k : 0.045 * hop(beat),
    squash: kicking ? 1 + 0.08 * k : 0.97 + 0.06 * hop(beat),
    bodyYaw: 0.14 * S(Math.PI * beat),
    bodyRoll: kicking ? -side * 0.2 * k : 0.05 * walk,
    bodyPitch: kicking ? -0.06 * k : 0.03,
    headRoll: 0.16 * S(Math.PI * beat + 0.6),
    headYaw: kicking ? side * 0.45 * k : 0,
    headPitch: kicking ? -0.1 * k : 0.05 * hop(beat),
    // Hands on the shoulders in front: arms forward and a touch up, lifting
    // with the kick.
    armLx: -1.35 - 0.4 * k,
    armRx: -1.35 - 0.4 * k,
    armLz: -0.15,
    armRz: 0.15,
    legLx: kicking ? 0 : 0.45 * walk,
    legRx: kicking ? 0 : -0.45 * walk,
    legLz: kicking && left ? -1.0 * k : 0,
    legRz: kicking && !left ? 1.0 * k : 0,
  };
  if (leader) {
    // Nobody to hold on to: arms in the air, waving.
    p.armLx = -2.55;
    p.armRx = -2.55;
    p.armLz = -0.45 - 0.3 * S(TAU * beat);
    p.armRz = 0.45 + 0.3 * S(TAU * beat);
    p.headPitch += 0.08 * S(TAU * beat);
  }
  return p;
}

/** The loop as an arc-length table, so spacing is even on the bends. */
function makeLoop() {
  const N = 720;
  const pts: THREE.Vector3[] = [];
  const cum: number[] = [0];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * TAU;
    // Clockwise from above: x = sin, z = cos, angle increasing.
    pts.push(new THREE.Vector3(LOOP.rx * Math.sin(t), 0, LOOP.rz * Math.cos(t)));
    if (i) cum.push(cum[i - 1] + pts[i].distanceTo(pts[i - 1]));
  }
  const length = cum[N];
  const at = (s: number, out: THREE.Vector3, tangent: THREE.Vector3) => {
    const d = ((s % length) + length) % length;
    // Binary search the segment.
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] <= d) lo = mid;
      else hi = mid;
    }
    const seg = cum[hi] - cum[lo] || 1;
    const f = (d - cum[lo]) / seg;
    out.copy(pts[lo]).lerp(pts[hi], f);
    tangent.copy(pts[hi]).sub(pts[lo]).normalize();
  };
  return { length, at };
}

type Part = THREE.Object3D | undefined;
type Dancer = {
  inner: THREE.Object3D;
  scale: number;
  minY: number;
  parts: { bodyG: Part; head: Part; armL: Part; armR: Part; legL: Part; legR: Part; bobble: Part; eyes: Part };
  rest: Record<string, THREE.Euler>;
  applied: Pose;
  blinkAt: number;
  blinkUntil: number;
};

function setRot(part: Part, rest: THREE.Euler | undefined, x: number, y: number, z: number) {
  if (!part || !rest) return;
  part.rotation.set(rest.x + x, rest.y + y, rest.z + z);
}

export function Portlets({
  groupRef,
  xform,
  pick,
  boost,
  dance,
  entrance,
}: {
  groupRef: React.RefObject<THREE.Group | null>;
  xform: Xform;
  pick?: Pick;
  boost: React.MutableRefObject<number>;
  dance: boolean;
  entrance: boolean;
}) {
  const { scene } = useGLTF(PORTLET_MODEL);
  const roots = useRef<(THREE.Group | null)[]>([]);
  const loop = useMemo(makeLoop, []);
  const clock = useRef({ time: 0, beat: 0 });
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3() }), []);

  const dancers = useMemo<Dancer[]>(
    () =>
      HEIGHTS.slice(0, COUNT).map((height, i) => {
        const inner = scene.clone(true);
        inner.traverse((o) => {
          if ((o as THREE.Mesh).isMesh) o.castShadow = true;
        });
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner);
        const scale = height / (box.max.y - box.min.y || 1);
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
        return { inner, scale, minY: box.min.y, parts, rest, applied: { ...REST }, blinkAt: 1 + i * 0.7, blinkUntil: 0 };
      }),
    [scene],
  );

  // Where the loop's centre is (LAYOUT TOOL: the stored layout, else the default).
  useLayoutEffect(() => {
    if (groupRef.current) applyXform(groupRef.current, xform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Put everyone on the line straight away, so a still frame is right too.
  const place = (beatNow: number) => {
    const lead = beatNow * STRIDE + loop.length * 0.62; // start on the far side, coming round
    dancers.forEach((d, i) => {
      const root = roots.current[i];
      if (!root) return;
      loop.at(lead - i * SPACING, tmp.p, tmp.t);
      root.position.set(tmp.p.x, root.position.y, tmp.p.z);
      root.rotation.y = Math.atan2(tmp.t.x, tmp.t.z);
    });
  };

  // Entrance: they pop up one after another once the word has landed.
  useLayoutEffect(() => {
    place(0);
    if (!entrance) return;
    const tl = gsap.timeline();
    roots.current.forEach((g, i) => {
      if (!g) return;
      tl.fromTo(g.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 0.7, ease: "back.out(1.6)" }, 1.7 + i * 0.12);
    });
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrance]);

  useFrame((_, dt) => {
    if (!dance) return;
    const step = Math.min(dt, 0.1);
    // Scrolling turns the music up (the rings' boost, already decaying).
    const tempo = 1 + 0.6 * boost.current;
    const c = clock.current;
    c.time += step;
    c.beat += (BPM / 60) * tempo * step;
    place(c.beat);
    const f = 1 - Math.exp(-18 * step);

    dancers.forEach((d, i) => {
      const root = roots.current[i];
      if (!root) return;
      const target = conga(c.beat - i * LAG, i === 0);
      const a = d.applied;
      for (const k of Object.keys(a) as (keyof Pose)[]) a[k] += (target[k] - a[k]) * f;

      root.position.y = a.lift;
      const s = d.scale;
      d.inner.scale.set(s / Math.sqrt(a.squash), s * a.squash, s / Math.sqrt(a.squash));
      d.inner.position.y = -d.minY * s * a.squash;
      setRot(d.parts.bodyG, d.rest.bodyG, a.bodyPitch, a.bodyYaw, a.bodyRoll);
      setRot(d.parts.head, d.rest.head, a.headPitch, a.headYaw, a.headRoll);
      setRot(d.parts.armL, d.rest.armL, a.armLx, 0, a.armLz);
      setRot(d.parts.armR, d.rest.armR, a.armRx, 0, a.armRz);
      setRot(d.parts.legL, d.rest.legL, a.legLx, 0, a.legLz);
      setRot(d.parts.legR, d.rest.legR, a.legRx, 0, a.legRz);
      // The antenna lags the head and shivers with the beat.
      setRot(
        d.parts.bobble,
        d.rest.bobble,
        -a.headPitch * 1.2 + S(c.time * 9 + i) * 0.05,
        0,
        -a.bodyRoll * 1.6 - a.headRoll * 1.2 + S(c.time * 11 + i) * 0.08 * tempo,
      );
      // Blink.
      if (c.time > d.blinkAt) {
        d.blinkUntil = c.time + 0.12;
        d.blinkAt = c.time + 2 + ((i * 7919) % 30) / 10;
      }
      if (d.parts.eyes) d.parts.eyes.scale.y = c.time < d.blinkUntil ? 0.12 : 1;
    });
  });

  return (
    <group ref={groupRef} {...pickHandlers(pick)}>
      {dancers.map((d, i) => (
        <group
          key={i}
          ref={(el) => {
            roots.current[i] = el;
          }}
        >
          <primitive object={d.inner} scale={d.scale} position-y={-d.minY * d.scale} />
          {/* LAYOUT TOOL: a ring under each one while the group is selected. */}
          <mesh rotation-x={-Math.PI / 2} position-y={0.004} visible={!!pick?.selected}>
            <ringGeometry args={[0.36, 0.39, 48]} />
            <meshBasicMaterial color={ACCENT} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(PORTLET_MODEL);
