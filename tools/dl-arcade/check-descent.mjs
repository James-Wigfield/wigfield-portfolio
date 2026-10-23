#!/usr/bin/env node
/* check-descent.mjs — Descent (Lecture 2) fidelity and round checks.

   1. FIDELITY: one hand-worked step (two where the second step is where the
      rule shows) per optimiser, taken from the slide equations, against
      arcade/maths/descent.js. Arithmetic is in the comments, with the slide.
   2. SCHEDULES and CLIPPING against the numbers printed on slides 29, 50–58
      (the ANCHORS in content/lecture2.js).
   3. ROUNDS: 30 seeded rounds per level. Every item has a unique id, a concept
      in the catalogue, a Lecture 2 src, a why, a choice answer the bot can
      submit (and a wrong value that grades false), and is JSON-serialisable.
      Every hole is re-swung independently here: the par club is the unique
      winner by the margin, and the losers fail the way the why card says.
      The cliff's gradient at the ball is the vector printed. Every TeX string
      renders with KaTeX in strict mode.

   Run:  node tools/dl-arcade/check-descent.mjs        (exit 1 on any failure) */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const arcade = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade');
const imp = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const D = await imp('maths/descent.js');
const { buildHole } = await imp('maths/descentHoles.js');
const G = await imp('maths/descentItems.js');
const { rng } = await imp('core/rng.js');
const { CONCEPTS } = await imp('core/concepts.js');
const L2 = await imp('content/lecture2.js');
const C = await imp('content/descent.js');
// kit/useRound.js grade() for kind 'choice' (the kit uses extensionless imports Node cannot load)
const grade = (item, given) => (typeof item.check === 'function' ? !!item.check(given) : item.kind === 'choice' ? given === item.answer : false);
const katex = (await import(pathToFileURL(path.join(root, 'node_modules', 'katex', 'dist', 'katex.mjs')).href)).default;

const failures = [];
let passed = 0;
const fail = (msg) => failures.push(msg);
const near = (a, b, tol) => Math.abs(a - b) <= tol;
const nearV = (a, b, tol = 1e-6) => a.length === b.length && a.every((v, i) => near(v, b[i], tol));
function expectV(name, got, want, tol = 1e-6) {
  if (nearV(got, want, tol)) passed++;
  else fail(`${name}: got (${got.join(', ')}) want (${want.join(', ')})`);
}
function expect(name, ok, detail = '') {
  if (ok) passed++;
  else fail(`${name}${detail ? `: ${detail}` : ''}`);
}

/* ── 1. fidelity: hand-worked steps from the slide equations ─────────────
   The surface: J(θ) = ½(θ₁² + 4θ₂²), so ∇θJ(θ) = (θ₁, 4θ₂).
   Tee θ = (2, 1), so ∇θJ = (2, 4). Learning rate η = 0.1.            */
const grad = ([a, b]) => [a, 4 * b];
const hp = (club) => ({ club, eta: 0.1 });
const two = (club) => {
  const s1 = D.step(D.initState([2, 1]), grad, hp(club));
  const s2 = D.step(s1, grad, hp(club));
  return [s1, s2];
};

