/**
 * The things a job leaves on or near the letter while it runs: a nail being
 * driven, a bolt being tightened, a paint can on the floor, the shine a
 * polish leaves, strips of fresh paint, a weld bead, sparks and dust. One of
 * each, built once in WORLD units (they sit on the letters, not in a hand),
 * shown for a job and hidden after it. Nothing is allocated per job.
 */
import * as THREE from "three";
import type { ToolMaterials } from "./materials";
import { rand } from "./math";
import { bevelled, chamferedCylinder, part, polygonShape, roundedBox } from "./shapes";

const Y = new THREE.Vector3(0, 1, 0);
const Z = new THREE.Vector3(0, 0, 1);
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

/** A nail: shaft along +y from the origin, head on top. Placed so that
    `showing` of its length stands proud of the surface. */
export class Nail {
  group = new THREE.Group();
  readonly headH = 0.004;
  private geos: THREE.BufferGeometry[] = [];
  private head: THREE.Mesh;
  private pulse = 0;
  constructor(
    m: ToolMaterials,
    public len: number,
  ) {
    const shaft = chamferedCylinder(0.0026, 0.0018, len, 0.0008, 10);
    const head = chamferedCylinder(0.0075, 0.0065, this.headH, 0.0012, 14);
    this.geos.push(shaft, head);
    this.group.add(part(shaft, m.steel, 0, len / 2, 0));
    this.head = part(head, m.steel, 0, len + this.headH / 2, 0);
    this.group.add(this.head);
    this.group.visible = false;
  }
  /** Stand it at p along n with `showing` of the shaft out of the surface. */
  set(p: THREE.Vector3, n: THREE.Vector3, showing: number) {
    this.group.quaternion.setFromUnitVectors(Y, n);
    this.group.position.copy(p).addScaledVector(n, showing - this.len);
    this.group.visible = true;
  }
  /** The top of the head, where a hammer lands. */
  top(out: THREE.Vector3, p: THREE.Vector3, n: THREE.Vector3, showing: number) {
    return out.copy(p).addScaledVector(n, showing + this.headH);
  }
  hit() {
    this.pulse = 1;
  }
  update(dt: number) {
    if (this.pulse > 0) {
      this.pulse = Math.max(0, this.pulse - dt * 8);
      const s = 1 + 0.35 * this.pulse;
      this.head.scale.set(s, 1, s);
    }
  }
  hide() {
    this.group.visible = false;
  }
  dispose() {
    this.geos.forEach((g) => g.dispose());
  }
}

/** A hex bolt: head above the origin along +y, shaft below (inside the letter). */
export class Bolt {
  group = new THREE.Group();
  private geos: THREE.BufferGeometry[] = [];
  private head: THREE.Object3D;
  constructor(
    m: ToolMaterials,
    public headH: number,
  ) {
    const head = bevelled(polygonShape(0.0125, 6), headH, 0.0025, 1);
    head.rotateX(-Math.PI / 2); // extrude along z -> along y
    const washer = chamferedCylinder(0.016, 0.016, 0.0025, 0.0008, 18);
    const shaft = chamferedCylinder(0.0065, 0.0065, 0.05, 0.001, 12);
    this.geos.push(head, washer, shaft);
    this.head = part(head, m.chrome, 0, headH / 2 + 0.002, 0);
    this.group.add(this.head);
    this.group.add(part(washer, m.darkSteel, 0, 0.00125, 0));
    this.group.add(part(shaft, m.darkSteel, 0, -0.025, 0));
    this.group.visible = false;
  }
  /** At p along n, sunk in by `sink`, head turned by `angle`. */
  set(p: THREE.Vector3, n: THREE.Vector3, sink: number, angle: number) {
    this.group.quaternion.setFromUnitVectors(Y, n);
    this.group.position.copy(p).addScaledVector(n, -sink);
    this.head.rotation.y = angle;
    this.group.visible = true;
  }
  /** Just above the washer, where a socket's mouth lands with the head
      inside it. The washer stays on the face however far the bolt sinks, so
      the mouth never follows the head down. */
  mouth(out: THREE.Vector3, p: THREE.Vector3, n: THREE.Vector3, _sink: number) {
    return out.copy(p).addScaledVector(n, 0.003);
  }
  hide() {
    this.group.visible = false;
  }
  dispose() {
    this.geos.forEach((g) => g.dispose());
  }
}

/** A paint tin, standing on the floor: tall enough that dipping into it is
    mostly arm, not spine. */
