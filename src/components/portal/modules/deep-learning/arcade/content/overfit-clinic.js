/* ============================================================================
   OVERFIT CLINIC — CONTENT (pure data, slide-cited)
   ----------------------------------------------------------------------------
   The hub's exam boss: a sick model comes in with a chart, a summary or a
   sample strip; the player names the failure mode the slides name (Dx), then
   prescribes the fix the slides give for it (Rx), then (level 3) answers a
   follow-up that only makes sense once the case is understood.

   Sources: Documents/cits5017/lectures/*.pdf (every slide cited below was
   rendered at 110 dpi and read). src.lecture 6 = the shared Lectures 6–7 deck.

     SLIDE_COUNTS   slides per deck (the check keeps every src inside them)
     UI, INTRO, LEVEL_NAMES, PROMPTS        copy
     CHART          axis / legend / aria words per chart type
     DIAGNOSES      the failure modes: label, concept, src, `avoid` (other
                    diagnoses too close to offer as a wrong answer)
     FIXES          the slides' fixes: label, concept, src, `treats` (the
                    failure modes the slides give this fix for) and `avoid`
                    (failure modes it could arguably help, so it is never
                    offered there as a wrong answer). A wrong option on an Rx
                    item is always a fix that treats ANOTHER case's failure.
     CASES          the patients: chart generator, complaint line, Dx why,
                    Rx per allowed fix, optional level-3 follow-up (FU)

   Templates use %name% placeholders, filled by maths/overfitClinic.js from
   the generated chart. Every chart is the page's own illustration of the
   named failure (the slides' figures are not reproduced), except where a
   chart is drawn from numbers printed on the slides (`fromSlides: true`).
   ========================================================================== */

export const SLIDE_COUNTS = { 1: 64, 2: 68, 3: 53, 4: 52, 5: 27, 6: 32, 8: 51 };

export const LEVEL_NAMES = ['diagnose', 'diagnose + prescribe', 'multi-step cases'];

export const INTRO = {
  line: 'Read the chart, name what the slides call this failure, then prescribe their fix.',
  controls: [
    'Each patient brings a chart, a model summary or a sample strip (this page’s own illustration of the failure).',
    'Pick with a tap or keys 1–4. Level 2 adds the prescription, level 3 a follow-up per case.',
    'Ordering steps: tap the cards in order (keys 1–6), Backspace undoes, Enter submits.',
  ],
};

export const UI = {
  own: 'this page’s own illustration of the failure, not a slide figure',
  fromSlides: 'drawn from the numbers printed on the slides',
  patient: 'patient %n% of %total%',
  lecture: { 1: 'Lecture 1', 2: 'Lecture 2', 3: 'Lecture 3', 4: 'Lecture 4', 5: 'Lecture 5', 6: 'Lectures 6–7', 8: 'Lecture 8' },
  steps: { dx: 'diagnose', rx: 'prescribe', fu: 'follow-up' },
  dx: 'Dx',
  rx: 'Rx',
  pending: '…',
  stamp: { dx: 'diagnosed', rx: 'prescribed', fu: 'discharged' },
  pickAria: 'Your answer',
  stepsAria: 'Steps of this case',
  noteAria: 'The case notes',
  maths: 'Show the numbers',
  offChart: 'off the chart',
  logScale: 'log scale',
  orderHint: 'Tap the cards in order (keys 1–%n%); Backspace undoes; Enter submits.',
  slotsHint: 'Fill the slots top to bottom (keys 1–%n%); Backspace undoes; Enter submits.',
  orderAria: 'Cards to put in order',
  slotsAria: 'Slots to fill',
  undo: 'undo',
  submit: 'submit',
  submitKey: 'Enter',
  gap: '…',
  answerMeta: 'the slide’s order',
  secondChart: 'second chart',
};

export const PROMPTS = {
  dx: 'What is wrong with this model?',
  rx: 'Which fix do the slides prescribe for it?',
};

/* ── chart words (axis labels, legends, aria) ───────────────────────────── */
export const CHART = {
  overfit: { aria: 'Learning curves: training and validation loss per epoch', x: 'epoch', y: 'loss', train: 'training loss', valid: 'validation loss' },
  diverge: { aria: 'Training loss per epoch', x: 'epoch', y: 'loss', train: 'training loss' },
  slow: { aria: 'Training loss per epoch', x: 'epoch', y: 'loss', train: 'training loss' },
  spiky: { aria: 'Training loss per iteration', x: 'iteration', y: 'loss', train: 'training loss' },
  adagrad: { aria: 'Training loss per epoch, and the step size relative to the first step', x: 'epoch', y: 'loss', train: 'training loss', optimum: 'the global optimum', y2: 'step size ÷ first step', step: 'step size' },
  sweep: { aria: 'Loss against the learning rate, swept from 10⁻⁵ to 10 over 500 iterations', x: 'learning rate η (log scale)', y: 'loss', train: 'loss' },
  gradBars: { aria: 'Size of the gradient reaching each layer during backpropagation', x: 'layer (1 = lowest)', y: 'gradient size (log scale)', layer: 'layer %i%' },
  deadBars: { aria: 'Share of training inputs on which each neuron outputs more than 0', x: 'neuron', y: 'share of inputs with output > 0', dead: 'outputs only 0' },
  forecast: { aria: 'The series and the model’s one-step predictions per day', x: 'day', y: 'value', truth: 'series', pred: 'predictions' },
  stateGrowth: { aria: 'Size of the recurrent layer’s outputs at each time step', x: 'time step', y: 'size of the outputs (log scale)', series: 'outputs' },
  trace: { aria: 'How much of each input is left in the final state', x: 'time step of the input', y: 'trace left in the final state' },
  maeBars: { aria: 'Validation MAE of two forecasters (lower is better)', x: 'model', y: 'validation MAE' },
  reconBars: { aria: 'Reconstruction error on training images and on new images', x: 'images', y: 'reconstruction error (MSE)', train: 'training images', fresh: 'new images' },
  classHist: { aria: 'Generated images per class', x: 'class of the generated image', y: 'images out of 100' },
  oscillate: { aria: 'One generator weight and one discriminator weight across training iterations', x: 'iteration', y: 'weight value', g: 'a generator weight', d: 'a discriminator weight' },
  attnHeat: { aria: 'Decoder self-attention weights: rows are the word being processed, columns the words attended to', rows: 'processing ↓', cols: 'attends to →' },
  softmaxHeat: { aria: 'Attention weights softmax(QKᵀ): rows are queries, columns keys', rows: 'query ↓', cols: 'key →', row: 'query %i%', col: 'key %i%' },
  strips: { aria: 'The encoder’s output at the word “right” in three phrases', rows: 'phrase ↓', cols: 'output vector at “right” →' },
  encdec: { aria: 'An encoder–decoder: the encoder reads “I like soccer”, only its final hidden state reaches the decoder, the decoder writes “Me gusta el fútbol”', enc: 'encoder', dec: 'decoder', state: 'final hidden state', path: 'path: %n% steps' },
  code: { aria: 'Model code and summary' },
};

