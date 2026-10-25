import { traceShapes, showShape } from '../../maths/shapeRules.js';
import { layerName } from '../../maths/paramRules.js';
import { MODELS } from '../../maths/models.js';
import { shapeRule } from './shapeText.js';

/* ============================================================================
   TOPIC 2 · THE EXAM DRILL: SHAPES
   ----------------------------------------------------------------------------
   make(seed) — one of three kinds, seeded:
     trace     generated Keras code (a CNN or a recurrent model) → every
               layer's output shape, batch as None (the models are exported
               to verify_counts.py, which checks every shape in Keras)
     scenario  a story → the shapes of X and y
     axes      a tuple from the slides → what each axis counts
   Shapes are typed as tuples: spaces, brackets and case don't matter.
   FIXED = questions from the unit, with receipts.
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

// generated Keras code for a sequential model (labelled "generated")
const P = 'tf.keras.layers.';
function codeLine(L) {
  const k = Array.isArray(L.k) ? `(${L.k.join(', ')})` : L.k;
  switch (L.t) {
    case 'conv2d': return `${P}Conv2D(${L.filters}, kernel_size=${k}${L.s && L.s !== 1 ? `, strides=${L.s}` : ''}${L.pad === 'same' ? ', padding="same"' : ''}, activation="relu")`;
    case 'conv1d': return `${P}Conv1D(filters=${L.filters}, kernel_size=${L.k}${L.s && L.s !== 1 ? `, strides=${L.s}` : ''}${L.pad === 'same' ? ', padding="same"' : ''}, activation="relu")`;
    case 'maxpool2d': return `${P}MaxPool2D(${L.p && L.p !== 2 ? `pool_size=${L.p}` : ''})`;
    case 'gap2d': return `${P}GlobalAvgPool2D()`;
    case 'flatten': return `${P}Flatten()`;
    case 'dense': return `${P}Dense(${L.units})`;
    case 'dropout': return `${P}Dropout(${L.rate ?? 0.5})`;
    case 'simplernn': return `${P}SimpleRNN(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    case 'lstm': return `${P}LSTM(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    case 'gru': return `${P}GRU(${L.units}${L.seq ? ', return_sequences=True' : ''})`;
    default: return `${P}${layerName(L)}`;
  }
}
export function codeFor(model) {
  return ['model = tf.keras.Sequential([', `    ${P}InputLayer(shape=[${model.input.join(', ')}]),`, ...model.layers.map((L, i) => `    ${codeLine(L)}${i < model.layers.length - 1 ? ',' : ''}`), '])'].join('\n');
}

function genCNN(r) {
  const s = pick(r, [28, 32, 64, 16]);
  const layers = [];
  let side = s;
  const blocks = 2;
  for (let b = 0; b < blocks; b++) {
    const k = pick(r, [3, 3, 5]);
    const pad = r() < 0.55 ? 'same' : 'valid';
    const st = b === 0 && r() < 0.3 ? 2 : 1;
    if (pad === 'valid' && side - k < 3) break;
    layers.push({ t: 'conv2d', filters: pick(r, [16, 32, 64]), k, pad, ...(st > 1 ? { s: st } : {}) });
    side = pad === 'same' ? Math.ceil(side / st) : Math.floor((side - k) / st) + 1;
    if (side >= 4) {
      layers.push({ t: 'maxpool2d' });
      side = Math.floor(side / 2);
    }
  }
  layers.push(r() < 0.5 ? { t: 'flatten' } : { t: 'gap2d' });
  layers.push({ t: 'dense', units: pick(r, [10, 5, 1]) });
  return { input: [s, s, pick(r, [1, 3])], layers };
}

function genRNN(r) {
  const T = pick(r, [10, 20, 50, 56, 30]);
  const d = pick(r, [1, 2, 3, 5]);
  const t = pick(r, ['simplernn', 'lstm', 'gru']);
  const layers = [];
  if (r() < 0.4) layers.push({ t: 'conv1d', filters: pick(r, [8, 16]), k: 3, ...(r() < 0.5 ? { s: 2 } : {}) });
  if (r() < 0.6) layers.push({ t, units: pick(r, [16, 32]), seq: true });
  layers.push({ t, units: pick(r, [8, 16, 32]) });
  layers.push({ t: 'dense', units: pick(r, [1, 2, 14]) });
  return { input: [T, d], layers };
}

function trace(seed, r) {
  const model = r() < 0.55 ? genCNN(r) : genRNN(r);
  const rows = traceShapes(model);
  return {
    id: `t${seed}`,
    prov: '{own}',
    prompt: 'Give the output shape of every layer of this model (write the batch axis as None).',
    show: { code: codeFor(model) },
    model,
    fieldHead: 'Layer',
    fields: rows.map((row) => ({ key: `l${row.i}`, label: `\`${layerName(row.L)}\``, answer: showShape(row.out), type: 'text', placeholder: '(None, …)', width: '12rem' })),
    working: [`Input: \`${showShape(model.input)}\` (the batch axis is added as None) {s|L1 · slide 36}.`, ...rows.map((row) => `\`${layerName(row.L)}\` → \`${showShape(row.out)}\`: ${shapeRule(row.L, row.ins, row.out)}`)],
  };
}

const STORIES = [
  (r) => { const n = pick(r, [500, 1000, 'N']); const h = pick(r, [24, 48]); return { s: `${n === 'N' ? 'Many' : n} windows of hourly readings from 3 sensors, ${h} hours each, are used to predict the next hour’s 3 readings.`, x: [n, h, 3], y: [n, 3] }; },
  (r) => { const n = pick(r, [32, 'N']); return { s: `${n === 'N' ? 'Sequences' : `A batch of ${n} sequences`} of 56 days of 5 numbers each (bus, rail and the next day type) are used to predict the next 14 days of rail riders.`, x: [n, 56, 5], y: [n, 14] }; },
  (r) => { const n = pick(r, [200, 'N']); const k = pick(r, [5, 6]); return { s: `${n === 'N' ? 'Polygons' : `${n} polygons`}: the 2D coordinates of the first ${k} corners are used to predict the next corner.`, x: [n, k, 2], y: [n, 2] }; },
  (r) => { const n = pick(r, [1000, 'N']); const w = pick(r, [20, 30]); return { s: `${n === 'N' ? 'Reviews' : `${n} reviews`} of ${w} words, each word a vector of 50 numbers, are classified as positive (1) or negative (0).`, x: [n, w, 50], y: [n] }; },
  (r) => { const n = pick(r, [60, 'N']); return { s: `${n === 'N' ? 'Validation sequences' : `${n} validation sequences`} of 4 noisy 2D vertices are labelled clockwise (1) or anticlockwise (0).`, x: [n, 4, 2], y: [n] }; },
];
const tup = (xs) => (xs.length === 1 ? `(${xs[0]},)` : `(${xs.join(', ')})`);

function scenario(seed, r) {
  const st = pick(r, STORIES)(r);
  const nWord = st.x[0] === 'N' ? 'N (the number of examples, not given)' : String(st.x[0]);
  return {
    id: `s${seed}`,
    prov: '{own}',
    prompt: `${st.s} What are the shapes of the training inputs X and targets y for a recurrent network?${st.x[0] === 'N' ? ' Write N for the number of examples.' : ''}`,
    fields: [
      { key: 'x', label: 'X', type: 'text', answer: tup(st.x), placeholder: '(…)', width: '10rem' },
      { key: 'y', label: 'y', type: 'text', answer: tup(st.y), accept: st.y.length === 1 ? [`(${st.y[0]}, 1)`] : [], placeholder: '(…)', width: '10rem' },
    ],
    working: [
      `Recurrent layers want 3D input [batch size, time steps, dimensionality] {s|L4 · slide 24}: X is ${tup(st.x)}: ${nWord} examples, ${st.x[1]} time steps, ${st.x[2]} numbers per step.`,
      st.y.length === 1 ? `One label per example: y is ${tup(st.y)} (like Lab Sheet 4’s \`(200, )\`) {s|Lab Sheet 4}.` : `${st.y[1]} numbers predicted per example: y is ${tup(st.y)} (like L4 slide 36’s \`(32, 14)\`) {s|L4 · slide 36}.`,
    ],
  };
}

const AXIS_OPTS = [
  { value: 'batch', label: 'batch: which example' },
  { value: 'h', label: 'height: rows' },
  { value: 'w', label: 'width: columns' },
  { value: 'c', label: 'channels / feature maps' },
  { value: 't', label: 'time steps' },
  { value: 'f', label: 'features (numbers per step or per example)' },
];
const TUPLES = [
  { code: 'images.shape', at: 'L3 · slide 17', shape: [2, 70, 120, 3], axes: ['batch', 'h', 'w', 'c'], ctx: 'two sample images, cropped' },
  { code: 'fmaps.shape', at: 'L3 · slide 18', shape: [2, 64, 114, 32], axes: ['batch', 'h', 'w', 'c'], ctx: 'after `Conv2D(filters=32, kernel_size=7)`' },
  { code: 'x.shape', at: 'L4 · slide 36', shape: [32, 56, 5], axes: ['batch', 't', 'f'], ctx: 'one mini-batch of the multivariate rail data' },
  { code: 'X_train.shape', at: 'L8 · slide 9', shape: [1027, 56, 2], axes: ['batch', 't', 'f'], ctx: '(bus, rail) pairs over 56 days' },
  { code: 'img.shape', at: 'L9 · slide 18', shape: [400, 600, 3], axes: ['h', 'w', 'c'], ctx: 'one rendered CartPole frame' },
  { code: 'xx.shape', at: 'L4 · slide 21', shape: [32, 56], axes: ['batch', 't'], ctx: 'one mini-batch of the univariate rail data' },
];

function axes(seed, r) {
  const T = pick(r, TUPLES);
  return {
    id: `a${seed}`,
    prov: `{s|${T.at}}`,
    prompt: `\`${T.code}\` is \`(${T.shape.join(', ')})\` for ${T.ctx}. What does each axis count?`,
    fieldHead: 'Axis',
    fields: T.shape.map((n, i) => ({ key: `a${i}`, label: `axis ${i}: ${n}`, type: 'choice', answer: T.axes[i], options: AXIS_OPTS })),
    working: [
      `${T.shape.map((n, i) => `${n} = ${AXIS_OPTS.find((o) => o.value === T.axes[i]).label}`).join('; ')} {s|${T.at}}.`,
      T.axes[0] === 'batch' ? 'The batch axis comes first {s|L3 · slide 16}.' : 'One image on its own: no batch axis {s|L3 · slide 16}.',
    ],
  };
}

export function make(seed) {
  const r = rng(seed);
  const kind = pick(r, ['trace', 'trace', 'scenario', 'axes']);
  return { trace, scenario, axes }[kind](seed, r);
}

/* ── from the unit ─────────────────────────────────────────────────────── */
const CNN = traceShapes(MODELS['l3-cnn'].model);
const AE = traceShapes(MODELS['l67-convae'].model);