export class Can {
  group = new THREE.Group();
  /** World-unit dimensions: the rim's height, the paint's surface, the
      inside radius, and the inside bottom. */
  readonly rim: number;
  readonly paintY: number;
  readonly innerR: number;
  readonly bottom = 0.006;
  private geos: THREE.BufferGeometry[] = [];
  constructor(m: ToolMaterials, height: number) {
    const R = 0.037;
    this.rim = height;
    this.paintY = height - 0.006;
    this.innerR = R - 0.006;
    const body = chamferedCylinder(R, R - 0.002, height - 0.004, 0.003, 24);
    const band = chamferedCylinder(R + 0.0008, R + 0.0008, height * 0.32, 0.001, 24);
    const top = new THREE.CircleGeometry(this.innerR, 24);
    const rim = new THREE.TorusGeometry(R - 0.0025, 0.0025, 8, 24);
    const handle = new THREE.TorusGeometry(R - 0.004, 0.0016, 6, 20, Math.PI);
    this.geos.push(body, band, top, rim, handle);
    this.group.add(part(body, m.steel, 0, (height - 0.004) / 2, 0));
    this.group.add(part(band, m.plasticAccent, 0, height * 0.42, 0));
    const paint = part(top, m.paint, 0, this.paintY, 0, -Math.PI / 2, 0, 0);
    paint.castShadow = false;
    this.group.add(paint);
    this.group.add(part(rim, m.steel, 0, height - 0.002, 0, Math.PI / 2, 0, 0));
    this.group.add(part(handle, m.darkSteel, 0, height + 0.002, 0, 0, 0, 0));
    this.group.visible = false;
  }
  place(p: THREE.Vector3, yaw: number) {
    this.group.position.copy(p);
    this.group.rotation.y = yaw;
    this.group.visible = true;
  }
  /** The paint's surface, in the middle. */
  surface(out: THREE.Vector3) {
    return out.copy(this.group.position).setY(this.group.position.y + this.paintY);
  }
  hide() {
    this.group.visible = false;
  }
  dispose() {
    this.geos.forEach((g) => g.dispose());
  }
}

/** The highlight a polish leaves: an additive disc that fades. */
export class Shine {
  mesh: THREE.Mesh;
  energy = 0;
  private mat: THREE.MeshBasicMaterial;
  private geo: THREE.BufferGeometry;
  constructor(
    m: ToolMaterials,
    private fade: number,
  ) {
    this.geo = new THREE.CircleGeometry(0.06, 24);
    this.mat = m.shine;
    this.mesh = new THREE.Mesh(this.geo, this.mat);
    this.mesh.castShadow = false;
    this.mesh.visible = false;
  }
  place(p: THREE.Vector3, n: THREE.Vector3) {
    this.mesh.quaternion.setFromUnitVectors(Z, n);
    this.mesh.position.copy(p).addScaledVector(n, 0.003);
    this.mesh.visible = true;
  }
  add(amount: number) {
    this.energy = Math.min(1, this.energy + amount);
  }
  update(dt: number) {
    if (!this.mesh.visible) return;
    this.energy = Math.max(0, this.energy - dt / this.fade);
    this.mat.opacity = 0.32 * this.energy;
    const s = 0.7 + 0.5 * this.energy;
    this.mesh.scale.set(s, s, 1);
    if (this.energy <= 0) this.mesh.visible = false;
  }
  dispose() {
    this.geo.dispose();
  }
}

