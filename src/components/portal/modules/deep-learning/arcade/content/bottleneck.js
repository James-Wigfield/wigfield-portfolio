// Bottleneck (Gradient Arcade game 6) — PURE DATA, Lecture 5 only.
// Every prompt, label, distractor, why text and level setting the game shows lives here, with the
// slides it comes from. Templates use {name} placeholders that maths/bottleneck.js fills with numbers
// it computes (lecture5-study/ae.js maths). Anything the slides do not state is marked `beyond: true`
// with a `note`. Notation follows the slides: W_ℓ, W_{N−ℓ+1} = W_ℓ^⊤ (slide 19), x′ for the
// reconstructions (Figure 17-1), X_(1), X_(2) (slide 23).

export const GAME = { id: 'bottleneck', lecture: 5 };

// The stage tag shown above each item's prompt.
export const STAGES = {
  plane: { n: 1, tag: 'stage 1 · the plane', src: { lecture: 5, slides: [8, 9] } },
  build: { n: 2, tag: 'stage 2 · the sandwich', src: { lecture: 5, slides: [10, 11, 12] } },
  tie: { n: 2, tag: 'stage 2 · tie the weights', src: { lecture: 5, slides: [18, 19, 20, 21] } },
  index: { n: 2, tag: 'stage 2 · which W?', src: { lecture: 5, slides: [19] } },
  order: { n: 3, tag: 'stage 3 · one step at a time', src: { lecture: 5, slides: [16, 17, 23, 24, 25] } },
  drop: { n: 4, tag: 'stage 4 · the map', src: { lecture: 5, slides: [14, 15] } },
};

// What each level holds, in play order (difficulty ramps within the round).
//   drop:<tier>   a Fashion MNIST item to drop on the t-SNE map (MAP.items tiers)
//   order:<set>   tap-to-order cards (ORDERS); several sets = one is picked
//   plane         tilt the plane to the lowest MSE (PLANE; tolerance per level)
//   build:<N>     the biggest symmetric sandwich within a budget (BUILD; N = layers, input not counted)
//   tie:choice    the slide 12 / 21 anchor, four choices; tie:keypad the built sandwich, on the keypad
//   index:<N>     which W a layer uses / the coding layer / what is learned (INDEX)
export const LEVELS = [
  { level: 1, name: 'the four stages', plan: ['drop:easy', 'order:fig177', 'plane', 'build:4', 'tie:choice', 'drop:medium'] },
  { level: 2, name: 'tie the weights · pretraining', plan: ['drop:medium', 'order:pretrain|fig177long', 'plane', 'build:4', 'tie:keypad', 'index:4'] },
  { level: 3, name: 'deeper stacks · decoys', plan: ['drop:hard', 'plane', 'build:6', 'tie:keypad', 'index:6', 'order:layers|code|fig177decoy|pretraindecoy'] },
];

export const INTRO = {
  line: 'Squeeze data through the bottleneck: four stages from Lecture 5.',
  controls: [
    'Stage 1: tilt the plane through the 3D points (two sliders, a drag, or the arrow keys) until the reconstruction error is lowest; Enter locks it.',
    'Stage 2: pick the sandwich’s widths within the budget (Enter builds), then tie the weights and count on the keypad.',
    'Stage 3: tap the cards in order (keys 1–6; Backspace undoes); Enter locks the order.',
    'Stage 4: tap the cluster an item belongs to on the t-SNE map (← → step through them), then Drop (Enter).',
  ],
};