{
  // SGD, slide 34: θ ← θ − η∇θJ(θ)
  //   θ = (2 − 0.1·2, 1 − 0.1·4) = (1.8, 0.6)
  const [s1] = two('sgd');
  expectV('sgd step 1 (slide 34)', s1.theta, [1.8, 0.6]);
}
{
  // Momentum, slide 34: m ← βm − η∇θJ(θ); θ ← θ + m, β = 0.9
  //   step 1: m = 0.9·0 − 0.1·(2, 4) = (−0.2, −0.4); θ = (1.8, 0.6)
  //   step 2: ∇J(1.8, 0.6) = (1.8, 2.4)
  //           m = 0.9·(−0.2, −0.4) − 0.1·(1.8, 2.4) = (−0.36, −0.60)
  //           θ = (1.8 − 0.36, 0.6 − 0.60) = (1.44, 0.0)
  const [s1, s2] = two('momentum');
  expectV('momentum step 1 m (slide 34)', s1.m, [-0.2, -0.4]);
  expectV('momentum step 1 θ (slide 34)', s1.theta, [1.8, 0.6]);
  expectV('momentum step 2 m (slide 34)', s2.m, [-0.36, -0.6]);
  expectV('momentum step 2 θ (slide 34)', s2.theta, [1.44, 0.0]);
}
{
  // NAG, slide 36: m ← βm − η∇θJ(θ + βm); θ ← θ + m, β = 0.9
  //   step 1: m = 0, so the look-ahead is θ itself: same as momentum,
  //           m = (−0.2, −0.4), θ = (1.8, 0.6)
  //   step 2: look-ahead θ + βm = (1.8 − 0.18, 0.6 − 0.36) = (1.62, 0.24)
  //           ∇J(1.62, 0.24) = (1.62, 0.96)
  //           m = 0.9·(−0.2, −0.4) − 0.1·(1.62, 0.96) = (−0.342, −0.456)
  //           θ = (1.8 − 0.342, 0.6 − 0.456) = (1.458, 0.144)
  const [s1, s2] = two('nag');
  expectV('nag step 1 θ (slide 36)', s1.theta, [1.8, 0.6]);
  expectV('nag step 2 look-ahead (slide 36)', s2.ahead, [1.62, 0.24]);
  expectV('nag step 2 m (slide 36)', s2.m, [-0.342, -0.456]);
  expectV('nag step 2 θ (slide 36)', s2.theta, [1.458, 0.144]);
}
{
  // AdaGrad, slide 38: s ← s + ∇J ⊗ ∇J; θ ← θ − η∇J ⊘ √(s + ε), ε = 10⁻¹⁰
  //   step 1: s = (2², 4²) = (4, 16); θ = (2 − 0.1·2/√4, 1 − 0.1·4/√16) = (1.9, 0.9)
  //   step 2: ∇J(1.9, 0.9) = (1.9, 3.6); s = (4 + 3.61, 16 + 12.96) = (7.61, 28.96)
  //           θ = (1.9 − 0.19/√7.61, 0.9 − 0.36/√28.96)
  //             = (1.9 − 0.19/2.758623, 0.9 − 0.36/5.381450) = (1.831125, 0.833104)
  const [s1, s2] = two('adagrad');
  expectV('adagrad step 1 s (slide 38)', s1.s, [4, 16]);
  expectV('adagrad step 1 θ (slide 38)', s1.theta, [1.9, 0.9]);
  expectV('adagrad step 2 s (slide 38)', s2.s, [7.61, 28.96]);
  expectV('adagrad step 2 θ (slide 38)', s2.theta, [1.831125, 0.833104], 1e-6);
}
{
  // RMSProp, slide 41: s ← ρs + (1 − ρ)∇J ⊗ ∇J; θ ← θ − η∇J ⊘ √(s + ε), ρ = 0.9
  //   step 1: s = 0.1·(4, 16) = (0.4, 1.6)
  //           θ = (2 − 0.2/√0.4, 1 − 0.4/√1.6) = (2 − 0.316228, 1 − 0.316228) = (1.683772, 0.683772)
  const [s1] = two('rmsprop');
  expectV('rmsprop step 1 s (slide 41)', s1.s, [0.4, 1.6]);
  expectV('rmsprop step 1 θ (slide 41)', s1.theta, [1.683772, 0.683772], 1e-6);
}
{
  // Adam, slide 43, β₁ = 0.9, β₂ = 0.999 (slide 44), ε = 10⁻¹⁰, t = 1, 2
  //   t = 1: m = 0.1·(2, 4) = (0.2, 0.4); s = 0.001·(4, 16) = (0.004, 0.016)
  //          m̂ = m/(1 − 0.9) = (2, 4); ŝ = s/(1 − 0.999) = (4, 16)
  //          θ = (2 − 0.1·2/√4, 1 − 0.1·4/√16) = (1.9, 0.9)
  //   t = 2: ∇J(1.9, 0.9) = (1.9, 3.6)
  //          m = 0.9·(0.2, 0.4) + 0.1·(1.9, 3.6) = (0.37, 0.72)
  //          s = 0.999·(0.004, 0.016) + 0.001·(3.61, 12.96) = (0.007606, 0.028944)
  //          m̂ = m/(1 − 0.81) = (1.947368, 3.789474)
  //          ŝ = s/(1 − 0.998001) = (3.804902, 14.479240)
  //          θ = (1.9 − 0.1·1.947368/√3.804902, 0.9 − 0.1·3.789474/√14.479240) = (1.800166, 0.800412)
  const [s1, s2] = two('adam');
  expectV('adam t=1 m (slide 43)', s1.m, [0.2, 0.4]);
  expectV('adam t=1 s (slide 43)', s1.s, [0.004, 0.016]);
  expectV('adam t=1 m̂ (slide 43)', s1.mHat, [2, 4]);
  expectV('adam t=1 ŝ (slide 43)', s1.sHat, [4, 16]);
  expectV('adam t=1 θ (slide 43)', s1.theta, [1.9, 0.9]);
  expectV('adam t=2 m (slide 43)', s2.m, [0.37, 0.72]);
  expectV('adam t=2 s (slide 43)', s2.s, [0.007606, 0.028944]);
  expectV('adam t=2 m̂ (slide 43)', s2.mHat, [1.947368, 3.789474], 1e-6);
  expectV('adam t=2 ŝ (slide 43)', s2.sHat, [3.804902, 14.479240], 1e-6);
  expectV('adam t=2 θ (slide 43)', s2.theta, [1.800166, 0.800412], 1e-6);
  expect('adam t is the iteration number (slide 43)', s1.t === 1 && s2.t === 2);
}
{
  // the slides' defaults (34, 41, 44, 38)
  expect('β = 0.9 (slide 34)', D.DEFAULTS.beta === 0.9);
  expect('ρ = 0.9 (slide 41)', D.DEFAULTS.rho === 0.9);
  expect('β₁ = 0.9, β₂ = 0.999 (slide 44)', D.DEFAULTS.beta1 === 0.9 && D.DEFAULTS.beta2 === 0.999);
  expect('ε = 10⁻¹⁰ (slide 38)', D.DEFAULTS.epsilon === 1e-10);
  expect('lecture2 EQUATIONS agree on β, ρ, β₁, β₂, ε', L2.EQUATIONS.momentum.vars.beta.value === 0.9 && L2.EQUATIONS.rmsprop.vars.rho.value === 0.9
    && L2.EQUATIONS.adam.vars.beta1.value === 0.9 && L2.EQUATIONS.adam.vars.beta2.value === 0.999 && L2.EQUATIONS.adagrad.vars.epsilon.value === 1e-10);
}

