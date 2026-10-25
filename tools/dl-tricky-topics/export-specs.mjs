/* ============================================================================
   DL TRICKY TOPICS — export everything verify_counts.py must check
   ----------------------------------------------------------------------------
     node tools/dl-tricky-topics/export-specs.mjs        → specs.json (here)

   Iterates src/…/tricky-topics/topics/index.js — so a new topic is picked up
   with no edit here — and collects, with the JS answers alongside:
     models   every named model (maths/models.js) and every model a topic's
              drill generates for seeds 1 … N (q.model), with this page's
              per-layer trainable / non-trainable counts and output shapes
     checks   any q.verify a drill question carries:
                { kind: 'softmax', z, p }           probabilities
                { kind: 'size', layer, n, k, s, pad, out }   one output size
     sweep    the output-size sweep (n ≤ 40, k ≤ 7, s ≤ 4, both paddings)
              for Conv1D, Conv2D, MaxPool2D and Conv2DTranspose, with
              strideRules.js's answers
     softmax  fixed logit vectors (and shifted copies) with softmax.js's p
   Topic files a node script imports must be plain JS (no JSX): topic.js,
   drill.js, sheets/*.js, exportPrompt.js (ADDING-A-TOPIC.md says so).
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..', '..');
const ROOT = path.join(REPO, 'src/components/portal/modules/deep-learning/tricky-topics');
const imp = (p) => import(pathToFileURL(path.join(ROOT, p)).href);
const N_SEEDS = Number(process.env.SEEDS || 200);

const { TOPICS } = await imp('topics/index.js');
const { MODELS } = await imp('maths/models.js');
const { countModel } = await imp('maths/paramRules.js');
const { convOut, poolOut, convTOut } = await imp('maths/strideRules.js');
const { softmax, sigmoid } = await imp('maths/softmax.js');

function jsAnswer(model) {
  const C = countModel(model);
  return {
    rows: C.rows.map((r) => ({ t: r.L.t, out: r.out, trainable: r.trainable, nonTrainable: r.nonTrainable })),
    trainable: C.trainable,
    nonTrainable: C.nonTrainable,
  };
}

const models = Object.entries(MODELS).map(([id, m]) => ({ id, source: `models.js · ${m.at}`, model: m.model, js: jsAnswer(m.model), printed: m.printed }));
const checks = [];
const seen = new Set();
for (const t of TOPICS) {
  let drill;
  try {
    drill = await imp(`topics/${t.id}/drill.js`);
  } catch (e) {
    console.log(`(no drill.js for ${t.id}: ${e.message})`);
    continue;
  }
  const modes = drill.MODES ? drill.MODES.map((m) => m.value) : [undefined];
  const qs = [];
  for (const mode of modes) for (let seed = 1; seed <= N_SEEDS; seed++) qs.push(drill.make(seed, mode));
  (drill.FIXED ?? []).forEach((q) => qs.push(q));
  qs.forEach((q) => {
    if (q.model) {
      const key = JSON.stringify(q.model);
      if (!seen.has(key)) {
        seen.add(key);
        models.push({ id: `${t.id}:${q.id}`, source: `${t.id} drill`, model: q.model, js: jsAnswer(q.model) });
      }
    }
    (Array.isArray(q.verify) ? q.verify : q.verify ? [q.verify] : []).forEach((v) => checks.push({ id: `${t.id}:${q.id}`, ...v }));
  });
}

const sweep = [];
for (let n = 1; n <= 40; n++) for (let k = 1; k <= 7; k++) for (let s = 1; s <= 4; s++) for (const pad of ['valid', 'same']) {
  if (pad === 'valid' && n < k) continue;
  sweep.push({ n, k, s, pad, conv: convOut(n, k, s, pad), pool: poolOut(n, k, s, pad), convT: convTOut(n, k, s, pad) });
}

const LOGITS = [[2, 1, 0.1], [1, 2, 3], [0, 0, 0], [5, -2, 0.5, 3], [10, 0], [-1, -2, -3, -4, -5], [3.2, 1.3, 0.2, 0.8], [20, 19, 0]];
const soft = LOGITS.flatMap((z) => [
  { z, p: softmax(z) },
  { z: z.map((v) => v + 7), p: softmax(z.map((v) => v + 7)) },
]);

// sigmoid (the binary output and CartPole's policy): softmax.js's sigmoid on a grid of scores
const sig = [-6, -3, -2, -1, -0.5, 0, 0.4, 0.5, 1, 1.5, 2, 3, 6].map((z) => ({ z, p: sigmoid(z) }));

const out = { generated: new Date().toISOString(), topics: TOPICS.map((t) => t.id), models, checks, sweep, softmax: soft, sigmoid: sig };
fs.writeFileSync(path.join(HERE, 'specs.json'), JSON.stringify(out));
console.log(`specs.json: ${models.length} models (${Object.keys(MODELS).length} named), ${checks.length} checks, ${sweep.length} sweep points, ${soft.length} softmax vectors`);
for (const [id, m] of Object.entries(MODELS)) {
  const C = countModel(m.model);
  console.log(`${id.padEnd(22)} total ${String(C.total).padStart(9)}  trainable ${String(C.trainable).padStart(9)}  non-trainable ${String(C.nonTrainable).padStart(6)}  out ${JSON.stringify(C.rows.at(-1).out)}`);
}
