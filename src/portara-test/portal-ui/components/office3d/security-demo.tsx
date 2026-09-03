import { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";

import { AgentModel } from "./agent";
import { DeskModel } from "./models";
import { DottedLine } from "./dotted-line";
import { GroundShadow, Lights } from "./scene";
import { PixelArtRenderer, reportZoomFraction } from "./pixel-art";

/* ── Security demo (#security, landing page) ─────────────────────────────
   A single-agent diorama for the roles-and-permissions section: one portlet
   typing at a desk straight on the page background (no floor slab - just
   the drop-shadow catcher), narrating its run in a tiny tool-call log
   pinned above its head. Two dotted lines trace across the ground in sync
   with the log: the Shopify one lands and carries a green pulse; the Xero
   one is cut dead short of its card, the severed tip throbbing red.
   View-only, no data, pointer-inert.

   Everything runs off one fixed timeline looping every CYCLE seconds. The
   3D side animates through refs (zero re-renders); the DOM side (log lines,
   chip tags) re-renders only when a stage boundary is crossed. */

const CYCLE = 10.5;

/** The cycle's chapter markers, in seconds. Order matters - STAGES below. */
const T = {
  chipsIn: 0.25, // logo chips fade in as targets
  log1: 0.6, // ▸ shipbob call
  log2: 1.35, // ✓ shipbob done
  log3: 2.0, // ▸ shopify call - its dotted line fires with it
  linkA: 2.45, // …and clicks in: "Connected"
  log4: 2.75, // ✓ shopify done
  log5: 3.6, // ▸ xero call - its dotted line fires with it
  deny: 4.05, // …and slams into the permission block
  log6: 4.3, // ✕ denied
  reset: 9.7, // lines retract, log clears, loop
} as const;

/** Stage boundaries, in playback order. The DOM state is just "how many of
    these has t passed", so one integer drives log lines and chip tags. */
const STAGES = [
  T.chipsIn,
  T.log1,
  T.log2,
  T.log3,
  T.linkA,
  T.log4,
  T.log5,
  T.deny,
  T.log6,
] as const;

/** The agent's run, as it narrates it. Six short lines, terminal-flavoured. */
const LOG_LINES = [
  { kind: "call", text: "▸ shipbob · create_shipment()" },
  { kind: "ok", text: "✓ 12 orders shipped" },
  { kind: "call", text: "▸ shopify · sync_stock()" },
  { kind: "ok", text: "✓ connected · stock synced" },
  { kind: "call", text: "▸ xero · create_invoice()" },
  { kind: "err", text: "✕ denied · no xero access" },
] as const;

/** How many log lines are visible at a given stage (log lines interleave
    with the two chip events in STAGES). */
const logCount = (stage: number) =>
  stage >= 9 ? 6 : stage >= 7 ? 5 : stage >= 6 ? 4 : stage >= 4 ? 3 : stage >= 3 ? 2 : stage >= 2 ? 1 : 0;

/** Where along its curve the Xero line is cut dead (fraction) - well short
    of the card, so the gap itself tells the story. */
const CUT_AT = 0.45;

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Fast-out easing - the "shoot" of a line firing. */
const easeOutQuart = (u: number) => 1 - (1 - u) ** 4;
const easeInOut = (u: number) => u * u * (3 - 2 * u);

/** The desk faces the camera dead-on: the agent looks out at you over the
    monitor's back, and the two dotted lines fan out symmetrically across
    the floor in front - one to each platform card. */
const DESK_YAW = -Math.PI * 0.75;

/** Screen axes in world space at the fixed π/4 camera. */
const SCREEN_RIGHT = new THREE.Vector3(1, 0, -1).normalize();
const TOWARD_CAM = new THREE.Vector3(1, 0, 1).normalize();

/** Dotted-line height when lying on the ground. */
const FLOOR_Y = 0.05;

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

/** Fixed isometric camera, framed on the desk with headroom for the log
    card at its tallest. No controls - the pointer is dead here by design. */
function StaticCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const az = Math.PI / 4;
    const dist = 40;
    const target = new THREE.Vector3(0, 0.8, 0);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(ISO_ELEVATION) * dist,
      target.y + Math.sin(ISO_ELEVATION) * dist,
      target.z + Math.cos(az) * Math.cos(ISO_ELEVATION) * dist,
    );
    camera.lookAt(target);
    // Frame ~5.6 world units of desk, lines and chips across the width.
    camera.zoom = Math.min(size.width / 5.6, size.height / 3.8);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  // The shared pixel pass reads a module-level zoom fraction each canvas
  // tick; pin ours so this scene's pixel size doesn't ride the other
  // canvas's zoom. 0 = the finest art pixels - this close-up has far less
  // geometry per pixel than a whole office.
  useFrame(() => reportZoomFraction(0));
  return null;
}

