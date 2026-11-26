/* ============================================================================
   RoomViewer: a plain three.js viewer for one memory spot (or a group of them).
   No React in here, so it can move to another site as is.

     const v = new RoomViewer(container, { reducedMotion });
     v.load({ scene, glbUrl, posterUrl, photos: [{ photo, url, width, height }], scanUrl });
     v.loadGroup({ rooms: [{ id, scene, glbUrl }] });
     v.setMode('model' | 'scan');   v.flyToPhoto(n);   v.setBlend(0..1);
     v.home();   v.focusRoom(id);   v.retry();   v.setSize(w, h);
     v.setSpin(true | false);      // the slow turntable (state.spin); a drag, a viewpoint or a hidden tab stops it
     v.setFurnished(true | false); // furniture on / off with the empty bake's atlases (state.furnished, state.canEmpty;
                                   // spec.emptyUrl / rooms[].emptyUrl = the texture-only empty GLB, furnishing.js)
     const off = v.on('state' | 'viewpoint' | 'pin' | 'room' | 'interact', fn);
     v.dispose();

   Blender did all the lighting (CONTRACTS.md §4), so every material is unlit
   and the output is display-referred: sRGB out, no tone mapping. The canvas is
   transparent over the CSS stage colour (--mr-stage), so themes just work.

   Frames are drawn on demand only (controls moving, a tween running, a load
   finishing, Spark re-sorting), never in an idle loop.

   The container gets data-mr="viewer", data-state="loading|ready|error" and
   data-mode="model|scan|preview" (the headless page check reads these).
   ========================================================================== */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { sceneBounds, verticalFov } from '../scene/geometry.js';
import { COPY } from '../copy.js';
import { applyBakedMaterials } from './bakedMaterials.js';
import { Landscape } from '../landscape/Landscape.js';
import { LandOverlay } from '../landscape/overlay.js';
import { buildLayoutPreview } from './layoutPreview.js';
import { applyDollhouse, hiddenAtView, indexRoom, stepFades } from './dollhouse.js';
import { CUT_Y, PlanCut } from './planCut.js';
import { aimCamera, buildCameraGlyphs, buildDraftingGround } from './helpers.js';
import { DISSOLVE_MS, MIN_RECALL_MS, ROOM_FADE_MS, buildRecall, roomMaterials, setRoomAlpha } from './recall.js';
import { resolveShell } from '../scene/shell.js';
import { loadScan } from './scan.js';
import { disposeTree } from './dispose.js';
import { disposeFurnishing, emptyMapsFrom, indexFurnishing, setFurnitureShown, swapAtlases } from './furnishing.js';

const RAD = Math.PI / 180;
const _north = new THREE.Vector3(0, 0, -1);
const _tmpFar = new THREE.Vector3();
const RECALL_WAIT_MS = 1200; // how long a room that arrived first waits for its cloud
const ORBIT_FOV = 35; // vertical, degrees: long-ish lens = miniature feel
// the near plane (nearFor): 1 % of the orbit distance, between 5 cm and 1 m
const NEAR_MIN = 0.05;
const NEAR_MAX = 1;
const NEAR_PER_M = 0.01;
const FLY_MS = 800;
const RETURN_MS = 700;
const REVEAL_MS = 1900;
const FOCUS_MS = 700;
const PHOTO_FADE_MS = 420;
const DEFAULT_BLEND = 1; // arriving at a viewpoint shows the real photo
const TAP_PX = 6;
const SPIN_TURN_S = 75; // one slow turn of the turntable, seconds
const SPIN_RAMP_MS = 1800; // eased up to speed / down to a stop

const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const easeOut = (t) => 1 - (1 - t) ** 3;
const prefersReducedMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Largest rect of `aspect` inside w × h minus a margin, centred. */
function containRect(aspect, w, h, pad) {
  const aw = Math.max(1, w - pad * 2);
  const ah = Math.max(1, h - pad * 2);
  let rw = aw;
  let rh = aw / aspect;
  if (rh > ah) {
    rh = ah;
    rw = ah * aspect;
  }
  return { x: (w - rw) / 2, y: (h - rh) / 2, w: rw, h: rh };
}

/** Bounds a framing should fit: the shell (or the whole site plate) plus every object. */
function framingBox(scene) {
  const b = sceneBounds(scene);
  return new THREE.Box3(new THREE.Vector3(...b.min), new THREE.Vector3(...b.max));
}

/** A local box → world box through an object's matrix (8 corners). */
function boxToWorld(box, obj) {
  const out = new THREE.Box3();
  const p = new THREE.Vector3();
  for (let i = 0; i < 8; i++) {
    p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z);
    out.expandByPoint(obj.localToWorld(p));
  }
  return out;
}

export class RoomViewer {
  constructor(container, { reducedMotion } = {}) {
    this.container = container;
    this.reducedMotion = reducedMotion ?? prefersReducedMotion();
    this.handlers = {};
    this.disposed = false;

    this.spec = null;
    this.isGroup = false;
    this.baseMode = 'model';
    this.mode = 'model';
    this.status = { main: { state: 'loading', progress: 0, error: null }, scan: { state: 'idle', progress: 0, error: null } };
    this.view = 'orbit'; // orbit | viewpoint
    this.flying = false;
    this.activePhoto = null;
    this.blend = DEFAULT_BLEND;
    this.rooms = [];
    this.pins = [];
    this.openPin = null;
    this.focused = null;
    this.tweens = new Set();
    this.rectT = 0; // 0 = whole canvas, 1 = letterboxed to the photo
    this.letterAspect = null;
    this.loadToken = 0;
    this.poses = {};
    this.limits = {};
    this.scan = null;
    this.scanLoading = null;
    this.occlusionDirty = false;
    this.raf = 0;
    this.spin = null; // { on, speed (rad/s) } while the turntable runs or eases out
    this.furnished = true; // false = furniture hidden, structure on its empty bake (furnishing.js)
    this.emptyLoads = 0; // how many empty texture sets were fetched (the checks: once per room)
    this.width = Math.max(1, container.clientWidth);
    this.height = Math.max(1, container.clientHeight);

    this.stateSnap = { state: 'loading', progress: 0, error: null, mode: 'model', baseMode: 'model', hasScan: false, isGroup: false, spin: false };
    this.vpSnap = { photo: null, blend: DEFAULT_BLEND, flying: false };

    container.dataset.mr = 'viewer';
    container.dataset.state = 'loading';
    container.dataset.mode = 'model';

    // ── DOM: poster, canvas, photo overlay, pin layer ──
    // Posters while a GLB loads: the first photo thumb (small, there at once)
    // under the hero render (fades in once decoded).
    this.posterLow = document.createElement('img');
    this.posterLow.className = 'mr-viewer__poster mr-viewer__poster--low';
    this.posterLow.alt = '';
    this.posterLow.hidden = true;
    this.poster = document.createElement('img');
    this.poster.className = 'mr-viewer__poster';
    this.poster.alt = '';
    this.poster.hidden = true;

    this.photoEl = document.createElement('img');
    this.photoEl.className = 'mr-viewer__photo';
    this.photoEl.alt = '';
    this.photoEl.decoding = 'async';
    this.photoEl.hidden = true;

    this.overlay = document.createElement('div');
    this.overlay.className = 'mr-viewer__overlay';

    this.note = document.createElement('div');
    this.note.className = 'mr-pin-note';
    this.note.setAttribute('role', 'note');
    this.note.hidden = true;

    container.append(this.posterLow, this.poster);

    try {
      this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    } catch (err) {
      this.renderer = null;
      container.append(this.overlay);
      this.setStatus('main', 'error', { error: err });
      return;
    }
    const renderer = this.renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace; // the bake is already display-referred sRGB
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 0);
    renderer.autoClear = false;
    renderer.setSize(this.width, this.height, false);
    this.canvas = renderer.domElement;
    this.canvas.className = 'mr-viewer__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    container.append(this.canvas, this.photoEl, this.overlay);
    // the floor-plan view: everything above 1.2 m clipped, cut walls in section ink (planCut.js)
    this.planCut = new PlanCut(renderer);
    this.plan = false;

    this.camera = new THREE.PerspectiveCamera(ORBIT_FOV, this.width / this.height, 0.05, 900);
    this.camera.position.set(6, 5, 8);
    this.scene = new THREE.Scene();
    this.world = new THREE.Group();
    this.world.name = 'viewer__world';
    this.extras = new THREE.Group();
    this.extras.name = 'viewer__extras';
    this.scene.add(this.world, this.extras);

