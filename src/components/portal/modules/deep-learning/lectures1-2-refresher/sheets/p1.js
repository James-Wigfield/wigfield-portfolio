// Notebook page 1 · Lecture 1 (L1 slides 4–62): perceptrons → MLPs → Keras → hyperparameters
export default {
  blocks: [
    {
      id: 'tlu',
      h: 'Perceptron: one layer of TLUs',
      at: 'L1 · 4–17',
      items: [
        { formula: 'z = \\mathbf{w}^T\\mathbf{x} + b, \\qquad h_{\\mathbf{w},b}(\\mathbf{x}) = \\text{step}(z)' },
        { formula: 'w_{i,j}^{(\\text{next step})} = w_{i,j} + \\eta\\left(y_j - \\hat{y}_j\\right)x_i' },
        'Converges only if {g|linearly separable}: XOR needs an MLP.',
      ],
      margin: [
        { q: 'Which step do Perceptrons usually use?', a: 'Heaviside: 0 if $z < 0$, 1 if $z \\ge 0$ (slide 5).' },
      ],
    },
    {
      id: 'mlp',
      h: 'MLP and backpropagation',
      at: 'L1 · 18–23',
      items: [
        'Backprop: forward pass, error, reverse pass, {g|gradient step}.',
        {
          table: {
            head: ['', 'formula', 'range', 'peak slope'],
            rows: [
              ['sigmoid', '$1/(1 + \\exp(-z))$', '0 to 1', '0.25'],
              ['tanh', '$2\\sigma(2z) - 1$', '−1 to 1', '1'],
              ['ReLU', '$\\max(0, z)$', '0 upwards', '1, or 0 if $z < 0$'],
            ],
          },
        },
      ],
      margin: [
        { q: 'Why replace the step with σ?', a: 'The step has no gradient; σ has a nonzero derivative everywhere (slide 20).' },
        { q: 'Why any nonlinearity?', a: 'Linear layers chain into one linear layer: $f(g(z)) = 10z + 1$ (slide 23).' },
      ],
    },
    {
      id: 'out',
      h: 'Output layer and loss',
      at: 'L1 · 24–31',
      items: [
        {
          table: {
            head: ['task', 'outputs', 'activation', 'loss'],
            rows: [
              ['regression', '1 per dimension', 'none', 'MSE, Huber'],
              ['binary, multilabel', '1 per label', 'sigmoid', 'X-entropy'],
              ['multiclass', '1 per class', '{g|softmax}', 'X-entropy'],
            ],
          },
        },
      ],
      margin: [
        { q: 'When is Huber better than MSE?', a: 'With outliers: quadratic for $|z| \\le \\delta$, linear beyond (slides 27–28).' },
      ],
    },
    {
      id: 'keras',
      h: 'Keras APIs',
      at: 'L1 · 32–56',
      items: [
        {
          table: {
            head: ['API', 'how'],
            rows: [
              ['Sequential', 'a list of layers, then compile and fit'],
              ['Functional', 'layers called like functions: any graph'],
              ['Subclassing', '{g|call()}: flexible, not inspectable'],
            ],
          },
        },
      ],
      margin: [
        { q: 'What does EarlyStopping keep?', a: 'With `restore_best_weights=True`, the best weights on the validation set (slide 52).' },
      ],
    },
    {
      id: 'hp',
      h: 'Hyperparameters',
      at: 'L1 · 57–62',
      items: [
        'Learning rate first: about {g|half the maximum},',
        { line: 'or {g|10 times below} where a sweep’s loss shoots up.' },
        'Start with 1–2 equal hidden layers, ReLU, early stopping.',
      ],
      margin: [
        { q: 'Small or large batches?', a: 'Both camps: small (2–32), or large with learning-rate warmup (slide 61).' },
      ],
    },
  ],
  skip: 'layer maths, Scikit-Learn, Huber formula, Fashion MNIST, Wide & Deep, callbacks, TensorBoard.',
};
