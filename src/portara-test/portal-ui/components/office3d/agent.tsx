import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useFrame, type ThreeEvent } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import { autonomyMeta, type Autonomy } from "../../lib/agent/models";
import { confidenceBand } from "../../lib/agent/types";
import { zonePath, type Tile, type Wall } from "../../lib/office-layout";
import type { OfficePop } from "../../lib/office-live";
import { WORKER_STATUSES, type WorkerStatus } from "../../lib/workers";
import { ConfidenceRing } from "../confidence";
import { BOT, characterConfig, UI3D, type CharacterConfig } from "./palette";
import { toonGradient } from "./pixel-art";

/* ── The portlet ─────────────────────────────────────────────────────────
   Every agent is a portlet - the banner's little robot: rounded cream
   shell, dark visor with two glowing cyan eyes, red-orange headphone
   discs, an antenna bobble, and orange accents at chest, belt and knees.
   Everything animates in useFrame through refs (zero re-renders); the
   worker id picks the accent shade and trims deterministically.

   Agents are stationed at a desk. With a `roam` spec they run a tiny brain:
   sit and work at the desk, and - while idle - get up, walk their painted
   zone (through doors, never through walls), shuffle around, and wander
   back to their chair.

   With a `stage` spec they leave the floor entirely: see STAGE below. */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const mix = (a: number, b: number, u: number) => a + (b - a) * u;
/** Ease-out-back - the "pop" used when something lands on the floor. */
function popCurve(u: number) {
  if (u >= 1) return 1;
  const c = 1.70158 + 1;
  const x = u - 1;
  return 1 + c * x * x * x + (c - 1) * x * x;
}
/** Smootherstep - flat at both ends, so the flight to the stage leaves and
    arrives without a jolt. */
const glide = (u: number) => u * u * u * (u * (u * 6 - 15) + 10);

/** "ran just now" / "ran 14m ago" / "ran 3h ago" / "last ran 12 Aug". The whole
    PHRASE, not an interval a caller has to wrap - "ran 12 Aug ago" is how that
    goes wrong. Compact on purpose: it shares one line with the autonomy chip. */
function ranPhrase(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (!Number.isFinite(mins)) return "";
  if (mins < 1) return "ran just now";
  if (mins < 60) return `ran ${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `ran ${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `ran ${days}d ago`;
  const when = new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
  });
  return `last ran ${when}`;
}

function Mat({
  color,
  ghost,
  emissive,
  emissiveIntensity,
}: {
  color: string;
  ghost?: string | null;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <meshToonMaterial
      color={ghost ?? color}
      gradientMap={toonGradient()}
      transparent={!!ghost}
      opacity={ghost ? UI3D.ghostOpacity : 1}
      emissive={ghost ? ghost : (emissive ?? "#000000")}
      emissiveIntensity={ghost ? 0.35 : (emissiveIntensity ?? 0)}
    />
  );
}

/** One orange ear disc, optionally with an inner dark ring (headphone look). */
function EarDisc({
  side,
  cfg,
  ghost,
}: {
  side: -1 | 1;
  cfg: CharacterConfig;
  ghost?: string | null;
}) {
  return (
    <group position={[side * 0.235, 0.16, 0]} rotation={[0, 0, Math.PI / 2]}>
      <mesh castShadow>
        <cylinderGeometry args={[0.095, 0.095, 0.07, 14]} />
        <Mat color={cfg.accent} ghost={ghost} />
      </mesh>
      {/* outward-facing inner ring (local -Y is world-outward after the z-rotation) */}
      <mesh position={[0, -side * 0.038, 0]}>
        <cylinderGeometry args={[0.055, 0.055, 0.012, 12]} />
        <Mat color={cfg.accentDark} ghost={ghost} />
      </mesh>
    </group>
  );
}

export type AgentPose = "stand" | "sit";

/* ── Taking the stage ─────────────────────────────────────────────────────
   One agent can be pulled out of the diorama and presented to the viewer:
   they lift off their chair, arc across the room and hover at a fixed spot
   near the bottom of the canvas, facing you, while their console opens above
   their head. The anchor is expressed in CAMERA space and re-derived every
   frame, so the agent holds the same place on screen at any zoom, pan or
   rotation - the office keeps moving behind them, they don't drift.

   The numbers are fractions of the canvas, not world units, for the same
   reason: an orthographic camera changes how many pixels a world unit spans,
   so a fixed world size would balloon as you zoom in. */
export const STAGE = {
  /** World units in front of the camera. The dimming pane sits behind this. */
  depth: 2,
  /** …and the pane's own depth, far enough back to never clip the body. */
  scrimDepth: 4.5,
  /** Height of the hover spot, as a fraction of the canvas, from the bottom. */
  lift: 0.04,
  /** How much of the canvas height the agent fills once landed. Their head
      lands at lift + size = 19.5% of the canvas, just under the console
      panel's bottom edge (`.px-stage__panel` in portal.css). */
  size: 0.155,
  /** Seconds the flight (and the return trip) takes. */
  flight: 0.75,
} as const;

/** Nominal height of the portlet in world units - the divisor that turns
    STAGE.size into a scale factor. */
const BODY_HEIGHT = 1.5;

/**
 * Where a staged agent floats, in world space, written into `out`; returns
 * the scale that makes them STAGE.size of the canvas tall.
 */
export function stageAnchor(
  camera: THREE.OrthographicCamera,
  size: { width: number; height: number },
  out: THREE.Vector3,
): number {
  // The camera's own matrix is what maps camera space to world space, and the
  // rig moves it in its own useFrame - refresh it rather than reading a frame
  // behind (which reads as the agent lagging while you pan).
  camera.updateMatrixWorld();
  const viewH = size.height / camera.zoom; // world units top to bottom
  out
    .set(0, -viewH / 2 + STAGE.lift * viewH, -STAGE.depth)
    .applyMatrix4(camera.matrixWorld);
  return (STAGE.size * size.height) / (camera.zoom * BODY_HEIGHT);
}

