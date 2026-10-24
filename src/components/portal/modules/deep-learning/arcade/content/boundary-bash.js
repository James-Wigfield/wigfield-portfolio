/* ============================================================================
   BOUNDARY BASH — CONTENT (pure data, slide-cited; Lecture 1 slides 4–17)
   ----------------------------------------------------------------------------
   Every label, prompt, why text and distractor the game shows, with the
   slides that state it. Templates use %name% placeholders, filled by
   maths/boundaryBash.js (which also does all the arithmetic). Slides read
   from Documents/cits5017/lectures/cits5017-lect01-IntroToANNs.pdf (4, 5,
   6, 8, 10–17 rendered at 110 dpi; slide 17's figure again at 300 dpi).

   What the slides print:
     slide 4    z = w₁x₁ + ⋯ + wₙxₙ + b = wᵀx + b, h_{w,b}(x) = step(z)
     slide 5    heaviside(z) = 0 if z < 0, 1 if z ≥ 0 (the most common);
                sign(z) = −1 if z < 0, 0 if z = 0, +1 if z > 0
     slide 9    fed one training instance at a time; a wrong prediction
                reinforces the weights
     slide 10   w_{i,j}^(next step) = w_{i,j} + η(y_j − ŷ_j)x_i
     slide 11   (handwritten) w_{i,j}^(next step) = w_{i,j} − η(ŷ_j − y_j)x_i
     slide 12   linear boundary; convergence theorem; solution not unique
     slides 13–14  sklearn Perceptron = a single TLU network = SGDClassifier
                (loss="perceptron", learning_rate="constant", eta0=1,
                penalty=None)
     slide 15   no class probability, a hard threshold
     slide 16   Minsky & Papert 1969, XOR, any linear classification model
     slide 17   Figure 10-6b: hidden weights all 1, hidden biases −3/2 (left)
                and −1/2 (right); output weights −1 (left), 1 (right), output
                bias −1/2; outputs 0 for (0,0)/(1,1) and 1 for (0,1)/(1,0)
   Nothing in this game is beyond the slides (no `beyond` items).
   ========================================================================== */

const S = (...slides) => ({ lecture: 1, slides });

/* The game's own notation (names, not facts). */
export const NOTATION = {
  text: 'One TLU with two inputs (Figure 10-4 draws three): $z = w_1x_1 + w_2x_2 + b$ and $\\hat{y} = \\mathrm{heaviside}(z)$. With a single output neuron the $j$ in slide 10’s $w_{i,j}$ never changes, so $w_i$ stands for $w_{i,j}$. Slide 10’s rule updates the connection weights; the slides give no update for the bias, so $b$ stays fixed here.',
  xor: 'Every unit in Figure 10-6b is a TLU. $h_1$, $h_2$ are this game’s names for the left and right hidden TLUs’ outputs; the step is heaviside (slide 5), which gives the 0 / 1 outputs slide 17 lists.',
  src: S(4, 5, 10, 17),
};

export const LEVEL_NAMES = ['which way · the rule', 'update by hand', 'XOR · add a hidden layer'];

export const INTRO = {
  1: {
    line: 'A point lands. If the boundary puts it on the wrong side, move the weights the way slide 10’s rule says.',
    controls: ['1–4 or tap: pick an answer', 'squares are y = 1, triangles y = 0; the tinted side is where the TLU outputs ŷ = 1', 'Enter: start'],
  },
  2: {
    line: 'Do the update yourself: type the new weight on the keypad.',
    controls: ['digits, − (±) and . on the keypad or keyboard; Enter submits', 'later points hide ŷ: read it off the side of the boundary', '1–4 for the odd choice question'],
  },
  3: {
    line: 'XOR: no single boundary works. Add the hidden layer and wire slide 17’s network.',
    controls: ['1–4 or tap: pick an answer', 'keypad for a TLU’s sum or output (−3/2 = −1.5)', 'Enter: start'],
  },
};

