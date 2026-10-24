"""Slides 25 + 32-36 (CITS5017 Lecture 9): REINFORCE policy gradients on CartPole.

Slide code copied as written; additions/changes are marked "# added" / "# CHANGED".
Writes out/pg_run.json.
"""
import time
import warnings

import numpy as np

from rl_common import versions, weights_to_json, dump  # added

warnings.simplefilter("default")  # added

import gymnasium as gym

# slide 17 (with the slide's typo reader_mode -> render_mode; reader_mode raises TypeError)
env = gym.make("CartPole-v1", render_mode="rgb_array")

# ---- slide 25 --------------------------------------------------------------
import tensorflow as tf

n_inputs = 4        # == env.observation_space.shape[0]

notes = []  # added
with warnings.catch_warnings(record=True) as w:  # added: capture the Keras 3 warning
    warnings.simplefilter("always")
    # create the model
    tf.random.set_seed(42)
    model = tf.keras.models.Sequential([
        tf.keras.layers.Dense(5, activation="relu", input_shape=[n_inputs]),
        tf.keras.layers.Dense(1, activation="sigmoid"),
    ])
model_warnings = [f"{x.category.__name__}: {x.message}" for x in w]  # added
for m in model_warnings:
    print("WARNING (model build):", m)

# reset the game environment, for reproducibility
obs, info = env.reset(seed=42)

param_count = int(model.count_params())  # added
derived = 4 * 5 + 5 + 5 * 1 + 1  # added
print("param_count:", param_count, "derived 4*5+5 + 5*1+1 =", derived)

# ---- slide 32 --------------------------------------------------------------
def play_one_step(env, obs, model, loss_fn):
    with tf.GradientTape() as tape:
        left_proba = model(obs[np.newaxis])
        action = (tf.random.uniform([1, 1]) > left_proba)
        y_target = tf.constant([[1.]]) - tf.cast(action, tf.float32)
        loss = tf.reduce_mean(loss_fn(y_target, left_proba))
    grads = tape.gradient(loss, model.trainable_variables)
    # CHANGED: slide has env.step(int(action)); under NumPy 2.5 int() of a (1, 1) tensor raises
    # "TypeError: only 0-dimensional arrays can be converted to Python scalars"
    obs, reward, done, truncated, info = env.step(int(action[0, 0]))
    return obs, reward, done, truncated, grads

# ---- slide 33 --------------------------------------------------------------
def play_multiple_episodes(env, n_episodes, n_max_steps, model, loss_fn):
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

    return all_rewards, all_grads

# ---- slide 34 --------------------------------------------------------------
def discount_rewards(rewards, discount_factor):
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
            for discounted_rewards in all_discounted_rewards]

# ---- slide 35 --------------------------------------------------------------
n_iterations = 150
n_episodes_per_update = 10
n_max_steps = 200
discount_factor = 0.95

optimizer = tf.keras.optimizers.Nadam(learning_rate=0.01)
loss_fn = tf.keras.losses.binary_crossentropy

# ---- slide 36 --------------------------------------------------------------
curve = []  # added
t0 = time.time()  # added
for iteration in range(n_iterations):
    all_rewards, all_grads = play_multiple_episodes(
        env, n_episodes_per_update, n_max_steps, model, loss_fn)

    # extra code { displays some debug info during training
    total_rewards = sum(map(sum, all_rewards))
    print(f"\rIteration: {iteration + 1}/{n_iterations},"
          f" mean rewards: {total_rewards / n_episodes_per_update:.1f}", end="")
    curve.append(round(float(total_rewards / n_episodes_per_update), 1))  # added
    print(f"   [{time.time() - t0:.0f}s]", flush=True)  # added: one line per iteration in the log

    all_final_rewards = discount_and_normalize_rewards(all_rewards,
                                                       discount_factor)
    all_mean_grads = []
    for var_index in range(len(model.trainable_variables)):
        mean_grads = tf.reduce_mean(
            [final_reward * all_grads[episode_index][step][var_index]
             for episode_index, final_rewards in enumerate(all_final_rewards)
                 for step, final_reward in enumerate(final_rewards)], axis=0)
        all_mean_grads.append(mean_grads)

    optimizer.apply_gradients(zip(all_mean_grads, model.trainable_variables))
wall = time.time() - t0  # added
print(f"\ntraining wall time: {wall:.1f}s")

# ---- added: evaluation, played the way slide 37's pg_policy plays (stochastic) ----
np.random.seed(42)  # slide 37


def pg_policy(obs):  # Geron's notebook: int(np.random.rand() > left_proba)
    left_proba = float(model(obs[np.newaxis])[0, 0])
    return int(np.random.rand() > left_proba)


def run_eval(policy):
    lengths = []
    for i in range(20):
        obs, info = env.reset(seed=1000 + i)
        steps = 0
        for step in range(200):
            obs, reward, done, truncated, info = env.step(policy(obs))
            steps += 1
            if done or truncated:
                break
        lengths.append(steps)
    return lengths


eval_stoch = run_eval(pg_policy)
eval_greedy = run_eval(lambda o: int(float(model(o[np.newaxis])[0, 0]) < 0.5))
print("eval (stochastic, np.random.seed(42)):", eval_stoch, "mean", np.mean(eval_stoch))
print("eval (greedy p(left)<0.5 -> right):", eval_greedy, "mean", np.mean(eval_greedy))

dump("pg_run.json", {
    "meta": {
        "versions": versions(),
        "seeds": {"tf.random.set_seed": 42, "env.reset(seed=...) before training": 42,
                  "np.random.seed (eval, slide 37)": 42,
                  "eval env.reset seeds": "1000+i, i=0..19"},
        "hyperparameters": {"n_iterations": n_iterations,
                            "n_episodes_per_update": n_episodes_per_update,
                            "n_max_steps": n_max_steps, "discount_factor": discount_factor,
                            "optimizer": "Nadam(learning_rate=0.01)",
                            "loss": "binary_crossentropy"},
        "architecture": "Dense(5, relu, input 4) -> Dense(1, sigmoid) = p(left)",
        "wall_seconds": round(wall, 1),
        "param_count": param_count,
        "param_count_derived": "4*5+5 + 5*1+1 = 31",
        "device": "CPU (CUDA_VISIBLE_DEVICES=-1)",
        "slide_printed_final": "Iteration: 150/150, mean rewards: 190.3",
        "model_build_warnings": model_warnings,
        "notes": [
            "Slide 17 has reader_mode='rgb_array' (TypeError); render_mode='rgb_array' used.",
            "Slide 32 env.step(int(action)) raises TypeError under NumPy 2.5.2 "
            "(only 0-dimensional arrays can be converted to Python scalars); "
            "changed to int(action[0, 0]). Everything else as on slides 25, 32-36.",
            "curve = total_rewards / n_episodes_per_update per iteration (what slide 36 prints), "
            "i.e. mean episode length over the 10 episodes, 200 max.",
            "eval = steps survived (episode length, 200 max) for 20 episodes, reset(seed=1000+i), "
            "stochastic play: action = int(np.random.rand() > p(left)) after np.random.seed(42).",
            "eval_greedy = same episodes, action = right if p(left) < 0.5.",
            "Own run; RL is seed-sensitive, do not expect the slide's 190.3.",
        ],
    },
    "curve": curve,
    "weights": weights_to_json(model.get_weights()),
    "eval": eval_stoch,
    "eval_greedy": eval_greedy,
})
