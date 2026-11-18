/* ============================================================================
   PROVENANCE: adapted from public/artificial-life/src/systems/gray-scott.js
   (the Specimen Cabinet, Plate II, Pearson 1993). Never edit the original.

   What changed:
   - No torus. The grid is the life DOMAIN (life/domain.js): every patch this
     system owns, laid end to end. Neighbours come from domain.nb, so a cell
     at a wall's right edge diffuses into the next wall, the top row into the
     roof facet above, the bottom row into the floor (seams exchange edge
     cells; equal ppm makes them line up). Masks and seamless edges are
     zero-flux, and so is a seam to a patch running another system (its own
     neighbour table, domain.nbFor) — otherwise drift would pour empty
     substrate in from the eave and wash the walls clean.
   - DRIFT: an upwind advection term along the patch's g_t, so patterns drip
     down walls like rain on glass, creep down roof facets (∝ sin pitch) and
     sit still on the floor. Speed = life.drift × life.gravity × |g_t| × 0.12
     cells per step (capped at 0.3: Du·4 + |c| ≤ 1 keeps explicit Euler
     stable). u and v drift together, so spots travel intact.
   - RAIN: a drifting Turing pattern with nothing upstream washes off the
     wall in under a minute (measured), so while drift is on, single nuclei
     land at random along each patch's upstream band (top of a wall, apex end
     of a facet) at a rate ∝ drift × |g_t|. They grow into coral and run down.
     Over the eave, a GS roof feeds the GS wall below through the seam.
   - Pure-black background and selectable bright palettes (life.gsPalette).
   - Presets reseed per patch (blob counts scale with patch area).
   - No Surface/canvas: paint() writes packed RGBA into the patch buffer.
   ========================================================================== */

import { palette } from '../palettes.js';

const DT = 1;
/** Drift tuning (exported so the checks can sweep it). */
export const GS_TUNE = {
  driftMax: 0.12, // cells per step at drift 1, gravity 1, |g_t| 1 (stability cap 0.36)
  driftU: 1, //      u drifts with v: the texture moves intact instead of tearing
  rain: 0.6, //      upstream nuclei per step per metre of upstream edge, at drift 1
};

export const GS_PRESETS = {
  coral: { F: 0.0545, k: 0.062, Du: 0.16, Dv: 0.08, seed: 'scatter' },
  worms: { F: 0.04, k: 0.0625, Du: 0.16, Dv: 0.08, seed: 'nuclei' },
  mitosis: { F: 0.0367, k: 0.0649, Du: 0.16, Dv: 0.08, seed: 'centre' },
  front: { F: 0.0545, k: 0.062, Du: 0.16, Dv: 0.08, seed: 'bar' },
};

