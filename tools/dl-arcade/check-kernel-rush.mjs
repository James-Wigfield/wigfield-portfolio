#!/usr/bin/env node
/* check-kernel-rush.mjs — Kernel Rush fidelity + item check (Lecture 3).

   1. Window counting by brute force (an implementation independent of
      maths/shapes.js): every Conv2D / MaxPool2D / AvgPool2D config in
      tools/dl-arcade/keras-truth.json (real Keras) must be reproduced by it,
      so it is a trustworthy second opinion for step 3.
   2. The slides' printed shapes and counts, run through the game's spec
      builder (buildDrop): slides 8, 9, 15/16, 17–23, 26, 28–29, 31, 37, 39, 42.
   3. 30 seeded rounds per level: every item has a unique id, a concept in
      the catalogue (and in the manifest), a Lecture-3 src with real slide
      numbers, a filled-in why with balanced $…$, a JSON-serialisable answer of
      the right shape that grades true (and false when mutated or skipped);
      answers agree with the brute-force counter and the slide equations;
      generated drops are "clean" (no ⌈n/s⌉ rounding needed, so the why can
      use the slides' examples), and nothing is marked beyond.

   Run: node tools/dl-arcade/check-kernel-rush.mjs   (exit 1 on any failure) */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const arcade = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade');
const imp = (rel) => import(pathToFileURL(path.join(arcade, rel)).href);

const KR = await imp('maths/kernelRush.js');
const { conv2dParams } = await imp('maths/params.js');
const { rng } = await imp('core/rng.js');
const { CONCEPT_IDS } = await imp('core/concepts.js');
const { grade } = await imp('kit/grade.js');
const { TABLE_STACKS, SLIDE18 } = await imp('content/kernel-rush.js');

