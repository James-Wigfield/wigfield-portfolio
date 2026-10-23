/* ============================================================================
   SIGNAL KEEPER — CONTENT (pure data, slide-cited; Lecture 2 slides 5–29)
   ----------------------------------------------------------------------------
   Sources: Documents/cits5017/lectures/cits5017-lect02-Training-DNNs.pdf
   (slides 5–29, equation and table slides rendered and read: 6, 7, 8, 11,
   15, 16, 17, 21, 22, 24, 29) and content/lecture2.js (FACTS, QUIRKS).
   Templates use {placeholders} that maths/signalKeeper.js fills in; $…$ is
   KaTeX. Nothing here is a function.

     INTRO, LEVEL_NAMES      the cabinet copy
     ACTS, INITS, TABLE      activations, initialisations, Table 11-1
     SIM                     the stack's labels (the page's own simulation)
     SCENES                  which sick stack each fix starts from
     WHICH_ACT               slide 22's recommendations
     FAN_PAIRS               clean fan_in/fan_out pairs for the keypad items
     SELU                    slide 16's constraints and the distractors
     CURVES, LEAKY           the activation-curve items (slides 10–17)
     BN                      slides 23–28: batches, parameters, placement
     CLIP                    slide 29
     CHOICE_ITEMS            the remaining fact items (choice), per concept
   ========================================================================== */

const L2 = (...slides) => ({ lecture: 2, slides });

export const INTRO = {
  line: 'Keep the signal alive down a 10-layer stack: answer the fix and the layers heal.',
  controls: [
    'Choices: keys 1–4 or tap. Numbers: the keypad (digits, “.” and ±, Enter).',
    'The stack reads bottom (inputs) to top: each layer’s a = f(z) histogram, the spread σ(z) of what it feeds f, and ∂L/∂z relative to the top layer. Healthy layers sit on the centre line.',
    'Checklists: keys 1–6 toggle, Enter locks in. Vectors: Enter or Tab moves to the next slot.',
  ],
};

export const LEVEL_NAMES = ['init · activation', '+ SELU · ELU · leaky ReLU', '+ BatchNorm · clipping'];

/* ── activations (the slides' names) ──────────────────────────────────── */
export const ACTS = {
  none: { label: 'None (linear)', table: 'None', src: L2(8) },
  sigmoid: { label: 'sigmoid', table: 'sigmoid', tex: '\\sigma(z) = \\dfrac{1}{1 + e^{-z}}', src: L2(6, 8) },
  tanh: { label: 'tanh', table: 'tanh', src: L2(8) },
  softmax: { label: 'softmax', table: 'softmax', src: L2(8) },
  relu: { label: 'ReLU', table: 'ReLU', tex: '\\text{ReLU}(z) = \\max(0, z)', src: L2(8, 10) },
  leaky: { label: 'leaky ReLU', table: 'Leaky ReLU', tex: '\\text{LeakyReLU}_\\alpha(z) = \\max(\\alpha z, z)', src: L2(8, 11) },
  elu: { label: 'ELU', table: 'ELU', tex: '\\text{ELU}_\\alpha(z) = \\begin{cases} \\alpha(\\exp(z) - 1) & \\text{if } z < 0 \\\\ z & \\text{if } z \\ge 0 \\end{cases}', src: L2(8, 15) },
  selu: { label: 'SELU', table: 'SELU', tex: '\\text{SELU}(z) = s\\,\\text{ELU}_{1.6733}(z),\\ s = 1.0507', src: L2(8, 16) },
  gelu: { label: 'GELU', table: 'GELU', tex: '\\text{GELU}(z) = z\\,\\Phi(z)', src: L2(8, 18) },
  silu: { label: 'Swish (SiLU)', table: 'Swish', tex: '\\text{SiLU}(z) = z\\,\\sigma(z)', src: L2(8, 19) },
  mish: { label: 'Mish', table: 'Mish', tex: '\\text{Mish}(z) = z \\tanh(\\text{softplus}(z))', src: L2(8, 20) },
};

/* ── initialisations: slide 6 (the old technique), slide 7 (Glorot), slide 8 (Table 11-1), slide 9 (Keras default) ── */
export const INITS = {
  glorot: { label: 'Glorot', sub: 'σ² = 1/fan_avg', tex: '\\sigma^2 = \\dfrac{1}{\\text{fan}_{\\text{avg}}}', inline: '\\sigma^2 = 1/\\text{fan}_{\\text{avg}}', src: L2(7, 8) },
  he: { label: 'He', sub: 'σ² = 2/fan_in', tex: '\\sigma^2 = \\dfrac{2}{\\text{fan}_{\\text{in}}}', inline: '\\sigma^2 = 2/\\text{fan}_{\\text{in}}', src: L2(8) },
  lecun: { label: 'LeCun', sub: 'σ² = 1/fan_in', tex: '\\sigma^2 = \\dfrac{1}{\\text{fan}_{\\text{in}}}', inline: '\\sigma^2 = 1/\\text{fan}_{\\text{in}}', src: L2(8) },
  n01: { label: 'N(0, 1)', sub: 'the technique popular before (slide 6)', tex: '\\mathcal{N}(0, 1)', src: L2(6) },
};

// Table 11-1 (slide 8): σ² (Normal) per initialization and the activation functions it goes with
export const TABLE = {
  glorot: ['none', 'tanh', 'sigmoid', 'softmax'],
  he: ['relu', 'leaky', 'elu', 'gelu', 'silu', 'mish'],
  lecun: ['selu'],
  caption: 'Table 11-1. Initialization parameters for each type of activation function.',
  src: L2(8),
};

