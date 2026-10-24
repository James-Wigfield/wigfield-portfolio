/* ============================================================================
   DESCENT — CONTENT (pure data, slide-cited; Lecture 2 only)
   ----------------------------------------------------------------------------
   CLUBS      the six clubs: label, the slide's name, the EQUATIONS key in
              content/lecture2.js, the concept they drill, the defaults
   HOLES      the hole kinds: name, one line, slides
   WINS       why a club makes par on a kind, in the slides' words
              (key `${kind}.${club}`)
   STATUS     the scorecard words for a swing's outcome (simulation facts)
   DIAL       the learning-rate dial items (slide 48)
   EQ         equation and fact items per level (choices may carry KaTeX)
   CLIP       the cliff: gradient clipping (slide 29)
   SCHED      the learning-rate schedule power-ups (slides 50–59)
   The maths is in maths/descent.js (optimisers, schedules) and
   maths/descentHoles.js (surfaces); the round is built by
   maths/descentItems.js.
   ========================================================================== */

const L2 = (...slides) => ({ lecture: 2, slides });

export const INTRO = {
  line: 'Read the hole, call the club that makes par, then swing.',
  controls: [
    'Pick a club (keys 1–6), then Swing (Enter or Space). Your call is the answer.',
    'Every club swings with the same η (the dial) and the slides’ defaults: β = 0.9, ρ = 0.9, β₁ = 0.9, β₂ = 0.999; ε = 10⁻¹⁰ is AdaGrad’s value (slide 38), reused for RMSProp and Adam.',
    'Par = the fewest steps until the ball stays in the cup, among the clubs in this hole’s bag.',
  ],
};

export const LEVEL_NAMES = ['GD · momentum · AdaGrad', '+ NAG · RMSProp', '+ Adam · clipping · schedules'];

export const PAR_RULE = {
  text: 'Par is computed by swinging every club in the bag on this hole: the club whose ball stays in the cup after the fewest steps makes par (a clear winner, at least 20% fewer steps than the next club).',
  short: 'par = fewest steps until the ball stays in the cup',
};

export const CLUBS = {
  sgd: {
    label: 'SGD',
    name: 'Gradient Descent',
    eq: 'gd',
    concept: 'optim.gd',
    hp: '',
    src: L2(34, 35),
  },
  momentum: {
    label: 'Momentum',
    name: 'Momentum optimization',
    eq: 'momentum',
    concept: 'optim.momentum',
    hp: 'β = 0.9',
    src: L2(34, 35),
  },
  nag: {
    label: 'NAG',
    name: 'Nesterov Accelerated Gradient',
    eq: 'nag',
    concept: 'optim.nag',
    hp: 'β = 0.9',
    src: L2(36, 37),
  },
  adagrad: {
    label: 'AdaGrad',
    name: 'AdaGrad',
    eq: 'adagrad',
    concept: 'optim.adagrad',
    hp: 'ε = 10⁻¹⁰',
    src: L2(38, 39, 40),
  },
  rmsprop: {
    label: 'RMSProp',
    name: 'RMSProp',
    eq: 'rmsprop',
    concept: 'optim.rmsprop',
    hp: 'ρ = 0.9',
    src: L2(41, 42),
  },
  adam: {
    label: 'Adam',
    name: 'Adam (adaptive moment estimation)',
    eq: 'adam',
    concept: 'optim.adam',
    hp: 'β₁ = 0.9, β₂ = 0.999',
    src: L2(43, 44),
  },
};

/* the defaults the clubs swing with, and where each is stated */
export const DEFAULTS_NOTE = [
  { sym: '\\beta = 0.9', text: 'momentum and NAG: β < 1, usually set to 0.9', src: L2(34) },
  { sym: '\\rho = 0.9', text: 'RMSProp: the decay rate ρ is typically set to 0.9', src: L2(41) },
  { sym: '\\beta_1 = 0.9,\\ \\beta_2 = 0.999', text: 'Adam: β₁ typically 0.9, β₂ often 0.999', src: L2(44) },
  { sym: '\\epsilon = 10^{-10}', text: 'ε is a small number, usually 10⁻¹⁰ (slide 38, the only ε value in the deck; slides 41 and 43 give none, so RMSProp and Adam use the same)', src: L2(38, 41, 43) },
];

export const HOLES = {
  bowl: {
    name: 'Elongated bowl',
    line: 'Steep across, gentle along: the elongated bowl.',
    axes: ['θ₁ (flatter dimension)', 'θ₂ (steep dimension)'],
    src: L2(38, 39),
  },
  flats: {
    name: 'The flats',
    line: 'The local gradient is tiny all the way to the flag.',
    src: L2(34),
  },
  dimple: {
    name: 'The dimple',
    line: 'A local optimum sits on the way to the flag.',
    src: L2(34),
  },
  narrow: {
    name: 'Narrow valley',
    line: 'A tight valley and a big η: stop at the flag, don’t fly past it.',
    src: L2(36, 37),
  },
  valley: {
    name: 'Long valley',
    line: 'A long valley floor, and the flag is far away.',
    src: L2(38, 40, 41),
  },
};

