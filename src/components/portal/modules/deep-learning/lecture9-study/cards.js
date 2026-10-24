/* ============================================================================
   LECTURE 9 STUDY — "EXPLAIN THIS CODE" CARDS (exam practice)
   ----------------------------------------------------------------------------
   The exam gives "a block of code and you need to draw a diagram or give
   explanation" (exam information). One card per listing worth practising,
   placed after the labs of its section (sections.js `cards`). Each card:
     src, lines   a few lines of a slide listing (NAMED_CODE in
                  slideData.js; lines are 1-based and inclusive), shown
                  verbatim — tools/dl-lecture9-study/check-rl.mjs checks
                  every card against its listing and slide
     prompt       one exam-style question
     answer       3–5 short sentences built only from the slides (Rich
                  markup); `fig` adds a line-art diagram (diagrams.jsx);
                  `own` marks a sentence that is this page's own working
   The answer is hidden behind a click on screen and printed in the PDF.
   ========================================================================== */

export const CARDS = {
  basicLoop: {
    title: 'basic_policy over 500 episodes',
    slide: '21–22',
    snippets: [
      { src: 'BASIC_POLICY', lines: [1, 3] },
      { src: 'BASIC_LOOP', lines: [1, 12] },
    ],
    prompt: 'Explain what `totals` holds after this loop, and what slide 22’s `(41.698, 8.389445512070509, 24.0, 63.0)` tells you about the policy.',
    answer: [
      '`basic_policy` pushes left (0) when the pole leans left (`angle < 0`) and right (1) otherwise.',
      'Each of the 500 episodes starts from its own `reset(seed=episode)` and runs at most 200 steps, stopping as soon as `done` or `truncated` is True.',
      'Every step earns a reward of 1.0, so `episode_rewards`, and each entry of `totals`, is the number of steps the pole stayed up.',
      'The mean is 41.698 steps and the best episode lasted 63: this policy never kept the pole upright for more than 63 steps (slide 22), far short of the 200-step cap.',
    ],
  },
  policyNet: {
    title: 'The policy network',
    slide: '25',
    snippets: [{ src: 'POLICY_NET', lines: [3, 10] }],
    prompt: 'Draw the network this code builds, and say what its single output means.',
    fig: 'policyNet',
    answer: [
      'It reads the 4 observation numbers, has one hidden `Dense` layer of 5 ReLU units, and ends in 1 sigmoid unit.',
      'The output is the probability $p$ of action 0 (left) (slide 23); right has probability $1 - p$.',
      'The action is then sampled at random from these probabilities, so the policy sometimes tries the less likely action: the exploration/exploitation dilemma (slide 23).',
      'Parameters: $4 \\times 5 + 5 = 25$ and $5 \\times 1 + 1 = 6$, so 31 in all (this page’s count).',
    ],
  },
  playOneStep: {
    title: 'play_one_step and y_target',
    slide: '32',
    snippets: [{ src: 'PLAY_ONE_STEP', lines: [1, 7] }],
    prompt: 'What does `y_target` encode, and why is it `1 - action`?',
    answer: [
      '`left_proba` is the network’s probability of going left. `action` is True (1, right) when a uniform random number in [0, 1) is greater than `left_proba`, so right is chosen with probability 1 − p(left).',
      'The code acts as though the chosen action was the best possible one, so the target probability of left is 1.0 if the action was 0 (left) and 0.0 if it was 1 (right) (slide 32): exactly `1 - action`.',
      'The loss is the binary cross-entropy between that target and `left_proba`. Its gradients would make the chosen action more likely; they are returned, not applied yet.',
    ],
  },
  discount: {
    title: 'discount_rewards and discount_and_normalize_rewards',
    slide: '34',
    snippets: [{ src: 'DISCOUNT', lines: [1, 14] }],
    prompt: 'Trace `discount_rewards([10, 0, -50], 0.8)`, then say what `discount_and_normalize_rewards` adds.',
    answer: [
      'The loop walks backwards from the second-last step. Step 1 becomes $0 + (-50)(0.8) = -40$; step 0 becomes $10 + (-40)(0.8) = -22$. The result is $[-22, -40, -50]$: Figure 18-6’s returns (this page’s trace of slide 34’s code on slide 26’s example).',
      'Each entry is the sum of all the rewards from that step on, each discounted by $\\gamma$ once per step of delay.',
      '`discount_and_normalize_rewards` does this for every episode, then subtracts the mean and divides by the standard deviation of all the episodes’ returns together.',
      'The result is each action’s normalised score, its action advantage (slide 29): positive for actions that did better than average, negative for worse.',
    ],
  },
  pgLoop: {
    title: 'The policy-gradient training loop',
    slide: '36',
    snippets: [{ src: 'PG_LOOP', lines: [10, 20] }],
    prompt: 'For one trainable variable, what does the list comprehension inside `tf.reduce_mean` compute, and which REINFORCE steps is this?',
    answer: [
      'For every step of every episode it multiplies the gradient stored for that step (`all_grads[episode_index][step][var_index]`) by that step’s normalised advantage (`final_reward`).',
      '`tf.reduce_mean(..., axis=0)` averages all those weighted gradients: one mean gradient per trainable variable.',
      'That is REINFORCE’s step 3 (multiply each gradient vector by its action’s score) and step 4 (the mean of the resulting vectors), slides 30–31.',
      '`optimizer.apply_gradients` then takes one step. A negative score flips its gradient, so bad actions become slightly less likely.',
    ],
  },
  qvi: {
    title: 'The Q-value iteration loop',
    slide: '48',
    snippets: [{ src: 'QVI_LOOP', lines: [1, 16] }],
    prompt: 'Which line is the Q-value iteration equation, and why does `Q_values` start at `-np.inf`?',
    answer: [
      'The `np.sum([...])` line: for each next state `sp` it adds $T(s, a, s\') \\times [R(s, a, s\') + \\gamma \\max_{a\'} Q_k(s\', a\')]$, with `Q_prev[sp].max()` as the max.',
      '`-np.inf` marks impossible actions (such as $a_1$ in $s_1$), so `.max()` and `np.argmax` never pick them; the possible actions start at 0.0.',
      '`Q_prev` is a copy of the previous iteration, so every update in iteration $k + 1$ uses only $Q_k$.',
      'After 50 iterations with γ = 0.90, `np.argmax(Q_values, axis=1)` gives `[0, 0, 1]` (slide 49).',
    ],
  },
  epsGreedy: {
    title: 'epsilon_greedy_policy',
    slide: '61',
    snippets: [{ src: 'DQN_MODEL', lines: [9, 14] }],
    prompt: 'What does this function return when `epsilon = 0.3`, and why is a random action needed at all?',
    answer: [
      'With probability 0.3 (`np.random.rand() < epsilon`) it returns a random action, `np.random.randint(n_outputs)`: 0 or 1.',
      'Otherwise it runs the DQN on the state and returns the action with the highest predicted Q-value (`argmax`).',
      'The random actions are the exploration: Q-learning can work only if the exploration policy explores the MDP thoroughly (slide 57).',
      'The training loop lowers epsilon from 1 towards 0.01 (slide 64), so the agent explores less as it learns.',
    ],
  },
  sample: {
    title: 'sample_experiences',
    slide: '62',
    snippets: [{ src: 'DQN_SAMPLE', lines: [4, 10] }],
    prompt: 'Draw what `sample_experiences(32)` returns.',
    fig: 'sample',
    answer: [
      'It draws 32 random indices into `replay_buffer` (`np.random.randint`, so the same experience can come up twice) and gathers those experience tuples.',
      'It then regroups them field by field into a list of 6 NumPy arrays: states, actions, rewards, next_states, dones, truncateds.',
      'Each array has 32 entries, one per sampled experience; `states` and `next_states` hold 32 observations of 4 numbers.',
    ],
  },
  trainingStep: {
    title: 'training_step',
    slide: '63',
    snippets: [{ src: 'DQN_TRAIN_STEP', lines: [6, 21] }],
    prompt: 'Draw the data flow of `training_step`.',
    fig: 'dqnStep',
    answer: [
      'A batch of 32 experiences goes through the DQN twice. On the next states (`model.predict`), the best next Q-value is kept, zeroed where the episode ended (`runs`), discounted and added to the reward: the target $y(s, a) = r + \\gamma \\max_{a\'} Q_\\theta(s\', a\')$ (slide 60).',
      'On the current states, inside the tape, the one-hot `mask` keeps only the Q-value of the action actually taken.',
      'The loss is the mean squared error between the targets and those Q-values; its gradients take one Nadam step.',
    ],
  },
  dqnLoop: {
    title: 'The DQN training loop',
    slide: '64',
    snippets: [{ src: 'DQN_LOOP', lines: [2, 21] }],
    prompt: 'Explain the schedule this loop follows: what does `epsilon` do over the 600 episodes, and when does training start?',
    answer: [
      'Each episode resets the environment and plays up to 200 steps with `play_one_step`, which stores every experience in the replay buffer.',
      '`epsilon = max(1 - episode / 500, 0.01)` falls in a straight line from 1 (always random) at episode 0 to 0.01 at episode 495, then stays at 0.01.',
      '`training_step` runs once per episode, but only after episode 50: the first 51 episodes (0–50) only fill the buffer.',
      '`best_weights` keeps the weights from the episode that lasted longest (`step >= best_score`), and they are put back at the end.',
    ],
  },
};
