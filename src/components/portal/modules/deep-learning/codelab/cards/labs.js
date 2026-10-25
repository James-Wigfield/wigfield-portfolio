// Code Lab cards: tab 1 · Labs & Projects
export const LABS = [
  {
    id: 'lab4-clockwise',
    title: 'Lab 4 · Clockwise or anti-clockwise? (SimpleRNN classifier)',
    rating: 'core',
    why: 'The sample paper’s Q2(a) is this lab with stars: give X and y’s shapes, the loss, and the RNN set-up.',
    sources: [{ kind: 'lab', n: 4, task: 2 }],
    provenance: 'reconstructed',
    file: 'lab4_task2.py',
    code: `X_train, y_train, X_val, y_val = load_data("noisy_squares.npy")

model = tf.keras.Sequential([
    tf.keras.layers.SimpleRNN(16, input_shape=[None, 2]),
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
      { n: 1, token: { line: 4, text: 'input_shape=[None, 2]' }, say: 'Any number of time steps, 2 coordinates per step: X_train is (200, 4, 2).' },
      { n: 2, token: { line: 4, text: 'SimpleRNN(16' }, say: '16 recurrent units; only the last step’s output goes on.' },
      { n: 3, token: { line: 5, text: 'Dense(1, activation="sigmoid")' }, say: 'One probability: clockwise (1) or anti-clockwise (0).' },
      { n: 4, lines: [7, 9], say: 'The sheet’s hint: momentum, learning rate 0.01; binary cross-entropy for two classes.' },
    ],
    moves: {
      draw: 'lab4Clockwise',
      count: 'lab4Clockwise',
      shapes: [
        { name: 'X_train', shape: '(200, 4, 2)', means: 'instances × time steps (vertices) × coordinates (x, y)' },
        { name: 'y_train', shape: '(200,)', means: 'one label per square: 1 clockwise, 0 anti-clockwise' },
        { name: 'X_val, y_val', shape: '(60, 4, 2), (60,)', means: '30 clockwise + 30 anti-clockwise' },
      ],
    },
    slideCheck: null,
  },
];
