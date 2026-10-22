// §4 · An encoder–decoder for bus/rail: training vs testing (slides 12–13)
export default {
  blocks: [
    {
      id: 'stages',
      h: 'Training vs testing stage',
      at: '12–13',
      items: [
        'The encoder reads 55 days (Day 0–54); the decoder predicts the next 14 days (Day 56–69).',
        {
          table: {
            head: ['stage', 'decoder inputs', 'outputs compared with'],
            rows: [
              ['training', 'Day 55, then `y_train` shifted by one', '`y_train` (minimise MSE)'],
              ['testing', 'Day 55, then zeros replaced by {g|estimates}', '`y_test` (the error)'],
            ],
          },
        },
        'At testing, the model runs 14 times; each new estimate replaces the decoder’s input for the next day.',
      ],
      margin: [
        { q: 'Why can’t the testing stage feed in the true days?', a: 'At test time the future values are unknown, so only Day 55 is real; each prediction is fed in as the next input.' },
        { sc: '55 vs 56 days: Day 55 goes to the decoder, so the input still covers 56 days.' },
      ],
    },
  ],
  skip: 'the handwritten notes word for word, and the `X_test` (slide 13) vs `X_valid` (slide 17) naming.',
};
