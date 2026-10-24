/* ============================================================================
   FORGER — CONTENT (pure data, slide-cited)
   ----------------------------------------------------------------------------
   Lectures 6–7, slides 19–30 (Documents/cits5017/lectures/
   cits5017-lect06-07-AE-conv-var-GAN.pdf). Every item carries
   src: { lecture: 6, slides } (6 = the shared Lectures 6–7 deck).

     UI, INTRO, LEVEL_NAMES, ROUNDS    copy and the item plan per level
     SLIDE_TEXT        the slide sentences the game quotes, verbatim (the
                       check compares them with pdftotext when it can)
     STUDIO            level 1's toy run (GAN_PRESETS.one) and its demos
     INGREDIENTS       the three recipe rows (batch · labels · who learns)
     PHASES            phase 1 and phase 2: the right recipe + the slide
                       quote behind each ingredient + slide 25's code
     ORDER_SETS        tap-to-order cards (slide 25's loop)
     FACTS             choice items in the slides' words (levels 1–3)
     LOOP, GAPS        slide 25's loop body and the fill-the-gap lines
     DIAG              level 2: diagnose a live histogram (weak vs balanced)
     BUILD             level 3: the slide-28 guidelines as build slots
     DCGAN, SPOT       slide 29's code lines and "spot the departure" items
     NUMBERS           batch / codings arithmetic (slides 23–25, 29)

   Templates use %name% placeholders, filled by maths/forger.js (`fill`).
   "This page's own run" = the toy GAN of lecture6-7-study/gen.js (ToyGan:
   1-D numbers instead of images), never the slides' results.
   ========================================================================== */

export const LECTURE = 6;

export const UI = {
  own: 'this page’s own toy GAN (1-D numbers, not images)',
  loading: 'warming up this page’s toy GAN…',
  real: 'originals (real)',
  fake: 'forgeries (generator)',
  dcurve: 'discriminator: P(real)',
  before: 'before',
  after: 'after',
  iteration: 'iteration %t%',
  demo: '%phase% run %k%× in a row from iteration %t% (a demo; slide 25’s loop runs each phase once per batch)',
  demoHidden: 'one phase, run %k%× in a row from iteration %t% (a demo; slide 25’s loop runs each phase once per batch)',
  phaseName: { p1: 'phase 1', p2: 'phase 2' },
  replay: 'replay',
  replayAria: 'Replay the change',
  preset: 'GAN_PRESETS.%p%',
  answerMeta: 'the slide’s order',
  loopAria: 'Slide 25’s training loop with one line missing',
  spotAria: 'Slide 29’s code; the lit lines can be tapped',
  codeAria: 'The slide’s code for this question',
  bbarAria: 'The rows of the batch: fakes and real images with their labels',
  segText: '%n% × label %lab%',
  segHidden: '? × label %lab%',
  numberLabel: 'Your count',
  shapeLabels: ['batch_size', 'codings_size'],
  shapeAria: 'noise shape',
  studioAria: 'This page’s toy GAN on a number line: the real distribution, a histogram of the generator’s fakes and the discriminator’s P(real) curve.',
  offLeft: '◂ %n% off the scale',
  offRight: '%n% off the scale ▸',
  runA: 'run A',
  runB: 'run B',
  stripK: 'fakes on a real bump, every 100 iterations',
  stripAria: 'Share of the fakes on a real bump at every 100 iterations up to this one.',
  trayK: 'the batch',
  learnsOn: 'learns',
  dOff: 'frozen',
  gOff: 'not updated',
  ghostKey: 'dashed = before · solid = after',
  trayAria: 'The batch you built: forgeries and originals, each with its label.',
  trayEmpty: 'pick what goes in the batch',
  trayNote: '%n% + %n% shown as 4 + 4',
  trayNoteOne: '%n% shown as 4',
  rows: { batch: 'batch', labels: 'labels', learns: 'who learns' },
  run: 'Run this phase',
  runKey: 'Enter',
  submitOrder: 'Lock order',
  undo: 'Undo',
  orderAria: 'Steps to put in order',
  orderHint: 'tap in order · tap the last again to take it back',
  build: 'Build',
  buildAria: 'Build the network by the slide-28 guidelines',
  pick: 'Pick one',
  tapLine: 'Tap the line',
  gapMark: '?',
  codeFile: 'slide %s% · python',
  maths: 'Show the maths',
  dMax: 'discriminator weights: largest change $%d%$',
  gMax: 'generator weights: largest change $%g%$',
  exactly0: 'exactly 0',
  coverLine: 'fakes within 3 σ of each real bump (σ = 0.3): $%a%$ · $%b%$',
  meanLine: 'fakes: mean $%m%$, standard deviation $%s%$ (400 samples, fixed noise)',
  netIn: { gen: 'noise (codings)', disc: 'image' },
  netOut: { gen: 'image', disc: 'P(real)' },
  netLayers: { gen: ['hidden', 'hidden', 'output'], disc: ['input', 'hidden', 'output'] },
  netAria: '%net%: input, two more layers and the output, with the parts you are choosing marked.',
};

export const INTRO = {
  line: 'You run a forger’s studio: build each phase’s batch, run the loop in order, then read the forgeries.',
  controls: [
    'Tap the chips or cards (keys 1–6 pick a choice or a card)',
    'Enter runs / locks in · Backspace takes the last card back',
    'Show the maths: slide 25’s code and this run’s numbers',
  ],
};

export const LEVEL_NAMES = ['Two phases', 'Repeat yourself', 'DCGAN rules'];

// item types per level, in ramp order (maths/forger.js builds them)
export const ROUNDS = {
  1: ['which', 'recipe1', 'fact', 'recipe2', 'order', 'which', 'fact', 'recipe', 'order'],
  2: ['diagnose', 'fact', 'pair', 'gap', 'fact', 'diagnose', 'gap', 'fact', 'diagnose'],
  3: ['build', 'number', 'build', 'spot', 'fact', 'shape', 'build', 'spot', 'number'],
};

