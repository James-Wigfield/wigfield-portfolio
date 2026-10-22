// §7 · GANs: generator and discriminator (slides 19–20)
export default {
  blocks: [
    {
      id: 'gan',
      h: 'A GAN: two networks that compete',
      at: '19–20',
      fig: { key: 'gan', hl: ['gen'], cap: 'Figure 17-14: label each network’s goal.', place: 'side' },
      items: [
        'The {g|generator} takes random (Gaussian) inputs, the codings, and outputs an image, like a VAE’s decoder.',
        'The {g|discriminator} takes a fake image from the generator or a real one from the training set, and guesses whether it is fake or real.',
      ],
      margin: [
        { q: 'Which part of a VAE does a GAN’s generator do the same job as?', a: 'The decoder: feed it Gaussian noise and it outputs a new image.' },
      ],
    },
  ],
};
