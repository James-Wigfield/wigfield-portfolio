import { convOut, poolOut, convTOut, samePad, windows } from '../../maths/strideRules.js';
import { traceShapes, showShape } from '../../maths/shapeRules.js';
import { layerName } from '../../maths/paramRules.js';

/* ============================================================================
   TOPIC 4 · THE EXAM DRILL: OUTPUT SIZES
   ----------------------------------------------------------------------------
   make(seed) — one of four kinds, seeded:
     size   n, k, s, padding → the output length (verify items let
            verify_counts.py check each one in Keras); the window picture
            appears with the working
     cnn    generated Keras code → every layer's height (= width)
     pool   MaxPool2D() on an odd size → the output size
     why    why is there a stride of 2 here?
   FIXED = the slides' own layers, with receipts.
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

function sizeWorking(n, k, s, pad) {
  const out = convOut(n, k, s, pad);
  if (pad === 'same') {
    const p = samePad(n, k, s);
    return [
      `"same": $\\lceil ${n} / ${s} \\rceil = ${out}$ {beyond}.`,
      `It pads ${p.total} zero${p.total === 1 ? '' : 's'} (${p.left} left, ${p.right} right) so every input is covered {beyond}.`,
    ];
  }
  const w = windows(n, k, s, 'valid');
  return [
    `"valid": $\\lfloor (${n} - ${k}) / ${s} \\rfloor + 1 = \\lfloor ${Number(((n - k) / s).toFixed(2))} \\rfloor + 1 = ${out}$ {beyond}.`,
    w.ignored.length ? `The last ${w.ignored.length} input${w.ignored.length > 1 ? 's are' : ' is'} never read, like Figure 14-8’s “Ignored” {s|L3 · slide 21}.` : 'Every input is read by some window.',
  ];
}

function size(seed, r) {
  const n = pick(r, [7, 8, 9, 10, 12, 13, 15, 16, 20, 28, 32]);
  const k = pick(r, [2, 3, 3, 5, 7].filter((v) => v <= n));
  const s = pick(r, [1, 2, 2, 3, 4]);
  const pad = r() < 0.5 ? 'valid' : 'same';
  const layer = pick(r, ['conv1d', 'conv2d']);
  const out = convOut(n, k, s, pad);
  const what = layer === 'conv1d' ? `A \`Conv1D\` layer reads sequences of ${n} time steps` : `A \`Conv2D\` layer reads ${n} × ${n} images`;
  return {
    id: `z${seed}`,
    prov: '{own}',
    prompt: `${what} with \`kernel_size=${k}, strides=${s}, padding="${pad}"\`. What is the output ${layer === 'conv1d' ? 'length' : 'height (and width)'}?`,
    fields: [{ key: 'o', label: 'output size', type: 'number', answer: out }],
    working: sizeWorking(n, k, s, pad),
    strip: { n: Math.min(n, 20), k, s, pad, full: n <= 20 },
    verify: { kind: 'size', layer, n, k, s, pad, out },
  };
}

const P = 'tf.keras.layers.';
function genCNN(r) {
  const n = pick(r, [28, 32, 64, 96]);
  const layers = [];
  const firstStride = r() < 0.5;
  layers.push({ t: 'conv2d', filters: pick(r, [16, 32]), k: pick(r, [3, 5, 7]), s: firstStride ? 2 : 1, pad: r() < 0.6 ? 'same' : 'valid' });
  layers.push({ t: 'maxpool2d' });
  layers.push({ t: 'conv2d', filters: pick(r, [32, 64]), k: 3, s: r() < 0.3 ? 2 : 1, pad: r() < 0.5 ? 'same' : 'valid' });
  layers.push({ t: 'maxpool2d' });
  return { input: [n, n, pick(r, [1, 3])], layers };
}
function codeFor(model) {
  const line = (L) => (L.t === 'conv2d'
    ? `${P}Conv2D(${L.filters}, kernel_size=${L.k}${L.s !== 1 ? `, strides=${L.s}` : ''}${L.pad === 'same' ? ', padding="same"' : ''}, activation="relu")`
    : `${P}MaxPool2D()`);
  return ['model = tf.keras.Sequential([', `    ${P}InputLayer(shape=[${model.input.join(', ')}]),`, ...model.layers.map((L, i) => `    ${line(L)}${i < model.layers.length - 1 ? ',' : ''}`), '])'].join('\n');
}

function cnn(seed, r) {
  const model = genCNN(r);
  const rows = traceShapes(model);
  return {
    id: `c${seed}`,
    prov: '{own}',
    prompt: 'For this model, give the height (= width) of every layer’s output.',
    show: { code: codeFor(model) },
    model,
    fieldHead: 'Layer',
    fields: rows.map((row) => ({ key: `l${row.i}`, label: `\`${layerName(row.L)}\``, type: 'number', answer: row.out[0] })),
    working: rows.map((row) => {
      const n = row.ins[0][0];
      if (row.L.t === 'maxpool2d') return `\`MaxPool2D()\`: pool 2, stride 2 (the default): $\\lfloor (${n} - 2) / 2 \\rfloor + 1 = ${row.out[0]}$ {s|L3 · slide 28} {beyond}`;
      return `\`${layerName(row.L)}\`: ${row.L.pad === 'same' ? `$\\lceil ${n} / ${row.L.s} \\rceil = ${row.out[0]}$` : `$\\lfloor (${n} - ${row.L.k}) / ${row.L.s} \\rfloor + 1 = ${row.out[0]}$`} {beyond}; output \`${showShape(row.out)}\``;
    }),
  };
}

function pool(seed, r) {
  const n = pick(r, [7, 9, 11, 13, 15, 25, 27, 55]);
  const out = poolOut(n, 2, 2, 'valid');
  return {
    id: `p${seed}`,
    prov: '{own}',
    prompt: `\`MaxPool2D()\` is applied to a ${n} × ${n} × 64 feature map. What shape comes out (height, width, channels)?`,
    fields: [
      { key: 'h', label: 'height = width', type: 'number', answer: out },
      { key: 'c', label: 'channels', type: 'number', answer: 64 },
    ],
    working: [
      `The pool size defaults to 2 and the stride to the pool size {s|L3 · slide 28}: $\\lfloor (${n} - 2) / 2 \\rfloor + 1 = ${out}$; the last row and column are dropped {beyond}.`,
      'Pooling works on each channel separately, so the depth stays 64 {s|L3 · slide 29}.',
    ],
    verify: { kind: 'size', layer: 'pool', n, k: 2, s: 2, pad: 'valid', out },
  };
}

const WHY = [
  { s: 'The first `Conv2D` of a CNN for large photos has `kernel_size=7, strides=2`.', a: 'shrink', why: 'A big first kernel “usually with a stride of 2 or more … will reduce the spatial dimension of the image without losing too much information” {s|L3 · slide 34}; a larger stride also saves memory {s|L3 · slide 24}.' },
  { s: 'A DCGAN discriminator uses `Conv2D(64, kernel_size=5, strides=2, padding="same")` and no pooling.', a: 'pool', why: 'DCGAN guideline: “replace any pooling layers with strided convolutions (in the discriminator)” {s|L6–7 · slide 28}.' },
  { s: 'A decoder uses `Conv2DTranspose(16, 3, strides=2, padding="same")`.', a: 'grow', why: 'The decoder must “upscale the image”: a stride-2 transposed convolution doubles height and width (7 → 14) {s|L6–7 · slides 4–5}.' },
  { s: 'A CNN keeps crashing with an out-of-memory error.', a: 'shrink', why: '“reducing dimensionality using a larger stride value” is one of slide 24’s fixes {s|L3 · slide 24}.' },
];
const WHY_OPTS = [
  { value: 'shrink', label: 'to shrink the feature maps (less memory and compute)' },
  { value: 'pool', label: 'to replace a pooling layer' },
  { value: 'grow', label: 'to grow the image (upsample)' },
  { value: 'params', label: 'to add parameters' },
];

function why(seed, r) {
  const w = pick(r, WHY);
  return {
    id: `y${seed}`,
    prov: '{own}',
    prompt: `${w.s} Why the stride of 2?`,
    fields: [{ key: 'c', label: 'Mainly', type: 'choice', answer: w.a, options: WHY_OPTS }],
    working: [w.why, 'Never to change the parameter count: stride appears nowhere in $(k_h k_w c_{\\text{in}} + 1) \\times \\text{filters}$ {s|L3 · slide 22}.'],
  };
}

export function make(seed) {
  const r = rng(seed);
  const kind = pick(r, ['size', 'size', 'size', 'cnn', 'pool', 'why']);
  return { size, cnn, pool, why }[kind](seed, r);
}

/* ── from the unit ─────────────────────────────────────────────────────── */
function fixedSize(id, at, prompt, n, k, s, pad, extra = [], layer = 'conv1d', prov = null) {
  const out = convOut(n, k, s, pad);
  return {
    id,
    title: `From the unit · ${at}`,
    prov: prov ?? `{s|${at}}`,
    prompt,
    fields: [{ key: 'o', label: 'output size', type: 'number', answer: out }],
    working: [...sizeWorking(n, k, s, pad), ...extra],
    strip: { n: Math.min(n, 20), k, s, pad, full: n <= 20 },
    verify: { kind: 'size', layer, n, k, s, pad, out },
  };
}

