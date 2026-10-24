"""
DL EXAM PRACTICE — verify every parameter count and output shape the papers state
---------------------------------------------------------------------------------
Builds (never trains) each Keras model that appears in a question or a model
answer of the sample paper and practice papers A and B, and asserts the
trainable / non-trainable parameter counts and output shapes the answers give.

Run it in the unit's read-only TensorFlow environment (WSL distro Ubuntu, conda
env tf-2.20-gpu; see cits5017-project-two/documents/ENVIRONMENT_SETUP.md), on
the CPU, from Git Bash:

  MSYS_NO_PATHCONV=1 wsl.exe -d Ubuntu --cd "<repo>/tools/dl-exam-practice" \
    -e env CUDA_VISIBLE_DEVICES=-1 TF_CPP_MIN_LOG_LEVEL=2 \
    /home/james/miniconda3/envs/tf-2.20-gpu/bin/python verify_counts.py

Prints one line per check (OK / FAIL) and exits 1 if any check fails.
"""
import sys

import numpy as np
import tensorflow as tf

FAILS = []


def check(label, got, want):
    ok = got == want
    print(f"{'OK  ' if ok else 'FAIL'} {label}: {got}" + ("" if ok else f" (answer says {want})"))
    if not ok:
        FAILS.append(label)


def counts(layer_or_model):
    tr = int(sum(np.prod(w.shape) for w in layer_or_model.trainable_weights))
    nt = int(sum(np.prod(w.shape) for w in layer_or_model.non_trainable_weights))
    return tr, nt


def shape(t):
    return tuple(None if d is None else int(d) for d in t.shape)


def out_shape(model, in_shape):
    """Output shape of a model for one dummy instance, batch shown as None."""
    y = model(np.zeros((1, *in_shape), dtype="float32"))
    return (None, *(int(d) for d in y.shape[1:]))


print(f"TensorFlow {tf.__version__} · Keras {tf.keras.__version__ if hasattr(tf.keras, '__version__') else '?'}")

# ── Sample paper Q1(c): Wide & Deep with one hidden layer ─────────────────────
normalization_layer = tf.keras.layers.Normalization()
hidden_layer = tf.keras.layers.Dense(20, activation="gelu")
concat_layer = tf.keras.layers.Concatenate()
output_layer = tf.keras.layers.Dense(3, activation="softmax")
input_ = tf.keras.layers.Input(shape=[10])
normalized = normalization_layer(input_)
hidden = hidden_layer(normalized)
concat = concat_layer([normalized, hidden])
output = output_layer(concat)
model = tf.keras.Model(inputs=[input_], outputs=[output])
check("sample Q1(c) Normalization trainable/non-trainable", counts(normalization_layer), (0, 21))
check("sample Q1(c) Dense(20) params", counts(hidden_layer), (220, 0))
check("sample Q1(c) Concatenate params", counts(concat_layer), (0, 0))
check("sample Q1(c) Concatenate output", shape(concat), (None, 30))
check("sample Q1(c) Dense(3) params", counts(output_layer), (93, 0))
check("sample Q1(c) total trainable/non-trainable", counts(model), (313, 21))
check("sample Q1(c) output shape", shape(output), (None, 3))

# ── Sample paper Q2(a) iii.: first 3 corners in, last 2 corners out ──────────
star = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[3, 2]),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(4),
])
check("sample Q2(a)iii SimpleRNN(32)+Dense(4) output", out_shape(star, [3, 2]), (None, 4))

# ── Practice A Q1(c): small CNN ──────────────────────────────────────────────
cnn = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[32, 32, 3]),
    tf.keras.layers.Conv2D(16, kernel_size=3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),
    tf.keras.layers.Conv2D(32, kernel_size=3, padding="same", activation="relu"),
    tf.keras.layers.MaxPool2D(pool_size=2),
    tf.keras.layers.GlobalAveragePooling2D(),
    tf.keras.layers.Dense(10, activation="softmax"),
])
want = [((None, 32, 32, 16), 448), ((None, 16, 16, 16), 0), ((None, 16, 16, 32), 4640),
        ((None, 8, 8, 32), 0), ((None, 32), 0), ((None, 10), 330)]
x = cnn.inputs[0]
for layer, (wshape, wparams) in zip(cnn.layers, want):
    x = layer(x)
    check(f"A Q1(c) {layer.__class__.__name__} shape/params", (shape(x), counts(layer)[0]), (wshape, wparams))
