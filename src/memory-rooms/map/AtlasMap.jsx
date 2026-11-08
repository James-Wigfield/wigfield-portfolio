/* The base map: water, Mexico (faint context), Canada + the lower 48 as land with
   hairline borders, and (when zoomed in) quiet labels for the trip's places.
   Overlays are passed as children and drawn in screen pixels (dots never scale). */

import { useMemo } from 'react';
import { mapLayers, onMap, project } from './geo.js';
import { PLACES } from './places.js';

const LABEL_MIN_K = 2.2;
const CHAR_W = 6.4; // IBM Plex Mono 10px + tracking
const LABEL_H = 12;
const EDGE = 6;

const hitsCircle = (box, c) => {
  const nx = Math.max(box.x0, Math.min(c.x, box.x1));
  const ny = Math.max(box.y0, Math.min(c.y, box.y1));
  return Math.hypot(c.x - nx, c.y - ny) < c.r;
};
const hitsBox = (a, b) => a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;

/**
 * Place labels that stay inside the map, flip to the left near the right edge,
 * and step out past any spot marker sitting on (or near) the place.
 * avoid: [{ x, y, r }] screen circles (spot dots, clusters) labels must not cover.
 */
function PlaceLabels({ t, size, avoid }) {
  const placed = useMemo(() => {
    if (t.k < LABEL_MIN_K) return [];
    const boxes = [];
    const out = [];
    for (const p of PLACES) {
      if (!onMap(p)) continue;
      const [wx, wy] = project(p.lat, p.lng);
      const x = wx * t.s + t.tx;
      const y = wy * t.s + t.ty;
      if (x < 0 || y < 0 || x > size.w || y > size.h) continue;
      const marker = avoid.find((a) => Math.hypot(a.x - x, a.y - y) < a.r + 4);
      const off = marker ? marker.r + 5 + Math.hypot(marker.x - x, marker.y - y) : 6;
      const w = p.label.length * CHAR_W;
      const y0 = y - LABEL_H / 2;
      const y1 = y + LABEL_H / 2;
      const sides = [
        { side: 'right', box: { x0: x + off - 2, x1: x + off + w + 2, y0, y1 } },
        { side: 'left', box: { x0: x - off - w - 2, x1: x - off + 2, y0, y1 } },
      ];
      const fit = sides.find(
        ({ box }) =>
          box.x0 >= EDGE &&
          box.x1 <= size.w - EDGE &&
          box.y0 >= EDGE &&
          box.y1 <= size.h - EDGE &&
          !boxes.some((b) => hitsBox(b, box)) &&
          !avoid.some((a) => a !== marker && hitsCircle(box, a)),
      );
      if (!fit) continue;
      boxes.push(fit.box);
      out.push({ label: p.label, x, y, dot: !marker, side: fit.side, tx: fit.side === 'right' ? x + off : x - off });
    }
    return out;
  }, [t, size, avoid]);

  return (
    <g className="mr-atlas-places" aria-hidden="true">
      {placed.map((p) => (
        <g key={p.label}>
          {p.dot && <circle cx={p.x.toFixed(1)} cy={p.y.toFixed(1)} r={1.6} />}
          <text x={p.tx.toFixed(1)} y={p.y.toFixed(1)} dy="0.32em" textAnchor={p.side === 'right' ? 'start' : 'end'}>
            {p.label}
          </text>
        </g>
      ))}
    </g>
  );
}

const NO_AVOID = [];

/**
 * vp: the useMapViewport() object. onBackgroundTap({ x, y }) fires for taps on land or water.
 * dataMr / label: automation hook + accessible name for the <svg>.
 */
export default function AtlasMap({ vp, dataMr, label, onBackgroundTap, labels = true, avoid = NO_AVOID, className = '', children }) {
  const layers = mapLayers();
  const { size, t, setContainer, setSvg, bind, wasDrag } = vp;

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
          {labels && <PlaceLabels t={t} size={size} avoid={avoid} />}
          {children}
        </svg>
      )}
    </div>
  );
}
