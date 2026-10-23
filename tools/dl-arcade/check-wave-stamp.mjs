/* Wave Stamp — fidelity check (node tools/dl-arcade/check-wave-stamp.mjs)
   1. P values worked by hand from Lecture 8 slide 32's formula
        P(p,i) = sin(p / 1000^(i/d))       if i is even
        P(p,i) = cos(p / 1000^((i−1)/d))   if i is odd
      and from slide 35's code (base 10_000, i = 2 * np.arange(embed_size // 2)),
      against lecture8-study/attn.js posEncoding ('slide' = 1000, 'code' = 10_000).
   2. The sine/cosine parity rule and the code's index trick.
   3. Slide 46: 16 × 16 × 3 = 768 (vitPatches).
   4. 30 seeded rounds per level: every item has an id, a concept in the
      catalogue, a src, a why and a gradable answer (its own answer grades
      true, a wrong one false), and no item drills slides 47–48. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DL = path.resolve(HERE, '../../src/components/portal/modules/deep-learning');
const imp = (p) => import(pathToFileURL(path.join(DL, p)).href);

const { posEncoding, vitPatches } = await imp('lecture8-study/attn.js');
const { makeItems, peValue, peAngle, expIndex, tidy } = await imp('arcade/maths/waveStamp.js');
const { rng } = await imp('arcade/core/rng.js');
const { CONCEPT_IDS } = await imp('arcade/core/concepts.js');
const { grade } = await imp('arcade/kit/grade.js');

let n = 0;
const ok = (c, m) => { n++; assert.ok(c, m); };
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

/* ── 1. by hand from slide 32 (base 1000) ──────────────────────────────── */
// slide 32, p = 0: every angle is 0 → P(0, even) = sin 0 = 0, P(0, odd) = cos 0 = 1
ok(posEncoding(1, 8, 'slide')[0].every((v, i) => v === (i % 2 ? 1 : 0)), 'slide 32: P(0, ·) = 0, 1, 0, 1, …');
// slide 32, p = 2, i = 0, d = 8: 1000^(0/8) = 1 → sin(2) = 0.9093
ok(near(peValue(2, 0, 8, 'slide'), 0.9092974268, 1e-9), 'slide 32: P(2, 0) = sin 2');
// slide 32, p = 2, i = 1, d = 8: odd → (1 − 1)/8 = 0 → cos(2) = −0.4161
ok(near(peValue(2, 1, 8, 'slide'), -0.4161468365, 1e-9), 'slide 32: P(2, 1) = cos 2');
// slide 32, p = 30, i = 2, d = 6: 1000^(2/6) = 1000^(1/3) = 10 → sin(30 / 10) = sin 3 = 0.1411
ok(near(peValue(30, 2, 6, 'slide'), Math.sin(3), 1e-9) && near(peAngle(30, 2, 6, 'slide'), 3, 1e-9), 'slide 32: P(30, 2), d = 6 → sin 3');
// slide 32, p = 30, i = 3, d = 6: odd → exponent (3 − 1)/6 = 1/3 → 1000^(1/3) = 10 → cos(3) = −0.98999
ok(near(peValue(30, 3, 6, 'slide'), Math.cos(3), 1e-9) && near(peAngle(30, 3, 6, 'slide'), 3, 1e-9), 'slide 32: P(30, 3), d = 6 → cos 3 (not 30 / 1000^(3/6))');
// slide 32, p = 50, i = 8, d = 12: 1000^(8/12) = 1000^(2/3) = 100 → sin(0.5) = 0.4794
ok(near(peValue(50, 8, 12, 'slide'), Math.sin(0.5), 1e-9), 'slide 32: P(50, 8), d = 12 → sin 0.5');

