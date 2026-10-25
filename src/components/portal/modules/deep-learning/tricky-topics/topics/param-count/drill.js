import { countModel, layerName, working, layerCounts } from '../../maths/paramRules.js';
import { MODELS } from '../../maths/models.js';
import { equationsOk, workingLines } from './forms.js';
import { LISTINGS } from './listings.js';

/* ============================================================================
   TOPIC 1 · THE EXAM DRILL: COUNT IT
   ----------------------------------------------------------------------------
   make(seed, mode) — a seeded random model in the unit's layer vocabulary
   (Dense, Conv2D/Conv1D, pooling, Flatten/GAP, BN, Normalization,
   Concatenate, SimpleRNN/LSTM/GRU, Dropout, Bidirectional), shown in one of
   the five forms (code, diagram, summary with gaps, sentence, equations).
   The student types every layer's count and the total; the working is
   workingLines(). mode 'reverse' gives the count and asks for the units or
   filters instead. Every generated model is exported (tools/dl-tricky-
   topics/export-specs.mjs) and rebuilt in Keras by verify_counts.py.
   FIXED = questions from the unit, with their receipts.
   ========================================================================== */

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, xs) => xs[Math.floor(r() * xs.length)];
const fmt = (v) => Number(v).toLocaleString('en-US');

function genMLP(r) {
  const img = r() < 0.35;
  const input = img ? pick(r, [[28, 28], [8, 8], [16, 16]]) : [pick(r, [4, 5, 6, 8, 10, 12, 16, 20])];
  const layers = img ? [{ t: 'flatten' }] : [];
  const nh = 1 + Math.floor(r() * 2);
  for (let i = 0; i < nh; i++) {
    layers.push({ t: 'dense', units: pick(r, [8, 10, 16, 20, 30, 32, 50, 64, 100]) });
    if (r() < 0.3) layers.push({ t: 'bn' });
    else if (r() < 0.25) layers.push({ t: 'dropout', rate: 0.5 });
  }
  layers.push({ t: 'dense', units: pick(r, [1, 2, 3, 5, 10]) });
  return { input, layers };
}

function genCNN(r) {
  const s = pick(r, [8, 16, 28, 32]);
  const input = [s, s, pick(r, [1, 3])];
  const layers = [];
  const blocks = 1 + Math.floor(r() * 2);
  let side = s;
  for (let b = 0; b < blocks; b++) {
    const k = pick(r, [3, 3, 5]);
    const pad = r() < 0.6 ? 'same' : 'valid';
    const st = r() < 0.2 ? 2 : 1;
    if (pad === 'valid' && side - k < 2) break;
    layers.push({ t: 'conv2d', filters: pick(r, [8, 16, 32, 64]), k, pad, ...(st > 1 ? { s: st } : {}) });
    side = pad === 'same' ? Math.ceil(side / st) : Math.floor((side - k) / st) + 1;
    if (side >= 4 && r() < 0.7) {
      layers.push({ t: 'maxpool2d', p: 2 });
      side = Math.floor(side / 2);
    }
  }
  if (!layers.length) layers.push({ t: 'conv2d', filters: 16, k: 3, pad: 'same' });
  const flat = r() < 0.5 && side <= 8;
  layers.push(flat ? { t: 'flatten' } : { t: 'gap2d' });
  if (r() < 0.3) layers.push({ t: 'dense', units: pick(r, [16, 32, 64]) });
  layers.push({ t: 'dense', units: pick(r, [10, 5, 2, 1]) });
  return { input, layers };
}

function genRNN(r) {
  const input = [pick(r, [10, 20, 30, 50, 56]), pick(r, [1, 2, 3, 5])];
  const t = pick(r, ['simplernn', 'simplernn', 'lstm', 'gru']);
  const units = pick(r, [4, 5, 8, 10, 12, 16, 20, 32]);
  const layers = [];
  const stacked = r() < 0.3;
  const bidir = !stacked && r() < 0.25;
  if (stacked) layers.push({ t, units, seq: true });
  const last = { t, units: stacked ? pick(r, [4, 8, 16]) : units };
  layers.push(bidir ? { t: 'bidir', layer: last } : last);
  layers.push({ t: 'dense', units: pick(r, [1, 2, 4]) });
  return { input, layers };
}

