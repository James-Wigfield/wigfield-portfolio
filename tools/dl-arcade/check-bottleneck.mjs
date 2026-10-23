/* Bottleneck — fidelity check (node tools/dl-arcade/check-bottleneck.mjs)
   1. Slide anchors (Lecture 5): stacked_ae 163,814 (slide 12), tied_ae 82,414 (slide 21), the
      784–100–30–100–784 sandwich (slide 11), W_{N−ℓ+1} = W_ℓᵀ for N = 4 (slide 19: W_3 = W_2ᵀ,
      W_4 = W_1ᵀ), cross-checked with arcade/maths/params.js (Dense + DenseTranspose specs).
   2. The plane: a hand-worked flat cloud; the PCA plane is the lowest-MSE plane (a 1° grid search
      over tilt and turn lands on it); the equal plane grades right, a plane 30° off grades wrong.
   3. The build grader, the order grader, the drop items against this page's own data (labels,
      class names, `near` classes).
   4. 30 seeded rounds per level: every item has an id, a concept in the catalogue, a src, a why
      and a gradable answer (its own answer grades true; its `wrong` value, a skip and a mutated
      answer grade false); answers survive JSON.
   5. Wording hotspots: no "overcomplete"; "frozen" only where it says the slides never say it. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DL = path.resolve(HERE, '../../src/components/portal/modules/deep-learning');
const imp = (p) => import(pathToFileURL(path.join(DL, p)).href);

const { stackParams, tiedParams, pca, planeAngle } = await imp('lecture5-study/ae.js');
const B = await imp('arcade/maths/bottleneck.js');
const C = await imp('arcade/content/bottleneck.js');
const L5 = await imp('arcade/content/lecture5.js');
const { modelParams } = await imp('arcade/maths/params.js');
const { rng } = await imp('arcade/core/rng.js');
const { CONCEPT_IDS } = await imp('arcade/core/concepts.js');
const { TSNE } = await imp('lecture5-study/data/tsne.js');
const { RECON } = await imp('lecture5-study/data/recon.js');
const { grade } = await imp('arcade/kit/grade.js'); // the round engine's own grader

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };
const eq = (a, b, m) => { n++; assert.deepEqual(a, b, m); };

/* ── 1. slide anchors ─────────────────────────────────────────────────── */
const SLIDE = [784, 100, 30, 100, 784];
const anchor = (id) => L5.ANCHORS.find((a) => a.id === id).value;
eq(stackParams(SLIDE).total, 163814, 'slide 12: stacked_ae 163,814');
eq(tiedParams(SLIDE).total, 82414, 'slide 21: tied_ae 82,414');
eq(anchor('l5.stacked.163814'), 163814, 'lecture5.js anchor 163,814');
eq(anchor('l5.tied.82414'), 82414, 'lecture5.js anchor 82,414');
eq(anchor('l5.stacked.widths'), SLIDE, 'slide 11: 784–100–30–100–784');
const t4 = B.tieCounts(SLIDE);
eq([t4.untied, t4.tied, t4.saved, t4.encKernels, t4.biases], [163814, 82414, 81400, 81400, 1014], 'tie counts for the slide sandwich');
eq(t4.savedTerms, '30 × 100 + 100 × 784', 'saved = the two decoder kernels');
eq(C.TIE.anchor.untied, 163814, 'content anchor untied');
eq(C.TIE.anchor.tied, 82414, 'content anchor tied');
// the four choices: tied, encoder only (decoder biases forgotten), saved, untied
eq(C.TIE.choice.choices.map((c) => c.value), [82414, 78500 + 3030, 163814 - 82414, 163814], 'tie choice values');
// params.js agrees: Dense + DenseTranspose (slide 20's build(): bias shape = the tied Dense layer's input size)
const untiedSpecs = [{ type: 'Dense', units: 100 }, { type: 'Dense', units: 30 }, { type: 'Dense', units: 100 }, { type: 'Dense', units: 784 }];
const tiedSpecs = [{ type: 'Dense', units: 100 }, { type: 'Dense', units: 30 }, { type: 'DenseTranspose', units: 100 }, { type: 'DenseTranspose', units: 784 }];
eq(modelParams(untiedSpecs, [784]).total, 163814, 'params.js: stacked_ae');
eq(modelParams(tiedSpecs, [784]).total, 82414, 'params.js: tied_ae');
// slide 19: N = 4 → W_4 = W_1ᵀ, W_3 = W_2ᵀ; the rule for N = 6 too
eq(tiedParams(SLIDE).layers.map((l) => l.tiedTo), [null, null, 2, 1], 'slide 19: layer 3 uses W_2ᵀ, layer 4 uses W_1ᵀ');
eq([3, 4].map((L) => B.tiedSource(4, L)), [2, 1], 'tiedSource N = 4');
eq([4, 5, 6].map((L) => B.tiedSource(6, L)), [3, 2, 1], 'tiedSource N = 6');
const six = [784, 300, 100, 30, 100, 300, 784];
eq(tiedParams(six).layers.map((l) => l.tiedTo), [null, null, null, 3, 2, 1], 'N = 6 tying');
const t6 = B.tieCounts(six);
eq(t6.saved, 784 * 300 + 300 * 100 + 100 * 30, 'N = 6 saved = encoder kernels');
eq(t6.tied, 784 * 300 + 300 * 100 + 100 * 30 + (300 + 100 + 30 + 100 + 300 + 784), 'N = 6 tied = encoder kernels + every bias');
eq(modelParams([300, 100, 30].map((u) => ({ type: 'Dense', units: u })).concat([100, 300, 784].map((u) => ({ type: 'DenseTranspose', units: u }))), [784]).total, t6.tied, 'params.js agrees for N = 6');

