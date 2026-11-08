#!/usr/bin/env node
/* build: one compare-loop iteration = check-scene → Blender build_room.py → compare.

     node tools/memory-rooms/build.mjs <spotId | work dir> [--round N] [--samples 64] [--res 1200] [--only cam1,top]

   Stops at the first failing step. Blender output goes to <work>/logs/build.log;
   the last lines are printed when it fails. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { BLENDER, REPO, workDir } from './lib/api.mjs';

const args = process.argv.slice(2);
// the first argument that is neither a --flag nor a flag's value
const target = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--') && !['--dry-run'].includes(args[i - 1])));
const opt = (name, dflt) => (args.includes(name) ? args[args.indexOf(name) + 1] : dflt);
if (!target) {
  console.error('usage: node tools/memory-rooms/build.mjs <spotId | work dir> [--round N] [--samples 64] [--res 1200] [--only cam1,top]');
  process.exit(2);
}
const dir = path.resolve(fs.existsSync(target) ? target : workDir(target));
const node = process.execPath;
const step = (label, cmd, cmdArgs, logFile) => {
  const t0 = Date.now();
  const res = spawnSync(cmd, cmdArgs, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${res.stdout || ''}${res.stderr || ''}`;
  if (logFile) {
    fs.mkdirSync(path.dirname(logFile), { recursive: true });
    fs.writeFileSync(logFile, out);
  }
  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.status !== 0) {
    console.error(`✗ ${label} failed (${secs}s)\n${out.split(/\r?\n/).slice(-40).join('\n')}`);
    process.exit(1);
  }
  console.log(`✓ ${label} (${secs}s)`);
  return out;
};

console.log(step('check-scene', node, ['tools/memory-rooms/check-scene.mjs', path.join(dir, 'scene.json')]).trim().split('\n').slice(1).join('\n'));

const blenderArgs = ['-b', '--factory-startup', '--python', path.join(REPO, 'tools/memory-rooms/blender/build_room.py'), '--', '--scene', path.join(dir, 'scene.json'), '--out', dir, '--samples', opt('--samples', '64'), '--res', opt('--res', '1200')];
if (args.includes('--only')) blenderArgs.push('--only', opt('--only'));
const log = step('blender build_room.py', BLENDER, blenderArgs, path.join(dir, 'logs', 'build.log'));
const report = path.join(dir, 'build-report.json');
if (fs.existsSync(report)) {
  const r = JSON.parse(fs.readFileSync(report, 'utf8'));
  const fallbacks = r.fallbacks || r.fallback || [];
  if (fallbacks.length) console.log(`  ! fallbacks: ${JSON.stringify(fallbacks)}`);
  for (const w of r.warnings || []) console.log(`  ! ${typeof w === 'string' ? w : JSON.stringify(w)}`);
} else {
  console.log(log.split(/\r?\n/).filter((l) => l.startsWith('[mr')).slice(-5).join('\n'));
}

const cmpArgs = ['tools/memory-rooms/compare.mjs', dir];
if (args.includes('--round')) cmpArgs.push('--round', opt('--round'));
console.log(step('compare', node, cmpArgs).trim());
console.log(`\nRead ${path.join(dir, 'compare.png')} and name the 3 biggest mismatches.`);