// ---------------------------------------------------------------------------------------------
// Stage 1 — the plane (slides 8–9)
// ---------------------------------------------------------------------------------------------
export const PLANE = {
  concept: 'pca.linearAe',
  src: { lecture: 5, slides: [8, 9] },
  tol: [10, 7, 5], // degrees from the PCA plane that still count, levels 1–3
  range: [-75, 75], // each slider's travel, degrees
  target: 55, // the PCA plane's two tilts stay within ±55°
  showFloor: [true, true, false], // whether the meter names the lowest possible MSE
  prompt: 'Tilt the plane until the reconstruction error is as low as it goes.',
  sub: 'Each grey line runs from a point x to its reconstruction x′ on the plane.',
  promptText: 'Stage 1 · tilt the plane to the lowest reconstruction MSE',
  why: 'With only linear activations and the MSE as the cost, the autoencoder “ends up performing Principal Component Analysis” (slide 8). Slide 9 shows the 3D points projected onto a plane, and its right-hand plot is “the approximate PCA performed by the undercomplete linear autoencoder”. The plane with the lowest reconstruction MSE is that PCA plane: within {tol}° of it counts.',
  legend: { above: 'above the plane', below: 'below the plane', proj: 'x′ on the plane' },
  legendSrc: { lecture: 5, slides: [9] }, // slide 9: bright / light red dots above / below the plane, blue markers = projections
  controls: { a: 'x1 tilt', b: 'x2 tilt', lock: 'Lock plane' },
  meter: { label: 'reconstruction MSE', floor: 'lowest possible', off: 'from the PCA plane' },
  axes: ['x1', 'x2', 'x3'], // slide 9's axis names
  drawer: [
    { kind: 'code', text: 'encoder = Sequential([Dense(2)])   decoder = Sequential([Dense(3)])   loss="mse"', src: { lecture: 5, slides: [8] } },
    { kind: 'text', text: 'Dense(2) and Dense(3) have no activation, so every neuron is linear: 3 inputs → 2 codings → 3 outputs (slide 8, notes ii–iii).', src: { lecture: 5, slides: [8] } },
    { kind: 'eq', tex: '\\text{MSE} = \\frac{1}{3m}\\sum_{i=1}^{m} \\lVert \\mathbf{x}_i - \\mathbf{x}\'_i \\rVert^2 \\qquad m = 60',
      beyond: true, note: 'Slide 8 names the MSE but prints no formula; this is Keras’s mse (the mean over the 3 features, then over the m = 60 points of slide 9’s X_train).',
      src: { lecture: 5, slides: [8, 9] } },
    { kind: 'text', text: 'The plane is pinned to the points’ mean; only its two tilts, along x1 and along x2, are yours to find.', beyond: true,
      note: 'A game simplification: in the autoencoder the decoder’s biases set the plane’s offset, and the lowest-MSE plane passes through the mean (standard PCA, not slide text).',
      src: { lecture: 5, slides: [9] } },
  ],
  live: 'MSE now {mse}',
  liveFloor: ' · lowest possible {floor}',
  own: 'this page’s own 60 points (slide 9 elides its X_train as [...])',
};

// ---------------------------------------------------------------------------------------------
// Stage 2 — build the sandwich (slides 10–12), tie the weights (slides 18–22)
// ---------------------------------------------------------------------------------------------
export const SANDWICH = {
  inputUnits: 784, // 28 × 28 Fashion MNIST pixels, slides 11–12
  names: { input: 'Input layer', output: 'Output layer', hidden: 'Hidden {n}', units: '{u} units', codings: 'Codings', reconstruction: 'Reconstruction' },
  src: { lecture: 5, slides: [11, 19] }, // Figure 17-3 / slide 19's diagram labels
};

export const BUILD = {
  concept: 'ae.symmetric',
  src: { lecture: 5, slides: [10, 11, 12] },
  // the widths on offer; every one is narrower than the layer before it (an undercomplete sandwich)
  lists: {
    4: [
      { key: 'h1', label: 'Hidden 1 · Hidden 3', options: [50, 100, 150, 200, 300] },
      { key: 'code', label: 'Codings · Hidden 2', options: [10, 20, 30, 40] },
    ],
    6: [
      { key: 'h1', label: 'Hidden 1 · Hidden 5', options: [200, 300, 400] },
      { key: 'h2', label: 'Hidden 2 · Hidden 4', options: [60, 100, 150] },
      { key: 'code', label: 'Codings · Hidden 3', options: [30] }, // fixed at slide 11's 30, so the deeper stack keeps two pickers
    ],
  },
  budgetSteps: [10000, 5000, 1000, 500, 100, 50, 10, 1], // a round budget, the coarsest that still separates the answer
  prompt: 'Budget {budget} parameters. Build the biggest symmetric sandwich that fits.',
  sub: 'The decoder mirrors the encoder (slide 11). A Dense layer costs inputs × units + units.',
  promptText: 'Stage 2 · the biggest symmetric sandwich within {budget} parameters',
  meter: { label: 'parameters', budget: 'budget', over: 'over by {n}', fits: 'fits' },
  build: 'Build',
  why: 'A Dense layer has inputs × units weights plus units biases, so {sizes} costs {terms} = {total} ≤ {budget}; the next bigger sandwich on offer, {nextSizes}, needs {nextTotal}.',
  whySlide: ' Slide 12’s 784–100–30–100–784 has 163,814.',
  fixed: '{label}: {units} (fixed)',
  drawer: [
    { kind: 'text', text: 'Slide 11: a stacked autoencoder is typically symmetrical with regards to the central hidden layer (the coding layer), like a sandwich: 784 → 100 → 30 → 100 → 784.', src: { lecture: 5, slides: [11] } },
    { kind: 'text', text: 'Slide 12: this model (stacked_ae) has 163,814 trainable parameters.', src: { lecture: 5, slides: [12] } },
  ],
};

