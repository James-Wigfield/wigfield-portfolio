"""
DL LECTURE 8 STUDY - bus/rail bidirectional RNN and RNN encoder-decoder
-------------------------------------------------------------------------------
Usage (each model is its own process so it fits inside a 10-minute tool call;
results go to a cache folder, --export formats them):

  python -I tools/dl-lecture8-study/busrail.py --cache <dir> --gate-only
  python -I tools/dl-lecture8-study/busrail.py --cache <dir> --model birnn|rnn_ed
  python -I tools/dl-lecture8-study/busrail.py --cache <dir> --export \
         --out src/components/portal/modules/deep-learning/lecture8-study/data [--date YYYY-MM-DD]

    --ridership  Lecture 4's data file (default: lecture4-study/data/ridership.js):
                 CTA daily boardings 2016-01-01..2019-05-31, raw integers, one
                 entry per consecutive day. Parsed here with a regex; nothing else
                 from Lecture 4 is reused.
    --cache      folder for per-model results (<model>.json / .npz / .weights.h5)
    --gate-only  build the windows and both models, print the counts, train nothing
    --model      train one model and cache it
    --export     write busrail.js from the cache

Device: whatever TensorFlow sees; the published run used CUDA_VISIBLE_DEVICES=-1
(CPU), which is as fast as the GPU for these tiny RNNs and removes the GPU JIT noise.

Reproduces CITS5017 Lecture 8 slides 9-17 with the slides' code as written
(transcribed from the slide images):
  slide 9     simple_biRNN = Sequential([InputLayer(input_shape=[None, 2]),
              Bidirectional(SimpleRNN(16)), Dense(2)]); EarlyStopping(monitor=
              "val_loss", patience=50, restore_best_weights=True); SGD(learning_rate=
              0.02, momentum=0.9); compile(loss="mse", optimizer=opt, metrics=["mae"]);
              fit(..., epochs=500, verbose=0, callbacks=[logging_cb, early_stopping_cb])
  slide 10    yvalid_pred = simple_biRNN.predict(X_valid, verbose=0);
              np.mean(np.abs(yvalid_pred - y_valid)) * 1e6
  slide 11    forecast 1..14 days ahead by feeding predictions back in (the slide
              shows only the plot; the loop is Lecture 4 slide 34's, run over the
              whole validation set as slide 11's footnote says it must be)
  slides 14-15 rnn_ed (Bidirectional(SimpleRNN(16, return_state=True)) encoder,
              Concatenate(axis=-1) of the two states, SimpleRNN(32,
              return_sequences=True) decoder with initial_state, Dense(2)),
              compile(loss="mse", optimizer="nadam", metrics=["mae"]),
              fit((X_train, X_train_decode), y_train, epochs=500, validation_data=
              ((X_valid, X_valid_decode), y_valid), verbose=0, callbacks=[...])
  slide 17    predict(model, encoder_inputs, decoder_input, outseq_len, **kwargs):
              the slide elides the loop body ("# call model.predict(...) and
              update decoder_ins and outseq"); the body here is this page's own.
Keras defaults apply wherever the slides say nothing (batch_size=32, shuffle=True,
Glorot-uniform / orthogonal init, Nadam defaults).

Data (Lecture 4 slides 20, 30, 35-36 and Lecture 8 slides 9, 12-13):
  series = (bus, rail) / 1e6 as float32; train = 2016-01..2018-12 (1,096 days),
  valid = 2019-01..2019-05 (151 days). Every 70-day window inside each split, in
  date order (what timeseries_dataset_from_array(sequence_length=56 + 14) yields,
  unshuffled): train 1,027, valid 82.
  simple_biRNN: X = days 0-55 (56 days), y_1 = day 56 (the 57th day).
  rnn_ed:       X = days 0-54 (55 days, encoder), X_decode = days 55-68 (day 55 +
                the targets shifted one step), y = days 56-69 (14 days).

Page's own (not on the slides; every item is also in the export header):
  - PrintEpochLossCallback(20, Nepochs): slide 9 uses it but never defines it. Here it
    prints epoch 0 and every 20th epoch in the slide's format; Nepochs = 500.
  - slide 9's fit uses y_train / y_valid_1 and its comment names y_train_1; slide 10
    compares with y_valid. Only the one-day targets fit a Dense(2) output, so this
    script uses y_train_1 (1027, 2) and y_valid_1 (82, 2) for all of them.
  - out_seq_length = 14 (slide 17 passes it but never defines it).
  - the slide-11 loop runs over all 82 validation windows at once.
  - teacher-forced validation MAE: rnn_ed.predict((X_valid, X_valid_decode)), i.e. the
    true previous day fed to the decoder (the training set-up, slide 12).

Gates (a mismatch exits 1 before training and nothing is cached):
  1,027 training windows (slide 9: X_train.shape = (1027,56,2)) and
  simple_biRNN.count_params() == 674 (slide 9: 2 x (16*(16+2) + 16) + (32*2 + 2)).

Seeds: tf.keras.utils.set_random_seed(42) immediately before each model is built,
plus tf.config.experimental.enable_op_determinism().

Nothing in here is the slides' figures: every number this writes comes from this
script's own training run.
"""
import argparse
import datetime as dt
import json
import os
import platform
import re
import sys
import time
import warnings
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