/* ── the failure modes ──────────────────────────────────────────────────── */
export const DIAGNOSES = {
  overfit: { label: 'Overfitting the training set', concept: 'reg.earlyStopping', src: { lecture: 2, slides: [4] },
    avoid: ['aeCopy', 'tooBig', 'fewLabels', 'bigKernel'] },
  lrHigh: { label: 'Learning rate way too high: training diverges', concept: 'optim.learningRate', src: { lecture: 2, slides: [48] },
    avoid: ['exploding', 'rnnExplode', 'bigBatch', 'ganUnstable'] },
  lrLow: { label: 'Learning rate too small: training is slow', concept: 'sched.why', src: { lecture: 2, slides: [48] },
    avoid: ['vanishing', 'adagrad'] },
  bigBatch: { label: 'Large batch size: unstable at the start of training', concept: 'optim.batchSize', src: { lecture: 1, slides: [61] },
    avoid: ['lrHigh', 'ganUnstable', 'exploding'] },
  vanishing: { label: 'Vanishing gradients', concept: 'init.vanishing', src: { lecture: 2, slides: [5] },
    avoid: ['deadRelu', 'lrLow', 'adagrad', 'shortMemory', 'saturatedSoftmax'] },
  exploding: { label: 'Exploding gradients', concept: 'init.vanishing', src: { lecture: 2, slides: [5] },
    avoid: ['lrHigh', 'rnnExplode', 'bigBatch'] },
  deadRelu: { label: 'Dying ReLUs', concept: 'act.relu', src: { lecture: 2, slides: [10] },
    avoid: ['vanishing'] },
  adagrad: { label: 'AdaGrad stopping too early', concept: 'optim.adagrad', src: { lecture: 2, slides: [40] },
    avoid: ['lrLow', 'vanishing'] },
  fewLabels: { label: 'Insufficient labelled data', concept: 'transfer.reuse', src: { lecture: 2, slides: [4] },
    avoid: ['overfit'] },
  bigKernel: { label: 'Convolution kernels that are too large', concept: 'arch.typical', src: { lecture: 3, slides: [34] },
    avoid: ['overfit'] },
  tanhRange: { label: 'tanh output: only values between −1 and +1', concept: 'forecast.simpleRnn1', src: { lecture: 4, slides: [26] },
    avoid: ['tinyMemory'] },
  tinyMemory: { label: 'One recurrent neuron: extremely limited memory', concept: 'forecast.simpleRnn1', src: { lecture: 4, slides: [25] },
    avoid: ['tanhRange', 'shortMemory'] },
  tooBig: { label: 'A deep RNN a bit too large for the task', concept: 'rnn.deep', src: { lecture: 4, slides: [29] },
    avoid: ['overfit', 'aeCopy'] },
  rnnExplode: { label: 'Unstable gradients in an RNN: exploding outputs', concept: 'rnn.longSeq', src: { lecture: 4, slides: [40] },
    avoid: ['exploding', 'lrHigh', 'shortMemory'] },
  shortMemory: { label: 'Short-term memory: the first inputs are forgotten', concept: 'rnn.longSeq', src: { lecture: 4, slides: [40, 42] },
    avoid: ['finalState', 'rnnExplode', 'tinyMemory', 'vanishing'] },
  aeCopy: { label: 'An autoencoder that is too powerful', concept: 'ae.stacked', src: { lecture: 5, slides: [10] },
    avoid: ['overfit', 'tooBig'] },
  modeCollapse: { label: 'Mode collapse', concept: 'gan.modeCollapse', src: { lecture: 6, slides: [27] },
    avoid: ['ganUnstable'] },
  ganUnstable: { label: 'Oscillating, unstable GAN parameters', concept: 'gan.instability', src: { lecture: 6, slides: [26, 27] },
    avoid: ['modeCollapse', 'lrHigh', 'bigBatch'] },
  noMask: { label: 'The decoder attends to later words: no causal mask', concept: 'transformer.mask', src: { lecture: 8, slides: [31] },
    avoid: [] },
  finalState: { label: 'Only the encoder’s final state reaches the decoder', concept: 'encdec.finalState', src: { lecture: 8, slides: [18, 20] },
    avoid: ['shortMemory', 'causalEncoder'] },
  saturatedSoftmax: { label: 'Unscaled scores saturating the softmax', concept: 'transformer.scaling', src: { lecture: 8, slides: [38] },
    avoid: ['vanishing'] },
  causalEncoder: { label: 'A causal encoder that cannot look ahead', concept: 'encdec.causal', src: { lecture: 8, slides: [6] },
    avoid: ['finalState'] },
};

