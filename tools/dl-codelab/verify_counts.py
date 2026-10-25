"""
DL CODE LAB — verify every count, shape and lab reconstruction in TensorFlow
-----------------------------------------------------------------------------
Reads tools/dl-codelab/specs.json (written by export-specs.mjs from the page's
own codelab/specs.js + counts.js), builds every layer spec in Keras, and
asserts each layer's output shape and its trainable / non-trainable parameter
counts against what counts.js computed. Then it runs every lab card's
reconstructed code on random arrays of the lab sheet's shapes, with fit()
cut to one epoch (a smoke run that proves the code runs; no trained result is
claimed). Writes tools/dl-codelab/keras-counts.json, which check-cards.mjs
compares with counts.js again.

Run it in the unit's read-only TensorFlow environment (WSL distro Ubuntu,
conda env tf-2.20-gpu; see cits5017-project-two/documents/ENVIRONMENT_SETUP.md),
on the CPU, from Git Bash. Nothing is installed:

  node tools/dl-codelab/export-specs.mjs
  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "<repo>/tools/dl-codelab" \
    -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
    /home/james/miniconda3/envs/tf-2.20-gpu/bin/python verify_counts.py

Prints one line per check (OK / FAIL) and exits 1 if any check fails.
"""
import json
import sys
import warnings
from pathlib import Path

import numpy as np
import tensorflow as tf

warnings.filterwarnings("ignore")
HERE = Path(__file__).resolve().parent
DATA = json.loads((HERE / "specs.json").read_text(encoding="utf-8"))
FAILS = []
RESULTS = {"versions": {}, "specs": {}, "labs": {}}


def check(label, got, want):
    ok = got == want
    print(f"{'OK  ' if ok else 'FAIL'} {label}: {got}" + ("" if ok else f" (counts.js says {want})"))
    if not ok:
        FAILS.append(label)


def counts(layer):
    tr = int(sum(np.prod(w.shape) for w in layer.trainable_weights))
    nt = int(sum(np.prod(w.shape) for w in layer.non_trainable_weights))
    return tr, nt


L = tf.keras.layers


class Sampling(L.Layer):
    """The slides' VAE sampling layer (L6-7): mean + exp(log_var / 2) * noise."""

    def call(self, inputs):
        mean, log_var = inputs
        return tf.random.normal(tf.shape(log_var)) * tf.exp(log_var / 2) + mean


def make(l):
    t = l["type"]
    act = l.get("act")
    if t == "Dense":
        return L.Dense(l["units"], activation=act, use_bias=l.get("bias", True))
    if t == "Normalization":
        return L.Normalization()
    if t == "BatchNormalization":
        return L.BatchNormalization()
    if t == "LayerNormalization":
        return L.LayerNormalization()
    if t == "Dropout":
        return L.Dropout(l["rate"])
    if t == "GaussianNoise":
        return L.GaussianNoise(l["stddev"])
    if t == "Activation":
        return L.Activation(act)
    if t == "Rescaling":
        return L.Rescaling(l["scale"], offset=l.get("offset", 0.0))
    if t == "LeakyReLU":
        return L.LeakyReLU()
    if t == "Flatten":
        return L.Flatten()
    if t == "Concatenate":
        return L.Concatenate()
    if t == "Add":
        return L.Add()
    if t == "Reshape":
        return L.Reshape(l["target"])
    if t in ("Conv2D", "Conv2DTranspose"):
        cls = L.Conv2D if t == "Conv2D" else L.Conv2DTranspose
        return cls(l["filters"], l["kernel"], strides=l.get("strides", 1), padding=l.get("padding", "valid"), activation=act)
    if t == "Conv1D":
        return L.Conv1D(l["filters"], l["kernel"], strides=l.get("strides", 1), padding=l.get("padding", "valid"), activation=act)
    if t == "MaxPool2D":
        return L.MaxPool2D(l.get("pool", 2), strides=l.get("strides"), padding=l.get("padding", "valid"))
    if t == "AvgPool2D":
        return L.AvgPool2D(l.get("pool", 2), strides=l.get("strides"), padding=l.get("padding", "valid"))
    if t == "MaxPool1D":
        return L.MaxPool1D(l.get("pool", 2), strides=l.get("strides"), padding=l.get("padding", "valid"))
    if t == "GlobalAvgPool2D":
        return L.GlobalAvgPool2D()
    if t == "GlobalAvgPool1D":
        return L.GlobalAvgPool1D()
    if t in ("SimpleRNN", "LSTM", "GRU"):
        cls = {"SimpleRNN": L.SimpleRNN, "LSTM": L.LSTM, "GRU": L.GRU}[t]
        kw = {"return_sequences": l.get("returnSeq", False)}
        if act:
            kw["activation"] = act
        return cls(l["units"], **kw)
    if t == "Bidirectional":
        return L.Bidirectional(make(l["layer"]))
    if t == "TimeDistributed":
        return L.TimeDistributed(make(l["layer"]))
    if t == "RepeatVector":
        return L.RepeatVector(l["n"])
    if t == "Embedding":
        return L.Embedding(l["vocab"], l["dim"])
    if t == "MultiHeadAttention":
        return L.MultiHeadAttention(num_heads=l["heads"], key_dim=l["keyDim"])
    if t == "Sampling":
        return Sampling()
    raise ValueError(f"no Keras layer for {t}")


