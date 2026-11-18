/* ============================================================================
   PROVENANCE: adapted from public/artificial-life/src/systems/physarum.js
   (the Specimen Cabinet, Plate III, Jones 2010). Never edit the original.

   What changed:
   - No torus and no single screen grid: agents live on patches of the life
     DOMAIN, carrying (patch, x, y, heading). Sensor probes read the trail
     through domain.halo(), so an agent near an edge already "smells" the
     trail on the far side of the seam. An agent whose step leaves its patch
     CROSSES the seam (life.seams): position through seam.M, heading +
     mapAngle(M) — wall↔roof at the eave, wall↔wall at corners, wall↔floor at
     the bottom. Masks, seamless edges and patches running another system
     block it (Jones' rule: blocked → pick a random heading, do not move).
   - GEOTAXIS: each step the heading turns toward (life.geoSign 'down') or
     away from ('up') the patch's g_t by life.geotaxis × |g_t| × 15° × sin(Δ).
     Nothing happens on the floor (g_t = 0).
   - Parameters are in METRES (sensor distance, step) and converted at the
     domain's ppm, so the network keeps its physical grain across seams and
     resolutions. Population is a density per live cell, capped by the
     global budget (the cabinet runs 260k agents on one screen; this runs
     ≤ 45k over the whole room).
   - Diffusion is the cabinet's separable 3-tap box blur, but over the
     domain's neighbour table (so it diffuses across seams).
   - Pure-black background, palettes from life.physPalette.
   ========================================================================== */

import { palette } from '../palettes.js';
import { KINDS } from '../domain.js';

/** { 'wall>roof': n, … } from a 5×5 count matrix. */
export function kindPairs(m) {
  const out = {};
  for (let a = 0; a < 5; a++) for (let b = 0; b < 5; b++) if (m[a * 5 + b]) out[`${KINDS[a]}>${KINDS[b]}`] = m[a * 5 + b];
  return out;
}

const DEG = Math.PI / 180;
const TAU = Math.PI * 2;
const NA = 4096;
const AMASK = NA - 1;
const ASCALE = NA / TAU;
const SIN = new Float32Array(NA);
const COS = new Float32Array(NA);
for (let i = 0; i < NA; i++) {
  SIN[i] = Math.sin((i * TAU) / NA);
  COS[i] = Math.cos((i * TAU) / NA);
}
const SATURATION = 20;
const GEO_TURN = 15 * DEG * ASCALE; // max geotaxis turn per step, LUT units

export const PHYS_PRESETS = {
  // Tuned by eye at 40 px/m on the floor (the cabinet's 22.5° / 9 px coarsens
  // to three or four trunks on a 4 m floor; a 30° sensor, slower decay and more
  // turnover hold a cellular reticulum with fine capillaries between)
  network: { sa: 30, sd: 0.09, ra: 45, ss: 0.025, deposit: 5, decay: 0.06, turnover: 0.004, spawn: 'uniform' },
  veins: { sa: 12, sd: 0.3, ra: 18, ss: 0.036, deposit: 5, decay: 0.06, turnover: 0.0005, spawn: 'uniform' },
  rings: { sa: 30, sd: 0.09, ra: 45, ss: 0.025, deposit: 5, decay: 0.06, turnover: 0.002, spawn: 'ring' },
};
const MAX_SD = 0.32; // metres; sizes the halo
const GONE = 255; //    patch index of an agent whose patch no longer exists

