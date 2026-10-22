/* ============================================================================
   DL LECTURE 8 STUDY — checks for the maths, the slide facts and the data
   ----------------------------------------------------------------------------
     node tools/dl-lecture8-study/check-attn.mjs

   Plain node (no browser). Exits 1 on any failure.
     attn.js     softmax rows sum to 1; scaled dot-product attention shapes
                 for slides 37–38's shapes (and its errors); Luong's three
                 scores on known vectors; Bahdanau's one-neuron score; the
                 causal mask; split/concat round trip; the positional-
                 encoding matrix against slide 35's code, written out
                 literally; slide 32's base 1000; 674 and rnn_ed's count;
                 16 × 16 × 3 = 768
     toys        the running example behaves as slide 23 says (α(3,2) is the
                 largest weight at step 3); §11's "fútbol" row peaks on
                 "soccer"
     texText     the print twins of the deck's key formulas
     content     sections cover slides 1–51 exactly once; every [^n] has a
                 footnote; every NAMED_CODE listing appears verbatim in the
                 transcript; diagram parts and sheet highlights agree; the
                 notes budget
     data        busrail.js gates (674, 1,027 windows); toyMT.js present
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const L8 = path.join(ROOT, 'src/components/portal/modules/deep-learning/lecture8-study');
const imp = (rel) => import(`file:///${path.join(L8, rel).replace(/\\/g, '/')}`);

const A = await imp('attn.js');
const T = await imp('toys.js');
const { texText } = await imp('texText.js');
const { SECTIONS } = await imp('sections.js');
const { REFS, NAMED_CODE, PRINTED, ROADMAP, OUTCOMES } = await imp('slideData.js');
const { SHEETS, sheetKeys } = await imp('sheets/index.js');
const { FIG_PARTS } = await imp('sheets/figParts.js');
const BR = await imp('data/busrail.js');

let fails = 0;
let passes = 0;
const ok = (cond, label, detail = '') => {
  if (cond) passes += 1;
  else { fails += 1; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ''}`); }
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;
const eqM = (X, Y, tol = 1e-12) => X.length === Y.length && X.every((r, i) => r.length === Y[i].length && r.every((v, j) => near(v, Y[i][j], tol)));
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

/* ── attn.js ──────────────────────────────────────────────────────────── */
console.log('attn.js');
{
  const R = A.rng(7);
  for (let k = 0; k < 50; k++) {
    const xs = Array.from({ length: 1 + (k % 6) }, () => R.normal() * 10);
    ok(near(A.softmax(xs).reduce((a, b) => a + b, 0), 1, 1e-12), 'softmax sums to 1');
  }
  ok(near(A.softmax([1000, 0])[0], 1, 1e-12), 'softmax is stable for large scores');
  const m = A.softmax([1, null, 2]);
  ok(m[1] === 0 && near(m[0] + m[2], 1), 'masked (null) entries get weight 0');

  // slides 37–38: Q [n_queries, d_keys], K [n_keys, d_keys], V [n_keys, d_values]
  const mk = (r, c) => Array.from({ length: r }, () => Array.from({ length: c }, () => R.normal()));
  for (const [nq, nk, dk, dv] of [[4, 3, 4, 4], [5, 7, 8, 3], [1, 2, 6, 9]]) {
    const out = A.attention(mk(nq, dk), mk(nk, dk), mk(nk, dv));
    ok(out.shapes.scores[0] === nq && out.shapes.scores[1] === nk, `QKᵀ is [n_queries, n_keys] for ${nq},${nk}`);
    ok(out.shapes.out[0] === nq && out.shapes.out[1] === dv, `output is [n_queries, d_values] for ${nq},${dv}`);
    ok(out.weights.every((r) => near(r.reduce((a, b) => a + b, 0), 1, 1e-12)), 'each row of weights adds up to 1');
    ok(near(out.factor, 1 / Math.sqrt(dk)), 'the scale is 1/√d_keys');
    ok(out.weights.every((r, i) => r.every((w, j) => near(w, A.softmax(out.scores[i].map((s) => s / Math.sqrt(dk)))[j], 1e-12))), 'weights = softmax(QKᵀ/√d_keys)');
  }
  ok(throws(() => A.attention(mk(2, 3), mk(2, 4), mk(2, 4))), 'Q and K must share d_keys');
  ok(throws(() => A.attention(mk(2, 4), mk(3, 4), mk(2, 4))), 'K and V must share n_keys');
  const unscaled = A.attention(mk(2, 4), mk(3, 4), mk(3, 2), { scale: false });
  ok(unscaled.factor === 1, 'scale: false leaves the scores alone');

  // Luong's three scores on known vectors (slide 25)
  ok(A.luong.dot([1, 2], [3, 4]) === 11, 'dot: [1,2]·[3,4] = 11');
  ok(A.luong.general([1, 2], [3, 4], [[1, 0], [0, 1]]) === 11, 'general with W = I equals dot');
  ok(A.luong.general([1, 2], [3, 4], [[1, 0], [0, 2]]) === 19, 'general: hᵀ diag(1,2) y = 19');
  ok(A.luong.general([1, 2], [3, 4, 5], [[1, 0, 0], [0, 1, 1]]) === 21, 'general works with a 2 × 3 W');
  ok(near(A.luong.concat([1, 2], [3, 4], [[1, 0, 0, 0], [0, 0, 0, 1]], [1, 1]), Math.tanh(1) + Math.tanh(4)), 'concat: vᵀ tanh(W[h; y])');
  // Bahdanau's one neuron on [h; y] (slide 22)
  ok(A.alignScore([1, 2], [3, 4], [1, 1, 1, 1], 0.5) === 10.5, 'alignment neuron: w·[h; y] + b');
  ok(eqM([A.weightedSum([0.25, 0.75], [[4, 0], [0, 4]])], [[1, 3]]), 'weighted sum Σ α y');

  // the causal mask (slides 31, 41–42)
  const cm = A.causalMask(4);
  ok(cm.every((r, i) => r.every((v, j) => v === (j <= i))), 'causal mask: word i sees words 0…i');
  const masked = A.attention(mk(4, 4), mk(4, 4), mk(4, 4), { mask: cm });
  ok(masked.weights.every((r, i) => r.every((w, j) => (j > i ? w === 0 : true))), 'masked weights are 0 above the diagonal');
  ok(masked.weights.every((r) => near(r.reduce((a, b) => a + b, 0), 1, 1e-12)), 'masked rows still add up to 1');

  // split / concat (slide 39)
  const X = mk(3, 8);
  for (const H of [1, 2, 4, 8]) {
    const parts = A.splitHeads(X, H);
    ok(parts.length === H && parts.every((p) => p[0].length === 8 / H), `split into ${H} heads of ${8 / H}`);
    ok(eqM(A.concatHeads(parts), X), `split → concat round trip, H = ${H}`);
  }
  ok(throws(() => A.splitHeads(X, 3)), 'd must divide evenly into H');

  // positional encodings: slide 35's code, written out literally
  const codePE = (maxLength, embedSize) => {
    const P = Array.from({ length: maxLength }, () => new Array(embedSize).fill(0));
    for (let k = 0; k < embedSize / 2; k++) {
      const i = 2 * k; // i = 2 * np.arange(embed_size // 2)
      for (let p = 0; p < maxLength; p++) {
        P[p][2 * k] = Math.sin(p / 10000 ** (i / embedSize)); // pos_emb[0, :, ::2]
        P[p][2 * k + 1] = Math.cos(p / 10000 ** (i / embedSize)); // pos_emb[0, :, 1::2]
      }
    }
    return P;
  };
  for (const [L, d] of [[50, 16], [200, 512], [7, 2]]) ok(eqM(A.posEncoding(L, d, 'code'), codePE(L, d), 1e-12), `posEncoding('code') = slide 35's code, ${L} × ${d}`);
  const S = A.posEncoding(30, 8, 'slide');
  ok(near(S[5][2], Math.sin(5 / 1000 ** (2 / 8))) && near(S[5][3], Math.cos(5 / 1000 ** ((3 - 1) / 8))), 'slide 32: base 1000, (i−1)/d for odd i');
  ok(A.posEncoding(30, 8, 'code')[0].every((v, i) => near(v, i % 2 === 0 ? 0 : 1)), 'position 0 is [0, 1, 0, 1, …]');
  const rows = A.posEncoding(60, 32, 'code').map((r) => r.map((v) => v.toFixed(6)).join());
  ok(new Set(rows).size === rows.length, 'every position has a unique encoding (slide 33)');

  // parameter counts and ViT
  ok(A.simpleBiRnnParams().total === 674 && A.simpleBiRnnParams().bi === 608 && A.simpleBiRnnParams().out === 66, 'simple_biRNN: 608 + 66 = 674 (slide 9)');
  ok(A.rnnEdParams().total === 1794, 'rnn_ed: 608 + 1,120 + 66 = 1,794');
  const v = A.vitPatches(224, 224);
  ok(v.dim === 768 && 16 * 16 * 3 === 768, '16 × 16 × 3 = 768 (slide 46)');
  ok(v.count === 196, '224 × 224 → 196 patches (page’s own image size)');
}

