import { useEffect, useRef, useState } from 'react';
import corridorUrl from './corridor.glb?url';
import { DreamShader } from './dreamPass';

/* ============================================================================
   LIMINAL SKETCH — the one live sketch on the plan page (Experience tab).
   ----------------------------------------------------------------------------
   It runs the proposed split for real, at toy size:
     · corridor.glb was built, lit and baked by HEADLESS BLENDER on this PC
       (tools/dream-rooms-plan/blender/corridor.py): an 8 m segment, 57 KB,
       KHR_materials_unlit, so three.js only shows the bake
     · the browser adds what can't be baked: FogExp2, the one-pass dream
       shader (dreamPass.js), an endless loop (copies + a one-segment teleport),
       a door that changes only while you aren't looking, a flickering tube,
       text fragments from the dream, and a procedural 100 Hz hum
   Plan-page only. The real viewer is specified in build-prompt.md.
   ========================================================================== */

const SEG = 8; // segment length in metres (matches corridor.py)
const COPIES = [-1, 0, 1, 2, 3];
const OXBLOOD = [0.62, 0.16, 0.13];

export default function LiminalSketch({ fragments = [] }) {
  const hostRef = useRef(null);
  const apiRef = useRef(null);
  const [state, setState] = useState('loading');
  const [mode, setMode] = useState('dream');
  const [walking, setWalking] = useState(
    () => !(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false),
  );
  const [hum, setHum] = useState(false);
  const [lap, setLap] = useState(0);
  const [word, setWord] = useState('');
  const [fps, setFps] = useState(0);
  const debug = new URLSearchParams(window.location.search).has('debug');

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};
    (async () => {
      try {
        const [THREE, { GLTFLoader }, { EffectComposer }, { RenderPass }, { ShaderPass }] = await Promise.all([
          import('three'),
          import('three/addons/loaders/GLTFLoader.js'),
          import('three/addons/postprocessing/EffectComposer.js'),
          import('three/addons/postprocessing/RenderPass.js'),
          import('three/addons/postprocessing/ShaderPass.js'),
        ]);
        const gltf = await new GLTFLoader().loadAsync(corridorUrl);
        if (cancelled || !hostRef.current) return;
        const api = mount(hostRef.current, gltf, { THREE, EffectComposer, RenderPass, ShaderPass }, {
          fragments,
          onLap: setLap,
          onWord: setWord,
          onFps: setFps,
        });
        apiRef.current = api;
        cleanup = api.dispose;
        setState('ready');
      } catch (err) {
        console.warn('[dream-rooms-plan] sketch failed', err);
        if (!cancelled) setState('error');
      }
    })();
    return () => {
      cancelled = true;
      cleanup();
      apiRef.current = null;
    };
  }, [fragments]);

  useEffect(() => { apiRef.current?.setMode(mode); }, [mode, state]);
  useEffect(() => { apiRef.current?.setWalking(walking); }, [walking, state]);

  // the hum: Web Audio needs a tap first (iOS), so it only starts from the button
  const audioRef = useRef(null);
  useEffect(() => {
    if (!hum) return undefined;
    const a = startHum();
    audioRef.current = a;
    return () => { a?.stop(); audioRef.current = null; };
  }, [hum]);

  return (
    <div className="drp-sketch">
      <div className="drp-sketch__stage" data-state={state} data-mode={mode}>
        <div ref={hostRef} className="drp-sketch__canvas" role="img" aria-label="Live sketch: an endless, hazy corridor baked in Blender and shown with browser effects" />
        {state === 'loading' && <span className="drp-sketch__msg">Opening the corridor…</span>}
        {state === 'error' && <span className="drp-sketch__msg">WebGL isn’t available here, and the sketch needs it.</span>}
        {state === 'ready' && (
          <span className="drp-sketch__fps" data-fps={fps} data-lap={lap} data-word={word} hidden={!debug}>
            {fps ? `${fps} fps · lap ${lap}` : ''}
          </span>
        )}
      </div>
      <div className="drp-sketch__bar">
        <button type="button" className="drp-ghost" aria-pressed={mode === 'raw'} onClick={() => setMode((m) => (m === 'raw' ? 'dream' : 'raw'))}>
          {mode === 'raw' ? 'Dream it' : 'Raw bake'}
        </button>
        <button type="button" className="drp-ghost" aria-pressed={walking} onClick={() => setWalking((v) => !v)}>
          {walking ? 'Stop walking' : 'Walk'}
        </button>
        <button type="button" className="drp-ghost" aria-pressed={hum} onClick={() => setHum((v) => !v)}>
          {hum ? 'Hum off' : 'Hum on'}
        </button>
      </div>
    </div>
  );
}

