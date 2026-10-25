/* ============================================================================
   DL CODE LAB — export the layer specs and the lab cards for TensorFlow
   ----------------------------------------------------------------------------
     node tools/dl-codelab/export-specs.mjs

   Writes tools/dl-codelab/specs.json: every spec in codelab/specs.js with
   what counts.js computes for it (per-layer output shape, trainable and
   non-trainable counts, totals), plus the code of every lab card, so
   verify_counts.py can build the same models in Keras, compare, and smoke-
   fit the lab reconstructions. Run it before verify_counts.py.
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const HERE = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'));
const MOD = path.resolve(HERE, '../../src/components/portal/modules/deep-learning/codelab');
const imp = (f) => import(pathToFileURL(path.join(MOD, f)).href);

const { SPECS } = await imp('specs.js');
const { flow } = await imp('counts.js');
const { CARDS } = await imp('cards/index.js');

const specs = Object.values(SPECS).map((s) => {
  const f = flow(s);
  return {
    ...s,
    js: {
      rows: f.rows.map((r) => ({ id: r.id, type: r.type, out: r.out, tr: r.tr, nt: r.nt })),
      tr: f.tr,
      nt: f.nt,
      outputs: f.outputs,
    },
  };
});
const labs = CARDS.filter((c) => c.provenance === 'reconstructed').map((c) => ({ id: c.id, code: c.code, spec: c.moves?.count || c.moves?.draw || null }));
const out = path.join(HERE, 'specs.json');
fs.writeFileSync(out, `${JSON.stringify({ specs, labs }, null, 1)}\n`);
console.log(`wrote ${out}: ${specs.length} specs, ${labs.length} lab cards`);