/* ── the stack (the page's own simulation; labels only) ───────────────── */
export const SIM = {
  acts: { none: 'None (linear)', sigmoid: 'sigmoid', tanh: 'tanh', relu: 'ReLU', leaky: 'leaky ReLU, α = 0.2', elu: 'ELU, α = 1', selu: 'SELU', gelu: 'GELU', silu: 'Swish (SiLU)', mish: 'Mish' },
  inits: { n01: 'N(0, 1)', glorot: 'Glorot normal', glorotUniform: 'Glorot uniform', he: 'He normal', lecun: 'LeCun normal' },
  bn: { none: 'no BN', before: 'BN before each activation', after: 'BN after each activation' },
  status: { healthy: 'healthy', vanishing: 'vanishing', exploding: 'exploding', saturated: 'saturated' },
  axes: { hist: 'a = f(z)', std: 'σ(z)', grad: '∂L/∂z ÷ top' },
  input: 'inputs x ~ N(0, 1)',
  cfg: { act: 'activation', init: 'init', bn: 'BN' },
  layer: 'L',
  healthy: '{n} / 10 layers healthy',
  own: 'The stack is this page’s own simulation: 10 Dense layers of 50 units (no biases) on 64 standard-normal inputs, one forward pass and one backward pass from a random ∂L/∂a at the top. σ(z) is the spread of what each layer feeds its activation; ∂L/∂z is shown relative to the top layer. A layer is healthy while both bars stay inside the shaded band and its units are not saturated.',
  ownBn: 'BN here runs in training mode over the 64-instance batch with γ = 1, β = 0 (slide 24), placed before each activation as slide 28 does.',
};

/* Which sick stack each "pick the init" item starts from. 'n01' is slide 6's
   N(0, 1); 'glorotUniform' is Keras's default (slide 9). maths checks every
   pair is unhealthy and that the Table 11-1 init heals it. sigmoid and
   softmax are asked about without a stack (sigmoid's derivative keeps its
   ∂L/∂z shrinking even under Glorot, and softmax is an output activation). */
export const SCENES = {
  whichInit: [
    { act: 'tanh', init: 'n01' },
    { act: 'none', init: 'n01' },
    { act: 'relu', init: 'n01' },
    { act: 'relu', init: 'glorotUniform' },
    { act: 'leaky', init: 'n01' },
    { act: 'leaky', init: 'glorotUniform' },
    { act: 'elu', init: 'n01' },
    { act: 'gelu', init: 'glorotUniform' },
    { act: 'silu', init: 'glorotUniform' },
    { act: 'mish', init: 'glorotUniform' },
    { act: 'selu', init: 'n01' },
  ],
  // the vanishing/exploding read-outs (answers come from the simulation; maths checks the margin)
  diagnose: [
    { act: 'relu', init: 'n01' },
    { act: 'none', init: 'n01' },
    { act: 'selu', init: 'n01' },
    { act: 'relu', init: 'glorotUniform' },
    { act: 'leaky', init: 'glorotUniform' },
    { act: 'gelu', init: 'glorotUniform' },
    { act: 'mish', init: 'glorotUniform' },
    { act: 'relu', init: 'he' },
    { act: 'selu', init: 'lecun' },
    { act: 'none', init: 'glorot' },
  ],
  culprit: { act: 'sigmoid', init: 'n01' },
  oldStack: { act: 'sigmoid', init: 'n01' },
  // BN heals a stack that keeps its bad init (slide 25: saturating activations such as tanh became usable)
  bnHeals: [
    { act: 'tanh', init: 'n01' },
    { act: 'sigmoid', init: 'n01' },
    { act: 'relu', init: 'n01' },
  ],
  initPrompt: {
    n01: 'the old N(0, 1) init (slide 6)',
    glorotUniform: 'Keras’s default Glorot uniform init (slide 9)',
  },
};

