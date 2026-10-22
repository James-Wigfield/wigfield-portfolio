// §11 · Scaled dot-product attention (slides 37–38)
export default {
  blocks: [
    {
      id: 'sdpa',
      h: 'Scaled dot-product attention',
      at: '37–38',
      items: [
        { formula: '\\text{Attention}(\\mathbf{Q}, \\mathbf{K}, \\mathbf{V}) = \\text{softmax}\\left(\\frac{\\mathbf{Q}\\mathbf{K}^{\\top}}{\\sqrt{d_{\\text{keys}}}}\\right)\\mathbf{V}', read: 'Q [n_queries, d_keys], K [n_keys, d_keys], V [n_keys, d_values]' },
        { fig: 'sdpa', hl: ['scale', 'soft'], cap: 'The pipeline with its shapes.' },
        '$\\mathbf{Q}\\mathbf{K}^{\\top}$ holds one similarity score per query/key pair; dividing by $\\sqrt{d_{\\text{keys}}}$ avoids {g|saturating the softmax}, which would give tiny gradients.',
        'Each row of weights adds up to 1, and each output row is a {g|weighted sum of the values}: [n_queries, d_values].',
      ],
      margin: [
        { q: 'What shape is the output for 4 queries and $d_{\\text{values}} = 4$?', a: '[4, 4]: one row per query, $d_{\\text{values}}$ columns.' },
        { sc: 'slide 38 prints the factor as $1/d_{\\text{keys}}$; the equation has $\\sqrt{d_{\\text{keys}}}$.' },
      ],
    },
  ],
};
