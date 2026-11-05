/* ============================================================================
   DEVIL'S IVY — drawing vines, drops and sparkles
   ----------------------------------------------------------------------------
   A vine is drawn from its trail points (world.js Trail lanes):
     • the STEM is one growing tube — rings are appended to a preallocated
       buffer as confirmed points arrive, so a two-minute vine costs nothing
       per frame;
     • the TAIL is the predicted last ~300 ms (the server hasn't confirmed it
       yet), rebuilt every frame, tapering to the growing tip;
     • LEAVES are heart-shaped pothos leaves on an InstancedMesh, laid flat
       against whatever the vine is crawling on, alternating sides, and
       unfurling as they appear. Each seat is a different pothos variety.
   ========================================================================== */

import * as THREE from 'three';
import { normalOf, STEM_R, VARIETIES } from './world.js';

const RADIAL = 6;
const RING_GAP = 0.022;
const LEAF_GAP = 0.068;
const LEAF_LEN = 0.085;
const LEAF_GROW_D = 0.32; // a leaf is full size this far behind the growing tip
const TAIL_LEAVES = 40;
const OFFSET = STEM_R + 0.003;

// ── Leaf shape: heart-shaped, pointed tip, cupped, midrib fold ──────────────
function leafGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.1);
  s.bezierCurveTo(-0.14, -0.07, -0.5, -0.03, -0.5, 0.32);
  s.bezierCurveTo(-0.5, 0.62, -0.2, 0.86, 0, 1.0);
  s.bezierCurveTo(0.2, 0.86, 0.5, 0.62, 0.5, 0.32);
  s.bezierCurveTo(0.5, -0.03, 0.14, -0.07, 0, 0.1);
  const g = new THREE.ShapeGeometry(s, 10);
  const p = g.attributes.position;
  const uv = g.attributes.uv;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i);
    const y = p.getY(i);
    let z = 0.2 * x * x + 0.07 * Math.abs(x);
    z -= 0.1 * Math.max(0, y - 0.72) ** 2;
    p.setZ(i, z);
    uv.setXY(i, x + 0.5, y);
  }
  g.computeVertexNormals();
  return g;
}

function leafTexture(v) {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  let seed = v.key.length * 977 + 13;
  const r = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  g.fillStyle = v.leaf;
  g.fillRect(0, 0, 128, 128);
  // Variegation: streaks feathering out from the midrib.
  const streaks = v.key === 'neon' ? 6 : v.key === 'marble' ? 34 : v.key === 'cebu' ? 10 : 22;
  for (let i = 0; i < streaks; i++) {
    const y = r() * 128;
    const dir = r() < 0.5 ? -1 : 1;
    g.strokeStyle = v.streak;
    g.globalAlpha = v.key === 'marble' ? 0.55 + r() * 0.4 : 0.35 + r() * 0.4;
    g.lineWidth = v.key === 'marble' ? 3 + r() * 9 : 1 + r() * 3;
    g.beginPath();
    g.moveTo(64, y);
    g.quadraticCurveTo(64 + dir * (20 + r() * 20), y - 10 - r() * 10, 64 + dir * (30 + r() * 34), y - 20 - r() * 20);
    g.stroke();
  }
  g.globalAlpha = 1;
  // Veins and midrib.
  g.strokeStyle = 'rgba(255,255,230,0.28)';
  g.lineWidth = 1;
  for (let y = 18; y < 120; y += 14) {
    for (const dir of [-1, 1]) {
      g.beginPath();
      g.moveTo(64, y);
      g.quadraticCurveTo(64 + dir * 22, y - 8, 64 + dir * 50, y - 26);
      g.stroke();
    }
  }
  g.strokeStyle = 'rgba(240,255,200,0.55)';
  g.lineWidth = 2.2;
  g.beginPath();
  g.moveTo(64, 0);
  g.lineTo(64, 128);
  g.stroke();
  // Waxy sheen towards the tip, darker towards the edges.
  const edge = g.createLinearGradient(0, 0, 128, 0);
  edge.addColorStop(0, 'rgba(0,30,0,0.35)');
  edge.addColorStop(0.3, 'rgba(0,0,0,0)');
  edge.addColorStop(0.7, 'rgba(0,0,0,0)');
  edge.addColorStop(1, 'rgba(0,30,0,0.35)');
  g.fillStyle = edge;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

export function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

function raysTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.translate(64, 64);
  for (let i = 0; i < 12; i++) {
    g.rotate(Math.PI / 6);
    const grd = g.createLinearGradient(0, 0, 0, -62);
    grd.addColorStop(0, 'rgba(255,230,140,0.9)');
    grd.addColorStop(1, 'rgba(255,230,140,0)');
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-3, 0);
    g.lineTo(0, -62);
    g.lineTo(3, 0);
    g.fill();
  }
  return new THREE.CanvasTexture(c);
}

