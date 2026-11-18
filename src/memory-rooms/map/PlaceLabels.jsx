/* Quiet labels for the trip's places (places.js), drawn in screen pixels over either
   map engine. They stay inside the map, flip to the left near the right edge, and
   step out past any spot marker sitting on (or near) the place. */

import { useMemo } from 'react';
import { PLACES } from './places.js';

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
 * toScreen(place) → { x, y } in container pixels, or null to skip it (off this map, behind the globe).
 * avoid: [{ x, y, r }] screen circles (spot dots, clusters) labels must not cover.
 * show: false draws nothing (zoomed out too far, or the base map's own labels have taken over).
 */
export default function PlaceLabels({ toScreen, size, avoid, show = true }) {
  const placed = useMemo(() => {
    if (!show) return [];
    const boxes = [];
    const out = [];
    for (const p of PLACES) {
      const pt = toScreen(p);
      if (!pt) continue;
      const { x, y } = pt;
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
  }, [toScreen, size, avoid, show]);

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
