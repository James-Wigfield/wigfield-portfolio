/* ============================================================================
   PROJECTOR LIFE — the life DOMAIN: one cell grid over every patch
   ----------------------------------------------------------------------------
   Every patch gets a w × h grid at one shared ppm (CONTRACTS.md §2 texture
   convention: row j covers local y ∈ [j/ppm, (j+1)/ppm)). All grids are laid
   end to end in ONE global index space (patch.off + j·w + i), so every field
   (Gray-Scott u/v, Physarum trail, Lenia A) is a single Float32Array and a
   neighbour across a seam is just another index.

   Cell state: 0 = outside the polygon, 1 = inside but under an active mask
   (black, a wall for agents), 2 = live.

   nb (Int32Array 4N): the 4-neighbours E(+x) W(−x) N(+y) S(−y) of every live
   cell. Inside the patch they are the obvious cells; across an edge with a
   seam (and seams on) they are the cell the unfolding isometry seam.M lands
   on (equal ppm on both sides, so edges line up to within a cell); at a mask,
   a seamless edge, or with seams off they point back at the cell itself
   (zero-flux boundary).

   halo(pi, pad): a padded lookup table for agents and wide kernels — for any
   cell within `pad` cells of the patch box it gives the global index of the
   live cell that position maps to (through up to 3 seams), or −1 (wall).
   ========================================================================== */

import { mapAngle, mapPoint, pointInPolygon } from './lib/geom.js';

/** Patch kinds, for crossing statistics (index = kindIdx). */
export const KINDS = ['wall', 'roof', 'floor', 'loft', 'other'];

const DIRS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

/** Fill `state` (w×h) with 2 where the cell centre is inside `poly` (scanline). */
function rasterise(poly, w, h, ppm, state, value, onlyIf = -1) {
  const n = poly.length;
  const xs = [];
  for (let j = 0; j < h; j++) {
    const y = (j + 0.5) / ppm;
    xs.length = 0;
    for (let a = 0, b = n - 1; a < n; b = a++) {
      const ya = poly[a][1], yb = poly[b][1];
      if (ya > y !== yb > y) {
        const xa = poly[a][0], xb = poly[b][0];
        xs.push(xa + ((y - ya) * (xb - xa)) / (yb - ya));
      }
    }
    if (xs.length < 2) continue;
    xs.sort((p, q) => p - q);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      // cell i is inside when its centre (i + .5)/ppm lies in [x0, x1)
      const i0 = Math.max(0, Math.ceil(xs[k] * ppm - 0.5));
      const i1 = Math.min(w - 1, Math.ceil(xs[k + 1] * ppm - 0.5) - 1);
      const row = j * w;
      for (let i = i0; i <= i1; i++) {
        if (onlyIf < 0 || state[row + i] === onlyIf) state[row + i] = value;
      }
    }
  }
}

/**
 * @param patches  Patch[] (CONTRACTS.md §2)
 * @param opts     { ppm, maskOn(kind) → bool, seams: bool }
 */
