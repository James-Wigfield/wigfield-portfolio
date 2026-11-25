/* ============================================================================
   DREAM ROOMS · check-world: world.json against its dream (CONTRACTS.md §4).
     node tools/dream-rooms/check-world.mjs <id | work folder> [--must-keep <file>]
   Checks the schema, sizes and atlas budgets, a walkable route from spawn
   through every module, doorways inside their walls, the strangeness check
   (every two-place `is`, impossible link, change, vague patch and time
   contradiction is covered by a `for` or dropped with a reason), the
   no-default-look check (every finish, fixture and light cited or invented
   with a why) and the fit check. --must-keep checks a list of things that must
   survive (the self-test's samples/must-keep.json). Prints ids and paths only.
   ========================================================================== */
import { checkWorld, entities } from '../../src/dream-rooms/contracts/validate.js';
import { args, loadWork, logEvent, printProblems, readJson } from './lib/work.mjs';

const a = args();
const w = loadWork(a._[0]);
if (!w.world) throw new Error(`No world.json in ${w.dir}.`);
if (!w.dream) throw new Error(`No dream.json in ${w.dir}.`);

const r = checkWorld(w.world, { dream: w.dream, text: w.raw });
printProblems('errors', r.errors);
printProblems('warnings', r.warnings);
const covered = Object.keys(r.coverage || {});
const dropped = (w.world.dropped || []).map((d) => d.id);
console.log(`coverage: ${covered.length} dream ids cited (${covered.sort().join(', ')}); dropped: ${dropped.join(', ') || 'none'}`);
if (r.fit) console.log(`fit check: ${r.fit.dropped}/${r.fit.entities} dropped → ${r.fit.still ? 'still fallback' : 'walk'}${w.world.fallback ? ` (world says ${w.world.fallback})` : ''}`);

let keepOk = true;
if (a['must-keep']) {
  const list = readJson(a['must-keep']).items;
  const ents = entities(w.dream);
  list.forEach((item, i) => {
    const hit = ents.find(([, e]) => (e.quote || []).some((q) => q.includes(item.quote) || item.quote.includes(q)));
    const id = hit?.[0];
    const isCovered = id && r.coverage[id] && !dropped.includes(id);
    if (!isCovered) keepOk = false;
    console.log(`${isCovered ? 'PASS' : 'FAIL'}  must-keep ${i + 1} (${item.id || '?'}) → ${id || 'no entity quotes it'}${isCovered ? ` via ${r.coverage[id].length} mechanism(s)` : ''}`);
  });
}

console.log(`check-world ${r.ok && keepOk ? 'OK' : 'FAILED'}`);
logEvent(w.dir, { step: 'check-world', ok: r.ok, errors: r.errors.length, warnings: r.warnings.length, fallback: w.world.fallback || null });
process.exit(r.ok && keepOk ? 0 : 1);