const LEAF_GEO = leafGeometry();
const GLOW = glowTexture();
const RAYS = raysTexture();
const WILT = new THREE.Color('#6d5228');
const WHITE = new THREE.Color('#ffffff');

const _t = new THREE.Vector3();
const _n = new THREE.Vector3();
const _b = new THREE.Vector3();
const _c = new THREE.Vector3();
const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const _s = new THREE.Vector3();
const _x = new THREE.Vector3();
const _p = new THREE.Vector3();
const _e = new THREE.Euler();

function normalFor(code, out) {
  if (code < 6) {
    const n = normalOf(code);
    return out.set(n[0], n[1], n[2]);
  }
  const f = Math.floor((code - 6) / 6);
  const to = (code - 6) % 6;
  const a = normalOf(f);
  const b = normalOf(to);
  return out.set(a[0] + b[0], a[1] + b[1], a[2] + b[2]).normalize();
}

function hash(i) {
  let h = Math.imul(i ^ 0x9e3779b9, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function leafGrowth(behind) {
  const k = Math.min(1, Math.max(0, behind / LEAF_GROW_D));
  return 0.12 + 0.88 * k * k * (3 - 2 * k);
}

/** Where a leaf sits: forward and out to one side of the stem, lying against
 *  the surface with its tip lifted a touch. -> [px,py,pz, qx,qy,qz,qw, scale, s] */
function leafPose(p, n, t, side, j, s) {
  const b = new THREE.Vector3().crossVectors(t, n).normalize();
  const ang = 0.75 + hash(j + 7) * 0.35;
  const dir = new THREE.Vector3().copy(t).multiplyScalar(Math.cos(ang)).addScaledVector(b, side * Math.sin(ang)).normalize();
  const xAxis = new THREE.Vector3().crossVectors(dir, n).normalize();
  const m = new THREE.Matrix4().makeBasis(xAxis, dir, n);
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  q.multiply(new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.18 - hash(j + 3) * 0.15, side * 0.12, 0)));
  const pos = new THREE.Vector3().copy(p).addScaledVector(n, 0.004 + hash(j + 1) * 0.004).addScaledVector(b, side * 0.009);
  return [pos.x, pos.y, pos.z, q.x, q.y, q.z, q.w, LEAF_LEN * (0.8 + hash(j + 11) * 0.45), s];
}

// ── A growing tube ───────────────────────────────────────────────────────────
class Tube {
  constructor(material, cap) {
    this.cap = cap;
    this.rings = 0;
    this.material = material;
    this.alloc(cap);
  }

  alloc(cap) {
    const old = this.geo;
    this.cap = cap;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(cap * RADIAL * 3);
    const nor = new Float32Array(cap * RADIAL * 3);
    const idx = new Uint32Array(Math.max(0, cap - 1) * RADIAL * 6);
    for (let r = 0; r < cap - 1; r++) {
      for (let k = 0; k < RADIAL; k++) {
        const a = r * RADIAL + k;
        const b = r * RADIAL + ((k + 1) % RADIAL);
        const c = a + RADIAL;
        const d = b + RADIAL;
        const o = (r * RADIAL + k) * 6;
        idx[o] = a; idx[o + 1] = c; idx[o + 2] = b;
        idx[o + 3] = b; idx[o + 4] = c; idx[o + 5] = d;
      }
    }
    if (old) {
      pos.set(old.attributes.position.array.subarray(0, this.rings * RADIAL * 3));
      nor.set(old.attributes.normal.array.subarray(0, this.rings * RADIAL * 3));
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(2.6, 1.3, 2.4), 5);
    this.geo = geo;
    if (this.mesh) {
      this.mesh.geometry = geo;
      old.dispose();
    } else {
      this.mesh = new THREE.Mesh(geo, this.material);
      this.mesh.frustumCulled = false;
      this.mesh.castShadow = true;
      this.mesh.receiveShadow = true;
    }
    this.dirtyFrom = 0;
    this.updateRange();
  }

