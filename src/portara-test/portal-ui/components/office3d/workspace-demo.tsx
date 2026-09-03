import { useEffect, useMemo } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import type { Tile } from "../../lib/office-layout";
import { CENTRE, TARGET, roomZoom } from "./workspace-room";
import { AgentModel } from "./agent";
import {
  BookshelfModel,
  CoffeeModel,
  DeskModel,
  LampModel,
  PlantModel,
  WallModel,
  WhiteboardModel,
} from "./models";
import { Floor, GroundShadow, Lights } from "./scene";
import { PixelArtRenderer, reportZoomFraction } from "./pixel-art";

/* ── Workspace vignette (#portal, act two) ───────────────────────────────
   A portlet at work in its own office, and nothing else. The delivery half
   of the story - packets landing in the portal's navigation - is DOM, in
   components/workspace-tour.tsx, because the nav they land in has to BE the
   nav, pixel for pixel, and a 3D approximation of a sidebar is exactly the
   thing that would give the trick away.

   So this file is scenery: a furnished corner room seen from the diagonal,
   an agent typing at its desk. No connector lines, no floating labels, no
   timeline - the room is still and the agent works, which is what makes the
   packets flying out of it read as the event.

   View-only, no data, pointer-inert. */

/** The floor, as office tiles - the same unit grid the real office editor
    uses, so the furniture sits on it at the scale it does everywhere else. */
const TILES: Tile[] = [
  [0, 0], [1, 0], [2, 0], [3, 0],
  [0, 1], [1, 1], [2, 1], [3, 1],
  [0, 2], [1, 2], [2, 2], [3, 2],
];

/**
 * The desk's yaw.
 *
 * The security vignette next door sits its agent dead-on to the camera. This
 * one is deliberately a quarter-turn off that, so the portlet is seen from
 * three-quarters - working, rather than posing for you. At the fixed pi/4
 * camera the agent's facing is DESK_YAW + pi, so this puts it along +X: turned
 * toward the nav it is feeding, which is off to the right of the frame.
 */
const DESK_YAW = -Math.PI / 2;

const ISO_ELEVATION = Math.atan(1 / Math.SQRT2);

/* Everything about HOW this room is framed - where the camera looks, how many
   world units it fits, and where the agent's chest lands in the box - lives in
   workspace-room.ts. The landing page's tour launches its packets from that
   chest, and two files hand-tuning the same point against each other is how
   the packets came to be emitted from beside the agent rather than out of it. */

/** Fixed isometric camera on the room. No controls - the pointer is dead
    here by design. */
function StaticCamera() {
  const camera = useThree((s) => s.camera) as THREE.OrthographicCamera;
  const size = useThree((s) => s.size);
  useEffect(() => {
    const az = Math.PI / 4;
    const dist = 40;
    const target = new THREE.Vector3(...TARGET);
    camera.position.set(
      target.x + Math.sin(az) * Math.cos(ISO_ELEVATION) * dist,
      target.y + Math.sin(ISO_ELEVATION) * dist,
      target.z + Math.cos(az) * Math.cos(ISO_ELEVATION) * dist,
    );
    camera.lookAt(target);
    camera.zoom = roomZoom(size.width, size.height);
    camera.updateProjectionMatrix();
  }, [camera, size.width, size.height]);
  // Pin the pixel size rather than letting it ride the office view's zoom.
  useFrame(() => reportZoomFraction(0));
  return null;
}

/**
 * The portlet on the desk, as the office itself would describe it.
 *
 * The card above its head is NOT rebuilt here - AgentModel draws its own, the
 * same one the floor plan upstairs shows, with the confidence ring, the job
 * title under the name, the autonomy mode and when it last ran. A second
 * hand-rolled card was one more thing to keep in step with a component that
 * had already moved on, and it had: it was still the name-and-a-line version
 * from before the standing row existed.
 */
const MACK = {
  label: "Mack",
  jobTitle: "Operations Portlet",
  task: "Raising work orders from last night's dockets",
  autonomy: "act" as const,
  confidence: 94,
  confidenceRuns: 212,
};

