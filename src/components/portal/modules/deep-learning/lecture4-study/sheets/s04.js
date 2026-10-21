// §4 · Input and output sequences (slides 12–13)
export default {
  blocks: [
    {
      id: 'modes',
      h: 'Sequences in & out',
      at: '12–13',
      fig: { key: 'seqModes', hl: ['ed'], cap: 'Figure 15-4 · the four set-ups; the encoder–decoder in green', place: 'above' },
      items: [
        {
          table: {
            head: ['in → out', 'e.g.'],
            cols: 'minmax(0, 1fr) minmax(0, 1fr)',
            rows: [
              ['seq → seq', '$N$ days of stock prices → prices shifted one day into the future'],
              ['seq → vector: one output, at the {g|last} step', 'movie review → sentiment score (0 bad … 4 good)'],
              ['vector → seq: one input at $t = 0$, then zeros', 'image → caption'],
              ['encoder–decoder: {g|encoder} (seq → vector), then {g|decoder} (vector → seq)', 'translating a sentence'],
            ],
          },
        },
      ],
      margin: [
        { nb: 'an input is just a vector (or a number), so is an output' },
        { q: 'Which mode turns a movie review into a sentiment score?', a: 'Sequence-to-vector: only the output at the last step is used.' },
        { q: 'What are the two halves of an encoder–decoder?', a: 'An encoder (sequence-to-vector) followed by a decoder (vector-to-sequence).' },
        { sc: 'item 1 is garbled; read it as: outputs = the inputs one day on.' },
      ],
    },
    {
      id: 'fig',
      h: 'Reading Figure 15-4',
      at: '13',
      items: [
        'time runs left → right; inputs enter below, outputs leave above',
        'outputs the task doesn’t need: {g|ignored} (dashed)',
        'the decoder is fed {g|zeros} as inputs',
      ],
      margin: [
        { ne: 'vector → seq: Fig. 15-4 feeds X every step ≠ slide 12: X, then zeros' },
        { sc: 'the top-left panel prints $x_{(0)}$, unhatted $Y_{(0)}$; drawn here like the rest.' },
      ],
    },
  ],
};