  /** Add one ring: centre c, frame (b, n) perpendicular to the tangent. */
  ring(c, b, n, radius) {
    if (this.rings >= this.cap) this.alloc(this.cap * 2);
    const pos = this.geo.attributes.position.array;
    const nor = this.geo.attributes.normal.array;
    const o = this.rings * RADIAL * 3;
    for (let k = 0; k < RADIAL; k++) {
      const a = (k / RADIAL) * Math.PI * 2;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = b.x * ca + n.x * sa;
      const ny = b.y * ca + n.y * sa;
      const nz = b.z * ca + n.z * sa;
      pos[o + k * 3] = c.x + nx * radius;
      pos[o + k * 3 + 1] = c.y + ny * radius;
      pos[o + k * 3 + 2] = c.z + nz * radius;
      nor[o + k * 3] = nx;
      nor[o + k * 3 + 1] = ny;
      nor[o + k * 3 + 2] = nz;
    }
    this.rings++;
  }

  updateRange() {
    const n = Math.max(0, this.rings - 1);
    this.geo.setDrawRange(0, n * RADIAL * 6);
    const p = this.geo.attributes.position;
    const nr = this.geo.attributes.normal;
    const from = this.dirtyFrom * RADIAL * 3;
    const count = (this.rings - this.dirtyFrom) * RADIAL * 3;
    if (count > 0) {
      p.clearUpdateRanges();
      p.addUpdateRange(from, count);
      p.needsUpdate = true;
      nr.clearUpdateRanges();
      nr.addUpdateRange(from, count);
      nr.needsUpdate = true;
    }
    this.dirtyFrom = this.rings;
  }

  clear() {
    this.rings = 0;
    this.dirtyFrom = 0;
    this.updateRange();
  }
}

