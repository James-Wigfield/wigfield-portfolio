// Code Lab cards: tab 3 · Training deep nets (L2): batch norm, regularisation,
// and transfer learning (L2's own deck covers it; Lab 2 Task 2 is the same code).
export const TRAINING = [
  {
    id: 'batch-norm',
    title: 'Batch normalization and its parameter count',
    rating: 'core',
    why: 'Count it: where Batch Normalization’s 4 parameters per feature come from, and why half of them are non-trainable.',
    sources: [{ kind: 'lecture', lec: 2, slides: '26–28' }],
    blocks: ['L2 s26'],
    provenance: 'verbatim',
    inv: ['l2-bn-after-activation', 'l2-bn-summary', 'l2-bn-before-activation', 'l2-he-init'],
    file: 'batch_norm.py',
    code: `  model = keras.models.Sequential([
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
    marks: [
      { n: 1, lines: [4, 4], say: 'BN right after Flatten standardises the 784 inputs, so no separate scaler is needed.' },
      { n: 2, lines: [7, 7], say: '4 × 300 = 1,200: γ and β are trained; the moving mean and variance (600) are not.' },
      { n: 3, token: { line: 6, text: 'kernel_initializer="he_normal"' }, say: 'He initialisation, the usual pairing with ReLU.' },
    ],
    moves: {
      count: 'batchNorm',
      say: 'Each BN layer adds 4 × features parameters, half non-trainable: 2 × (784 + 300 + 100) = 2,368 non-trainable, 268,978 trainable.',
      forWhat: 'Faster, steadier training of a deep MLP: each layer’s inputs are re-centred and re-scaled per mini-batch.',
    },
    slideCheck: 'Slide 27 prints 3,136, 1,200 and 400 for the BN layers, 268,978 trainable and 2,368 non-trainable. The slide indents the first line by 2 spaces (an IndentationError if pasted) and writes keras.models. Slide 28 puts BN before the activation with use_bias=False, since BN’s β does the bias’s job.',
  },
  {
    id: 'dropout-l2',
    title: 'Regularisation: ℓ2 penalty and dropout',
    rating: 'core',
    why: 'Explain what each regulariser does in training and at test time, and that dropout adds no parameters.',
    sources: [{ kind: 'lecture', lec: 2, slides: '60' }, { kind: 'lecture', lec: 2, slides: '64' }],
    blocks: ['L2 s60', 'L2 s64'],
    provenance: 'trimmed',
    inv: ['l2-l2-regularizer', 'l2-dropout-mlp', 'l2-he-init'],
    file: 'regularisation.py',
    code: `layer = tf.keras.layers.Dense(100, activation="elu",
                      kernel_initializer="he_normal",
                      kernel_regularizer=tf.keras.regularizers.l2(0.01))
# …
model = tf.keras.models.Sequential([
  tf.keras.layers.InputLayer(shape=[28, 28]),
  tf.keras.layers.Flatten(),
  tf.keras.layers.Dropout(rate=0.2),
  tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
  tf.keras.layers.Dropout(rate=0.2),
  tf.keras.layers.Dense(100, activation="relu", kernel_initializer="he_normal"),
  tf.keras.layers.Dropout(rate=0.2),
  tf.keras.layers.Dense(10, activation="softmax")
])`,
    marks: [
      { n: 1, token: { line: 3, text: 'tf.keras.regularizers.l2(0.01)' }, say: 'Adds 0.01 × the sum of this layer’s squared weights to the loss, so large weights cost.' },
      { n: 2, token: { line: 8, text: 'Dropout(rate=0.2)' }, say: 'Each training step ignores a random 20% of the inputs; at test time every neuron is used.' },
      { n: 3, lines: [10, 10], say: 'Dropout before every Dense layer, never after the output layer; it holds no parameters.' },
    ],
    moves: {
      count: 'dropoutMlp',
      forWhat: 'Fighting overfitting in a deep network: dropout trains an ensemble of thinned networks; ℓ2 keeps the weights small.',
    },
    slideCheck: 'Slide 64 indents the layers by 2 spaces. ℓ1 and ℓ1 + ℓ2 penalties use tf.keras.regularizers.l1(…) and l1_l2(…) (slide 60).',
  },
  {
    id: 'transfer-b-on-a',
    title: 'Transfer learning: reuse, freeze, train, unfreeze, recompile',
    rating: 'core',
    why: 'Explain each step, and count what trains before and after unfreezing. Lab 2 Task 2 and Project 1 use the same idea.',
    sources: [{ kind: 'lecture', lec: 2, slides: '31–32' }, { kind: 'lab', n: 2, task: 2 }],
    blocks: ['L2 s31'],
    provenance: 'trimmed',
    inv: ['l2-transfer-learning', 'l2-transfer-evaluate', 'lab2-t2-geron-model-b-on-a'],
    file: 'transfer.py',
    code: `model_A = tf.keras.models.load_model("my_model_A.keras")
model_B_on_A = tf.keras.Sequential(model_A.layers[:-1])
model_B_on_A.add(tf.keras.layers.Dense(1, activation="sigmoid"))
# freeze the reused layers for the first epochs
for layer in model_B_on_A.layers[:-1]:
   layer.trainable = False
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
# for example, train the model for 4 epochs
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=4, validation_data=(X_valid_B, y_valid_B))
# unfreeze the layers and train for 16 epochs. Note that the model needs to be recompiled
for layer in model_B_on_A.layers[:-1]:
   layer.trainable = True
optimizer = tf.keras.optimizers.SGD(learning_rate=0.001)
model_B_on_A.compile(loss="binary_crossentropy", optimizer=optimizer, metrics=["accuracy"])
history = model_B_on_A.fit(X_train_B, y_train_B, epochs=16, validation_data=(X_valid_B, y_valid_B))`,
    marks: [
      { n: 1, token: { line: 2, text: 'model_A.layers[:-1]' }, say: 'Reuses every layer of model A except its 8-class output layer.' },
      { n: 2, token: { line: 3, text: 'Dense(1, activation="sigmoid")' }, say: 'A new binary head for task B (pullover vs T-shirt), trained from scratch.' },
      { n: 3, lines: [5, 6], say: 'Freeze the reused layers, so the new head’s large early gradients can’t wreck their weights.' },
      { n: 4, lines: [12, 15], say: 'Unfreeze, then compile again: a change to trainable only takes effect after recompiling.' },
    ],
    moves: {
      count: 'transferBonA',
      say: 'Frozen: 101 parameters train (the new head). Unfrozen: all 98,801. Test accuracy 93.85%, against 91.85% without reuse: the error rate drops by about 25% (slide 32).',
      forWhat: 'A small task (200 labelled images) reusing a network trained on a similar, larger task.',
    },
    slideCheck: 'Slide 31 wraps its last comment onto a second line without # (a SyntaxError as typeset), indents the loop bodies 3 spaces, and skips Géron’s clone step: without clone_model, training model_B_on_A also changes model_A. Model A’s layers come from Géron’s Ch 11 notebook; the slide doesn’t define them.',
    xref: [{ to: 'p1-nasnet', text: 'Project 1 freezes a pretrained ImageNet base' }],
  },
];
