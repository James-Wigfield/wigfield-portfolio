// §12 · Q-values and Q-value iteration (slides 45–49)
export default {
  blocks: [
    {
      id: 'q',
      h: 'Q-values',
      at: '45–46',
      items: [
        '$Q^*(s, a)$: the expected discounted future rewards after choosing $a$ in $s$, {g|then acting optimally}.',
        { formula: "Q_{k+1}(s,a) \\leftarrow \\sum_{s'} T(s,a,s') \\left[ R(s,a,s') + \\gamma \\max_{a'} Q_k(s',a') \\right]" },
        { formula: '\\pi^*(s) = \\operatorname*{argmax}_a Q^*(s,a)', read: 'in each state, take the action with the highest Q-value' },
      ],
    },
    {
      id: 'result',
      h: 'Figure 18-8’s result',
      at: '47–49',
      items: [
        'Start at 0 ($-\\infty$ for impossible actions) and run 50 iterations.',
        {
          table: {
            head: ['$\\gamma$', 'argmax', 'in $s_1$'],
            rows: [
              ['0.90', '[0, 0, 1]', '$a_0$: stay put'],
              ['0.95', '[0, 2, 1]', '$a_2$: {g|into the fire}'],
            ],
          },
        },
      ],
      margin: [
        { q: 'Why can a larger $\\gamma$ send $s_1$ into the fire?', a: 'The +40 that follows counts for more, enough to outweigh the −50.' },
      ],
    },
  ],
  skip: 'the slide 47–48 listings and slide 49’s full Q-table (see the code card and the lab).',
};
