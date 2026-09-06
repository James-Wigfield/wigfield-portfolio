/**
 * The workers: portlets who step out of the portal, one at a time, to look
 * after the word. That is the whole point of a portlet, so it is the whole
 * point of this: quiet, autonomous upkeep, going on in the background.
 *
 * Every so often one of them materialises in the middle of the opening, drops
 * onto the plinth, hops down the gate's steps and walks round the END of the
 * word (never through it) to a letter picked at random, does a job on it -
 * polishes it with a cloth, dusts it with a duster, inspects it with a
 * magnifying glass, sweeps round its foot with a broom - then walks back the
 * same way, climbs the steps and dissolves back into the portal. Then nothing
 * for a while. One out at a time; a different letter and a different job from
 * the last. Each job is its own portlet with its own tool built from
 * primitives and held in the right hand, and each has its own way of moving.
 *
 * They are small (0.55 tall) so they pass under the lowest ring of orbiting
 * letters, and every path is a polyline of waypoints laid out so that nobody
 * ever crosses a letter, a post or the plinth: out through the opening,
 * straight ahead off the front of the gate, to a point behind the nearer end
 * of the word, round that end, and along the front to the letter. If the word
 * starts to leave (the scroll flight), whoever is out dissolves where they
 * stand and nobody comes out until it is back.
 *
 * The model is temp/portlet.glb (a Claude Design export), jointed but with no
 * animation of its own; every move here is procedural, and every joint chases
 * its target with a little lag so phases blend.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export const PORTLET_MODEL = "/portara-test/portlet.glb";
/** Their height, world units: under the lowest ring's letters (0.67 up). */
export const WORKER_H = 0.55;

/** What the scene shares with the gate's glow and with the wordmark. */
export type Stage = {
  /** 0 .. 1 how hard the portal is glowing (someone is stepping through). */
  flash: number;
  /** 0 .. 1 the word's scroll flight; while it is up nobody comes out. */
  flight: number;
};
export function makeStage(): Stage {
  return { flash: 0, flight: 0 };
}

type Job = "polish" | "dust" | "inspect" | "sweep";
const JOBS: Job[] = ["polish", "dust", "inspect", "sweep"];

const TIMING = {
  firstAt: 3.8, // seconds after the scene mounts (the letters are down by then)
  breakMin: 4.5, // the rest between visits
  breakMax: 9,
  fade: 0.35, // materialising, dissolving
  drop: 0.4, // from mid-opening onto the plinth
  walk: 1.7, // world units per second
  hop: 0.1, // height of the little hops down the steps
  workMin: 2.4,
  workMax: 3.6,
};
/* The gate's steps, in the gate's own space (from the model): the plinth top
   inside the opening, its front edge, the ground slab's top and edge, and
   where the floor proper begins. `hover` is where they materialise, feet in
   the middle of the opening. */
const GATE = { hover: 0.78, plinthTop: 0.365, plinthEdge: 0.24, stepTop: 0.166, stepEdge: 0.31, floorAt: 0.58 };
/* Round the word, in the word's own space: how far past its end they turn,
   how far behind and in front of the row they walk, and where they stand to
   work on a letter. */
const WORD = { pastEnd: 0.5, behind: -0.55, front: 0.5, workAt: 0.42 };

const INK = "#141c26";
const ACCENT = "#ff4e2b";
const SAND = "#e7dac0";

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

const clamp = THREE.MathUtils.clamp;
const lerp = THREE.MathUtils.lerp;
const S = Math.sin;
function lerpAngle(a: number, b: number, f: number) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

/** The tool for a job, built to hang from the right hand: the arm's own axis
    is -y, so a handle runs along -y and a head sits at its end. Model units
    (the portlet is about 1.15 tall in them; the hand is 0.06 across). */
