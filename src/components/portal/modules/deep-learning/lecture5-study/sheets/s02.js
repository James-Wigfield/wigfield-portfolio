// §2 · Efficient data representations: encoder, decoder, undercomplete (slides 5–7)
export default {
  blocks: [
    {
      id: 'idea',
      h: 'Efficient representations',
      at: '5',
      items: [
        'Like a chess expert who remembers a position by its patterns, an autoencoder learns efficient latent representations of its inputs.',
      ],
    },
    {
      id: 'parts',
      h: 'Encoder and decoder',
      at: '6',
      fig: { key: 'fig171', hl: ['code'], cap: 'Figure 17-1 (right): label the inputs, the two coding neurons, the encoder and the decoder.', place: 'side' },
      items: [
        'An autoencoder has the architecture of an MLP, but its output layer has as many neurons as its input layer.',
        'The encoder turns the inputs into {g|codings}, the latent representation.',
        'The decoder turns the codings back into outputs, called the reconstructions.',
        'The cost function contains a {g|reconstruction loss}, which penalises reconstructions that differ from the inputs.',
      ],
      margin: [
        { q: 'In Figure 17-1, which layer is the encoder and which is the decoder?', a: 'The hidden layer of two neurons is the encoder; the output layer of three neurons is the decoder.' },
      ],
    },
    {
      id: 'under',
      h: 'Undercomplete',
      at: '7',
      items: [
        'When the codings have fewer dimensions than the inputs (2D instead of 3D), the autoencoder is {g|undercomplete}.',
        'It cannot simply copy its inputs into the codings, so it must learn the most important features and drop the unimportant ones.',
      ],
      margin: [
        { q: 'Why can’t an undercomplete autoencoder just copy its inputs?', a: 'Its codings have fewer dimensions than its inputs (2 against 3 in Figure 17-1), so it has to keep the most important features and drop the rest.' },
      ],
    },
  ],
  skip: 'slide 5’s two number sequences.',
};
