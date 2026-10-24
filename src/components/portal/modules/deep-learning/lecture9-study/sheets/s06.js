// §6 · Neural network policies (slides 23–25)
export default {
  blocks: [
    {
      id: 'net',
      h: 'A network as the policy',
      at: '23–25',
      fig: { key: 'policyNet', hl: ['out', 'sample'], cap: 'Slide 25’s network (Figure 18-5).', place: 'side' },
      items: [
        'In: the 4 observations. Out: {g|one sigmoid neuron}, the probability $p$ of action 0 (left).',
        'The action is {g|sampled}: left with $p$, right with $1 - p$. This is the exploration/exploitation dilemma.',
        'CartPole’s observation is the {g|full state}; if it weren’t (e.g. no velocity), you would also need past observations.',
      ],
      margin: [
        { sc: 'Figure 18-5 draws 4 hidden neurons; the code uses `Dense(5)`.' },
      ],
    },
  ],
};
