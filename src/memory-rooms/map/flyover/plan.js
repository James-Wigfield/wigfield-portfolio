/* The trip flyover's route, as plain data (no map, no React): every spot with a
   location, in the order it was captured, and the great-circle arcs between them.

     const stops = flightStops(spots);                 // [{ id, lat, lng, spot, rendered, at }]
     const legs = flightLegs(stops);                   // legs[i] = the arc INTO stops[i] (legs[0] = null)
     routeCoords(legs, i, t)                           // the route flown so far: every leg up to stop i,
                                                       // the leg into stop i drawn to fraction t (0–1)
*/

import { hasCoords } from '../geo.js';
import { roomModelOf } from '../../lib/spots.js';

/** A hop longer than this pulls the camera out to the globe on the way (WA → the USA). */
export const LONG_HOP_KM = 1500;
const EARTH_KM = 6371;
const RAD = Math.PI / 180;

const when = (s) => String(s.capturedAt || s.createdAt || '');

/** Spots with a location, oldest capture first (ties: created, then id, so the order never wobbles). */
export function flightStops(spots) {
  return spots
    .filter(hasCoords)
    .slice()
    .sort((a, b) => when(a).localeCompare(when(b)) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')) || String(a.id).localeCompare(String(b.id)))
    .map((spot) => ({
      id: spot.id,
      lat: spot.lat,
      lng: spot.lng,
      spot,
      at: when(spot),
      rendered: spot.status === 'rendered' && Boolean(roomModelOf(spot)),
    }));
}

/** Great-circle distance in km. */
export function distanceKm(a, b) {
  const p1 = a.lat * RAD;
  const p2 = b.lat * RAD;
  const dp = p2 - p1;
  const dl = (b.lng - a.lng) * RAD;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Points along the great circle from a to b ([lng, lat] pairs), longitudes unwrapped so the line never jumps 360°. */
export function arc(a, b, steps) {
  const toV = (p) => {
    const la = p.lat * RAD;
    const lo = p.lng * RAD;
    return [Math.cos(la) * Math.cos(lo), Math.cos(la) * Math.sin(lo), Math.sin(la)];
  };
  const va = toV(a);
  const vb = toV(b);
  const dot = Math.max(-1, Math.min(1, va[0] * vb[0] + va[1] * vb[1] + va[2] * vb[2]));
  const omega = Math.acos(dot);
  const n = steps ?? Math.max(2, Math.min(96, Math.ceil((omega / RAD) * 2)));
  const out = [];
  let prevLng = null;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    let v;
    if (omega < 1e-9) v = va;
    else {
      const s = Math.sin(omega);
      const k1 = Math.sin((1 - t) * omega) / s;
      const k2 = Math.sin(t * omega) / s;
      v = [k1 * va[0] + k2 * vb[0], k1 * va[1] + k2 * vb[1], k1 * va[2] + k2 * vb[2]];
    }
    const lat = Math.atan2(v[2], Math.hypot(v[0], v[1])) / RAD;
    let lng = Math.atan2(v[1], v[0]) / RAD;
    if (prevLng != null) {
      while (lng - prevLng > 180) lng -= 360;
      while (lng - prevLng < -180) lng += 360;
    }
    prevLng = lng;
    out.push([lng, lat]);
  }
  return out;
}

/** legs[i]: { coords, km, long } for the hop into stops[i]; legs[0] is null (the first stop has no way in). */
export function flightLegs(stops) {
  return stops.map((s, i) => {
    if (i === 0) return null;
    const prev = stops[i - 1];
    const km = distanceKm(prev, s);
    return { coords: arc(prev, s), km, long: km > LONG_HOP_KM };
  });
}

/** The first `t` of a polyline (t 0–1 of its points, interpolating the last segment). */
function partial(coords, t) {
  if (t >= 1) return coords;
  if (t <= 0 || coords.length < 2) return coords.slice(0, 1);
  const f = t * (coords.length - 1);
  const i = Math.floor(f);
  const r = f - i;
  const a = coords[i];
  const b = coords[i + 1];
  return [...coords.slice(0, i + 1), [a[0] + (b[0] - a[0]) * r, a[1] + (b[1] - a[1]) * r]];
}

/** Line strings for the route so far: every leg into stops 1..index, the last one to fraction t. */
export function routeCoords(legs, index, t = 1) {
  const lines = [];
  for (let i = 1; i <= index && i < legs.length; i++) {
    const leg = legs[i];
    if (!leg) continue;
    const coords = i === index ? partial(leg.coords, t) : leg.coords;
    if (coords.length > 1) lines.push(coords);
  }
  return lines;
}

/** GeoJSON for a Mapbox line source. */
export function routeGeoJSON(lines) {
  return { type: 'FeatureCollection', features: lines.map((coordinates) => ({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates } })) };
}
