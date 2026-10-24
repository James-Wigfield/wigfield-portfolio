// §17 · DQN results, catastrophic forgetting, why RL is hard (slides 65–67)
export default {
  blocks: [
    {
      id: 'forget',
      h: 'Catastrophic forgetting',
      at: '65–66',
      items: [
        'The DQN learned slowly ($\\epsilon$ high at first), reached the max, then {g|forgot}: its score dropped again (only 100 at the last episode).',
      ],
    },
    {
      id: 'hard',
      h: 'Why RL is hard',
      at: '67',
      items: [
        '{g|Training instabilities} and a huge sensitivity to {g|hyperparameters and random seeds}; state-of-the-art agents train for millions of steps.',
      ],
    },
  ],
  skip: 'the plot code (see the code card), slide 66’s episode numbers (290, 550, step 143) and Géron’s closing sentence.',
};
