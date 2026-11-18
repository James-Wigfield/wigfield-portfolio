/* ============================================================================
   PROJECTOR LIFE — the Stage (lead-owned integration layer)
   ----------------------------------------------------------------------------
   Plain three.js, one WebGLRenderer, one rAF loop. It owns the renderer, the
   orbit camera and its one-click views, the loop and its budget, the
   picture-in-picture projector-output inset, mid-air bodies, picking, PNG
   capture, stats and teardown. It wires three subsystems together through
   the contracts in CONTRACTS.md:

     room/        loadRoom()          the She'd GLB + new roof + patches + views
     life/        createLifeHost()    sims + creatures on the patches (CPU)
     projection/  createProjection()  projectors, light, coverage, insets

   The React shell (ProjectorLife.jsx) only calls the public methods below.
   ========================================================================== */

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { loadRoom } from '../room/index.js';
import { createLifeHost } from '../life/index.js';
import { createProjection } from '../projection/index.js';
import { coerce, defaults } from '../params.js';
import { pitchDeg } from '../room/roomModel.js';

const STATS_MS = 250;
const TWEEN_MS = 900;
const MAX_AIR = 256;
const MAX_DT = 1 / 20; // a stalled tab never hands the sims a huge step

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export async function createStage(container, opts = {}) {
  const stage = new Stage(container, opts);
  try {
    await stage.init();
  } catch (e) {
    stage.dispose(); // a failed GLB load must not leave a WebGL context behind
    throw e;
  }
  return stage;
}

export class Stage {
  constructor(container, { values = null, view = 'cutaway', reducedMotion = null } = {}) {
    this.container = container;
    this.values = { ...defaults(), ...(values || {}) };
    this.view = view;
    this.reducedMotion = reducedMotion ?? window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    this.playing = true;
    this.disposed = false;
    this.listeners = new Set();
    this.valueListeners = new Set();
    this.raf = 0;
    this.lastT = 0;
    this.fps = 0;
    this.frameMs = 0;
    this._fpsFrames = 0;
    this._fpsT0 = 0;
    this._statsT = 0;
    this._stepOnce = false;
    this.tween = null;
    this.netCanvas = null;
    this._netT = 0;
  }

  // ── lifecycle ──────────────────────────────────────────────────────────────
  async init() {
    const { container } = this;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace; // the bake is display-referred sRGB
    renderer.toneMapping = THREE.NoToneMapping;
    renderer.setClearColor(0x000000, 1);
    renderer.autoClear = false;
    renderer.domElement.className = 'pjl-canvas';
    renderer.domElement.setAttribute('aria-label', "3-D view of the She'd with projected artificial life");
    renderer.domElement.setAttribute('role', 'img');
    container.appendChild(renderer.domElement);
    this.renderer = renderer;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.03, 60);

    this.controls = new OrbitControls(this.camera, renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 16;
    this.controls.addEventListener('start', () => {
      this.tween = null;
    });

    this._resize();
    this._ro = new ResizeObserver(() => this._resize());
    this._ro.observe(container);

    // Subsystems. Each takes the full values object; later changes arrive as
    // (values, changedKeys) through setParams().
    this.room = await loadRoom({ renderer, values: this.values });
    if (this.disposed) return this._teardown();
    this.scene.add(this.room.root);

    this.life = createLifeHost({ patches: this.room.patches, landing: this.room.landing, values: this.values });
    this.projection = createProjection({ renderer, scene: this.scene, room: this.room, life: this.life, values: this.values });
    this.projection.attach(this.room);

    this._buildAir();
    this._buildInset();
    this._bindPointer();
    this.setView(this.view, { instant: true });

    this._onVis = () => {
      if (document.hidden) this._stop();
      else this._start();
    };
    document.addEventListener('visibilitychange', this._onVis);
    this._start();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this._teardown();
  }

