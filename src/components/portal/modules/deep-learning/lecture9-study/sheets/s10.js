// §10 · Markov chains (slides 38–40)
export default {
  blocks: [
    {
      id: 'chain',
      h: 'Markov chains',
      at: '38–40',
      fig: { key: 'chain', hl: ['loops'], cap: 'Figure 18-7: arrow = probability; $s_3$ only leads back to itself.', place: 'side' },
      items: [
        'From here on the agent estimates the expected discounted future rewards of each state (or each action in each state), then acts on them.',
        'A {g|Markov chain} has no memory: the next state depends only on the current one, with fixed probabilities.',
        { formula: '\\begin{bmatrix} 0.7 & 0.2 & 0.0 & 0.1 \\\\ 0.0 & 0.0 & 0.9 & 0.1 \\\\ 0.0 & 1.0 & 0.0 & 0.0 \\\\ 0.0 & 0.0 & 0.0 & 1.0 \\end{bmatrix}', read: 'row = from, column = to ($s_0 \\ldots s_3$); {g|each row sums to 1}', tag: 'Figure 18-7' },
      ],
      margin: [
        { sc: 'slide 40’s “(row 2, column 3)” counts from 1: it is $s_1 \\to s_2$.' },
      ],
    },
  ],
  skip: 'Andrey Markov’s history (early 20th century).',
};
