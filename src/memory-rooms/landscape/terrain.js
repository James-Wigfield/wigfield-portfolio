/* The ground of a v2 landscape, built in the browser from the heights grid (field.js): a quadtree of square
   nodes, each a 64 × 64-quad mesh, so a leaf (64 m) is 1 m per quad and every level up doubles the spacing.
   Near the camera the leaves; further out ever coarser nodes, ~50 draw calls in all. Skirts (a strip hanging
   under every edge) hide the cracks where a fine node meets a coarse one.

     const t = new Terrain(field, material, { leaf: 64, k: 1.7 });
     scene.add(t.group);
     t.update(camera);           // every frame (cheap when the camera hasn't moved a node's worth)
     t.dispose();

   Normals come from the heights over the node's own spacing (a coarse node shades like its coarse self), from
   the same grid for every node, so neighbours meet without a seam in the light. Each node keeps its geometry
   for a while after it's last drawn (a cache), so walking back and forth doesn't rebuild. */

import * as THREE from 'three';

const N = 64; // quads per node side
const VERTS = N + 1;
let sharedIndex = null;

/** One index array for every node; each geometry wraps it in its own attribute (a disposed node must not take
    the GPU buffer of the others with it). */
function indexBuffer() {
  if (sharedIndex) return new THREE.BufferAttribute(sharedIndex, 1);
  const idx = [];
  const at = (i, j) => j * VERTS + i;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = at(i, j);
      const b = at(i + 1, j);
      const c = at(i, j + 1);
      const d = at(i + 1, j + 1);
      // alternate the diagonal so long slopes don't read as stripes
      if ((i + j) & 1) idx.push(a, c, b, b, c, d);
      else idx.push(a, c, d, a, d, b);
    }
  }
  // skirts: the edge ring again, dropped; base index VERTS*VERTS, in order N, E, S, W edges of VERTS each
  const base = VERTS * VERTS;
  const edges = [
    (k) => at(k, 0), // north (z min)
    (k) => at(N, k), // east
    (k) => at(N - k, N), // south, running west
    (k) => at(0, N - k), // west, running north
  ];
  for (let e = 0; e < 4; e++) {
    for (let k = 0; k < N; k++) {
      const t0 = edges[e](k);
      const t1 = edges[e](k + 1);
      const s0 = base + e * VERTS + k;
      const s1 = base + e * VERTS + k + 1;
      idx.push(t0, t1, s0, t1, s1, s0, t0, s0, t1, t1, s0, s1); // both windings: seen from either side
    }
  }
  sharedIndex = new Uint16Array(idx);
  return new THREE.BufferAttribute(sharedIndex, 1);
}

export class Terrain {
  constructor(field, material, { leaf = 64, k = 1.7, maxCache = 260 } = {}) {
    this.field = field;
    this.material = material;
    this.leaf = leaf;
    this.k = k;
    this.maxCache = maxCache;
    this.group = new THREE.Group();
    this.group.name = 'landscape__terrain';
    const span = Math.max(field.width, field.depth);
    let size = leaf;
    while (size < span) size *= 2;
    this.rootSize = size;
    // the root is centred on the frame
    this.ox = field.x0 + field.width / 2 - size / 2;
    this.oz = field.z0 + field.depth / 2 - size / 2;
    this.nodes = new Map(); // key -> { mesh, used }
    this.frame = 0;
    this.drawn = 0;
    this._cam = new THREE.Vector3();
    this.minmax = new Map();
  }

  /** min / max height under a node (sampled coarsely, cached). */
  heightRange(x, z, size) {
    const key = `${x}|${z}|${size}`;
    let r = this.minmax.get(key);
    if (r) return r;
    const f = this.field;
    let lo = Infinity;
    let hi = -Infinity;
    const s = Math.max(1, size / 16);
    for (let zz = z; zz <= z + size; zz += s) {
      for (let xx = x; xx <= x + size; xx += s) {
        const h = f.heightAt(xx, zz);
        if (h < lo) lo = h;
        if (h > hi) hi = h;
      }
    }
    r = [lo - 1, hi + 1];
    this.minmax.set(key, r);
    return r;
  }

  overlaps(x, z, size) {
    const f = this.field;
    return x < f.x0 + f.width && x + size > f.x0 && z < f.z0 + f.depth && z + size > f.z0;
  }

