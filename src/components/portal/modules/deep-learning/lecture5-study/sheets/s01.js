// §1 · What are autoencoders? (slide 4)
export default {
  blocks: [
    {
      id: 'what',
      h: 'What autoencoders are',
      at: '4',
      items: [
        'Autoencoders learn efficient representations of their inputs, called latent representations or {g|codings}, without any supervision.',
        {
          table: {
            head: ['use', 'what it means'],
            rows: [
              ['dimensionality reduction', 'the codings have far fewer dimensions than the inputs'],
              ['feature detectors', 'unsupervised pre-training of deep networks'],
              ['generative models', 'new data like the training data, but usually fuzzy'],
            ],
          },
        },
      ],
      margin: [
        { sc: 'slide 4 reads “latent representations codings”: a word seems to be missing.' },
      ],
    },
  ],
};
