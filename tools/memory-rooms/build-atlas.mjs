#!/usr/bin/env node
/* Builds the map's one committed TopoJSON: src/memory-rooms/map/atlas.json.

     node tools/memory-rooms/build-atlas.mjs

   Sources (devDependencies, Natural Earth / US Census via their packages):
     us-atlas/states-10m.json     → the lower 48 + DC (Alaska, Hawaii and territories dropped)
     world-atlas/countries-50m    → Canada (id 124), clipped to south of 60.5°N and west of 52°W,
                                    which keeps BC, Alberta and the border but not the Arctic islands
     world-atlas/countries-50m    → Mexico (484), clipped to north of 24°N, drawn as faint context
                                    so the southern border doesn't end in the void
   Output objects: states (name), canada, mexico. Target < 250 KB. */

import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { feature } from 'topojson-client';
import { topology } from 'topojson-server';
import { presimplify, simplify, quantile } from 'topojson-simplify';
import polygonClipping from 'polygon-clipping';
import { REPO } from './lib/api.mjs';

const require = createRequire(import.meta.url);
const us = require('us-atlas/states-10m.json');
const world = require('world-atlas/countries-50m.json');

const DROP = new Set(['02', '15', '60', '66', '69', '72', '78']); // AK, HI, territories
const states = feature(us, us.objects.states).features
  .filter((f) => !DROP.has(f.id))
  .map((f) => ({ type: 'Feature', id: f.id, properties: { name: f.properties.name }, geometry: f.geometry }));

const countries = feature(world, world.objects.countries).features;
const box = (w, s, e, n) => [[[w, s], [e, s], [e, n], [w, n], [w, s]]];

function clipped(id, name, bbox) {
  const f = countries.find((c) => c.id === id);
  if (!f) throw new Error(`country ${id} missing`);
  const coords = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  const out = polygonClipping.intersection(coords, bbox);
  return { type: 'Feature', id, properties: { name }, geometry: { type: 'MultiPolygon', coordinates: out } };
}
const canada = clipped('124', 'Canada', box(-141.5, 41, -52, 60.5));
const mexico = clipped('484', 'Mexico', box(-118, 24, -86, 33));

let topo = topology({ states: { type: 'FeatureCollection', features: states }, canada, mexico }, 1e5);
topo = presimplify(topo);
const out = path.join(REPO, 'src', 'memory-rooms', 'map', 'atlas.json');
fs.mkdirSync(path.dirname(out), { recursive: true });

// Simplify until it fits, keeping as much detail as the budget allows.
// quantile(topo, p) = the weight that RETAINS a fraction p of the points.
for (const keep of [1, 0.6, 0.4, 0.3, 0.2, 0.12, 0.08]) {
  const t = simplify(topo, quantile(topo, keep));
  const text = JSON.stringify(t);
  if (text.length < 240_000 || keep === 0.08) {
    fs.writeFileSync(out, text);
    console.log(`atlas.json: ${(text.length / 1024).toFixed(0)} KB (kept ${keep * 100}% of points), ${states.length} states + Canada + Mexico`);
    break;
  }
}
