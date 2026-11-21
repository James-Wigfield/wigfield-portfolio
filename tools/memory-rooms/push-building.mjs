#!/usr/bin/env node
/* push-building: publish a built whole place (CONTRACTS.md 6.4). The counterpart of push.mjs for buildings.

     node tools/memory-rooms/push-building.mjs <buildingId | work dir> [--dry-run] [--keep-status] [--rooms]

   From memory-rooms-work/b-<id>/ (after build-building.mjs): PATCHes `plan` (building.json, validated by the
   Worker; planVersion +1; with the row's updatedAt, so a change made meanwhile stops it BEFORE any upload), then
   uploads level-<levelId>.glb (model/level-<id>), exterior.glb (model/exterior) and the renders (hero / marker /
   per-level three-quarter + top), then sets the status to "rendered". (No `model/map` yet: the map shows the
   place's marker; a building model on the map is future work.) With --rooms it also runs push.mjs for every spot whose
   room.glb slice was written (rooms[].spotIds that have a work folder with room.glb).

   Talks to MEMORIES_API (default the LOCAL Worker, http://127.0.0.1:8788) with MEMORIES_PASSWORD, like push.mjs.
   Prints where it is about to write; anything but a local Worker needs --live. Refuses a Worker without the
   building routes (ping features), and GLBs over 15 MB. */

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
const local = /^https?:\/\/(127\.0\.0\.1|localhost)(:|\/|$)/.test(cfg.base);
console.log(`push-building → ${cfg.base}${local ? ' (local)' : ''}`);
if (!local && !args.includes('--live')) {
  console.error(`${cfg.base} is not a local Worker: pass --live to publish there.`);
  process.exit(1);
}
if (!(await supportsBuildings(api))) {
  console.error(`${cfg.base} has no building routes (or its database has no building tables yet): deploy the Worker and run supabase/memory_buildings.sql first.`);
  process.exit(1);
}
const row = await api.getBuilding(id).catch(() => null);
if (!row) {
  console.error(`no building ${id} at ${cfg.base} (a place is created by the phone; this pushes its render)`);
  process.exit(1);
}
// the plan first: a change made on the row meanwhile (409) stops here, before any file goes up
const saved = await api.patchBuilding(id, { plan, ifUpdatedAt: row.updatedAt });
console.log(`✓ plan v${saved.planVersion}`);
for (const u of uploads) {
  await api.putBuildingMedia(id, u.type, u.name, fs.readFileSync(u.file), { contentType: u.contentType });
  console.log(`  ✓ ${u.type}/${u.name}`);
}
if (!args.includes('--keep-status')) {
  const done = await api.patchBuilding(id, { status: 'rendered' });
  console.log(`✓ building ${id}: status ${done.status}`);
}

if (args.includes('--rooms')) {
  for (const r of plan.rooms) {
    for (const sid of r.spotIds || []) {
      if (!fs.existsSync(path.join(WORK, sid, 'room.glb'))) continue;
      const res = spawnSync(process.execPath, [path.join(path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')), 'push.mjs'), sid], { stdio: 'inherit', env: { ...process.env, MEMORIES_API: cfg.base } });
      if (res.status !== 0) process.exitCode = 1;
    }
  }
}
