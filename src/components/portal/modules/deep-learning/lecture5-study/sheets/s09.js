// §9 · Training one autoencoder at a time (slides 23–25)
export default {
  blocks: [
    {
      id: 'phases',
      h: 'One autoencoder at a time',
      at: '23–25',
      fig: { key: 'phases', hl: ['copy'], cap: 'Figure 17-7: label the three phases and the copied parameters.' },
      items: [
        {
          steps: [
            'Phase 1: train the first autoencoder (784 → 100 → 784) to learn a compressed representation $\\mathbf{X}_{(1)}$ of the inputs.',
            'Phase 2: using $\\mathbf{X}_{(1)}$ as input data, train the second (100 → 30 → 100) to learn an even more compressed $\\mathbf{X}_{(2)}$.',
            'Phase 3: stack them into one big sandwich: `enc1, enc2, dec2, dec1`.',
          ],
        },
        '`train_autoencoder` trains one shallow autoencoder and returns its encoder, its decoder and the encoded data.',
        'There can be more phases if the autoencoder is very deep, and the full stack can then be trained for a few more epochs.',
      ],
      margin: [
        { q: 'What does the second autoencoder train on?', a: 'On $\\mathbf{X}_{(1)}$, the training set encoded by the first encoder (100 numbers per image). Those codings are its targets too.' },
      ],
    },
  ],
  skip: 'the `train_autoencoder` code and slide 25’s reconstructions.',
};
