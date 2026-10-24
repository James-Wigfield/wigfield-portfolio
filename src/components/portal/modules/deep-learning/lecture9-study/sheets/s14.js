// §14 · Q-learning, off- vs on-policy, ε-greedy (slides 53–57)
export default {
  blocks: [
    {
      id: 'ql',
      h: 'Q-learning',
      at: '53–55',
      items: [
        { formula: "Q_{k+1}(s,a) \\leftarrow (1-\\alpha) Q_k(s,a) + \\alpha \\left( r + \\gamma \\max_{a'} Q_k(s',a') \\right)" },
        'Q-value iteration converged in under 20 iterations; Q-learning took {g|about 8,000} (it doesn’t know $T$ or $R$).',
      ],
    },
    {
      id: 'vs',
      h: 'Policy gradients vs Q-learning',
      at: '38, 56',
      items: [
        {
          table: {
            head: ['', 'policy gradients', 'Q-learning'],
            rows: [
              ['learns', 'the policy, directly', 'Q-values, then acts greedily'],
              ['exploring', '{g|on-policy}: with the policy being trained', '{g|off-policy}: can learn by watching random play'],
            ],
          },
        },
      ],
    },
    {
      id: 'eps',
      h: '$\\epsilon$-greedy',
      at: '57',
      items: [
        'Explore randomly with probability $\\epsilon$, otherwise take the highest-Q action; $\\epsilon$ starts {g|near 1} and decays to a small value (e.g. 0.05).',
      ],
      margin: [
        { q: 'Why can’t Q-learning just act greedily from the start?', a: 'It only works if the exploration policy explores the MDP thoroughly (slide 57).' },
      ],
    },
  ],
};
