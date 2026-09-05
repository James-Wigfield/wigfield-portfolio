/**
 * The 3D hero - the "3D" side of the toggle at the top of the page.
 *
 * The mark is the whole hero. The gate stands as a solid object
 * (temp/portara-hero.glb, built in Claude Design); the wordmark's three words
 * orbit it as rings of letters, one radius for all three and each word three
 * times round its circumference, stacked by height; and PORTARA itself
 * stands on the floor in front, in 3D type bent round the gate so the word
 * wraps the portal. Far behind, a conga line of portlets (temp/portlet.glb)
 * dances round a loop in the distance (portlets.tsx). Every letter is built
 * at load from the Jost SemiBold font (true curves).
 *
 * Everything casts shadows onto the page's own ground from one key light high
 * to the front-left. SCROLLING SPINS THE RINGS UP: every scroll event adds to
 * a boost that decays over a few frames, so scrolling on sends the words
 * whipping round the gate (and turns the portlets' music up). As each ring
 * letter crosses the front of its orbit it takes the accent. The camera
 * drifts a hand's width with the pointer.
 *
 * THROUGH THE PORTAL: scrolling on sends the word into the gate. The letters
 * lift off in reading order, arc up over the front of the gate and dive
 * through its opening, shrinking and fading as they pass its plane; scroll
 * hard and they buffet on the way. It is a pure function of scroll position,
 * so scrolling back brings them home the same way. The header (nav-reveal.ts)
 * then appears from under the gate's foot as the gate leaves the top.
 *
 * The copy is one line and one button along the foot of the scene: the h1
 * stays real text for search and screen readers, the pitch itself now
 * belongs to the section below. No pinned jump here: the page scrolls
 * straight on to the demo portal.
 *
 * Legibility of a near-black object on a light ground: a slight sheen, a warm
 * key and a cool fill from opposite sides so adjacent faces differ, an accent
 * rim from behind, and every hard edge drawn as a fine line one step lighter
 * than the fill (the wordmark's lines are its face outlines only).
 *
 * ENTRANCE: the gate rises out of the ground, the wordmark's letters drop in
 * one after another, the rings spin in, the portlets pop up. Reduced motion:
 * nothing moves.
 *
 * LAYOUT TOOL (temporary): the wordmark, the gate-with-rings and the portlets
 * are three objects that can be clicked and moved, turned and scaled in
 * place (the wordmark also bent), with the layout kept in localStorage and a
 * "Copy values" button that gives the block to paste over LAYOUT below. Once
 * the layout is locked in, paste it, then remove layout-tool.tsx,
 * layout-tool.css and the lines marked LAYOUT TOOL.
 */
import { Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { FontLoader, type Font } from "three/examples/jsm/loaders/FontLoader.js";
import { TextGeometry } from "three/examples/jsm/geometries/TextGeometry.js";
import gsap from "gsap";

import Magnet from "../bits/Magnet";
import { PortalFrame } from "./hero-scene";
import { Portlets } from "./portlets";
import { setNavSource } from "./nav-reveal";
// LAYOUT TOOL (temporary, see layout-tool.tsx)
import {
  LayoutGizmo,
  LayoutPanel,
  applyXform,
  pickHandlers,
  useLayoutTool,
  type Layout,
  type LayoutId,
  type LayoutTool,
  type Pick,
  type Vec3,
  type Xform,
} from "./layout-tool";

const MODEL = "/portara-test/portara-hero.glb";
/* Jost SemiBold, the letters the rings and the wordmark need, made by
   tools/subset-jost.mjs (overlapping contours already unioned). */
const FONT = "/portara-test/fonts/jost-600.typeface.json";
const SCENE_MEDIA = "(min-width: 861px)";
const REDUCE = "(prefers-reduced-motion: reduce)";

/* The rings: one radius for all three, each word three times round the
   circumference, stacked by height, well clear of the wordmark's cap (0.55)
   below them. Rest speeds from the handoff (rad/s). The GLB's own ring nodes
   are dropped; these are built from the font. */
const RING_RADIUS = 1.7;
const RING_REPEATS = 3;
const RING_CAP = 0.16;
const RING_DEPTH = 0.03;
const RING_TRACKING = 0.12;
const RINGS = [
  { word: "PORTALS", height: 1.75, speed: 0.22 },
  { word: "MCP", height: 1.25, speed: -0.17 },
  { word: "AGENTS", height: 0.75, speed: 0.13 },
];
const GLB_RING_NODES = ["ring-portals", "ring-mcp", "ring-agents"];

/* The wordmark: cap height, depth (a proper slab now, about a third of the
   cap), tracking (the lockup preset's 0.15em). */
const WORD = "PORTARA";
const WORD_CAP = 0.55;
const WORD_DEPTH = 0.18;
const WORD_TRACKING = 0.15;

/* THROUGH THE PORTAL: as the page scrolls, the letters lift off in reading
   order, arc up and dive through the gate's opening, shrinking and fading as
   they pass the gate's plane. Progress is scroll over viewport height: from
   `start` to `end` of a screen, each letter's own flight offset by `stagger`
   of the whole. The word stays put for the first stretch of scrolling, then
   flies. The flight CHASES the scroll position rather than tracking it: it
   closes the gap at `lag` per second and never moves faster than `maxRate`
   of the whole per second, so a flick of the wheel still plays out as a
   glide of a second or so, and stopping mid-way eases to a halt. Scroll
   speed (the rings' boost) adds turbulence. */
const FLY = { start: 0.12, end: 0.42, stagger: 0.045, lag: 3.2, maxRate: 0.8 };
/* In the gate's space: where the letters swing up to, and where they end
   (just behind the opening). */
const FLY_OVER: Vec3 = [0, 1.7, 1.5];
const FLY_THROUGH: Vec3 = [0, 1.0, -0.6];

/* Where the three objects stand. Rotation in degrees; a word's position is
   the middle of its baseline and `curve` the arc its letters bend through.

   The composition: the gate on the page's centre line, turned 8 degrees
   towards the camera so its opening reads as a doorway; PORTARA on the floor
   in front of it, STRAIGHT and centred on the same line, turned to exactly
   the camera's own heading (31.8 degrees, atan2 of VIEW_DIR's x and z) so
   the whole word sits at one depth and its baseline runs dead level across
   the screen, in line with the page below - James's call, over the earlier
   arc (the Curve control still bends it if wanted); the portlets' conga
   line in the distance behind it all.
   The camera looks along (-0.5, -0.8) on the floor, so "far away, centre
   screen" is that way from the target: the loop's centre sits about 8.5
   units out along it, and the loop is turned to lie across the camera's
   line of sight (its long axis along the screen's own x), so the line walks
   across the top of the scene, left to right on its near side, passing
   behind the gate in the middle (the "dancers" position is the loop's
   centre, its rotation the loop's heading, its scale the loop's size).
   LAYOUT TOOL: these are the defaults the tool starts from and resets to;
   "Copy values" gives the block to paste. */
const LAYOUT: Layout = {
  word: { position: [1.27, 0, 2.07], rotation: [0, 31.8, 0], scale: 1.17, curve: 0 },
  gate: { position: [-0.2, 0, -0.3], rotation: [0, 8, 0], scale: 1 },
  dancers: { position: [-3.9, 0, -6.3], rotation: [0, 31.8, 0], scale: 1 },
};
/* A phone is portrait; the composition already stacks (gate above, word
   below), so it is the same layout seen from further back, with the word at
   its natural size so it clears both edges and the conga loop drawn in so
   its ends stay inside the narrow frame. */
const LAYOUT_NARROW: Layout = {
  ...LAYOUT,
  word: { ...LAYOUT.word, scale: 1 },
  dancers: { ...LAYOUT.dancers, scale: 0.72 },
};

/* The camera stands front-right and above. The target sits at the gate's
   waist, the distance takes in the arc and the two outer portlets. */
const VIEW_DIR = new THREE.Vector3(0.62, 0.42, 1).normalize();
const PERCH = {
  wide: { tx: 0.3, ty: 0.45, tz: 0.5, dist: 8.4 },
  narrow: { tx: 0.3, ty: 0.75, tz: 0.5, dist: 11.5 },
};

const INK = new THREE.Color("#0c131b");
const GATE = new THREE.Color("#141c26");
const EDGE = new THREE.Color("#5c6773");
const ACCENT = new THREE.Color("#ff4e2b");

type CamState = { tx: number; ty: number; tz: number; dist: number };
type FontData = {
  capHeight?: number;
  resolution: number;
  glyphs: Record<string, { ha: number; x_min?: number; x_max?: number }>;
};

/** The camera: on its perch, drifting with the pointer, looking at the target. */
function Rig({ cam, parallax }: { cam: CamState; parallax: boolean }) {
  const { camera } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const target = useMemo(() => new THREE.Vector3(), []);
  const want = useMemo(() => new THREE.Vector3(), []);
  const eye = useMemo(() => new THREE.Vector3(NaN, NaN, NaN), []);

  useEffect(() => {
    if (!parallax) {
      pointer.current.x = 0;
      pointer.current.y = 0;
      return;
    }
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
    want.x += pointer.current.x * 0.4;
    want.y -= pointer.current.y * 0.22;
    if (Number.isNaN(eye.x)) eye.copy(want);
    else eye.lerp(want, 1 - Math.pow(0.002, Math.min(dt, 0.1)));
    camera.position.copy(eye);
    camera.lookAt(target);
  });
  return null;
}

/** A solid-type material and the matching edge lines, shared. */
function useTypeMaterials() {
  return useMemo(
    () => ({
      // No polygon offset here on purpose: pushing faces back lets the far
      // edges of a letter show through its steep side faces, which reads as
      // doubled outlines. The lines sit on true corners and test depth as is.
      solid: new THREE.MeshStandardMaterial({ color: GATE, roughness: 0.42, metalness: 0.12 }),
      edge: new THREE.LineBasicMaterial({ color: EDGE, transparent: true, opacity: 0.9 }),
      // LAYOUT TOOL: the selected object's edges take the accent.
      edgeHot: new THREE.LineBasicMaterial({ color: ACCENT }),
    }),
    [],
  );
}

/** Letter geometry for one character, ink-centred on x. */
function letterGeometry(font: Font, ch: string, size: number, depth: number, segments: number) {
  const geo = new TextGeometry(ch, { font, size, depth, curveSegments: segments, bevelEnabled: false });
  geo.computeBoundingBox();
  // Read the numbers out BEFORE shifting: translate() recomputes the box.
  const left = geo.boundingBox!.min.x;
  const right = geo.boundingBox!.max.x;
  const mid = (left + right) / 2;
  geo.translate(-mid, 0, 0);
  return { geo, mid, left, right };
}

/** The three rings of letters, spinning inside the gate's group. */
function Rings({
  font,
  boost,
  spin,
  entrance,
}: {
  font: Font;
  boost: React.MutableRefObject<number>;
  spin: boolean;
  entrance: boolean;
}) {
  const groups = useRef<(THREE.Group | null)[]>([]);

  const rings = useMemo(() => {
    const data = font.data as FontData;
    const res = data.resolution;
    const size = RING_CAP / ((data.capHeight ?? 700) / res);
    const tracking = RING_TRACKING * size;
    return RINGS.map((ring) => {
      // The word laid out straight first, then bent round the circle: each
      // letter's centre becomes an angle, arc length over radius.
      let x = 0;
      const items = [...ring.word].map((ch) => {
        const l = letterGeometry(font, ch, size, RING_DEPTH, 12);
        l.geo.translate(0, -RING_CAP / 2, -RING_DEPTH / 2);
        const at = x;
        x += ((data.glyphs[ch]?.ha ?? 600) / res) * size + tracking;
        return { geo: l.geo, cx: at + l.mid, left: at + l.left, right: at + l.right };
      });
      const centre = (items[0].left + items[items.length - 1].right) / 2;
      const letters: { geo: THREE.BufferGeometry; theta: number; pos: Vec3; mat: THREE.MeshStandardMaterial }[] = [];
      for (let k = 0; k < RING_REPEATS; k++) {
        const base = (k * Math.PI * 2) / RING_REPEATS;
        for (const it of items) {
          const theta = base + (it.cx - centre) / RING_RADIUS;
          letters.push({
            geo: it.geo,
            theta,
            pos: [RING_RADIUS * Math.sin(theta), ring.height, RING_RADIUS * Math.cos(theta)],
            mat: new THREE.MeshStandardMaterial({ color: INK, roughness: 0.5, metalness: 0.05 }),
          });
        }
      }
      return { ...ring, letters };
    });
  }, [font]);

  // Entrance: the rings spin in one after another, once the gate is up.
  useLayoutEffect(() => {
    if (!entrance) return;
    const tl = gsap.timeline();
    groups.current.forEach((g, i) => {
      if (!g) return;
      const at = 1.0 + i * 0.16;
      tl.fromTo(g.scale, { x: 0.001, y: 0.001, z: 0.001 }, { x: 1, y: 1, z: 1, duration: 1.0, ease: "back.out(1.3)" }, at);
      tl.fromTo(g.rotation, { y: -Math.PI * 0.9 }, { y: 0, duration: 1.3, ease: "power3.out" }, at);
    });
    return () => {
      tl.kill();
    };
  }, [entrance]);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.1);
    // Boost from scrolling decays over a few frames (handoff: 0.15^dt). This
    // is the one place it decays; the portlets only read it.
    boost.current *= Math.pow(0.15, step);
    const k = 1 + boost.current;
    rings.forEach((ring, i) => {
      const g = groups.current[i];
      if (!g) return;
      if (spin) g.rotation.y += ring.speed * k * step;
      // Letters take the accent as they cross the front of their orbit.
      for (const l of ring.letters) {
        const front = THREE.MathUtils.clamp((Math.cos(l.theta + g.rotation.y) - 0.35) / 0.65, 0, 1);
        l.mat.emissive.copy(ACCENT).multiplyScalar(front * front);
      }
    });
  });

  return (
    <>
      {rings.map((ring, i) => (
        <group
          key={ring.word}
          ref={(el) => {
            groups.current[i] = el;
          }}
        >
          {ring.letters.map((l, j) => (
            <mesh key={j} geometry={l.geo} material={l.mat} position={l.pos} rotation-y={l.theta} castShadow />
          ))}
        </group>
      ))}
    </>
  );
}

