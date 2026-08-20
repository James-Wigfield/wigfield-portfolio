/* ============================================================================
   DEEP LEARNING — LECTURE 2 QUIZ DATA
   ----------------------------------------------------------------------------
   Twenty questions built strictly from the slide content (1–10 cover the
   first half of the deck, 11–20 the optimizers/schedules/regularization
   half). Kept out of labs2.jsx so the page shell can show a live score on
   the Quiz tab (and so the data file stays react-refresh-clean).
   ========================================================================== */

export const QUIZ = [
  {
    q: 'The vanishing gradients problem means…',
    opts: [
      'gradients get smaller and smaller toward the lower layers, whose weights barely change',
      'gradients grow without bound as training progresses',
      'the loss becomes exactly zero',
      'weights are initialized too small to ever update',
    ],
    ans: 0,
    why: 'Gradients shrink as the algorithm progresses down to the lower layers, so Gradient Descent leaves the lower layers’ connection weights virtually unchanged — training never converges to a good solution or converges extremely slowly. The opposite case is exploding gradients.',
    slide: 5,
  },
  {
    q: 'Glorot & Bengio (2010) traced the problem to the combination of…',
    opts: [
      'the logistic sigmoid activation and the N(0, 1) weight initialization popular at the time',
      'too-large learning rates and small batches',
      'too many parameters and too little data',
      'ReLU activations and Glorot initialization',
    ],
    ans: 0,
    why: 'The popular logistic sigmoid + the era’s weight-init technique (normal, mean 0, σ = 1) made each layer’s output variance much greater than its input variance, driving the sigmoid into saturation where its derivative is ≈ 0.',
    slide: 5,
  },
  {
    q: 'Glorot initialization with a normal distribution uses variance…',
    opts: ['σ² = 1 / fan_avg', 'σ² = 2 / fan_in', 'σ² = 1 / fan_in', 'σ² = 3 / fan_avg'],
    ans: 0,
    why: 'Glorot: σ² = 1/fan_avg (uniform variant: r = √(3/fan_avg)). He init uses 2/fan_in for the ReLU family; LeCun uses 1/fan_in for SELU.',
    slide: 7,
  },
  {
    q: 'You add tf.keras.layers.Dense(100, activation="relu"). Which kernel_initializer matches Table 11-1?',
    opts: ['"he_normal"', '"glorot_uniform"', '"lecun_normal"', '"zeros"'],
    ans: 0,
    why: 'ReLU (and leaky ReLU, ELU, GELU, Swish, Mish) pair with He initialization. Keras defaults to Glorot with a uniform distribution, so you must set it yourself.',
    slide: 9,
  },
  {
    q: 'A “dead” ReLU neuron is one that…',
    opts: [
      'stops outputting anything other than 0, because its input is negative',
      'outputs its input unchanged',
      'saturates at 1',
      'has an exploding weight vector',
    ],
    ans: 0,
    why: 'During training some neurons effectively die: when the weighted sum feeding ReLU is negative, the output — and the gradient through it — is 0, so the neuron may never recover.',
    slide: 10,
  },
  {
    q: 'Which group of activations is smooth (derivative continuous at z = 0)?',
    opts: [
      'ELU, SELU, GELU, Swish, Mish',
      'ReLU, leaky ReLU, RReLU, PReLU',
      'ReLU and sigmoid only',
      'None of them — all kink at 0',
    ],
    ans: 0,
    why: 'ReLU, leaky ReLU, RReLU and PReLU are not smooth — their derivatives jump at z = 0. ELU (α = 1), SELU, GELU, Swish and Mish are the smooth variants.',
    slide: 14,
  },
  {
    q: 'Which of these is NOT one of SELU’s self-normalizing constraints?',
    opts: [
      'hidden weights use He initialization',
      'input features are standardized (mean 0, std 1)',
      'hidden weights use LeCun normal initialization',
      'no ℓ1/ℓ2 regularization, max-norm, batch-norm or dropout',
    ],
    ans: 0,
    why: 'SELU wants LeCun normal initialization — not He. The three real constraints: standardized inputs, LeCun normal init, and no ℓ1/ℓ2/max-norm/batch-norm/dropout. The constraints are why SELU never gained much traction.',
    slide: 16,
  },
  {
    q: 'In a BatchNormalization layer, which parameters are trainable?',
    opts: [
      'γ (scale) and β (shift) — the moving mean and variance are not',
      'the moving mean and moving variance',
      'all four vectors',
      'none — BN has no parameters',
    ],
    ans: 0,
    why: 'γ and β are learned with the connection weights; the per-feature moving mean and variance are estimated over minibatches during training and only used at test time. That is why model.summary() shows 2,368 non-trainable parameters: (784 + 300 + 100) × 2.',
    slide: 27,
  },
  {
    q: 'clipnorm=1.0 differs from clipvalue=1.0 in that it…',
    opts: [
      'rescales the whole gradient vector, preserving its orientation',
      'clips each component independently, preserving orientation',
      'only applies to recurrent networks',
      'clips the loss rather than the gradient',
    ],
    ans: 0,
    why: 'clipvalue clamps every component to [−1, 1], which can change the gradient’s direction; clipnorm rescales the whole vector so it never exceeds norm 1, retaining the orientation.',
    slide: 29,
  },
  {
    q: 'Transfer learning tends to work best with…',
    opts: [
      'deep convolutional networks — not small dense networks',
      'small dense networks — not convolutional ones',
      'any architecture equally',
      'untrained networks',
    ],
    ans: 0,
    why: 'The slide-32 result (93.85% vs 91.85%, ≈25% relative error reduction) took many trials of configuration; in general transfer learning does not work well with small dense networks but works well with deep CNNs.',
    slide: 32,
  },
  {
    q: 'In momentum optimization, the gradient is used as…',
    opts: [
      'a speed term added directly to θ',
      'an acceleration term feeding the momentum vector m',
      'a replacement for the learning rate η',
      'a bias-correction factor',
    ],
    ans: 1,
    why: 'm ← βm − η∇J(θ), then θ ← θ + m: the gradient accelerates a decaying velocity instead of moving θ directly. β < 1 (usually 0.9); the algorithm can roll past local optima and almost always beats plain GD.',
    slide: 34,
  },
  {
    q: 'Nesterov accelerated gradient differs from plain momentum by measuring the gradient at…',
    opts: [
      'the current position θ',
      'the previous position',
      'the look-ahead point θ + βm',
      'the origin',
    ],
    ans: 2,
    why: 'm generally already points toward the optimum, so evaluating ∇J slightly ahead at θ + βm makes the update land slightly closer to it (Figure 11-7). In Keras: SGD(…, momentum=0.9, nesterov=True).',
    slide: 36,
  },
  {
    q: 'Why should you NOT use AdaGrad to train deep neural networks?',
    opts: [
      'it frequently stops too early — the learning rate gets scaled down so much that training halts before the optimum',
      'it has no Keras implementation',
      'it explodes the gradients',
      'it only works with sigmoid activations',
    ],
    ans: 0,
    why: 'AdaGrad accumulates ALL past squared gradients in s, so the effective learning rate keeps shrinking. Fine for simpler tasks like linear regression, but for DNNs it often stops entirely before reaching the optimum.',
    slide: 40,
  },
  {
    q: 'RMSProp fixes AdaGrad by…',
    opts: [
      'removing the square root',
      'accumulating only the most recent squared gradients, via a decay rate ρ (typically 0.9)',
      'clipping the gradients',
      'adding a bias-correction step',
    ],
    ans: 1,
    why: 's ← ρs + (1−ρ)∇J⊗∇J: old gradients decay away instead of piling up, so the step size never collapses. It was the preferred optimizer of many researchers until Adam arrived.',
    slide: 41,
  },
  {
    q: 'Adam combines the ideas of…',
    opts: [
      'momentum optimization and RMSProp',
      'NAG and gradient clipping',
      'AdaGrad and batch normalization',
      'ℓ2 regularization and dropout',
    ],
    ans: 0,
    why: 'β₁ corresponds to momentum’s β (default 0.9) and β₂ to RMSProp’s ρ (default 0.999), plus bias corrections since m and s start near zero. Being adaptive, η = 0.001 often just works.',
    slide: 43,
  },
  {
    q: 'AdamW extends Adam by integrating…',
    opts: [
      'Nesterov momentum',
      'a max instead of a sum in step 2',
      'weight decay — multiplying the weights by a decay factor each iteration',
      'gradient clipping',
    ],
    ans: 2,
    why: 'AdamW adds the regularization technique called weight decay: the model’s weights shrink at each training iteration by a factor such as 0.99. (The max-of-step-2 variant is AdaMax; Adam + Nesterov is Nadam.)',
    slide: 45,
  },
  {
    q: 'Exponential scheduling η(t) = η₀·r^(t/s) means the learning rate…',
    opts: [
      'drops by a factor of r every s steps',
      'drops by s every r steps',
      'grows by r every s steps',
      'is constant for s steps, then zero',
    ],
    ans: 0,
    why: 'With r = 0.1 and s = 15: η(15) = 0.1·η₀, η(30) = 0.01·η₀, and so on. Keras: tf.keras.optimizers.schedules.ExponentialDecay (power scheduling is the InverseTimeDecay cousin: η₀/(1+rt/s)^c).',
    slide: 52,
  },
  {
    q: 'ReduceLROnPlateau(factor=0.5, patience=5) will…',
    opts: [
      'halve the learning rate every 5 epochs no matter what',
      'multiply the learning rate by 0.5 whenever the best validation loss doesn’t improve for 5 consecutive epochs',
      'stop training after 5 bad epochs',
      'double the learning rate on plateaus',
    ],
    ans: 1,
    why: 'That is performance scheduling: measure the validation error and cut η by the factor when it stops dropping — in the slide-58 run, the val loss immediately fell to a new lower plateau after the cut at epoch ≈17.',
    slide: 57,
  },
  {
    q: 'During training, dropout with rate p applies to…',
    opts: [
      'every neuron including the outputs',
      'only the hidden neurons',
      'every neuron including the inputs but excluding the outputs',
      'only the input neurons',
    ],
    ans: 2,
    why: 'Each training step, every input and hidden neuron is temporarily dropped with probability p (typically 10–50%); output neurons never drop. After training nothing drops — and evaluate the training loss WITHOUT dropout, or overfitting can hide.',
    slide: 63,
  },
  {
    q: 'Slide 65’s default DNN configuration pairs which optimizer and schedule?',
    opts: [
      'plain SGD + a constant learning rate',
      'AdaGrad + exponential scheduling',
      'RMSProp + piecewise constant scheduling',
      'Nesterov accelerated gradients or AdamW + performance scheduling or 1cycle',
    ],
    ans: 3,
    why: 'Table 11-3: He init, ReLU if shallow / Swish if deep, batch norm if deep, early stopping (+ weight decay if needed), NAG or AdamW, performance or 1cycle. For a self-normalizing dense stack (Table 11-4): LeCun init + SELU, no normalization, NAG.',
    slide: 65,
  },
];

// Correct-answer count for a { questionIndex: optionIndex } answer map.
export function scoreOf(answers) {
  return Object.entries(answers).filter(([i, a]) => QUIZ[Number(i)]?.ans === a).length;
}