/* ── the slides' own sentences (verbatim; whitespace normalised) ────────── */
export const SLIDE_TEXT = {
  21: 'During training, the generator and the discriminator have opposite goals: the discriminator tries to distinguish fake images from real images, while the generator tries to produce images that look real enough to trick the discriminator. Because the GAN is composed of two networks with different objectives, it cannot be trained like a regular neural network. Each training iteration is divided into two phases: Phase 1: Training the discriminator. A batch of real images is sampled from the training set and is completed with an equal number of fake images produced by the generator. The labels are set to 0 for fake images and 1 for real images. The discriminator is trained on this labelled batch for one step, using the binary cross-entropy loss. Importantly, backpropagation only optimizes the weights of the discriminator during this phase.',
  22: 'Phase 2: Training the generator. We first use the generator to produce another batch of fake images, and once again the discriminator is used to tell whether the images are fake or real. This time we do not add real images in the batch, and all the labels are set to 1 (real); in other words, we want the generator to produce images that the discriminator will (wrongly) believe to be real! Crucially, the weights of the discriminator are frozen during this step, so backpropagation only affects the weights of the generator.',
  24: 'Since the training loop is unusual, we cannot use the regular fit() method. Instead, we will write a custom training loop. Note that there are two training phases in each iteration in the code on the next slide.',
  25: 'Note: train_on_batch is a method in the tf.keras.Model class. It runs a single gradient update on a single batch of data.',
  26: 'At the end of the first epoch, the generated images already start to look like (very noisy) Fashion MNIST images. Unfortunately, the images never really get much better than that, and you may even find epochs where the GAN seems to be forgetting what it learned.',
  27: 'As training advances, the game may end up in a state that game theorists call a Nash equilibrium – when no player would be better off changing their own strategy, assuming the other players do not change theirs. The authors of the paper demonstrated that a GAN can only reach a single Nash equilibrium; however, nothing guarantees that the equilibrium will ever be reached. The biggest difficulty is called mode collapse: this is when the generator\'s outputs gradually become less diverse, only producing images in a specific class. Moreover, because the generator and the discriminator are constantly pushing against each other, their parameters may end up oscillating and becoming unstable.',
  28: 'Replace any pooling layers with strided convolutions (in the discriminator) and transposed convolutions (in the generator). Use Batch Normalization in both the generator and the discriminator, except in the generator\'s output layer and the discriminator\'s input layer. Remove fully connected hidden layers for deeper architectures. Use ReLU activation in the generator for all layers except the output layer, which should use tanh. Use leaky ReLU activation in the discriminator for all layers. These guidelines will work in many cases, but not always.',
};

/* ── level 1: the studio (this page's toy run, GAN_PRESETS.one) ─────────── */
export const STUDIO = {
  preset: 'one',             // one bump at 1.5 (σ 0.35); lecture6-7-study/gen.js
  k: 100,                    // a demo repeats one phase k times so the change shows
  demoSeed: 2026,            // the demo's own batches (this page's choice)
  samples: 400,              // fakes drawn for the histogram (fixed noise, seed 99)
  noiseSeed: 99,
  p1At: [25, 50, 100],       // checkpoints where k phase-1 steps visibly move D
  p2At: [200, 300, 400],     // checkpoints where k phase-2 steps visibly move the fakes
  axis: { one: [-2.5, 4], two: [-6, 6] },
  bins: 52,
  src: { lecture: 6, slides: [21, 22, 25] },
};

/* ── the recipe rows (same options for both phases) ────────────────────── */
export const INGREDIENTS = {
  batch: [
    { key: 'realPlusFake', text: 'real images + an equal number of fakes', real: true, fake: true },
    { key: 'fakeOnly', text: 'fakes only (no real images)', real: false, fake: true },
    { key: 'realOnly', text: 'real images only', real: true, fake: false },
  ],
  labels: [
    { key: 'fake0real1', text: 'fake 0 · real 1', fakeLabel: 0, realLabel: 1 },
    { key: 'fake1real0', text: 'fake 1 · real 0', fakeLabel: 1, realLabel: 0 },
    { key: 'all1', text: 'all 1 (real)', fakeLabel: 1, realLabel: 1 },
    { key: 'all0', text: 'all 0 (fake)', fakeLabel: 0, realLabel: 0 },
  ],
  learns: [
    { key: 'disc', text: 'the discriminator only', d: true, g: false },
    { key: 'gen', text: 'the generator only (discriminator frozen)', d: false, g: true },
    { key: 'both', text: 'both networks', d: true, g: true },
  ],
};

export const PHASES = {
  1: {
    id: 'p1',
    title: 'Phase 1: Training the discriminator',
    concept: 'gan.phase1',
    src: { lecture: 6, slides: [21, 25] },
    answer: { batch: 'realPlusFake', labels: 'fake0real1', learns: 'disc' },
    quotes: {
      batch: 'A batch of real images is sampled from the training set and is completed with an equal number of fake images produced by the generator.',
      labels: 'The labels are set to 0 for fake images and 1 for real images.',
      learns: 'Importantly, backpropagation only optimizes the weights of the discriminator during this phase.',
    },
    code: [
      'X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)',
      'y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)',
      'discriminator.trainable = True  # *** this line is missing in the author\'s code',
      'discriminator.train_on_batch(X_fake_and_real, y1)',
    ],
    prompt: 'Phase 1: Training the discriminator. Build its batch.',
    why: 'Slide 21: "A batch of real images is sampled from the training set and is completed with an equal number of fake images produced by the generator. The labels are set to 0 for fake images and 1 for real images." Backpropagation only optimizes the discriminator\'s weights (slide 25: discriminator.trainable = True, then discriminator.train_on_batch(X_fake_and_real, y1)).',
  },
  2: {
    id: 'p2',
    title: 'Phase 2: Training the generator',
    concept: 'gan.phase2',
    src: { lecture: 6, slides: [22, 25] },
    answer: { batch: 'fakeOnly', labels: 'all1', learns: 'gen' },
    quotes: {
      batch: 'This time we do not add real images in the batch',
      labels: 'all the labels are set to 1 (real)',
      learns: 'Crucially, the weights of the discriminator are frozen during this step, so backpropagation only affects the weights of the generator.',
    },
    code: [
      'noise = tf.random.normal(shape=[batch_size, codings_size])',
      'y2 = tf.constant([[1.]] * batch_size)',
      'discriminator.trainable = False  # *** this line is missing in the author\'s code',
      'gan.train_on_batch(noise, y2)',
    ],
    prompt: 'Phase 2: Training the generator. Build its batch.',
    why: 'Slide 22: "This time we do not add real images in the batch, and all the labels are set to 1 (real)" — the generator should make images the discriminator will (wrongly) believe to be real; "the weights of the discriminator are frozen during this step, so backpropagation only affects the weights of the generator" (slide 25: discriminator.trainable = False, then gan.train_on_batch(noise, y2)).',
  },
};

// "which phase just ran?" (level 1): the studio shows before (ghost) and after
export const WHICH = {
  concept: { p1: 'gan.phase1', p2: 'gan.phase2' },
  src: { p1: { lecture: 6, slides: [21] }, p2: { lecture: 6, slides: [22] } },
  prompt: 'Something ran in the studio. Look at what moved: which phase was it?',
  choices: [
    { key: 'p1', text: 'phase 1: the discriminator trained' },
    { key: 'p2', text: 'phase 2: the generator trained, discriminator frozen' },
    { key: 'both', text: 'both networks trained in the same step' },
  ],
  why: {
    p1: 'Only the P(real) curve moved; the forgeries did not change at all (generator weights: exactly 0 change). Slide 21: in phase 1 "backpropagation only optimizes the weights of the discriminator".',
    p2: 'Only the forgeries moved; the P(real) curve stayed put (discriminator weights: exactly 0 change). Slide 22: "the weights of the discriminator are frozen during this step, so backpropagation only affects the weights of the generator".',
  },
};

