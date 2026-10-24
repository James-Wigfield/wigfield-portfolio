// Notebook page 2 · Lecture 2: stable training (L2 slides 4–32)
export default {
  blocks: [
    {
      id: 'vg',
      h: 'Vanishing and exploding gradients',
      at: 'L2 · 4–6',
      items: [
        'Gradients shrink or grow on the way down to the lower layers.',
        'Cause: sigmoid with $\\mathcal{N}(0, 1)$ weights; σ {g|saturates}, slope ≈ 0.',
      ],
      margin: [
        { q: 'Why is the sigmoid a problem?', a: 'Mean 0.5, not 0, and it saturates at 0 or 1, where its derivative is close to 0 (slide 6).' },
      ],
    },
    {
      id: 'init',
      h: 'Initialization',
      at: 'L2 · 7–9',
      items: [
        {
          table: {
            head: ['init', 'for', '$\\sigma^2$ (normal)'],
            rows: [
              ['Glorot', 'none, tanh, sigmoid, softmax', '$1/\\text{fan}_{\\text{avg}}$'],
              ['He', 'ReLU, leaky ReLU, ELU, GELU, Swish, Mish', '{g|$2/\\text{fan}_{\\text{in}}$}'],
              ['LeCun', 'SELU', '$1/\\text{fan}_{\\text{in}}$'],
            ],
          },
        },
        { formula: '\\text{fan}_{\\text{avg}} = (\\text{fan}_{\\text{in}} + \\text{fan}_{\\text{out}})/2' },
        'Keras default: Glorot uniform; `kernel_initializer="he_normal"`.',
      ],
      margin: [
        { q: 'Glorot as a uniform range?', a: '$[-r, +r]$ with $r = \\sqrt{3/\\text{fan}_{\\text{avg}}}$ (slide 7).' },
      ],
    },
    {
      id: 'act',
      h: 'Nonsaturating activations',
      at: 'L2 · 10–22',
      items: [
        'ReLU can {g|die}; its variants keep a slope for $z < 0$:',
        { line: 'leaky ReLU $\\max(\\alpha z, z)$, ELU, SELU, GELU $z\\Phi(z)$, Swish $z\\sigma(\\beta z)$, Mish.' },
        'Use ReLU for simple tasks, Swish (SiLU) for complex ones.',
      ],
      margin: [
        { q: 'When does SELU self-normalize?', a: 'Standardized inputs, LeCun normal init, and no ℓ1/ℓ2, max-norm, BN or dropout (slide 16).' },
      ],
    },
    {
      id: 'bn',
      h: 'Batch normalization',
      at: 'L2 · 23–28',
      items: [
        { formula: '\\hat{\\mathbf{x}}^{(i)} = (\\mathbf{x}^{(i)} - \\boldsymbol{\\mu}_B)/\\sqrt{\\boldsymbol{\\sigma}_B^2 + \\epsilon}, \\qquad \\mathbf{z}^{(i)} = \\boldsymbol{\\gamma} \\otimes \\hat{\\mathbf{x}}^{(i)} + \\boldsymbol{\\beta}' },
        '{g|γ, β} are learned; at test time, moving averages are used.',
        'Gains: tanh usable, larger η, it regularizes; costs time.',
      ],
      margin: [
        { q: 'BN before the activation?', a: '`Dense(…, use_bias=False)`, then `BatchNormalization()`, then `Activation("relu")` (slide 28).' },
      ],
    },
    {
      id: 'clip',
      h: 'Clipping and transfer learning',
      at: 'L2 · 29–32',
      items: [
        '`clipvalue` clips each component; `clipnorm` keeps the {g|direction}.',
        'Transfer: reuse the lower layers, replace the output layer;',
        { line: 'freeze (`trainable = False`), train, unfreeze, {g|recompile}, train.' },
      ],
      margin: [
        { q: 'When does transfer learning work well?', a: 'With deep CNNs; poorly with small dense networks (slide 32).' },
      ],
    },
  ],
  skip: 'RReLU, PReLU, Mish details, BN parameter counts, transfer numbers.',
};
