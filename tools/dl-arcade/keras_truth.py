"""keras_truth.py — ground truth for the Gradient Arcade parameter/shape maths.

Builds a few hundred seeded random layer configs per layer type with REAL Keras
and records, for each, the spec (in the same plain-object format the JS uses),
`model.count_params()`, the trainable / non-trainable split and the output
shape (batch dimension dropped, `None` kept). It also builds the models printed
on the lecture slides (the "anchors") and records what Keras 3 gives for them.

Output: tools/dl-arcade/keras-truth.json, checked by tools/dl-arcade/check-maths.mjs.

Run (from the repo root; see BRIEF-maths-verifier.md "Running Keras"):
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "<repo>" \
    -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
    /home/james/miniconda3/envs/tf-2.20-gpu/bin/python tools/dl-arcade/keras_truth.py

Env knobs: KT_SCALE=0.05 for a quick smoke run (scales every per-type count).
Deterministic: the config generator is random.Random(5017).
"""

import datetime
import json
import os
import random
import sys
import time

os.environ.setdefault("KERAS_BACKEND", "tensorflow")
os.environ.setdefault("CUDA_VISIBLE_DEVICES", "-1")
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402
import keras  # noqa: E402
from keras import layers  # noqa: E402

SEED = 5017
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "keras-truth.json")
SCALE = float(os.environ.get("KT_SCALE", "1"))

# Configs per layer type (scaled by KT_SCALE). The brief asks for ~200 each,
# fewer for the expensive ones, never below 60.
COUNTS = {
    "Dense": 200,
    "Conv2D": 220,
    "Conv2DTranspose": 200,
    "MaxPool2D": 120,
    "AvgPool2D": 120,
    "GlobalAvgPool2D": 60,
    "Flatten": 60,
    "Reshape": 60,
    "BatchNormalization": 100,
    "Dropout": 60,
    "SimpleRNN": 150,
    "LSTM": 150,
    "GRU": 200,
    "Bidirectional": 150,
    "Conv1D": 200,
    "MultiHeadAttention": 120,
    "Embedding": 100,
    "DenseTranspose": 60,
}


# ── helpers ────────────────────────────────────────────────────────────────
def out_shape(model):
    """Output shape without the batch axis; None stays None."""
    return [None if d is None else int(d) for d in model.output_shape[1:]]


def counts(model):
    total = int(model.count_params())
    trainable = int(sum(int(np.prod(w.shape)) for w in model.trainable_weights))
    non_trainable = int(sum(int(np.prod(w.shape)) for w in model.non_trainable_weights))
    assert total == trainable + non_trainable, (total, trainable, non_trainable)
    return total, trainable, non_trainable


def pair(v):
    return tuple(v) if isinstance(v, (list, tuple)) else (v, v)


def size(rnd, common=(28, 32, 224)):
    """Input sizes 5–64, with the common image sizes mixed in."""
    return rnd.choice(common) if rnd.random() < 0.2 else rnd.randint(5, 64)


def maybe_none_len(rnd, p=0.5):
    return None if rnd.random() < p else rnd.randint(5, 64)


class DenseTranspose(layers.Layer):
    """Lecture 5 slide 20's tied-weight decoder layer (with the `# ***` fix):
    reuses `dense`'s kernel transposed and owns only a bias of the size of
    `dense`'s input."""

    def __init__(self, dense, activation=None, **kwargs):
        super().__init__(**kwargs)
        self.dense = dense
        self.activation = keras.activations.get(activation)

    def build(self, batch_input_shape):
        try:
            in_dim = self.dense.input.shape[-1]  # as on the slide
        except (AttributeError, ValueError):
            in_dim = self.dense.kernel.shape[0]  # same number, without a graph
        self.biases = self.add_weight(name="bias", shape=[in_dim], initializer="zeros")
        super().build(batch_input_shape)

    def call(self, inputs):
        z = keras.ops.matmul(inputs, keras.ops.transpose(self.dense.kernel))
        return self.activation(z + self.biases)


