#!/usr/bin/env node
/* Extra LOCAL dev data for the viewer pages (run after seed-dev.mjs):
     - "Kitchen (example)": a second interior in frame group `example-flat`, east
       of the example bedroom, status modelling, scene but no GLB, so it is
       both the layout-preview test spot and the group page's second room.
     - a sample Spark .spz on the bedroom as its `scan` (Model/Scan toggle).

     MEMORIES_API=http://127.0.0.1:8794 MEMORIES_PASSWORD=trip-local node tools/memory-rooms/dev-viewer/setup-dev.mjs

   The .spz is Spark's public sample (sparkjs.dev/assets/splats/butterfly.spz),
   downloaded to memory-rooms-work/_fixtures/scan/. Not a room, but it exercises
   the whole scan path (signed url, Spark load, bounds, orientation). */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { client, config, REPO } from '../lib/api.mjs';

const cfg = config();
if (!/127\.0\.0\.1|localhost/.test(cfg.base)) {
  console.error(`Refusing to touch ${cfg.base}: local Workers only.`);
  process.exit(1);
}
const api = client(cfg);

const uuidFor = (s) => {
  const h = crypto.createHash('sha1').update(`memory-rooms-seed:${s}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};
const BEDROOM = uuidFor('Front bedroom (example)');
const KITCHEN = uuidFor('Kitchen (example)');

const kitchen = {
  version: 1,
  kind: 'interior',
  title: 'Kitchen (example)',
  notes: 'Dev fixture for the viewer: second room of example-flat, east of the bedroom, sharing its door.',
  shell: {
    width: 2.8, depth: 4.1, height: 2.7,
    floor: { finish: 'tile', color: '#cfc8bb' },
    walls: { finish: 'paint', color: '#e4e8e1', thickness: 0.12 },
    ceiling: { show: true, color: '#f3f1ea' },
    openings: [
      { wall: 'west', type: 'door', offset: 3.1, width: 0.82, height: 2.04, color: '#f4f1ea' },
      { wall: 'south', type: 'window', offset: 0.8, width: 1.2, height: 1.1, sill: 1.0, color: '#f4f1ea' },
      { wall: 'east', type: 'window', offset: 1.2, width: 1.0, height: 1.2, sill: 0.95, color: '#f4f1ea' },
    ],
  },
  objects: [
    { id: 'counter', kit: 'counter', size: [2.8, 0.92, 0.62], at: [1.4, 0, 0.31], rotY: 0, color: '#8d9a8a', accent: '#e9e4d8', material: 'oak' },
    { id: 'uppers', kit: 'cabinet', size: [1.6, 0.7, 0.35], at: [1.6, 1.5, 0.175], rotY: 0, color: '#8d9a8a', mount: 'wall' },
    { id: 'fridge', kit: 'fridge', size: [0.7, 1.8, 0.7], at: [2.42, 0, 1.05], rotY: 270, color: '#d9dcd8', material: 'metal' },
    { id: 'table', kit: 'table', size: [1.1, 0.75, 0.75], at: [1.2, 0, 2.6], rotY: 0, color: '#a07850', material: 'oak' },
    { id: 'chair-a', kit: 'chair', size: [0.44, 0.86, 0.48], at: [0.85, 0, 3.15], rotY: 180, color: '#3f4a5c', overlaps: ['table'] },
    { id: 'chair-b', kit: 'chair', size: [0.44, 0.86, 0.48], at: [1.55, 0, 2.05], rotY: 0, color: '#3f4a5c', overlaps: ['table'] },
    { id: 'pendant', kit: 'pendant', size: [0.32, 0.4, 0.32], at: [1.2, 2.2, 2.6], color: '#e8dcc4', mount: 'ceiling' },
    { id: 'plant', kit: 'plant', size: [0.35, 0.7, 0.35], at: [2.5, 0, 3.8], color: '#4f7a4a', accent: '#b56a45' },
  ],
  pins: [{ at: [1.2, 0.9, 2.6], text: 'Pancakes at 2 am after the show', photo: 1 }],
  cameras: [{ photo: 1, pos: [0.35, 1.5, 3.8], look: [2.0, 0.9, 0.6], fov: 70, aspect: 0.75 }],
  frame: { group: 'example-flat', origin: [3.84, 0], rotY: 0 },
};

async function placeholder(i, hue) {
  const w = 1536;
  const h = 2048;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="hsl(${hue},22%,${72 - i * 5}%)"/><stop offset="1" stop-color="hsl(${hue + 20},26%,${40 - i * 3}%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="80" y="${h - 140}" font-family="Segoe UI, Arial" font-size="72" fill="#fff" opacity="0.9">Kitchen (example)</text>
    <text x="80" y="${h - 60}" font-family="Consolas, monospace" font-size="44" fill="#fff" opacity="0.7">PHOTO ${i}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}

await api.saveSpot({
  id: KITCHEN, createdBy: 'james', kind: 'interior', title: 'Kitchen (example)', note: 'Pancakes at 2 am after the show.',
  lat: 40.7309, lng: -73.9871, locAccuracyM: 15, locSource: 'gps', placeLabel: 'New York, NY',
  scaleHint: 'small room', capturedAt: '2026-12-18T02:10:00.000Z',
});
for (let i = 1; i <= 3; i++) {
  const photo = await placeholder(i, 140);
  await api.putMedia(KITCHEN, 'photo', i, photo, { contentType: 'image/jpeg', width: 1536, height: 2048 });
  const thumb = await sharp(photo).resize({ width: 360 }).jpeg({ quality: 78 }).toBuffer();
  await api.putMedia(KITCHEN, 'thumb', i, thumb, { contentType: 'image/jpeg', width: 360, height: 480 });
}
await api.patchSpot(KITCHEN, { scene: kitchen });
await api.patchSpot(KITCHEN, { status: 'modelling' });
console.log(`kitchen  ${KITCHEN}  (modelling, scene, no GLB, group example-flat)`);

const spz = path.join(REPO, 'memory-rooms-work', '_fixtures', 'scan', 'butterfly.spz');
if (fs.existsSync(spz)) {
  await api.putMedia(BEDROOM, 'scan', 'scan', fs.readFileSync(spz), { contentType: 'application/octet-stream' });
  console.log(`scan     ${BEDROOM}  (${(fs.statSync(spz).size / 1e6).toFixed(1)} MB sample .spz)`);
} else {
  console.log('scan     skipped: no memory-rooms-work/_fixtures/scan/butterfly.spz');
}
