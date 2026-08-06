/* ============================================================================
   DEEP LEARNING — LECTURE 1 QUIZ DATA (Topic 1 · Intro to ANNs)
   ----------------------------------------------------------------------------
   Ten questions built strictly from the slide content of lecture-1.md.
   Kept out of the labs so the page shell can show a live score on the tab.
   ========================================================================== */

export const QUIZ = [
  {
    q: 'A threshold logic unit (TLU) computes…',
    opts: [
      'a weighted sum z = wᵀx + b, then applies a step function to it',
      'the average of its inputs, then a sigmoid',
      'a random projection of its inputs',
      'the maximum of its weighted inputs',
    ],
    ans: 0,
    why: 'The TLU computes z = w₁x₁ + ⋯ + wₙxₙ + b = wᵀx + b, then outputs step(z). Inputs and output are numbers (not binary on/off), and every input connection carries a weight.',
    slide: 4,
  },
  {
    q: 'A layer where every TLU is connected to every input is called…',
    opts: [
      'a fully connected (dense) layer',
      'a convolutional layer',
      'a recurrent layer',
      'a dropout layer',
    ],
    ans: 0,
    why: 'A Perceptron is one or more TLUs organised in a single layer where every TLU connects to every input — a fully connected layer, or dense layer. The inputs form the input layer; the TLU layer produces the final outputs, so it is the output layer.',
    slide: 6,
  },
  {
    q: 'In the Perceptron learning rule wᵢⱼ ← wᵢⱼ + η(yⱼ − ŷⱼ)xᵢ, what happens when the prediction is correct?',
    opts: [
      'Nothing — yⱼ − ŷⱼ = 0, so the weight is unchanged',
      'The weight is reinforced by ηxᵢ',
      'The weight decays toward zero',
      'The learning rate is halved',
    ],
    ans: 0,
    why: 'Weights only move for output neurons that produced a WRONG prediction — the rule reinforces connections from inputs that would have contributed to the correct prediction. Correct prediction → zero error term → zero update.',
    slide: 10,
  },
  {
    q: 'Rosenblatt’s training algorithm was inspired by Hebb’s rule, summarised as…',
    opts: [
      '“cells that fire together, wire together”',
      '“survival of the fittest neuron”',
      '“errors propagate backwards”',
      '“winner takes all”',
    ],
    ans: 0,
    why: 'Hebbian learning (after Donald Hebb): connections between neurons that activate together are strengthened — the inspiration for the Perceptron’s weight-reinforcement rule.',
    slide: 9,
  },
  {
    q: 'The Perceptron convergence theorem says the algorithm converges…',
    opts: [
      'if the training instances are linearly separable (to a solution that is generally not unique)',
      'for any dataset, always',
      'only if the learning rate decays',
      'only with more than one layer',
    ],
    ans: 0,
    why: 'Rosenblatt demonstrated convergence for linearly separable data — and the footnote adds that the solution is generally not unique. Each output neuron’s decision boundary stays linear, so complex patterns remain out of reach.',
    slide: 12,
  },
  {
    q: 'Scikit-Learn’s Perceptron class is equivalent to an SGDClassifier with…',
    opts: [
      'loss="perceptron", learning_rate="constant", eta0=1, penalty=None',
      'loss="hinge", learning_rate="adaptive", alpha=0.01',
      'loss="log_loss" and L2 regularization',
      'loss="perceptron" with early stopping',
    ],
    ans: 0,
    why: 'The Perceptron learning algorithm strongly resembles Stochastic Gradient Descent: constant learning rate of 1 and no regularization reproduce it exactly.',
    slide: 14,
  },
  {
    q: 'One good reason to prefer Logistic Regression over a Perceptron is that Perceptrons…',
    opts: [
      'do not output a class probability — only a hard-threshold decision',
      'cannot handle two features',
      'require GPUs',
      'always overfit',
    ],
    ans: 0,
    why: 'Contrary to Logistic Regression classifiers, Perceptrons just make predictions based on a hard threshold — no probabilities.',
    slide: 15,
  },
  {
    q: 'Why did Rumelhart et al. replace the step function with the logistic (sigmoid) function?',
    opts: [
      'the step function has no gradient to work with; the sigmoid has a well-defined nonzero derivative everywhere',
      'the sigmoid is faster to compute',
      'the step function overflows numerically',
      'the sigmoid outputs values in (−1, 1)',
    ],
    ans: 0,
    why: 'Backpropagation is Gradient Descent — it needs gradients. step′(z) is 0 everywhere (undefined at the jump); σ′(z) = σ(z)(1 − σ(z)) is nonzero everywhere.',
    slide: 20,
  },
  {
    q: 'Why do layers need a nonlinear activation function at all?',
    opts: [
      'chaining linear functions gives another linear function — a deep stack would collapse to a single layer',
      'nonlinearity keeps the weights small',
      'linear functions cannot be differentiated',
      'it makes training faster',
    ],
    ans: 0,
    why: 'f(z) = 2z + 3 chained with g(z) = 5z − 1 gives f(g(z)) = 10z + 1 — still a line. Without nonlinearity between layers, even a deep stack is equivalent to one layer, and complex problems stay unsolvable.',
    slide: 23,
  },
  {
    q: 'For multiclass classification (e.g. MNIST), the output layer should use…',
    opts: [
      'one neuron per class with softmax, trained with cross-entropy loss',
      'one sigmoid neuron per class, trained with MSE',
      'a single tanh neuron',
      'ReLU outputs with Huber loss',
    ],
    ans: 0,
    why: 'Softmax ensures all outputs are probabilities summing to 1; since we predict probability distributions, cross-entropy (log loss) is generally the right loss — with K = 10 classes for MNIST.',
    slide: 29,
  },
];

// Correct-answer count for a { questionIndex: optionIndex } answer map.
export function scoreOf(answers) {
  return Object.entries(answers).filter(([i, a]) => QUIZ[Number(i)]?.ans === a).length;
}
