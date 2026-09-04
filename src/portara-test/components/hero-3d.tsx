/**
 * The 3D hero - the "3D" side of the toggle at the top of the page.
 *
 * The gate mark as a solid object (temp/portara-hero.glb, built in Claude
 * Design: the gate plus the wordmark's three words as rings of extruded
 * letters - the letters themselves rebuilt here from the Jost font, since the
 * export's traced outlines were faceted), standing on the page's own ground
 * and CASTING SHADOWS onto it:
 * the gate's, and every orbiting letter's, from one key light high to the
 * front-left. The three rings orbit at their own radii, heights and speeds,
 * and SCROLLING SPINS THEM UP: every scroll event adds to a boost that decays
 * over a few frames, so scrolling down the page sends the words whipping
 * round the gate and they settle back to their drift. As each letter crosses
 * the front of its orbit it takes the accent, the 3D cousin of the 2D mark's
 * orbiting hairline. The camera stands a little above the gate so the floor
 * and the orbits read, and drifts a hand's width with the pointer.
 *
 * Unlike the 2D hero there is no pinned jump here: the page simply scrolls
 * on to the demo portal below, which is in place from the start.
 *
 * Legibility of a near-black object on a light ground: the gate carries a
 * slight sheen (lower roughness, a little metalness), a warm key and a cool
 * fill from opposite sides so adjacent faces differ, an accent rim from
 * behind, and every hard edge is drawn as a fine line one step lighter than
 * the fill - so the corners are always there.
 *
 * ENTRANCE: the gate rises out of the ground, then the rings spin in one
 * after another. Reduced motion: nothing moves; the rings hold still.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import gsap from "gsap";

import Magnet from "../bits/Magnet";
import { Link } from "../shim/router";
import { PortalFrame } from "./hero-scene";

const MODEL = "/portara-test/portara-hero.glb";
/* The rings' letters are rebuilt from the Jost SemiBold font (true curves);
   the GLB's traced letters only lend their placement, size and depth. The
   subset is made by tools/subset-jost.mjs. */
const FONT = "/portara-test/fonts/jost-600.typeface.json";
const WORDS: Record<string, string> = { portals: "PORTALS", mcp: "MCP", agents: "AGENTS" };
const SCENE_MEDIA = "(min-width: 861px)";
const REDUCE = "(prefers-reduced-motion: reduce)";

/* From the handoff: ring names and rest speeds (rad/s). */
const RINGS = [
  { name: "ring-portals", speed: 0.22 },
  { name: "ring-mcp", speed: -0.17 },
  { name: "ring-agents", speed: 0.13 },
];
/* The camera stands to the right and a little above: high enough to see the
   floor the shadows fall on and the circles the words travel, low enough that
   the gate still stands over you. */
const VIEW_DIR = new THREE.Vector3(0.62, 0.5, 1).normalize();
const PERCH = { wide: { tx: -1.55, ty: 0.75, tz: 0, dist: 8.8 }, narrow: { tx: 0, ty: 0.8, tz: 0, dist: 9.4 } };

const INK = new THREE.Color("#0c131b");
const GATE = new THREE.Color("#141c26");
const EDGE = new THREE.Color("#5c6773");
const ACCENT = new THREE.Color("#ff4e2b");

type CamState = { tx: number; ty: number; tz: number; dist: number };

