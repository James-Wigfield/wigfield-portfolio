#!/usr/bin/env node
/* check-overfit-clinic.mjs — Overfit Clinic (all lectures) content, fidelity and round checks.

   1. CONTENT
      - every src (cases, Rx, follow-ups, DIAGNOSES, FIXES) names a known deck and cites slides inside
        that deck's slide count (1: 64, 2: 68, 3: 53, 4: 52, 5: 27, 6 (= 6–7): 32, 8: 51);
      - the fix mapping: every case's Rx fix lists the case's failure in FIXES.treats; every fix is the
        answer for at least one case; every concept id is in the catalogue and in the manifest.
   2. FIDELITY (hand-worked from the slide equations / printed numbers)
      - slide 25: SimpleRNN(1) has 3 parameters; slides 26 / 29: the MAEs 27,703 and 29,672 (anchors);
      - slide 31: 200 labelled images and 91.85 % (anchors); slide 34: two 3 × 3 layers have fewer
        parameters than one 5 × 5 (c → c), by hand; slide 29: clipvalue=1.0 on [0.9, −3.2];
      - slides 38 / 41: AdaGrad's s after gradients 3 then 4 is 25, RMSProp's (ρ = 0.9) 2.41;
      - slide 31 (L8): the causal mask lets word i attend to words 0 … i.
   3. ROUNDS: 30 seeded rounds per level. Every item has a unique id, a concept in the catalogue, a
      src inside its deck, a why (no unfilled %placeholders%, KaTeX renders) and a gradable answer
      (JSON-serialisable, grades true; a mutated answer and null grade false). Choices are unique and
      contain the answer; a wrong diagnosis is never one the content marks as too close; a wrong fix
      never treats (or is marked as arguably helping) the case's failure and IS the fix the slides
      name for another case's failure.
   4. RECOVERY: the diagnosis of every drawn chart is recovered from the chart's data alone (an
      independent reading, below), and every follow-up answer is re-derived from the item's data.

   Run:  node tools/dl-arcade/check-overfit-clinic.mjs        (exit 1 on any failure) */

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const dl = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning');
const arcade = path.join(dl, 'arcade');
const imp = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const M = await imp('maths/overfitClinic.js');
const C = await imp('content/overfit-clinic.js');
const L2 = await imp('content/lecture2.js');
const L4 = await imp('content/lecture4.js');
const { rng } = await imp('core/rng.js');
const { CONCEPTS } = await imp('core/concepts.js');
const { grade } = await imp('kit/grade.js');
const P = await imp('maths/params.js');
const { causalMask } = await import(pathToFileURL(path.join(dl, 'lecture8-study', 'attn.js')).href);
const katex = (await import(pathToFileURL(path.join(root, 'node_modules', 'katex', 'dist', 'katex.mjs')).href)).default;

const failures = [];
let passed = 0;
const fail = (msg) => failures.push(msg);
function expect(name, ok, detail = '') {
  if (ok) passed++;
  else fail(`${name}${detail !== '' ? `: ${detail}` : ''}`);
}
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const mathIn = (text) => (String(text ?? '').match(/\$[^$]+\$/g) ?? []).map((m) => m.slice(1, -1));
const texCache = new Map();
function texOk(tex, where) {
  if (!texCache.has(tex)) {
    try {
      katex.renderToString(tex, { throwOnError: true, strict: 'error' });
      texCache.set(tex, null);
    } catch (e) {
      texCache.set(tex, e.message.split('\n')[0]);
    }
  }
  const err = texCache.get(tex);
  expect(`${where}: KaTeX "${tex}"`, !err, err ?? '');
}