export const FIXED = [
  {
    id: 'u-148',
    title: 'From the unit · L3 slide 21',
    prov: '{s|L3 · slide 21}',
    prompt: 'Figure 14-8: 10 inputs, `kernel_size=7, strides=2`. How many outputs with `padding="valid"`, how many inputs does it ignore, and how many outputs with `padding="same"`?',
    fields: [
      { key: 'v', label: '"valid" outputs', type: 'number', answer: convOut(10, 7, 2, 'valid') },
      { key: 'i', label: 'inputs ignored', type: 'number', answer: windows(10, 7, 2, 'valid').ignored.length },
      { key: 's', label: '"same" outputs', type: 'number', answer: convOut(10, 7, 2, 'same') },
    ],
    working: ['The figure: 2 outputs with the 10th input “Ignored”; 5 outputs with 2 zeros on the left and 3 on the right {s|L3 · slide 21}.', ...sizeWorking(10, 7, 2, 'same')],
    strip: { n: 10, k: 7, s: 2, pad: 'both', full: true },
    verify: [{ kind: 'size', layer: 'conv1d', n: 10, k: 7, s: 2, pad: 'valid', out: 2 }, { kind: 'size', layer: 'conv1d', n: 10, k: 7, s: 2, pad: 'same', out: 5 }],
  },
  fixedSize('u-s18', 'L3 · slide 18', '`Conv2D(filters=32, kernel_size=7)` (stride 1, "valid") on images 70 pixels high. How high is the output?', 70, 7, 1, 'valid', ['Slide 18 prints `TensorShape([2, 64, 114, 32])` {s|L3 · slide 18}.']),
  fixedSize('u-c1', 'L3 · slide 39', 'AlexNet C1: 227 × 227 input, 11 × 11 kernel, stride 4, "valid". What size comes out?', 227, 11, 4, 'valid', ['The table: C1 55 × 55 {s|L3 · slide 39}.']),
  fixedSize('u-s2', 'L3 · slide 39', 'AlexNet S2: max pooling 3 × 3, stride 2, "valid", on 55 × 55. What size comes out?', 55, 3, 2, 'valid', ['The table: S2 27 × 27 {s|L3 · slide 39}.'], 'pool'),
  fixedSize('u-lenet', 'L3 · slide 37', 'LeNet-5 C1: 32 × 32 input, 5 × 5 kernel, stride 1 (no padding). What size comes out?', 32, 5, 1, 'valid', ['The table: C1 28 × 28; then S2 (2 × 2, stride 2) 14 × 14 {s|L3 · slide 37}.']),
  fixedSize('u-l50', 'L4 · slide 50', 'Slide 50’s second layer, `Conv1D(filters=16, kernel_size=3, strides=2)`, reads 54 time steps. How many come out?', 54, 3, 2, 'valid', ['The slide doesn’t print it: 56 → 54 → 26 is this page’s own working {own}.'], 'conv1d', '{s|L4 · slide 50} {own}'),
  {
    id: 'u-dec',
    title: 'From the unit · L6–7 slide 5',
    prov: '{s|L6–7 · slide 5}',
    prompt: 'The conv decoder starts from 3 × 3 × 16. Give the height after `Conv2DTranspose(32, 3, strides=2)` (no padding argument), then after each of the two `Conv2DTranspose(…, 3, strides=2, padding="same")`.',
    fields: [
      { key: 'a', label: 'first (default "valid")', type: 'number', answer: convTOut(3, 3, 2, 'valid') },
      { key: 'b', label: 'second ("same")', type: 'number', answer: convTOut(7, 3, 2, 'same') },
      { key: 'c', label: 'third ("same")', type: 'number', answer: convTOut(14, 3, 2, 'same') },
    ],
    working: ['Slide 5’s comments: 7 × 7 × 32, 14 × 14 × 16, 28 × 28 × 1 {s|L6–7 · slide 5}.', '"valid": $3 \\times 2 + (3 - 2) = 7$; "same": $7 \\times 2 = 14$, $14 \\times 2 = 28$ {beyond}.'],
    verify: [{ kind: 'size', layer: 'convT', n: 3, k: 3, s: 2, pad: 'valid', out: 7 }, { kind: 'size', layer: 'convT', n: 7, k: 3, s: 2, pad: 'same', out: 14 }, { kind: 'size', layer: 'convT', n: 14, k: 3, s: 2, pad: 'same', out: 28 }],
  },
];
