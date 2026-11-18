/* The live 3D layer of the /memories Mapbox map: each wanted spot's baked GLB standing on the
   map as a diorama. Loaded lazily (three.js + GLTFLoader) the first time the map passes
   MODEL_ZOOM; see models.js for the thresholds and useModels.js for the React side.

   ONE Mapbox custom layer, drawing into Mapbox's own WebGL context with one three.js renderer
   (no second context, and never a new map: every new mapboxgl.Map() is a billed load).

   Each diorama has a fixed screen size, not true scale. It's drawn with its own camera into its
   own square (viewport + scissor) whose position puts the room's footprint centre exactly on the
   spot's map.project() point. That camera follows the map: it looks the way the map is turned
   (bearing) and tilts with it (pitch). Because placement comes from map.project(), the globe →
   mercator transition needs no special handling (and at zoom 15+ the map is mercator anyway).

   The room is turned so that with the map facing north it's seen from its hero render's side
   (scene/heroView.js), so the marker → model switch keeps the same view. That turn is a display
   choice: a room's "north" is the wall you face from its doorway, and no bearing is stored.

   Per diorama: unlit baked materials (viewer/bakedMaterials.js), the dollhouse cut-away
   (viewer/dollhouse.js: no ceiling, the walls facing the camera fade out), a soft contact shadow
   and, when selected or focused, a ring on the ground. Textures are at most 512 px: model/map
   already is; a spot with only room.glb has its atlases shrunk here before they reach the GPU.
   Everything that leaves is disposed (viewer/dispose.js). */

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { HERO_FOV, heroView } from '../../scene/heroView.js';
import { applyBakedMaterials } from '../../viewer/bakedMaterials.js';
import { applyDollhouse, indexRoom, stepFades } from '../../viewer/dollhouse.js';
import { disposeTree, texturesOf } from '../../viewer/dispose.js';
import { MODEL_ZOOM, REST_PITCH, modelPx } from './models.js';

export const LAYER_ID = 'mr-models';
const TEX_PX = 512;
const RAD = Math.PI / 180;
const HALF_FOV = (HERO_FOV / 2) * RAD;
/** The diorama's view never goes flatter or steeper than this (deg above the horizon). */
const ELEV_MIN = 22;
const ELEV_MAX = 72;
/** Contact shadow and ground ring, as a share of the footprint. */
const SHADOW_SCALE = 1.55;
const RING_SCALE = 1.32;
const RING_WIDTH = 0.035;

const asList = (m) => (Array.isArray(m) ? m : m ? [m] : []);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const canvasOf = (w, h) => Object.assign(document.createElement('canvas'), { width: Math.max(1, Math.round(w)), height: Math.max(1, Math.round(h)) });

/** Atlases over `max` px shrunk on a canvas (halving first, so it doesn't alias) before they reach the GPU. */
function shrinkTextures(root, max) {
  const textures = new Set();
  root.traverse((o) => {
    for (const m of asList(o.material)) for (const t of texturesOf(m)) textures.add(t);
  });
  for (const tex of textures) {
    const img = tex.image;
    const w = img?.width || 0;
    const h = img?.height || 0;
    if (Math.max(w, h) <= max) continue;
    let src = img;
    let sw = w;
    let sh = h;
    while (Math.max(sw, sh) / 2 > max) {
      const c = canvasOf(sw / 2, sh / 2);
      const ctx = c.getContext('2d');
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(src, 0, 0, c.width, c.height);
      if (src !== img) src.width = 0;
      src = c;
      sw = c.width;
      sh = c.height;
    }
    const k = max / Math.max(sw, sh);
    const out = canvasOf(sw * k, sh * k);
    const ctx = out.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(src, 0, 0, out.width, out.height);
    if (src !== img) src.width = 0;
    if (typeof img.close === 'function') img.close();
    tex.image = out;
    tex.needsUpdate = true;
  }
}

/** A soft round blob, white → clear (tinted by its material). Most of it is under the floor:
    it stays dense out to the footprint's edge (1 / SHADOW_SCALE) and fades beyond it. */
function blobTexture() {
  const c = canvasOf(128, 128);
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.62, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.8, 'rgba(255,255,255,0.4)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 'rgb(…)' / 'rgba(…)' → { color, alpha }. */
function parseColor(css, fallback) {
  const m = /rgba?\(([^)]+)\)/.exec(css || '');
  if (!m) return fallback;
  const [r, g, b, a = 1] = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return { color: new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace), alpha: a };
}