/* ── the fixes the slides name ──────────────────────────────────────────── */
export const FIXES = {
  earlyStop: { label: 'Early stopping: EarlyStopping(patience=10, restore_best_weights=True)', concept: 'reg.earlyStopping',
    src: { lecture: 1, slides: [52, 59, 62] }, treats: ['overfit'], avoid: ['aeCopy', 'tooBig'] },
  l2: { label: 'ℓ2 regularization: kernel_regularizer=l2(0.01)', concept: 'reg.l1l2',
    src: { lecture: 2, slides: [60] }, treats: ['overfit'], avoid: ['aeCopy', 'tooBig'] },
  dropout: { label: 'Dropout: Dropout(rate=0.2) before each Dense layer', concept: 'reg.dropout',
    src: { lecture: 2, slides: [62, 63, 64] }, treats: ['overfit', 'rnnExplode'], avoid: ['aeCopy', 'tooBig'] },
  augment: { label: 'Data augmentation: realistic variants of each training image', concept: 'reg.dataAugmentation',
    src: { lecture: 3, slides: [39, 40] }, treats: ['overfit'], avoid: ['aeCopy', 'tooBig', 'fewLabels'] },
  lrLower: { label: 'Lower the learning rate (best: about half the rate where training diverges)', concept: 'optim.learningRate',
    src: { lecture: 1, slides: [60] }, treats: ['lrHigh', 'rnnExplode'], avoid: ['bigBatch', 'exploding', 'ganUnstable'] },
  lrSchedule: { label: 'Start with a high learning rate, then reduce it (a learning schedule)', concept: 'sched.why',
    src: { lecture: 2, slides: [48, 49] }, treats: ['lrLow'], avoid: ['lrHigh', 'adagrad', 'bigBatch'] },
  warmup: { label: 'Learning rate warmup', concept: 'optim.batchSize',
    src: { lecture: 1, slides: [61] }, treats: ['bigBatch'], avoid: ['lrHigh', 'exploding', 'ganUnstable', 'rnnExplode'] },
  init: { label: 'Glorot initialization (σ² = 1/fan_avg)', concept: 'init.glorot',
    src: { lecture: 2, slides: [7, 8] }, treats: ['vanishing', 'exploding', 'rnnExplode'], avoid: ['deadRelu'] },
  nonsat: { label: 'A nonsaturating activation: ReLU or one of its variants', concept: 'act.which',
    src: { lecture: 2, slides: [10, 11] }, treats: ['vanishing'], avoid: ['deadRelu', 'exploding', 'lrLow'] },
  bn: { label: 'Batch Normalization in every hidden layer', concept: 'bn.algorithm',
    src: { lecture: 2, slides: [23, 25] }, treats: ['vanishing', 'exploding'],
    avoid: ['overfit', 'lrHigh', 'lrLow', 'rnnExplode', 'bigBatch', 'ganUnstable', 'deadRelu'] },
  clip: { label: 'Gradient clipping: SGD(clipvalue=1.0)', concept: 'clip.gradient',
    src: { lecture: 2, slides: [29] }, treats: ['exploding', 'rnnExplode'], avoid: ['lrHigh', 'bigBatch', 'ganUnstable'] },
  leaky: { label: 'Leaky ReLU: LeakyReLU(negative_slope=0.2)', concept: 'act.leakyRelu',
    src: { lecture: 2, slides: [11, 12] }, treats: ['deadRelu'], avoid: ['vanishing', 'ganUnstable'] },
  rmsprop: { label: 'RMSProp: RMSprop(learning_rate=0.001, rho=0.9)', concept: 'optim.rmsprop',
    src: { lecture: 2, slides: [41, 42] }, treats: ['adagrad'], avoid: ['rnnExplode', 'lrLow'] },
  transfer: { label: 'Transfer learning: reuse a similar model’s layers, new output layer', concept: 'transfer.freeze',
    src: { lecture: 2, slides: [30, 31] }, treats: ['fewLabels'], avoid: ['overfit'] },
  stack3: { label: 'Two stacked 3 × 3 convolutional layers instead of one 5 × 5', concept: 'arch.typical',
    src: { lecture: 3, slides: [34] }, treats: ['bigKernel'], avoid: ['overfit'] },
  denseOut: { label: 'A Dense(1) output layer with no activation', concept: 'forecast.univar',
    src: { lecture: 4, slides: [26] }, treats: ['tanhRange'], avoid: [] },
  biggerRnn: { label: 'A larger recurrent layer, say 32 recurrent neurons', concept: 'forecast.univar',
    src: { lecture: 4, slides: [26] }, treats: ['tinyMemory'], avoid: ['shortMemory'] },
  rnnTanh: { label: 'A smaller learning rate or a saturating activation (tanh)', concept: 'rnn.longSeq',
    src: { lecture: 4, slides: [40] }, treats: ['rnnExplode'], avoid: ['lrHigh', 'exploding', 'deadRelu'] },
  lstm: { label: 'LSTM cells (or GRU cells): long-term memory', concept: 'lstm.cell',
    src: { lecture: 4, slides: [42, 48] }, treats: ['shortMemory'], avoid: ['finalState', 'rnnExplode', 'tinyMemory'] },
  lessPowerful: { label: 'An autoencoder that is not so powerful', concept: 'ae.stacked',
    src: { lecture: 5, slides: [10] }, treats: ['aeCopy'], avoid: ['overfit', 'tooBig'] },
  dcgan: { label: 'Follow the DCGAN guidelines for stable convolutional GANs', concept: 'dcgan.guidelines',
    src: { lecture: 6, slides: [28] }, treats: ['ganUnstable'], avoid: ['modeCollapse'] },
  mask: { label: 'The masking operation: masked multi-head attention', concept: 'transformer.mask',
    src: { lecture: 8, slides: [31] }, treats: ['noMask'], avoid: [] },
  attention: { label: 'Attention: a weighted sum of all the encoder outputs at each step', concept: 'attn.weightedSum',
    src: { lecture: 8, slides: [19, 20] }, treats: ['finalState', 'shortMemory'], avoid: ['causalEncoder'] },
  scale: { label: 'Scale the similarity scores by 1/√d_keys', concept: 'transformer.scaling',
    src: { lecture: 8, slides: [37, 38] }, treats: ['saturatedSoftmax'], avoid: ['vanishing'] },
  bidir: { label: 'A bidirectional recurrent layer', concept: 'encdec.bidirectional',
    src: { lecture: 8, slides: [7] }, treats: ['causalEncoder'], avoid: ['finalState', 'shortMemory'] },
};