/* ── 2. clipping (slide 29) and schedules (slides 50–58) ─────────────── */
// clipvalue=1.0 clips every component to [−1.0, 1.0]
expectV('clipvalue (−14.2, 3.6) → (−1, 1) (slide 29)', D.clipValue([-14.2, 3.6], 1), [-1, 1]);
expectV('clipvalue (−12, 0.6) → (−1, 0.6) (slide 29)', D.clipValue([-12, 0.6], 1), [-1, 0.6]);
// clipnorm retains the orientation: (3, 4) → (0.6, 0.8), parallel to (3, 4)
{
  const c = D.clipNorm([3, 4], 1);
  expectV('clipnorm (3, 4) keeps its direction (slide 29)', c, [0.6, 0.8]);
  const v = D.clipValue([3, 4], 1);
  expect('clipvalue (3, 4) → (1, 1) changes the direction (slide 29)', Math.abs(v[0] * 4 - v[1] * 3) > 0.5);
}
const A = Object.fromEntries(L2.ANCHORS.map((a) => [a.id, a]));
const p10 = { eta0: 0.01, r: 1, s: 10, c: 1 };
expect('power η(10), s = 10 (slide 50)', near(D.powerSched(10, p10), A['l2.sched.power.s10.t10'].value, 1e-12));
expect('power η(20), s = 10 → 0.00333 (slide 50)', near(D.powerSched(20, p10), A['l2.sched.power.s10.t20'].value, 5e-6));
expect('power η(20), s = 20 (slide 50)', near(D.powerSched(20, { ...p10, s: 20 }), A['l2.sched.power.s20.t20'].value, 1e-12));
expect('InverseTimeDecay at 10,000 (slide 51)', near(D.powerSched(10000, { eta0: 0.01, r: 1, s: 10000 }), A['l2.sched.power.keras'].value, 1e-12));
expectV('exponential r = 0.1, s = 15: η(15), η(30) ÷ η₀ (slide 52)', [D.expSched(15, { eta0: 1, r: 0.1, s: 15 }), D.expSched(30, { eta0: 1, r: 0.1, s: 15 })], A['l2.sched.exp.t15'].value, 1e-12);
expectV('exponential chart r = 0.5 (slide 52)', [10, 20, 30].map((t) => D.expSched(t, { eta0: 0.1, r: 0.5, s: 10 })), A['l2.sched.exp.chart.r05'].value, 1e-12);
expectV('exponential chart r = 0.2 (slide 52)', [10, 20, 30].map((t) => D.expSched(t, { eta0: 0.1, r: 0.2, s: 10 })), A['l2.sched.exp.chart.r02'].value, 1e-12);
expect('ExponentialDecay at 20,000 (slide 53)', near(D.expSched(20000, { eta0: 0.01, r: 0.1, s: 20000 }), A['l2.sched.exp.keras'].value, 1e-12));
expectV('PiecewiseConstantDecay at 0, 60,000, 90,000 (slide 56)', [0, 60000, 90000].map((t) => D.piecewiseSched(t, { boundaries: [50000, 80000], values: [0.01, 0.005, 0.001] })), A['l2.sched.piecewise.keras'].value, 1e-12);
{
  // ReduceLROnPlateau(factor=0.5, patience=5): the best loss at epoch 2, then epochs 3–7 (5 consecutive)
  // do not improve on it, so η is cut at epoch 7: 0.010 × 0.5 = 0.005
  const etas = D.performanceSched([0.5, 0.45, 0.4, 0.41, 0.42, 0.41, 0.43, 0.44, 0.3], { eta0: 0.01, factor: 0.5, patience: 5 });
  expect('ReduceLROnPlateau cuts 0.010 → 0.005 after 5 flat epochs (slide 57)', etas[6] === 0.01 && etas[7] === A['l2.sched.performance'].value);
}
{
  // the performance chart is shaped like slide 58's run: one cut, 0.010 → 0.005 at epoch 16,
  // BEFORE the validation loss drops (epoch 17), and η stays at 0.005 to the end
  const { pts, loss } = G.schedCurve({ curve: 'performance' });
  const etas = pts.map((p) => p.eta);
  const cuts = etas.map((v, i) => (i > 0 && v < etas[i - 1] ? i : null)).filter((i) => i !== null);
  expect('performance chart: one cut, at epoch 16 (slide 58)', cuts.length === 1 && cuts[0] === 16, `cuts at ${cuts.join(', ')}`);
  expect('performance chart: 0.010 → 0.005 (slide 58)', etas[15] === 0.01 && etas[24] === 0.005);
  expect('performance chart: the loss drop follows the cut (slide 58)', loss[17] < Math.min(...loss.slice(0, 17)) - 0.02 && Math.min(...loss.slice(12, 17)) > Math.min(...loss.slice(0, 12)));
}

