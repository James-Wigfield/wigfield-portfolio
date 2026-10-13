import { mediaUrl, useMediaVersion } from '../../../engine/media';

/* ============================================================================
   VERDICT DECK — N8, OPTION F TOURED BY ZOOM (never redrawn)
   ----------------------------------------------------------------------------
   figures/architecture-option-f.svg (the dissertation's Figure 3.3) shown as
   an image through a fixed viewport. Each build step moves a camera (one CSS
   transform) onto one region of the figure, 1.75 to 2.5 times the size of
   the whole-figure view, and rings that region. Regions are in the figure's
   own units (viewBox 409.888 x 419.525). Nothing is veiled or redrawn.
     step 0  the whole figure
     step 1  the three deep stages and their sequence lengths
     step 2  the organ head, "training only", with the output beside it
     step 3  one Mamba block: six orders, summed
   ========================================================================== */

const VB = { w: 409.888, h: 419.525 };
const STOPS = [
  null,
  { ring: { x: 0, y: 197, w: 302, h: 97 }, z: 2.3 },
  { ring: { x: 196, y: 12, w: 82, h: 46 }, z: 2.5 },
  { ring: { x: 2, y: 302, w: 405, h: 103 }, z: 1.75 },
];

function camera(stop, W, H, s0) {
  const fw = VB.w * s0;
  const fh = VB.h * s0;
  if (!stop) return { tx: (W - fw) / 2, ty: (H - fh) / 2, z: 1 };
  const { ring, z } = stop;
  const k = s0 * z;
  const clamp = (t, size, view) => (size <= view ? (view - size) / 2 : Math.min(0, Math.max(view - size, t)));
  const tx = clamp(W / 2 - (ring.x + ring.w / 2) * k, fw * z, W);
  const ty = clamp(H / 2 - (ring.y + ring.h / 2) * k, fh * z, H);
  return { tx, ty, z };
}

export default function FigureReveal({ step, width, height }) {
  useMediaVersion();
  const s0 = height / VB.h; // whole figure fits the height
  const stop = STOPS[Math.min(step, STOPS.length - 1)];
  const cam = camera(stop, width, height, s0);
  const ring = stop?.ring ?? { x: 0, y: 0, w: VB.w, h: VB.h };
  return (
    <div className="d2-figzoom" style={{ width, height }}>
      <div className="d2-figzoom__cam" style={{ width: VB.w * s0, height: VB.h * s0, transform: `translate(${cam.tx}px, ${cam.ty}px) scale(${cam.z})` }}>
        <img src={mediaUrl('figures/architecture-option-f.svg')} width={VB.w * s0} height={VB.h * s0} alt="The hybrid CNN-Mamba network (dissertation Figure 3.3): five stages, Mamba blocks in the deepest three, an organ head used in training only, and one Mamba block reading six scan orders" draggable="false" />
        <svg className={`d2-figzoom__ring${stop ? ' is-on' : ''}`} width={VB.w * s0} height={VB.h * s0} viewBox={`0 0 ${VB.w} ${VB.h}`} aria-hidden="true">
          <rect rx="4" style={{ x: `${ring.x}px`, y: `${ring.y}px`, width: `${ring.w}px`, height: `${ring.h}px`, strokeWidth: `${2.6 / (stop ? stop.z : 1)}px` }} />
        </svg>
      </div>
    </div>
  );
}
