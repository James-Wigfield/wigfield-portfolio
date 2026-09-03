import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  keyOf,
  wallOccludes,
  type PaintBounds,
  type Tile,
  type Wall,
} from "../../lib/office-layout";
import { STAGE } from "./agent";
import { dropMotion, stampIntro, type IntroPlan } from "./intro";
import { BEANBAG, FLOOR, SKY_STOPS, UI3D } from "./palette";
import {
  pixelEdgeExclusions,
  reportZoomFraction,
  toonGradient,
  usePixelSettings,
} from "./pixel-art";

/* ── Camera ──────────────────────────────────────────────────────────────
   A purpose-built rig for office editing: fixed isometric elevation,
   45°-stepped rotation, damped pan and zoom. Left/right/middle drag on
   empty space pans; the wheel zooms; Q/E (or the toolbar) rotates. An
   `interactionLock` ref lets object-drags and the paint tool suppress
   panning. */

export type CameraControl = {
  rotate: (steps: number) => void;
  reset: () => void;
  zoomBy: (factor: number) => void;
  /** Glide the camera's target to a world position (the team rail's
      "find them on the floor"). Zoom and angle stay as they are. */
  focusOn: (x: number, z: number) => void;
};

/** One rotation step. A QUARTER turn, so from the starting 45° the camera
    only ever lands on the four diagonal views - straight-on views flatten
    the diorama into an elevation drawing and hide everything behind the
    front wall, so they are simply not on the dial. */
const YAW_STEP = Math.PI / 2;

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2); // classic isometric tilt

/** Zoom clamp, as multiples of the fit-to-floor zoom. */
const ZOOM_OUT_FACTOR = 0.45;
const ZOOM_IN_FACTOR = 3;

