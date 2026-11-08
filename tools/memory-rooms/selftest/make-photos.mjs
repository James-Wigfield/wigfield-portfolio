#!/usr/bin/env node
/* Self-test step 1: render the ground-truth room from the six shot-guide
   positions and save them as phone-like JPEG "photos".

     node tools/memory-rooms/selftest/make-photos.mjs [--samples 128]

   → memory-rooms-work/_selftest-truth/            (room.blend + Cycles renders of the truth)
   → memory-rooms-work/_selftest-truth/photos/<n>.jpg   1536 × 2048 portrait, quality 88 */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { BLENDER, REPO, WORK } from '../lib/api.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const samples = args.includes('--samples') ? args[args.indexOf('--samples') + 1] : '128';
const out = path.join(WORK, '_selftest-truth');
fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(path.join(HERE, 'truth', 'truth.scene.json'), path.join(out, 'scene.json'));

const t0 = Date.now();
const res = spawnSync(BLENDER, ['-b', '--factory-startup', '--python', path.join(REPO, 'tools/memory-rooms/blender/build_room.py'), '--', '--scene', path.join(out, 'scene.json'), '--out', out, '--samples', samples, '--res', '2048'], { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
fs.writeFileSync(path.join(out, 'build.log'), `${res.stdout}${res.stderr}`);
if (res.status !== 0) {
  console.error(`build_room.py failed:\n${`${res.stdout}${res.stderr}`.split(/\r?\n/).slice(-30).join('\n')}`);
  process.exit(1);
}
console.log(`truth room built + rendered in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

const photos = path.join(out, 'photos');
fs.mkdirSync(photos, { recursive: true });
const truth = JSON.parse(fs.readFileSync(path.join(out, 'scene.json'), 'utf8'));
for (const cam of truth.cameras) {
  const src = path.join(out, 'renders', `cam${cam.photo}.png`);
  const dst = path.join(photos, `${cam.photo}.jpg`);
  await sharp(src).jpeg({ quality: 88 }).toFile(dst);
  const m = await sharp(dst).metadata();
  console.log(`photo ${cam.photo}: ${m.width}×${m.height} → ${dst}`);
}