def shape_of(t):
    return [None if d is None else int(d) for d in t.shape[1:]]


def build(spec):
    tensors = {}
    inputs = []
    rows = []
    for inp in spec["inputs"]:
        x = tf.keras.Input(shape=tuple(inp["shape"]))
        tensors[inp["id"]] = x
        inputs.append(x)
        rows.append({"id": inp["id"], "out": shape_of(x), "tr": 0, "nt": 0})
    prev = spec["inputs"][-1]["id"]
    for i, l in enumerate(spec["layers"]):
        lid = l.get("id", f"l{i}")
        frm = l.get("from", prev)
        frm = frm if isinstance(frm, list) else [frm]
        layer = make(l)
        xs = [tensors[f] for f in frm]
        if l["type"] in ("Concatenate", "Add", "Sampling"):
            y = layer(xs)
        elif l["type"] == "MultiHeadAttention":
            y = layer(xs[0], xs[1] if len(xs) > 1 else xs[0])
        else:
            y = layer(xs[0])
        tensors[lid] = y
        tr, nt = counts(layer)
        rows.append({"id": lid, "out": shape_of(y), "tr": tr, "nt": nt})
        prev = lid
    outputs = spec.get("outputs") or [prev]
    model = tf.keras.Model(inputs, [tensors[o] for o in outputs])
    tr, nt = counts(model)
    return rows, tr, nt


print(f"TensorFlow {tf.__version__} · Keras {tf.keras.__version__ if hasattr(tf.keras, '__version__') else '?'} · NumPy {np.__version__}")
RESULTS["versions"] = {"tensorflow": tf.__version__, "keras": getattr(tf.keras, "__version__", "?"), "numpy": np.__version__}

# ── every layer spec ─────────────────────────────────────────────────────────
for spec in DATA["specs"]:
    sid = spec["id"]
    try:
        rows, tr, nt = build(spec)
    except Exception as e:  # noqa: BLE001
        print(f"FAIL {sid}: build failed: {e}")
        FAILS.append(sid)
        continue
    js = {r["id"]: r for r in spec["js"]["rows"]}
    for r in rows:
        j = js.get(r["id"])
        if not j:
            check(f"{sid}.{r['id']} exists in counts.js", False, True)
            continue
        check(f"{sid}.{r['id']} shape", r["out"], j["out"])
        check(f"{sid}.{r['id']} params (trainable, non-trainable)", [r["tr"], r["nt"]], [j["tr"], j["nt"]])
    check(f"{sid} total (trainable, non-trainable)", [tr, nt], [spec["js"]["tr"], spec["js"]["nt"]])
    RESULTS["specs"][sid] = {"rows": rows, "tr": tr, "nt": nt}

# ── lab cards: run the reconstruction on random data of the sheet's shapes ──
rng = np.random.default_rng(0)


def lab4_data(filename):
    X_train = rng.normal(size=(200, 4, 2)).astype("float32")
    y_train = rng.integers(0, 2, size=(200,))
    X_val = rng.normal(size=(60, 4, 2)).astype("float32")
    y_val = rng.integers(0, 2, size=(60,))
    return X_train, y_train, X_val, y_val


HARNESS = {
    # Lab 4: noisy_squares.npy isn't available locally; load_data returns
    # random arrays of the sheet's shapes
    "lab4-clockwise": {"load_data": lab4_data},
    "lab4-next-vertex": {"load_data": lab4_data},
}

_fit = tf.keras.Model.fit


def one_epoch_fit(self, *a, **kw):
    kw["epochs"] = 1
    kw["verbose"] = 0
    RUN["fits"] += 1
    return _fit(self, *a, **kw)


tf.keras.Model.fit = one_epoch_fit
SPEC_BY_ID = {s["id"]: s for s in DATA["specs"]}
for lab in DATA["labs"]:
    RUN = {"fits": 0}
    ns = {"np": np, "tf": tf, **HARNESS.get(lab["id"], {})}
    try:
        exec(compile(lab["code"], lab["id"], "exec"), ns)  # noqa: S102
        model = ns.get("model")
        ok = RUN["fits"] > 0 and model is not None
        print(f"{'OK  ' if ok else 'FAIL'} {lab['id']}: ran, fit() called {RUN['fits']}× for 1 epoch")
        if not ok:
            FAILS.append(lab["id"])
        info = {"fits": RUN["fits"]}
        if model is not None:
            tr, nt = counts(model)
            info.update({"tr": tr, "nt": nt, "out": shape_of(model.outputs[0])})
            if lab.get("spec"):
                js = SPEC_BY_ID[lab["spec"]]["js"]
                check(f"{lab['id']} card code matches spec {lab['spec']} (trainable, non-trainable)", [tr, nt], [js["tr"], js["nt"]])
        RESULTS["labs"][lab["id"]] = info
    except Exception as e:  # noqa: BLE001
        print(f"FAIL {lab['id']}: {type(e).__name__}: {e}")
        FAILS.append(lab["id"])

(HERE / "keras-counts.json").write_text(json.dumps(RESULTS, indent=1) + "\n", encoding="utf-8")
print(f"\nwrote keras-counts.json · {len(RESULTS['specs'])} specs, {len(RESULTS['labs'])} lab runs")
print(f"{len(FAILS)} FAILED: {FAILS}" if FAILS else "ALL OK")
sys.exit(1 if FAILS else 0)