  buildNode(x, z, size) {
    const f = this.field;
    const step = size / N;
    const pos = new Float32Array((VERTS * VERTS + 4 * VERTS) * 3);
    const nor = new Float32Array((VERTS * VERTS + 4 * VERTS) * 3);
    const n = [0, 0, 0];
    const xmin = f.x0;
    const xmax = f.x0 + f.width;
    const zmin = f.z0;
    const zmax = f.z0 + f.depth;
    let lo = Infinity;
    for (let j = 0; j < VERTS; j++) {
      for (let i = 0; i < VERTS; i++) {
        const vx = Math.min(xmax, Math.max(xmin, x + i * step));
        const vz = Math.min(zmax, Math.max(zmin, z + j * step));
        const vy = f.heightAt(vx, vz);
        if (vy < lo) lo = vy;
        const o = (j * VERTS + i) * 3;
        pos[o] = vx;
        pos[o + 1] = vy;
        pos[o + 2] = vz;
        f.normalAt(vx, vz, n, Math.max(f.cell, step));
        nor[o] = n[0];
        nor[o + 1] = n[1];
        nor[o + 2] = n[2];
      }
    }
    const drop = Math.max(0.6, step * 1.5);
    const edges = [(k) => [k, 0], (k) => [N, k], (k) => [N - k, N], (k) => [0, N - k]];
    let o = VERTS * VERTS * 3;
    for (let e = 0; e < 4; e++) {
      for (let k = 0; k < VERTS; k++) {
        const [i, j] = edges[e](k);
        const src = (j * VERTS + i) * 3;
        pos[o] = pos[src];
        pos[o + 1] = pos[src + 1] - drop;
        pos[o + 2] = pos[src + 2];
        nor[o] = nor[src];
        nor[o + 1] = nor[src + 1];
        nor[o + 2] = nor[src + 2];
        o += 3;
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    g.setIndex(indexBuffer());
    g.computeBoundingBox();
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, this.material);
    mesh.name = `terrain__${size}_${x}_${z}`;
    mesh.matrixAutoUpdate = false;
    mesh.userData.mrLand = 'terrain';
    return mesh;
  }

  /** Pick the nodes for this camera and show only them. */
  update(camera) {
    this.frame++;
    const cam = camera.getWorldPosition(this._cam);
    const want = [];
    const visit = (x, z, size) => {
      if (!this.overlaps(x, z, size)) return;
      const [lo, hi] = this.heightRange(x, z, size);
      const dx = Math.max(x - cam.x, 0, cam.x - (x + size));
      const dz = Math.max(z - cam.z, 0, cam.z - (z + size));
      const dy = Math.max(lo - cam.y, 0, cam.y - hi);
      const d = Math.hypot(dx, dy, dz);
      if (size > this.leaf && d < size * this.k) {
        const s = size / 2;
        visit(x, z, s);
        visit(x + s, z, s);
        visit(x, z + s, s);
        visit(x + s, z + s, s);
      } else want.push([x, z, size]);
    };
    visit(this.ox, this.oz, this.rootSize);
    const keep = new Set();
    for (const [x, z, size] of want) {
      const key = `${size}|${x}|${z}`;
      keep.add(key);
      let node = this.nodes.get(key);
      if (!node) {
        node = { mesh: this.buildNode(x, z, size), used: 0 };
        this.nodes.set(key, node);
      }
      node.used = this.frame;
      if (node.mesh.parent !== this.group) this.group.add(node.mesh);
    }
    for (const [key, node] of this.nodes) {
      if (!keep.has(key) && node.mesh.parent) this.group.remove(node.mesh);
    }
    this.drawn = want.length;
    // forget the geometry of nodes not drawn for a while
    if (this.nodes.size > this.maxCache) {
      const old = [...this.nodes.entries()].filter(([k]) => !keep.has(k)).sort((a, b) => a[1].used - b[1].used);
      for (const [k, node] of old.slice(0, this.nodes.size - this.maxCache)) {
        node.mesh.geometry.dispose();
        this.nodes.delete(k);
      }
    }
  }

  dispose() {
    for (const node of this.nodes.values()) {
      node.mesh.removeFromParent();
      node.mesh.geometry.dispose();
    }
    this.nodes.clear();
  }
}