/* ── 3. the rounds ──────────────────────────────────────────────────── */
const ESC = new Set(['sgd', 'momentum', 'nag', 'adagrad', 'rmsprop', 'adam']);
const texOk = (src, where) => {
  try {
    katex.renderToString(src, { throwOnError: true, strict: 'error' });
    return true;
  } catch (e) {
    fail(`KaTeX ${where}: ${e.message.slice(0, 120)} in ${src}`);
    return false;
  }
};
const mathIn = (s) => (String(s).match(/\$[^$]+\$/g) ?? []).map((m) => m.slice(1, -1));
const counts = {};
const stats = { holes: 0, parSteps: [] };

function checkHole(it, where) {
  const spec = it.hole;
  const bag = it.choices.map((c) => c.value);
  const { grad: g } = buildHole(spec);
  // an independent swing of every club in the bag
  const steps = {};
  for (const c of bag) {
    expect(`${where} bag club ${c} is a known club`, ESC.has(c));
    const { path, diverged } = D.run(c, g, spec.start, { eta: spec.eta }, spec.nMax, 50);
    steps[c] = D.holedAt(path, spec.flag, spec.r, diverged);
    expect(`${where} ${c} steps match the item`, steps[c] === it.results[c].steps, `${steps[c]} vs ${it.results[c].steps}`);
  }
  const ranked = bag.map((c) => [c, steps[c] ?? Infinity]).sort((a, b) => a[1] - b[1]);
  expect(`${where} par club is the answer`, ranked[0][0] === it.answer, `${ranked[0][0]} vs ${it.answer}`);
  expect(`${where} par club holes`, Number.isFinite(ranked[0][1]));
  expect(`${where} unique par by the margin`, ranked[0][1] <= G.MARGIN * ranked[1][1], `${ranked[0][1]} vs ${ranked[1][1]}`);
  expect(`${where} par steps recorded`, it.par.steps === ranked[0][1] && it.par.club === it.answer);
  expect(`${where} par leaves the ball in the cup for at least a fifth of the run`, it.par.steps <= 0.8 * spec.nMax);
  // the why card's story
  const k = spec.kind;
  if (k === 'dimple' && bag.includes('sgd') && it.answer === 'momentum') expect(`${where} SGD settles in the dimple`, it.results.sgd.status === 'stuck');
  if ((k === 'valley' || (k === 'flats' && it.answer === 'adam')) && bag.includes('adagrad')) expect(`${where} AdaGrad stalls short of the flag`, it.results.adagrad.status === 'stalled');
  if (k === 'narrow') expect(`${where} momentum swings past the flag, further than NAG`, it.results.momentum.overshoot > spec.r && it.results.nag.overshoot < it.results.momentum.overshoot);
  if (it.answer === 'adam' && k === 'dimple') expect(`${where} Adam is the only club with momentum in the bag`, !bag.includes('momentum') && !bag.includes('nag'));
  if (k === 'bowl') {
    // slide 35 (momentum almost always faster than GD) and Table 11-2 (slide 47): on every
    // bowl, momentum, NAG and Adam hole sooner than plain GD, in the bag or not
    const off = (c) => {
      const { path, diverged } = D.run(c, g, spec.start, { eta: spec.eta }, spec.nMax, 50);
      return D.holedAt(path, spec.flag, spec.r, diverged) ?? Infinity;
    };
    const sgd = off('sgd');
    for (const c of ['momentum', 'nag', 'adam']) {
      const n = off(c);
      expect(`${where} ${c} beats SGD on the bowl (slides 35, 47)`, Number.isFinite(n) && n < sgd, `${n} vs SGD ${sgd}`);
    }
    if (bag.length === 6) expect(`${where} six-club bowl is marked beyond the slides`, it.beyond === true && typeof it.note === 'string');
  }
  stats.holes++;
  stats.parSteps.push(it.par.steps);
}

