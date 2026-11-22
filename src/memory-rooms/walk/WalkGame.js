/* ============================================================================
   WalkGame: walk around a baked room as your character (the walk page's plain
   three.js class; React only owns its lifecycle, like viewer/RoomViewer.js).

     const g = new WalkGame(container, { who });
     await g.load({ glbUrl, scene, photos });
     g.on('local' | 'hint' | 'view' | 'emote' | 'ready' | 'error', fn)
     g.addPeer(person)  g.peerState(msg)  g.removePeer(id)  g.peerEmote(id, e)  g.say(id, text)
     g.setMove(x, y)  g.interact()  g.emote(e)  g.toggleView()  g.correct(p)
     g.dispose()

   - The room is the full room.glb with the viewer's unlit baked materials
     (viewer/bakedMaterials.js) and dollhouse index (viewer/dollhouse.js): the walls
     between the camera and you fade out, the dollhouse way, so the room never
     blocks the view. One WebGL context, everything disposed on leave.
   - Where you can go comes from the GLB itself (walk/grid.js).
   - Characters are camera-facing pixel sprites (walk/characters.js): the frame
     follows your heading against the camera's angle, 8 directions.
   - Photo marks: every scene camera is a ring on the floor where the photo was
     taken. Stand on one and the view flies to that exact camera and the real
     photo fades in over the model (the spot viewer's viewpoint blend). Move off
     and it comes back.
   - Seats: chairs, stools, armchairs, sofas, beds and bunks from scene.json.

   Controls. Keyboard: WASD to walk (A/D step sideways), ↑/↓ walk, ←/→ turn,
   Shift runs, E sits / stands / looks at a photo, 1 wave, 2 jump, 3 sit, V first
   person. Mouse: drag to look (a click locks the pointer; Esc frees it), wheel
   for distance. Touch: the left half is a joystick, drag on the right half to
   look, pinch for distance, tap the floor to walk there (A* round furniture).

   The container carries data-mr="walk" and data-state / -x / -z / -view /
   -photo / -sitting / -anim / -peers for the headless checks; container.__walk
   is this instance.
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { sceneBounds, verticalFov } from '../scene/geometry.js';
import { resolveShell } from '../scene/shell.js';
import { applyBakedMaterials } from '../viewer/bakedMaterials.js';
import { disposeTree } from '../viewer/dispose.js';
import { applyDollhouse, indexRoom, stepFades } from '../viewer/dollhouse.js';
import { aimCamera } from '../viewer/helpers.js';
import { CHARACTERS, FPS } from './characters.js';
import { buildGrid, findPath, nearestWalkable, slide } from './grid.js';

const WALK_MS = 1.5; // m/s
const RUN_MS = 3.4;
const TURN_RATE = 2.4; // rad/s for ←/→
const SEND_MS = 1000 / 12;
const INTERP_MS = 100;
const SNAP_M = 2;
const CAM = { dist: 3.6, min: 1.3, max: 9, pitch: 0.55, minPitch: 0.12, maxPitch: 1.25 };
const EYE = 1.58;
const MARK_R = 0.38;
const MARK_HOLD_S = 0.35;
const SEAT_KITS = new Set(['chair', 'stool', 'armchair', 'sofa', 'bed', 'bunk']);
const SEAT_REACH = 1.0;
const FOLLOW_S = 1.6; // after this long without a drag, the camera swings in behind you as you walk
const TAP_PX = 10;
const TAP_MS = 350;
const FLY_MS = 700;
const DIRS = ['south', 'south-east', 'east', 'north-east', 'north', 'north-west', 'west', 'south-west'];
const MIRROR = { west: 'east', 'south-west': 'south-east', 'north-west': 'north-east' };
const ONCE = { wave: 1.6, jump: 0.9 }; // seconds an emote lasts

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

function containRect(aspect, w, h) {
  let rw = w;
  let rh = w / aspect;
  if (rh > h) {
    rh = h;
    rw = h * aspect;
  }
  return { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh };
}

/** A token's computed colour (the built CSS minifies rgba(), so read it through a probe). */
function token(el, name, fallback) {
  const probe = document.createElement('span');
  probe.style.display = 'none';
  probe.style.color = `var(${name})`;
  el.appendChild(probe);
  const c = getComputedStyle(probe).color;
  probe.remove();
  return c || fallback;
}

/* ── a camera-facing pixel sprite ────────────────────────────────────────── */

class Sprite {
  constructor(spec, texture) {
    const L = spec.layout;
    this.L = L;
    const ppm = (L.feet - (L.head ?? L.top)) / spec.heightM; // px per metre: feet to the top of the head
    const size = L.cell / ppm;
    this.tex = texture.clone();
    this.tex.needsUpdate = true;
    this.tex.repeat.set(1 / L.cols, 1 / L.rows);
    const geo = new THREE.PlaneGeometry(size, size);
    geo.translate(0, size / 2 - (L.cell - L.feet) / ppm, 0);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: this.tex, transparent: true, alphaTest: 0.5 }));
    this.mesh.renderOrder = 2;
    this.top = spec.heightM; // head height, m (name tags sit just above it)
    this.t = 0;
    this.anim = 'idle';
  }

  /** The cells and mirroring for an animation seen from `dir`. */
  frames(anim, dir) {
    const A = this.L.anims;
    const key = anim === 'run' ? 'walk' : anim;
    if (A[key]?.[dir]) return { cells: A[key][dir], mirror: false };
    if (MIRROR[dir] && A[key]?.[MIRROR[dir]]) return { cells: A[key][MIRROR[dir]], mirror: true };
    if (A[key]?.south) return { cells: A[key].south, mirror: false }; // emotes face the camera
    return { cells: A.idle[dir] || A.idle.south, mirror: false };
  }

  update(dt, { pos, heading, anim, camera }) {
    if (anim !== this.anim) {
      this.anim = anim;
      this.t = 0;
    }
    this.t += dt;
    this.mesh.position.copy(pos);
    const toCam = Math.atan2(camera.position.x - pos.x, camera.position.z - pos.z);
    this.mesh.rotation.set(0, toCam, 0);
    const rel = wrap(heading - toCam);
    const dir = DIRS[(Math.round(rel / (Math.PI / 4)) + 8) % 8];
    const { cells, mirror } = this.frames(anim, dir);
    let i = Math.floor(this.t * (FPS[anim] || 8));
    if (anim === 'sit' || anim === 'jump') i = Math.min(i, cells.length - 1); // sit down and stay seated; one hop
    const cell = cells[i % cells.length];
    const col = cell % this.L.cols;
    const row = Math.floor(cell / this.L.cols);
    this.tex.repeat.x = (mirror ? -1 : 1) / this.L.cols;
    this.tex.offset.set((mirror ? col + 1 : col) / this.L.cols, 1 - (row + 1) / this.L.rows);
  }

  dispose() {
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
    this.tex.dispose();
  }
}