/* ── tap-to-order (slide 25's loop) ────────────────────────────────────── */
export const ORDER_SETS = [
  {
    id: 'toggles', concept: 'gan.trainLoop', src: { lecture: 6, slides: [25] },
    prompt: 'Put these lines in the order slide 25’s loop runs them.',
    cards: [
      { id: 'tTrue', code: 'discriminator.trainable = True' },
      { id: 'dTrain', code: 'discriminator.train_on_batch(X_fake_and_real, y1)' },
      { id: 'tFalse', code: 'discriminator.trainable = False' },
      { id: 'gTrain', code: 'gan.train_on_batch(noise, y2)' },
    ],
    why: 'Slide 25: phase 1 sets discriminator.trainable = True, then discriminator.train_on_batch(X_fake_and_real, y1); phase 2 sets discriminator.trainable = False "so that training gan will result in training the generator only", then gan.train_on_batch(noise, y2).',
  },
  {
    id: 'phase1', concept: 'gan.phase1', src: { lecture: 6, slides: [25] },
    prompt: 'Put phase 1’s lines in the order slide 25’s loop runs them.',
    cards: [
      { id: 'noise', code: 'noise = tf.random.normal(shape=[batch_size, codings_size])' },
      { id: 'gen', code: 'generated_images = generator(noise)' },
      { id: 'concat', code: 'X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)' },
      { id: 'dTrain', code: 'discriminator.train_on_batch(X_fake_and_real, y1)' },
    ],
    why: 'Slide 25, phase 1: draw the noise, let the generator turn it into generated_images, concatenate them with the real X_batch (fakes first), then train the discriminator on X_fake_and_real with y1.',
  },
  {
    id: 'words', concept: 'gan.trainLoop', src: { lecture: 6, slides: [21, 22, 25] },
    prompt: 'One training iteration: put the steps in order.',
    cards: [
      { id: 'fakes1', text: 'The generator makes a batch of fakes from noise' },
      { id: 'dStep', text: 'The discriminator trains one step on the fakes (0) + an equal batch of real images (1)' },
      { id: 'fakes2', text: 'The generator makes another batch of fakes' },
      { id: 'gStep', text: 'The gan trains on those fakes, all labelled 1, discriminator frozen' },
    ],
    why: 'Each training iteration is divided into two phases (slide 21): phase 1 trains the discriminator on real images completed with an equal number of fakes; phase 2 (slide 22) uses the generator to produce another batch of fakes, all labelled 1, with the discriminator frozen. Slide 25 runs them in that order for every X_batch.',
  },
];