/* ── three.js ────────────────────────────────────────────────────────────── */

function mount(host, gltf, { THREE, EffectComposer, RenderPass, ShaderPass }, { fragments, onLap, onWord, onFps }) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NoToneMapping;
  host.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const FOG = new THREE.Color('#8f8862');
  scene.background = FOG.clone();
  scene.fog = new THREE.FogExp2(FOG, 0.085);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 60);
  camera.position.set(0.22, 1.5, -1);

  // copies of the baked segment, each with its own door + tube materials so a
  // change can happen in one place only
  const copies = COPIES.map((k) => {
    const root = gltf.scene.clone(true);
    root.position.z = -k * SEG;
    const doors = {};
    let tube = null;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        if (/^door_[a-c]$/.test(m.name)) { doors[m.name] = doors[m.name] || m.clone(); return doors[m.name]; }
        if (/^fluoro/.test(m.name)) { tube = tube || m.clone(); return tube; }
        return m;
      });
      o.material = Array.isArray(o.material) ? next : next[0];
    });
    scene.add(root);
    return { k, root, doors, tube };
  });

  // a door "is seen" when it's inside a frustum 30 % wider than the camera's and nearer than the fog wall
  const wide = new THREE.PerspectiveCamera(62 * 1.3, 1, 0.05, 15);
  const frustum = new THREE.Frustum();
  const m4 = new THREE.Matrix4();
  // the doors are part of one joined mesh, so use their known spots from corridor.py
  const doorSpheres = {};
  const DOOR_SPOTS = { door_a: [-1.08, 0.22], door_b: [1.08, 0.55], door_c: [-1.08, 0.82] };
  for (const [name, [x, f]] of Object.entries(DOOR_SPOTS)) doorSpheres[name] = { x, z: -f * SEG };

  let base = 0; // logical segment of copy k = 0
  const tinted = new Set(); // "seg:door"
  const unseenSince = new Map();
  const apply = () => {
    for (const c of copies) {
      const s = base + c.k;
      for (const [name, mat] of Object.entries(c.doors)) {
        if (tinted.has(`${s}:${name}`)) mat.color.setRGB(...OXBLOOD);
        else mat.color.setRGB(1, 1, 1);
      }
    }
  };
  const seen = (c, name) => {
    const p = doorSpheres[name];
    const v = new THREE.Vector3(p.x, 1.0, p.z + c.root.position.z);
    if (v.distanceTo(camera.position) > 15) return false;
    return frustum.intersectsSphere(new THREE.Sphere(v, 1.1));
  };

  // the dream's own words, painted on the left wall: a live text plane (fogged
  // like everything else) that moves on to its next line only while unseen
  const wordCanvas = document.createElement('canvas');
  wordCanvas.width = 1024;
  wordCanvas.height = 128;
  const wordTex = new THREE.CanvasTexture(wordCanvas);
  wordTex.colorSpace = THREE.SRGBColorSpace;
  wordTex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const wordMat = new THREE.MeshBasicMaterial({ map: wordTex, transparent: true, depthWrite: false });
  const wordMesh = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.4), wordMat);
  wordMesh.rotation.y = Math.PI / 2; // faces +x, reads away from you as you walk
  scene.add(wordMesh);
  const paintWord = (text) => {
    const g = wordCanvas.getContext('2d');
    g.clearRect(0, 0, wordCanvas.width, wordCanvas.height);
    g.font = 'italic 64px Georgia, "Times New Roman", serif';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(58, 44, 30, 0.82)';
    g.fillText(text, 12, 66, wordCanvas.width - 24);
    wordTex.needsUpdate = true;
    onWord(text);
  };
  let wordIdx = 0;
  let wordSeg = 0; // logical segment the words sit in (the first line is just ahead)
  let wordUnseen = null;
  if (fragments.length) paintWord(fragments[0]);
  else wordMesh.visible = false;
  const wordPos = new THREE.Vector3();
  const placeWord = () => {
    wordMesh.position.set(-1.07, 1.55, -(wordSeg - base) * SEG - SEG * 0.42);
    wordPos.copy(wordMesh.position);
  };
  placeWord();

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const dream = new ShaderPass(DreamShader);
  composer.addPass(dream);

  let w = 1;
  let h = 1;
  const resize = () => {
    w = Math.max(1, host.clientWidth);
    h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    const pr = renderer.getPixelRatio();
    dream.uniforms.uRes.value = [w * pr, h * pr];
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    wide.aspect = w / h;
    wide.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(host);

  // drag to look (yaw + a little pitch), easing back to straight ahead
  let yaw = 0;
  let pitch = 0;
  let drag = null;
  const onDown = (e) => { drag = { x: e.clientX, y: e.clientY, yaw, pitch }; host.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    if (!drag) return;
    yaw = drag.yaw - (e.clientX - drag.x) * 0.006;
    pitch = Math.max(-0.35, Math.min(0.35, drag.pitch - (e.clientY - drag.y) * 0.004));
  };
  const onUp = () => { drag = null; };
  host.addEventListener('pointerdown', onDown);
  host.addEventListener('pointermove', onMove);
  host.addEventListener('pointerup', onUp);
  host.addEventListener('pointercancel', onUp);

  let mode = 'dream';
  let walking = !reduce;
  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; });
  io.observe(host);

  let raf = 0;
  let last = performance.now();
  let lap = 0;
  let nextChange = 2.5;
  let nextFlicker = 5;
  let flickerUntil = 0;
  let flickerCopy = null;
  let frames = 0;
  let fpsT = last;
  let t = 0;
  onLap(0);

  const frame = (now) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    t += dt;

    if (walking) camera.position.z -= dt * 1.0;
    if (camera.position.z < -SEG) {
      camera.position.z += SEG; // the teleport: one segment back, identical view
      base += 1;
      lap += 1;
      apply();
      onLap(lap);
    }
    if (!drag) { yaw *= 1 - Math.min(1, dt * 0.6); pitch *= 1 - Math.min(1, dt * 0.6); }
    camera.rotation.set(pitch, yaw, 0, 'YXZ');
    camera.position.x = 0.22 + Math.sin(t * 0.21) * 0.04;
    camera.updateMatrixWorld();
    wide.position.copy(camera.position);
    wide.quaternion.copy(camera.quaternion);
    wide.updateMatrixWorld();
    frustum.setFromProjectionMatrix(m4.multiplyMatrices(wide.projectionMatrix, wide.matrixWorldInverse));

    // track how long each door has gone unseen
    for (const c of copies) {
      for (const name of Object.keys(c.doors)) {
        const key = `${base + c.k}:${name}`;
        if (seen(c, name)) unseenSince.delete(key);
        else if (!unseenSince.has(key)) unseenSince.set(key, t);
      }
    }
    // change one door at a time, only after it's been unseen for 1.5 s
    if (t > nextChange) {
      nextChange = t + 2 + Math.random() * 2.5;
      const pool = [...unseenSince.entries()].filter(([, since]) => t - since > 1.5).map(([key]) => key);
      if (pool.length) {
        const key = pool[Math.floor(Math.random() * pool.length)];
        if (tinted.has(key)) tinted.delete(key);
        else {
          if (tinted.size >= 2) {
            const old = [...tinted].find((x) => pool.includes(x));
            if (old) tinted.delete(old);
          }
          if (tinted.size < 2) tinted.add(key);
        }
        apply();
      }
    }
    // words: once they're behind you and unseen for 1.5 s, they move two segments on, with the next line
    placeWord();
    if (fragments.length > 1) {
      const wordSeen = wordPos.distanceTo(camera.position) < 15 && frustum.intersectsSphere(new THREE.Sphere(wordPos, 1.7));
      if (wordSeen || wordPos.z < camera.position.z) wordUnseen = null;
      else if (wordUnseen === null) wordUnseen = t;
      else if (t - wordUnseen > 1.5) {
        wordUnseen = null;
        wordSeg = base + 2;
        wordIdx = (wordIdx + 1) % fragments.length;
        paintWord(fragments[wordIdx]);
        placeWord();
      }
    }
    // a tube that flickers now and then
    if (t > nextFlicker) {
      nextFlicker = t + 6 + Math.random() * 6;
      flickerUntil = t + 0.7;
      flickerCopy = copies[1 + Math.floor(Math.random() * 2)];
    }
    for (const c of copies) {
      if (!c.tube) continue;
      const on = c === flickerCopy && t < flickerUntil ? (Math.random() > 0.45 ? 1 : 0.35) : 1;
      c.tube.color.setScalar(on);
    }

    if (mode === 'dream') {
      dream.uniforms.uTime.value = reduce ? 0 : t;
      composer.render(dt);
    } else {
      renderer.render(scene, camera);
    }

    frames += 1;
    if (now - fpsT > 1000) {
      onFps(Math.round((frames * 1000) / (now - fpsT)));
      frames = 0;
      fpsT = now;
    }
  };
  raf = requestAnimationFrame(frame);

  return {
    setMode: (m) => {
      mode = m;
      scene.fog.density = m === 'dream' ? 0.085 : 0.0;
      scene.background.copy(m === 'dream' ? FOG : new THREE.Color('#111'));
    },
    setWalking: (v) => { walking = v; },
    dispose: () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      io.disconnect();
      host.removeEventListener('pointerdown', onDown);
      host.removeEventListener('pointermove', onMove);
      host.removeEventListener('pointerup', onUp);
      host.removeEventListener('pointercancel', onUp);
      for (const c of copies) {
        Object.values(c.doors).forEach((m) => m.dispose());
        c.tube?.dispose();
      }
      gltf.scene.traverse((o) => {
        if (!o.isMesh) return;
        o.geometry.dispose();
        (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.map?.dispose(); m.dispose(); });
      });
      wordMesh.geometry.dispose();
      wordMat.dispose();
      wordTex.dispose();
      composer.dispose();
      dream.material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}