/* Labels on the stage (the picture's legend and the ledger). */
export const LABELS = {
  y1: 'y = 1',
  y0: 'y = 0',
  side1: 'ŷ = 1 side',
  probe: 'probe',
  fresh: { separated: 'separated · new batch', batch: 'new batch' },
  w: 'w',
  fixed: 'fixed',
  hidden: '?',
  ledger: { w: 'w', b: 'b', eta: 'η', x: 'x', y: 'y', yhat: 'ŷ', z: 'z', next: 'next w' },
  planeAria: 'Scatter plot of x₁ against x₂ with the TLU’s decision boundary w₁x₁ + w₂x₂ + b = 0 as a line; the tinted side is where the TLU outputs ŷ = 1. Squares are y = 1, triangles y = 0.',
  xorAria: 'The four XOR points: (0, 1) and (1, 0) are y = 1 (squares); (0, 0) and (1, 1) are y = 0 (triangles).',
  mlpAria: 'Figure 10-6b: inputs x₁ and x₂ feed two hidden TLUs, which feed one output TLU.',
  aria: {
    w: 'w = %w%, b = %b%.',
    cur: 'The new point x = %x% has y = %y%.',
    probe: 'A probe point sits at x = %x%.',
    ghosts: '%n% dashed candidate boundaries are numbered like the choices.',
    moved: 'After the update w = %w%.',
    tries: ' Dashed lines: single TLU boundaries, each getting at least one point wrong.',
    band: ' Dashed lines: the two hidden TLUs’ boundaries; the network outputs 1 in the band between them.',
    blank: ' The question marks are the blank values.',
    input: ' Input (%a%, %b%).',
  },
  left: 'left',
  right: 'right',
  out: 'output',
  wrongN: '%n% wrong',
};

/* ── level 1: which way does w move? (slides 9–10) ─────────────────────── */
export const DIR = {
  prompt: 'Which way do the weights move?',
  promptText: 'x = %x%, y = %y%, ŷ = %yhat%: which way do the weights move?',
  sub: '$y = %y%$, $\\hat{y} = %yhat%$, $\\eta = %eta%$',
  choices: [
    { value: 'toward', label: 'toward x: $\\mathbf{w} + \\eta\\,\\mathbf{x}$', plain: 'toward x: w + ηx' },
    { value: 'away', label: 'away from x: $\\mathbf{w} - \\eta\\,\\mathbf{x}$', plain: 'away from x: w − ηx' },
    { value: 'stay', label: 'no change: $\\mathbf{w}$ stays', plain: 'no change: w stays' },
  ],
  why: {
    toward: '$y = 1$ but $\\hat{y} = 0$, so $y - \\hat{y} = 1$ and each $w_i$ gains $\\eta\\,x_i$: $\\mathbf{w}$ moves toward $\\mathbf{x}$, %w% → %next% (slide 10’s rule).',
    away: '$y = 0$ but $\\hat{y} = 1$, so $y - \\hat{y} = -1$ and each $w_i$ loses $\\eta\\,x_i$: $\\mathbf{w}$ moves away from $\\mathbf{x}$, %w% → %next% (slide 10’s rule).',
    stay: '$y = \\hat{y} = %y%$, so $y - \\hat{y} = 0$ and the weights stay %w%: only an output neuron that produced a wrong prediction gets its weights reinforced (slides 9–10).',
  },
  src: S(9, 10),
};

/* ── level 1: which formula is the rule? (slides 10–11) ─────────────────
   Two correct forms (slide 10's typeset rule, slide 11's handwritten
   rewrite: QUIRK l1.rule.signConvention, same rule) and their wrong-sign
   and wrong-factor variants. `delta` names the update the form computes
   (maths/boundaryBash.js): errX = η(y − ŷ)x_i, negErrX = −η(y − ŷ)x_i,
   err = η(y − ŷ), errYhat = η(y − ŷ)ŷ, yX = η y x_i. An item never shows
   both correct forms, nor two forms with the same delta. */