/* ── choice items in the slides' words ─────────────────────────────────── */
// choices[0] is the right one (maths/forger.js shuffles); `quote` must appear in SLIDE_TEXT[quoteSlide]
export const FACTS = [
  // level 1 — the two phases
  { id: 'f.p1.equal', level: 1, concept: 'gan.phase1', src: { lecture: 6, slides: [21] }, quoteSlide: 21,
    quote: 'completed with an equal number of fake images produced by the generator',
    prompt: 'Phase 1: a batch of real images is sampled from the training set and is completed with…',
    choices: [
      { key: 'equal', text: 'an equal number of fake images produced by the generator' },
      { key: 'half', text: 'half as many fake images produced by the generator' },
      { key: 'more', text: 'another batch of real images from the training set' },
    ],
    why: 'Slide 21: "A batch of real images is sampled from the training set and is completed with an equal number of fake images produced by the generator."' },
  { id: 'f.p1.labels', level: 1, concept: 'gan.phase1', src: { lecture: 6, slides: [21] }, quoteSlide: 21,
    quote: 'The labels are set to 0 for fake images and 1 for real images.',
    prompt: 'Phase 1: how are the labels set?',
    choices: [
      { key: 'f0r1', text: '0 for fake images and 1 for real images' },
      { key: 'f1r0', text: '1 for fake images and 0 for real images' },
      { key: 'all1', text: '1 for every image' },
    ],
    why: 'Slide 21: "The labels are set to 0 for fake images and 1 for real images." Slide 25 matches: X_fake_and_real puts generated_images first and y1 = [[0.]] * batch_size + [[1.]] * batch_size.' },
  { id: 'f.p1.loss', level: 1, concept: 'gan.phase1', src: { lecture: 6, slides: [21, 24] }, quoteSlide: 21,
    quote: 'using the binary cross-entropy loss',
    prompt: 'Which loss does the discriminator train with on phase 1’s labelled batch?',
    choices: [
      { key: 'bce', text: 'the binary cross-entropy loss' },
      { key: 'mse', text: 'the mean squared error' },
      { key: 'latent', text: 'the latent loss' },
    ],
    why: 'Slide 21: "The discriminator is trained on this labelled batch for one step, using the binary cross-entropy loss." Slide 24 compiles it with loss="binary_crossentropy".' },
  { id: 'f.p1.weights', level: 1, concept: 'gan.phase1', src: { lecture: 6, slides: [21] }, quoteSlide: 21,
    quote: 'backpropagation only optimizes the weights of the discriminator during this phase',
    prompt: 'During phase 1, backpropagation only optimizes the weights of…',
    choices: [
      { key: 'disc', text: 'the discriminator' },
      { key: 'gen', text: 'the generator' },
      { key: 'both', text: 'the generator and the discriminator' },
    ],
    why: 'Slide 21: "Importantly, backpropagation only optimizes the weights of the discriminator during this phase."' },
  { id: 'f.p2.labels', level: 1, concept: 'gan.phase2', src: { lecture: 6, slides: [22] }, quoteSlide: 22,
    quote: 'all the labels are set to 1 (real)',
    prompt: 'Phase 2 feeds the discriminator fakes only. Their labels are set to…',
    choices: [
      { key: 'all1', text: '1 (real), every one of them' },
      { key: 'all0', text: '0 (fake), every one of them' },
      { key: 'mixed', text: '0 for half of them and 1 for the rest' },
    ],
    why: 'Slide 22: "all the labels are set to 1 (real); in other words, we want the generator to produce images that the discriminator will (wrongly) believe to be real!" Slide 25: y2 = tf.constant([[1.]] * batch_size).' },
  { id: 'f.p2.frozen', level: 1, concept: 'gan.phase2', src: { lecture: 6, slides: [22] }, quoteSlide: 22,
    quote: 'the weights of the discriminator are frozen during this step',
    prompt: 'During phase 2, the discriminator’s weights are…',
    choices: [
      { key: 'frozen', text: 'frozen, so backpropagation only affects the generator' },
      { key: 'trained', text: 'trained on the fakes labelled 1' },
      { key: 'reset', text: 'trained on real images only' },
    ],
    why: 'Slide 22: "Crucially, the weights of the discriminator are frozen during this step, so backpropagation only affects the weights of the generator."' },
  { id: 'f.p2.noreal', level: 1, concept: 'gan.phase2', src: { lecture: 6, slides: [22] }, quoteSlide: 22,
    quote: 'This time we do not add real images in the batch',
    prompt: 'Does phase 2 put real images in the batch?',
    choices: [
      { key: 'no', text: 'No: another batch of fake images only' },
      { key: 'equal', text: 'Yes: an equal number of real images' },
      { key: 'only', text: 'Yes: real images only' },
    ],
    why: 'Slide 22: "We first use the generator to produce another batch of fake images … This time we do not add real images in the batch …"' },
  { id: 'f.regular', level: 1, concept: 'gan.idea', src: { lecture: 6, slides: [21] }, quoteSlide: 21,
    quote: 'Because the GAN is composed of two networks with different objectives, it cannot be trained like a regular neural network.',
    prompt: 'Why can’t a GAN be trained like a regular neural network?',
    choices: [
      { key: 'two', text: 'it is composed of two networks with different objectives' },
      { key: 'noloss', text: 'it has no loss function to minimise' },
      { key: 'nolabels', text: 'Fashion MNIST has no labels' },
    ],
    why: 'Slide 21: "Because the GAN is composed of two networks with different objectives, it cannot be trained like a regular neural network. Each training iteration is divided into two phases …"' },
  // level 2 — difficulties and the loop's toggles
  { id: 'f.mc.biggest', level: 2, concept: 'gan.modeCollapse', src: { lecture: 6, slides: [27] }, quoteSlide: 27,
    quote: 'The biggest difficulty is called mode collapse',
    prompt: 'The biggest difficulty of training GANs is called…',
    choices: [
      { key: 'mc', text: 'mode collapse' },
      { key: 'nash', text: 'Nash equilibrium' },
      { key: 'osc', text: 'oscillating parameters' },
    ],
    why: 'Slide 27: "The biggest difficulty is called mode collapse: this is when the generator\'s outputs gradually become less diverse, only producing images in a specific class."' },
  { id: 'f.mc.def', level: 2, concept: 'gan.modeCollapse', src: { lecture: 6, slides: [27] }, quoteSlide: 27,
    quote: 'the generator\'s outputs gradually become less diverse, only producing images in a specific class',
    prompt: 'Mode collapse is when the generator’s outputs gradually…',
    choices: [
      { key: 'less', text: 'become less diverse, only producing images in a specific class' },
      { key: 'noisy', text: 'become noisier while still covering every class' },
      { key: 'real', text: 'become impossible to tell from real images' },
    ],
    why: 'Slide 27: mode collapse "is when the generator\'s outputs gradually become less diverse, only producing images in a specific class".' },
  { id: 'f.nash.def', level: 2, concept: 'gan.nash', src: { lecture: 6, slides: [27] }, quoteSlide: 27,
    quote: 'when no player would be better off changing their own strategy, assuming the other players do not change theirs',
    prompt: 'A Nash equilibrium is a state where…',
    choices: [
      { key: 'def', text: 'no player would be better off changing their own strategy, assuming the other players do not change theirs' },
      { key: 'zero', text: 'both networks’ losses reach exactly zero' },
      { key: 'one', text: 'the generator only produces images in a specific class' },
    ],
    why: 'Slide 27: a Nash equilibrium is "when no player would be better off changing their own strategy, assuming the other players do not change theirs".' },
  { id: 'f.nash.single', level: 2, concept: 'gan.nash', src: { lecture: 6, slides: [27] }, quoteSlide: 27,
    quote: 'a GAN can only reach a single Nash equilibrium; however, nothing guarantees that the equilibrium will ever be reached',
    prompt: 'What does slide 27 say about a GAN and its Nash equilibrium?',
    choices: [
      { key: 'single', text: 'it can only reach a single one, but nothing guarantees it will ever be reached' },
      { key: 'always', text: 'it always reaches it after enough epochs' },
      { key: 'many', text: 'it can reach many, one per class' },
    ],
    why: 'Slide 27: "The authors of the paper demonstrated that a GAN can only reach a single Nash equilibrium; however, nothing guarantees that the equilibrium will ever be reached."' },
  { id: 'f.osc', level: 2, concept: 'gan.instability', src: { lecture: 6, slides: [27] }, quoteSlide: 27,
    quote: 'their parameters may end up oscillating and becoming unstable',
    prompt: 'Because the generator and the discriminator are constantly pushing against each other, their parameters may end up…',
    choices: [
      { key: 'osc', text: 'oscillating and becoming unstable' },
      { key: 'frozen', text: 'frozen for the rest of training' },
      { key: 'equal', text: 'identical in both networks' },
    ],
    why: 'Slide 27: "Moreover, because the generator and the discriminator are constantly pushing against each other, their parameters may end up oscillating and becoming unstable."' },
  { id: 'f.forget', level: 2, concept: 'gan.instability', src: { lecture: 6, slides: [26] }, quoteSlide: 26,
    quote: 'the images never really get much better than that, and you may even find epochs where the GAN seems to be forgetting what it learned',
    prompt: 'After one epoch the GAN’s images look like very noisy Fashion MNIST. What happens next (slide 26)?',
    choices: [
      { key: 'forget', text: 'they never really get much better, and some epochs it seems to forget what it learned' },
      { key: 'sharper', text: 'they get steadily sharper with every epoch' },
      { key: 'perfect', text: 'they look perfect after 50 epochs' },
    ],
    why: 'Slide 26: "Unfortunately, the images never really get much better than that, and you may even find epochs where the GAN seems to be forgetting what it learned."' },
  { id: 'f.fit', level: 2, concept: 'gan.trainLoop', src: { lecture: 6, slides: [24] }, quoteSlide: 24,
    quote: 'Since the training loop is unusual, we cannot use the regular fit() method.',
    prompt: 'Why does slide 24 write a custom training loop instead of calling fit()?',
    choices: [
      { key: 'unusual', text: 'the training loop is unusual: two training phases in each iteration' },
      { key: 'data', text: 'fit() cannot read a tf.data.Dataset' },
      { key: 'loss', text: 'the discriminator has no loss to fit' },
    ],
    why: 'Slide 24: "Since the training loop is unusual, we cannot use the regular fit() method. Instead, we will write a custom training loop. Note that there are two training phases in each iteration …"' },
  { id: 'f.tob', level: 2, concept: 'gan.trainLoop', src: { lecture: 6, slides: [25] }, quoteSlide: 25,
    quote: 'It runs a single gradient update on a single batch of data.',
    prompt: 'What does train_on_batch do (slide 25’s note)?',
    choices: [
      { key: 'one', text: 'runs a single gradient update on a single batch of data' },
      { key: 'epoch', text: 'runs one full epoch over the dataset' },
      { key: 'eval', text: 'evaluates the loss without updating any weights' },
    ],
    why: 'Slide 25: "train_on_batch is a method in the tf.keras.Model class. It runs a single gradient update on a single batch of data."' },
  { id: 'f.compile', level: 2, concept: 'gan.keras', src: { lecture: 6, slides: [24] }, quoteSlide: null,
    prompt: 'Which models does slide 24 compile?',
    choices: [
      { key: 'dg', text: 'discriminator and gan' },
      { key: 'gd', text: 'generator and discriminator' },
      { key: 'all', text: 'generator, discriminator and gan' },
    ],
    why: 'Slide 24: discriminator.compile(loss="binary_crossentropy", optimizer="rmsprop") and gan.compile(loss="binary_crossentropy", optimizer="rmsprop"). The generator is never compiled on its own; it only trains through gan.train_on_batch.' },
  { id: 'f.falseWhy', level: 2, concept: 'gan.trainLoop', src: { lecture: 6, slides: [25] }, quoteSlide: null,
    prompt: 'Why does slide 25 set discriminator.trainable = False before gan.train_on_batch(noise, y2)?',
    choices: [
      { key: 'genOnly', text: 'so that training gan will result in training the generator only' },
      { key: 'fakeReal', text: 'so that the discriminator learns the fakes are real' },
      { key: 'fit', text: 'so that fit() can be used' },
    ],
    why: 'Slide 25\'s comment: "discriminator now needs to be non-trainable so that training gan will result in training the generator only." Slide 22: the discriminator\'s weights are frozen in phase 2. (Both trainable lines are marked "this line is missing in the author\'s code"; the slides compile once, before the loop.)' },
  // level 3 — DCGAN
  { id: 'f.dc.discBN', level: 3, concept: 'dcgan.vsGuidelines', src: { lecture: 6, slides: [28, 29] }, quoteSlide: null,
    prompt: 'Guideline 2 asks for Batch Normalization in both networks. What does slide 29’s discriminator do?',
    choices: [
      { key: 'none', text: 'it has no BatchNormalization at all; it uses Dropout(0.4) after each Conv2D' },
      { key: 'input', text: 'it puts BatchNormalization on its input layer' },
      { key: 'each', text: 'it puts BatchNormalization after each Conv2D' },
    ],
    why: 'Slide 29\'s discriminator is Conv2D → Dropout(0.4) → Conv2D → Dropout(0.4) → Flatten → Dense(1, sigmoid): no BatchNormalization, although slide 28\'s guideline 2 says "Use Batch Normalization in both the generator and the discriminator, except in … the discriminator\'s input layer". Dropout is not one of the guidelines.' },
  { id: 'f.dc.genBN', level: 3, concept: 'bn.dcgan', src: { lecture: 6, slides: [28, 29] }, quoteSlide: null,
    prompt: 'Where does slide 29’s generator put its BatchNormalization layers?',
    choices: [
      { key: 'two', text: 'after the Reshape and after the first Conv2DTranspose; none after the tanh output' },
      { key: 'both', text: 'after both Conv2DTranspose layers, including the tanh output' },
      { key: 'none', text: 'nowhere: the generator has none' },
    ],
    why: 'Slide 29: Reshape([7, 7, 128]) → BatchNormalization() → Conv2DTranspose(64, …, relu) → BatchNormalization() → Conv2DTranspose(1, …, tanh). That follows guideline 2: no Batch Normalization in the generator\'s output layer (slide 28).' },
  { id: 'f.dc.pool', level: 3, concept: 'dcgan.keras', src: { lecture: 6, slides: [28, 29] }, quoteSlide: null,
    prompt: 'How do slide 29’s networks shrink and grow their feature maps?',
    choices: [
      { key: 'strides', text: 'strides=2 in every Conv2D and Conv2DTranspose; no pooling layers' },
      { key: 'maxpool', text: 'MaxPool2D after each Conv2D in the discriminator' },
      { key: 'both', text: 'pooling layers in both networks' },
    ],
    why: 'All four conv layers on slide 29 use kernel_size=5, strides=2, padding="same", and neither network has a pooling layer — guideline 1: "Replace any pooling layers with strided convolutions (in the discriminator) and transposed convolutions (in the generator)" (slide 28).' },
  { id: 'f.dc.notalways', level: 3, concept: 'dcgan.guidelines', src: { lecture: 6, slides: [28] }, quoteSlide: 28,
    quote: 'These guidelines will work in many cases, but not always.',
    prompt: 'What does slide 28 say about its DCGAN guidelines?',
    choices: [
      { key: 'many', text: 'they will work in many cases, but not always' },
      { key: 'always', text: 'they always give a stable GAN' },
      { key: 'faces', text: 'they only work on datasets of faces' },
    ],
    why: 'Slide 28: "These guidelines will work in many cases, but not always."' },
  { id: 'f.dc.leaky', level: 3, concept: 'dcgan.keras', src: { lecture: 6, slides: [29] }, quoteSlide: null,
    prompt: 'Slide 29’s discriminator passes which activation to its two Conv2D layers?',
    choices: [
      { key: 'l02', text: '`tf.keras.layers.LeakyReLU(0.2)`' },
      { key: 'relu', text: '`activation="relu"`' },
      { key: 'l04', text: '`tf.keras.layers.LeakyReLU(0.4)`' },
    ],
    why: 'Slide 29: both Conv2D layers use activation=tf.keras.layers.LeakyReLU(0.2) (guideline 5: leaky ReLU in the discriminator). The 0.4 on the slide is Dropout(0.4).' },
  { id: 'f.dc.tanh', level: 3, concept: 'gan.keras', src: { lecture: 6, slides: [23, 29] }, quoteSlide: null,
    prompt: 'The DCGAN generator (slide 29) ends in tanh. What does the slide-23 GAN generator end in?',
    choices: [
      { key: 'sigmoid', text: '`Dense(28 * 28, activation="sigmoid")` then a Reshape' },
      { key: 'tanh', text: '`Dense(28 * 28, activation="tanh")` then a Reshape' },
      { key: 'relu', text: '`Dense(28 * 28, activation="relu")` then a Reshape' },
    ],
    why: 'Slide 23: the GAN generator is Dense(100) → Dense(150) → Dense(28 * 28, activation="sigmoid") → Reshape([28, 28]). Slide 29\'s DCGAN generator ends with Conv2DTranspose(1, …, activation="tanh"), as guideline 4 asks (slide 28).' },
];