/* ── the hum: 50 Hz mains → ballast hum at 100 Hz and its harmonics ───────── */

function startHum() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  ctx.resume?.();
  const master = ctx.createGain();
  master.gain.value = 0;
  master.gain.linearRampToValueAtTime(0.07, ctx.currentTime + 1.2);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2200;
  lp.connect(master).connect(ctx.destination);
  // phone speakers lose < 150 Hz, so the 200–400 Hz harmonics carry it
  const parts = [[100, 0.35], [200, 0.5], [300, 0.28], [400, 0.16], [600, 0.05]];
  const oscs = parts.map(([f, g], i) => {
    const o = ctx.createOscillator();
    o.type = i === 0 ? 'sine' : 'triangle';
    o.frequency.value = f;
    o.detune.value = (i % 2 ? 1 : -1) * 1.5;
    const gn = ctx.createGain();
    gn.gain.value = g;
    o.connect(gn).connect(lp);
    o.start();
    return o;
  });
  // slow wobble
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 0.17;
  const lfoG = ctx.createGain();
  lfoG.gain.value = 0.015;
  lfo.connect(lfoG).connect(master.gain);
  lfo.start();
  return {
    stop: () => {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.15);
      setTimeout(() => { oscs.forEach((o) => o.stop()); lfo.stop(); ctx.close(); }, 500);
    },
  };
}