# ── spec → Keras layer ──────────────────────────────────────────────────────
def make_layer(spec):
    t = spec["type"]
    if t == "Dense":
        return layers.Dense(spec["units"], use_bias=spec.get("useBias", True))
    if t == "Conv2D":
        return layers.Conv2D(
            spec["filters"], pair(spec["kernel"]), strides=pair(spec.get("strides", 1)),
            padding=spec.get("padding", "valid"), use_bias=spec.get("useBias", True))
    if t == "Conv2DTranspose":
        return layers.Conv2DTranspose(
            spec["filters"], pair(spec["kernel"]), strides=pair(spec.get("strides", 1)),
            padding=spec.get("padding", "valid"), use_bias=spec.get("useBias", True))
    if t == "Conv1D":
        return layers.Conv1D(
            spec["filters"], spec["kernel"], strides=spec.get("strides", 1),
            padding=spec.get("padding", "valid"), use_bias=spec.get("useBias", True))
    if t in ("MaxPool2D", "AvgPool2D"):
        cls = layers.MaxPool2D if t == "MaxPool2D" else layers.AvgPool2D
        strides = spec.get("strides")
        return cls(pool_size=pair(spec["pool"]), strides=None if strides is None else pair(strides),
                   padding=spec.get("padding", "valid"))
    if t == "GlobalAvgPool2D":
        return layers.GlobalAvgPool2D()
    if t == "Flatten":
        return layers.Flatten()
    if t == "Reshape":
        return layers.Reshape(tuple(spec["target"]))
    if t == "BatchNormalization":
        return layers.BatchNormalization()
    if t == "Dropout":
        return layers.Dropout(spec.get("rate", 0.5))
    if t == "SimpleRNN":
        return layers.SimpleRNN(spec["units"], return_sequences=spec.get("returnSequences", False))
    if t == "LSTM":
        return layers.LSTM(spec["units"], return_sequences=spec.get("returnSequences", False))
    if t == "GRU":
        return layers.GRU(spec["units"], return_sequences=spec.get("returnSequences", False),
                          reset_after=spec.get("resetAfter", True))
    if t == "Bidirectional":
        return layers.Bidirectional(make_layer(spec["layer"]), merge_mode=spec.get("mergeMode", "concat"))
    if t == "Embedding":
        return layers.Embedding(spec["inputDim"], spec["outputDim"])
    if t == "MultiHeadAttention":
        return layers.MultiHeadAttention(
            num_heads=spec["heads"], key_dim=spec["keyDim"], value_dim=spec.get("valueDim"),
            use_bias=spec.get("useBias", True))
    if t == "DenseTranspose":
        # `units` is the tied Dense layer's INPUT size (= this layer's output size)
        dense = layers.Dense(spec["inputShape"][-1])
        keras.Sequential([keras.Input(shape=(spec["units"],)), dense])  # builds the kernel
        return DenseTranspose(dense)
    raise ValueError(f"unknown layer type {t}")


def build(spec):
    shape = tuple(spec["inputShape"])
    if spec["type"] == "MultiHeadAttention":
        x = keras.Input(shape=shape)
        y = make_layer(spec)(x, x)
        return keras.Model(x, y)
    return keras.Sequential([keras.Input(shape=shape), make_layer(spec)])


def measure(spec):
    """(total, trainable, non_trainable, output shape) that Keras gives for one spec."""
    if spec["type"] == "DenseTranspose":
        # Keras tracks the tied Dense as a sub-layer, so a stand-alone DenseTranspose
        # model would count the borrowed kernel too. What the layer ADDS is the
        # tied pair's de-duplicated count minus the Dense's own count (as in the
        # slide's tied_ae, where the encoder already owns the kernel).
        n_in, units = spec["inputShape"][-1], spec["units"]
        dense = layers.Dense(n_in)
        pair_model = keras.Sequential([keras.Input(shape=(units,)), dense, DenseTranspose(dense)])
        total, trainable, non_trainable = counts(pair_model)
        d_total, d_trainable, d_non = counts(keras.Sequential([keras.Input(shape=(units,)), dense]))
        return total - d_total, trainable - d_trainable, non_trainable - d_non, out_shape(pair_model)
    model = build(spec)
    total, trainable, non_trainable = counts(model)
    return total, trainable, non_trainable, out_shape(model)


