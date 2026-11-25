/* ============================================================================
   DREAM ROOMS · seed-local: load the fictional fixture nights into wrangler
   dev's LOCAL R2, through the real API. Never production (answer 1): it refuses
   any DREAMS_API whose host isn't localhost / 127.0.0.1 / [::1].

     DREAMS_API=http://127.0.0.1:8796 node tools/dream-rooms/seed-local.mjs
       [--reset]           purge the fixture ids first
       [--glb <path>]      the GLB for the rendered fixtures
                           (default: the newest world-v<N>.glb in any
                           dream-rooms-work/<id>/out/ folder)
       [--still <path>]    their hero still (default: a matching out/stills/*.webp)

   Create-once, so re-running changes nothing that's already there. Prints ids,
   statuses and counts only (decision 14).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { api, config, isLocalApi, REPO, WORK } from './lib/api.mjs';

const FIXTURES = path.join(REPO, 'tools/dream-rooms/samples/fixtures-nights.json');
const SAMPLE_WORLD = path.join(REPO, 'src/dream-rooms/contracts/fixtures/sample.world.json');

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const option = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

function fail(message) {
  console.error(`seed-local: ${message}`);
  process.exit(1);
}

/** The newest dream-rooms-work/<id>/out/world-v<N>.glb, or null. */
function newestGlb() {
  if (!fs.existsSync(WORK)) return null;
  const found = [];
  for (const id of fs.readdirSync(WORK)) {
    const out = path.join(WORK, id, 'out');
    if (!fs.existsSync(out)) continue;
    for (const f of fs.readdirSync(out)) if (/^world-v\d+\.glb$/.test(f)) found.push(path.join(out, f));
  }
  found.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return found[0] || null;
}

/** A still beside that GLB: out/stills/<first route module>.webp, else the first .webp there. */
function matchingStill(glb, routeFirst) {
  if (!glb) return null;
  const dir = path.join(path.dirname(glb), 'stills');
  if (!fs.existsSync(dir)) return null;
  const webps = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).sort();
  const pick = webps.find((f) => f === `${routeFirst}.webp`) || webps[0];
  return pick ? path.join(dir, pick) : null;
}

async function main() {
  const { base } = config();
  if (!isLocalApi(base)) fail(`refusing to seed ${new URL(base).host}: fixtures go into a local wrangler dev only (DREAMS_API must be localhost, 127.0.0.1 or [::1]).`);

  const ping = await api.ping();
  for (const f of ['nights', 'purge']) if (!ping?.features?.includes(f)) fail(`this Worker doesn't list "${f}" in its ping features`);

  const fixtures = JSON.parse(fs.readFileSync(FIXTURES, 'utf8')).dreams;
  const world = JSON.parse(fs.readFileSync(SAMPLE_WORLD, 'utf8'));
  const routeFirst = world.route?.[0] || world.modules[0].id;

  const glbArg = option('--glb');
  const glb = glbArg ? path.resolve(glbArg) : newestGlb();
  if (glbArg && !fs.existsSync(glb)) fail('--glb: no such file');
  const stillArg = option('--still');
  const still = stillArg ? path.resolve(stillArg) : matchingStill(glb, routeFirst);
  if (stillArg && !fs.existsSync(still)) fail('--still: no such file');
  const anyRendered = fixtures.some((f) => f.status === 'rendered');
  if (anyRendered && !glb) console.warn('WARN  no GLB found (pass --glb <path>, or build the sample first): rendered fixtures are seeded without a model');
  if (anyRendered && glb && !still) console.warn('WARN  no still found (pass --still <path>): rendered fixtures are seeded without a still');

  if (flag('--reset')) {
    let purged = 0;
    for (const f of fixtures) {
      try {
        await api.remove(f.id, { purge: true });
        purged += 1;
      } catch (err) {
        if (err.status !== 404) throw err;
      }
    }
    console.log(`reset: purged ${purged} of ${fixtures.length} fixture ids`);
  }

  // in night order, so each lands where the fixture says
  const ordered = [...fixtures].sort((a, b) => (a.dreamt_on < b.dreamt_on ? -1 : a.dreamt_on > b.dreamt_on ? 1 : a.night_order - b.night_order));
  const counts = { created: 0, existed: 0, withModel: 0, withStill: 0 };
  const statuses = {};

  for (const f of ordered) {
    const before = await api.get(f.id).catch((err) => (err.status === 404 ? null : Promise.reject(err)));
    if (before?.deleted_at) fail(`${f.id} is soft-deleted here; run with --reset`);
    const row = before || (await api.create({ id: f.id, dreamt_on: f.dreamt_on, night_order: f.night_order, raw_text: f.raw_text }));
    if (before) counts.existed += 1;
    else counts.created += 1;

    const notes = [];
    if (f.status === 'rendered') {
      // the sample world (no dream on a fixture row, so the Worker checks schema + structure only)
      if (JSON.stringify(row.world) !== JSON.stringify(world)) await api.patch(f.id, { world });
      const keys = {};
      if (glb && !row.model_key) {
        keys.model_key = (await api.putFile(f.id, 'model/world-v1.glb', glb)).key;
      }
      if (still && !row.still_key) {
        const ext = path.extname(still).slice(1).toLowerCase().replace('jpeg', 'jpg');
        keys.still_key = (await api.putFile(f.id, `stills/${routeFirst}.${ext}`, still)).key;
      }
      if (Object.keys(keys).length) await api.patch(f.id, keys);
      if (glb) notes.push('model');
      if (still) notes.push('still');
    }

    // status last: raw_text is already in (it freezes once status leaves captured)
    const patch = {};
    if (row.status !== f.status) patch.status = f.status;
    if ((row.title ?? null) !== (f.title ?? null)) patch.title = f.title ?? null;
    if ((row.fail_reason ?? null) !== (f.fail_reason ?? null)) patch.fail_reason = f.fail_reason ?? null;
    if (Object.keys(patch).length) await api.patch(f.id, patch);

    const final = await api.get(f.id);
    if (final.model_key) counts.withModel += 1;
    if (final.still_key) counts.withStill += 1;
    statuses[final.status] = (statuses[final.status] || 0) + 1;
    console.log(`${f.id}  ${final.dreamt_on} #${final.night_order}  ${final.status.padEnd(8)}  ${before ? 'exists ' : 'created'}${notes.length ? `  +${notes.join('+')}` : ''}`);
  }

  const list = await api.list();
  const nights = new Set(fixtures.map((f) => f.dreamt_on)).size;
  console.log(
    `seeded ${fixtures.length} fixtures over ${nights} nights: ${counts.created} created, ${counts.existed} already there; ` +
      `${Object.entries(statuses).map(([s, n]) => `${n} ${s}`).join(', ')}; ${counts.withModel} with a model, ${counts.withStill} with a still; ` +
      `the list now holds ${list.length} rows`,
  );
}

main().catch((err) => {
  console.error(`seed-local: ${err.status ? `${err.message.split('\n')[0]}` : err.message}`);
  process.exit(1);
});