const _v = new THREE.Vector3();
const _dir = new THREE.Vector3();

export class ModelLayer {
  /**
   * map: the loaded mapboxgl.Map. onChange(): called when a model becomes ready, fails or goes
   * (React redraws the overlay: hit targets, which markers hide).
   */
  constructor(map, { onChange }) {
    this.map = map;
    this.onChange = onChange;
    this.entries = new Map(); // id → entry
    this.order = [];
    this.compact = false;
    this.selected = null;
    this.focused = null;
    this.renderer = null;
    this.broken = false;
    this.busy = null;
    this.lastT = 0;
    this.counts = { loaded: 0, disposed: 0, failed: 0, frames: 0, drawMs: 0, drawMaxMs: 0 };
    this.reduced = (() => {
      try {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      } catch {
        return false;
      }
    })();
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    this.blob = blobTexture();
    this.shadowMat = new THREE.MeshBasicMaterial({ map: this.blob, color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false });
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xb5532f, side: THREE.DoubleSide });
    this.custom = {
      id: LAYER_ID,
      type: 'custom',
      renderingMode: '3d',
      onAdd: (_map, gl) => this.onAdd(gl),
      render: (gl) => this.draw(gl),
    };
    map.addLayer(this.custom);
    // For the checks (tools/memory-rooms/page-check.mjs): GPU and load counts.
    window.__mrModels = () => this.stats();
  }

  onAdd(gl) {
    const r = new THREE.WebGLRenderer({ canvas: this.map.getCanvas(), context: gl });
    r.autoClear = false;
    r.outputColorSpace = THREE.SRGBColorSpace; // the bake is display-referred sRGB, as in the viewer
    r.toneMapping = THREE.NoToneMapping;
    this.renderer = r;
  }

  /** Colours from the CSS tokens (--mr-marker-shadow, --mr-accent), as computed rgb()/rgba(). */
  setColors({ shadow, accent }) {
    const s = parseColor(shadow, { color: new THREE.Color(0, 0, 0), alpha: 0.3 });
    this.shadowMat.color.copy(s.color);
    this.shadowMat.opacity = s.alpha;
    const a = parseColor(accent, null);
    if (a) this.ringMat.color.copy(a.color);
    this.map.triggerRepaint();
  }

  /** wanted: [{ id, spot, lat, lng, url, key, lod }] nearest first (models.js wantedModels). */
  setWanted(wanted, { compact = false } = {}) {
    this.compact = compact;
    const next = new Map(wanted.map((w) => [w.id, w]));
    let changed = false;
    for (const [id, e] of this.entries) {
      const w = next.get(id);
      if (!w || w.key !== e.key) {
        this.drop(e);
        changed = true;
      } else {
        e.lat = w.lat;
        e.lng = w.lng;
      }
    }
    for (const w of wanted) {
      if (!this.entries.has(w.id)) this.entries.set(w.id, { ...w, state: 'queued' });
      else this.entries.get(w.id).url = w.url; // a fresh signed link for the same file
    }
    this.order = wanted.map((w) => w.id);
    this.pump();
    if (changed) this.onChange();
    this.map.triggerRepaint();
  }

  setHighlight(selected, focused) {
    if (selected === this.selected && focused === this.focused) return;
    this.selected = selected;
    this.focused = focused;
    this.map.triggerRepaint();
  }

  isReady(id) {
    return this.entries.get(id)?.state === 'ready';
  }

  /** Where a ready model is on screen: { left, top, size, box: { x0, y0, x1, y1 }, x, y } in CSS px, or null. */
  placementOf(id) {
    const e = this.entries.get(id);
    return e?.state === 'ready' ? this.place(e) : null;
  }

  stats() {
    let live = 0;
    let loading = 0;
    for (const e of this.entries.values()) {
      if (e.state === 'ready') live++;
      else if (e.state === 'loading' || e.state === 'queued') loading++;
    }
    const mem = this.renderer?.info.memory || { textures: 0, geometries: 0 };
    return { live, loading, ids: [...this.entries.keys()], ...this.counts, textures: mem.textures, geometries: mem.geometries, programs: this.renderer?.info.programs?.length || 0, broken: this.broken };
  }

  /* ── loading ──────────────────────────────────────────────────────────── */

  pump() {
    if (this.busy || this.broken) return;
    const e = this.order.map((id) => this.entries.get(id)).find((x) => x?.state === 'queued');
    if (e) this.load(e);
  }

  async load(e) {
    e.state = 'loading';
    this.busy = e;
    const ac = new AbortController();
    e.abort = ac;
    const gone = () => ac.signal.aborted || this.entries.get(e.id) !== e;
    let root = null;
    try {
      const res = await fetch(e.url, { signal: ac.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = await res.arrayBuffer();
      if (gone()) return;
      root = (await this.loader.parseAsync(buf, '')).scene;
      if (gone()) return;
      if (!e.lod) shrinkTextures(root, TEX_PX);
      this.build(e, root);
      root = null;
      e.state = 'ready';
      this.counts.loaded++;
    } catch (err) {
      if (gone()) return;
      e.state = 'failed';
      this.counts.failed++;
      console.warn(`[memory-rooms] no 3D model for "${e.spot?.title}" on the map:`, err?.message || err);
    } finally {
      if (root) disposeTree(root);
      if (this.busy === e) this.busy = null;
      this.onChange();
      this.map.triggerRepaint();
      this.pump();
    }
  }

  build(e, root) {
    applyBakedMaterials(root, { anisotropy: 2 });
    root.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(root);
    const fx = (box.min.x + box.max.x) / 2;
    const fz = (box.min.z + box.max.z) / 2;
    const fw = box.max.x - box.min.x;
    const fd = box.max.z - box.min.z;
    // the footprint centre goes to the origin: that point stands on the spot's location
    root.position.set(-fx, 0, -fz);
    const holder = new THREE.Group();
    holder.add(root);
    // seen from the hero's side when the map faces north (camera at map azimuth 180)
    const hero = heroView(e.spot?.scene);
    holder.rotation.y = -(180 - hero.azimuth) * RAD;

    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(fw * SHADOW_SCALE, fd * SHADOW_SCALE).rotateX(-Math.PI / 2), this.shadowMat);
    shadow.position.y = -0.02;
    shadow.renderOrder = -1;
    const ring = new THREE.Mesh(new THREE.RingGeometry(1 - RING_WIDTH, 1, 96).rotateX(-Math.PI / 2), this.ringMat);
    ring.scale.set((fw / 2) * RING_SCALE, 1, (fd / 2) * RING_SCALE);
    ring.position.y = -0.01;
    ring.visible = false;
    holder.add(shadow, ring);

    const scene = new THREE.Scene();
    scene.add(holder);
    scene.updateMatrixWorld(true);

    const local = box.clone().translate(new THREE.Vector3(-fx, 0, -fz));
    const sphere = local.getBoundingSphere(new THREE.Sphere());
    const corners = [];
    for (let i = 0; i < 8; i++) {
      corners.push(new THREE.Vector3(i & 1 ? local.max.x : local.min.x, i & 2 ? local.max.y : local.min.y, i & 4 ? local.max.z : local.min.z).applyMatrix4(holder.matrixWorld));
    }
    Object.assign(e, {
      scene,
      holder,
      root,
      shadow,
      ring,
      hero,
      room: { root, interior: (e.spot?.scene?.kind || e.spot?.kind) === 'interior', ...indexRoom(root, e.spot?.scene || null) },
      centre: sphere.center.clone().applyMatrix4(holder.matrixWorld),
      radius: sphere.radius,
      corners,
      camera: new THREE.PerspectiveCamera(HERO_FOV, 1, 0.1, 1000),
    });
  }

  drop(e) {
    e.abort?.abort();
    if (e.state === 'ready') {
      // shared materials stay; the shadow and ring geometries are this entry's
      e.shadow.geometry.dispose();
      e.ring.geometry.dispose();
      disposeTree(e.root);
      e.scene = null;
      this.counts.disposed++;
    }
    e.state = 'gone';
    this.entries.delete(e.id);
    if (this.busy === e) this.busy = null;
  }

  /* ── placement + drawing ──────────────────────────────────────────────── */

  /** The diorama's camera for the current map view, and where its square sits (CSS px). */
  place(e) {
    const map = this.map;
    const a = map.project([e.lng, e.lat]);
    if (!Number.isFinite(a.x) || !Number.isFinite(a.y)) return null;
    const size = modelPx(Math.max(MODEL_ZOOM, map.getZoom()), this.compact);
    // looking the way the map looks; at REST_PITCH the hero render's own elevation
    const elev = clamp(e.hero.elevation + (REST_PITCH - map.getPitch()), ELEV_MIN, ELEV_MAX) * RAD;
    const az = (map.getBearing() + 180) * RAD; // camera azimuth, from the room toward the camera
    _dir.set(Math.sin(az) * Math.cos(elev), Math.sin(elev), -Math.cos(az) * Math.cos(elev));
    const d = (e.radius / Math.sin(HALF_FOV)) * 1.02;
    const cam = e.camera;
    cam.position.copy(e.centre).addScaledVector(_dir, d);
    cam.up.set(0, 1, 0);
    cam.lookAt(e.centre);
    cam.near = Math.max(0.01, d - e.radius * 1.3);
    cam.far = d + e.radius * 1.3;
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld();
    // the footprint centre (the origin) lands on the spot's point
    _v.set(0, 0, 0).project(cam);
    const left = a.x - ((_v.x + 1) / 2) * size;
    const top = a.y - ((1 - _v.y) / 2) * size;
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const c of e.corners) {
      _v.copy(c).project(cam);
      const px = left + ((_v.x + 1) / 2) * size;
      const py = top + ((1 - _v.y) / 2) * size;
      x0 = Math.min(x0, px);
      x1 = Math.max(x1, px);
      y0 = Math.min(y0, py);
      y1 = Math.max(y1, py);
    }
    return { left, top, size, x: a.x, y: a.y, box: { x0, y0, x1, y1 }, camera: cam };
  }

  draw(gl) {
    const r = this.renderer;
    if (!r || this.broken) return;
    const live = [];
    for (const e of this.entries.values()) if (e.state === 'ready') live.push(e);
    if (!live.length) {
      this.lastT = 0;
      return;
    }
    try {
      const canvas = this.map.getCanvas();
      const W = gl.drawingBufferWidth;
      const H = gl.drawingBufferHeight;
      const cw = canvas.clientWidth || W;
      const ch = canvas.clientHeight || H;
      const dpr = W / cw;
      const now = performance.now();
      const dt = this.lastT ? Math.min(100, now - this.lastT) : 0;
      this.lastT = now;
      const placed = [];
      for (const e of live) {
        const p = this.place(e);
        if (p && p.left < cw && p.top < ch && p.left + p.size > 0 && p.top + p.size > 0) placed.push([e, p]);
      }
      placed.sort((a, b) => a[1].y - b[1].y); // further up the screen = further away: drawn first
      r.resetState();
      r.setScissorTest(true);
      let moving = false;
      for (const [e, p] of placed) {
        const s = Math.round(p.size * dpr);
        const x = Math.round(p.left * dpr);
        const y = Math.round(H - p.top * dpr - s);
        r.setViewport(x, y, s, s);
        r.setScissor(x, y, s, s);
        r.clearDepth(); // this square only (the scissor): the room never meets the map's depth
        applyDollhouse(e.room, [p.camera.position.x, p.camera.position.z], [e.centre.x, e.centre.z], true);
        if (stepFades(e.room, dt, this.reduced)) moving = true;
        e.ring.visible = e.id === this.selected || e.id === this.focused;
        r.render(e.scene, p.camera);
      }
      r.setScissorTest(false);
      r.resetState();
      const ms = performance.now() - now;
      this.counts.frames++;
      this.counts.drawMs += ms;
      this.counts.drawMaxMs = Math.max(this.counts.drawMaxMs, ms);
      if (moving) this.map.triggerRepaint();
      else this.lastT = 0;
    } catch (err) {
      this.fail(err);
    }
  }

  /** Anything going wrong while drawing: back to markers for the rest of the page's life. */
  fail(err) {
    if (this.broken) return;
    this.broken = true;
    console.warn('[memory-rooms] 3D models on the map turned off:', err?.message || err);
    for (const e of [...this.entries.values()]) this.drop(e);
    this.onChange();
  }

  destroy() {
    for (const e of [...this.entries.values()]) this.drop(e);
    try {
      if (this.map.getLayer(LAYER_ID)) this.map.removeLayer(LAYER_ID);
    } catch {
      /* the map is already gone */
    }
    this.shadowMat.dispose();
    this.ringMat.dispose();
    this.blob.dispose();
    this.renderer?.dispose();
    this.renderer = null;
    if (window.__mrModels) delete window.__mrModels;
  }
}
