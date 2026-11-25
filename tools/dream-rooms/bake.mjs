/* ============================================================================
   DREAM ROOMS · bake: the full bake (render workflow step 8).
     node tools/dream-rooms/bake.mjs <id> [--version N] [--samples N] [--atlas N]
   Runs blender/bake_export.py (2048 px atlases, ~384 adaptive samples, stills
   with volumetric haze) → dream-rooms-work/<id>/out/world-v<N>.glb +
   out/stills/<module>.webp + out/report.json, where N = --version, or
   row.json.world_version + 1, or 1. Then MEASURES the real GLB with
   @gltf-transform/core (bytes, draw calls = primitives drawn, triangles) and
   exits 1 naming the limit when it's over budget (dims.json → budget).
   A still-fallback world gets out/stills/still-<k>.webp only.
   PNG copies of the stills go to build/stills-png/ (never uploaded).
   Prints ids, sizes and timings only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import dims from '../../src/dream-rooms/contracts/dims.json' with { type: 'json' };
import { checkWorld } from '../../src/dream-rooms/contracts/validate.js';
import { measureGlb, overBudget, runBlender } from './lib/blender.mjs';
import { args, loadWork, logEvent, printProblems, writeJson } from './lib/work.mjs';

const a = args();
if (!a._[0]) {
  console.error('usage: node tools/dream-rooms/bake.mjs <id> [--version N] [--samples N] [--atlas N]');
  process.exit(2);
}
const w = loadWork(a._[0]);
const id = w.row?.id || w.id;
const secs = (t) => Math.round((Date.now() - t) / 100) / 10;

async function main() {
  if (!w.world) {
    console.error(`bake: ${id}: no world.json in the work folder`);
    process.exit(1);
  }
  const r = checkWorld(w.world, { dream: w.dream, text: w.raw });
  if (!r.ok) {
    printProblems(`bake: ${id}: world.json has errors`, r.errors);
    process.exit(1);
  }
  const N = Number(a.version) || (Number.isInteger(w.row?.world_version) ? w.row.world_version + 1 : 1);
  const out = path.join(w.dir, 'out');
  const buildDir = path.join(w.dir, 'build');
  const still = w.world.fallback === 'still';
  // a fresh stills folder: push uploads everything in it
  fs.rmSync(path.join(out, 'stills'), { recursive: true, force: true });
  const glbName = `world-v${N}.glb`;
  const extra = [];
  if (a.samples) extra.push('--samples', String(Number(a.samples)));
  if (a.atlas) extra.push('--atlas', String(Number(a.atlas)));
  const t = Date.now();
  console.log(`bake: ${id}: full bake → out/${still ? 'stills (still fallback)' : glbName}`);
  const res = await runBlender('bake_export.py', [
    '--world', path.join(w.dir, 'world.json'), '--out', out, '--scratch', buildDir, '--work', w.dir,
    '--glb-name', glbName, '--png-copies', ...extra,
  ], { logFile: path.join(buildDir, 'bake-blender.log'), onLine: a.verbose ? (l) => console.log(l) : null });
  const seconds = secs(t);
  const rep = res.report;
  if (res.code !== 0 || !rep || rep.error) {
    console.error(`bake: ${id}: Blender failed (exit ${res.code}); log: ${path.relative(process.cwd(), res.logFile)}`);
    for (const l of res.tail.slice(-12)) console.error(`  | ${l}`);
    logEvent(w.dir, { step: 'bake', ok: false, seconds, exit: res.code });
    process.exit(1);
  }
  const report = { id, version: N, seconds, fallback: still ? 'still' : null, blender: rep };
  let over = [];
  if (!still) {
    const glb = path.join(out, glbName);
    const m = await measureGlb(glb);
    over = overBudget(m);
    report.glb = { file: `out/${glbName}`, bytes: m.bytes, drawCalls: m.drawCalls, triangles: m.triangles,
      materials: m.materials, textures: m.textures, unlit: m.unlit, nodes: m.nodes };
    report.budget = { ...dims.budget, ok: over.length === 0, over };
    console.log(`bake: ${id}: ${glbName} ${(m.bytes / 1048576).toFixed(2)} MB, ${m.drawCalls} draw calls, ${m.triangles} triangles, ${m.textures} texture(s)`);
  }
  for (const s of rep.stills || []) console.log(`  still ${s.name}.webp ${(s.bytes / 1024).toFixed(0)} KB`);
  for (const [mid, mod] of Object.entries(rep.modules || {})) {
    const at = (mod.atlases || []).map((x) => `${x.size}px@${x.texelsPerMetre}t/m`).join(' ');
    if (at) console.log(`  ${mid}: ${at}`);
  }
  console.log(`  ${seconds} s (Blender ${rep.timings?.total} s)`);
  writeJson(path.join(out, 'report.json'), report);
  logEvent(w.dir, { step: 'bake', ok: over.length === 0, version: N, seconds, bytes: report.glb?.bytes ?? null,
    draws: report.glb?.drawCalls ?? null, tris: report.glb?.triangles ?? null, stills: (rep.stills || []).length,
    fallback: report.fallback });
  if (over.length) {
    console.error(`bake: ${id}: OVER BUDGET: ${over.join('; ')}`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(`bake: ${id}: ${String(err.message || err).split('\n')[0]}`);
  logEvent(w.dir, { step: 'bake', ok: false });
  process.exit(1);
});