/* ── the patients ───────────────────────────────────────────────────────── */
// hard: 1–3 (rounds ramp by it). levels: where the case may appear.
// group: cases on the same model never share a round.
export const CASES = [
  /* ── Lecture 1 ─────────────────────────────────────────────────────── */
  {
    id: 'l1-overfit', lecture: 1, chart: 'overfit', dx: 'overfit', hard: 1, levels: [1, 2, 3],
    complaint: 'An MLP’s learning curves, one point per epoch.',
    dxWhy: 'Training loss keeps falling while validation loss turns back up after epoch %best%: the network has started overfitting the training set (slide 59).',
    dxSrc: { lecture: 1, slides: [59] },
    rx: {
      earlyStop: { why: 'Grow the network until it starts overfitting, then use early stopping (slide 59); the EarlyStopping callback interrupts training when no progress is observed on the validation set for a number of epochs set by patience (slide 52).', src: { lecture: 1, slides: [52, 59] } },
    },
    fu: {
      type: 'stopEpoch', concept: 'reg.earlyStopping', src: { lecture: 1, slides: [52] },
      prompt: 'Train this run again with EarlyStopping(patience=10). After which epoch is training interrupted?',
      label: 'epoch %n%',
      why: 'The validation loss is lowest at epoch %best%; with no progress on the validation set for patience = 10 epochs, training is interrupted after epoch %stop% (slide 52).',
    },
  },
  {
    id: 'l1-lr-high', lecture: 1, chart: 'diverge', dx: 'lrHigh', hard: 1, levels: [1, 2, 3],
    complaint: 'Training loss of an MLP, one point per epoch.',
    dxWhy: 'The loss dips for a moment, then shoots up off the chart: the learning rate is above the maximum learning rate, the one above which the training algorithm diverges (slide 60).',
    dxSrc: { lecture: 1, slides: [60] },
    rx: {
      lrLower: { why: 'In general the optimal learning rate is about half of the maximum learning rate, the learning rate above which the training algorithm diverges (slide 60).', src: { lecture: 1, slides: [60] } },
    },
    fu: {
      type: 'sweep', concept: 'optim.learningRate', src: { lecture: 1, slides: [60] },
      prompt: 'To find a good rate you sweep it from 10⁻⁵ to 10 over 500 iterations. Reading this sweep, which learning rate does slide 60 point to?',
      label: 'η = %v%',
      why: 'The loss starts to shoot up at about $\\eta = %up%$; the optimal learning rate is about 10 times lower than the learning rate there: $\\eta \\approx %ans%$ (slide 60).',
    },
  },
  {
    id: 'l1-big-batch', lecture: 1, chart: 'spiky', dx: 'bigBatch', hard: 2, levels: [1, 2],
    complaint: 'Batch size: the largest that fits in the GPU RAM.',
    dxWhy: 'The loss jumps about in the first iterations and only then settles: in practice, large batch sizes often lead to training instabilities, especially at the beginning of training (slide 61).',
    dxSrc: { lecture: 1, slides: [61] },
    rx: {
      warmup: { why: 'Slide 61: learning rate warmup has been suggested to use with large batch sizes.', src: { lecture: 1, slides: [61] } },
    },
  },

  /* ── Lecture 2 ─────────────────────────────────────────────────────── */
  {
    id: 'l2-lr-low', lecture: 2, chart: 'slow', dx: 'lrLow', hard: 2, levels: [1, 2],
    complaint: 'Training loss after many epochs of gradient descent.',
    dxWhy: 'After %E% epochs the loss is still falling at the same slow pace: with $\\eta$ too small, training will eventually converge to the optimum, but it will take a very long time (slide 48, Figure 11-9).',
    dxSrc: { lecture: 2, slides: [48] },
    rx: {
      lrSchedule: { why: 'Start with a high learning rate, then reduce it once training stops making fast progress: you reach a good solution faster than with the optimal constant learning rate (slides 48–49).', src: { lecture: 2, slides: [48, 49] } },
    },
  },
  {
    id: 'l2-vanishing', lecture: 2, chart: 'gradBars', dx: 'vanishing', hard: 1, levels: [1, 2, 3],
    complaint: 'A deep MLP: logistic (sigmoid) activations, weights drawn from N(0, 1).',
    dxWhy: 'The gradient gets smaller and smaller on its way down: layer 1 receives %ratio% times less than layer %L%, so Gradient Descent leaves the lower layers’ weights virtually unchanged (slides 5–6).',
    dxSrc: { lecture: 2, slides: [5, 6] },
    rx: {
      init: { why: 'Glorot and Bengio’s initialization for the logistic activation: random weights with mean 0 and $\\sigma^2 = 1/\\text{fan}_{\\text{avg}}$ (slides 7–8), instead of the $\\mathcal{N}(0, 1)$ initialization that, combined with the logistic function, caused the problem (slides 5–6).', src: { lecture: 2, slides: [7, 8] } },
      nonsat: { why: 'The logistic function saturates at 0 or 1 with a derivative extremely close to 0 (slide 6); ReLU does not saturate for positive values, and its variants were proposed to overcome dying ReLUs (slides 10–11).', src: { lecture: 2, slides: [6, 10, 11] } },
      bn: { why: 'Batch Normalization normalizes each hidden layer’s input to mean 0 and variance 1 (slide 23); with it the vanishing gradients problem was so strongly reduced that saturating activations such as tanh could be used (slide 25).', src: { lecture: 2, slides: [23, 25] } },
    },
    fuRx: ['nonsat', 'bn'],
    fu: {
      type: 'pick', concept: 'init.which', src: { lecture: 2, slides: [8] },
      prompt: 'This network keeps its logistic activation. Which initialization does Table 11-1 pair with it?',
      choices: [
        { key: 'glorot', label: 'Glorot · σ² = 1/fan_avg' },
        { key: 'he', label: 'He · σ² = 2/fan_in' },
        { key: 'lecun', label: 'LeCun · σ² = 1/fan_in' },
      ],
      answer: 'glorot',
      why: 'Table 11-1: Glorot for None, tanh, sigmoid and softmax ($\\sigma^2 = 1/\\text{fan}_{\\text{avg}}$); He for ReLU and its variants ($2/\\text{fan}_{\\text{in}}$); LeCun for SELU ($1/\\text{fan}_{\\text{in}}$) (slide 8).',
    },
  },
  {
    id: 'l2-exploding', lecture: 2, chart: 'gradBars', dx: 'exploding', hard: 2, levels: [1, 2, 3],
    complaint: 'A deep network; the size of the gradient reaching each layer during backpropagation.',
    dxWhy: 'The gradient grows layer by layer on its way down: layer 1 receives %ratio% times more than layer %L%. Gradients that become larger and larger are the exploding gradients problem (slide 5).',
    dxSrc: { lecture: 2, slides: [5] },
    rx: {
      clip: { why: 'Gradient clipping is a popular technique to lessen the exploding gradients problem: clip the gradients during backpropagation so that they never exceed some threshold, e.g. SGD(clipvalue=1.0) (slide 29).', src: { lecture: 2, slides: [29] } },
    },
    fu: {
      type: 'clip', concept: 'clip.gradient', src: { lecture: 2, slides: [29] },
      prompt: 'With SGD(clipvalue=1.0), what becomes of the gradient vector [%g%]?',
      why: 'clipvalue=1.0 clips every component of the gradient vector to a value between −1.0 and 1.0: [%g%] → [%c%]. Use clipnorm=1.0 instead if you want to retain the gradient vector’s orientation (slide 29).',
    },
  },
  {
    id: 'l2-dying-relu', lecture: 2, chart: 'deadBars', dx: 'deadRelu', hard: 2, levels: [1, 2, 3],
    complaint: 'A Dense(…, activation="relu") hidden layer, measured over the training set.',
    dxWhy: '%dead% of the %n% neurons never output anything other than 0: they have “died”, which happens when the input to ReLU is negative (slide 10).',
    dxSrc: { lecture: 2, slides: [10] },
    rx: {
      leaky: { why: 'To overcome dying ReLUs, variants of ReLU were proposed; leaky ReLU, $\\text{LeakyReLU}_\\alpha(z) = \\max(\\alpha z, z)$, keeps a small slope for negative values (slides 11–12).', src: { lecture: 2, slides: [11, 12] } },
    },
    fu: {
      type: 'pick', concept: 'act.leakyRelu', src: { lecture: 2, slides: [11, 12] },
      prompt: 'Which leak α did researchers find tends to give better performance?',
      choices: [
        { key: 'a001', label: 'α = 0.01' },
        { key: 'a02', label: 'α = 0.2' },
        { key: 'a03', label: 'α = 0.3' },
      ],
      answer: 'a02',
      why: 'Slide 11: α is a small constant, e.g. 0.01, but a larger leak, α = 0.2, tends to give better performance; 0.3 is only Keras’s default (slide 12).',
    },
  },
  {
    id: 'l2-adagrad', lecture: 2, chart: 'adagrad', dx: 'adagrad', hard: 3, levels: [1, 2, 3],
    complaint: 'optimizer = tf.keras.optimizers.Adagrad(learning_rate=0.001)',
    dxWhy: 'The step size has shrunk to %pct% of its first value and the loss has stopped well above the optimum: AdaGrad scales the learning rate down so much that it stops entirely before reaching the global optimum (slide 40).',
    dxSrc: { lecture: 2, slides: [38, 40] },
    rx: {
      rmsprop: { why: 'RMSProp overcomes AdaGrad slowing down too fast: $\\mathbf{s}$ accumulates the error gradient magnitudes from the most recent iterations, with decay rate $\\rho = 0.9$ (slides 41–42).', src: { lecture: 2, slides: [41, 42] } },
    },
    fu: {
      type: 'adagradS', concept: 'optim.adagrad', src: { lecture: 2, slides: [38, 41] },
      prompt: 'One weight’s gradients are %g1% and then %g2%, with s starting at 0. What is AdaGrad’s s after the second step?',
      why: 'AdaGrad: $\\mathbf{s} \\leftarrow \\mathbf{s} + \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)$, so s = 0 + %a% = %a%, then %a% + %b% = %s%. It only ever grows, so the step keeps shrinking (slide 38); RMSProp’s $\\rho\\mathbf{s} + (1 - \\rho)\\nabla_\\theta J \\otimes \\nabla_\\theta J$ with $\\rho = 0.9$ would give %r% (slide 41).',
    },
  },
  {
    id: 'l2-overfit', lecture: 2, chart: 'overfit', dx: 'overfit', dxConcept: 'reg.l1l2', hard: 1, levels: [1, 2, 3],
    complaint: 'A deep MLP with many parameters and not many training instances.',
    dxWhy: 'Validation loss rises from epoch %best% while training loss keeps falling: overfitting, a risk for a model with millions of parameters when there are not enough training instances (slide 4).',
    dxSrc: { lecture: 2, slides: [4] },
    rx: {
      l2: { why: 'ℓ1 and ℓ2 regularization constrain the connection weights: at each training step the regularization loss is computed and added to the final loss, e.g. kernel_regularizer=tf.keras.regularizers.l2(0.01) (slide 60).', src: { lecture: 2, slides: [60] } },
      dropout: { why: 'Dropout: at each training step every neuron (excluding the output neurons) is temporarily dropped with probability p, typically 10 %–50 %; slide 64 adds Dropout(rate=0.2) before every Dense layer (slides 62–64).', src: { lecture: 2, slides: [62, 63, 64] } },
    },
    fuBy: {
      dropout: {
        type: 'pick', concept: 'reg.dropout', src: { lecture: 2, slides: [63, 64] },
        prompt: 'With dropout added, the training and validation losses now look alike. What does slide 64 tell you to do?',
        choices: [
          { key: 'evalNoDrop', label: 'Evaluate the training loss without dropout (e.g. after training)' },
          { key: 'trust', label: 'Nothing: similar losses mean the model is not overfitting' },
          { key: 'dropTest', label: 'Keep dropping neurons at test time as well' },
        ],
        answer: 'evalNoDrop',
        why: 'Dropout is only active during training, so comparing the two losses can be misleading: a model may be overfitting and yet have similar training and validation losses. Evaluate the training loss without dropout (slide 64); at testing, neurons are not dropped (slide 63).',
      },
      l2: {
        type: 'pick', concept: 'reg.l1l2', src: { lecture: 2, slides: [60] },
        prompt: 'You want ℓ1 and ℓ2 regularization together. Which regularizer?',
        choices: [
          { key: 'l1l2', label: 'tf.keras.regularizers.l1_l2(...)' },
          { key: 'l1', label: 'tf.keras.regularizers.l1(...)' },
          { key: 'l2', label: 'tf.keras.regularizers.l2(...)' },
        ],
        answer: 'l1l2',
        why: 'Slide 60: l2(...) for ℓ2, l1(...) for ℓ1, and l1_l2(...) for both together. (The transcript misprints the ℓ1 line as l2(...); the PDF prints l1(...).)',
      },
    },
  },
  {
    id: 'l2-transfer', lecture: 2, chart: 'fewLabels', dx: 'fewLabels', hard: 2, levels: [1, 2, 3],
    complaint: 'model_B: the T-shirt and pullover classes of Fashion MNIST (slide 31).',
    dxWhy: 'Only 200 labelled images for model_B’s task (91.85 % test accuracy): insufficient labelled data to train the network (slides 4, 31), while model_A already does a similar task.',
    dxSrc: { lecture: 2, slides: [4, 31] },
    rx: {
      transfer: { why: 'If an existing network accomplishes a similar task, reuse most of its layers except the top ones (slide 30): slide 31 builds model_B_on_A from model_A.layers[:-1] plus a new Dense(1, activation="sigmoid").', src: { lecture: 2, slides: [30, 31] } },
    },
    fu: {
      type: 'order', concept: 'transfer.freeze', src: { lecture: 2, slides: [31] },
      prompt: 'Put slide 31’s training steps for model_B_on_A in order.',
      cards: [
        { id: 'freeze', text: 'Freeze the reused layers: layer.trainable = False' },
        { id: 'compile', text: 'compile (SGD, learning_rate=0.001)' },
        { id: 'fit4', text: 'fit for 4 epochs' },
        { id: 'unfreeze', text: 'Unfreeze the reused layers: layer.trainable = True' },
        { id: 'recompile', text: 'Recompile the model' },
        { id: 'fit16', text: 'fit for 16 epochs' },
      ],
      why: 'Slide 31: freeze the reused layers for the first epochs, compile, train (4 epochs), unfreeze, recompile (“the model needs to be recompiled”), then train on (16 epochs). Slide 31 keeps SGD(learning_rate=0.001) both times.',
    },
  },

  /* ── Lecture 3 ─────────────────────────────────────────────────────── */
  {
    id: 'l3-overfit', lecture: 3, chart: 'overfit', dx: 'overfit', dxConcept: 'reg.dataAugmentation', hard: 1, levels: [1, 2],
    complaint: 'A CNN image classifier with millions of parameters.',
    dxWhy: 'Training loss keeps falling while validation loss climbs after epoch %best%: overfitting, which AlexNet’s authors reduced with two regularization techniques (slide 39).',
    dxSrc: { lecture: 3, slides: [39] },
    rx: {
      augment: { why: 'Data augmentation artificially increases the size of the training set by generating realistic variants of each instance (shifting, rotating, resizing; AlexNet also flipped the images and changed the lighting). It helps reduce overfitting, so it is a regularization technique (slides 39–40).', src: { lecture: 3, slides: [39, 40] } },
    },
  },
  {
    id: 'l3-big-kernel', lecture: 3, chart: 'bigKernel', dx: 'bigKernel', hard: 2, levels: [1, 2, 3],
    complaint: 'A CNN for 3-channel images, as built (the comments give each layer’s parameter count).',
    dxWhy: 'Line %line% puts a 5 × 5 kernel deep inside the network: a common mistake is to use convolution kernels that are too large (slide 34).',
    dxSrc: { lecture: 3, slides: [34] },
    rx: {
      stack3: { why: 'It is better to stack two convolutional layers with 3 × 3 kernels instead of one 5 × 5: fewer parameters (%two% instead of %one% here), less computation, and usually better performance (slide 34).', src: { lecture: 3, slides: [34] } },
    },
    fu: {
      type: 'keepLayer', concept: 'arch.typical', src: { lecture: 3, slides: [34] },
      prompt: 'One convolutional layer may keep its large kernel. Which?',
      label: 'line %line%: %code%',
      why: 'The exception is the first convolutional layer: it can typically have a large kernel (e.g. 5 × 5), usually with a stride of 2 or more, which reduces the spatial dimension of the image without losing too much information (slide 34).',
    },
  },

  /* ── Lecture 4 ─────────────────────────────────────────────────────── */
  {
    id: 'l4-rnn1', lecture: 4, chart: 'forecast', dx: 'tanhRange', hard: 2, levels: [1, 2, 3], group: 'rnn1',
    complaint: 'model = Sequential([InputLayer(shape=[None, 1]), SimpleRNN(1)]) (slide 24).',
    dxWhy: 'The series reaches about %max% but no prediction gets to 1: SimpleRNN’s default activation is tanh, so the recurrent layer can only output values between −1 and +1 and cannot predict values between 1.0 and 1.4 (slide 26).',
    dxSrc: { lecture: 4, slides: [26] },
    rx: {
      denseOut: { why: 'Slide 26 adds a dense output layer with a single output neuron and no activation function, which can output values above 1; a larger recurrent layer alone would still output through tanh.', src: { lecture: 4, slides: [26] } },
    },
    fu: {
      type: 'rx2', dx: 'tinyMemory', fix: 'biggerRnn', chart: 'rnn1Summary', concept: 'forecast.simpleRnn1', src: { lecture: 4, slides: [25, 26] },
      prompt: 'Slide 25 gives a second reason, and this summary shows it. Which fix answers that one?',
      why: 'One recurrent neuron and 3 parameters: the only data it can use at each time step is the current input and its previous output, so its memory is extremely limited (slide 25). Slide 26’s fix: a larger recurrent layer, say 32 recurrent neurons; the Dense(1) output fixes the range, not the memory.',
    },
  },
  {
    id: 'l4-rnn1-memory', lecture: 4, chart: 'rnn1Summary', dx: 'tinyMemory', hard: 2, levels: [1, 2], group: 'rnn1',
    complaint: 'model.summary() of slide 24’s SimpleRNN(1) forecaster; its validation MAE is above 100,000.',
    dxWhy: 'One recurrent neuron, 3 parameters: the only data it can use at each time step is the current input and its own previous output, so the RNN’s memory is extremely limited (slide 25).',
    dxSrc: { lecture: 4, slides: [24, 25] },
    rx: {
      biggerRnn: { why: 'Slide 26 builds univar_model with a larger recurrent layer, say 32 recurrent neurons (plus a Dense(1) output with no activation for the range); its validation MAE is around 27,703.', src: { lecture: 4, slides: [26] } },
    },
  },
  {
    id: 'l4-deep', lecture: 4, chart: 'maeBars', dx: 'tooBig', hard: 3, levels: [1, 2],
    complaint: 'deep_model: three stacked SimpleRNN(32) layers + Dense(1), 5,281 parameters (slide 29).',
    dxWhy: 'deep_model’s validation MAE (about 29,672) is worse than the shallower univar_model’s (about 27,703): it looks like this RNN is a bit too large for the task (slide 29).',
    dxSrc: { lecture: 4, slides: [26, 29] },
    rx: null,
  },
  {
    id: 'l4-relu-rnn', lecture: 4, chart: 'stateGrowth', dx: 'rnnExplode', hard: 3, levels: [1, 2, 3],
    complaint: 'SimpleRNN(32, activation="relu") trained on long sequences.',
    dxWhy: 'The layer’s outputs grow %ratio% times over %T% time steps: with a nonsaturating activation such as ReLU, the same weights are used at every time step and may lead to exploding outputs (slide 40).',
    dxSrc: { lecture: 4, slides: [40] },
    rx: {
      rnnTanh: { why: 'Slide 40: reduce the risk with a smaller learning rate or a saturating activation function like the hyperbolic tangent (that’s why it’s the default); nonsaturating activations such as ReLU may not help as much in RNNs.', src: { lecture: 4, slides: [40] } },
    },
    fu: {
      type: 'pick', concept: 'rnn.layerNorm', src: { lecture: 4, slides: [41] },
      prompt: 'You also want normalization in this RNN. Which has been reported to work better?',
      choices: [
        { key: 'ln', label: 'Layer normalization, across the features dimension' },
        { key: 'bnStep', label: 'Batch normalization at each time step' },
        { key: 'lnBatch', label: 'Layer normalization, across the batch dimension' },
      ],
      answer: 'ln',
      why: 'Slide 41: BN used at each time step was reported not to yield good results; layer normalization has been reported to be better for RNNs, and it normalizes across the features dimension instead of the batch dimension.',
    },
  },
  {
    id: 'l4-forget', lecture: 4, chart: 'trace', dx: 'shortMemory', hard: 2, levels: [1, 2, 3],
    complaint: 'A simple RNN reading a long sequence.',
    dxWhy: 'The first inputs have virtually no trace left in the final state: some information is lost at each time step, so when an RNN processes a long sequence it gradually forgets the first inputs (slides 40, 42).',
    dxSrc: { lecture: 4, slides: [40, 42] },
    rx: {
      lstm: { why: 'Cells with long-term memory were introduced to tackle this: with an LSTM cell training will converge faster and it will detect long-term dependencies in the data (slide 42); the GRU cell is a simplified version of it (slide 48).', src: { lecture: 4, slides: [42, 48] } },
    },
    fu: {
      type: 'pick', concept: 'gru.cell', src: { lecture: 4, slides: [48] },
      prompt: 'You pick the GRU, a simplified LSTM. Which gate does it not have?',
      choices: [
        { key: 'output', label: 'The output gate' },
        { key: 'forget', label: 'The forget gate' },
        { key: 'input', label: 'The input gate' },
      ],
      answer: 'output',
      why: 'Slide 48: both state vectors are merged into a single $\\mathbf{h}_{(t)}$; a single gate controller $\\mathbf{z}_{(t)}$ controls both the forget gate and the input gate; there is no output gate, the full state vector is output at every time step.',
    },
  },

  /* ── Lecture 5 ─────────────────────────────────────────────────────── */
  {
    id: 'l5-too-powerful', lecture: 5, chart: 'aeCopy', dx: 'aeCopy', hard: 2, levels: [1, 2],
    complaint: 'A stacked autoencoder whose coding layer is a single number.',
    dxWhy: 'Training images come back almost perfectly (error %train%) but new images do not (%fresh%): an encoder so powerful that it maps each input to a single arbitrary number reconstructs the training data perfectly without learning any useful representation, and is unlikely to generalize (slide 10).',
    dxSrc: { lecture: 5, slides: [10] },
    rx: {
      lessPowerful: { why: 'Adding more layers helps an autoencoder learn more complex codings, but one must be careful not to make it too powerful (slide 10).', src: { lecture: 5, slides: [10] } },
    },
  },

  /* ── Lectures 6–7 ──────────────────────────────────────────────────── */
  {
    id: 'l67-mode-collapse', lecture: 6, chart: 'classHist', dx: 'modeCollapse', hard: 1, levels: [1, 2],
    complaint: 'A GAN on Fashion MNIST: 100 generated images, sorted by class.',
    dxWhy: '%top% of 100 generated images fall in one class: the generator’s outputs have gradually become less diverse, only producing images in a specific class. That is mode collapse, the biggest difficulty of training GANs (slide 27).',
    dxSrc: { lecture: 6, slides: [27] },
    rx: null,
  },
  {
    id: 'l67-unstable', lecture: 6, chart: 'oscillate', dx: 'ganUnstable', hard: 2, levels: [1, 2, 3],
    complaint: 'A GAN whose images never really get much better after the first epoch.',
    dxWhy: 'Both weights keep swinging and never settle: because the generator and the discriminator are constantly pushing against each other, their parameters may end up oscillating and becoming unstable, and the GAN may seem to forget what it learned (slides 26–27).',
    dxSrc: { lecture: 6, slides: [26, 27] },
    rx: {
      dcgan: { why: 'Slide 28’s DCGAN guidelines are for building stable convolutional GANs: strided / transposed convolutions instead of pooling, Batch Normalization except in the generator’s output and the discriminator’s input layer, no fully connected hidden layers, ReLU (tanh output) in the generator, leaky ReLU in the discriminator. They work in many cases, but not always.', src: { lecture: 6, slides: [28] } },
    },
    fu: {
      type: 'slots', concept: 'dcgan.guidelines', src: { lecture: 6, slides: [28] },
      prompt: 'Set the activations the DCGAN guidelines name.',
      slots: ['generator: every layer but the output', 'generator: output layer', 'discriminator: every layer'],
      cards: [
        { id: 'relu', text: 'ReLU' },
        { id: 'tanh', text: 'tanh' },
        { id: 'leaky', text: 'leaky ReLU' },
      ],
      answer: ['relu', 'tanh', 'leaky'],
      why: 'Slide 28: use ReLU in the generator for all layers except the output layer, which should use tanh; use leaky ReLU in the discriminator for all layers. (Slide 29’s discriminator still ends in a sigmoid Dense layer.)',
    },
  },

  /* ── Lecture 8 ─────────────────────────────────────────────────────── */
  {
    id: 'l8-no-mask', lecture: 8, chart: 'attnHeat', dx: 'noMask', hard: 2, levels: [1, 2, 3],
    complaint: 'Decoder self-attention while translating “I like soccer” (decoder input: <sos> Me gusta el fútbol).',
    dxWhy: 'Each row is the word being processed: “%q%” puts %pct% of its attention on words after it. The decoder’s masked multi-head attention must not attend to words located after the word it processes: it is a causal layer (slide 31).',
    dxSrc: { lecture: 8, slides: [31] },
    rx: {
      mask: { why: 'The decoder’s masked multi-head attention layer does what the encoder’s does, but when it processes a word it doesn’t attend to words located after it: a causal layer, done by the additional masking operation (slide 31).', src: { lecture: 8, slides: [31] } },
    },
    fu: {
      type: 'maskSet', concept: 'transformer.mask', src: { lecture: 8, slides: [31] },
      prompt: 'With the mask in place, which words may “%q%” attend to?',
      why: 'The masked layer does not attend to words located after the word it processes (slide 31), so “%q%” may attend to %set%.',
    },
  },
  {
    id: 'l8-bottleneck', lecture: 8, chart: 'encdec', dx: 'finalState', hard: 3, levels: [1, 2, 3],
    complaint: 'Figure 16-3’s encoder–decoder, translating “I like soccer” into “Me gusta el fútbol”.',
    dxWhy: 'Only the encoder’s final hidden state crosses to the decoder, so “soccer” is carried %path% steps before “fútbol” is output: the path is quite long, and the word’s representation must be carried over many steps before it is used (slides 18, 20).',
    dxSrc: { lecture: 8, slides: [5, 18, 20] },
    rx: {
      attention: { why: 'With attention all of the encoder’s outputs are sent to the decoder, which computes a weighted sum of them at each step (slide 20); the path from “soccer” to “fútbol” is much shorter, especially helping long sentences (e.g. over 30 words) (slide 19).', src: { lecture: 8, slides: [19, 20] } },
    },
    fu: {
      type: 'pick', concept: 'attn.weightedSum', src: { lecture: 8, slides: [20] },
      prompt: 'With attention added, what does the decoder’s memory cell compute at each time step?',
      choices: [
        { key: 'wsum', label: 'A weighted sum of all the encoder outputs' },
        { key: 'final', label: 'The encoder’s final hidden state only' },
        { key: 'own', label: 'A sum of the decoder’s own previous outputs' },
      ],
      answer: 'wsum',
      why: 'Slide 20: instead of just the encoder’s final hidden state, all of the encoder’s outputs are sent to the decoder; at each time step the decoder’s memory cell computes a weighted sum of all the encoder outputs, which determines which words it focuses on.',
    },
  },
  {
    id: 'l8-unscaled', lecture: 8, chart: 'softmaxHeat', dx: 'saturatedSoftmax', hard: 3, levels: [1, 2, 3],
    complaint: 'Attention weights softmax(QKᵀ) with d_keys = %d%, computed without any scaling.',
    dxWhy: 'Every query puts at least %min% of its weight on a single key: the unscaled similarity scores (from %lo% to %hi%) saturate the softmax, which would lead to tiny gradients (slide 38).',
    dxSrc: { lecture: 8, slides: [38] },
    rx: {
      scale: { why: 'Scaled dot-product attention, $\\text{softmax}(\\mathbf{QK}^\\top/\\sqrt{d_{\\text{keys}}})\\mathbf{V}$, scales the similarity scores down to avoid saturating the softmax (slides 37–38); here the largest weight per row would drop to about %scaled%. (Slide 38’s bullet prints the factor as 1/d_keys; its equation, like slide 37’s, has the square root.)', src: { lecture: 8, slides: [37, 38] } },
    },
    fu: {
      type: 'shape', concept: 'transformer.sdpa', src: { lecture: 8, slides: [38] },
      prompt: 'Q holds %nq% queries and K holds %nk% keys, each of size d_keys = %d%. What is the shape of QKᵀ?',
      why: 'Slide 38: $\\mathbf{QK}^\\top$ has shape [n_queries, n_keys] = [%nq%, %nk%], one similarity score for each query/key pair; the softmax keeps that shape and each row adds up to 1.',
    },
  },
  {
    id: 'l8-causal-encoder', lecture: 8, chart: 'strips', dx: 'causalEncoder', hard: 3, levels: [1, 2],
    complaint: 'A one-directional recurrent encoder for translation; its output at the word “right”.',
    dxWhy: 'All three phrases give the same output at “right”: a regular recurrent layer only looks at past and present inputs, it is causal, but to encode “right” properly in “the right arm / person / to criticize” you need to look ahead (slide 6).',
    dxSrc: { lecture: 8, slides: [6] },
    rx: {
      bidir: { why: 'A bidirectional recurrent layer runs two recurrent layers on the same inputs, one reading left to right and the other right to left, and combines their outputs at each time step, typically by concatenating them (slide 7).', src: { lecture: 8, slides: [7] } },
    },
  },
];