  _teardown() {
    this._stop();
    document.removeEventListener('visibilitychange', this._onVis);
    this._ro?.disconnect();
    this._unbindPointer?.();
    this.controls?.dispose();
    this.projection?.dispose();
    this.life?.dispose();
    this.room?.dispose();
    if (this.air) {
      this.air.geometry.dispose();
      this.air.material.dispose();
    }
    if (this.inset) {
      this.inset.quad.geometry.dispose();
      this.inset.quad.material.dispose();
    }
    this.listeners.clear();
    this.valueListeners.clear();
    if (this.renderer) {
      this.renderer.renderLists.dispose();
      this.renderer.dispose();
      this.renderer.forceContextLoss();
      this.renderer.domElement.remove();
    }
    this.renderer = this.scene = this.room = this.life = this.projection = null;
  }

  // ── public API (CONTRACTS.md §5) ──────────────────────────────────────────
  /** Merge a partial { key: value } into the params and dispatch. */
  set(partial) {
    if (this.disposed || !this.room) return;
    const changed = [];
    for (const [k, raw] of Object.entries(partial)) {
      const v = coerce(k, raw);
      if (this.values[k] !== v) {
        this.values[k] = v;
        changed.push(k);
      }
    }
    if (!changed.length) return;
    if (this.valueListeners.size) {
      const diff = Object.fromEntries(changed.map((k) => [k, this.values[k]]));
      for (const fn of this.valueListeners) fn(diff);
    }
    const { patchesChanged } = this.room.setParams(this.values, changed) || {};
    if (patchesChanged) {
      this.life.setPatches(this.room.patches);
      this.projection.setPatches(this.room.patches);
    }
    this.life.setParams(this.values, changed);
    this.projection.setParams(this.values, changed);
    if (changed.some((k) => k.startsWith('cr.showAir'))) this.air.visible = !!this.values['cr.showAir'];
    if (this.view === 'projector' && changed.some((k) => k.startsWith(`p${this.viewProjector || 0}.`) || k === 'proj.count')) {
      this.setView('projector', { instant: true, projector: this.viewProjector || 0 });
    }
    this._emit(true);
  }

  /** Replace every value (preset application): defaults + overrides. */
  replace(values, { reseed = true } = {}) {
    const next = { ...defaults(), ...values };
    // Region keys are generated per patch; reset any a preset doesn't mention.
    for (const k of Object.keys(this.values)) if (!(k in next)) next[k] = k.endsWith('.on') ? true : 'auto';
    this.set(next);
    if (reseed) this.life?.reseed();
  }

  getValues() {
    return { ...this.values };
  }

  getPatches() {
    return this.room ? this.room.patches : [];
  }

  play() {
    this.playing = true;
    this._emit(true);
  }

  pause() {
    this.playing = false;
    this._emit(true);
  }

  step() {
    this.playing = false;
    this._stepOnce = true;
    this._emit(true);
  }

  reseed() {
    this.life?.reseed();
  }

  clear() {
    this.life?.clear();
  }

  reset() {
    this.replace({}, { reseed: true });
    this.setView('cutaway');
  }

  subscribe(fn) {
    this.listeners.add(fn);
    fn(this._stats());
    return () => this.listeners.delete(fn);
  }

  /** fn({ key: value, … }) after every set() that changed something (keeps a UI mirror honest). */
  onValues(fn) {
    this.valueListeners.add(fn);
    return () => this.valueListeners.delete(fn);
  }

  /** The DOM canvas the unfolded-room inset is drawn into (or null). */
  setNetCanvas(canvas) {
    this.netCanvas = canvas;
  }

  /** Where the projector-output inset sits, CSS px from the stage's top-left. */
  insetRect() {
    return this.inset?.rect || null;
  }

