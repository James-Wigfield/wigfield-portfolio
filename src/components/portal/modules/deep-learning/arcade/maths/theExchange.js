/* ============================================================================
   THE EXCHANGE — QUESTION GENERATOR (pure, seeded)
   ----------------------------------------------------------------------------
   makeItems(rand, level, model) → the round's items. `model` is the toy
   transformer from lecture8-study/toyMT.js (loadToyMT()), or null (then the
   patch-board items are left out and the round is choice + arithmetic).

     patch items   a sentence translated by the toy; one decoder row t; the
                   real cross-attention weights (layer 1, head average) are
                   the answer; the player's plugs are graded by argmax and
                   L1 distance (content/the-exchange.js PATCH_L1_TOL)
     arithmetic    softmax of three scores (slide 25), a dot-product score
                   (slides 24–25), one component of the weighted sum
                   (slides 20, 25), a scaled score (slides 37–38), with the
                   slides' symbols; tiny integers so answers are exact
     choices       content/the-exchange.js CHOICE by level
   ========================================================================== */
import { CHOICE, ORDER, LEVELS, PATCH_L1_TOL, OWN } from '../content/the-exchange.js';
import { softmax, dot, weightedSum } from '../../lecture8-study/attn.js';
import { allSentences, translate } from '../../lecture8-study/toyMT.js';

const fmt2 = (x) => x.toFixed(2);
const tok = (w) => (w === '<sos>' ? '⟨SOS⟩' : w === '<eos>' ? '⟨EOS⟩' : w);
const fmtVec = (v, dp = 2) => `[${v.map((x) => x.toFixed(dp)).join(', ')}]`;
const L8 = (slides) => ({ lecture: 8, slides });
let counter = 0;
const nextId = (p) => `${p}-${counter++}`;

/* ── plugs → weights ─────────────────────────────────────────────────────── */
export function plugsToWeights(levels) {
  const raw = levels.map((l) => LEVELS[l] ?? 0);
  const s = raw.reduce((a, b) => a + b, 0);
  return s > 0 ? raw.map((x) => x / s) : raw.map(() => 1 / raw.length);
}
export const argmax = (a) => a.reduce((b, x, i) => (x > a[b] ? i : b), 0);
export const l1 = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - (b[i] ?? 0)), 0);
export function gradePatch(given, answer, tol = PATCH_L1_TOL) {
  if (!Array.isArray(given) || given.length !== answer.length) return false;
  return argmax(given) === argmax(answer) && l1(given, answer) <= tol;
}

/* ── the toy's real attention ───────────────────────────────────────────── */
const headAvg = (layer) => layer[0].map((row, i) => row.map((_, j) => layer.reduce((s, H) => s + H[i][j], 0) / layer.length));

// translations of a handful of sentences (memoised per model)
const CACHE = new WeakMap();
function translations(model, rand, n = 10) {
  let m = CACHE.get(model);
  if (!m) { m = new Map(); CACHE.set(model, m); }
  const pool = allSentences().filter((w) => w.length >= 3 && w.length <= 5);
  const picked = rand.shuffle(pool).slice(0, n);
  return picked.map((words) => {
    const key = words.join(' ');
    if (!m.has(key)) {
      try { m.set(key, translate(model, words)); } catch { m.set(key, null); }
    }
    return { words, t: m.get(key) };
  }).filter((x) => x.t);
}

function patchItem(rand, model, kind, used) {
  for (const { words, t } of translations(model, rand)) {
    const key = words.join(' ');
    if (used.has(key)) continue;
    if (kind === 'cross') {
      const W = headAvg(t.cross[0]); // [decIn pos][src word]
      const rows = W.map((row, i) => ({ i, max: Math.max(...row) })).filter((r) => r.max >= 0.45 && r.i < t.out.length);
      if (!rows.length) continue;
      used.add(key);
      const { i } = rand.pick(rows);
      const answer = W[i].map((x) => Math.round(x * 100) / 100);
      const query = tok(t.decIn[i]);
      const produces = tok(t.out[i] ?? '<eos>');
      return {
        id: nextId('patch-cross'),
        kind: 'custom',
        concept: 'attn.weightedSum',
        src: L8([20, 21, 27, 40]),
        board: { mode: 'cross', keys: words, query, produces, sentence: words, out: t.out },
        answer,
        check: (given) => gradePatch(given, answer),
        format: (v) => (Array.isArray(v) ? words.map((w, j) => `${w} ${fmt2(v[j] ?? 0)}`).join(' · ') : String(v)),
        question: `Patch “${query}” (producing “${produces}”) into the English keys.`,
        promptText: `Cross-attention: “${query}” → “${produces}” in “${words.join(' ')}”`,
        why: `The toy transformer’s cross-attention (its one layer, average of its 2 heads) put ${words.map((w, j) => `${fmt2(answer[j])} on “${w}”`).join(', ')} while turning “${query}” into “${produces}”: the decoder’s query against the encoder’s keys, a weighted sum of the encoder outputs (slides 20–21; slide 40 shows the decoder attending to “soccer” for “el”). ${OWN}`,
      };
    }
    // self-attention in the encoder: a word attending to its own sentence
    const W = headAvg(t.encSelf[0]);
    const rows = W.map((row, i) => ({ i, max: Math.max(...row) })).filter((r) => r.max >= 0.45);
    if (!rows.length) continue;
    used.add(key);
    const { i } = rand.pick(rows);
    const answer = W[i].map((x) => Math.round(x * 100) / 100);
    return {
      id: nextId('patch-self'),
      kind: 'custom',
      concept: 'transformer.selfVsCross',
      src: L8([40, 31]),
      board: { mode: 'self', keys: words, query: words[i], produces: null, sentence: words, out: t.out },
      answer,
      check: (given) => gradePatch(given, answer),
      format: (v) => (Array.isArray(v) ? words.map((w, j) => `${w} ${fmt2(v[j] ?? 0)}`).join(' · ') : String(v)),
      question: `Self-attention: patch “${words[i]}” into its own sentence.`,
      promptText: `Self-attention: “${words[i]}” within “${words.join(' ')}”`,
      why: `In the encoder, queries, keys and values all come from the same sentence (slides 31, 40): the toy’s self-attention for “${words[i]}” put ${words.map((w, j) => `${fmt2(answer[j])} on “${w}”`).join(', ')}. ${OWN}`,
    };
  }
  return null;
}

