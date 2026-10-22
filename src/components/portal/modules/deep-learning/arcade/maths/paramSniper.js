/* ============================================================================
   PARAM SNIPER — QUESTION GENERATOR (pure, seeded)
   ----------------------------------------------------------------------------
   makeItems(rand, level) → the round's items, in a ramp:
     level 1  single layers, 4 choices, parameter counts only
     level 2  single layers and two-layer stacks on the keypad, plus output
              shapes; every slide-covered layer type
     level 3  the slides' own models (printed totals, trainable vs
              non-trainable), three-layer stacks, tied decoders, bidirectional
   Counts and shapes come from maths/params.js and maths/shapes.js (verified
   against real Keras by tools/dl-arcade/check-maths.mjs); every item cites
   the slide where the rule or the number is printed (content/param-sniper.js).
   ========================================================================== */
import { layerParams, modelParams } from './params.js';
import { layerShape } from './shapes.js';
import { RULES, SHAPE_RULES, SLIDE_MODELS } from '../content/param-sniper.js';

const fmt = (n) => Math.round(n).toLocaleString('en-AU');
export const fmtShape = (shape) => `(${['None', ...shape.map((d) => (d == null ? 'None' : d))].join(', ')})`;
const pair = (v) => (Array.isArray(v) ? v : [v, v]);

/* ── rendering a spec as the slides' Keras code ──────────────────────── */
export function specLine(spec) {
  const pad = spec.padding ? `, padding="${spec.padding}"` : '';
  const st = spec.strides && spec.strides !== 1 ? `, strides=${spec.strides}` : '';
  const k = (v) => (Array.isArray(v) ? `(${v[0]}, ${v[1]})` : v);
  switch (spec.type) {
    case 'Dense': return `Dense(${spec.units}${spec.useBias === false ? ', use_bias=False' : ''})`;
    case 'Conv2D': return `Conv2D(${spec.filters}, kernel_size=${k(spec.kernel)}${st}${pad || ', padding="valid"'})`;
    case 'Conv2DTranspose': return `Conv2DTranspose(${spec.filters}, kernel_size=${k(spec.kernel)}${st}${pad || ', padding="valid"'})`;
    case 'Conv1D': return `Conv1D(${spec.filters}, kernel_size=${spec.kernel}${st}${pad || ', padding="valid"'})`;
    case 'MaxPool2D': return `MaxPool2D(pool_size=${k(spec.pool)}${spec.strides && spec.strides !== spec.pool ? `, strides=${spec.strides}` : ''})`;
    case 'AvgPool2D': return `AvgPool2D(pool_size=${k(spec.pool)})`;
    case 'GlobalAvgPool2D': return 'GlobalAvgPool2D()';
    case 'Flatten': return 'Flatten()';
    case 'Reshape': return `Reshape(${JSON.stringify(spec.target).replace(/,/g, ', ')})`;
    case 'BatchNormalization': return 'BatchNormalization()';
    case 'Dropout': return `Dropout(${spec.rate})`;
    case 'SimpleRNN': case 'LSTM': case 'GRU':
      return `${spec.type}(${spec.units}${spec.returnSequences ? ', return_sequences=True' : ''})`;
    case 'Bidirectional': return `Bidirectional(${specLine(spec.layer)})`;
    case 'DenseTranspose': return 'DenseTranspose(dense)  # kernel reused, transposed';
    case 'MultiHeadAttention': return `MultiHeadAttention(num_heads=${spec.heads}, key_dim=${spec.keyDim})`;
    default: return spec.type;
  }
}
export const inputLine = (shape) => `Input(shape=${fmtShapeIn(shape)})`;
const fmtShapeIn = (shape) => `[${shape.map((d) => (d == null ? 'None' : d)).join(', ')}]`;

