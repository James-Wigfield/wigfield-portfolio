/* ============================================================================
   LECTURES 1–2 REFRESHER — CONTENT (the Read beat, the page map)
   ----------------------------------------------------------------------------
   The module's prose, as data, in slide order: Part 1 = Lecture 1 (L1),
   Part 2 = Lecture 2 (L2). A refresher: each section opens with ONE bold
   gist sentence, then a few tight lines, at most one table or key formula,
   and verbatim code only (in an Unfold) where a line of it is the concept.
   Minor slides get one line each, so every slide is covered.

   Inline markup (Rich.jsx): **bold** *italic* `code` $tex$ [label](#id)
   [label](/portal/…)

   LECTURES  per-lecture facts (title, chapter, slide count, Go-deeper link)
   SECTIONS  { id, lec, no, title, short, slides, read, play?, deeper? }
     read    blocks — { gist } the one sentence to remember · 'paragraph' ·
             { list } · { table: { head, rows } } · { eq: { name, tex,
             read } } · { code: { src, label } } (src = a NAMED_CODE key in
             slideData.js) · { unfold: { label, blocks } } · { note, label }
             · { slideNote } (a real discrepancy on the slides)
     play    lab keys (./labs/index.js)
   PAGES     the three notebook pages: { id, no, lec, after, title, … }; a
             page sits after the section `after`, and covers a group
   FLOW      sections and pages in page order (scroll-spy, rail, resume)

   Every slide of both decks lands in exactly one section
   (tools/dl-lectures1-2-refresher/page-check.mjs checks L1 1–64, L2 1–68).
   ========================================================================== */

export const LECTURES = {
  1: {
    title: 'Introduction to Artificial Neural Networks',
    short: 'Intro to ANNs',
    chapter: 'Géron Chapter 10',
    slidesTotal: 64,
    deepTo: '/portal/dl-lecture-1',
    deepLabel: 'Lecture 1 · Intro to ANNs',
  },
  2: {
    title: 'Training Deep Neural Networks',
    short: 'Training DNNs',
    chapter: 'Géron Chapter 11',
    slidesTotal: 68,
    deepTo: '/portal/dl-lecture-2',
    deepLabel: 'Lecture 2 · Training DNNs',
  },
};

