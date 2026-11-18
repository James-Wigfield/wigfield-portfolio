/* ============================================================================
   PROVENANCE: adapted from public/artificial-life/src/systems/particle-life.js
   (the Specimen Cabinet, Plate IV, Ventrella 2017 / Mohr 2022). Never edit
   the original.

   What changed:
   - No torus: particles live on patches (patch, x, y in METRES). The force
     law, the kept tables (shells, diatoms) and the chase table are the
     cabinet's; the interaction radius is in metres (≈ 0.2 m).
   - Across a seam particles both INTERACT (each patch's spatial hash also
     holds "ghost" copies of the neighbours' particles within rmax of the
     shared edge, mapped through seam.M) and CROSS (position through M,
     velocity rotated by mapAngle(M)). Masks and seamless edges reflect.
   - GRAVITY (life.gravity × g_t): every particle slides along the patch's
     downhill direction, resisted by its caste's GRIP; pressing-in g_n
     (floor) adds friction. On a roof facet the peeling g_n pulls particles
     OFF: a particle whose grip (helped by how many neighbours it holds onto)
     can't hold the pull may DETACH — it becomes a world-space body in
     free fall and lands wherever the room's landing() says (the host joins
     it to the patch below or turns it into food for that patch's system).
     Steeper facet ⇒ more slide, less pull-off.
   - Population per patch from the global budget, by area; patches below
     target respawn a few particles per tick (roofs keep raining).
   - Pure-black background, castes coloured by life.plPalette; the plate
     persistence fade lives in a per-cell layer so creature glyphs drawn on
     top never smear.
   ========================================================================== */

import { palette } from '../palettes.js';
import { kindPairs } from './physarum.js';

const K = 6;
const DT = 1 / 30; //       one step per 30 Hz tick (the cabinet steps 0.02 at 60 Hz)
const DT0 = 0.02; //        the cabinet's step, which its friction values assume
const STEPS_PER_TICK = 1;

// Per-caste grip (how hard each caste holds a surface). Kept spread so walls
// and the roof visibly sort the castes: some drip, some hang on.
export const PL_GRIP = [0.25, 0.55, 0.85, 1.1, 1.4, 0.4];

const TABLES = {
  shells: [
    [-0.26, -0.2, -0.12, 0.95, 0.41, -0.62],
    [-0.95, -0.37, 0.47, -0.98, 0.11, -0.01],
    [-0.64, -0.09, 0.72, -0.13, -0.41, 0.43],
    [0.58, 0.73, 0.34, 0.45, 0.66, -0.49],
    [0.23, -0.55, 0.7, 0.9, -0.6, -0.53],
    [0.84, 0.56, 0.92, -0.66, -0.08, -0.73],
  ],
  diatoms: [
    [0.93, -0.03, -0.34, -0.4, 0.71, 0.45],
    [-0.12, 0.41, -0.19, -0.13, 0.25, -0.58],
    [-0.2, -0.83, 0.68, 0.47, -0.84, 0.04],
    [0.76, 0.68, -0.97, -0.93, -0.46, -0.7],
    [0.91, 0.05, 0.95, -0.82, 0.36, 0.8],
    [0.56, -0.43, -0.86, 0.26, -0.6, 0.5],
  ],
};

export const PL_PRESETS = {
  cells: { table: 'shells', rmax: 0.26, force: 10, friction: 0.85, beta: 0.3, persist: 0.55 },
  chasers: { table: 'chase', rmax: 0.28, force: 12, friction: 0.86, beta: 0.3, persist: 0.7 },
  swarm: { table: 'diatoms', rmax: 0.26, force: 9, friction: 0.86, beta: 0.3, persist: 0.55 },
};

const DENSITY = 115; // particles per m² before the budget cap (~25 within rmax)

