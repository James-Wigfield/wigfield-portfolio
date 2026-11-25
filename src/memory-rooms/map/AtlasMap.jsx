/* The base map: water, the world's land (the home view's coast finer), hairline country
   and US state borders, and (zoomed in past a continent) quiet labels for the gazetteer's
   places. Overlays are passed as children and drawn in screen pixels (dots never scale). */

import { useCallback } from 'react';
import PlaceLabels from './PlaceLabels.jsx';
import { invert, mapLayers, onMap, project } from './geo.js';
import { atlasZoom } from './markers.js';
import { zoomForSpan } from './mapbox/project.js';

/** Place labels show once less than this much longitude is in view (as on the globe). */
const LABEL_SPAN_DEG = 28;

const NO_AVOID = [];

/** "lat,lng" at the middle of the view (for checks and debugging). */
function centerOf(t, size) {
  const ll = invert((size.w / 2 - t.tx) / t.s, (size.h / 2 - t.ty) / t.s);
  return ll ? `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}` : undefined;
}

/**
 * vp: the useMapViewport() object. onBackgroundTap({ x, y }) fires for taps on land or water.
 * dataMr / label: automation hook + accessible name for the <svg>.
 */
export default function AtlasMap({ vp, dataMr, label, onBackgroundTap, labels = true, avoid = NO_AVOID, className = '', children }) {
  const layers = mapLayers();
  const { size, t, setContainer, setSvg, bind, wasDrag } = vp;
  const toScreen = useCallback(
    (p) => {
      if (!t || !onMap(p)) return null;
      const [wx, wy] = project(p.lat, p.lng);
      return { x: wx * t.s + t.tx, y: wy * t.s + t.ty };
    },
    [t],
  );

  const onClick = (e) => {
    if (wasDrag() || !onBackgroundTap) return;
    if (!e.target.closest?.('[data-bg]')) return;
    const r = e.currentTarget.getBoundingClientRect();
    onBackgroundTap({ x: e.clientX - r.left, y: e.clientY - r.top });
  };

  return (
    <div className={`mr-atlas ${className}`} ref={setContainer}>
      {t && (
        <svg
          ref={setSvg}
          className="mr-atlas-svg"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          data-mr={dataMr}
          data-zoom={t.k.toFixed(2)}
          data-center={centerOf(t, size)}
          role="group"
          aria-label={label}
          onClick={onClick}
          {...bind}
        >
          <rect className="mr-atlas-water" width={size.w} height={size.h} data-bg="" />
          <g data-bg="" transform={`translate(${t.tx} ${t.ty}) scale(${t.s})`}>
            <path className="mr-atlas-land" d={layers.land} />
            <path className="mr-atlas-land" d={layers.detail} />
            <path className="mr-atlas-states" d={layers.states} />
            <path className="mr-atlas-borders" d={layers.borders} />
          </g>
          {labels && <PlaceLabels toScreen={toScreen} size={size} avoid={avoid} show={atlasZoom(t.s) >= zoomForSpan(size.w, LABEL_SPAN_DEG)} />}
          {children}
        </svg>
      )}
    </div>
  );
}
