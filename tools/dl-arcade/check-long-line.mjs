#!/usr/bin/env node
/* check-long-line.mjs — The Long Short-Term Line: fidelity + round checks.

   1. Fidelity: one LSTM step and one GRU step worked by hand from the slide
      equations (Lecture 4 slide 47 and slide 49), with tiny numbers and the
      arithmetic in the comments, against the game's maths (maths/longLine.js,
      which calls lecture4-study/rnn.js): the general cell (lstmStep/gruStep with
      non-zero weights) and the game's toy stations (a lever = a ±6 bias).
      Plus one SimpleRNN step (slide 9) and the deliver-station trap.
   2. Rounds: 30 seeded rounds per level. Every item has an id (unique in its
      round), a concept present in the catalogue, a src on Lecture 4, a why, a
      prompt, a JSON-serialisable answer that its own grader accepts, and a
      mutated answer that the grader rejects. Stations: every gate either
      clearly matters (> CLEAR) or clearly does not (< FLAT), and the gates the
      card is about matter. Every KaTeX string parses.

   Run:  node tools/dl-arcade/check-long-line.mjs        (exit 1 on any failure) */

import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import katex from 'katex';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const dl = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning');
const arcade = path.join(dl, 'arcade');
const load = (p) => import(pathToFileURL(p).href);

const LL = await load(path.join(arcade, 'maths', 'longLine.js'));
const RNN = await load(path.join(dl, 'lecture4-study', 'rnn.js'));
const { rng } = await load(path.join(arcade, 'core', 'rng.js'));
const { CONCEPTS } = await load(path.join(arcade, 'core', 'concepts.js'));
const CONTENT = await load(path.join(arcade, 'content', 'long-line.js'));
const { EQUATIONS } = await load(path.join(arcade, 'content', 'lecture4.js'));
const manifestSrc = (await import('node:fs')).readFileSync(path.join(arcade, 'games', 'long-line', 'index.js'), 'utf8');

const failures = [];
let passes = 0;
const fail = (msg) => failures.push(msg);
const ok = (cond, msg) => (cond ? passes++ : fail(msg));
const near = (a, b, tol, msg) => ok(Math.abs(a - b) <= tol, `${msg}: got ${a}, want ${b}`);
const TOL = 1e-9;

/* ── 1. fidelity ─────────────────────────────────────────────────────── */

// σ(±6), the toy gate values (slide 46: the gate controllers are logistic, 0 to 1)
//   σ(6)  = 1 / (1 + e^−6) = 1 / 1.0024787522 = 0.9975273768
//   σ(−6) = 1 / (1 + e^6)  = 1 / 404.4287934  = 0.0024726232
near(LL.gateValue(1), 0.9975273768433653, TOL, 'σ(+6)');
near(LL.gateValue(0), 0.0024726231566347743, TOL, 'σ(−6)');

// (a) the general LSTM cell, slide 47, one unit, tiny weights:
//   x(t) = 0.5, h(t−1) = 0.2, c(t−1) = 0.4
//   i = σ(x·W_xi + h·W_hi + b_i) = σ(0.5·0.6 + 0.2·(−0.3) + 0.1) = σ(0.34) = 0.5841905229
//   f = σ(x·W_xf + h·W_hf + b_f) = σ(0.5·0.2 + 0.2·0.5 + 0.4)    = σ(0.60) = 0.6456563062
//   o = σ(x·W_xo + h·W_ho + b_o) = σ(0.5·(−0.4) + 0.2·0.8 + 0.2) = σ(0.16) = 0.5399148846
//   g = tanh(x·W_xg + h·W_hg + b_g) = tanh(0.5·1 + 0.2·0.5 − 0.1) = tanh(0.5) = 0.4621171573
//   c(t) = f ⊗ c(t−1) + i ⊗ g = 0.6456563062·0.4 + 0.5841905229·0.4621171573
//        = 0.2582625225 + 0.2699644638 = 0.5282269862
//   y(t) = h(t) = o ⊗ tanh(c(t)) = 0.5399148846·tanh(0.5282269862) = 0.5399148846·0.4840246237 = 0.2613320988
{
  const W = {
    Wxi: [[0.6]], Whi: [[-0.3]], bi: [0.1],
    Wxf: [[0.2]], Whf: [[0.5]], bf: [0.4],
    Wxo: [[-0.4]], Who: [[0.8]], bo: [0.2],
    Wxg: [[1.0]], Whg: [[0.5]], bg: [-0.1],
  };
  const s = RNN.lstmStep([0.5], [0.2], [0.4], W);
  near(s.i[0], 0.5841905229354073, TOL, 'LSTM slide 47: i');
  near(s.f[0], 0.6456563062257954, TOL, 'LSTM slide 47: f');
  near(s.o[0], 0.5399148845555657, TOL, 'LSTM slide 47: o');
  near(s.g[0], 0.46211715726000974, TOL, 'LSTM slide 47: g (tanh, not σ)');
  near(s.c[0], 0.5282269862474671, TOL, 'LSTM slide 47: c(t) = f⊗c(t−1) + i⊗g');
  near(s.h[0], 0.26133209884968883, TOL, 'LSTM slide 47: y(t) = h(t) = o⊗tanh(c(t))');
}