export const TIE = {
  concept: 'params.tied',
  src: { lecture: 5, slides: [19, 20, 21] },
  anchor: { sizes: [784, 100, 30, 100, 784], untied: 163814, tied: 82414, src: { lecture: 5, slides: [12, 21] } },
  choice: {
    prompt: 'Tie the weights of slide 12’s 784–100–30–100–784 sandwich (163,814 parameters). How many are left to train?',
    promptText: 'Stage 2 · tied_ae’s trainable parameters (slide 21)',
    choices: [
      { value: 82414, label: '82,414' },
      { value: 81530, label: '81,530' },
      { value: 81400, label: '81,400' },
      { value: 163814, label: '163,814' },
    ],
    why: 'Tying sets $\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_\\ell^\\top$ (slide 19), so only $\\mathbf{W}_1$, $\\mathbf{W}_2$ and the bias terms are learned: 78,500 + 3,030 for the encoder plus 100 + 784 decoder biases = 82,414, as slide 21 prints. It is “almost halved” because the biases are not tied (81,530 forgets them; 81,400 is what tying saves).',
  },
  keypad: {
    remaining: {
      prompt: 'Tie the weights. How many parameters are left to train?',
      promptText: 'Stage 2 · trainable parameters left after tying {sizes}',
      why: 'Each decoder layer reuses an encoder kernel, transposed ($\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_\\ell^\\top$, slide 19), and keeps only its own biases (DenseTranspose’s build() adds just a bias, slide 20). Left to train: encoder kernels {kernels} + every bias {biases} = {tied}.',
    },
    saved: {
      prompt: 'Tie the weights. How many parameters does that save?',
      promptText: 'Stage 2 · parameters saved by tying {sizes}',
      why: 'The decoder’s kernels stop being learned: they are the encoder’s, transposed ($\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_\\ell^\\top$, slide 19). Saved: {terms} = {saved}. The biases stay (slide 20), which is why slide 21 says “almost halved”.',
    },
    sub: 'The sandwich that fit the budget, {sizes}: {untied} parameters untied.',
    unit: 'params',
  },
  labels: { biasOnly: 'bias only', tied: 'tied' },
  // the drawer's layer-by-layer table (slide 19's numbering; slide 20: a tied layer adds only its bias)
  rowOwn: 'layer {l}: $\\mathbf{W}_{{l}}$ is {i} × {u}, bias {u}',
  rowTied: 'layer {l}: $\\mathbf{W}_{{k}}^{\\top}$, tied (nothing new), bias {u}',
  drawer: [
    { kind: 'eq', tex: '\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_{\\ell}^{\\top} \\qquad \\ell = 1, 2, \\cdots, N/2', src: { lecture: 5, slides: [19] } },
    { kind: 'text', text: 'N counts the layers without the input layer: layer 1 is the first hidden layer, layer N/2 the coding layer, layer N the output layer (slide 19).', src: { lecture: 5, slides: [19] } },
    { kind: 'text', text: 'DenseTranspose’s build() creates only a bias, of shape [self.dense.input.shape[-1]]; call() multiplies by self.dense.weights[0] with transpose_b=True (slide 20).', src: { lecture: 5, slides: [20] } },
  ],
};

