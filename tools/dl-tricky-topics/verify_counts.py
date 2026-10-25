"""
DL TRICKY TOPICS — verify every count, shape, size and probability in TensorFlow
--------------------------------------------------------------------------------
Reads specs.json (written by export-specs.mjs, which iterates topics/index.js)
and checks it against Keras, then writes keras-truth.json for check-maths.mjs:

  models    every named model (maths/models.js) and every model the drills
            generate (~200 seeds per mode): built (never trained) layer by
            layer; per-layer trainable / non-trainable counts and output
            shapes must equal this page's paramRules.js / shapeRules.js, and
            any count a slide prints (models.js `printed`) must equal Keras's
  verbatim  a few slide listings built from their own code, as a cross-check
            that the specs were transcribed right
  sweep     Conv1D, Conv2D, MaxPool2D and Conv2DTranspose output sizes for
            n <= 40, k <= 7, s <= 4, both paddings, against strideRules.js
  softmax   tf.nn.softmax against softmax.js, and shift invariance
  checks    any drill question's own `verify` items

Run it in the unit's read-only TensorFlow environment (WSL distro Ubuntu,
conda env tf-2.20-gpu; see cits5017-project-two/documents/ENVIRONMENT_SETUP.md;
nothing is installed), on the CPU, from Git Bash:

  node tools/dl-tricky-topics/export-specs.mjs
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "<repo>/tools/dl-tricky-topics" \
    -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
    /home/james/miniconda3/envs/tf-2.20-gpu/bin/python verify_counts.py

Prints a summary and every failure; exits 1 if anything disagrees.
"""
import json
import os
import sys
from functools import partial

import numpy as np
import tensorflow as tf

HERE = os.path.dirname(os.path.abspath(__file__))
SPECS = json.load(open(os.path.join(HERE, "specs.json"), encoding="utf-8"))
FAILS = []
L = tf.keras.layers


def fail(msg):
    FAILS.append(msg)
    print("FAIL", msg)


class DenseTranspose(L.Layer):
    """L5 slide 20's tied layer: the kernel is borrowed (transposed), only the
    biases are its own. The tied Dense is kept off Keras's tracking so the
    layer's own weights are just its biases."""

    def __init__(self, dense, activation=None, **kwargs):
        super().__init__(**kwargs)
        object.__setattr__(self, "_tied", dense)
        self.activation = tf.keras.activations.get(activation)

    def build(self, batch_input_shape):
        self.biases = self.add_weight(name="bias", shape=[self._tied.kernel.shape[0]], initializer="zeros")
        super().build(batch_input_shape)

    def call(self, inputs):
        z = tf.matmul(inputs, self._tied.kernel, transpose_b=True)
        return self.activation(z + self.biases)


def make_layer(spec, built):
    t = spec["t"]
    k = spec.get("k")
    s = spec.get("s", 1)
    pad = spec.get("pad", "valid")
    if t == "dense":
        return L.Dense(spec["units"], use_bias=spec.get("bias", True))
    if t == "denseT":
        return DenseTranspose(built[spec["tied"]])
    if t == "conv2d":
        return L.Conv2D(spec["filters"], kernel_size=k, strides=s, padding=pad, use_bias=spec.get("bias", True))
    if t == "conv1d":
        return L.Conv1D(spec["filters"], kernel_size=k, strides=s, padding=pad)
    if t == "conv2dT":
        return L.Conv2DTranspose(spec["filters"], kernel_size=k, strides=s, padding=pad)
    if t in ("maxpool2d", "avgpool2d", "maxpool1d"):
        cls = {"maxpool2d": L.MaxPool2D, "avgpool2d": L.AvgPool2D, "maxpool1d": L.MaxPool1D}[t]
        return cls(pool_size=spec.get("p", 2), strides=spec.get("s"), padding=pad)
    if t == "gap2d":
        return L.GlobalAvgPool2D()
    if t == "gap1d":
        return L.GlobalAvgPool1D()
    if t == "flatten":
        return L.Flatten()
    if t == "reshape":
        return L.Reshape(spec["to"])
    if t == "dropout":
        return L.Dropout(spec.get("rate", 0.5))
    if t == "activation":
        return L.Activation(spec.get("fn", "relu"))
    if t == "norm":
        return L.Normalization()
    if t == "bn":
        return L.BatchNormalization()
    if t == "simplernn":
        return L.SimpleRNN(spec["units"], return_sequences=spec.get("seq", False))
    if t == "lstm":
        return L.LSTM(spec["units"], return_sequences=spec.get("seq", False))
    if t == "gru":
        return L.GRU(spec["units"], return_sequences=spec.get("seq", False), reset_after=spec.get("resetAfter", True))
    if t == "bidir":
        return L.Bidirectional(make_layer(spec["layer"], built))
    if t == "concat":
        return L.Concatenate()
    raise ValueError(f"unknown layer type {t}")