// (b) the game's LSTM station (toy: gates' weights 0, a lever = bias ±6; g reads x with W_xg = 1, W_hg = 0, b_g = 0):
//   x(t) = 0.8, h(t−1) = 0.3, c(t−1) = 0.5, levers f = 1, i = 1, o = 0 ("load this crate too")
//   i = σ(0.8·0 + 0.3·0 + 6) = 0.9975273768 ; f = σ(6) = 0.9975273768 ; o = σ(−6) = 0.0024726232
//   g = tanh(0.8·1 + 0.3·0 + 0) = tanh(0.8) = 0.6640367703
//   c(t) = 0.9975273768·0.5 + 0.9975273768·0.6640367703 = 0.4987636884 + 0.6623948576 = 1.1611585460
//   h(t) = 0.0024726232·tanh(1.1611585460) = 0.0024726232·0.8214170850 = 0.0020310549
{
  const s = LL.lstmStation({ c: 0.5, h: 0.3 }, 0.8, { f: 1, i: 1, o: 0 });
  near(s.i, 0.9975273768433653, TOL, 'LSTM station: i');
  near(s.f, 0.9975273768433653, TOL, 'LSTM station: f');
  near(s.o, 0.0024726231566347743, TOL, 'LSTM station: o');
  near(s.g, 0.6640367702678489, TOL, 'LSTM station: g');
  near(s.c, 1.1611585459945104, TOL, 'LSTM station: c(t)');
  near(s.h, 0.002031054905596069, TOL, 'LSTM station: h(t)');
  const out = LL.stationOut('lstm', { c: 0.5, h: 0.3 }, 0.8, { f: 1, i: 1, o: 0 });
  near(out.c, s.c, TOL, 'stationOut lstm c');
}

// (c) the general GRU cell, slide 49, one unit (with one unit, r⊤W_hg ⊗ h⊤ and (r ⊗ h)⊤W_hg agree):
//   x(t) = 0.5, h(t−1) = 0.4
//   z = σ(x·W_xz + h·W_hz + b_z) = σ(0.5·0.3 + 0.4·0.5 − 0.2)   = σ(0.15) = 0.5374298453
//   r = σ(x·W_xr + h·W_hr + b_r) = σ(0.5·(−0.5) + 0.4·1.0 + 0.1) = σ(0.25) = 0.5621765009
//   g = tanh(x·W_xg + (r·W_hg ⊗ h) + b_g) = tanh(0.5·0.8 + 0.5621765009·0.6·0.4 + 0.05)
//     = tanh(0.4 + 0.1349223602 + 0.05) = tanh(0.5849223602) = 0.5262338941
//   h(t) = z ⊗ h(t−1) + (1 − z) ⊗ g = 0.5374298453·0.4 + 0.4625701547·0.5262338941
//        = 0.2149719381 + 0.2434200938 = 0.4583920319      (z multiplies the PREVIOUS state)
{
  const W = {
    Wxz: [[0.3]], Whz: [[0.5]], bz: [-0.2],
    Wxr: [[-0.5]], Whr: [[1.0]], br: [0.1],
    Wxg: [[0.8]], Whg: [[0.6]], bg: [0.05],
  };
  const s = RNN.gruStep([0.5], [0.4], W);
  near(s.z[0], 0.5374298453437496, TOL, 'GRU slide 49: z');
  near(s.r[0], 0.5621765008857981, TOL, 'GRU slide 49: r');
  near(s.g[0], 0.5262338941338529, TOL, 'GRU slide 49: g');
  near(s.h[0], 0.4583920319323571, TOL, 'GRU slide 49: h(t) = z⊗h(t−1) + (1−z)⊗g');
  // the swapped convention ((1 − z)⊗h(t−1) + z⊗g) would give a different number: make sure we are not computing it
  const swapped = (1 - s.z[0]) * 0.4 + s.z[0] * s.g[0];
  ok(Math.abs(s.h[0] - swapped) > 1e-3, 'GRU: the slides’ z convention is distinguishable from the swapped one');
}

