import { useEffect, useRef, useState } from 'react';

/* ============================================================================
   DIORAMA PREVIEW — a live three.js render of SAMPLE_SCENE.
   ----------------------------------------------------------------------------
   Plan-page only: a quick three.js block-out of a v1 scene spec, so the page
   can show "scene.json → a room" live. The real pipeline (build-prompt.md)
   builds the room in headless Blender, bakes it and the viewer loads a GLB;
   this file is not that and isn't meant to be reused.
   Coordinates follow the spec: metres, floor y = 0, x west→east, z north→south,
   origin at the room's north-west floor corner. Dollhouse view = only the
   north + west walls are drawn, seen from the south-east.
   ========================================================================== */

const T = 0.1; // wall thickness

export default function DioramaPreview({ scene, label = 'Live render of the sample scene' }) {
  const hostRef = useRef(null);
  const [state, setState] = useState('loading');

  useEffect(() => {
    let cancelled = false;
    let cleanup = () => {};

    (async () => {
      try {
        const [THREE, { OrbitControls }, { RoundedBoxGeometry }] = await Promise.all([
          import('three'),
          import('three/addons/controls/OrbitControls.js'),
          import('three/addons/geometries/RoundedBoxGeometry.js'),
        ]);
        if (cancelled || !hostRef.current) return;
        cleanup = mount(hostRef.current, scene, THREE, OrbitControls, RoundedBoxGeometry);
        setState('ready');
      } catch (err) {
        console.warn('[memory-rooms-plan] preview failed', err);
        if (!cancelled) setState('error');
      }
    })();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [scene]);

  return (
    <div className="mrp-dio" data-state={state}>
      <div ref={hostRef} className="mrp-dio__canvas" role="img" aria-label={label} />
      {state === 'loading' && <span className="mrp-dio__msg">Building the room…</span>}
      {state === 'error' && <span className="mrp-dio__msg">WebGL isn’t available here — the render needs it.</span>}
    </div>
  );
}

function mount(host, spec, THREE, OrbitControls, RoundedBoxGeometry) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const { width: W, depth: D, height: H } = spec.shell;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  host.appendChild(renderer.domElement);

  const scene3 = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
  const target = new THREE.Vector3(W / 2, 0.7, D / 2);

  // ── lights ────────────────────────────────────────────────────────────────
  scene3.add(new THREE.HemisphereLight('#fff4e3', '#5b4a3c', 1.25));
  const sun = new THREE.DirectionalLight('#ffe7c4', 1.9);
  sun.position.set(W + 4, 7, D + 3);
  sun.target.position.copy(target);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -4; sun.shadow.camera.right = 4;
  sun.shadow.camera.top = 4; sun.shadow.camera.bottom = -4;
  sun.shadow.radius = 4;
  sun.shadow.bias = -0.0008;
  scene3.add(sun, sun.target);

  // ── helpers ───────────────────────────────────────────────────────────────
  const mats = new Map();
  const mat = (color, extra = {}) => {
    const key = color + JSON.stringify(extra);
    if (!mats.has(key)) mats.set(key, new THREE.MeshStandardMaterial({ color, roughness: 0.82, metalness: 0, ...extra }));
    return mats.get(key);
  };
  const box = (w, h, d, color, r = 0.02, extra) => {
    const geo = new RoundedBoxGeometry(w, h, d, 2, Math.min(r, w / 2, h / 2, d / 2));
    const m = new THREE.Mesh(geo, mat(color, extra));
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  const at = (obj, x, y, z) => { obj.position.set(x, y, z); return obj; };

  // ── shell: floor + north and west walls with their openings ──────────────
  const room = new THREE.Group();
  const floor = box(W + T, 0.08, D + T, spec.shell.floor.color, 0.015);
  at(floor, W / 2 - T / 2, -0.04, D / 2 - T / 2);
  room.add(floor);
  // floor boards (subtle lines)
  for (let x = 0.18; x < W; x += 0.18) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.002, D), mat('#8e6440'));
    room.add(at(line, x, 0.001, D / 2));
  }

  const wallColor = spec.shell.walls.color;
  const wall = (side) => {
    const len = side === 'north' ? W + T : D;
    const g = new THREE.Group();
    const s = side === 'north' ? 1 : -1; // which local-z side faces into the room
    const holes = spec.shell.openings
      .filter((o) => o.wall === side)
      .map((o) => ({ a: o.offset + (side === 'north' ? T : 0), b: o.offset + o.width + (side === 'north' ? T : 0), lo: o.sill || 0, hi: (o.sill || 0) + o.height, type: o.type }))
      .sort((p, q) => p.a - q.a);
    let u = 0;
    const piece = (u0, u1, v0, v1) => {
      if (u1 - u0 < 0.001 || v1 - v0 < 0.001) return;
      g.add(at(box(u1 - u0, v1 - v0, T, wallColor, 0.01), (u0 + u1) / 2, (v0 + v1) / 2, 0));
    };
    for (const h of holes) {
      piece(u, h.a, 0, H);
      piece(h.a, h.b, 0, h.lo);
      piece(h.a, h.b, h.hi, H);
      if (h.type === 'window') {
        // a pale pane + frame so the opening reads as glass
        const pane = new THREE.Mesh(new THREE.BoxGeometry(h.b - h.a, h.hi - h.lo, 0.01), mat('#cfe3ea', { transparent: true, opacity: 0.45, roughness: 0.1 }));
        g.add(at(pane, (h.a + h.b) / 2, (h.lo + h.hi) / 2, 0));
        g.add(at(box(h.b - h.a + 0.06, 0.04, T + 0.06, '#f4efe6', 0.01), (h.a + h.b) / 2, h.lo, s * 0.02));
      }
      u = h.b;
    }
    piece(u, len, 0, H);
    // skirting
    g.add(at(box(len, 0.08, 0.02, '#d9d0bf', 0.005), len / 2, 0.04, s * (T / 2 + 0.01)));
    return g;
  };
  const north = wall('north');
  north.position.set(-T, 0, -T / 2);
  const west = wall('west');
  west.rotation.y = -Math.PI / 2;
  west.position.set(-T / 2, 0, 0);
  room.add(north, west);

  // ── kit (just enough pieces for the sample) ───────────────────────────────
  const KIT = {
    bed: ([w, h, d], o) => {
      const g = new THREE.Group();
      g.add(at(box(w, h * 0.45, d, '#6e5038'), 0, h * 0.225, 0));
      g.add(at(box(w - 0.04, h * 0.4, d - 0.04, o.color, 0.06), 0, h * 0.65, 0));
      g.add(at(box(w - 0.02, h * 0.18, d * 0.62, o.accent, 0.05), 0, h * 0.86, d * 0.18));
      g.add(at(box(w * 0.36, 0.12, 0.34, '#f6f2ea', 0.05), -w * 0.22, h * 0.9, -d / 2 + 0.25));
      g.add(at(box(w * 0.36, 0.12, 0.34, '#f6f2ea', 0.05), w * 0.22, h * 0.9, -d / 2 + 0.25));
      g.add(at(box(w + 0.04, 0.9, 0.06, '#6e5038'), 0, 0.45, -d / 2 - 0.02));
      return g;
    },
    desk: ([w, h, d], o) => {
      const g = new THREE.Group();
      g.add(at(box(w, 0.04, d, o.color), 0, h - 0.02, 0));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.04, h - 0.04, 0.04, '#3b2c20', 0.01), sx * (w / 2 - 0.05), (h - 0.04) / 2, sz * (d / 2 - 0.05)));
      g.add(at(box(0.36, 0.24, 0.02, '#20242c', 0.01), -0.2, h + 0.16, -d / 2 + 0.12));
      return g;
    },
    chair: ([w, h, d], o) => {
      const g = new THREE.Group();
      g.add(at(box(w, 0.05, d, o.color), 0, 0.45, 0));
      g.add(at(box(w, h - 0.48, 0.04, o.color), 0, 0.47 + (h - 0.48) / 2, d / 2 - 0.02));
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) g.add(at(box(0.03, 0.43, 0.03, '#2a2f38', 0.01), sx * (w / 2 - 0.04), 0.215, sz * (d / 2 - 0.04)));
      return g;
    },
    rug: ([w, , d], o) => at(box(w, 0.012, d, o.color, 0.005), 0, 0.006, 0),
    shelf: ([w, h, d], o) => {
      const g = new THREE.Group();
      g.add(at(box(0.03, h, d, o.color, 0.01), -w / 2, h / 2, 0));
      g.add(at(box(0.03, h, d, o.color, 0.01), w / 2, h / 2, 0));
      const books = ['#b4553e', '#3f5d7a', '#d9b45a', '#5d7a4f', '#7a4f6a'];
      for (let i = 0; i < 5; i++) {
        const y = 0.05 + i * (h - 0.1) / 4;
        g.add(at(box(w, 0.03, d, o.color, 0.01), 0, y, 0));
        if (i < 4) {
          let x = -w / 2 + 0.06;
          for (let k = 0; k < 6 && x < w / 2 - 0.08; k++) {
            const bw = 0.04 + ((i * 7 + k * 3) % 4) * 0.012;
            const bh = 0.2 + ((i + k) % 3) * 0.04;
            g.add(at(box(bw, bh, d * 0.7, books[(i + k) % books.length], 0.006), x + bw / 2, y + 0.015 + bh / 2, 0));
            x += bw + 0.012;
          }
        }
      }
      return g;
    },
    plant: ([w, h], o) => {
      const g = new THREE.Group();
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.32, w * 0.24, h * 0.32, 18), mat(o.accent));
      pot.castShadow = true;
      g.add(at(pot, 0, h * 0.16, 0));
      [[0, 0.62, 0, 0.26], [-0.08, 0.78, 0.04, 0.2], [0.09, 0.84, -0.05, 0.18]].forEach(([x, y, z, r]) => {
        const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(w * r * 2, 0), mat(o.color, { flatShading: true }));
        leaf.castShadow = true;
        g.add(at(leaf, x, h * y, z));
      });
      return g;
    },
    lamp: ([w, h], o) => {
      const g = new THREE.Group();
      g.add(at(box(w * 0.6, 0.03, w * 0.6, '#3a3a3a', 0.01), 0, 0.015, 0));
      g.add(at(box(0.015, h * 0.6, 0.015, '#3a3a3a', 0.005), 0, h * 0.3, 0));
      const shade = new THREE.Mesh(new THREE.CylinderGeometry(w * 0.3, w * 0.5, h * 0.4, 20, 1, true), mat(o.color, { emissive: '#ffcf8a', emissiveIntensity: 0.9, side: THREE.DoubleSide }));
      g.add(at(shade, 0, h * 0.75, 0));
      return g;
    },
    frame: ([w, h, d], o) => {
      const g = new THREE.Group();
      g.add(box(w, h, d, o.color, 0.008));
      // the print faces local +z
      g.add(at(box(w * 0.8, h * 0.8, 0.005, '#efe6d6', 0.002), 0, 0, d / 2 + 0.002));
      g.add(at(new THREE.Mesh(new THREE.CircleGeometry(w * 0.22, 24), mat(o.accent)), 0, h * 0.08, d / 2 + 0.006));
      return g;
    },
  };

  for (const o of spec.objects) {
    const make = KIT[o.kit];
    if (!make) continue;
    const g = make(o.size, o);
    g.position.set(o.at[0], o.at[1], o.at[2]);
    g.rotation.y = THREE.MathUtils.degToRad(o.rotY || 0);
    room.add(g);
  }

  for (const l of spec.lights || []) {
    const p = new THREE.PointLight(l.color, 2.2 * (l.intensity ?? 1), 4.5, 2);
    p.position.set(...l.at);
    room.add(p);
  }

  // memory pin: a small floating marker
  const pins = [];
  for (const pin of spec.pins || []) {
    const g = new THREE.Group();
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.07, 20, 14), mat('#e2643f', { emissive: '#e2643f', emissiveIntensity: 0.35 }));
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), mat('#e2643f'));
    stem.position.y = -0.17;
    g.add(head, stem);
    g.position.set(...pin.at);
    g.userData.baseY = pin.at[1] + 0.25;
    room.add(g);
    pins.push(g);
  }

  scene3.add(room);

  // soft ground shadow catcher below the room
  const catcher = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShadowMaterial({ opacity: 0.18 }));
  catcher.rotation.x = -Math.PI / 2;
  catcher.position.set(W / 2, -0.081, D / 2);
  catcher.receiveShadow = true;
  scene3.add(catcher);

  // ── camera + controls ────────────────────────────────────────────────────
  const R = 9.2;
  const POLAR = THREE.MathUtils.degToRad(57);
  const place = (az) => {
    camera.position.set(
      target.x + R * Math.sin(POLAR) * Math.sin(az),
      target.y + R * Math.cos(POLAR),
      target.z + R * Math.sin(POLAR) * Math.cos(az),
    );
    camera.lookAt(target);
  };
  const AZ0 = THREE.MathUtils.degToRad(42);
  place(AZ0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.copy(target);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 5;
  controls.maxDistance = 13;
  controls.minPolarAngle = THREE.MathUtils.degToRad(25);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(78);
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(5);
  controls.maxAzimuthAngle = THREE.MathUtils.degToRad(85);
  let touched = false;
  controls.addEventListener('start', () => { touched = true; });

  // ── size + loop ──────────────────────────────────────────────────────────
  const resize = () => {
    const w = host.clientWidth || 1;
    const h = host.clientHeight || 1;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(host);
  resize();

  let raf = 0;
  const t0 = performance.now();
  const tick = (now) => {
    const t = (now - t0) / 1000;
    if (!reduce && !touched) place(AZ0 + Math.sin(t * 0.22) * 0.32);
    if (!reduce) pins.forEach((p, i) => { p.position.y = p.userData.baseY + Math.sin(t * 1.6 + i) * 0.04; });
    else pins.forEach((p) => { p.position.y = p.userData.baseY; });
    controls.update();
    renderer.render(scene3, camera);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    scene3.traverse((obj) => { if (obj.geometry) obj.geometry.dispose(); });
    mats.forEach((m) => m.dispose());
    catcher.material.dispose();
    renderer.dispose();
    renderer.domElement.remove();
  };
}