def own_counts(layer, skip_ids=()):
    tr = sum(int(np.prod(w.shape)) for w in layer.trainable_weights if id(w) not in skip_ids)
    nt = sum(int(np.prod(w.shape)) for w in layer.non_trainable_weights if id(w) not in skip_ids)
    return tr, nt


def build(model_spec):
    """Build a model spec layer by layer; returns per-layer (trainable,
    non-trainable, output shape) and the model's deduplicated totals."""
    inp = L.Input(shape=model_spec["input"])
    built, tensors, rows = {}, {"input": inp}, []
    prev = inp
    for i, spec in enumerate(model_spec["layers"]):
        layer = make_layer(spec, built)
        src = spec.get("in")
        if src:
            src = src if isinstance(src, list) else [src]
            x = [tensors[n] for n in src]
            out = layer(x if len(x) > 1 else x[0])
        else:
            out = layer(prev)
        if spec.get("frozen"):
            layer.trainable = False
        lid = spec.get("id", f"_l{i}")
        built[lid] = layer
        tensors[lid] = out
        prev = out
        rows.append((layer, spec, out))
    model = tf.keras.Model(inp, prev)
    result = []
    for layer, spec, out in rows:
        skip = set()
        if spec["t"] == "denseT":
            skip = {id(w) for w in built[spec["tied"]].weights}
        tr, nt = own_counts(layer, skip)
        result.append({"trainable": tr, "nonTrainable": nt, "out": [None if d is None else int(d) for d in out.shape[1:]]})
    tr_all = sum(int(np.prod(w.shape)) for w in model.trainable_weights)
    nt_all = sum(int(np.prod(w.shape)) for w in model.non_trainable_weights)
    return result, tr_all, nt_all


print(f"TensorFlow {tf.__version__} · Keras {tf.keras.__version__ if hasattr(tf.keras, '__version__') else '?'}")
truth = {"tf": tf.__version__, "models": {}, "sweep": [], "softmax": [], "checks": [], "verbatim": {}}

# ── models: named and drill-generated ────────────────────────────────────────
n_ok = 0
for m in SPECS["models"]:
    try:
        rows, tr, nt = build(m["model"])
    except Exception as e:  # a spec Keras can't build is a failure too
        fail(f"{m['id']}: Keras could not build it: {e}")
        continue
    js = m["js"]
    ok = True
    for i, (k_row, j_row) in enumerate(zip(rows, js["rows"])):
        if (k_row["trainable"], k_row["nonTrainable"]) != (j_row["trainable"], j_row["nonTrainable"]):
            fail(f"{m['id']} layer {i} ({j_row['t']}): Keras {k_row['trainable']}+{k_row['nonTrainable']}, page {j_row['trainable']}+{j_row['nonTrainable']}")
            ok = False
        if k_row["out"] != j_row["out"]:
            fail(f"{m['id']} layer {i} ({j_row['t']}): Keras shape {k_row['out']}, page {j_row['out']}")
            ok = False
    if (tr, nt) != (js["trainable"], js["nonTrainable"]):
        fail(f"{m['id']} totals: Keras {tr}+{nt}, page {js['trainable']}+{js['nonTrainable']}")
        ok = False
    printed = m.get("printed") or {}
    if "total" in printed and printed["total"] != tr + nt:
        fail(f"{m['id']}: the slide prints total {printed['total']}, Keras {tr + nt}")
        ok = False
    if "trainable" in printed and printed["trainable"] != tr:
        fail(f"{m['id']}: the slide prints trainable {printed['trainable']}, Keras {tr}")
        ok = False
    if "nonTrainable" in printed and printed["nonTrainable"] != nt:
        fail(f"{m['id']}: the slide prints non-trainable {printed['nonTrainable']}, Keras {nt}")
        ok = False
    if "perLayer" in printed:
        got = [r["trainable"] + r["nonTrainable"] for r in rows]
        if printed["perLayer"] != got:
            fail(f"{m['id']}: the slide's per-layer {printed['perLayer']}, Keras {got}")
            ok = False
    n_ok += ok
    truth["models"][m["id"]] = {"rows": rows, "trainable": tr, "nonTrainable": nt, "ok": ok}