export function createGrayScott({ rng }) {
  let D = null;
  let owned = []; //       patch indices
  let ownedMask = null; // Uint8Array(P)
  let u = null, v = null, u2 = null, v2 = null;
  let nbS = null; // domain.nb with other systems' cells walled off
  let preset = 'coral';
  let pr = GS_PRESETS.coral;
  let pal = palette('aurora');
  let drift = 0.35, gravity = 1;
  let meanV = 0;

  function alloc(N) {
    u = new Float32Array(N).fill(1);
    v = new Float32Array(N);
    u2 = new Float32Array(N).fill(1);
    v2 = new Float32Array(N);
  }

  function blankPatch(pi) {
    const p = D.P[pi];
    const a = p.off, b = p.off + p.w * p.h;
    u.fill(1, a, b);
    v.fill(0, a, b);
    u2.fill(1, a, b);
    v2.fill(0, a, b);
  }

  function blob(pi, ci, cj, r, amount = 0.55) {
    const p = D.P[pi];
    const r2 = r * r;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        const i = ci + dx, j = cj + dy;
        if (i < 0 || j < 0 || i >= p.w || j >= p.h) continue;
        const k = j * p.w + i;
        if (p.state[k] !== 2) continue;
        const g = p.off + k;
        const f = 1 - Math.sqrt(d2) / r;
        v[g] = Math.min(1, v[g] + amount * (0.7 + 0.3 * f));
        u[g] = Math.max(0, u[g] - 0.5 * amount * (0.7 + 0.3 * f));
      }
    }
  }

  // per patch: live cells in the upstream band (where rain lands)
  let upstream = [];
  function buildUpstream() {
    upstream = [];
    for (const pi of owned) {
      const p = D.P[pi];
      if (p.gMag < 0.05) {
        upstream[pi] = null;
        continue;
      }
      // project live cells on −g_t; the top 7 % of that extent is upstream
      const ux = -p.gt[0] / p.gMag, uy = -p.gt[1] / p.gMag;
      let lo = Infinity, hi = -Infinity;
      const proj = new Float32Array(p.valid.length);
      p.valid.forEach((g, t) => {
        const k = g - p.off;
        const j = (k / p.w) | 0;
        const v2 = (k - j * p.w) * ux + j * uy;
        proj[t] = v2;
        if (v2 < lo) lo = v2;
        if (v2 > hi) hi = v2;
      });
      const cut = hi - (hi - lo) * 0.07;
      const band = [];
      p.valid.forEach((g, t) => {
        if (proj[t] >= cut) band.push(g);
      });
      // upstream edge length (m) ≈ band cells / band depth
      const depth = Math.max(1, (hi - cut) + 1);
      upstream[pi] = { cells: Int32Array.from(band), edgeM: band.length / depth / D.ppm };
    }
  }

  function seedPatch(pi) {
    blankPatch(pi);
    const p = D.P[pi];
    if (!p.valid.length) return;
    const ppm = D.ppm;
    const cell = () => {
      const k = p.valid[(rng() * p.valid.length) | 0] - p.off;
      const j = (k / p.w) | 0;
      return [k - j * p.w, j];
    };
    if (pr.seed === 'scatter') {
      // the cabinet: 14 blobs on 65k cells → one per ~4.7k cells, at least 2
      const n = Math.max(2, Math.round(p.valid.length / 2600));
      const r = Math.max(3, Math.round(0.14 * ppm));
      for (let i = 0; i < n; i++) {
        const [ci, cj] = cell();
        blob(pi, ci, cj, r);
      }
    } else if (pr.seed === 'nuclei') {
      for (const g of p.valid) if (rng() < 0.02) {
        v[g] = 1;
        u[g] = 0;
      }
    } else if (pr.seed === 'centre') {
      // a small colony at the patch's centre of mass, dividing outwards
      let sx = 0, sy = 0;
      for (const g of p.valid) {
        const k = g - p.off;
        const j = (k / p.w) | 0;
        sx += k - j * p.w;
        sy += j;
      }
      const cx = sx / p.valid.length, cy = sy / p.valid.length;
      const R = Math.max(3, 0.18 * ppm);
      for (const g of p.valid) {
        const k = g - p.off;
        const j = (k / p.w) | 0;
        const i = k - j * p.w;
        if (Math.abs(i - cx) < R && Math.abs(j - cy) < R && rng() < 0.06) {
          v[g] = 1;
          u[g] = 0;
        }
      }
    } else if (pr.seed === 'bar') {
      // one inoculation line across the middle of the patch
      let ymin = Infinity, ymax = -Infinity;
      for (const g of p.valid) {
        const j = ((g - p.off) / p.w) | 0;
        if (j < ymin) ymin = j;
        if (j > ymax) ymax = j;
      }
      const mid = Math.round((ymin + ymax) / 2);
      const half = Math.max(2, Math.round(0.08 * ppm));
      for (const g of p.valid) {
        const j = ((g - p.off) / p.w) | 0;
        if (Math.abs(j - mid) <= half) {
          v[g] = 0.6;
          u[g] = 0.4;
        } else if (rng() < 0.0006) v[g] = 0.5;
      }
    }
  }

  const S = {
    id: 'grayscott',

    /** Bind to a (new) domain. Fields are resampled by local position. */
    rebind(newD, oldD, resample) {
      const oldU = u, oldV = v;
      D = newD;
      alloc(D.N);
      if (oldD && oldU) {
        resample(oldD, D, oldU, u, 1);
        resample(oldD, D, oldV, v, 0);
        u2.set(u);
        v2.set(v);
      }
      // indices may have changed (patches come and go): ownership is re-given by ID in assign()
      owned = [];
      ownedMask = new Uint8Array(D.P.length);
      nbS = D.nb;
      upstream = [];
    },

    /** Which patches this system runs on; `fresh` ones are (re)seeded. */
    assign(list, fresh) {
      const was = ownedMask && ownedMask.length === D.P.length ? ownedMask : new Uint8Array(D.P.length);
      owned = list.slice();
      ownedMask = new Uint8Array(D.P.length);
      for (const pi of owned) ownedMask[pi] = 1;
      for (let pi = 0; pi < D.P.length; pi++) if (was[pi] && !ownedMask[pi]) blankPatch(pi);
      nbS = D.nbFor(ownedMask);
      buildUpstream();
      for (const pi of fresh) seedPatch(pi);
    },

    owns: (pi) => !!ownedMask?.[pi],

    setParams(values) {
      const name = values['life.gsPreset'];
      const changed = name !== preset;
      preset = GS_PRESETS[name] ? name : 'coral';
      pr = GS_PRESETS[preset];
      pal = palette(values['life.gsPalette']);
      drift = Number(values['life.drift']) || 0;
      gravity = Number(values['life.gravity']) || 0;
      return changed; // the host reseeds on a preset change
    },

    step(steps) {
      const { Du, Dv, F, k } = pr;
      const nb = nbS;
      const fk = F + k;
      for (let s = 0; s < steps; s++) {
        let m = 0, cnt = 0;
        if (drift > 0 && gravity > 0) {
          for (const pi of owned) {
            const up = upstream[pi];
            if (!up || !up.cells.length) continue;
            const rate = GS_TUNE.rain * drift * gravity * D.P[pi].gMag * up.edgeM;
            if (rng() < rate * 0.05) {
              const g = up.cells[(rng() * up.cells.length) | 0];
              v[g] = 1;
              u[g] = 0;
            }
          }
        }
        for (const pi of owned) {
          const p = D.P[pi];
          const list = p.valid;
          const DM = GS_TUNE.driftMax;
          let cx = drift * DM * gravity * p.gt[0];
          let cy = drift * DM * gravity * p.gt[1];
          const cm = Math.hypot(cx, cy);
          if (cm > 0.3) {
            cx *= 0.3 / cm;
            cy *= 0.3 / cm;
          }
          const DU = GS_TUNE.driftU;
          const adv = cm > 1e-5;
          for (let t = 0; t < list.length; t++) {
            const g = list[t];
            const b = g << 2;
            const e = nb[b], w = nb[b + 1], n = nb[b + 2], so = nb[b + 3];
            const uc = u[g], vc = v[g];
            const lu = u[e] + u[w] + u[n] + u[so] - 4 * uc;
            const lv = v[e] + v[w] + v[n] + v[so] - 4 * vc;
            const reac = uc * vc * vc;
            let nu = uc + DT * (Du * lu - reac + F * (1 - uc));
            let nv = vc + DT * (Dv * lv + reac - fk * vc);
            if (adv) {
              // upwind: the value flows in from the side the drift comes from
              const dvx = cx < 0 ? v[e] - vc : vc - v[w];
              const dvy = cy < 0 ? v[n] - vc : vc - v[so];
              const dux = cx < 0 ? u[e] - uc : uc - u[w];
              const duy = cy < 0 ? u[n] - uc : uc - u[so];
              nv -= cx * dvx + cy * dvy;
              nu -= DU * (cx * dux + cy * duy);
            }
            u2[g] = nu < 0 ? 0 : nu > 1 ? 1 : nu;
            v2[g] = nv < 0 ? 0 : nv > 1 ? 1 : nv;
            m += v2[g];
          }
          cnt += list.length;
        }
        let tmp = u;
        u = u2;
        u2 = tmp;
        tmp = v;
        v = v2;
        v2 = tmp;
        meanV = cnt ? m / cnt : 0;
      }
    },

    paint(pi, out) {
      const p = D.P[pi];
      const lut = pal.lut;
      const n = p.w * p.h, off = p.off, st = p.state;
      for (let k = 0; k < n; k++) {
        if (st[k] !== 2) {
          out[k] = 0xff000000;
          continue;
        }
        // v tops out near 0.35 in these regimes; ×2.7 maps that to the bright end
        let t = v[off + k] * 2.7;
        t = t > 1 ? 1 : t;
        out[k] = lut[(t * 255) | 0];
      }
    },

    food: (g) => {
      const t = v[g] * 2.7;
      return t > 1 ? 1 : t;
    },

    seedAt(pi, x, y) {
      const r = Math.max(3, Math.round(0.15 * D.ppm));
      blob(pi, Math.floor(x * D.ppm), Math.floor(y * D.ppm), r, 0.6);
    },

    /** A spore landed here: a small nucleus. */
    touch(pi, x, y) {
      blob(pi, Math.floor(x * D.ppm), Math.floor(y * D.ppm), 2, 0.4);
    },

    reseed() {
      for (const pi of owned) seedPatch(pi);
    },

    clear() {
      for (const pi of owned) blankPatch(pi);
    },

    /** Read-only access for checks: v field and the domain. */
    field: () => ({ v, u, D }),
    stats: () => ({ meanV }),
    dispose() {
      u = v = u2 = v2 = null;
    },
  };
  return S;
}
