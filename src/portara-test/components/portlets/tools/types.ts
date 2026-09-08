/**
 * What every tool module hands back. The tool is built in the portlet's own
 * model units (the portlet is about 1.15 tall in them, its hand 0.12 across)
 * with the GRIP AT THE ORIGIN and the handle running along -y, so a tool
 * carried in a hanging arm hangs straight down. The scene scales it with the
 * portlet.
 *
 * `tip` is the one point of the tool that touches the work, and `axis` the
 * direction the tip travels to make contact; the scene turns the tool so
 * `axis` points INTO the surface (against its normal) and puts `tip` on it.
 * Everything else about where the tool is follows from those two vectors and
 * the grip, so no distance is ever hard-coded per tool anywhere else.
 */
import type * as THREE from "three";

export type ToolId = "hammer" | "buffer" | "brush" | "torch" | "wrench" | "vacuum";

/** What the tool's roll (its turn about `axis`) is measured against. */
export type RollMode =
  /** `up` points from the tip toward the portlet's shoulder, in the surface plane (a hammer's handle). */
  | "shoulder"
  /** `up` points toward the world's up, in the surface plane (a brush held upright). */
  | "up";

export interface ToolSpec {
  id: ToolId;
  group: THREE.Group;
  /** The contact point, tool space. */
  tip: THREE.Vector3;
  /** Unit, tool space: the tip meets the surface travelling along this. */
  axis: THREE.Vector3;
  /** Unit, tool space, perpendicular to `axis`: the roll reference. */
  up: THREE.Vector3;
  roll: RollMode;
  /** Model units: the surface has to be flat this far around the tip for the
      whole working face to sit on it. */
  footprint: number;
  /** Tool-space points that must never be inside a letter; the debug check
      raycasts them every frame. */
  probes: THREE.Vector3[];
  /** How the grip sits in the hand socket while carried (model units). */
  carry: { position: THREE.Vector3; rotation: THREE.Euler };
  /** Per-frame hook for moving parts: `working` is 0..1 how hard the tool is in use. */
  tick?: (dt: number, working: number, time: number) => void;
  dispose: () => void;
}