/** An agent's trip to the stage. `at` is the performance clock second it
    started; `out` plays the same arc backwards, back to their desk. */
export type StageFlight = { at: number; out: boolean };

/** Everything the agent needs to live at a desk and roam its zone. */
export type RoamSpec = {
  /** The desk tile (world coords) the agent is stationed on. */
  home: Tile;
  /** Where the chair is within the desk tile. */
  chair: [number, number];
  /** Tiles the agent may roam (always includes the desk tile). */
  zone: Tile[];
  walls: Wall[];
};

/* ── Keeping the HUD card on screen ──────────────────────────────────────
   The card hangs above the agent's head, and the office box clips whatever
   leaves it (`.px-office` is overflow:hidden). An agent standing at the back
   of the room - or any agent at all once the camera tilts down - projects
   near the top edge, and the card's head was being sliced off.

   So the card doesn't blindly follow the projection: it is pinned INSIDE the
   canvas. `hudPosition` below is drei's own `calculatePosition` with a clamp
   on the end - the anchor is pushed down (and in from the sides) just far
   enough that the whole card fits, so a card that would have overflowed sits
   flush against the edge, still pointing at its agent, instead of losing its
   name row. Nothing else moves: an agent with room to spare is untouched. */
const HUD_EDGE = 8; // px of breathing room between card and canvas edge
const hudProj = new THREE.Vector3();

/** The measured box of one HUD (card + any chips), kept fresh by a
    ResizeObserver so the per-frame clamp never touches the DOM - reading
    offsetHeight inside useFrame would force a layout on every agent, every
    frame, for the whole time the showcase spins. */