function genWide(r) {
  const n = pick(r, [5, 6, 8, 10, 12]);
  return {
    input: [n],
    layers: [
      { t: 'norm', id: 'normalized' },
      { t: 'dense', units: pick(r, [10, 16, 20, 30]), id: 'hidden' },
      { t: 'concat', in: ['normalized', 'hidden'] },
      { t: 'dense', units: pick(r, [1, 2, 3]) },
    ],
  };
}

function genConv1D(r) {
  return {
    input: [pick(r, [30, 56, 60]), pick(r, [1, 2])],
    layers: [
      { t: 'conv1d', filters: pick(r, [8, 16]), k: 3, ...(r() < 0.5 ? { s: 2 } : {}) },
      { t: pick(r, ['gru', 'lstm', 'simplernn']), units: pick(r, [8, 10, 16]) },
      { t: 'dense', units: 1 },
    ],
  };
}

export function genModel(seed) {
  const r = rng(seed);
  const fam = pick(r, ['mlp', 'mlp', 'cnn', 'cnn', 'rnn', 'rnn', 'wide', 'conv1d']);
  const model = { mlp: genMLP, cnn: genCNN, rnn: genRNN, wide: genWide, conv1d: genConv1D }[fam](r);
  const forms = ['code', 'diagram', 'summary', 'sentence', ...(equationsOk(model) ? ['equations', 'equations'] : [])];
  return { model, form: pick(r, forms), r };
}

const PROMPT = {
  code: 'Given the code below, give the number of parameters of every layer and the total.',
  diagram: 'The sketch below shows a network. Give the number of parameters of every layer and the total.',
  summary: 'Fill in the gaps in this `model.summary()`: the missing Param # values and the totals.',
  sentence: 'A network is described below. Give the number of parameters of every layer and the total.',
  equations: 'A network is given by the equations below (row vectors, as on L4 slide 9). Give the number of parameters of every layer and the total.',
};

// fields for one model: every layer (or only the blanks of a summary), then the totals
function fieldsFor(model, blanks) {
  const C = countModel(model);
  const rows = blanks ? C.rows.filter((row) => blanks.includes(row.i)) : C.rows;
  const fields = rows.map((row) => ({ key: `l${row.i}`, label: `\`${layerName(row.L)}\``, answer: row.total, type: 'number' }));
  fields.push({ key: 'total', label: C.nonTrainable ? '**Total** (trainable + non-trainable)' : '**Total**', answer: C.total, type: 'number' });
  if (C.nonTrainable) fields.push({ key: 'nt', label: 'of which **non-trainable**', answer: C.nonTrainable, type: 'number' });
  return fields;
}

function countQuestion(seed) {
  const { model, form, r } = genModel(seed);
  const C = countModel(model);
  const blanks = form === 'summary'
    ? C.rows.filter((row) => row.total > 0).map((row) => row.i).filter((_, i, a) => a.length < 3 || r() < 0.7)
    : null;
  return {
    id: `r${seed}`,
    prov: '{own}',
    prompt: PROMPT[form],
    show: { model, form, blanks: blanks ? [...blanks, 'total'] : undefined },
    model,
    fields: fieldsFor(model, blanks),
    working: workingLines(model),
  };
}