/* ── prompts and why texts (templates) ────────────────────────────────── */
export const TEXT = {
  whichInit: {
    prompt: 'This stack runs {act} on {initDesc}. Which initialization does Table 11-1 pair with {act}?',
    why: 'Table 11-1 (slide 8) pairs {act} with {init}: ${tex}$ (normal). {more}',
    more: {
      glorot: 'Slide 7: Glorot and Bengio proposed it as a good compromise that has proven to work very well in practice.',
      he: 'He et al. give it for ReLU and its variants (including ELU), slide 8.',
      lecun: 'For SELU with a normal distribution, LeCun’s initialization is preferred (slide 8).',
    },
    src: L2(8),
  },
  whichInitRev: {
    prompt: 'Table 11-1 pairs {init} ({sub}) with which of these activation functions?',
    why: 'Table 11-1 (slide 8): Glorot goes with None, tanh, sigmoid, softmax; He with ReLU, Leaky ReLU, ELU, GELU, Swish, Mish; LeCun with SELU.',
    src: L2(8),
  },
  whichAct: {
    prompt: 'Which activation should the hidden layers use for {cue}?',
    src: L2(22),
  },
  diagnose: {
    prompt: 'Read the ∂L/∂z bars from the top layer down to layer 1. What is this stack suffering from?',
    choices: [
      { value: 'vanishing', label: 'vanishing gradients' },
      { value: 'exploding', label: 'exploding gradients' },
      { value: 'healthy', label: 'neither: it is healthy' },
    ],
    why: {
      vanishing: 'Here ∂L/∂z at layer 1 is ×{ratio} of the top layer’s: gradients get smaller and smaller as the algorithm progresses down to the lower layers, so their weights are left virtually unchanged (slide 5).',
      exploding: 'Here ∂L/∂z at layer 1 is ×{ratio} of the top layer’s: the gradients become larger and larger on the way down, the exploding gradients problem (slide 5).',
      healthy: 'Here ∂L/∂z at layer 1 is ×{ratio} of the top layer’s: {act} with {init} keeps the gradient’s scale through the stack, the pairing Table 11-1 gives (slide 8).',
    },
    src: L2(5),
  },
  fanAvg: {
    prompt: 'A Dense layer with fan_in = {fin} and fan_out = {fout}. What is fan_avg?',
    why: 'Slide 7: $\\text{fan}_{\\text{avg}} = (\\text{fan}_{\\text{in}} + \\text{fan}_{\\text{out}})/2 = ({fin} + {fout})/2 = {ans}$.',
    src: L2(7),
  },
  glorotVar: {
    prompt: 'Glorot initialization, normal distribution: fan_in = {fin}, fan_out = {fout}. What is σ²?',
    why: 'Slide 7: $\\sigma^2 = 1/\\text{fan}_{\\text{avg}}$ with $\\text{fan}_{\\text{avg}} = ({fin} + {fout})/2 = {favg}$, so $\\sigma^2 = 1/{favg} = {ans}$.',
    src: L2(7),
  },
  glorotLimit: {
    prompt: 'Glorot initialization, uniform over [−r, +r]: fan_in = {fin}, fan_out = {fout}. What is r?',
    why: 'Slide 7: $r = \\sqrt{3/\\text{fan}_{\\text{avg}}}$ with $\\text{fan}_{\\text{avg}} = ({fin} + {fout})/2 = {favg}$, so $r = \\sqrt{3/{favg}} = \\sqrt{{r2}} = {ans}$.',
    src: L2(7),
  },
  heVar: {
    prompt: 'He initialization (normal) for {article} {act} layer: fan_in = {fin}, fan_out = {fout}. What is σ²?',
    why: 'Table 11-1 (slide 8): He uses $\\sigma^2 = 2/\\text{fan}_{\\text{in}} = 2/{fin} = {ans}$; fan_out does not enter.',
    src: L2(8),
  },
  lecunVar: {
    prompt: 'LeCun initialization (normal) for a SELU layer: fan_in = {fin}, fan_out = {fout}. What is σ²?',
    why: 'Table 11-1 (slide 8): LeCun uses $\\sigma^2 = 1/\\text{fan}_{\\text{in}} = 1/{fin} = {ans}$; fan_out does not enter.',
    src: L2(8),
  },
  decimalSub: 'as a decimal',
};

/* ── slide 22: which activation for the hidden layers ─────────────────── */
export const WHICH_ACT = {
  options: {
    relu: { label: 'ReLU', fix: { act: 'relu', init: 'he' } },
    silu: { label: 'SiLU (Swish)', fix: { act: 'silu', init: 'he' } },
    mish: { label: 'Mish', fix: { act: 'mish', init: 'he' } },
    leakyPrelu: { label: 'leaky ReLU or PReLU', fix: { act: 'leaky', init: 'he' } },
    selu: { label: 'SELU (slide 16’s constraints met)', fix: { act: 'selu', init: 'lecun' } },
  },
  // each cue's distractors leave out the options the slide would also allow
  cues: [
    { id: 'simple', cue: 'a simple task', answer: 'relu', others: ['silu', 'mish', 'selu'],
      why: 'Slide 22: in general, ReLU remains a good default for simple tasks; it is fast to compute and many hardware accelerators provide ReLU-specific optimizations.' },
    { id: 'complex', cue: 'a more complex task (the better default)', answer: 'silu', others: ['relu', 'selu', 'leakyPrelu'],
      why: 'Slide 22: for more complex tasks, SiLU (Swish) is probably a better default; you can also try the parametrized Swish and tune β.' },
    { id: 'mish', cue: 'a complex task where slightly better results are worth a bit more compute', answer: 'mish', others: ['relu', 'leakyPrelu', 'selu'],
      why: 'Slide 22: Mish may give you slightly better results, but it requires a bit more compute.' },
    { id: 'latency', cue: 'a complex task where latency is a concern', answer: 'leakyPrelu', others: ['mish', 'silu', 'selu'],
      why: 'Slide 22: if latency is a concern, you may prefer a simpler activation function like leaky ReLU or PReLU.' },
    { id: 'deep', cue: 'a very deep MLP', answer: 'selu', others: ['relu', 'mish', 'leakyPrelu'],
      why: 'Slide 22: for very deep MLPs, try SELU, but make sure the constraints listed on slide 16 are met.' },
  ],
  after: 'Fixed with {act} on {init}, its Table 11-1 init (slide 8).',
  src: L2(22),
};

/* ── clean fan pairs: every answer is a short terminating decimal ─────── */
export const FAN_PAIRS = {
  // Glorot σ² = 1/fan_avg
  glorotVar: [
    [30, 10], [32, 8], [40, 10], [64, 16], [50, 30], [90, 10], [64, 36], [128, 32], [100, 60],
    [150, 50], [120, 80], [200, 50], [150, 100], [300, 100], [256, 144], [400, 100], [300, 200],
    [500, 300], [700, 100], [600, 400], [900, 100],
  ],
  // Glorot r = √(3/fan_avg): fan_avg ∈ {3, 12, 48, 75, 192, 300, 1200}
  glorotLimit: [
    [4, 2], [16, 8], [20, 4], [64, 32], [80, 16], [100, 50], [120, 30], [256, 128], [300, 84],
    [400, 200], [500, 100], [2000, 400], [1500, 900],
  ],
  // He σ² = 2/fan_in and LeCun σ² = 1/fan_in
  heFanIn: [20, 40, 50, 80, 100, 200, 250, 400, 500, 1000],
  lecunFanIn: [20, 25, 40, 50, 100, 200, 250, 400, 500],
  fanOut: [10, 32, 64, 100, 128, 300],
};