// ── One vine ─────────────────────────────────────────────────────────────────
export class VineView {
  constructor(scene, varietyIndex) {
    this.scene = scene;
    this.variety = VARIETIES[varietyIndex];
    this.stemMat = new THREE.MeshStandardMaterial({ color: this.variety.stem, roughness: 0.5 });
    this.stem = new Tube(this.stemMat, 512);
    this.tail = new Tube(this.stemMat, 256);
    this.tail.mesh.castShadow = false;
    scene.add(this.stem.mesh, this.tail.mesh);

    this.leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(this.variety), roughness: 0.36, metalness: 0.02, side: THREE.DoubleSide });
    this.leafCap = 0;
    this.leaves = null;
    this.allocLeaves(400);
    // Provisional leaves on the predicted tail, rebuilt every frame.
    this.tailLeaves = new THREE.InstancedMesh(LEAF_GEO, this.leafMat, TAIL_LEAVES);
    this.tailLeaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.tailLeaves.frustumCulled = false;
    this.tailLeaves.count = 0;
    scene.add(this.tailLeaves);

    // Growing tip: a pale bud and a soft glow in the variety's colour.
    this.tip = new THREE.Group();
    const bud = new THREE.Mesh(new THREE.ConeGeometry(0.01, 0.05, 8), new THREE.MeshStandardMaterial({ color: '#c8e88a', roughness: 0.4 }));
    bud.rotation.x = Math.PI / 2; // cone points along +z (heading)
    bud.position.z = 0.02;
    this.bud = bud;
    const curl = new THREE.Mesh(LEAF_GEO, this.leafMat);
    curl.scale.setScalar(0.045);
    curl.rotation.set(-0.9, 0, 0.5);
    curl.position.set(0.006, 0.006, 0.0);
    this.glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: this.variety.glow, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.9 }));
    this.glow.scale.setScalar(0.11);
    this.tip.add(bud, curl, this.glow);
    scene.add(this.tip);

    this.reset();
  }

  allocLeaves(cap) {
    const old = this.leaves;
    const mesh = new THREE.InstancedMesh(LEAF_GEO, this.leafMat, cap);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    for (let i = 0; i < cap; i++) mesh.setColorAt(i, WHITE);
    if (old) {
      for (let i = 0; i < this.leafCount; i++) {
        old.getMatrixAt(i, _m);
        mesh.setMatrixAt(i, _m);
      }
      this.scene.remove(old);
      old.dispose();
    }
    mesh.count = this.leafCount || 0;
    this.leaves = mesh;
    this.leafCap = cap;
    this.scene.add(mesh);
  }

  reset() {
    this.consumed = 0; //    confirmed trail points read so far
    this.lastRing = null; // centre of the last stem ring
    this.lastPoint = null;
    this.nextLeafS = 0.12;
    this.leafSide = 1;
    this.leafCount = 0;
    this.grown = 0;
    this.leafData = []; //   [px,py,pz, qx,qy,qz,qw, scale, s]
    this.prevRaw = null; //  the previous trail point (leaf headings)
    this.wiltT = -1;
    this.stem.clear();
    this.tail.clear();
    if (this.tailLeaves) this.tailLeaves.count = 0;
    if (this.leaves) {
      this.leaves.count = 0;
      for (let i = 0; i < this.leafCap; i++) this.leaves.setColorAt(i, WHITE);
      this.leaves.instanceColor.needsUpdate = true;
    }
    this.stemMat.color.set(this.variety.stem);
    this.tip.visible = false;
    this.headPos = new THREE.Vector3();
    this.headNormal = new THREE.Vector3(0, 1, 0);
    this.headDir = new THREE.Vector3(0, 0, 1);
  }

  setVisible(v) {
    this.stem.mesh.visible = this.tail.mesh.visible = this.leaves.visible = this.tailLeaves.visible = v;
    if (!v) this.tip.visible = false;
  }

  /** Append confirmed points [consumed, lane.length) to the stem and leaves. */
  consume(lane, now) {
    const n = lane.x.length;
    for (let j = this.consumed; j < n; j++) this.addPoint(lane.x[j], lane.y[j], lane.z[j], lane.s[j], lane.a[j], now, j);
    this.consumed = n;
    this.stem.updateRange();
    this.leaves.count = this.leafCount;
  }

  addPoint(x, y, z, s, a, now, j) {
    _p.set(x, y, z);
    normalFor(a, _n);
    const fold = a >= 6;
    // Leaves first, on every point (the predicted tail uses the same rule, so
    // a provisional leaf turns into the real one in the same place).
    if (this.prevRaw && !fold && s >= this.nextLeafS) {
      _t.subVectors(_p, this.prevRaw);
      if (_t.lengthSq() > 1e-12) {
        _t.normalize();
        this.nextLeafS = s + LEAF_GAP * (0.85 + hash(j) * 0.3);
        this.leafSide = -this.leafSide;
        if (this.leafCount >= this.leafCap) this.allocLeaves(this.leafCap * 2);
        this.leafData.push(leafPose(_p, _n, _t, this.leafSide, j, s));
        this.setLeaf(this.leafCount, 0.12);
        this.leafCount++;
        this.leaves.instanceMatrix.needsUpdate = true;
      }
    }
    if (!this.prevRaw) this.prevRaw = new THREE.Vector3();
    this.prevRaw.copy(_p);
    _c.copy(_p).addScaledVector(_n, fold ? OFFSET * 1.41 : OFFSET);
    if (!this.lastPoint) {
      this.lastPoint = _p.clone();
      this.firstCentre = _c.clone();
      this.firstNormal = _n.clone();
      return;
    }
    if (this.lastRing && !fold && _c.distanceToSquared(this.lastRing) < RING_GAP * RING_GAP) return;
    const from = this.lastRing || this.firstCentre;
    _t.subVectors(_c, from);
    if (_t.lengthSq() < 1e-10) return;
    _t.normalize();
    if (!this.lastRing) {
      // the very first ring, at the spawn point
      this.frame(_t, this.firstNormal);
      this.stem.ring(this.firstCentre, _b, _x, STEM_R * 0.7);
    }
    this.frame(_t, _n);
    this.stem.ring(_c, _b, _x, STEM_R);
    this.lastRing = (this.lastRing || new THREE.Vector3()).copy(_c);
    this.lastNormal = (this.lastNormal || new THREE.Vector3()).copy(_n);
    this.lastTangent = (this.lastTangent || new THREE.Vector3()).copy(_t);
    this.lastPoint.copy(_p);
  }

  // b = t × n (sideways), x = b × t (the ring's "up")
  frame(t, n) {
    _b.crossVectors(t, n);
    if (_b.lengthSq() < 1e-8) _b.set(1, 0, 0).cross(t);
    _b.normalize();
    _x.crossVectors(_b, t).normalize();
  }

  setLeaf(i, grow, mesh = this.leaves, d = this.leafData[i]) {
    _p.set(d[0], d[1], d[2]);
    _q.set(d[3], d[4], d[5], d[6]);
    const s = d[7] * grow;
    _s.set(s, s, s);
    _m.compose(_p, _q, _s);
    mesh.setMatrixAt(i, _m);
  }

  /** Per frame: unfurl young leaves (by how far the tip has grown past
   *  them, so it matches the prediction and survives skipped frames), and
   *  wilt if dead. headS = the vine's length at its drawn tip. */
  animate(now, headS) {
    let touched = false;
    let allDone = true;
    for (let i = this.grown; i < this.leafCount; i++) {
      const g = leafGrowth(headS - this.leafData[i][8]);
      this.setLeaf(i, g);
      touched = true;
      if (g >= 1 && allDone) this.grown = i + 1;
      else allDone = false;
    }
    if (touched) this.leaves.instanceMatrix.needsUpdate = true;
    if (this.wiltT >= 0) {
      const k = Math.min(1, (now - this.wiltT) / 1600);
      if (k < 1 || !this.wiltDone) {
        const c = new THREE.Color();
        for (let i = 0; i < this.leafCount; i++) {
          // brown creeps back from the tip
          const local = Math.min(1, Math.max(0, k * 1.6 - ((this.leafCount - i) / Math.max(1, this.leafCount)) * 0.6));
          c.copy(WHITE).lerp(WILT, local * 0.85);
          this.leaves.setColorAt(i, c);
        }
        this.leaves.instanceColor.needsUpdate = true;
        this.stemMat.color.set(this.variety.stem).lerp(WILT, k * 0.7);
        if (k >= 1) this.wiltDone = true;
      }
    }
  }

  wilt(now) {
    if (this.wiltT < 0) {
      this.wiltT = now;
      this.wiltDone = false;
    }
  }

  unwilt() {
    if (this.wiltT < 0) return;
    this.wiltT = -1;
    for (let i = 0; i < this.leafCount; i++) this.leaves.setColorAt(i, WHITE);
    this.leaves.instanceColor.needsUpdate = true;
    this.stemMat.color.set(this.variety.stem);
  }

  /** The predicted tail (overlay lane) plus the head, tapering to the tip. */
  setTail(lane, head, alive, headS) {
    this.tail.clear();
    const pts = [];
    if (this.lastRing) pts.push([this.lastRing.clone(), this.lastNormal.clone()]);
    if (lane) {
      for (let j = 0; j < lane.x.length; j++) {
        const a = lane.a[j];
        const n = normalFor(a, new THREE.Vector3());
        const c = new THREE.Vector3(lane.x[j], lane.y[j], lane.z[j]).addScaledVector(n, a >= 6 ? OFFSET * 1.41 : OFFSET);
        const prev = pts[pts.length - 1];
        if (prev && a < 6 && prev[0].distanceToSquared(c) < (RING_GAP * 0.7) ** 2) continue;
        pts.push([c, n]);
      }
    }
    // Provisional leaves along the predicted tail, by the same rule as addPoint.
    let tl = 0;
    if (lane && this.prevRaw) {
      let nextS = this.nextLeafS;
      let side = this.leafSide;
      const prev = _c.copy(this.prevRaw);
      for (let j = 0; j < lane.x.length && tl < TAIL_LEAVES; j++) {
        _p.set(lane.x[j], lane.y[j], lane.z[j]);
        const a = lane.a[j];
        const sj = lane.s[j];
        if (a < 6 && sj >= nextS) {
          _t.subVectors(_p, prev);
          if (_t.lengthSq() > 1e-12) {
            _t.normalize();
            normalFor(a, _n);
            const jj = this.consumed + j;
            nextS = sj + LEAF_GAP * (0.85 + hash(jj) * 0.3);
            side = -side;
            const d = leafPose(_p, _n, _t, side, jj, sj);
            this.setLeaf(tl, leafGrowth((headS ?? sj) - sj), this.tailLeaves, d);
            tl++;
          }
        }
        prev.copy(_p);
      }
    }
    this.tailLeaves.count = tl;
    if (tl) this.tailLeaves.instanceMatrix.needsUpdate = true;

    // tip position / orientation for the camera and the bud
    if (head) {
      this.headPos.set(head.x, head.y, head.z);
      normalFor(head.na * 2 + (head.ns > 0 ? 0 : 1), this.headNormal);
      this.headDir.set(head.dx, head.dy, head.dz);
    }
    if (pts.length >= 2) {
      const total = pts.length;
      for (let i = 0; i < total; i++) {
        const [c, n] = pts[i];
        const next = pts[Math.min(total - 1, i + 1)][0];
        const prev = pts[Math.max(0, i - 1)][0];
        _t.subVectors(next, prev);
        if (_t.lengthSq() < 1e-12) continue;
        _t.normalize();
        this.frame(_t, n);
        const fromEnd = total - 1 - i;
        const taper = alive ? Math.min(1, 0.45 + fromEnd * 0.06) : 1;
        this.tail.ring(c, _b, _x, STEM_R * taper);
      }
    }
    this.tail.updateRange();

    this.tip.visible = alive && !!head;
    if (this.tip.visible) {
      _c.copy(this.headPos).addScaledVector(this.headNormal, OFFSET);
      this.tip.position.copy(_c);
      // tip group: +z = heading, +y = surface normal
      _x.crossVectors(this.headNormal, this.headDir).normalize();
      _m.makeBasis(_x, this.headNormal, this.headDir);
      this.tip.quaternion.setFromRotationMatrix(_m);
    }
  }

  /** Glows are camera-facing quads; pull them towards the camera so the
   *  surface a tip or drop is sitting on doesn't slice them in half. */
  faceCamera(camPos) {
    if (!this.tip.visible) return;
    _p.subVectors(camPos, this.tip.position).normalize().multiplyScalar(0.07);
    _p.addScaledVector(this.headNormal, 0.015).add(this.tip.position);
    this.tip.worldToLocal(_p);
    this.glow.position.copy(_p);
  }

  dispose() {
    this.scene.remove(this.stem.mesh, this.tail.mesh, this.leaves, this.tailLeaves, this.tip);
    this.tailLeaves.dispose();
    this.stem.geo.dispose();
    this.tail.geo.dispose();
    this.leaves.dispose();
    this.leafMat.map.dispose();
    this.leafMat.dispose();
    this.stemMat.dispose();
  }
}

