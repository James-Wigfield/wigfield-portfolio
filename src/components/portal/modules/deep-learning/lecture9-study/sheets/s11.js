// §11 · MDPs, Bellman, value iteration (slides 41–44)
export default {
  blocks: [
    {
      id: 'mdp',
      h: 'MDPs',
      at: '41–42',
      fig: { key: 'mdp', hl: ['fire'], cap: 'Figure 18-8, simplified: its three rewards.' },
      items: [
        'A Markov chain where the agent {g|chooses an action}: transitions depend on it, and some give {g|rewards}.',
      ],
    },
    {
      id: 'bellman',
      h: 'Bellman optimality equation',
      at: '42–43',
      items: [
        { formula: "V^*(s) = \\max_a \\sum_{s'} T(s,a,s') \\left[ R(s,a,s') + \\gamma V^*(s') \\right]", read: 'the best action’s expected reward plus the discounted optimal value of where it leads' },
      ],
      margin: [
        { q: 'What are $T(s,a,s\')$ and $R(s,a,s\')$?', a: 'The probability of going from $s$ to $s\'$ when choosing $a$, and the reward for that transition.' },
      ],
    },
    {
      id: 'vi',
      h: 'Value iteration',
      at: '43–44',
      items: [
        { formula: "V_{k+1}(s) \\leftarrow \\max_a \\sum_{s'} T(s,a,s') \\left[ R(s,a,s') + \\gamma V_k(s') \\right]" },
        'Repeat until it {g|converges} to the optimal state values (dynamic programming).',
      ],
    },
  ],
  skip: 'Figure 18-8 in full (every probability) and slide 42’s guess at the best strategy.',
};
