/* ============================================================================
   DREAM ROOMS · quote-spans: fill every `src` in dream.json from its quotes, with
   indexOf (decision 4). Claude never counts characters.
     node tools/dream-rooms/quote-spans.mjs <id | work folder>
   Rewrites dream-rooms-work/<id>/dream.json. A quote that isn't in raw.txt is an
   error: fix the quote (copy his words exactly), don't fudge it. Prints ids only.
   ========================================================================== */
import path from 'node:path';
import { fillSpans } from '../../src/dream-rooms/contracts/spans.js';
import { args, loadWork, logEvent, writeJson } from './lib/work.mjs';

const a = args();
const w = loadWork(a._[0]);
if (!w.raw) throw new Error(`No raw.txt in ${w.dir} (run pull.mjs first).`);
if (!w.dream) throw new Error(`No dream.json in ${w.dir} (write it first).`);

const { dream, missing } = fillSpans(w.dream, w.raw);
if (missing.length) {
  console.log(`quote-spans: ${missing.length} quote(s) not found in raw.txt; copy them exactly:`);
  for (const m of missing) console.log(`  · ${m}`);
  process.exit(1);
}
writeJson(path.join(w.dir, 'dream.json'), dream);
const n = [dream.mood, dream.time, ...['places', 'links', 'figures', 'objects', 'changes', 'vague', 'sound'].flatMap((k) => dream[k] || [])]
  .filter(Boolean)
  .reduce((s, e) => s + (e.src?.length || 0), 0);
logEvent(w.dir, { step: 'quote-spans', spans: n });
console.log(`quote-spans: ${n} spans written to dream.json`);