  /** Smoothly move to a named view ('cutaway' | 'door' | … | 'projector' | 'plan'). */
  setView(id, { instant = false, projector = null } = {}) {
    if (!this.room) return;
    let v;
    if (projector != null) this.viewProjector = Math.max(0, Math.min((this.values['proj.count'] || 1) - 1, projector | 0));
    if (id === 'projector') v = this.projection.projectorView(this.viewProjector || 0);
    else v = this.room.views[id] || this.room.views.cutaway;
    if (!v) return;
    this.view = id;
    const to = {
      pos: new THREE.Vector3(...v.position),
      target: new THREE.Vector3(...v.target),
      fov: v.fov || 50,
    };
    if (instant || this.reducedMotion) {
      this.camera.position.copy(to.pos);
      this.controls.target.copy(to.target);
      this.camera.fov = to.fov;
      this.camera.updateProjectionMatrix();
      this.controls.update();
      this.tween = null;
    } else {
      this.tween = {
        t0: performance.now(),
        from: { pos: this.camera.position.clone(), target: this.controls.target.clone(), fov: this.camera.fov },
        to,
      };
    }
    this._emit(true);
  }

  /** Render one frame and download it as a PNG. */
  savePNG(name = 'projector-life.png') {
    if (!this.renderer) return;
    this._render();
    this.renderer.domElement.toBlob((blob) => {
      if (!blob) return;
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    }, 'image/png');
  }

  // ── loop ──────────────────────────────────────────────────────────────────
  _start() {
    if (this.raf || this.disposed) return;
    this.lastT = performance.now();
    this._fpsT0 = this.lastT;
    this._fpsFrames = 0;
    const tick = (t) => {
      this.raf = requestAnimationFrame(tick);
      this._frame(t);
    };
    this.raf = requestAnimationFrame(tick);
  }

  _stop() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  _frame(t) {
    const t0 = performance.now();
    const dt = Math.min(MAX_DT, Math.max(0, (t - this.lastT) / 1000));
    this.lastT = t;

    if (this.playing || this._stepOnce) {
      this.life.step(this._stepOnce ? 1 / 30 : dt);
      this._stepOnce = false;
    }
    this._tweenCamera(t);
    this.controls.update();
    this.room.update(this.camera, dt * 1000);
    this.projection.update(dt);
    this._updateAir();
    this._render();

    if (this.netCanvas && this.values['aid.netInset'] && t - this._netT > 90) {
      this._netT = t;
      this.projection.drawNet(this.netCanvas);
    }

    this.frameMs = this.frameMs * 0.9 + (performance.now() - t0) * 0.1;
    this._fpsFrames++;
    if (t - this._fpsT0 >= 1000) {
      this.fps = (this._fpsFrames * 1000) / (t - this._fpsT0);
      this._fpsFrames = 0;
      this._fpsT0 = t;
    }
    if (t - this._statsT > STATS_MS) {
      this._statsT = t;
      this._emit();
    }
  }

  _render() {
    const r = this.renderer;
    r.setRenderTarget(null);
    r.setScissorTest(false);
    r.clear();
    this.projection.beforeRender(this.camera);
    r.render(this.scene, this.camera);
    this._renderInset();
  }

  _tweenCamera(t) {
    if (!this.tween) return;
    const { t0, from, to } = this.tween;
    const k = Math.min(1, (t - t0) / TWEEN_MS);
    const e = easeInOut(k);
    this.camera.position.lerpVectors(from.pos, to.pos, e);
    this.controls.target.lerpVectors(from.target, to.target, e);
    this.camera.fov = from.fov + (to.fov - from.fov) * e;
    this.camera.updateProjectionMatrix();
    if (k >= 1) this.tween = null;
  }

  _resize() {
    const { container, renderer, camera } = this;
    if (!renderer) return;
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    this.size = { w, h };
  }