/* ── the game ────────────────────────────────────────────────────────────── */

export class WalkGame {
  constructor(container, { who = 'james', pixelRatio } = {}) {
    this.container = container;
    this.who = CHARACTERS[who] ? who : 'james';
    this.handlers = {};
    this.disposed = false;
    this.ready = false;
    this.keys = new Set();
    this.joy = { x: 0, y: 0 };
    this.path = null;
    this.view = 'third'; // third | first | photo
    this.yaw = Math.PI; // camera yaw: the camera sits at yaw, looking back at you
    this.pitch = CAM.pitch;
    this.fpPitch = 0;
    this.dist = CAM.dist;
    this.lastLook = -Infinity;
    this.peers = new Map();
    this.marks = [];
    this.seats = [];
    this.textures = {};
    // armed: a photo mark may open its photo (not until you've stepped off the one you start on)
    this.me = { id: 'me', who: this.who, pos: new THREE.Vector3(), heading: 0, anim: 'idle', sitting: null, emote: null, still: 0, armed: false };
    this.sent = { at: 0, p: null, h: 0, a: '' };
    this.width = Math.max(1, container.clientWidth);
    this.height = Math.max(1, container.clientHeight);
    container.dataset.mr = 'walk';
    container.dataset.state = 'loading';
    container.__walk = this;

    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    const dpr = window.devicePixelRatio || 1;
    this.renderer.setPixelRatio(pixelRatio ?? Math.min(dpr, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.autoClear = false;
    this.renderer.setSize(this.width, this.height, false);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'mr-walk__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');

    this.photoEl = document.createElement('img');
    this.photoEl.className = 'mr-walk__photo';
    this.photoEl.alt = '';
    this.photoEl.hidden = true;
    this.overlay = document.createElement('div');
    this.overlay.className = 'mr-walk__overlay';
    this.stick = document.createElement('div');
    this.stick.className = 'mr-walk__stick';
    this.stick.hidden = true;
    this.stick.innerHTML = '<span class="mr-walk__knob"></span>';
    container.append(this.canvas, this.photoEl, this.overlay, this.stick);

    this.camera = new THREE.PerspectiveCamera(55, this.width / this.height, 0.05, 300);
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.scene.add(this.world);
    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.readTheme();

    this.tick = this.tick.bind(this);
    this.bindInput();
  }

  on(event, fn) {
    (this.handlers[event] ??= new Set()).add(fn);
    return () => this.handlers[event]?.delete(fn);
  }

  emit(event, payload) {
    for (const fn of [...(this.handlers[event] || [])]) fn(payload);
  }

  readTheme() {
    this.clear = new THREE.Color().setStyle(token(this.container, '--mr-stage', '#e9e6df'), THREE.SRGBColorSpace);
    this.accent = new THREE.Color().setStyle(token(this.container, '--mr-accent', '#b5532f'), THREE.SRGBColorSpace);
    this.renderer.setClearColor(this.clear, 1);
    for (const m of this.marks) m.mesh.material.color.copy(this.accent);
  }

  /* ── loading ── */

  async load({ glbUrl, scene, photos = [] }) {
    try {
      const [gltf] = await Promise.all([this.loader.loadAsync(glbUrl), this.loadCharacters()]);
      if (this.disposed) {
        disposeTree(gltf.scene);
        return;
      }
      const root = applyBakedMaterials(gltf.scene, { anisotropy: Math.min(8, this.renderer.capabilities.getMaxAnisotropy()) });
      const holder = new THREE.Group();
      holder.add(root);
      this.world.add(holder);
      holder.updateMatrixWorld(true);
      const index = indexRoom(root, scene);
      const interior = scene ? scene.kind === 'interior' : Object.values(index.walls).some((w) => w.length);
      this.room = { root, holder, interior, ...index };
      this.scene3 = scene;
      this.photos = photos;

      // where you can walk: inside the shell (interiors) or on the ground plate (exteriors)
      let bounds;
      // any shell shape: its normalised box (a polygon's angled walls block cells in the grid itself)
      const sh = interior && scene?.shell ? resolveShell(scene, this.building || null) : null;
      if (sh) bounds = new THREE.Box3(new THREE.Vector3(sh.box.min[0], 0, sh.box.min[1]), new THREE.Vector3(sh.box.max[0], sh.top ?? sh.height, sh.box.max[1]));
      else {
        let ground = null;
        root.traverse((o) => {
          if (!ground && /^ground/.test(o.name || '')) ground = o;
        });
        bounds = ground ? new THREE.Box3().setFromObject(ground) : null;
        if (!bounds || bounds.isEmpty()) {
          const b = scene ? sceneBounds(scene) : null;
          bounds = b ? new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max)) : new THREE.Box3().setFromObject(root);
        }
      }
      const cams = scene?.cameras || [];
      const first = cams[0]?.pos;
      const centre = bounds.getCenter(new THREE.Vector3());
      const inBox = first && first[0] > bounds.min.x && first[0] < bounds.max.x && first[2] > bounds.min.z && first[2] < bounds.max.z;
      const t0 = performance.now();
      this.grid = buildGrid(root, { bounds, start: inBox ? { x: first[0], z: first[2] } : { x: centre.x, z: centre.z } });
      this.gridMs = Math.round(performance.now() - t0);
      this.bounds = bounds;
      this.centre = centre;

      this.buildMarks(cams);
      this.buildSeats(scene?.objects || []);
      this.buildBlockers(root);

      const me = this.me;
      me.pos.set(this.grid.start.x, 0, this.grid.start.z);
      me.heading = Math.atan2(centre.x - me.pos.x, centre.z - me.pos.z);
      this.yaw = me.heading + Math.PI;
      me.sprite = this.makeSprite(this.who);
      me.tag = this.makeTag(this.who, true);

      this.ready = true;
      this.container.dataset.state = 'ready';
      this.container.dataset.grid = `${this.grid.nx}x${this.grid.nz}`;
      this.emit('ready', { gridMs: this.gridMs, area: this.grid.area });
      this.sendLocal(true);
      this.last = performance.now();
      this.raf = requestAnimationFrame(this.tick);
    } catch (err) {
      if (this.disposed) return;
      console.info('[memory-rooms] walk load failed:', err?.message || err);
      this.container.dataset.state = 'error';
      this.emit('error', err);
    }
  }

  async loadCharacters() {
    const loader = new THREE.TextureLoader();
    await Promise.all(
      Object.entries(CHARACTERS).map(async ([who, spec]) => {
        const tex = await loader.loadAsync(spec.sheet);
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.magFilter = THREE.NearestFilter;
        tex.minFilter = THREE.NearestFilter;
        tex.generateMipmaps = false;
        this.textures[who] = tex;
      }),
    );
  }

  makeSprite(who) {
    const spec = CHARACTERS[who] || CHARACTERS.james;
    const s = new Sprite(spec, this.textures[who] || this.textures.james);
    this.scene.add(s.mesh);
    return s;
  }

  makeTag(who, self = false) {
    const el = document.createElement('div');
    el.className = 'mr-walk__tag';
    el.dataset.who = who;
    if (self) el.dataset.self = '';
    el.innerHTML = `<span class="mr-walk__bubble" hidden></span><span class="mr-walk__name"></span>`;
    el.querySelector('.mr-walk__name').textContent = this.names?.[who] || who;
    this.overlay.append(el);
    return el;
  }

  /** Display names for the tags (the page passes COPY.app.people). */
  setNames(names) {
    this.names = names;
    for (const el of this.overlay.querySelectorAll('.mr-walk__tag')) el.querySelector('.mr-walk__name').textContent = names[el.dataset.who] || el.dataset.who;
  }

  buildMarks(cams) {
    const geo = new THREE.RingGeometry(0.2, 0.27, 40).rotateX(-Math.PI / 2);
    const dot = new THREE.CircleGeometry(0.06, 20).rotateX(-Math.PI / 2);
    for (const cam of cams) {
      const pos = cam.pos;
      if (!this.grid || !pos) continue;
      // a camera held over furniture still gets a mark: at the nearest place you can stand
      const at = this.grid.walkable(pos[0], pos[2]) ? { x: pos[0], z: pos[2] } : nearestWalkable(this.grid, pos[0], pos[2]);
      const mat = new THREE.MeshBasicMaterial({ color: this.accent, transparent: true, opacity: 0.9, depthWrite: false });
      const mesh = new THREE.Group();
      mesh.add(new THREE.Mesh(geo, mat), new THREE.Mesh(dot, mat));
      mesh.position.set(at.x, 0.012, at.z);
      mesh.renderOrder = 1;
      mesh.material = mat;
      this.scene.add(mesh);
      this.marks.push({ photo: cam.photo, cam, x: at.x, z: at.z, mesh });
    }
    this.markGeo = [geo, dot];
  }

  /** Furniture that can stand between the camera and you (anything tall enough that isn't part of a wall). */
  buildBlockers(root) {
    const onWalls = new Set(Object.values(this.room.walls).flat());
    this.blockers = [];
    for (const node of root.children.length === 1 && !/^obj__/.test(root.children[0].name) ? root.children[0].children : root.children) {
      if (!/^obj__[^_]/.test(node.name || '') || /__.+__/.test(node.name) || onWalls.has(node)) continue;
      const box = new THREE.Box3().setFromObject(node);
      if (box.isEmpty() || box.max.y < 0.5) continue; // rugs and low things never block the view
      this.blockers.push({ node, box, hidden: false });
    }
  }

  /** Third person: hide whatever stands between the camera and you (and show it again after). */
  clearView() {
    if (!this.blockers?.length) return;
    const third = this.view === 'third' && !this.photoView;
    const cam = this.camera.position;
    // chest and the top of the head: a high cupboard or a ceiling vent can hide just the head
    const targets = (this.me.sitting ? [0.7, 1.25] : [1.0, 1.8]).map((y) => new THREE.Vector3(this.me.pos.x, y, this.me.pos.z));
    const rays = targets.map((t) => {
      const dir = t.clone().sub(cam);
      const len = dir.length();
      return { ray: new THREE.Ray(cam, dir.normalize()), len };
    });
    const hit = new THREE.Vector3();
    for (const b of this.blockers) {
      let hide = false;
      if (third) {
        const grown = b.box.clone().expandByScalar(0.05);
        hide = grown.containsPoint(cam) || rays.some(({ ray, len }) => ray.intersectBox(grown, hit) !== null && hit.distanceTo(cam) < len - 0.25);
      }
      if (hide !== b.hidden) {
        b.hidden = hide;
        b.node.visible = !hide;
      }
    }
  }

  /**
   * The dollhouse rule hides walls by their side's straight normal, which misses a slanted wall
   * owned by that side (the octagon shed's diagonals: wall_east also holds the south-east flat).
   * So in third person any wall a line from you (chest, head) to the camera passes through hides too.
   */
  wallsInTheWay() {
    if (!this.wallMeshes) {
      this.wallMeshes = [];
      for (const [side, nodes] of Object.entries(this.room.walls)) {
        for (const n of nodes)
          n.traverse((m) => {
            if (m.isMesh) {
              m.userData.wallSide = side;
              this.wallMeshes.push(m);
            }
          });
      }
    }
    if (!this.wallMeshes.length) return;
    const cam = this.camera.position;
    for (const y of this.me.sitting ? [0.7, 1.25] : [1.0, 1.8]) {
      const from = new THREE.Vector3(this.me.pos.x, y, this.me.pos.z);
      const dir = cam.clone().sub(from);
      const far = dir.length();
      this.raycaster.set(from, dir.normalize());
      this.raycaster.far = far;
      for (const hit of this.raycaster.intersectObjects(this.wallMeshes, false)) {
        const fade = this.room.fades[hit.object.userData.wallSide];
        if (fade) fade.target = 0;
      }
    }
    this.raycaster.far = Infinity;
  }

  buildSeats(objects) {
    for (const o of objects) {
      if (!SEAT_KITS.has(o.kit)) continue;
      const r = ((o.rotY || 0) * Math.PI) / 180;
      const front = { x: Math.sin(r), z: Math.cos(r) }; // rotY 0 faces south (+z)
      const half = o.size[2] / 2;
      // where you sit: just in front of the seat, on the floor (the sprite draws the sitting pose over its edge)
      const edge = { x: o.at[0] + front.x * (half + 0.1), z: o.at[2] + front.z * (half + 0.1) };
      this.seats.push({ id: o.id, kit: o.kit, at: o.at, size: o.size, rotY: r, front, edge, heading: Math.atan2(front.x, front.z) });
    }
  }

  /* ── input ── */

  bindInput() {
    const c = this.canvas;
    this.onKeyDown = (e) => {
      if (e.target?.closest?.('input, textarea, select, [contenteditable]')) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const k = e.code;
      const game = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
      if (game.includes(k)) {
        this.keys.add(k);
        if (k.startsWith('Arrow')) e.preventDefault();
        return;
      }
      if (e.repeat) return;
      if (k === 'KeyE') this.interact();
      else if (k === 'Digit1') this.emote('wave');
      else if (k === 'Digit2') this.emote('jump');
      else if (k === 'Digit3') this.emote('sit');
      else if (k === 'KeyV') this.toggleView();
      else if (k === 'Escape' && this.view === 'photo') this.leavePhoto();
    };
    this.onKeyUp = (e) => this.keys.delete(e.code);
    this.onBlur = () => this.keys.clear();
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);

    this.pointers = new Map();
    this.onDown = (e) => {
      c.setPointerCapture?.(e.pointerId);
      const p = { id: e.pointerId, type: e.pointerType, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, t0: performance.now(), moved: 0 };
      const rect = c.getBoundingClientRect();
      if (e.pointerType === 'touch') {
        if (this.pointers.size === 1) {
          // a second finger: pinch (drop whatever the first was doing)
          const other = [...this.pointers.values()][0];
          other.role = 'pinch';
          p.role = 'pinch';
          this.pinch = { d: Math.hypot(e.clientX - other.x, e.clientY - other.y), dist: this.dist };
          this.setJoy(null);
        } else p.role = e.clientX - rect.left < rect.width / 2 ? 'stick' : 'look';
        if (p.role === 'stick') this.setJoy(p);
      } else p.role = 'look';
      this.pointers.set(e.pointerId, p);
    };
    this.onMove = (e) => {
      if (document.pointerLockElement === c) {
        this.look(e.movementX, e.movementY);
        return;
      }
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      p.moved = Math.max(p.moved, Math.hypot(e.clientX - p.x0, e.clientY - p.y0));
      if (p.role === 'pinch') {
        const [a, b] = [...this.pointers.values()];
        if (a && b && this.pinch) this.dist = clamp((this.pinch.dist * this.pinch.d) / Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), CAM.min, CAM.max);
      } else if (p.role === 'stick') this.setJoy(p);
      else if (p.role === 'look' && (p.type !== 'mouse' || e.buttons)) this.look(dx, dy);
    };
    this.onUp = (e) => {
      const p = this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if (!p) return;
      if (p.role === 'stick') this.setJoy(null);
      if (p.role === 'pinch' && this.pointers.size < 2) this.pinch = null;
      const tap = p.role !== 'pinch' && p.moved < TAP_PX && performance.now() - p.t0 < TAP_MS;
      if (!tap) return;
      if (p.type === 'mouse') {
        // a click locks the pointer for mouse-look (Esc frees it)
        try {
          const r = c.requestPointerLock?.();
          r?.catch?.(() => {});
        } catch {
          /* not allowed here */
        }
      } else this.tapTo(e.clientX, e.clientY);
    };
    this.onWheel = (e) => {
      e.preventDefault();
      this.dist = clamp(this.dist * Math.exp(e.deltaY * 0.0012), CAM.min, CAM.max);
    };
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('pointermove', this.onMove);
    c.addEventListener('pointerup', this.onUp);
    c.addEventListener('pointercancel', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: false });
    document.addEventListener('mousemove', this.onMoveLocked = (e) => document.pointerLockElement === c && this.look(e.movementX, e.movementY));
    this.onTheme = () => requestAnimationFrame(() => !this.disposed && this.readTheme());
    this.themeQuery = matchMedia('(prefers-color-scheme: dark)');
    this.themeQuery.addEventListener('change', this.onTheme);
    window.addEventListener('mr-theme', this.onTheme); // the Memory Rooms theme switch (lib/theme.js)
    this.onVisible = () => {
      if (document.visibilityState === 'visible' && this.ready && !this.raf) {
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.tick);
      }
    };
    document.addEventListener('visibilitychange', this.onVisible);
  }

  look(dx, dy) {
    this.lastLook = performance.now();
    this.yaw -= dx * 0.006;
    if (this.view === 'first') this.fpPitch = clamp(this.fpPitch - dy * 0.004, -1.1, 1.1);
    else this.pitch = clamp(this.pitch + dy * 0.004, CAM.minPitch, CAM.maxPitch);
  }

  setJoy(p) {
    const R = 56;
    if (!p) {
      this.joy = { x: 0, y: 0 };
      this.stick.hidden = true;
      return;
    }
    const rect = this.canvas.getBoundingClientRect();
    const dx = p.x - p.x0;
    const dy = p.y - p.y0;
    const len = Math.hypot(dx, dy);
    const k = len > R ? R / len : 1;
    this.joy = { x: (dx * k) / R, y: (dy * k) / R };
    this.stick.hidden = false;
    this.stick.style.transform = `translate(${p.x0 - rect.left}px, ${p.y0 - rect.top}px)`;
    this.stick.firstChild.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  }

  /** Joystick from the page (x right, y down, -1…1). */
  setMove(x, y) {
    this.joy = { x: clamp(x, -1, 1), y: clamp(y, -1, 1) };
  }

  /** Tap on the floor: walk there round whatever is in the way. */
  tapTo(clientX, clientY) {
    if (!this.ready || this.me.sitting) return false;
    const rect = this.canvas.getBoundingClientRect();
    const r = this.viewRect();
    const ndc = new THREE.Vector2(((clientX - rect.left - r.x) / r.w) * 2 - 1, -((clientY - rect.top - r.y) / r.h) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hit)) return false;
    return this.walkTo(hit.x, hit.z);
  }

  /** Walk to (x, z) by A*. → true if there's a way. */
  walkTo(x, z) {
    if (this.view === 'photo') this.leavePhoto();
    const path = findPath(this.grid, { x: this.me.pos.x, z: this.me.pos.z }, { x, z });
    this.path = path && path.length > 1 ? path.slice(1) : null;
    this.container.dataset.path = this.path ? String(this.path.length) : '';
    return Boolean(this.path);
  }

  /* ── actions ── */

  /** The seat whose footprint (its own rotated box) is nearest you, within SEAT_REACH. */
  nearestSeat() {
    let best = null;
    let bd = SEAT_REACH;
    for (const s of this.seats) {
      const dx = this.me.pos.x - s.at[0];
      const dz = this.me.pos.z - s.at[2];
      // into the seat's own frame (rotY about +y)
      const lx = dx * Math.cos(s.rotY) - dz * Math.sin(s.rotY);
      const lz = dx * Math.sin(s.rotY) + dz * Math.cos(s.rotY);
      const d = Math.hypot(Math.max(0, Math.abs(lx) - s.size[0] / 2), Math.max(0, Math.abs(lz) - s.size[2] / 2));
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  nearestMark() {
    let best = null;
    let bd = MARK_R;
    for (const m of this.marks) {
      const d = Math.hypot(this.me.pos.x - m.x, this.me.pos.z - m.z);
      if (d < bd) {
        bd = d;
        best = m;
      }
    }
    return best;
  }

  interact() {
    if (!this.ready) return;
    if (this.me.sitting) return this.standUp();
    if (this.view === 'photo') return this.leavePhoto();
    // a seat in reach wins: standing still on a ring opens its photo by itself anyway
    const seat = this.nearestSeat();
    if (seat) return this.sit(seat);
    const mark = this.nearestMark();
    if (mark) return this.enterPhoto(mark);
  }

  sit(seat) {
    const me = this.me;
    me.standFrom = { x: me.pos.x, z: me.pos.z };
    me.sitting = seat || { floor: true };
    this.path = null;
    if (seat) {
      me.pos.set(seat.edge.x, 0, seat.edge.z);
      me.heading = seat.heading;
    }
    me.anim = 'sit';
    this.container.dataset.sitting = seat ? seat.kit : 'floor';
    this.emit('emote', { e: 'sit' });
    this.sendLocal(true);
  }

  standUp() {
    const me = this.me;
    if (!me.sitting) return;
    const back = me.sitting.floor ? { x: me.pos.x, z: me.pos.z } : nearestWalkable(this.grid, me.standFrom?.x ?? me.pos.x, me.standFrom?.z ?? me.pos.z);
    me.pos.set(back.x, 0, back.z);
    me.sitting = null;
    me.anim = 'idle';
    delete this.container.dataset.sitting;
    this.sendLocal(true);
  }

  emote(e) {
    if (!this.ready) return;
    if (e === 'sit') {
      if (this.me.sitting) return this.standUp();
      return this.sit(this.nearestSeat());
    }
    if (!ONCE[e]) return;
    if (this.me.sitting) this.standUp();
    this.me.emote = { e, until: performance.now() + ONCE[e] * 1000 };
    this.emit('emote', { e });
    this.sendLocal(true);
  }

  toggleView() {
    if (this.view === 'photo') this.leavePhoto();
    this.view = this.view === 'first' ? 'third' : 'first';
    this.yaw += Math.PI; // third person sits at yaw looking back; first person looks along yaw
    this.fpPitch = 0;
    this.container.dataset.view = this.view;
    this.emit('view', { view: this.view });
  }

  /** The server clamped a move (a teleport): take its position. */
  correct(p) {
    if (!Array.isArray(p) || !this.grid) return;
    // never off the walkable area: the clamped point can sit in a wall or a bed
    const at = this.grid.walkable(p[0], p[2]) ? { x: p[0], z: p[2] } : nearestWalkable(this.grid, p[0], p[2]);
    this.me.pos.set(at.x, 0, at.z);
    this.path = null;
    this.sendLocal(true);
  }

  /** Put yourself somewhere (the headless check's spoof test uses it, through the socket). */
  teleport(x, z) {
    this.me.pos.set(x, 0, z);
    this.sendLocal(true);
  }

  /* ── photo viewpoints ── */

  enterPhoto(mark) {
    const cam = mark.cam;
    const photo = this.photos?.find((p) => p.photo === cam.photo);
    const aspect = photo?.width && photo?.height ? photo.width / photo.height : cam.aspect ?? 0.75;
    const goal = new THREE.PerspectiveCamera();
    aimCamera(goal, cam.pos, cam.look, cam.roll || 0, true);
    this.photoView = {
      mark,
      aspect,
      from: { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), fov: this.camera.fov },
      to: { pos: goal.position.clone(), quat: goal.quaternion.clone(), fov: verticalFov(cam, aspect) },
      t0: performance.now(),
      leaving: false,
    };
    this.view = 'photo';
    this.path = null;
    this.photoEl.style.opacity = '0';
    if (photo?.url) {
      if (this.photoEl.getAttribute('src') !== photo.url) this.photoEl.src = photo.url;
      this.photoEl.hidden = false;
    }
    this.container.dataset.view = 'photo';
    this.container.dataset.photo = String(cam.photo);
    this.emit('view', { view: 'photo', photo: cam.photo });
  }

  leavePhoto() {
    if (this.view !== 'photo' || !this.photoView) return;
    this.photoView.leaving = true;
    this.photoView.t0 = performance.now();
    this.photoView.from = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), fov: this.camera.fov };
    this.photoEl.style.opacity = '0';
    this.view = this.photoView.back || 'third';
    this.me.armed = false; // don't fly straight back in while still on the mark
    this.container.dataset.view = this.view;
    delete this.container.dataset.photo;
    this.emit('view', { view: this.view });
  }

  /* ── peers ── */

  addPeer(person) {
    // only someone whose position is known (the room announces you with your first state)
    if (!person?.id || this.peers.has(person.id) || !Array.isArray(person.p)) return;
    const peer = { id: person.id, who: person.who, buf: [], pos: new THREE.Vector3(), heading: person.h || 0, anim: person.a || 'idle', emote: null };
    if (Array.isArray(person.p)) peer.pos.set(person.p[0], 0, person.p[2]);
    peer.buf.push({ t: performance.now(), p: peer.pos.clone(), h: peer.heading, a: peer.anim });
    peer.sprite = this.ready ? this.makeSprite(person.who) : null;
    peer.sprite?.mesh.position.copy(peer.pos); // never drawn at the origin, even before its first frame
    peer.tag = this.makeTag(person.who);
    this.peers.set(person.id, peer);
    this.container.dataset.peers = String(this.peers.size);
  }

  peerState({ id, p, h, a }) {
    const peer = this.peers.get(id);
    if (!peer || !Array.isArray(p)) return;
    const pos = new THREE.Vector3(p[0], 0, p[2]);
    const last = peer.buf[peer.buf.length - 1];
    const now = performance.now();
    if (last && last.p.distanceTo(pos) > SNAP_M) peer.buf = []; // a big jump: snap, don't glide through walls
    peer.buf.push({ t: now, p: pos, h: Number(h) || 0, a: a || 'idle' });
    if (peer.buf.length > 30) peer.buf.splice(0, peer.buf.length - 30);
  }

  peerEmote(id, e) {
    const peer = this.peers.get(id);
    if (peer && ONCE[e]) peer.emote = { e, until: performance.now() + ONCE[e] * 1000 };
  }

  removePeer(id) {
    const peer = this.peers.get(id);
    if (!peer) return;
    peer.sprite?.mesh.removeFromParent();
    peer.sprite?.dispose();
    peer.tag?.remove();
    this.peers.delete(id);
    this.container.dataset.peers = String(this.peers.size);
  }

  /** A short chat line over someone's head ('me' for you). Never stored. */
  say(id, text) {
    const who = id === 'me' ? this.me : this.peers.get(id);
    const bubble = who?.tag?.querySelector('.mr-walk__bubble');
    if (!bubble) return;
    bubble.textContent = String(text).slice(0, 80);
    bubble.hidden = false;
    clearTimeout(who.bubbleTimer);
    who.bubbleTimer = setTimeout(() => {
      bubble.hidden = true;
    }, 6000);
  }

  /* ── the loop ── */

  sendLocal(force = false) {
    if (!this.ready) return; // no position until the room (and so the spawn point) is known
    const me = this.me;
    const now = performance.now();
    const p = [Math.round(me.pos.x * 1000) / 1000, 0, Math.round(me.pos.z * 1000) / 1000];
    const anim = this.animOf(me);
    const changed = !this.sent.p || this.sent.p[0] !== p[0] || this.sent.p[2] !== p[2] || this.sent.a !== anim || Math.abs(wrap(this.sent.h - me.heading)) > 0.05;
    if (!force && (!changed || now - this.sent.at < SEND_MS)) return;
    this.sent = { at: now, p, h: me.heading, a: anim };
    this.emit('local', { p, h: Math.round(me.heading * 1000) / 1000, a: anim });
  }

  animOf(who) {
    if (who.sitting) return 'sit';
    if (who.emote && performance.now() < who.emote.until) return who.emote.e;
    return who.anim;
  }

  tick(now) {
    this.raf = 0;
    if (this.disposed || !this.ready) return;
    if (document.visibilityState === 'hidden') return; // resumes on visibilitychange
    const dt = Math.min(0.05, Math.max(0, (now - (this.last ?? now)) / 1000));
    this.last = now;
    this.step(dt, now);
    this.render(dt);
    this.raf = requestAnimationFrame(this.tick);
  }

  step(dt, now) {
    const me = this.me;
    const k = this.keys;
    // ←/→ turn the camera (so the keyboard alone can look round)
    const turn = (k.has('ArrowLeft') ? 1 : 0) - (k.has('ArrowRight') ? 1 : 0);
    if (turn) {
      this.yaw += turn * TURN_RATE * dt;
      this.lastLook = now;
    }
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) - this.joy.y;
    const side = (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + this.joy.x;
    const input = Math.hypot(fwd, side) > 0.08;
    const running = k.has('ShiftLeft') || k.has('ShiftRight') || Math.hypot(this.joy.x, this.joy.y) > 0.92;

    if (input && me.sitting) this.standUp();
    if (input && this.view === 'photo') this.leavePhoto();
    if (input) this.path = null;

    let vx = 0;
    let vz = 0;
    // facing = where the camera looks (from the camera, at yaw, toward you)
    const lookYaw = this.view === 'first' ? this.yaw : this.yaw + Math.PI;
    if (input && !me.sitting) {
      const len = Math.min(1, Math.hypot(fwd, side));
      const f = { x: Math.sin(lookYaw), z: Math.cos(lookYaw) };
      const r = { x: -Math.cos(lookYaw), z: Math.sin(lookYaw) };
      const dx = f.x * fwd + r.x * side;
      const dz = f.z * fwd + r.z * side;
      const n = Math.hypot(dx, dz) || 1;
      const speed = (running ? RUN_MS : WALK_MS) * len;
      vx = (dx / n) * speed;
      vz = (dz / n) * speed;
    } else if (this.path && !me.sitting) {
      const target = this.path[0];
      const dx = target.x - me.pos.x;
      const dz = target.z - me.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.06) {
        this.path.shift();
        if (!this.path.length) {
          this.path = null;
          this.container.dataset.path = 'arrived';
        }
      } else {
        const speed = Math.min(WALK_MS * 1.2, d / Math.max(dt, 1e-3));
        vx = (dx / d) * speed;
        vz = (dz / d) * speed;
      }
    }

    let moving = false;
    if (vx || vz) {
      const next = slide(this.grid, { x: me.pos.x, z: me.pos.z }, vx * dt, vz * dt);
      const moved = Math.hypot(next.x - me.pos.x, next.z - me.pos.z);
      me.pos.x = next.x;
      me.pos.z = next.z;
      moving = moved > 1e-4;
      if (moving || input) {
        const target = Math.atan2(vx, vz);
        me.heading += wrap(target - me.heading) * Math.min(1, dt * 12);
      }
      // the camera swings in behind you as you walk forward (or along a tapped path), unless you've
      // just looked round yourself; never for a step back or sideways, which would chase itself
      const forward = this.path ? true : fwd > 0.3 && Math.abs(side) < 0.3;
      if (moving && forward && this.view === 'third' && now - this.lastLook > FOLLOW_S * 1000) this.yaw += wrap(me.heading + Math.PI - this.yaw) * Math.min(1, dt * 1.5);
    }
    if (!me.sitting) me.anim = moving ? (running && !this.path ? 'run' : 'walk') : 'idle';
    if (me.emote && now > me.emote.until) me.emote = null;

    // photo marks: stand still on one and the photo appears
    const mark = !me.sitting && this.view !== 'photo' ? this.nearestMark() : null;
    if (!mark) me.armed = true;
    if (mark && !moving && !input && !this.path && me.armed) {
      me.still += dt;
      if (me.still > MARK_HOLD_S) {
        me.still = 0;
        this.photoBack = this.view;
        this.enterPhoto(mark);
        this.photoView.back = this.photoBack === 'first' ? 'first' : 'third';
      }
    } else me.still = 0;

    this.sendLocal();
    this.container.dataset.x = me.pos.x.toFixed(2);
    this.container.dataset.z = me.pos.z.toFixed(2);
    this.container.dataset.anim = this.animOf(me);
    if (!this.container.dataset.view) this.container.dataset.view = this.view;
    this.emitHint();
  }

  emitHint() {
    let hint = null;
    if (this.me.sitting) hint = { kind: 'stand' };
    else if (this.view === 'photo') hint = { kind: 'photo', photo: this.photoView?.mark.photo };
    else {
      const seat = this.nearestSeat();
      if (seat) hint = { kind: 'seat', seat: seat.kit };
      else if (this.nearestMark()) hint = { kind: 'mark' };
    }
    const key = hint ? `${hint.kind}:${hint.seat || hint.photo || ''}` : '';
    if (key !== this.hintKey) {
      this.hintKey = key;
      this.emit('hint', hint);
    }
  }

  /** The rect (CSS px) the 3D view is drawn into: the photo's own frame while it shows. */
  viewRect() {
    const full = { x: 0, y: 0, w: this.width, h: this.height };
    const pv = this.photoView;
    if (!pv) return full;
    const t = pv.leaving ? 1 - this.flyT(pv) : this.flyT(pv);
    const lb = containRect(pv.aspect, this.width, this.height);
    return { x: lb.x * t, y: lb.y * t, w: this.width + (lb.w - this.width) * t, h: this.height + (lb.h - this.height) * t };
  }

  flyT(pv) {
    return ease(clamp((performance.now() - pv.t0) / FLY_MS, 0, 1));
  }

  placeCamera() {
    const me = this.me;
    const cam = this.camera;
    const pv = this.photoView;
    const third = () => {
      const h = me.sitting ? 0.95 : 1.15;
      const target = new THREE.Vector3(me.pos.x, h, me.pos.z);
      const d = this.dist;
      const pos = new THREE.Vector3(target.x + Math.sin(this.yaw) * Math.cos(this.pitch) * d, target.y + Math.sin(this.pitch) * d, target.z + Math.cos(this.yaw) * Math.cos(this.pitch) * d);
      pos.y = Math.max(0.3, pos.y);
      return { pos, target };
    };
    const pose = (view) => {
      if (view === 'first') {
        const eye = new THREE.Vector3(me.pos.x, me.sitting ? 1.1 : EYE, me.pos.z);
        const dir = new THREE.Vector3(Math.sin(this.yaw) * Math.cos(this.fpPitch), Math.sin(this.fpPitch), Math.cos(this.yaw) * Math.cos(this.fpPitch));
        return { pos: eye, target: eye.clone().add(dir), fov: 70 };
      }
      return { ...third(), fov: 55 };
    };
    if (pv) {
      const t = this.flyT(pv);
      const back = pose(pv.back || 'third');
      if (pv.leaving) {
        const q = new THREE.Quaternion();
        const tmp = new THREE.PerspectiveCamera();
        tmp.position.copy(back.pos);
        tmp.lookAt(back.target);
        cam.position.lerpVectors(pv.from.pos, back.pos, t);
        cam.quaternion.slerpQuaternions(pv.from.quat, q.copy(tmp.quaternion), t);
        cam.fov = pv.from.fov + (back.fov - pv.from.fov) * t;
        if (t >= 1) {
          this.photoView = null;
          this.photoEl.hidden = true;
        }
      } else {
        cam.position.lerpVectors(pv.from.pos, pv.to.pos, t);
        cam.quaternion.slerpQuaternions(pv.from.quat, pv.to.quat, t);
        cam.fov = pv.from.fov + (pv.to.fov - pv.from.fov) * t;
        if (t >= 1 && this.photoEl.style.opacity !== '1') {
          this.photoEl.style.transition = 'opacity 420ms ease';
          this.photoEl.style.opacity = '1';
        }
      }
      return;
    }
    const p = pose(this.view);
    cam.position.copy(p.pos);
    cam.up.set(0, 1, 0);
    cam.lookAt(p.target);
    cam.fov = p.fov;
  }

  render(dt) {
    const { renderer, camera, me } = this;
    this.placeCamera();
    const r = this.viewRect();
    camera.aspect = r.w / r.h;
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();

    // walls between the camera and you fade out (third person); first person + photos show the whole room
    this.clearView();
    if (this.room) {
      const cut = this.view === 'third' && !this.photoView;
      applyDollhouse(this.room, [camera.position.x, camera.position.z], [me.pos.x, me.pos.z], cut);
      if (cut) this.wallsInTheWay();
      stepFades(this.room, dt * 1000, false);
    }

    // characters
    const now = performance.now();
    me.sprite.mesh.visible = this.view === 'third' && !this.photoView;
    me.sprite.update(dt, { pos: me.pos, heading: me.heading, anim: this.animOf(me), camera });
    const renderAt = now - INTERP_MS;
    for (const peer of this.peers.values()) {
      if (!peer.sprite) peer.sprite = this.makeSprite(peer.who);
      const buf = peer.buf;
      while (buf.length > 2 && buf[1].t <= renderAt) buf.shift();
      if (buf.length >= 2 && buf[0].t <= renderAt) {
        const [a, b] = buf;
        const t = clamp((renderAt - a.t) / Math.max(1, b.t - a.t), 0, 1);
        peer.pos.lerpVectors(a.p, b.p, t);
        peer.heading = a.h + wrap(b.h - a.h) * t;
        peer.anim = t < 1 ? b.a : b.a;
      } else if (buf.length) {
        peer.pos.copy(buf[buf.length - 1].p);
        peer.heading = buf[buf.length - 1].h;
        peer.anim = buf[buf.length - 1].a;
      }
      if (peer.emote && now > peer.emote.until) peer.emote = null;
      peer.sprite.update(dt, { pos: peer.pos, heading: peer.heading, anim: peer.emote ? peer.emote.e : peer.anim, camera });
    }
    for (const m of this.marks) m.mesh.visible = this.view !== 'photo' || !this.photoView;

    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, this.width, this.height);
    renderer.clear();
    const y = this.height - r.y - r.h;
    renderer.setViewport(r.x, y, r.w, r.h);
    renderer.setScissor(r.x, y, r.w, r.h);
    renderer.setScissorTest(true);
    renderer.render(this.scene, camera);
    renderer.setScissorTest(false);
    this.placeOverlay(r);
  }

  placeOverlay(r) {
    const photo = this.photoEl;
    if (!photo.hidden) {
      photo.style.left = `${r.x}px`;
      photo.style.top = `${r.y}px`;
      photo.style.width = `${r.w}px`;
      photo.style.height = `${r.h}px`;
    }
    const v = new THREE.Vector3();
    // the page's chrome sits over the top of the stage: a tag (and its bubble) is kept below it
    const top = this.chromeTop ?? 64;
    const place = (who, pos, head, el, hide) => {
      if (!el) return;
      v.set(pos.x, pos.y + head + 0.12, pos.z).project(this.camera);
      const show = !hide && v.z < 1 && v.z > -1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2;
      el.hidden = !show;
      if (!show) return;
      const bubble = el.firstChild && !el.firstChild.hidden ? el.firstChild.offsetHeight + 26 : 0;
      const x = clamp(r.x + ((v.x + 1) / 2) * r.w, 56, this.width - 56);
      const y = Math.max(r.y + ((1 - v.y) / 2) * r.h, top + 26 + bubble);
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    };
    const inPhoto = Boolean(this.photoView);
    place(this.me, this.me.pos, this.me.sitting ? this.me.sprite.top * 0.7 : this.me.sprite.top, this.me.tag, inPhoto || this.view === 'first');
    for (const peer of this.peers.values()) place(peer, peer.pos, peer.sprite ? peer.sprite.top : 1.75, peer.tag, inPhoto);
  }

  setSize(w, h) {
    if (this.disposed) return;
    this.width = Math.max(1, Math.round(w));
    this.height = Math.max(1, Math.round(h));
    this.renderer.setSize(this.width, this.height, false);
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    document.removeEventListener('mousemove', this.onMoveLocked);
    document.removeEventListener('visibilitychange', this.onVisible);
    this.themeQuery?.removeEventListener('change', this.onTheme);
    window.removeEventListener('mr-theme', this.onTheme);
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('pointermove', this.onMove);
    c.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('pointercancel', this.onUp);
    c.removeEventListener('wheel', this.onWheel);
    if (document.pointerLockElement === c) document.exitPointerLock?.();
    for (const id of [...this.peers.keys()]) this.removePeer(id);
    this.me.sprite?.dispose();
    for (const m of this.marks) m.mesh.material.dispose();
    for (const g of this.markGeo || []) g.dispose();
    for (const t of Object.values(this.textures)) t.dispose();
    if (this.room) disposeTree(this.room.holder);
    this.renderer.renderLists.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    c.remove();
    this.photoEl.remove();
    this.overlay.remove();
    this.stick.remove();
    delete this.container.__walk;
    this.handlers = {};
  }
}