/* ── 2. the plane ─────────────────────────────────────────────────────── */
// hand-worked: (±1, 0, ±0.1) and (0, ±2, ±0.1), every sign combination: x3 is uncorrelated with x1, x2,
// so the best plane is flat (normal = the x3 axis),
// every reconstruction error is 0.1 on x3 only, so MSE = 0.1² / 3
const flat = [[1, 0, 0.1], [1, 0, -0.1], [-1, 0, 0.1], [-1, 0, -0.1], [0, 2, 0.1], [0, 2, -0.1], [0, -2, 0.1], [0, -2, -0.1]];
const Pf = pca(flat);
ok(planeAngle(Pf.comps[2], [0, 0, 1]) < 1e-6, 'flat cloud: PCA normal is the x3 axis');
const fitFlat = B.planeFit(flat, Pf.mean, [0, 0]);
ok(Math.abs(fitFlat.mse - 0.01 / 3) < 1e-12, `flat cloud: MSE ${fitFlat.mse} = 0.1²/3`);
ok(B.planeFit(flat, Pf.mean, [75, 0]).mse > 10 * Pf.mse, 'a steep plane is far worse');
// slider angles (the plane's tilts along x1 and x2) round-trip; a 30° tilt is 30° from flat
for (const a of [[0, 0], [30, 45], [60, -30], [-70, 10], [-12, -55]]) ok(Math.hypot(...B.anglesFrom(B.normalFrom(a)).map((v, k) => v - a[k])) < 1e-9, `angles round-trip ${a}`);
ok(Math.abs(B.planeError([0, 0], B.normalFrom([30, 0])) - 30) < 1e-9 && Math.abs(B.planeError([0, 0], B.normalFrom([0, -30])) - 30) < 1e-9, '30° tilt = 30° from flat');
// seeded clouds
for (let s = 1; s <= 12; s++) {
  const c = B.makeCloud(rng(s));
  const P = pca(c.X);
  ok(Math.abs(c.floor - P.mse) < 1e-15, 'floor = PCA reconstruction MSE');
  ok(c.answer.every((v) => Math.abs(v) <= C.PLANE.target + 0.5), 'the PCA plane is within the sliders');
  // the PCA plane through the mean has the floor MSE
  ok(Math.abs(B.planeFit(c.X, c.mean, B.anglesFrom(c.normal)).mse - c.floor) < 1e-12, 'PCA plane MSE = floor');
  // a 1° grid search over the sliders finds the PCA plane (it is the lowest-MSE plane)
  let best = null;
  for (let a = C.PLANE.range[0]; a <= C.PLANE.range[1]; a++) {
    for (let b = C.PLANE.range[0]; b <= C.PLANE.range[1]; b++) {
      const m = B.planeFit(c.X, c.mean, [a, b]).mse;
      if (!best || m < best.m) best = { m, a: [a, b] };
    }
  }
  ok(best.m >= c.floor - 1e-12, 'nothing beats the PCA plane');
  ok(B.planeError(best.a, c.normal) < 1.5, `grid minimum ${best.a} within 1.5° of the PCA plane (cloud ${s})`);
  ok(B.planeError(c.answer, c.normal) < 1, 'rounded answer within 1°');
  const off = B.planeOff(c.normal, 30);
  ok(Math.abs(B.planeError(off, c.normal) - 30) < 1e-6, 'planeOff is 30° off');
  for (const tol of C.PLANE.tol) {
    ok(B.gradePlane(B.anglesFrom(c.normal), c.normal, tol), 'equal plane is right');
    ok(B.gradePlane(c.answer, c.normal, tol), 'answer is right');
    ok(!B.gradePlane(off, c.normal, tol), '30° off is wrong');
    ok(!B.gradePlane(B.planeOff(c.normal, tol + 1), c.normal, tol), 'just past the tolerance is wrong');
  }
  ok(!B.gradePlane(null, c.normal, 10) && !B.gradePlane([1], c.normal, 10) && !B.gradePlane(['a', 2], c.normal, 10), 'malformed planes are wrong');
  ok(B.meterFrac(c.floor, c.floor, c.top) === 0, 'meter is empty at the PCA plane');
}