/* ── level 2: fill the gap in slide 25's loop ──────────────────────────── */
// the loop body as slide 25 prints it (the two "# ***" comments trimmed)
export const LOOP = {
  src: { lecture: 6, slides: [25] },
  prompt: 'Fill the gap in slide 25’s loop as the slide prints it.',
  lines: [
    { id: 'for', code: 'for X_batch in dataset:' },
    { id: 'c1', code: '    ### phase 1 - training the discriminator' },
    { id: 'noise1', code: '    noise = tf.random.normal(shape=[batch_size, codings_size])' },
    { id: 'gen', code: '    generated_images = generator(noise)' },
    { id: 'concat', code: '    X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)' },
    { id: 'y1', code: '    y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)' },
    { id: 'tTrue', code: '    discriminator.trainable = True' },
    { id: 'dTrain', code: '    discriminator.train_on_batch(X_fake_and_real, y1)' },
    { id: 'c2', code: '    ### phase 2 - training the generator' },
    { id: 'noise2', code: '    noise = tf.random.normal(shape=[batch_size, codings_size])' },
    { id: 'y2', code: '    y2 = tf.constant([[1.]] * batch_size)' },
    { id: 'c3', code: '    # discriminator now needs to be non-trainable so that training gan' },
    { id: 'c4', code: '    # will result in training the generator only.' },
    { id: 'tFalse', code: '    discriminator.trainable = False' },
    { id: 'gTrain', code: '    gan.train_on_batch(noise, y2)' },
  ],
  note: '“# ***” comments trimmed',
};

