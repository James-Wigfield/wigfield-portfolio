/* Rendered spots stand on the map as their baked dollhouse cut-out (markerImages.js), anchored
   at the location: the bottom centre of the image sits on the point, over a soft contact
   shadow. True scale is invisible (a 5 m room is ~6 px at zoom 17), so a marker is a diorama
   with a screen size that grows with the zoom: small at country scale, bigger in a city.

   Pure layout over clusterPoints() items, shared by both engines. A spot item whose image
   is ready gets `marker: { url, w, h, from }`; a cluster holding rendered spots gets `fan`,
   up to FAN_MAX of their images, fanned behind its number. */

import { markerImage } from './markerImages.js';
import { clusterRadius } from './clusters.js';

/** Long edge in CSS px at a zoom, linear in zoom between (z0, s0) and (z1, s1). */
const SIZE = {
  wide: { z0: 3, s0: 44, z1: 13, s1: 124 },
  compact: { z0: 2, s0: 36, z1: 13, s1: 100 },
};
/** A cluster's fan cards, as a share of the marker size at that zoom. */
const FAN_SCALE = 0.7;
/** How far above the disc centre the fan cards stand, as a share of the disc radius. */
export const FAN_LIFT = 0.6;
export const FAN_MAX = 3;

/** Marker long edge (CSS px) at a Mapbox zoom. */
export function markerPx(zoom, compact = false) {
  const s = compact ? SIZE.compact : SIZE.wide;
  if (!Number.isFinite(zoom)) return s.s0;
  const t = Math.min(1, Math.max(0, (zoom - s.z0) / (s.z1 - s.z0)));
  return s.s0 + t * (s.s1 - s.s0);
}

/** The atlas drawn at `s` px per world unit, as the Mapbox zoom showing as much longitude.
    (geo.js fits the 60° of FIT_EXTENT into 1000 world units.) */
const DEG_PER_UNIT = 60 / 1000;
export const atlasZoom = (s) => Math.log2((s * 360) / (512 * DEG_PER_UNIT));

const fit = (img, px) => {
  const k = px / Math.max(img.w, img.h, 1);
  return { w: img.w * k, h: img.h * k };
};

/** clusterPoints() items with their marker images laid out at `px` (missing images: plain dots). */
export function withMarkers(items, px) {
  return items.map((it) => {
    if (it.type === 'spot') {
      const img = markerImage(it.point.spot);
      return img ? { ...it, marker: { url: img.url, from: img.from, ...fit(img, px) } } : it;
    }
    const fan = [];
    for (const m of it.members) {
      if (fan.length >= FAN_MAX) break;
      const img = markerImage(m.spot);
      if (img) fan.push({ id: m.id, url: img.url, ...fit(img, px * FAN_SCALE) });
    }
    return fan.length ? { ...it, fan } : it;
  });
}

/** Where a fan card sits: i of n, around the disc (x offset px, rotation deg about its base). */
export function fanSlot(i, n, w) {
  const k = i - (n - 1) / 2;
  return { dx: k * w * 0.46, rot: k * 15 };
}

/** The screen box a marker covers, relative to its anchor point. */
export const markerBox = (m) => ({ x0: -m.w / 2, x1: m.w / 2, y0: -m.h, y1: m.h * 0.08 });

/** The screen box a cluster's fan covers, relative to the cluster centre (r = disc radius). */
export function fanBox(fan, r) {
  let x0 = -r;
  let x1 = r;
  let y0 = -r;
  fan.forEach((f, i) => {
    const { dx } = fanSlot(i, fan.length, f.w);
    x0 = Math.min(x0, dx - f.w * 0.62);
    x1 = Math.max(x1, dx + f.w * 0.62);
    y0 = Math.min(y0, -r * FAN_LIFT - f.h);
  });
  return { x0, x1, y0, y1: r };
}

/** Circles place labels keep clear of: every dot, marker and cluster (with its fan). */
export function avoidOf(items, dotR, clusterBase) {
  return items.map((it) => {
    if (it.type === 'spot') {
      if (it.model) {
        const b = it.model.box;
        return { x: (b.x0 + b.x1) / 2, y: (b.y0 + b.y1) / 2, r: Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 };
      }
      if (!it.marker) return { x: it.point.x, y: it.point.y, r: dotR + 4 };
      return { x: it.point.x, y: it.point.y - it.marker.h / 2, r: Math.max(it.marker.w, it.marker.h) / 2 + 2 };
    }
    const r = clusterRadius(it.members.length, clusterBase) + 3;
    if (!it.fan) return { x: it.x, y: it.y, r };
    const b = fanBox(it.fan, r);
    return { x: it.x + (b.x0 + b.x1) / 2, y: it.y + (b.y0 + b.y1) / 2, r: Math.max(b.x1 - b.x0, b.y1 - b.y0) / 2 };
  });
}