export const RULE = {
  prompt: 'Misclassified. Which update is the Perceptron learning rule?',
  promptText: 'x = %x%, y = %y%, ŷ = %yhat%: which update is the Perceptron learning rule?',
  sub: '$w_{i,j}^{(\\text{next step})} = \\;?$ · the dashed lines are where each choice puts the boundary',
  forms: {
    s10: { tex: '$w_{i,j} + \\eta\\,(y_j - \\hat{y}_j)\\,x_i$', plain: 'wᵢ,ⱼ + η(yⱼ − ŷⱼ)xᵢ', delta: 'errX', correct: true, src: S(10) },
    s11: { tex: '$w_{i,j} - \\eta\\,(\\hat{y}_j - y_j)\\,x_i$', plain: 'wᵢ,ⱼ − η(ŷⱼ − yⱼ)xᵢ', delta: 'errX', correct: true, src: S(11) },
    s10sign: { tex: '$w_{i,j} - \\eta\\,(y_j - \\hat{y}_j)\\,x_i$', plain: 'wᵢ,ⱼ − η(yⱼ − ŷⱼ)xᵢ', delta: 'negErrX', flaw: 'sign', src: S(10, 11) },
    s11sign: { tex: '$w_{i,j} + \\eta\\,(\\hat{y}_j - y_j)\\,x_i$', plain: 'wᵢ,ⱼ + η(ŷⱼ − yⱼ)xᵢ', delta: 'negErrX', flaw: 'sign', src: S(10, 11) },
    noX: { tex: '$w_{i,j} + \\eta\\,(y_j - \\hat{y}_j)$', plain: 'wᵢ,ⱼ + η(yⱼ − ŷⱼ)', delta: 'err', flaw: 'factor', src: S(10) },
    yhatX: { tex: '$w_{i,j} + \\eta\\,(y_j - \\hat{y}_j)\\,\\hat{y}_j$', plain: 'wᵢ,ⱼ + η(yⱼ − ŷⱼ)ŷⱼ', delta: 'errYhat', flaw: 'factor', src: S(10) },
    targetX: { tex: '$w_{i,j} + \\eta\\,y_j\\,x_i$', plain: 'wᵢ,ⱼ + η yⱼ xᵢ', delta: 'yX', flaw: 'factor', src: S(10) },
  },
  signs: ['s10sign', 's11sign'],
  factors: ['noX', 'yhatX', 'targetX'],
  choiceSub: 'w → %w%',
  why: {
    s10: 'Slide 10: $w_{i,j}^{(\\text{next step})} = w_{i,j} + \\eta(y_j - \\hat{y}_j)x_i$, target minus output, times the input $x_i$. Here $\\mathbf{w}$: %w% → %next%.',
    s11: 'Slide 11’s handwriting writes the same rule as $w_{i,j} - \\eta(\\hat{y}_j - y_j)x_i$: flip the error to output minus target and the sign flips with it. Here $\\mathbf{w}$: %w% → %next%.',
  },
  src: S(10, 11),
};

/* ── level 1: what a TLU computes (slide 4) ────────────────────────────── */
export const TLU = {
  prompt: 'What does this TLU output for an input $\\mathbf{x}$?',
  promptText: 'What does a TLU output for an input x?',
  choices: [
    { value: 'step', label: '$\\mathrm{step}(\\mathbf{w}^T\\mathbf{x} + b)$', plain: 'step(wᵀx + b)' },
    { value: 'sum', label: '$\\mathbf{w}^T\\mathbf{x} + b$', plain: 'wᵀx + b' },
    { value: 'nobias', label: '$\\mathrm{step}(\\mathbf{w}^T\\mathbf{x})$', plain: 'step(wᵀx)' },
    { value: 'stepx', label: '$\\mathbf{w}^T\\mathrm{step}(\\mathbf{x}) + b$', plain: 'wᵀstep(x) + b' },
  ],
  answer: 'step',
  why: 'Slide 4: the TLU computes a weighted sum of its inputs, $z = \\mathbf{w}^T\\mathbf{x} + b$, then applies a step function to that sum: $h_{\\mathbf{w},b}(\\mathbf{x}) = \\mathrm{step}(z)$.',
  src: S(4),
};

