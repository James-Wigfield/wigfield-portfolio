import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import { AgentModel } from "./agent";
import { DeskModel } from "./models";
import { DottedLine } from "./dotted-line";
import { GroundShadow, Lights } from "./scene";
import { UI3D } from "./palette";
import { PixelArtRenderer, reportZoomFraction } from "./pixel-art";

/* ── Integrations demo (#integrations, landing page) ─────────────────────
   The "plugs into any platform" vignette: one portlet typing at its desk
   straight on the page background, ringed by six well-known platform
   cards. On arrival a dotted line snakes across the floor to each card in
   turn - every route hand-jittered so no two lays are alike - and once
   the ring is wired up, little green messages fire down random lines
   forever. View-only, no data, pointer-inert.

   3D animates through refs (zero re-renders); the DOM only re-renders as
   each card's line lands (7 setStates total, then never again). */

const BRANDS = [
  { name: "Shopify", src: "/portara-test/integrations/shopify.svg" },
  { name: "Google", src: "/portara-test/integrations/google.png" },
  { name: "Xero", src: "/portara-test/integrations/xero.svg" },
  { name: "Stripe", src: "/portara-test/integrations/stripe.svg" },
  { name: "HubSpot", src: "/portara-test/integrations/hubspot.svg" },
  { name: "PayPal", src: "/portara-test/integrations/paypal.svg" },
] as const;

/** The ring of cards: a perfect circle around the desk. Angles start 30°
    off the camera axis so no card ever sits dead in front of (or behind)
    the agent on screen. */
const RING_RADIUS = 2.3;
const CARD_Y = 0.5;
const CAM_AZ = Math.PI / 4;
const cardAngle = (i: number) => CAM_AZ + Math.PI / 6 + (i * Math.PI) / 3;

/** Per-line lay personality: lateral swing of the two mid waypoints
    (radians) and their radii (fractions of the ring radius). Every cable
    runs radially out to its own card, so these wiggles are deliberately
    small - each stays inside its own 60° sector, which makes crossings
    geometrically impossible while still giving every lay its own gentle
    S-bend. */
const LAY = [
  { j1: 0.16, j2: -0.12, r1: 0.5, r2: 0.74 },
  { j1: -0.14, j2: 0.17, r1: 0.55, r2: 0.8 },
  { j1: 0.1, j2: 0.15, r1: 0.45, r2: 0.68 },
  { j1: -0.18, j2: -0.08, r1: 0.52, r2: 0.78 },
  { j1: 0.15, j2: -0.17, r1: 0.48, r2: 0.7 },
  { j1: -0.1, j2: 0.13, r1: 0.56, r2: 0.82 },
] as const;

/** Line i fires at CONNECT_START + i * CONNECT_EVERY, landing LAND_TIME
    later. After the last lands, the message pulses start. */
const CONNECT_START = 0.35;
const CONNECT_EVERY = 0.28;
const LAND_TIME = 0.55;
const landAt = (i: number) => CONNECT_START + i * CONNECT_EVERY + LAND_TIME;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const easeOutQuart = (u: number) => 1 - (1 - u) ** 4;

/** The desk faces the camera dead-on, agent looking out over the monitor. */
const DESK_YAW = -Math.PI * 0.75;
const FLOOR_Y = 0.05;
const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

const polar = (a: number, r: number, y: number) =>
  new THREE.Vector3(Math.sin(a) * r, y, Math.cos(a) * r);

/** Isometric camera on a slow, gradual lap around the desk (~1 min per
    turn). The ring of cards is rotation-symmetric, so the framing holds at
    every angle. No controls - the pointer is dead here by design. */
function OrbitCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  const azimuth = useRef(CAM_AZ);
  useEffect(() => {
    // Fit the card ring plus the DOM cards' overhang, at any spin angle.
    camera.zoom = Math.min(size.width / 6.6, size.height / 4.4);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  useFrame((_, dt) => {
    azimuth.current += dt * 0.1;
    const az = azimuth.current;
    const dist = 40;
    const target = new THREE.Vector3(0, 0.5, 0);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(ISO_ELEVATION) * dist,
      target.y + Math.sin(ISO_ELEVATION) * dist,
      target.z + Math.cos(az) * Math.cos(ISO_ELEVATION) * dist,
    );
    camera.lookAt(target);
    // Pin the shared pixel pass at its finest for this close-up (see the
    // security demo for the why).
    reportZoomFraction(0);
  });
  return null;
}

/** Green message packets that fire down random lines, forever. Each of the
    few concurrent packets runs its line end-to-end, flares out at the
    card, then respawns on a random line after a small pause. */
function Messages({
  curves,
  active,
}: {
  curves: THREE.CatmullRomCurve3[];
  active: React.MutableRefObject<boolean>;
}) {
  const COUNT = 3;
  const refs = useRef<(THREE.Mesh | null)[]>([]);
  // Stagger the first sends so they don't fire as a volley.
  const pool = useRef(
    Array.from({ length: COUNT }, (_, i) => ({
      line: i * 2,
      u: -0.35 * i,
    })),
  );
  useFrame(({ clock }, dt) => {
    const on = active.current;
    pool.current.forEach((p, i) => {
      const m = refs.current[i];
      if (!m) return;
      if (!on) {
        m.visible = false;
        return;
      }
      p.u += dt * 0.6;
      if (p.u > 1.12) {
        // Arrived (plus a beat) - fire the next message somewhere else.
        p.line = Math.floor(Math.random() * curves.length);
        p.u = -0.2 - Math.random() * 0.5;
      }
      const visible = p.u >= 0;
      m.visible = visible;
      if (!visible) return;
      m.position.copy(curves[p.line].getPointAt(clamp01(p.u)));
      // Cruise with a shimmer, then flare and fade as it hits the card.
      const arrive = clamp01((p.u - 1) / 0.12);
      const s = (1 + Math.sin(clock.elapsedTime * 7 + i) * 0.15) * (1 + arrive * 1.6);
      m.scale.setScalar(s * (1 - arrive * 0.85));
    });
  });
  return (
    <>
      {Array.from({ length: COUNT }, (_, i) => (
        <mesh
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          visible={false}
        >
          <sphereGeometry args={[0.062, 8, 6]} />
          <meshStandardMaterial
            color={UI3D.valid}
            emissive={UI3D.valid}
            emissiveIntensity={1.4}
            toneMapped={false}
          />
        </mesh>
      ))}
    </>
  );
}