export function CameraRig({
  focus,
  control,
  interactionLock,
  panBlocked,
  spin = false,
  fitSpan,
  headroom = 0,
}: {
  /** Centre of the floor, in world coords. */
  focus: [number, number];
  /** Mutable handle the toolbar uses to drive the camera. */
  control: React.MutableRefObject<CameraControl | null>;
  /** While true (an object drag or paint stroke is live), dragging does not pan. */
  interactionLock: React.MutableRefObject<boolean>;
  /** Veto a pointer-down from starting a pan (e.g. right-click while placing). */
  panBlocked?: (e: PointerEvent) => boolean;
  /** Landing-page showcase: the camera circles the floor by itself and ALL
   *  user input (drag, wheel, keys) is ignored. */
  spin?: boolean;
  /** Floor extents [spanX, spanZ] in tiles. When given, the default zoom
   *  frames the whole floor (any spin angle) instead of the editor's fixed
   *  close-up - needed where there are no zoom controls. */
  fitSpan?: [number, number];
  /** Pixels to keep clear ABOVE the floor, for whatever floats over the
   *  agents' heads (the status cards). Only meaningful alongside fitSpan:
   *  the floor is fitted into the remaining height and then pushed down, so
   *  all of the slack ends up at the top rather than split top and bottom.
   *  0 (the editor) frames the floor dead centre, as before. */
  headroom?: number;
}) {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const gl = useThree((s) => s.gl);
  const size = useThree((s) => s.size);

  const state = useRef({
    target: new THREE.Vector3(focus[0], 0, focus[1]),
    goalTarget: new THREE.Vector3(focus[0], 0, focus[1]),
    azimuth: Math.PI / 4,
    goalAzimuth: Math.PI / 4,
    zoom: 0,
    goalZoom: 0,
    userMoved: false,
  });

  // Default zoom, scaled to the canvas size. The editor frames close enough
  // that the pixel-art detail on the portlets reads at rest; with fitSpan
  // the whole floor fits at its worst-case (diagonal) spin angle.
  const spanX = fitSpan?.[0];
  const spanZ = fitSpan?.[1];
  const fitZoom = useMemo(() => {
    if (spanX && spanZ) {
      const diag = Math.hypot(spanX, spanZ);
      // Never surrender more than a third of a short canvas to headroom -
      // on a phone that would shrink the office more than the cards are
      // worth, and the cards clamp to the edge as a backstop anyway.
      const usable = Math.max(size.height - headroom, size.height * 0.66);
      return Math.min(size.width / (diag + 2), usable / (diag * 0.6 + 3));
    }
    return Math.min(size.width, size.height) / 9;
  }, [size.width, size.height, spanX, spanZ, headroom]);
  if (state.current.zoom === 0) {
    state.current.zoom = fitZoom;
    state.current.goalZoom = fitZoom;
  }

  // Follow the floor centre as it's painted outward (unless the user has
  // panned somewhere deliberately - then leave them alone).
  useEffect(() => {
    if (!state.current.userMoved) {
      state.current.goalTarget.set(focus[0], 0, focus[1]);
    }
  }, [focus[0], focus[1]]);

  useEffect(() => {
    control.current = {
      rotate: (steps) => {
        state.current.goalAzimuth += steps * YAW_STEP;
      },
      reset: () => {
        state.current.goalTarget.set(focus[0], 0, focus[1]);
        state.current.goalAzimuth = Math.PI / 4;
        state.current.goalZoom = fitZoom;
        state.current.userMoved = false;
      },
      zoomBy: (f) => {
        state.current.goalZoom = THREE.MathUtils.clamp(
          state.current.goalZoom * f,
          fitZoom * ZOOM_OUT_FACTOR,
          fitZoom * ZOOM_IN_FACTOR,
        );
      },
      focusOn: (x, z) => {
        state.current.goalTarget.set(x, 0, z);
        state.current.userMoved = true;
      },
    };
  }, [control, fitZoom, focus[0], focus[1]]);

  // Pointer + wheel + keyboard controls. A spinning showcase takes no input.
  useEffect(() => {
    if (spin) return;
    const el = gl.domElement;
    const pointers = new Map<number, { x: number; y: number }>();
    let pinchDist = 0;
    let panning = false;

    const worldPan = (dx: number, dy: number) => {
      const s = state.current;
      const right = new THREE.Vector3(
        Math.cos(s.azimuth),
        0,
        -Math.sin(s.azimuth),
      );
      const fwd = new THREE.Vector3(
        -Math.sin(s.azimuth),
        0,
        -Math.cos(s.azimuth),
      );
      s.goalTarget.addScaledVector(right, -dx / s.zoom);
      s.goalTarget.addScaledVector(fwd, dy / s.zoom);
      s.userMoved = true;
    };

    const onPointerDown = (e: PointerEvent) => {
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      }
      panning = !interactionLock.current && !panBlocked?.(e);
    };
    const onPointerMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const cur = { x: e.clientX, y: e.clientY };
      pointers.set(e.pointerId, cur);

      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (pinchDist > 0) {
          state.current.goalZoom = THREE.MathUtils.clamp(
            state.current.goalZoom * (d / pinchDist),
            fitZoom * ZOOM_OUT_FACTOR,
            fitZoom * ZOOM_IN_FACTOR,
          );
        }
        pinchDist = d;
        return;
      }
      if (panning && !interactionLock.current && e.buttons > 0) {
        worldPan(cur.x - prev.x, cur.y - prev.y);
      }
    };
    const onPointerUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchDist = 0;
      if (pointers.size === 0) panning = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      state.current.goalZoom = THREE.MathUtils.clamp(
        state.current.goalZoom * Math.pow(1.0015, -e.deltaY),
        fitZoom * ZOOM_OUT_FACTOR,
        fitZoom * ZOOM_IN_FACTOR,
      );
    };
    const onKey = (e: KeyboardEvent) => {
      // Never hijack typing (the landing page has forms on the same screen).
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)
        return;
      if (e.key === "q" || e.key === "Q") state.current.goalAzimuth += YAW_STEP;
      if (e.key === "e" || e.key === "E") state.current.goalAzimuth -= YAW_STEP;
    };
    const onContext = (e: Event) => e.preventDefault();

    el.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKey);
    el.addEventListener("contextmenu", onContext);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKey);
      el.removeEventListener("contextmenu", onContext);
    };
  }, [gl, fitZoom, interactionLock, panBlocked, spin]);

  useFrame((_, dt) => {
    const s = state.current;
    // Showcase: a slow, steady lap of the office (~1 minute per turn).
    if (spin) s.goalAzimuth += dt * 0.1;
    const k = Math.min(1, dt * 7);
    s.target.lerp(s.goalTarget, k);
    s.azimuth += (s.goalAzimuth - s.azimuth) * k;
    s.zoom += (s.goalZoom - s.zoom) * k;

    // Tell the pixel renderer where we sit in the zoom range (0 out … 1 in),
    // log-mapped because zoom is multiplicative. Drives adaptive pixel size.
    reportZoomFraction(
      Math.log(s.zoom / (fitZoom * ZOOM_OUT_FACTOR)) /
        Math.log(ZOOM_IN_FACTOR / ZOOM_OUT_FACTOR),
    );

    const dist = 40;
    const y = Math.sin(ISO_ELEVATION) * dist;
    const r = Math.cos(ISO_ELEVATION) * dist;
    // Headroom is bought by fitZoom (which fitted the floor into a shorter
    // canvas, leaving half the slack top and half bottom) and spent here: lift
    // the camera and its target by the SAME amount, so the view direction is
    // untouched and the whole scene simply slides down the screen by the other
    // half. Screen-up gains cos(elevation) world units per unit of world Y,
    // times the zoom, which is the px-to-world conversion below.
    const lift =
      headroom > 0
        ? headroom / 2 / (Math.cos(ISO_ELEVATION) * Math.max(s.zoom, 1))
        : 0;
    camera.position.set(
      s.target.x + Math.sin(s.azimuth) * r,
      y + lift,
      s.target.z + Math.cos(s.azimuth) * r,
    );
    camera.lookAt(s.target.x, s.target.y + lift, s.target.z);
    if (Math.abs(camera.zoom - s.zoom) > 0.01) {
      camera.zoom = s.zoom;
      camera.updateProjectionMatrix();
    }
  });

  return null;
}

/* ── Lights ── golden hour, matched to the banner: a low warm sun as the
   key (long shadows, ember cast on every top face), a dusk-violet fill
   from the far side, and a warm-over-plum hemisphere instead of a flat
   ambient so undersides fall into the sunset's shadow colour. */