/* ── level 1: heaviside vs sign (slide 5) ──────────────────────────────── */
export const STEP = {
  prompt: '$z = %z%$ at the probe. $\\mathrm{%fn%}(z)$ = ?',
  promptText: 'z = %z%: %fn%(z) = ?',
  sub: 'the probe sits %where%',
  where: { on: 'exactly on the boundary', off: 'off the boundary' },
  why: {
    heaviside: 'Slide 5: $\\mathrm{heaviside}(z)$ is 0 if $z < 0$ and 1 if $z \\ge 0$, so heaviside(%z%) = %a%.',
    sign: 'Slide 5: $\\mathrm{sign}(z)$ is −1 if $z < 0$, 0 if $z = 0$ and +1 if $z > 0$, so sign(%z%) = %a%.',
  },
  zeroNote: ' At $z = 0$ the two differ: heaviside gives 1, sign gives 0.',
  src: S(5),
};

/* ── level 2: the weighted sum and the output (slides 4–5) ─────────────── */
export const ZQ = {
  prompt: '$z = \\mathbf{w}^T\\mathbf{x} + b$ at the probe = ?',
  promptText: 'z = wᵀx + b at x = %x% = ?',
  sub: '$\\mathbf{w} = %wt%$, $b = %b%$, $\\mathbf{x} = %xt%$',
  why: 'Slide 4: $z = w_1x_1 + w_2x_2 + b = %expr% = %z%$.',
  src: S(4),
};

export const YHAT = {
  prompt: 'What does the TLU output at the probe? $\\hat{y}$ = ?',
  promptText: 'ŷ = heaviside(wᵀx + b) at x = %x% = ?',
  sub: '$\\mathbf{w} = %wt%$, $b = %b%$, $\\mathbf{x} = %xt%$',
  why: 'Slides 4–5: $z = %expr% = %z%$ and $\\mathrm{heaviside}(z)$ is %a% for $z %cmp% 0$, so $\\hat{y} = %a%$.%zero%',
  zeroNote: ' The probe sits on the boundary: heaviside(0) = 1.',
  src: S(4, 5),
};

/* ── level 2: the update by hand (slide 10) ────────────────────────────── */
export const UPD = {
  prompt: { shown: '$\\hat{y} = %yhat%$ for this point. $w_%i%^{(\\text{next step})}$ = ?', hidden: 'Read $\\hat{y}$ off the boundary. $w_%i%^{(\\text{next step})}$ = ?' },
  promptText: 'w = %w%, b = %b%, η = %eta%, x = %x%, y = %y%: w%isub% after the update = ?',
  sub: { shown: '$y = %y%$ · $\\eta = %eta%$', hidden: '$y = %y%$ · $\\eta = %eta%$ · $\\hat{y}$ hidden' },
  why: 'Slide 10: $w_%i% + \\eta(y - \\hat{y})x_%i% = %wi% + %etat% \\cdot (%y% - %yhat%) \\cdot %xit% = %ans%$.',
  whyHidden: ' Here $z = %expr% = %z%$, so $\\hat{y} = %yhat%$ (slides 4–5).',
  whyStay: ' The point is already on its correct side, so nothing moves (slide 9).',
  src: S(10),
};

