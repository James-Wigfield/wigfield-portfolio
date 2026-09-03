/* The workspace vignette's framing, and the one piece of it the page outside
   needs to know about.

   Two files care where the agent's chest lands on screen: workspace-demo.tsx,
   which draws the room, and the landing page's tour, which fires packets out
   of the agent and therefore has to launch them from exactly that point. That
   used to be a hand-tuned pixel pair in one file kept "in step" with a comment
   in the other - which is a coupling that survives precisely until the room is
   moved, resized, or framed against a differently shaped box.

   So the projection is written down once, here, as arithmetic. No three.js:
   the tour imports this to position a DOM element and must not drag a 2.7MB
   renderer along with it. */

/** Where the room is centred on its floor grid, for the camera. */
export const CENTRE: [number, number] = [1.5, 1];

/**
 * How the room is centred in its canvas, vertically.
 *
 * NOT the tile grid's middle. At the fixed isometric camera a point projects
 * to screen_x proportional to (x - z) and screen_y to 0.8165y - 0.4082(x + z),
 * so the scene's screen-space box runs from the top of the back-left wall down
 * to the front-right floor corner, and the middle of THAT is above the grid's.
 * Aiming at the grid pushed the whole room down the frame. This is the box's
 * vertical middle solved back into world space; horizontally the two coincide.
 */
export const TARGET_Y = 0.34;

/** World units framed across and down. The room shares its frame with a rail
    full of deliveries landing, and a diorama that dominates makes those look
    like a footnote - so it is framed to sit in its half, not to fill the box. */
export const FRAME_W = 7.4;
export const FRAME_H = 5.4;

/**
 * How far RIGHT of its canvas the room sits, in world units.
 *
 * The packets fly leftward into the toolbox, so the room is pushed off-centre
 * the other way to give them a run at it: dead centre, the flight is short and
 * cramped and the left of the box sits empty. Moving the camera's target left
 * along screen-right is what moves the room right.
 */
export const SHIFT_RIGHT = 1;

/**
 * The seated agent's chest, in world space - where a packet is emitted from.
 *
 * The desk group sits at (1, 0, 1) yawed -pi/2 with the agent at (0, 0, 0.18)
 * inside it, which puts the agent's own origin at (0.82, 0, 1); 0.95 is chest
 * height on a seated sprite.
 */
export const CHEST: [number, number, number] = [0.82, 0.95, 1];

/** Screen-right, in world space, at the fixed camera: normalize(1, 0, -1). */
const SQRT2 = Math.SQRT2;
/** |(-1, 2, -1)| - the screen-up axis before normalising. */
const SQRT6 = Math.sqrt(6);

/** Where the camera looks: the framing centre, shifted along screen-left. */
export const TARGET: [number, number, number] = [
  CENTRE[0] - SHIFT_RIGHT / SQRT2,
  TARGET_Y,
  CENTRE[1] + SHIFT_RIGHT / SQRT2,
];

/** Pixels per world unit for a canvas of this size - fit, never crop. */
export function roomZoom(w: number, h: number): number {
  return Math.min(w / FRAME_W, h / FRAME_H);
}

/**
 * The agent's chest in CSS pixels from the top-left of a canvas this size.
 *
 * The camera is orthographic and fixed, so this is two dot products: the
 * offset from the camera target onto screen-right and screen-up, scaled by
 * the same zoom the renderer will pick for the same box.
 */
export function chestInBox(w: number, h: number): { x: number; y: number } {
  const zoom = roomZoom(w, h);
  const dx = CHEST[0] - TARGET[0];
  const dy = CHEST[1] - TARGET[1];
  const dz = CHEST[2] - TARGET[2];
  const right = (dx - dz) / SQRT2;
  const up = (-dx + 2 * dy - dz) / SQRT6;
  return { x: w / 2 + right * zoom, y: h / 2 - up * zoom };
}
