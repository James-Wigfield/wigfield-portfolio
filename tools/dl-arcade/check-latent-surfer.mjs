/* Latent Surfer — fidelity check (node tools/dl-arcade/check-latent-surfer.mjs)
   1. Hand-worked examples from the Lectures 6–7 slide equations against
      arcade/maths/latentSurfer.js (and the gen.js functions it builds on):
        slides 11, 12, 14  sampling: codings = μ + σ × noise, σ = exp(γ/2)
        slide 12           latent loss, σ form and γ form (they must agree)
        slide 14           the code form, -0.5 * reduce_sum(1 + logvar − exp(logvar) − mean²)
        slide 18           np.linspace(codings[0], codings[1], 10), ends included
   2. This page's own decoder (lecture6-7-study/data/vae.js) reproduces the
      Keras outputs stored with it, within its stated int8 error.
   3. The find grader: the answer passes, the start and a far move fail, and
      a 0.1 nudge in any direction around the answer still passes.
   4. 30 seeded rounds per level: every item has an id, a concept in the
      catalogue, a src (lecture 6, slides), a why and a gradable answer; the
      item's own answer grades right (also after a JSON round trip) and a
      wrong one (a trap, another choice, the start point) grades wrong. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DL = path.resolve(HERE, '../../src/components/portal/modules/deep-learning');
const imp = (p) => import(pathToFileURL(path.join(DL, p)).href);

const gen = await imp('lecture6-7-study/gen.js');
const { VAE } = await imp('lecture6-7-study/data/vae.js');
const LS = await imp('arcade/maths/latentSurfer.js');
const C = await imp('arcade/content/latent-surfer.js');
const { EQUATIONS } = await imp('arcade/content/lecture67.js');
const { rng } = await imp('arcade/core/rng.js');
const { CONCEPT_IDS } = await imp('arcade/core/concepts.js');
const { grade } = await imp('arcade/kit/grade.js');

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* ── 1. the slide equations by hand ─────────────────────────────────────── */
// slides 11/12/14: μ = 0.5, γ = log 4 = 1.386294, ε = −1.5
//   σ = exp(γ/2) = exp(0.693147) = 2;  codings = 0.5 + 2 · (−1.5) = −2.5
//   the trap exp(γ) = 4 = σ² (the variance): 0.5 + 4 · (−1.5) = −5.5
ok(near(LS.sigmaOf(Math.log(4)), 2, 1e-12), 'slide 12: exp(γ/2) = σ for γ = log σ² = log 4');
ok(near(LS.sampleOne(0.5, Math.log(4), -1.5), -2.5, 1e-12), 'slide 14: 0.5 + exp(log4 / 2)·(−1.5) = −2.5');
let sv = LS.samplingValues(0.5, 4, -1.5);
ok(near(sv.z, -2.5, 1e-12) && near(sv.traps.variance, -5.5, 1e-12), 'variance trap = μ + exp(γ)·ε = −5.5');
// slide 14: μ = −1, γ = log 9 = 2.197225, ε = −1 → σ = 3, codings = −1 + 3 · (−1) = −4
ok(near(LS.sampleOne(-1, Math.log(9), -1), -4, 1e-12), 'slide 14: −1 + exp(log9 / 2)·(−1) = −4');
// slide 14: μ = 2.4, γ = log 2.25 = 0.810930, ε = 2.5 → σ = 1.5, codings = 2.4 + 3.75 = 6.15
sv = LS.samplingValues(2.4, 2.25, 2.5);
ok(near(sv.z, 6.15, 1e-12) && near(sv.sigma, 1.5, 1e-12), 'slide 14: 2.4 + 1.5·2.5 = 6.15');
// σ ↔ γ round trip (slide 12: γ = log σ²)
ok(near(gen.sigmaOfGamma(gen.gammaOfSigma(0.37)), 0.37, 1e-12), 'σ → γ → σ');