/* ── slide 16: SELU's self-normalisation constraints ──────────────────── */
export const SELU = {
  prompt: 'SELU preserves the mean and variance between consecutive layers if the slide’s constraints hold. Select exactly those constraints.',
  promptText: 'Select exactly slide 16’s constraints for SELU to self-normalise',
  // the three constraints, as slide 16 lists them
  conditions: [
    { id: 'standardized', short: 'standardized inputs', label: 'The input features are standardized (mean 0, standard deviation 1)' },
    { id: 'lecunNormal', short: 'LeCun normal init', label: 'Every hidden layer’s weights are initialized with LeCun normal initialization' },
    { id: 'noReg', short: 'no ℓ1/ℓ2, max-norm, batch-norm, dropout', label: 'No ℓ1 or ℓ2 regularization, max-norm, batch-norm, or dropout is used' },
  ],
  distractors: [
    { id: 'unitRange', short: 'inputs scaled to [0, 1]', label: 'The input features are scaled to the range [0, 1]' },
    { id: 'heNormal', short: 'He normal init', label: 'Every hidden layer’s weights are initialized with He normal initialization' },
    { id: 'lecunUniform', short: 'LeCun uniform init', label: 'Every hidden layer’s weights are initialized with LeCun uniform initialization' },
    { id: 'glorotDefault', short: 'Glorot uniform init', label: 'Every hidden layer keeps Keras’s default Glorot uniform initialization' },
    { id: 'bnEach', short: 'BN after every hidden layer', label: 'A batch-norm layer after every hidden layer' },
    { id: 'dropout', short: 'dropout', label: 'Dropout between the hidden layers' },
    { id: 'l2', short: 'ℓ2 regularization', label: 'ℓ2 regularization on every hidden layer' },
    { id: 'clipnorm', short: 'clipnorm=1.0', label: 'Gradient clipping with clipnorm=1.0' },
  ],
  why: 'Slide 16 lists three constraints: (1) the input features are standardized (mean 0, standard deviation 1); (2) every hidden layer’s weights use LeCun normal initialization; (3) no ℓ1 or ℓ2 regularization, max-norm, batch-norm, or dropout.',
  constants: {
    prompt: '$\\text{SELU}(z) = s\\,\\text{ELU}_\\alpha(z)$. Which fixed values does slide 16 give for s and α?',
    promptText: 'SELU(z) = s·ELU_α(z): the fixed s and α',
    choices: [
      { value: 'right', label: 's = 1.0507, α = 1.6733' },
      { value: 'swapped', label: 's = 1.6733, α = 1.0507' },
      { value: 'ones', label: 's = 1, α = 1' },
      { value: 'alphaOne', label: 's = 1.0507, α = 1' },
    ],
    answer: 'right',
    why: 'Slide 16: SELU(z) = s·ELU₁.₆₇₃₃(z), where s = 1.0507 is a fixed scale factor and α is fixed at 1.6733 (slide 17’s figure legend rounds them to 1.05 and 1.67).',
  },
  stack: { before: { act: 'selu', init: 'n01' }, after: { act: 'selu', init: 'lecun' } },
  src: L2(16),
};

