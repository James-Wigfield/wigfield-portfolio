// §16 · Deep Q-learning in tf.keras (slides 61–64)
export default {
  blocks: [
    {
      id: 'buf',
      h: 'Replay buffer',
      at: '61–62',
      items: [
        'Store every experience in `deque(maxlen=2000)`, and train on {g|random batches of 32} from it.',
      ],
      margin: [
        { sc: 'slide 61 lists 5 fields per experience; the code stores 6 (with `truncated`).' },
      ],
    },
    {
      id: 'step',
      h: '`training_step`',
      at: '63',
      fig: { key: 'dqnStep', hl: ['target'], cap: 'Slide 63: the target from the next states, Q(s, a) from the states, then MSE.' },
      items: [
        { code: 'runs = 1.0 - (dones | truncateds)', read: 'no future term where the episode ended' },
      ],
    },
    {
      id: 'loop',
      h: 'Training',
      at: '64',
      items: [
        { code: 'epsilon = max(1 - episode / 500, 0.01)', read: 'from 1 down to 0.01; train only after episode 50' },
      ],
    },
  ],
  skip: 'the DQN’s layers (two `Dense(32, "elu")`, then one output per action) and the code line by line (see the code cards).',
};