function useHudSize() {
  const size = useRef({ w: 0, h: 0 });
  const node = useRef<HTMLDivElement | null>(null);
  const observer = useRef<ResizeObserver | null>(null);

  const measure = useCallback((el: HTMLDivElement | null) => {
    node.current = el;
    observer.current?.disconnect();
    if (!el) {
      size.current = { w: 0, h: 0 };
      return;
    }
    size.current = { w: el.offsetWidth, h: el.offsetHeight };
    if (typeof ResizeObserver === "undefined") return;
    // `border-box`, because the card's own entry animation scales it and a
    // transform must not be read as the card growing.
    observer.current = new ResizeObserver(([entry]) => {
      const box = entry.borderBoxSize?.[0];
      size.current = box
        ? { w: box.inlineSize, h: box.blockSize }
        : { w: el.offsetWidth, h: el.offsetHeight };
    });
    observer.current.observe(el);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return { size, measure };
}

type BrainState = "sit" | "walk" | "stand";

const WALK_SPEED = 1.05; // tiles per second
const SHUFFLE_SPEED = 0.5;

export function AgentModel({
  sprite,
  workerId,
  status,
  pose,
  yaw,
  ghost = null,
  selected = false,
  selectedAt = 0,
  bornAt = 0,
  roam,
  stage = null,
  label,
  jobTitle = null,
  task = null,
  autonomy,
  confidence = null,
  confidenceRuns = 0,
  lastRunAt = null,
  waiting = null,
  pop = null,
  showLabel = false,
  focused = false,
  interaction,
  chips,
}: {
  sprite: string;
  workerId: string;
  status: WorkerStatus;
  /** Base pose for static previews (ghosts). Ignored when `roam` is set. */
  pose: AgentPose;
  /** Facing while seated, radians. */
  yaw: number;
  ghost?: string | null;
  selected?: boolean;
  selectedAt?: number;
  bornAt?: number;
  /** When set, the agent lives at its desk and roams its zone. */
  roam?: RoamSpec;
  /** When set, the agent leaves the floor and floats at the stage anchor
      (see STAGE) - overriding roaming entirely for as long as it is set. */
  stage?: StageFlight | null;
  label?: string;
  /** Job title, under the name. Named `jobTitle` rather than `title` because a
      DOM `title` is a tooltip, and this card deliberately has none. */
  jobTitle?: string | null;
  /** The agent's current running task, shown in the hover card. */
  task?: string | null;
  /* The card's three standing facts (see the card markup below). Optional:
     without them the card is just a name, a status and a line of what they're
     doing, as it was. */
  autonomy?: Autonomy;
  confidence?: number | null;
  confidenceRuns?: number;
  lastRunAt?: string | null;
  /** Set when this agent has parked mid-run and is waiting on a person
      (migration 0051). Carries what it is asking for, in a few words, because
      the whole point of the marker is to be answerable at a glance from across
      the floor. */
  waiting?: { label: string; risk: "write" | "sensitive" } | null;
  /** A transient "something just happened" callout from the live feed (a
      trigger firing, mail landing, a run starting or ending). The hook that
      produces these expires them itself - this only draws the newest one. */
  pop?: OfficePop | null;
  showLabel?: boolean;
  /** Hovered/selected: freeze roaming, turn to face the camera, show the card. */
  focused?: boolean;
  /** Pointer handlers, attached to a single invisible hitbox that encloses the
      whole robot - so hover stays rock-steady no matter which body part (or
      moving limb) is under the cursor, instead of flickering between meshes. */
  interaction?: {
    onPointerDown?: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOver?: (e: ThreeEvent<PointerEvent>) => void;
    onPointerOut?: (e: ThreeEvent<PointerEvent>) => void;
    onClick?: (e: ThreeEvent<MouseEvent>) => void;
  };
  /** Selection action chips, rendered floating above the agent (so they ride
      along as it roams, instead of being pinned to the empty desk). */
  chips?: ReactNode;
}) {
  const cfg = useMemo(() => characterConfig(sprite, workerId), [sprite, workerId]);

  // Scratch vectors for the "turn and look at the camera" steer while focused,
  // and for the stage flight - reused every frame so we never allocate in the
  // render loop.
  const camPos = useMemo(() => new THREE.Vector3(), []);
  const selfPos = useMemo(() => new THREE.Vector3(), []);
  const stagePos = useMemo(() => new THREE.Vector3(), []);

  const inner = useRef<THREE.Group>(null!); // pop / hop
  const rig = useRef<THREE.Group>(null!); // roam offset + facing
  const lift = useRef<THREE.Group>(null!); // seat height (sit blend)
  const bodyG = useRef<THREE.Group>(null!); // breathing / lean
  const head = useRef<THREE.Group>(null!);
  const eyes = useRef<THREE.Group>(null!);
  const eyeMatL = useRef<THREE.MeshStandardMaterial>(null!);
  const eyeMatR = useRef<THREE.MeshStandardMaterial>(null!);
  const bobble = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);

  // The whole behaviour brain lives in a ref - zero re-renders.
  const brain = useRef({
    init: false,
    st: "sit" as BrainState,
    ox: 0, // current offset from the desk tile, world units
    oz: 0,
    heading: yaw,
    path: [] as [number, number][], // local waypoints (tile centres)
    ax: 0, // anchor of the tile we're standing on
    az: 0,
    jx: 0, // shuffle target around the anchor
    jz: 0,
    jNext: 0,
    until: 0,
    sit: pose === "sit" ? 1 : 0, // 0 standing … 1 seated
    // Smoothed drives. Everything the body does reads these rather than the
    // raw booleans, so a state change (a hover landing, a waypoint reached)
    // eases instead of snapping - see the notes where they're used.
    spd: 0, // 0 still … 1 walking
    typ: status === "working" && pose === "sit" ? 1 : 0, // 0 heads-up … 1 typing
    // Where the stage flight started, captured on its first frame so the arc
    // begins wherever the agent happens to be standing.
    flying: false,
    fx: 0,
    fz: 0,
    fHeading: yaw,
    // Last frame's status, so a live idle -> working flip is seen as a
    // TRANSITION (head for the desk now) rather than a standing fact the
    // roam brain gets around to at its next decision point.
    lastStatus: status,
  });

  const sleepy = status === "not_onboarded";
  const halted = status === "halted";

  useFrame((state, dt) => {
    // performance-based clock so timestamps stamped outside the Canvas
    // (builder.tsx) line up with what we compare against here.
    const tNow = performance.now() / 1000;
    const t = tNow + cfg.phase;
    const b = brain.current;

    /* ── Behaviour: sit ⇄ walk ⇄ stand ── */
    let speed = 0;
    let sitTarget = pose === "sit" ? 1 : 0;
    // 0 = at the desk … 1 = hovering at the stage anchor. Everything the body
    // does further down reads this rather than the flight itself.
    let staged = 0;

    if (!stage && b.flying) {
      // Landed back home - hand the body back to the roam brain.
      b.flying = false;
      rig.current.scale.setScalar(1);
    }

    if (stage) {
      // On stage: the roam brain is suspended (its state is left untouched, so
      // the return trip lands the agent back into whatever it was doing).
      if (!b.flying) {
        b.flying = true;
        b.fx = b.ox;
        b.fz = b.oz;
        b.fHeading = b.heading;
      }
      const run = clamp01((tNow - stage.at) / STAGE.flight);
      staged = glide(stage.out ? 1 - run : run);
      sitTarget = 0; // they're on their feet - or rather, off them

      const scale = stageAnchor(
        state.camera as THREE.OrthographicCamera,
        state.size,
        stagePos,
      );
      // The anchor is a world point; rig lives under the desk's group, so ask
      // that parent to convert. (Its transform is static, so its matrixWorld
      // is always current here.)
      rig.current.parent?.worldToLocal(stagePos);

      // They land with their back to you, looking up at their own console - so
      // the target facing is AWAY from the camera (+π on the direction to it).
      // One full turn is thrown in on the way, which reads as presenting
      // themselves rather than sliding across like furniture.
      state.camera.getWorldPosition(camPos);
      rig.current.getWorldPosition(selfPos);
      const want =
        Math.atan2(camPos.x - selfPos.x, camPos.z - selfPos.z) + Math.PI;
      let dh = want - b.fHeading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (staged < 0.85 || stage.out) {
        b.heading = b.fHeading + (dh + Math.PI * 2) * staged;
      } else {
        // Landed: hand the last few degrees to the same damped steer the rest
        // of the model uses, so a camera rotation is followed rather than
        // fought (and the spin's wrap can't snap at the end of the flight).
        let d = want - b.heading;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        b.heading += d * Math.min(1, dt * 8);
      }

      // A gentle hover once landed, and a lift over the office on the way.
      // Both in units of the agent's own (zoom-corrected) size, so the arc and
      // the float look the same however far in the camera is.
      const hover = Math.sin(t * 1.5) * 0.06 * scale * staged;
      const arc = Math.sin(staged * Math.PI) * 0.8 * scale;
      rig.current.position.set(
        mix(b.fx, stagePos.x, staged),
        mix(0, stagePos.y, staged) + arc + hover,
        mix(b.fz, stagePos.z, staged),
      );
      rig.current.rotation.y = b.heading;
      rig.current.scale.setScalar(mix(1, scale, staged));
    } else if (focused && !ghost) {
      // Hovered/selected: stop wherever we are (mid-stroll or at the desk) and
      // pivot to face the camera, so the person gives you their attention while
      // you read their card. The roam brain is frozen - b.st/b.path are left as
      // they were, so they carry on from the same spot once you look away.
      speed = 0;
      sitTarget = b.sit > 0.5 ? 1 : 0; // hold the current pose
      state.camera.getWorldPosition(camPos);
      rig.current.getWorldPosition(selfPos);
      const want = Math.atan2(camPos.x - selfPos.x, camPos.z - selfPos.z);
      let dh = want - b.heading;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      b.heading += dh * Math.min(1, dt * 8);
    } else if (roam && !ghost) {
      const [hx, hz] = roam.home;
      const [chx, chz] = roam.chair;
      if (!b.init) {
        b.init = true;
        b.ox = chx;
        b.oz = chz;
        b.until = tNow + 3 + Math.random() * 5;
        if (status === "working") b.until += 10 + Math.random() * 10;
      }
      // Everyone gets up and moves around their zone; working agents mostly
      // stay at the keyboard but stretch their legs now and then. Only a
      // halted unit (deliberately paused) stays glued to its chair.
      const roamEnabled = status !== "halted" && roam.zone.length > 1;
      // How long to stay seated before the next stroll.
      const sitSpan = () =>
        status === "working"
          ? 22 + Math.random() * 26
          : 6 + Math.random() * 8;
      const curTile = (): Tile => [Math.round(hx + b.ox), Math.round(hz + b.oz)];
      const planTo = (dest: Tile) => {
        const p = zonePath(roam.zone, roam.walls, curTile(), dest);
        if (!p) return false;
        b.path = p.slice(1).map(([x, z]) => [x - hx, z - hz]);
        b.st = "walk";
        return true;
      };
      const goHome = () => {
        if (!planTo(roam.home)) {
          // Cut off from the desk (world edited under us) - snap back.
          b.path = [];
          b.ox = chx;
          b.oz = chz;
          b.st = "sit";
          b.until = tNow + 4 + Math.random() * 4;
        }
      };
      const headTo = (want: number) => {
        let dh = want - b.heading;
        while (dh > Math.PI) dh -= Math.PI * 2;
        while (dh < -Math.PI) dh += Math.PI * 2;
        b.heading += dh * Math.min(1, dt * 8);
      };

      // A run starting is VISIBLE: wherever they were strolling, they turn
      // and head straight back to the keyboard (goHome replans mid-walk too).
      // Only on the TRANSITION - once seated and typing, the working-status
      // sit spans above keep them mostly at the desk.
      if (status !== b.lastStatus) {
        b.lastStatus = status;
        if (status === "working" && b.st !== "sit") goHome();
      }

      if (b.st === "sit") {
        sitTarget = Math.hypot(chx - b.ox, chz - b.oz) < 0.06 ? 1 : 0;
        b.ox += (chx - b.ox) * Math.min(1, dt * 4);
        b.oz += (chz - b.oz) * Math.min(1, dt * 4);
        headTo(yaw);
        if (roamEnabled && tNow > b.until && b.sit > 0.9) {
          const others = roam.zone.filter(([x, z]) => !(x === hx && z === hz));
          const dest = others[(Math.random() * others.length) | 0];
          if (!dest || !planTo(dest)) b.until = tNow + sitSpan();
        } else if (!roamEnabled) {
          b.until = tNow + 5 + Math.random() * 5;
        }
      } else if (b.st === "walk") {
        sitTarget = 0;
        // Wait until we're actually up off the chair before stepping out.
        if (b.sit < 0.35 && b.path.length) {
          const [tx, tz] = b.path[0];
          const dx = tx - b.ox;
          const dz = tz - b.oz;
          const d = Math.hypot(dx, dz);
          const step = dt * WALK_SPEED;
          if (d <= step + 0.02) {
            b.ox = tx;
            b.oz = tz;
            b.path.shift();
          } else {
            b.ox += (dx / d) * step;
            b.oz += (dz / d) * step;
            speed = 1;
            headTo(Math.atan2(dx, dz));
          }
        }
        if (b.path.length === 0 && b.sit < 0.35) {
          const [cx2, cz2] = curTile();
          if (cx2 === hx && cz2 === hz) {
            b.st = "sit";
            b.until = tNow + sitSpan();
          } else {
            b.st = "stand";
            b.ax = b.ox;
            b.az = b.oz;
            b.jx = b.ox;
            b.jz = b.oz;
            b.jNext = tNow + 1 + Math.random() * 2;
            b.until = tNow + 3 + Math.random() * 5;
          }
        }
      } else {
        // stand: shuffle around the tile we walked to
        sitTarget = 0;
        if (!roamEnabled || tNow > b.until) {
          // Working agents are keen to get back to their desk.
          const homeBias = status === "working" ? 0.8 : 0.55;
          if (!roamEnabled || Math.random() < homeBias) {
            goHome();
          } else {
            const others = roam.zone.filter(
              ([x, z]) => !(x === curTile()[0] && z === curTile()[1]) && !(x === hx && z === hz),
            );
            const dest = others[(Math.random() * others.length) | 0];
            if (!dest || !planTo(dest)) goHome();
          }
        } else {
          if (tNow > b.jNext) {
            b.jx = b.ax + (Math.random() - 0.5) * 0.5;
            b.jz = b.az + (Math.random() - 0.5) * 0.5;
            b.jNext = tNow + 2 + Math.random() * 3;
          }
          const dx = b.jx - b.ox;
          const dz = b.jz - b.oz;
          const d = Math.hypot(dx, dz);
          if (d > 0.015) {
            const step = Math.min(d, dt * SHUFFLE_SPEED);
            b.ox += (dx / d) * step;
            b.oz += (dz / d) * step;
            speed = 1;
            headTo(Math.atan2(dx, dz));
          }
        }
      }
    } else {
      // Static preview (ghosts): centred, facing yaw.
      b.ox *= 1 - Math.min(1, dt * 6);
      b.oz *= 1 - Math.min(1, dt * 6);
      b.heading += (yaw - b.heading) * Math.min(1, dt * 8);
    }

    // Sitting is instant while staged: they lifted off, they aren't easing out
    // of a chair on the way to the front of the room.
    b.sit += (sitTarget - b.sit) * Math.min(1, dt * (stage ? 12 : 5));
    const sit = b.sit;
    // Walking is a smoothed drive, not a flag: the cycle winds down over a
    // few frames when the agent stops (a hover landing, a waypoint reached),
    // so the legs and the bob can't cut mid-stride.
    b.spd += (speed - b.spd) * Math.min(1, dt * 8);
    const sp = b.spd;
    // While focused the agent has looked up from their work to face you.
    // That's a BLEND too - the typing wave runs at 13rad/s and the idle one at
    // 2.2, so swapping them outright jumps the hands' phase, which reads as a
    // twitch every time the pointer grazes them.
    const typing = status === "working" && sit > 0.8 && !focused;
    b.typ += ((typing ? 1 : 0) - b.typ) * Math.min(1, dt * 6);
    const typ = b.typ;

    if (!stage) {
      rig.current.position.set(b.ox, 0, b.oz);
      rig.current.rotation.y = b.heading;
    }
    lift.current.position.y = sit * 0.16;

    /* ── Pop-in on placement ── */
    const age = bornAt ? tNow - bornAt : 99;
    const pop = popCurve(clamp01(age / 0.4));
    let hopY = 0;

    /* ── Selection reaction: two happy hops + a wave ── */
    const selAge = selected ? tNow - selectedAt : 99;
    if (selAge < 0.9) {
      hopY = Math.abs(Math.sin(selAge * Math.PI * 2.2)) * 0.16 * (1 - selAge / 0.9);
    }

    /* ── Body: breathing, walk-bob, sleepy sway ── */
    const breathe = Math.sin(t * (sleepy ? 1.2 : 2.2)) * 0.012;
    const walkBob = sp * Math.abs(Math.sin(t * 9)) * 0.035;
    inner.current.position.y = hopY + walkBob;
    inner.current.scale.setScalar(pop);
    bodyG.current.scale.y = 1 + breathe;
    bodyG.current.rotation.x = sp * 0.08 + sit * 0.05;
    // Staged: a slow drift, like treading water in mid-air.
    bodyG.current.rotation.z = sleepy
      ? Math.sin(t * 0.9) * 0.04
      : staged * Math.sin(t * 1.1) * 0.05;

    /* ── Head: look around / droop / typing focus ──
       Every branch names a TARGET and the head damps toward it. Assigning the
       rotation outright (which this used to do) means changing branch jumps the
       head by however far apart the two poses are - so looking up at a hovering
       pointer was a snap, and a hover that flickers on a silhouette edge read
       as a spasm. Damped, a stray flicker is a barely-visible drift. */
    let headX: number;
    let headY: number;
    if (halted) {
      headX = 0.35;
      headY = 0;
    } else if (focused) {
      // Steady, level gaze straight at the camera.
      headX = 0;
      headY = 0;
    } else if (staged > 0.5) {
      // On stage they hold your eye, with the faintest sway.
      headX = Math.sin(t * 1.3) * 0.03;
      headY = Math.sin(t * 0.8) * 0.05;
    } else if (sleepy) {
      headX = 0.22;
      headY = Math.sin(t * 0.55) * 0.3;
    } else {
      // Down at the keyboard while typing, looking about the room otherwise.
      headX = mix(Math.sin(t * 0.9) * 0.04, 0.12 + Math.sin(t * 3) * 0.02, typ);
      headY = mix(Math.sin(t * 0.55) * 0.3, Math.sin(t * 0.7) * 0.06, typ);
    }
    const headEase = Math.min(1, dt * 8);
    head.current.rotation.x += (headX - head.current.rotation.x) * headEase;
    head.current.rotation.y += (headY - head.current.rotation.y) * headEase;

    /* ── Antenna bobble: springy counter-sway to head motion ── */
    if (bobble.current) {
      bobble.current.rotation.z = Math.sin(t * 3.1) * 0.12 + sp * Math.sin(t * 9) * 0.18;
      bobble.current.rotation.x = hopY * 2.2;
    }

    /* ── Eye glow: blink by squashing; sleepy/halted units run dim ── */
    const blinkPeriod = 3.4 + (cfg.phase % 1.7);
    const bu = (t % blinkPeriod) / 0.11;
    const blink = bu < 1 ? 1 - Math.sin(bu * Math.PI) : 1;
    eyes.current.scale.y = sleepy ? 0.3 : Math.max(0.08, blink);
    if (!ghost && eyeMatL.current && eyeMatR.current) {
      const glow = halted
        ? 0.5
        : sleepy
          ? 0.45
          : mix(
              1.25 + Math.sin(t * 2.6) * 0.15,
              1.5 + Math.sin(t * 11) * 0.25,
              typ,
            );
      eyeMatL.current.emissiveIntensity = glow;
      eyeMatR.current.emissiveIntensity = glow;
    }

    /* ── Arms: blend seated (desk) pose with standing/walking ── */
    const stretchCycle = 11 + (cfg.phase % 4);
    const su = ((t + 3) % stretchCycle) / 1.4;
    const stretch = sit < 0.5 && su < 1 ? Math.sin(su * Math.PI) : 0;
    const wave =
      selAge < 1.2 ? Math.sin(selAge * Math.PI * 6) * 0.6 * (1 - selAge / 1.2) : 0;

    // Two waves crossfaded by `typ` (see above) rather than one wave whose
    // rate and amplitude are switched.
    const armBase = -1.15;
    const armWave = (phase: number) =>
      mix(Math.sin(t * 2.2 + phase) * 0.03, Math.sin(t * 13 + phase) * 0.16, typ);
    const sitArmL = armBase + armWave(0);
    const sitArmR = armBase + armWave(Math.PI);
    const swing = sp * Math.sin(t * 9) * 0.7;
    // Hovering: arms out and drifting, holding their balance in the air.
    const floatArm = staged * (-0.5 + Math.sin(t * 1.4) * 0.12);
    const floatOut = staged * (0.85 + Math.sin(t * 1.7) * 0.08);

    armL.current.rotation.x = mix(swing, sitArmL, sit) + floatArm;
    armR.current.rotation.x = mix(-swing, sitArmR, sit) + floatArm;
    armL.current.rotation.z = mix(0.06 + stretch * 2.6, 0.12, sit) + floatOut;
    armR.current.rotation.z = mix(-0.06 - stretch * 2.6 - wave, -0.12, sit) - floatOut;

    /* ── Legs: tuck when seated, swing when walking, dangle on stage ── */
    const legSwing = sp * Math.sin(t * 9) * 0.8;
    const dangle = staged * (-0.32 + Math.sin(t * 1.3) * 0.07);
    legL.current.rotation.x = mix(-legSwing, -1.5, sit) + dangle;
    legR.current.rotation.x = mix(legSwing, -1.5, sit) + dangle * 0.7;
    legL.current.rotation.z = staged * 0.1;
    legR.current.rotation.z = -staged * 0.1;
  });

  const sc = cfg.scale;

  // Where the card is allowed to sit. drei hands us the object, the camera and
  // the canvas size once per frame; we project as it would, then hold the card
  // inside the box (see the HUD_EDGE note above).
  const { size: hudSize, measure: measureHud } = useHudSize();
  const hudPosition = useCallback(
    (
      obj: THREE.Object3D,
      cam: THREE.Camera,
      size: { width: number; height: number },
    ): [number, number] => {
      hudProj.setFromMatrixPosition(obj.matrixWorld).project(cam);
      const x = (hudProj.x * size.width) / 2 + size.width / 2;
      const y = -((hudProj.y * size.height) / 2) + size.height / 2;
      const { w, h } = hudSize.current;
      if (!w || !h) return [x, y];
      // The HUD is anchored bottom-centre (translate(-50%, -100%)), so from
      // the anchor the card runs h up and w/2 to either side. Each clamp is
      // skipped rather than inverted when the card is bigger than the canvas -
      // a narrow phone viewport should crop symmetrically, not slam the card
      // against one edge.
      const top = h + HUD_EDGE;
      const half = w / 2 + HUD_EDGE;
      return [
        half * 2 <= size.width
          ? Math.min(Math.max(x, half), size.width - half)
          : x,
        top <= size.height ? Math.max(y, top) : y,
      ];
    },
    [hudSize],
  );

  // Hover-card copy: the status label, and a plain-English line of what the
  // agent is currently up to (the running task, or a status-appropriate note).
  // Waiting beats everything else this card could say. An agent parked on a
  // question is idle by the floor's reckoning, and "Idle - waiting for the next
  // task" would be a flat contradiction of the marker over its own head.
  const statusLabel = waiting
    ? "Needs you"
    : (WORKER_STATUSES[status]?.label ?? status);
  const doing = waiting
    ? `Waiting on you: ${waiting.label}`
    : status === "working"
      ? task || "Working on a task"
      : status === "idle"
        ? "Idle - waiting for the next task"
        : status === "halted"
          ? "Halted - paused by an operator"
          : "Not onboarded yet";

  // A score is only a track record once it has runs behind it: the runtime
  // needs two graded runs before it will flag a worker, so one run's number on
  // its own would be read as a rating it hasn't earned. Ungraded, the ring
  // still renders (as a dash) - every card holding the same shape is what
  // makes a row of desks scannable.
  const graded = confidence !== null && confidenceRuns > 0;
  const band = confidenceBand(graded ? confidence : null);
  const auto = autonomy ? autonomyMeta(autonomy) : null;

  return (
    <group ref={rig}>
      <group ref={inner}>
        <group ref={lift} scale={[sc.width, sc.height, sc.width]}>
          {/* legs (pivot at hip): white shell with orange knee pads */}
          <group ref={legL} position={[-0.095, 0.24, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <boxGeometry args={[0.12, 0.22, 0.13]} />
              <Mat color={BOT.shell} ghost={ghost} />
            </mesh>
            <mesh position={[0, -0.1, 0.062]}>
              <boxGeometry args={[0.07, 0.07, 0.02]} />
              <Mat color={cfg.accent} ghost={ghost} />
            </mesh>
            <mesh position={[0, -0.21, 0.02]} castShadow>
              <boxGeometry args={[0.13, 0.06, 0.17]} />
              <Mat color={BOT.shellShade} ghost={ghost} />
            </mesh>
          </group>
          <group ref={legR} position={[0.095, 0.24, 0]}>
            <mesh position={[0, -0.11, 0]} castShadow>
              <boxGeometry args={[0.12, 0.22, 0.13]} />
              <Mat color={BOT.shell} ghost={ghost} />
            </mesh>
            <mesh position={[0, -0.1, 0.062]}>
              <boxGeometry args={[0.07, 0.07, 0.02]} />
              <Mat color={cfg.accent} ghost={ghost} />
            </mesh>
            <mesh position={[0, -0.21, 0.02]} castShadow>
              <boxGeometry args={[0.13, 0.06, 0.17]} />
              <Mat color={BOT.shellShade} ghost={ghost} />
            </mesh>
          </group>

          <group ref={bodyG}>
            {/* torso: chubby rounded shell */}
            <mesh position={[0, 0.42, 0]} scale={[1, 0.92, 0.82]} castShadow>
              <sphereGeometry args={[0.24, 20, 16]} />
              <Mat color={BOT.shell} ghost={ghost} />
            </mesh>
            {/* belt */}
            <mesh position={[0, 0.28, 0]} scale={[1, 1, 0.82]}>
              <cylinderGeometry args={[0.185, 0.2, 0.05, 18]} />
              <Mat color={BOT.shellShade} ghost={ghost} />
            </mesh>
            <mesh position={[0, 0.28, 0.155]}>
              <boxGeometry args={[0.07, 0.05, 0.03]} />
              <Mat color={cfg.accent} ghost={ghost} />
            </mesh>
            {/* chest badge */}
            <mesh position={[0, 0.47, 0.185]}>
              <boxGeometry args={[0.11, 0.08, 0.03]} />
              <Mat
                color={cfg.accent}
                ghost={ghost}
                emissive={cfg.accent}
                emissiveIntensity={0.35}
              />
            </mesh>

            {/* arms (pivot at shoulder): white with orange wrist band */}
            <group ref={armL} position={[-0.245, 0.52, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
                <Mat color={BOT.shell} ghost={ghost} />
              </mesh>
              <mesh position={[0, -0.175, 0]}>
                <cylinderGeometry args={[0.058, 0.058, 0.035, 10]} />
                <Mat color={cfg.accent} ghost={ghost} />
              </mesh>
              <mesh position={[0, -0.235, 0]} castShadow>
                <sphereGeometry args={[0.06, 10, 8]} />
                <Mat color={BOT.shell} ghost={ghost} />
              </mesh>
            </group>
            <group ref={armR} position={[0.245, 0.52, 0]}>
              <mesh position={[0, -0.11, 0]} castShadow>
                <capsuleGeometry args={[0.055, 0.16, 4, 10]} />
                <Mat color={BOT.shell} ghost={ghost} />
              </mesh>
              <mesh position={[0, -0.175, 0]}>
                <cylinderGeometry args={[0.058, 0.058, 0.035, 10]} />
                <Mat color={cfg.accent} ghost={ghost} />
              </mesh>
              <mesh position={[0, -0.235, 0]} castShadow>
                <sphereGeometry args={[0.06, 10, 8]} />
                <Mat color={BOT.shell} ghost={ghost} />
              </mesh>
            </group>

            {/* head: big white dome with the dark visor */}
            <group ref={head} position={[0, 0.62, 0]} scale={sc.head}>
              <mesh position={[0, 0.17, 0]} scale={[1, 0.9, 0.94]} castShadow>
                <sphereGeometry args={[0.26, 22, 18]} />
                <Mat color={BOT.shell} ghost={ghost} />
              </mesh>

              {/* visor - rounded dark panel across the face */}
              <mesh position={[0, 0.17, 0.17]} scale={[1, 0.62, 0.5]}>
                <sphereGeometry args={[0.19, 18, 14]} />
                <Mat color={BOT.visor} ghost={ghost} />
              </mesh>

              {/* glowing eyes */}
              <group ref={eyes} position={[0, 0.18, 0.255]}>
                <mesh position={[-0.062, 0, 0]}>
                  <boxGeometry args={[0.045, 0.07, 0.02]} />
                  {ghost ? (
                    <Mat color={BOT.eye} ghost={ghost} />
                  ) : (
                    <meshStandardMaterial
                      ref={eyeMatL}
                      color={BOT.eye}
                      emissive={BOT.eye}
                      emissiveIntensity={1.25}
                      toneMapped={false}
                    />
                  )}
                </mesh>
                <mesh position={[0.062, 0, 0]}>
                  <boxGeometry args={[0.045, 0.07, 0.02]} />
                  {ghost ? (
                    <Mat color={BOT.eye} ghost={ghost} />
                  ) : (
                    <meshStandardMaterial
                      ref={eyeMatR}
                      color={BOT.eye}
                      emissive={BOT.eye}
                      emissiveIntensity={1.25}
                      toneMapped={false}
                    />
                  )}
                </mesh>
              </group>

              {/* ear discs + optional headphone band over the dome */}
              <EarDisc side={-1} cfg={cfg} ghost={ghost} />
              <EarDisc side={1} cfg={cfg} ghost={ghost} />
              {cfg.band && (
                <mesh position={[0, 0.3, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <torusGeometry args={[0.235, 0.022, 8, 20, Math.PI]} />
                  <Mat color={cfg.accentDark} ghost={ghost} />
                </mesh>
              )}

              {/* antenna with glowing bobble */}
              <group ref={bobble} position={[0, 0.4, 0]}>
                <mesh position={[0, 0.045, 0]}>
                  <cylinderGeometry args={[0.014, 0.014, 0.1, 8]} />
                  <Mat color={BOT.antenna} ghost={ghost} />
                </mesh>
                <mesh position={[0, 0.115, 0]} castShadow>
                  <sphereGeometry args={[0.045, 12, 10]} />
                  <Mat
                    color={cfg.accent}
                    ghost={ghost}
                    emissive={cfg.accent}
                    emissiveIntensity={0.8}
                  />
                </mesh>
              </group>
            </group>
          </group>

          {/* Invisible hitbox enclosing the whole robot - the single, stable
              pointer target, so hover never flickers between moving body parts.
              `visible={false}` keeps it out of the render (and the pixel pass)
              while still receiving raycasts.

              IT HUGS THE BODY, and it lives INSIDE `lift`: that way it inherits
              the archetype's proportions, the seat lift and the pop-in instead
              of being a fixed box in rig space. The old one was 1.55 tall and
              0.85 wide around a body that tops out at ~1.23 and is ~0.74 across
              - so a third of it was empty air above the head, which is exactly
              where the status card renders. Hovering that air opened the card
              UNDER the pointer, the pointer left the canvas, the card closed,
              and the agent strobed. 1.3 clears the antenna bobble by a hair and
              nothing more. */}
          {interaction && !ghost && (
            <mesh
              position={[0, 0.6, 0]}
              visible={false}
              onPointerDown={interaction.onPointerDown}
              onPointerOver={interaction.onPointerOver}
              onPointerOut={interaction.onPointerOut}
              onClick={interaction.onClick}
            >
              <boxGeometry args={[0.78, 1.3, 0.78]} />
              <meshBasicMaterial />
            </mesh>
          )}
        </group>
      </group>

      {/* Floating HUD above the head: the status card, plus the action chips
          stacked directly beneath it when selected. One overlay, anchored
          bottom-middle (see .px-office__hud), riding along as the agent roams -
          the card always sits just above the head, the chips just below it, at
          any zoom.

          PASSING pointer-events OFF IS NOT OPTIONAL, and one place is not
          enough: drei's Html builds TWO divs of its own (the absolutely
          positioned container it appends beside the canvas, and the inner
          wrapper it renders our children into), and both default to
          `pointer-events: auto`. `.px-office__hud` being `none` only makes our
          own div transparent to hit testing - the hit then lands on drei's
          wrapper, which swallows it. So the card was an invisible interactive
          panel over the canvas: it stole the hover the moment it appeared, the
          agent unhovered, the card vanished, and round it went. Hence
          wrapperClass + style here, with the chips re-enabled in CSS. */}
      {/* THE ASK, over the head, ALWAYS.

          Everything else on this agent is hover-revealed, and this deliberately
          is not: a run that stopped for a person is only useful if the person
          finds out without going looking. It is the one thing on the floor that
          announces itself.

          It rides a HIGHER anchor than the status card and hides while that
          card is open, so the two never stack on top of each other - hovering
          the agent replaces "there is something to answer" with the card that
          says what, which is the same information one level down. */}
      {!ghost && waiting && !showLabel && (
        <Html
          position={[0, 1.62, 0]}
          zIndexRange={[2000, 1000]}
          calculatePosition={hudPosition}
          wrapperClass="px-office__hudwrap"
          style={{ pointerEvents: "none" }}
        >
          {/* The px-office__hud wrapper is what centres this over the head -
              the anchor is a point, and without the -50% translate the pill
              hangs off to one side of the agent instead of above them. */}
          <div className="px-office__hud">
            <div className="px-office__ask" data-risk={waiting.risk}>
              {/* The hand itself is the ::before, so the wave can rotate the
                  emoji from the wrist without wobbling the badge circle. */}
              <span className="px-office__ask-hand" aria-hidden="true" />
              <span className="px-office__ask-what">
                <strong>Needs approval</strong>
              </span>
            </div>
          </div>
        </Html>
      )}

      {/* THE POP: a moment, not a state. It announces itself like the ask
          does (nobody hovers in time for news), rides a higher anchor when
          the ask is up so the two never overlap, and yields to the status
          card the same way. The `key` matters: a fresh pop on the same agent
          remounts the div, which is what restarts the entry animation. Same
          drei Html rules as everything else over this canvas - wrapperClass
          AND style, or it eats the hover that would open the card. */}
      {!ghost && pop && !showLabel && (
        <Html
          position={[0, waiting ? 2.0 : 1.62, 0]}
          zIndexRange={[2000, 1000]}
          calculatePosition={hudPosition}
          wrapperClass="px-office__hudwrap"
          style={{ pointerEvents: "none" }}
        >
          <div className="px-office__pop" data-kind={pop.kind} key={pop.id}>
            <span className="px-office__pop-dot" aria-hidden="true" />
            <span className="px-office__pop-text">{pop.text}</span>
          </div>
        </Html>
      )}

      {!ghost && (showLabel || chips) && (
        <Html
          position={[0, 1.5, 0]}
          /* WIDE ON PURPOSE. drei spreads this range linearly over the whole
             camera depth (near -100 to far 400, so 500 units) and rounds to an
             integer, which is what decides whether the near agent's card
             covers the far one's or the other way round. The old [30, 0] gave
             one z step per ~17 world units - every agent in a room 8 tiles
             across landed on the SAME z, so DOM order won and the card stack
             didn't flip as the camera lapped the floor. ~2 steps per tile
             fixes it. The band sits at 1000-2000 so it stays clear of the
             office's own layers (.px-stage above, chips below), and
             `isolation` on .px-office keeps these numbers off the page. */
          zIndexRange={[2000, 1000]}
          calculatePosition={hudPosition}
          wrapperClass="px-office__hudwrap"
          style={{ pointerEvents: "none" }}
        >
          <div className="px-office__hud" ref={measureHud}>
            {showLabel && label && (
              <div
                className="px-office__card"
                data-status={waiting ? "waiting" : status}
              >
                <div className="px-office__card-head">
                  <span className="px-office__card-dot" aria-hidden="true" />
                  <span className="px-office__card-who">
                    <span className="px-office__card-name">{label}</span>
                    {jobTitle && (
                      <span className="px-office__card-role">{jobTitle}</span>
                    )}
                  </span>
                  <span className="px-office__card-status">{statusLabel}</span>
                </div>
                {/* The standing row: the score as a RING beside what the
                    agent is doing. The ring is the shared ConfidenceRing, not
                    a second implementation - the card re-points the theme
                    tokens it reads for a dark plate (see the CSS). It leads
                    because it is the one thing here you cannot infer from
                    watching the floor. */}
                <div className="px-office__card-mid">
                  <ConfidenceRing
                    score={graded ? confidence : null}
                    size={46}
                    showLabel={false}
                  />
                  <div className="px-office__card-lines">
                    <p className="px-office__card-task">{doing}</p>
                    {/* NO `title` anywhere on this card: it is
                        `pointer-events: none` by design (see the HUD note
                        above), so a tooltip could never be triggered. Whatever
                        it has to say, it says on its face. */}
                    <p
                      className="px-office__card-band"
                      style={{ color: band.color }}
                    >
                      {graded
                        ? `${band.label} over ${confidenceRuns} run${confidenceRuns === 1 ? "" : "s"}`
                        : "No graded runs yet"}
                    </p>
                  </div>
                </div>
                {/* The two facts that decide whether to leave it alone: how
                    much it is allowed to change, and whether it is actually
                    running. One per end of the row, so neither gets read as a
                    caption of the other. */}
                {(auto || lastRunAt || status === "working") && (
                  <div className="px-office__card-foot">
                    {auto && (
                      // `act` is the one caution on this card: an unattended
                      // run may change real records.
                      <span
                        className={
                          "px-office__mode" +
                          (autonomy === "act" ? " is-act" : "")
                        }
                      >
                        {auto.short}
                      </span>
                    )}
                    {/* An agent that IS running does not report when it last
                        did. "ran 8m ago" beside a Working badge, on a card
                        floating over an agent you can watch typing, is the
                        card contradicting the floor - and the last run is the
                        stale half of that pair. Present tense wins while there
                        is a present tense to report. */}
                    <span
                      className="px-office__ran"
                      data-live={status === "working" || undefined}
                    >
                      {status === "working"
                        ? "running now"
                        : lastRunAt
                          ? ranPhrase(lastRunAt)
                          : "never run"}
                    </span>
                  </div>
                )}
              </div>
            )}
            {chips}
          </div>
        </Html>
      )}
    </group>
  );
}
