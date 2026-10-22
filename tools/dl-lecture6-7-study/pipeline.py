"""
DL LECTURE 6-7 STUDY - Fashion MNIST conv AE / denoising AE / VAE / GAN / DCGAN
-------------------------------------------------------------------------------
Usage (every step is its own process, so each model can pick its device and fit
inside a 10-minute tool call; results go to a cache folder, --export formats them):

  python -I tools/dl-lecture6-7-study/pipeline.py --data-dir <dir> --cache <dir> --gate-only
  python -I tools/dl-lecture6-7-study/pipeline.py --data-dir <dir> --cache <dir> \
         --counts tools/dl-lecture6-7-study/keras-counts.json
  python -I tools/dl-lecture6-7-study/pipeline.py --data-dir <dir> --cache <dir> \
         --model conv|dropout|vae|gan|dcgan|trainable-test \
         [--epochs N] [--probe-batches N] [--no-determinism]
  python -I tools/dl-lecture6-7-study/pipeline.py --data-dir <dir> --cache <dir> \
         --export --out src/components/portal/modules/deep-learning/lecture6-7-study/data
         [--date YYYY-MM-DD]

    --data-dir   folder for the Fashion MNIST IDX .gz files; missing files are
                 downloaded from BASE_URL (the files keras.datasets.fashion_mnist
                 .load_data() downloads) and parsed the way that loader parses them
    --cache      folder for per-model results (<model>.json / .npz / .weights.h5)
    --model      train one model (or run the GAN trainable experiment) and cache it
    --epochs     override the slide's epoch count (recorded as "this run: N")
    --probe-batches  GAN/DCGAN only: run N iterations of train_gan, print the
                 seconds per iteration, write nothing (used to plan the time box)
    --no-determinism  skip tf.config.experimental.enable_op_determinism()
    --counts     build every model fresh and write per-layer Keras counts as JSON
    --export     write conv.js, denoise.js, vae.js, gan.js, dcgan.js from the cache

Device: whatever TensorFlow sees. Run with CUDA_VISIBLE_DEVICES=-1 to force the
CPU; the device that trained each model is recorded in its cache and file header.
On a GPU, Keras 3's jit_compile="auto" turns XLA on; the resolved value is recorded.

Reproduces CITS5017 Lectures 6-7 (Geron, Hands-On ML 3rd ed., ch.17) with the
slides' code as written (transcribed from the slide images):
  slide 5      conv_encoder / conv_decoder / conv_ae, mse + nadam, 10 epochs
  slide 6      gate: conv_decoder.count_params() == 13,873, conv_ae == 54,479
  slide 9      dropout_encoder (Flatten, Dropout(0.5), Dense 100, Dense 30) /
               dropout_decoder / dropout_ae, mse + nadam, 10 epochs. Slide 8 shows
               Gaussian noise only in a figure and prose, so no Gaussian model.
  slides 14-15 Sampling(tf.keras.Layer) with the latent loss added inside call()
               (self.add_loss(mean latent loss / 784)), variational_encoder ->
               [codings_mean, codings_log_var, codings], variational_decoder,
               variational_ae, mse + nadam, 25 epochs, batch_size=128
  slides 16,18 generation codings tf.random.normal([3 * 7, codings_size]) and the
               interpolation endpoints after tf.random.set_seed(123)
  slides 23-25 GAN: codings_size = 30, generator / discriminator / gan,
               discriminator.compile + gan.compile (binary_crossentropy, rmsprop;
               the slide prints NO `discriminator.trainable = False` between them),
               tf.data pipeline (shuffle(1000), batch 32, drop_remainder, prefetch(1)),
               train_gan with the two "# ***" trainable toggles, n_epochs=50
  slide 29     DCGAN: codings_size = 100, generator / discriminator / gan;
               "compilation and training are similar to the code for GANs", so the
               slide 24 compile lines and slide 25 train_gan are reused unchanged
Keras defaults apply wherever the slides say nothing (batch_size=32 for fit,
shuffle=True, optimizer defaults, Glorot-uniform init).

Deviations (this page's own steps, not on the slides; every one is also written
into the export headers):
  - the VAE's codings_size is never defined on slides 14-15; slide 16 says the
    codings are 10-dimensional, so codings_size = 10.
  - DCGAN: the generator ends in tanh and outputs 28x28x1, the discriminator's
    first Conv2D needs a channel axis, and the slides show no preprocessing. Like
    Geron's notebook, X_train is reshaped to (-1, 28, 28, 1) and rescaled
    X * 2 - 1 to [-1, 1] before the slide's tf.data pipeline.
  - fit() runs with verbose=2 (one log line per epoch).
  - train_gan keeps train_on_batch's return values and, at the slide's
    "# extra code - plot images during training" spot, renders 21 fixed noise
    vectors and times the epoch. Nothing else in the loop changes.
  - the denoising inputs for display: slides 8-9 do not say how the noisy
    validation images were made, so Geron's notebook way is used:
    tf.keras.layers.Dropout(0.5)(X_valid, training=True), after set_random_seed(42).
  - if the verbatim `from tensorflow.keras.layers import Dense` (slide 23) fails,
    Dense = tf.keras.layers.Dense and the exact error is recorded.

Trainable experiment (--model trainable-test, this page's own): fresh seeded GAN and
  DCGAN, 2 iterations of the train_gan body on the first batches, max |weight change|
  of generator and discriminator in each phase, for four variants: the slides' code
  as printed ("verbatim"), the slide loop without the two "# ***" lines
  ("withoutToggles"), Geron's book (`discriminator.trainable = False` between the two
  compile() calls, no toggles; "geronOriginal") and "traceCheck" (iteration 1 as the
  slide, iteration 2 with the flags set the wrong way round). Keras 3.15.1 reads
  `trainable` when a model's train function is first traced (first train_on_batch)
  and caches that function; its "trainable state changed" warning is unreachable
  (it sits after a `raise` in Trainer._assert_compile_called).

Devices used for the published run: conv_ae and the DCGAN on the GPU (as briefed);
  dropout_ae, the VAE and the GAN on the CPU (CUDA_VISIBLE_DEVICES=-1), which timed
  faster for these small dense models (dropout_ae ~4 s vs ~18 s per epoch; GAN loop
  5.1 vs 11.0 ms per iteration, 300-iteration probes). With op determinism on,
  Keras's jit_compile="auto" turns XLA off, so no run used XLA.

Gate (a mismatch exits 1 before training and nothing is cached):
  conv_decoder.count_params() == 13,873 and conv_ae.count_params() == 54,479.

Data split (Geron's): X_train_full = training images / 255 as float32;
  X_train = X_train_full[:-5000] (55,000), X_valid = X_train_full[-5000:] (5,000).
Seeds: tf.keras.utils.set_random_seed(42) (Python, NumPy, TF) immediately before
  each model is built, plus enable_op_determinism() unless --no-determinism.

Nothing in here is the slides' figures: every number and image this writes comes
from this script's own training run.
"""
import argparse
import base64
import datetime as dt
import gzip
import hashlib
import json
import os
import platform
import sys
import time
import urllib.request
import warnings
from pathlib import Path

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")

import numpy as np  # noqa: E402
import tensorflow as tf  # noqa: E402

SEED = 42
BASE_URL = "https://storage.googleapis.com/tensorflow/tf-keras-datasets/"
FILES = [
    "train-labels-idx1-ubyte.gz",
    "train-images-idx3-ubyte.gz",
    "t10k-labels-idx1-ubyte.gz",
    "t10k-images-idx3-ubyte.gz",
]
CLASS_NAMES = ["T-shirt/top", "Trouser", "Pullover", "Dress", "Coat",
               "Sandal", "Shirt", "Sneaker", "Bag", "Ankle boot"]
N_VALID = 5000
N_ITEMS = 12            # X_valid[0..11], shared by every export
N_FIXED_NOISE = 21      # 3 x 7, GAN / DCGAN snapshots
EXPECTED_PARAMS = {"conv_decoder": 13_873, "conv_ae": 54_479}   # slide 6
SLIDE_EPOCHS = {"conv": 10, "dropout": 10, "vae": 25, "gan": 50, "dcgan": 50}
VAE_CODINGS = 10        # slide 16: "the codings are only 10-dimensional"
SCRIPT_PATH = "tools/dl-lecture6-7-study/pipeline.py"
DISCLAIMER = "Generated by this page's own run; not the slides' figures."

# --------------------------------------------------------- warnings log -----
CAUGHT = []
_show = warnings.showwarning


def _record_warning(message, category, filename, lineno, file=None, line=None):
    CAUGHT.append(f"{category.__name__}: {message}")
    _show(message, category, filename, lineno, file, line)


warnings.showwarning = _record_warning


# ---------------------------------------------------------------- data -----
def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def fetch(data_dir):
    data_dir.mkdir(parents=True, exist_ok=True)
    hashes = {}
    for name in FILES:
        path = data_dir / name
        if not path.exists():
            print(f"downloading {BASE_URL + name}")
            tmp = path.with_suffix(".part")
            urllib.request.urlretrieve(BASE_URL + name, tmp)
            tmp.replace(path)
        hashes[name] = sha256(path)
        print(f"  {name}  sha256 {hashes[name]}")
    return hashes


