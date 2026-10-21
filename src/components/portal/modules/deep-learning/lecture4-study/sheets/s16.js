// §16 · Summary (slides 51–52)
export default {
  blocks: [
    {
      id: 'outcomes',
      h: 'Learning outcomes',
      at: '51',
      items: [
        {
          table: {
            head: ['understand …', '§'],
            cols: 'minmax(0, 24rem) minmax(max-content, 8rem)',
            rows: [
              ['recurrent neurons & memory cells', '§1–§3'],
              ['input & output sequences in a RNN', '§4'],
              ['the difficulty of training over many time steps', '§12, §13.1'],
              ['the LSTM & GRU architectures', '§13, §14'],
            ],
          },
        },
        {
          table: {
            head: ['know …', '§'],
            cols: 'minmax(0, 24rem) minmax(max-content, 8rem)',
            rows: [
              ['when it would be suitable to use RNNs', '§1, §4'],
              ['how to implement a simple RNN in TensorFlow', '§8'],
              ['how to handle variable length input & output sequences', '§1, §4, §8, §11'],
              ['how to train a simple RNN to predict time series', '§5–§8, §10, §11'],
              ['how to build a deep RNN', '§9'],
              ['how to use 1D conv layers to process sequences', '§15'],
            ],
          },
        },
      ],
    },
    {
      id: 'next',
      h: 'Next',
      at: '52',
      items: [
        'read up to Chapter 17: *Autoencoders, GANs, and Diffusion Models* (to page 647)',
      ],
    },
  ],
};
