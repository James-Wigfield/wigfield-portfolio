import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

import { DESK, UI3D } from "./palette";
import { toonGradient } from "./pixel-art";

/* ── Dotted connection line ──────────────────────────────────────────────
   Shared by the landing page's 3D vignettes (security, integrations): a
   run of small toon-shaded dots tracing a curve, revealed lengthwise by a
   per-frame progress ref. Dots pop in with a little overshoot as the
   reveal front sweeps past them; optional refs layer on a travelling
   green data pulse (`flow`) or a red throb at a severed tip (`alarm`). */

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
/** Ease-out-back - each dot pops slightly past size, then settles. */
function easeOutBack(u: number) {
  if (u <= 0) return 0;
  if (u >= 1) return 1;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = u - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

export function DottedLine({
  curve,
  progress,
  flow,
  alarm,
  count = 30,
  // Charcoal, like the desk hardware - reads crisply on the light page.
  color = DESK.side,
}: {
  curve: THREE.CatmullRomCurve3;
  /** Ref holding the revealed fraction, 0..1, written by the timeline. */
  progress: React.MutableRefObject<number>;
  /** Ref: while true, a green data pulse washes along the line. */
  flow?: React.MutableRefObject<boolean>;
  /** Ref: while true, the dots nearest the (cut) tip pulse red. */
  alarm?: React.MutableRefObject<boolean>;
  /** Number of dots - scale with curve length to keep density uniform. */
  count?: number;
  color?: string;
}) {
  const points = useMemo(() => curve.getSpacedPoints(count - 1), [curve, count]);
  const mesh = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const base = useMemo(() => new THREE.Color(color), [color]);
  const glow = useMemo(() => new THREE.Color(UI3D.valid), []);
  const warn = useMemo(() => new THREE.Color(UI3D.invalid), []);
  const scratch = useMemo(() => new THREE.Color(), []);

  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const reveal = clamp01(progress.current) * count;
    const flowing = !!flow?.current;
    const alarming = !!alarm?.current;
    for (let i = 0; i < count; i++) {
      // Each dot pops as the reveal front sweeps past its index.
      let s = easeOutBack(clamp01(reveal - i));
      scratch.copy(base);
      if (flowing && s >= 1) {
        const wave = Math.sin(t * 5 - i * 0.55);
        if (wave > 0.55) {
          const mix = (wave - 0.55) / 0.45;
          s *= 1 + 0.5 * mix;
          scratch.lerp(glow, mix);
        }
      } else if (alarming && s > 0) {
        // Refused: the line is cut dead, and the dots at the severed end
        // throb red - strongest at the tip, fading back along the line.
        const fromTip = reveal - i;
        if (fromTip < 6) {
          const near = 1 - fromTip / 6;
          const throb = 0.55 + 0.45 * Math.sin(t * 6);
          scratch.lerp(warn, near * throb);
          s *= 1 + 0.45 * near * throb;
        }
      }
      dummy.position.copy(points[i]);
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.current.setMatrixAt(i, dummy.matrix);
      mesh.current.setColorAt(i, scratch);
    }
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor) mesh.current.instanceColor.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[undefined, undefined, count]} castShadow>
      <sphereGeometry args={[0.038, 8, 6]} />
      <meshToonMaterial gradientMap={toonGradient()} />
    </instancedMesh>
  );
}
