/* Dream Rooms · the Dream Corridor (CONTRACTS.md §7, framework Change C).

     const c = new CorridorRunner(stage, { rows, at, enter, autopilot })
     c.start() · c.setRows(rows) · c.update(dt) · c.onTap(x, y) · c.dispose()

   The corridor is a world.json made at runtime (buildCorridorWorld) and run by the
   same stage as any dream: fog, the one post pass, live text, swaps while unseen.
   Its geometry is the static kit (public/dreams/corridor-kit.glb, or the grey box
   until/unless that loads); only about ±12 pieces around the walker are in the
   scene, pooled and reused, so 300 dreams cost what 10 do. Doors are live: ajar
   (rendered) with sourceless light from the gap, shut with a line of light under
   (captured/reading/building), or shut and dark (failed). Only ajar doors open.
   Going through one whitens the frame, loads the dream during the white, and
   clears at its spawn; waking clears back here, at that door, facing it, shut.
   Debug hook: window.__corridor (ids, states and numbers only). */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DIMS, DOOR, STUB } from '../contracts/layout.js';
import { buildCorridorWorld } from '../contracts/corridorWorld.js';
import { greyboxKit } from './greybox.js';
import { toBasic, glowMaterial, disposeTree } from './materials.js';
import { slide } from './grid.js';
import { TextPlane } from './text.js';
import { startDreamAudio } from './audio.js';
import { stepWalker, baseSpeed, yawTo, wrapAngle } from './walker.js';
import { DreamRunner, StillsRunner } from './dream.js';

const C = DIMS.corridor;
const R = DIMS.walker.radius;
const UNSEEN = DIMS.unseen.seconds;
const AJAR = (C.leafAjarDeg * Math.PI) / 180;
const LEN = {
  entrance: C.entrance.length,
  plain: C.segment,
  door_l: C.segment,
  door_r: C.segment,
  door_lr: C.segment,
  break: C.break.length,
  end: C.end.length,
  end_door: C.segment,
};
const PIECES = ['entrance', 'plain', 'door_l', 'door_r', 'door_lr', 'break', 'end', 'end_door'];
export const KIT_URL = '/dreams/corridor-kit.glb';

export class CorridorRunner {
  constructor(S, { rows, at, enter, autopilot }) {
    this.S = S;
    this.rows = rows || [];
    this.atProp = at || null;
    this.enterProp = enter || null;
    this.autopilot = !!autopilot;
    this.state = 'loading';
    this.scene = null;
    this.atId = null;
    this.active = new Map(); // piece index → instance
    this.pool = new Map(PIECES.map((p) => [p, []]));
    this.doorPool = [];
    this.stencilPool = [];
    this.swapState = new Map();
    this.wokeShut = new Set();
    this.auto = null;
    this.entryGrace = 0;
    this.bag = [];
    this.disposed = false;
    this.hook();
  }

  get kitUrl() {
    const p = this.S.getProps();
    return p.kitUrl === undefined ? KIT_URL : p.kitUrl;
  }

  setState(st) {
    if (this.state === st) return;
    this.state = st;
    this.S.getProps().onState?.(st);
  }

  hook() {
    const self = this;
    window.__corridor = {
      get doors() {
        return (self.world?.doors || []).filter((d) => d.dream).map((d) => ({ id: d.dream, dreamt_on: d.dreamt_on, night_order: d.night_order, status: d.status, state: d.state, side: d.side, z: d.z }));
      },
      get breaks() {
        return (self.world?.breaks || []).map((b) => ({ night: b.night, z: b.z }));
      },
      get empty() {
        return !!self.world && !(self.world.doors || []).some((d) => d.dream);
      },
      get at() { return self.atId; },
      get state() { return self.state; },
      get fps() { return self.S.fps; },
      get pos() { return [Math.round(self.S.walker.x * 100) / 100, Math.round(self.S.walker.z * 100) / 100]; },
      get streamed() { return self.active.size; },
      get kit() { return self.kitSource || null; },
      signScreen: (id) => self.signScreen(id),
      enter: (id) => self.enterById(id),
    };
  }