/* ── 3. build, order, drop ────────────────────────────────────────────── */
for (const N of [4, 6]) {
  const all = B.buildCombos(N);
  ok(all.every((c) => B.isOffered(c.sizes, N)), `every combo on offer N=${N}`);
  ok(all.every((c) => c.sizes.slice(1, -1).every((w) => w < 784)), 'undercomplete: every hidden layer narrower than the input');
  ok(all.every((c) => c.enc.every((w, k) => k === 0 || w < c.enc[k - 1])), 'each encoder layer narrower than the one before');
}
ok(B.buildCombos(4).some((c) => c.total === 163814 && B.fmtSizes(c.sizes) === '784–100–30–100–784'), 'the slide sandwich is on offer');
eq(B.sandwich([100, 30]), SLIDE, 'sandwich mirrors the encoder');
ok(!B.isOffered([784, 100, 30, 150, 784], 4), 'an asymmetric stack is not on offer');
ok(!B.gradeBuild([784, 100, 30, 100, 784], 4, 163000, 162000), 'over budget fails');

for (const [key, S] of Object.entries(C.ORDERS)) {
  if (key === 'ui') continue;
  const ids = S.cards.map((c) => c.id);
  ok(S.answer.every((id) => ids.includes(id)), `${key}: answer ids are cards`);
  ok(S.cards.filter((c) => c.decoy).every((c) => !S.answer.includes(c.id)), `${key}: decoys are left out`);
  eq(S.answer.length, S.cards.filter((c) => !c.decoy).length, `${key}: every non-decoy card is placed`);
  ok(CONCEPT_IDS.includes(S.concept), `${key}: concept`);
}

eq(C.MAP.classNames, TSNE.classNames, 'class names = the t-SNE data');
eq(C.MAP.classNames, RECON.classNames, 'class names = the reconstruction data');
const homes = B.classHomes(TSNE);
for (const it of C.MAP.items) {
  eq(RECON.items[it.index].label, it.label, `item ${it.index}: label = recon.js`);
  eq(RECON.items[it.index].index, it.index, `item ${it.index}: X_valid index`);
  eq(TSNE.labels[it.index], it.label, `item ${it.index}: label = tsne.js (same X_valid image)`);
  eq(B.nearClasses(TSNE, it.index), it.near, `item ${it.index}: near classes`);
}
for (let k = 0; k < 10; k++) eq(B.nearestHome(homes, homes[k].x, homes[k].y), k, `tapping class ${k}'s home picks it`);
ok(C.MAP.families.flatMap((f) => f.classes).sort((a, b) => a - b).join() === '0,1,2,3,4,5,6,7,8,9', 'families cover every class once');

