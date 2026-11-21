#!/usr/bin/env node
/* push-building: publish a built whole place (CONTRACTS.md 6.4). The counterpart of push.mjs for buildings.

     node tools/memory-rooms/push-building.mjs <buildingId | work dir> [--dry-run] [--keep-status] [--rooms]

   From memory-rooms-work/b-<id>/ (after build-building.mjs): uploads level-<levelId>.glb (model/level-<id>),
   exterior.glb (model/exterior), the map's small copy (model/map, made from the exterior + levels if missing),
   renders (hero / marker / per-level three-quarter + top), PATCHes `plan` (building.json, validated by the
   Worker; planVersion +1) and the status to "rendered". With --rooms it also runs push.mjs for every spot whose
   room.glb slice was written (rooms[].spotIds that have a work folder with room.glb).

   Talks to MEMORIES_API (default the LOCAL Worker, http://127.0.0.1:8788) with MEMORIES_PASSWORD, like push.mjs.
   Refuses a Worker without the building routes (ping features), and GLBs over 15 MB. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { client, config, supportsBuildings, WORK } from './lib/api.mjs';
import { validateBuilding } from '../../src/memory-rooms/building/validate.js';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const dry = args.includes('--dry-run');
if (!target) {
  console.error('usage: node tools/memory-rooms/push-building.mjs <buildingId | work dir> [--dry-run] [--keep-status] [--rooms]');
  process.exit(2);
}
const dir = fs.existsSync(target) ? path.resolve(target) : path.join(WORK, `b-${target}`);
const id = path.basename(dir).replace(/^b-/, '');
const plan = JSON.parse(fs.readFileSync(path.join(dir, 'building.json'), 'utf8'));
const v = validateBuilding(plan);
if (!v.ok) {
  console.error(`building.json is not valid:\n  ${v.errors.map((e) => `${e.path} ${e.message}`).join('\n  ')}`);
  process.exit(1);
}

const uploads = [];
for (const lv of plan.levels) {
  const f = path.join(dir, `level-${lv.id}.glb`);
  if (!fs.existsSync(f)) {
    console.error(`missing ${f}: run build-building.mjs first`);
    process.exit(1);
  }
  uploads.push({ type: 'model', name: `level-${lv.id}`, file: f, contentType: 'model/gltf-binary' });
  for (const r of ['three-quarter', 'top']) {
    const p = path.join(dir, 'levels', lv.id, 'renders', `${r}.png`);
    if (fs.existsSync(p)) uploads.push({ type: 'render', name: `level-${lv.id}-${r}`, file: p, contentType: 'image/png' });
  }
}
const ext = path.join(dir, 'exterior.glb');
if (fs.existsSync(ext)) uploads.push({ type: 'model', name: 'exterior', file: ext, contentType: 'model/gltf-binary' });
for (const r of ['hero', 'marker']) {
  const p = path.join(dir, 'renders', `${r}.png`);
  if (fs.existsSync(p)) uploads.push({ type: 'render', name: r, file: p, contentType: 'image/png' });
}
for (const u of uploads) {
  const mb = fs.statSync(u.file).size / 1024 / 1024;
  if (u.type === 'model' && mb > 15) {
    console.error(`${u.name} is ${mb.toFixed(1)} MB (limit 15): bake with --atlas 1024`);
    process.exit(1);
  }
}

if (dry) {
  console.log(`dry run: would upload ${uploads.length} files and PATCH plan + status for building ${id}`);
  uploads.forEach((u) => console.log(`  ${u.type}/${u.name}  ${(fs.statSync(u.file).size / 1024).toFixed(0)} KB`));
  process.exit(0);
}

const cfg = config();
const api = client(cfg);
if (!(await supportsBuildings(api))) {
  console.error(`${cfg.base} has no building routes (or its database has no building tables yet): deploy the Worker and run supabase/memory_buildings.sql first.`);
  process.exit(1);
}
const row = await api.getBuilding(id).catch(() => null);
if (!row) {
  console.error(`no building ${id} at ${cfg.base} (a place is created by the phone; this pushes its render)`);
  process.exit(1);
}
for (const u of uploads) {
  await api.putBuildingMedia(id, u.type, u.name, fs.readFileSync(u.file), { contentType: u.contentType });
  console.log(`  ✓ ${u.type}/${u.name}`);
}
const patch = { plan, ifUpdatedAt: row.updatedAt };
if (!args.includes('--keep-status')) patch.status = 'rendered';
const saved = await api.patchBuilding(id, patch);
console.log(`✓ building ${id}: plan v${saved.planVersion}, status ${saved.status}`);

if (args.includes('--rooms')) {
  for (const r of plan.rooms) {
    for (const sid of r.spotIds || []) {
      if (!fs.existsSync(path.join(WORK, sid, 'room.glb'))) continue;
      const res = spawnSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'push.mjs'), sid], { stdio: 'inherit' });
      if (res.status !== 0) process.exitCode = 1;
    }
  }
}