  /* ── the kit ─────────────────────────────────────────────────────────── */
  async loadKit() {
    let root = null;
    const url = this.kitUrl;
    if (url) {
      try {
        root = (await new GLTFLoader().loadAsync(url)).scene;
        this.kitSource = 'glb';
      } catch (err) {
        console.warn('[dream-rooms] corridor kit failed to load; using the grey box', err?.message || '');
      }
    }
    const grey = greyboxKit();
    if (!root) {
      root = grey;
      this.kitSource = 'greybox';
    }
    toBasic(root);
    toBasic(grey);
    this.kitRoot = root;
    this.greyRoot = grey;
    const pick = (name) => {
      const n = root.getObjectByName(`K_${name}`) || grey.getObjectByName(`K_${name}`);
      n.removeFromParent();
      n.position.set(0, 0, 0);
      n.rotation.set(0, 0, 0);
      n.scale.set(1, 1, 1);
      n.updateMatrixWorld(true);
      return n;
    };
    this.kit = {};
    for (const p of PIECES) this.kit[p] = pick(p);
    // where the bay's stencil goes and how far its narrow ends run (the kit's node extras; the grey box sets the same)
    const bx = this.kit.break.userData || {};
    this.bay = {
      narrow: Number.isFinite(bx.narrow) ? bx.narrow : 0,
      stencil: bx.stencil || { side: 'l', x: -C.break.width / 2, y: C.break.stencilY, z: -C.break.length / 2 },
    };
    this.kit.leaf = pick('leaf');
    this.kit.spill = pick('spill');
    this.kit.underline = pick('underline');
    // the light pieces get the additive gradient instead of their plain material
    const glowOn = (node, opts) => {
      node.traverse((o) => {
        if (!o.isMesh) return;
        o.material = glowMaterial(o.geometry, opts);
        o.renderOrder = 3;
        o.userData.noCollide = true;
        this.bag.push(o.material);
      });
    };
    glowOn(this.kit.spill, { color: '#ffd7a0', strength: 1.15, pow: 1.4 });
    glowOn(this.kit.underline, { color: '#ffdcae', strength: 0.95, pow: 2.2 });
    // a dark leaf for a failed dream
    this.darkLeafMats = new Map();
    // live doors read lighter than the walls, so the corridor is a row of choices (fresh-review fix)
    this.liteLeafMats = new Map();
    // the gap and the stub's far wall, lit by nothing you can see (our own quads, in the leaf's frame)
    const quad = (pts) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
      g.setIndex([0, 1, 2, 0, 2, 3]);
      this.bag.push(g);
      return g;
    };
    this.slitGeo = quad([[-0.03, 0, -0.86], [-0.03, 0, -1.0], [-0.03, DOOR.h, -1.0], [-0.03, DOOR.h, -0.86]]);
    this.slitMat = glowMaterial(this.slitGeo, { color: '#ffd9a8', strength: 1.1, pow: 0.9, mode: 1 });
    const far = -(STUB.leg1 + STUB.width / 2) + 0.05;
    this.backGeo = quad([[far, 0, 0.25], [far, 0, -1.25], [far, STUB.height, -1.25], [far, STUB.height, 0.25]]);
    this.backMat = glowMaterial(this.backGeo, { color: '#f6cf98', strength: 0.7, pow: 0.7, mode: 1 });
    this.bag.push(this.slitMat, this.backMat);
    this.proxyGeo = new THREE.BoxGeometry(0.36, 2.7, 1.15);
    this.proxyMat = new THREE.MeshBasicMaterial({ visible: false });
    this.bag.push(this.proxyGeo, this.proxyMat);
  }

  /* ── the world ───────────────────────────────────────────────────────── */
  build(rows) {
    this.world = buildCorridorWorld(rows, { at: this.atId || this.atProp });
    const w = this.world;
    if (!this.scene) {
      const fog = new THREE.Color(w.look.fog.color);
      this.scene = new THREE.Scene();
      this.scene.fog = new THREE.FogExp2(fog, w.look.fog.density);
      this.scene.background = fog.clone();
      this.hits = new THREE.Group();
    }
    this.pieces = w.pieces.map((p, i) => ({ ...p, i, len: LEN[p.piece] }));
    this.doorsById = new Map(w.doors.map((d) => [d.id, d]));
    this.doorsByZ = [...w.doors].sort((a, b) => b.z - a.z);
    this.breaksByNight = new Map(w.breaks.map((b) => [b.night, b]));
    this.swaps = new Map();
    for (const s of w.swaps || []) {
      const m = /^corridor\/sign:(.+)$/.exec(s.target);
      if (m) this.swaps.set(m[1], s);
    }
    const last = this.pieces[this.pieces.length - 1];
    const empty = !w.doors.some((d) => d.dream);
    this.zMax = -(R + 0.25);
    this.zMin = empty ? last.z - last.len + R + 0.25 : last.z - 6;
  }

  setRows(rows) {
    this.rows = rows || [];
    if (!this.kit) return;
    for (const i of [...this.active.keys()]) this.release(i);
    this.build(this.rows);
    const w = this.S.walker;
    w.z = Math.min(this.zMax, Math.max(this.zMin, w.z));
    if (!this.walkable(w.x, w.z)) w.x = 0;
    this.stream();
  }

  pieceAt(z) {
    const ps = this.pieces;
    let lo = 0;
    let hi = ps.length - 1;
    if (z > ps[0].z) return ps[0];
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (ps[mid].z >= z) lo = mid;
      else hi = mid - 1;
    }
    return ps[lo];
  }

  halfAt(z) {
    const p = this.pieceAt(z);
    if (p.piece !== 'break') return C.width / 2;
    const depth = p.z - z;
    const n = this.bay?.narrow || 0;
    return depth < n || depth > p.len - n ? C.width / 2 : C.break.width / 2;
  }

  doorNear(z, within = 0.32) {
    let best = null;
    let bd = within;
    for (const d of this.doorsByZ) {
      const dd = Math.abs(d.z - z);
      if (dd < bd) {
        bd = dd;
        best = d;
      }
      if (d.z < z - 2) break;
    }
    return best;
  }

  isOpen(d) {
    return d.state === 'ajar' && !this.wokeShut.has(d.id);
  }

  /** The analytic walk area: the corridor's width (wider in a bay), shut doors block, an ajar one lets you in. */
  walkable(x, z) {
    if (z > this.zMax || z < this.zMin) return false;
    const hw = Math.min(this.halfAt(z - R), this.halfAt(z), this.halfAt(z + R)) - R;
    if (Math.abs(x) <= hw) return true;
    const d = this.doorNear(z, 0.3);
    if (d && d.side !== 'end' && this.isOpen(d) && (d.side === 'l' ? x < 0 : x > 0) && Math.abs(x) <= C.width / 2 + 0.7) return true;
    return false;
  }

  /* ── streaming ───────────────────────────────────────────────────────── */
  stream(force = false) {
    const p = this.pieceAt(this.S.walker.z);
    if (!force && p.i === this.centreIndex) return;
    this.centreIndex = p.i;
    const N = C.stream;
    const lo = Math.max(0, p.i - N);
    const hi = Math.min(this.pieces.length - 1, p.i + N);
    for (const i of [...this.active.keys()]) if (i < lo || i > hi) this.release(i);
    for (let i = lo; i <= hi; i++) if (!this.active.has(i)) this.acquire(this.pieces[i]);
  }

  acquire(p) {
    const mesh = this.pool.get(p.piece).pop() || this.kit[p.piece].clone(true);
    mesh.position.set(0, 0, p.z);
    mesh.visible = true;
    this.scene.add(mesh);
    const inst = { mesh, piece: p };
    if (p.door) {
      const door = this.doorsById.get(p.door);
      if (door) inst.door = this.acquireDoor(door);
    }
    if (p.piece === 'break') {
      const b = this.breaksByNight.get(p.night);
      if (b) inst.stencil = this.acquireStencil(b, p);
    }
    this.active.set(p.i, inst);
  }

  release(i) {
    const inst = this.active.get(i);
    if (!inst) return;
    this.scene.remove(inst.mesh);
    this.pool.get(inst.piece.piece).push(inst.mesh);
    if (inst.door) {
      this.scene.remove(inst.door.group);
      this.scene.remove(inst.door.sign.mesh);
      this.hits.remove(inst.door.proxy);
      inst.door.door = null;
      this.doorPool.push(inst.door);
    }
    if (inst.stencil) {
      this.scene.remove(inst.stencil.mesh);
      this.stencilPool.push(inst.stencil);
    }
    this.active.delete(i);
  }

  acquireDoor(door) {
    let d = this.doorPool.pop();
    if (!d) {
      const group = new THREE.Group();
      const leaf = this.kit.leaf.clone(true);
      const spill = this.kit.spill.clone(true);
      const underline = this.kit.underline.clone(true);
      const slit = new THREE.Mesh(this.slitGeo, this.slitMat);
      const back = new THREE.Mesh(this.backGeo, this.backMat);
      slit.renderOrder = 3;
      back.renderOrder = 3;
      group.add(leaf, spill, underline, slit, back);
      const sign = new TextPlane({ w: C.signW, h: C.signH, style: 'sign', pxPerM: 900 });
      this.bag.push(sign);
      const proxy = new THREE.Mesh(this.proxyGeo, this.proxyMat);
      d = { group, leaf, spill, underline, slit, back, sign, proxy, painted: null };
      proxy.userData.inst = d;
    }
    d.door = door;
    const g = d.group;
    const side = door.side;
    if (side === 'end') {
      g.position.set(-DOOR.w / 2, 0, door.z + 0.005);
      g.rotation.set(0, -Math.PI / 2, 0);
      g.scale.set(1, 1, 1);
    } else {
      g.position.set((side === 'l' ? -1 : 1) * (C.width / 2 + 0.03), 0, door.z + DOOR.w / 2);
      g.rotation.set(0, 0, 0);
      g.scale.set(side === 'l' ? 1 : -1, 1, 1);
    }
    this.scene.add(g);
    const c = this.signCentre(door);
    const n = side === 'end' ? [0, 0, 1] : side === 'l' ? [1, 0, 0] : [-1, 0, 0];
    d.sign.place(c, n, [0, 1, 0], 0.02); // just proud of the kit's plaque (its face is 16 mm off the wall)
    this.scene.add(d.sign.mesh);
    if (side === 'end') {
      d.proxy.position.set(0, 1.35, door.z + 0.18);
      d.proxy.rotation.set(0, Math.PI / 2, 0);
    } else {
      d.proxy.position.set((side === 'l' ? -1 : 1) * (C.width / 2 - 0.18), 1.35, door.z);
      d.proxy.rotation.set(0, 0, 0);
    }
    this.hits.add(d.proxy);
    d.painted = null;
    this.paintDoor(d);
    return d;
  }

  signCentre(door) {
    if (door.side === 'end') return [0, C.signY, door.z];
    return [(door.side === 'l' ? -1 : 1) * (C.width / 2), C.signY, door.z];
  }

  /** The door's look from its state (ajar / shut-lit / shut-dark, or shut since he woke here) and its sign. */
  paintDoor(d) {
    const door = d.door;
    const open = this.isOpen(door);
    d.leaf.rotation.y = open ? AJAR : 0;
    d.leaf.visible = door.side !== 'end'; // the end door's leaf is baked into K_end_door
    d.spill.visible = open;
    d.slit.visible = open;
    d.back.visible = open;
    d.underline.visible = door.state === 'shut-lit';
    const dark = door.state === 'shut-dark';
    d.leaf.traverse((o) => {
      if (!o.isMesh) return;
      if (!o.userData.baseMat) o.userData.baseMat = o.material;
      if (dark) {
        let m = this.darkLeafMats.get(o.userData.baseMat);
        if (!m) {
          m = o.userData.baseMat.clone();
          m.color.multiplyScalar(0.45);
          this.darkLeafMats.set(o.userData.baseMat, m);
          this.bag.push(m);
        }
        o.material = m;
      } else {
        let m = this.liteLeafMats.get(o.userData.baseMat);
        if (!m) {
          m = o.userData.baseMat.clone();
          m.color.setRGB(1.55, 1.42, 1.28);
          this.liteLeafMats.set(o.userData.baseMat, m);
          this.bag.push(m);
        }
        o.material = m;
      }
    });
    const st = this.swapState.get(door.id);
    const wrong = st && st.fired !== null && !st.reverted;
    const lines = wrong ? [this.swaps.get(door.id).to, ...door.sign.slice(1)] : door.sign;
    const plate = this.kitSource !== 'glb'; // the baked kit has its own dark plaque to letter onto
    const key = `${lines.join('\n')}|${dark}|${wrong}|${plate}`;
    if (d.painted !== key) {
      d.sign.paint(lines, { style: 'sign', dim: dark, wrong, plate });
      d.painted = key;
    }
  }

  acquireStencil(b, p) {
    let s = this.stencilPool.pop();
    if (!s) {
      s = new TextPlane({ w: 1.9, h: 0.42, style: 'stencil', pxPerM: 520 });
      this.bag.push(s);
    }
    // the night's date is set into the floor of the bay, reading the right way up as you walk deeper:
    // a wall stencil read as floating UI and the corridor's corner hid half of it from the entrance
    const st = this.bay.stencil;
    s.place([0, 0, p.z + (st.z ?? -C.break.length / 2)], [0, 1, 0], [0, 0, -1], 0.004);
    if (s.text !== b.label) s.paint(b.label, { style: 'stencil' });
    this.scene.add(s.mesh);
    return s;
  }

  /* ── running ─────────────────────────────────────────────────────────── */
  async start() {
    this.setState('loading');
    try {
      await this.loadKit();
    } catch (err) {
      console.error('[dream-rooms] corridor failed', err?.message || err);
      this.setState('error');
      return;
    }
    if (this.disposed) return;
    this.build(this.rows);
    const S = this.S;
    const w = S.walker;
    const sp = this.world.spawn;
    const mod = this.world.modules[0];
    w.x = mod.origin[0] + sp.at[0];
    w.z = mod.origin[2] + sp.at[2];
    w.yaw = { n: 0, w: Math.PI / 2, s: Math.PI, e: -Math.PI / 2 }[sp.facing] ?? 0;
    w.pitch = 0;
    w.v = 0;
    w.turnV = 0;
    w.hold = 0;
    if (this.atProp && this.world.doors.some((d) => d.dream === this.atProp)) {
      this.atId = this.atProp;
      // a step back from the door, so it's in front of him rather than in his face
      const d = this.world.doors.find((x) => x.dream === this.atProp);
      if (d.side !== 'end') w.x = (d.side === 'l' ? 1 : -1) * 0.7;
      w.pitch = 0.1;
    }
    this.stream(true);
    S.syncCamera();
    S.fx.white = 0;
    S.fx.whiteGrain = 0;
    S.fx.black = 1;
    S.tween('black', 0, 1.6);
    startDreamAudio(this.world.sound);
    this.entryGrace = S.time + 3;
    this.setState('corridor');
    if (this.enterProp) {
      const d = this.world.doors.find((x) => x.dream === this.enterProp);
      if (d) this.go(d, this.isOpen(d) ? 'enter' : 'goto');
    }
  }

  acceptsLook() {
    return (this.state === 'corridor' || this.state === 'entering') && (!this.auto || this.auto.phase === 'approach');
  }

  update(dt) {
    if (this.disposed || !this.world || !this.kit) {
      this.S.syncCamera();
      return;
    }
    const S = this.S;
    const w = S.walker;
    let drive = { forward: 0, turn: 0 };
    let collide = (from, dx, dz) => slide(this, from, dx, dz);
    if (this.state === 'corridor' || this.state === 'entering') {
      const user = S.controls.drive();
      if (this.auto && this.auto.phase !== 'through' && (user.forward || user.turn)) {
        // his hands win (until he's in the doorway)
        this.auto = null;
        if (this.state === 'entering') this.setState('corridor');
      }
      if (this.auto) {
        drive = this.autoDrive(dt);
        if (this.auto?.phase === 'through') collide = (from, dx, dz) => ({ x: from.x + dx, z: from.z + dz });
      } else if (this.state === 'corridor') drive = user;
    }
    stepWalker(w, dt, drive, collide, { speed: baseSpeed(null), longHold: !this.auto && S.time > this.entryGrace });
    // walking into an ajar doorway by hand enters it
    if (this.state === 'corridor' && !this.auto) {
      const d = this.doorNear(w.z, 0.4);
      if (d && d.side !== 'end' && this.isOpen(d) && Math.abs(w.x) > C.width / 2 - 0.12 && (d.side === 'l' ? w.x < 0 : w.x > 0)) this.go(d, 'enter');
    }
    this.stream();
    S.syncCamera();
    this.updateSwaps();
  }

  /* ── tapping a sign, auto-drift, going through ───────────────────────── */
  enterById(id) {
    const d = this.world?.doors.find((x) => x.dream === id);
    if (!d || this.state !== 'corridor') return false;
    this.go(d, this.isOpen(d) ? 'enter' : 'goto');
    return this.isOpen(d);
  }

  go(door, kind) {
    const w = this.S.walker;
    this.auto = { kind, door, phase: 'approach', t: 0, dist0: Math.abs(door.z - w.z) + Math.abs(w.x) };
    if (kind === 'enter') this.setState('entering');
  }

  autoDrive(dt) {
    const a = this.auto;
    const w = this.S.walker;
    const door = a.door;
    a.t += dt;
    if (a.phase === 'approach') {
      const target = door.side === 'end' ? { x: 0, z: door.z + 1.3 } : { x: 0, z: door.z };
      const dist = Math.hypot(target.x - w.x, target.z - w.z);
      if (dist > 0.12) {
        // a long corridor never means a long walk: ease up to 2× on a long drift, slow into the stop
        const ramp = a.dist0 > 6 ? 1 + Math.min(1, Math.max(0, a.t - 1.2) / 2.5) : 1;
        const mul = Math.min(ramp, 0.35 + dist / 2.2);
        return { forward: 1, yawTarget: yawTo(w, target), speedMul: mul };
      }
      a.phase = 'turn';
    }
    const face = door.side === 'end' ? 0 : door.side === 'l' ? Math.PI / 2 : -Math.PI / 2;
    if (a.phase === 'turn') {
      if (Math.abs(wrapAngle(face - w.yaw)) > 0.06 || Math.abs(w.v) > 0.05) return { forward: 0, yawTarget: face };
      if (a.kind === 'goto') {
        this.auto = null;
        return { forward: 0 };
      }
      a.phase = 'through';
      const sx = door.side === 'l' ? -1 : 1;
      const side = door.side === 'l' ? 1 : -1; // leg 2 runs +z behind a left door, −z behind a right one
      const hw = C.width / 2;
      a.pts = door.side === 'end'
        ? [{ x: 0, z: door.z }, { x: 0, z: door.z - 0.9 }]
        : [{ x: sx * hw, z: door.z }, { x: sx * (hw + STUB.leg1), z: door.z }, { x: sx * (hw + STUB.leg1), z: door.z + side * 0.8 }];
      this.enterSequence(door);
    }
    // through the opening into its stub
    while (a.pts.length > 1 && Math.hypot(a.pts[0].x - w.x, a.pts[0].z - w.z) < 0.18) a.pts.shift();
    const p = a.pts[0];
    const left = Math.hypot(p.x - w.x, p.z - w.z);
    if (a.pts.length === 1 && left < 0.15) return { forward: 0, yawTarget: w.yaw };
    return { forward: 0.75, yawTarget: yawTo(w, p) };
  }

  async enterSequence(door) {
    const S = this.S;
    this.setState('entering');
    this.atId = null;
    const loader = S.getProps().loadDream;
    let data = null;
    let failed = null;
    let done = false;
    Promise.resolve()
      .then(() => (loader ? loader(door.dream) : Promise.reject(new Error('no loadDream'))))
      .then((d) => {
        data = d;
      })
      .catch((e) => {
        failed = e;
      })
      .finally(() => {
        done = true;
      });
    await S.tween('white', 1, 1.9);
    // hold the white while it loads; only a faint grain if that takes a while
    const t0 = S.time;
    let grain = false;
    while (!done && !this.disposed) {
      await S.wait(0.1);
      if (!grain && S.time - t0 > 3) {
        grain = true;
        S.tween('whiteGrain', 0.035, 1.2);
      }
    }
    if (this.disposed) return;
    if (failed || !data?.world) {
      console.warn('[dream-rooms] could not open a dream', door.dream, failed?.message || 'no world');
      S.tween('whiteGrain', 0, 0.3);
      this.auto = null;
      const w = S.walker;
      w.x = door.side === 'end' ? 0 : (door.side === 'l' ? 1 : -1) * 0.3;
      w.z = door.side === 'end' ? door.z + 1.3 : door.z;
      await S.tween('white', 0, 1.6);
      this.setState('corridor');
      return;
    }
    const Runner = data.world.fallback === 'still' ? StillsRunner : DreamRunner;
    const runner = new Runner(S, {
      id: door.dream,
      world: data.world,
      modelUrl: data.model_url || null,
      stills: data.stills || [],
      mood: data.mood || null,
      autopilot: this.autopilot,
      entry: 'white',
      onState: (st) => {
        if (st === 'waking') this.setState('waking');
      },
      onWoken: () => this.wakeBack(door),
    });
    this.auto = null;
    S.dream = runner;
    S.runner = runner;
    this.setState('dream');
    await runner.start();
    S.tween('whiteGrain', 0, 0.5);
  }

  /** His line has been read on the white: clear back into the corridor at that door, facing it, now shut. */
  async wakeBack(door) {
    const S = this.S;
    this.setState('waking');
    S.hideLine();
    await S.wait(1.4);
    if (this.disposed) return;
    S.dream?.dispose();
    S.dream = null;
    S.runner = this;
    this.wokeShut.add(door.id);
    const w = S.walker;
    // across the corridor from it, so the door and its sign are both in view
    w.x = door.side === 'end' ? 0 : (door.side === 'l' ? 1 : -1) * 0.7;
    w.z = door.side === 'end' ? door.z + 1.8 : door.z;
    w.yaw = door.side === 'end' ? 0 : door.side === 'l' ? Math.PI / 2 : -Math.PI / 2;
    w.pitch = 0.1;
    w.v = 0;
    w.turnV = 0;
    w.hold = 0;
    this.stream(true);
    for (const inst of this.active.values()) if (inst.door) this.paintDoor(inst.door);
    this.atId = door.dream;
    replaceAt(door.dream);
    S.getProps().onAt?.(door.dream);
    S.fx.black = 0;
    startDreamAudio(this.world.sound);
    this.entryGrace = S.time + 4;
    S.syncCamera();
    await S.tween('white', 0, 2.6);
    if (this.state === 'waking') this.setState('corridor');
  }

  /* ── small changes while unseen (a sign that reads wrong for a moment; a door that opens again) ── */
  updateSwaps() {
    const S = this.S;
    const now = S.time;
    const w = S.walker;
    for (const inst of this.active.values()) {
      const d = inst.door;
      if (!d?.door) continue;
      const door = d.door;
      const sw = this.swaps.get(door.id);
      const shut = this.wokeShut.has(door.id);
      if (!sw && !shut) continue;
      const c = this.signCentre(door);
      const seen = S.seen(new THREE.Sphere(new THREE.Vector3(c[0], 1.4, c[2]), 1.0));
      if (sw) {
        let st = this.swapState.get(door.id);
        if (!st) {
          st = { since: null, fired: null, reverted: false };
          this.swapState.set(door.id, st);
        }
        if (seen) st.since = null;
        else if (st.since === null) st.since = now;
        const unseen = st.since === null ? 0 : now - st.since;
        if (st.fired === null && unseen >= UNSEEN && Math.abs(door.z - w.z) < 30) {
          st.fired = now;
          this.paintDoor(d);
        } else if (st.fired !== null && !st.reverted && now - st.fired >= (sw.revert || 18) && unseen >= UNSEEN) {
          st.reverted = true;
          this.paintDoor(d);
        }
      }
      if (shut) {
        const key = `shut:${door.id}`;
        let st = this.swapState.get(key);
        if (!st) {
          st = { since: null };
          this.swapState.set(key, st);
        }
        if (seen || Math.abs(door.z - w.z) < 5) st.since = null;
        else if (st.since === null) st.since = now;
        if (st.since !== null && now - st.since >= UNSEEN) {
          this.wokeShut.delete(door.id);
          this.swapState.delete(key);
          this.paintDoor(d);
        }
      }
    }
  }

  signScreen(id) {
    const door = this.world?.doors.find((x) => x.dream === id);
    if (!door) return null;
    const streamed = [...this.active.values()].some((i) => i.door?.door === door);
    if (!streamed) return null;
    const c = this.signCentre(door);
    const n = door.side === 'end' ? [0, 0, 0.02] : [door.side === 'l' ? 0.02 : -0.02, 0, 0];
    return this.S.toScreen([c[0] + n[0], c[1], c[2] + n[2]]);
  }

  onTap(x, y) {
    if (this.state !== 'corridor') return;
    const S = this.S;
    const ray = S.rayFrom(x, y);
    this.hits.updateMatrixWorld(true);
    const hits = ray.intersectObjects(this.hits.children, false);
    let best = null;
    let bd = Infinity;
    const w = S.walker;
    for (const h of hits) {
      const d = h.object.userData.inst;
      if (!d?.door) continue;
      const sp = this.signScreen(d.door.dream) || (d.door.side === 'end' ? S.toScreen(this.signCentre(d.door)) : null);
      const score = sp ? Math.hypot(sp.x - x, sp.y - y) : 1e4 + h.distance;
      if (score < bd) {
        bd = score;
        best = d.door;
      }
    }
    if (!best) {
      // a finger is wide: a sign within ~36 px of the tap counts, if it's near enough to read
      for (const inst of this.active.values()) {
        const door = inst.door?.door;
        if (!door || Math.abs(door.z - w.z) > 18) continue;
        const sp = S.toScreen(this.signCentre(door));
        if (!sp) continue;
        const dd = Math.hypot(sp.x - x, sp.y - y);
        if (dd < 36 && dd < bd) {
          bd = dd;
          best = door;
        }
      }
    }
    if (best && best.dream) this.go(best, this.isOpen(best) ? 'enter' : 'goto');
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    for (const i of [...this.active.keys()]) this.release(i);
    for (const x of this.bag) x.dispose?.();
    this.bag = [];
    if (this.kit) {
      for (const k of Object.keys(this.kit)) disposeTree(this.kit[k]);
    }
    if (this.kitRoot) disposeTree(this.kitRoot);
    if (this.greyRoot && this.greyRoot !== this.kitRoot) disposeTree(this.greyRoot);
    this.scene?.clear();
  }
}

/** After a wake: the address becomes /dreams?at=<id> (in the dev harness, just its `at` param). */
function replaceAt(id) {
  try {
    const url = new URL(window.location.href);
    if (url.pathname.startsWith('/dreams')) {
      window.history.replaceState(window.history.state, '', `/dreams?at=${encodeURIComponent(id)}`);
    } else {
      url.searchParams.set('at', id);
      url.searchParams.delete('enter');
      window.history.replaceState(window.history.state, '', url.toString());
    }
  } catch {
    /* ignore */
  }
}
