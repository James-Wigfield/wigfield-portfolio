#!/usr/bin/env node
/* Copies the REAL rendered rooms from memory-rooms-work/<id>/ (pulled + baked by the render
   pipeline: room.glb, scene.json, spot.json, photos/, thumbs/, renders/hero.png) into a LOCAL dev
   Worker as "(local copy)" spots, so the walk page, AR and the map's 3D can be tried on the real
   shapes: the octagon shed, the gable warehouse, the car on its ground plate, the Batcave.

     node tools/memory-rooms/dev/seed-real-rooms.mjs [--base http://127.0.0.1:8788] [--only shed,car]

   Local Workers only (refuses anything else). Ids are derived from the originals, so re-running
   updates the same copies. Nothing is written to the live site. */

import crypto from 'node:crypto';
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
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const api = client(cfg);
const copyId = (id) => {
  const h = crypto.createHash('sha1').update(`memory-rooms-local-copy:${id}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const NICK = { octagon: 'shed', gable: 'warehouse', mazda: 'car' };

const dirs = fs.readdirSync(WORK).filter((d) => /^[0-9a-f]{8}-/.test(d) && fs.existsSync(path.join(WORK, d, 'room.glb')) && fs.existsSync(path.join(WORK, d, 'spot.json')));
let n = 0;
for (const d of dirs) {
  const dir = path.join(WORK, d);
  const spot = JSON.parse(fs.readFileSync(path.join(dir, 'spot.json'), 'utf8'));
  const scene = JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8'));
  const tags = [spot.title.toLowerCase(), ...Object.entries(NICK).filter(([k]) => fs.readdirSync(path.join(dir, 'bespoke')).some((f) => f.includes(k))).map(([, v]) => v)];
  if (only && !only.some((o) => tags.some((t) => t.includes(o)))) continue;
  const id = copyId(spot.id);
  const fields = {
    title: `${spot.title} (local copy)`,
    note: spot.note || 'A local copy of a real spot.',
    kind: spot.kind,
    lat: spot.lat,
    lng: spot.lng,
    locAccuracyM: spot.locAccuracyM ?? null,
    placeLabel: spot.placeLabel ?? null,
    locSource: spot.locSource ?? null,
    scaleHint: spot.scaleHint ?? null,
    capturedAt: spot.capturedAt,
    createdBy: spot.createdBy,
  };
  await api.saveSpot({ id, ...fields });
  await api.patchSpot(id, fields);
  const put = (type, name, file, contentType, extra = {}) => api.putMedia(id, type, name, fs.readFileSync(file), { contentType, ...extra });
  for (const sub of ['photos', 'thumbs']) {
    const folder = path.join(dir, sub);
    if (!fs.existsSync(folder)) continue;
    for (const f of fs.readdirSync(folder).filter((x) => /^\d+\.jpe?g$/i.test(x))) await put(sub === 'photos' ? 'photo' : 'thumb', String(parseInt(f, 10)), path.join(folder, f), 'image/jpeg');
  }
  await put('model', 'room', path.join(dir, 'room.glb'), 'model/gltf-binary');
  if (fs.existsSync(path.join(dir, 'map.glb'))) await put('model', 'map', path.join(dir, 'map.glb'), 'model/gltf-binary');
  for (const r of ['hero', 'marker']) {
    const f = path.join(dir, 'renders', `${r}.png`);
    if (fs.existsSync(f)) await put('render', r, f, 'image/png');
  }
  await api.patchSpot(id, { scene, status: 'rendered' });
  n += 1;
  console.log(`seeded ${id}  ${fields.title}  [${tags.slice(1).join(', ') || spot.kind}]`);
}
console.log(`\n${n} real rooms copied to ${cfg.base}`);
