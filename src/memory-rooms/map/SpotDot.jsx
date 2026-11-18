/* One spot on the map. Ring = captured, half-filled = modelling, filled = rendered.
   Colours come from --mr-status-* via currentColor (see .mr-spot in the CSS).
   A rendered spot whose marker image is ready stands as that image instead (SpotMarker);
   a cluster holding rendered spots fans up to three of them behind its number. */

import { COPY } from '../copy.js';
import { clusterRadius } from './clusters.js';
import { FAN_LIFT, fanBox, fanSlot, markerBox } from './markers.js';

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

/**
 * A rendered spot standing on the map as its marker image (point.marker from markers.js
 * withMarkers): the image's bottom centre on the location, a contact shadow under it, and a
 * ring on the ground when selected or focused. The same button as a SpotDot.
 */
export function SpotMarker({ point, marker, selected, onActivate, shadowId, hover = false, passThrough = false }) {
  const { spot, x, y } = point;
  const { w, h } = marker;
  const b = markerBox(marker);
  // the cut-out's base (floor or ground plate) centres about a fifth of its width above the
  // image's bottom edge: shadow and ring sit there, behind the image
  const cy = -w * 0.1;
  return (
    <g
      className="mr-mapspot mr-marker"
      transform={`translate(${x.toFixed(1)} ${y.toFixed(1)})`}
      data-mr="spot-dot"
      data-id={spot.id}
      data-status={spot.status}
      data-marker={marker.from}
      data-w={Math.round(w)}
      data-hover={hover ? '' : undefined}
      data-pass={passThrough ? '' : undefined}
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
      <ellipse className="mr-marker-shadow" cy={cy} rx={w * 0.52} ry={w * 0.17} fill={`url(#${shadowId})`} />
      <ellipse className="mr-marker-ring" cy={cy} rx={w * 0.58} ry={w * 0.2} />
      <image className="mr-marker-img" href={marker.url} x={-w / 2} y={-h} width={w} height={h} />
      <rect className="mr-mapspot-hit" x={b.x0} y={b.y0} width={b.x1 - b.x0} height={b.y1 - b.y0} />
    </g>
  );
}

/**
 * A rendered spot standing as its live 3D model (drawn by the map's WebGL layer, mapbox/models3d.js,
 * under this overlay): an invisible button over the model's screen box (point.model.box). The ring
 * on the ground for selected / keyboard-focused is drawn in 3D, so onFocusChange reports focus.
 */
export function SpotModel({ point, model, selected, onActivate, onFocusChange, hover = false, passThrough = false }) {
  const { spot } = point;
  const { box } = model;
  return (
    <g
      className="mr-mapspot mr-model"
      data-mr="spot-dot"
      data-id={spot.id}
      data-status={spot.status}
      data-model={model.lod ? 'map' : 'room'}
      data-hover={hover ? '' : undefined}
      data-pass={passThrough ? '' : undefined}
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
      onFocus={(e) => onFocusChange?.(e.currentTarget.matches(':focus-visible') ? spot.id : null)}
      onBlur={() => onFocusChange?.(null)}
    >
      <rect className="mr-mapspot-hit" x={box.x0} y={box.y0} width={box.x1 - box.x0} height={box.y1 - box.y0} />
    </g>
  );
}

/** Fan cards drawn outside-in, so the middle one sits on top. */
const fanOrder = (n) => [...Array(n).keys()].sort((a, b) => Math.abs(b - (n - 1) / 2) - Math.abs(a - (n - 1) / 2));

export function ClusterDot({ item, selected, onActivate, base = 11, hover = false, passThrough = false }) {
  const n = item.members.length;
  const r = clusterRadius(n, base);
  const fan = item.fan || null;
  const fb = fan ? fanBox(fan, r) : null;
  return (
    <g
      className="mr-cluster"
      transform={`translate(${item.x.toFixed(1)} ${item.y.toFixed(1)})`}
      data-mr="cluster"
      data-count={n}
      data-ids={item.members.map((m) => m.id).join(',')}
      data-fan={fan ? fan.length : undefined}
      data-hover={hover ? '' : undefined}
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
      {fan && (
        <g className="mr-cluster-fan" aria-hidden="true">
          {fanOrder(fan.length).map((i) => {
            const f = fan[i];
            const { dx, rot } = fanSlot(i, fan.length, f.w);
            return (
              <image
                key={f.id}
                href={f.url}
                x={-f.w / 2}
                y={-f.h}
                width={f.w}
                height={f.h}
                transform={`translate(${dx.toFixed(1)} ${(-r * FAN_LIFT).toFixed(1)}) rotate(${rot})`}
              />
            );
          })}
        </g>
      )}
      {fb && !passThrough && <rect className="mr-mapspot-hit" x={fb.x0} y={fb.y0} width={fb.x1 - fb.x0} height={fb.y1 - fb.y0} />}
      <circle className="mr-mapspot-hit" r={Math.max(22, r + 6)} />
      {selected && <circle className="mr-mapspot-ring" r={r + 5} />}
      <circle className="mr-cluster-disc" r={r} />
      <text className="mr-cluster-n" textAnchor="middle" dy="0.35em">
        {n}
      </text>
    </g>
  );
}