/** A platform card at a line's destination - DOM (crisp SVG logos over the
    pixel-art canvas): logo, platform name, and a status line that flips
    from "waiting" once its dotted line resolves. */
function LogoNode({
  at,
  src,
  name,
  state,
}: {
  at: THREE.Vector3;
  src: string;
  name: string;
  /** "off" (not shown) | "waiting" | "ok" | "denied" */
  state: "off" | "waiting" | "ok" | "denied";
}) {
  return (
    <Html position={at.toArray()} center zIndexRange={[30, 0]}>
      <div
        className={"sec-demo__node" + (state !== "off" ? " is-on" : "")}
        data-state={state}
      >
        <img src={src} alt="" draggable={false} />
        <span className="sec-demo__node-copy">
          <span className="sec-demo__name">{name}</span>
          <span className="sec-demo__tag">
            {state === "ok" ? "● Connected" : state === "denied" ? "✕ No access" : "waiting…"}
          </span>
        </span>
      </div>
    </Html>
  );
}

/** The agent's pinned card: its normal HUD header plus a minimal tool-call
    log that narrates the run, one line per stage. */
function LogCard({ at, lines }: { at: THREE.Vector3; lines: number }) {
  return (
    <Html position={at.toArray()} zIndexRange={[30, 0]}>
      <div className="px-office__hud">
        <div className="px-office__card sec-demo__card" data-status="working">
          <div className="px-office__card-head">
            <span className="px-office__card-dot" aria-hidden="true" />
            <span className="px-office__card-name">Piper</span>
            <span className="px-office__card-status">Working</span>
          </div>
          <div className="px-office__card-task">Marketing portlet</div>
          <div className="sec-demo__log">
            {LOG_LINES.slice(0, lines).map((l) => (
              <div key={l.text} className="sec-demo__log-line" data-kind={l.kind}>
                {l.text}
              </div>
            ))}
            <div className="sec-demo__log-cursor" aria-hidden="true" />
          </div>
        </div>
      </div>
    </Html>
  );
}