/** A platform card on the ring - DOM (crisp logos over the pixel-art
    canvas): logo, platform name, and a green tick once its line lands. */
function BrandNode({
  at,
  src,
  name,
  on,
}: {
  at: THREE.Vector3;
  src: string;
  name: string;
  on: boolean;
}) {
  return (
    <Html position={at.toArray()} center zIndexRange={[30, 0]}>
      <div className={"sec-demo__node" + (on ? " is-on" : "")} data-state={on ? "ok" : "waiting"}>
        <img src={src} alt="" draggable={false} />
        <span className="sec-demo__node-copy">
          <span className="sec-demo__name">{name}</span>
          <span className="sec-demo__tag">{on ? "● Connected" : "waiting…"}</span>
        </span>
      </div>
    </Html>
  );
}

function IntegrationsScene() {
  // How many lines have landed (0..6) - the only DOM-facing state.
  const [landed, setLanded] = useState(0);
  const landedRef = useRef(0);

  // One clean radial route per brand: each cable emerges from under the
  // desk on its card's side and runs straight out along the floor with a
  // gentle, per-line S-bend (LAY) - spokes of a wheel, never crossing.
  const { curves, cardPos, counts } = useMemo(() => {
    const curves = BRANDS.map((_, i) => {
      const theta = cardAngle(i);
      const lay = LAY[i];
      return new THREE.CatmullRomCurve3(
        [
          // …from under the desk's edge…
          polar(theta, 0.42, FLOOR_Y),
          polar(theta + lay.j1, RING_RADIUS * lay.r1, FLOOR_Y),
          polar(theta + lay.j2, RING_RADIUS * lay.r2, FLOOR_Y),
          polar(theta, RING_RADIUS - 0.12, FLOOR_Y),
          // …and a short hop up into the card
          polar(theta, RING_RADIUS, CARD_Y - 0.1),
          polar(theta, RING_RADIUS, CARD_Y),
        ],
        false,
        "catmullrom",
        0.45,
      );
    });
    const cardPos = BRANDS.map((_, i) => polar(cardAngle(i), RING_RADIUS, CARD_Y));
    // Uniform dot density regardless of how far each route snakes.
    const counts = curves.map((c) => Math.round(c.getLength() * 8.5));
    return { curves, cardPos, counts };
  }, []);

  // Per-frame animation state, all refs - zero re-renders.
  const progress = useRef(BRANDS.map(() => 0));
  const progressRefs = useMemo(
    () =>
      BRANDS.map((_, i) => ({
        get current() {
          return progress.current[i];
        },
        set current(v: number) {
          progress.current[i] = v;
        },
      })),
    [],
  );
  const messagesOn = useRef(false);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    for (let i = 0; i < BRANDS.length; i++) {
      const t0 = CONNECT_START + i * CONNECT_EVERY;
      progress.current[i] = easeOutQuart(clamp01((t - t0) / LAND_TIME));
    }
    messagesOn.current = t > landAt(BRANDS.length - 1) + 0.3;

    // DOM: pop each card as its line lands.
    let n = 0;
    while (n < BRANDS.length && t >= landAt(n)) n++;
    if (n !== landedRef.current) {
      landedRef.current = n;
      setLanded(n);
    }
  });

  return (
    <>
      <OrbitCamera />
      <PixelArtRenderer />
      <Lights />
      {/* No floor slab: the desk sits straight on the page, grounded only
          by its drop shadow. */}
      <GroundShadow center={[0, 0]} y={-0.02} />

      <group rotation={[0, DESK_YAW, 0]}>
        <DeskModel occupied screenOn />
        {/* seated in the chair (tile-front offset), facing the monitor */}
        <group position={[0, 0, 0.18]}>
          <AgentModel
            sprite="otto"
            workerId="landing-integrations-demo"
            status="working"
            pose="sit"
            yaw={Math.PI}
          />
        </group>
      </group>

      {curves.map((curve, i) => (
        <DottedLine
          key={BRANDS[i].name}
          curve={curve}
          progress={progressRefs[i]}
          count={counts[i]}
        />
      ))}
      <Messages curves={curves} active={messagesOn} />

      {cardPos.map((at, i) => (
        <BrandNode
          key={BRANDS[i].name}
          at={at}
          src={BRANDS[i].src}
          name={BRANDS[i].name}
          on={landed > i}
        />
      ))}
    </>
  );
}

/** Default export so the home route can lazy-load the whole three.js chunk. */
export default function IntegrationsDemo() {
  return (
    <div
      className="sec-demo"
      aria-label="A portlet at its desk wired to six platforms - Shopify, Google, Xero, Stripe, Klaviyo and PayPal - with messages flowing out to them"
    >
      <Canvas
        orthographic
        shadows="basic"
        dpr={1}
        gl={{ antialias: false, alpha: true }}
        camera={{ zoom: 120, position: [20, 20, 20], near: -100, far: 400 }}
        style={{ touchAction: "none" }}
      >
        <IntegrationsScene />
      </Canvas>
    </div>
  );
}