/* ── chart data words that the maths drawer prints ──────────────────────── */
export const DRAWER = {
  overfit: [
    'Validation loss: lowest at epoch %best% (%vbest%), %vend% by epoch %E%.',
    'Training loss: %t0% at epoch 1, %tend% by epoch %E%.',
  ],
  diverge: ['Loss: %l0% at epoch 1, lowest %lmin% at epoch %emin%, then %lend% by epoch %E% (%times%× the start).'],
  slow: ['Loss: %l0% at epoch 1, %lend% at epoch %E%: it fell %d1% in the first quarter and still %d4% in the last quarter.'],
  spiky: ['Largest jump between two iterations: %early% in the first quarter, %late% in the second half.'],
  adagrad: ['Step size at the last epoch: %pct% of the first step; the loss changed by %flat% over the last third and sits %gap% above the optimum.'],
  sweep: ['The loss bottoms out near %lmin% and starts to shoot up at about η = %up%.'],
  gradBars: ['Gradient size: %first% at layer 1, %last% at layer %L% (a ratio of %ratio%).'],
  deadBars: ['%dead% of %n% neurons output only 0 on every training input.'],
  forecast: ['Series: %min% to %max%. Predictions: %pmin% to %pmax%.'],
  stateGrowth: ['Size of the outputs: %first% at step 1, %last% at step %T% (%ratio%×).'],
  trace: ['Trace of the input at step 1: %first%; at step %T%: %last%.'],
  maeBars: ['univar_model: around %shallow% (slide 26); deep_model: about %deep% (slide 29).'],
  aeCopy: ['Reconstruction MSE: %train% on training images, %fresh% on new images.'],
  classHist: ['%top% of 100 images in one class; the other nine classes share %rest%.'],
  oscillate: ['The generator weight changes direction %turns% times; its swing is %amp1% in the first third and %amp3% in the last.'],
  attnHeat: ['Attention on later words, per row: %rows%.'],
  softmaxHeat: ['Unscaled scores run from %lo% to %hi%; largest weight per row: %maxes%.', 'Divided by √d_keys = %sq%, the largest weight per row would be: %scaledMaxes%.'],
  strips: ['The three output vectors are identical: %vec%.'],
  encdec: ['Encoder steps after “soccer”: %encAfter%; final state → decoder: 1; decoder steps to “fútbol”: %decSteps%. Total: %path%.'],
  rnn1Summary: ['SimpleRNN(1) on 1 input feature: 1 × 1 + 1 × 1 + 1 = 3 parameters.'],
  bigKernel: ['One 5 × 5 layer: 5 · 5 · %c% · %c% + %c% = %one%. Two 3 × 3 layers: 2 × (3 · 3 · %c% · %c% + %c%) = %two%.'],
  fewLabels: ['Labelled images for model_B: 200; test accuracy without transfer learning: 91.85 % (slide 31).'],
};

