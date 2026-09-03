import { useEffect, useMemo, useRef } from "react";
import { useFrame, type ThreeElements } from "@react-three/fiber";
import * as THREE from "three";

import type { FurnitureType } from "../../lib/office-layout";
import { DROP, dropMotion, stampIntro, type IntroPlan } from "./intro";
import {
  BEANBAG,
  BOARD,
  COFFEE,
  DESK,
  LAMP,
  PLANT,
  SERVER,
  SHELF,
  UI3D,
  WALL,
} from "./palette";
import { toonGradient } from "./pixel-art";

function clamp01(n: number) {
  return Math.min(1, Math.max(0, n));
}
function popCurve(u: number) {
  if (u >= 1) return 1;
  const c = 1.70158 + 1;
  const x = u - 1;
  return 1 + c * x * x * x + (c - 1) * x * x;
}

function Mat({
  color,
  ghost,
  emissive,
  emissiveIntensity,
}: {
  color: string;
  ghost?: string | null;
  emissive?: string;
  emissiveIntensity?: number;
}) {
  return (
    <meshToonMaterial
      color={ghost ?? color}
      gradientMap={toonGradient()}
      transparent={!!ghost}
      opacity={ghost ? UI3D.ghostOpacity : 1}
      emissive={ghost ? ghost : (emissive ?? "#000000")}
      emissiveIntensity={ghost ? 0.35 : (emissiveIntensity ?? 0)}
    />
  );
}

/** Details of one element's turn in the office's arrival show. */
export type ItemDrop = {
  plan: IntroPlan;
  /** Seconds after the show's start that this element is released. */
  delay: number;
  /** Max falling tilt, radians (0 keeps the fall dead straight). */
  wobble?: number;
};

/** How many dust motes one landing kicks up, and how long they live. */
const PUFF_COUNT = 6;
const PUFF_LIFE = 0.42;

/**
 * The dust kicked up where a dropped item lands: a handful of tiny voxel
 * motes that skitter out low along the floor, hop a little, and shrink
 * away - pixel-art dust, in the floor's own cream. Timed to the element's
 * touchdown and mounted only while the intro is live, so a settled office
 * carries none of this.
 */
function DropDust({ plan, delay }: { plan: IntroPlan; delay: number }) {
  const group = useRef<THREE.Group>(null!);
  // Stable per-mote directions and sizes, varied per landing.
  const motes = useMemo(
    () =>
      Array.from({ length: PUFF_COUNT }, (_, i) => {
        const angle =
          (i / PUFF_COUNT) * Math.PI * 2 + Math.random() * 0.9;
        return {
          angle,
          size: 0.045 + Math.random() * 0.05,
          reach: 0.32 + Math.random() * 0.22,
          hop: 0.05 + Math.random() * 0.1,
        };
      }),
    [],
  );
  useFrame(() => {
    // The drop that owns this dust stamps the start; until then stay hidden.
    if (plan.start === 0) return;
    const u =
      (performance.now() / 1000 - plan.start - delay - DROP.fall) / PUFF_LIFE;
    if (u <= 0 || u >= 1) {
      group.current.visible = false;
      return;
    }
    group.current.visible = true;
    // Fast out, slow stop - flung by the impact, caught by the air.
    const e = 1 - (1 - u) * (1 - u);
    group.current.children.forEach((mote, i) => {
      const m = motes[i];
      mote.position.set(
        Math.cos(m.angle) * m.reach * e,
        0.03 + Math.sin(Math.min(1, u * 1.3) * Math.PI) * m.hop,
        Math.sin(m.angle) * m.reach * e,
      );
      mote.scale.setScalar(m.size * (1 - e));
      // Tumble a touch as they fly, so they read as debris, not confetti.
      mote.rotation.y = m.angle + e * 2.4;
    });
  });
  return (
    <group ref={group} visible={false}>
      {motes.map((_, i) => (
        <mesh key={i} scale={0}>
          <boxGeometry args={[1, 1, 1]} />
          <meshBasicMaterial color="#e9dcc2" />
        </mesh>
      ))}
    </group>
  );
}

