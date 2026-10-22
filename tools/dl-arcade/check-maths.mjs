#!/usr/bin/env node
/* check-maths.mjs — Gradient Arcade maths verifier.

   1. Loads tools/dl-arcade/keras-truth.json (written by keras_truth.py with real
      Keras) and asserts that arcade/maths/params.js and shapes.js reproduce EVERY
      parameter count (total, trainable, non-trainable) and output shape.
   2. Asserts the slide anchors: the models printed on the CITS5017 slides, with
      the printed number, the Keras number and the JS number side by side. A
      printed number that disagrees with Keras is recorded, not "fixed".

   Run:  node tools/dl-arcade/check-maths.mjs        (exit 1 on any mismatch) */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..', '..');
const mathsDir = path.join(root, 'src', 'components', 'portal', 'modules', 'deep-learning', 'arcade', 'maths');
const { layerParams, modelParams, denseParams } = await import(pathToFileURL(path.join(mathsDir, 'params.js')).href);
const { layerShape, modelShapes, fmtShape } = await import(pathToFileURL(path.join(mathsDir, 'shapes.js')).href);

const truth = JSON.parse(readFileSync(path.join(here, 'keras-truth.json'), 'utf8'));
const { meta, configs, anchors: kerasAnchors } = truth;

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const fmt = (n) => (n == null ? '—' : n.toLocaleString('en-AU'));
const failures = [];
const fail = (msg) => failures.push(msg);

console.log(`keras-truth.json: TensorFlow ${meta.tensorflow} · Keras ${meta.keras} · Python ${meta.python} · ${meta.backend} backend · ${meta.date} · seed ${meta.seed}`);
console.log(`${configs.length} random configs, ${Object.keys(kerasAnchors).length} Keras anchor models\n`);

// ── 1. random configs vs Keras ─────────────────────────────────────────────
const perType = new Map();
let nConfigsOk = 0;
for (const c of configs) {
  const t = c.spec.type;
  const tally = perType.get(t) ?? { n: 0, params: 0, shapes: 0 };
  tally.n += 1;
  const before = failures.length;
  let p = null;
  let shape = null;
  try {
    p = layerParams(c.spec);
    shape = layerShape(c.spec, c.spec.inputShape);
  } catch (e) {
    fail(`${t} threw ${e.message} for ${JSON.stringify(c.spec)}`);
    perType.set(t, tally);
    continue;
  }
  if (p.total === c.total && p.trainable === c.trainable && p.nonTrainable === c.nonTrainable) tally.params += 1;
  else fail(`${t} params: js ${p.total}/${p.trainable}/${p.nonTrainable} keras ${c.total}/${c.trainable}/${c.nonTrainable} for ${JSON.stringify(c.spec)}`);
  if (same(shape, c.outputShape)) tally.shapes += 1;
  else fail(`${t} shape: js ${fmtShape(shape)} keras ${fmtShape(c.outputShape)} for ${JSON.stringify(c.spec)}`);
  if (failures.length === before) nConfigsOk += 1;
  perType.set(t, tally);
}
console.log('Random configs (params ok / shapes ok / total):');
for (const [t, { n, params, shapes }] of perType) {
  const ok = params === n && shapes === n;
  console.log(`  ${ok ? 'ok ' : 'BAD'} ${t.padEnd(20)} ${String(params).padStart(4)} / ${String(shapes).padStart(4)} / ${String(n).padStart(4)}`);
}

// ── 2. slide anchors ───────────────────────────────────────────────────────
// Shorthands for the slide models (the spec format of params.js).
const Dense = (units, extra = {}) => ({ type: 'Dense', units, ...extra });
const Conv2D = (filters, kernel, extra = {}) => ({ type: 'Conv2D', filters, kernel, ...extra });
const ConvT = (filters, kernel, extra = {}) => ({ type: 'Conv2DTranspose', filters, kernel, ...extra });
const Conv1D = (filters, kernel, extra = {}) => ({ type: 'Conv1D', filters, kernel, ...extra });
const MaxPool = (pool = 2, extra = {}) => ({ type: 'MaxPool2D', pool, ...extra });
const AvgPool = (pool = 2, extra = {}) => ({ type: 'AvgPool2D', pool, ...extra });
const Flatten = () => ({ type: 'Flatten' });
const Reshape = (target) => ({ type: 'Reshape', target });
const BN = () => ({ type: 'BatchNormalization' });
const Dropout = (rate) => ({ type: 'Dropout', rate });
const GAP = () => ({ type: 'GlobalAvgPool2D' });
const SimpleRNN = (units, extra = {}) => ({ type: 'SimpleRNN', units, ...extra });
const LSTM = (units, extra = {}) => ({ type: 'LSTM', units, ...extra });
const GRU = (units, extra = {}) => ({ type: 'GRU', units, ...extra });
const Bi = (layer, extra = {}) => ({ type: 'Bidirectional', layer, ...extra });
const DenseT = (units) => ({ type: 'DenseTranspose', units });

