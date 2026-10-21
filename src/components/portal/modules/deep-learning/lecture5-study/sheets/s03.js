// §3 · PCA with an undercomplete linear autoencoder (slides 8–9)
export default {
  blocks: [
    {
      id: 'pca',
      h: 'A linear autoencoder performs PCA',
      at: '8',
      items: [
        'With only linear activations and the MSE as the cost function, an autoencoder ends up performing {g|PCA}.',
        'The example uses a `Dense(2)` encoder and a `Dense(3)` decoder, with no activation function, `loss="mse"` and `SGD(learning_rate=0.5)`.',
        'Its number of outputs equals its number of inputs (3).',
      ],
      margin: [
        { q: 'What two choices make an autoencoder perform PCA?', a: 'Linear activations (no activation function) and the MSE as the cost function.' },
      ],
    },
    {
      id: 'train',
      h: 'Training it',
      at: '9',
      items: [
        { code: 'autoencoder.fit(X_train, X_train, epochs=500, verbose=False)', read: 'the inputs are also the {g|targets}' },
        { code: 'codings = encoder.predict(X_train)', read: 'each 3D point’s 2D coding' },
        'The codings are each point’s 2D position on a plane: an approximate PCA.',
      ],
      margin: [
        { nb: 'It finds PCA’s plane, but its two coding axes need not be the principal components (this page’s clarification).' },
      ],
    },
  ],
  skip: 'the rest of slide 8’s listing, and slide 9’s two plots.',
};