/* ── 1b. the same (p, i, d) under slide 35's code (base 10_000) ────────── */
// slide 35, p = 50, column 4, embed_size = 8: i = 4 → 10_000^(4/8) = 100 → sin(0.5); slide 32 gives 50 / 1000^(1/2) = 1.5811 → sin = 0.99996
ok(near(peValue(50, 4, 8, 'code'), Math.sin(0.5), 1e-9), 'slide 35: pos_emb[0, 50, 4] = sin(50 / 100)');
ok(near(peValue(50, 4, 8, 'slide'), Math.sin(50 / Math.sqrt(1000)), 1e-9), 'slide 32: P(50, 4), d = 8 = sin(50 / 31.62)');
ok(peAngle(50, 4, 8, 'slide') > peAngle(50, 4, 8, 'code'), 'base 1000 divides by less than base 10_000 (i ≥ 2)');
// slide 35, p = 250, column 7, embed_size = 8: odd column → i = 6 → 10_000^(6/8) = 1000 → cos(0.25) = 0.9689
ok(near(peValue(250, 7, 8, 'code'), Math.cos(0.25), 1e-9) && near(tidy(peAngle(250, 7, 8, 'code')), 0.25), 'slide 35: pos_emb[0, 250, 7] = cos(250 / 1000)');
// i = 0 and 1: exponent 0 → both bases agree for every p
for (let p = 0; p < 40; p++) for (const i of [0, 1]) ok(peValue(p, i, 8, 'slide') === peValue(p, i, 8, 'code'), `bases agree at i = ${i}, p = ${p}`);
ok(!near(peValue(20, 2, 8, 'slide'), peValue(20, 2, 8, 'code'), 0.05), 'bases differ from i = 2 on');

/* ── 2. parity + the code's index trick (slide 35 written out) ─────────── */
const codePE = (maxLen, E) => {
  // p, i = np.meshgrid(np.arange(max_length), 2 * np.arange(embed_size // 2))
  // pos_emb[0, :, ::2] = sin(p / 10_000 ** (i / embed_size)); pos_emb[0, :, 1::2] = cos(...)
  const out = Array.from({ length: maxLen }, () => new Array(E).fill(NaN));
  const is = Array.from({ length: E / 2 }, (_, k) => 2 * k);
  for (let p = 0; p < maxLen; p++) is.forEach((i, k) => {
    out[p][2 * k] = Math.sin(p / 10_000 ** (i / E));
    out[p][2 * k + 1] = Math.cos(p / 10_000 ** (i / E));
  });
  return out;
};
for (const E of [4, 8, 16]) {
  const a = codePE(30, E);
  const b = posEncoding(30, E, 'code');
  ok(a.every((r, p) => r.every((v, c) => near(v, b[p][c], 1e-12))), `slide 35 code ≡ posEncoding('code') for embed_size = ${E}`);
}
for (let i = 0; i < 16; i++) {
  ok(expIndex(i) === (i % 2 ? i - 1 : i), `exponent index for i = ${i}`);
  // even i → a sine (P(0, i) = 0), odd i → a cosine (P(0, i) = 1)
  ok(peValue(0, i, 16, 'slide') === (i % 2 ? 1 : 0), `parity at i = ${i}`);
}

/* ── 3. slide 46 ───────────────────────────────────────────────────────── */
ok(vitPatches(16, 16).dim === 768 && 16 * 16 * 3 === 768, 'slide 46: 16 × 16 × 3 = 768');
ok(vitPatches(224, 224).count === 196 && vitPatches(48, 64).count === 12, 'patch counts (page examples)');

