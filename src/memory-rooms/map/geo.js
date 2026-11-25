/* The SVG atlas's one projection and its layers, built once per page load.

   A world map (2026-11-25; until then a conic of North America): Web Mercator, scaled so
   the whole world is 1000 units wide, the same projection as the Mapbox globe at a zoom,
   so a view converts exactly between the engines (markers.js atlasZoom). Paths are
   computed once in these "world" units; every zoom / resize is just an SVG transform.

   The home view (k = 1, zoom.js) is map/start.js START: Perth at metro level. */

import { geoArea, geoMercator, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';
import atlas from './atlas.json';
import { START } from './start.js';

/** World units across the whole map (both engines agree: Mapbox's 512 px world = this many units). */
export const WORLD_UNITS = 1000;
/** Mercator runs off to infinity at the poles: the map stops here. */
const MAX_LAT = 80;

const projection = geoMercator()
  .scale(WORLD_UNITS / (2 * Math.PI))
  .translate([WORLD_UNITS / 2, WORLD_UNITS / 2]);

const boxOf = ([[ax, ay], [bx, by]]) => ({ x: ax, y: ay, w: bx - ax, h: by - ay });
const pt = (lng, lat) => projection([lng, lat]);

/** The home-view box in world units: START's bounds. */
export const WORLD = (() => {
  const [[w, s], [e, n]] = START.bounds;
  return boxOf([pt(w, n), pt(e, s)]);
})();
/** How far the map may be panned: the whole world between ±80° latitude. */
export const PAN = boxOf([pt(-180, MAX_LAT), pt(180, -MAX_LAT)]);

export const project = (lat, lng) => projection([lng, lat]);
export function invert(x, y) {
  const p = projection.invert([x, y]);
  return p ? { lat: p[1], lng: p[0] } : null;
}

export const hasCoords = (s) => Number.isFinite(s?.lat) && Number.isFinite(s?.lng);
/** Whether a place can be drawn on the atlas: anywhere with coordinates short of the poles. */
export const onMap = (s) => hasCoords(s) && Math.abs(s.lat) <= MAX_LAT;

/* polygon-clipping (build-atlas.mjs) writes GeoJSON's counter-clockwise outer rings; d3-geo reads rings on
   the sphere and wants them clockwise, else a polygon means "everything except this". Flip any polygon that
   claims more than half the globe. */
function d3Winding(f) {
  const g = f.geometry || f;
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : null;
  if (!polys) return f;
  const fixed = polys.map((rings) => (geoArea({ type: 'Polygon', coordinates: rings }) > 2 * Math.PI ? rings.map((r) => [...r].reverse()) : rings));
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: fixed } };
}

let layers = null;
/** SVG path strings in world units (cached). */
export function mapLayers() {
  if (layers) return layers;
  const path = geoPath(projection).digits(3);
  const fine = geoPath(projection).digits(5); // the home view's coast is ~1/400 of the world: keep its steps
  const { world, detail } = atlas;
  layers = {
    land: path(d3Winding(feature(world, world.objects.land))),
    detail: fine(d3Winding(feature(detail, detail.objects.detail))),
    borders: path(mesh(world, world.objects.borders)),
    states: path(mesh(world, world.objects.states)),
  };
  return layers;
}
