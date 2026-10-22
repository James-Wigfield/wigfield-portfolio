// §10 · GAN results and the difficulties of training (slides 26–27)
export default {
  blocks: [
    {
      id: 'results',
      h: 'Results',
      at: '26',
      items: [
        'After one epoch the images already look like very noisy Fashion MNIST, but they never get much better.',
      ],
    },
    {
      id: 'hard',
      h: 'Why GANs are hard to train',
      at: '27',
      items: [
        '{g|Nash equilibrium}: no player would be better off changing its own strategy, if the others don’t change theirs.',
        'A GAN can only reach a single Nash equilibrium, but nothing guarantees it will ever be reached.',
        '{g|Mode collapse}: the generator’s outputs gradually become less diverse, only producing images in a specific class.',
        'The two networks push against each other, so their parameters may end up {g|oscillating} and becoming unstable.',
      ],
      margin: [
        { q: 'What is mode collapse?', a: 'The generator’s outputs gradually become less diverse, until it only produces images in a specific class.' },
      ],
    },
  ],
};
