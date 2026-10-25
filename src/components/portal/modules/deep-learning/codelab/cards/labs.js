// Code Lab cards: tab 1 · Labs & Projects (Lab Sheets 2–4, Projects 1 and 2).
// Lab cards are reconstructed from the sheets (no official solutions exist);
// Lab 2's card is Géron's notebook code; project cards are verbatim from my
// notebooks, trimmed with '# …' at every gap. Panels: ../labsProjects.js.
export const LABS = [
  {
    id: 'lab2-lr-search',
    title: 'Lab 2 · Finding the learning rate (MNIST MLP)',
    rating: 'useful',
    why: 'Lab 2 Task 3: explain how growing the learning rate each batch finds a good one, and what the plot tells you.',
    sources: [{ kind: 'lab', n: 2, task: 3 }, { kind: 'geron', ch: 10, sec: 'Exercise 10' }],
    provenance: 'geron',
    nb: 'g10',
    inv: ['lab2-t3-mnist-lr-search'],
    file: 'exercise10.py',
    code: `class ExponentialLearningRate(tf.keras.callbacks.Callback):
    def __init__(self, factor):
        self.factor = factor
        self.rates = []
        self.losses = []

    def on_batch_end(self, batch, logs=None):
        lr = self.model.optimizer.learning_rate.numpy() * self.factor
        self.model.optimizer.learning_rate = lr
        self.rates.append(lr)
        self.losses.append(logs["loss"])
# …
expon_lr = ExponentialLearningRate(factor=1.005)
history = model.fit(X_train, y_train, epochs=1,
                    validation_data=(X_valid, y_valid),
                    callbacks=[expon_lr])`,
    marks: [
      { n: 1, token: { line: 7, text: 'on_batch_end' }, say: 'Runs after every batch (iteration), not every epoch, so the rate changes at each step.' },
      { n: 2, token: { line: 8, text: '* self.factor' }, say: 'Multiplies the rate by 1.005 per batch: exponential growth, starting from SGD at 1e-3.' },
      { n: 3, lines: [10, 11], say: 'Records each (learning rate, loss) pair, to plot loss against learning rate.' },
      { n: 4, token: { line: 14, text: 'epochs=1' }, say: 'One epoch of 1,719 batches takes the rate from 1e-3 to about 5.' },
    ],
    moves: {
      say: 'Plot loss against learning rate (log axis). Géron sees the loss shoot up above 6e-1 and retrains at half that, 3e-1, with early stopping and a checkpoint.',
      forWhat: 'Choosing a learning rate from one short run, before training the 300-100-10 MLP properly.',
    },
    slideCheck: 'The saved run ends at test accuracy 0.9799, just under the 98% the sheet asks for (the notebook says "over 98%").',
    xref: [{ to: 'fashion-mlp', text: 'The same 300-100-10 MLP' }],
  },
  {
    id: 'lab3-wine',
    title: 'Lab 3 · Wine classifier (13 features, 3 classes)',
    rating: 'core',
    why: 'Shapes, loss and output layer for a tabular classifier, plus the sheet’s two traps: class IDs must start at 0, and predict() returns probabilities.',
    sources: [{ kind: 'lab', n: 3, task: 1 }],
    provenance: 'reconstructed',
    inv: ['lab3-t1-wine-mlp', 'l1-predict-argmax'],
    file: 'lab3_task1.py',
    code: `y = wine["class"].to_numpy() - 1  # class IDs 1, 2, 3 -> 0, 1, 2
X_train, X_valid, y_train, y_valid = train_test_split(X, y, test_size=0.2)
norm_layer = tf.keras.layers.Normalization()
norm_layer.adapt(X_train)
model1 = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[13]),
    norm_layer,
    tf.keras.layers.Dense(5, activation="gelu"),
    tf.keras.layers.Dense(5, activation="gelu"),
    tf.keras.layers.Dense(5, activation="gelu"),
    tf.keras.layers.Dense(3, activation="softmax")])
model1.compile(loss="sparse_categorical_crossentropy", optimizer="nadam",
               metrics=["accuracy"])
history = model1.fit(X_train, y_train, epochs=500, verbose=0, callbacks=[early_stopping_cb],
                     validation_data=(X_valid, y_valid))
y_pred = np.argmax(model1.predict(X_valid), axis=1)  # probabilities -> class IDs`,
    marks: [
      { n: 1, token: { line: 1, text: '- 1' }, say: 'Shifts the IDs to 0, 1, 2: sparse categorical cross-entropy needs labels 0 … K − 1.' },
      { n: 2, lines: [3, 4], say: 'Learns each feature’s mean and variance: the 13 attributes have very different magnitudes.' },
      { n: 3, token: { line: 11, text: 'Dense(3, activation="softmax")' }, say: 'Three class probabilities that sum to 1.' },
      { n: 4, token: { line: 16, text: 'np.argmax(' }, say: 'The sheet’s pitfall: Keras classifiers output probabilities, so take the argmax to get class IDs.' },
    ],
    moves: {
      draw: 'lab3Wine',
      count: 'lab3Wine',
      shapes: [
        { name: 'X', shape: '(n, 13)', means: 'one row per wine, 13 attributes' },
        { name: 'y', shape: '(n,)', means: 'class ID 0, 1 or 2 after the shift' },
        { name: 'model1.predict(X_valid)', shape: '(n_valid, 3)', means: 'a probability per class; argmax → (n_valid,)' },
      ],
      forWhat: 'Multiclass classification of tabular data: which of 3 classes a wine belongs to, from 13 measured attributes.',
    },
    slideCheck: 'The sheet fixes 3 hidden layers of 5 GELU units, an advanced optimizer, 500 epochs with early stopping and verbose=0; Nadam and the Normalization layer are this card’s choices. model2 adds a fourth Dense(5): +30 parameters.',
  },
  {
    id: 'lab4-clockwise',
    title: 'Lab 4 · Clockwise or anti-clockwise? (SimpleRNN classifier)',
    rating: 'core',
    why: 'Classify a sequence: give the shapes of X and y, the loss and the RNN set-up; contrast sample Q2(a), a regression (next card).',
    sources: [{ kind: 'lab', n: 4, task: 2 }],
    provenance: 'reconstructed',
    inv: ['lab4-task2-clockwise', 'lab4-load-data', 'l1-early-stopping'],
    file: 'lab4_task2.py',
    code: `X_train, y_train, X_val, y_val = load_data("noisy_squares.npy")

model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 2]),
    tf.keras.layers.SimpleRNN(16),
    tf.keras.layers.Dense(1, activation="sigmoid")
])
optimizer = tf.keras.optimizers.SGD(learning_rate=0.01, momentum=0.9)
model.compile(loss="binary_crossentropy", optimizer=optimizer,
              metrics=["accuracy"])
early_stopping_cb = tf.keras.callbacks.EarlyStopping(
    monitor="val_loss", patience=10, restore_best_weights=True)
history = model.fit(X_train, y_train, epochs=50,
                    validation_data=(X_val, y_val),
                    callbacks=[early_stopping_cb])`,
    marks: [
      { n: 1, token: { line: 1, text: 'load_data("noisy_squares.npy")' }, say: 'The sheet’s loader: four arrays, (200, 4, 2), (200,), (60, 4, 2), (60,).' },
      { n: 2, token: { line: 4, text: 'shape=[None, 2]' }, say: 'Any number of time steps (here 4 vertices), 2 coordinates per step.' },
      { n: 3, token: { line: 5, text: 'SimpleRNN(16)' }, say: '16 recurrent units; only the last step’s output goes on (sequence-to-vector).' },
      { n: 4, token: { line: 6, text: 'Dense(1, activation="sigmoid")' }, say: 'One probability, clockwise (1) or anti-clockwise (0): hence binary cross-entropy.' },
    ],
    moves: {
      draw: 'lab4Clockwise',
      count: 'lab4Clockwise',
      shapes: [
        { name: 'X_train', shape: '(200, 4, 2)', means: 'instances × time steps (vertices) × coordinates (x, y)' },
        { name: 'y_train', shape: '(200,)', means: 'one label per square: 1 clockwise, 0 anti-clockwise' },
        { name: 'X_val, y_val', shape: '(60, 4, 2), (60,)', means: '30 clockwise + 30 anti-clockwise' },
      ],
      forWhat: 'Binary classification of short sequences: was this 4-vertex shape drawn clockwise?',
    },
    slideCheck: 'The sheet fixes about 16 units, 50 epochs, early stopping on the validation loss and momentum with a learning rate near 0.01; momentum = 0.9, patience = 10 and the loss are this card’s choices. Its footnote: early stopping is probably not needed here.',
  },
  {
    id: 'lab4-next-vertex',
    title: 'Lab 4 · Predict the 4th vertex (SimpleRNN regressor)',
    rating: 'core',
    why: 'Sample Q2(a) i–ii in miniature (stars: X (N, 4, 2), y (N, 2)): X and y for a next-point target, and the loss.',
    sources: [{ kind: 'lab', n: 4, task: 3 }],
    provenance: 'reconstructed',
    inv: ['lab4-task3-fourth-vertex'],
    file: 'lab4_task3.py',
    code: `X_train, y_train, X_val, y_val = load_data("noisy_squares.npy")
X3_train, y3_train = X_train[:, :3, :], X_train[:, 3, :]  # (200, 3, 2) -> (200, 2)
X3_val, y3_val = X_val[:, :3, :], X_val[:, 3, :]

model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[None, 2]),
    tf.keras.layers.SimpleRNN(16),
    tf.keras.layers.Dense(2)
])
optimizer = tf.keras.optimizers.SGD(learning_rate=0.01, momentum=0.9)
model.compile(loss="mse", optimizer=optimizer)
history = model.fit(X3_train, y3_train, epochs=50,
                    validation_data=(X3_val, y3_val),
                    callbacks=[early_stopping_cb])`,
    marks: [
      { n: 1, token: { line: 2, text: 'X_train[:, :3, :]' }, say: 'The first three vertices: 3 time steps × 2 coordinates, (200, 3, 2).' },
      { n: 2, token: { line: 2, text: 'X_train[:, 3, :]' }, say: 'The target is the 4th vertex’s (x, y) (index 3), shape (200, 2); y_train isn’t used.' },
      { n: 3, token: { line: 8, text: 'Dense(2)' }, say: 'Two linear outputs, x and y: a regression head with no activation.' },
      { n: 4, token: { line: 11, text: 'loss="mse"' }, say: 'Real-valued coordinates, so a regression loss.' },
    ],
    moves: {
      draw: 'lab4NextVertex',
      count: 'lab4NextVertex',
      shapes: [
        { name: 'X3_train', shape: '(200, 3, 2)', means: 'instances × 3 time steps × (x, y)' },
        { name: 'y3_train', shape: '(200, 2)', means: 'the 4th vertex’s (x, y)' },
      ],
      say: 'Sample Q2(a) iii, the last two corners from the first three: X (N, 3, 2), y (N, 4) with Dense(4) and MSE; or loop this one-step model twice.',
      forWhat: 'Sequence-to-vector regression: predict the next point of a short sequence.',
    },
    slideCheck: 'The sheet gives the input X_train[:, :3, :] (200, 3, 2) and the output X_train[:, 3, :] (200, 2), about 16 units, 50 epochs, early stopping and momentum at 0.01. It names no loss: MSE is this card’s choice for a regression target.',
    xref: [{ to: 'forecast-ahead', text: 'Several steps at once in L4' }],
  },
  {
    id: 'p1-cnn',
    title: 'P1 · A CNN under 30,000 parameters',
    rating: 'core',
    why: 'Draw the four conv blocks, count each layer, and say why global average pooling (not Flatten) keeps it under the budget.',
    sources: [{ kind: 'project', n: 1, sec: '§2.1' }, { kind: 'project', n: 1, sec: '§2.4' }],
    provenance: 'notebook',
    nb: 'p1',
    inv: ['p1-build-cnn', 'p1-search-space', 'p1-tuner-run', 'l3-global-avg-pool'],
    file: 'Wigfield_James-proj1.ipynb',
    code: `def build_cnn(filters, dropout_rate, dense_units, activation="relu"):
    """4 x (Conv3x3 + MaxPool) -> GlobalAveragePooling -> Dropout -> Dense -> softmax(10)."""
    model = keras.Sequential(name="cnn")
    model.add(keras.Input(shape=(64, 64, 3)))
    model.add(keras.layers.Rescaling(1 / 255))          # uint8 0 to 255 -> float 0 to 1
    for f in filters:
        model.add(keras.layers.Conv2D(f, 3, padding="same", activation=activation))
        model.add(keras.layers.MaxPooling2D(2))
    model.add(keras.layers.GlobalAveragePooling2D())
    model.add(keras.layers.Dropout(dropout_rate))
    model.add(keras.layers.Dense(dense_units, activation=activation))
    model.add(keras.layers.Dense(10, activation="softmax"))
    return model
# …
assert largest_cnn.count_params() < 30_000`,
    marks: [
      { n: 1, token: { line: 5, text: 'Rescaling(1 / 255)' }, say: 'Scaling lives in the model, so the saved .keras file takes raw uint8 images.' },
      { n: 2, lines: [6, 8], say: 'Four blocks of 3×3 conv (same padding) then 2×2 pooling: 64 → 32 → 16 → 8 → 4.' },
      { n: 3, token: { line: 9, text: 'GlobalAveragePooling2D()' }, say: 'One average per channel (40 values), not Flatten’s 4 × 4 × 40 = 640: a far smaller Dense layer.' },
      { n: 4, token: { line: 15, text: 'count_params() < 30_000' }, say: 'The spec’s budget, asserted for the largest configuration: 27,586 parameters.' },
    ],
    moves: {
      draw: 'p1Cnn',
      count: 'p1Cnn',
      say: 'The best of 15 Bayesian trials: filters 16, 16, 24, 40, dropout 0.2, Dense 32. The table is that model; the notebook prints the same 16,570.',
      forWhat: '10-class image classification of small 64 × 64 images on a tight parameter budget.',
    },
    slideCheck: 'The tuner printed "Total elapsed time: 00h 50m 14s"; the notebook reports 48.6 minutes from its own timer, while the spec asks for the tuner’s figure.',
  },
  {
    id: 'p1-nasnet',
    title: 'P1 · NASNetMobile, frozen, with a new head',
    rating: 'core',
    why: 'Transfer learning in code: what the frozen base, the resizing and the [−1, 1] scaling do, and which parameters actually train.',
    sources: [{ kind: 'project', n: 1, sec: '§3.1' }, { kind: 'project', n: 1, sec: '§3.2' }],
    provenance: 'notebook',
    nb: 'p1',
    inv: ['p1-nasnet-base', 'p1-nasnet-preprocess', 'p1-nasnet-head'],
    file: 'Wigfield_James-proj1.ipynb',
    code: `IMG_SIZE = 224                    # NASNetMobile was trained on 224x224 ImageNet images

base_model = tf.keras.applications.NASNetMobile(
    input_shape=(IMG_SIZE, IMG_SIZE, 3), include_top=False, weights="imagenet")
base_model.trainable = False
# …
inputs = keras.Input(shape=(64, 64, 3))
x = keras.layers.Resizing(IMG_SIZE, IMG_SIZE)(inputs)
x = keras.layers.Rescaling(scale=1 / 127.5, offset=-1)(x)    # same logic as nasnet.preprocess_input
x = base_model(x, training=False)
x = keras.layers.GlobalAveragePooling2D()(x)
x = keras.layers.Dense(64, activation="relu")(x)
outputs = keras.layers.Dense(10, activation="softmax")(x)
nasnet_model = keras.Model(inputs, outputs, name="nasnet_transfer")`,
    marks: [
      { n: 1, lines: [3, 5], say: 'ImageNet weights without the 1,000-class top; trainable = False freezes all 4,269,716 base parameters.' },
      { n: 2, token: { line: 8, text: 'Resizing(IMG_SIZE, IMG_SIZE)' }, say: 'Upscales the 64 × 64 images to the 224 × 224 the base was trained on.' },
      { n: 3, token: { line: 9, text: 'Rescaling(scale=1 / 127.5, offset=-1)' }, say: 'x / 127.5 − 1 maps 0…255 to [−1, 1], checked equal to nasnet.preprocess_input.' },
      { n: 4, lines: [11, 13], say: 'The new head: GAP → Dense(64, relu) (spec: ≤ 80) → 10-way softmax. Only these train.' },
    ],
    moves: {
      draw: 'p1Nasnet',
      count: 'p1Nasnet',
      say: 'Only the head trains: 17 epochs in 2.2 minutes, test accuracy 0.860 against the CNN’s 0.620.',
      forWhat: 'Transfer learning: a small labelled image set (370 per class) borrows features learned on ImageNet.',
    },
    slideCheck: 'L3 s51 does the same with Xception, then unfreezes base_model.layers[56:] and recompiles at a lower learning rate; this notebook keeps the whole base frozen, as the spec asks. NASNetMobile’s 4,269,716 parameters are from the notebook’s output and Keras, not a rule.',
  },
  {
    id: 'p2-gru',
    title: 'P2 · Two-layer GRU forecaster, all at once (model 1) or rolled out (model 2)',
    rating: 'core',
    why: 'Draw and count a two-layer GRU, explain return_sequences, and compare predicting 12 months at once with looping a one-month model.',
    sources: [{ kind: 'project', n: 2, sec: '§5' }, { kind: 'project', n: 2, sec: '§7' }],
    provenance: 'notebook',
    nb: 'p2',
    inv: ['p2-helpers-build-gru', 'p2-model1', 'p2-model2', 'p2-predict-recursively', 'p2-split-sequences'],
    file: 'Wigfield_James-proj2.ipynb',
    code: `def build_gru_model(target_length, units=GRU_UNITS, name=None):
    """Two tanh GRU layers -> Dense -> Reshape to (target_length, 2), with the scaling layers at both ends."""
    norm, denorm = scaling_layers()
    return keras.Sequential([
        keras.Input(shape=(None, 2)),                   # any number of months, min and max channels
        norm,
        keras.layers.GRU(units, activation="tanh", return_sequences=True),
        keras.layers.GRU(units, activation="tanh"),
        keras.layers.Dense(target_length * 2),
        keras.layers.Reshape((target_length, 2)),
        denorm,
    ], name=name)
# …
        y_next = model(window, training=False)                    # (N, 1, 2)
        predictions.append(y_next)
        window = tf.concat([window[:, 1:], y_next], axis=1)`,
    marks: [
      { n: 1, token: { line: 5, text: 'shape=(None, 2)' }, say: 'Any number of months, 2 channels: monthly mean minimum and maximum temperature.' },
      { n: 2, token: { line: 7, text: 'return_sequences=True' }, say: 'GRU 1 passes all its hidden states to GRU 2, which returns only the last.' },
      { n: 3, lines: [9, 10], say: 'Dense(12 × 2) reshaped to (12, 2) for model 1; model 2 is build_gru_model(1).' },
      { n: 4, lines: [14, 16], say: 'Model 2 inside a for loop: predict a month, keep it, slide the 72-month window on by one.' },
    ],
    moves: {
      draw: 'p2Model1',
      count: 'p2Model1',
      shapes: [
        { name: 'X_train', shape: '(1522, 72, 2)', means: 'sequences × 72 input months × (min, max)' },
        { name: 'y_train', shape: '(1522, 12, 2)', means: 'the next 12 months; model 2 trains on y_train[:, :1], (1522, 1, 2)' },
      ],
      say: 'Test MAE over 12 months: model 1 1.250 °C; model 2 rolled out 1.407 °C, because its errors feed back in.',
      forWhat: 'Multi-step time-series forecasting: the next 12 months of minimum and maximum temperature from the last 72.',
    },
    slideCheck: 'L4 s34’s loop grows its input (the model sees 56, then 57, … up to 69 steps); this one slides a fixed 72-month window, so the model only sees inputs as long as those it trained on. The scaling layers are Normalization layers given the training mean and variance, so they hold 0 parameters.',
    xref: [{ to: 'forecast-ahead', text: 'The lecture’s two ways to forecast 14 days' }],
  },
  {
    id: 'p2-encdec',
    title: 'P2 · GRU encoder–decoder (model 3)',
    rating: 'core',
    why: 'Explain how the encoder’s states start the decoder, what teacher forcing feeds in training, and what changes at test time.',
    sources: [{ kind: 'project', n: 2, sec: '§8' }],
    provenance: 'notebook',
    nb: 'p2',
    inv: ['p2-encoder-decoder', 'l8-rnn-ed-functional'],
    file: 'Wigfield_James-proj2.ipynb',
    code: `    encoder_gru1 = keras.layers.GRU(units, activation="tanh", return_sequences=True, return_state=True,
                                    name="encoder_gru1")
    encoder_gru2 = keras.layers.GRU(units, activation="tanh", return_state=True, name="encoder_gru2")
# …
    encoder_input = keras.Input(shape=(None, 2), name="encoder_input")
    decoder_input = keras.Input(shape=(None, 2), name="decoder_input")
    sequence1, state1 = encoder_gru1(norm(encoder_input))
    _, state2 = encoder_gru2(sequence1)
    decoded1, _ = decoder_gru1(norm(decoder_input), initial_state=state1)
    decoded2, _ = decoder_gru2(decoded1, initial_state=state2)
    model = keras.Model([encoder_input, decoder_input], denorm(output_layer(decoded2)), name="model3")
# …
    return tf.concat([X[:, -1:], y[:, :-1]], axis=1)
# …
        month, state1, state2 = decoder([month, state1, state2], training=False)`,
    marks: [
      { n: 1, token: { line: 1, text: 'return_state=True' }, say: 'Encoder GRU 1 also returns its final hidden state, to start decoder GRU 1.' },
      { n: 2, token: { line: 9, text: 'initial_state=state1' }, say: 'Decoder layer 1 starts from encoder layer 1’s final state; layer 2 likewise.' },
      { n: 3, lines: [13, 13], say: 'Teacher forcing: decoder input = the last known month, then the true targets shifted one month.' },
      { n: 4, lines: [15, 15], say: 'At test time the decoder is fed its own prediction and states, one month at a time.' },
    ],
    moves: {
      draw: 'p2Model3',
      count: 'p2Model3',
      shapes: [
        { name: 'encoder input', shape: '(1522, 72, 2)', means: 'the 72 known months' },
        { name: 'decoder input', shape: '(1522, 12, 2)', means: 'last known month + targets shifted by one (training only)' },
        { name: 'output', shape: '(1522, 12, 2)', means: 'the 12 predicted months' },
      ],
      say: 'Test MAE 1.321 °C with the decoder fed its own predictions: between model 1 (1.250) and model 2 (1.407).',
      forWhat: 'Sequence-to-sequence forecasting: an encoder summarises 72 months into states; a decoder unrolls 12 months from them.',
    },
    slideCheck: 'The decoder’s GRU layers have the same weights in training and at test time: the notebook builds the inference encoder and decoder from the same layer objects.',
  },
  {
    id: 'p2-vae',
    title: 'P2 · VAE that synthesises max-temperature sequences',
    rating: 'core',
    why: 'Sample Q2(b) asks what a VAE is and how it trains: here are the sampling step, the KL term and the two-headed encoder in code.',
    sources: [{ kind: 'project', n: 2, sec: '§11' }],
    provenance: 'notebook',
    nb: 'p2',
    inv: ['p2-vae', 'p2-vae-data', 'p2-vae-synthesis'],
    file: 'Wigfield_James-proj2.ipynb',
    code: `class Sampling(keras.layers.Layer):
# …
    def call(self, inputs):
        z_mean, z_log_var = inputs
        epsilon = keras.random.normal(shape=tf.shape(z_mean))
        kl = -0.5 * tf.reduce_sum(1 + z_log_var - tf.exp(z_log_var) - tf.square(z_mean), axis=-1)
        self.add_loss(self.kl_weight * tf.reduce_mean(kl))
        return z_mean + tf.exp(0.5 * z_log_var) * epsilon
# …
    x = keras.layers.Reshape((SEQ_LENGTH, 1))(inputs)
    x = keras.layers.Conv1D(16, 5, strides=2, padding="same", activation="relu")(x)
    x = keras.layers.Conv1D(32, 5, strides=2, padding="same", activation="relu")(x)
    x = keras.layers.Flatten()(x)
    z_mean = keras.layers.Dense(codings_size, name="z_mean")(x)
    z_log_var = keras.layers.Dense(codings_size, name="z_log_var")(x)
    z = Sampling(kl_weight, name="sampling")([z_mean, z_log_var])`,
    marks: [
      { n: 1, lines: [6, 6], say: 'The KL term, −½ Σ (1 + log σ² − σ² − μ²), summed over the 4 codings (L6–7 s14).' },
      { n: 2, token: { line: 7, text: 'self.kl_weight *' }, say: 'Weighted 0.5 / 84 and added to the reconstruction MSE: the VAE’s two-part loss.' },
      { n: 3, lines: [8, 8], say: 'The reparameterisation trick: z = μ + σ·ε with σ = exp(½ log σ²), so gradients reach μ and σ.' },
      { n: 4, lines: [14, 15], say: 'Two Dense heads on the same 672 features: the codings’ mean and log-variance, 4 each.' },
    ],
    moves: {
      count: 'p2VaeEncoder',
      shapes: [
        { name: 'z_train', shape: '(1522, 84)', means: 'the max channel of train_seq as z-scores' },
        { name: 'z', shape: '(N, 4)', means: 'one 4-number codings vector per sequence' },
      ],
      say: 'The decoder mirrors it: Dense(21 × 32) → Reshape → two Conv1DTranspose → 84 values. To synthesise, decode 6 codings drawn from N(0, I).',
      forWhat: 'Generating new, realistic 84-month maximum-temperature sequences.',
    },
    slideCheck: 'The spec never names a KL term or a sampling layer; both come from the lecture VAE (L6–7 s14). Géron divides the KL by 784 per pixel; this notebook weights it 0.5 / 84 per month.',
    xref: [{ to: 'vae-sampling', text: 'The lecture’s Sampling layer' }],
  },
];