def read_idx(path, magic, offset):
    with gzip.open(path, "rb") as f:
        raw = f.read()
    got = int.from_bytes(raw[:4], "big")
    if got != magic:
        sys.exit(f"{path}: IDX magic {got}, expected {magic}")
    # same parsing as keras.datasets.fashion_mnist.load_data()
    return np.frombuffer(raw, np.uint8, offset=offset)


def load_split(data_dir):
    hashes = fetch(data_dir)
    y = read_idx(data_dir / FILES[0], 2049, 8)
    x = read_idx(data_dir / FILES[1], 2051, 16).reshape(len(y), 28, 28)
    if x.shape != (60000, 28, 28):
        sys.exit(f"unexpected training set shape {x.shape}")
    X_train_full = x.astype(np.float32) / 255
    X_train, X_valid = X_train_full[:-N_VALID], X_train_full[-N_VALID:]
    print(f"X_train {X_train.shape}  X_valid {X_valid.shape}")
    return dict(hashes=hashes, X_train=X_train, X_valid=X_valid,
                y_valid=y[-N_VALID:], x_valid_u8=x[-N_VALID:])


# -------------------------------------------------------------- models -----
def build_conv():
    # Slide 5, verbatim
    conv_encoder = tf.keras.Sequential([
        tf.keras.layers.Reshape([28, 28, 1]),
        tf.keras.layers.Conv2D(16, 3, padding="same", activation="relu"),
        tf.keras.layers.MaxPool2D(pool_size=2),  # output: 14 × 14 × 16
        tf.keras.layers.Conv2D(32, 3, padding="same", activation="relu"),
        tf.keras.layers.MaxPool2D(pool_size=2),  # output: 7 × 7 × 32
        tf.keras.layers.Conv2D(64, 3, padding="same", activation="relu"),
        tf.keras.layers.MaxPool2D(pool_size=2),  # output: 3 × 3 × 64
        tf.keras.layers.Conv2D(30, 3, padding="same", activation="relu"),  # output: 3 × 3 × 30
        tf.keras.layers.GlobalAvgPool2D()  # output: 30
    ])
    conv_decoder = tf.keras.Sequential([
        tf.keras.layers.Dense(3 * 3 * 16),     # 144 neurons
        tf.keras.layers.Reshape((3, 3, 16)),   # output: 3 × 3 × 16
        tf.keras.layers.Conv2DTranspose(32, 3, strides=2, activation="relu"),  # output: 7 × 7 × 32
        tf.keras.layers.Conv2DTranspose(16, 3, strides=2, padding="same",
                                        activation="relu"),                    # output: 14 × 14 × 16
        tf.keras.layers.Conv2DTranspose(1, 3, strides=2, padding="same"),      # output: 28 × 28 × 1
        tf.keras.layers.Reshape([28, 28])
    ])
    conv_ae = tf.keras.Sequential([conv_encoder, conv_decoder])
    return conv_encoder, conv_decoder, conv_ae


def build_dropout():
    # Slide 9, verbatim
    dropout_encoder = tf.keras.Sequential([
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dropout(0.5),
        tf.keras.layers.Dense(100, activation="relu"),
        tf.keras.layers.Dense(30, activation="relu")
    ])
    dropout_decoder = tf.keras.Sequential([
        tf.keras.layers.Dense(100, activation="relu"),
        tf.keras.layers.Dense(28 * 28),
        tf.keras.layers.Reshape([28, 28])
    ])
    dropout_ae = tf.keras.Sequential([dropout_encoder, dropout_decoder])
    return dropout_encoder, dropout_decoder, dropout_ae


# Slide 14, verbatim ("# ***" lines are the lecturer's changes to Geron's code).
# define a customized layer
class Sampling(tf.keras.Layer):
    def call(self, inputs):
        mean, logvar = inputs
        # sum the losses over all the features
        loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)
        # average over instances in the minibatch. 784=28*28 is the output image dimension.
        # *** add the latent loss here ***
        self.add_loss(tf.reduce_mean(loss) / 784.)                                  # ***
        return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean


def build_vae(codings_size=VAE_CODINGS):
    # Slide 14, verbatim (codings_size is not defined on the slide; see docstring)
    # the encoder part of the VAE
    inputs = tf.keras.Input(shape=[28, 28])
    Z = tf.keras.layers.Flatten()(inputs)
    Z = tf.keras.layers.Dense(150, activation="relu")(Z)
    Z = tf.keras.layers.Dense(100, activation="relu")(Z)
    codings_mean = tf.keras.layers.Dense(codings_size)(Z)     # mu
    codings_log_var = tf.keras.layers.Dense(codings_size)(Z)  # gamma
    codings = Sampling()([codings_mean, codings_log_var])
    variational_encoder = tf.keras.Model(
        inputs=inputs, outputs=[codings_mean, codings_log_var, codings])          # ***

    # the decoder part of the VAE
    decoder_inputs = tf.keras.Input(shape=[codings_size])
    x = tf.keras.layers.Dense(100, activation="relu")(decoder_inputs)
    x = tf.keras.layers.Dense(150, activation="relu")(x)
    x = tf.keras.layers.Dense(28 * 28)(x)
    outputs = tf.keras.layers.Reshape([28, 28])(x)
    variational_decoder = tf.keras.Model(inputs=decoder_inputs, outputs=outputs)  # ***

    # Slide 15, verbatim
    # now join the encoder and decoder together to form our VAE
    _, _, codings = variational_encoder(inputs)
    reconstructions = variational_decoder(codings)
    variational_ae = tf.keras.Model(inputs=inputs, outputs=reconstructions)
    return variational_encoder, variational_decoder, variational_ae


IMPORT_NOTE = {}


def build_gan():
    # Slide 23, verbatim
    codings_size = 30
    try:
        from tensorflow.keras.layers import Dense
        IMPORT_NOTE["gan"] = ("`from tensorflow.keras.layers import Dense` ran verbatim "
                              f"(Dense is {Dense.__module__}.{Dense.__qualname__})")
    except Exception as e:  # recorded, then the smallest fix
        IMPORT_NOTE["gan"] = (f"`from tensorflow.keras.layers import Dense` failed: "
                              f"{type(e).__name__}: {e}; fix: Dense = tf.keras.layers.Dense")
        Dense = tf.keras.layers.Dense
    generator = tf.keras.Sequential([
        Dense(100, activation="relu", kernel_initializer="he_normal"),
        Dense(150, activation="relu", kernel_initializer="he_normal"),
        Dense(28 * 28, activation="sigmoid"),
        tf.keras.layers.Reshape([28, 28])
    ])
    discriminator = tf.keras.Sequential([
        tf.keras.layers.Flatten(),
        Dense(150, activation="relu", kernel_initializer="he_normal"),
        Dense(100, activation="relu", kernel_initializer="he_normal"),
        Dense(1, activation="sigmoid")
    ])
    gan = tf.keras.Sequential([generator, discriminator])
    return generator, discriminator, gan, codings_size


def build_dcgan():
    # Slide 29, verbatim
    codings_size = 100

    generator = tf.keras.Sequential([
        tf.keras.layers.Dense(7 * 7 * 128),
        tf.keras.layers.Reshape([7, 7, 128]),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,
                                        padding="same", activation="relu"),
        tf.keras.layers.BatchNormalization(),
        tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,
                                        padding="same", activation="tanh"),
    ])
    discriminator = tf.keras.Sequential([
        tf.keras.layers.Conv2D(64, kernel_size=5, strides=2, padding="same",
                               activation=tf.keras.layers.LeakyReLU(0.2)),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Conv2D(128, kernel_size=5, strides=2, padding="same",
                               activation=tf.keras.layers.LeakyReLU(0.2)),
        tf.keras.layers.Dropout(0.4),
        tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(1, activation="sigmoid")
    ])
    gan = tf.keras.Sequential([generator, discriminator])

    # compilation and training are similar to the code for GANs
    return generator, discriminator, gan, codings_size


def compile_gan(discriminator, gan, geron_original=False):
    # Slide 24, as printed: no `discriminator.trainable = False` between the calls.
    discriminator.compile(loss="binary_crossentropy", optimizer="rmsprop")
    if geron_original:  # Geron's book/notebook line - NOT on the slides (experiment only)
        discriminator.trainable = False
    gan.compile(loss="binary_crossentropy", optimizer="rmsprop")


def make_dataset(X_train, batch_size):
    # Slide 24, verbatim
    dataset = tf.data.Dataset.from_tensor_slices(X_train).shuffle(1000)
    dataset = dataset.batch(batch_size, drop_remainder=True).prefetch(1)
    return dataset


class StopProbe(Exception):
    pass


class GanLog:
    """This page's own logging for train_gan (not on the slides)."""

    def __init__(self, fixed_noise, to01, probe_batches=0):
        self.fixed_noise = fixed_noise
        self.to01 = to01
        self.probe = probe_batches
        self.d, self.g = [], []
        self.d_epoch, self.g_epoch, self.secs, self.snaps = [], [], [], []
        self.n = 0
        self.t_epoch = time.time()
        self.t_batch = []

    def batch(self, d_loss, g_loss):
        self.d.append(float(d_loss))
        self.g.append(float(g_loss))
        self.n += 1
        self.t_batch.append(time.time())
        if self.probe and self.n >= self.probe:
            raise StopProbe

    def epoch_end(self, epoch, generator):
        self.d_epoch.append(float(np.mean(self.d)))
        self.g_epoch.append(float(np.mean(self.g)))
        nb = len(self.d)
        self.d, self.g = [], []
        imgs = self.to01(generator(self.fixed_noise, training=False).numpy())
        self.snaps.append(to_u8(imgs).reshape(len(imgs), -1))
        secs = time.time() - self.t_epoch
        self.secs.append(secs)
        self.t_epoch = time.time()
        print(f"  [page log] epoch {epoch}: {nb} batches, mean d_loss "
              f"{self.d_epoch[-1]:.4f}, mean g_loss {self.g_epoch[-1]:.4f}, {secs:.1f}s",
              flush=True)