/* why a club makes par on a kind (the why card; `$…$` is KaTeX) */
export const WINS = {
  'bowl.adagrad': {
    why: 'Gradient descent goes quickly down the steepest slope, then very slowly along the bottom of the valley. AdaGrad scales the gradient down along the steepest dimensions, $\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta) \\oslash \\sqrt{\\mathbf{s} + \\epsilon}$, so it points more toward the global minimum; it frequently performs well on simple quadratic problems like this bowl.',
    src: L2(38, 39, 40),
  },
  'flats.momentum': {
    why: 'The local gradient is tiny, so gradient descent goes very slowly. Momentum uses the gradient as an acceleration term rather than a speed term: $\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta)$ keeps adding up while the slope points the same way.',
    src: L2(34),
  },
  'flats.adam': {
    why: 'The local gradient is tiny: gradient descent goes very slowly, and AdaGrad’s ever-growing $\\mathbf{s}$ scales its steps down until it stops too early. Adam combines the ideas of momentum optimization and RMSProp: its step 1, $\\mathbf{m} \\leftarrow \\beta_1 \\mathbf{m} + (1 - \\beta_1) \\nabla_\\theta J(\\theta)$, is momentum’s idea, and it is an adaptive learning rate algorithm, like AdaGrad and RMSProp.',
    src: L2(34, 40, 43, 44),
  },
  'dimple.momentum': {
    why: 'Gradient descent does not care what the earlier gradients were, so it settles where the local gradient is zero: the dimple. Momentum keeps the earlier gradients in $\\mathbf{m}$ and can help roll past local optima.',
    src: L2(34),
  },
  'dimple.adam': {
    why: 'Adam is the only club in this bag with momentum: its step 1, $\\mathbf{m} \\leftarrow \\beta_1 \\mathbf{m} + (1 - \\beta_1) \\nabla_\\theta J(\\theta)$, is momentum’s idea ($\\beta_1$ corresponds to β), and momentum can help roll past local optima.',
    src: L2(34, 43, 44),
  },
  'narrow.nag': {
    why: 'NAG measures the gradient not at θ but slightly ahead in the direction of the momentum, $\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta + \\beta \\mathbf{m})$. The momentum vector generally points toward the optimum, so each update ends up slightly closer to it (Figure 11-7): on this hole NAG swings past the flag less than momentum does, and settles in the cup sooner.',
    src: L2(36, 37),
  },
  'valley.rmsprop': {
    why: 'AdaGrad’s $\\mathbf{s}$ accumulates every squared gradient, so on a long course its learning rate gets scaled down so much that it stalls before the flag: it stops too early. RMSProp accumulates only the most recent iterations, $\\mathbf{s} \\leftarrow \\rho \\mathbf{s} + (1 - \\rho) \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)$ with ρ = 0.9, which overcomes AdaGrad’s slowing down.',
    src: L2(40, 41),
  },
  'valley.sgd': {
    why: 'AdaGrad’s $\\mathbf{s}$ only grows, so its learning rate gets scaled down so much that it stalls before the flag on a long course: it often stops too early. Plain gradient descent keeps the same η, so the steady slope of the valley floor carries it all the way.',
    src: L2(34, 40),
  },
  // the six-club bowl: slides 38–40 and 42 compare AdaGrad with GD and RMSProp; Table 11-2
  // (slide 47) rates convergence speed, but no slide says AdaGrad beats the others on a bowl
  'bowl.adagrad.six': {
    why: 'Gradient descent goes quickly down the steepest slope, then very slowly along the bottom of the valley. AdaGrad scales the gradient down along the steepest dimensions, $\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta) \\oslash \\sqrt{\\mathbf{s} + \\epsilon}$, so it points more toward the global minimum; it frequently performs well on simple quadratic problems like this bowl. Table 11-2 (slide 47) rates AdaGrad’s convergence speed ★★★, above momentum and NAG (★★) and level with RMSProp and Adam; that it holes first here is this scorecard’s result, not a slide claim.',
    src: L2(38, 39, 40, 42, 47),
    beyond: true,
    note: 'Table 11-2 (slide 47) rates convergence speed only: SGD ★, momentum and NAG ★★, AdaGrad, RMSProp and Adam ★★★. It ranks AdaGrad above momentum and NAG and level with Adam, but no slide says AdaGrad beats them on a bowl; the par club here is decided by the hole’s simulation.',
  },
  'bowl.adagrad.vsRms': {
    why: 'RMSProp almost always performs much better than AdaGrad, except on very simple problems, and this elongated bowl is one: AdaGrad scales the gradient down along the steep dimension and its decaying learning rate settles it in the cup, as on simple quadratic problems.',
    src: L2(39, 40, 42),
  },
};