function OfficeScene() {
  // "Ran four minutes ago", forever. Stamped once at mount rather than written
  // down as a date: a fixed timestamp would read as minutes ago today and as
  // months ago by spring, on a page whose whole job is to look current. This
  // component is client-only (the landing route lazy-loads it), so reading the
  // clock here costs no hydration mismatch.
  const lastRunAt = useMemo(
    () => new Date(Date.now() - 4 * 60_000).toISOString(),
    [],
  );

  // The two back walls of the corner. Placed rather than derived: this is one
  // fixed room, not an editable floor plan.
  const walls = useMemo(
    () =>
      [
        ...TILES.filter(([, z]) => z === 0).map(
          ([x]) => ({ pos: [x, 0, -0.5] as const, rot: 0 }),
        ),
        ...TILES.filter(([x]) => x === 0).map(
          ([, z]) => ({ pos: [-0.5, 0, z] as const, rot: Math.PI / 2 }),
        ),
      ],
    [],
  );

  return (
    <>
      <StaticCamera />
      <PixelArtRenderer />
      <Lights />
      <Floor tiles={TILES} />
      <GroundShadow center={CENTRE} />

      {walls.map((w) => (
        <group key={`${w.pos[0]},${w.pos[2]},${w.rot}`} position={w.pos as unknown as [number, number, number]} rotation={[0, w.rot, 0]}>
          <WallModel />
        </group>
      ))}

      {/* The desk, off-centre and turned a quarter from front-on. */}
      <group position={[1, 0, 1]} rotation={[0, DESK_YAW, 0]}>
        <DeskModel occupied screenOn />
        <group position={[0, 0, 0.18]}>
          <AgentModel
            sprite="otto"
            workerId="landing-workspace-demo"
            status="working"
            pose="sit"
            yaw={Math.PI}
            showLabel
            label={MACK.label}
            jobTitle={MACK.jobTitle}
            task={MACK.task}
            autonomy={MACK.autonomy}
            confidence={MACK.confidence}
            confidenceRuns={MACK.confidenceRuns}
            lastRunAt={lastRunAt}
          />
        </group>
      </group>

      {/* Decoration. Enough that it reads as somebody's office rather than a
          prop on a white page, arranged so nothing occludes the desk from
          this one fixed angle. */}
      <group position={[0, 0, 0]}>
        <BookshelfModel />
      </group>
      <group position={[2, 0, 0]} rotation={[0, 0, 0]}>
        <WhiteboardModel />
      </group>
      <group position={[3, 0, 0]}>
        <CoffeeModel />
      </group>
      <group position={[0, 0, 2]}>
        <PlantModel />
      </group>
      <group position={[3, 0, 2]}>
        <PlantModel />
      </group>
      <group position={[0, 0, 1]}>
        <LampModel />
      </group>

    </>
  );
}

/** Default export so the landing route can lazy-load the whole three.js chunk. */
export default function WorkspaceDemo() {
  return (
    <div
      className="ws-demo"
      aria-label="A Portara agent working at a desk in its own office"
    >
      <Canvas
        orthographic
        shadows="basic"
        dpr={1}
        gl={{ antialias: false, alpha: true }}
        camera={{ zoom: 120, position: [20, 20, 20], near: -100, far: 400 }}
        style={{ touchAction: "none" }}
        /* MEASURE THE LAYOUT BOX, NOT THE PAINTED ONE.
           Unlike the other vignettes, this room lives inside the tour's world,
           and that world is under a CSS transform - the whole 1240px page is
           scaled to whatever the section is wide, which on a phone is about a
           third. r3f measures with getBoundingClientRect by default, which
           reports the TRANSFORMED size, so the renderer was told the canvas
           was 350px wide while it was still being laid out at 1024.
           The room itself survived that (everything scaled together), but the
           agent's HUD card did not: drei positions it by projecting into
           `size` and then writes the result into a div living in the canvas's
           untransformed layout, so the card sat at a fraction of its correct
           offset - a fraction that changed with the width of the browser. Off
           by a tenth on a wide desktop, off by two thirds on a handset.
           offsetSize reads offsetWidth/offsetHeight instead, which transforms
           do not touch, so every number in here is the same on every screen
           and the compositor does the scaling - which is the one thing it is
           actually good at. */
        resize={{ offsetSize: true }}
      >
        <OfficeScene />
      </Canvas>
    </div>
  );
}
