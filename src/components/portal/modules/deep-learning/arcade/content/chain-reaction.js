/* ============================================================================
   CHAIN REACTION — CONTENT (pure data, slide-cited; Lecture 1 only)
   ----------------------------------------------------------------------------
   Every label, prompt, why text and distractor the game shows, with the
   slides that state it. Templates use %name% placeholders, filled by
   maths/chainReaction.js (which also does all the arithmetic). Slides were
   read from Documents/cits5017/lectures/cits5017-lect01-IntroToANNs.pdf
   (slides 4, 5, 8, 11, 18–31, rendered at 110 dpi).

   What the slides print (and what they don't):
     slide 4    z = wᵀx + b, h = step(z)            slide 8   φ(XW + bᵀ)
     slide 11   ℒ_j = ½(ŷ_j − y_j)², ∂ℒ_j/∂w_{i,j} = (ŷ_j − y_j)x_i for a
                linear output, and w ← w − η ∂ℒ_j/∂w_{i,j} (handwritten)
     slide 19   backprop's four steps, IN WORDS ONLY
     slide 20   σ(z) = 1/(1 + exp(−z)) and σ′(z) = σ(z)(1 − σ(z))
     slide 21   tanh(z) = 2σ(2z) − 1, ReLU(z) = max(0, z)
     slide 22   Figure 10-8: the four activations and their derivatives as
                CURVES only
     slide 23   f(z) = 2z + 3, g(z) = 5z − 1, f(g(z)) = 10z + 1
     slides 24–31  regression / classification output layers and losses
   So: any chain-rule step through a hidden layer, and any tanh / ReLU
   derivative value, is `beyond: true` (quirks l1.backprop.wordsOnly and
   l1.derivatives.figureOnly in content/lecture1.js).
   ========================================================================== */

/* The game's own notation (names, not facts). */
export const NOTATION = {
  text: 'x₁, x₂ are the inputs; w_{i,j} is the weight from input i to hidden neuron j (slide 8’s W: one row per input feature, one column per neuron) and b_j its bias; z_j = x₁w_{1,j} + x₂w_{2,j} + b_j and h_j = φ(z_j). v₁, v₂ and c are this game’s names for the output neuron’s weights and bias: the slides do not name a second layer’s weights.',
  tex: 'z_j = x_1 w_{1,j} + x_2 w_{2,j} + b_j, \\qquad h_j = \\phi(z_j), \\qquad \\hat{y} = v_1 h_1 + v_2 h_2 + c',
  loss: 'The loss is slide 11’s ℒ = ½(ŷ − y)² and the output neuron has no activation (a regression output, slide 24).',
  lossTex: '\\mathcal{L} = \\tfrac{1}{2}\\left(\\hat{y} - y\\right)^2',
  src: { lecture: 1, slides: [4, 8, 11, 24] },
};

/* Activation functions as slides 5, 20 and 21 define them, and what
   Figure 10-8 (slide 22) shows of each curve and its derivative. */
export const ACTIVATIONS = {
  sigmoid: {
    label: 'Sigmoid',
    plain: 'σ',
    name: 'the logistic (sigmoid) function',
    sym: '\\sigma',
    tex: '\\sigma(z) = 1/(1 + \\exp(-z))',
    concept: 'act.sigmoid',
    src: { lecture: 1, slides: [20] },
    curve: 'the S shape that runs from 0 to 1 and passes through 0.5 at $z = 0$',
    deriv: 'the low bell that peaks at 0.25 at $z = 0$ and decays towards 0 at both ends',
    figSrc: { lecture: 1, slides: [20, 22] },
  },
  tanh: {
    label: 'Tanh',
    plain: 'tanh',
    name: 'the hyperbolic tangent',
    sym: '\\tanh',
    tex: '\\tanh(z) = 2\\sigma(2z) - 1',
    concept: 'act.tanh',
    src: { lecture: 1, slides: [21] },
    curve: 'a similar S shape to the logistic function (slide 21), but ranging from −1 to +1 and passing through 0 at $z = 0$',
    deriv: 'the taller, narrower bell that peaks at 1.0 at $z = 0$',
    figSrc: { lecture: 1, slides: [21, 22] },
  },
  relu: {
    label: 'ReLU',
    plain: 'ReLU',
    name: 'the rectified linear unit',
    sym: '\\mathrm{ReLU}',
    tex: '\\mathrm{ReLU}(z) = \\max(0, z)',
    concept: 'act.relu',
    src: { lecture: 1, slides: [21] },
    curve: '0 for negative $z$, then $z$ itself with slope 1: it has no maximum output value',
    deriv: '0 for $z < 0$ and 1 for $z > 0$, with the jump at $z = 0$ marked',
    figSrc: { lecture: 1, slides: [21, 22] },
  },
  heaviside: {
    label: 'Heaviside',
    plain: 'heaviside',
    name: 'the Heaviside step function',
    sym: '\\mathrm{heaviside}',
    tex: '\\mathrm{heaviside}(z) = 0 \\text{ if } z < 0,\\ 1 \\text{ if } z \\ge 0',
    concept: 'perceptron.step',
    src: { lecture: 1, slides: [5] },
    curve: 'a flat 0 for negative $z$ that jumps to 1 at $z = 0$',
    deriv: 'flat at 0 everywhere, with a marker at $z = 0$: the step function has no gradient to work with (slide 20)',
    figSrc: { lecture: 1, slides: [5, 20, 22] },
  },
};

