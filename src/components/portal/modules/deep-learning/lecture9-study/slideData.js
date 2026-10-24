/* ============================================================================
   LECTURE 9 STUDY — SLIDE FACTS
   ----------------------------------------------------------------------------
   Everything the module quotes from the deck — CITS5017 Topic 9,
   "Reinforcement Learning" (69 slides, Chapter 18 of Géron's Hands-On
   Machine Learning, 3rd ed.) — in one place: the numbers the slides print,
   the footnote, slide 3's topics, slide 68's outcomes, and every code
   listing verbatim (indentation as on the slide images). Checked against
   Documents/cits5017/markdown-lecs/lecture-9.md; the listings are generated
   from it. The "{" that slides 36 and 64 print in "# extra code { …" is a
   typesetting artefact for an en dash and is written "–" here (see §9).

   Nothing here is computed. The page's own numbers live in ./rl.js,
   ./cartpole.js and ./data (and are labelled as this page's own wherever
   shown).
   ========================================================================== */

/* ── numbers the slides print ────────────────────────────────────────────── */
export const PRINTED = {
  slide17Obs: { slide: 17, text: 'array([ 0.0273956 , -0.00611216, 0.03585979, 0.0197368 ], dtype=float32)' },
  slide20Obs: { slide: 20, text: 'array([ 0.02727336, 0.18847767, 0.03625453, -0.26141977], dtype=float32)' },
  basicStats: { slide: 22, value: [41.698, 8.389445512070509, 24.0, 63.0], text: '(41.698, 8.389445512070509, 24.0, 63.0)' },
  ga: { slide: 14, generation: 100, killed: 80, survivors: 20, offspring: 4 },
  vacuumMinutes: { slide: 12, value: 30 },
  creditSteps: { slide: 26, value: 100 },
  creditExample: { slide: 26, gamma: 0.8, rewards: [10, 0, -50], value: -22, text: '10 + γ × 0 + γ² × (−50) = −22' },
  fig186: { slide: 27, returns: [-22, -40, -50] },
  halfLife: { slide: 28, rows: [{ gamma: 0.95, steps: 13 }, { gamma: 0.99, steps: 69 }] },
  cartpoleGamma: { slide: 28, value: 0.95 },
  pgHyper: { slide: 35, nIterations: 150, nEpisodesPerUpdate: 10, nMaxSteps: 200, discountFactor: 0.95, lr: 0.01 },
  pgMean: { slide: 36, value: 190.3, text: 'Iteration: 150/150, mean rewards: 190.3' },
  chain: { slide: 40, example: '(row 2, column 3) has probability = 0.9' },
  qValues: {
    slide: 49,
    value: [[18.91891892, 17.02702703, 13.62162162], [0, -Infinity, -4.87971488], [-Infinity, 50.13365013, -Infinity]],
    text: '[[18.91891892, 17.02702703, 13.62162162], [0., −inf, −4.87971488], [−inf, 50.13365013, −inf]]',
  },
  argmax90: { slide: 49, value: [0, 0, 1] },
  argmax95: { slide: 49, value: [0, 2, 1] },
  qviIterations: { slide: 54, value: 20, text: 'in fewer than 20 iterations' },
  qlIterations: { slide: 54, value: 8000, text: 'about 8, 000 iterations' },
  qlAlpha: { slide: 53, value: 0.01 },
  epsilonEnd: { slide: 57, value: 0.05 },
  dqnHyper: { slide: 63, batchSize: 32, discountFactor: 0.95, lr: 1e-2, bufferLen: 2000, episodes: 600, trainAfter: 50, epsMin: 0.01, epsEpisodes: 500 },
  dqnRun: { slide: 66, firstMax: 290, settle: 550, last: 100, tilt: 143 },
  dqnPrint: { slide: 65, text: 'Episode: 600, Steps: 100, eps: 0.010' },
};

/* ── slide 3's topics → the sections that teach them ─────────────────────── */
export const ROADMAP = [
  { topic: 'Introduction to reinforcement learning and its applications', secs: ['s01', 's02'] },
  { topic: 'Rewards in RL', secs: ['s02'] },
  { topic: 'Policy search and policy gradients', secs: ['s03', 's08'] },
  { topic: 'The OpenAI Gym toolkit and training a NN to create policy for the CartPole game', secs: ['s04', 's05', 's06', 's09'] },
  { topic: 'Evaluating Actions (The Credit Assignment Problem) and discounted rewards', secs: ['s07'] },
  { topic: 'Markov Decision Processes', secs: ['s10', 's11', 's12'] },
  { topic: 'ϵ greedy policy', secs: ['s14'] },
  { topic: 'Q-learning, approximate Q-learning, and deep Q-learning', secs: ['s13', 's14', 's15', 's16', 's17'] },
];

