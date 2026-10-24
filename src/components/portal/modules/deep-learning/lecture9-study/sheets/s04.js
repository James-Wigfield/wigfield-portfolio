// §4 · OpenAI Gym and CartPole (slides 16–20)
export default {
  blocks: [
    {
      id: 'cart',
      h: 'CartPole',
      at: '17–19',
      items: [
        {
          table: {
            head: ['obs', 'meaning'],
            rows: [
              ['`obs[0]`', 'cart position (0.0 = centre)'],
              ['`obs[1]`', 'cart velocity (positive = right)'],
              ['`obs[2]`', 'pole angle (0.0 = vertical)'],
              ['`obs[3]`', 'angular velocity (positive = clockwise)'],
            ],
          },
        },
        'Two actions, `Discrete(2)`: {g|0 = accelerate left}, {g|1 = accelerate right}.',
      ],
    },
    {
      id: 'step',
      h: 'One step',
      at: '20',
      items: [
        { code: 'obs, reward, done, truncated, info = env.step(action)', read: 'a reward of 1.0 per step; `done` = the episode is over' },
      ],
      margin: [
        { q: 'What does `env.reset(seed=42)` return?', a: '`obs, info`: the first observation and an empty dictionary (slide 17).' },
      ],
    },
  ],
  skip: 'installing gymnasium, and `render()` with `imshow` (slides 16 and 18).',
};