/* "Which activation is this curve?" — Figure 10-8, slide 22 (both panels). */
export const CURVE_ID = {
  concept: 'act.derivatives',
  src: { lecture: 1, slides: [22] },
  options: ['heaviside', 'relu', 'sigmoid', 'tanh'],   // the figure's legend order
  act: {
    prompt: 'Figure 10-8, left panel. Which activation function is this curve?',
    promptText: 'Figure 10-8 (activation functions): which activation is this curve?',
    why: 'Figure 10-8 (slide 22): %label% is %curve%.',
    title: 'Activation functions',
  },
  deriv: {
    prompt: 'Figure 10-8, right panel. This is the derivative of which activation?',
    promptText: 'Figure 10-8 (derivatives): whose derivative is this curve?',
    why: 'Figure 10-8 (slide 22), right panel: the derivative of %label% is %deriv%. The figure shows these derivatives as curves only; slide 20 prints a formula for the sigmoid’s alone.',
    title: 'Derivatives',
  },
};

/* Slide 19's four steps, in the slide's words (FACTS l1.backprop.*). */
export const STEPS = {
  concept: 'backprop.algorithm',
  src: { lecture: 1, slides: [19] },
  list: [
    { id: 'forward', label: 'forward pass', text: 'feed the instance to the network and compute the output of every neuron in each layer' },
    { id: 'error', label: 'measure the output error', text: 'measure the network’s output error, the difference between the desired output and the actual output of the network' },
    { id: 'reverse', label: 'reverse pass', text: 'go through each layer in reverse order to measure the error contribution from each connection, until the input layer is reached' },
    { id: 'gd', label: 'Gradient Descent step', text: 'slightly tweak the connection weights to reduce the error' },
  ],
  order: {
    prompt: 'Slide 19: for each training instance, backpropagation runs four steps. Tap them in order.',
    promptText: 'Put slide 19’s four backpropagation steps in order',
    why: 'Slide 19: backpropagation is Gradient Descent using reverse-mode autodiff. For each training instance it does the forward pass, measures the output error, does the reverse pass to the input layer, then takes the Gradient Descent step.',
  },
  which: {
    prompt: 'The graph is running one of slide 19’s four steps. Which one?',
    promptText: 'Which of slide 19’s backpropagation steps is the graph showing?',
    // what each scene shows (aria text for the picture, and the why card)
    scene: {
      forward: 'Signals flow from the inputs through the hidden layer to ŷ, and every neuron’s output appears.',
      error: 'The output ŷ is compared with the target y and the gap ŷ − y is measured.',
      reverse: 'Gradients flow backwards from the output, layer by layer, towards the inputs.',
      gd: 'Each connection weight is nudged a little against its gradient (slide 11’s w ← w − η ∂ℒ/∂w).',
    },
    why: 'The graph shows this: %scene% On slide 19 that step is “%label%”: %text%.',
  },
};

/* Prompts, why texts and maths-drawer lines for the graph items.
   $…$ is KaTeX. Every template names its slide; `beyond` ones say so. */
