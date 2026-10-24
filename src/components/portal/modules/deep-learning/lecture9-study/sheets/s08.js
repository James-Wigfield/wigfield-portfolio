// §8 · Policy gradients: REINFORCE (slides 30–31)
export default {
  blocks: [
    {
      id: 'steps',
      h: 'REINFORCE (Williams, 1992)',
      at: '30–31',
      items: [
        {
          steps: [
            'Play several episodes; at each step compute the gradients that make the chosen action more likely, {g|but don’t apply them yet}.',
            'Compute each action’s score (its advantage).',
            '{g|Multiply each gradient vector by its action’s score} (a negative score flips it).',
            'Take the {g|mean} of all the resulting gradient vectors and do one gradient descent step.',
          ],
        },
      ],
      margin: [
        { q: 'What happens to the gradients of an action with a negative score?', a: 'The opposite gradients are applied, making that action slightly less likely (slide 31).' },
      ],
    },
  ],
};