/**
 * Wraps a model with the shared "landed" pop animation and hover lift - and,
 * while `drop` is set, this element's turn in the arrival show: hidden until
 * its release, a straight gravity fall with a slight tilt, then the squash,
 * rebound and dust ring of a heavy landing (see office3d/intro.ts).
 */
export function ItemWrap({
  bornAt = 0,
  hovered = false,
  drop = null,
  children,
  ...groupProps
}: {
  bornAt?: number;
  hovered?: boolean;
  drop?: ItemDrop | null;
  children: React.ReactNode;
} & Omit<ThreeElements["group"], "children">) {
  const ref = useRef<THREE.Group>(null!);
  // Settled items write nothing. A furnished office mounts one of these per
  // wall and per piece of furniture - 80+ of them - and every write dirties a
  // matrix that three then re-derives down the subtree, every frame, forever,
  // for scenery that finished its pop-in seconds ago and never moves again.
  const settled = useRef(false);
  // Which way this element tilts while falling - stable for its lifetime.
  const wobbleDir = useRef(Math.random() < 0.5 ? -1 : 1);
  useFrame((_, dt) => {
    const tNow = performance.now() / 1000;

    if (drop) {
      const m = dropMotion(tNow - stampIntro(drop.plan) - drop.delay);
      if (!m.done) {
        settled.current = false;
        if (m.pending) {
          ref.current.scale.setScalar(1e-4);
          return;
        }
        ref.current.position.y = m.y;
        ref.current.scale.set(m.sxz, m.sy, m.sxz);
        ref.current.rotation.y = m.wobble * wobbleDir.current * (drop.wobble ?? 0);
        return;
      }
      // Landed: hand the group back to the usual pop/hover motion below.
      ref.current.rotation.y = 0;
    }

    const age = bornAt ? tNow - bornAt : 99;
    const targetY = hovered ? 0.05 : 0;
    const grown = age >= 0.4;
    const atRest = Math.abs(targetY - ref.current.position.y) < 5e-4;
    if (settled.current && grown && atRest) return;

    ref.current.scale.setScalar(popCurve(clamp01(age / 0.4)));
    ref.current.position.y +=
      (targetY - ref.current.position.y) * Math.min(1, dt * 12);

    // Snap the last fraction so "settled" is actually reachable; a hover (or
    // un-hover) moves the target and starts it animating again.
    if (grown && Math.abs(targetY - ref.current.position.y) < 5e-4) {
      ref.current.position.y = targetY;
      settled.current = true;
    } else {
      settled.current = false;
    }
  });
  return (
    <group {...groupProps}>
      <group ref={ref}>{children}</group>
      {drop && <DropDust plan={drop.plan} delay={drop.delay} />}
    </group>
  );
}

/**
 * A desk unit on one tile: desk + monitor at the back of the tile, chair at
 * the front, so a seated agent fits on the same tile. `rot` on the parent
 * group orients the whole unit; the seated agent looks toward +Z (local).
 */
/** Text lines on a monitor, left-aligned like a terminal buffer. [width, y] */
const CODE_LINES: [number, number][] = [
  [0.26, 0.335],
  [0.18, 0.3],
  [0.3, 0.265],
  [0.22, 0.23],
  [0.14, 0.195],
];

