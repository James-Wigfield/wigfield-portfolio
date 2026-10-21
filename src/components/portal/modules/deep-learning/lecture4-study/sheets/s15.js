// §15 · 1D convolution layers for sequences (slide 50)
export default {
  big: 'like 2D conv layers for images, a {g|1D conv layer} can process sequences',
  blocks: [
    {
      id: 'conv',
      h: 'Conv1D on sequences',
      at: '50',
      items: [
        { arrow: ['kernels slide along the time axis', '{g|one 1D feature map} per kernel'] },
        '10 kernels → 10 1D sequences (all the same length) = one 10D sequence',
      ],
      margin: [
        { q: 'A Conv1D layer has 16 filters. How many 1D sequences does it output?', a: '16 — one feature map per kernel (or, equivalently, one 16-dimensional sequence).' },
      ],
    },
    {
      id: 'model',
      h: 'cnn_gru_model',
      at: '50',
      items: [
        {
          steps: [
            '`Conv1D`: 8 filters of size 3, stride 1, ReLU',
            '`Conv1D`: 16 filters of size 3, stride 2, ReLU',
            '`GRU(10)`',
            '`Dense(1)`',
          ],
        },
        '1,283 trainable params · val MAE {g|30,209}: similar to the previous models',
        'can even drop the recurrent layers → only 1D conv layers',
      ],
    },
    {
      id: 'shapes',
      h: 'Lengths & params',
      at: '50',
      fig: { key: 'conv1d', hl: ['s2'], cap: 'a kernel of 3 over 8 days · stride 2 in green', place: 'above' },
      items: [
        { formula: 'L_{\\text{out}} = \\left\\lfloor \\frac{L_{\\text{in}} - k}{s} \\right\\rfloor + 1', tag: '"valid" padding — beyond the slide', read: 'how many places a size-$k$ kernel fits, $s$ steps at a time' },
        {
          title: 'a 56-day window (this page’s breakdown, beyond the slides)',
          worked: ['$56 - 3 + 1 = 54$, then $\\lfloor (54 - 3) / 2 \\rfloor + 1 =$ {g|26} steps, 16 channels'],
        },
        { formula: '\\#\\text{params}\\big(\\texttt{Conv1D}\\big) = k \\times c_{\\text{in}} \\times \\text{filters} + \\text{filters}', tag: 'beyond the slide', read: 'each filter: $k$ weights per input channel + one bias' },
        {
          title: 'per layer (this page’s; GRU with Keras’s two biases)',
          worked: [
            'Conv1Ds $3 \\cdot 8 + 8 = 32$, $3 \\cdot 8 \\cdot 16 + 16 = 400$ · GRU $3(16 \\cdot 10 + 10 \\cdot 10 + 2 \\cdot 10) = 840$ · Dense $11$',
            '$32 + 400 + 840 + 11 =$ {g|1,283}, slide 50’s total',
          ],
        },
      ],
      margin: [
        { q: 'Why does the GRU in `cnn_gru_model` see 26 steps, not 56?', a: 'The two Conv1D layers shorten the sequence: 56 → 54 (kernel 3, stride 1) → 26 (kernel 3, stride 2).' },
      ],
    },
    {
      id: 'ex',
      h: 'Exercise',
      at: '50',
      items: [
        'change `lstm_model`, `gru_model` & `cnn_gru_model` to take the 5-feature input & train',
      ],
    },
  ],
};
