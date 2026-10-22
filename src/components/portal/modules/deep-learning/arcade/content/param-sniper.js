/* ============================================================================
   PARAM SNIPER — CONTENT (pure data, slide-cited)
   ----------------------------------------------------------------------------
   RULES         one entry per layer type the slides cover: the concept the
                 count drills, where the slides state the rule or print a
                 count, the rule in the slides' words, and `beyond` where the
                 slides print a total but never the per-layer rule
   SHAPE_RULES   the same for output shapes
   SLIDE_MODELS  the models whose totals (and some per-layer counts) are
                 PRINTED on the slides: level-3 questions and test anchors.
                 Specs use maths/params.js's format.
   The arithmetic itself lives in maths/paramSniper.js.
   ========================================================================== */

export const RULES = {
  Dense: {
    concept: 'params.dense',
    src: { lecture: 1, slides: [36] },
    also: [{ lecture: 5, slides: [12] }],
    rule: 'weights of shape (n_inputs, n_neurons) and biases of shape (n_neurons,): one weight per input per neuron plus one bias per neuron',
    anchor: 'slide 36 prints 784 × 300 + 300 = 235,500 for Dense(300) on the flattened 28 × 28 image',
  },
  Conv2D: {
    concept: 'params.conv2d',
    src: { lecture: 3, slides: [22, 16] },
    rule: 'each filter has a kernel of f_h × f_w weights per input channel plus one bias; (f_h × f_w × f_c + 1) × f_n, independent of the image height and width',
    anchor: 'slide 22: (5 × 5 × 3 + 1) × 200 = 15,200',
  },
  Conv2DTranspose: {
    concept: 'params.convT',
    src: { lecture: 6, slides: [6] },
    rule: 'counted like a Conv2D: kernel height × width × input channels × filters, plus one bias per filter; slide 6’s conv_decoder summary prints 4,464 = 3 × 3 × 16 × 32 + 32, 4,640 and 4,624',
    anchor: 'conv_decoder.summary(): 4,464 · 4,640 · 4,624 · 145, total 13,873',
  },
  Conv1D: {
    concept: 'params.conv1d',
    src: { lecture: 4, slides: [50] },
    also: [{ lecture: 3, slides: [22] }],
    rule: 'a 1-D kernel of length k per input channel per filter, plus one bias per filter: k × c_in × filters + filters',
    anchor: 'slide 50 prints only the model total, 1,283 = 32 + 400 + 840 + 11',
    beyond: true,
    note: 'Slide 50 prints the total 1,283 for the Conv1D + GRU model; the per-layer Conv1D rule is Lecture 3’s Conv2D rule with a 1-D kernel, not stated on a slide.',
  },
  MaxPool2D: {
    concept: 'params.pool',
    src: { lecture: 3, slides: [25, 29] },
    rule: 'a pooling neuron has no weights: it aggregates its inputs with max or mean, a stateless sliding window',
  },
  AvgPool2D: {
    concept: 'params.pool',
    src: { lecture: 3, slides: [25, 29] },
    rule: 'a pooling neuron has no weights: it aggregates its inputs with max or mean, a stateless sliding window',
  },
  GlobalAvgPool2D: {
    concept: 'params.pool',
    src: { lecture: 3, slides: [31, 29] },
    rule: 'global average pooling averages every feature map to one number; like any pooling it has no weights',
  },
  Flatten: {
    concept: 'shape.flatten',
    src: { lecture: 1, slides: [36] },
    rule: 'Flatten only reshapes (28 × 28 → 784); the summary prints 0 params for it',
  },
  BatchNormalization: {
    concept: 'bn.params',
    src: { lecture: 2, slides: [24, 27] },
    also: [{ lecture: 2, slides: [23] }],
    rule: 'four parameter vectors per input feature: γ (scale) and β (shift) are trainable; the moving mean and moving variance are not. 4 × features in the summary, of which 2 × features are non-trainable',
    anchor: 'slide 27: BN on 784 features prints 3,136 = 4 × 784; the model’s non-trainable total is 2,368 = 2 × (784 + 300 + 100)',
  },
  SimpleRNN: {
    concept: 'params.simpleRnn',
    src: { lecture: 4, slides: [9, 27] },
    rule: 'W_x is n_inputs × n_neurons, W_h is n_neurons × n_neurons and b_h has n_neurons entries (slide 9); slide 27 prints 1 × 32 + 32 × 32 + 32 = 1,088 for SimpleRNN(32) on one feature',
    anchor: 'slides 27 and 29 print 1,088, 2,080 and 5,281',
  },
  LSTM: {
    concept: 'params.lstm',
    src: { lecture: 4, slides: [47, 43] },
    rule: 'four fully connected layers (i, f, o, g), each with its own W_x, W_h and bias, exactly as slide 47’s four equations: 4 × (n_inputs × units + units × units + units)',
    anchor: 'slide 43 prints 685 for LSTM(12) + Dense(1) on one feature',
  },
  GRU: {
    concept: 'params.gru',
    src: { lecture: 4, slides: [49] },
    rule: 'three blocks (z, r, g). Keras’s default GRU (reset_after=True) keeps two bias vectors per block, which is what the slide’s printed 1,401 uses: 3 × (n_inputs × units + units × units + 2 × units). Slide 49’s equations show one bias per block, which would give 1,341',
    anchor: 'slide 49 prints 1,401 for GRU(20) + Dense(1) on one feature',
  },
  Bidirectional: {
    concept: 'params.bidirectional',
    src: { lecture: 8, slides: [9, 7] },
    rule: 'a bidirectional layer runs two recurrent layers over the same inputs, one left to right and one right to left, so it has twice the parameters of the wrapped layer and twice its output width',
    anchor: 'slide 9 prints 674 for Bidirectional(SimpleRNN(16)) + Dense(2) on two features',
  },
  DenseTranspose: {
    concept: 'params.tied',
    src: { lecture: 5, slides: [20, 21] },
    rule: 'a tied decoder layer reuses the matching encoder layer’s kernel transposed and creates no kernel of its own; its only trainable parameters are its biases',
    anchor: 'slide 21: tied_ae has 82,414 trainable parameters against stacked_ae’s 163,814',
  },
  MultiHeadAttention: {
    concept: 'params.mha',
    src: { lecture: 8, slides: [43, 39] },
    rule: 'Keras MultiHeadAttention(num_heads=H, key_dim=K) on inputs of width d: query, key and value kernels [d, H, K] with biases [H, K], and an output kernel [H, K, d] with bias [d]',
    beyond: true,
    note: 'Slide 43 uses the layer (num_heads=8, key_dim=embed_size) but no slide prints its parameter count; the weight layout is Keras’s, verified against a real Keras run.',
  },
  Dropout: {
    concept: 'params.pool',
    src: { lecture: 2, slides: [62] },
    rule: 'dropout only switches neurons off during training; it has nothing to learn',
    beyond: true,
    note: 'No slide prints a Dropout row in a summary; the count is Keras’s.',
  },
};