/* ── the activation curves (slides 6, 10, 11, 15, 16, 17) ─────────────── */
export const CURVES = {
  // what the curve-name item can plot, with the parameters the slides plot
  plots: [
    { id: 'relu', act: 'relu', label: 'ReLU', concept: 'act.relu', src: L2(10) },
    { id: 'leaky', act: 'leaky', alpha: 0.2, label: 'leaky ReLU', concept: 'act.leakyRelu', src: L2(11) },
    { id: 'elu1', act: 'elu', alpha: 1, label: 'ELU', concept: 'act.elu', src: L2(15) },
    { id: 'selu', act: 'selu', label: 'SELU', concept: 'act.selu', src: L2(16, 17) },
  ],
  namePrompt: 'Which activation function is plotted?',
  nameWhy: {
    relu: 'ReLU(z) = max(0, z): exactly 0 for every negative z, the identity for positive z (slide 10).',
    leaky: 'LeakyReLU_α(z) = max(αz, z): like ReLU but with a small slope α for negative values (slide 11; this plot uses α = 0.2).',
    elu1: 'ELU_α(z) = α(exp(z) − 1) for z < 0, z for z ≥ 0: negative values for z < 0, flattening at −α = −1 here, smooth everywhere when α = 1 (slide 15).',
    selu: 'SELU(z) = 1.0507·ELU₁.₆₇₃₃(z): slightly steeper than ELU for z ≥ 0 and flattening lower, near −1.76, for z < 0 (slides 16–17).',
  },
  nameChoices: ['relu', 'leaky', 'elu1', 'selu'],
  // the plots a round asks about (ReLU is Lecture 1's concept; here it is only a distractor)
  nameAsk: ['leaky', 'elu1', 'selu'],
  // formula → name (choice)
  formulaPrompt: 'Which activation function is this?',
  formulas: [
    { id: 'leaky', act: 'leaky', tex: '\\max(\\alpha z, z)', label: 'leaky ReLU', concept: 'act.leakyRelu', src: L2(11), why: 'Slide 11: $\\text{LeakyReLU}_\\alpha(z) = \\max(\\alpha z, z)$, where α is a small constant.' },
    { id: 'elu', act: 'elu', tex: '\\begin{cases} \\alpha(\\exp(z) - 1) & \\text{if } z < 0 \\\\ z & \\text{if } z \\ge 0 \\end{cases}', label: 'ELU', concept: 'act.elu', src: L2(15), why: 'Slide 15: the exponential linear unit is $\\alpha(\\exp(z) - 1)$ if z < 0 and z if z ≥ 0.' },
    { id: 'selu', act: 'selu', tex: '1.0507 \\cdot \\begin{cases} 1.6733(\\exp(z) - 1) & \\text{if } z < 0 \\\\ z & \\text{if } z \\ge 0 \\end{cases}', label: 'SELU', concept: 'act.selu', src: L2(15, 16), why: 'Slide 16: SELU(z) = s·ELU₁.₆₇₃₃(z) with s = 1.0507: ELU with α fixed at 1.6733 (slide 15’s cases), scaled by s.' },
    { id: 'gelu', act: 'gelu', tex: 'z\\,\\Phi(z)', label: 'GELU', concept: 'act.gelu', src: L2(18), why: 'Slide 18: GELU(z) = zΦ(z), where Φ is the standard Gaussian cumulative distribution function.' },
    { id: 'silu', act: 'silu', tex: 'z\\,\\sigma(z)', label: 'Swish (SiLU)', concept: 'act.swish', src: L2(19), why: 'Slide 19: the sigmoid linear unit (SiLU) equals zσ(z); Ramachandran et al. named it Swish.' },
    { id: 'mish', act: 'mish', tex: 'z \\tanh(\\text{softplus}(z))', label: 'Mish', concept: 'act.mish', src: L2(20), why: 'Slide 20: Mish(z) = z·tanh(softplus(z)), where softplus(z) = log(1 + exp(z)).' },
    { id: 'relu', act: 'relu', tex: '\\max(0, z)', label: 'ReLU', concept: 'act.relu', src: L2(10), why: 'Slide 10 (footnote): ReLU(z) = max(0, z).' },
  ],
  // level 2 asks about the slide 11–16 trio; the others are distractors
  formulaAsk: ['leaky', 'elu', 'selu'],
  // the floor ELU / SELU flatten towards as z → −∞ (slide 15 figure: dotted lines at −1 and −2; slide 17 figure ≈ −1.76)
  floor: {
    prompt: '{name} flattens towards which value as z → −∞?',
    cases: [
      { id: 'elu1', act: 'elu', alpha: 1, name: 'ELU with α = 1', answer: -1, tol: 0.001, concept: 'act.elu', src: L2(15),
        why: 'Slide 15: for z < 0, ELU_α(z) = α(exp(z) − 1) → −α as exp(z) → 0, so −1 for α = 1 (the figure’s dotted line).' },
      { id: 'elu2', act: 'elu', alpha: 2, name: 'ELU with α = 2', answer: -2, tol: 0.001, concept: 'act.elu', src: L2(15),
        why: 'Slide 15: for z < 0, ELU_α(z) = α(exp(z) − 1) → −α as exp(z) → 0, so −2 for α = 2 (the figure’s dotted line).' },
      { id: 'selu', act: 'selu', name: 'SELU', answer: -1.758, tol: 0.01, concept: 'act.selu', src: L2(16, 17),
        why: 'Slide 16: SELU(z) = s·ELU₁.₆₇₃₃(z) → −s·α = −1.0507 × 1.6733 ≈ −1.758 as z → −∞ (slide 17’s figure draws it near −1.76).' },
    ],
  },
};

export const LEAKY = {
  alpha: {
    choices: [0.01, 0.1, 0.2, 0.3],
    cases: [
      { id: 'small', prompt: 'LeakyReLU_α(z) = max(αz, z), where α is a small constant. Which value does slide 11 give as its example?', answer: 0.01, src: L2(11),
        why: 'Slide 11: α is a small constant, e.g. α = 0.01; researchers found a larger leak, e.g. α = 0.2, tends to give better performance.' },
      { id: 'larger', prompt: 'Researchers found that a larger leak tends to give better performance. Which α does slide 11 give for it?', answer: 0.2, src: L2(11),
        why: 'Slide 11: a larger leak, e.g. α = 0.2, tends to give better performance than the small α = 0.01.' },
      { id: 'keras', prompt: 'tf.keras.layers.LeakyReLU(): what is the default negative_slope (alpha before tf-2.16)?', answer: 0.3, src: L2(12), code: ['leaky_relu = tf.keras.layers.LeakyReLU()', '# no negative_slope set'],
        why: 'Slide 12’s code comments: default alpha=0.3 (tf-2.15 or older), default negative_slope=0.3 (tf-2.16 onward); the code itself passes 0.2.' },
    ],
  },
  value: {
    prompt: 'LeakyReLU_α(z) with α = {alpha}: what is the output at z = {z}?',
    alphas: [0.01, 0.2, 0.3],
    zs: [-20, -10, -5, -4, -3, -2, 2, 3],
    why: 'Slide 11: $\\text{LeakyReLU}_\\alpha(z) = \\max(\\alpha z, z) = \\max({az}, {z}) = {ans}$.',
    src: L2(11),
  },
};

