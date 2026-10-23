/* Forger — fidelity check (node tools/dl-arcade/check-forger.mjs)
   1. The two phases' ingredients against the slide text: content/forger.js
      SLIDE_TEXT is compared with the PDF (pdftotext, when installed); every
      quote behind an ingredient / fact is in that text; the recipe answers
      mean what slides 21–22 say and what slide 25's code does (y1, y2, the
      trainable toggles, fakes first in X_fake_and_real).
   2. The code the game shows is the slides' code: slide 25's loop lines and
      their order, the gap answers, slide 29's DCGAN lines, the spot answers,
      the build answers against slide 28's guidelines, the slide anchors
      (codings_size 30 / 100, batch_size 32, 64 rows, 6272 units).
   3. ToyGan sanity (lecture6-7-study/gen.js, this page's own runs): phase 1
      lowers the discriminator's loss on its own batch and leaves the
      generator exactly unchanged; phase 2 leaves the discriminator's weights
      exactly unchanged (snapshot() + maxChange) and moves the generator; the
      studio demos show what the level-1 items claim; the level-2 frames are
      what their verdicts say (weak collapsed / balanced covered / weak
      unstable after a long collapse).
   4. 30 seeded rounds per level: every item has an id, a concept in the
      catalogue, a src (lecture 6, slides 19–30), a why and a gradable answer
      (its own answer grades right, also after a JSON round trip; a wrong
      one grades wrong), and its answer key is re-derived independently. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const DL = path.join(ROOT, 'src/components/portal/modules/deep-learning');
const imp = (p) => import(pathToFileURL(path.join(DL, p)).href);

const gen = await imp('lecture6-7-study/gen.js');
const C = await imp('arcade/content/forger.js');
const L67 = await imp('arcade/content/lecture67.js');
const F = await imp('arcade/maths/forger.js');
const S = await imp('arcade/maths/forgerStudio.js');
const { rng } = await imp('arcade/core/rng.js');
const { CONCEPT_IDS } = await imp('arcade/core/concepts.js');
const { grade } = await imp('arcade/kit/grade.js');

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };
const words = (s) => String(s).toLowerCase().replace(/[’']/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const squash = (s) => String(s).replace(/\s+/g, ' ').trim();

/* ── 1. the slide text ─────────────────────────────────────────────────── */
const PDF = path.join(ROOT, 'Documents/cits5017/lectures/cits5017-lect06-07-AE-conv-var-GAN.pdf');
let pdfChecked = 0;
for (const [slide, text] of Object.entries(C.SLIDE_TEXT)) {
  const r = spawnSync('pdftotext', ['-layout', '-f', slide, '-l', slide, PDF, '-'], { encoding: 'utf8' });
  if (r.status !== 0 || !r.stdout) continue;
  const page = words(r.stdout);
  for (const sentence of text.split(/(?<=[.!])\s+/)) {
    ok(page.includes(words(sentence)), `slide ${slide} prints "${sentence.slice(0, 70)}…"`);
  }
  pdfChecked++;
}
if (!pdfChecked) console.log('  (pdftotext not found: SLIDE_TEXT not compared with the PDF)');

for (const p of [1, 2]) {
  const P = C.PHASES[p];
  for (const [row, quote] of Object.entries(P.quotes)) ok(C.SLIDE_TEXT[p === 1 ? 21 : 22].includes(quote), `phase ${p} ${row}: quote is on slide ${p === 1 ? 21 : 22}`);
}
for (const f of C.FACTS) {
  if (f.quote) ok(C.SLIDE_TEXT[f.quoteSlide]?.includes(f.quote), `fact ${f.id}: quote is on slide ${f.quoteSlide}`);
  ok(f.choices.length >= 3 && new Set(f.choices.map((c) => c.key)).size === f.choices.length, `fact ${f.id}: ≥ 3 distinct choices`);
  ok(f.src.slides.every((s) => s >= 19 && s <= 30), `fact ${f.id}: slides 19–30`);
}
C.GUIDELINES.forEach((g) => ok(C.SLIDE_TEXT[28].includes(g.text), `guideline ${g.n} is slide 28's text`));

