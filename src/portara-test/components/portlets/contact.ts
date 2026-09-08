/**
 * Where a tool may touch a letter.
 *
 * Each letter is one TextGeometry mesh: a flat FRONT FACE (normal +z in the
 * letter's own space) and the extruded WALLS round its outline and round any
 * counter (normals in the letter's xy plane). Contacts are found by
 * RAYCASTING the mesh in its own space, once per letter, and cached: the
 * layout tool can move, scale and bend the word live, so anything computed
 * in world space would go stale, while local points cost one matrix multiply
 * per frame to bring into the world. Rays are cheap here (a letter is a few
 * hundred triangles) and they see the real surface: counters (the holes in
 * P, R, A, O) are simply where the front rays find nothing.
 *
 * For every hit we also measure
 * - `edgeR`: how far round the hit the surface continues at the same depth
 *   and normal (a ring of rays at growing radii). Whatever must sit wholly
 *   on the surface (a polishing pad, a nail's head, a bolt's washer) asks
 *   for this.
 * - `flatR`: how far round the hit nothing ELSE is met: ring rays may miss
 *   the letter entirely (a convex edge - overhang is harmless) but must not
 *   hit a different surface (a concave corner, the far wall of a counter),
 *   because that is what a tool clips into.
 * - `clear`: how far the tool may stand off along the normal before hitting
 *   the letter again (a counter's opposite wall). The tool must fit.
 */
import * as THREE from "three";
import { PORTLET_CONFIG } from "./config";

export type Candidate = {
  /** The contact point and unit normal, letter space. */
  p: THREE.Vector3;
  n: THREE.Vector3;
  /** On the front face (false: on a wall round the outline or a counter). */
  face: boolean;
  /** See above; letter space. */
  edgeR: number;
  flatR: number;
  clear: number;
  /** How far the surface rises toward the tool within flatR (a concave
      wall): the tool stands off by this so its rim cannot dip in. */
  bulge: number;
};

export type LetterContacts = {
  candidates: Candidate[];
  frontZ: number;
  box: THREE.Box3;
};

const cache = new WeakMap<THREE.BufferGeometry, LetterContacts>();
const ray = new THREE.Raycaster();
const probeMat = new THREE.MeshBasicMaterial();
const _o = new THREE.Vector3();
const _d = new THREE.Vector3();
const _t1 = new THREE.Vector3();
const _t2 = new THREE.Vector3();
const _q = new THREE.Vector3();
const H = 0.05; // ring rays start this far off the surface

const probes = new WeakMap<THREE.BufferGeometry, THREE.Mesh>();
/** A stand-in mesh at the origin, so rays can be cast in the letter's own space. */
function probeFor(geo: THREE.BufferGeometry) {
  let m = probes.get(geo);
  if (m) return m;
  if (!geo.boundingBox) geo.computeBoundingBox();
  if (!geo.boundingSphere) geo.computeBoundingSphere();
  m = new THREE.Mesh(geo, probeMat);
  m.updateMatrixWorld(true);
  probes.set(geo, m);
  return m;
}

function cast(probe: THREE.Mesh, o: THREE.Vector3, d: THREE.Vector3, far: number) {
  ray.set(o, d);
  ray.near = 0;
  ray.far = far;
  const hits = ray.intersectObject(probe, false);
  return hits.length ? hits[0] : null;
}

function tangents(n: THREE.Vector3) {
  _t1.set(0, 1, 0).addScaledVector(n, -n.y);
  if (_t1.lengthSq() < 1e-6) _t1.set(1, 0, 0).addScaledVector(n, -n.x);
  _t1.normalize();
  _t2.crossVectors(n, _t1);
}

