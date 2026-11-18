/* ============================================================================
   PROJECTOR LIFE — load the She'd GLB as unlit baked twins, split per flat
   ----------------------------------------------------------------------------
   Conventions copied (not imported) from src/memory-rooms/viewer/
   bakedMaterials.js: every material becomes an unlit MeshBasicMaterial; the
   bake is display-referred sRGB, so the map is decoded as sRGB and the
   renderer outputs sRGB with no tone mapping. Glass: 18 % opaque, no depth
   write, double-sided.

   The GLB's four axis wall nodes each own TWO flats (wall_north → N + NE,
   wall_east → E + SE, wall_south → S + SW, wall_west → W + NW). We split each
   wall mesh by triangle into its two flats (nearest of the node's own flat
   normals), so the cutaway can fade all 8 flats one by one; the old roof
   (`ceiling`) is split into 8 sectors the same way. Every split piece gets
   its own material clone (fades change opacity per piece). Positions are
   baked to world space (the wall/ceiling nodes have no transform anyway).
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SHED } from './roomModel.js';

const GLASS_OPACITY = 0.18;
const WALL_NODES = { wall_north: [0, 1], wall_east: [2, 3], wall_south: [4, 5], wall_west: [6, 7] };
const [CX, , CZ] = SHED.centre;

/** Azimuth (radians, 0 = north, clockwise) of (x, z) about the centre. */
const azimuth = (x, z) => Math.atan2(x - CX, -(z - CZ));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));

function toBasic(m, anisotropy) {
  const name = m.name || '';
  const color = m.color ? m.color.clone() : new THREE.Color(0xffffff);
  if (name.toLowerCase().startsWith('glass')) {
    return new THREE.MeshBasicMaterial({ name, color, transparent: true, opacity: GLASS_OPACITY, depthWrite: false, side: THREE.DoubleSide });
  }
  const map = m.map || null;
  if (map) {
    map.colorSpace = THREE.SRGBColorSpace; // display-referred bake: output == input
    map.anisotropy = anisotropy;
    map.needsUpdate = true;
  }
  return new THREE.MeshBasicMaterial({ name, map, color, side: m.side, transparent: m.transparent, opacity: m.opacity, depthWrite: m.depthWrite });
}

function applyTwins(root, anisotropy) {
  const twins = new Map();
  root.traverse((o) => {
    if (!o.isMesh) return;
    if (!twins.has(o.material)) twins.set(o.material, toBasic(o.material, anisotropy));
    o.material = twins.get(o.material);
  });
  const keep = new Set([...twins.values()].map((t) => t.map).filter(Boolean));
  for (const orig of twins.keys()) {
    for (const v of Object.values(orig)) if (v && v.isTexture && !keep.has(v)) v.dispose();
    orig.dispose();
  }
}

/** World-space triangle soup of a mesh: { positions: Float32Array, index: Uint32Array|null }. */
export function worldSoup(mesh) {
  mesh.updateWorldMatrix(true, false);
  const pos = mesh.geometry.attributes.position;
  const v = new THREE.Vector3();
  const out = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    out[i * 3] = v.x;
    out[i * 3 + 1] = v.y;
    out[i * 3 + 2] = v.z;
  }
  const index = mesh.geometry.index ? Uint32Array.from(mesh.geometry.index.array) : null;
  return { positions: out, index };
}

/**
 * Build one geometry per group of triangles: `classify(cx, cy, cz)` → key for
 * each triangle centroid (world). Returns Map<key, BufferGeometry> with
 * position + uv (if present), indexed, compacted.
 */