/* ── 4. rounds ─────────────────────────────────────────────────────────── */
const LATER = /DeiT|Perceiver|DINO|Flamingo|GATO|distillation|90\.4|84\.8|2 billion|10 images per class|Hugging/i;
const textOf = (it) => [it.question, it.promptText, it.why, ...(it.choices ?? []).map((c) => `${c.label} ${c.plain ?? ''}`), ...(it.order?.steps ?? [])].join(' ');
let total = 0;
let beyond = 0;
let notExamined = 0;
for (const level of [1, 2, 3]) {
  for (let seed = 1; seed <= 30; seed++) {
    const items = makeItems(rng(seed), level);
    ok(items.length >= 8, `level ${level} seed ${seed}: ${items.length} items`);
    ok(new Set(items.map((x) => x.id)).size === items.length, `ids unique L${level} s${seed}`);
    ok(JSON.stringify(makeItems(rng(seed), level).map((x) => x.answer)) === JSON.stringify(items.map((x) => x.answer)), `seeded L${level} s${seed}`);
    for (const it of items) {
      total++;
      ok(it.id && it.concept && it.src && it.why && it.answer !== undefined && it.question, `item fields ${it.id}`);
      ok(CONCEPT_IDS.includes(it.concept), `concept ${it.concept} in catalogue`);
      ok(it.src.lecture === 8 && it.src.slides.length > 0, `src ${it.id}`);
      ok(JSON.stringify(it.answer) !== undefined && JSON.parse(JSON.stringify(it.answer)) !== undefined, `answer serialisable ${it.id}`);
      ok(grade(it, it.answer), `own answer grades true ${it.id}`);
      ok(grade(it, JSON.parse(JSON.stringify(it.answer))), `round-tripped answer grades true ${it.id}`);
      if (it.kind === 'choice') {
        ok(it.choices.length >= 2 && it.choices.some((c) => c.value === it.answer), `choices ${it.id}`);
        ok(new Set(it.choices.map((c) => String(c.value))).size === it.choices.length, `choice values unique ${it.id}`);
        for (const c of it.choices.filter((x) => x.value !== it.answer)) ok(!grade(it, c.value), `distractor fails ${it.id}`);
      }
      if (it.kind === 'number') {
        ok(!grade(it, it.answer + 1) && !grade(it, it.answer - 0.5), `wrong number fails ${it.id}`);
        ok(!grade(it, ''), `empty fails ${it.id}`);
      }
      if (it.kind === 'shape') ok(!grade(it, it.answer.map((v, k) => (k === 1 ? v + 1 : v))), `wrong shape fails ${it.id}`);
      if (it.order) ok(!grade(it, it.answer.slice().reverse()) && !grade(it, null), `wrong order fails ${it.id}`);
      if (it.beyond) { beyond++; ok(typeof it.note === 'string' && it.note.length > 20, `beyond note ${it.id}`); }

      // every P number on the stage is posEncoding's (rounded to 4 d.p.)
      const st = it.stage;
      if (st?.row && st.p !== null && st.p !== undefined) ok(st.row.every((v, i) => near(v, peValue(st.p, i, st.d, st.variant), 1e-4)), `stage row ${it.id}`);
      if (st?.type === 'twin') {
        for (const side of [st.A, st.B]) ok(side.rack.every((r, p) => r.every((v, i) => near(v, peValue(p, i, st.d, side.variant), 1e-4))), `twin rack ${it.id}`);
        ok(st.A.variant !== st.B.variant, `twin racks differ ${it.id}`);
        const codeSide = st.A.variant === 'code' ? 'A' : 'B';
        ok(it.promptText.includes('10_000') ? it.answer === codeSide : it.answer !== codeSide, `twin answer ${it.id}`);
      }
      if (st?.type === 'pair' && st.target !== null) ok(near(st.slide[st.target], peValue(st.p, st.target, st.d, 'slide'), 1e-4) && near(st.code[st.target], peValue(st.p, st.target, st.d, 'code'), 1e-4), `pair stamps ${it.id}`);

      // generated P answers recomputed by hand
      if (it.id.startsWith('angle')) {
        const [, p, i, d] = it.promptText.match(/P\((\d+), (\d+)\), d = (\d+)/).map(Number);
        const byHand = p / 1000 ** ((i % 2 ? i - 1 : i) / d);
        ok(near(it.answer, byHand, 1e-6), `angle by hand ${it.id}`);
        const fn = i % 2 ? Math.cos : Math.sin;
        ok(near(fn(it.answer), peValue(p, i, d, 'slide'), 1e-6), `fn(angle) = posEncoding ${it.id}`);
        ok(Number.isInteger(Math.round(it.answer * 1000)) && near(it.answer * 1000, Math.round(it.answer * 1000), 1e-6), `clean angle ${it.id}`);
      }
      if (it.id.startsWith('code-angle')) {
        const [, p, c] = it.promptText.match(/position (\d+), column (\d+)/).map(Number);
        const i = c % 2 ? c - 1 : c; // the code's i for this column
        ok(near(it.answer, p / 10_000 ** (i / 8), 1e-6), `code angle by hand ${it.id}`);
        ok(near((c % 2 ? Math.cos : Math.sin)(it.answer), codePE(p + 1, 8)[p][c], 1e-6), `code angle vs slide-35 code ${it.id}`);
      }
      if (it.id.startsWith('pair')) {
        const [, p, i] = it.promptText.match(/P\((\d+), (\d+)\)/).map(Number);
        ok(near(it.answer, (i ? Math.cos : Math.sin)(p), 0.006), `first pair by hand ${it.id}`);
      }
      if (it.id.startsWith('p0')) ok(it.answer === (Number(it.promptText.match(/i = (\d+)/)[1]) % 2 ? 1 : 0), `P(0, i) parity ${it.id}`);
      if (it.id.startsWith('parity')) {
        const i = Number(it.promptText.match(/P\(p, (\d+)\)/)[1]);
        const right = it.choices.find((c) => c.value === it.answer).plain;
        ok(right.startsWith(i % 2 ? 'cos' : 'sin') && right.includes(`1000^(${i % 2 ? i - 1 : i}/`), `parity answer ${it.id}`);
      }
      if (it.id.startsWith('match')) ok(it.choices.length === 4 && it.answer === st.p && st.candidates.includes(st.p), `match candidates ${it.id}`);
      if (it.id.startsWith('vit-768') || it.id.startsWith('vit-linear')) ok(it.answer === 768, `768 ${it.id}`);
      if (it.id.startsWith('vit-count')) {
        ok(it.beyond === true && it.answer === (st.H / 16) * (st.W / 16), `patch count ${it.id}`);
      }

      // the ViT picture never shows the answer: the full pipeline is hidden on the pipeline questions
      if (it.order || /^ws.l3.(linear|sequence|chop|channels)/.test(it.id)) ok(st.focus === 'chop', `no pipeline giveaway ${it.id}`);
      // the visual-attention items (slides 44–45) never show the ViT patch grid; the captioner stays hidden on its own question
      if (/^ws.l3.(caption|frisbee)/.test(it.id)) ok(st.type === 'caption' && (st.focus === 'decoder') === it.id.startsWith('ws.l3.caption'), `caption stage ${it.id}`);

      // nothing from slides 47–48 is drilled: only the one exam-status item cites 47, none cites 48
      ok(!it.src.slides.includes(48), `no slide 48 ${it.id}`);
      if (it.src.slides.some((s) => s >= 47)) {
        notExamined++;
        ok(it.notExamined === true && it.concept === 'vit.variants' && it.src.slides.length === 1, `slide 47 only as the exam-status item ${it.id}`);
      }
      ok(!LATER.test(textOf(it)), `no slide 47–48 content in ${it.id}`);
    }
    if (level === 3) ok(items.filter((x) => x.notExamined).length === 1, `one not-examined item L3 s${seed}`);
    else ok(items.every((x) => !x.notExamined), `no not-examined item L${level} s${seed}`);
  }
}
ok(beyond > 0 && notExamined === 30, `beyond ${beyond}, not-examined ${notExamined}`);
console.log(`check-wave-stamp: ${n} assertions passed · ${total} items across 90 rounds · ${beyond} beyond (page’s own image sizes)`);
