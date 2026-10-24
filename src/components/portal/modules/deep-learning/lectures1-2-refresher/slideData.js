/* ============================================================================
   LECTURES 1–2 REFRESHER — SLIDE FACTS
   ----------------------------------------------------------------------------
   Everything the module quotes from the two decks, in one place:
     L1  CITS5017 Topic 1, "Introduction to Artificial Neural Networks"
         (64 slides, Géron Chapter 10)
     L2  CITS5017 Topic 2, "Training Deep Neural Networks" (68 slides,
         Géron Chapter 11)
   Code listings are verbatim (indentation as on the slide images), keyed by
   name for sections.js; the numbers the slides print; footnotes. Checked
   against Documents/cits5017/markdown-lecs/lecture-1.md and lecture-2.md.

   Nothing here is computed: the page's own numbers come from ./nn.js and
   are labelled "this page's own" wherever they are shown.
   ========================================================================== */

/* ── numbers the slides print ────────────────────────────────────────────── */
export const PRINTED = {
  // L1
  fashionTrain: { value: 60000, at: 'L1 · 35' },
  fashionTest: { value: 10000, at: 'L1 · 35' },
  fashionValid: { value: 5000, at: 'L1 · 35' },
  hidden1Weights: { text: '(784, 300)', at: 'L1 · 36' },
  hidden1Biases: { text: '(300,)', at: 'L1 · 36' },
  testAccuracy: { value: 0.8733000159263611, at: 'L1 · 39' },
  mlpRegRmse: { value: 0.505, at: 'L1 · 26' },
  kerasRegRmse: { value: 0.539, at: 'L1 · 41' },
  // L2
  bnSummary: {
    at: 'L2 · 27',
    rows: [
      ['flatten (Flatten)', '(None, 784)', '0'],
      ['batch_normalization (BatchNormalization)', '(None, 784)', '3,136'],
      ['dense (Dense)', '(None, 300)', '235,500'],
      ['batch_normalization_1 (BatchNormalization)', '(None, 300)', '1,200'],
      ['dense_1 (Dense)', '(None, 100)', '30,100'],
      ['batch_normalization_2 (BatchNormalization)', '(None, 100)', '400'],
      ['dense_2 (Dense)', '(None, 10)', '1,010'],
    ],
    total: '271,346',
    trainable: '268,978',
    nonTrainable: '2,368',
  },
  modelB: { value: 0.9185, at: 'L2 · 31' },
  modelBonAEval: { text: '[0.2546142041683197, 0.9384999871253967]', at: 'L2 · 32' },
  modelBonA: { value: 0.9385, at: 'L2 · 32' },
};

/* ── footnotes (Fnote / RefsProvider), verbatim ──────────────────────────── */
export const REFS = {};

/* ── code listings, verbatim ─────────────────────────────────────────────── */
export const NAMED_CODE = {
  /* L1 · slides 35, 37 — the Fashion MNIST classifier */
  L1_MODEL: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(300, activation="relu"),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(10, activation="softmax")
])`,
  L1_COMPILE: `model.compile(loss="sparse_categorical_crossentropy", optimizer="sgd", metrics=["accuracy"])
>>> history = model.fit(X_train, y_train, epochs=30, validation_data=(X_valid, y_valid))`,
  /* L1 · slide 44 — Wide & Deep, functional */
  L1_WIDE_DEEP: `normalization_layer = tf.keras.layers.Normalization()
hidden_layer1 = tf.keras.layers.Dense(30, activation="relu")
hidden_layer2 = tf.keras.layers.Dense(30, activation="relu")
concat_layer = tf.keras.layers.Concatenate()
output_layer = tf.keras.layers.Dense(1)

input_ = tf.keras.layers.Input(shape=X_train.shape[1:])
normalized = normalization_layer(input_)
hidden1 = hidden_layer1(normalized)
hidden2 = hidden_layer2(hidden1)
concat = concat_layer([normalized, hidden2])
output = output_layer(concat)

