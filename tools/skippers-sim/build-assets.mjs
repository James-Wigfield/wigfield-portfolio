#!/usr/bin/env node
/* Build the Skippers practical-sim assets (headless Blender, the Memory Rooms way).

     node tools/skippers-sim/build-assets.mjs [--only venue|boat] [--raw] [--no-ao]

   1. layout.mjs            → public/skippers-sim/venue-layout.json  (measured venue, physics + GLB source)
   2. blender/venue.py      → public/skippers-sim/venue.glb          (≤ 6 MB; AO baked into vertex colours
                              with Cycles, 16 samples — --no-ao skips it)
   3. blender/boat.py       → public/skippers-sim/boat.glb + boat-footprint.json (≤ 2 MB)
   4. meshopt-compress the VENUE (EXT_meshopt_compression + quantization; three's GLTFLoader needs
      setMeshoptDecoder(MeshoptDecoder)). --raw skips step 4. The BOAT is left uncompressed on
      purpose: quantization rewrites node translations/scales, which would move the animation
      pivots (outboard, prop, wheel, lever) off their hubs. Venue node origins are shifted the same
      way, but its world-space geometry is exact; take positions from venue-layout.json.
   Logs: tools/skippers-sim/logs/. */

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Logger, NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, meshopt, prune, weld } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '../..');
const BLENDER = process.env.BLENDER || 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe';
const PUB = path.join(REPO, 'public/skippers-sim');
const LOGS = path.join(HERE, 'logs');
const args = process.argv.slice(2);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
fs.mkdirSync(PUB, { recursive: true });
fs.mkdirSync(LOGS, { recursive: true });

function run(cmd, argv, log) {
  const t0 = Date.now();
  const r = spawnSync(cmd, argv, { cwd: REPO, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  const out = `${r.stdout || ''}${r.stderr || ''}`;
  fs.writeFileSync(path.join(LOGS, log), out);
  if (r.status !== 0) {
    console.error(`✗ ${log}\n${out.split(/\r?\n/).slice(-30).join('\n')}`);
    process.exit(1);
  }
  return { out, s: ((Date.now() - t0) / 1000).toFixed(1) };
}

async function compress(file) {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.encoder': MeshoptEncoder, 'meshopt.decoder': MeshoptDecoder });
  const doc = await io.read(file);
  doc.setLogger(new Logger(Logger.Verbosity.WARN));
  const before = doc.getRoot().listNodes().map((n) => n.getName()).sort();
  await doc.transform(dedup(), weld(), prune({ keepLeaves: true, keepAttributes: true }), meshopt({ encoder: MeshoptEncoder, level: 'medium' }));
  const after = new Set(doc.getRoot().listNodes().map((n) => n.getName()));
  const lost = before.filter((n) => n && !after.has(n));
  if (lost.length) throw new Error(`${path.basename(file)} lost nodes: ${lost.join(', ')}`);
  await io.write(file, doc);
}

const mb = (f) => (fs.statSync(f).size / 1024 / 1024).toFixed(2);

run(process.execPath, [path.join(HERE, 'layout.mjs')], 'layout.log');
console.log('✓ venue-layout.json');

const jobs = [
  { id: 'venue', py: 'venue.py', out: path.join(PUB, 'venue.glb'), extra: ['--layout', path.join(PUB, 'venue-layout.json'), ...(args.includes('--no-ao') ? [] : ['--ao', '16'])], max: 6 },
  { id: 'boat', py: 'boat.py', out: path.join(PUB, 'boat.glb'), extra: ['--footprint', path.join(PUB, 'boat-footprint.json')], max: 2, raw: true },
];
for (const j of jobs) {
  if (only && only !== j.id) continue;
  const r = run(BLENDER, ['-b', '--factory-startup', '--python', path.join(HERE, 'blender', j.py), '--', '--out', j.out, ...j.extra], `${j.id}.log`);
  const raw = mb(j.out);
  if (!args.includes('--raw') && !j.raw) await compress(j.out);
  const size = mb(j.out);
  console.log(`✓ ${j.id}.glb ${size} MB (raw ${raw} MB, ${r.s}s)${size > j.max ? `  ! over ${j.max} MB` : ''}`);
  const nodes = r.out.match(/^(VENUE|BOAT)_NODES (.*)$/m);
  if (nodes) fs.writeFileSync(path.join(LOGS, `${j.id}-nodes.json`), nodes[2]);
}