/* ── arithmetic items ──────────────────────────────────────────────────── */
function softmaxItem(rand) {
  const e = [rand.int(-1, 2), rand.int(-1, 2), rand.int(-1, 2)];
  if (new Set(e).size === 1) e[rand.int(0, 2)] += 2;
  const a = softmax(e);
  const i = argmax(a);
  const answer = Math.round(a[i] * 100) / 100;
  return {
    id: nextId('softmax'), kind: 'number', decimal: true, tol: 0.011,
    concept: 'attn.luongVariants', src: L8([25, 22]),
    question: `Scores e(t, i) = [${e.join(', ')}] for i = 0, 1, 2. What is α(t, ${i})? (2 d.p.)`,
    promptText: `softmax of e = [${e.join(', ')}] → α(t, ${i})`,
    answer,
    why: `Slide 25: $\\alpha_{(t,i)} = \\exp(e_{(t,i)}) / \\sum_{i'} \\exp(e_{(t,i')})$. Here $e^{${e[i]}} / (${e.map((x) => `e^{${x}}`).join(' + ')}) = ${fmt2(a[i])}$; the three weights are ${fmtVec(a)} and add up to 1.`,
  };
}

function dotItem(rand) {
  const h = [rand.int(-2, 2), rand.int(-2, 2), rand.int(-2, 2)];
  const y = [rand.int(-2, 2), rand.int(-2, 2), rand.int(-2, 2)];
  const answer = dot(h, y);
  return {
    id: nextId('dot'), kind: 'number', negative: true, tol: 0,
    concept: 'attn.luong', src: L8([24, 25]),
    question: `Luong dot-product score: h(t) = [${h.join(', ')}], y(i) = [${y.join(', ')}]. e(t, i) = h(t)ᵀ y(i) = ?`,
    promptText: `h(t)ᵀ y(i) with h = [${h.join(', ')}], y = [${y.join(', ')}]`,
    answer,
    why: `Slides 24–25: the dot-product variant scores each encoder output by $e_{(t,i)} = \\mathbf{h}_{(t)}^{\\top}\\mathbf{y}_{(i)} = ${h.map((x, k) => `(${x})(${y[k]})`).join(' + ')} = ${answer}$. The vectors must be of the same length.`,
  };
}

function weightedSumItem(rand) {
  const alphas = rand.pick([[0.7, 0.2, 0.1], [0.5, 0.3, 0.2], [0.1, 0.1, 0.8], [0.6, 0.3, 0.1], [0.2, 0.5, 0.3]]);
  const ys = [0, 1, 2].map(() => [rand.int(-2, 2), rand.int(-2, 2)]);
  const h = weightedSum(alphas, ys);
  const j = rand.int(0, 1);
  const answer = Math.round(h[j] * 100) / 100;
  return {
    id: nextId('wsum'), kind: 'number', decimal: true, negative: true, tol: 0.011,
    concept: 'attn.weightedSum', src: L8([25, 20]),
    question: `α(t, ·) = [${alphas.join(', ')}], y(0) = [${ys[0].join(', ')}], y(1) = [${ys[1].join(', ')}], y(2) = [${ys[2].join(', ')}]. Component ${j} of h̃(t) = Σᵢ α(t, i) y(i)?`,
    promptText: `h̃(t) component ${j} with α = [${alphas.join(', ')}]`,
    answer,
    why: `Slide 25: $\\widetilde{\\mathbf{h}}_{(t)} = \\sum_i \\alpha_{(t,i)}\\mathbf{y}_{(i)}$, the weighted sum slide 20 describes. Component ${j}: ${alphas.map((a, i) => `${a}·(${ys[i][j]})`).join(' + ')} = ${fmt2(h[j])}.`,
  };
}

