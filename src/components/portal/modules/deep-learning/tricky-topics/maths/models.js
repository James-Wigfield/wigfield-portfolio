/* ============================================================================
   TRICKY TOPICS — THE UNIT'S MODELS (shared data)
   ----------------------------------------------------------------------------
   Every model a topic shows, written in shapeRules.js's vocabulary from the
   slide's own code (read from the slide images; quirks noted). Counts and
   shapes are never typed here: countModel() / traceShapes() compute them,
   and tools/dl-tricky-topics/verify_counts.py rebuilds each model in Keras
   and asserts the same numbers.

   `printed` records what the slide itself prints (so a page can label a
   number "L4 · slide 49" only when the slide prints it; anything else is
   "this page's own · checked in TF"). check-maths.mjs asserts every printed
   number equals the computed one.
   ========================================================================== */

export const MODELS = {
  'l1-mlp': {
    name: 'Fashion MNIST MLP',
    at: 'L1 · slide 36',
    printed: { total: 266610, trainable: 266610, nonTrainable: 0, perLayer: [0, 235500, 30100, 1010] },
    model: { input: [28, 28], layers: [{ t: 'flatten' }, { t: 'dense', units: 300 }, { t: 'dense', units: 100 }, { t: 'dense', units: 10 }] },
  },
  'l1-widedeep': {
    name: 'Wide & Deep (California housing)',
    at: 'L1 · slide 45',
    printed: { total: 1256, trainable: 1239, nonTrainable: 17, perLayer: [17, 270, 930, 0, 39] },
    model: {
      input: [8],
      layers: [
        { t: 'norm', id: 'normalized' },
        { t: 'dense', units: 30, id: 'hidden1' },
        { t: 'dense', units: 30, id: 'hidden2' },
        { t: 'concat', in: ['normalized', 'hidden2'], id: 'concat' },
        { t: 'dense', units: 1 },
      ],
    },
  },
  'l2-bn': {
    name: 'BN after Flatten and after each hidden layer',
    at: 'L2 · slide 27',
    printed: { total: 271346, trainable: 268978, nonTrainable: 2368, perLayer: [0, 3136, 235500, 1200, 30100, 400, 1010] },
    model: {
      input: [28, 28],
      layers: [{ t: 'flatten' }, { t: 'bn' }, { t: 'dense', units: 300 }, { t: 'bn' }, { t: 'dense', units: 100 }, { t: 'bn' }, { t: 'dense', units: 10 }],
    },
  },
  'l2-bn-nobias': {
    name: 'BN before the activation, use_bias=False',
    at: 'L2 · slide 28',
    printed: {},
    note: 'The slide shows only the code; it has no BN after Flatten (slide 26/27 does).',
    model: {
      input: [28, 28],
      layers: [
        { t: 'flatten' },
        { t: 'dense', units: 300, bias: false }, { t: 'bn' }, { t: 'activation', fn: 'relu' },
        { t: 'dense', units: 100, bias: false }, { t: 'bn' }, { t: 'activation', fn: 'relu' },
        { t: 'dense', units: 10 },
      ],
    },
  },
  'l3-conv32': {
    name: 'Conv2D(32, 7) on the two RGB images',
    at: 'L3 · slides 18–19',
    printed: {},
    note: 'Slide 19 prints the shapes (7, 7, 3, 32) and (32,); the 4,736 is this page’s own.',
    model: { input: [70, 120, 3], layers: [{ t: 'conv2d', filters: 32, k: 7 }] },
  },
  'l3-s22': {
    name: '200 filters of 5 × 5 on a 150 × 100 RGB image',
    at: 'L3 · slide 22',
    printed: { total: 15200 },
    model: { input: [150, 100, 3], layers: [{ t: 'conv2d', filters: 200, k: 5, pad: 'same' }] },
  },
  'l3-cnn': {
    name: 'Fashion MNIST CNN',
    at: 'L3 · slide 35',
    printed: {},
    model: {
      input: [28, 28, 1],
      layers: [
        { t: 'conv2d', filters: 64, k: 7, pad: 'same' },
        { t: 'maxpool2d' },
        { t: 'conv2d', filters: 128, k: 3, pad: 'same' },
        { t: 'conv2d', filters: 128, k: 3, pad: 'same' },
        { t: 'maxpool2d' },
        { t: 'conv2d', filters: 256, k: 3, pad: 'same' },
        { t: 'conv2d', filters: 256, k: 3, pad: 'same' },
        { t: 'maxpool2d' },
        { t: 'flatten' },
        { t: 'dense', units: 128 },
        { t: 'dropout', rate: 0.5 },
        { t: 'dense', units: 64 },
        { t: 'dropout', rate: 0.5 },
        { t: 'dense', units: 10 },
      ],
    },
  },
  'l4-linear': {
    name: 'Linear model on 56 steps',
    at: 'L4 · slide 23',
    printed: { total: 57, trainable: 57, nonTrainable: 0 },
    model: { input: [56], layers: [{ t: 'dense', units: 1 }] },
  },
  'l4-rnn1': {
    name: 'SimpleRNN(1)',
    at: 'L4 · slide 25',
    printed: { total: 3, perLayer: [3] },
    model: { input: [56, 1], layers: [{ t: 'simplernn', units: 1 }] },
  },
  'l4-rnn32': {
    name: 'SimpleRNN(32) + Dense(1)',
    at: 'L4 · slide 27',
    printed: { total: 1121, perLayer: [1088, 33] },
    model: { input: [56, 1], layers: [{ t: 'simplernn', units: 32 }, { t: 'dense', units: 1 }] },
  },
  'l4-deep': {
    name: 'Deep RNN',
    at: 'L4 · slide 29',
    printed: { total: 5281, trainable: 5281, nonTrainable: 0, perLayer: [1088, 2080, 2080, 33] },
    model: {
      input: [56, 1],
      layers: [{ t: 'simplernn', units: 32, seq: true }, { t: 'simplernn', units: 32, seq: true }, { t: 'simplernn', units: 32 }, { t: 'dense', units: 1 }],
    },
  },
  'l4-lstm': {
    name: 'LSTM(12) + Dense(1)',
    at: 'L4 · slide 43',
    printed: { total: 685 },
    model: { input: [56, 1], layers: [{ t: 'lstm', units: 12 }, { t: 'dense', units: 1 }] },
  },
  'l4-gru': {
    name: 'GRU(20) + Dense(1)',
    at: 'L4 · slide 49',
    printed: { total: 1401 },
    model: { input: [56, 1], layers: [{ t: 'gru', units: 20 }, { t: 'dense', units: 1 }] },
  },
  'l4-gru-1bias': {
    name: 'GRU(20) + Dense(1), one bias per gate (the slide’s equations)',
    at: 'L4 · slide 49',
    printed: {},
    note: 'reset_after=False: the count the slide’s own equations give.',
    model: { input: [56, 1], layers: [{ t: 'gru', units: 20, resetAfter: false }, { t: 'dense', units: 1 }] },
  },
  'l4-cnngru': {
    name: 'Conv1D → Conv1D (strides=2) → GRU → Dense',
    at: 'L4 · slide 50',
    printed: { total: 1283 },
    model: {
      input: [56, 1],
      layers: [{ t: 'conv1d', filters: 8, k: 3 }, { t: 'conv1d', filters: 16, k: 3, s: 2 }, { t: 'gru', units: 10 }, { t: 'dense', units: 1 }],
    },
  },
  'l4-cell': {
    name: 'The memory cell of slides 9–10 (4 inputs, 5 neurons), Keras style',
    at: 'L4 · slides 9–10',
    printed: {},
    note: 'Slide 9–10’s cell also holds W_y (5 × 2) and b_y (2): Keras puts those in the Dense layer.',
    model: { input: [3, 4], layers: [{ t: 'simplernn', units: 5 }, { t: 'dense', units: 2 }] },
  },
  'l5-stacked': {
    name: 'Stacked autoencoder',
    at: 'L5 · slide 12',
    printed: { total: 163814 },
    model: {
      input: [28, 28],
      layers: [{ t: 'flatten' }, { t: 'dense', units: 100 }, { t: 'dense', units: 30 }, { t: 'dense', units: 100 }, { t: 'dense', units: 784 }, { t: 'reshape', to: [28, 28] }],
    },
  },
  'l5-tied': {
    name: 'Tied autoencoder',
    at: 'L5 · slide 21',
    printed: { total: 82414 },
    model: {
      input: [28, 28],
      layers: [
        { t: 'flatten' },
        { t: 'dense', units: 100, id: 'dense_1' },
        { t: 'dense', units: 30, id: 'dense_2' },
        { t: 'denseT', units: 100, tied: 'dense_2' },
        { t: 'denseT', units: 784, tied: 'dense_1' },
        { t: 'reshape', to: [28, 28] },
      ],
    },
  },
  'l67-convenc': {
    name: 'Convolutional encoder',
    at: 'L6–7 · slide 5',
    printed: {},
    note: 'Not printed: 54,479 − 13,873 (slide 6).',
    model: {
      input: [28, 28],
      layers: [
        { t: 'reshape', to: [28, 28, 1] },
        { t: 'conv2d', filters: 16, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'conv2d', filters: 32, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'conv2d', filters: 64, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'conv2d', filters: 30, k: 3, pad: 'same' },
        { t: 'gap2d' },
      ],
    },
  },
  'l67-convdec': {
    name: 'Convolutional decoder',
    at: 'L6–7 · slides 5–6',
    printed: { total: 13873, trainable: 13873, nonTrainable: 0, perLayer: [4464, 0, 4640, 4624, 145, 0] },
    model: {
      input: [30],
      layers: [
        { t: 'dense', units: 3 * 3 * 16 },
        { t: 'reshape', to: [3, 3, 16] },
        { t: 'conv2dT', filters: 32, k: 3, s: 2 },
        { t: 'conv2dT', filters: 16, k: 3, s: 2, pad: 'same' },
        { t: 'conv2dT', filters: 1, k: 3, s: 2, pad: 'same' },
        { t: 'reshape', to: [28, 28] },
      ],
    },
  },
  'l67-gan-g': {
    name: 'GAN generator (codings_size = 30)',
    at: 'L6–7 · slide 23',
    printed: {},
    model: { input: [30], layers: [{ t: 'dense', units: 100 }, { t: 'dense', units: 150 }, { t: 'dense', units: 28 * 28 }, { t: 'reshape', to: [28, 28] }] },
  },
  'l67-gan-d': {
    name: 'GAN discriminator',
    at: 'L6–7 · slide 23',
    printed: {},
    model: { input: [28, 28], layers: [{ t: 'flatten' }, { t: 'dense', units: 150 }, { t: 'dense', units: 100 }, { t: 'dense', units: 1 }] },
  },
  'l67-dcgan-g': {
    name: 'DCGAN generator (codings_size = 100)',
    at: 'L6–7 · slide 29',
    printed: {},
    model: {
      input: [100],
      layers: [
        { t: 'dense', units: 7 * 7 * 128 },
        { t: 'reshape', to: [7, 7, 128] },
        { t: 'bn' },
        { t: 'conv2dT', filters: 64, k: 5, s: 2, pad: 'same' },
        { t: 'bn' },
        { t: 'conv2dT', filters: 1, k: 5, s: 2, pad: 'same' },
      ],
    },
  },
  'l67-dcgan-d': {
    name: 'DCGAN discriminator',
    at: 'L6–7 · slide 29',
    printed: {},
    model: {
      input: [28, 28, 1],
      layers: [
        { t: 'conv2d', filters: 64, k: 5, s: 2, pad: 'same' },
        { t: 'dropout', rate: 0.4 },
        { t: 'conv2d', filters: 128, k: 5, s: 2, pad: 'same' },
        { t: 'dropout', rate: 0.4 },
        { t: 'flatten' },
        { t: 'dense', units: 1 },
      ],
    },
  },
  'l8-birnn': {
    name: 'Bidirectional SimpleRNN',
    at: 'L8 · slide 9',
    printed: { total: 674 },
    model: { input: [56, 2], layers: [{ t: 'bidir', layer: { t: 'simplernn', units: 16 } }, { t: 'dense', units: 2 }] },
  },
  'l9-policy': {
    name: 'CartPole policy network',
    at: 'L9 · slide 25',
    printed: {},
    note: 'Figure 18-5 (slide 23) draws 4 hidden neurons; the code has Dense(5).',
    model: { input: [4], layers: [{ t: 'dense', units: 5 }, { t: 'dense', units: 1 }] },
  },
  'l9-dqn': {
    name: 'Deep Q-network',
    at: 'L9 · slide 61',
    printed: {},
    model: { input: [4], layers: [{ t: 'dense', units: 32 }, { t: 'dense', units: 32 }, { t: 'dense', units: 2 }] },
  },
  'sample-q1c': {
    name: 'Sample paper Q1(c): Wide & Deep with one hidden layer',
    at: 'Sample Q1(c)',
    printed: {},
    model: {
      input: [10],
      layers: [
        { t: 'norm', id: 'normalized' },
        { t: 'dense', units: 20, id: 'hidden' },
        { t: 'concat', in: ['normalized', 'hidden'] },
        { t: 'dense', units: 3 },
      ],
    },
  },
  'practiceA-q1c': {
    name: 'Practice A Q1(c): a small CNN',
    at: 'Practice A Q1(c)',
    printed: {},
    model: {
      input: [32, 32, 3],
      layers: [
        { t: 'conv2d', filters: 16, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'conv2d', filters: 32, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'gap2d' },
        { t: 'dense', units: 10 },
      ],
    },
  },
  'practiceA-q1c-flat': {
    name: 'Practice A Q1(c) with Flatten instead of GAP',
    at: 'Practice A Q1(c)',
    printed: {},
    model: {
      input: [32, 32, 3],
      layers: [
        { t: 'conv2d', filters: 16, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'conv2d', filters: 32, k: 3, pad: 'same' },
        { t: 'maxpool2d', p: 2 },
        { t: 'flatten' },
        { t: 'dense', units: 10 },
      ],
    },
  },
  'practiceA-q2a': {
    name: 'Practice A Q2(a): memory cell, 3 inputs, 6 neurons, 1 output (Keras style)',
    at: 'Practice A Q2(a)',
    printed: {},
    model: { input: [5, 3], layers: [{ t: 'simplernn', units: 6 }, { t: 'dense', units: 1 }] },
  },
};