/* ── the arithmetic in words (the why card) ──────────────────────────── */
function howParams(spec, nIn, counts) {
  const R = RULES[spec.type];
  const total = counts.total;
  switch (spec.type) {
    case 'Dense':
      return `Dense(${spec.units}) on ${fmt(nIn)} inputs: weights (${fmt(nIn)}, ${spec.units}) and biases (${spec.units},), so ${fmt(nIn)} × ${spec.units}${spec.useBias === false ? '' : ` + ${spec.units}`} = ${fmt(total)}. ${R.rule}.`;
    case 'Conv2D': {
      const [kh, kw] = pair(spec.kernel);
      return `(${kh} × ${kw} × ${nIn} + 1) × ${spec.filters} = ${fmt(total)}: each of the ${spec.filters} filters has a ${kh} × ${kw} kernel per input channel plus one bias. The image size, stride and padding change nothing.`;
    }
    case 'Conv2DTranspose': {
      const [kh, kw] = pair(spec.kernel);
      return `Counted like a Conv2D: ${kh} × ${kw} × ${nIn} × ${spec.filters} + ${spec.filters} = ${fmt(total)}, as slide 6’s conv_decoder summary shows (e.g. 3 × 3 × 16 × 32 + 32 = 4,640).`;
    }
    case 'Conv1D':
      return `${spec.kernel} × ${nIn} × ${spec.filters} + ${spec.filters} = ${fmt(total)}: a kernel of ${spec.kernel} weights per input channel per filter, plus one bias per filter (the Conv2D rule with a 1-D kernel; slide 50 prints only the model total).`;
    case 'MaxPool2D': case 'AvgPool2D': case 'GlobalAvgPool2D':
      return `0. ${R.rule}.`;
    case 'Flatten':
      return `0. ${R.rule}.`;
    case 'Dropout':
      return `0. ${R.rule}.`;
    case 'BatchNormalization':
      return `4 × ${nIn} = ${fmt(total)}: γ, β, moving mean and moving variance, one of each per feature. Only γ and β (2 × ${nIn} = ${fmt(counts.trainable)}) are trainable; the moving mean and variance (${fmt(counts.nonTrainable)}) are not.`;
    case 'SimpleRNN':
      return `W_x (${nIn} × ${spec.units}) + W_h (${spec.units} × ${spec.units}) + b_h (${spec.units}): ${nIn} × ${spec.units} + ${spec.units} × ${spec.units} + ${spec.units} = ${fmt(total)}.`;
    case 'LSTM':
      return `Four FC layers (i, f, o, g), each with W_x (${nIn} × ${spec.units}), W_h (${spec.units} × ${spec.units}) and a bias: 4 × (${nIn} × ${spec.units} + ${spec.units} × ${spec.units} + ${spec.units}) = ${fmt(total)}.`;
    case 'GRU': {
      const one = 3 * (nIn * spec.units + spec.units * spec.units + spec.units);
      return `Three blocks (z, r, g). Keras’s default GRU (reset_after=True) keeps two bias vectors per block: 3 × (${nIn} × ${spec.units} + ${spec.units} × ${spec.units} + 2 × ${spec.units}) = ${fmt(total)}. Slide 49’s equations show one bias per block (${fmt(one)}); the slide’s printed 1,401 uses the Keras default.`;
    }
    case 'Bidirectional': {
      const inner = layerParams({ ...spec.layer, inputShape: [null, nIn] }).total;
      return `Two copies of ${specLine(spec.layer)} (forward and backward), each ${fmt(inner)}: 2 × ${fmt(inner)} = ${fmt(total)}.`;
    }
    case 'DenseTranspose':
      return `DenseTranspose(dense) reuses dense’s (${spec.tied.nIn}, ${spec.tied.units}) kernel transposed, so it maps ${spec.tied.units} → ${spec.tied.nIn} with no kernel of its own; its only trainable parameters are its ${spec.tied.nIn} biases: ${fmt(total)}.`;
    case 'MultiHeadAttention': {
      const { heads: H, keyDim: K } = spec;
      return `Query, key and value kernels [${nIn}, ${H}, ${K}] with biases [${H}, ${K}], plus an output kernel [${H}, ${K}, ${nIn}] with bias [${nIn}]: 3 × (${nIn} × ${H} × ${K} + ${H} × ${K}) + ${H} × ${K} × ${nIn} + ${nIn} = ${fmt(total)}. Keras’s weight layout; the slides use the layer but print no count.`;
    }
    default:
      return `${fmt(total)}.`;
  }
}

