// Code Lab cards: tab 8 · VAEs & GANs (L6–7)
export const GEN = [
  {
    id: 'vae-sampling',
    title: 'A VAE’s Sampling layer and latent loss',
    rating: 'core',
    why: 'Sample Q2(b): what a VAE is and how it trains. Map each term of the latent loss to the code, and explain the sampling line.',
    sources: [{ kind: 'lecture', lec: 6, slides: '12–15' }],
    blocks: ['L6-7 s14', 'L6-7 s15'],
    provenance: 'trimmed',
    inv: ['l67-vae-sampling', 'l67-vae-train'],
    file: 'vae.py',
    code: `class Sampling(tf.keras.Layer):
    def call(self, inputs):
        mean, logvar = inputs
        # sum the losses over all the features
        loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)
# …
        self.add_loss(tf.reduce_mean(loss) / 784.)                             # ***
        return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean
# …
codings_mean = tf.keras.layers.Dense(codings_size)(Z)     # mu
codings_log_var = tf.keras.layers.Dense(codings_size)(Z)  # gamma
codings = Sampling()([codings_mean, codings_log_var])
# …
variational_ae.compile(loss="mse", optimizer="nadam")`,
    marks: [
      { n: 1, lines: [5, 5], say: 'The latent (KL) loss, −½ Σ (1 + γ − exp γ − μ²), for each instance.' },
      { n: 2, token: { line: 7, text: '/ 784.' }, say: 'Averaged over the batch, scaled to the 784 pixels the MSE averages over, then added to the total loss.' },
      { n: 3, lines: [8, 8], say: 'Reparameterisation: z = μ + σ·ε with σ = exp(γ / 2) and ε drawn from N(0, I).' },
      { n: 4, token: { line: 11, text: '# gamma' }, say: 'The encoder outputs γ = log σ² rather than σ: more stable, and any real value is valid.' },
    ],
    moves: {
      eq: [{ name: 'Latent loss (slide 12)', tex: String.raw`\mathscr{L} = -\frac{1}{2}\sum_{i=1}^{n}\left[1 + \gamma_i - \exp\left(\gamma_i\right) - \mu_i^2\right]`, plain: 'L = −½ Σᵢ [1 + γᵢ − exp(γᵢ) − μᵢ²], summed over the n codings', line: 5 }],
      say: 'Training minimises reconstruction MSE (from compile) plus the latent loss (from add_loss): codings stay close to N(0, I), so decoding random codings gives new images.',
      forWhat: 'Generating new data, e.g. new Fashion-MNIST-like images from random codings.',
    },
    slideCheck: 'The # *** lines are the lecturer’s Keras 3 change: Géron’s Sampling only samples, and he adds the loss to the model instead. codings_size isn’t set on these slides; slide 16 says the codings are 10-dimensional.',
    xref: [{ to: 'p2-vae', text: 'Project 2’s VAE uses the same layer' }],
  },
  {
    id: 'gan-build',
    title: 'A GAN: generator, discriminator, and the two together',
    rating: 'core',
    why: 'Draw both networks, count them, and explain each output activation and what gan = Sequential([generator, discriminator]) does.',
    sources: [{ kind: 'lecture', lec: 6, slides: '23–24' }],
    blocks: ['L6-7 s23', 'L6-7 s24'],
    provenance: 'verbatim',
    inv: ['l67-gan-build', 'l67-gan-compile'],
    file: 'gan.py',
    code: `codings_size = 30
from tensorflow.keras.layers import Dense
generator = tf.keras.Sequential([
    Dense(100, activation="relu", kernel_initializer="he_normal"),
    Dense(150, activation="relu", kernel_initializer="he_normal"),
    Dense(28 * 28, activation="sigmoid"),
    tf.keras.layers.Reshape([28, 28])
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Flatten(),
    Dense(150, activation="relu", kernel_initializer="he_normal"),
    Dense(100, activation="relu", kernel_initializer="he_normal"),
    Dense(1, activation="sigmoid")
])
gan = tf.keras.Sequential([generator, discriminator])
discriminator.compile(loss="binary_crossentropy", optimizer="rmsprop")`,
    marks: [
      { n: 1, lines: [1, 1], say: 'The generator’s input: 30 random numbers (noise) per image.' },
      { n: 2, token: { line: 6, text: 'Dense(28 * 28, activation="sigmoid")' }, say: 'Fake pixel values in [0, 1], like the real scaled images.' },
      { n: 3, token: { line: 13, text: 'Dense(1, activation="sigmoid")' }, say: 'The probability that the image is real: a binary classifier, so binary cross-entropy.' },
      { n: 4, lines: [15, 15], say: 'Noise → fake image → realness score; training gan updates the generator through the discriminator.' },
    ],
    moves: {
      draw: 'ganDense',
      count: 'ganDense',
      forWhat: 'Generating realistic images: the generator learns to fool a discriminator that learns to spot fakes.',
    },
    slideCheck: 'Neither network declares an input shape, so Keras builds them on first use; the table assumes 30 codings in. Slide 24 compiles gan the same way, also with binary cross-entropy and RMSprop.',
  },
  {
    id: 'gan-train',
    title: 'Training a GAN: two phases per batch',
    rating: 'core',
    why: 'Explain the two training phases, the labels each phase uses, and why the discriminator is frozen in phase 2.',
    sources: [{ kind: 'lecture', lec: 6, slides: '24–25' }],
    blocks: ['L6-7 s25'],
    provenance: 'trimmed',
    inv: ['l67-train-gan'],
    file: 'train_gan.py',
    code: `        for X_batch in dataset:
            ### phase 1 - training the discriminator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            generated_images = generator(noise)
            X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)
            y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
            discriminator.trainable = True  # *** this line is missing in the author’s code
            discriminator.train_on_batch(X_fake_and_real, y1)
            ### phase 2 - training the generator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            y2 = tf.constant([[1.]] * batch_size)
            # discriminator now needs to be non-trainable so that training gan
            # will result in training the generator only.
            discriminator.trainable = False  # *** this line is missing in the author’s code
            gan.train_on_batch(noise, y2)`,
    marks: [
      { n: 1, lines: [5, 5], say: 'A batch of fakes then a batch of real images: (64, 28, 28) for a batch size of 32.' },
      { n: 2, token: { line: 6, text: '[[0.]] * batch_size + [[1.]] * batch_size' }, say: 'Phase 1 labels: fake = 0, real = 1; one discriminator step.' },
      { n: 3, token: { line: 11, text: '[[1.]] * batch_size' }, say: 'Phase 2 labels the fakes “real”: the generator learns to make the discriminator say 1.' },
      { n: 4, lines: [14, 15], say: 'Freeze the discriminator so training gan changes only the generator.' },
    ],
    moves: {
      shapes: [
        { name: 'noise', shape: '(32, 30)', means: 'batch_size × codings_size (32 and 30 here)' },
        { name: 'X_fake_and_real', shape: '(64, 28, 28)', means: '32 fakes then 32 real images' },
        { name: 'y1, y2', shape: '(64, 1), (32, 1)', means: '0s then 1s; all 1s' },
      ],
      forWhat: 'The adversarial game: alternately improve the critic, then the forger, one batch at a time.',
    },
    slideCheck: 'The two # *** lines are the lecturer’s fix; Géron sets discriminator.trainable = False once, before compiling gan. The loop’s outer lines (def train_gan, for epoch …) are cut here.',
  },
  {
    id: 'dcgan',
    title: 'A DCGAN: transposed convolutions and the guidelines',
    rating: 'core',
    why: 'Give the generator’s shapes (7 → 14 → 28) and point at the DCGAN guidelines the code follows, or doesn’t.',
    sources: [{ kind: 'lecture', lec: 6, slides: '28–29' }],
    blocks: ['L6-7 s29'],
    provenance: 'trimmed',
    inv: ['l67-dcgan'],
    file: 'dcgan.py',
    code: `generator = tf.keras.Sequential([
    tf.keras.layers.Dense(7 * 7 * 128),
    tf.keras.layers.Reshape([7, 7, 128]),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,
                                    padding="same", activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,
                                    padding="same", activation="tanh"),
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.Conv2D(64, kernel_size=5, strides=2, padding="same",
                        activation=tf.keras.layers.LeakyReLU(0.2)),
# …
    tf.keras.layers.Dense(1, activation="sigmoid")
])`,
    marks: [
      { n: 1, lines: [2, 3], say: 'Project the 100 codings up to 7 × 7 × 128 feature maps.' },
      { n: 2, lines: [5, 6], say: 'A strided transposed conv upsamples 7 → 14 (guideline: no pooling); BN in the generator.' },
      { n: 3, token: { line: 9, text: 'activation="tanh"' }, say: 'Outputs in [−1, 1], so the training images must be rescaled to [−1, 1] too.' },
      { n: 4, token: { line: 13, text: 'LeakyReLU(0.2)' }, say: 'Leaky ReLU in the discriminator, as the guidelines say; strided convs replace pooling.' },
    ],
    moves: {
      count: 'dcganGenerator',
      shapes: [
        { name: 'generator', shape: '(None, 100) → (28, 28, 1)', means: '6,272 → 7 × 7 × 128 → 14 × 14 × 64 → 28 × 28 × 1' },
        { name: 'discriminator', shape: '(28, 28, 1) → (1,)', means: '14 × 14 × 64 → 7 × 7 × 128 → 6,272 → 1' },
      ],
      forWhat: 'Generating images with convolutional networks, which are steadier to train than dense GANs.',
    },
    slideCheck: 'The guidelines put BN in the discriminator too (not its input layer); this code uses Dropout(0.4) there instead. codings_size = 100 is set just above the generator.',
  },
];