model = tf.keras.Model(inputs=[input_], outputs=[output])`,
  /* L1 · slide 52 */
  L1_EARLY_STOP: `early_stopping_cb = tf.keras.callbacks.EarlyStopping(patience=10,
                                         restore_best_weights=True)
history = model.fit(X_train, y_train, epochs=100,
                    validation_data=(X_valid, y_valid),
                    callbacks=[checkpoint_cb, early_stopping_cb])`,

  /* L2 · slide 9 */
  L2_INIT: `import tensorflow as tf
tf.keras.layers.Dense(10, activation="relu", kernel_initializer="he_normal")

he_avg_init = tf.keras.initializers.VarianceScaling(scale=2., mode="fan_avg",
                                                    distribution="uniform")
dense = tf.keras.layers.Dense(50, activation="sigmoid",
                              kernel_initializer=he_avg_init)`,
  /* L2 · slide 26 */
  L2_BN: `  model = keras.models.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(300, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(100, activation="relu",
                          kernel_initializer="he_normal"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Dense(10, activation="softmax")
])`,
  /* L2 · slide 29 */
  L2_CLIP: `optimizer = tf.keras.optimizers.SGD(clipvalue=1.0)
model.compile(loss="mse", optimizer=optimizer)`,
  /* L2 · slide 31 */
  L2_TRANSFER: `# assuming the trained model_A is saved to "my_model_A.keras"
model_A = tf.keras.models.load_model("my_model_A.keras")
model_B_on_A = tf.keras.Sequential(model_A.layers[:-1])
model_B_on_A.add(tf.keras.layers.Dense(1, activation="sigmoid"))

# freeze the reused layers for the first epochs
for layer in model_B_on_A.layers[:-1]:
   layer.trainable = False

optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])

# for example, train the model for 4 epochs
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=4, validation_data=(X_valid_B, y_valid_B))

# unfreeze the layers and train for 16 epochs. Note that the model
needs to be recompiled
for layer in model_B_on_A.layers[:-1]:
   layer.trainable = True

optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=16, validation_data=(X_valid_B, y_valid_B))`,
  /* L2 · slide 57 */
  L2_PLATEAU: `lr_scheduler = tf.keras.callbacks.ReduceLROnPlateau(factor=0.5,
                                                    patience=5)
history = model.fit(X_train, y_train, [...], callbacks=[lr_scheduler])`,
  /* L2 · slide 60 */
  L2_L2REG: `layer = tf.keras.layers.Dense(100, activation="elu",
                              kernel_initializer="he_normal",
                              kernel_regularizer=tf.keras.regularizers.l2(0.01))`,
  /* L2 · slide 64 */
  L2_DROPOUT: `model = tf.keras.models.Sequential([
  tf.keras.layers.InputLayer(shape=[28, 28]),
  tf.keras.layers.Flatten(),
  tf.keras.layers.Dropout(rate=0.2),
  tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
  tf.keras.layers.Dropout(rate=0.2),
  tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
  tf.keras.layers.Dropout(rate=0.2),
  tf.keras.layers.Dense(10, activation="softmax")
])`,
};

/* ── the decks' summary slides ───────────────────────────────────────────── */
export const L1_OUTCOMES = [
  'Understand the architecture of Perceptrons',
  'Know how to train a Perceptron and understand its weakness',
  'Understand multi-layer Perceptrons and backpropagation',
  'Understand what activation functions are and know a few commonly used activation functions',
  'Know how to train a DNN using Keras in TensorFlow',
  'Understanding the MLP sequential API, function API, and subclassing.',
  'Understand how to use TensorBoard',
  'Understand some of the important hyperparameters in a DNN; in particular, the number of hidden layers, the number of neurons per layer, and the activation functions.',
];
export const L2_OUTCOMES = [
  'Understand the vanishing and exploding gradients problems',
  'Understand the importance of properly initializing connection weights',
  'Know a few unsaturating activation functions',
  'Understand when to use batch normalization and how it works',
  'Know a few fast optimizers and their associated hyperparameters',
  'Understand learning rate scheduling',
  'Understand ℓ1 and ℓ2 regularization',
  'Understand the concept of dropout',
];
