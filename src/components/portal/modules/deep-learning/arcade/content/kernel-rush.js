/* ============================================================================
   KERNEL RUSH — CONTENT (pure data, slide-cited; Lecture 3 only)
   ----------------------------------------------------------------------------
   The rules the game drills, in the slides' words, with {tokens} that
   maths/kernelRush.js fills with an item's numbers. Every rule carries the
   slides that state it (`src`). The output-size rules are taught only
   through the slides' own examples (slides 18, 20, 21, 26), so the
   generator keeps to sizes those examples explain exactly (see
   `cleanOnly` below); the general ⌈n/s⌉ / ⌊(n − f)/s⌋ + 1 formula
   (lecture3.js EQUATIONS.outputSize) is never shown, because the deck never
   prints it. Nothing here is marked `beyond`.
   ========================================================================== */

export const GAME = {
  id: 'kernel-rush',
  title: 'Kernel Rush',
  blurb: 'A conv or pooling layer drops onto the input block. Size the output block before it lands.',
  levelNames: ['valid vs same · stride', 'filters span channels · pooling', 'stacks · receptive field'],
};

export const INTRO = {
  line: 'Size the output block before the layer lands on it.',
  controls: [
    'Type height × width × channels on the pad (keys 0–9). Tab, x or Enter moves to the next slot; Enter on the last one fires.',
    'Your block grows on the stage as you type. A wrong block lands next to the real one.',
    'Bonus after it lands: the layer’s Param # on the keypad (keys 0–9, Enter).',
    'Keras defaults, as on the slides: padding="valid" (slide 20); pooling strides = pool size (slide 28).',
  ],
};

/* The rules (why cards): one or two sentences each, in the slides' terms.
   Tokens in {braces} are filled by maths/kernelRush.js. */
export const RULES = {
  // ── height and width of a convolution ────────────────────────────────
  valid1: {
    concept: 'shape.conv2d',
    src: { lecture: 3, slides: [18, 20] },
    text: 'padding="valid"{how} keeps the {f} window inside the image, so each axis loses $f - 1$ pixels: {calc}, as slide 18’s 70 × 120 → 64 × 114 with kernel_size=7.',
  },
  same1: {
    concept: 'shape.conv2d',
    src: { lecture: 3, slides: [20] },
    text: 'padding="same" zero-pads, so at stride 1 the height and width stay put: {calc}, as slide 20’s 70 × 120 → 70 × 120.',
  },
  same2: {
    concept: 'cnn.padding',
    src: { lecture: 3, slides: [21, 9] },
    text: 'Even with padding="same" a stride above 1 shrinks the output (slide 21): "same" keeps all $n$ positions and strides={s} keeps every {sth} one, so {calc}, as Figure 14-8’s 10 → 5.',
  },
  valid2: {
    concept: 'cnn.padding',
    src: { lecture: 3, slides: [21, 20, 9] },
    text: 'padding="valid"{how} fits the window at $n - f + 1$ positions per axis and strides={s} keeps every {sth} one (slides 9, 21): {calc}, as Figure 14-8’s 10 − 7 + 1 = 4 → 2.',
  },
  // ── depth ─────────────────────────────────────────────────────────────
  depth: {
    concept: 'shape.conv2d',
    src: { lecture: 3, slides: [13] },
    text: 'Depth = number of filters = {k} (slide 13).',
  },
  multiChannel: {
    concept: 'cnn.featureMaps',
    src: { lecture: 3, slides: [15, 13] },
    text: 'Each filter spans all {c} input channels ($n_h \\times n_w \\times N_{\\text{channels}}$) and makes one output channel $\\mathbf{z}_k$, so depth = {k} filters (slide 15).',
  },
  // ── pooling ───────────────────────────────────────────────────────────
  pool: {
    concept: 'shape.pool',
    src: { lecture: 3, slides: [28, 26, 29] },
    text: '{layer}: strides default to the pool size and padding to "valid" (slide 28), so the {p} × {p} windows tile the map: {calc}; each channel is pooled on its own, so the depth stays {c} (slides 26, 29).',
  },
  poolSame: {
    concept: 'shape.pool',
    src: { lecture: 3, slides: [42, 20, 29] },
    text: 'strides=1 with padding="same" keeps the height and width, like GoogLeNet’s "3 × 3 + 1(S)" max pool (slide 42): {calc}; the depth stays {c} (slide 29).',
  },
  gap: {
    concept: 'pool.global',
    src: { lecture: 3, slides: [31] },
    text: 'Global average pooling averages each feature map to a single number, so {h} × {w} × {c} becomes ({c},), as slide 31’s [2, 70, 120, 3] → (2, 3).',
  },
  // ── parameters (the bonus) ────────────────────────────────────────────
  convParams: {
    concept: 'params.conv2d',
    src: { lecture: 3, slides: [16, 22] },
    text: 'Kernels $[f_h, f_w, f_c, f_n] = [{fh}, {fw}, {c}, {k}]$ plus one bias per filter (slide 16): $({fh} \\times {fw} \\times {c} + 1) \\times {k} = {total}$, the slide-22 rule; the image’s height and width don’t enter.',
  },
  poolParams: {
    concept: 'params.pool',
    src: { lecture: 3, slides: [25, 29] },
    text: '0: a pooling neuron has no weights, it only aggregates its inputs with the max or mean (slides 25, 29).',
  },
  stackParams: {
    concept: 'params.conv2d',
    src: { lecture: 3, slides: [16, 22, 25] },
    text: 'Add the layers: {parts} = {total}, each Conv2D counted as $(f_h \\times f_w \\times f_c + 1) \\times f_n$ with $f_c$ its own input’s channels; pooling adds 0 (slides 16, 22, 25).',
  },
  // ── stacks ────────────────────────────────────────────────────────────
  stack: {
    concept: 'shape.conv2d',
    src: { lecture: 3, slides: [13] },
    text: 'Layer by layer: {steps}. Depth = the last Conv2D’s filters; pooling keeps it (slides 13, 29).',
  },
  // ── receptive field ───────────────────────────────────────────────────
  rf: {
    concept: 'cnn.stride',
    src: { lecture: 3, slides: [9, 14] },
    text: 'Slide 9: row $i$ sees rows $i\\,s_h$ to $i\\,s_h + f_h - 1$ (column $j$: $j\\,s_w$ to $j\\,s_w + f_w - 1$). Here {calc}.',
  },
};