function howShape(spec, inShape, out) {
  const R = SHAPE_RULES[spec.type];
  switch (spec.type) {
    case 'Conv2D': {
      const [kh, kw] = pair(spec.kernel);
      const s = spec.strides ?? 1;
      if (spec.padding === 'same') return `"same" padding keeps ${s === 1 ? 'the input size' : `about 1/${s} of each side (⌈n / ${s}⌉, slide 21: 10 → 5)`} and there is one feature map per filter: ${fmtShape(out)}.`;
      return `"valid" padding: the ${kh} × ${kw} filter must fit inside, so each side loses ${kh - 1}: ${inShape[0]} − ${kh} + 1 = ${out[0]}, ${inShape[1]} − ${kw} + 1 = ${out[1]}; one map per filter → ${fmtShape(out)}. (Slide 18: 70 × 120 → 64 × 114.)`;
    }
    case 'MaxPool2D': case 'AvgPool2D':
      return `A ${pair(spec.pool)[0]} × ${pair(spec.pool)[1]} pooling window with stride ${pair(spec.strides ?? spec.pool)[0]} halves the height and width and leaves the depth: ${fmtShape(out)}.`;
    case 'GlobalAvgPool2D':
      return `Every one of the ${inShape[2]} feature maps is averaged to a single number: ${fmtShape(out)}.`;
    case 'Flatten':
      return `${inShape.join(' × ')} = ${fmt(out[0])} numbers in a row: ${fmtShape(out)}.`;
    case 'Dense':
      return `One output per neuron: ${fmtShape(out)}.`;
    case 'SimpleRNN': case 'LSTM': case 'GRU':
      return spec.returnSequences
        ? `return_sequences=True: one ${spec.units}-vector per time step, ${fmtShape(out)}.`
        : `Only the last time step’s output, ${spec.units} numbers: ${fmtShape(out)}.`;
    case 'Bidirectional':
      return `Forward and backward outputs concatenated: 2 × ${spec.layer.units} = ${out[out.length - 1]}: ${fmtShape(out)}.`;
    default:
      return `${fmtShape(out)}. ${R?.rule ?? ''}`;
  }
}

/* ── random specs ─────────────────────────────────────────────────────── */
const IMG_SIZES = [28, 32, 64, 96, 128, 224];
const CHANNELS = [1, 3, 8, 16, 32, 64];
const FILTERS = [8, 16, 32, 64, 128];
const UNITS = [8, 10, 16, 20, 32, 50, 64, 100, 128, 300];
const KERNELS = [3, 5, 7];

