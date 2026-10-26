"""
DL EXAM PRACTICE — verify every parameter count and output shape the papers state
---------------------------------------------------------------------------------
Builds (never trains) each Keras model that appears in a question or a model
answer of the sample paper and practice papers A, B and C, and asserts the
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

# ── Practice C Q1(a): one Perceptron update (L1 slide 10) ────────────────────
w, b, x, y, eta = np.array([0.5, -0.4]), -0.1, np.array([1.0, 2.0]), 1, 0.5
z = float(w @ x + b)
y_hat = int(z >= 0)
check("C Q1(a)i z and output", (round(z, 4), y_hat), (-0.4, 0))
w2, b2 = w + eta * (y - y_hat) * x, b + eta * (y - y_hat)
check("C Q1(a)ii new w1, w2, b", (round(w2[0], 4), round(w2[1], 4), round(b2, 4)), (1.0, 0.6, 0.4))
check("C Q1(a)ii new z", round(float(w2 @ x + b2), 4), 2.6)

# ── Practice C Q1(b): Glorot and He (L2 slides 7–8), 200 inputs, 100 neurons ─
fan_in, fan_out = 200, 100
fan_avg = (fan_in + fan_out) / 2
check("C Q1(b)i Glorot variance 1/fan_avg", round(1 / fan_avg, 5), 0.00667)
check("C Q1(b)i Glorot uniform r = sqrt(3/fan_avg)", round(float(np.sqrt(3 / fan_avg)), 4), 0.1414)
check("C Q1(b)ii He variance 2/fan_in and sigma", (2 / fan_in, round(float(np.sqrt(2 / fan_in)), 4)), (0.01, 0.1))
he = tf.keras.initializers.VarianceScaling(scale=2.0, mode="fan_in", distribution="untruncated_normal", seed=0)
check("C Q1(b)ii he_normal-style sample std ≈ 0.1", round(float(np.std(he((200, 100)))), 2), 0.1)

# ── Practice C Q1(c): multi-input, multi-output Wide & Deep (L1 slides 46–47) ─
input_wide = tf.keras.layers.Input(shape=[5])
input_deep = tf.keras.layers.Input(shape=[6])
nw, nd = tf.keras.layers.Normalization(), tf.keras.layers.Normalization()
norm_wide, norm_deep = nw(input_wide), nd(input_deep)
h1 = tf.keras.layers.Dense(20, activation="relu")
h2 = tf.keras.layers.Dense(10, activation="relu")
hidden1 = h1(norm_deep)
hidden2 = h2(hidden1)
concat = tf.keras.layers.concatenate([norm_wide, hidden2])
o_main, o_aux = tf.keras.layers.Dense(1), tf.keras.layers.Dense(1)
output, aux_output = o_main(concat), o_aux(hidden2)
wd = tf.keras.Model(inputs=[input_wide, input_deep], outputs=[output, aux_output])
check("C Q1(c) Normalization wide / deep (trainable, non-trainable)", (counts(nw), counts(nd)), ((0, 11), (0, 13)))
check("C Q1(c) Dense(20), Dense(10), output, aux_output", [counts(l)[0] for l in (h1, h2, o_main, o_aux)], [140, 210, 16, 11])
check("C Q1(c) concat shape", shape(concat), (None, 15))
check("C Q1(c) total trainable / non-trainable", counts(wd), (377, 24))

# ── Practice C Q1(d): learning-rate schedules (L2 slides 50–53) ──────────────
power = tf.keras.optimizers.schedules.InverseTimeDecay(initial_learning_rate=0.01, decay_steps=10_000, decay_rate=1.0)
expo = tf.keras.optimizers.schedules.ExponentialDecay(initial_learning_rate=0.01, decay_steps=20_000, decay_rate=0.1)
check("C Q1(d) power scheduling at t = 30,000", round(float(power(30_000)), 6), 0.0025)
check("C Q1(d) exponential scheduling at t = 40,000", round(float(expo(40_000)), 6), 0.0001)
check("C Q1(d) exponential scheduling at t = 10,000", round(float(expo(10_000)), 6), 0.003162)

# ── Practice C Q1(e) i.: one 5x5 vs two 3x3 conv layers, 64 -> 64 maps ───────
c5 = tf.keras.Sequential([tf.keras.Input(shape=[32, 32, 64]), tf.keras.layers.Conv2D(64, 5, padding="same")])
c33 = tf.keras.Sequential([tf.keras.Input(shape=[32, 32, 64]), tf.keras.layers.Conv2D(64, 3, padding="same"), tf.keras.layers.Conv2D(64, 3, padding="same")])
check("C Q1(e)i one 5x5 layer params", counts(c5)[0], 102464)
check("C Q1(e)i two 3x3 layers params", counts(c33)[0], 73856)
check("C Q1(e)i output shapes equal", (out_shape(c5, [32, 32, 64]), out_shape(c33, [32, 32, 64])), ((None, 32, 32, 64), (None, 32, 32, 64)))

# ── Practice C Q2(b): ahead_model, 56 days x 5 features -> 14 days (L4 slide 38) ─
ahead = tf.keras.Sequential([tf.keras.layers.InputLayer(shape=[None, 5]), tf.keras.layers.SimpleRNN(32), tf.keras.layers.Dense(14)])
check("C Q2(b) SimpleRNN(32), Dense(14) params", [counts(l)[0] for l in ahead.layers], [1216, 462])
check("C Q2(b) total", counts(ahead)[0], 1678)
check("C Q2(b) output for a (32, 56, 5) batch", tuple(ahead(np.zeros((32, 56, 5), "float32")).shape), (32, 14))

# ── Practice C Q2(c): inception module on 32x32x192 ──────────────────────────
inc_in = tf.keras.Input(shape=[32, 32, 192])
C = lambda f, k: tf.keras.layers.Conv2D(f, k, padding="same", activation="relu")
br1 = C(64, 1)(inc_in)
br2 = C(128, 3)(C(96, 1)(inc_in))
br3 = C(32, 5)(C(16, 1)(inc_in))
br4 = C(32, 1)(tf.keras.layers.MaxPool2D(3, strides=1, padding="same")(inc_in))
inc_out = tf.keras.layers.Concatenate(axis=3)([br1, br2, br3, br4])
check("C Q2(c) inception output shape", shape(inc_out), (None, 32, 32, 256))

# ── Practice C Q2(d): deep RNN (L4 slide 29), 2 features, batch of 32 × 56 days ─
deep = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 2]),
    tf.keras.layers.SimpleRNN(32, return_sequences=True),
    tf.keras.layers.SimpleRNN(32, return_sequences=True),
    tf.keras.layers.SimpleRNN(32),
    tf.keras.layers.Dense(1),
])
x = tf.zeros([32, 56, 2])
shapes = []
for layer in deep.layers:
    x = layer(x)
    shapes.append(tuple(x.shape))
check("C Q2(d) deep RNN layer outputs", shapes, [(32, 56, 32), (32, 56, 32), (32, 32), (32, 1)])

# ── Practice C Q3(a): one autoencoder at a time (L5 slide 24) ────────────────
enc2 = tf.keras.layers.Dense(30, activation="relu")
dec2 = tf.keras.layers.Dense(100, activation="relu")
ae2 = tf.keras.Sequential([tf.keras.Input(shape=[100]), enc2, dec2])
check("C Q3(a) enc2 / dec2 params", (counts(enc2)[0], counts(dec2)[0]), (3030, 3100))
enc1 = tf.keras.layers.Dense(100, activation="relu")
dec1 = tf.keras.layers.Dense(784)
stacked_ae = tf.keras.Sequential([tf.keras.layers.Flatten(), enc1, enc2, dec2, dec1, tf.keras.layers.Reshape([28, 28])])
check("C Q3(a) stacked_ae input -> output for 32 images", tuple(stacked_ae(tf.zeros([32, 28, 28])).shape), (32, 28, 28))

# ── Practice C Q3(b): GAN phase-1 batch (L6–7 slide 25) ──────────────────────
batch_size = 32
gen_imgs, X_batch = tf.zeros([batch_size, 28, 28]), tf.ones([batch_size, 28, 28])
X_fake_and_real = tf.concat([gen_imgs, X_batch], axis=0)
y1 = tf.constant([[0.]] * batch_size + [[1.]] * batch_size)
check("C Q3(b) X_fake_and_real and y1 shapes", (tuple(X_fake_and_real.shape), tuple(y1.shape)), ((64, 28, 28), (64, 1)))
check("C Q3(b) y1 = 32 zeros then 32 ones", (float(tf.reduce_sum(y1[:32])), float(tf.reduce_sum(y1[32:]))), (0.0, 32.0))

# ── Practice C Q3(e): sine/cosine positional encodings, d = 4, p = 1 ─────────
# the question uses slide 32's base, 1000; the slip quotes slide 35's 10 000
d, p = 4, 1
P = [np.sin(p / 1000 ** (i / d)) if i % 2 == 0 else np.cos(p / 1000 ** ((i - 1) / d)) for i in range(d)]
check("C Q3(e)ii P[1, 0..3] with base 1000", [round(float(v), 4) for v in P], [0.8415, 0.5403, 0.0316, 0.9995])
P10k = [np.sin(p / 10_000 ** (i / d)) if i % 2 == 0 else np.cos(p / 10_000 ** ((i - 1) / d)) for i in range(d)]
check("C Q3(e)ii slip: P[1, 2..3] with base 10 000", [round(float(v), 4) for v in P10k[2:]], [0.01, 1.0])
emb = tf.zeros([32, 10, 512])
pos = tf.zeros([1, 10, 512])
check("C Q3(e)i embeddings + positional encodings shape", tuple((emb + pos).shape), (32, 10, 512))
check("C Q4(b) 512 columns over 8 heads; concatenated", (512 // 8, 8 * (512 // 8)), (64, 512))
P0 = [np.sin(0) if i % 2 == 0 else np.cos(0) for i in range(d)]
check("C Q3(e) P[0, 0..3]", [float(v) for v in P0], [0.0, 1.0, 0.0, 1.0])

# ── Practice C Q4(a): bus/rail encoder–decoder (L8 slide 14) ─────────────────
encoder_inputs = tf.keras.Input(shape=[None, 2])
bi = tf.keras.layers.Bidirectional(tf.keras.layers.SimpleRNN(16, return_state=True))
encoder_outputs, *encoder_state = bi(encoder_inputs)
encoder_state = tf.keras.layers.Concatenate(axis=-1)(encoder_state)
decoder_inputs = tf.keras.Input(shape=[None, 2])
dec = tf.keras.layers.SimpleRNN(32, return_sequences=True)
decoder_outputs = dec(decoder_inputs, initial_state=encoder_state)
dense2 = tf.keras.layers.Dense(2)
outputs = dense2(decoder_outputs)
rnn_ed = tf.keras.Model(inputs=[encoder_inputs, decoder_inputs], outputs=outputs)
check("C Q4(a) encoder_state shape", shape(encoder_state), (None, 32))
check("C Q4(a) Bidirectional(SimpleRNN(16)), SimpleRNN(32), Dense(2) params", [counts(bi)[0], counts(dec)[0], counts(dense2)[0]], [608, 1120, 66])
check("C Q4(a) total", counts(rnn_ed)[0], 1794)
check("C Q4(a) output shape for 14 decoder steps", tuple(rnn_ed([np.zeros((3, 55, 2), "float32"), np.zeros((3, 14, 2), "float32")]).shape), (3, 14, 2))

# ── Practice C Q4(d): one TD-learning update (L9 slide 51) ───────────────────
alpha, gamma, r, V_s, V_next = 0.1, 0.9, 2, 4, 10
target = r + gamma * V_next
check("C Q4(d) TD target, TD error, new V(s)", (round(target, 4), round(target - V_s, 4), round(V_s + alpha * (target - V_s), 4)), (11.0, 7.0, 4.7))
check("C Q4(d) the (1 − α) form agrees", round((1 - alpha) * V_s + alpha * target, 4), 4.7)

# ── Practice C Q4(e): Q-value iteration, two iterations (L9 slides 46–48) ────
T = [[[0.5, 0.5], [1.0, 0.0]], [[0.0, 1.0], [0.6, 0.4]]]
R = [[[0, 10], [2, 0]], [[0, 0], [20, -10]]]
Q = np.zeros((2, 2))
hist = []
for _ in range(2):
    Qp = Q.copy()
    for s in range(2):
        for a in range(2):
            Q[s, a] = sum(T[s][a][sp] * (R[s][a][sp] + 0.9 * Qp[sp].max()) for sp in range(2))
    hist.append(Q.copy())
check("C Q4(e)i Q1", np.round(hist[0], 4).tolist(), [[5.0, 2.0], [0.0, 8.0]])
check("C Q4(e)ii Q2", np.round(hist[1], 4).tolist(), [[10.85, 6.5], [7.2, 13.58]])
check("C Q4(e)ii greedy actions after 2 iterations", np.argmax(hist[1], axis=1).tolist(), [0, 1])

print()
print(f"{'ALL OK' if not FAILS else f'{len(FAILS)} FAILED'}")
sys.exit(1 if FAILS else 0)
