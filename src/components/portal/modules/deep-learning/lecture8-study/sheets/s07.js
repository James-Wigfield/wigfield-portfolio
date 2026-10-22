// §7 · Luong (multiplicative) attention (slides 24–25)
export default {
  blocks: [
    {
      id: 'luong',
      h: 'Luong attention',
      at: '24–25',
      items: [
        'Luong et al. (2015) score with the {g|dot product} of $\\mathbf{h}$ and $\\mathbf{y}$: the vectors must be the same length.',
        { formula: '\\widetilde{\\mathbf{h}}_{(t)} = \\sum_{i} \\alpha_{(t,i)} \\mathbf{y}_{(i)}, \\qquad \\alpha_{(t,i)} = \\frac{\\exp(e_{(t,i)})}{\\sum\\limits_{i\'} \\exp(e_{(t,i\')})}', read: 'the weighted sum of the encoder outputs; the weights are a softmax of the scores' },
        {
          table: {
            head: ['variant', 'score $e_{(t,i)}$'],
            rows: [
              ['dot product', '$\\mathbf{h}_{(t)}^{\\top}\\mathbf{y}_{(i)}$'],
              ['general', '$\\mathbf{h}_{(t)}^{\\top}\\mathbf{W}\\mathbf{y}_{(i)}$'],
              ['concat', '$\\mathbf{v}^{\\top}\\text{tanh}(\\mathbf{W}[\\mathbf{h}_{(t)};\\mathbf{y}_{(i)}])$'],
            ],
          },
        },
        'Concat was outperformed by the two dot-product variants, so it is less used now.',
      ],
    },
    {
      id: 'vs',
      h: 'Bahdanau vs Luong',
      at: '23–26',
      items: [
        {
          table: {
            head: ['', 'Bahdanau', 'Luong'],
            rows: [
              ['also called', 'additive, concatenative', 'multiplicative'],
              ['score', 'a small network on $[\\mathbf{h}; \\mathbf{y}]$', 'multiplies $\\mathbf{h}$ and $\\mathbf{y}$ (dot, general); concat is less used'],
              ['Keras layer', '`AdditiveAttention`', '`Attention`'],
            ],
          },
        },
      ],
      margin: [
        { q: 'What is the one constraint of the dot-product score?', a: '$\\mathbf{h}$ and $\\mathbf{y}$ must have the same length (slide 24).' },
      ],
    },
  ],
};
