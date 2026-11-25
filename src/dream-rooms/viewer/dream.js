/* Dream Rooms · one dream, walked (CONTRACTS.md §4–§6, build-prompt decisions 5–8).

     const r = new DreamRunner(stage, { id, world, modelUrl, stills, mood, autopilot, entry, onState, onWoken })
     r.start()       loads (GLB or grey box), then black → fade in (entry 'black'), or clears from white (entry 'white')
     r.update(dt)    every frame, from the stage
     r.dispose()

   Modules sit 200 m apart in one GLB. Doorways lead into Z-stubs; crossing a stub's
   jump plane applies the link's rigid map (teleport/walk). A dissolve whitens the
   frame, jumps at the peak and clears. A repeat module is copies of one segment
   along −z with the walker wrapped by ±d, each copy showing a "logical segment" whose
   small changes (a sign, a tube, his words) are its own. Swaps and words only ever
   change while unseen. Debug hook: window.__dream (ids, states and numbers only). */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DIMS, FACING_YAW, doorwayFrame, linkTransform, inLeg2, pastJump, stubFootprint, moduleById } from '../contracts/layout.js';
import { greyboxDream } from './greybox.js';
import { toBasic, waterMaterial, disposeTree } from './materials.js';
import { buildGrid, slide, nearestWalkable } from './grid.js';
import { TextPlane, silhouetteTexture } from './text.js';
import { startDreamAudio, startVoice, setListener, stop as stopAudio } from './audio.js';
import { stepWalker, baseSpeed, yawTo } from './walker.js';
import { Autopilot } from './autopilot.js';

const UNSEEN = DIMS.unseen.seconds;
const MAX_GRIDS = 2;