export const FIXED = [
  {
    id: 'u-l3s18',
    title: 'From the unit · L3 slides 17–20',
    prov: '{s|L3 · slides 17–20}',
    prompt: '`images` has shape `[2, 70, 120, 3]`. What is `fmaps.shape` after `Conv2D(filters=32, kernel_size=7)`, and with `padding="same"`?',
    fields: [
      { key: 'v', label: 'default (`"valid"`)', type: 'text', answer: '(2, 64, 114, 32)', width: '12rem' },
      { key: 's', label: '`padding="same"`', type: 'text', answer: '(2, 70, 120, 32)', width: '12rem' },
    ],
    working: [
      '`TensorShape([2, 64, 114, 32])` {s|L3 · slide 18}: 6 fewer rows and columns (the kernel is 7 wide), and the last axis is the 32 filters.',
      '`TensorShape([2, 70, 120, 32])` {s|L3 · slide 20}: “same” keeps height and width at stride 1.',
    ],
  },
  {
    id: 'u-l3s31',
    title: 'From the unit · L3 slide 31',
    prov: '{s|L3 · slide 31}',
    prompt: '`GlobalAvgPool2D()` is applied to `images` of shape (2, 70, 120, 3). What shape comes out?',
    fields: [{ key: 'g', label: 'output', type: 'text', answer: '(2, 3)', width: '10rem' }],
    working: ['Each feature map is averaged to one number: (2, 70, 120, 3) → shape=(2, 3) {s|L3 · slide 31}.'],
  },
  {
    id: 'u-l3s35',
    title: 'From the unit · L3 slide 35',
    prov: '{s|L3 · slide 35} {own}',
    prompt: 'In slide 35’s CNN (28 × 28 × 1 in, `MaxPool2D()` three times), what comes out of the third `MaxPool2D()`, and out of `Flatten()`?',
    fields: [
      { key: 'p', label: 'third MaxPool2D', type: 'text', answer: showShape(CNN[7].out), width: '12rem' },
      { key: 'f', label: 'Flatten', type: 'text', answer: showShape(CNN[8].out), width: '12rem' },
    ],
    working: [`28 → 14 → 7 → 3: \`MaxPool2D()\` halves and rounds down (7 ÷ 2 → 3) {s|L3 · slide 28} {own}.`, `Flatten: $3 \\times 3 \\times 256 = 2{,}304$ {own}.`],
  },
  {
    id: 'u-l67s5',
    title: 'From the unit · L6–7 slide 5',
    prov: '{s|L6–7 · slide 5}',
    prompt: 'The conv autoencoder’s encoder takes 28 × 28 × 1 images through three `Conv2D(…, padding="same")` + `MaxPool2D(pool_size=2)` blocks (16, 32, 64 filters). What comes out of each pool?',
    fields: [2, 4, 6].map((i, j) => ({ key: `p${j}`, label: `pool ${j + 1}`, type: 'text', answer: showShape(AE[i].out), width: '12rem' })),
    working: ['Slide 5’s comments: 14 × 14 × 16, 7 × 7 × 32, 3 × 3 × 64 {s|L6–7 · slide 5}.'],
  },
  {
    id: 'u-q2a',
    title: 'From the unit · sample Q2(a)',
    prov: '{s|Sample Q2(a)}',
    prompt: 'An RNN is given the 2D coordinates of a hand-sketched star’s first 4 corners and predicts the last corner. What are the shapes of X and y in the training set? (Write N for the number of stars.)',
    fields: [
      { key: 'x', label: 'X', type: 'text', answer: '(N, 4, 2)', width: '10rem' },
      { key: 'y', label: 'y', type: 'text', answer: '(N, 2)', width: '10rem' },
    ],
    working: ['X: N stars × 4 corners (time steps) × 2 coordinates; y: the last corner’s (x, y) for each star {s|L4 · slides 11, 24} (Exam Practice’s answer).'],
  },
  {
    id: 'u-ls4',
    title: 'From the unit · Lab Sheet 4, task 3',
    prov: '{s|Lab Sheet 4}',
    prompt: '`X_train` holds 200 sequences of 4 noisy 2D vertices. Task 3 predicts the 4th vertex from the first three. What are the shapes of the input and the output?',
    fields: [
      { key: 'x', label: '`X_train[:, :3, :]`', type: 'text', answer: '(200, 3, 2)', width: '10rem' },
      { key: 'y', label: '`X_train[:, 3, :]`', type: 'text', answer: '(200, 2)', width: '10rem' },
    ],
    working: ['“the input should be `X_train[:, :3, :]` (whose shape is (200, 3, 2)) and the output should be `X_train[:, 3, :]` (whose shape is (200, 2))” {s|Lab Sheet 4}.'],
  },
];