function SecurityScene() {
  const [stage, setStage] = useState(0);
  const stageRef = useRef(0);

  // Both dotted lines leave the back of the monitor (which faces the
  // viewer), drop to the ground in front of the desk and fan out
  // symmetrically - Shopify to screen-right, Xero to screen-left. All in
  // world space; the desk group is rotated DESK_YAW.
  const { shopifyCurve, xeroCurve, shopifyEnd, xeroEnd, hudPos } =
    useMemo(() => {
      const rot = (v: THREE.Vector3) =>
        v.applyAxisAngle(new THREE.Vector3(0, 1, 0), DESK_YAW);
      // Low and well forward, so the cards sit down at floor level in
      // front of the desk rather than crowding it.
      const mkEnd = (side: -1 | 1) =>
        SCREEN_RIGHT.clone()
          .multiplyScalar(side * 1.7)
          .setY(0.22)
          .addScaledVector(TOWARD_CAM, 1.4);
      const shopifyEnd = mkEnd(1);
      const xeroEnd = mkEnd(-1);
      // Exit the monitor's back, drop to the floor, trace along it out to
      // the side, then hop up into the chip.
      const mk = (localStart: THREE.Vector3, end: THREE.Vector3, side: -1 | 1) => {
        const start = rot(localStart);
        const floorAt = (r: number, cam: number) =>
          SCREEN_RIGHT.clone()
            .multiplyScalar(side * r)
            .setY(FLOOR_Y)
            .addScaledVector(TOWARD_CAM, cam);
        return new THREE.CatmullRomCurve3(
          [
            start,
            // straight down off the front of the desk…
            start.clone().setY(FLOOR_Y + 0.02).addScaledVector(TOWARD_CAM, 0.2),
            // …then flat along the ground, curving out to the side
            floorAt(0.75, 0.85),
            floorAt(1.3, 1.25),
            // …and a short hop up into the chip
            end.clone().add(new THREE.Vector3(0, -0.12, 0)),
            end,
          ],
          false,
          "catmullrom",
          0.45,
        );
      };
      const shopifyCurve = mk(new THREE.Vector3(-0.09, 0.6, -0.42), shopifyEnd, 1);
      const xeroCurve = mk(new THREE.Vector3(0.09, 0.52, -0.42), xeroEnd, -1);
      // The card floats just above the seated agent's head; it's anchored
      // by its bottom edge, so the log grows upward from here.
      const hudPos = rot(new THREE.Vector3(0, 0, 0.18)).setY(1.08);
      return {
        shopifyCurve,
        xeroCurve,
        shopifyEnd,
        xeroEnd,
        hudPos,
      };
    }, []);

  // Per-frame animation state, all refs - zero re-renders.
  const shopifyF = useRef(0);
  const xeroF = useRef(0);
  const flowOn = useRef(false);
  const alarmOn = useRef(false);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime % CYCLE;

    // Snap everything away at the end of the cycle, then loop.
    const out = t > T.reset ? easeInOut(clamp01((t - T.reset) / 0.4)) : 0;

    // Lines fire fast and settle - snappy, not floaty.
    shopifyF.current =
      easeOutQuart(clamp01((t - T.log3) / (T.linkA - T.log3))) * (1 - out);
    // The Xero line shoots out, gets cut dead short of the card, and
    // recoils from the cut.
    const grown = easeOutQuart(clamp01((t - T.log5) / (T.deny - T.log5)));
    const sinceDeny = t - T.deny;
    const recoil =
      sinceDeny > 0
        ? 0.045 * (1 - Math.cos(sinceDeny * 12) * Math.exp(-sinceDeny * 4.5))
        : 0;
    xeroF.current = (grown * CUT_AT - recoil) * (1 - out);

    flowOn.current = t >= T.linkA + 0.2 && t < T.reset;
    alarmOn.current = sinceDeny >= 0 && t < T.reset;

    // DOM stage - only setState across a boundary.
    let s = 0;
    if (t >= T.chipsIn && t <= T.reset) {
      while (s < STAGES.length && t >= STAGES[s]) s++;
    }
    if (s !== stageRef.current) {
      stageRef.current = s;
      setStage(s);
    }
  });

  return (
    <>
      <StaticCamera />
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
            sprite="pip"
            workerId="landing-security-demo"
            status="working"
            pose="sit"
            yaw={Math.PI}
          />
        </group>
      </group>

      <DottedLine curve={shopifyCurve} progress={shopifyF} flow={flowOn} />
      <DottedLine curve={xeroCurve} progress={xeroF} alarm={alarmOn} />

      <LogCard at={hudPos} lines={logCount(stage)} />
      <LogoNode
        at={shopifyEnd}
        src="/portara-test/integrations/shopify.svg"
        name="Shopify"
        state={stage === 0 ? "off" : stage >= 5 ? "ok" : "waiting"}
      />
      <LogoNode
        at={xeroEnd}
        src="/portara-test/integrations/xero.svg"
        name="Xero"
        state={stage === 0 ? "off" : stage >= 8 ? "denied" : "waiting"}
      />
    </>
  );
}

/** Default export so the home route can lazy-load the whole three.js chunk. */
export default function SecurityDemo() {
  return (
    <div className="sec-demo" aria-label="A marketing portlet calling ShipBob and Shopify successfully but being denied access to Xero">
      <Canvas
        orthographic
        shadows="basic"
        dpr={1}
        gl={{ antialias: false, alpha: true }}
        camera={{ zoom: 120, position: [20, 20, 20], near: -100, far: 400 }}
        style={{ touchAction: "none" }}
      >
        <SecurityScene />
      </Canvas>
    </div>
  );
}