export const INDEX = {
  concept: 'tied.index',
  src: { lecture: 5, slides: [19] },
  pair: {
    prompt: 'N = {N}, weights tied. Which weights does layer {L} use?',
    promptText: 'Stage 2 · N = {N}: the weights of layer {L}',
    why: 'Slide 19: $\\mathbf{W}_{N-\\ell+1} = \\mathbf{W}_\\ell^\\top$ for $\\ell = 1, 2, \\cdots, N/2$. Layer {L} = N − ℓ + 1 gives ℓ = {N} − {L} + 1 = {l}, so layer {L} uses $\\mathbf{W}_{{l}}^\\top$.',
  },
  coding: {
    prompt: 'N = {N} layers, not counting the input layer. Which one is the coding layer?',
    promptText: 'Stage 2 · N = {N}: the coding layer',
    why: 'Slide 19 numbers the layers without the input layer: layer 1 is the first hidden layer, layer N/2 is the coding layer and layer N is the output layer, so with N = {N} the coding layer is layer {c}.',
  },
  learn: {
    prompt: 'N = 4, weights tied. What still has to be learned?',
    promptText: 'Stage 2 · N = 4: what is learned',
    choices: [
      { value: 'w12b', label: '$\\mathbf{W}_1$, $\\mathbf{W}_2$ and the bias terms', plain: 'W₁, W₂ and the bias terms' },
      { value: 'w12', label: '$\\mathbf{W}_1$ and $\\mathbf{W}_2$ only', plain: 'W₁ and W₂ only' },
      { value: 'w34b', label: '$\\mathbf{W}_3$, $\\mathbf{W}_4$ and the bias terms', plain: 'W₃, W₄ and the bias terms' },
      { value: 'w1234', label: '$\\mathbf{W}_1$, $\\mathbf{W}_2$, $\\mathbf{W}_3$ and $\\mathbf{W}_4$', plain: 'W₁, W₂, W₃ and W₄' },
    ],
    answer: 'w12b',
    why: 'Slide 19: “only $\\mathbf{W}_1$, $\\mathbf{W}_2$, and the bias terms need to be learned”. The decoder’s weights are $\\mathbf{W}_2^\\top$ and $\\mathbf{W}_1^\\top$ (the diagram’s labels), but every layer keeps its own bias.',
  },
  layerWord: 'layer {n}',
  // the encoder widths drawn beside the question: slide 11's sandwich for N = 4, a deeper one
  // (an illustration, not a slide model) for N = 6
  picture: { 4: [100, 30], 6: [300, 100, 30] },
};

