"""Slides 61-64 (CITS5017 Lecture 9): Deep Q-Learning on CartPole.

Slide code copied as written; additions are marked "# added".
The slides set no seeds for the DQN section; we use 42 (the value slides 25 and 37 use,
and Geron's ch. 18 notebook uses for this cell) so the run is repeatable.
A wall-clock cap (MAX_SECONDS, default 1800 s) stops training early if needed;
the JSON then says how many episodes completed.
Writes out/dqn_run.json.
"""
import os
import sys
import time
import warnings

import numpy as np

from rl_common import versions, weights_to_json, dump  # added

MAX_SECONDS = float(sys.argv[1]) if len(sys.argv) > 1 else 1800.0  # added

import gymnasium as gym
import tensorflow as tf

env = gym.make("CartPole-v1", render_mode="rgb_array")  # slide 17 (reader_mode typo fixed)

tf.random.set_seed(42)  # added (not on slides 61-64)

# ---- slide 61 --------------------------------------------------------------
with warnings.catch_warnings(record=True) as w:  # added
    warnings.simplefilter("always")
    input_shape = [4]  # == env.observation_space.shape
    n_outputs = 2      # == env.action_space.n
    model = tf.keras.Sequential([
        tf.keras.layers.Dense(32, activation="elu", input_shape=input_shape),
        tf.keras.layers.Dense(32, activation="elu"),
        tf.keras.layers.Dense(n_outputs)
    ])
model_warnings = [f"{x.category.__name__}: {x.message}" for x in w]  # added
for m in model_warnings:
    print("WARNING (model build):", m)

param_count = int(model.count_params())  # added
print("param_count:", param_count, "derived 4*32+32 + 32*32+32 + 32*2+2 =",
      4 * 32 + 32 + 32 * 32 + 32 + 32 * 2 + 2)


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
replay_buffer = deque(maxlen=2000)

# ---- slide 62 --------------------------------------------------------------
# Let's create a function to sample experiences from the replay buffer.
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
    return next_state, reward, done, truncated, info

# ---- slide 63 --------------------------------------------------------------
batch_size = 32
discount_factor = 0.95
optimizer = tf.keras.optimizers.Nadam(learning_rate=1e-2)
# CHANGED: slide has tf.keras.losses.mean_squared_error, which raises
# "AttributeError: module 'keras._tf_keras.keras.losses' has no attribute 'mean_squared_error'"
# under Keras 3.15.1; tf.keras.losses.mse is the same per-sample MSE function.
loss_fn = tf.keras.losses.mse

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
    optimizer.apply_gradients(zip(grads, model.trainable_variables))

# ---- slide 64 --------------------------------------------------------------
env.reset(seed=42)      # added (not on slides; Geron's notebook seeds here)
np.random.seed(42)      # added
tf.random.set_seed(42)  # added

t0 = time.time()        # added
best_episode = None     # added
stopped_early = False   # added

# Now, let's train the model!
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
    print(f"\rEpisode: {episode + 1}, Steps: {step + 1}, eps: {epsilon:.3f}",
          end="")
    print(f"   [{time.time() - t0:.0f}s]", flush=True)  # added: one line per episode
    rewards.append(step)
    if step >= best_score:
        best_weights = model.get_weights()
        best_score = step
        best_episode = episode + 1  # added (1-based, as printed)
    if episode > 50:
        training_step(batch_size)
    if time.time() - t0 > MAX_SECONDS:  # added: time box
        stopped_early = True
        print(f"\nTIME BOX HIT after {episode + 1} episodes")
        break

wall = time.time() - t0  # added
final_weights = model.get_weights()  # added: weights after the last training step
model.set_weights(best_weights)  # extra code { restores the best model weights
print(f"\ntraining wall time: {wall:.1f}s; episodes completed: {len(rewards)}; "
      f"best_score (step index) {best_score} at episode {best_episode}; last {rewards[-1]}")


# ---- added: greedy evaluation (epsilon = 0) --------------------------------
def greedy_eval(weights):
    model.set_weights(weights)
    lengths = []
    for i in range(20):
        obs, info = env.reset(seed=1000 + i)
        steps = 0
        for step in range(200):
            # same as epsilon_greedy_policy(obs, 0) but via model(...) instead of predict (speed)
            action = int(np.argmax(model(obs[np.newaxis]).numpy()[0]))
            obs, reward, done, truncated, info = env.step(action)
            steps += 1
            if done or truncated:
                break
        lengths.append(steps)
    return lengths


eval_best = greedy_eval(best_weights)
eval_final = greedy_eval(final_weights)
model.set_weights(best_weights)
print("eval_best:", eval_best, "mean", np.mean(eval_best))
print("eval_final:", eval_final, "mean", np.mean(eval_final))

dump("dqn_run.json", {
    "meta": {
        "versions": versions(),
        "seeds": {"slides": "none set on slides 61-64",
                  "used": "tf.random.set_seed(42) before model build; env.reset(seed=42), "
                          "np.random.seed(42), tf.random.set_seed(42) before the loop "
                          "(Geron ch. 18 notebook convention)",
                  "eval env.reset seeds": "1000+i, i=0..19"},
        "hyperparameters": {"episodes": 600, "max_steps": 200,
                            "epsilon": "max(1 - episode / 500, 0.01)",
                            "train_after_episode_index": 50, "train_steps_per_episode": 1,
                            "batch_size": batch_size, "discount_factor": discount_factor,
                            "replay_buffer_maxlen": 2000,
                            "optimizer": "Nadam(learning_rate=1e-2)",
                            "loss": "mean_squared_error"},
        "architecture": "Dense(32, elu, input 4) -> Dense(32, elu) -> Dense(2) = Q(s, left/right)",
        "param_count": param_count,
        "param_count_derived": "4*32+32 + 32*32+32 + 32*2+2 = 1282",
        "wall_seconds": round(wall, 1),
        "device": "CPU (CUDA_VISIBLE_DEVICES=-1)",
        "episodes_completed": len(rewards),
        "stopped_early_by_time_box": stopped_early,
        "best_score": int(best_score),
        "best_episode": best_episode,
        "last_score": int(rewards[-1]),
        "slide_printed_final": "Episode: 600, Steps: 100, eps: 0.010",
        "model_build_warnings": model_warnings,
        "notes": [
            "curve = the slide's rewards list: `step` per episode, i.e. the 0-based index of "
            "the last step (episode length - 1; 199 = full 200-step episode). The slide's print shows step + 1.",
            "best_weights kept exactly as slide 64 (step >= best_score, so the latest episode "
            "tying the best wins); best_episode is 1-based.",
            "final_weights = weights after the last training_step, before model.set_weights(best_weights).",
            "eval_best / eval_final = episode lengths (steps survived, 200 max) for 20 greedy "
            "(epsilon = 0) episodes with reset(seed=1000+i); argmax of model(obs) instead of "
            "model.predict for speed (same Q-values).",
            "Slide 63 loss_fn = tf.keras.losses.mean_squared_error raises AttributeError under "
            "Keras 3.15.1 (tf.keras.losses only exposes mse / MSE / MeanSquaredError); "
            "changed to tf.keras.losses.mse. Slide 17 reader_mode typo -> render_mode. "
            "Everything else as on slides 61-64.",
            "Own run; RL is seed-sensitive, the lecturer's own run ended at 100 steps.",
        ],
    },
    "curve": [int(r) for r in rewards],
    "best_weights": weights_to_json(best_weights),
    "final_weights": weights_to_json(final_weights),
    "eval_best": eval_best,
    "eval_final": eval_final,
})