# ── random spec generators ─────────────────────────────────────────────────
def spatial(rnd, allow_none=True):
    """A [h, w, c] input; ~8 % of the time the spatial dims are unknown."""
    c = rnd.choice([1, 3, rnd.randint(1, 64)])
    if allow_none and rnd.random() < 0.08:
        return [None, None, c]
    h = size(rnd)
    w = h if rnd.random() < 0.6 else size(rnd)
    return [h, w, c]


def gen_dense(rnd):
    n_in = rnd.choice([784, 30, 100, 300, rnd.randint(1, 128), rnd.randint(1, 128)])
    r = rnd.random()
    if r < 0.15:
        shape = [maybe_none_len(rnd), n_in]  # Dense on a sequence: last axis only
    elif r < 0.22:
        shape = [rnd.randint(2, 8), rnd.randint(2, 8), n_in]
    else:
        shape = [n_in]
    return {"type": "Dense", "units": rnd.randint(1, 128), "useBias": rnd.random() < 0.7, "inputShape": shape}


def gen_conv2d(rnd, transpose=False):
    kh = rnd.randint(1, 7)
    kw = kh if rnd.random() < 0.6 else rnd.randint(1, 7)
    sh = rnd.randint(1, 3)
    sw = sh if rnd.random() < 0.7 else rnd.randint(1, 3)
    padding = rnd.choice(["valid", "same"])
    shape = spatial(rnd)
    if not transpose and padding == "valid" and shape[0] is not None:
        shape[0] = max(shape[0], kh)
        shape[1] = max(shape[1], kw)
    return {
        "type": "Conv2DTranspose" if transpose else "Conv2D",
        "filters": rnd.randint(1, 128),
        "kernel": kh if (kh == kw and rnd.random() < 0.5) else [kh, kw],
        "strides": sh if (sh == sw and rnd.random() < 0.5) else [sh, sw],
        "padding": padding,
        "useBias": rnd.random() < 0.7,
        "inputShape": shape,
    }


def gen_pool(rnd, kind):
    ph = rnd.randint(1, 4)
    pw = ph if rnd.random() < 0.6 else rnd.randint(1, 4)
    padding = rnd.choice(["valid", "same"])
    shape = spatial(rnd)
    if padding == "valid" and shape[0] is not None:
        shape[0] = max(shape[0], ph)
        shape[1] = max(shape[1], pw)
    spec = {"type": kind, "pool": ph if (ph == pw and rnd.random() < 0.5) else [ph, pw],
            "padding": padding, "inputShape": shape}
    if rnd.random() < 0.5:  # otherwise strides default to the pool size
        sh = rnd.randint(1, 3)
        sw = sh if rnd.random() < 0.7 else rnd.randint(1, 3)
        spec["strides"] = sh if (sh == sw and rnd.random() < 0.5) else [sh, sw]
    return spec


def gen_gap(rnd):
    return {"type": "GlobalAvgPool2D", "inputShape": spatial(rnd)}


def gen_flatten(rnd):
    r = rnd.random()
    if r < 0.5:
        shape = [rnd.randint(1, 32), rnd.randint(1, 32), rnd.randint(1, 64)]
    elif r < 0.8:
        shape = [rnd.randint(1, 64), rnd.randint(1, 64)]
    elif r < 0.9:
        shape = [rnd.randint(1, 128)]
    else:
        shape = [None, rnd.randint(1, 64)]
    return {"type": "Flatten", "inputShape": shape}


def gen_reshape(rnd):
    dims = [rnd.randint(1, 8) for _ in range(3)]
    total = dims[0] * dims[1] * dims[2]
    options = [[total], [dims[0], dims[1] * dims[2]], [dims[0] * dims[1], dims[2]], dims]
    src = rnd.choice(options)
    tgt = rnd.choice([o for o in options if o != src])
    return {"type": "Reshape", "target": tgt, "inputShape": src}