export const GAPS = [
  { id: 'g.tTrue', line: 'tTrue', concept: 'gan.trainLoop', src: { lecture: 6, slides: [21, 25] },
    choices: [
      { key: 'right', code: 'discriminator.trainable = True' },
      { key: 'false', code: 'discriminator.trainable = False' },
      { key: 'gen', code: 'generator.trainable = False' },
    ],
    why: 'Slide 25 sets discriminator.trainable = True right before discriminator.train_on_batch(X_fake_and_real, y1): in phase 1 "backpropagation only optimizes the weights of the discriminator" (slide 21). The line carries "# *** this line is missing in the author\'s code".' },
  { id: 'g.tFalse', line: 'tFalse', concept: 'gan.trainLoop', src: { lecture: 6, slides: [22, 25] },
    choices: [
      { key: 'right', code: 'discriminator.trainable = False' },
      { key: 'true', code: 'discriminator.trainable = True' },
      { key: 'gen', code: 'generator.trainable = True' },
    ],
    why: 'Slide 25: "discriminator now needs to be non-trainable so that training gan will result in training the generator only", so discriminator.trainable = False comes right before gan.train_on_batch(noise, y2) (slide 22: the discriminator is frozen in phase 2).' },
  { id: 'g.y1', line: 'y1', concept: 'gan.phase1', src: { lecture: 6, slides: [21, 25] },
    choices: [
      { key: 'right', code: 'y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)' },
      { key: 'swap', code: 'y1 = tf.constant([[1.]] * batch_size + [[0.]] * batch_size)' },
      { key: 'ones', code: 'y1 = tf.constant([[1.]] * batch_size)' },
    ],
    why: 'X_fake_and_real puts generated_images first, then X_batch, and slide 21 labels fake images 0 and real images 1 — so y1 is batch_size zeros followed by batch_size ones (slide 25).' },
  { id: 'g.y2', line: 'y2', concept: 'gan.phase2', src: { lecture: 6, slides: [22, 25] },
    choices: [
      { key: 'right', code: 'y2 = tf.constant([[1.]] * batch_size)' },
      { key: 'zeros', code: 'y2 = tf.constant([[0.]] * batch_size)' },
      { key: 'mixed', code: 'y2 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)' },
    ],
    why: 'Phase 2 sends fakes only and "all the labels are set to 1 (real)" (slide 22): y2 = tf.constant([[1.]] * batch_size) (slide 25).' },
  { id: 'g.gTrain', line: 'gTrain', concept: 'gan.trainLoop', src: { lecture: 6, slides: [24, 25] },
    choices: [
      { key: 'right', code: 'gan.train_on_batch(noise, y2)' },
      { key: 'gen', code: 'generator.train_on_batch(noise, y2)' },
      { key: 'disc', code: 'discriminator.train_on_batch(noise, y2)' },
    ],
    why: 'Phase 2 trains through the whole gan (generator then the frozen discriminator): gan.train_on_batch(noise, y2) (slide 25). The generator is never compiled on its own; slide 24 compiles only discriminator and gan.' },
  { id: 'g.dTrain', line: 'dTrain', concept: 'gan.phase1', src: { lecture: 6, slides: [21, 25] },
    choices: [
      { key: 'right', code: 'discriminator.train_on_batch(X_fake_and_real, y1)' },
      { key: 'gan', code: 'gan.train_on_batch(X_fake_and_real, y1)' },
      { key: 'real', code: 'discriminator.train_on_batch(X_batch, y1)' },
    ],
    why: 'Phase 1 trains the discriminator for one step on the labelled batch of fakes + real images: discriminator.train_on_batch(X_fake_and_real, y1) (slides 21, 25).' },
];

/* ── level 2: diagnose a live run (GAN_PRESETS.weak vs .balanced) ──────── */
// The verdict per frame is this page's run, checked by tools/dl-arcade/check-forger.mjs.
export const DIAG = {
  src: { lecture: 6, slides: [26, 27] },
  frames: {
    collapse: { preset: 'weak', at: [400, 600, 800, 1000, 1200] },
    covered: { preset: 'balanced', at: [900, 1000, 1100, 1200] },
    unstable: { preset: 'weak', at: [1800, 1900, 2000, 2100] },
  },
  pairAt: [900, 1000, 1100, 1200],
  concept: { collapse: 'gan.modeCollapse', covered: 'gan.modeCollapse', unstable: 'gan.instability' },
  prompt: 'The originals have two bumps. Read this run’s forgeries: what is going on?',
  choices: [
    { key: 'collapse', text: 'mode collapse: the forgeries sit on one bump only' },
    { key: 'covered', text: 'diverse: the forgeries cover both bumps' },
    { key: 'unstable', text: 'unstable: the forgeries scatter, as if it forgot what it learned' },
  ],
  why: {
    collapse: 'Nearly every forgery sits on one of the two real bumps: the generator\'s outputs have become less diverse, "only producing images in a specific class" — mode collapse, "the biggest difficulty" (slide 27). This page\'s run: GAN_PRESETS.weak.',
    covered: 'The forgeries cover both real bumps, so this run has not collapsed (slide 27 defines mode collapse as outputs becoming less diverse, one class only). This page\'s run: GAN_PRESETS.balanced.',
    unstable: 'This run sat on one bump for over a thousand iterations, then its forgeries scattered off both bumps, as if the GAN were "forgetting what it learned" (slide 26). Slide 27 warns that because the generator and the discriminator are "constantly pushing against each other", training can become unstable. This page\'s run: GAN_PRESETS.weak.',
  },
  pair: {
    prompt: 'Two runs on the same two-bump originals, same iteration. Which one has collapsed?',
    choices: [
      { key: 'A', text: 'run A' },
      { key: 'B', text: 'run B' },
      { key: 'neither', text: 'neither: both cover both bumps' },
    ],
    why: 'Run %w% puts nearly every forgery on one bump: its outputs have become less diverse, "only producing images in a specific class" — mode collapse (slide 27). Run %b% covers both bumps. These are this page\'s runs GAN_PRESETS.weak and .balanced.',
  },
};

