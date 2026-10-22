// §2 · Bidirectional RNNs and LSTMs (slides 7–8)
export default {
  blocks: [
    {
      id: 'bi',
      h: 'Bidirectional layer',
      at: '7',
      fig: { key: 'birnn', hl: ['cat'], cap: 'Figure 16-5: label the forward and backward cells and the concatenation.', place: 'side' },
      items: [
        'Run two recurrent layers on the same inputs, one left to right and one right to left.',
        'At each step, {g|concatenate} their two outputs, so each output has seen both sides.',
      ],
    },
    {
      id: 'states',
      h: 'Four states into two',
      at: '8',
      items: [
        'A bidirectional LSTM encoder returns four states: short-term and long-term, forward and backward.',
        'The decoder can’t be bidirectional, so concatenate the two short-term states and the two long-term states:',
        { code: 'Concatenate(axis=-1)(encoder_state[::2])   # short-term (0&2)\nConcatenate(axis=-1)(encoder_state[1::2])  # long-term  (1&3)', read: 'the states come out as [h →, c →, h ←, c ←]' },
      ],
      margin: [
        { q: 'Which items of `encoder_state` does `[1::2]` pick, and what are they?', a: 'Items 1 and 3: the forward and backward long-term states.' },
      ],
    },
  ],
  skip: 'slide 8’s full listings.',
};