  // ── projector-output inset (picture in picture, same WebGL context) ───────
  _buildInset() {
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2, 2),
      new THREE.MeshBasicMaterial({ map: null, depthTest: false, depthWrite: false, toneMapped: false }),
    );
    const scene = new THREE.Scene();
    scene.add(quad);
    const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.inset = { quad, scene, cam, rect: null };
  }

  _renderInset() {
    const { inset, renderer, size } = this;
    if (!this.values['aid.projInset'] || !size) {
      inset.rect = null;
      return;
    }
    const outs = this.projection.outputs();
    if (!outs.length) return;
    const narrow = size.w < 640;
    const pad = narrow ? 8 : 14;
    const each = Math.min(narrow ? 0.3 : 0.2, 0.6 / outs.length) * size.w;
    const rects = [];
    let x = pad;
    for (const o of outs) {
      const w = Math.round(each);
      const h = Math.round(w / o.aspect);
      const y = size.h - pad - h; // from the top, CSS px
      rects.push({ x, y, w, h, index: o.index });
      renderer.setViewport(x, size.h - y - h, w, h);
      renderer.setScissor(x, size.h - y - h, w, h);
      renderer.setScissorTest(true);
      inset.quad.material.map = o.texture;
      inset.quad.material.needsUpdate = inset.quad.material.userData.lastMap !== o.texture;
      inset.quad.material.userData.lastMap = o.texture;
      renderer.render(inset.scene, inset.cam);
      x += w + 6;
    }
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, size.w, size.h);
    inset.rect = rects;
  }

  // ── mid-air bodies (not projectable) ──────────────────────────────────────
  _buildAir() {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, MAX_AIR);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.count = 0;
    mesh.frustumCulled = false;
    mesh.name = 'pjl-airborne';
    mesh.visible = !!this.values['cr.showAir'];
    this.scene.add(mesh);
    this.air = mesh;
    this._m4 = new THREE.Matrix4();
    this._col = new THREE.Color();
  }

  _updateAir() {
    const list = this.life.airborne();
    const n = Math.min(MAX_AIR, list.length);
    const m = this._m4;
    for (let i = 0; i < n; i++) {
      const b = list[i];
      const r = b.r || 0.03;
      m.makeScale(r, r, r).setPosition(b.x, b.y, b.z);
      this.air.setMatrixAt(i, m);
      const c = b.color || [1, 0.4, 0.3];
      this.air.setColorAt(i, this._col.setRGB(c[0], c[1], c[2]));
    }
    this.air.count = n;
    this.air.instanceMatrix.needsUpdate = true;
    if (this.air.instanceColor) this.air.instanceColor.needsUpdate = true;
  }

  // ── picking: a click (not a drag) on a surface seeds life there ───────────
  _bindPointer() {
    const el = this.renderer.domElement;
    const ray = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let down = null;
    const onDown = (e) => {
      down = { x: e.clientX, y: e.clientY, t: performance.now() };
    };
    const onUp = (e) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      const quick = performance.now() - down.t < 450;
      down = null;
      if (moved > 6 || !quick) return;
      const rect = el.getBoundingClientRect();
      ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
      ray.setFromCamera(ndc, this.camera);
      const hit = this.room.pick(ray);
      if (hit) {
        this.life.seed(hit.patchId, hit.local[0], hit.local[1]);
        this.lastSeed = hit;
        this._emit(true);
      }
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointerup', onUp);
    this._unbindPointer = () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointerup', onUp);
    };
  }

  // ── stats ─────────────────────────────────────────────────────────────────
  _stats() {
    const life = this.life?.stats() || null;
    return {
      ready: !!this.room,
      playing: this.playing,
      view: this.view,
      fps: this.fps,
      frameMs: this.frameMs,
      pitchDeg: pitchDeg(this.values['room.apex']),
      life,
      coverage: this.projection?.coverage() || null,
      insets: this.inset?.rect || null,
      lastSeed: this.lastSeed || null,
    };
  }

  _emit(force = false) {
    if (!this.listeners.size) return;
    if (!force && this.disposed) return;
    const s = this._stats();
    for (const fn of this.listeners) fn(s);
  }
}
