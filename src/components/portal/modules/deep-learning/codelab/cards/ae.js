// Code Lab cards: tab 7 · Autoencoders (L5, L6–7). Sparse autoencoders are
// not examined (L5 s27); tied weights (L5 s20–21) are noted on the stacked card.
export const AE = [
  {
    id: 'linear-ae',
    title: 'A linear autoencoder performs PCA',
    rating: 'core',
    why: 'Draw the 3 → 2 → 3 network, count it, and explain why linear activations with MSE make the codings a PCA projection.',
    sources: [{ kind: 'lecture', lec: 5, slides: '8–9' }],
    blocks: ['L5 s8', 'L5 s9'],
    provenance: 'trimmed',
    inv: ['l5-linear-ae-pca', 'l5-linear-ae-fit'],
    file: 'linear_ae.py',
    code: `encoder = tf.keras.models.Sequential([tf.keras.layers.Dense(2)])
decoder = tf.keras.models.Sequential([tf.keras.layers.Dense(3)])
autoencoder = tf.keras.Sequential([encoder, decoder])

optimizer = tf.keras.optimizers.SGD(learning_rate=0.5)
autoencoder.compile(loss="mse", optimizer=optimizer)
X_train = [...]  # shape of X_train is (60,3) in the example above
history = autoencoder.fit(X_train, X_train, epochs=500, verbose=False)
codings = encoder.predict(X_train)`,
    marks: [
      { n: 1, token: { line: 1, text: 'Dense(2)' }, say: 'A 3 → 2 bottleneck with no activation: linear and undercomplete.' },
      { n: 2, token: { line: 2, text: 'Dense(3)' }, say: 'As many outputs as inputs: the decoder reconstructs the 3-D point.' },
      { n: 3, token: { line: 8, text: 'fit(X_train, X_train' }, say: 'The input is its own target, so no labels are needed.' },
      { n: 4, lines: [9, 9], say: 'The encoder alone projects the data onto the learned plane: codings of shape (60, 2).' },
    ],
    moves: {
      draw: 'linearAe',
      count: 'linearAe',
      forWhat: 'Dimensionality reduction: with linear activations and MSE, the encoder projects the data onto the same plane as PCA’s first two components; the 2-D codings are coordinates in that plane.',
    },
    slideCheck: 'The slides never give the data; slide 9’s comment fixes X_train at (60, 3). The two Sequential spellings (tf.keras.models.Sequential, tf.keras.Sequential) are the same class.',
  },
  {
    id: 'stacked-ae',
    title: 'A stacked autoencoder for Fashion MNIST',
    rating: 'core',
    why: 'Draw the encoder and decoder, count 163,814 parameters, and say what the 30-unit coding layer is for.',
    sources: [{ kind: 'lecture', lec: 5, slides: '12' }, { kind: 'lecture', lec: 5, slides: '20–21' }],
    blocks: ['L5 s12'],
    provenance: 'verbatim',
    inv: ['l5-stacked-ae', 'l5-tied-ae'],
    file: 'stacked_ae.py',
    code: `stacked_encoder = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28,28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(30, activation="relu"),
])
stacked_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(28 * 28),
    tf.keras.layers.Reshape([28, 28])
])
stacked_ae = tf.keras.Sequential([stacked_encoder, stacked_decoder])

stacked_ae.compile(loss="mse", optimizer="nadam")
history = stacked_ae.fit(X_train, X_train, epochs=20,
                         validation_data=(X_valid, X_valid))`,
    marks: [
      { n: 1, token: { line: 5, text: 'Dense(30, activation="relu")' }, say: 'The 30-unit coding layer: the bottleneck between encoder and decoder.' },
      { n: 2, token: { line: 9, text: 'Dense(28 * 28)' }, say: '784 linear outputs, one per pixel: (100 + 1) × 784 = 79,184.' },
      { n: 3, token: { line: 10, text: 'Reshape([28, 28])' }, say: 'Back to the image’s shape, so the output can be compared with the input.' },
      { n: 4, token: { line: 15, text: 'fit(X_train, X_train' }, say: 'Trained to reproduce its own input, under MSE.' },
    ],
    moves: {
      draw: 'stackedAe',
      count: 'stackedAe',
      forWhat: 'Learning compact codings (30 numbers per image) for visualisation, compression or unsupervised pretraining.',
    },
    slideCheck: 'Slide 12 prints 163,814 trainable parameters. Tying each decoder layer to its encoder twin’s transposed weights (slides 20–21, DenseTranspose) leaves 82,414: 163,814 − (30 × 100 + 100 × 784), since only the new biases remain.',
  },
  {
    id: 'conv-ae',
    title: 'A convolutional autoencoder: pooling down, transposed convs up',
    rating: 'core',
    why: 'Track the shapes through the encoder and decoder, including the transposed conv that turns 3 × 3 into 7 × 7.',
    sources: [{ kind: 'lecture', lec: 6, slides: '5–6' }],
    blocks: ['L6-7 s5'],
    provenance: 'trimmed',
    inv: ['l67-conv-ae', 'l67-conv-decoder-summary'],
    file: 'conv_ae.py',
    code: `conv_encoder = tf.keras.Sequential([
    tf.keras.layers.Reshape([28, 28, 1]),
# …
    tf.keras.layers.MaxPool2D(pool_size=2),  # output: 3 × 3 × 64
    tf.keras.layers.Conv2D(30, 3, padding="same", activation="relu"),  # output: 3 × 3 × 30
    tf.keras.layers.GlobalAvgPool2D()  # output: 30
])
conv_decoder = tf.keras.Sequential([
    tf.keras.layers.Dense(3 * 3 * 16),     # 144 neurons
    tf.keras.layers.Reshape((3, 3, 16)),   # output: 3 × 3 × 16
    tf.keras.layers.Conv2DTranspose(32, 3, strides=2, activation="relu"), # output: 7 × 7 × 32
# …
    tf.keras.layers.Conv2DTranspose(1, 3, strides=2, padding="same"),   # output: 28 × 28 × 1
    tf.keras.layers.Reshape([28, 28])
])`,
    marks: [
      { n: 1, lines: [4, 4], say: 'Pooling a 7 × 7 map by 2 rounds down to 3 × 3.' },
      { n: 2, token: { line: 6, text: 'GlobalAvgPool2D()' }, say: 'Averages each 3 × 3 map: a 30-number coding.' },
      { n: 3, token: { line: 11, text: 'Conv2DTranspose(32, 3, strides=2, activation="relu")' }, say: 'Valid padding: (3 − 1) × 2 + 3 = 7, so 3 × 3 grows to 7 × 7.' },
      { n: 4, token: { line: 13, text: 'padding="same"' }, say: 'Same padding with stride 2 doubles the size exactly, 14 → 28, into one linear channel.' },
    ],
    moves: {
      count: 'convDecoder',
      say: 'Encoder: 28 × 28 × 16 → 14 × 14 × 16 → 14 × 14 × 32 → 7 × 7 × 32 → 7 × 7 × 64 → 3 × 3 × 64 → 3 × 3 × 30 → 30. Counted: the decoder.',
      forWhat: 'Autoencoding images: convolutions keep spatial structure, with far fewer parameters (54,479 vs 163,814).',
    },
    slideCheck: 'Slide 6 prints the decoder’s 13,873 parameters and conv_ae.count_params() = 54,479. A denoising autoencoder adds Gaussian noise or dropout to the input (slide 8; slide 9 codes Dropout(0.5)) and still trains on the clean images.',
    xref: [{ to: 'dcgan', text: 'DCGAN’s generator upsamples the same way' }],
  },
];