export function Lights() {
  const s = usePixelSettings();
  return (
    <>
      <hemisphereLight
        intensity={s.ambient}
        color="#ffd2a8"
        groundColor="#584668"
      />
      <directionalLight
        position={[10, 9, 5]}
        intensity={s.keyLight}
        color="#ffb37a"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-14}
        shadow-camera-right={14}
        shadow-camera-top={14}
        shadow-camera-bottom={-14}
        shadow-bias={-0.001}
      />
      <directionalLight position={[-6, 8, -8]} intensity={0.5} color="#8d7fc4" />
    </>
  );
}

/* ── Sky backdrop ────────────────────────────────────────────────────────
   A calm late-afternoon gradient (SKY_STOPS): the diorama's warm light
   pooling at the horizon, lifting into the portal's own pale blue so the
   scene blends with the surrounding UI. Rendered through the same pixel
   pass as everything else so it dithers into the art style. A screen-space
   texture, so it holds still while the camera pans and rotates.

   Each stop-to-stop segment is blended with smoothstep - a plain lerp
   leaves a slope crease at every stop that the eye picks out as a hard
   horizontal bar (Mach banding) - and the writes carry a 1-step ordered
   dither, because a pastel ramp this shallow shows its 8-bit quantisation
   as stripes otherwise. The admin panel's "Sky colour" picker swaps the
   stock stops for a ramp derived from the picked colour. */

/** 4×4 Bayer matrix for the ±1-step dither, normalised below. */
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Turn one picked colour into a sky: lighter toward the horizon, a shade
 *  deeper at the zenith, so the backdrop keeps its vertical depth. */
function stopsFromColor(hex: string): [number, string][] {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(hex).getHSL(hsl);
  const at = (dl: number) =>
    "#" +
    new THREE.Color()
      .setHSL(hsl.h, hsl.s, Math.min(0.97, Math.max(0.05, hsl.l + dl)))
      .getHexString();
  return [
    [0.0, at(+0.1)],
    [0.5, at(0)],
    [1.0, at(-0.08)],
  ];
}

export function SkyBackdrop() {
  const scene = useThree((s) => s.scene);
  const { skyColor } = usePixelSettings();

  const texture = useMemo(() => {
    const stops = skyColor ? stopsFromColor(skyColor) : SKY_STOPS;
    const W = 256;
    const H = 256;
    const data = new Uint8Array(W * H * 4);
    const c = new THREE.Color();
    const lo = new THREE.Color();
    const hi = new THREE.Color();

    for (let y = 0; y < H; y++) {
      const v = y / (H - 1); // 0 horizon (bottom) … 1 zenith (top)
      let a = stops[0];
      let b = stops[stops.length - 1];
      for (let sIdx = 0; sIdx < stops.length - 1; sIdx++) {
        if (v >= stops[sIdx][0] && v <= stops[sIdx + 1][0]) {
          a = stops[sIdx];
          b = stops[sIdx + 1];
          break;
        }
      }
      const span = b[0] - a[0] || 1;
      // Colors are held in linear working space; blend there (nicer
      // gradient), then encode back to sRGB for the sRGB-tagged texture.
      lo.set(a[1]);
      hi.set(b[1]);
      const gv = (v - a[0]) / span;
      const eased = gv * gv * (3 - 2 * gv); // smoothstep: flat at both stops

      for (let x = 0; x < W; x++) {
        c.lerpColors(lo, hi, eased);
        c.convertLinearToSRGB();
        const dither = (BAYER4[(y & 3) * 4 + (x & 3)] / 16 - 0.5) / 255;
        const i = (y * W + x) * 4;
        data[i] = Math.min(255, Math.max(0, Math.round((c.r + dither) * 255)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round((c.g + dither) * 255)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round((c.b + dither) * 255)));
        data[i + 3] = 255;
      }
    }
    const t = new THREE.DataTexture(data, W, H, THREE.RGBAFormat);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.LinearFilter;
    t.minFilter = THREE.LinearFilter;
    t.needsUpdate = true;
    return t;
  }, [skyColor]);

  useEffect(() => {
    scene.background = texture;
    return () => {
      scene.background = null;
      texture.dispose();
    };
  }, [scene, texture]);

  return null;
}

/* ── Floor ───────────────────────────────────────────────────────────────
   The painted tile set, drawn as two instanced meshes: thin checkered tops
   and chunky plinth blocks beneath, so any freeform floor shape still reads
   as a solid diorama slab. Newly painted tiles pop in with an
   ease-out-back bounce. */

function easeOutBack(u: number) {
  if (u >= 1) return 1;
  if (u <= 0) return 0;
  const c = 1.70158 + 1;
  const x = u - 1;
  return 1 + c * x * x * x + (c - 1) * x * x;
}

/**
 * One department lighting up: a ripple that spreads out from the patch's
 * centre while the rest of the floor steps back into shadow, so the rooms
 * belonging to one legend colour read unmistakably for a moment. Built by
 * the legend's chips (builder.tsx); the Floor only performs it.
 */
export type FloorFlash = {
  /** Tile keys (`x,z`) belonging to the department. */
  keys: Set<string>;
  /** performance.now()/1000 when the show started. */
  start: number;
  /** Wave origin - the centroid of the department's tiles. */
  cx: number;
  cz: number;
  /** Whole show length in seconds, ripple tail included. */
  duration: number;
};

