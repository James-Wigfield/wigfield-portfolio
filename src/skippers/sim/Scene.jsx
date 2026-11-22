/* eslint-disable react-hooks/immutability -- R3F: per-frame mutation of refs/three objects inside useFrame is the intended pattern */
import { Suspense, useEffect, useMemo, useRef, Component } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useGLTF, Sky, Line, Html } from '@react-three/drei';
import * as THREE from 'three';
import { BOAT, toWorld } from './physics.js';
import { HOTSPOTS, hotspotLabel } from './hotspots.js';

/* The 3D view. World: three X = east, Y = up, Z = -north (so a world point
   (x east, y north) sits at (x, h, -y)). The boat's local frame (from
   boat.glb): +X starboard, +Y up, -Z bow. Heading psi (clockwise from north)
   → rotation.y = -psi. */

const W3 = (x, y, h = 0) => new THREE.Vector3(x, h, -y);
const EYE = new THREE.Vector3(0, 1.75, 0.6); // helm eye (boat local, three axes)
const EYE_NUDGE = new THREE.Vector3(0, 0.12, 0.25); // a touch up and aft of the seat empty so the console doesn't clip

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: false }; }
  static getDerivedStateFromError() { return { err: true }; }
  componentDidCatch(e) { this.props.onError?.(e); }
  render() { return this.state.err ? this.props.fallback ?? null : this.props.children; }
}

