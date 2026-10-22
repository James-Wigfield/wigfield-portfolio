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
        'Phase 1 trains the {g|discriminator}: a batch of real images plus an equal number of fake ones, with the fake images labelled 0 and the real ones 1. Only the discriminator’s weights change.',
        'Phase 2 trains the {g|generator}: a new batch of fake images only, all labelled 1 (real). The discriminator’s weights are frozen.',
        'Each phase is a single training step with the binary cross-entropy loss.',
      ],
      margin: [
        { q: 'Why are the fake images labelled 1 in phase 2?', a: 'We want the generator to produce images the discriminator will (wrongly) believe are real, so the generator is trained towards “real”.' },
      ],
    },
  ],
};
