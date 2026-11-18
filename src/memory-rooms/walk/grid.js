/* Where you can walk in a room: a 2D grid built from the baked GLB itself when it
   loads, so every room shape works without anyone drawing a nav mesh (the octagon
   shed's angled walls, the gable warehouse, round a car on its ground plate).

     const grid = buildGrid(root, { bounds, start });   // root: the GLB scene, in room metres
     grid.walkable(x, z)                                // can the walker's centre be here?
     slide(grid, from, dx, dz) → { x, z }               // move, sliding along whatever is in the way
     findPath(grid, from, to) → [{ x, z }…] | null      // tap-to-walk: A*, then straightened

   How: every triangle with any part between 0.15 m and 1.7 m above the floor (knee
   to head height) blocks the 5 cm cells under it: the part of the triangle inside
   that band is clipped out, its outline is traced cell by cell (so a thin wall
   still blocks) and its inside filled (a table top, a bed). So rugs, the floor and
   the ceiling never block; walls, furniture and a car body do. Cells closer than
   the walker's radius to a blocked one are out too, and only the cells you can
   actually reach from the start count (the corners outside an octagon's walls are
   inside its bounding box, but walled off). Interiors are also cut to their shell's
   box; exteriors to their ground plate. */

import * as THREE from 'three';

export const CELL = 0.05;
export const BAND = [0.15, 1.7];
export const RADIUS = 0.2;

const _v = new THREE.Vector3();

/** Clip a polygon ([x, y, z]…) to lo <= y <= hi. */
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

export function buildGrid(root, { bounds, start }) {
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

  // a segment's cells (a supercover-ish walk at quarter-cell steps)
  const line = (ax, az, bx, bz) => {
    const n = Math.max(1, Math.ceil((Math.hypot(bx - ax, bz - az) / CELL) * 4));
    for (let k = 0; k <= n; k++) {
      const t = k / n;
      mark(cx(ax + (bx - ax) * t), cz(az + (bz - az) * t));
    }
  };
  // a convex polygon's inside: test the centres of the cells under its box
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
    // orientation of the polygon in xz
    let area = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[k];
      const b = pts[(k + 1) % pts.length];
      area += a[0] * b[2] - b[0] * a[2];
    }
    if (Math.abs(area) < 1e-6) return; // edge-on (a wall): the outline already has it
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
    if (!o.isMesh || !o.geometry?.attributes?.position) return;
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
      if ((ya < BAND[0] && yb < BAND[0] && yc < BAND[0]) || (ya > BAND[1] && yb > BAND[1] && yc > BAND[1])) continue;
      const poly = clipBand([v(a), v(b), v(c)], BAND[0], BAND[1]);
      if (poly.length < 2) continue;
      for (let k = 0; k < poly.length; k++) {
        const p = poly[k];
        const q = poly[(k + 1) % poly.length];
        line(p[0], p[2], q[0], q[2]);
      }
      if (poly.length >= 3) fill(poly);
    }
  });

  // distance (in cells, chamfer 3-4) to the nearest blocked cell or the edge
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
  const clearCells = (RADIUS / CELL) * 3; // chamfer units
  const open = new Uint8Array(nx * nz);
  for (let k = 0; k < open.length; k++) open[k] = d[k] > clearCells ? 1 : 0;

  // keep the region reachable from the start (or, if the start is walled in, the biggest)
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
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = jj * nx + ii;
        if (open[kk] && comp[kk] < 0) {
          comp[kk] = id;
          queue[tail++] = kk;
        }
      }
    }
    sizes.push(tail);
  }
  let keep = -1;
  const near = nearestOpen(open, nx, nz, cx(start.x), cz(start.z));
  if (near >= 0 && sizes[comp[near]] * CELL * CELL >= 1.5) keep = comp[near];
  if (keep < 0) keep = sizes.indexOf(Math.max(...sizes, 0));
  const walk = new Uint8Array(nx * nz);
  for (let k = 0; k < walk.length; k++) walk[k] = comp[k] === keep && keep >= 0 ? 1 : 0;

  const grid = {
    nx,
    nz,
    x0,
    z0,
    cell: CELL,
    walk,
    blocked,
    cellOf: (x, z) => [cx(x), cz(z)],
    centreOf: (i, j) => ({ x: x0 + (i + 0.5) * CELL, z: z0 + (j + 0.5) * CELL }),
    walkable(x, z) {
      const i = cx(x);
      const j = cz(z);
      return i >= 0 && j >= 0 && i < nx && j < nz && walk[j * nx + i] === 1;
    },
    area: (sizes[keep] || 0) * CELL * CELL,
  };
  const s = nearestOpen(walk, nx, nz, cx(start.x), cz(start.z));
  grid.start = s >= 0 ? grid.centreOf(s % nx, Math.floor(s / nx)) : { x: start.x, z: start.z };
  return grid;
}

/** The open cell nearest (i, j), by rings: its index, or -1. */
function nearestOpen(open, nx, nz, i, j) {
  const inside = (a, b) => a >= 0 && b >= 0 && a < nx && b < nz;
  if (inside(i, j) && open[j * nx + i]) return j * nx + i;
  const max = Math.max(nx, nz);
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

/** The walkable spot nearest (x, z). */
export function nearestWalkable(grid, x, z) {
  const [i, j] = grid.cellOf(x, z);
  const k = nearestOpen(grid.walk, grid.nx, grid.nz, i, j);
  return k >= 0 ? grid.centreOf(k % grid.nx, Math.floor(k / grid.nx)) : { x, z };
}

/**
 * Move from `from` by (dx, dz), in small steps, sliding along whatever blocks the way: each
 * step tries the full move, then just its x part, then just its z part.
 */
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
function clearLine(grid, a, b) {
  const n = Math.max(1, Math.ceil((Math.hypot(b.x - a.x, b.z - a.z) / CELL) * 2));
  for (let k = 0; k <= n; k++) {
    const t = k / n;
    if (!grid.walkable(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t)) return false;
  }
  return true;
}

/** A* over the walkable cells (8 neighbours, no corner cutting), straightened. → points or null. */
export function findPath(grid, from, to) {
  const { nx, nz, walk } = grid;
  const goal = nearestWalkable(grid, to.x, to.z);
  const [si, sj] = grid.cellOf(from.x, from.z);
  const [gi, gj] = grid.cellOf(goal.x, goal.z);
  if (si < 0 || sj < 0 || si >= nx || sj >= nz || !walk[sj * nx + si]) return null;
  const startK = sj * nx + si;
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
  // binary heap of [f, k]
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
  const NB = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, Math.SQRT2],
    [1, -1, Math.SQRT2],
    [-1, 1, Math.SQRT2],
    [-1, -1, Math.SQRT2],
  ];
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
      if (di && dj && (!walk[j * nx + ii] || !walk[jj * nx + i])) continue; // no corner cutting
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
  // straighten: from each kept point, jump to the farthest one in plain sight
  const out = [pts[0]];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !clearLine(grid, pts[a], pts[b])) b--;
    out.push(pts[b]);
    a = b;
  }
  return out;
}