// what each ingredient means, against slides 21–22
const ing = (row, key) => C.INGREDIENTS[row].find((o) => o.key === key);
const p1 = C.PHASES[1].answer;
const p2 = C.PHASES[2].answer;
ok(ing('batch', p1.batch).real && ing('batch', p1.batch).fake && /equal number of fake images/.test(C.PHASES[1].quotes.batch), 'phase 1 batch: real images completed with an equal number of fakes (slide 21)');
ok(ing('labels', p1.labels).fakeLabel === 0 && ing('labels', p1.labels).realLabel === 1, 'phase 1 labels: fake 0, real 1 (slide 21)');
ok(ing('learns', p1.learns).d && !ing('learns', p1.learns).g, 'phase 1: only the discriminator learns (slide 21)');
ok(!ing('batch', p2.batch).real && ing('batch', p2.batch).fake, 'phase 2 batch: fakes, no real images (slide 22)');
ok(ing('labels', p2.labels).fakeLabel === 1 && /all the labels are set to 1/.test(C.PHASES[2].quotes.labels), 'phase 2 labels: all 1 (slide 22)');
ok(ing('learns', p2.learns).g && !ing('learns', p2.learns).d, 'phase 2: only the generator learns, discriminator frozen (slide 22)');
ok(['batch', 'labels', 'learns'].some((r) => p1[r] !== p2[r]) && ['batch', 'labels', 'learns'].every((r) => p1[r] !== p2[r]), 'the two recipes differ in every row');

