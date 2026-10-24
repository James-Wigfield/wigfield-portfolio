"""Shared helpers for the CITS5017 Lecture 9 offline runs (versions, JSON, weights)."""
import json
import os
import platform
import sys

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")
os.makedirs(OUT, exist_ok=True)


def versions():
    import numpy as np
    import gymnasium
    v = {
        "python": sys.version.split()[0],
        "gymnasium": gymnasium.__version__,
        "numpy": np.__version__,
        "platform": platform.platform(),
    }
    try:
        import tensorflow as tf
        import keras
        v["tensorflow"] = tf.__version__
        v["keras"] = keras.__version__
    except Exception as e:  # noqa: BLE001
        v["tensorflow"] = f"unavailable: {e}"
    return v


def weights_to_json(weights, nd=6):
    """[W0, b0, W1, b1, ...] -> [{"W": [[...]] (in x out), "b": [...]}, ...]"""
    layers = []
    for i in range(0, len(weights), 2):
        W, b = weights[i], weights[i + 1]
        layers.append({
            "W": [[round(float(x), nd) for x in row] for row in W.tolist()],
            "b": [round(float(x), nd) for x in b.tolist()],
        })
    return layers


def dump(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, separators=(",", ":"))
    print(f"\nwrote {path} ({os.path.getsize(path)} bytes)", flush=True)
    return path
