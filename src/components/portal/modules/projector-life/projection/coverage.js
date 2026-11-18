/* ============================================================================
   PROJECTOR LIFE — coverage readout (CPU, on change only)
   ----------------------------------------------------------------------------
   Samples every patch on a STEP grid (cell-centred, so every sample stands
   for the same area), skips samples under ACTIVE masks, and asks each active
   projector: in the frame? facing it? not shadowed (its depth map, read back
   once per depth render)? Area fractions per surface type (floor / wall /
   ceiling, the patch's effective habitat type), total, per patch, by
   projector count, plus the median projector pixel density on covered
   surfaces. Scanline intervals instead of point-in-polygon and an
   allocation-free inner loop keep a recompute to a few ms. Pure function of
   its inputs (Node-testable with a fake depth).
   ========================================================================== */

import { DEPTH_W } from './projector.js';

export const STEP = 0.05; // m

/** The patch's habitat type with any region override. */
export function effectiveType(patch, values) {
  const o = values?.[`region.${patch.id}.type`];
  return o && o !== 'auto' ? o : patch.typeAuto || patch.type;
}

function median(a) {
  if (!a.length) return null;
  a.sort((x, y) => x - y);
  return a[Math.floor(a.length / 2)];
}

/** x-intervals [x0, x1, x0, x1, …] where the horizontal line y crosses a simple polygon. */
export function rowIntervals(poly, y) {
  const xs = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
  }
  return xs.sort((a, b) => a - b);
}

function inIntervals(x, iv) {
  for (let k = 0; k + 1 < iv.length; k += 2) if (x >= iv[k] && x < iv[k + 1]) return true;
  return false;
}

/**
 * projectors: projectorFromValues() records (active ones).
 * depthAt(i, sx, sy) → stored axial depth (m) at image point (sx, sy ∈ [−1,1]),
 *   or null when occlusion is off.
 * resW: projector resolution (px wide) for pxPerM.
 */
export function computeCoverage({ patches, values, projectors, depthAt, resW = 1920, step = STEP }) {
  const t0 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  const types = { floor: [0, 0], wall: [0, 0], ceiling: [0, 0] }; // [covered, total]
  const byCount = [0, 0, 0, 0];
  const perPatch = {};
  const pxm = { floor: [], wall: [], ceiling: [] };
  let total = 0;
  let covered = 0;
  const occlusion = values?.['proj.occlusion'] !== false && !!depthAt;
  // flatten projector data for the inner loop
  const PJ = projectors.map((P) => ({
    i: P.index,
    px: P.pos[0], py: P.pos[1], pz: P.pos[2],
    fx: P.f[0], fy: P.f[1], fz: P.f[2],
    rx: P.right[0], ry: P.right[1], rz: P.right[2],
    ux: P.up[0], uy: P.up[1], uz: P.up[2],
    th: Math.tan(P.hfov / 2), tv: Math.tan(P.vfov / 2),
    t: P.throw,
    pxk: resW * P.throw,
  }));

  for (const p of patches) {
    const type = effectiveType(p, values);
    const masks = (p.masks || []).filter((m) => values?.[`map.mask.${m.kind}`] && m.polygon?.length >= 3);
    const [ox, oy, oz] = p.origin;
    const [ux, uy, uz] = p.u;
    const [vx, vy, vz] = p.v;
    const [nx, ny, nz] = p.normal;
    const bucket = pxm[type];
    let pc = 0;
    let pt = 0;
    for (let y = step / 2; y < p.height; y += step) {
      const iv = rowIntervals(p.polygon, y);
      if (iv.length < 2) continue;
      const miv = masks.map((m) => rowIntervals(m.polygon, y));
      for (let k = 0; k + 1 < iv.length; k += 2) {
        // first cell centre at or after the interval start, on the global grid
        let x = Math.ceil((iv[k] - step / 2) / step) * step + step / 2;
        for (; x < iv[k + 1]; x += step) {
          let masked = false;
          for (const m of miv) if (inIntervals(x, m)) masked = true;
          if (masked) continue;
          const wx = ox + ux * x + vx * y;
          const wy = oy + uy * x + vy * y;
          const wz = oz + uz * x + vz * y;
          let n = 0;
          let bestPx = 0;
          for (const P of PJ) {
            const lx = P.px - wx;
            const ly = P.py - wy;
            const lz = P.pz - wz;
            const dist = Math.sqrt(lx * lx + ly * ly + lz * lz) || 1e-6;
            const cosT = (nx * lx + ny * ly + nz * lz) / dist;
            if (cosT <= 0) continue;
            const z = -(P.fx * lx + P.fy * ly + P.fz * lz); // axial depth of the sample
            if (z <= 0.05) continue;
            const sx = -(P.rx * lx + P.ry * ly + P.rz * lz) / (z * P.th);
            const sy = -(P.ux * lx + P.uy * ly + P.uz * lz) / (z * P.tv);
            if (sx < -1 || sx > 1 || sy < -1 || sy > 1) continue;
            if (occlusion) {
              const d = depthAt(P.i, sx, sy);
              if (d != null) {
                const texel = z / (P.t * DEPTH_W);
                const tanT = Math.sqrt(Math.max(0, 1 - cosT * cosT)) / Math.max(cosT, 0.08);
                const bias = 0.012 + texel * Math.min(tanT, 12) * 1.5;
                if (z - bias > d) continue;
              }
            }
            n++;
            const ppm = (P.pxk * cosT) / dist;
            if (ppm > bestPx) bestPx = ppm;
          }
          pt++;
          if (n > 0) {
            pc++;
            if (bucket) bucket.push(bestPx);
          }
          byCount[n > 3 ? 3 : n]++;
        }
      }
    }
    perPatch[p.id] = pt ? pc / pt : 0;
    if (types[type]) {
      types[type][0] += pc;
      types[type][1] += pt;
    }
    total += pt;
    covered += pc;
  }
  const frac = ([c, t]) => (t ? c / t : 0);
  const t1 = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return {
    floor: frac(types.floor),
    wall: frac(types.wall),
    ceiling: frac(types.ceiling),
    total: total ? covered / total : 0,
    perPatch,
    byCount: byCount.map((c) => (total ? c / total : 0)),
    // extras (backwards-compatible additions)
    pxPerM: { floor: median(pxm.floor), wall: median(pxm.wall), ceiling: median(pxm.ceiling) },
    area: {
      floor: types.floor[1] * step * step,
      wall: types.wall[1] * step * step,
      ceiling: types.ceiling[1] * step * step,
    },
    occlusion,
    samples: total,
    ms: Math.round((t1 - t0) * 10) / 10,
  };
}