/* Short labels for the stack walk-through ({steps} above). */
export const STEP_RULE = {
  valid1: '"valid" loses $f - 1$ per axis (slides 18, 20)',
  same1: '"same" keeps height and width (slide 20)',
  same2: '"same" with stride 2 halves them (slide 21)',
  valid2: '"valid" positions $n - f + 1$, every 2nd kept (slides 20, 21, 9)',
  pool: 'the pool windows tile the map, depth kept (slides 26, 28, 29)',
  poolSame: '"same" at stride 1 keeps the size (slide 42)',
};

/* Stacks whose output sizes are PRINTED in the slides' architecture tables
   (level 3). Specs use maths/params.js's format; `printed` is each layer's
   printed maps @ size, checked by tools/dl-arcade/check-kernel-rush.mjs. */
export const TABLE_STACKS = [
  {
    id: 'lenet-c1s2',
    title: 'LeNet-5 · C1 → S2',
    input: [32, 32, 1],
    specs: [
      { type: 'Conv2D', filters: 6, kernel: 5 },
      { type: 'AvgPool2D', pool: 2 },
    ],
    printed: [[28, 28, 6], [14, 14, 6]],
    why: 'Slide 37’s LeNet-5 table prints C1: 6 maps of 28 × 28 (5 × 5 kernel, stride 1) and S2: 6 maps of 14 × 14 (2 × 2 average pooling, stride 2). In the slides’ terms: 32 − 5 + 1 = 28, the 2 × 2 pooling halves it, and pooling keeps the 6 maps.',
    src: { lecture: 3, slides: [37] },
  },
  {
    id: 'lenet-c3c5',
    title: 'LeNet-5 · C3 → S4 → C5',
    input: [14, 14, 6],
    specs: [
      { type: 'Conv2D', filters: 16, kernel: 5 },
      { type: 'AvgPool2D', pool: 2 },
      { type: 'Conv2D', filters: 120, kernel: 5 },
    ],
    printed: [[10, 10, 16], [5, 5, 16], [1, 1, 120]],
    why: 'Slide 37’s LeNet-5 table prints C3: 16 maps of 10 × 10, S4: 16 maps of 5 × 5 and C5: 120 maps of 1 × 1. In the slides’ terms: 14 − 5 + 1 = 10, the 2 × 2 pooling halves it to 5, and a 5 × 5 kernel fits a 5 × 5 map once: 1 × 1 × 120.',
    src: { lecture: 3, slides: [37] },
  },
  {
    id: 'alexnet-c1s2',
    title: 'AlexNet · C1 → S2',
    input: [227, 227, 3],
    specs: [
      { type: 'Conv2D', filters: 96, kernel: 11, strides: 4, explicitPad: true },
      { type: 'MaxPool2D', pool: 3, strides: 2 },
    ],
    printed: [[55, 55, 96], [27, 27, 96]],
    why: 'Slide 39’s AlexNet table prints C1: 96 maps of 55 × 55 (11 × 11, stride 4, valid) and S2: 96 maps of 27 × 27 (3 × 3 max pooling, stride 2, valid). Max pooling keeps the 96 maps (slide 29).',
    src: { lecture: 3, slides: [39] },
  },
  {
    id: 'alexnet-c3c5',
    title: 'AlexNet · C3 → S4 → C5',
    input: [27, 27, 96],
    specs: [
      { type: 'Conv2D', filters: 256, kernel: 5, padding: 'same' },
      { type: 'MaxPool2D', pool: 3, strides: 2 },
      { type: 'Conv2D', filters: 384, kernel: 3, padding: 'same' },
    ],
    printed: [[27, 27, 256], [13, 13, 256], [13, 13, 384]],
    why: 'Slide 39’s AlexNet table prints C3: 256 maps of 27 × 27 (5 × 5, stride 1, same), S4: 256 maps of 13 × 13 (3 × 3 max pooling, stride 2, valid) and C5: 384 maps of 13 × 13 (3 × 3, stride 1, same).',
    src: { lecture: 3, slides: [39] },
  },
];