function randomSingle(rand, type) {
  switch (type) {
    case 'Dense': {
      const nIn = rand.pick([8, 16, 30, 32, 50, 64, 100, 128, 300, 784]);
      return { spec: { type, units: rand.pick(UNITS) }, inputShape: [nIn] };
    }
    case 'Conv2D': {
      const n = rand.pick(IMG_SIZES);
      return { spec: { type, filters: rand.pick(FILTERS), kernel: rand.pick(KERNELS), strides: 1, padding: rand.pick(['valid', 'same']) }, inputShape: [n, n, rand.pick(CHANNELS)] };
    }
    case 'Conv2DTranspose': {
      const n = rand.pick([3, 7, 14]);
      return { spec: { type, filters: rand.pick([1, 16, 32, 64]), kernel: 3, strides: 2, padding: rand.pick(['valid', 'same']) }, inputShape: [n, n, rand.pick([16, 32, 64])] };
    }
    case 'Conv1D': {
      return { spec: { type, filters: rand.pick([8, 16, 32]), kernel: rand.pick([2, 3, 4, 5]), strides: rand.pick([1, 2]) }, inputShape: [null, rand.pick([1, 2, 5, 8, 16])] };
    }
    case 'MaxPool2D': case 'AvgPool2D': {
      const n = rand.pick([28, 32, 64, 128]);
      return { spec: { type, pool: 2 }, inputShape: [n, n, rand.pick([16, 32, 64, 128])] };
    }
    case 'GlobalAvgPool2D': {
      const n = rand.pick([3, 7, 14]);
      return { spec: { type }, inputShape: [n, n, rand.pick([30, 64, 128, 256])] };
    }
    case 'Flatten': {
      const n = rand.pick([7, 14, 28]);
      return { spec: { type }, inputShape: rand.chance(0.5) ? [n, n] : [n, n, rand.pick([1, 16, 64])] };
    }
    case 'BatchNormalization':
      return { spec: { type }, inputShape: [rand.pick([10, 32, 64, 100, 128, 300, 784])] };
    case 'SimpleRNN': case 'LSTM': case 'GRU':
      return { spec: { type, units: rand.pick(type === 'SimpleRNN' ? [1, 8, 10, 16, 20, 32, 64] : [8, 10, 12, 16, 20, 32, 64]) }, inputShape: [null, rand.pick([1, 2, 5, 8, 16, 32])] };
    case 'Bidirectional':
      return { spec: { type, layer: { type: rand.pick(['SimpleRNN', 'LSTM', 'GRU']), units: rand.pick([8, 16, 32]) } }, inputShape: [null, rand.pick([1, 2, 5])] };
    case 'DenseTranspose': {
      // the tied pair: dense = Dense(B) on A inputs; DenseTranspose(dense) maps B → A
      const [A, B] = rand.pick([[784, 100], [100, 30], [784, 300], [300, 100], [256, 64], [64, 16]]);
      return { spec: { type, units: A, tied: { nIn: A, units: B } }, inputShape: [B] };
    }
    case 'MultiHeadAttention': {
      return { spec: { type, heads: rand.pick([1, 2, 4, 8]), keyDim: rand.pick([4, 8, 16, 32]) }, inputShape: [null, rand.pick([16, 32, 64, 128])] };
    }
    default:
      return { spec: { type }, inputShape: [16] };
  }
}

// plausible wrong counts for the 4-choice level
function distractors(rand, spec, nIn, answer) {
  const u = spec.units;
  const cands = new Set();
  const add = (v) => { if (Number.isFinite(v) && v > 0 && v !== answer) cands.add(Math.round(v)); };
  switch (spec.type) {
    case 'Dense': add(nIn * u); add(nIn * u + nIn); add((nIn + 1) * (u + 1)); add(nIn * u + 2 * u); break;
    case 'Conv2D': case 'Conv2DTranspose': {
      const [kh, kw] = pair(spec.kernel);
      add(kh * kw * nIn * spec.filters); add((kh * kw + 1) * spec.filters); add(kh * kw * spec.filters + nIn); add(kh * kw * nIn * spec.filters + nIn); break;
    }
    case 'Conv1D': add(spec.kernel * nIn * spec.filters); add((spec.kernel + 1) * spec.filters); add(spec.kernel * spec.filters + spec.filters); break;
    case 'BatchNormalization': add(2 * nIn); add(3 * nIn); add(nIn); add(8 * nIn); break;
    case 'SimpleRNN': add(nIn * u + u); add(nIn * u + u * u); add(2 * (nIn * u + u * u + u)); add(u * u + u); break;
    case 'LSTM': add(3 * (nIn * u + u * u + u)); add(nIn * u + u * u + u); add(4 * (nIn * u + u * u)); add(4 * (nIn * u + u * u + 2 * u)); break;
    case 'GRU': add(3 * (nIn * u + u * u + u)); add(4 * (nIn * u + u * u + u)); add(nIn * u + u * u + u); add(3 * (nIn * u + u * u)); break;
    case 'MaxPool2D': case 'AvgPool2D': case 'GlobalAvgPool2D': case 'Flatten': case 'Dropout': {
      const [h, w, c] = [nIn, nIn, nIn];
      add(4); add(c); add(h * w); add(2 * c + 1); add(9); break;
    }
    default: add(answer * 2); add(answer + 1); add(Math.floor(answer / 2)); break;
  }
  // top up with near misses
  let guard = 0;
  while (cands.size < 3 && guard++ < 20) add(answer + rand.pick([-2, -1, 1, 2, 10, -10]) * rand.pick([1, 1, u ?? 1]));
  return rand.shuffle([...cands]).slice(0, 3);
}