export function createParticleLife({ rng, budget, onDetach }) {
  let D = null;
  let owned = [];
  let ownedMask = null;
  let preset = 'cells', pr = PL_PRESETS.cells;
  let pal = palette('neon');
  let gravity = 1, seamsOn = true;
  const mat = new Float32Array(K * K);
  // pool
  let cap = 0, count = 0;
  let pp, px, py, vx, vy, sp, near, fxs, fys;
  // per-patch
  let target = new Int32Array(0);
  let onPatch = new Int32Array(0);
  // hash
  let base = new Int32Array(0), gnx = new Int32Array(0), gny = new Int32Array(0);
  let nKeys = 0;
  let counts = new Uint32Array(1), start = new Uint32Array(2);
  let entX, entY, entSp, entReal, keys, sX, sY, sSp, sReal;
  let entCap = 0;
  // paint layer (persistent per cell)
  let layer = null;
  let discDX = new Int8Array(0), discDY = new Int8Array(0), discW = new Float32Array(0);
  let crossings = 0, detached = 0;
  const crossK = new Int32Array(25);
  const tmpX = { q: 0, x: 0, y: 0, angle: 0, edge: null };

  function rerollMatrix(kind) {
    if (TABLES[kind]) {
      const t = TABLES[kind];
      for (let i = 0; i < K; i++) for (let j = 0; j < K; j++) mat[i * K + j] = t[i][j];
    } else if (kind === 'chase') {
      for (let i = 0; i < K; i++) {
        for (let j = 0; j < K; j++) {
          mat[i * K + j] = i === j ? 0.55 : j === (i + 1) % K ? 0.95 : j === (i + K - 1) % K ? -0.75 : -0.1 + rng() * 0.2;
        }
      }
    } else {
      for (let i = 0; i < K * K; i++) mat[i] = Math.round((rng() * 2 - 1) * 100) / 100;
    }
  }

  function allocPool() {
    cap = budget.plParticles;
    pp = new Uint8Array(cap);
    px = new Float32Array(cap);
    py = new Float32Array(cap);
    vx = new Float32Array(cap);
    vy = new Float32Array(cap);
    sp = new Uint8Array(cap);
    near = new Uint8Array(cap);
    fxs = new Float32Array(cap);
    fys = new Float32Array(cap);
    entCap = cap * 2;
    entX = new Float32Array(entCap);
    entY = new Float32Array(entCap);
    entSp = new Uint8Array(entCap);
    entReal = new Int32Array(entCap);
    keys = new Uint32Array(entCap);
    sX = new Float32Array(entCap);
    sY = new Float32Array(entCap);
    sSp = new Uint8Array(entCap);
    sReal = new Int32Array(entCap);
    count = 0;
  }

  function buildDisc() {
    const rad = Math.max(1.1, 0.05 * D.ppm);
    const ri = Math.ceil(rad);
    const dxs = [], dys = [], ws = [];
    for (let dy = -ri; dy <= ri; dy++) {
      for (let dx = -ri; dx <= ri; dx++) {
        const d = Math.hypot(dx, dy);
        if (d > rad + 0.5) continue;
        const t = Math.max(0, Math.min(1, (rad + 0.5 - d) / 1.4));
        dxs.push(dx);
        dys.push(dy);
        ws.push(t * t * (3 - 2 * t));
      }
    }
    discDX = Int8Array.from(dxs);
    discDY = Int8Array.from(dys);
    discW = Float32Array.from(ws);
  }

  function buildHash() {
    const r = pr.rmax;
    base = new Int32Array(D.P.length);
    gnx = new Int32Array(D.P.length);
    gny = new Int32Array(D.P.length);
    nKeys = 0;
    for (const pi of owned) {
      const p = D.P[pi];
      gnx[pi] = Math.ceil(p.patch.width / r) + 2;
      gny[pi] = Math.ceil(p.patch.height / r) + 2;
      base[pi] = nKeys;
      nKeys += gnx[pi] * gny[pi];
    }
    counts = new Uint32Array(nKeys + 1);
    start = new Uint32Array(nKeys + 1);
  }

  function computeTargets() {
    target = new Int32Array(D.P.length);
    let area = 0;
    for (const pi of owned) area += D.P[pi].valid.length / (D.ppm * D.ppm);
    const dens = area > 0 ? Math.min(DENSITY, (cap * 0.9) / area) : 0;
    for (const pi of owned) target[pi] = Math.round((dens * D.P[pi].valid.length) / (D.ppm * D.ppm));
  }

  function spawn(pi, x, y, s = rng.int(K)) {
    if (count >= cap) return -1;
    const i = count++;
    pp[i] = pi;
    px[i] = x;
    py[i] = y;
    vx[i] = 0;
    vy[i] = 0;
    sp[i] = s;
    return i;
  }

  function kill(i) {
    const last = --count;
    if (i === last) return;
    pp[i] = pp[last];
    px[i] = px[last];
    py[i] = py[last];
    vx[i] = vx[last];
    vy[i] = vy[last];
    sp[i] = sp[last];
  }

  function fillPatch(pi) {
    const want = target[pi];
    for (let n = 0; n < want; n++) {
      const pt = D.randomPoint(pi, rng);
      if (!pt) break;
      if (spawn(pi, pt[0], pt[1]) < 0) break;
    }
  }

  function removeFrom(pi) {
    for (let i = count - 1; i >= 0; i--) if (pp[i] === pi) kill(i);
  }

  function clearLayer(pi) {
    if (!layer) return;
    const p = D.P[pi];
    layer.fill(0xff000000, p.off, p.off + p.w * p.h);
  }

  function live(pi, x, y) {
    const p = D.P[pi];
    const i = Math.floor(x * D.ppm), j = Math.floor(y * D.ppm);
    if (i < 0 || j < 0 || i >= p.w || j >= p.h) return 0;
    return p.state[j * p.w + i];
  }

  const S = {
    id: 'particlelife',

    rebind(newD, oldD) {
      const oldIds = oldD ? oldD.P.map((p) => p.id) : null;
      D = newD;
      layer = new Uint32Array(D.N).fill(0xff000000);
      if (!pp) allocPool();
      buildDisc();
      if (oldIds) {
        // particles keep their metres; ones that land off a live cell go
        for (let i = count - 1; i >= 0; i--) {
          const ni = D.byId.get(oldIds[pp[i]]);
          if (ni === undefined || live(ni, px[i], py[i]) !== 2) kill(i);
          else pp[i] = ni;
        }
      }
      // indices may have changed (patches come and go): ownership is re-given by ID in assign()
      owned = [];
      ownedMask = new Uint8Array(D.P.length);
      target = new Int32Array(D.P.length);
      onPatch = new Int32Array(D.P.length);
    },

    assign(list, fresh) {
      const was = ownedMask && ownedMask.length === D.P.length ? ownedMask : new Uint8Array(D.P.length);
      owned = list.slice();
      ownedMask = new Uint8Array(D.P.length);
      for (const pi of owned) ownedMask[pi] = 1;
      for (let pi = 0; pi < D.P.length; pi++) {
        if (was[pi] && !ownedMask[pi]) {
          removeFrom(pi);
          clearLayer(pi);
        }
      }
      // particles left on patches nobody owns (e.g. after a rebuild) go
      for (let i = count - 1; i >= 0; i--) if (!ownedMask[pp[i]]) kill(i);
      onPatch = new Int32Array(D.P.length);
      buildHash();
      computeTargets();
      for (const pi of fresh) {
        removeFrom(pi);
        clearLayer(pi);
        fillPatch(pi);
      }
    },

    owns: (pi) => !!ownedMask?.[pi],

    setParams(values) {
      const name = values['life.plPreset'];
      const changed = name !== preset;
      preset = PL_PRESETS[name] ? name : 'cells';
      pr = PL_PRESETS[preset];
      pal = palette(values['life.plPalette']);
      gravity = Number(values['life.gravity']) || 0;
      seamsOn = values['life.seams'] !== false;
      if (D && changed) buildHash();
      return changed;
    },

    step(substeps) {
      if (!owned.length) return;
      const steps = substeps * STEPS_PER_TICK;
      const rmax = pr.rmax, beta = pr.beta, rmax2 = rmax * rmax;
      const invR = 1 / rmax;
      const kick = rmax * pr.force * DT;
      const fricStep = Math.pow(pr.friction, DT / DT0); // same decay per second as the cabinet
      const invBeta = 1 / beta, invRest = 1 / (1 - beta);
      const P = D.P;
      const gAcc = 3 * rmax * gravity; // m/s², proportional to the interaction scale
      for (let s = 0; s < steps; s++) {
        // ── spatial hash: real particles + ghosts across seams ───────────────
        let ne = 0;
        for (let i = 0; i < count; i++) {
          entX[ne] = px[i];
          entY[ne] = py[i];
          entSp[ne] = sp[i];
          entReal[ne] = i;
          ne++;
        }
        if (seamsOn) {
          for (let i = 0; i < count && ne < entCap; i++) {
            const p = P[pp[i]];
            const x = px[i], y = py[i];
            for (const ed of p.edges) {
              if (!ed.seam || !ownedMask[ed.seam.q]) continue;
              const sd = (x - ed.ax) * ed.nx + (y - ed.ay) * ed.ny; // < 0 inside
              if (sd < -rmax) continue;
              const along = (x - ed.ax) * ed.tx + (y - ed.ay) * ed.ty;
              if (along < -rmax || along > ed.len + rmax) continue;
              const M = ed.seam.M;
              entX[ne] = M[0] * x + M[1] * y + M[4];
              entY[ne] = M[2] * x + M[3] * y + M[5];
              entSp[ne] = sp[i];
              entReal[ne] = -1 - ed.seam.q; // ghost, lives in patch q
              ne++;
              if (ne >= entCap) break;
            }
          }
        }
        counts.fill(0);
        for (let e = 0; e < ne; e++) {
          const r = entReal[e];
          const pi = r >= 0 ? pp[r] : -1 - r;
          let cx = Math.floor(entX[e] * invR) + 1;
          let cy = Math.floor(entY[e] * invR) + 1;
          const nx = gnx[pi], ny = gny[pi];
          cx = cx < 0 ? 0 : cx >= nx ? nx - 1 : cx;
          cy = cy < 0 ? 0 : cy >= ny ? ny - 1 : cy;
          const key = base[pi] + cy * nx + cx;
          keys[e] = key;
          counts[key]++;
        }
        let acc = 0;
        for (let c = 0; c < nKeys; c++) {
          start[c] = acc;
          acc += counts[c];
        }
        start[nKeys] = acc;
        for (let c = 0; c < nKeys; c++) counts[c] = start[c];
        // scatter into contiguous, cell-sorted arrays (cache-friendly inner loop)
        for (let e = 0; e < ne; e++) {
          const t = counts[keys[e]]++;
          sX[t] = entX[e];
          sY[t] = entY[e];
          sSp[t] = entSp[e];
          sReal[t] = entReal[e];
        }

        // ── forces on real particles from real + ghost neighbours ────────────
        for (let i = 0; i < count; i++) {
          const pi = pp[i];
          const xi = px[i], yi = py[i], rowi = sp[i] * K;
          const nx = gnx[pi], ny = gny[pi], b0 = base[pi];
          let cx = Math.floor(xi * invR) + 1, cy = Math.floor(yi * invR) + 1;
          cx = cx < 0 ? 0 : cx >= nx ? nx - 1 : cx;
          cy = cy < 0 ? 0 : cy >= ny ? ny - 1 : cy;
          let fx = 0, fy = 0, nn = 0;
          const y0 = cy > 0 ? cy - 1 : 0, y1 = cy < ny - 1 ? cy + 1 : ny - 1;
          const x0 = cx > 0 ? cx - 1 : 0, x1 = cx < nx - 1 ? cx + 1 : nx - 1;
          for (let yy = y0; yy <= y1; yy++) {
            // cells x0..x1 of one row are contiguous in the sorted arrays
            const c0 = b0 + yy * nx + x0, c1 = b0 + yy * nx + x1;
            for (let t = start[c0], t1 = start[c1 + 1]; t < t1; t++) {
              const dx = sX[t] - xi, dy = sY[t] - yi;
              const d2 = dx * dx + dy * dy;
              if (d2 >= rmax2 || d2 === 0 || sReal[t] === i) continue;
              const dist = Math.sqrt(d2);
              const q = dist * invR;
              let f;
              if (q < beta) f = q * invBeta - 1;
              else f = mat[rowi + sSp[t]] * (1 - Math.abs(2 * q - 1 - beta) * invRest);
              fx += (dx / dist) * f;
              fy += (dy / dist) * f;
              nn++;
            }
          }
          fxs[i] = fx;
          fys[i] = fy;
          near[i] = nn > 255 ? 255 : nn;
        }

        // ── gravity, grip, friction, integrate, edges ────────────────────────
        for (let i = count - 1; i >= 0; i--) {
          const pi = pp[i];
          const p = P[pi];
          const grip = PL_GRIP[sp[i]];
          const press = p.gn > 0 ? p.gn : 0;
          const fric = fricStep * (1 - 0.15 * press * gravity);
          const slide = Math.max(0, 1 - grip * 0.7);
          let nvx = vx[i] * fric + fxs[i] * kick + p.gt[0] * gAcc * slide * DT;
          let nvy = vy[i] * fric + fys[i] * kick + p.gt[1] * gAcc * slide * DT;
          // peel: a facet pulls particles off; grip + neighbours hold on
          if (p.gn < 0 && gravity > 0) {
            const pull = gravity * -p.gn;
            const hold = grip * (0.6 + 0.12 * near[i]);
            if (pull > hold && rng() < 0.0006 * (pull / hold - 1) * STEPS_PER_TICK) {
              detached++;
              onDetach?.(pi, px[i], py[i], nvx, nvy, sp[i], pal.speciesRGB[sp[i]]);
              kill(i);
              continue;
            }
          }
          let x = px[i] + nvx * DT;
          let y = py[i] + nvy * DT;
          const st = live(pi, x, y);
          if (st !== 2) {
            let moved = false;
            if (st === 0 && seamsOn && D.cross(pi, x, y, tmpX) && ownedMask[tmpX.q] && live(tmpX.q, tmpX.x, tmpX.y) === 2) {
              const c = Math.cos(tmpX.angle), sn = Math.sin(tmpX.angle);
              const rvx = nvx * c - nvy * sn, rvy = nvx * sn + nvy * c;
              pp[i] = tmpX.q;
              px[i] = tmpX.x;
              py[i] = tmpX.y;
              vx[i] = rvx;
              vy[i] = rvy;
              crossings++;
              crossK[p.kindIdx * 5 + P[tmpX.q].kindIdx]++;
              moved = true;
            }
            if (!moved) {
              // reflect off the edge (or the mask) and stay put
              const ed = st === 0 ? D.edgeOut(pi, x, y) : null;
              if (ed) {
                const vn = nvx * ed.nx + nvy * ed.ny;
                if (vn > 0) {
                  nvx -= 1.6 * vn * ed.nx;
                  nvy -= 1.6 * vn * ed.ny;
                }
              } else {
                nvx *= -0.5;
                nvy *= -0.5;
              }
              vx[i] = nvx;
              vy[i] = nvy;
            }
            continue;
          }
          px[i] = x;
          py[i] = y;
          vx[i] = nvx;
          vy[i] = nvy;
        }
      }

      // ── keep each patch near its share (roofs keep raining) ────────────────
      // Particles drift across seams and crowd some patches (round the apex),
      // so topping up only the starved ones let the TOTAL creep to the cap and
      // the tick cost triple over a few minutes (lead, after QA's soak). Top
      // up only while the total is under the summed targets, and thin a patch
      // that holds more than 1.5× its share.
      onPatch = new Int32Array(D.P.length);
      for (let i = 0; i < count; i++) onPatch[pp[i]]++;
      let totalTarget = 0;
      for (const pi of owned) totalTarget += target[pi];
      for (const pi of owned) {
        const deficit = Math.min(target[pi] - onPatch[pi], totalTarget - count);
        const n = Math.min(deficit, 3);
        for (let k = 0; k < n; k++) {
          const pt = D.randomPoint(pi, rng);
          if (pt) spawn(pi, pt[0], pt[1]);
        }
        let excess = Math.min(onPatch[pi] - Math.ceil(target[pi] * 1.5), 4);
        if (excess > 0) {
          for (let i = count - 1; i >= 0 && excess > 0; i--) {
            if (pp[i] !== pi || rng() > 0.5) continue;
            kill(i);
            onPatch[pi]--;
            excess--;
          }
        }
      }
    },

    /** A falling particle arrives on patch pi; joins if there is room. */
    land(pi, x, y, s) {
      if (!ownedMask?.[pi] || live(pi, x, y) !== 2) return false;
      if (onPatch[pi] > target[pi] * 1.25) return false;
      return spawn(pi, x, y, s) >= 0;
    },

    paint(pi, out) {
      const p = D.P[pi];
      const n = p.w * p.h, off = p.off, st = p.state;
      const keep = pr.persist;
      for (let k = 0; k < n; k++) {
        const g = off + k;
        if (st[k] !== 2) {
          out[k] = 0xff000000;
          continue;
        }
        const v = layer[g];
        const r = ((v & 255) * keep) | 0;
        const gg = (((v >>> 8) & 255) * keep) | 0;
        const b = (((v >>> 16) & 255) * keep) | 0;
        layer[g] = (0xff000000 | (b << 16) | (gg << 8) | r) >>> 0;
      }
      const ppm = D.ppm;
      const nOff = discW.length;
      const cols = pal.speciesRGB;
      for (let i = 0; i < count; i++) {
        if (pp[i] !== pi) continue;
        const x = (px[i] * ppm) | 0, y = (py[i] * ppm) | 0;
        const c = cols[sp[i]];
        const cr = c[0], cg = c[1], cb = c[2];
        for (let k = 0; k < nOff; k++) {
          const xx = x + discDX[k], yy = y + discDY[k];
          if (xx < 0 || yy < 0 || xx >= p.w || yy >= p.h) continue;
          const lk = yy * p.w + xx;
          if (st[lk] !== 2) continue;
          const g = off + lk;
          const w = discW[k];
          const v = layer[g];
          const r = (v & 255) + (cr - (v & 255)) * w;
          const gg = ((v >>> 8) & 255) + (cg - ((v >>> 8) & 255)) * w;
          const b = ((v >>> 16) & 255) + (cb - ((v >>> 16) & 255)) * w;
          layer[g] = (0xff000000 | ((b | 0) << 16) | ((gg | 0) << 8) | (r | 0)) >>> 0;
        }
      }
      for (let k = 0; k < n; k++) if (st[k] === 2) out[k] = layer[off + k];
    },

    food: (g) => {
      const v = layer[g];
      const m = Math.max(v & 255, (v >>> 8) & 255, (v >>> 16) & 255);
      return m / 255;
    },

    seedAt(pi, x, y) {
      const rad = pr.rmax * 2.5;
      for (let i = 0; i < count; i++) {
        if (pp[i] !== pi) continue;
        const dx = px[i] - x, dy = py[i] - y;
        const d = Math.hypot(dx, dy);
        if (d > rad || d === 0) continue;
        const f = (1 - d / rad) * 12 * pr.rmax;
        vx[i] += (dx / d) * f;
        vy[i] += (dy / d) * f;
      }
      // and a burst of new particles of two castes
      const s0 = rng.int(K), s1 = rng.int(K);
      for (let k = 0; k < 40; k++) {
        const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * 0.12;
        const xx = x + Math.cos(a) * r, yy = y + Math.sin(a) * r;
        if (live(pi, xx, yy) === 2) spawn(pi, xx, yy, k & 1 ? s0 : s1);
      }
    },

    reseed() {
      rerollMatrix(pr.table);
      for (const pi of owned) {
        removeFrom(pi);
        clearLayer(pi);
        fillPatch(pi);
      }
    },

    clear() {
      for (const pi of owned) {
        removeFrom(pi);
        clearLayer(pi);
      }
      target.fill(0);
    },

    restoreTargets: () => computeTargets(),

    census(typeOf) {
      const out = { floor: 0, wall: 0, ceiling: 0 };
      for (let i = 0; i < count; i++) out[typeOf(pp[i])]++;
      return out;
    },
    /** For checks: positions and castes on patch pi. */
    particlesOn(pi) {
      const res = [];
      for (let i = 0; i < count; i++) if (pp[i] === pi) res.push([px[i], py[i], sp[i]]);
      return res;
    },
    init(values) {
      S.setParams(values);
      rerollMatrix(pr.table);
    },
    stats: () => ({ particles: count, crossings, crossKinds: kindPairs(crossK), detached }),
    dispose() {
      layer = null;
      pp = px = py = vx = vy = sp = near = fxs = fys = null;
      entX = entY = entSp = entReal = keys = sX = sY = sSp = sReal = null;
    },
  };
  return S;
}