export function DeskModel({
  ghost = null,
  screenOn = false,
  occupied = false,
}: {
  ghost?: string | null;
  screenOn?: boolean;
  occupied?: boolean;
}) {
  // The screen itself is dark glass; these orange terminal lines carry the
  // glow - bright and flickering while the agent works, embers when idle.
  const code = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: DESK.code,
        emissive: DESK.code,
        emissiveIntensity: 0.3,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => code.dispose(), [code]);
  useFrame(({ clock }) => {
    if (ghost) return;
    code.emissiveIntensity = screenOn
      ? 1.2 + Math.sin(clock.elapsedTime * 7) * 0.2 + Math.sin(clock.elapsedTime * 23) * 0.1
      : 0.3;
  });

  return (
    <group>
      {/* desktop - honey wood slab pushed to the back half of the tile */}
      <mesh position={[0, 0.36, -0.26]} castShadow>
        <boxGeometry args={[0.86, 0.06, 0.42]} />
        <Mat color={DESK.top} ghost={ghost} />
      </mesh>
      {/* charcoal side panels */}
      <mesh position={[-0.38, 0.18, -0.26]} castShadow>
        <boxGeometry args={[0.07, 0.32, 0.38]} />
        <Mat color={DESK.side} ghost={ghost} />
      </mesh>
      <mesh position={[0.38, 0.18, -0.26]} castShadow>
        <boxGeometry args={[0.07, 0.32, 0.38]} />
        <Mat color={DESK.side} ghost={ghost} />
      </mesh>
      {/* monitor */}
      <group position={[0, 0.39, -0.34]}>
        <mesh position={[0, 0.09, 0]} castShadow>
          <boxGeometry args={[0.1, 0.1, 0.05]} />
          <Mat color={DESK.monitor} ghost={ghost} />
        </mesh>
        <mesh position={[0, 0.25, 0]} castShadow>
          <boxGeometry args={[0.46, 0.3, 0.05]} />
          <Mat color={DESK.monitor} ghost={ghost} />
        </mesh>
        <mesh position={[0, 0.25, 0.028]}>
          <boxGeometry args={[0.4, 0.24, 0.01]} />
          <Mat color={DESK.screen} ghost={ghost} />
        </mesh>
        {!ghost &&
          CODE_LINES.map(([w, y], i) => (
            <mesh
              key={i}
              position={[-0.17 + w / 2, y - 0.015, 0.04]}
              material={code}
            >
              <boxGeometry args={[w, 0.018, 0.005]} />
            </mesh>
          ))}
      </group>
      {/* keyboard */}
      <mesh position={[0, 0.4, -0.14]}>
        <boxGeometry args={[0.3, 0.02, 0.1]} />
        <Mat color={DESK.keyboard} ghost={ghost} />
      </mesh>
      {/* mug */}
      <mesh position={[0.3, 0.43, -0.2]} castShadow>
        <cylinderGeometry args={[0.035, 0.035, 0.08, 8]} />
        <Mat color={DESK.mug} ghost={ghost} />
      </mesh>
      {/* book stack by the monitor */}
      <mesh position={[-0.31, 0.405, -0.3]} castShadow>
        <boxGeometry args={[0.16, 0.03, 0.12]} />
        <Mat color={DESK.bookDark} ghost={ghost} />
      </mesh>
      <mesh position={[-0.3, 0.435, -0.3]}>
        <boxGeometry args={[0.15, 0.03, 0.11]} />
        <Mat color={DESK.book} ghost={ghost} />
      </mesh>
      {/* chair - front half of the tile; hidden legs when someone sits */}
      <group position={[0, 0, 0.18]}>
        <mesh position={[0, 0.13, 0]} castShadow>
          <cylinderGeometry args={[0.035, 0.05, 0.22, 6]} />
          <Mat color={DESK.chairDark} ghost={ghost} />
        </mesh>
        <mesh position={[0, 0.26, 0]} castShadow>
          <boxGeometry args={[0.34, 0.05, 0.34]} />
          <Mat color={DESK.chair} ghost={ghost} />
        </mesh>
        {!occupied && (
          <mesh position={[0, 0.44, 0.16]} castShadow>
            <boxGeometry args={[0.34, 0.34, 0.05]} />
            <Mat color={DESK.chair} ghost={ghost} />
          </mesh>
        )}
        {occupied && (
          <mesh position={[0, 0.5, 0.17]} castShadow>
            <boxGeometry args={[0.34, 0.45, 0.05]} />
            <Mat color={DESK.chair} ghost={ghost} />
          </mesh>
        )}
      </group>
    </group>
  );
}

/**
 * A wall segment, exactly one tile long so neighbours join seamlessly:
 * slate slab with a light cap rail. The door variant opens the middle of
 * the segment - jambs either side, a lintel above, and a brand-red panel
 * swung invitingly ajar.
 */