/* ── slide 68's outcomes → sections ──────────────────────────────────────── */
export const OUTCOMES = [
  { text: 'Understand when to apply reinforcement learning (know its applications)', secs: ['s01', 's02'] },
  { text: 'Understand the concept of rewards in RL', secs: ['s02', 's07'] },
  { text: 'Understand policy search and policy gradients in RL', secs: ['s03', 's08', 's09'] },
  { text: 'Know how to use the OpenAI Gym toolkit to train a NN for a simple game, such as CartPole', secs: ['s04', 's05', 's06', 's09'] },
  { text: 'Understand the concept of action evaluation (The Credit Assignment Problem) and discounted rewards', secs: ['s07'] },
  { text: 'Understand Markov Decision Processes (MDP)', secs: ['s10', 's11', 's12'] },
  { text: 'Understand Q-learning, ϵ greedy policy, approximate Q-learning, and deep Q-learning', secs: ['s13', 's14', 's15', 's16'] },
  { text: 'Know how to implement a deep Q-learning network for a simple problem.', secs: ['s16', 's17'] },
];

/* ── footnotes (Fnote / RefsProvider), verbatim ──────────────────────────── */
export const REFS = {
  1: '“Simple Statistical Gradient-Following Algorithms for Connectionist Reinforcement Learning,” R. Williams (1992). (Slide 30, footnote 1.)',
};

/* ── the demo videos the slides mention (not part of the PDF or this page) ── */
export const DEMOS = {
  22: 'cits5017-lect09-demo-CartPole1_using-basic-hard-coded-policy.webm',
  25: 'cits5017-lect09-demo-CartPole2_using-NN-random-policy.webm',
  37: 'cits5017-lect09-demo-CartPole3_using-NN-policy-gradients.webm',
  66: 'cits5017-lect09-demo-CartPole4_using-DQN-epsilon-greedy-policy.webm',
};

/* ── code listings, verbatim (generated from the transcript) ─────────────── */
// slide 16
const INSTALL_COLAB = `# Only run these commands on Colab or Kaggle!
%pip install -q -U gymnasium`;

// slide 16
const INSTALL_LOCAL = `pip install gymnasium`;

// slide 17
const MAKE_ENV = `>>> import gymnasium as gym
>>> env = gym.make("CartPole-v1", reader_mode="rgb_array")
>>> obs, info = env.reset(seed=42)
>>> obs
array([ 0.0273956 , -0.00611216, 0.03585979, 0.0197368 ], dtype=float32)
>>> info
{}`;

// slide 18
const RENDER = `>>> env.reset()
>>> img = env.render()
>>> img.shape # height, width, channels (3 = Red, Green, Blue)
(400, 600, 3)
>>> plt.imshow(img)`;

// slide 19
const ACTION_SPACE = `>>> env.action_space
Discrete(2)`;

// slide 20
const STEP = `>>> action = 1 # accelerate right
>>> obs, reward, done, truncated, info = env.step(action)
>>> obs
array([ 0.02727336, 0.18847767, 0.03625453, -0.26141977], dtype=float32)
>>> reward
1.0
>>> done
False
>>> truncated
False
>>> info
{}`;

// slide 21
const BASIC_POLICY = `def basic_policy(obs):
    angle = obs[2]
    return 0 if angle < 0 else 1`;

// slide 22
const BASIC_LOOP = `totals = []
for episode in range(500):
    episode_rewards = 0
    obs, info = env.reset(seed=episode)
    for step in range(200):
        action = basic_policy(obs)
        obs, reward, done, truncated, info = env.step(action)
        episode_rewards += reward
        if done or truncated:
            break

    totals.append(episode_rewards)

>>> np.mean(totals), np.std(totals), np.min(totals), np.max(totals)
(41.698, 8.389445512070509, 24.0, 63.0)`;

// slide 25
const POLICY_NET = `import tensorflow as tf

n_inputs = 4        # == env.observation_space.shape[0]

# create the model
tf.random.set_seed(42)
model = tf.keras.models.Sequential([
    tf.keras.layers.Dense(5, activation="relu", input_shape=[n_inputs]),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])

# reset the game environment, for reproducibility
obs, info = env.reset(seed=42)`;

// slide 32
const PLAY_ONE_STEP = `def play_one_step(env, obs, model, loss_fn):
    with tf.GradientTape() as tape:
        left_proba = model(obs[np.newaxis])
        action = (tf.random.uniform([1, 1]) > left_proba)
        y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)
        loss = tf.reduce_mean(loss_fn(y_target, left_proba))
    grads = tape.gradient(loss, model.trainable_variables)
    obs, reward, done, truncated, info = env.step(int(action))
    return obs, reward, done, truncated, grads`;

