/* ============================================================================
   DREAM ROOMS · build: the draft (render workflow step 6).
     node tools/dream-rooms/build.mjs <id> --draft [--no-upload] [--no-frames] [--stills]
   1. loads dream-rooms-work/<id>/world.json (+ dream.json, raw.txt when present)
   2. checkWorld(world, { dream, text }); refuses on errors (paths only)
   3. blender/build_world.py --draft → build/draft.glb (512 px atlases, 32 samples)
   4. unless --no-upload: PUT draft/world.glb + draft/world.json, PATCH status 'building'
   5. unless --no-frames: autopilot frames of ${SITE}/dreams/<id>?draft=1&autopilot=1 → frames/
   6. appends timings to log.json
   Prints ids, counts, sizes and timings only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { checkWorld } from '../../src/dream-rooms/contracts/validate.js';
import { runBlender } from './lib/blender.mjs';
import { args, loadWork, logEvent, printProblems } from './lib/work.mjs';

const a = args();
if (!a._[0]) {
  console.error('usage: node tools/dream-rooms/build.mjs <id> --draft [--no-upload] [--no-frames] [--stills]');
  process.exit(2);
}
if (!a.draft) console.log('build: drafts only (the full bake is bake.mjs); building a draft');
const w = loadWork(a._[0]);
const id = w.row?.id || w.id;
const T = {};
const t0 = Date.now();
const secs = (t) => Math.round((Date.now() - t) / 100) / 10;

function site() {
  if (process.env.DREAMS_SITE) return process.env.DREAMS_SITE.replace(/\/+$/, '');
  if (process.env.DREAMS_API) {
    try {
      return new URL(process.env.DREAMS_API).origin;
    } catch {
      /* fall through */
    }
  }
  return 'http://127.0.0.1:8796';
}

async function optional(spec) {
  try {
    return await import(spec);
  } catch (err) {
    if (err?.code === 'ERR_MODULE_NOT_FOUND') return null;
    throw err;
  }
}

async function main() {
  if (!w.world) {
    console.error(`build: ${id}: no world.json in the work folder`);
    process.exit(1);
  }
  // 2. validate
  let t = Date.now();
  const r = checkWorld(w.world, { dream: w.dream, text: w.raw });
  T.check = secs(t);
  if (!r.ok) {
    printProblems(`build: ${id}: world.json has errors`, r.errors);
    logEvent(w.dir, { step: 'build', ok: false, errors: r.errors.length });
    process.exit(1);
  }
  printProblems(`build: ${id}: warnings`, r.warnings);

  // 3. Blender
  const buildDir = path.join(w.dir, 'build');
  t = Date.now();
  const extra = a.stills ? ['--stills', '--png-copies'] : [];
  const res = await runBlender('build_world.py', [
    '--world', path.join(w.dir, 'world.json'), '--out', buildDir, '--scratch', buildDir, '--work', w.dir,
    '--draft', '--glb-name', 'draft.glb', ...extra,
  ], { logFile: path.join(buildDir, 'draft-blender.log'), onLine: a.verbose ? (l) => console.log(l) : null });
  T.blender = secs(t);
  const rep = res.report;
  if (res.code !== 0 || !rep || rep.error) {
    console.error(`build: ${id}: Blender failed (exit ${res.code}); log: ${path.relative(process.cwd(), res.logFile)}`);
    for (const l of res.tail.slice(-12)) console.error(`  | ${l}`);
    logEvent(w.dir, { step: 'build', ok: false, blender_s: T.blender, exit: res.code });
    process.exit(1);
  }
  const glb = path.join(buildDir, 'draft.glb');
  const bytes = fs.statSync(glb).size;
  console.log(`build: ${id}: draft.glb ${(bytes / 1048576).toFixed(2)} MB, ${rep.glb.drawCalls} draws, ${rep.glb.triangles} tris, ${T.blender} s`);
  for (const [mid, m] of Object.entries(rep.modules || {})) {
    console.log(`  ${mid}: ${m.kit}, ${(m.atlases || []).length} atlas(es), exposure ${m.exposure}`);
  }
  for (const wmsg of rep.warnings || []) console.log(`  warning: ${wmsg}`);

  // 4. upload
  let uploaded = false;
  if (!a['no-upload']) {
    const lib = await optional('./lib/api.mjs');
    if (!lib) console.warn('build: lib/api.mjs not found; skipping the upload');
    else {
      t = Date.now();
      const features = (await lib.api.ping())?.features || [];
      if (!features.includes('draft')) console.warn("build: the Worker doesn't list feature 'draft'; skipping the upload");
      else {
        await lib.api.putFile(id, 'draft/world.glb', glb, 'model/gltf-binary');
        await lib.api.putFile(id, 'draft/world.json', Buffer.from(JSON.stringify(w.world)), 'application/json');
        await lib.api.patch(id, { status: 'building' });
        uploaded = true;
        T.upload = secs(t);
        console.log(`build: ${id}: draft uploaded, status building (${T.upload} s)`);
      }
    }
  }

  // 5. frames
  let frames = null;
  if (!a['no-frames']) {
    const lib = await optional('./lib/frames.mjs');
    if (!lib?.captureFrames) console.warn('build: lib/frames.mjs not found; skipping the frames');
    else {
      t = Date.now();
      const url = `${site()}/dreams/${id}?draft=1&autopilot=1`;
      const outDir = path.join(w.dir, 'frames');
      const fr = await lib.captureFrames({ url, outDir, timeoutS: Number(a.timeout) || 240 });
      T.frames = secs(t);
      frames = { count: fr.frames.length, errors: fr.errors.length };
      console.log(`build: ${id}: ${fr.frames.length} frame(s) in frames/, ${fr.errors.length} error(s) (${T.frames} s)`);
      for (const f of fr.frames) console.log(`  ${f.name}`);
    }
  }

  T.total = secs(t0);
  logEvent(w.dir, {
    step: 'build', ok: true, draft: true, bytes, draws: rep.glb.drawCalls, tris: rep.glb.triangles, uploaded, frames,
    seconds: T, blender: rep.timings,
  });
}

main().catch((err) => {
  console.error(`build: ${id}: ${err.status ? `HTTP ${err.status} ` : ''}${String(err.message || err).split('\n')[0]}`);
  logEvent(w.dir, { step: 'build', ok: false });
  process.exit(1);
});