/* ── slides 23–28: Batch Normalization ────────────────────────────────── */
export const BN = {
  // per-feature batches: deviations from μ_B that sum to 0 and give a whole-number σ_B (m_B = 2, 4 or 5)
  deviations: [
    { d: [-1, 1], sd: 1 }, { d: [-2, 2], sd: 2 }, { d: [-3, 3], sd: 3 },
    { d: [-1, -1, 1, 1], sd: 1 }, { d: [-2, -2, 2, 2], sd: 2 }, { d: [-7, -1, 1, 7], sd: 5 },
    { d: [-3, -1, 0, 1, 3], sd: 2 }, { d: [-6, -2, 0, 2, 6], sd: 4 },
  ],
  means: [-2, -1, 1, 2, 3, 4, 5, 6, 8, 10],
  gammas: [0.5, 2, 3],
  betas: [-1, 0.5, 1, 2],
  prompts: {
    mu: 'One input feature over a mini-batch of m_B = {m}: x = {xs}. What is μ_B?',
    var: 'One input feature over a mini-batch of m_B = {m}: x = {xs}. What is σ²_B?',
    xhat: 'One input feature over a mini-batch of m_B = {m}: x = {xs}. What is x̂ for x = {xi}?',
    z: 'BN with γ = {gamma} and β = {beta} on one feature, m_B = {m}: x = {xs}. What is z for x = {xi}?',
  },
  epsNote: 'ε left out (the slide gives it no value)',
  why: {
    mu: 'Slide 24: $\\mu_B = \\frac{1}{m_B}\\sum x^{(i)} = {sum}/{m} = {mu}$.',
    var: 'Slide 24: $\\sigma_B^2 = \\frac{1}{m_B}\\sum (x^{(i)} - \\mu_B)^2 = {sq}/{m} = {var}$ with $\\mu_B = {mu}$ (divide by m_B, not m_B − 1).',
    xhat: 'Slide 24: $\\hat{x} = (x - \\mu_B)/\\sqrt{\\sigma_B^2 + \\epsilon} = ({xi} - {muP})/\\sqrt{{var}} = {xhat}$ (ε ≈ 0).',
    z: 'Slide 24: $\\hat{x} = ({xi} - {muP})/\\sqrt{{var}} = {xhat}$, then $z = \\gamma \\otimes \\hat{x} + \\beta = {gamma} \\times {xhatP} + {betaP} = {z}$.',
  },
  // number of parameters per BN layer (slides 24 and 27)
  count: {
    features: [10, 50, 64, 100, 128, 256, 300, 784],
    asks: {
      trainable: { prompt: 'BatchNormalization() on {n} input features: how many trainable parameters?', mult: 2,
        why: 'Slide 24: γ and β are trainable, one parameter per input feature: 2 × {n} = {ans}.' },
      nonTrainable: { prompt: 'BatchNormalization() on {n} input features: how many non-trainable parameters?', mult: 2,
        why: 'The moving mean and moving variance (slide 23) are not trained: 2 × {n} = {ans}; slide 27’s summary shows 2,368 = 2 × (784 + 300 + 100) for its three BN layers.' },
      total: { prompt: 'BatchNormalization() on {n} input features: what does model.summary() print as its Param #?', mult: 4,
        why: 'γ, β, moving mean and moving variance per feature: 4 × {n} = {ans}; slide 27 prints 3,136, 1,200 and 400 for 784, 300 and 100 features.' },
    },
    src: L2(23, 24, 27),
  },
  choiceItems: [
    { id: 'trainable', concept: 'bn.params', src: L2(23, 24), scene: 'params',
      prompt: 'Which BN parameters does training learn (the trainable ones)?',
      choices: [
        { value: 'gammaBeta', label: 'γ and β, the scale and shift' },
        { value: 'moving', label: 'the moving mean and moving variance' },
        { value: 'batchStats', label: 'μ_B and σ²_B' },
        { value: 'all', label: 'γ, β and the moving mean and variance' },
      ],
      answer: 'gammaBeta',
      why: 'Slides 23–24: BN introduces two trainable parameters, γ and β (scale and shift, one per input feature), learned together with the connection weights; the mean and variance used at test time are moving averages.' },
    { id: 'testTime', concept: 'bn.params', src: L2(23), scene: 'params',
      prompt: 'At test time, which mean and variance does a BN layer use?',
      choices: [
        { value: 'moving', label: 'the moving averages estimated over the training mini-batches' },
        { value: 'testBatch', label: 'μ_B and σ²_B of the test mini-batch' },
        { value: 'unit', label: 'mean 0 and variance 1 for every feature' },
        { value: 'gammaBeta', label: 'γ and β' },
      ],
      answer: 'moving',
      why: 'Slide 23: the mean and variance of each layer’s outputs over the entire training set are estimated using the moving average of the minibatches, and they are used in the predictions on the testing set.' },
    { id: 'paper', concept: 'bn.placement', src: L2(28), scene: 'placement',
      prompt: 'Where did the authors of the BN paper argue the BN layers should go?',
      choices: [
        { value: 'before', label: 'before the activation functions' },
        { value: 'after', label: 'after the activation functions' },
        { value: 'inputOnly', label: 'only after the input (Flatten) layer' },
        { value: 'outputOnly', label: 'only before the output layer' },
      ],
      answer: 'before',
      why: 'Slide 28: the authors of the BN paper argued in favour of adding the BN layers before the activation functions, rather than after (as slide 26 did).' },
    { id: 'useBias', concept: 'bn.placement', src: L2(28), scene: 'placement',
      prompt: 'To put BN before the activation, the activation becomes its own layer. What else changes on the Dense layer before the BN layer?',
      choices: [
        { value: 'noBias', label: 'use_bias=False' },
        { value: 'relu', label: 'activation="relu"' },
        { value: 'frozen', label: 'trainable=False' },
        { value: 'glorot', label: 'kernel_initializer="glorot_uniform"' },
      ],
      answer: 'noBias',
      why: 'Slide 28: set the activation function as a separate layer and exclude the bias parameter from the previous layer (use_bias=False).' },
    { id: 'slide26', concept: 'bn.placement', src: L2(26), scene: 'placement',
      prompt: 'In slide 26’s Keras model, where is BatchNormalization() applied?',
      choices: [
        { value: 'after', label: 'after the Flatten layer and after each of the two hidden layers' },
        { value: 'beforeAct', label: 'between each hidden Dense layer and its separate Activation layer' },
        { value: 'outputOnly', label: 'only before the output layer' },
        { value: 'afterOutput', label: 'after the softmax output layer' },
      ],
      answer: 'after',
      why: 'Slide 26: BN is applied after the Flatten layer and after each of the two hidden layers (each hidden Dense keeps activation="relu").' },
  ],
  // slide 25 with a stack that keeps its bad init and gains BN
  benefit: [
    // shown on sigmoid + N(0, 1), the bnHeals stack whose ∂L/∂z vanishes in the simulation (tanh and ReLU on N(0, 1) explode)
    { id: 'saturating', stack: { act: 'sigmoid', init: 'n01' }, prompt: 'This stack keeps its N(0, 1) init. With BN, Ioffe and Szegedy found vanishing gradients so strongly reduced that they could use …',
      choices: [
        { value: 'saturating', label: 'saturating activation functions, e.g. tanh' },
        { value: 'smallLr', label: 'only much smaller learning rates' },
        { value: 'reluOnly', label: 'only non-saturating activations such as ReLU' },
        { value: 'noBatches', label: 'no mini-batches at all' },
      ],
      answer: 'saturating',
      why: 'Slide 25: the vanishing gradients problem was so strongly reduced that they could use saturating activation functions (e.g. tanh); the network could also be trained with much larger learning rates.' },
    { id: 'learningRate', prompt: 'This stack keeps its N(0, 1) init. With BN, Ioffe and Szegedy’s network could be trained with …',
      choices: [
        { value: 'largerLr', label: 'much larger learning rates' },
        { value: 'smallerLr', label: 'much smaller learning rates' },
        { value: 'noInit', label: 'no weight initialization at all' },
        { value: 'moreDropout', label: 'more dropout than before' },
      ],
      answer: 'largerLr',
      why: 'Slide 25: their network could be trained with much larger learning rates, and BN also acts like a regularizer, reducing the need for techniques such as dropout.' },
  ],
  benefitSrc: L2(25),
  after: 'Healed by {bn} with the same N(0, 1) init.',
  src: L2(24),
};

