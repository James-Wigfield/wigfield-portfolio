// §13 · Temporal difference learning (slides 50–52)
export default {
  blocks: [
    {
      id: 'td',
      h: 'TD learning',
      at: '50–52',
      items: [
        'The agent doesn’t know $T$ or $R$: it learns from the transitions it {g|actually observes}.',
        { formula: "V_{k+1}(s) \\leftarrow (1-\\alpha) V_k(s) + \\alpha \\left( r + \\gamma V_k(s') \\right)" },
        { formula: "\\delta_k(s, r, s') = r + \\gamma V_k(s') - V_k(s)", read: '$r + \\gamma V_k(s\')$ is the TD target, $\\delta_k$ the TD error, $\\alpha$ the learning rate' },
        'Like SGD: one sample at a time, and it only truly converges if $\\alpha$ is {g|gradually reduced}.',
      ],
    },
  ],
  skip: 'slide 50’s “experience each state many times” and slide 52’s running-average reading.',
};
