// §11 · Deep convolutional GANs (slides 28–30)
export default {
  blocks: [
    {
      id: 'guide',
      h: 'DCGAN guidelines',
      at: '28–29',
      items: [
        {
          table: {
            head: ['guideline (slide 28)', 'slide 29’s code'],
            cols: 'minmax(0, 1.25fr) minmax(0, 1fr)',
            rows: [
              ['strided convolutions (D) and transposed convolutions (G) instead of pooling', 'follows it'],
              ['Batch Normalization in both, except G’s output and D’s input layers', 'only in G; D uses `Dropout(0.4)`'],
              ['no fully connected hidden layers (deeper architectures)', 'G starts with `Dense(7 * 7 * 128)`'],
              ['G: ReLU, with tanh on the output layer', 'ReLU and tanh; the first `Dense` has no activation'],
              ['D: leaky ReLU on all layers', '`LeakyReLU(0.2)`; the output is sigmoid'],
            ],
          },
        },
        'The guidelines work in many cases, but not always.',
        { line: 'Generator: 100 → 7 × 7 × 128 → 14 × 14 × 64 → 28 × 28 × 1 (tanh)' },
      ],
      margin: [
        { q: 'What replaces pooling in a DCGAN?', a: 'Strided convolutions in the discriminator and transposed convolutions in the generator.' },
        { sc: 'slide 29’s discriminator has no Batch Normalization (see Read).' },
      ],
    },
  ],
  skip: 'the listing, and Figure 17-16 (after 50 epochs).',
};