SEED = 42
SEQ_LEN = 56
AHEAD = 14
WINDOW = SEQ_LEN + AHEAD
NEPOCHS = 500
EXPECT_TRAIN_WINDOWS = 1027
EXPECT_BIRNN_PARAMS = 674
WINDOW_PICKS = [0, 27, 54, 81]       # validation window indices shown on the page
SCRIPT_PATH = "tools/dl-lecture8-study/busrail.py"
DEFAULT_RIDERSHIP = "src/components/portal/modules/deep-learning/lecture4-study/data/ridership.js"
CURVE_POINTS = 80

CAUGHT = []
_show = warnings.showwarning


def _record_warning(message, category, filename, lineno, file=None, line=None):
    CAUGHT.append(f"{category.__name__}: {message}")
    _show(message, category, filename, lineno, file, line)


warnings.showwarning = _record_warning


# ---------------------------------------------------------------- data -----
def parse_ridership(path):
    text = Path(path).read_text(encoding="utf-8")
    start = re.search(r"start:\s*'(\d{4}-\d{2}-\d{2})'", text).group(1)
    length = int(re.search(r"length:\s*(\d+)", text).group(1))

    def arr(name):
        m = re.search(name + r":\s*\[([^\]]*)\]", text)
        return np.array([int(v) for v in re.findall(r"-?\d+", m.group(1))], dtype=np.int64)

    bus, rail = arr("bus"), arr("rail")
    if not (len(bus) == len(rail) == length):
        sys.exit(f"ridership arrays: bus {len(bus)}, rail {len(rail)}, length {length}")
    d0 = dt.date.fromisoformat(start)
    dates = [d0 + dt.timedelta(days=i) for i in range(length)]
    return dates, np.stack([bus, rail], axis=-1)


def windows(series, length):
    return np.stack([series[i:i + length] for i in range(len(series) - length + 1)])


