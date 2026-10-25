// Code Lab cards: tab 2 · Keras models (L1)
export const KERAS = [
  {
    id: 'wide-deep',
    title: 'Wide & Deep with the Functional API',
    rating: 'core',
    why: 'The sample paper’s Q1(c) is this model in disguise: draw the two paths, count each layer, say what problem it suits.',
    sources: [{ kind: 'lecture', lec: 1, slides: '44–45' }],
    provenance: 'verbatim',
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
      { n: 1, lines: [7, 7], say: 'One input of 8 features (California housing); the batch axis is left out.' },
      { n: 2, lines: [8, 10], say: 'The deep path: normalise, then two Dense 30 ReLU layers, each a function called on a tensor.' },
      { n: 3, token: { line: 11, text: '[normalized, hidden2]' }, say: 'The wide path skips the hidden layers: 8 + 30 = 38 values reach the output.' },
      { n: 4, token: { line: 5, text: 'Dense(1)' }, say: 'One linear unit, no activation: a regression output.' },
    ],
    moves: {
      draw: 'wideDeep',
      count: 'wideDeep',
      forWhat: 'Regression on structured (tabular) data: one real-valued target from 8 features, learning simple rules (wide) and deep patterns together.',
    },
    slideCheck: 'Slide 45’s `model.summary()` prints the same counts: 17 non-trainable (8 means + 8 variances + 1 count), 1,239 trainable, 1,256 in all.',
  },
];