export const SECTIONS = [
  /* ══ PART 1 · LECTURE 1 ═══════════════════════════════════════════════ */
  {
    id: 's10',
    lec: 1,
    no: '1.0',
    title: 'How to use this refresher',
    short: 'How to use this refresher',
    slides: '1–3',
    deeper: false,
    read: [
      { gist: 'A fast, accurate recap of Lecture 1 (Géron Chapter 10) and Lecture 2 (Chapter 11), in slide order, for after you have studied both.' },
      {
        list: [
          'Each section: a bold **gist**, a few lines, usually one quick lab. The note-taking is just **three notebook pages**, after [§1.8](#s18), [§2.5](#s25) and [§2.9](#s29).',
          'Every heading names its lecture (**L1** or **L2**) and its slides.',
          'L1’s topics (slide 3): perceptrons and TLUs; training a perceptron and Hebb’s rule; perceptrons and XOR; MLPs and backpropagation; common activation functions; training a DNN with the Sequential API and with the Functional API; fine-tuning hyperparameters.',
        ],
      },
    ],
  },
  {
    id: 's11',
    lec: 1,
    no: '1.1',
    title: 'Perceptrons and TLUs: computing the outputs',
    short: 'Perceptrons & TLUs',
    slides: '4–8',
    read: [
      { gist: 'A TLU takes a weighted sum $z = \\mathbf{w}^T\\mathbf{x} + b$ and outputs $\\text{step}(z)$; a Perceptron is one layer of TLUs, each connected to every input.' },
      {
        list: [
          'The Perceptron: Frank Rosenblatt, 1957, built from *threshold logic units* (TLUs): numeric inputs and output, one **weight** per input connection (slide 4).',
          'The step is usually the **Heaviside** step: 0 if $z < 0$, 1 if $z \\ge 0$; sometimes **sign**($z$) = −1, 0 or +1 (slide 5).',
          'One TLU is a linear binary classifier, like a Logistic Regression classifier or a linear SVM (slide 6).',
          'Every TLU connected to every input = a **fully connected** (dense) layer; the inputs form the input layer, the TLUs the output layer (slides 6–7, Figure 10-5).',
        ],
      },
      { eq: { name: 'A dense layer’s outputs (slide 8)', tex: 'h_{\\mathbf{W},\\mathbf{b}}(\\mathbf{X}) = \\phi(\\mathbf{X}\\mathbf{W} + \\mathbf{b}^\\top)', read: '$\\mathbf{X}$: one row per instance, one column per feature · $\\mathbf{W}$: one row per input feature, one column per neuron · $\\mathbf{b}$: one bias per neuron · $\\phi$: the activation function' } },
      { slideNote: 'Slide 5’s title reads “The Perception (cont.)”: a typo for Perceptron.' },
    ],
  },
  {
    id: 's12',
    lec: 1,
    no: '1.2',
    title: 'Training a perceptron, and why XOR needs more than one layer',
    short: 'Perceptron training & XOR',
    slides: '9–17',
    read: [
      { gist: 'After each wrong prediction, the perceptron rule moves every weight by $\\eta(y_j - \\hat{y}_j)x_i$; it converges when the classes are linearly separable, so it can never solve XOR on its own.' },
      { eq: { name: 'Perceptron learning rule (slide 10)', tex: 'w_{i,j}^{(\\text{next step})} = w_{i,j} + \\eta\\left(y_j - \\hat{y}_j\\right)x_i', read: '$w_{i,j}$: input $i$ → output $j$ · $x_i$: input value · $\\hat{y}_j$: output · $y_j$: target · $\\eta$: learning rate' } },
      {
        list: [
          'Inspired by **Hebb’s rule**, “cells that fire together, wire together”: one instance at a time; for each wrong output, reinforce the weights from inputs that would have given the right answer (slide 9).',
          'Slide 11’s handwriting writes it as a gradient-descent step, $w_{i,j} - \\eta\\,\\partial\\mathcal{L}_j/\\partial w_{i,j}$, with $\\mathcal{L}_j = \\tfrac{1}{2}(\\hat{y}_j - y_j)^2$ and a linear output $\\hat{y}_j = \\sum_i x_i w_{i,j}$, so $\\partial\\mathcal{L}_j/\\partial w_{i,j} = (\\hat{y}_j - y_j)x_i$.',
          'Each output’s decision boundary is **linear**. If the data are linearly separable it converges (the **Perceptron convergence theorem**; the solution is generally not unique) (slide 12).',
          'Scikit-Learn’s `Perceptron` (iris demo) = `SGDClassifier(loss="perceptron", learning_rate="constant", eta0=1, penalty=None)`; unlike Logistic Regression it gives no class probability, just a hard threshold (slides 13–15).',
          'Minsky and Papert (1969): a Perceptron can’t solve **XOR**, so many researchers dropped connectionism. Stacking Perceptrons into an **MLP** can (Figure 10-6b) (slides 16–17).',
        ],
      },
      { slideNote: 'Slide 11’s derivation uses a linear output with no step function. A real Perceptron’s step has a zero derivative almost everywhere, so the derivation shows the rule has the *same form* as gradient descent on a linear unit’s squared error, not that it is the Perceptron’s own gradient. Slide 13’s `astype(np.int)` fails on current NumPy (`np.int` was removed in 1.24; use `int`), and since `y` holds integers, `predict` returns `1` and `0`, not “True and False”.' },
    ],
    play: ['perceptron', 'xor'],
  },
  {
    id: 's13',
    lec: 1,
    no: '1.3',
    title: 'Multi-layer perceptrons, backpropagation and activation functions',
    short: 'MLPs, backprop, activations',
    slides: '18–23',
    read: [
      { gist: 'Backpropagation is gradient descent using reverse-mode autodiff: forward pass, error, reverse pass, update; it needs a differentiable activation in place of the step.' },
      {
        list: [
          'An MLP: one passthrough **input layer**, one or more **hidden layers** of TLUs, one **output layer** (slide 18, Figure 10-7).',
          'Per training instance (slide 19): the **forward pass** computes every neuron’s output; measure the output **error**; the **reverse pass** measures each connection’s error contribution, layer by layer back to the input; then a **gradient descent step** tweaks the weights (Rumelhart, Hinton and Williams, 1986).',
          'Rumelhart et al. swapped the step for the logistic $\\sigma(z) = 1/(1 + \\exp(-z))$: the step has no gradient, $\\sigma$ has a nonzero derivative everywhere (slide 20).',
          'Without a nonlinearity, layers collapse: $f(z) = 2z + 3$ after $g(z) = 5z - 1$ is $f(g(z)) = 10z + 1$, still linear (slide 23).',
        ],
      },
      {
        table: {
          head: ['activation', 'formula', 'range', 'derivative'],
          rows: [
            ['sigmoid (slide 20)', '$\\sigma(z) = 1/(1 + \\exp(-z))$', '0 to 1', '$\\sigma(z)(1 - \\sigma(z))$, peak 0.25'],
            ['tanh (slide 21)', '$\\tanh(z) = 2\\sigma(2z) - 1$', '−1 to +1', 'peak 1.0 (Figure 10-8)'],
            ['ReLU (slide 21)', '$\\text{ReLU}(z) = \\max(0, z)$', '0 up, no maximum', '0 or 1; not differentiable at 0, fast in practice'],
          ],
        },
      },
    ],
    play: ['backprop', 'activations'],
  },
  {
    id: 's14',
    lec: 1,
    no: '1.4',
    title: 'Regression and classification MLPs',
    short: 'Regression & classification',
    slides: '24–31',
    read: [
      { gist: 'The task fixes the output layer and the loss: regression usually has no output activation and MSE; classification uses sigmoid or softmax outputs and cross-entropy.' },
      {
        table: {
          head: ['', 'regression (slide 27)', 'binary', 'multilabel', 'multiclass (slide 31)'],
          rows: [
            ['output neurons', '1 per prediction dimension', '1', '1 per binary label', '1 per class'],
            ['output activation', 'none; ReLU/softplus if positive; sigmoid/tanh if bounded', 'sigmoid', 'sigmoid', 'softmax'],
            ['loss', 'MSE, or Huber if outliers', 'X-entropy', 'X-entropy', 'X-entropy'],
          ],
        },
      },
      {
        list: [
          'Typical: 1 to 5 hidden layers; for regression 10 to 100 neurons per hidden layer, ReLU hidden activation (slides 27, 31).',
          '$\\text{softplus}(z) = \\log(1 + \\exp(z))$: like ReLU but smooth at the origin (slide 25).',
          'MAE is more robust to outliers than MSE; **Huber** is quadratic for $|z| \\le \\delta$, linear beyond (slides 27–28).',
          'Softmax makes the outputs probabilities that sum to 1; cross-entropy (log loss) $J(\\boldsymbol{\\theta}) = -\\frac{1}{m}\\sum_{i}\\sum_{k} y_k^{(i)}\\log(\\hat{p}_k^{(i)})$ over $K$ classes (slide 29).',
          'Slide 26: Scikit-Learn’s `MLPRegressor` (3 hidden layers of 50) on California housing, RMSE about 0.505, around 10% error.',
        ],
      },
    ],
    play: ['heads'],
  },
  {
    id: 's15',
    lec: 1,
    no: '1.5',
    title: 'Keras Sequential API: an image classifier and a regression MLP',
    short: 'Keras Sequential API',
    slides: '32–42',
    read: [
      { gist: 'Stack layers in `tf.keras.Sequential([...])`, then `compile` (loss, optimizer, metrics), `fit` (epochs, validation data), `evaluate` and `predict`.' },
      {
        list: [
          'Keras: a high-level API by François Chollet (open source March 2015), TensorFlow-only since 2.4; the unit uses TensorFlow 2.17.0 and Keras 3.10.0 (slides 32–33).',
          '**Fashion MNIST**: 10 classes of 28 × 28 images, 60,000 training and 10,000 test; the last 5,000 training images are the validation set; pixels ÷ 255. A linear model reaches about 92% on MNIST but only about 83% here (slides 34–35).',
          'The model: `Flatten` → `Dense(300, relu)` → `Dense(100, relu)` → `Dense(10, softmax)`; `model.summary()` counts 235,500 + 30,100 + 1,010 = 266,610 parameters, and the first hidden layer’s weights are (784, 300), its biases (300,) (slides 35–36).',
          '`sparse_categorical_crossentropy`: labels are class indices; `fit` for 30 epochs (default `batch_size` 32) returns a `history` for learning curves (slides 37–38). Test accuracy 0.8733 (slide 39); `predict` gives class probabilities, `argmax` the classes (slide 40).',
          'Regression (California housing): a `Normalization` layer, three `Dense(50, relu)`, `Dense(1)`; Adam, `loss="mse"`; test RMSE around 0.539, not very good, which motivates more complex topologies (slides 41–42).',
        ],
      },
      { unfold: { label: 'Slides 35 and 37: the classifier, verbatim', blocks: [{ code: { src: 'L1_MODEL', label: 'L1 · slide 35' } }, { code: { src: 'L1_COMPILE', label: 'L1 · slide 37' } }] } },
      { slideNote: 'Slide 32 says Keras is available in TensorFlow, CNTK and Theano, then that it has been TensorFlow-only since version 2.4. Keras 3 (slide 33’s 3.10.0) runs on several backends again (JAX, TensorFlow, PyTorch). Slide 37 compiles with `metrics=["accuracy"]`, but its log and slide 38’s legend say `sparse_categorical_accuracy`.' },
    ],
    play: ['seqModel'],
  },
  {
    id: 's16',
    lec: 1,
    no: '1.6',
    title: 'The Functional and Subclassing APIs',
    short: 'Functional & Subclassing APIs',
    slides: '43–49',
    read: [
      { gist: 'The Functional API calls layers like functions, so a model can branch and merge (Wide & Deep); the Subclassing API puts the forward pass in a `call()` method, flexible but opaque to Keras.' },
      {
        table: {
          head: ['API', 'how you build it', 'note'],
          rows: [
            ['Sequential (L1 35)', 'a list of layers, in order', 'a plain stack'],
            ['Functional (L1 44)', '`hidden1 = hidden_layer1(normalized)` … `tf.keras.Model(inputs=[…], outputs=[…])`', 'any graph: Wide & Deep, multiple inputs and outputs'],
            ['Subclassing (L1 48)', 'subclass `tf.keras.Model`: layers in `__init__`, the forward pass in `call()`', 'loops, ifs, low-level TF in `call()`; but no `clone_model()`, and `summary()` can’t show the connections (slide 49)'],
          ],
        },
      },
      {
        list: [
          '**Wide & Deep** (Cheng et al., 2016): the deep path learns deep patterns, the short path simple rules; `Concatenate()` joins them (slides 43–44).',
          'Multiple inputs: features 0–4 go wide, 2–7 go deep; `fit((X_train_wide, X_train_deep), y_train, …)` (slide 46).',
          'Multiple outputs: an auxiliary output on `hidden2`, `loss=("mse", "mse")`, `loss_weights=(0.9, 0.1)`: the deep branch is likelier to overfit, so the auxiliary output regularises (slide 47).',
        ],
      },
      { unfold: { label: 'Slide 44: Wide & Deep with the Functional API, verbatim', blocks: [{ code: { src: 'L1_WIDE_DEEP', label: 'L1 · slide 44' } }] } },
      { slideNote: 'Slide 48’s `self.output = tf.keras.layers.Dense(1)` fails in Keras 3: `output` is a read-only property of `tf.keras.Model`, so the layer needs another attribute name.' },
    ],
    play: ['apis'],
  },
  {
    id: 's17',
    lec: 1,
    no: '1.7',
    title: 'Saving and restoring, callbacks, TensorBoard',
    short: 'Saving, callbacks, TensorBoard',
    slides: '50–56',
    read: [
      { gist: 'Save with `model.save(…)` and reload with `load_model(…)`; callbacks act during `fit`: checkpoints, early stopping, TensorBoard logs.' },
      {
        list: [
          'Sequential and Functional models are declared before any data, so they can be saved, cloned and shared: `model.save("my_keras_model.keras")`, `tf.keras.models.load_model("my_keras_model.keras")` (slide 50).',
          '`ModelCheckpoint("my_checkpoints.weights.h5", save_best_only=True)`: a checkpoint at the end of each epoch by default (slide 51).',
          '`EarlyStopping(patience=10, restore_best_weights=True)`: stop when the validation set shows no progress for `patience` epochs, keep the best weights (slide 52).',
          '**TensorBoard**: write event files to a new log directory per run (e.g. `run_%Y_%m_%d_%H_%M_%S`) with the `TensorBoard(run_logdir, profile_batch=(100, 200))` callback; start it with `%tensorboard --logdir=./my_logs` and open `http://localhost:6006` (slides 53–56).',
        ],
      },
      { unfold: { label: 'Slide 52: early stopping, verbatim', blocks: [{ code: { src: 'L1_EARLY_STOP', label: 'L1 · slide 52' } }] } },
      { slideNote: 'Slide 51 says a checkpoint is saved at the end of each epoch by default, but its example passes `save_best_only=True`, which saves only when the validation score improves.' },
    ],
  },
  {
    id: 's18',
    lec: 1,
    no: '1.8',
    title: 'Fine-tuning hyperparameters, and the Lecture 1 summary',
    short: 'Hyperparameters & L1 summary',
    slides: '57–64',
    read: [
      { gist: 'Search with `GridSearchCV`, `RandomizedSearchCV` or Keras Tuner, but start from sensible values: the learning rate is arguably the most important.' },
      {
        table: {
          head: ['hyperparameter', 'L1 guideline'],
          rows: [
            ['hidden layers (slide 58)', 'start with one or two (MNIST: 97% with one, above 98% with two, a few hundred neurons); add layers until you start overfitting; transfer learning can reduce them'],
            ['neurons per layer (slide 59)', 'a pyramid, or (common today) the same number in every hidden layer; grow until overfitting, then early stopping and regularisation'],
            ['learning rate (slide 60)', 'optimal ≈ **half the maximum** rate (above which training diverges); or sweep from $10^{-5}$ to 10 over 500 iterations: optimal ≈ **10 times lower** than where the loss shoots up'],
            ['optimizer (slide 60)', 'better than plain mini-batch gradient descent (Chapter 11, i.e. L2)'],
            ['batch size (slide 61)', 'two camps: large as fits in GPU RAM (with learning-rate warmup), or small, 2 to 32; large batches can be unstable early and generalise worse'],
            ['activation (slide 62)', 'ReLU (or a variant) in hidden layers; the output layer depends on the task'],
            ['iterations (slide 62)', 'don’t tune: use early stopping'],
          ],
        },
      },
      'Slide 63 sums up: perceptrons and their training and weakness, MLPs and backpropagation, activation functions, Keras’s Sequential, Functional and Subclassing APIs, TensorBoard, and the main hyperparameters. Slide 64: read up to Chapter 11 (L2).',
    ],
    play: ['lrSweep'],
  },

  /* ══ PART 2 · LECTURE 2 ═══════════════════════════════════════════════ */
  {
    id: 's20',
    lec: 2,
    no: '2.0',
    title: 'Lecture 2’s topics',
    short: 'L2 topics',
    slides: '1–3',
    deeper: false,
    read: [
      { gist: 'Lecture 2 (Géron Chapter 11) is about making deep networks train: stable gradients, faster optimizers, learning-rate schedules and less overfitting.' },
      {
        list: [
          'Vanishing/exploding gradients: Glorot and He initialization, nonsaturating activation functions, batch normalization, gradient clipping (slide 3).',
          'Faster optimizers: momentum, Nesterov accelerated gradient, AdaGrad, RMSProp, Adam and its variants; learning rate scheduling.',
          'Avoiding overfitting: ℓ1 and ℓ2 regularization, dropout.',
        ],
      },
    ],
  },
  {
    id: 's21',
    lec: 2,
    no: '2.1',
    title: 'Vanishing and exploding gradients; Glorot and He initialization',
    short: 'Vanishing gradients & init',
    slides: '4–9',
    read: [
      { gist: 'Gradients can shrink (vanish) or grow (explode) on the way down to the lower layers; the first cure is to draw each layer’s initial weights with the right variance.' },
      {
        list: [
          'Training a DNN can hit: vanishing/exploding gradients, too little (labelled) data, very slow training, overfitting with millions of parameters (slide 4).',
          'Vanishing: the lower layers’ weights barely change and training never converges well; exploding: gradients grow larger and larger (slide 5).',
          'Glorot and Bengio (2010) blamed the logistic sigmoid with $\\mathcal{N}(0, 1)$ initialization: each layer’s output variance is much greater than its input’s, the sigmoid’s mean is 0.5 not 0, and it **saturates** at 0 or 1 where its derivative is close to 0 (slides 5–6, Figure 11-1).',
          'Glorot (slide 7): normal with $\\sigma^2 = 1/\\text{fan}_{\\text{avg}}$, or uniform on $[-r, +r]$ with $r = \\sqrt{3/\\text{fan}_{\\text{avg}}}$, where $\\text{fan}_{\\text{avg}} = (\\text{fan}_{\\text{in}} + \\text{fan}_{\\text{out}})/2$.',
          'Keras defaults to Glorot uniform; choose with `kernel_initializer="he_normal"` or a `VarianceScaling(scale=2., mode="fan_avg", distribution="uniform")` initializer (slide 9).',
        ],
      },
      {
        table: {
          head: ['initialization (slide 8)', 'activation functions', '$\\sigma^2$ (normal)'],
          rows: [
            ['Glorot', 'None, tanh, sigmoid, softmax', '$1/\\text{fan}_{\\text{avg}}$'],
            ['He', 'ReLU, Leaky ReLU, ELU, GELU, Swish, Mish', '$2/\\text{fan}_{\\text{in}}$'],
            ['LeCun', 'SELU', '$1/\\text{fan}_{\\text{in}}$'],
          ],
        },
      },
      { unfold: { label: 'Slide 9: choosing the initializer, verbatim', blocks: [{ code: { src: 'L2_INIT', label: 'L2 · slide 9' } }] } },
      { slideNote: 'Slide 9’s second example builds a He-style initializer on $\\text{fan}_{\\text{avg}}$ (`he_avg_init`, `scale=2.`, i.e. variance $2/\\text{fan}_{\\text{avg}}$) and gives it to a `sigmoid` layer. Slide 8’s table pairs sigmoid with Glorot ($1/\\text{fan}_{\\text{avg}}$) and has no $2/\\text{fan}_{\\text{avg}}$ row; the example shows the `VarianceScaling` syntax, not a recommended pairing.' },
    ],
    play: ['gradFlow'],
  },
  {
    id: 's22',
    lec: 2,
    no: '2.2',
    title: 'Nonsaturating activation functions, and which to use',
    short: 'Nonsaturating activations',
    slides: '10–22',
    read: [
      { gist: 'ReLU doesn’t saturate for positive inputs but its neurons can “die” (output only 0); its variants keep a slope for $z < 0$, and the smooth ones usually do better.' },
      {
        table: {
          head: ['function', 'definition', 'remember'],
          rows: [
            ['leaky ReLU (slides 11–12)', '$\\max(\\alpha z, z)$, e.g. $\\alpha = 0.01$', '$\\alpha = 0.2$ tends to do better; `LeakyReLU(negative_slope=0.2)` from tf 2.16 (was `alpha`; Keras default 0.3)'],
            ['RReLU (slide 13)', '$\\alpha$ random in a range while training, fixed to an average at test', 'not in Keras'],
            ['PReLU (slide 14)', '$\\alpha$ learned with the weights', 'strong on large image sets; may overfit small ones'],
            ['ELU (slide 15)', '$\\alpha(\\exp(z) - 1)$ if $z < 0$, else $z$', 'negative outputs, nonzero gradient for $z < 0$; smooth everywhere if $\\alpha = 1$'],
            ['SELU (slides 16–17)', '$1.0507\\,\\text{ELU}_{1.6733}(z)$', 'self-normalizing if inputs standardized, LeCun normal init, no ℓ1/ℓ2, max-norm, BN or dropout'],
            ['GELU (slide 18)', '$z\\Phi(z) \\approx z\\sigma(1.702z)$', 'neither convex nor monotonic; often the best; more compute'],
            ['Swish = SiLU (slide 19)', '$z\\sigma(z)$; $\\text{Swish}_\\beta(z) = z\\sigma(\\beta z)$', '`silu` from tf 2.16'],
            ['Mish (slides 20–21)', '$z\\tanh(\\text{softplus}(z))$', 'beats Swish and GELU by a tiny margin; not in Keras'],
          ],
        },
      },
      {
        list: [
          'ReLU, leaky ReLU, RReLU and PReLU are not smooth at $z = 0$; ELU, SELU, Swish and Mish are smooth variants (slide 14).',
          '**Which one?** (slide 22) ReLU for simple tasks; for complex tasks SiLU (Swish), or parametrized Swish tuning $\\beta$; Mish slightly better but more compute; leaky ReLU or PReLU if latency matters; SELU for very deep MLPs if slide 16’s constraints hold.',
        ],
      },
      { slideNote: 'Slide 14 lists SELU among the smooth variants, but slide 15 says ELU is smooth everywhere only when $\\alpha = 1$. SELU uses $\\alpha = 1.6733$, so its slope jumps at $z = 0$: from $1.0507 \\times 1.6733 \\approx 1.758$ just left of 0 to $1.0507$ just right (this page’s working; the shoot-out lab’s derivative view shows the jump).' },
    ],
    play: ['shootout'],
  },
  {
    id: 's23',
    lec: 2,
    no: '2.3',
    title: 'Batch normalization',
    short: 'Batch normalization',
    slides: '23–28',
    read: [
      { gist: 'Batch normalization standardizes a layer’s inputs over each mini-batch, then scales and shifts them with two learned vectors, $\\boldsymbol{\\gamma}$ and $\\boldsymbol{\\beta}$.' },
      { eq: { name: 'The BN algorithm (slide 24)', tex: '\\boldsymbol{\\mu}_B = \\frac{1}{m_B}\\sum_{i=1}^{m_B}\\mathbf{x}^{(i)} \\qquad \\boldsymbol{\\sigma}_B^2 = \\frac{1}{m_B}\\sum_{i=1}^{m_B}\\left(\\mathbf{x}^{(i)} - \\boldsymbol{\\mu}_B\\right)^2 \\qquad \\hat{\\mathbf{x}}^{(i)} = \\frac{\\mathbf{x}^{(i)} - \\boldsymbol{\\mu}_B}{\\sqrt{\\boldsymbol{\\sigma}_B^2 + \\epsilon}} \\qquad \\mathbf{z}^{(i)} = \\boldsymbol{\\gamma} \\otimes \\hat{\\mathbf{x}}^{(i)} + \\boldsymbol{\\beta}', read: 'mean and variance per feature over the mini-batch $B$; $\\boldsymbol{\\gamma}$, $\\boldsymbol{\\beta}$: trainable scale and shift (one per input feature); $\\otimes$: element-wise' } },
      {
        list: [
          'An extra operation before or after each hidden layer’s activation; at test time it uses moving averages of the mini-batch statistics (slide 23).',
          'Gains (slide 25): much better ImageNet results; vanishing gradients reduced enough to use tanh; much larger learning rates; acts as a regularizer; no need for `StandardScaler`. A runtime cost, offset by fewer epochs; BN can be fused into the previous layer after training.',
          'In Keras: `BatchNormalization()` after `Flatten` and after each hidden layer (slide 26). The summary (slide 27): 3,136 parameters for 784 inputs, 271,346 in total, 2,368 non-trainable. That is 4 per input feature, $\\boldsymbol{\\gamma}$, $\\boldsymbol{\\beta}$ and the two moving averages, which are the non-trainable ones: $2 \\times (784 + 300 + 100) = 2{,}368$ (this page’s working; the slide doesn’t explain the counts).',
          'The BN paper preferred BN **before** the activation: `Dense(…, use_bias=False)`, then `BatchNormalization()`, then `Activation("relu")` (slide 28).',
        ],
      },
      { unfold: { label: 'Slide 26: BN layers in a Sequential model, verbatim', blocks: [{ code: { src: 'L2_BN', label: 'L2 · slide 26' } }] } },
      { slideNote: 'Slide 23 says the moving averages estimate the mean and variance of each layer’s *outputs*, while slide 24’s equations normalize the layer’s *inputs* $\\mathbf{x}^{(i)}$; and $\\epsilon$ in slide 24 is never defined (a small smoothing term). Slide 26’s code starts with `keras.models.Sequential`, although every layer uses `tf.keras` and `keras` is never imported.' },
    ],
    play: ['batchNorm'],
  },
  {
    id: 's24',
    lec: 2,
    no: '2.4',
    title: 'Gradient clipping',
    short: 'Gradient clipping',
    slides: '29',
    read: [
      { gist: 'Clip the gradients during backpropagation so they never exceed a threshold: a fix for exploding gradients, mostly in RNNs, where BN is tricky.' },
      {
        list: [
          '`SGD(clipvalue=1.0)` clips **every component** of the gradient vector to between −1.0 and 1.0 (slide 29).',
          '`clipnorm=1.0` instead, if you want to **keep the gradient vector’s orientation** (slide 29; Pascanu et al., 2013).',
        ],
      },
      { code: { src: 'L2_CLIP', label: 'L2 · slide 29' } },
    ],
    play: ['clip'],
  },
  {
    id: 's25',
    lec: 2,
    no: '2.5',
    title: 'Transfer learning with Keras',
    short: 'Transfer learning',
    slides: '30–32',
    read: [
      { gist: 'Reuse the lower layers of a network trained on a similar task, replace its output layer, freeze the reused layers at first, then unfreeze and fine-tune.' },
      {
        list: [
          'The more similar the tasks, the more layers to reuse, starting from the bottom; for very similar tasks keep every hidden layer and replace only the output layer (slide 30, Figure 11-5).',
          'Example: `model_A` was trained on 8 Fashion MNIST classes (all but sandal and shirt); `model_B` (T-shirt vs pullover, 200 labelled images) gets 91.85% test accuracy (slide 31).',
          'Copy `model_A.layers[:-1]`, add `Dense(1, activation="sigmoid")`; set `layer.trainable = False` and train 4 epochs; set it back to `True`, **recompile**, train 16 more (slide 31).',
          '`model_B_on_A`: 93.85%, so the error falls from 8.15% to 6.15%, almost 25% less. But it took many trials (random seeds); transfer learning works poorly with small dense networks and well with deep CNNs (slide 32).',
        ],
      },
      { unfold: { label: 'Slide 31: freeze, train, unfreeze, recompile, verbatim', blocks: [{ code: { src: 'L2_TRANSFER', label: 'L2 · slide 31' } }] } },
      { slideNote: 'As printed, slide 31’s second comment wraps onto a line without `#` (“needs to be recompiled”), which is a syntax error if pasted, and the text says `mode_A` for `model_A`. `model_B_on_A` is built from `model_A.layers` directly, so the two models share layers and training one changes the other (Géron clones model A first; the slide doesn’t). On slide 32, “an improvement of 2%” means 2 percentage points, and $(8.15 - 6.15)/8.15 \\approx 0.245$, i.e. almost 25% (the slide’s % signs are misplaced).' },
    ],
  },
  {
    id: 's26',
    lec: 2,
    no: '2.6',
    title: 'Faster optimizers: momentum, NAG, AdaGrad, RMSProp, Adam',
    short: 'Faster optimizers',
    slides: '33–47',
    read: [
      { gist: 'Each faster optimizer changes plain gradient descent, $\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\nabla_\\theta J(\\boldsymbol{\\theta})$: momentum adds velocity, NAG looks ahead, AdaGrad and RMSProp scale each dimension by its gradient history, Adam does both.' },
      {
        table: {
          head: ['optimizer', 'update (⊗, ⊘ element-wise)', 'hyperparameters · Keras'],
          rows: [
            ['momentum (slides 34–35)', '$\\mathbf{m} \\leftarrow \\beta\\mathbf{m} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta})$; $\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} + \\mathbf{m}$', '$\\beta = 0.9$ · `SGD(learning_rate=0.001, momentum=0.9)`'],
            ['NAG (slides 36–37)', '$\\mathbf{m} \\leftarrow \\beta\\mathbf{m} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta} + \\beta\\mathbf{m})$; $\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} + \\mathbf{m}$', '`SGD(…, momentum=0.9, nesterov=True)`'],
            ['AdaGrad (slides 38–40)', '$\\mathbf{s} \\leftarrow \\mathbf{s} + \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\otimes \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta})$; $\\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\oslash \\sqrt{\\mathbf{s} + \\epsilon}$', '$\\epsilon = 10^{-10}$ · `Adagrad(learning_rate=0.001)`; stops too early: not for DNNs'],
            ['RMSProp (slides 41–42)', '$\\mathbf{s} \\leftarrow \\rho\\mathbf{s} + (1 - \\rho)\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\otimes \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta})$; same $\\boldsymbol{\\theta}$ step', '$\\rho = 0.9$ · `RMSprop(learning_rate=0.001, rho=0.9)`'],
            ['Adam (slides 43–44)', 'momentum’s $\\mathbf{m}$ (with $\\beta_1$) + RMSProp’s $\\mathbf{s}$ (with $\\beta_2$), bias-corrected $\\widehat{\\mathbf{m}}$, $\\widehat{\\mathbf{s}}$', '$\\beta_1 = 0.9$, $\\beta_2 = 0.999$, $\\eta = 0.001$ · `Adam(…)`'],
          ],
        },
      },
      { eq: { name: 'Adam (slide 43)', tex: '\\begin{aligned} &1.\\ \\mathbf{m} \\leftarrow \\beta_1\\mathbf{m} + (1 - \\beta_1)\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\qquad 2.\\ \\mathbf{s} \\leftarrow \\beta_2\\mathbf{s} + (1 - \\beta_2)\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\otimes \\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta}) \\\\ &3.\\ \\widehat{\\mathbf{m}} \\leftarrow \\mathbf{m}/(1 - \\beta_1^{\\,t}) \\qquad 4.\\ \\widehat{\\mathbf{s}} \\leftarrow \\mathbf{s}/(1 - \\beta_2^{\\,t}) \\qquad 5.\\ \\boldsymbol{\\theta} \\leftarrow \\boldsymbol{\\theta} - \\eta\\,\\widehat{\\mathbf{m}} \\oslash \\sqrt{\\widehat{\\mathbf{s}} + \\epsilon} \\end{aligned}', read: 'steps 3–4 boost $\\mathbf{m}$ and $\\mathbf{s}$, which start near zero; $t$ is the iteration number' } },
      {
        list: [
          'Momentum uses the gradient as an **acceleration**, not a speed, and can roll past local optima; NAG measures the gradient slightly ahead, at $\\boldsymbol{\\theta} + \\beta\\mathbf{m}$, so it ends closer to the optimum (slides 34–37).',
          'AdaGrad decays the learning rate faster along steep dimensions (an *adaptive learning rate*) but often stops before the optimum; RMSProp accumulates only recent gradients (slides 38–42).',
          'Variants (slides 45–46): **AdaMax** replaces step 2 with $\\mathbf{s} \\leftarrow \\max(\\beta_2\\mathbf{s}, \\text{abs}(\\nabla_{\\boldsymbol{\\theta}} J(\\boldsymbol{\\theta})))$; **Nadam** = Adam + the Nesterov trick; **AdamW** adds weight decay (e.g. multiply weights by 0.99 each iteration), `AdamW(weight_decay=1e-5, …)`.',
          'Table 11-2 (slide 47): plain `SGD` converges slowest (`*`) but well (`***`); momentum and NAG are `**` fast; the adaptive ones are fast (`***`) with quality `**` or `***`, except AdaGrad (`*`: stops too early).',
        ],
      },
      { slideNote: 'Momentum’s $\\mathbf{m}$ (slide 34) subtracts $\\eta\\nabla$, while Adam’s $\\mathbf{m}$ (slide 43) adds $(1 - \\beta_1)\\nabla$ and step 5 subtracts, so slide 44’s “$\\beta_1$ corresponds to $\\beta$” holds for their role as decay rates only. Slide 43 puts $\\epsilon$ inside the square root; the Adam paper and Keras add it outside, a negligible difference. Slide 38’s $\\epsilon = 10^{-10}$ is Géron’s value (Keras’s default is `1e-07`), and slide 39 repeats the NAG code on an AdaGrad slide (AdaGrad’s is on slide 40).' },
    ],
    play: ['race'],
  },
  {
    id: 's27',
    lec: 2,
    no: '2.7',
    title: 'Learning-rate scheduling',
    short: 'Learning-rate schedules',
    slides: '48–59',
    read: [
      { gist: 'Start with a high learning rate and reduce it: you reach a good solution faster than with the best constant rate.' },
      {
        list: [
          'Too high: training diverges; too low: it converges, but very slowly (slide 48, Figure 11-9). Strategies that change $\\eta$ during training are **learning schedules**; some even start low, rise, then drop (slide 49).',
        ],
      },
      {
        table: {
          head: ['schedule', 'rule', 'Keras'],
          rows: [
            ['power (slides 50–51)', '$\\eta(t) = \\eta_0/(1 + rt/s)^c$, $c$ typically 1: $\\eta_0/(1 + r)$ after $s$ steps, $\\eta_0/(1 + 2r)$ after $2s$', '`InverseTimeDecay(…)`'],
            ['exponential (slides 52–54)', '$\\eta(t) = \\eta_0 r^{t/s}$: drops by a factor $r$ every $s$ steps', '`ExponentialDecay(…)`'],
            ['piecewise constant (slides 55–56)', 'constant for some iterations, then smaller, … (needs fiddling)', '`PiecewiseConstantDecay(boundaries=[…], values=[…])`'],
            ['performance (slides 57–58)', 'measure validation error every $N$ steps; multiply $\\eta$ by $\\lambda$ when it stops dropping', '`ReduceLROnPlateau(factor=0.5, patience=5)`'],
            ['1cycle (slide 59)', 'up linearly from $\\eta_0$ to $\\eta_1$ halfway, back down to $\\eta_0$, last few epochs down by orders of magnitude', 'no Keras call on the slides'],
          ],
        },
      },
      {
        list: [
          '`staircase=True` turns the smooth decay into steps (slides 51, 53). A `LearningRateScheduler` callback runs a function of the **epoch** (callbacks run at the end of each epoch, not each step); or subclass `LearningRateSchedule` (slide 54).',
        ],
      },
      { slideNote: 'Slide 55’s example in words ($\\eta_0 = 0.1$ for 5 iterations, then $\\eta_1 = 0.001$ for the next 50) is not its chart, which steps 0.1 → 0.04 at $t = 5$ → 0.02 at 20 → 0.01 at 30 over 50 iterations (the lab draws the chart’s steps). Slide 57’s text says `ReduceOnPlateau` and “every $N$ steps … by a factor of $\\lambda$”; its code is `ReduceLROnPlateau(factor=0.5, patience=5)`, counted in epochs. Slide 50’s chart legend “decay = 0.1 ($s = 10$)” is $r/s$ with $r = 1$, not the decay rate $r$.' },
    ],
    play: ['schedules'],
  },
  {
    id: 's28',
    lec: 2,
    no: '2.8',
    title: 'Avoiding overfitting: ℓ1/ℓ2 regularization and dropout',
    short: 'ℓ1/ℓ2 & dropout',
    slides: '60–64',
    read: [
      { gist: 'ℓ1/ℓ2 add a penalty on the weights to the loss; dropout ignores each neuron with probability $p$ at every training step, and drops nothing at test time.' },
      {
        list: [
          '`kernel_regularizer=tf.keras.regularizers.l2(0.01)`: at each step the regularization loss is added to the final loss; `l1_l2(...)` for both (slide 60). `functools.partial()` repeats the same settings for every `Dense` layer (slide 61).',
          'Dropout (Hinton et al., 2012): even state-of-the-art networks gained 1% to 2% accuracy; at 95% that drops the error by almost 40% (5% to roughly 3%) (slide 62).',
          'Every neuron, inputs included but **never the outputs**, is dropped with probability $p$ (the **dropout rate**, typically 10% to 50%) for one step; after training nothing is dropped and you simply use the learned weights (slide 63, Figure 11-10).',
          '`Dropout(rate=0.2)` before every `Dense` layer (slide 64). Training and validation losses can look alike while the model overfits, so **evaluate the training loss without dropout** (slide 64).',
        ],
      },
      { unfold: { label: 'Slides 60 and 64: ℓ2 and dropout in Keras, verbatim', blocks: [{ code: { src: 'L2_L2REG', label: 'L2 · slide 60' } }, { code: { src: 'L2_DROPOUT', label: 'L2 · slide 64' } }] } },
      { note: 'Slide 63 says nothing about rescaling. Géron’s chapter corrects for the missing neurons (scale the kept outputs by $1/(1 - p)$ during training, which is what Keras’s `Dropout` layer does), but that is not on these slides.', label: 'Beyond the slides' },
    ],
    play: ['penalties', 'dropout'],
  },
  {
    id: 's29',
    lec: 2,
    no: '2.9',
    title: 'Summary and practical guidelines',
    short: 'Practical guidelines',
    slides: '65–68',
    read: [
      { gist: 'Slide 65’s defaults work fine in most cases (not hard rules); a simple stack of dense layers that can self-normalize uses slide 66’s instead.' },
      {
        table: {
          head: ['hyperparameter', 'default (Table 11-3, slide 65)', 'self-normalizing net (Table 11-4, slide 66)'],
          rows: [
            ['kernel initializer', 'He initialization', 'LeCun initialization'],
            ['activation function', 'ReLU if shallow; Swish if deep', 'SELU'],
            ['normalization', 'None if shallow; batch norm if deep', 'None (self-normalization)'],
            ['regularization', 'Early stopping; weight decay if needed', 'Alpha dropout if needed (not covered in CITS5017)'],
            ['optimizer', 'Nesterov accelerated gradients or AdamW', 'Nesterov accelerated gradients'],
            ['learning rate schedule', 'Performance scheduling or 1cycle', 'Performance scheduling or 1cycle'],
          ],
        },
      },
      'Slide 67 sums up: vanishing and exploding gradients, initialization, nonsaturating activations, batch normalization, fast optimizers and their hyperparameters, learning-rate scheduling, ℓ1 and ℓ2 regularization, dropout. Slide 68: read up to Chapter 14, *Deep Computer Vision Using Convolutional Neural Networks*.',
    ],
  },
];