/** How far the ripple's crest lifts a tile out of the slab. */
const FLASH_LIFT = 0.16;
/** Seconds of ripple delay per tile of distance from the wave origin. */
const FLASH_SPREAD = 0.055;
/** One tile's own pulse length within the ripple. */
const FLASH_PULSE = 0.8;

export function Floor({
  tiles,
  tints,
  intro,
  flash,
}: {
  tiles: Tile[];
  /** Legend colouring: tile key → hex colour. */
  tints?: Map<string, string>;
  /** First-load arrival show: tiles fall out of the sky in a diagonal wave
      (see office3d/intro.ts). Null once the show is over. */
  intro?: IntroPlan | null;
  /** A department highlight in progress, or null. */
  flash?: FloorFlash | null;
}) {
  const tops = useRef<THREE.InstancedMesh>(null!);
  const plinth = useRef<THREE.InstancedMesh>(null!);
  const born = useRef(new Map<string, number>());
  const firstRender = useRef(true);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);
  const whiteColor = useMemo(() => new THREE.Color("#ffffff"), []);
  /** True while a flash has been writing per-frame colours - so the frame
      after it ends restores the base coat exactly once. */
  const flashLive = useRef(false);

  // Stamp birth times for tiles that appeared since the last change.
  useEffect(() => {
    const now = performance.now() / 1000;
    for (const [x, z] of tiles) {
      const key = `${x},${z}`;
      if (!born.current.has(key)) {
        born.current.set(key, firstRender.current ? -99 : now);
      }
    }
    firstRender.current = false;
  }, [tiles]);

  // A tile's resting colour: checker, with legend tints overriding it.
  const baseColor = useCallback(
    (x: number, z: number, out: THREE.Color) => {
      const even = (x + z) % 2 === 0;
      const tint = tints?.get(`${x},${z}`);
      if (tint) {
        out.set(tint);
        if (!even) out.multiplyScalar(0.9); // keep the checker readable
      } else {
        out.set(even ? FLOOR.tileA : FLOOR.tileB);
      }
    },
    [tints],
  );

  // The base coat, written whenever the floor or the palette changes. The
  // flash overwrites it per frame and calls this again when it finishes.
  const writeBase = useCallback(() => {
    const c = new THREE.Color();
    tiles.forEach(([x, z], i) => {
      baseColor(x, z, c);
      tops.current.setColorAt(i, c);
    });
    if (tops.current.instanceColor) tops.current.instanceColor.needsUpdate = true;
  }, [tiles, baseColor]);

  useEffect(() => {
    writeBase();
  }, [writeBase]);

  useFrame(() => {
    const now = performance.now() / 1000;
    const introStart = intro ? stampIntro(intro) : 0;
    // The department highlight, while its show is running.
    const f = flash && now - flash.start <= flash.duration ? flash : null;
    const ft = f ? now - f.start : 0;
    // Ease the dimming in and out so the floor never snaps.
    const fEnv = f
      ? Math.min(1, ft / 0.18) *
        Math.min(1, Math.max(0, (f.duration - ft) / 0.3))
      : 0;
    tiles.forEach(([x, z], i) => {
      const key = `${x},${z}`;

      // The highlight's contribution to this tile: a lift for the ripple's
      // crest, and a colour written over the base coat for this frame.
      let lift = 0;
      if (f) {
        baseColor(x, z, tmpColor);
        if (f.keys.has(key)) {
          const d = Math.hypot(x - f.cx, z - f.cz);
          const u = (ft - d * FLASH_SPREAD) / FLASH_PULSE;
          const ripple = u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0;
          lift = ripple * FLASH_LIFT;
          // A steady glow holds the whole department lit while the crest
          // travels, so the shape reads as one patch, not a moving dot.
          const p = Math.min(1, 0.3 * fEnv + ripple);
          tmpColor.lerp(whiteColor, 0.6 * p);
        } else {
          tmpColor.multiplyScalar(1 - 0.45 * fEnv);
        }
        tops.current.setColorAt(i, tmpColor);
      }

      // The arrival: this tile is still falling in (or waiting its turn).
      if (intro) {
        const delay = intro.tiles.get(key);
        if (delay !== undefined) {
          const m = dropMotion(now - introStart - delay);
          if (!m.done) {
            dummy.rotation.set(0, 0, 0);
            if (m.pending) {
              // Not released yet: parked at zero scale, out of sight.
              dummy.position.set(x, -0.045, z);
              dummy.scale.setScalar(1e-4);
              dummy.updateMatrix();
              tops.current.setMatrixAt(i, dummy.matrix);
              plinth.current.setMatrixAt(i, dummy.matrix);
              return;
            }
            // Tiles take a soft echo of the squash - the full one would
            // shove them into their neighbours mid-wave.
            const sy = 1 + (m.sy - 1) * 0.5;
            const sxz = 1 + (m.sxz - 1) * 0.25;
            dummy.position.set(x, -0.045 + m.y, z);
            dummy.scale.set(0.985 * sxz, sy, 0.985 * sxz);
            dummy.updateMatrix();
            tops.current.setMatrixAt(i, dummy.matrix);
            dummy.position.set(x, -0.24 + m.y, z);
            dummy.scale.set(sxz, sy, sxz);
            dummy.updateMatrix();
            plinth.current.setMatrixAt(i, dummy.matrix);
            return;
          }
        }
      }

      const b = born.current.get(key) ?? -99;
      const u = (now - b) / 0.38;
      const s = easeOutBack(Math.min(1, Math.max(0, u)));

      dummy.position.set(x, -0.045 + lift - (1 - s) * 0.3, z);
      dummy.scale.set(0.985 * s, s, 0.985 * s);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      tops.current.setMatrixAt(i, dummy.matrix);

      // The plinth rides the ripple too - a lifted top over a parked plinth
      // would open a seam through the slab.
      dummy.position.set(x, -0.24 + lift - (1 - s) * 0.3, z);
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      plinth.current.setMatrixAt(i, dummy.matrix);
    });
    tops.current.instanceMatrix.needsUpdate = true;
    plinth.current.instanceMatrix.needsUpdate = true;
    if (f) {
      if (tops.current.instanceColor) tops.current.instanceColor.needsUpdate = true;
      flashLive.current = true;
    } else if (flashLive.current) {
      // The show just ended: put the base coat back exactly once.
      flashLive.current = false;
      writeBase();
    }
  });

  return (
    <group>
      <instancedMesh
        key={`tops-${tiles.length}`}
        ref={tops}
        args={[undefined, undefined, tiles.length]}
        receiveShadow
      >
        <boxGeometry args={[1, 0.09, 1]} />
        <meshToonMaterial gradientMap={toonGradient()} />
      </instancedMesh>
      <instancedMesh
        key={`plinth-${tiles.length}`}
        ref={plinth}
        args={[undefined, undefined, tiles.length]}
      >
        <boxGeometry args={[1, 0.3, 1]} />
        <meshToonMaterial color={FLOOR.plinth} gradientMap={toonGradient()} />
      </instancedMesh>
    </group>
  );
}

