// Code Lab cards: tab 10 · Reinforcement learning (L9). The slides have no
// code for value iteration, TD learning or tabular Q-learning (only their
// equations); Q-value iteration and deep Q-learning are carded.
export const RL = [
  {
    id: 'gym-loop',
    title: 'The Gym loop: reset, step, done',
    rating: 'useful',
    why: 'Read an episode loop: what env.step returns, when an episode ends, and what the totals measure.',
    sources: [{ kind: 'lecture', lec: 9, slides: '17–22' }],
    blocks: ['L9 s17', 'L9 s21', 'L9 s22'],
    provenance: 'trimmed',
    inv: ['l9-gym-make-reset', 'l9-action-space', 'l9-gym-step', 'l9-basic-policy', 'l9-gym-episode-loop'],
    file: 'cartpole_loop.py',
    code: `>>> env = gym.make("CartPole-v1", reader_mode="rgb_array")
# …
def basic_policy(obs):
    angle = obs[2]
    return 0 if angle < 0 else 1
totals = []
for episode in range(500):
    episode_rewards = 0
    obs, info = env.reset(seed=episode)
    for step in range(200):
        action = basic_policy(obs)
        obs, reward, done, truncated, info = env.step(action)
        episode_rewards += reward
        if done or truncated:
            break
    totals.append(episode_rewards)`,
    marks: [
      { n: 1, token: { line: 4, text: 'obs[2]' }, say: 'The observation is 4 numbers; index 2 is the pole’s angle.' },
      { n: 2, lines: [5, 5], say: 'Push left (0) if the pole leans left, else right (1): a hard-coded policy.' },
      { n: 3, lines: [12, 12], say: 'One step returns the new observation, the reward (+1 per step survived), done, truncated and info.' },
      { n: 4, lines: [14, 15], say: 'Stop when the pole falls or the cart leaves (done), or at the time limit (truncated).' },
    ],
    moves: {
      shapes: [
        { name: 'obs', shape: '(4,)', means: 'cart position, cart velocity, pole angle, pole angular velocity' },
        { name: 'action', shape: 'Discrete(2)', means: '0 = accelerate left, 1 = accelerate right' },
      ],
      say: 'The 500 totals average 41.698 steps (std 8.39, min 24, max 63): this policy never keeps the pole up beyond 63 steps.',
      forWhat: 'Running and scoring a policy on an environment: the loop every RL method here reuses.',
    },
    slideCheck: 'gym.make("CartPole-v1", reader_mode="rgb_array") raises a TypeError in Gymnasium 1.3.0: the argument is render_mode. range(200) caps each episode below CartPole-v1’s own 500-step limit.',
  },
  {
    id: 'policy-net',
    title: 'A neural network policy and one REINFORCE step',
    rating: 'core',
    why: 'Practice paper A Q4(e) is this network: draw it, count it, explain why one sigmoid output is enough and how the action is sampled.',
    sources: [{ kind: 'lecture', lec: 9, slides: '23–25' }, { kind: 'lecture', lec: 9, slides: '30–32' }],
    blocks: ['L9 s25', 'L9 s32'],
    provenance: 'trimmed',
    inv: ['l9-policy-net', 'l9-pg-play-one-step'],
    file: 'policy_gradients.py',
    code: `n_inputs = 4        # == env.observation_space.shape[0]
# …
model = tf.keras.models.Sequential([
    tf.keras.layers.Dense(5, activation="relu", input_shape=[n_inputs]),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])
# …
def play_one_step(env, obs, model, loss_fn):
    with tf.GradientTape() as tape:
        left_proba = model(obs[np.newaxis])
        action = (tf.random.uniform([1, 1]) > left_proba)
        y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)
        loss = tf.reduce_mean(loss_fn(y_target, left_proba))
    grads = tape.gradient(loss, model.trainable_variables)
    obs, reward, done, truncated, info = env.step(int(action))
    return obs, reward, done, truncated, grads`,
    marks: [
      { n: 1, token: { line: 4, text: 'Dense(5, activation="relu", input_shape=[n_inputs])' }, say: '4 observation values in, 5 hidden ReLU units: (4 + 1) × 5 = 25.' },
      { n: 2, token: { line: 5, text: 'Dense(1, activation="sigmoid")' }, say: 'One probability p of action 0 (left); right is 1 − p, so one output suffices.' },
      { n: 3, lines: [11, 11], say: 'Samples the action: right (1) with probability 1 − p. Sampling, not argmax, keeps it exploring.' },
      { n: 4, lines: [12, 12], say: 'Target 1.0 if it went left, 0.0 if right: act as if the chosen action was the best one.' },
    ],
    moves: {
      draw: 'policyNet',
      count: 'policyNet',
      say: 'REINFORCE step 1: play, and keep the gradients that would make the chosen action more likely, without applying them yet.',
      forWhat: 'A stochastic policy for CartPole: from the 4 observations to the probability of pushing left.',
    },
    slideCheck: 'Figure 18-5 draws 4 hidden neurons; the code has 5. env.step(int(action)) raises a TypeError in the unit’s environment (NumPy 2.5.2), since action is a 1 × 1 tensor; int(action[0, 0]) works. input_shape= still runs in Keras 3, with a warning.',
  },
  {
    id: 'discount-rewards',
    title: 'REINFORCE: discounted returns, advantages, weighted gradients',
    rating: 'core',
    why: 'Trace the returns by hand, then explain how normalised returns weight each step’s gradients (REINFORCE steps 2–4).',
    sources: [{ kind: 'lecture', lec: 9, slides: '26–36' }],
    blocks: ['L9 s34', 'L9 s36'],
    provenance: 'trimmed',
    inv: ['l9-discount-normalize', 'l9-pg-training-loop'],
    file: 'reinforce.py',
    code: `def discount_rewards(rewards, discount_factor):
    discounted = np.array(rewards)
    for step in range(len(rewards) - 2, -1, -1):
        discounted[step] += discounted[step + 1] * discount_factor
    return discounted
# …
    flat_rewards = np.concatenate(all_discounted_rewards)
    reward_mean = flat_rewards.mean()
    reward_std = flat_rewards.std()
    return [(discounted_rewards - reward_mean) / reward_std
            for discounted_rewards in all_discounted_rewards]
# …
            [final_reward * all_grads[episode_index][step][var_index]
# …
    optimizer.apply_gradients(zip(all_mean_grads, model.trainable_variables))`,
    marks: [
      { n: 1, lines: [3, 4], say: 'Backwards from the second-to-last step: each return = its reward + γ × the next step’s return.' },
      { n: 2, lines: [10, 10], say: 'Normalise over every step of every episode: the action advantage (above 0 = better than average).' },
      { n: 3, lines: [13, 13], say: 'Scale each step’s gradient by its advantage; a negative advantage pushes the action away.' },
      { n: 4, lines: [15, 15], say: 'One optimizer step with the mean weighted gradient of each variable.' },
    ],
    moves: {
      eq: [{ name: 'Slide 26’s worked example (γ = 0.8)', tex: String.raw`10 + \gamma \times 0 + \gamma^2 \times (-50) = -22`, plain: '10 + γ × 0 + γ² × (−50) = −22', line: 4 }],
      say: 'Trace discount_rewards([10, 0, −50], 0.8): −50, then 0 + 0.8 × (−50) = −40, then 10 + 0.8 × (−40) = −22 (Figure 18-6).',
      forWhat: 'Credit assignment in policy gradients: each action is judged by the discounted rewards that followed it.',
    },
    slideCheck: 'With integer rewards, np.array(rewards) keeps an integer dtype, so += truncates: [10, 0, −50] with γ = 0.9 gives −30, not −30.5. The slide’s γ = 0.8 example comes out exact, and CartPole’s rewards are floats.',
  },
  {
    id: 'q-iteration',
    title: 'Q-value iteration on a known MDP',
    rating: 'core',
    why: 'Sample Q2(e) gives the value-iteration equation: map Q-value iteration’s terms to these lines and read the policy off the result.',
    sources: [{ kind: 'lecture', lec: 9, slides: '43–49' }],
    blocks: ['L9 s48', 'L9 s49'],
    provenance: 'trimmed',
    inv: ['l9-mdp-arrays', 'l9-q-value-iteration', 'l9-q-values-argmax', 'l9-q-values-gamma095'],
    file: 'q_value_iteration.py',
    code: `Q_values = np.full((3, 3), -np.inf)  # -np.inf for impossible actions
# …
gamma = 0.90  # the discount factor
# …
for iteration in range(50):
    Q_prev = Q_values.copy()
# …
    for s in range(3):
        for a in possible_actions[s]:
            Q_values[s, a] = np.sum([
                    transition_probabilities[s][a][sp]
                    * (rewards[s][a][sp] + gamma * Q_prev[sp].max())
                for sp in range(3)])
# …
>>> np.argmax(Q_values, axis=1)   # optimal action for each state
array([0, 0, 1])`,
    marks: [
      { n: 1, token: { line: 1, text: 'np.full((3, 3), -np.inf)' }, say: 'Impossible actions stay at −∞, so max and argmax never pick them; possible ones start at 0.' },
      { n: 2, lines: [6, 6], say: 'Iteration k + 1 uses only iteration k’s Q-values.' },
      { n: 3, lines: [11, 12], say: 'T(s, a, s′) × [R(s, a, s′) + γ max_a′ Q_k(s′, a′)], summed over s′: the equation term for term.' },
      { n: 4, lines: [16, 16], say: 'The optimal policy: a₀ in s₀ and s₁, a₁ in s₂. With γ = 0.95 it becomes [0, 2, 1].' },
    ],
    moves: {
      eq: [
        { name: 'Q-value iteration (slide 46)', tex: String.raw`Q_{k+1}(s, a) \leftarrow \sum_{s'} T(s, a, s') \left[R(s, a, s') + \gamma \max_{a'} Q_k(s', a')\right] \quad \text{for all } (s, a)`, line: 12 },
        { name: 'Value iteration (slide 44, sample Q2(e))', tex: String.raw`V_{k+1}(s) \leftarrow \max_{a} \sum_{s'} T(s, a, s') \left[R(s, a, s') + \gamma V_k(s')\right] \quad \text{for all } s` },
      ],
      shapes: [
        { name: 'transition_probabilities', shape: '[s][a][s′]', means: '3 × 3 × 3, None where an action isn’t available (slide 47)' },
        { name: 'Q_values', shape: '(3, 3)', means: 'states × actions; possible_actions = [[0, 1, 2], [0, 2], [1]]' },
      ],
      forWhat: 'Solving a known MDP: with T and R known, compute the optimal Q-values and take the argmax action in each state.',
    },
    slideCheck: 'In s₁ staying (a₀) beats going through the fire: −50 + 0.9 × 50.13 = −4.88 < 0. Slide 49 prints Q(s₀, a₁) as 17.02702703; 50 iterations give 17.02702702 (the converged value is 630/37).',
  },
  {
    id: 'dqn-model',
    title: 'A deep Q-network and its ε-greedy policy',
    rating: 'core',
    why: 'Count the DQN (1,282), say why its output has no activation, and explain ε-greedy exploration and the replay buffer.',
    sources: [{ kind: 'lecture', lec: 9, slides: '57–61' }],
    blocks: ['L9 s61'],
    provenance: 'trimmed',
    inv: ['l9-dqn-model-eps-greedy'],
    file: 'dqn_model.py',
    code: `input_shape = [4]  # == env.observation_space.shape
n_outputs = 2      # == env.action_space.n
model = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation="elu", input_shape=input_shape),
    tf.keras.layers.Dense(32, activation="elu"),
    tf.keras.layers.Dense(n_outputs)
])

def epsilon_greedy_policy(state, epsilon=0):
    if np.random.rand() < epsilon:
        return np.random.randint(n_outputs)  # random action
    else:
        Q_values = model.predict(state[np.newaxis], verbose=0)[0]
        return Q_values.argmax()  # optimal action according to the DQN
# …
replay_buffer = deque(maxlen=2000)`,
    marks: [
      { n: 1, token: { line: 6, text: 'Dense(n_outputs)' }, say: 'No activation: one unbounded Q-value estimate per action.' },
      { n: 2, lines: [10, 11], say: 'With probability ε, explore: a random action.' },
      { n: 3, lines: [13, 14], say: 'Otherwise exploit: predict both Q-values and take the action with the larger one.' },
      { n: 4, lines: [16, 16], say: 'Keeps the latest 2,000 experiences; the oldest drop out automatically.' },
    ],
    moves: {
      draw: 'dqnModel',
      count: 'dqnModel',
      say: 'ε falls from 1 to 0.01 over the first 500 episodes (slide 64): explore first, exploit later.',
      forWhat: 'Approximate Q-learning for CartPole: one network estimates Q(s, a) for both actions from the 4 observations.',
    },
    slideCheck: 'The comment’s experience tuple has 5 fields; slide 62 stores 6 (it adds truncated). input_shape= still runs in Keras 3, with a warning.',
  },
  {
    id: 'dqn-step',
    title: 'One deep Q-learning training step',
    rating: 'core',
    why: 'Practice paper B Q4(d) quotes these lines: match the target to its equation, explain runs and the mask, give the shapes.',
    sources: [{ kind: 'lecture', lec: 9, slides: '60–63' }],
    blocks: ['L9 s63'],
    provenance: 'trimmed',
    inv: ['l9-dqn-training-step'],
    file: 'dqn_training_step.py',
    code: `loss_fn = tf.keras.losses.mean_squared_error
def training_step(batch_size):
    experiences = sample_experiences(batch_size)
    states, actions, rewards, next_states, dones, truncateds = experiences
    next_Q_values = model.predict(next_states, verbose=0)
    max_next_Q_values = next_Q_values.max(axis=1)
    runs = 1.0 - (dones | truncateds)  # episode is not done or truncated
    target_Q_values = rewards + runs * discount_factor * max_next_Q_values
    target_Q_values = target_Q_values.reshape(-1, 1)
    mask = tf.one_hot(actions, n_outputs)
    with tf.GradientTape() as tape:
        all_Q_values = model(states)
        Q_values = tf.reduce_sum(all_Q_values * mask, axis=1, keepdims=True)
        loss = tf.reduce_mean(loss_fn(target_Q_values, Q_values))
    grads = tape.gradient(loss, model.trainable_variables)
    optimizer.apply_gradients(zip(grads, model.trainable_variables))`,
    marks: [
      { n: 1, lines: [6, 6], say: 'max over a′ of Q_θ(s′, a′): the best predicted value of each next state.' },
      { n: 2, token: { line: 7, text: 'runs = 1.0 - (dones | truncateds)' }, say: '0 once the episode has ended, so no future reward enters the target.' },
      { n: 3, lines: [8, 8], say: 'The target y = r + γ max Q′, computed outside the tape, so no gradient flows through it.' },
      { n: 4, token: { line: 13, text: 'all_Q_values * mask' }, say: 'The one-hot mask keeps only the Q-value of the action actually taken.' },
    ],
    moves: {
      eq: [{ name: 'Target Q-value (slide 60)', tex: String.raw`y(s, a) = r + \gamma \, \max_{a'} Q_{\boldsymbol{\theta}}(s', a')`, line: 8 }],
      shapes: [
        { name: 'states, next_Q_values', shape: '(32, 4), (32, 2)', means: 'batch × observations; batch × actions' },
        { name: 'max_next_Q_values, runs', shape: '(32,)', means: 'one number per sampled experience' },
        { name: 'target_Q_values, Q_values', shape: '(32, 1)', means: 'after reshape(-1, 1); after the masked sum' },
        { name: 'mask', shape: '(32, 2)', means: 'one-hot of the action taken' },
      ],
      forWhat: 'One gradient step of deep Q-learning: move Q_θ(s, a) towards r + γ max Q_θ(s′, a′) on a replayed batch.',
    },
    slideCheck: 'tf.keras.losses.mean_squared_error doesn’t exist in Keras 3.15.1 (AttributeError); tf.keras.losses.mse works. batch_size = 32, discount_factor = 0.95 and Nadam(learning_rate=1e-2) are set above the function.',
  },
];
