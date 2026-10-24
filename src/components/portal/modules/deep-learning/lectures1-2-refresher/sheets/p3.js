// Notebook page 3 · Lecture 2: faster and regularized training (L2 slides 33–66)
export default {
  blocks: [
    {
      id: 'opt',
      h: 'Faster optimizers',
      at: 'L2 · 33–47',
      items: [
        { formula: '\\mathbf{m} \\leftarrow \\beta\\mathbf{m} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}), \\qquad \\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} + \\mathbf{m}' },
        {
          table: {
            head: ['optimizer', 'idea', 'defaults'],
            rows: [
              ['NAG', 'gradient measured at $\\boldsymbol{\\theta} + \\beta\\mathbf{m}$', '$\\beta = 0.9$'],
              ['AdaGrad', '$\\mathbf{s}$ sums $\\nabla J \\otimes \\nabla J$; step $\\oslash \\sqrt{\\mathbf{s} + \\epsilon}$', 'stops too early'],
              ['RMSProp', '$\\mathbf{s} \\leftarrow \\rho\\mathbf{s} + (1 - \\rho)\\nabla J \\otimes \\nabla J$', '$\\rho = 0.9$'],
              ['Adam', '$\\mathbf{m}$ and $\\mathbf{s}$, {g|bias-corrected}', '$\\beta_1 = 0.9$, $\\beta_2 = 0.999$'],
            ],
          },
        },
      ],
      margin: [
        { q: 'What do AdaMax, Nadam, AdamW change?', a: 'AdaMax: $\\mathbf{s} \\leftarrow \\max(\\beta_2\\mathbf{s}, \\text{abs}(\\nabla J))$; Nadam: + Nesterov; AdamW: + weight decay (slide 45).' },
        { q: 'Adam’s usual η?', a: '0.001: it needs less tuning (slide 44).' },
      ],
    },
    {
      id: 'lr',
      h: 'Learning-rate schedules',
      at: 'L2 · 48–59',
      items: [
        'Start {g|high}, then reduce: faster than any constant rate.',
        {
          table: {
            head: ['schedule', 'rule'],
            rows: [
              ['power', '$\\eta(t) = \\eta_0/(1 + rt/s)^c$'],
              ['exponential', '$\\eta(t) = \\eta_0 r^{t/s}$'],
              ['piecewise', 'constant steps, set by hand'],
              ['performance', '× λ when the validation error stops dropping'],
              ['1cycle', 'up to $\\eta_1$ by halfway, back down, then a big drop'],
            ],
          },
        },
      ],
      margin: [
        { q: 'Keras for performance scheduling?', a: '`ReduceLROnPlateau(factor=0.5, patience=5)` (slide 57).' },
      ],
    },
    {
      id: 'reg',
      h: 'Avoiding overfitting',
      at: 'L2 · 60–64',
      items: [
        'ℓ1/ℓ2: `regularizers.l2(0.01)`; the penalty is {g|added to the loss}.',
        'Dropout: drop each neuron (not outputs) with probability $p$,',
        { line: '10%–50%, at each step; {g|none dropped at test time}.' },
      ],
      margin: [
        { q: 'Why evaluate the training loss without dropout?', a: 'With dropout on, training and validation losses can look alike while the model overfits (slide 64).' },
      ],
    },
    {
      id: 'def',
      h: 'Practical defaults',
      at: 'L2 · 65–66',
      items: [
        {
          table: {
            head: ['', 'default', 'self-normalizing'],
            rows: [
              ['init', 'He', 'LeCun'],
              ['activation', 'ReLU if shallow, Swish if deep', 'SELU'],
              ['normalization', 'batch norm if deep', 'none'],
              ['regularization', 'early stopping, weight decay', 'alpha dropout*'],
              ['optimizer', 'NAG or AdamW', 'NAG'],
              ['LR schedule', 'performance or 1cycle', 'the same'],
            ],
          },
        },
      ],
      margin: [
        { nb: '* alpha dropout: “not covered in CITS5017” (slide 66).' },
      ],
    },
  ],
  skip: 'Adam’s five steps, Keras calls, staircase decay, partial(), dropout gains.',
};
