// §7 · The credit assignment problem (slides 26–29)
export default {
  blocks: [
    {
      id: 'credit',
      h: 'Credit assignment',
      at: '26–27',
      fig: { key: 'returns', hl: ['ret'], cap: 'Figure 18-6: each return is the reward plus 0.8 × the next return.' },
      items: [
        'Rewards are sparse and delayed, so which actions deserve the credit (or blame)? This is the {g|credit assignment problem}.',
        'Score each action by the {g|sum of the discounted rewards that come after it}.',
        { title: '$\\gamma = 0.8$, rewards 10, 0, −50 (slide 26)', worked: ['$10 + 0.8 \\times 0 + 0.8^2 \\times (-50) =$ {g|−22}'] },
      ],
    },
    {
      id: 'gamma',
      h: 'Choosing $\\gamma$',
      at: '28',
      items: [
        '$\\gamma$ near 0: only immediate rewards count. $\\gamma$ near 1: far-future rewards count almost as much.',
        '$0.95^{13} \\approx 0.5$ and $0.99^{69} \\approx 0.5$ (half weight 13 or 69 steps ahead); CartPole uses {g|0.95}.',
      ],
    },
    {
      id: 'adv',
      h: 'Action advantage',
      at: '29',
      items: [
        'Run many episodes and {g|normalise} all the scores (subtract the mean, divide by the standard deviation): the {g|action advantage}. Negative = bad action, positive = good.',
      ],
      margin: [
        { q: 'Why normalise over many episodes?', a: 'A good action can be followed by bad ones and get a low score; on average over many episodes, good actions score better (slide 29).' },
      ],
    },
  ],
};
