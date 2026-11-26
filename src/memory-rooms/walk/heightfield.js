/* Where you can walk on a live landscape (src/memory-rooms/landscape/): a 0.5 m grid with the same shape as
   walk/grid.js's, so slide / nearestWalkable / findPath work on it unchanged, plus the ground's height.

     const grid = buildLandGrid(land, { start: { x, z } })
     grid.walkable(x, z)   grid.heightAt(x, z)   grid.depthAt(x, z)   slide(grid, …)   findPath(grid, …)

   Blocked: the cells the data marks (data.json heights.flags: slopes over 32°, the camp school's fence, bunker
   footprints and gun pedestals, water deeper than 0.6 m), every site mesh between knee and head height above
   the ground under it (lockers, walls, railings, the replica gun), and the dense shrubs (a plant taller than
   0.8 m blocks the middle 60 % of its crown). Paths, roads and car parks are walkable even where steep (their
   steps). Then the walker's radius is kept clear and only what's reachable from the start counts, as in rooms.
   Out in the water the stop is soft: you wade to knee depth and slide along the edge. */

import * as THREE from 'three';
import { RADIUS } from './grid.js';

const CELL = 0.5;
const BAND = [0.15, 1.9];
const PLANT_H = { olearia: 1.0, scaevola: 1.0, acacia: 1.0, tall: 3.0, tussock: 0.6, dead: 0.85, rocka: 0.6, rockb: 0.75, rockc: 0.5, rockd: 0.9 };
const PLANT_R = { olearia: 0.8, scaevola: 0.8, acacia: 0.8, tall: 1.3, tussock: 0.35, dead: 0.55, rocka: 1.0, rockb: 0.9, rockc: 1.3, rockd: 0.8 };
const TYPES = ['olearia', 'scaevola', 'acacia', 'tall', 'tussock', 'dead', 'rocka', 'rockb', 'rockc', 'rockd'];