check("A Q1(c) total params", counts(cnn), (5418, 0))
flat = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[8, 8, 32]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(10, activation="softmax"),
])
check("A Q1(c) Flatten variant: Flatten output", out_shape(tf.keras.Sequential([tf.keras.layers.Flatten()]), [8, 8, 32]), (None, 2048))
check("A Q1(c) Flatten variant: output-layer params", counts(flat.layers[1])[0], 20490)

# ── Practice A Q2(a): memory cell, 3 inputs, 6 neurons, 1 output ─────────────
cell = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 3]),
    tf.keras.layers.SimpleRNN(6),
    tf.keras.layers.Dense(1),
])
check("A Q2(a)ii SimpleRNN(6) on 3 inputs (Wx 3x6 + Wh 6x6 + bh 6)", counts(cell.layers[0])[0], 60)
check("A Q2(a)ii output layer (Wy 6x1 + by 1)", counts(cell.layers[1])[0], 7)
check("A Q2(a)ii total", counts(cell)[0], 67)

# ── Practice A Q2(c): SimpleRNN(1) and the fix ───────────────────────────────
rnn1 = tf.keras.Sequential([tf.keras.layers.InputLayer(shape=[None, 1]), tf.keras.layers.SimpleRNN(1)])
check("A Q2(c) SimpleRNN(1) params", counts(rnn1)[0], 3)
check("A Q2(c) SimpleRNN(1) default activation", rnn1.layers[0].activation.__name__, "tanh")
fix = tf.keras.Sequential([tf.keras.layers.InputLayer(shape=[None, 1]), tf.keras.layers.SimpleRNN(32), tf.keras.layers.Dense(1)])
check("A Q2(c) fixed model params", counts(fix)[0], 1121)


# ── Practice A Q2(d): tied vs untied stacked autoencoder (L5 slides 12, 18–21) ─
# The slide's DenseTranspose reads the tied layer's input size from
# self.dense.input.shape[-1]; the kernel's first dimension is the same number.
class DenseTranspose(tf.keras.layers.Layer):
    def __init__(self, dense, activation=None, **kwargs):
        super().__init__(**kwargs)
        self.dense = dense
        self.activation = tf.keras.activations.get(activation)

    def build(self, batch_input_shape):
        self.biases = self.add_weight(name="bias", shape=[self.dense.kernel.shape[0]], initializer="zeros")
        super().build(batch_input_shape)

    def call(self, inputs):
        z = tf.matmul(inputs, self.dense.kernel, transpose_b=True)
        return self.activation(z + self.biases)


def tied_and_untied(n1, n2):
    d1 = tf.keras.layers.Dense(n1, activation="relu")
    d2 = tf.keras.layers.Dense(n2, activation="relu")
    enc = tf.keras.Sequential([tf.keras.layers.InputLayer(shape=[28, 28]), tf.keras.layers.Flatten(), d1, d2])
    dec = tf.keras.Sequential([DenseTranspose(d2, activation="relu"), DenseTranspose(d1), tf.keras.layers.Reshape([28, 28])])
    tied = tf.keras.Sequential([enc, dec])
    tied(np.zeros((1, 28, 28), dtype="float32"))
    untied = tf.keras.Sequential([
        tf.keras.layers.InputLayer(shape=[28, 28]), tf.keras.layers.Flatten(),
        tf.keras.layers.Dense(n1, activation="relu"), tf.keras.layers.Dense(n2, activation="relu"),
        tf.keras.layers.Dense(n1, activation="relu"), tf.keras.layers.Dense(28 * 28), tf.keras.layers.Reshape([28, 28]),
    ])
    return counts(tied)[0], counts(untied)[0]


check("L5 slides 12, 21: 784-100-30 stacked AE untied / tied", tied_and_untied(100, 30)[::-1], (163814, 82414))
tied, untied = tied_and_untied(256, 64)
check("A Q2(d) tied AE 784-256-64-256-784: parameters to learn", tied, 218448)
check("A Q2(d) the same AE untied", untied, 435536)

# ── Practice A Q3(a): small GAN ──────────────────────────────────────────────
codings_size = 20
generator = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[codings_size]),
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.Dense(28 * 28, activation="sigmoid"),
    tf.keras.layers.Reshape([28, 28]),
])
discriminator = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(64, activation="relu"),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])
gan = tf.keras.Sequential([generator, discriminator])
check("A Q3(a) generator params", counts(generator)[0], 52304)
check("A Q3(a) generator output", out_shape(generator, [codings_size]), (None, 28, 28))
check("A Q3(a) discriminator params", counts(discriminator)[0], 50305)
check("A Q3(a) discriminator output", out_shape(discriminator, [28, 28]), (None, 1))
check("A Q3(a) gan output", shape(gan(np.zeros((1, codings_size), dtype="float32"))), (1, 1))