function hash(...parts) {
  let h = 2166136261;
  const s = parts.join('|');
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const mod3 = (n) => ((n % 3) + 3) % 3;

export class DreamRunner {
  constructor(S, opts) {
    this.S = S;
    this.id = opts.id;
    this.world = opts.world;
    this.modelUrl = opts.modelUrl || null;
    this.mood = opts.mood || null;
    this.autopilotOn = !!opts.autopilot;
    this.entry = opts.entry || 'black';
    this.onState = opts.onState || (() => {});
    this.onWoken = opts.onWoken || (() => {});
    this.state = 'loading';
    this.scene = null;
    this.events = [];
    this.swapCount = 0;
    this.lap = 0;
    this.t0 = S.time;
    this.grids = new Map();
    this.disposed = false;
    this.voices = [];
    this.bag = []; // things to dispose: textures, materials, geometries, text planes, render targets
    this.hook();
  }

  /* ── debug hook (decision 14: ids, states and numbers only) ─────────── */
  hook() {
    const self = this;
    window.__dream = {
      get id() { return self.id; },
      get state() { return self.state; },
      get module() { return self.module || null; },
      get fps() { return self.S.fps; },
      get lap() { return self.lap; },
      get swaps() { return self.swapCount; },
      get events() { return self.events; },
      get white() { return Math.round(self.S.fx.white * 100) / 100; },
      get black() { return Math.round(self.S.fx.black * 100) / 100; },
      get line() { return self.S.lineShown; },
      get pos() { return [Math.round(self.S.walker.x * 100) / 100, Math.round(self.S.walker.z * 100) / 100]; },
      get grids() { return [...self.grids.keys()]; },
      get greybox() { return !!self.greybox; },
    };
  }

  event(type, extra = {}) {
    this.events.push({ t: Math.round((this.S.time - this.t0) * 10) / 10, type, ...extra });
    if (this.events.length > 400) this.events.shift();
  }

  setState(st) {
    if (this.state === st) return;
    this.state = st;
    this.onState(st);
  }

  acceptsLook() {
    return !this.autopilotOn && this.state !== 'loading' && this.state !== 'woken';
  }

  /* ── loading ────────────────────────────────────────────────────────── */
  async load() {
    let root = null;
    if (this.modelUrl) {
      try {
        const gltf = await new GLTFLoader().loadAsync(this.modelUrl);
        root = gltf.scene;
      } catch (err) {
        console.warn('[dream-rooms] model failed to load; using the grey box', this.id, err?.message || '');
      }
    }
    if (this.disposed) {
      if (root) disposeTree(root);
      return;
    }
    if (!root) {
      root = greyboxDream(this.world);
      this.greybox = true;
    }
    toBasic(root);
    this.root = root;
    this.build();
  }

  async start() {
    this.setState('loading');
    try {
      await this.load();
    } catch (err) {
      this.fail(err);
      return;
    }
    if (this.disposed) return;
    this.begin();
  }

  fail(err) {
    console.error('[dream-rooms] dream failed', this.id, err?.message || err);
    this.setState('error');
  }

  build() {
    const world = this.world;
    const fogColor = new THREE.Color(world.look?.fog?.color || '#8d887c');
    this.fogDensity = world.look?.fog?.density ?? 0.06;
    this.fogNow = this.fogDensity;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(fogColor, this.fogDensity);
    scene.background = fogColor.clone();
    this.scene = scene;
    this.speed = baseSpeed(this.mood);
    this.doorways = new Map((world.doorways || []).map((d) => [d.id, d]));

    this.mods = new Map();
    for (const m of world.modules) this.mods.set(m.id, this.buildModule(m));

    // links: departure doorway → its target frame and the rigid map
    this.departures = new Map();
    for (const l of world.links || []) {
      if (l.kind !== 'walk' && l.kind !== 'teleport') continue;
      const a = this.doorways.get(l.a);
      const b = this.doorways.get(l.b);
      if (!a || !b) continue;
      const fa = doorwayFrame(world, a);
      const fb = doorwayFrame(world, b);
      if (!this.departures.has(a.id)) this.departures.set(a.id, { link: l, from: fa, to: fb, T: linkTransform(fa, fb) });
      if (!l.oneway && !this.departures.has(b.id)) this.departures.set(b.id, { link: l, from: fb, to: fa, T: linkTransform(fb, fa) });
    }
    this.dissolves = (world.links || []).filter((l) => l.kind === 'dissolve' && this.mods.has(l.from) && this.mods.has(l.to));

    // swaps → resolved targets
    this.swaps = (world.swaps || []).map((s, si) => {
      const [mid, x] = String(s.target).split('/');
      const kind = x === 'doors-sign' ? 'signs' : x === 'tube' ? 'tube' : 'prop';
      return { si, def: s, module: mid, kind, prop: kind === 'prop' ? x : null };
    }).filter((s) => this.mods.has(s.module));
    this.swapState = new Map();
    // words → their surfaces
    this.words = (world.words || []).map((w, wi) => {
      const [mid, x] = String(w.on).split('/');
      return { wi, text: w.text, module: mid, surface: x };
    }).filter((w) => this.mods.has(w.module));
    this.wordState = new Map();
    // figures
    this.figures = (world.figures || []).filter((f) => this.mods.has(f.module)).map((f) => this.buildFigure(f));

    for (const mod of this.mods.values()) for (const c of mod.copies) this.renderCopy(mod, c);
  }

  buildModule(m) {
    const world = this.world;
    let M = this.root.getObjectByName(`M_${m.id}`);
    if (!M) {
      // the GLB lacks this module: grey-box just it
      const gb = greyboxDream({ ...world, modules: [m] });
      toBasic(gb);
      M = gb.getObjectByName(`M_${m.id}`);
      this.greyModules = (this.greyModules || 0) + 1;
    }
    M.removeFromParent();
    M.updateMatrixWorld(true);
    const [w, h, d] = m.size;
    const o = m.origin;
    const mod = {
      def: m,
      id: m.id,
      origin: o,
      size: m.size,
      d,
      repeat: !!m.repeat,
      src: M,
      copies: [],
      base: 0,
      timeIn: 0,
      moved: 0,
      visited: false,
      panels: [],
      waters: [],
      frames: (world.doorways || []).filter((dw) => dw.module === m.id).map((dw) => doorwayFrame(world, dw)),
      spheres: new Map(),
      propDefs: new Map((m.props || []).map((p) => [p.id, p])),
      centre: new THREE.Vector3(o[0] + w / 2, h / 2, o[2] + d / 2),
    };
    // the box with its stubs
    let minx = o[0];
    let maxx = o[0] + w;
    let minz = o[2];
    let maxz = o[2] + d;
    for (const f of mod.frames) {
      for (const q of stubFootprint(f)) {
        for (const [x, z] of q) {
          minx = Math.min(minx, x);
          maxx = Math.max(maxx, x);
          minz = Math.min(minz, z);
          maxz = Math.max(maxz, z);
        }
      }
    }
    mod.ext = { min: { x: minx - 0.3, z: minz - 0.3 }, max: { x: maxx + 0.3, z: maxz + 0.3 } };
    mod.arrival = this.arrivalPoint(mod);

    // fall-back text surfaces for words the GLB has no S_ node for
    const needed = new Set((world.words || []).filter((x) => x.on.startsWith(`${m.id}/`)).map((x) => x.on.split('/')[1]));
    for (const sid of needed) {
      if (sid === 'doors-sign') continue;
      if (M.getObjectByName(`S_${m.id}__${sid}`)) continue;
      const gb = greyboxDream({ ...world, modules: [m], words: [{ text: '', on: `${m.id}/${sid}` }] });
      const s = gb.getObjectByName(`S_${m.id}__${sid}`);
      if (s) {
        M.add(s);
        s.updateMatrixWorld(true);
      }
      disposeTree(gb);
    }

    // spheres (in the source frame; a copy adds its z offset)
    M.traverse((n) => {
      if (/^(P_|S_|F_|W_)/.test(n.name)) {
        const b = new THREE.Box3().setFromObject(n);
        if (!b.isEmpty()) {
          const s = new THREE.Sphere();
          b.getBoundingSphere(s);
          s.radius = Math.max(0.3, s.radius);
          mod.spheres.set(n.name, s);
        }
      }
    });

    const ks = mod.repeat ? [-2, -1, 0, 1, 2, 3] : [0];
    for (const k of ks) {
      const root = mod.repeat ? M.clone(true) : M;
      const offset = mod.repeat ? -k * d : 0;
      if (mod.repeat) root.position.z += offset;
      this.scene.add(root);
      root.updateMatrixWorld(true);
      mod.copies.push(this.buildCopy(mod, root, k, offset));
    }
    return mod;
  }

  /** Where the walker first stands in a module (for orienting floor text and placing absences). */
  arrivalPoint(mod) {
    const w = this.world;
    if (w.spawn?.module === mod.id) return new THREE.Vector3(mod.origin[0] + w.spawn.at[0], 0, mod.origin[2] + w.spawn.at[2]);
    const dis = (w.links || []).find((l) => l.kind === 'dissolve' && l.to === mod.id);
    if (dis?.at) return new THREE.Vector3(mod.origin[0] + dis.at[0], 0, mod.origin[2] + dis.at[2]);
    const inbound = (w.links || []).find((l) => (l.kind === 'walk' || l.kind === 'teleport') && mod.frames.some((f) => f.id === l.b));
    if (inbound) {
      const f = mod.frames.find((x) => x.id === inbound.b);
      return new THREE.Vector3(f.centre[0], 0, f.centre[2]);
    }
    return new THREE.Vector3(mod.origin[0] + mod.size[0] / 2, 0, mod.origin[2] + 0.5);
  }

  buildCopy(mod, root, k, offset) {
    const id = mod.id;
    const copy = { k, root, offset, props: new Map(), planes: new Map(), fixtures: [], waters: [] };
    const nodes = [];
    root.traverse((n) => nodes.push(n));
    for (const n of nodes) {
      const name = n.name || '';
      if (name.startsWith(`P_${id}__`)) {
        const pid = name.slice(`P_${id}__`.length);
        if (!mod.propDefs.has(pid) || copy.props.has(pid)) continue;
        // its own materials, so a retint here never touches the shell or another copy
        const mats = [];
        n.traverse((o) => {
          if (!o.isMesh) return;
          o.material = Array.isArray(o.material) ? o.material.map((x) => x.clone()) : o.material.clone();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((x) => {
            mats.push({ m: x, color: x.color.clone() });
            this.bag.push(x);
          });
        });
        copy.props.set(pid, { node: n, pos: n.position.clone(), mats, name });
      } else if (name.startsWith(`F_${id}__`)) {
        const mats = [];
        n.traverse((o) => {
          if (!o.isMesh) return;
          o.material = o.material.clone();
          this.bag.push(o.material);
          mats.push({ m: o.material, color: o.material.color.clone() });
        });
        if (mats.length) {
          const panel = { node: n, mats, name, out: false, flicker: 1, tint: null };
          copy.fixtures.push(panel);
          mod.panels.push(panel);
        }
      } else if (name === `W_${id}`) {
        copy.waters.push(n);
        mod.waters.push(n);
      }
    }
    // text surfaces (after props, so a prop's surface can follow its prop)
    for (const n of nodes) {
      const name = n.name || '';
      if (!name.startsWith(`S_${id}__`)) continue;
      const sid = name.slice(`S_${id}__`.length);
      if (copy.planes.has(sid)) continue;
      const plane = this.makePlane(mod, n, sid);
      if (!plane) continue;
      // a guide on water, the floor or a wall is only where the ink goes: the shell already has that surface
      if (sid === 'water' || sid === 'floor' || sid.startsWith('wall-')) n.visible = false;
      copy.planes.set(sid, { plane, node: n, name });
      this.scene.add(plane.mesh);
    }
    return copy;
  }

  makePlane(mod, node, sid) {
    let mesh = null;
    node.traverse((o) => {
      if (!mesh && o.isMesh) mesh = o;
    });
    if (!mesh) return null;
    mesh.updateWorldMatrix(true, false);
    const box = new THREE.Box3().setFromObject(mesh);
    const centre = box.getCenter(new THREE.Vector3());
    const pos = mesh.geometry.attributes.position;
    const idx = mesh.geometry.index;
    const v = (i) => new THREE.Vector3().fromBufferAttribute(pos, idx ? idx.getX(i) : i).applyMatrix4(mesh.matrixWorld);
    const a = v(0);
    const b = v(1);
    const c = v(2);
    const n = new THREE.Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    const size = box.getSize(new THREE.Vector3());
    let w = node.userData?.w || mesh.userData?.w;
    let h = node.userData?.h || mesh.userData?.h;
    let up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(n.y) > 0.7) {
      n.set(0, 1, 0);
      // lying flat: the text's "up" points away from where he arrives
      const e1 = b.clone().sub(a).setY(0);
      const e2 = c.clone().sub(b).setY(0);
      const wEdge = w && Math.abs(e1.length() - w) > Math.abs(e2.length() - w) ? e2 : e1;
      const right = wEdge.lengthSq() > 1e-6 ? wEdge.normalize() : new THREE.Vector3(1, 0, 0);
      up = new THREE.Vector3().crossVectors(n, right).normalize();
      const away = centre.clone().sub(mod.arrival).setY(0);
      if (up.dot(away) < 0) up.negate();
      if (!w) w = Math.max(size.x, size.z);
      if (!h) h = Math.min(size.x, size.z);
    } else {
      n.y = 0;
      n.normalize();
      const toward = new THREE.Vector3(mod.centre.x - centre.x, 0, mod.centre.z - centre.z);
      // a repeat corridor's long axis is z: face across it
      if (mod.repeat) toward.set(mod.centre.x - centre.x, 0, 0);
      if (n.dot(toward) < 0) n.negate();
      if (!w) w = Math.hypot(size.x, size.z);
      if (!h) h = size.y;
    }
    const prop = mod.propDefs.get(sid);
    let style = 'ink';
    if (sid.startsWith('doors-sign')) style = 'number';
    else if (sid === 'water' || prop?.kit === 'board' || prop?.kit === 'window-dark') style = 'ink-pale';
    const ppm = Math.min(700, 1024 / Math.max(0.2, w));
    const plane = new TextPlane({ w: w * 0.96, h: h * 0.96, style, pxPerM: ppm });
    plane.place([centre.x, centre.y, centre.z], [n.x, n.y, n.z], [up.x, up.y, up.z], 0.005);
    this.bag.push(plane);
    return plane;
  }

  /* ── figures: absences, never people ────────────────────────────────── */
  buildFigure(f) {
    const mod = this.mods.get(f.module);
    const fig = { def: f, mod, pos: new THREE.Vector3(), since: null, mesh: null, voice: null, opacity: 1 };
    // at the edge of the fog, but near enough to be glimpsed (a fresh review couldn't find her at 16 m)
    const keep = Math.max(7, Math.min(13, 0.75 / Math.max(0.03, this.fogDensity)));
    fig.keep = keep;
    if (f.as !== 'voice') {
      const tex = silhouetteTexture(f.as);
      const hgt = f.as === 'silhouette' ? 1.85 : f.as === 'coat' ? 1.25 : 1.35;
      const geo = new THREE.PlaneGeometry(hgt * 0.5, hgt);
      const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: true, opacity: 0.78 });
      fig.mesh = new THREE.Mesh(geo, mat);
      fig.mesh.userData.noCollide = true;
      fig.height = hgt;
      this.bag.push(tex, geo, mat);
      this.scene.add(fig.mesh);
      fig.mesh.visible = false;
    }
    // a coat stays where it is: against the wall furthest from where he arrives
    if (f.as === 'coat' || f.as === 'chair-coat' || f.keep === 'other-room') {
      const o = mod.origin;
      const [w, , d] = mod.size;
      const arr = mod.arrival;
      const cand = [
        new THREE.Vector3(o[0] + w / 2, 0, o[2] + 0.45),
        new THREE.Vector3(o[0] + w / 2, 0, o[2] + d - 0.45),
        new THREE.Vector3(o[0] + 0.45, 0, o[2] + d / 2),
        new THREE.Vector3(o[0] + w - 0.45, 0, o[2] + d / 2),
      ];
      cand.sort((a, b) => b.distanceTo(arr) - a.distanceTo(arr));
      fig.fixed = cand[0];
      if (f.as === 'voice' || (f.as === 'silhouette' && f.keep === 'other-room')) {
        // beyond that wall: a room you can't find
        const out = cand[0].clone().sub(mod.centre).setY(0).normalize().multiplyScalar(4);
        fig.fixed = cand[0].clone().add(out);
      }
      fig.pos.copy(fig.fixed);
    }
    return fig;
  }

  updateFigures(dt) {
    const w = this.S.walker;
    const here = new THREE.Vector3(w.x, 0, w.z);
    for (const fig of this.figures) {
      const active = fig.mod.id === this.module;
      if (fig.mesh) fig.mesh.visible = active && fig.opacity > 0.01 && !(fig.def.as === 'silhouette' && fig.def.keep === 'other-room');
      if (fig.voice) fig.voice.setPosition([fig.pos.x, 1.4, fig.pos.z]);
      if (!active) continue;
      if (fig.def.as === 'silhouette' && fig.def.keep !== 'other-room') this.moveSilhouette(fig, here, dt);
      else if (fig.def.as === 'voice' && fig.def.keep !== 'other-room') this.moveSilhouette(fig, here, dt);
      if (fig.mesh) {
        fig.mesh.position.set(fig.pos.x, fig.height / 2 + (fig.def.as === 'coat' ? 0.45 : 0), fig.pos.z);
        fig.mesh.rotation.set(0, Math.atan2(w.x - fig.pos.x, w.z - fig.pos.z), 0);
        fig.mesh.material.opacity = fig.opacity * (fig.def.as === 'silhouette' ? 0.72 : 0.9);
      }
    }
  }

  /** Hold at fog distance ahead; recede as he approaches; reappear ahead only while unseen. */
  moveSilhouette(fig, here, dt) {
    const mod = fig.mod;
    const w = this.S.walker;
    const sphere = new THREE.Sphere(new THREE.Vector3(fig.pos.x, 1, fig.pos.z), 0.8);
    const seen = fig.placed && this.S.seen(sphere);
    if (seen) fig.since = null;
    else if (fig.since === null) fig.since = this.S.time;
    const unseenFor = fig.since === null ? 0 : this.S.time - fig.since;
    const grid = this.grids.get(mod.id);
    const fx = -Math.sin(w.yaw);
    const fz = -Math.cos(w.yaw);
    if (mod.repeat) {
      const cx = mod.origin[0] + mod.size[0] * 0.62; // a little off the axis: not posed in the middle
      const dir = fz <= 0 ? -1 : 1;
      if (!fig.placed || unseenFor > UNSEEN) {
        fig.pos.set(cx, 0, here.z + dir * fig.keep);
        fig.placed = true;
      } else if (Math.abs(fig.pos.z - here.z) < fig.keep) {
        fig.pos.z = here.z + Math.sign(fig.pos.z - here.z || dir) * fig.keep;
      }
      fig.opacity = Math.min(1, fig.opacity + dt);
      return;
    }
    // a finite room: as far ahead as the room allows, up to fog distance
    const reach = (hx, hz) => {
      if (!grid) return fig.keep;
      let s = 1;
      for (; s < fig.keep; s += 0.25) if (!grid.walkable(here.x + hx * s, here.z + hz * s)) break;
      return s - 0.4;
    };
    if (!fig.placed || unseenFor > UNSEEN) {
      const r = reach(fx, fz);
      if (r > 6) {
        fig.pos.set(here.x + fx * r, 0, here.z + fz * r);
        fig.placed = true;
        fig.opacity = 1;
      } else if (!seen) fig.opacity = 0;
    } else {
      const dist = Math.hypot(fig.pos.x - here.x, fig.pos.z - here.z);
      if (dist < fig.keep * 0.85) {
        const hx = (fig.pos.x - here.x) / (dist || 1);
        const hz = (fig.pos.z - here.z) / (dist || 1);
        const want = Math.min(fig.keep * 0.85, reach(hx, hz));
        if (want > dist + 0.01) fig.pos.set(here.x + hx * want, 0, here.z + hz * want);
        // he's caught up with it and it can't go further: it thins into the haze
        if (dist < 6) fig.opacity = Math.max(0, fig.opacity - dt * 0.8);
      }
    }
  }

  /* ── the walk grid, one per module, at most two kept ────────────────── */
  gridFor(id) {
    if (this.grids.has(id)) {
      const g = this.grids.get(id);
      this.grids.delete(id);
      this.grids.set(id, g);
      return g;
    }
    const mod = this.mods.get(id);
    const t = performance.now();
    const src = new THREE.Group();
    const parts = mod.repeat ? [-mod.d, 0, mod.d] : [0];
    for (const dz of parts) {
      const c = mod.src.clone(true);
      c.position.z += dz;
      src.add(c);
    }
    const m = mod.def;
    const o = m.origin;
    const [w, , d] = m.size;
    const edge = m.walkable === 'edge-only' ? 1.6 : 0;
    const allow = edge
      ? (x, z) => {
          const inside = x > o[0] && x < o[0] + w && z > o[2] && z < o[2] + d;
          if (!inside) return true;
          return Math.min(x - o[0], o[0] + w - x, z - o[2], o[2] + d - z) <= edge;
        }
      : null;
    const starts = [];
    const sp = this.world.spawn;
    if (sp?.module === id) starts.push({ x: o[0] + sp.at[0], z: o[2] + sp.at[2] });
    for (const f of mod.frames) {
      starts.push({ x: f.centre[0] + f.inward[0] * 0.45, z: f.centre[2] + f.inward[2] * 0.45 });
      starts.push({ x: f.m[0], z: f.m[2] });
    }
    for (const l of this.dissolves || []) {
      if (l.to !== id) continue;
      if (l.at) starts.push({ x: o[0] + l.at[0], z: o[2] + l.at[2] });
    }
    if (!starts.length) starts.push({ x: mod.centre.x, z: mod.centre.z });
    const ext = mod.repeat ? { min: { x: mod.ext.min.x, z: o[2] - d }, max: { x: mod.ext.max.x, z: o[2] + 2 * d } } : mod.ext;
    const grid = buildGrid(src, {
      bounds: ext,
      starts,
      allow,
      wrap: mod.repeat ? { z0: o[2], d } : null,
      skip: (mesh) => {
        let n = mesh;
        while (n) {
          if (/^(S_|W_|F_|D_)/.test(n.name || '')) return true;
          n = n.parent;
        }
        return false;
      },
    });
    grid.ms = Math.round(performance.now() - t);
    this.grids.set(id, grid);
    while (this.grids.size > MAX_GRIDS) {
      const oldest = [...this.grids.keys()].find((k) => k !== this.module && k !== id);
      if (!oldest) break;
      this.grids.delete(oldest);
    }
    this.event('grid', { module: id, ms: grid.ms });
    return grid;
  }

  /* ── running ────────────────────────────────────────────────────────── */
  begin() {
    const sp = this.world.spawn;
    const mod = this.mods.get(sp.module) || [...this.mods.values()][0];
    const w = this.S.walker;
    w.x = mod.origin[0] + (sp.at?.[0] ?? mod.size[0] / 2);
    w.z = mod.origin[2] + (sp.at?.[2] ?? mod.size[2] / 2);
    w.yaw = FACING_YAW[sp.facing] ?? 0;
    w.pitch = 0;
    w.v = 0;
    w.turnV = 0;
    w.hold = 0;
    this.enterModule(mod.id, 'spawn');
    const g = this.gridFor(mod.id);
    if (!g.walkable(w.x, w.z)) {
      const p = nearestWalkable(g, w.x, w.z);
      w.x = p.x;
      w.z = p.z;
    }
    if (this.autopilotOn) this.autopilot = new Autopilot(this);
    this.S.syncCamera();
    this.S.hideLine();
    startDreamAudio(this.world.sound);
    this.started = this.S.time;
    if (this.entry === 'white') {
      this.S.fx.black = 0;
      this.S.fx.white = 1;
      this.setState('fading-in');
      this.S.tween('white', 0, 2.6).then(() => {
        if (this.state === 'fading-in') this.setState('walking');
      });
    } else {
      this.S.fx.white = 0;
      this.S.fx.black = 1;
      this.setState('black');
      this.S.wait(2).then(() => {
        if (this.disposed) return;
        this.setState('fading-in');
        this.S.tween('black', 0, 4).then(() => {
          if (this.state === 'fading-in') this.setState('walking');
        });
      });
    }
  }

  enterModule(id, via) {
    const mod = this.mods.get(id);
    this.module = id;
    mod.visited = true;
    mod.timeIn = 0;
    mod.moved = 0;
    this.event('module', { id, via });
    for (const fig of this.figures || []) {
      fig.placed = false;
      fig.since = null;
      if (fig.def.as === 'voice') {
        if (fig.mod.id === id && !fig.voice) fig.voice = startVoice([fig.pos.x, 1.4, fig.pos.z]);
        if (fig.mod.id !== id && fig.voice) {
          fig.voice.stop();
          fig.voice = null;
        }
      }
    }
    this.pendingReflect = mod.waters.length ? id : null;
  }

  /** The one live material: a cube map of the room, rendered once when he enters. */
  reflect(id) {
    const mod = this.mods.get(id);
    if (!mod.cube) {
      mod.cubeRT = new THREE.WebGLCubeRenderTarget(256);
      mod.cube = new THREE.CubeCamera(0.1, 80, mod.cubeRT);
      this.bag.push(mod.cubeRT);
      for (const wn of mod.waters) {
        wn.traverse((o) => {
          if (!o.isMesh) return;
          const old = o.material;
          o.material = waterMaterial(old.map, mod.cubeRT.texture, old.color);
          this.bag.push(o.material);
        });
      }
    }
    const wb = new THREE.Box3();
    for (const wn of mod.waters) wb.expandByObject(wn);
    const c = wb.isEmpty() ? mod.centre.clone() : wb.getCenter(new THREE.Vector3());
    mod.cube.position.set(c.x, (wb.isEmpty() ? 0 : wb.max.y) + 1.2, c.z);
    for (const wn of mod.waters) wn.visible = false;
    mod.cube.update(this.S.renderer, this.scene);
    for (const wn of mod.waters) wn.visible = true;
  }

  onRestored() {
    if (this.module && this.mods.get(this.module)?.waters.length) this.pendingReflect = this.module;
  }

  update(dt) {
    if (this.disposed || !this.scene || this.state === 'loading' || this.state === 'error') return;
    if (this.released) {
      this.S.syncCamera();
      return;
    }
    const S = this.S;
    const w = S.walker;
    if (this.pendingReflect) {
      const id = this.pendingReflect;
      this.pendingReflect = null;
      this.reflect(id);
    }
    const mod = this.mods.get(this.module);
    const canMove = this.state !== 'black' && this.state !== 'woken';
    let drive = { forward: 0, turn: 0 };
    if (canMove) drive = this.autopilot ? this.autopilot.drive(dt) : S.controls.drive();
    const grid = this.gridFor(mod.id);
    const prev = { x: w.x, z: w.z };
    const moved = stepWalker(w, dt, drive, (from, dx, dz) => slide(grid, from, dx, dz), { speed: this.speed });
    if (mod.repeat) this.wrap(mod, prev);
    mod.timeIn += dt;
    if (dt > 0 && moved / dt > 0.1) mod.moved += dt;

    if (this.state === 'walking' || this.state === 'fading-in' || this.state === 'teleporting') {
      this.checkTeleport(mod, prev);
    }
    this.checkPrebuild(this.mods.get(this.module));
    if (this.state === 'walking' || this.state === 'teleporting') {
      this.checkDissolve();
      this.checkWake();
    }

    // a touch more fog inside a stub, so the two stubs' small light difference never pops
    const cur = this.mods.get(this.module);
    const o = cur.origin;
    const inStub = w.x < o[0] || w.x > o[0] + cur.size[0] || (!cur.repeat && (w.z < o[2] || w.z > o[2] + cur.size[2]));
    const base = this.fogDensity * (inStub ? 1.3 : 1);
    this.fogNow += (base - this.fogNow) * (1 - Math.exp(-dt / 0.6));
    this.scene.fog.density = this.fogNow * (1 + S.fx.white * 1.5);

    S.syncCamera();
    this.updateSwaps();
    this.updateWords();
    this.updateFigures(dt);
    this.updateFlicker(dt);
    setListener([w.x, S.eye, w.z], w.yaw);
  }

  wrap(mod, prev) {
    const w = this.S.walker;
    const z0 = mod.origin[2];
    let shift = 0;
    while (w.z < z0) {
      w.z += mod.d;
      prev.z += mod.d;
      shift += mod.d;
      mod.base += 1;
      this.lap += 1;
    }
    while (w.z >= z0 + mod.d) {
      w.z -= mod.d;
      prev.z -= mod.d;
      shift -= mod.d;
      mod.base -= 1;
      this.lap += 1;
    }
    if (shift) {
      for (const fig of this.figures) if (fig.mod === mod) fig.pos.z += shift;
      this.autopilot?.onWrap(shift);
      for (const c of mod.copies) this.renderCopy(mod, c);
      this.event('lap', { lap: this.lap, seg: mod.base });
    }
  }

  checkTeleport(mod, prev) {
    const w = this.S.walker;
    const p = [w.x, 0, w.z];
    const pp = [prev.x, 0, prev.z];
    for (const f of mod.frames) {
      const dep = this.departures.get(f.id);
      if (!dep) continue;
      if (!inLeg2(f, p) || pastJump(f, pp) > 0 || pastJump(f, p) <= 0) continue;
      const np = dep.T.pos(p);
      w.x = np[0];
      w.z = np[2];
      w.yaw = dep.T.yaw(w.yaw);
      const target = this.mods.get(dep.to.module);
      if (target.repeat) {
        target.base = 0; // "back at the start of the same corridor"
        const z0 = target.origin[2];
        w.z = z0 + ((((w.z - z0) % target.d) + target.d) % target.d);
        for (const c of target.copies) this.renderCopy(target, c);
      }
      this.event('teleport', { from: dep.from.id, to: dep.to.id });
      if (dep.to.module !== mod.id) this.enterModule(dep.to.module, 'teleport');
      else this.event('loop', { module: mod.id });
      this.autopilot?.onJump();
      this.setState('teleporting');
      this.S.wait(0.6).then(() => {
        if (this.state === 'teleporting') this.setState('walking');
      });
      return true;
    }
    return false;
  }

  /** Build the far side's grid while he's still in leg 1 of a departure stub. */
  checkPrebuild(mod) {
    const w = this.S.walker;
    for (const f of mod.frames) {
      const dep = this.departures.get(f.id);
      if (!dep || this.grids.has(dep.to.module)) continue;
      const rx = w.x - f.centre[0];
      const rz = w.z - f.centre[2];
      const along = rx * f.out[0] + rz * f.out[2];
      const across = rx * f.side[0] + rz * f.side[2];
      if (along > -0.6 && along < 2.2 && Math.abs(across) < 1.4) this.gridFor(dep.to.module);
    }
  }

  checkDissolve() {
    if (this.dissolving) return;
    const mod = this.mods.get(this.module);
    const l = this.dissolves.find((x) => x.from === this.module && mod.moved >= x.after);
    if (!l) return;
    this.dissolve(l);
  }

  async dissolve(l) {
    this.dissolving = true;
    this.setState('dissolving');
    this.event('dissolve-start', { from: l.from, to: l.to });
    this.gridFor(l.to);
    await this.S.tween('white', 1, 3);
    if (this.disposed) return;
    const to = this.mods.get(l.to);
    const w = this.S.walker;
    const g = this.gridFor(to.id);
    let p;
    if (l.at) p = { x: to.origin[0] + l.at[0], z: to.origin[2] + l.at[2] };
    else if (this.world.spawn?.module === to.id) p = { x: to.origin[0] + this.world.spawn.at[0], z: to.origin[2] + this.world.spawn.at[2] };
    else p = { x: to.centre.x, z: to.centre.z };
    if (!g.walkable(p.x, p.z)) p = nearestWalkable(g, p.x, p.z);
    w.x = p.x;
    w.z = p.z;
    if (l.facing) w.yaw = FACING_YAW[l.facing];
    if (to.repeat) {
      to.base = 0;
      for (const c of to.copies) this.renderCopy(to, c);
    }
    this.mods.get(l.from).moved = 0;
    this.enterModule(to.id, 'dissolve');
    this.event('dissolve', { from: l.from, to: l.to });
    this.autopilot?.onJump();
    this.fogNow = this.fogDensity;
    await this.S.wait(0.35);
    await this.S.tween('white', 0, 2.5);
    this.dissolving = false;
    if (this.state === 'dissolving') this.setState('walking');
  }

  checkWake() {
    const wake = this.world.wake;
    if (!wake || this.waking || this.dissolving) return;
    if (this.module !== wake.after) return;
    const mod = this.mods.get(this.module);
    if (mod.moved < (wake.delay ?? 14)) return;
    this.wake();
  }

  async wake() {
    this.waking = true;
    this.setState('waking');
    this.event('wake');
    await this.S.tween('white', 1, 3);
    if (this.disposed) return;
    this.S.showLine(this.world.wake?.line || '');
    stopAudio();
    await this.S.wait(1.6 + 3.4);
    if (this.disposed) return;
    this.setState('woken');
    this.event('woken');
    // the dream's GLB, grids and textures go now; the white (and his line) stays on screen
    this.release();
    this.onWoken(this.id);
  }

  /* ── swaps (decision 6) ─────────────────────────────────────────────── */
  /** The concrete things a swap touches in one copy: [{ j, sphere }]. */
  swapSubs(sw, mod, copy, seg) {
    const out = [];
    const shift = (name) => {
      const s = mod.spheres.get(name);
      if (!s) return null;
      const c = s.clone();
      c.center.z += copy.offset;
      return c;
    };
    if (sw.kind === 'prop') {
      const s = shift(`P_${mod.id}__${sw.prop}`) || shift(`S_${mod.id}__${sw.prop}`);
      if (s) out.push({ j: 0, sphere: s });
    } else if (sw.kind === 'signs') {
      for (const [sid] of copy.planes) {
        if (!sid.startsWith('doors-sign-')) continue;
        const j = Number(sid.slice('doors-sign-'.length));
        if (mod.repeat && hash(seg, sw.si, j) % 3 !== 0) continue;
        const s = shift(`S_${mod.id}__${sid}`);
        if (s) out.push({ j, sphere: s });
      }
    } else if (sw.kind === 'tube' && copy.fixtures.length) {
      if (mod.repeat && hash(seg, sw.si, 't') % 2 !== 0) return out;
      const j = hash(seg, sw.si) % copy.fixtures.length;
      const s = shift(copy.fixtures[j].name);
      if (s) out.push({ j, sphere: s });
    }
    if (sw.kind === 'prop' && mod.repeat && hash(seg, sw.si, 'p') % 2 !== 0) return [];
    return out;
  }

  precondition(sw) {
    const a = sw.def.after;
    if (!a) return true;
    if (a.startsWith('visited:')) return !!this.mods.get(a.slice(8))?.visited;
    if (a.startsWith('time:')) {
      const mod = this.mods.get(sw.module);
      return this.module === sw.module && mod.timeIn >= Number(a.slice(5));
    }
    return true;
  }

  updateSwaps() {
    const now = this.S.time;
    for (const sw of this.swaps) {
      const mod = this.mods.get(sw.module);
      const ok = this.precondition(sw);
      for (const copy of mod.copies) {
        const seg = mod.repeat ? mod.base + copy.k : 0;
        for (const sub of this.swapSubs(sw, mod, copy, seg)) {
          const key = `${sw.si}:${seg}:${sub.j}`;
          let st = this.swapState.get(key);
          if (!st) {
            st = { since: null, fired: null, reverted: false };
            this.swapState.set(key, st);
          }
          if (this.S.seen(sub.sphere)) st.since = null;
          else if (st.since === null) st.since = now;
          const unseenFor = st.since === null ? 0 : now - st.since;
          if (st.fired === null && ok && unseenFor >= UNSEEN) {
            st.fired = now;
            this.swapCount += 1;
            this.event('swap', { target: sw.def.target, action: sw.def.action, seg });
            this.renderCopy(mod, copy);
          } else if (st.fired !== null && !st.reverted && sw.def.revert && now - st.fired >= sw.def.revert && unseenFor >= UNSEEN) {
            st.reverted = true;
            this.event('revert', { target: sw.def.target, seg });
            this.renderCopy(mod, copy);
          }
        }
      }
    }
  }

  /* ── words (painted only while unseen; they start blank) ────────────── */
  wordSubs(word, mod, copy, seg) {
    if (word.surface === 'doors-sign') {
      if (mod.repeat && mod3(seg) !== 1) return [];
      const signs = [...copy.planes.keys()].filter((k) => k.startsWith('doors-sign-'));
      if (!signs.length) return [];
      return [signs[Math.abs(seg) % signs.length]];
    }
    if (mod.repeat && mod3(seg) !== 1) return [];
    return copy.planes.has(word.surface) ? [word.surface] : [];
  }

  updateWords() {
    const now = this.S.time;
    for (const word of this.words) {
      const mod = this.mods.get(word.module);
      for (const copy of mod.copies) {
        const seg = mod.repeat ? mod.base + copy.k : 0;
        for (const sid of this.wordSubs(word, mod, copy, seg)) {
          const key = `${word.wi}:${seg}:${sid}`;
          let st = this.wordState.get(key);
          if (!st) {
            st = { since: null, painted: false };
            this.wordState.set(key, st);
          }
          if (st.painted) continue;
          const s = mod.spheres.get(`S_${mod.id}__${sid}`);
          if (!s) continue;
          const sp = s.clone();
          sp.center.z += copy.offset;
          if (this.S.seen(sp)) st.since = null;
          else if (st.since === null) st.since = now;
          if (st.since !== null && now - st.since >= UNSEEN) {
            st.painted = true;
            this.event('word', { on: `${word.module}/${sid}`, seg });
            this.renderCopy(mod, copy);
          }
        }
      }
    }
  }

  /** Everything a copy shows, worked out from the logical segment's state (cheap; on change only). */
  renderCopy(mod, copy) {
    const seg = mod.repeat ? mod.base + copy.k : 0;
    const m = mod.def;
    // text per plane: the number / the prop's own text, then his words, then a relabel
    const text = new Map();
    const tint = new Map();
    const hidden = new Set();
    for (const [sid] of copy.planes) {
      if (sid.startsWith('doors-sign-')) text.set(sid, m.doors?.sign || '');
      else text.set(sid, mod.propDefs.get(sid)?.text || '');
    }
    for (const word of this.words || []) {
      if (word.module !== mod.id) continue;
      for (const sid of this.wordSubs(word, mod, copy, seg)) {
        if (this.wordState.get(`${word.wi}:${seg}:${sid}`)?.painted) text.set(sid, word.text);
      }
    }
    const propState = new Map();
    for (const sw of this.swaps || []) {
      if (sw.module !== mod.id) continue;
      const subs = this.swapSubs(sw, mod, copy, seg);
      const isOn = (j) => {
        const st = this.swapState.get(`${sw.si}:${seg}:${j}`);
        return st && st.fired !== null && !st.reverted;
      };
      const { action, to } = sw.def;
      if (sw.kind === 'prop') {
        const on = subs.length ? isOn(0) : false;
        const st = propState.get(sw.prop) || { visible: true, move: null, tint: null };
        if (action === 'show') st.visible = on;
        if (action === 'hide' && on) st.visible = false;
        if (action === 'move' && on && Array.isArray(to)) st.move = to;
        if (action === 'retint' && on) st.tint = to;
        if (action === 'relabel' && on) text.set(sw.prop, String(to ?? ''));
        propState.set(sw.prop, st);
      } else if (sw.kind === 'signs') {
        // `show` targets start hidden in every copy, then appear one by one
        for (const [sid] of copy.planes) {
          if (!sid.startsWith('doors-sign-')) continue;
          const j = Number(sid.slice('doors-sign-'.length));
          const on = subs.some((s) => s.j === j) && isOn(j);
          if (action === 'relabel' && on) text.set(sid, String(to ?? ''));
          if (action === 'hide' && on) hidden.add(sid);
          if (action === 'show' && !on) hidden.add(sid);
          if (action === 'retint' && on) tint.set(sid, to);
        }
      } else if (sw.kind === 'tube') {
        copy.fixtures.forEach((p, j) => {
          const on = subs.some((s) => s.j === j) && isOn(j);
          p.out = (action === 'hide' && on) || (action === 'show' && !on);
          p.tint = action === 'retint' && on ? to : null;
        });
      }
    }
    for (const [pid, p] of copy.props) {
      const st = propState.get(pid) || { visible: true, move: null, tint: null };
      p.node.visible = st.visible;
      if (st.move) {
        const target = new THREE.Vector3(mod.origin[0] + st.move[0], mod.origin[1] + st.move[1], mod.origin[2] + st.move[2] + copy.offset);
        p.node.parent?.worldToLocal(target);
        p.node.position.copy(target);
      } else p.node.position.copy(p.pos);
      for (const { m: mat, color } of p.mats) {
        if (st.tint) {
          const c = new THREE.Color(st.tint);
          const k = Math.max(c.r, c.g, c.b, 1e-3);
          mat.color.copy(c.multiplyScalar(1 / k));
        } else mat.color.copy(color);
      }
      const plane = copy.planes.get(pid);
      if (plane) plane.plane.mesh.visible = st.visible;
    }
    for (const [sid, { plane, node }] of copy.planes) {
      const want = text.get(sid) || '';
      if (want !== (plane.text || '')) {
        if (want) plane.paint(want);
        else plane.clear();
      }
      if (sid.startsWith('doors-sign-')) {
        plane.mesh.visible = !hidden.has(sid);
        node.visible = !hidden.has(sid);
        plane.tint(tint.get(sid) || null);
      }
    }
    for (const p of copy.fixtures) this.paintPanel(p);
  }

  paintPanel(p) {
    const k = (p.out ? 0.12 : 1) * p.flicker;
    for (const { m, color } of p.mats) {
      if (p.tint) m.color.set(p.tint).multiplyScalar(k);
      else m.color.copy(color).multiplyScalar(k);
    }
  }

  /** The odd tube flickers now and then (only when the dream has panels). */
  updateFlicker() {
    const mod = this.mods.get(this.module);
    if (!mod.panels.length) return;
    const now = this.S.time;
    if (!this.flick) this.flick = { next: now + 5 + Math.random() * 6, until: 0, panel: null };
    const f = this.flick;
    if (!f.panel && now > f.next) {
      const w = this.S.walker;
      const near = mod.panels.filter((p) => {
        const s = mod.spheres.get(p.name);
        if (!s) return false;
        const copy = mod.copies.find((c) => c.fixtures.includes(p));
        return Math.hypot(s.center.x - w.x, s.center.z + (copy?.offset || 0) - w.z) < 18;
      });
      f.panel = near.length ? near[Math.floor(Math.random() * near.length)] : null;
      f.until = now + 0.5 + Math.random() * 0.5;
      f.next = now + 7 + Math.random() * 8;
    }
    if (f.panel) {
      if (now > f.until) {
        f.panel.flicker = 1;
        this.paintPanel(f.panel);
        f.panel = null;
      } else {
        f.panel.flicker = Math.random() > 0.45 ? 1 : 0.32;
        this.paintPanel(f.panel);
      }
    }
  }

  /* ── leaving ────────────────────────────────────────────────────────── */
  release() {
    if (this.released) return;
    this.released = true;
    for (const fig of this.figures || []) fig.voice?.stop();
    const scene = this.scene;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0.96, 0.95, 0.92);
    if (scene) {
      for (const mod of this.mods?.values() || []) {
        for (const c of mod.copies) {
          if (c.root !== mod.src) scene.remove(c.root);
        }
        disposeTree(mod.src);
      }
      for (const x of this.bag) x.dispose?.();
      this.bag = [];
      if (this.root) disposeTree(this.root);
      scene.clear();
    }
    this.grids.clear();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.release();
  }
}

