/* Live 3D dioramas on the Mapbox map (phase 2 of the markers, see ../markers.js): past
   MODEL_ZOOM the baked GLB of each rendered spot on screen stands on the map, drawn by one
   three.js custom layer in Mapbox's own WebGL context (models3d.js, a lazy chunk). Below the
   threshold, or if anything fails, the spot is its marker image again.

   This file is the cheap part the map always loads: thresholds, sizes, and which spots get a
   model. No three.js here. */

import { mapModelOf } from '../../lib/spots.js';

/** Models appear at this zoom and go again below MODEL_ZOOM_OUT (so a zoom near 15 doesn't flicker). */
export const MODEL_ZOOM = 15;
export const MODEL_ZOOM_OUT = 14.6;
/** The tilt the map eases to when models appear. At it, a diorama shows its hero render's angle. */
export const REST_PITCH = 52;
/** Steepest tilt allowed while models are up (flat, 0, below the threshold). */
export const MAX_PITCH = 60;
/** How many models are live at once. */
export const MODEL_CAP = { compact: 3, wide: 6 };

/** The square a diorama is drawn in (its bounding sphere fits it), CSS px, by zoom. Fixed on
    screen, not true scale: a 5 m room is ~6 px across at zoom 17. */
const SIZE = { wide: { z0: 15, s0: 220, z1: 17, s1: 320 }, compact: { z0: 15, s0: 170, z1: 17, s1: 230 } };

export function modelPx(zoom, compact = false) {
  const s = compact ? SIZE.compact : SIZE.wide;
  const t = Math.min(1, Math.max(0, (zoom - s.z0) / (s.z1 - s.z0)));
  return s.s0 + t * (s.s1 - s.s0);
}

/**
 * The spots that should stand as models: rendered spots with a GLB that are on their own (not in
 * a cluster) and on screen (with a margin, so a small pan doesn't drop one), nearest the centre
 * first, at most MODEL_CAP. → [{ id, spot, lat, lng, url, key, lod }] (key: the file, not its
 * signed link, so a fresh link doesn't reload the model).
 */
export function wantedModels(items, size, zoom, compact) {
  const half = modelPx(zoom, compact) / 2;
  const cx = size.w / 2;
  const cy = size.h / 2;
  const out = [];
  for (const it of items) {
    if (it.type !== 'spot' || it.point.spot.status !== 'rendered') continue;
    const { x, y, spot } = it.point;
    if (x < -half || x > size.w + half || y < -half || y > size.h + half) continue;
    const src = mapModelOf(spot);
    if (!src) continue;
    out.push({ id: spot.id, spot, lat: spot.lat, lng: spot.lng, url: src.media.url, key: `${src.media.r2Key}|${src.media.bytes}`, lod: src.lod, d: Math.hypot(x - cx, y - cy) });
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, compact ? MODEL_CAP.compact : MODEL_CAP.wide);
}