# ── Practice A Q4(e): CartPole policy network (L9 slide 25) ──────────────────
policy = tf.keras.models.Sequential([
    tf.keras.layers.Dense(5, activation="relu", input_shape=[4]),
    tf.keras.layers.Dense(1, activation="sigmoid"),
])
check("A Q4(e) policy hidden params", counts(policy.layers[0])[0], 25)
check("A Q4(e) policy output params", counts(policy.layers[1])[0], 6)
check("A Q4(e) policy total", counts(policy)[0], 31)

# ── Practice B Q1(c): one conv layer on 224 x 224 RGB ────────────────────────
conv = tf.keras.layers.Conv2D(64, kernel_size=3, strides=1, padding="same")
out = conv(np.zeros((1, 224, 224, 3), dtype="float32"))
check("B Q1(c)i Conv2D(64, 3x3) params", counts(conv)[0], 1792)
check("B Q1(c)ii output feature maps", shape(out), (1, 224, 224, 64))
check("B Q1(c)ii multiplications (224*224*64 neurons x 27 inputs)", 224 * 224 * 64 * 27, 86704128)
check("B Q1(c)ii feature-map bytes (32-bit floats)", int(np.prod(out.shape)) * 4, 12845056)

# ── Practice B Q2(b): Conv1D + LSTM ──────────────────────────────────────────
seq = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[30, 2]),
    tf.keras.layers.Conv1D(filters=8, kernel_size=3, activation="relu"),
    tf.keras.layers.LSTM(16),
    tf.keras.layers.Dense(1),
])
x = seq.inputs[0]
for layer, (wshape, wparams) in zip(seq.layers, [((None, 28, 8), 56), ((None, 16), 1600), ((None, 1), 17)]):
    x = layer(x)
    check(f"B Q2(b) {layer.__class__.__name__} shape/params", (shape(x), counts(layer)[0]), (wshape, wparams))
check("B Q2(b) total params", counts(seq)[0], 1673)
lstm12 = tf.keras.Sequential([tf.keras.layers.InputLayer(shape=[None, 1]), tf.keras.layers.LSTM(12), tf.keras.layers.Dense(1)])
check("L4 slide 43 LSTM(12)+Dense(1) (the 4(n_in*n + n^2 + n) rule)", counts(lstm12)[0], 685)

# ── Practice B Q2(e): undercomplete linear autoencoder (L5 slide 8) ──────────
encoder = tf.keras.models.Sequential([tf.keras.layers.Dense(2)])
decoder = tf.keras.models.Sequential([tf.keras.layers.Dense(3)])
autoencoder = tf.keras.Sequential([encoder, decoder])
X_train = np.random.default_rng(0).normal(size=(60, 3)).astype("float32")
autoencoder(X_train[:1])
check("B Q2(e) codings shape", tuple(encoder.predict(X_train, verbose=0).shape), (60, 2))
check("B Q2(e) linear AE params (Dense(2) 8 + Dense(3) 9)", counts(autoencoder)[0], 17)

# ── Practice B Q3(b): DCGAN generator (L6–7 slide 29) ────────────────────────
dcgan_gen = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[100]),
    tf.keras.layers.Dense(7 * 7 * 128),
    tf.keras.layers.Reshape([7, 7, 128]),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2, padding="same", activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2, padding="same", activation="tanh"),
])
x = dcgan_gen.inputs[0]
for layer, wshape in zip(dcgan_gen.layers, [(None, 6272), (None, 7, 7, 128), (None, 7, 7, 128), (None, 14, 14, 64), (None, 14, 14, 64), (None, 28, 28, 1)]):
    x = layer(x)
    check(f"B Q3(b) {layer.__class__.__name__} output", shape(x), wshape)

# ── Practice B Q4(d): DQN (L9 slide 61) ──────────────────────────────────────
dqn = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation="elu", input_shape=[4]),
    tf.keras.layers.Dense(32, activation="elu"),
    tf.keras.layers.Dense(2),
])
check("B Q4(d) DQN layer params", [counts(l)[0] for l in dqn.layers], [160, 1056, 66])
check("B Q4(d) DQN total", counts(dqn)[0], 1282)
check("B Q4(d) target 1 + 0.95 * max(3.0, 5.0)", round(1 + 0.95 * max(3.0, 5.0), 4), 5.75)

print()
print(f"{'ALL OK' if not FAILS else f'{len(FAILS)} FAILED'}")
sys.exit(1 if FAILS else 0)
