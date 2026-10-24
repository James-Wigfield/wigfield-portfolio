#!/usr/bin/env node
/* check-boundary-bash.mjs — fidelity + generator check for Boundary Bash (Lecture 1, slides 4–17).

   1. Hand-worked examples from the slide equations (arithmetic in the comments, with slide
      numbers): the TLU's z and step (slides 4–5), Perceptron learning-rule updates in slide 10's
      form and slide 11's handwritten form, and the wrong-sign / wrong-factor variants the choices
      offer.
   2. Figure 10-6b (slide 17): the content's weights are the figure's, the network reproduces XOR
      on all four inputs (and Lecture 1's ANCHORS l1.xor.mlp.*), every blank has exactly one
      candidate that makes it output XOR (the answer), every drawn single-TLU "try" gets a point
      wrong, and no TLU on a fine grid of weights and biases separates XOR (slide 16).
   3. 30 seeded rounds per level: id (unique), concept in the catalogue, src (Lecture 1, slides
      4–17), why, no unfilled %placeholder%, a gradable answer (the item's own answer grades right,
      a mutated one wrong), and the answer recomputed independently from what the item shows
      (the stream's w, b, η, x, y; the probe; Figure 10-6b's weights typed in here).

   Run:  node tools/dl-arcade/check-boundary-bash.mjs     (exit 1 on any failure) */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const arcade = path.resolve(here, '..', '..', 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade');
const load = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const M = await load('maths/boundaryBash.js');
const { rng } = await load('core/rng.js');
const { CONCEPTS } = await load('core/concepts.js');
const { grade } = await load('kit/grade.js');
const L1 = await load('content/lecture1.js');
const C = await load('content/boundary-bash.js');

const failures = [];
let checks = 0;
const ok = (cond, msg) => { checks += 1; if (!cond) failures.push(msg); };
const eqv = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── 1. hand-worked examples ─────────────────────────────────────────────────
// Slide 4: z = w₁x₁ + w₂x₂ + b. Slide 5: heaviside(z) = 0 if z < 0, 1 if z ≥ 0; sign(z) = −1, 0, +1.
ok(M.tluZ([2, -1], -1, [1, 3]) === -2, 'slide 4: z = 2·1 + (−1)·3 − 1 = −2');
ok(M.heaviside(-2) === 0 && M.heaviside(0) === 1 && M.heaviside(0.5) === 1, 'slide 5: heaviside(−2) = 0, heaviside(0) = 1, heaviside(0.5) = 1');
ok(M.sign(-2) === -1 && M.sign(0) === 0 && M.sign(3) === 1, 'slide 5: sign(−2) = −1, sign(0) = 0, sign(3) = +1');

// Example A (η = 1). w = (2, −1), b = −1, x = (1, 3), target y = 1.
//   z = 2·1 + (−1)·3 − 1 = −2 < 0  →  ŷ = heaviside(−2) = 0 (slides 4–5): misclassified.
//   slide 10: w₁ = 2 + 1·(1 − 0)·1 = 3;  w₂ = −1 + 1·(1 − 0)·3 = 2   →  w = (3, 2)
//   slide 11: w₁ = 2 − 1·(0 − 1)·1 = 3;  w₂ = −1 − 1·(0 − 1)·3 = 2   →  the same
ok(M.predict([2, -1], -1, [1, 3]) === 0, 'example A: ŷ = 0');
ok(eqv(M.ruleNext([2, -1], [1, 3], 1, 0, 1), [3, 2]), 'example A: slide 10 gives (3, 2)');
ok(eqv(M.ruleNext11([2, -1], [1, 3], 1, 0, 1), [3, 2]), 'example A: slide 11 gives (3, 2)');
//   wrong sign  w − η(y − ŷ)x:  (2 − 1, −1 − 3) = (1, −4)
//   no x_i      w + η(y − ŷ):   (2 + 1, −1 + 1) = (3, 0)
//   times ŷ     w + η(y − ŷ)ŷ:  ŷ = 0 so (2, −1), no move
//   y x_i       w + η y x_i:    (3, 2) — equal to the rule when y = 1, ŷ = 0 (so the generator drops it)
ok(eqv(M.applyForm('s10sign', [2, -1], [1, 3], 1, 0, 1), [1, -4]) && eqv(M.applyForm('s11sign', [2, -1], [1, 3], 1, 0, 1), [1, -4]), 'example A: the wrong-sign forms give (1, −4)');
ok(eqv(M.applyForm('noX', [2, -1], [1, 3], 1, 0, 1), [3, 0]), 'example A: the missing-x_i form gives (3, 0)');
ok(eqv(M.applyForm('yhatX', [2, -1], [1, 3], 1, 0, 1), [2, -1]), 'example A: the ×ŷ form gives (2, −1)');
ok(eqv(M.applyForm('targetX', [2, -1], [1, 3], 1, 0, 1), [3, 2]), 'example A: the η y x_i form gives (3, 2)');
ok(eqv(M.applyForm('s10', [2, -1], [1, 3], 1, 0, 1), [3, 2]) && eqv(M.applyForm('s11', [2, -1], [1, 3], 1, 0, 1), [3, 2]), 'example A: both correct forms give (3, 2)');

// Example B (η = 0.5). w = (1, 2), b = 1, x = (2, 1), target y = 0.
//   z = 1·2 + 2·1 + 1 = 5 ≥ 0  →  ŷ = 1: misclassified.
//   slide 10: w₁ = 1 + 0.5·(0 − 1)·2 = 0;  w₂ = 2 + 0.5·(0 − 1)·1 = 1.5  →  (0, 1.5)
ok(M.predict([1, 2], 1, [2, 1]) === 1, 'example B: ŷ = 1');
ok(eqv(M.ruleNext([1, 2], [2, 1], 0, 1, 0.5), [0, 1.5]), 'example B: slide 10 gives (0, 1.5)');
ok(eqv(M.ruleNext11([1, 2], [2, 1], 0, 1, 0.5), [0, 1.5]), 'example B: slide 11 gives (0, 1.5)');

// Example C (η = 2). w = (−1, 1), b = −1, x = (−2, 0), target y = 0.
//   z = (−1)(−2) + 1·0 − 1 = 1 ≥ 0  →  ŷ = 1: misclassified.
//   slide 10: w₁ = −1 + 2·(0 − 1)·(−2) = 3;  w₂ = 1 + 2·(0 − 1)·0 = 1  →  (3, 1)
ok(M.predict([-1, 1], -1, [-2, 0]) === 1, 'example C: ŷ = 1');
ok(eqv(M.ruleNext([-1, 1], [-2, 0], 0, 1, 2), [3, 1]), 'example C: slide 10 gives (3, 1)');

// Example D: a correct prediction does not move w (slide 9: only wrong predictions reinforce).
//   w = (2, −1), b = −1, x = (3, 1), y = 1: z = 6 − 1 − 1 = 4 → ŷ = 1 = y → y − ŷ = 0 → (2, −1)
ok(M.predict([2, -1], -1, [3, 1]) === 1 && eqv(M.ruleNext([2, -1], [3, 1], 1, 1, 1), [2, -1]), 'example D: no update');

// The content's rule forms are the slides' (slide 10 typeset, slide 11 handwritten).
ok(C.RULE.forms.s10.tex.replace(/\\,/g, '').replace(/\s/g, '') === '$w_{i,j}+\\eta(y_j-\\hat{y}_j)x_i$', 'RULE.s10 is slide 10’s right-hand side');
ok(C.RULE.forms.s11.tex.replace(/\\,/g, '').replace(/\s/g, '') === '$w_{i,j}-\\eta(\\hat{y}_j-y_j)x_i$', 'RULE.s11 is slide 11’s right-hand side');
ok(L1.EQUATIONS.perceptronRule.tex[0].includes('w_{i,j} + \\eta\\,(y_j - \\hat{y}_j)\\,x_i'), 'lecture1 EQUATIONS.perceptronRule unchanged');
ok(Object.entries(C.RULE.forms).every(([k, f]) => !!f.correct === (k === 's10' || k === 's11')), 'only s10 and s11 are marked correct');
ok(Object.values(C.RULE.forms).every((f) => typeof M.DELTAS[f.delta] === 'function'), 'every rule form has a delta');

// ── 2. Figure 10-6b (slide 17) ─────────────────────────────────────────────
// Read from the slide at 300 dpi: all four input→hidden weights 1; hidden biases −3/2 (left), −1/2
// (right); output weights −1 (from left), 1 (from right); output bias −1/2.
const SLIDE17 = { W: [[1, 1], [1, 1]], b: [-1.5, -0.5], v: [-1, 1], c: -0.5 };
ok(eqv(C.XOR.net, SLIDE17), 'XOR.net is Figure 10-6b');
ok(eqv(C.XOR.show, { W: [['1', '1'], ['1', '1']], b: ['−3/2', '−1/2'], v: ['−1', '1'], c: '−1/2' }), 'XOR.show labels are Figure 10-6b’s');
// (0,0): z = (−3/2, −1/2) → h = (0, 0) → out = step(−1/2) = 0
// (0,1): z = (−1/2, 1/2)  → h = (0, 1) → out = step(0 + 1 − 1/2) = 1
// (1,0): z = (−1/2, 1/2)  → h = (0, 1) → out = 1
// (1,1): z = (1/2, 3/2)   → h = (1, 1) → out = step(−1 + 1 − 1/2) = 0
const hand = { '0,0': [[-1.5, -0.5], [0, 0], 0], '0,1': [[-0.5, 0.5], [0, 1], 1], '1,0': [[-0.5, 0.5], [0, 1], 1], '1,1': [[0.5, 1.5], [1, 1], 0] };
for (const [k, [z, h, out]] of Object.entries(hand)) {
  const f = M.mlpForward(SLIDE17, k.split(',').map(Number));
  ok(eqv(f.z, z) && eqv(f.h, h) && f.out === out, `Figure 10-6b on (${k}): z ${f.z}, h ${f.h}, out ${f.out}`);
  const anchor = L1.ANCHORS.find((a) => a.id === `l1.xor.mlp.${k.replace(',', '')}`);
  ok(anchor && anchor.value === out, `ANCHOR l1.xor.mlp.${k.replace(',', '')} = ${anchor?.value}`);
}
ok(M.solvesXor(SLIDE17), 'the slide 17 network solves XOR');
ok(eqv(C.XOR.points.map((p) => [...p.x, p.y]), [[0, 0, 0], [0, 1, 1], [1, 0, 1], [1, 1, 0]]), 'XOR points: (0,1),(1,0) → 1; (0,0),(1,1) → 0 (slide 17)');
for (const [k, q] of Object.entries(C.XOR_BLANKS)) {
  const solving = q.candidates.filter((c) => M.solvesXor(M.withSet(SLIDE17, c.set)));
  ok(solving.length === 1 && solving[0].value === q.answer, `blank ${k}: exactly one candidate solves XOR and it is the answer (${solving.map((c) => c.value)})`);
  const ans = q.candidates.find((c) => c.value === q.answer);
  ok(Object.entries(ans.set).every(([p, v]) => eqv(SLIDE17[p], v)), `blank ${k}: the answer is Figure 10-6b’s value`);
  ok(new Set(q.candidates.map((c) => c.value)).size === q.candidates.length, `blank ${k}: unique values`);
}
for (const t of C.XOR.tries) ok(M.misCount(t.w, t.b, C.XOR.points) >= 1, `XOR try ${t.w},${t.b} gets a point wrong`);
// slide 16: no single linear boundary solves XOR (any w₁, w₂, b on a grid of step 0.25 in [−4, 4])
let separates = 0;
for (let a = -16; a <= 16; a++) for (let c = -16; c <= 16; c++) for (let d = -16; d <= 16; d++) {
  if (M.misCount([a / 4, c / 4], d / 4, C.XOR.points) === 0) separates += 1;
}
ok(separates === 0, `slide 16: ${separates} single TLUs on the grid separate XOR`);

// ── 3. 30 seeded rounds per level ───────────────────────────────────────────
const srcOk = (s) => s && s.lecture === 1 && Array.isArray(s.slides) && s.slides.length > 0 && s.slides.every((n) => n >= 4 && n <= 17);
const unfilled = (s) => typeof s === 'string' && /%\w+%/.test(s);
function mutate(it) {
  if (it.kind === 'choice') return it.choices.find((c) => c.value !== it.answer)?.value;
  if (it.kind === 'number') return it.answer + 1;
  return null;
}
const H = (z) => (z < 0 ? 0 : 1);
const SG = (z) => (z < 0 ? -1 : z === 0 ? 0 : 1);
const zOf = (w, b, x) => w[0] * x[0] + w[1] * x[1] + b;
const nextOf = (w, x, y, yhat, eta) => [w[0] + eta * (y - yhat) * x[0], w[1] + eta * (y - yhat) * x[1]];
const seen = { kinds: new Map(), stays: 0, traps: 0, onLine: 0, batches: 0, etas: new Set(), forms: new Set() };
const count = (k) => seen.kinds.set(k, (seen.kinds.get(k) ?? 0) + 1);

for (const level of [1, 2, 3]) {
  for (let r = 0; r < 30; r++) {
    const seed = 1000 * level + r * 7919 + 13;
    const items = M.makeItems(rng(seed), level);
    const w0 = `L${level} seed ${seed}`;
    ok(items.length >= 9, `${w0}: only ${items.length} items`);
    ok(new Set(items.map((i) => i.id)).size === items.length, `${w0}: duplicate ids`);
    let prevStream = null;
    items.forEach((it, idx) => {
      const w = `${w0} item ${idx + 1} (${it.id})`;
      ok(typeof it.id === 'string' && it.id.length > 0, `${w}: id`);
      ok(!!CONCEPTS[it.concept], `${w}: concept ${it.concept} not in the catalogue`);
      ok(srcOk(it.src), `${w}: src ${JSON.stringify(it.src)}`);
      ok(typeof it.why === 'string' && it.why.length > 20, `${w}: why`);
      ok(!it.beyond, `${w}: nothing in this game is beyond the slides`);
      for (const s of [it.why, it.prompt, it.promptText, it.sub, ...(it.choices ?? []).flatMap((c) => [c.label, c.plain, c.sub])]) ok(!unfilled(s), `${w}: unfilled placeholder in "${s}"`);
      ok(typeof it.promptText === 'string' && !it.promptText.includes('$'), `${w}: promptText must be plain text`);
      ok(JSON.stringify(it.answer) !== undefined, `${w}: answer not serialisable`);
      ok(grade(it, it.answer) === true, `${w}: its own answer grades wrong`);
      ok(grade(it, mutate(it)) === false, `${w}: a mutated answer grades right`);
      ok(grade(it, null) === false, `${w}: an empty answer grades right`);
      if (it.kind === 'choice') {
        ok(it.choices.some((c) => c.value === it.answer), `${w}: answer not among the choices`);
        ok(new Set(it.choices.map((c) => c.value)).size === it.choices.length, `${w}: duplicate choice values`);
        ok(typeof it.format === 'function' && !it.format(it.answer).includes('$'), `${w}: format gives plain text`);
      } else {
        ok(it.kind === 'number' && Number.isFinite(it.answer), `${w}: numeric answer`);
        if (!Number.isInteger(it.answer)) ok(it.pad?.decimal === true, `${w}: decimal answer without a decimal key`);
        if (it.answer < 0) ok(it.pad?.negative === true, `${w}: negative answer without a ± key`);
      }
      count(it.id.replace(/^bb\d-\d+-/, '').replace(/-.*$/, ''));

      const sc = it.scene;
      // independent recomputation
      if (sc.type === 'plane') {
        ok(sc.b === -1 || sc.b === 1, `${w}: b ∈ {−1, 1}`);
        ok(sc.w[0] !== 0 || sc.w[1] !== 0, `${w}: w = 0 has no boundary`);
        seen.etas.add(sc.eta);
        if (level === 1) ok(sc.eta === 1, `${w}: level 1 uses η = 1`);
        const cur = sc.cur;
        if (cur) {
          const z = zOf(sc.w, sc.b, cur.x);
          ok(z === cur.z && H(z) === cur.yhat, `${w}: ŷ recomputed`);
          ok(z !== 0, `${w}: a stream point sits on the boundary`);
          const next = nextOf(sc.w, cur.x, cur.y, cur.yhat, sc.eta);
          ok(eqv(next, sc.after), `${w}: after ${sc.after} vs ${next}`);
          if (prevStream && prevStream.batch === sc.batch) ok(eqv(prevStream.after, sc.w), `${w}: the stream lost its w (${prevStream.after} → ${sc.w})`);
          if (sc.batch > (prevStream?.batch ?? 0)) seen.batches += 1;
          prevStream = sc;
        }
        if (it.id.includes('-dir')) {
          const e = cur.y - cur.yhat;
          ok(it.answer === (e > 0 ? 'toward' : e < 0 ? 'away' : 'stay'), `${w}: direction`);
          if (e === 0) seen.stays += 1;
        }
        if (it.id.includes('-rule')) {
          ok(cur.y !== cur.yhat, `${w}: rule item on a correct point`);
          const correct = it.choices.filter((c) => C.RULE.forms[c.value].correct);
          ok(correct.length === 1 && correct[0].value === it.answer, `${w}: exactly one correct form`);
          ok(new Set(it.choices.map((c) => C.RULE.forms[c.value].delta)).size === it.choices.length, `${w}: two choices compute the same update`);
          ok(it.choices.some((c) => C.RULE.forms[c.value].flaw === 'sign') && it.choices.some((c) => C.RULE.forms[c.value].flaw === 'factor'), `${w}: a wrong-sign and a wrong-factor distractor`);
          const ghosts = sc.ghosts.map((g) => JSON.stringify(g.w));
          ok(new Set([...ghosts, JSON.stringify(sc.w)]).size === ghosts.length + 1, `${w}: candidate boundaries coincide`);
          ok(eqv(sc.ghosts.find((g) => g.value === it.answer).w, sc.after), `${w}: the correct candidate is the rule's update`);
          seen.forms.add(it.answer);
        }
        if (it.id.includes('-upd')) {
          const i = it.ask;
          const yhat = H(zOf(sc.w, sc.b, cur.x));
          ok(it.answer === sc.w[i] + sc.eta * (cur.y - yhat) * cur.x[i], `${w}: update recomputed`);
          if (cur.y === yhat) seen.traps += 1;
          else ok(true, '');
          if (it.id.includes('shown')) ok(cur.showYhat === true, `${w}: ŷ should show`);
          else ok(cur.showYhat === false, `${w}: ŷ should be hidden`);
        }
        if (it.id.includes('-step')) {
          const z = zOf(sc.w, sc.b, sc.probe.x);
          const fn = it.promptText.includes('heaviside') ? H : SG;
          ok(it.answer === fn(z), `${w}: step recomputed`);
          if (z === 0) seen.onLine += 1;
        }
        if (it.id.endsWith('-z')) ok(it.answer === zOf(sc.w, sc.b, sc.probe.x), `${w}: z recomputed`);
        if (it.id.endsWith('-yhat')) {
          const z = zOf(sc.w, sc.b, sc.probe.x);
          ok(it.answer === H(z), `${w}: ŷ recomputed`);
          if (z === 0) seen.onLine += 1;
        }
      }
      if (sc.type === 'xor' && sc.input) {
        const [a, b] = sc.input;
        const z = [a + b - 1.5, a + b - 0.5];            // Figure 10-6b's hidden TLUs, typed here
        const h = z.map(H);
        const out = H(-1 * h[0] + 1 * h[1] - 0.5);
        const j = sc.focus === 'h2' ? 1 : 0;
        const want = sc.show === 'z' ? z[j] : sc.show === 'h' ? h[j] : out;
        ok(it.answer === want, `${w}: forward pass recomputed (${it.answer} vs ${want})`);
        if (sc.show === 'out') ok(out === (a ^ b), `${w}: the network’s output is XOR`);
      }
    });
  }
}
ok(seen.stays > 0, 'no "no change" direction item in 30 rounds');
ok(seen.traps > 0, 'no already-correct update item in 30 rounds');
ok(seen.onLine > 0, 'no probe exactly on the boundary (z = 0) in 30 rounds');
ok(seen.etas.size === 3, `η values seen: ${[...seen.etas]}`);
ok(seen.forms.size === 2, `rule forms seen as answers: ${[...seen.forms]}`);

// ── 4. content sources ───────────────────────────────────────────────────────
const srcs = [C.NOTATION.src, C.DIR.src, C.RULE.src, C.TLU.src, C.STEP.src, C.ZQ.src, C.YHAT.src, C.UPD.src, C.XOR.src, C.XOR_FIX.src, C.XOR_FWD.src, C.MATHS.src,
  ...Object.values(C.RULE.forms).map((f) => f.src), ...Object.values(C.XOR_BLANKS).map((q) => q.src),
  ...C.CONCEPT_L2.a.map((q) => q.src), ...C.CONCEPT_L2.b.map((q) => q.src), ...C.CONCEPT_L3.a.map((q) => q.src), ...C.CONCEPT_L3.b.map((q) => q.src)];
srcs.forEach((s, i) => ok(srcOk(s), `content src #${i}: ${JSON.stringify(s)}`));
[...C.CONCEPT_L2.a, ...C.CONCEPT_L2.b, ...C.CONCEPT_L3.a, ...C.CONCEPT_L3.b].forEach((q) => {
  ok(!!CONCEPTS[q.concept], `concept question ${q.id}: ${q.concept} not in the catalogue`);
  if (q.kind === 'choice') ok(q.choices.some((c) => c.value === q.answer), `concept question ${q.id}: answer not a choice`);
});
// slide 14's SGDClassifier settings
ok(C.CONCEPT_L2.b.find((q) => q.id === 'eta0').answer === 1, 'slide 14: eta0=1');

// ── report ─────────────────────────────────────────────────────────────────
console.log(`Boundary Bash check: ${checks} assertions`);
console.log(`  item kinds over 90 rounds: ${[...seen.kinds].map(([k, n]) => `${k} ×${n}`).join(', ')}`);
console.log(`  "no change" directions ${seen.stays}, already-correct updates ${seen.traps}, probes on the boundary ${seen.onLine}, new batches ${seen.batches}, η seen ${[...seen.etas].join(' / ')}`);
console.log(`  single TLUs separating XOR on a 33³ grid: ${separates}`);
if (failures.length) {
  console.log(`\n${failures.length} FAILURE(S):`);
  failures.slice(0, 40).forEach((m) => console.log(`  ✗ ${m}`));
  process.exit(1);
}
console.log('All checks passed.');