/* ── the toy numbers tell slide 23's story ───────────────────────────── */
console.log('toys');
{
  const a3 = A.softmax(T.E_SCORES[3]);
  ok(a3[2] > a3[0] && a3[2] > a3[1] && a3[2] > 0.8, 'α(3,2) (“soccer”) is by far the largest at step 3');
  const out = A.attention(T.Q4, T.K3, T.V3);
  const row = out.weights[3];
  ok(row[2] === Math.max(...row), '§11: “fútbol”’s row peaks on “soccer”');
  ok(T.EN.join(' ') === 'I like soccer' && T.ES.join(' ') === 'me gusta el fútbol', 'the running example');
}

/* ── texText: the print twins ────────────────────────────────────────── */
console.log('texText');
{
  const cases = [
    ['\\text{Attention}(\\mathbf{Q}, \\mathbf{K}, \\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^{\\top}}{\\sqrt{d_{\\text{keys}}}}\\right)\\mathbf{V}', 'Attention(Q, K, V) = softmax(QKᵀ/√d_keys)V'],
    ['\\widetilde{\\mathbf{h}}_{(t)} = \\sum_{i} \\alpha_{(t,i)} \\mathbf{y}_{(i)}', 'h̃₍ₜ₎ = Σᵢ α_(t,i) y₍ᵢ₎'],
    ['\\langle\\text{SOS}\\rangle', '⟨SOS⟩'],
    ['[n_{\\text{queries}}, d_{\\text{keys}}]', '[n_queries, d_keys]'],
    ['1/\\sqrt{d_{\\text{keys}}}', '1/√d_keys'],
    ['\\mathbf{e}_{3,i}', 'e_3,i'],
    ['e_{(3,2)}', 'e_(3,2)'],
    ['\\div\\sqrt{d_{\\text{keys}}} = \\div 2', '÷√d_keys = ÷ 2'],
    ['\\begin{bmatrix} 0.8 & -0.6 \\\\ 0.5 & 0.9 \\end{bmatrix}', '[0.8 −0.6; 0.5 0.9]'],
  ];
  cases.forEach(([src, want]) => ok(texText(src) === want, `texText → ${want}`, texText(src)));
  const pe = texText('\\mathbf{P}_{p,i} = \\begin{cases} \\sin\\left(p/1000^{i/d}\\right) & \\text{if } i \\text{ is even} \\\\ \\cos\\left(p/1000^{(i-1)/d}\\right) & \\text{if } i \\text{ is odd} \\end{cases}');
  ok(pe.includes('sin(p/1000^(i/d)) if i is even') && pe.includes('cos(p/1000^((i−1)/d)) if i is odd'), 'texText: slide 32’s cases brace', pe);
  ok(!/\\/.test(pe), 'no backslash leaks');
}