function splitGeometry(mesh, classify) {
  mesh.updateWorldMatrix(true, false);
  const g = mesh.geometry;
  const pos = g.attributes.position;
  const uv = g.attributes.uv || null;
  const n = g.index ? g.index.count : pos.count;
  const idx = (t) => (g.index ? g.index.getX(t) : t);
  const world = new Float32Array(pos.count * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
    world[i * 3] = v.x;
    world[i * 3 + 1] = v.y;
    world[i * 3 + 2] = v.z;
  }
  const buckets = new Map();
  for (let t = 0; t < n; t += 3) {
    const a = idx(t), b = idx(t + 1), c = idx(t + 2);
    const cx = (world[a * 3] + world[b * 3] + world[c * 3]) / 3;
    const cy = (world[a * 3 + 1] + world[b * 3 + 1] + world[c * 3 + 1]) / 3;
    const cz = (world[a * 3 + 2] + world[b * 3 + 2] + world[c * 3 + 2]) / 3;
    const key = classify(cx, cy, cz);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(a, b, c);
  }
  const out = new Map();
  for (const [key, tris] of buckets) {
    const remap = new Map();
    const P = [];
    const U = [];
    const I = new Uint32Array(tris.length);
    tris.forEach((src, i) => {
      let j = remap.get(src);
      if (j === undefined) {
        j = remap.size;
        remap.set(src, j);
        P.push(world[src * 3], world[src * 3 + 1], world[src * 3 + 2]);
        if (uv) U.push(uv.getX(src), uv.getY(src));
      }
      I[i] = j;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
    if (uv) geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.setIndex(new THREE.BufferAttribute(I, 1));
    geo.computeBoundingSphere();
    geo.computeBoundingBox();
    out.set(key, geo);
  }
  return out;
}

/**
 * Load and prepare the shed. Returns
 *   { scene,            // gltf.scene minus the wall nodes and `ceiling` (floor, furniture, loft stay)
 *     walls: Mesh[8],   // flat k = N, NE, … NW (world-space geometry)
 *     glass: Mesh|null, // the NE window glass (fades with wall-NE)
 *     oldRoof: Mesh[8], // old roof sector k
 *     floor: Mesh[], loft: Mesh[], furniture: [{ name, node, meshes }],
 *     atlas: Texture|null }
 */
export async function loadShed(url, renderer) {
  const gltf = await new GLTFLoader().loadAsync(url);
  const scene = gltf.scene;
  scene.name = 'pjl-shed';
  scene.updateMatrixWorld(true);
  const anisotropy = Math.min(8, renderer?.capabilities?.getMaxAnisotropy?.() || 1);
  applyTwins(scene, anisotropy);

  let atlas = null;
  scene.traverse((o) => {
    if (o.isMesh && o.material.map) atlas = o.material.map;
  });

  // ── walls: split each node's meshes into its two flats ────────────────────
  const walls = new Array(8).fill(null);
  const removed = new Set();
  let glass = null;
  for (const [name, ks] of Object.entries(WALL_NODES)) {
    const node = scene.getObjectByName(name);
    if (!node) continue;
    const meshes = [];
    node.traverse((o) => o.isMesh && meshes.push(o));
    for (const mesh of meshes) {
      const isGlass = mesh.material.transparent && mesh.material.depthWrite === false;
      const parts = splitGeometry(mesh, (x, y, z) => {
        const a = azimuth(x, z);
        return angDiff(a, (ks[0] * Math.PI) / 4) <= angDiff(a, (ks[1] * Math.PI) / 4) ? ks[0] : ks[1];
      });
      for (const [k, geo] of parts) {
        if (isGlass) {
          glass = new THREE.Mesh(geo, mesh.material.clone());
          glass.name = 'pjl-glass';
          glass.userData.flat = k;
          continue;
        }
        if (walls[k]) {
          // a second atlas primitive on the same flat (not the case in this GLB): merge by keeping both meshes
          const extra = new THREE.Mesh(geo, walls[k].material);
          extra.name = `pjl-wall-${k}-extra`;
          walls[k].add(extra);
          continue;
        }
        const m = new THREE.Mesh(geo, mesh.material.clone());
        walls[k] = m;
      }
      mesh.geometry.dispose();
      removed.add(mesh.material);
    }
    node.removeFromParent();
  }

  // ── old roof: 8 sectors by azimuth (the cap splits with them) ─────────────
  const oldRoof = [];
  const ceiling = scene.getObjectByName('ceiling');
  if (ceiling) {
    const meshes = [];
    ceiling.traverse((o) => o.isMesh && meshes.push(o));
    for (const mesh of meshes) {
      const parts = splitGeometry(mesh, (x, y, z) => {
        const a = azimuth(x, z);
        return ((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8;
      });
      for (const [k, geo] of parts) {
        const m = new THREE.Mesh(geo, mesh.material.clone());
        m.name = `pjl-old-roof-${k}`;
        oldRoof[k] = m;
      }
      mesh.geometry.dispose();
      removed.add(mesh.material);
    }
    ceiling.removeFromParent();
  }
  // The split pieces hold clones (sharing the atlas texture); twins that no
  // remaining GLB mesh uses (the glass twin) are freed here, textures kept.
  const used = new Set();
  scene.traverse((o) => o.isMesh && used.add(o.material));
  for (const m of removed) if (!used.has(m)) m.dispose();

  const floor = [];
  const loft = [];
  const furniture = [];
  const floorNode = scene.getObjectByName('floor');
  floorNode?.traverse((o) => o.isMesh && floor.push(o));
  for (const node of scene.children) {
    if (!node.name.startsWith('obj__') || node.name === 'obj__octagon') continue;
    const meshes = [];
    node.traverse((o) => o.isMesh && meshes.push(o));
    if (!meshes.length) continue;
    if (node.name === 'obj__loft') loft.push(...meshes);
    else furniture.push({ name: node.name.replace(/^obj__/, ''), node, meshes });
  }
  return { scene, walls, glass, oldRoof, floor, loft, loftNode: scene.getObjectByName('obj__loft'), furniture, atlas };
}
