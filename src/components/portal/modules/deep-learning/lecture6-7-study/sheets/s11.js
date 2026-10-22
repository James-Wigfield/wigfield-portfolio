// §11 · Deep convolutional GANs (slides 28–30)
export default {
  blocks: [
    {
      id: 'guide',
      h: 'DCGAN guidelines',
      at: '28',
      items: [
        {
          steps: [
            'Replace pooling layers with strided convolutions in the discriminator and {g|transposed convolutions} in the generator.',
            'Use Batch Normalization in both networks, except in the generator’s output layer and the discriminator’s input layer.',
            'Remove fully connected hidden layers for deeper architectures.',
            'Use ReLU in the generator, except in its output layer, which uses {g|tanh}.',
            'Use leaky ReLU in every layer of the discriminator.',
          ],
        },
        'These guidelines work in many cases, but not always.',
        { line: 'Slide 29’s generator: 100 → 7 × 7 × 128 → 14 × 14 × 64 → 28 × 28 × 1, tanh (this page’s working).' },
      ],
      margin: [
        { q: 'What replaces pooling in a DCGAN?', a: 'Strided convolutions in the discriminator and transposed convolutions in the generator.' },
        { sc: 'slide 29’s code doesn’t follow every guideline (see Read).' },
      ],
    },
  ],
  skip: 'the listing, how it measures up to each guideline, and Figure 17-16 (after 50 epochs).',
};