/* ── Showcase ground shadow ──────────────────────────────────────────────
   Landing-page showcase ONLY (never mounted in a real office). A huge
   shadow-catcher plane just under the diorama slab: THREE.ShadowMaterial
   draws nothing but the shadows it receives, so on the showcase's
   transparent canvas the page background keeps showing through and the
   office reads as sitting ON the page - a drop shadow - instead of
   floating in front of it. Doing it this way (rather than a plane painted
   the page's colour) means it can never drift out of sync with the CSS
   background: tone mapping and lighting don't apply, and a future theme
   change needs no touch-up here. */

export function GroundShadow({
  center,
  // Default sits just below the floor plinth's underside (-0.39); scenes
  // with no tile slab (the security demo's bare desk) pass their own.
  y = -0.42,
}: {
  center: [number, number];
  y?: number;
}) {
  const ref = useRef<THREE.Mesh>(null!);
  // Keep the plane out of the pixel pass's normal/depth edge buffer -
  // it's a shadow, not geometry, and must not grow outlines or bevels.
  useEffect(() => {
    const mesh = ref.current;
    pixelEdgeExclusions.add(mesh);
    return () => {
      pixelEdgeExclusions.delete(mesh);
    };
  }, []);
  return (
    <mesh
      ref={ref}
      // depthWrite is off, so the small gap below the geometry above only
      // exists to keep the depth test unambiguous.
      position={[center[0], y, center[1]]}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <planeGeometry args={[300, 300]} />
      <shadowMaterial transparent opacity={0.3} depthWrite={false} />
    </mesh>
  );
}

/* ── Tile cursor & selection ring ── */

