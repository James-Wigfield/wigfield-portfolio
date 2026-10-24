// §15 · Approximate Q-learning (slides 58–60)
export default {
  blocks: [
    {
      id: 'approx',
      h: 'Approximate Q-learning',
      at: '58–60',
      items: [
        'Q-tables don’t scale, so approximate them with $Q_\\theta(s, a)$: a manageable number of parameters $\\theta$. A DNN that does it is a {g|deep Q-network} (DQN).',
        { formula: "y(s,a) = r + \\gamma \\max_{a'} Q_{\\boldsymbol{\\theta}}(s',a')", read: 'the target Q-value (Eq. 18-7)' },
        'Train $Q_\\theta(s, a)$ toward $y$ by minimising the {g|squared error} (or the Huber loss).',
      ],
      margin: [
        { q: 'Where does the target’s future part come from?', a: 'Run the DQN on the next state $s\'$ for all actions $a\'$, take the highest, and discount it by $\\gamma$ (slide 60).' },
      ],
    },
  ],
};