def gen_bn(rnd):
    r = rnd.random()
    c = rnd.randint(1, 128)
    if r < 0.4:
        shape = [c]
    elif r < 0.6:
        shape = [maybe_none_len(rnd), c]
    else:
        shape = [rnd.randint(1, 32), rnd.randint(1, 32), c]
    return {"type": "BatchNormalization", "inputShape": shape}


def gen_dropout(rnd):
    shape = rnd.choice([[rnd.randint(1, 128)], [maybe_none_len(rnd), rnd.randint(1, 32)],
                        [rnd.randint(1, 16), rnd.randint(1, 16), rnd.randint(1, 32)]])
    return {"type": "Dropout", "rate": rnd.choice([0.1, 0.2, 0.25, 0.5]), "inputShape": shape}


def gen_rnn(rnd, kind, inner=False):
    spec = {"type": kind, "units": rnd.randint(1, 128), "returnSequences": rnd.random() < 0.5}
    if kind == "GRU":
        spec["resetAfter"] = rnd.random() < 0.5
    if not inner:
        spec["inputShape"] = [maybe_none_len(rnd), rnd.randint(1, 64)]
    return spec


def gen_bidirectional(rnd):
    inner = gen_rnn(rnd, rnd.choice(["SimpleRNN", "LSTM", "GRU"]), inner=True)
    spec = {"type": "Bidirectional", "layer": inner, "inputShape": [maybe_none_len(rnd), rnd.randint(1, 64)]}
    if rnd.random() < 0.2:
        spec["mergeMode"] = rnd.choice(["sum", "ave", "mul"])
    return spec


def gen_conv1d(rnd):
    k = rnd.randint(1, 7)
    padding = rnd.choice(["valid", "same", "causal"])
    n = maybe_none_len(rnd, p=0.4)
    if padding == "valid" and n is not None:
        n = max(n, k)
    return {"type": "Conv1D", "filters": rnd.randint(1, 128), "kernel": k, "strides": rnd.randint(1, 3),
            "padding": padding, "useBias": rnd.random() < 0.7, "inputShape": [n, rnd.randint(1, 64)]}


def gen_mha(rnd):
    spec = {"type": "MultiHeadAttention", "heads": rnd.randint(1, 8), "keyDim": rnd.randint(4, 64),
            "valueDim": rnd.randint(4, 64) if rnd.random() < 0.35 else None,
            "inputShape": [maybe_none_len(rnd), rnd.choice([rnd.randint(4, 128), 512, 64])]}
    if rnd.random() < 0.15:
        spec["useBias"] = False
    return spec


def gen_embedding(rnd):
    return {"type": "Embedding", "inputDim": rnd.choice([rnd.randint(2, 5000), 1000, 10000]),
            "outputDim": rnd.randint(1, 128), "inputShape": [maybe_none_len(rnd)]}


def gen_dense_transpose(rnd):
    # tied to Dense(u) that was fed `units` inputs; this layer maps u → units
    return {"type": "DenseTranspose", "units": rnd.randint(1, 128), "inputShape": [rnd.randint(1, 128)]}


GENERATORS = {
    "Dense": gen_dense,
    "Conv2D": lambda r: gen_conv2d(r, False),
    "Conv2DTranspose": lambda r: gen_conv2d(r, True),
    "MaxPool2D": lambda r: gen_pool(r, "MaxPool2D"),
    "AvgPool2D": lambda r: gen_pool(r, "AvgPool2D"),
    "GlobalAvgPool2D": gen_gap,
    "Flatten": gen_flatten,
    "Reshape": gen_reshape,
    "BatchNormalization": gen_bn,
    "Dropout": gen_dropout,
    "SimpleRNN": lambda r: gen_rnn(r, "SimpleRNN"),
    "LSTM": lambda r: gen_rnn(r, "LSTM"),
    "GRU": lambda r: gen_rnn(r, "GRU"),
    "Bidirectional": gen_bidirectional,
    "Conv1D": gen_conv1d,
    "MultiHeadAttention": gen_mha,
    "Embedding": gen_embedding,
    "DenseTranspose": gen_dense_transpose,
}