// …and against slide 25's code
const TRAIN = L67.CODE.find((c) => c.id === 'l67.gan.train').text.split('\n').map((l) => l.trim());
// the same lines without the "# *** this line is missing in the author's code" comments (the game trims them)
const TRAIN_NC = TRAIN.map((l) => l.replace(/\s+# \*\*\*.*$/, ''));
const idx = (needle) => TRAIN.findIndex((l) => l.startsWith(needle));
ok(TRAIN.includes('X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)'), 'slide 25: fakes first, then X_batch');
ok(TRAIN.includes('y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)'), 'slide 25: y1 = zeros (fakes) then ones (real)');
ok(TRAIN.includes('y2 = tf.constant([[1.]] * batch_size)'), 'slide 25: y2 all ones');
const iTrue = idx('discriminator.trainable = True');
const iDTrain = idx('discriminator.train_on_batch(X_fake_and_real, y1)');
const iFalse = idx('discriminator.trainable = False');
const iGTrain = idx('gan.train_on_batch(noise, y2)');
ok(iTrue >= 0 && iTrue < iDTrain && iDTrain < iFalse && iFalse < iGTrain, 'slide 25: True → D.train_on_batch → False → gan.train_on_batch');
C.PHASES[1].code.concat(C.PHASES[2].code).forEach((l) => ok(TRAIN.includes(l.trim()), `phase code line on slide 25: ${l.slice(0, 50)}`));

/* ── 2. the code the game shows ────────────────────────────────────────── */
let last = -1;
for (const l of C.LOOP.lines) {
  const at = TRAIN_NC.indexOf(l.code.trim(), last + 1);
  ok(at > last, `loop line in slide-25 order: ${l.code.trim().slice(0, 50)}`);
  last = at;
}
for (const set of C.ORDER_SETS) {
  if (set.cards.every((c) => c.code)) {
    const pos = set.cards.map((c) => TRAIN_NC.indexOf(c.code));
    ok(pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])), `order ${set.id}: cards are slide 25's lines in its order`);
  } else ok(set.cards.length === 4 && set.src.slides.includes(25), `order ${set.id}: four steps, slide 25`);
}
for (const g of C.GAPS) {
  const line = C.LOOP.lines.find((l) => l.id === g.line);
  ok(line && g.choices[0].key === 'right' && g.choices[0].code === line.code.trim(), `gap ${g.id}: the right choice is the printed line`);
  const li = TRAIN_NC.indexOf(line.code.trim());
  ok(li >= 0 && g.choices.slice(1).every((c) => c.code !== line.code.trim() && !TRAIN_NC.slice(li - 1, li + 2).includes(c.code)), `gap ${g.id}: no distractor is the printed line or its neighbour`);
}
const DC = squash(L67.CODE.find((c) => c.id === 'l67.dcgan.nets').text);
for (const net of ['gen', 'disc']) {
  ok(DC.includes(squash(C.DCGAN[net].head)), `slide 29 ${net} head`);
  C.DCGAN[net].lines.forEach((l) => ok(DC.includes(squash(l.code)), `slide 29 ${net}: ${squash(l.code).slice(0, 50)}`));
}
const lineOf = (net, id) => C.DCGAN[net].lines.find((l) => l.id === id).code;
for (const s of C.SPOT) {
  ok(s.candidates.includes(s.answer) && s.candidates.every((id) => C.DCGAN[s.net].lines.some((l) => l.id === id)), `spot ${s.id}: answer among real lines`);
  const others = s.candidates.filter((id) => id !== s.answer).map((id) => lineOf(s.net, id));
  const ans = lineOf(s.net, s.answer);
  if (s.id === 's.g4') ok(!/activation=/.test(ans) && others.every((l) => /activation="(relu|tanh)"/.test(l)), 'spot g4: only the answer lacks ReLU / tanh');
  if (s.id === 's.g5') ok(/sigmoid/.test(ans) && others.every((l) => /LeakyReLU\(0\.2\)/.test(l)), 'spot g5: only the answer is not leaky ReLU');
  if (s.id === 's.g3') ok(/Dense\(/.test(ans) && others.every((l) => !/Dense\(/.test(l)), 'spot g3: only the answer is fully connected');
  if (s.id === 's.g2') ok(s.answer === C.DCGAN.gen.lines[C.DCGAN.gen.lines.length - 1].id && /tanh/.test(ans), 'spot g2: the answer is the tanh output layer');
}
const G28 = C.SLIDE_TEXT[28];
const guide = {
  'g.sample': ['transposed', 'transposed convolutions (in the generator)'],
  'd.sample': ['strided', 'strided convolutions (in the discriminator)'],
  'g.bn': ['notOut', 'except in the generator\'s output layer'],
  'd.bn': ['notIn', 'the discriminator\'s input layer'],
  'g.hidden': ['relu', 'Use ReLU activation in the generator for all layers except the output layer'],
  'g.out': ['tanh', 'which should use tanh'],
  'd.act': ['leaky', 'Use leaky ReLU activation in the discriminator for all layers'],
  'g.fc': ['remove', 'Remove fully connected hidden layers for deeper architectures'],
  'd.fc': ['remove', 'Remove fully connected hidden layers for deeper architectures'],
};
for (const [slot, [answer, quote]] of Object.entries(guide)) {
  ok(C.BUILD.slots[slot].answer === answer && G28.includes(quote), `build ${slot}: ${answer} — "${quote}"`);
  ok(C.BUILD.slots[slot].options.some((o) => o.key === answer) && C.BUILD.slots[slot].options.length >= 2, `build ${slot}: answer offered`);
}
ok(Object.keys(C.BUILD.slots).every((s) => s in guide), 'every build slot is checked');
const anchor = (id) => L67.ANCHORS.find((a) => a.id === id).value;
ok(7 * 7 * 128 === anchor('l67.dcgan.dense.6272') && C.NUMBERS.dense.answer === 6272, 'Dense(7 * 7 * 128) = 6272 (slide 29 anchor)');
ok(C.NUMBERS.noise.find((x) => x.id === 'gan').codings === anchor('l67.gan.codings.30'), 'GAN codings_size = 30 (slide 23)');
ok(C.NUMBERS.noise.find((x) => x.id === 'dcgan').codings === anchor('l67.dcgan.codings.100'), 'DCGAN codings_size = 100 (slide 29)');
ok(C.NUMBERS.batches.includes(anchor('l67.gan.batch.32')) && 2 * 32 === anchor('l67.gan.phase1.batch.64'), 'batch_size 32 → 64 rows (slides 24–25)');

/* ── 3. the toy GAN ────────────────────────────────────────────────────── */
const bce = (m, xs, ys) => xs.reduce((a, x, i) => { const p = m.disc(x).p; return a - (ys[i] * Math.log(p + 1e-12) + (1 - ys[i]) * Math.log(1 - p + 1e-12)); }, 0) / xs.length;
for (const key of ['one', 'balanced', 'weak']) {
  for (const t of [0, 40, 150]) {
    const m = S.restore(key, S.stateAt(key, t), 31 + t);
    const s0 = m.snapshot();
    const b1 = m.phase1();
    const s1 = m.snapshot();
    const xs = [...b1.fake, ...b1.real];
    ok(b1.labels.length === 2 * m.cfg.batch && b1.labels.slice(0, m.cfg.batch).every((v) => v === 0) && b1.labels.slice(m.cfg.batch).every((v) => v === 1), `${key}@${t}: phase 1 batch = ${m.cfg.batch} fakes (0) then ${m.cfg.batch} real (1), like y1`);
    ok(bce(m, xs, b1.labels) < b1.loss, `${key}@${t}: phase 1 lowers the discriminator's loss on its batch (${b1.loss.toFixed(4)} → ${bce(m, xs, b1.labels).toFixed(4)})`);
    ok(gen.maxChange(s0.G, s1.G) === 0 && gen.maxChange(s0.D, s1.D) > 0, `${key}@${t}: phase 1 moves D only (G exactly unchanged)`);
    const b2 = m.phase2();
    const s2 = m.snapshot();
    ok(b2.labels.length === m.cfg.batch && b2.labels.every((v) => v === 1), `${key}@${t}: phase 2 batch = ${m.cfg.batch} fakes, all labelled 1, like y2`);
    ok(gen.maxChange(s1.D, s2.D) === 0 && gen.maxChange(s1.G, s2.G) > 0, `${key}@${t}: phase 2 leaves D exactly unchanged (frozen) and moves G`);
  }
}
const at = (fr, x) => fr.d[fr.grid.reduce((b, g, i) => (Math.abs(g - x) < Math.abs(fr.grid[b] - x) ? i : b), 0)];
const bump = gen.TARGETS.one.modes[0].m;
for (const t of C.STUDIO.p1At) {
  const d = S.demo('one', t, 1);
  const moved = Math.max(...d.after.d.map((v, i) => Math.abs(v - d.before.d[i])));
  ok(d.gMax === 0 && d.dMax > 0, `studio p1@${t}: generator exactly unchanged, discriminator moved`);
  ok(moved >= 0.15 && at(d.after, bump) > at(d.before, bump) && at(d.after, d.before.mean) < at(d.before, d.before.mean), `studio p1@${t}: D sharpens visibly (max ΔP ${moved.toFixed(2)}; P(real) up on the bump, down on the fakes)`);
  ok(d.after.hist.every((v, i) => v === d.before.hist[i]), `studio p1@${t}: the forgeries are identical`);
}
for (const t of C.STUDIO.p2At) {
  const d = S.demo('one', t, 2);
  ok(d.dMax === 0 && d.gMax > 0, `studio p2@${t}: discriminator exactly unchanged (frozen), generator moved`);
  ok(d.after.d.every((v, i) => v === d.before.d[i]), `studio p2@${t}: the P(real) curve is identical`);
  ok(Math.abs(d.after.mean - bump) < Math.abs(d.before.mean - bump) - 0.25, `studio p2@${t}: the forgeries move toward the bump (${d.before.mean.toFixed(2)} → ${d.after.mean.toFixed(2)})`);
}
// level 2: the verdicts are what the runs show
const verdictOf = (fr) => {
  const [a, b] = fr.cover;
  if ((a >= 0.9 && b <= 0.05) || (b >= 0.9 && a <= 0.05)) return 'collapse';
  if (a >= 0.35 && b >= 0.35) return 'covered';
  if (a < 0.15 && b < 0.15 && fr.sd > 3) return 'unstable';
  return null;
};
for (const [verdict, fr] of Object.entries(C.DIAG.frames)) {
  for (const t of fr.at) ok(verdictOf(S.frameAt(fr.preset, t)) === verdict, `${fr.preset}@${t} is "${verdict}" (cover ${S.frameAt(fr.preset, t).cover.map((v) => v.toFixed(2)).join('/')})`);
}
const weak = new gen.ToyGan(gen.GAN_PRESETS.weak);
let run = 0;
let longest = 0;
while (weak.step < Math.min(...C.DIAG.frames.unstable.at)) {
  weak.iterate();
  if (weak.step % 100 === 0) {
    const [a, b] = gen.modeCover(weak.target, weak.samples(400, 99));
    run = (a >= 0.9 && b <= 0.05) || (b >= 0.9 && a <= 0.05) ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
}
ok(longest * 100 >= 1000, `the weak run sat on one bump for ≥ 1000 iterations before it went unstable (${longest * 100})`);
for (const t of C.DIAG.pairAt) ok(verdictOf(S.frameAt('weak', t)) === 'collapse' && verdictOf(S.frameAt('balanced', t)) === 'covered', `pair @${t}: weak collapsed, balanced covered`);

/* ── 4. 30 seeded rounds per level ─────────────────────────────────────── */
const mutate = (it) => {
  switch (it.type) {
    case 'recipe': return { ...it.answer, labels: it.answer.labels === 'all1' ? 'fake0real1' : 'all1' };
    case 'order': return [it.answer[1], it.answer[0], ...it.answer.slice(2)];
    case 'build': { const k = Object.keys(it.answer)[0]; return { ...it.answer, [k]: it.slots[0].options.find((o) => o.key !== it.answer[k]).key }; }
    case 'number': return it.answer + 1;
    case 'shape': return [it.answer[0], it.answer[1] + 1];
    default: return it.choices.find((c) => c.value !== it.answer).value;
  }
};
const types = {};
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = F.makeItems(rng(seed), level);
    ok(items.length === C.ROUNDS[level].length, `L${level} s${seed}: ${items.length} items`);
    ok(new Set(items.map((x) => x.id)).size === items.length, `L${level} s${seed}: ids unique`);
    items.forEach((it, i) => {
      const where = `L${level} s${seed} #${i} ${it.id}`;
      types[it.type] = (types[it.type] ?? 0) + 1;
      ok(typeof it.id === 'string' && it.id.length > 0, `${where}: id`);
      ok(CONCEPT_IDS.includes(it.concept), `${where}: concept ${it.concept} in the catalogue`);
      ok(it.src?.lecture === 6 && it.src.slides.length > 0 && it.src.slides.every((s) => s >= 19 && s <= 30), `${where}: src lecture 6, slides 19–30`);
      ok(typeof it.why === 'string' && it.why.length > 20, `${where}: why`);
      ok(typeof it.promptText === 'string' && it.promptText.length > 10, `${where}: promptText`);
      for (const t of [it.why, it.promptText]) ok(!/NaN|undefined|%\w+%/.test(t), `${where}: no unfilled template`);
      ok(((it.why.match(/\$/g) ?? []).length % 2) === 0, `${where}: balanced $…$`);
      const rt = JSON.parse(JSON.stringify(it.answer));
      ok(grade(it, it.answer) && grade(it, rt), `${where}: own answer grades right (JSON round trip too)`);
      ok(!grade(it, mutate(it)) && !grade(it, null), `${where}: a wrong answer / no answer grades wrong`);
      ok(typeof it.format === 'function' ? (typeof it.format(it.answer) === 'string' && it.format(it.answer) !== '—') : it.kind === 'number', `${where}: answer formats for the why card`);
      if (it.kind === 'choice') {
        const vals = it.choices.map((c) => c.value);
        ok(new Set(vals).size === vals.length && vals.includes(it.answer) && vals.length >= 2 && vals.length <= 6, `${where}: answer among 2–6 unique choices`);
      }
      // the answer key, re-derived
      if (it.type === 'recipe') {
        ok(JSON.stringify(it.answer) === JSON.stringify(C.PHASES[it.phase].answer), `${where}: phase ${it.phase} recipe`);
        ok(it.rows.every((r) => r.options.length === C.INGREDIENTS[r.key].length), `${where}: every option offered`);
      }
      if (it.type === 'which') {
        const d = S.demo(it.studio.key, it.studio.t, it.studio.demo);
        ok(it.answer === (d.gMax === 0 && d.dMax > 0 ? 'p1' : d.dMax === 0 && d.gMax > 0 ? 'p2' : '?'), `${where}: which = what moved in the demo`);
      }
      if (it.type === 'order') ok(JSON.stringify(it.answer) === JSON.stringify(C.ORDER_SETS.find((s) => it.id.endsWith(s.id)).cards.map((c) => c.id)) && it.cards.some((c, k) => c.id !== it.answer[k]), `${where}: order key, shown shuffled`);
      if (it.type === 'diagnose') ok(it.answer === verdictOf(S.frameAt(it.studio.key, it.studio.t)), `${where}: verdict from the run`);
      if (it.type === 'pair') ok(it.pair.find((p) => p.label === it.answer)?.key === 'weak', `${where}: the collapsed run is GAN_PRESETS.weak`);
      if (it.type === 'gap') ok(it.choices.find((c) => c.value === it.answer).label.replace(/`/g, '') === C.LOOP.lines.find((l) => l.id === it.line).code.trim(), `${where}: gap answer is the printed line`);
      if (it.type === 'build') ok(it.slots.length === 3 && it.slots.every((s) => it.answer[s.id] === guide[s.id][0]), `${where}: slots by slide 28`);
      if (it.type === 'spot') ok(it.answer === C.SPOT.find((s) => it.id.endsWith(s.id)).answer, `${where}: spot key`);
      if (it.type === 'number') {
        const b = it.batch;
        const want = { rows: 2 * b, zeros: b, y2: b, dense: 7 * 7 * 128 }[it.numberKind];
        ok(it.answer === want && it.tol === 0, `${where}: ${it.numberKind} = ${want}`);
      }
      if (it.type === 'shape') ok(it.answer[0] === it.batch && it.answer[1] === (it.model === 'GAN' ? 30 : 100), `${where}: noise shape [${it.answer}]`);
    });
  }
}

// the manifest lists every concept the items use
const manifestSrc = fs.readFileSync(path.join(DL, 'arcade/games/forger/index.js'), 'utf8');
const used = new Set();
for (const level of [1, 2, 3]) for (let seed = 1; seed <= 30; seed++) F.makeItems(rng(seed), level).forEach((it) => used.add(it.concept));
used.forEach((c) => ok(manifestSrc.includes(`'${c}'`), `manifest lists ${c}`));
ok(/art: 'cab-forger\.png'/.test(manifestSrc) && /id: 'forger'/.test(manifestSrc), 'manifest id and art kept');

console.log(`check-forger: ${n} assertions passed · items per type ${JSON.stringify(types)}${pdfChecked ? ` · ${pdfChecked} slides compared with the PDF` : ''}`);