// ── Sun drops and dew drops ──────────────────────────────────────────────────
export class DropsView {
  constructor(scene) {
    this.scene = scene;
    this.items = new Map();
    this.sunMat = new THREE.MeshStandardMaterial({ color: '#ffd66b', emissive: '#ffb21e', emissiveIntensity: 2.2, roughness: 0.3 });
    this.dewMat = new THREE.MeshStandardMaterial({ color: '#c9f0ff', roughness: 0.02, metalness: 0.15, transparent: true, opacity: 0.78, envMapIntensity: 2.5, emissive: '#2a7aa8', emissiveIntensity: 0.35 });
    this.sunGeo = new THREE.SphereGeometry(0.034, 24, 16);
    this.dewGeo = new THREE.SphereGeometry(0.022, 20, 14);
    // One light that follows whichever sun drop is out (changing the number
    // of lights would recompile every shader mid-game).
    this.sunLight = new THREE.PointLight('#ffc85a', 0, 1.6, 1.5);
    scene.add(this.sunLight);
  }

  sync(pickups, now, camPos) {
    const seen = new Set();
    let sun = null;
    for (const p of pickups) {
      if (!p.live) continue;
      seen.add(p.id);
      let it = this.items.get(p.id);
      if (!it) {
        it = this.make(p, now);
        this.items.set(p.id, it);
      }
      const n = normalOf(p.na * 2 + (p.ns > 0 ? 0 : 1));
      const bob = Math.sin(now / 420 + p.id) * 0.008;
      const appear = Math.min(1, (now - it.born) / 450);
      it.group.position.set(p.x + n[0] * bob, p.y + n[1] * bob, p.z + n[2] * bob);
      it.group.scale.setScalar(0.2 + 0.8 * (1 - (1 - appear) ** 3));
      if (it.rays) it.rays.material.rotation = now / 2200;
      if (camPos) {
        // keep the glow (and rays) in front of the surface the drop sits on
        _p.subVectors(camPos, it.group.position).normalize().multiplyScalar(0.07 / it.group.scale.x);
        for (const sp of it.sprites) sp.position.copy(_p);
      }
      if (p.kind === 0) sun = it.group.position;
    }
    for (const [id, it] of this.items) {
      if (!seen.has(id)) {
        this.scene.remove(it.group);
        this.items.delete(id);
      }
    }
    if (sun) {
      this.sunLight.position.copy(sun);
      this.sunLight.intensity = 0.9 + Math.sin(now / 300) * 0.15;
    } else {
      this.sunLight.intensity = 0;
    }
  }