/* ── level 2: concept checks between points (slides 9, 12–15) ──────────── */
export const CONCEPT_L2 = {
  a: [
    {
      id: 'hebb', concept: 'perceptron.hebb', kind: 'choice',
      prompt: 'How is a Perceptron fed while it trains?',
      choices: [
        { value: 'one', label: 'one training instance at a time' },
        { value: 'all', label: 'the whole training set at once, as one matrix' },
        { value: 'feature', label: 'one input feature at a time' },
      ],
      answer: 'one',
      why: 'Slide 9: the Perceptron is fed one training instance at a time and makes its predictions for each; for every output neuron that produced a wrong prediction, it reinforces the connection weights from the inputs that would have contributed to the correct prediction.',
      src: S(9),
    },
    {
      id: 'linear', concept: 'perceptron.boundary', kind: 'choice',
      prompt: 'Why is a Perceptron incapable of learning complex patterns?',
      choices: [
        { value: 'linear', label: 'the decision boundary of each output neuron is linear' },
        { value: 'oneAtATime', label: 'it is fed one training instance at a time' },
        { value: 'noBias', label: 'its TLUs have no bias term' },
      ],
      answer: 'linear',
      why: 'Slide 12: the decision boundary of each output neuron is linear, so Perceptrons (just like Logistic Regression classifiers) are incapable of learning complex patterns. (A TLU does have a bias $b$, slide 4.)',
      src: S(12),
    },
    {
      id: 'converge', concept: 'perceptron.boundary', kind: 'choice',
      prompt: 'The training instances are linearly separable. What does the Perceptron learning rule do?',
      choices: [
        { value: 'some', label: 'converges to a solution, generally not a unique one' },
        { value: 'unique', label: 'converges to the one unique separating boundary' },
        { value: 'never', label: 'never settles: the boundary keeps moving' },
      ],
      answer: 'some',
      why: 'Slide 12: if the training instances are linearly separable, Rosenblatt demonstrated that the algorithm converges to a solution (the Perceptron convergence theorem); the footnote adds that this solution is generally not unique.',
      src: S(12),
    },
  ],
  b: [
    {
      id: 'eta0', concept: 'perceptron.sklearn', kind: 'number',
      prompt: 'Scikit-Learn’s Perceptron = an SGDClassifier with loss="perceptron", learning_rate="constant", penalty=None and eta0 = ?',
      answer: 1,
      why: 'Slide 14: Scikit-Learn’s Perceptron class is equivalent to an SGDClassifier with loss="perceptron", learning_rate="constant", eta0=1 (the learning rate) and penalty=None (no regularization).',
      src: S(14),
    },
    {
      id: 'penalty', concept: 'perceptron.sklearn', kind: 'choice',
      prompt: 'In the SGDClassifier that equals Scikit-Learn’s Perceptron, what does penalty=None mean?',
      choices: [
        { value: 'noReg', label: 'no regularization' },
        { value: 'noLr', label: 'no learning rate' },
        { value: 'noBias', label: 'no bias term' },
      ],
      answer: 'noReg',
      why: 'Slide 14: the settings are loss="perceptron", learning_rate="constant", eta0=1 (the learning rate) and penalty=None (no regularization).',
      src: S(14),
    },
    {
      id: 'sklearnClass', concept: 'perceptron.sklearn', kind: 'choice',
      prompt: 'Scikit-Learn’s Perceptron class implements…',
      choices: [
        { value: 'tlu', label: 'a single TLU network' },
        { value: 'mlp', label: 'a Multi-Layer Perceptron' },
        { value: 'logreg', label: 'a Logistic Regression classifier' },
      ],
      answer: 'tlu',
      why: 'Slide 13: Scikit-Learn provides a Perceptron class that implements a single TLU network (the iris example draws its straight decision boundary).',
      src: S(13),
    },
    {
      id: 'noProba', concept: 'perceptron.vsLogistic', kind: 'choice',
      prompt: 'Contrary to a Logistic Regression classifier, a Perceptron…',
      choices: [
        { value: 'hard', label: 'outputs no class probability, just a hard-threshold prediction' },
        { value: 'proba', label: 'outputs a class probability' },
        { value: 'curved', label: 'has a curved decision boundary' },
      ],
      answer: 'hard',
      why: 'Slide 15: contrary to Logistic Regression classifiers, Perceptrons do not output a class probability; they just make predictions based on a hard threshold. This is one of the good reasons to prefer Logistic Regression over Perceptrons.',
      src: S(15),
    },
  ],
};

