/* Screen maths for the Mapbox maps: lng/lat → container pixels (null on the far side
   of the globe), metres ↔ pixels at a zoom, and bounds. Pure, apart from map.project(). */

import { distanceM } from '../places.js';

const RAD = Math.PI / 180;
const EARTH_M = 2 * Math.PI * 6371008.8;
const WORLD_PX = 512; // Mapbox GL's world size at zoom 0

/** Angle between two { lat, lng } points at the centre of the earth, in degrees. */
export function centralAngle(a, b) {
  const c = Math.sin(a.lat * RAD) * Math.sin(b.lat * RAD) + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.cos((b.lng - a.lng) * RAD);
  return Math.acos(Math.min(1, Math.max(-1, c))) / RAD;
}

/**
 * Container pixels for { lat, lng }, or null when it's further than `margin` px off the
 * map or on the far side of the globe. (A far-side point still projects onto the disc;
 * going back from that pixel lands on the near side, somewhere else.)
 */
export function toScreen(map, ll, size, margin = 0) {
  const p = map.project([ll.lng, ll.lat]);
  if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
  if (p.x < -margin || p.y < -margin || p.x > size.w + margin || p.y > size.h + margin) return null;
  const back = map.unproject(p);
  if (!back || centralAngle(ll, { lat: back.lat, lng: back.lng }) > 0.5) return null;
  return { x: p.x, y: p.y };
}

/** Pixels per metre at a latitude and zoom (Web Mercator; the globe matches it at the centre). */
export const pxPerMetre = (lat, zoom) => (WORLD_PX * 2 ** zoom) / (EARTH_M * Math.max(0.01, Math.cos(lat * RAD)));

/** The zoom at which `metres` covers `px` pixels at `lat`. */
export const zoomForPx = (metres, px, lat) => Math.log2(px / (Math.max(metres, 1e-3) * pxPerMetre(lat, 0)));

/** The zoom at which a w-pixel-wide map shows `deg` degrees of longitude. */
export const zoomForSpan = (w, deg) => Math.log2((w * 360) / (WORLD_PX * deg));

/** [[w, s], [e, n]] around some { lat, lng } points. */
export function boundsOf(points) {
  let w = Infinity;
  let s = Infinity;
  let e = -Infinity;
  let n = -Infinity;
  for (const p of points) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** Closest pair distance in metres (from one point, or over all pairs). */
export function nearestM(points, from) {
  let d = Infinity;
  for (const a of from ? [from] : points) {
    for (const b of points) if (a !== b && a.id !== b.id) d = Math.min(d, distanceM(a, b));
  }
  return d;
}

/** Diagonal of the points' bounding box, in metres. */
export function spanM(points) {
  const [[w, s], [e, n]] = boundsOf(points);
  return distanceM({ lat: s, lng: w }, { lat: n, lng: e });
}