// slide 12, σ form vs γ form, n = 1: μ = 1, σ = 2 (γ = log 4 = 1.386294)
//   −½ [1 + log(4) − 4 − 1] = −½ (1 + 1.386294 − 5) = −½ (−2.613706) = 1.306853
const L1 = gen.latentLossSigma([1], [2]);
const L1g = LS.latentLoss([1], [Math.log(4)]);
ok(near(L1, 1.306853, 1e-6) && near(L1g, L1, 1e-12), 'slide 12: both forms give 1.306853 for μ = 1, σ = 2');
// slide 12: μ = 0, γ = 0 → −½ [1 + 0 − 1 − 0] = 0
ok(near(LS.latentLoss([0], [0]), 0, 1e-15), 'slide 12: μ = 0, γ = 0 → 0');
// slide 12: μ = 2, γ = 0 → −½ [1 + 0 − 1 − 4] = 2
ok(near(LS.latentLoss([2], [0]), 2, 1e-15), 'slide 12: μ = 2, γ = 0 → 2');
// slide 12: μ = 0, γ = log 0.25 = −1.386294 → −½ [1 − 1.386294 − 0.25 − 0] = −½ (−0.636294) = 0.318147
ok(near(LS.latentLoss([0], [Math.log(0.25)]), 0.318147, 1e-6), 'slide 12: μ = 0, σ² = 0.25 → 0.318147');
// slide 12, n = 2: (μ = −1, σ² = 0.25) and (μ = −1, σ² = 1)
//   dim 1: −½ [1 − 1.386294 − 0.25 − 1] = 0.818147;  dim 2: −½ [1 + 0 − 1 − 1] = 0.5;  ℒ = 1.318147
ok(near(LS.latentLoss([-1, -1], [Math.log(0.25), 0]), 1.318147, 1e-6), 'slide 12: n = 2 sums the terms, 1.318147');
// the traps for that n = 2 case: no −½ → −2.636294; sign flipped → −1.318147; +μ² → 1.318147 − 2 = −0.681853
const lv = LS.lossValues([{ mu: -1, variance: 0.25 }, { mu: -1, variance: 1 }]);
ok(near(lv.traps.noHalf, -2.636294, 1e-6) && near(lv.traps.sign, -1.318147, 1e-6) && near(lv.traps.muSign, -0.681853, 1e-6), 'latent-loss traps');
// slide 14's code form: loss = −0.5 · Σ(1 + logvar − exp(logvar) − mean²), same numbers
const codeForm = (mean, logvar) => -0.5 * mean.reduce((s, m, i) => s + (1 + logvar[i] - Math.exp(logvar[i]) - m * m), 0);
for (const [m, g] of [[[1], [Math.log(4)]], [[-1, -1], [Math.log(0.25), 0]], [[0.3, -2, 1.1], [-0.7, 0.4, -3]]]) {
  ok(near(codeForm(m, g), LS.latentLoss(m, g), 1e-12), `slide 14 code form = slide 12 γ form for μ = ${m}`);
}
// every term is ≥ 0 (1 + γ − e^γ ≤ 0 and −μ² ≤ 0), so ℒ ≥ 0: spot-check on a grid
for (let g = -4; g <= 4; g += 0.5) for (let m = -3; m <= 3; m += 0.5) ok(LS.latentTerm(m, g) >= -1e-15, `ℒ term ≥ 0 at μ = ${m}, γ = ${g}`);

// slide 18: np.linspace(codings[0], codings[1], 10) with codings[0] = [0, 0], codings[1] = [9, 18]
//   steps of 1/9: element 3 = [3, 6]; elements 0 and 9 are the two codings themselves
const ls = gen.linspace([0, 0], [9, 18], 10);
ok(ls.length === 10 && near(ls[3][0], 3, 1e-12) && near(ls[3][1], 6, 1e-12), 'slide 18: linspace element 3 = 3/9 of the way');
ok(near(ls[0][1], 0) && near(ls[9][1], 18), 'slide 18: both ends included');

/* ── 2. this page's decoder vs the Keras outputs stored with it ─────────── */
const model = LS.makeModel(VAE);
ok(VAE.codingsSize === 10 && VAE.items.every((it) => it.mean.length === 10 && it.logVar.length === 10), 'codings_size = 10 (slide 16: "the codings are only 10-dimensional")');
VAE.check.codings.forEach((z, i) => {
  const mine = gen.toBytes(gen.decode(model.dec, z));
  const keras = Uint8Array.from(Buffer.from(VAE.check.kerasOut[i], 'base64'));
  const maxErr = mine.reduce((m, v, j) => Math.max(m, Math.abs(v - keras[j])), 0) / 255;
  ok(maxErr <= VAE.check.quantMaxAbsErr + 1 / 255 + 1e-9, `decoder check coding ${i}: max |int8 − Keras| = ${maxErr.toFixed(4)}`);
});

