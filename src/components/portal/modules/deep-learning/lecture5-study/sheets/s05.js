// §5 · Implementing a stacked autoencoder in Keras (slide 12)
export default {
  blocks: [
    {
      id: 'keras',
      h: '`stacked_ae` in Keras',
      at: '12',
      items: [
        'The encoder takes a 28 × 28 image (`InputLayer`), flattens it and applies `Dense(100)` and `Dense(30)` with ReLU; the decoder mirrors it, ending in `Dense(28 * 28)` with no activation and `Reshape([28, 28])`.',
        { code: 'history = stacked_ae.fit(X_train, X_train, epochs=20,\n                         validation_data=(X_valid, X_valid))', read: 'loss `"mse"`, optimizer `"nadam"`; the targets are the {g|inputs}' },
      ],
    },
    {
      id: 'count',
      h: 'Counting the parameters',
      at: '12',
      items: [
        { formula: '\\text{params} = \\text{inputs} \\times \\text{units} + \\text{units}', read: 'a weight per input per unit, plus a bias per unit', tag: 'this page’s working' },
        {
          table: {
            head: ['layer', 'weights + biases', 'params'],
            cols: 'max-content max-content max-content',
            rows: [
              ['`Dense(100)`', '784 × 100 + 100', '78,500'],
              ['`Dense(30)`', '100 × 30 + 30', '3,030'],
              ['`Dense(100)`', '30 × 100 + 100', '3,100'],
              ['`Dense(28 * 28)`', '100 × 784 + 784', '79,184'],
              ['total (slide 12)', '', '{g|163,814}'],
            ],
          },
        },
      ],
      margin: [
        { q: 'Which layers of `stacked_ae` have no parameters?', a: '`InputLayer`, `Flatten` and `Reshape`. They have no weights: `InputLayer` only declares the input shape, and the other two only reshape the data.' },
      ],
    },
  ],
  skip: 'the rest of slide 12’s listing.',
};