/* reverse: the count is given, find the size */
function reverseQuestion(seed) {
  const r = rng(seed + 7919);
  const kind = pick(r, ['dense', 'conv', 'rnn', 'lstm', 'bn', 'gru']);
  if (kind === 'dense') {
    const nIn = pick(r, [8, 10, 20, 32, 64, 100, 300, 784]);
    const u = pick(r, [5, 10, 16, 20, 30, 50, 100]);
    const P = (nIn + 1) * u;
    return { id: `v${seed}`, prov: '{own}', prompt: `A \`Dense\` layer receives ${fmt(nIn)} inputs and has ${fmt(P)} parameters. How many units does it have?`, model: { input: [nIn], layers: [{ t: 'dense', units: u }] }, fields: [{ key: 'u', label: 'units', answer: u, type: 'number' }], working: [`$P = (n_{\\text{in}} + 1) \\times u$, so $u = ${fmt(P)} \\div (${nIn} + 1) = ${u}$ {s|L1 · slide 36}`] };
  }
  if (kind === 'conv') {
    const k = pick(r, [3, 5, 7]);
    const c = pick(r, [1, 3, 16, 32, 64]);
    const f = pick(r, [8, 16, 32, 64, 128]);
    const P = (k * k * c + 1) * f;
    return { id: `v${seed}`, prov: '{own}', prompt: `A \`Conv2D\` layer with ${k} × ${k} kernels takes an input with ${c} channel${c > 1 ? 's' : ''} and has ${fmt(P)} parameters. How many filters?`, model: { input: [16, 16, c], layers: [{ t: 'conv2d', filters: f, k, pad: 'same' }] }, fields: [{ key: 'f', label: 'filters', answer: f, type: 'number' }], working: [`$P = (k \\times k \\times c_{\\text{in}} + 1) \\times f$, so $f = ${fmt(P)} \\div (${k} \\times ${k} \\times ${c} + 1) = ${fmt(P)} \\div ${k * k * c + 1} = ${f}$ {s|L3 · slide 22}`] };
  }
  if (kind === 'bn') {
    const n = pick(r, [10, 30, 64, 100, 128, 300]);
    return { id: `v${seed}`, prov: '{own}', prompt: `A \`BatchNormalization\` layer has ${fmt(4 * n)} parameters in all. How many features does it normalize, and how many of its parameters are non-trainable?`, model: { input: [n], layers: [{ t: 'bn' }] }, fields: [{ key: 'n', label: 'features', answer: n, type: 'number' }, { key: 'nt', label: 'non-trainable', answer: 2 * n, type: 'number' }], working: [`BN keeps 4 numbers per feature: $${fmt(4 * n)} \\div 4 = ${n}$ features; the moving mean and variance, $2 \\times ${n} = ${2 * n}$, are non-trainable {s|L2 · slide 27}`] };
  }
  const d = pick(r, [1, 2, 3, 5]);
  const u = pick(r, [4, 5, 8, 10, 12, 16, 20, 32]);
  const t = kind === 'rnn' ? 'simplernn' : kind;
  const P = layerCounts({ t, units: u }, [[10, d]]).total;
  const name = { simplernn: 'SimpleRNN', lstm: 'LSTM', gru: 'GRU' }[t];
  const mult = { simplernn: 1, lstm: 4, gru: 3 }[t];
  const eq = t === 'gru' ? `$P = 3(u^2 + (${d} + 2)u)$` : `$P = ${mult === 1 ? '' : `${mult}`}(u^2 + (${d} + 1)u)$`;
  return {
    id: `v${seed}`,
    prov: '{own}',
    prompt: `A \`${name}\` layer${t === 'gru' ? ' (Keras’s default, two biases per gate)' : ''} reads ${d}-dimensional inputs and has ${fmt(P)} parameters. How many units?`,
    model: { input: [10, d], layers: [{ t, units: u }] },
    fields: [{ key: 'u', label: 'units', answer: u, type: 'number' }],
    working: [`${eq}. Try $u = ${u}$: ${working({ t, units: u }, [[10, d]])} ✓ ${t === 'simplernn' ? '{s|L4 · slide 9}' : t === 'lstm' ? '{s|L4 · slide 43}' : '{s|L4 · slide 49}'}`],
  };
}

export function make(seed, mode = 'count') {
  return mode === 'reverse' ? reverseQuestion(seed) : countQuestion(seed);
}

export const MODES = [{ value: 'count', label: 'Count it' }, { value: 'reverse', label: 'Reverse: find the size' }];