for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const where0 = `L${level} seed ${seed}`;
    let items;
    try {
      items = G.makeItems(rng(seed * 7919 + level), level);
    } catch (e) {
      fail(`${where0}: makeItems threw ${e.message}`);
      continue;
    }
    expect(`${where0} has ${G.ROUND_SIZE} items`, items.length === G.ROUND_SIZE);
    const ids = new Set();
    items.forEach((it, i) => {
      const where = `${where0} #${i} ${it.id}`;
      counts[it.type] = (counts[it.type] ?? 0) + 1;
      expect(`${where} id`, typeof it.id === 'string' && it.id.length > 0 && !ids.has(it.id));
      ids.add(it.id);
      expect(`${where} concept in the catalogue`, !!CONCEPTS[it.concept], it.concept);
      expect(`${where} concept is Lecture 2`, CONCEPTS[it.concept]?.lecture === 2);
      expect(`${where} src is Lecture 2 with slides`, it.src?.lecture === 2 && Array.isArray(it.src.slides) && it.src.slides.length > 0);
      expect(`${where} why`, typeof it.why === 'string' && it.why.length > 20);
      expect(`${where} promptText`, typeof it.promptText === 'string' && it.promptText.length > 5);
      expect(`${where} kind choice`, it.kind === 'choice');
      const values = it.choices.map((c) => c.value);
      expect(`${where} answer among the choices`, values.includes(it.answer));
      expect(`${where} choices distinct`, new Set(values).size === values.length && new Set(it.choices.map((c) => c.label)).size === values.length);
      expect(`${where} ≥ 2 choices, ≤ 6`, values.length >= 2 && values.length <= 6);
      // the bot: the item's own answer grades true; a wrong value and a skip grade false
      const wrong = values.find((v) => v !== it.answer);
      expect(`${where} the kit grades the answer true, a wrong pick and a skip false`, grade(it, it.answer) === true && grade(it, wrong) === false && grade(it, null) === false);
      const json = JSON.parse(JSON.stringify(it));
      expect(`${where} JSON-serialisable`, JSON.stringify(json) === JSON.stringify(it) && json.answer === it.answer);
      expect(`${where} beyond flag absent or noted`, !it.beyond || typeof it.note === 'string');
      mathIn(it.why).forEach((m) => texOk(m, `${where} why`));
      if (it.prompt) mathIn(it.prompt).forEach((m) => texOk(m, `${where} prompt`));
      it.choices.forEach((c) => c.tex && texOk(c.tex, `${where} choice`));
      if (it.type === 'hole') checkHole(it, where);
      if (it.type === 'clip') {
        const gAt = buildHole(it.hole).grad(it.hole.start);
        expectV(`${where} cliff gradient at the ball is the vector shown`, gAt, it.g, 1e-9);
        expectV(`${where} clipvalue result`, it.clipped.value, D.clipValue(it.g, 1), 1e-12);
        if (it.variant === 'value') expect(`${where} clipvalue answer`, it.answer === G.fmtVec(D.clipValue(it.g, 1)));
        if (it.variant === 'which') expect(`${where} which answer is the setting shown`, it.answer === it.shown);
        if (it.variant === 'orient') expect(`${where} orientation answer is clipnorm`, it.answer === 'clipnorm');
      }
      if (it.type === 'dial') {
        const { path, diverged } = D.run('sgd', buildHole(it.hole).grad, it.hole.start, { eta: it.eta }, it.hole.nMax, 50);
        const last = path[path.length - 1];
        const far = Math.hypot(last[0] - it.hole.flag[0], last[1] - it.hole.flag[1]);
        if (it.answer === 'down') expect(`${where} η too high: SGD flies off`, diverged || far > 5);
        else expect(`${where} η too low: SGD crawls`, D.holedAt(path, it.hole.flag, it.hole.r) === null && far > 1);
      }
      if (it.type === 'sched' && (it.variant === 'power' || it.variant === 'exponential')) {
        const f = it.variant === 'power' ? D.powerSched : D.expSched;
        expect(`${where} schedule answer`, it.answer === G.fmtEta(f(it.t, it.params)));
      }
      if (it.type === 'sched' && it.variant === 'piecewise') expect(`${where} piecewise answer`, Number(it.answer) === D.piecewiseSched(it.t, it.params));
    });
  }
}

