// Code Lab cards: tab 6 · RNNs & time series (L4)
export const RNN = [
  {
    id: 'deep-rnn',
    title: 'Sequence-to-vector RNNs: one layer, then three',
    rating: 'core',
    why: 'Count each recurrent layer and explain return_sequences: which layers pass a whole sequence on, and which pass only the last output.',
    sources: [{ kind: 'lecture', lec: 4, slides: '24–29' }],
    blocks: ['L4 s27', 'L4 s29'],
    provenance: 'trimmed',
    inv: ['l4-univar-model', 'l4-deep-rnn', 'l4-simplernn-1'],
    file: 'deep_rnn.py',
    code: `univar_model = tf.keras.Sequential([
   tf.keras.layers.InputLayer(shape=[None, 1]),
   tf.keras.layers.SimpleRNN(32),
   tf.keras.layers.Dense(1) # no activation function by default
])
# …
deep_model = tf.keras.Sequential([
  tf.keras.layers.InputLayer(shape=[None, 1]),
  tf.keras.layers.SimpleRNN(32, return_sequences=True),  # 1,088 params
  tf.keras.layers.SimpleRNN(32, return_sequences=True),  # 2,080 params
  tf.keras.layers.SimpleRNN(32),                         # 2,080 params
  tf.keras.layers.Dense(1)                               #    33 params
])`,
    marks: [
      { n: 1, token: { line: 2, text: 'shape=[None, 1]' }, say: 'Any number of time steps, 1 value per step: inputs are [batch size, time steps, dimensionality].' },
      { n: 2, token: { line: 3, text: 'SimpleRNN(32)' }, say: 'Returns only the last step’s output, (None, 32): 32 × (1 + 32 + 1) = 1,088.' },
      { n: 3, token: { line: 9, text: 'return_sequences=True' }, say: 'Every step’s output goes on, so the next recurrent layer receives a sequence.' },
      { n: 4, lines: [11, 11], say: 'The last recurrent layer returns only its final state: 32 × (32 + 32 + 1) = 2,080.' },
    ],
    moves: {
      draw: 'deepRnn',
      count: 'deepRnn',
      say: 'Dense(1) has no activation, so the forecast isn’t capped at tanh’s 1. Validation MAE: about 27,703 for one layer, 29,672 for three.',
      forWhat: 'Forecasting the next value of a time series (tomorrow’s rail ridership) from a window of past values.',
    },
    slideCheck: 'Slide 27’s summary prints 1,088 + 33 = 1,121; slide 29’s comments give 5,281 in all. A single SimpleRNN(1) (slide 24) has 3 parameters and does badly: one neuron of memory, and tanh caps its output at 1.',
  },
  {
    id: 'forecast-ahead',
    title: 'Forecasting 14 steps: loop a one-step model, or predict all at once',
    rating: 'core',
    why: 'Sample Q2(a) iii asks how to predict several steps: give the two set-ups, their output layers and the shapes of X and y.',
    sources: [{ kind: 'lecture', lec: 4, slides: '34–38' }],
    blocks: ['L4 s34', 'L4 s35', 'L4 s38'],
    provenance: 'trimmed',
    inv: ['l4-rollout-loop', 'l4-ahead-datasets', 'l4-ahead-inspect', 'l4-ahead-model', 'l4-mulvar-frame'],
    file: 'forecast_ahead.py',
    code: `X = rail_valid.to_numpy()[np.newaxis, :seq_length, np.newaxis] # one instance
for step_ahead in range(14):
    y_pred_one = univar_model.predict(X)
    X = np.concatenate([X, y_pred_one.reshape(1, 1, 1)], axis=1)

def split_inputs_and_targets(mulvar_series, ahead=14, target_col=1):
    return mulvar_series[:, :-ahead], mulvar_series[:, -ahead:, target_col]
# …
ahead_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 5]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(14) ])
# Training code omitted...
X = mulvar_valid.to_numpy()[np.newaxis, :seq_length]  # shape [1, 56, 5]
Y_pred = ahead_model.predict(X)  # shape [1, 14]`,
    marks: [
      { n: 1, token: { line: 1, text: '[np.newaxis, :seq_length, np.newaxis]' }, say: 'One instance of 56 days, with batch and feature axes added: (1, 56, 1).' },
      { n: 2, lines: [2, 4], say: 'Predict one day, append it as the newest step, repeat 14 times: errors feed back in.' },
      { n: 3, lines: [7, 7], say: 'Each 70-step window splits into 56 input steps (5 features) and the next 14 rail values.' },
      { n: 4, token: { line: 12, text: 'Dense(14)' }, say: 'All 14 days at once from the last hidden state: output (1, 14).' },
    ],
    moves: {
      count: 'aheadModel',
      shapes: [
        { name: 'X batch', shape: '(32, 56, 5)', means: 'windows × 56 days × 5 features (bus, rail, next-day type ×3)' },
        { name: 'y batch', shape: '(32, 14)', means: 'the next 14 days of rail per window' },
      ],
      say: 'Validation MAE: 30,734 looping the one-step model, 33,887 with Dense(14).',
      forWhat: 'Forecasting several steps ahead: recursively with a one-step model, or in one shot with a multi-output head.',
    },
    slideCheck: 'Slide 36 prints the batch shapes (32, 56, 5) and (32, 14). The loop works because the input shape is [None, 1]: the input grows a step per prediction, from 56 to 69 steps.',
    xref: [{ to: 'p2-gru', text: 'Project 2 does both with GRUs' }],
  },
  {
    id: 'lstm-gru',
    title: 'LSTM and GRU layers: the gate counts',
    rating: 'core',
    why: 'Count an LSTM (4 gate layers) and a GRU (3, with a second bias in Keras 3), and link the GRU code to its equations.',
    sources: [{ kind: 'lecture', lec: 4, slides: '43–49' }],
    blocks: ['L4 s43', 'L4 s49'],
    provenance: 'verbatim',
    inv: ['l4-lstm-model', 'l4-gru-model'],
    file: 'lstm_gru.py',
    code: `# Number of trainable parameters: 685
lstm_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.LSTM(12),
    tf.keras.layers.Dense(1)
])

# Number of trainable parameters: 1401
gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.GRU(20),
    tf.keras.layers.Dense(1)
])`,
    marks: [
      { n: 1, token: { line: 4, text: 'LSTM(12)' }, say: 'Four gate layers (f, i, o, g): 4 × 12 × (1 + 12 + 1) = 672.' },
      { n: 2, lines: [1, 1], say: '672 + the Dense layer’s (12 + 1) = 685, as printed.' },
      { n: 3, token: { line: 11, text: 'GRU(20)' }, say: 'Three gate layers (z, r, g), one state h: 3 × 20 × (1 + 20 + 2) = 1,380.' },
      { n: 4, lines: [8, 8], say: '1,380 + 21 = 1,401: Keras 3 gives each GRU gate two bias vectors (reset_after=True).' },
    ],
    moves: {
      count: ['lstmModel', 'gruModel'],
      eq: [{
        name: 'GRU (slide 49)',
        tex: String.raw`\begin{aligned} \mathbf{z}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xz} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hz} + \mathbf{b}_{z}^{\top}\right) \\ \mathbf{r}_{(t)}^{\top} &= \sigma\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xr} + \mathbf{h}_{(t-1)}^{\top}\mathbf{W}_{hr} + \mathbf{b}_{r}^{\top}\right) \\ \mathbf{g}_{(t)}^{\top} &= \tanh\left(\mathbf{x}_{(t)}^{\top}\mathbf{W}_{xg} + \left(\mathbf{r}_{(t)}^{\top}\mathbf{W}_{hg} \otimes \mathbf{h}_{(t-1)}^{\top}\right) + \mathbf{b}_{g}^{\top}\right) \\ \mathbf{h}_{(t)} &= \mathbf{z}_{(t)} \otimes \mathbf{h}_{(t-1)} + \left(1 - \mathbf{z}_{(t)}\right) \otimes \mathbf{g}_{(t)} \end{aligned}`,
        plain: 'z(t)ᵀ = σ(x(t)ᵀ W_xz + h(t−1)ᵀ W_hz + b_zᵀ); r(t)ᵀ = σ(x(t)ᵀ W_xr + h(t−1)ᵀ W_hr + b_rᵀ); g(t)ᵀ = tanh(x(t)ᵀ W_xg + (r(t)ᵀ W_hg ⊗ h(t−1)ᵀ) + b_gᵀ); h(t) = z(t) ⊗ h(t−1) + (1 − z(t)) ⊗ g(t)',
        line: 11,
      }],
      forWhat: 'Sequences that need a longer memory: the gates learn what to keep and what to forget, unlike a SimpleRNN.',
    },
    slideCheck: 'Slide 49’s equations have one bias per gate, which would give 3 × 20 × (1 + 20 + 1) + 21 = 1,341. The printed 1,401 is Keras 3’s default (reset_after=True), with a second bias per gate. Validation MAE: 30,262 (LSTM), 26,497 (GRU).',
    xref: [{ to: 'p2-gru', text: 'Project 2’s GRU(16) on 2 inputs: 960' }],
  },
  {
    id: 'conv1d-gru',
    title: 'A Conv1D front end before a GRU',
    rating: 'core',
    why: 'Give the shape after each layer (valid padding and stride shorten the sequence) and count the Conv1D and GRU layers.',
    sources: [{ kind: 'lecture', lec: 4, slides: '50' }],
    blocks: ['L4 s50'],
    provenance: 'verbatim',
    inv: ['l4-cnn-gru'],
    file: 'conv1d_gru.py',
    code: `# Number of trainable parameters: 1283
cnn_gru_model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 1]),
    tf.keras.layers.Conv1D(filters=8, kernel_size=3, strides=1, activation="relu"),
    tf.keras.layers.Conv1D(filters=16, kernel_size=3, strides=2, activation="relu"),
    tf.keras.layers.GRU(10),
    tf.keras.layers.Dense(1)
])`,
    marks: [
      { n: 1, token: { line: 4, text: 'kernel_size=3, strides=1' }, say: 'Eight width-3 kernels along time: (3 × 1 + 1) × 8 = 32; 56 → 54 steps.' },
      { n: 2, token: { line: 5, text: 'strides=2' }, say: 'Stride 2 roughly halves the sequence: ⌊(54 − 3) / 2⌋ + 1 = 26 steps of 16 channels.' },
      { n: 3, token: { line: 6, text: 'GRU(10)' }, say: 'Reads 16 channels per step: 3 × 10 × (16 + 10 + 2) = 840.' },
      { n: 4, lines: [1, 1], say: '32 + 400 + 840 + 11 = 1,283, as printed.' },
    ],
    moves: {
      draw: 'conv1dGru',
      count: 'conv1dGru',
      say: 'Drawn and counted for 56-day windows; the code’s input is [None, 1], and lengths don’t change the counts.',
      forWhat: 'Long sequences: Conv1D layers find short local patterns and shorten the sequence before the GRU reads it.',
    },
    slideCheck: 'Conv1D’s defaults are padding "valid" and stride 1. The prose example uses 10 kernels; the code uses 8, then 16. Validation MAE 30,209.',
  },
];