/** Strips of fresh paint, laid along strokes: a small pool of planes. */
export class PaintStrips {
  group = new THREE.Group();
  private strips: THREE.Mesh[] = [];
  private geo = new THREE.PlaneGeometry(1, 1);
  private used = 0;
  private fading = 0;
  private start = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private normal = new THREE.Vector3();
  constructor(m: ToolMaterials, count = 10) {
    for (let i = 0; i < count; i++) {
      const s = new THREE.Mesh(this.geo, m.paint);
      s.castShadow = false;
      s.visible = false;
      this.strips.push(s);
      this.group.add(s);
    }
  }
  reset() {
    this.used = 0;
    this.fading = 0;
    for (const s of this.strips) s.visible = false;
  }
  /** A new strip from p, running along unit `dir` on the surface with normal n. */
  begin(p: THREE.Vector3, n: THREE.Vector3, dir: THREE.Vector3, width: number) {
    if (this.used >= this.strips.length) return;
    const s = this.strips[this.used++];
    this.start.copy(p);
    this.dir.copy(dir);
    this.normal.copy(n);
    _w.crossVectors(n, dir);
    const mtx = new THREE.Matrix4().makeBasis(dir, _w, n);
    s.quaternion.setFromRotationMatrix(mtx);
    s.scale.set(0.001, width, 1);
    s.position.copy(p).addScaledVector(n, 0.0025);
    s.visible = true;
  }
  /** Extend the current strip to the tip's position. */
  extend(tip: THREE.Vector3) {
    if (!this.used) return;
    const s = this.strips[this.used - 1];
    _v.copy(tip).sub(this.start);
    const len = Math.max(0.001, _v.dot(this.dir));
    s.scale.x = len;
    s.position.copy(this.start).addScaledVector(this.dir, len / 2).addScaledVector(this.normal, 0.0025);
  }
  /** Let the coat "dry": shrink away over half a second. */
  fadeOut() {
    if (this.used) this.fading = 1;
  }
  update(dt: number) {
    if (this.fading <= 0) return;
    this.fading = Math.max(0, this.fading - dt * 2);
    for (let i = 0; i < this.used; i++) this.strips[i].scale.y *= 0.9;
    if (this.fading <= 0) this.reset();
  }
  dispose() {
    this.geo.dispose();
  }
}

/** A weld bead, growing along the seam. */
export class WeldBead {
  mesh: THREE.Mesh;
  private geo: THREE.BufferGeometry;
  private start = new THREE.Vector3();
  private dir = new THREE.Vector3();
  private normal = new THREE.Vector3();
  constructor(m: ToolMaterials) {
    this.geo = roundedBox(1, 0.007, 0.005, 0.0024);
    this.mesh = new THREE.Mesh(this.geo, m.bead);
    this.mesh.castShadow = false;
    this.mesh.visible = false;
  }
  begin(p: THREE.Vector3, n: THREE.Vector3, dir: THREE.Vector3) {
    this.start.copy(p);
    this.dir.copy(dir);
    this.normal.copy(n);
    _w.crossVectors(n, dir);
    this.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(dir, _w, n));
    this.mesh.scale.set(0.001, 1, 1);
    this.mesh.position.copy(p).addScaledVector(n, 0.002);
    this.mesh.visible = true;
  }
  extend(tip: THREE.Vector3) {
    _v.copy(tip).sub(this.start);
    const len = Math.max(0.001, _v.dot(this.dir));
    this.mesh.scale.x = len;
    this.mesh.position.copy(this.start).addScaledVector(this.dir, len / 2).addScaledVector(this.normal, 0.002);
  }
  hide() {
    this.mesh.visible = false;
  }
  dispose() {
    this.geo.dispose();
  }
}

