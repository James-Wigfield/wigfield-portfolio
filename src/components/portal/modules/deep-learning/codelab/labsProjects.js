/* ============================================================================
   CODE LAB — THE LABS & PROJECTS PANELS (tab 1)
   ----------------------------------------------------------------------------
   One compact panel per lab sheet and project: the goal (≤ 30 words), the
   data's shapes, the model(s) one line each, and the result — for the labs
   the target the sheet states, for the projects my numbers verbatim from my
   notebook's saved outputs ({ q, nb } = a quoted output line, checked
   against the notebook by tools/dl-codelab/check-cards.mjs) — followed by
   its key-code cards (cards/labs.js, listed by id in `cards`). `see` points
   at a card in another tab that carries a lab's code.
   ========================================================================== */

export const LAB_PANELS = [
  {
    id: 'lp-lab2',
    title: 'Lab 2 · Keras MLPs, reusing layers, and the learning-rate search',
    sources: ['Lab Sheet 2', 'Géron Ch 10–11'],
    goal: 'Practise Topics 1–2 in code: reuse model A’s layers for task B (Géron Ch 11), then train an MNIST MLP to over 98% after an exponential learning-rate search.',
    note: 'Task 1 continues Lab Sheet 1’s TensorFlow Playground: the spiral needs about 4 hidden layers of 8 and stalls on plateaus, the vanishing-gradients problem.',
    data: [
      'Task 2: Fashion MNIST split into task A (8 classes) and task B (pullover vs T-shirt/top, 200 training images)',
      'Task 3: MNIST, `X_train` (55000, 28, 28), `X_valid` (5000, 28, 28), `X_test` (10000, 28, 28)',
    ],
    models: [
      'Task 2: `model_B_on_A` = model A’s layers minus its output + Dense(1, sigmoid); freeze, train, unfreeze, recompile',
      'Task 3: Flatten → Dense 300 → Dense 100 → Dense 10 softmax, after the learning-rate search',
    ],
    resultKind: 'target',
    result: ['Task 3: “See if you can get over 98% accuracy”'],
    cards: ['lab2-lr-search'],
    see: [{ to: 'transfer-b-on-a', text: 'Task 2’s reuse-freeze-recompile code (L2 s31)' }],
  },
  {
    id: 'lp-lab3',
    title: 'Lab 3 · MLPs on tabular data: wine class and wine quality',
    sources: ['Lab Sheet 3', 'L2'],
    goal: 'Train MLPs on two UCI wine datasets: a 3-class classifier, then a quality regressor whose tanh output is rescaled to the 3…9 score range.',
    data: [
      'Task 1: `wine.data`, 13 attributes + a class ID (1, 2 or 3) per row; 80/20 split → X (n, 13), y (n,)',
      'Task 2: `winequality-white.csv` (separator ";"), 11 features + quality 3…9; 80/20 split',
    ],
    models: [
      'Task 1: model1 = 3 × Dense(5, GELU) → Dense(3, softmax); model2 adds a 4th hidden layer; model3 adds `class_weight`',
      'Task 2: 8 × Dense(5, ReLU) → Dense(1), loss "mse", metric "mae"; then 4 ReLU + 4 tanh → Dense(1, tanh) → `Rescaling(scale=3, offset=6)`, which maps tanh’s (−1, 1) onto 3…9 (scale and offset derived; the sheet gives none)',
    ],
    resultKind: 'target',
    result: ['Task 1: “you should be able to get a validation accuracy above 90%”', 'Task 2: the tanh + Rescaling model should “perform better than the previous model”'],
    cards: ['lab3-wine'],
  },
  {
    id: 'lp-lab4',
    title: 'Lab 4 · Noisy squares with a simple RNN',
    sources: ['Lab Sheet 4', 'L4'],
    goal: 'Train small RNNs on 4-vertex noisy squares: classify each sequence as clockwise or anti-clockwise, then predict the 4th vertex from the first three.',
    data: [
      '`X_train` (200, 4, 2), `y_train` (200,); `X_val` (60, 4, 2), `y_val` (60,): squares × vertices × (x, y); 1 = clockwise',
      'Task 3: input `X_train[:, :3, :]` (200, 3, 2) → output `X_train[:, 3, :]` (200, 2)',
    ],
    models: ['Task 2: SimpleRNN, about 16 units → 1 sigmoid output', 'Task 3: SimpleRNN, about 16 units → 2 linear outputs'],
    resultKind: 'target',
    result: ['Task 2: “You should be able to achieve 100% validation accuracy easily.”'],
    cards: ['lab4-clockwise', 'lab4-next-vertex'],
  },
  {
    id: 'lp-p1',
    title: 'Project 1 · A tuned CNN vs a retrained NASNetMobile',
    sources: ['Project 1', 'L2', 'L3'],
    goal: 'Classify 64 × 64 images of 10 animals two ways, a Bayesian-tuned CNN under 30,000 parameters and a frozen NASNetMobile with a new head, then compare them.',
    data: [
      { q: 'train X(3700, 64, 64, 3) uint8  y(3700,) uint8  classes per split: [370 370 370 370 370 370 370 370 370 370]', nb: 'p1' },
      'valid (800, 64, 64, 3), test (500, 64, 64, 3); stored in class order, so the training set is shuffled',
    ],
    models: [
      'CNN: 4 × (Conv 3×3 + MaxPool) → GAP → Dropout → Dense → softmax 10; tuned over filters, dropout and Dense units (15 BayesianOptimization trials, 120 epochs, early stopping)',
      'NASNetMobile (ImageNet, frozen) at 224 × 224 → GAP → Dense(64) → Dense(10)',
    ],
    resultKind: 'notebook',
    result: [
      { q: 'CNN: 16,570 trainable parameters, test accuracy 0.620', nb: 'p1' },
      { q: 'NASNetMobile  trainable parameters:     68,298  (frozen base excluded)', nb: 'p1' },
      { q: 'Overall test accuracy - CNN: 0.620   NASNetMobile: 0.860', nb: 'p1' },
      { q: 'Total tuning time: 48.6 minutes', nb: 'p1' },
      { q: 'NASNetMobile training time: 2.2 minutes (17 epochs)', nb: 'p1' },
    ],
    cards: ['p1-cnn', 'p1-nasnet'],
  },
  {
    id: 'lp-p2',
    title: 'Project 2 · Perth temperatures: three GRU forecasters and a VAE',
    sources: ['Project 2', 'L4', 'L6–7', 'L8'],
    goal: 'Forecast Perth’s monthly mean min and max temperatures 12 months ahead with three GRU models, compare them over longer horizons, then synthesise max-temperature sequences with a VAE.',
    data: [
      { q: '(1522, 84, 2) (313, 84, 2) (297, 96, 2)', nb: 'p2' },
      { q: 'train X (1522, 72, 2)  y (1522, 12, 2)', nb: 'p2' },
      'channel 0 = monthly mean minimum, 1 = maximum; the VAE uses the max channel, (1522, 84)',
    ],
    models: [
      'Model 1: GRU 16 (sequences) → GRU 16 → Dense 24 → Reshape (12, 2)',
      'Model 2: the same with Dense 2, rolled out 12 times in a for loop',
      'Model 3: two-layer GRU encoder–decoder, each encoder state starting its decoder layer',
      'VAE: Conv1D encoder to 4 codings, Conv1DTranspose decoder, KL term in the Sampling layer',
    ],
    resultKind: 'notebook',
    result: [
      { q: 'Model 1 test MAE (12 months): 1.250 deg C', nb: 'p2' },
      { q: 'Model 2 test MAE (12 months, recursive): 1.407 deg C', nb: 'p2' },
      { q: 'Model 3 test MAE (12 months, decoder fed its own predictions): 1.321 deg C', nb: 'p2' },
      { q: 'horizon 24: model 2 1.470, model 3 1.457, seasonal naive 1.234, climatology 0.957 deg C', nb: 'p2' },
      { q: 'validation reconstruction MAE: 0.940 deg C', nb: 'p2' },
    ],
    cards: ['p2-gru', 'p2-encdec', 'p2-vae'],
  },
];
