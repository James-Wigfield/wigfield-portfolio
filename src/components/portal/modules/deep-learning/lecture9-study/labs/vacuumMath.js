/* ============================================================================
   §3 · THIS PAGE'S OWN ROBOTIC-VACUUM SIMULATION  (slide 12's policy)
   ----------------------------------------------------------------------------
   Slide 12's stochastic policy, run in a room this page made up:
     every second, with probability p the robot moves forward; otherwise
     (probability 1 − p) it rotates left or right by a random angle in
     [−r, +r] degrees. Its reward is the dust it picks up in 30 minutes
     (1,800 one-second steps).
   Everything else is this page's own (the slides give no room):
     ROOM        a 6 m × 4 m room with DUST_N specks of dust, laid out once
                 from a fixed seed
     the robot   0.34 m across (it picks up every speck under it), moves
                 0.15 m per forward second, starts in the middle facing right
     walls       a forward move that would cross a wall doesn't happen: the
                 robot stays put that second (only a rotation frees it)
     RNG         each run is seeded with the same seed, so a given (p, r)
                 always gives the same trajectory and the same dust count
   ========================================================================== */
import { rng } from '../rl.js';

export const ROOM_W = 6;
export const ROOM_H = 4;
export const RADIUS = 0.17;
export const SPEED = 0.15;
export const DUST_N = 400;
export const STEPS_30MIN = 1800;
const RUN_SEED = 12;

// the dust layout: uniform in the room, a fixed seed
export const DUST = (() => {
  const R = rng(20261024);
  return Array.from({ length: DUST_N }, () => [0.05 + R.next() * (ROOM_W - 0.1), 0.05 + R.next() * (ROOM_H - 0.1)]);
})();

// a coarse grid of dust indices, so each step only checks the specks nearby
const CELL = 0.5;
const GW = Math.ceil(ROOM_W / CELL);
const GH = Math.ceil(ROOM_H / CELL);
const BUCKETS = (() => {
  const b = Array.from({ length: GW * GH }, () => []);
  DUST.forEach(([x, y], i) => b[Math.min(GH - 1, Math.floor(y / CELL)) * GW + Math.min(GW - 1, Math.floor(x / CELL))].push(i));
  return b;
})();

function sweep(x, y, picked, order, t) {
  const cx = Math.floor(x / CELL);
  const cy = Math.floor(y / CELL);
  let n = 0;
  for (let gy = Math.max(0, cy - 1); gy <= Math.min(GH - 1, cy + 1); gy++) {
    for (let gx = Math.max(0, cx - 1); gx <= Math.min(GW - 1, cx + 1); gx++) {
      for (const i of BUCKETS[gy * GW + gx]) {
        if (picked[i] >= 0) continue;
        const dx = DUST[i][0] - x;
        const dy = DUST[i][1] - y;
        if (dx * dx + dy * dy <= RADIUS * RADIUS) { picked[i] = t; order.push(i); n += 1; }
      }
    }
  }
  return n;
}

/* One run of slide 12's policy for `steps` seconds.
   Returns the trajectory (x, y, heading per second, start included), the
   second each speck was picked up (−1 = never), and the count. */
export function runVacuum(p, rDeg, { steps = STEPS_30MIN, seed = RUN_SEED } = {}) {
  const R = rng(seed);
  let x = ROOM_W / 2;
  let y = ROOM_H / 2;
  let h = 0; // radians, 0 = facing right, positive = clockwise on screen
  const picked = new Int16Array(DUST_N).fill(-1);
  const order = [];
  const path = [[x, y, h]];
  let count = sweep(x, y, picked, order, 0);
  let forward = 0;
  let blocked = 0;
  let turns = 0;
  for (let t = 1; t <= steps; t++) {
    const u = R.next();
    const ang = (R.next() * 2 - 1) * rDeg; // drawn every second, so p and r change one thing at a time
    if (u < p) {
      const nx = x + SPEED * Math.cos(h);
      const ny = y + SPEED * Math.sin(h);
      if (nx >= RADIUS && nx <= ROOM_W - RADIUS && ny >= RADIUS && ny <= ROOM_H - RADIUS) {
        x = nx;
        y = ny;
        forward += 1;
        count += sweep(x, y, picked, order, t);
      } else {
        blocked += 1;
      }
    } else {
      h += (ang * Math.PI) / 180;
      turns += 1;
    }
    path.push([x, y, h]);
  }
  return { path, picked, order, count, forward, blocked, turns };
}

/* Slide 14's first generation: 100 random policies, each tried out on a
   shorter run (this page's own: SHORT_STEPS seconds). Sorted best first. */
export const SHORT_STEPS = 600;
export function firstGeneration(n = 100, seed = 1414) {
  const R = rng(seed);
  const pols = Array.from({ length: n }, (_, id) => ({ id, p: Math.round(R.next() * 100) / 100, r: Math.round(R.next() * 180) }));
  return pols.map((q) => ({ ...q, score: runVacuum(q.p, q.r, { steps: SHORT_STEPS }).count }));
}