/* ── content ─────────────────────────────────────────────────────────── */
console.log('content');
{
  // coverage: slides 1–51, each exactly once, in order
  const seen = [];
  SECTIONS.forEach((s) => {
    const [a, b] = s.slides.split('–').map(Number);
    for (let n = a; n <= (b || a); n++) seen.push(n);
  });
  ok(seen.length === 51 && seen.every((n, i) => n === i + 1), 'sections cover slides 1–51 once, in order', seen.join(','));
  ok(SECTIONS.filter((s) => s.notExamined).map((s) => s.slides).join() === '47–49', 'only slides 47–49 are flagged not examined');

  // footnotes
  const used = new Set();
  JSON.stringify(SECTIONS).replace(/\[\^(\d+)\]/g, (_, n) => used.add(Number(n)));
  [...used].forEach((n) => ok(REFS[n], `footnote ${n} exists`));
  ok([...Array(16).keys()].every((k) => REFS[k + 1]), 'footnotes 1–16 are all present');

  // every listing verbatim in the transcript
  const md = fs.readFileSync(path.join(ROOT, 'Documents/cits5017/markdown-lecs/lecture-8.md'), 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...md.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((m) => m[1]);
  Object.entries(NAMED_CODE).forEach(([k, code]) => {
    const lines = code.split('\n').map((l) => l.replace(/\s+$/, '')).join('\n');
    ok(blocks.some((b) => b.replace(/[ \t]+$/gm, '').includes(lines)), `listing ${k} matches the transcript verbatim`);
  });
  // REFS against the transcript's footnotes (the quoted titles)
  [4, 6, 7, 9, 10, 11, 12, 13, 14, 15, 16].forEach((n) => {
    const title = /“([^”]+)”/.exec(REFS[n])?.[1];
    ok(title && md.includes(`"${title}"`), `footnote ${n}'s title is in the transcript`, title);
  });
  // printed numbers
  ok(md.includes('27936.60823591162') && md.includes('34,863.8857') && md.includes('674 trainable params'), 'printed numbers are in the transcript');
  ok(PRINTED.biRnnParams.value === 674, 'PRINTED: 674');
  ok(ROADMAP.length === 7 && OUTCOMES.length === 6, 'slide 3 has 7 topics, slide 50 has 6 outcomes');
  ROADMAP.forEach((t) => ok(md.includes(`- ${t.topic}`), `roadmap topic verbatim: ${t.topic.slice(0, 30)}…`));
  OUTCOMES.forEach((o) => ok(md.includes(`- ${o.text}`), `outcome verbatim: ${o.text.slice(0, 30)}…`));

  // diagrams: parts listed in figParts.js exist in diagrams.jsx; sheet highlights are known parts
  const dsrc = fs.readFileSync(path.join(L8, 'diagrams.jsx'), 'utf8');
  Object.entries(FIG_PARTS).forEach(([fig, parts]) => {
    ok(new RegExp(`\\b${fig}: [A-Z]`).test(dsrc), `figure ${fig} is registered`);
    parts.forEach((p) => ok(dsrc.includes(`k="${p}"`), `figure ${fig} has part ${p}`));
  });
  let lines = 0;
  Object.entries(SHEETS).forEach(([id, sh]) => {
    ok(SECTIONS.some((s) => s.id === id), `sheet ${id} belongs to a section`);
    sh.blocks.forEach((b) => {
      const figs = [b.fig, ...b.items.filter((it) => it && it.fig)].filter(Boolean);
      figs.forEach((f) => {
        const key = f.key ?? f.fig;
        ok(FIG_PARTS[key], `sheet ${id}: figure ${key} exists`);
        (f.hl || []).forEach((h) => ok(FIG_PARTS[key]?.includes(h), `sheet ${id}: ${key} highlight ${h}`));
      });
      b.items.forEach((it) => {
        if (typeof it === 'string' || it.line || it.formula || it.code) lines += 1;
        else if (it.steps) lines += it.steps.length;
        else if (it.worked) lines += it.worked.length + (it.title ? 1 : 0);
      });
    });
    ok(new Set(sheetKeys(sh)).size === sheetKeys(sh).length, `sheet ${id}: tick keys are unique`);
  });
  ok(!SHEETS.s00 && !SHEETS.s16 && !SHEETS.s17, 'no notebook page for §0, §16 (not examined) or §17');
  ok(lines < 100, `notes budget: ${lines} lines (< 100)`);
}

/* ── data ────────────────────────────────────────────────────────────── */
console.log('data');
{
  ok(BR.BIRNN.params === 674, 'busrail.js: simple_biRNN has 674 parameters (slide 9 gate)');
  ok(BR.RUN.trainWindows === 1027, 'busrail.js: 1,027 training windows (slide 9’s X_train.shape)');
  ok(BR.RNN_ED.params === A.rnnEdParams().total, 'busrail.js: rnn_ed count = this page’s working');
  ok(BR.BIRNN.horizonMAE.length === 14 && BR.RNN_ED.horizonMAE.length === 14, '14 horizons each');
  ok(BR.BIRNN.windows.length === 4 && BR.BIRNN.windows.every((w, i) => w.start === BR.RNN_ED.windows[i].start), 'the same four windows for both models');
  const size = (f) => fs.statSync(path.join(L8, 'data', f)).size;
  const total = size('busrail.js') + size('toyMT.js');
  ok(total < 500 * 1024, `shipped data ${(total / 1024).toFixed(0)} KB (< 500 KB)`);
}

console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);