/* the scorecard words for a swing (facts about the simulation, not slides) */
export const STATUS = {
  holed: 'holed in',
  stalled: 'crawling, short of the flag',
  stuck: 'settled in the local optimum',
  moving: 'not in the cup to stay',
  diverged: 'flew off the course',
  par: 'par',
  you: 'you',
  ofSteps: 'steps',
};

/* ── the learning-rate dial (slide 48) ─────────────────────────────────── */
export const DIAL = {
  concept: 'sched.why',
  src: L2(48),
  prompt: 'SGD swung at the dial’s η. Which way do you turn the dial?',
  choices: [
    { value: 'down', label: 'Turn η down', sub: 'too high' },
    { value: 'up', label: 'Turn η up', sub: 'too low' },
  ],
  why: {
    down: 'If you set the learning rate too high, training may diverge: each step overshoots further than the last.',
    up: 'If you set the learning rate too low, training will eventually converge to the optimum, but it will take a very long time.',
  },
  trail: { down: 'η too high: diverges', up: 'η too small: slow' },
};

/* ── equation and fact items (choice; a choice may carry `tex`) ────────── */
const T = {
  gd: '\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta)',
  mom: '\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta);\\ \\ \\theta \\leftarrow \\theta + \\mathbf{m}',
  nag: '\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta + \\beta \\mathbf{m});\\ \\ \\theta \\leftarrow \\theta + \\mathbf{m}',
  sAda: '\\mathbf{s} \\leftarrow \\mathbf{s} + \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)',
  sRms: '\\mathbf{s} \\leftarrow \\rho \\mathbf{s} + (1 - \\rho) \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)',
  sAdam: '\\mathbf{s} \\leftarrow \\beta_2 \\mathbf{s} + (1 - \\beta_2) \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)',
  sMax: '\\mathbf{s} \\leftarrow \\max(\\beta_2 \\mathbf{s}, \\text{abs}(\\nabla_\\theta J(\\theta)))',
};