const convEncoder = [
  Reshape([28, 28, 1]),
  Conv2D(16, 3, { padding: 'same' }), MaxPool(2),
  Conv2D(32, 3, { padding: 'same' }), MaxPool(2),
  Conv2D(64, 3, { padding: 'same' }), MaxPool(2),
  Conv2D(30, 3, { padding: 'same' }), GAP(),
];
const convDecoder = [
  Dense(3 * 3 * 16), Reshape([3, 3, 16]),
  ConvT(32, 3, { strides: 2 }),
  ConvT(16, 3, { strides: 2, padding: 'same' }),
  ConvT(1, 3, { strides: 2, padding: 'same' }),
  Reshape([28, 28]),
];
const cnnGru = [
  Conv1D(8, 3, { strides: 1 }),
  Conv1D(16, 3, { strides: 2 }),
  GRU(10), Dense(1),
];

/* Each anchor: the slide model as stacks of specs, what the slide PRINTS
   (`slide`: totals, per-layer Param # and Output Shape where shown; null when
   the slide prints no number), and the id of the matching Keras anchor model. */
const ANCHORS = [
  {
    id: 'l2-bn-mlp', lecture: 2, slides: [26, 27], label: 'BatchNormalization MLP model.summary()',
    stacks: [{ inputShape: [28, 28], specs: [Flatten(), BN(), Dense(300), BN(), Dense(100), BN(), Dense(10)] }],
    slide: {
      total: 271346, trainable: 268978, nonTrainable: 2368,
      layers: [0, 3136, 235500, 1200, 30100, 400, 1010],
      shapes: [[784], [784], [300], [300], [100], [100], [10]],
    },
  },
  {
    id: 'l3-conv-200x5', lecture: 3, slides: [22], label: '200 filters of 5×5, stride 1, "same", on 150×100 RGB: (5×5×3 + 1) × 200',
    stacks: [{ inputShape: [150, 100, 3], specs: [Conv2D(200, 5, { strides: 1, padding: 'same' })] }],
    slide: { total: 15200 },
  },
  {
    id: 'l3-dense-675m', lecture: 3, slides: [22], label: 'footnote 5: fully connected 150×100 neurons on 150×100×3 inputs = 675 million (weights only)',
    stacks: [{ inputShape: [150 * 100 * 3], specs: [Dense(150 * 100, { useBias: false })] }],
    slide: { total: 675_000_000 },
  },
  {
    id: 'l3-fashion-cnn', lecture: 3, slides: [35], label: 'Fashion-MNIST CNN (slide prints no total)',
    stacks: [{
      inputShape: [28, 28, 1],
      specs: [
        Conv2D(64, 7, { padding: 'same' }), MaxPool(),
        Conv2D(128, 3, { padding: 'same' }), Conv2D(128, 3, { padding: 'same' }), MaxPool(),
        Conv2D(256, 3, { padding: 'same' }), Conv2D(256, 3, { padding: 'same' }), MaxPool(),
        Flatten(), Dense(128), Dropout(0.5), Dense(64), Dropout(0.5), Dense(10),
      ],
    }],
    slide: null,
  },
  {
    id: 'l3-lenet5', lecture: 3, slides: [37], label: 'LeNet-5 map sizes (C1 28×28, S2 14×14, C3 10×10, S4 5×5, C5 1×1)',
    stacks: [{
      inputShape: [32, 32, 1],
      specs: [Conv2D(6, 5), AvgPool(2, { strides: 2 }), Conv2D(16, 5), AvgPool(2, { strides: 2 }), Conv2D(120, 5), Flatten(), Dense(84), Dense(10)],
    }],
    slide: { shapes: [[28, 28, 6], [14, 14, 6], [10, 10, 16], [5, 5, 16], [1, 1, 120], undefined, [84], [10]] },
    shapesOnly: true,
  },
  {
    id: 'l4-rnn1', lecture: 4, slides: [25], label: 'SimpleRNN(1) on [None, 1]: "the whole model only has 3 parameters"',
    stacks: [{ inputShape: [null, 1], specs: [SimpleRNN(1)] }],
    slide: { total: 3, trainable: 3, nonTrainable: 0, layers: [3], shapes: [[1]] },
  },
  {
    id: 'l4-univar', lecture: 4, slides: [27], label: 'univar_model: SimpleRNN(32) + Dense(1)',
    stacks: [{ inputShape: [null, 1], specs: [SimpleRNN(32), Dense(1)] }],
    slide: { total: 1121, trainable: 1121, nonTrainable: 0, layers: [1088, 33], shapes: [[32], [1]] },
  },
  {
    id: 'l4-rnn20', lecture: 4, slides: [], label: 'SimpleRNN(20) + Dense(1) (build brief check value, not on a slide)',
    stacks: [{ inputShape: [null, 1], specs: [SimpleRNN(20), Dense(1)] }],
    slide: null, expect: 461,
  },
  {
    id: 'l4-lstm', lecture: 4, slides: [43], label: 'lstm_model: LSTM(12) + Dense(1)',
    stacks: [{ inputShape: [null, 1], specs: [LSTM(12), Dense(1)] }],
    slide: { total: 685 },
  },
  {
    id: 'l4-gru', lecture: 4, slides: [49], label: 'gru_model: GRU(20) + Dense(1) (Keras default reset_after=True)',
    stacks: [{ inputShape: [null, 1], specs: [GRU(20), Dense(1)] }],
    slide: { total: 1401 },
  },
  {
    id: 'l4-gru-one-bias', lecture: 4, slides: [49], label: "the slide's equations (one bias per gate = reset_after=False) give a different count",
    stacks: [{ inputShape: [null, 1], specs: [GRU(20, { resetAfter: false }), Dense(1)] }],
    slide: null, expect: 1341,
  },
  {
    id: 'l4-cnn-gru', lecture: 4, slides: [50], label: 'cnn_gru_model: Conv1D(8,3) + Conv1D(16,3,s2) + GRU(10) + Dense(1)',
    stacks: [{ inputShape: [null, 1], specs: cnnGru }],
    slide: { total: 1283, layers: [32, 400, 840, 11], shapes: [[null, 8], [null, 16], [10], [1]] },
  },
  {
    id: 'l4-cnn-gru-56', lecture: 4, slides: [50, 20], label: 'cnn_gru_model on the 56-step windows (lengths 56 → 54 → 26, transcript quirks)',
    stacks: [{ inputShape: [56, 1], specs: cnnGru }],
    slide: { total: 1283, shapes: [[54, 8], [26, 16], [10], [1]] },
  },
  {
    id: 'l5-stacked-ae', lecture: 5, slides: [12], label: 'stacked_ae: 163,814 trainable parameters',
    stacks: [{ inputShape: [28, 28], specs: [Flatten(), Dense(100), Dense(30), Dense(100), Dense(28 * 28), Reshape([28, 28])] }],
    slide: { total: 163814, trainable: 163814, layers: [0, 78500, 3030, 3100, 79184, 0] },
  },
  {
    id: 'l5-tied-ae', lecture: 5, slides: [20, 21], label: 'tied_ae: 82,414 trainable parameters (DenseTranspose = biases only)',
    stacks: [{ inputShape: [28, 28], specs: [Flatten(), Dense(100), Dense(30), DenseT(100), DenseT(784), Reshape([28, 28])] }],
    slide: { total: 82414, trainable: 82414, layers: [0, 78500, 3030, 100, 784, 0], shapes: [[784], [100], [30], [100], [784], [28, 28]] },
  },
  {
    id: 'l67-conv-encoder', lecture: 6, slides: [5], label: 'conv_encoder output shapes (the # comments)',
    stacks: [{ inputShape: [28, 28], specs: convEncoder }],
    slide: { shapes: [[28, 28, 1], [28, 28, 16], [14, 14, 16], [14, 14, 32], [7, 7, 32], [7, 7, 64], [3, 3, 64], [3, 3, 30], [30]] },
  },
  {
    id: 'l67-conv-decoder', lecture: 6, slides: [5, 6], label: 'conv_decoder.summary()',
    stacks: [{ inputShape: [30], specs: convDecoder }],
    slide: {
      total: 13873, trainable: 13873, nonTrainable: 0,
      layers: [4464, 0, 4640, 4624, 145, 0],
      shapes: [[144], [3, 3, 16], [7, 7, 32], [14, 14, 16], [28, 28, 1], [28, 28]],
    },
  },
  {
    id: 'l67-conv-ae', lecture: 6, slides: [5, 6], label: 'conv_ae.count_params()',
    stacks: [{ inputShape: [28, 28], specs: [...convEncoder, ...convDecoder] }],
    slide: { total: 54479 },
  },
  {
    id: 'l8-simple-birnn', lecture: 8, slides: [9], label: 'simple_biRNN: Bidirectional(SimpleRNN(16)) on [None, 2] + Dense(2): "# 674 trainable params"',
    stacks: [{ inputShape: [null, 2], specs: [Bi(SimpleRNN(16)), Dense(2)] }],
    slide: { total: 674, trainable: 674 },
  },
  {
    id: 'l8-rnn-ed', lecture: 8, slides: [14], label: 'rnn_ed: Bidirectional(SimpleRNN(16)) encoder + SimpleRNN(32) decoder + Dense(2) (slide prints no count)',
    stacks: [
      { inputShape: [null, 2], specs: [Bi(SimpleRNN(16))] },
      { inputShape: [null, 2], specs: [SimpleRNN(32, { returnSequences: true }), Dense(2)] },
    ],
    slide: null,
  },
  {
    id: 'l8-vit-patch', lecture: 8, slides: [46], label: 'ViT: a 16×16 RGB patch flattens to 16 × 16 × 3 = 768',
    stacks: [{ inputShape: [16, 16, 3], specs: [Flatten()] }],
    slide: { shapes: [[768]] },
  },
];