export function WallModel({
  door = false,
  ghost = null,
}: {
  door?: boolean;
  ghost?: string | null;
}) {
  const cap = (
    <mesh position={[0, 0.9, 0]} castShadow>
      <boxGeometry args={[1.0, 0.05, 0.15]} />
      <Mat color={WALL.cap} ghost={ghost} />
    </mesh>
  );

  if (!door) {
    return (
      <group>
        <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
          <boxGeometry args={[1.0, 0.88, 0.1]} />
          <Mat color={WALL.body} ghost={ghost} />
        </mesh>
        {cap}
      </group>
    );
  }

  return (
    <group>
      {/* jambs */}
      <mesh position={[-0.375, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 0.88, 0.1]} />
        <Mat color={WALL.body} ghost={ghost} />
      </mesh>
      <mesh position={[0.375, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[0.25, 0.88, 0.1]} />
        <Mat color={WALL.body} ghost={ghost} />
      </mesh>
      {/* lintel over the opening */}
      <mesh position={[0, 0.79, 0]} castShadow>
        <boxGeometry args={[0.56, 0.18, 0.1]} />
        <Mat color={WALL.body} ghost={ghost} />
      </mesh>
      {/* light door frame */}
      <mesh position={[-0.26, 0.34, 0]}>
        <boxGeometry args={[0.04, 0.68, 0.12]} />
        <Mat color={WALL.cap} ghost={ghost} />
      </mesh>
      <mesh position={[0.26, 0.34, 0]}>
        <boxGeometry args={[0.04, 0.68, 0.12]} />
        <Mat color={WALL.cap} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.69, 0]}>
        <boxGeometry args={[0.56, 0.04, 0.12]} />
        <Mat color={WALL.cap} ghost={ghost} />
      </mesh>
      {/* the door itself, hinged at the left jamb and ajar */}
      <group position={[-0.24, 0, 0.05]} rotation={[0, 0.55, 0]}>
        <mesh position={[0.23, 0.345, 0]} castShadow>
          <boxGeometry args={[0.46, 0.65, 0.045]} />
          <Mat color={WALL.door} ghost={ghost} />
        </mesh>
        <mesh position={[0.38, 0.37, 0.032]}>
          <sphereGeometry args={[0.025, 8, 6]} />
          <Mat color={WALL.handle} ghost={ghost} />
        </mesh>
        <mesh position={[0.23, 0.55, 0.026]}>
          <boxGeometry args={[0.32, 0.14, 0.01]} />
          <Mat color={WALL.doorDark} ghost={ghost} />
        </mesh>
      </group>
      {cap}
    </group>
  );
}

/** A pot plant - sways gently so corners of the office feel alive. */
export function PlantModel({ ghost = null }: { ghost?: string | null }) {
  const leaves = useRef<THREE.Group>(null!);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    if (!leaves.current) return;
    const t = clock.elapsedTime + phase.current;
    leaves.current.rotation.z = Math.sin(t * 0.8) * 0.045;
    leaves.current.rotation.x = Math.cos(t * 0.6) * 0.03;
  });
  return (
    <group>
      <mesh position={[0, 0.12, 0]} castShadow>
        <cylinderGeometry args={[0.16, 0.12, 0.24, 7]} />
        <Mat color={PLANT.pot} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.245, 0]}>
        <cylinderGeometry args={[0.165, 0.165, 0.03, 7]} />
        <Mat color={PLANT.potRim} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.255, 0]}>
        <cylinderGeometry args={[0.13, 0.13, 0.02, 7]} />
        <Mat color={PLANT.soil} ghost={ghost} />
      </mesh>
      <group ref={leaves} position={[0, 0.26, 0]}>
        <mesh position={[0, 0.18, 0]} castShadow>
          <icosahedronGeometry args={[0.2, 0]} />
          <Mat color={PLANT.leafA} ghost={ghost} />
        </mesh>
        <mesh position={[0.1, 0.34, 0.04]} castShadow>
          <icosahedronGeometry args={[0.13, 0]} />
          <Mat color={PLANT.leafB} ghost={ghost} />
        </mesh>
        <mesh position={[-0.09, 0.36, -0.05]} castShadow>
          <icosahedronGeometry args={[0.11, 0]} />
          <Mat color={PLANT.leafC} ghost={ghost} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The banner's big squashy red beanbag: a low crushed sphere with a bulging
 * backrest and a darker seat dent where someone's been lounging. Faces +Z
 * like a chair, so `rot` on the parent group aims it.
 */
