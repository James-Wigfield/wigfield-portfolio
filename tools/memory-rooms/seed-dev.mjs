#!/usr/bin/env node
/* Seeds a LOCAL dev Worker with demo spots so the map, list and viewer have
   something to show. Never point this at production.

     node tools/memory-rooms/seed-dev.mjs [--base http://127.0.0.1:8788] [--examples-only]

   --examples-only seeds just the two rendered example spots (bedroom, diner).

   Ids are derived from the titles, so re-running updates the same spots.
   Rendered demo spots use the best GLB/renders available for the example scenes:
     memory-rooms-work/_dev/<bedroom|diner>/room.glb (+ renders/) if the Blender pipeline has run,
     else memory-rooms-work/_fixtures/<…>/fixture-boxes.glb. */

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { client, config, REPO } from './lib/api.mjs';

const args = process.argv.slice(2);
const cfg = config();
if (args.includes('--base')) cfg.base = args[args.indexOf('--base') + 1].replace(/\/+$/, '');
if (!/127\.0\.0\.1|localhost/.test(cfg.base) && !args.includes('--i-mean-it')) {
  console.error(`Refusing to seed ${cfg.base}: seed-dev is for local Workers only.`);
  process.exit(1);
}
const api = client(cfg);

const uuidFor = (s) => {
  const h = crypto.createHash('sha1').update(`memory-rooms-seed:${s}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`;
};

const SPOTS = [
  { title: 'Front bedroom (example)', kind: 'interior', by: 'james', lat: 40.7306, lng: -73.9866, place: 'New York, NY', note: 'Where the whole trip got planned.', status: 'rendered', example: 'bedroom', scale: 'small room', day: '2026-12-17' },
  { title: 'Corner diner (example)', kind: 'exterior', by: 'justin', lat: 32.7157, lng: -117.1611, place: 'San Diego, CA', note: 'Waited an hour for a table, worth it.', status: 'rendered', example: 'diner', scale: 'big building', day: '2027-01-03' },
  { title: 'Hostel common room', kind: 'interior', by: 'justin', lat: 40.7243, lng: -73.9927, place: 'New York, NY', note: 'Met the Danish crew here on night one.', status: 'captured', scale: 'big room', day: '2026-12-16' },
  { title: 'Moraine Lake lookout', kind: 'exterior', by: 'james', lat: 51.3217, lng: -116.1860, place: 'Lake Louise, AB', note: 'Minus 24 and still worth the walk.', status: 'captured', scale: 'free: a lookout over the lake', day: '2026-12-22' },
  { title: 'Banff cabin', kind: 'interior', by: 'justin', lat: 51.1784, lng: -115.5708, place: 'Banff, AB', note: 'Christmas Eve, fire going, cards out.', status: 'modelling', scale: 'small room', day: '2026-12-24' },
  { title: 'Calgary bar', kind: 'interior', by: 'james', lat: 51.0447, lng: -114.0719, place: 'Calgary, AB', note: 'The bartender taught us a card trick.', status: 'captured', scale: 'hall', day: '2026-12-20' },
  { title: 'Big Sur pull-off', kind: 'exterior', by: 'james', lat: 36.2704, lng: -121.8081, place: 'Big Sur, CA', note: 'Pulled over and nobody said anything for ten minutes.', status: 'captured', scale: 'big building', day: '2027-01-06' },
  { title: 'Santa Barbara pier', kind: 'exterior', by: 'justin', lat: 34.4100, lng: -119.6856, place: 'Santa Barbara, CA', note: 'Fish tacos on the pier at sunset.', status: 'modelling', scale: 'big building', day: '2027-01-05' },
  { title: 'Frenchmen Street', kind: 'exterior', by: 'james', lat: 29.9644, lng: -90.0577, place: 'New Orleans, LA', note: 'Brass band on the corner, danced like idiots.', status: 'captured', scale: 'big building', day: '2027-01-09' },
  { title: 'Miami motel room', kind: 'interior', by: 'justin', lat: 25.7907, lng: -80.1300, place: 'Miami Beach, FL', note: 'Last night of the trip.', status: 'captured', scale: 'small room', day: '2027-01-14' },
  { title: 'Home: study', kind: 'interior', by: 'james', lat: -31.9523, lng: 115.8613, place: 'Perth, WA', note: 'The test room before we left.', status: 'captured', scale: 'small room', day: '2026-11-08' },
];

async function placeholderJpeg(label, i, w = 1536, h = 2048, hue = 30) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="hsl(${hue},25%,${70 - i * 4}%)"/><stop offset="1" stop-color="hsl(${hue + 20},30%,${38 - i * 2}%)"/></linearGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/>
    <text x="80" y="${h - 140}" font-family="Segoe UI, Arial" font-size="72" fill="#fff" opacity="0.9">${label}</text>
    <text x="80" y="${h - 60}" font-family="Consolas, monospace" font-size="44" fill="#fff" opacity="0.7">PHOTO ${i}</text></svg>`;
  return sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
}
const thumbOf = (buf) => sharp(buf).resize({ width: 480, height: 480, fit: 'inside' }).jpeg({ quality: 78 }).toBuffer();

function exampleAssets(name) {
  const dev = path.join(REPO, 'memory-rooms-work', '_dev', name);
  const fixture = path.join(REPO, 'memory-rooms-work', '_fixtures', name);
  const glb = [path.join(dev, 'room.glb'), path.join(fixture, 'fixture-boxes.glb')].find((p) => fs.existsSync(p));
  const renders = path.join(dev, 'renders');
  return { glb, renders: fs.existsSync(renders) ? renders : null };
}

let n = 0;
const onlyExamples = args.includes('--examples-only');
for (const [idx, s] of SPOTS.entries()) {
  if (onlyExamples && !s.example) continue;
  const id = uuidFor(s.title);
  await api.saveSpot({
    id, createdBy: s.by, kind: s.kind, title: s.title, note: s.note,
    lat: s.lat, lng: s.lng, locAccuracyM: 20 + idx, locSource: 'gps', placeLabel: s.place,
    scaleHint: s.scale, capturedAt: `${s.day}T${String(10 + (idx % 9)).padStart(2, '0')}:30:00.000Z`,
  });

  const { renders } = s.example ? exampleAssets(s.example) : {};
  const photoCount = s.kind === 'interior' ? 6 : 6;
  for (let i = 1; i <= photoCount; i++) {
    const real = renders && fs.existsSync(path.join(renders, `cam${i}.png`)) ? path.join(renders, `cam${i}.png`) : null;
    const photo = real
      ? await sharp(real).jpeg({ quality: 85 }).toBuffer()
      : await placeholderJpeg(s.title, i, s.kind === 'interior' ? 1536 : 2048, s.kind === 'interior' ? 2048 : 1536, (idx * 37) % 360);
    const meta = await sharp(photo).metadata();
    await api.putMedia(id, 'photo', i, photo, { contentType: 'image/jpeg', width: meta.width, height: meta.height });
    const thumb = await thumbOf(photo);
    const tm = await sharp(thumb).metadata();
    await api.putMedia(id, 'thumb', i, thumb, { contentType: 'image/jpeg', width: tm.width, height: tm.height });
  }

  if (s.example) {
    const scene = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'memory-rooms', 'examples', `${s.example}.scene.json`), 'utf8'));
    await api.patchSpot(id, { scene });
    const { glb, renders: r } = exampleAssets(s.example);
    if (glb) await api.putMedia(id, 'model', 'room', fs.readFileSync(glb), { contentType: 'model/gltf-binary' });
    if (r) {
      for (const f of fs.readdirSync(r).filter((f) => /^[a-z0-9-]+\.png$/.test(f))) {
        await api.putMedia(id, 'render', f.replace(/\.png$/, ''), fs.readFileSync(path.join(r, f)), { contentType: 'image/png' });
      }
    }
  }
  await api.patchSpot(id, { status: s.status });
  n++;
  console.log(`seeded ${s.status.padEnd(9)} ${s.title}  ${id}`);
}
console.log(`\n${n} spots seeded at ${cfg.base}`);