print(f"models: {n_ok}/{len(SPECS['models'])} agree with Keras")


# ── verbatim slide listings (cross-check the specs) ──────────────────────────
def verbatim():
    out = {}
    DefaultConv2D = partial(L.Conv2D, kernel_size=3, padding="same", activation="relu", kernel_initializer="he_normal")
    cnn = tf.keras.Sequential([
        L.InputLayer(shape=[28, 28, 1]),
        DefaultConv2D(filters=64, kernel_size=7),
        L.MaxPool2D(),
        DefaultConv2D(filters=128),
        DefaultConv2D(filters=128),
        L.MaxPool2D(),
        DefaultConv2D(filters=256),
        DefaultConv2D(filters=256),
        L.MaxPool2D(),
        L.Flatten(),
        L.Dense(units=128, activation="relu", kernel_initializer="he_normal"),
        L.Dropout(0.5),
        L.Dense(units=64, activation="relu", kernel_initializer="he_normal"),
        L.Dropout(0.5),
        L.Dense(units=10, activation="softmax"),
    ])
    out["l3-cnn"] = cnn.count_params()

    normalization_layer = L.Normalization()
    hidden_layer = L.Dense(20, activation="gelu")
    concat_layer = L.Concatenate()
    output_layer = L.Dense(3, activation="softmax")
    input_ = L.Input(shape=[10])
    normalized = normalization_layer(input_)
    hidden = hidden_layer(normalized)
    concat = concat_layer([normalized, hidden])
    output = output_layer(concat)
    model = tf.keras.Model(inputs=[input_], outputs=[output])
    out["sample-q1c"] = model.count_params()

    conv_decoder = tf.keras.Sequential([
        L.InputLayer(shape=[30]),
        L.Dense(3 * 3 * 16),
        L.Reshape((3, 3, 16)),
        L.Conv2DTranspose(32, 3, strides=2, activation="relu"),
        L.Conv2DTranspose(16, 3, strides=2, padding="same", activation="relu"),
        L.Conv2DTranspose(1, 3, strides=2, padding="same"),
        L.Reshape([28, 28]),
    ])
    out["l67-convdec"] = conv_decoder.count_params()

    generator = tf.keras.Sequential([
        L.InputLayer(shape=[100]),
        L.Dense(7 * 7 * 128),
        L.Reshape([7, 7, 128]),
        L.BatchNormalization(),
        L.Conv2DTranspose(64, kernel_size=5, strides=2, padding="same", activation="relu"),
        L.BatchNormalization(),
        L.Conv2DTranspose(1, kernel_size=5, strides=2, padding="same", activation="tanh"),
    ])
    out["l67-dcgan-g"] = generator.count_params()

    simple_biRNN = tf.keras.Sequential([
        L.InputLayer(shape=[None, 2]),
        L.Bidirectional(L.SimpleRNN(16)),
        L.Dense(2),
    ])
    out["l8-birnn"] = simple_biRNN.count_params()

    cnn_gru_model = tf.keras.Sequential([
        L.InputLayer(shape=[None, 1]),
        L.Conv1D(filters=8, kernel_size=3, strides=1, activation="relu"),
        L.Conv1D(filters=16, kernel_size=3, strides=2, activation="relu"),
        L.GRU(10),
        L.Dense(1),
    ])
    out["l4-cnngru"] = cnn_gru_model.count_params()
    return out


for mid, n in verbatim().items():
    page = truth["models"].get(mid)
    want = page["trainable"] + page["nonTrainable"] if page else None
    truth["verbatim"][mid] = n
    if n != want:
        fail(f"verbatim {mid}: the slide's own code gives {n}, the page's spec {want}")
print(f"verbatim listings: {len(truth['verbatim'])} built from the slides' code")