  make(p, now) {
    const group = new THREE.Group();
    const sprites = [];
    let rays = null;
    if (p.kind === 0) {
      group.add(new THREE.Mesh(this.sunGeo, this.sunMat));
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#ffc23a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.85 }));
      glow.scale.setScalar(0.32);
      rays = new THREE.Sprite(new THREE.SpriteMaterial({ map: RAYS, color: '#ffe08a', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
      rays.scale.setScalar(0.42);
      group.add(glow, rays);
      sprites.push(glow, rays);
    } else {
      const drop = new THREE.Mesh(this.dewGeo, this.dewMat);
      drop.scale.set(1, 1.18, 1);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW, color: '#7fdcff', blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
      glow.scale.setScalar(0.16);
      group.add(drop, glow);
      sprites.push(glow);
    }
    this.scene.add(group);
    return { group, rays, sprites, born: now };
  }

  clear() {
    for (const it of this.items.values()) this.scene.remove(it.group);
    this.items.clear();
    this.sunLight.intensity = 0;
  }
}

// ── Sparkles (pickups) and leaf bits (wilting) ───────────────────────────────
export class Sparks {
  constructor(scene, max = 600) {
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.age = new Float32Array(max);
    this.next = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    this.points = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ size: 0.028, map: GLOW, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }),
    );
    this.points.frustumCulled = false;
    scene.add(this.points);
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -100;
  }

