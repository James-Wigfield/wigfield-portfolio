// §4 · Stacked autoencoders (slides 10–11)
export default {
  blocks: [
    {
      id: 'stacked',
      h: 'Stacked autoencoders',
      at: '10–11',
      fig: { key: 'sandwich', hl: ['coding'], cap: 'Figure 17-3: label each layer’s units, the codings and the reconstruction.', place: 'side' },
      items: [
        'An autoencoder with several hidden layers is a {g|stacked} (or deep) autoencoder.',
        'It is usually symmetric about the central hidden layer, the coding layer, so it looks like a sandwich.',
        'An autoencoder for MNIST may be 784 → 100 → 30 → 100 → 784.',
      ],
    },
    {
      id: 'power',
      h: 'Not too powerful',
      at: '10',
      items: [
        'More layers let the autoencoder learn more complex codings.',
        'But an autoencoder whose encoder maps each input to one arbitrary number reconstructs the training data perfectly, learns no useful representation, and is unlikely to generalise.',
      ],
      margin: [
        { q: 'Why can a too-powerful autoencoder be useless, even with perfect reconstructions?', a: 'It can memorise each training input as an arbitrary number (and the decoder the reverse), so it learns no useful representation and is unlikely to generalise to new instances.' },
      ],
    },
  ],
};