/* The three notebook pages: one real page each, after the group they cover. */
export const PAGES = [
  {
    id: 'p1',
    no: '1',
    lec: 1,
    after: 's18',
    title: 'Notebook page 1 · Lecture 1',
    railName: 'Notebook page 1',
    sheetTitle: 'Lecture 1 · Intro to ANNs',
    slides: '4–62',
    covers: '§1.1–§1.8',
    lead: 'All of Lecture 1 on one page: perceptrons → MLPs → Keras → hyperparameters. Copy it onto one side of a ruled page and tick lines as they go in.',
  },
  {
    id: 'p2',
    no: '2',
    lec: 2,
    after: 's25',
    title: 'Notebook page 2 · Lecture 2: stable training',
    railName: 'Notebook page 2',
    sheetTitle: 'Lecture 2 · Stable training',
    slides: '4–32',
    covers: '§2.1–§2.5',
    lead: 'Vanishing and exploding gradients, initialization, activations, batch norm, clipping and transfer learning, on one page.',
  },
  {
    id: 'p3',
    no: '3',
    lec: 2,
    after: 's29',
    title: 'Notebook page 3 · Lecture 2: faster and regularized training',
    railName: 'Notebook page 3',
    sheetTitle: 'Lecture 2 · Faster, regularized training',
    slides: '33–66',
    covers: '§2.6–§2.9',
    lead: 'Optimizers, learning-rate schedules, ℓ1/ℓ2, dropout and the practical defaults, on one page.',
  },
];

export const FLOW = SECTIONS.flatMap((s) => [
  { kind: 'sec', id: s.id, item: s },
  ...PAGES.filter((p) => p.after === s.id).map((p) => ({ kind: 'page', id: p.id, item: p })),
]);