def train_gan(gan, dataset, batch_size, codings_size, n_epochs, log):
    # Slide 25, verbatim except the three lines marked "# page log"
    generator, discriminator = gan.layers
    for epoch in tf.range(n_epochs):
        epoch = tf.cast(epoch, tf.int64)
        tf.print(f"Epoch {epoch + 1}/{n_epochs}")  # extra code
        for X_batch in dataset:
            ### phase 1 - training the discriminator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            generated_images = generator(noise)
            X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)
            y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
            discriminator.trainable = True  # *** this line is missing in the author's code
            d_loss = discriminator.train_on_batch(X_fake_and_real, y1)  # page log: keep the return value
            ### phase 2 - training the generator
            noise = tf.random.normal(shape=[batch_size, codings_size])
            y2 = tf.constant([[1.]] * batch_size)
            # discriminator now needs to be non-trainable so that training gan
            # will result in training the generator only.
            discriminator.trainable = False  # *** this line is missing in the author's code
            g_loss = gan.train_on_batch(noise, y2)  # page log: keep the return value
            log.batch(d_loss, g_loss)  # page log
        # extra code - plot images during training (omit to save time)
        log.epoch_end(int(epoch) + 1, generator)  # page log: snapshot + timing


# ------------------------------------------------------------- helpers -----
def sig(v, n=4):
    return float(f"{float(v):.{n}g}")


def to_u8(img01):
    return np.rint(np.clip(img01, 0.0, 1.0) * 255.0).astype(np.uint8)


def b64_u8(img01):
    return base64.b64encode(to_u8(img01).reshape(-1).tobytes()).decode("ascii")


def b64_raw(u8):
    return base64.b64encode(np.ascontiguousarray(u8).reshape(-1).tobytes()).decode("ascii")


def count_trainable(model):
    return int(sum(np.prod(w.shape) for w in model.trainable_weights))


def count_non_trainable(model):
    return int(sum(np.prod(w.shape) for w in model.non_trainable_weights))


def shape_of(t):
    if isinstance(t, (list, tuple)):
        return [shape_of(x) for x in t]
    return [None if d is None else int(d) for d in t.shape]


def layer_table(model):
    rows = []
    for layer in model.layers:
        try:
            out = shape_of(layer.output)
        except Exception as e:  # noqa: BLE001
            out = f"unavailable ({type(e).__name__}: {e})"
        rows.append(dict(name=layer.name, cls=type(layer).__name__,
                         outputShape=out, params=int(layer.count_params())))
    return rows


def model_counts(model):
    return dict(cls=type(model).__name__,
                totalParams=int(model.count_params()),
                trainableParams=count_trainable(model),
                nonTrainableParams=count_non_trainable(model),
                layers=layer_table(model))


def print_table(name, model):
    c = model_counts(model)
    print(f"{name}: count_params() = {c['totalParams']:,}  trainable {c['trainableParams']:,}  "
          f"non-trainable {c['nonTrainableParams']:,}")
    for r in c["layers"]:
        print(f"    {r['name']:<28} {r['cls']:<20} {str(r['outputShape']):<24} {r['params']:>9,}")
    return c


def device_label():
    gpus = tf.config.list_physical_devices("GPU")
    if gpus:
        d = tf.config.experimental.get_device_details(gpus[0])
        return f"GPU: {d.get('device_name', 'GPU')}"
    return "CPU"


def versions_label():
    import keras
    try:
        osr = platform.freedesktop_os_release().get("PRETTY_NAME", "")
    except OSError:
        osr = ""
    os_name = f"{platform.system()}" + (f" ({osr}, WSL2)" if "microsoft" in platform.release() else
                                        (f" ({osr})" if osr else ""))
    return (f"Python {platform.python_version()}, TensorFlow {tf.__version__} "
            f"(tf.keras = Keras {keras.__version__}), NumPy {np.__version__}; {os_name}")


def gate(conv_decoder, conv_ae):
    ok_all = True
    for name, model in (("conv_decoder", conv_decoder), ("conv_ae", conv_ae)):
        total = model.count_params()
        trainable = count_trainable(model)
        want = EXPECTED_PARAMS[name]
        ok = total == want and trainable == want
        ok_all &= ok
        print(f"GATE {name}: count_params() = {total:,}  trainable = {trainable:,}  "
              f"expected {want:,} (slide 6)  -> {'PASS' if ok else 'FAIL'}")
    if not ok_all:
        sys.exit("parameter gate failed; nothing trained or cached")


def save_cache(cache, name, meta, arrays=None):
    cache.mkdir(parents=True, exist_ok=True)
    meta["warnings"] = sorted(set(CAUGHT))
    (cache / f"{name}.json").write_text(json.dumps(meta, indent=1), encoding="utf-8")
    if arrays:
        np.savez_compressed(cache / f"{name}.npz", **arrays)
    print(f"cached {cache / (name + '.json')}")


def base_meta(name, epochs, determinism):
    return dict(model=name, epochsSlide=SLIDE_EPOCHS.get(name), epochsRun=epochs,
                device=device_label(), determinism=determinism,
                versions=versions_label())


# --------------------------------------------------------------- steps -----
def run_conv(D, cache, epochs, determinism):
    tf.keras.utils.set_random_seed(SEED)
    conv_encoder, conv_decoder, conv_ae = build_conv()
    conv_ae.build((None, 28, 28))  # page's own: builds the weights so the gate can count them
    gate(conv_decoder, conv_ae)
    counts = {n: print_table(n, m) for n, m in
              (("conv_encoder", conv_encoder), ("conv_decoder", conv_decoder), ("conv_ae", conv_ae))}
    X_train, X_valid = D["X_train"], D["X_valid"]
    t0 = time.time()
    # compile and fit the model (slide 5)
    conv_ae.compile(loss="mse", optimizer="nadam")
    history = conv_ae.fit(X_train, X_train, epochs=epochs,
                          validation_data=(X_valid, X_valid), verbose=2)
    wall = time.time() - t0
    recon = conv_ae.predict(X_valid[:N_ITEMS], verbose=0)
    meta = base_meta("conv", epochs, determinism)
    meta.update(jitCompile=bool(conv_ae.jit_compile), wallSeconds=wall,
                params={k: v["totalParams"] for k, v in counts.items()},
                loss=history.history["loss"], valLoss=history.history["val_loss"])
    conv_ae.save_weights(cache / "conv.weights.h5")
    save_cache(cache, "conv", meta, dict(recon=recon))


def run_dropout(D, cache, epochs, determinism):
    tf.keras.utils.set_random_seed(SEED)
    dropout_encoder, dropout_decoder, dropout_ae = build_dropout()
    dropout_ae.build((None, 28, 28))  # page's own: count before training
    counts = {n: print_table(n, m) for n, m in
              (("dropout_encoder", dropout_encoder), ("dropout_decoder", dropout_decoder),
               ("dropout_ae", dropout_ae))}
    X_train, X_valid = D["X_train"], D["X_valid"]
    t0 = time.time()
    # compile and fit the model (slide 9)
    dropout_ae.compile(loss="mse", optimizer="nadam")
    history = dropout_ae.fit(X_train, X_train, epochs=epochs,
                             validation_data=(X_valid, X_valid), verbose=2)
    wall = time.time() - t0
    # Page's own: noisy validation images the way Geron's notebook makes them.
    tf.keras.utils.set_random_seed(SEED)
    dropout = tf.keras.layers.Dropout(0.5)
    X_valid_noisy = dropout(X_valid, training=True).numpy()   # kept pixels x 2
    recon_noisy = dropout_ae.predict(X_valid_noisy, verbose=0)  # inference: model's Dropout off
    recon_clean = dropout_ae.predict(X_valid, verbose=0)
    kept = float(np.mean(X_valid_noisy[X_valid > 0] != 0))
    scale_seen = float(np.max(X_valid_noisy / np.where(X_valid > 0, X_valid, 1)))
    meta = base_meta("dropout", epochs, determinism)
    meta.update(jitCompile=bool(dropout_ae.jit_compile), wallSeconds=wall,
                params={k: v["totalParams"] for k, v in counts.items()},
                loss=history.history["loss"], valLoss=history.history["val_loss"],
                validMseNoisyInput=float(np.mean((recon_noisy - X_valid) ** 2)),
                validMseCleanInput=float(np.mean((recon_clean - X_valid) ** 2)),
                keptFractionOfNonzeroPixels=kept, maxScaleOfKeptPixels=scale_seen)
    print(f"valid MSE, noisy input {meta['validMseNoisyInput']:.5f}; clean input "
          f"{meta['validMseCleanInput']:.5f}; kept fraction {kept:.4f}; kept-pixel scale {scale_seen}")
    dropout_ae.save_weights(cache / "dropout.weights.h5")
    save_cache(cache, "dropout", meta, dict(
        noisy_fed=X_valid_noisy[:N_ITEMS], recon=recon_noisy[:N_ITEMS],
        recon_clean=recon_clean[:N_ITEMS]))