export function buildLandGrid(land, { start, box = null } = {}) {
  const f = land.field;
  const flagsDef = land.meta.heights.flags;
  // the walkable area: the detailed box (not the low-detail ring)
  const bx0 = box ? box.min[0] : f.box.min[0];
  const bx1 = box ? box.max[0] : f.box.max[0];
  const bz0 = box ? -box.max[1] : -f.box.max[1];
  const bz1 = box ? -box.min[1] : -f.box.min[1];
  const x0 = bx0;
  const z0 = bz0;
  const nx = Math.ceil((bx1 - bx0) / CELL);
  const nz = Math.ceil((bz1 - bz0) / CELL);
  const blocked = new Uint8Array(nx * nz);
  const opened = new Uint8Array(nx * nz);
  const cx = (x) => Math.floor((x - x0) / CELL);
  const cz = (z) => Math.floor((z - z0) / CELL);
  const at = (i, j) => j * nx + i;

  // 1. the data's flags (1 m), sampled at every cell centre
  const hard = flagsDef.fence | flagsDef.bunker | flagsDef.deep;
  for (let j = 0; j < nz; j++) {
    const z = z0 + (j + 0.5) * CELL;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * CELL;
      const fl = f.flagsAt(x, z);
      if (fl & hard) blocked[at(i, j)] = 2; // 2 = not even a path clears it
      else if (fl & flagsDef.slope) blocked[at(i, j)] = 1;
    }
  }
  // 2. the ways: cleared along their width (steps up a steep bank are walkable)
  const ways = land.meta.ways || {};
  const clearLine = (pts, half) => {
    for (let k = 0; k < pts.length - 1; k++) {
      const [ax, az] = pts[k];
      const [bx, bz] = pts[k + 1];
      const L = Math.hypot(bx - ax, bz - az);
      const n = Math.max(1, Math.ceil(L / (CELL * 0.5)));
      for (let s = 0; s <= n; s++) {
        const px = ax + ((bx - ax) * s) / n;
        const pz = az + ((bz - az) * s) / n;
        const r = Math.ceil(half / CELL);
        for (let dj = -r; dj <= r; dj++) {
          for (let di = -r; di <= r; di++) {
            const i = cx(px) + di;
            const j = cz(pz) + dj;
            if (i < 0 || j < 0 || i >= nx || j >= nz) continue;
            const qx = x0 + (i + 0.5) * CELL - px;
            const qz = z0 + (j + 0.5) * CELL - pz;
            if (qx * qx + qz * qz <= half * half) opened[at(i, j)] = 1;
          }
        }
      }
    }
  };
  for (const p of ways.paths || []) clearLine(p.pts, (p.width || 1.3) / 2 + 0.2);
  for (const r of ways.roads || []) clearLine(r.pts, (r.width || 6) / 2);
  for (let k = 0; k < blocked.length; k++) if (opened[k] && blocked[k] === 1) blocked[k] = 0;

  // 3. the site meshes between knee and head height above the ground under them
  const v = new THREE.Vector3();
  const tri = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const markPoint = (p) => {
    const g = f.heightAt(p.x, p.z);
    if (p.y < g + BAND[0] || p.y > g + BAND[1]) return;
    const i = cx(p.x);
    const j = cz(p.z);
    if (i >= 0 && j >= 0 && i < nx && j < nz) blocked[at(i, j)] = 2;
  };
  land.sites?.updateMatrixWorld(true);
  land.sites?.traverse((o) => {
    if (!o.isMesh) return;
    const pos = o.geometry.attributes.position;
    const idx = o.geometry.index;
    const n = idx ? idx.count / 3 : pos.count / 3;
    for (let t = 0; t < n; t++) {
      for (let c = 0; c < 3; c++) tri[c].fromBufferAttribute(pos, idx ? idx.getX(t * 3 + c) : t * 3 + c).applyMatrix4(o.matrixWorld);
      const e = Math.max(tri[0].distanceTo(tri[1]), tri[1].distanceTo(tri[2]), tri[2].distanceTo(tri[0]));
      const m = Math.max(1, Math.ceil(e / (CELL * 0.5)));
      for (let a = 0; a <= m; a++) {
        for (let b = 0; a + b <= m; b++) {
          const u = a / m;
          const w = b / m;
          v.copy(tri[0]).multiplyScalar(1 - u - w).addScaledVector(tri[1], u).addScaledVector(tri[2], w);
          markPoint(v);
        }
      }
    }
  });

  // 4. dense shrubs
  const P = land.plants;
  if (P) {
    for (let k = 0; k < P.x.length; k++) {
      const type = TYPES[P.type[k]];
      const hgt = PLANT_H[type] * P.s[k] * P.sy[k];
      if (hgt < (/^rock/.test(type) ? 0.45 : 0.8)) continue; // a boulder you can't step over, a shrub you can't push through
      const r = PLANT_R[type] * P.s[k] * 0.6;
      const i0 = cx(P.x[k] - r);
      const i1 = cx(P.x[k] + r);
      const j0 = cz(P.z[k] - r);
      const j1 = cz(P.z[k] + r);
      for (let j = Math.max(0, j0); j <= Math.min(nz - 1, j1); j++) {
        for (let i = Math.max(0, i0); i <= Math.min(nx - 1, i1); i++) {
          const qx = x0 + (i + 0.5) * CELL - P.x[k];
          const qz = z0 + (j + 0.5) * CELL - P.z[k];
          if (qx * qx + qz * qz <= r * r && !opened[at(i, j)]) blocked[at(i, j)] = Math.max(blocked[at(i, j)], 1);
        }
      }
    }
  }

  // 5. keep the walker's radius clear (one ring of cells), then what's reachable from the start
  const rad = Math.max(1, Math.round(RADIUS / CELL));
  const open = new Uint8Array(nx * nz);
  for (let j = 0; j < nz; j++) {
    for (let i = 0; i < nx; i++) {
      let ok = !blocked[at(i, j)];
      for (let dj = -rad; dj <= rad && ok; dj++) {
        for (let di = -rad; di <= rad && ok; di++) {
          if (di * di + dj * dj > rad * rad) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii < 0 || jj < 0 || ii >= nx || jj >= nz || blocked[at(ii, jj)]) ok = false;
        }
      }
      open[at(i, j)] = ok ? 1 : 0;
    }
  }
  const nearest = (i, j) => {
    for (let r = 0; r < 200; r++) {
      for (let dj = -r; dj <= r; dj++) {
        for (let di = -r; di <= r; di++) {
          if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
          const ii = i + di;
          const jj = j + dj;
          if (ii >= 0 && jj >= 0 && ii < nx && jj < nz && open[at(ii, jj)]) return at(ii, jj);
        }
      }
    }
    return -1;
  };
  const s0 = nearest(cx(start.x), cz(start.z));
  const walk = new Uint8Array(nx * nz);
  let area = 0;
  if (s0 >= 0) {
    const queue = new Int32Array(nx * nz);
    let head = 0;
    let tail = 0;
    queue[tail++] = s0;
    walk[s0] = 1;
    while (head < tail) {
      const k = queue[head++];
      const i = k % nx;
      const j = (k - i) / nx;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di;
        const jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const kk = at(ii, jj);
        if (open[kk] && !walk[kk]) {
          walk[kk] = 1;
          queue[tail++] = kk;
        }
      }
    }
    area = tail * CELL * CELL;
  }
  const centreOf = (i, j) => ({ x: x0 + (i + 0.5) * CELL, z: z0 + (j + 0.5) * CELL });
  const water = land.meta.water;
  return {
    nx,
    nz,
    x0,
    z0,
    cell: CELL,
    walk,
    blocked,
    cellOf: (x, z) => [cx(x), cz(z)],
    centreOf,
    walkable(x, z) {
      const i = cx(x);
      const j = cz(z);
      return i >= 0 && j >= 0 && i < nx && j < nz && walk[at(i, j)] === 1;
    },
    heightAt: (x, z) => f.heightAt(x, z),
    depthAt: (x, z) => Math.max(0, -f.heightAt(x, z)),
    area,
    start: s0 >= 0 ? centreOf(s0 % nx, Math.floor(s0 / nx)) : { x: start.x, z: start.z },
    water,
  };
}
