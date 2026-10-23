/* The Exchange — fidelity check (node tools/dl-arcade/check-the-exchange.mjs)
   1. Hand-worked examples from the Lecture 8 equations:
      slide 25  α(t,i) = exp(e(t,i)) / Σ exp(e(t,i′)); h̃(t) = Σ α(t,i) y(i)
      slide 24–25  dot-product score h(t)ᵀ y(i)
      slide 37–38  QKᵀ / √d_keys
   2. The patch grader: the toy's own weights pass; a mutated patch fails.
   3. 30 seeded rounds per level (with the toy transformer loaded): every item
      has an id, a concept in the catalogue, a src, a why and a gradable answer. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DL = path.resolve(HERE, '../../src/components/portal/modules/deep-learning');
const imp = (p) => import(pathToFileURL(path.join(DL, p)).href);

const { softmax, dot, weightedSum } = await imp('lecture8-study/attn.js');
const { makeItems, gradePatch, plugsToWeights, argmax } = await imp('arcade/maths/theExchange.js');
const { rng } = await imp('arcade/core/rng.js');
const { CONCEPT_IDS } = await imp('arcade/core/concepts.js');
const { loadToyMT } = await imp('lecture8-study/toyMT.js');
const { grade } = await imp('arcade/kit/grade.js');

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };

// slide 25: e = [2, 0, −1] → α = e^2/(e^2+e^0+e^−1) = 7.389/(7.389+1+0.368) = 0.8438
const a = softmax([2, 0, -1]);
ok(Math.abs(a[0] - 0.8438) < 1e-3 && Math.abs(a.reduce((s, x) => s + x, 0) - 1) < 1e-12, 'slide 25 softmax');
// slide 25: α = [0.7, 0.2, 0.1], y(0) = [1, 2], y(1) = [−1, 0], y(2) = [2, 2] → h̃ = [0.7−0.2+0.2, 1.4+0+0.2] = [0.7, 1.6]
const h = weightedSum([0.7, 0.2, 0.1], [[1, 2], [-1, 0], [2, 2]]);
ok(Math.abs(h[0] - 0.7) < 1e-12 && Math.abs(h[1] - 1.6) < 1e-12, 'slide 25 weighted sum');
// slide 24–25: h = [1, 2, −1] · y = [2, 0, 3] = 2 + 0 − 3 = −1
ok(dot([1, 2, -1], [2, 0, 3]) === -1, 'slide 24 dot product');
// slide 37–38: 12 / √16 = 3
ok(12 / Math.sqrt(16) === 3, 'slide 38 scaling');

// the grader
ok(gradePatch([0.82, 0.18, 0], [0.71, 0.18, 0.11]), 'bright/dim/off passes a 0.71/0.18/0.11 target');
ok(!gradePatch([0, 0.18, 0.82], [0.71, 0.18, 0.11]), 'wrong argmax fails');
ok(!gradePatch([0.34, 0.33, 0.33], [0.9, 0.05, 0.05]), 'flat patch on a peaked target fails (L1 > 0.6)');
const w = plugsToWeights(['bright', 'dim', 'off']);
ok(Math.abs(w.reduce((s, x) => s + x, 0) - 1) < 1e-12 && argmax(w) === 0, 'plugs normalise to 1');

// rounds
const model = await loadToyMT();
let patches = 0;
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = makeItems(rng(seed), level, model);
    ok(items.length >= 7, `level ${level} seed ${seed}: ${items.length} items`);
    for (const it of items) {
      ok(it.id && it.concept && it.src && it.why && it.answer !== undefined, `item fields ${it.id}`);
      ok(CONCEPT_IDS.includes(it.concept), `concept ${it.concept} in catalogue`);
      ok(it.src.lecture === 8 && it.src.slides.length > 0, `src ${it.id}`);
      ok(grade(it, it.answer), `own answer grades true ${it.id}`);
      if (it.kind === 'choice') ok(it.choices.length === 4 && it.choices.some((c) => c.value === it.answer), `choices ${it.id}`);
      if (it.board) { patches++; ok(!grade(it, it.answer.map((x, i) => (i === argmax(it.answer) ? 0 : x + 1))), `mutated patch fails ${it.id}`); }
      if (it.order) ok(!grade(it, it.answer.slice().reverse()), `reversed order fails ${it.id}`);
      if (it.kind === 'number') ok(!grade(it, it.answer + 1), `off-by-one fails ${it.id}`);
    }
  }
}
ok(patches > 100, `patch items generated (${patches})`);
console.log(`check-the-exchange: ${n} assertions passed · ${patches} patch items across 90 rounds`);