/* ── 1. content ─────────────────────────────────────────────────────────── */
const { SLIDE_COUNTS, CASES, DIAGNOSES, FIXES } = C;
const DECKS = { 1: 64, 2: 68, 3: 53, 4: 52, 5: 27, 6: 32, 8: 51 };
expect('SLIDE_COUNTS match the decks', JSON.stringify(SLIDE_COUNTS) === JSON.stringify(DECKS), JSON.stringify(SLIDE_COUNTS));
function srcOk(src, where) {
  const ok = src && DECKS[src.lecture] && Array.isArray(src.slides) && src.slides.length > 0
    && src.slides.every((s) => Number.isInteger(s) && s >= 1 && s <= DECKS[src.lecture]);
  expect(`${where}: src inside its deck`, ok, JSON.stringify(src));
  return ok;
}
Object.entries(DIAGNOSES).forEach(([k, d]) => {
  srcOk(d.src, `DIAGNOSES.${k}`);
  expect(`DIAGNOSES.${k}: concept in catalogue`, !!CONCEPTS[d.concept], d.concept);
  d.avoid.forEach((a) => expect(`DIAGNOSES.${k}.avoid → ${a} exists`, !!DIAGNOSES[a]));
});
Object.entries(FIXES).forEach(([k, f]) => {
  srcOk(f.src, `FIXES.${k}`);
  expect(`FIXES.${k}: concept in catalogue`, !!CONCEPTS[f.concept], f.concept);
  [...f.treats, ...f.avoid].forEach((a) => expect(`FIXES.${k} → ${a} is a diagnosis`, !!DIAGNOSES[a]));
  expect(`FIXES.${k}: treats something`, f.treats.length > 0);
});
// the fixes each case's answer can be (Rx keys + the rx2 follow-up)
const answerFixes = (c) => [...Object.keys(c.rx ?? {}), ...(c.fu?.type === 'rx2' ? [c.fu.fix] : [])];
const caseFixDx = (c) => [...Object.keys(c.rx ?? {}).map((f) => [f, c.dx]), ...(c.fu?.type === 'rx2' ? [[c.fu.fix, c.fu.dx]] : [])];
const FIX_FOR = {}; // fix → the failure modes cases prescribe it for
const ids = new Set();
CASES.forEach((c) => {
  expect(`case ${c.id}: unique id`, !ids.has(c.id));
  ids.add(c.id);
  expect(`case ${c.id}: diagnosis exists`, !!DIAGNOSES[c.dx], c.dx);
  expect(`case ${c.id}: chart generator exists`, M.CHART_TYPES.includes(c.chart), c.chart);
  expect(`case ${c.id}: lecture is a deck`, !!DECKS[c.lecture]);
  srcOk(c.dxSrc, `case ${c.id} Dx`);
  expect(`case ${c.id}: Dx src is this case's lecture`, c.dxSrc.lecture === c.lecture, `${c.dxSrc.lecture} vs ${c.lecture}`);
  if (c.dxConcept) expect(`case ${c.id}: dxConcept in catalogue`, !!CONCEPTS[c.dxConcept], c.dxConcept);
  expect(`case ${c.id}: levels`, c.levels.length && c.levels.every((l) => [1, 2, 3].includes(l)));
  if (c.levels.includes(3)) expect(`case ${c.id}: level 3 needs an Rx and a follow-up`, !!c.rx && !!(c.fu || c.fuBy));
  Object.entries(c.rx ?? {}).forEach(([f, rx]) => {
    expect(`case ${c.id}: Rx ${f} is a fix`, !!FIXES[f]);
    srcOk(rx.src, `case ${c.id} Rx ${f}`);
    expect(`case ${c.id}: FIXES.${f}.treats includes ${c.dx}`, FIXES[f]?.treats.includes(c.dx));
    expect(`case ${c.id}: Rx why`, typeof rx.why === 'string' && rx.why.length > 20);
  });
  caseFixDx(c).forEach(([f, d]) => (FIX_FOR[f] ??= new Set()).add(d));
  (c.fuRx ?? []).forEach((f) => expect(`case ${c.id}: fuRx ${f} is one of its Rx`, !!c.rx?.[f]));
  const fus = c.fuBy ? Object.entries(c.fuBy) : c.fu ? [['', c.fu]] : [];
  if (c.fuBy) Object.keys(c.fuBy).forEach((f) => expect(`case ${c.id}: fuBy.${f} matches an Rx`, !!c.rx?.[f]));
  fus.forEach(([k, fu]) => {
    srcOk(fu.src, `case ${c.id} FU${k}`);
    expect(`case ${c.id} FU${k}: concept in catalogue`, !!CONCEPTS[fu.concept], fu.concept);
    if (fu.type === 'pick') expect(`case ${c.id} FU${k}: answer among its choices`, fu.choices.some((o) => o.key === fu.answer));
    if (fu.type === 'rx2') {
      expect(`case ${c.id}: rx2 fix treats ${fu.dx}`, FIXES[fu.fix]?.treats.includes(fu.dx));
      expect(`case ${c.id}: rx2 diagnosis exists`, !!DIAGNOSES[fu.dx]);
    }
  });
});
Object.keys(FIXES).forEach((f) => expect(`FIXES.${f} is the slides' answer for at least one case`, CASES.some((c) => answerFixes(c).includes(f))));

