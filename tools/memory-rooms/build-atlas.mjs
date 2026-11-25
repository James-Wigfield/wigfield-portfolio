#!/usr/bin/env node
/* Builds the map's one committed TopoJSON: src/memory-rooms/map/atlas.json (the SVG atlas, the
   fallback when Mapbox can't run). A world map since 2026-11-25: the map opens on Perth
   (map/start.js), and spots can be anywhere.

     node tools/memory-rooms/build-atlas.mjs

   Sources (devDependencies, Natural Earth / US Census via their packages):
     world-atlas/land-50m        → `land`: every continent, Antarctica cut off at 60°S; minus the DETAIL box
     world-atlas/land-10m        → `detail`: the 10m coast inside the DETAIL box (south-west WA, Perth to
                                   Augusta), so the metro-level home view has a proper coastline
     world-atlas/countries-50m   → `borders`: the lines countries share (a mesh, no polygons)
     us-atlas/states-10m.json    → `states`: the lines the lower 48 + DC share
   Output: { world: topology { land, borders, states }, detail: topology { detail } } (borders + states are lines:
   the country and US state borders). Target < 400 KB. */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { feature, mesh, quantize } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import polygonClipping from 'polygon-clipping';
import { REPO } from './lib/api.mjs';

const require = createRequire(import.meta.url);
const us = require('us-atlas/states-10m.json');
const land50 = require('world-atlas/land-50m.json');
const land10 = require('world-atlas/land-10m.json');
const world = require('world-atlas/countries-50m.json');

/** South-west Western Australia (Geraldton's south to Albany's west): the coast the home view needs. */
const DETAIL = [112.5, -35.8, 119.5, -30.0];
const box = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];
const polysOf = (g) => (g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : []);
const geomsOf = (fc) => (fc.type === 'FeatureCollection' ? fc.features.map((f) => f.geometry) : [fc.geometry ?? fc]);

function multi(coords) {
  return { type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: coords } };
}

// land: the 50m world without Antarctica's interior and without the detail box
const land50f = feature(land50, land50.objects.land);
const landPolys = geomsOf(land50f).flatMap(polysOf);
const noAntarctica = polygonClipping.intersection(landPolys, box(-180, -60, 180, 85));
const land = multi(polygonClipping.difference(noAntarctica, box(...DETAIL)));

// detail: the 10m coast inside the box
const land10f = feature(land10, land10.objects.land);
const near = geomsOf(land10f)
  .flatMap(polysOf)
  .filter((p) => p[0].some(([x, y]) => x >= DETAIL[0] - 1 && x <= DETAIL[2] + 1 && y >= DETAIL[1] - 1 && y <= DETAIL[3] + 1));
const detail = multi(polygonClipping.intersection(near, box(...DETAIL)));

// countries + states: only their shared borders are drawn, so only those lines are kept
const borders = { type: 'Feature', properties: {}, geometry: mesh(world, world.objects.countries, (a, b) => a !== b) };
const DROP = new Set(['02', '15', '60', '66', '69', '72', '78']); // AK, HI, territories
const us48 = { ...us, objects: { states: { ...us.objects.states, geometries: us.objects.states.geometries.filter((g) => !DROP.has(g.id)) } } };
const states = { type: 'Feature', properties: {}, geometry: mesh(us48, us48.objects.states, (a, b) => a !== b) };

const out = path.join(REPO, 'src', 'memory-rooms', 'map', 'atlas.json');
fs.mkdirSync(path.dirname(out), { recursive: true });

/** Simplify a topology to a fraction of its points, then quantize again (presimplify leaves absolute float
    coordinates with a weight on each point: dropping the weights and quantizing is ~10x smaller). */
function shrink(topo, keep, q = 1e5) {
  const simple = simplify(topo, quantile(topo, keep));
  simple.arcs = simple.arcs.map((arc) => arc.map(([x, y]) => [x, y]));
  return quantize(simple, q);
}

// Two topologies in one file: the world (its own simplification budget) and the detail box (quantized over
// its own small bbox, so the coast keeps ~7 m steps instead of the world's ~400 m).
const worldTopo = presimplify(topology({ land, borders, states }));
const detailTopo = presimplify(topology({ detail }));
const detailOut = shrink(detailTopo, 1);
const detailText = JSON.stringify(detailOut);
for (const keep of [1, 0.7, 0.5, 0.4, 0.3, 0.2, 0.12]) {
  const worldOut = shrink(worldTopo, keep);
  const text = JSON.stringify({ world: worldOut, detail: detailOut });
  if (text.length < 400_000 || keep === 0.12) {
    fs.writeFileSync(out, text);
    console.log(`atlas.json: ${(text.length / 1024).toFixed(0)} KB: world land + country and state borders (kept ${keep * 100}% of points), SW WA detail ${(detailText.length / 1024).toFixed(0)} KB`);
    break;
  }
}
