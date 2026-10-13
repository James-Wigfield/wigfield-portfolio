import { mediaUrl, useMediaVersion } from '../../engine/media';

/* ============================================================================
   PLAIN DECK — SCAN LAYERS
   A layer PNG (PET or CT projection, RGBA, drawn pixel for pixel as the
   dissertation's figures are) placed on the canvas, and the lesion outlines
   over it: one group per region of the mask projection, a faint fill, a white
   casing and the blue edge, as in Figure 2.1.
   ========================================================================== */

export function Layer({ src, box, a, className = '', alt = '' }) {
  useMediaVersion();
  return (
    <img
      className={`dp-layer ${className}`}
      data-a={a}
      src={mediaUrl(src)}
      alt={alt}
      draggable="false"
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
    />
  );
}

/** `pulse`: the index of one lesion whose paths get their own group (data-a "<a>-pulse"). */
export function Outlines({ scan, box, a, pulse = -1, className = '' }) {
  return (
    <svg
      className={`dp-outlines ${className}`}
      style={{ left: box.x, top: box.y, width: box.w, height: box.h }}
      viewBox={`0 0 ${scan.w} ${scan.h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {scan.lesions.map((l, i) => (
        <g key={`${l.cx}-${l.cy}`} data-a={a} className="dp-les">
          <g data-a={i === pulse ? `${a}-pulse` : undefined} className="dp-les">
            <path d={l.d} className="dp-les__fill" />
            <path d={l.d} className="dp-les__casing" />
            <path d={l.d} className="dp-les__edge" />
          </g>
        </g>
      ))}
    </svg>
  );
}