export const T = {
  z: {
    concept: 'perceptron.tlu',
    src: { lecture: 1, slides: [4, 8] },
    prompt: 'Hidden neuron %j%: compute its weighted sum $z_%j% = x_1 w_{1,%j%} + x_2 w_{2,%j%} + b_%j%$.',
    promptText: 'z%J% = x₁w₁,%J% + x₂w₂,%J% + b%J% with %givens%',
    why: 'Slide 4: a neuron computes the weighted sum of its inputs plus its bias, $z = \\mathbf{w}^T\\mathbf{x} + b$ (slide 8 does a whole layer at once). Here $z_%j% = %expr% = %ans%$.',
    sub: 'exact · %receipt%',
    maths: [{ eq: 'tluSum', idx: 0 }, { tex: 'z_%j% = %expr%' }],
  },
  h: {
    // concept and src come from ACTIVATIONS[act]
    prompt: 'Now the activation: $h_%j% = %sym%(z_%j%)$ with $z_%j% = %z%$.',
    promptText: 'h%J% = %name%(z%J%) with z%J% = %zt%',
    whySigmoid: 'Slide 20: $\\sigma(z) = 1/(1 + \\exp(-z))$, so $h_%j% = \\sigma(%z%) = 1/(1 + \\exp(%negz%)) = %ans%$ (to 2 decimals).',
    whyTanh: 'Slide 21: $\\tanh(z) = 2\\sigma(2z) - 1$, so $h_%j% = \\tanh(%z%) = 2\\sigma(%twoz%) - 1 = %ans%$ (to 2 decimals).',
    whyRelu: 'Slide 21: $\\mathrm{ReLU}(z) = \\max(0, z)$, so $h_%j% = \\max(0, %z%) = %ans%$.',
    subCurve: 'to 2 decimals, ±%tol% (read it off the curve) · %receipt%',
    subExact: 'exact · %receipt%',
    maths: [{ tex: '%deftex%' }, { tex: 'h_%j% = %sym%(%z%)' }],
  },
  yhat: {
    concept: 'backprop.algorithm',
    src: { lecture: 1, slides: [19, 24] },
    prompt: 'The output neuron: $\\hat{y} = v_1 h_1 + v_2 h_2 + c$ (no activation: a regression output).',
    promptText: 'ŷ = v₁h₁ + v₂h₂ + c with %givens%',
    why: 'The forward pass (slide 19) computes every neuron’s output, layer by layer. A regression output neuron usually needs no activation (slide 24), so $\\hat{y} = %expr% = %ans%$.',
    sub: 'to 2 decimals, ±%tol% · %receipt%',
    maths: [{ text: 'This game’s names: $v_1, v_2$ and $c$ are the output neuron’s weights and bias (the slides do not name a second layer’s weights).' }, { tex: '\\hat{y} = %expr%' }],
  },
  error: {
    concept: 'backprop.algorithm',
    src: { lecture: 1, slides: [11, 19] },
    prompt: 'Measure the output error: $\\hat{y} - y$.',
    promptText: 'Output error ŷ − y with ŷ = %yhat%, y = %y%',
    why: 'Slide 19: the output error is the difference between the desired output and the actual output. Slide 11’s loss $\\mathcal{L} = \\tfrac{1}{2}(\\hat{y} - y)^2$ writes it in the order $\\hat{y} - y$ (slide 10’s rule uses $y - \\hat{y}$ with a plus sign: the same rule), and it enters every gradient as that factor: $%yhat% - %yp% = %ans%$.',
    sub: 'exact · %receipt%',
    maths: [{ eq: 'perceptronLoss', idx: 0 }, { tex: '\\hat{y} - y = %yhat% - %yp%' }],
  },
  dv: {
    concept: 'perceptron.ruleGradient',
    src: { lecture: 1, slides: [11] },
    prompt: 'The gradient for the output weight $v_%k%$: $\\partial\\mathcal{L}/\\partial v_%k%$.',
    promptText: '∂ℒ/∂v%K% with ŷ − y = %e%, h%K% = %h%',
    why: 'Slide 11: for a linear output, $\\partial\\mathcal{L}_j/\\partial w_{i,j} = (\\hat{y}_j - y_j)\\,x_i$, the error times the input on that connection. The input on $v_%k%$’s connection is $h_%k%$: $(\\hat{y} - y)\\,h_%k% = %ep% \\times %hp% = %ans%$.',
    sub: 'to 2 decimals, ±%tol% · %receipt%',
    maths: [{ eq: 'perceptronGradient', idx: 2 }, { text: 'The output neuron is linear and its input on this connection is $h_%k%$ (slide 11’s $x_i$).' }, { tex: '\\partial\\mathcal{L}/\\partial v_%k% = %ep% \\times %hp%' }],
  },
  dsig: {
    concept: 'act.sigmoid',
    src: { lecture: 1, slides: [20, 22] },
    prompt: 'The sigmoid’s slope at hidden neuron %k%: $\\sigma\'(z_%k%)$, where $\\sigma(z_%k%) = h_%k% = %h%$.',
    promptText: 'σ′(z%K%) with σ(z%K%) = h%K% = %h%',
    why: 'Slide 20: $\\sigma\'(z) = \\sigma(z)(1 - \\sigma(z))$. With $\\sigma(z_%k%) = %h%$: $%h% \\times (1 - %h%) = %h% \\times %omh% = %ans%$ (to 2 decimals). It peaks at 0.25 at $z = 0$ (Figure 10-8).',
    sub: 'to 2 decimals, ±%tol% · %receipt%',
    maths: [{ eq: 'sigmoidDerivative', idx: 1 }, { tex: '\\sigma\'(z_%k%) = %h% \\times (1 - %h%)' }],
  },
  dz: {
    concept: 'backprop.algorithm',
    src: { lecture: 1, slides: [19, 20] },
    beyond: true,
    note: 'Slide 19 describes the reverse pass in words only; the chain-rule product through a hidden neuron is standard calculus, not printed in the deck.',
    prompt: 'Reverse pass into hidden neuron %k%: $\\partial\\mathcal{L}/\\partial z_%k% = (\\hat{y} - y)\\,v_%k%\\,\\sigma\'(z_%k%)$.',
    promptText: '∂ℒ/∂z%K% = (ŷ − y)·v%K%·σ′(z%K%) with ŷ − y = %e%, v%K% = %v%, σ′(z%K%) = %d%',
    why: 'Beyond the slides (slide 19 gives the reverse pass in words only): by the chain rule the error reaches $z_%k%$ through $v_%k%$ and the sigmoid’s slope (slide 20), $\\partial\\mathcal{L}/\\partial z_%k% = (\\hat{y} - y)\\,v_%k%\\,\\sigma\'(z_%k%) = %ep% \\times %vp% \\times %dp% = %ans%$.',
    sub: 'to 2 decimals, ±%tol% · %receipt% · beyond the slides',
    maths: [
      { text: 'Beyond the slides: the chain rule (slide 19 states the reverse pass in words only).' },
      { tex: '\\frac{\\partial\\mathcal{L}}{\\partial z_%k%} = \\frac{\\partial\\mathcal{L}}{\\partial \\hat{y}}\\,\\frac{\\partial \\hat{y}}{\\partial h_%k%}\\,\\frac{\\partial h_%k%}{\\partial z_%k%} = (\\hat{y} - y)\\,v_%k%\\,\\sigma\'(z_%k%)' },
      { tex: '= %ep% \\times %vp% \\times %dp%' },
    ],
  },
  dw: {
    concept: 'backprop.algorithm',
    src: { lecture: 1, slides: [11, 19] },
    beyond: true,
    note: 'The last chain-rule step mirrors slide 11’s ∂ŷ_j/∂w_{i,j} = x_i, but applying it to a hidden weight through ∂ℒ/∂z is not printed in the deck.',
    prompt: 'Down to a first-layer weight: $\\partial\\mathcal{L}/\\partial w_{%i%,%k%} = \\dfrac{\\partial\\mathcal{L}}{\\partial z_%k%}\\,x_%i%$.',
    promptText: '∂ℒ/∂w%I%,%K% = (∂ℒ/∂z%K%)·x%I% with ∂ℒ/∂z%K% = %g%, x%I% = %x%',
    why: 'Beyond the slides: one more chain-rule step. $z_%k%$ is linear in $w_{%i%,%k%}$ with slope $x_%i%$ (as in slide 11’s $\\partial\\hat{y}_j/\\partial w_{i,j} = x_i$), so $\\partial\\mathcal{L}/\\partial w_{%i%,%k%} = %gp% \\times %xp% = %ans%$.',
    sub: 'to 2 decimals, ±%tol% · %receipt% · beyond the slides',
    maths: [
      { text: 'Beyond the slides: one more chain-rule step.' },
      { tex: '\\frac{\\partial\\mathcal{L}}{\\partial w_{%i%,%k%}} = \\frac{\\partial\\mathcal{L}}{\\partial z_%k%}\\,\\frac{\\partial z_%k%}{\\partial w_{%i%,%k%}} = \\frac{\\partial\\mathcal{L}}{\\partial z_%k%}\\,x_%i%' },
      { tex: '= %gp% \\times %xp%' },
    ],
  },
  update: {
    concept: 'perceptron.ruleGradient',
    src: { lecture: 1, slides: [11, 19] },
    prompt: 'The Gradient Descent step for $%p%$ with $\\eta = %eta%$: $%p% \\leftarrow %p% - \\eta\\,\\partial\\mathcal{L}/\\partial %p%$.',
    promptText: 'Gradient Descent step: new %pt% with %pt% = %w%, ∂ℒ/∂%pt% = %g%, η = %eta%',
    why: 'Slide 11’s update: $w^{(\\text{next step})} = w - \\eta\\,\\partial\\mathcal{L}/\\partial w$, the negative error gradient scaled by the learning rate; slide 19 calls this the Gradient Descent step. $%w% - %eta% \\times %gp% = %ans%$.',
    sub: 'to 2 decimals, ±%tol% · %receipt%',
    maths: [{ eq: 'gradientStep', idx: 0 }, { tex: '%p% \\leftarrow %w% - %eta% \\times %gp%' }],
  },
  // L3: one reverse step through a tanh or ReLU hidden neuron (derivative beyond the slides)
  dzOther: {
    concept: 'backprop.algorithm',
    src: { lecture: 1, slides: [19, 22] },
    beyond: true,
    tanh: {
      note: 'tanh′(z) = 1 − tanh²(z) is standard; the deck shows the tanh derivative only as a curve (Figure 10-8), and the chain rule is not printed.',
      prompt: 'Reverse pass through a tanh neuron: $\\partial\\mathcal{L}/\\partial z_%k% = (\\hat{y} - y)\\,v_%k%\\,(1 - h_%k%^2)$.',
      promptText: '∂ℒ/∂z%K% through tanh with ŷ − y = %e%, v%K% = %v%, h%K% = tanh(z%K%) = %h%',
      why: 'Beyond the slides: $\\tanh\'(z) = 1 - \\tanh^2(z)$ (Figure 10-8 shows only its curve, peaking at 1.0 at $z = 0$), and the chain rule gives $(\\hat{y} - y)\\,v_%k%\\,(1 - \\tanh^2 z_%k%)$. Graded from the exact $z_%k% = %z%$: $%ep% \\times %vp% \\times (1 - \\tanh^2(%z%)) = %ans%$. From the shown $h_%k%$ (2 decimals): $%ep% \\times %vp% \\times (1 - %hp%^2) = %ansh%$. The ±%tol% tolerance accepts both ways of working.',
      maths: [{ text: 'Beyond the slides: $\\tanh\'(z) = 1 - \\tanh^2(z)$, then the chain rule.' }, { tex: '\\partial\\mathcal{L}/\\partial z_%k% = %ep% \\times %vp% \\times (1 - %hp%^2)' }],
    },
    relu: {
      note: 'ReLU′ = 0 for z < 0 and 1 for z > 0 is the step in Figure 10-8’s right panel; the deck prints no formula for it, and the chain rule is not printed.',
      prompt: 'Reverse pass through a ReLU neuron: $\\partial\\mathcal{L}/\\partial z_%k% = (\\hat{y} - y)\\,v_%k%\\,\\mathrm{ReLU}\'(z_%k%)$ with $z_%k% = %z%$.',
      promptText: '∂ℒ/∂z%K% through ReLU with ŷ − y = %e%, v%K% = %v%, z%K% = %zt%',
      why: 'Beyond the slides: the ReLU derivative is 0 for $z < 0$ and 1 for $z > 0$ (the step in Figure 10-8), so with $z_%k% = %z%$ it is %d%, and $(\\hat{y} - y)\\,v_%k% \\times %d% = %ep% \\times %vp% \\times %d% = %ans%$.',
      maths: [{ text: 'Beyond the slides: ReLU′ is 0 for $z < 0$ and 1 for $z > 0$ (Figure 10-8 draws the step), then the chain rule.' }, { tex: '\\partial\\mathcal{L}/\\partial z_%k% = %ep% \\times %vp% \\times \\mathrm{ReLU}\'(%z%)' }],
    },
    sub: 'to 2 decimals, ±%tol% · %receipt% · beyond the slides',
  },
};

