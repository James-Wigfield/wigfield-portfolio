/* A plan diagram of where to stand for each photo. Shots 1–4 are needed, 5–6 are
   optional (dashed). The next shot to take is lit (accent cone), taken shots go
   quiet, later ones are outlines. Interior: four corners shooting across, the
   detail, then wide from the door (door on the bottom wall). Exterior: four
   sides, wide with context, one detail. */

import { COPY } from '../copy.js';

const NEEDED = 4;

const INTERIOR = {
  cams: [
    { x: 38, y: 30, dir: [1, 0.72] },
    { x: 122, y: 30, dir: [-1, 0.72] },
    { x: 122, y: 84, dir: [-1, -0.72] },
    { x: 38, y: 84, dir: [1, -0.72] },
    { x: 90, y: 60, dir: [0.9, -1], reach: 13 },
    { x: 80, y: 109, dir: [0, -1], spread: 34, reach: 20 },
  ],
  // outside the room, clear of the walls
  labels: [
    [18, 10],
    [142, 10],
    [142, 104],
    [18, 104],
    [80, 66],
    [93, 112],
  ],
};

const EXTERIOR = {
  cams: [
    { x: 80, y: 98, dir: [0, -1] },
    { x: 120, y: 58, dir: [-1, 0] },
    { x: 80, y: 18, dir: [0, 1] },
    { x: 40, y: 58, dir: [1, 0] },
    { x: 140, y: 106, dir: [-1, -0.8], spread: 34, reach: 24 },
    { x: 91, y: 90, dir: [-0.15, -1], reach: 9 },
  ],
  labels: [
    [68, 104],
    [131, 47],
    [68, 11],
    [29, 47],
    [151, 98],
    [101, 94],
  ],
};

function cone({ x, y, dir, spread = 24, reach = 17 }) {
  const a = Math.atan2(dir[1], dir[0]);
  const s = (spread * Math.PI) / 180;
  const p1 = [x + Math.cos(a - s) * reach, y + Math.sin(a - s) * reach];
  const p2 = [x + Math.cos(a + s) * reach, y + Math.sin(a + s) * reach];
  return `M${x} ${y} L${p1[0].toFixed(2)} ${p1[1].toFixed(2)} A${reach} ${reach} 0 0 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)} Z`;
}

function Room() {
  return (
    <g className="mr-guide-plan">
      <path d="M70 96 H26 V18 H134 V96 H90" />
      <path className="mr-guide-door" d="M70 96 V76 A20 20 0 0 1 90 96" />
      <rect className="mr-guide-thing" x="98" y="36" width="14" height="10" />
    </g>
  );
}

function Building() {
  return (
    <g className="mr-guide-plan">
      <rect className="mr-guide-block" x="60" y="38" width="40" height="40" />
      <path className="mr-guide-door" d="M74 78 h12" />
      <path className="mr-guide-street" d="M6 118 H154" />
      <circle className="mr-guide-thing" cx="89" cy="78" r="2.2" />
    </g>
  );
}

/** next = index (0-based) of the shot to take now; ≥ 6 means the guided set is done. */
export default function ShotGuide({ kind, next }) {
  const spec = kind === 'exterior' ? EXTERIOR : INTERIOR;
  return (
    <figure className="mr-guide-wrap">
      <svg className="mr-guide" viewBox="0 0 160 124" role="img" aria-hidden="true" data-mr="shot-guide" data-next={next}>
        {kind === 'exterior' ? <Building /> : <Room />}
        {spec.cams.map((c, i) => {
          const state = i < next ? 'done' : i === next ? 'next' : 'todo';
          return (
            <g key={i} className="mr-guide-cam" data-state={state} data-optional={i >= NEEDED ? '' : undefined}>
              {state !== 'done' && <path className="mr-guide-cone" d={cone(c)} />}
              <circle cx={c.x} cy={c.y} r={state === 'next' ? 3.8 : 2.8} />
              <text x={spec.labels[i][0]} y={spec.labels[i][1]} textAnchor="middle" dy="0.35em">
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption className="mr-guide-key">
        <span className="mr-label">{COPY.capture.guideNeeded}</span>
        <span className="mr-label mr-guide-key-opt">{COPY.capture.guideOptional}</span>
      </figcaption>
    </figure>
  );
}