/* The slide-18 layer itself (level 1 sometimes opens with it). */
export const SLIDE18 = {
  input: [70, 120, 3],
  spec: { type: 'Conv2D', filters: 32, kernel: 7 },
  src: { lecture: 3, slides: [17, 18] },
};

/* Prompts and stage labels. */
export const PROMPTS = {
  shape: 'Size the output block (height × width × channels).',
  gap: 'Size the output (one number per feature map).',
  stack: 'Size the final block after all {n} layers.',
  table: 'Size the final block ({title}).',
  params: 'Bonus · Param # of this layer?',
  stackParams: 'Bonus · total Param # of the stack?',
  rf: 'Neuron at row {i}, column {j} of the output: which input {axis} does it see?',
  rfSub: 'Count from 0, as on slide 9.',
};

export const LABELS = {
  input: 'input',
  output: 'output',
  yours: 'yours',
  real: 'real',
  landed: 'landed',
  kernel: 'kernel',
  window: 'window',
  neuron: 'neuron',
  field: 'receptive field',
};

/* "Show the maths" drawer lines (slides' notation; $…$ is KaTeX). */
export const MATHS = {
  valid: 'padding="valid" (the default): the window stays inside, $n - f + 1$ positions per axis (slides 18, 20).',
  same: 'padding="same": zero padding keeps all $n$ positions (slide 20).',
  stride: 'strides=$s$ keeps every $s$-th position: the stride is the distance between consecutive receptive fields (slides 9, 21).',
  depth: 'Depth = number of filters: $n$ filters give $n$ feature maps (slide 13).',
  filterSize: 'Each filter $f_k$ is $n_h \\times n_w \\times N_{\\text{channels}}$ and makes one output channel (slide 15):',
  pool: 'Pooling: strides default to the pool size, padding to "valid" (slide 28); each channel is pooled on its own, so the depth is kept (slide 29).',
  gap: 'Global average pooling: one number per feature map (slide 31).',
  params: 'Kernels and biases (slide 16), counted as on slide 22:',
  poolParams: 'A pooling neuron has no weights (slide 25).',
  rf: 'Slide 9 (and 14, across all feature maps):',
};
