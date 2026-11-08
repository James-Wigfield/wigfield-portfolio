/* One spot on the map. Ring = captured, half-filled = modelling, filled = rendered.
   Colours come from --mr-status-* via currentColor (see .mr-spot in the CSS). */

import { COPY } from '../copy.js';
import { clusterRadius } from './clusters.js';

const R = 5.5;
const half = (r) => `M0 ${-r} A${r} ${r} 0 0 0 0 ${r} Z`; // left half-disc

function onKey(fn) {
  return (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
}

export function StatusGlyph({ status, r = R }) {
  return (
    <g className="mr-glyph" data-status={status}>
      <circle className="mr-glyph-base" r={r} />
      {status === 'modelling' && <path className="mr-glyph-fill" d={half(r)} />}
    </g>
  );
}

/** r: glyph radius (bigger on phones). */
export function SpotDot({ point, selected, onActivate, r = R }) {
  const { spot, x, y } = point;
  return (
    <g
      className="mr-mapspot"
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      data-mr="spot-dot"
      data-id={spot.id}
      data-status={spot.status}
      data-selected={selected ? '' : undefined}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${spot.title}, ${COPY.app.status[spot.status] || spot.status}`}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onKeyDown={onKey(onActivate)}
    >
      <circle className="mr-mapspot-hit" r={Math.max(18, r + 12)} />
      {selected && <circle className="mr-mapspot-ring" r={r + 6} />}
      <circle className="mr-mapspot-halo" r={r + 2.5} />
      <StatusGlyph status={spot.status} r={r} />
    </g>
  );
}

export function ClusterDot({ item, selected, onActivate, base = 11 }) {
  const n = item.members.length;
  const r = clusterRadius(n, base);
  return (
    <g
      className="mr-cluster"
      transform={`translate(${item.x.toFixed(1)} ${item.y.toFixed(1)})`}
      data-mr="cluster"
      data-count={n}
      data-ids={item.members.map((m) => m.id).join(',')}
      data-selected={selected ? '' : undefined}
      role="button"
      tabIndex={0}
      aria-label={COPY.map.cluster(n)}
      onClick={(e) => {
        e.stopPropagation();
        onActivate();
      }}
      onKeyDown={onKey(onActivate)}
    >
      <circle className="mr-mapspot-hit" r={Math.max(22, r + 6)} />
      {selected && <circle className="mr-mapspot-ring" r={r + 5} />}
      <circle className="mr-cluster-disc" r={r} />
      <text className="mr-cluster-n" textAnchor="middle" dy="0.35em">
        {n}
      </text>
    </g>
  );
}