export const EQ = [
  /* level 1: gradient descent and momentum */
  {
    id: 'eq.gd.rule', level: 1, concept: 'optim.gd', src: L2(34),
    prompt: 'Which is the Gradient Descent update?',
    choices: [
      { value: 'a', label: 'θ ← θ − η∇θJ(θ)', tex: T.gd },
      { value: 'b', label: 'θ ← θ + η∇θJ(θ)', tex: '\\theta \\leftarrow \\theta + \\eta \\nabla_\\theta J(\\theta)' },
      { value: 'c', label: 'θ ← θ − ηJ(θ)', tex: '\\theta \\leftarrow \\theta - \\eta J(\\theta)' },
      { value: 'd', label: 'θ ← θ − ∇θJ(θ)/η', tex: '\\theta \\leftarrow \\theta - \\nabla_\\theta J(\\theta) / \\eta' },
    ],
    answer: 'a',
    why: 'Gradient Descent steps against the gradient of the loss, scaled by the learning rate: $\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta)$.',
  },
  {
    id: 'eq.momentum.which', level: 1, concept: 'optim.momentum', src: L2(34),
    prompt: 'Which club updates by $\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta)$, then $\\theta \\leftarrow \\theta + \\mathbf{m}$?',
    plain: 'Which club updates by m ← βm − η∇θJ(θ), then θ ← θ + m?',
    choices: [
      { value: 'sgd', label: 'SGD' }, { value: 'momentum', label: 'Momentum' }, { value: 'nag', label: 'NAG' }, { value: 'adagrad', label: 'AdaGrad' },
    ],
    answer: 'momentum',
    why: 'Momentum optimization keeps a momentum vector $\\mathbf{m}$ and updates the weights using only $\\mathbf{m}$; NAG would measure the gradient at $\\theta + \\beta \\mathbf{m}$ instead.',
  },
  {
    id: 'eq.momentum.beta', level: 1, concept: 'optim.momentum', src: L2(34, 35),
    prompt: 'Momentum’s new hyperparameter β < 1 is usually set to…',
    choices: [{ value: '0.9', label: '0.9' }, { value: '0.999', label: '0.999' }, { value: '0.1', label: '0.1' }, { value: '0.5', label: '0.5' }],
    answer: '0.9',
    why: 'β < 1, usually set to 0.9; the momentum value of 0.9 usually works well in practice.',
  },
  {
    id: 'eq.momentum.accel', level: 1, concept: 'optim.momentum', src: L2(34),
    prompt: 'In momentum optimization, the gradient is used as…',
    choices: [{ value: 'accel', label: 'an acceleration term' }, { value: 'speed', label: 'a speed term' }, { value: 'decay', label: 'the decay rate' }],
    answer: 'accel',
    why: 'The gradient is used as an acceleration term rather than a speed term of the update: $\\mathbf{m}$ carries the past momentum and $\\theta \\leftarrow \\theta + \\mathbf{m}$.',
  },
  {
    id: 'eq.gd.memoryless', level: 1, concept: 'optim.gd', src: L2(34),
    prompt: 'Which club does not care what the earlier gradients were, and goes very slowly where the local gradient is tiny?',
    choices: [{ value: 'sgd', label: 'SGD' }, { value: 'momentum', label: 'Momentum' }, { value: 'adagrad', label: 'AdaGrad' }],
    answer: 'sgd',
    why: 'Gradient Descent, $\\theta \\leftarrow \\theta - \\eta \\nabla_\\theta J(\\theta)$, does not care about what the earlier gradients were. If the local gradient is tiny, it goes very slowly.',
  },
  {
    id: 'eq.table.speed', level: 1, concept: 'optim.summary', src: L2(47),
    prompt: 'Table 11-2: which has the slowest convergence speed (one star)?',
    choices: [{ value: 'sgd', label: 'SGD' }, { value: 'momentum', label: 'SGD(momentum=...)' }, { value: 'rmsprop', label: 'RMSprop' }, { value: 'adam', label: 'Adam' }],
    answer: 'sgd',
    why: 'Table 11-2: SGD has speed * (quality ***); SGD with momentum, with or without nesterov=True, has **; AdaGrad, RMSprop, Adam and its variants have ***.',
  },

  /* level 2: NAG, AdaGrad, RMSProp */
  {
    id: 'eq.nag.where', level: 2, concept: 'optim.nag', src: L2(36),
    prompt: 'NAG measures the gradient of the loss not at θ but at…',
    choices: [
      { value: 'ahead', label: 'θ + βm', tex: '\\theta + \\beta \\mathbf{m}' },
      { value: 'theta', label: 'θ', tex: '\\theta' },
      { value: 'back', label: 'θ − ηm', tex: '\\theta - \\eta \\mathbf{m}' },
      { value: 'm', label: 'βm', tex: '\\beta \\mathbf{m}' },
    ],
    answer: 'ahead',
    why: 'NAG measures the gradient slightly ahead in the direction of the momentum, at $\\theta + \\beta \\mathbf{m}$: $\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta + \\beta \\mathbf{m})$.',
  },
  {
    id: 'eq.nag.which', level: 2, concept: 'optim.nag', src: L2(36),
    prompt: 'Which club updates by $\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta + \\beta \\mathbf{m})$, then $\\theta \\leftarrow \\theta + \\mathbf{m}$?',
    plain: 'Which club updates by m ← βm − η∇θJ(θ + βm), then θ ← θ + m?',
    choices: [{ value: 'momentum', label: 'Momentum' }, { value: 'nag', label: 'NAG' }, { value: 'adam', label: 'Adam' }, { value: 'rmsprop', label: 'RMSProp' }],
    answer: 'nag',
    why: 'Nesterov Accelerated Gradient (Nesterov momentum optimization) is momentum with the gradient measured at $\\theta + \\beta \\mathbf{m}$.',
  },
  {
    id: 'eq.nag.keras', level: 2, concept: 'optim.nag', src: L2(37, 45, 46),
    prompt: 'Which Keras optimizer is NAG?',
    choices: [
      { value: 'a', label: 'SGD(learning_rate=0.001, momentum=0.9, nesterov=True)' },
      { value: 'b', label: 'SGD(learning_rate=0.001, momentum=0.9)' },
      { value: 'c', label: 'Nadam(learning_rate=0.001, beta_1=0.9, beta_2=0.999)' },
    ],
    answer: 'a',
    why: 'To use NAG, add the optional parameter nesterov and set it to True (the default value is False). Nadam is Adam with the Nesterov trick, a different optimizer.',
  },
  {
    id: 'eq.adagrad.s', level: 2, concept: 'optim.adagrad', src: L2(38),
    prompt: 'Which is AdaGrad’s update of s?',
    choices: [
      { value: 'ada', label: 's ← s + ∇θJ(θ) ⊗ ∇θJ(θ)', tex: T.sAda },
      { value: 'rms', label: 's ← ρs + (1 − ρ)∇θJ(θ) ⊗ ∇θJ(θ)', tex: T.sRms },
      { value: 'adam', label: 's ← β₂s + (1 − β₂)∇θJ(θ) ⊗ ∇θJ(θ)', tex: T.sAdam },
      { value: 'max', label: 's ← max(β₂s, abs(∇θJ(θ)))', tex: T.sMax },
    ],
    answer: 'ada',
    why: 'In AdaGrad, $\\mathbf{s}$ accumulates the magnitudes of the error gradients: $\\mathbf{s} \\leftarrow \\mathbf{s} + \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)$, with nothing ever decaying.',
  },
  {
    id: 'eq.adagrad.eps', level: 2, concept: 'optim.adagrad', src: L2(38),
    prompt: 'In $\\sqrt{\\mathbf{s} + \\epsilon}$, ε is a small number, usually…',
    plain: 'In √(s + ε), ε is a small number, usually…',
    choices: [{ value: '1e-10', label: '10⁻¹⁰', tex: '10^{-10}' }, { value: '0.001', label: '0.001' }, { value: '0.9', label: '0.9' }, { value: '0.999', label: '0.999' }],
    answer: '1e-10',
    why: 'ε is a small number (usually $10^{-10}$) used to avoid division by zero.',
  },
  {
    id: 'eq.adagrad.oslash', level: 2, concept: 'optim.adagrad', src: L2(38),
    prompt: 'In $\\eta \\nabla_\\theta J(\\theta) \\oslash \\sqrt{\\mathbf{s} + \\epsilon}$, the symbol ⊘ means…',
    plain: 'In η∇θJ(θ) ⊘ √(s + ε), the symbol ⊘ means…',
    choices: [{ value: 'div', label: 'element-wise division' }, { value: 'mul', label: 'element-wise multiplication' }, { value: 'dot', label: 'a dot product' }],
    answer: 'div',
    why: '⊗ and ⊘ denote element-wise multiplication and element-wise division: each dimension gets its own scaling.',
  },
  {
    id: 'eq.adagrad.dnn', level: 2, concept: 'optim.adagrad', src: L2(40, 47),
    prompt: 'Which optimizer often stops too early when training neural networks, so you should not use it for deep nets?',
    choices: [{ value: 'adagrad', label: 'AdaGrad' }, { value: 'rmsprop', label: 'RMSProp' }, { value: 'nag', label: 'NAG' }, { value: 'adam', label: 'Adam' }],
    answer: 'adagrad',
    why: 'AdaGrad’s learning rate gets scaled down so much that it stops entirely before reaching the global optimum (Table 11-2: quality *, stops too early). It may still be efficient for simpler tasks such as linear regression.',
  },
  {
    id: 'eq.rmsprop.rho', level: 2, concept: 'optim.rmsprop', src: L2(41, 42),
    prompt: 'RMSProp’s decay rate ρ is typically set to…',
    choices: [{ value: '0.9', label: '0.9' }, { value: '0.999', label: '0.999' }, { value: '0.1', label: '0.1' }, { value: '1e-10', label: '10⁻¹⁰', tex: '10^{-10}' }],
    answer: '0.9',
    why: 'The decay rate ρ is typically set to 0.9, which has been shown to work well, so you may not need to tune it: RMSprop(learning_rate=0.001, rho=0.9).',
  },
  {
    id: 'eq.rmsprop.recent', level: 2, concept: 'optim.rmsprop', src: L2(41),
    prompt: 'Which club’s s accumulates the gradient magnitudes from the most recent iterations only?',
    choices: [{ value: 'adagrad', label: 'AdaGrad' }, { value: 'rmsprop', label: 'RMSProp' }, { value: 'momentum', label: 'Momentum' }],
    answer: 'rmsprop',
    why: 'RMSProp overcomes AdaGrad’s slowing down too fast: $\\mathbf{s} \\leftarrow \\rho \\mathbf{s} + (1 - \\rho) \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)$ lets old gradients decay away.',
  },

  /* level 3: Adam and its variants */
  {
    id: 'eq.adam.step3', level: 3, concept: 'optim.adam', src: L2(43),
    prompt: 'Adam’s step 3 is…',
    choices: [
      { value: 'a', label: 'm̂ ← m/(1 − β₁ᵗ)', tex: '\\hat{\\mathbf{m}} \\leftarrow \\mathbf{m} / (1 - \\beta_1^{\\,t})' },
      { value: 'b', label: 'm̂ ← m/(1 − β₁)', tex: '\\hat{\\mathbf{m}} \\leftarrow \\mathbf{m} / (1 - \\beta_1)' },
      { value: 'c', label: 'm̂ ← m/(1 − β₂ᵗ)', tex: '\\hat{\\mathbf{m}} \\leftarrow \\mathbf{m} / (1 - \\beta_2^{\\,t})' },
      { value: 'd', label: 'm̂ ← m(1 − β₁ᵗ)', tex: '\\hat{\\mathbf{m}} \\leftarrow \\mathbf{m} (1 - \\beta_1^{\\,t})' },
    ],
    answer: 'a',
    why: 'Steps 3 and 4, $\\hat{\\mathbf{m}} \\leftarrow \\mathbf{m}/(1 - \\beta_1^{\\,t})$ and $\\hat{\\mathbf{s}} \\leftarrow \\mathbf{s}/(1 - \\beta_2^{\\,t})$, increase the magnitude of m and s, which start at around zero; t is the iteration number.',
  },
  {
    id: 'eq.adam.step1', level: 3, concept: 'optim.adam', src: L2(34, 43),
    prompt: 'Adam’s step 1 is…',
    choices: [
      { value: 'a', label: 'm ← β₁m + (1 − β₁)∇θJ(θ)', tex: '\\mathbf{m} \\leftarrow \\beta_1 \\mathbf{m} + (1 - \\beta_1) \\nabla_\\theta J(\\theta)' },
      { value: 'b', label: 'm ← β₁m − η∇θJ(θ)', tex: '\\mathbf{m} \\leftarrow \\beta_1 \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta)' },
      { value: 'c', label: 'm ← β₁m + (1 − β₁)∇θJ(θ) ⊗ ∇θJ(θ)', tex: '\\mathbf{m} \\leftarrow \\beta_1 \\mathbf{m} + (1 - \\beta_1) \\nabla_\\theta J(\\theta) \\otimes \\nabla_\\theta J(\\theta)' },
    ],
    answer: 'a',
    why: 'Adam’s step 1 adds $(1 - \\beta_1)\\nabla_\\theta J(\\theta)$, a plus sign, and subtracts η only in step 5; momentum writes $\\mathbf{m} \\leftarrow \\beta \\mathbf{m} - \\eta \\nabla_\\theta J(\\theta)$ then $\\theta \\leftarrow \\theta + \\mathbf{m}$. The squared gradient belongs to step 2.',
  },
  {
    id: 'eq.adam.beta2', level: 3, concept: 'optim.adam', src: L2(44),
    prompt: 'Adam’s scaling decay hyperparameter β₂ is often initialized to…',
    choices: [{ value: '0.999', label: '0.999' }, { value: '0.9', label: '0.9' }, { value: '0.001', label: '0.001' }, { value: '0.99', label: '0.99' }],
    answer: '0.999',
    why: 'The momentum decay β₁ is typically initialized to 0.9, while the scaling decay β₂ is often initialized to 0.999: Adam(learning_rate=0.001, beta_1=0.9, beta_2=0.999).',
  },
  {
    id: 'eq.adam.corr', level: 3, concept: 'optim.adam', src: L2(44),
    prompt: 'In Adam, β₁ corresponds to which hyperparameter?',
    choices: [{ value: 'beta', label: 'β in momentum optimization' }, { value: 'rho', label: 'ρ in RMSProp' }, { value: 'eps', label: 'ε in AdaGrad' }],
    answer: 'beta',
    why: 'Adam combines momentum optimization and RMSProp: β₁ corresponds to β in momentum optimization, and β₂ corresponds to ρ in RMSProp.',
  },
  {
    id: 'eq.adam.why34', level: 3, concept: 'optim.adam', src: L2(43),
    prompt: 'Why does Adam have steps 3 and 4 (m̂ and ŝ)?',
    choices: [
      { value: 'zero', label: 'm and s start at around zero, so they boost them' },
      { value: 'clip', label: 'they clip m and s so they never explode' },
      { value: 'decay', label: 'they decay the learning rate over time' },
    ],
    answer: 'zero',
    why: 'Steps 3 and 4 are normalization to help increase the magnitude of m and s, as both vectors are initialized at around zero (so may be a bit small).',
  },
  {
    id: 'eq.adam.eta', level: 3, concept: 'optim.adam', src: L2(44),
    prompt: 'Adam needs less tuning of η: you can often use the default η = …',
    choices: [{ value: '0.001', label: '0.001' }, { value: '0.1', label: '0.1' }, { value: '0.9', label: '0.9' }, { value: '1e-10', label: '10⁻¹⁰', tex: '10^{-10}' }],
    answer: '0.001',
    why: 'Since Adam is an adaptive learning rate algorithm, like AdaGrad and RMSProp, it requires less tuning of η; you can often use the default value η = 0.001.',
  },
  {
    id: 'eq.adamax.step2', level: 3, concept: 'optim.adamax', src: L2(45),
    prompt: 'AdaMax is the same as Adam except that step 2 becomes…',
    choices: [
      { value: 'max', label: 's ← max(β₂s, abs(∇θJ(θ)))', tex: T.sMax },
      { value: 'adam', label: 's ← β₂s + (1 − β₂)∇θJ(θ) ⊗ ∇θJ(θ)', tex: T.sAdam },
      { value: 'ada', label: 's ← s + ∇θJ(θ) ⊗ ∇θJ(θ)', tex: T.sAda },
    ],
    answer: 'max',
    why: 'AdaMax replaces Adam’s step 2 by $\\mathbf{s} \\leftarrow \\max(\\beta_2 \\mathbf{s}, \\text{abs}(\\nabla_\\theta J(\\theta)))$. Its performance seems to depend on the dataset; in general, Adam performs better.',
  },
  {
    id: 'eq.nadam.what', level: 3, concept: 'optim.nadam', src: L2(45),
    prompt: 'Which variant combines Adam optimization with the Nesterov trick?',
    choices: [{ value: 'nadam', label: 'Nadam' }, { value: 'adamax', label: 'AdaMax' }, { value: 'adamw', label: 'AdamW' }],
    answer: 'nadam',
    why: 'Nadam combines Adam with the Nesterov trick; Dozat found it generally outperforms Adam but is sometimes outperformed by RMSProp. (Described, not drilled: the slides print no Nadam equation.)',
  },
  {
    id: 'eq.adamw.what', level: 3, concept: 'optim.adamw', src: L2(45, 46),
    prompt: 'Which variant multiplies the model’s weights by a decay factor such as 0.99 at each training iteration?',
    choices: [{ value: 'adamw', label: 'AdamW' }, { value: 'adamax', label: 'AdaMax' }, { value: 'nadam', label: 'Nadam' }],
    answer: 'adamw',
    why: 'AdamW integrates weight decay into Adam; in Keras, AdamW(weight_decay=1e-5, …), and you may need to fine-tune weight_decay. (Described, not drilled: the slides print no AdamW equation.)',
  },
];

