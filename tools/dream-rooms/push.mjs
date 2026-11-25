/* ============================================================================
   DREAM ROOMS · push: upload a finished build and mark the dream `rendered`.
     node tools/dream-rooms/push.mjs <id>
     node tools/dream-rooms/push.mjs <id> --fail "<one line, no dream words>"
   Saves both contracts (dream.json + world.json; the Worker validates them and
   bumps their versions), uploads out/world-v*.glb as model/world-v<N>.glb (N =
   the world version the Worker just gave it; the previous GLB stays, so a
   re-render never breaks the live dream) and out/stills/*.webp, points model_key
   + still_key at them, clears the draft and sets status `rendered`. A still-
   fallback world uploads stills only. On any failure: status `failed` with a
   one-line reason. Prints ids, sizes and statuses only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { api } from './lib/api.mjs';
import { args, loadWork, logEvent } from './lib/work.mjs';

const a = args();
const w = loadWork(a._[0]);
const id = w.row?.id || w.id;

async function fail(reason) {
  try {
    await api.patch(id, { status: 'failed', fail_reason: reason.slice(0, 200) });
  } catch {
    /* the row may be unreachable; the exit code still says it failed */
  }
  logEvent(w.dir, { step: 'push', ok: false });
  console.error(`push: ${id} → failed (${reason})`);
  process.exit(1);
}

if (a.fail) await fail(String(a.fail));

async function main() {
  if (!w.dream || !w.world) return fail('dream.json or world.json missing in the work folder');
  const ping = await api.ping();
  const features = ping?.features || [];
  for (const f of ['nights', 'draft']) if (!features.includes(f)) return fail(`the Worker doesn't list feature ${f}; deploy the Worker first`);

  const out = path.join(w.dir, 'out');
  const still = w.world.fallback === 'still';
  const glbs = fs.existsSync(out) ? fs.readdirSync(out).filter((f) => /^world-v\d+\.glb$/.test(f)) : [];
  glbs.sort((x, y) => Number(x.match(/\d+/)[0]) - Number(y.match(/\d+/)[0]));
  const glb = glbs.length ? path.join(out, glbs[glbs.length - 1]) : null;
  if (!still && !glb) return fail('no out/world-v*.glb (run bake.mjs)');
  const stillsDir = path.join(out, 'stills');
  const stills = fs.existsSync(stillsDir) ? fs.readdirSync(stillsDir).filter((f) => /^[a-z0-9_-]+\.(webp|jpg|png)$/.test(f)) : [];
  if (still && !stills.length) return fail('a still-fallback dream needs out/stills/*');

  // 1. both contracts (validated by the Worker; versions bump)
  const before = await api.get(id);
  const row = await api.patch(id, { dream: w.dream, world: { ...w.world, dream_version: w.world.dream_version ?? 0 }, title: w.dream.title });
  // never overwrite the live GLB: a re-render with an unchanged world still gets a new file number
  const live = Number((before.model_key || '').match(/world-v(\d+)\.glb$/)?.[1] || 0);
  const N = Math.max(row.world_version, live + 1);

  // 2. files
  let modelKey = null;
  let bytes = 0;
  if (glb) {
    const buf = fs.readFileSync(glb);
    bytes += buf.length;
    await api.putFile(id, `model/world-v${N}.glb`, buf, 'model/gltf-binary');
    modelKey = `dreams/${id}/model/world-v${N}.glb`;
  }
  const keys = [];
  for (const f of stills) {
    const buf = fs.readFileSync(path.join(stillsDir, f));
    bytes += buf.length;
    await api.putFile(id, `stills/${f}`, buf);
    keys.push(`dreams/${id}/stills/${f}`);
  }
  const first = w.world.route?.[0];
  const hero = keys.find((k) => first && k.endsWith(`/stills/${first}.webp`)) || keys[0] || null;

  // 3. point the row at them
  await api.patch(id, { model_key: modelKey, still_key: hero, status: 'rendered', fail_reason: null });
  try {
    await api.deleteDraft(id);
  } catch {
    /* no draft is fine */
  }
  logEvent(w.dir, { step: 'push', ok: true, world_version: N, bytes, stills: keys.length, fallback: still ? 'still' : null });
  console.log(`push: ${id} → rendered  (world v${N}, ${(bytes / 1048576).toFixed(2)} MB, ${keys.length} still(s)${still ? ', still fallback' : ''})`);
}

main().catch((err) => fail(`${err.status ? `HTTP ${err.status} ` : ''}${String(err.message || err).split('\n')[0]}`));