const failures = [];
let passed = 0;
const ok = (cond, msg) => { if (cond) passed += 1; else failures.push(msg); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const pair = (v) => (Array.isArray(v) ? v : [v, v]);

// ── 1. brute-force window counting, checked against real Keras ─────────────
/** Output length by listing the window start positions (Keras semantics). */
function bruteLen(n, f, s, padding) {
  if (n == null) return null; // an unknown length stays unknown
  let count = 0;
  if (padding === 'same') for (let p = 0; p < n; p += s) count += 1; // one output per stride step over the input
  else for (let p = 0; p + f <= n; p += s) count += 1; // the window must stay inside
  return count;
}
function bruteShape(spec, input) {
  const [h, w, c] = input;
  if (spec.type === 'GlobalAvgPool2D') return [c];
  const isPool = spec.type !== 'Conv2D';
  const [fh, fw] = pair(isPool ? spec.pool : spec.kernel);
  const [sh, sw] = pair(spec.strides ?? (isPool ? spec.pool : 1));
  const p = spec.padding ?? 'valid';
  return [bruteLen(h, fh, sh, p), bruteLen(w, fw, sw, p), isPool ? c : spec.filters];
}
const truth = JSON.parse(readFileSync(path.join(here, 'keras-truth.json'), 'utf8'));
let nTruth = 0;
for (const cfg of truth.configs) {
  if (!['Conv2D', 'MaxPool2D', 'AvgPool2D', 'GlobalAvgPool2D'].includes(cfg.spec.type)) continue;
  nTruth += 1;
  const got = bruteShape(cfg.spec, cfg.spec.inputShape);
  ok(same(got, cfg.outputShape), `brute force vs Keras: ${JSON.stringify(cfg.spec)} → ${JSON.stringify(got)}, Keras ${JSON.stringify(cfg.outputShape)}`);
}
console.log(`1. brute-force window counter matches ${nTruth} Keras Conv2D / pooling configs (TF ${truth.meta.tensorflow}, Keras ${truth.meta.keras})`);

// ── 2. the slides' printed anchors through the spec builder ────────────────
const conv = (filters, kernel, extra = {}) => ({ type: 'Conv2D', filters, kernel, ...extra });
const anchors = [
  // slides 17–18: images [2, 70, 120, 3]; Conv2D(filters=32, kernel_size=7) → [2, 64, 114, 32]
  { slide: 18, what: 'Conv2D(32, 7) valid on 70 × 120 × 3', got: () => KR.buildDrop(SLIDE18.input, [SLIDE18.spec]).out, want: [64, 114, 32] },
  // slide 20: padding="same" → [2, 70, 120, 32]
  { slide: 20, what: 'Conv2D(32, 7, same) on 70 × 120 × 3', got: () => KR.buildDrop([70, 120, 3], [conv(32, 7, { padding: 'same' })]).out, want: [70, 120, 32] },
  // slide 20, Figure 14-7: kernel 7, stride 1 on 10 inputs: valid has 6 fewer pixels (4); same keeps 10
  { slide: 20, what: 'Figure 14-7 valid: 10 inputs, kernel 7 → 6 fewer', got: () => KR.buildDrop([10, 10, 1], [conv(1, 7)]).out[0], want: 4 },
  { slide: 20, what: 'Figure 14-7 same: 10 inputs → 10', got: () => KR.buildDrop([10, 10, 1], [conv(1, 7, { padding: 'same' })]).out[0], want: 10 },
  // slide 21, Figure 14-8: kernel 7, stride 2 on 10 inputs: valid → 2 (last input ignored); same → 5
  { slide: 21, what: 'Figure 14-8 valid, stride 2: 10 → 2', got: () => KR.buildDrop([10, 10, 1], [conv(1, 7, { strides: 2 })]).out[0], want: 2 },
  { slide: 21, what: 'Figure 14-8 valid: window positions 4, every 2nd kept', got: () => KR.axis(10, 7, 2, 'valid').positions, want: 4 },
  { slide: 21, what: 'Figure 14-8 same, stride 2: 10 → 5', got: () => KR.buildDrop([10, 10, 1], [conv(1, 7, { strides: 2, padding: 'same' })]).out[0], want: 5 },
  // slide 9, Figure 14-4: 5 × 7 input (plus zero padding), 3 × 3 fields, stride 2 → 3 × 4
  { slide: 9, what: 'Figure 14-4: 5 × 7, 3 × 3, stride 2, zero padding → 3 × 4', got: () => KR.buildDrop([5, 7, 1], [conv(1, 3, { strides: 2, padding: 'same' })]).out.slice(0, 2), want: [3, 4] },
  // slide 8: one 3 × 3 filter → 9 weights + 1 bias
  { slide: 8, what: 'one 3 × 3 filter W: 9 + 1 parameters', got: () => KR.buildDrop([28, 28, 1], [conv(1, 3)]).params, want: 10 },
  // slides 16 + 19: kernels (7, 7, 3, 32), biases (32,)
  { slide: 19, what: 'kernels.shape for Conv2D(32, 7) on RGB', got: () => KR.weightShapes(SLIDE18.spec, 3).kernels, want: [7, 7, 3, 32] },
  { slide: 19, what: 'biases.shape', got: () => KR.weightShapes(SLIDE18.spec, 3).biases, want: [32] },
  { slide: 19, what: 'its count from those shapes: 7 × 7 × 3 × 32 + 32', got: () => KR.buildDrop(SLIDE18.input, [SLIDE18.spec]).params, want: 7 * 7 * 3 * 32 + 32 },
  // slide 22: 200 5 × 5 filters, stride 1, "same", on 150 × 100 RGB → (5 × 5 × 3 + 1) × 200 = 15,200
  { slide: 22, what: '(5 × 5 × 3 + 1) × 200', got: () => KR.buildDrop([150, 100, 3], [conv(200, 5, { padding: 'same' })]).params, want: 15200 },
  // slide 23: each of the 200 feature maps contains 150 × 100 neurons
  { slide: 23, what: '200 maps of 150 × 100', got: () => KR.buildDrop([150, 100, 3], [conv(200, 5, { padding: 'same' })]).out, want: [150, 100, 200] },
  // slides 13, 15: n filters → n output channels, whatever the input depth
  { slide: 15, what: 'depth = filters (64 channels in, 16 filters)', got: () => KR.buildDrop([32, 32, 64], [conv(16, 3, { padding: 'same' })]).out[2], want: 16 },
  // slides 26 + 28: 2 × 2 max pool, stride 2 (the default), no padding: halves; slide 29: depth kept
  { slide: 26, what: 'MaxPool2D(pool_size=2) halves 28 × 28 × 64', got: () => KR.buildDrop([28, 28, 64], [{ type: 'MaxPool2D', pool: 2 }]).out, want: [14, 14, 64] },
  { slide: 28, what: 'AvgPool2D(pool_size=2) = strides 2 by default', got: () => same(KR.buildDrop([16, 12, 8], [{ type: 'AvgPool2D', pool: 2 }]).out, KR.buildDrop([16, 12, 8], [{ type: 'AvgPool2D', pool: 2, strides: 2 }]).out), want: true },
  { slide: 25, what: 'pooling has no parameters', got: () => KR.buildDrop([28, 28, 64], [{ type: 'MaxPool2D', pool: 2 }]).params, want: 0 },
  // slide 31: GlobalAvgPool2D on [2, 70, 120, 3] → (2, 3)
  { slide: 31, what: 'GlobalAvgPool2D on 70 × 120 × 3', got: () => KR.buildDrop([70, 120, 3], [{ type: 'GlobalAvgPool2D' }]).out, want: [3] },
  // slide 42: "3 × 3 + 1(S)" max pool keeps the size
  { slide: 42, what: 'MaxPool2D(3, strides=1, same) keeps 28 × 28 × 192', got: () => KR.buildDrop([28, 28, 192], [{ type: 'MaxPool2D', pool: 3, strides: 1, padding: 'same' }]).out, want: [28, 28, 192] },
  // slide 39: AlexNet S8 (3 × 3, stride 2, valid) on 13 × 13 → 6 × 6 (the printed 256 maps are the C7 quirk; spatial only)
  { slide: 39, what: 'AlexNet S8: 13 → 6', got: () => KR.buildDrop([13, 13, 384], [{ type: 'MaxPool2D', pool: 3, strides: 2 }]).out.slice(0, 2), want: [6, 6] },
  // slide 9: rows i·s_h … i·s_h + f_h − 1 equals the i-th window of a brute-force walk (stride 2, 3 × 3)
  { slide: 9, what: 'receptive field of row 1 (3 × 3, stride 2): rows 2 to 4', got: () => { const starts = []; for (let p = 0; p + 3 <= 9; p += 2) starts.push(p); return [starts[1], starts[1] + 3 - 1]; }, want: [1 * 2, 1 * 2 + 3 - 1] },
];
for (const a of anchors) {
  const got = a.got();
  ok(same(got, a.want), `slide ${a.slide}: ${a.what} → ${JSON.stringify(got)}, printed ${JSON.stringify(a.want)}`);
}
// slides 37 and 39: every printed row of the stacks the game uses
for (const t of TABLE_STACKS) {
  const drop = KR.buildDrop(t.input, t.specs);
  drop.rows.forEach((r, i) => ok(same(r.out, t.printed[i]), `${t.id} (slide ${t.src.slides.join(', ')}) layer ${i + 1}: ${JSON.stringify(r.out)} vs printed ${JSON.stringify(t.printed[i])}`));
  drop.rows.forEach((r, i) => ok(same(bruteShape(r.spec, r.in), t.printed[i]), `${t.id} layer ${i + 1}: brute force disagrees with the printed table`));
}
console.log(`2. ${anchors.length} slide anchors + ${TABLE_STACKS.reduce((a, t) => a + t.printed.length, 0)} printed table rows (slides 37, 39) through buildDrop`);

// ── 3. 30 seeded rounds per level ──────────────────────────────────────────
const manifestSrc = readFileSync(path.join(arcade, 'games', 'kernel-rush', 'index.js'), 'utf8');
const manifestConcepts = JSON.parse(manifestSrc.match(/concepts:\s*(\[[^\]]*\])/)[1].replace(/'/g, '"'));
manifestConcepts.forEach((c) => ok(CONCEPT_IDS.includes(c), `manifest concept ${c} not in the catalogue`));
const usedConcepts = new Set();
const EXPECT = { 1: 10, 2: 10, 3: 7 };
let nItems = 0;
let nLayers = 0;
const kinds = {};
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = KR.makeItems(rng(seed * 7919 + level), level);
    const tag = `L${level} seed ${seed}`;
    ok(items.length === EXPECT[level], `${tag}: ${items.length} items, expected ${EXPECT[level]}`);
    ok(new Set(items.map((i) => i.id)).size === items.length, `${tag}: duplicate ids`);
    let sawStride2 = false;
    for (const it of items) {
      nItems += 1;
      const t = `${tag} ${it.id}`;
      kinds[`${it.phase}`] = (kinds[`${it.phase}`] ?? 0) + 1;
      usedConcepts.add(it.concept);
      ok(typeof it.id === 'string' && it.id.length > 0, `${t}: no id`);
      ok(typeof it.drop === 'string', `${t}: no drop`);
      ok(CONCEPT_IDS.includes(it.concept), `${t}: concept ${it.concept} not in the catalogue`);
      ok(manifestConcepts.includes(it.concept), `${t}: concept ${it.concept} not in the manifest`);
      ok(it.src?.lecture === 3 && Array.isArray(it.src.slides) && it.src.slides.length > 0 && it.src.slides.every((s) => Number.isInteger(s) && s >= 1 && s <= 53), `${t}: bad src ${JSON.stringify(it.src)}`);
      ok(typeof it.why === 'string' && it.why.length > 30, `${t}: no why`);
      ok(!/(?<![A-Za-z_^\\])\{\w+\}/.test(it.why), `${t}: unfilled token in why: ${it.why}`); // (TeX's \text{…} is fine)
      ok((it.why.match(/\$/g) ?? []).length % 2 === 0, `${t}: unbalanced $ in why`);
      ok(!/[⌈⌉⌊⌋]|\\lceil|\\lfloor/.test(it.why), `${t}: why uses the general formula`);
      ok(!it.beyond, `${t}: marked beyond`);
      ok(typeof it.promptText === 'string' && typeof it.question === 'string', `${t}: no prompt`);
      ok(same(JSON.parse(JSON.stringify(it.answer)), it.answer), `${t}: answer not JSON-serialisable`);
      ok(grade(it, it.answer) === true, `${t}: own answer does not grade`);
      ok(grade(it, null) === false, `${t}: null grades true`);
      (it.maths ?? []).forEach((m) => ok((m.text && (m.text.match(/\$/g) ?? []).length % 2 === 0) || m.tex, `${t}: bad maths line`));

      if (it.phase === 'shape' || it.phase === 'params') {
        // rebuild the drop from its own specs with the brute-force counter and the slide-22 rule
        const st = it.stage;
        const table = st.title != null;
        ok(Array.isArray(st.specs) && st.specs.length === st.lines.length && st.specs.length >= 1, `${t}: stage has no specs`);
        let shape = st.input;
        let params = 0;
        st.specs.forEach((spec, k) => {
          ok(same(spec.inputShape, shape), `${t}: layer ${k + 1} input ${JSON.stringify(spec.inputShape)} ≠ ${JSON.stringify(shape)}`);
          ok(KR.specLine(spec) === st.lines[k], `${t}: layer ${k + 1} code line`);
          if (!table) ok(KR.isClean(spec, shape), `${t}: ${st.lines[k]} on ${shape.join(' × ')} needs ⌈n/s⌉ rounding (not clean)`);
          if (spec.type === 'Conv2D') params += conv2dParams(spec.kernel, shape[2], spec.filters);
          shape = bruteShape(spec, shape);
          ok(same(shape, st.outs[k]), `${t}: layer ${k + 1} out ${JSON.stringify(st.outs[k])} vs brute force ${JSON.stringify(shape)}`);
        });
        nLayers += st.specs.length;
        if (table) {
          const tb = TABLE_STACKS.find((x) => x.title === st.title);
          ok(tb && same(tb.printed[tb.printed.length - 1], shape), `${t}: table stack vs the printed table`);
        }
        if (it.phase === 'shape') {
          ok(it.kind === 'shape' && Array.isArray(it.answer) && (it.answer.length === 3 || it.answer.length === 1) && it.answer.every((v) => Number.isInteger(v) && v >= 1), `${t}: bad shape answer ${JSON.stringify(it.answer)}`);
          ok(same(it.answer, shape), `${t}: answer ${JSON.stringify(it.answer)} vs brute force ${JSON.stringify(shape)}`);
          ok(grade(it, it.answer.map((v) => v + 1)) === false, `${t}: mutated shape grades true`);
          ok(typeof it.format === 'function' && it.format(it.answer).includes(String(it.answer[0])), `${t}: no format`);
          ok(it.answer.every((v) => it.why.includes(String(v))), `${t}: why does not show the answer ${JSON.stringify(it.answer)}`);
          const stride2 = st.specs.some((sp) => sp.type === 'Conv2D' && sp.strides && sp.strides !== 1);
          if (level === 1) {
            if (stride2) sawStride2 = true;
            else ok(!sawStride2, `${t}: level 1 ramp (stride 1 must come before stride 2)`);
          }
          if (level === 2 && st.specs[0].type === 'Conv2D') ok(st.input[2] >= 16, `${t}: level 2 conv should be multi-channel`);
        } else {
          ok(it.kind === 'number' && Number.isInteger(it.answer) && it.answer >= 0, `${t}: bad params answer`);
          ok(it.answer === params, `${t}: params ${it.answer} vs (f_h × f_w × f_c + 1) × f_n summed = ${params}`);
          ok(grade(it, it.answer + 1) === false, `${t}: mutated count grades true`);
          const f = it.answer.toLocaleString('en-AU');
          ok(it.why.includes(f) || it.why.includes(f.replace(/,/g, '{,}')), `${t}: why does not show ${it.answer}`);
        }
      } else if (it.phase === 'rf') {
        const [first, last] = it.answer;
        const st = it.stage;
        const rows = st.axis === 'rows';
        const [i, j] = st.neuron;
        const [fh, fw] = st.kernel;
        const [sh, sw] = st.strides;
        const idx = rows ? i : j;
        const f = rows ? fh : fw;
        const s = rows ? sh : sw;
        const n = rows ? st.input[0] : st.input[1];
        // brute force: walk the windows along that axis and take the idx-th
        const starts = [];
        for (let p = 0; p + f <= n; p += s) starts.push(p);
        ok(it.kind === 'shape' && it.answer.length === 2 && Number.isInteger(first) && Number.isInteger(last), `${t}: bad rf answer`);
        ok(first === idx * s && last === idx * s + f - 1, `${t}: rf answer ≠ slide 9's i·s_h … i·s_h + f_h − 1`);
        ok(starts[idx] === first && last <= n - 1, `${t}: rf window outside the input (brute force ${starts[idx]})`);
        ok(i < st.out[0] && j < st.out[1] && i >= 1 && j >= 1, `${t}: neuron outside the output grid`);
        ok(same(st.out.slice(0, 2), bruteShape({ type: 'Conv2D', filters: 1, kernel: [fh, fw], strides: [sh, sw] }, st.input).slice(0, 2)), `${t}: rf output grid size`);
        ok(grade(it, [first + 1, last + 1]) === false, `${t}: mutated rf grades true`);
        ok(typeof it.format === 'function' && it.format(it.answer).includes(`${first} to ${last}`), `${t}: rf has no format`);
        ok(it.why.includes(`= ${first}$`) && it.why.includes(`= ${last}$`), `${t}: rf why does not show the answer`);
      } else ok(false, `${t}: unknown phase ${it.phase}`);
    }
    // every drop: a shape (or rf) item first; a bonus follows unless it is a slide-table stack or rf
    const drops = [...new Set(items.map((i) => i.drop))];
    for (const d of drops) {
      const di = items.filter((i) => i.drop === d);
      ok(di[0].phase === 'shape' || di[0].phase === 'rf', `${tag} ${d}: drop does not open with a shape / rf item`);
      const needsBonus = di[0].phase === 'shape' && di[0].stage.title == null;
      ok(needsBonus ? di.length === 2 && di[1].phase === 'params' : di.length === 1, `${tag} ${d}: bonus missing or extra`);
    }
  }
}
manifestConcepts.forEach((c) => ok(usedConcepts.has(c), `manifest concept ${c} never drilled in 90 rounds`));
console.log(`3. ${nItems} items in 90 seeded rounds (${Object.entries(kinds).map(([k, v]) => `${v} ${k}`).join(', ')}); ${nLayers} layers rebuilt by brute force`);

if (failures.length) {
  console.log(`\nFAIL — ${failures.length} problem(s), ${passed} checks passed:`);
  failures.slice(0, 40).forEach((f) => console.log(`  ✗ ${f}`));
  process.exit(1);
}
console.log(`\nPASS — ${passed} checks.`);