/** The camera: on its perch, drifting with the pointer, looking at the target. */
function Rig({ cam, parallax }: { cam: CamState; parallax: boolean }) {
  const { camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const target = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(NaN, NaN, NaN), []);

  useEffect(() => {
    if (!parallax) return;
    const onMove = (e: MouseEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, [parallax]);

  useFrame((_, dt) => {
    target.set(cam.tx, cam.ty, cam.tz);
    want.copy(VIEW_DIR).multiplyScalar(cam.dist).add(target);
    want.x += pointer.current.x * 0.35;
    want.y -= pointer.current.y * 0.2;
    if (Number.isNaN(eye.x)) eye.copy(want);
    else eye.lerp(want, 1 - Math.pow(0.002, Math.min(dt, 0.1)));
    camera.position.copy(eye);
    camera.lookAt(target);
  });
  return null;
}

/** The gate and its rings; the rings spin, boosted by scroll. */
function Model({
  boost,
  entrance,
  spin,
  onReady,
}: {
  boost: React.MutableRefObject<number>;
  entrance: boolean;
  spin: boolean;
  onReady?: () => void;
}) {
  const { scene } = useGLTF(MODEL);
  const gate = useMemo(() => scene.getObjectByName("gate"), [scene]);
  const rings = useMemo(() => RINGS.map((r) => scene.getObjectByName(r.name)), [scene]);

  // Materials: one per letter (so each can take the accent as it passes the
  // front), a sheen and drawn edges on the gate, shadows from everything.
  const glyphs = useMemo(() => {
    const list: THREE.Mesh[] = [];
    rings.forEach((r) =>
      r?.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh) {
          const mat = (m.material as THREE.MeshStandardMaterial).clone();
          mat.color.copy(INK);
          mat.roughness = 0.5;
          mat.metalness = 0.05;
          m.material = mat;
          m.castShadow = true;
          list.push(m);
        }
      }),
    );
    return list;
  }, [rings]);

  useMemo(() => {
    if (!gate) return;
    const edgeMat = new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.9 });
    gate.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      const mat = (m.material as THREE.MeshStandardMaterial).clone();
      mat.color.copy(GATE);
      mat.roughness = 0.42;
      mat.metalness = 0.12;
      m.material = mat;
      m.castShadow = true;
      m.receiveShadow = true;
      if (!m.getObjectByName("edges")) {
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 20), edgeMat);
        lines.name = "edges";
        m.add(lines);
      }
    });
  }, [gate]);

  // The letters, rebuilt from the font. Each traced glyph in the GLB is
  // replaced in place: same node, same placement, same cap height (0.156m,
  // read off the "P"), same depth and baseline - true curves instead of a
  // handful of straight segments.
  const font = useLoader(FontLoader, FONT) as Font;
  useMemo(() => {
    if (!font) return;
    const data = font.data as { capHeight?: number; resolution: number };
    const capUnits = (data.capHeight ?? 700) / data.resolution;
    let size = 0;
    for (const m of glyphs) {
      const match = /^(portals|mcp|agents)-(\d+)$/.exec(m.name);
      const ch = match ? WORDS[match[1]]?.[Number(match[2]) - 1] : undefined;
      if (!ch) continue;
      const old = m.geometry;
      old.computeBoundingBox();
      const ob = old.boundingBox!;
      // One size for every letter, from the flat-topped P; letters with
      // overshoot keep the font's own proportions.
      if (!size) size = (ch === "P" ? ob.max.y - ob.min.y : 0.156) / capUnits;
      const depth = ob.max.z - ob.min.z || 0.03;
      const geo = new TextGeometry(ch, { font, size, depth, curveSegments: 14, bevelEnabled: false });
      geo.computeBoundingBox();
      const nb = geo.boundingBox!;
      geo.translate((ob.min.x + ob.max.x) / 2 - (nb.min.x + nb.max.x) / 2, 0, ob.min.z - nb.min.z);
      m.geometry = geo;
      old.dispose();
    }
  }, [font, glyphs]);

  const tmp = useMemo(() => new THREE.Vector3(), []);

  // Entrance: the gate rises out of the ground; the rings spin in after it.
  useLayoutEffect(() => {
    if (!entrance) {
      onReady?.();
      return;
    }
    const tl = gsap.timeline({ onComplete: () => onReady?.() });
    if (gate) tl.fromTo(gate.position, { y: -2.6 }, { y: 0, duration: 1.3, ease: "power3.out" }, 0);
    rings.forEach((r, i) => {
      if (!r) return;
      const at = 0.3 + i * 0.16;
      tl.fromTo(r.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1.0, ease: "back.out(1.3)" }, at);
      tl.fromTo(r.rotation, { y: r.rotation.y - Math.PI * 0.9 }, { y: r.rotation.y, duration: 1.3, ease: "power3.out" }, at);
    });
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gate, rings, entrance]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    // Boost from scrolling decays over a few frames (handoff: 0.15^dt).
    boost.current *= Math.pow(0.15, step);
    if (spin) {
      const k = 1 + boost.current;
      rings.forEach((r, i) => {
        if (r) r.rotation.y += RINGS[i].speed * k * step;
      });
    }
    // Letters take the accent as they cross the front of their orbit.
    // Emissive rather than diffuse, so it reads as the true orange whatever
    // the light is doing to a near-black surface.
    for (const m of glyphs) {
      m.getWorldPosition(tmp);
      const front = THREE.MathUtils.clamp((tmp.z - 0.55) / 1.25, 0, 1);
      (m.material as THREE.MeshStandardMaterial).emissive.copy(ACCENT).multiplyScalar(front * front);
    }
  });

  return <primitive object={scene} />;
}