/* ── 3. the find grader ─────────────────────────────────────────────────── */
let finds = 0;
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    for (const it of LS.makeItems(rng(seed), level, model).filter((x) => x.type === 'find')) {
      finds++;
      ok(it.tau === C.FIND.tau[level], 'τ is the level\'s stated threshold');
      ok(grade(it, it.answer), `find L${level} s${seed}: the answer passes`);
      ok(!grade(it, it.start), `find L${level} s${seed}: the start point fails`);
      ok(!grade(it, null) && !grade(it, [it.answer[0]]), 'malformed answers fail');
      ok(!grade(it, [it.answer[0] + 2, it.answer[1] - 2].map((v) => Math.max(-3, Math.min(3, v)))) || Math.abs(it.answer[0]) > 2.6, `find L${level} s${seed}: a far move fails`);
      // a 0.1 nudge in 8 directions still passes (the target is findable with the 0.05 slider)
      for (let k = 0; k < 8; k++) {
        const g = (k / 8) * 2 * Math.PI;
        ok(grade(it, [it.answer[0] + 0.1 * Math.cos(g), it.answer[1] + 0.1 * Math.sin(g)]), `find L${level} s${seed}: a 0.1 nudge passes`);
      }
      ok(C.FIND.targets[level].includes(it.idx) && VAE.classNames[VAE.items[it.idx].label] === it.cls, 'target from the level pool, class from the data');
      ok(it.dims[0] !== it.dims[1] && it.dims.every((d) => d >= 0 && d < 10), 'two distinct coding dimensions');
    }
  }
}
ok(finds >= 90, `${finds} find items checked`);