/* ── level 3: build by the slide-28 guidelines ─────────────────────────── */
export const GUIDELINES = [
  { n: 1, text: 'Replace any pooling layers with strided convolutions (in the discriminator) and transposed convolutions (in the generator).' },
  { n: 2, text: 'Use Batch Normalization in both the generator and the discriminator, except in the generator\'s output layer and the discriminator\'s input layer.' },
  { n: 3, text: 'Remove fully connected hidden layers for deeper architectures.' },
  { n: 4, text: 'Use ReLU activation in the generator for all layers except the output layer, which should use tanh.' },
  { n: 5, text: 'Use leaky ReLU activation in the discriminator for all layers.' },
];

export const BUILD = {
  concept: 'dcgan.guidelines',
  src: { lecture: 6, slides: [28] },
  prompt: 'Build a DCGAN %net% by the slide-28 guidelines.',
  nets: {
    gen: { name: 'generator', slots: ['g.sample', 'g.bn', 'g.hidden', 'g.out', 'g.fc'] },
    disc: { name: 'discriminator', slots: ['d.sample', 'd.bn', 'd.act', 'd.fc'] },
  },
  // where each slot sits on the drawing: layer indexes 0–2 (UI.netLayers) and a short tag per option
  slots: {
    'g.sample': { label: 'to up-sample, use', guideline: 1, at: [1, 2], answer: 'transposed',
      options: [{ key: 'transposed', text: 'transposed convolutions', tag: 'Conv2DT' }, { key: 'strided', text: 'strided convolutions', tag: 'Conv2D s2' }, { key: 'pooling', text: 'pooling layers', tag: 'pool' }] },
    'g.bn': { label: 'Batch Normalization in', guideline: 2, at: [0, 1, 2], answer: 'notOut',
      options: [{ key: 'notOut', text: 'every layer except the output layer', tag: 'BN' }, { key: 'notIn', text: 'every layer except the input layer', tag: 'BN' }, { key: 'none', text: 'no layer', tag: '' }] },
    'g.hidden': { label: 'activation of every layer but the output', guideline: 4, at: [0, 1], answer: 'relu',
      options: [{ key: 'relu', text: 'ReLU', tag: 'ReLU' }, { key: 'leaky', text: 'leaky ReLU', tag: 'leaky' }, { key: 'tanh', text: 'tanh', tag: 'tanh' }] },
    'g.out': { label: 'activation of the output layer', guideline: 4, at: [2], answer: 'tanh',
      options: [{ key: 'tanh', text: 'tanh', tag: 'tanh' }, { key: 'relu', text: 'ReLU', tag: 'ReLU' }, { key: 'sigmoid', text: 'sigmoid', tag: 'sigmoid' }] },
    'g.fc': { label: 'fully connected hidden layers (deeper nets)', guideline: 3, at: [0, 1], answer: 'remove',
      options: [{ key: 'remove', text: 'remove them', tag: 'no Dense' }, { key: 'keep', text: 'keep them', tag: 'Dense' }] },
    'd.sample': { label: 'to down-sample, use', guideline: 1, at: [0, 1], answer: 'strided',
      options: [{ key: 'strided', text: 'strided convolutions', tag: 'Conv2D s2' }, { key: 'pooling', text: 'pooling layers', tag: 'pool' }, { key: 'transposed', text: 'transposed convolutions', tag: 'Conv2DT' }] },
    'd.bn': { label: 'Batch Normalization in', guideline: 2, at: [0, 1, 2], answer: 'notIn',
      options: [{ key: 'notIn', text: 'every layer except the input layer', tag: 'BN' }, { key: 'notOut', text: 'every layer except the output layer', tag: 'BN' }, { key: 'none', text: 'no layer', tag: '' }] },
    'd.act': { label: 'activation of every layer', guideline: 5, at: [0, 1, 2], answer: 'leaky',
      options: [{ key: 'leaky', text: 'leaky ReLU', tag: 'leaky' }, { key: 'relu', text: 'ReLU', tag: 'ReLU' }, { key: 'tanh', text: 'tanh', tag: 'tanh' }] },
    'd.fc': { label: 'fully connected hidden layers (deeper nets)', guideline: 3, at: [1], answer: 'remove',
      options: [{ key: 'remove', text: 'remove them', tag: 'no Dense' }, { key: 'keep', text: 'keep them', tag: 'Dense' }] },
  },
  why: {
    'g.sample': 'guideline 1: transposed convolutions in the generator (strided convolutions belong in the discriminator; pooling is what they replace)',
    'g.bn': 'guideline 2: Batch Normalization everywhere except the generator\'s output layer',
    'g.hidden': 'guideline 4: ReLU for all generator layers except the output',
    'g.out': 'guideline 4: the generator\'s output layer uses tanh',
    'g.fc': 'guideline 3: remove fully connected hidden layers for deeper architectures',
    'd.sample': 'guideline 1: strided convolutions in the discriminator (transposed convolutions belong in the generator)',
    'd.bn': 'guideline 2: Batch Normalization everywhere except the discriminator\'s input layer (slide 29\'s discriminator in fact has none)',
    'd.act': 'guideline 5: leaky ReLU in the discriminator for all layers',
    'd.fc': 'guideline 3: remove fully connected hidden layers for deeper architectures',
  },
};

