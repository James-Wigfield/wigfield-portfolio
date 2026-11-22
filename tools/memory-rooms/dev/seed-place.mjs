#!/usr/bin/env node
/* Copies a REAL built place from its work folder (memory-rooms-work/b-<id>/: row.json, building.json, level GLBs,
   exterior, renders, and the *-empty.glb texture sets when the Worker takes them) into a LOCAL dev Worker under the
   SAME ids, with every room spot that has a work folder (spot.json, scene.json, room.glb, photos/, thumbs/,
   renders/hero.png, room-empty.glb), so the place page, the walk and the checks run on the real house offline.

     node tools/memory-rooms/dev/seed-place.mjs <buildingId | b-folder> [--base http://127.0.0.1:8788]

   Local Workers only (refuses anything else). Re-running updates the same rows. Nothing touches the live site. */

import fs from 'node:fs';
import path from 'node:path';
import { client, config, WORK } from '../lib/api.mjs';

const args = process.argv.slice(2);
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1] === '--base'));
const cfg = config();
if (args.includes('--base')) cfg.base = args[args.indexOf('--base') + 1].replace(/\/+$/, '');
if (!/127\.0\.0\.1|localhost/.test(cfg.base)) {
  console.error(`Refusing to seed ${cfg.base}: local Workers only.`);
  process.exit(1);
}
if (!target) {
  console.error('usage: node tools/memory-rooms/dev/seed-place.mjs <buildingId | b-folder> [--base http://127.0.0.1:8788]');
  process.exit(2);
}
const dir = fs.existsSync(target) ? path.resolve(target) : path.join(WORK, `b-${target}`);
const id = path.basename(dir).replace(/^b-/, '');
const api = client(cfg);
const ping = await api.ping();
const empty = (ping.features || []).includes('empty');
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'));
const rowFile = path.join(dir, 'row.json');
const live = fs.existsSync(rowFile) ? read(rowFile).data || read(rowFile) : {};
const plan = read(path.join(dir, 'building.json'));

const pick = (o, keys) => Object.fromEntries(keys.filter((k) => o[k] !== undefined).map((k) => [k, o[k]]));
await api.saveBuilding({ id, ...pick(live, ['createdBy', 'title', 'note', 'lat', 'lng', 'locAccuracyM', 'placeLabel', 'locSource', 'capturedAt']), title: live.title || plan.title });
const row = await api.getBuilding(id);
await api.patchBuilding(id, { ...(live.sketch ? { sketch: live.sketch } : {}), plan, ifUpdatedAt: row.updatedAt });
const put = async (type, name, file, contentType) => {
  if (!fs.existsSync(file)) return false;
  await api.putBuildingMedia(id, type, name, fs.readFileSync(file), { contentType });
  console.log(`  ✓ building ${type}/${name}`);
  return true;
};
for (const lv of plan.levels) {
  await put('model', `level-${lv.id}`, path.join(dir, `level-${lv.id}.glb`), 'model/gltf-binary');
  if (empty) await put('model', `level-${lv.id}-empty`, path.join(dir, `level-${lv.id}-empty.glb`), 'model/gltf-binary');
}
await put('model', 'exterior', path.join(dir, 'exterior.glb'), 'model/gltf-binary');
for (const r of ['hero', 'marker']) await put('render', r, path.join(dir, 'renders', `${r}.png`), 'image/png');
await api.patchBuilding(id, { status: 'rendered' });
console.log(`✓ place ${id} "${live.title || plan.title}" → ${cfg.base}/memories/b/${id}`);

for (const room of plan.rooms) {
  for (const sid of room.spotIds || []) {
    const sd = path.join(WORK, sid);
    if (!fs.existsSync(path.join(sd, 'room.glb')) || !fs.existsSync(path.join(sd, 'spot.json'))) continue;
    const s = read(path.join(sd, 'spot.json'));
    const spot = s.data || s;
    await api.saveSpot({ ...pick(spot, ['id', 'createdBy', 'title', 'note', 'kind', 'lat', 'lng', 'locAccuracyM', 'placeLabel', 'locSource', 'scaleHint', 'capturedAt']), buildingId: id, roomId: room.id });
    const scene = read(path.join(sd, 'scene.json'));
    await api.patchSpot(sid, { scene, status: 'rendered', buildingId: id, roomId: room.id });
    const media = [['model', 'room', 'room.glb', 'model/gltf-binary'], ['model', 'map', 'map.glb', 'model/gltf-binary']];
    if ((ping.models || []).includes('empty')) media.push(['model', 'empty', 'room-empty.glb', 'model/gltf-binary']);
    media.push(['render', 'hero', 'renders/hero.png', 'image/png'], ['render', 'marker', 'renders/marker.png', 'image/png']);
    for (const kind of ['photos', 'thumbs']) {
      for (const f of fs.existsSync(path.join(sd, kind)) ? fs.readdirSync(path.join(sd, kind)) : []) {
        if (/^\d+\.jpg$/.test(f)) media.push([kind === 'photos' ? 'photo' : 'thumb', f.replace('.jpg', ''), `${kind}/${f}`, 'image/jpeg']);
      }
    }
    let n = 0;
    for (const [type, name, file, ct] of media) {
      const f = path.join(sd, file);
      if (!fs.existsSync(f)) continue;
      if (type === 'model' && name === 'map' && !(ping.models || []).includes('map')) continue;
      await api.putMedia(sid, type, name, fs.readFileSync(f), { contentType: ct });
      n++;
    }
    console.log(`✓ room ${room.id} → spot ${sid} "${spot.title}" (${n} files) ${cfg.base}/memories/${sid}`);
  }
}