/** Sparks off a weld: a small pool of points with gravity and a short life. */
export class Sparks {
  points: THREE.Points;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private acc = 0;
  private next = 0;
  constructor(
    m: ToolMaterials,
    private count: number,
    private lifeTime: number,
    private speed: number,
  ) {
    this.pos = new Float32Array(count * 3).fill(1e4);
    this.vel = new Float32Array(count * 3);
    this.life = new Float32Array(count);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.points = new THREE.Points(this.geo, m.sparks);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }
  /** Emit `rate` per second from `at`, mostly away along n. */
  emit(at: THREE.Vector3, n: THREE.Vector3, rate: number, dt: number) {
    this.points.visible = true;
    this.acc += rate * dt;
    while (this.acc >= 1) {
      this.acc -= 1;
      const i = this.next;
      this.next = (this.next + 1) % this.count;
      this.pos[i * 3] = at.x;
      this.pos[i * 3 + 1] = at.y;
      this.pos[i * 3 + 2] = at.z;
      _v.set(rand(-1, 1), rand(-0.6, 1), rand(-1, 1)).normalize().multiplyScalar(this.speed * rand(0.35, 1));
      _v.addScaledVector(n, this.speed * 0.6);
      this.vel[i * 3] = _v.x;
      this.vel[i * 3 + 1] = _v.y;
      this.vel[i * 3 + 2] = _v.z;
      this.life[i] = this.lifeTime * rand(0.6, 1);
    }
  }
  update(dt: number) {
    if (!this.points.visible) return;
    let alive = 0;
    for (let i = 0; i < this.count; i++) {
      if (this.life[i] <= 0) continue;
      this.life[i] -= dt;
      if (this.life[i] <= 0) {
        this.pos[i * 3 + 1] = 1e4;
        continue;
      }
      alive++;
      this.vel[i * 3 + 1] -= 3.2 * dt;
      this.pos[i * 3] += this.vel[i * 3] * dt;
      this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt;
      this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    if (!alive && this.acc < 1) this.points.visible = false;
  }
  stop() {
    this.acc = 0;
  }
  dispose() {
    this.geo.dispose();
  }
}

/** Dust on the surface round the nozzle, drawn into it. */
export class Dust {
  points: THREE.Points;
  private geo = new THREE.BufferGeometry();
  private pos: Float32Array;
  private centre = new THREE.Vector3();
  private normal = new THREE.Vector3();
  private t1 = new THREE.Vector3();
  private t2 = new THREE.Vector3();
  private radius = 0.05;
  constructor(
    m: ToolMaterials,
    private count: number,
    private pull: number,
  ) {
    this.pos = new Float32Array(count * 3);
    this.geo.setAttribute("position", new THREE.BufferAttribute(this.pos, 3));
    this.geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.points = new THREE.Points(this.geo, m.dust);
    this.points.frustumCulled = false;
    this.points.visible = false;
  }
  start(p: THREE.Vector3, n: THREE.Vector3, radius: number) {
    this.centre.copy(p);
    this.normal.copy(n);
    this.radius = radius;
    this.t1.set(0, 1, 0).addScaledVector(n, -n.y);
    if (this.t1.lengthSq() < 1e-6) this.t1.set(1, 0, 0).addScaledVector(n, -n.x);
    this.t1.normalize();
    this.t2.crossVectors(n, this.t1);
    for (let i = 0; i < this.count; i++) this.respawn(i);
    this.points.visible = true;
  }
  private respawn(i: number) {
    const a = rand(0, Math.PI * 2);
    const r = this.radius * Math.sqrt(rand(0.15, 1));
    _v.copy(this.centre)
      .addScaledVector(this.t1, r * Math.cos(a))
      .addScaledVector(this.t2, r * Math.sin(a))
      .addScaledVector(this.normal, 0.002);
    this.pos[i * 3] = _v.x;
    this.pos[i * 3 + 1] = _v.y;
    this.pos[i * 3 + 2] = _v.z;
  }
  update(dt: number, tip: THREE.Vector3) {
    if (!this.points.visible) return;
    const f = 1 - Math.exp(-this.pull * dt);
    for (let i = 0; i < this.count; i++) {
      _v.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
      if (_v.distanceToSquared(tip) < 0.004 * 0.004) {
        this.respawn(i);
        continue;
      }
      // Only dust near the nozzle moves; the rest waits its turn.
      const near = 1 - Math.min(1, _v.distanceTo(tip) / (this.radius * 0.9));
      _v.lerp(tip, f * (0.15 + 0.85 * near));
      this.pos[i * 3] = _v.x;
      this.pos[i * 3 + 1] = _v.y;
      this.pos[i * 3 + 2] = _v.z;
    }
    (this.geo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
  }
  stop() {
    this.points.visible = false;
  }
  dispose() {
    this.geo.dispose();
  }
}

export class Props {
  group = new THREE.Group();
  nail: Nail;
  bolt: Bolt;
  can: Can;
  shine: Shine;
  strips: PaintStrips;
  bead: WeldBead;
  sparks: Sparks;
  dust: Dust;
  constructor(
    m: ToolMaterials,
    a: { nailLen: number; boltHeadH: number; canHeight: number; shineFade: number; sparks: number; sparkLife: number; sparkSpeed: number; dust: number; dustPull: number },
  ) {
    this.nail = new Nail(m, a.nailLen);
    this.bolt = new Bolt(m, a.boltHeadH);
    this.can = new Can(m, a.canHeight);
    this.shine = new Shine(m, a.shineFade);
    this.strips = new PaintStrips(m);
    this.bead = new WeldBead(m);
    this.sparks = new Sparks(m, a.sparks, a.sparkLife, a.sparkSpeed);
    this.dust = new Dust(m, a.dust, a.dustPull);
    this.group.add(this.nail.group, this.bolt.group, this.can.group, this.shine.mesh, this.strips.group, this.bead.mesh, this.sparks.points, this.dust.points);
  }
  update(dt: number) {
    this.nail.update(dt);
    this.shine.update(dt);
    this.strips.update(dt);
    this.sparks.update(dt);
  }
  dispose() {
    this.nail.dispose();
    this.bolt.dispose();
    this.can.dispose();
    this.shine.dispose();
    this.strips.dispose();
    this.bead.dispose();
    this.sparks.dispose();
    this.dust.dispose();
  }
}