/* ── item builders ───────────────────────────────────────────────────── */
let counter = 0;
const nextId = (p) => `${p}-${counter++}`;

function singleItem(rand, type, { choice = false, ask = 'total' } = {}) {
  const { spec, inputShape } = randomSingle(rand, type);
  const full = { ...spec, inputShape };
  const counts = layerParams(full);
  const nIn = inputShape[inputShape.length - 1];
  const R = RULES[type];
  const answer = ask === 'trainable' ? counts.trainable : ask === 'nonTrainable' ? counts.nonTrainable : counts.total;
  const q = ask === 'trainable' ? 'Trainable params?' : ask === 'nonTrainable' ? 'Non-trainable params?' : 'Param #?';
  const lines = spec.type === 'DenseTranspose'
    ? [inputLine([spec.tied.nIn]), `dense = Dense(${spec.tied.units})  # kernel (${spec.tied.nIn}, ${spec.tied.units})`, specLine(spec)]
    : [inputLine(inputShape), specLine(spec)];
  const base = {
    id: nextId(type),
    concept: R.concept,
    src: R.src,
    beyond: R.beyond || undefined,
    lines,
    question: spec.type === 'DenseTranspose' ? 'Param # of the DenseTranspose layer?' : q,
    ask,
    promptText: spec.type === 'DenseTranspose' ? `DenseTranspose of Dense(${spec.tied.units}) on ${spec.tied.nIn} inputs · ${q}` : `${specLine(spec)} on ${fmtShapeIn(inputShape)} · ${q}`,
    why: howParams(spec, nIn, counts),
    answer,
    unit: '',
  };
  if (choice) {
    const wrong = distractors(rand, spec, nIn, answer);
    const choices = rand.shuffle([answer, ...wrong]).map((v) => ({ value: v, label: fmt(v) }));
    return { ...base, kind: 'choice', choices };
  }
  return { ...base, kind: 'number' };
}

function shapeItem(rand, type) {
  const { spec, inputShape } = randomSingle(rand, type);
  if ((type === 'SimpleRNN' || type === 'LSTM' || type === 'GRU') && rand.chance(0.4)) spec.returnSequences = true;
  const out = layerShape({ ...spec, inputShape }, inputShape);
  const R = SHAPE_RULES[type];
  return {
    id: nextId(`${type}-shape`),
    concept: R.concept,
    src: R.src,
    kind: 'shape',
    lines: [inputLine(inputShape), specLine(spec)],
    question: 'Output shape?',
    ask: 'shape',
    promptText: `${specLine(spec)} on ${fmtShapeIn(inputShape)} · output shape`,
    answer: out,
    slots: out.length,
    why: howShape(spec, inputShape, out),
    format: (v) => (Array.isArray(v) ? fmtShape(v) : String(v)),
  };
}

