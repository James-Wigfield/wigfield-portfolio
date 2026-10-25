// Code Lab cards: tab 2 · Keras models (L1). `blocks` names the slide blocks
// (tools/dl-codelab/slides-verbatim/L1.txt) every line is copied from.
export const KERAS = [
  {
    id: 'fashion-mlp',
    title: 'A Sequential classifier: build, compile, fit, predict',
    rating: 'core',
    why: 'The classic count-it stimulus: draw the 784-300-100-10 MLP, count each layer, and explain the loss and the argmax.',
    sources: [{ kind: 'lecture', lec: 1, slides: '35–40' }],
    blocks: ['L1 s35 #2', 'L1 s37', 'L1 s37 #2', 'L1 s40'],
    provenance: 'trimmed',
    inv: ['l1-fashion-mlp-add', 'l1-fashion-mlp-list', 'l1-fashion-mlp-summary', 'l1-dense-weights-shape', 'l1-compile-classifier'],
    file: 'fashion_mlp.py',
    code: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[28, 28]),
    tf.keras.layers.Flatten(),
    tf.keras.layers.Dense(300, activation="relu"),
    tf.keras.layers.Dense(100, activation="relu"),
    tf.keras.layers.Dense(10, activation="softmax")
])
model.compile(loss="sparse_categorical_crossentropy", optimizer="sgd", metrics=["accuracy"])
>>> history = model.fit(X_train, y_train, epochs=30, validation_data=(X_valid, y_valid))
# …
>>> y_proba = model.predict(X_new)
# …
>>> y_pred = y_proba.argmax(axis=-1)
>>> y_pred
array([9, 2, 1])`,
    marks: [
      { n: 1, lines: [2, 3], say: 'Each 28 × 28 image is flattened into 784 inputs; neither layer has parameters.' },
      { n: 2, token: { line: 4, text: 'Dense(300, activation="relu")' }, say: '784 × 300 weights + 300 biases = 235,500; its kernel has shape (784, 300).' },
      { n: 3, token: { line: 8, text: 'loss="sparse_categorical_crossentropy"' }, say: 'Labels are integer class IDs 0–9; one-hot labels would need categorical_crossentropy.' },
      { n: 4, token: { line: 13, text: 'argmax(axis=-1)' }, say: 'predict() gives 10 probabilities per image; argmax picks the class ID.' },
    ],
    moves: {
      draw: 'fashionMlp',
      count: 'fashionMlp',
      shapes: [
        { name: 'X_train', shape: '(55000, 28, 28)', means: 'images × rows × columns (the last 5,000 of 60,000 became X_valid)' },
        { name: 'y_proba', shape: '(3, 10)', means: 'one softmax row per image; argmax → (3,)' },
      ],
      forWhat: 'Multiclass image classification (10 Fashion-MNIST classes) with a plain MLP.',
    },
    slideCheck: 'Slide 36’s model.summary() prints the same: 235,500, 30,100 and 1,010, total 266,610 (1.02 MB). Keras 3 leaves the InputLayer out of model.layers, so model.layers[1] is the first Dense layer.',
    xref: [{ to: 'lab2-lr-search', text: 'Lab 2 trains this MLP on MNIST' }],
  },
  {
    id: 'wide-deep',
    title: 'Wide & Deep with the Functional API',
    rating: 'core',
    why: 'The sample paper’s Q1(c) is this model with other sizes: draw the two paths, count each layer, say what problem it suits.',
    sources: [{ kind: 'lecture', lec: 1, slides: '44–45' }],
    blocks: ['L1 s44'],
    provenance: 'verbatim',
    inv: ['l1-wide-deep-functional', 'l1-wide-deep-summary', 'l1-regression-mlp-seq'],
    file: 'wide_deep.py',
    code: `normalization_layer = tf.keras.layers.Normalization()
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
    marks: [
      { n: 1, token: { line: 7, text: 'shape=X_train.shape[1:]' }, say: 'One input of 8 features (California housing); the batch axis is left out.' },
      { n: 2, lines: [8, 10], say: 'The deep path: normalise, then two Dense(30, ReLU) layers, each layer called on a tensor like a function.' },
      { n: 3, token: { line: 11, text: '[normalized, hidden2]' }, say: 'The wide path skips the hidden layers: 8 + 30 = 38 values reach the output.' },
      { n: 4, token: { line: 5, text: 'Dense(1)' }, say: 'One linear unit, no activation: a regression output.' },
    ],
    moves: {
      draw: 'wideDeep',
      count: 'wideDeep',
      say: 'Sample Q1(c): Input 10 → Normalization (21 non-trainable) → Dense(20, gelu) 220 → Concatenate 10 + 20 = 30 → Dense(3, softmax) 93: 313 trainable. Count the Concatenate width.',
      forWhat: 'Regression on tabular data: one real value from 8 features, learning simple rules (wide) and deep patterns together.',
    },
    slideCheck: 'Slide 45’s model.summary() prints the same counts: 17 non-trainable (8 means + 8 variances + 1 count), 1,239 trainable, 1,256 in all.',
  },
  {
    id: 'wide-deep-two',
    title: 'Wide & Deep with two inputs and an auxiliary output',
    rating: 'core',
    why: 'The next variation of sample Q1(c): draw two inputs and two outputs, count with the narrower wide path, explain loss_weights.',
    sources: [{ kind: 'lecture', lec: 1, slides: '46–47' }],
    blocks: ['L1 s46', 'L1 s47'],
    provenance: 'trimmed',
    inv: ['l1-wide-deep-multi-input', 'l1-wide-deep-aux-output'],
    file: 'wide_deep_two.py',
    code: `input_wide = tf.keras.layers.Input(shape=[5])  # features 0 to 4
input_deep = tf.keras.layers.Input(shape=[6])  # features 2 to 7
# …
hidden1 = tf.keras.layers.Dense(30, activation="relu")(norm_deep)
hidden2 = tf.keras.layers.Dense(30, activation="relu")(hidden1)
concat = tf.keras.layers.concatenate([norm_wide, hidden2])
output = tf.keras.layers.Dense(1)(concat)
# …
aux_output = tf.keras.layers.Dense(1)(hidden2)
model = tf.keras.Model(inputs=[input_wide, input_deep],
                       outputs=[output, aux_output])
# …
model.compile(loss=("mse", "mse"), loss_weights=(0.9, 0.1),
              optimizer=optimizer,
              metrics=["RootMeanSquaredError", "RootMeanSquaredError"])`,
    marks: [
      { n: 1, lines: [1, 2], say: 'Two inputs: features 0–4 go wide, 2–7 go deep (2–4 go both ways), each normalised separately.' },
      { n: 2, token: { line: 6, text: 'concatenate([norm_wide, hidden2])' }, say: 'The wide path’s 5 values join the deep path’s 30: the output layer sees 35.' },
      { n: 3, token: { line: 9, text: 'Dense(1)(hidden2)' }, say: 'An auxiliary output on the deep path alone, so it must learn something useful by itself.' },
      { n: 4, token: { line: 13, text: 'loss_weights=(0.9, 0.1)' }, say: 'The main loss counts 90%, the auxiliary 10%: the extra output acts as a regulariser.' },
    ],
    moves: {
      draw: 'wideDeepTwo',
      count: 'wideDeepTwo',
      shapes: [
        { name: 'X_train_wide', shape: 'X_train[:, :5]', means: '(n, 5): features 0 to 4' },
        { name: 'X_train_deep', shape: 'X_train[:, 2:]', means: '(n, 6): features 2 to 7' },
      ],
      say: 'fit takes a tuple of arrays, one per Input in order, and one target per output.',
      forWhat: 'Regression where some features suit simple rules (wide) and others deep patterns; the auxiliary output regularises.',
    },
    slideCheck: 'Slide 47’s [...] placeholders stand for slide 46’s code, so it doesn’t run as shown. Both Normalization layers are adapted on their own slice before fit.',
  },
];