/* ── 4. rounds ────────────────────────────────────────────────────────── */
const mutate = (v) => (typeof v === 'number' ? v + 1 : Array.isArray(v) ? (v.every((x) => typeof x === 'number') ? v.map((x, i) => (i === 0 ? x + 30 : x)) : v.slice().reverse()) : `${v}x`);
const stages = {};
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = B.makeItems(rng(seed), level);
    eq(items.length, C.LEVELS[level - 1].plan.length, `level ${level} seed ${seed}: item count`);
    eq(new Set(items.map((it) => it.id)).size, items.length, 'ids unique in a round');
    for (const it of items) {
      stages[`${level}:${it.stage}`] = (stages[`${level}:${it.stage}`] ?? 0) + 1;
      ok(it.id && it.concept && it.src && it.why && it.promptText && it.prompt && it.answer !== undefined, `fields ${it.id}`);
      ok(CONCEPT_IDS.includes(it.concept), `concept ${it.concept} in the catalogue`);
      ok(it.src.lecture === 5 && it.src.slides.length > 0 && it.src.slides.every((s) => s >= 1 && s <= 27), `src ${it.id}`);
      ok(typeof it.why === 'string' && !/\{(tol|budget|sizes|terms|total|nextSizes|nextTotal|kernels|biases|tied|saved|N|L|l|c|cls|near|tail|n|untied)\}/.test(it.why), `why filled ${it.id}: ${it.why}`);
      ok(![it.prompt, it.sub ?? '', it.promptText].some((t) => /\{\w+\}/.test(t)), `prompt filled ${it.id}`);
      ok(grade(it, it.answer), `own answer grades true ${it.id}`);
      const json = JSON.parse(JSON.stringify(it.answer));
      ok(grade(it, json), `answer survives JSON ${it.id}`);
      ok(!grade(it, it.wrong), `wrong value grades false ${it.id}`);
      ok(!grade(it, null), `a skip grades false ${it.id}`);
      ok(!grade(it, mutate(it.answer)), `a mutated answer grades false ${it.id}`);
      if (it.kind === 'choice') ok(it.choices.length === 4 && it.choices.some((c) => c.value === it.answer) && new Set(it.choices.map((c) => c.value)).size === 4, `choices ${it.id}`);
      if (it.kind === 'number') ok(Number.isInteger(it.answer) && it.answer > 0, `number ${it.id}`);
      if (it.stage === 'plane') {
        ok(B.planeError(it.start, it.normal) >= 35, `start far from the target ${it.id}`);
        ok(B.planeError(B.greedyPlane(it.cloud.X, it.cloud.mean, it.start), it.normal) <= 2, `following the MSE from the start reaches the plane ${it.id}`);
      }
      if (it.stage === 'build') {
        ok(it.best <= it.budget && B.buildCombos(it.N).filter((c) => c.total <= it.budget).every((c) => c.total <= it.best), `budget binds ${it.id}`);
        ok(B.buildCombos(it.N).some((c) => c.total > it.budget), `something is over budget ${it.id}`);
      }
      if (it.stage === 'tie' && it.kind === 'number') {
        const t = B.tieCounts(it.sizes);
        eq(it.answer, it.mode === 'remaining' ? t.tied : t.saved, `tie answer ${it.id}`);
      }
      if (it.stage === 'order') ok(JSON.stringify(it.cards.filter((c) => !c.decoy).map((c) => c.id)) !== JSON.stringify(it.answer), `cards start shuffled ${it.id}`);
      if (typeof it.format === 'function') ok(typeof it.format(it.answer) === 'string', `format ${it.id}`);
    }
    // the tie keypad item counts the sandwich the build item asked for
    const build = items.find((it) => it.stage === 'build');
    const tie = items.find((it) => it.stage === 'tie' && it.kind === 'number');
    if (build && tie) eq(tie.sizes, build.answer, 'tie follows the build');
  }
}
for (const level of [1, 2, 3]) ok(['plane', 'build', 'tie', 'order', 'drop'].every((s) => stages[`${level}:${s}`] > 0), `level ${level} has stages 1–4`);

/* ── 5. wording hotspots ──────────────────────────────────────────────── */
const strings = [];
const walk = (v) => {
  if (typeof v === 'string') strings.push(v);
  else if (Array.isArray(v)) v.forEach(walk);
  else if (v && typeof v === 'object') Object.values(v).forEach(walk);
};
walk(C);
ok(strings.every((s) => !/overcomplete/i.test(s)), 'no “overcomplete” (the deck never uses it)');
ok(strings.filter((s) => /froz|freez/i.test(s)).every((s) => /never say the copied layers are frozen/.test(s)), '“frozen” only where the slides are said not to say it');
ok(strings.filter((s) => s.includes('\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_')).length >= 3, 'the slide 19 rule is quoted in the slides’ indices');
ok(strings.filter((s) => /bias/.test(s) && /not tied|keeps? (only )?its own bias|biases stay|bias only|only new weight|just a bias/.test(s)).length >= 3, 'biases are not tied, said in several places');

console.log(`check-bottleneck: ${n} assertions passed (${Object.entries(stages).map(([k, v]) => `${k}×${v}`).join(' ')})`);