export function BeanbagModel({ ghost = null }: { ghost?: string | null }) {
  return (
    <group>
      {/* squashed base */}
      <mesh position={[0, 0.17, 0]} scale={[1, 0.6, 1]} castShadow>
        <sphereGeometry args={[0.34, 18, 14]} />
        <Mat color={BEANBAG.body} ghost={ghost} />
      </mesh>
      {/* backrest bulge */}
      <mesh position={[0, 0.3, -0.15]} scale={[0.85, 0.72, 0.6]} castShadow>
        <sphereGeometry args={[0.26, 16, 12]} />
        <Mat color={BEANBAG.body} ghost={ghost} />
      </mesh>
      {/* seat dent */}
      <mesh position={[0, 0.24, 0.08]} scale={[0.72, 0.32, 0.62]}>
        <sphereGeometry args={[0.24, 16, 12]} />
        <Mat color={BEANBAG.shade} ghost={ghost} />
      </mesh>
      {/* base seam resting on the floor */}
      <mesh position={[0, 0.045, 0]} scale={[1, 0.22, 1]}>
        <sphereGeometry args={[0.33, 16, 10]} />
        <Mat color={BEANBAG.seam} ghost={ghost} />
      </mesh>
    </group>
  );
}

/** One run of books standing on a shelf: varied heights, brand spines. */
function BookRow({
  y,
  seed,
  ghost,
}: {
  y: number;
  seed: number;
  ghost?: string | null;
}) {
  const colors = [SHELF.bookA, SHELF.bookD, SHELF.bookC, SHELF.bookB, SHELF.bookD, SHELF.bookA];
  const books: React.ReactNode[] = [];
  let x = -0.32;
  for (let i = 0; i < 6; i++) {
    const h = 0.14 + (((seed + i * 7) % 5) / 5) * 0.08;
    const w = 0.055 + (((seed + i * 3) % 3) / 3) * 0.03;
    // A gap partway along, so the row reads as books, not a solid block.
    if (i === 3 + (seed % 2)) x += 0.06;
    books.push(
      <mesh key={i} position={[x + w / 2, y + h / 2, 0]} castShadow>
        <boxGeometry args={[w, h, 0.2]} />
        <Mat color={colors[(seed + i) % colors.length]} ghost={ghost} />
      </mesh>,
    );
    x += w + 0.012;
  }
  return <>{books}</>;
}

/**
 * An open bookshelf, straight off the banner's wall shelves: charcoal frame,
 * three boards of brand-coloured books, and a little plant up top. Sits at
 * the back of its tile so it lines up flush against walls.
 */
export function BookshelfModel({ ghost = null }: { ghost?: string | null }) {
  return (
    <group position={[0, 0, -0.28]}>
      {/* side panels */}
      <mesh position={[-0.42, 0.45, 0]} castShadow>
        <boxGeometry args={[0.06, 0.9, 0.3]} />
        <Mat color={SHELF.frame} ghost={ghost} />
      </mesh>
      <mesh position={[0.42, 0.45, 0]} castShadow>
        <boxGeometry args={[0.06, 0.9, 0.3]} />
        <Mat color={SHELF.frame} ghost={ghost} />
      </mesh>
      {/* thin back panel */}
      <mesh position={[0, 0.45, -0.13]}>
        <boxGeometry args={[0.84, 0.9, 0.03]} />
        <Mat color={SHELF.frame} ghost={ghost} />
      </mesh>
      {/* boards: base, middle shelves, top */}
      {[0.04, 0.32, 0.6, 0.9].map((y) => (
        <mesh key={y} position={[0, y, 0]} castShadow>
          <boxGeometry args={[0.84, 0.04, 0.3]} />
          <Mat color={SHELF.board} ghost={ghost} />
        </mesh>
      ))}
      <BookRow y={0.06} seed={1} ghost={ghost} />
      <BookRow y={0.34} seed={4} ghost={ghost} />
      {/* on top: a couple of flat books and a plant */}
      <mesh position={[-0.22, 0.945, 0]} castShadow>
        <boxGeometry args={[0.22, 0.05, 0.2]} />
        <Mat color={SHELF.bookA} ghost={ghost} />
      </mesh>
      <group position={[0.2, 0.92, 0]}>
        <mesh position={[0, 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.055, 0.12, 7]} />
          <Mat color={PLANT.pot} ghost={ghost} />
        </mesh>
        <mesh position={[0, 0.19, 0]} castShadow>
          <icosahedronGeometry args={[0.1, 0]} />
          <Mat color={PLANT.leafA} ghost={ghost} />
        </mesh>
      </group>
    </group>
  );
}