/** The gate, with the rings inside its group so they move with it. */
function Gate({
  font,
  boost,
  entrance,
  spin,
  groupRef,
  xform,
  pick,
}: {
  font: Font;
  boost: React.MutableRefObject<number>;
  entrance: boolean;
  spin: boolean;
  groupRef: React.RefObject<THREE.Group | null>;
  xform: Xform;
  pick?: Pick;
}) {
  const { scene } = useGLTF(MODEL);
  const gate = useMemo(() => scene.getObjectByName("gate"), [scene]);
  const mats = useTypeMaterials();

  // The GLB's traced rings are replaced by Rings; drop them.
  useMemo(() => {
    GLB_RING_NODES.forEach((n) => scene.getObjectByName(n)?.removeFromParent());
  }, [scene]);

  // The gate: sheen, drawn edges, shadows both ways.
  useMemo(() => {
    if (!gate) return;
    gate.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      m.material = mats.solid;
      m.castShadow = true;
      m.receiveShadow = true;
      if (!m.getObjectByName("edges")) {
        const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry, 45), mats.edge);
        lines.name = "edges";
        m.add(lines);
      }
    });
  }, [gate, mats]);

  // Where it stands (LAYOUT TOOL: the stored layout, else the default).
  useLayoutEffect(() => {
    if (groupRef.current) applyXform(groupRef.current, xform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // LAYOUT TOOL: the selection shows on the gate's edges.
  useEffect(() => {
    if (!gate) return;
    gate.traverse((o) => {
      if (o.name === "edges") (o as THREE.LineSegments).material = pick?.selected ? mats.edgeHot : mats.edge;
    });
  }, [gate, mats, pick?.selected]);

  // Entrance: the gate rises out of the ground.
  useLayoutEffect(() => {
    if (!entrance || !gate) return;
    const tween = gsap.fromTo(gate.position, { y: -2.6 }, { y: 0, duration: 1.3, ease: "power3.out" });
    return () => {
      tween.kill();
    };
  }, [gate, entrance]);

  return (
    <group ref={groupRef} {...pickHandlers(pick)}>
      <primitive object={scene} />
      <Rings font={font} boost={boost} spin={spin} entrance={entrance} />
    </group>
  );
}

/** PORTARA, standing on the floor, bent round an arc, one mesh per letter. */
function Wordmark({
  font,
  entrance,
  onReady,
  groupRef,
  gateRef,
  boost,
  xform,
  pick,
}: {
  font: Font;
  entrance: boolean;
  onReady?: () => void;
  groupRef: React.RefObject<THREE.Group | null>;
  gateRef: React.RefObject<THREE.Group | null>;
  boost: React.MutableRefObject<number>;
  xform: Xform;
  pick?: Pick;
}) {
  const mats = useTypeMaterials();
  const curve = xform.curve ?? 0;

  // The letters laid out straight and centred on the word's middle, each
  // ink-centred on its own origin so it can be turned in place.
  const word = useMemo(() => {
    const data = font.data as FontData;
    const res = data.resolution;
    const size = WORD_CAP / ((data.capHeight ?? 700) / res);
    const tracking = WORD_TRACKING * size;
    let x = 0;
    const raw = [...WORD].map((ch, i) => {
      const l = letterGeometry(font, ch, size, WORD_DEPTH, 18);
      // The drawn line is the letter's FACE OUTLINE only - its contour and
      // any counters - a hair in front of the face. Deriving edges from the
      // extrusion would draw the back and side edges too.
      const outlines: THREE.BufferGeometry[] = [];
      for (const shape of font.generateShapes(ch, size)) {
        for (const contour of [shape, ...shape.holes]) {
          const pts = contour.getPoints(18).map((p) => new THREE.Vector3(p.x - l.mid, p.y, WORD_DEPTH + 0.002));
          outlines.push(new THREE.BufferGeometry().setFromPoints(pts));
        }
      }
      const at = x;
      x += ((data.glyphs[ch]?.ha ?? 600) / res) * size + tracking;
      return { key: `${ch}${i}`, geo: l.geo, outlines, cx: at + l.mid, left: at + l.left, right: at + l.right };
    });
    const centre = (raw[0].left + raw[raw.length - 1].right) / 2;
    return { width: raw[raw.length - 1].right - raw[0].left, letters: raw.map((l) => ({ ...l, cx: l.cx - centre })) };
  }, [font]);

  // Bent round a circle: the word's length over the arc angle is the radius,
  // each letter's centre an angle along it. The circle's centre is behind the
  // word's middle (positive curve), so the word wraps whatever stands there.
  const placed = useMemo(() => {
    const theta = THREE.MathUtils.degToRad(curve);
    return word.letters.map((l) => {
      if (Math.abs(theta) < 1e-3) return { pos: [l.cx, 0, 0] as Vec3, yaw: 0 };
      const r = word.width / theta;
      const phi = l.cx / r;
      return { pos: [r * Math.sin(phi), 0, r * (Math.cos(phi) - 1)] as Vec3, yaw: phi };
    });
  }, [word, curve]);

  // One material per letter, so each can fade on its own as it goes through.
  const skins = useMemo(
    () =>
      word.letters.map(() => {
        const solid = mats.solid.clone();
        solid.transparent = true;
        const edge = mats.edge.clone();
        return { solid, edge };
      }),
    [word, mats],
  );
  // LAYOUT TOOL: the selection shows on the letters' outlines.
  useEffect(() => {
    for (const s of skins) s.edge.color.copy(pick?.selected ? ACCENT : EDGE);
  }, [skins, pick?.selected]);

  // Where it stands (LAYOUT TOOL: the stored layout, else the default).
  useLayoutEffect(() => {
    if (groupRef.current) applyXform(groupRef.current, xform);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // THROUGH THE PORTAL. Driven by scroll, smoothed in time; plays backwards too.
  const flight = useRef({ live: false, p: 0, started: false });
  const fly = useMemo(
    () => ({ a: new THREE.Vector3(), c: new THREE.Vector3(), b: new THREE.Vector3(), p: new THREE.Vector3() }),
    [],
  );
  useFrame((_, dt) => {
    const g = groupRef.current;
    const gate = gateRef.current;
    if (!g || !gate) return;
    const step = Math.min(dt, 0.1);
    const vh = window.innerHeight;
    const target = THREE.MathUtils.clamp((window.scrollY / vh - FLY.start) / (FLY.end - FLY.start), 0, 1);
    const f = flight.current;
    if (!f.started) {
      // A page opened part-way down starts where it is, not with a flight.
      f.started = true;
      f.p = target;
    } else {
      let next = f.p + (target - f.p) * (1 - Math.exp(-FLY.lag * step));
      const most = FLY.maxRate * step;
      next = THREE.MathUtils.clamp(next, f.p - most, f.p + most);
      f.p = Math.abs(next - target) < 0.0015 ? target : next;
    }
    const p = f.p;
    if (p <= 0) {
      if (!f.live) return;
      // Back at rest: every letter exactly where the layout puts it.
      f.live = false;
      g.children.forEach((m, i) => {
        const rest = placed[i];
        m.position.set(rest.pos[0], rest.pos[1], rest.pos[2]);
        m.rotation.set(0, rest.yaw, 0);
        m.scale.setScalar(1);
        m.visible = true;
        m.castShadow = true;
        skins[i].solid.opacity = 1;
        skins[i].edge.opacity = 0.9;
      });
      return;
    }
    f.live = true;
    // The two waypoints, in the word's own space.
    fly.c.set(FLY_OVER[0], FLY_OVER[1], FLY_OVER[2]);
    gate.localToWorld(fly.c);
    g.worldToLocal(fly.c);
    fly.b.set(FLY_THROUGH[0], FLY_THROUGH[1], FLY_THROUGH[2]);
    gate.localToWorld(fly.b);
    g.worldToLocal(fly.b);
    const n = g.children.length;
    const span = 1 - (n - 1) * FLY.stagger;
    const gust = boost.current * 0.06;
    g.children.forEach((m, i) => {
      const q = THREE.MathUtils.clamp((p - i * FLY.stagger) / span, 0, 1);
      const e = q * q * q * (q * (q * 6 - 15) + 10); // gentle ease in and out
      const rest = placed[i];
      fly.a.set(rest.pos[0], rest.pos[1], rest.pos[2]);
      // A quadratic arc: rest, up over the front of the gate, through.
      const u = 1 - e;
      fly.p.copy(fly.a).multiplyScalar(u * u).addScaledVector(fly.c, 2 * u * e).addScaledVector(fly.b, e * e);
      // Turbulence only while in flight, and only when scrolling hard.
      const wob = gust * Math.sin(q * Math.PI);
      fly.p.x += wob * Math.sin(i * 1.7 + q * 9);
      fly.p.y += wob * Math.cos(i * 2.3 + q * 7);
      m.position.copy(fly.p);
      m.scale.setScalar(1 - 0.6 * e);
      const side = i % 2 ? 1 : -1;
      m.rotation.set(-0.55 * Math.sin(q * Math.PI), rest.yaw + 0.4 * e * side, 0.12 * Math.sin(q * Math.PI * 2) * side);
      // Fade through the gate's plane, over the last third.
      const fade = THREE.MathUtils.clamp((q - 0.68) / 0.32, 0, 1);
      skins[i].solid.opacity = 1 - fade;
      skins[i].edge.opacity = 0.9 * (1 - fade);
      m.visible = q < 1;
      m.castShadow = q < 0.55;
    });
  });

  // Entrance: the letters drop in one after another, once the gate is up.
  useLayoutEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    if (!entrance) {
      onReady?.();
      return;
    }
    const tl = gsap.timeline({ onComplete: () => onReady?.() });
    g.children.forEach((m, i) => {
      const at = 0.5 + i * 0.07;
      tl.fromTo(m.position, { y: 1.8 }, { y: 0, duration: 0.9, ease: "back.out(1.1)" }, at);
      tl.fromTo(m.rotation, { x: -0.7 }, { x: 0, duration: 0.9, ease: "power3.out" }, at);
    });
    return () => {
      tl.kill();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entrance]);

  return (
    <group ref={groupRef} {...pickHandlers(pick)}>
      {word.letters.map((l, i) => (
        <mesh
          key={l.key}
          geometry={l.geo}
          material={skins[i].solid}
          position={placed[i].pos}
          rotation-y={placed[i].yaw}
          castShadow
          receiveShadow
        >
          {l.outlines.map((g, j) => (
            <lineLoop key={j} geometry={g} material={skins[i].edge} />
          ))}
        </mesh>
      ))}
    </group>
  );
}

/**
 * Tells the header where the bottom of the monument is (nav-reveal.ts): the
 * lowest on screen of the letters' front baseline points (while they are
 * still there) and the gate's own foot, projected to a viewport y every
 * frame. So the header is uncovered from under the word as the word scrolls
 * past, or, once the letters have flown through the portal, from under the
 * gate as it leaves - wherever they are, camera drift and all.
 */
function NavSourceProbe({
  wordRef,
  gateRef,
}: {
  wordRef: React.RefObject<THREE.Group | null>;
  gateRef: React.RefObject<THREE.Group | null>;
}) {
  const { camera, gl } = useThree();
  const v = useMemo(() => new THREE.Vector3(), []);
  useFrame(() => {
    const g = wordRef.current;
    if (!g || !g.children.length) return;
    const rect = gl.domElement.getBoundingClientRect();
    const screenY = () => rect.top + ((1 - v.y) / 2) * rect.height;
    let bottom = -Infinity;
    for (const m of g.children) {
      if (!m.visible) continue;
      v.set(0, 0, WORD_DEPTH);
      m.localToWorld(v).project(camera);
      bottom = Math.max(bottom, screenY());
    }
    // The gate's foot: the bottom corners of every piece of the gate.
    const gate = gateRef.current?.getObjectByName("gate");
    gate?.traverse((o) => {
      const m = o as THREE.Mesh;
      if (!m.isMesh) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      const bb = m.geometry.boundingBox!;
      for (const x of [bb.min.x, bb.max.x]) {
        for (const z of [bb.min.z, bb.max.z]) {
          v.set(x, bb.min.y, z).applyMatrix4(m.matrixWorld).project(camera);
          bottom = Math.max(bottom, screenY());
        }
      }
    });
    if (Number.isFinite(bottom)) setNavSource(bottom);
  });
  useEffect(() => () => setNavSource(null), []);
  return null;
}

/** The page's ground, receiving the shadows and otherwise invisible. */
function Floor() {
  return (
    <mesh rotation-x={-Math.PI / 2} position-y={0.0015} receiveShadow>
      <planeGeometry args={[60, 60]} />
      <shadowMaterial transparent opacity={0.3} color="#0c131b" />
    </mesh>
  );
}

function Lights() {
  return (
    <>
      <hemisphereLight args={["#ffffff", "#c9d0d6", 0.7]} />
      {/* The key, high to the front-left: it lights the faces the camera
          sees and throws the shadows onto the floor. The shadow camera is
          wide enough to take in the wordmark, the rings and the conga line
          at the back. */}
      <directionalLight
        position={[-4, 9, 7]}
        intensity={1.9}
        color="#fff7ef"
        castShadow
        shadow-mapSize={[3072, 3072]}
        shadow-bias={-0.0003}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={50}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      {/* A cool fill from the right, so the faces the key misses are a
          different dark rather than the same one. */}
      <directionalLight position={[6, 3, 2]} intensity={0.35} color="#dbe6ff" />
      {/* The rim: the accent from behind-right, a thread of orange along the
          silhouette. */}
      <directionalLight position={[6, 2.4, -6]} intensity={1.4} color="#ff4e2b" />
    </>
  );
}

/** Everything that needs the font and the models, under one Suspense. */
function Scene({
  boost,
  entrance,
  spin,
  onReady,
  wordRef,
  gateRef,
  dancersRef,
  tool,
  editing,
}: {
  boost: React.MutableRefObject<number>;
  entrance: boolean;
  spin: boolean;
  onReady: () => void;
  wordRef: React.RefObject<THREE.Group | null>;
  gateRef: React.RefObject<THREE.Group | null>;
  dancersRef: React.RefObject<THREE.Group | null>;
  tool: LayoutTool;
  editing: boolean;
}) {
  const font = useLoader(FontLoader, FONT) as Font;
  // LAYOUT TOOL: clickable while the tool is on.
  const pick = (id: LayoutId): Pick | undefined =>
    editing ? { selected: tool.selected === id, onSelect: () => tool.select(id) } : undefined;
  return (
    <>
      <Gate
        font={font}
        boost={boost}
        entrance={entrance}
        spin={spin}
        groupRef={gateRef}
        xform={tool.layout.gate}
        pick={pick("gate")}
      />
      <Wordmark
        font={font}
        entrance={entrance}
        onReady={onReady}
        groupRef={wordRef}
        gateRef={gateRef}
        boost={boost}
        xform={tool.layout.word}
        pick={pick("word")}
      />
      {/* LAYOUT TOOL: the panel's "Show portlets" box; on by default. */}
      {tool.view.dancers && (
        <Portlets groupRef={dancersRef} xform={tool.layout.dancers} pick={pick("dancers")} boost={boost} dance={spin} entrance={entrance} />
      )}
      {editing && <LayoutGizmo tool={tool} />}
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

  // LAYOUT TOOL: the three objects, and the tool that moves them. Desktop
  // only; while it is on, the camera stops drifting so what you see is what
  // ships.
  const wordRef = useRef<THREE.Group>(null);
  const gateRef = useRef<THREE.Group>(null);
  const dancersRef = useRef<THREE.Group>(null);
  const refs = useMemo(() => ({ word: wordRef, gate: gateRef, dancers: dancersRef }), []);
  const tool = useLayoutTool(desktop ? LAYOUT : LAYOUT_NARROW, refs);
  const editing = tool.open && desktop;

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
        {/* The gate, the word, the words in orbit, and the portlets. */}
        <div className={"hero3d" + (editing ? " is-editing" : "")} ref={canvasWrap} aria-hidden="true">
          <Canvas
            // PCF shadow maps: "soft" (PCFSoftShadowMap) is deprecated in
            // three r185 and falls back to this anyway.
            shadows
            // Full device resolution (capped at 2x): the letters are the
            // finest thing on the page.
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
            camera={{ fov: 36, near: 0.05, far: 100, position: [3.0, 3.3, 7.6] }}
            frameloop={active ? "always" : "never"}
            onPointerMissed={editing ? tool.missed : undefined}
          >
            <Suspense fallback={null}>
              <Lights />
              <Floor />
              <Scene
                boost={boost}
                entrance={!reduce}
                spin={!reduce}
                onReady={() => setSettled(true)}
                wordRef={wordRef}
                gateRef={gateRef}
                dancersRef={dancersRef}
                tool={tool}
                editing={editing}
              />
            </Suspense>
            <Rig cam={cam} parallax={!reduce && !editing} />
            <NavSourceProbe wordRef={wordRef} gateRef={gateRef} />
          </Canvas>
        </div>
        {/* LAYOUT TOOL */}
        {desktop && <LayoutPanel tool={tool} />}

        {/* One line and one button along the foot of the scene. */}
        <div className="container scene__strapline">
          <h1 className="scene__strap">
            <span className="scene__strap-name">Portara</span>
            <span className="scene__strap-sub">Custom staff portals · Perth</span>
          </h1>
          <Magnet padding={48} magnetStrength={9} wrapperClassName="magnet">
            <a href="#request" className="btn btn--lg">
              Request a meeting
            </a>
          </Magnet>
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
