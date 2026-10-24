import { w, h, eq, ul, tbl, fig, slip } from './ink.js';

/* ============================================================================
   EXAM PRACTICE — PRACTICE PAPER B (written for this page)
   ----------------------------------------------------------------------------
   Four questions × 20 marks in the sample paper's format
   (tools/dl-exam-practice/format-spec.md), planned in coverage.md: Q1
   L1–L3 · Q2 sequences (L4, with L3, L1 and L8) · Q3 VAEs, DCGANs, conv and
   linear autoencoders, ViT · Q4 transformer inference and RL. A validator
   checked every question before its answer was written (difficulty and
   likelihood are its ratings); every answer is built from the slides it
   cites and was checked blind against them. Parameter counts and shapes are
   verified in TensorFlow by tools/dl-exam-practice/verify_counts.py.
   ========================================================================== */

const R = String.raw;

export const PAPER_B = {
  id: 'B',
  name: 'Practice Paper B',
  tab: 'Practice paper B',
  head: 'Practice Exam Paper B 2026',
  pages: 20,
  cover: {
    contains: 'This practice exam paper contains: **20** pages **(including title page)**',
    instructions: [
      'This paper contains 4 questions, each is worth 20 marks. **Total : 80 marks**.',
      'The duration of the exam is 2 hours.\nIt is a **closed book** exam.',
      'Candidate should attempt ALL questions.',
      'Answers are to be written on this question paper in the spaces provided.',
    ],
    materialsLead: 'Materials permitted:',
    materials: ['1 UWA approved calculator with sticker.'],
    note: 'Written for this portal from the CITS5017 lecture slides, in the sample paper\'s format. Not an official paper.',
  },
  questions: [
    {
      id: 'b-q1',
      n: 1,
      parts: [
        {
          id: 'b-q1-a',
          label: '(a)',
          page: 2,
          lines: 11,
          source: 'new',
          prompt: [
            R`The diagram below shows a multilayer perceptron of threshold logic units (TLUs). Each TLU computes the weighted sum of its inputs plus its bias and applies the Heaviside step function: $\text{heaviside}(z) = 0$ if $z < 0$ and $1$ if $z \ge 0$. The connection weights and the biases are written on the diagram.`,
            { fig: 'xorMlp', desc: 'Figure: inputs x1 and x2 each connect with weight 1 to two hidden TLUs, h1 (bias −3/2) and h2 (bias −1/2); h1 connects to the output TLU with weight −1 and h2 with weight +1; the output TLU has bias −1/2.' },
            'Based on the diagram,',
          ],
          subs: [
            {
              id: 'b-q1-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`compute the outputs of $h_1$, $h_2$ and the network for the inputs $(x_1, x_2) = (0, 0)$, $(0, 1)$, $(1, 0)$ and $(1, 1)$.`],
              topics: [
                { lec: 'L1', slides: [4, 5], name: 'TLUs and step functions' },
                { lec: 'L1', slides: 17, name: 'An MLP for XOR' },
              ],
              answer: [
                tbl([R`$(x_1, x_2)$`, R`$h_1$`, R`$h_2$`, 'output'], [
                  ['(0, 0)', '0', '0', '0'],
                  ['(0, 1)', '0', '1', '1'],
                  ['(1, 0)', '0', '1', '1'],
                  ['(1, 1)', '1', '1', '0'],
                ], 2),
                w(R`e.g. for (1, 1): $h_1 = \text{step}(2 - 1.5) = 1$, $h_2 = \text{step}(2 - 0.5) = 1$, output $= \text{step}(-1 + 1 - 0.5) = 0$.`),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'b-q1-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['which logical function does the network compute, and why can\'t a single-layer Perceptron compute it?'],
              topics: [
                { lec: 'L1', slides: [12, 17], name: 'XOR and the Perceptron' },
              ],
              answer: [
                w('**XOR** (exclusive or): the output is 1 only when exactly one input is 1.', 1),
                w('Each output neuron of a Perceptron has a **linear** decision boundary, and XOR\'s two classes are not linearly separable; stacking Perceptrons into an MLP solves it.', 1),
              ],
              difficulty: 1,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'b-q1-b',
          label: '(b)',
          page: 3,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below are the update steps of the *Adam* optimizer:',
            { eq: R`\begin{aligned} &1.\quad \mathbf{m} \leftarrow \beta_1 \mathbf{m} + (1 - \beta_1)\nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \\ &2.\quad \mathbf{s} \leftarrow \beta_2 \mathbf{s} + (1 - \beta_2)\nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \otimes \nabla_{\boldsymbol{\theta}} J(\boldsymbol{\theta}) \\ &3.\quad \widehat{\mathbf{m}} \leftarrow \mathbf{m} / (1 - \beta_1^{\,t}) \\ &4.\quad \widehat{\mathbf{s}} \leftarrow \mathbf{s} / (1 - \beta_2^{\,t}) \\ &5.\quad \boldsymbol{\theta} \leftarrow \boldsymbol{\theta} - \eta\, \widehat{\mathbf{m}} \oslash \sqrt{\widehat{\mathbf{s}} + \epsilon} \end{aligned}` },
          ],
          subs: [
            {
              id: 'b-q1-b-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Briefly explain what the vectors $\mathbf{m}$ and $\mathbf{s}$ keep track of, and which two optimizers Adam combines.`],
              topics: [
                { lec: 'L2', slides: 43, name: 'Adam' },
                { lec: 'L2', slides: [34, 41], name: 'Momentum and RMSProp' },
              ],
              answer: [
                w(R`$\mathbf{m}$: an exponentially decaying average of past gradients (an estimate of their mean), like the momentum vector of momentum optimization.`, 1),
                w(R`$\mathbf{s}$: an exponentially decaying average of past **squared** gradients ($\otimes$ element-wise; an estimate of their variance), as in RMSProp. Adam (adaptive moment estimation) combines **momentum optimization** and **RMSProp**.`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'b-q1-b-ii',
              label: 'ii.',
              marks: 1,
              source: 'new',
              prompt: [R`What are $\beta_1$ and $\beta_2$, and what values are they typically set to?`],
              topics: [
                { lec: 'L2', slides: 44, name: 'Adam hyperparameters' },
              ],
              answer: [
                w(R`$\beta_1$ is the momentum decay (like $\beta$ in momentum), typically 0.9; $\beta_2$ is the scaling decay (like $\rho$ in RMSProp), typically 0.999.`, 1),
              ],
              difficulty: 1,
              likelihood: 'medium',
            },
            {
              id: 'b-q1-b-iii',
              label: 'iii.',
              marks: 2,
              source: 'new',
              prompt: [R`Why are steps 3 and 4 needed, and what is $t$?`],
              topics: [
                { lec: 'L2', slides: 43, name: 'Adam steps 3 and 4' },
              ],
              answer: [
                w(R`$\mathbf{m}$ and $\mathbf{s}$ are initialized at around zero, so early on they are too small: steps 3 and 4 normalize them to increase their magnitude.`, 1),
                w(R`$t$ is the iteration number.`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'b-q1-c',
          label: '(c)',
          page: 4,
          lines: 14,
          source: 'new',
          prompt: ['A convolutional layer with 64 filters of size 3 × 3, a stride of 1 and “same” padding is applied to RGB images of 224 × 224 pixels. All values are stored as 32-bit floats.'],
          subs: [
            {
              id: 'b-q1-c-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['How many parameters does the layer have?'],
              topics: [
                { lec: 'L3', slides: [15, 16], name: 'Conv-layer weights' },
                { lec: 'L3', slides: 22, name: 'Counting conv parameters' },
              ],
              answer: [
                w(R`$(3 \times 3 \times 3 + 1) \times 64 =$ **1,792** (27 weights and 1 bias per filter), whatever the image's height and width.`, 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'b-q1-c-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['How many multiplications does the layer compute for one image, and how many bytes do its output feature maps occupy for one image?'],
              topics: [
                { lec: 'L3', slides: [22, 23], name: 'Compute and memory of a conv layer' },
              ],
              answer: [
                w(R`Each of the $224 \times 224 \times 64$ output neurons multiplies $3 \times 3 \times 3 = 27$ inputs: $224 \times 224 \times 64 \times 27 = 86{,}704{,}128$, about **86.7 million** multiplications.`, 1),
                w(R`Output: $224 \times 224 \times 64 = 3{,}211{,}264$ values, × 4 bytes $=$ **12,845,056 bytes**, about 12.8 MB per image.`, 1),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'b-q1-c-iii',
              label: 'iii.',
              marks: 2,
              source: 'new',
              prompt: ['Explain why training a CNN needs much more RAM than making predictions with it, and give two ways to reduce memory use if training runs out of RAM.'],
              topics: [
                { lec: 'L3', slides: [22, 24], name: 'Memory requirements of CNNs' },
              ],
              answer: [
                w('The reverse pass of backpropagation needs all the intermediate values from the forward pass, so training needs (at least) the RAM of all layers together; for predictions a layer\'s RAM is released once the next layer is computed (two consecutive layers).', 1),
                w('Any two: reduce the mini-batch size; use a larger stride; remove a few layers; use 16-bit instead of 32-bit floats; distribute the CNN across multiple devices.', 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'b-q1-d',
          label: '(d)',
          marks: 3,
          page: 5,
          lines: 9,
          source: 'new',
          prompt: [
            'Someone has trained `model_A` to classify 8 of the 10 Fashion MNIST classes. You need a binary classifier for T-shirts versus pullovers but have only 200 labelled images, so you use transfer learning:',
            {
              code: `model_A = tf.keras.models.load_model("my_model_A.keras")
model_B_on_A = tf.keras.Sequential(model_A.layers[:-1])
model_B_on_A.add(tf.keras.layers.Dense(1, activation="sigmoid"))
for layer in model_B_on_A.layers[:-1]:
    layer.trainable = False`,
            },
            'Why is `model_A`\'s output layer replaced by `Dense(1, activation="sigmoid")`? What does the `for` loop do? If transfer learning raises the test accuracy from 91.85% to 93.85%, by how much has the error rate dropped relative to its original value?',
          ],
          topics: [
            { lec: 'L2', slides: [30, 32], name: 'Transfer learning' },
            { lec: 'L1', slides: 29, name: 'Binary classification output' },
          ],
          answer: [
            w('The original output layer is most likely not useful for the new task and has the wrong number of outputs (8 classes); the new task is binary classification, so one output neuron with the logistic (sigmoid) activation is enough.', 1),
            w('The loop **freezes** every reused layer (`trainable = False`), so only the new output layer is trained during the first epochs.', 1),
            w(R`Error rate $8.15\% \to 6.15\%$: a drop of $2 / 8.15 \approx$ **24.5%** (almost 25%).`, 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
        {
          id: 'b-q1-e',
          label: '(e)',
          marks: 3,
          page: 5,
          lines: 9,
          source: 'new',
          prompt: [R`Using the two linear functions $f(z) = 2z + 3$ and $g(z) = 5z - 1$ as two layers, explain why an MLP needs a nonlinear activation function between its layers. Which activation function would you use in the output layer of a regression MLP whose output must always be positive?`],
          topics: [
            { lec: 'L1', slides: 23, name: 'Why activation functions' },
            { lec: 'L1', slides: [24, 25], name: 'Regression outputs' },
          ],
          answer: [
            w(R`Chaining the layers gives $f(g(z)) = 2(5z - 1) + 3 = 10z + 1$: still a linear function.`, 1),
            w('Without some nonlinearity between layers, even a deep stack of layers is equivalent to a single layer, and you can\'t solve very complex problems with it.', 1),
            w(R`Always-positive output: **ReLU** or **softplus**, $\text{softplus}(z) = \log(1 + \exp(z))$.`, 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
      ],
    },
    {
      id: 'b-q2',
      n: 2,
      parts: [
        {
          id: 'b-q2-a',
          label: '(a)',
          page: 6,
          lines: 11,
          source: 'new',
          prompt: [
            R`The diagram below shows an *LSTM cell*. Its four fully connected (FC) layers all receive $\mathbf{x}_{(t)}$ and $\mathbf{h}_{(t-1)}$: three of them use the logistic function and output the gate controllers $\mathbf{f}_{(t)}$, $\mathbf{i}_{(t)}$ and $\mathbf{o}_{(t)}$, and one uses tanh and outputs $\mathbf{g}_{(t)}$.`,
            { fig: 'lstm', desc: 'Figure: the long-term state c(t−1) runs along the top through an element-wise multiplication with f(t) (forget gate) and an addition of i(t) ⊗ g(t) (input gate), leaving as c(t); c(t) also passes through tanh and is multiplied element-wise by o(t) (output gate) to give h(t) = y(t). Four FC layers (f, g, i, o) take x(t) and h(t−1).' },
            'Based on the diagram,',
          ],
          subs: [
            {
              id: 'b-q2-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`write down the equations for the long-term state $\mathbf{c}_{(t)}$ and for the output $\mathbf{y}_{(t)} = \mathbf{h}_{(t)}$.`],
              topics: [
                { lec: 'L4', slides: [44, 47], name: 'LSTM equations' },
              ],
              answer: [
                eq(R`\mathbf{c}_{(t)} = \mathbf{f}_{(t)} \otimes \mathbf{c}_{(t-1)} + \mathbf{i}_{(t)} \otimes \mathbf{g}_{(t)}`, 1),
                eq(R`\mathbf{y}_{(t)} = \mathbf{h}_{(t)} = \mathbf{o}_{(t)} \otimes \tanh\left(\mathbf{c}_{(t)}\right)`, 1),
                w(R`$\otimes$ is element-wise multiplication.`),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'b-q2-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['briefly explain the role of each of the three gates (forget, input and output).'],
              topics: [
                { lec: 'L4', slides: [46, 47], name: 'LSTM gates' },
              ],
              answer: [
                w(R`**Forget** gate $\mathbf{f}_{(t)}$: which parts of the long-term state are erased. **Input** gate $\mathbf{i}_{(t)}$: which parts of $\mathbf{g}_{(t)}$ are added to the long-term state.`, 1),
                w(R`**Output** gate $\mathbf{o}_{(t)}$: which parts of the long-term state are read and output at this time step, to both $\mathbf{h}_{(t)}$ and $\mathbf{y}_{(t)}$.`, 1),
                w('(The gates use the logistic function, so their outputs range from 0 to 1.)'),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'b-q2-b',
          label: '(b)',
          marks: 6,
          page: 7,
          lines: 20,
          source: 'new',
          prompt: [
            'Given below is the code for a network that processes sequences of 30 time steps with 2 features each:',
            {
              code: `model = tf.keras.Sequential([
    tf.keras.layers.InputLayer(shape=[30, 2]),
    tf.keras.layers.Conv1D(filters=8, kernel_size=3, activation="relu"),
    tf.keras.layers.LSTM(16),
    tf.keras.layers.Dense(1)
])`,
            },
            '`Conv1D` uses a stride of 1 and “valid” padding (i.e. no padding) by default. Draw a diagram of the network, showing the shape of the data between layers. Compute the number of parameters of each layer and of the whole network. What does the output of the `Conv1D` layer represent?',
          ],
          topics: [
            { lec: 'L4', slides: 50, name: '1D convolutional layers' },
            { lec: 'L4', slides: [43, 47], name: 'LSTM parameters' },
            { lec: 'L3', slides: [18, 20], name: '"valid" padding' },
            { lec: 'L3', slides: 22, name: 'Counting conv parameters' },
          ],
          answer: [
            fig('bConvLstm', 'Sketch: Input (30, 2) → Conv1D, 8 filters, kernel 3, ReLU → (28, 8) → LSTM, 16 units → (16) → Dense 1 → (1).', 2),
            tbl(['Layer', 'Output', 'Parameters'], [
              ['Conv1D 8, k = 3', '(None, 28, 8)', R`$3 \times 2 \times 8 + 8 = 56$`],
              ['LSTM 16', '(None, 16)', R`$4 \times (8 \times 16 + 16 \times 16 + 16) = 1600$`],
              ['Dense 1', '(None, 1)', R`$16 + 1 = 17$`],
            ], 2),
            w(R`Total $= 56 + 1600 + 17 =$ **1,673**. (An LSTM has 4 FC layers, each with input weights, recurrent weights and biases.)`, 1),
            w('The Conv1D output is one 1D feature map per kernel: 8 sequences of length 28, or equivalently a single 8-dimensional sequence, which the LSTM reads.', 1),
            slip('valid padding shortens the sequence by kernel size − 1: 30 → 28, not 30.'),
          ],
          difficulty: 4,
          likelihood: 'high',
        },
        {
          id: 'b-q2-c',
          label: '(c)',
          marks: 3,
          page: 8,
          lines: 9,
          source: 'new',
          prompt: ['Training an RNN on long sequences can be unstable. Explain why nonsaturating activation functions such as ReLU may not help, how this risk can be reduced, and how *layer normalization* differs from batch normalization.'],
          topics: [
            { lec: 'L4', slides: [40, 41], name: 'Handling long sequences' },
          ],
          answer: [
            w('The same weights are used at every time step, so a nonsaturating activation like ReLU may lead to **exploding outputs**.', 1),
            w('Reduce the risk with a smaller learning rate, or a saturating activation such as the hyperbolic tangent (hence tanh is the default).', 1),
            w('Batch normalization is reported not to work well when used at each time step; **layer normalization** normalizes across the **features** dimension instead of the batch dimension, and is better for RNNs.', 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
        {
          id: 'b-q2-d',
          label: '(d)',
          marks: 3,
          page: 8,
          lines: 9,
          source: 'new',
          prompt: [
            'A data set contains 200 training sequences. Each sequence lists the 2D coordinates of the four noisy vertices of a square, starting from an arbitrary vertex and going either clockwise or anti-clockwise, as in the diagram below. You want a recurrent neural network that reads the four vertices and predicts whether the order is clockwise (label 1) or anti-clockwise (label 0).',
            { fig: 'squares', desc: 'Figure: two noisy squares with vertices numbered 0 to 3 in sequence order; the left one is listed anti-clockwise (label 0), the right one clockwise (label 1).' },
            R`What should be the shapes of the training inputs $X$ and targets $y$? What output layer and loss function would you use? Briefly explain your answer.`,
          ],
          topics: [
            { lec: 'L4', slides: 24, name: '3D inputs to recurrent layers' },
            { lec: 'L4', slides: [9, 12], name: 'Sequence-to-vector, sigmoid output' },
            { lec: 'L1', slides: 29, name: 'Binary classification' },
          ],
          answer: [
            w(R`$X$: **(200, 4, 2)**, i.e. [batch size, time steps, dimensionality]: 200 sequences of 4 vertices, each an $(x, y)$ point. $y$: **(200,)**, one label per sequence (sequence-to-vector).`, 1),
            w('Output layer: `Dense(1, activation="sigmoid")` after the recurrent layer: one logistic neuron giving the probability that the order is clockwise.', 1),
            w('Loss: **binary cross-entropy** (the log loss), since this is binary classification.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
        {
          id: 'b-q2-e',
          label: '(e)',
          marks: 4,
          page: 9,
          lines: 11,
          source: 'new',
          prompt: ['A regular recurrent layer is said to be *causal*. Explain what this means, why a bidirectional recurrent layer is often preferable for tasks such as translation, and how a bidirectional layer combines its outputs.'],
          topics: [
            { lec: 'L8', slides: 6, name: 'Causal recurrent layers' },
            { lec: 'L8', slides: 7, name: 'Bidirectional RNNs' },
          ],
          answer: [
            w('A regular recurrent layer only looks at past and present inputs before generating its output: it is **causal**, meaning it cannot look into the future.', 1),
            w('For translation it is often preferable to look ahead at the next words before encoding a word, e.g. to encode "right" in "the right arm" versus "the right to criticize".', 1),
            w('A **bidirectional** layer runs two recurrent layers on the same inputs, one reading the words from left to right and the other from right to left,', 1),
            w('and combines their outputs at each time step, typically by **concatenating** them.', 1),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
      ],
    },
    {
      id: 'b-q3',
      n: 3,
      parts: [
        {
          id: 'b-q3-a',
          label: '(a)',
          page: 10,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below is a custom layer used in a variational autoencoder (VAE), whose encoder outputs a `mean` and a `logvar` vector for each instance:',
            {
              code: `class Sampling(tf.keras.Layer):
    def call(self, inputs):
        mean, logvar = inputs
        loss = -0.5 * tf.reduce_sum(1 + logvar - tf.exp(logvar) - tf.square(mean), axis=-1)
        self.add_loss(tf.reduce_mean(loss) / 784.)
        return tf.random.normal(tf.shape(logvar)) * tf.exp(logvar / 2) + mean`,
            },
          ],
          subs: [
            {
              id: 'b-q3-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['Write down the latent loss computed by the line `loss = ...` as an equation, defining each symbol.'],
              topics: [
                { lec: 'L67', slides: [12, 13], name: 'The latent loss' },
                { lec: 'L67', slides: 14, name: 'The Sampling layer' },
              ],
              answer: [
                eq(R`\mathscr{L} = -\frac{1}{2}\sum_{i=1}^{n}\left[1 + \gamma_i - \exp(\gamma_i) - \mu_i^2\right]`, 1),
                w('$n$: the codings\' dimension; $\\mu_i$: the $i$th component of the mean coding $\\boldsymbol{\\mu}$ (`mean`); $\\gamma_i$: the $i$th component of $\\boldsymbol{\\gamma} = \\log(\\boldsymbol{\\sigma}^2)$ (`logvar`).', 1),
                w('(The layer averages it over the minibatch, divides by 784 and adds it to the total loss with `add_loss`.)'),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'b-q3-a-ii',
              label: 'ii.',
              marks: 1,
              source: 'new',
              prompt: ['Why does the encoder output `logvar` rather than the standard deviation?'],
              topics: [
                { lec: 'L67', slides: 12, name: 'Why γ = log σ²' },
              ],
              answer: [
                w(R`Making the encoder output $\boldsymbol{\gamma} = \log(\boldsymbol{\sigma}^2)$ rather than $\boldsymbol{\sigma}$ makes the algorithm more numerically stable and the training faster.`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'b-q3-a-iii',
              label: 'iii.',
              marks: 2,
              source: 'new',
              prompt: ['Explain what the `return` line computes and how its result is used.'],
              topics: [
                { lec: 'L67', slides: 11, name: 'Mean and standard deviation codings' },
                { lec: 'L67', slides: [14, 15], name: 'Sampling the codings' },
              ],
              answer: [
                w('`tf.exp(logvar / 2)` $= \\exp(\\boldsymbol{\\gamma}/2) = \\boldsymbol{\\sigma}$, so it computes standard Gaussian noise (mean 0, standard deviation 1) $\\times\\, \\boldsymbol{\\sigma} + \\boldsymbol{\\mu}$: a coding **sampled** from the Gaussian with mean $\\boldsymbol{\\mu}$ and standard deviation $\\boldsymbol{\\sigma}$.', 1),
                w('The sampled coding is passed to the decoder, which reconstructs the input from it.', 1),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'b-q3-b',
          label: '(b)',
          marks: 5,
          page: 11,
          lines: 14,
          source: 'new',
          prompt: [
            'Given below is the generator of a deep convolutional GAN (DCGAN), which takes codings of size 100:',
            {
              code: `generator = tf.keras.Sequential([
    tf.keras.layers.Dense(7 * 7 * 128),
    tf.keras.layers.Reshape([7, 7, 128]),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(64, kernel_size=5, strides=2,
                                    padding="same", activation="relu"),
    tf.keras.layers.BatchNormalization(),
    tf.keras.layers.Conv2DTranspose(1, kernel_size=5, strides=2,
                                    padding="same", activation="tanh"),
])`,
            },
            'Give the output shape of each layer. Then state three of the DCGAN guidelines proposed by Radford et al. that this generator follows, and point to where it follows each one.',
          ],
          topics: [
            { lec: 'L67', slides: 29, name: 'A DCGAN in Keras' },
            { lec: 'L67', slides: 5, name: 'Transposed convolutions' },
            { lec: 'L67', slides: 28, name: 'DCGAN guidelines' },
          ],
          answer: [
            tbl(['Layer', 'Output shape'], [
              ['Dense 7·7·128', '(None, 6272)'],
              ['Reshape', '(None, 7, 7, 128)'],
              ['BatchNormalization', '(None, 7, 7, 128)'],
              ['Conv2DTranspose 64, strides 2', '(None, 14, 14, 64)'],
              ['BatchNormalization', '(None, 14, 14, 64)'],
              ['Conv2DTranspose 1, strides 2', '(None, 28, 28, 1)'],
            ], 2),
            ul([
              ['No pooling layers: it upsamples with **transposed convolutions** (the two `Conv2DTranspose` layers with `strides=2`).', 1],
              ['**Batch normalization** in the generator except its output layer (after the Reshape and after the first `Conv2DTranspose`, none after the last).', 1],
              ['**ReLU** in the generator except the output layer, which uses **tanh**.', 1],
            ]),
            w('(The first Dense layer has no activation, so the ReLU guideline is only partly followed.)'),
          ],
          difficulty: 3,
          likelihood: 'high',
        },
        {
          id: 'b-q3-c',
          label: '(c)',
          marks: 3,
          page: 12,
          lines: 9,
          source: 'new',
          prompt: ['Explain how the encoder and the decoder of a *convolutional autoencoder* change the shape of an image, and which kinds of layers each one uses.'],
          topics: [
            { lec: 'L67', slides: 4, name: 'Convolutional autoencoders' },
            { lec: 'L3', slides: 33, name: 'Typical CNN architecture' },
          ],
          answer: [
            w('The **encoder** is a regular CNN of convolutional and pooling layers: it reduces the spatial dimensions (height and width) while increasing the depth (the number of channels).', 1),
            w('The **decoder** does the reverse: it upscales the image and reduces its depth back to the original dimensions,', 1),
            w('using **transpose convolutional layers** (or upsampling layers combined with convolutional layers).', 1),
          ],
          difficulty: 1,
          likelihood: 'medium',
        },
        {
          id: 'b-q3-d',
          label: '(d)',
          page: 12,
          lines: 11,
          source: 'new',
          prompt: [
            'Given below is the code for an autoencoder trained on a 3D data set `X_train` of shape (60, 3):',
            {
              code: `encoder = tf.keras.models.Sequential([tf.keras.layers.Dense(2)])
decoder = tf.keras.models.Sequential([tf.keras.layers.Dense(3)])
autoencoder = tf.keras.Sequential([encoder, decoder])

optimizer = tf.keras.optimizers.SGD(learning_rate=0.5)
autoencoder.compile(loss="mse", optimizer=optimizer)
history = autoencoder.fit(X_train, X_train, epochs=500, verbose=False)
codings = encoder.predict(X_train)`,
            },
          ],
          subs: [
            {
              id: 'b-q3-d-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: ['Why is the model trained with `X_train` as both its inputs and its targets, and what is the shape of `codings`?'],
              topics: [
                { lec: 'L5', slides: [4, 6], name: 'Autoencoders · reconstructions' },
                { lec: 'L5', slides: 9, name: 'Codings of the linear AE' },
              ],
              answer: [
                w('An autoencoder learns to reproduce its inputs without labels: its outputs (the reconstructions) are compared with the inputs, and the reconstruction loss (here MSE) penalizes any difference.', 1),
                w('`codings` has shape **(60, 2)**: the encoder\'s 2D coding of each of the 60 instances.', 1),
              ],
              difficulty: 1,
              likelihood: 'high',
            },
            {
              id: 'b-q3-d-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Why does this autoencoder end up performing principal component analysis (PCA), and why is it called *undercomplete*?'],
              topics: [
                { lec: 'L5', slides: [7, 8], name: 'Undercomplete linear AE = PCA' },
              ],
              answer: [
                w('It uses only linear activations (no activation function) and the cost function is the MSE; such an autoencoder can be shown to perform PCA.', 1),
                w('Its codings (2D) have a lower dimensionality than its inputs (3D), so it cannot trivially copy its inputs and is forced to learn the most important features.', 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'b-q3-e',
          label: '(e)',
          marks: 3,
          page: 13,
          lines: 9,
          source: 'new',
          prompt: ['The original *vision transformer* (ViT) chops an image into 16 × 16 squares. For a 224 × 224 RGB image, how many squares are produced, and how long is the vector that each square becomes? Why did the ViT need over 300 million additional training images to beat the state of the art?'],
          topics: [
            { lec: 'L8', slides: 46, name: 'The vision transformer' },
          ],
          answer: [
            w(R`$224 / 16 = 14$ squares per side, so $14 \times 14 =$ **196** squares.`, 1),
            w(R`Each square is flattened into a $16 \times 16 \times 3 =$ **768**-dimensional vector (3 for the RGB channels).`, 1),
            w('Transformers don\'t have as many inductive biases as CNNs, so they need extra data just to learn things that CNNs implicitly assume.', 1),
          ],
          difficulty: 2,
          likelihood: 'medium',
        },
      ],
    },
    {
      id: 'b-q4',
      n: 4,
      parts: [
        {
          id: 'b-q4-a',
          label: '(a)',
          page: 14,
          lines: 11,
          source: 'new',
          prompt: ['A trained *transformer* translates the English sentence “I like soccer” into the Spanish “Me gusta el fútbol”.'],
          subs: [
            {
              id: 'b-q4-a-i',
              label: 'i.',
              marks: 2,
              source: 'new',
              prompt: [R`Describe how the decoder produces the translation at inference time, starting from the $\langle\text{SOS}\rangle$ token. How many times is the whole network run to output “Me gusta el fútbol $\langle\text{EOS}\rangle$”?`],
              topics: [
                { lec: 'L8', slides: [41, 42], name: 'Generating a translation' },
              ],
              answer: [
                w(R`Only $\langle\text{SOS}\rangle$ goes into the decoder; the network predicts the first word ("Me"), which is appended to the decoder's input, and the entire network is run again to predict the next word, until it outputs $\langle\text{EOS}\rangle$.`, 1),
                w(R`One run per output token (Me, gusta, el, fútbol, $\langle\text{EOS}\rangle$): **5** runs.`, 1),
              ],
              difficulty: 3,
              likelihood: 'medium',
            },
            {
              id: 'b-q4-a-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Explain what the decoder\'s *masked* multi-head attention layer does, and how it differs from the decoder\'s upper multi-head attention layer.'],
              topics: [
                { lec: 'L8', slides: 31, name: 'Masked multi-head attention' },
                { lec: 'L8', slides: 40, name: 'Cross-attention' },
              ],
              answer: [
                w('**Masked** multi-head attention updates each word\'s representation by attending to the other words of its own (Spanish) sentence, but not to the words after it: a causal layer, made by masking.', 1),
                w('The **upper** layer is **cross-attention**: the decoder pays attention to the words of the English sentence (keys and values from the encoder\'s outputs, queries from the decoder).', 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
          ],
        },
        {
          id: 'b-q4-b',
          label: '(b)',
          marks: 5,
          page: 15,
          lines: 16,
          source: 'new',
          prompt: [
            R`The diagram below shows a Markov decision process (MDP) with states $s_0$, $s_1$, $s_2$ and actions $a_0$, $a_1$, $a_2$. Each arrow is labelled with its transition probability, and the rewards of the transitions that have one are shown in red. Actions that are not drawn from a state are not available in that state.`,
            { fig: 'mdp', desc: 'Figure: from s0, action a0 returns to s0 with probability 0.7 (reward +10) or goes to s1 with 0.3; a1 returns to s0 with 1.0; a2 returns to s0 with 0.8 or goes to s1 with 0.2. From s1, a0 stays in s1 with 1.0; a2 goes to s2 with 1.0 (reward −50). From s2, a1 goes to s0 with 0.8 (reward +40), to s1 with 0.1 and stays in s2 with 0.1.' },
            'The value iteration algorithm updates the state values as follows:',
            { eq: R`V_{k+1}(s) \leftarrow \max_{a} \sum_{s'} T(s, a, s')\,[R(s, a, s') + \gamma V_k(s')] \;\text{ for all } s` },
            R`With $\gamma = 0.9$ and $V_0(s) = 0$ for every state, compute $V_1(s)$ and $V_2(s)$ for all three states.`,
          ],
          topics: [
            { lec: 'L9', slides: 41, name: 'An MDP' },
            { lec: 'L9', slides: [43, 44], name: 'Value iteration' },
            { lec: 'L9', slides: 47, name: 'The MDP as arrays' },
          ],
          answer: [
            h(R`Iteration 1 ($V_0 = 0$)`),
            w(R`$V_1(s_0) = \max(0.7 \times 10,\ 0,\ 0) = 7$; $V_1(s_1) = \max(0,\ -50) = 0$; $V_1(s_2) = 0.8 \times 40 = 32$.`, 2),
            h(R`Iteration 2 ($\gamma = 0.9$)`),
            w(R`$s_0$: $a_0$ gives $0.7(10 + 0.9 \times 7) + 0.3(0.9 \times 0) = 11.41$; $a_1$ gives $0.9 \times 7 = 6.3$; $a_2$ gives $0.8(0.9 \times 7) = 5.04$; so $V_2(s_0) =$ **11.41**.`, 1),
            w(R`$s_1$: $\max(0,\ -50 + 0.9 \times 32 = -21.2)$, so $V_2(s_1) =$ **0**.`, 1),
            w(R`$s_2$: $0.8(40 + 0.9 \times 7) + 0.1(0.9 \times 0) + 0.1(0.9 \times 32) = 37.04 + 2.88 =$ **39.92**.`, 1),
            slip(R`leaving out the $0.1 \times 0.9 \times 32$ term for staying in $s_2$.`),
          ],
          difficulty: 4,
          likelihood: 'medium',
        },
        {
          id: 'b-q4-c',
          label: '(c)',
          page: 16,
          lines: 9,
          source: 'new',
          prompt: [
            R`Running Q-value iteration to convergence on the same MDP with $\gamma = 0.9$ gives the Q-values below ($-\infty$ marks an action that is not possible in that state):`,
            { table: { head: ['', '$a_0$', '$a_1$', '$a_2$'], rows: [['$s_0$', '18.92', '17.03', '13.62'], ['$s_1$', '0', '$-\\infty$', '−4.88'], ['$s_2$', '$-\\infty$', '50.13', '$-\\infty$']] } },
          ],
          subs: [
            {
              id: 'b-q4-c-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: [R`Briefly explain what the optimal Q-value $Q^*(s, a)$ means.`],
              topics: [
                { lec: 'L9', slides: 45, name: 'Q-values' },
              ],
              answer: [
                w(R`$Q^*(s, a)$ is the sum of discounted future rewards the agent can expect on average after it reaches state $s$ and chooses action $a$, before it sees the outcome of that action, assuming it acts optimally afterwards.`, 1),
              ],
              difficulty: 1,
              likelihood: 'medium',
            },
            {
              id: 'b-q4-c-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: [R`Give the optimal policy $\pi^*(s)$ for each state, and explain the choice in state $s_1$.`],
              topics: [
                { lec: 'L9', slides: [46, 49], name: 'The optimal policy' },
              ],
              answer: [
                w(R`$\pi^*(s) = \operatorname{argmax}_a Q^*(s, a)$: $\pi^*(s_0) = a_0$, $\pi^*(s_1) = a_0$, $\pi^*(s_2) = a_1$.`, 1),
                w(R`In $s_1$, staying put ($a_0$, $Q = 0$) beats going through the fire ($a_2$: $-50 + 0.9 \times 50.13 = -4.88$). (With $\gamma = 0.95$ the agent would take $a_2$.)`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'b-q4-d',
          label: '(d)',
          page: 17,
          lines: 11,
          source: 'new',
          prompt: [
            'Given below is a deep Q-network (DQN) for CartPole (4 observation values, 2 actions), followed by the lines of its training step that compute the target Q-values:',
            {
              code: `model = tf.keras.Sequential([
    tf.keras.layers.Dense(32, activation="elu", input_shape=[4]),
    tf.keras.layers.Dense(32, activation="elu"),
    tf.keras.layers.Dense(2)
])

next_Q_values = model.predict(next_states, verbose=0)
max_next_Q_values = next_Q_values.max(axis=1)
runs = 1.0 - (dones | truncateds)  # episode is not done or truncated
target_Q_values = rewards + runs * discount_factor * max_next_Q_values`,
            },
          ],
          subs: [
            {
              id: 'b-q4-d-i',
              label: 'i.',
              marks: 1,
              source: 'new',
              prompt: ['Compute the number of trainable parameters of the DQN.'],
              topics: [
                { lec: 'L9', slides: 61, name: 'A DQN in Keras' },
                { lec: 'L1', slides: 8, name: 'Dense layers' },
                { lec: 'L1', slides: 36, name: 'Dense-layer parameters' },
              ],
              answer: [
                w(R`$4 \times 32 + 32 = 160$; $32 \times 32 + 32 = 1056$; $32 \times 2 + 2 = 66$: **1,282** trainable parameters.`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
            {
              id: 'b-q4-d-ii',
              label: 'ii.',
              marks: 2,
              source: 'new',
              prompt: ['Write down the target Q-value $y(s, a)$ as an equation, explain each term, and say what `runs` does to it in the code.'],
              topics: [
                { lec: 'L9', slides: 60, name: 'The target Q-value' },
                { lec: 'L9', slides: 63, name: 'The training step' },
              ],
              answer: [
                eq(R`y(s, a) = r + \gamma \max_{a'} Q_{\boldsymbol{\theta}}(s', a')`),
                w(R`$r$: the reward observed after playing $a$ in $s$; $\gamma$: the discount factor; $\max_{a'} Q_{\boldsymbol{\theta}}(s', a')$: the DQN's highest Q-value for the next state $s'$, estimating the future rewards. The DQN is trained to bring $Q_{\boldsymbol{\theta}}(s, a)$ close to $y$.`, 1),
                w('`runs` is 0 when the episode is done or truncated, so the target is then just the reward (no future rewards); otherwise it is 1.', 1),
              ],
              difficulty: 2,
              likelihood: 'high',
            },
            {
              id: 'b-q4-d-iii',
              label: 'iii.',
              marks: 1,
              source: 'new',
              prompt: ['Compute the target for a transition with reward 1, `discount_factor = 0.95` and next-state Q-values [3.0, 5.0], first when the episode has not ended and then when it has ended.'],
              topics: [
                { lec: 'L9', slides: [60, 63], name: 'Computing a target' },
              ],
              answer: [
                w(R`Not ended: $1 + 0.95 \times \max(3.0, 5.0) =$ **5.75**. Ended: $1 + 0 =$ **1.0**.`, 1),
              ],
              difficulty: 2,
              likelihood: 'medium',
            },
          ],
        },
        {
          id: 'b-q4-e',
          label: '(e)',
          marks: 4,
          page: 18,
          lines: 11,
          source: 'new',
          prompt: ['*Policy gradient* algorithms optimize a policy\'s parameters by following the gradients toward higher rewards. Briefly explain the four steps of the REINFORCE variant covered in the lecture.'],
          topics: [
            { lec: 'L9', slides: [29, 31], name: 'Policy gradients · REINFORCE' },
          ],
          answer: [
            ul([
              ['**1.** Let the neural network policy play the game several times; at each step compute the gradients that would make the chosen action even more likely, but don\'t apply them yet.', 1],
              ['**2.** After several episodes, compute each action\'s score: its discounted return, normalized over all the episodes (the **action advantage**).', 1],
              ['**3.** Multiply each gradient vector by its action\'s score: positive scores make good actions more likely, negative scores make bad ones less likely.', 1],
              ['**4.** Compute the mean of all the resulting gradient vectors and use it to perform a gradient descent step.', 1],
            ]),
          ],
          difficulty: 2,
          likelihood: 'high',
        },
      ],
    },
  ],
};
