// §5 · Implementing and evaluating rnn_ed (slides 14–17)
export default {
  blocks: [
    {
      id: 'rnned',
      h: '`rnn_ed`',
      at: '14',
      items: [
        'Encoder: `Bidirectional(SimpleRNN(16, return_state=True))`; its forward and backward states are concatenated into one (None, 32) state.',
        'Decoder: `SimpleRNN(32, return_sequences=True)` starts from that state, so its number of neurons must match it. `Dense(2)` gives (bus, rail) for each day.',
      ],
      margin: [
        { q: 'Why does the decoder have 32 neurons?', a: 'Its initial state is the concatenated encoder state: 16 forward + 16 backward = 32.' },
      ],
    },
    {
      id: 'eval',
      h: 'Evaluation',
      at: '15–17',
      items: [
        'Check the learning curves for over- or underfitting. With the 14-step `predict()` loop, the validation MAE is {g|34,863.8857}: the lowest so far for 14 days ahead.',
      ],
      margin: [
        { sc: 'slide 17’s `predict()` body is elided, and it calls `model` / `out_seq_length`.' },
      ],
    },
  ],
  skip: 'the full listings, the training log, the plotting code, and this page’s own run.',
};
