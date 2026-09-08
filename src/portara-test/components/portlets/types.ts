/** Types shared between the portlet, its actions and the manager. */
import * as THREE from "three";
import type { ActionKind } from "./config";
import type { Candidate, LetterContacts } from "./contact";
import type { Props } from "./props";
import type { ToolId, ToolSpec } from "./tools";

/** The joint angles the animation drives (radians, relative to rest), plus
    the body's ride height. */
export type Pose = {
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
export const REST: Pose = {
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
export const POSE_KEYS = Object.keys(REST) as (keyof Pose)[];

/** A place to stand and work: the contact, where to stand, which way to
    face, and how much the body rides up or down to reach. */
export type Spot = {
  contact: Candidate;
  stance: THREE.Vector3;
  heading: number;
  ride: number;
};

export type Stance = { stance: THREE.Vector3; heading: number; ride: number };

/** Everything an action needs to plan a job on a letter. */
export type PlanContext = {
  mesh: THREE.Mesh;
  contacts: LetterContacts;
  tool: ToolSpec;
  /** Portlet scale, model units -> world. */
  scale: number;
  /** The letter's world scale. */
  letterScale: number;
  /** Where to stand to put the tool's tip at p (world) along n (world); null if out of reach. */
  solve: (p: THREE.Vector3, n: THREE.Vector3) => Stance | null;
  /** Can the tool use this contact: it needs the surface flat (nothing else
      to clip into) for `extra` world units beyond its footprint, and fully
      ON the surface (no overhang) for `edge` world units round the point,
      for whatever must sit on the letter: a nail's head, a bolt's washer, a
      polishing pad. */
  usable: (c: Candidate, extra: number, edge: number) => boolean;
  props: Props;
  /** The word's "right" direction in the world (along the row), and up. */
  right: THREE.Vector3;
  /** How far the right shoulder sits from the body's centre (world). */
  shoulderSide: number;
};

/** A container the brush dips into: the check that only the bristles enter. */
export type CanTarget = {
  centre: THREE.Vector3;
  /** World y of the paint's surface, of the rim, and of the inside bottom. */
  paintY: number;
  rimY: number;
  bottomY: number;
  innerR: number;
  /** How far under the paint the tip may go (the bristles' length). */
  maxUnder: number;
};

/** What an action reports each frame for the portlet to realise. */
export type WorkFrame = {
  /** World: where the tool's tip must be, and the surface normal there. */
  tip: THREE.Vector3;
  normal: THREE.Vector3;
  /** Extra turn of the tool about the normal (a socket wrench's stroke). */
  rollAngle: number;
  /** Rotate the tool about its grip so the tip lifts off along the normal
      by this angle (a hammer's swing). Zero: the tip is on `tip`. */
  swing: number;
  /** 0..0.3 compression of the tool along its axis, anchored at the tip. */
  squash: number;
  /** 0..1 how hard the tool is in use (spinning pad, arc). */
  working: number;
  /** Carry the tool in the hand this frame instead of solving it. */
  hold: boolean;
  /** Pose overrides: the free arm, the head, the body. */
  pose: Partial<Pose>;
  lookAtTip: boolean;
  /** Upward kick to the ride spring this frame (a blow's recoil). */
  recoil: number;
  /** Go here (then the portlet calls arrived()). */
  moveTo: Stance | null;
  /** Turn on the spot to face this way while working (the tool stays solved). */
  faceHeading: number | null;
  /** The tool is dipping into this; the portlet checks nothing but the tip enters it. */
  can: CanTarget | null;
  done: boolean;
};

export function makeFrame(): WorkFrame {
  return {
    tip: new THREE.Vector3(),
    normal: new THREE.Vector3(0, 0, 1),
    rollAngle: 0,
    swing: 0,
    squash: 0,
    working: 0,
    hold: false,
    pose: {},
    lookAtTip: true,
    recoil: 0,
    moveTo: null,
    faceHeading: null,
    can: null,
    done: false,
  };
}

export function resetFrame(f: WorkFrame) {
  f.rollAngle = 0;
  f.swing = 0;
  f.squash = 0;
  f.working = 0;
  f.hold = false;
  f.pose = {};
  f.lookAtTip = true;
  f.recoil = 0;
  f.moveTo = null;
  f.faceHeading = null;
  f.can = null;
  f.done = false;
}

/** What an action may read about the portlet doing it. */
export type PortletView = {
  /** The right shoulder, world. */
  shoulder: THREE.Vector3;
  time: number;
  scale: number;
  /** Facing (rad) and whether a requested turn has finished. */
  heading: number;
  oriented: boolean;
};

export interface Action {
  readonly kind: ActionKind;
  readonly toolId: ToolId;
  /** Plan the spots on this letter; null when the letter offers nothing the tool can use. */
  plan(ctx: PlanContext): Spot[] | null;
  /** Start work at spot i: the portlet is there, facing the letter, tool drawn. */
  start(i: number): void;
  /** After a moveTo: the portlet is where it asked to be. */
  arrived(): void;
  update(dt: number, frame: WorkFrame, view: PortletView): void;
  /** Over, finished or not: hide props, release effects. */
  end(): void;
  /** Where the job is, for the console and the soak test. */
  describe(): string;
}

export type Job = {
  letter: number;
  mesh: THREE.Mesh;
  action: Action;
  tool: ToolSpec;
  spots: Spot[];
  spot: number;
  /** The word-space x of the end of the word they walk round. */
  endX: number;
};
