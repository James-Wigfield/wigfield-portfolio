/* ============================================================================
   PROJECTOR LIFE — world-space free fall (bodies that let go of a surface)
   ----------------------------------------------------------------------------
   A body that leaves a patch (a creature that can't hold on, a particle the
   roof peels off, a waste pellet) flies ballistically in WORLD space under
   the toy gravity, stays inside the octagon (bounces off the wall planes),
   and lands on whatever the room's landing(x, z, fromY) says is below it:
   floor, loft deck or a furniture top. Mid-air bodies are not projectable;
   the host lists them in airborne() and the Stage draws them in 3-D.
   ========================================================================== */

/** Toy gravity, m/s². Real g would make a 22 cm pendulum swing at 1 Hz and
 *  a fall from the eave last 0.68 s — too quick to read on a wall — so the
 *  creature world runs at 0.3 g (scaled further by cr.gscale). */
export const TOY_G = 9.81 * 0.3;

/**
 * Advance one falling body by dt. Body: { x, y, z, vx, vy, vz, ymax }.
 * Returns the landing record when it comes to rest, else null.
 */
export function stepFall(b, dt, g, landing, walls) {
  const y0 = b.y;
  b.vy -= g * dt;
  b.x += b.vx * dt;
  b.y += b.vy * dt;
  b.z += b.vz * dt;
  if (b.y > b.ymax) b.ymax = b.y;
  // stay inside the room: bounce off any wall plane we are about to pass
  for (const w of walls) {
    const d = (b.x - w.origin[0]) * w.normal[0] + (b.z - w.origin[2]) * w.normal[2];
    if (d < 0.04) {
      b.x += (0.04 - d) * w.normal[0];
      b.z += (0.04 - d) * w.normal[2];
      const vn = b.vx * w.normal[0] + b.vz * w.normal[2];
      if (vn < 0) {
        b.vx -= 1.5 * vn * w.normal[0];
        b.vz -= 1.5 * vn * w.normal[2];
      }
    }
  }
  if (b.vy > 0) return null;
  let L = null;
  try {
    L = landing ? landing(b.x, b.z, Math.max(y0, b.y) + 0.001) : null;
  } catch {
    L = null;
  }
  const floorY = L && Number.isFinite(L.y) ? L.y : 0;
  if (b.y <= floorY) {
    b.y = floorY;
    return L || { y: 0, patchId: 'floor', local: null, surface: 'floor' };
  }
  return null;
}
