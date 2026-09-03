import { useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";

import type { FurnitureType } from "../../lib/office-layout";
import { FurnitureModel } from "./models";

/**
 * Bakes a thumbnail image of each furniture model for the tool panel: one
 * tiny hidden canvas renders the pieces one at a time and snapshots each to
 * a data URL, then the whole thing unmounts - no lingering WebGL context,
 * and the panel shows plain <img> tags from then on. The camera matches the
 * floor's isometric angle, so the preview looks exactly like the placed
 * piece.
 */
const SIZE = 112; // render size in px (displayed smaller, so it's crisp)

/** Per-piece framing: rough model height (world units) plus a scale that
    fills the frame - short pieces are blown up, tall ones reined in. The
    group is dropped by half the scaled height, and `zc` (the model's centre
    along its tile depth) is cancelled out too: wall-hugging pieces like the
    shelf, board and server are built at the BACK edge of their tile, which
    would otherwise park them off-centre in the iso thumbnail. */
const FRAMES: Partial<
  Record<FurnitureType, { height: number; scale: number; zc: number }>
> = {
  desk: { height: 0.9, scale: 1.15, zc: -0.05 },
  plant: { height: 0.75, scale: 1.35, zc: 0 },
  beanbag: { height: 0.4, scale: 1.35, zc: -0.03 },
  bookshelf: { height: 1.05, scale: 1.25, zc: -0.14 },
  coffee: { height: 0.62, scale: 1.35, zc: -0.15 },
  lamp: { height: 1.2, scale: 1.1, zc: 0 },
  whiteboard: { height: 0.95, scale: 1.3, zc: -0.1 },
  server: { height: 1.0, scale: 1.3, zc: -0.16 },
};

function Snapshot({
  children,
  onShot,
}: {
  children: React.ReactNode;
  onShot: (url: string) => void;
}) {
  const { gl } = useThree();
  const frames = useRef(0);
  const shot = useRef(false);
  useFrame(() => {
    // A couple of warm-up frames so materials/shadows settle before capture.
    frames.current += 1;
    if (frames.current >= 3 && !shot.current) {
      shot.current = true;
      onShot(gl.domElement.toDataURL("image/png"));
    }
  });
  return <>{children}</>;
}

export function ToolPreviewBaker({
  types,
  onBaked,
}: {
  types: FurnitureType[];
  onBaked: (urls: Partial<Record<FurnitureType, string>>) => void;
}) {
  const [index, setIndex] = useState(0);
  const urls = useRef<Partial<Record<FurnitureType, string>>>({});
  const type = types[index];
  if (!type) return null;

  return (
    <div
      aria-hidden="true"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: SIZE,
        height: SIZE,
        opacity: 0,
        pointerEvents: "none",
        overflow: "hidden",
      }}
    >
      <Canvas
        orthographic
        dpr={1}
        gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
        camera={{ zoom: 54, position: [10, 10, 10], near: -100, far: 400 }}
        onCreated={({ camera }) => camera.lookAt(0, 0, 0)}
      >
        <ambientLight intensity={1.15} />
        <directionalLight position={[4, 8, 2]} intensity={1.4} />
        <directionalLight position={[-6, 4, -3]} intensity={0.4} />
        <Snapshot
          key={type}
          onShot={(url) => {
            urls.current[type] = url;
            if (index + 1 >= types.length) onBaked({ ...urls.current });
            setIndex((i) => i + 1);
          }}
        >
          {(() => {
            const f = FRAMES[type] ?? { height: 0.9, scale: 1.2, zc: 0 };
            return (
              <group
                scale={f.scale}
                position={[0, -(f.height * f.scale) / 2, -f.zc * f.scale]}
              >
                <FurnitureModel type={type} ghost={null} />
              </group>
            );
          })()}
        </Snapshot>
      </Canvas>
    </div>
  );
}
