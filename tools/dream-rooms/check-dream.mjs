/* ============================================================================
   DREAM ROOMS · check-dream: the schema, every quote found, references resolve,
   motifs lower-case-hyphenated (CONTRACTS.md §3).
     node tools/dream-rooms/check-dream.mjs <id | work folder>
   Exit 0 = ok. Prints ids and paths only (decision 14).
   ========================================================================== */
import { checkDream } from '../../src/dream-rooms/contracts/validate.js';
import { args, loadWork, logEvent, printProblems } from './lib/work.mjs';

const a = args();
const w = loadWork(a._[0]);
if (!w.raw) throw new Error(`No raw.txt in ${w.dir}.`);
if (!w.dream) throw new Error(`No dream.json in ${w.dir}.`);

const r = checkDream(w.dream, w.raw);
printProblems('errors', r.errors);
printProblems('warnings', r.warnings);
const count = (k) => (w.dream[k] || []).length;
console.log(
  `check-dream ${r.ok ? 'OK' : 'FAILED'}: ${count('places')} places, ${count('links')} links, ${count('figures')} figures, ${count('objects')} objects, ${count('changes')} changes, ${count('vague')} vague, ${count('sound')} sounds${w.dream.time ? ', time' : ''}`,
);
console.log(`strangeness to cover in world.json: ${r.strangeness.join(', ') || 'none'}`);
logEvent(w.dir, { step: 'check-dream', ok: r.ok, errors: r.errors.length, warnings: r.warnings.length });
process.exit(r.ok ? 0 : 1);