// slide 32
const Y_TARGET = `y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)`;

// slide 33
const PLAY_MULTIPLE = `def play_multiple_episodes(env, n_episodes, n_max_steps, model, loss_fn):
    all_rewards = []
    all_grads = []
    for episode in range(n_episodes):
        current_rewards = []
        current_grads = []
        obs, info = env.reset()
        for step in range(n_max_steps):
            obs, reward, done, truncated, grads = play_one_step(
                env, obs, model, loss_fn)
            current_rewards.append(reward)
            current_grads.append(grads)
            if done or truncated:
                break

        all_rewards.append(current_rewards)
        all_grads.append(current_grads)

    return all_rewards, all_grads`;

// slide 34
const DISCOUNT = `def discount_rewards(rewards, discount_factor):
    discounted = np.array(rewards)
    for step in range(len(rewards) - 2, -1, -1):
        discounted[step] += discounted[step + 1] * discount_factor
    return discounted

def discount_and_normalize_rewards(all_rewards, discount_factor):
    all_discounted_rewards = [discount_rewards(rewards, discount_factor)
                              for rewards in all_rewards]
    flat_rewards = np.concatenate(all_discounted_rewards)
    reward_mean = flat_rewards.mean()
    reward_std = flat_rewards.std()
    return [(discounted_rewards - reward_mean) / reward_std
            for discounted_rewards in all_discounted_rewards]`;

// slide 35
const PG_HYPER = `n_iterations = 150
n_episodes_per_update = 10
n_max_steps = 200
discount_factor = 0.95

optimizer = tf.keras.optimizers.Nadam(learning_rate=0.01)
loss_fn = tf.keras.losses.binary_crossentropy`;

// slide 36
const PG_LOOP = `for iteration in range(n_iterations):
    all_rewards, all_grads = play_multiple_episodes(
        env, n_episodes_per_update, n_max_steps, model, loss_fn)

    # extra code – displays some debug info during training
    total_rewards = sum(map(sum, all_rewards))
    print(f"\\rIteration: {iteration + 1}/{n_iterations},"
        f" mean rewards: {total_rewards / n_episodes_per_update:.1f}", end="")

    all_final_rewards = discount_and_normalize_rewards(all_rewards,
                                                       discount_factor)
    all_mean_grads = []
    for var_index in range(len(model.trainable_variables)):
        mean_grads = tf.reduce_mean(
            [final_reward * all_grads[episode_index][step][var_index]
             for episode_index, final_rewards in enumerate(all_final_rewards)
                 for step, final_reward in enumerate(final_rewards)], axis=0)
        all_mean_grads.append(mean_grads)

    optimizer.apply_gradients(zip(all_mean_grads, model.trainable_variables))`;

// slide 36
const PG_PRINT = `Iteration: 150/150, mean rewards: 190.3`;

// slide 37
const SHOW_EPISODE = `np.random.seed(42)
show_one_episode(pg_policy)`;

// slide 47
const MDP_DEF = `transition_probabilities = [ # shape=[s, a, s']
        [[0.7, 0.3, 0.0], [1.0, 0.0, 0.0], [0.8, 0.2, 0.0]],
        [[0.0, 1.0, 0.0], None, [0.0, 0.0, 1.0]],
        [None, [0.8, 0.1, 0.1], None]]
rewards = [ # shape=[s, a, s']
        [[+10, 0, 0], [0, 0, 0], [0, 0, 0]],
        [[0, 0, 0], [0, 0, 0], [0, 0, -50]],
        [[0, 0, 0], [+40, 0, 0], [0, 0, 0]]]
possible_actions = [[0, 1, 2], [0, 2], [1]]`;

// slide 48
const QVI_LOOP = `Q_values = np.full((3, 3), -np.inf)  # -np.inf for impossible actions
for state, actions in enumerate(possible_actions):
    Q_values[state, actions] = 0.0  # for all possible actions

gamma = 0.90  # the discount factor

history1 = []  # extra code for generating a figure later on
for iteration in range(50):
    Q_prev = Q_values.copy()
    history1.append(Q_prev) # extra code
    for s in range(3):
        for a in possible_actions[s]:
            Q_values[s, a] = np.sum([
                    transition_probabilities[s][a][sp]
                    * (rewards[s][a][sp] + gamma * Q_prev[sp].max())
                for sp in range(3)])

history1 = np.array(history1)  # extra code`;

// slide 49
const QVI_OUT = `>>> Q_values
array([[18.91891892, 17.02702703, 13.62162162],
       [ 0.        ,        -inf, -4.87971488],
       [       -inf, 50.13365013,        -inf]])
>>> np.argmax(Q_values, axis=1)   # optimal action for each state
array([0, 0, 1])`;