console.log('\nSlide anchors (printed · Keras · JS):');
let anchorsOk = 0;
let recorded = 0;
for (const a of ANCHORS) {
  const keras = kerasAnchors[a.id];
  const cite = `L${a.lecture}${a.slides.length ? ` s${a.slides.join('/')}` : ''}`;
  let bad = false;
  const problems = [];
  if (!keras) {
    problems.push('no Keras anchor model with this id in keras-truth.json');
    bad = true;
  }

  const walks = a.stacks.map((st) => modelParams(st.specs, st.inputShape));
  const js = {
    total: walks.reduce((s, w) => s + w.total, 0),
    trainable: walks.reduce((s, w) => s + w.trainable, 0),
    nonTrainable: walks.reduce((s, w) => s + w.nonTrainable, 0),
  };
  const rows = walks.flatMap((w) => w.layers);
  const shapeRows = a.stacks.flatMap((st) => modelShapes(st.specs, st.inputShape));

  // JS must reproduce Keras (totals, and per-layer where Keras lists plain layers)
  if (keras && !a.shapesOnly) {
    for (const key of ['total', 'trainable', 'nonTrainable']) {
      if (js[key] !== keras[key]) { problems.push(`${key}: js ${fmt(js[key])} ≠ keras ${fmt(keras[key])}`); bad = true; }
    }
  }
  if (keras && a.stacks.length === 1 && keras.layers.length === rows.length) {
    keras.layers.forEach((kl, i) => {
      if (kl.params !== rows[i].total) { problems.push(`layer ${i} (${kl.class}): js ${fmt(rows[i].total)} ≠ keras ${fmt(kl.params)}`); bad = true; }
      if (kl.out && !same(kl.out, shapeRows[i].out)) { problems.push(`layer ${i} shape: js ${fmtShape(shapeRows[i].out)} ≠ keras ${fmtShape(kl.out)}`); bad = true; }
    });
  }
  if (a.expect != null && js.total !== a.expect) { problems.push(`expected ${fmt(a.expect)}, js ${fmt(js.total)}`); bad = true; }

  // The slide's printed numbers: JS must match them unless the slide itself disagrees with Keras.
  const notes = [];
  if (a.slide) {
    for (const key of ['total', 'trainable', 'nonTrainable']) {
      if (a.slide[key] == null) continue;
      if (keras && a.slide[key] !== keras[key]) {
        notes.push(`slide ${key} ${fmt(a.slide[key])} vs keras ${fmt(keras[key])} — recorded, not fixed`);
        recorded += 1;
      } else if (a.slide[key] !== js[key]) { problems.push(`slide ${key} ${fmt(a.slide[key])} ≠ js ${fmt(js[key])}`); bad = true; }
    }
    (a.slide.layers ?? []).forEach((v, i) => {
      if (v != null && rows[i].total !== v) { problems.push(`slide layer ${i} Param # ${fmt(v)} ≠ js ${fmt(rows[i].total)}`); bad = true; }
    });
    (a.slide.shapes ?? []).forEach((v, i) => {
      if (v && !same(shapeRows[i].out, v)) { problems.push(`slide layer ${i} Output Shape ${fmtShape(v)} ≠ js ${fmtShape(shapeRows[i].out)}`); bad = true; }
    });
  }

  const printed = a.slide?.total != null ? fmt(a.slide.total) : a.slide?.shapes ? 'shapes' : '—';
  const line = `  ${bad ? 'BAD' : 'ok '} ${cite.padEnd(12)} ${printed.padStart(11)} · ${fmt(keras?.total).padStart(11)} · ${fmt(js.total).padStart(11)}  ${a.label}`;
  console.log(line);
  for (const n of notes) console.log(`        note: ${n}`);
  if (bad) failures.push(...problems.map((p) => `${a.id} (${cite}): ${p}`));
  else anchorsOk += 1;
}

