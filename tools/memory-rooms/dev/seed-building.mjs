#!/usr/bin/env node
/* Seeds a LOCAL dev Worker with the synthetic two-level house from building-selftest.mjs, so the building page
   (/memories/b/<id>) has a rendered place to show: the row (sketch from its rooms, plan = building.json), its level
   GLBs + exterior + renders, and the living room as a spot of it (scene + its room.glb slice).

     node tools/memory-rooms/building-selftest.mjs        (once: builds and bakes memory-rooms-work/_building-selftest)
     node tools/memory-rooms/dev/seed-building.mjs [--base http://127.0.0.1:8794]

   Local Workers only (refuses anything else). Re-running updates the same rows. */

import fs from 'node:fs';
import path from 'node:path';
import { client, config, WORK } from '../lib/api.mjs';

const args = process.argv.slice(2);
const cfg = config();
if (args.includes('--base')) cfg.base = args[args.indexOf('--base') + 1].replace(/\/+$/, '');
if (!/127\.0\.0\.1|localhost/.test(cfg.base)) {
  console.error(`Refusing to seed ${cfg.base}: local Workers only.`);
  process.exit(1);
}
const api = client(cfg);
const DIR = path.join(WORK, '_building-selftest');
const BID = '00000000-0000-4000-8000-00000000b001';
const SPOT = '00000000-0000-4000-8000-0000000051a1';
const plan = JSON.parse(fs.readFileSync(path.join(DIR, 'building.json'), 'utf8'));
const living = JSON.parse(fs.readFileSync(path.join(DIR, 'spots', 'living', 'scene.json'), 'utf8'));

const sketch = {
  version: 1,
  levels: plan.levels.map((l) => ({ id: l.id, name: l.name || l.id })),
  rooms: plan.rooms.map((r) => ({ id: r.id, name: r.name || r.id, level: r.level })),
};
const row = {
  id: BID,
  createdBy: 'james',
  title: 'The example house (local)',
  note: 'A synthetic two-level house from the building self-test.',
  lat: plan.geo?.lat ?? 40.6782,
  lng: plan.geo?.lng ?? -73.9442,
  placeLabel: 'Brooklyn, NY',
  locSource: 'typed',
  capturedAt: '2026-12-18T15:00:00.000Z',
  sketch,
};
await api.saveBuilding(row);
let b = await api.getBuilding(BID);
const put = (type, name, file, contentType) => api.putBuildingMedia(BID, type, name, fs.readFileSync(file), { contentType });
for (const lv of plan.levels) {
  await put('model', `level-${lv.id}`, path.join(DIR, `level-${lv.id}.glb`), 'model/gltf-binary');
  for (const r of ['three-quarter', 'top']) {
    const f = path.join(DIR, 'levels', lv.id, 'renders', `${r}.png`);
    if (fs.existsSync(f)) await put('render', `level-${lv.id}-${r}`, f, 'image/png');
  }
}
await put('model', 'exterior', path.join(DIR, 'exterior.glb'), 'model/gltf-binary');
const hero = path.join(DIR, 'levels', plan.levels[0].id, 'renders', 'hero.png');
if (fs.existsSync(hero)) await put('render', 'hero', hero, 'image/png');
b = await api.getBuilding(BID);
const withSpots = { ...plan, rooms: plan.rooms.map((r) => (r.id === 'living' ? { ...r, spotIds: [SPOT] } : r)) };
b = await api.patchBuilding(BID, { plan: withSpots, status: 'rendered', ifUpdatedAt: b.updatedAt });

// the living room as a spot of the place
await api.saveSpot({
  id: SPOT,
  createdBy: 'james',
  kind: 'interior',
  title: 'Living room (example house)',
  note: 'Where the example house keeps its sofa.',
  lat: row.lat,
  lng: row.lng,
  placeLabel: 'Brooklyn, NY',
  locSource: 'typed',
  capturedAt: '2026-12-18T15:20:00.000Z',
  buildingId: BID,
  roomId: 'living',
});
await api.putMedia(SPOT, 'model', 'room', fs.readFileSync(path.join(DIR, 'spots', 'living', 'room.glb')), { contentType: 'model/gltf-binary' });
await api.patchSpot(SPOT, { scene: living, status: 'rendered' });
console.log(`seeded building ${BID} (plan v${b.planVersion}, ${plan.levels.length} levels) + spot ${SPOT} at ${cfg.base}`);
console.log(`open ${cfg.base}/memories/b/${BID}`);
