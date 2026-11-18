/* ============================================================================
   PROJECTOR LIFE — creatures: a "Plate VII" prototype
   ----------------------------------------------------------------------------
   Agents with a body, N feet, grip and mass, living in patch coordinates and
   crossing seams. HONEST NOTE: the three gait families below are
   HAND-WRITTEN (crawl, insect stepping, pendulum brachiation); selection
   only tunes the numbers in each creature's trait vector. The real Plate VII
   would evolve the gaits themselves (merger plan, phase 4).

   Gaits by habitat (habitat = the patch's surface type):
   - floor   CRAWL. Gravity presses in; grip buys nothing and costs energy.
   - wall    INSECT STEPPING: feet in two alternating groups (tripod-like);
             while one group swings the other must hold the shear
             grip × FOOT × planted ≥ mass × gscale × |g_t|. If not, the
             creature SLIPS and slides down, re-grips with all feet, or
             slides all the way to the floor (and becomes a floor dweller).
   - ceiling Either an inverted crawl (same rule, against the pull-off
             |g_n| plus half the downslope |g_t|, with pads holding half as
             well against peel as against shear), or — with probability =
             the swing-propensity trait — PENDULUM HANG + BRACHIATION: one
             hand on an anchor, the body a spherical pendulum of length
             cr.swing below it (seen from below: a spring pulling the body
             back toward the anchor). It pumps the swing toward where it
             wants to go, lets go near the top of the swing while still
             moving forward, flies free for cr.flight × trait seconds, then
             re-grips if it is still within reach. The hand must hold the
             rope tension (gravity along the rope + v²/L, in body weights):
             grip × HAND ≥ mass × gscale × tension.
   Whenever a hold fails off the floor the creature FALLS: world-space
   ballistic flight (fall.js), landing on the floor / loft deck / a furniture
   top via the room's landing(). A hard landing (mass × gscale × drop >
   1.6) kills (selection on). Mid-air bodies are listed by airborne().

   Light selection toy: trait vector = feet, grip, mass, swing propensity,
   free-flight time, stored as GENES relative to the cr.* sliders (so the
   sliders act live and evolution shifts the genes). Falling, starving and
   old age kill; vacancies per habitat (cr.floor / cr.wall / cr.ceiling) are
   filled by births from that habitat's best-fed members, with mutation
   (cr.mutation). Food = the sim under the body (Gray-Scott v, Physarum
   trail, Particle Life glow) plus a little ambient, depleted where grazed.
   Optional food web (cr.detritus): the dead and the ceiling's waste pellets
   fall and become detritus on the floor; floor scavengers seek it.
   ========================================================================== */

import { TOY_G, stepFall } from './fall.js';
import { dirToWorld, toWorld, wrapAngle } from './lib/geom.js';
import { DETRITUS_RGB, HABITAT_RGB } from './palettes.js';

const HABS = ['floor', 'wall', 'ceiling'];
const FOOT = 0.4; //      body weights one adhesive foot holds (in shear) at grip 1
const HAND = 2.6; //      body weights one hooked hand holds at grip 1 (hang; a gibbon's peak is ~2)
const SPEED = { floor: 0.16, wall: 0.1, ceiling: 0.07 };
const LEG = 0.13; //          foot reach from the body (m): a ~30 cm creature reads from across the room
const STRIDE = 0.06;
const WANDER_CROSS = 0.04; // chance to step onto a surface of another type (habitat fidelity)
const HARD_LANDING = 1.6; //  mass × gscale × drop (m) above this kills
const REACH_K = 1.6; //       re-grip reach, × swing length
const HOOK = 0.6; //         a hooked hand holds up to 60 % more when the pull runs along the surface
const PEEL_K = 0.45; //       adhesive pads hold far less against peel (ceiling) than shear (wall)
const PUMP = 0.5; //          pumping acceleration, × toy g
const DETRITUS_MAX = 160;
const FALLERS_MAX = 220;
const GRAZE_CELL = 0.1; //    m, grazing depletion grid

/** Energy economy (exported so the checks can sweep it). Units: energy/s. */
export const CR_TUNE = {
  ambient: 0.3, //   food everywhere, even on black: creatures can live on an 'off' patch
  eat: 0.4, //       intake at food 1, × mass^0.75
  graze: 0.3, //     depletion per second of eating (×k) on a 10 cm cell
  regrow: 0.12, //   fraction of depletion that recovers per second
  base: 0.016, //    × mass^massExp
  foot: 0.0015, //   per foot
  gripCost: 0.0025, // × grip^gripExp × (feet + 1) (adhesive upkeep: wasted on the floor)
  regrip: 0.55, //   s a slipping creature slides before it can try to re-grip
  massExp: 1, //     base upkeep ∝ mass^massExp (intake ∝ mass^0.75: big bodies need rich food)
  gripExp: 2, //     adhesion upkeep ∝ grip^gripExp × (feet + 1 hand)
  swingCost: 0.04, // × swing propensity (long arms)
  flightCost: 0.003, // × flight time
  move: 0.006,
};

export const HIST_EDGES = {
  feet: [1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5],
  grip: Array.from({ length: 13 }, (_, i) => i * 0.25),
  mass: Array.from({ length: 13 }, (_, i) => i * 0.25),
  swing: Array.from({ length: 11 }, (_, i) => Math.round(i * 10) / 100),
  flight: Array.from({ length: 11 }, (_, i) => Math.round(i * 15) / 100),
};

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const mix = (c, k) => [Math.min(255, c[0] * k) | 0, Math.min(255, c[1] * k) | 0, Math.min(255, c[2] * k) | 0];
const WHITE = [255, 255, 255];
const BLACK = [0, 0, 0];
const SLIP_RGB = [255, 80, 40];

/**
 * env: {
 *   domain() → D, typeOf(pi) → habitat, blocked(pi) → bool,
 *   foodAt(g) → 0..1 (sim under a global cell), landing(x, z, fromY),
 *   walls() → wall patches (world planes), onBodyLands(kind, L, body)
 * }
 */
