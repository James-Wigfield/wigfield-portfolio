// §10 · Positional encodings (slides 32–36)
export default {
  blocks: [
    {
      id: 'pe',
      h: 'Positional encodings',
      at: '32–33',
      fig: { key: 'pewave', hl: ['col'], cap: 'Sketch two rows of P: a fast wave (small i) and a slow one (large i).', place: 'side' },
      items: [
        'A dense vector for a word’s position, {g|added} to its word embedding.',
        { formula: '\\mathbf{P}_{p,i} = \\begin{cases} \\sin\\left(p/1000^{i/d}\\right) & \\text{if } i \\text{ is even} \\\\ \\cos\\left(p/1000^{(i-1)/d}\\right) & \\text{if } i \\text{ is odd} \\end{cases}', read: 'p = position, i = component, d = the vectors’ dimension', tag: 'slide 32; slide 35’s code uses 10_000' },
        'Each position gets a {g|unique} encoding, so the model knows every word’s absolute position.',
      ],
      margin: [
        { sc: 'base 1000 on slide 32, `10_000` in slide 35’s code.' },
      ],
    },
    {
      id: 'code',
      h: '`PositionalEncoding`',
      at: '34–36',
      items: [
        'Precompute P in the constructor; `call()` truncates it to the input length and adds it to the inputs.',
      ],
      margin: [
        { q: 'Which components use sine, and which cosine?', a: 'Even components $i$ use sine, odd components use cosine (with the same frequency as the even one before them).' },
      ],
    },
  ],
  skip: 'the `PositionalEncoding` listing and `tfm`.',
};
