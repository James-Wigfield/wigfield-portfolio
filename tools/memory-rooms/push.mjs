#!/usr/bin/env node
/* push: publish a finished spot. Uploads room.glb and its map copy map.glb, the renders
   (making map.glb and the map marker renders/marker.png first if missing or stale) and the compare
   sheets, saves scene.json (validated server-side, bumps sceneVersion) and sets
   the status to "rendered".

     node tools/memory-rooms/push.mjs <spotId> [--dry-run] [--keep-status]

   Refuses to push if check-scene fails or room.glb is over 15 MB (warns over 8). */

import fs from 'node:fs';
import path from 'node:path';
import { client, supportsMapModel, workDir } from './lib/api.mjs';
import sharp from 'sharp';
import { checkScene } from './check-scene.mjs';
import { ensureMapModelFile } from './lib/mapModel.mjs';
import { ensureMarkerFile } from './lib/marker.mjs';

const args = process.argv.slice(2);
const id = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry-run');
if (!id) {
  console.error('usage: node tools/memory-rooms/push.mjs <spotId> [--dry-run] [--keep-status]');
  process.exit(2);
}
const dir = workDir(id);
const scene = JSON.parse(fs.readFileSync(path.join(dir, 'scene.json'), 'utf8'));
const { errors, warnings } = checkScene(scene);
if (errors.length) {
  console.error(`check-scene failed:\n  ${errors.join('\n  ')}`);
  process.exit(1);
}
warnings.forEach((w) => console.log(`  ! ${w}`));

const glbPath = path.join(dir, 'room.glb');
if (!fs.existsSync(glbPath)) {
  console.error('room.glb is missing: run bake_export.py first (see the memory-render skill).');
  process.exit(1);
}
const glbMB = fs.statSync(glbPath).size / 1024 / 1024;
if (glbMB > 15) {
  console.error(`room.glb is ${glbMB.toFixed(1)} MB (limit 15): lower the atlas size in bake_export.py (--atlas 1024).`);
  process.exit(1);
}
if (glbMB > 8) console.log(`  ! room.glb is ${glbMB.toFixed(1)} MB (target ≤ 8 MB on phones)`);

const uploads = [{ type: 'model', name: 'room', file: glbPath, contentType: 'model/gltf-binary' }];
const mapModel = await ensureMapModelFile(dir);
if (mapModel?.made) console.log(`  + map.glb made from room.glb (${(mapModel.bytes / 1024).toFixed(0)} KB)`);
const mapOk = dry || (await supportsMapModel(client()));
if (mapModel && mapOk) uploads.push({ type: 'model', name: 'map', file: mapModel.path, contentType: 'model/gltf-binary' });
if (mapModel && !mapOk) console.log('  ! this Worker predates model/map (it would overwrite room.glb): map.glb NOT uploaded. Deploy, then run backfill-map-assets.mjs.');
const renders = path.join(dir, 'renders');
if (fs.existsSync(renders)) {
  const marker = await ensureMarkerFile(renders);
  if (marker?.made) console.log(`  + renders/marker.png made from the hero (${marker.width}×${marker.height}, ${(marker.bytes / 1024).toFixed(0)} KB)`);
  for (const f of fs.readdirSync(renders).filter((f) => /^[a-z0-9-]+\.png$/.test(f))) {
    uploads.push({ type: 'render', name: f.replace(/\.png$/, ''), file: path.join(renders, f), contentType: 'image/png' });
  }
}
if (fs.existsSync(path.join(dir, 'compare.png'))) uploads.push({ type: 'compare', name: 'compare', file: path.join(dir, 'compare.png'), contentType: 'image/png' });
for (const f of fs.readdirSync(dir).filter((f) => /^compare-round\d+\.png$/.test(f))) {
  uploads.push({ type: 'compare', name: f.replace(/^compare-|\.png$/g, ''), file: path.join(dir, f), contentType: 'image/png' });
}
if (!uploads.some((u) => u.type === 'render' && u.name === 'hero')) console.log('  ! no renders/hero.png: the map card will fall back to a photo, and the map shows a dot instead of a marker');

if (dry) {
  console.log(`dry run: would upload ${uploads.length} files and PATCH scene + status for ${id}`);
  uploads.forEach((u) => console.log(`  ${u.type}/${u.name}  ${(fs.statSync(u.file).size / 1024).toFixed(0)} KB`));
  process.exit(0);
}

const api = client();
for (const u of uploads) {
  // Renders carry their pixel size, so the map can lay out a marker before it has loaded.
  const dims = u.type === 'render' ? await sharp(u.file).metadata().then((m) => ({ width: m.width, height: m.height })) : {};
  const m = await api.putMedia(id, u.type, u.name, fs.readFileSync(u.file), { contentType: u.contentType, ...dims });
  console.log(`  ↑ ${u.type}/${u.name}  ${(m.bytes / 1024).toFixed(0)} KB`);
}
const patch = { scene };
if (!args.includes('--keep-status')) patch.status = 'rendered';
const spot = await api.patchSpot(id, patch);
console.log(`pushed ${spot.title}: scene v${spot.sceneVersion}, status ${spot.status}, ${uploads.length} files`);