def latent_of(mean, logvar):
    return tf.reduce_mean(-0.5 * tf.reduce_sum(
        1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)) / 784.


def add_loss_check(variational_encoder, variational_ae, xb, label):
    """Page's own check that Sampling.add_loss reaches the loss Keras minimises."""
    y_pred = variational_ae(xb, training=False)
    added = [float(v) for v in variational_ae.losses]
    total = float(variational_ae.compute_loss(x=xb, y=xb, y_pred=y_pred))
    mse = float(np.mean((y_pred.numpy() - xb) ** 2))
    mean, logvar, _ = variational_encoder(xb)
    latent = float(latent_of(mean, logvar))
    out = dict(when=label, batch=int(len(xb)), lossesAfterForwardPass=added,
               computeLoss=total, reconMse=mse, latentOver784=latent,
               mseMinusComputeLoss=mse - total, msePlusLatentMinusComputeLoss=mse + latent - total)
    print(f"add_loss check ({label}): variational_ae.losses = {added}; compute_loss = {total:.6f}; "
          f"recon MSE = {mse:.6f}; latent/784 = {latent:.6f}; MSE + latent/784 = {mse + latent:.6f}")
    return out


def quantise_decoder(variational_decoder):
    layers = []
    for layer in variational_decoder.layers:
        if not isinstance(layer, tf.keras.layers.Dense):
            continue
        W, b = [np.asarray(v, dtype=np.float64) for v in layer.get_weights()]
        maxabs = np.abs(W).max(axis=0)
        scale = np.array([sig(m / 127.0, 5) if m > 0 else 1.0 for m in maxabs])
        q = np.clip(np.rint(W / scale[None, :]), -127, 127).astype(np.int8)
        layers.append(dict(inp=int(W.shape[0]), out=int(W.shape[1]),
                           activation=layer.get_config()["activation"],
                           q=q, scale=scale, b=np.array([sig(v, 5) for v in b])))
    return layers


def dequant_forward(layers, Z):
    h = np.asarray(Z, dtype=np.float64)
    for L in layers:
        h = h @ (L["q"].astype(np.float64) * L["scale"][None, :]) + L["b"]
        if L["activation"] == "relu":
            h = np.maximum(h, 0.0)
        elif L["activation"] != "linear":
            sys.exit(f"unexpected activation {L['activation']}")
    return h


def round5(a):
    return np.vectorize(lambda v: sig(v, 5))(np.asarray(a, dtype=np.float64))


def run_vae(D, cache, epochs, determinism):
    codings_size = VAE_CODINGS
    print("tf.keras.Layer is", tf.keras.Layer, "| same class as tf.keras.layers.Layer:",
          tf.keras.Layer is tf.keras.layers.Layer)
    tf.keras.utils.set_random_seed(SEED)
    variational_encoder, variational_decoder, variational_ae = build_vae(codings_size)
    losses_after_build = len(variational_ae.losses)
    counts = {n: print_table(n, m) for n, m in
              (("variational_encoder", variational_encoder),
               ("variational_decoder", variational_decoder),
               ("variational_ae", variational_ae))}
    X_train, X_valid = D["X_train"], D["X_valid"]
    t0 = time.time()
    # compile and train our VAE to minimize the total loss (slide 15)
    variational_ae.compile(loss="mse", optimizer="nadam")
    checks = [add_loss_check(variational_encoder, variational_ae, X_valid[:256],
                             "after compile, before fit")]  # page's own check (no RNG for weights)
    history = variational_ae.fit(X_train, X_train, epochs=epochs, batch_size=128,
                                 validation_data=(X_valid, X_valid), verbose=2)
    wall = time.time() - t0
    checks.append(add_loss_check(variational_encoder, variational_ae, X_valid[:256], "after training"))

    # Page's own: split the final val_loss into its two parts over all of X_valid.
    mean_v, logvar_v, codings_v = variational_encoder.predict(X_valid, batch_size=128, verbose=0)
    recon_v = variational_decoder.predict(codings_v, batch_size=128, verbose=0)
    recon_mean_v = variational_decoder.predict(mean_v, batch_size=128, verbose=0)
    valid_mse_sampled = float(np.mean((recon_v - X_valid) ** 2))
    valid_mse_mean = float(np.mean((recon_mean_v - X_valid) ** 2))
    valid_latent = float(np.mean(-0.5 * np.sum(1 + logvar_v - np.exp(logvar_v) - mean_v ** 2,
                                               axis=-1)) / 784.)
    print(f"final val_loss {history.history['val_loss'][-1]:.6f}; recompute on X_valid: recon MSE "
          f"(sampled codings) {valid_mse_sampled:.6f} + latent/784 {valid_latent:.6f} = "
          f"{valid_mse_sampled + valid_latent:.6f}; recon MSE from codings_mean {valid_mse_mean:.6f}")

    # Shared images: codings_mean / codings_log_var from variational_encoder.
    mean12, logvar12, _ = variational_encoder.predict(X_valid[:N_ITEMS], verbose=0)

    # Slide 16 (after set_random_seed, page's own) and slide 18 (its own seed 123), verbatim.
    tf.keras.utils.set_random_seed(SEED)
    codings = tf.random.normal(shape=[3 * 7, codings_size])
    slide16 = codings.numpy()
    tf.random.set_seed(123)
    # generate 2 codings from the normal distribution
    codings = tf.random.normal(shape=[2, codings_size])
    slide18 = codings.numpy()

    # Quantised decoder for the page, and its error against Keras's float decoder.
    qlayers = quantise_decoder(variational_decoder)
    rng = np.random.default_rng(SEED)
    z_normal = round5(rng.standard_normal((100, codings_size)))
    z_wide = round5(rng.uniform(-3.0, 3.0, (100, codings_size)))
    z_slides = round5(np.concatenate([slide16, slide18]))

    def err(Z):
        keras_out = variational_decoder.predict(Z.astype(np.float32), verbose=0).reshape(len(Z), -1)
        js_out = dequant_forward(qlayers, Z)
        clipped = np.abs(np.clip(keras_out, 0, 1) - np.clip(js_out, 0, 1)).max()
        raw = np.abs(keras_out - js_out).max()
        levels = np.abs(to_u8(keras_out).astype(int) - to_u8(js_out).astype(int)).max()
        mean_abs = np.abs(np.clip(keras_out, 0, 1) - np.clip(js_out, 0, 1)).mean()
        return float(clipped), float(raw), int(levels), float(mean_abs)

    q_normal, q_normal_raw, q_normal_lv, q_normal_mean = err(z_normal)
    q_wide, q_wide_raw, q_wide_lv, q_wide_mean = err(z_wide)
    q_slides, _, q_slides_lv, _ = err(z_slides)
    print(f"quantised decoder: max |keras - int8| over 100 N(0,I) codings = {q_normal:.6f} "
          f"(clipped [0,1]; raw {q_normal_raw:.6f}; {q_normal_lv} uint8 levels; mean "
          f"{q_normal_mean:.6f}); over 100 U(-3,3) codings = {q_wide:.6f} ({q_wide_lv} levels; "
          f"mean {q_wide_mean:.6f}); slide 16/18 codings {q_slides:.6f}")
    check_z = z_normal[:3]
    check_out = variational_decoder.predict(check_z.astype(np.float32), verbose=0)

    meta = base_meta("vae", epochs, determinism)
    meta.update(jitCompile=bool(variational_ae.jit_compile), wallSeconds=wall,
                codingsSize=codings_size, batchSize=128,
                params={k: v["totalParams"] for k, v in counts.items()},
                loss=history.history["loss"], valLoss=history.history["val_loss"],
                lossesAfterBuild=losses_after_build, addLossChecks=checks,
                validReconMseSampled=valid_mse_sampled, validReconMseFromMean=valid_mse_mean,
                validLatentOver784=valid_latent,
                quant=dict(normal=q_normal, normalRaw=q_normal_raw, normalLevels=q_normal_lv,
                           normalMean=q_normal_mean, wideMean=q_wide_mean,
                           wide=q_wide, wideRaw=q_wide_raw, wideLevels=q_wide_lv,
                           slides=q_slides, slidesLevels=q_slides_lv),
                layers=[dict(inp=L["inp"], out=L["out"], activation=L["activation"])
                        for L in qlayers],
                tfKerasLayerIsLayer=bool(tf.keras.Layer is tf.keras.layers.Layer))
    arrays = dict(mean12=mean12, logvar12=logvar12, slide16=slide16, slide18=slide18,
                  check_z=check_z, check_out=check_out)
    for i, L in enumerate(qlayers):
        arrays[f"q{i}"], arrays[f"scale{i}"], arrays[f"b{i}"] = L["q"], L["scale"], L["b"]
    variational_ae.save_weights(cache / "vae.weights.h5")
    save_cache(cache, "vae", meta, arrays)


def gan_parts(kind, D):
    if kind == "gan":
        generator, discriminator, gan, codings_size = build_gan()
        X = D["X_train"]
        to01 = lambda a: a  # noqa: E731  (sigmoid output, already [0,1])
    else:
        generator, discriminator, gan, codings_size = build_dcgan()
        # Page's own (Geron's notebook): channel axis + rescale to tanh's range.
        X = D["X_train"].reshape(-1, 28, 28, 1) * 2. - 1.
        to01 = lambda a: (a.reshape(len(a), 28, 28) + 1.) / 2.  # noqa: E731
    return generator, discriminator, gan, codings_size, X, to01


