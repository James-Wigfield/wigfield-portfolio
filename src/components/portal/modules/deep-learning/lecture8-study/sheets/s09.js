// §9 · The transformer: overview (slides 29–31)
export default {
  blocks: [
    {
      id: 'why',
      h: 'The transformer (2017)',
      at: '29',
      items: [
        '“Attention Is All You Need”: no recurrent or convolutional layers, just attention (plus embedding and dense layers).',
        'Not recurrent, so fewer vanishing/exploding gradient problems, fewer training steps, easier to parallelize, and better at long-range patterns.',
      ],
    },
    {
      id: 'arch',
      h: 'Figure 16-8',
      at: '30–31',
      fig: { key: 'transformer', hl: ['cross'], cap: 'Figure 16-8, simplified: mark where the decoder’s queries, keys and values come from.' },
      items: [
        'Through the encoder and decoder stacks the shape stays [batch size, sequence length, embedding size]; $N = 6$ in the paper.',
        'Into each multi-head attention layer, the first two arrows are the {g|keys and values}, the third the {g|queries}.',
        'Feed Forward = two Dense layers (ReLU, then no activation); each sub-layer has a skip connection and an Add & Norm.',
      ],
      margin: [
        { q: 'In the decoder’s upper attention layer, where do Q, K and V come from?', a: 'K and V from the encoder’s output; Q from the decoder’s masked attention sub-layer.' },
        { nb: 'Masked = causal: a word doesn’t attend to the words after it.' },
      ],
    },
  ],
  skip: 'footnote 7 and the embedding, Linear and Softmax boxes in detail.',
};
