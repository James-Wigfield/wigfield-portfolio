// Code Lab cards: tab 4 · Optimizers & LR schedules (L2)
export const OPTIM = [
  {
    id: 'momentum-adam',
    title: 'Momentum and Adam in Keras',
    rating: 'core',
    why: 'Given the update equations, say what each term is and which Keras argument sets it.',
    sources: [{ kind: 'lecture', lec: 2, slides: '34–35' }, { kind: 'lecture', lec: 2, slides: '43–44' }],
    provenance: 'trimmed',
    file: 'optimizers.py',
    code: `# standard SGD optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)

# Momentum optimizer
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001, momentum=0.9)
# …
optimizer = tf.keras.optimizers.Adam(learning_rate=0.001,
                                     beta_1=0.9, beta_2=0.999)`,
    marks: [
      { n: 1, token: { line: 2, text: 'learning_rate=0.001' }, say: 'η, the step size in θ ← θ − η∇J(θ).' },
      { n: 2, token: { line: 5, text: 'momentum=0.9' }, say: 'β: how much of the old momentum vector m survives each step.' },
      { n: 3, lines: [7, 8], say: 'β₁ decays m (the mean of gradients), β₂ decays s (their squares), as in RMSProp’s ρ.' },
    ],
    moves: {
      eq: [
        { name: 'Momentum (slide 34)', tex: String.raw`\mathbf{m} \leftarrow \beta \mathbf{m} - \eta \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}),\quad \boldsymbol{\theta} \leftarrow \boldsymbol{\theta} + \mathbf{m}`, line: 5 },
        { name: 'Adam steps 1–2 (slide 43)', tex: String.raw`\mathbf{m} \leftarrow \beta_1 \mathbf{m} + (1 - \beta_1)\nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}),\quad \mathbf{s} \leftarrow \beta_2 \mathbf{s} + (1 - \beta_2)\nabla_{\boldsymbol{\theta}} J \otimes \nabla_{\boldsymbol{\theta}} J`, line: 8 },
      ],
      forWhat: 'Faster, steadier training than plain gradient descent; Adam needs little tuning of η (the default 0.001 often works).',
    },
    slideCheck: null,
  },
];