def run_gan(kind, D, cache, epochs, determinism, probe):
    tf.keras.utils.set_random_seed(SEED)
    generator, discriminator, gan, codings_size, X, to01 = gan_parts(kind, D)
    gan.build((None, codings_size))  # page's own: count before training
    counts = {n: print_table(n, m) for n, m in
              (("generator", generator), ("discriminator", discriminator), ("gan", gan))}
    print("import:", IMPORT_NOTE.get("gan", "n/a"))
    compile_gan(discriminator, gan)
    batch_size = 32
    dataset = make_dataset(X, batch_size)
    fixed_noise = np.random.default_rng(SEED).standard_normal(
        (N_FIXED_NOISE, codings_size)).astype(np.float32)  # own Generator: TF's RNG untouched
    log = GanLog(fixed_noise, to01, probe_batches=probe)
    t0 = time.time()
    try:
        train_gan(gan, dataset, batch_size, codings_size, n_epochs=epochs, log=log)
    except StopProbe:
        t = np.diff(np.array(log.t_batch))
        warm = t[20:] if len(t) > 40 else t
        print(f"PROBE {kind} on {device_label()}: {log.n} iterations in {time.time() - t0:.1f}s; "
              f"steady {warm.mean() * 1000:.2f} ms/iteration -> "
              f"{warm.mean() * (len(X) // batch_size):.1f} s/epoch "
              f"({len(X) // batch_size} batches)")
        return
    wall = time.time() - t0
    meta = base_meta(kind, epochs, determinism)
    meta.update(jitCompile=dict(discriminator=bool(discriminator.jit_compile), gan=bool(gan.jit_compile)),
                wallSeconds=wall, codingsSize=codings_size, batchSize=batch_size,
                batchesPerEpoch=int(len(X) // batch_size),
                params={k: v["totalParams"] for k, v in counts.items()},
                dLoss=log.d_epoch, gLoss=log.g_epoch, epochSeconds=log.secs,
                importNote=IMPORT_NOTE.get("gan"),
                dataRange=[float(X.min()), float(X.max())], dataShape=list(X.shape))
    gan.save_weights(cache / f"{kind}.weights.h5")
    save_cache(cache, kind, meta, dict(snaps=np.stack(log.snaps), fixed_noise=fixed_noise))


def snapshot_weights(model):
    out = []
    for v in model.weights:
        out.append((v.path, "moving" in v.path, v.numpy().copy()))
    return out


def max_change(before, after):
    params = [float(np.abs(a[2] - b[2]).max()) for b, a in zip(before, after) if not b[1]]
    moving = [float(np.abs(a[2] - b[2]).max()) for b, a in zip(before, after) if b[1]]
    return (max(params) if params else 0.0), (max(moving) if moving else None)


def trainable_experiment(kind, D, n_iter=2):
    """Page's own experiment: which weights does each phase of train_gan update?"""
    # plan[i] = (flag set before phase 1, flag set before phase 2); None = no toggle line
    variants = {
        "verbatim": dict(plan=[(True, False)] * n_iter, geron=False,
                         text="slide 24 compile as printed + slide 25 loop with both # *** toggles"),
        "withoutToggles": dict(plan=[(None, None)] * n_iter, geron=False,
                               text="slide 24 compile as printed + slide 25 loop with the two # *** lines removed"),
        "geronOriginal": dict(plan=[(None, None)] * n_iter, geron=True,
                              text="Geron's book: discriminator.trainable = False between the two "
                                   "compile() calls, loop without the # *** lines (not on the slides)"),
        "traceCheck": dict(plan=[(True, False)] + [(False, True)] * (n_iter - 1), geron=False,
                           text="iteration 1 as the slide (both train functions get traced); later "
                                "iterations set the flags the WRONG way round (False before phase 1, "
                                "True before phase 2) to test whether Keras re-reads them"),
    }
    results = {}
    for name, v in variants.items():
        tf.keras.utils.set_random_seed(SEED)
        generator, discriminator, gan, codings_size, X, _ = gan_parts(kind, D)
        gan.build((None, codings_size))  # so the "before" snapshot has weights to compare
        compile_gan(discriminator, gan, geron_original=v["geron"])
        batch_size = 32
        it = iter(make_dataset(X, batch_size))
        rows = []
        with warnings.catch_warnings(record=True) as caught:
            warnings.simplefilter("always")
            for i in range(n_iter):
                X_batch = next(it)
                g0, d0 = snapshot_weights(generator), snapshot_weights(discriminator)
                # phase 1
                noise = tf.random.normal(shape=[batch_size, codings_size])
                generated_images = generator(noise)
                X_fake_and_real = tf.concat([generated_images, X_batch], axis=0)
                y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
                flag1, flag2 = v["plan"][i]
                if flag1 is not None:
                    discriminator.trainable = flag1  # *** (True in the slide's loop)
                p1_state = dict(discriminatorTrainable=bool(discriminator.trainable),
                                discriminatorTrainableVars=len(discriminator.trainable_weights))
                d_loss = discriminator.train_on_batch(X_fake_and_real, y1)
                g1, d1 = snapshot_weights(generator), snapshot_weights(discriminator)
                # phase 2
                noise = tf.random.normal(shape=[batch_size, codings_size])
                y2 = tf.constant([[1.]] * batch_size)
                if flag2 is not None:
                    discriminator.trainable = flag2  # *** (False in the slide's loop)
                p2_state = dict(discriminatorTrainable=bool(discriminator.trainable),
                                ganTrainableVars=len(gan.trainable_weights))
                g_loss = gan.train_on_batch(noise, y2)
                g2, d2 = snapshot_weights(generator), snapshot_weights(discriminator)
                row = dict(iteration=i + 1)
                for ph, (gb, ga, db, da, st, loss) in (
                        ("phase1", (g0, g1, d0, d1, p1_state, d_loss)),
                        ("phase2", (g1, g2, d1, d2, p2_state, g_loss))):
                    gp, gm = max_change(gb, ga)
                    dp, dm = max_change(db, da)
                    row[ph] = dict(generator=gp, discriminator=dp, loss=float(loss), **st)
                    if gm is not None:
                        row[ph]["generatorMovingStats"] = gm
                    if dm is not None:
                        row[ph]["discriminatorMovingStats"] = dm
                rows.append(row)
                print(f"[{kind} {name}] iteration {i + 1}: " + "; ".join(
                    f"{ph}: G max|dw| {row[ph]['generator']:.3g}, D max|dw| {row[ph]['discriminator']:.3g} "
                    f"(D.trainable={row[ph]['discriminatorTrainable']})" for ph in ("phase1", "phase2")))
        results[name] = dict(description=v["text"], iterations=rows,
                             warnings=sorted({f"{w.category.__name__}: {w.message}" for w in caught}))
        for w in results[name]["warnings"]:
            print(f"    warning: {w}")
    return results


def run_trainable_test(D, cache, determinism):
    out = dict(device=device_label(), determinism=determinism, versions=versions_label(),
               gan=trainable_experiment("gan", D), dcgan=trainable_experiment("dcgan", D),
               importNote=IMPORT_NOTE.get("gan"))
    save_cache(cache, "trainable-test", out)


def run_counts(path, date):
    import keras
    models = {}
    tf.keras.utils.set_random_seed(SEED)
    enc, dec, ae = build_conv()
    ae.build((None, 28, 28))
    models.update(conv_encoder=enc, conv_decoder=dec, conv_ae=ae)
    tf.keras.utils.set_random_seed(SEED)
    enc, dec, ae = build_dropout()
    ae.build((None, 28, 28))
    models.update(dropout_encoder=enc, dropout_decoder=dec, dropout_ae=ae)
    tf.keras.utils.set_random_seed(SEED)
    enc, dec, ae = build_vae(VAE_CODINGS)
    models.update(variational_encoder=enc, variational_decoder=dec, variational_ae=ae)
    tf.keras.utils.set_random_seed(SEED)
    g, d, gan, cs = build_gan()
    gan.build((None, cs))
    models.update(generator=g, discriminator=d, gan=gan)
    tf.keras.utils.set_random_seed(SEED)
    g, d, gan, cs = build_dcgan()
    gan.build((None, cs))
    models.update(dcgan_generator=g, dcgan_discriminator=d, dcgan_gan=gan)
    inputs = dict(conv_encoder=[None, 28, 28], conv_decoder=[None, 30], conv_ae=[None, 28, 28],
                  dropout_encoder=[None, 28, 28], dropout_decoder=[None, 30], dropout_ae=[None, 28, 28],
                  variational_encoder=[None, 28, 28], variational_decoder=[None, VAE_CODINGS],
                  variational_ae=[None, 28, 28], generator=[None, 30], discriminator=[None, 28, 28],
                  gan=[None, 30], dcgan_generator=[None, 100], dcgan_discriminator=[None, 28, 28, 1],
                  dcgan_gan=[None, 100])
    out = dict(
        generatedBy=f"{SCRIPT_PATH} --counts",
        date=date,
        libraries=versions_label(),
        note=("Straight from Keras: every model built fresh from the slides' code "
              "(Sequential models via build(input_shape)); per layer = model.layers in order "
              "(name, class, layer.output shape with null = batch, layer.count_params()); "
              "totals = count_params(), trainable / non-trainable weight sizes. Layer names are "
              "Keras's auto names for this build order in one process. VAE codingsSize = 10. "
              "dcgan_* = slide 29's generator / discriminator / gan."),
        models={})
    for name, m in models.items():
        c = model_counts(m)
        out["models"][name] = dict(inputShape=inputs[name], **{
            "class": c["cls"], "totalParams": c["totalParams"],
            "trainableParams": c["trainableParams"], "nonTrainableParams": c["nonTrainableParams"],
            "layers": [{"name": r["name"], "class": r["cls"], "outputShape": r["outputShape"],
                        "params": r["params"]} for r in c["layers"]]})
        print_table(name, m)
    Path(path).write_text(json.dumps(out, indent=2) + "\n", encoding="utf-8", newline="\n")
    print(f"wrote {path}  (Keras {keras.__version__})")


# -------------------------------------------------------------- export -----
def js_nums(values, n=4):
    return "[" + ", ".join(repr(sig(v, n)) for v in values) + "]"


def js_matrix(rows, n=5, indent="      "):
    return "[\n" + "".join(f"{indent}{js_nums(r, n)},\n" for r in rows) + indent[:-2] + "]"


def header(lines):
    lines = [part for ln in lines for part in ln.split("\n")]
    return "".join(f"// {ln}\n" if ln else "//\n" for ln in lines)


def common_header(hashes, date, meta, extra):
    det = "op determinism on" if meta["determinism"] else "op determinism OFF"
    return [
        DISCLAIMER,
        "",
        "Source: Fashion MNIST (Xiao, Rasul & Vollgraf 2017), the IDX files at",
        f"  {BASE_URL}",
        "  (the files keras.datasets.fashion_mnist.load_data() downloads, parsed the same way)",
        f"  {FILES[1]} sha256 {hashes[FILES[1]]}",
        f"  {FILES[0]} sha256 {hashes[FILES[0]]}",
        f"Generated by {SCRIPT_PATH} on {date}.",
        "Split (Geron's): pixels / 255 as float32; X_train = first 55,000 training images,",
        "  X_valid = last 5,000 (training images 55000..59999). Test set unused.",
        f"Seeds: tf.keras.utils.set_random_seed({SEED}) before the model is built; {det}.",
        f"Libraries: {meta['versions']}.",
    ] + extra + ["Do not edit by hand: re-run the script."]


def device_line(meta):
    jit = meta.get("jitCompile")
    if isinstance(jit, dict):
        jit = any(jit.values())
    if jit:
        xla = "XLA on (Keras jit_compile='auto')"
    elif meta["device"] != "CPU" and meta["determinism"]:
        xla = "no XLA (Keras's jit_compile='auto' turns XLA off when op determinism is on)"
    else:
        xla = "no XLA"
    return (f"Device that trained it: {meta['device']}; training wall time "
            f"{meta['wallSeconds']:.0f} s;\n  {xla}.")


IMAGE_CONVENTION = [
    "Images: base64 of 784 uint8 bytes, row-major 28x28, 0 = background, 255 = full",
    "  intensity (the dataset's own values; the slides' cmap='binary' draws 255 as black).",
    "  Model outputs are clipped to [0,1] then rounded x*255.",
]


def item_head(D, i):
    return [f"index: {i}", f"label: {int(D['y_valid'][i])}",
            f"original: '{b64_raw(D['x_valid_u8'][i])}'"]


def item_block(fields):
    return "    {\n" + "".join(f"      {f},\n" for f in fields) + "    },\n"


def meta_block(name):
    return ("  width: 28,\n  height: 28,\n  encoding: 'base64-uint8',\n"
            "  classNames: [" + ", ".join(f"'{c}'" for c in CLASS_NAMES) + "],\n"
            f"  validStart: {60000 - N_VALID},\n")


def epochs_line(meta):
    s, r = meta["epochsSlide"], meta["epochsRun"]
    return f"Epochs: slide {s}; this run {r}" + ("." if s == r else f" (the slide says {s}).")


def export_conv(D, cache, hashes, date):
    meta = json.loads((cache / "conv.json").read_text())
    recon = np.load(cache / "conv.npz")["recon"]
    X_valid = D["X_valid"]
    items = []
    for i in range(N_ITEMS):
        items.append(item_block(item_head(D, i) + [
            f"recon: '{b64_u8(recon[i])}'",
            f"mse: {sig(np.mean((recon[i] - X_valid[i]) ** 2))}"]))
    p = meta["params"]
    head = common_header(hashes, date, meta, [
        "Model: slide 5's conv_encoder / conv_decoder / conv_ae, verbatim; compile(loss='mse',",
        "  optimizer='nadam'), fit(X_train, X_train, epochs=10, validation_data=(X_valid, X_valid))",
        "  (Keras defaults: batch 32, shuffle on). No fix to the slide's code was needed.",
        f"Gate (slide 6): conv_decoder.count_params() = {p['conv_decoder']:,} (slide 13,873), "
        f"conv_ae = {p['conv_ae']:,} (slide 54,479).",
        epochs_line(meta),
        device_line(meta),
        "",
        f"CONV.items[i] is X_valid[i] (training image 55000 + i), i = 0..{N_ITEMS - 1}; the same",
        "  12 images in conv.js, denoise.js and vae.js.",
    ] + IMAGE_CONVENTION + [
        "  mse = that image's MSE on the unclipped output.",
        "finalTrainMse = Keras's logged 'loss' for the last epoch (mean over that epoch's",
        "  batches); finalValidMse = 'val_loss' (X_valid, end of the last epoch). loss/valLoss",
        "  are per epoch. All values rounded to 4 significant figures.",
    ])
    return (
        "// Fashion MNIST reconstructions by slide 5's convolutional autoencoder.\n"
        + header(head) + "\n"
        + "export const CONV = {\n" + meta_block("conv")
        + f"  epochs: {meta['epochsRun']},\n"
        + f"  epochsSlide: {meta['epochsSlide']},\n"
        + f"  params: {{ conv_encoder: {p['conv_encoder']}, conv_decoder: {p['conv_decoder']}, "
          f"conv_ae: {p['conv_ae']} }},\n"
        + f"  device: '{meta['device']}',\n"
        + f"  finalTrainMse: {sig(meta['loss'][-1])},\n"
        + f"  finalValidMse: {sig(meta['valLoss'][-1])},\n"
        + f"  loss: {js_nums(meta['loss'])},\n"
        + f"  valLoss: {js_nums(meta['valLoss'])},\n"
        + "  items: [\n" + "".join(items) + "  ],\n"
        + "}\n")


def export_denoise(D, cache, hashes, date):
    meta = json.loads((cache / "dropout.json").read_text())
    z = np.load(cache / "dropout.npz")
    fed, recon = z["noisy_fed"], z["recon"]
    X_valid = D["X_valid"]
    display = fed * 0.5   # = original x keep-mask exactly (Dropout scaled kept pixels by 2)
    items = []
    for i in range(N_ITEMS):
        items.append(item_block(item_head(D, i) + [
            f"noisy: '{b64_u8(display[i])}'",
            f"recon: '{b64_u8(recon[i])}'",
            f"mse: {sig(np.mean((recon[i] - X_valid[i]) ** 2))}"]))
    p = meta["params"]
    head = common_header(hashes, date, meta, [
        "Model: slide 9's dropout_encoder (Flatten, Dropout(0.5), Dense(100, relu), Dense(30,",
        "  relu)) / dropout_decoder / dropout_ae, verbatim; compile(loss='mse', optimizer='nadam'),",
        "  fit(X_train, X_train, epochs=10, validation_data=(X_valid, X_valid)). No fix needed.",
        "  Slide 8 shows Gaussian noise only in a figure and prose, so no Gaussian model here.",
        f"Params: dropout_ae {p['dropout_ae']:,} (encoder {p['dropout_encoder']:,}, decoder "
        f"{p['dropout_decoder']:,}; Dropout has none).",
        epochs_line(meta),
        device_line(meta),
        "",
        "Noisy inputs (this page's own step; slides 8-9 do not show how theirs were made): as",
        "  Geron's notebook, X_valid_noisy = tf.keras.layers.Dropout(0.5)(X_valid, training=True)",
        f"  after tf.keras.utils.set_random_seed({SEED}). Keras's Dropout zeroes each pixel with",
        "  probability 0.5 and multiplies the kept pixels by 1/(1-0.5) = 2: THAT scaled array is",
        "  what dropout_ae was fed (model.predict, inference mode, so the model's own Dropout",
        "  layer is off). `noisy` below is for DISPLAY: original x keep-mask, NOT scaled by 2",
        "  (= fed / 2 exactly). `recon` = dropout_ae's output for the fed (scaled) input.",
        "  mse = MSE between recon (unclipped) and the CLEAN original.",
    ] + IMAGE_CONVENTION + [
        "loss = Keras's logged training loss: during training the model's Dropout layer is on,",
        "  so it is the denoising MSE. valLoss = 'val_loss', where Keras runs inference, so the",
        "  Dropout layer is OFF and X_valid goes in CLEAN. validMseNoisyInput = MSE over all of",
        "  X_valid when fed X_valid_noisy (the denoising error). Values: 4 significant figures.",
    ])
    return (
        "// Fashion MNIST denoising by slide 9's dropout autoencoder.\n"
        + header(head) + "\n"
        + "export const DENOISE = {\n" + meta_block("denoise")
        + "  rate: 0.5,\n"
        + f"  epochs: {meta['epochsRun']},\n"
        + f"  epochsSlide: {meta['epochsSlide']},\n"
        + f"  params: {{ dropout_ae: {p['dropout_ae']}, dropout_encoder: {p['dropout_encoder']}, "
          f"dropout_decoder: {p['dropout_decoder']} }},\n"
        + f"  device: '{meta['device']}',\n"
        + f"  finalTrainMse: {sig(meta['loss'][-1])},\n"
        + f"  finalValidMse: {sig(meta['valLoss'][-1])},\n"
        + f"  validMseNoisyInput: {sig(meta['validMseNoisyInput'])},\n"
        + f"  loss: {js_nums(meta['loss'])},\n"
        + f"  valLoss: {js_nums(meta['valLoss'])},\n"
        + "  items: [\n" + "".join(items) + "  ],\n"
        + "}\n")


def export_vae(D, cache, hashes, date):
    meta = json.loads((cache / "vae.json").read_text())
    z = np.load(cache / "vae.npz")
    p = meta["params"]
    q = meta["quant"]
    nl = len(meta["layers"])
    layer_txt = []
    for i, L in enumerate(meta["layers"]):
        qi, si, bi = z[f"q{i}"], z[f"scale{i}"], z[f"b{i}"]
        layer_txt.append(
            "      {\n"
            f"        in: {L['inp']},\n        out: {L['out']},\n        activation: '{L['activation']}',\n"
            f"        w: '{base64.b64encode(qi.astype(np.int8).tobytes()).decode('ascii')}',\n"
            f"        scale: {js_nums(si, 5)},\n"
            f"        b: {js_nums(bi, 5)},\n"
            "      },\n")
    items = []
    for i in range(N_ITEMS):
        items.append(item_block(item_head(D, i) + [
            f"mean: {js_nums(z['mean12'][i], 5)}",
            f"logVar: {js_nums(z['logvar12'][i], 5)}"]))
    chk = meta["addLossChecks"]
    after = chk[-1]
    head = common_header(hashes, date, meta, [
        "Model: slides 14-15's Sampling layer, variational_encoder, variational_decoder and",
        "  variational_ae, verbatim, including `class Sampling(tf.keras.Layer)` (tf.keras.Layer",
        f"  exists in Keras 3 and is tf.keras.layers.Layer: {meta['tfKerasLayerIsLayer']}) and the latent loss",
        "  added inside Sampling.call as self.add_loss(tf.reduce_mean(loss) / 784.). compile(",
        "  loss='mse', optimizer='nadam'), fit(..., epochs=25, batch_size=128, validation_data=",
        "  (X_valid, X_valid)). No fix to the slide's code was needed.",
        "codings_size = 10: slides 14-15 never define it; slide 16 says the codings are",
        "  10-dimensional (this page's choice).",
        f"Params: variational_encoder {p['variational_encoder']:,}, variational_decoder "
        f"{p['variational_decoder']:,}, variational_ae {p['variational_ae']:,}.",
        epochs_line(meta),
        device_line(meta),
        "add_loss check (this page's own): variational_ae.losses is empty after building and",
        "  holds exactly one value (the latent loss / 784) after a forward pass, and",
        "  compute_loss() = recon MSE + latent/784 to float precision, on X_valid[:256]: after",
        f"  compile, before fit {chk[0]['reconMse']:.5f} + {chk[0]['latentOver784']:.5f} = "
        f"{chk[0]['computeLoss']:.5f}; after training",
        f"  {after['reconMse']:.5f} + {after['latentOver784']:.5f} = {after['computeLoss']:.5f}."
        " So Keras's logged loss / val_loss",
        "  = reconstruction MSE + latent loss / 784, as slide 15's comment says.",
        "",
        "loss / valLoss: Keras's logged totals per epoch (4 significant figures).",
        "  validReconMse = reconstruction MSE alone over X_valid (sampled codings); validLatent =",
        "  latent loss / 784 over X_valid (mean over images).",
        f"items[i]: X_valid[i], i = 0..{N_ITEMS - 1} (same 12 as conv.js / denoise.js); mean = codings_mean",
        "  and logVar = codings_log_var from variational_encoder (gamma = log sigma^2), 5 s.f.",
        "decoder: variational_decoder's three Dense layers, int8-quantised for decoding in the",
        "  browser. Layer k maps h (length in) to relu_or_linear(h . W + b), W[i][j] = int8 at",
        "  byte i*out + j of base64 `w` (two's complement) times scale[j]; b and scale are 5 s.f.",
        "  The last layer is linear (no sigmoid); reshape its 784 outputs row-major to 28x28 and",
        "  clip to [0,1] for display. quantMaxAbsErr = max |Keras float decoder - this int8",
        "  decoder| over 100 N(0, I) codings, both clipped to [0,1] (pixel units, 1 = full range);",
        "  quantMeanAbsErr = the mean over those 78,400 pixels; quantMaxAbsErrWide = the max over",
        "  100 codings uniform in [-3, 3]. The codings were rounded to 5 s.f. first.",
        "check: three of those codings and Keras's own decoder output for them (uint8 images),",
        "  for testing the page's decoder.",
        "samples.slide16: slide 16's `tf.random.normal(shape=[3 * 7, codings_size])` run after",
        f"  tf.keras.utils.set_random_seed({SEED}) (the seed is this page's); samples.slide18: slide",
        "  18's `tf.random.set_seed(123)` then `tf.random.normal(shape=[2, codings_size])`, the",
        "  endpoints for np.linspace(codings[0], codings[1], 10). 5 s.f.",
    ])
    check_out = z["check_out"]
    return (
        "// Variational autoencoder on Fashion MNIST (slides 14-18): int8 decoder + codings.\n"
        + header(head) + "\n"
        + "export const VAE = {\n" + meta_block("vae")
        + f"  codingsSize: {meta['codingsSize']},\n"
        + f"  epochs: {meta['epochsRun']},\n"
        + f"  epochsSlide: {meta['epochsSlide']},\n"
        + f"  batchSize: {meta['batchSize']},\n"
        + f"  params: {{ variational_encoder: {p['variational_encoder']}, variational_decoder: "
          f"{p['variational_decoder']}, variational_ae: {p['variational_ae']} }},\n"
        + f"  device: '{meta['device']}',\n"
        + f"  loss: {js_nums(meta['loss'])},\n"
        + f"  valLoss: {js_nums(meta['valLoss'])},\n"
        + f"  validReconMse: {sig(meta['validReconMseSampled'])},\n"
        + f"  validLatent: {sig(meta['validLatentOver784'])},\n"
        + f"  addLossCheck: {{ batch: {after['batch']}, reconMse: {sig(after['reconMse'], 5)}, "
          f"latentOver784: {sig(after['latentOver784'], 5)}, computeLoss: {sig(after['computeLoss'], 5)} }},\n"
        + "  decoder: {\n    layers: [\n" + "".join(layer_txt) + "    ],\n"
        + "    outputShape: [28, 28],\n  },\n"
        + "  items: [\n" + "".join(items) + "  ],\n"
        + "  check: {\n"
        + f"    codings: {js_matrix(z['check_z'])},\n"
        + "    kerasOut: [\n" + "".join(f"      '{b64_u8(check_out[k])}',\n" for k in range(len(check_out)))
        + "    ],\n"
        + f"    quantMaxAbsErr: {sig(q['normal'])},\n"
        + f"    quantMeanAbsErr: {sig(q['normalMean'])},\n"
        + f"    quantMaxAbsErrWide: {sig(q['wide'])},\n"
        + "  },\n"
        + "  samples: {\n"
        + f"    slide16: {js_matrix(z['slide16'])},\n"
        + f"    slide18: {js_matrix(z['slide18'])},\n"
        + "  },\n"
        + "}\n"), nl


def export_gan(kind, D, cache, hashes, date):
    meta = json.loads((cache / f"{kind}.json").read_text())
    z = np.load(cache / f"{kind}.npz")
    snaps = z["snaps"]
    tt_path = cache / "trainable-test.json"
    tt = json.loads(tt_path.read_text())[kind] if tt_path.exists() else None
    E = meta["epochsRun"]
    mid = max(2, int(round(E / 2))) if E >= 3 else None
    first_n = N_FIXED_NOISE if kind == "gan" else 7
    plan = [(1, first_n)] + ([(mid, 7)] if mid and mid not in (1, E) else []) + ([(E, N_FIXED_NOISE)] if E > 1 else [])
    if E == 1:
        plan = [(1, N_FIXED_NOISE)]
    snap_txt = []
    for ep, n in plan:
        imgs = "".join(f"        '{b64_raw(snaps[ep - 1][k])}',\n" for k in range(n))
        snap_txt.append(f"    {{\n      epoch: {ep},\n      images: [\n{imgs}      ],\n    }},\n")
    p = meta["params"]

    def tt_js(v):
        rows = []
        for r in v["iterations"]:
            parts = []
            for ph in ("phase1", "phase2"):
                d = r[ph]
                extra = ""
                if "generatorMovingStats" in d:
                    extra += f", generatorMovingStats: {sig(d['generatorMovingStats'])}"
                if "discriminatorMovingStats" in d:
                    extra += f", discriminatorMovingStats: {sig(d['discriminatorMovingStats'])}"
                parts.append(f"{ph}: {{ generator: {sig(d['generator'])}, discriminator: "
                             f"{sig(d['discriminator'])}, discriminatorTrainable: "
                             f"{'true' if d['discriminatorTrainable'] else 'false'}{extra} }}")
            rows.append(f"        {{ iteration: {r['iteration']}, " + ", ".join(parts) + " },\n")
        warns = "".join(f"        {json.dumps(w)},\n" for w in v["warnings"])
        return ("{\n" + f"      description: {json.dumps(v['description'])},\n"
                + "      iterations: [\n" + "".join(rows) + "      ],\n"
                + "      warnings: [\n" + warns + "      ],\n    }")

    if kind == "gan":
        title = "// Slide 23-25's GAN on Fashion MNIST: training curve and generated images."
        model_lines = [
            "Model: slide 23's generator / discriminator / gan (codings_size = 30), verbatim;",
            "  slide 24's compile lines as printed (discriminator.compile(loss='binary_crossentropy',",
            "  optimizer='rmsprop') then gan.compile(...) with NO `discriminator.trainable = False`",
            "  between them) and tf.data pipeline; slide 25's train_gan with both '# ***' toggles.",
            f"  {meta['importNote']}.",
        ]
        rescale = None
        to01 = "Generator output is sigmoid, already [0,1]."
    else:
        title = "// Slide 29's DCGAN on Fashion MNIST: training curve and generated images."
        model_lines = [
            "Model: slide 29's generator / discriminator / gan (codings_size = 100), verbatim;",
            "  'compilation and training are similar to the code for GANs' (slide 29), so slide",
            "  24's compile lines as printed and slide 25's train_gan (with both '# ***' toggles)",
            "  are reused unchanged.",
        ]
        rescale = ("this page's own step (not on the slides; as in Geron's notebook): "
                   "X_train.reshape(-1, 28, 28, 1) * 2. - 1., i.e. [0,1] -> [-1,1] with a channel axis, "
                   "to match the tanh output and the Conv2D input")
        to01 = "Generator output is tanh: images map (x + 1) / 2 first."
    head = common_header(hashes, date, meta, model_lines + ([
        "Training images (this page's own step, not on the slides; as in Geron's notebook):",
        "  X_train.reshape(-1, 28, 28, 1) * 2. - 1., i.e. [0,1] -> [-1,1] with a channel axis,",
        "  to match the generator's tanh output and the discriminator's Conv2D input."]
        if rescale else []) + [
        f"Params: generator {p['generator']:,}, discriminator {p['discriminator']:,}, gan {p['gan']:,}.",
        epochs_line(meta),
        device_line(meta),
        "",
        "history: this page's own logging (not on the slides). train_on_batch returns the batch's",
        "  binary cross-entropy (Keras resets the loss metric each call). dLoss[e] = mean over",
        "  epoch e's batches of discriminator.train_on_batch (phase 1: 32 fakes labelled 0 + 32",
        "  reals labelled 1); gLoss[e] = mean of gan.train_on_batch (phase 2: 32 fakes labelled 1).",
        "  Each is computed on the forward pass before that step's update. 4 s.f.",
        f"snapshots: generator(fixed_noise, training=False) at the end of the listed epochs, where",
        "  slide 25 says '# extra code - plot images during training'. fixed_noise = ONE set of",
        f"  21 vectors from numpy.random.default_rng({SEED}).standard_normal((21, codingsSize)), the",
        "  same for every snapshot (images[k] is vector k). Rendering them uses no TF randomness.",
        "  " + to01,
    ] + IMAGE_CONVENTION + [
        "trainableTest: this page's own experiment on fresh seeded models, 2 iterations of the",
        "  train_gan body on the first batches (run on the CPU; the behaviour is device-",
        "  independent). Values = max |weight change| over each network's kernels, biases and",
        "  BN gamma/beta during each phase (0.00316 = one RMSprop first step, lr/sqrt(0.1));",
        "  discriminatorTrainable = the flag at that phase's train_on_batch call;",
        "  *MovingStats = BN moving mean/var. verbatim = the slides' code as printed;",
        "  withoutToggles = the slide loop minus the two '# ***' lines; geronOriginal = Geron's",
        "  book (discriminator.trainable = False between the two compile() calls, no toggles;",
        "  not on the slides); traceCheck = iteration 1 as the slide, iteration 2 with the flags",
        "  set the wrong way round. Keras 3.15.1 reads `trainable` when a model's train function",
        "  is first traced (its first train_on_batch) and keeps that function, so the flag at",
        "  the FIRST call decides for the whole run (traceCheck shows later flips do nothing).",
    ])
    tt_txt = ""
    if tt:
        tt_txt = ("  trainableTest: {\n"
                  + "".join(f"    {name}: {tt_js(v)},\n" for name, v in tt.items())
                  + "  },\n")
    const = "GAN" if kind == "gan" else "DCGAN"
    return (
        title + "\n" + header(head) + "\n"
        + f"export const {const} = {{\n"
        + "  width: 28,\n  height: 28,\n  encoding: 'base64-uint8',\n"
        + f"  codingsSize: {meta['codingsSize']},\n"
        + f"  batchSize: {meta['batchSize']},\n"
        + f"  batchesPerEpoch: {meta['batchesPerEpoch']},\n"
        + f"  epochsSlide: {meta['epochsSlide']},\n"
        + f"  epochsRun: {E},\n"
        + (f"  rescaled: {json.dumps(rescale)},\n" if rescale else "")
        + f"  params: {{ generator: {p['generator']}, discriminator: {p['discriminator']}, gan: {p['gan']} }},\n"
        + f"  device: '{meta['device']}',\n"
        + tt_txt
        + "  history: {\n"
        + "    metric: 'binary_crossentropy, per-epoch mean of train_on_batch return values (page log)',\n"
        + f"    dLoss: {js_nums(meta['dLoss'])},\n"
        + f"    gLoss: {js_nums(meta['gLoss'])},\n"
        + "  },\n"
        + "  snapshots: [\n" + "".join(snap_txt) + "  ],\n"
        + "}\n")


def run_export(D, cache, out, date):
    out.mkdir(parents=True, exist_ok=True)
    hashes = D["hashes"]
    jobs = [("conv.js", "conv", lambda: export_conv(D, cache, hashes, date)),
            ("denoise.js", "dropout", lambda: export_denoise(D, cache, hashes, date)),
            ("vae.js", "vae", lambda: export_vae(D, cache, hashes, date)[0]),
            ("gan.js", "gan", lambda: export_gan("gan", D, cache, hashes, date)),
            ("dcgan.js", "dcgan", lambda: export_gan("dcgan", D, cache, hashes, date))]
    total = 0
    for fname, key, fn in jobs:
        if not (cache / f"{key}.json").exists():
            print(f"skip {fname}: no cache for {key}")
            continue
        path = out / fname
        path.write_text(fn(), encoding="utf-8", newline="\n")
        size = path.stat().st_size
        total += size
        print(f"wrote {path}  {size:,} bytes")
    print(f"total {total:,} bytes")


# ---------------------------------------------------------------- main -----
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[1])
    ap.add_argument("--data-dir", type=Path)
    ap.add_argument("--cache", type=Path)
    ap.add_argument("--model", choices=["conv", "dropout", "vae", "gan", "dcgan", "trainable-test"])
    ap.add_argument("--epochs", type=int)
    ap.add_argument("--probe-batches", type=int, default=0)
    ap.add_argument("--no-determinism", action="store_true")
    ap.add_argument("--gate-only", action="store_true")
    ap.add_argument("--counts", type=Path)
    ap.add_argument("--export", action="store_true")
    ap.add_argument("--out", type=Path)
    ap.add_argument("--date", default=dt.date.today().isoformat())
    args = ap.parse_args()

    print(versions_label(), "|", device_label())
    determinism = not args.no_determinism
    if determinism:
        tf.config.experimental.enable_op_determinism()

    if args.gate_only:
        tf.keras.utils.set_random_seed(SEED)
        enc, dec, ae = build_conv()
        ae.build((None, 28, 28))
        gate(dec, ae)
        for n, m in (("conv_encoder", enc), ("conv_decoder", dec), ("conv_ae", ae)):
            print_table(n, m)
        return
    if args.counts:
        run_counts(args.counts, args.date)
        return
    if not args.data_dir or not args.cache:
        sys.exit("--data-dir and --cache are required")
    D = load_split(args.data_dir)
    if args.export:
        if not args.out:
            sys.exit("--export needs --out")
        run_export(D, args.cache, args.out, args.date)
        return
    if not args.model:
        sys.exit("nothing to do: pass --model, --counts, --gate-only or --export")
    args.cache.mkdir(parents=True, exist_ok=True)
    epochs = args.epochs or SLIDE_EPOCHS.get(args.model)
    t0 = time.time()
    if args.model == "conv":
        run_conv(D, args.cache, epochs, determinism)
    elif args.model == "dropout":
        run_dropout(D, args.cache, epochs, determinism)
    elif args.model == "vae":
        run_vae(D, args.cache, epochs, determinism)
    elif args.model in ("gan", "dcgan"):
        run_gan(args.model, D, args.cache, epochs, determinism, args.probe_batches)
    elif args.model == "trainable-test":
        run_trainable_test(D, args.cache, determinism)
    print(f"step wall time {time.time() - t0:.0f}s")


if __name__ == "__main__":
    main()
