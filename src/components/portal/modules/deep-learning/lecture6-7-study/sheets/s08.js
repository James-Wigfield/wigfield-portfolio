// §8 · Training a GAN: two phases per iteration (slides 21–22)
export default {
  blocks: [
    {
      id: 'phases',
      h: 'Two phases per training iteration',
      at: '21–22',
      fig: { key: 'phases', hl: ['learn'], cap: 'Slides 21–22: label each batch, its labels, and which network learns.' },
      items: [
        'The two networks have opposite goals, so a GAN can’t be trained like a regular network.',
        {
          table: {
            head: ['phase', 'the batch', 'labels', 'what learns'],
            rows: [
              ['1: train the discriminator', 'real images + as many fake', 'fake {g|0}, real {g|1}', 'the discriminator only'],
              ['2: train the generator', 'fake images only', 'all {g|1} (real)', 'the generator only; the discriminator is frozen'],
            ],
          },
        },
        'Each phase is one step with the binary cross-entropy loss.',
      ],
      margin: [
        { q: 'Why are the fake images labelled 1 in phase 2?', a: 'We want the generator to produce images the discriminator will (wrongly) believe are real, so the generator is trained towards “real”.' },
      ],
    },
  ],
};