/* Slide 23: why we need activation functions. */
export const COLLAPSE = {
  concept: 'act.why',
  src: { lecture: 1, slides: [23] },
  slideExample: [{ name: 'g', a: 5, b: -1 }, { name: 'f', a: 2, b: 3 }],   // applied g first, then f
  names2: ['g', 'f'],
  names3: ['k', 'g', 'f'],
  slope: {
    prompt: 'Remove the activation between the layers. The stack collapses to one linear layer $%comp% = a z + b$. What is the slope $a$?',
    promptText: 'Remove the activations: %defs%. Slope of %compt%?',
    why: 'Slide 23: chaining linear layers gives a linear function, %chain%. With no nonlinearity between layers even a deep stack is equivalent to a single layer. The slope is the product of the slopes: $%prod% = %ans%$.',
  },
  intercept: {
    prompt: 'Same collapsed layer, slope $%a%$. What is the intercept $b$?',
    promptText: 'Remove the activations: %defs%. Intercept of %compt%?',
    why: 'Slide 23: substitute layer into layer, %chain%. The intercept is what is left at $z = 0$: $%calc% = %ans%$.',
  },
  sub: 'exact · %receipt%',
  removed: 'activation removed',
  maths: [
    { text: 'Slide 23: two linear layers $f(z) = 2z + 3$ and $g(z) = 5z - 1$ chain to $f(g(z)) = 2(5z - 1) + 3 = 10z + 1$, which is linear.' },
    { tex: '%defsTex%' },
    { tex: '%comp% = %subst%' },
  ],
};

