// Notebook page 2 · Parameter counts: four worked examples (one per source
// type) and the traps. ≤ 30 rules at the 760 px reference width.
export default {
  blocks: [
    {
      id: 'code',
      h: 'From code: sample Q1(c)',
      at: 'Sample Q1(c)',
      items: [
        { worked: [
          'Normalization(10): $2 \\times 10 + 1 = 21$, all non-trainable',
          'Dense(20): $(10 + 1) \\times 20 = 220$',
          'Concatenate: $10 + 20 = 30$ wide, 0 parameters',
          'Dense(3): $(30 + 1) \\times 3 = 93$',
          'trainable $220 + 93 = $ {g|313} (total 334)',
        ] },
      ],
      margin: [{ q: 'Which number is the trap?', a: 'The 21: non-trainable, and the question asks for trainable.' }],
    },
    {
      id: 'summary',
      h: 'From a summary: BN',
      at: 'L2 · 27',
      items: [
        { worked: [
          'BN(784) 3,136 · BN(300) 1,200 · BN(100) 400',
          'non-trainable $2 \\times (784 + 300 + 100) = $ {g|2,368}',
        ] },
      ],
    },
    {
      id: 'sentence',
      h: 'From a sentence: 200 filters of 5 × 5, RGB',
      at: 'L3 · 22',
      items: [{ worked: ['$(5 \\times 5 \\times 3 + 1) \\times 200 = $ {g|15,200}; a dense layer: 675 million'] }],
    },
    {
      id: 'eqs',
      h: 'From equations: the memory cell',
      at: 'L4 · 9–10',
      items: [
        { worked: [
          '$\\mathbf{x} \\in \\mathbb{R}^4$, $\\mathbf{h} \\in \\mathbb{R}^5$: $\\mathbf{W}_x$ 4×5, $\\mathbf{W}_h$ 5×5, $\\mathbf{b}_h$ 5: 50',
          '$\\hat{\\mathbf{y}} \\in \\mathbb{R}^2$: $\\mathbf{W}_y$ 5×2, $\\mathbf{b}_y$ 2: 12; total {g|62}',
        ] },
      ],
      margin: [{ q: 'Is 62 printed on slide 10?', a: 'No: the slide gives the shapes; the count is this page’s own.' }],
    },
    {
      id: 'traps',
      h: 'Traps',
      at: 'L1–L6–7',
      items: [
        'Concatenate scores 0 but {g|widens} the next layer.',
        'BN: half its $4n$ are non-trainable; Normalization: all.',
        'GRU(20) + Dense(1): Keras 1,401; one bias per gate 1,341.',
        'Time steps never add parameters; nor do image size or stride.',
        'Frozen ≠ removed: the count moves to non-trainable.',
        'A tied decoder layer adds only its biases.',
      ],
    },
  ],
  skip: 'the CNN, GAN and DCGAN totals and the policy net / DQN (Read, steps 7, 10).',
};
