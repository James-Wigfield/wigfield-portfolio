/* The title block's scale bar: the nicest round length near TARGET_PX on screen. */

const NICE = [0.1, 0.2, 0.25, 0.5, 1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200];
const TARGET_PX = 64;

/** { metres, px } for `mpp` metres per CSS pixel, near `target` px long. */
export function scaleFor(mpp, target = TARGET_PX) {
  let best = NICE[0];
  for (const m of NICE) if (Math.abs(m / mpp - target) < Math.abs(best / mpp - target)) best = m;
  return { metres: best, px: best / mpp };
}
