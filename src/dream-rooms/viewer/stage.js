/* Dream Rooms · the stage: everything the corridor and every dream share.

     const stage = createStage(host, getProps)
     stage.setContent({ mode, dream, rows })     (re)load what's shown
     stage.dispose()

   One WebGLRenderer for the stage's life (NoToneMapping, sRGB, no MSAA), an
   EffectComposer with a RenderPass + ONE ShaderPass (dreamPass.js), one camera and
   one walker. A "runner" (CorridorRunner, DreamRunner or StillsRunner) owns a scene
   and moves the walker; the stage renders whichever runner is active. Tweens run
   on the stage clock, so a hidden tab pauses them too. */

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { DreamShader } from './dreamPass.js';
import { DIMS } from '../contracts/layout.js';
import { createControls } from './walker.js';
import { unlockAudio, stop as stopAudio } from './audio.js';
import { DreamRunner, StillsRunner } from './dream.js';
import { CorridorRunner } from './corridor.js';

const ease = (t) => t * t * (3 - 2 * t);

export function createStage(host, getProps) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;

  const canvasWrap = document.createElement('div');
  canvasWrap.className = 'dr-stage__canvas';
  host.appendChild(canvasWrap);
  const lineEl = document.createElement('p');
  lineEl.className = 'dr-stage__line';
  lineEl.setAttribute('aria-live', 'polite');
  host.appendChild(lineEl);
  const stillsEl = document.createElement('div');
  stillsEl.className = 'dr-stage__stills';
  host.appendChild(stillsEl);

  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  } catch (err) {
    console.warn('[dream-rooms] WebGL unavailable', err?.message || '');
    host.dataset.state = 'error';
    window.__dream = { state: 'error', module: null, fps: 0, lap: 0, swaps: 0, events: [] };
    getProps().onState?.('error');
    return { setContent() {}, dispose() { canvasWrap.remove(); lineEl.remove(); stillsEl.remove(); } };
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  renderer.setClearColor(0x000000, 1);
  canvasWrap.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(DIMS.walker.fov, 1, 0.05, 140);
  const wide = new THREE.PerspectiveCamera(DIMS.walker.fov * DIMS.unseen.frustumScale, 1, 0.05, DIMS.unseen.far);
  const frustum = new THREE.Frustum();
  const m4 = new THREE.Matrix4();
  const composer = new EffectComposer(renderer);
  const empty = new THREE.Scene();
  empty.background = new THREE.Color(0, 0, 0);
  const renderPass = new RenderPass(empty, camera);
  composer.addPass(renderPass);
  const pass = new ShaderPass(DreamShader);
  composer.addPass(pass);

  const S = {
    THREE,
    host,
    renderer,
    camera,
    composer,
    pass,
    reduce,
    coarse,
    time: 0,
    fps: 0,
    lost: false,
    walker: { x: 0, z: 0, yaw: 0, pitch: 0, v: 0, turnV: 0, hold: 0 },
    eye: DIMS.walker.eye,
    fx: { white: 0, black: 1, whiteGrain: 0 },
    runner: null,
    corridor: null,
    dream: null,
    getProps,
    lineShown: false,
  };

  /* ── tweens + waits on the stage clock ─────────────────────────────── */
  const tweens = new Map();
  S.tween = (key, to, secs) =>
    new Promise((resolve) => {
      const prev = tweens.get(key);
      if (prev) prev.resolve();
      if (secs <= 0) {
        S.fx[key] = to;
        tweens.delete(key);
        resolve();
        return;
      }
      tweens.set(key, { from: S.fx[key], to, t: 0, secs, resolve });
    });
  const waits = new Set();
  S.wait = (secs) =>
    new Promise((resolve) => {
      waits.add({ at: S.time + secs, resolve });
    });

  /* ── overlays: the wake line (the only screen text) and the stills fallback ── */
  S.showLine = (text) => {
    lineEl.textContent = text || '';
    lineEl.classList.add('is-on');
    S.lineShown = true;
  };
  S.hideLine = () => {
    lineEl.classList.remove('is-on');
    S.lineShown = false;
  };
  S.stillsEl = stillsEl;

  /* ── camera + the unseen rule (decision 6) ─────────────────────────── */
  S.syncCamera = () => {
    const w = S.walker;
    camera.position.set(w.x, S.eye, w.z);
    camera.rotation.set(w.pitch, w.yaw, 0, 'YXZ');
    camera.updateMatrixWorld();
    wide.position.copy(camera.position);
    wide.quaternion.copy(camera.quaternion);
    wide.updateMatrixWorld();
    frustum.setFromProjectionMatrix(m4.multiplyMatrices(wide.projectionMatrix, wide.matrixWorldInverse));
  };
  /** Seen = inside a frustum 30 % wider than the camera's AND within 15 m. */
  S.seen = (sphere) => {
    if (camera.position.distanceTo(sphere.center) - sphere.radius > DIMS.unseen.far) return false;
    return frustum.intersectsSphere(sphere);
  };
  const _p = new THREE.Vector3();
  /** A world point → CSS px on the page, or null when it's behind you or off the canvas. */
  S.toScreen = (p) => {
    _p.set(p[0], p[1], p[2]).project(camera);
    if (_p.z > 1 || _p.z < -1 || Math.abs(_p.x) > 1 || Math.abs(_p.y) > 1) return null;
    const r = renderer.domElement.getBoundingClientRect();
    return { x: r.left + ((_p.x + 1) / 2) * r.width, y: r.top + ((1 - _p.y) / 2) * r.height };
  };
  const ray = new THREE.Raycaster();
  S.rayFrom = (clientX, clientY) => {
    const r = renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray;
  };

  /* ── input ─────────────────────────────────────────────────────────── */
  S.controls = createControls(renderer.domElement, {
    look: (dyaw, dpitch) => {
      if (!S.runner?.acceptsLook?.()) return;
      S.walker.yaw += dyaw;
      S.walker.pitch = Math.max(-0.35, Math.min(0.35, S.walker.pitch + dpitch));
    },
    // the first tap anywhere unlocks sound for the whole session (and starts whatever bed is waiting);
    // later taps just resume a context iOS may have interrupted
    onGesture: () => unlockAudio(),
    onTap: (x, y) => S.runner?.onTap?.(x, y),
  });

  /* ── size ──────────────────────────────────────────────────────────── */
  const resize = () => {
    const w = Math.max(1, host.clientWidth);
    const h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    pass.uniforms.uRes.value = [w * pr, h * pr];
    // ≈ 62° (vertical) as decision 8 says; held in portrait, widen it so the horizontal never drops below ~40°
    const aspect = w / h;
    const base = DIMS.walker.fov;
    const fov = aspect < 1 ? Math.min(78, Math.max(base, (2 * Math.atan(Math.tan((20 * Math.PI) / 180) / aspect) * 180) / Math.PI)) : base;
    camera.fov = fov;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    wide.fov = fov * DIMS.unseen.frustumScale;
    wide.aspect = aspect;
    wide.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  /* ── context loss ──────────────────────────────────────────────────── */
  const onLost = (e) => {
    e.preventDefault();
    S.lost = true;
  };
  const onRestored = () => {
    S.lost = false;
    resize();
    S.runner?.onRestored?.();
  };
  renderer.domElement.addEventListener('webglcontextlost', onLost);
  renderer.domElement.addEventListener('webglcontextrestored', onRestored);

  /* ── the loop ──────────────────────────────────────────────────────── */
  let raf = 0;
  let last = performance.now();
  let frames = 0;
  let fpsT = last;
  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    if (S.lost) return;
    S.time += dt;
    for (const [key, tw] of tweens) {
      tw.t += dt;
      const k = Math.min(1, tw.t / tw.secs);
      S.fx[key] = tw.from + (tw.to - tw.from) * ease(k);
      if (k >= 1) {
        tweens.delete(key);
        tw.resolve();
      }
    }
    for (const w of [...waits]) {
      if (S.time >= w.at) {
        waits.delete(w);
        w.resolve();
      }
    }
    try {
      S.runner?.update(dt);
    } catch (err) {
      console.error('[dream-rooms] frame failed', err);
      S.runner?.fail?.(err);
      S.runner = null;
    }
    if (!S.runner) S.syncCamera();
    const u = pass.uniforms;
    u.uTime.value = reduce ? 0 : S.time;
    u.uWhite.value = S.fx.white;
    u.uBlack.value = S.fx.black;
    u.uWhiteGrain.value = S.fx.whiteGrain;
    renderPass.scene = S.runner?.scene || empty;
    composer.render(dt);
    frames += 1;
    if (now - fpsT > 1000) {
      S.fps = Math.round((frames * 1000) / (now - fpsT));
      frames = 0;
      fpsT = now;
    }
  };
  raf = requestAnimationFrame(frame);

  /* ── content ───────────────────────────────────────────────────────── */
  let sig = '';
  const dropAll = () => {
    S.dream?.dispose();
    S.dream = null;
    S.corridor?.dispose();
    S.corridor = null;
    S.runner = null;
    S.hideLine();
  };

  function setContent({ mode, dream, rows }) {
    const p = getProps();
    if (mode === 'corridor') {
      const next = `corridor:${rowsSig(rows)}`;
      if (next === sig) return;
      if (S.corridor && sig.startsWith('corridor:')) {
        sig = next;
        S.corridor.setRows(rows || []);
        return;
      }
      sig = next;
      dropAll();
      S.corridor = new CorridorRunner(S, { rows: rows || [], at: p.at || null, enter: p.enter || null, autopilot: !!p.autopilot });
      S.runner = S.corridor;
      S.corridor.start();
      return;
    }
    if (!dream) return;
    const next = `dream:${dream.id}:${dream.model_url || ''}:${dream.world?.dream_version ?? ''}:${p.still ? 1 : 0}`;
    if (next === sig) return;
    sig = next;
    dropAll();
    const stillMode = p.still || dream.world?.fallback === 'still';
    const Runner = stillMode ? StillsRunner : DreamRunner;
    const r = new Runner(S, {
      id: dream.id,
      world: dream.world,
      modelUrl: dream.model_url,
      stills: dream.stills || [],
      mood: dream.mood || p.mood || null,
      autopilot: !!p.autopilot,
      entry: 'black',
      onState: (st) => getProps().onState?.(st),
      onWoken: (id) => getProps().onWake?.(id),
    });
    S.dream = r;
    S.runner = r;
    r.start();
  }

  return {
    setContent,
    dispose() {
      cancelAnimationFrame(raf);
      for (const tw of tweens.values()) tw.resolve();
      tweens.clear();
      waits.clear();
      dropAll();
      stopAudio();
      S.controls.dispose();
      ro.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onRestored);
      pass.material.dispose();
      composer.dispose();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvasWrap.remove();
      lineEl.remove();
      stillsEl.remove();
    },
  };
}

/** Rows change identity on every fetch; only rebuild the corridor when something that shows changed. */
function rowsSig(rows) {
  return (rows || []).map((r) => `${r.id}|${r.dreamt_on}|${r.night_order}|${r.status}|${r.title || ''}|${r.first_words || ''}|${r.deleted_at || ''}`).join(';');
}
