/* The map's one projection and its layers, built once per page load.

   "World" coordinates = the projection fitted to a fixed 1000-unit-wide box, so
   the paths are computed once and every zoom/resize is just an SVG transform.
   Conic conformal (parallels 33/45, centred on 96°W), fitted to the lower 48 plus
   southern BC and Alberta (Banff 51.2°N). */

import { geoArea, geoConicConformal, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import atlas from './atlas.json';

/** The box the home view fits (lon/lat). */
export const FIT_EXTENT = { west: -126, east: -66, south: 24, north: 52 };
/** Where a spot still counts as "on the map" (the drawn area); outside → Elsewhere. */
export const ON_MAP = { west: -141, east: -52, south: 18, north: 60.5 };

function boundary({ west, east, south, north }) {
  const pts = [];
  for (let x = west; x <= east; x += 1) pts.push([x, south], [x, north]);
  for (let y = south; y <= north; y += 1) pts.push([west, y], [east, y]);
  return { type: 'MultiPoint', coordinates: pts };
}

const projection = geoConicConformal().parallels([33, 45]).rotate([96, 0]);
projection.fitWidth(1000, boundary(FIT_EXTENT));

const boxOf = ([[ax, ay], [bx, by]]) => ({ x: ax, y: ay, w: bx - ax, h: by - ay });

/* The home view frames the trip: the lower 48 plus southern BC and Alberta
   (Victoria, Lake Louise, Calgary), not the whole clipped Canada. */
const TRIP_AREA = {
  type: 'FeatureCollection',
  features: [
    feature(atlas, atlas.objects.states),
    { type: 'Feature', geometry: { type: 'MultiPoint', coordinates: [[-123.6, 48.4], [-116.4, 51.5], [-113.9, 51.2]] } },
  ].flatMap((f) => (f.type === 'FeatureCollection' ? f.features : [f])),
};
/** The home-view box in world units. */
export const WORLD = boxOf(geoPath(projection).bounds(TRIP_AREA));
/** How far the map may be panned: everything drawn (US, clipped Canada, Mexico). */
export const PAN = boxOf(geoPath(projection).bounds(boundary(ON_MAP)));

export const project = (lat, lng) => projection([lng, lat]);
export function invert(x, y) {
  const p = projection.invert([x, y]);
  return p ? { lat: p[1], lng: p[0] } : null;
}

export const hasCoords = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng);
export const onMap = (s) =>
  hasCoords(s) && s.lat >= ON_MAP.south && s.lat <= ON_MAP.north && s.lng >= ON_MAP.west && s.lng <= ON_MAP.east;

/* The clipped Canada/Mexico shapes come out of polygon-clipping with GeoJSON's
   counter-clockwise outer rings; d3-geo reads rings on the sphere and wants them
   clockwise, else a polygon means "everything except this". Flip any polygon
   that claims more than half the globe. */
function d3Winding(f) {
  const g = f.geometry;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
  if (!polys) return f;
  const fixed = polys.map((rings) =>
    geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings,
  );
  return { ...f, geometry: { type: 'MultiPolygon', coordinates: fixed } };
}

/* Long straight edges (the 49th parallel, the Arizona border) are lines of latitude,
   but d3 would draw them as great circles that bow away from the US states' edges.
   Insert points every half degree so they follow the parallel. */
function densify(f, step = 0.5) {
  const ring = (r) => {
    if (r.length < 2) return r;
    const out = [];
    for (let i = 0; i < r.length - 1; i++) {
      const [x0, y0] = r[i];
      const [x1, y1] = r[i + 1];
      const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) / step);
      for (let j = 0; j < n; j++) out.push([x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n]);
    }
    out.push(r[r.length - 1]);
    return out;
  };
  const polys = f.geometry.coordinates.map((p) => p.map(ring).filter((r) => r.length >= 4)).filter((p) => p.length);
  return { ...f, geometry: { ...f.geometry, coordinates: polys } };
}

let layers = null;
/** SVG path strings in world units (cached). */
export function mapLayers() {
  if (layers) return layers;
  const path = geoPath(projection).digits(3);
  const states = atlas.objects.states;
  layers = {
    land: path(feature(atlas, states)),
    stateBorders: path(mesh(atlas, states, (a, b) => a !== b)),
    usOutline: path(mesh(atlas, states, (a, b) => a === b)),
    canada: path(densify(d3Winding(feature(atlas, atlas.objects.canada)))),
    mexico: path(densify(d3Winding(feature(atlas, atlas.objects.mexico)))),
  };
  return layers;
}