# ── the slide models (anchors) ─────────────────────────────────────────────
def layer_rows(model):
    rows = []
    for layer in model.layers:
        try:
            shape = [None if d is None else int(d) for d in layer.output.shape[1:]]
        except (AttributeError, ValueError):
            shape = None
        rows.append({"name": layer.name, "class": layer.__class__.__name__,
                     "params": int(layer.count_params()), "out": shape})
    return rows


def anchor(model, lecture, slides, note=None):
    total, trainable, non_trainable = counts(model)
    rec = {"lecture": lecture, "slides": slides, "total": total, "trainable": trainable,
           "nonTrainable": non_trainable, "outputShape": out_shape(model), "layers": layer_rows(model)}
    if note:
        rec["note"] = note
    return rec


def anchor_models():
    A = {}
    # Lecture 2 slide 26/27: Batch Normalization in Keras (summary printed on slide 27)
    A["l2-bn-mlp"] = anchor(keras.Sequential([
        keras.Input(shape=(28, 28)), layers.Flatten(), layers.BatchNormalization(),
        layers.Dense(300, activation="relu"), layers.BatchNormalization(),
        layers.Dense(100, activation="relu"), layers.BatchNormalization(),
        layers.Dense(10, activation="softmax")]), 2, [26, 27])

    # Lecture 3 slide 22: 200 filters of 5×5, stride 1, "same", on a 150×100 RGB image
    A["l3-conv-200x5"] = anchor(keras.Sequential([
        keras.Input(shape=(150, 100, 3)), layers.Conv2D(200, 5, strides=1, padding="same")]), 3, [22])
    # Lecture 3 slide 22 footnote: a fully connected 150×100 layer on 150×100×3 inputs (weights only)
    A["l3-dense-675m"] = anchor(keras.Sequential([
        keras.Input(shape=(150 * 100 * 3,)), layers.Dense(150 * 100, use_bias=False)]), 3, [22],
        note="footnote 5: 150² × 100² × 3 = 675 million weights (no bias term in the slide's count)")
    # Lecture 3 slide 35: the Fashion-MNIST CNN (no total printed on the slide)
    A["l3-fashion-cnn"] = anchor(keras.Sequential([
        keras.Input(shape=(28, 28, 1)),
        layers.Conv2D(64, 7, padding="same", activation="relu"), layers.MaxPool2D(),
        layers.Conv2D(128, 3, padding="same", activation="relu"),
        layers.Conv2D(128, 3, padding="same", activation="relu"), layers.MaxPool2D(),
        layers.Conv2D(256, 3, padding="same", activation="relu"),
        layers.Conv2D(256, 3, padding="same", activation="relu"), layers.MaxPool2D(),
        layers.Flatten(), layers.Dense(128, activation="relu"), layers.Dropout(0.5),
        layers.Dense(64, activation="relu"), layers.Dropout(0.5),
        layers.Dense(10, activation="softmax")]), 3, [35], note="slide prints no parameter count")
    # Lecture 3 slide 37: LeNet-5 shapes (C1 5×5 → S2 avg 2 → C3 5×5 → S4 avg 2 → C5 5×5)
    A["l3-lenet5"] = anchor(keras.Sequential([
        keras.Input(shape=(32, 32, 1)),
        layers.Conv2D(6, 5, activation="tanh"), layers.AvgPool2D(2, 2),
        layers.Conv2D(16, 5, activation="tanh"), layers.AvgPool2D(2, 2),
        layers.Conv2D(120, 5, activation="tanh"), layers.Flatten(),
        layers.Dense(84, activation="tanh"), layers.Dense(10)]), 3, [37],
        note="shape anchor only: the table gives map sizes, not parameter counts (C3 is partially connected in LeNet-5)")

    # Lecture 4 slide 25: a single recurrent neuron
    A["l4-rnn1"] = anchor(keras.Sequential([keras.Input(shape=(None, 1)), layers.SimpleRNN(1)]), 4, [25])
    # Lecture 4 slide 27: univar_model
    A["l4-univar"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 1)), layers.SimpleRNN(32), layers.Dense(1)]), 4, [27])
    # Lecture 4 (brief): SimpleRNN(20) + Dense(1), not printed on a slide
    A["l4-rnn20"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 1)), layers.SimpleRNN(20), layers.Dense(1)]), 4, [],
        note="not printed on any slide; the build brief's own check value")
    # Lecture 4 slide 43: lstm_model
    A["l4-lstm"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 1)), layers.LSTM(12), layers.Dense(1)]), 4, [43])
    # Lecture 4 slide 49: gru_model (Keras default reset_after=True) and the slides' one-bias form
    A["l4-gru"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 1)), layers.GRU(20), layers.Dense(1)]), 4, [49])
    A["l4-gru-one-bias"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 1)), layers.GRU(20, reset_after=False), layers.Dense(1)]), 4, [49],
        note="reset_after=False: one bias per gate, as the slide's equations show")
    # Lecture 4 slide 50: cnn_gru_model
    A["l4-cnn-gru"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 1)),
        layers.Conv1D(filters=8, kernel_size=3, strides=1, activation="relu"),
        layers.Conv1D(filters=16, kernel_size=3, strides=2, activation="relu"),
        layers.GRU(10), layers.Dense(1)]), 4, [50])
    A["l4-cnn-gru-56"] = anchor(keras.Sequential([
        keras.Input(shape=(56, 1)),
        layers.Conv1D(filters=8, kernel_size=3, strides=1, activation="relu"),
        layers.Conv1D(filters=16, kernel_size=3, strides=2, activation="relu"),
        layers.GRU(10), layers.Dense(1)]), 4, [50], note="same model on the deck's 56-step windows (slide 20)")

    # Lecture 5 slide 12: stacked_ae
    stacked_encoder = keras.Sequential([
        keras.Input(shape=(28, 28)), layers.Flatten(),
        layers.Dense(100, activation="relu"), layers.Dense(30, activation="relu")])
    stacked_decoder = keras.Sequential([
        keras.Input(shape=(30,)), layers.Dense(100, activation="relu"),
        layers.Dense(28 * 28), layers.Reshape([28, 28])])
    stacked_ae = keras.Sequential([stacked_encoder, stacked_decoder])
    A["l5-stacked-ae"] = anchor(stacked_ae, 5, [12])
    A["l5-stacked-ae"]["layers"] = layer_rows(stacked_encoder) + layer_rows(stacked_decoder)
    # Lecture 5 slides 20–21: tied_ae (DenseTranspose owns only a bias)
    dense_1 = layers.Dense(100, activation="relu")
    dense_2 = layers.Dense(30, activation="relu")
    tied_encoder = keras.Sequential([keras.Input(shape=(28, 28)), layers.Flatten(), dense_1, dense_2])
    tied_decoder = keras.Sequential([
        keras.Input(shape=(30,)), DenseTranspose(dense_2, activation="relu"),
        DenseTranspose(dense_1), layers.Reshape([28, 28])])
    tied_ae = keras.Sequential([tied_encoder, tied_decoder])
    A["l5-tied-ae"] = anchor(tied_ae, 5, [20, 21])
    own = []
    for layer in tied_encoder.layers + tied_decoder.layers:
        own_vars = layer._trainable_variables + layer._non_trainable_variables
        own.append({"name": layer.name, "class": layer.__class__.__name__,
                    "params": int(sum(int(np.prod(w.shape)) for w in own_vars)),
                    "out": [None if d is None else int(d) for d in layer.output.shape[1:]]})
    A["l5-tied-ae"]["layers"] = own
    A["l5-tied-ae"]["note"] = ("layers[].params counts each layer's OWN variables (the DenseTranspose "
                               "layers also track the tied Dense they reuse; model totals are de-duplicated)")

    # Lecture 6–7 slides 5–6: conv_ae (decoder summary printed; conv_ae.count_params() printed)
    conv_encoder = keras.Sequential([
        keras.Input(shape=(28, 28)), layers.Reshape([28, 28, 1]),
        layers.Conv2D(16, 3, padding="same", activation="relu"), layers.MaxPool2D(pool_size=2),
        layers.Conv2D(32, 3, padding="same", activation="relu"), layers.MaxPool2D(pool_size=2),
        layers.Conv2D(64, 3, padding="same", activation="relu"), layers.MaxPool2D(pool_size=2),
        layers.Conv2D(30, 3, padding="same", activation="relu"), layers.GlobalAvgPool2D()])
    conv_decoder = keras.Sequential([
        keras.Input(shape=(30,)), layers.Dense(3 * 3 * 16), layers.Reshape((3, 3, 16)),
        layers.Conv2DTranspose(32, 3, strides=2, activation="relu"),
        layers.Conv2DTranspose(16, 3, strides=2, padding="same", activation="relu"),
        layers.Conv2DTranspose(1, 3, strides=2, padding="same"), layers.Reshape([28, 28])])
    conv_ae = keras.Sequential([conv_encoder, conv_decoder])
    A["l67-conv-encoder"] = anchor(conv_encoder, 6, [5])
    A["l67-conv-decoder"] = anchor(conv_decoder, 6, [5, 6])
    A["l67-conv-ae"] = anchor(conv_ae, 6, [5, 6])

    # Lecture 8 slide 9: simple_biRNN
    A["l8-simple-birnn"] = anchor(keras.Sequential([
        keras.Input(shape=(None, 2)), layers.Bidirectional(layers.SimpleRNN(16)), layers.Dense(2)]), 8, [9])
    # Lecture 8 slide 14: rnn_ed (functional; no count printed on the slide)
    encoder_inputs = keras.Input(shape=[None, 2])
    encoder = layers.Bidirectional(layers.SimpleRNN(16, return_state=True))
    encoder_outputs, *encoder_state = encoder(encoder_inputs)
    encoder_state = layers.Concatenate(axis=-1)(encoder_state)
    decoder_inputs = keras.Input(shape=[None, 2])
    decoder = layers.SimpleRNN(32, return_sequences=True)
    decoder_outputs = decoder(decoder_inputs, initial_state=encoder_state)
    outputs = layers.Dense(2)(decoder_outputs)
    rnn_ed = keras.Model(inputs=[encoder_inputs, decoder_inputs], outputs=outputs)
    A["l8-rnn-ed"] = anchor(rnn_ed, 8, [14], note="slide prints no parameter count")
    # Lecture 8 slide 46: a 16×16 RGB patch flattens to 768
    A["l8-vit-patch"] = anchor(keras.Sequential([keras.Input(shape=(16, 16, 3)), layers.Flatten()]), 8, [46])
    return A