/* ---------- water (in-engine: small Gerstner-ish swell + fresnel) ---------- */
function Water() {
  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uDeep: { value: new THREE.Color('#1f5f73') }, uShallow: { value: new THREE.Color('#4c9fa8') }, uSky: { value: new THREE.Color('#bcd7ea') }, uSun: { value: new THREE.Vector3(0.45, 0.6, -0.65).normalize() }, uFog: { value: new THREE.Color('#cfe0ea') } },
    vertexShader: `
      uniform float uTime; varying vec3 vW; varying vec3 vN;
      vec3 wave(vec2 p, vec2 d, float k, float a, float s, inout vec3 n) {
        float f = k * dot(d, p) - s * uTime; float c = cos(f);
        n.xz -= d * k * a * c; return vec3(0.0, a * sin(f), 0.0);
      }
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0); vec3 n = vec3(0.0, 1.0, 0.0);
        vec3 off = wave(w.xz, normalize(vec2(1.0, 0.4)), 0.55, 0.05, 1.6, n) + wave(w.xz, normalize(vec2(-0.3, 1.0)), 0.9, 0.025, 2.3, n) + wave(w.xz, normalize(vec2(0.7, -0.8)), 1.7, 0.012, 3.1, n);
        w.xyz += off; vW = w.xyz; vN = normalize(n);
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: `
      uniform vec3 uDeep; uniform vec3 uShallow; uniform vec3 uSky; uniform vec3 uSun; uniform vec3 uFog; uniform float uTime;
      varying vec3 vW; varying vec3 vN;
      void main() {
        vec3 V = normalize(cameraPosition - vW);
        vec3 N = normalize(vN + 0.06 * vec3(sin(vW.x * 2.1 + uTime * 1.3) * cos(vW.z * 1.7), 0.0, cos(vW.x * 1.3 - uTime) * sin(vW.z * 2.3)));
        float fr = pow(1.0 - max(dot(N, V), 0.0), 4.0);
        vec3 col = mix(uDeep, uShallow, 0.35 + 0.25 * N.x);
        col = mix(col, uSky, clamp(fr * 0.9, 0.0, 0.85));
        vec3 H = normalize(uSun + V); col += vec3(1.0, 0.95, 0.85) * pow(max(dot(N, H), 0.0), 220.0) * 0.9;
        float d = length(cameraPosition - vW); col = mix(col, uFog, smoothstep(250.0, 1800.0, d));
        gl_FragColor = vec4(col, 1.0);
      }`,
  }), []);
  useFrame((_, dt) => { mat.uniforms.uTime.value += dt; });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} material={mat} renderOrder={-1}>
      <planeGeometry args={[5000, 5000, 220, 220]} />
    </mesh>
  );
}

/* ---------- venue ---------- */
function VenueGLB({ onReady }) {
  const { scene } = useGLTF('/skippers-sim/venue.glb', false, true);
  useEffect(() => { const sb = scene.getObjectByName('seabed'); if (sb) sb.visible = false; onReady?.('venue'); }, [scene, onReady]);
  return <primitive object={scene} />;
}
function Greybox({ layout }) {
  const shapes = useMemo(() => (layout?.colliders ?? []).map((c) => {
    const s = new THREE.Shape(c.poly.map(([x, y]) => new THREE.Vector2(x, y)));
    const h = { jetty: 1.0, rock: 1.6, shore: 0.6, ramp: 0.3, closed_ramp: 1.2, moored: 0.9, pile: 1.2 }[c.kind] ?? 0.5;
    const col = { jetty: '#9a9387', rock: '#c9bfa8', shore: '#e8dcb5', ramp: '#a8a49a', closed_ramp: '#b9b1a0', moored: '#f4f4f0', pile: '#5a4a3a' }[c.kind] ?? '#999';
    return { key: c.name, geo: new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false }), col, base: c.kind === 'moored' ? -0.2 : -0.4 };
  }), [layout]);
  return (
    <group rotation-x={-Math.PI / 2}>
      {shapes.map((s) => <mesh key={s.key} geometry={s.geo} position={[0, 0, s.base]}><meshStandardMaterial color={s.col} roughness={0.9} /></mesh>)}
    </group>
  );
}

/* ---------- boat ---------- */
function BoatGLB({ refs, onReady }) {
  const { scene } = useGLTF('/skippers-sim/boat.glb', false, true);
  const clone = useMemo(() => scene.clone(true), [scene]);
  useEffect(() => {
    const find = (n) => clone.getObjectByName(n);
    refs.current.outboard = find('outboard'); refs.current.wheel = find('wheel'); refs.current.lever = find('lever');
    clone.updateMatrixWorld(true);
    const local = (o) => clone.worldToLocal(o.getWorldPosition(new THREE.Vector3())); // boat frame, wherever the boat is
    const hs = {}; clone.traverse((o) => { if (o.name?.startsWith('hs_')) hs[o.name] = local(o); });
    const seat = find('person_skipper_seat'); if (seat) refs.current.eye = local(seat);
    const me = find('person_skipper'); if (me) me.visible = false;
    refs.current.hs = hs; onReady?.('boat');
    window.__simRefs = refs.current;
  }, [clone, refs, onReady]);
  return <primitive object={clone} />;
}
function BoatBox() {
  return (
    <group>
      <mesh position={[0, 0.35, 0]}><boxGeometry args={[BOAT.B, 0.7, BOAT.L]} /><meshStandardMaterial color="#f3f1ea" /></mesh>
      <mesh position={[0, 0.95, 0.4]}><boxGeometry args={[0.8, 0.6, 0.7]} /><meshStandardMaterial color="#e0ddd2" /></mesh>
      <mesh position={[0, 0.6, 2.9]}><boxGeometry args={[0.5, 1.1, 0.5]} /><meshStandardMaterial color="#222" /></mesh>
    </group>
  );
}

function Wake({ G }) {
  const geo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(240 * 3), 3)); g.setDrawRange(0, 0); return g; }, []);
  const pts = useRef([]); const acc = useRef(0);
  useFrame((_, dt) => {
    const b = G.current.g.boat; acc.current += dt;
    if (acc.current > 0.15) {
      acc.current = 0;
      const sp = Math.hypot(b.u, b.v);
      if (sp > 0.4) { const p = toWorld(b, 0, -2.9); pts.current.push(p); if (pts.current.length > 240) pts.current.shift(); }
      else if (pts.current.length) pts.current.shift();
      const a = geo.attributes.position.array;
      pts.current.forEach((p, i) => { a[i * 3] = p[0]; a[i * 3 + 1] = 0.06; a[i * 3 + 2] = -p[1]; });
      geo.attributes.position.needsUpdate = true; geo.setDrawRange(0, pts.current.length);
    }
  });
  return <line geometry={geo}><lineBasicMaterial color="#ffffff" transparent opacity={0.65} /></line>;
}

function OtherBoat({ G }) {
  const ref = useRef();
  useFrame(() => {
    const tb = G.current.g.traffic[0]; const o = ref.current; if (!o) return;
    o.visible = !!tb && ['t6', 't10'].includes(G.current.g.phase);
    if (tb) { o.position.set(tb.x, 0, -tb.y); o.rotation.y = -tb.psi; }
  });
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 0.35, 0]}><boxGeometry args={[2.1, 0.7, 5.8]} /><meshStandardMaterial color="#f1efe8" /></mesh>
      <mesh position={[0, 1.0, 0.3]}><boxGeometry args={[0.9, 0.7, 0.9]} /><meshStandardMaterial color="#2b4f7a" /></mesh>
    </group>
  );
}

function Mob({ G }) {
  const ref = useRef();
  useFrame((st) => {
    const m = G.current.g.mob; const o = ref.current; if (!o) return;
    o.visible = !!m && !m.retrieved;
    if (m) o.position.set(m.x, Math.sin(st.clock.elapsedTime * 1.7) * 0.05, -m.y);
  });
  return (
    <group ref={ref} visible={false}>
      <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.32, 16, 12]} /><meshStandardMaterial color="#ff6a00" emissive="#ff4a00" emissiveIntensity={0.25} /></mesh>
      <mesh position={[0, 0.42, 0]}><sphereGeometry args={[0.13, 12, 10]} /><meshStandardMaterial color="#e8b48a" /></mesh>
    </group>
  );
}

function Ghost({ G, show }) {
  const pts = G.current.g.ghost;
  if (!show || !pts || pts.length < 2) return null;
  return <Line points={pts.map(([x, y]) => [x, 0.12, -y])} color="#ffd84a" lineWidth={2.5} dashed dashSize={2} gapSize={1.2} />;
}

/* ---------- boat rig + camera + aiming ---------- */
function Rig({ G, ui, refs, onAim, hints }) {
  const group = useRef();
  const { camera } = useThree();
  const tmp = useMemo(() => ({ v: new THREE.Vector3(), q: new THREE.Quaternion(), e: new THREE.Euler(0, 0, 0, 'YXZ'), dir: new THREE.Vector3() }), []);
  const acc = useRef(0); const lastAim = useRef(null);
  useFrame((st, dtRaw) => {
    const game = G.current; const g = game.g; const b = g.boat;
    // fixed 60 Hz steps
    acc.current += Math.min(dtRaw, 0.1);
    let n = 0; while (acc.current >= 1 / 60 && n < 8) { ui.current.beforeTick?.(); game.tick(); acc.current -= 1 / 60; n++; }
    const o = group.current; if (!o) return;
    const t = st.clock.elapsedTime; const sp = Math.hypot(b.u, b.v);
    o.position.set(b.x, Math.sin(t * 1.3) * 0.04 + Math.min(sp, 6) * 0.01, -b.y);
    o.rotation.set(Math.sin(t * 1.1) * 0.012 - Math.min(sp, 8) * 0.006, -b.psi, Math.sin(t * 0.9) * 0.02 - b.r * 0.15, 'YXZ');
    const r = refs.current;
    if (r.outboard) r.outboard.rotation.y = b.wheel * BOAT.legMax;
    if (r.wheel) r.wheel.rotation.z = -b.wheel * 2.6;
    if (r.lever) r.lever.rotation.x = -b.gear * 0.11;
    // camera
    const look = ui.current.look; // { yaw, pitch }
    if (ui.current.view === 'chase') {
      const dist = 13; const yaw = b.psi + look.yaw; // behind the boat by default
      tmp.v.set(b.x - Math.sin(yaw) * dist, Math.max(1.5, 5.2 - look.pitch * 6), -(b.y - Math.cos(yaw) * dist));
      camera.position.lerp(tmp.v, 0.2);
      camera.lookAt(b.x, 0.8, -b.y);
    } else {
      const eye = r.eye ? tmp.v.copy(r.eye).add(EYE_NUDGE) : tmp.v.copy(EYE);
      o.updateMatrixWorld(); eye.applyMatrix4(o.matrixWorld); camera.position.copy(eye);
      tmp.e.set(look.pitch, -b.psi + -look.yaw, 0, 'YXZ'); camera.quaternion.setFromEuler(tmp.e);
    }
    // aiming: nearest hotspot to the view ray
    camera.getWorldDirection(tmp.dir);
    let best = null; let bestA = 0.2;
    for (const id of ui.current.hsActive ?? []) {
      const p = hotspotWorld(g, r, id, o); if (!p) continue;
      const v = p.clone().sub(camera.position); const dd = v.length(); if (dd > 14) continue;
      const a = v.normalize().angleTo(tmp.dir);
      if (a < bestA) { bestA = a; best = id; }
    }
    if (best !== lastAim.current) { lastAim.current = best; onAim(best); }
    ui.current.aim = best;
  });
  return (
    <group ref={group}>
      <Boundary fallback={<BoatBox />} onError={() => {}}>
        <Suspense fallback={<BoatBox />}><BoatGLB refs={refs} onReady={ui.current.onReady} /></Suspense>
      </Boundary>
      {hints && <HotspotTags G={G} refs={refs} ui={ui} />}
    </group>
  );
}

function hotspotWorld(g, r, id, o) {
  if (id === 'hs_jetty_cleat') { const c = nearestCleat(g); return c ? W3(c.x, c.y, 0.9) : null; }
  const loc = r.hs?.[id] ?? HOTSPOTS[id]?.p3;
  if (!loc) return null;
  return loc.clone ? loc.clone().applyMatrix4(o.matrixWorld) : new THREE.Vector3(...loc).applyMatrix4(o.matrixWorld);
}
function nearestCleat(g) {
  const cs = g.W.layout.jetty?.cleats ?? []; const b = g.boat; let best = null; let bd = Infinity;
  for (const c of cs) { const d = Math.hypot(c.x - b.x, c.y - b.y); if (d < bd) { bd = d; best = c; } }
  return best;
}

function HotspotTags({ G, refs, ui }) {
  const ids = ui.current.hsActive ?? [];
  return ids.filter((id) => id !== 'hs_jetty_cleat').map((id) => {
    const loc = refs.current.hs?.[id] ?? (HOTSPOTS[id]?.p3 ? new THREE.Vector3(...HOTSPOTS[id].p3) : null);
    if (!loc) return null;
    return (
      <Html key={id} position={[loc.x, loc.y + 0.15, loc.z]} center zIndexRange={[20, 0]}>
        <button type="button" className={`sim-tag${ui.current.aim === id ? ' sim-tag--on' : ''}`} onClick={() => G.current.cmd({ t: 'hs', id })}>{hotspotLabel(id)}</button>
      </Html>
    );
  });
}

function JettyCleatTag({ G, ui }) {
  const g = G.current.g; const c = nearestCleat(g);
  if (!c || !(ui.current.hsActive ?? []).includes('hs_jetty_cleat')) return null;
  return (
    <Html position={[c.x, 1.1, -c.y]} center>
      <button type="button" className="sim-tag" onClick={() => G.current.cmd({ t: 'hs', id: 'hs_jetty_cleat' })}>Jetty cleat</button>
    </Html>
  );
}

export default function Scene({ G, ui, onAim, hints, ghost, venueOk, setVenueOk, layout, tick }) {
  const refs = useRef({});
  return (
    <Canvas camera={{ fov: 68, near: 0.1, far: 6000, position: [0, 3, 10] }} dpr={[1, 1.75]} gl={{ antialias: true, powerPreference: 'high-performance' }} onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; }}>
      <color attach="background" args={['#cfe0ea']} />
      <fog attach="fog" args={['#cfe0ea', 400, 2400]} />
      <Sky sunPosition={[300, 260, -380]} turbidity={5} rayleigh={1.2} mieCoefficient={0.004} />
      <hemisphereLight args={['#eaf4ff', '#5f6b52', 0.85]} />
      <directionalLight position={[300, 400, -380]} intensity={1.6} />
      <Water />
      {venueOk ? (
        <Boundary fallback={<Greybox layout={layout} />} onError={() => setVenueOk(false)}>
          <Suspense fallback={<Greybox layout={layout} />}><VenueGLB onReady={ui.current.onReady} /></Suspense>
        </Boundary>
      ) : <Greybox layout={layout} />}
      <Rig G={G} ui={ui} refs={refs} onAim={onAim} hints={hints} />
      {hints && <JettyCleatTag G={G} ui={ui} key={tick} />}
      <Wake G={G} />
      <OtherBoat G={G} />
      <Mob G={G} />
      <Ghost G={G} show={ghost} key={`ghost-${tick}`} />
    </Canvas>
  );
}

