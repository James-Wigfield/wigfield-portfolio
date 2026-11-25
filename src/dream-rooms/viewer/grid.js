/* Dream Rooms · where you can walk in a module. Ported from Memory Rooms'
   src/memory-rooms/walk/grid.js (copied and extended, never imported):

     const grid = buildGrid(root, { bounds, starts, allow?, wrap? })
     grid.walkable(x, z)                    can the walker's centre be here?
     slide(grid, from, dx, dz) → { x, z }   move, sliding along whatever is in the way
     findPath(grid, from, to) → [{ x, z }…] | null    A*, then straightened
     nearestWalkable(grid, x, z)

   How (as in Memory Rooms): every triangle with any part between 0.15 m and 1.7 m above
   the floor blocks the 5 cm cells under it (its band slice is traced and filled), cells
   closer than the walker's radius to a blocked one are out, and only what's reachable
   counts. Dream Rooms additions:
     · `starts`: several flood-fill seeds (the spawn and every doorway, stubs included);
       the kept region is the union of the components reachable from any of them;
     · `allow(x, z)`: an extra filter applied before the flood fill (a pool's edge-only band);
     · `wrap: { z0, d }`: a repeating module. The grid is built over three copies
       (z0 − d … z0 + 2d) and every lookup wraps z into the middle copy. */

import * as THREE from 'three';

export const CELL = 0.05;
export const BAND = [0.15, 1.7];
export const RADIUS = 0.2;

const _v = new THREE.Vector3();

function clipBand(poly, lo, hi) {
  const cut = (pts, keep, edge) => {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const ina = keep(a[1]);
      const inb = keep(b[1]);
      if (ina) out.push(a);
      if (ina !== inb) {
        const t = (edge - a[1]) / (b[1] - a[1]);
        out.push([a[0] + (b[0] - a[0]) * t, edge, a[2] + (b[2] - a[2]) * t]);
      }
    }
    return out;
  };
  let p = cut(poly, (y) => y >= lo, lo);
  if (p.length) p = cut(p, (y) => y <= hi, hi);
  return p;
}

/**
 * root: an Object3D whose meshes (world matrices) are the module's solid geometry.
 * bounds: { min: {x, z}, max: {x, z} } in world metres.
 */