    const controls = (this.controls = new OrbitControls(this.camera, this.canvas));
    controls.enableDamping = true;
    controls.dampingFactor = 0.085;
    controls.enablePan = false;
    controls.rotateSpeed = 0.7;
    controls.zoomSpeed = 0.8;

    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder); // a live landscape's props are meshopt-compressed
    this.raycaster = new THREE.Raycaster();
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // bound handlers (removed in dispose)
    this.requestRender = this.requestRender.bind(this);
    this.tick = this.tick.bind(this);
    this.onControlsStart = () => {
      this.userMoved = true;
      this.stopSpin(true); // a drag, a pinch or the wheel takes the camera back
      for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
      this.emit('interact', {});
    };
    this.onControlsEnd = () => {
      this.occlusionDirty = true;
      this.requestRender();
    };
    this.onPointerDown = (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    this.onPointerUp = (e) => {
      const d = this.down;
      this.down = null;
      if (!d || Math.hypot(e.clientX - d.x, e.clientY - d.y) > TAP_PX || performance.now() - d.t > 700) return;
      this.pick(e);
    };
    this.onPointerMove = (e) => {
      if (e.pointerType !== 'mouse' || e.buttons) return;
      this.hover(e);
    };
    this.onTheme = () => {
      // tokens recompute after the media query flips; read them next frame
      requestAnimationFrame(() => {
        if (this.disposed) return;
        this.readTheme();
        this.requestRender();
      });
    };

    controls.addEventListener('change', this.requestRender);
    controls.addEventListener('start', this.onControlsStart);
    controls.addEventListener('end', this.onControlsEnd);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.themeQuery = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : null;
    this.themeQuery?.addEventListener('change', this.onTheme);
    // the Memory Rooms theme switch (lib/theme.js) fires 'mr-theme' on window after <html data-mr-theme> changes
    window.addEventListener('mr-theme', this.onTheme);
    this.onHidden = () => {
      if (document.visibilityState === 'hidden') this.stopSpin(true);
    };
    document.addEventListener('visibilitychange', this.onHidden);

    this.readTheme();
    if (import.meta.env.DEV) window.__mrViewer = this;
    container.__viewer = this; // for the headless checks (as the walk's container.__walk)
  }

  // ── events ──────────────────────────────────────────────────────────────

  on(event, fn) {
    (this.handlers[event] ??= new Set()).add(fn);
    if (event === 'view') {
      // the title block mounts once the room is ready, after the last frame: draw one more for it
      this.viewSnap = null;
      this.requestRender();
    }
    return () => this.handlers[event]?.delete(fn);
  }

  emit(event, payload) {
    for (const fn of [...(this.handlers[event] || [])]) fn(payload);
  }

  /** The current state snapshot (what the 'state' event carries). Stable until it changes. */
  getState() {
    return this.stateSnap;
  }

  /** { photo, blend, flying } of the current viewpoint (photo null = orbiting). Stable until it changes. */
  getViewpoint() {
    return this.vpSnap;
  }

  emitViewpoint() {
    this.vpSnap = { photo: this.activePhoto, blend: this.blend, flying: this.flying };
    this.emit('viewpoint', this.vpSnap);
  }

  setStatus(which, state, extra = {}) {
    this.status[which] = { state, progress: extra.progress ?? (state === 'ready' ? 1 : 0), error: extra.error ?? null, recalling: Boolean(extra.recalling) };
    this.syncStatus();
  }

  syncStatus() {
    const s = this.status[this.mode === 'scan' ? 'scan' : 'main'];
    const snap = (this.stateSnap = {
      state: s.state === 'idle' ? 'loading' : s.state,
      progress: s.progress,
      error: s.error,
      recalling: s.recalling,
      mode: this.mode,
      baseMode: this.baseMode,
      hasScan: !!this.spec?.scanUrl,
      isGroup: this.isGroup,
      plan: this.plan,
      canPlan: this.mode !== 'scan' && this.rooms.some((r) => r.interior),
      spin: Boolean(this.spin?.on),
      furnished: this.furnished,
      canEmpty: this.mode !== 'scan' && this.rooms.some((r) => r.emptyUrl),
    });
    this.container.dataset.furnished = this.furnished ? 'on' : 'off';
    this.container.dataset.spin = this.spin?.on ? 'on' : 'off';
    this.container.dataset.state = snap.state;
    this.container.dataset.mode = this.mode;
    this.container.dataset.plan = this.plan ? 'on' : 'off';
    for (const img of [this.posterLow, this.poster]) {
      if (!img) continue;
      const show = this.mode !== 'scan' && this.status.main.state === 'loading' && !this.recall && !!img.getAttribute('src');
      img.classList.toggle('is-hidden', !show);
    }
    this.emit('state', snap);
  }

  // ── loading ─────────────────────────────────────────────────────────────

  /** Drop whatever is loaded and show an empty, loading stage (between spots). */
  clear() {
    if (this.disposed) return;
    this.loadToken++;
    this.clearContent();
    this.spec = null;
    this.setPoster(null);
    this.setStatus('scan', 'idle');
    this.setStatus('main', 'loading');
    this.emitViewpoint();
    this.requestRender();
  }

  /** Load one spot. spec: { scene, glbUrl, mapUrl, posterUrl, photos, scanUrl }. */
  async load(spec) {
    if (this.disposed) return;
    const token = ++this.loadToken;
    this.clearContent();
    this.readTheme(); // the stage may have changed mood (a night spot opens on the dark stage)
    this.spec = spec;
    this.isGroup = false;
    this.baseMode = spec.glbUrl ? 'model' : 'preview';
    this.mode = this.baseMode;
    this.setPoster(spec.posterUrl, spec.posterLowUrl);
    this.setStatus('scan', 'idle');
    this.setStatus('main', 'loading');
    if (!this.renderer) return this.setStatus('main', 'error', { error: new Error('webgl') });
    // "Recall": the small map model loads first and condenses from points while room.glb arrives.
    // Reduced motion skips it (the poster simply crossfades into the room).
    const recalling = spec.glbUrl && spec.mapUrl && spec.scene && !this.reducedMotion ? this.startRecall(spec, token) : null;
    try {
      const root = await this.loadRoot({ glbUrl: spec.glbUrl, scene: spec.scene }, token, (p) => {
        if (token === this.loadToken) this.setStatus('main', 'loading', { progress: p });
      });
      if (!root) return;
      // a cached room can beat its small map model: give the cloud a moment so the recall still plays
      if (recalling && !this.recall) await Promise.race([recalling, new Promise((r) => setTimeout(r, RECALL_WAIT_MS))]);
      // no map model (a spot rendered before them): the room recalls itself from its own surfaces
      else if (!recalling && !spec.mapUrl && spec.glbUrl && spec.scene && !this.reducedMotion) await this.startRecall(spec, token, root);
      if (token !== this.loadToken || this.disposed) {
        disposeTree(root);
        return;
      }
      this.addRoom({ id: 'room', root, scene: spec.scene, frame: null, emptyUrl: spec.emptyUrl || null });
      if (this.recall && this.recall.token === token) this.finishRecall();
      else this.finishLoad({ reveal: true });
    } catch (err) {
      if (token !== this.loadToken || this.disposed) return;
      console.info('[memory-rooms] viewer load failed:', err?.message || err);
      this.failedToken = token;
      this.endRecall();
      this.setStatus('main', 'error', { error: err });
    }
  }

  // ── recall (the signature load) ─────────────────────────────────────────

  /** Load model/map, sample it into points, start condensing them (runs beside the room.glb load). */
  async startRecall(spec, token, from = null) {
    try {
      await this.buildRecallCloud(spec, token, from);
    } catch (err) {
      // the cloud is decoration: whatever went wrong, the room still loads the plain way
      console.info('[memory-rooms] recall skipped:', err?.message || err);
      this.endRecall();
    }
  }

  /**
   * The cloud, from the small map model (it loads before room.glb), or with `from` from a root
   * that's already here (a spot with no map model yet: its room.glb, sampled as it arrives).
   */
  async buildRecallCloud(spec, token, from = null) {
    let mapRoot = from;
    if (!mapRoot) {
      try {
        const gltf = await this.mapLoader().loadAsync(spec.mapUrl);
        mapRoot = gltf.scene;
      } catch (err) {
        console.info('[memory-rooms] recall skipped (no map model):', err?.message || err);
        return;
      }
    }
    const own = !from; // only a map model loaded here is ours to dispose
    // superseded, the room is already up (the map model took too long), or room.glb failed: no cloud
    if (token !== this.loadToken || this.disposed || this.rooms.length || this.failedToken === token) {
      if (own) disposeTree(mapRoot);
      return;
    }
    const scene = spec.scene;
    const box = boxToWorld(framingBox(scene), new THREE.Object3D());
    const interior = scene.kind === 'interior';
    this.landscape = Boolean(scene.site?.terrain);
    const home = this.computeHome(box, interior);
    const centre = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    // the opening view hides the near walls + the ceiling: leave them out of the cloud
    const camAt = home.pose.pos;
    const sh = interior ? resolveShell(scene) : null;
    const ref = sh ? { x: (sh.box.min[0] + sh.box.max[0]) / 2, z: (sh.box.min[1] + sh.box.max[1]) / 2 } : centre;
    const hiddenSet = interior ? hiddenAtView(mapRoot, scene, [camAt.x, camAt.z], [ref.x, ref.z]) : new Set();
    const count = Math.round(Math.min(42000, Math.max(16000, (this.width * this.height) / 22)));
    const cloud = buildRecall(mapRoot, { count, hidden: (m) => hiddenSet.has(m), centre, radius: Math.max(1, 0.5 * Math.hypot(size.x, size.z)), eye: home.pose.pos });
    if (own) disposeTree(mapRoot);
    if (token !== this.loadToken || this.disposed || this.rooms.length || this.failedToken === token) {
      cloud.dispose();
      return;
    }
    this.recall = { token, cloud, t0: performance.now(), revealAt: null, room: null, mats: null };
    this.extras.add(cloud.points);
    // the cloud takes over from the posters at once (they frame the room differently)
    this.poster.classList.add('is-hidden', 'is-quick');
    this.posterLow.classList.add('is-covered', 'is-quick');
    this.container.dataset.recall = 'points';
    // frame the room from the scene alone, and start the opening swing now
    this.limits.main = home.limits;
    this.poses.main = home.pose;
    this.homePose = home.pose;
    this.applyLimits(home.limits);
    this.setOrbitPose(this.offsetPose(home.pose, -38, -10, 1.3));
    this.tweenOrbit(home.pose, REVEAL_MS + 600, easeOut);
    this.recallPosed = true;
    this.requestRender();
  }

  /** room.glb is in: fade the solid room up under the points once the cloud has had its moment. */
  finishRecall() {
    const rc = this.recall;
    this.finishLoad({ reveal: false, keepPose: true, ready: false });
    rc.room = this.rooms[0];
    rc.mats = roomMaterials(rc.room);
    setRoomAlpha(rc.room, rc.mats, 0);
    rc.room.holder.visible = false; // an invisible room would still write depth and punch its shape out of the cloud
    rc.revealAt = Math.max(performance.now(), rc.t0 + MIN_RECALL_MS);
    this.container.dataset.recall = 'room';
    this.requestRender();
  }

  /** Advance the recall each frame. Returns true while it still needs frames. */
  stepRecall(now) {
    const rc = this.recall;
    if (!rc) return false;
    if (this.status.main.state === 'error') {
      this.endRecall();
      return false;
    }
    const elapsed = now - rc.t0;
    let cloudAlpha = Math.min(1, elapsed / 350);
    if (rc.revealAt != null && now >= rc.revealAt) {
      rc.room.holder.visible = true;
      const t = now - rc.revealAt;
      const roomK = Math.min(1, t / ROOM_FADE_MS);
      rc.k = roomK * roomK * (3 - 2 * roomK); // applied in renderNow, after the wall fades step
      cloudAlpha *= 1 - Math.min(1, t / DISSOLVE_MS);
      if (t >= Math.max(ROOM_FADE_MS, DISSOLVE_MS)) {
        setRoomAlpha(rc.room, rc.mats, 1);
        this.endRecall();
        this.occlusionDirty = true;
        this.setStatus('main', 'ready');
        return false;
      }
    }
    rc.cloud.update(elapsed, cloudAlpha);
    return true;
  }

  endRecall() {
    const rc = this.recall;
    if (!rc) return;
    if (rc.room && rc.mats) setRoomAlpha(rc.room, rc.mats, 1);
    if (rc.room) rc.room.holder.visible = true;
    rc.cloud.dispose();
    this.recall = null;
    if (this.container.dataset.recall) this.container.dataset.recall = 'done';
  }

  mapLoader() {
    if (!this._mapLoader) this._mapLoader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    return this._mapLoader;
  }

  /** Load a building: every room placed by its scene.frame. rooms: [{ id, scene, glbUrl }]. */
  async loadGroup({ rooms }) {
    if (this.disposed) return;
    const token = ++this.loadToken;
    this.clearContent();
    this.spec = { rooms };
    this.isGroup = true;
    this.baseMode = rooms.some((r) => r.glbUrl) ? 'model' : 'preview';
    this.mode = this.baseMode;
    this.setPoster(null);
    this.setStatus('scan', 'idle');
    this.setStatus('main', 'loading');
    if (!this.renderer) return this.setStatus('main', 'error', { error: new Error('webgl') });
    const progress = new Array(rooms.length).fill(0);
    const loaded = await Promise.all(
      rooms.map(async (r, i) => {
        try {
          const root = await this.loadRoot(r, token, (p) => {
            progress[i] = p;
            if (token === this.loadToken) this.setStatus('main', 'loading', { progress: progress.reduce((a, b) => a + b, 0) / rooms.length });
          });
          return { r, root };
        } catch {
          // a broken GLB falls back to its layout (or is skipped)
          return { r, root: r.scene && token === this.loadToken ? buildLayoutPreview(r.scene) : null };
        }
      }),
    );
    if (token !== this.loadToken || this.disposed) {
      for (const { root } of loaded) disposeTree(root);
      return;
    }
    for (const { r, root } of loaded) {
      if (root) this.addRoom({ id: r.id, root, scene: r.scene, frame: r.scene?.frame || null, emptyUrl: r.glbUrl ? r.emptyUrl || null : null });
    }
    if (!this.rooms.length) return this.setStatus('main', 'error', { error: new Error('empty group') });
    this.finishLoad({ reveal: true });
  }

  /** GLB (baked) or layout preview for one room. Resolves null if superseded. */
  async loadRoot({ glbUrl, scene }, token, onProgress) {
    if (glbUrl) {
      const gltf = await this.loader.loadAsync(glbUrl, (e) => {
        if (e.lengthComputable && e.total) onProgress(e.loaded / e.total);
      });
      if (token !== this.loadToken || this.disposed) {
        disposeTree(gltf.scene);
        return null;
      }
      // a live landscape (site.terrain.live): built and lit here, not a baked room
      if (scene?.site?.terrain?.live) {
        const coarse = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches;
        const land = await Landscape.fromGltf(gltf, { anisotropy: this.anisotropy, quality: coarse ? 'low' : 'high' });
        if (token !== this.loadToken || this.disposed) {
          land.dispose();
          return null;
        }
        this.land?.dispose();
        this.landOverlay?.dispose();
        this.land = land;
        this.landOverlay = new LandOverlay(this.overlay, land, { pois: scene.site.terrain.live.pois || [], mode: 'orbit' });
        return land.group;
      }
      return applyBakedMaterials(gltf.scene, { anisotropy: this.anisotropy });
    }
    if (scene) return buildLayoutPreview(scene);
    throw new Error('nothing to show');
  }

  addRoom({ id, root, scene, frame, emptyUrl = null }) {
    const holder = new THREE.Group();
    holder.name = `room__${id}`;
    holder.userData.roomId = id;
    if (frame) {
      // same maths as geometry.toGroupFrame
      holder.position.set(frame.origin[0], frame.y || 0, frame.origin[1]);
      holder.rotation.y = (frame.rotY || 0) * RAD;
    }
    holder.add(root);
    this.world.add(holder);
    holder.updateMatrixWorld(true);

    const index = indexRoom(root, scene);
    const interior = scene ? scene.kind === 'interior' : Object.values(index.walls).some((w) => w.length);
    const box = scene ? boxToWorld(framingBox(scene), holder) : new THREE.Box3().setFromObject(holder);
    // the normalised shell (any shape; null for exteriors): the dollhouse centre and AR's life-size footprint
    const shell = interior && scene?.shell ? resolveShell(scene, this.buildings?.get?.(scene.shell.building) || null) : null;
    const centre = shell
      ? holder.localToWorld(new THREE.Vector3((shell.box.min[0] + shell.box.max[0]) / 2, shell.height / 2, (shell.box.min[1] + shell.box.max[1]) / 2))
      : box.getCenter(new THREE.Vector3());
    // structure vs furniture (glTF extras mrKind, else the name rules) and the empty bake to swap to
    const furnishing = indexFurnishing(root);
    this.rooms.push({ id, holder, root, scene, interior, ...index, box, centre, shell, furnishing, emptyUrl });
  }

  finishLoad({ reveal, keepPose = false, ready = true }) {
    this.bounds = new THREE.Box3();
    for (const r of this.rooms) this.bounds.union(r.box);
    this.landscape = this.rooms.some((r) => r.scene?.site?.terrain);
    this.centre = this.bounds.getCenter(new THREE.Vector3());
    this.buildExtras();
    const home = this.computeHome(this.bounds, this.rooms.some((r) => r.interior));
    this.limits.main = home.limits;
    this.poses.main = home.pose;
    this.homePose = home.pose;
    this.applyLimits(home.limits);
    if (keepPose && this.recallPosed) {
      // the recall swung the camera toward a home framed from the scene alone; re-aim the swing at
      // this one (they differ after a resize), unless the visitor has taken over
      if (!this.userMoved) {
        let swing = null;
        for (const tw of this.tweens) if (tw.kind === 'orbit') swing = tw;
        const left = swing ? Math.max(250, swing.ms - (performance.now() - swing.start)) : 350;
        if (swing) this.tweens.delete(swing);
        this.tweenOrbit(home.pose, left, easeOut);
      }
    } else if (reveal && !this.reducedMotion) {
      const start = this.offsetPose(home.pose, -38, -10, 1.3);
      this.setOrbitPose(start);
      this.tweenOrbit(home.pose, REVEAL_MS, easeOut);
    } else {
      this.setOrbitPose(home.pose);
    }
    if (!keepPose) this.userMoved = false;
    this.occlusionDirty = true;
    // a recall stays "loading" (quietly) until the solid room has fully faded up
    if (ready) this.setStatus('main', 'ready');
    else this.setStatus('main', 'loading', { progress: 1, recalling: true });
    this.requestRender();
  }

  /** Hero render (url) over a quick low layer (lowUrl, e.g. the first photo thumb). */
  setPoster(url, lowUrl = null) {
    this.poster.classList.remove('is-quick');
    this.posterLow.classList.remove('is-quick');
    const set = (img, src) => {
      img.classList.remove('is-loaded');
      if (src) {
        // fade in only once decoded, so a slow line never shows half a picture
        img.onload = () => {
          img.classList.add('is-loaded');
          if (img === this.poster) this.posterLow.classList.add('is-covered');
        };
        img.onerror = () => img.classList.remove('is-loaded');
        img.src = src;
        img.hidden = false;
      } else {
        img.onload = null;
        img.removeAttribute('src');
        img.hidden = true;
      }
    };
    this.posterLow.classList.remove('is-covered');
    set(this.poster, url);
    set(this.posterLow, lowUrl);
  }

  /** The drafting-table ground, camera glyphs and pins for what's loaded. */
  buildExtras() {
    const scene = !this.isGroup ? this.spec?.scene : null;
    const exterior = this.rooms.some((r) => !r.interior);
    const size = this.bounds.getSize(new THREE.Vector3());
    let radius;
    let centre;
    let foot;
    const terrain = scene?.site?.terrain || null;
    if (terrain) {
      const [w, d] = terrain.size;
      radius = 0.5 * Math.hypot(w, d) * 1.15;
      centre = [0, 0];
      foot = { min: [-w / 2, -d / 2], max: [w / 2, d / 2] };
    } else if (scene?.site?.ground) {
      const [w, d] = scene.site.ground.size;
      radius = 0.5 * Math.hypot(w, d) * 1.3;
      centre = [0, 0];
      foot = { min: [-w / 2, -d / 2], max: [w / 2, d / 2] };
    } else {
      radius = 0.5 * Math.hypot(size.x, size.z) * (exterior ? 1.5 : 1.55);
      centre = [this.centre.x, this.centre.z];
      foot = { min: [this.bounds.min.x, this.bounds.min.z], max: [this.bounds.max.x, this.bounds.max.z] };
    }
    // a 0.5 m grid with 1 m lines under a room; coarser under a big site or a building
    const span = Math.max(size.x, size.z);
    const cell = span > 1000 ? 50 : span > 40 ? 2 : span > 18 ? 1 : 0.25;
    this.ground = buildDraftingGround({ radius, centre, box: foot, cell, major: cell >= 1 ? 5 : 4, shadow: exterior ? 0.6 : 1 });
    // a landscape stands on the table: the table is at the diorama's base, not at sea level
    if (terrain) this.ground.position.y = terrain.heights[0];
    // a live landscape has its own sea and sky out to the horizon: no table
    if (terrain?.live) this.ground.visible = false;
    this.extras.add(this.ground);

    if (scene?.cameras?.length) {
      const photos = this.spec.photos || [];
      const aspectOf = (cam) => {
        const p = photos.find((x) => x.photo === cam.photo);
        return p?.width && p?.height ? p.width / p.height : cam.aspect ?? 0.75;
      };
      const depth = Math.min(1.6, Math.max(0.3, size.length() * 0.045));
      this.glyphs = buildCameraGlyphs(scene.cameras, aspectOf, depth);
      this.extras.add(this.glyphs.group);
      this.buildCamTags(scene.cameras);
    }
    if (scene?.pins?.length) this.buildPins(scene.pins);
    this.applyTheme();
  }

  // ── theme ───────────────────────────────────────────────────────────────

  readTheme() {
    const css = getComputedStyle(this.container);
    const read = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
    const parse = (value, fallback) => {
      try {
        return new THREE.Color().setStyle(value);
      } catch {
        return new THREE.Color(fallback);
      }
    };
    const stage = parse(read('--mr-stage', '#e9e6df'), '#e9e6df');
    const ink = parse(read('--mr-ink', '#1d1c1a'), '#1d1c1a');
    const a = stage.getRGB({}, THREE.SRGBColorSpace);
    const dark = a.r + a.g + a.b < 1.5;
    // the drafting grid + frustums are ink on the paper; a dark (darkroom / night) stage takes
    // fainter lines so the grid never glows
    const gridInk = parse(read('--mr-grid-ink', dark ? '#ecebe6' : '#1d1c1a'), '#1d1c1a');
    const gridShade = parse(read('--mr-grid-shade', dark ? '#000000' : '#1d1c1a'), '#1d1c1a');
    const num = (name, fallback) => {
      const v = parseFloat(read(name, ''));
      return Number.isFinite(v) ? v : fallback;
    };
    this.theme = {
      ink,
      gridInk,
      gridShade,
      grid: { minor: num('--mr-grid-minor', dark ? 0.07 : 0.09), major: num('--mr-grid-major', dark ? 0.13 : 0.17), shadow: num('--mr-grid-shadow', dark ? 0.34 : 0.15) },
      frustum: parse(read('--mr-frustum', '') || (dark ? '#ecebe6' : '#1d1c1a'), '#1d1c1a'),
      accent: parse(read('--mr-accent', '#b5532f'), '#b5532f'),
    };
    const px = (name, fallback) => {
      const v = parseFloat(read(name, ''));
      return Number.isFinite(v) ? v : fallback;
    };
    this.insets = { top: px('--mr-letterbox-top', 24), side: px('--mr-letterbox-side', 24), bottom: px('--mr-letterbox-bottom', 24) };
    this.applyTheme();
  }

  applyTheme() {
    if (!this.theme) return;
    this.ground?.setColor(this.theme.gridInk, this.theme.grid, this.theme.gridShade);
    this.planCut?.setInk(this.theme.ink);
    this.glyphs?.setColor(this.theme.frustum);
  }

  // ── framing ─────────────────────────────────────────────────────────────

  computeHome(box, interior, { azimuth, elevation } = {}) {
    // a live landscape opens close in (~300 m from its centre, CONTRACTS §6.8), not on the whole block
    const live = !interior && this.land ? this.spec?.scene?.site?.terrain?.live : null;
    if (live) {
      const c = box.getCenter(new THREE.Vector3());
      const target = new THREE.Vector3(c.x, Math.max(0, this.land.field.heightAt(c.x, c.z)) + 4, c.z);
      const d = live.home || 300;
      const az = (azimuth ?? -24) * RAD;
      const el = (elevation ?? 30) * RAD;
      const pos = new THREE.Vector3().setFromSphericalCoords(d, Math.PI / 2 - el, az).add(target);
      return { pose: { pos, target }, limits: { minDistance: 15, maxDistance: d * 4, minPolarAngle: 0.12, maxPolarAngle: 86 * RAD } };
    }
    const size = box.getSize(new THREE.Vector3());
    const centre = box.getCenter(new THREE.Vector3());
    const radius = Math.max(0.5 * size.length(), 0.6);
    const target = new THREE.Vector3(centre.x, box.min.y + Math.min(size.y * (interior ? 0.32 : 0.25), interior ? 1.1 : 3), centre.z);
    const aspect = this.width / this.height;
    const vf = ORBIT_FOV * RAD;
    const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    const az = (azimuth ?? (interior ? 38 : -24)) * RAD;
    const el = (elevation ?? (interior ? 50 : 24)) * RAD;

    // Exact fit: the closest distance at which all 8 box corners sit inside
    // `margin` of the frame, seen from this direction.
    const dir = new THREE.Vector3().setFromSphericalCoords(1, Math.PI / 2 - el, az); // target → camera
    const fwd = dir.clone().negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0)).normalize();
    const up = new THREE.Vector3().crossVectors(right, fwd);
    const margin = this.width < 600 ? 0.8 : 0.84;
    // usable part of the frame once the nav (top) and the bar (bottom) are laid over it
    const ins = this.currentInsets();
    const fT = Math.min(0.3, (ins.top * 0.5) / this.height);
    const fB = Math.min(0.4, ins.bottom / this.height);
    const ndcMid = fB - fT; // centre of the usable band, in NDC y
    const ndcHalf = 1 - fB - fT;
    const tx = Math.tan(hf / 2) * margin;
    const ty = Math.tan(vf / 2) * ndcHalf * margin;
    const p = new THREE.Vector3();
    const corner = (i) => p.set(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).sub(target);
    let dist = radius * 0.5;
    for (let pass = 0; pass < 3; pass++) {
      dist = radius * 0.5;
      for (let i = 0; i < 8; i++) {
        corner(i);
        const z0 = p.dot(fwd);
        dist = Math.max(dist, Math.abs(p.dot(right)) / tx - z0, Math.abs(p.dot(up)) / ty - z0);
      }
      if (pass === 2) break;
      // centre the box in the frame: slide the pivot across the view plane
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (let i = 0; i < 8; i++) {
        corner(i);
        const z = p.dot(fwd) + dist;
        x0 = Math.min(x0, p.dot(right) / z);
        x1 = Math.max(x1, p.dot(right) / z);
        y0 = Math.min(y0, p.dot(up) / z);
        y1 = Math.max(y1, p.dot(up) / z);
      }
      target.addScaledVector(right, ((x0 + x1) / 2) * dist).addScaledVector(up, ((y0 + y1) / 2) * dist);
      target.y = Math.max(target.y, box.min.y + 0.2);
    }
    // aim a little low so the room sits in the middle of the usable band
    target.addScaledVector(up, -ndcMid * Math.tan(vf / 2) * dist);
    const pos = dir.multiplyScalar(dist).add(target);
    return {
      pose: { pos, target },
      limits: {
        // a landscape is worth getting close to: down to a few hundred metres above a km-wide block
        minDistance: dist * (this.landscape ? 0.04 : 0.3),
        maxDistance: dist * 2.2,
        minPolarAngle: 0.12,
        maxPolarAngle: (interior ? 82 : 85) * RAD,
      },
    };
  }

  /** A pose turned by dAz degrees, raised by dEl, pushed out by `scale`. */
  offsetPose(pose, dAz, dEl, scale) {
    const s = new THREE.Spherical().setFromVector3(pose.pos.clone().sub(pose.target));
    s.theta += dAz * RAD;
    s.phi = Math.max(0.15, s.phi + dEl * RAD);
    s.radius *= scale;
    return { pos: new THREE.Vector3().setFromSpherical(s).add(pose.target), target: pose.target.clone() };
  }

  applyLimits(l) {
    Object.assign(this.controls, l);
  }

  setOrbitPose(pose) {
    const { camera, controls } = this;
    camera.up.set(0, 1, 0);
    camera.position.copy(pose.pos);
    controls.target.copy(pose.target);
    camera.fov = ORBIT_FOV;
    camera.lookAt(pose.target);
    camera.updateProjectionMatrix();
    controls.update();
  }

  captureOrbit() {
    return { pos: this.camera.position.clone(), target: this.controls.target.clone() };
  }

  /** Orbit-style move: target + spherical offset, so it swings round, not through. */
  tweenOrbit(to, ms, easing = easeInOut, done) {
    const fromT = this.controls.target.clone();
    const from = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(fromT));
    const goal = new THREE.Spherical().setFromVector3(to.pos.clone().sub(to.target));
    let dTheta = goal.theta - from.theta;
    dTheta = Math.atan2(Math.sin(dTheta), Math.cos(dTheta));
    const s = new THREE.Spherical();
    const t3 = new THREE.Vector3();
    this.tween({
      kind: 'orbit',
      ms,
      easing,
      step: (t) => {
        t3.lerpVectors(fromT, to.target, t);
        s.set(lerp(from.radius, goal.radius, t), lerp(from.phi, goal.phi, t), from.theta + dTheta * t);
        this.camera.position.setFromSpherical(s).add(t3);
        this.controls.target.copy(t3);
        this.camera.lookAt(t3);
      },
      done,
      goal: { pos: to.pos.clone(), target: to.target.clone() },
    });
  }

  tween({ kind, ms, easing, step, done, goal = null }) {
    const tw = { kind, start: performance.now(), ms: this.reducedMotion ? 0 : ms, easing, step, done, goal };
    this.tweens.add(tw);
    this.requestRender();
    return tw;
  }

  // ── viewpoints ──────────────────────────────────────────────────────────

  /** Fly to the camera that took photo n and lay the real photo over the model. */
  flyToPhoto(n) {
    if (this.disposed || !this.renderer || this.isGroup || this.mode === 'scan') return false;
    if (this.status.main.state !== 'ready') return false;
    if (this.plan) this.setPlan(false, { animate: false });
    const cam = (this.spec?.scene?.cameras || []).find((c) => c.photo === Number(n));
    if (!cam) return false;
    this.stopSpin(true);
    const photo = (this.spec.photos || []).find((p) => p.photo === cam.photo);
    const aspect = photo?.width && photo?.height ? photo.width / photo.height : cam.aspect ?? 0.75;

    // keep the orbit pose to come back to (not a pose caught mid-flight)
    if (this.view === 'orbit' && !this.flying) this.poses.main = this.captureOrbit();
    this.tweens.clear();
    this.closePin();
    this.view = 'viewpoint';
    this.flying = true;
    this.activePhoto = cam.photo;
    this.controls.enabled = false;
    this.letterAspect = aspect;
    if (this.blend <= 0.001) this.blend = DEFAULT_BLEND;

    this.photoEl.style.opacity = '0';
    if (photo?.url) {
      if (this.photoEl.getAttribute('src') !== photo.url) this.photoEl.src = photo.url;
      this.photoEl.hidden = false;
    } else {
      this.photoEl.hidden = true;
    }

    const goal = new THREE.PerspectiveCamera();
    aimCamera(goal, cam.pos, cam.look, cam.roll || 0, true);
    const from = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), fov: this.camera.fov, rect: this.rectT };
    const to = { pos: goal.position.clone(), quat: goal.quaternion.clone(), fov: verticalFov(cam, aspect) };
    this.tween({
      kind: 'fly',
      ms: FLY_MS,
      easing: easeInOut,
      step: (t) => {
        this.camera.position.lerpVectors(from.pos, to.pos, t);
        this.camera.quaternion.slerpQuaternions(from.quat, to.quat, t);
        this.camera.fov = lerp(from.fov, to.fov, t);
        this.rectT = lerp(from.rect, 1, t);
      },
      done: () => {
        this.flying = false;
        this.occlusionDirty = true;
        this.fadePhoto(this.blend);
        this.emitViewpoint();
      },
    });
    this.emitViewpoint();
    return true;
  }

  fadePhoto(to) {
    const from = Number(this.photoEl.style.opacity || 0);
    for (const tw of this.tweens) if (tw.kind === 'photo') this.tweens.delete(tw);
    this.tween({
      kind: 'photo',
      ms: PHOTO_FADE_MS,
      easing: easeInOut,
      step: (t) => {
        this.photoEl.style.opacity = String(lerp(from, to, t));
      },
    });
  }

  /** 0 = model only, 1 = photo only. */
  setBlend(v) {
    this.blend = clamp01(Number(v) || 0);
    for (const tw of this.tweens) if (tw.kind === 'photo') this.tweens.delete(tw);
    if (this.view === 'viewpoint' && !this.flying) this.photoEl.style.opacity = String(this.blend);
    this.emitViewpoint();
  }

  /** Back to the orbit (from a viewpoint), or back to the opening view. */
  /**
   * "Walk in": the camera dives down into the room toward where you'll stand (the first photo
   * camera, else the middle at eye height), then the page crossfades into the walk. Resolves
   * when the dive ends (at once with reduced motion, or when there's nothing to dive into).
   */
  diveIn(ms = 560) {
    if (this.reducedMotion || !this.rooms.length || this.view !== 'orbit' || this.mode === 'scan') return Promise.resolve();
    const scene = this.spec?.scene;
    const cam = (scene?.cameras || [])[0];
    const c = this.centre || new THREE.Vector3();
    const eye = cam ? new THREE.Vector3(...cam.pos) : new THREE.Vector3(c.x, 1.5, c.z);
    eye.y = Math.max(1.2, Math.min(1.7, eye.y));
    const look = cam ? new THREE.Vector3(...cam.look) : new THREE.Vector3(c.x, 1.0, c.z + 1);
    // stop a little short of the eye point, looking along the photo's line
    const dir = look.clone().sub(eye).normalize();
    const to = { pos: eye.clone().addScaledVector(dir, -0.6).setY(eye.y + 0.35), target: look };
    this.stopSpin(true);
    this.controls.enabled = false;
    this.diving = true;
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.diving = false;
        resolve();
      };
      for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
      this.tweenOrbit(to, ms, (t) => t * t * t, finish);
      setTimeout(finish, ms + 250); // a backstop: the walk always opens
      this.requestRender();
    });
  }

  home() {
    if (this.disposed || !this.renderer) return;
    if (this.view === 'viewpoint') {
      const pose = this.poses.main || this.homePose;
      this.tweens.clear();
      this.view = 'orbit';
      this.flying = true;
      this.activePhoto = null;
      this.photoEl.style.opacity = '0';
      const look = new THREE.PerspectiveCamera();
      look.position.copy(pose.pos);
      look.lookAt(pose.target);
      const from = { pos: this.camera.position.clone(), quat: this.camera.quaternion.clone(), fov: this.camera.fov, rect: this.rectT };
      this.tween({
        kind: 'fly',
        ms: RETURN_MS,
        easing: easeInOut,
        step: (t) => {
          this.camera.position.lerpVectors(from.pos, pose.pos, t);
          this.camera.quaternion.slerpQuaternions(from.quat, look.quaternion, t);
          this.camera.fov = lerp(from.fov, ORBIT_FOV, t);
          this.rectT = lerp(from.rect, 0, t);
        },
        done: () => {
          this.flying = false;
          this.letterAspect = null;
          this.photoEl.hidden = true;
          this.controls.enabled = true;
          this.setOrbitPose(pose);
          this.occlusionDirty = true;
          this.emitViewpoint();
        },
      });
      this.emitViewpoint();
      return;
    }
    if (this.flying) return; // already on the way back
    if (this.buildingRefit) {
      this.buildingRefit(true);
      return;
    }
    const pose = this.mode === 'scan' ? this.scanHome?.pose : this.plan && this.poses.planHome ? this.poses.planHome : this.homePose;
    this.focused = null;
    if (pose) this.tweenOrbit(pose, FOCUS_MS);
    this.emit('room', { id: null });
  }

  /** Drop out of a viewpoint at once (mode switch, reload). */
  exitViewpointNow() {
    for (const tw of this.tweens) if (tw.kind === 'fly' || tw.kind === 'photo') this.tweens.delete(tw);
    const pose = this.poses.main || this.homePose;
    this.view = 'orbit';
    this.flying = false;
    this.activePhoto = null;
    this.letterAspect = null;
    this.rectT = 0;
    this.photoEl.style.opacity = '0';
    this.photoEl.hidden = true;
    if (this.controls) this.controls.enabled = true;
    if (pose && this.controls) this.setOrbitPose(pose);
    this.emitViewpoint();
  }

  // ── group focus ─────────────────────────────────────────────────────────

  focusRoom(id) {
    const room = this.rooms.find((r) => r.id === id);
    if (!room || this.view !== 'orbit' || this.mode === 'scan') return;
    this.focused = id;
    const fit = this.computeHome(room.box, room.interior);
    const s = new THREE.Spherical().setFromVector3(this.camera.position.clone().sub(this.controls.target));
    const g = new THREE.Spherical().setFromVector3(fit.pose.pos.clone().sub(fit.pose.target));
    s.radius = Math.min(Math.max(g.radius, this.controls.minDistance), this.controls.maxDistance);
    const pose = { pos: new THREE.Vector3().setFromSpherical(s).add(fit.pose.target), target: fit.pose.target };
    this.tweenOrbit(pose, FOCUS_MS);
    this.emit('room', { id });
  }

  // ── model ⇄ scan ────────────────────────────────────────────────────────

  setMode(mode) {
    if (this.disposed || !this.renderer) return;
    const want = mode === 'scan' ? 'scan' : this.baseMode;
    if (want === this.mode) return;
    if (want === 'scan' && !this.spec?.scanUrl) return;
    this.stopSpin(true);
    if (this.plan) this.setPlan(false, { animate: false });
    if (this.view !== 'orbit' || this.flying) this.exitViewpointNow();
    for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
    this.closePin();
    this.poses[this.mode === 'scan' ? 'scan' : 'main'] = this.captureOrbit();
    this.mode = want;

    if (want === 'scan') {
      if (this.scan) {
        this.applyLimits(this.limits.scan);
        this.setOrbitPose(this.poses.scan || this.scanHome.pose);
      } else if (!this.scanLoading) {
        this.loadScanNow();
      }
    } else {
      this.applyLimits(this.limits.main);
      this.setOrbitPose(this.poses.main || this.homePose);
    }
    this.syncStatus();
    this.occlusionDirty = true;
    this.requestRender();
  }

  /**
   * The plan cut on / off (interiors only): clip everything above CUT_Y, ink the cut walls,
   * swing to a near top-down view with north up. Off swings back to where you were.
   */
  setPlan(on, { animate = true } = {}) {
    if (this.disposed || !this.renderer) return;
    const want = Boolean(on) && this.mode !== 'scan' && this.rooms.some((r) => r.interior);
    if (want === this.plan) return;
    if (this.view !== 'orbit' || this.flying) this.exitViewpointNow();
    this.closePin();
    const goingTo = [...this.tweens].find((tw) => tw.kind === 'orbit' && tw.goal)?.goal;
    this.plan = want;
    if (want) {
      // "where you were": a swing still under way counts as arrived (fast Room / Plan toggles)
      this.poses.beforePlan = goingTo ? { pos: goingTo.pos.clone(), target: goingTo.target.clone() } : this.captureOrbit();
      for (const room of this.rooms) if (room.interior) this.planCut.apply(room, this.theme?.ink);
      const box = this.bounds.clone();
      box.max.y = Math.min(box.max.y, box.min.y + CUT_Y);
      const plan = this.computeHome(box, true, { azimuth: 0, elevation: 82 });
      // a plan only tilts a little (further, the walls' outsides show)
      this.applyLimits({ ...plan.limits, maxPolarAngle: 28 * RAD });
      this.poses.planHome = plan.pose;
      for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
      if (animate) this.tweenOrbit(plan.pose, 700);
      else this.setOrbitPose(plan.pose);
    } else {
      this.planCut.removeAll();
      this.applyLimits(this.limits.main);
      const back = this.poses.beforePlan || this.homePose;
      this.poses.beforePlan = null;
      this.poses.planHome = null;
      for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
      if (animate) this.tweenOrbit(back, 600);
      else this.setOrbitPose(back);
    }
    this.syncStatus();
    this.occlusionDirty = true;
    this.requestRender();
  }

  loadScanNow() {
    const token = this.loadToken;
    this.setStatus('scan', 'loading');
    this.scanLoading = loadScan({
      url: this.spec.scanUrl,
      renderer: this.renderer,
      onDirty: this.requestRender,
      onProgress: (p) => {
        if (token === this.loadToken && this.status.scan.state === 'loading') this.setStatus('scan', 'loading', { progress: p });
      },
      isStale: () => token !== this.loadToken || this.disposed,
    })
      .then((res) => {
        if (!res) return;
        this.scan = res;
        this.scanHome = this.computeHome(res.bounds, true, { azimuth: 30, elevation: 32 });
        this.limits.scan = this.scanHome.limits;
        if (this.mode === 'scan') {
          this.applyLimits(this.limits.scan);
          this.setOrbitPose(this.scanHome.pose);
        }
        this.setStatus('scan', 'ready');
        this.requestRender();
      })
      .catch((err) => {
        if (token !== this.loadToken || this.disposed) return;
        console.info('[memory-rooms] scan load failed:', err?.message || err);
        this.setStatus('scan', 'error', { error: err });
      })
      .finally(() => {
        if (token === this.loadToken) this.scanLoading = null;
      });
  }

  /** Retry whatever failed (the scan in scan mode, else the room). */
  retry() {
    if (this.mode === 'scan') {
      if (this.status.scan.state === 'error') this.loadScanNow();
      return;
    }
    if (this.isGroup) this.loadGroup(this.spec);
    else if (this.spec) this.load(this.spec);
  }

  // ── pins ────────────────────────────────────────────────────────────────

  /**
   * Pins are drawn like a drawing's numbered annotations: a dot on the thing,
   * a hairline leader out to the stage's margin, and the callout there
   * ("01  The bed we didn't sleep in"). The callout is the button.
   */
  buildPins(pins) {
    const copy = COPY.viewer;
    const SVG = 'http://www.w3.org/2000/svg';
    this.leaders = document.createElementNS(SVG, 'svg');
    this.leaders.setAttribute('class', 'mr-leaders');
    this.leaders.setAttribute('aria-hidden', 'true');
    this.overlay.append(this.leaders);
    this.pins = pins.map((pin, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mr-pin';
      btn.dataset.mr = 'pin';
      btn.dataset.index = String(i);
      const num = document.createElement('span');
      num.className = 'mr-pin__n';
      num.textContent = copy.pinNumber ? copy.pinNumber(i + 1) : String(i + 1).padStart(2, '0');
      const txt = document.createElement('span');
      txt.className = 'mr-pin__t';
      txt.textContent = pin.text;
      btn.append(num, txt);
      btn.setAttribute('aria-label', copy.pinLabel ? copy.pinLabel(i + 1, pin.text) : `Pin ${i + 1}`);
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePin(i);
      });
      const dot = document.createElement('span');
      dot.className = 'mr-pin-dot';
      dot.setAttribute('aria-hidden', 'true');
      const line = document.createElementNS(SVG, 'polyline');
      line.setAttribute('class', 'mr-leader');
      this.leaders.append(line);
      this.overlay.append(dot, btn);
      return { pin, el: btn, dot, line, pos: new THREE.Vector3(...pin.at), screen: null, occluded: false, side: null };
    });
    this.overlay.append(this.note);
  }

  /** Lay the callouts out down the two margins (no overlaps, clear of the title block) and draw the leaders. */
  layoutPins(r, showPins) {
    const compact = this.width < 600;
    const ins = this.currentInsets();
    const margin = compact ? 10 : 20;
    const labelW = compact ? 30 : Math.min(230, Math.max(150, r.w * 0.2));
    const gap = compact ? 38 : 44;
    const top = Math.max(r.y, ins.top) + (compact ? 44 : 56);
    const bottomL = Math.min(r.y + r.h, this.height - ins.bottom) - 28;
    const bottomR = bottomL - (compact ? 96 : 132); // the title block sits bottom-right
    const v = new THREE.Vector3();
    const shown = [];
    for (const p of this.pins) {
      v.copy(p.pos).applyMatrix4(this.camera.matrixWorldInverse);
      const behind = v.z > -this.camera.near;
      v.applyMatrix4(this.camera.projectionMatrix);
      const x = r.x + ((v.x + 1) / 2) * r.w;
      const y = r.y + ((1 - v.y) / 2) * r.h;
      const inside = !behind && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
      const visible = showPins && inside && !this.flying;
      p.screen = visible ? [x, y] : null;
      p.el.hidden = !visible;
      p.dot.hidden = !visible;
      p.line.style.display = visible ? '' : 'none';
      if (!visible) continue;
      // which margin: the nearer one, with a little hysteresis so labels don't flick while orbiting
      const mid = r.x + r.w / 2 + (p.side === 'left' ? 1 : p.side === 'right' ? -1 : 0) * r.w * 0.07;
      p.side = x < mid ? 'left' : 'right';
      shown.push({ p, x, y, ly: y - (compact ? 28 : 44) });
    }
    for (const side of ['left', 'right']) {
      const list = shown.filter((s) => s.p.side === side).sort((a, b) => a.y - b.y);
      const bottom = side === 'right' ? bottomR : bottomL;
      let prev = -Infinity;
      for (const s of list) {
        s.ly = Math.max(s.ly, prev + gap, top);
        prev = s.ly;
      }
      const over = list.length ? list[list.length - 1].ly - bottom : 0;
      if (over > 0) for (const s of list) s.ly -= over;
      for (const s of list) s.ly = Math.max(top, s.ly);
    }
    for (const { p, x, y, ly } of shown) {
      const left = p.side === 'left';
      const edge = left ? r.x + margin + labelW : r.x + r.w - margin - labelW; // where the leader meets the callout
      const elbow = left ? Math.min(edge + 26, x - 6) : Math.max(edge - 26, x + 6);
      p.line.setAttribute('points', `${x.toFixed(1)},${y.toFixed(1)} ${elbow.toFixed(1)},${ly.toFixed(1)} ${edge.toFixed(1)},${ly.toFixed(1)}`);
      p.dot.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      p.el.dataset.side = p.side;
      p.el.style.width = `${labelW}px`;
      p.el.style.transform = `translate(${(left ? r.x + margin : edge).toFixed(1)}px, ${ly.toFixed(1)}px)`;
      p.labelAt = [left ? r.x + margin : edge, ly];
    }
  }

  togglePin(i) {
    if (this.openPin === i) return this.closePin();
    const p = this.pins[i];
    if (!p) return;
    if (this.openPin != null) this.pins[this.openPin]?.el.setAttribute('aria-expanded', 'false');
    this.openPin = i;
    p.el.setAttribute('aria-expanded', 'true');
    this.note.replaceChildren();
    // the callout already shows the words on a wide stage (expanded when open); a phone shows only its number
    if (this.width < 600) {
      const text = document.createElement('p');
      text.className = 'mr-pin-note__text';
      text.textContent = p.pin.text;
      this.note.append(text);
    }
    const cam = p.pin.photo && (this.spec?.scene?.cameras || []).find((c) => c.photo === p.pin.photo);
    if (cam && this.activePhoto !== cam.photo) {
      const go = document.createElement('button');
      go.type = 'button';
      go.className = 'mr-pin-note__go';
      go.textContent = COPY.viewer.pinPhoto ? COPY.viewer.pinPhoto(cam.photo) : `Photo ${cam.photo}`;
      go.addEventListener('click', (e) => {
        e.stopPropagation();
        this.flyToPhoto(cam.photo);
      });
      this.note.append(go);
    }
    this.note.hidden = !this.note.childElementCount;
    this.emit('pin', { index: i, open: true });
    this.requestRender();
  }

  closePin() {
    if (this.openPin == null) return;
    const i = this.openPin;
    this.pins[i]?.el.setAttribute('aria-expanded', 'false');
    this.openPin = null;
    this.note.hidden = true;
    this.emit('pin', { index: i, open: false });
  }

  // ── picking ─────────────────────────────────────────────────────────────

  ndcFromEvent(e) {
    const bounds = this.canvas.getBoundingClientRect();
    const r = this.viewRect();
    const x = e.clientX - bounds.left - r.x;
    const y = e.clientY - bounds.top - r.y;
    if (x < 0 || y < 0 || x > r.w || y > r.h) return null;
    return new THREE.Vector2((x / r.w) * 2 - 1, -(y / r.h) * 2 + 1);
  }

  pickGlyph(e) {
    if (!this.glyphs || this.view !== 'orbit' || this.mode === 'scan' || !this.glyphs.group.visible) return null;
    const ndc = this.ndcFromEvent(e);
    if (!ndc) return null;
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.glyphs.picks, false)[0];
    return hit ? hit.object.userData.photo : null;
  }

  pick(e) {
    if (this.view !== 'orbit' || this.flying || this.diving) return;
    const photo = this.pickGlyph(e);
    if (photo != null) {
      this.flyToPhoto(photo);
      return;
    }
    if (this.openPin != null) this.closePin();
    if (this.isGroup && this.mode !== 'scan') {
      const ndc = this.ndcFromEvent(e);
      if (!ndc) return;
      this.raycaster.setFromCamera(ndc, this.camera);
      // a building's plan cut: what's above the cut is gone, so a tap goes through it
      const hit = this.raycaster.intersectObjects(this.visibleMeshes(), false).find((h) => h.point.y <= this.cutYOf(h.object));
      let o = hit?.object;
      while (o && o.userData.roomId == null) o = o.parent;
      // a building page picks rooms itself (its "rooms" here are whole levels): it gets the point
      if (this.buildingMode) {
        if (hit && o) this.emit('tap', { point: hit.point.clone().sub(o.position), world: hit.point.clone(), roomId: o.userData.roomId });
        return;
      }
      if (o) this.focusRoom(o.userData.roomId);
    }
  }

  // ── buildings (viewer/buildingStage.js drives these; rooms = level-<id> + exterior) ──

  roomById(id) {
    return this.rooms.find((r) => r.id === id) || null;
  }

  setRoomVisible(id, on) {
    const r = this.roomById(id);
    if (!r) return;
    r.shown = on;
    on = on && (r.alpha ?? 1) > 0.01;
    if (r.holder.visible === on) return;
    r.holder.visible = on;
    this.occlusionDirty = true;
    this.requestRender();
  }

  /** Lift a whole room (a level) by y metres: the building's pulled-apart levels. */
  setRoomOffset(id, y) {
    const r = this.roomById(id);
    if (!r) return;
    r.holder.position.y = y;
    r.holder.updateMatrixWorld(true);
    this.occlusionDirty = true;
    this.requestRender();
  }

  /** Move a whole room (a level) to [x, y, z] (world metres): the plan's side-by-side levels. */
  setRoomPosition(id, [x, y, z]) {
    const r = this.roomById(id);
    if (!r) return;
    r.holder.position.set(x, y, z);
    r.holder.updateMatrixWorld(true);
    this.occlusionDirty = true;
    this.requestRender();
  }

  /** Fade a whole room (a level lifting away) to alpha a, on top of its dollhouse fades; ~0 hides it. */
  setRoomFade(id, a) {
    const r = this.roomById(id);
    if (!r) return;
    a = clamp01(a);
    if (a === (r.alpha ?? 1)) return;
    r.alpha = a;
    r.holder.visible = a > 0.01 && r.shown !== false;
    this.requestRender();
  }

  /** The drafting table under a building's plan layout ({ centre, radius, box | null }), or back home (no arg). */
  setGround(foot) {
    this.ground?.setFoot?.(foot);
    this.requestRender();
  }

  /**
   * Labels drawn over the stage at world points (a level's name above its plan): [{ id, text, at: [x, y, z] }].
   * Mono small caps in the Recall style, placed every frame; [] clears them.
   */
  setLabels(list = []) {
    for (const l of this.labels || []) l.el.remove();
    this.labels = list.map(({ id, text, at }) => {
      const el = document.createElement('span');
      el.className = 'mr-stagelabel mr-label';
      el.dataset.mr = 'stage-label';
      el.dataset.id = id;
      el.textContent = text;
      this.overlay.append(el);
      return { id, el, pos: new THREE.Vector3(...at) };
    });
    this.requestRender();
  }

  /** 'auto' (the dollhouse as usual), 'never' (every wall and ceiling up) or 'always'. */
  setRoomCutaway(id, mode) {
    const r = this.roomById(id);
    if (!r) return;
    r.cutawayMode = mode;
    this.requestRender();
  }

  /** A building level's plan cut: clip at world height y, the walls' section cap given (plan frame triangles). */
  setBuildingCut(id, { y, cap }) {
    const r = this.roomById(id);
    if (!r) return;
    this.planCut.apply(r, this.theme?.ink, { y, cap });
    this.cutLevels = (this.cutLevels || new Map()).set(r, y);
    this.requestRender();
  }

  clearBuildingCuts() {
    for (const r of this.cutLevels?.keys() || []) this.planCut.remove(r);
    this.cutLevels = new Map();
    this.requestRender();
  }

  /** World height above which a hit on `obj` doesn't count (a cut), else Infinity. */
  cutYOf(obj) {
    if (this.plan) return this.planCutY(obj);
    if (!this.cutLevels?.size) return Infinity;
    for (const [r, y] of this.cutLevels) {
      let o = obj;
      while (o && o !== r.holder) o = o.parent;
      if (o) return y;
    }
    return Infinity;
  }

  /** Lift the nodes of a room whose names match `re` (the exterior's roof) by `lift` m, at `opacity`. */
  setNodeLift(id, re, lift, opacity = 1) {
    const r = this.roomById(id);
    if (!r) return;
    r.root.traverse((o) => {
      if (!re.test(o.name || '') || !o.parent || re.test(o.parent.name || '')) return;
      if (o.userData.baseY == null) o.userData.baseY = o.position.y;
      o.position.y = o.userData.baseY + lift;
      o.visible = opacity > 0.01;
      o.traverse((c) => {
        if (!c.isMesh) return;
        if (!c.userData.liftOwn) {
          // its own copy: fading the roof must not fade (or reorder) the ground and trees sharing its atlas
          c.material = Array.isArray(c.material) ? c.material.map((m) => m.clone()) : c.material.clone();
          for (const m of Array.isArray(c.material) ? c.material : [c.material]) {
            m.userData.baseOpacity = m.opacity;
            m.userData.baseTransparent = m.transparent;
          }
          c.userData.liftOwn = true;
        }
        for (const m of Array.isArray(c.material) ? c.material : [c.material]) {
          const transparent = m.userData.baseTransparent || opacity < 1;
          if (m.transparent !== transparent) m.needsUpdate = true; // the shader is built opaque or not
          m.opacity = m.userData.baseOpacity * opacity;
          m.transparent = transparent;
          m.depthWrite = opacity >= 1;
        }
      });
    });
    this.occlusionDirty = true;
    this.requestRender();
  }

  /** Frame what's visible for a building stage: from the house's south-east, or north-up for a plan. */
  frameBuilding(stage, { elevation = 30, animate = true, only = null, goal = null } = {}) {
    // `goal`: where the levels are going ({ min, max } world box) when they are still easing there
    const box = goal ? new THREE.Box3(new THREE.Vector3(...goal.min), new THREE.Vector3(...goal.max)) : new THREE.Box3();
    if (!goal) for (const r of this.rooms) if (r.holder.visible && (!only || only.includes(r.id))) box.expandByObject(r.holder);
    if (box.isEmpty()) return;
    const home = this.computeHome(box, stage !== 'outside', { azimuth: stage === 'plan' ? 0 : 38, elevation });
    this.applyLimits(stage === 'plan' ? { ...home.limits, maxPolarAngle: 28 * RAD } : home.limits);
    this.homePose = home.pose;
    this.limits.main = home.limits;
    for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
    if (animate && !this.reducedMotion) this.tweenOrbit(home.pose, 650);
    else this.setOrbitPose(home.pose);
    this.userMoved = false;
    this.requestRender();
  }

  /** Swoop toward a point (a room picked on a building) before the page changes. */
  diveTo(point, ms = 520) {
    if (this.reducedMotion) return Promise.resolve();
    const target = point.clone();
    const dir = this.camera.position.clone().sub(target).normalize();
    const to = { pos: target.clone().addScaledVector(dir, 2.2).setY(target.y + 1.8), target };
    this.stopSpin(true);
    this.controls.enabled = false;
    this.diving = true;
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        this.diving = false;
        resolve();
      };
      for (const tw of this.tweens) if (tw.kind === 'orbit') this.tweens.delete(tw);
      this.tweenOrbit(to, ms, (t) => t * t * t, finish);
      setTimeout(finish, ms + 250);
      this.requestRender();
    });
  }

  hover(e) {
    if (!this.glyphs) return;
    const photo = this.pickGlyph(e);
    if (photo !== this.hovered) {
      this.hovered = photo;
      this.canvas.style.cursor = photo != null ? 'pointer' : '';
      this.applyHighlight();
    }
  }

  /** A label ("Photo 2") per camera glyph, shown while it is hovered or highlighted. */
  buildCamTags(cameras) {
    this.camTags = cameras.map((cam) => {
      const el = document.createElement('span');
      el.className = 'mr-camtag';
      el.textContent = COPY.viewer.camTag ? COPY.viewer.camTag(cam.photo) : `Photo ${cam.photo}`;
      el.hidden = true;
      el.setAttribute('aria-hidden', 'true');
      this.overlay.append(el);
      return { photo: cam.photo, el, pos: new THREE.Vector3(...cam.pos) };
    });
  }

  /** Light up one photo's camera glyph + label (the page calls this from its thumbnails). */
  highlightPhoto(n) {
    this.stripHighlight = n ?? null;
    this.applyHighlight();
  }

  applyHighlight() {
    const n = this.hovered ?? this.stripHighlight ?? null;
    this.glyphs?.setHover(n);
    if (n != null) this.loadThumb(n);
    this.requestRender();
  }

  /** The photo on a frustum's rectangle: its thumbnail, fetched the first time it's needed. */
  loadThumb(n) {
    const glyphs = this.glyphs;
    if (!glyphs || glyphs.hasThumb(n)) return;
    this.thumbLoading ??= new Set();
    const key = `${this.loadToken}:${n}`;
    if (this.thumbLoading.has(key)) return;
    const photo = (this.spec?.photos || []).find((p) => p.photo === n);
    const url = photo?.thumb || photo?.url;
    if (!url) return;
    this.thumbLoading.add(key);
    new THREE.TextureLoader().load(
      url,
      (tex) => {
        this.thumbLoading.delete(key);
        if (this.disposed || this.glyphs !== glyphs) return tex.dispose();
        tex.colorSpace = THREE.SRGBColorSpace;
        glyphs.setThumb(n, tex);
        this.requestRender();
      },
      undefined,
      () => this.thumbLoading.delete(key),
    );
  }

  /** Meshes that are actually drawn (traverseVisible skips hidden walls). */
  visibleMeshes() {
    const out = [];
    this.world.traverseVisible((o) => {
      if (o.isMesh && !o.material?.transparent) out.push(o);
    });
    return out;
  }

  // ── empty / furnished ───────────────────────────────────────────────────

  /**
   * Furniture on (the bake as is) or off: every furniture mesh hidden and the structure's atlases swapped to the
   * empty bake, fetched once per room on first use (a texture-only GLB: no geometry reloaded). Rooms without an
   * empty bake keep their furniture (no ghost shadows). Resolves once the switch is on screen.
   */
  async setFurnished(on) {
    if (this.disposed || !this.renderer) return;
    on = Boolean(on);
    if (on === this.furnished) return;
    this.furnished = on;
    this.syncStatus();
    const token = this.loadToken;
    if (!on) {
      this.container.dataset.furnishedLoading = 'on';
      await Promise.all(this.rooms.filter((r) => r.emptyUrl).map((r) => this.loadEmpty(r, token)));
      if (this.container.dataset.furnishedLoading) delete this.container.dataset.furnishedLoading;
      if (token !== this.loadToken || this.disposed || this.furnished !== on) return; // superseded meanwhile
    }
    this.applyFurnished();
  }

  applyFurnished() {
    for (const r of this.rooms) {
      if (!r.furnishing?.emptyMaps) continue;
      swapAtlases(r, !this.furnished);
      setFurnitureShown(r, this.furnished);
    }
    this.syncStatus();
    this.occlusionDirty = true;
    this.requestRender();
  }

  loadEmpty(room, token) {
    const f = room.furnishing;
    if (f.emptyMaps) return Promise.resolve();
    f.emptyLoading ||= (async () => {
      this.emptyLoads++;
      try {
        const gltf = await this.loader.loadAsync(room.emptyUrl);
        if (token !== this.loadToken || this.disposed || !this.rooms.includes(room)) {
          disposeTree(gltf.scene);
          return;
        }
        f.emptyMaps = emptyMapsFrom(gltf.scene, this.anisotropy);
      } catch (err) {
        console.info('[memory-rooms] empty bake failed to load:', err?.message || err);
      } finally {
        f.emptyLoading = null;
      }
    })();
    return f.emptyLoading;
  }

  // ── the turntable ───────────────────────────────────────────────────────

  /**
   * A slow cinematic turn round the orbit target (one turn per SPIN_TURN_S), at constant elevation, eased up to
   * speed and down to a stop. It runs inside the frame loop (no loop of its own: nothing at all when off) and
   * waits while a swing or a flight owns the camera. Off by default; nothing ever turns it on by itself.
   */
  setSpin(on) {
    if (this.disposed || !this.renderer) return;
    on = Boolean(on) && this.mode !== 'scan' && this.status.main.state === 'ready';
    if (on) {
      if (this.view !== 'orbit') this.home(); // back out of a photo first, then turn
      this.spin = { on: true, speed: this.spin?.speed || 0 };
    } else if (this.spin) {
      this.spin.on = false; // eases out in stepSpin
    }
    this.syncStatus();
    this.requestRender();
  }

  /** Stop the turntable; `now` = at once (the visitor took the camera), else eased. */
  stopSpin(now = false) {
    if (!this.spin) return;
    if (now) this.spin = null;
    else this.spin.on = false;
    if (this.container) this.syncStatus();
  }

  stepSpin(dt) {
    const s = this.spin;
    const max = (2 * Math.PI) / SPIN_TURN_S;
    const step = (max * dt) / SPIN_RAMP_MS;
    s.speed = s.on ? Math.min(max, s.speed + step) : Math.max(0, s.speed - step);
    if (!s.on && s.speed <= 0) {
      this.spin = null;
      this.occlusionDirty = true;
      return false;
    }
    // a swing (a stage change, Reset) or a flight owns the camera: wait it out, keep the clock running
    for (const tw of this.tweens) if (tw.kind === 'orbit' || tw.kind === 'fly') return true;
    if (this.view !== 'orbit' || this.diving) return true;
    const target = this.controls.target;
    const off = this.camera.position.clone().sub(target);
    off.applyAxisAngle(this.camera.up, s.speed * (dt / 1000));
    this.camera.position.copy(target).add(off);
    this.camera.lookAt(target);
    // pins behind a wall go faint as it turns (the idle check never runs while it moves)
    s.acc = (s.acc || 0) + dt;
    if (s.acc > 400) {
      s.acc = 0;
      this.updateOcclusion();
    }
    return true;
  }

  // ── rendering ───────────────────────────────────────────────────────────

  setSize(w, h) {
    if (this.disposed || !this.renderer) return;
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
    if (this.xrSession) {
      // the XR device owns the canvas size while presenting; apply it on exit
      this.pendingSize = [w, h];
      return;
    }
    if (w === this.width && h === this.height) return;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.readTheme();
    this.refitIfUntouched();
    this.requestRender();
  }

  /** Space the page lays over the stage: CSS vars, plus a measured bottom bar (setInsets). */
  currentInsets() {
    const css = this.insets || { top: 24, side: 24, bottom: 24 };
    const o = this.insetOverride || {};
    return { top: o.top ?? css.top, side: o.side ?? css.side, bottom: o.bottom != null ? o.bottom + css.bottom : css.bottom };
  }

  /**
   * The page reports chrome laid over the stage (e.g. { bottom: barHeight }),
   * so the letterboxed photo and the opening view sit clear of it.
   */
  setInsets(next) {
    const prev = this.insetOverride || {};
    this.insetOverride = { ...prev, ...next };
    this.container.style.setProperty('--mr-dock-h', `${this.insetOverride.bottom || 0}px`);
    if (Math.abs((prev.bottom ?? 0) - (this.insetOverride.bottom ?? 0)) < 2 && prev.top === this.insetOverride.top) return;
    this.refitIfUntouched();
    this.requestRender();
  }

  /** Re-frame the opening view (new size or insets) unless the visitor has moved it. */
  refitIfUntouched() {
    if (this.diving) return; // "Walk in" owns the camera until the page changes
    if (this.spin) return; // the turntable is moving the camera: a re-frame would snap it
    if (this.plan) return; // the plan view keeps its own top-down framing (and limits) through a resize
    if (this.buildingRefit) {
      // a building page frames its own stage (a level, the levels pulled apart, a plan)
      if (!this.userMoved && this.view === 'orbit' && !this.flying) this.buildingRefit();
      return;
    }
    const settling = this.status.main.state === 'ready' || (this.status.main.recalling && this.rooms.length);
    if (this.userMoved || this.view !== 'orbit' || this.flying || this.mode === 'scan' || !settling || !this.bounds) return;
    if (this.focused) return;
    const home = this.computeHome(this.bounds, this.rooms.some((r) => r.interior));
    this.homePose = home.pose;
    this.poses.main = home.pose;
    this.limits.main = home.limits;
    this.applyLimits(home.limits);
    let reveal = null;
    for (const tw of this.tweens) if (tw.kind === 'orbit') reveal = tw;
    if (reveal) {
      const left = Math.max(250, reveal.ms - (performance.now() - reveal.start));
      this.tweens.delete(reveal);
      this.tweenOrbit(home.pose, left, easeOut);
    } else {
      this.setOrbitPose(home.pose);
    }
  }

  /** The rect (CSS px, top-left origin) the 3D view is drawn into. */
  viewRect() {
    const full = { x: 0, y: 0, w: this.width, h: this.height };
    if (!this.letterAspect || this.rectT <= 0) return full;
    const { top, side, bottom } = this.currentInsets();
    const lb = containRect(this.letterAspect, this.width - side * 2, this.height - top - bottom, 0);
    lb.x += side;
    lb.y += top;
    const t = this.rectT;
    return { x: lerp(0, lb.x, t), y: lerp(0, lb.y, t), w: lerp(this.width, lb.w, t), h: lerp(this.height, lb.h, t) };
  }

  requestRender() {
    if (this.disposed || !this.renderer || this.xrSession) return;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  // ── AR (ar/xr.js takes the renderer over for a WebXR session) ───────────

  /** Stop drawing our own frames and hide the page-only extras until exitXR(). */
  /** The world height the plan cut clips at for the room holding `obj` (its floor + CUT_Y). */
  planCutY(obj) {
    const room = this.rooms.find((r) => {
      let o = obj;
      while (o && o !== r.holder) o = o.parent;
      return Boolean(o);
    });
    return room ? room.holder.getWorldPosition(new THREE.Vector3()).y + CUT_Y : Infinity;
  }

  enterXR(session) {
    // AR moves and scales the world: a plan cut fixed in world space would slice it anywhere
    if (this.plan) this.setPlan(false, { animate: false });
    if (this.view !== 'orbit' || this.flying) this.exitViewpointNow();
    this.closePin();
    this.xrSession = session;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.lastTick = undefined;
    this.extras.visible = false;
    this.overlay.hidden = true;
    this.container.dataset.xr = 'on';
  }

  exitXR() {
    this.xrSession = null;
    this.extras.visible = true;
    this.overlay.hidden = false;
    delete this.container.dataset.xr;
    this.renderer?.setScissorTest(false);
    const size = this.pendingSize;
    this.pendingSize = null;
    this.width = 0; // force setSize to re-apply after the XR device's size
    if (size) this.setSize(size[0], size[1]);
    else this.setSize(this.container.clientWidth, this.container.clientHeight);
    this.occlusionDirty = true;
    this.requestRender();
  }

  tick(now) {
    this.raf = 0;
    if (this.disposed || this.xrSession) return;
    const dt = Math.min(50, Math.max(0, now - (this.lastTick ?? now)));
    this.lastTick = now;
    let again = false;
    for (const tw of [...this.tweens]) {
      if (!this.tweens.has(tw)) continue;
      const t = tw.ms > 0 ? clamp01((now - tw.start) / tw.ms) : 1;
      tw.step(tw.easing ? tw.easing(t) : t);
      if (t >= 1) {
        this.tweens.delete(tw);
        tw.done?.();
      } else again = true;
    }
    if (this.spin && this.stepSpin(dt)) again = true;
    if (this.controls.enabled && this.controls.update()) again = true;
    if (this.recall && this.stepRecall(now)) again = true;
    // a live landscape moves (water, wind): keep drawing while it's on screen
    if (this.land) {
      this.land.update(this.camera, dt / 1000);
      if (document.visibilityState !== 'hidden') again = true;
    }
    this.renderNow(dt);
    if (this.landOverlay) this.landOverlay.update(this.camera, this.viewRect());
    if (again || this.tweens.size || this.fading) {
      this.requestRender();
      return;
    }
    this.lastTick = undefined; // idle: the next frame starts a fresh clock
    if (this.occlusionDirty) this.updateOcclusion();
  }

  updateDollhouse(dt = 0) {
    const cam = this.camera.position;
    // the plan cut shows every wall (the clip plane opens the room instead)
    const cutaway = (this.view === 'orbit' || this.flying) && !this.plan;
    let fading = false;
    for (const room of this.rooms) {
      const ref = this.isGroup ? this.centre : room.centre;
      // a building's level may be told to stay closed ('never') or opened ('always')
      const mode = room.cutawayMode;
      applyDollhouse(room, [cam.x, cam.z], [ref.x, ref.z], mode === 'never' ? false : mode === 'always' ? true : cutaway);
      if (this.plan || this.cutLevels?.has(room)) room.fades.ceiling.target = 0; // a plan has no ceiling (it would hide every pin from above)
      if (stepFades(room, dt, this.reducedMotion)) fading = true;
    }
    this.fading = fading;
    if (this.glyphs) this.glyphs.group.visible = this.view === 'orbit' && !this.flying;
  }

  /**
   * The near plane, scaled to the orbit distance. Depth precision falls with near / distance², so a fixed
   * 0.05 m near could only tell surfaces ~2 mm apart at 40 m (~8 mm at 80 m): a site's lawn, drive and paths,
   * baked a few mm apart, swapped places as the view turned (z-fighting). 1 % of the distance to the target
   * keeps that under half a millimetre and stays well inside anything an orbit can see. Inside a room (a photo
   * viewpoint, a dive, the walk-in) it stays 0.05 m: the camera can be right up against a wall there.
   */
  nearFor() {
    if (this.view !== 'orbit' || this.flying || !this.controls) return NEAR_MIN;
    const d = this.camera.position.distanceTo(this.controls.target);
    // a landscape is seen from kilometres away: let the near plane follow further out
    const max = this.landscape ? 40 : NEAR_MAX;
    return Math.min(max, Math.max(NEAR_MIN, d * NEAR_PER_M));
  }

  /** The far plane: 900 m covers any room or site; a landscape needs its whole block from where the camera is. */
  farFor() {
    if (!this.landscape) return 900;
    if (!this.bounds) return 30000;
    const reach = this.camera.position.distanceTo(this.bounds.getCenter(_tmpFar)) + this.bounds.getSize(_tmpFar).length();
    return Math.max(900, reach * 1.05);
  }

  renderNow(dt = 0) {
    const { renderer, camera } = this;
    const scan = this.mode === 'scan';
    const r = this.viewRect();
    camera.aspect = r.w / r.h;
    camera.near = this.nearFor();
    camera.far = this.farFor();
    camera.updateProjectionMatrix();

    if (scan) {
      // Spark draws through its own passes; give it the plain full-canvas path.
      renderer.autoClear = true;
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, this.width, this.height);
      if (this.scan) renderer.render(this.scan.scene, camera);
      else renderer.clear();
      renderer.autoClear = false;
    } else {
      this.updateDollhouse(dt);
      const rc = this.recall;
      if (rc?.room && rc.mats && rc.revealAt != null) setRoomAlpha(rc.room, rc.mats, rc.k ?? 0);
      // a building's levels lifting away fade as a whole (setRoomFade), on top of their dollhouse fades
      for (const room of this.rooms) {
        const a = room.alpha ?? 1;
        if (a < 1 || room.alphaApplied < 1) {
          room.alphaMats ||= roomMaterials(room);
          setRoomAlpha(room, room.alphaMats, a);
          room.alphaApplied = a;
        }
      }
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, this.width, this.height);
      renderer.clear();
      const y = this.height - r.y - r.h; // WebGL viewports start bottom-left
      renderer.setViewport(r.x, y, r.w, r.h);
      renderer.setScissor(r.x, y, r.w, r.h);
      renderer.setScissorTest(true);
      renderer.render(this.scene, camera);
      renderer.setScissorTest(false);
    }
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
    const showPins = this.mode !== 'scan' && this.status.main.state === 'ready' && !this.recall;
    if (this.leaders) {
      this.leaders.setAttribute('width', String(this.width));
      this.leaders.setAttribute('height', String(this.height));
    }
    this.layoutPins(r, showPins);
    const v = new THREE.Vector3();
    const lit = this.hovered ?? this.stripHighlight ?? null;
    const glyphsShown = this.mode !== 'scan' && this.view === 'orbit' && !this.flying && this.status.main.state === 'ready';
    for (const t of this.camTags || []) {
      let show = glyphsShown && t.photo === lit;
      if (show) {
        v.copy(t.pos).applyMatrix4(this.camera.matrixWorldInverse);
        show = v.z < -this.camera.near;
        v.applyMatrix4(this.camera.projectionMatrix);
        const x = r.x + ((v.x + 1) / 2) * r.w;
        const y = r.y + ((1 - v.y) / 2) * r.h;
        if (show) t.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      }
      t.el.hidden = !show;
    }
    for (const l of this.labels || []) {
      v.copy(l.pos).applyMatrix4(this.camera.matrixWorldInverse);
      let show = v.z < -this.camera.near && this.view === 'orbit';
      v.applyMatrix4(this.camera.projectionMatrix);
      const x = r.x + ((v.x + 1) / 2) * r.w;
      const y = r.y + ((1 - v.y) / 2) * r.h;
      show = show && x > -40 && x < this.width + 40 && y > 0 && y < this.height;
      if (show) l.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      l.el.hidden = !show;
    }
    const open = this.openPin != null ? this.pins[this.openPin] : null;
    if (open?.screen && open.labelAt && this.note.childElementCount) {
      // the full note opens under its callout, on the callout's side of the stage
      const [x, y] = open.labelAt;
      const left = open.side === 'right';
      this.note.classList.toggle('is-left', left);
      const ax = left ? x + open.el.offsetWidth : x;
      // under the callout, never over it (so a second tap on the callout closes it)
      const below = y + open.el.offsetHeight + (parseFloat(getComputedStyle(open.el).marginTop) || 0) + 6;
      this.note.style.transform = `translate(${ax.toFixed(1)}px, ${below.toFixed(1)}px)`;
      this.note.hidden = false;
    } else if (open) {
      this.note.hidden = true;
    }
    this.emitView(r);
  }

  /**
   * The title block's live numbers: metres per CSS pixel at the orbit target (the scale bar)
   * and where north points on screen (degrees clockwise from up). Emitted only on change.
   */
  emitView(r) {
    if (!this.handlers.view?.size || this.status.main.state !== 'ready') return;
    const cam = this.camera;
    const target = this.controls.target;
    const dist = cam.position.distanceTo(target);
    const mpp = (2 * dist * Math.tan((cam.fov * RAD) / 2)) / Math.max(1, r.h);
    const a = target.clone().project(cam);
    const b = target.clone().add(_north).project(cam);
    const north = Math.atan2((b.x - a.x) * r.w, (b.y - a.y) * r.h) / RAD;
    const last = this.viewSnap;
    if (last && Math.abs(last.mpp - mpp) / mpp < 0.003 && Math.abs(last.north - north) < 0.3) return;
    this.viewSnap = { mpp, north };
    this.emit('view', this.viewSnap);
  }

  /** Pins behind a wall or the bed go faint (checked when the view settles). */
  updateOcclusion() {
    this.occlusionDirty = false;
    if (!this.pins.length || this.mode === 'scan') return;
    const meshes = this.visibleMeshes();
    const origin = this.camera.position;
    const dir = new THREE.Vector3();
    for (const p of this.pins) {
      const dist = dir.copy(p.pos).sub(origin).length();
      dir.normalize();
      this.raycaster.set(origin, dir);
      this.raycaster.far = dist;
      // in a plan view everything above the cut is gone (clipped, but still there for a ray)
      const hit = this.raycaster.intersectObjects(meshes, false).find((h) => h.point.y <= this.cutYOf(h.object));
      const occluded = !!hit && hit.distance < dist - 0.12;
      if (occluded !== p.occluded) {
        p.occluded = occluded;
        p.el.classList.toggle('is-occluded', occluded);
        p.dot.classList.toggle('is-occluded', occluded);
        p.line.classList.toggle('is-occluded', occluded);
      }
    }
    this.raycaster.far = Infinity;
  }

  // ── teardown ────────────────────────────────────────────────────────────

  clearContent() {
    this.stopSpin(true);
    this.planCut?.removeAll();
    this.plan = false;
    this.cutLevels = new Map();
    this.tweens.clear();
    this.view = 'orbit';
    this.flying = false;
    this.activePhoto = null;
    this.letterAspect = null;
    this.rectT = 0;
    this.focused = null;
    this.blend = DEFAULT_BLEND;
    this.photoEl.hidden = true;
    this.photoEl.style.opacity = '0';
    this.photoEl.removeAttribute('src');
    this.closePin();
    for (const p of this.pins) {
      p.el.remove();
      p.dot?.remove();
    }
    this.leaders?.remove();
    this.leaders = null;
    this.viewSnap = null;
    for (const t of this.camTags || []) t.el.remove();
    this.camTags = [];
    for (const l of this.labels || []) l.el.remove();
    this.labels = [];
    this.stripHighlight = null;
    this.pins = [];
    this.note.remove();
    if (this.controls) this.controls.enabled = true;
    for (const room of this.rooms) {
      disposeFurnishing(room);
      if (this.land && room.root === this.land.group) room.holder.remove(room.root); // the landscape disposes itself
      disposeTree(room.holder);
    }
    this.landOverlay?.dispose();
    this.landOverlay = null;
    this.land?.dispose();
    this.land = null;
    this.rooms = [];
    this.furnished = true;
    if (this.extras) {
      for (const child of [...this.extras.children]) disposeTree(child);
    }
    this.glyphs?.disposeMaterials();
    this.ground = null;
    this.glyphs = null;
    this.endRecall();
    this.recallPosed = false;
    if (this.container.dataset.recall) delete this.container.dataset.recall;
    this.hovered = null;
    if (this.scan) this.scan.dispose();
    this.scan = null;
    this.scanHome = null;
    this.scanLoading = null;
    this.poses = {};
    this.limits = {};
    this.homePose = null;
    if (this.vpSnap.photo != null || this.vpSnap.flying) this.emitViewpoint();
  }

  dispose() {
    if (this.disposed) return;
    if (this.xrSession) {
      this.xrSession.end().catch(() => {});
      this.renderer?.setAnimationLoop(null);
      this.xrSession = null;
    }
    this.loadToken++;
    this.clearContent();
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.themeQuery?.removeEventListener('change', this.onTheme);
    window.removeEventListener('mr-theme', this.onTheme);
    document.removeEventListener('visibilitychange', this.onHidden);
    if (this.renderer) {
      this.controls.removeEventListener('change', this.requestRender);
      this.controls.removeEventListener('start', this.onControlsStart);
      this.controls.removeEventListener('end', this.onControlsEnd);
      this.controls.dispose();
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointerup', this.onPointerUp);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.renderer.renderLists.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.canvas.remove();
    }
    for (const img of [this.poster, this.posterLow]) {
      img.onload = null;
      img.onerror = null;
      img.remove();
    }
    this.photoEl.remove();
    this.overlay.remove();
    this.handlers = {};
    if (import.meta.env.DEV && window.__mrViewer === this) window.__mrViewer = null;
    if (this.container.__viewer === this) this.container.__viewer = null;
  }
}

export default RoomViewer;