/* Words for the code-card charts (model summaries, notes). */
export const CODE = {
  rnn1Summary: {
    title: 'model.summary()',
    lines: [
      'Model: "sequential"',
      '_________________________________________________________________',
      ' Layer (type)              Output Shape         Param #',
      '=================================================================',
      ' simple_rnn (SimpleRNN)    (None, 1)            %params%',
      '=================================================================',
      'Total params: %params%',
      'Trainable params: %params%',
      'Non-trainable params: 0',
    ],
  },
  fewLabels: {
    title: 'case notes',
    lines: [
      'model_A: trained on 8 Fashion MNIST classes (all but sandal and shirt)',
      'model_B: T-shirt vs pullover',
      'labelled images for model_B: 200',
      'model_B test accuracy: 91.85%',
    ],
  },
  bigKernel: {
    title: 'model = tf.keras.Sequential([',
    input: 'tf.keras.layers.InputLayer(shape=[%h%, %h%, 3]),',
    first: 'tf.keras.layers.Conv2D(%f1%, 5, strides=2, padding="same"),',
    pool: 'tf.keras.layers.MaxPool2D(),',
    conv3: 'tf.keras.layers.Conv2D(%c%, 3, padding="same"),',
    conv5: 'tf.keras.layers.Conv2D(%c%, 5, padding="same"),',
    params: '# %n% params',
    close: '])',
  },
  aeCopy: {
    title: 'stacked_encoder / stacked_decoder',
    encoder: 'encoder: Flatten → %hidden% → Dense(1)   # the codings: one number',
    decoder: 'decoder: %hidden% → Dense(28 * 28) → Reshape([28, 28])',
    dense: 'Dense(%w%, activation="relu")',
  },
};

/* The words of the attention / translation charts (slides 5–6, Figure 16-3). */
export const WORDS = {
  decoderInput: ['<sos>', 'Me', 'gusta', 'el', 'fútbol'],
  encoderInput: ['I', 'like', 'soccer'],
  decoderOutput: ['Me', 'gusta', 'el', 'fútbol', '<eos>'],
  trace: { from: 2, to: 3 }, // “soccer” (x(2)) → “fútbol” (ŷ(3)), slide 18
  phrases: ['the right arm', 'the right person', 'the right to criticize'],
  classes: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'],
};