// slide 49
const QVI_OUT95 = `...
>>> np.argmax(Q_values, axis=1)   # optimal action for each state
array([0, 2, 1])`;

// slide 61
const DQN_MODEL = `input_shape = [4]  # == env.observation_space.shape
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

# We will also need a replay buffer. It will contain the agent's
# experiences, in the form of tuples: (obs, action, reward, next_obs,
# done). We can use the deque class for that.
from collections import deque
replay_buffer = deque(maxlen=2000)`;

// slide 62
const DQN_SAMPLE = `# Let's create a function to sample experiences from the replay buffer.
# It will return a list of 6 NumPy arrays: [obs, actions, rewards,
# next_obs, dones, truncateds].
def sample_experiences(batch_size):
    indices = np.random.randint(len(replay_buffer), size=batch_size)
    batch = [replay_buffer[index] for index in indices]
    return [
        np.array([experience[field_index] for experience in batch])
        for field_index in range(6)
    ]  # [states, actions, rewards, next_states, dones, truncateds]

# A function that will use the DQN to play one step, and record its
# experience in the replay buffer
def play_one_step(env, state, epsilon):
    action = epsilon_greedy_policy(state, epsilon)
    next_state, reward, done, truncated, info = env.step(action)
    replay_buffer.append((state, action, reward, next_state, done, truncated))
    return next_state, reward, done, truncated, info`;

// slide 63
const DQN_TRAIN_STEP = `batch_size = 32
discount_factor = 0.95
optimizer = tf.keras.optimizers.Nadam(learning_rate=1e-2)
loss_fn = tf.keras.losses.mean_squared_error

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
    optimizer.apply_gradients(zip(grads, model.trainable_variables))`;

// slide 64
const DQN_LOOP = `# Now, let's train the model!
rewards = []
best_score = 0
for episode in range(600):
    obs, info = env.reset()
    for step in range(200):
        epsilon = max(1 - episode / 500, 0.01)
        obs, reward, done, truncated, info = play_one_step(env, obs, epsilon)
        if done or truncated:
            break
    # extra code - displays debug info
    print(f"\\rEpisode: {episode + 1}, Steps: {step + 1}, eps: {epsilon:.3f}",
          end="")
    rewards.append(step)
    if step >= best_score:
        best_weights = model.get_weights()
        best_score = step
    if episode > 50:
        training_step(batch_size)

model.set_weights(best_weights)  # extra code – restores the best model weight`;

// slide 65
const DQN_PLOT = `Episode: 600, Steps: 100, eps: 0.010  # my output from the code
                                      # on the previous slide
plt.figure(figsize=(8, 4))
plt.plot(rewards)
plt.xlabel("Episode", fontsize=14)
plt.ylabel("Sum of rewards", fontsize=14)
plt.grid(True)
plt.show()`;

export const NAMED_CODE = {
  INSTALL_COLAB,
  INSTALL_LOCAL,
  MAKE_ENV,
  RENDER,
  ACTION_SPACE,
  STEP,
  BASIC_POLICY,
  BASIC_LOOP,
  POLICY_NET,
  PLAY_ONE_STEP,
  Y_TARGET,
  PLAY_MULTIPLE,
  DISCOUNT,
  PG_HYPER,
  PG_LOOP,
  PG_PRINT,
  SHOW_EPISODE,
  MDP_DEF,
  QVI_LOOP,
  QVI_OUT,
  QVI_OUT95,
  DQN_MODEL,
  DQN_SAMPLE,
  DQN_TRAIN_STEP,
  DQN_LOOP,
  DQN_PLOT,
};

export const CODE_SLIDE = {
  INSTALL_COLAB: 16,
  INSTALL_LOCAL: 16,
  MAKE_ENV: 17,
  RENDER: 18,
  ACTION_SPACE: 19,
  STEP: 20,
  BASIC_POLICY: 21,
  BASIC_LOOP: 22,
  POLICY_NET: 25,
  PLAY_ONE_STEP: 32,
  Y_TARGET: 32,
  PLAY_MULTIPLE: 33,
  DISCOUNT: 34,
  PG_HYPER: 35,
  PG_LOOP: 36,
  PG_PRINT: 36,
  SHOW_EPISODE: 37,
  MDP_DEF: 47,
  QVI_LOOP: 48,
  QVI_OUT: 49,
  QVI_OUT95: 49,
  DQN_MODEL: 61,
  DQN_SAMPLE: 62,
  DQN_TRAIN_STEP: 63,
  DQN_LOOP: 64,
  DQN_PLOT: 65,
};
