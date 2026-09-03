// The arrival: on the office's first paint the whole diorama falls out of
// the sky and lands in place - the floor sweeps in as a diagonal wave of
// tiles, the walls thud down along their runs a beat later, the furniture
// drops piece by piece in a shuffled order, and finally the agents pop in
// at their desks. One plan is computed up front from the layout (this
// file); the Floor mesh and ItemWrap read their element's delay from it and
// drive the shared drop curve below, so every faller squashes, rebounds and
// settles the same way.
//
// The plan's `start` is 0 until the first rendered frame stamps it
// (stampIntro), so the show is timed from when the scene actually draws -
// not from mount, which can sit a shader-compile behind the first frame.

import { hash32 } from "./palette";
import { keyOf, wallKey, type OfficeLayout } from "../../lib/office-layout";

export type IntroPlan = {
  /** Performance-clock second the show began. 0 = not started yet; the
      first frame that reads the plan stamps it (see stampIntro). */
  start: number;
  /** Element key -> seconds after `start` that its drop begins. */
  tiles: Map<string, number>;
  walls: Map<string, number>;
  items: Map<string, number>;
  /** Worker id -> absolute-style delay for the agent's pop-in (they appear
      AT their desk once it has landed, they don't fall). */
  agents: Map<string, number>;
  /** Seconds after `start` when everything has settled. */
  total: number;
};

export const DROP = {
  /** Seconds an element spends falling. */
  fall: 0.38,
  /** World units above rest the fall starts from. */
  height: 9,
  /** Seconds from first contact until the squash has rung out. */
  settle: 0.55,
};

/** Small head start between the first frame and the first faller, so the
    camera and sky are on screen before anything moves. */
const GRACE = 0.15;

export type DropFrame = {
  /** World-space lift above rest. */
  y: number;
  /** Vertical squash/stretch factor. */
  sy: number;
  /** Horizontal counter-stretch factor (volume conservation, roughly). */
  sxz: number;
  /** Falling tilt fraction: 1 at release, eased to 0 by touchdown. */
  wobble: number;
  /** True before this element's drop has begun - it should be hidden. */
  pending: boolean;
  /** True once fully settled - callers resume their normal animation. */
  done: boolean;
};

/**
 * The one drop curve, time-local: t is seconds since THIS element's drop
 * began. Quadratic (gravity) fall with a slight vertical stretch, a hard
 * squash on impact that rings back through one overshoot, and two fast
 * damped rebound hops - the shape of something heavy but rubbery.
 */
export function dropMotion(t: number): DropFrame {
  if (t <= 0) {
    return { y: DROP.height, sy: 1, sxz: 1, wobble: 1, pending: true, done: false };
  }
  if (t < DROP.fall) {
    const u = t / DROP.fall;
    return {
      y: DROP.height * (1 - u * u),
      sy: 1 + 0.12 * u,
      sxz: 1 - 0.07 * u,
      wobble: 1 - u * u,
      pending: false,
      done: false,
    };
  }
  const s = t - DROP.fall;
  if (s >= DROP.settle) {
    return { y: 0, sy: 1, sxz: 1, wobble: 0, pending: false, done: true };
  }
  let y = 0;
  if (s < 0.16) y = 0.26 * Math.sin((s / 0.16) * Math.PI);
  else if (s < 0.26) y = 0.055 * Math.sin(((s - 0.16) / 0.1) * Math.PI);
  // cos ring: full squash at the instant of contact, one overshoot past 1,
  // then damped to rest well inside `settle`.
  const ring = Math.cos(s * 24) * Math.exp(-s * 8.5);
  return {
    y,
    sy: 1 - 0.42 * ring,
    sxz: 1 + 0.26 * ring,
    wobble: 0,
    pending: false,
    done: false,
  };
}

/** Stamp the show's start on the first frame that asks; return it. Shared
    mutable state on the plan, so every reader times off the same second. */
export function stampIntro(plan: IntroPlan): number {
  if (plan.start === 0) plan.start = performance.now() / 1000 + GRACE;
  return plan.start;
}

/** Deterministic 0..1 from a key - the per-element "slightly irregular". */
const jitter = (key: string) => (hash32(key) % 4096) / 4096;

/**
 * Choreograph the layout. Phase starts overlap a little (walls begin while
 * the far corner of the floor is still landing) so the show reads as one
 * continuous crash of arrivals, not three polite queues. Steps are capped
 * so a huge office compresses its wave instead of stretching the show.
 */
export function buildIntroPlan(layout: OfficeLayout): IntroPlan | null {
  if (layout.tiles.length === 0 && layout.items.length === 0) return null;

  // Floor: a diagonal wave from the lowest (x+z) corner, tile jitter on top.
  let minSum = Infinity;
  let maxSum = -Infinity;
  for (const [x, z] of layout.tiles) {
    if (x + z < minSum) minSum = x + z;
    if (x + z > maxSum) maxSum = x + z;
  }
  const tileStep = Math.min(0.022, 0.85 / Math.max(1, maxSum - minSum));
  const tiles = new Map<string, number>();
  let tileEnd = 0;
  for (const [x, z] of layout.tiles) {
    const key = keyOf(x, z);
    const d = (x + z - minSum) * tileStep + jitter(key) * 0.07;
    tiles.set(key, d);
    if (d > tileEnd) tileEnd = d;
  }

  // Walls: same sweep direction, starting while the floor wave is still
  // rolling, with a heavier jitter so runs land raggedly.
  const wallBase = tileEnd * 0.55 + 0.2;
  const wallStep = Math.min(0.02, 0.6 / Math.max(1, maxSum - minSum));
  const walls = new Map<string, number>();
  let wallEnd = wallBase;
  for (const w of layout.walls) {
    const key = wallKey(w.x, w.z, w.o);
    const d = wallBase + (w.x + w.z - minSum) * wallStep + jitter(key) * 0.14;
    walls.set(key, d);
    if (d > wallEnd) wallEnd = d;
  }

  // Furniture: one after another in a hash-shuffled order - never the
  // placement order, so the rhythm skips around the room.
  const itemBase = (layout.walls.length ? wallEnd * 0.7 : tileEnd * 0.8) + 0.25;
  const itemStep = Math.min(0.075, 1.1 / Math.max(1, layout.items.length));
  const order = [...layout.items].sort((a, b) => jitter(a.id) - jitter(b.id));
  const items = new Map<string, number>();
  let itemEnd = itemBase;
  order.forEach((it, i) => {
    const d = itemBase + i * itemStep + jitter(it.id + "~") * 0.05;
    items.set(it.id, d);
    if (d > itemEnd) itemEnd = d;
  });

  // Agents: pop in at their desk a beat after it lands.
  const agents = new Map<string, number>();
  let agentEnd = 0;
  for (const a of layout.agents) {
    const d = (items.get(a.deskId) ?? itemEnd) + DROP.fall + 0.16;
    agents.set(a.workerId, d);
    if (d + 0.45 > agentEnd) agentEnd = d + 0.45;
  }

  const lastDrop = Math.max(tileEnd, wallEnd, itemEnd);
  return {
    start: 0,
    tiles,
    walls,
    items,
    agents,
    total: Math.max(lastDrop + DROP.fall + DROP.settle, agentEnd) + 0.2,
  };
}
