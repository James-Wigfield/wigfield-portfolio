// §6 · Visualizing: reconstructions and t-SNE (slides 13–15)
export default {
  blocks: [
    {
      id: 'check',
      h: 'Checking the result',
      at: '13–14',
      items: [
        'Compare the inputs with their reconstructions; if they are too lossy, train for longer, make the encoder and decoder deeper, or make the codings larger.',
        '{g|t-SNE} reduces the codings to 2D for visualisation, keeping similar instances close and dissimilar instances apart.',
      ],
    },
  ],
  skip: 'the t-SNE code and Figure 17-5.',
};