export function buildGrid(root, { bounds, starts = [], floor = 0, allow = null, wrap = null, skip = null }) {
  const lo = floor + BAND[0];
  const hi = floor + BAND[1];
  const x0 = bounds.min.x;
  const z0 = bounds.min.z;
  const nx = Math.max(1, Math.ceil((bounds.max.x - x0) / CELL));
  const nz = Math.max(1, Math.ceil((bounds.max.z - z0) / CELL));
  const blocked = new Uint8Array(nx * nz);
  const cx = (x) => Math.floor((x - x0) / CELL);
  const cz = (z) => Math.floor((z - z0) / CELL);
  const mark = (i, j) => {
    if (i >= 0 && j >= 0 && i < nx && j < nz) blocked[j * nx + i] = 1;
  };
  const line = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil((Math.hypot(bx - ax, bz - az) / CELL) * 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      mark(cx(ax + (bx - ax) * t), cz(az + (bz - az) * t));
    }
  };
  const fill = (pts) => {
    let minx = Infinity;
    let maxx = -Infinity;
    let minz = Infinity;
    let maxz = -Infinity;
    for (const p of pts) {
      minx = Math.min(minx, p[0]);
      maxx = Math.max(maxx, p[0]);
      minz = Math.min(minz, p[2]);
      maxz = Math.max(maxz, p[2]);
    }
    const i0 = Math.max(0, cx(minx));
    const i1 = Math.min(nx - 1, cx(maxx));
    const j0 = Math.max(0, cz(minz));
    const j1 = Math.min(nz - 1, cz(maxz));
    if (i1 - i0 < 1 && j1 - j0 < 1) return;
    let area = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      area += a[0] * b[2] - b[0] * a[2];
    }
    if (Math.abs(area) < 1e-6) return;
    const sign = Math.sign(area);
    for (let j = j0; j <= j1; j++) {
      const z = z0 + (j + 0.5) * CELL;
      for (let i = i0; i <= i1; i++) {
        const x = x0 + (i + 0.5) * CELL;
        let inside = true;
        for (let k = 0; k < pts.length && inside; k++) {
          const a = pts[k];
          const b = pts[(k + 1) % pts.length];
          if (sign * ((b[0] - a[0]) * (z - a[2]) - (b[2] - a[2]) * (x - a[0])) < 0) inside = false;
        }
        if (inside) blocked[j * nx + i] = 1;
      }
    }
  };

  root.updateMatrixWorld(true);
  root.traverse((o) => {
    if (!o.isMesh || !o.geometry?.attributes?.position || o.userData.noCollide) return;
    if (skip && skip(o)) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const m = o.matrixWorld;
    const world = new Float32Array(pos.count * 3);
    for (let k = 0; k < pos.count; k++) {
      _v.fromBufferAttribute(pos, k).applyMatrix4(m);
      world[k * 3] = _v.x;
      world[k * 3 + 1] = _v.y;
      world[k * 3 + 2] = _v.z;
    }
    const tris = idx ? idx.count / 3 : pos.count / 3;
    const v = (k) => [world[k * 3], world[k * 3 + 1], world[k * 3 + 2]];
    for (let t = 0; t < tris; t++) {
      const a = idx ? idx.getX(t * 3) : t * 3;
      const b = idx ? idx.getX(t * 3 + 1) : t * 3 + 1;
      const c = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
      const ya = world[a * 3 + 1];
      const yb = world[b * 3 + 1];
      const yc = world[c * 3 + 1];
      if ((ya < lo && yb < lo && yc < lo) || (ya > hi && yb > hi && yc > hi)) continue;
      const poly = clipBand([v(a), v(b), v(c)], lo, hi);
      if (poly.length < 2) continue;
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k];
        const q = poly[(k + 1) % poly.length];
        line(p[0], p[2], q[0], q[2]);
      }
      if (poly.length >= 3) fill(poly);
    }
  });

  // distance (chamfer 3-4) to the nearest blocked cell or the edge
  const INF = 1e9;
  const d = new Float32Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const edge = i === 0 || j === 0 || i === nx - 1 || j === nz - 1;
      d[j * nx + i] = blocked[j * nx + i] || edge ? 0 : INF;
    }
  }
  for (let j = 1; j < nz; j++) {
    for (let i = 1; i < nx - 1; i++) {
      const k = j * nx + i;
      d[k] = Math.min(d[k], d[k - 1] + 3, d[k - nx] + 3, d[k - nx - 1] + 4, d[k - nx + 1] + 4);
    }
  }
  for (let j = nz - 2; j >= 0; j--) {
    for (let i = nx - 2; i > 0; i--) {
      const k = j * nx + i;
      d[k] = Math.min(d[k], d[k + 1] + 3, d[k + nx] + 3, d[k + nx + 1] + 4, d[k + nx - 1] + 4);
    }
  }
  const clearCells = (RADIUS / CELL) * 3;
  const open = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      const k = j * nx + i;
      if (d[k] <= clearCells) continue;
      if (allow && !allow(x0 + (i + 0.5) * CELL, z0 + (j + 0.5) * CELL)) continue;
      open[k] = 1;
    }
  }

  // components
  const comp = new Int32Array(nx * nz).fill(-1);
  const sizes = [];
  const queue = new Int32Array(nx * nz);
  for (let k0 = 0; k0 < open.length; k0++) {
    if (!open[k0] || comp[k0] >= 0) continue;
    const id = sizes.length;
    let head = 0;
    let tail = 0;
    queue[tail++] = k0;
    comp[k0] = id;
    while (head < tail) {
      const k = queue[head++];
      const i = k % nx;
      const j = (k - i) / nx;
      if (i + 1 < nx && open[k + 1] && comp[k + 1] < 0) { comp[k + 1] = id; queue[tail++] = k + 1; }
      if (i > 0 && open[k - 1] && comp[k - 1] < 0) { comp[k - 1] = id; queue[tail++] = k - 1; }
      if (j + 1 < nz && open[k + nx] && comp[k + nx] < 0) { comp[k + nx] = id; queue[tail++] = k + nx; }
      if (j > 0 && open[k - nx] && comp[k - nx] < 0) { comp[k - nx] = id; queue[tail++] = k - nx; }
    }
    sizes.push(tail);
  }
  // keep the union of the components any start reaches (a seed inside a wall snaps to the nearest open cell)
  const keep = new Set();
  for (const s of starts) {
    const near = nearestOpen(open, nx, nz, cx(s.x), cz(s.z), 30);
    if (near >= 0) keep.add(comp[near]);
  }
  if (!keep.size && sizes.length) keep.add(sizes.indexOf(Math.max(...sizes)));
  const walk = new Uint8Array(nx * nz);
  let area = 0;
  for (let k = 0; k < walk.length; k++) {
    if (comp[k] >= 0 && keep.has(comp[k])) {
      walk[k] = 1;
      area += 1;
    }
  }

  // a repeating module: look up every z in the middle copy
  const wz = wrap ? (z) => wrap.z0 + ((((z - wrap.z0) % wrap.d) + wrap.d) % wrap.d) : (z) => z;
  const grid = {
    nx,
    nz,
    x0,
    z0,
    cell: CELL,
    walk,
    wrap,
    wz,
    cellOf: (x, z) => [cx(x), cz(z)],
    centreOf: (i, j) => ({ x: x0 + (i + 0.5) * CELL, z: z0 + (j + 0.5) * CELL }),
    walkable(x, z) {
      const i = cx(x);
      const j = cz(wz(z));
      return i >= 0 && j >= 0 && i < nx && j < nz && walk[j * nx + i] === 1;
    },
    rawWalkable(x, z) {
      const i = cx(x);
      const j = cz(z);
      return i >= 0 && j >= 0 && i < nx && j < nz && walk[j * nx + i] === 1;
    },
    area: area * CELL * CELL,
  };
  return grid;
}

