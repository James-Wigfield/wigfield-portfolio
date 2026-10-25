// Notebook page 1 · Parameter counts: the method and the rule table.
// ≤ 30 rules at the 760 px reference width (measured; page-check.mjs asserts).
export default {
  blocks: [
    {
      id: 'method',
      h: 'The method, for any source',
      at: 'L1 · 8, 36, 45',
      items: [
        { steps: [
          'List the layers in order.',
          'Track the size flowing {g|into} each layer.',
          'Apply that layer’s rule (below).',
          'Score 0: Flatten, Reshape, Dropout, pooling, GAP, Concatenate.',
          'Split trainable from non-trainable.',
          'Add up, and write each layer’s working.',
        ] },
      ],
      margin: [
        { q: 'What is a parameter?', a: 'A number the model learns: a weight or a bias.' },
        { q: 'Where do non-trainable ones come from?', a: 'Normalization, BN’s moving statistics, frozen layers.' },
      ],
    },
    {
      id: 'rules',
      h: 'One rule per layer',
      at: 'L1–L8',
      items: [
        { table: {
          head: ['layer', 'parameters', 'slide'],
          rows: [
            ['Dense', '$(n_{\\text{in}} + 1) \\times n$', 'L1 · 36'],
            ['Dense, no bias', '$n_{\\text{in}} \\times n$', 'L2 · 28'],
            ['Normalization', '$2n + 1$, all non-trainable', 'L1 · 45'],
            ['BatchNorm', '$4n$: $\\gamma, \\beta$ + $2n$ non-trainable', 'L2 · 27'],
            ['Conv2D / 1D / T', '$(k_h k_w c_{\\text{in}} + 1) \\times f$', 'L3 · 22'],
            ['SimpleRNN', '$u(u + n_{\\text{in}}) + u$', 'L4 · 9, 25'],
            ['LSTM', '$4 \\times$ SimpleRNN', 'L4 · 43'],
            ['GRU (Keras)', '$3 \\times (u(u + n_{\\text{in}}) + 2u)$', 'L4 · 49'],
            ['Bidirectional', '$2 \\times$ the layer inside', 'L8 · 9'],
            ['tied decoder', 'its biases only', 'L5 · 19'],
            ['frozen layer', 'same count, {g|non-trainable}', 'L2 · 31'],
          ],
        } },
      ],
      margin: [
        { q: 'Why doesn’t the image size matter to Conv2D?', a: 'The same filters slide over every position (L3 slide 8).' },
        { q: 'Why don’t time steps matter to an RNN?', a: 'Every step reuses $\\mathbf{W}_x$, $\\mathbf{W}_h$, $\\mathbf{b}$ (L4 slide 9).' },
      ],
    },
  ],
  skip: 'the worked examples and traps (page 2); MultiHeadAttention and Embedding counts (not on the slides).',
};