/* ── 4. 30 seeded rounds per level ──────────────────────────────────────── */
const counts = {};
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = LS.makeItems(rng(seed), level, model);
    ok(items.length === C.ROUNDS[level].length, `L${level} s${seed}: ${items.length} items`);
    ok(new Set(items.map((x) => x.id)).size === items.length, 'ids unique in the round');
    items.forEach((it, i) => {
      const where = `L${level} s${seed} #${i} ${it.id}`;
      counts[it.type] = (counts[it.type] ?? 0) + 1;
      ok(typeof it.id === 'string' && it.id.length > 0, `${where}: id`);
      ok(CONCEPT_IDS.includes(it.concept), `${where}: concept ${it.concept} in the catalogue`);
      ok(it.src && it.src.lecture === 6 && Array.isArray(it.src.slides) && it.src.slides.length > 0 && it.src.slides.every((s) => s >= 10 && s <= 18), `${where}: src on slides 10–18`);
      ok(typeof it.why === 'string' && it.why.length > 20, `${where}: why`);
      ok(typeof it.promptText === 'string' && it.promptText.length > 10, `${where}: promptText`);
      for (const t of [it.why, it.promptText, it.held ?? '']) ok(!/NaN|undefined|%\w+%/.test(t), `${where}: no unfilled template in "${t.slice(0, 60)}"`);
      ok(((it.why.match(/\$/g) ?? []).length % 2) === 0, `${where}: balanced $…$ in why`);
      const rt = JSON.parse(JSON.stringify(it.answer));
      ok(grade(it, it.answer) && grade(it, rt), `${where}: own answer grades right (JSON round trip too)`);
      ok(it.type === C.ROUNDS[level][i] || it.type === 'fact', `${where}: type ${it.type} (planned ${C.ROUNDS[level][i]})`);
      ok(it.type === C.ROUNDS[level][i], `${where}: no fallback (generator found a ${C.ROUNDS[level][i]})`);
      if (it.kind === 'number') {
        ok(Number.isFinite(it.answer) && it.tol > 0 && it.tol <= 0.02, `${where}: numeric answer with a small tolerance`);
        ok(!grade(it, it.answer + 3 * it.tol + 0.01) && !grade(it, ''), `${where}: a wrong number fails`);
        const trapKeys = Object.keys(it.traps);
        for (const k of trapKeys) {
          if ((k === 'noMu' && it.values?.mu === 0) || (k === 'muSign' && it.dims?.every((d) => d.mu === 0))) continue;
          ok(!grade(it, it.traps[k]), `${where}: the ${k} trap grades wrong`);
        }
      }
      if (it.type === 'sample') {
        const v = it.values;
        ok(near(it.answer, v.mu + Math.exp(Math.log(v.variance) / 2) * v.eps, 1e-4), `${where}: μ + exp(γ/2)·ε`);
        ok(LS.samplingTrap(it, it.traps.variance) === 'variance', `${where}: the variance trap is recognised`);
      }
      if (it.type === 'loss') {
        const byHand = it.dims.reduce((s, d) => s - 0.5 * (1 + Math.log(d.variance) - d.variance - d.mu * d.mu), 0);
        ok(near(it.answer, byHand, 6e-4), `${where}: −½Σ[1 + γ − exp γ − μ²] = ${byHand.toFixed(4)}`);
        ok(LS.lossTrap(it, it.traps.noHalf) === 'noHalf', `${where}: the no-½ trap is recognised`);
      }
      if (it.kind === 'choice') {
        const vals = it.choices.map((c) => c.value);
        ok(new Set(vals).size === vals.length && vals.includes(it.answer), `${where}: answer among unique choices`);
        ok(new Set(it.choices.map((c) => c.text)).size === vals.length, `${where}: choice texts unique`);
        ok(!grade(it, vals.find((v) => v !== it.answer)), `${where}: another choice grades wrong`);
        ok(typeof it.format(it.answer) === 'string' && it.format(it.answer) !== '—', `${where}: answer formats for the why card`);
      }
      if (it.type === 'mid' || it.type === 'slot') {
        ok(it.choices.some((c) => c.key === 'overlay') && it.choices.length >= 3, `${where}: the pixel-overlay distractor is offered`);
        const right = it.choices.find((c) => c.value === it.answer);
        ok(right.how === 'decode' && near(right.t, it.type === 'mid' ? 0.5 : it.k / 9, 1e-12), `${where}: right image is t = ${it.type === 'mid' ? '1/2' : `${it.k}/9`}`);
        const pxs = it.choices.map((c) => LS.choicePx(model, it, c));
        for (let a = 0; a < pxs.length; a++) for (let b = a + 1; b < pxs.length; b++) ok(LS.pixelMse(pxs[a], pxs[b]) >= C.INTERP.minApart, `${where}: images ${a}/${b} look different`);
      }
      if (it.type === 'interpT') {
        ok(it.choices.find((c) => c.value === it.answer).text === `t = ${it.k}/9`, `${where}: t = k/9`);
      }
      if (it.type === 'find') {
        ok(!grade(it, it.start), `${where}: start fails`);
      }
    });
  }
}

/* ── 5. the content ─────────────────────────────────────────────────────── */
for (const f of C.FACTS) {
  ok(CONCEPT_IDS.includes(f.concept), `fact ${f.id}: concept in the catalogue`);
  ok(f.src.lecture === 6 && f.src.slides.length && f.why && f.choices.length === 4, `fact ${f.id}: src, why, 4 choices`);
  ok(new Set(f.choices.map((c) => c.text)).size === 4, `fact ${f.id}: distinct choices`);
  if (f.eq) {
    ok(EQUATIONS[f.eq], `fact ${f.id}: equation ${f.eq} exists`);
    // the equation shown above a question must not print its answer
    const ans = f.choices[0].label.replace(/^\$|\$$/g, '').replace(/`/g, '');
    ok(!EQUATIONS[f.eq].tex.some((t) => t.includes(ans)), `fact ${f.id}: equation does not give the answer away`);
  }
}
for (const [k, v] of Object.entries({ FIND: C.FIND, SAMPLING: C.SAMPLING, INTERP: C.INTERP, LOSS: C.LOSS })) {
  ok(v.src.lecture === 6 && v.src.slides.length > 0, `${k}: src`);
}

console.log(`check-latent-surfer: ${n} assertions passed · items by type ${JSON.stringify(counts)} · ${finds} finds`);