// (d) the game's GRU station ("load this crate on top of the old cargo": z = 0, r = 1; toy W_xg = 1, W_hg = 1.5, b_g = 0):
//   x(t) = 0.4, h(t−1) = 0.66
//   z = σ(−6) = 0.0024726232 ; r = σ(6) = 0.9975273768
//   g = tanh(0.4·1 + 0.9975273768·1.5·0.66 + 0) = tanh(0.4 + 0.9875521031) = tanh(1.3875521031) = 0.8826311634
//   h(t) = 0.0024726232·0.66 + 0.9975273768·0.8826311634 = 0.0016319313 + 0.8804487491 = 0.8820806804
{
  const s = LL.gruStation({ h: 0.66 }, 0.4, { z: 0, r: 1 });
  near(s.z, 0.0024726231566347743, TOL, 'GRU station: z');
  near(s.r, 0.9975273768433653, TOL, 'GRU station: r');
  near(s.g, 0.8826311633568796, TOL, 'GRU station: g');
  near(s.h, 0.8820806803869748, TOL, 'GRU station: h(t)');
  // r gates only the previous-state term inside g: with h(t−1) = 0, r changes nothing
  const a = LL.gruStation({ h: 0 }, 0.4, { z: 0, r: 0 }).h;
  const b = LL.gruStation({ h: 0 }, 0.4, { z: 0, r: 1 }).h;
  near(a, b, TOL, 'GRU: r does not touch x(t)W_xg (h(t−1) = 0 → r irrelevant)');
}

// (e) one SimpleRNN step, slide 9 (one neuron, φ_h = tanh):
//   h(t) = tanh(h(t−1)·W_h + x(t)·W_x + b_h) = tanh(0.6·0.5 + 0.5·1 + 0) = tanh(0.8) = 0.6640367703
{
  const s = LL.rnnStation(0.6, 0.5, { Wh: 0.5, Wx: 1, bh: 0, phi: 'tanh' });
  near(s.a, 0.8, TOL, 'SimpleRNN slide 9: pre-activation');
  near(s.h, 0.6640367702678489, TOL, 'SimpleRNN slide 9: h(t)');
}

// (f) the deliver-station trap (slide 47: y(t) = h(t) = o ⊗ tanh(c(t)) reads the NEW c(t)):
//   c(t−1) = 0.76, x = 0.6, levers f = 0, i = 0, o = 1 → c(t) = σ(−6)·0.76 + σ(−6)·tanh(0.6) ≈ 0.0032 → h(t) ≈ 0.0032
{
  const s = LL.lstmStation({ c: 0.76, h: 0 }, 0.6, { f: 0, i: 0, o: 1 });
  ok(s.h < 0.01, `deliver trap: erasing at the delivery station delivers ~nothing (h = ${s.h})`);
  const good = LL.lstmStation({ c: 0.76, h: 0 }, 0.6, { f: 1, i: 0, o: 1 });
  near(good.h, Math.tanh(good.c) * LL.gateValue(1), TOL, 'deliver: h = o·tanh(c(t))');
}

/* ── 2. the slide equations shown in the drawer parse, and match lecture4.js ── */
const texOk = (tex, where) => {
  try {
    katex.renderToString(tex, { throwOnError: true, strict: 'ignore' });
    passes++;
  } catch (e) {
    fail(`KaTeX ${where}: ${e.message.slice(0, 120)} :: ${tex.slice(0, 100)}`);
  }
};
const dollars = (text, where) => {
  if (typeof text !== 'string') return;
  ok(!/[\t\b\f\v\r]/.test(text), `control character in ${where}`);
  const parts = text.split(/(\$[^$]+\$)/g).filter((p) => p.startsWith('$') && p.endsWith('$') && p.length > 2);
  parts.forEach((p) => texOk(p.slice(1, -1), where));
  ok((text.match(/\$/g) ?? []).length % 2 === 0, `unbalanced $ in ${where}`);
};
['lstm.all', 'gru.all', 'rnn.layer'].forEach((k) => texOk(LL.aligned(EQUATIONS[k].tex), `aligned ${k}`));
// content strings
const walk = (o, where) => {
  if (typeof o === 'string') dollars(o, where);
  else if (Array.isArray(o)) o.forEach((v, i) => walk(v, `${where}[${i}]`));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k, v]) => walk(v, `${where}.${k}`));
};
walk(CONTENT, 'content');
// every content item that can be shown carries a Lecture-4 src
const srcOk = (src, where) => ok(src && src.lecture === 4 && Array.isArray(src.slides) && src.slides.length > 0 && src.slides.every((n) => Number.isInteger(n) && n >= 1 && n <= 52), `bad src at ${where}`);
Object.entries(CONTENT.CARDS).forEach(([m, cards]) => Object.entries(cards).forEach(([k, c]) => { srcOk(c.src, `CARDS.${m}.${k}`); ok(!!CONCEPTS[c.concept], `CARDS.${m}.${k}: concept ${c.concept} not in catalogue`); }));
Object.entries(CONTENT.QUESTIONS).forEach(([m, qs]) => qs.forEach((q) => { srcOk(q.src, `QUESTIONS.${m}.${q.id}`); ok(!!CONCEPTS[q.concept], `QUESTIONS.${m}.${q.id}: concept ${q.concept} not in catalogue`); }));
srcOk(CONTENT.STEP.src, 'STEP');
srcOk(CONTENT.TOY.src, 'TOY');
ok(CONTENT.TOY.beyond === true && typeof CONTENT.TOY.note === 'string', 'TOY is marked beyond with a note');
// the manifest's concepts are all in the catalogue
const manifestConcepts = [...manifestSrc.matchAll(/'((?:rnn|lstm|gru)\.[A-Za-z]+)'/g)].map((m) => m[1]);
ok(manifestConcepts.length >= 5, 'manifest lists its concepts');
manifestConcepts.forEach((c) => ok(!!CONCEPTS[c], `manifest concept ${c} not in catalogue`));