export const SHAPE_RULES = {
  Conv2D: {
    concept: 'shape.conv2d',
    src: { lecture: 3, slides: [18, 20, 21] },
    rule: 'one feature map per filter; with "valid" padding the filter must fit inside the image, so each side loses f − 1 (slide 18: 70 − 7 + 1 = 64, 120 − 7 + 1 = 114); with "same" padding and stride 1 the output keeps the input size (slide 20), and with stride 2 it is about half (slide 21: 10 → 5)',
  },
  MaxPool2D: {
    concept: 'shape.pool',
    src: { lecture: 3, slides: [26, 29] },
    rule: 'a 2 × 2 pooling kernel with stride 2 halves the height and width (slide 26); pooling works on every channel independently, so the depth is unchanged (slide 29)',
  },
  AvgPool2D: {
    concept: 'shape.pool',
    src: { lecture: 3, slides: [26, 29] },
    rule: 'a 2 × 2 pooling kernel with stride 2 halves the height and width (slide 26); pooling works on every channel independently, so the depth is unchanged (slide 29)',
  },
  GlobalAvgPool2D: {
    concept: 'shape.pool',
    src: { lecture: 3, slides: [31] },
    rule: 'every feature map is averaged to a single number: an image batch [2, 70, 120, 3] becomes [2, 3]',
  },
  Flatten: {
    concept: 'shape.flatten',
    src: { lecture: 1, slides: [36] },
    rule: 'the 28 × 28 image becomes a row of 784 numbers: output shape (None, 784)',
  },
  Dense: {
    concept: 'params.dense',
    src: { lecture: 1, slides: [36] },
    rule: 'one output per neuron: Dense(300) prints (None, 300)',
  },
  SimpleRNN: {
    concept: 'rnn.deep',
    src: { lecture: 4, slides: [27, 29] },
    rule: 'a recurrent layer outputs one vector of `units` numbers for the last time step, (None, units); with return_sequences=True it outputs one per time step, (None, None, units)',
  },
  LSTM: { concept: 'rnn.deep', src: { lecture: 4, slides: [43, 29] }, rule: 'as for SimpleRNN: (None, units), or (None, None, units) with return_sequences=True' },
  GRU: { concept: 'rnn.deep', src: { lecture: 4, slides: [49, 29] }, rule: 'as for SimpleRNN: (None, units), or (None, None, units) with return_sequences=True' },
  Bidirectional: { concept: 'params.bidirectional', src: { lecture: 8, slides: [8, 14] }, rule: 'the forward and backward outputs are concatenated: twice the wrapped layer’s width (slide 14: two SimpleRNN(16) states become (None, 32))' },
};

