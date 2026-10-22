// §2 · Other types of autoencoders; denoising autoencoders (slides 7–9)
export default {
  blocks: [
    {
      id: 'size',
      h: 'Undercomplete and overcomplete',
      at: '7',
      items: [
        'So far the coding layer has been kept small, making the autoencoder {g|undercomplete}.',
        'With other constraints, the coding layer can be as large as the inputs, or larger: an {g|overcomplete} autoencoder.',
      ],
    },
    {
      id: 'dae',
      h: 'Denoising autoencoders',
      at: '8–9',
      fig: { key: 'dae', hl: ['noise', 'dropout'], cap: 'Figure 17-8: label where the noise goes in, in each stack.', place: 'side' },
      items: [
        'Add noise to the inputs, and train the autoencoder to recover the original, noise-free inputs.',
        'The noise can be Gaussian noise added to the inputs, or randomly switched-off inputs, as in {g|dropout}.',
        { code: 'tf.keras.layers.Dropout(0.5)', read: 'slide 9: half the inputs switched off, in the encoder' },
      ],
      margin: [
        { q: 'What are the targets when training `dropout_ae`?', a: 'The clean images: `dropout_ae.fit(X_train, X_train, …)`. The noise is added inside the encoder, by the `Dropout` layer.' },
      ],
    },
  ],
  skip: 'slide 7’s recap, the 2010 paper, the rest of slide 9’s listing and Figure 17-9.',
};