# ── output-size sweep ────────────────────────────────────────────────────────
n_bad = 0
for pt in SPECS["sweep"]:
    n, k, s, pad = pt["n"], pt["k"], pt["s"], pt["pad"]
    x1 = tf.zeros((1, n, 1))
    x2 = tf.zeros((1, n, n, 1))
    c1 = int(L.Conv1D(1, k, strides=s, padding=pad)(x1).shape[1])
    c2 = L.Conv2D(1, k, strides=s, padding=pad)(x2).shape
    pl = L.MaxPool2D(pool_size=k, strides=s, padding=pad)(x2).shape
    ct = L.Conv2DTranspose(1, k, strides=s, padding=pad)(x2).shape
    got = {"conv1d": c1, "conv2d": [int(c2[1]), int(c2[2])], "pool": [int(pl[1]), int(pl[2])], "convT": [int(ct[1]), int(ct[2])]}
    truth["sweep"].append({"n": n, "k": k, "s": s, "pad": pad, **got})
    bad = []
    if c1 != pt["conv"] or got["conv2d"] != [pt["conv"]] * 2:
        bad.append(f"conv {c1}/{got['conv2d']} vs page {pt['conv']}")
    if got["pool"] != [pt["pool"]] * 2:
        bad.append(f"pool {got['pool']} vs page {pt['pool']}")
    if got["convT"] != [pt["convT"]] * 2:
        bad.append(f"convT {got['convT']} vs page {pt['convT']}")
    if bad:
        n_bad += 1
        if n_bad <= 20:
            fail(f"sweep n={n} k={k} s={s} {pad}: " + "; ".join(bad))
print(f"sweep: {len(SPECS['sweep']) - n_bad}/{len(SPECS['sweep'])} sizes agree (Conv1D, Conv2D, MaxPool2D, Conv2DTranspose)")

# ── softmax ──────────────────────────────────────────────────────────────────
for v in SPECS["softmax"]:
    p = tf.nn.softmax(tf.constant(v["z"], dtype=tf.float64)).numpy()
    err = float(np.max(np.abs(p - np.array(v["p"]))))
    truth["softmax"].append({"z": v["z"], "p": p.tolist(), "err": err})
    if err > 1e-9:
        fail(f"softmax {v['z']}: max error {err}")
z = tf.constant([2.0, 1.0, 0.1], dtype=tf.float64)
shift = float(np.max(np.abs(tf.nn.softmax(z).numpy() - tf.nn.softmax(z + 100.0).numpy())))
truth["shiftInvariance"] = shift
if shift > 1e-12:
    fail(f"softmax shift invariance: {shift}")
print(f"softmax: {len(SPECS['softmax'])} vectors against tf.nn.softmax; shift invariance error {shift:.1e}")

# ── sigmoid ──────────────────────────────────────────────────────────────────
truth["sigmoid"] = []
for v in SPECS.get("sigmoid", []):
    p = float(tf.math.sigmoid(tf.constant(v["z"], dtype=tf.float64)).numpy())
    err = abs(p - v["p"])
    truth["sigmoid"].append({"z": v["z"], "p": p, "err": err})
    if err > 1e-9:
        fail(f"sigmoid {v['z']}: error {err}")
print(f"sigmoid: {len(truth['sigmoid'])} scores against tf.math.sigmoid")

# ── drill questions' own checks ──────────────────────────────────────────────
for c in SPECS["checks"]:
    if c["kind"] == "softmax":
        p = tf.nn.softmax(tf.constant(c["z"], dtype=tf.float64)).numpy()
        err = float(np.max(np.abs(p - np.array(c["p"]))))
        ok = err < 1e-9
    elif c["kind"] == "size":
        n, k, s, pad = c["n"], c["k"], c.get("s", 1), c.get("pad", "valid")
        layer = {
            "conv1d": lambda: int(L.Conv1D(1, k, strides=s, padding=pad)(tf.zeros((1, n, 1))).shape[1]),
            "conv2d": lambda: int(L.Conv2D(1, k, strides=s, padding=pad)(tf.zeros((1, n, n, 1))).shape[1]),
            "pool": lambda: int(L.MaxPool2D(pool_size=k, strides=c.get("s"), padding=pad)(tf.zeros((1, n, n, 1))).shape[1]),
            "convT": lambda: int(L.Conv2DTranspose(1, k, strides=s, padding=pad)(tf.zeros((1, n, n, 1))).shape[1]),
        }[c["layer"]]
        got = layer()
        ok = got == c["out"]
        c = {**c, "keras": got}
    else:
        ok = False
    truth["checks"].append({**c, "ok": ok})
    if not ok:
        fail(f"check {c['id']} ({c['kind']}): {c}")
print(f"drill checks: {sum(1 for c in truth['checks'] if c['ok'])}/{len(SPECS['checks'])}")

truth["fails"] = FAILS
json.dump(truth, open(os.path.join(HERE, "keras-truth.json"), "w", encoding="utf-8"))
print(f"\n{'ALL OK' if not FAILS else f'{len(FAILS)} FAILURE(S)'} · wrote keras-truth.json")
sys.exit(1 if FAILS else 0)
