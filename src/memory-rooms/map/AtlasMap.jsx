/* The base map: water, Mexico (faint context), Canada + the lower 48 as land with
   hairline borders, and (when zoomed in) quiet labels for the trip's places.
   Overlays are passed as children and drawn in screen pixels (dots never scale). */

import { useCallback } from 'react';
import PlaceLabels from './PlaceLabels.jsx';
import { mapLayers, onMap, project } from './geo.js';

const LABEL_MIN_K = 2.2;

const NO_AVOID = [];

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
          role="group"
          aria-label={label}
          onClick={onClick}
          {...bind}
        >
          <rect className="mr-atlas-water" width={size.w} height={size.h} data-bg="" />
          <g data-bg="" transform={`translate(${t.tx} ${t.ty}) scale(${t.s})`}>
            <path className="mr-atlas-mexico" d={layers.mexico} />
            <path className="mr-atlas-canada" d={layers.canada} />
            <path className="mr-atlas-land" d={layers.land} />
            <path className="mr-atlas-borders" d={layers.stateBorders} />
            <path className="mr-atlas-coast" d={layers.usOutline} />
          </g>
          {labels && <PlaceLabels toScreen={toScreen} size={size} avoid={avoid} show={t.k >= LABEL_MIN_K} />}
          {children}
        </svg>
      )}
    </div>
  );
}