/**
 * The coffee station: charcoal cabinet with a wood top, an espresso machine
 * with a steady amber ready-light, a stack of cups and a couple of the
 * brand-red mugs waiting for the next portlet on break.
 */
export function CoffeeModel({ ghost = null }: { ghost?: string | null }) {
  return (
    <group position={[0, 0, -0.22]}>
      {/* cabinet */}
      <mesh position={[0, 0.24, 0]} castShadow>
        <boxGeometry args={[0.84, 0.48, 0.4]} />
        <Mat color={COFFEE.cabinet} ghost={ghost} />
      </mesh>
      {/* wood top */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.9, 0.05, 0.46]} />
        <Mat color={COFFEE.top} ghost={ghost} />
      </mesh>
      {/* espresso machine */}
      <group position={[-0.2, 0.525, -0.04]}>
        <mesh position={[0, 0.15, 0]} castShadow>
          <boxGeometry args={[0.3, 0.3, 0.26]} />
          <Mat color={COFFEE.machine} ghost={ghost} />
        </mesh>
        {/* group head + drip tray */}
        <mesh position={[0, 0.05, 0.11]}>
          <boxGeometry args={[0.2, 0.04, 0.1]} />
          <Mat color={COFFEE.steel} ghost={ghost} />
        </mesh>
        <mesh position={[0, 0.13, 0.12]}>
          <boxGeometry args={[0.08, 0.06, 0.06]} />
          <Mat color={COFFEE.steel} ghost={ghost} />
        </mesh>
        {/* ready light */}
        <mesh position={[0.09, 0.24, 0.132]}>
          <boxGeometry args={[0.035, 0.035, 0.01]} />
          <Mat
            color={COFFEE.light}
            ghost={ghost}
            emissive={COFFEE.light}
            emissiveIntensity={0.9}
          />
        </mesh>
        {/* little cup under the spout */}
        <mesh position={[0, 0.09, 0.11]}>
          <cylinderGeometry args={[0.028, 0.022, 0.05, 8]} />
          <Mat color={COFFEE.cup} ghost={ghost} />
        </mesh>
      </group>
      {/* mugs + cup stack on the counter */}
      <mesh position={[0.14, 0.565, 0.05]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
        <Mat color={COFFEE.mug} ghost={ghost} />
      </mesh>
      <mesh position={[0.27, 0.565, -0.08]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
        <Mat color={COFFEE.mug} ghost={ghost} />
      </mesh>
      <mesh position={[0.31, 0.575, 0.08]} castShadow>
        <cylinderGeometry args={[0.035, 0.028, 0.1, 8]} />
        <Mat color={COFFEE.cup} ghost={ghost} />
      </mesh>
    </group>
  );
}

/**
 * A warm floor lamp: charcoal pole, dome shade, and a bulb that breathes
 * slowly - the cosy lo-fi glow for lounge corners and beanbag nooks.
 */
export function LampModel({ ghost = null }: { ghost?: string | null }) {
  const bulb = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: LAMP.bulb,
        emissive: LAMP.bulb,
        emissiveIntensity: 1,
        toneMapped: false,
      }),
    [],
  );
  useEffect(() => () => bulb.dispose(), [bulb]);
  const phase = useRef(Math.random() * Math.PI * 2);
  useFrame(({ clock }) => {
    if (ghost) return;
    bulb.emissiveIntensity = 1 + Math.sin(clock.elapsedTime * 1.4 + phase.current) * 0.12;
  });

  return (
    <group>
      {/* base + pole */}
      <mesh position={[0, 0.025, 0]} castShadow>
        <cylinderGeometry args={[0.14, 0.16, 0.05, 10]} />
        <Mat color={LAMP.pole} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.5, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.02, 0.95, 8]} />
        <Mat color={LAMP.pole} ghost={ghost} />
      </mesh>
      {/* dome shade with the glowing bulb hanging clear below its rim,
          so the glow reads from the iso camera's high angle */}
      <mesh position={[0, 1.04, 0]} castShadow>
        <coneGeometry args={[0.19, 0.18, 12, 1, true]} />
        <Mat color={LAMP.shade} ghost={ghost} />
      </mesh>
      {ghost ? (
        <mesh position={[0, 0.84, 0]}>
          <sphereGeometry args={[0.085, 10, 8]} />
          <Mat color={LAMP.bulb} ghost={ghost} />
        </mesh>
      ) : (
        <mesh position={[0, 0.84, 0]} material={bulb}>
          <sphereGeometry args={[0.085, 10, 8]} />
        </mesh>
      )}
    </group>
  );
}

