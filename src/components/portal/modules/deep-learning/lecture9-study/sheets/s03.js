// §3 · Policy search (slides 11–15)
export default {
  blocks: [
    {
      id: 'policy',
      h: 'Policies',
      at: '11–12',
      items: [
        'The {g|policy} is the algorithm the agent uses to choose its actions (e.g. a neural network).',
        'A policy that involves randomness is a {g|stochastic policy}; the numbers you can tweak are its policy parameters (the vacuum robot’s $p$ and $r$).',
      ],
    },
    {
      id: 'search',
      h: 'Finding good parameters',
      at: '13–15',
      items: [
        {
          steps: [
            'Brute force: try every combination in the policy space ({g|policy search}): a needle in a haystack.',
            'Genetic algorithms: 100 policies, kill the 80 worst, the 20 survivors produce 4 offspring each.',
            'Policy gradients (PG): follow the gradient of the rewards with respect to the parameters ({g|gradient ascent}).',
          ],
        },
      ],
      margin: [
        { q: 'How many policies are in the second generation?', a: '20 survivors + 20 × 4 offspring = 100.' },
      ],
    },
  ],
};