/* ── the cliff: gradient clipping (slide 29) ───────────────────────────── */
export const CLIP = {
  concept: 'clip.gradient',
  src: L2(29),
  hole: { name: 'The cliff', line: 'A wall where the gradient explodes: one raw swing would fly off the course.' },
  labels: { raw: 'no clipping', rawOff: 'no clipping: off the course', taken: 'the swing taken', value: 'clipvalue=1.0', norm: 'clipnorm=1.0', sameDir: 'same direction' },
  orient: {
    prompt: 'Tame the cliff: which setting keeps the gradient vector’s orientation?',
    choices: [{ value: 'clipnorm', label: 'SGD(clipnorm=1.0)' }, { value: 'clipvalue', label: 'SGD(clipvalue=1.0)' }, { value: 'none', label: 'SGD()' }],
    answer: 'clipnorm',
    why: 'clipvalue=1.0 clips every component of the gradient vector to between −1.0 and 1.0, which can change its direction; use clipnorm=1.0 if you want to retain the gradient vector orientation.',
  },
  which: {
    prompt: 'The faint arrow is the raw swing; the bold one is what the optimizer took. Which setting was on?',
    choices: [{ value: 'clipvalue', label: 'SGD(clipvalue=1.0)' }, { value: 'clipnorm', label: 'SGD(clipnorm=1.0)' }],
    why: {
      clipvalue: 'The swing changed direction: every component was clipped to a value between −1.0 and 1.0 on its own, which is clipvalue=1.0. clipnorm=1.0 retains the gradient vector orientation.',
      clipnorm: 'The swing kept its direction: clipnorm=1.0 retains the gradient vector orientation. clipvalue=1.0 clips each component to between −1.0 and 1.0 on its own.',
    },
  },
  value: {
    prompt: 'SGD(clipvalue=1.0): what does this gradient become?',
    why: 'clipvalue=1.0 clips every component of the gradient vector to a value between −1.0 and 1.0, one component at a time; a component already inside that range is left alone.',
  },
  rnn: {
    prompt: 'Gradient clipping is mostly useful for which networks, because BN is tricky to use in them?',
    choices: [{ value: 'rnn', label: 'recurrent neural networks (RNNs)' }, { value: 'cnn', label: 'convolutional neural networks' }, { value: 'mlp', label: 'shallow dense nets' }],
    answer: 'rnn',
    why: 'Clipping the gradients so they never exceed some threshold lessens the exploding gradients problem; it is mostly useful for RNNs, as BN is tricky to use in RNNs.',
  },
};

