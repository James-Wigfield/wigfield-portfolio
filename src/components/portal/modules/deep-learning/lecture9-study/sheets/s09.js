// §9 · Implementing policy gradients in tf.keras (slides 32–37)
export default {
  blocks: [
    {
      id: 'target',
      h: 'The target',
      at: '32',
      items: [
        { code: 'y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)', read: 'act as if the chosen action was the best: target p(left) = 1.0 after left (0), 0.0 after right (1)' },
      ],
      margin: [
        { q: 'If p(left) = 0.7, how likely is action 1?', a: '0.3: action is 1 when the uniform random number is greater than 0.7.' },
      ],
    },
    {
      id: 'loop',
      h: 'Training',
      at: '33–37',
      items: [
        'Each iteration: play 10 episodes, `discount_and_normalize_rewards` ($\\gamma = 0.95$), then {g|average every gradient × its advantage} and apply it (Nadam, 0.01).',
        'After 150 iterations: mean reward {g|190.3} (`basic_policy`: 41.698).',
      ],
    },
  ],
  skip: '`play_multiple_episodes` line by line, the debug `print`, and `show_one_episode` (see the code cards).',
};