// manifest concepts (index.js imports a .jsx glyph, so read its text)
const manifestText = fs.readFileSync(path.join(arcade, 'games', 'overfit-clinic', 'index.js'), 'utf8');
const manifestConcepts = new Set((manifestText.match(/concepts:\s*\[([\s\S]*?)\]/)?.[1] ?? '').match(/'[^']+'/g)?.map((s) => s.slice(1, -1)) ?? []);
manifestConcepts.forEach((k) => expect(`manifest concept ${k} in catalogue`, !!CONCEPTS[k]));
expect('manifest keeps the art and id', /art: 'cab-overfit-clinic\.png'/.test(manifestText) && /id: 'overfit-clinic'/.test(manifestText));
expect('manifest lectures', /lectures: \[1, 2, 3, 4, 5, 6, 8\]/.test(manifestText));

/* ── 2. fidelity ────────────────────────────────────────────────────────── */
const A4 = Object.fromEntries(L4.ANCHORS.map((a) => [a.id, a.value]));
const A2 = Object.fromEntries(L2.ANCHORS.map((a) => [a.id, a.value]));
{
  const s = M.makeChart(rng(1), 'rnn1Summary');
  expect('slide 25: SimpleRNN(1) has 3 params (1·1 + 1·1 + 1)', s.params === 3 && 1 * 1 + 1 * 1 + 1 === 3 && A4['l4.simpleRnn1.3'] === 3, s.params);
  expect('slide 25: the summary prints 3 three times', s.lines.filter((l) => /\b3\b/.test(l.text)).length === 3);
  const mb = M.makeChart(rng(1), 'maeBars');
  expect('slides 26 / 29: MAE bars are the printed 27,703 and 29,672', mb.bars[0].value === 27703 && mb.bars[1].value === 29672 && A4['l4.mae.univar'] === 27703 && A4['l4.mae.deep'] === 29672);
  const fl = M.makeChart(rng(1), 'fewLabels');
  const txt = fl.lines.map((l) => l.text).join(' ');
  expect('slide 31: 200 labelled images and 91.85 % in the case notes', /\b200\b/.test(txt) && txt.includes(String(A2['l2.transfer.accBefore'])), txt);
  // slide 34 by hand: c → c, 5 × 5 vs two 3 × 3
  for (const c of [64, 128]) {
    const one = 5 * 5 * c * c + c;
    const two = 2 * (3 * 3 * c * c + c);
    expect(`slide 34: Conv2D params by hand (c = ${c})`, P.conv2dParams(5, c, c) === one && P.conv2dParams(3, c, c) * 2 === two, `${one} / ${two}`);
    expect(`slide 34: two 3 × 3 layers use fewer parameters than one 5 × 5 (c = ${c})`, two < one);
  }
  // slide 29: clipvalue=1.0 clips each component to [−1, 1]
  const clip = (g) => g.map((v) => Math.max(-1, Math.min(1, v)));
  expect('slide 29: clipvalue=1.0 on [0.9, −3.2] → [0.9, −1.0]', JSON.stringify(clip([0.9, -3.2])) === JSON.stringify([0.9, -1]));
  // slides 38 / 41: s by hand
  const adagrad = (gs) => gs.reduce((s, g) => s + g * g, 0);
  const rms = (gs, rho = 0.9) => gs.reduce((s, g) => rho * s + (1 - rho) * g * g, 0);
  expect('slide 38: AdaGrad s after 3, 4 = 25', adagrad([3, 4]) === 25);
  expect('slide 41: RMSProp s after 3, 4 (ρ = 0.9) = 2.41', near(rms([3, 4]), 2.41, 1e-9), rms([3, 4]));
  // slide 31 (L8): causal mask
  const cm = causalMask(5);
  expect('slide 31: the causal mask lets word i see words 0 … i only', cm.every((row, i) => row.every((ok, j) => ok === (j <= i))));
  // the AdaGrad chart's step really comes from slide 38's update
  const ad = M.makeChart(rng(3), 'adagrad');
  expect('slide 38: the step-size panel starts at 1 (first step = η·g/√(g² + ε) ≈ η)', near(ad.panels[1].series[0].values[0], 1, 1e-3));
}
// slide phrases the game quotes, against the PDF text (skipped if pdftotext is missing)
{
  const pdfs = {
    1: 'cits5017-lect01-IntroToANNs.pdf', 2: 'cits5017-lect02-Training-DNNs.pdf', 3: 'cits5017-lect03-CNNs.pdf',
    4: 'cits5017-lect04-Processing-sequences.pdf', 5: 'cits5017-lect05-AE-dimension-reduction.pdf',
    6: 'cits5017-lect06-07-AE-conv-var-GAN.pdf', 8: 'cits5017-lect08-Transformers.pdf',
  };
  const QUOTES = [
    [1, 60, 'the optimal learning rate is about half of the maximum learning rate'],
    [1, 60, 'the optimal learning rate is about 10 times lower than the learning rate there'],
    [1, 61, 'large batch sizes often lead to training instabilities, especially at the beginning of training'],
    [1, 61, 'Learning rate warmup has been suggested to use with large batch sizes'],
    [1, 52, 'interrupt training when no progress is observed on the validation set for a number of epochs'],
    [2, 5, 'leaves the lower layers\' connection weights virtually unchanged'],
    [2, 10, 'they stop outputting anything other than 0'],
    [2, 29, 'clip every component of the gradient vector to a value between -1.0 and 1.0'],
    [2, 40, 'it often stops too early when training neural networks'],
    [2, 41, 'The problem of slowing down too fast in AdaGrad is overcome in RMSProp'],
    [2, 48, 'if you set it too low, training will eventually converge to the optimum, but it will take a very long time'],
    [2, 64, 'a model may be overfitting the training set and yet have similar training and validation losses'],
    [3, 34, 'A common mistake is to use convolution kernels that are too large'],
    [3, 40, 'As it helps reduce overfitting, it is considered as a regularization technique'],
    [4, 26, 'There\'s no way it can predict values between 1.0 and 1.4'],
    [4, 29, 'It looks like this RNN is a bit too large for our task'],
    [4, 40, 'using a smaller learning rate or a saturating activation function like the hyperbolic tangent'],
    [4, 41, 'Layer normalization1 has been reported to be better for RNNs'],
    [4, 42, 'After a while, the RNN\'s state contains virtually no trace of the first inputs'],
    [5, 10, 'one must be careful not to make the autoencoder too powerful'],
    [6, 27, 'only producing images in a specific class'],
    [6, 27, 'their parameters may end up oscillating and becoming unstable'],
    [6, 28, 'guidelines for building stable convolutional GANs'],
    [8, 31, 'when it processes a word, it doesn\'t attend to words located after it'],
    [8, 38, 'scales down the similarity scores to avoid saturating the softmax function, which would lead to tiny gradients'],
    [8, 19, 'especially for long sentences'],
    [8, 20, 'computes a weighted sum of all the encoder outputs'],
    [8, 7, 'typically by concatenating them'],
  ];
  const norm = (s) => s.replace(/[‘’]/g, '\'').replace(/[‐-―−]/g, '-').replace(/\s+/g, ' ').trim();
  let have = true;
  const cache = {};
  for (const [lec, slide, q] of QUOTES) {
    const key = `${lec}:${slide}`;
    if (!(key in cache)) {
      try {
        cache[key] = norm(execFileSync('pdftotext', ['-f', String(slide), '-l', String(slide), path.join(root, 'Documents', 'cits5017', 'lectures', pdfs[lec]), '-'], { encoding: 'utf8' }));
      } catch {
        have = false;
        break;
      }
    }
    expect(`PDF L${lec} slide ${slide} says "${q.slice(0, 50)}…"`, cache[key].includes(norm(q)), cache[key].slice(0, 120));
  }
  if (!have) console.log('  (pdftotext not found: the slide-phrase checks were skipped)');
}

/* ── 3 + 4. rounds ──────────────────────────────────────────────────────── */
const LOSS = ['overfit', 'lrHigh', 'lrLow', 'bigBatch', 'adagrad'];
const firstQ = (a) => a.slice(0, Math.floor(a.length / 4));
const maxJump = (a) => Math.max(0, ...a.slice(1).map((v, i) => Math.abs(v - a[i])));
const amp = (a) => (Math.max(...a) - Math.min(...a)) / 2;
/** an independent reading of a loss chart: every failure its data shows */
function readLoss(chart) {
  const out = [];
  const panels = chart.kind === 'panels' ? chart.panels : [chart];
  const loss = panels[0].series.find((s) => s.key === 'train').values;
  const valid = panels[0].series.find((s) => s.key === 'valid')?.values;
  const n = loss.length;
  const q = Math.floor(n / 4);
  if (valid) {
    const b = valid.indexOf(Math.min(...valid));
    if (b < n - 5 && valid[n - 1] - valid[b] >= 0.15 && loss[n - 1] < loss[b] && loss.every((v, i) => i === 0 || v <= loss[i - 1])) out.push('overfit');
  }
  if (loss[n - 1] > 2 * loss[0]) out.push('lrHigh');
  const d1 = loss[0] - loss[q];
  const d4 = loss[n - 1 - q] - loss[n - 1];
  if (!valid && d1 > 0 && d4 >= 0.5 * d1 && loss[n - 1] >= 0.6 * loss[0] && loss[n - 1] < loss[0]) out.push('lrLow');
  if (maxJump(firstQ(loss)) >= 0.3 * loss[0] && maxJump(loss.slice(n / 2)) <= 0.05 * loss[0]) out.push('bigBatch');
  if (chart.kind === 'panels') {
    const step = panels[1].series[0].values;
    const opt = panels[0].guides[0].y;
    const third = Math.floor((2 * n) / 3);
    if (step[n - 1] / step[0] < 0.02 && Math.abs(loss[third] - loss[n - 1]) < 0.02 * loss[0] && loss[n - 1] - opt >= 0.25 * loss[0]) out.push('adagrad');
  }
  return out;
}
/** read the failure off any chart; returns the diagnosis (or why not) */
function recover(item) {
  const ch = item.chart;
  const t = ch.type;
  const vals = (k) => ch.series.find((s) => s.key === k).values;
  switch (item.dx) {
    case 'overfit': case 'lrHigh': case 'lrLow': case 'bigBatch': case 'adagrad': {
      const r = readLoss(ch);
      return r.length === 1 && r[0] === item.dx ? item.dx : `loss chart reads as [${r}]`;
    }
    case 'tanhRange': {
      const tr = vals('truth');
      const pr = vals('pred');
      return Math.max(...tr) >= 1.3 && pr.every((v) => Math.abs(v) < 1) ? 'tanhRange' : 'predictions not capped below 1 / series not above 1.3';
    }
    case 'rnnExplode': {
      const v = vals('size');
      const ups = v.slice(1).filter((x, i) => x > v[i]).length;
      return v[v.length - 1] / v[0] >= 300 && ups >= 0.7 * (v.length - 1) ? 'rnnExplode' : `growth ${v[v.length - 1] / v[0]}`;
    }
    case 'ganUnstable': {
      const g = vals('g');
      let z = 0;
      for (let i = 1; i < g.length; i++) if (Math.sign(g[i]) !== Math.sign(g[i - 1])) z++;
      const third = g.length / 3;
      return z >= 6 && amp(g.slice(2 * third)) >= 0.9 * amp(g.slice(0, third)) ? 'ganUnstable' : `crossings ${z}`;
    }
    case 'vanishing': case 'exploding': {
      const v = ch.bars.map((b) => b.value);
      const r = v[0] / v[v.length - 1];
      if (r <= 1e-2) return 'vanishing';
      if (r >= 1e2) return 'exploding';
      return `layer-1 / top ratio ${r}`;
    }
    case 'deadRelu': {
      const dead = ch.bars.filter((b) => b.value === 0).length;
      return dead >= 0.35 * ch.bars.length ? 'deadRelu' : `${dead} dead`;
    }
    case 'shortMemory': {
      const v = ch.bars.map((b) => b.value);
      return v[0] <= 0.01 * v[v.length - 1] && v.every((x, i) => i === 0 || x >= v[i - 1]) ? 'shortMemory' : 'trace not fading';
    }
    case 'tooBig': {
      const [shallow, deep] = ch.bars.map((b) => b.value);
      return deep > shallow ? 'tooBig' : 'deep not worse';
    }
    case 'aeCopy': {
      const [tr, fresh] = ch.bars.map((b) => b.value);
      return tr <= 0.05 * fresh && ch.facts.coding === 1 ? 'aeCopy' : 'reconstructions not copied';
    }
    case 'modeCollapse': {
      const v = ch.bars.map((b) => b.value);
      return v.reduce((a, b) => a + b, 0) === 100 && Math.max(...v) >= 80 ? 'modeCollapse' : 'no dominant class';
    }
    case 'noMask': {
      const later = ch.values.slice(0, -1).map((r, i) => r.slice(i + 1).reduce((a, b) => a + b, 0));
      const rowsOk = ch.values.every((r) => near(r.reduce((a, b) => a + b, 0), 1, 0.03));
      return rowsOk && later.every((m) => m >= 0.2) ? 'noMask' : `later-word attention ${later}`;
    }
    case 'saturatedSoftmax': {
      const maxes = ch.values.map((r) => Math.max(...r));
      const sc = ch.facts.scaledMaxList;
      return maxes.every((m) => m >= 0.95) && sc.every((s, i) => s < maxes[i]) ? 'saturatedSoftmax' : `row maxes ${maxes}`;
    }
    case 'causalEncoder': {
      const same = ch.values.every((r) => JSON.stringify(r) === JSON.stringify(ch.values[0]));
      return same && ch.rows.length === 3 && ch.rows.every((p) => p.startsWith('the right')) ? 'causalEncoder' : 'encodings differ';
    }
    case 'finalState': {
      const encAfter = ch.src.length - 1 - ch.from;
      const p = encAfter + 1 + ch.to;
      return t === 'encdec' && p === ch.facts.path && p >= 4 && ch.src[ch.from] === 'soccer' && ch.dout[ch.to] === 'fútbol' ? 'finalState' : `path ${p}`;
    }
    case 'tinyMemory': return ch.params === 3 && ch.units === 1 ? 'tinyMemory' : `params ${ch.params}`;
    case 'bigKernel': {
      const convs = ch.lines.filter((l) => l.conv);
      const first = convs[0];
      const bad = convs.slice(1).find((l) => l.conv.k >= 5);
      const ok = bad && bad.conv.cin === bad.conv.filters && first.conv.k >= 5 && first.conv.strides >= 2
        && 2 * P.conv2dParams(3, bad.conv.cin, bad.conv.filters) < P.conv2dParams(5, bad.conv.cin, bad.conv.filters)
        && convs.every((l) => l.params === P.conv2dParams(l.conv.k, l.conv.cin, l.conv.filters));
      return ok ? 'bigKernel' : 'no inner 5 × 5 layer';
    }
    case 'fewLabels': return ch.labelled <= 1000 && ch.similarModel ? 'fewLabels' : 'enough labels';
    default: return `no reader for ${item.dx}`;
  }
}

function checkFollowUp(it, where) {
  const f = it.chart.facts;
  switch (it.fuType) {
    case 'stopEpoch': {
      const v = it.chart.series.find((s) => s.key === 'valid').values;
      const best = v.indexOf(Math.min(...v)) + 1;
      const stop = best + 10;
      expect(`${where}: stop epoch = best (${best}) + patience 10, inside the run`, it.answer === `e${stop}` && stop <= it.chart.x.to, `${it.answer} / ${stop} / ${it.chart.x.to}`);
      break;
    }
    case 'sweep': {
      const s = it.chart2.series[0];
      const L = s.values;
      const b = L.indexOf(Math.min(...L));
      const k = L.findIndex((v, i) => i > b && v > 1.25 * L[b]);
      const upHat = s.xs[k];
      const up = it.chart2.facts.upValue;
      expect(`${where}: the sweep shoots up at η ≈ ${up} (read ${upHat})`, k > 0 && Math.abs(Math.log10(upHat) - Math.log10(up)) <= 0.2, upHat);
      const ans = it.choices.find((c) => c.value === it.answer).label;
      expect(`${where}: answer is 10× lower (${up / 10})`, ans.endsWith(`= ${M.fmtRate(up / 10)}`), ans);
      break;
    }
    case 'clip': {
      const { g, clipped } = it.clip;
      expect(`${where}: clipvalue answer by hand`, JSON.stringify(g.map((v) => Math.max(-1, Math.min(1, v)))) === JSON.stringify(clipped) && g.some((v) => Math.abs(v) > 1) && g.some((v) => Math.abs(v) < 1));
      expect(`${where}: clip choices distinct`, new Set(it.choices.map((c) => c.label)).size === it.choices.length);
      break;
    }
    case 'adagradS': {
      const { g1, g2, s, r } = it.adagradS;
      const rms = 0.9 * (0.1 * g1 * g1) + 0.1 * g2 * g2;
      expect(`${where}: s = g1² + g2²`, s === g1 * g1 + g2 * g2 && it.choices.find((c) => c.value === it.answer).label === String(s));
      expect(`${where}: RMSProp value by hand`, near(r, Number(rms.toFixed(2)), 1e-9), `${r} vs ${rms}`);
      expect(`${where}: AdaGrad choices distinct`, new Set(it.choices.map((c) => c.label)).size === it.choices.length);
      break;
    }
    case 'maskSet': {
      const qi = f.qi;
      const want = Array.from({ length: qi + 1 }, (_, j) => j);
      expect(`${where}: masked set is words 0 … ${qi}`, JSON.stringify(it.maskSet.allowed) === JSON.stringify(want));
      break;
    }
    case 'shape':
      expect(`${where}: QKᵀ is [n_queries, n_keys]`, JSON.stringify(it.shapes[it.answer]) === JSON.stringify([f.nq, f.nk]) && it.chart.values.length === f.nq && it.chart.values[0].length === f.nk);
      break;
    case 'keepLayer': {
      const first = it.chart.lines.find((l) => l.conv);
      expect(`${where}: the first convolutional layer keeps its kernel`, it.answer === `line${first.n}` && first.conv.k === 5 && first.conv.strides >= 2);
      break;
    }
    case 'order': case 'slots': {
      const fu = C.CASES.find((c) => c.id === it.caseId).fu;
      const want = fu.type === 'slots' ? fu.answer : fu.cards.map((k) => k.id);
      expect(`${where}: answer is the slide's order`, JSON.stringify(it.answer) === JSON.stringify(want));
      expect(`${where}: cards are shuffled`, it.cards.some((k, i) => k.id !== it.answer[i]));
      expect(`${where}: a reversed order grades false`, !grade(it, it.answer.slice().reverse()));
      break;
    }
    case 'rx2':
      expect(`${where}: rx2 offers the other issue's fix (denseOut) as a wrong option`, it.choices.some((c) => c.value === 'denseOut'));
      break;
    default:
  }
}

const caseByFixDx = (fix, dx) => CASES.some((c) => caseFixDx(c).some(([f, d]) => f === fix && d !== dx));
const counts = { 1: 0, 2: 0, 3: 0 };
const seenCases = new Set();
const seenFu = new Set();
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = M.makeItems(rng(seed * 7919 + level), level);
    const where0 = `L${level} seed ${seed}`;
    expect(`${where0}: ${items.length} items`, items.length >= (level === 1 ? 8 : 5));
    const idSet = new Set();
    const caseIds = new Set(items.map((i) => i.caseId));
    const dxs = new Set(items.filter((i) => i.step === 'dx').map((i) => i.dx));
    expect(`${where0}: one patient per failure mode`, dxs.size === items.filter((i) => i.step === 'dx').length);
    expect(`${where0}: SimpleRNN(1) appears at most once`, !(caseIds.has('l4-rnn1') && caseIds.has('l4-rnn1-memory')));
    const hards = items.filter((i) => i.step === 'dx').map((i) => CASES.find((c) => c.id === i.caseId).hard);
    expect(`${where0}: the round ramps (hard never drops)`, hards.every((h, i) => i === 0 || h >= hards[i - 1]), hards.join(','));
    items.forEach((it) => {
      counts[level]++;
      seenCases.add(it.caseId);
      const where = `${where0} ${it.id}`;
      expect(`${where}: unique id`, !idSet.has(it.id));
      idSet.add(it.id);
      expect(`${where}: concept in catalogue`, !!CONCEPTS[it.concept], it.concept);
      expect(`${where}: concept in the manifest`, manifestConcepts.has(it.concept), it.concept);
      srcOk(it.src, where);
      expect(`${where}: why`, typeof it.why === 'string' && it.why.length > 20);
      expect(`${where}: prompt text`, typeof it.promptText === 'string' && it.promptText.length > 5);
      const texts = [it.why, it.prompt, it.complaint, ...(it.choices ?? []).map((c) => c.label), ...(it.chart.drawer ?? []), ...((it.chart2?.drawer) ?? [])];
      texts.forEach((t) => expect(`${where}: no unfilled placeholder in "${String(t).slice(0, 40)}"`, !/%\w+%/.test(String(t))));
      mathIn(it.why).forEach((t) => texOk(t, `${where} why`));
      [...(it.chart.tex ?? []), ...((it.chart2?.tex) ?? [])].forEach((t) => texOk(t, `${where} drawer`));
      (it.chart.drawer ?? []).forEach((t) => mathIn(t).forEach((m) => texOk(m, `${where} drawer line`)));
      // gradable answer
      expect(`${where}: answer is JSON-serialisable`, JSON.stringify(it.answer) !== undefined && JSON.stringify(JSON.parse(JSON.stringify(it.answer))) === JSON.stringify(it.answer));
      expect(`${where}: answer grades true`, grade(it, JSON.parse(JSON.stringify(it.answer))));
      expect(`${where}: null grades false`, !grade(it, null));
      if (it.kind === 'choice') {
        const vals = it.choices.map((c) => c.value);
        expect(`${where}: choices unique, answer among them`, new Set(vals).size === vals.length && vals.includes(it.answer));
        expect(`${where}: labels unique`, new Set(it.choices.map((c) => c.label)).size === vals.length);
        const wrong = vals.find((v) => v !== it.answer);
        expect(`${where}: a wrong choice grades false`, !grade(it, wrong));
      } else {
        expect(`${where}: a mutated answer grades false`, !grade(it, [...it.answer.slice(1), it.answer[0]]));
      }
      // the diagnosis is recovered from the chart's data
      expect(`${where}: diagnosis ${it.dx} recovered from the chart`, recover(it) === it.dx, recover(it));
      if (it.step === 'dx') {
        expect(`${where}: Dx answer is the case's failure`, it.answer === it.dx);
        const bad = M.avoidSet(it.dx);
        it.choices.filter((c) => c.value !== it.answer).forEach((c) => {
          expect(`${where}: wrong Dx ${c.value} exists`, !!DIAGNOSES[c.value]);
          expect(`${where}: wrong Dx ${c.value} is not marked too close to ${it.dx}`, !bad.has(c.value));
        });
      }
      const rxLike = it.step === 'rx' || it.fuType === 'rx2';
      if (rxLike) {
        const dx = it.step === 'rx' ? it.dx : it.fuDx;
        expect(`${where}: Rx answer treats ${dx}`, FIXES[it.answer].treats.includes(dx));
        if (it.step === 'rx' && level === 3) {
          const c = CASES.find((k) => k.id === it.caseId);
          if (c.fuRx) expect(`${where}: level-3 Rx comes from fuRx`, c.fuRx.includes(it.answer));
        }
        it.choices.filter((c) => c.value !== it.answer).forEach((c) => {
          const fx = FIXES[c.value];
          expect(`${where}: wrong fix ${c.value} differs from the answer`, c.value !== it.answer);
          expect(`${where}: wrong fix ${c.value} does not treat ${dx}`, fx && !fx.treats.includes(dx) && !fx.avoid.includes(dx));
          expect(`${where}: wrong fix ${c.value} is the slides' fix for another case`, caseByFixDx(c.value, dx));
        });
      }
      if (it.step === 'fu') {
        seenFu.add(it.fuType);
        checkFollowUp(it, where);
      }
    });
    // every step of a case shares one chart, and the record is written in order
    caseIds.forEach((cid) => {
      const steps = items.filter((i) => i.caseId === cid);
      expect(`${where0} ${cid}: steps in order`, steps.map((s) => s.step).join() === steps[0].steps.join());
      expect(`${where0} ${cid}: one chart across steps`, steps.every((s) => s.chart === steps[0].chart));
      expect(`${where0} ${cid}: Dx written on the card after step 1`, steps.slice(1).every((s) => s.record.dx === DIAGNOSES[steps[0].dx].label));
      if (level === 3) expect(`${where0} ${cid}: three steps at level 3`, steps.length === 3);
    });
  }
}
// every case and every follow-up type is reachable in the seeded rounds
CASES.forEach((c) => expect(`case ${c.id} appears in some seeded round`, seenCases.has(c.id)));
['stopEpoch', 'sweep', 'clip', 'adagradS', 'order', 'slots', 'keepLayer', 'rx2', 'maskSet', 'shape', 'pick'].forEach((t) => expect(`follow-up ${t} appears`, seenFu.has(t)));
// and every chart type's diagnosis is recoverable on 40 more seeds each
for (const c of CASES) {
  for (let s = 1; s <= 40; s++) {
    const chart = M.makeChart(rng(s * 104729 + c.id.length), c.chart, c.dx);
    const r = recover({ chart, dx: c.dx });
    expect(`case ${c.id} seed ${s}: diagnosis recovered`, r === c.dx, r);
    if (c.chart === 'overfit') expect(`case ${c.id} seed ${s}: early stopping fits in the run`, chart.facts.stop <= chart.x.to);
  }
}

console.log(`Overfit Clinic: ${passed} passed, ${failures.length} failed (items per level over 30 seeds: ${counts[1]} / ${counts[2]} / ${counts[3]})`);
if (failures.length) {
  failures.slice(0, 60).forEach((f) => console.log(`  ✗ ${f}`));
  if (failures.length > 60) console.log(`  … and ${failures.length - 60} more`);
  process.exit(1);
}
