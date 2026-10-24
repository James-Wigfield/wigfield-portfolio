"""Slides 17-22 (CITS5017 Lecture 9): Gymnasium CartPole + the hard-coded basic_policy.

Code copied from the slides as written; additions are marked "# added".
Writes out/env_check.json (slides 17-20 checks) and out/basic_policy.json (slide 22).
"""
import traceback
import warnings

import numpy as np

from rl_common import versions, dump  # added

warnings.simplefilter("always")  # added: surface every warning in the log

V = versions()  # added
print("versions:", V)

check = {"versions": V}

# ---- slide 17, exactly as written -------------------------------------------
import gymnasium as gym

with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    try:
        env = gym.make("CartPole-v1", reader_mode="rgb_array")
        check["slide17_reader_mode"] = {"ok": True, "exception": None}
        obs, info = env.reset(seed=42)
        check["slide17_reader_mode"]["obs"] = obs.tolist()
    except Exception as e:  # added
        check["slide17_reader_mode"] = {
            "ok": False,
            "exception_type": type(e).__name__,
            "exception": str(e),
            "traceback_tail": traceback.format_exc().strip().splitlines()[-3:],
        }
    check["slide17_reader_mode"]["warnings"] = [f"{x.category.__name__}: {x.message}" for x in w]
print("slide 17 (reader_mode):", check["slide17_reader_mode"])

# ---- the corrected spelling -------------------------------------------------
with warnings.catch_warnings(record=True) as w:
    warnings.simplefilter("always")
    env = gym.make("CartPole-v1", render_mode="rgb_array")
    obs, info = env.reset(seed=42)
    check["slide17_render_mode"] = {
        "ok": True,
        "obs": [float(x) for x in obs],
        "slide_obs": [0.0273956, -0.00611216, 0.03585979, 0.0197368],
        "info": info,
        "warnings": [f"{x.category.__name__}: {x.message}" for x in w],
    }
    check["slide17_render_mode"]["obs_matches_slide_6dp"] = bool(
        np.allclose(obs, check["slide17_render_mode"]["slide_obs"], atol=5e-7))
print("slide 17 (render_mode):", check["slide17_render_mode"])

# ---- slide 18: render ------------------------------------------------------
try:
    img = env.render()
    check["slide18_render_shape"] = list(img.shape)
except Exception as e:  # added
    check["slide18_render_shape"] = f"{type(e).__name__}: {e}"
print("slide 18 img.shape:", check["slide18_render_shape"])

# ---- slide 19 / 20 ---------------------------------------------------------
check["slide19_action_space"] = str(env.action_space)
obs, info = env.reset(seed=42)  # added: same state as slide 17 before stepping
action = 1  # accelerate right
obs, reward, done, truncated, info = env.step(action)
check["slide20_step"] = {
    "obs": [float(x) for x in obs],
    "slide_obs": [0.02727336, 0.18847767, 0.03625453, -0.26141977],
    "reward": float(reward), "done": bool(done), "truncated": bool(truncated), "info": info,
}
check["slide20_step"]["obs_matches_slide_8dp"] = bool(
    np.allclose(obs, check["slide20_step"]["slide_obs"], atol=5e-9))
print("slide 19:", check["slide19_action_space"], " slide 20:", check["slide20_step"])

# added probe: play_one_step (slide 32) does env.step(int(action)) with a (1,1) bool tensor
try:
    import tensorflow as tf
    with warnings.catch_warnings(record=True) as w:
        warnings.simplefilter("always")
        val = int(tf.constant([[True]]))
    check["int_of_1x1_bool_tensor"] = {"ok": True, "value": val,
                                       "warnings": [f"{x.category.__name__}: {x.message}" for x in w]}
except Exception as e:  # added
    check["int_of_1x1_bool_tensor"] = {"ok": False, "exception": f"{type(e).__name__}: {e}"}
print("int(tf (1,1) bool):", check["int_of_1x1_bool_tensor"])

dump("env_check.json", check)

# ---- slide 21 ----------------------------------------------------------------
def basic_policy(obs):
    angle = obs[2]
    return 0 if angle < 0 else 1

# ---- slide 22, exactly as written -------------------------------------------
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

    totals.append(episode_rewards)

stats = (np.mean(totals), np.std(totals), np.min(totals), np.max(totals))
print(">>> np.mean(totals), np.std(totals), np.min(totals), np.max(totals)")
print(stats)

slide_printed = [41.698, 8.389445512070509, 24.0, 63.0]
stats_f = [float(x) for x in stats]
match = stats_f == slide_printed
print("slide printed:", tuple(slide_printed), " exact match:", match)

dump("basic_policy.json", {
    "versions": V,
    "stats": stats_f,
    "totals": [int(t) for t in totals],
    "slide_printed": slide_printed,
    "match": match,
})
