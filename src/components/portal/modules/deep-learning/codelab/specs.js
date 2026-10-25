/* ============================================================================
   CODE LAB — LAYER SPECS (one per model card)
   ----------------------------------------------------------------------------
   Each spec is the card's model as data: inputs (shape without the batch
   axis) and layers in call order; a layer reads `from` (an id or a list of
   ids) or else the layer before it. counts.js turns a spec into shapes and
   parameter counts, diagrams.jsx into the "Draw it" picture, and
   tools/dl-codelab/verify_counts.py builds the same spec in TensorFlow and
   checks both. `group` draws a bracket (encoder, decoder…); `state` draws a
   dashed state hand-over (an RNN's initial_state, no parameters);
   `diagram.fold` folds a long chain into columns; `frozen` layers count as
   non-trainable. Specs no card draws (`verifyOnly`) check a number a card
   states in words: sample Q1(c), a printed count, a model the card mentions.
   ========================================================================== */

const D = (units, act, extra = {}) => ({ type: 'Dense', units, act, ...extra });
const C2 = (filters, kernel, extra = {}) => ({ type: 'Conv2D', filters, kernel, ...extra });
const g = (group, layers) => layers.map((l) => ({ ...l, group }));

const S = {
  // ── Labs & Projects ───────────────────────────────────────────────────────
  lab3Wine: {
    inputs: [{ id: 'input', shape: [13] }],
    layers: [{ type: 'Normalization' }, D(5, 'gelu'), D(5, 'gelu'), D(5, 'gelu'), D(3, 'softmax')],
  },
  lab4Clockwise: {
    inputs: [{ id: 'input', shape: [null, 2] }],
    layers: [{ type: 'SimpleRNN', units: 16 }, D(1, 'sigmoid')],
  },
  lab4NextVertex: {
    inputs: [{ id: 'input', shape: [null, 2] }],
    layers: [{ type: 'SimpleRNN', units: 16 }, D(2)],
  },
  p1Cnn: {
    inputs: [{ id: 'input', shape: [64, 64, 3] }],
    layers: [
      { type: 'Rescaling', scale: 1 / 255, label: 'Rescaling 1/255' },
      C2(16, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(16, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(24, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(40, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      { type: 'GlobalAvgPool2D' }, { type: 'Dropout', rate: 0.2 }, D(32, 'relu'), D(10, 'softmax'),
    ],
    diagram: { fold: 8 },
  },
  p1CnnLargest: {
    verifyOnly: true,
    inputs: [{ id: 'input', shape: [64, 64, 3] }],
    layers: [
      { type: 'Rescaling', scale: 1 / 255 },
      C2(16, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(24, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(32, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(48, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      { type: 'GlobalAvgPool2D' }, { type: 'Dropout', rate: 0.3 }, D(48, 'relu'), D(10, 'softmax'),
    ],
  },
  p1Nasnet: {
    inputs: [{ id: 'input', shape: [64, 64, 3] }],
    layers: [
      { type: 'Resizing', height: 224, width: 224 },
      { type: 'Rescaling', scale: 1 / 127.5, offset: -1, label: 'Rescaling 1/127.5, −1' },
      { type: 'Pretrained', base: 'NASNetMobile', frozen: true },
      { type: 'GlobalAvgPool2D' }, D(64, 'relu'), D(10, 'softmax'),
    ],
  },
  p2Model1: {
    inputs: [{ id: 'input', shape: [null, 2] }],
    layers: [
      { type: 'Normalization', fixed: true, label: 'Normalization (z-scores)' },
      { type: 'GRU', units: 16, act: 'tanh', returnSeq: true },
      { type: 'GRU', units: 16, act: 'tanh' },
      D(24), { type: 'Reshape', target: [12, 2] },
      { type: 'Normalization', fixed: true, invert: true, label: 'Normalization (invert, °C)' },
    ],
  },
  p2Model2: {
    verifyOnly: true,
    inputs: [{ id: 'input', shape: [null, 2] }],
    layers: [
      { type: 'Normalization', fixed: true },
      { type: 'GRU', units: 16, act: 'tanh', returnSeq: true },
      { type: 'GRU', units: 16, act: 'tanh' },
      D(2), { type: 'Reshape', target: [1, 2] },
      { type: 'Normalization', fixed: true, invert: true },
    ],
  },
  p2Model3: {
    inputs: [{ id: 'encoder_input', shape: [null, 2], label: 'encoder input' }, { id: 'decoder_input', shape: [null, 2], label: 'decoder input' }],
    layers: [
      { id: 'enc_norm', type: 'Normalization', fixed: true, from: 'encoder_input', label: 'Normalization' },
      { id: 'dec_norm', type: 'Normalization', fixed: true, from: 'decoder_input', label: 'Normalization' },
      { id: 'encoder_gru1', type: 'GRU', units: 16, act: 'tanh', returnSeq: true, from: 'enc_norm', label: 'encoder GRU 16, seq' },
      { id: 'decoder_gru1', type: 'GRU', units: 16, act: 'tanh', returnSeq: true, from: 'dec_norm', state: 'encoder_gru1', label: 'decoder GRU 16, seq' },
      { id: 'encoder_gru2', type: 'GRU', units: 16, act: 'tanh', from: 'encoder_gru1', label: 'encoder GRU 16' },
      { id: 'decoder_gru2', type: 'GRU', units: 16, act: 'tanh', returnSeq: true, from: 'decoder_gru1', state: 'encoder_gru2', label: 'decoder GRU 16, seq' },
      { id: 'next_month', ...D(2), from: 'decoder_gru2' },
      { id: 'denorm', type: 'Normalization', fixed: true, invert: true, label: 'Normalization (invert)' },
    ],
  },
  p2VaeEncoder: {
    inputs: [{ id: 'inputs', shape: [84] }],
    layers: [
      { type: 'Reshape', target: [84, 1] },
      { type: 'Conv1D', filters: 16, kernel: 5, strides: 2, padding: 'same', act: 'relu' },
      { type: 'Conv1D', filters: 32, kernel: 5, strides: 2, padding: 'same', act: 'relu' },
      { id: 'flat', type: 'Flatten' },
      { id: 'z_mean', ...D(4), from: 'flat', label: 'z_mean Dense 4' },
      { id: 'z_log_var', ...D(4), from: 'flat', label: 'z_log_var Dense 4' },
      { id: 'z', type: 'Sampling', from: ['z_mean', 'z_log_var'] },
    ],
  },
  p2VaeDecoder: {
    verifyOnly: true,
    inputs: [{ id: 'codings', shape: [4] }],
    layers: [
      D(672, 'relu'), { type: 'Reshape', target: [21, 32] },
      { type: 'Conv1DTranspose', filters: 16, kernel: 5, strides: 2, padding: 'same', act: 'relu' },
      { type: 'Conv1DTranspose', filters: 1, kernel: 5, strides: 2, padding: 'same' },
      { type: 'Reshape', target: [84] },
    ],
  },

  // ── Keras models (L1) ─────────────────────────────────────────────────────
  fashionMlp: {
    inputs: [{ id: 'input', shape: [28, 28] }],
    layers: [{ type: 'Flatten' }, D(300, 'relu'), D(100, 'relu'), D(10, 'softmax')],
  },
  // L1 s44: Wide & Deep on California housing (8 features)
  wideDeep: {
    inputs: [{ id: 'input_', shape: [8] }],
    layers: [
      { id: 'normalized', type: 'Normalization' },
      { id: 'hidden1', ...D(30, 'relu') },
      { id: 'hidden2', ...D(30, 'relu') },
      { id: 'concat', type: 'Concatenate', from: ['normalized', 'hidden2'] },
      { id: 'output', ...D(1) },
    ],
  },
  // the sample paper's Q1(c), stated on the wide-deep card
  sampleQ1c: {
    verifyOnly: true,
    inputs: [{ id: 'input_', shape: [10] }],
    layers: [
      { id: 'normalized', type: 'Normalization' },
      { id: 'hidden', ...D(20, 'gelu') },
      { id: 'concat', type: 'Concatenate', from: ['normalized', 'hidden'] },
      { id: 'output', ...D(3, 'softmax') },
    ],
  },
  wideDeepTwo: {
    inputs: [{ id: 'input_wide', shape: [5], label: 'input_wide' }, { id: 'input_deep', shape: [6], label: 'input_deep' }],
    layers: [
      { id: 'norm_wide', type: 'Normalization', from: 'input_wide' },
      { id: 'norm_deep', type: 'Normalization', from: 'input_deep' },
      { id: 'hidden1', ...D(30, 'relu'), from: 'norm_deep' },
      { id: 'hidden2', ...D(30, 'relu') },
      { id: 'concat', type: 'Concatenate', from: ['norm_wide', 'hidden2'] },
      { id: 'output', ...D(1), from: 'concat', label: 'output Dense 1' },
      { id: 'aux_output', ...D(1), from: 'hidden2', label: 'aux_output Dense 1' },
    ],
    outputs: ['output', 'aux_output'],
  },

  // ── Training deep nets (L2) ───────────────────────────────────────────────
  batchNorm: {
    inputs: [{ id: 'input', shape: [28, 28] }],
    layers: [
      { type: 'Flatten' }, { type: 'BatchNormalization' },
      D(300, 'relu'), { type: 'BatchNormalization' },
      D(100, 'relu'), { type: 'BatchNormalization' },
      D(10, 'softmax'),
    ],
  },
  dropoutMlp: {
    inputs: [{ id: 'input', shape: [28, 28] }],
    layers: [
      { type: 'Flatten' }, { type: 'Dropout', rate: 0.2 },
      D(100, 'relu'), { type: 'Dropout', rate: 0.2 },
      D(100, 'relu'), { type: 'Dropout', rate: 0.2 },
      D(10, 'softmax'),
    ],
  },
  // model A's layers (Géron Ch 11 cell 63) minus its output, frozen, + the new head
  transferBonA: {
    inputs: [{ id: 'input', shape: [28, 28] }],
    layers: [
      { type: 'Flatten' },
      D(100, 'relu', { frozen: true }), D(100, 'relu', { frozen: true }), D(100, 'relu', { frozen: true }),
      D(1, 'sigmoid'),
    ],
  },

  // ── CNNs (L3) ─────────────────────────────────────────────────────────────
  convValid: {
    inputs: [{ id: 'images', shape: [70, 120, 3] }],
    layers: [C2(32, 7)],
  },
  fashionCnn: {
    inputs: [{ id: 'input', shape: [28, 28, 1] }],
    layers: [
      C2(64, 7, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D' },
      C2(128, 3, { padding: 'same', act: 'relu' }), C2(128, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D' },
      C2(256, 3, { padding: 'same', act: 'relu' }), C2(256, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D' },
      { type: 'Flatten' }, D(128, 'relu'), { type: 'Dropout', rate: 0.5 }, D(64, 'relu'), { type: 'Dropout', rate: 0.5 }, D(10, 'softmax'),
    ],
    diagram: { fold: 8 },
  },

  // ── RNNs (L4) ─────────────────────────────────────────────────────────────
  univarModel: {
    verifyOnly: true,
    inputs: [{ id: 'input', shape: [null, 1] }],
    layers: [{ type: 'SimpleRNN', units: 32 }, D(1)],
  },
  deepRnn: {
    inputs: [{ id: 'input', shape: [null, 1] }],
    layers: [
      { type: 'SimpleRNN', units: 32, returnSeq: true },
      { type: 'SimpleRNN', units: 32, returnSeq: true },
      { type: 'SimpleRNN', units: 32 },
      D(1),
    ],
  },
  aheadModel: {
    inputs: [{ id: 'input', shape: [null, 5] }],
    layers: [{ type: 'SimpleRNN', units: 32 }, D(14)],
  },
  lstmModel: {
    inputs: [{ id: 'input', shape: [null, 1] }],
    layers: [{ type: 'LSTM', units: 12 }, D(1)],
  },
  gruModel: {
    inputs: [{ id: 'input', shape: [null, 1] }],
    layers: [{ type: 'GRU', units: 20 }, D(1)],
  },
  // drawn for the slides' 56-day windows; the code's input is [None, 1]
  conv1dGru: {
    inputs: [{ id: 'input', shape: [56, 1] }],
    layers: [
      { type: 'Conv1D', filters: 8, kernel: 3, strides: 1, act: 'relu' },
      { type: 'Conv1D', filters: 16, kernel: 3, strides: 2, act: 'relu' },
      { type: 'GRU', units: 10 },
      D(1),
    ],
  },

  // ── Autoencoders (L5, L6–7) ───────────────────────────────────────────────
  linearAe: {
    inputs: [{ id: 'input', shape: [3] }],
    layers: [...g('encoder', [D(2)]), ...g('decoder', [D(3)])],
  },
  stackedAe: {
    inputs: [{ id: 'input', shape: [28, 28] }],
    layers: [
      ...g('encoder', [{ type: 'Flatten' }, D(100, 'relu'), D(30, 'relu')]),
      ...g('decoder', [D(100, 'relu'), D(784), { type: 'Reshape', target: [28, 28] }]),
    ],
  },
  convDecoder: {
    inputs: [{ id: 'codings', shape: [30] }],
    layers: [
      D(144), { type: 'Reshape', target: [3, 3, 16] },
      { type: 'Conv2DTranspose', filters: 32, kernel: 3, strides: 2, act: 'relu' },
      { type: 'Conv2DTranspose', filters: 16, kernel: 3, strides: 2, padding: 'same', act: 'relu' },
      { type: 'Conv2DTranspose', filters: 1, kernel: 3, strides: 2, padding: 'same' },
      { type: 'Reshape', target: [28, 28] },
    ],
  },
  convAe: {
    verifyOnly: true,
    inputs: [{ id: 'input', shape: [28, 28] }],
    layers: [
      { type: 'Reshape', target: [28, 28, 1] },
      C2(16, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(32, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(64, 3, { padding: 'same', act: 'relu' }), { type: 'MaxPool2D', pool: 2 },
      C2(30, 3, { padding: 'same', act: 'relu' }), { type: 'GlobalAvgPool2D' },
      D(144), { type: 'Reshape', target: [3, 3, 16] },
      { type: 'Conv2DTranspose', filters: 32, kernel: 3, strides: 2, act: 'relu' },
      { type: 'Conv2DTranspose', filters: 16, kernel: 3, strides: 2, padding: 'same', act: 'relu' },
      { type: 'Conv2DTranspose', filters: 1, kernel: 3, strides: 2, padding: 'same' },
      { type: 'Reshape', target: [28, 28] },
    ],
  },

  // ── VAEs & GANs (L6–7) ────────────────────────────────────────────────────
  ganDense: {
    inputs: [{ id: 'noise', shape: [30] }],
    layers: [
      ...g('generator', [D(100, 'relu'), D(150, 'relu'), D(784, 'sigmoid'), { type: 'Reshape', target: [28, 28] }]),
      ...g('discriminator', [{ type: 'Flatten' }, D(150, 'relu'), D(100, 'relu'), D(1, 'sigmoid')]),
    ],
    diagram: { fold: 5 },
  },
  dcganGenerator: {
    inputs: [{ id: 'codings', shape: [100] }],
    layers: [
      D(6272), { type: 'Reshape', target: [7, 7, 128] }, { type: 'BatchNormalization' },
      { type: 'Conv2DTranspose', filters: 64, kernel: 5, strides: 2, padding: 'same', act: 'relu' },
      { type: 'BatchNormalization' },
      { type: 'Conv2DTranspose', filters: 1, kernel: 5, strides: 2, padding: 'same', act: 'tanh' },
    ],
  },
  dcganDiscriminator: {
    verifyOnly: true,
    inputs: [{ id: 'images', shape: [28, 28, 1] }],
    layers: [
      C2(64, 5, { strides: 2, padding: 'same', act: 'leaky_relu' }), { type: 'Dropout', rate: 0.4 },
      C2(128, 5, { strides: 2, padding: 'same', act: 'leaky_relu' }), { type: 'Dropout', rate: 0.4 },
      { type: 'Flatten' }, D(1, 'sigmoid'),
    ],
  },

  // ── Reinforcement learning (L9) ───────────────────────────────────────────
  policyNet: {
    inputs: [{ id: 'obs', shape: [4] }],
    layers: [D(5, 'relu'), D(1, 'sigmoid')],
  },
  dqnModel: {
    inputs: [{ id: 'state', shape: [4] }],
    layers: [D(32, 'elu'), D(32, 'elu'), D(2)],
  },
};

export const SPECS = Object.fromEntries(Object.entries(S).map(([id, s]) => [id, { id, ...s }]));