function nearestOpen(open, nx, nz, i, j, maxR = Infinity) {
  const inside = (a, b) => a >= 0 && b >= 0 && a < nx && b < nz;
  if (inside(i, j) && open[j * nx + i]) return j * nx + i;
  const max = Math.min(maxR, Math.max(nx, nz));
  for (let r = 1; r < max; r++) {
    let best = -1;
    let bd = Infinity;
    for (let a = -r; a <= r; a++) {
      for (const [ii, jj] of [[i + a, j - r], [i + a, j + r], [i - r, j + a], [i + r, j + a]]) {
        if (!inside(ii, jj) || !open[jj * nx + ii]) continue;
        const dd = (ii - i) ** 2 + (jj - j) ** 2;
        if (dd < bd) {
          bd = dd;
          best = jj * nx + ii;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** The walkable spot nearest (x, z) (in the grid's own, unwrapped frame). */
export function nearestWalkable(grid, x, z) {
  const [i, j] = grid.cellOf(x, grid.wz(z));
  const k = nearestOpen(grid.walk, grid.nx, grid.nz, i, j);
  if (k < 0) return { x, z };
  const c = grid.centreOf(k % grid.nx, Math.floor(k / grid.nx));
  return { x: c.x, z: c.z + (z - grid.wz(z)) };
}

/** Move by (dx, dz) in small steps, sliding along whatever blocks the way. */
export function slide(grid, from, dx, dz) {
  let { x, z } = from;
  const len = Math.hypot(dx, dz);
  const steps = Math.max(1, Math.ceil(len / (CELL * 0.5)));
  const sx = dx / steps;
  const sz = dz / steps;
  for (let k = 0; k < steps; k++) {
    if (grid.walkable(x + sx, z + sz)) {
      x += sx;
      z += sz;
    } else if (sx && grid.walkable(x + sx, z)) x += sx;
    else if (sz && grid.walkable(x, z + sz)) z += sz;
    else break;
  }
  return { x, z };
}

/** True when the straight line a → b stays on walkable cells. */
export function clearLine(grid, a, b) {
  const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / CELL) * 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (!grid.walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

/** How far (m, up to max) you can go from p along heading (hx, hz) before the walk area ends. */
export function freeRun(grid, p, hx, hz, max = 4) {
  const step = CELL * 2;
  for (let s = step; s <= max; s += step) {
    if (!grid.walkable(p.x + hx * s, p.z + hz * s)) return s - step;
  }
  return max;
}

/** A* over the walkable cells (8 neighbours, no corner cutting), straightened. Unwrapped frame. */
export function findPath(grid, from, to) {
  const { nx, nz, walk } = grid;
  const goal = nearestWalkable(grid, to.x, to.z);
  const [si, sj] = grid.cellOf(from.x, from.z);
  const [gi, gj] = grid.cellOf(goal.x, goal.z);
  if (si < 0 || sj < 0 || si >= nx || sj >= nz) return null;
  let startK = sj * nx + si;
  if (!walk[startK]) {
    const k = nearestOpen(walk, nx, nz, si, sj, 12);
    if (k < 0) return null;
    startK = k;
  }
  if (gi < 0 || gj < 0 || gi >= nx || gj >= nz) return null;
  const goalK = gj * nx + gi;
  const g = new Float32Array(nx * nz).fill(Infinity);
  const came = new Int32Array(nx * nz).fill(-1);
  const closed = new Uint8Array(nx * nz);
  const h = (k) => {
    const i = k % nx;
    const j = (k - i) / nx;
    const ddx = Math.abs(i - gi);
    const ddz = Math.abs(j - gj);
    return Math.max(ddx, ddz) + (Math.SQRT2 - 1) * Math.min(ddx, ddz);
  };
  const heap = [];
  const push = (f, k) => {
    heap.push([f, k]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p][0] <= heap[c][0]) break;
      [heap[p], heap[c]] = [heap[c], heap[p]];
      c = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const end = heap.pop();
    if (heap.length) {
      heap[0] = end;
      let c = 0;
      for (;;) {
        const l = c * 2 + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c], heap[m]];
        c = m;
      }
    }
    return top;
  };
  g[startK] = 0;
  push(h(startK), startK);
  const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2]];
  let found = false;
  while (heap.length) {
    const [, k] = pop();
    if (closed[k]) continue;
    if (k === goalK) {
      found = true;
      break;
    }
    closed[k] = 1;
    const i = k % nx;
    const j = (k - i) / nx;
    for (const [di, dj, cost] of NB) {
      const ii = i + di;
      const jj = j + dj;
      if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
      const kk = jj * nx + ii;
      if (!walk[kk] || closed[kk]) continue;
      if (di && dj && (!walk[j * nx + ii] || !walk[jj * nx + i])) continue;
      const ng = g[k] + cost;
      if (ng < g[kk]) {
        g[kk] = ng;
        came[kk] = k;
        push(ng + h(kk), kk);
      }
    }
  }
  if (!found) return null;
  const cells = [];
  for (let k = goalK; k >= 0; k = came[k]) cells.push(k);
  cells.reverse();
  const pts = cells.map((k) => grid.centreOf(k % nx, Math.floor(k / nx)));
  pts[0] = { x: from.x, z: from.z };
  const raw = { walkable: grid.rawWalkable };
  const out = [pts[0]];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !clearLine(raw, pts[a], pts[b])) b--;
    out.push(pts[b]);
    a = b;
  }
  return out;
}
