// §12 · Handling long sequences (slides 40–41)
export default {
  big: 'many time steps → {g|unstable gradients}, and the RNN gradually forgets the first inputs',
  blocks: [
    {
      id: 'long',
      h: 'Long sequences',
      at: '40',
      items: [
        { arrow: ['training over many time steps', 'vanishing/exploding gradients: slow or unstable training'] },
        {
          title: 'same $w$ every step → each step multiplies the gradient by $w\\,\\varphi\'$ (this page’s illustration)',
          worked: [
            'factors of 0.9 for 50 steps: $0.9^{50} \\approx$ {g|0.005}',
            'factors of 1.1 instead: $1.1^{50} \\approx$ {g|117} — a small difference per step becomes huge',
            'tanh: $\\varphi\' \\le 1$, so saturation shrinks the factor further',
          ],
        },
        'a long sequence → the RNN gradually forgets the first inputs',
      ],
    },
    {
      id: 'fight',
      h: 'Fighting unstable gradients',
      at: '40',
      items: [
        'consider good initialization, faster optimizers & dropout',
        { arrow: ['the same weights at every step → outputs can explode', 'nonsaturating ReLU may not help as much'] },
        'smaller learning rate, or a {g|saturating} activation like tanh → less risk (∴ tanh is the default)',      ],
      margin: [
        { q: 'Why may ReLU not help with unstable gradients in an RNN?', a: 'The same weights are used at every time step, so a nonsaturating activation can let the outputs explode.' },
      ],
    },
    {
      id: 'norm',
      h: 'Normalization',
      at: '41',
      fig: { key: 'normAxes', hl: ['ln'], cap: 'layer norm (green): one instance, across the features' },
      items: [
        {
          table: {
            head: ['', 'normalizes across', 'in RNNs'],
            rows: [
              ['batch norm', 'the batch dimension', 'reported: no good results at each time step'],
              ['layer norm (Ba et al., 2016)', 'the {g|features} dimension', 'reported {g|better}'],
            ],
          },
        },
      ],
      margin: [
        { ne: 'LN is very similar to BN, but normalizes across the features, not the batch' },
        { q: 'Across which dimension does layer normalization normalize?', a: 'The features dimension; batch normalization normalizes across the batch dimension.' },      ],
    },
  ],
};
