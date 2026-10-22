// §9 · Implementing a GAN in Keras (slides 23–25)
export default {
  blocks: [
    {
      id: 'keras',
      h: 'The GAN in Keras',
      at: '23–25',
      items: [
        'The generator is like an autoencoder’s decoder (30 codings → 100 → 150 → 784, sigmoid); the discriminator is a binary classifier.',
        'The training loop is unusual, so `fit()` can’t be used: a custom loop runs phase 1 and then phase 2 on every batch.',
        { code: 'discriminator.trainable = False\ngan.train_on_batch(noise, y2)', read: 'phase 2: training `gan` trains the generator only' },
      ],
      margin: [
        { q: 'What does `y1` hold for a batch of 32?', a: '32 zeros (the fake images come first) then 32 ones (the real images).' },
      ],
    },
  ],
  skip: 'the listings, the `tf.data` pipeline and the `train_on_batch` note.',
};