def load_data(path):
    dates, raw = parse_ridership(path)
    n_train = sum(1 for d in dates if d <= dt.date(2018, 12, 31))
    n_valid = sum(1 for d in dates if dt.date(2019, 1, 1) <= d <= dt.date(2019, 5, 31))
    if dates[0] != dt.date(2016, 1, 1) or dates[n_train] != dt.date(2019, 1, 1):
        sys.exit("unexpected date range")
    series = (raw / 1e6).astype(np.float32)          # df[["bus","rail"]] / 1e6
    train, valid = series[:n_train], series[n_train:n_train + n_valid]
    W_train, W_valid = windows(train, WINDOW), windows(valid, WINDOW)
    raw_valid = raw[n_train:n_train + n_valid]
    D = dict(dates=dates, n_train=n_train, n_valid=n_valid, W_train=W_train, W_valid=W_valid,
             RW_valid=windows(raw_valid, WINDOW), valid_dates=dates[n_train:n_train + n_valid])
    # simple_biRNN arrays (slide 9)
    D["X_train"], D["y_train_1"] = W_train[:, :SEQ_LEN], W_train[:, SEQ_LEN]
    D["X_valid"], D["y_valid_1"] = W_valid[:, :SEQ_LEN], W_valid[:, SEQ_LEN]
    # rnn_ed arrays (slides 12-15): encoder days 0-54, decoder days 55-68, targets 56-69
    D["X_train_enc"], D["X_train_decode"], D["y_train"] = (
        W_train[:, :SEQ_LEN - 1], W_train[:, SEQ_LEN - 1:WINDOW - 1], W_train[:, SEQ_LEN:])
    D["X_valid_enc"], D["X_valid_decode"], D["y_valid"] = (
        W_valid[:, :SEQ_LEN - 1], W_valid[:, SEQ_LEN - 1:WINDOW - 1], W_valid[:, SEQ_LEN:])
    print(f"days: train {n_train} ({dates[0]}..{dates[n_train - 1]}), valid {n_valid} "
          f"({dates[n_train]}..{dates[n_train + n_valid - 1]})")
    print(f"70-day windows: train {len(W_train)}, valid {len(W_valid)}")
    for k in ("X_train", "y_train_1", "X_valid", "y_valid_1", "X_train_enc", "X_train_decode",
              "y_train", "X_valid_enc", "X_valid_decode", "y_valid"):
        print(f"  {k:<15} {D[k].shape}")
    return D


# -------------------------------------------------------------- models -----
class PrintEpochLossCallback(tf.keras.callbacks.Callback):
    """This page's own version: slide 9 uses PrintEpochLossCallback(20, Nepochs) but
    never defines it. Prints epoch 0, every 20th epoch and the last epoch in the
    format of the slides' printed logs."""

    def __init__(self, every, nepochs):
        super().__init__()
        self.every, self.nepochs = every, nepochs
        self.lines = []

    def on_epoch_end(self, epoch, logs=None):
        logs = logs or {}
        if epoch % self.every == 0 or epoch == self.nepochs - 1:
            line = (f"Epoch {epoch:3d}: loss: {logs['loss']:.4f}, mae: {logs['mae']:.4f}; "
                    f"val_loss: {logs['val_loss']:.4f}, val_mae: {logs['val_mae']:.4f}")
            self.lines.append(line)
            print(line, flush=True)


INPUT_NOTE = {}


def build_birnn():
    # Slide 9, verbatim (InputLayer(input_shape=...) is deprecated in Keras 3 but accepted)
    with warnings.catch_warnings(record=True) as caught:
        warnings.simplefilter("always")
        simple_biRNN = tf.keras.Sequential([
            tf.keras.layers.InputLayer(input_shape=[None, 2]),
            tf.keras.layers.Bidirectional(
                tf.keras.layers.SimpleRNN(16)),
            tf.keras.layers.Dense(2)
        ])                                    # 674 trainable params
    INPUT_NOTE["birnn"] = sorted({f"{w.category.__name__}: {w.message}" for w in caught})
    for w in INPUT_NOTE["birnn"]:
        print("  build warning:", w)
    return simple_biRNN


def build_rnn_ed():
    # Slide 14, verbatim
    inputs_dim = 2   # bus and rail
    # the encoder takes in (bus,rail) sequences (55 days)
    encoder_inputs = tf.keras.Input(shape=[None, inputs_dim])
    encoder = tf.keras.layers.Bidirectional(
        tf.keras.layers.SimpleRNN(16, return_state=True))
    encoder_outputs, *encoder_state = encoder(encoder_inputs)

    # encoder_state is a list containing 2 elements: the forward
    # state and the backward state. We need to pass them to the decoder.
    encoder_state = tf.keras.layers.Concatenate(axis=-1)(encoder_state)
    # encoder_state is now a Keras tensor of shape (None,32)

    # the decoder learns to predict (bus,rail) sequences (14 days
    # after the input 56 days)
    decoder_inputs = tf.keras.layers.Input(shape=[None, 2])

    # Note: the #neurons for the decoder must match the shape of encoder_state
    decoder = tf.keras.layers.SimpleRNN(32, return_sequences=True)
    decoder_outputs = decoder(decoder_inputs, initial_state=encoder_state)

    outputs = tf.keras.layers.Dense(2)(decoder_outputs)

    rnn_ed = tf.keras.Model(inputs=[encoder_inputs, decoder_inputs],
                            outputs=outputs)
    return rnn_ed, int(encoder_state.shape[-1])