function stackItem(rand, types, { ask = 'total' } = {}) {
  // a random stack of 2–3 layers that chain sensibly
  const first = randomSingle(rand, types[0]);
  const specs = [first.spec];
  let shape = layerShape({ ...first.spec, inputShape: first.inputShape }, first.inputShape);
  for (let i = 1; i < types.length; i++) {
    const t = types[i];
    let spec;
    if (t === 'Dense') spec = { type: 'Dense', units: rand.pick(UNITS) };
    else if (t === 'Flatten') spec = { type: 'Flatten' };
    else if (t === 'BatchNormalization') spec = { type: 'BatchNormalization' };
    else if (t === 'MaxPool2D') spec = { type: 'MaxPool2D', pool: 2 };
    else if (t === 'Conv2D') spec = { type: 'Conv2D', filters: rand.pick(FILTERS), kernel: rand.pick([3, 5]), strides: 1, padding: 'same' };
    else if (t === 'SimpleRNN' || t === 'LSTM' || t === 'GRU') spec = { type: t, units: rand.pick([8, 16, 32]) };
    else spec = randomSingle(rand, t).spec;
    if (shape.length !== 3 && (t === 'Conv2D' || t === 'MaxPool2D')) break;
    if (shape.length === 3 && t === 'Dense') specs.push({ type: 'Flatten' });
    const cur = specs.length && specs[specs.length - 1].type === 'Flatten' ? layerShape({ type: 'Flatten' }, shape) : shape;
    specs.push(spec);
    shape = layerShape({ ...spec, inputShape: cur }, cur);
  }
  // recurrent layers before another recurrent layer must return sequences
  for (let i = 0; i < specs.length - 1; i++) {
    const a = specs[i];
    const b = specs[i + 1];
    if (['SimpleRNN', 'LSTM', 'GRU'].includes(a.type) && ['SimpleRNN', 'LSTM', 'GRU'].includes(b.type)) a.returnSequences = true;
  }
  const M = modelParams(specs, first.inputShape);
  const lines = [inputLine(first.inputShape), ...specs.map(specLine)];
  const perLayer = M.layers.map((r, i) => `${specLine(specs[i])}: ${fmt(r.total)}`);
  const { total, trainable, nonTrainable } = M;
  const answer = ask === 'trainable' ? trainable : ask === 'nonTrainable' ? nonTrainable : total;
  const hardest = specs.slice().sort((a, b) => (RULES[b.type]?.hard ?? hardOf(b.type)) - (RULES[a.type]?.hard ?? hardOf(a.type)))[0];
  const R = RULES[hardest.type];
  const q = ask === 'trainable' ? 'Total trainable params?' : ask === 'nonTrainable' ? 'Non-trainable params?' : 'Total params?';
  return {
    id: nextId('stack'),
    concept: R.concept,
    src: R.src,
    beyond: specs.some((s) => RULES[s.type]?.beyond) || undefined,
    kind: 'number',
    lines,
    question: q,
    ask,
    promptText: `${specs.map(specLine).join(' → ')} on ${fmtShapeIn(first.inputShape)} · ${q}`,
    answer,
    why: `Layer by layer: ${perLayer.join('; ')}. Total ${fmt(total)}${nonTrainable ? ` (${fmt(nonTrainable)} of them non-trainable: BatchNormalization’s moving means and variances)` : ''}.`,
  };
}
const hardOf = (t) => ({ GRU: 5, LSTM: 4, MultiHeadAttention: 5, BatchNormalization: 4, Bidirectional: 4, DenseTranspose: 4, Conv2DTranspose: 3, Conv2D: 3, SimpleRNN: 3, Conv1D: 3, Dense: 2 }[t] ?? 1);

function slideModelItem(rand, m, ask) {
  const printed = m.printed;
  const answer = ask === 'trainable' ? printed.trainable : ask === 'nonTrainable' ? printed.nonTrainable : printed.total;
  const q = ask === 'trainable' ? 'Trainable params?' : ask === 'nonTrainable' ? 'Non-trainable params?' : 'Total params?';
  const hardest = m.specs.slice().sort((a, b) => hardOf(b.type) - hardOf(a.type))[0];
  const R = RULES[hardest.type] ?? RULES.Dense;
  return {
    id: nextId(m.id),
    concept: ask === 'nonTrainable' || ask === 'trainable' ? 'bn.params' : R.concept,
    src: m.src,
    kind: 'number',
    lines: m.lines,
    question: q,
    ask,
    title: m.name,
    promptText: `${m.name} (slide ${m.src.slides[0]}) · ${q}`,
    answer,
    why: m.why,
  };
}