/**
 * A freestanding whiteboard: cream face, charcoal frame and legs, a marker
 * tray, a scrawl of ink lines and the banner's red sticky notes.
 */
export function WhiteboardModel({ ghost = null }: { ghost?: string | null }) {
  return (
    <group position={[0, 0, -0.1]}>
      {/* legs + feet */}
      {[-0.34, 0.34].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.4, 0]} castShadow>
            <boxGeometry args={[0.05, 0.8, 0.05]} />
            <Mat color={BOARD.frame} ghost={ghost} />
          </mesh>
          <mesh position={[x, 0.02, 0]}>
            <boxGeometry args={[0.08, 0.04, 0.3]} />
            <Mat color={BOARD.frame} ghost={ghost} />
          </mesh>
        </group>
      ))}
      {/* board: charcoal frame with a cream face */}
      <mesh position={[0, 0.62, 0]} castShadow>
        <boxGeometry args={[0.9, 0.6, 0.05]} />
        <Mat color={BOARD.frame} ghost={ghost} />
      </mesh>
      <mesh position={[0, 0.62, 0.028]}>
        <boxGeometry args={[0.82, 0.52, 0.01]} />
        <Mat color={BOARD.face} ghost={ghost} />
      </mesh>
      {/* marker tray */}
      <mesh position={[0, 0.3, 0.05]}>
        <boxGeometry args={[0.5, 0.03, 0.06]} />
        <Mat color={BOARD.frame} ghost={ghost} />
      </mesh>
      {/* ink scrawl */}
      {([[-0.16, 0.78, 0.3], [-0.2, 0.71, 0.22], [-0.13, 0.64, 0.28]] as const).map(
        ([x, y, w], i) => (
          <mesh key={i} position={[x, y, 0.036]}>
            <boxGeometry args={[w, 0.02, 0.005]} />
            <Mat color={BOARD.ink} ghost={ghost} />
          </mesh>
        ),
      )}
      {/* sticky notes, slightly askew */}
      {(
        [
          [0.18, 0.76, BOARD.noteA, 0.08],
          [0.3, 0.74, BOARD.noteB, -0.1],
          [0.24, 0.62, BOARD.noteC, 0.05],
          [0.12, 0.52, BOARD.noteB, -0.06],
          [0.31, 0.5, BOARD.noteA, 0.12],
        ] as const
      ).map(([x, y, color, tilt], i) => (
        <mesh key={i} position={[x, y, 0.037]} rotation={[0, 0, tilt]}>
          <boxGeometry args={[0.075, 0.075, 0.006]} />
          <Mat color={color} ghost={ghost} />
        </mesh>
      ))}
    </group>
  );
}

/** LED positions on the server rack face: [x, y] per light. */
const SERVER_LEDS: { pos: [number, number]; cyan: boolean }[] = [
  { pos: [0.13, 0.86], cyan: true },
  { pos: [0.19, 0.86], cyan: false },
  { pos: [0.13, 0.68], cyan: false },
  { pos: [0.19, 0.68], cyan: false },
  { pos: [0.13, 0.5], cyan: true },
  { pos: [0.19, 0.5], cyan: false },
  { pos: [0.13, 0.32], cyan: false },
  { pos: [0.19, 0.32], cyan: true },
];

/**
 * A humming server rack - where the portlets' brains live. Charcoal cabinet,
 * slatted unit faces, and two banks of LEDs (amber activity, cyan link)
 * blinking in hard square-wave steps, like real rack lights.
 */