/* ── 3. 30 seeded rounds per level ───────────────────────────────────── */
const PLAN_CARDS = { 2: ['load', 'keep', 'deliver', 'swap', 'topup', 'dump'], 3: ['load', 'keep', 'deliver', 'replace', 'blend'] };
const MUST = { lstm: { load: ['i', 'o'], keep: ['f', 'i', 'o'], topup: ['f', 'i', 'o'], deliver: ['f', 'i', 'o'], loadDeliver: ['f', 'i', 'o'], swap: ['f', 'i', 'o'], dump: ['f', 'i'] }, gru: { load: ['z'], keep: ['z'], deliver: ['z'], replace: ['z', 'r'], blend: ['z', 'r'] } };
const grade = (item, given) => (typeof item.check === 'function' ? !!item.check(given) : item.kind === 'choice' ? given === item.answer : JSON.stringify(given) === JSON.stringify(item.answer));
const json = (v) => JSON.parse(JSON.stringify(v));
const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
let itemCount = 0;
const conceptsSeen = new Set();

for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = LL.makeItems(rng(seed * 7919 + level), level);
    const tag = `L${level} seed ${seed}`;
    ok(items.length >= 8 && items.length <= 14, `${tag}: ${items.length} items (want 8–14 for a 60 s round)`);
    const ids = new Set();
    items.forEach((it, idx) => {
      itemCount++;
      const w = `${tag} #${idx} ${it.id}`;
      ok(typeof it.id === 'string' && it.id.length > 0 && !ids.has(it.id), `${w}: id missing or repeated`);
      ids.add(it.id);
      ok(!!CONCEPTS[it.concept], `${w}: concept ${it.concept} not in the catalogue`);
      conceptsSeen.add(it.concept);
      srcOk(it.src, w);
      ok(typeof it.why === 'string' && it.why.length > 20, `${w}: why missing`);
      dollars(it.why, `${w} why`);
      ok(typeof it.promptText === 'string' && it.promptText.length > 5, `${w}: promptText missing`);
      ok(['choice', 'custom'].includes(it.kind), `${w}: kind ${it.kind}`);
      ok(sameJson(json(it.answer), it.answer) && it.answer !== null && it.answer !== undefined, `${w}: answer not JSON-serialisable`);
      ok(grade(it, json(it.answer)), `${w}: its own answer does not grade right`);
      ok(typeof it.format === 'function' && typeof it.format(it.answer) === 'string', `${w}: format(answer) is not a string`);
      if (it.kind === 'choice') {
        const values = it.choices.map((c) => c.value);
        ok(new Set(values).size === values.length, `${w}: repeated choice values`);
        ok(new Set(it.choices.map((c) => c.label)).size === values.length, `${w}: repeated choice labels`);
        ok(values.includes(it.answer), `${w}: answer not among the choices`);
        it.choices.forEach((c) => { dollars(c.label, `${w} choice label`); ok(typeof c.aria === 'string' && c.aria.length > 0, `${w}: choice without aria`); });
        const wrong = values.find((v) => v !== it.answer);
        ok(!grade(it, wrong), `${w}: a wrong choice grades right`);
        ok(!grade(it, null), `${w}: skip grades right`);
        if (level === 1) ok(it.run && it.run.h.length === it.run.xs.length, `${w}: level-1 item without its fade run`);
        if (it.qid === 'step') {
          const st = it.step;
          near(st.h, Math.tanh(st.hPrev * st.Wh + st.x * st.Wx + st.bh), TOL, `${w}: step h(t) by slide 9`);
          const nums = it.choices.map((c) => Number(c.label.replace('−', '-'))).sort((a, b) => a - b);
          ok(nums.every((v, k) => k === 0 || v - nums[k - 1] >= 0.045), `${w}: step choices too close`);
        }
        if (level > 1) ok(it.model === (level === 2 ? 'lstm' : 'gru') && Number.isInteger(it.t), `${w}: signal stop without its place on the line`);
      } else {
        // a station
        ok(it.type === 'station' && it.model === (level === 2 ? 'lstm' : 'gru'), `${w}: station of the wrong model`);
        ok(Array.isArray(it.care) && it.care.length > 0, `${w}: no gate matters at this station`);
        MUST[it.model][it.card].forEach((k) => ok(it.care.includes(k), `${w}: the card is about ${k}, but ${k} does not matter here`));
        const sens = LL.sensitivity(it.model, it.prev, it.x, it.answer);
        Object.entries(sens).forEach(([k, v]) => ok(v < LL.FLAT || v > LL.CLEAR, `${w}: gate ${k} sensitivity ${v.toFixed(3)} is in the grey zone`));
        // mutate each gate that matters → wrong; each that does not → still right
        LL.GATE_KEYS[it.model].forEach((k) => {
          const m = { ...it.answer, [k]: it.answer[k] ? 0 : 1 };
          if (it.care.includes(k)) ok(!grade(it, m), `${w}: flipping ${k} still grades right`);
          else ok(grade(it, m), `${w}: flipping ${k} (which changes nothing) grades wrong`);
        });
        ok(!grade(it, null) && !grade(it, {}), `${w}: an empty setting grades right`);
        // the target is the slides' equations applied to the card's setting
        const out = LL.stationOut(it.model, it.prev, it.x, it.answer);
        near(out.c, it.target.c, TOL, `${w}: target c`);
        near(out.h, it.target.h, TOL, `${w}: target h`);
        // drawer lines parse, for the answer and for all-closed levers
        const lines = it.model === 'lstm' ? LL.lstmMaths(it.prev, it.x, it.answer) : LL.gruMaths(it.prev, it.x, it.answer);
        texOk(LL.aligned(lines), `${w} drawer`);
        const zero = it.model === 'lstm' ? LL.lstmMaths(it.prev, it.x, LL.zeroLevers('lstm')) : LL.gruMaths(it.prev, it.x, LL.zeroLevers('gru'));
        texOk(LL.aligned(zero), `${w} drawer (closed)`);
        ok(!/\{due\}/.test(it.line), `${w}: unfilled {due}`);
      }
    });
    // the round's stations chain: each station starts from the previous station's target
    const st = items.filter((i) => i.type === 'station');
    st.forEach((s, k) => {
      if (k === 0) ok((s.prev.c ?? s.prev.h) === 0 && s.prev.h === 0, `${tag}: the first station must start empty (h(0) = 0, slide 10)`);
      else {
        near(s.prev.h, st[k - 1].target.h, TOL, `${tag}: station ${s.t} h(t−1)`);
        if (s.model === 'lstm') near(s.prev.c, st[k - 1].target.c, TOL, `${tag}: station ${s.t} c(t−1)`);
      }
      ok(s.t === k + 1, `${tag}: station numbering`);
    });
    if (level > 1) {
      const cards = new Set(st.map((s) => s.card));
      PLAN_CARDS[level].forEach((c) => ok(cards.has(c), `${tag}: the round never uses the ${c} card`));
      st.filter((s) => s.due !== null).forEach((s) => ok(st.find((d) => d.t === s.due && (d.card === 'deliver' || d.card === 'loadDeliver')), `${tag}: station ${s.t} says due at ${s.due}, which is not a delivery`));
    }
    if (level === 1) LL.fadeMaths(items[0].run).forEach((t, k) => texOk(t, `${tag} fade line ${k}`));
  }
}

const manifestSet = new Set(manifestConcepts);
[...conceptsSeen].forEach((c) => ok(manifestSet.has(c), `concept ${c} is drilled but not listed in the manifest`));

console.log(`check-long-line: ${passes} checks passed over ${itemCount} items (30 rounds × 3 levels); ${failures.length} failed.`);
if (failures.length) {
  failures.slice(0, 40).forEach((f) => console.log(`  FAIL ${f}`));
  process.exit(1);
}