# Slide 17; the loop body is this page's own (the slide shows only its comment).
def predict(model, encoder_inputs, decoder_input, outseq_len, **kwargs):
    # encoder_inputs could be X_val or X_test over 55 days (0 to 54).
    # decoder_input is X_val for 1 day only (day 55).
    # outseq_len is the required length of the output sequences (14 here).
    batch_size = encoder_inputs.shape[0]
    out_dim = decoder_input.shape[-1]

    # the output sequence to be predicted
    outseq = np.zeros((batch_size, outseq_len, out_dim))
    # construct the inputs for the decoder
    decoder_ins = np.zeros((batch_size, outseq_len, out_dim))
    decoder_ins[:, 0, :] = decoder_input
    for t in range(outseq_len):
        # call model.predict(...) and update decoder_ins and outseq
        y = model.predict((encoder_inputs, decoder_ins.astype(np.float32)), **kwargs)  # page's own
        outseq[:, t, :] = y[:, t, :]                                                   # page's own
        if t + 1 < outseq_len:                                                         # page's own
            decoder_ins[:, t + 1, :] = y[:, t, :]                                      # page's own
    return outseq


# ------------------------------------------------------------- helpers -----
def device_label():
    gpus = tf.config.list_physical_devices("GPU")
    if gpus:
        d = tf.config.experimental.get_device_details(gpus[0])
        return f"GPU: {d.get('device_name', 'GPU')}"
    return "CPU"


def versions():
    import keras
    try:
        osr = platform.freedesktop_os_release().get("PRETTY_NAME", "")
    except OSError:
        osr = ""
    wsl = ", WSL2" if "microsoft" in platform.release() else ""
    return dict(python=platform.python_version(), tf=tf.__version__, keras=keras.__version__,
                numpy=np.__version__, os=f"{platform.system()} ({osr}{wsl})")


def birnn_param_formula():
    return 2 * (16 * (16 + 2) + 16) + (32 * 2 + 2)


def gate(D, simple_biRNN):
    ok_w = len(D["X_train"]) == EXPECT_TRAIN_WINDOWS
    print(f"GATE training windows: {len(D['X_train'])} (slide 9: 1027) -> {'PASS' if ok_w else 'FAIL'}")
    n = simple_biRNN.count_params()
    f = birnn_param_formula()
    ok_p = n == EXPECT_BIRNN_PARAMS == f
    print(f"GATE simple_biRNN.count_params() = {n} (slide 9: 674; 2*(16*(16+2)+16)+(32*2+2) = {f}) "
          f"-> {'PASS' if ok_p else 'FAIL'}")
    if not (ok_w and ok_p):
        sys.exit("gate failed; nothing trained or cached")


def mae_1e6(a, b):
    return float(np.mean(np.abs(np.asarray(a, np.float64) - np.asarray(b, np.float64))) * 1e6)


def horizon_mae(pred, truth):
    # per horizon h = 1..14: mean over windows and over (bus, rail), x 1e6
    return [mae_1e6(pred[:, h], truth[:, h]) for h in range(pred.shape[1])]