export function buildDomain(patches, { ppm = 40, maskOn = () => true, seams = true } = {}) {
  const P = [];
  let N = 0;
  const byId = new Map();
  patches.forEach((patch, idx) => byId.set(patch.id, idx));

  const walls = patches.filter((p) => p.kind === 'wall');

  for (let idx = 0; idx < patches.length; idx++) {
    const patch = patches[idx];
    const w = Math.max(1, Math.ceil(patch.width * ppm - 1e-6));
    const h = Math.max(1, Math.ceil(patch.height * ppm - 1e-6));
    const state = new Uint8Array(w * h);
    rasterise(patch.polygon, w, h, ppm, state, 2);
    for (const m of patch.masks || []) {
      if (!m || !m.polygon || m.polygon.length < 3 || !maskOn(m.kind)) continue;
      rasterise(m.polygon, w, h, ppm, state, 1, 2);
    }
    const poly = patch.polygon;
    const edges = [];
    for (let e = 0; e < poly.length; e++) {
      const a = poly[e];
      const b = poly[(e + 1) % poly.length];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy) || 1;
      // CCW polygon: outward normal of edge (dx, dy) is (dy, −dx)
      const seam = (patch.seams || []).find((s) => s.edge === e);
      edges.push({
        e,
        ax: a[0], ay: a[1], bx: b[0], by: b[1],
        tx: dx / len, ty: dy / len,
        nx: dy / len, ny: -dx / len,
        len,
        seam: seam && byId.has(seam.to) ? { q: byId.get(seam.to), M: seam.M, angle: mapAngle(seam.M) } : null,
        free: false,
      });
    }
    // Loft-style patches (no seams): an edge is FREE (walk off it and you
    // fall) unless it runs along a wall.
    if (patch.noSeams || patch.kind === 'loft') {
      for (const ed of edges) {
        const mx = (ed.ax + ed.bx) / 2, my = (ed.ay + ed.by) / 2;
        const o = patch.origin, u = patch.u, v = patch.v;
        const wp = [o[0] + u[0] * mx + v[0] * my, o[1] + u[1] * mx + v[1] * my, o[2] + u[2] * mx + v[2] * my];
        let against = false;
        for (const wl of walls) {
          const d = (wp[0] - wl.origin[0]) * wl.normal[0] + (wp[2] - wl.origin[2]) * wl.normal[2];
          if (d < 0.1) against = true;
        }
        ed.free = !against;
      }
    }
    const gt = patch.gravity?.gt || [0, 0];
    const gn = patch.gravity?.gn ?? 0;
    const validList = [];
    for (let k = 0; k < w * h; k++) if (state[k] === 2) validList.push(N + k);
    P.push({
      idx,
      id: patch.id,
      patch,
      kind: patch.kind,
      kindIdx: KINDS.indexOf(patch.kind) < 0 ? KINDS.length - 1 : KINDS.indexOf(patch.kind),
      typeAuto: patch.typeAuto,
      w,
      h,
      off: N,
      state,
      edges,
      gt,
      gn,
      gMag: Math.hypot(gt[0], gt[1]),
      gAng: Math.atan2(gt[1], gt[0]),
      area: patch.area,
      valid: Int32Array.from(validList),
      halos: new Map(),
    });
    N += w * h;
  }

  const cellPatch = new Uint8Array(N);
  const cellState = new Uint8Array(N);
  for (const p of P) {
    cellPatch.fill(p.idx, p.off, p.off + p.w * p.h);
    cellState.set(p.state, p.off);
  }

  const D = { ppm, seams, P, N, byId, cellPatch, cellState, patches };

  /** Global index of the live cell at local metres (x, y) on patch pi, else −1. */
  D.locate = (pi, x, y) => {
    const p = P[pi];
    const i = Math.floor(x * ppm), j = Math.floor(y * ppm);
    if (i < 0 || j < 0 || i >= p.w || j >= p.h) return -1;
    const k = j * p.w + i;
    return p.state[k] === 2 ? p.off + k : -1;
  };

  /** State of the cell at local metres: 0 outside, 1 masked, 2 live. */
  D.stateAt = (pi, x, y) => {
    const p = P[pi];
    const i = Math.floor(x * ppm), j = Math.floor(y * ppm);
    if (i < 0 || j < 0 || i >= p.w || j >= p.h) return 0;
    return p.state[j * p.w + i];
  };

  /** Edge of patch pi that a point outside it has crossed (max outward distance). */
  D.edgeOut = (pi, x, y) => {
    let best = null, bs = -Infinity;
    for (const ed of P[pi].edges) {
      const s = (x - ed.ax) * ed.nx + (y - ed.ay) * ed.ny;
      if (s > bs) {
        bs = s;
        best = ed;
      }
    }
    return best;
  };

  /**
   * A point outside patch pi's polygon → where it lands across the seams
   * (up to 3 hops, for corners). Writes { q, x, y, angle, edge } into `out`
   * and returns true; false at a boundary (no seam, or seams off).
   */
  D.cross = (pi, x, y, out, allowSeams = seams) => {
    let cur = pi, px = x, py = y, ang = 0, first = null;
    for (let hop = 0; hop < 3; hop++) {
      const ed = D.edgeOut(cur, px, py);
      if (!first) first = ed;
      if (!ed || !ed.seam || !allowSeams) return false;
      const m = mapPoint(ed.seam.M, px, py);
      px = m[0];
      py = m[1];
      ang += ed.seam.angle;
      cur = ed.seam.q;
      if (pointInPolygon(px, py, P[cur].patch.polygon)) {
        out.q = cur;
        out.x = px;
        out.y = py;
        out.angle = ang;
        out.edge = first;
        return true;
      }
    }
    return false;
  };

  // ── 4-neighbour table (system-agnostic; the systems treat cells they do not
  // own as fixed boundary values) ─────────────────────────────────────────────
  const nb = new Int32Array(4 * N);
  const tmp = { q: 0, x: 0, y: 0, angle: 0, edge: null };
  for (const p of P) {
    const { w, h, off, state } = p;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w; i++) {
        const k = j * w + i;
        const g = off + k;
        if (state[k] !== 2) {
          nb[4 * g] = nb[4 * g + 1] = nb[4 * g + 2] = nb[4 * g + 3] = g;
          continue;
        }
        for (let d = 0; d < 4; d++) {
          const ii = i + DIRS[d][0], jj = j + DIRS[d][1];
          let r = g;
          if (ii >= 0 && jj >= 0 && ii < w && jj < h) {
            const s = state[jj * w + ii];
            if (s === 2) r = off + jj * w + ii;
            else if (s === 0 && D.cross(p.idx, (ii + 0.5) / ppm, (jj + 0.5) / ppm, tmp)) {
              const gg = D.locate(tmp.q, tmp.x, tmp.y);
              if (gg >= 0) r = gg;
            }
          } else if (D.cross(p.idx, (ii + 0.5) / ppm, (jj + 0.5) / ppm, tmp)) {
            const gg = D.locate(tmp.q, tmp.x, tmp.y);
            if (gg >= 0) r = gg;
          }
          nb[4 * g + d] = r;
        }
      }
    }
  }
  D.nb = nb;

  /**
   * The neighbour table restricted to the patches a system owns: a neighbour
   * on a patch outside `ownedMask` becomes the cell itself (zero-flux), so a
   * seam to a patch running another system is a wall, not a sink.
   */
  D.nbFor = (ownedMask) => {
    const out = new Int32Array(nb);
    for (const p of P) {
      if (!ownedMask[p.idx]) continue;
      for (const g of p.valid) {
        for (let d = 0; d < 4; d++) {
          const r = out[4 * g + d];
          if (!ownedMask[cellPatch[r]]) out[4 * g + d] = g;
        }
      }
    }
    return out;
  };

  /**
   * Padded lookup for patch pi: Int32Array((w+2pad)·(h+2pad)) of global live
   * cell indices (−1 = wall/mask/void). Built lazily, cached per pad.
   */
  D.halo = (pi, pad) => {
    const p = P[pi];
    if (p.halos.has(pad)) return p.halos.get(pad);
    const HW = p.w + 2 * pad, HH = p.h + 2 * pad;
    const idx = new Int32Array(HW * HH).fill(-1);
    for (let jj = 0; jj < HH; jj++) {
      const j = jj - pad;
      for (let ii = 0; ii < HW; ii++) {
        const i = ii - pad;
        let r = -1;
        if (i >= 0 && j >= 0 && i < p.w && j < p.h) {
          const s = p.state[j * p.w + i];
          if (s === 2) r = p.off + j * p.w + i;
          else if (s === 0 && D.cross(pi, (i + 0.5) / ppm, (j + 0.5) / ppm, tmp)) r = D.locate(tmp.q, tmp.x, tmp.y);
        } else if (D.cross(pi, (i + 0.5) / ppm, (j + 0.5) / ppm, tmp)) {
          r = D.locate(tmp.q, tmp.x, tmp.y);
        }
        idx[jj * HW + ii] = r;
      }
    }
    const H = { pad, HW, HH, idx };
    p.halos.set(pad, H);
    return H;
  };

  /** A uniformly random live point on patch pi (local metres) or null. */
  D.randomPoint = (pi, rng) => {
    const p = P[pi];
    if (!p.valid.length) return null;
    const g = p.valid[(rng() * p.valid.length) | 0] - p.off;
    const j = (g / p.w) | 0;
    const i = g - j * p.w;
    return [(i + rng()) / ppm, (j + rng()) / ppm];
  };

  /** Nearest live point to (x, y) on patch pi within maxR metres, or null. */
  D.nearestLive = (pi, x, y, maxR = 1) => {
    const p = P[pi];
    const ci = Math.floor(x * ppm), cj = Math.floor(y * ppm);
    const R = Math.ceil(maxR * ppm);
    for (let r = 0; r <= R; r++) {
      let best = null, bd = Infinity;
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const i = ci + di, j = cj + dj;
          if (i < 0 || j < 0 || i >= p.w || j >= p.h || p.state[j * p.w + i] !== 2) continue;
          const d = di * di + dj * dj;
          if (d < bd) {
            bd = d;
            best = [(i + 0.5) / ppm, (j + 0.5) / ppm];
          }
        }
      }
      if (best) return best;
    }
    return null;
  };

  return D;
}

/**
 * Copy a per-cell Float32 field from an old domain to a new one by local
 * position (patch ids match across rebuilds), `fill` where there is no source.
 */
export function resampleField(oldD, newD, src, dst, fill = 0) {
  dst.fill(fill);
  if (!oldD || !src) return dst;
  const r = oldD.ppm / newD.ppm;
  for (const np of newD.P) {
    const oi = oldD.byId.get(np.id);
    if (oi === undefined) continue;
    const op = oldD.P[oi];
    for (const g of np.valid) {
      const k = g - np.off;
      const j = (k / np.w) | 0;
      const i = k - j * np.w;
      const oi2 = Math.floor((i + 0.5) * r), oj2 = Math.floor((j + 0.5) * r);
      if (oi2 < 0 || oj2 < 0 || oi2 >= op.w || oj2 >= op.h) continue;
      const ok = oj2 * op.w + oi2;
      if (op.state[ok] === 2) dst[g] = src[op.off + ok];
    }
  }
  return dst;
}