/* ── slide 29: gradient clipping ──────────────────────────────────────── */
export const CLIP = {
  vectorPrompt: 'optimizer = tf.keras.optimizers.SGD(clipvalue=1.0). The gradient vector is g = {g}. What is g after clipping?',
  vectorPromptText: 'SGD(clipvalue=1.0): the clipped gradient vector',
  vectorWhy: 'Slide 29: clipvalue=1.0 clips every component of the gradient vector to a value between −1.0 and 1.0: {g} → {ans}. The direction can change; clipnorm=1.0 is the slide’s alternative when you want to retain the vector’s orientation.',
  // component pools for the clipvalue vectors (at least one inside and one outside [−1, 1])
  inside: [0.4, -0.7, 0.9, -0.2, 0.6, -0.5],
  outside: [-3, 2.5, 5, -1.5, 12, -8, 1.2, -2.4],
  normPrompt: 'SGD(clipnorm=1.0) on g = {g}: g is rescaled so its ℓ2 norm is at most 1.0. What is g after clipping?',
  normPromptText: 'clipnorm=1.0: the rescaled gradient vector',
  normWhy: 'Slide 29 says clipnorm=1.0 retains the gradient vector’s orientation. Keras does it by rescaling: ‖g‖ = {norm}, so g × 1.0/{norm} = {ans} (a vector already within norm 1.0 is left alone).',
  normKeptWhy: 'Slide 29 says clipnorm=1.0 retains the gradient vector’s orientation. Keras rescales only when ‖g‖ > 1.0: here ‖g‖ = {norm} ≤ 1.0, so g is left unchanged (its norm is already ≤ 1): {ans}.',
  normNote: 'Slide 29 only says clipnorm retains the orientation; the rescaling rule g · 1.0/max(‖g‖, 1.0) is Keras’s documented behaviour, not on the slide.',
  // ℓ2 norms that divide cleanly
  normVectors: [[3, 4], [-6, 8], [12, -16], [8, -6], [-9, 12], [0.3, 0.4], [5, 0], [0, -2]],
  facts: [
    { id: 'orientation', prompt: 'Which option keeps the gradient vector’s orientation when it clips?',
      choices: [
        { value: 'clipnorm', label: 'clipnorm=1.0' },
        { value: 'clipvalue', label: 'clipvalue=1.0' },
        { value: 'both', label: 'both of them' },
        { value: 'neither', label: 'neither of them' },
      ],
      answer: 'clipnorm',
      why: 'Slide 29: clipvalue=1.0 clips every component to [−1.0, 1.0] (so the direction can change); use clipnorm=1.0 if you want to retain the gradient vector orientation.' },
    { id: 'range', prompt: 'SGD(clipvalue=1.0) clips every component of the gradient vector to …',
      choices: [
        { value: 'pm1', label: 'a value between −1.0 and 1.0' },
        { value: 'unit', label: 'a value between 0 and 1.0' },
        { value: 'norm', label: 'a vector whose norm is 1.0' },
        { value: 'half', label: 'a value between −0.5 and 0.5' },
      ],
      answer: 'pm1',
      why: 'Slide 29: optimizer = tf.keras.optimizers.SGD(clipvalue=1.0) will clip every component of the gradient vector to a value between −1.0 and 1.0.' },
    { id: 'rnn', prompt: 'Gradient clipping is mostly useful for which networks?',
      choices: [
        { value: 'rnn', label: 'recurrent neural networks, where BN is tricky to use' },
        { value: 'cnn', label: 'convolutional networks that already use BN' },
        { value: 'shallow', label: 'shallow MLPs with sigmoid outputs' },
        { value: 'selu', label: 'self-normalizing SELU networks' },
      ],
      answer: 'rnn',
      why: 'Slide 29: clipping is mostly useful for recurrent neural networks (RNNs), as BN is tricky to use in RNNs.' },
    { id: 'problem', prompt: 'Gradient clipping is a popular technique to lessen which problem?',
      choices: [
        { value: 'exploding', label: 'exploding gradients' },
        { value: 'vanishing', label: 'vanishing gradients' },
        { value: 'dying', label: 'dying ReLUs' },
        { value: 'overfit', label: 'overfitting a small dataset' },
      ],
      answer: 'exploding',
      why: 'Slide 29: another popular technique to lessen the exploding gradients problem is to clip the gradients during backpropagation so that they never exceed some threshold.' },
  ],
  stack: { act: 'relu', init: 'n01' },
  src: L2(29),
};

