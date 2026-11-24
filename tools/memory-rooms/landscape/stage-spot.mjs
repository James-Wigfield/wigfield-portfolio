#!/usr/bin/env node
/* Stage a built landscape (build_landscape.py --bake) as a Memory Rooms spot, ready for push.mjs.

     node tools/memory-rooms/landscape/stage-spot.mjs <landscape work dir> [--id <spotId>] [--create]
         [--title "Point Peron"] [--note "…"] [--place "Rockingham, WA"] [--live]

   --create makes the spot first (POST /api/memories/spots: an exterior with the landscape's centre as its location,
   no photos). A non-local Worker needs --live. Then writes memory-rooms-work/<id>/: room.glb (= landscape.glb),
   scene.json (an exterior whose site.terrain is the diorama block), renders/hero.png (+ the other renders) and
   prints the push command. */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { client, config, workDir } from '../lib/api.mjs';

const argv = process.argv.slice(2);
const flag = (n) => argv.includes(`--${n}`);
const opt = (n, d) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : d);
const src = path.resolve(argv[0] || '');
if (!argv[0] || !fs.existsSync(path.join(src, 'landscape.glb'))) {
  console.error('usage: stage-spot.mjs <landscape work dir with landscape.glb> [--id id] [--create] [--live]');
  process.exit(2);
}
const grid = JSON.parse(fs.readFileSync(path.join(src, 'grid.json'), 'utf8'));
const report = JSON.parse(fs.readFileSync(path.join(src, 'bake', 'report.json'), 'utf8'));
const [x0, x1, y0, y1] = report.bounds;
const top = Math.ceil(grid.h_range[1] * (report.vexag || 1) + 12); // + the lookout pylons and the battery's tripod

let id = opt('id');
if (flag('create')) {
  const { base } = config();
  const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(base);
  if (!local && !flag('live')) {
    console.error(`${base} is not a local Worker: pass --live to create the spot there.`);
    process.exit(1);
  }
  id = id || crypto.randomUUID();
  const [lng, lat] = grid.centre_lnglat;
  const spot = {
    id,
    createdBy: 'james',
    kind: 'exterior',
    title: opt('title', 'Point Peron'),
    note: opt('note', 'Point Peron, Rockingham: the headland, its reefs and the Garden Island Causeway, built from open elevation and satellite data.'),
    lat: Number(lat.toFixed(6)),
    lng: Number(lng.toFixed(6)),
    placeLabel: opt('place', 'Rockingham, WA'),
    locSource: 'typed',
    capturedAt: new Date().toISOString(),
  };
  const res = await client().saveSpot(spot);
  console.log('created spot', id, res?.data?.title ?? '');
}
if (!id) {
  console.error('no spot: pass --id <spotId> or --create');
  process.exit(2);
}

const dir = workDir(id);
fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
fs.copyFileSync(path.join(src, 'landscape.glb'), path.join(dir, 'room.glb'));
for (const f of fs.readdirSync(path.join(src, 'renders'))) {
  if (/\.png$/.test(f) && !/^sheet/.test(f)) fs.copyFileSync(path.join(src, 'renders', f), path.join(dir, 'renders', f));
}
const scene = {
  version: 1,
  kind: 'exterior',
  title: opt('title', 'Point Peron'),
  notes: 'Landscape diorama (tools/memory-rooms/landscape): terrain from the AWS open terrain tiles (Terrarium z15), coastline, roads, paths and buildings from OpenStreetMap, colour from Copernicus Sentinel-2 L2A ' + grid.s2 + ', cliffs / beaches and landmarks from aerial photos. Sea floor depth is modelled, not surveyed.',
  site: {
    ground: { finish: 'sand', size: [2, 2] },
    terrain: {
      size: [Math.round((x1 - x0) * 10) / 10, Math.round((y1 - y0) * 10) / 10],
      heights: [report.base_z, top],
      vexag: report.vexag || 1,
      sources: [
        'Elevation: Terrarium terrain tiles (AWS Open Data, Mapzen / Tilezen)',
        '© OpenStreetMap contributors (ODbL)',
        `Contains modified Copernicus Sentinel data ${grid.s2.slice(0, 4)}`,
      ],
    },
  },
  objects: [],
  cameras: [],
};
fs.writeFileSync(path.join(dir, 'scene.json'), JSON.stringify(scene, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'spot.json'), JSON.stringify({ id, landscape: src }, null, 2) + '\n');
console.log(`staged ${dir}\n  room.glb ${(fs.statSync(path.join(dir, 'room.glb')).size / 1e6).toFixed(2)} MB\nnext: node tools/memory-rooms/push.mjs ${id}`);