/* ── level 3: XOR and the MLP of Figure 10-6 (slides 16–17) ────────────── */
export const XOR = {
  // Figure 10-6a: (0, 1) and (1, 0) are one class, (0, 0) and (1, 1) the other; slide 17 says the
  // network outputs 1 for the first pair and 0 for the second, so they are y = 1 and y = 0 here.
  points: [
    { x: [0, 0], y: 0 },
    { x: [0, 1], y: 1 },
    { x: [1, 0], y: 1 },
    { x: [1, 1], y: 0 },
  ],
  // Figure 10-6b. W[i][j] is the weight from input x_{i+1} to hidden TLU j (0 = left, 1 = right);
  // b the hidden biases; v the output TLU's weights from (left, right); c its bias.
  net: { W: [[1, 1], [1, 1]], b: [-1.5, -0.5], v: [-1, 1], c: -0.5 },
  show: { W: [['1', '1'], ['1', '1']], b: ['−3/2', '−1/2'], v: ['−1', '1'], c: '−1/2' },
  showTex: { b: ['-\\tfrac{3}{2}', '-\\tfrac{1}{2}'], c: '-\\tfrac{1}{2}' },
  src: S(16, 17),
  // three single-TLU boundaries drawn on the XOR plot (pictures, not claims); the maths counts the
  // points each one gets wrong, and the check asserts every one gets at least one wrong
  tries: [
    { w: [1, 1], b: -0.5 },
    { w: [-1, -1], b: 1.5 },
    { w: [1, -1], b: -0.5 },
  ],
};

export const XOR_FIX = {
  prompt: 'Every single line gets an XOR point wrong. What now?',
  promptText: 'XOR: every single TLU boundary gets a point wrong. What now?',
  sub: '$(0, 1)$, $(1, 0)$: $y = 1$ · $(0, 0)$, $(1, 1)$: $y = 0$',
  choices: [
    { value: 'mlp', label: 'stack Perceptrons: add a hidden layer (an MLP)' },
    { value: 'keep', label: 'keep applying the learning rule: it converges' },
    { value: 'sign', label: 'swap heaviside for the sign function' },
    { value: 'logreg', label: 'switch to a Logistic Regression classifier' },
  ],
  answer: 'mlp',
  why: 'Slide 16: no single linear boundary solves XOR, and this is true of any linear classification model, Logistic Regression included. A sign-function TLU is still a Perceptron (slide 5), and a Perceptron’s decision boundary is linear (slide 12). Slide 17: stacking Perceptrons into a Multi-Layer Perceptron (MLP) solves it.',
  concept: 'perceptron.xor',
  src: S(5, 12, 16, 17),
};

/* Which values fill the blank so the network outputs XOR? Exactly one
   candidate per blank does (checked by tools/dl-arcade/check-boundary-bash.mjs). */
