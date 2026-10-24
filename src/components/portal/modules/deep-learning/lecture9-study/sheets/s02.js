// §2 · Learning to optimise rewards (slides 6–10)
export default {
  blocks: [
    {
      id: 'loop',
      h: 'The RL loop',
      at: '6',
      fig: { key: 'rlLoop', hl: ['act', 'obs'], cap: 'Slide 6 and Figure 18-2: the agent acts; the environment answers.' },
      items: [
        'A software {g|agent} makes observations and takes actions within an {g|environment}, and in return receives rewards.',
        'Its objective: learn to act so as to {g|maximise its expected long-term rewards} (positive reward = pleasure, negative = pain; it learns by trial and error).',
      ],
    },
    {
      id: 'ex',
      h: 'Examples',
      at: '7–10',
      items: [
        'A walking robot, Ms. Pac-Man, a smart thermostat, a stock trader, and a robot in a maze (only negative rewards).',
      ],
      margin: [
        { q: 'In Ms. Pac-Man, what are the actions, the observations and the rewards?', a: 'The joystick positions, the screenshots, and the game points (slide 8).' },
      ],
    },
  ],
  skip: 'each example’s observations, actions and rewards in detail (slides 7–10).',
};