export function TileCursor({
  x,
  z,
  valid,
  color,
}: {
  x: number;
  z: number;
  valid: boolean;
  /** Optional override of the valid/invalid colours. */
  color?: string;
}) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    mat.current.opacity = 0.4 + Math.sin(clock.elapsedTime * 6) * 0.12;
  });
  return (
    <mesh position={[x, 0.012, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[0.96, 0.96]} />
      <meshBasicMaterial
        ref={mat}
        color={color ?? (valid ? UI3D.valid : UI3D.invalid)}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/**
 * Translucent overlay on an agent's roam zone. While editing it pulses;
 * while merely selected it sits as a faint tint.
 */
export function ZoneOverlay({ tiles, editing }: { tiles: Tile[]; editing: boolean }) {
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: UI3D.accent,
        transparent: true,
        opacity: 0.16,
        depthWrite: false,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);
  useFrame(({ clock }) => {
    material.opacity = editing
      ? 0.26 + Math.sin(clock.elapsedTime * 5) * 0.08
      : 0.14;
  });
  return (
    <group>
      {tiles.map(([x, z]) => (
        <mesh
          key={keyOf(x, z)}
          position={[x, 0.011, z]}
          rotation={[-Math.PI / 2, 0, 0]}
          material={material}
        >
          <planeGeometry args={[0.92, 0.92]} />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Cutaway occlusion: project this wall's silhouette along the camera's view
 * direction onto the ground (see `wallOccludes`). If any of that footprint
 * lands on painted floor, the wall is visually covering part of the office -
 * so it fades to glass and you see straight through it. Walls with nothing
 * but void behind them stay solid.
 *
 * Two things keep the pixel pass honest while a wall is see-through: the
 * wall stops writing depth (so the depth buffer holds the room behind it,
 * not the wall), and the group registers in `pixelEdgeExclusions` so the
 * edge-detection buffer skips it - otherwise the pass would draw the wall's
 * pixel outlines on top of whatever shows through.
 */
const WALL_GLASS_OPACITY = 0.14;

export function WallFade({
  wall,
  tiles,
  children,
}: {
  wall: Wall;
  /** The painted floor, as `keyOf` strings. */
  tiles: Set<string>;
  children: React.ReactNode;
}) {
  const ref = useRef<THREE.Group>(null!);
  const cur = useRef(1);
  const dir = useMemo(() => new THREE.Vector3(), []);

  // Never leave a stale entry behind when the wall is erased.
  useEffect(() => {
    const group = ref.current;
    return () => {
      if (group) pixelEdgeExclusions.delete(group);
    };
  }, []);

  useFrame((state, dt) => {
    if (!ref.current) return;
    // Camera look direction, flattened to the ground plane.
    state.camera.getWorldDirection(dir);
    const fl = Math.hypot(dir.x, dir.z) || 1;
    const occludes = wallOccludes(wall, dir.x / fl, dir.z / fl, tiles);

    const target = occludes ? WALL_GLASS_OPACITY : 1;
    cur.current += (target - cur.current) * Math.min(1, dt * 8);
    const fade = cur.current;
    const solid = fade > 0.98;

    if (solid) pixelEdgeExclusions.delete(ref.current);
    else pixelEdgeExclusions.add(ref.current);

    ref.current.traverse((o) => {
      if (!(o as THREE.Mesh).isMesh) return;
      const mesh = o as THREE.Mesh;
      const m = mesh.material as THREE.Material;
      if (mesh.userData.baseCastShadow === undefined) {
        mesh.userData.baseCastShadow = mesh.castShadow;
      }
      m.opacity = fade;
      m.depthWrite = solid;
      if (m.transparent === solid) {
        // Flipping `transparent` swaps the compiled shader variant (opaque
        // builds bake alpha to 1), so it needs a program refresh.
        m.transparent = !solid;
        m.needsUpdate = true;
      }
      // A glass wall shouldn't throw a solid shadow across the floor.
      mesh.castShadow = fade > 0.5 && mesh.userData.baseCastShadow;
    });
  });

  return <group ref={ref}>{children}</group>;
}

/* ── The edge of the world ───────────────────────────────────────────────
   Shown when a paint stroke hits the office's span limit: a glowing force
   field around the whole region tiles may still go, sweeping out from the
   exact spot the user tried to paint - two bright fronts race both ways
   around the perimeter and meet on the far side, the field holds while
   they keep pushing, then dissolves. It answers "why won't it paint?" by
   drawing the answer: this is the box, and here is where you hit it. */

export const BARRIER = {
  height: 0.55,
  /** Seconds for the two fronts to meet on the far side. */
  wrap: 0.55,
  /** Seconds the field stays lit after the LAST blocked attempt. */
  hold: 0.7,
  fade: 0.35,
};
/** Full lifetime measured from the last blocked attempt. */
export const BARRIER_TOTAL = BARRIER.wrap + BARRIER.hold + BARRIER.fade;

const BARRIER_VERT = /* glsl */ `
  attribute float aArc;
  varying float vArc;
  varying vec2 vUv;
  void main() {
    vArc = aArc;
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const BARRIER_FRAG = /* glsl */ `
  uniform float uSpawn;
  uniform float uPerim;
  uniform float uFront;
  uniform float uFade;
  uniform float uTime;
  uniform vec3 uColor;
  varying float vArc;
  varying vec2 vUv;
  void main() {
    // Distance along the perimeter from the spawn point, the short way round.
    float d = abs(vArc - uSpawn);
    d = min(d, uPerim - d);
    if (d > uFront) discard;
    // The bright pulse riding just behind each travelling front.
    float head = 1.0 - smoothstep(0.0, 1.6, uFront - d);
    // Dashes: - - - - along the perimeter, crawling gently while it holds.
    // Hard-edged on purpose - the pixel pass keeps them crisp.
    float dash = step(fract((vArc - uTime * 0.35) / 0.62), 0.55);
    // A hot dashed line at the floor, with a short glow rising off it.
    float ground = 1.0 - smoothstep(0.0, 0.22, vUv.y);
    float sheet = (1.0 - vUv.y) * (1.0 - vUv.y);
    float a = (dash * (0.55 * ground + 0.3 * sheet) + 0.75 * head) * uFade;
    vec3 c = uColor * (0.95 + 0.9 * head);
    gl_FragColor = vec4(c, clamp(a, 0.0, 1.0));
  }
`;

/** Arc length (along the rect's perimeter path) of the point nearest (px,pz).
    Sides run in the same order the geometry lays them down. */
function nearestArc(
  x0: number,
  x1: number,
  z0: number,
  z1: number,
  px: number,
  pz: number,
): number {
  const w = x1 - x0;
  const d = z1 - z0;
  // Each side: [start x, start z, dir x, dir z, length, arc at start]
  const sides: [number, number, number, number, number, number][] = [
    [x0, z0, 1, 0, w, 0],
    [x1, z0, 0, 1, d, w],
    [x1, z1, -1, 0, w, w + d],
    [x0, z1, 0, -1, d, w + d + w],
  ];
  let bestArc = 0;
  let bestDist = Infinity;
  for (const [sx, sz, dx, dz, len, arc0] of sides) {
    const t = Math.min(len, Math.max(0, (px - sx) * dx + (pz - sz) * dz));
    const qx = sx + dx * t;
    const qz = sz + dz * t;
    const dist = Math.hypot(px - qx, pz - qz);
    if (dist < bestDist) {
      bestDist = dist;
      bestArc = arc0 + t;
    }
  }
  return bestArc;
}

export function BoundsBarrier({
  rect,
  spawn,
  at,
  poke,
}: {
  /** Allowed paint region, tile coords inclusive (lib paintBounds). */
  rect: PaintBounds;
  /** The tile the user tried to paint - where the field erupts from. */
  spawn: [number, number];
  /** When THIS show started (fronts sweep from here). */
  at: number;
  /** The most recent blocked attempt - each one extends the hold. */
  poke: number;
}) {
  const mesh = useRef<THREE.Mesh>(null!);

  // World-space edges: tile centres are integers, the field stands half a
  // tile outside the last permitted row.
  const x0 = rect.minX - 0.5;
  const x1 = rect.maxX + 0.5;
  const z0 = rect.minZ - 0.5;
  const z1 = rect.maxZ + 0.5;
  const perim = 2 * (x1 - x0 + (z1 - z0));

  // Four vertical quads, one per side, with the running perimeter arc baked
  // into a vertex attribute so the shader knows how far each pixel sits
  // from the spawn point.
  const geometry = useMemo(() => {
    const w = x1 - x0;
    const d = z1 - z0;
    const H = BARRIER.height;
    // [start x, start z, end x, end z, arc at start, length]
    const sides: [number, number, number, number, number, number][] = [
      [x0, z0, x1, z0, 0, w],
      [x1, z0, x1, z1, w, d],
      [x1, z1, x0, z1, w + d, w],
      [x0, z1, x0, z0, w + d + w, d],
    ];
    const pos: number[] = [];
    const arc: number[] = [];
    const uv: number[] = [];
    const idx: number[] = [];
    sides.forEach(([sx, sz, ex, ez, a0, len], i) => {
      pos.push(sx, 0, sz, ex, 0, ez, ex, H, ez, sx, H, sz);
      arc.push(a0, a0 + len, a0 + len, a0);
      uv.push(0, 0, 1, 0, 1, 1, 0, 1);
      const b = i * 4;
      idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    });
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute("aArc", new THREE.Float32BufferAttribute(arc, 1));
    g.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    return g;
  }, [x0, x1, z0, z1]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: BARRIER_VERT,
        fragmentShader: BARRIER_FRAG,
        uniforms: {
          uSpawn: { value: 0 },
          uPerim: { value: 1 },
          uFront: { value: 0 },
          uFade: { value: 0 },
          uTime: { value: 0 },
          // The beanbags' red, a shade lighter - normal blending (not
          // additive) so the brand red stays red over the bright floor
          // instead of washing to orange-white.
          uColor: {
            value: new THREE.Color(BEANBAG.body).offsetHSL(0, 0.05, 0.1),
          },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    [],
  );
  useEffect(() => () => material.dispose(), [material]);

  // A light wash, not geometry: keep the pixel pass from outlining it.
  useEffect(() => {
    const m = mesh.current;
    pixelEdgeExclusions.add(m);
    return () => {
      pixelEdgeExclusions.delete(m);
    };
  }, []);

  useFrame(() => {
    const now = performance.now() / 1000;
    const u = material.uniforms;
    u.uPerim.value = perim;
    u.uSpawn.value = nearestArc(x0, x1, z0, z1, spawn[0], spawn[1]);
    // The fronts: fast out of the gate, easing as they meet on the far
    // side. Slight overshoot so the meet point fills completely.
    const wrapU = Math.min(1, (now - at) / BARRIER.wrap);
    u.uFront.value = (1 - Math.pow(1 - wrapU, 3)) * (perim / 2 + 1.4);
    // Lit until the hold (from the LAST poke) runs out, then dissolve.
    const sincePoke = now - poke;
    const fade =
      sincePoke < BARRIER.wrap + BARRIER.hold
        ? 1
        : 1 - (sincePoke - BARRIER.wrap - BARRIER.hold) / BARRIER.fade;
    u.uFade.value = clamp01(fade);
    u.uTime.value = now;
  });

  return <mesh ref={mesh} geometry={geometry} material={material} />;
}

/** Ghost of a floor tile about to be painted. */
export function PaintGhost({ x, z, valid }: { x: number; z: number; valid: boolean }) {
  return (
    <mesh position={[x, -0.045, z]}>
      <boxGeometry args={[0.985, 0.09, 0.985]} />
      <meshStandardMaterial
        color={valid ? UI3D.valid : UI3D.invalid}
        transparent
        opacity={0.4}
        emissive={valid ? UI3D.valid : UI3D.invalid}
        emissiveIntensity={0.3}
      />
    </mesh>
  );
}

/**
 * A pulsing translucent box wrapped around an existing wall segment - the
 * hover treatment for the door tool and wall-erase, so the real wall stays
 * visible underneath. Position/rotate the parent group onto the edge.
 */
export function EdgeHighlight({ color }: { color: string }) {
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(({ clock }) => {
    mat.current.opacity = 0.32 + Math.sin(clock.elapsedTime * 6) * 0.1;
  });
  return (
    <mesh position={[0, 0.47, 0]}>
      <boxGeometry args={[1.08, 1.06, 0.24]} />
      <meshBasicMaterial
        ref={mat}
        color={color}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}

/* ── Taking the stage ────────────────────────────────────────────────────
   The scene half of the agent console (see STAGE in agent.tsx): everything
   that changes about the OFFICE while one agent is presented at the front of
   the shot. Two pieces, both parented to a group that copies the camera, so
   they hold their place on screen while the office keeps moving behind them:

     - a dimming pane across the whole frustum, sitting between the office and
       the agent. It has to be in the scene rather than a DOM scrim over the
       canvas, because the agent it is dimming BEHIND is drawn by the canvas -
       a DOM layer would cover them too.
     - a warm key light next to the hover spot, so a staged agent is lit from
       the viewer's side whatever angle the sun is on. Its `distance` keeps it
       local: the office is ~40 units away and never sees it.

   The pane is transparent and writes no depth, so it renders after the opaque
   agent in front of it and dims only what is further away. */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

/** How far the office falls back while an agent is out front. */
const SCRIM_OPACITY = 0.68;
/** The key light's spot, relative to the agent's: out to one side, above, and
    a touch nearer the camera. World units, so it holds at any zoom. */
const KEY_OFFSET: [number, number, number] = [1.6, 1.4, 1.2];
/** Tuned against the office's own key (1.55) so the toon bands lift rather
    than blow out: ~1 effective after decay at this distance. */
const KEY_INTENSITY = 8;

export function StageDressing({ at, out }: { at: number; out: boolean }) {
  const rig = useRef<THREE.Group>(null!);
  const pane = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  const key = useRef<THREE.PointLight>(null!);

  // Keep the pane out of the pixel pass's edge buffer - it is a wash over the
  // frame, not geometry, and must not draw an outline around the viewport.
  useEffect(() => {
    const mesh = pane.current;
    pixelEdgeExclusions.add(mesh);
    return () => {
      pixelEdgeExclusions.delete(mesh);
    };
  }, []);

  useFrame((state) => {
    const cam = state.camera as THREE.OrthographicCamera;
    rig.current.position.copy(cam.position);
    rig.current.quaternion.copy(cam.quaternion);

    // Cover the frustum at any zoom, with margin for the rotation damping.
    const viewW = state.size.width / cam.zoom;
    const viewH = state.size.height / cam.zoom;
    pane.current.scale.set(viewW * 1.2, viewH * 1.2, 1);

    const u = clamp01((performance.now() / 1000 - at) / STAGE.flight);
    mat.current.opacity = (out ? 1 - u : u) * SCRIM_OPACITY;

    // Beside and slightly above the hover spot (agent.tsx's stageAnchor, in
    // the same camera-local terms).
    key.current.position.set(
      KEY_OFFSET[0],
      -viewH / 2 + STAGE.lift * viewH + KEY_OFFSET[1],
      -STAGE.depth + KEY_OFFSET[2],
    );
    key.current.intensity = (out ? 1 - u : u) * KEY_INTENSITY;
  });

  return (
    <group ref={rig}>
      <mesh ref={pane} position={[0, 0, -STAGE.scrimDepth]}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial
          ref={mat}
          color={UI3D.stageScrim}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <pointLight ref={key} color="#ffd9b4" intensity={0} distance={9} decay={2} />
    </group>
  );
}

/**
 * The ring left behind on the desk when an agent lifts off it: one expanding,
 * fading pulse. Purely a flourish - it says "they came from here", so the eye
 * follows the flight instead of wondering what just moved.
 */
export function StageBurst({ x, z, at }: { x: number; z: number; at: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  const mat = useRef<THREE.MeshBasicMaterial>(null!);
  useFrame(() => {
    const u = clamp01((performance.now() / 1000 - at) / 0.85);
    // Fast out, slow stop - the shape of something released.
    const e = 1 - (1 - u) * (1 - u);
    ref.current.scale.setScalar(0.5 + e * 2.6);
    mat.current.opacity = (1 - u) * 0.5;
    ref.current.visible = u < 1;
  });
  return (
    <mesh ref={ref} position={[x, 0.016, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.34, 0.44, 28]} />
      <meshBasicMaterial
        ref={mat}
        color={UI3D.accent}
        transparent
        opacity={0}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

export function SelectRing({ x, z }: { x: number; z: number }) {
  const ref = useRef<THREE.Mesh>(null!);
  useFrame(({ clock }) => {
    ref.current.rotation.z = clock.elapsedTime * 0.8;
    const s = 1 + Math.sin(clock.elapsedTime * 4) * 0.04;
    ref.current.scale.setScalar(s);
  });
  return (
    <mesh ref={ref} position={[x, 0.014, z]} rotation={[-Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.4, 0.48, 4, 1]} />
      <meshBasicMaterial
        color={UI3D.accent}
        transparent
        opacity={0.9}
        depthWrite={false}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}