export const XOR_BLANKS = {
  hb: {
    prompt: 'Which hidden biases make this MLP output XOR?',
    promptText: 'Figure 10-6b with the hidden TLUs’ biases blank: which pair makes it output XOR?',
    what: 'the hidden TLUs’ biases',
    candidates: [
      { value: 'hb.slide', set: { b: [-1.5, -0.5] }, label: 'left −3/2 · right −1/2' },
      { value: 'hb.swap', set: { b: [-0.5, -1.5] }, label: 'left −1/2 · right −3/2' },
      { value: 'hb.half', set: { b: [-0.5, -0.5] }, label: 'left −1/2 · right −1/2' },
      { value: 'hb.three', set: { b: [-1.5, -1.5] }, label: 'left −3/2 · right −3/2' },
    ],
    answer: 'hb.slide',
    why: 'Figure 10-6b: the left hidden TLU has bias $-\\tfrac{3}{2}$ (it fires only for $(1, 1)$) and the right one $-\\tfrac{1}{2}$ (it fires for any input with a 1); the output $\\mathrm{step}(-h_1 + h_2 - \\tfrac{1}{2})$ then gives 0, 1, 1, 0 (slide 17).',
    src: S(17),
  },
  ov: {
    prompt: 'Which output weights make this MLP output XOR?',
    promptText: 'Figure 10-6b with the output TLU’s weights blank: which pair makes it output XOR?',
    what: 'the output TLU’s weights',
    candidates: [
      { value: 'ov.slide', set: { v: [-1, 1] }, label: 'from left −1 · from right 1' },
      { value: 'ov.plus', set: { v: [1, 1] }, label: 'from left 1 · from right 1' },
      { value: 'ov.flip', set: { v: [1, -1] }, label: 'from left 1 · from right −1' },
      { value: 'ov.minus', set: { v: [-1, -1] }, label: 'from left −1 · from right −1' },
    ],
    answer: 'ov.slide',
    why: 'Figure 10-6b: the output TLU takes $-1$ from the left hidden TLU and $1$ from the right one, so $\\mathrm{step}(-h_1 + h_2 - \\tfrac{1}{2})$ is 1 only when the right TLU fires and the left does not: inputs $(0, 1)$ and $(1, 0)$ (slide 17). With $1, 1$ it would also fire for $(1, 1)$.',
    src: S(17),
  },
  oc: {
    prompt: 'Which output bias makes this MLP output XOR?',
    promptText: 'Figure 10-6b with the output TLU’s bias blank: which value makes it output XOR?',
    what: 'the output TLU’s bias',
    candidates: [
      { value: 'oc.slide', set: { c: -0.5 }, label: '−1/2' },
      { value: 'oc.plus', set: { c: 0.5 }, label: '+1/2' },
      { value: 'oc.three', set: { c: -1.5 }, label: '−3/2' },
    ],
    answer: 'oc.slide',
    why: 'Figure 10-6b: the output bias is $-\\tfrac{1}{2}$. For $(0, 0)$ both hidden TLUs output 0, so the output is $\\mathrm{step}(-\\tfrac{1}{2}) = 0$; for $(0, 1)$ it is $\\mathrm{step}(1 - \\tfrac{1}{2}) = 1$ (slide 17). $+\\tfrac{1}{2}$ would fire on $(0, 0)$; $-\\tfrac{3}{2}$ would never fire.',
    src: S(17),
  },
};

/* Forward pass by hand through Figure 10-6b (slides 4, 5, 17). */
export const XOR_FWD = {
  z: {
    prompt: 'Input $(x_1, x_2) = (%x1%, %x2%)$. The %side% hidden TLU’s sum $z$ = ?',
    promptText: 'Figure 10-6b, input (%x1%, %x2%): the %side% hidden TLU’s weighted sum z = ?',
    sub: 'type −3/2 as −1.5',
    why: 'Figure 10-6b: both weights into the %side% hidden TLU are 1 and its bias is $%bt%$, so $z = 1 \\cdot %x1% + 1 \\cdot %x2% %bsigned% = %z%$ (slides 4, 17).',
  },
  h: {
    prompt: 'Input $(x_1, x_2) = (%x1%, %x2%)$. The %side% hidden TLU outputs $h_%k%$ = ?',
    promptText: 'Figure 10-6b, input (%x1%, %x2%): the %side% hidden TLU’s output = ?',
    sub: '0 or 1',
    why: 'The %side% hidden TLU computes $\\mathrm{step}(x_1 + x_2 %bsigned%) = \\mathrm{step}(%z%) = %h%$ (heaviside, slides 5 and 17).',
  },
  out: {
    prompt: 'Input $(x_1, x_2) = (%x1%, %x2%)$. The network outputs $\\hat{y}$ = ?',
    promptText: 'Figure 10-6b, input (%x1%, %x2%): the network’s output = ?',
    sub: '0 or 1 · run both hidden TLUs first',
    why: 'Hidden: $h_1 = \\mathrm{step}(%z1%) = %h1%$, $h_2 = \\mathrm{step}(%z2%) = %h2%$. Output: $\\mathrm{step}(-1 \\cdot %h1% + 1 \\cdot %h2% - \\tfrac{1}{2}) = %out%$, which is XOR of $(%x1%, %x2%)$ (slide 17).',
  },
  sides: ['left', 'right'],
  src: S(4, 5, 17),
};