export function ServerModel({ ghost = null }: { ghost?: string | null }) {
  const amber = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: SERVER.ledAmber,
        emissive: SERVER.ledAmber,
        emissiveIntensity: 1.2,
        toneMapped: false,
      }),
    [],
  );
  const cyan = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: SERVER.ledCyan,
        emissive: SERVER.ledCyan,
        emissiveIntensity: 1.2,
        toneMapped: false,
      }),
    [],
  );
  useEffect(
    () => () => {
      amber.dispose();
      cyan.dispose();
    },
    [amber, cyan],
  );
  useFrame(({ clock }) => {
    if (ghost) return;
    const t = clock.elapsedTime;
    // Hard on/off steps, offset so the banks never blink in unison.
    amber.emissiveIntensity = Math.sin(t * 5.1) > -0.2 ? 1.4 : 0.15;
    cyan.emissiveIntensity = Math.sin(t * 2.3 + 1.4) > 0.3 ? 1.4 : 0.25;
  });

  return (
    <group position={[0, 0, -0.16]}>
      {/* cabinet */}
      <mesh position={[0, 0.5, 0]} castShadow>
        <boxGeometry args={[0.6, 1.0, 0.46]} />
        <Mat color={SERVER.body} ghost={ghost} />
      </mesh>
      {/* front face panel */}
      <mesh position={[0, 0.5, 0.235]}>
        <boxGeometry args={[0.52, 0.92, 0.01]} />
        <Mat color={SERVER.face} ghost={ghost} />
      </mesh>
      {/* unit slats */}
      {[0.14, 0.32, 0.5, 0.68, 0.86].map((y) => (
        <mesh key={y} position={[-0.05, y, 0.243]}>
          <boxGeometry args={[0.36, 0.09, 0.008]} />
          <Mat color={SERVER.slat} ghost={ghost} />
        </mesh>
      ))}
      {/* side vents, so the cabinet reads as a machine from every angle */}
      {[-1, 1].map((side) =>
        [0.3, 0.5, 0.7].map((y) => (
          <mesh key={`${side}-${y}`} position={[side * 0.303, y, 0]}>
            <boxGeometry args={[0.008, 0.12, 0.34]} />
            <Mat color={SERVER.slat} ghost={ghost} />
          </mesh>
        )),
      )}
      {/* LEDs */}
      {!ghost &&
        SERVER_LEDS.map((led, i) => (
          <mesh
            key={i}
            position={[led.pos[0], led.pos[1], 0.245]}
            material={led.cyan ? cyan : amber}
          >
            <boxGeometry args={[0.028, 0.028, 0.008]} />
          </mesh>
        ))}
      {/* feet */}
      {([[-0.24, -0.16], [0.24, -0.16], [-0.24, 0.16], [0.24, 0.16]] as const).map(
        ([x, z], i) => (
          <mesh key={i} position={[x, 0.015, z]}>
            <boxGeometry args={[0.08, 0.03, 0.08]} />
            <Mat color={SERVER.slat} ghost={ghost} />
          </mesh>
        ),
      )}
    </group>
  );
}

/**
 * One furniture piece by type - the single dispatch point the builder uses
 * for both placement ghosts and placed items. Desk-only props are ignored
 * by everything else.
 */
export function FurnitureModel({
  type,
  ghost = null,
  occupied = false,
  screenOn = false,
}: {
  type: FurnitureType;
  ghost?: string | null;
  occupied?: boolean;
  screenOn?: boolean;
}) {
  switch (type) {
    case "desk":
      return <DeskModel ghost={ghost} occupied={occupied} screenOn={screenOn} />;
    case "plant":
      return <PlantModel ghost={ghost} />;
    case "beanbag":
      return <BeanbagModel ghost={ghost} />;
    case "bookshelf":
      return <BookshelfModel ghost={ghost} />;
    case "coffee":
      return <CoffeeModel ghost={ghost} />;
    case "lamp":
      return <LampModel ghost={ghost} />;
    case "whiteboard":
      return <WhiteboardModel ghost={ghost} />;
    case "server":
      return <ServerModel ghost={ghost} />;
  }
}