function scaledItem(rand) {
  const d = rand.pick([4, 16, 64, 100]);
  const s = rand.pick([2, 3, 4, 5, 6, 8, 10, 12, 20, 30]) * (rand.chance(0.3) ? -1 : 1);
  const answer = s / Math.sqrt(d);
  return {
    id: nextId('scaled'), kind: 'number', decimal: true, negative: true, tol: 0.011,
    concept: 'transformer.sdpa', src: L8([37, 38]),
    question: `A query·key score is ${s} and d_keys = ${d}. The scaled score QKᵀ/√d_keys = ?`,
    promptText: `${s} / √${d}`,
    answer,
    why: `Slides 37–38: $\\text{Attention}(\\mathbf{Q},\\mathbf{K},\\mathbf{V}) = \\text{softmax}(\\mathbf{Q}\\mathbf{K}^{\\top}/\\sqrt{d_{\\text{keys}}})\\mathbf{V}$, so ${s} / √${d} = ${s} / ${Math.sqrt(d)} = ${answer}. The scaling keeps the softmax from saturating (tiny gradients). Slide 38’s bullet writes the factor as 1/d_keys; the equation on slides 37–38 divides by √d_keys, which is what is drilled here.`,
  };
}

function rowSumItem() {
  return {
    id: nextId('rowsum'), kind: 'number', tol: 0,
    concept: 'transformer.sdpa', src: L8([38]),
    question: 'After the softmax in scaled dot-product attention, what does each row of the [n_queries, n_keys] matrix add up to?',
    promptText: 'softmax row sum',
    answer: 1,
    why: 'Slide 38: the softmax output has the same shape [n_queries, n_keys], but the numbers for each row add up to 1.',
  };
}

function maskItem(rand) {
  const words = ['⟨SOS⟩', 'me', 'gusta', 'el', 'fútbol'];
  const i = rand.int(1, 3);
  const allowed = words.slice(0, i + 1);
  const wrongA = [words[i]]; // the word alone: wrong whether or not the word attends to itself
  const wrongB = words.slice(i);
  const choices = rand.shuffle([
    { value: 'ok', label: allowed.join(', ') },
    { value: 'a', label: wrongA.join(', ') },
    { value: 'b', label: wrongB.join(', ') },
    { value: 'all', label: words.join(', ') },
  ]);
  return {
    id: nextId('mask'), kind: 'choice', choices, answer: 'ok',
    concept: 'transformer.mask', src: L8([31, 41]),
    question: `Masked self-attention in the decoder: the word “${words[i]}” (position ${i} of “${words.join(' ')}”) may attend to which words?`,
    promptText: `causal mask at “${words[i]}”`,
    why: `Slide 31: the decoder’s masked multi-head attention is causal, so a word attends to itself and the words before it, never the words after: ${allowed.join(', ')}. Slide 41: the masking on a word is removed only once it has been predicted.`,
  };
}

function orderItem(rand) {
  const steps = ORDER.steps;
  const shuffled = rand.shuffle(steps.map((s, i) => i));
  const answer = steps.map((_, i) => i); // the correct order as indices into steps
  return {
    id: nextId('order'), kind: 'custom',
    concept: ORDER.concept, src: ORDER.src,
    order: { steps, start: shuffled },
    answer,
    check: (given) => Array.isArray(given) && given.length === steps.length && given.every((v, i) => v === answer[i]),
    format: (v) => (Array.isArray(v) ? v.map((k) => steps[k]).join(' → ') : String(v)),
    question: ORDER.prompt,
    promptText: 'multi-head attention pipeline',
    why: ORDER.why,
  };
}

function choiceItem(rand, c) {
  return {
    id: nextId(c.id), kind: 'choice',
    concept: c.concept, src: c.src,
    question: c.prompt, promptText: c.promptText ?? c.prompt,
    choices: rand.shuffle(c.choices.map((x) => ({ value: x.value, label: x.label }))),
    answer: c.answer,
    why: c.why,
  };
}

/* ── the rounds ──────────────────────────────────────────────────────────── */
export function makeItems(rand, level = 1, model = null) {
  counter = 0;
  const used = new Set();
  const pick = (lvl, n) => rand.shuffle(CHOICE.filter((c) => c.level === lvl)).slice(0, n).map((c) => choiceItem(rand, c));
  const items = [];
  if (level <= 1) {
    items.push(...pick(1, model ? 3 : 6));
    if (model) for (let k = 0; k < 4; k++) { const it = patchItem(rand, model, 'cross', used); if (it) items.push(it); }
    items.push(softmaxItem(rand));
    return items;
  }
  if (level === 2) {
    items.push(...pick(2, 5));
    items.push(dotItem(rand), softmaxItem(rand), weightedSumItem(rand));
    if (model) { const it = patchItem(rand, model, 'cross', used); if (it) items.push(it); }
    return items;
  }
  items.push(...pick(3, 4));
  items.push(scaledItem(rand), maskItem(rand), orderItem(rand));
  if (model) {
    const a = patchItem(rand, model, 'cross', used);
    const b = patchItem(rand, model, 'self', used);
    if (a) items.push(a);
    if (b) items.push(b);
  } else items.push(rowSumItem());
  return items;
}