/* ── the remaining fact items (choice) ────────────────────────────────── */
export const CHOICE_ITEMS = [
  { id: 'culprit', concept: 'init.vanishing', src: L2(5, 6), scene: 'culprit',
    prompt: 'Glorot and Bengio found the vanishing gradients came from combining which two things?',
    choices: [
      { value: 'sigmoidN01', label: 'the logistic sigmoid activation and the popular N(0, 1) weight initialization' },
      { value: 'reluHe', label: 'the ReLU activation and He initialization' },
      { value: 'tanhBn', label: 'the tanh activation and Batch Normalization' },
      { value: 'seluLecun', label: 'the SELU activation and LeCun initialization' },
    ],
    answer: 'sigmoidN01',
    why: 'Slides 5–6: the combination of the popular logistic sigmoid activation and the weight initialization most popular at the time (usually drawn from N(0, 1)); each layer’s output variance became much greater than its input variance.' },
  { id: 'saturate', concept: 'init.vanishing', src: L2(6), scene: 'culprit',
    prompt: 'These sigmoid units sit at 0 or 1. What is the logistic function’s derivative there?',
    choices: [
      { value: 'zero', label: 'extremely close to 0' },
      { value: 'one', label: 'close to 1' },
      { value: 'half', label: 'about 0.5, its mean' },
      { value: 'large', label: 'very large' },
    ],
    answer: 'zero',
    why: 'Slide 6: when inputs become large (negative or positive), the logistic function saturates at 0 or 1, with a derivative extremely close to 0; its mean is 0.5 rather than 0.' },
  { id: 'kerasDefault', concept: 'init.glorot', src: L2(9), scene: 'code', code: ['dense = tf.keras.layers.Dense(50)', '# no kernel_initializer set'],
    prompt: 'You create tf.keras.layers.Dense(50) and set no kernel_initializer. Which initialization does Keras use?',
    choices: [
      { value: 'glorotUniform', label: 'Glorot with a uniform distribution' },
      { value: 'glorotNormal', label: 'Glorot with a normal distribution' },
      { value: 'heNormal', label: 'He with a normal distribution' },
      { value: 'n01', label: 'N(0, 1)' },
    ],
    answer: 'glorotUniform',
    why: 'Slide 9: by default, Keras uses Glorot initialization with a uniform distribution; set kernel_initializer (e.g. "he_normal") to choose another.' },
];

/* the maths drawer's fixed lines */
export const MATHS = {
  glorot: ['\\sigma^2 = \\dfrac{1}{\\text{fan}_{\\text{avg}}}', 'r = \\sqrt{\\dfrac{3}{\\text{fan}_{\\text{avg}}}}', '\\text{fan}_{\\text{avg}} = (\\text{fan}_{\\text{in}} + \\text{fan}_{\\text{out}})/2'],
  he: ['\\sigma^2 = \\dfrac{2}{\\text{fan}_{\\text{in}}}'],
  lecun: ['\\sigma^2 = \\dfrac{1}{\\text{fan}_{\\text{in}}}'],
  bn: [
    '\\mu_B = \\frac{1}{m_B}\\sum_{i=1}^{m_B} x^{(i)}',
    '\\sigma_B^2 = \\frac{1}{m_B}\\sum_{i=1}^{m_B} (x^{(i)} - \\mu_B)^2',
    '\\hat{x}^{(i)} = \\frac{x^{(i)} - \\mu_B}{\\sqrt{\\sigma_B^2 + \\epsilon}}',
    'z^{(i)} = \\gamma \\otimes \\hat{x}^{(i)} + \\beta',
  ],
  bnNote: 'Slide 24 writes these as vectors over the features; one feature (a scalar per instance) is shown here.',
};
