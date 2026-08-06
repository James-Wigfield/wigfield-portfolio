/* ============================================================================
   DEEP LEARNING — LECTURE 1 QUIZ DATA
   ----------------------------------------------------------------------------
   Ten questions built strictly from the slide content. Kept out of labs2.jsx
   so the page shell can show a live score on the Quiz tab (and so the data
   file stays react-refresh-clean).
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
];

// Correct-answer count for a { questionIndex: optionIndex } answer map.
export function scoreOf(answers) {
  return Object.entries(answers).filter(([i, a]) => QUIZ[Number(i)]?.ans === a).length;
}