// every TeX string the game shows outside items: the EQUATIONS it renders and the content
Object.values(C.CLUBS).forEach((c) => L2.EQUATIONS[c.eq].tex.forEach((t) => texOk(t, `EQUATIONS.${c.eq}`)));
C.DEFAULTS_NOTE.forEach((d) => texOk(d.sym, 'DEFAULTS_NOTE'));
texOk(C.SCHED.power.tex, 'SCHED.power');
texOk(C.SCHED.exponential.tex, 'SCHED.exponential');
Object.values(C.WINS).forEach((w) => mathIn(w.why).forEach((m) => texOk(m, 'WINS')));
C.EQ.forEach((e) => {
  expect(`EQ ${e.id} concept in the catalogue`, !!CONCEPTS[e.concept]);
  expect(`EQ ${e.id} TeX prompt has a plain version`, !e.prompt.includes('$') || typeof e.plain === 'string');
});

const sorted = stats.parSteps.slice().sort((a, b) => a - b);
console.log(`Descent check: ${passed} assertions passed, ${failures.length} failed.`);
console.log(`  items by type: ${JSON.stringify(counts)}; holes ${stats.holes}, par steps median ${sorted[Math.floor(sorted.length / 2)]}, max ${sorted[sorted.length - 1]}`);
if (failures.length) {
  console.log(failures.slice(0, 40).map((f) => `  FAIL ${f}`).join('\n'));
  process.exit(1);
}