export function createPhysarum({ rng, budget }) {
  let D = null;
  let owned = [];
  let ownedMask = null;
  let trail = null, next = null, tmp = null;
  let active = new Int32Array(0); // every live cell of every owned patch
  let nbS = null; //                  domain.nb with other systems walled off
  // agent pool
  let cap = 0, count = 0;
  let pa = null, ax = null, ay = null, ah = null;
  // per-patch lookups
  let haloIdx = [], haloW = [], haloH = [], pad = 0;
  let geoK = new Float32Array(0), geoA = new Int32Array(0);
  let preset = 'network', pr = PHYS_PRESETS.network;
  let pal = palette('bio');
  let geotaxis = 0.3, geoSign = 1, gravity = 1;
  let seamsOn = true;
  let rs = ((rng() * 0xffffffff) | 0) || 12345;
  let ref = 40;
  let coverage = 0;
  let cursor = 0;
  let crossings = 0;
  const crossK = new Int32Array(25); // from kindIdx × 5 + to kindIdx
  const tmpX = { q: 0, x: 0, y: 0, angle: 0, edge: null };

  const rnd = () => {
    rs ^= rs << 13;
    rs ^= rs >>> 17;
    rs ^= rs << 5;
    return (rs >>> 0) / 4294967296;
  };

  function buildActive() {
    let n = 0;
    for (const pi of owned) n += D.P[pi].valid.length;
    active = new Int32Array(n);
    let o = 0;
    for (const pi of owned) {
      active.set(D.P[pi].valid, o);
      o += D.P[pi].valid.length;
    }
  }

  function buildLookups() {
    nbS = D.nbFor(ownedMask);
    pad = Math.ceil(MAX_SD * D.ppm) + 2;
    haloIdx = [];
    haloW = [];
    haloH = [];
    geoK = new Float32Array(D.P.length);
    geoA = new Int32Array(D.P.length);
    for (const p of D.P) {
      if (ownedMask[p.idx]) {
        const H = D.halo(p.idx, pad);
        haloIdx[p.idx] = H.idx;
        haloW[p.idx] = H.HW;
        haloH[p.idx] = H.HH;
      } else {
        haloIdx[p.idx] = null;
      }
      geoK[p.idx] = geotaxis * geoSign * gravity * p.gMag * GEO_TURN;
      geoA[p.idx] = Math.round(p.gAng * ASCALE) & AMASK;
    }
  }

  /** Target population: density per live cell, under the global cap. */
  function wantAgents() {
    const per = 0.35;
    return Math.min(budget.physAgents, Math.round(active.length * per));
  }

  function placeAgent(i, g, heading) {
    const pi = D.cellPatch[g];
    const p = D.P[pi];
    const k = g - p.off;
    const j = (k / p.w) | 0;
    pa[i] = pi;
    ax[i] = k - j * p.w + rnd();
    ay[i] = j + rnd();
    ah[i] = heading === undefined ? (rnd() * NA) & AMASK : heading & AMASK;
  }

  function allocAgents() {
    cap = Math.max(1, wantAgents());
    pa = new Uint8Array(cap);
    ax = new Float32Array(cap);
    ay = new Float32Array(cap);
    ah = new Int32Array(cap);
    count = active.length ? cap : 0;
  }

  function spawnAll() {
    if (!active.length) {
      count = 0;
      return;
    }
    if (pr.spawn === 'ring') {
      // one ring per owned patch, area-weighted share, tangential headings
      let i = 0;
      const total = active.length;
      for (const pi of owned) {
        const p = D.P[pi];
        if (!p.valid.length) continue;
        const share = Math.round((count * p.valid.length) / total);
        let sx = 0, sy = 0;
        for (const g of p.valid) {
          const k = g - p.off;
          const j = (k / p.w) | 0;
          sx += k - j * p.w;
          sy += j;
        }
        const cx = sx / p.valid.length, cy = sy / p.valid.length;
        const R = Math.min(p.w, p.h) * 0.3;
        for (let s = 0; s < share && i < count; s++) {
          const a = rnd() * TAU;
          const r = R + (rnd() - 0.5) * 3;
          const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
          const ii = x | 0, jj = y | 0;
          if (ii < 0 || jj < 0 || ii >= p.w || jj >= p.h || p.state[jj * p.w + ii] !== 2) {
            placeAgent(i++, active[(rnd() * active.length) | 0]);
            continue;
          }
          pa[i] = pi;
          ax[i] = x;
          ay[i] = y;
          ah[i] = Math.round((a + Math.PI / 2 + (rnd() - 0.5) * 0.25) * ASCALE) & AMASK;
          i++;
        }
      }
      for (; i < count; i++) placeAgent(i, active[(rnd() * active.length) | 0]);
    } else {
      for (let i = 0; i < count; i++) placeAgent(i, active[(rnd() * active.length) | 0]);
    }
  }

  function clearPatchFields(pi) {
    const p = D.P[pi];
    trail.fill(0, p.off, p.off + p.w * p.h);
    next.fill(0, p.off, p.off + p.w * p.h);
    tmp.fill(0, p.off, p.off + p.w * p.h);
  }

  /** Re-home agents that sit on patches this system no longer owns (or that are gone). */
  function rehome() {
    if (!active.length) {
      count = 0;
      return;
    }
    count = cap;
    for (let i = 0; i < count; i++) {
      const pi = pa[i];
      const p = pi < D.P.length ? D.P[pi] : null;
      const ii = ax[i] | 0, jj = ay[i] | 0;
      const ok = p && ownedMask[pi] && ii >= 0 && jj >= 0 && ii < p.w && jj < p.h && p.state[jj * p.w + ii] === 2;
      if (!ok) placeAgent(i, active[(rnd() * active.length) | 0]);
    }
  }

  /** Grow or shrink the pool, keeping the agents that fit. */
  function resizeAgents(n) {
    const keep = Math.min(count, n);
    const opa = pa, oax = ax, oay = ay, oah = ah;
    cap = Math.max(1, n);
    pa = new Uint8Array(cap).fill(GONE);
    ax = new Float32Array(cap);
    ay = new Float32Array(cap);
    ah = new Int32Array(cap);
    pa.set(opa.subarray(0, keep));
    ax.set(oax.subarray(0, keep));
    ay.set(oay.subarray(0, keep));
    ah.set(oah.subarray(0, keep));
    count = cap; // the rest are GONE and get placed by rehome()
  }

  const S = {
    id: 'physarum',

    /**
     * Bind to a (new) domain. Patch indices may change (patches appear or
     * disappear, e.g. the loft), so everything is mapped by patch ID and
     * ownership is left empty until the host's assign() (also by ID).
     */
    rebind(newD, oldD, resample) {
      const oldT = trail;
      const oldPPM = oldD ? oldD.ppm : newD.ppm;
      D = newD;
      trail = new Float32Array(D.N);
      next = new Float32Array(D.N);
      tmp = new Float32Array(D.N);
      if (oldD && oldT) resample(oldD, D, oldT, trail, 0);
      owned = [];
      ownedMask = new Uint8Array(D.P.length);
      active = new Int32Array(0);
      // agents keep their metres; the ones whose patch is gone get re-homed in assign()
      if (pa && oldD) {
        const r = D.ppm / oldPPM;
        for (let i = 0; i < count; i++) {
          const ni = D.byId.get(oldD.P[pa[i]]?.id);
          pa[i] = ni === undefined ? GONE : ni;
          ax[i] *= r;
          ay[i] *= r;
        }
      }
    },

    assign(list, fresh) {
      const was = ownedMask && ownedMask.length === D.P.length ? ownedMask : new Uint8Array(D.P.length);
      owned = list.slice();
      ownedMask = new Uint8Array(D.P.length);
      for (const pi of owned) ownedMask[pi] = 1;
      for (let pi = 0; pi < D.P.length; pi++) if (was[pi] && !ownedMask[pi]) clearPatchFields(pi);
      buildActive();
      buildLookups();
      if (!pa) {
        allocAgents();
        spawnAll();
        return;
      }
      if (wantAgents() !== cap) resizeAgents(wantAgents());
      rehome();
      // fresh patches get their area share of agents moved in
      if (fresh.length && active.length && count) {
        let freshCells = 0;
        for (const pi of fresh) freshCells += D.P[pi].valid.length;
        const move = Math.round((count * freshCells) / active.length);
        for (let s = 0; s < move; s++) {
          const pi = fresh[(rnd() * fresh.length) | 0];
          const p = D.P[pi];
          if (!p.valid.length) continue;
          placeAgent((rnd() * count) | 0, p.valid[(rnd() * p.valid.length) | 0]);
        }
      }
    },

    owns: (pi) => !!ownedMask?.[pi],

    setParams(values) {
      const name = values['life.physPreset'];
      const changed = name !== preset;
      preset = PHYS_PRESETS[name] ? name : 'network';
      pr = PHYS_PRESETS[preset];
      pal = palette(values['life.physPalette']);
      geotaxis = Number(values['life.geotaxis']) || 0;
      geoSign = values['life.geoSign'] === 'up' ? -1 : 1;
      gravity = Number(values['life.gravity']) || 0;
      seamsOn = values['life.seams'] !== false;
      if (D) {
        for (const p of D.P) geoK[p.idx] = geotaxis * geoSign * gravity * p.gMag * GEO_TURN;
      }
      return changed;
    },

    step(steps) {
      if (!count) return;
      const ppm = D.ppm;
      const sa = (pr.sa * DEG * ASCALE) | 0;
      const ra = (pr.ra * DEG * ASCALE) | 0;
      const sd = pr.sd * ppm, ss = pr.ss * ppm, dep = pr.deposit;
      const capT = dep * SATURATION;
      const inv = 1 / ppm;
      const nb = nbS;
      const P = D.P;
      for (let s = 0; s < steps; s++) {
        for (let i = 0; i < count; i++) {
          const pi = pa[i];
          const H = haloIdx[pi];
          const HW = haloW[pi], HH = haloH[pi];
          const x = ax[i], y = ay[i];
          const a = ah[i];
          const al = (a - sa) & AMASK;
          const ar = (a + sa) & AMASK;
          // sense through the halo (reads across seams; −1 = wall)
          let ii = (x + COS[a] * sd + pad) | 0, jj = (y + SIN[a] * sd + pad) | 0;
          let id = ii >= 0 && jj >= 0 && ii < HW && jj < HH ? H[jj * HW + ii] : -1;
          const f = id >= 0 ? trail[id] : -1;
          ii = (x + COS[al] * sd + pad) | 0;
          jj = (y + SIN[al] * sd + pad) | 0;
          id = ii >= 0 && jj >= 0 && ii < HW && jj < HH ? H[jj * HW + ii] : -1;
          const l = id >= 0 ? trail[id] : -1;
          ii = (x + COS[ar] * sd + pad) | 0;
          jj = (y + SIN[ar] * sd + pad) | 0;
          id = ii >= 0 && jj >= 0 && ii < HW && jj < HH ? H[jj * HW + ii] : -1;
          const r = id >= 0 ? trail[id] : -1;

          let na = a;
          if (f > l && f > r) {
            // straight on
          } else if (f < l && f < r) {
            rs ^= rs << 13;
            rs ^= rs >>> 17;
            rs ^= rs << 5;
            na = rs & 1 ? a - ra : a + ra;
          } else if (l > r) na = a - ra;
          else if (r > l) na = a + ra;
          const gk = geoK[pi];
          if (gk !== 0) na += (gk * SIN[(geoA[pi] - na) & AMASK]) | 0;
          na &= AMASK;

          const nx = x + COS[na] * ss;
          const ny = y + SIN[na] * ss;
          const p = P[pi];
          let st = 0;
          if (nx >= 0 && ny >= 0 && nx < p.w && ny < p.h) st = p.state[(ny | 0) * p.w + (nx | 0)];
          if (st === 2) {
            ax[i] = nx;
            ay[i] = ny;
            ah[i] = na;
            const ti = p.off + (ny | 0) * p.w + (nx | 0);
            const tv = trail[ti] + dep;
            trail[ti] = tv > capT ? capT : tv;
            continue;
          }
          if (st === 0 && seamsOn && D.cross(pi, nx * inv, ny * inv, tmpX) && ownedMask[tmpX.q]) {
            const q = P[tmpX.q];
            const ci = Math.floor(tmpX.x * ppm), cj = Math.floor(tmpX.y * ppm);
            if (ci >= 0 && cj >= 0 && ci < q.w && cj < q.h && q.state[cj * q.w + ci] === 2) {
              pa[i] = tmpX.q;
              ax[i] = tmpX.x * ppm;
              ay[i] = tmpX.y * ppm;
              ah[i] = (na + Math.round(tmpX.angle * ASCALE)) & AMASK;
              const ti = q.off + cj * q.w + ci;
              const tv = trail[ti] + dep;
              trail[ti] = tv > capT ? capT : tv;
              crossings++;
              crossK[p.kindIdx * 5 + q.kindIdx]++;
              continue;
            }
          }
          // blocked (mask, seamless edge, another system): turn at random, stay
          rs ^= rs << 13;
          rs ^= rs >>> 17;
          rs ^= rs << 5;
          ah[i] = (rs >>> 0) & AMASK;
        }

        // turnover keeps foragers arriving so the reticulum holds its grain
        const fresh = Math.round(count * pr.turnover);
        for (let j = 0; j < fresh; j++) {
          if (++cursor >= count) cursor = 0;
          placeAgent(cursor, active[(rnd() * active.length) | 0]);
        }

        // diffuse (separable 3-tap box over the neighbour table) and decay
        const keep = 1 - pr.decay;
        const third = 1 / 3;
        const n = active.length;
        for (let t = 0; t < n; t++) {
          const g = active[t];
          tmp[g] = (trail[nb[g << 2]] + trail[g] + trail[nb[(g << 2) + 1]]) * third;
        }
        let sum = 0, sum2 = 0, cov = 0;
        for (let t = 0; t < n; t++) {
          const g = active[t];
          const v = (tmp[nb[(g << 2) + 2]] + tmp[g] + tmp[nb[(g << 2) + 3]]) * third * keep;
          next[g] = v;
          sum += v;
          sum2 += v * v;
          if (v > 8) cov++;
        }
        const sw = trail;
        trail = next;
        next = sw;
        coverage = n ? cov / n : 0;
        const want = sum > 0 ? sum2 / sum : 40;
        ref += (want - ref) * 0.05;
      }
    },

    paint(pi, out) {
      const p = D.P[pi];
      const lut = pal.lut;
      const k0 = Math.max(6, ref * 0.3);
      const n = p.w * p.h, off = p.off, st = p.state;
      for (let k = 0; k < n; k++) {
        if (st[k] !== 2) {
          out[k] = 0xff000000;
          continue;
        }
        const v = trail[off + k];
        out[k] = lut[((v / (v + k0)) * 255) | 0];
      }
    },

    food: (g) => {
      const v = trail[g];
      return v / (v + Math.max(6, ref * 0.3));
    },

    seedAt(pi, x, y) {
      const p = D.P[pi];
      const ppm = D.ppm;
      const cx = x * ppm, cy = y * ppm;
      const rad = Math.max(4, Math.round(0.15 * ppm));
      const r2 = rad * rad;
      for (let dy = -rad; dy <= rad; dy++) {
        for (let dx = -rad; dx <= rad; dx++) {
          const d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          const i = (cx + dx) | 0, j = (cy + dy) | 0;
          if (i < 0 || j < 0 || i >= p.w || j >= p.h || p.state[j * p.w + i] !== 2) continue;
          trail[p.off + j * p.w + i] += pr.deposit * 12 * (1 - d2 / r2);
        }
      }
      // an inoculum: move a sliver of the population to the click
      const move = Math.min(400, Math.round(count * 0.03));
      for (let s = 0; s < move; s++) {
        const a = rnd() * TAU, rr = Math.sqrt(rnd()) * rad * 0.8;
        const nx = cx + Math.cos(a) * rr, ny = cy + Math.sin(a) * rr;
        const i = nx | 0, j = ny | 0;
        if (i < 0 || j < 0 || i >= p.w || j >= p.h || p.state[j * p.w + i] !== 2) continue;
        const k = (rnd() * count) | 0;
        pa[k] = pi;
        ax[k] = nx;
        ay[k] = ny;
        ah[k] = Math.round(a * ASCALE) & AMASK;
      }
    },

    /** A spore landed here: a dab of attractant. */
    touch(pi, x, y) {
      const p = D.P[pi];
      const ci = Math.floor(x * D.ppm), cj = Math.floor(y * D.ppm);
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const i = ci + dx, j = cj + dy;
          if (i < 0 || j < 0 || i >= p.w || j >= p.h || p.state[j * p.w + i] !== 2) continue;
          trail[p.off + j * p.w + i] += pr.deposit * 6;
        }
      }
    },

    reseed() {
      if (!D) return;
      for (const pi of owned) clearPatchFields(pi);
      if (!pa || wantAgents() !== cap) allocAgents();
      count = active.length ? cap : 0;
      spawnAll();
    },

    clear() {
      for (const pi of owned) clearPatchFields(pi);
      // agents stay (they re-lay the network); a cleared room starts from haze
    },

    /** Agents per habitat type, given a patch → type function. */
    census(typeOf) {
      const out = { floor: 0, wall: 0, ceiling: 0 };
      for (let i = 0; i < count; i++) out[typeOf(pa[i])]++;
      return out;
    },

    /** For checks: positions (local metres) of agents on patch pi. */
    agentsOn(pi) {
      const res = [];
      for (let i = 0; i < count; i++) if (pa[i] === pi) res.push([ax[i] / D.ppm, ay[i] / D.ppm]);
      return res;
    },
    field: () => ({ trail, D }),
    stats: () => ({ agents: count, crossings, crossKinds: kindPairs(crossK), coverage, ref }),
    dispose() {
      trail = next = tmp = null;
      pa = ax = ay = ah = null;
    },
  };
  return S;
}
