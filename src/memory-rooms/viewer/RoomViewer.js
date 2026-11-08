/* ============================================================================
   RoomViewer: a plain three.js viewer for one memory spot (or a group of them).
   No React in here, so it can move to another site as is.

     const v = new RoomViewer(container, { reducedMotion });
     v.load({ scene, glbUrl, posterUrl, photos: [{ photo, url, width, height }], scanUrl });
     v.loadGroup({ rooms: [{ id, scene, glbUrl }] });
     v.setMode('model' | 'scan');   v.flyToPhoto(n);   v.setBlend(0..1);
     v.home();   v.focusRoom(id);   v.retry();   v.setSize(w, h);
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
import { sceneBounds, verticalFov } from '../scene/geometry.js';
import { COPY } from '../copy.js';
import { applyBakedMaterials } from './bakedMaterials.js';
import { buildLayoutPreview } from './layoutPreview.js';
import { applyDollhouse, indexRoom, stepFades } from './dollhouse.js';
import { aimCamera, buildCameraGlyphs, buildGroundDisc } from './helpers.js';
import { loadScan } from './scan.js';
import { disposeTree } from './dispose.js';

const RAD = Math.PI / 180;
const ORBIT_FOV = 35; // vertical, degrees: long-ish lens = miniature feel
const FLY_MS = 800;
const RETURN_MS = 700;
const REVEAL_MS = 1900;
const FOCUS_MS = 700;
const PHOTO_FADE_MS = 420;
const DEFAULT_BLEND = 1; // arriving at a viewpoint shows the real photo
const TAP_PX = 6;

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
    this.width = Math.max(1, container.clientWidth);
    this.height = Math.max(1, container.clientHeight);

    this.stateSnap = { state: 'loading', progress: 0, error: null, mode: 'model', baseMode: 'model', hasScan: false, isGroup: false };
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

    this.loader = new GLTFLoader();
    this.raycaster = new THREE.Raycaster();
    this.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());

    // bound handlers (removed in dispose)
    this.requestRender = this.requestRender.bind(this);
    this.tick = this.tick.bind(this);
    this.onControlsStart = () => {
      this.userMoved = true;
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

    this.readTheme();
    if (import.meta.env.DEV) window.__mrViewer = this;
  }

  // ── events ──────────────────────────────────────────────────────────────

  on(event, fn) {
    (this.handlers[event] ??= new Set()).add(fn);
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
    this.status[which] = { state, progress: extra.progress ?? (state === 'ready' ? 1 : 0), error: extra.error ?? null };
    this.syncStatus();
  }

  syncStatus() {
    const s = this.status[this.mode === 'scan' ? 'scan' : 'main'];
    const snap = (this.stateSnap = {
      state: s.state === 'idle' ? 'loading' : s.state,
      progress: s.progress,
      error: s.error,
      mode: this.mode,
      baseMode: this.baseMode,
      hasScan: !!this.spec?.scanUrl,
      isGroup: this.isGroup,
    });
    this.container.dataset.state = snap.state;
    this.container.dataset.mode = this.mode;
    for (const img of [this.posterLow, this.poster]) {
      if (!img) continue;
      const show = this.mode !== 'scan' && this.status.main.state === 'loading' && !!img.getAttribute('src');
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

  /** Load one spot. spec: { scene, glbUrl, posterUrl, photos, scanUrl }. */
  async load(spec) {
    if (this.disposed) return;
    const token = ++this.loadToken;
    this.clearContent();
    this.spec = spec;
    this.isGroup = false;
    this.baseMode = spec.glbUrl ? 'model' : 'preview';
    this.mode = this.baseMode;
    this.setPoster(spec.posterUrl, spec.posterLowUrl);
    this.setStatus('scan', 'idle');
    this.setStatus('main', 'loading');
    if (!this.renderer) return this.setStatus('main', 'error', { error: new Error('webgl') });
    try {
      const root = await this.loadRoot({ glbUrl: spec.glbUrl, scene: spec.scene }, token, (p) => {
        if (token === this.loadToken) this.setStatus('main', 'loading', { progress: p });
      });
      if (!root) return;
      this.addRoom({ id: 'room', root, scene: spec.scene, frame: null });
      this.finishLoad({ reveal: true });
    } catch (err) {
      if (token !== this.loadToken || this.disposed) return;
      console.info('[memory-rooms] viewer load failed:', err?.message || err);
      this.setStatus('main', 'error', { error: err });
    }
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
      if (root) this.addRoom({ id: r.id, root, scene: r.scene, frame: r.scene?.frame || null });
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
      return applyBakedMaterials(gltf.scene, { anisotropy: this.anisotropy });
    }
    if (scene) return buildLayoutPreview(scene);
    throw new Error('nothing to show');
  }

  addRoom({ id, root, scene, frame }) {
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
    const shell = scene?.shell;
    const centre = shell ? holder.localToWorld(new THREE.Vector3(shell.width / 2, shell.height / 2, shell.depth / 2)) : box.getCenter(new THREE.Vector3());
    this.rooms.push({ id, holder, root, scene, interior, ...index, box, centre, shell });
  }

  finishLoad({ reveal }) {
    this.bounds = new THREE.Box3();
    for (const r of this.rooms) this.bounds.union(r.box);
    this.centre = this.bounds.getCenter(new THREE.Vector3());
    this.buildExtras();
    const home = this.computeHome(this.bounds, this.rooms.some((r) => r.interior));
    this.limits.main = home.limits;
    this.poses.main = home.pose;
    this.homePose = home.pose;
    this.applyLimits(home.limits);
    if (reveal && !this.reducedMotion) {
      const start = this.offsetPose(home.pose, -38, -10, 1.3);
      this.setOrbitPose(start);
      this.tweenOrbit(home.pose, REVEAL_MS, easeOut);
    } else {
      this.setOrbitPose(home.pose);
    }
    this.userMoved = false;
    this.occlusionDirty = true;
    this.setStatus('main', 'ready');
    this.requestRender();
  }

  /** Hero render (url) over a quick low layer (lowUrl, e.g. the first photo thumb). */
  setPoster(url, lowUrl = null) {
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

  /** Disc, camera glyphs and pins for what's loaded. */
  buildExtras() {
    const scene = !this.isGroup ? this.spec?.scene : null;
    const exterior = this.rooms.some((r) => !r.interior);
    const size = this.bounds.getSize(new THREE.Vector3());
    let radius;
    let centre;
    if (scene?.site?.ground) {
      const [w, d] = scene.site.ground.size;
      radius = 0.5 * Math.hypot(w, d) * 1.12;
      centre = [0, 0];
    } else {
      radius = 0.5 * Math.hypot(size.x, size.z) * (exterior ? 1.3 : 1.25);
      centre = [this.centre.x, this.centre.z];
    }
    this.disc = buildGroundDisc(radius, centre, exterior ? 1 : 0.55);
    this.extras.add(this.disc);

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
    // Mix in sRGB (as CSS would): in linear light a few % of a pale ink
    // brightens a dark stage far too much.
    const a = stage.getRGB({}, THREE.SRGBColorSpace);
    const b = ink.getRGB({}, THREE.SRGBColorSpace);
    const dark = a.r + a.g + a.b < 1.5;
    const k = dark ? 0.045 : 0.06;
    const disc = new THREE.Color().setRGB(lerp(a.r, b.r, k), lerp(a.g, b.g, k), lerp(a.b, b.b, k), THREE.SRGBColorSpace);
    this.theme = { disc, accent: parse(read('--mr-accent', '#b5532f'), '#b5532f') };
    const px = (name, fallback) => {
      const v = parseFloat(read(name, ''));
      return Number.isFinite(v) ? v : fallback;
    };
    this.insets = { top: px('--mr-letterbox-top', 24), side: px('--mr-letterbox-side', 24), bottom: px('--mr-letterbox-bottom', 24) };
    this.applyTheme();
  }

  applyTheme() {
    if (!this.theme) return;
    if (this.disc) this.disc.material.color.copy(this.theme.disc);
    this.glyphs?.setColor(this.theme.accent);
  }

  // ── framing ─────────────────────────────────────────────────────────────

  computeHome(box, interior, { azimuth, elevation } = {}) {
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
    const margin = this.width < 600 ? 0.9 : 0.84;
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
        minDistance: dist * 0.3,
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
    });
  }

  tween({ kind, ms, easing, step, done }) {
    const tw = { kind, start: performance.now(), ms: this.reducedMotion ? 0 : ms, easing, step, done };
    this.tweens.add(tw);
    this.requestRender();
    return tw;
  }

  // ── viewpoints ──────────────────────────────────────────────────────────

  /** Fly to the camera that took photo n and lay the real photo over the model. */
  flyToPhoto(n) {
    if (this.disposed || !this.renderer || this.isGroup || this.mode === 'scan') return false;
    if (this.status.main.state !== 'ready') return false;
    const cam = (this.spec?.scene?.cameras || []).find((c) => c.photo === Number(n));
    if (!cam) return false;
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
    const pose = this.mode === 'scan' ? this.scanHome?.pose : this.homePose;
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

  buildPins(pins) {
    const copy = COPY.viewer;
    this.pins = pins.map((pin, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mr-pin';
      btn.dataset.mr = 'pin';
      btn.dataset.index = String(i);
      btn.textContent = String(i + 1);
      btn.setAttribute('aria-label', copy.pinLabel ? copy.pinLabel(i + 1, pin.text) : `Pin ${i + 1}`);
      btn.setAttribute('aria-expanded', 'false');
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.togglePin(i);
      });
      this.overlay.append(btn);
      return { pin, el: btn, pos: new THREE.Vector3(...pin.at), screen: null, occluded: false };
    });
    this.overlay.append(this.note);
  }

  togglePin(i) {
    if (this.openPin === i) return this.closePin();
    const p = this.pins[i];
    if (!p) return;
    if (this.openPin != null) this.pins[this.openPin]?.el.setAttribute('aria-expanded', 'false');
    this.openPin = i;
    p.el.setAttribute('aria-expanded', 'true');
    this.note.replaceChildren();
    const text = document.createElement('p');
    text.className = 'mr-pin-note__text';
    text.textContent = p.pin.text;
    this.note.append(text);
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
    this.note.hidden = false;
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
    if (this.view !== 'orbit' || this.flying) return;
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
      const hit = this.raycaster.intersectObjects(this.visibleMeshes(), false)[0];
      let o = hit?.object;
      while (o && o.userData.roomId == null) o = o.parent;
      if (o) this.focusRoom(o.userData.roomId);
    }
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
    this.requestRender();
  }

  /** Meshes that are actually drawn (traverseVisible skips hidden walls). */
  visibleMeshes() {
    const out = [];
    this.world.traverseVisible((o) => {
      if (o.isMesh && !o.material?.transparent) out.push(o);
    });
    return out;
  }

  // ── rendering ───────────────────────────────────────────────────────────

  setSize(w, h) {
    if (this.disposed || !this.renderer) return;
    w = Math.max(1, Math.round(w));
    h = Math.max(1, Math.round(h));
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
    if (this.userMoved || this.view !== 'orbit' || this.flying || this.mode === 'scan' || this.status.main.state !== 'ready' || !this.bounds) return;
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
    if (this.disposed || !this.renderer) return;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  tick(now) {
    this.raf = 0;
    if (this.disposed) return;
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
    if (this.controls.enabled && this.controls.update()) again = true;
    this.renderNow(dt);
    if (again || this.tweens.size || this.fading) {
      this.requestRender();
      return;
    }
    this.lastTick = undefined; // idle: the next frame starts a fresh clock
    if (this.occlusionDirty) this.updateOcclusion();
  }

  updateDollhouse(dt = 0) {
    const cam = this.camera.position;
    const cutaway = this.view === 'orbit' || this.flying;
    let fading = false;
    for (const room of this.rooms) {
      const ref = this.isGroup ? this.centre : room.centre;
      applyDollhouse(room, [cam.x, cam.z], [ref.x, ref.z], cutaway);
      if (stepFades(room, dt, this.reducedMotion)) fading = true;
    }
    this.fading = fading;
    if (this.glyphs) this.glyphs.group.visible = this.view === 'orbit' && !this.flying;
  }

  renderNow(dt = 0) {
    const { renderer, camera } = this;
    const scan = this.mode === 'scan';
    const r = this.viewRect();
    camera.aspect = r.w / r.h;
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
    const showPins = this.mode !== 'scan' && this.status.main.state === 'ready';
    const v = new THREE.Vector3();
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
      if (visible) p.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
    }
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
    const open = this.openPin != null ? this.pins[this.openPin] : null;
    if (open?.screen) {
      const [x, y] = open.screen;
      const left = x > this.width - 280;
      this.note.classList.toggle('is-left', left);
      this.note.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      this.note.hidden = false;
    } else if (open) {
      this.note.hidden = true;
    }
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
      const hit = this.raycaster.intersectObjects(meshes, false)[0];
      const occluded = !!hit && hit.distance < dist - 0.12;
      if (occluded !== p.occluded) {
        p.occluded = occluded;
        p.el.classList.toggle('is-occluded', occluded);
      }
    }
    this.raycaster.far = Infinity;
  }

  // ── teardown ────────────────────────────────────────────────────────────

  clearContent() {
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
    for (const p of this.pins) p.el.remove();
    for (const t of this.camTags || []) t.el.remove();
    this.camTags = [];
    this.stripHighlight = null;
    this.pins = [];
    this.note.remove();
    if (this.controls) this.controls.enabled = true;
    for (const room of this.rooms) disposeTree(room.holder);
    this.rooms = [];
    if (this.extras) {
      for (const child of [...this.extras.children]) disposeTree(child);
    }
    this.glyphs?.disposeMaterials();
    this.disc = null;
    this.glyphs = null;
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
    this.loadToken++;
    this.clearContent();
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    this.themeQuery?.removeEventListener('change', this.onTheme);
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
  }
}

export default RoomViewer;