/* ── the ramp per level ──────────────────────────────────────────────── */
const L1_TYPES = ['Dense', 'Dense', 'Conv2D', 'Conv2D', 'MaxPool2D', 'Flatten', 'BatchNormalization', 'SimpleRNN', 'LSTM', 'GRU', 'Conv2DTranspose'];
const L2_TYPES = ['Dense', 'Conv2D', 'Conv2D', 'Conv2DTranspose', 'BatchNormalization', 'SimpleRNN', 'LSTM', 'GRU', 'Conv1D', 'DenseTranspose', 'Bidirectional', 'GlobalAvgPool2D'];
const L2_SHAPES = ['Conv2D', 'MaxPool2D', 'Flatten', 'SimpleRNN', 'GlobalAvgPool2D', 'LSTM', 'Bidirectional'];
const L3_STACKS = [['Conv2D', 'MaxPool2D', 'Dense'], ['Conv2D', 'BatchNormalization'], ['LSTM', 'Dense'], ['GRU', 'GRU'], ['SimpleRNN', 'LSTM'], ['Conv2D', 'Conv2D', 'Flatten']];

export function makeItems(rand, level = 1) {
  counter = 0;
  const items = [];
  if (level <= 1) {
    // 10 items, easy types first
    const order = ['Dense', 'Flatten', 'Conv2D', 'MaxPool2D', 'Dense', 'BatchNormalization', 'Conv2D', 'SimpleRNN', 'Conv2DTranspose', rand.pick(['LSTM', 'GRU'])];
    order.forEach((t) => items.push(singleItem(rand, t, { choice: true, ask: t === 'BatchNormalization' && rand.chance(0.5) ? rand.pick(['trainable', 'nonTrainable']) : 'total' })));
    return items;
  }
  if (level === 2) {
    const singles = rand.shuffle(L2_TYPES).slice(0, 6);
    singles.sort((a, b) => hardOf(a) - hardOf(b));
    singles.forEach((t) => items.push(singleItem(rand, t, { ask: t === 'BatchNormalization' ? rand.pick(['total', 'trainable', 'nonTrainable']) : 'total' })));
    const shapes = rand.shuffle(L2_SHAPES).slice(0, 2);
    shapes.forEach((t) => items.push(shapeItem(rand, t)));
    items.push(stackItem(rand, rand.pick([['Conv2D', 'Dense'], ['SimpleRNN', 'Dense'], ['Dense', 'Dense'], ['Conv2D', 'MaxPool2D', 'Flatten']])));
    return items;
  }
  // level 3: the slides' models, trainable / non-trainable, bigger stacks, rare beyond types
  const models = rand.shuffle(SLIDE_MODELS).slice(0, 4);
  models.forEach((m) => items.push(slideModelItem(rand, m, rand.pick(m.ask))));
  items.push(shapeItem(rand, rand.pick(['Conv2D', 'Bidirectional', 'GRU'])));
  items.push(stackItem(rand, rand.pick(L3_STACKS)));
  items.push(stackItem(rand, rand.pick(L3_STACKS), { ask: rand.chance(0.5) ? 'total' : 'trainable' }));
  items.push(singleItem(rand, rand.pick(['DenseTranspose', 'Bidirectional', 'GRU', 'Conv1D'])));
  if (rand.chance(0.35)) items.push(singleItem(rand, 'MultiHeadAttention'));
  // ramp: slide models are warm-ups; hardest last
  return items;
}

export { RULES, SHAPE_RULES, SLIDE_MODELS };