// ---------------------------------------------------------------------------------------------
// Stage 3 — tap-to-order (slides 16–17, 23–25). Cards hold slide wording; `stack` draws a tiny
// layer diagram on the card (Figure 17-6 / 17-7's boxes), `code` shows a monospace line.
// ---------------------------------------------------------------------------------------------
export const ORDERS = {
  fig177: {
    concept: 'ae.oneAtATime',
    src: { lecture: 5, slides: [23] },
    prompt: 'Training one autoencoder at a time: tap the phases in order.',
    promptText: 'Stage 3 · Figure 17-7’s three phases',
    cards: [
      { id: 'p1', text: 'Phase 1 · train the first autoencoder (target = inputs) to learn $\\mathbf{X}_{(1)}$', short: 'Phase 1', stack: ['Input', 'Hidden 1', 'Output'] },
      { id: 'p2', text: 'Phase 2 · using $\\mathbf{X}_{(1)}$ as input data, train the second autoencoder to learn $\\mathbf{X}_{(2)}$', short: 'Phase 2', stack: ['Input', 'Hidden 2', 'Output'] },
      { id: 'p3', text: 'Phase 3 · stack the autoencoders into one big sandwich', short: 'Phase 3', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'] },
    ],
    answer: ['p1', 'p2', 'p3'],
    why: 'Figure 17-7 (slide 23): Phase 1 trains the first autoencoder to learn a compressed representation $\\mathbf{X}_{(1)}$ of the inputs; Phase 2 trains the second on $\\mathbf{X}_{(1)}$ to learn $\\mathbf{X}_{(2)}$; Phase 3 builds a big sandwich from them.',
  },
  fig177long: {
    concept: 'ae.oneAtATime',
    src: { lecture: 5, slides: [23, 25] },
    prompt: 'Training one autoencoder at a time: tap the steps in order.',
    promptText: 'Stage 3 · Figure 17-7’s phases, then slide 25',
    cards: [
      { id: 'p1', text: 'Phase 1 · train the first autoencoder (target = inputs) to learn $\\mathbf{X}_{(1)}$', short: 'Phase 1', stack: ['Input', 'Hidden 1', 'Output'] },
      { id: 'p2', text: 'Phase 2 · using $\\mathbf{X}_{(1)}$ as input data, train the second autoencoder to learn $\\mathbf{X}_{(2)}$', short: 'Phase 2', stack: ['Input', 'Hidden 2', 'Output'] },
      { id: 'p3', text: 'Phase 3 · stack the autoencoders into one big sandwich', short: 'Phase 3', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'] },
      { id: 'p4', text: 'If needed, keep training the full stacked autoencoder for a few epochs', short: 'fine-tune', code: 'stacked_ae_1_by_1.fit(X_train, X_train, epochs=5, …)' },
    ],
    answer: ['p1', 'p2', 'p3', 'p4'],
    why: 'Figure 17-7 (slide 23): Phase 1 learns $\\mathbf{X}_{(1)}$, Phase 2 trains the second autoencoder on $\\mathbf{X}_{(1)}$ to learn $\\mathbf{X}_{(2)}$, Phase 3 stacks them; slide 25 then says that, if needed, the full stack can keep training for a few epochs (epochs=5).',
  },
  fig177decoy: {
    concept: 'ae.oneAtATime',
    src: { lecture: 5, slides: [23] },
    prompt: 'Training one autoencoder at a time: tap the phases in order. One card is wrong: leave it out.',
    promptText: 'Stage 3 · Figure 17-7’s phases, with a decoy',
    cards: [
      { id: 'p1', text: 'Phase 1 · train the first autoencoder (target = inputs) to learn $\\mathbf{X}_{(1)}$', short: 'Phase 1', stack: ['Input', 'Hidden 1', 'Output'] },
      { id: 'p2', text: 'Phase 2 · using $\\mathbf{X}_{(1)}$ as input data, train the second autoencoder to learn $\\mathbf{X}_{(2)}$', short: 'Phase 2', stack: ['Input', 'Hidden 2', 'Output'] },
      { id: 'p3', text: 'Phase 3 · stack the autoencoders into one big sandwich', short: 'Phase 3', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'] },
      { id: 'x1', text: 'Train the second autoencoder on the original inputs, not on $\\mathbf{X}_{(1)}$', short: 'second on the raw inputs', decoy: true },
    ],
    answer: ['p1', 'p2', 'p3'],
    why: 'Figure 17-7 (slide 23): Phase 1 learns $\\mathbf{X}_{(1)}$; Phase 2 trains the second autoencoder on the training set encoded by the first encoder, $\\mathbf{X}_{(1)}$, not on the raw inputs; Phase 3 stacks them.',
  },
  pretrain: {
    concept: 'pretrain.ae',
    src: { lecture: 5, slides: [16, 17] },
    prompt: 'Unsupervised pretraining: tap the steps in order.',
    promptText: 'Stage 3 · Figure 17-6’s pretraining',
    cards: [
      { id: 'a', text: 'Phase 1 · train the autoencoder using all the data (no labels needed)', short: 'train the autoencoder', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'] },
      { id: 'b', text: 'Copy the parameters of Hidden 1 and Hidden 2 into a classifier with an Output layer and a Softmax', short: 'copy Hidden 1, Hidden 2', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Output', 'Softmax'] },
      { id: 'c', text: 'Phase 2 · train the classifier on the labelled data', short: 'train the classifier' },
    ],
    answer: ['a', 'b', 'c'],
    why: 'Figure 17-6 (slides 16–17): train the autoencoder using all the data, which needs no labels; reuse its encoder layers (copy the Hidden 1 and Hidden 2 parameters) in a classifier with an Output layer and a Softmax; train that classifier on the labelled data. The slides say “reuse” and “copy”; they never say the copied layers are frozen.',
  },
  pretraindecoy: {
    concept: 'pretrain.ae',
    src: { lecture: 5, slides: [16, 17] },
    prompt: 'Unsupervised pretraining: tap the steps in order. One card is wrong: leave it out.',
    promptText: 'Stage 3 · Figure 17-6’s pretraining, with a decoy',
    cards: [
      { id: 'a', text: 'Phase 1 · train the autoencoder using all the data (no labels needed)', short: 'train the autoencoder', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Hidden 3', 'Output'] },
      { id: 'b', text: 'Copy the parameters of Hidden 1 and Hidden 2 into a classifier with an Output layer and a Softmax', short: 'copy Hidden 1, Hidden 2', stack: ['Input', 'Hidden 1', 'Hidden 2', 'Output', 'Softmax'] },
      { id: 'c', text: 'Phase 2 · train the classifier on the labelled data', short: 'train the classifier' },
      { id: 'x', text: 'Copy Hidden 3 and the Output layer into the classifier as well', short: 'copy Hidden 3 and Output', decoy: true },
    ],
    answer: ['a', 'b', 'c'],
    why: 'Figure 17-6 (slide 17) copies parameters for Hidden 1 and Hidden 2 only, the encoder layers (“reuse its encoder layers”); the classifier gets its own Output layer and Softmax, and Phase 2 trains it on the labelled data. The slides never say the copied layers are frozen.',
  },
  code: {
    concept: 'ae.trainAutoencoderFn',
    src: { lecture: 5, slides: [24, 25] },
    prompt: 'Slides 24–25’s code is shuffled: tap the lines in order.',
    promptText: 'Stage 3 · stacked_ae_1_by_1, line by line',
    cards: [
      { id: 'c1', code: 'X_train_flat = Flatten()(X_train)', short: 'flatten' },
      { id: 'c2', code: 'enc1, dec1, X_train_enc1, X_valid_enc1 = train_autoencoder(100, X_train_flat, X_valid_flat)', short: 'first autoencoder (100)' },
      { id: 'c3', code: 'enc2, dec2, _, _ = train_autoencoder(30, X_train_enc1, X_valid_enc1, output_activation="relu")', short: 'second autoencoder (30)' },
      { id: 'c4', code: 'stacked_ae_1_by_1 = Sequential([Flatten(), enc1, enc2, dec2, dec1, Reshape([28, 28])])', short: 'stack' },
      { id: 'c5', code: 'stacked_ae_1_by_1.fit(X_train, X_train, epochs=5, …)', short: 'fine-tune (if needed)' },
    ],
    answer: ['c1', 'c2', 'c3', 'c4', 'c5'],
    why: 'Slide 24 flattens the images, trains the first autoencoder (100 codings) on X_train_flat, trains the second (30 codings) on its compressed output X_train_enc1, then stacks enc1, enc2, dec2, dec1; slide 25 continues training the stack for 5 epochs if needed.',
  },
  layers: {
    concept: 'ae.trainAutoencoderFn',
    src: { lecture: 5, slides: [24] },
    prompt: 'Stack the trained layers: tap them in order, from Flatten() to Reshape([28, 28]).',
    promptText: 'Stage 3 · the order inside stacked_ae_1_by_1',
    cards: [
      { id: 'enc1', code: 'enc1', short: 'enc1', text: 'Dense(100, relu) from the first autoencoder' },
      { id: 'enc2', code: 'enc2', short: 'enc2', text: 'Dense(30, relu) from the second autoencoder' },
      { id: 'dec2', code: 'dec2', short: 'dec2', text: 'Dense(100, relu) from the second autoencoder' },
      { id: 'dec1', code: 'dec1', short: 'dec1', text: 'Dense(784) from the first autoencoder' },
    ],
    answer: ['enc1', 'enc2', 'dec2', 'dec1'],
    why: 'Slide 24: Sequential([Flatten(), enc1, enc2, dec2, dec1, Reshape([28, 28])]): the encoders in the order they were trained, then the decoders in reverse, giving 784 → 100 → 30 → 100 → 784.',
  },
  ui: { lock: 'Lock order', undo: 'Undo', leaveOut: 'one card is a decoy', placed: '{n} of {m} placed' },
};

// ---------------------------------------------------------------------------------------------
// Stage 4 — drop an item on the t-SNE map (slides 14–15), this page's own Fashion MNIST run
// (lecture5-study/data/tsne.js + recon.js). The ten items are X_valid[0..9]; `near` = the classes
// holding at least NEAR.min of the NEAR.k map points closest to the item's own point (checked by
// tools/dl-arcade/check-bottleneck.mjs against the data).
// ---------------------------------------------------------------------------------------------
export const MAP = {
  concept: 'ae.tsne',
  src: { lecture: 5, slides: [14, 15] },
  // Fashion MNIST's label order (the dataset's names; the slides name no classes)
  classNames: ['T-shirt/top', 'Trouser', 'Pullover', 'Dress', 'Coat', 'Sandal', 'Shirt', 'Sneaker', 'Bag', 'Ankle boot'],
  // This page's own colour grouping (the lecture 5 study page's), so the map needs four colours, not ten.
  families: [
    { key: 'tops', name: 'tops, dresses and coats', classes: [0, 2, 3, 4, 6], color: '--dlv-blue' },
    { key: 'trousers', name: 'trousers', classes: [1], color: '--dlv-orange' },
    { key: 'shoes', name: 'footwear', classes: [5, 7, 9], color: '--dlv-aqua' },
    { key: 'bags', name: 'bags', classes: [8], color: '--dlv-yellow' },
  ],
  near: { k: 25, min: 8 },
  items: [
    { index: 0, label: 0, near: [3], tier: 'medium' },
    { index: 1, label: 8, near: [8], tier: 'easy' },
    { index: 2, label: 0, near: [0], tier: 'medium' },
    { index: 3, label: 6, near: [6, 2], tier: 'hard' },
    { index: 4, label: 5, near: [5], tier: 'easy' },
    { index: 5, label: 8, near: [8], tier: 'easy' },
    { index: 6, label: 0, near: [0, 6], tier: 'medium' },
    { index: 7, label: 4, near: [4, 3], tier: 'hard' },
    { index: 8, label: 7, near: [7], tier: 'easy' },
    { index: 9, label: 8, near: [8], tier: 'easy' },
  ],
  prompt: 'Drop this item on the map: which cluster does it belong to?',
  sub: 'Tap its cluster, then Drop.',
  promptText: 'Stage 4 · drop validation image {n} on the t-SNE map',
  drop: 'Drop',
  pick: 'tap a cluster',
  landed: 'its own coding landed here',
  itemLabel: 'X_valid[{i}]', // slide 14's validation set; the image is X_valid[i]
  itemAria: 'validation image {n} (its class is the question)',
  own: 'this page’s own run · t-SNE of stacked_encoder’s 30 codings of 5,000 Fashion MNIST validation images',
  loading: 'Loading this page’s Fashion MNIST run…',
  why: 'Graded by class: this is a {cls}, so it belongs with the {cls} points. Slide 14 encodes X_valid with stacked_encoder and runs TSNE() on those codings, which keeps similar instances close and dissimilar instances apart. On this page’s own map its coding landed among the {near} points{tail}.',
  tailMixed: '; the tops overlap on this map',
  drawer: [
    { kind: 'code', text: 'X_valid_compressed = stacked_encoder.predict(X_valid)   X_valid_2D = TSNE().fit_transform(X_valid_compressed)', src: { lecture: 5, slides: [14] } },
    { kind: 'text', text: '784 pixels → 30 codings (stacked_encoder) → 2D (t-SNE). The axes of a t-SNE map mean nothing; only who sits near whom does.', beyond: true,
      note: 'The chain is slides 12 + 14; that t-SNE axes carry no meaning is not slide text.', src: { lecture: 5, slides: [12, 14] } },
    { kind: 'text', text: 'Figure 17-5 (slide 15) colours each class and has no legend; this map colours four kinds of item (this page’s grouping) and names each class at its median point.', src: { lecture: 5, slides: [15] } },
  ],
};

// Shared words.
export const WORDS = {
  drawer: 'Show the maths',
  beyond: 'beyond the slides',
  right: 'right',
};