/* Level 3 task cards: slides 24 and 27 (regression), 29 and 31 (classification). */
export const HEAD = {
  neurons: [1, 2, 3, 10],
  acts: [
    { id: 'none', label: 'None' },
    { id: 'relu', label: 'ReLU' },
    { id: 'softplus', label: 'softplus' },
    { id: 'sigmoid', label: 'Sigmoid' },
    { id: 'tanh', label: 'tanh' },
    { id: 'softmax', label: 'Softmax' },
  ],
  losses: [
    { id: 'mse', label: 'MSE' },
    { id: 'huber', label: 'Huber' },
    { id: 'xent', label: 'X-entropy' },
  ],
  rows: { neurons: 'output neurons', act: 'output activation', loss: 'loss' },
  prompt: 'Build the output layer for this task: neurons, activation, loss.',
  promptText: 'Output layer for: %kicker% · %text%',
  sub: '%receipt%',
};

export const TASKS = [
  {
    id: 'reg.one', type: 'regression', kicker: 'Regression', text: 'Predict one real value per instance; it can be any number.',
    neurons: 1, act: ['none'], loss: ['mse'], concept: 'mlp.regression', src: { lecture: 1, slides: [24, 27] },
    why: 'Slide 24: for regression the output neurons usually do not need an activation function. Slide 27’s table: 1 output neuron per prediction dimension, loss MSE. The table keeps Huber for a training set with outliers, and this one has none.',
  },
  {
    id: 'reg.multi', type: 'regression', kicker: 'Multivariate regression', text: 'Predict %k% real values per instance, each any number.',
    neurons: 'k', ks: [2, 3], act: ['none'], loss: ['mse'], concept: 'mlp.regression', src: { lecture: 1, slides: [24, 27] },
    why: 'Slide 24: multivariate regression needs multiple output neurons; slide 27: 1 output neuron per prediction dimension (here %k%), no output activation, loss MSE. Slide 27’s table keeps Huber for a training set with outliers, and this one has none.',
  },
  {
    id: 'reg.positive', type: 'regression', kicker: 'Regression', text: 'Predict one value that must always be positive.',
    neurons: 1, act: ['relu', 'softplus'], loss: ['mse'], concept: 'mlp.regression', src: { lecture: 1, slides: [24, 27] },
    why: 'Slide 24: when the output must always be positive, use the ReLU or softplus$(z) = \\log(1 + \\exp(z))$ activation. Slide 27: 1 output neuron, loss MSE (the table keeps Huber for a training set with outliers, and this one has none).',
  },
  {
    id: 'reg.bounded', type: 'regression', kicker: 'Regression', text: 'Predict one value that must lie in a certain range of values.',
    neurons: 1, act: ['sigmoid', 'tanh'], loss: ['mse'], concept: 'mlp.regression', src: { lecture: 1, slides: [24, 27] },
    why: 'Slide 24: when the output must be in a certain range, use the logistic or hyperbolic tangent and then scale the value to the required range (slide 27: sigmoid/tanh if bounded outputs). 1 output neuron, loss MSE (slide 27’s table keeps Huber for a training set with outliers, and this one has none).',
  },
  {
    id: 'reg.outliers', type: 'regression', kicker: 'Regression', text: 'Predict one real value per instance (any number); the training set has outliers.',
    neurons: 1, act: ['none'], loss: ['huber'], concept: 'mlp.regression', src: { lecture: 1, slides: [24, 27] },
    why: 'Slide 27’s table: loss MSE, or Huber if outliers (the Huber loss combines MSE and MAE). Slide 24: no output activation for an unconstrained value; 1 output neuron.',
  },
  {
    id: 'cls.binary', type: 'binary', kicker: 'Binary classification', text: 'One yes/no answer per instance.',
    neurons: 1, act: ['sigmoid'], loss: ['xent'], concept: 'mlp.classification', src: { lecture: 1, slides: [29, 31] },
    why: 'Slide 29: for binary classification one single output neuron with a logistic activation is sufficient. Slide 31: 1 output neuron, Sigmoid, X-entropy.',
  },
  {
    id: 'cls.multilabel', type: 'multilabel', kicker: 'Multilabel binary classification', text: '%k% binary labels per instance, each yes or no.',
    neurons: 'k', ks: [2, 3], act: ['sigmoid'], loss: ['xent'], concept: 'mlp.classification', src: { lecture: 1, slides: [29, 31] },
    why: 'Slide 29: multilabel classification uses multiple output neurons, each with a logistic activation. Slide 31: 1 output neuron per binary label (here %k%), Sigmoid, X-entropy.',
  },
  {
    id: 'cls.multiclass', type: 'multiclass', kicker: 'Multiclass classification', text: 'Sort each instance into one of %k% classes (as MNIST has K = 10).',
    neurons: 'k', ks: [3, 10], act: ['softmax'], loss: ['xent'], concept: 'mlp.classification', src: { lecture: 1, slides: [29, 30, 31] },
    why: 'Slide 29: multiclass classification uses multiple output neurons with the softmax activation, so the outputs are probabilities that sum to 1; the loss is the cross-entropy (log loss). Slide 31: 1 output neuron per class (here %k%), Softmax, X-entropy.',
  },
];

