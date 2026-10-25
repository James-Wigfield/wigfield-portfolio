// Code Lab cards: tab 4 · Optimizers & LR schedules (L2)
export const OPTIM = [
  {
    id: 'momentum-adam',
    title: 'Momentum, Nesterov, RMSProp and Adam in Keras',
    rating: 'core',
    why: 'Given an optimizer’s update equations, say what each term means and which Keras argument sets it.',
    sources: [{ kind: 'lecture', lec: 2, slides: '34–44' }],
    blocks: ['L2 s35', 'L2 s37', 'L2 s42', 'L2 s44'],
    provenance: 'trimmed',
    inv: ['l2-momentum', 'l2-nesterov', 'l2-rmsprop', 'l2-adam'],
    file: 'optimizers.py',
    code: `# standard SGD optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)

# Momentum optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001, momentum=0.9)
# …
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001,
                                    momentum=0.9, nesterov=True)
# …
optimizer = tf.keras.optimizers.RMSprop(learning_rate=0.001, rho=0.9)
# …
optimizer = tf.keras.optimizers.Adam(learning_rate=0.001,
                                     beta_1=0.9, beta_2=0.999)`,
    marks: [
      { n: 1, token: { line: 2, text: 'learning_rate=0.001' }, say: 'η, the step size in θ ← θ − η∇J(θ).' },
      { n: 2, token: { line: 5, text: 'momentum=0.9' }, say: 'β (the momentum): how much of m is kept each step; 0 = high friction, 1 = no friction.' },
      { n: 3, token: { line: 8, text: 'nesterov=True' }, say: 'Takes the gradient slightly ahead, at θ + βm, instead of at θ.' },
      { n: 4, lines: [12, 13], say: 'β₁ decays m (the mean of the gradients), β₂ decays s (their squares), like RMSProp’s ρ.' },
    ],
    moves: {
      eq: [
        { name: 'Momentum (slide 34)', tex: String.raw`\mathbf{m} \leftarrow \beta \mathbf{m} - \eta \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}), \quad \boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \mathbf{m}`, line: 5 },
        { name: 'Adam steps 1–2 (slide 43)', tex: String.raw`\begin{aligned} \mathbf{m} &\leftarrow \beta_1 \mathbf{m} + (1 - \beta_1) \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \\ \mathbf{s} &\leftarrow \beta_2 \mathbf{s} + (1 - \beta_2) \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \otimes \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \end{aligned}`, line: 13 },
      ],
      forWhat: 'Faster, steadier training than plain gradient descent; Adam needs little tuning of η (the default 0.001 often works).',
    },
    slideCheck: null,
    xref: [{ to: 'p1-cnn', text: 'Project 1 trains with Adam' }],
  },
  {
    id: 'lr-schedules',
    title: 'Learning-rate schedules: exponential, piecewise, on plateau',
    rating: 'useful',
    why: 'Read a schedule’s arguments and say what the learning rate is after a given number of steps or epochs.',
    sources: [{ kind: 'lecture', lec: 2, slides: '52–57' }],
    blocks: ['L2 s53', 'L2 s56', 'L2 s57'],
    provenance: 'trimmed',
    inv: ['l2-exponential-schedule', 'l2-piecewise-schedule', 'l2-reduce-lr-on-plateau'],
    file: 'schedules.py',
    code: `# initial_learning_rate * decay_rate ** (step / decay_steps)
lr_schedule = tf.keras.optimizers.schedules.ExponentialDecay(
    initial_learning_rate=0.01,
    decay_steps=20_000,
    decay_rate=0.1,
    staircase=False
)
optimizer = tf.keras.optimizers.SGD(learning_rate=lr_schedule)
# …
lr_schedule = tf.keras.optimizers.schedules.PiecewiseConstantDecay(
    boundaries=[50_000, 80_000],
    values=[0.01, 0.005, 0.001]
)
# …
lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(factor=0.5,
                                                    patience=5)`,
    marks: [
      { n: 1, token: { line: 4, text: 'decay_steps=20_000' }, say: 's, counted in steps (batches), not epochs: η falls tenfold every 20,000 steps.' },
      { n: 2, token: { line: 8, text: 'learning_rate=lr_schedule' }, say: 'A schedule object goes where a fixed learning rate would.' },
      { n: 3, lines: [11, 12], say: '0.01 until step 50,000, then 0.005 until 80,000, then 0.001.' },
      { n: 4, lines: [15, 16], say: 'A callback for fit(callbacks=[…]): halve η after 5 epochs without a better validation loss.' },
    ],
    moves: {
      eq: [{ name: 'Exponential scheduling (slides 52–53)', tex: String.raw`\eta(t) = \eta_0 \, r^{\,t/s}`, line: 1 }],
      say: 'With η₀ = 0.01, r = 0.1, s = 20,000: 0.001 after 20,000 steps, 0.0001 after 40,000.',
      forWhat: 'Starting with a large learning rate for fast progress, then lowering it to settle into a minimum.',
    },
    slideCheck: 'Project 1’s make_optimizer uses the same ExponentialDecay with decay_steps = 20 × 116 steps per epoch and decay_rate = 0.5: the rate halves every 20 epochs.',
  },
];
