// §6 · Attention: a shorter path (Bahdanau) (slides 18–23)
export default {
  blocks: [
    {
      id: 'idea',
      h: 'The attention idea',
      at: '18–20',
      items: [
        'Without attention, “soccer” is carried through many steps before “fútbol” is written: a long path.',
        'Attention sends {g|all} the encoder’s outputs to the decoder, which at each step takes a {g|weighted sum} of them: a much shorter path.',
      ],
    },
    {
      id: 'align',
      h: 'The alignment model',
      at: '21–22',
      fig: { key: 'bahdanau', hl: ['align'], cap: 'Figure 16-7, simplified: the weighted sum into the decoder, and the alignment model.' },
      items: [
        '$\\alpha(t, i)$ is the weight of encoder output $i$ at decoder step $t$.',
        'A small network, the {g|alignment model} (a Dense layer with one neuron), scores each $\\mathbf{y}_{(i)}$ with the decoder’s previous state $\\mathbf{h}$; a softmax turns the scores into the weights.',
      ],
      margin: [
        { q: 'At step 3 (“fútbol”), which weight is largest, and why?', a: '$\\alpha_{(3,2)}$, for “soccer”: after “me gusta el” the decoder expects a noun, and “soccer” aligns best with its state.' },
        { sc: 'slide 22 writes “the three cores”: scores.' },
      ],
    },
    {
      id: 'name',
      h: 'Bahdanau attention',
      at: '23',
      items: [
        'It concatenates $\\mathbf{y}$ and $\\mathbf{h}$, so it is also called {g|concatenative} or {g|additive} attention.',
      ],
    },
  ],
  skip: 'slide 19’s history (2014, long sentences of over 30 words) and the notation shifts across slides 21–25 (see the Slide check).',
};