function makeTool(job: Job) {
  const g = new THREE.Group();
  const ink = new THREE.MeshStandardMaterial({ color: INK, roughness: 0.6 });
  const accent = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.7 });
  const sand = new THREE.MeshStandardMaterial({ color: SAND, roughness: 0.9 });
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.rotation.set(rx, ry, rz);
    m.castShadow = true;
    g.add(m);
    return m;
  };
  if (job === "polish") {
    // A folded cloth held flat against the letter.
    add(new THREE.BoxGeometry(0.17, 0.022, 0.14), accent, 0, -0.03, 0.02, 0, 0.3, 0);
    add(new THREE.BoxGeometry(0.1, 0.02, 0.09), accent, 0.02, -0.052, 0.03, 0, -0.4, 0);
  } else if (job === "dust") {
    // A stick with a fluffy head.
    add(new THREE.CylinderGeometry(0.011, 0.011, 0.32, 8), ink, 0, -0.16, 0);
    const fluff = [
      [0, -0.35, 0, 0.048],
      [0.035, -0.32, 0.02, 0.036],
      [-0.03, -0.33, -0.025, 0.034],
      [0.01, -0.3, -0.035, 0.03],
      [-0.02, -0.38, 0.03, 0.028],
    ];
    fluff.forEach(([x, y, z, r], k) => add(new THREE.SphereGeometry(r, 12, 10), k % 2 ? sand : accent, x, y, z));
  } else if (job === "inspect") {
    // A magnifying glass: handle, ring, and a faint lens.
    add(new THREE.CylinderGeometry(0.012, 0.014, 0.15, 8), ink, 0, -0.075, 0);
    add(new THREE.TorusGeometry(0.075, 0.012, 10, 28), ink, 0, -0.23, 0, Math.PI / 2, 0, 0);
    const glass = new THREE.MeshPhysicalMaterial({ color: "#9fd3ff", transparent: true, opacity: 0.35, roughness: 0.1, side: THREE.DoubleSide });
    add(new THREE.CircleGeometry(0.068, 28), glass, 0, -0.23, 0, Math.PI / 2, 0, 0).castShadow = false;
  } else {
    // A broom: long handle, a block head, bristles.
    add(new THREE.CylinderGeometry(0.012, 0.012, 0.56, 8), ink, 0, -0.28, 0);
    add(new THREE.BoxGeometry(0.2, 0.05, 0.06), ink, 0, -0.57, 0);
    add(new THREE.BoxGeometry(0.2, 0.09, 0.05), sand, 0, -0.63, 0);
  }
  return g;
}

type Part = THREE.Object3D | undefined;
type Worker = {
  job: Job;
  inner: THREE.Object3D;
  scale: number;
  minY: number;
  parts: { bodyG: Part; head: Part; armL: Part; armR: Part; legL: Part; legR: Part; bobble: Part; eyes: Part };
  rest: Record<string, THREE.Euler>;
  mats: THREE.Material[];
  pose: Pose;
  yaw: number;
  stride: number;
  fade: number;
  blinkAt: number;
  blinkUntil: number;
};

/** A leg of the path: where to, how long, and whether it is a hop. */
type Leg = { to: THREE.Vector3; dur: number; hop: boolean };

type Phase = "idle" | "in" | "drop" | "walk" | "work" | "back" | "rise" | "vanish";
type Plan = {
  phase: Phase;
  t: number; // time in phase
  who: number; // index into the workers
  letter: number;
  legs: Leg[];
  leg: number;
  from: THREE.Vector3;
  pos: THREE.Vector3;
  heading: number;
  faceWork: number; // heading while working
  workDur: number;
  breakUntil: number;
  clock: number;
  lastLetter: number;
  lastWho: number;
  door: THREE.Vector3; // mid-opening, where they appear
  plinth: THREE.Vector3; // where they land
};

function setRot(part: Part, rest: THREE.Euler | undefined, x: number, y: number, z: number) {
  if (!part || !rest) return;
  part.rotation.set(rest.x + x, rest.y + y, rest.z + z);
}