  burst(x, y, z, n, color, count, speed = 0.9, life = 0.9, gravity = false) {
    const c = new THREE.Color(color);
    for (let k = 0; k < count; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      this.pos[i * 3] = x;
      this.pos[i * 3 + 1] = y;
      this.pos[i * 3 + 2] = z;
      let vx = Math.random() * 2 - 1;
      let vy = Math.random() * 2 - 1;
      let vz = Math.random() * 2 - 1;
      const l = Math.hypot(vx, vy, vz) || 1;
      const sp = speed * (0.3 + Math.random() * 0.7);
      vx = (vx / l) * sp + n[0] * speed * 0.6;
      vy = (vy / l) * sp + n[1] * speed * 0.6;
      vz = (vz / l) * sp + n[2] * speed * 0.6;
      this.vel[i * 3] = vx;
      this.vel[i * 3 + 1] = vy;
      this.vel[i * 3 + 2] = vz;
      this.life[i] = life * (0.6 + Math.random() * 0.6) * (gravity ? -1 : 1);
      this.age[i] = 0;
      const tint = 0.75 + Math.random() * 0.25;
      this.col[i * 3] = c.r * tint;
      this.col[i * 3 + 1] = c.g * tint;
      this.col[i * 3 + 2] = c.b * tint;
    }
  }

  update(dt) {
    for (let i = 0; i < this.max; i++) {
      const L = Math.abs(this.life[i]);
      if (L <= 0) continue;
      this.age[i] += dt;
      if (this.age[i] >= L) {
        this.life[i] = 0;
        this.pos[i * 3 + 1] = -100;
        continue;
      }
      const drag = 1 - dt * 2.4;
      this.vel[i * 3] *= drag;
      this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * drag - (this.life[i] < 0 ? 2.2 * dt : 0);
      this.vel[i * 3 + 2] *= drag;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      const fade = 1 - this.age[i] / L;
      this.col[i * 3] *= 0.985 + 0.015 * fade;
      this.col[i * 3 + 1] *= 0.985 + 0.015 * fade;
      this.col[i * 3 + 2] *= 0.985 + 0.015 * fade;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.points.geometry.attributes.color.needsUpdate = true;
  }
}
