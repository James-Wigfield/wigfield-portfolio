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
          head: ['layer', 'parameters', 'variables'],
          // parameters wide enough for the GRU line; the variables get the rest
          cols: 'minmax(min-content, max-content) minmax(min-content, 11em) minmax(min-content, 1fr)',
          rows: [
            // a list cell wraps only between its entries (SheetPage.jsx)
            ['Dense', '$(n_{\\text{in}} + 1) \\times n$', ['$n_{\\text{in}}$ inputs,', '$n$ neurons']],
            ['Dense, no bias', '$n_{\\text{in}} \\times n$', ['$n_{\\text{in}}$ inputs,', '$n$ neurons']],
            ['Normalization', ['$2n + 1$,', 'non-trainable'], '$n$ features'],
            ['BatchNorm', ['$4n$: $\\gamma, \\beta$ +', '$2n$ non-trainable'], ['$n$ features,', '$\\gamma$ scale,', '$\\beta$ shift']],
            ['Conv2D / 1D / T', '$(k_h k_w c_{\\text{in}} + 1) \\times f$', ['$k_h \\times k_w$ kernel,', '$c_{\\text{in}}$ channels in,', '$f$ filters']],
            ['SimpleRNN', '$u(u + n_{\\text{in}}) + u$', ['$u$ units,', '$n_{\\text{in}}$ features']],
            ['LSTM', '$4 \\times$ SimpleRNN', 'the same $u$, $n_{\\text{in}}$'],
            ['GRU (Keras)', '$3 \\times (u(u + n_{\\text{in}}) + 2u)$', ['$u$ units,', '$n_{\\text{in}}$ features']],
            ['Bidirectional', '$2 \\times$ the layer inside', '—'],
            ['tied decoder', 'its biases only', '—'],
            ['frozen layer', ['same count,', '{g|non-trainable}'], '—'],
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
