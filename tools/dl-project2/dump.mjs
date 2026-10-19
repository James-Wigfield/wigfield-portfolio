/* ============================================================================
   DL PROJECT 2 — dump the extracted notebook as plain text (for analysis)
     node tools/dl-project2/dump.mjs > notebook-dump.txt      every cell in full
     node tools/dl-project2/dump.mjs --map                    the cell map table
   Reads data/notebook.js (run extract.mjs first). Images are listed by file
   name, never inlined.
   ========================================================================== */
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MOD = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/project2');
const { NB_META, SECTIONS, CELLS } = await import(pathToFileURL(path.join(MOD, 'data/notebook.js')).href);

const secOf = (i) => SECTIONS.filter((s) => s.start <= i).pop()?.key ?? '-';

if (process.argv.includes('--map')) {
  console.log('| Cell | Type | In | Section | First line |');
  console.log('|---|---|---|---|---|');
  for (const c of CELLS) {
    const first = c.src.split('\n').find((l) => l.trim()) || '';
    const outs = c.outputs ? ` · ${c.outputs.length} out${c.outputs.some((o) => o.png) ? `, ${c.outputs.filter((o) => o.png).length} fig` : ''}` : '';
    console.log(`| ${c.i} | ${c.type} | ${c.ec ?? ''} | ${secOf(c.i)} | ${first.replace(/\|/g, '\\|').slice(0, 70)}${outs} |`);
  }
} else {
  console.log(JSON.stringify(NB_META, null, 1));
  for (const c of CELLS) {
    console.log(`\n${'='.repeat(78)}\n[cell ${c.i}] ${c.type}${c.type === 'code' ? ` In [${c.ec ?? ' '}]` : ''} · section ${secOf(c.i)}\n${'-'.repeat(78)}`);
    console.log(c.src);
    for (const [k, o] of (c.outputs || []).entries()) {
      console.log(`--- output ${k}: ${o.kind}${o.name ? ` (${o.name})` : ''}${o.noise ? ' [TF log noise]' : ''}${o.png ? ` → figures/${o.png} ${o.w}x${o.h}` : ''}`);
      if (o.text && !(o.noise && o.lines > 3)) console.log(o.text.replace(/\n$/, ''));
      else if (o.text) console.log(`${o.text.split('\n').slice(0, 2).join('\n')}\n… (${o.lines} lines of log)`);
      if (o.traceback) console.log(o.traceback);
    }
  }
}