# ── main ───────────────────────────────────────────────────────────────────
def main():
    rnd = random.Random(SEED)
    t0 = time.time()
    configs = []
    per_type = {}
    for kind, n in COUNTS.items():
        n = max(5, int(round(n * SCALE)))
        gen = GENERATORS[kind]
        t1 = time.time()
        for _ in range(n):
            spec = gen(rnd)
            total, trainable, non_trainable, shape = measure(spec)
            configs.append({"spec": spec, "total": total, "trainable": trainable,
                            "nonTrainable": non_trainable, "outputShape": shape})
        per_type[kind] = n
        print(f"  {kind:<20} {n:>4} configs  {time.time() - t1:5.1f}s", file=sys.stderr)
    anchors = anchor_models()
    doc = {
        "meta": {
            "tensorflow": tf.__version__,
            "keras": keras.__version__,
            "python": sys.version.split()[0],
            "backend": keras.backend.backend(),
            "date": datetime.date.today().isoformat(),
            "seed": SEED,
            "scale": SCALE,
            "perType": per_type,
            "configs": len(configs),
            "seconds": round(time.time() - t0, 1),
            "method": {
                "count": "model.count_params(); trainable = sum(prod(w.shape) for w in model.trainable_weights)",
                "shape": "model.output_shape[1:] (batch axis dropped, None kept)",
                "DenseTranspose": "count_params() of the tied pair [Input, Dense, DenseTranspose(Dense)] minus the Dense's own count_params()",
            },
        },
        "configs": configs,
        "anchors": anchors,
    }
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(doc, f, indent=1)
    print(f"wrote {OUT}: {len(configs)} configs, {len(anchors)} anchors, "
          f"TF {tf.__version__}, Keras {keras.__version__}, {doc['meta']['seconds']}s", file=sys.stderr)


if __name__ == "__main__":
    main()