/** The page's ground, receiving the shadows and otherwise invisible. */
function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.0015} receiveShadow>
      <planeGeometry args={[40, 40]} />
      <shadowMaterial transparent opacity={0.3} color="#0c131b" />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#c9d0d6", 0.7]} />
      {/* The key, high to the front-left: it lights the faces the camera
          sees and throws the shadows onto the floor. */}
      <directionalLight
        position={[-3.5, 8, 6.5]}
        intensity={1.9}
        color="#fff7ef"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={30}
        shadow-camera-left={-4.5}
        shadow-camera-right={4.5}
        shadow-camera-top={4.5}
        shadow-camera-bottom={-4.5}
      />
      {/* A cool fill from the right, so the faces the key misses are a
          different dark rather than the same one. */}
      <directionalLight position={[6, 3, 2]} intensity={0.55} color="#dbe6ff" />
      {/* The rim: the accent from behind-right, a thread of orange along the
          silhouette. */}
      <directionalLight position={[6, 2.4, -6]} intensity={1.4} color="#ff4e2b" />
    </>
  );
}

export function Hero3D() {
  const canvasWrap = useRef<HTMLDivElement>(null);
  const boost = useRef(0);
  const [settled, setSettled] = useState(false);
  const [active, setActive] = useState(true);
  const desktop = typeof window !== "undefined" && window.matchMedia(SCENE_MEDIA).matches;
  const reduce = typeof window !== "undefined" && window.matchMedia(REDUCE).matches;
  const cam = useMemo<CamState>(() => ({ ...(desktop ? PERCH.wide : PERCH.narrow) }), [desktop]);

  // Scroll spins the rings up (handoff: boost += |dy|/dt * 2.2, capped at 10).
  useEffect(() => {
    if (reduce) return;
    let lastY = window.scrollY;
    let lastT = performance.now();
    const onScroll = () => {
      const now = performance.now();
      const dt = Math.max(1, now - lastT);
      boost.current = Math.min(10, boost.current + (Math.abs(window.scrollY - lastY) / dt) * 2.2);
      lastY = window.scrollY;
      lastT = now;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduce]);

  // Only render frames while the hero is on screen.
  useEffect(() => {
    const el = canvasWrap.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => setActive(entries.some((e) => e.isIntersecting)));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section className="scene scene--3d" aria-label="Portara">
      <div className={"scene__hero" + (settled ? " is-settled" : "")}>
        {/* The gate, solid, and the words in orbit. */}
        <div className="hero3d" ref={canvasWrap} aria-hidden="true">
          <Canvas
            shadows="soft"
            // Full device resolution (capped at 2x): the extruded letters
            // are the finest thing on the page and looked soft at 1.75x.
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 28, near: 0.05, far: 80, position: [4.2, 4.1, 6.8] }}
            frameloop={active ? "always" : "never"}
          >
            <Suspense fallback={null}>
              <Lights />
              <Floor />
              <Model boost={boost} entrance={!reduce} spin={!reduce} onReady={() => setSettled(true)} />
            </Suspense>
            <Rig cam={cam} parallax={!reduce} />
          </Canvas>
        </div>

        <div className="container scene__grid">
          <div className="scene__copy">
            <span className="eyebrow">Custom staff portals · Perth</span>
            <h1 className="scene__title">
              Put your business on <span className="hl-sand">autopilot</span>.
            </h1>
            <p className="scene__lead">
              One portal, built for your business. Powered by Portlets, agents
              that do the work when you ask. Just talk. It runs.
            </p>
            <div className="scene__actions">
              <Magnet padding={48} magnetStrength={9} wrapperClassName="magnet">
                <a href="#request" className="btn btn--lg">
                  Request a meeting
                </a>
              </Magnet>
              <Magnet padding={48} magnetStrength={9} wrapperClassName="magnet">
                <Link to="/login" className="btn btn--ghost btn--lg">
                  Client log in
                </Link>
              </Magnet>
            </div>
            <ul className="scene__facts minilabel">
              <li>Fixed pricing</li>
              <li>No lock-in</li>
              <li>Built in Perth</li>
            </ul>
          </div>
          {/* The right column is the gate's; the canvas draws it there. */}
          <div className="scene__stage scene__stage--3d" />
        </div>

        <div className="scene__cue-slot">
          <div className="scene__cue" aria-hidden="true">
            <span>Scroll</span>
            <i />
          </div>
        </div>
      </div>

      {/* No jump in this version: the portal simply follows. */}
      <PortalFrame showTour />
    </section>
  );
}

useGLTF.preload(MODEL);
useLoader.preload(FontLoader, FONT);

export default Hero3D;
