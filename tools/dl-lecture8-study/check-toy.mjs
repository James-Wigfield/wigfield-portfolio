/* ============================================================================
   DL LECTURE 8 STUDY — the toy transformer in JS vs the Keras reference
   ----------------------------------------------------------------------------
     node tools/dl-lecture8-study/check-toy.mjs

   Checks (any failure → exit 1)
     vocab      data/toyMT.js's SRC_VOCAB / TGT_VOCAB equal toyMT.js's
     grammar    allSentences() gives 208 sentences; referenceTranslation()
                agrees with the Python grammar on every fixture
     fixtures   for each sentence in toy-fixtures.json (written by
                tools/dl-lecture8-study/toy_mt.py --export from Keras with the
                same float16 weights): the greedy output words, the decoder
                inputs of the final pass, the last position's softmax, and every
                encoder self-, decoder masked self- and cross-attention weight
                match within the fixture tolerance (1e-4)
     accuracy   the JS model's greedy exact match over the whole grammar, split
                into trained and held-out sentences, equals the Python figures
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  SRC_VOCAB, TGT_VOCAB, buildModel, translate, allSentences, referenceTranslation,
  isValidSentence,
} from '../../src/components/portal/modules/deep-learning/lecture8-study/toyMT.js';
import * as data from '../../src/components/portal/modules/deep-learning/lecture8-study/data/toyMT.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const fx = JSON.parse(fs.readFileSync(path.join(here, 'toy-fixtures.json'), 'utf8'));
const TOL = fx.tolerance ?? 1e-4;
let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${label}${detail ? `: ${detail}` : ''}`);
  if (!cond) failures++;
};

function maxDiff(a, b) {
  if (Array.isArray(a) || ArrayBuffer.isView(a)) {
    if (!(Array.isArray(b) || ArrayBuffer.isView(b)) || a.length !== b.length) return Infinity;
    let m = 0;
    for (let i = 0; i < a.length; i++) m = Math.max(m, maxDiff(a[i], b[i]));
    return m;
  }
  return Math.abs(a - b);
}

console.log('vocab');
ok(JSON.stringify(data.SRC_VOCAB) === JSON.stringify(SRC_VOCAB), 'SRC_VOCAB matches the data file');
ok(JSON.stringify(data.TGT_VOCAB) === JSON.stringify(TGT_VOCAB), 'TGT_VOCAB matches the data file');

const t0 = Date.now();
const model = buildModel(data);
const params = Object.values(model.t).reduce((s, x) => s + x.data.length, 0);
ok(params === data.META.params, 'weights decoded', `${params} values (META.params ${data.META.params})`);

console.log('grammar');
const all = allSentences();
ok(all.length === 208, 'allSentences()', `${all.length} sentences`);
ok(all.every(isValidSentence), 'every sentence is valid');
ok(!isValidSentence(['I', 'like', 'red', 'soccer']), '"I like red soccer" rejected (mass nouns take no adjective)');
ok(data.HELD_OUT.length === fx.nHeldOut && !data.HELD_OUT.includes('I like soccer'),
  'HELD_OUT', `${data.HELD_OUT.length} sentences, "I like soccer" not among them`);
ok(JSON.stringify(referenceTranslation(['I', 'like', 'soccer'])) ===
  JSON.stringify(['me', 'gusta', 'el', 'fútbol']), 'I like soccer → me gusta el fútbol');

console.log('fixtures (JS vs Keras)');
for (const f of fx.fixtures) {
  const r = translate(model, f.src);
  const label = `${f.src.join(' ')}${f.heldOut ? ' (held out)' : ''}`;
  const ref = referenceTranslation(f.src);
  const dEnc = maxDiff(r.encSelf, f.encSelf);
  const dSelf = maxDiff(r.decSelf, f.decSelf);
  const dCross = maxDiff(r.cross, f.cross);
  const dProb = maxDiff(r.lastProbs, f.lastProbs);
  const good = JSON.stringify(r.out) === JSON.stringify(f.out)
    && JSON.stringify(r.decIn) === JSON.stringify(f.decIn)
    && JSON.stringify(ref) === JSON.stringify(f.expected)
    && Math.max(dEnc, dSelf, dCross, dProb) <= TOL;
  ok(good, label, `→ ${r.out.join(' ')} | max |Δ| enc ${dEnc.toExponential(1)}, dec-self `
    + `${dSelf.toExponential(1)}, cross ${dCross.toExponential(1)}, probs ${dProb.toExponential(1)}`
    + ` | shapes enc ${dims(r.encSelf)}, dec ${dims(r.decSelf)}, cross ${dims(r.cross)}`);
}

function dims(a) {
  const out = [];
  let x = a;
  while (Array.isArray(x)) { out.push(x.length); x = x[0]; }
  return out.join('×');
}

console.log('accuracy over the grammar (JS greedy decoding)');
const held = new Set(data.HELD_OUT);
const tally = { train: [0, 0], held: [0, 0] };
const wrong = [];
for (const s of all) {
  const key = held.has(s.join(' ')) ? 'held' : 'train';
  const r = translate(model, s);
  const hit = JSON.stringify(r.out) === JSON.stringify(referenceTranslation(s));
  tally[key][0] += hit ? 1 : 0;
  tally[key][1] += 1;
  if (!hit) wrong.push(`${s.join(' ')} → ${r.out.join(' ')}`);
}
const trainEM = tally.train[0] / tally.train[1];
const heldEM = tally.held[0] / tally.held[1];
ok(trainEM === fx.trainEM, 'train exact match', `${tally.train[0]}/${tally.train[1]} (Python ${fx.trainEM})`);
ok(heldEM === fx.heldOutEM, 'held-out exact match', `${tally.held[0]}/${tally.held[1]} (Python ${fx.heldOutEM})`);
for (const w of wrong) console.log(`    wrong: ${w}`);
console.log(`  (${all.length + fx.fixtures.length} translations in ${Date.now() - t0} ms)`);

if (failures) {
  console.error(`\n${failures} check(s) failed`);
  process.exit(1);
}
console.log('\nall toy transformer checks passed');
