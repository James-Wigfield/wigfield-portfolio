// §12 · Multi-head attention (slide 39)
export default {
  blocks: [
    {
      id: 'mha',
      h: 'Multi-head attention',
      at: '39',
      fig: { key: 'mha', hl: ['split', 'concat'], cap: 'Figure 16-10: label V, K, Q, Split, H and Concat.', place: 'side' },
      items: [
        'V, K and Q each go through a Linear layer, are {g|split} into $H$ parts (the heads), attended to separately, then {g|concatenated} and passed through a final Linear layer.',
        'The heads can capture different characteristics of the words (e.g. “like” is a verb, and it is in the present tense).',
      ],
      margin: [
        { q: 'What does $H$ control?', a: 'The number of heads: how many parts V, K and Q are split into.' },
      ],
    },
  ],
  skip: 'slide 39’s note on 3D tensors in training.',
};