/* ── learning-rate schedules: the power-ups (slides 48–59) ─────────────── */
export const SCHED = {
  names: {
    power: { label: 'Power scheduling', concept: 'sched.power', src: L2(50, 51) },
    exponential: { label: 'Exponential scheduling', concept: 'sched.exponential', src: L2(52, 53) },
    piecewise: { label: 'Piecewise constant', concept: 'sched.piecewise', src: L2(55, 56) },
    performance: { label: 'Performance scheduling', concept: 'sched.performance', src: L2(57, 58) },
    onecycle: { label: '1cycle', concept: 'sched.onecycle', src: L2(59) },
  },
  power: {
    tex: '\\eta(t) = \\dfrac{\\eta_0}{(1 + rt/s)^c}',
    prompt: 'Power scheduling power-up: what is η at step t?',
    why: 'Power scheduling: $\\eta(t) = \\eta_0 / (1 + rt/s)^c$ with c typically 1. After s steps the learning rate is down to $\\eta_0/(1 + r)$, after 2s steps to $\\eta_0/(1 + 2r)$, and so on.',
  },
  exponential: {
    tex: '\\eta(t) = \\eta_0\\, r^{\\,t/s}',
    prompt: 'Exponential scheduling power-up: what is η at step t?',
    why: 'Exponential scheduling: $\\eta(t) = \\eta_0 r^{t/s}$ drops the learning rate by a factor of r every s steps (r = 0.1, s = 15: $\\eta(15) = 0.1\\,\\eta_0$, $\\eta(30) = 0.01\\,\\eta_0$).',
  },
  piecewise: {
    code: 'PiecewiseConstantDecay(boundaries=[50_000, 80_000], values=[0.01, 0.005, 0.001])',
    boundaries: [50000, 80000],
    values: [0.01, 0.005, 0.001],
    prompt: 'This piecewise constant power-up is on. What is η at step t?',
    why: 'Piecewise constant scheduling uses a constant learning rate for a number of iterations, then a smaller one: here 0.01 until step 50,000, 0.005 until 80,000, then 0.001.',
  },
  performance: {
    code: 'ReduceLROnPlateau(factor=0.5, patience=5)',
    prompt: 'ReduceLROnPlateau(factor=0.5, patience=5) has just cut η once, from 0.010. What is η now?',
    choices: [{ value: '0.005', label: '0.005' }, { value: '0.0025', label: '0.0025' }, { value: '0.01', label: '0.010' }, { value: '0.002', label: '0.002' }],
    answer: '0.005',
    why: 'The callback reduces the learning rate by a factor of 0.5 whenever the best validation loss does not improve for 5 consecutive epochs: slide 58’s run drops from 0.010 to 0.005.',
  },
  shape: {
    prompt: 'Which power-up draws this learning-rate curve?',
    why: {
      piecewise: 'A constant learning rate for a number of iterations, then a smaller one, and so on: piecewise constant scheduling.',
      performance: 'The learning rate is cut by a factor when the validation error stops dropping: performance scheduling (ReduceLROnPlateau). The faint line is the validation loss.',
      onecycle: '1cycle starts by increasing η₀, growing linearly up to η₁ halfway through training, then decreases it linearly back down, finishing the last few epochs by dropping it by several orders of magnitude.',
    },
    legend: { eta: 'learning rate η', loss: 'validation loss', t: 'step / epoch' },
  },
  facts: [
    {
      id: 'sched.onecycle.up', concept: 'sched.onecycle', src: L2(59),
      prompt: 'Contrary to the other schedules, which one starts by increasing the learning rate?',
      choices: [{ value: 'onecycle', label: '1cycle' }, { value: 'performance', label: 'Performance scheduling' }, { value: 'power', label: 'Power scheduling' }, { value: 'piecewise', label: 'Piecewise constant' }],
      answer: 'onecycle',
      why: '1cycle starts by increasing η₀, growing linearly up to η₁ halfway through training, then decreases it linearly back down to η₀ during the second half.',
    },
    {
      id: 'sched.performance.when', concept: 'sched.performance', src: L2(57),
      prompt: 'Which schedule measures the validation error every N steps and reduces η when the error stops dropping?',
      choices: [{ value: 'performance', label: 'Performance scheduling' }, { value: 'exponential', label: 'Exponential scheduling' }, { value: 'onecycle', label: '1cycle' }],
      answer: 'performance',
      why: 'Performance scheduling measures the validation error every N steps (just like for early stopping) and reduces the learning rate by a factor λ when the error stops dropping; Keras: ReduceLROnPlateau.',
    },
    {
      id: 'sched.why.startHigh', concept: 'sched.why', src: L2(48, 49),
      prompt: 'Why schedule η at all?',
      choices: [
        { value: 'high', label: 'start high, then reduce it once progress slows: a good solution faster' },
        { value: 'low', label: 'a constant low η always converges fastest' },
        { value: 'tune', label: 'it removes the need to choose η₀' },
      ],
      answer: 'high',
      why: 'If you start with a large learning rate and then reduce it once training stops making fast progress, you can reach a good solution faster than with the optimal constant learning rate.',
    },
  ],
};
