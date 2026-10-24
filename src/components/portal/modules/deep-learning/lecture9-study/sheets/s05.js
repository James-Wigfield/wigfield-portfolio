// §5 · A simple hard-coded policy (slides 21–22)
export default {
  blocks: [
    {
      id: 'basic',
      h: '`basic_policy`',
      at: '21–22',
      items: [
        { code: 'return 0 if angle < 0 else 1', read: 'push the way the pole leans (`angle = obs[2]`)' },
        'Over 500 episodes: mean {g|41.698} steps, best {g|63}. It never keeps the pole up for long.',
      ],
      margin: [
        { q: 'Why is an episode’s total reward its number of steps?', a: 'Every step earns a reward of 1.0.' },
      ],
    },
  ],
};
