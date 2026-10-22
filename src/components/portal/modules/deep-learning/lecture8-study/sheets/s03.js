// §3 · A bidirectional RNN on the bus/rail data (slides 9–11)
export default {
  blocks: [
    {
      id: 'model',
      h: '`simple_biRNN`',
      at: '9',
      items: [
        'Inputs: (bus, rail) over 56 days. Output: (bus, rail) on the 57th day.',
        { formula: '2 \\times (16 \\times 16 + 2 \\times 16 + 16) + (32 \\times 2 + 2) = 674', read: '`Bidirectional(SimpleRNN(16))` + `Dense(2)`', tag: 'total from slide 9; breakdown is this page’s working' },
      ],
      margin: [
        { q: 'Why does `Dense(2)` have 66 parameters?', a: 'It reads the 32 concatenated outputs (16 forward + 16 backward): 32 × 2 weights + 2 biases.' },
      ],
    },
    {
      id: 'mae',
      h: 'Results',
      at: '10–11',
      items: [
        'Validation MAE 27,936: slightly worse than Topic 4’s 27,855, which used 5 input features (bus, rail and a one-hot encoding of the day).',
        'Feeding predictions back in a loop to predict further ahead makes the errors {g|accumulate quickly} as the prediction horizon grows.',
      ],
    },
  ],
  skip: 'the training code and log, and this page’s own run.',
};