/** The usable contacts on a letter mesh, computed once per geometry. */
export function letterContacts(mesh: THREE.Mesh): LetterContacts {
  const geo = mesh.geometry;
  const hit = cache.get(geo);
  if (hit) return hit;
  const cfg = PORTLET_CONFIG.contact;
  const probe = probeFor(geo);
  const box = geo.boundingBox!.clone();
  const frontZ = box.max.z;
  const midZ = (box.min.z + box.max.z) / 2;
  const w = box.max.x - box.min.x;
  const h = box.max.y - box.min.y;
  const raw: Candidate[] = [];
  const add = (p: THREE.Vector3, n: THREE.Vector3, face: boolean) => {
    // Skip near-duplicates (walls get hit from several directions).
    for (const c of raw) if (c.p.distanceToSquared(p) < 0.006 * 0.006) return;
    raw.push({ p: p.clone(), n: n.clone().normalize(), face, edgeR: 0, flatR: 0, clear: 0, bulge: 0 });
  };

  // Front face: a grid of rays straight at it. Misses inside the box are
  // counters or the concave parts of the outline; from those, rays sideways
  // find the walls.
  for (let i = 0; i < cfg.gridX; i++) {
    for (let j = 0; j < cfg.gridY; j++) {
      const x = box.min.x + w * ((i + 0.5) / cfg.gridX);
      const y = box.min.y + h * ((j + 0.5) / cfg.gridY);
      _o.set(x, y, frontZ + 1);
      _d.set(0, 0, -1);
      const f = cast(probe, _o, _d, 2);
      if (f && f.face && f.face.normal.z > 0.9 && Math.abs(f.point.z - frontZ) < 1e-3) {
        add(f.point, f.face.normal, true);
      } else if (cfg.walls) {
        _o.set(x, y, midZ);
        for (let k = 0; k < cfg.wallDirs; k++) {
          const a = (k / cfg.wallDirs) * Math.PI * 2;
          _d.set(Math.cos(a), Math.sin(a), 0);
          const s = cast(probe, _o, _d, 0.3);
          if (s && s.face && Math.abs(s.face.normal.z) < 0.2) add(s.point, s.face.normal, false);
        }
      }
    }
  }
  // Outer walls: rays in from beyond the box, at the grid's rows and columns.
  if (cfg.walls) {
    for (let j = 0; j < cfg.gridY; j++) {
      const y = box.min.y + h * ((j + 0.5) / cfg.gridY);
      for (const [x0, dx] of [
        [box.min.x - 0.05, 1],
        [box.max.x + 0.05, -1],
      ]) {
        _o.set(x0, y, midZ);
        _d.set(dx, 0, 0);
        const s = cast(probe, _o, _d, w + 0.1);
        if (s && s.face && Math.abs(s.face.normal.z) < 0.2) add(s.point, s.face.normal, false);
      }
    }
    for (let i = 0; i < cfg.gridX; i++) {
      const x = box.min.x + w * ((i + 0.5) / cfg.gridX);
      for (const [y0, dy] of [
        [box.min.y - 0.05, 1],
        [box.max.y + 0.05, -1],
      ]) {
        _o.set(x, y0, midZ);
        _d.set(0, dy, 0);
        const s = cast(probe, _o, _d, h + 0.1);
        if (s && s.face && Math.abs(s.face.normal.z) < 0.2) add(s.point, s.face.normal, false);
      }
    }
  }

  // Measure each: how flat around it, how clear in front of it.
  for (const c of raw) {
    tangents(c.n);
    let edgeR = 0;
    let flatR = 0;
    let bulge = 0;
    let flatOk = true;
    let edgeOk = true;
    for (const r of cfg.ringRadii) {
      let ringBulge = 0;
      for (let k = 0; k < cfg.ringSamples && (flatOk || edgeOk); k++) {
        const a = (k / cfg.ringSamples) * Math.PI * 2;
        _q.copy(c.p).addScaledVector(_t1, r * Math.cos(a)).addScaledVector(_t2, r * Math.sin(a));
        _o.copy(_q).addScaledVector(c.n, H);
        _d.copy(c.n).negate();
        const s = cast(probe, _o, _d, H + 0.02);
        if (!s) {
          edgeOk = false; // off the edge: fine for flatness, not for full contact
          continue;
        }
        const same = Math.abs(s.distance - H) < 0.003 && s.face!.normal.dot(c.n) > 0.96;
        if (!same) {
          flatOk = false;
          edgeOk = false;
        } else {
          ringBulge = Math.max(ringBulge, H - s.distance); // surface nearer than the plane
        }
      }
      if (edgeOk) edgeR = r;
      if (flatOk) {
        flatR = r;
        bulge = Math.max(bulge, ringBulge);
      }
      if (!flatOk) break;
    }
    c.edgeR = edgeR;
    c.flatR = flatR;
    c.bulge = bulge;
    _o.copy(c.p).addScaledVector(c.n, 0.001);
    const s = cast(probe, _o, c.n, cfg.maxClear);
    c.clear = s ? s.distance : cfg.maxClear;
  }

  const out = { candidates: raw.filter((c) => c.flatR > 0), frontZ, box };
  cache.set(geo, out);
  return out;
}

/** Bring a candidate into the world through the letter's current transform. */
const _nm = new THREE.Matrix3();
export function candidateToWorld(mesh: THREE.Mesh, c: Candidate, outP: THREE.Vector3, outN: THREE.Vector3) {
  outP.copy(c.p).applyMatrix4(mesh.matrixWorld);
  _nm.getNormalMatrix(mesh.matrixWorld);
  outN.copy(c.n).applyMatrix3(_nm).normalize();
}

/** The letter's uniform world scale (the word group scales; letters do not). */
const _s = new THREE.Vector3();
export function letterScale(mesh: THREE.Mesh) {
  mesh.matrixWorld.decompose(_o, _propQ, _s);
  return (_s.x + _s.y + _s.z) / 3;
}
const _propQ = new THREE.Quaternion();

/**
 * Debug: is this world point inside the letter? A ray from `standoff` above
 * it along -n must travel the whole standoff before meeting the surface. Used
 * for the tool-tip and probe checks; a bit lenient near sharp edges.
 */
const _lp = new THREE.Vector3();
const _ln = new THREE.Vector3();
const _im = new THREE.Matrix4();
const _inm = new THREE.Matrix3();
export function insideLetter(mesh: THREE.Mesh, point: THREE.Vector3, n: THREE.Vector3, tolerance = 0.0015) {
  const geo = mesh.geometry;
  const probe = probeFor(geo);
  _im.copy(mesh.matrixWorld).invert();
  _lp.copy(point).applyMatrix4(_im);
  _inm.getNormalMatrix(_im);
  _ln.copy(n).applyMatrix3(_inm).normalize();
  const scale = letterScale(mesh);
  const standoff = 0.08 / scale;
  _o.copy(_lp).addScaledVector(_ln, standoff);
  _d.copy(_ln).negate();
  const s = cast(probe, _o, _d, standoff + 0.05);
  if (!s) return false;
  return s.distance < standoff - tolerance / scale;
}