export function createCreatures({ rng, env }) {
  let list = [];
  let fallers = []; // non-creature bodies in flight: { kind, x,y,z, vx,vy,vz, ymax, r, color, ... }
  let detritus = [];
  let nextId = 1;
  let V = {};
  let cleared = false;
  let graze = new Map(); // patch idx → { gw, gh, a: Float32Array }
  const birthT = { floor: 0, wall: 0, ceiling: 0 };
  const immT = { floor: 0, wall: 0, ceiling: 0 };
  const flow = { floor: [0, 0, 0], wall: [0, 0, 0], ceiling: [0, 0, 0] }; // intake, cost, creature-seconds
  const tot = { fallWhy: {}, fallsFrom: {}, crossK: {}, deaths: { floor: {}, wall: {}, ceiling: {} }, born: 0, died: 0, fell: 0, landed: 0, starved: 0, hard: 0, aged: 0, slid: 0, slips: 0, catches: 0, misses: 0, releases: 0, crossings: 0, culled: 0, pellets: 0, eaten: 0 };
  const tmpX = { q: 0, x: 0, y: 0, angle: 0, edge: null };
  let simTime = 0;

  const D = () => env.domain();
  const gs = () => Number(V['cr.gscale']) || 0;
  const G = () => TOY_G * gs();
  const L = () => Number(V['cr.swing']) || 0.2;

  // ── traits ────────────────────────────────────────────────────────────────
  function baseGenes() {
    return {
      feet: rng() < 0.25 ? -1 : rng() < 0.33 ? 1 : 0,
      grip: Math.exp(rng.normal() * 0.22),
      mass: Math.exp(rng.normal() * 0.18),
      swing: clamp(0.5 + rng.normal() * 0.18, 0, 1),
      flight: Math.exp(rng.normal() * 0.2),
    };
  }

  function mutate(g) {
    const m = Number(V['cr.mutation']) || 0;
    if (!V['cr.selection'] || m <= 0) return { ...g };
    const s = m * 2;
    let feet = g.feet;
    if (rng() < Math.min(0.5, m * 2)) feet += rng.sign();
    return {
      feet: clamp(feet, -6, 6),
      grip: clamp(g.grip * Math.exp(rng.normal() * s), 0.05, 6),
      mass: clamp(g.mass * Math.exp(rng.normal() * s), 0.15, 5),
      swing: clamp(g.swing + rng.normal() * m * 1.5, 0, 1),
      flight: clamp(g.flight * Math.exp(rng.normal() * s), 0.05, 6),
    };
  }

  function traits(c) {
    c.feet = clamp(Math.round((Number(V['cr.feet']) || 6) + c.g.feet), 2, 8);
    const gr = Number(V['cr.grip']);
    c.grip = (Number.isFinite(gr) ? gr : 1) * c.g.grip;
    c.mass = Math.max(0.05, (Number(V['cr.mass']) || 1) * c.g.mass);
    c.swing = c.g.swing;
    c.flight = (Number(V['cr.flight']) || 0) * c.g.flight;
    c.emax = 1.2 * c.mass;
  }

  // ── feet ──────────────────────────────────────────────────────────────────
  function nominal(c, k, ahead) {
    const rows = Math.ceil(c.feet / 2);
    const row = k >> 1;
    const side = k & 1 ? 1 : -1;
    const along = (row - (rows - 1) / 2) * 0.055 + ahead;
    const lat = side * LEG * (0.85 + 0.15 * Math.cos(row));
    const ch = Math.cos(c.h), sh = Math.sin(c.h);
    return [c.x + ch * along - sh * lat, c.y + sh * along + ch * lat];
  }

  function placeFeet(c) {
    for (let k = 0; k < 8; k++) {
      const [fx, fy] = nominal(c, k, 0);
      c.fx[k] = fx;
      c.fy[k] = fy;
      c.fp[k] = 1;
    }
  }

  function make(pi, x, y, genes, home) {
    const c = {
      id: nextId++,
      g: genes,
      home,
      pi,
      x,
      y,
      h: rng() * Math.PI * 2,
      mode: 'walk',
      moving: rng() < 0.5,
      modeT: rng() * 3,
      phase: 0,
      fx: new Float32Array(8),
      fy: new Float32Array(8),
      fp: new Uint8Array(8),
      // hang / leap state
      ax: 0, ay: 0, rx: 0, ry: 0, rd: 0, vx: 0, vy: 0, vd: 0,
      dirx: 1, diry: 0, travel: false, swings: 0, lt: 0,
      // world flight
      wx: 0, wy: 0, wz: 0, wvx: 0, wvy: 0, wvz: 0, ymax: 0, perchT: 0,
      energy: 0,
      age: 0,
      maxAge: 70 + rng() * 50,
      slipT: 0,
      restT: 0,
    };
    traits(c);
    c.energy = c.emax * (0.5 + 0.2 * rng());
    placeFeet(c);
    return c;
  }

  function patchesOf(hab) {
    const d = D();
    return d.P.filter((p) => !env.blocked(p.idx) && env.typeOf(p.idx) === hab && p.valid.length > 0);
  }

  /** Ceiling dwellers start out hanging; everyone else standing. */
  function settle(c) {
    if (env.typeOf(c.pi) === 'ceiling' && L() > 0.02) startHang(c, false);
    return c;
  }

  function spawnIn(hab, genes = baseGenes()) {
    const ps = patchesOf(hab);
    if (!ps.length) return null;
    let tot2 = 0;
    for (const p of ps) tot2 += p.valid.length;
    let r = rng() * tot2;
    let pick = ps[0];
    for (const p of ps) {
      r -= p.valid.length;
      if (r <= 0) {
        pick = p;
        break;
      }
    }
    const pt = D().randomPoint(pick.idx, rng);
    if (!pt) return null;
    const c = settle(make(pick.idx, pt[0], pt[1], genes, hab));
    list.push(c);
    return c;
  }

  // ── food ──────────────────────────────────────────────────────────────────
  function grazeGrid(pi) {
    let gg = graze.get(pi);
    if (!gg) {
      const p = D().P[pi].patch;
      const gw = Math.max(1, Math.ceil(p.width / GRAZE_CELL));
      const gh = Math.max(1, Math.ceil(p.height / GRAZE_CELL));
      gg = { gw, gh, a: new Float32Array(gw * gh) };
      graze.set(pi, gg);
    }
    return gg;
  }

  const MOUTH = [[0, 0], [0.04, 0], [-0.04, 0], [0, 0.04], [0, -0.04]];
  /** Food in a mouthful around (x, y): the sims' mean intensity there, depleted where grazed. */
  function foodAt(pi, x, y) {
    const d = D();
    const g = d.locate(pi, x, y);
    if (g < 0) return -1;
    let sum = 0, n = 0;
    for (const [dx, dy] of MOUTH) {
      const gg2 = d.locate(pi, x + dx, y + dy);
      if (gg2 < 0) continue;
      sum += env.foodAt(gg2);
      n++;
    }
    const gg = grazeGrid(pi);
    const gi = clamp(Math.floor(x / GRAZE_CELL), 0, gg.gw - 1), gj = clamp(Math.floor(y / GRAZE_CELL), 0, gg.gh - 1);
    const amb = CR_TUNE.ambient;
    return (amb + (1 - amb) * (sum / n)) * (1 - gg.a[gj * gg.gw + gi]);
  }

  function eat(c, x, y, dt, k = 1) {
    const f = foodAt(c.pi, x, y);
    if (f <= 0) return;
    const gg = grazeGrid(c.pi);
    const gi = clamp(Math.floor(x / GRAZE_CELL), 0, gg.gw - 1), gj = clamp(Math.floor(y / GRAZE_CELL), 0, gg.gh - 1);
    const idx = gj * gg.gw + gi;
    gg.a[idx] = Math.min(1, gg.a[idx] + CR_TUNE.graze * dt * k);
    const gain = CR_TUNE.eat * Math.pow(c.mass, 0.75) * f * dt * k;
    const fl = flow[env.typeOf(c.pi)];
    if (fl) fl[0] += gain;
    c.energy = Math.min(c.emax, c.energy + gain);
  }

  function metabolism(c, dt, moving) {
    const T = CR_TUNE;
    const cost =
      T.base * Math.pow(c.mass, T.massExp) +
      T.foot * c.feet +
      T.gripCost * Math.pow(c.grip, T.gripExp) * (c.feet + 1) +
      T.swingCost * c.swing +
      T.flightCost * c.flight +
      (moving ? T.move : 0);
    c.energy -= cost * dt;
    const fl = flow[env.typeOf(c.pi)];
    if (fl) {
      fl[1] += cost * dt;
      fl[2] += dt;
    }
  }

  // ── leaving the surface ───────────────────────────────────────────────────
  function launch(c, d, lvx, lvy, lvd, why = 'peel') {
    tot.fallWhy[why] = (tot.fallWhy[why] || 0) + 1;
    const kind = D().P[c.pi].kind;
    tot.fallsFrom[kind] = (tot.fallsFrom[kind] || 0) + 1;
    const p = D().P[c.pi].patch;
    const w = toWorld(p, c.x, c.y, d);
    const v = dirToWorld(p, lvx, lvy, lvd);
    c.mode = 'air';
    c.wx = w[0];
    c.wy = w[1];
    c.wz = w[2];
    c.wvx = v[0];
    c.wvy = v[1];
    c.wvz = v[2];
    c.ymax = w[1];
    c.fromHab = env.typeOf(c.pi);
    tot.fell++;
  }

  function dropBody(kind, pi, x, y, d, color, r = 0.03, extra = {}) {
    if (fallers.length >= FALLERS_MAX) return;
    const p = D().P[pi].patch;
    const w = toWorld(p, x, y, d);
    fallers.push({ kind, x: w[0], y: w[1], z: w[2], vx: 0, vy: 0, vz: 0, ymax: w[1], r, color, ...extra });
  }

  function countDeath(hab, why) {
    const d = tot.deaths[hab] || (tot.deaths[hab] = {});
    d[why] = (d[why] || 0) + 1;
  }

  function die(c, why) {
    c.dead = true;
    tot.died++;
    countDeath(env.typeOf(c.pi), why);
    if (why === 'starved') tot.starved++;
    if (why === 'aged') tot.aged++;
    const hab = env.typeOf(c.pi);
    if (!V['cr.detritus']) return;
    if (hab === 'floor') addDetritus(c.pi, c.x, c.y, 0.25 + 0.25 * c.mass);
    else dropBody('corpse', c.pi, c.x, c.y, 0.04, mix(HABITAT_RGB[c.home], 0.45), 0.035, { amount: 0.25 + 0.25 * c.mass });
  }

  function addDetritus(pi, x, y, amount) {
    if (detritus.length >= DETRITUS_MAX) detritus.shift();
    detritus.push({ pi, x, y, amount, age: 0 });
  }

  // ── moving on a patch (with seams) ────────────────────────────────────────
  function turnBack(c, ed) {
    if (ed) {
      // reflect the heading about the edge
      const hx = Math.cos(c.h), hy = Math.sin(c.h);
      const vn = hx * ed.nx + hy * ed.ny;
      c.h = Math.atan2(hy - 2 * vn * ed.ny, hx - 2 * vn * ed.nx) + rng.normal() * 0.4;
    } else c.h += Math.PI + rng.normal() * 0.6;
  }

  /** Try to move c to (nx, ny). Returns 'ok' | 'blocked' | 'crossed' | 'fell'. */
  function moveTo(c, nx, ny, forced = false) {
    const d = D();
    const st = d.stateAt(c.pi, nx, ny);
    if (st === 2) {
      c.x = nx;
      c.y = ny;
      return 'ok';
    }
    if (st === 1) {
      turnBack(c, null);
      return 'blocked';
    }
    const ed = d.edgeOut(c.pi, nx, ny);
    if (ed && ed.free) {
      // walked off the loft's open edge
      const hx = Math.cos(c.h), hy = Math.sin(c.h);
      c.x = nx;
      c.y = ny;
      launch(c, 0.03, hx * 0.15, hy * 0.15, 0, 'edge');
      return 'fell';
    }
    if (V['life.seams'] !== false && d.cross(c.pi, nx, ny, tmpX) && !env.blocked(tmpX.q) && d.stateAt(tmpX.q, tmpX.x, tmpX.y) === 2) {
      const from = env.typeOf(c.pi), to = env.typeOf(tmpX.q);
      const fromKind = d.P[c.pi].kind;
      if (from !== to && !forced && rng() > WANDER_CROSS) {
        turnBack(c, ed);
        return 'blocked';
      }
      c.pi = tmpX.q;
      c.x = tmpX.x;
      c.y = tmpX.y;
      c.h += tmpX.angle;
      if (c.mode === 'leap' || c.mode === 'slip') {
        const ca = Math.cos(tmpX.angle), sa = Math.sin(tmpX.angle);
        const vx = c.vx * ca - c.vy * sa, vy = c.vx * sa + c.vy * ca;
        c.vx = vx;
        c.vy = vy;
      }
      placeFeet(c);
      tot.crossings++;
      const key = `${fromKind}>${d.P[tmpX.q].kind}`;
      tot.crossK[key] = (tot.crossK[key] || 0) + 1;
      return 'crossed';
    }
    turnBack(c, ed);
    return 'blocked';
  }

  // ── gaits ─────────────────────────────────────────────────────────────────
  function holdNeed(c, hab) {
    const p = D().P[c.pi];
    if (hab === 'wall') return c.mass * gs() * p.gMag;
    if (hab === 'ceiling') return c.mass * gs() * (Math.max(0, -p.gn) + 0.5 * p.gMag);
    return 0;
  }

  function steer(c, dt, hab) {
    // food tropism: three probes like a Physarum agent
    const pr = 0.16;
    const a = 0.6;
    const f = foodAt(c.pi, c.x + Math.cos(c.h) * pr, c.y + Math.sin(c.h) * pr);
    const l = foodAt(c.pi, c.x + Math.cos(c.h - a) * pr, c.y + Math.sin(c.h - a) * pr);
    const r = foodAt(c.pi, c.x + Math.cos(c.h + a) * pr, c.y + Math.sin(c.h + a) * pr);
    if (l > f && l > r) c.h -= 1.8 * dt;
    else if (r > f && r > l) c.h += 1.8 * dt;
    // scavengers smell detritus
    if (hab === 'floor' && V['cr.detritus'] && detritus.length) {
      let best = null, bd = 1.2 * 1.2;
      for (const d of detritus) {
        if (d.pi !== c.pi) continue;
        const dd = (d.x - c.x) ** 2 + (d.y - c.y) ** 2;
        if (dd < bd) {
          bd = dd;
          best = d;
        }
      }
      if (best) {
        const want = Math.atan2(best.y - c.y, best.x - c.x);
        c.h += clamp(wrapAngle(want - c.h), -3 * dt, 3 * dt);
        if (bd < 0.07 * 0.07) {
          c.energy = Math.min(c.emax, c.energy + best.amount);
          detritus.splice(detritus.indexOf(best), 1);
          tot.eaten++;
        }
      }
    }
    c.h += rng.normal() * 1.1 * Math.sqrt(dt);
  }

  function walkStep(c, dt) {
    const hab = env.typeOf(c.pi);
    c.modeT -= dt;
    if (c.modeT <= 0) {
      c.moving = !c.moving;
      c.modeT = c.moving ? 1.5 + rng() * 3.5 : 0.8 + rng() * 2.2;
      // on the ceiling a creature rests by HANGING from one hand
      if (!c.moving && hab === 'ceiling' && L() > 0.02) {
        startHang(c, false);
        return;
      }
    }
    if (!c.moving && hab === 'ceiling' && L() > 0.02) {
      startHang(c, false);
      return;
    }
    // (an inverted crawl only happens on arrival from a wall, until its next rest)
    const need = holdNeed(c, hab);
    // planted feet: all when standing; the non-swinging group when stepping
    let planted = c.feet;
    if (c.moving) {
      const grp = Math.floor(c.phase) & 1;
      planted = 0;
      for (let k = 0; k < c.feet; k++) if ((((k >> 1) + (k & 1)) & 1) !== grp) planted++;
    }
    if (need > 0) {
      const hold = c.grip * FOOT * planted * (hab === 'ceiling' ? PEEL_K : 1) * (1 + rng.normal() * 0.1);
      if (hold < need) {
        if (hab === 'wall') {
          c.mode = 'slip';
          c.slipT = 0;
          c.vx = 0;
          c.vy = 0;
          tot.slips++;
          for (let k = 0; k < 8; k++) c.fp[k] = 0;
          return;
        }
        // ceiling: peeled off
        launch(c, 0.03, 0, 0, 0.05, 'peel');
        return;
      }
    }
    if (!c.moving && c.modeT > 0.3 && foodAt(c.pi, c.x, c.y) < 0.12) c.modeT = 0.3; // stripped: move on
    if (c.moving) {
      steer(c, dt, hab);
      const sp = SPEED[hab] * Math.pow(c.mass, 0.2);
      const nx = c.x + Math.cos(c.h) * sp * dt;
      const ny = c.y + Math.sin(c.h) * sp * dt;
      const res = moveTo(c, nx, ny);
      if (res === 'fell' || res === 'crossed') return;
      c.phase += (sp * dt) / STRIDE;
      eat(c, c.x, c.y, dt, 0.6);
    } else {
      eat(c, c.x, c.y, dt, 1.2);
    }
    // feet
    const grp = Math.floor(c.phase) & 1;
    for (let k = 0; k < c.feet; k++) {
      const g = ((k >> 1) + (k & 1)) & 1;
      if (c.moving && g === grp) {
        const [tx, ty] = nominal(c, k, STRIDE * 0.5);
        c.fx[k] += (tx - c.fx[k]) * 0.45;
        c.fy[k] += (ty - c.fy[k]) * 0.45;
        c.fp[k] = 0;
      } else {
        c.fp[k] = 1;
        const [tx, ty] = nominal(c, k, 0);
        if ((tx - c.fx[k]) ** 2 + (ty - c.fy[k]) ** 2 > (STRIDE * 2.5) ** 2) {
          c.fx[k] = tx;
          c.fy[k] = ty;
        }
      }
    }
    metabolism(c, dt, c.moving);
  }

  function slipStep(c, dt) {
    const p = D().P[c.pi];
    const g = G();
    c.vx = (c.vx + p.gt[0] * g * dt) * 0.93;
    c.vy = (c.vy + p.gt[1] * g * dt) * 0.93;
    c.slipT += dt;
    const res = moveTo(c, c.x + c.vx * dt, c.y + c.vy * dt, true);
    if (res === 'crossed' && env.typeOf(c.pi) !== 'wall') {
      // slid off the bottom of the wall onto the floor
      c.mode = 'walk';
      c.moving = false;
      c.modeT = 1;
      tot.slid++;
      return;
    }
    if (res === 'blocked') {
      c.vx = 0;
      c.vy = 0;
    }
    for (let k = 0; k < c.feet; k++) {
      c.fx[k] += c.vx * dt;
      c.fy[k] += c.vy * dt;
    }
    if (c.slipT > CR_TUNE.regrip) {
      // try to re-grip with every foot
      const need = holdNeed(c, env.typeOf(c.pi));
      if (c.grip * FOOT * c.feet * (1 + rng.normal() * 0.1) >= need) {
        c.mode = 'walk';
        c.moving = false;
        c.modeT = 0.6 + rng();
        placeFeet(c);
      }
    }
    metabolism(c, dt, true);
  }

  function startHang(c, travel) {
    const len = L();
    c.mode = 'hang';
    c.ax = c.x;
    c.ay = c.y;
    c.rx = 0;
    c.ry = 0;
    c.rd = len;
    c.vx = 0;
    c.vy = 0;
    c.vd = 0;
    c.travel = travel;
    c.swings = 2 + ((rng() * 4) | 0);
    c.dirx = Math.cos(c.h);
    c.diry = Math.sin(c.h);
    c.restT = 0;
  }

  /** Pendulum about the anchor. Local 3-D frame: (x, y) on the patch, d into the room. */
  function hangStep(c, dt) {
    const p = D().P[c.pi];
    const g = G();
    const len = L();
    const gvx = p.gt[0], gvy = p.gt[1], gvd = -p.gn; // gravity direction, local (unit)
    const sub = 4;
    const h = dt / sub;
    const pumpV2 = 0.8 * g * len; // ≈ the speed of a 50° swing through the bottom
    for (let s = 0; s < sub; s++) {
      let axx = g * gvx, ayy = g * gvy, add = g * gvd;
      if (c.travel && c.vx * c.vx + c.vy * c.vy + c.vd * c.vd < pumpV2) {
        // pump (like a child on a swing) until the swing is fast enough
        const vdir = c.vx * c.dirx + c.vy * c.diry;
        const sgn = vdir >= 0 ? 1 : -1;
        axx += PUMP * TOY_G * sgn * c.dirx;
        ayy += PUMP * TOY_G * sgn * c.diry;
      }
      c.vx += axx * h;
      c.vy += ayy * h;
      c.vd += add * h;
      c.rx += c.vx * h;
      c.ry += c.vy * h;
      c.rd += c.vd * h;
      if (c.rd < 0.02) c.rd = 0.02;
      const rl = Math.hypot(c.rx, c.ry, c.rd) || 1;
      c.rx *= len / rl;
      c.ry *= len / rl;
      c.rd *= len / rl;
      const nx = c.rx / len, ny = c.ry / len, nd = c.rd / len;
      const vr = c.vx * nx + c.vy * ny + c.vd * nd;
      c.vx -= vr * nx;
      c.vy -= vr * ny;
      c.vd -= vr * nd;
      const damp = c.travel ? 0.04 : 1.6;
      const k = 1 - damp * h;
      c.vx *= k;
      c.vy *= k;
      c.vd *= k;
    }
    // the hand must hold the rope tension (in toy-g body weights)
    const nx = c.rx / len, ny = c.ry / len, nd = c.rd / len;
    const v2 = c.vx * c.vx + c.vy * c.vy + c.vd * c.vd;
    const tension = (g * (gvx * nx + gvy * ny + gvd * nd) + v2 / len) / TOY_G;
    const need = c.mass * Math.max(0, tension);
    // a hook holds best when the rope runs along the surface (steep facets), worst straight off it
    const hook = 1 + HOOK * Math.hypot(nx, ny);
    if (c.grip * HAND * hook * (1 + rng.normal() * 0.08) < need) {
      c.x = c.ax + c.rx;
      c.y = c.ay + c.ry;
      if (D().stateAt(c.pi, c.x, c.y) !== 2) {
        c.x = c.ax;
        c.y = c.ay;
      }
      launch(c, c.rd, c.vx, c.vy, c.vd, 'hang');
      return;
    }
    // body position (projected) for drawing and eating
    c.x = c.ax;
    c.y = c.ay;
    // a keen swinger browses a wider circle around its hand
    const reach = 0.6 + 0.8 * c.swing;
    eat(c, c.ax + c.rx, c.ay + c.ry, dt, (c.travel ? 0.8 : 1.5) * reach);
    metabolism(c, dt, c.travel);
    if (c.travel) {
      // swing angle is measured from the rest point (on a pitched facet the
      // body hangs downslope of the anchor), so uphill travel isn't penalised
      const gl = Math.hypot(gvx, gvy, gvd) || 1;
      const cosRel = (c.rx * gvx + c.ry * gvy + c.rd * gvd) / (gl * len);
      const vdir = c.vx * c.dirx + c.vy * c.diry;
      const relCos = Math.cos(((30 + 25 * c.swing) * Math.PI) / 180); // keen swingers swing higher
      if (cosRel < relCos && vdir > 0 && c.vd < -0.05) {
        // let go near the top of the forward swing
        c.mode = 'leap';
        c.lx = c.ax + c.rx;
        c.ly = c.ay + c.ry;
        c.ld = c.rd;
        c.lt = 0;
        tot.releases++;
        if (D().stateAt(c.pi, c.lx, c.ly) !== 2) {
          // the body is over an edge: let the leap code carry it across
          const res = moveTo(c, c.lx, c.ly, false);
          if (res === 'blocked') {
            c.travel = false;
            c.mode = 'hang';
          } else {
            c.lx = c.x;
            c.ly = c.y;
          }
        }
      }
    } else {
      c.restT += dt;
      // move on when the time is up (keen swingers sooner), or when the spot is stripped
      const here = c.restT > 0.6 ? foodAt(c.pi, c.ax + c.rx, c.ay + c.ry) : 1;
      if (c.restT > (1.5 + rng() * 3) * (1.3 - c.swing) || here < 0.12) {
        c.restT = 0;
        c.h += rng.normal() * 1.2;
        // look around for food before setting off
        const pr = 0.4;
        let best = c.h, bf = -1;
        for (let k = 0; k < 5; k++) {
          const a = c.h + (k - 2) * 0.6;
          const f = foodAt(c.pi, c.ax + Math.cos(a) * pr, c.ay + Math.sin(a) * pr);
          if (f > bf) {
            bf = f;
            best = a;
          }
        }
        c.h = best;
        c.dirx = Math.cos(c.h);
        c.diry = Math.sin(c.h);
        c.travel = true;
        c.swings = 2 + ((rng() * 4) | 0);
      }
    }
  }

  function leapStep(c, dt) {
    const p = D().P[c.pi];
    const g = G();
    const len = L();
    c.vx += g * p.gt[0] * dt;
    c.vy += g * p.gt[1] * dt;
    c.vd += g * -p.gn * dt;
    const nx = c.lx + c.vx * dt, ny = c.ly + c.vy * dt;
    c.ld += c.vd * dt;
    c.lt += dt;
    // in-plane motion may carry it over a seam
    c.x = c.lx;
    c.y = c.ly;
    c.h = Math.atan2(c.vy, c.vx);
    const res = moveTo(c, nx, ny, true);
    if (res === 'fell') return;
    if (res === 'blocked') {
      // hit an edge with nowhere to go: kill the in-plane speed
      c.vx *= -0.3;
      c.vy *= -0.3;
    }
    c.lx = c.x;
    c.ly = c.y;
    if (res === 'crossed' && env.typeOf(c.pi) !== 'ceiling') {
      // flew onto a wall at the eave: grab it
      c.mode = 'walk';
      c.moving = false;
      c.modeT = 0.5;
      placeFeet(c);
      return;
    }
    if (c.ld <= 0.01) {
      // touched the surface: grab right here
      catchAt(c, len, true);
      return;
    }
    if (c.lt >= c.flight) catchAt(c, len, false);
  }

  function catchAt(c, len, touched) {
    if (c.ld > REACH_K * len) {
      tot.misses++;
      launch(c, c.ld, c.vx, c.vy, c.vd, 'reach');
      return;
    }
    const sp = Math.hypot(c.vx, c.vy) || 1;
    const reachAhead = Math.min(len * 0.6, Math.sqrt(Math.max(0, len * len - c.ld * c.ld)));
    // grab ahead if there is surface there, else nearer, else straight up
    let ax = c.lx, ay = c.ly;
    for (const k of [1, 0.5, 0]) {
      ax = c.lx + (c.vx / sp) * reachAhead * k;
      ay = c.ly + (c.vy / sp) * reachAhead * k;
      if (D().stateAt(c.pi, ax, ay) === 2) break;
    }
    if (D().stateAt(c.pi, ax, ay) !== 2) {
      tot.misses++;
      launch(c, c.ld, c.vx, c.vy, c.vd, 'nohold');
      return;
    }
    let rx = c.lx - ax, ry = c.ly - ay, rd = Math.max(0.02, c.ld);
    const rl = Math.hypot(rx, ry, rd);
    rx *= len / rl;
    ry *= len / rl;
    rd *= len / rl;
    const nx = rx / len, ny = ry / len, nd = rd / len;
    const vr = c.vx * nx + c.vy * ny + c.vd * nd;
    const tvx = c.vx - vr * nx, tvy = c.vy - vr * ny, tvd = c.vd - vr * nd;
    const p = D().P[c.pi];
    const g = G();
    // gravity along the rope + centripetal + the jolt of stopping the radial speed
    const jolt = Math.max(0, vr);
    const tension = (g * (p.gt[0] * nx + p.gt[1] * ny - p.gn * nd) + (tvx * tvx + tvy * tvy + tvd * tvd + jolt * jolt) / len) / TOY_G;
    const need = c.mass * Math.max(0, tension);
    if (!touched && c.grip * HAND * (1 + HOOK * Math.hypot(nx, ny)) * (1 + rng.normal() * 0.1) < need) {
      tot.misses++;
      launch(c, c.ld, c.vx, c.vy, c.vd, 'catch');
      return;
    }
    tot.catches++;
    // keep travelling the way the flight was going
    c.dirx = c.vx / sp;
    c.diry = c.vy / sp;
    c.h = Math.atan2(c.diry, c.dirx);
    c.mode = 'hang';
    c.ax = ax;
    c.ay = ay;
    c.x = ax;
    c.y = ay;
    c.rx = rx;
    c.ry = ry;
    c.rd = rd;
    // the arm flexes and soaks up a quarter of the swing speed
    c.vx = tvx * 0.75;
    c.vy = tvy * 0.75;
    c.vd = tvd * 0.75;
    c.swings--;
    if (c.swings <= 0) {
      c.travel = false;
      c.restT = 0;
    }
  }

  function airStep(c, dt) {
    const b = { x: c.wx, y: c.wy, z: c.wz, vx: c.wvx, vy: c.wvy, vz: c.wvz, ymax: c.ymax };
    const Lr = stepFall(b, dt, Math.max(0.3, G()), env.landing, env.walls());
    c.wx = b.x;
    c.wy = b.y;
    c.wz = b.z;
    c.wvx = b.vx;
    c.wvy = b.vy;
    c.wvz = b.vz;
    c.ymax = b.ymax;
    if (!Lr) return;
    tot.landed++;
    const drop = c.ymax - Lr.y;
    if (V['cr.selection'] && c.mass * gs() * drop > HARD_LANDING) {
      tot.hard++;
      c.dead = true;
      tot.died++;
      countDeath(c.fromHab || 'ceiling', 'fall');
      if (V['cr.detritus']) settleBody(Lr, b, 0.25 + 0.25 * c.mass);
      return;
    }
    if (!placeOnLanding(c, Lr, b)) {
      c.mode = 'perch';
      c.perchT = 1.2 + rng() * 1.5;
    }
  }

  function localOn(pi, x, z) {
    const p = D().P[pi].patch;
    const dx = x - p.origin[0], dy = 0, dz = z - p.origin[2];
    return [dx * p.u[0] + dy * p.u[1] + dz * p.u[2], dx * p.v[0] + dy * p.v[1] + dz * p.v[2]];
  }

  /** Put a landed creature on the landing patch. False → furniture (perch). */
  function placeOnLanding(c, Lr, b) {
    const d = D();
    const pi = Lr.patchId != null ? d.byId.get(Lr.patchId) : undefined;
    if (pi === undefined || env.blocked(pi)) return false;
    const [lx, ly] = localOn(pi, b.x, b.z);
    const pt = d.stateAt(pi, lx, ly) === 2 ? [lx, ly] : d.nearestLive(pi, lx, ly, 0.6);
    if (!pt) return false;
    c.pi = pi;
    c.x = pt[0];
    c.y = pt[1];
    c.mode = 'walk';
    c.moving = false;
    c.modeT = 0.8 + rng();
    placeFeet(c);
    return true;
  }

  function perchStep(c, dt) {
    c.perchT -= dt;
    if (c.perchT > 0) return;
    // climb down off the furniture to the nearest live floor
    const d = D();
    const fi = d.P.findIndex((p) => p.kind === 'floor' && !env.blocked(p.idx));
    if (fi < 0) {
      c.dead = true;
      tot.died++;
      return;
    }
    const [lx, ly] = localOn(fi, c.wx, c.wz);
    const pt = d.nearestLive(fi, lx, ly, 1.5) || d.randomPoint(fi, rng);
    if (!pt) {
      c.dead = true;
      tot.died++;
      return;
    }
    c.pi = fi;
    c.x = pt[0];
    c.y = pt[1];
    c.mode = 'walk';
    c.moving = true;
    c.modeT = 2;
    placeFeet(c);
  }

  function settleBody(Lr, b, amount) {
    const d = D();
    const pi = Lr.patchId != null ? d.byId.get(Lr.patchId) : undefined;
    if (pi === undefined) return;
    const [lx, ly] = localOn(pi, b.x, b.z);
    const pt = d.stateAt(pi, lx, ly) === 2 ? [lx, ly] : d.nearestLive(pi, lx, ly, 0.6);
    if (pt) addDetritus(pi, pt[0], pt[1], amount);
  }

  // ── population control ────────────────────────────────────────────────────
  function habOf(c) {
    if (c.mode === 'air') return null;
    if (c.mode === 'perch') return 'floor';
    return env.typeOf(c.pi);
  }

  function targets() {
    if (!V['cr.on']) return { floor: 0, wall: 0, ceiling: 0 };
    return { floor: V['cr.floor'] | 0, wall: V['cr.wall'] | 0, ceiling: V['cr.ceiling'] | 0 };
  }

  function census() {
    const n = { floor: 0, wall: 0, ceiling: 0, air: 0 };
    for (const c of list) {
      const h = habOf(c);
      if (h) n[h]++;
      else n.air++;
    }
    return n;
  }

  function populationControl(dt) {
    const T = targets();
    const n = census();
    const sel = !!V['cr.selection'];
    for (const h of HABS) {
      birthT[h] -= dt;
      immT[h] -= dt;
      if (n[h] < T[h] && birthT[h] <= 0) {
        // a birth from this habitat's best fed
        let sum = 0;
        const cands = [];
        for (const c of list) {
          if (habOf(c) !== h || (c.mode !== 'walk' && c.mode !== 'hang')) continue;
          if (sel && c.energy < (n[h] < T[h] * 0.5 ? 0.3 : 0.45) * c.emax) continue;
          cands.push(c);
          sum += c.energy * c.energy;
        }
        if (cands.length) {
          // fecundity selection: chance ∝ stored energy² — the well fed breed,
          // and a big body that can stay fed stores more (so where holding on
          // costs nothing, size pays)
          let r = rng() * sum;
          let parent = cands[0];
          for (const c of cands) {
            r -= c.energy * c.energy;
            if (r <= 0) {
              parent = c;
              break;
            }
          }
          const genes = mutate(parent.g);
          const a = rng() * Math.PI * 2;
          let x = parent.x + Math.cos(a) * 0.06, y = parent.y + Math.sin(a) * 0.06;
          if (D().stateAt(parent.pi, x, y) !== 2) {
            x = parent.x;
            y = parent.y;
          }
          const child = settle(make(parent.pi, x, y, genes, h));
          if (sel) {
            parent.energy *= 0.5;
            child.energy = Math.min(child.emax, parent.energy);
          }
          list.push(child);
          n[h]++;
          tot.born++;
          birthT[h] = sel ? 0.35 : 0.1;
        } else if ((n[h] === 0 || !sel) && !cleared && immT[h] <= 0) {
          // extinct here (or selection off): an immigrant with base genes
          if (spawnIn(h)) {
            n[h]++;
            tot.born++;
          }
          immT[h] = sel ? 2 : 0.1;
        }
      } else if (n[h] > T[h] + 2 || (!sel && n[h] > T[h])) {
        // too crowded (falls and slides bring newcomers): the hungriest goes,
        // so a migrant whose body doesn't suit this surface is first out
        let worst = null;
        for (const c of list) {
          if (habOf(c) !== h || c.mode === 'air') continue;
          if (!worst || c.energy / c.emax < worst.energy / worst.emax) worst = c;
        }
        if (worst && birthT[h] <= 0) {
          worst.dead = true;
          n[h]--;
          tot.culled++;
          countDeath(h, 'crowded');
          birthT[h] = 0.5;
          if (V['cr.detritus'] && h === 'floor') addDetritus(worst.pi, worst.x, worst.y, 0.2 + 0.2 * worst.mass);
        }
      }
    }
  }

  // ── public ────────────────────────────────────────────────────────────────
  const C = {
    setParams(values) {
      V = values;
      for (const c of list) traits(c);
    },

    reseed() {
      list = [];
      fallers = [];
      detritus = [];
      graze = new Map();
      cleared = false;
      const T = targets();
      for (const h of HABS) for (let i = 0; i < T[h]; i++) spawnIn(h);
    },

    clear() {
      list = [];
      fallers = [];
      detritus = [];
      cleared = true;
    },

    /** Click-to-seed: one creature here if its habitat has room. */
    seedAt(pi, x, y) {
      if (!V['cr.on'] || env.blocked(pi)) return;
      const h = env.typeOf(pi);
      const n = census();
      if (n[h] >= targets()[h] + 6) return;
      if (D().stateAt(pi, x, y) !== 2) return;
      list.push(settle(make(pi, x, y, baseGenes(), h)));
      tot.born++;
      cleared = false;
    },

    /** Domain rebuilt (apex, ppm or masks): keep everyone, re-home if needed. */
    rebind(oldD) {
      const d = D();
      graze = new Map();
      const keep = [];
      for (const c of list) {
        if (c.mode === 'air' || c.mode === 'perch') {
          keep.push(c);
          continue;
        }
        const id = oldD ? oldD.P[c.pi]?.id : null;
        const ni = id != null ? d.byId.get(id) : c.pi;
        if (ni === undefined) continue;
        c.pi = ni;
        if (c.mode === 'hang' || c.mode === 'leap') {
          c.x = c.ax;
          c.y = c.ay;
          c.mode = 'walk';
        }
        if (d.stateAt(c.pi, c.x, c.y) !== 2) {
          const pt = d.nearestLive(c.pi, c.x, c.y, 0.5);
          if (!pt) continue;
          c.x = pt[0];
          c.y = pt[1];
        }
        placeFeet(c);
        keep.push(c);
      }
      list = keep;
      const dk = [];
      for (const t of detritus) {
        const id = oldD ? oldD.P[t.pi]?.id : null;
        const ni = id != null ? d.byId.get(id) : t.pi;
        if (ni !== undefined && d.stateAt(ni, t.x, t.y) === 2) {
          t.pi = ni;
          dk.push(t);
        }
      }
      detritus = dk;
    },

    /** Region switched off or retyped: move creatures off blocked patches. */
    revalidate() {
      for (const c of list) {
        if (c.mode === 'air' || c.mode === 'perch') continue;
        if (env.blocked(c.pi)) {
          const h = env.typeOf(c.pi);
          const ps = patchesOf(h);
          if (!ps.length) {
            c.dead = true;
            continue;
          }
          const p = ps[(rng() * ps.length) | 0];
          const pt = D().randomPoint(p.idx, rng);
          if (!pt) {
            c.dead = true;
            continue;
          }
          c.pi = p.idx;
          c.x = pt[0];
          c.y = pt[1];
          c.mode = 'walk';
          placeFeet(c);
        }
      }
      list = list.filter((c) => !c.dead);
    },

    step(dt) {
      simTime += dt;
      const on = !!V['cr.on'];
      const sel = !!V['cr.selection'];
      if (on) {
        for (const c of list) {
          if (c.dead) continue;
          if (c.mode === 'walk') walkStep(c, dt);
          else if (c.mode === 'slip') slipStep(c, dt);
          else if (c.mode === 'hang') hangStep(c, dt);
          else if (c.mode === 'leap') leapStep(c, dt);
          else if (c.mode === 'air') airStep(c, dt);
          else if (c.mode === 'perch') perchStep(c, dt);
          if (c.dead) continue;
          c.age += dt;
          if (c.mode !== 'air' && c.mode !== 'perch') {
            // ceiling dwellers drop waste: the floor's food web
            if (V['cr.detritus'] && env.typeOf(c.pi) === 'ceiling' && c.energy > 0.7 * c.emax && rng() < 0.05 * dt) {
              c.energy -= 0.06;
              const bx = c.mode === 'hang' ? c.ax + c.rx : c.x;
              const by = c.mode === 'hang' ? c.ay + c.ry : c.y;
              if (D().stateAt(c.pi, bx, by) === 2) {
                dropBody('pellet', c.pi, bx, by, c.mode === 'hang' ? c.rd : 0.03, DETRITUS_RGB, 0.018, { amount: 0.08 });
                tot.pellets++;
              }
            }
            if (sel && c.energy <= 0) die(c, 'starved');
            else if (sel && c.age > c.maxAge) die(c, 'aged');
            else if (!sel && c.energy < 0.05 * c.emax) c.energy = 0.05 * c.emax;
          }
        }
        list = list.filter((c) => !c.dead);
        populationControl(dt);
      } else if (list.length) {
        list = [];
      }

      // non-creature bodies in flight (pellets, corpses, peeled particles)
      const walls = env.walls();
      const g = Math.max(0.3, TOY_G * Math.max(0.1, gs()));
      for (let i = fallers.length - 1; i >= 0; i--) {
        const b = fallers[i];
        const Lr = stepFall(b, dt, g, env.landing, walls);
        if (!Lr) continue;
        fallers.splice(i, 1);
        if (b.kind === 'pellet' || b.kind === 'corpse') settleBody(Lr, b, b.amount || 0.1);
        else env.onBodyLands?.(b.kind, Lr, b);
      }

      // detritus decays; grazing recovers
      for (let i = detritus.length - 1; i >= 0; i--) {
        const d = detritus[i];
        d.age += dt;
        if (d.age > 90) detritus.splice(i, 1);
      }
      const rec = Math.pow(1 - CR_TUNE.regrow, dt);
      for (const gg of graze.values()) {
        const a = gg.a;
        for (let k = 0; k < a.length; k++) a[k] *= rec;
      }
    },

    /** Particles peeled off a roof and the like join the fallers. */
    addFaller(kind, pi, x, y, vx, vy, color, extra = {}) {
      if (fallers.length >= FALLERS_MAX) return false;
      const p = D().P[pi].patch;
      const w = toWorld(p, x, y, 0.02);
      const v = dirToWorld(p, vx, vy, 0.05);
      fallers.push({ kind, x: w[0], y: w[1], z: w[2], vx: v[0], vy: v[1], vz: v[2], ymax: w[1], r: 0.014, color, ...extra });
      return true;
    },

    /** Rasterise creatures and detritus into the patch buffers. */
    draw(painter) {
      for (const t of detritus) {
        const f = Math.max(0.35, 1 - t.age / 90);
        painter.glyph(t.pi, [{ t: 'disc', x: t.x, y: t.y, r: 0.022 + 0.02 * Math.min(1, t.amount), c: DETRITUS_RGB, a: f }], t.x, t.y, 0.05);
      }
      if (!V['cr.on']) return;
      for (const c of list) {
        if (c.mode === 'air' || c.mode === 'perch') continue;
        const col = HABITAT_RGB[c.home] || WHITE;
        const leg = mix(col, 0.55);
        const prims = [];
        const bodyR = 0.042 + 0.018 * Math.min(2.5, c.mass);
        let bx = c.x, by = c.y;
        // a dark knockout under every glyph, so it reads over any sim or palette
        if (c.mode === 'hang') {
          bx = c.ax + c.rx;
          by = c.ay + c.ry;
          prims.push({ t: 'disc', x: bx, y: by, r: bodyR + 0.035, c: BLACK, a: 0.8 });
          prims.push({ t: 'disc', x: c.ax, y: c.ay, r: 0.045, c: BLACK, a: 0.7 });
          prims.push({ t: 'line', x0: c.ax, y0: c.ay, x1: bx, y1: by, c: WHITE, a: 0.85 });
          prims.push({ t: 'disc', x: c.ax, y: c.ay, r: 0.024, c: WHITE, a: 1 });
          prims.push({ t: 'disc', x: bx, y: by, r: bodyR, c: col, a: 1 });
        } else if (c.mode === 'leap') {
          const sp = Math.hypot(c.vx, c.vy) || 1;
          const tl = Math.min(0.18, sp * 0.15);
          prims.push({ t: 'disc', x: bx, y: by, r: bodyR + 0.035, c: BLACK, a: 0.8 });
          prims.push({ t: 'line', x0: bx - (c.vx / sp) * tl, y0: by - (c.vy / sp) * tl, x1: bx, y1: by, c: mix(col, 0.6), a: 0.9 });
          prims.push({ t: 'disc', x: bx, y: by, r: bodyR, c: col, a: 1 });
        } else {
          const bodyCol = c.mode === 'slip' ? SLIP_RGB : col;
          prims.push({ t: 'disc', x: bx, y: by, r: LEG + 0.025, c: BLACK, a: 0.65 });
          for (let k = 0; k < c.feet; k++) {
            prims.push({ t: 'line', x0: bx, y0: by, x1: c.fx[k], y1: c.fy[k], c: leg, a: 0.9 });
          }
          for (let k = 0; k < c.feet; k++) {
            if (c.fp[k] && c.mode !== 'slip') prims.push({ t: 'disc', x: c.fx[k], y: c.fy[k], r: 0.02, c: WHITE, a: 1 });
            else prims.push({ t: 'disc', x: c.fx[k], y: c.fy[k], r: 0.013, c: mix(col, 0.7), a: 0.8 });
          }
          prims.push({ t: 'disc', x: bx, y: by, r: bodyR, c: bodyCol, a: 1 });
          // a bright head dot shows which way it is going
          prims.push({ t: 'disc', x: bx + Math.cos(c.h) * bodyR, y: by + Math.sin(c.h) * bodyR, r: 0.015, c: WHITE, a: 1 });
        }
        painter.glyph(c.pi, prims, bx, by, LEG + 0.06);
      }
    },

    /** World-space bodies in flight (not projectable). Reuses `out`. */
    airborne(out) {
      let n = 0;
      const put = (x, y, z, r, color) => {
        let o = out[n];
        if (!o) o = out[n] = { x: 0, y: 0, z: 0, r: 0, color: [1, 1, 1] };
        o.x = x;
        o.y = y;
        o.z = z;
        o.r = r;
        o.color[0] = color[0] / 255;
        o.color[1] = color[1] / 255;
        o.color[2] = color[2] / 255;
        n++;
      };
      for (const c of list) {
        if (c.mode !== 'air' && c.mode !== 'perch') continue;
        put(c.wx, c.wy, c.wz, 0.04 + 0.015 * Math.min(2.5, c.mass), HABITAT_RGB[c.home] || WHITE);
      }
      for (const b of fallers) put(b.x, b.y, b.z, b.r, b.color);
      out.length = n;
      return out;
    },

    census,

    histograms() {
      const H = {};
      for (const key of Object.keys(HIST_EDGES)) {
        const edges = HIST_EDGES[key];
        const nb = edges.length - 1;
        H[key] = { edges, floor: new Array(nb).fill(0), wall: new Array(nb).fill(0), ceiling: new Array(nb).fill(0) };
      }
      const means = { floor: {}, wall: {}, ceiling: {} };
      const cnt = { floor: 0, wall: 0, ceiling: 0 };
      for (const h of HABS) for (const key of Object.keys(HIST_EDGES)) means[h][key] = 0;
      for (const c of list) {
        const h = habOf(c);
        if (!h) continue;
        cnt[h]++;
        for (const key of Object.keys(HIST_EDGES)) {
          const v = c[key];
          means[h][key] += v;
          const edges = HIST_EDGES[key];
          let b = 0;
          while (b < edges.length - 2 && v >= edges[b + 1]) b++;
          H[key][h][b]++;
        }
      }
      for (const h of HABS) for (const key of Object.keys(HIST_EDGES)) means[h][key] = cnt[h] ? means[h][key] / cnt[h] : null;
      return { H, means };
    },

    stats() {
      const n = census();
      return {
        alive: list.length,
        born: tot.born,
        died: tot.died,
        fell: tot.fell,
        landed: tot.landed,
        onAir: n.air,
        starved: tot.starved,
        hardLandings: tot.hard,
        aged: tot.aged,
        slips: tot.slips,
        slid: tot.slid,
        releases: tot.releases,
        catches: tot.catches,
        misses: tot.misses,
        crossings: tot.crossings,
        culled: tot.culled,
        pellets: tot.pellets,
        scavenged: tot.eaten,
        detritus: detritus.length,
        fallWhy: { ...tot.fallWhy },
        fallsFrom: { ...tot.fallsFrom },
        crossKinds: { ...tot.crossK },
        energyFlow: Object.fromEntries(Object.entries(flow).map(([h, [i, c, t]]) => [h, { intake: t ? i / t : 0, cost: t ? c / t : 0 }])),
        deaths: JSON.parse(JSON.stringify(tot.deaths)),
        modes: list.reduce((m, c) => ((m[c.mode] = (m[c.mode] || 0) + 1), m), {}),
        simTime,
      };
    },

    /** For checks. */
    list: () => list,
    dispose() {
      list = [];
      fallers = [];
      detritus = [];
      graze = new Map();
    },
  };
  return C;
}
