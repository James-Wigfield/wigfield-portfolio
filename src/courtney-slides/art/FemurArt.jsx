import { useId } from 'react';
import { CANAL, HEAD, OUTLINE, loadPaths, trabeculae } from './femur';

const TRAB = trabeculae();
const PULSES = loadPaths();

/** Proximal femur with trabecular stress lines. Marks: fem-edge, fem-fill, trab, pulse, reticle, tick, load. */
export function FemurArt({ x, y, scale = 1, reticle = true, load = true, className = '' }) {
  const id = useId().replace(/:/g, '');
  const clip = `fc${id}`;
  const fade = `ff${id}`;
  const mask = `fm${id}`;
  const fill = `fg${id}`;
  const ticks = Array.from({ length: 36 }, (_, i) => i * 10);
  return (
    <svg
      className={`cs-femur ${className}`}
      width={640 * scale}
      height={920 * scale}
      viewBox="0 0 640 920"
      style={{ left: x, top: y }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clip}>
          <path d={OUTLINE} />
        </clipPath>
        <linearGradient id={fade} gradientUnits="userSpaceOnUse" x1="0" y1="560" x2="0" y2="900">
          <stop offset="0" stopColor="#fff" />
          <stop offset="1" stopColor="#000" />
        </linearGradient>
        <mask id={mask} maskUnits="userSpaceOnUse" x="-200" y="-200" width="1040" height="1320">
          <rect x="-200" y="-200" width="1040" height="1320" fill={`url(#${fade})`} />
        </mask>
        <radialGradient id={fill} cx="0.3" cy="0.2" r="0.95">
          <stop offset="0" stopColor="#f6eedf" />
          <stop offset="0.55" stopColor="#ece0c9" />
          <stop offset="1" stopColor="#dccaa8" />
        </radialGradient>
      </defs>

      {reticle && (
        <g className="fem-reticle" data-a="reticle">
          <circle cx={HEAD.cx} cy={HEAD.cy} r="150" className="fem-ring" data-a="ring" />
          <circle cx={HEAD.cx} cy={HEAD.cy} r="176" className="fem-ring fem-ring--dash" data-a="ring" />
          {ticks.map((d) => {
            const r = (d * Math.PI) / 180;
            const r0 = d % 90 === 0 ? 176 : 182;
            return (
              <line
                key={d}
                data-a="tick"
                className="fem-tick"
                x1={(HEAD.cx + r0 * Math.cos(r)).toFixed(1)}
                y1={(HEAD.cy + r0 * Math.sin(r)).toFixed(1)}
                x2={(HEAD.cx + 192 * Math.cos(r)).toFixed(1)}
                y2={(HEAD.cy + 192 * Math.sin(r)).toFixed(1)}
              />
            );
          })}
        </g>
      )}

      <g mask={`url(#${mask})`}>
        <path d={OUTLINE} fill={`url(#${fill})`} data-a="fem-fill" />
        <path d={CANAL} className="fem-canal" clipPath={`url(#${clip})`} data-a="fem-fill" />
        <g clipPath={`url(#${clip})`}>
          {TRAB.comp.map((d, i) => <path key={`c${i}`} d={d} className="fem-trab" data-a="trab" />)}
          {TRAB.tens.map((d, i) => <path key={`t${i}`} d={d} className="fem-trab fem-trab--t" data-a="trab" />)}
          {TRAB.sec.map((d, i) => <path key={`s${i}`} d={d} className="fem-trab fem-trab--s" data-a="trab" />)}
          {PULSES.map((d, i) => <path key={`p${i}`} d={d} className="fem-pulse" data-a="pulse" />)}
        </g>
        <path d={OUTLINE} className="fem-edge" data-a="fem-edge" />
      </g>

      {load && (
        <g data-a="load" className="fem-load">
          <line x1={HEAD.cx - 6} y1={-70} x2={HEAD.cx - 6} y2={HEAD.cy - HEAD.r - 18} />
          <path d={`M ${HEAD.cx - 22} ${HEAD.cy - HEAD.r - 34} L ${HEAD.cx - 6} ${HEAD.cy - HEAD.r - 12} L ${HEAD.cx + 10} ${HEAD.cy - HEAD.r - 34}`} />
        </g>
      )}
    </svg>
  );
}