/* Models whose totals the slides print. `ask` lists what a question may ask
   for. `lines` is the code as the slide shows it (trimmed). `layers` are the
   printed per-layer counts where the slide shows a summary. */
export const SLIDE_MODELS = [
  {
    id: 'l1.fmnist',
    name: 'the Fashion MNIST classifier',
    src: { lecture: 1, slides: [36] },
    input: [28, 28],
    specs: [{ type: 'Flatten' }, { type: 'Dense', units: 300 }, { type: 'Dense', units: 100 }, { type: 'Dense', units: 10 }],
    lines: ['Input(shape=[28, 28])', 'Flatten()', 'Dense(300, activation="relu")', 'Dense(100, activation="relu")', 'Dense(10, activation="softmax")'],
    printed: { total: 266610, layers: [0, 235500, 30100, 1010] },
    ask: ['total'],
    why: 'model.summary() on slide 36: flatten 0, dense 235,500 (784 × 300 + 300), dense 30,100 (300 × 100 + 100), dense 1,010 (100 × 10 + 10); total 266,610, all trainable.',
  },
  {
    id: 'l2.bn',
    name: 'the Batch Normalization MLP',
    src: { lecture: 2, slides: [27, 24] },
    input: [28, 28],
    specs: [{ type: 'Flatten' }, { type: 'BatchNormalization' }, { type: 'Dense', units: 300 }, { type: 'BatchNormalization' }, { type: 'Dense', units: 100 }, { type: 'BatchNormalization' }, { type: 'Dense', units: 10 }],
    lines: ['Input(shape=[28, 28])', 'Flatten()', 'BatchNormalization()', 'Dense(300, activation="relu")', 'BatchNormalization()', 'Dense(100, activation="relu")', 'BatchNormalization()', 'Dense(10, activation="softmax")'],
    printed: { total: 271346, trainable: 268978, nonTrainable: 2368, layers: [0, 3136, 235500, 1200, 30100, 400, 1010] },
    ask: ['total', 'trainable', 'nonTrainable'],
    why: 'Slide 27’s summary: BN rows 3,136 = 4 × 784, 1,200 = 4 × 300 and 400 = 4 × 100; total 271,346, of which 2,368 = 2 × (784 + 300 + 100) are the non-trainable moving means and variances (slides 23–24), leaving 268,978 trainable.',
  },
  {
    id: 'l3.conv200',
    name: 'the slide-22 convolutional layer',
    src: { lecture: 3, slides: [22] },
    input: [150, 100, 3],
    specs: [{ type: 'Conv2D', filters: 200, kernel: 5, strides: 1, padding: 'same' }],
    lines: ['Input(shape=[150, 100, 3])', 'Conv2D(200, kernel_size=5, strides=1, padding="same")'],
    printed: { total: 15200 },
    ask: ['total'],
    why: 'Slide 22: 200 filters of 5 × 5 on an RGB image have (5 × 5 × 3 + 1) × 200 = 15,200 parameters; the 150 × 100 image size plays no part.',
  },
  {
    id: 'l4.univar',
    name: 'univar_model',
    src: { lecture: 4, slides: [27] },
    input: [null, 1],
    specs: [{ type: 'SimpleRNN', units: 32 }, { type: 'Dense', units: 1 }],
    lines: ['Input(shape=[None, 1])', 'SimpleRNN(32)', 'Dense(1)'],
    printed: { total: 1121, layers: [1088, 33] },
    ask: ['total'],
    why: 'Slide 27 prints SimpleRNN(32) 1,088 (1 × 32 + 32 × 32 + 32) and Dense(1) 33 (32 + 1): 1,121 trainable parameters.',
  },
  {
    id: 'l4.deep',
    name: 'deep_model',
    src: { lecture: 4, slides: [29] },
    input: [null, 1],
    specs: [{ type: 'SimpleRNN', units: 32, returnSequences: true }, { type: 'SimpleRNN', units: 32, returnSequences: true }, { type: 'SimpleRNN', units: 32 }, { type: 'Dense', units: 1 }],
    lines: ['Input(shape=[None, 1])', 'SimpleRNN(32, return_sequences=True)', 'SimpleRNN(32, return_sequences=True)', 'SimpleRNN(32)', 'Dense(1)'],
    printed: { total: 5281, layers: [1088, 2080, 2080, 33] },
    ask: ['total'],
    why: 'Slide 29: the first SimpleRNN(32) has 1,088 parameters, the next two 2,080 each (their input is the 32-wide sequence: 32 × 32 + 32 × 32 + 32), Dense(1) 33: 5,281 in all.',
  },
  {
    id: 'l4.lstm',
    name: 'lstm_model',
    src: { lecture: 4, slides: [43] },
    input: [null, 1],
    specs: [{ type: 'LSTM', units: 12 }, { type: 'Dense', units: 1 }],
    lines: ['Input(shape=[None, 1])', 'LSTM(12)', 'Dense(1)'],
    printed: { total: 685 },
    ask: ['total'],
    why: 'Slide 43 prints 685: four FC layers (i, f, o, g, slide 47) each with 1 × 12 + 12 × 12 + 12 = 168 parameters make 672, and Dense(1) on 12 outputs adds 13.',
  },
  {
    id: 'l4.gru',
    name: 'gru_model',
    src: { lecture: 4, slides: [49] },
    input: [null, 1],
    specs: [{ type: 'GRU', units: 20 }, { type: 'Dense', units: 1 }],
    lines: ['Input(shape=[None, 1])', 'GRU(20)', 'Dense(1)'],
    printed: { total: 1401 },
    ask: ['total'],
    why: 'Slide 49 prints 1,401: Keras’s default GRU (reset_after=True) has three blocks with two bias vectors each, 3 × (1 × 20 + 20 × 20 + 2 × 20) = 1,380, plus Dense(1)’s 21. The slide’s equations show one bias per block, which would give 1,341.',
  },
  {
    id: 'l4.cnnGru',
    name: 'cnn_gru_model',
    src: { lecture: 4, slides: [50] },
    input: [null, 1],
    specs: [{ type: 'Conv1D', filters: 8, kernel: 3, strides: 1 }, { type: 'Conv1D', filters: 16, kernel: 3, strides: 2 }, { type: 'GRU', units: 10 }, { type: 'Dense', units: 1 }],
    lines: ['Input(shape=[None, 1])', 'Conv1D(8, kernel_size=3, strides=1)', 'Conv1D(16, kernel_size=3, strides=2)', 'GRU(10)', 'Dense(1)'],
    printed: { total: 1283 },
    ask: ['total'],
    why: 'Slide 50 prints 1,283 trainable parameters: Conv1D(8, 3) on one channel 3 × 1 × 8 + 8 = 32, Conv1D(16, 3) on 8 channels 3 × 8 × 16 + 16 = 400, GRU(10) on 16 inputs 3 × (16 × 10 + 10 × 10 + 2 × 10) = 840, Dense(1) 11.',
  },
  {
    id: 'l5.stacked',
    name: 'stacked_ae',
    src: { lecture: 5, slides: [12] },
    input: [28, 28],
    specs: [{ type: 'Flatten' }, { type: 'Dense', units: 100 }, { type: 'Dense', units: 30 }, { type: 'Dense', units: 100 }, { type: 'Dense', units: 784 }, { type: 'Reshape', target: [28, 28] }],
    lines: ['Input(shape=[28, 28])', 'Flatten()', 'Dense(100, activation="relu")', 'Dense(30, activation="relu")', 'Dense(100, activation="relu")', 'Dense(28 * 28)', 'Reshape([28, 28])'],
    printed: { total: 163814 },
    ask: ['total'],
    why: 'Slide 12: stacked_ae has 163,814 trainable parameters: (784 × 100 + 100) + (100 × 30 + 30) + (30 × 100 + 100) + (100 × 784 + 784) = 78,500 + 3,030 + 3,100 + 79,184.',
  },
  {
    id: 'l5.tied',
    name: 'tied_ae',
    src: { lecture: 5, slides: [21, 20] },
    input: [28, 28],
    specs: [{ type: 'Flatten' }, { type: 'Dense', units: 100 }, { type: 'Dense', units: 30 }, { type: 'DenseTranspose', units: 100 }, { type: 'DenseTranspose', units: 784 }, { type: 'Reshape', target: [28, 28] }],
    lines: ['Input(shape=[28, 28])', 'Flatten()', 'dense_1 = Dense(100, activation="relu")', 'dense_2 = Dense(30, activation="relu")', 'DenseTranspose(dense_2, activation="relu")', 'DenseTranspose(dense_1)', 'Reshape([28, 28])'],
    printed: { total: 82414 },
    ask: ['total'],
    why: 'Slide 21: tied_ae has 82,414 trainable parameters. The encoder keeps 78,500 + 3,030; each DenseTranspose reuses the encoder kernel transposed and trains only its biases: 100 + 784.',
  },
  {
    id: 'l67.convDecoder',
    name: 'conv_decoder',
    src: { lecture: 6, slides: [6, 5] },
    input: [30],
    specs: [{ type: 'Dense', units: 144 }, { type: 'Reshape', target: [3, 3, 16] }, { type: 'Conv2DTranspose', filters: 32, kernel: 3, strides: 2 }, { type: 'Conv2DTranspose', filters: 16, kernel: 3, strides: 2, padding: 'same' }, { type: 'Conv2DTranspose', filters: 1, kernel: 3, strides: 2, padding: 'same' }, { type: 'Reshape', target: [28, 28] }],
    lines: ['Input(shape=[30])', 'Dense(3 * 3 * 16)', 'Reshape((3, 3, 16))', 'Conv2DTranspose(32, 3, strides=2, activation="relu")', 'Conv2DTranspose(16, 3, strides=2, padding="same", activation="relu")', 'Conv2DTranspose(1, 3, strides=2, padding="same")', 'Reshape((28, 28))'],
    printed: { total: 13873, layers: [4464, 0, 4640, 4624, 145, 0] },
    ask: ['total'],
    why: 'Slide 6’s conv_decoder.summary(): Dense 4,464 (30 × 144 + 144), then Conv2DTranspose rows 4,640 (3 × 3 × 16 × 32 + 32), 4,624 (3 × 3 × 32 × 16 + 16) and 145 (3 × 3 × 16 × 1 + 1); total 13,873.',
  },
  {
    id: 'l8.biRnn',
    name: 'simple_biRNN',
    src: { lecture: 8, slides: [9] },
    input: [null, 2],
    specs: [{ type: 'Bidirectional', layer: { type: 'SimpleRNN', units: 16 } }, { type: 'Dense', units: 2 }],
    lines: ['InputLayer(input_shape=[None, 2])', 'Bidirectional(SimpleRNN(16))', 'Dense(2)'],
    printed: { total: 674 },
    ask: ['total'],
    why: 'Slide 9 prints 674 trainable params: each direction of SimpleRNN(16) on two features has 2 × 16 + 16 × 16 + 16 = 304, two directions 608, and Dense(2) on the 32-wide concatenation adds 32 × 2 + 2 = 66.',
  },
];