export function Workers({
  wordRef,
  gateRef,
  stage,
  animate,
  visible,
}: {
  wordRef: React.RefObject<THREE.Group | null>;
  gateRef: React.RefObject<THREE.Group | null>;
  stage: React.MutableRefObject<Stage>;
  animate: boolean;
  visible: boolean;
}) {
  const { scene } = useGLTF(PORTLET_MODEL);
  const roots = useRef<(THREE.Group | null)[]>([]);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), c: new THREE.Vector3() }), []);
  const plan = useRef<Plan>({
    phase: "idle",
    t: 0,
    who: 0,
    letter: -1,
    legs: [],
    leg: 0,
    from: new THREE.Vector3(),
    pos: new THREE.Vector3(),
    heading: 0,
    faceWork: 0,
    workDur: 3,
    breakUntil: TIMING.firstAt,
    clock: 0,
    lastLetter: -1,
    lastWho: -1,
    door: new THREE.Vector3(),
    plinth: new THREE.Vector3(),
  });

  const workers = useMemo<Worker[]>(
    () =>
      JOBS.map((job, i) => {
        const inner = scene.clone(true);
        const mats: THREE.Material[] = [];
        inner.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh) return;
          m.castShadow = true;
          m.material = (m.material as THREE.Material).clone();
          mats.push(m.material as THREE.Material);
        });
        // The tool, in the right hand.
        const armR = inner.getObjectByName("armR");
        if (armR) {
          const tool = makeTool(job);
          tool.position.set(0, -0.24, 0.02);
          armR.add(tool);
          tool.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) mats.push(m.material as THREE.Material);
          });
        }
        inner.updateMatrixWorld(true);
        const box = new THREE.Box3().setFromObject(inner.getObjectByName("rig") ?? inner);
        const h = WORKER_H * (0.94 + 0.04 * (i % 3));
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
          job,
          inner,
          scale,
          minY: box.min.y,
          parts,
          rest,
          mats,
          pose: { ...REST },
          yaw: 0,
          stride: 0,
          fade: 0,
          blinkAt: 1,
          blinkUntil: 0,
        };
      }),
    [scene],
  );

  /** Lay out the visit: who, which letter, and the way there. */
  const startVisit = (p: Plan) => {
    const word = wordRef.current;
    const gate = gateRef.current;
    if (!word || !gate || !word.children.length) return false;
    const n = word.children.length;
    let letter = Math.floor(Math.random() * n);
    if (letter === p.lastLetter) letter = (letter + 1 + Math.floor(Math.random() * (n - 1))) % n;
    let who = Math.floor(Math.random() * workers.length);
    if (who === p.lastWho) who = (who + 1) % workers.length;
    p.letter = letter;
    p.who = who;
    p.lastLetter = letter;
    p.lastWho = who;

    // The word's ends and the letter, in the word's space.
    let minX = Infinity;
    let maxX = -Infinity;
    for (const m of word.children) {
      minX = Math.min(minX, m.position.x);
      maxX = Math.max(maxX, m.position.x);
    }
    const lx = word.children[letter].position.x;
    const endX = lx < (minX + maxX) / 2 ? minX - WORD.pastEnd : maxX + WORD.pastEnd;

    const G = (x: number, y: number, z: number) => gate.localToWorld(new THREE.Vector3(x, y, z));
    const W = (x: number, y: number, z: number) => word.localToWorld(new THREE.Vector3(x, y, z));
    p.door.copy(G(0, GATE.hover, 0));
    p.plinth.copy(G(0, GATE.plinthTop, 0.02));
    const pts: { at: THREE.Vector3; hop: boolean }[] = [
      { at: G(0, GATE.plinthTop, GATE.plinthEdge), hop: false },
      { at: G(0, GATE.stepTop, GATE.stepEdge), hop: true },
      { at: G(0, 0, GATE.floorAt), hop: true },
      { at: W(endX, 0, WORD.behind), hop: false },
      { at: W(endX, 0, WORD.front), hop: false },
      { at: W(lx, 0, WORD.workAt), hop: false },
    ];
    const legs: Leg[] = [];
    let prev = p.plinth;
    for (const q of pts) {
      const d = q.at.distanceTo(prev);
      legs.push({ to: q.at, dur: Math.max(0.2, d / (q.hop ? TIMING.walk * 0.7 : TIMING.walk)), hop: q.hop });
      prev = q.at;
    }
    p.legs = legs;
    // Working, they face the letter: back along the word's front direction.
    tmp.a.copy(W(lx, 0, 0)).sub(W(lx, 0, WORD.workAt));
    p.faceWork = Math.atan2(tmp.a.x, tmp.a.z);
    p.workDur = TIMING.workMin + Math.random() * (TIMING.workMax - TIMING.workMin);
    return true;
  };

  /** The way back is the way there, reversed. */
  const reverseLegs = (p: Plan) => {
    const pts = [p.plinth, ...p.legs.map((l) => l.to)];
    const hops = p.legs.map((l) => l.hop);
    const legs: Leg[] = [];
    for (let i = pts.length - 1; i > 0; i--) {
      const d = pts[i].distanceTo(pts[i - 1]);
      const hop = hops[i - 1];
      legs.push({ to: pts[i - 1], dur: Math.max(0.2, d / (hop ? TIMING.walk * 0.7 : TIMING.walk)), hop });
    }
    p.legs = legs;
  };

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    const p = plan.current;
    const st = stage.current;
    p.clock += step;
    p.t += step;
    let flash = 0;

    const active = workers[p.who];
    const leaving = st.flight > 0.02 || !visible || !animate;

    // Someone is out and the word is leaving: dissolve where they stand.
    if (leaving && p.phase !== "idle" && p.phase !== "vanish") {
      p.phase = "vanish";
      p.t = 0;
    }

    let speed = 0;
    let squat = 0;
    let work = 0; // 0 .. 1 while working, drives the job's motion
    let hopping = false;

    switch (p.phase) {
      case "idle": {
        if (!leaving && p.clock >= p.breakUntil && startVisit(p)) {
          p.phase = "in";
          p.t = 0;
          p.pos.copy(p.door);
          p.from.copy(p.door);
          const w = workers[p.who];
          w.fade = 0;
          w.yaw = p.faceWork; // they arrive looking out of the opening
        }
        break;
      }
      case "in": {
        const u = clamp(p.t / TIMING.fade, 0, 1);
        active.fade = u;
        flash = S(Math.PI * u);
        p.pos.copy(p.door);
        if (u >= 1) {
          p.phase = "drop";
          p.t = 0;
        }
        break;
      }
      case "drop": {
        const u = clamp(p.t / TIMING.drop, 0, 1);
        p.pos.lerpVectors(p.door, p.plinth, u * u);
        if (u >= 1) {
          p.phase = "walk";
          p.t = 0;
          p.leg = 0;
          p.from.copy(p.plinth);
        }
        squat = u > 0.85 ? S(Math.PI * clamp((u - 0.85) / 0.15, 0, 1)) * 0.8 : 0;
        break;
      }
      case "walk":
      case "back": {
        const leg = p.legs[p.leg];
        if (!leg) {
          if (p.phase === "walk") {
            p.phase = "work";
            p.t = 0;
          } else {
            p.phase = "rise";
            p.t = 0;
            p.from.copy(p.pos);
          }
          break;
        }
        const u = clamp(p.t / leg.dur, 0, 1);
        p.pos.lerpVectors(p.from, leg.to, u);
        if (leg.hop) {
          p.pos.y += TIMING.hop * S(Math.PI * u);
          hopping = true;
          squat = u > 0.8 ? S(Math.PI * clamp((u - 0.8) / 0.2, 0, 1)) * 0.5 : 0;
        }
        tmp.a.copy(leg.to).sub(p.from);
        if (tmp.a.lengthSq() > 1e-6) p.heading = Math.atan2(tmp.a.x, tmp.a.z);
        speed = leg.to.distanceTo(p.from) / leg.dur;
        if (u >= 1) {
          p.from.copy(leg.to);
          p.leg += 1;
          p.t = 0;
        }
        break;
      }
      case "work": {
        work = clamp(p.t / p.workDur, 0, 1);
        p.heading = p.faceWork;
        if (p.t >= p.workDur) {
          p.phase = "back";
          p.t = 0;
          reverseLegs(p);
          p.leg = 0;
          p.from.copy(p.pos);
        }
        break;
      }
      case "rise": {
        const u = clamp(p.t / (TIMING.drop + 0.1), 0, 1);
        p.pos.lerpVectors(p.from, p.door, 1 - (1 - u) * (1 - u));
        const out = clamp((p.t - 0.15) / TIMING.fade, 0, 1);
        active.fade = 1 - out;
        flash = out > 0 && out < 1 ? S(Math.PI * out) : 0;
        if (u >= 1 && out >= 1) {
          p.phase = "idle";
          p.t = 0;
          p.breakUntil = p.clock + TIMING.breakMin + Math.random() * (TIMING.breakMax - TIMING.breakMin);
        }
        break;
      }
      case "vanish": {
        const u = clamp(p.t / 0.3, 0, 1);
        active.fade = 1 - u;
        flash = S(Math.PI * u) * 0.6;
        if (u >= 1) {
          p.phase = "idle";
          p.t = 0;
          p.breakUntil = p.clock + 2.5;
        }
        break;
      }
    }
    st.flash = flash;

    // Bodies.
    workers.forEach((w, i) => {
      const r = roots.current[i];
      if (!r) return;
      const isActive = i === p.who && p.phase !== "idle";
      if (!isActive) w.fade = 0;
      r.visible = w.fade > 0.02;
      if (!r.visible) return;
      const solid = w.fade > 0.995;
      for (const m of w.mats) {
        if ((m as THREE.MeshPhysicalMaterial).isMeshPhysicalMaterial) continue; // the lens keeps its own
        m.opacity = w.fade;
        m.transparent = !solid;
      }
      r.scale.setScalar(0.75 + 0.25 * w.fade);

      const wantYaw = work > 0 ? p.faceWork : speed > 0.2 ? p.heading : w.yaw;
      w.yaw = lerpAngle(w.yaw, wantYaw, 1 - Math.exp(-8 * step));
      w.stride += (speed * step * Math.PI * 2) / 0.55;
      const run = clamp(speed / 1.7, 0, 1);
      const swing = S(w.stride);
      const now = p.clock;

      // The job's motion, on top of the stance facing the letter.
      const j: Partial<Pose> = {};
      if (work > 0) {
        const wt = p.t;
        const inOut = S(Math.PI * clamp(work, 0, 1)) ** 0.5; // settle in, ease off
        if (w.job === "polish") {
          j.armRx = -1.55 + 0.14 * S(wt * 9) * inOut;
          j.armRz = 0.18 + 0.24 * S(wt * 9 + Math.PI / 2) * inOut;
          j.bodyYaw = 0.06 * S(wt * 9 + Math.PI / 2) * inOut;
          j.headPitch = -0.15;
          j.armLx = -0.35;
          j.armLz = -0.2;
        } else if (w.job === "dust") {
          const sweep = 0.5 - 0.5 * Math.cos(wt * 5.6);
          j.armRx = lerp(-2.35, -1.25, sweep);
          j.armRz = 0.25 + 0.1 * S(wt * 2.8);
          j.bodyPitch = 0.05 + 0.06 * sweep;
          j.headPitch = -0.3 + 0.35 * sweep;
          j.armLx = -0.3;
          j.armLz = -0.25;
        } else if (w.job === "inspect") {
          j.armRx = -2.0;
          j.armRz = 0.1;
          j.bodyPitch = 0.12;
          j.headPitch = -0.28 + 0.3 * S(wt * 1.7) + (work > 0.82 ? 0.15 * S((work - 0.82) * 40) : 0);
          j.headYaw = 0.08 * S(wt * 0.9);
          j.armLx = 0.15;
          j.armLz = -0.15;
        } else {
          const sw = S(wt * 4.2) * inOut;
          j.armRx = -0.75;
          j.armRz = 0.45 * sw;
          j.bodyYaw = 0.55 + 0.25 * sw;
          j.bodyPitch = 0.16;
          j.headPitch = 0.22;
          j.armLx = -0.5;
          j.armLz = -0.3;
        }
      }
      const target: Pose = animate
        ? {
            lift: 0.03 * Math.abs(swing) * run - 0.14 * squat,
            bodyPitch: (j.bodyPitch ?? 0) + 0.14 * run + 0.3 * squat + 0.02 * S(now * 1.1),
            bodyYaw: (j.bodyYaw ?? 0) + 0.05 * swing * run,
            bodyRoll: (j.bodyRoll ?? 0) + 0.03 * swing * run + 0.015 * S(now * 0.8 + i),
            headPitch: (j.headPitch ?? 0) - 0.05 * run + 0.1 * squat + (hopping ? -0.1 : 0),
            headYaw: j.headYaw ?? 0,
            armLx: j.armLx ?? 0.55 * swing * run,
            armLz: j.armLz ?? -0.1,
            // The tool arm carries the tool low while walking.
            armRx: j.armRx ?? -0.45 - 0.25 * swing * run,
            armRz: j.armRz ?? 0.12,
            legLx: 0.65 * swing * run + 0.4 * squat,
            legRx: -0.65 * swing * run + 0.4 * squat,
          }
        : { ...REST };
      const f = 1 - Math.exp(-13 * step);
      const q = w.pose;
      for (const key of Object.keys(q) as (keyof Pose)[]) q[key] += (target[key] - q[key]) * f;

      r.position.set(p.pos.x, p.pos.y + q.lift, p.pos.z);
      r.rotation.y = w.yaw;
      setRot(w.parts.bodyG, w.rest.bodyG, q.bodyPitch, q.bodyYaw, q.bodyRoll);
      setRot(w.parts.head, w.rest.head, q.headPitch, q.headYaw, 0);
      setRot(w.parts.armL, w.rest.armL, q.armLx, 0, q.armLz);
      setRot(w.parts.armR, w.rest.armR, q.armRx, 0, q.armRz);
      setRot(w.parts.legL, w.rest.legL, q.legLx, 0, 0);
      setRot(w.parts.legR, w.rest.legR, q.legRx, 0, 0);
      setRot(w.parts.bobble, w.rest.bobble, -q.headPitch * 1.2 - 0.2 * run, 0, -q.bodyRoll * 1.5 + 0.05 * S(now * 9 + i));
      if (now > w.blinkAt) {
        w.blinkUntil = now + 0.12;
        w.blinkAt = now + 2 + Math.random() * 3;
      }
      if (w.parts.eyes) w.parts.eyes.scale.y = now < w.blinkUntil ? 0.12 : 1;
    });
  });

  return (
    <group>
      {workers.map((w, i) => (
        <group
          key={w.job}
          ref={(el) => {
            roots.current[i] = el;
          }}
          visible={false}
        >
          <primitive object={w.inner} scale={w.scale} position-y={-w.minY * w.scale} />
        </group>
      ))}
    </group>
  );
}

useGLTF.preload(PORTLET_MODEL);