export const CONCEPT_L3 = {
  a: [
    {
      id: 'who', concept: 'perceptron.xor', kind: 'choice',
      prompt: 'Whose 1969 monograph “Perceptrons” highlighted the XOR weakness?',
      choices: [
        { value: 'mp', label: 'Marvin Minsky and Seymour Papert' },
        { value: 'rosenblatt', label: 'Frank Rosenblatt' },
        { value: 'hebb', label: 'Donald Hebb' },
      ],
      answer: 'mp',
      why: 'Slide 16: Marvin Minsky and Seymour Papert’s 1969 monograph “Perceptrons” highlighted the weaknesses; Rosenblatt invented the Perceptron in 1957 (slide 4) and Hebb’s rule inspired its training (slide 9).',
      src: S(4, 9, 16),
    },
    {
      id: 'anyLinear', concept: 'perceptron.xor', kind: 'choice',
      prompt: 'Which other model also cannot solve XOR?',
      choices: [
        { value: 'logreg', label: 'a Logistic Regression classifier' },
        { value: 'mlp', label: 'the MLP of Figure 10-6b' },
        { value: 'none', label: 'none: only Perceptrons fail' },
      ],
      answer: 'logreg',
      why: 'Slide 16: the XOR weakness is true of any other linear classification model as well, such as Logistic Regression classifiers. Slide 17’s MLP does solve it.',
      src: S(16, 17),
    },
  ],
  b: [
    {
      id: 'converge', concept: 'perceptron.boundary', kind: 'choice',
      prompt: 'Why does the Perceptron convergence theorem not promise a solution on XOR?',
      choices: [
        { value: 'separable', label: 'XOR is not linearly separable, and the theorem covers only linearly separable data' },
        { value: 'eta', label: 'the learning rate η is too large' },
        { value: 'order', label: 'the instances arrive one at a time' },
      ],
      answer: 'separable',
      why: 'Slide 12: the Perceptron convergence theorem promises a solution only when the training instances are linearly separable, and slide 16’s XOR points are not: no single straight line puts both squares on one side and both triangles on the other. The theorem’s condition is on the data, not on the learning rate η or on feeding one instance at a time (slide 9).',
      src: S(9, 12, 16),
    },
    {
      id: 'stack', concept: 'mlp.xor', kind: 'choice',
      prompt: 'What is an ANN of stacked Perceptrons called?',
      choices: [
        { value: 'mlp', label: 'a Multi-Layer Perceptron (MLP)' },
        { value: 'tlu', label: 'a threshold logic unit (TLU)' },
        { value: 'dense', label: 'a dense layer' },
      ],
      answer: 'mlp',
      why: 'Slide 17: some limitations of Perceptrons can be eliminated by stacking multiple Perceptrons; the resulting ANN is called a Multi-Layer Perceptron (MLP). A TLU is one unit (slide 4); a dense layer is one fully connected layer (slide 6).',
      src: S(4, 6, 17),
    },
  ],
};

/* "Show the maths" drawer lines (the equations themselves come from
   content/lecture1.js EQUATIONS). */
export const MATHS = {
  rule: 'Slide 10’s rule (one TLU, so $w_{i,j}$ is $w_i$):',
  rule11: 'Slide 11 writes the same rule with the error flipped:',
  where: '$\\eta = %eta%$, $b = %b%$ (fixed), $\\hat{y} = \\mathrm{heaviside}(z)$ with $z = \\mathbf{w}^T\\mathbf{x} + b$ (slides 4–5).',
  tlu: 'Slide 4, the TLU:',
  step: 'Slide 5, the two step functions:',
  xor: 'Figure 10-6b (slide 17), with step = heaviside:',
  xorTex: [
    'h_1 = \\mathrm{step}(x_1 + x_2 - \\tfrac{3}{2}), \\quad h_2 = \\mathrm{step}(x_1 + x_2 - \\tfrac{1}{2})',
    '\\hat{y} = \\mathrm{step}(-h_1 + h_2 - \\tfrac{1}{2})',
  ],
  src: S(4, 5, 10, 11, 17),
};
