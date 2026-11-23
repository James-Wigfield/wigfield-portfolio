#!/usr/bin/env node
/* build-building: a whole place, building.json → baked level GLBs + exterior + each furnished room's slice.

     node tools/memory-rooms/build-building.mjs <buildingId | work dir> [--samples 128] [--atlas 2048] [--only ground]
          [--no-bake]

   Work folder: memory-rooms-work/b-<buildingId>/ with building.json (traced from the floor plan: check it with
   plan-check.mjs first). Room scenes come from the spots' own work folders (memory-rooms-work/<spotId>/scene.json
   with shell { building, room }), written like any spot's scene but in the room frame.
   1. building/validate.js (refuses an invalid plan)
   2. blender build_building.py → levels/<id>/room.blend (+ renders), exterior/room.blend
   3. bake.mjs on each → room.glb; copied to level-<id>.glb / exterior.glb; renders/hero.png from the first level.
      Levels bake with --empty: level-<id>-empty.glb = the structure's atlases baked again without the furniture.
   4. blender slice_rooms.py on each baked level (after all levels bake: a double-height room takes the level above) → memory-rooms-work/<spotId>/room.glb for every furnished room
      (+ room-empty.glb beside it: the level's empty atlases, same material names)
   Then: push-building.mjs <id> (and push.mjs for each room spot). */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BLENDER, REPO, WORK } from './lib/api.mjs';
import { ensureMarkerFile } from './lib/marker.mjs';
import { validateBuilding } from '../../src/memory-rooms/building/validate.js';

const args = process.argv.slice(2);
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && args[i - 1] !== '--no-bake'));
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
if (!target) {
  console.error('usage: node tools/memory-rooms/build-building.mjs <buildingId | work dir> [--samples 128] [--atlas 2048] [--only <level>] [--no-bake]');
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
const step = (label, cmd, argv) => {
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd: REPO, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'logs', `${label.replace(/[^a-z0-9]+/gi, '-')}.log`), out);
  console.log(`${r.status === 0 ? '✓' : '✗'} ${label} (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
  if (r.status !== 0) {
    console.log(out.split(/\r?\n/).slice(-30).join('\n'));
    process.exit(1);
  }
  return out;
};

const only = opt('--only', '');
const bb = path.join(REPO, 'tools/memory-rooms/blender/build_building.py');
step('build_building', BLENDER, ['-b', '--factory-startup', '--python', bb, '--', '--building', path.join(dir, 'building.json'), '--out', dir, '--id', id, '--scenes', WORK, '--samples', opt('--samples', '64'), ...(only ? ['--level', only] : [])]);
if (args.includes('--no-bake')) process.exit(0);

const bake = path.join(REPO, 'tools/memory-rooms/bake.mjs');
const slice = path.join(REPO, 'tools/memory-rooms/blender/slice_rooms.py');
const levels = plan.levels.filter((l) => !only || l.id === only);
for (const lv of levels) {
  const ld = path.join(dir, 'levels', lv.id);
  // a level bakes twice: furnished, then its structure again with the furniture hidden (room-empty.glb)
  step(`bake level ${lv.id}`, process.execPath, [bake, ld, '--samples', opt('--samples', '128'), '--atlas', opt('--atlas', '2048'), '--empty']);
  fs.copyFileSync(path.join(ld, 'room.glb'), path.join(dir, `level-${lv.id}.glb`));
  const empty = path.join(ld, 'room-empty.glb');
  fs.rmSync(path.join(dir, `level-${lv.id}-empty.glb`), { force: true }); // a stale one from an earlier bake
  if (fs.existsSync(empty)) fs.copyFileSync(empty, path.join(dir, `level-${lv.id}-empty.glb`));
  else console.log(`  level ${lv.id}: no furniture, so no empty state (no level-${lv.id}-empty.glb)`);
}
// slice after EVERY level is baked: a double-height room's slice takes the level above's structure from its bake
for (const lv of levels) {
  const ld = path.join(dir, 'levels', lv.id);
  const empty = path.join(ld, 'room-empty.glb');
  const out = step(`slice level ${lv.id}`, BLENDER, ['-b', path.join(ld, 'room-baked.blend'), '--python', slice, '--', '--building', path.join(dir, 'building.json'), '--id', id, '--scenes', WORK]);
  const m = /SLICES (\[.*\])/.exec(out);
  for (const s of m ? JSON.parse(m[1]) : []) {
    console.log(`  room ${s.room} → ${s.glb}`);
    // the slice keeps the level's baked_atlas<i> materials, so the level's empty atlases fit it as they are
    if (fs.existsSync(empty)) fs.copyFileSync(empty, path.join(path.dirname(s.glb), 'room-empty.glb'));
  }
}
if (!only && fs.existsSync(path.join(dir, 'exterior', 'room.blend'))) {
  step('bake exterior', process.execPath, [bake, path.join(dir, 'exterior'), '--samples', opt('--samples', '128'), '--atlas', opt('--atlas', '2048')]);
  fs.copyFileSync(path.join(dir, 'exterior', 'room.glb'), path.join(dir, 'exterior.glb'));
}
// the place's hero + marker: the first level's dollhouse hero
const hero = path.join(dir, 'levels', plan.levels[0].id, 'renders', 'hero.png');
if (fs.existsSync(hero)) {
  fs.mkdirSync(path.join(dir, 'renders'), { recursive: true });
  fs.copyFileSync(hero, path.join(dir, 'renders', 'hero.png'));
  await ensureMarkerFile(path.join(dir, 'renders'), { force: true }).catch(() => null);
}
console.log(`\nnext: node tools/memory-rooms/push-building.mjs ${id}  (and push.mjs for each room spot, or --rooms)`);
