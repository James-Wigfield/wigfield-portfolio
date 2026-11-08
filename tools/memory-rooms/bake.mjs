#!/usr/bin/env node
/* bake: Blender bake_export.py on a built room → room.glb + renders/hero.png.

     node tools/memory-rooms/bake.mjs <spotId | work dir> [--atlas 2048] [--samples 256]

   Run after the last compare round (needs <work>/room.blend from build.mjs). */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BLENDER, REPO, workDir } from './lib/api.mjs';

const args = process.argv.slice(2);
// the first argument that is neither a --flag nor a flag's value
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--dry-run'].includes(args[i - 1])));
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
if (!target) {
  console.error('usage: node tools/memory-rooms/bake.mjs <spotId | work dir> [--atlas 2048] [--samples 256]');
  process.exit(2);
}
const dir = path.resolve(fs.existsSync(target) ? target : workDir(target));
if (!fs.existsSync(path.join(dir, 'room.blend'))) {
  console.error(`No room.blend in ${dir}: run build.mjs first.`);
  process.exit(1);
}
const t0 = Date.now();
const res = spawnSync(
  BLENDER,
  ['-b', '--factory-startup', '--python', path.join(REPO, 'tools/memory-rooms/blender/bake_export.py'), '--', '--blend', path.join(dir, 'room.blend'), '--out', dir, '--atlas', opt('--atlas', '2048'), '--samples', opt('--samples', '256')],
  { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
);
const out = `${res.stdout || ''}${res.stderr || ''}`;
fs.mkdirSync(path.join(dir, 'logs'), { recursive: true });
fs.writeFileSync(path.join(dir, 'logs', 'bake.log'), out);
if (res.status !== 0 || !fs.existsSync(path.join(dir, 'room.glb'))) {
  console.error(`✗ bake_export.py failed\n${out.split(/\r?\n/).slice(-40).join('\n')}`);
  process.exit(1);
}
const mb = fs.statSync(path.join(dir, 'room.glb')).size / 1024 / 1024;
console.log(`✓ bake + export (${((Date.now() - t0) / 1000).toFixed(1)}s): room.glb ${mb.toFixed(2)} MB${mb > 8 ? '  ! over the 8 MB target' : ''}`);
console.log(`  hero: ${path.join(dir, 'renders', 'hero.png')}`);