/* ── level 3: slide 29's code and where it departs from slide 28 ───────── */
export const DCGAN = {
  src: { lecture: 6, slides: [29] },
  gen: {
    head: 'generator = tf.keras.Sequential([',
    lines: [
      { id: 'dense', code: 'tf.keras.layers.Dense(7 * 7 * 128),' },
      { id: 'reshape', code: 'tf.keras.layers.Reshape([7, 7, 128]),' },
      { id: 'bn1', code: 'tf.keras.layers.BatchNormalization(),', pos: 'after the Reshape' },
      { id: 'convT64', code: 'tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,\n                                padding="same", activation="relu"),' },
      { id: 'bn2', code: 'tf.keras.layers.BatchNormalization(),', pos: 'after Conv2DTranspose(64)' },
      { id: 'convT1', code: 'tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,\n                                padding="same", activation="tanh"),' },
    ],
  },
  disc: {
    head: 'discriminator = tf.keras.Sequential([',
    lines: [
      { id: 'conv64', code: 'tf.keras.layers.Conv2D(64, kernel_size=5, strides=2, padding="same",\n                       activation=tf.keras.layers.LeakyReLU(0.2)),' },
      { id: 'drop1', code: 'tf.keras.layers.Dropout(0.4),' },
      { id: 'conv128', code: 'tf.keras.layers.Conv2D(128, kernel_size=5, strides=2, padding="same",\n                       activation=tf.keras.layers.LeakyReLU(0.2)),' },
      { id: 'drop2', code: 'tf.keras.layers.Dropout(0.4),' },
      { id: 'flatten', code: 'tf.keras.layers.Flatten(),' },
      { id: 'dense1', code: 'tf.keras.layers.Dense(1, activation="sigmoid")' },
    ],
  },
};

export const SPOT = [
  { id: 's.g4', net: 'gen', candidates: ['dense', 'convT64', 'convT1'], answer: 'dense', concept: 'dcgan.vsGuidelines', src: { lecture: 6, slides: [28, 29] },
    prompt: 'Guideline 4: ReLU in the generator for all layers except the output layer (tanh). Which of the lit lines breaks it?',
    why: 'Dense(7 * 7 * 128) has no activation argument, so it is linear, not ReLU; the two Conv2DTranspose layers do follow guideline 4 (relu, then tanh at the output). Slide 29 vs slide 28.' },
  { id: 's.g5', net: 'disc', candidates: ['conv64', 'conv128', 'dense1'], answer: 'dense1', concept: 'dcgan.vsGuidelines', src: { lecture: 6, slides: [28, 29] },
    prompt: 'Guideline 5: leaky ReLU in the discriminator for all layers. Which of the lit lines breaks it?',
    why: 'The final Dense(1, activation="sigmoid") uses sigmoid; both Conv2D layers use LeakyReLU(0.2) as guideline 5 asks. Slide 29 vs slide 28.' },
  { id: 's.g3', net: 'gen', candidates: ['dense', 'reshape', 'convT64', 'convT1'], answer: 'dense', concept: 'dcgan.vsGuidelines', src: { lecture: 6, slides: [28, 29] },
    prompt: 'Guideline 3: remove fully connected hidden layers for deeper architectures. Which lit generator line is still fully connected?',
    why: 'Dense(7 * 7 * 128) is a fully connected layer: its 7 * 7 * 128 = 6272 outputs are reshaped to [7, 7, 128] (slide 29). Slide 28\'s guideline 3 says remove fully connected hidden layers "for deeper architectures".' },
  { id: 's.g2', net: 'gen', candidates: ['bn1', 'convT64', 'bn2', 'convT1'], answer: 'convT1', concept: 'bn.dcgan', src: { lecture: 6, slides: [28, 29] },
    prompt: 'Guideline 2 keeps Batch Normalization out of the generator’s output layer. Which lit line is that output layer?',
    why: 'The output layer is Conv2DTranspose(1, kernel_size=5, strides=2, padding="same", activation="tanh"), and no BatchNormalization follows it — slide 29 follows guideline 2 here (slide 28).' },
];

/* ── level 3: arithmetic from the slides' code ─────────────────────────── */
export const NUMBERS = {
  batches: [32, 32, 32, 16, 64, 128],   // 32 is slide 24's batch_size; the others re-run the same code
  rows: { concept: 'gan.phase1', src: { lecture: 6, slides: [24, 25] },
    prompt: 'batch_size = %b%. How many rows does X_fake_and_real have?',
    code: ['X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)', 'y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)'],
    why: 'tf.concat stacks batch_size = %b% generated images on top of the %b% real images of X_batch (axis=0; slide 24 batches the dataset with drop_remainder=True), and y1 holds one label per row: $%b% + %b% = %ans%$ (slide 25).' },
  zeros: { concept: 'gan.phase1', src: { lecture: 6, slides: [21, 25] },
    prompt: 'batch_size = %b%. How many of y1’s labels are 0?',
    code: ['y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)'],
    why: 'y1 = [[0.]] * batch_size + [[1.]] * batch_size: %b% zeros (the fakes, slide 21 labels them 0) then %b% ones (the real images) (slide 25).' },
  y2: { concept: 'gan.phase2', src: { lecture: 6, slides: [22, 25] },
    prompt: 'batch_size = %b%. How many labels does y2 hold?',
    code: ['y2 = tf.constant([[1.]] * batch_size)'],
    why: 'Phase 2 adds no real images and sets every label to 1 (slide 22): y2 = [[1.]] * batch_size holds %b% ones (slide 25).' },
  dense: { concept: 'dcgan.keras', src: { lecture: 6, slides: [29] },
    prompt: 'How many units does the DCGAN generator’s first layer have?',
    code: ['tf.keras.layers.Dense(7 * 7 * 128),', 'tf.keras.layers.Reshape([7, 7, 128]),'],
    answer: 6272,
    why: 'Dense(7 * 7 * 128): $7 \\times 7 \\times 128 = 6272$ units, reshaped to [7, 7, 128] (slide 29).' },
  noise: [
    { id: 'gan', concept: 'gan.trainLoop', src: { lecture: 6, slides: [23, 25] }, codings: 30, model: 'GAN',
      prompt: 'batch_size = %b%. What shape is noise in slide 25’s loop for the GAN (codings_size = 30)?',
      why: 'noise = tf.random.normal(shape=[batch_size, codings_size]) with codings_size = 30 (slide 23): [%b%, 30], one 30-number coding per fake (slide 25).' },
    { id: 'dcgan', concept: 'dcgan.keras', src: { lecture: 6, slides: [29, 25] }, codings: 100, model: 'DCGAN',
      prompt: 'batch_size = %b%. What shape is noise for the DCGAN (codings_size = 100)?',
      why: 'Slide 29 sets codings_size = 100 and says training is "similar to the code for GANs": noise = tf.random.normal(shape=[batch_size, codings_size]) is [%b%, 100] (slide 25).' },
  ],
  noiseCode: 'noise = tf.random.normal(shape=[batch_size, codings_size])',
};
