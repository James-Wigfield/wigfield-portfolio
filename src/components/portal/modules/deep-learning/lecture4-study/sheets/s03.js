// §3 · The weather RNN & minibatch shapes (slides 10–11)
export default {
  blocks: [
    {
      id: 'weather',
      h: 'The weather example',
      at: '10',
      fig: { key: 'weatherRnn', hl: ['last'], place: 'above', cap: 'slide 10 · three RNN cells (5 neurons); only $\\hat{\\mathbf{y}}_{(3)}$ (green) is kept' },
      items: [
        'in: temperature, precipitation, atmospheric pressure & wind speed on 3 consecutive days → $\\mathbf{x}_{(0)}, \\mathbf{x}_{(1)}, \\mathbf{x}_{(2)} \\in \\mathbb{R}^4$',
        'out: the next day’s temperature & precipitation, from a simple RNN with 5 neurons → $\\hat{\\mathbf{y}}_{(3)} \\in \\mathbb{R}^2$',
        'only {g|$\\hat{\\mathbf{y}}_{(3)}$} goes into the loss (e.g. average MSE vs $\\mathbf{y}_{(3)}$); the earlier outputs are discarded',
        'initial hidden state $\\mathbf{h}^{\\top}_{(0)}$: usually a zero vector',
      ],
      margin: [
        { q: 'In the weather example, which outputs are used in the loss?', a: 'Only $\\hat{\\mathbf{y}}_{(3)}$; $\\hat{\\mathbf{y}}_{(1)}$ and $\\hat{\\mathbf{y}}_{(2)}$ are discarded.' },
        { sc: 'the diagram’s subscripts run one step ahead of slides 8–9: read each as the day predicted.' },
      ],
    },
    {
      id: 'weights',
      h: 'Weights to learn',
      at: '10',
      items: [
        { line: 'so $\\mathbf{W}_h \\in \\mathbb{R}^{5\\times5}$, $\\mathbf{W}_x \\in \\mathbb{R}^{4\\times5}$, $\\mathbf{W}_y \\in \\mathbb{R}^{5\\times2}$' },
        {
          title: 'counting them (this page’s count — the slides give none)',
          worked: [
            '$\\mathbf{W}_h$: $5 \\times 5 = 25$ · $\\mathbf{W}_x$: $4 \\times 5 = 20$ · $\\mathbf{b}_h$: 5 · $\\mathbf{W}_y$: $5 \\times 2 = 10$ · $\\mathbf{b}_y$: 2',
            'total $25 + 20 + 5 + 10 + 2 =$ {g|62}, the same 62 at every time step (the cells share them)',
          ],
        },
      ],
    },
    {
      id: 'batch',
      h: 'Minibatches',
      at: '11',
      items: [
        'minibatch size $m$ → stack {g|one row per instance}',
        {
          table: {
            head: ['', 'one instance', 'minibatch'],
            rows: [
              ['input', '$\\mathbf{x}_{(t)} \\in \\mathbb{R}^4$', '$\\mathbf{X}_{(t)} \\in \\mathbb{R}^{m\\times4}$'],
              ['target', '$\\mathbf{y}_{(t)} \\in \\mathbb{R}^2$', '$\\mathbf{Y}_{(t)} \\in \\mathbb{R}^{m\\times2}$'],
              ['state', '$\\mathbf{h}_{(t)} \\in \\mathbb{R}^5$', '$\\mathbf{H}_{(t)} \\in \\mathbb{R}^{m\\times5}$'],
              ['biases', '$\\mathbf{b}_h^{\\top}$, $\\mathbf{b}_y^{\\top}$', '$\\mathbf{B}_h \\in \\mathbb{R}^{m\\times5}$, $\\mathbf{B}_y \\in \\mathbb{R}^{m\\times2}$'],
            ],
          },
        },
        { formula: '\\mathbb{R}^{m\\times 5} \\ni \\mathbf{H}_{(t)} = \\varphi_h\\left(\\mathbf{H}_{(t-1)}\\mathbf{W}_h + \\mathbf{X}_{(t)}\\mathbf{W}_x + \\mathbf{B}_h\\right)', read: '$m$ states at once: (m×5)(5×5) + (m×4)(4×5) + (m×5) → m×5' },
        { formula: '\\mathbb{R}^{m\\times 2} \\ni \\hat{\\mathbf{Y}}_{(t)} = \\varphi_y\\left(\\mathbf{H}_{(t)}\\mathbf{W}_y + \\mathbf{B}_y\\right)', read: '$m$ outputs at once: (m×5)(5×2) + (m×2) → m×2' },
      ],
      margin: [
        { q: 'What shape is $\\mathbf{H}_{(t)}$ for a minibatch of $m$ instances?', a: '$m \\times 5$ — one 5-neuron state row per instance.' },
      ],
    },
    {
      id: 'set',
      h: 'The training set',
      at: '11',
      items: [
        '$N$ = training set size; $\\mathbf{X}$ a {g|3D tensor}',
        { formula: '\\mathbf{X} \\in \\mathbb{R}^{N\\times 3\\times 4}, \\quad \\mathbf{Y} \\in \\mathbb{R}^{N\\times 2}', read: '$N$ instances × 3 time steps × 4 features in; one 2-value target per instance out' },
      ],
      margin: [
        { sc: 'slide 11 calls $\\mathbf{Y}$ a 3D tensor too, but it has two axes: one target per instance.' },
      ],
    },
  ],
};