/* ── from the unit ─────────────────────────────────────────────────────── */
function fixed(id, key, form, prompt, opts = {}) {
  const M = MODELS[key];
  const C = countModel(M.model);
  let fields = fieldsFor(M.model, opts.blanks);
  if (opts.trainableOnly) {
    fields = C.rows.map((row) => ({ key: `l${row.i}`, label: `\`${layerName(row.L)}\` · trainable`, answer: row.trainable, type: 'number' }));
    fields.push({ key: 'tr', label: '**Total trainable**', answer: C.trainable, type: 'number' });
  }
  // the slide's alone only if it prints every answer: each layer's count, or
  // the total of a model with a single counting layer; otherwise the split is ours
  const counting = C.rows.filter((row) => row.total > 0).length;
  const allPrinted = M.printed.perLayer || (M.printed.total != null && counting === 1);
  return {
    id,
    title: `From the unit · ${M.at}`,
    prov: opts.prov ?? (allPrinted ? `{s|${M.at}}` : `{s|${M.at}} {own}`),
    prompt,
    show: { model: M.model, form, blanks: opts.blanks ? [...opts.blanks, 'total'] : undefined, listing: form === 'code' ? LISTINGS[key] : undefined },
    model: M.model,
    fields,
    working: [...workingLines(M.model), ...(opts.extra ?? [])],
  };
}

export const FIXED = [
  fixed('u-l1mlp', 'l1-mlp', 'summary', 'Slide 36’s `model.summary()` with its Param # column blanked. Fill it in.', { blanks: [1, 2, 3] }),
  fixed('u-sampleq1c', 'sample-q1c', 'code', 'Sample Q1(c): compute the number of trainable parameters in each layer and the total number of trainable parameters.', { trainableOnly: true, prov: '{s|Sample Q1(c)} {own}', extra: ['Normalization’s $2 \\times 10 + 1 = 21$ numbers are non-trainable: the trap. Trainable 313, total 334 {own}.'] }),
  fixed('u-widedeep', 'l1-widedeep', 'code', 'Slides 44–45’s Wide & Deep model on the 8 California housing features. Count every layer, the total and the non-trainable part.'),
  fixed('u-l3s22', 'l3-s22', 'sentence', 'Slide 22: “a convolutional layer having 200 5 × 5 filters with stride 1 and ‘same’ padding. If the input is a 150 × 100 RGB image”, how many parameters?'),
  fixed('u-l3cnn', 'l3-cnn', 'code', 'Slide 35’s CNN. `DefaultConv2D` means `kernel_size=3, padding="same"` unless a call says otherwise. Count every layer and the total.'),
  fixed('u-l4rnn32', 'l4-rnn32', 'summary', 'Slide 27’s summary with the counts blanked.', { blanks: [0, 1] }),
  fixed('u-l4lstm', 'l4-lstm', 'code', 'Slide 43’s LSTM model. Count each layer and the total.'),
  fixed('u-l4gru', 'l4-gru', 'code', 'Slide 49’s GRU model (Keras’s default GRU). Count each layer and the total.', { extra: ['With one bias per gate, as slide 49’s equations write it, the GRU would have 1,320 and the total 1,341 {own}.'] }),
  fixed('u-l8bi', 'l8-birnn', 'code', 'Slide 9’s bidirectional RNN on (bus, rail) pairs. Count each layer and the total.'),
  fixed('u-l67dec', 'l67-convdec', 'summary', 'Slide 6’s `conv_decoder.summary()` with gaps.', { blanks: [0, 2, 3, 4] }),
  fixed('u-pAq1c', 'practiceA-q1c', 'code', 'Practice A Q1(c): the number of parameters of each layer and the total.', { prov: '{s|Practice A Q1(c)} {own}', extra: ['With `Flatten` instead: $8 \\times 8 \\times 32 = 2048$ inputs, so the output layer would have $(2048 + 1) \\times 10 = 20{,}490$ {own}.'] }),
];