// A couple of direct-formula anchors that are not models.
const direct = [
  ['L3 s22', '(5×5×3 + 1) × 200', layerParams(Conv2D(200, 5, { padding: 'same', inputShape: [150, 100, 3] })).total, 15200],
  ['L3 s22', '150² × 100² × 3 (dense, no bias)', denseParams(150 * 100 * 3, 150 * 100, false), 675_000_000],
  ['L8 s46', '16 × 16 × 3', layerShape(Flatten(), [16, 16, 3])[0], 768],
  ['L4 s49', 'GRU(20) on 1 input, reset_after=True: 3·(20·1 + 20·20 + 2·20)', layerParams(GRU(20, { inputShape: [null, 1] })).total, 1380],
  ['L4 s49', 'GRU(20) on 1 input, one bias per gate: 3·(20·1 + 20·20 + 20)', layerParams(GRU(20, { resetAfter: false, inputShape: [null, 1] })).total, 1320],
  ['L2 s27', 'BatchNormalization on 784: 2·784 non-trainable (moving mean + variance)', layerParams({ ...BN(), inputShape: [784] }).nonTrainable, 1568],
  ['L4 s50', 'Conv1D "valid" k=3 s=2 on 54 → ⌊(54−3)/2⌋+1', layerShape(Conv1D(16, 3, { strides: 2 }), [54, 8])[0], 26],
  ['L6–7 s6', 'Conv2DTranspose "valid" k=3 s=2 on 3 → 3·2 + max(3−2, 0)', layerShape(ConvT(32, 3, { strides: 2 }), [3, 3, 16])[0], 7],
  ['L6–7 s6', 'Conv2DTranspose "same" k=3 s=2 on 7 → 7·2', layerShape(ConvT(16, 3, { strides: 2, padding: 'same' }), [7, 7, 32])[0], 14],
  ['print', 'fmtShape([null, 28, 28, 1])', fmtShape([null, 28, 28, 1]), '(None, None, 28, 28, 1)'],
  ['print', 'fmtShape([28, 28, 1])', fmtShape([28, 28, 1]), '(None, 28, 28, 1)'],
];
console.log('\nFormula spot checks:');
let spotOk = 0;
for (const [cite, label, got, want] of direct) {
  const ok = got === want;
  if (ok) spotOk += 1;
  else fail(`${cite} ${label}: got ${got}, want ${want}`);
  console.log(`  ${ok ? 'ok ' : 'BAD'} ${cite.padEnd(9)} ${label} = ${typeof got === 'number' ? fmt(got) : got}`);
}

// ── verdict ────────────────────────────────────────────────────────────────
const pct = ((nConfigsOk / configs.length) * 100).toFixed(1);
console.log(`\nConfigs ${nConfigsOk}/${configs.length} (${pct} %) · anchors ${anchorsOk}/${ANCHORS.length} · spot checks ${spotOk}/${direct.length} · slide-vs-Keras disagreements recorded: ${recorded}`);
if (failures.length) {
  console.log(`\n${failures.length} mismatch(es); first ${Math.min(20, failures.length)}:`);
  for (const f of failures.slice(0, 20)) console.log(`  - ${f}`);
  process.exit(1);
}
console.log('RESULT: 100 % — every Keras count and shape reproduced, every slide anchor holds.');