/* Game tuning (rules of play, not slide facts). */
export const TUNING = {
  // tanh: L3's reverse step is graded from the exact z; 0.04 also accepts working from the 2-decimal h
  tol: { exact: 0.01, curve: 0.05, product: 0.01, chain: 0.02, tanh: 0.04 },
  eta: [0.1, 0.5],
  // level 2's per-item fuse: a share of the round clock, clamped (ms)
  fuse: { share: 0.22, minMs: 9000, maxMs: 15000, untimedMs: 15000 },
};

/* The RoundShell intro, per level. */
export const INTRO = {
  1: {
    line: 'Light the forward pass, node by node.',
    controls: [
      'Type each value on the keypad (digits, . and ±, Enter). The prompt states the tolerance.',
      'Then name the activation from its curve (keys 1–4) and collapse a stack with no activations.',
      'Show the maths opens the slide’s equation with this item’s numbers.',
    ],
  },
  2: {
    line: 'Fill the gradients backwards before the fuse burns out.',
    controls: [
      'Each item has a fuse; when it burns out the item counts as missed. The round clock still rules.',
      'Keypad for numbers (digits, . and ±, Enter); keys 1–4 for choices; to order steps tap them (or 1–4), Backspace undoes, Enter submits.',
      'Receipts marked “beyond the slides” are standard calculus the deck does not print (slide 19 gives backprop in words only).',
    ],
  },
  3: {
    line: 'Pick the output layer and loss for each task, and collapse deeper stacks.',
    controls: [
      'Task cards: tap one chip per row (neurons, activation, loss), then Build or Enter.',
      'Keypad for numbers (digits, . and ±, Enter); keys 1–4 for choices.',
      'The tables on slides 27 (regression) and 31 (classification) are the answer key.',
    ],
  },
};

export const LABELS = {
  fuse: 'fuse',
  ledger: 'reverse pass',
  forward: 'forward pass',
  target: 'y',
  build: 'Build',
  undo: 'Undo',
  submitOrder: 'Enter',
  orderEmpty: 'tap the steps in order',
  beyondDot: 'beyond the slides',
};