def save_cache(cache, name, meta, arrays):
    cache.mkdir(parents=True, exist_ok=True)
    meta["warnings"] = sorted(set(CAUGHT))
    (cache / f"{name}.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    np.savez_compressed(cache / f"{name}.npz", **arrays)
    print(f"cached {cache / (name + '.json')}")


def history_meta(history, es):
    h = {k: [float(v) for v in vals] for k, vals in history.history.items()}
    val = np.array(h["val_loss"])
    best = int(np.argmin(val))
    return dict(history=h, epochsRun=len(h["loss"]), bestEpoch=best,
                stoppedEarly=bool(es.stopped_epoch > 0), stoppedEpoch=int(es.stopped_epoch),
                bestValLoss=float(val[best]), bestValMae=float(h["val_mae"][best]))


# --------------------------------------------------------------- steps -----
def run_birnn(D, cache):
    tf.keras.utils.set_random_seed(SEED)
    simple_biRNN = build_birnn()
    gate(D, simple_biRNN)
    X_train, y_train_1 = D["X_train"], D["y_train_1"]
    X_valid, y_valid_1 = D["X_valid"], D["y_valid_1"]
    Nepochs = NEPOCHS
    t0 = time.time()
    # Slide 9, verbatim except y_train -> y_train_1 (see docstring)
    early_stopping_cb = tf.keras.callbacks.EarlyStopping(
        monitor="val_loss", patience=50, restore_best_weights=True)

    # PrintEpochLossCallback -- A customized Callback class to help reduce
    # the verbose printing of training loss, MAE, etc.
    logging_cb = PrintEpochLossCallback(20, Nepochs)
    opt = tf.keras.optimizers.SGD(learning_rate=0.02, momentum=0.9)
    simple_biRNN.compile(loss="mse", optimizer=opt, metrics=["mae"])

    # X_train.shape = (1027,56,2), y_train_1.shape = (1027,2)
    history = simple_biRNN.fit(X_train, y_train_1, epochs=Nepochs,
                               validation_data=(X_valid, y_valid_1),
                               verbose=0, callbacks=[logging_cb, early_stopping_cb])
    wall = time.time() - t0
    hm = history_meta(history, early_stopping_cb)
    print(f"epochs run {hm['epochsRun']}, best epoch (0-based) {hm['bestEpoch']}, "
          f"stopped early {hm['stoppedEarly']}, wall {wall:.1f}s")

    # Slide 10
    yvalid_pred = simple_biRNN.predict(X_valid, verbose=0)
    val_mae = mae_1e6(yvalid_pred, y_valid_1)
    print(f">>> print(np.mean(np.abs(yvalid_pred - y_valid)) * 1e6)\n{val_mae}")

    # Slide 11: feed predictions back in, whole validation set
    X = X_valid.copy()
    preds = []
    for step_ahead in range(AHEAD):
        y_pred_one = simple_biRNN.predict(X, verbose=0)
        preds.append(y_pred_one)
        X = np.concatenate([X, y_pred_one[:, np.newaxis, :]], axis=1)
    pred14 = np.stack(preds, axis=1)              # (82, 14, 2)
    hmae = horizon_mae(pred14, D["y_valid"])
    print("horizon MAE x1e6:", ", ".join(f"h{h + 1} {v:,.0f}" for h, v in enumerate(hmae)))
    print(f"mean over the 14 horizons {np.mean(hmae):,.1f}")

    meta = dict(model="birnn", device=device_label(), versions=versions(), wallSeconds=wall,
                params=int(simple_biRNN.count_params()), valMAE=val_mae, horizonMAE=hmae,
                mean14=float(np.mean(hmae)), logLines=logging_cb.lines,
                buildWarnings=INPUT_NOTE.get("birnn", []), **hm)
    save_cache(cache, "birnn", meta, dict(pred1=yvalid_pred, pred14=pred14))
    simple_biRNN.save_weights(cache / "birnn.weights.h5")


def run_rnn_ed(D, cache):
    tf.keras.utils.set_random_seed(SEED)
    rnn_ed, state_dim = build_rnn_ed()
    n = rnn_ed.count_params()
    print(f"rnn_ed.count_params() = {n}  (encoder_state width {state_dim})")
    rnn_ed.summary()
    # slides' names for this model: X_train / X_valid = 55 encoder days
    X_train, X_train_decode, y_train = D["X_train_enc"], D["X_train_decode"], D["y_train"]
    X_valid, X_valid_decode, y_valid = D["X_valid_enc"], D["X_valid_decode"], D["y_valid"]
    Nepochs = NEPOCHS
    t0 = time.time()
    # Slide 15, verbatim
    early_stopping_cb = tf.keras.callbacks.EarlyStopping(
        monitor='val_loss', patience=50, restore_best_weights=True)

    logging_cb = PrintEpochLossCallback(20, Nepochs)

    rnn_ed.compile(loss="mse", optimizer="nadam", metrics=["mae"])
    history = rnn_ed.fit((X_train, X_train_decode), y_train, epochs=500,
                         validation_data=((X_valid, X_valid_decode), y_valid),
                         verbose=0, callbacks=[logging_cb, early_stopping_cb])
    wall = time.time() - t0
    hm = history_meta(history, early_stopping_cb)
    print(f"epochs run {hm['epochsRun']}, best epoch (0-based) {hm['bestEpoch']}, "
          f"stopped early {hm['stoppedEarly']}, wall {wall:.1f}s")

    # Slide 17
    out_seq_length = AHEAD   # page's own: the slide passes it but never defines it
    yvalid_pred = predict(rnn_ed, X_valid, X_valid_decode[:, 0],
                          out_seq_length, verbose=0)
    print(r'Validation set MAE = {:11,.4f}'.format(
        np.mean(np.abs(yvalid_pred - y_valid)) * 1e6))
    val_mae = mae_1e6(yvalid_pred, y_valid)
    hmae = horizon_mae(yvalid_pred, y_valid)
    print("horizon MAE x1e6:", ", ".join(f"h{h + 1} {v:,.0f}" for h, v in enumerate(hmae)))

    # Page's own: teacher forcing (true previous day fed to the decoder)
    tf_pred = rnn_ed.predict((X_valid, X_valid_decode), verbose=0)
    val_mae_tf = mae_1e6(tf_pred, y_valid)
    print(f"teacher-forced validation MAE x1e6 = {val_mae_tf:,.4f}")

    meta = dict(model="rnn_ed", device=device_label(), versions=versions(), wallSeconds=wall,
                params=int(n), valMAE=val_mae, valMAETeacherForced=val_mae_tf, horizonMAE=hmae,
                horizonMAETeacherForced=horizon_mae(tf_pred, y_valid),
                logLines=logging_cb.lines, **hm)
    save_cache(cache, "rnn_ed", meta, dict(pred14=yvalid_pred, pred_tf=tf_pred))
    rnn_ed.save_weights(cache / "rnn_ed.weights.h5")


def run_gate_only(D):
    tf.keras.utils.set_random_seed(SEED)
    simple_biRNN = build_birnn()
    simple_biRNN.summary()
    gate(D, simple_biRNN)
    tf.keras.utils.set_random_seed(SEED)
    rnn_ed, _ = build_rnn_ed()
    print(f"rnn_ed.count_params() = {rnn_ed.count_params()}")
    print("device:", device_label(), "|", versions())


# -------------------------------------------------------------- export -----
def sig(v, n=4):
    return float(f"{float(v):.{n}g}")


def js_list(values, n=None):
    if n is None:
        return "[" + ",".join(str(int(round(v))) for v in values) + "]"
    return "[" + ",".join(repr(sig(v, n)) for v in values) + "]"


def js_pairs(arr):
    return "[" + ",".join(f"[{int(a)},{int(b)}]" for a, b in arr) + "]"


def curve_index(n, best, k=CURVE_POINTS):
    if n <= k:
        return list(range(n))
    idx = set(np.unique(np.round(np.linspace(0, n - 1, k - 1)).astype(int)).tolist())
    idx.add(best)
    return sorted(idx)


def curves_block(meta, indent="    "):
    h = meta["history"]
    idx = curve_index(meta["epochsRun"], meta["bestEpoch"])
    lines = [f"{indent}epoch: {js_list(idx)},"]
    for k in ("loss", "mae", "val_loss", "val_mae"):
        lines.append(f"{indent}{k}: {js_list([h[k][i] for i in idx], 4)},")
    return "{\n" + "\n".join(lines) + "\n  " + "}"


def window_block(D, i, pred14, with_input):
    start = D["valid_dates"][i]
    raw = D["RW_valid"][i]
    pred = np.rint(np.asarray(pred14[i], np.float64) * 1e6)
    fields = [f"start: '{start.isoformat()}'", f"index: {i}"]
    if with_input:
        fields.append(f"input: {js_pairs(raw[:SEQ_LEN])}")
    fields += [f"truth: {js_pairs(raw[SEQ_LEN:])}", f"pred: {js_pairs(pred)}",
               f"mae: {round(mae_1e6(pred14[i], D['W_valid'][i, SEQ_LEN:]))}"]
    return "    { " + ",\n      ".join(fields) + " },\n"


def export(D, cache, out_dir, date):
    b = json.loads((cache / "birnn.json").read_text())
    e = json.loads((cache / "rnn_ed.json").read_text())
    bz, ez = np.load(cache / "birnn.npz"), np.load(cache / "rnn_ed.npz")
    v = b["versions"]
    vd = D["valid_dates"]

    def early(m):
        if m["stoppedEarly"]:
            return (f"early stopping fired after epoch {m['stoppedEpoch']} (0-based); weights "
                    f"restored to epoch {m['bestEpoch']}")
        return f"ran all {m['epochsRun']} epochs; EarlyStopping did not fire (final weights kept)"

    def line_wrap(txt, width=86, lead="  "):
        out, cur = [], ""
        for word in txt.split(" "):
            if len(cur) + len(word) + 1 > width:
                out.append(cur)
                cur = lead + word
            else:
                cur = (cur + " " + word) if cur else word
        out.append(cur)
        return out

    win_txt = ", ".join(f"{i} (start {vd[i]}, forecasts {vd[i + SEQ_LEN]}..{vd[i + WINDOW - 1]})"
                        for i in WINDOW_PICKS)
    head = [
        "CTA bus/rail forecasts for CITS5017 Lecture 8 slides 9-17.",
        "This page's own run, not the slides' numbers.",
        "",
        "Source: CTA daily boarding totals (Geron's ridership.tgz), copied from Lecture 4's",
        "  lecture4-study/data/ridership.js (raw integer boardings 2016-01-01..2019-05-31).",
        f"Generated by {SCRIPT_PATH} on {date}. Do not edit by hand: re-run the script.",
        f"Device: {b['device']} (rnn_ed: {e['device']}); TensorFlow {v['tf']}, Keras {v['keras']},",
        f"  NumPy {v['numpy']}, Python {v['python']}, {v['os']}.",
        f"Seeds: tf.keras.utils.set_random_seed({SEED}) before each model is built; op determinism on.",
        "",
        "Data: (bus, rail) / 1e6; train = 2016-01..2018-12 (1,096 days), valid = 2019-01..2019-05",
        f"  (151 days); every 70-day window inside each split: train {len(D['W_train'])}, "
        f"valid {len(D['W_valid'])}.",
        "  simple_biRNN: inputs days 0-55, target day 56 (the 57th). rnn_ed: encoder days 0-54,",
        "  decoder inputs days 55-68, targets days 56-69.",
        "",
        "BIRNN = slide 9's simple_biRNN, verbatim: InputLayer(input_shape=[None, 2]) (Keras",
        "  3 accepts it with \"UserWarning: Argument `input_shape` is deprecated. Use `shape`",
        "  instead.\"), Bidirectional(SimpleRNN(16)), Dense(2); SGD(0.02, momentum 0.9), mse,",
        "  mae, epochs=500, EarlyStopping(val_loss, patience=50, restore_best_weights=True).",
        "  Page's own: PrintEpochLossCallback (undefined on the slides). Slide 9 names",
        "  y_train_1 / y_train / y_valid_1 and slide 10 y_valid; this run used the one-day",
        "  targets y_train_1 (1027, 2) and y_valid_1 (82, 2) throughout.",
        f"  {early(b)}; {b['wallSeconds']:.0f} s.",
        "  valMAE = np.mean(np.abs(yvalid_pred - y_valid_1)) * 1e6 (slide 10; the slides print",
        "  27936.60823591162). horizonMAE[h-1] = MAE x 1e6 of the h-day-ahead forecast",
        "  made by feeding predictions back in (slide 11), mean over all 82 windows, bus and rail,",
        "  rounded to whole boardings (as are valMAE to 2 dp and window mae to integers).",
        "RNN_ED = slides 14-15's rnn_ed, verbatim (nadam, mse, mae, epochs=500, same early",
        f"  stopping); {early(e)}; {e['wallSeconds']:.0f} s.",
        "  valMAE = slide 17's predict() loop (body page's own: 14 model.predict calls, decoder",
        "  inputs zeros except day 55, each prediction fed in as the next input) then",
        "  np.mean(np.abs(yvalid_pred - y_valid)) * 1e6 (the slides print 34,863.8857).",
        "  valMAETeacherForced = rnn_ed.predict((X_valid, X_valid_decode)): the true",
        "  previous day fed to the decoder, as in training (page's own).",
        "curves: Keras's history per epoch (0-based, as the slides' logs print), at most",
        f"  {CURVE_POINTS} epochs kept (evenly spaced, plus the best), 4 significant figures.",
        "  loss/mae are in the /1e6 units the model trained on.",
    ] + line_wrap("windows: the same four validation windows for both models, indices "
                  + win_txt + ".") + [
        "  input/truth = raw boardings [bus, rail] per day; pred = model output x 1e6 rounded;",
        "  mae = that window's MAE x 1e6 over 14 days and both series.",
    ]
    hdr = "".join(f"// {ln}\n" if ln else "//\n" for ln in head)

    def model_block(name, m, z, extra, with_input):
        rows = [f"  params: {m['params']},", f"  epochsRun: {m['epochsRun']},",
                f"  bestEpoch: {m['bestEpoch']},", f"  stoppedEarly: {str(m['stoppedEarly']).lower()},",
                f"  wallSeconds: {round(m['wallSeconds'])},",
                f"  valMAE: {round(m['valMAE'], 2)},"] + extra + [
                f"  horizonMAE: {js_list(m['horizonMAE'])},",
                f"  curves: {curves_block(m)},",
                "  windows: [\n" + "".join(window_block(D, i, z["pred14"], with_input)
                                          for i in WINDOW_PICKS) + "  ],"]
        return f"export const {name} = {{\n" + "\n".join(rows) + "\n}\n"

    run = (f"export const RUN = {{ date: '{date}', device: '{b['device']}', tf: '{v['tf']}', "
           f"keras: '{v['keras']}', trainWindows: {len(D['W_train'])}, validWindows: {len(D['W_valid'])}, "
           f"seqLength: {SEQ_LEN}, ahead: {AHEAD}, validStart: '{vd[0]}' }}\n")
    body = (hdr + "\n" + run + "\n"
            + model_block("BIRNN", b, bz, [f"  logLines: {json.dumps(b['logLines'])},"], True) + "\n"
            + model_block("RNN_ED", e, ez,
                          [f"  valMAETeacherForced: {round(e['valMAETeacherForced'], 2)},",
                           f"  horizonMAETeacherForced: {js_list(e['horizonMAETeacherForced'])},",
                           f"  logLines: {json.dumps(e['logLines'])},"], False))
    out = Path(out_dir) / "busrail.js"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(body, encoding="utf-8", newline="\n")
    print(f"wrote {out} ({out.stat().st_size:,} bytes)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ridership", default=DEFAULT_RIDERSHIP)
    ap.add_argument("--cache", required=True)
    ap.add_argument("--gate-only", action="store_true")
    ap.add_argument("--model", choices=["birnn", "rnn_ed"])
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--out")
    ap.add_argument("--date", default=dt.date.today().isoformat())
    args = ap.parse_args()
    cache = Path(args.cache)
    cache.mkdir(parents=True, exist_ok=True)
    D = load_data(args.ridership)
    if args.gate_only:
        run_gate_only(D)
        return
    if args.export:
        export(D, cache, args.out, args.date)
        return
    tf.config.experimental.enable_op_determinism()
    if args.model == "birnn":
        run_birnn(D, cache)
    elif args.model == "rnn_ed":
        run_rnn_ed(D, cache)
    else:
        ap.error("pick --gate-only, --model or --export")


if __name__ == "__main__":
    main()