/* ── the still fallback: stills + his words + sound, then the wake ──────── */

export class StillsRunner {
  constructor(S, opts) {
    this.S = S;
    this.id = opts.id;
    this.world = opts.world || {};
    this.stills = opts.stills || [];
    this.onState = opts.onState || (() => {});
    this.onWoken = opts.onWoken || (() => {});
    this.entry = opts.entry || 'black';
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(this.world.look?.fog?.color || '#1a1816');
    this.state = 'loading';
    this.events = [];
    const self = this;
    window.__dream = {
      get id() { return self.id; },
      get state() { return self.state; },
      module: null,
      get fps() { return self.S.fps; },
      lap: 0,
      swaps: 0,
      get events() { return self.events; },
      get white() { return self.S.fx.white; },
      get line() { return self.S.lineShown; },
      still: true,
    };
  }

  setState(st) {
    this.state = st;
    this.events.push({ t: Math.round(this.S.time * 10) / 10, type: 'state', state: st });
    this.onState(st);
  }

  acceptsLook() {
    return false;
  }

  async start() {
    const S = this.S;
    const el = S.stillsEl;
    el.replaceChildren();
    el.classList.add('is-on');
    const words = (this.world.words || []).map((w) => w.text);
    const frames = this.stills.length ? this.stills : [{ name: 'none', url: null }];
    const nodes = frames.map((s, i) => {
      const fig = document.createElement('figure');
      fig.className = 'dr-stage__still';
      if (s.url) {
        const img = document.createElement('img');
        img.src = s.url;
        img.alt = '';
        img.decoding = 'async';
        fig.appendChild(img);
      }
      if (words[i % Math.max(1, words.length)]) {
        const cap = document.createElement('figcaption');
        cap.textContent = words[i % words.length];
        fig.appendChild(cap);
      }
      el.appendChild(fig);
      return fig;
    });
    startDreamAudio(this.world.sound);
    if (this.entry === 'white') {
      this.setState('fading-in');
      S.fx.black = 0;
      el.classList.add('is-on');
      S.tween('white', 0, 2);
    } else {
      this.setState('black');
      await S.wait(2);
      this.setState('fading-in');
      S.tween('black', 0, 3);
    }
    for (const n of nodes) {
      n.classList.add('is-on');
      await S.wait(8);
      if (this.disposed) return;
      if (nodes.length > 1) n.classList.remove('is-on');
    }
    this.setState('waking');
    await S.tween('white', 1, 3);
    el.classList.remove('is-on');
    S.showLine(this.world.wake?.line || '');
    stopAudio();
    await S.wait(5);
    if (this.disposed) return;
    this.setState('woken');
    this.onWoken(this.id);
  }

  update() {
    this.S.syncCamera();
  }

  dispose() {
    this.disposed = true;
    this.S.stillsEl.classList.remove('is-on');
    this.S.stillsEl.replaceChildren();
  }
}

export { moduleById, yawTo };
